import { apiClient } from "./httpClient";

export const topDishesApi = {
  async getTopDishes({ organizationId, dateFrom, dateTo, limit, signal }) {
    const response = await apiClient.post(
      "/top-dishes",
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
};
