const WINDOW_MS = 30 * 1000;

const refreshWindowByIp = new Map();

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

function cleanupExpired(nowTs) {
  for (const [ip, expiresAt] of refreshWindowByIp.entries()) {
    if (expiresAt <= nowTs) {
      refreshWindowByIp.delete(ip);
    }
  }
}

function stopListRefreshRateLimit(req, res, next) {
  const wantsRefresh = parseBoolean(req.query?.refresh);
  if (!wantsRefresh) {
    return next();
  }

  const now = Date.now();
  cleanupExpired(now);

  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const currentWindowEnd = refreshWindowByIp.get(ip) || 0;

  if (currentWindowEnd > now) {
    const retryAfterSec = Math.ceil((currentWindowEnd - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: "Too Many Requests",
      message: "Обновление стоп-листа доступно не чаще 1 раза в 30 секунд на IP",
      retryAfterSec,
    });
  }

  refreshWindowByIp.set(ip, now + WINDOW_MS);
  return next();
}

module.exports = {
  stopListRefreshRateLimit,
};

