<template>
  <div class="space-y-5">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Отчёт по выручке</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!isPageLoading && !store.hasData && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="store.hasData || isPageLoading">
      <!-- Период -->
      <p v-if="store.formattedPeriod && !isPageLoading" class="text-xs text-muted-foreground">
        Период: <span class="font-medium text-foreground">{{ store.formattedPeriod }}</span>
      </p>

      <section>
        <h2 class="text-lg font-semibold text-foreground mb-4">Финансовые показатели</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard
            title="Общая выручка"
            :value="store.summary?.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :lfl="store.summary?.lfl != null ? { percent: store.summary.lfl } : null"
            :plan="getPlan('revenue', store.summary?.totalRevenue)"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Заказов"
            :value="store.summary?.totalOrders ?? null"
            format="number"
            icon="ShoppingCart"
            :lfl="reportsStore.revenueData?.summary?.ordersLFL != null ? { percent: reportsStore.revenueData.summary.ordersLFL } : null"
            :plan="getPlan('orders', store.summary?.totalOrders)"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Средний чек"
            :value="store.summary?.avgPerOrder ?? null"
            format="currency"
            icon="BarChart2"
            :plan="getPlan('avgPerOrder', store.summary?.avgPerOrder)"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Дисконт"
            :value="store.summary?.discountSum ?? null"
            format="currency"
            icon="Percent"
            :inverse="true"
            :plan="getPlan('discountSum', store.summary?.discountSum)"
            :loading="isPageLoading"
          />
          <MetricCard
            title="% дисконта"
            :value="store.summary?.discountPercent ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-foreground mb-4">Операционные показатели</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Время доставки"
            :value="store.summary?.avgDeliveryTime ?? null"
            format="time"
            icon="Clock"
            :lfl="store.summary?.avgDeliveryTimeLFL != null ? { percent: store.summary.avgDeliveryTimeLFL } : null"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Время приготовления"
            :value="store.summary?.avgCookingTime ?? null"
            format="time"
            icon="Clock"
            :lfl="store.summary?.avgCookingTimeLFL != null ? { percent: store.summary.avgCookingTimeLFL } : null"
            :inverse="true"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 2xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div class="space-y-4">
          <Card class="h-full border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика выручки по дням</h3>
            <AreaChart :breakdown="store.dailyBreakdown" metric="revenue" label="Выручка" :loading="isPageLoading" />
          </Card>

          <Card class="h-full border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика заказов по дням</h3>
            <AreaChart :breakdown="store.dailyBreakdown" metric="orders" label="Заказы" color-var="--chart-2" :loading="isPageLoading" />
          </Card>
        </div>

        <div class="space-y-4">
          <Card class="h-full border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Выручка по каналам</h3>
            <DonutChart :channels="store.revenueByChannel" :loading="isPageLoading" />
          </Card>

          <Card class="h-full border-border/70 bg-card/95 p-4 md:p-5">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Типы оплат</h3>
            <DonutChart :channels="store.revenueData?.paymentByType || {}" :loading="isPageLoading" />
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { AlertCircle, BarChart2 } from "lucide-vue-next";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import { useRevenueStore } from "../stores/revenue";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { usePlansStore } from "../stores/plans";
import PageFilters from "../components/filters/PageFilters.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Card from "../components/ui/Card.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import DonutChart from "../components/charts/DonutChart.vue";

const store = useRevenueStore();
const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const plansStore = usePlansStore();

const isPageLoading = computed(() => store.isLoading || reportsStore.isLoadingRevenue);
const pageError = computed(() => reportsStore.error || store.error);

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? store.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const lflDateFrom = payload.lflDateFrom ?? filtersStore.lflDateFrom;
  const lflDateTo = payload.lflDateTo ?? filtersStore.lflDateTo;

  store.setCurrentOrganization(organizationId);
  store.startDate = dateFrom;
  store.endDate = dateTo;

  await reportsStore.loadRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });

  if (reportsStore.revenueData) {
    store.revenueData = reportsStore.revenueData;
  }
}

function getPlan(metric, currentValue) {
  return plansStore.getMetricPlan(metric, filtersStore.preset, store.currentOrganizationId, currentValue);
}

useAutoRefresh(() => {
  if (store.hasData) {
    handleApply();
  }
});

onMounted(async () => {
  if (store.organizations.length === 0) {
    await store.loadOrganizations();
  }

  if (!plansStore.plans.length) {
    await plansStore.loadPlans();
  }

  if (!store.hasData) {
    handleApply();
  }
});
</script>
