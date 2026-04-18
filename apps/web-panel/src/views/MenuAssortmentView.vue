<template>
  <div class="min-w-0 space-y-5">
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-foreground">Продуктовый ABC-анализ</h1>
        <Button class="md:hidden" size="sm" variant="outline" @click="showFiltersMobile = !showFiltersMobile">
          {{ showFiltersMobile ? "Скрыть фильтры" : "Фильтры" }}
        </Button>
      </div>

      <div :class="showFiltersMobile ? 'block' : 'hidden md:block'">
        <PageFilters :loading="isPageLoading" @apply="handleApply" />
      </div>
    </div>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div
      v-if="!pageError && report?.warningMessage"
      class="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-300"
    >
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ report.warningMessage }}</span>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="A-позиций" :value="report?.summary?.countA ?? null" format="number" icon="TrendingUp" :loading="isPageLoading" />
          <MetricCard title="B-позиций" :value="report?.summary?.countB ?? null" format="number" icon="Store" :loading="isPageLoading" />
          <MetricCard title="C-позиций" :value="report?.summary?.countC ?? null" format="number" icon="BarChart2" :loading="isPageLoading" />
          <MetricCard
            title="Выручка A-группы"
            :value="report?.summary?.groupARevenue ?? null"
            format="currency"
            icon="ShoppingCart"
            :loading="isPageLoading"
          />
          <MetricCard title="Доля A-группы" :value="groupASharePercent" format="percent" icon="Percent" :loading="isPageLoading" />
          <MetricCard
            title="Общая выручка"
            :value="report?.summary?.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="group in groupTabs"
          :key="group.value"
          size="sm"
          :variant="groupFilter === group.value ? 'default' : 'secondary'"
          @click="applyGroupFilter(group.value)"
        >
          {{ group.label }}
        </Button>
      </div>

      <div class="md:hidden space-y-3">
        <Card v-for="item in visibleItems" :key="item.id" class="border-border/70 bg-card/95 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-foreground">{{ item.name }}</p>
              <p class="text-xs text-muted-foreground">{{ item.category || "Без категории" }}</p>
            </div>
            <Badge :variant="item.abcGroup === 'A' ? 'destructive' : item.abcGroup === 'B' ? 'secondary' : 'outline'">
              {{ item.abcGroup }}
            </Badge>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Порций</p>
              <p class="font-medium text-foreground">{{ formatNumber(item.salesCount) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Выручка</p>
              <p class="font-medium text-foreground">{{ formatCurrency(item.revenue) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Доля выручки</p>
              <p class="font-medium text-foreground">{{ formatShare(item.revenueShare) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Доля накоп.</p>
              <p class="font-medium text-foreground">{{ formatShare(item.revenueShareUpToThisProduct) }}</p>
            </div>
          </div>
        </Card>

        <Card v-if="visibleItems.length === 0" class="border-border/70 bg-card/95 p-5">
          <p class="text-sm text-center text-muted-foreground">Нет данных для выбранной группы</p>
        </Card>
      </div>

      <Card class="hidden md:block border-border/70 bg-card/95 p-0 overflow-hidden min-w-0">
        <div class="h-[60vh] overflow-auto">
          <div class="min-w-[980px]">
            <Table class="w-full border-collapse text-xs">
              <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <TableRow class="text-muted-foreground">
                  <TableHead class="text-left font-medium">Позиция</TableHead>
                  <TableHead class="text-left font-medium">Категория</TableHead>
                  <TableHead class="text-right font-medium">Продаж</TableHead>
                  <TableHead class="text-right font-medium">Выручка</TableHead>
                  <TableHead class="text-right font-medium">Доля выручки</TableHead>
                  <TableHead class="text-right font-medium">Доля накоп.</TableHead>
                  <TableHead class="text-left font-medium">Группа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in visibleItems" :key="item.id" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ item.name }}</TableCell>
                  <TableCell class="text-foreground">{{ item.category || "Без категории" }}</TableCell>
                  <TableCell class="text-right text-foreground">{{ formatNumber(item.salesCount) }}</TableCell>
                  <TableCell class="text-right text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                  <TableCell class="text-right text-foreground">{{ formatShare(item.revenueShare) }}</TableCell>
                  <TableCell class="text-right text-foreground">{{ formatShare(item.revenueShareUpToThisProduct) }}</TableCell>
                  <TableCell>
                    <Badge :variant="item.abcGroup === 'A' ? 'destructive' : item.abcGroup === 'B' ? 'secondary' : 'outline'">
                      {{ item.abcGroup }}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow v-if="visibleItems.length === 0" class="border-t border-border/50">
                  <TableCell colspan="7" class="text-center text-muted-foreground">Нет данных для выбранной группы</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-muted-foreground">Показано {{ pagination.filteredTotal }} из {{ pagination.total }} позиций</p>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="outline" :disabled="pagination.page <= 1 || isPageLoading" @click="goToPage(pagination.page - 1)">
            Назад
          </Button>
          <span class="text-xs text-muted-foreground">Стр. {{ pagination.page }} / {{ pagination.totalPages }}</span>
          <Button
            size="sm"
            variant="outline"
            :disabled="pagination.page >= pagination.totalPages || isPageLoading"
            @click="goToPage(pagination.page + 1)"
          >
            Вперед
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import MetricCard from "../components/metrics/MetricCard.vue";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();
const showFiltersMobile = ref(false);
const groupFilter = ref("all");
const page = ref(1);
const pageLimit = ref(50);

const groupTabs = [
  { label: "Все", value: "all" },
  { label: "A", value: "A" },
  { label: "B", value: "B" },
  { label: "C", value: "C" },
];

const report = computed(() => reportsStore.menuAbcReport);
const isPageLoading = computed(() => reportsStore.isLoadingMenuAbc);
const pageError = computed(() => reportsStore.error);
const pagination = computed(() => ({
  page: Number(report.value?.pagination?.page || 1),
  limit: Number(report.value?.pagination?.limit || pageLimit.value),
  total: Number(report.value?.pagination?.total || 0),
  filteredTotal: Number(report.value?.pagination?.filteredTotal || 0),
  totalPages: Number(report.value?.pagination?.totalPages || 1),
}));
const groupASharePercent = computed(() => {
  const rawValue = Number(report.value?.summary?.groupAShare || 0);
  return Number.isFinite(rawValue) ? rawValue * 100 : null;
});
const visibleItems = computed(() => (Array.isArray(report.value?.items) ? report.value.items : []));

function formatNumber(value) {
  if (value == null || value === "") return "—";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return numericValue.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatShare(value) {
  const numericValue = Number(value || 0) * 100;
  if (!Number.isFinite(numericValue)) return "—";
  return `${numericValue.toFixed(2)}%`;
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const nextPage = Number(payload.page || 1);
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  page.value = nextPage;
  await reportsStore.loadMenuAbc({
    organizationId,
    dateFrom,
    dateTo,
    abcGroup: groupFilter.value,
    page: nextPage,
    limit: pageLimit.value,
  });
}

async function applyGroupFilter(nextGroup) {
  groupFilter.value = nextGroup;
  page.value = 1;
  await handleApply({ page: 1 });
}

async function goToPage(nextPage) {
  if (nextPage < 1) return;
  if (nextPage > pagination.value.totalPages) return;
  await handleApply({ page: nextPage });
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
