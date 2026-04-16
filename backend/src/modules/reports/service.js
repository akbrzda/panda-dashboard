const OlapClient = require("../shared/olapClient");
const revenueService = require("../revenue/service");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class ReportsService extends OlapClient {
  roundMetric(value, digits = 2) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    const factor = 10 ** digits;
    return Math.round(numericValue * factor) / factor;
  }

  parseDateTime(value) {
    if (!value) {
      return null;
    }

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  isDeliveryOrder(row = {}) {
    const courierId = String(row["Delivery.Courier.Id"] || "").trim();
    const orderType = String(row.OrderType || "").toLowerCase();

    return Boolean(courierId) || orderType.includes("достав") || orderType.includes("яндекс");
  }

  async getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: [
          "OrderType",
          "UniqOrderId.Id",
          "OrderDeleted",
          "Storned",
          "DeletedWithWriteoff",
          "Delivery.CancelCause",
          "Delivery.Courier.Id",
          "Delivery.Courier",
          "Delivery.SendTime",
          "Delivery.CloseTime",
          "OpenTime",
          "Delivery.CookingFinishTime",
          "Delivery.WayDuration",
          "OrderTime.OrderLength",
        ],
        stackByDataFields: false,
        dataFields: ["Sales", "UniqOrderId.OrdersCount", "AverageOrderTime"],
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
          {
            name: "AverageOrderTime",
            title: "Average Order Time",
            description: "Average order duration",
            formula: "[OrderTime.AverageOrderTime]",
            type: "NUMERIC",
            canSum: false,
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
        includeVoidTransactions: true,
        includeNonBusinessPaymentTypes: true,
      };

      return await this.pollOlap(client, delay, body, {
        maxAttempts: this.maxAttempts,
        fetchTimeoutMs: this.timeout,
        logEvery: 10,
      });
    });

    const rows = this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
      AverageOrderTime: parseFloat(values[2]) || 0,
    }));

    return this.filterCanceledOrders(rows).rows;
  }

  buildRouteStats(rows = []) {
    const routeMergeWindowMs = 5 * 60 * 1000;
    const groupedByCourier = new Map();

    for (const row of rows) {
      if (!this.isDeliveryOrder(row)) {
        continue;
      }

      const courierId = String(row["Delivery.Courier.Id"] || "").trim();
      if (!courierId) {
        continue;
      }

      if (!groupedByCourier.has(courierId)) {
        groupedByCourier.set(courierId, []);
      }

      groupedByCourier.get(courierId).push(row);
    }

    const routes = [];

    for (const [courierId, courierRows] of groupedByCourier.entries()) {
      const sortedRows = [...courierRows].sort((left, right) => {
        return (this.parseDateTime(left["Delivery.SendTime"]) || 0) - (this.parseDateTime(right["Delivery.SendTime"]) || 0);
      });

      let currentRoute = null;

      for (const row of sortedRows) {
        const sendAt = this.parseDateTime(row["Delivery.SendTime"]) || this.parseDateTime(row.OpenTime) || 0;
        const closeAt = this.parseDateTime(row["Delivery.CloseTime"]) || sendAt;
        const orderId = String(row["UniqOrderId.Id"] || "").trim();

        if (!currentRoute || sendAt > currentRoute.endAt + routeMergeWindowMs) {
          currentRoute = {
            courierId,
            courierName: row["Delivery.Courier"] || "Неизвестный курьер",
            endAt: closeAt,
            orders: new Set(orderId ? [orderId] : []),
          };
          routes.push(currentRoute);
          continue;
        }

        currentRoute.endAt = Math.max(currentRoute.endAt, closeAt);
        if (orderId) {
          currentRoute.orders.add(orderId);
        }
      }
    }

    const buckets = [
      { label: "1 заказ в маршруте", min: 1, max: 1 },
      { label: "2 заказа в маршруте", min: 2, max: 2 },
      { label: "3+ заказа в маршруте", min: 3, max: Infinity },
    ];

    const totalRoutes = routes.length;
    const totalOrdersInRoutes = routes.reduce((sum, route) => sum + route.orders.size, 0);

    const distribution = buckets.map((bucket) => {
      const matchedRoutes = routes.filter((route) => route.orders.size >= bucket.min && route.orders.size <= bucket.max);
      const routeCount = matchedRoutes.length;
      const ordersCount = matchedRoutes.reduce((sum, route) => sum + route.orders.size, 0);

      return {
        label: bucket.label,
        count: routeCount,
        routeCount,
        ordersCount,
        percent: totalRoutes > 0 ? this.roundMetric((routeCount / totalRoutes) * 100) : 0,
      };
    });

    return {
      totalCouriers: groupedByCourier.size,
      totalRoutes,
      totalOrdersInRoutes,
      distribution,
    };
  }

  buildOperationalSummary(rows = []) {
    const ordersMap = new Map();
    const deliveryTimes = [];
    const cookingTimes = [];

    rows.forEach((row, index) => {
      const orderId = String(row["UniqOrderId.Id"] || `row-${index}`);

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          ...row,
          Sales: 0,
        });
      }

      const order = ordersMap.get(orderId);
      order.Sales += Number(row.Sales) || 0;
    });

    let totalRevenue = 0;
    let totalOrders = 0;

    for (const row of ordersMap.values()) {
      totalRevenue += Number(row.Sales) || 0;
      totalOrders += 1;

      const wayDuration = Number(row["Delivery.WayDuration"]) || 0;
      const averageOrderTime = Number(row.AverageOrderTime || row["OrderTime.AverageOrderTime"]) || 0;
      const orderLength = Number(row["OrderTime.OrderLength"]) || 0;
      const cookingFinishTime = this.parseDateTime(row["Delivery.CookingFinishTime"]);
      const openTime = this.parseDateTime(row.OpenTime);
      const deliveryDuration = averageOrderTime > 0 ? averageOrderTime : wayDuration;

      if (this.isDeliveryOrder(row) && deliveryDuration > 0) {
        deliveryTimes.push(deliveryDuration);
      }

      let cookingTime = null;

      if (openTime && cookingFinishTime && cookingFinishTime >= openTime) {
        cookingTime = (cookingFinishTime - openTime) / (1000 * 60);
      } else if (orderLength > 0) {
        cookingTime = Math.max(orderLength - Math.max(wayDuration, 0), 0);
      }

      if (cookingTime && cookingTime > 0) {
        cookingTimes.push(cookingTime);
      }
    }

    const avgDeliveryTime =
      deliveryTimes.length > 0 ? this.roundMetric(deliveryTimes.reduce((sum, value) => sum + value, 0) / deliveryTimes.length) : 0;
    const avgCookingTime = cookingTimes.length > 0 ? this.roundMetric(cookingTimes.reduce((sum, value) => sum + value, 0) / cookingTimes.length) : 0;

    return {
      totalRevenue,
      totalOrders,
      avgPerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      avgDeliveryTime,
      avgCookingTime,
    };
  }

  async getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo }) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const rows = await this.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo });
    const summary = this.buildOperationalSummary(rows);

    return {
      ...summary,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }

  async getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const [current, currentSummary] = await Promise.all([
      revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo)),
      this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo }).catch(() => null),
    ]);

    let lfl = null;
    let lflSummary = null;
    if (lflDateFrom && lflDateTo) {
      [lfl, lflSummary] = await Promise.all([
        revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null),
        this.getRevenueSummaryForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null),
      ]);
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
    const calculateMetricLFL = (currentValue, previousValue) =>
      currentValue != null && previousValue != null && previousValue > 0
        ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100
        : null;

    return {
      ...current,
      summary: {
        ...current.summary,
        avgPerOrder: currentSummary?.avgPerOrder ?? current.summary.avgPerOrder,
        avgDeliveryTime: currentSummary?.avgDeliveryTime ?? current.summary.avgDeliveryTime,
        avgCookingTime: currentSummary?.avgCookingTime ?? current.summary.avgCookingTime,
        lfl: revenueLFL,
        ordersLFL,
        avgDeliveryTimeLFL: lflSummary ? calculateMetricLFL(currentSummary?.avgDeliveryTime, lflSummary?.avgDeliveryTime) : null,
        avgCookingTimeLFL: lflSummary ? calculateMetricLFL(currentSummary?.avgCookingTime, lflSummary?.avgCookingTime) : null,
        lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
      },
      revenueByChannel: channelsWithLFL,
    };
  }

  async getCourierRoutes({ organizationId, dateFrom, dateTo }) {
    const rows = await this.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo });
    return this.buildRouteStats(rows);
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
