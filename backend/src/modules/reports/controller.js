const salesDomain = require("./domains/sales");
const deliveryDomain = require("./domains/delivery");
const marketingDomain = require("./domains/marketing");
const assortmentDomain = require("./domains/assortment");
const {
  validateCommonParams,
  validateMenuAbcParams,
  validateDeliveryZonesGetParams,
  validateDeliveryZonesSaveParams,
  validateProductionForecastParams,
} = require("./shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class ReportsController {
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

  parseStatuses(value) {
    return this.parseStringArray(value);
  }

  sendValidationError(res, validation, report) {
    return res.status(400).json(
      errorResponse({
        code: validation.code || "VALIDATION_ERROR",
        message: validation.message,
        meta: {
          report,
        },
      }),
    );
  }

  sendInternalError(res, report, fallbackMessage, error) {
    return res.status(500).json(
      errorResponse({
        code: "INTERNAL_ERROR",
        message: fallbackMessage,
        details: error?.message || null,
        meta: {
          report,
        },
      }),
    );
  }

  sendSuccess(res, report, data) {
    return res.json(
      successResponse(data, {
        report,
      }),
    );
  }

  async getRevenue(req, res) {
    const report = "revenue";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { lflDateFrom, lflDateTo } = req.body || {};
      const data = await salesDomain.getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getRevenue:", error);
      return this.sendInternalError(res, report, "Ошибка получения данных о выручке", error);
    }
  }

  async getOperational(req, res) {
    const report = "operational";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { lflDateFrom, lflDateTo } = req.body || {};
      const data = await salesDomain.getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getOperational:", error);
      return this.sendInternalError(res, report, "Ошибка получения операционных метрик", error);
    }
  }

  async getCourierRoutes(req, res) {
    const report = "courier-routes";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await deliveryDomain.getCourierRoutes({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getCourierRoutes:", error);
      return this.sendInternalError(res, report, "Ошибка получения маршрутов курьеров", error);
    }
  }

  async getHourlySales(req, res) {
    const report = "hourly-sales";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await salesDomain.getHourlySales({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getHourlySales:", error);
      return this.sendInternalError(res, report, "Ошибка получения почасовых продаж", error);
    }
  }

  async getSla(req, res) {
    const report = "sla";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await deliveryDomain.getSla({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getSla:", error);
      return this.sendInternalError(res, report, "Ошибка получения SLA-метрик", error);
    }
  }

  async getCourierKpi(req, res) {
    const report = "courier-kpi";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await deliveryDomain.getCourierKpi({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getCourierKpi:", error);
      return this.sendInternalError(res, report, "Ошибка получения KPI курьеров", error);
    }
  }

  async getMarketingSources(req, res) {
    const report = "marketing-sources";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await marketingDomain.getMarketingSources({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getMarketingSources:", error);
      return this.sendInternalError(res, report, "Ошибка получения маркетинговых источников", error);
    }
  }

  async getDeliverySummary(req, res) {
    const report = "delivery-summary";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await deliveryDomain.getDeliverySummary({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getDeliverySummary:", error);
      return this.sendInternalError(res, report, "Ошибка получения сводки доставки", error);
    }
  }

  async getDeliveryDelays(req, res) {
    const report = "delivery-delays";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await deliveryDomain.getDeliveryDelays({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryDelays:", error);
      return this.sendInternalError(res, report, "Ошибка получения отчета по опозданиям", error);
    }
  }

  async exportDeliveryDelays(req, res) {
    try {
      const report = "delivery-delays-export";
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { buffer, filename } = await deliveryDomain.exportDeliveryDelays({ organizationId, dateFrom, dateTo });

      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
      return res.send(buffer);
    } catch (error) {
      console.error("❌ ReportsController.exportDeliveryDelays:", error);
      return this.sendInternalError(res, "delivery-delays-export", "Ошибка выгрузки отчета по опозданиям", error);
    }
  }

  async getCourierMap(req, res) {
    const report = "courier-map";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const terminalGroupId = req.body?.terminalGroupId;
      const statuses = this.parseStatuses(req.body?.statuses);
      const sourceKeys = this.parseStringArray(req.body?.sourceKeys);
      const courierIds = this.parseStringArray(req.body?.courierIds);
      const data = await deliveryDomain.getCourierMap({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getCourierMap:", error);
      return this.sendInternalError(res, report, "Ошибка получения данных карты курьеров", error);
    }
  }

  async getDeliveryHeatmap(req, res) {
    const report = "delivery-heatmap";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const terminalGroupId = req.body?.terminalGroupId;
      const statuses = this.parseStatuses(req.body?.statuses);
      const sourceKeys = this.parseStringArray(req.body?.sourceKeys);
      const courierIds = this.parseStringArray(req.body?.courierIds);
      const data = await deliveryDomain.getDeliveryHeatmap({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryHeatmap:", error);
      return this.sendInternalError(res, report, "Ошибка получения тепловой карты доставок", error);
    }
  }

  async getDeliveryHeatmapQuery(req, res) {
    const report = "delivery-heatmap";
    try {
      const validation = validateCommonParams(req.query);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const terminalGroupId = req.query?.terminalGroupId;
      const statuses = this.parseStatuses(req.query?.statuses);
      const sourceKeys = this.parseStringArray(req.query?.sourceKeys);
      const courierIds = this.parseStringArray(req.query?.courierIds);

      const data = await deliveryDomain.getDeliveryHeatmap({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryHeatmapQuery:", error);
      return this.sendInternalError(res, report, "Ошибка получения тепловой карты доставок", error);
    }
  }

  async getDeliveryZones(req, res) {
    const report = "delivery-zones";
    try {
      const validation = validateDeliveryZonesGetParams(req.query || {});
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, terminalGroupId } = validation.normalized;
      const data = await deliveryDomain.getDeliveryZones({ organizationId, terminalGroupId });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryZones:", error);
      return this.sendInternalError(res, report, "Ошибка получения зон доставки", error);
    }
  }

  async saveDeliveryZones(req, res) {
    const report = "delivery-zones-save";
    try {
      const validation = validateDeliveryZonesSaveParams(req.body || {});
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, terminalGroupId, geoJson } = validation.normalized;
      const data = await deliveryDomain.saveDeliveryZones({ organizationId, terminalGroupId, geoJson });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.saveDeliveryZones:", error);
      return this.sendInternalError(res, report, "Ошибка сохранения зон доставки", error);
    }
  }

  async getPromotions(req, res) {
    const report = "promotions";
    try {
      const validation = validateCommonParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await marketingDomain.getPromotions({ organizationId, dateFrom, dateTo });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getPromotions:", error);
      return this.sendInternalError(res, report, "Ошибка получения отчета по акциям и промокодам", error);
    }
  }

  async getProductAbc(req, res) {
    const report = "product-abc";
    try {
      const validation = validateMenuAbcParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo, abcGroup, page, limit } = validation.normalized;
      const data = await assortmentDomain.getProductAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getProductAbc:", error);
      return this.sendInternalError(res, report, "Ошибка получения продуктового ABC-анализа", error);
    }
  }

  async getMenuAbc(req, res) {
    return await this.getProductAbc(req, res);
  }

  async getProductionForecast(req, res) {
    const report = "production-forecast";
    try {
      const validation = validateProductionForecastParams(req.body);
      if (!validation.isValid) return this.sendValidationError(res, validation, report);

      const { organizationId, dateFrom, dateTo, forecastDate } = validation.normalized;
      const data = await salesDomain.getProductionForecast({ organizationId, dateFrom, dateTo, forecastDate });
      return this.sendSuccess(res, report, data);
    } catch (error) {
      console.error("❌ ReportsController.getProductionForecast:", error);
      return this.sendInternalError(res, report, "Ошибка получения прогноза загрузки производства", error);
    }
  }
}

module.exports = new ReportsController();
