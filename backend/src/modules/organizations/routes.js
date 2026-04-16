const express = require("express");
const organizationController = require("./controller");

const router = express.Router();

router.get("/", organizationController.getOrganizations.bind(organizationController));

module.exports = router;
