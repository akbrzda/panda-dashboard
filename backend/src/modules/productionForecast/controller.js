const service = require("./service");
const { validateProductionForecastParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class ProductionForecastController {
  sendError(res, code, message, details = null) {
    const status = code === "VALIDATION_ERROR" ? 400 : 500;
    return res.status(status).json(errorResponse({ code, message, details }));
  }

  async getForecast(req, res) {
    try {
      const validation = validateProductionForecastParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, forecastDate, analysisWindowDays } = validation.normalized;
      const data = await service.getForecast({ organizationId, forecastDate, analysisWindowDays });
      return res.json(successResponse(data, { report: "production-forecast" }));
    } catch (error) {
      const statusCode = error?.statusCode === 400 ? 400 : 500;
      const code = statusCode === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
      console.error("❌ ProductionForecastController.getForecast:", error);
      return res
        .status(statusCode)
        .json(errorResponse({ code, message: error?.message || "Ошибка расчёта производственного прогноза", details: null }));
    }
  }
}

module.exports = new ProductionForecastController();
