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
};
