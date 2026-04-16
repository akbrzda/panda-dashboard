import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "../api/reports";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useReportsStore = defineStore("reports", () => {
  const revenueData = ref(null);
  const courierRoutes = ref(null);
  const isLoadingRevenue = ref(false);
  const isLoadingCourier = ref(false);
  const error = ref(null);

  let revenueController = null;
  let revenueRequestId = 0;
  let courierController = null;
  let courierRequestId = 0;

  async function loadRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    if (!organizationId || !dateFrom || !dateTo) return null;

    revenueController?.abort();
    revenueController = new AbortController();
    revenueRequestId += 1;
    const currentRequestId = revenueRequestId;

    try {
      isLoadingRevenue.value = true;
      error.value = null;

      const resp = await reportsApi.getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal: revenueController.signal });

      if (currentRequestId !== revenueRequestId) return null;

      revenueData.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === revenueRequestId) {
        error.value = e.message || "Ошибка загрузки отчета";
        console.error("❌ reportsStore.loadRevenue:", e);
      }
      return null;
    } finally {
      if (currentRequestId === revenueRequestId) {
        isLoadingRevenue.value = false;
        revenueController = null;
      }
    }
  }

  async function loadCourierRoutes({ organizationId, dateFrom, dateTo }) {
    if (!organizationId || !dateFrom || !dateTo) return null;

    courierController?.abort();
    courierController = new AbortController();
    courierRequestId += 1;
    const currentRequestId = courierRequestId;

    try {
      isLoadingCourier.value = true;
      const resp = await reportsApi.getCourierRoutes({ organizationId, dateFrom, dateTo, signal: courierController.signal });

      if (currentRequestId !== courierRequestId) return null;

      courierRoutes.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === courierRequestId) {
        console.error("❌ reportsStore.loadCourierRoutes:", e);
      }
      return null;
    } finally {
      if (currentRequestId === courierRequestId) {
        isLoadingCourier.value = false;
        courierController = null;
      }
    }
  }

  function $reset() {
    revenueController?.abort();
    courierController?.abort();
    revenueData.value = null;
    courierRoutes.value = null;
    error.value = null;
  }

  return {
    revenueData,
    courierRoutes,
    isLoadingRevenue,
    isLoadingCourier,
    error,
    loadRevenue,
    loadCourierRoutes,
    $reset,
  };
});
