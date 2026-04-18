import { defineStore } from "pinia";
import { computed } from "vue";
import { useSalesReportsStore } from "./domain/salesReports";
import { useDeliveryReportsStore } from "./domain/deliveryReports";
import { useMarketingReportsStore } from "./domain/marketingReports";
import { useAssortmentReportsStore } from "./domain/assortmentReports";

export const useReportsStore = defineStore("reports", () => {
  const salesStore = useSalesReportsStore();
  const deliveryStore = useDeliveryReportsStore();
  const marketingStore = useMarketingReportsStore();
  const assortmentStore = useAssortmentReportsStore();

  const error = computed(() => salesStore.error || deliveryStore.error || marketingStore.error || assortmentStore.error || null);

  const revenueData = computed(() => salesStore.revenueData);
  const hourlySales = computed(() => salesStore.hourlySales);
  const productionForecast = computed(() => salesStore.productionForecast);

  const courierRoutes = computed(() => deliveryStore.courierRoutes);
  const slaReport = computed(() => deliveryStore.slaReport);
  const courierKpiReport = computed(() => deliveryStore.courierKpiReport);
  const deliverySummaryReport = computed(() => deliveryStore.deliverySummaryReport);
  const deliveryDelaysReport = computed(() => deliveryStore.deliveryDelaysReport);
  const courierMapReport = computed(() => deliveryStore.courierMapReport);

  const marketingSourcesReport = computed(() => marketingStore.marketingSourcesReport);
  const promotionsReport = computed(() => marketingStore.promotionsReport);

  const menuAbcReport = computed(() => assortmentStore.menuAbcReport);

  const isLoadingRevenue = computed(() => salesStore.isLoadingRevenue);
  const isLoadingCourier = computed(() => deliveryStore.isLoadingCourierRoutes);
  const isLoadingHourlySales = computed(() => salesStore.isLoadingHourlySales);
  const isLoadingSla = computed(() => deliveryStore.isLoadingSla);
  const isLoadingCourierKpi = computed(() => deliveryStore.isLoadingCourierKpi);
  const isLoadingMarketingSources = computed(() => marketingStore.isLoadingMarketingSources);
  const isLoadingDeliverySummary = computed(() => deliveryStore.isLoadingDeliverySummary);
  const isLoadingDeliveryDelays = computed(() => deliveryStore.isLoadingDeliveryDelays);
  const isLoadingCourierMap = computed(() => deliveryStore.isLoadingCourierMap);
  const isLoadingPromotions = computed(() => marketingStore.isLoadingPromotions);
  const isLoadingMenuAbc = computed(() => assortmentStore.isLoadingMenuAbc);
  const isLoadingProductionForecast = computed(() => salesStore.isLoadingProductionForecast);

  const loadRevenue = async (params) => await salesStore.loadRevenue(params);
  const loadCourierRoutes = async (params) => await deliveryStore.loadCourierRoutes(params);
  const loadHourlySales = async (params) => await salesStore.loadHourlySales(params);
  const loadSla = async (params) => await deliveryStore.loadSla(params);
  const loadCourierKpi = async (params) => await deliveryStore.loadCourierKpi(params);
  const loadMarketingSources = async (params) => await marketingStore.loadMarketingSources(params);
  const loadDeliverySummary = async (params) => await deliveryStore.loadDeliverySummary(params);
  const loadDeliveryDelays = async (params) => await deliveryStore.loadDeliveryDelays(params);
  const loadCourierMap = async (params) => await deliveryStore.loadCourierMap(params);
  const loadPromotions = async (params) => await marketingStore.loadPromotions(params);
  const loadMenuAbc = async (params) => await assortmentStore.loadMenuAbc(params);
  const loadProductionForecast = async (params) => await salesStore.loadProductionForecast(params);

  const $reset = () => {
    salesStore.$reset();
    deliveryStore.$reset();
    marketingStore.$reset();
    assortmentStore.$reset();
  };

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
    menuAbcReport,
    menuAssortmentReport: menuAbcReport,
    productionForecast,
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
    isLoadingMenuAbc,
    isLoadingMenuAssortment: isLoadingMenuAbc,
    isLoadingProductionForecast,
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
    loadMenuAbc,
    loadMenuAssortment: loadMenuAbc,
    loadProductionForecast,
    $reset,
  };
});
