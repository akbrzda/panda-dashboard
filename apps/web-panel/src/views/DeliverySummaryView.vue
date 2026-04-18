<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Сводка доставки за период"
        description="Delivery Pack: сводные KPI, каналы и переходы к проблемным зонам по доставке."
        :status="readiness.status"
        :tier="readiness.tier"
        :source="readiness.source"
        :coverage="trustCoverage"
        :updated-at="lastLoadedAt"
        :last-reviewed-at="readiness.lastReviewedAt"
        :warnings="readiness.knownLimitations"
        :show-refresh="true"
        :refreshing="isPageLoading"
        @refresh="handleApply()"
      />
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>
    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !report && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <Truck class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">KPI доставки</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard title="Средний чек" :value="report?.summary?.avgCheck ?? null" format="currency" icon="DollarSign" :loading="isPageLoading" />
          <MetricCard title="Доставлено" :value="report?.summary?.deliveredOrders ?? null" format="number" icon="Truck" :loading="isPageLoading" />
          <MetricCard
            title="Доля доставки"
            :value="report?.summary?.deliveredRate ?? null"
            format="percent"
            icon="BarChart2"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-foreground">Drill-down: Delivery Pack</h3>
          <span class="text-xs text-muted-foreground">Сценарий: сводка → опоздания/SLA → карта/стоп-лист</span>
        </div>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div class="space-y-2 rounded-md border border-border/60 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Статусы</p>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="item in statusDrillItems"
                :key="`status-drill-${item.status}`"
                type="button"
                variant="outline"
                size="sm"
                @click="goToStatusDrill(item.status)"
              >
                {{ item.status }} · {{ formatNumber(item.orders) }}
              </Button>
            </div>
          </div>
          <div class="space-y-2 rounded-md border border-border/60 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Подразделения</p>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="item in departmentDrillItems"
                :key="`department-drill-${item.departmentId}`"
                type="button"
                variant="outline"
                size="sm"
                @click="goToDepartmentDrill(item.departmentId)"
              >
                {{ item.departmentId }} · {{ formatNumber(item.orders) }}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1.3fr_1fr]">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика доставки по дням</h3>
          <AreaChart :breakdown="report?.dailyBreakdown || []" metric="revenue" label="Выручка" :loading="isPageLoading" />
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Каналы доставки</h3>
          <DonutChart :channels="channelsAsObject" :loading="isPageLoading" />
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Статус</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Доля, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in report?.statuses || []" :key="item.status" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ item.status }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.share) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Подразделение</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Средний чек</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in report?.departments || []" :key="item.departmentId" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ item.departmentId }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(item.avgCheck) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AlertCircle, Truck } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import Button from "../components/ui/Button.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import DonutChart from "../components/charts/DonutChart.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();
const route = useRoute();
const router = useRouter();
const lastLoadedAt = ref(null);

const report = computed(() => reportsStore.deliverySummaryReport);
const isPageLoading = computed(() => reportsStore.isLoadingDeliverySummary);
const pageError = computed(() => reportsStore.error);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

const channelsAsObject = computed(() =>
  (report.value?.channels || []).reduce((accumulator, item) => {
    accumulator[item.channel] = { revenue: item.revenue };
    return accumulator;
  }, {}),
);
const statusDrillItems = computed(() => (report.value?.statuses || []).slice(0, 6));
const departmentDrillItems = computed(() => (report.value?.departments || []).slice(0, 6));

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  const result = await reportsStore.loadDeliverySummary({ organizationId, dateFrom, dateTo });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

function buildDrillQuery(overrides = {}) {
  return {
    ...route.query,
    ...overrides,
  };
}

function goToStatusDrill(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (normalizedStatus.includes("достав")) {
    router.push({ path: "/delivery-sla", query: buildDrillQuery({ drill: "delivery-pack-status", status }) });
    return;
  }
  if (normalizedStatus.includes("отмен")) {
    router.push({ path: "/stop-list", query: buildDrillQuery({ drill: "delivery-pack-status", status }) });
    return;
  }
  router.push({ path: "/delivery-delays", query: buildDrillQuery({ drill: "delivery-pack-status", status }) });
}

function goToDepartmentDrill(departmentId) {
  router.push({
    path: "/delivery-delays",
    query: buildDrillQuery({
      drill: "delivery-pack-department",
      department: String(departmentId || ""),
    }),
  });
}

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }
  if (!report.value) {
    await handleApply();
  }
});
</script>
