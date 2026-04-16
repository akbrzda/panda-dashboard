const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const organizationsService = require("../../organizations/service");

class OlapClient {
  constructor() {
    this.baseUrl = process.env.IIKO_BASE_URL;
    this.username = process.env.IIKO_USER;
    this.password = process.env.IIKO_PASSWORD;
    this.timeout = 15000;
    this.pollInterval = 400;
    this.maxAttempts = 20;
  }

  async resolveStoreId(organizationId) {
    const normalizedId = String(organizationId || "");
    const organizations = await organizationsService.getOrganizations().catch(() => []);
    const organization =
      typeof organizationId === "object" && organizationId !== null
        ? organizationId
        : organizations.find((item) => String(item.id) === normalizedId || String(item.storeId) === normalizedId);

    if (organization?.storeId) {
      return String(organization.storeId);
    }

    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    throw new Error(`Не удалось получить storeId из iiko для организации ${normalizedId}`);
  }

  createClient() {
    const jar = new CookieJar();
    return wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: { "Content-Type": "application/json" },
        jar,
        withCredentials: true,
      }),
    );
  }

  async withAuth(storeId, fn) {
    const client = this.createClient();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    await client.post("/api/auth/login", { login: this.username, password: this.password });
    const selectResponse = await client.post(`/api/stores/select/${storeId}`);

    if (selectResponse.data?.error) {
      throw new Error(selectResponse.data?.errorMessage || `IIKO отказал в доступе к store ${storeId}`);
    }

    const result = await fn(client, delay);

    try {
      await client.post("/api/auth/logout");
    } catch (_) {}

    return result;
  }

  async pollOlap(client, delay, body) {
    let initResp;

    try {
      initResp = await client.post("/api/olap/init", body);
    } catch (error) {
      const status = error.response?.status;

      if ([500, 502, 504].includes(status)) {
        console.warn("⚠️ OLAP init временно недоступен:", error.response?.data?.detail || error.message);
        return null;
      }

      throw error;
    }

    const fetchId = initResp.data?.data;
    if (!fetchId) return null;

    for (let i = 0; i < this.maxAttempts; i++) {
      try {
        const resp = await client.get(`/api/olap/fetch/${fetchId}/sales`);
        const data = resp.data;
        if (data && (data.cells || data.result?.rawData)) return data;
      } catch (error) {
        const status = error.response?.status;

        if (status === 400) {
          await delay(this.pollInterval);
          continue;
        }

        if ([500, 502, 504].includes(status)) {
          console.warn("⚠️ OLAP fetch временно недоступен:", error.response?.data?.detail || error.message);
          return null;
        }

        throw error;
      }

      await delay(this.pollInterval);
    }

    console.warn("⚠️ OLAP не успел ответить, возвращаю пустой результат");
    return null;
  }

  parseResultRows(result, cellsMapper) {
    if (!result) return [];
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

module.exports = OlapClient;
