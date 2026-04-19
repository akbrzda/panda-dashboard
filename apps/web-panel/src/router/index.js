import { createRouter, createWebHistory } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { useTopDishesStore } from "@/stores/topDishes";
import { useFoodcostStore } from "@/stores/foodcost";
import { useDashboardStore } from "@/stores/dashboard";
import { useStopListStore } from "@/stores/stopList";
import { getFeatureReadiness } from "@/config/featureReadiness";
import DashboardView from "../views/DashboardView.vue";
import StopListView from "../views/StopListView.vue";
import RevenueView from "../views/RevenueView.vue";
import HourlySalesView from "../views/HourlySalesView.vue";
import ProductionForecastView from "../views/ProductionForecastView.vue";
import DeliverySlaView from "../views/DeliverySlaView.vue";
import CourierKpiView from "../views/CourierKpiView.vue";
import MarketingSourcesView from "../views/MarketingSourcesView.vue";
import DeliverySummaryView from "../views/DeliverySummaryView.vue";
import DeliveryDelaysView from "../views/DeliveryDelaysView.vue";
import CourierMapView from "../views/CourierMapView.vue";
import PromotionsView from "../views/PromotionsView.vue";
import MenuAssortmentView from "../views/MenuAssortmentView.vue";
import TopDishesView from "../views/TopDishesView.vue";
import ClientsView from "../views/ClientsView.vue";
import FoodcostView from "../views/FoodcostView.vue";
import PlansView from "../views/PlansView.vue";
import PlannedFeatureView from "../views/PlannedFeatureView.vue";

const routes = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: DashboardView,
  },
  {
    path: "/stop-list",
    name: "StopList",
    component: StopListView,
  },
  {
    path: "/revenue",
    name: "Revenue",
    component: RevenueView,
  },
  {
    path: "/hourly-sales",
    name: "HourlySales",
    component: HourlySalesView,
  },
  {
    path: "/production-forecast",
    name: "ProductionForecast",
    component: ProductionForecastView,
  },
  {
    path: "/delivery-sla",
    name: "DeliverySla",
    component: DeliverySlaView,
  },
  {
    path: "/courier-kpi",
    name: "CourierKpi",
    component: CourierKpiView,
  },
  {
    path: "/marketing-sources",
    name: "MarketingSources",
    component: MarketingSourcesView,
  },
  {
    path: "/delivery-summary",
    name: "DeliverySummary",
    component: DeliverySummaryView,
  },
  {
    path: "/delivery-delays",
    name: "DeliveryDelays",
    component: DeliveryDelaysView,
  },
  {
    path: "/courier-map",
    name: "CourierMap",
    component: CourierMapView,
  },
  {
    path: "/promotions",
    name: "Promotions",
    component: PromotionsView,
  },
  {
    path: "/product-abc",
    name: "ProductAbc",
    component: MenuAssortmentView,
  },
  {
    path: "/menu-assortment",
    redirect: "/product-abc",
  },
  {
    path: "/top-dishes",
    name: "TopDishes",
    component: TopDishesView,
  },
  {
    path: "/clients",
    name: "Clients",
    component: ClientsView,
  },
  {
    path: "/foodcost",
    name: "Foodcost",
    component: FoodcostView,
  },
  {
    path: "/plans",
    name: "Plans",
    component: PlansView,
  },
  {
    path: "/planned",
    name: "PlannedFeature",
    component: PlannedFeatureView,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  const readiness = getFeatureReadiness(to.path);
  if (readiness.status === "planned" && to.name !== "PlannedFeature") {
    next({
      name: "PlannedFeature",
      query: {
        target: to.path,
      },
    });
    return;
  }

  if (to.path !== from.path) {
    useClientsStore().stopAll();
    useTopDishesStore().stopAll();
    useFoodcostStore().stopAll();
    useDashboardStore().stopAll();
    useStopListStore().stopAll();
  }

  next();
});

export default router;
