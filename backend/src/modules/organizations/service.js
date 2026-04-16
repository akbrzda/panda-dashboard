const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const { IikoService } = require("../stopList/iikoService");

class OrganizationsService {
  constructor() {
    this.iikoService = new IikoService();
    this.cacheTtlMs = 5 * 60 * 1000;
    this.organizationsCache = null;
    this.organizationsCacheExpiresAt = 0;
    this.olapStoresCache = null;
    this.olapStoresCacheExpiresAt = 0;
  }

  _isCacheValid(expiresAt) {
    return Number(expiresAt) > Date.now();
  }

  _normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .trim();
  }

  _createOlapClient() {
    return wrapper(
      axios.create({
        baseURL: process.env.IIKO_BASE_URL,
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
        jar: new CookieJar(),
        withCredentials: true,
      }),
    );
  }

  async _fetchOlapStores() {
    if (this._isCacheValid(this.olapStoresCacheExpiresAt) && Array.isArray(this.olapStoresCache)) {
      return this.olapStoresCache;
    }

    if (!process.env.IIKO_BASE_URL || !process.env.IIKO_USER || !process.env.IIKO_PASSWORD) {
      return [];
    }

    const client = this._createOlapClient();

    try {
      const loginResponse = await client.post("/api/auth/login", {
        login: process.env.IIKO_USER,
        password: process.env.IIKO_PASSWORD,
      });

      const storeIds = loginResponse.data?.user?.storeIds || [];
      const stores = [];

      for (const storeId of storeIds) {
        try {
          const response = await client.post(`/api/stores/select/${storeId}`);
          const storeName = response.data?.store;

          if (response.data?.error === false && storeName) {
            stores.push({
              id: String(storeId),
              name: String(storeName),
            });
          }
        } catch (_) {}
      }

      this.olapStoresCache = stores;
      this.olapStoresCacheExpiresAt = Date.now() + this.cacheTtlMs;

      return stores;
    } finally {
      try {
        await client.post("/api/auth/logout");
      } catch (_) {}
    }
  }

  async getOrganizations() {
    if (this._isCacheValid(this.organizationsCacheExpiresAt) && Array.isArray(this.organizationsCache)) {
      return this.organizationsCache;
    }

    const token = await this.iikoService.fetchAccessToken();
    const [remoteOrganizations, olapStores] = await Promise.all([
      this.iikoService.fetchOrganizations(token),
      this._fetchOlapStores().catch(() => []),
    ]);

    const storeIdsByName = new Map(olapStores.map((store) => [this._normalizeName(store.name), store.id]));

    const organizations = remoteOrganizations.map((org) => {
      const name = org.name || org.organizationName || `Организация ${org.id}`;
      const storeId = storeIdsByName.get(this._normalizeName(name)) || null;

      return {
        id: String(org.id),
        name,
        code: org.code || "",
        storeId,
        restaurantId: org.restaurantId != null ? String(org.restaurantId) : null,
        iikoId: org.iikoId != null ? String(org.iikoId) : null,
        threadId: org.threadId ?? null,
        disabled: Boolean(org.disabled),
      };
    });

    this.organizationsCache = organizations;
    this.organizationsCacheExpiresAt = Date.now() + this.cacheTtlMs;

    return organizations;
  }
}

module.exports = new OrganizationsService();
