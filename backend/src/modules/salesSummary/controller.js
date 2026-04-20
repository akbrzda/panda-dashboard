const service = require("./service");
const { validateCommonParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class SalesSummaryController {
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

  async getHourlySales(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getHourlySalesReport({ organizationId, dateFrom, dateTo, completedOnly });
      return res.json(successResponse(data, { report: "hourly-sales" }));
    } catch (error) {
      console.error("❌ SalesSummaryController.getHourlySales:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения почасовых продаж", error?.message);
    }
  }

  async getRevenue(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { lflDateFrom, lflDateTo } = req.body || {};
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly });
      return res.json(successResponse(data, { report: "revenue" }));
    } catch (error) {
      console.error("❌ SalesSummaryController.getRevenue:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения выручки", error?.message);
    }
  }

  async getOperational(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { lflDateFrom, lflDateTo } = req.body || {};
      const completedOnly = this.parseBoolean(req.body?.completedOnly, true);
      const data = await service.getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly });
      return res.json(successResponse(data, { report: "operational" }));
    } catch (error) {
      console.error("❌ SalesSummaryController.getOperational:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения операционных показателей", error?.message);
    }
  }
}

module.exports = new SalesSummaryController();
