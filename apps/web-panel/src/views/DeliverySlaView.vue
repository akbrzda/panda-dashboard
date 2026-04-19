<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="SLA заказов по этапам"
        description="Контроль этапов исполнения, воронки и нарушений SLA по всем заказам за выбранный период."
        details="Отчет помогает контролировать соблюдение SLA по всем заказам, включая недоставочные сценарии, и показывает где именно возникают превышения времени."
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
          <MetricCard title="В SLA" :value="report?.summary?.onTimeRate ?? null" format="percent" icon="Clock" :loading="isPageLoading" />
        </div>
      </section>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h2 class="text-sm font-semibold text-foreground">Полнота данных по времени доставки</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Исключено из расчета late-метрик:
          {{ formatNumber(report?.summary?.excludedOrdersWithoutTimestamps ?? 0) }}
          из
          {{ formatNumber(report?.summary?.totalOrders ?? 0) }}
          заказов (нет обещанного или фактического времени).
        </p>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="table-shell">
          <Table class="min-w-full border-collapse text-sm">
            <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Этап</TableHead>
                <TableHead class="text-left font-medium">Среднее, мин</TableHead>
                <TableHead class="text-left font-medium">Порог, мин</TableHead>
                <TableHead class="text-left font-medium">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="stage in stageRows" :key="stage.key" class="border-t border-border/50">
                <TableCell class="font-medium text-foreground">{{ stage.title }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(stage.avg) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(stage.threshold) }}</TableCell>
                <TableCell class="">
                  <span
                    class="rounded-full px-2 py-1 text-xs font-semibold"
                    :class="
                      !stage.hasData
                        ? 'bg-muted text-muted-foreground'
                        : stage.avg <= stage.threshold
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive'
                    "
                  >
                    {{ !stage.hasData ? "Нет данных" : stage.avg <= stage.threshold ? "В норме" : "Выше порога" }}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
          <div class="space-y-2 md:hidden">
            <div v-for="item in hourlyPagination.pageItems" :key="item.hour" class="rounded-lg border border-border/70 bg-background/70 p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-foreground">{{ formatHourRange(item.hour) }}</span>
                <span class="text-xs text-muted-foreground">Доля {{ formatNumber(item.violationRate) }}%</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Заказов</p>
                  <p class="font-medium text-foreground">{{ formatNumber(item.orders) }}</p>
                </div>
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Нарушений</p>
                  <p class="font-medium text-foreground">{{ formatNumber(item.violations) }}</p>
                </div>
              </div>
            </div>
            <PaginationControls
              v-if="hourlyPagination.totalItems > 0"
              :current-page="hourlyPagination.currentPage"
              :total-pages="hourlyPagination.totalPages"
              :total-items="hourlyPagination.totalItems"
              :range-start="hourlyPagination.rangeStart"
              :range-end="hourlyPagination.rangeEnd"
              :loading="isPageLoading"
              @prev="hourlyPagination.prevPage"
              @next="hourlyPagination.nextPage"
            />
          </div>
          <div class="table-shell hidden md:block">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Час</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Нарушений</TableHead>
                  <TableHead class="text-left font-medium">Доля, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in hourlyPagination.pageItems" :key="item.hour" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ formatHourRange(item.hour) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.violations) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.violationRate) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            v-if="hourlyPagination.totalItems > 0"
            :current-page="hourlyPagination.currentPage"
            :total-pages="hourlyPagination.totalPages"
            :total-items="hourlyPagination.totalItems"
            :range-start="hourlyPagination.rangeStart"
            :range-end="hourlyPagination.rangeEnd"
            :loading="isPageLoading"
            @prev="hourlyPagination.prevPage"
            @next="hourlyPagination.nextPage"
          />
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="space-y-2 md:hidden">
          <div
            v-for="item in violationsPagination.pageItems"
            :key="`${item.orderNumber || item.orderId}-${item.date || ''}-mobile`"
            class="rounded-lg border border-border/70 bg-background/70 p-3"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-foreground">{{ item.orderNumber || "Без номера" }}</span>
              <span class="text-xs text-muted-foreground">{{ item.date || "—" }}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-md bg-muted/40 p-2">
                <p class="text-muted-foreground">Итого, мин</p>
                <p class="font-medium text-foreground">{{ formatDuration(item.totalMinutes) }}</p>
              </div>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">{{ item.violations.join(", ") || "Без нарушений" }}</p>
          </div>
          <div v-if="violationsPagination.totalItems === 0" class="rounded-lg border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground">
            Нарушений за выбранный период нет
          </div>
          <PaginationControls
            v-if="violationsPagination.totalItems > 0"
            :current-page="violationsPagination.currentPage"
            :total-pages="violationsPagination.totalPages"
            :total-items="violationsPagination.totalItems"
            :range-start="violationsPagination.rangeStart"
            :range-end="violationsPagination.rangeEnd"
            :loading="isPageLoading"
            @prev="violationsPagination.prevPage"
            @next="violationsPagination.nextPage"
          />
        </div>
        <div class="table-shell hidden md:block">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Дата</TableHead>
                <TableHead class="text-left font-medium">Заказ</TableHead>
                <TableHead class="text-left font-medium">Итого, мин</TableHead>
                <TableHead class="text-left font-medium">Нарушения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="item in violationsPagination.pageItems"
                :key="`${item.orderNumber || item.orderId}-${item.date || ''}`"
                class="border-t border-border/50"
              >
                <TableCell class="text-foreground">{{ item.date || "—" }}</TableCell>
                <TableCell class="text-foreground">{{ item.orderNumber || "Без номера" }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.totalMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ item.violations.join(",") }}</TableCell>
              </TableRow>
              <TableRow v-if="violationsPagination.totalItems === 0" class="border-t border-border/50">
                <TableCell colspan="4" class="text-center text-muted-foreground">Нарушений за выбранный период нет</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          v-if="violationsPagination.totalItems > 0"
          :current-page="violationsPagination.currentPage"
          :total-pages="violationsPagination.totalPages"
          :total-items="violationsPagination.totalItems"
          :range-start="violationsPagination.rangeStart"
          :range-end="violationsPagination.rangeEnd"
          :loading="isPageLoading"
          @prev="violationsPagination.prevPage"
          @next="violationsPagination.nextPage"
        />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle, Truck } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import { formatMinutesToHms } from "../lib/utils";
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
const lastLoadedAt = ref(null);

