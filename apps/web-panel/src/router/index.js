import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import StopListView from "../views/StopListView.vue";
import RevenueView from "../views/RevenueView.vue";
import TopDishesView from "../views/TopDishesView.vue";
import ClientsView from "../views/ClientsView.vue";
import FoodcostView from "../views/FoodcostView.vue";

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
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
