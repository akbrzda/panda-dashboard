<template>
  <div class="stop-list-view">
    <header class="header">
      <h1>Управление ({{ itemsCount }})</h1>
    </header>

    <StopListTable :items="filteredItems" :is-loading="isLoading" :error="error" />
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useStopListStore } from "../stores/stopList";
import StopListTable from "../components/StopListTable.vue";

const store = useStopListStore();

const filteredItems = computed(() => store.filteredItems);
const itemsCount = computed(() => store.itemsCount);
const isLoading = computed(() => store.isLoading);
const error = computed(() => store.error);

onMounted(() => {
  if (store.organizations.length === 0) {
    store.loadOrganizations();
  }
});
</script>

<style scoped>
.stop-list-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 20px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

@media (max-width: 768px) {
  .stop-list-view {
    padding: 15px;
  }

  .header h1 {
    font-size: 24px;
  }
}
</style>
