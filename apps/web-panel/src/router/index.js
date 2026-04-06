import { createRouter, createWebHistory } from "vue-router";
import StopListView from "../views/StopListView.vue";
import RevenueView from "../views/RevenueView.vue";

const routes = [
  {
    path: "/",
    redirect: "/stop-list",
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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
