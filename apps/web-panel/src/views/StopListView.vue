<template>
  <div class="space-y-6">
    <header class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-foreground">Стоп-лист ({{ itemsCount }})</h1>
        <div class="flex items-center gap-2">
          <Badge v-if="isLive" variant="success">LIVE</Badge>
          <Button
            variant="outline"
            size="sm"
            :disabled="isLoading"
            @click="store.loadStopLists()"
          >
            {{ isLoading ? "Загрузка..." : "Обновить" }}
          </Button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Подразделение</label>
          <Select v-model="selectedOrganizationId" :disabled="isLoading || store.organizations.length === 0" placeholder="Выберите подразделение">
            <SelectItem v-for="org in store.organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Поиск</label>
          <Input
            v-model="searchText"
            type="text"
            placeholder="Название, код или SKU"
            class="h-9"
          />
        </div>
      </div>
    </header>

    <StopListTable :items="filteredItems" :is-loading="isLoading" :error="error" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import { useStopListStore } from "../stores/stopList";
import StopListTable from "../components/StopListTable.vue";
import Select from "../components/ui/Select.vue";
import SelectItem from "../components/ui/SelectItem.vue";
import Input from "../components/ui/Input.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";

const store = useStopListStore();

const filteredItems = computed(() => store.filteredItems);
const itemsCount = computed(() => store.itemsCount);
const isLoading = computed(() => store.isLoading);
const error = computed(() => store.error);
const isLive = ref(false);

const selectedOrganizationId = computed({
  get: () => store.currentOrganizationId,
  set: (value) => {
    if (value) {
      store.setCurrentOrganization(value);
    }
  },
});

const searchText = computed({
  get: () => store.filterText,
  set: (value) => store.setFilterText(value),
});

let eventSource = null;

function connectSSE() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
  eventSource = new EventSource(`${apiBase}/stop-lists/events`);

  eventSource.addEventListener("connected", () => {
    isLive.value = true;
  });

  eventSource.addEventListener("stopListUpdate", (e) => {
    // При событии от iiko обновляем список
    store.loadStopLists();
  });

  eventSource.onerror = () => {
    isLive.value = false;
  };
}

useAutoRefresh(() => {
  if (!isLoading.value) {
    store.loadStopLists();
  }
});

onMounted(() => {
  store.loadOrganizations();
  connectSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
  store.stopAll();
});
</script>
