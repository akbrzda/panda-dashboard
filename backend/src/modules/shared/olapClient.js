const crypto = require("crypto");
const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const organizationsService = require("../organizations/service");

class OlapClient {
  constructor() {
    this.serverBaseUrl = this.normalizeBaseUrl(process.env.IIKO_SERVER_BASE_URL || process.env.IIKO_BASE_URL);
    this.legacyBaseUrl = this.normalizeBaseUrl(process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL);
    this.username = process.env.IIKO_USER;
    this.password = process.env.IIKO_PASSWORD;
    this.timeout = Number(process.env.IIKO_TIMEOUT || 45000);
    this.pollInterval = 500;
    this.maxAttempts = Number(process.env.IIKO_OLAP_MAX_ATTEMPTS || 120);
    this.maxNetworkRetries = Number(process.env.IIKO_NETWORK_RETRIES || 4);
    this.maxConcurrentRequests = Number(process.env.IIKO_MAX_CONCURRENT_REQUESTS || 1);
  }

  normalizeBaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/resto\/api$/i, "");
  }

  async delay(ms) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async runWithConcurrencyLimit(task) {
    await new Promise((resolve) => {
      const tryStart = () => {
        if (OlapClient.activeRequests < this.maxConcurrentRequests) {
          OlapClient.activeRequests += 1;
          resolve();
          return;
        }

        OlapClient.requestQueue.push(tryStart);
      };

      tryStart();
    });

    try {
      return await task();
    } finally {
      OlapClient.activeRequests = Math.max(0, OlapClient.activeRequests - 1);
      const nextTask = OlapClient.requestQueue.shift();

      if (typeof nextTask === "function") {
        nextTask();
      }
    }
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

    for (let attempt = 0; attempt <= retries; attempt++) {
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
        };

        if (!retriable || attempt === retries) {
          if (!suppressLog) {
            console.error("❌ IIKO запрос завершился ошибкой:", payload);
          }
          throw error;
        }

        if (!suppressLog) {
          console.warn("⚠️ IIKO запрос будет повторён:", { ...payload, nextDelayMs: delayMs });
        }
        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  async requestWithRetry(client, config, context = {}, retries = this.maxNetworkRetries) {
    return await this.withRetry(() => client.request(config), { ...context, method: config.method, url: config.url }, retries);
  }

  isPendingOlapResponse(response) {
    return response?.status === 400;
  }

  createPasswordHash(password) {
    return crypto
      .createHash("sha1")
      .update(String(password || ""))
      .digest("hex");
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

  extractOlapFieldName(value) {
    const source = String(value || "").trim();
    const match = source.match(/^\[([^\]]+)\]$/);
    return match?.[1] || source || null;
  }

  normalizeServerDateValue(value) {
    const source = String(value || "").trim();

    if (!source) {
      return source;
    }

    return source.replace(/\.\d{3}/g, "").replace(/Z$/i, "");
  }

  normalizeServerFilter(filter = {}) {
    const filterType = String(filter.filterType || "").toLowerCase();

    if (filterType === "date_range") {
      return {
        filterType: "DateRange",
        periodType: "CUSTOM",
        from: this.normalizeServerDateValue(filter.dateFrom || filter.from),
        to: this.normalizeServerDateValue(filter.dateTo || filter.to),
        includeLow: filter.includeLeft ?? filter.includeLow ?? true,
        includeHigh: filter.includeRight ?? filter.includeHigh ?? false,
      };
    }

    if (filterType === "range") {
      return {
        filterType: "Range",
        from: filter.valueMin ?? filter.from ?? null,
        to: filter.valueMax ?? filter.to ?? null,
        includeLow: filter.includeLeft ?? filter.includeLow ?? true,
        includeHigh: filter.includeRight ?? filter.includeHigh ?? false,
      };
    }

    if (filterType === "include_values" || filterType === "exclude_values") {
      return {
        filterType: filterType === "include_values" ? "IncludeValues" : "ExcludeValues",
        values: Array.isArray(filter.valueList) ? filter.valueList : Array.isArray(filter.values) ? filter.values : [],
      };
    }

    return filter;
  }

  normalizeFilters(filters) {
    if (!filters) {
      return {};
    }

    if (!Array.isArray(filters)) {
      return filters;
    }

    return filters.reduce((accumulator, filter) => {
      if (filter?.field) {
        accumulator[filter.field] = this.normalizeServerFilter(filter);
      }
      return accumulator;
    }, {});
  }

  buildServerReportBody(body = {}) {
    const calculatedFields = Array.isArray(body.calculatedFields) ? body.calculatedFields : [];
    const dataFields = Array.isArray(body.dataFields) ? body.dataFields : [];
    const aggregateFields = Array.isArray(body.aggregateFields)
      ? body.aggregateFields
      : dataFields
          .map((fieldName) => {
            const calculatedField = calculatedFields.find((item) => item?.name === fieldName);
            return this.extractOlapFieldName(calculatedField?.formula || fieldName);
          })
          .filter(Boolean);

    const filters = this.normalizeFilters(body.filters);
    const storeIds = Array.isArray(body.storeIds) ? body.storeIds.map((value) => String(value || "").trim()).filter(Boolean) : [];

    if (storeIds.length > 0 && !filters["Department.Id"]) {
      filters["Department.Id"] = {
        filterType: "IncludeValues",
        values: storeIds,
      };
    }

    return {
      reportType: body.reportType || body.olapType || "SALES",
      buildSummary: body.buildSummary ?? true,
      groupByRowFields: Array.isArray(body.groupByRowFields) ? body.groupByRowFields : Array.isArray(body.groupFields) ? body.groupFields : [],
      groupByColFields: Array.isArray(body.groupByColFields) ? body.groupByColFields : [],
      aggregateFields,
      filters,
    };
  }

  normalizeServerRows(result, body = {}) {
    if (!Array.isArray(result?.data)) {
      return result;
    }

    const aliasMap = new Map();
    for (const field of body.calculatedFields || []) {
      const actualFieldName = this.extractOlapFieldName(field?.formula || field?.name);
      if (actualFieldName && field?.name) {
        aliasMap.set(actualFieldName, field.name);
      }
    }

    if (aliasMap.size === 0) {
      return result;
    }

    return {
      ...result,
      data: result.data.map((row) => {
        const normalizedRow = { ...row };

        for (const [actualFieldName, alias] of aliasMap.entries()) {
          if (normalizedRow[alias] === undefined && row?.[actualFieldName] !== undefined) {
            normalizedRow[alias] = row[actualFieldName];
          }
        }

        return normalizedRow;
      }),
    };
  }

  normalizeFlag(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim().toUpperCase();
  }

  isTrueFlag(value) {
    if (value === true || value === 1) {
      return true;
    }

    const flag = this.normalizeFlag(value);
    return flag === "TRUE" || flag === "YES" || flag === "1";
  }

  isDeletedOrderFlag(value) {
    const flag = this.normalizeFlag(value);
    return flag === "DELETED" || flag === "ORDER_DELETED";
  }

  hasItemDeletionFlag(value) {
    const flag = this.normalizeFlag(value);
    return Boolean(flag) && flag !== "NOT_DELETED";
  }

  getOrderId(row = {}) {
    return row["UniqOrderId.Id"] || row.OrderId || `${row.OrderNum || "NA"}|${row.OpenTime || ""}|${row.CloseTime || ""}`;
  }

  filterCanceledOrders(rows = []) {
    const ordersMap = new Map();

    for (const row of rows) {
      const orderId = this.getOrderId(row);
      const isOrderDeleted = this.isDeletedOrderFlag(row.OrderDeleted);
      const isStorned = this.isTrueFlag(row.Storned);
      const hasCancelCause = Boolean(String(row["Delivery.CancelCause"] || "").trim());
      const hasItemDeletion = this.hasItemDeletionFlag(row.DeletedWithWriteoff);
      const sales = Number(row.Sales ?? row["DishDiscountSumInt.withoutVAT"] ?? 0);
      const revenueWithoutDiscount = Number(row.RevenueWithoutDiscount ?? row.DishSumInt ?? 0);

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          rows: [],
          isOrderDeleted: false,
          isStorned: false,
          hasCancelCause: false,
          hasItemDeletion: false,
          sales: 0,
          revenueWithoutDiscount: 0,
        });
      }

      const order = ordersMap.get(orderId);
      order.rows.push(row);
      order.isOrderDeleted = order.isOrderDeleted || isOrderDeleted;
      order.isStorned = order.isStorned || isStorned;
      order.hasCancelCause = order.hasCancelCause || hasCancelCause;
      order.hasItemDeletion = order.hasItemDeletion || hasItemDeletion;
      order.sales += sales;
      order.revenueWithoutDiscount += revenueWithoutDiscount;
    }

    const activeRows = [];
    let includedRows = 0;
    let excludedRows = 0;
    const orderStats = {
      totalDistinctOrders: ordersMap.size,
      canceledOrders: 0,
      orderDeleted: 0,
      storned: 0,
      withCancelCause: 0,
      withItemDeletion: 0,
      activeOrders: 0,
      stornoAdjustment: 0,
    };

    for (const order of ordersMap.values()) {
      const isCanceledOrder = order.isOrderDeleted || order.isStorned || order.hasCancelCause;

      if (order.isOrderDeleted) orderStats.orderDeleted += 1;
      if (order.isStorned) orderStats.storned += 1;
      if (order.hasCancelCause) orderStats.withCancelCause += 1;
      if (order.hasItemDeletion) orderStats.withItemDeletion += 1;

      if (isCanceledOrder) {
        orderStats.canceledOrders += 1;

        if (order.isStorned && order.revenueWithoutDiscount < 0) {
          orderStats.stornoAdjustment += order.revenueWithoutDiscount;
        }

        excludedRows += order.rows.length;
        continue;
      }

      includedRows += order.rows.length;
      orderStats.activeOrders += 1;
      activeRows.push(...order.rows);
    }

    return {
      rows: activeRows,
      includedRows,
      excludedRows,
      orderStats,
    };
  }

  async resolveStoreId(organizationId) {
    const normalizedId = String(organizationId || "");
    const organizations = await organizationsService.getOrganizations().catch(() => []);
    const organization =
      typeof organizationId === "object" && organizationId !== null
        ? organizationId
        : organizations.find(
            (item) =>
              String(item.id) === normalizedId ||
              String(item.storeId) === normalizedId ||
              String(item.serverStoreId) === normalizedId ||
              String(item.legacyStoreId) === normalizedId ||
              String(item.iikoId) === normalizedId ||
              String(item.restaurantId) === normalizedId ||
              String(item.code) === normalizedId,
          );

    if (organization?.serverStoreId) {
      return String(organization.serverStoreId);
    }

    if (organization?.storeId) {
      return String(organization.storeId);
    }

    const fallbackCandidates = [organization?.legacyStoreId, organization?.iikoId, organization?.restaurantId, organization?.code, organization?.id];

    for (const candidate of fallbackCandidates) {
      const normalizedCandidate = String(candidate || "").trim();
      if (/^\d+$/.test(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }

    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    throw new Error(`Не удалось получить storeId из iiko для организации ${normalizedId}`);
  }

  async resolveLegacyStoreId(storeId) {
    const normalizedId = String(storeId || "").trim();

    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    const organizations = await organizationsService.getOrganizations().catch(() => []);
    const organization = organizations.find(
      (item) =>
        String(item.id) === normalizedId ||
        String(item.storeId) === normalizedId ||
        String(item.serverStoreId) === normalizedId ||
        String(item.legacyStoreId) === normalizedId ||
        String(item.iikoId) === normalizedId ||
        String(item.restaurantId) === normalizedId ||
        String(item.code) === normalizedId,
    );

    const fallbackCandidates = [organization?.legacyStoreId, organization?.iikoId, organization?.restaurantId];

    for (const candidate of fallbackCandidates) {
      const normalizedCandidate = String(candidate || "").trim();
      if (/^\d+$/.test(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }

    return normalizedId;
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

    const selectResponse = await this.requestWithRetry(
      client,
      {
        method: "post",
        url: `/api/stores/select/${legacyStoreId}`,
      },
      { stage: "auth-select-store", storeId: legacyStoreId },
    );

    if (selectResponse.data?.error) {
      throw new Error(selectResponse.data?.errorMessage || `IIKO отказал в доступе к store ${storeId}`);
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

  async withAuth(storeId, fn) {
    return await this.runWithConcurrencyLimit(async () => {
      const client = this.createClient();
      let session = null;

      try {
        try {
          if (this.serverBaseUrl) {
            client.defaults.baseURL = this.serverBaseUrl;
          }

          session = await this.authenticateWithServerApi(client, storeId);
        } catch (error) {
          if (!this.shouldFallbackToLegacy(error) || !this.legacyBaseUrl) {
            throw error;
          }

          console.warn("⚠️ iikoServer v2 недоступен, используется совместимый режим:", {
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

  async executeServerOlap(client, body, options = {}) {
    const session = client.__iikoSession || {};
    const serverBody = this.buildServerReportBody(body);
    const response = await this.requestWithRetry(
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

    return this.normalizeServerRows(response.data, body);
  }

  async executeLegacyOlap(client, delay, body, options = {}) {
    const storeId = body?.storeIds?.[0];
    const maxAttempts = Number(options.maxAttempts || this.maxAttempts);
    const fetchTimeoutMs = Number(options.fetchTimeoutMs || Math.min(this.timeout, 5000));
    const logEvery = Number(options.logEvery || 20);

    const initResp = await this.requestWithRetry(
      client,
      {
        method: "post",
        url: "/api/olap/init",
        data: body,
        timeout: Math.min(this.timeout, 10000),
      },
      { stage: "olap-init", storeId },
    );

    const fetchId = initResp.data?.data;
    if (!fetchId) {
      throw new Error("OLAP init не вернул fetchId");
    }

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const resp = await this.requestWithRetry(
          client,
          {
            method: "get",
            url: `/api/olap/fetch/${fetchId}/sales`,
            timeout: fetchTimeoutMs,
            validateStatus: (status) => (status >= 200 && status < 300) || status === 400,
          },
          { stage: "olap-fetch", storeId, fetchId, pollAttempt: i + 1 },
          0,
        );

        if (this.isPendingOlapResponse(resp)) {
          if ((i + 1) % logEvery === 0) {
            console.log(`⏳ OLAP ещё формируется: store ${storeId}, fetch ${fetchId}, попытка ${i + 1}`);
          }

          await delay(this.pollInterval);
          continue;
        }

        const data = resp.data;
        if (data && (data.cells || data.result?.rawData || Array.isArray(data?.data))) {
          return data;
        }
      } catch (error) {
        const status = error.response?.status;
        const code = error?.code;
        const isExpectedPending = status === 400 || ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET"].includes(code);

        if (isExpectedPending && i < maxAttempts - 1) {
          if ((i + 1) % logEvery === 0) {
            console.log(`⏳ OLAP ещё формируется: store ${storeId}, fetch ${fetchId}, попытка ${i + 1}`);
          }
          await delay(this.pollInterval);
          continue;
        }

        if (this.isRetriableError(error) && i < maxAttempts - 1) {
          console.warn("⚠️ OLAP fetch временно недоступен:", {
            storeId,
            fetchId,
            attempt: i + 1,
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
    const session = client.__iikoSession || {};

    if (session.mode === "server-v2") {
      try {
        return await this.executeServerOlap(client, body, options);
      } catch (error) {
        if (!this.shouldFallbackToLegacy(error)) {
          throw error;
        }

        console.warn("⚠️ OLAP v2 недоступен, выполняется совместимый запрос:", {
          storeId: session.storeId,
          message: error?.message,
        });

        if (this.legacyBaseUrl) {
          client.defaults.baseURL = this.legacyBaseUrl;
        }

        const fallbackSession = await this.authenticateLegacyApi(client, session.storeId);
        client.__iikoSession = { ...session, ...fallbackSession };
      }
    }

    return await this.executeLegacyOlap(client, delay, body, options);
  }

  parseResultRows(result, cellsMapper) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    if (result.result?.rawData) return result.result.rawData;

    if (result.cells) {
      return Object.entries(result.cells).map(([key, values]) => {
        const group = JSON.parse(key);
        return cellsMapper ? cellsMapper(group, Array.isArray(values) ? values : []) : group;
      });
    }

    return [];
  }
}

OlapClient.activeRequests = 0;
OlapClient.requestQueue = [];

module.exports = OlapClient;
