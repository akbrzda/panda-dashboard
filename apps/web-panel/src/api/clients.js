import { apiClient } from "./httpClient";

export const clientsApi = {
  async getClients({ organizationId, dateFrom, dateTo, signal }) {
    const response = await apiClient.get("/clients", { params: { organizationId, dateFrom, dateTo }, signal });
    return response.data;
  },
};
