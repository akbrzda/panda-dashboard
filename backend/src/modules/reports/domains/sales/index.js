const reportsService = require("../../service");
const salesReports = require("../../services/salesReports");
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

  async getProductionForecast({ organizationId, dateFrom, dateTo, forecastDate }) {
    const timezone = await reportsService.getOrganizationTimezone(organizationId);
    const targetDate = String(forecastDate || dateTo || "").slice(0, 10) || toMoscowDateStr(new Date());
    const storeId = await reportsService.resolveStoreId(organizationId);
    const availableColumns = await reportsService.fetchAvailableColumns(storeId);
    const requiredColumns = ["OpenTime", "Department.Id", "UniqOrderId.Id", "Sales"];
    const verifiedColumns = requiredColumns.filter((column) => availableColumns.has(column));
    const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));

    const [historicalRows, preorderRows] = await Promise.all([
      reportsService.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo }),
      reportsService
        .getOperationalRowsForPeriod({
          organizationId,
          dateFrom: targetDate,
          dateTo: targetDate,
        })
        .catch(() => []),
    ]);

    return salesReports.buildProductionForecastReport(
      {
        historicalRows,
        preorderRows,
        forecastDate: targetDate,
        timezone,
        organizationId,
        verifiedColumns,
        missingColumns,
      },
      reportsService,
    );
  }
}

module.exports = new SalesReportsDomain();

