import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useMarketingReportsStore = defineStore("marketingReports", () => {
  const runner = createRequestRunner();

  const marketingSourcesReport = ref(null);
  const promotionsReport = ref(null);

  const isLoadingMarketingSources = runner.getLoadingRef("marketingSources");
  const isLoadingPromotions = runner.getLoadingRef("promotions");

  const loadMarketingSources = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "marketingSources",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getMarketingSources({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        marketingSourcesReport.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по источникам",
    });

  const loadPromotions = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "promotions",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getPromotions({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        promotionsReport.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по акциям",
    });

  const $reset = () => {
    runner.stopAll();
    marketingSourcesReport.value = null;
    promotionsReport.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    marketingSourcesReport,
    promotionsReport,
    isLoadingMarketingSources,
    isLoadingPromotions,
    loadMarketingSources,
    loadPromotions,
    $reset,
  };
});

