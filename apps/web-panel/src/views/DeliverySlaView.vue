<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">SLA доставки по этапам</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете SLA"
      purpose="Отчет контролирует скорость прохождения заказа по этапам доставки и фиксирует нарушения нормативов."
      meaning="Показывает, где возникает узкое место: приготовление, ожидание на полке, путь или общий цикл."
      calculation="Время этапов строится по временным меткам заказа; отмененные/удаленные заказы исключены из расчета."
      responsibility="Используется для контроля операционной дисциплины кухни и курьерской логистики."
    />
    <p v-if="report?.timezone" class="text-xs text-muted-foreground">Часовой пояс отчета: {{ report.timezone }}</p>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !report && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <Truck class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">Ключевые показатели SLA</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Всего заказов"
            :value="report?.summary?.totalOrders ?? null"
            format="number"
            icon="ShoppingCart"
            :loading="isPageLoading"
          />
          <MetricCard title="Нарушений" :value="report?.summary?.violationsCount ?? null" format="number" icon="BarChart2" :loading="isPageLoading" />
          <MetricCard
            title="Доля нарушений"
            :value="report?.summary?.violationRate ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard title="Р’ SLA" :value="report?.summary?.onTimeRate ?? null" format="percent" icon="Clock" :loading="isPageLoading" />
        </div>
      </section>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Этапы SLA и пороговые значения</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-sm">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Этап</th>
                <th class="px-3 py-2 text-left font-medium">Среднее, мин</th>
                <th class="px-3 py-2 text-left font-medium">Порог, мин</th>
                <th class="px-3 py-2 text-left font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stage in stageRows" :key="stage.key" class="border-t border-border/50">
                <td class="px-3 py-2 font-medium text-foreground">{{ stage.title }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(stage.avg) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(stage.threshold) }}</td>
                <td class="px-3 py-2">
                  <span
                    class="rounded-full px-2 py-1 text-xs font-semibold"
                    :class="stage.avg <= stage.threshold ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'"
                  >
                    {{ stage.avg <= stage.threshold ? "В норме" : "Выше порога" }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_1.2fr]">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Воронка этапов</h3>
          <div class="space-y-2 text-sm">
            <div v-for="item in funnelRows" :key="item.key" class="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">{{ item.title }}</span>
                <span class="font-semibold text-foreground">{{ formatNumber(item.value) }}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Нарушения по часам</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Час</th>
                  <th class="px-3 py-2 text-left font-medium">Заказов</th>
                  <th class="px-3 py-2 text-left font-medium">Нарушений</th>
                  <th class="px-3 py-2 text-left font-medium">Доля, %</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report?.hourly || []" :key="item.hour" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ formatHourRange(item.hour) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.orders) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.violations) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.violationRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Топ нарушений</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Дата</th>
                <th class="px-3 py-2 text-left font-medium">Заказ</th>
                <th class="px-3 py-2 text-left font-medium">Курьер</th>
                <th class="px-3 py-2 text-left font-medium">Итого, мин</th>
                <th class="px-3 py-2 text-left font-medium">Нарушения</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in topViolations" :key="`${item.orderNumber || item.orderId}-${item.date || ''}`" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ item.date || "—" }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.orderNumber || "Без номера" }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.courierName }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(item.totalMinutes) }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.violations.join(", ") }}</td>
              </tr>
              <tr v-if="topViolations.length === 0" class="border-t border-border/50">
                <td colspan="5" class="px-3 py-4 text-center text-muted-foreground">Нарушений за выбранный период нет</td>
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
import { AlertCircle, Truck } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";
import { formatMinutesToHms } from "../lib/utils";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.slaReport);
const isPageLoading = computed(() => reportsStore.isLoadingSla);
const pageError = computed(() => reportsStore.error);

const stageRows = computed(() => {
  const stageKpi = report.value?.stageKpi || {};
  return [
    { key: "prep", title: "Приготовление", avg: Number(stageKpi.prep?.avg || 0), threshold: Number(stageKpi.prep?.threshold || 0) },
    { key: "shelf", title: "Полка", avg: Number(stageKpi.shelf?.avg || 0), threshold: Number(stageKpi.shelf?.threshold || 0) },
    { key: "route", title: "В пути", avg: Number(stageKpi.route?.avg || 0), threshold: Number(stageKpi.route?.threshold || 0) },
    { key: "total", title: "Общее SLA", avg: Number(stageKpi.total?.avg || 0), threshold: Number(stageKpi.total?.threshold || 0) },
  ];
});

const funnelRows = computed(() => {
  const funnel = report.value?.funnel || {};
  return [
    { key: "created", title: "Создано", value: Number(funnel.created || 0) },
    { key: "cooked", title: "Приготовлено", value: Number(funnel.cooked || 0) },
    { key: "dispatched", title: "Отправлено", value: Number(funnel.dispatched || 0) },
    { key: "delivered", title: "Доставлено", value: Number(funnel.delivered || 0) },
  ];
});

const topViolations = computed(() => (report.value?.violations || []).slice(0, 20));

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDuration(value) {
  return formatMinutesToHms(value);
}

function formatHourRange(hour) {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  await reportsStore.loadSla({ organizationId, dateFrom, dateTo });
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
