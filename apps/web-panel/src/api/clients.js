import { apiClient } from "./httpClient";

export const clientsApi = {
  async getClients({ organizationId, dateFrom, dateTo, terminalGroupId, statuses, includeProfile, profileMode, profileLimit, refresh, signal }) {
    const response = await apiClient.get("/client-analytics", {
      params: {
        organizationId,
        from: dateFrom,
        to: dateTo,
        terminalGroupId: terminalGroupId || undefined,
        statuses: Array.isArray(statuses) && statuses.length > 0 ? statuses : undefined,
        includeProfile: includeProfile ? "true" : undefined,
        profileMode: includeProfile ? profileMode : undefined,
        profileLimit: includeProfile ? profileLimit : undefined,
        refresh: refresh ? "true" : undefined,
      },
      signal,
    });
    return response.data;
  },
};
