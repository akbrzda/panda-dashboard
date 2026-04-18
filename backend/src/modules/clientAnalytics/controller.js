const clientAnalyticsService = require("./service");

class ClientAnalyticsController {
  parseStringArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  parseBoolean(value, defaultValue = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
    return defaultValue;
  }

  parsePositiveInteger(value, defaultValue) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  async getClientAnalytics(req, res) {
    try {
      const organizationId = String(req.query?.organizationId || "").trim();
      const from = String(req.query?.from || req.query?.dateFrom || "").trim();
      const to = String(req.query?.to || req.query?.dateTo || "").trim();
      const terminalGroupId = String(req.query?.terminalGroupId || "").trim() || null;
      const statuses = this.parseStringArray(req.query?.statuses);
      const selectedPhones = this.parseStringArray(req.query?.selectedPhones);
      const includeProfile = this.parseBoolean(req.query?.includeProfile, false);
      const refresh = this.parseBoolean(req.query?.refresh, false);
      const profileMode =
        String(req.query?.profileMode || "top")
          .trim()
          .toLowerCase() || "top";
      const profileLimit = this.parsePositiveInteger(req.query?.profileLimit, 50);

      if (!organizationId || !from || !to) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, from, to" });
      }

      const data = await clientAnalyticsService.getClientAnalytics({
        organizationId,
        from,
        to,
        terminalGroupId,
        statuses,
        includeProfile,
        profileMode,
        profileLimit,
        selectedPhones,
        refresh,
      });

      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      console.error("❌ ClientAnalyticsController.getClientAnalytics:", error);
      return res.status(statusCode).json({
        error: statusCode >= 500 ? "Ошибка получения клиентской аналитики" : error.message,
        message: error.message,
      });
    }
  }
}

module.exports = new ClientAnalyticsController();
