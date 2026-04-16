const express = require("express");
const analyticsController = require("./controller");

const router = express.Router();

router.post("/revenue", analyticsController.getRevenue.bind(analyticsController));
router.post("/dashboard", analyticsController.getDashboard.bind(analyticsController));
router.post("/hourly-sales", analyticsController.getHourlySales.bind(analyticsController));
router.post("/operational", analyticsController.getOperational.bind(analyticsController));
router.post("/courier-routes", analyticsController.getCourierRoutes.bind(analyticsController));
router.post("/foodcost", analyticsController.getFoodcost.bind(analyticsController));
router.post("/top-dishes", analyticsController.getTopDishes.bind(analyticsController));
router.get("/clients", analyticsController.getClients.bind(analyticsController));

module.exports = router;
