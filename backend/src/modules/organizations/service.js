const crypto = require("crypto");
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

  _createPasswordHash(password) {
    return crypto
      .createHash("sha1")
      .update(String(password || ""))
      .digest("hex");
  }

  _extractToken(data) {
    if (typeof data === "string") {
      return data.trim().replace(/^"+|"+$/g, "") || null;
    }

    if (typeof data === "object" && data !== null) {
      return data.key || data.token || data.data || null;
    }

    return null;
  }

  _createOlapClient(baseURL = process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL) {
    return wrapper(
      axios.create({
        baseURL,
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
        jar: new CookieJar(),
        withCredentials: true,
      }),
    );
  }

  async _fetchServerDepartments() {
    const baseURL = process.env.IIKO_SERVER_BASE_URL;

    if (!baseURL || !process.env.IIKO_USER || !process.env.IIKO_PASSWORD) {
      return [];
    }

    const client = this._createOlapClient(baseURL);

    try {
      const authResponse = await client.get("/resto/api/auth", {
        params: {
          login: process.env.IIKO_USER,
          pass: this._createPasswordHash(process.env.IIKO_PASSWORD),
        },
        responseType: "text",
        transformResponse: [(data) => data],
      });

      const key = this._extractToken(authResponse.data);
      if (!key) {
        return [];
      }

      const now = new Date();
      const start = new Date(now);
      const end = new Date(now);
      start.setUTCDate(start.getUTCDate() - 30);
      end.setUTCDate(end.getUTCDate() + 1);

      const dateFrom = start.toISOString().slice(0, 10) + "T00:00:00";
      const dateTo = end.toISOString().slice(0, 10) + "T00:00:00";

      const response = await client.post(
        "/resto/api/v2/reports/olap",
        {
          reportType: "SALES",
          buildSummary: true,
          groupByRowFields: ["Department.Id", "Department"],
          groupByColFields: [],
          aggregateFields: ["DishDiscountSumInt.withoutVAT"],
          filters: {
            "OpenDate.Typed": {
              filterType: "DateRange",
              periodType: "CUSTOM",
              from: dateFrom,
              to: dateTo,
              includeLow: true,
              includeHigh: false,
            },
          },
        },
        {
          params: { key },
        },
      );

      return (response.data?.data || [])
        .map((row) => ({
          id: String(row["Department.Id"] || "").trim(),
          name: String(row.Department || "").trim(),
        }))
        .filter((store) => store.id && store.name);
    } catch (_) {
      return [];
    } finally {
      try {
        await client.get("/resto/api/logout");
      } catch (_) {}
    }
  }

  async _fetchOlapStores() {
    if (this._isCacheValid(this.olapStoresCacheExpiresAt) && Array.isArray(this.olapStoresCache)) {
      return this.olapStoresCache;
    }

    if (
      !(process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL) ||
      !process.env.IIKO_USER ||
      !process.env.IIKO_PASSWORD
    ) {
      return [];
    }

    const serverStores = await this._fetchServerDepartments();
    if (serverStores.length > 0) {
      this.olapStoresCache = serverStores;
      this.olapStoresCacheExpiresAt = Date.now() + this.cacheTtlMs;
      return serverStores;
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
      const matchedStoreId = storeIdsByName.get(this._normalizeName(name)) || null;
      const matchedStoreValue = String(matchedStoreId || "").trim();
      const isNumericStoreId = /^\d+$/.test(matchedStoreValue);
      const legacyStoreIdCandidate = [org.storeId, org.iikoId, org.restaurantId].find((value) => /^\d+$/.test(String(value || "").trim()));

      return {
        id: String(org.id),
        name,
        code: org.code || "",
        storeId: matchedStoreId || (legacyStoreIdCandidate != null ? String(legacyStoreIdCandidate) : null),
        serverStoreId: matchedStoreId && !isNumericStoreId ? matchedStoreValue : null,
        legacyStoreId: isNumericStoreId ? matchedStoreValue : legacyStoreIdCandidate != null ? String(legacyStoreIdCandidate) : null,
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
