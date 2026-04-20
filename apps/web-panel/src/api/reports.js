import { apiClient } from "./httpClient";

const isNotFound = (error) => Number(error?.response?.status) === 404;

export const reportsApi = {
  async getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/sales-summary/revenue",
      {
        organizationId,
        dateFrom,
        dateTo,
        lflDateFrom,
        lflDateTo,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/sales-summary/operational",
      {
        organizationId,
        dateFrom,
        dateTo,
        lflDateFrom,
        lflDateTo,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getCourierRoutes({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/delivery-analytics/courier-routes",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getHourlySales({ organizationId, dateFrom, dateTo, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/sales-summary/hourly",
      {
        organizationId,
        dateFrom,
        dateTo,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getProductionForecast({ organizationId, forecastDate, analysisWindowDays, signal }) {
    const response = await apiClient.post(
      "/production-forecast",
      {
        organizationId,
        forecastDate,
        analysisWindowDays,
      },
      { signal },
    );
    return response.data;
  },

  async getSla({ organizationId, dateFrom, dateTo, reconciliationMode = false, signal }) {
    const response = await apiClient.post(
      "/delivery-analytics/sla",
      {
        organizationId,
        dateFrom,
        dateTo,
        reconciliationMode,
      },
      { signal },
    );
    return response.data;
  },

  async getCourierKpi({ organizationId, dateFrom, dateTo, reconciliationMode = false, signal }) {
    const response = await apiClient.post(
      "/delivery-analytics/courier-kpi",
      {
        organizationId,
        dateFrom,
        dateTo,
        reconciliationMode,
      },
      { signal },
    );
    return response.data;
  },

  async getMarketingSources({ organizationId, dateFrom, dateTo, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/marketing-analytics/sources",
      {
        organizationId,
        dateFrom,
        dateTo,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliverySummary({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/delivery-analytics/summary",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getDeliveryDelays({ organizationId, dateFrom, dateTo, reconciliationMode = false, signal }) {
    const response = await apiClient.post(
      "/delivery-analytics/delays",
      {
        organizationId,
        dateFrom,
        dateTo,
        reconciliationMode,
      },
      { signal },
    );
    return response.data;
  },

  async exportDeliveryDelays({ organizationId, dateFrom, dateTo, signal }) {
    return await apiClient.post(
      "/delivery-analytics/delays/export",
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
      "/delivery-heatmap",
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
      "/delivery-heatmap",
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
      const response = await apiClient.get("/delivery-zones", {
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
      "/delivery-zones/upload",
      {
        organizationId,
        terminalGroupId,
        geoJson,
      },
      { signal },
    );
    return response.data;
  },

  async getPromotions({ organizationId, dateFrom, dateTo, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/marketing-analytics/promotions",
      {
        organizationId,
        dateFrom,
        dateTo,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getProductAbc({ organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50, completedOnly = true, signal }) {
    const response = await apiClient.post(
      "/assortment-analytics/product-abc",
      {
        organizationId,
        dateFrom,
        dateTo,
        abcGroup,
        page,
        limit,
        completedOnly,
      },
      { signal },
    );
    return response.data;
  },

  async getMenuAbc(params) {
    return await this.getProductAbc(params);
  },
};
