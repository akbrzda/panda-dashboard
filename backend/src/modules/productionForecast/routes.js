const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.post("/", controller.getForecast.bind(controller));

module.exports = router;
