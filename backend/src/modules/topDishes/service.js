const OlapClient = require("../shared/olapClient");
const organizationsService = require("../organizations/service");
const { TTLCache } = require("../shared/cache");
const fileLogger = require("../../utils/fileLogger");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class TopDishesService extends OlapClient {
  constructor() {
    super({
      resolveOrganizations: () => organizationsService.getOrganizations(),
    });
    this.cacheTtlMs = Number(process.env.IIKO_TOP_DISHES_CACHE_TTL_MS || 120000);
    this.maxAttemptsTopDishes = Number(process.env.IIKO_TOP_DISHES_MAX_ATTEMPTS || this.maxAttempts || 120);
    this.fetchTimeoutMs = Number(process.env.IIKO_TOP_DISHES_FETCH_TIMEOUT_MS || this.timeout || 30000);
    this.reportCache = new TTLCache(this.cacheTtlMs);
    this.datasetCache = new TTLCache(this.cacheTtlMs);
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

  buildEmptyDataset(warningMessage = "IIKO отвечает слишком долго, показаны неполные данные") {
    return {
      dishes: [],
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

  buildDishesStats(rawRows) {
    const byDish = {};
    let totalRevenue = 0;
    let totalQty = 0;

    for (const row of rawRows) {
      const name = row.DishName || row["Dish.Name"] || row.Dish || "Неизвестно";
      const entityId = String(row.entityId || row["Dish.Id"] || row.DishId || row["Product.Id"] || row.ProductId || "").trim();
      const category = row.DishCategory || row["DishCategory.Accounting"] || row.ProductCategory || row.Category || "";
      const revenue = Number(row.Sales) || 0;
      const qty = Number(row.DishAmountInt) || 0;
      const key = entityId || name;

      if (!byDish[key]) {
        byDish[key] = { name, entityId: entityId || null, category, revenue: 0, qty: 0 };
      }

      byDish[key].revenue += revenue;
      byDish[key].qty += qty;
      byDish[key].category = category || byDish[key].category;
      byDish[key].entityId = byDish[key].entityId || entityId || null;
      totalRevenue += revenue;
      totalQty += qty;
    }

    const dishes = Object.values(byDish).map((dish) => ({
      ...dish,
      avgPrice: dish.qty > 0 ? Math.round((dish.revenue / dish.qty) * 100) / 100 : 0,
      revenueShare: totalRevenue > 0 ? Math.round((dish.revenue / totalRevenue) * 10000) / 100 : 0,
    }));

    dishes.sort((a, b) => b.revenue - a.revenue);

    return {
      dishes,
      totalRevenue,
      totalQty,
    };
  }

  buildResponseFromRows(rawRows, limit, degraded = false, warningMessage = null) {
    const { dishes, totalRevenue, totalQty } = this.buildDishesStats(rawRows);
    return this.buildResponseFromDishes(dishes, totalRevenue, totalQty, limit, degraded, warningMessage);
  }

  buildResponseFromDishes(dishes, totalRevenue, totalQty, limit, degraded = false, warningMessage = null) {
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

  getDatasetCacheKey(storeId, dateFrom, dateTo) {
    return `${storeId}:${dateFrom}:${dateTo}`;
  }

  async getDishesDataset({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const cacheKey = this.getDatasetCacheKey(storeId, dateFrom, dateTo);
    const cachedDataset = this.datasetCache.get(cacheKey);

    if (cachedDataset) {
      fileLogger.info("Top dishes dataset cache hit", {
        storeId,
        dateFrom,
        dateTo,
      });
      return cachedDataset;
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
        return {
          ...this.buildDishesStats(filteredResult.rows),
          degraded: false,
          warningMessage: null,
        };
      } catch (error) {
        fileLogger.error("Не удалось загрузить основной отчет по топу блюд", {
          storeId,
          dateFrom,
          dateTo,
          message: error?.message,
        });

        throw error;
      }
    });

    this.datasetCache.set(cacheKey, data, this.cacheTtlMs);

    return data;
  }

  // ABC-анализ по принципу Парето: классифицирует товар по группе на основе доли выручки
  // Входные данные должны быть отсортированы по выручке (от большей к меньшей)
  classifyProductByAbcShare(revenueShareUpToThisProduct) {
    // Группа A: 20% товаров = 80% выручки (продукты, которые в сумме дали 0-80% выручки)
    if (revenueShareUpToThisProduct <= 0.8) return "A";
    // Группа B: 30% товаров = 15% выручки (продукты, которые в сумме дали 80-95% выручки)
    if (revenueShareUpToThisProduct <= 0.95) return "B";
    // Группа C: 50% товаров = 5% выручки (оставшиеся продукты, 95-100% выручки)
    return "C";
  }

  normalizeAbcGroup(value) {
    const normalized = String(value || "all")
      .trim()
      .toUpperCase();
    if (["A", "B", "C"].includes(normalized)) return normalized;
    return "all";
  }

  normalizePage(value) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  normalizeLimit(value) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return 50;
    return Math.min(parsed, 200);
  }

  buildAbcReportFromDishes(dataset, options = {}) {
    const abcGroup = this.normalizeAbcGroup(options.abcGroup);
    const page = this.normalizePage(options.page);
    const limit = this.normalizeLimit(options.limit);
    const dishes = Array.isArray(dataset?.dishes) ? dataset.dishes : [];
    const totalRevenue = Number(dataset?.totalRevenue || 0);
    const summary = {
      totalRevenue,
      groupARevenue: 0,
      groupAShare: 0,
      countA: 0,
      countB: 0,
      countC: 0,
    };

    // Вычисляем ABC-классификацию для каждого товара
    // Товары уже отсортированы по выручке (от большей к меньшей)
    let revenueAccumulatedSoFar = 0;
    const items = dishes.map((dish) => {
      const revenue = Number(dish.revenue || 0);
      revenueAccumulatedSoFar += revenue;
      const revenueShareOfThisDish = totalRevenue > 0 ? revenue / totalRevenue : 0;
      const shareOfRevenueUpToThisProduct = totalRevenue > 0 ? revenueAccumulatedSoFar / totalRevenue : 0;
      const abcGroup = this.classifyProductByAbcShare(shareOfRevenueUpToThisProduct);

      if (abcGroup === "A") {
        summary.countA += 1;
        summary.groupARevenue += revenue;
      } else if (abcGroup === "B") {
        summary.countB += 1;
      } else {
        summary.countC += 1;
      }

      return {
        id: dish.name,
        name: dish.name,
        category: dish.category || "Без категории",
        salesCount: Number(dish.qty || 0),
        revenue,
        revenueShare: Number(revenueShareOfThisDish.toFixed(6)), // доля выручки этого товара от общей
        revenueShareUpToThisProduct: Number(shareOfRevenueUpToThisProduct.toFixed(6)), // накопленная доля до текущего товара включительно
        abcGroup,
      };
    });

    summary.groupAShare = totalRevenue > 0 ? Number((summary.groupARevenue / totalRevenue).toFixed(6)) : 0;

    const filteredItems = abcGroup === "all" ? items : items.filter((item) => item.abcGroup === abcGroup);
    const total = items.length;
    const filteredTotal = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    return {
      summary,
      items: paginatedItems,
      pagination: {
        page: safePage,
        limit,
        total,
        filteredTotal,
        totalPages,
      },
      filters: {
        abcGroup,
      },
      degraded: Boolean(dataset?.degraded),
      warningMessage: dataset?.warningMessage || null,
    };
  }

  async getMenuAbc({ organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50 }) {
    const dataset = await this.getDishesDataset({ organizationId, dateFrom, dateTo });
    return this.buildAbcReportFromDishes(dataset, { abcGroup, page, limit });
  }

  async getTopDishes({ organizationId, dateFrom, dateTo, limit = 20 }) {
    const storeId = await this.resolveStoreId(organizationId);
    const cacheKey = this.getCacheKey(storeId, dateFrom, dateTo, limit);
    const cachedReport = this.reportCache.get(cacheKey);

    if (cachedReport) {
      fileLogger.info("Top dishes cache hit", {
        storeId,
        dateFrom,
        dateTo,
      });
      return cachedReport;
    }

    const dataset = await this.getDishesDataset({ organizationId, dateFrom, dateTo });
    const data = this.buildResponseFromDishes(
      dataset.dishes || [],
      Number(dataset.totalRevenue || 0),
      Number(dataset.totalQty || 0),
      limit,
      Boolean(dataset.degraded),
      dataset.warningMessage || null,
    );

    this.reportCache.set(cacheKey, data, this.cacheTtlMs);

    return data;
  }
}

module.exports = new TopDishesService();
