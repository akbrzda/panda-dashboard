const express = require("express");
const clientAnalyticsController = require("./controller");

const router = express.Router();

router.get("/", clientAnalyticsController.getClientAnalytics.bind(clientAnalyticsController));

module.exports = router;
