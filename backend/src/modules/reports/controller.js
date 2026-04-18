const salesDomain = require("./domains/sales");
const deliveryDomain = require("./domains/delivery");
const marketingDomain = require("./domains/marketing");
const assortmentDomain = require("./domains/assortment");
const { validateCommonParams } = require("./shared/reportQuery");

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

  validateCommonParams(res, payload = {}) {
    const validation = validateCommonParams(payload);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.message });
      return false;
    }
    return true;
  }

  async getRevenue(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await salesDomain.getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getRevenue:", error);
      return res.status(500).json({ error: "Ошибка получения данных о выручке", message: error.message });
    }
  }

  async getOperational(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await salesDomain.getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getOperational:", error);
      return res.status(500).json({ error: "Ошибка получения операционных метрик", message: error.message });
    }
  }

  async getCourierRoutes(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await deliveryDomain.getCourierRoutes({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getCourierRoutes:", error);
      return res.status(500).json({ error: "Ошибка получения маршрутов курьеров", message: error.message });
    }
  }

  async getHourlySales(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await salesDomain.getHourlySales({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getHourlySales:", error);
      return res.status(500).json({ error: "Ошибка получения почасовых продаж", message: error.message });
    }
  }

  async getSla(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await deliveryDomain.getSla({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getSla:", error);
      return res.status(500).json({ error: "Ошибка получения SLA-метрик", message: error.message });
    }
  }

  async getCourierKpi(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await deliveryDomain.getCourierKpi({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getCourierKpi:", error);
      return res.status(500).json({ error: "Ошибка получения KPI курьеров", message: error.message });
    }
  }

  async getMarketingSources(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await marketingDomain.getMarketingSources({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getMarketingSources:", error);
      return res.status(500).json({ error: "Ошибка получения маркетинговых источников", message: error.message });
    }
  }

  async getDeliverySummary(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await deliveryDomain.getDeliverySummary({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getDeliverySummary:", error);
      return res.status(500).json({ error: "Ошибка получения сводки доставки", message: error.message });
    }
  }

  async getDeliveryDelays(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await deliveryDomain.getDeliveryDelays({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryDelays:", error);
      return res.status(500).json({ error: "Ошибка получения отчета по опозданиям", message: error.message });
    }
  }

  async exportDeliveryDelays(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const { buffer, filename } = await deliveryDomain.exportDeliveryDelays({ organizationId, dateFrom, dateTo });

      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
      return res.send(buffer);
    } catch (error) {
      console.error("❌ ReportsController.exportDeliveryDelays:", error);
      return res.status(500).json({ error: "Ошибка выгрузки отчета по опозданиям", message: error.message });
    }
  }

  async getCourierMap(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo, terminalGroupId } = req.body;
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
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getCourierMap:", error);
      return res.status(500).json({ error: "Ошибка получения данных карты курьеров", message: error.message });
    }
  }

  async getDeliveryHeatmap(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo, terminalGroupId } = req.body;
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
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryHeatmap:", error);
      return res.status(500).json({ error: "Ошибка получения тепловой карты доставок", message: error.message });
    }
  }

  async getDeliveryHeatmapQuery(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, terminalGroupId } = req.query;
      const statuses = this.parseStatuses(req.query?.statuses);
      const sourceKeys = this.parseStringArray(req.query?.sourceKeys);
      const courierIds = this.parseStringArray(req.query?.courierIds);
      if (!this.validateCommonParams(res, { organizationId, dateFrom, dateTo })) return;

      const data = await deliveryDomain.getDeliveryHeatmap({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryHeatmapQuery:", error);
      return res.status(500).json({ error: "Ошибка получения тепловой карты доставок", message: error.message });
    }
  }

  async getDeliveryZones(req, res) {
    try {
      const { organizationId, terminalGroupId } = req.query;
      if (!organizationId) {
        return res.status(400).json({ error: "Обязательный параметр: organizationId" });
      }

      const data = await deliveryDomain.getDeliveryZones({ organizationId, terminalGroupId });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getDeliveryZones:", error);
      return res.status(500).json({ error: "Ошибка получения зон доставки", message: error.message });
    }
  }

  async saveDeliveryZones(req, res) {
    try {
      const { organizationId, terminalGroupId, geoJson } = req.body || {};
      if (!organizationId || !geoJson) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, geoJson" });
      }

      const data = await deliveryDomain.saveDeliveryZones({ organizationId, terminalGroupId, geoJson });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.saveDeliveryZones:", error);
      return res.status(500).json({ error: "Ошибка сохранения зон доставки", message: error.message });
    }
  }

  async getPromotions(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await marketingDomain.getPromotions({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getPromotions:", error);
      return res.status(500).json({ error: "Ошибка получения отчета по акциям и промокодам", message: error.message });
    }
  }

  async getMenuAbc(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50 } = req.body;
      const data = await assortmentDomain.getMenuAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getMenuAbc:", error);
      return res.status(500).json({ error: "Ошибка получения ABC-анализа меню", message: error.message });
    }
  }

  async getMenuAssortment(req, res) {
    return await this.getMenuAbc(req, res);
  }

  async getProductionForecast(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo, forecastDate } = req.body;
      const data = await salesDomain.getProductionForecast({ organizationId, dateFrom, dateTo, forecastDate });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getProductionForecast:", error);
      return res.status(500).json({ error: "Ошибка получения прогноза загрузки производства", message: error.message });
    }
  }
}

module.exports = new ReportsController();
