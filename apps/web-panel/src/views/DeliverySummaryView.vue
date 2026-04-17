<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Сводка доставки за период</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О сводке доставки"
      purpose="Сводный отчет по объему доставки, статусам, каналам и подразделениям за выбранный период."
      meaning="Показывает текущее состояние блока доставки в одном окне."
      calculation="Заказы агрегируются по дням, статусам и каналам; отмененные/удаленные позиции исключаются."
      responsibility="Используется для ежедневного контроля доставки на уровне руководителя смены и управляющего."
    />
    <p v-if="report?.timezone" class="text-xs text-muted-foreground">Часовой пояс отчета: {{ report.timezone }}</p>

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
          <h3 class="mb-3 text-sm font-semibold text-foreground">Статусы заказов</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Статус</th>
                  <th class="px-3 py-2 text-left font-medium">Заказов</th>
                  <th class="px-3 py-2 text-left font-medium">Выручка</th>
                  <th class="px-3 py-2 text-left font-medium">Доля, %</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report?.statuses || []" :key="item.status" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ item.status }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.orders) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.revenue) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.share) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Подразделения</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Подразделение</th>
                  <th class="px-3 py-2 text-left font-medium">Заказов</th>
                  <th class="px-3 py-2 text-left font-medium">Выручка</th>
                  <th class="px-3 py-2 text-left font-medium">Средний чек</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report?.departments || []" :key="item.departmentId" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ item.departmentId }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.orders) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.revenue) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.avgCheck) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { AlertCircle, Truck } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import DonutChart from "../components/charts/DonutChart.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.deliverySummaryReport);
const isPageLoading = computed(() => reportsStore.isLoadingDeliverySummary);
const pageError = computed(() => reportsStore.error);

const channelsAsObject = computed(() =>
  (report.value?.channels || []).reduce((accumulator, item) => {
    accumulator[item.channel] = { revenue: item.revenue };
    return accumulator;
  }, {}),
);

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
  await reportsStore.loadDeliverySummary({ organizationId, dateFrom, dateTo });
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
