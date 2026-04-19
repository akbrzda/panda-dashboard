const { randomUUID } = require("crypto");
const fileLogger = require("../utils/fileLogger");
const { runWithRequestContext } = require("../utils/requestContext");

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const correlationId = String(req.get("x-correlation-id") || randomUUID()).trim();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);

  runWithRequestContext({ correlationId }, () => {
    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const details = {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };

      if (res.statusCode >= 500) {
        fileLogger.error("HTTP 5xx ответ", details);
        return;
      }

      if (res.statusCode >= 400) {
        fileLogger.warn("HTTP 4xx ответ", details);
        return;
      }

      fileLogger.info("HTTP запрос", details);
    });

    next();
  });
}

module.exports = requestLogger;
