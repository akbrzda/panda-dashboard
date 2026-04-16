import axios from "axios";
import { toast } from "@/lib/sonner";

function resolveApiBaseUrl() {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const proxyTarget = String(import.meta.env.VITE_API_PROXY_TARGET || "").replace(/\/+$/, "");

  if (typeof window === "undefined") {
    return rawBaseUrl;
  }

  const isRelativeBaseUrl = rawBaseUrl.startsWith("/");
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (isRelativeBaseUrl && !isLocalHost && proxyTarget) {
    return `${proxyTarget}${rawBaseUrl}`;
  }

  return rawBaseUrl;
}

const API_BASE_URL = resolveApiBaseUrl();
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

    const message = error.response?.data?.error || error.response?.data?.message || error.message || "Не удалось выполнить запрос";
    console.error("❌ API Response Error:", error.response?.status, error.response?.data || error.message);
    toast.error("Ошибка запроса", message);
    return Promise.reject(error);
  },
);

export { API_BASE_URL, isAbortError };
