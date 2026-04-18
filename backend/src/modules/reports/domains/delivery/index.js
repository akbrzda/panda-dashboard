const reportsService = require("../../service");

class DeliveryReportsDomain {
  async getCourierRoutes(params) {
    return await reportsService.getCourierRoutes(params);
  }

  async getSla(params) {
    return await reportsService.getSlaReport(params);
  }

  async getCourierKpi(params) {
    return await reportsService.getCourierKpiReport(params);
  }

  async getDeliverySummary(params) {
    return await reportsService.getDeliverySummaryReport(params);
  }

  async getDeliveryDelays(params) {
    return await reportsService.getDeliveryDelaysReport(params);
  }

  async exportDeliveryDelays(params) {
    return await reportsService.exportDeliveryDelaysReport(params);
  }

  async getCourierMap(params) {
    return await reportsService.getCourierMapReport(params);
  }

  async getDeliveryHeatmap(params) {
    return await reportsService.getDeliveryHeatmapReport(params);
  }

  async getDeliveryZones(params) {
    return await reportsService.getDeliveryZones(params);
  }

  async saveDeliveryZones(params) {
    return await reportsService.saveDeliveryZones(params);
  }
}

module.exports = new DeliveryReportsDomain();
