const foodcostService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { validatePeriodParams } = require("../shared/requestValidation");

class FoodcostController {
  isTemporaryNetworkError(error) {
    return (
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.code) ||
      [429, 500, 502, 503, 504].includes(error?.response?.status) ||
      /IIKO временно недоступен|разорвал соединение/i.test(error?.message || "")
    );
  }

  async getFoodcost(req, res) {
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
            meta: { module: "foodcost" },
          }),
        );
      }

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const { lflDateFrom, lflDateTo } = req.body || {};
      const data = await foodcostService.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json(successResponse(data, { module: "foodcost" }));
    } catch (error) {
      const status = this.isTemporaryNetworkError(error) ? 503 : 500;
      const message = status === 503 ? "IIKO временно недоступен, попробуйте повторить запрос" : "Ошибка получения фудкоста";

      console.error("❌ FoodcostController.getFoodcost:", error);
      return res.status(status).json(
        errorResponse({
          code: status === 503 ? "UPSTREAM_ERROR" : "INTERNAL_ERROR",
          message,
          details: error.message,
          meta: { module: "foodcost" },
        }),
      );
    }
  }
}

module.exports = new FoodcostController();
