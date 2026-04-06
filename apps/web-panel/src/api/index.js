import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor для логирования
apiClient.interceptors.request.use(
  (config) => {
    console.log("🌐 API Request:", config.method.toUpperCase(), config.url, config.params);
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor для логирования
apiClient.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    console.error("❌ API Response Error:", error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const organizationsApi = {
  async getOrganizations() {
    const response = await apiClient.get("/organizations");
    return response.data;
  },
};

export const stopListsApi = {
  async getStopLists(organizationId) {
    // Получаем часовой пояс браузера пользователя
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

export const revenueApi = {
  async getRevenueReport(organizationId, startDate, endDate) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/revenue/report", {
      params: {
        organizationId,
        startDate,
        endDate,
        timezone,
      },
    });
    return response.data;
  },

  async getDailyRevenue(organizationId, date) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await apiClient.get("/revenue/daily", {
      params: {
        organizationId,
        date,
        timezone,
      },
    });
    return response.data;
  },
};

export default {
  organizations: organizationsApi,
  stopLists: stopListsApi,
  revenue: revenueApi,
};
