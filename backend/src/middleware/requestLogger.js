const fileLogger = require("../utils/fileLogger");

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const message = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}мс`;
    const details = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    if (res.statusCode >= 500) {
      console.error(message);
      fileLogger.error("HTTP 5xx ответ", details);
      return;
    }

    if (res.statusCode >= 400) {
      fileLogger.warn("HTTP 4xx ответ", details);
      console.log(message);
      return;
    }

    console.log(message);
    fileLogger.info("HTTP запрос", details);
  });

  next();
}

module.exports = requestLogger;
