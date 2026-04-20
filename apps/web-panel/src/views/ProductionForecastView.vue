<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Прогноз загрузки производства"
        description="Прогноз заказов и нагрузки по часам на выбранную дату."
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
          <Badge variant="secondary">История + предзаказы</Badge>
        </template>
      </ReportPageHeader>
      <div class="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-card/95 p-4">
        <div class="flex flex-col gap-1.5">
          <Label html-for="forecast-org" class="text-xs text-muted-foreground">Подразделение</Label>
          <Select id="forecast-org" v-model="selectedOrganizationId" class="min-w-[220px]" @update:model-value="handleApply()">
            <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </SelectItem>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Дата прогноза</Label>
          <DatePicker v-model="forecastDate" @update:model-value="handleApply()" />
        </div>
      </div>
    </div>

    <ReportInfoBlock
      title="О прогнозе загрузки"
      purpose="Показывает ожидаемую нагрузку кухни по часам и подразделениям на выбранную дату."
      meaning="Помогает заранее увидеть часы перегруза и перераспределить смены."
      calculation="База строится по аналогичному дню недели из истории и корректируется подтвержденными предзаказами."
      responsibility="Используется для планирования производства и балансировки нагрузки по подразделениям."
    />

    <div v-if="pageError" role="alert" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
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
        <div class="table-shell">
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
              <TableRow v-for="item in hourlyPagination.pageItems" :key="item.hour" class="border-t border-border/50">
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
                    {{ item.overload ? "Перегруз" : "Норма" }}
                  </span>
                </TableCell>
              </TableRow>
              <TableRow v-if="hourlyPagination.totalItems === 0" class="border-t border-border/50">
                <TableCell colspan="7" class="text-center text-muted-foreground">Нет данных по часам за выбранную дату</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div class="px-4 pb-4">
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
      </Card>

      <Card class="border-border/70 bg-card/95 p-0">
        <div class="table-shell">
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
              <TableRow v-for="department in departmentsPagination.pageItems" :key="department.departmentId" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ formatDepartmentName(department) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(department.forecastOrders) }}</TableCell>
                <TableCell class="text-right text-muted-foreground">{{ formatNumber(department.capacity) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatPercent(department.loadPercent) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatNumber(department.overloadHours) }}</TableCell>
                <TableCell class="">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                    :class="department.isOverloaded ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success-foreground'"
                  >
                    {{ department.isOverloaded ? "Есть риск" : "Стабильно" }}
                  </span>
                </TableCell>
              </TableRow>
              <TableRow v-if="departmentsPagination.totalItems === 0" class="border-t border-border/50">
                <TableCell colspan="6" class="text-center text-muted-foreground">Нет данных по подразделениям</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div class="px-4 pb-4">
          <PaginationControls
            v-if="departmentsPagination.totalItems > 0"
            :current-page="departmentsPagination.currentPage"
            :total-pages="departmentsPagination.totalPages"
            :total-items="departmentsPagination.totalItems"
            :range-start="departmentsPagination.rangeStart"
            :range-end="departmentsPagination.rangeEnd"
            :loading="isPageLoading"
            @prev="departmentsPagination.prevPage"
            @next="departmentsPagination.nextPage"
          />
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "@/stores/reports";
import { useRevenueStore } from "@/stores/revenue";
import Card from "@/components/ui/Card.vue";
import MetricCard from "@/components/metrics/MetricCard.vue";
import Badge from "@/components/ui/Badge.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import ReportInfoBlock from "@/components/reports/ReportInfoBlock.vue";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import Label from "@/components/ui/Label.vue";
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
const revenueStore = useRevenueStore();
const route = useRoute();

const report = computed(() => reportsStore.productionForecast);
const isPageLoading = computed(() => reportsStore.isLoadingProductionForecast);
const pageError = computed(() => reportsStore.error);
const forecastDate = ref("");
const selectedOrganizationId = ref("");
const lastLoadedAt = ref(null);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!selectedOrganizationId.value) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const organization = revenueStore.organizations.find((org) => String(org.id) === String(selectedOrganizationId.value));
  return organization?.name || "Выбранное подразделение";
});

const formatNumber = (value) => Number(value || 0).toLocaleString("ru-RU");
const formatPercent = (value) => `${Number(value || 0).toLocaleString("ru-RU")} %`;
const formatHour = (hour) => `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;
const hourlyRows = computed(() => report.value?.hourly || []);
const departmentRows = computed(() => report.value?.departments || []);
const hourlyPagination = usePagination(hourlyRows, { pageSize: 12 });
const departmentsPagination = usePagination(departmentRows, { pageSize: 12 });

function getTomorrowDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name || /^(unknown|неизвестно|null|undefined|-|n\/a)$/i.test(name)) {
    return "";
  }
  return name;
}

function formatDepartmentName(department = {}) {
  const preferred = normalizeName(department.departmentName);
  if (preferred) return preferred;
  const fallbackId = String(department.departmentId || "").trim();
  return fallbackId && fallbackId !== "unknown" ? `Подразделение ${fallbackId}` : "Подразделение без названия";
}

async function handleApply() {
  const organizationId = selectedOrganizationId.value || revenueStore.currentOrganizationId;
  const normalizedForecastDate = String(forecastDate.value || "").slice(0, 10) || getTomorrowDate();

  if (!organizationId || !normalizedForecastDate) {
    return;
  }

  forecastDate.value = normalizedForecastDate;
  selectedOrganizationId.value = organizationId;
  revenueStore.setCurrentOrganization(organizationId);
  const result = await reportsStore.loadProductionForecast({
    organizationId,
    forecastDate: normalizedForecastDate,
  });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (!selectedOrganizationId.value) {
    selectedOrganizationId.value = revenueStore.currentOrganizationId || revenueStore.organizations[0]?.id || "";
  }
  if (!forecastDate.value) {
    forecastDate.value = getTomorrowDate();
  }
  if (selectedOrganizationId.value) {
    await handleApply();
  }
});
</script>
