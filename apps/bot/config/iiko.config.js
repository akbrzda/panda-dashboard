/**
 * iiko конфигурация
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

module.exports = {
  SERVER_BASE_URL: process.env.IIKO_SERVER_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_API_BASE_URL,
  LEGACY_BASE_URL: process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL,
  BASE_URL: process.env.IIKO_SERVER_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_API_BASE_URL,
  USERNAME: process.env.IIKO_USER,
  PASSWORD: process.env.IIKO_PASSWORD,
  TIMEOUT: 30000,
  POLL_INTERVAL: 500,
  MAX_ATTEMPTS: 120,

  validate() {
    const errors = [];

    if (!this.BASE_URL) {
      errors.push("IIKO_BASE_URL not set");
    }
    if (!this.USERNAME) {
      errors.push("IIKO_USER not set");
    }
    if (!this.PASSWORD) {
      errors.push("IIKO_PASSWORD not set");
    }

    if (errors.length > 0) {
      throw new Error("iiko Config validation failed:\n" + errors.join("\n"));
    }

    return true;
  },
};
