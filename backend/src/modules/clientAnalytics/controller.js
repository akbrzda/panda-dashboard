const clientAnalyticsService = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { validatePeriodParams, validatePositiveInteger, validateEnum } = require("../shared/requestValidation");

class ClientAnalyticsController {
  parseStringArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  parseBoolean(value, defaultValue = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
    return defaultValue;
  }

  parsePositiveInteger(value, defaultValue) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  async getClientAnalytics(req, res) {
    try {
      const periodValidation = validatePeriodParams(
        {
          organizationId: req.query?.organizationId,
          from: req.query?.from || req.query?.dateFrom,
          to: req.query?.to || req.query?.dateTo,
        },
        {
          organizationField: "organizationId",
          fromField: "from",
          toField: "to",
          maxRangeDays: 366,
        },
      );
      if (!periodValidation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: periodValidation.code || "VALIDATION_ERROR",
            message: periodValidation.message,
            meta: { module: "client-analytics" },
          }),
        );
      }

      const organizationId = periodValidation.normalized.organizationId;
      const from = periodValidation.normalized.from;
      const to = periodValidation.normalized.to;
      const terminalGroupId = String(req.query?.terminalGroupId || "").trim() || null;
      const statuses = this.parseStringArray(req.query?.statuses);
      const selectedPhones = this.parseStringArray(req.query?.selectedPhones);
      const includeProfile = this.parseBoolean(req.query?.includeProfile, false);
      const refresh = this.parseBoolean(req.query?.refresh, false);
      const profileMode =
        String(req.query?.profileMode || "top")
          .trim()
          .toLowerCase() || "top";
      const profileLimit = this.parsePositiveInteger(req.query?.profileLimit, 50);
      const profileLimitValidation = validatePositiveInteger(profileLimit, "profileLimit", { min: 1, max: 200 });
      if (!profileLimitValidation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: profileLimitValidation.code || "VALIDATION_ERROR",
            message: profileLimitValidation.message,
            meta: { module: "client-analytics" },
          }),
        );
      }

      const profileModeValidation = validateEnum(profileMode, "profileMode", ["top", "all", "selected"]);
      if (!profileModeValidation.isValid) {
        return res.status(400).json(
          errorResponse({
            code: profileModeValidation.code || "VALIDATION_ERROR",
            message: profileModeValidation.message,
            meta: { module: "client-analytics" },
          }),
        );
      }

      const data = await clientAnalyticsService.getClientAnalytics({
        organizationId,
        from,
        to,
        terminalGroupId,
        statuses,
        includeProfile,
        profileMode: profileModeValidation.value,
        profileLimit: profileLimitValidation.value,
        selectedPhones,
        refresh,
      });

      return res.json(successResponse(data, { module: "client-analytics" }));
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      console.error("❌ ClientAnalyticsController.getClientAnalytics:", error);
      return res.status(statusCode).json(
        errorResponse({
          code: statusCode >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR",
          message: statusCode >= 500 ? "Ошибка получения клиентской аналитики" : error.message,
          details: error.message,
          meta: { module: "client-analytics" },
        }),
      );
    }
  }
}

module.exports = new ClientAnalyticsController();
