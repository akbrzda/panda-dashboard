const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.post("/revenue", controller.getRevenue.bind(controller));
router.post("/hourly", controller.getHourlySales.bind(controller));
router.post("/operational", controller.getOperational.bind(controller));

module.exports = router;
