const { IikoService, IikoApiError } = require("../services/iikoService");
const config = require("../config");

const iikoService = new IikoService();

class StopListController {
  parseIdQuery(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .flatMap((part) => part.split(","))
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  formatDateForTimezone(date, timezone) {
    try {
      let dateObj;
      if (typeof date === "string" && date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        dateObj = new Date(date.replace(" ", "T") + "Z");
      } else {
        dateObj = new Date(date);
      }

      if (isNaN(dateObj.getTime())) return date;

      const formatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(dateObj);
      const getValue = (type) => parts.find((p) => p.type === type)?.value || "00";

      return `${getValue("year")}-${getValue("month")}-${getValue("day")} ${getValue("hour")}:${getValue("minute")}:${getValue("second")}`;
    } catch (_) {
      return date;
    }
  }

  normalizeDates(items, timezone = "Europe/Moscow") {
    return items.map((item) => {
      const result = { ...item };

      if (item.dateAdd) {
        result.dateAddOriginal = item.dateAdd;
        result.dateAdd = this.formatDateForTimezone(item.dateAdd, timezone);
      }

      if (item.openedAt) {
        result.openedAtOriginal = item.openedAt;
        result.openedAt = this.formatDateForTimezone(item.openedAt, timezone);
      }

      if (item.closedAt) {
        result.closedAtOriginal = item.closedAt;
        result.closedAt = this.formatDateForTimezone(item.closedAt, timezone);
      }

      return result;
    });
  }

  async getStopLists(req, res) {
    try {
      const organizationIds = this.parseIdQuery(req.query.organizationId ?? req.query.id ?? req.query.ids);
      if (organizationIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Provide at least one organizationId query parameter.",
        });
      }

      const attachOrganizations = String(req.query.includeOrganizations).toLowerCase() !== "false";
      const timezone = req.query.timezone || "Europe/Moscow";

      const organizations = config.organizations.filter((org) => organizationIds.includes(org.id));

      const token = await iikoService.fetchAccessToken();
      const iikoResult = await iikoService.fetchStopListsWithProducts(token, organizationIds, organizations);

      const normalizedItems = this.normalizeDates(iikoResult.normalizedItems || [], timezone);

      const payload = {
        success: true,
        organizationIds,
        stopLists: iikoResult.stopLists || [],
        normalizedItems,
        sources: {
          iiko: normalizedItems.length,
          deduplicated: 0,
        },
        timezone,
      };

      if (attachOrganizations && organizations.length > 0) {
        payload.organizations = organizations;
      }

      if (iikoResult.rawStopListsResponse !== undefined) {
        payload.rawStopListsResponse = iikoResult.rawStopListsResponse;
      }

      return res.json(payload);
    } catch (error) {
      if (error instanceof IikoApiError) {
        const status = error.status ?? 502;
        return res.status(status).json({
          success: false,
          error: error.message,
          status,
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message ?? "Unexpected server error.",
      });
    }
  }
}

module.exports = new StopListController();
