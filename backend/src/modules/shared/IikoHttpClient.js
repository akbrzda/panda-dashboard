const crypto = require("crypto");
const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const ConcurrencyLimiter = require("./ConcurrencyLimiter");
const fileLogger = require("../../utils/fileLogger");

class IikoHttpClient {
  constructor(options = {}) {
    this.serverBaseUrl = this.normalizeBaseUrl(options.serverBaseUrl || process.env.IIKO_SERVER_BASE_URL || process.env.IIKO_BASE_URL);
    this.legacyBaseUrl = this.normalizeBaseUrl(
      options.legacyBaseUrl || process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL,
    );
    this.username = options.username || process.env.IIKO_USER;
    this.password = options.password || process.env.IIKO_PASSWORD;
    this.timeout = Number(options.timeout || process.env.IIKO_TIMEOUT || 45000);
    this.maxNetworkRetries = Number(options.maxNetworkRetries || process.env.IIKO_NETWORK_RETRIES || 4);
    this.logger = options.logger || fileLogger;
    this.resolveLegacyStoreId =
      typeof options.resolveLegacyStoreId === "function"
        ? options.resolveLegacyStoreId
        : async (storeId) => String(storeId || "").trim();
    this.concurrencyLimiter =
      options.concurrencyLimiter || new ConcurrencyLimiter(Number(options.maxConcurrentRequests || process.env.IIKO_MAX_CONCURRENT_REQUESTS || 1));
  }

  normalizeBaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/resto\/api$/i, "");
  }

  setMaxConcurrentRequests(value) {
    this.concurrencyLimiter.setLimit(value);
  }

  async delay(ms) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
  }

  createClient(baseURL = this.serverBaseUrl || this.legacyBaseUrl) {
    const jar = new CookieJar();
    return wrapper(
      axios.create({
        baseURL,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
        },
        jar,
        withCredentials: true,
      }),
    );
  }

  isRetriableError(error) {
    const code = error?.code;
    const status = error?.response?.status;

    return (
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(code) ||
      [429, 500, 502, 503, 504].includes(status)
    );
  }

  getRetryDelay(attempt) {
    return Math.min(1000 * 2 ** attempt, 8000);
  }

  shouldSuppressRetryLog(context = {}, error) {
    const code = error?.code;
    const status = error?.response?.status;
    return context.stage === "olap-fetch" && (status === 400 || ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET"].includes(code));
  }

  async withRetry(fn, context = {}, retries = this.maxNetworkRetries) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const startedAt = Date.now();

      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const retriable = this.isRetriableError(error);
        const suppressLog = this.shouldSuppressRetryLog(context, error);
        const durationMs = Date.now() - startedAt;
        const delayMs = this.getRetryDelay(attempt);
        const payload = {
          stage: context.stage,
          storeId: context.storeId,
          fetchId: context.fetchId,
          attempt: attempt + 1,
          durationMs,
          code: error?.code,
          status: error?.response?.status,
          message: error?.message,
          detail: error?.response?.data?.errorMessage || error?.response?.data?.detail || undefined,
        };

        if (!retriable || attempt === retries) {
          if (!suppressLog) {
            this.logger.error("IIKO запрос завершился ошибкой", payload);
          }
          throw error;
        }

        if (!suppressLog) {
          this.logger.warn("IIKO запрос будет повторен", { ...payload, nextDelayMs: delayMs });
        }

        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  async requestWithRetry(client, config, context = {}, retries = this.maxNetworkRetries) {
    return await this.withRetry(() => client.request(config), { ...context, method: config.method, url: config.url }, retries);
  }

  createPasswordHash(password) {
    return crypto.createHash("sha1").update(String(password || "")).digest("hex");
  }

  extractToken(data) {
    if (typeof data === "string") {
      const normalized = data.trim().replace(/^"+|"+$/g, "");
      return normalized || null;
    }

    if (typeof data === "object" && data !== null) {
      return data.key || data.token || data.data || null;
    }

    return null;
  }

  shouldFallbackToLegacy(error) {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || error?.response?.data?.errorDescription || error?.message || "").toLowerCase();

    return (
      [400, 401, 403, 404, 405, 415, 422, 500, 501].includes(status) ||
      message.includes("/resto/api") ||
      message.includes("not found") ||
      message.includes("cannot")
    );
  }

  async authenticateWithServerApi(client, storeId) {
    const response = await this.requestWithRetry(
      client,
      {
        method: "get",
        url: "/resto/api/auth",
        params: {
          login: this.username,
          pass: this.createPasswordHash(this.password),
        },
        timeout: Math.min(this.timeout, 15000),
        responseType: "text",
        transformResponse: [(data) => data],
      },
      { stage: "auth-server", storeId },
    );

    const key = this.extractToken(response.data);
    if (!key) {
      throw new Error("iikoServer не вернул токен авторизации");
    }

    if (storeId) {
      try {
        await client.post(`/api/stores/select/${storeId}`);
      } catch (_) {}
    }

    return { mode: "server-v2", key };
  }

  async authenticateLegacyApi(client, storeId) {
    const legacyStoreId = await this.resolveLegacyStoreId(storeId);

    await this.requestWithRetry(
      client,
      {
        method: "post",
        url: "/api/auth/login",
        data: { login: this.username, password: this.password },
      },
      { stage: "auth-login", storeId: legacyStoreId },
    );

    try {
      const selectResponse = await this.requestWithRetry(
        client,
        {
          method: "post",
          url: `/api/stores/select/${legacyStoreId}`,
        },
        { stage: "auth-select-store", storeId: legacyStoreId },
      );

      if (selectResponse.data?.error) {
        throw new Error(selectResponse.data?.errorMessage || `IIKO отказал в доступе к store ${legacyStoreId}`);
      }
    } catch (error) {
      const status = error?.response?.status;
      const message = String(error?.response?.data?.errorMessage || error?.message || "").toLowerCase();
      const routeMissing = status === 404 && message.includes("no route found");

      if (!routeMissing) {
        throw error;
      }

      this.logger.warn("Legacy API не поддерживает выбор стора через select", {
        storeId: legacyStoreId,
      });
    }

    return { mode: "legacy", key: null };
  }

  async logout(client) {
    const session = client.__iikoSession || {};

    try {
      if (session.mode === "server-v2") {
        await client.get("/resto/api/logout", {
          params: session.key ? { key: session.key } : undefined,
          responseType: "text",
          transformResponse: [(data) => data],
        });
        return;
      }

      await client.post("/api/auth/logout");
    } catch (_) {}
  }

  async withAuth(storeId, fn, options = {}) {
    return await this.concurrencyLimiter.run(async () => {
      const allowLegacy = options.allowLegacy !== false;
      const client = this.createClient();

      try {
        let session;

        try {
          if (this.serverBaseUrl) {
            client.defaults.baseURL = this.serverBaseUrl;
          }

          session = await this.authenticateWithServerApi(client, storeId);
        } catch (error) {
          if (!allowLegacy || !this.shouldFallbackToLegacy(error) || !this.legacyBaseUrl) {
            throw error;
          }

          this.logger.warn("iikoServer v2 недоступен, используется совместимый режим", {
            storeId,
            message: error?.message,
          });

          client.defaults.baseURL = this.legacyBaseUrl;
          session = await this.authenticateLegacyApi(client, storeId);
        }

        client.__iikoSession = { ...session, storeId };
        return await fn(client, this.delay.bind(this));
      } finally {
        await this.logout(client);
      }
    });
  }
}

module.exports = IikoHttpClient;
