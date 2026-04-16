const axios = require("axios");

class ClientsService {
  _getPremiumBonusConfig() {
    const apiUrl = String(process.env.PREMIUM_BONUS_API_URL || "")
      .trim()
      .replace(/\/+$/, "");
    const apiToken = String(process.env.PREMIUM_BONUS_API_TOKEN || process.env.PREMIUM_BONUS_API_KEY || "").trim();
    const salePointId = String(process.env.PREMIUM_BONUS_SALE_POINT_ID || "").trim();

    if (!apiUrl || !apiToken) {
      return null;
    }

    return { apiUrl, apiToken, salePointId };
  }

  _buildPremiumBonusHeaders(apiToken, salePointId = "", authMode = "raw") {
    const normalizedToken = String(apiToken || "").trim();
    let authorization = normalizedToken;

    if (authMode === "api-token" && !/^ApiToken\s+/i.test(normalizedToken)) {
      authorization = `ApiToken ${normalizedToken}`;
    } else if (authMode === "bearer" && !/^Bearer\s+/i.test(normalizedToken)) {
      authorization = `Bearer ${normalizedToken}`;
    }

    return {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(salePointId ? { "X-Sale-Point-Id": salePointId } : {}),
    };
  }

  async _postPremiumBonus(path, payload = {}) {
    const config = this._getPremiumBonusConfig();
    if (!config) return null;

    const authModes = ["raw", "api-token", "bearer"];
    let lastError = null;

    for (const authMode of authModes) {
      try {
        const response = await axios.post(`${config.apiUrl}${path}`, payload, {
          headers: this._buildPremiumBonusHeaders(config.apiToken, config.salePointId, authMode),
          timeout: 15000,
        });
        return response.data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Не удалось выполнить запрос к PremiumBonus");
  }

  _extractPremiumBonusGroups(responseData) {
    const candidates = [responseData?.list, responseData?.groups, responseData?.data?.list, responseData?.data?.groups];
    return candidates.find(Array.isArray) || [];
  }

  async getClients({ dateFrom, dateTo }) {
    const config = this._getPremiumBonusConfig();

    if (!config) {
      return { configured: false, activeBase: null, newClients: null, groups: [] };
    }

    try {
      const groupsResponse = await this._postPremiumBonus("/buyer-groups", {});

      if (groupsResponse?.success === false) {
        throw new Error(groupsResponse?.error_description || groupsResponse?.error || "PremiumBonus вернул ошибку");
      }

      const groups = this._extractPremiumBonusGroups(groupsResponse);
      const normalizedGroups = groups
        .map((group, index) => ({
          id: group.id || group.client_group_id || `group-${index}`,
          name: group.name || group.title || group.group_name || "Без названия",
          count: Number(group.count) || Number(group.members_count) || Number(group.clients_count) || Number(group.buyers_count) || 0,
        }))
        .filter((group) => group.count > 0);

      const activeBase = normalizedGroups.reduce((sum, group) => sum + group.count, 0);
      const newClientsFromResponse = Number(groupsResponse?.new_clients || groupsResponse?.newClients || groupsResponse?.data?.new_clients);
      const newClientsFromGroups = normalizedGroups.filter((group) => /нов/i.test(group.name)).reduce((sum, group) => sum + group.count, 0);
      const newClients = Number.isFinite(newClientsFromResponse) ? newClientsFromResponse : newClientsFromGroups || null;
      const hasUsefulData = activeBase > 0 || (Number.isFinite(newClients) && newClients > 0) || normalizedGroups.length > 0;

      return {
        configured: true,
        activeBase: hasUsefulData ? activeBase : null,
        newClients: hasUsefulData ? newClients : null,
        groups: normalizedGroups,
        period: { dateFrom, dateTo },
        warningMessage: hasUsefulData ? null : "PremiumBonus не вернул клиентские данные за выбранный период",
      };
    } catch (error) {
      console.error("❌ PremiumBonus API error:", error.response?.data || error.message);
      return {
        configured: true,
        activeBase: null,
        newClients: null,
        groups: [],
        error: error.response?.data?.error_description || error.response?.data?.error || error.message,
      };
    }
  }
}

module.exports = new ClientsService();
