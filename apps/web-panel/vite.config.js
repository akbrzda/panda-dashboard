import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";
  const enableRemoteHmr = String(env.VITE_ENABLE_REMOTE_HMR || "false").toLowerCase() === "true";

  const hmr =
    enableRemoteHmr && env.VITE_HMR_HOST
      ? {
          host: env.VITE_HMR_HOST,
          protocol: env.VITE_HMR_PROTOCOL || "wss",
          clientPort: env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : 443,
        }
      : undefined;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      port: 5173,
      strictPort: true,
      hmr: hmr || false,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 180000,
          proxyTimeout: 180000,
        },
      },
    },
  };
});
