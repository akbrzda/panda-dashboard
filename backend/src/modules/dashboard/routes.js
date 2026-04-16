const express = require("express");
const dashboardController = require("./controller");

const router = express.Router();

router.post("/", dashboardController.getDashboard.bind(dashboardController));

module.exports = router;
