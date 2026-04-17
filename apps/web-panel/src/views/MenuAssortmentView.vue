<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Меню и ассортимент</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете ассортимента"
      purpose="Отчет объединяет продажи ассортимента и текущий стоп-лист по позициям."
      meaning="Показывает категории, доступность и позиции, которые дольше всего находятся в стопе."
      calculation="Продажи берутся из топа блюд, стоп-лист из iiko Transport; дополнительно считается длительность нахождения в стопе."
      responsibility="Используется менеджером меню и закупок для контроля доступности ассортимента."
    />

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Позиций" :value="report?.summary?.totalItems ?? null" format="number" icon="Store" :loading="isPageLoading" />
          <MetricCard title="Категорий" :value="report?.summary?.categories ?? null" format="number" icon="BarChart2" :loading="isPageLoading" />
          <MetricCard title="Продано порций" :value="report?.summary?.totalSoldQty ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard title="Недоступно" :value="report?.summary?.unavailableCount ?? null" format="number" icon="Percent" :inverse="true" :loading="isPageLoading" />
          <MetricCard title="Доступность" :value="report?.summary?.availabilityRate ?? null" format="percent" icon="BarChart2" :loading="isPageLoading" />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Категории ассортимента</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Категория</th>
                  <th class="px-3 py-2 text-left font-medium">Позиций</th>
                  <th class="px-3 py-2 text-left font-medium">Порций</th>
                  <th class="px-3 py-2 text-left font-medium">Выручка</th>
                  <th class="px-3 py-2 text-left font-medium">Недоступно</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report?.categories || []" :key="item.category" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ item.category }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.items) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.soldQty) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.revenue) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.unavailable) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Стоп-лист по позициям</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Позиция</th>
                  <th class="px-3 py-2 text-left font-medium">Причина</th>
                  <th class="px-3 py-2 text-left font-medium">Остаток</th>
                  <th class="px-3 py-2 text-left font-medium">В стопе, ч</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in stopListTop" :key="item.name" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ item.name }}</td>
                  <td class="px-3 py-2 text-foreground">{{ item.reason || "—" }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.balance) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.inStopHours) }}</td>
                </tr>
                <tr v-if="stopListTop.length === 0" class="border-t border-border/50">
                  <td colspan="4" class="px-3 py-4 text-center text-muted-foreground">Нет позиций в стоп-листе</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Ассортимент (продажи + доступность)</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Позиция</th>
                <th class="px-3 py-2 text-left font-medium">Категория</th>
                <th class="px-3 py-2 text-left font-medium">Порций</th>
                <th class="px-3 py-2 text-left font-medium">Выручка</th>
                <th class="px-3 py-2 text-left font-medium">Ср. цена</th>
                <th class="px-3 py-2 text-left font-medium">Доступность</th>
                <th class="px-3 py-2 text-left font-medium">В стопе, ч</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in itemsTop" :key="item.name" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ item.name }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.category }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatNumber(item.soldQty) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.revenue) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(item.avgPrice) }}</td>
                <td class="px-3 py-2">
                  <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="item.available ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'">
                    {{ item.available ? "В наличии" : "В стоп-листе" }}
                  </span>
                </td>
                <td class="px-3 py-2 text-foreground">{{ item.available ? "—" : formatNumber(item.inStopHours) }}</td>
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
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.menuAssortmentReport);
const isPageLoading = computed(() => reportsStore.isLoadingMenuAssortment);
const pageError = computed(() => reportsStore.error);

const itemsTop = computed(() => (report.value?.items || []).slice(0, 100));
const stopListTop = computed(() => (report.value?.stopListDigest || []).slice(0, 50));

function formatNumber(value) {
  if (value == null || value === "") return "—";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return numericValue.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
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
  await reportsStore.loadMenuAssortment({ organizationId, dateFrom, dateTo });
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
