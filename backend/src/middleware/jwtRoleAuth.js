const crypto = require("crypto");

function parseBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header) return "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

function base64UrlDecode(input) {
  const normalized = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function verifySignature(token, secret) {
  const [headerPart, payloadPart, signaturePart] = String(token || "").split(".");
  if (!headerPart || !payloadPart || !signaturePart) return false;

  const data = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(signaturePart);

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parsePayload(token) {
  const [, payloadPart] = String(token || "").split(".");
  if (!payloadPart) return null;
  try {
    return JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    return null;
  }
}

function createJwtRoleAuthMiddleware(options = {}) {
  const { secret, allowedRoles = ["owner", "manager", "viewer"], bypassPrefixes = ["/webhooks/iiko", "/stop-lists/events"] } = options;
  if (!secret) {
    throw new Error("JWT_SECRET обязателен для режима AUTH_MODE=jwt");
  }

  return (req, res, next) => {
    const requestPath = req.path || "";
    if (bypassPrefixes.some((prefix) => requestPath.startsWith(prefix))) {
      return next();
    }

    const token = parseBearerToken(req);
    if (!token || !verifySignature(token, secret)) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Некорректный JWT-токен" });
    }

    const payload = parsePayload(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Некорректная структура JWT" });
    }

    const role = String(payload.role || "").toLowerCase();
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: "Forbidden", message: "Недостаточно прав" });
    }

    const expiresAt = Number(payload.exp || 0);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && Math.floor(Date.now() / 1000) >= expiresAt) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "JWT-токен истек" });
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !["owner", "manager"].includes(role)) {
      return res.status(403).json({ success: false, error: "Forbidden", message: "Роль viewer не может изменять данные" });
    }

    req.user = {
      role,
      subject: payload.sub || null,
    };
    return next();
  };
}

module.exports = {
  createJwtRoleAuthMiddleware,
};
