<template>
  <div class="space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-foreground">Дашборд</h1>
        <span v-if="data" class="text-xs text-muted-foreground">
          {{ formatDate(data.date) }}
        </span>
      </div>
      <DashboardFilters ref="filtersRef" :loading="dashboardStore.isLoadingDashboard" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ error }}</span>
      <Button type="button" variant="outline" size="sm" class="ml-auto" @click="reload">Повторить</Button>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!dashboardStore.isLoadingDashboard && !data && !error" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Загрузка данных...</p>
    </div>

    <template v-if="data || dashboardStore.isLoadingDashboard">
      <!-- KPI строка -->
      <section>
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Сводные показатели</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Выручка"
            :value="data?.summary.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :plan="getPlan('revenue', data?.summary.totalRevenue)"
            :loading="dashboardStore.isLoadingDashboard"
          />
          <MetricCard
            title="Заказов"
            :value="data?.summary.totalOrders ?? null"
            format="number"
            icon="ShoppingCart"
            :plan="getPlan('orders', data?.summary.totalOrders)"
            :loading="dashboardStore.isLoadingDashboard"
          />
          <MetricCard
            title="Средний чек"
            :value="data?.summary.avgPerOrder ?? null"
            format="currency"
            icon="BarChart2"
            :plan="getPlan('avgPerOrder', data?.summary.avgPerOrder)"
            :loading="dashboardStore.isLoadingDashboard"
          />
          <MetricCard
            title="Дисконт"
            :value="data?.summary.discountSum ?? null"
            :display-value="formatDiscountDisplay(data?.summary?.discountPercent, data?.summary?.discountSum)"
            format="currency"
            icon="Tag"
            :inverse="true"
            :plan="getPlan('discountSum', data?.summary.discountSum)"
            :loading="dashboardStore.isLoadingDashboard"
          />
        </div>
      </section>

      <!-- Заказы по каналам -->
      <section v-if="hasChannels || dashboardStore.isLoadingDashboard">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Заказы по каналам</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <template v-if="dashboardStore.isLoadingDashboard">
            <MetricCard v-for="i in 4" :key="i" title="" :value="null" format="number" :loading="true" />
          </template>
          <template v-else>
            <Card v-for="(ch, name) in data.revenueByChannel" :key="name" class="p-4">
              <p class="text-xs text-muted-foreground mb-1 truncate">{{ name }}</p>
              <p class="text-lg font-semibold text-foreground tabular-nums">{{ formatNumber(ch.orders) }}</p>
              <p class="text-xs text-muted-foreground mt-1">{{ formatCurrency(ch.revenue) }}</p>
            </Card>
          </template>
        </div>
      </section>

      <!-- Графики: структура -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card class="p-5">
          <h3 class="text-sm font-semibold text-foreground mb-4">Выручка по каналам</h3>
          <DonutChart :channels="data?.revenueByChannel ?? {}" :loading="dashboardStore.isLoadingDashboard" />
        </Card>
      </div>

      <!-- По подразделениям (только если несколько) -->
      <Card v-if="showOrgChart" class="p-5">
        <h3 class="mb-4 text-sm font-semibold text-foreground">Выручка по подразделениям</h3>
        <OrgBarChart :orgs="data?.byOrganization ?? []" :loading="dashboardStore.isLoadingDashboard" />

        <div class="mt-5 overflow-x-auto rounded-lg border border-border/70">
          <Table class="w-full text-sm">
            <TableHeader>
              <TableRow class="border-b border-border bg-muted/40">
                <TableHead class="text-left font-medium text-muted-foreground">Подразделение</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">Выручка</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">Заказы</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground hidden md:table-cell">Ср. чек</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="dashboardStore.isLoadingDashboard" v-for="i in 4" :key="i" class="border-b border-border/40 last:border-0">
                <TableCell colspan="4" class="">
                  <div class="h-6 rounded bg-muted animate-pulse" />
                </TableCell>
              </TableRow>
              <TableRow v-else v-for="org in data?.byOrganization ?? []" :key="org.id" class="border-b border-border/40 last:border-0">
                <TableCell class="text-foreground">{{ org.name }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ formatCurrency(org.revenue) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ formatNumber(org.orders) }}</TableCell>
                <TableCell class="text-right tabular-nums hidden md:table-cell">{{ formatCurrency(org.avgCheck) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <!-- Навигация -->
      <section>
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Разделы</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <router-link v-for="link in sections" :key="link.to" :to="link.to" class="no-underline group">
            <Card class="p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <component :is="link.icon" class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-foreground text-sm">{{ link.title }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ link.desc }}</p>
                </div>
                <ArrowRight class="w-4 h-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { AlertCircle, BarChart2, ArrowRight } from "lucide-vue-next";
import MetricCard from "@/components/metrics/MetricCard.vue";
import DashboardFilters from "@/components/filters/DashboardFilters.vue";
import Card from "@/components/ui/Card.vue";
import DonutChart from "@/components/charts/DonutChart.vue";
import OrgBarChart from "@/components/charts/OrgBarChart.vue";
import Button from "@/components/ui/Button.vue";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRevenueStore } from "@/stores/revenue";
import { useDashboardStore } from "@/stores/dashboard";
import { useFiltersStore } from "@/stores/filters";
import { usePlansStore } from "@/stores/plans";
import { dashboardQuickLinksCatalog } from "@/config/reportCatalog";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const revenueStore = useRevenueStore();
const dashboardStore = useDashboardStore();
const filtersStore = useFiltersStore();
const plansStore = usePlansStore();

const filtersRef = ref(null);
const error = ref(null);

const data = computed(() => dashboardStore.dashboardData);
const hasChannels = computed(() => Object.keys(data.value?.revenueByChannel ?? {}).length > 0);
const showOrgChart = computed(() => (data.value?.byOrganization?.length ?? 0) > 1);
const currentPlanOrganizationId = computed(() => {
  if ((data.value?.byOrganization?.length ?? 0) === 1) {
    return data.value.byOrganization[0].id;
  }

  return "";
});

const sections = dashboardQuickLinksCatalog;

async function handleApply({ date, organizationIds }) {
  error.value = null;
  try {
    await dashboardStore.loadDashboard({ organizationIds, date });
  } catch (e) {
    error.value = e.message || "Ошибка загрузки дашборда";
  }
}

function reload() {
  filtersRef.value?.apply();
}

function getPlan(metric, currentValue) {
  return plansStore.getMetricPlan(metric, filtersStore.preset, currentPlanOrganizationId.value, currentValue);
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}.${m}.${y}`;
}

function formatCurrency(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(2)}%`;
}

function formatDiscountDisplay(discountPercent, discountSum) {
  if (discountPercent == null && discountSum == null) return "—";
  return `${formatPercent(discountPercent)} (${formatCurrency(discountSum)})`;
}

function formatNumber(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(val);
}

useAutoRefresh(() => {
  if (data.value) {
    reload();
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
    filtersRef.value?.apply();
  }
});
</script>
