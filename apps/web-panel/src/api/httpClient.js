import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    console.log("🌐 API Request:", config.method.toUpperCase(), config.url, config.params);
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    if (isAbortError(error)) {
      return Promise.reject(error);
    }

    console.error("❌ API Response Error:", error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  },
);

export { API_BASE_URL, isAbortError };
