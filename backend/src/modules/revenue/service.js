const OlapClient = require("../shared/olapClient");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class RevenueService extends OlapClient {
  constructor() {
    super();
    this.timeout = Number(process.env.IIKO_OLAP_TIMEOUT_MS || this.timeout || 30000);
    this.pollInterval = Number(process.env.IIKO_OLAP_POLL_INTERVAL_MS || this.pollInterval || 500);
    this.maxAttempts = Number(process.env.IIKO_OLAP_MAX_ATTEMPTS || this.maxAttempts || 120);
    this.cacheTtlMs = Number(process.env.IIKO_REVENUE_CACHE_TTL_MS || 120000);
    this.reportCache = new Map();

    console.log(`📊 RevenueService initialized with baseUrl: ${this.baseUrl}`);
  }

  async _resolveStoreId(organizationId) {
    return await this.resolveStoreId(organizationId);
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

  async getRevenueReport(organizationId, startDate, endDate) {
    const startTime = Date.now();
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const storeId = await this._resolveStoreId(organizationId);
    const startDateStr = start.toISOString().split("T")[0];
    const endDateStr = end.toISOString().split("T")[0];
    const cacheKey = `${storeId}:${startDateStr}:${endDateStr}`;
    const cacheEntry = this.reportCache.get(cacheKey);

    if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
      console.log(`⚡ Revenue cache hit ${startDateStr} → ${endDateStr} (store ${storeId})`);
      return cacheEntry.data;
    }

    console.log(`📊 [${new Date().toISOString()}] Fetching revenue report for org ${organizationId}, ${startDateStr} → ${endDateStr}`);

    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));
    const isSingleDay = startDateStr === endDateStr;
    const primaryGroupFields = isSingleDay ? ["OrderType"] : ["OpenDate.Date", "OrderType"];

    let rows = [];
    try {
      rows = await this._fetchOlapSales(storeId, startIso, endIso, primaryGroupFields);
    } catch (error) {
      if (primaryGroupFields.length > 1) {
        console.warn("⚠️ Revenue OLAP fallback на упрощенную группировку:", error.message);
        rows = await this._fetchOlapSales(storeId, startIso, endIso, ["OrderType"]);
      } else {
        throw error;
      }
    }

    const byDate = {};
    const revenueByChannelRaw = {};
    const ordersByChannelRaw = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalRevenueBeforeDiscount = 0;

    for (const row of rows) {
      const date =
        row["OpenDate.Date"] ||
        (row["OpenDate.Typed"] ? String(row["OpenDate.Typed"]).slice(0, 10) : null) ||
        row.Date ||
        (isSingleDay ? startDateStr : "");
      const orderType = row.OrderType || "Unknown";
      const sales = Number(row.Sales) || 0;
      const orders = Number(row["UniqOrderId.OrdersCount"]) || 0;
      const revenueWD = Number(row.RevenueWithoutDiscount) || 0;

      if (date) {
        if (!byDate[date]) byDate[date] = { revenue: 0, orders: 0 };
        byDate[date].revenue += sales;
        byDate[date].orders += orders;
      }

      revenueByChannelRaw[orderType] = (revenueByChannelRaw[orderType] || 0) + sales;
      ordersByChannelRaw[orderType] = (ordersByChannelRaw[orderType] || 0) + orders;
      totalRevenue += sales;
      totalOrders += orders;
      totalRevenueBeforeDiscount += revenueWD;
    }

    const computedDiscountSum = Math.max(0, totalRevenueBeforeDiscount - totalRevenue);
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
    console.log(`✅ Отчёт за ${days} дн. завершён за ${duration}с — выручка: ${totalRevenue.toFixed(2)} ₽ (${rows.length} строк)`);

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
      },
      revenueByChannel,
      dailyBreakdown,
    };

    this.reportCache.set(cacheKey, {
      data: report,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return report;
  }

  async getDailyRevenue(organizationId, date) {
    return await this.getRevenueReport(organizationId, date, date);
  }

  async _fetchOlapSales(storeId, dateFrom, dateTo, groupFields = ["OrderType"]) {
    console.log(`   🔑 Revenue OLAP [${groupFields.join(", ")}] ${dateFrom.slice(0, 10)} → ${dateTo.slice(0, 10)}`);

    return await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields,
        stackByDataFields: false,
        dataFields: ["Sales", "UniqOrderId.OrdersCount", "RevenueWithoutDiscount"],
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
        includeVoidTransactions: false,
        includeNonBusinessPaymentTypes: false,
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
      }));

      console.log(`   ✅ OLAP вернул ${rows.length} строк`);
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
