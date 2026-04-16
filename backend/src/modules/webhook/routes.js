const express = require("express");
const webhookController = require("./controller");

const router = express.Router();

router.get("/stop-lists/events", webhookController.stopListEvents);
router.post("/webhooks/iiko", webhookController.receiveIikoWebhook);
router.post("/webhooks/iiko/register", webhookController.registerIikoWebhook);

module.exports = router;
