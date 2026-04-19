const fs = require("fs");
const path = require("path");
const { getRequestContext } = require("./requestContext");

class FileLogger {
  constructor(options = {}) {
    this.appName = String(options.appName || "app").trim() || "app";
    this.logsDir = options.logsDir || path.join(process.cwd(), "logs");
    this.logLevel = String(options.logLevel || process.env.LOG_LEVEL || "info").toLowerCase();
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.getContext = typeof options.getContext === "function" ? options.getContext : () => ({});
    this.mirrorToConsole = options.mirrorToConsole !== false;
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

  getLogPath() {
    return path.join(this.logsDir, `${this.appName}_${this.getDateString()}.log`);
  }

  getErrorLogPath() {
    return path.join(this.logsDir, `${this.appName}_errors_${this.getDateString()}.log`);
  }

  prepareRecord(level, message, details = null) {
    let context = {};

    try {
      context = this.getContext() || {};
    } catch {
      context = {};
    }

    const normalizedDetails = details && typeof details === "object" ? details : details ? { detail: String(details) } : {};

    const record = {
      timestamp: new Date().toISOString(),
      severity: String(level || "info").toUpperCase(),
      app: this.appName,
      message: String(message || ""),
      correlationId: context.correlationId || normalizedDetails.correlationId || null,
      ...normalizedDetails,
    };

    if (!record.correlationId) {
      delete record.correlationId;
    }

    return record;
  }

  write(level, message, details = null) {
    if (!this.shouldLog(level)) {
      return;
    }

    const record = this.prepareRecord(level, message, details);
    const line = `${JSON.stringify(record)}\n`;

    try {
      fs.appendFileSync(this.getLogPath(), line, "utf-8");
      if (level === "error") {
        fs.appendFileSync(this.getErrorLogPath(), line, "utf-8");
      }
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "ERROR",
        app: this.appName,
        message: "Не удалось записать лог",
        detail: error.message,
      }));
    }

    if (this.mirrorToConsole) {
      const printer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      printer(line.trim());
    }
  }

  debug(message, details = null) {
    this.write("debug", message, details);
  }

  info(message, details = null) {
    this.write("info", message, details);
  }

  warn(message, details = null) {
    this.write("warn", message, details);
  }

  warning(message, details = null) {
    this.write("warn", message, details);
  }

  error(message, details = null) {
    this.write("error", message, details);
  }

  success(message, details = null) {
    this.write("info", message, details);
  }

  report(name, revenue, orders, lfl, duration) {
    this.info("Сформирован отчет", {
      name,
      revenue,
      orders,
      lfl,
      duration,
    });
  }

  batch(type, success, failed, duration) {
    this.info("Завершена пакетная операция", {
      type,
      success,
      failed,
      duration,
    });
  }
}

function createFileLogger(options = {}) {
  return new FileLogger(options);
}

module.exports = createFileLogger({
  appName: "backend",
  logsDir: path.join(__dirname, "..", "..", "logs"),
  getContext: getRequestContext,
});
