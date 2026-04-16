<template>
  <div class="space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-foreground">Дашборд</h1>
        <span v-if="data" class="text-xs text-muted-foreground">
          {{ formatDate(data.date) }}
        </span>
      </div>
      <DashboardFilters ref="filtersRef" :loading="analyticsStore.isLoadingDashboard" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span>{{ error }}</span>
      <button @click="reload" class="ml-auto text-xs underline hover:no-underline">Повторить</button>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!analyticsStore.isLoadingDashboard && !data && !error" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Загрузка данных...</p>
    </div>

    <template v-if="data || analyticsStore.isLoadingDashboard">
      <!-- KPI строка -->
      <section>
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Сводные показатели</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Выручка"
            :value="data?.summary.totalRevenue ?? null"
            format="currency"
            icon="TrendingUp"
            :loading="analyticsStore.isLoadingDashboard"
          />
          <MetricCard
            title="Заказов"
            :value="data?.summary.totalOrders ?? null"
            format="number"
            icon="ShoppingCart"
            :loading="analyticsStore.isLoadingDashboard"
          />
          <MetricCard
            title="Средний чек"
            :value="data?.summary.avgPerOrder ?? null"
            format="currency"
            icon="BarChart2"
            :loading="analyticsStore.isLoadingDashboard"
          />
          <MetricCard
            title="Дисконт"
            :value="data?.summary.discountSum ?? null"
            format="currency"
            icon="Tag"
            :inverse="true"
            :loading="analyticsStore.isLoadingDashboard"
          />
        </div>
      </section>

      <!-- Заказы по каналам -->
      <section v-if="hasChannels || analyticsStore.isLoadingDashboard">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Заказы по каналам</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <template v-if="analyticsStore.isLoadingDashboard">
            <MetricCard v-for="i in 4" :key="i" title="" :value="null" format="number" :loading="true" />
          </template>
          <template v-else>
            <Card v-for="(ch, name) in data.revenueByChannel" :key="name" class="p-4">
              <p class="text-xs text-muted-foreground mb-1 truncate">{{ name }}</p>
              <p class="text-lg font-semibold text-foreground tabular-nums">{{ formatNumber(ch.orders) }}</p>
              <p class="text-xs text-muted-foreground mt-1">{{ formatCurrency(ch.revenue) }}</p>
            </Card>
          </template>
        </div>
      </section>

      <!-- Графики: структура + почасовые -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card class="p-5">
          <h3 class="text-sm font-semibold text-foreground mb-4">Выручка по каналам</h3>
          <DonutChart :channels="data?.revenueByChannel ?? {}" :loading="analyticsStore.isLoadingDashboard" />
        </Card>

        <Card class="p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-foreground">Продажи по часам</h3>
            <div class="flex gap-1">
              <button
                @click="hourlyMode = 'revenue'"
                :class="[
                  'text-xs px-2 py-1 rounded transition-colors',
                  hourlyMode === 'revenue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                ]"
              >
                Выручка
              </button>
              <button
                @click="hourlyMode = 'orders'"
                :class="[
                  'text-xs px-2 py-1 rounded transition-colors',
                  hourlyMode === 'orders' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                ]"
              >
                Заказы
              </button>
            </div>
          </div>
          <HourlyBarChart :hours="data?.hourly ?? []" :loading="analyticsStore.isLoadingDashboard" :mode="hourlyMode" />
        </Card>
      </div>

      <!-- По подразделениям (только если несколько) -->
      <Card v-if="showOrgChart" class="p-5">
        <h3 class="text-sm font-semibold text-foreground mb-4">Выручка по подразделениям</h3>
        <OrgBarChart :orgs="data?.byOrganization ?? []" :loading="analyticsStore.isLoadingDashboard" />
      </Card>

      <!-- Топ блюд и аутсайдеры -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Топ-10 -->
        <Card class="p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-foreground">Топ блюд</h3>
            <router-link to="/top-dishes" class="text-xs text-primary hover:underline no-underline">Все →</router-link>
          </div>
          <div v-if="analyticsStore.isLoadingDashboard" class="space-y-2">
            <div v-for="i in 5" :key="i" class="h-8 rounded bg-muted animate-pulse" />
          </div>
          <div v-else-if="!data?.topDishes?.length" class="text-sm text-muted-foreground py-4 text-center">Нет данных</div>
          <div v-else class="space-y-1">
            <div
              v-for="(dish, idx) in data.topDishes.slice(0, 10)"
              :key="dish.name"
              class="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
            >
              <span class="text-xs text-muted-foreground w-5 shrink-0">{{ idx + 1 }}</span>
              <span class="text-sm text-foreground flex-1 min-w-0 truncate">{{ dish.name }}</span>
              <span class="text-xs text-muted-foreground shrink-0">{{ formatNumber(dish.qty) }} шт.</span>
              <span class="text-xs font-medium text-foreground shrink-0 tabular-nums">{{ formatCurrency(dish.revenue) }}</span>
            </div>
          </div>
        </Card>

        <!-- Аутсайдеры -->
        <Card class="p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-foreground">Аутсайдеры</h3>
            <router-link to="/top-dishes" class="text-xs text-primary hover:underline no-underline">Все →</router-link>
          </div>
          <div v-if="analyticsStore.isLoadingDashboard" class="space-y-2">
            <div v-for="i in 5" :key="i" class="h-8 rounded bg-muted animate-pulse" />
          </div>
          <div v-else-if="!data?.outsiders?.length" class="text-sm text-muted-foreground py-4 text-center">Нет данных</div>
          <div v-else class="space-y-1">
            <div
              v-for="(dish, idx) in data.outsiders.slice(0, 10)"
              :key="dish.name"
              class="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
            >
              <span class="text-xs text-muted-foreground w-5 shrink-0">{{ idx + 1 }}</span>
              <span class="text-sm text-foreground flex-1 min-w-0 truncate">{{ dish.name }}</span>
              <span class="text-xs text-muted-foreground shrink-0">{{ formatNumber(dish.qty) }} шт.</span>
              <span class="text-xs font-medium text-foreground shrink-0 tabular-nums">{{ formatCurrency(dish.revenue) }}</span>
            </div>
          </div>
        </Card>
      </div>

      <!-- Навигация -->
      <section>
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Разделы</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <router-link v-for="link in sections" :key="link.to" :to="link.to" class="no-underline group">
            <Card class="p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <component :is="link.icon" class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-foreground text-sm">{{ link.title }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ link.desc }}</p>
                </div>
                <ArrowRight class="w-4 h-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { AlertCircle, BarChart2, ArrowRight, TrendingUp, ShoppingCart, ClipboardList, UtensilsCrossed, Users, Tag, Percent } from "lucide-vue-next";
