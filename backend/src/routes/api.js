const express = require("express");
const router = express.Router();
const organizationsModule = require("../modules/organizations");
const stopListModule = require("../modules/stopList");
const revenueModule = require("../modules/revenue");
const analyticsModule = require("../modules/analytics");
const webhookModule = require("../modules/webhook");

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.use("/organizations", organizationsModule.routes);
router.use("/stop-lists", stopListModule.routes);
router.use("/revenue", revenueModule.routes);
router.use("/analytics", analyticsModule.routes);
router.use("/", webhookModule.routes);

module.exports = router;
