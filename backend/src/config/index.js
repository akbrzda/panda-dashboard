const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const config = {
  port: Number(process.env.PORT || 3000),
  env: process.env.NODE_ENV || "development",

  iiko: {
    apiLogin: process.env.IIKO_API_LOGIN,
    baseUrl: process.env.IIKO_API_BASE_URL || "https://api-ru.iiko.services/api/1",
    externalMenuId: process.env.IIKO_EXTERNAL_MENU_ID || "",
    priceCategoryId: process.env.IIKO_PRICE_CATEGORY_ID || "",
    menuLanguage: process.env.IIKO_MENU_LANGUAGE || "ru",
    menuVersion: Number(process.env.IIKO_MENU_VERSION || 2),
  },

  organizations: (() => {
    try {
      return JSON.parse(process.env.ORGANIZATIONS || "[]");
    } catch (e) {
      console.error("Error parsing ORGANIZATIONS from .env:", e);
      return [];
    }
  })(),

  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },
};

module.exports = config;