import MetricCard from "@/components/metrics/MetricCard.vue";
import DashboardFilters from "@/components/filters/DashboardFilters.vue";
import Card from "@/components/ui/Card.vue";
import DonutChart from "@/components/charts/DonutChart.vue";
import HourlyBarChart from "@/components/charts/HourlyBarChart.vue";
import OrgBarChart from "@/components/charts/OrgBarChart.vue";
import { useRevenueStore } from "@/stores/revenue";
import { useAnalyticsStore } from "@/stores/analytics";

const revenueStore = useRevenueStore();
const analyticsStore = useAnalyticsStore();

const filtersRef = ref(null);
const hourlyMode = ref("revenue");
const error = ref(null);

const data = computed(() => analyticsStore.dashboardData);
const hasChannels = computed(() => Object.keys(data.value?.revenueByChannel ?? {}).length > 0);
const showOrgChart = computed(() => (data.value?.byOrganization?.length ?? 0) > 1);

const sections = [
  { to: "/revenue", title: "Отчёт по выручке", desc: "Детальная аналитика по каналам и периодам", icon: BarChart2 },
  { to: "/stop-list", title: "Стоп-лист", desc: "Управление стоп-листами ресторанов", icon: ClipboardList },
  { to: "/top-dishes", title: "Топ блюд", desc: "Рейтинг продаж по позициям меню", icon: UtensilsCrossed },
  { to: "/clients", title: "Клиенты", desc: "Активная база и новые клиенты", icon: Users },
  { to: "/foodcost", title: "Фудкост", desc: "Себестоимость и риск по категориям", icon: Percent },
];

async function handleApply({ date, organizationIds }) {
  error.value = null;
  try {
    await analyticsStore.loadDashboard({ organizationIds, date });
  } catch (e) {
    error.value = e.message || "Ошибка загрузки дашборда";
  }
}

function reload() {
  filtersRef.value?.apply();
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}.${m}.${y}`;
}

function formatCurrency(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(val);
}

onMounted(async () => {
  // Загрузить список организаций если пустой
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }
  // Автозагрузка — сегодня + все подразделения
  if (!data.value) {
    filtersRef.value?.apply();
  }
});
</script>
