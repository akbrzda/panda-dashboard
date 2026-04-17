const fs = require("fs");
const path = require("path");

class FileLogger {
  constructor() {
    this.logsDir = path.join(__dirname, "..", "..", "logs");
    this.logLevel = process.env.LOG_LEVEL || "info";
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
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

  getTimestamp() {
    return new Date().toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  getMainLogPath() {
    return path.join(this.logsDir, `backend_${this.getDateString()}.log`);
  }

  getErrorLogPath() {
    return path.join(this.logsDir, `backend_errors_${this.getDateString()}.log`);
  }

  formatDetails(details) {
    if (!details) return "";
    if (typeof details === "string") return ` | ${details}`;

    const parts = [];
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined && value !== null) {
        const preparedValue = typeof value === "object" ? JSON.stringify(value) : value;
        parts.push(`${key}=${preparedValue}`);
      }
    }

    return parts.length ? ` | ${parts.join(", ")}` : "";
  }

  write(level, message, details = null) {
    if (!this.shouldLog(level)) return;

    const entry = `[${this.getTimestamp()}] ${level.toUpperCase().padEnd(5)} ${message}${this.formatDetails(details)}\n`;

    try {
      fs.appendFileSync(this.getMainLogPath(), entry, "utf-8");

      if (level === "error") {
        fs.appendFileSync(this.getErrorLogPath(), entry, "utf-8");
      }
    } catch (error) {
      console.error("Ошибка записи логов:", error.message);
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

  error(message, details = null) {
    this.write("error", message, details);
  }
}

module.exports = new FileLogger();
