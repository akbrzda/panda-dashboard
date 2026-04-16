const revenueService = require("./service");

class RevenueController {
  async getRevenueReport(req, res) {
    try {
      const { organizationId, startDate, endDate } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: "Missing required parameter: organizationId" });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Missing required parameters: startDate and endDate" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      if (start > end) {
        return res.status(400).json({ error: "startDate cannot be after endDate" });
      }

      const report = await revenueService.getRevenueReport(organizationId, start, end);

      return res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ RevenueController.getRevenueReport:", error);
      return res.status(500).json({
        error: "Failed to fetch revenue report",
        message: error.message,
      });
    }
  }

  async getDailyRevenue(req, res) {
    try {
      const { organizationId, date } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: "Missing required parameter: organizationId" });
      }

      const targetDate = date ? new Date(date) : new Date();

      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const report = await revenueService.getDailyRevenue(organizationId, targetDate);

      return res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ RevenueController.getDailyRevenue:", error);
      return res.status(500).json({
        error: "Failed to fetch daily revenue",
        message: error.message,
      });
    }
  }
}

module.exports = new RevenueController();