const report = computed(() => reportsStore.slaReport);
const isPageLoading = computed(() => reportsStore.isLoadingSla);
const pageError = computed(() => reportsStore.error);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

const stageRows = computed(() => {
  const stageKpi = report.value?.stageKpi || {};
  return [
    {
      key: "prep",
      title: "Приготовление",
      avg: stageKpi.prep?.avg != null ? Number(stageKpi.prep.avg) : null,
      threshold: Number(stageKpi.prep?.threshold || 0),
      hasData: Number(stageKpi.prep?.count || 0) > 0,
    },
    {
      key: "shelf",
      title: "Полка",
      avg: stageKpi.shelf?.avg != null ? Number(stageKpi.shelf.avg) : null,
      threshold: Number(stageKpi.shelf?.threshold || 0),
      hasData: Number(stageKpi.shelf?.count || 0) > 0,
    },
    {
      key: "route",
      title: "В пути",
      avg: stageKpi.route?.avg != null ? Number(stageKpi.route.avg) : null,
      threshold: Number(stageKpi.route?.threshold || 0),
      hasData: Number(stageKpi.route?.count || 0) > 0,
    },
    {
      key: "total",
      title: "Общее SLA",
      avg: stageKpi.total?.avg != null ? Number(stageKpi.total.avg) : null,
      threshold: Number(stageKpi.total?.threshold || 0),
      hasData: Number(stageKpi.total?.count || 0) > 0,
    },
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

const hourlyRows = computed(() => report.value?.hourly || []);
const topViolations = computed(() => report.value?.violations || []);
const hourlyPagination = usePagination(hourlyRows, { pageSize: 12 });
const violationsPagination = usePagination(topViolations, { pageSize: 10 });

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDuration(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }
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
  if (reportsStore.slaReport) {
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
