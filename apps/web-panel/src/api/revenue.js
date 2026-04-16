import { apiClient } from "./httpClient";

export const revenueApi = {
  async getRevenueReport(organizationId, startDate, endDate, signal) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/revenue/report", {
      params: {
        organizationId,
        startDate,
        endDate,
        timezone,
      },
      signal,
    });

    return response.data;
  },

  async getDailyRevenue(organizationId, date, signal) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/revenue/daily", {
      params: {
        organizationId,
        date,
        timezone,
      },
      signal,
    });

    return response.data;
  },
};
