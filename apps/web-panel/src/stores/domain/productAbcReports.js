import { defineStore } from "pinia";
import { ref } from "vue";
import { reportsApi } from "@/api/reports";
import { createRequestRunner } from "./requestRunner";

export const useProductAbcReportsStore = defineStore("productAbcReports", () => {
  const runner = createRequestRunner();

  const productAbcReport = ref(null);
  const isLoadingProductAbc = runner.getLoadingRef("productAbc");

  const loadProductAbc = async ({ organizationId, dateFrom, dateTo, abcGroup = "all", page = 1, limit = 50 }) =>
    await runner.runRequest({
      key: "productAbc",
      hasRequiredParams: () => Boolean(organizationId && dateFrom && dateTo),
      request: (signal) => reportsApi.getProductAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit, signal }),
      onSuccess: (data) => {
        productAbcReport.value = data;
      },
      errorMessage: "Ошибка загрузки продуктового ABC-отчета",
    });

  const $reset = () => {
    runner.stopAll();
    productAbcReport.value = null;
    runner.error.value = null;
  };

  return {
    error: runner.error,
    productAbcReport,
    menuAbcReport: productAbcReport,
    menuAssortmentReport: productAbcReport,
    isLoadingProductAbc,
    isLoadingMenuAbc: isLoadingProductAbc,
    isLoadingMenuAssortment: isLoadingProductAbc,
    loadProductAbc,
    loadMenuAbc: loadProductAbc,
    loadMenuAssortment: loadProductAbc,
    $reset,
  };
});
