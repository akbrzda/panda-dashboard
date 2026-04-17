import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useDeliveryReportsStore = defineStore("deliveryReports", () => {
  const runner = createRequestRunner();

  const courierRoutes = ref(null);
  const slaReport = ref(null);
  const courierKpiReport = ref(null);
  const deliverySummaryReport = ref(null);
  const deliveryDelaysReport = ref(null);
  const courierMapReport = ref(null);

  const isLoadingCourierRoutes = runner.getLoadingRef("courierRoutes");
  const isLoadingSla = runner.getLoadingRef("sla");
  const isLoadingCourierKpi = runner.getLoadingRef("courierKpi");
  const isLoadingDeliverySummary = runner.getLoadingRef("deliverySummary");
  const isLoadingDeliveryDelays = runner.getLoadingRef("deliveryDelays");
  const isLoadingCourierMap = runner.getLoadingRef("courierMap");

  const loadCourierRoutes = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "courierRoutes",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getCourierRoutes({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierRoutes.value = data;
      },
      errorMessage: "Ошибка загрузки маршрутов курьеров",
    });

  const loadSla = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "sla",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getSla({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        slaReport.value = data;
      },
      errorMessage: "Ошибка загрузки SLA-отчета",
    });

  const loadCourierKpi = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "courierKpi",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getCourierKpi({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierKpiReport.value = data;
      },
      errorMessage: "Ошибка загрузки отчета KPI курьеров",
    });

  const loadDeliverySummary = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "deliverySummary",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getDeliverySummary({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        deliverySummaryReport.value = data;
      },
      errorMessage: "Ошибка загрузки сводки доставки",
    });

  const loadDeliveryDelays = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "deliveryDelays",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getDeliveryDelays({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        deliveryDelaysReport.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по опозданиям",
    });

  const loadCourierMap = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "courierMap",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getCourierMap({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        courierMapReport.value = data;
      },
      errorMessage: "Ошибка загрузки карты курьеров",
    });

  const $reset = () => {
    runner.stopAll();
    courierRoutes.value = null;
    slaReport.value = null;
    courierKpiReport.value = null;
    deliverySummaryReport.value = null;
    deliveryDelaysReport.value = null;
    courierMapReport.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    courierRoutes,
    slaReport,
    courierKpiReport,
    deliverySummaryReport,
    deliveryDelaysReport,
    courierMapReport,
    isLoadingCourierRoutes,
    isLoadingSla,
    isLoadingCourierKpi,
    isLoadingDeliverySummary,
    isLoadingDeliveryDelays,
    isLoadingCourierMap,
    loadCourierRoutes,
    loadSla,
    loadCourierKpi,
    loadDeliverySummary,
    loadDeliveryDelays,
    loadCourierMap,
    $reset,
  };
});

