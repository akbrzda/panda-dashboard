<template>
  <div class="space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Отчёт по выручке</h1>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!isPageLoading && !store.hasData && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="store.hasData || isPageLoading">
      <!-- Период -->
      <p v-if="store.formattedPeriod && !isPageLoading" class="text-xs text-muted-foreground">
        Период: <span class="font-medium text-foreground">{{ store.formattedPeriod }}</span>
      </p>

      <!-- Сводные KPI -->
      <section>
        <h2 class="text-lg font-semibold text-foreground mb-4">Сводные показатели</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Общая выручка"
            :value="store.summary?.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :lfl="store.summary?.lfl != null ? { percent: store.summary.lfl } : null"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Заказов"
            :value="store.summary?.totalOrders ?? null"
            format="number"
            icon="ShoppingCart"
            :lfl="reportsStore.revenueData?.summary?.ordersLFL != null ? { percent: reportsStore.revenueData.summary.ordersLFL } : null"
            :loading="isPageLoading"
          />
          <MetricCard title="Средний чек" :value="store.summary?.avgPerOrder ?? null" format="currency" icon="BarChart2" :loading="isPageLoading" />
          <MetricCard
            title="Время доставки"
            :value="store.summary?.avgDeliveryTime ?? null"
            format="time"
            icon="Clock"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Дисконт"
            :value="store.summary?.discountSum ?? null"
            format="currency"
            icon="Tag"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="% дисконта"
            :value="store.summary?.discountPercent ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
        </div>
      </section>

      <!-- Выручка по каналам -->
      <section>
        <h2 class="text-lg font-semibold text-foreground mb-4">Выручка по каналам</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            v-for="(ch, name) in store.revenueByChannel"
            :key="name"
            :title="name"
            :value="ch.revenue"
            format="currency"
            :lfl="
              reportsStore.revenueData?.revenueByChannel?.[name]?.revenueLFL != null
                ? { percent: reportsStore.revenueData.revenueByChannel[name].revenueLFL }
                : null
            "
            :loading="isPageLoading"
          />
        </div>
      </section>

      <!-- Графики -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Динамика выручки -->
        <Card class="p-5">
          <h3 class="text-sm font-semibold text-foreground mb-4">Динамика выручки по дням</h3>
          <AreaChart :breakdown="store.dailyBreakdown" :loading="isPageLoading" />
        </Card>

        <!-- Структура по каналам -->
        <Card class="p-5">
          <h3 class="text-sm font-semibold text-foreground mb-4">Структура выручки</h3>
          <DonutChart :channels="store.revenueByChannel" :loading="isPageLoading" />
        </Card>
      </div>

      <!-- Маршруты курьеров -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card class="p-5">
          <h3 class="text-sm font-semibold text-foreground mb-1">Маршруты курьеров</h3>
          <p class="text-xs text-muted-foreground mb-4">Распределение по кол-ву заказов на курьера</p>
          <div v-if="reportsStore.isLoadingCourier" class="flex items-center justify-center h-48">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!reportsStore.courierRoutes" class="flex items-center justify-center h-48 text-sm text-muted-foreground">Нет данных</div>
          <div v-else class="space-y-3">
            <div
              v-for="item in courierStats"
              :key="item.label"
              class="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <div>
                <div class="text-sm font-medium text-foreground">{{ item.label }}</div>
                <div class="text-xs text-muted-foreground">{{ item.count }} курьеров</div>
              </div>
              <div class="text-lg font-semibold text-foreground">{{ item.percent }}%</div>
            </div>
            <div class="pt-1 text-xs text-muted-foreground text-center">
              Всего курьеров: <span class="font-medium text-foreground">{{ reportsStore.courierRoutes.totalCouriers }}</span>
            </div>
          </div>
        </Card>
      </div>

      <!-- Таблица -->
      <RevenueTable :revenueByChannel="store.revenueByChannel" :isLoading="store.isLoading" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { AlertCircle, BarChart2 } from "lucide-vue-next";
import { useRevenueStore } from "../stores/revenue";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import PageFilters from "../components/filters/PageFilters.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Card from "../components/ui/Card.vue";
import RevenueTable from "../components/RevenueTable.vue";
import AreaChart from "../components/charts/AreaChart.vue";
import DonutChart from "../components/charts/DonutChart.vue";

const store = useRevenueStore();
const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();

const courierStats = computed(() => reportsStore.courierRoutes?.distribution || []);
const isPageLoading = computed(() => store.isLoading || reportsStore.isLoadingRevenue || reportsStore.isLoadingCourier);
const pageError = computed(() => reportsStore.error || store.error);

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? store.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const lflDateFrom = payload.lflDateFrom ?? filtersStore.lflDateFrom;
  const lflDateTo = payload.lflDateTo ?? filtersStore.lflDateTo;

  store.setCurrentOrganization(organizationId);
  store.startDate = dateFrom;
  store.endDate = dateTo;

  await reportsStore.loadRevenue({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });

  if (reportsStore.revenueData) {
    store.revenueData = reportsStore.revenueData;
  }

  await reportsStore.loadCourierRoutes({ organizationId, dateFrom, dateTo });
}

onMounted(() => {
  if (store.organizations.length === 0) {
    store.loadOrganizations();
  } else if (!store.hasData) {
    handleApply();
  }
});
</script>
