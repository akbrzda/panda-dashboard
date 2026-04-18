<template>
  <div class="relative" ref="wrapperRef">
    <Button
      type="button"
      @click="isOpen = !isOpen"
      variant="outline"
      class="h-9 w-full justify-between px-3 text-left"
    >
      <span class="flex min-w-0 items-center gap-2">
        <CalendarDays class="h-4 w-4 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ currentLabel }}</span>
      </span>
      <ChevronDown class="ml-2 h-3 w-3 shrink-0 text-muted-foreground" />
    </Button>

    <!-- Выпадающий список -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-50 top-full mt-1 left-0 w-[320px] rounded-md border border-border bg-popover text-popover-foreground shadow-md"
      >
        <!-- Пресеты -->
        <div class="py-1">
          <Button
            v-for="p in PRESETS"
            :key="p.value"
            type="button"
            @click="selectPreset(p.value)"
            variant="ghost"
            class="h-auto w-full justify-start rounded-none px-3 py-2 text-sm"
            :class="filtersStore.preset === p.value ? 'font-medium text-primary' : ''"
          >
            {{ p.label }}
            <span v-if="p.value === 'today'" class="ml-1 text-xs text-muted-foreground">★</span>
          </Button>
        </div>

        <!-- Кастомный диапазон -->
        <div class="border-t border-border p-3 space-y-2">
          <p class="text-xs font-medium text-muted-foreground">Произвольный период</p>
          <div class="flex gap-2 items-center">
            <DatePicker v-model="customFrom" placeholder="Начало" />
            <span class="text-muted-foreground text-xs">—</span>
            <DatePicker v-model="customTo" placeholder="Конец" />
          </div>
          <p class="text-[11px] text-muted-foreground">Диапазон применится автоматически после выбора обеих дат.</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { CalendarDays, ChevronDown } from "lucide-vue-next";
import { useFiltersStore } from "@/stores/filters";
import { PERIOD_PRESETS, getPeriodLabel, formatDateISO } from "@/composables/usePeriod";
import DatePicker from "@/components/ui/DatePicker.vue";
import Button from "@/components/ui/Button.vue";

const PRESETS = PERIOD_PRESETS.filter((p) => p.value !== "custom");

const filtersStore = useFiltersStore();
const isOpen = ref(false);
const wrapperRef = ref(null);

const customFrom = ref(filtersStore.dateFrom || "");
const customTo = ref(filtersStore.dateTo || "");

const currentLabel = computed(() => getPeriodLabel(filtersStore.preset, filtersStore.dateRange));

function selectPreset(value) {
  filtersStore.setPreset(value);
  isOpen.value = false;
}

function applyCustom() {
  if (!customFrom.value || !customTo.value) return;
  filtersStore.setCustomRange(customFrom.value, customTo.value);
  isOpen.value = false;
}

watch(
  () => [customFrom.value, customTo.value],
  () => {
    if (!isOpen.value) return;
    if (!customFrom.value || !customTo.value) return;
    applyCustom();
  },
);

function handleOutsideClick(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", handleOutsideClick));
onUnmounted(() => document.removeEventListener("mousedown", handleOutsideClick));
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
