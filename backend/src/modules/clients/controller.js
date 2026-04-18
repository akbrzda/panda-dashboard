const clientsService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { validatePeriodParams } = require("../shared/requestValidation");

class ClientsController {
  async getClients(req, res) {
    try {
      const validation = validatePeriodParams(req.query || {}, {
        organizationField: "organizationId",
        fromField: "dateFrom",
        toField: "dateTo",
        maxRangeDays: 366,
      });
      if (!validation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: validation.code || "VALIDATION_ERROR",
            message: validation.message,
            meta: { module: "clients" },
          }),
        );
      }

      const { organizationId, dateFrom, dateTo } = validation.normalized;
      const data = await clientsService.getClients({ organizationId, dateFrom, dateTo });
      return res.json(successResponse(data, { module: "clients" }));
    } catch (error) {
      console.error("❌ ClientsController.getClients:", error);
      return res.status(500).json(
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Ошибка получения клиентской базы",
          details: error.message,
          meta: { module: "clients" },
        }),
      );
    }
  }
}

module.exports = new ClientsController();
