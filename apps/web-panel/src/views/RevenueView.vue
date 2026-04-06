<template>
  <div class="revenue-view">
    <header class="header">
      <h1>Отчеты по выручке</h1>
      <div v-if="currentOrganization" class="organization-name">{{ currentOrganization.name }}</div>
    </header>

    <div v-if="error" class="error-message">❌ {{ error }}</div>

    <RevenueFilters
      v-model:startDate="store.startDate"
      v-model:endDate="store.endDate"
      v-model:organizationId="store.currentOrganizationId"
      :organizations="store.organizations"
      @apply="handleFilterApply"
    />

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Загрузка отчета...</p>
    </div>

    <div v-else-if="hasData" class="revenue-content">
      <div class="period-info">
        <span class="period-label">Период:</span>
        <span class="period-value">{{ formattedPeriod }}</span>
      </div>

      <RevenueKpiCards :summary="summary" />

      <RevenueCharts :revenueByChannel="revenueByChannel" />

      <RevenueTable :revenueByChannel="revenueByChannel" :isLoading="isLoading" />
    </div>

    <div v-else-if="!isLoading && !hasData" class="empty-state">
      <p>Выберите период и нажмите "Применить" для загрузки отчета</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRevenueStore } from "../stores/revenue";
import RevenueFilters from "../components/RevenueFilters.vue";
import RevenueKpiCards from "../components/RevenueKpiCards.vue";
import RevenueCharts from "../components/RevenueCharts.vue";
import RevenueTable from "../components/RevenueTable.vue";

const store = useRevenueStore();

const isLoading = computed(() => store.isLoading);
const error = computed(() => store.error);
const hasData = computed(() => store.hasData);
const summary = computed(() => store.summary);
const revenueByChannel = computed(() => store.revenueByChannel);
const currentOrganization = computed(() => store.currentOrganization);
const formattedPeriod = computed(() => store.formattedPeriod);

const handleFilterApply = () => {
  store.loadRevenueReport();
};

onMounted(() => {
  console.log("📊 RevenueView mounted");

  // Загружаем организации, если еще не загружены
  if (store.organizations.length === 0) {
    store.loadOrganizations();
  } else if (!hasData.value) {
    // Если организации уже загружены, но данных нет, загружаем отчет
    store.loadRevenueReport();
  }
});
</script>

<style scoped>
.revenue-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 20px;
}

.header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.organization-name {
  font-size: 16px;
  color: #666;
  font-weight: 500;
}

.period-info {
  background: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.period-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.period-value {
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #c62828;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-overlay p {
  color: #666;
  font-size: 16px;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.empty-state p {
  color: #999;
  font-size: 16px;
  margin: 0;
}

.revenue-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .revenue-view {
    padding: 15px;
  }

  .header h1 {
    font-size: 24px;
  }

  .organization-name {
    font-size: 14px;
  }
}
</style>
