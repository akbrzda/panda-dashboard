const revenueService = require("../services/revenueService");

class RevenueController {
  /**
   * Получить отчет по выручке за период
   * GET /api/revenue/report?organizationId=xxx&startDate=2024-01-01&endDate=2024-01-07&timezone=Europe/Moscow
   */
  async getRevenueReport(req, res) {
    try {
      const { organizationId, startDate, endDate, timezone = "Europe/Moscow" } = req.query;

      if (!organizationId) {
        return res.status(400).json({
          error: "Missing required parameter: organizationId",
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "Missing required parameters: startDate and endDate",
        });
      }

      // Валидация дат
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      if (start > end) {
        return res.status(400).json({
          error: "startDate cannot be after endDate",
        });
      }

      console.log(`📊 Fetching revenue report for organization ${organizationId} from ${startDate} to ${endDate}`);

      const report = await revenueService.getRevenueReport(organizationId, start, end, timezone);

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error in getRevenueReport:", error);
      res.status(500).json({
        error: "Failed to fetch revenue report",
        message: error.message,
      });
    }
  }

  /**
   * Получить отчет по выручке за конкретный день
   * GET /api/revenue/daily?organizationId=xxx&date=2024-01-01&timezone=Europe/Moscow
   */
  async getDailyRevenue(req, res) {
    try {
      const { organizationId, date, timezone = "Europe/Moscow" } = req.query;

      if (!organizationId) {
        return res.status(400).json({
          error: "Missing required parameter: organizationId",
        });
      }

      // Если дата не указана, используем сегодня
      const targetDate = date ? new Date(date) : new Date();

      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          error: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      console.log(`📊 Fetching daily revenue for organization ${organizationId} on ${targetDate.toISOString().split("T")[0]}`);

      const report = await revenueService.getDailyRevenue(organizationId, targetDate, timezone);

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error in getDailyRevenue:", error);
      res.status(500).json({
        error: "Failed to fetch daily revenue",
        message: error.message,
      });
    }
  }
}

module.exports = new RevenueController();
