const telegramCfg = require("../config/telegram.config");

class NotificationService {
  constructor() {
    this.bot = null;
    this.logsGroupId = telegramCfg.LOGS_GROUP;
    this.logsThreadId = telegramCfg.LOGS_THREAD;
  }

  initialize(bot) {
    this.bot = bot;
  }

  async _send(message) {
    if (!this.bot || !this.logsGroupId) return false;
    try {
      await this.bot.sendMessage(this.logsGroupId, message, {
        parse_mode: "HTML",
        message_thread_id: parseInt(this.logsThreadId),
      });
      return true;
    } catch (e) {
      console.error("Notification error:", e.message);
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
