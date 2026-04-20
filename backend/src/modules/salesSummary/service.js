const olapRepository = require("../shared/olapRepository");
const salesReports = require("../shared/salesReports");
const revenueService = require("../revenue/service");

class SalesSummaryService {
  async getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo, completedOnly = true }) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const rows = await olapRepository.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo, timezone, completedOnly });
    const summary = salesReports.buildOperationalSummary(rows, olapRepository);
    return {
      ...summary,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }

  async getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly = true }) {
    const includeOperationalSummary =
      String(process.env.REPORTS_ENABLE_REVENUE_OPERATIONAL_SUMMARY || "true")
        .trim()
        .toLowerCase() === "true";

    const [current, currentSummary] = await Promise.all([
      revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo)),
      includeOperationalSummary
        ? this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo, completedOnly }).catch(() => null)
        : Promise.resolve(null),
    ]);

    let lfl = null;
    let lflSummary = null;
    if (lflDateFrom && lflDateTo) {
      [lfl, lflSummary] = await Promise.all([
        revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null),
        includeOperationalSummary
          ? this.getRevenueSummaryForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo, completedOnly }).catch(() => null)
          : Promise.resolve(null),
      ]);
    }

    const lflTotalRevenue = lfl?.summary?.totalRevenue ?? null;
    const lflTotalOrders = lfl?.summary?.totalOrders ?? null;
    const revenueLFL =
      lflTotalRevenue != null && lflTotalRevenue > 0
        ? Math.round(((current.summary.totalRevenue - lflTotalRevenue) / lflTotalRevenue) * 10000) / 100
        : current.summary.lfl;
    const ordersLFL =
      lflTotalOrders != null && lflTotalOrders > 0
        ? Math.round(((current.summary.totalOrders - lflTotalOrders) / lflTotalOrders) * 10000) / 100
        : null;
    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);
    const avgPerOrderLFL = calcLFL(current.summary?.avgPerOrder, lfl?.summary?.avgPerOrder);
    const discountSumLFL = calcLFL(current.summary?.discountSum, lfl?.summary?.discountSum);
    const discountPercentLFL = calcLFL(current.summary?.discountPercent, lfl?.summary?.discountPercent);

    const channelsWithLFL = {};
    for (const [channel, data] of Object.entries(current.revenueByChannel || {})) {
      const lflRevenue = lfl?.revenueByChannel?.[channel]?.revenue ?? null;
      const lflOrders = lfl?.revenueByChannel?.[channel]?.orders ?? null;
      channelsWithLFL[channel] = {
        ...data,
        lflRevenue,
        lflOrders,
        revenueLFL: lflRevenue != null && lflRevenue > 0 ? Math.round(((data.revenue - lflRevenue) / lflRevenue) * 10000) / 100 : null,
        ordersLFL: lflOrders != null && lflOrders > 0 ? Math.round(((data.orders - lflOrders) / lflOrders) * 10000) / 100 : null,
        avgCheckLFL:
          lflRevenue != null && lflOrders != null && lflOrders > 0
            ? (() => {
                const lflAvg = lflRevenue / lflOrders;
                return lflAvg > 0 ? Math.round(((data.avgCheck - lflAvg) / lflAvg) * 10000) / 100 : null;
              })()
            : null,
      };
    }

    return {
      ...current,
      summary: {
        ...current.summary,
        avgPerOrder: currentSummary?.avgPerOrder ?? current.summary.avgPerOrder,
        avgPerOrderLFL,
        avgDeliveryTime: currentSummary?.avgDeliveryTime ?? null,
        avgCookingTime: currentSummary?.avgCookingTime ?? null,
        discountSumLFL,
        discountPercentLFL,
        lfl: revenueLFL,
        ordersLFL,
        avgDeliveryTimeLFL: lflSummary ? calcLFL(currentSummary?.avgDeliveryTime, lflSummary?.avgDeliveryTime) : null,
        avgCookingTimeLFL: lflSummary ? calcLFL(currentSummary?.avgCookingTime, lflSummary?.avgCookingTime) : null,
        lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
      },
      revenueByChannel: channelsWithLFL,
    };
  }

  async getHourlySalesReport({ organizationId, dateFrom, dateTo, completedOnly = true }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const rows = await olapRepository.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo, timezone, completedOnly });
    return { ...salesReports.buildHourlySalesReport(rows, timezone, olapRepository), timezone };
  }

  async getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly = true }) {
    const current = await this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo, completedOnly });
    let lfl = null;
    if (lflDateFrom && lflDateTo) {
      lfl = await this.getRevenueSummaryForPeriod({
        organizationId,
        dateFrom: lflDateFrom,
        dateTo: lflDateTo,
        completedOnly,
      }).catch(() => null);
    }
    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);
    return {
      avgDeliveryTime: { value: current.avgDeliveryTime, lfl: calcLFL(current.avgDeliveryTime, lfl?.avgDeliveryTime) },
      avgCookingTime: { value: current.avgCookingTime, lfl: calcLFL(current.avgCookingTime, lfl?.avgCookingTime) },
      avgPerOrder: { value: current.avgPerOrder, lfl: calcLFL(current.avgPerOrder, lfl?.avgPerOrder) },
      period: current.period,
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }
}

module.exports = new SalesSummaryService();
