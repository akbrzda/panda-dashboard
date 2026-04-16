const axios = require("axios");
const OlapClient = require("./olapClient");
const revenueService = require("../../revenue/service");

class MetricsService extends OlapClient {
  async getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const [current, lfl] = await Promise.all([
      revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo)),
      lflDateFrom && lflDateTo
        ? revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null)
        : Promise.resolve(null),
    ]);

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

  async getHourlySales({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const pad = (n) => String(n).padStart(2, "0");

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const now = new Date();
    const isEndToday = end.toDateString() === now.toDateString();

    const startIso = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}T00:00:00Z`;
    const endIso = isEndToday
      ? `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:59Z`
      : `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T23:59:59Z`;

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hourlyTotals = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["OpenDate.Hour"],
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

    const rawRows = [];
    if (result.result?.rawData) {
      rawRows.push(...result.result.rawData);
    } else if (result.cells) {
      for (const [key, values] of Object.entries(result.cells)) {
        const group = JSON.parse(key);
        rawRows.push({
          ...group,
          Sales: parseFloat(values[0]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
        });
      }
    }

    for (const row of rawRows) {
      const hour = parseInt(row["OpenDate.Hour"] ?? row["OpenDate.HourOfDay"] ?? row.Hour ?? row.HourOfDay ?? -1, 10);
      if (hour >= 0 && hour < 24) {
        hourlyTotals[hour].revenue += Number(row.Sales) || 0;
        hourlyTotals[hour].orders += Number(row["UniqOrderId.OrdersCount"]) || 0;
      }
    }

    if (days > 1) {
      for (const slot of hourlyTotals) {
        slot.avgRevenue = Math.round((slot.revenue / days) * 100) / 100;
        slot.avgOrders = Math.round((slot.orders / days) * 100) / 100;
      }
    }

    return { hours: hourlyTotals, days };
  }

  async getCourierRoutes({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const pad = (n) => String(n).padStart(2, "0");

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const now = new Date();
    const isEndToday = end.toDateString() === now.toDateString();

    const startIso = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}T00:00:00Z`;
    const endIso = isEndToday
      ? `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:59Z`
      : `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T23:59:59Z`;

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
    const [current, lfl] = await Promise.all([
      revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo)),
      lflDateFrom && lflDateTo
        ? revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null)
        : Promise.resolve(null),
    ]);

    const currentSummary = current.summary;
    const lflSummary = lfl?.summary ?? null;
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

  async getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const [current, lfl] = await Promise.all([
      this.getFoodcostForPeriod({ organizationId, dateFrom, dateTo }),
      lflDateFrom && lflDateTo
        ? this.getFoodcostForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);

    return {
      ...current,
      lfl: calcLFL(current.percent, lfl?.percent),
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }

  async getFoodcostForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const pad = (n) => String(n).padStart(2, "0");

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const now = new Date();
    const isEndToday = end.toDateString() === now.toDateString();

    const startIso = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}T00:00:00Z`;
    const endIso = isEndToday
      ? `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:59Z`
      : `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T23:59:59Z`;

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["ProductCategory"],
        stackByDataFields: false,
        dataFields: ["Sales", "ProductCost"],
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
            name: "ProductCost",
            title: "Food cost",
            description: "Себестоимость",
            formula: "[ProductCostBase.ProductCost]",
            type: "MONEY",
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
      ProductCost: parseFloat(values[1]) || 0,
    }));

    const byCategory = {};
    let totalRevenue = 0;
    let totalCost = 0;

    for (const row of rows) {
      const category = row.ProductCategory || row.Category || "Без категории";
      const revenue = Number(row.Sales) || 0;
      const cost = Number(row.ProductCost) || 0;

      if (!byCategory[category]) {
        byCategory[category] = { name: category, revenue: 0, cost: 0 };
      }

      byCategory[category].revenue += revenue;
      byCategory[category].cost += cost;
      totalRevenue += revenue;
      totalCost += cost;
    }

    const categories = Object.values(byCategory)
      .map((item) => ({
        ...item,
        percent: item.revenue > 0 ? Math.round((item.cost / item.revenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent);

    const percent = totalRevenue > 0 ? Math.round((totalCost / totalRevenue) * 10000) / 100 : 0;
    const status = percent > 35 ? "critical" : percent >= 30 ? "warning" : "normal";

    return {
      percent,
      costSum: totalCost,
      revenue: totalRevenue,
      status,
      categories,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }

  async getTopDishes({ organizationId, dateFrom, dateTo, limit = 20 }) {
    const storeId = await this.resolveStoreId(organizationId);
    const pad = (n) => String(n).padStart(2, "0");

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const now = new Date();
    const isEndToday = end.toDateString() === now.toDateString();

    const startIso = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}T00:00:00Z`;
    const endIso = isEndToday
      ? `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:59Z`
      : `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T23:59:59Z`;

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["Dish.Name", "ProductCategory"],
        stackByDataFields: false,
        dataFields: ["Sales", "DishAmountInt", "UniqOrderId.OrdersCount"],
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
            name: "DishAmountInt",
            title: "Количество блюд",
            description: "Количество проданных порций",
            formula: "[DishAmountInt]",
            type: "NUMERIC",
            canSum: true,
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

    const rawRows = [];
    if (result.result?.rawData) {
      rawRows.push(...result.result.rawData);
    } else if (result.cells) {
      for (const [key, values] of Object.entries(result.cells)) {
        const group = JSON.parse(key);
        rawRows.push({
          ...group,
          Sales: parseFloat(values[0]) || 0,
          DishAmountInt: parseInt(values[1]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[2]) || 0,
        });
      }
    }

    const byDish = {};
    let totalRevenue = 0;
    let totalQty = 0;

    for (const row of rawRows) {
      const name = row["Dish.Name"] || row.DishName || row.Dish || "Неизвестно";
      const category = row.ProductCategory || row.Category || "";
      const revenue = Number(row.Sales) || 0;
      const qty = Number(row.DishAmountInt) || 0;

      if (!byDish[name]) byDish[name] = { name, category, revenue: 0, qty: 0 };
      byDish[name].revenue += revenue;
      byDish[name].qty += qty;
      byDish[name].category = category || byDish[name].category;
      totalRevenue += revenue;
      totalQty += qty;
    }

    const dishes = Object.values(byDish).map((dish) => ({
      ...dish,
      avgPrice: dish.qty > 0 ? Math.round((dish.revenue / dish.qty) * 100) / 100 : 0,
      revenueShare: totalRevenue > 0 ? Math.round((dish.revenue / totalRevenue) * 10000) / 100 : 0,
    }));

    dishes.sort((a, b) => b.revenue - a.revenue);

    const top = dishes.slice(0, limit);
    const withQty = dishes.filter((dish) => dish.qty > 0);
    const outsiders = withQty.slice(-Math.min(limit, withQty.length)).reverse();

    return {
      top,
      outsiders,
      total: dishes.length,
      totalRevenue,
      totalQty,
    };
  }

  async getClients({ dateFrom, dateTo }) {
    const apiUrl = process.env.PREMIUM_BONUS_API_URL;
    const apiKey = process.env.PREMIUM_BONUS_API_KEY;

    if (!apiUrl || !apiKey) {
      return { configured: false, activeBase: null, newClients: null, groups: [] };
    }

    const headers = {
      Authorization: `ApiToken ${apiKey}`,
      "Content-Type": "application/json",
    };

    try {
      const groupsResp = await axios.post(`${apiUrl}/buyer-groups`, {}, { headers }).catch((error) => {
        console.error("❌ PremiumBonus /buyer-groups error:", error.response?.data || error.message);
        return null;
      });

      const groups = groupsResp?.data?.list || groupsResp?.data?.groups || [];
      const activeBase = groups.reduce((sum, group) => sum + (Number(group.count) || Number(group.members_count) || 0), 0);

      return {
        configured: true,
        activeBase: activeBase || null,
        newClients: null,
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name || group.title,
          count: Number(group.count) || Number(group.members_count) || 0,
        })),
      };
    } catch (error) {
      console.error("❌ PremiumBonus API error:", error.message);
      return { configured: true, activeBase: null, newClients: null, groups: [], error: error.message };
    }
  }
}

module.exports = new MetricsService();
