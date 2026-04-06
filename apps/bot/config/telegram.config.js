/**
 * Telegram Bot конфигурация
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

module.exports = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  NOTIFY_GROUP: process.env.NOTIFY_GROUP,
  NOTIFY_THREAD: process.env.NOTIFY_THREAD,
  LOGS_GROUP: process.env.LOGS_GROUP,
  LOGS_THREAD: process.env.LOGS_THREAD,
  ORGANIZATIONS: JSON.parse(process.env.ORGANIZATIONS || "[]"),
  ADMIN_IDS: JSON.parse(process.env.ADMIN_IDS || "[]"),
  getActiveOrganizations() {
    return this.ORGANIZATIONS.filter((org) => org.iikoId !== 151474);
  },

  isAdmin(userId) {
    return this.ADMIN_IDS.includes(userId);
  },

  validate() {
    const errors = [];

    if (!this.BOT_TOKEN) {
      errors.push("TELEGRAM_BOT_TOKEN not set");
    }
    if (!this.NOTIFY_GROUP) {
      errors.push("NOTIFY_GROUP not set");
    }
    if (!this.NOTIFY_THREAD) {
      errors.push("NOTIFY_THREAD not set");
    }
    if (!this.LOGS_GROUP) {
      errors.push("LOGS_GROUP not set");
    }
    if (!this.LOGS_THREAD) {
      errors.push("LOGS_THREAD not set");
    }
    if (this.ORGANIZATIONS.length === 0) {
      errors.push("ORGANIZATIONS not set");
    }

    if (errors.length > 0) {
      throw new Error("Config validation failed:\n" + errors.join("\n"));
    }

    return true;
  },
};
