import axios from "axios";
import { toast } from "@/lib/sonner";

function resolveApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || "/api";
}

function resolveApiKey() {
  return import.meta.env.VITE_API_KEY || "";
}

const API_BASE_URL = resolveApiBaseUrl();
const API_KEY = resolveApiKey();
const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
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

    const payloadError = error.response?.data?.error;
    const message =
      (typeof payloadError === "string" ? payloadError : payloadError?.message) ||
      error.response?.data?.message ||
      error.message ||
      "Не удалось выполнить запрос";
    console.error("❌ API Response Error:", error.response?.status, error.response?.data || error.message);
    toast.error("Ошибка запроса", message);
    return Promise.reject(error);
  },
);

export { API_BASE_URL, isAbortError };
