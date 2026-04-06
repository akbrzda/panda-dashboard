/**
 * iiko API клиент - аутентификация и OLAP запросы
 */
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
      })
    );
  }

  async authenticate(client, restaurantId) {
    await client.post("/api/auth/login", { login: this.username, password: this.password });
    await client.post(`/api/stores/select/${restaurantId}`);
  }

  async logout(client) {
    try {
      await client.post("/api/auth/logout");
    } catch (e) {
      /* ignore */
    }
  }

  async executeOlapQuery(client, restaurantId, olapBody) {
    await this.authenticate(client, restaurantId);

    const initResponse = await client.post("/api/olap/init", olapBody);
    const fetchId = initResponse.data?.data;
    if (!fetchId) throw new Error("No fetchId from OLAP init");

    for (let i = 0; i < iikoCfg.MAX_ATTEMPTS; i++) {
      try {
        const res = await client.get(`/api/olap/fetch/${fetchId}/sales`);
        if (res.data?.cells || res.data?.result?.rawData) return res.data;
      } catch (e) {
        if (e.response?.status !== 400) throw e;
      }
      await delay(iikoCfg.POLL_INTERVAL);
    }
    throw new Error("OLAP fetch timeout");
  }
}

module.exports = new IikoClient();
