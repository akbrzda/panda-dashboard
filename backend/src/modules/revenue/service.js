const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const organizationsService = require("../organizations/service");

class RevenueService {
  constructor() {
    this.baseUrl = process.env.IIKO_BASE_URL;
    this.username = process.env.IIKO_USER;
    this.password = process.env.IIKO_PASSWORD;
    this.timeout = 30000;
    this.pollInterval = 500;
    this.maxAttempts = 60;

    console.log(`📊 RevenueService initialized with baseUrl: ${this.baseUrl}`);
  }

  async _resolveStoreId(organizationId) {
    const normalizedId = String(organizationId || "");
    const organizations = await organizationsService.getOrganizations().catch(() => []);
    const organization =
      typeof organizationId === "object" && organizationId !== null
        ? organizationId
        : organizations.find((org) => String(org.id) === normalizedId || String(org.storeId) === normalizedId);

    if (organization?.storeId) {
      return String(organization.storeId);
    }

    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    throw new Error(`Не удалось получить storeId из iiko для организации ${normalizedId}`);
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

    console.log(
      `📊 [${new Date().toISOString()}] Fetching revenue report for org ${organizationId}, ${start.toISOString().split("T")[0]} → ${end.toISOString().split("T")[0]}`,
    );

    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const isEndToday = end.toDateString() === now.toDateString();

    const startIso = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}T00:00:00Z`;
    const endIso = isEndToday
      ? `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:59Z`
      : `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T23:59:59Z`;

    const rows = await this._fetchOlapSales(storeId, startIso, endIso, ["OpenDate.Date", "OrderType"]);

    const byDate = {};
    const revenueByChannelRaw = {};
    const ordersByChannelRaw = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalRevenueBeforeDiscount = 0;

    for (const row of rows) {
      const date = row["OpenDate.Date"] || (row["OpenDate.Typed"] ? String(row["OpenDate.Typed"]).slice(0, 10) : null) || row.Date || "";
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

    return {
      organizationId,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
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
  }

  async getDailyRevenue(organizationId, date) {
    return await this.getRevenueReport(organizationId, date, date);
  }

  async _fetchOlapSales(storeId, dateFrom, dateTo, groupFields = ["OrderType"]) {
    const jar = new CookieJar();
    const client = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: { "Content-Type": "application/json" },
        jar,
        withCredentials: true,
      }),
    );
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    console.log(`   🔑 Login → OLAP [${groupFields.join(", ")}] ${dateFrom.slice(0, 10)} → ${dateTo.slice(0, 10)}`);

    await client.post("/api/auth/login", { login: this.username, password: this.password });
    const selectResponse = await client.post(`/api/stores/select/${storeId}`);

    if (selectResponse.data?.error) {
      throw new Error(selectResponse.data?.errorMessage || `IIKO отказал в доступе к store ${storeId}`);
    }

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

    let initResp;

    try {
      initResp = await client.post("/api/olap/init", body);
    } catch (error) {
      const status = error.response?.status;

      if ([500, 502, 504].includes(status)) {
        console.warn("⚠️ Revenue OLAP init временно недоступен:", error.response?.data?.detail || error.message);
        return [];
      }

      throw error;
    }

    const fetchId = initResp.data?.data;
    if (!fetchId) return [];

    let data = null;
    for (let i = 0; i < this.maxAttempts; i++) {
      try {
        const resp = await client.get(`/api/olap/fetch/${fetchId}/sales`);
        const d = resp.data;
        if (d && (d.cells || d.result?.rawData)) {
          data = d;
          break;
        }
      } catch (e) {
        const status = e.response?.status;

        if (status === 400) {
          await delay(this.pollInterval);
          continue;
        }

        if ([500, 502, 504].includes(status)) {
          console.warn("⚠️ Revenue OLAP fetch временно недоступен:", e.response?.data?.detail || e.message);
          return [];
        }

        throw e;
      }
      await delay(this.pollInterval);
    }

    try {
      await client.post("/api/auth/logout");
    } catch (_) {}

    if (!data) {
      console.warn("⚠️ Revenue OLAP не успел ответить, возвращаю пустой результат");
      return [];
    }

    const rows = [];
    if (data.result?.rawData) {
      rows.push(...data.result.rawData);
    } else if (data.cells) {
      for (const [key, values] of Object.entries(data.cells)) {
        const g = JSON.parse(key);
        rows.push({
          ...g,
          Sales: parseFloat(values[0]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
          RevenueWithoutDiscount: parseFloat(values[2]) || 0,
        });
      }
    }

    console.log(`   ✅ OLAP вернул ${rows.length} строк`);
    return rows;
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
