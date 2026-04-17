const reportsService = require("../../service");

class AssortmentReportsDomain {
  async getMenuAssortment(params) {
    return await reportsService.getMenuAssortmentReport(params);
  }
}

module.exports = new AssortmentReportsDomain();

