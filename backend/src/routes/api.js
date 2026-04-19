const express = require("express");
const router = express.Router();
const { createApiKeyAuthMiddleware } = require("../middleware/apiKeyAuth");
const { createJwtRoleAuthMiddleware } = require("../middleware/jwtRoleAuth");
const config = require("../config");
const organizationsModule = require("../modules/organizations");
const stopListModule = require("../modules/stopList");
const revenueModule = require("../modules/revenue");
const dashboardModule = require("../modules/dashboard");
const reportsModule = require("../modules/reports");
const foodcostModule = require("../modules/foodcost");
const topDishesModule = require("../modules/topDishes");
const clientsModule = require("../modules/clients");
const clientAnalyticsModule = require("../modules/clientAnalytics");
const plansModule = require("../modules/plans");
const webhookModule = require("../modules/webhook");

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

const authMiddleware =
  config.authMode === "jwt"
    ? createJwtRoleAuthMiddleware({
        secret: config.jwtSecret,
      })
    : config.authMode === "api-key"
      ? createApiKeyAuthMiddleware({
          apiKey: config.apiKey,
        })
      : null;

if (authMiddleware) {
  router.use(authMiddleware);
}

router.use("/organizations", organizationsModule.routes);
router.use("/stop-lists", stopListModule.routes);
router.use("/revenue", revenueModule.routes);
router.use("/dashboard", dashboardModule.routes);
router.use("/reports", reportsModule.routes);
router.use("/foodcost", foodcostModule.routes);
router.use("/top-dishes", topDishesModule.routes);
router.use("/clients", clientsModule.routes);
router.use("/client-analytics", clientAnalyticsModule.routes);
router.use("/plans", plansModule.routes);
router.use("/", webhookModule.routes);

module.exports = router;
