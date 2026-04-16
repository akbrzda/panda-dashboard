import { apiClient } from "./httpClient";

export const analyticsApi = {
  async getDashboard({ organizationIds, date, signal }) {
    const response = await apiClient.post("/analytics/dashboard", { organizationIds, date }, { signal });
    return response.data;
  },

  async getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/analytics/revenue",
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

  async getHourlySales({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.post(
      "/analytics/hourly-sales",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/analytics/operational",
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
      "/analytics/courier-routes",
      {
        organizationId,
        dateFrom,
        dateTo,
      },
      { signal },
    );
    return response.data;
  },

  async getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/analytics/foodcost",
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

  async getTopDishes({ organizationId, dateFrom, dateTo, limit, signal }) {
    const response = await apiClient.post(
      "/analytics/top-dishes",
      {
        organizationId,
        dateFrom,
        dateTo,
        limit,
      },
      { signal },
    );
    return response.data;
  },

  async getClients({ dateFrom, dateTo, signal }) {
    const response = await apiClient.get("/analytics/clients", { params: { dateFrom, dateTo }, signal });
    return response.data;
  },
};
