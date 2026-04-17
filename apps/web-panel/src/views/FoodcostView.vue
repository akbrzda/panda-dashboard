<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Фудкост</h1>
      <PageFilters :loading="foodcostStore.isLoadingFoodcost" :include-lfl="true" :show-lfl-hint="true" @apply="handleApply" />
    </div>
    <ReportInfoBlock
      title="Отчет «Фудкост»"
      purpose="Контролирует долю себестоимости в выручке и помогает вовремя замечать риск падения маржинальности."
      meaning="Показывает общий фудкост, разрез по категориям, вклад выручки и себестоимости по каждой категории."
      calculation="Фудкост считается как Себестоимость / Выручка × 100. По категориям используется тот же принцип с агрегацией за выбранный период."
      responsibility="Отвечает за контроль закупок, рецептур, списаний и ценовой политики меню."
    />

    <div v-if="error" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div
      v-if="!error && data?.warningMessage"
      class="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-300"
    >
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ data.warningMessage }}</span>
    </div>

    <div v-if="!foodcostStore.isLoadingFoodcost && !data && !error" class="flex flex-col items-center justify-center py-16 text-center">
      <Percent class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите период и нажмите «Применить»</p>
    </div>

    <template v-if="data || foodcostStore.isLoadingFoodcost">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Фудкост"
          :value="data?.percent ?? null"
          format="percent"
          icon="Percent"
          :inverse="true"
          :lfl="data?.lfl != null ? { percent: data.lfl } : null"
          :plan="getPlan('foodcost', data?.percent)"
          :loading="foodcostStore.isLoadingFoodcost"
        />
        <MetricCard
          title="Себестоимость"
          :value="data?.costSum ?? null"
          format="currency"
          icon="DollarSign"
          :loading="foodcostStore.isLoadingFoodcost"
        />
        <MetricCard title="Выручка" :value="data?.revenue ?? null" format="currency" icon="TrendingUp" :loading="foodcostStore.isLoadingFoodcost" />
      </div>

      <Card class="p-5 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">Оценка уровня</h2>
            <p class="text-xs text-muted-foreground">Норма: ниже 30%, внимание: 30–35%, критично: выше 35%</p>
          </div>
          <span :class="statusClass" class="px-2.5 py-1 rounded-full text-xs font-medium">
            {{ statusLabel }}
          </span>
        </div>

        <div class="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div :class="barClass" class="h-full rounded-full transition-all" :style="{ width: `${Math.min(data?.percent || 0, 100)}%` }" />
        </div>
      </Card>

      <Card class="overflow-hidden">
        <div class="px-4 py-3 border-b border-border">
          <h2 class="text-sm font-semibold text-foreground">Категории по фудкосту</h2>
        </div>

        <div v-if="foodcostStore.isLoadingFoodcost" class="p-4 space-y-2">
          <div v-for="i in 6" :key="i" class="h-10 rounded bg-muted animate-pulse" />
        </div>

        <div v-else-if="!data?.categories?.length" class="p-6 text-sm text-muted-foreground text-center">Нет данных</div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="text-left px-4 py-3 font-medium text-muted-foreground">Категория</th>
              <th class="text-right px-4 py-3 font-medium text-muted-foreground">Фудкост</th>
              <th class="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Себестоимость</th>
              <th class="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Выручка</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.categories" :key="item.name" class="border-b border-border/50 last:border-0">
              <td class="px-4 py-3 text-foreground">{{ item.name }}</td>
              <td class="px-4 py-3 text-right font-medium" :class="getPercentClass(item.percent)">{{ formatPercent(item.percent) }}</td>
              <td class="px-4 py-3 text-right hidden md:table-cell">{{ formatCurrency(item.cost) }}</td>
              <td class="px-4 py-3 text-right hidden md:table-cell">{{ formatCurrency(item.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { AlertCircle, Percent } from "lucide-vue-next";
import PageFilters from "@/components/filters/PageFilters.vue";
import MetricCard from "@/components/metrics/MetricCard.vue";
import Card from "@/components/ui/Card.vue";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRevenueStore } from "@/stores/revenue";
import { useFoodcostStore } from "@/stores/foodcost";
import { useFiltersStore } from "@/stores/filters";
import { usePlansStore } from "@/stores/plans";
import ReportInfoBlock from "@/components/reports/ReportInfoBlock.vue";

const revenueStore = useRevenueStore();
const foodcostStore = useFoodcostStore();
const filtersStore = useFiltersStore();
const plansStore = usePlansStore();
const error = ref(null);

const data = computed(() => foodcostStore.foodcostData);

const statusLabel = computed(() => {
  switch (data.value?.status) {
    case "critical":
      return "Критично";
    case "warning":
      return "Требует внимания";
    case "unavailable":
      return "Нет данных";
    default:
      return "Норма";
  }
});

const statusClass = computed(() => {
  switch (data.value?.status) {
    case "critical":
      return "bg-destructive/10 text-destructive";
    case "warning":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    case "unavailable":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
});

const barClass = computed(() => {
  switch (data.value?.status) {
    case "critical":
      return "bg-destructive";
    case "warning":
      return "bg-yellow-500";
    case "unavailable":
      return "bg-muted-foreground/40";
    default:
      return "bg-emerald-500";
  }
});

function getPercentClass(value) {
  if (value > 35) return "text-destructive";
  if (value >= 30) return "text-yellow-700 dark:text-yellow-400";
  return "text-emerald-700 dark:text-emerald-400";
}

function formatCurrency(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(2)}%`;
}

function getPlan(metric, currentValue) {
  return plansStore.getMetricPlan(metric, filtersStore.preset, revenueStore.currentOrganizationId, currentValue);
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const lflDateFrom = payload.lflDateFrom ?? filtersStore.lflDateFrom;
  const lflDateTo = payload.lflDateTo ?? filtersStore.lflDateTo;

  error.value = null;
  try {
    await foodcostStore.loadFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
  } catch (e) {
    error.value = e.message || "Ошибка загрузки фудкоста";
  }
}

useAutoRefresh(() => {
  if (data.value) {
    handleApply();
  }
});

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }

  if (!plansStore.plans.length) {
    await plansStore.loadPlans();
  }

  if (!data.value) {
    handleApply();
  }
});
</script>
