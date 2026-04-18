const reportsService = require("../../service");

class AssortmentReportsDomain {
  async getMenuAbc(params) {
    return await reportsService.getMenuAbcReport(params);
  }

  async getMenuAssortment(params) {
    return await this.getMenuAbc(params);
  }
}

module.exports = new AssortmentReportsDomain();
