const express = require("express");
const router = express.Router();
const organizationsModule = require("../modules/organizations");
const stopListModule = require("../modules/stopList");
const revenueModule = require("../modules/revenue");
const dashboardModule = require("../modules/dashboard");
const reportsModule = require("../modules/reports");
const foodcostModule = require("../modules/foodcost");
const topDishesModule = require("../modules/topDishes");
const clientsModule = require("../modules/clients");
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
router.use("/dashboard", dashboardModule.routes);
router.use("/reports", reportsModule.routes);
router.use("/foodcost", foodcostModule.routes);
router.use("/top-dishes", topDishesModule.routes);
router.use("/clients", clientsModule.routes);
router.use("/", webhookModule.routes);

module.exports = router;
