import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useSalesReportsStore = defineStore("salesReports", () => {
  const runner = createRequestRunner();

  const revenueData = ref(null);
  const hourlySales = ref(null);
  const operationalMetrics = ref(null);
  const productionForecast = ref(null);

  const isLoadingRevenue = runner.getLoadingRef("revenue");
  const isLoadingHourlySales = runner.getLoadingRef("hourlySales");
  const isLoadingOperational = runner.getLoadingRef("operational");
  const isLoadingProductionForecast = runner.getLoadingRef("productionForecast");

  const loadRevenue = async ({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) =>
    await runner.runRequest({
      key: "revenue",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (data) => {
        revenueData.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по выручке",
    });

  const loadHourlySales = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "hourlySales",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getHourlySales({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        hourlySales.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по продажам по часам",
    });

  const loadOperational = async ({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) =>
    await runner.runRequest({
      key: "operational",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getOperational({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal }),
      onSuccess: (data) => {
        operationalMetrics.value = data;
      },
      errorMessage: "Ошибка загрузки операционного отчета",
    });

  const loadProductionForecast = async ({ organizationId, dateFrom, dateTo, forecastDate }) =>
    await runner.runRequest({
      key: "productionForecast",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getProductionForecast({ organizationId, dateFrom, dateTo, forecastDate, signal }),
      onSuccess: (data) => {
        productionForecast.value = data;
      },
      errorMessage: "Ошибка загрузки прогноза загрузки производства",
    });

  const $reset = () => {
    runner.stopAll();
    revenueData.value = null;
    hourlySales.value = null;
    operationalMetrics.value = null;
    productionForecast.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    revenueData,
    hourlySales,
    operationalMetrics,
    productionForecast,
    isLoadingRevenue,
    isLoadingHourlySales,
    isLoadingOperational,
    isLoadingProductionForecast,
    loadRevenue,
    loadHourlySales,
    loadOperational,
    loadProductionForecast,
    $reset,
  };
});

