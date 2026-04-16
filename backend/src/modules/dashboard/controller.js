const dashboardService = require("./service");

class DashboardController {
  async getDashboard(req, res) {
    try {
      const { date, organizationIds } = req.body;

      if (!date) {
        return res.status(400).json({ error: "Обязательный параметр: date (YYYY-MM-DD)" });
      }

      const data = await dashboardService.getDashboardData({ organizationIds: organizationIds || [], date });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ DashboardController.getDashboard:", error);
      return res.status(500).json({ error: "Ошибка загрузки дашборда", message: error.message });
    }
  }
}

module.exports = new DashboardController();
