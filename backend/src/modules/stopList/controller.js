const { stopListService, IikoApiError } = require("./service");
const { successResponse, errorResponse } = require("../shared/apiResponse");
const { validateTimezone, validateUuid } = require("../shared/requestValidation");

function parseOrganizationIds(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return String(rawValue)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

class StopListController {
  async getStopLists(req, res) {
    try {
      const organizationIdRaw = req.query?.organizationId ?? req.query?.id ?? req.query?.ids;
      const hasOrganizationId =
        typeof organizationIdRaw === "string"
          ? organizationIdRaw.trim().length > 0
          : Array.isArray(organizationIdRaw) && organizationIdRaw.length > 0;

      if (!hasOrganizationId) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Обязательный query-параметр: organizationId",
            meta: { module: "stop-list" },
          }),
        );
      }

      const timezone = String(req.query?.timezone || "").trim();
      if (timezone.length > 0 && timezone.length > 100) {
        return res.status(400).json(
          errorResponse({
            code: "VALIDATION_ERROR",
            message: "Параметр timezone слишком длинный",
            meta: { module: "stop-list" },
          }),
        );
      }

      if (timezone) {
        const timezoneValidation = validateTimezone(timezone, "timezone");
        if (!timezoneValidation.isValid) {
          return res.status(400).json(
            errorResponse({
              code: timezoneValidation.code || "VALIDATION_ERROR",
              message: timezoneValidation.message,
              meta: { module: "stop-list" },
            }),
          );
        }
      }

      const ids = parseOrganizationIds(organizationIdRaw);
      for (const id of ids) {
        const validation = validateUuid(id, "organizationId");
        if (!validation.isValid) {
          return res.status(400).json(
            errorResponse({
              code: validation.code || "VALIDATION_ERROR",
              message: validation.message,
              meta: { module: "stop-list" },
            }),
          );
        }
      }

      const payload = await stopListService.getStopLists(req.query || {});
      return res.json(
        successResponse(payload, {
          module: "stop-list",
        }),
      );
    } catch (error) {
      if (error instanceof IikoApiError) {
        const status = error.status ?? 502;
        return res.status(status).json(
          errorResponse({
            code: "UPSTREAM_ERROR",
            message: error.message,
            details: error.details || null,
            meta: {
              module: "stop-list",
              status,
            },
          }),
        );
      }

      return res.status(500).json(
        errorResponse({
          code: "INTERNAL_ERROR",
          message: error.message ?? "Unexpected server error.",
          meta: { module: "stop-list" },
        }),
      );
    }
  }
}

module.exports = new StopListController();
