const reportsService = require("./service");

class ReportsController {
  async getRevenue(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

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

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

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

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await reportsService.getCourierRoutes({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ReportsController.getCourierRoutes:", error);
      return res.status(500).json({ error: "Ошибка получения маршрутов курьеров", message: error.message });
    }
  }
}

module.exports = new ReportsController();
