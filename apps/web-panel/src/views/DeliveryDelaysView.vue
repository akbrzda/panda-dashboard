<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Опоздания и KPI курьеров"
        description="Единый отчет по опозданиям заказов и эффективности курьерской доставки."
        details="Показывает динамику опозданий и KPI курьеров на единой выборке завершенных заказов. Используется для контроля SLA и поиска узких мест по часам, подразделениям и курьерам."
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
      >
        <template #actions>
          <Button type="button" variant="outline" size="sm" :disabled="isExportLoading || isPageLoading" @click="handleExport">
            {{ isExportLoading ? "Подготовка файла..." : "Выгрузить в Excel" }}
          </Button>
        </template>
      </ReportPageHeader>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>
    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !report && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <Clock class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">Сводка по опозданиям и KPI курьеров</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard
            title="Опозданий"
            :value="report?.summary?.delayedOrders ?? null"
            format="number"
            icon="Clock"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard title="В срок" :value="report?.summary?.onTimeOrders ?? null" format="number" icon="Truck" :loading="isPageLoading" />
          <MetricCard
            title="Доля опозданий"
            :value="report?.summary?.delayRate ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Суммарное опоздание"
            :value="report?.summary?.totalLateMinutes ?? null"
            format="time"
            icon="BarChart2"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Среднее опоздание"
            :value="report?.summary?.avgLateMinutes ?? null"
            format="time"
            icon="BarChart2"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Курьеров"
            :value="courierKpiReport?.summary?.totalCouriers ?? null"
            format="number"
            icon="Users"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Выручка"
            :value="courierKpiReport?.summary?.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Заказов на курьера"
            :value="courierKpiReport?.summary?.avgOrdersPerCourier ?? null"
            format="number"
            icon="BarChart2"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[1.35fr_1fr]">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Курьер</TableHead>
                  <TableHead class="text-left font-medium">Заказы</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Опозданий</TableHead>
                  <TableHead class="text-left font-medium">Доля, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="courier in couriersPagination.pageItems"
                  :key="courier.courierId"
                  class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                  :class="selectedCourierId === String(courier.courierId || '') ? 'bg-muted/40' : ''"
                  @click="selectCourier(courier.courierId, courier.courierName)"
                >
                  <TableCell class="text-foreground">{{ courier.courierName }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(courier.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(courier.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(courier.delayed) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(courier.delayRate) }}</TableCell>
                </TableRow>
                <TableRow v-if="couriersPagination.totalItems === 0" class="border-t border-border/50">
                  <TableCell colspan="5" class="text-center text-muted-foreground">Нет данных по курьерам за выбранный период</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            v-if="couriersPagination.totalItems > 0"
            :current-page="couriersPagination.currentPage"
            :total-pages="couriersPagination.totalPages"
            :total-items="couriersPagination.totalItems"
            :range-start="couriersPagination.rangeStart"
            :range-end="couriersPagination.rangeEnd"
            :loading="isPageLoading"
            @prev="couriersPagination.prevPage"
            @next="couriersPagination.nextPage"
          />
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Распределение маршрутов</h3>
          <div class="space-y-3">
            <div v-for="item in routeDistribution" :key="item.label" class="space-y-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="text-foreground">{{ item.label }}</span>
                <span class="font-semibold text-foreground">{{ formatNumber(item.percent) }}%</span>
              </div>
              <div class="h-2 rounded-full bg-muted">
                <div class="h-2 rounded-full bg-primary transition-all" :style="{ width: `${Math.min(item.percent, 100)}%` }"></div>
              </div>
              <div class="text-xs text-muted-foreground">
                Маршрутов: {{ formatNumber(item.routeCount) }}, заказов: {{ formatNumber(item.ordersCount) }}
              </div>
            </div>
            <div v-if="routeDistribution.length === 0" class="py-4 text-center text-sm text-muted-foreground">Нет данных по маршрутам</div>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="table-shell">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Дата</TableHead>
                <TableHead class="text-left font-medium">Заказ</TableHead>
                <TableHead class="text-left font-medium">Обещано</TableHead>
                <TableHead class="text-left font-medium">Факт</TableHead>
                <TableHead class="text-left font-medium">Опоздание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="item in delayedOrdersPagination.pageItems"
                :key="`${item.orderNumber || item.orderId}-${item.date || ''}`"
                class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                :class="selectedOrderId === String(item.orderId || item.orderNumber || '') ? 'bg-muted/40' : ''"
                @click="selectOrder(item)"
              >
                <TableCell class="text-foreground">{{ item.date }}</TableCell>
                <TableCell class="text-foreground">{{ item.orderNumber || "Без номера" }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.promisedMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.actualMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.lateMinutes) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          v-if="delayedOrdersPagination.totalItems > 0"
          :current-page="delayedOrdersPagination.currentPage"
          :total-pages="delayedOrdersPagination.totalPages"
          :total-items="delayedOrdersPagination.totalItems"
          :range-start="delayedOrdersPagination.rangeStart"
          :range-end="delayedOrdersPagination.rangeEnd"
          :loading="isPageLoading"
          @prev="delayedOrdersPagination.prevPage"
          @next="delayedOrdersPagination.nextPage"
        />
      </Card>

      <Card v-if="selectedOrder" class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Карточка заказа</h3>
        <div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Номер заказа</p>
            <p class="font-medium text-foreground">{{ selectedOrder.orderNumber || "Без номера" }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Дата</p>
            <p class="font-medium text-foreground">{{ selectedOrder.date || "—" }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Подразделение</p>
            <p class="font-medium text-foreground">{{ selectedOrder.departmentId || "—" }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Обещано</p>
            <p class="font-medium text-foreground">{{ formatDuration(selectedOrder.promisedMinutes) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Факт</p>
            <p class="font-medium text-foreground">{{ formatDuration(selectedOrder.actualMinutes) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Опоздание</p>
            <p class="font-medium text-foreground">{{ formatDuration(selectedOrder.lateMinutes) }}</p>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AlertCircle, Clock, Users, TrendingUp } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import { reportsApi } from "../api/reports";
import { toast } from "../lib/sonner";
import { formatMinutesToHms } from "../lib/utils";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import Button from "../components/ui/Button.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";
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
const router = useRouter();

const report = computed(() => reportsStore.deliveryDelaysReport);
const courierKpiReport = computed(() => reportsStore.courierKpiReport);
const isPageLoading = computed(() => reportsStore.isLoadingDeliveryDelays || reportsStore.isLoadingCourierKpi);
const pageError = computed(() => reportsStore.error);
const isExportLoading = ref(false);
const lastLoadedAt = ref(null);
const selectedDepartmentId = ref("");
const selectedHour = ref(null);
const selectedCourierId = ref("");
const selectedCourierName = ref("");
const selectedOrderId = ref("");
const selectedStatus = ref("");

const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

const filteredDelayedOrders = computed(() => {
  return (report.value?.delayedOrders || []).filter((item) => {
    if (selectedDepartmentId.value && String(item.departmentId || "") !== selectedDepartmentId.value) return false;
    if (selectedCourierId.value && String(item.courierId || "") !== selectedCourierId.value) return false;
    if (selectedHour.value != null) {
      const hourFromDate = Number(String(item.date || "").slice(11, 13));
      if (Number.isInteger(hourFromDate) && hourFromDate !== selectedHour.value) return false;
    }
    return true;
  });
});

const routeDistribution = computed(() => courierKpiReport.value?.routeDistribution || []);
const selectedOrder = computed(() => {
  return filteredDelayedOrders.value.find((item) => String(item.orderId || item.orderNumber || "") === selectedOrderId.value) || null;
});

const couriersWithKpi = computed(() => {
  const delaysByCourierId = new Map(
    (report.value?.couriers || []).filter((item) => item && typeof item === "object").map((item) => [String(item.courierId || ""), item]),
  );

  return (courierKpiReport.value?.couriers || [])
    .filter((courier) => courier && typeof courier === "object")
    .slice(0, 20)
    .map((courier) => {
      const courierId = String(courier.courierId || "");
      const delayStats = delaysByCourierId.get(courierId);

      return {
        ...courier,
        delayed: Number(delayStats?.delayed || 0),
        delayRate: Number(delayStats?.delayRate || 0),
      };
    });
});

const couriersPagination = usePagination(couriersWithKpi, { pageSize: 12 });
const delayedOrdersPagination = usePagination(filteredDelayedOrders, { pageSize: 20 });

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDuration(value) {
  return formatMinutesToHms(value);
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
  const [delaysResult] = await Promise.all([
    reportsStore.loadDeliveryDelays({ organizationId, dateFrom, dateTo }),
    reportsStore.loadCourierKpi({ organizationId, dateFrom, dateTo }),
  ]);
  if (delaysResult) {
    lastLoadedAt.value = new Date();
  }
}

function selectCourier(courierId, courierName = "") {
  const normalized = String(courierId || "");
  if (!normalized) return;
  if (selectedCourierId.value === normalized) {
    selectedCourierId.value = "";
    selectedCourierName.value = "";
    return;
  }
  selectedCourierId.value = normalized;
  selectedCourierName.value = courierName;
}

function selectOrder(item) {
  selectedOrderId.value = String(item?.orderId || item?.orderNumber || "");
}

function applyRouteDrilldown(query) {
  selectedDepartmentId.value = pickQueryValue(query, ["department"]);
  selectedStatus.value = pickQueryValue(query, ["status"]);
  const hourValue = pickQueryValue(query, ["hour"]);
  const parsedHour = Number.parseInt(hourValue, 10);
  selectedHour.value = Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour <= 23 ? parsedHour : null;
  selectedCourierId.value = pickQueryValue(query, ["courierId"]);
}

watch(
  () => route.query,
  (query) => {
    applyRouteDrilldown(query);
  },
  { immediate: true, deep: true },
);

watch(
  () => [selectedDepartmentId.value, selectedHour.value, selectedCourierId.value, selectedStatus.value],
  () => {
    delayedOrdersPagination.resetPage();

    const nextQuery = {
      ...route.query,
      department: selectedDepartmentId.value || undefined,
      hour: selectedHour.value != null ? String(selectedHour.value) : undefined,
      courierId: selectedCourierId.value || undefined,
      status: selectedStatus.value || undefined,
    };
    if (JSON.stringify(route.query) !== JSON.stringify(nextQuery)) {
      router.replace({ query: nextQuery });
    }
  },
);

watch(couriersWithKpi, () => {
  couriersPagination.resetPage();
});

function extractFilename(headers = {}, fallback = "opozdaniya.xls") {
  const contentDisposition = headers["content-disposition"] || headers["Content-Disposition"];
  if (!contentDisposition) return fallback;

  const utf8NameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8NameMatch?.[1]) {
    try {
      return decodeURIComponent(utf8NameMatch[1]);
    } catch (_) {
      return utf8NameMatch[1];
    }
  }

  const fileNameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return fileNameMatch?.[1] || fallback;
}

async function handleExport() {
  const organizationId = revenueStore.currentOrganizationId;
  const dateFrom = filtersStore.dateFrom;
  const dateTo = filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) {
    toast.error("Не выбраны фильтры", "Укажите организацию и период перед выгрузкой");
    return;
  }

  isExportLoading.value = true;
  try {
    const response = await reportsApi.exportDeliveryDelays({ organizationId, dateFrom, dateTo });
    const fileName = extractFilename(response.headers, `opozdaniya-${dateFrom}-${dateTo}.xls`);
    const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Файл готов", "Выгрузка опозданий успешно скачана");
  } catch (error) {
    console.error("❌ Ошибка выгрузки отчета по опозданиям:", error);
    toast.error("Ошибка выгрузки", "Не удалось сформировать Excel-файл");
  } finally {
    isExportLoading.value = false;
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
