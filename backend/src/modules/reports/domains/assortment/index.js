const reportsService = require("../../service");

class AssortmentReportsDomain {
  async getProductAbc(params) {
    return await reportsService.getProductAbcReport(params);
  }

  async getMenuAbc(params) {
    return await this.getProductAbc(params);
  }
}

module.exports = new AssortmentReportsDomain();
