<template>
  <div class="relative" ref="wrapperRef">
    <!-- Кнопка-триггер -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      :disabled="disabled"
      class="flex w-full items-center justify-between gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <CalendarDays class="w-4 h-4 text-muted-foreground shrink-0" />
      <span :class="!modelValue ? 'text-muted-foreground' : ''">
        {{ displayValue || placeholder }}
      </span>
    </button>

    <!-- Выпадающий календарь -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="absolute z-50 top-full mt-1 left-0">
        <Calendar :model-value="modelValue" @update:model-value="onSelect" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { CalendarDays } from "lucide-vue-next";
import Calendar from "./Calendar.vue";

const props = defineProps({
  modelValue: { type: String, default: null },
  placeholder: { type: String, default: "Выберите дату" },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const wrapperRef = ref(null);

const displayValue = computed(() => {
  if (!props.modelValue) return "";
  // Форматируем YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = props.modelValue.split("-");
  return `${d}.${m}.${y}`;
});

function onSelect(val) {
  emit("update:modelValue", val);
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
