const telegramCfg = require("../config/telegram.config");

class NotificationService {
  constructor() {
    this.bot = null;
    this.logsGroupId = telegramCfg.LOGS_GROUP;
    this.logsThreadId = telegramCfg.LOGS_THREAD;
    this.maxRetries = 3;
    this.baseRetryDelayMs = 1200;
  }

  initialize(bot) {
    this.bot = bot;
  }

  _buildOptions() {
    const options = { parse_mode: "HTML" };
    const parsedThreadId = Number.parseInt(this.logsThreadId, 10);
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

  async _send(message) {
    if (!this.bot || !this.logsGroupId) return false;
    const options = this._buildOptions();

    try {
      let lastError = null;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await this.bot.sendMessage(this.logsGroupId, message, options);
          return true;
        } catch (e) {
          lastError = e;
          const shouldRetry = attempt < this.maxRetries && this._isRetryableError(e);
          if (!shouldRetry) throw e;
          const retryAfterMs = this._extractRetryAfterMs(e);
          const delayMs = retryAfterMs || this.baseRetryDelayMs * attempt;
          await this._sleep(delayMs);
        }
      }
      if (lastError) throw lastError;
      return true;
    } catch (e) {
      console.error("Notification error:", e.message, "| code:", e.code || "N/A");
      return false;
    }
  }

  async sendCriticalError(title, details) {
    const detailsStr = details ? `\n<pre>${String(details).substring(0, 800)}</pre>` : "";
    return this._send(`❌ <b>ОШИБКА</b>\n<b>${title}</b>${detailsStr}`);
  }

  async sendSuccessSummary(success, total, failed = [], duration, type = "daily") {
    const typeNames = { daily: "Ежедневный", weekly: "Еженедельный", monthly: "Ежемесячный" };
    let msg = `✅ <b>${typeNames[type] || type} отчет</b>\n`;
    msg += `Успешно: <b>${success}/${total}</b> | ${duration}s`;
    if (failed.length) msg += `\n⚠️ Ошибки: ${failed.join(", ")}`;
    return this._send(msg);
  }
}

module.exports = new NotificationService();
