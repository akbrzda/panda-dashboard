const axios = require("axios");
const config = require("../config");

class IikoApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = "IikoApiError";
    this.status = status;
    this.details = details;
  }
}

class IikoService {
  constructor() {
    this.baseUrl = config.iiko.baseUrl || "https://api-ru.iiko.services/api/1";
    this.apiLogin = config.iiko.apiLogin;
    this.timeout = 30000;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  _ensureApiLogin() {
    if (!this.apiLogin) {
      throw new IikoApiError("Не задан IIKO_API_LOGIN", 500);
    }
  }

  _wrapError(error, fallbackMessage) {
    if (error instanceof IikoApiError) {
      return error;
    }

    const status = error.response?.status || 502;
    const message =
      error.response?.data?.description ||
      error.response?.data?.errorDescription ||
      error.response?.data?.message ||
      error.message ||
      fallbackMessage;

    return new IikoApiError(message, status, error.response?.data || null);
  }

  async fetchAccessToken() {
    this._ensureApiLogin();

    try {
      const response = await this.client.post("/access_token", {
        apiLogin: this.apiLogin,
      });

      const token = response.data?.token || response.data;

      if (!token || typeof token !== "string") {
        throw new IikoApiError("IIKO не вернул токен доступа", 502, response.data);
      }

      return token;
    } catch (error) {
      throw this._wrapError(error, "Не удалось получить токен IIKO");
    }
  }

  async fetchStopListsWithProducts(token, organizationIds = [], organizations = []) {
    if (!token) {
      throw new IikoApiError("Не передан токен IIKO", 500);
    }

    const normalizedOrganizationIds = (organizationIds || []).map((id) => String(id)).filter(Boolean);

    if (normalizedOrganizationIds.length === 0) {
      return {
        stopLists: [],
        normalizedItems: [],
        rawStopListsResponse: null,
      };
    }

    try {
      const response = await this.client.post(
        "/stop_lists",
        {
          organizationIds: normalizedOrganizationIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const rawStopListsResponse = response.data || {};
      const stopLists = rawStopListsResponse.terminalGroupStopLists || rawStopListsResponse.stopLists || [];
      const normalizedItems = this.normalizeStopListItems(rawStopListsResponse, organizations, normalizedOrganizationIds);

      return {
        stopLists,
        normalizedItems,
        rawStopListsResponse,
      };
    } catch (error) {
      throw this._wrapError(error, "Не удалось получить стоп-листы IIKO");
    }
  }

  normalizeStopListItems(rawResponse, organizations = [], organizationIds = []) {
    const orgMap = new Map((organizations || []).map((org) => [String(org.id), org.name]));
    const groups = rawResponse?.terminalGroupStopLists || rawResponse?.stopLists || [];
    const flatItems = [];

    for (const group of groups) {
      const groupOrganizationId = String(group.organizationId || group.orgId || organizationIds[0] || "");
      const organizationName = orgMap.get(groupOrganizationId) || group.organizationName || "";
      const items = Array.isArray(group.items) ? group.items : [];

      for (const item of items) {
        const product = item.product || {};

        flatItems.push({
          organizationId: groupOrganizationId || String(item.organizationId || ""),
          organizationName,
          terminalGroupId: String(group.terminalGroupId || item.terminalGroupId || ""),
          productId: String(item.productId || product.id || item.id || ""),
          productName: item.productName || product.name || item.name || item.itemName || "",
          productFullName: item.productFullName || product.fullName || item.fullName || item.productName || product.name || item.name || "",
          itemName: item.itemName || item.name || product.name || "",
          sku: item.sku || item.productCode || product.code || "",
          productCode: item.productCode || product.code || "",
          balance: Number(item.balance || 0),
          reason: item.reason || item.comment || group.reason || "",
          dateAdd: item.dateAdd || item.date || group.dateAdd || null,
          openedAt: item.openedAt || item.dateAdd || item.date || null,
          closedAt: item.closedAt || null,
        });
      }
    }

    return flatItems;
  }
}

module.exports = {
  IikoService,
  IikoApiError,
};
