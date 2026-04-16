import { defineStore } from "pinia";
import { ref } from "vue";
import { analyticsApi } from "../api/analytics";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
const REQUEST_KEYS = ["revenue", "hourly", "operational", "courier", "topDishes", "clients", "foodcost", "dashboard"];

export const useAnalyticsStore = defineStore("analytics", () => {
  const revenueData = ref(null);
  const hourlySales = ref(null);
  const operationalData = ref(null);
  const courierRoutes = ref(null);
  const topDishes = ref(null);
  const clientsData = ref(null);
  const foodcostData = ref(null);
  const dashboardData = ref(null);
  const isLoadingRevenue = ref(false);
  const isLoadingHourly = ref(false);
  const isLoadingOperational = ref(false);
  const isLoadingCourier = ref(false);
  const isLoadingTopDishes = ref(false);
  const isLoadingClients = ref(false);
  const isLoadingFoodcost = ref(false);
  const isLoadingDashboard = ref(false);
  const error = ref(null);

  const controllers = Object.fromEntries(REQUEST_KEYS.map((key) => [key, null]));
  const requestIds = Object.fromEntries(REQUEST_KEYS.map((key) => [key, 0]));

  function beginRequest(key) {
    controllers[key]?.abort();
    const controller = new AbortController();
    controllers[key] = controller;
    requestIds[key] += 1;
    return { controller, requestId: requestIds[key] };
  }

  async function executeRequest({ key, loadingRef, request, onSuccess, errorMessage, rethrow = false }) {
    const { controller, requestId } = beginRequest(key);
    loadingRef.value = true;

    if (key === "revenue" || key === "dashboard") {
      error.value = null;
    }

    try {
      const resp = await request(controller.signal);

      if (requestIds[key] !== requestId) {
        return null;
      }

      onSuccess(resp);
      return resp;
    } catch (e) {
      if (isAbortError(e)) {
        return null;
      }

      if (requestIds[key] === requestId) {
        if (errorMessage) {
          error.value = e.message || errorMessage;
        }
        console.error(`❌ analyticsStore.${key}:`, e);
      }

      if (rethrow) {
        throw e;
      }

      return null;
    } finally {
      if (requestIds[key] === requestId) {
        loadingRef.value = false;
        controllers[key] = null;
      }
    }
  }

  async function loadRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    if (!dateFrom || !dateTo) return;

    await executeRequest({
      key: "revenue",
      loadingRef: isLoadingRevenue,
      request: (signal) => analyticsApi.getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (resp) => {
        revenueData.value = resp.data;
      },
      errorMessage: "Ошибка загрузки аналитики",
    });
  }

  async function loadHourlySales({ organizationId, dateFrom, dateTo }) {
    if (!dateFrom || !dateTo) return;

    await executeRequest({
      key: "hourly",
      loadingRef: isLoadingHourly,
      request: (signal) => analyticsApi.getHourlySales({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (resp) => {
        hourlySales.value = resp.data;
      },
    });
  }

  async function loadOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    if (!dateFrom || !dateTo) return;

    await executeRequest({
      key: "operational",
      loadingRef: isLoadingOperational,
      request: (signal) => analyticsApi.getOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (resp) => {
        operationalData.value = resp.data;
      },
    });
  }

  async function loadCourierRoutes({ organizationId, dateFrom, dateTo }) {
    if (!dateFrom || !dateTo) return;

    await executeRequest({
      key: "courier",
      loadingRef: isLoadingCourier,
      request: (signal) => analyticsApi.getCourierRoutes({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (resp) => {
        courierRoutes.value = resp.data;
      },
    });
  }

  async function loadTopDishes({ organizationId, dateFrom, dateTo, limit }) {
    if (!organizationId || !dateFrom || !dateTo) return;

    await executeRequest({
      key: "topDishes",
      loadingRef: isLoadingTopDishes,
      request: (signal) => analyticsApi.getTopDishes({ organizationId, dateFrom, dateTo, limit, signal }),
      onSuccess: (resp) => {
        topDishes.value = resp.data;
      },
    });
  }

  async function loadClients({ dateFrom, dateTo }) {
    if (!dateFrom || !dateTo) return;

    await executeRequest({
      key: "clients",
      loadingRef: isLoadingClients,
      request: (signal) => analyticsApi.getClients({ dateFrom, dateTo, signal }),
      onSuccess: (resp) => {
        clientsData.value = resp.data;
      },
    });
  }

  async function loadFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    if (!organizationId || !dateFrom || !dateTo) return;

    await executeRequest({
      key: "foodcost",
      loadingRef: isLoadingFoodcost,
      request: (signal) => analyticsApi.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (resp) => {
        foodcostData.value = resp.data;
      },
      rethrow: true,
    });
  }

  async function loadDashboard({ organizationIds, date }) {
    if (!date) return;

    await executeRequest({
      key: "dashboard",
      loadingRef: isLoadingDashboard,
      request: (signal) => analyticsApi.getDashboard({ organizationIds, date, signal }),
      onSuccess: (resp) => {
        dashboardData.value = resp.data;
      },
      errorMessage: "Ошибка загрузки дашборда",
      rethrow: true,
    });
  }

  function $reset() {
    REQUEST_KEYS.forEach((key) => controllers[key]?.abort());
    revenueData.value = null;
    hourlySales.value = null;
    operationalData.value = null;
    courierRoutes.value = null;
    topDishes.value = null;
    clientsData.value = null;
    foodcostData.value = null;
    dashboardData.value = null;
    error.value = null;
  }

  return {
    revenueData,
    hourlySales,
    operationalData,
    courierRoutes,
    topDishes,
    clientsData,
    foodcostData,
    dashboardData,
    isLoadingRevenue,
    isLoadingHourly,
    isLoadingOperational,
    isLoadingCourier,
    isLoadingTopDishes,
    isLoadingClients,
    isLoadingFoodcost,
    isLoadingDashboard,
    error,
    loadRevenue,
    loadHourlySales,
    loadOperational,
    loadCourierRoutes,
    loadTopDishes,
    loadClients,
    loadFoodcost,
    loadDashboard,
    $reset,
  };
});
