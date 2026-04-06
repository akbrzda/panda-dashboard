const telegramCfg = require("../config/telegram.config");
const iikoReportService = require("./iikoReportService");

try {
  telegramCfg.validate();
} catch (e) {
  process.exit(1);
}

class TelegramService {
  constructor() {
    this.bot = null;
    this.notifyGroupId = telegramCfg.NOTIFY_GROUP;
    this.notifyThreadId = telegramCfg.NOTIFY_THREAD;
  }

  initialize(bot) {
    this.bot = bot;
  }

  async sendReport(reportData) {
    if (!this.bot || !this.notifyGroupId) throw new Error("Service not initialized");
    if (!this.notifyThreadId) throw new Error("NOTIFY_THREAD not configured");

    const message = iikoReportService.formatReportMessage(reportData);
    await this.bot.sendMessage(this.notifyGroupId, message, {
      parse_mode: "HTML",
      message_thread_id: parseInt(this.notifyThreadId, 10),
    });
    return { restaurantId: reportData.restaurantId, restaurantName: reportData.restaurantName };
  }
}

module.exports = new TelegramService();
