const dashboardService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { parseDateInput } = require("../shared/requestValidation");

class DashboardController {
  async getDashboard(req, res) {
    try {
      const { date, organizationIds } = req.body;

      if (!date) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Обязательный параметр: date (YYYY-MM-DD)",
            meta: { module: "dashboard" },
          }),
        );
      }

      if (!parseDateInput(date)) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Некорректный формат date. Используйте YYYY-MM-DD",
            meta: { module: "dashboard" },
          }),
        );
      }

      const data = await dashboardService.getDashboardData({ organizationIds: organizationIds || [], date });
      return res.json(successResponse(data, { module: "dashboard" }));
    } catch (error) {
      console.error("❌ DashboardController.getDashboard:", error);
      return res.status(500).json(
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Ошибка загрузки дашборда",
          details: error.message,
          meta: { module: "dashboard" },
        }),
      );
    }
  }
}

module.exports = new DashboardController();
