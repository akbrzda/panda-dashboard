const reportsService = require("../../service");
const salesReports = require("../../services/salesReports");
const organizationsService = require("../../../organizations/service");
const { toMoscowDateStr } = require("../../../../utils/dateUtils");

class SalesReportsDomain {
  async getRevenueWithLFL(params) {
    return await reportsService.getRevenueWithLFL(params);
  }

  async getOperationalMetrics(params) {
    return await reportsService.getOperationalMetrics(params);
  }

  async getHourlySales(params) {
    return await reportsService.getHourlySalesReport(params);
  }

  async getProductionForecast({ organizationId, forecastDate, analysisWindowDays }) {
    const timezone = await reportsService.getOrganizationTimezone(organizationId);
    const targetDate = String(forecastDate || "").slice(0, 10) || toMoscowDateStr(new Date());
    const targetDateTs = new Date(`${targetDate}T12:00:00Z`).getTime();
    const todayDate = toMoscowDateStr(new Date());
    if (!Number.isFinite(targetDateTs) || targetDate <= todayDate) {
      const error = new Error("forecastDate должен быть будущей датой");
      error.statusCode = 400;
      throw error;
    }

    const windowDays = Math.min(90, Math.max(7, Number(analysisWindowDays || process.env.REPORTS_FORECAST_ANALYSIS_DAYS || 28)));
    const analysisEnd = new Date(`${targetDate}T00:00:00Z`);
    analysisEnd.setUTCDate(analysisEnd.getUTCDate() - 1);
    const analysisStart = new Date(analysisEnd);
    analysisStart.setUTCDate(analysisStart.getUTCDate() - (windowDays - 1));
    const storeId = await reportsService.resolveStoreId(organizationId);
    const availableColumns = await reportsService.fetchAvailableColumns(storeId);
    const requiredColumns = ["OpenTime", "Department.Id", "UniqOrderId.Id", "Sales"];
    const verifiedColumns = requiredColumns.filter((column) => availableColumns.has(column));
    const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));

    const [historicalRows, preorderRows] = await Promise.all([
      reportsService.getOperationalRowsForPeriod({
        organizationId,
        dateFrom: analysisStart.toISOString().slice(0, 10),
        dateTo: analysisEnd.toISOString().slice(0, 10),
        timezone,
        completedOnly: true,
      }),
      reportsService
        .getOperationalRowsForPeriod({
          organizationId,
          dateFrom: targetDate,
          dateTo: targetDate,
        })
        .catch(() => []),
    ]);
    const organizations = await organizationsService.getOrganizations();
    const organizationName = (organizations || []).find((item) => String(item.id) === String(organizationId))?.name || null;

    return salesReports.buildProductionForecastReport(
      {
        historicalRows,
        preorderRows,
        forecastDate: targetDate,
        timezone,
        organizationId,
        organizationName,
        verifiedColumns,
        missingColumns,
        analysisDateFrom: analysisStart.toISOString().slice(0, 10),
        analysisDateTo: analysisEnd.toISOString().slice(0, 10),
        analysisWindowDays: windowDays,
      },
      reportsService,
    );
  }
}

module.exports = new SalesReportsDomain();
