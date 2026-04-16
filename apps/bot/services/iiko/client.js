/**
 * iiko API клиент - аутентификация и OLAP запросы
 */
const crypto = require("crypto");
const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const iikoCfg = require("../../config/iiko.config");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class IikoClient {
  constructor() {
    this.baseUrl = iikoCfg.BASE_URL;
    this.username = iikoCfg.USERNAME;
    this.password = iikoCfg.PASSWORD;
  }

  createHttpClient() {
    const jar = new CookieJar();
    return wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: iikoCfg.TIMEOUT,
        headers: { "Content-Type": "application/json" },
        jar,
        withCredentials: true,
      }),
    );
  }

  createPasswordHash(password) {
    return crypto
      .createHash("sha1")
      .update(String(password || ""))
      .digest("hex");
  }

  extractToken(data) {
    if (typeof data === "string") {
      return data.trim().replace(/^"+|"+$/g, "") || null;
    }

    if (typeof data === "object" && data !== null) {
      return data.key || data.token || data.data || null;
    }

    return null;
  }

  buildServerReportBody(olapBody = {}) {
    const calculatedFields = Array.isArray(olapBody.calculatedFields) ? olapBody.calculatedFields : [];
    const dataFields = Array.isArray(olapBody.dataFields) ? olapBody.dataFields : [];
    const aggregateFields = dataFields
      .map((fieldName) => {
        const field = calculatedFields.find((item) => item?.name === fieldName);
        const formula = String(field?.formula || fieldName).trim();
        const match = formula.match(/^\[([^\]]+)\]$/);
        return match?.[1] || formula;
      })
      .filter(Boolean);

    const filters = Array.isArray(olapBody.filters)
      ? olapBody.filters.reduce((accumulator, filter) => {
          if (filter?.field) {
            accumulator[filter.field] = {
              filterType: "DateRange",
              periodType: "CUSTOM",
              from: filter.dateFrom || filter.from,
              to: filter.dateTo || filter.to,
              includeLow: filter.includeLeft ?? true,
              includeHigh: filter.includeRight ?? false,
            };
          }
          return accumulator;
        }, {})
      : olapBody.filters || {};

    return {
      reportType: olapBody.reportType || olapBody.olapType || "SALES",
      buildSummary: true,
      groupByRowFields: Array.isArray(olapBody.groupByRowFields) ? olapBody.groupByRowFields : olapBody.groupFields || [],
      groupByColFields: Array.isArray(olapBody.groupByColFields) ? olapBody.groupByColFields : [],
      aggregateFields,
      filters,
    };
  }

  normalizeServerRows(result, olapBody = {}) {
    if (!Array.isArray(result?.data)) {
      return result;
    }

    const aliasMap = new Map(
      (olapBody.calculatedFields || []).map((field) => {
        const formula = String(field?.formula || field?.name || "").trim();
        const match = formula.match(/^\[([^\]]+)\]$/);
        return [match?.[1] || formula, field?.name];
      }),
    );

    return {
      ...result,
      data: result.data.map((row) => {
        const normalizedRow = { ...row };

        for (const [actualFieldName, alias] of aliasMap.entries()) {
          if (alias && normalizedRow[alias] === undefined && row?.[actualFieldName] !== undefined) {
            normalizedRow[alias] = row[actualFieldName];
          }
        }

        return normalizedRow;
      }),
    };
  }

  async authenticate(client, restaurantId) {
    await client.post("/api/auth/login", { login: this.username, password: this.password });
    await client.post(`/api/stores/select/${restaurantId}`);
    client.__iikoSession = { mode: "legacy" };
  }

  async authenticateServerApi(client, restaurantId) {
    const response = await client.post("/resto/api/auth", null, {
      params: {
        login: this.username,
        pass: this.createPasswordHash(this.password),
      },
      responseType: "text",
      transformResponse: [(data) => data],
    });

    const key = this.extractToken(response.data);
    if (!key) {
      throw new Error("iikoServer не вернул токен авторизации");
    }

    try {
      await client.post(`/api/stores/select/${restaurantId}`);
    } catch (_) {}

    client.__iikoSession = { mode: "server-v2", key };
  }

  async logout(client) {
    try {
      if (client.__iikoSession?.mode === "server-v2") {
        await client.post("/resto/api/logout", null, {
          params: client.__iikoSession?.key ? { key: client.__iikoSession.key } : undefined,
          responseType: "text",
          transformResponse: [(data) => data],
        });
        return;
      }

      await client.post("/api/auth/logout");
    } catch (e) {
      /* ignore */
    }
  }

  async executeOlapQuery(client, restaurantId, olapBody) {
    try {
      await this.authenticateServerApi(client, restaurantId);

      const response = await client.post("/resto/api/v2/reports/olap", this.buildServerReportBody(olapBody), {
        params: client.__iikoSession?.key ? { key: client.__iikoSession.key } : undefined,
        timeout: iikoCfg.TIMEOUT,
      });

      return this.normalizeServerRows(response.data, olapBody);
    } catch (_) {
      await this.authenticate(client, restaurantId);

      const initResponse = await client.post("/api/olap/init", olapBody);
      const fetchId = initResponse.data?.data;
      if (!fetchId) throw new Error("No fetchId from OLAP init");

      for (let i = 0; i < iikoCfg.MAX_ATTEMPTS; i++) {
        try {
          const res = await client.get(`/api/olap/fetch/${fetchId}/sales`);
          if (res.data?.cells || res.data?.result?.rawData || Array.isArray(res.data?.data)) return res.data;
        } catch (e) {
          if (e.response?.status !== 400) throw e;
        }
        await delay(iikoCfg.POLL_INTERVAL);
      }
    }

    throw new Error("OLAP fetch timeout");
  }
}

module.exports = new IikoClient();
