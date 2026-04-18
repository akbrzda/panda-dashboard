import { defineStore } from "pinia";
import { ref } from "vue";
import { dashboardApi } from "../api/dashboard";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useDashboardStore = defineStore("dashboard", () => {
  const dashboardData = ref(null);
  const isLoadingDashboard = ref(false);
  const error = ref(null);

  let controller = null;
  let requestId = 0;

  async function loadDashboard({ organizationIds, date }) {
    if (!date) return null;

    controller?.abort();
    controller = new AbortController();
    requestId += 1;
    const currentRequestId = requestId;

    try {
      isLoadingDashboard.value = true;
      error.value = null;

      const resp = await dashboardApi.getDashboard({ organizationIds, date, signal: controller.signal });
      if (currentRequestId !== requestId) return null;

      dashboardData.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === requestId) {
        error.value = e.message || "Ошибка загрузки дашборда";
        console.error("❌ dashboardStore.loadDashboard:", e);
      }
      throw e;
    } finally {
      if (currentRequestId === requestId) {
        isLoadingDashboard.value = false;
        controller = null;
      }
    }
  }

  function stopAll() {
    controller?.abort();
    controller = null;
    requestId += 1;
    isLoadingDashboard.value = false;
  }

  function reset() {
    stopAll();
    dashboardData.value = null;
    error.value = null;
  }

  return {
    dashboardData,
    isLoadingDashboard,
    error,
    loadDashboard,
    stopAll,
    reset,
  };
});
