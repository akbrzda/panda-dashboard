const organizationsService = require("./service");

class OrganizationsController {
  async getOrganizations(req, res) {
    try {
      const organizations = await organizationsService.getOrganizations();

      res.json({
        success: true,
        source: "iiko-api",
        organizations,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new OrganizationsController();
