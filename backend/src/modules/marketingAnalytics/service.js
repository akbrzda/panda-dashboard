const olapRepository = require("../shared/olapRepository");
const marketingReports = require("../shared/marketingReports");

class MarketingAnalyticsService {
  async getMarketingSourcesReport({ organizationId, dateFrom, dateTo, completedOnly = true }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const rows = await olapRepository.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo, timezone, completedOnly });
    return {
      ...marketingReports.buildMarketingSourcesReport(rows, timezone, olapRepository),
      timezone,
      source: "server-olap",
    };
  }

  async getPromotionsReport({ organizationId, dateFrom, dateTo, completedOnly = true }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const rows = await olapRepository.getPromotionsRowsForPeriod({ organizationId, dateFrom, dateTo });
    const filteredRows = olapRepository.filterOperationalRowsByCompletion(rows, timezone, completedOnly);
    return olapRepository.buildPromotionsReport(filteredRows);
  }
}

module.exports = new MarketingAnalyticsService();
