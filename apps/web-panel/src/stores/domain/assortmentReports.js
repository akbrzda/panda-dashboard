import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useAssortmentReportsStore = defineStore("assortmentReports", () => {
  const runner = createRequestRunner();

  const menuAbcReport = ref(null);
  const isLoadingMenuAbc = runner.getLoadingRef("menuAbc");

  const loadMenuAbc = async ({ organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50 }) =>
    await runner.runRequest({
      key: "menuAbc",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getMenuAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit, signal }),
      onSuccess: (data) => {
        menuAbcReport.value = data;
      },
      errorMessage: "Ошибка загрузки ABC-отчета",
    });

  const loadMenuAssortment = async (params) => await loadMenuAbc(params);

  const $reset = () => {
    runner.stopAll();
    menuAbcReport.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    menuAbcReport,
    isLoadingMenuAbc,
    menuAssortmentReport: menuAbcReport,
    isLoadingMenuAssortment: isLoadingMenuAbc,
    loadMenuAbc,
    loadMenuAssortment,
    $reset,
  };
});
