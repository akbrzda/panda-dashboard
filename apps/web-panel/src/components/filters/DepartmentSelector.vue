<template>
  <div class="relative" ref="wrapperRef">
    <!-- Кнопка-триггер -->
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Building2 class="w-4 h-4 text-muted-foreground shrink-0" />
      <span class="max-w-[160px] truncate">{{ triggerLabel }}</span>
      <ChevronDown class="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
    </button>

    <!-- Выпадающий список -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="absolute z-50 top-full mt-1 left-0 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-md">
        <!-- Загрузка -->
        <div v-if="loading" class="px-3 py-4 text-sm text-muted-foreground text-center">Загрузка...</div>

        <div v-else class="py-1">
          <!-- Выбрать все -->
          <label class="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors font-medium">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleAll"
              class="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            <span>Все подразделения</span>
          </label>

          <div class="border-t border-border my-1" />

          <!-- Список организаций -->
          <label
            v-for="org in organizations"
            :key="org.id"
            class="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
          >
            <input type="checkbox" :value="org.id" v-model="selected" class="h-4 w-4 rounded border-border text-primary focus:ring-ring" />
            <span class="truncate">{{ org.name }}</span>
          </label>

          <!-- Нет данных -->
          <div v-if="!organizations.length" class="px-3 py-4 text-sm text-muted-foreground text-center">Нет доступных подразделений</div>
        </div>

        <!-- Кнопка применить -->
        <div class="border-t border-border p-2">
          <button
            @click="apply"
            class="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Применить
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Building2, ChevronDown } from "lucide-vue-next";
import { useFiltersStore } from "@/stores/filters";

const props = defineProps({
  organizations: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const filtersStore = useFiltersStore();
const isOpen = ref(false);
const wrapperRef = ref(null);

// Локальная копия выбранных до применения
const selected = ref([...filtersStore.departments]);

const allSelected = computed(() => selected.value.length === 0);
const someSelected = computed(() => selected.value.length > 0 && selected.value.length < props.organizations.length);

const triggerLabel = computed(() => {
  if (filtersStore.departments.length === 0) return "Все подразделения";
  if (filtersStore.departments.length === 1) {
    const org = props.organizations.find((o) => o.id === filtersStore.departments[0]);
    return org?.name || "1 подразделение";
  }
  return `${filtersStore.departments.length} подразделения`;
});

function toggleAll() {
  selected.value = allSelected.value ? [...props.organizations.map((o) => o.id)] : [];
}

function apply() {
  // Пустой массив = все подразделения
  filtersStore.setDepartments([...selected.value]);
  isOpen.value = false;
}

function handleOutsideClick(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    isOpen.value = false;
  }
}

// Синхронизируем локальный стейт при открытии
watch(isOpen, (val) => {
  if (val) selected.value = [...filtersStore.departments];
});

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
