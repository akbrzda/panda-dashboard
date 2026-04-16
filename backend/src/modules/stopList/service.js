const organizationsService = require("../organizations/service");
const { IikoService, IikoApiError } = require("./iikoService");

class StopListService {
  constructor() {
    this.iikoService = new IikoService();
  }

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

  async getStopLists(query = {}) {
    const organizationIds = this.parseIdQuery(query.organizationId ?? query.id ?? query.ids);

    if (organizationIds.length === 0) {
      throw new IikoApiError("Provide at least one organizationId query parameter.", 400);
    }

    const attachOrganizations = String(query.includeOrganizations).toLowerCase() !== "false";
    const timezone = query.timezone || "Europe/Moscow";

    const allOrganizations = await organizationsService.getOrganizations();
    const organizations = allOrganizations.filter((org) => organizationIds.includes(String(org.id)));

    const token = await this.iikoService.fetchAccessToken();
    const iikoResult = await this.iikoService.fetchStopListsWithProducts(token, organizationIds, organizations);
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

    return payload;
  }
}

module.exports = {
  stopListService: new StopListService(),
  IikoApiError,
};
