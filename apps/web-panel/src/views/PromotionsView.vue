<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Акции и промокоды"
        description="Динамика скидок и вклад промо-механик в заказы и выручку."
        details="Отчет помогает оценивать эффективность промо по сумме и доле скидок, а также сравнивать вклад разных акций."
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

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard
            title="Дисконт"
            :value="report?.summary?.totalDiscount ?? null"
            :display-value="formatDiscountDisplay(report?.summary?.discountRate, report?.summary?.totalDiscount)"
            format="currency"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
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
            <div
              v-for="item in topPromotions"
              :key="`${item.promoType}-${item.promoName}`"
              class="rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-foreground">{{ item.promoName }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.promoType }}</div>
                </div>
                <div class="text-right text-xs">
                  <div class="font-semibold text-foreground">{{ formatDiscountDisplay(item.discountRate, item.discountSum) }}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="table-shell">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Механика акции</TableHead>
                <TableHead class="text-left font-medium">Акция</TableHead>
                <TableHead class="text-left font-medium">Заказы с акцией</TableHead>
                <TableHead class="text-left font-medium">Сумма скидки</TableHead>
                <TableHead class="text-left font-medium">Выручка после скидки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="item in promotionsPagination.pageItems"
                :key="`${item.promoType}-${item.promoName}`"
                class="border-t border-border/50"
              >
                <TableCell class="text-foreground">{{ item.promoType }}</TableCell>
                <TableCell class="text-foreground">{{ item.promoName }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDiscountDisplay(item.discountRate, item.discountSum) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.netSales) }}</TableCell>
              </TableRow>
              <TableRow v-if="promotionsPagination.totalItems === 0" class="border-t border-border/50">
                <TableCell colspan="5" class="text-center text-muted-foreground">Нет данных по акциям за выбранный период</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          v-if="promotionsPagination.totalItems > 0"
          :current-page="promotionsPagination.currentPage"
          :total-pages="promotionsPagination.totalPages"
          :total-items="promotionsPagination.totalItems"
          :range-start="promotionsPagination.rangeStart"
          :range-end="promotionsPagination.rangeEnd"
          :loading="isPageLoading"
          @prev="promotionsPagination.prevPage"
          @next="promotionsPagination.nextPage"
        />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";
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

const report = computed(() => reportsStore.promotionsReport);
const isPageLoading = computed(() => reportsStore.isLoadingPromotions);
const pageError = computed(() => reportsStore.error);
const lastLoadedAt = ref(null);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

const topPromotions = computed(() => (report.value?.promotions || []).slice(0, 8));
const promotionsRows = computed(() => report.value?.promotions || []);
const promotionsPagination = usePagination(promotionsRows, { pageSize: 15 });
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
  if (value == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPercent(value) {
  if (value == null) return "—";
  return `${Number(value).toFixed(2)}%`;
}

function formatDiscountDisplay(discountPercent, discountSum) {
  if (discountPercent == null && discountSum == null) return "—";
  return `${formatPercent(discountPercent)} (${formatCurrency(discountSum)})`;
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const completedOnly = payload.completedOnly ?? filtersStore.completedOnly;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  const result = await reportsStore.loadPromotions({ organizationId, dateFrom, dateTo, completedOnly });
  if (result) {
    lastLoadedAt.value = new Date();
  }
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
