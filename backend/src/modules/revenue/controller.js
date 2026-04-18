const revenueService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { parseDateInput } = require("../shared/requestValidation");

class RevenueController {
  async getRevenueReport(req, res) {
    try {
      const organizationId = String(req.query?.organizationId || "").trim();
      const startDate = String(req.query?.startDate || "").trim();
      const endDate = String(req.query?.endDate || "").trim();

      if (!organizationId) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Missing required parameter: organizationId",
            meta: { module: "revenue" },
          }),
        );
      }

      if (!startDate || !endDate) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Missing required parameters: startDate and endDate",
            meta: { module: "revenue" },
          }),
        );
      }

      const start = parseDateInput(startDate);
      const end = parseDateInput(endDate);

      if (!start || !end) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Invalid date format. Use YYYY-MM-DD",
            meta: { module: "revenue" },
          }),
        );
      }

      if (start > end) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "startDate cannot be after endDate",
            meta: { module: "revenue" },
          }),
        );
      }

      const report = await revenueService.getRevenueReport(organizationId, start, end);

      return res.json(successResponse(report, { module: "revenue", report: "revenue-range" }));
    } catch (error) {
      console.error("❌ RevenueController.getRevenueReport:", error);
      return res.status(500).json(
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Failed to fetch revenue report",
          details: error.message,
          meta: { module: "revenue" },
        }),
      );
    }
  }

  async getDailyRevenue(req, res) {
    try {
      const organizationId = String(req.query?.organizationId || "").trim();
      const date = String(req.query?.date || "").trim();

      if (!organizationId) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Missing required parameter: organizationId",
            meta: { module: "revenue" },
          }),
        );
      }

      const targetDate = date ? parseDateInput(date) : new Date();

      if (!targetDate) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Invalid date format. Use YYYY-MM-DD",
            meta: { module: "revenue" },
          }),
        );
      }

      const report = await revenueService.getDailyRevenue(organizationId, targetDate);

      return res.json(successResponse(report, { module: "revenue", report: "revenue-daily" }));
    } catch (error) {
      console.error("❌ RevenueController.getDailyRevenue:", error);
      return res.status(500).json(
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Failed to fetch daily revenue",
          details: error.message,
          meta: { module: "revenue" },
        }),
      );
    }
  }
}

module.exports = new RevenueController();
