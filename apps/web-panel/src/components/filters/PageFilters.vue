<template>
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
    <!-- Выбор организации -->
    <div v-if="showOrganization" class="flex flex-col gap-1.5 min-w-[200px]">
      <label class="text-xs font-medium text-muted-foreground">Организация</label>
      <Select v-model="currentOrgId" :disabled="revenueStore.organizations.length === 0 || loading" placeholder="Выберите подразделение">
        <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </SelectItem>
      </Select>
    </div>

    <!-- Выбор периода -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Период</label>
      <PeriodSelector :disabled="loading" />
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="loading" class="flex items-center gap-2 text-xs text-muted-foreground self-end pb-1.5">
      <RefreshCw class="w-3.5 h-3.5 animate-spin" />
      <span>Загрузка...</span>
    </div>

    <!-- Кнопка применить -->
    <button
      @click="handleApplyClick"
      :disabled="isApplyDisabled"
      class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
    >
      {{ loading ? "Загрузка..." : "Применить" }}
    </button>

    <!-- Период LFL для справки -->
    <div v-if="showLflHint && filtersStore.lflDateFrom && !loading" class="ml-auto self-end pb-1.5 text-xs text-muted-foreground hidden lg:block">
      LFL: {{ filtersStore.lflDateFrom }} — {{ filtersStore.lflDateTo }}
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from "vue";
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
});

const emit = defineEmits(["apply"]);

const revenueStore = useRevenueStore();
const filtersStore = useFiltersStore();

const isApplyDisabled = computed(() => props.loading || (props.requireOrganization && !revenueStore.currentOrganizationId));

function handleApplyClick() {
  const payload = {
    organizationId: revenueStore.currentOrganizationId,
    dateFrom: filtersStore.dateFrom,
    dateTo: filtersStore.dateTo,
  };

  if (props.includeLfl) {
    payload.lflDateFrom = filtersStore.lflDateFrom;
    payload.lflDateTo = filtersStore.lflDateTo;
  }

  emit("apply", payload);
}

// Двухсторонняя привязка организации через вычисляемое свойство
const currentOrgId = computed({
  get: () => revenueStore.currentOrganizationId,
  set: (val) => {
    revenueStore.currentOrganizationId = val;
  },
});

// Авто-применение убрано — теперь пользователь нажимает кнопку "Применить"
watch([() => filtersStore.dateFrom, () => filtersStore.dateTo], ([dateFrom, dateTo]) => {
  if (!dateFrom || !dateTo) return;
  revenueStore.startDate = dateFrom;
  revenueStore.endDate = dateTo;
});
</script>
