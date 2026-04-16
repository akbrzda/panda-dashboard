const express = require("express");
const reportsController = require("./controller");

const router = express.Router();

router.post("/revenue", reportsController.getRevenue.bind(reportsController));
router.post("/operational", reportsController.getOperational.bind(reportsController));
router.post("/courier-routes", reportsController.getCourierRoutes.bind(reportsController));

module.exports = router;
