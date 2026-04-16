import { apiClient } from "./httpClient";

export const organizationsApi = {
  async getOrganizations() {
    const response = await apiClient.get("/organizations");
    return response.data;
  },
};
