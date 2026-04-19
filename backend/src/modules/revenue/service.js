const OlapClient = require("../shared/olapClient");
const organizationsService = require("../organizations/service");
const { TTLCache } = require("../shared/cache");
const fileLogger = require("../../utils/fileLogger");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class RevenueService {
  constructor({ iikoClient = null, cache = null, storeResolver = null } = {}) {
    this.client =
      iikoClient ||
      new OlapClient({
        resolveOrganizations: () => organizationsService.getOrganizations(),
        resolveStoreId: storeResolver || undefined,
      });

    this.timeout = Number(process.env.IIKO_OLAP_TIMEOUT_MS || this.client.timeout || 30000);
    this.pollInterval = Number(process.env.IIKO_OLAP_POLL_INTERVAL_MS || this.client.pollInterval || 500);
    this.maxAttempts = Number(process.env.IIKO_OLAP_MAX_ATTEMPTS || this.client.maxAttempts || 120);
    this.cacheTtlMs = Number(process.env.IIKO_REVENUE_CACHE_TTL_MS || 120000);
    this.reportCache = cache || new TTLCache(this.cacheTtlMs);

    this.client.timeout = this.timeout;
    this.client.pollInterval = this.pollInterval;
    this.client.maxAttempts = this.maxAttempts;

    fileLogger.info("RevenueService инициализирован", {
      serverBaseUrl: this.client.serverBaseUrl,
    });
  }

  async withAuth(...args) {
    return await this.client.withAuth(...args);
  }

  async resolveStoreId(...args) {
    return await this.client.resolveStoreId(...args);
  }

  async pollOlap(...args) {
    return await this.client.pollOlap(...args);
  }

  parseResultRows(...args) {
    return this.client.parseResultRows(...args);
  }

  filterCanceledOrders(...args) {
    return this.client.filterCanceledOrders(...args);
  }

  async _resolveStoreId(organizationId) {
    return await this.resolveStoreId(organizationId);
  }

  async _resolveOrganizationTimezone(organizationId) {
    try {
      const organizations = await organizationsService.getOrganizations();
      const organization = organizations.find((item) => String(item.id) === String(organizationId));
      return String(organization?.timezone || "Europe/Moscow");
    } catch (_) {
      return "Europe/Moscow";
    }
  }

  _normalizeChannelName(channel) {
    const source = String(channel || "").trim();
    const normalizedSource = source.toLowerCase();

    if (normalizedSource.includes("яндекс")) {
      return "Яндекс.Еда";
    }

    if (
      normalizedSource.includes("самовывоз") ||
      normalizedSource.includes("самовынос") ||
      normalizedSource.includes("с собой") ||
      normalizedSource.includes("доставка самовывоз")
    ) {
      return "Самовынос";
    }

    if (normalizedSource.includes("достав") || normalizedSource.includes("курьер")) {
      return "Доставка";
    }

    return "Зал";
  }

  _normalizeOrdersByChannel(ordersByChannel) {
    const normalized = {};

    for (const [channel, count] of Object.entries(ordersByChannel || {})) {
      const normalizedChannel = this._normalizeChannelName(channel);
      normalized[normalizedChannel] = (normalized[normalizedChannel] || 0) + Number(count || 0);
    }

    return normalized;
  }

  _normalizePaymentTypeName(paymentType) {
    const source = String(paymentType || "").trim();
    const normalized = source.toLowerCase();

    if (!source || normalized.includes("без оплаты")) {
      return null;
    }

    if (normalized.includes("яндекс")) {
      return "Яндекс.Еда";
    }

    if (normalized.includes("нал")) {
      return "Наличные";
    }

    if (
      normalized.includes("карт") ||
      normalized.includes("bank") ||
      normalized.includes("банк") ||
      normalized.includes("киоск") ||
      normalized.includes("эквайр") ||
      normalized.includes("терминал") ||
      normalized.includes("курьер")
    ) {
      return "Карта";
    }

    return "Онлайн оплата";
  }

  async getRevenueReport(organizationId, startDate, endDate) {
    const startTime = Date.now();
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const timezone = await this._resolveOrganizationTimezone(organizationId);
    const storeId = await this._resolveStoreId(organizationId);
    const startDateStr = toMoscowDateStr(start, timezone);
    const endDateStr = toMoscowDateStr(end, timezone);
    const cacheKey = `${storeId}:${startDateStr}:${endDateStr}`;
    const cachedReport = this.reportCache.get(cacheKey);

    if (cachedReport) {
      fileLogger.info("Revenue cache hit", {
        storeId,
        startDate: startDateStr,
        endDate: endDateStr,
      });
      return cachedReport;
    }

    fileLogger.info("Запрошен отчет по выручке", {
      organizationId,
      storeId,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    const { startIso, endIso } = buildOlapBounds(startDateStr, endDateStr);
    const isSingleDay = startDateStr === endDateStr;
    const primaryGroupFields = isSingleDay ? ["OrderType"] : ["OpenDate.Typed", "OrderType"];

    let rows = [];
    let orderStats = null;
    try {
      rows = await this._fetchOlapSales(storeId, startIso, endIso, primaryGroupFields);
    } catch (error) {
      if (primaryGroupFields.length > 1) {
        fileLogger.warn("Revenue OLAP переключен на упрощенную группировку", {
          storeId,
          message: error.message,
        });
        rows = await this._fetchOlapSales(storeId, startIso, endIso, ["OrderType"]);
      } else {
        throw error;
      }
    }

    const filteredResult = this.filterCanceledOrders(rows);
    rows = filteredResult.rows;
    orderStats = filteredResult.orderStats;

    let paymentByType = {};
    try {
      const paymentRows = await this._fetchOlapPaymentTypes(storeId, startIso, endIso);
      const activePaymentRows = this.filterCanceledOrders(paymentRows).rows;

      const groupedPaymentTypes = activePaymentRows.reduce((acc, row) => {
        const paymentType = this._normalizePaymentTypeName(row.PayTypes);
        const amount = Number(row.Sales) || 0;

        if (!paymentType || amount <= 0) {
          return acc;
        }

        if (!acc[paymentType]) {
          acc[paymentType] = { revenue: 0 };
        }

        acc[paymentType].revenue += amount;
        return acc;
      }, {});

      const paymentTypeOrder = ["Онлайн оплата", "Карта", "Наличные", "Яндекс.Еда"];
      paymentByType = paymentTypeOrder.reduce((acc, key) => {
        if (groupedPaymentTypes[key]) {
          acc[key] = groupedPaymentTypes[key];
        }
        return acc;
      }, {});
    } catch (error) {
      fileLogger.warn("Не удалось получить типы оплат", {
        storeId,
        message: error.message,
      });
    }

    const byDate = {};
    const revenueByChannelRaw = {};
    const ordersByChannelRaw = {};
    const ordersMap = new Map();
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalRevenueBeforeDiscount = 0;
    let totalDiscountSum = 0;

    rows.forEach((row, index) => {
      const orderId = String(row["UniqOrderId.Id"] || `row-${index}`);
      const rawDate = row["OpenDate.Typed"] || row.OpenDate || row["OpenDate.Date"] || row.Date || (isSingleDay ? startDateStr : "");
      const date = String(rawDate || "")
        .slice(0, 10)
        .replace(/\./g, "-");
      const orderType = row.OrderType || "Unknown";
      const sales = Number(row.Sales) || 0;
      const revenueWD = Number(row.RevenueWithoutDiscount) || 0;
      const discountSum = Number(row.DiscountSum) || 0;
      const discountType = String(row.ItemSaleEventDiscountType || "").trim();

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          date,
          orderType,
          sales: 0,
          revenueWithoutDiscount: 0,
          discountSum: 0,
        });
      }

      const order = ordersMap.get(orderId);
      order.sales += sales;
      order.revenueWithoutDiscount += revenueWD;
      if (discountType) {
        order.discountSum += discountSum;
      }
      if (!order.date && date) {
        order.date = date;
      }
      if ((!order.orderType || order.orderType === "Unknown") && orderType) {
        order.orderType = orderType;
      }
    });

    for (const order of ordersMap.values()) {
      if (order.date) {
        if (!byDate[order.date]) byDate[order.date] = { revenue: 0, orders: 0 };
        byDate[order.date].revenue += order.sales;
        byDate[order.date].orders += 1;
      }

      revenueByChannelRaw[order.orderType] = (revenueByChannelRaw[order.orderType] || 0) + order.sales;
      ordersByChannelRaw[order.orderType] = (ordersByChannelRaw[order.orderType] || 0) + 1;
      totalRevenue += order.sales;
      totalOrders += 1;
      totalRevenueBeforeDiscount += order.revenueWithoutDiscount;
      totalDiscountSum += order.discountSum;
    }

    const computedDiscountSum = totalDiscountSum > 0 ? totalDiscountSum : Math.max(0, totalRevenueBeforeDiscount - totalRevenue);
    const discountPercent = totalRevenueBeforeDiscount > 0 ? Math.round((computedDiscountSum / totalRevenueBeforeDiscount) * 10000) / 100 : 0;

    const dailyBreakdown = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }));

    if (dailyBreakdown.length === 0 && isSingleDay) {
      dailyBreakdown.push({ date: startDateStr, revenue: totalRevenue, orders: totalOrders });
    }

    const normalizedChannels = this._normalizeRevenueChannels(revenueByChannelRaw);
    const normalizedOrders = this._normalizeOrdersByChannel(ordersByChannelRaw);
    const sortedChannels = this._sortChannels(normalizedChannels);

    const revenueByChannel = {};
    for (const [channel, revenue] of Object.entries(sortedChannels)) {
      const ord = normalizedOrders[channel] || 0;
      revenueByChannel[channel] = { revenue, orders: ord, avgCheck: ord > 0 ? revenue / ord : 0 };
    }

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    fileLogger.info("Отчет по выручке сформирован", {
      storeId,
      days,
      durationSec: Number(duration),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      rows: rows.length,
    });

    const report = {
      organizationId,
      period: {
        startDate: startDateStr,
        endDate: endDateStr,
        days,
      },
      summary: {
        totalRevenue,
        totalOrders,
        avgPerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        avgDeliveryTime: 0,
        avgCookingTime: 0,
        discountSum: computedDiscountSum,
        discountPercent,
        lfl: null,
        previousPeriodRevenue: null,
        orderStats,
      },
      revenueByChannel,
      paymentByType,
      dailyBreakdown,
      timezone,
    };

    this.reportCache.set(cacheKey, report, this.cacheTtlMs);

    return report;
  }

  async getDailyRevenue(organizationId, date) {
    return await this.getRevenueReport(organizationId, date, date);
  }

  async _fetchOlapPaymentTypes(storeId, dateFrom, dateTo) {
    return await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["PayTypes", "UniqOrderId.Id", "OrderDeleted", "Storned", "DeletedWithWriteoff", "Delivery.CancelCause"],
        stackByDataFields: false,
        dataFields: ["Sales"],
        calculatedFields: [
          {
            name: "Sales",
            title: "Sales",
            description: "Net sales",
            formula: "[DishDiscountSumInt.withoutVAT]",
            type: "MONEY",
            canSum: false,
          },
        ],
        filters: [
          {
            field: "OpenDate.Typed",
            filterType: "date_range",
            dateFrom,
            dateTo,
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

      const result = await this.pollOlap(client, delay, body, {
        maxAttempts: this.maxAttempts,
        fetchTimeoutMs: this.timeout,
        logEvery: 20,
      });

      return this.parseResultRows(result, (group, values) => ({
        ...group,
        Sales: parseFloat(values[0]) || 0,
      }));
    });
  }

  async _fetchOlapSales(storeId, dateFrom, dateTo, groupFields = ["OrderType"]) {
    fileLogger.debug("Выполняется Revenue OLAP запрос", {
      groupFields,
      dateFrom: dateFrom.slice(0, 10),
      dateTo: dateTo.slice(0, 10),
      storeId,
    });

    return await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: [
          ...new Set([
            ...groupFields,
            "UniqOrderId.Id",
            "OrderDeleted",
            "Storned",
            "DeletedWithWriteoff",
            "Delivery.CancelCause",
            "ItemSaleEventDiscountType",
          ]),
        ],
        stackByDataFields: false,
        dataFields: ["Sales", "UniqOrderId.OrdersCount", "RevenueWithoutDiscount", "DiscountSum"],
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
            name: "RevenueWithoutDiscount",
            title: "Revenue Before Discount",
            description: "Gross revenue before discount",
            formula: "[DishSumInt]",
            type: "MONEY",
            canSum: true,
          },
          {
            name: "DiscountSum",
            title: "Discount",
            description: "Actual discount amount",
            formula: "[DiscountSum]",
            type: "MONEY",
            canSum: true,
          },
        ],
        filters: [
          {
            field: "OpenDate.Typed",
            filterType: "date_range",
            dateFrom,
            dateTo,
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

      const result = await this.pollOlap(client, delay, body, {
        maxAttempts: this.maxAttempts,
        fetchTimeoutMs: this.timeout,
        logEvery: 20,
      });

      const rows = this.parseResultRows(result, (group, values) => ({
        ...group,
        Sales: parseFloat(values[0]) || 0,
        "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
        RevenueWithoutDiscount: parseFloat(values[2]) || 0,
        DiscountSum: parseFloat(values[3]) || 0,
      }));

      fileLogger.debug("Revenue OLAP вернул строки", {
        storeId,
        rows: rows.length,
      });
      return rows;
    });
  }

  _calculateLFL(currentRevenue, previousRevenue) {
    if (previousRevenue === 0 || previousRevenue === null || previousRevenue === undefined) {
      return null;
    }

    const percentage = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    return Math.round(percentage * 100) / 100;
  }

  _normalizeRevenueChannels(revenueByChannel) {
    const normalized = {};

    for (const [channel, amount] of Object.entries(revenueByChannel || {})) {
      const normalizedChannel = this._normalizeChannelName(channel);
      normalized[normalizedChannel] = (normalized[normalizedChannel] || 0) + Number(amount || 0);
    }

    return normalized;
  }

  _sortChannels(channels) {
    const order = ["Доставка", "Самовынос", "Зал", "Яндекс.Еда"];
    const sorted = {};

    for (const channel of order) {
      if (channels[channel] !== undefined) {
        sorted[channel] = channels[channel];
      }
    }

    const remaining = Object.entries(channels)
      .filter(([ch]) => !order.includes(ch))
      .sort(([, a], [, b]) => b - a);

    for (const [channel, amount] of remaining) {
      sorted[channel] = amount;
    }

    return sorted;
  }
}

module.exports = new RevenueService();
