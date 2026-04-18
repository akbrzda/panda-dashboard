<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <ReportPageHeader
          title="Опоздания доставок"
          description="Delivery Pack drill-down: часы риска → курьер → проблемный заказ."
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
        <Button type="button" variant="outline" size="sm" :disabled="isExportLoading || isPageLoading" @click="handleExport">
          {{ isExportLoading ? "Подготовка файла..." : "Выгрузить в Excel" }}
        </Button>
      </div>
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
      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-foreground">Активный drill-down</h2>
          <Button type="button" variant="outline" size="sm" @click="resetDrilldownFilters">Сбросить</Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge v-if="selectedDepartmentId" variant="outline">Подразделение: {{ selectedDepartmentId }}</Badge>
          <Badge v-if="selectedHour != null" variant="outline">Час: {{ formatHourRange(selectedHour) }}</Badge>
          <Badge v-if="selectedCourierId" variant="outline">Курьер: {{ selectedCourierName || selectedCourierId }}</Badge>
          <Badge v-if="selectedStatus" variant="outline">Статус: {{ selectedStatus }}</Badge>
          <Badge v-if="!selectedDepartmentId && selectedHour == null && !selectedCourierId && !selectedStatus" variant="secondary">
            Фильтр не выбран
          </Badge>
        </div>
      </Card>

      <section>
        <h2 class="mb-4 text-lg font-semibold text-foreground">Сводка по опозданиям</h2>
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
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Час</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Опозданий</TableHead>
                  <TableHead class="text-left font-medium">Доля, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="item in report?.hourly || []"
                  :key="item.hour"
                  class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                  :class="selectedHour === item.hour ? 'bg-muted/40' : ''"
                  @click="selectHour(item.hour)"
                >
                  <TableCell class="text-foreground">{{ formatHourRange(item.hour) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.total) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.delayed) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.delayRate) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Курьер</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Опозданий</TableHead>
                  <TableHead class="text-left font-medium">Доля, %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="item in topCouriers"
                  :key="item.courierId"
                  class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                  :class="selectedCourierId === item.courierId ? 'bg-muted/40' : ''"
                  @click="selectCourier(item.courierId, item.courierName)"
                >
                  <TableCell class="text-foreground">{{ item.courierName }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.total) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.delayed) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(item.delayRate) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
                <TableHead class="text-left font-medium">Курьер</TableHead>
                <TableHead class="text-left font-medium">Обещано</TableHead>
                <TableHead class="text-left font-medium">Факт</TableHead>
                <TableHead class="text-left font-medium">Опоздание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="item in topDelayedOrders"
                :key="`${item.orderNumber || item.orderId}-${item.date || ''}`"
                class="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                :class="selectedOrderId === String(item.orderId || item.orderNumber || '') ? 'bg-muted/40' : ''"
                @click="selectOrder(item)"
              >
                <TableCell class="text-foreground">{{ item.date }}</TableCell>
                <TableCell class="text-foreground">{{ item.orderNumber || "Без номера" }}</TableCell>
                <TableCell class="text-foreground">{{ item.courierName }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.promisedMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.actualMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.lateMinutes) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card v-if="selectedOrder" class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Карточка заказа (drill-down)</h3>
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
            <p class="text-xs text-muted-foreground">Курьер</p>
            <p class="font-medium text-foreground">{{ selectedOrder.courierName || "—" }}</p>
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
import { AlertCircle, Clock } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import { reportsApi } from "../api/reports";
import { toast } from "../lib/sonner";
import { formatMinutesToHms } from "../lib/utils";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";

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
const isPageLoading = computed(() => reportsStore.isLoadingDeliveryDelays);
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

const topDelayedOrders = computed(() => filteredDelayedOrders.value.slice(0, 50));
const selectedOrder = computed(() => {
  return filteredDelayedOrders.value.find((item) => String(item.orderId || item.orderNumber || "") === selectedOrderId.value) || null;
});

const topCouriers = computed(() => {
  if (!selectedDepartmentId.value && selectedHour.value == null) {
    return (report.value?.couriers || []).slice(0, 20);
  }

  const couriersMap = new Map();
  for (const item of filteredDelayedOrders.value) {
    const key = String(item.courierId || "unknown");
    if (!couriersMap.has(key)) {
      couriersMap.set(key, {
        courierId: key,
        courierName: item.courierName || "Неизвестный курьер",
        total: 0,
        delayed: 0,
        delayRate: 0,
      });
    }
    const courier = couriersMap.get(key);
    courier.total += 1;
    courier.delayed += 1;
  }

  return [...couriersMap.values()]
    .map((item) => ({
      ...item,
      delayRate: item.total > 0 ? (item.delayed / item.total) * 100 : 0,
    }))
    .slice(0, 20);
});

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
  const result = await reportsStore.loadDeliveryDelays({ organizationId, dateFrom, dateTo });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

function selectHour(hour) {
  selectedHour.value = selectedHour.value === hour ? null : hour;
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

function resetDrilldownFilters() {
  selectedDepartmentId.value = "";
  selectedHour.value = null;
  selectedCourierId.value = "";
  selectedCourierName.value = "";
  selectedOrderId.value = "";
  selectedStatus.value = "";
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
