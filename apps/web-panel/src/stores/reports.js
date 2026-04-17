import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "../api/reports";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useReportsStore = defineStore("reports", () => {
  const error = ref(null);

  const revenueData = ref(null);
  const courierRoutes = ref(null);
  const hourlySales = ref(null);
  const slaReport = ref(null);
  const courierKpiReport = ref(null);
  const marketingSourcesReport = ref(null);
  const deliverySummaryReport = ref(null);
  const deliveryDelaysReport = ref(null);
  const courierMapReport = ref(null);
  const promotionsReport = ref(null);
  const menuAssortmentReport = ref(null);

  const isLoadingRevenue = ref(false);
  const isLoadingCourier = ref(false);
  const isLoadingHourlySales = ref(false);
  const isLoadingSla = ref(false);
  const isLoadingCourierKpi = ref(false);
  const isLoadingMarketingSources = ref(false);
  const isLoadingDeliverySummary = ref(false);
  const isLoadingDeliveryDelays = ref(false);
  const isLoadingCourierMap = ref(false);
  const isLoadingPromotions = ref(false);
  const isLoadingMenuAssortment = ref(false);

  let revenueController = null;
  let courierController = null;
  let hourlySalesController = null;
  let slaController = null;
  let courierKpiController = null;
  let marketingSourcesController = null;
  let deliverySummaryController = null;
  let deliveryDelaysController = null;
  let courierMapController = null;
  let promotionsController = null;
  let menuAssortmentController = null;

  let revenueRequestId = 0;
  let courierRequestId = 0;
  let hourlySalesRequestId = 0;
  let slaRequestId = 0;
  let courierKpiRequestId = 0;
  let marketingSourcesRequestId = 0;
  let deliverySummaryRequestId = 0;
  let deliveryDelaysRequestId = 0;
  let courierMapRequestId = 0;
  let promotionsRequestId = 0;
  let menuAssortmentRequestId = 0;

  async function runRequest({
    hasRequiredParams,
    getRequestId,
    bumpRequestId,
    getController,
    setController,
    setLoading,
    errorMessage,
    request,
    onSuccess,
  }) {
    if (!hasRequiredParams()) return null;

    const currentController = getController();
    currentController?.abort();

    const nextController = new AbortController();
    setController(nextController);
    bumpRequestId();
    const currentRequestId = getRequestId();

    try {
      setLoading(true);
      error.value = null;
      const response = await request(nextController.signal);

      if (currentRequestId !== getRequestId()) return null;
      onSuccess(response?.data ?? null);
      return response;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === getRequestId()) {
        error.value = e.message || errorMessage;
        console.error(`Ошибка reportsStore.${errorMessage}:`, e);
      }
      return null;
    } finally {
      if (currentRequestId === getRequestId()) {
        setLoading(false);
        setController(null);
      }
    }
  }

  async function loadRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => revenueRequestId,
      bumpRequestId: () => {
        revenueRequestId += 1;
      },
      getController: () => revenueController,
      setController: (controller) => {
        revenueController = controller;
      },
      setLoading: (loading) => {
        isLoadingRevenue.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по выручке",
      request: (signal) => reportsApi.getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (data) => {
        revenueData.value = data;
      },
    });
  }

  async function loadCourierRoutes({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => courierRequestId,
      bumpRequestId: () => {
        courierRequestId += 1;
      },
      getController: () => courierController,
      setController: (controller) => {
        courierController = controller;
      },
      setLoading: (loading) => {
        isLoadingCourier.value = loading;
      },
      errorMessage: "Ошибка загрузки маршрутов курьеров",
      request: (signal) => reportsApi.getCourierRoutes({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierRoutes.value = data;
      },
    });
  }

  async function loadHourlySales({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => hourlySalesRequestId,
      bumpRequestId: () => {
        hourlySalesRequestId += 1;
      },
      getController: () => hourlySalesController,
      setController: (controller) => {
        hourlySalesController = controller;
      },
      setLoading: (loading) => {
        isLoadingHourlySales.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по продажам по часам",
      request: (signal) => reportsApi.getHourlySales({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        hourlySales.value = data;
      },
    });
  }

  async function loadSla({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => slaRequestId,
      bumpRequestId: () => {
        slaRequestId += 1;
      },
      getController: () => slaController,
      setController: (controller) => {
        slaController = controller;
      },
      setLoading: (loading) => {
        isLoadingSla.value = loading;
      },
      errorMessage: "Ошибка загрузки SLA-отчета",
      request: (signal) => reportsApi.getSla({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        slaReport.value = data;
      },
    });
  }

  async function loadCourierKpi({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => courierKpiRequestId,
      bumpRequestId: () => {
        courierKpiRequestId += 1;
      },
      getController: () => courierKpiController,
      setController: (controller) => {
        courierKpiController = controller;
      },
      setLoading: (loading) => {
        isLoadingCourierKpi.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета KPI курьеров",
      request: (signal) => reportsApi.getCourierKpi({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierKpiReport.value = data;
      },
    });
  }

  async function loadMarketingSources({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => marketingSourcesRequestId,
      bumpRequestId: () => {
        marketingSourcesRequestId += 1;
      },
      getController: () => marketingSourcesController,
      setController: (controller) => {
        marketingSourcesController = controller;
      },
      setLoading: (loading) => {
        isLoadingMarketingSources.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по источникам",
      request: (signal) => reportsApi.getMarketingSources({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        marketingSourcesReport.value = data;
      },
    });
  }

  async function loadDeliverySummary({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => deliverySummaryRequestId,
      bumpRequestId: () => {
        deliverySummaryRequestId += 1;
      },
      getController: () => deliverySummaryController,
      setController: (controller) => {
        deliverySummaryController = controller;
      },
      setLoading: (loading) => {
        isLoadingDeliverySummary.value = loading;
      },
      errorMessage: "Ошибка загрузки сводки доставки",
      request: (signal) => reportsApi.getDeliverySummary({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        deliverySummaryReport.value = data;
      },
    });
  }

  async function loadDeliveryDelays({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => deliveryDelaysRequestId,
      bumpRequestId: () => {
        deliveryDelaysRequestId += 1;
      },
      getController: () => deliveryDelaysController,
      setController: (controller) => {
        deliveryDelaysController = controller;
      },
      setLoading: (loading) => {
        isLoadingDeliveryDelays.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по опозданиям",
      request: (signal) => reportsApi.getDeliveryDelays({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        deliveryDelaysReport.value = data;
      },
    });
  }

  async function loadCourierMap({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => courierMapRequestId,
      bumpRequestId: () => {
        courierMapRequestId += 1;
      },
      getController: () => courierMapController,
      setController: (controller) => {
        courierMapController = controller;
      },
      setLoading: (loading) => {
        isLoadingCourierMap.value = loading;
      },
      errorMessage: "Ошибка загрузки карты курьеров",
      request: (signal) => reportsApi.getCourierMap({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierMapReport.value = data;
      },
    });
  }

  async function loadPromotions({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => promotionsRequestId,
      bumpRequestId: () => {
        promotionsRequestId += 1;
      },
      getController: () => promotionsController,
      setController: (controller) => {
        promotionsController = controller;
      },
      setLoading: (loading) => {
        isLoadingPromotions.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по акциям",
      request: (signal) => reportsApi.getPromotions({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        promotionsReport.value = data;
      },
    });
  }

  async function loadMenuAssortment({ organizationId, dateFrom, dateTo }) {
    return await runRequest({
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      getRequestId: () => menuAssortmentRequestId,
      bumpRequestId: () => {
        menuAssortmentRequestId += 1;
      },
      getController: () => menuAssortmentController,
      setController: (controller) => {
        menuAssortmentController = controller;
      },
      setLoading: (loading) => {
        isLoadingMenuAssortment.value = loading;
      },
      errorMessage: "Ошибка загрузки отчета по ассортименту",
      request: (signal) => reportsApi.getMenuAssortment({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        menuAssortmentReport.value = data;
      },
    });
  }

  function $reset() {
    [
      revenueController,
      courierController,
      hourlySalesController,
      slaController,
      courierKpiController,
      marketingSourcesController,
      deliverySummaryController,
      deliveryDelaysController,
      courierMapController,
      promotionsController,
      menuAssortmentController,
    ].forEach((controller) => controller?.abort());

    revenueData.value = null;
    courierRoutes.value = null;
    hourlySales.value = null;
    slaReport.value = null;
    courierKpiReport.value = null;
    marketingSourcesReport.value = null;
    deliverySummaryReport.value = null;
    deliveryDelaysReport.value = null;
    courierMapReport.value = null;
    promotionsReport.value = null;
    menuAssortmentReport.value = null;
    error.value = null;
  }

  return {
    error,
    revenueData,
    courierRoutes,
    hourlySales,
    slaReport,
    courierKpiReport,
    marketingSourcesReport,
    deliverySummaryReport,
    deliveryDelaysReport,
    courierMapReport,
    promotionsReport,
    menuAssortmentReport,
    isLoadingRevenue,
    isLoadingCourier,
    isLoadingHourlySales,
    isLoadingSla,
    isLoadingCourierKpi,
    isLoadingMarketingSources,
    isLoadingDeliverySummary,
    isLoadingDeliveryDelays,
    isLoadingCourierMap,
    isLoadingPromotions,
    isLoadingMenuAssortment,
    loadRevenue,
    loadCourierRoutes,
    loadHourlySales,
    loadSla,
    loadCourierKpi,
    loadMarketingSources,
    loadDeliverySummary,
    loadDeliveryDelays,
    loadCourierMap,
    loadPromotions,
    loadMenuAssortment,
    $reset,
  };
});
