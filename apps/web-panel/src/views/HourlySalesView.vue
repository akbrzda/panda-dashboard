<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-foreground">Продажи по часам</h1>
        <span class="rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">Максимальный период — 35 дней</span>
      </div>
      <p class="text-sm text-muted-foreground">
        Период: {{ filtersStore.dateFrom }} — {{ filtersStore.dateTo }} / {{ periodWeeks }} недель
      </p>
      <p class="text-xs text-muted-foreground" v-if="hourlyReport?.timezone">Часовой пояс отчета: {{ hourlyReport.timezone }}</p>
    </div>

    <ReportInfoBlock
      title="О почасовом отчете"
      purpose="Отчет показывает, в какие часы формируется основной поток заказов и выручки."
      meaning="Нужен для планирования смен, кухни и курьерской загрузки по дням недели."
      calculation="Часы строятся в часовом поясе выбранного города, отмененные/удаленные заказы исключены."
      responsibility="Используется для операционного расписания и перераспределения ресурсов по часам."
    />

    <Card class="border-border/70 bg-card/95 p-4 md:p-5">
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </Card>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !hourlyReport && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="hourlyReport || isPageLoading">
      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h2 class="mb-4 text-base font-semibold text-foreground">Продажи по часам</h2>

        <div class="mb-3 flex flex-wrap gap-2">
          <button
            v-for="weekday in weekdayTabs"
            :key="weekday.weekdayIndex"
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
            :class="
              selectedWeekdayIndex === weekday.weekdayIndex
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/40 text-foreground hover:bg-accent hover:text-accent-foreground'
            "
            @click="selectedWeekdayIndex = weekday.weekdayIndex"
          >
            {{ weekday.weekday }}
          </button>
        </div>

        <div class="overflow-x-auto pb-1">
          <div class="flex min-w-max gap-2">
            <button
              v-for="hour in hourTabs"
              :key="hour"
              type="button"
              class="rounded-md border px-2.5 py-1.5 text-xs transition-colors"
              :class="
                selectedHour === hour
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              "
              @click="selectedHour = hour"
            >
              {{ formatHourRange(hour) }}
            </button>
          </div>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Заказы в выбранный час, по дням</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Час</th>
                <th class="px-3 py-2 text-left font-medium">Среднее количество заказов / выручка</th>
                <th v-for="day in selectedWeekdayRows" :key="`head-${day.date}`" class="px-3 py-2 text-left font-medium">
                  {{ formatDate(day.date) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-t border-border/60">
                <td class="px-3 py-3 font-medium text-foreground">{{ formatHourRange(selectedHour) }}</td>
                <td class="px-3 py-3 text-foreground">
                  <div class="font-semibold">{{ formatNumber(selectedHourAverage.orders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(selectedHourAverage.revenue) }}</div>
                </td>
                <td v-for="day in selectedWeekdayRows" :key="`cell-${day.date}`" class="px-3 py-3 text-foreground">
                  <div class="font-semibold">{{ formatNumber(getHourCell(day, selectedHour).orders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(getHourCell(day, selectedHour).revenue) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Заказы по дням, по часам</h3>
        <div class="overflow-x-auto">
          <table class="min-w-[1280px] border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left font-medium">День</th>
                <th class="px-3 py-2 text-left font-medium">Всего заказов</th>
                <th v-for="hour in hourTabs" :key="`hour-head-${hour}`" class="px-2 py-2 text-center font-medium">
                  {{ formatHourRange(hour) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in selectedWeekdayRows" :key="`row-${day.date}`" class="border-t border-border/50">
                <td class="sticky left-0 z-10 bg-card px-3 py-2 text-foreground">
                  <div class="font-semibold">{{ formatDate(day.date) }}</div>
                  <div class="text-muted-foreground">{{ day.weekday }}</div>
                </td>
                <td class="px-3 py-2 text-foreground">
                  <div class="font-semibold">{{ formatNumber(day.totalOrders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(day.totalRevenue) }}</div>
                </td>
                <td
                  v-for="hour in hourTabs"
                  :key="`row-${day.date}-hour-${hour}`"
                  class="px-2 py-2 text-center"
                  :class="hour === selectedHour ? 'bg-success/15' : ''"
                >
                  <div class="font-medium text-foreground">{{ formatNumber(getHourCell(day, hour).orders) }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ formatCurrency(getHourCell(day, hour).revenue) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Среднее количество заказов и выручка по дням недели</h3>
        <WeekdayAverageChart :rows="weekdaySummaryRows" :loading="isPageLoading" />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { AlertCircle, BarChart2 } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import WeekdayAverageChart from "../components/charts/WeekdayAverageChart.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const selectedWeekdayIndex = ref(1);
const selectedHour = ref(13);

const hourlyReport = computed(() => reportsStore.hourlySales);
const isPageLoading = computed(() => reportsStore.isLoadingHourlySales);
const pageError = computed(() => reportsStore.error);

const weekdaySummaryRows = computed(() => hourlyReport.value?.weekdaySummary || []);
const weekdayTabs = computed(() => weekdaySummaryRows.value.filter((row) => row.daysCount > 0));
const hourTabs = computed(() => Array.from({ length: 16 }, (_, index) => index + 8));
const dailyRows = computed(() => hourlyReport.value?.daily || []);

const selectedWeekdayRows = computed(() =>
  dailyRows.value.filter((row) => row.weekdayIndex === selectedWeekdayIndex.value).sort((left, right) => left.date.localeCompare(right.date)),
);

const selectedWeekdayHeatRow = computed(() => {
  const rows = hourlyReport.value?.heatmap || [];
  return rows.find((row) => row.weekdayIndex === selectedWeekdayIndex.value) || null;
});

const selectedHourAverage = computed(() => {
  const row = selectedWeekdayHeatRow.value;
  if (!row) {
    return { orders: 0, revenue: 0 };
  }

  return row.hours.find((cell) => cell.hour === selectedHour.value) || { orders: 0, revenue: 0 };
});

const periodWeeks = computed(() => {
  if (!filtersStore.dateFrom || !filtersStore.dateTo) {
    return 0;
  }

  const from = new Date(`${filtersStore.dateFrom}T00:00:00`);
  const to = new Date(`${filtersStore.dateTo}T00:00:00`);
  const diffDays = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
});

watch(
  weekdayTabs,
  (tabs) => {
    if (!tabs.length) {
      selectedWeekdayIndex.value = 1;
      return;
    }

    const exists = tabs.some((tab) => tab.weekdayIndex === selectedWeekdayIndex.value);
    if (!exists) {
      selectedWeekdayIndex.value = tabs[0].weekdayIndex;
    }
  },
  { immediate: true },
);

function getHourCell(day, hour) {
  return day.hours.find((item) => item.hour === hour) || { orders: 0, revenue: 0 };
}

function formatCurrency(value) {
  const safe = Number(value) || 0;
  return `${safe.toLocaleString("ru-RU")} ₽`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function formatHourRange(hour) {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) {
    return;
  }

  revenueStore.setCurrentOrganization(organizationId);
  await reportsStore.loadHourlySales({ organizationId, dateFrom, dateTo });
}

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }

  if (!hourlyReport.value) {
    await handleApply();
  }
});
</script>
