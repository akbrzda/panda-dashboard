import { apiClient } from "./httpClient";

export const stopListsApi = {
  async getStopLists(organizationId) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/stop-lists", {
      params: {
        organizationId,
        timezone,
      },
    });

    return response.data;
  },
};
