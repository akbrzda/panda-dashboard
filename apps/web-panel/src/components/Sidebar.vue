<template>
  <aside class="sidebar">
    <div class="logo">
      <h2>🐼 Panda Dashboard</h2>
    </div>

    <nav class="nav">
      <router-link to="/stop-list" class="nav-item" active-class="active">
        <span class="icon">📋</span>
        <span class="label">Стоп-лист</span>
      </router-link>

      <router-link to="/revenue" class="nav-item" active-class="active">
        <span class="icon">📊</span>
        <span class="label">Отчеты</span>
      </router-link>
    </nav>

    <div class="filters-section">
      <StopListFilters v-if="$route.path === '/stop-list'" />
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from "vue-router";
import StopListFilters from "./StopListFilters.vue";

const $route = useRoute();
</script>

<style scoped>
.sidebar {
  width: 280px;
  background-color: #f5f5f5;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logo {
  padding-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.logo h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: #666;
  transition: all 0.2s;
  cursor: pointer;
}

.nav-item:hover {
  background-color: #e0e0e0;
  color: #333;
}

.nav-item.active {
  background-color: #4caf50;
  color: white;
  font-weight: 500;
}

.nav-item .icon {
  font-size: 20px;
}

.nav-item .label {
  font-size: 14px;
}

.filters-section {
  flex: 1;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-height: auto;
  }
}
</style>
