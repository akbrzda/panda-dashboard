<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-foreground">Карта курьеров и заказов</h1>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="inline-flex h-2 w-2 rounded-full bg-success" />
          <span>Polling: каждые 30 секунд</span>
        </div>
      </div>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О карте курьеров"
      purpose="Оперативный экран для контроля активных курьеров и заказов в доставке."
      meaning="Показывает активность курьеров и текущую нагрузку в режиме регулярного обновления."
      calculation="Данные обновляются polling-ом каждые 30 секунд; исключены отмененные и удаленные заказы."
      responsibility="Используется диспетчером и старшим смены для оперативного управления доставкой."
    />
    <p v-if="report?.timezone" class="text-xs text-muted-foreground">Часовой пояс отчета: {{ report.timezone }}</p>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Курьеров" :value="report?.summary?.totalCouriers ?? null" format="number" icon="Users" :loading="isPageLoading" />
          <MetricCard
            title="Активных курьеров"
            :value="report?.summary?.activeCouriers ?? null"
            format="number"
            icon="Truck"
            :loading="isPageLoading"
          />
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard title="Заказов в пути" :value="report?.summary?.activeOrders ?? null" format="number" icon="Clock" :loading="isPageLoading" />
        </div>
      </section>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-foreground">Оперативная карта (контуры зон)</h3>
          <span class="text-xs text-muted-foreground">Обновлено: {{ formatDateTime(report?.generatedAt) }}</span>
        </div>

        <div class="relative h-[420px] overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-muted/30 via-background to-muted/20">
          <div
            class="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]"
          />

          <div
            v-for="courier in report?.couriers || []"
            :key="`courier-${courier.courierId}`"
            class="group absolute -translate-x-1/2 -translate-y-1/2"
            :style="{ left: `${courier.x}%`, top: `${courier.y}%` }"
          >
            <div class="h-3 w-3 rounded-full border border-white" :class="courier.isActive ? 'bg-success' : 'bg-muted-foreground'" />
            <div
              class="pointer-events-none absolute left-3 top-1/2 hidden min-w-[180px] -translate-y-1/2 rounded-md border border-border bg-card p-2 text-xs shadow-lg group-hover:block"
            >
              <div class="font-semibold text-foreground">{{ courier.courierName }}</div>
              <div class="text-muted-foreground">Заказов: {{ courier.orders }}</div>
              <div class="text-muted-foreground">Выручка: {{ formatCurrency(courier.revenue) }}</div>
            </div>
          </div>

          <div
            v-for="order in report?.orders || []"
            :key="`order-${order.orderId}`"
            class="absolute -translate-x-1/2 -translate-y-1/2"
            :style="{ left: `${order.x}%`, top: `${order.y}%` }"
          >
            <div
              class="h-2 w-2 rounded-full"
              :class="order.status === 'В пути' ? 'bg-primary' : order.status === 'Доставлен' ? 'bg-success' : 'bg-warning'"
            />
          </div>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h3 class="mb-3 text-sm font-semibold text-foreground">Список курьеров</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Курьер</th>
                <th class="px-3 py-2 text-left font-medium">Активность</th>
                <th class="px-3 py-2 text-left font-medium">Заказов</th>
                <th class="px-3 py-2 text-left font-medium">Выручка</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="courier in report?.couriers || []" :key="courier.courierId" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ courier.courierName }}</td>
                <td class="px-3 py-2">
                  <span
                    class="rounded-full px-2 py-1 text-xs font-semibold"
                    :class="courier.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'"
                  >
                    {{ courier.isActive ? "Активен" : "Неактивен" }}
                  </span>
                </td>
                <td class="px-3 py-2 text-foreground">{{ courier.orders }}</td>
                <td class="px-3 py-2 text-foreground">{{ formatCurrency(courier.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import ReportInfoBlock from "../components/reports/ReportInfoBlock.vue";
import { formatTimeHms } from "../lib/utils";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

let pollTimer = null;

const report = computed(() => reportsStore.courierMapReport);
const isPageLoading = computed(() => reportsStore.isLoadingCourierMap);
const pageError = computed(() => reportsStore.error);

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";
  return formatTimeHms(value);
}

async function loadReport() {
  const organizationId = revenueStore.currentOrganizationId;
  const dateFrom = filtersStore.dateFrom;
  const dateTo = filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  await reportsStore.loadCourierMap({ organizationId, dateFrom, dateTo });
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  await reportsStore.loadCourierMap({ organizationId, dateFrom, dateTo });
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    loadReport();
  }, 30000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }
  if (!report.value) {
    await loadReport();
  }
  startPolling();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>
