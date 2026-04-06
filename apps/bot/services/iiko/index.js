/**
 * iiko Report Service - main module for iiko OLAP reports
 */

const iikoCfg = require("../../config/iiko.config");
const fileLogger = require("../../utils/fileLogger");
const iikoClient = require("./client");
const olapBuilder = require("./olapBuilder");
const dateUtils = require("./dateUtils");
const reportFormatter = require("./reportFormatter");

try {
  iikoCfg.validate();
} catch (e) {
  process.exit(1);
}

class IikoReportService {
  constructor() {
    this.client = iikoClient;
    this.builder = olapBuilder;
    this.dateUtils = dateUtils;
    this.formatter = reportFormatter;
  }

  _normalizeFlag(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toUpperCase();
  }

  _isTrueFlag(value) {
    if (value === true || value === 1) return true;
    const flag = this._normalizeFlag(value);
    return flag === "TRUE" || flag === "YES" || flag === "1";
  }

  _isDeletedOrderFlag(value) {
    const flag = this._normalizeFlag(value);
    return flag === "DELETED" || flag === "ORDER_DELETED";
  }

  _hasItemDeletionFlag(value) {
    const flag = this._normalizeFlag(value);
    return Boolean(flag) && flag !== "NOT_DELETED";
  }

  _extractDatePart(value) {
    if (!value) return null;
    const source = String(value).trim();
    if (!source) return null;

    if (source.includes("T")) {
      const [datePart] = source.split("T");
      return datePart.replace(/\./g, "-");
    }

    const dotted = source.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (dotted) return `${dotted[1]}-${dotted[2]}-${dotted[3]}`;

    const dashed = source.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dashed) return dashed[1];

