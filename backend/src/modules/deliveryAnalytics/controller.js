const service = require("./service");
const { validateCommonParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class DeliveryAnalyticsController {
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

  async getSla(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const reconciliationMode = this.parseBoolean(req.body?.reconciliationMode, false);
      const data = await service.getSlaReport({ organizationId, dateFrom, dateTo, reconciliationMode });
      return res.json(successResponse(data, { report: "sla" }));
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.getSla:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения SLA-отчёта", error?.message);
    }
  }

  async getCourierKpi(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const reconciliationMode = this.parseBoolean(req.body?.reconciliationMode, false);
      const data = await service.getCourierKpiReport({ organizationId, dateFrom, dateTo, reconciliationMode });
      return res.json(successResponse(data, { report: "courier-kpi" }));
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.getCourierKpi:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения KPI курьеров", error?.message);
    }
  }

  async getDeliverySummary(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await service.getDeliverySummaryReport({ organizationId, dateFrom, dateTo });
      return res.json(successResponse(data, { report: "delivery-summary" }));
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.getDeliverySummary:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения сводки по доставке", error?.message);
    }
  }

  async getDeliveryDelays(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const reconciliationMode = this.parseBoolean(req.body?.reconciliationMode, false);
      const data = await service.getDeliveryDelaysReport({ organizationId, dateFrom, dateTo, reconciliationMode });
      return res.json(successResponse(data, { report: "delivery-delays" }));
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.getDeliveryDelays:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения отчёта по опозданиям", error?.message);
    }
  }

  async exportDeliveryDelays(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const buffer = await service.exportDeliveryDelaysReport({ organizationId, dateFrom, dateTo });
      res.setHeader("Content-Type", "application/vnd.ms-excel");
      res.setHeader("Content-Disposition", `attachment; filename="delivery-delays-${dateFrom}-${dateTo}.xls"`);
      return res.send(buffer);
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.exportDeliveryDelays:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка экспорта отчёта", error?.message);
    }
  }

  async getCourierRoutes(req, res) {
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await service.getCourierRoutesReport({ organizationId, dateFrom, dateTo });
      return res.json(successResponse(data, { report: "courier-routes" }));
    } catch (error) {
      console.error("❌ DeliveryAnalyticsController.getCourierRoutes:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения маршрутов курьеров", error?.message);
    }
  }
}

module.exports = new DeliveryAnalyticsController();
