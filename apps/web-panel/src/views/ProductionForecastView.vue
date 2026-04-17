<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-foreground">Прогноз загрузки производства</h1>
        <span class="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">История + предзаказы</span>
      </div>
      <p class="text-sm text-muted-foreground">Прогноз на: {{ report?.summary?.forecastDate || filtersStore.dateTo || "—" }}</p>
    </div>

    <ReportInfoBlock
      title="О прогнозе загрузки"
      purpose="Показывает ожидаемую нагрузку кухни по часам и подразделениям на выбранную дату."
      meaning="Помогает заранее увидеть часы перегруза и перераспределить смены."
      calculation="База строится по аналогичному дню недели из истории и корректируется подтвержденными предзаказами."
      responsibility="Используется для планирования производства и балансировки нагрузки по подразделениям."
    />

    <Card class="border-border/70 bg-card/95 p-4 md:p-5">
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </Card>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <template v-if="report || isPageLoading">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Прогноз заказов"
          :value="report?.summary?.totalForecastOrders ?? null"
          format="number"
          icon="Factory"
          :loading="isPageLoading"
        />
        <MetricCard
          title="Прогноз выручки"
          :value="report?.summary?.totalForecastRevenue ?? null"
          format="currency"
          icon="TrendingUp"
          :loading="isPageLoading"
        />
        <MetricCard
          title="Подтвержденные предзаказы"
          :value="report?.summary?.confirmedPreorders ?? null"
          format="number"
          icon="CalendarCheck"
          :loading="isPageLoading"
        />
        <MetricCard
          title="Загрузка мощности"
          :value="report?.summary?.loadPercent ?? null"
          format="percent"
          icon="Gauge"
          :inverse="true"
          :loading="isPageLoading"
        />
      </div>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-foreground">Почасовой прогноз</h2>
          <p class="text-xs text-muted-foreground">Часовой пояс: {{ report?.metadata?.timezone || "—" }}</p>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-[920px] border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Час</th>
                <th class="px-3 py-2 text-right font-medium">Историческая база</th>
                <th class="px-3 py-2 text-right font-medium">Предзаказы</th>
                <th class="px-3 py-2 text-right font-medium">Прогноз</th>
                <th class="px-3 py-2 text-right font-medium">Мощность</th>
                <th class="px-3 py-2 text-right font-medium">Загрузка</th>
                <th class="px-3 py-2 text-left font-medium">Индикатор</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report?.hourly || []" :key="item.hour" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ formatHour(item.hour) }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatNumber(item.baseOrders) }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatNumber(item.preorderOrders) }}</td>
                <td class="px-3 py-2 text-right font-semibold text-foreground">{{ formatNumber(item.forecastOrders) }}</td>
                <td class="px-3 py-2 text-right text-muted-foreground">{{ formatNumber(item.capacity) }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatPercent(item.loadPercent) }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                    :class="item.overload ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success-foreground'"
                  >
                    {{ item.overload ? "Перегруз" : "Норма" }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <h2 class="mb-3 text-base font-semibold text-foreground">Индикатор перегруза по подразделениям</h2>
        <div class="overflow-x-auto">
          <table class="min-w-[760px] border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">Подразделение</th>
                <th class="px-3 py-2 text-right font-medium">Прогноз заказов</th>
                <th class="px-3 py-2 text-right font-medium">Мощность</th>
                <th class="px-3 py-2 text-right font-medium">Загрузка</th>
                <th class="px-3 py-2 text-right font-medium">Часы перегруза</th>
                <th class="px-3 py-2 text-left font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="department in report?.departments || []" :key="department.departmentId" class="border-t border-border/50">
                <td class="px-3 py-2 text-foreground">{{ department.departmentName || department.departmentId }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatNumber(department.forecastOrders) }}</td>
                <td class="px-3 py-2 text-right text-muted-foreground">{{ formatNumber(department.capacity) }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatPercent(department.loadPercent) }}</td>
                <td class="px-3 py-2 text-right text-foreground">{{ formatNumber(department.overloadHours) }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                    :class="department.isOverloaded ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success-foreground'"
                  >
                    {{ department.isOverloaded ? "Есть риск" : "Стабильно" }}
                  </span>
                </td>
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
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "@/stores/reports";
import { useFiltersStore } from "@/stores/filters";
import { useRevenueStore } from "@/stores/revenue";
import PageFilters from "@/components/filters/PageFilters.vue";
import Card from "@/components/ui/Card.vue";
import MetricCard from "@/components/metrics/MetricCard.vue";
import ReportInfoBlock from "@/components/reports/ReportInfoBlock.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.productionForecast);
const isPageLoading = computed(() => reportsStore.isLoadingProductionForecast);
const pageError = computed(() => reportsStore.error);

const formatNumber = (value) => Number(value || 0).toLocaleString("ru-RU");
const formatPercent = (value) => `${Number(value || 0).toLocaleString("ru-RU")} %`;
const formatHour = (hour) => `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) {
    return;
  }

  revenueStore.setCurrentOrganization(organizationId);
  await reportsStore.loadProductionForecast({
    organizationId,
    dateFrom,
    dateTo,
    forecastDate: dateTo,
  });
}

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (!report.value) {
    await handleApply();
  }
});
</script>

