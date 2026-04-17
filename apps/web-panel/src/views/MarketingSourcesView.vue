<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Маркетинговые источники</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете источников"
      purpose="Отчет показывает, какие каналы приводят заказы и выручку."
      meaning="Помогает сравнивать вклад каналов и принимать решения по маркетинговому бюджету."
      calculation="Данные агрегируются по источникам и дням; отмененные/удаленные заказы исключены."
      responsibility="Используется маркетингом и операционным менеджментом для управления каналами."
    />

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !report && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <Megaphone class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">Сводка по каналам</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard title="Источников" :value="report?.summary?.totalSources ?? null" format="number" icon="BarChart2" :loading="isPageLoading" />
          <MetricCard title="Средний чек" :value="report?.summary?.avgCheck ?? null" format="currency" icon="DollarSign" :loading="isPageLoading" />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1.25fr_1fr]">
        <div class="space-y-4">
          <Card class="border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика выручки по дням</h3>
            <AreaChart :breakdown="report?.dailyBreakdown || []" metric="revenue" label="Выручка" :loading="isPageLoading" />
          </Card>

          <Card class="border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика заказов по дням</h3>
            <AreaChart :breakdown="report?.dailyBreakdown || []" metric="orders" label="Заказы" color-var="--chart-2" :loading="isPageLoading" />
          </Card>
        </div>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Доли каналов по выручке</h3>
          <DonutChart :channels="report?.revenueByChannel || {}" :loading="isPageLoading" />
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Источники: заказы, выручка и доли</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Источник</th>
                <th class="px-3 py-2 text-left font-medium">Заказов</th>
                <th class="px-3 py-2 text-left font-medium">Выручка</th>
                <th class="px-3 py-2 text-left font-medium">Средний чек</th>
                <th class="px-3 py-2 text-left font-medium">Доля заказов, %</th>
                <th class="px-3 py-2 text-left font-medium">Доля выручки, %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report?.sources || []" :key="item.source" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ item.source }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.orders) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.revenue) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.avgCheck) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.ordersShare) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.revenueShare) }}</td>
              </tr>
              <tr v-if="(report?.sources || []).length === 0" class="border-t border-border/50">
                <td colspan="6" class="px-3 py-4 text-center text-muted-foreground">Нет данных по источникам за выбранный период</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { AlertCircle, Megaphone } from "lucide-vue-next";
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

const report = computed(() => reportsStore.marketingSourcesReport);
const isPageLoading = computed(() => reportsStore.isLoadingMarketingSources);
const pageError = computed(() => reportsStore.error);

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
  await reportsStore.loadMarketingSources({ organizationId, dateFrom, dateTo });
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
