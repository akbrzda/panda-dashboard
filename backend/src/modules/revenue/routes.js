const express = require("express");
const revenueController = require("./controller");

const router = express.Router();

router.get("/report", revenueController.getRevenueReport.bind(revenueController));
router.get("/daily", revenueController.getDailyRevenue.bind(revenueController));

module.exports = router;
