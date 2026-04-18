const express = require("express");
const reportsController = require("./controller");

const router = express.Router();

router.post("/revenue", reportsController.getRevenue.bind(reportsController));
router.post("/operational", reportsController.getOperational.bind(reportsController));
router.post("/courier-routes", reportsController.getCourierRoutes.bind(reportsController));
router.post("/hourly-sales", reportsController.getHourlySales.bind(reportsController));
router.post("/production-forecast", reportsController.getProductionForecast.bind(reportsController));
router.post("/sla", reportsController.getSla.bind(reportsController));
router.post("/courier-kpi", reportsController.getCourierKpi.bind(reportsController));
router.post("/marketing-sources", reportsController.getMarketingSources.bind(reportsController));
router.post("/delivery-summary", reportsController.getDeliverySummary.bind(reportsController));
router.post("/delivery-delays", reportsController.getDeliveryDelays.bind(reportsController));
router.post("/delivery-delays/export", reportsController.exportDeliveryDelays.bind(reportsController));
router.post("/courier-map", reportsController.getCourierMap.bind(reportsController));
router.get("/delivery-heatmap", reportsController.getDeliveryHeatmapQuery.bind(reportsController));
router.post("/delivery-heatmap", reportsController.getDeliveryHeatmap.bind(reportsController));
router.get("/delivery-zones", reportsController.getDeliveryZones.bind(reportsController));
router.post("/delivery-zones", reportsController.saveDeliveryZones.bind(reportsController));
router.post("/delivery-zones/upload", reportsController.saveDeliveryZones.bind(reportsController));
router.post("/promotions", reportsController.getPromotions.bind(reportsController));
router.post("/menu-assortment", reportsController.getMenuAssortment.bind(reportsController));

module.exports = router;
