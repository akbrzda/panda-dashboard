const express = require("express");
const clientsController = require("./controller");

const router = express.Router();

router.get("/", clientsController.getClients.bind(clientsController));

module.exports = router;
