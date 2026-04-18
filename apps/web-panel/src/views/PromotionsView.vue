<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Акции и промокоды</h1>
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
                <TableHead class="text-left font-medium">Тип</TableHead>
                <TableHead class="text-left font-medium">Название</TableHead>
                <TableHead class="text-left font-medium">Заказов</TableHead>
                <TableHead class="text-left font-medium">Скидка</TableHead>
                <TableHead class="text-left font-medium">Net sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in report?.promotions || []" :key="`${item.promoType}-${item.promoName}`" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ item.promoType }}</TableCell>
                <TableCell class="text-foreground">{{ item.promoName }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDiscountDisplay(item.discountRate, item.discountSum) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.netSales) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

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
