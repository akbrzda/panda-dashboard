const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envPaths = [path.join(__dirname, "..", "..", ".env"), path.join(__dirname, "..", "..", "..", ".env")];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const env = String(process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();
const isLocalEnv = env === "development" || env === "test";

function resolveAuthMode() {
  const explicitAuthMode = String(process.env.AUTH_MODE || "")
    .trim()
    .toLowerCase();

  if (["none", "api-key", "jwt"].includes(explicitAuthMode)) {
    return explicitAuthMode;
  }

  if (process.env.JWT_SECRET) {
    return "jwt";
  }

  if (process.env.API_KEY) {
    return "api-key";
  }

  return "none";
}

function resolveCorsOrigin() {
  const configuredOrigin = String(process.env.CORS_ORIGIN || "").trim();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (isLocalEnv) {
    return "http://localhost:5173,http://127.0.0.1:5173";
  }

  return "";
}

const config = {
  port: Number(process.env.PORT || 3000),
  env,
  authMode: resolveAuthMode(),
  apiKey: process.env.API_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "",

  iiko: {
    apiLogin: process.env.IIKO_API_LOGIN,
    baseUrl: process.env.IIKO_API_BASE_URL || "https://api-ru.iiko.services/api/1",
    externalMenuId: process.env.IIKO_EXTERNAL_MENU_ID || "",
    priceCategoryId: process.env.IIKO_PRICE_CATEGORY_ID || "",
    menuLanguage: process.env.IIKO_MENU_LANGUAGE || "ru",
    menuVersion: Number(process.env.IIKO_MENU_VERSION || 2),
  },

  cors: {
    origin: resolveCorsOrigin(),
    credentials: true,
  },
};

module.exports = config;
