<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">KPI курьеров</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>
    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !report && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <Users class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">Сводка по курьерам</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Курьеров" :value="report?.summary?.totalCouriers ?? null" format="number" icon="Users" :loading="isPageLoading" />
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard
            title="Заказов на курьера"
            :value="report?.summary?.avgOrdersPerCourier ?? null"
            format="number"
            icon="BarChart2"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Опозданий"
            :value="report?.summary?.lateOrders ?? null"
            format="number"
            icon="Clock"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Доля опозданий"
            :value="report?.summary?.violationRate ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1.35fr_1fr]">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Курьер</TableHead>
                  <TableHead class="text-left font-medium">Заказы</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Ср. в пути</TableHead>
                  <TableHead class="text-left font-medium">Ср. цикл</TableHead>
                  <TableHead class="text-left font-medium">В SLA, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="courier in topCouriers" :key="courier.courierId" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ courier.courierName }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(courier.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(courier.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatDuration(courier.avgRouteMinutes) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatDuration(courier.avgTotalMinutes) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(courier.onTimeRate) }}</TableCell>
                </TableRow>
                <TableRow v-if="topCouriers.length === 0" class="border-t border-border/50">
                  <TableCell colspan="6" class="text-center text-muted-foreground">Нет данных по курьерам за выбранный период</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Распределение маршрутов</h3>
          <div class="space-y-3">
            <div v-for="item in routeDistribution" :key="item.label" class="space-y-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="text-foreground">{{ item.label }}</span>
                <span class="font-semibold text-foreground">{{ formatNumber(item.percent) }}%</span>
              </div>
              <div class="h-2 rounded-full bg-muted">
                <div class="h-2 rounded-full bg-primary transition-all" :style="{ width: `${Math.min(item.percent, 100)}%` }"></div>
              </div>
              <div class="text-xs text-muted-foreground">
                Маршрутов: {{ formatNumber(item.routeCount) }}, заказов: {{ formatNumber(item.ordersCount) }}
              </div>
            </div>
            <div v-if="routeDistribution.length === 0" class="py-4 text-center text-sm text-muted-foreground">Нет данных по маршрутам</div>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { AlertCircle, Users } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import { formatMinutesToHms } from "../lib/utils";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.courierKpiReport);
const isPageLoading = computed(() => reportsStore.isLoadingCourierKpi);
const pageError = computed(() => reportsStore.error);

const topCouriers = computed(() => (report.value?.couriers || []).slice(0, 20));
const routeDistribution = computed(() => report.value?.routeDistribution || []);

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDuration(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }
  return formatMinutesToHms(value);
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  await reportsStore.loadCourierKpi({ organizationId, dateFrom, dateTo });
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
