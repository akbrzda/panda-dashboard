import { apiClient } from "./httpClient";

export const dashboardApi = {
  async getDashboard({ organizationIds, date, signal }) {
    const response = await apiClient.post("/dashboard", { organizationIds, date }, { signal });
    return response.data;
  },
};
