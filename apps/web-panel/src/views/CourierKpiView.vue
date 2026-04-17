<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">KPI курьеров</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете KPI курьеров"
      purpose="Отчет показывает эффективность работы курьеров по скорости, объему доставок и стабильности SLA."
      meaning="Позволяет сравнивать курьеров между собой и видеть нагрузку по маршрутам."
      calculation="Маршруты группируются по фактическим выездам, распределение строится по реальному числу заказов в маршруте."
      responsibility="Используется руководителем доставки для балансировки смен и контроля качества."
    />
    <p v-if="report?.timezone" class="text-xs text-muted-foreground">Часовой пояс отчета: {{ report.timezone }}</p>

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
          <h3 class="mb-3 text-sm font-semibold text-foreground">Рейтинг курьеров</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Курьер</th>
                  <th class="px-3 py-2 text-left font-medium">Заказы</th>
                  <th class="px-3 py-2 text-left font-medium">Выручка</th>
                  <th class="px-3 py-2 text-left font-medium">Ср. в пути</th>
                  <th class="px-3 py-2 text-left font-medium">Ср. цикл</th>
                  <th class="px-3 py-2 text-left font-medium">Р’ SLA, %</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="courier in topCouriers" :key="courier.courierId" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ courier.courierName }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(courier.orders) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatCurrency(courier.revenue) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatDuration(courier.avgRouteMinutes) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatDuration(courier.avgTotalMinutes) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(courier.onTimeRate) }}</td>
                </tr>
                <tr v-if="topCouriers.length === 0" class="border-t border-border/50">
                  <td colspan="6" class="px-3 py-4 text-center text-muted-foreground">Нет данных по курьерам за выбранный период</td>
                </tr>
              </tbody>
            </table>
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
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";
import { formatMinutesToHms } from "../lib/utils";

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
