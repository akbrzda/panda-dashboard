const reportsService = require("../../service");

class MarketingReportsDomain {
  async getMarketingSources(params) {
    return await reportsService.getMarketingSourcesReport(params);
  }

  async getPromotions(params) {
    return await reportsService.getPromotionsReport(params);
  }
}

module.exports = new MarketingReportsDomain();

