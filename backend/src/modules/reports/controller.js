const reportsService = require("./service");

class ReportsController {
  validateCommonParams(res, payload = {}) {
    const { organizationId, dateFrom, dateTo } = payload;
    if (!organizationId || !dateFrom || !dateTo) {
      res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      return false;
    }
    return true;
  }

  async getRevenue(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;
      if (!this.validateCommonParams(res, req.body)) return;

      const data = await reportsService.getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
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

      const data = await reportsService.getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
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

      const data = await reportsService.getCourierRoutes({ organizationId, dateFrom, dateTo });
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

      const data = await reportsService.getHourlySalesReport({ organizationId, dateFrom, dateTo });
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

      const data = await reportsService.getSlaReport({ organizationId, dateFrom, dateTo });
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

      const data = await reportsService.getCourierKpiReport({ organizationId, dateFrom, dateTo });
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

      const data = await reportsService.getMarketingSourcesReport({ organizationId, dateFrom, dateTo });
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
      const data = await reportsService.getDeliverySummaryReport({ organizationId, dateFrom, dateTo });
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
      const data = await reportsService.getDeliveryDelaysReport({ organizationId, dateFrom, dateTo });
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
      const { buffer, filename } = await reportsService.exportDeliveryDelaysReport({ organizationId, dateFrom, dateTo });

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
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await reportsService.getCourierMapReport({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getCourierMap:", error);
      return res.status(500).json({ error: "Ошибка получения данных карты курьеров", message: error.message });
    }
  }

  async getPromotions(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await reportsService.getPromotionsReport({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getPromotions:", error);
      return res.status(500).json({ error: "Ошибка получения отчета по акциям и промокодам", message: error.message });
    }
  }

  async getMenuAssortment(req, res) {
    try {
      if (!this.validateCommonParams(res, req.body)) return;
      const { organizationId, dateFrom, dateTo } = req.body;
      const data = await reportsService.getMenuAssortmentReport({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getMenuAssortment:", error);
      return res.status(500).json({ error: "Ошибка получения отчета по ассортименту", message: error.message });
    }
  }
}

module.exports = new ReportsController();
