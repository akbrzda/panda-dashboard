const config = require("../config");

class OrganizationController {
  async getOrganizations(req, res) {
    try {
      // Возвращаем организации из конфигурации без обращения к API
      res.json({
        success: true,
        organizations: config.organizations,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new OrganizationController();
