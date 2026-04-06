const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const stopListController = require("../controllers/stopListController");
const revenueController = require("../controllers/revenueController");

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Organizations
router.get("/organizations", organizationController.getOrganizations.bind(organizationController));

// Stop lists
router.get("/stop-lists", stopListController.getStopLists.bind(stopListController));

// Revenue reports
router.get("/revenue/report", revenueController.getRevenueReport.bind(revenueController));
router.get("/revenue/daily", revenueController.getDailyRevenue.bind(revenueController));

module.exports = router;
