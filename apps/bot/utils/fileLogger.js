const fs = require("fs");
const path = require("path");

/**
 * Компактный файловый логгер
 * Записывает только важные события в однострочном формате
 */
class FileLogger {
  constructor() {
    this.logsDir = path.join(__dirname, "..", "logs");
    this.logLevel = process.env.LOG_LEVEL || "info"; // debug, info, warn, error
    this.levels = { debug: 0, info: 1, success: 1, warn: 2, warning: 2, error: 3 };
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return (this.levels[level] || 0) >= (this.levels[this.logLevel] || 0);
  }

  getTimestamp() {
    return new Date().toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  getDateString() {
    return new Date()
      .toLocaleDateString("ru-RU", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .split(".")
      .reverse()
      .join("-");
  }

  getLogFilePath() {
    return path.join(this.logsDir, `bot_${this.getDateString()}.log`);
  }

  formatDetails(details) {
    if (!details) return "";
    if (typeof details === "string") return ` | ${details}`;
    const parts = [];
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined && value !== null) {
        parts.push(`${key}=${typeof value === "object" ? JSON.stringify(value) : value}`);
      }
    }
    return parts.length ? ` | ${parts.join(", ")}` : "";
  }

  writeLog(level, message, details = null) {
    if (!this.shouldLog(level)) return;
    const levelTag = level.toUpperCase().padEnd(7);
    const logEntry = `[${this.getTimestamp()}] ${levelTag} ${message}${this.formatDetails(details)}\n`;
    try {
      fs.appendFileSync(this.getLogFilePath(), logEntry, "utf-8");
    } catch (error) {
      console.error("Log error:", error.message);
    }
  }

  debug(message, details = null) {
    this.writeLog("debug", message, details);
  }
  info(message, details = null) {
    this.writeLog("info", message, details);
  }
  success(message, details = null) {
    this.writeLog("success", message, details);
  }
  warn(message, details = null) {
    this.writeLog("warn", message, details);
  }
  warning(message, details = null) {
    this.writeLog("warn", message, details);
  }
  error(message, details = null) {
    this.writeLog("error", message, details);
  }

  // Компактный лог отчета
  report(name, revenue, orders, lfl, duration) {
    const lflStr = lfl !== null ? `${lfl > 0 ? "+" : ""}${lfl}%` : "N/A";
    this.info(`📊 ${name} | ${revenue}₽ | ${orders} заказов | LFL: ${lflStr} | ${duration}s`);
  }

  // Лог завершения batch операции
  batch(type, success, failed, duration) {
    const icon = failed === 0 ? "✅" : "⚠️";
    this.info(`${icon} ${type} | успешно: ${success}, ошибок: ${failed} | ${duration}s`);
  }
}

module.exports = new FileLogger();

