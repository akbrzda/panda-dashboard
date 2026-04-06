const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const config = require("../config");

/**
 * Сервис для получения отчетов по выручке из iiko
 * Использует OLAP API для получения данных о продажах
 */
class RevenueService {
  constructor() {
    // Используем конфигурацию из .env для Web API (не Cloud API)
    this.baseUrl = process.env.IIKO_BASE_URL;
    this.username = process.env.IIKO_USER;
    this.password = process.env.IIKO_PASSWORD;
    this.timeout = 30000;
    this.pollInterval = 500;
    this.maxAttempts = 120;

    console.log(`📊 RevenueService initialized with baseUrl: ${this.baseUrl}`);
  }

  /**
   * Получить отчет по выручке за период
   */
  async getRevenueReport(organizationId, startDate, endDate, timezone = "Europe/Moscow") {
    const startTime = Date.now();
    console.log(
      `📊 [${new Date().toISOString()}] Fetching revenue report for org ${organizationId} from ${startDate.toISOString().split("T")[0]} to ${
        endDate.toISOString().split("T")[0]
      }`
    );

    // Для периода используем агрегацию по дням
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    console.log(`   Days to fetch: ${days}`);

    if (days === 1) {
      // Если один день, используем метод для дневного отчета
      return await this.getDailyRevenue(organizationId, startDate, timezone);
    }

    // Для периода собираем данные по каждому дню
    const dailyReports = [];
    const currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);

