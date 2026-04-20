const olapRepository = require("../shared/olapRepository");
const deliveryReports = require("../shared/deliveryReports");

class DeliveryAnalyticsService {
  async getSlaReport({ organizationId, dateFrom, dateTo, reconciliationMode = false }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const rows = await olapRepository.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo });
    return {
      ...deliveryReports.buildSlaReport(rows, timezone, olapRepository, { reconciliationMode }),
      timezone,
      source: "server-olap",
    };
  }

  async getCourierKpiReport({ organizationId, dateFrom, dateTo, reconciliationMode = false }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const orders = await olapRepository.getCloudDeliveryOrders({ organizationId, dateFrom, dateTo, timezone });
    return {
      ...deliveryReports.buildCourierKpiReport([], timezone, olapRepository, { preparedOrders: orders, reconciliationMode }),
      timezone,
      source: "iiko-cloud",
    };
  }

  async getDeliverySummaryReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const orders = await olapRepository.getCloudDeliveryOrders({ organizationId, dateFrom, dateTo, timezone });
    return {
      ...deliveryReports.buildDeliverySummaryReport([], timezone, olapRepository, { preparedOrders: orders }),
      timezone,
      source: "iiko-cloud",
    };
  }

  async getDeliveryDelaysReport({ organizationId, dateFrom, dateTo, reconciliationMode = false }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const orders = await olapRepository.getCloudDeliveryOrders({ organizationId, dateFrom, dateTo, timezone });
    return {
      ...deliveryReports.buildDeliveryDelaysReport([], timezone, olapRepository, { preparedOrders: orders, reconciliationMode }),
      timezone,
      source: "iiko-cloud",
    };
  }

  async exportDeliveryDelaysReport({ organizationId, dateFrom, dateTo }) {
    return await olapRepository.exportDeliveryDelaysReport({ organizationId, dateFrom, dateTo });
  }

  async getCourierRoutesReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const orders = await olapRepository.getCloudDeliveryOrders({ organizationId, dateFrom, dateTo, timezone });
    return {
      ...deliveryReports.buildRouteStats([], olapRepository, { preparedOrders: orders }),
      timezone,
      source: "iiko-cloud",
    };
  }
}

module.exports = new DeliveryAnalyticsService();
