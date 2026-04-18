<template>
  <div class="min-w-0 space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Топ блюд</h1>
      <PageFilters :loading="topDishesStore.isLoadingTopDishes" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div
      v-if="!error && topDishesStore.topDishes?.warningMessage"
      class="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-300"
    >
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ topDishesStore.topDishes.warningMessage }}</span>
    </div>

    <!-- Пустое состояние -->
    <div
      v-if="!topDishesStore.isLoadingTopDishes && !topDishesStore.topDishes && !error"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <UtensilsCrossed class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="topDishesStore.topDishes || topDishesStore.isLoadingTopDishes">
      <!-- Итоги -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" v-if="topDishesStore.topDishes && !topDishesStore.isLoadingTopDishes">
        <MetricCard title="Блюд в меню" :value="topDishesStore.topDishes.total ?? null" format="number" icon="UtensilsCrossed" :loading="false" />
        <MetricCard
          title="Выручка (блюда)"
          :value="topDishesStore.topDishes.totalRevenue ?? null"
          format="currency"
          icon="TrendingUp"
          :loading="false"
        />
        <MetricCard title="Порций продано" :value="topDishesStore.topDishes.totalQty ?? null" format="number" icon="ShoppingCart" :loading="false" />
      </div>

      <!-- Переключатель -->
      <div class="flex items-center gap-2">
        <Button @click="view = 'top'" size="sm" :variant="view === 'top' ? 'default' : 'secondary'"> Топ-{{ limit }} </Button>
        <Button @click="view = 'outsiders'" size="sm" :variant="view === 'outsiders' ? 'default' : 'secondary'"> Аутсайдеры </Button>

        <!-- Поиск -->
        <div class="ml-auto relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input v-model="search" type="text" placeholder="Поиск блюда..." class="h-9 w-56 pl-9" />
        </div>
      </div>

      <!-- Скелетон -->
      <div v-if="topDishesStore.isLoadingTopDishes" class="space-y-2">
        <div v-for="i in 10" :key="i" class="h-12 rounded-lg bg-muted animate-pulse" />
      </div>

      <!-- Таблица -->
      <Card v-else class="overflow-hidden min-w-0">
        <div class="overflow-auto">
          <Table class="min-w-[980px] w-full text-sm">
            <TableHeader>
              <TableRow class="border-b border-border bg-muted/50">
                <TableHead class="text-left font-medium text-muted-foreground w-8">#</TableHead>
                <TableHead
                  class="text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  @click="toggleSort('name')"
                >
                  Блюдо
                  <SortIcon field="name" :sort="sort" />
                </TableHead>
                <TableHead
                  class="text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden sm:table-cell"
                  @click="toggleSort('category')"
                >
                  Категория
                  <SortIcon field="category" :sort="sort" />
                </TableHead>
                <TableHead
                  class="text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  @click="toggleSort('qty')"
                >
                  Кол-во
                  <SortIcon field="qty" :sort="sort" />
                </TableHead>
                <TableHead
                  class="text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden md:table-cell"
                  @click="toggleSort('revenue')"
                >
                  Выручка
                  <SortIcon field="revenue" :sort="sort" />
                </TableHead>
                <TableHead
                  class="text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden md:table-cell"
                  @click="toggleSort('revenueShare')"
                >
                  % от итога
                  <SortIcon field="revenueShare" :sort="sort" />
                </TableHead>
                <TableHead
                  class="text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden lg:table-cell"
                  @click="toggleSort('avgPrice')"
                >
                  Ср. цена
                  <SortIcon field="avgPrice" :sort="sort" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="filteredRows.length === 0">
                <TableCell colspan="7" class="text-center text-muted-foreground">Ничего не найдено</TableCell>
              </TableRow>
              <TableRow v-for="(dish, idx) in filteredRows" :key="dish.name" class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <TableCell class="text-muted-foreground">{{ idx + 1 }}</TableCell>
                <TableCell class="font-medium text-foreground">{{ dish.name }}</TableCell>
                <TableCell class="text-muted-foreground hidden sm:table-cell">{{ dish.category || "—" }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ formatNumber(dish.qty) }}</TableCell>
                <TableCell class="text-right tabular-nums hidden md:table-cell">{{ formatCurrency(dish.revenue) }}</TableCell>
                <TableCell class="text-right hidden md:table-cell">
                  <span class="inline-flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">{{ dish.revenueShare }}%</span>
                    <div class="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div class="h-full bg-primary rounded-full" :style="{ width: `${Math.min(dish.revenueShare * 2, 100)}%` }" />
                    </div>
                  </span>
                </TableCell>
                <TableCell class="text-right tabular-nums hidden lg:table-cell text-muted-foreground">{{ formatCurrency(dish.avgPrice) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { AlertCircle, Search, UtensilsCrossed } from "lucide-vue-next";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import { useTopDishesStore } from "../stores/topDishes";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Card from "../components/ui/Card.vue";
import Button from "../components/ui/Button.vue";
import Input from "../components/ui/Input.vue";

// Компонент иконки сортировки
import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const SortIcon = {
  props: ["field", "sort"],
  template: `
    <span class="ml-1 inline-block text-xs">
      <template v-if="sort.field === field">{{ sort.dir === 'asc' ? '↑' : '↓' }}</template>
      <template v-else>↕</template>
    </span>
  `,
};

const topDishesStore = useTopDishesStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const view = ref("top");
const search = ref("");
const limit = ref(20);
const error = ref(null);
const sort = ref({ field: "revenue", dir: "desc" });

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? filtersStore.organizationId ?? null;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  error.value = null;
  filtersStore.setOrganization(organizationId);
  filtersStore.setDateRange(dateFrom, dateTo);

  try {
    await topDishesStore.loadTopDishes({ organizationId, dateFrom, dateTo, limit: limit.value });
  } catch (e) {
    error.value = e.message || "Ошибка загрузки";
  }
}

function toggleSort(field) {
  if (sort.value.field === field) {
    sort.value = { field, dir: sort.value.dir === "asc" ? "desc" : "asc" };
  } else {
    sort.value = { field, dir: "desc" };
  }
}

const currentList = computed(() => {
  if (!topDishesStore.topDishes) return [];
  return view.value === "top" ? topDishesStore.topDishes.top : topDishesStore.topDishes.outsiders;
});

const filteredRows = computed(() => {
  let rows = currentList.value;
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    rows = rows.filter((d) => d.name.toLowerCase().includes(q) || (d.category || "").toLowerCase().includes(q));
  }
  const { field, dir } = sort.value;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return dir === "asc" ? cmp : -cmp;
  });
});

function formatCurrency(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(val);
}

useAutoRefresh(() => {
  if (topDishesStore.topDishes && filtersStore.organizationId) {
    handleApply();
  }
});

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (filtersStore.dateFrom && filtersStore.dateTo && filtersStore.organizationId && !topDishesStore.topDishes) {
    handleApply();
  }
});
</script>
