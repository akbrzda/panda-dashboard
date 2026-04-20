const service = require("./service");
const { validateMenuAbcParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class AssortmentAnalyticsController {
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

  async getProductAbc(req, res) {
    try {
      const validation = validateMenuAbcParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo, abcGroup, page, limit } = validation.normalized;
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getProductAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit, completedOnly });
      return res.json(successResponse(data, { report: "product-abc" }));
    } catch (error) {
      console.error("❌ AssortmentAnalyticsController.getProductAbc:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения ABC-анализа", error?.message);
    }
  }
}

module.exports = new AssortmentAnalyticsController();
