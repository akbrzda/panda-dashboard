import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useAssortmentReportsStore = defineStore("assortmentReports", () => {
  const runner = createRequestRunner();

  const menuAssortmentReport = ref(null);
  const isLoadingMenuAssortment = runner.getLoadingRef("menuAssortment");

  const loadMenuAssortment = async ({ organizationId, dateFrom, dateTo }) =>
    await runner.runRequest({
      key: "menuAssortment",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getMenuAssortment({ organizationId, dateFrom, dateTo, signal }),
      onSuccess: (data) => {
        menuAssortmentReport.value = data;
      },
      errorMessage: "Ошибка загрузки отчета по ассортименту",
    });

  const $reset = () => {
    runner.stopAll();
    menuAssortmentReport.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    menuAssortmentReport,
    isLoadingMenuAssortment,
    loadMenuAssortment,
    $reset,
  };
});

