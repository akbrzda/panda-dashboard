import { apiClient } from "./httpClient";

const DEFAULT_ORGANIZATION_TIMEZONE = "Europe/Moscow";

export const revenueApi = {
  async getRevenueReport(organizationId, startDate, endDate, signal, timezone = DEFAULT_ORGANIZATION_TIMEZONE) {
    const response = await apiClient.get("/revenue/report", {
      params: {
        organizationId,
        startDate,
        endDate,
        timezone: timezone || DEFAULT_ORGANIZATION_TIMEZONE,
      },
      signal,
    });

    return response.data;
  },

  async getDailyRevenue(organizationId, date, signal, timezone = DEFAULT_ORGANIZATION_TIMEZONE) {
    const response = await apiClient.get("/revenue/daily", {
      params: {
        organizationId,
        date,
        timezone: timezone || DEFAULT_ORGANIZATION_TIMEZONE,
      },
      signal,
    });

    return response.data;
  },
};
