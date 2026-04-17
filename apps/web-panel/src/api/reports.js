import { apiClient } from "./httpClient";

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

  async getCourierMap({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/courier-map",
      {
        organizationId,
        dateFrom,
        dateTo,
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

  async getMenuAssortment({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/reports/menu-assortment",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },
};
