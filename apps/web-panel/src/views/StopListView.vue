<template>
  <div class="stop-list-view">
    <header class="header">
      <div class="header-row">
        <h1>Стоп-лист ({{ itemsCount }})</h1>
        <div class="header-actions">
          <span v-if="isLive" class="live-badge">● LIVE</span>
          <button class="refresh-btn" :disabled="isLoading" @click="store.loadStopLists()">
            {{ isLoading ? "Загрузка..." : "Обновить" }}
          </button>
        </div>
      </div>

      <div class="filters-row">
        <div class="filter-control">
          <label>Подразделение</label>
          <Select v-model="selectedOrganizationId" :disabled="isLoading || store.organizations.length === 0" placeholder="Выберите подразделение">
            <SelectItem v-for="org in store.organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </SelectItem>
          </Select>
        </div>

        <div class="filter-control search-control">
          <label>Поиск</label>
          <input v-model="searchText" type="text" placeholder="Название, код или SKU" class="search-input" />
        </div>
      </div>
    </header>

    <StopListTable :items="filteredItems" :is-loading="isLoading" :error="error" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useStopListStore } from "../stores/stopList";
import StopListTable from "../components/StopListTable.vue";
import Select from "../components/ui/Select.vue";
import SelectItem from "../components/ui/SelectItem.vue";

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

onMounted(() => {
  store.loadOrganizations();
  connectSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.stop-list-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filters-row {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(240px, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.filter-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-control label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.search-input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 14px;
}

.live-badge {
  font-size: 12px;
  font-weight: 600;
  color: #22c55e;
  letter-spacing: 0.05em;
}

.refresh-btn {
  padding: 6px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: hsl(var(--accent));
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.header {
  margin-bottom: 20px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

@media (max-width: 768px) {
  .stop-list-view {
    padding: 15px;
  }

  .header h1 {
    font-size: 24px;
  }

  .filters-row {
    grid-template-columns: 1fr;
  }
}
</style>
