const express = require("express");
const plansController = require("./controller");

const router = express.Router();

router.get("/", plansController.getPlans.bind(plansController));
router.post("/", plansController.createPlan.bind(plansController));
router.put("/:id", plansController.updatePlan.bind(plansController));
router.delete("/:id", plansController.deletePlan.bind(plansController));

module.exports = router;
