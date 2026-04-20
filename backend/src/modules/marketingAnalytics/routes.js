const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.post("/sources", controller.getSources.bind(controller));
router.post("/promotions", controller.getPromotions.bind(controller));

module.exports = router;
