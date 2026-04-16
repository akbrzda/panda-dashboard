const express = require("express");
const stopListController = require("./controller");

const router = express.Router();

router.get("/", stopListController.getStopLists.bind(stopListController));

module.exports = router;
