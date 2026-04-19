const crypto = require("crypto");

function parseTokenFromHeader(req) {
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    return authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return "";
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createApiKeyAuthMiddleware(options = {}) {
  const {
    apiKey,
    // Вебхук IIKO использует отдельный секрет и не может передавать общий API-ключ.
    bypassPrefixes = ["/webhooks/iiko", "/stop-lists/events"],
  } = options;

  if (!apiKey) {
    throw new Error("API_KEY не задан. Базовая аутентификация API не может быть включена.");
  }

  return (req, res, next) => {
    const requestPath = req.path || "";
    if (bypassPrefixes.some((prefix) => requestPath.startsWith(prefix))) {
      return next();
    }

    const receivedKey = parseTokenFromHeader(req);
    if (!safeEqual(receivedKey, apiKey)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Неверный API-ключ",
      });
    }

    return next();
  };
}

module.exports = {
  createApiKeyAuthMiddleware,
};

