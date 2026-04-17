import { apiClient } from "./httpClient";

export const stopListsApi = {
  async getStopLists(organizationId, timezone) {
    const resolvedTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/stop-lists", {
      params: {
        organizationId,
        timezone: resolvedTimezone,
      },
    });

    return response.data;
  },
};