    return null;
  }

  _isRowFromCurrentShift(row) {
    const expectedTime = row["Delivery.ExpectedTime"] || null;
    const openTime = row.OpenTime || null;
    const closeTime = row.CloseTime || null;

    const closeDate = this._extractDatePart(closeTime);
    if (!closeDate) return false;

    if (expectedTime) {
      return this._extractDatePart(expectedTime) === closeDate;
    }

    return this._extractDatePart(openTime) === closeDate;
  }

  _getRowsFromOlapData(data) {
    if (Array.isArray(data?.result?.rawData)) {
      return data.result.rawData;
    }

    if (data?.cells) {
      return Object.entries(data.cells).map(([key, values]) => {
        const grouped = JSON.parse(key);
        return {
          ...grouped,
          Sales: Number(values?.[0] || 0),
          "UniqOrderId.OrdersCount": Number(values?.[1] || 0),
          RevenueWithoutDiscount: Number(values?.[2] || 0),
          DiscountSum: Number(values?.[3] || 0),
        };
      });
    }

    return [];
  }

  _parseOlapRowsWithShiftFilter(data) {
    const rows = this._getRowsFromOlapData(data);

    const revenueByChannel = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalRevenueWithoutDiscount = 0;
    let totalDiscountSum = 0;
    const ordersMap = new Map();

    let includedRows = 0;
    let excludedRows = 0;

    for (const row of rows) {
      const orderId = row["UniqOrderId.Id"] || row.OrderId || `${row.OrderNum || "NA"}|${row.OpenTime || ""}|${row.CloseTime || ""}`;
      const orderType = row.OrderType || "Unknown";
      const sales = Number(row.Sales ?? row["DishDiscountSumInt.withoutVAT"] ?? 0);
      const revenueWithoutDiscount = Number(row.RevenueWithoutDiscount ?? row.DishSumInt ?? 0);
      const discountSum = Number(row.DiscountSum ?? 0);
      const isOrderDeleted = this._isDeletedOrderFlag(row.OrderDeleted);
      const isStorned = this._isTrueFlag(row.Storned);
      const hasCancelCause = Boolean(row["Delivery.CancelCause"]);
      const hasItemDeletion = this._hasItemDeletionFlag(row.DeletedWithWriteoff);

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          orderType,
          sales: 0,
          revenueWithoutDiscount: 0,
          discountSum: 0,
          isOrderDeleted: false,
          isStorned: false,
          hasCancelCause: false,
          hasItemDeletion: false,
          rowsCount: 0,
        });
      }

      const order = ordersMap.get(orderId);
      order.rowsCount += 1;
      order.sales += sales;
      order.revenueWithoutDiscount += revenueWithoutDiscount;
      order.discountSum += discountSum;
      order.isOrderDeleted = order.isOrderDeleted || isOrderDeleted;
      order.isStorned = order.isStorned || isStorned;
      order.hasCancelCause = order.hasCancelCause || hasCancelCause;
      order.hasItemDeletion = order.hasItemDeletion || hasItemDeletion;
      if (!order.orderType && orderType) order.orderType = orderType;
    }

    const orderStats = {
      totalDistinctOrders: ordersMap.size,
      canceledOrders: 0,
      orderDeleted: 0,
      storned: 0,
      withCancelCause: 0,
      withItemDeletion: 0,
      activeOrders: 0,
      stornoAdjustment: 0,
    };

    for (const order of ordersMap.values()) {
      const isCanceledOrder = order.isOrderDeleted || order.isStorned || order.hasCancelCause;

      if (order.isOrderDeleted) orderStats.orderDeleted += 1;
      if (order.isStorned) orderStats.storned += 1;
      if (order.hasCancelCause) orderStats.withCancelCause += 1;
      if (order.hasItemDeletion) orderStats.withItemDeletion += 1;

      if (isCanceledOrder) {
        orderStats.canceledOrders += 1;
        // Storno/check return often comes with zero Sales but negative DishSumInt.
        // Apply it as a revenue correction so canceled returns reduce total revenue.
        if (order.isStorned && order.revenueWithoutDiscount < 0) {
          orderStats.stornoAdjustment += order.revenueWithoutDiscount;
        }
        excludedRows += order.rowsCount;
        continue;
      }

      includedRows += order.rowsCount;
      orderStats.activeOrders += 1;
      revenueByChannel[order.orderType || "Unknown"] = (revenueByChannel[order.orderType || "Unknown"] || 0) + order.sales;
      totalRevenue += order.sales;
      totalOrders += 1;
      totalRevenueWithoutDiscount += order.revenueWithoutDiscount;
      totalDiscountSum += order.discountSum;
    }

    totalRevenue += orderStats.stornoAdjustment;

    const avgPerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const discountPercent = totalRevenueWithoutDiscount > 0 ? (totalDiscountSum / totalRevenueWithoutDiscount) * 100 : 0;

    return {
      rowsCount: rows.length,
      includedRows,
      excludedRows,
      revenueByChannel,
      totalRevenue,
      totalOrders,
      avgPerOrder,
      totalRevenueWithoutDiscount,
      discountPercent,
      discountSum: totalDiscountSum,
      orderStats,
    };
  }

  async _getReportForPeriod(restaurantId, restaurantName, shiftStart, shiftEnd, period = "day") {
    const startTime = Date.now();
    const httpClient = this.client.createHttpClient();

    try {
      const olapBody = this.builder.buildReportQuery(restaurantId, shiftStart, shiftEnd, false);

      const data = await this.client.executeOlapQuery(httpClient, restaurantId, olapBody);
      const parsedData = this._parseOlapRowsWithShiftFilter(data);

      const discountPercent = parsedData.totalRevenueWithoutDiscount > 0 ? (parsedData.discountSum / parsedData.totalRevenueWithoutDiscount) * 100 : 0;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      await this.client.logout(httpClient);

      fileLogger.info(
        `🔎 ${restaurantName} [${period}] | Rows: ${parsedData.rowsCount} | Included: ${parsedData.includedRows} | Excluded: ${parsedData.excludedRows}`
      );
      fileLogger.info(
        `✅ ${restaurantName} [${period}] | Revenue: ${parsedData.totalRevenue}₽ | Orders: ${parsedData.totalOrders} | Discount: ${discountPercent}% | ${duration}s`
      );

      const dateFrom = new Date(shiftStart);
      const dateTo = new Date(shiftEnd);
      let dateStr;
      if (period === "week" || period === "period") {
        dateStr = dateUtils.formatWeekPeriod(dateFrom, dateTo);
      } else if (period === "month") {
        dateStr = dateUtils.getMonthName(dateFrom);
      } else {
        dateStr = dateUtils.formatDateShort(dateFrom);
      }

      return {
        restaurantId,
        restaurantName,
        revenueByChannel: parsedData.revenueByChannel,
        totalRevenue: parsedData.totalRevenue,
        totalOrders: parsedData.totalOrders,
        avgPerOrder: parsedData.avgPerOrder,
        totalRevenueWithoutDiscount: parsedData.totalRevenueWithoutDiscount,
        discountPercent,
        discountSum: parsedData.discountSum,
        orderStats: parsedData.orderStats,
        bonusWriteOff: 0,
        date: dateStr,
        period,
        duration,
      };
    } catch (error) {
      try {
        await this.client.logout(httpClient);
      } catch (_) {
        // ignore
      }
      fileLogger.error(`${restaurantName} [${period}]: ${error.message}`);
      throw new Error(`Failed to get report for ${restaurantName}: ${error.message}`);
    }
  }

  async _getReportWithLFL(restaurantId, restaurantName, currentBounds, prevBounds, period) {
    const formatPeriod = (start, end) => {
      const s = start.split("T")[0];
      const e = end.split("T")[0];
      return s === e ? s : `${s} - ${e}`;
    };

    const currentPeriodStr = formatPeriod(currentBounds.start, currentBounds.end);
    const prevPeriodStr = formatPeriod(prevBounds.start, prevBounds.end);

    fileLogger.info(`📋 ${restaurantName} | Request: ${period} | Period: ${currentPeriodStr} | Compare: ${prevPeriodStr}`);

    const currentReport = await this._getReportForPeriod(restaurantId, restaurantName, currentBounds.start, currentBounds.end, period);
    const prevReport = await this._getReportForPeriod(restaurantId, restaurantName, prevBounds.start, prevBounds.end, period);

    const lfl = this.formatter.calculateLFL(currentReport.totalRevenue, prevReport.totalRevenue);
    const lflOrders = this.formatter.calculateLFL(currentReport.totalOrders, prevReport.totalOrders);

    const lflStr = lfl !== null ? `${lfl > 0 ? "+" : ""}${lfl}%` : "N/A";
    fileLogger.success(`📊 ${restaurantName} [${period}] | Total: ${currentReport.totalRevenue}₽ | LFL: ${lflStr} | Prev: ${prevReport.totalRevenue}₽`);

    return {
      ...currentReport,
      lfl,
      lflOrders,
      previousPeriodRevenue: prevReport.totalRevenue,
      previousPeriodOrders: prevReport.totalOrders,
      monthlyDiscount: {
        discountPercent: currentReport.discountPercent,
        discountSum: currentReport.discountSum,
      },
    };
  }

  async getDailyReportWithLFL(restaurantId, restaurantName) {
    const today = dateUtils.getTodayBounds();
    const prevDay = dateUtils.getDayBounds(dateUtils.getDateDaysAgo(today.date, 7));
    return this._getReportWithLFL(restaurantId, restaurantName, today, prevDay, "day");
  }

  async getScheduledDailyReportWithLFL(restaurantId, restaurantName) {
    const { current, previous } = dateUtils.getScheduledDailyBounds();
    return this._getReportWithLFL(restaurantId, restaurantName, current, previous, "day");
  }

  async getWeeklyReportWithLFL(restaurantId, restaurantName) {
    const currentWeek = dateUtils.getCurrentWeekBounds();
    const prevWeek = dateUtils.getPreviousWeekBounds(currentWeek.monday, currentWeek.sunday);
    return this._getReportWithLFL(restaurantId, restaurantName, currentWeek, prevWeek, "week");
  }

  async getScheduledWeeklyReportWithLFL(restaurantId, restaurantName) {
    const { current, previous } = dateUtils.getLastCompletedWeekBounds();
    return this._getReportWithLFL(restaurantId, restaurantName, current, previous, "week");
  }

  async getMonthlyReportWithLFL(restaurantId, restaurantName) {
    const currentMonth = dateUtils.getCurrentMonthBounds();
    const prevMonth = dateUtils.getPreviousMonthBounds();
    const report = await this._getReportWithLFL(restaurantId, restaurantName, currentMonth, prevMonth, "month");
    report.date = dateUtils.getMonthName(currentMonth.firstDay);
    return report;
  }

  async getScheduledMonthlyReportWithLFL(restaurantId, restaurantName) {
    const { current, previous } = dateUtils.getLastCompletedMonthBounds();
    const report = await this._getReportWithLFL(restaurantId, restaurantName, current, previous, "month");
    report.date = dateUtils.getMonthName(current.firstDay);
    return report;
  }

  async getDailyReportByDate(restaurantId, restaurantName, date) {
    const dayBounds = dateUtils.getDayBounds(date);
    const prevDayBounds = dateUtils.getDayBounds(dateUtils.getDateDaysAgo(date, 7));
    return this._getReportWithLFL(restaurantId, restaurantName, dayBounds, prevDayBounds, "day");
  }

  _isFullMonth(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.getUTCDate() !== 1) return false;
    if (start.getUTCMonth() !== end.getUTCMonth() || start.getUTCFullYear() !== end.getUTCFullYear()) return false;

    const lastDayOfMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    return end.getUTCDate() === lastDayOfMonth || end.getUTCDate() === lastDayOfMonth - 1;
  }

  async getPeriodReportWithLFL(restaurantId, restaurantName, startDate, endDate) {
    const startBounds = dateUtils.formatDateTimeForOlap(startDate, "00:00:00");
    const endBounds = dateUtils.formatDateTimeForOlap(endDate, "23:59:59");

    let prevStartDate;
    let prevEndDate;

    if (this._isFullMonth(startDate, endDate)) {
      const start = new Date(startDate);
      prevStartDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
      prevEndDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
    } else {
      const periodLengthMs = endDate - startDate;
      const daysDiff = Math.floor(periodLengthMs / (1000 * 60 * 60 * 24));

      prevEndDate = new Date(startDate);
      prevEndDate.setUTCDate(prevEndDate.getUTCDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setUTCDate(prevStartDate.getUTCDate() - daysDiff);
    }

    const currentBounds = { start: startBounds, end: endBounds };
    const prevBounds = {
      start: dateUtils.formatDateTimeForOlap(prevStartDate, "00:00:00"),
      end: dateUtils.formatDateTimeForOlap(prevEndDate, "23:59:59"),
    };

    const report = await this._getReportWithLFL(restaurantId, restaurantName, currentBounds, prevBounds, "period");
    report.date = dateUtils.formatWeekPeriod(startDate, endDate);
    return report;
  }

  formatReportMessage(reportData) {
    return this.formatter.formatReportMessage(reportData);
  }

  calculateLFL(current, previous) {
    return this.formatter.calculateLFL(current, previous);
  }

  formatLFL(lfl) {
    return this.formatter.formatLFL(lfl);
  }
}

module.exports = new IikoReportService();
