<template>
  <div class="stop-list-filters">
    <div class="filter-section">
      <label for="organization-select">Филиал</label>
      <select id="organization-select" v-model="currentOrganizationId" class="select-field" @change="handleOrganizationChange">
        <option v-if="organizations.length === 0" value="">Загрузка...</option>
        <option v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </option>
      </select>
    </div>

    <div class="filter-section">
      <label for="status-select">Статус</label>
      <select id="status-select" v-model="statusFilter" class="select-field" @change="handleStatusChange">
        <option value="all">Все</option>
        <option value="stopped">В стопе</option>
      </select>
    </div>

    <div class="filter-section">
      <label>Фильтр</label>
      <input type="text" v-model="filterText" class="text-input" placeholder="Поиск по товару" @input="handleFilterChange" />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useStopListStore } from "../stores/stopList";

const store = useStopListStore();

const organizations = computed(() => store.organizations);
const currentOrganizationId = computed({
  get: () => store.currentOrganizationId,
  set: (value) => store.setCurrentOrganization(value),
});
const statusFilter = computed({
  get: () => store.statusFilter,
  set: (value) => store.setStatusFilter(value),
});
const filterText = computed({
  get: () => store.filterText,
  set: (value) => store.setFilterText(value),
});

const handleOrganizationChange = () => {
  store.setCurrentOrganization(currentOrganizationId.value);
};

const handleStatusChange = () => {
  store.setStatusFilter(statusFilter.value);
};

const handleFilterChange = () => {
  store.setFilterText(filterText.value);
};
</script>

<style scoped>
.stop-list-filters {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-section label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.select-field,
.text-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  transition: border-color 0.2s;
}

.select-field:focus,
.text-input:focus {
  outline: none;
  border-color: #4caf50;
}

.text-input::placeholder {
  color: #999;
}
</style>
