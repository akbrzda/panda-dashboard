<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Меню и ассортимент</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

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
          <div class="overflow-x-auto">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Категория</TableHead>
                  <TableHead class="text-left font-medium">Позиций</TableHead>
                  <TableHead class="text-left font-medium">Порций</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Недоступно</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in report?.categories || []" :key="item.category" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ item.category }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.items) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.soldQty) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.unavailable) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="overflow-x-auto">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Позиция</TableHead>
                  <TableHead class="text-left font-medium">Причина</TableHead>
                  <TableHead class="text-left font-medium">Остаток</TableHead>
                  <TableHead class="text-left font-medium">В стопе, ч</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in stopListTop" :key="item.name" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ item.name }}</TableCell>
                  <TableCell class="text-foreground">{{ item.reason ||"—" }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.balance) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.inStopHours) }}</TableCell>
                </TableRow>
                <TableRow v-if="stopListTop.length === 0" class="border-t border-border/50">
                  <TableCell colspan="4" class="text-center text-muted-foreground">Нет позиций в стоп-листе</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="overflow-x-auto">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Позиция</TableHead>
                <TableHead class="text-left font-medium">Категория</TableHead>
                <TableHead class="text-left font-medium">Порций</TableHead>
                <TableHead class="text-left font-medium">Выручка</TableHead>
                <TableHead class="text-left font-medium">Ср. цена</TableHead>
                <TableHead class="text-left font-medium">Доступность</TableHead>
                <TableHead class="text-left font-medium">В стопе, ч</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in itemsTop" :key="item.name" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ item.name }}</TableCell>
                <TableCell class="text-foreground">{{ item.category }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.soldQty) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.avgPrice) }}</TableCell>
                <TableCell class="">
                  <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="item.available ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'">
                    {{ item.available ?"В наличии" :"В стоп-листе" }}
                  </span>
                </TableCell>
                <TableCell class="text-foreground">{{ item.available ?"—" : formatNumber(item.inStopHours) }}</TableCell>
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
import { AlertCircle } from"lucide-vue-next";
import { useReportsStore } from"../stores/reports";
import { useFiltersStore } from"../stores/filters";
import { useRevenueStore } from"../stores/revenue";
import PageFilters from"../components/filters/PageFilters.vue";
import Card from"../components/ui/Card.vue";
import MetricCard from"../components/metrics/MetricCard.vue";

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.menuAssortmentReport);
const isPageLoading = computed(() => reportsStore.isLoadingMenuAssortment);
const pageError = computed(() => reportsStore.error);

const itemsTop = computed(() => (report.value?.items || []).slice(0, 100));
const stopListTop = computed(() => (report.value?.stopListDigest || []).slice(0, 50));

function formatNumber(value) {
  if (value == null || value ==="") return"—";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return"—";
  return numericValue.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
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
