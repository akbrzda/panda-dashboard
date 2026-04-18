<template>
  <div class="flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card/95 p-4">
    <!-- Выбор организации -->
    <div v-if="showOrganization" class="flex min-w-[240px] flex-1 flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Организация</label>
      <Select v-model="currentOrgId" :disabled="revenueStore.organizations.length === 0" placeholder="Выберите подразделение">
        <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </SelectItem>
      </Select>
    </div>

    <!-- Выбор периода -->
    <div class="flex min-w-[220px] flex-1 flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Период</label>
      <PeriodSelector />
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
import { computed, onBeforeUnmount, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import PeriodSelector from "@/components/filters/PeriodSelector.vue";
import { useRevenueStore } from "@/stores/revenue";
import { useFiltersStore } from "@/stores/filters";

const props = defineProps({
  loading: { type: Boolean, default: false },
  requireOrganization: { type: Boolean, default: true },
  showOrganization: { type: Boolean, default: true },
  includeLfl: { type: Boolean, default: false },
  showLflHint: { type: Boolean, default: false },
  autoApply: { type: Boolean, default: true },
});

const emit = defineEmits(["apply"]);

const revenueStore = useRevenueStore();
const filtersStore = useFiltersStore();

let applyTimer = null;

const canApply = computed(() => {
  const organizationId = revenueStore.currentOrganizationId;
  if (props.requireOrganization && !organizationId) return false;
  return Boolean(filtersStore.dateFrom && filtersStore.dateTo);
});

function buildPayload() {
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

watch(
  () => [
    revenueStore.currentOrganizationId,
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

onBeforeUnmount(() => {
  if (applyTimer) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
});

const currentOrgId = computed({
  get: () => revenueStore.currentOrganizationId,
  set: (val) => {
    revenueStore.currentOrganizationId = val;
    filtersStore.setOrganization(val);
  },
});
</script>
