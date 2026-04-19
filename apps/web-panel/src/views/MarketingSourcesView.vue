<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Маркетинговые источники"
        description="Customer Pack: каналы привлечения, вклад в выручку и переход к клиентским сегментам."
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
      <Megaphone class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-foreground">Работа с сегментом источника</h2>
          <Button type="button" variant="outline" size="sm" :disabled="!selectedSource" @click="openClientsDrilldown"> Перейти к клиентам </Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge v-if="selectedSource" variant="outline">Выбран источник: {{ selectedSource }}</Badge>
          <Badge v-else variant="secondary">Выберите строку источника в таблице</Badge>
        </div>
      </Card>

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
        <div class="table-shell">
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
              <TableRow
                v-for="item in sourcesPagination.pageItems"
                :key="item.source"
                class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                :class="selectedSource === item.source ? 'bg-muted/40' : ''"
                @click="selectSource(item.source)"
              >
                <TableCell class="text-foreground">{{ item.source }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.avgCheck) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.ordersShare) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.revenueShare) }}</TableCell>
              </TableRow>
              <TableRow v-if="sourcesPagination.totalItems === 0" class="border-t border-border/50">
                <TableCell colspan="6" class="text-center text-muted-foreground">Нет данных по источникам за выбранный период</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          v-if="sourcesPagination.totalItems > 0"
          :current-page="sourcesPagination.currentPage"
          :total-pages="sourcesPagination.totalPages"
          :total-items="sourcesPagination.totalItems"
          :range-start="sourcesPagination.rangeStart"
          :range-end="sourcesPagination.rangeEnd"
          :loading="isPageLoading"
          @prev="sourcesPagination.prevPage"
          @next="sourcesPagination.nextPage"
        />
      </Card>

      <Card v-if="selectedSource" class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Динамика источника: {{ selectedSource }}</h3>
        <div class="space-y-2">
          <div
            v-for="item in sourceBreakdownPagination.pageItems"
            :key="`source-breakdown-${item.date}`"
            class="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-3 text-xs md:grid-cols-4"
          >
            <span class="text-muted-foreground">{{ item.date }}</span>
            <span class="text-foreground">Заказов: {{ formatNumber(item.orders) }}</span>
            <span class="text-foreground">Выручка: {{ formatCurrency(item.revenue) }}</span>
            <span class="text-foreground">Средний чек: {{ formatCurrency(item.avgCheck) }}</span>
          </div>
          <p v-if="sourceBreakdownPagination.totalItems === 0" class="text-sm text-muted-foreground">
            По выбранному источнику нет ежедневной детализации за период.
          </p>
          <PaginationControls
            v-if="sourceBreakdownPagination.totalItems > 0"
            :current-page="sourceBreakdownPagination.currentPage"
            :total-pages="sourceBreakdownPagination.totalPages"
            :total-items="sourceBreakdownPagination.totalItems"
            :range-start="sourceBreakdownPagination.rangeStart"
            :range-end="sourceBreakdownPagination.rangeEnd"
            :loading="isPageLoading"
            @prev="sourceBreakdownPagination.prevPage"
            @next="sourceBreakdownPagination.nextPage"
          />
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AlertCircle, Megaphone } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import DonutChart from "../components/charts/DonutChart.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";
import { usePagination } from "@/composables/usePagination";
import PaginationControls from "@/components/ui/PaginationControls.vue";

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
const selectedSource = ref("");

const report = computed(() => reportsStore.marketingSourcesReport);
const isPageLoading = computed(() => reportsStore.isLoadingMarketingSources);
const pageError = computed(() => reportsStore.error);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});
const sourcesRows = computed(() => report.value?.sources || []);
const selectedSourceBreakdown = computed(() => {
  if (!selectedSource.value) return [];
  return (report.value?.dailyBreakdown || [])
    .map((item) => {
      const channel = item.channels?.[selectedSource.value];
      if (!channel) return null;
      return {
        date: item.date,
        orders: Number(channel.orders || 0),
        revenue: Number(channel.revenue || 0),
        avgCheck: Number(channel.orders || 0) > 0 ? Number(channel.revenue || 0) / Number(channel.orders || 0) : 0,
      };
    })
    .filter(Boolean);
});

const sourcesPagination = usePagination(sourcesRows, { pageSize: 15 });
const sourceBreakdownPagination = usePagination(selectedSourceBreakdown, { pageSize: 10 });

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
  const completedOnly = payload.completedOnly ?? filtersStore.completedOnly;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  const result = await reportsStore.loadMarketingSources({ organizationId, dateFrom, dateTo, completedOnly });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

function selectSource(source) {
  selectedSource.value = selectedSource.value === source ? "" : source;
  sourceBreakdownPagination.resetPage();
}

function openClientsDrilldown() {
  if (!selectedSource.value) return;
  router.push({
    path: "/clients",
    query: {
      ...route.query,
      customerSource: selectedSource.value,
      drill: "customer-pack-source",
    },
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

watch(
  () => route.query,
  (query) => {
    selectedSource.value = pickQueryValue(query, ["source", "customerSource"]);
    sourcesPagination.resetPage();
    sourceBreakdownPagination.resetPage();
  },
  { immediate: true, deep: true },
);
</script>
