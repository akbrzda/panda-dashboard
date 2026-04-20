const axios = require("axios");
const { TTLCache } = require("./cache");

class IikoCloudClient {
  constructor() {
    this.baseUrl = String(process.env.IIKO_CLOUD_BASE_URL || process.env.IIKO_API_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/api\/1$/i, "");
    this.login = String(process.env.IIKO_CLOUD_API_LOGIN || process.env.IIKO_API_LOGIN || "").trim();
    this.tokenCache = new TTLCache(10 * 60 * 1000);
    this.timeout = 30000;
  }

  canUse() {
    return Boolean(this.baseUrl && this.login);
  }

  async getToken() {
    if (!this.canUse()) return null;
    const cached = this.tokenCache.get("token");
    if (cached) return cached;

    const response = await axios.post(
      `${this.baseUrl}/api/1/access_token`,
      { apiLogin: this.login },
      { timeout: this.timeout, headers: { "Content-Type": "application/json" } },
    );

    const token = String(response?.data?.token || "").trim();
    if (!token) throw new Error("iiko Cloud не вернул access token");
    this.tokenCache.set("token", token, 10 * 60 * 1000);
    return token;
  }

  formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("Некорректная дата для iiko Cloud API");
    const pad = (n, size = 2) => String(n).padStart(size, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
  }

  normalizeDateBounds(dateFrom, dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      throw new Error("Некорректные границы периода для iiko Cloud API");
    }
    const fromIsDateOnly = typeof dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom.trim());
    const toIsDateOnly = typeof dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim());
    const normalizedFrom = fromIsDateOnly ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0)) : from;
    const normalizedTo = toIsDateOnly ? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999)) : to;
    if (normalizedTo < normalizedFrom) throw new Error("dateTo не может быть раньше dateFrom");
    return { from: normalizedFrom, to: normalizedTo };
  }

  buildRequestBody({ organizationId, from, to, statuses = [], sourceKeys = [], courierIds = [] }) {
    const body = {
      organizationIds: [String(organizationId)],
      deliveryDateFrom: this.formatDateTime(from),
      deliveryDateTo: this.formatDateTime(to),
    };
    if (Array.isArray(statuses) && statuses.length > 0) body.statuses = statuses;
    if (Array.isArray(sourceKeys) && sourceKeys.length > 0) {
      body.sourceKeys = sourceKeys.map((s) => String(s || "").trim()).filter(Boolean);
    }
    if (Array.isArray(courierIds) && courierIds.length > 0) {
      body.courierIds = courierIds.map((s) => String(s || "").trim()).filter(Boolean);
    }
    return body;
  }

  isTooManyDataError(error) {
    return (
      Number(error?.response?.status || 0) === 422 &&
      String(error?.response?.data?.error || "")
        .trim()
        .toUpperCase() === "TOO_MANY_DATA_REQUESTED"
    );
  }

  async fetchChunk({ token, organizationId, from, to, statuses = [], sourceKeys = [], courierIds = [] }) {
    const body = this.buildRequestBody({ organizationId, from, to, statuses, sourceKeys, courierIds });
    const response = await axios.post(`${this.baseUrl}/api/1/deliveries/by_delivery_date_and_status`, body, {
      timeout: this.timeout,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return response?.data;
  }

  mergePayloads(left, right) {
    const leftOrgs = Array.isArray(left?.ordersByOrganizations) ? left.ordersByOrganizations : [];
    const rightOrgs = Array.isArray(right?.ordersByOrganizations) ? right.ordersByOrganizations : [];
    const orgMap = new Map();
    for (const block of [...leftOrgs, ...rightOrgs]) {
      const id = String(block?.organizationId || "");
      if (!orgMap.has(id)) orgMap.set(id, { organizationId: id, orders: [] });
      orgMap.get(id).orders.push(...(Array.isArray(block.orders) ? block.orders : []));
    }
    return { ordersByOrganizations: [...orgMap.values()] };
  }

  async fetchRange({ token, organizationId, from, to, statuses = [], sourceKeys = [], courierIds = [] }) {
    let rawData;
    try {
      rawData = await this.fetchChunk({ token, organizationId, from, to, statuses, sourceKeys, courierIds });
    } catch (error) {
      if (!this.isTooManyDataError(error)) throw error;
      const spanMs = to.getTime() - from.getTime();
      if (spanMs <= 60 * 60 * 1000) throw error;
      const midpoint = new Date(Math.floor((from.getTime() + to.getTime()) / 2));
      const left = await this.fetchRange({ token, organizationId, from, to: midpoint, statuses, sourceKeys, courierIds });
      const rightStart = new Date(midpoint.getTime() + 1);
      if (rightStart > to) return left;
      const right = await this.fetchRange({ token, organizationId, from: rightStart, to, statuses, sourceKeys, courierIds });
      return this.mergePayloads(left, right);
    }
    return rawData;
  }

  async getDeliveries({ organizationId, dateFrom, dateTo, statuses = [], sourceKeys = [], courierIds = [] }) {
    if (!this.canUse()) {
      throw new Error("Не настроены IIKO_CLOUD_BASE_URL/IIKO_API_BASE_URL или IIKO_CLOUD_API_LOGIN/IIKO_API_LOGIN");
    }
    const token = await this.getToken();
    const { from, to } = this.normalizeDateBounds(dateFrom, dateTo);
    return await this.fetchRange({ token, organizationId, from, to, statuses, sourceKeys, courierIds });
  }
}

module.exports = new IikoCloudClient();
