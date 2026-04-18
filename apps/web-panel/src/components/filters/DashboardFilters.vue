<template>
  <div class="flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card/95 p-4">
    <!-- Подразделения -->
    <div class="flex min-w-[240px] flex-1 flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Подразделение</label>
      <Select v-model="currentOrgSelection" placeholder="Все подразделения">
        <SelectItem :value="ALL_ORGANIZATIONS">Все подразделения</SelectItem>
        <SelectItem v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </SelectItem>
      </Select>
    </div>

    <!-- Дата -->
    <div class="flex min-w-[220px] flex-1 flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Дата</label>
      <DatePicker v-model="localDate" placeholder="Выберите дату" />
    </div>

    <div class="ml-auto flex min-h-[36px] min-w-[220px] flex-col items-end justify-end gap-1.5">
      <span v-if="loading" class="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
        Обновление...
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { useRevenueStore } from "@/stores/revenue";
import DatePicker from "@/components/ui/DatePicker.vue";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";

defineProps({
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(["apply"]);

const revenueStore = useRevenueStore();
const organizations = computed(() => revenueStore.organizations);

// Сегодняшняя дата в формате YYYY-MM-DD
const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});

const ALL_ORGANIZATIONS = "__all__";

const localDate = ref(todayStr.value);
const currentOrgSelection = ref(ALL_ORGANIZATIONS);
let applyTimer = null;

function apply() {
  const selectedIds = currentOrgSelection.value !== ALL_ORGANIZATIONS ? [currentOrgSelection.value] : [];
  emit("apply", {
    date: localDate.value,
    organizationIds: selectedIds,
  });
}

watch(
  () => [localDate.value, currentOrgSelection.value],
  () => {
    if (!localDate.value) return;
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      apply();
      applyTimer = null;
    }, 180);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (applyTimer) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
});

defineExpose({ apply, localDate, currentOrgSelection });
</script>
