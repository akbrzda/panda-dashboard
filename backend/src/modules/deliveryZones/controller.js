const service = require("./service");
const { validateDeliveryZonesGetParams, validateDeliveryZonesSaveParams } = require("../shared/reportQuery");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class DeliveryZonesController {
  sendError(res, code, message, details = null) {
    return res.status(code === "VALIDATION_ERROR" ? 400 : 500).json(errorResponse({ code, message, details }));
  }

  async getZones(req, res) {
    try {
      const source = req.method === "GET" ? req.query : req.body;
      const validation = validateDeliveryZonesGetParams(source);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, terminalGroupId } = validation.normalized;
      const data = await service.get({ organizationId, terminalGroupId });
      return res.json(successResponse(data, { report: "delivery-zones" }));
    } catch (error) {
      console.error("❌ DeliveryZonesController.getZones:", error);
      return this.sendError(res, "INTERNAL_ERROR", "Ошибка получения зон доставки", error?.message);
    }
  }

  async saveZones(req, res) {
    try {
      const validation = validateDeliveryZonesSaveParams(req.body);
      if (!validation.isValid) return this.sendError(res, validation.code, validation.message);
      const { organizationId, terminalGroupId, geoJson } = validation.normalized;
      const data = await service.save({ organizationId, terminalGroupId, geoJson });
      return res.json(successResponse(data, { report: "delivery-zones" }));
    } catch (error) {
      console.error("❌ DeliveryZonesController.saveZones:", error);
      const code = error?.message ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
      return this.sendError(res, code, error?.message || "Ошибка сохранения зон доставки");
    }
  }
}

module.exports = new DeliveryZonesController();
