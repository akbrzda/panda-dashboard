const service = require("./service");
const { validateCommonParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class MarketingAnalyticsController {
  parseBoolean(value, defaultValue = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(v)) return true;
      if (["0", "false", "no", "off"].includes(v)) return false;
    }
    return defaultValue;
  }

  sendError(res, code, message, details = null) {
    return res.status(code === "VALIDATION_ERROR" ? 400 : 500).json(errorResponse({ code, message, details }));
  }

  async getSources(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getMarketingSourcesReport({ organizationId, dateFrom, dateTo, completedOnly });
      return res.json(successResponse(data, { report: "marketing-sources" }));
    } catch (error) {
      console.error("❌ MarketingAnalyticsController.getSources:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения маркетинговых источников", error?.message);
    }
  }

  async getPromotions(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getPromotionsReport({ organizationId, dateFrom, dateTo, completedOnly });
      return res.json(successResponse(data, { report: "promotions" }));
    } catch (error) {
      console.error("❌ MarketingAnalyticsController.getPromotions:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения отчёта по акциям", error?.message);
    }
  }
}

module.exports = new MarketingAnalyticsController();
