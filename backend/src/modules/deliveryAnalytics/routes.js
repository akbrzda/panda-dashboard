const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.post("/sla", controller.getSla.bind(controller));
router.post("/courier-kpi", controller.getCourierKpi.bind(controller));
router.post("/summary", controller.getDeliverySummary.bind(controller));
router.post("/delays", controller.getDeliveryDelays.bind(controller));
router.post("/delays/export", controller.exportDeliveryDelays.bind(controller));
router.post("/courier-routes", controller.getCourierRoutes.bind(controller));

module.exports = router;
