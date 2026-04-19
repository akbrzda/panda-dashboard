import { apiClient } from "./httpClient";

export const plansApi = {
  async getPlans(params = {}) {
    const response = await apiClient.get("/plans", { params });
    return response.data;
  },

  async createPlan(payload) {
    const response = await apiClient.post("/plans", payload);
    return response.data;
  },

  async getMonthlyRevenueDistribution(payload) {
    const response = await apiClient.post("/plans/monthly-revenue-distribution", payload);
    return response.data;
  },

  async updatePlan(id, payload) {
    const response = await apiClient.put(`/plans/${id}`, payload);
    return response.data;
  },

  async deletePlan(id) {
    const response = await apiClient.delete(`/plans/${id}`);
    return response.data;
  },
};
