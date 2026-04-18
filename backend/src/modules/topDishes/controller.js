const topDishesService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { validatePeriodParams, validatePositiveInteger } = require("../shared/requestValidation");

class TopDishesController {
  isTemporaryNetworkError(error) {
    return (
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.code) ||
      [429, 500, 502, 503, 504].includes(error?.response?.status)
    );
  }

  async getTopDishes(req, res) {
    try {
      const validation = validatePeriodParams(req.body || {}, {
        organizationField: "organizationId",
        fromField: "dateFrom",
        toField: "dateTo",
      });
      if (!validation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: validation.code || "VALIDATION_ERROR",
            message: validation.message,
            meta: { module: "top-dishes" },
          }),
        );
      }

      const limitValidation = validatePositiveInteger(req.body?.limit || 20, "limit", { min: 1, max: 200 });
      if (!limitValidation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: limitValidation.code || "VALIDATION_ERROR",
            message: limitValidation.message,
            meta: { module: "top-dishes" },
          }),
        );
      }

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await topDishesService.getTopDishes({ organizationId, dateFrom, dateTo, limit: limitValidation.value });
      return res.json(successResponse(data, { module: "top-dishes" }));
    } catch (error) {
      const status = this.isTemporaryNetworkError(error) ? 503 : 500;
      const message = status === 503 ? "IIKO временно недоступен, попробуйте повторить запрос" : "Ошибка получения топ блюд";

      console.error("❌ TopDishesController.getTopDishes:", error);
      return res.status(status).json(
        errorResponse({
          code: status === 503 ? "UPSTREAM_ERROR" : "INTERNAL_ERROR",
          message,
          details: error.message,
          meta: { module: "top-dishes" },
        }),
      );
    }
  }
}

module.exports = new TopDishesController();
