<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-foreground">Прогноз загрузки производства</h1>
        <Badge variant="secondary">История + предзаказы</Badge>
      </div>
      <PageFilters :loading="isPageLoading" @apply="handleApply" />
    </div>

    <ReportInfoBlock
      title="О прогнозе загрузки"
      purpose="Показывает ожидаемую нагрузку кухни по часам и подразделениям на выбранную дату."
      meaning="Помогает заранее увидеть часы перегруза и перераспределить смены."
      calculation="База строится по аналогичному дню недели из истории и корректируется подтвержденными предзаказами."
      responsibility="Используется для планирования производства и балансировки нагрузки по подразделениям."
    />

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

      <Card class="border-border/70 bg-card/95 p-0">
        <div class="overflow-x-auto">
          <Table class="min-w-[920px] border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Час</TableHead>
                <TableHead class="text-right font-medium">Историческая база</TableHead>
                <TableHead class="text-right font-medium">Предзаказы</TableHead>
                <TableHead class="text-right font-medium">Прогноз</TableHead>
                <TableHead class="text-right font-medium">Мощность</TableHead>
                <TableHead class="text-right font-medium">Загрузка</TableHead>
                <TableHead class="text-left font-medium">Индикатор</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in report?.hourly || []" :key="item.hour" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ formatHour(item.hour) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(item.baseOrders) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(item.preorderOrders) }}</TableCell>
                <TableCell class="text-right font-semibold text-foreground">{{ formatNumber(item.forecastOrders) }}</TableCell>
                <TableCell class="text-right text-muted-foreground">{{ formatNumber(item.capacity) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatPercent(item.loadPercent) }}</TableCell>
                <TableCell class="">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                    :class="item.overload ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success-foreground'"
                  >
                    {{ item.overload ?"Перегруз" :"Норма" }}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-0">
        <div class="overflow-x-auto">
          <Table class="min-w-[760px] border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Подразделение</TableHead>
                <TableHead class="text-right font-medium">Прогноз заказов</TableHead>
                <TableHead class="text-right font-medium">Мощность</TableHead>
                <TableHead class="text-right font-medium">Загрузка</TableHead>
                <TableHead class="text-right font-medium">Часы перегруза</TableHead>
                <TableHead class="text-left font-medium">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="department in report?.departments || []" :key="department.departmentId" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ department.departmentName || department.departmentId }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(department.forecastOrders) }}</TableCell>
                <TableCell class="text-right text-muted-foreground">{{ formatNumber(department.capacity) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatPercent(department.loadPercent) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(department.overloadHours) }}</TableCell>
                <TableCell class="">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                    :class="department.isOverloaded ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success-foreground'"
                  >
                    {{ department.isOverloaded ?"Есть риск" :"Стабильно" }}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from"vue";
import { AlertCircle } from"lucide-vue-next";
import { useReportsStore } from"@/stores/reports";
import { useFiltersStore } from"@/stores/filters";
import { useRevenueStore } from"@/stores/revenue";
import PageFilters from"@/components/filters/PageFilters.vue";
import Card from"@/components/ui/Card.vue";
import MetricCard from"@/components/metrics/MetricCard.vue";
import Badge from"@/components/ui/Badge.vue";
import ReportInfoBlock from"@/components/reports/ReportInfoBlock.vue";

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const report = computed(() => reportsStore.productionForecast);
const isPageLoading = computed(() => reportsStore.isLoadingProductionForecast);
const pageError = computed(() => reportsStore.error);

const formatNumber = (value) => Number(value || 0).toLocaleString("ru-RU");
const formatPercent = (value) => `${Number(value || 0).toLocaleString("ru-RU")} %`;
const formatHour = (hour) => `${String(hour).padStart(2,"0")}:00-${String((hour + 1) % 24).padStart(2,"0")}:00`;

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
