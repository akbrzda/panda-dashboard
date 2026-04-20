const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.post("/product-abc", controller.getProductAbc.bind(controller));

module.exports = router;
