import { apiClient } from "./httpClient";

export const stopListsApi = {
  async getStopLists(organizationId, timezone, signal, refresh = false) {
    const resolvedTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/stop-lists", {
      params: {
        organizationId,
        timezone: resolvedTimezone,
        refresh,
      },
      signal,
    });

    return response.data?.data || response.data;
  },
};
