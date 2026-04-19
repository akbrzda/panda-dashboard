const { TTLCache } = require("../../../packages/shared/cache");

module.exports = new TTLCache(15 * 60 * 1000);
