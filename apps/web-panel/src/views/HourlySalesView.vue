<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Продажи по часам"
        description="Почасовой срез заказов и выручки для оценки пиков загрузки."
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
      <PageFilters :loading="isPageLoading" :show-completed-only="false" @apply="handleApply" />
    </div>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="!isPageLoading && !hourlyReport && !pageError" class="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-if="hourlyReport || isPageLoading">
      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div v-if="availableDays.length > 1" class="mb-3 flex flex-wrap gap-2">
          <Button
            v-for="day in availableDays"
            :key="day.date"
            type="button"
            size="sm"
            :variant="selectedDayDate === day.date ? 'default' : 'outline'"
            @click="selectedDayDate = day.date"
          >
            {{ formatDateShort(day.date) }}
          </Button>
        </div>
        <div v-else-if="selectedDay" class="mb-3 text-sm text-muted-foreground">
          {{ formatDate(selectedDay.date) }}
        </div>

        <WeekdayAverageChart :rows="selectedDayHours" :loading="isPageLoading" />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle, BarChart2 } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import Button from "../components/ui/Button.vue";
import WeekdayAverageChart from "../components/charts/WeekdayAverageChart.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();
const route = useRoute();

const lastLoadedAt = ref(null);
const selectedDayDate = ref("");

const hourlyReport = computed(() => reportsStore.hourlySales);
const isPageLoading = computed(() => reportsStore.isLoadingHourlySales);
const pageError = computed(() => reportsStore.error);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }

  const organization = revenueStore.organizations.find((org) => org.id === revenueStore.currentOrganizationId);
  return organization ? organization.name : "Выбранное подразделение";
});

const dailyRows = computed(() => hourlyReport.value?.daily || []);
const availableDays = computed(() => [...dailyRows.value].sort((left, right) => left.date.localeCompare(right.date)));
const selectedDay = computed(() => availableDays.value.find((day) => day.date === selectedDayDate.value) || availableDays.value[0] || null);
const selectedDayHours = computed(() => (Array.isArray(selectedDay.value?.hours) ? selectedDay.value.hours : []));

watch(
  availableDays,
  (days) => {
    if (!days.length) {
      selectedDayDate.value = "";
      return;
    }
    const exists = days.some((day) => day.date === selectedDayDate.value);
    if (!exists) {
      selectedDayDate.value = days[days.length - 1].date;
    }
  },
  { immediate: true },
);

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateShort(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  const completedOnly = payload.completedOnly ?? filtersStore.completedOnly;

  if (!organizationId || !dateFrom || !dateTo) {
    return;
  }

  revenueStore.setCurrentOrganization(organizationId);
  const result = await reportsStore.loadHourlySales({ organizationId, dateFrom, dateTo, completedOnly });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }

  if (!hourlyReport.value) {
    await handleApply();
  }
});
</script>
