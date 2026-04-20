const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.get("/", controller.getHeatmap.bind(controller));
router.post("/", controller.getHeatmap.bind(controller));

module.exports = router;
