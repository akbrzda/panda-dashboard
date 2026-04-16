import { apiClient } from "./httpClient";

export const clientsApi = {
  async getClients({ dateFrom, dateTo, signal }) {
    const response = await apiClient.get("/clients", { params: { dateFrom, dateTo }, signal });
    return response.data;
  },
};
