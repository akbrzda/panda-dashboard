const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const organizationsService = require("../organizations/service");

class OlapClient {
  constructor() {
    this.baseUrl = process.env.IIKO_BASE_URL;
    this.username = process.env.IIKO_USER;
    this.password = process.env.IIKO_PASSWORD;
    this.timeout = 30000;
    this.pollInterval = 500;
    this.maxAttempts = 120;
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
              String(item.iikoId) === normalizedId ||
              String(item.restaurantId) === normalizedId ||
              String(item.code) === normalizedId,
          );

    if (organization?.storeId) {
      return String(organization.storeId);
    }

    const fallbackCandidates = [organization?.iikoId, organization?.restaurantId, organization?.code, organization?.id];

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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        initResp = await client.post("/api/olap/init", body);
        break;
      } catch (error) {
        const status = error.response?.status;
        if ([500, 502, 504].includes(status) && attempt < 2) {
          console.warn("⚠️ OLAP init временно недоступен, повтор:", error.response?.data?.detail || error.message);
          await delay(this.pollInterval);
          continue;
        }
        throw error;
      }
    }

    const fetchId = initResp.data?.data;
    if (!fetchId) {
      throw new Error("OLAP init не вернул fetchId");
    }

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

        if ([500, 502, 504].includes(status) && i < this.maxAttempts - 1) {
          await delay(this.pollInterval);
          continue;
        }

        throw error;
      }

      await delay(this.pollInterval);
    }

    throw new Error(`OLAP не успел ответить за ${this.maxAttempts} попыток`);
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
