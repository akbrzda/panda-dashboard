const express = require("express");
const foodcostController = require("./controller");

const router = express.Router();

router.post("/", foodcostController.getFoodcost.bind(foodcostController));

module.exports = router;
