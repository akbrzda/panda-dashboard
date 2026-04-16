const organizationsService = require("../../organizations/service");
const revenueService = require("../../revenue/service");
const metricsService = require("./metricsService");

class DashboardService {
  async withTimeout(promise, timeoutMs = 35000) {
    return await Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  }

  async getDashboardData({ organizationIds, date }) {
    const allOrgs = await organizationsService.getOrganizations();
    const targetOrgs =
      !organizationIds || organizationIds.length === 0
        ? allOrgs
        : allOrgs.filter((org) => organizationIds.some((id) => String(id) === String(org.id) || String(id) === String(org.code)));

    if (targetOrgs.length === 0) {
      throw new Error("Нет доступных подразделений");
    }

    const day = new Date(date);
    const dayIso = day.toISOString().split("T")[0];

    console.log(`🏪 Dashboard: ${targetOrgs.length} подразделений за ${dayIso}`);

    const orgResults = await Promise.allSettled(
      targetOrgs.map(async (org) => {
        const report = await this.withTimeout(revenueService.getRevenueReport(org.id, dayIso, dayIso), 12000);

        if (!report) {
          throw new Error("IIKO временно не ответил");
        }

        return {
          id: org.id,
          name: org.name || String(org.id),
          report,
        };
      }),
    );

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalRevenueBeforeDiscount = 0;
    const channelMap = {};
    const byOrganization = [];
    let hourlyTotals = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orders: 0 }));
    let topDishes = [];
    let outsiders = [];

    for (let i = 0; i < targetOrgs.length; i++) {
      const org = targetOrgs[i];
      const result = orgResults[i];

      if (result.status !== "fulfilled") {
        console.error(`❌ Org "${org.name || org.id}":`, result.reason?.message || result.reason);
        byOrganization.push({ id: org.id, name: org.name || String(org.id), revenue: 0, orders: 0, avgCheck: 0, error: true });
        continue;
      }

      const report = result.value.report;
      const revenue = Number(report.summary?.totalRevenue) || 0;
      const orders = Number(report.summary?.totalOrders) || 0;
      const discountSum = Number(report.summary?.discountSum) || 0;
      const revenueBeforeDiscount = revenue + discountSum;

      totalRevenue += revenue;
      totalOrders += orders;
      totalRevenueBeforeDiscount += revenueBeforeDiscount;

      byOrganization.push({
        id: result.value.id,
        name: result.value.name,
        revenue,
        orders,
        avgCheck: orders > 0 ? revenue / orders : 0,
      });

      for (const [channel, data] of Object.entries(report.revenueByChannel || {})) {
        if (!channelMap[channel]) {
          channelMap[channel] = { revenue: 0, orders: 0, avgCheck: 0 };
        }
        channelMap[channel].revenue += Number(data.revenue) || 0;
        channelMap[channel].orders += Number(data.orders) || 0;
      }
    }

    for (const data of Object.values(channelMap)) {
      data.avgCheck = data.orders > 0 ? data.revenue / data.orders : 0;
    }

    if (targetOrgs.length === 1) {
      const orgId = targetOrgs[0].id;
      const [hourlyResult, dishesResult] = await Promise.allSettled([
        this.withTimeout(metricsService.getHourlySales({ organizationId: orgId, dateFrom: dayIso, dateTo: dayIso }), 7000),
        this.withTimeout(metricsService.getTopDishes({ organizationId: orgId, dateFrom: dayIso, dateTo: dayIso, limit: 10 }), 7000),
      ]);

      if (hourlyResult.status === "fulfilled") {
        hourlyTotals = hourlyResult.value?.hours || hourlyTotals;
      }

      if (dishesResult.status === "fulfilled") {
        topDishes = dishesResult.value?.top || [];
        outsiders = dishesResult.value?.outsiders || [];
      }
    }

    const discountSum = Math.max(0, totalRevenueBeforeDiscount - totalRevenue);
    const discountPercent = totalRevenueBeforeDiscount > 0 ? Math.round((discountSum / totalRevenueBeforeDiscount) * 10000) / 100 : 0;

    return {
      date: dayIso,
      summary: {
        totalRevenue,
        totalOrders,
        avgPerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        discountSum,
        discountPercent,
      },
      revenueByChannel: channelMap,
      byOrganization,
      hourly: hourlyTotals,
      topDishes,
      outsiders,
    };
  }
}

module.exports = new DashboardService();
