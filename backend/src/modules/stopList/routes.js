const express = require("express");
const stopListController = require("./controller");
const { stopListRefreshRateLimit } = require("../../middleware/stopListRateLimit");

const router = express.Router();

router.get("/", stopListRefreshRateLimit, stopListController.getStopLists.bind(stopListController));

module.exports = router;
