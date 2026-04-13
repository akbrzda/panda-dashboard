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
    this.maxRetries = 3;
    this.baseRetryDelayMs = 1200;
  }

  initialize(bot) {
    this.bot = bot;
  }

  _buildOptions() {
    const options = {};
    const parsedThreadId = Number.parseInt(this.notifyThreadId, 10);
    if (Number.isFinite(parsedThreadId)) {
      options.message_thread_id = parsedThreadId;
    }
    return options;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _extractRetryAfterMs(error) {
    const retryAfterSec = error?.response?.body?.parameters?.retry_after;
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      return retryAfterSec * 1000;
    }
    return null;
  }

  _isRetryableError(error) {
    const msg = String(error?.message || "");
    const code = String(error?.code || "");
    return (
      code === "EFATAL" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "EAI_AGAIN" ||
      code === "ENETUNREACH" ||
      code === "ECONNREFUSED" ||
      msg.includes("AggregateError") ||
      msg.includes("429")
    );
  }

  async _sendWithRetry(chatId, message) {
    const options = this._buildOptions();
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.bot.sendMessage(chatId, message, options);
        return;
      } catch (error) {
        lastError = error;
        const shouldRetry = attempt < this.maxRetries && this._isRetryableError(error);
        if (!shouldRetry) break;

        const retryAfterMs = this._extractRetryAfterMs(error);
        const delayMs = retryAfterMs || this.baseRetryDelayMs * attempt;
        await this._sleep(delayMs);
      }
    }

    throw lastError;
  }

  async sendReport(reportData) {
    if (!this.bot || !this.notifyGroupId) throw new Error("Service not initialized");
    if (!this.notifyThreadId) throw new Error("NOTIFY_THREAD not configured");

    const message = iikoReportService.formatReportMessage(reportData);
    await this._sendWithRetry(this.notifyGroupId, message);
    return { restaurantId: reportData.restaurantId, restaurantName: reportData.restaurantName };
  }
}

module.exports = new TelegramService();
