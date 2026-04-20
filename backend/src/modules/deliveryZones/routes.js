const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.get("/", controller.getZones.bind(controller));
router.post("/", controller.saveZones.bind(controller));
router.post("/upload", controller.saveZones.bind(controller));

module.exports = router;
