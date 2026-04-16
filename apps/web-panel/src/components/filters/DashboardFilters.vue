<template>
  <div class="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
    <!-- Дата -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">Дата</label>
      <DatePicker v-model="localDate" placeholder="Выберите дату" />
    </div>

    <!-- Подразделения -->
    <div class="flex flex-col gap-1.5 min-w-[200px]">
      <label class="text-xs font-medium text-muted-foreground">Подразделение</label>
      <Select v-model="currentOrgSelection" placeholder="Все подразделения">
        <SelectItem :value="ALL_ORGANIZATIONS">Все подразделения</SelectItem>
        <SelectItem v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </SelectItem>
      </Select>
    </div>

    <!-- Применить -->
    <button
      @click="apply"
      :disabled="loading"
      class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
    >
      <span v-if="loading" class="flex items-center gap-2">
        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
        Загрузка...
      </span>
      <span v-else>Применить</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
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

function apply() {
  const selectedIds = currentOrgSelection.value !== ALL_ORGANIZATIONS ? [currentOrgSelection.value] : [];
  emit("apply", {
    date: localDate.value,
    organizationIds: selectedIds,
  });
}

defineExpose({ apply, localDate, currentOrgSelection });
</script>
