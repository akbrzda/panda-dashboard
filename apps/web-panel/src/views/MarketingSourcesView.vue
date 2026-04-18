<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Маркетинговые источники</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

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
        <div class="overflow-x-auto">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Источник</TableHead>
                <TableHead class="text-left font-medium">Заказов</TableHead>
                <TableHead class="text-left font-medium">Выручка</TableHead>
                <TableHead class="text-left font-medium">Средний чек</TableHead>
                <TableHead class="text-left font-medium">Доля заказов, %</TableHead>
                <TableHead class="text-left font-medium">Доля выручки, %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in report?.sources || []" :key="item.source" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ item.source }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.avgCheck) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.ordersShare) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.revenueShare) }}</TableCell>
              </TableRow>
              <TableRow v-if="(report?.sources || []).length === 0" class="border-t border-border/50">
                <TableCell colspan="6" class="text-center text-muted-foreground">Нет данных по источникам за выбранный период</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from"vue";
import { AlertCircle, Megaphone } from"lucide-vue-next";
import { useReportsStore } from"../stores/reports";
import { useFiltersStore } from"../stores/filters";
import { useRevenueStore } from"../stores/revenue";
import PageFilters from"../components/filters/PageFilters.vue";
import Card from"../components/ui/Card.vue";
import MetricCard from"../components/metrics/MetricCard.vue";
import AreaChart from"../components/charts/AreaChart.vue";
import DonutChart from"../components/charts/DonutChart.vue";

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

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
  return new Intl.NumberFormat("ru-RU", { style:"currency", currency:"RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
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
