<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Акции и промокоды</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете акций и промокодов"
      purpose="Отчет показывает влияние скидочных механик на выручку и долю скидки."
      meaning="Позволяет оценить, какие акции дают эффект, а какие размывают маржу."
      calculation="Считаются net sales, сумма скидок и доля скидки по типам промо; отмененные/удаленные заказы исключены."
      responsibility="Используется коммерческим блоком для настройки промо-политики."
    />

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard title="Сумма скидок" :value="report?.summary?.totalDiscount ?? null" format="currency" icon="Percent" :inverse="true" :loading="isPageLoading" />
          <MetricCard title="Доля скидки" :value="report?.summary?.discountRate ?? null" format="percent" icon="BarChart2" :inverse="true" :loading="isPageLoading" />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr_1fr]">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика скидок по дням</h3>
          <AreaChart :breakdown="discountBreakdown" metric="revenue" label="Сумма скидок" color-var="--chart-4" :loading="isPageLoading" />
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Топ акций по сумме скидки</h3>
          <div class="space-y-2">
            <div v-for="item in topPromotions" :key="`${item.promoType}-${item.promoName}`" class="rounded-lg border border-border/60 bg-background/60 p-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-foreground">{{ item.promoName }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.promoType }}</div>
                </div>
                <div class="text-right text-xs">
                  <div class="font-semibold text-foreground">{{ formatCurrency(item.discountSum) }}</div>
                  <div class="text-muted-foreground">{{ formatNumber(item.discountRate) }}%</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Таблица акций и промокодов</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Тип</th>
                <th class="px-3 py-2 text-left font-medium">Название</th>
                <th class="px-3 py-2 text-left font-medium">Заказов</th>
                <th class="px-3 py-2 text-left font-medium">Скидка</th>
                <th class="px-3 py-2 text-left font-medium">Net sales</th>
                <th class="px-3 py-2 text-left font-medium">Доля скидки, %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report?.promotions || []" :key="`${item.promoType}-${item.promoName}`" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ item.promoType }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.promoName }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.orders) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.discountSum) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.netSales) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.discountRate) }}</td>
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
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.promotionsReport);
const isPageLoading = computed(() => reportsStore.isLoadingPromotions);
const pageError = computed(() => reportsStore.error);

const topPromotions = computed(() => (report.value?.promotions || []).slice(0, 8));
const discountBreakdown = computed(() =>
  (report.value?.dailyBreakdown || []).map((item) => ({
    date: item.date,
    revenue: item.discountSum,
    orders: item.orders,
  })),
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
  await reportsStore.loadPromotions({ organizationId, dateFrom, dateTo });
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
