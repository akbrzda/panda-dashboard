const OlapClient = require("../shared/olapClient");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class TopDishesService extends OlapClient {
  constructor() {
    super();
    this.cacheTtlMs = Number(process.env.IIKO_TOP_DISHES_CACHE_TTL_MS || 120000);
    this.maxAttemptsTopDishes = Number(process.env.IIKO_TOP_DISHES_MAX_ATTEMPTS || 8);
    this.fetchTimeoutMs = Number(process.env.IIKO_TOP_DISHES_FETCH_TIMEOUT_MS || 3000);
    this.reportCache = new Map();
  }

  getCacheKey(storeId, dateFrom, dateTo, limit) {
    return `${storeId}:${dateFrom}:${dateTo}:${limit}`;
  }

  buildEmptyResponse(warningMessage = "IIKO отвечает слишком долго, показаны неполные данные") {
    return {
      top: [],
      outsiders: [],
      total: 0,
      totalRevenue: 0,
      totalQty: 0,
      degraded: true,
      warningMessage,
    };
  }

  parseRows(result) {
    return this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      DishAmountInt: parseInt(values[1]) || 0,
      "UniqOrderId.OrdersCount": parseInt(values[2]) || 0,
    }));
  }

  buildResponseFromRows(rawRows, limit, degraded = false, warningMessage = null) {
    const byDish = {};
    let totalRevenue = 0;
    let totalQty = 0;

    for (const row of rawRows) {
      const name = row.DishName || row["Dish.Name"] || row.Dish || "Неизвестно";
      const category = row.DishCategory || row["DishCategory.Accounting"] || row.ProductCategory || row.Category || "";
      const revenue = Number(row.Sales) || 0;
      const qty = Number(row.DishAmountInt) || 0;

      if (!byDish[name]) {
        byDish[name] = { name, category, revenue: 0, qty: 0 };
      }

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
      degraded,
      warningMessage,
    };
  }

  async getTopDishes({ organizationId, dateFrom, dateTo, limit = 20 }) {
    const storeId = await this.resolveStoreId(organizationId);
    const cacheKey = this.getCacheKey(storeId, dateFrom, dateTo, limit);
    const cachedReport = this.reportCache.get(cacheKey);

    if (cachedReport && cachedReport.expiresAt > Date.now()) {
      console.log(`⚡ Top dishes cache hit ${dateFrom} — ${dateTo} (store ${storeId})`);
      return cachedReport.data;
    }

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const data = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["DishName", "DishCategory", "UniqOrderId.Id", "OrderDeleted", "Storned", "DeletedWithWriteoff", "Delivery.CancelCause"],
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
        includeVoidTransactions: true,
        includeNonBusinessPaymentTypes: true,
      };

      try {
        const result = await this.pollOlap(client, delay, body, {
          maxAttempts: this.maxAttemptsTopDishes,
          fetchTimeoutMs: this.fetchTimeoutMs,
          logEvery: 10,
        });

        const rows = this.parseRows(result);
        const filteredResult = this.filterCanceledOrders(rows);

        return this.buildResponseFromRows(filteredResult.rows, limit, false, null);
      } catch (error) {
        console.warn("⚠️ Top dishes отработал в деградированном режиме:", {
          storeId,
          dateFrom,
          dateTo,
          message: error?.message,
        });

        return this.buildEmptyResponse("Топ блюд временно недоступен из-за медленного ответа IIKO");
      }
    });

    this.reportCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return data;
  }
}

module.exports = new TopDishesService();
