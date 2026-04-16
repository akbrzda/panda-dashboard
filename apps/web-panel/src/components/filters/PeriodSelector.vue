<template>
  <div class="relative" ref="wrapperRef">
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="flex min-w-[220px] items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CalendarDays class="w-4 h-4 text-muted-foreground shrink-0" />
      <span class="max-w-[180px] truncate">{{ currentLabel }}</span>
      <ChevronDown class="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
    </button>

    <!-- Выпадающий список -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-50 top-full mt-1 left-0 w-[320px] rounded-md border border-border bg-popover text-popover-foreground shadow-md"
      >
        <!-- Пресеты -->
        <div class="py-1">
          <button
            v-for="p in PRESETS"
            :key="p.value"
            @click="selectPreset(p.value)"
            :class="[
              'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
              filtersStore.preset === p.value ? 'text-primary font-medium' : '',
            ]"
          >
            {{ p.label }}
            <span v-if="p.value === 'today'" class="ml-1 text-xs text-muted-foreground">★</span>
          </button>
        </div>

        <!-- Кастомный диапазон -->
        <div class="border-t border-border p-3 space-y-2">
          <p class="text-xs font-medium text-muted-foreground">Произвольный период</p>
          <div class="flex gap-2 items-center">
            <DatePicker v-model="customFrom" placeholder="Начало" />
            <span class="text-muted-foreground text-xs">—</span>
            <DatePicker v-model="customTo" placeholder="Конец" />
          </div>
          <button
            @click="applyCustom"
            :disabled="!customFrom || !customTo"
            class="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Применить
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { CalendarDays, ChevronDown } from "lucide-vue-next";
import { useFiltersStore } from "@/stores/filters";
import { PERIOD_PRESETS, getPeriodLabel, formatDateISO } from "@/composables/usePeriod";
import DatePicker from "@/components/ui/DatePicker.vue";

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
