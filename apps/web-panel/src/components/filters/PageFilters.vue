<template>
  <div class="flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card/95 p-4">
    <!-- Выбор организации -->
    <div v-if="showOrganization" class="flex w-full flex-col gap-1.5 sm:w-[280px]">
      <label class="text-xs font-medium text-muted-foreground">Организация</label>
      <Select v-model="organizationSelection" :disabled="revenueStore.organizations.length === 0" placeholder="Выберите подразделение">
        <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </SelectItem>
      </Select>
    </div>

    <!-- Выбор периода -->
    <div class="flex w-full flex-col gap-1.5 sm:w-[280px]">
      <label class="text-xs font-medium text-muted-foreground">
        {{ mode === "date" ? "Дата" : "Период" }}
      </label>
      <DatePicker v-if="mode === 'date'" v-model="localDate" placeholder="Выберите дату" />
      <PeriodSelector v-else />
    </div>

    <!-- Индикатор загрузки -->
    <div class="ml-auto flex min-h-[36px] min-w-[220px] flex-col items-end justify-end gap-1.5">
      <div v-if="loading" class="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw class="h-3.5 w-3.5 animate-spin" />
        <span>Обновление...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { RefreshCw } from "lucide-vue-next";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import PeriodSelector from "@/components/filters/PeriodSelector.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import { useRevenueStore } from "@/stores/revenue";
import { useFiltersStore } from "@/stores/filters";
import { PERIOD_PRESETS } from "@/composables/usePeriod";
import { buildDateFilterQuery, buildRangeFilterQuery, parseDateFilterQuery, parseRangeFilterQuery } from "@/composables/filterQuery";

const props = defineProps({
  loading: { type: Boolean, default: false },
  requireOrganization: { type: Boolean, default: true },
  showOrganization: { type: Boolean, default: true },
  includeLfl: { type: Boolean, default: false },
  showLflHint: { type: Boolean, default: false },
  autoApply: { type: Boolean, default: true },
  mode: {
    type: String,
    default: "range",
    validator: (value) => ["range", "date"].includes(value),
  },
});

const emit = defineEmits(["apply"]);

const revenueStore = useRevenueStore();
const filtersStore = useFiltersStore();
const route = useRoute();
const router = useRouter();

let applyTimer = null;
let isSyncingQuery = false;
const localDate = computed({
  get: () => filtersStore.dateFrom,
  set: (value) => {
    if (!value) return;
    filtersStore.setDateRange(value, value);
  },
});

const currentOrgId = computed({
  get: () => revenueStore.currentOrganizationId,
  set: (val) => {
    revenueStore.currentOrganizationId = val;
    filtersStore.setOrganization(val);
  },
});

const organizationSelection = computed({
  get: () => currentOrgId.value,
  set: (val) => {
    currentOrgId.value = val || null;
  },
});

const canApply = computed(() => {
  if (props.mode === "date") {
    return Boolean(localDate.value);
  }

  if (props.requireOrganization && !revenueStore.currentOrganizationId) return false;
  return Boolean(filtersStore.dateFrom && filtersStore.dateTo);
});

function buildPayload() {
  if (props.mode === "date") {
    const organizationIds = organizationSelection.value ? [organizationSelection.value] : [];

    return {
      date: localDate.value,
      organizationIds,
      organizationId: organizationSelection.value || null,
    };
  }

  const payload = {
    organizationId: revenueStore.currentOrganizationId,
    dateFrom: filtersStore.dateFrom,
    dateTo: filtersStore.dateTo,
  };

  if (props.includeLfl) {
    payload.lflDateFrom = filtersStore.lflDateFrom;
    payload.lflDateTo = filtersStore.lflDateTo;
  }

  return payload;
}

function emitApply() {
  if (!canApply.value) return;
  emit("apply", buildPayload());
}

function scheduleApply() {
  if (!props.autoApply) return;
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    emitApply();
    applyTimer = null;
  }, 180);
}

const validPresetValues = new Set(PERIOD_PRESETS.map((preset) => preset.value));

function applyQueryToFilters(query) {
  if (props.mode === "date") {
    const { org, date } = parseDateFilterQuery(query);

    if (date) {
      localDate.value = date;
    }

    if (props.showOrganization) {
      if (org) {
        organizationSelection.value = org;
      }
    }
    return;
  }

  const { org, preset, from, to } = parseRangeFilterQuery(query);

  if (org) {
    organizationSelection.value = org;
  }

  if (from && to) {
    filtersStore.setCustomRange(from, to);
    return;
  }

  if (preset && validPresetValues.has(preset) && preset !== "custom") {
    filtersStore.setPreset(preset);
  }
}

function buildNextQuery() {
  if (props.mode === "date") {
    return buildDateFilterQuery(route.query, {
      org: props.showOrganization ? organizationSelection.value : "",
      date: localDate.value,
    });
  }

  return buildRangeFilterQuery(route.query, {
    org: props.showOrganization ? organizationSelection.value : "",
    preset: filtersStore.preset,
    from: filtersStore.dateFrom,
    to: filtersStore.dateTo,
  });
}

async function syncFiltersToQuery() {
  const nextQuery = buildNextQuery();
  const currentQuery = route.query;
  if (JSON.stringify(currentQuery) === JSON.stringify(nextQuery)) {
    return;
  }

  isSyncingQuery = true;
  try {
    await router.replace({ query: buildNextQuery() });
  } finally {
    isSyncingQuery = false;
  }
}

watch(
  () => [
    organizationSelection.value,
    filtersStore.dateFrom,
    filtersStore.dateTo,
    props.includeLfl ? filtersStore.lflDateFrom : null,
    props.includeLfl ? filtersStore.lflDateTo : null,
  ],
  () => {
    scheduleApply();
  },
  { immediate: true },
);

watch(
  () => [
    organizationSelection.value,
    filtersStore.preset,
    filtersStore.dateFrom,
    filtersStore.dateTo,
  ],
  () => {
    syncFiltersToQuery();
  },
);

watch(
  () => route.query,
  (query) => {
    if (isSyncingQuery) return;
    applyQueryToFilters(query);
  },
  { deep: true },
);

onMounted(() => {
  applyQueryToFilters(route.query);
});

onBeforeUnmount(() => {
  if (applyTimer) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
});

defineExpose({ apply: emitApply, localDate, organizationSelection });
</script>
