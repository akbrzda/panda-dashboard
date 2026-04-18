import { apiClient } from "./httpClient";

const isNotFound = (error) => Number(error?.response?.status) === 404;

export const reportsApi = {
  async getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/reports/revenue",
      {
        organizationId,
        dateFrom,
        dateTo,
        lflDateFrom,
        lflDateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/reports/operational",
      {
        organizationId,
        dateFrom,
        dateTo,
        lflDateFrom,
        lflDateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getCourierRoutes({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/courier-routes",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getHourlySales({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/hourly-sales",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getProductionForecast({ organizationId, dateFrom, dateTo, forecastDate, signal }) {
    const response = await apiClient.post(
      "/reports/production-forecast",
      {
        organizationId,
        dateFrom,
        dateTo,
        forecastDate,
      },
      { signal },
    );
    return response.data;
  },

  async getSla({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/sla",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getCourierKpi({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/courier-kpi",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getMarketingSources({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/marketing-sources",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliverySummary({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/delivery-summary",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliveryDelays({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/delivery-delays",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async exportDeliveryDelays({ organizationId, dateFrom, dateTo, signal }) {
    return await apiClient.post(
      "/reports/delivery-delays/export",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      {
        signal,
        responseType: "blob",
      },
    );
  },

  async getCourierMap({ organizationId, dateFrom, dateTo, terminalGroupId, statuses, sourceKeys, courierIds, signal }) {
    const response = await apiClient.post(
      "/reports/delivery-heatmap",
      {
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliveryHeatmap({ organizationId, dateFrom, dateTo, terminalGroupId, statuses, sourceKeys, courierIds, signal }) {
    const response = await apiClient.post(
      "/reports/delivery-heatmap",
      {
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliveryZones({ organizationId, terminalGroupId, signal }) {
    try {
      const response = await apiClient.get("/reports/delivery-zones", {
        params: { organizationId, terminalGroupId },
        signal,
      });
      return response.data;
    } catch (error) {
      if (isNotFound(error)) {
        return {
          success: true,
          data: {
            organizationId,
            terminalGroupId: terminalGroupId || "__all__",
            zonesConfigured: false,
            zonesCount: 0,
            updatedAt: null,
            version: 0,
            geoJson: null,
          },
        };
      }
      throw error;
    }
  },

  async saveDeliveryZones({ organizationId, terminalGroupId, geoJson, signal }) {
    const response = await apiClient.post(
      "/reports/delivery-zones/upload",
      {
        organizationId,
        terminalGroupId,
        geoJson,
      },
      { signal },
    );
    return response.data;
  },

  async getPromotions({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/promotions",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getProductAbc({ organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50, signal }) {
    const response = await apiClient.post(
      "/reports/product-abc",
      {
        organizationId,
        dateFrom,
        dateTo,
        abcGroup,
        page,
        limit,
      },
      { signal },
    );
    return response.data;
  },

  async getMenuAbc(params) {
    return await this.getProductAbc(params);
  },
};
