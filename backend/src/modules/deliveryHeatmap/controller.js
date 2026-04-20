const service = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");

class DeliveryHeatmapController {
  parseStringArray(value) {
    if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
    if (typeof value === "string")
      return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    return [];
  }

  extractParams(source) {
    const organizationId = String(source.organizationId || "").trim();
    if (!organizationId) return { isValid: false, message: "Обязательный параметр: organizationId" };
    const dateFrom = String(source.dateFrom || "").trim();
    const dateTo = String(source.dateTo || "").trim();
    if (!dateFrom || !dateTo) return { isValid: false, message: "Обязательные параметры: dateFrom, dateTo" };
    return {
      isValid: true,
      params: {
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId: source.terminalGroupId ? String(source.terminalGroupId).trim() : null,
        statuses: this.parseStringArray(source.statuses),
        sourceKeys: this.parseStringArray(source.sourceKeys),
        courierIds: this.parseStringArray(source.courierIds),
      },
    };
  }

  sendError(res, code, message, details = null) {
    return res.status(code === "VALIDATION_ERROR" ? 400 : 500).json(errorResponse({ code, message, details }));
  }

  async getHeatmap(req, res) {
    try {
      const source = req.method === "GET" ? req.query : req.body;
      const extraction = this.extractParams(source);
      if (!extraction.isValid) return this.sendError(res, "VALIDATION_ERROR", extraction.message);
      const data = await service.getHeatmap(extraction.params);
      return res.json(successResponse(data, { report: "delivery-heatmap" }));
    } catch (error) {
      console.error("❌ DeliveryHeatmapController.getHeatmap:", error);
      const code = error?.message?.includes("ериод") || error?.message?.includes("некорр") ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
      return this.sendError(res, code, error?.message || "Ошибка получения тепловой карты");
    }
  }
}

module.exports = new DeliveryHeatmapController();
