<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-foreground">Опоздания доставок</h1>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isExportLoading || isPageLoading"
          @click="handleExport"
        >
          {{ isExportLoading ? "Подготовка файла..." : "Выгрузить в Excel" }}
        </button>
      </div>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О отчете опозданий"
      purpose="Отчет показывает опоздания только по курьерской доставке (orderServiceType == DELIVERY_BY_COURIER)."
      meaning="Самовывоз и заказы в зал не учитываются."
      calculation="Опоздание считается строго по формуле: Δ(Delivery.ExpectedTime, Delivery.ActualTime). Если фактическое время позже расчетного, заказ считается опоздавшим."
      responsibility="Используется для контроля SLA доставки и анализа причин опозданий по курьерам и времени суток."
    />
    <p v-if="report?.timezone" class="text-xs text-muted-foreground">Часовой пояс отчета: {{ report.timezone }}</p>

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
          <h3 class="mb-3 text-sm font-semibold text-foreground">Опоздания по часам</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Час</th>
                  <th class="px-3 py-2 text-left font-medium">Заказов</th>
                  <th class="px-3 py-2 text-left font-medium">Опозданий</th>
                  <th class="px-3 py-2 text-left font-medium">Доля, %</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report?.hourly || []" :key="item.hour" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ formatHourRange(item.hour) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.total) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.delayed) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.delayRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card class="border-border/70 bg-card/95 p-4 md:p-5">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Курьеры с риском</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/30 text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">Курьер</th>
                  <th class="px-3 py-2 text-left font-medium">Заказов</th>
                  <th class="px-3 py-2 text-left font-medium">Опозданий</th>
                  <th class="px-3 py-2 text-left font-medium">Доля, %</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in topCouriers" :key="item.courierId" class="border-t border-border/50">
                  <td class="px-3 py-2 text-foreground">{{ item.courierName }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.total) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.delayed) }}</td>
                  <td class="px-3 py-2 text-foreground">{{ formatNumber(item.delayRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Топ заказов с опозданием</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Дата</th>
                <th class="px-3 py-2 text-left font-medium">Заказ</th>
                <th class="px-3 py-2 text-left font-medium">Курьер</th>
                <th class="px-3 py-2 text-left font-medium">Обещано</th>
                <th class="px-3 py-2 text-left font-medium">Факт</th>
                <th class="px-3 py-2 text-left font-medium">Опоздание</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in topDelayedOrders" :key="item.orderId" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ item.date }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.orderNumber || "Без номера" }}</td>
                <td class="px-3 py-2 text-foreground">{{ item.courierName }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(item.promisedMinutes) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(item.actualMinutes) }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatDuration(item.lateMinutes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { AlertCircle, Clock } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import { reportsApi } from "../api/reports";
import { toast } from "../lib/sonner";
import { formatMinutesToHms } from "../lib/utils";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.deliveryDelaysReport);
const isPageLoading = computed(() => reportsStore.isLoadingDeliveryDelays);
const pageError = computed(() => reportsStore.error);
const isExportLoading = ref(false);

const topCouriers = computed(() => (report.value?.couriers || []).slice(0, 20));
const topDelayedOrders = computed(() => (report.value?.delayedOrders || []).slice(0, 50));

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
  await reportsStore.loadDeliveryDelays({ organizationId, dateFrom, dateTo });
}

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
