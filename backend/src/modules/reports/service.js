const OlapClient = require("../shared/olapClient");
const revenueService = require("../revenue/service");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class ReportsService extends OlapClient {
  async getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["OrderType"],
        stackByDataFields: false,
        dataFields: ["Sales", "UniqOrderId.OrdersCount"],
        calculatedFields: [
          {
            name: "Sales",
            title: "Sales",
            description: "Net sales",
            formula: "[DishDiscountSumInt.withoutVAT]",
            type: "MONEY",
            canSum: false,
          },
          {
            name: "UniqOrderId.OrdersCount",
            title: "Orders Count",
            description: "Number of unique orders",
            formula: "[UniqOrderId.OrdersCount]",
            type: "NUMERIC",
            canSum: true,
          },
        ],
        filters: [
          {
            field: "OpenDate.Typed",
            filterType: "date_range",
            dateFrom: startIso,
            dateTo: endIso,
            valueMin: null,
            valueMax: null,
            valueList: [],
            includeLeft: true,
            includeRight: false,
            inclusiveList: true,
          },
        ],
        includeVoidTransactions: false,
        includeNonBusinessPaymentTypes: false,
      };
      return await this.pollOlap(client, delay, body);
    });

    const rows = this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
    }));

    let totalRevenue = 0;
    let totalOrders = 0;

    for (const row of rows) {
      totalRevenue += Number(row.Sales) || 0;
      totalOrders += Number(row["UniqOrderId.OrdersCount"]) || 0;
    }

    return {
      totalRevenue,
      totalOrders,
      avgPerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }

  async getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const current = await revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo));

    let lfl = null;
    if (lflDateFrom && lflDateTo) {
      lfl = await revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null);
    }

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

    return {
      ...current,
      summary: {
        ...current.summary,
        lfl: revenueLFL,
        ordersLFL,
        lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
      },
      revenueByChannel: channelsWithLFL,
    };
  }

  async getCourierRoutes({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["Delivery.Courier.Id", "Delivery.Courier"],
        stackByDataFields: false,
        dataFields: ["UniqOrderId.OrdersCount"],
        calculatedFields: [
          {
            name: "UniqOrderId.OrdersCount",
            title: "Orders Count",
            description: "Number of unique orders",
            formula: "[UniqOrderId.OrdersCount]",
            type: "NUMERIC",
            canSum: true,
          },
        ],
        filters: [
          {
            field: "OpenDate.Typed",
            filterType: "date_range",
            dateFrom: startIso,
            dateTo: endIso,
            valueMin: null,
            valueMax: null,
            valueList: [],
            includeLeft: true,
            includeRight: false,
            inclusiveList: true,
          },
        ],
        includeVoidTransactions: false,
        includeNonBusinessPaymentTypes: false,
      };
      return await this.pollOlap(client, delay, body);
    });

    const rawRows = [];
    if (result.result?.rawData) {
      rawRows.push(...result.result.rawData);
    } else if (result.cells) {
      for (const [key, values] of Object.entries(result.cells)) {
        const group = JSON.parse(key);
        rawRows.push({ ...group, "UniqOrderId.OrdersCount": parseInt(values[0]) || 0 });
      }
    }

    const couriers = {};
    for (const row of rawRows) {
      const id = row["Delivery.Courier.Id"] || row.CourierId || "";
      const name = row["Delivery.Courier"] || row.Courier || id || "Неизвестный";
      const orders = Number(row["UniqOrderId.OrdersCount"]) || 0;
      if (id) {
        couriers[id] = { name, orders: (couriers[id]?.orders || 0) + orders };
      }
    }

    const orderCounts = Object.values(couriers).map((item) => item.orders);
    const one = orderCounts.filter((count) => count === 1).length;
    const two = orderCounts.filter((count) => count === 2).length;
    const threeOrMore = orderCounts.filter((count) => count >= 3).length;
    const total = Object.keys(couriers).length;
    const toPercent = (count) => (total > 0 ? Math.round((count / total) * 10000) / 100 : 0);

    return {
      totalCouriers: total,
      distribution: [
        { label: "1 маршрут", count: one, percent: toPercent(one) },
        { label: "2 маршрута", count: two, percent: toPercent(two) },
        { label: "3+ маршрута", count: threeOrMore, percent: toPercent(threeOrMore) },
      ],
    };
  }

  async getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const current = await this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo });

    let lfl = null;
    if (lflDateFrom && lflDateTo) {
      lfl = await this.getRevenueSummaryForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null);
    }

    const currentSummary = current;
    const lflSummary = lfl ?? null;
    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);

    return {
      avgDeliveryTime: {
        value: currentSummary.avgDeliveryTime,
        lfl: calcLFL(currentSummary.avgDeliveryTime, lflSummary?.avgDeliveryTime),
      },
      avgCookingTime: {
        value: currentSummary.avgCookingTime,
        lfl: calcLFL(currentSummary.avgCookingTime, lflSummary?.avgCookingTime),
      },
      avgPerOrder: {
        value: currentSummary.avgPerOrder,
        lfl: calcLFL(currentSummary.avgPerOrder, lflSummary?.avgPerOrder),
      },
      period: current.period,
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }
}

module.exports = new ReportsService();
