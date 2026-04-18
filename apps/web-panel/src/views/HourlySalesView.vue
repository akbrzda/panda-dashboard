<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-foreground">Продажи по часам</h1>
        <Badge variant="destructive">Максимальный период — 35 дней</Badge>
      </div>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О почасовом отчете"
      purpose="Отчет показывает, в какие часы формируется основной поток заказов и выручки."
      meaning="Нужен для планирования смен, кухни и курьерской загрузки по дням недели."
      calculation="Часы строятся в часовом поясе выбранного города, отмененные/удаленные заказы исключены."
      responsibility="Используется для операционного расписания и перераспределения ресурсов по часам."
    />

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
        <div class="mb-3 flex flex-wrap gap-2">
          <Button
            v-for="weekday in weekdayTabs"
            :key="weekday.weekdayIndex"
            type="button"
            size="sm"
            :variant="selectedWeekdayIndex === weekday.weekdayIndex ? 'default' : 'outline'"
            @click="selectedWeekdayIndex = weekday.weekdayIndex"
          >
            {{ weekday.weekday }}
          </Button>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            v-for="hour in hourTabs"
            :key="hour"
            type="button"
            size="sm"
            :variant="selectedHour === hour ? 'secondary' : 'outline'"
            class="h-8 px-2.5"
            @click="selectedHour = hour"
          >
            {{ formatHourRange(hour) }}
          </Button>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-0">
        <div class="overflow-x-auto">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Час</TableHead>
                <TableHead class="text-left font-medium">Среднее количество заказов / выручка</TableHead>
                <TableHead v-for="day in selectedWeekdayRows" :key="`head-${day.date}`" class="text-left font-medium">
                  {{ formatDate(day.date) }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow class="border-t border-border/60">
                <TableCell class="font-medium text-foreground">{{ formatHourRange(selectedHour) }}</TableCell>
                <TableCell class="text-foreground">
                  <div class="font-semibold">{{ formatNumber(selectedHourAverage.orders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(selectedHourAverage.revenue) }}</div>
                </TableCell>
                <TableCell v-for="day in selectedWeekdayRows" :key="`cell-${day.date}`" class="text-foreground">
                  <div class="font-semibold">{{ formatNumber(getHourCell(day, selectedHour).orders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(getHourCell(day, selectedHour).revenue) }}</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-0">
        <div class="overflow-x-auto">
          <Table class="min-w-[1280px] border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="sticky left-0 z-10 bg-muted/60 text-left font-medium">День</TableHead>
                <TableHead class="text-left font-medium">Всего заказов</TableHead>
                <TableHead v-for="hour in hourTabs" :key="`hour-head-${hour}`" class="text-center font-medium">
                  {{ formatHourRange(hour) }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="day in selectedWeekdayRows" :key="`row-${day.date}`" class="border-t border-border/50">
                <TableCell class="sticky left-0 z-10 bg-card text-foreground">
                  <div class="font-semibold">{{ formatDate(day.date) }}</div>
                  <div class="text-muted-foreground">{{ day.weekday }}</div>
                </TableCell>
                <TableCell class="text-foreground">
                  <div class="font-semibold">{{ formatNumber(day.totalOrders) }}</div>
                  <div class="text-muted-foreground">{{ formatCurrency(day.totalRevenue) }}</div>
                </TableCell>
                <TableCell
                  v-for="hour in hourTabs"
                  :key="`row-${day.date}-hour-${hour}`"
                  class="text-center"
                  :class="hour === selectedHour ? 'bg-success/15' : ''"
                >
                  <div class="font-medium text-foreground">{{ formatNumber(getHourCell(day, hour).orders) }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ formatCurrency(getHourCell(day, hour).revenue) }}</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <WeekdayAverageChart :rows="weekdaySummaryRows" :loading="isPageLoading" />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from"vue";
import { AlertCircle, BarChart2 } from"lucide-vue-next";
import { useReportsStore } from"../stores/reports";
import { useFiltersStore } from"../stores/filters";
import { useRevenueStore } from"../stores/revenue";
import PageFilters from"../components/filters/PageFilters.vue";
import Card from"../components/ui/Card.vue";
import Badge from"../components/ui/Badge.vue";
import Button from"../components/ui/Button.vue";
import WeekdayAverageChart from"../components/charts/WeekdayAverageChart.vue";
import ReportInfoBlock from"../components/reports/ReportInfoBlock.vue";

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

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
  const start = String(hour).padStart(2,"0");
  const end = String((hour + 1) % 24).padStart(2,"0");
  return `${start}:00-${end}:00`;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric" });
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
