const axios = require("axios");
const telegramService = require("./telegramService");
const fileLogger = require("../utils/fileLogger");

class StopListAlertService {
  constructor() {
    this.lastAlertByItemId = new Map();
    this.alertCooldownMs = Number(process.env.STOP_LIST_ALERT_COOLDOWN_MS || 2 * 60 * 60 * 1000);
    this.thresholdHours = Number(process.env.STOP_LIST_ALERT_MIN_HOURS || 2);
    this.maxItemsInMessage = Number(process.env.STOP_LIST_ALERT_MAX_ITEMS || 8);
  }

  _resolveBaseUrl() {
    const value = String(process.env.DASHBOARD_API_URL || "").trim();
    if (!value) {
      throw new Error("DASHBOARD_API_URL не задан");
    }
    return value.replace(/\/$/, "");
  }

  _resolveApiKey() {
    const value = String(process.env.DASHBOARD_API_KEY || process.env.API_KEY || "").trim();
    if (!value) {
      throw new Error("DASHBOARD_API_KEY (или API_KEY) не задан");
    }
    return value;
  }

  _buildHeaders() {
    return {
      "X-API-Key": this._resolveApiKey(),
      "Content-Type": "application/json",
    };
  }

  _pruneOldAlerts(now) {
    for (const [itemId, timestamp] of this.lastAlertByItemId.entries()) {
      if (now - timestamp > this.alertCooldownMs) {
        this.lastAlertByItemId.delete(itemId);
      }
    }
  }

  async _fetchOrganizations() {
    const response = await axios.get(`${this._resolveBaseUrl()}/api/organizations`, {
      headers: this._buildHeaders(),
      timeout: 15000,
    });
    const organizations = Array.isArray(response?.data?.organizations) ? response.data.organizations : [];
    return organizations.map((organization) => String(organization.id)).filter(Boolean);
  }

  async _fetchStopListItems(organizationIds) {
    if (!organizationIds.length) {
      return [];
    }

    const response = await axios.get(`${this._resolveBaseUrl()}/api/stop-lists`, {
      headers: this._buildHeaders(),
      timeout: 30000,
      params: {
        organizationId: organizationIds.join(","),
        timezone: "Europe/Moscow",
      },
    });

    const items = Array.isArray(response?.data?.data?.items) ? response.data.data.items : [];
    return items;
  }

  _pickCriticalItems(items) {
    return items
      .filter((item) => {
        const inStopHours = Number(item?.inStopHours);
        const plr = Number(item?.estimatedLostRevenue);
        return item?.isInStop === true && Number.isFinite(inStopHours) && inStopHours > this.thresholdHours && Number.isFinite(plr) && plr > 0;
      })
      .sort((a, b) => Number(b.estimatedLostRevenue || 0) - Number(a.estimatedLostRevenue || 0));
  }

  _formatCurrency(value) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  _formatItemLine(item) {
    const name = String(item?.entityName || item?.entityId || "Неизвестная позиция");
    const organization = String(item?.organizationName || item?.organizationId || "Неизвестная организация");
    const hours = Number(item?.inStopHours || 0).toFixed(1);
    const plr = this._formatCurrency(item?.estimatedLostRevenue || 0);
    return `• ${name} (${organization}) — ${hours} ч, PLR ${plr}`;
  }

  async checkAndSendAlerts() {
    const startedAt = Date.now();
    const now = Date.now();
    this._pruneOldAlerts(now);

    const organizationIds = await this._fetchOrganizations();
    const items = await this._fetchStopListItems(organizationIds);
    const criticalItems = this._pickCriticalItems(items);
    const newItems = criticalItems.filter((item) => {
      const itemId = String(item?.id || "");
      if (!itemId) return false;
      return !this.lastAlertByItemId.has(itemId);
    });

    if (!newItems.length) {
      return {
        success: true,
        sent: 0,
        scanned: criticalItems.length,
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(2),
      };
    }

    const visibleItems = newItems.slice(0, this.maxItemsInMessage);
    const lines = visibleItems.map((item) => this._formatItemLine(item)).join("\n");
    const message =
      `⚠️ <b>Stop-list alert</b>\n` +
      `Критичные позиции: <b>${newItems.length}</b>\n` +
      `Критерии: inStopHours > ${this.thresholdHours}, PLR > 0\n\n` +
      `${lines}`;

    await telegramService.sendAlertMessage(message);

    for (const item of newItems) {
      const itemId = String(item?.id || "");
      if (itemId) {
        this.lastAlertByItemId.set(itemId, now);
      }
    }

    return {
      success: true,
      sent: newItems.length,
      scanned: criticalItems.length,
      durationSec: ((Date.now() - startedAt) / 1000).toFixed(2),
    };
  }
}

module.exports = new StopListAlertService();
