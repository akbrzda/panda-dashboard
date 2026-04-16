const express = require("express");
const topDishesController = require("./controller");

const router = express.Router();

router.post("/", topDishesController.getTopDishes.bind(topDishesController));

module.exports = router;
