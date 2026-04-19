const fileLogger = require("../../utils/fileLogger");

class OlapPoller {
  constructor(options = {}) {
    this.httpClient = options.httpClient;
    this.queryBuilder = options.queryBuilder;
    this.logger = options.logger || fileLogger;
    this.pollInterval = Number(options.pollInterval || 500);
    this.maxAttempts = Number(options.maxAttempts || process.env.IIKO_OLAP_MAX_ATTEMPTS || 120);
    this.timeout = Number(options.timeout || process.env.IIKO_TIMEOUT || 45000);
  }

  isPendingOlapResponse(response) {
    return response?.status === 400;
  }

  async executeServerOlap(client, body, options = {}) {
    const session = client.__iikoSession || {};
    const serverBody = this.queryBuilder.buildServerReportBody(body);
    const response = await this.httpClient.requestWithRetry(
      client,
      {
        method: "post",
        url: "/resto/api/v2/reports/olap",
        params: session.key ? { key: session.key } : undefined,
        data: serverBody,
        timeout: Math.max(this.timeout, Number(options.fetchTimeoutMs || 0)),
      },
      { stage: "olap-v2", storeId: session.storeId },
    );

    return this.queryBuilder.normalizeServerRows(response.data, body);
  }

  async executeLegacyOlap(client, delay, body, options = {}) {
    const normalizedStoreIds = [];
    const sourceStoreIds = Array.isArray(body?.storeIds) ? body.storeIds : [];

    for (const sourceStoreId of sourceStoreIds) {
      const legacyStoreId = await this.httpClient.resolveLegacyStoreId(sourceStoreId);
      if (/^\d+$/.test(String(legacyStoreId || "").trim())) {
        normalizedStoreIds.push(String(legacyStoreId).trim());
      }
    }

    const normalizedBody = {
      ...body,
      storeIds: normalizedStoreIds.length > 0 ? normalizedStoreIds : sourceStoreIds,
    };

    if (normalizedStoreIds.length === 0) {
      this.logger.warn("Для legacy OLAP не найден числовой storeId", {
        sourceStoreIds,
      });
    }

    const storeId = normalizedStoreIds[0] || sourceStoreIds[0];
    const maxAttempts = Number(options.maxAttempts || this.maxAttempts);
    const fetchTimeoutMs = Number(options.fetchTimeoutMs || Math.min(this.timeout, 5000));
    const logEvery = Number(options.logEvery || 20);

    const initResp = await this.httpClient.requestWithRetry(
      client,
      {
        method: "post",
        url: "/api/olap/init",
        data: normalizedBody,
        timeout: Math.min(this.timeout, 10000),
      },
      { stage: "olap-init", storeId },
    );

    const fetchId = initResp.data?.data;
    if (!fetchId) {
      throw new Error("OLAP init не вернул fetchId");
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.httpClient.requestWithRetry(
          client,
          {
            method: "get",
            url: `/api/olap/fetch/${fetchId}/sales`,
            timeout: fetchTimeoutMs,
            validateStatus: (status) => (status >= 200 && status < 300) || status === 400,
          },
          { stage: "olap-fetch", storeId, fetchId, pollAttempt: attempt + 1 },
          0,
        );

        if (this.isPendingOlapResponse(response)) {
          if ((attempt + 1) % logEvery === 0) {
            this.logger.info("OLAP еще формируется", {
              storeId,
              fetchId,
              attempt: attempt + 1,
            });
          }

          await delay(this.pollInterval);
          continue;
        }

        const data = response.data;
        if (data && (data.cells || data.result?.rawData || Array.isArray(data?.data))) {
          return data;
        }
      } catch (error) {
        const status = error?.response?.status;
        const code = error?.code;
        const isExpectedPending = status === 400 || ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET"].includes(code);

        if (isExpectedPending && attempt < maxAttempts - 1) {
          if ((attempt + 1) % logEvery === 0) {
            this.logger.info("OLAP еще формируется", {
              storeId,
              fetchId,
              attempt: attempt + 1,
            });
          }

          await delay(this.pollInterval);
          continue;
        }

        if (this.httpClient.isRetriableError(error) && attempt < maxAttempts - 1) {
          this.logger.warn("OLAP fetch временно недоступен", {
            storeId,
            fetchId,
            attempt: attempt + 1,
            code,
            status,
            message: error?.message,
          });
          await delay(this.pollInterval);
          continue;
        }

        throw error;
      }

      await delay(this.pollInterval);
    }

    throw new Error(`OLAP не успел ответить за ${maxAttempts} попыток`);
  }

  async pollOlap(client, delay, body, options = {}) {
    const allowLegacy = options.allowLegacy !== false;
    const session = client.__iikoSession || {};

    if (session.mode === "server-v2") {
      try {
        return await this.executeServerOlap(client, body, options);
      } catch (error) {
        if (!allowLegacy || !this.httpClient.shouldFallbackToLegacy(error)) {
          throw error;
        }

        this.logger.warn("OLAP v2 недоступен, выполняется совместимый запрос", {
          storeId: session.storeId,
          message: error?.message,
        });

        if (this.httpClient.legacyBaseUrl) {
          client.defaults.baseURL = this.httpClient.legacyBaseUrl;
        }

        const fallbackSession = await this.httpClient.authenticateLegacyApi(client, session.storeId);
        client.__iikoSession = { ...session, ...fallbackSession };
      }
    }

    return await this.executeLegacyOlap(client, delay, body, options);
  }
}

module.exports = OlapPoller;
