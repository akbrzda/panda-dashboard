import { apiClient } from "./httpClient";

export const stopListsApi = {
  async getStopLists(organizationId, timezone, signal) {
    const resolvedTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/stop-lists", {
      params: {
        organizationId,
        timezone: resolvedTimezone,
      },
      signal,
    });

    return response.data;
  },
};
