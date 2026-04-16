const metricsService = require("./services/metricsService");
const dashboardService = require("./services/dashboardService");

class AnalyticsController {
  async getRevenue(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await metricsService.getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getRevenue:", error);
      return res.status(500).json({ error: "Ошибка получения данных о выручке", message: error.message });
    }
  }

  async getHourlySales(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await metricsService.getHourlySales({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getHourlySales:", error);
      return res.status(500).json({ error: "Ошибка получения почасовых данных", message: error.message });
    }
  }

  async getOperational(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await metricsService.getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getOperational:", error);
      return res.status(500).json({ error: "Ошибка получения операционных метрик", message: error.message });
    }
  }

  async getCourierRoutes(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await metricsService.getCourierRoutes({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getCourierRoutes:", error);
      return res.status(500).json({ error: "Ошибка получения маршрутов курьеров", message: error.message });
    }
  }

  async getDashboard(req, res) {
    try {
      const { date, organizationIds } = req.body;

      if (!date) {
        return res.status(400).json({ error: "Обязательный параметр: date (YYYY-MM-DD)" });
      }

      const data = await dashboardService.getDashboardData({ organizationIds: organizationIds || [], date });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getDashboard:", error);
      return res.status(500).json({ error: "Ошибка загрузки дашборда", message: error.message });
    }
  }

  async getFoodcost(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await metricsService.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getFoodcost:", error);
      return res.status(500).json({ error: "Ошибка получения фудкоста", message: error.message });
    }
  }

  async getTopDishes(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, limit } = req.body;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: dateFrom, dateTo" });
      }

      const data = await metricsService.getTopDishes({ organizationId, dateFrom, dateTo, limit: limit ? Number(limit) : 20 });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getTopDishes:", error);
      return res.status(500).json({ error: "Ошибка получения топ блюд", message: error.message });
    }
  }

  async getClients(req, res) {
    try {
      const { dateFrom, dateTo } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: dateFrom, dateTo" });
      }

      const data = await metricsService.getClients({ dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ AnalyticsController.getClients:", error);
      return res.status(500).json({ error: "Ошибка получения клиентской базы", message: error.message });
    }
  }
}

module.exports = new AnalyticsController();
