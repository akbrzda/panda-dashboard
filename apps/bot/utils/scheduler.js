const schedule = require("node-schedule");
const schedulerCfg = require("../config/scheduler.config");
const telegramCfg = require("../config/telegram.config");
const fileLogger = require("./fileLogger");
const iikoReportService = require("../services/iikoReportService");
const telegramService = require("../services/telegramService");
const notificationService = require("../services/notificationService");

try {
  schedulerCfg.validate();
  telegramCfg.validate();
} catch (error) {
  process.exit(1);
}

class Scheduler {
  constructor() {
    this.processing = { daily: false, weekly: false, monthly: false };
  }

  _buildRule(config) {
    const rule = new schedule.RecurrenceRule();
    rule.tz = schedulerCfg.TIMEZONE;
    rule.second = config.second;
    rule.minute = config.minute;
    rule.hour = config.hour;
    if (typeof config.dayOfWeek !== "undefined") rule.dayOfWeek = config.dayOfWeek;
    if (typeof config.date !== "undefined") rule.date = config.date;
    return rule;
  }

  initialize() {
    schedule.scheduleJob(this._buildRule(schedulerCfg.DAILY), () => this.fetchAndSendReports());
    schedule.scheduleJob(this._buildRule(schedulerCfg.WEEKLY), () => this.fetchAndSendWeeklyReports());
    schedule.scheduleJob(this._buildRule(schedulerCfg.MONTHLY), () => this.fetchAndSendMonthlyReports());

    fileLogger.info("Scheduler initialized", {
      timezone: schedulerCfg.TIMEZONE,
      daily: schedulerCfg.DAILY,
      weekly: schedulerCfg.WEEKLY,
      monthly: schedulerCfg.MONTHLY,
    });
  }

  async _processReports(type, fetchMethod) {
    if (this.processing[type]) {
      fileLogger.warn(`${type} already processing`);
      return { success: false, error: "Already processing" };
    }

    this.processing[type] = true;
    const startTime = Date.now();

    try {
      const restaurants = telegramCfg.getActiveOrganizations();
      if (!restaurants.length) {
        fileLogger.error("No restaurants configured");
        await notificationService.sendCriticalError("Ошибка конфигурации", "Нет ресторанов");
        throw new Error("No restaurants");
      }

      let success = 0;
      let failed = 0;
      const failedList = [];

      for (const org of restaurants) {
        try {
          const reportData = await fetchMethod(org.iikoId, org.name);
          await telegramService.sendReport(reportData);
          fileLogger.report(org.name, reportData.totalRevenue, reportData.totalOrders, reportData.lfl, ((Date.now() - startTime) / 1000).toFixed(1));
          success++;
        } catch (error) {
          fileLogger.error(`${org.name} failed`, {
            error: error.message,
            code: error.code,
            cause: error.cause ? String(error.cause) : undefined,
          });
          failedList.push(org.name);
          failed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (success > 0 || failed > 0) {
        await notificationService.sendSuccessSummary(success, restaurants.length, failedList, duration, type);
      }

      fileLogger.batch(type, success, failed, duration);
      return { success: true, successful: success, failed, duration, failedRestaurants: failedList };
    } catch (error) {
      fileLogger.error(`${type} processing failed`, { error: error.message });
      await notificationService.sendCriticalError(`Ошибка ${type} отчетов`, error.message);
      return { success: false, error: error.message };
    } finally {
      this.processing[type] = false;
    }
  }

  async fetchAndSendReports() {
    return this._processReports("daily", (id, name) => iikoReportService.getScheduledDailyReportWithLFL(id, name));
  }

  async fetchAndSendWeeklyReports() {
    return this._processReports("weekly", (id, name) => iikoReportService.getScheduledWeeklyReportWithLFL(id, name));
  }

  async fetchAndSendMonthlyReports() {
    return this._processReports("monthly", (id, name) => iikoReportService.getScheduledMonthlyReportWithLFL(id, name));
  }
}

module.exports = new Scheduler();