    while (currentDate < endDateTime) {
      try {
        const dayReport = await this._getReportForDate(organizationId, currentDate);
        dailyReports.push(dayReport);
      } catch (error) {
        console.error(`❌ Failed to fetch report for ${currentDate.toISOString().split("T")[0]}:`, error.message);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Получаем отчеты за предыдущий период для расчета LFL
    const sevenDaysAgoStart = new Date(startDate);
    sevenDaysAgoStart.setUTCDate(sevenDaysAgoStart.getUTCDate() - 7);
    const sevenDaysAgoEnd = new Date(endDate);
    sevenDaysAgoEnd.setUTCDate(sevenDaysAgoEnd.getUTCDate() - 7);

    const previousDailyReports = [];
    const previousDate = new Date(sevenDaysAgoStart);
    const previousEndDate = new Date(sevenDaysAgoEnd);
    previousEndDate.setUTCDate(previousEndDate.getUTCDate() + 1);

    while (previousDate < previousEndDate) {
      try {
        const dayReport = await this._getReportForDate(organizationId, previousDate);
        previousDailyReports.push(dayReport);
      } catch (error) {
        // Игнорируем ошибки для предыдущего периода
      }
      previousDate.setUTCDate(previousDate.getUTCDate() + 1);
    }

    // Агрегируем данные
    const aggregated = this._aggregateDailyReports(dailyReports);
    const previousAggregated = this._aggregateDailyReports(previousDailyReports);

    // Рассчитываем LFL
    const lfl = this._calculateLFL(aggregated.totalRevenue, previousAggregated.totalRevenue);

    // Нормализуем и сортируем каналы
    const normalizedChannels = this._normalizeRevenueChannels(aggregated.revenueByChannel);
    const sortedChannels = this._sortChannels(normalizedChannels);

    // Преобразуем в нужный формат для фронтенда
    const revenueByChannel = {};
    for (const [channel, revenue] of Object.entries(sortedChannels)) {
      const orders = aggregated.ordersByChannel[channel] || 0;
      revenueByChannel[channel] = {
        revenue,
        orders,
        avgCheck: orders > 0 ? revenue / orders : 0,
      };
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [${new Date().toISOString()}] Report completed in ${duration}s - Total revenue: ${aggregated.totalRevenue.toFixed(2)}`);

    return {
      organizationId,
      period: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        days: dailyReports.length,
      },
      summary: {
        totalRevenue: aggregated.totalRevenue,
        totalOrders: aggregated.totalOrders,
        avgPerOrder: aggregated.avgPerOrder,
        avgDeliveryTime: aggregated.avgDeliveryTime,
        avgCookingTime: aggregated.avgCookingTime,
        lfl,
        previousPeriodRevenue: previousAggregated.totalRevenue,
      },
      revenueByChannel,
      dailyBreakdown: dailyReports.map((report) => ({
        date: report.date,
        revenue: report.totalRevenue,
        orders: report.totalOrders,
      })),
    };
  }

  /**
   * Получить отчет по выручке за конкретный день
   */
  async getDailyRevenue(organizationId, date, timezone = "Europe/Moscow") {
    console.log(`📊 Fetching daily revenue for org ${organizationId} on ${date.toISOString().split("T")[0]}`);

    const reportData = await this._getReportForDate(organizationId, date);

    // Получаем данные за 7 дней назад для LFL
    const sevenDaysAgoDate = new Date(date);
    sevenDaysAgoDate.setUTCDate(sevenDaysAgoDate.getUTCDate() - 7);

    let lfl = null;
    let previousRevenue = null;
    try {
      const sevenDaysAgoReport = await this._getReportForDate(organizationId, sevenDaysAgoDate);
      previousRevenue = sevenDaysAgoReport.totalRevenue;
      lfl = this._calculateLFL(reportData.totalRevenue, previousRevenue);
    } catch (error) {
      console.warn(`⚠️ Could not fetch previous period data for LFL calculation:`, error.message);
    }

    // Нормализуем и сортируем каналы
    const normalizedChannels = this._normalizeRevenueChannels(reportData.revenueByChannel);
    const sortedChannels = this._sortChannels(normalizedChannels);

    // Преобразуем в нужный формат для фронтенда
    const revenueByChannel = {};
    for (const [channel, revenue] of Object.entries(sortedChannels)) {
      const orders = reportData.ordersByChannel[channel] || 0;
      revenueByChannel[channel] = {
        revenue,
        orders,
        avgCheck: orders > 0 ? revenue / orders : 0,
      };
    }

    return {
      organizationId,
      period: {
        startDate: date.toISOString().split("T")[0],
        endDate: date.toISOString().split("T")[0],
        days: 1,
      },
      summary: {
        totalRevenue: reportData.totalRevenue,
        totalOrders: reportData.totalOrders,
        avgPerOrder: reportData.avgPerOrder,
        avgDeliveryTime: reportData.avgDeliveryTime,
        avgCookingTime: reportData.avgCookingTime,
        lfl,
        previousPeriodRevenue: previousRevenue,
      },
      revenueByChannel,
      dailyBreakdown: [
        {
          date: reportData.date,
          revenue: reportData.totalRevenue,
          orders: reportData.totalOrders,
        },
      ],
    };
  }

  /**
   * Получить отчет из iiko OLAP API за конкретную дату
   */
  async _getReportForDate(organizationId, date) {
    const jar = new CookieJar();
    const client = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: { "Content-Type": "application/json" },
        jar,
        withCredentials: true,
      })
    );

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const pad = (n) => String(n).padStart(2, "0");
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const shiftStart = `${year}-${month}-${day}T00:00:00Z`;

    // Для сегодняшнего дня используем текущее время, для прошлых - конец дня
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    let shiftEnd;
    if (isToday) {
      const hour = pad(now.getUTCHours());
      const minute = pad(now.getUTCMinutes());
      const second = pad(now.getUTCSeconds());
      shiftEnd = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    } else {
      shiftEnd = `${year}-${month}-${day}T23:59:59Z`;
    }

    try {
      // Авторизация
      console.log(`   Logging in as ${this.username}...`);
      await client.post("/api/auth/login", {
        login: this.username,
        password: this.password,
      });

      // Выбор организации
      console.log(`   Selecting store ${organizationId}...`);
      await client.post(`/api/stores/select/${organizationId}`);

      // OLAP запрос
      console.log(`   Initializing OLAP request for ${shiftStart} to ${shiftEnd}...`);
      const olapBody = {
        storeIds: [String(organizationId)],
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
            dateFrom: shiftStart,
            dateTo: shiftEnd,
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

      console.log(`   OLAP body:`, JSON.stringify(olapBody, null, 2));
      const initResponse = await client.post("/api/olap/init", olapBody);
      const fetchId = initResponse.data?.data;

      if (!fetchId) {
        console.error(`   ❌ Failed to get fetchId from OLAP init. Response:`, initResponse.data);
        throw new Error("Failed to get fetchId from OLAP init");
      }

      console.log(`   Got fetchId: ${fetchId}, waiting for report...`);

      // Ожидание готовности отчета
      let data = null;
      for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
        try {
          const resultResponse = await client.get(`/api/olap/fetch/${fetchId}/sales`);
          const responseData = resultResponse.data;

          if (responseData && (responseData.cells || responseData.result?.rawData)) {
            data = responseData;
            break;
          }
        } catch (e) {
          if (e.response?.status !== 400) {
            throw e;
          }
        }

        await delay(this.pollInterval);
      }

      if (!data) {
        throw new Error("Failed to fetch OLAP report data");
      }

      // Парсинг данных
      const revenueByChannel = {};
      const ordersByChannel = {};
      let totalRevenue = 0;
      let totalOrders = 0;

      if (data.result?.rawData) {
        console.log(`   Parsing ${data.result.rawData.length} rows from rawData...`);
        for (const row of data.result.rawData) {
          const orderType = row.OrderType || "Unknown";
          const sales = row.Sales || 0;
          const ordersCount = row["UniqOrderId.OrdersCount"] || row.OrdersCount || 0;

          revenueByChannel[orderType] = (revenueByChannel[orderType] || 0) + sales;
          ordersByChannel[orderType] = (ordersByChannel[orderType] || 0) + ordersCount;
          totalRevenue += sales;
          totalOrders += ordersCount;
        }
      } else if (data.cells) {
        console.log(`   Parsing ${Object.keys(data.cells).length} cells...`);
        for (const [key, values] of Object.entries(data.cells)) {
          const grouping = JSON.parse(key);
          const orderType = grouping.OrderType || "Unknown";
          const sales = parseFloat(values[0]) || 0;
          const ordersCount = parseInt(values[1]) || 0;

          revenueByChannel[orderType] = (revenueByChannel[orderType] || 0) + sales;
          ordersByChannel[orderType] = (ordersByChannel[orderType] || 0) + ordersCount;
          totalRevenue += sales;
          totalOrders += ordersCount;
        }
      }

      const avgPerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      console.log(`   ✅ Report parsed: ${totalOrders} orders, ${totalRevenue.toFixed(2)} ₽`);

      // Logout
      try {
        await client.post("/api/auth/logout");
      } catch (e) {}

      return {
        date: dateStr,
        revenueByChannel,
        ordersByChannel,
        totalRevenue,
        totalOrders,
        avgPerOrder,
        avgDeliveryTime: 0,
        avgCookingTime: 0,
      };
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Failed to fetch report for ${date.toISOString().split("T")[0]}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Агрегировать ежедневные отчеты
   */
  _aggregateDailyReports(dailyReports) {
    const aggregated = {
      totalRevenue: 0,
      totalOrders: 0,
      revenueByChannel: {},
      ordersByChannel: {},
    };

    for (const report of dailyReports) {
      aggregated.totalRevenue += report.totalRevenue;
      aggregated.totalOrders += report.totalOrders;

      for (const [channel, amount] of Object.entries(report.revenueByChannel)) {
        aggregated.revenueByChannel[channel] = (aggregated.revenueByChannel[channel] || 0) + amount;
      }

      for (const [channel, count] of Object.entries(report.ordersByChannel)) {
        aggregated.ordersByChannel[channel] = (aggregated.ordersByChannel[channel] || 0) + count;
      }
    }

    const avgPerOrder = aggregated.totalOrders > 0 ? aggregated.totalRevenue / aggregated.totalOrders : 0;

    return {
      ...aggregated,
      avgPerOrder,
      avgDeliveryTime: 0,
      avgCookingTime: 0,
    };
  }

  /**
   * Рассчитать Like-for-Like (LFL) процент изменения
   */
  _calculateLFL(currentRevenue, previousRevenue) {
    if (previousRevenue === 0 || previousRevenue === null || previousRevenue === undefined) {
      return null;
    }

    const percentage = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    return Math.round(percentage * 100) / 100;
  }

  /**
   * Нормализовать названия каналов
   */
  _normalizeRevenueChannels(revenueByChannel) {
    const normalized = {};

    for (const [channel, amount] of Object.entries(revenueByChannel)) {
      let normalizedChannel = channel;

      if (channel === "С собой" || channel === "Доставка самовывоз" || channel === "Самовывоз") {
        normalizedChannel = "Самовывоз";
      } else if (channel?.includes("Яндекс.Еда")) {
        normalizedChannel = "Яндекс.Еда";
      }

      normalized[normalizedChannel] = (normalized[normalizedChannel] || 0) + amount;
    }

    return normalized;
  }

  /**
   * Сортировать каналы по приоритету
   */
  _sortChannels(channels) {
    const order = ["Зал", "Самовывоз", "Доставка Курьером", "Яндекс.Еда"];
    const sorted = {};

    for (const channel of order) {
      if (channels[channel] !== undefined) {
        sorted[channel] = channels[channel];
      }
    }

    // Добавляем остальные каналы по убыванию суммы
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
