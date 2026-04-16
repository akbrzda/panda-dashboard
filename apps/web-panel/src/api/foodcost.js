import { apiClient } from "./httpClient";

export const foodcostApi = {
  async getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }) {
    const response = await apiClient.post(
      "/foodcost",
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
};
