<template>
  <aside class="w-52 shrink-0 border-r border-border bg-card flex flex-col min-h-screen">
    <!-- Навигация -->
    <nav class="flex flex-col gap-1 p-3 flex-1 pt-4">
      <router-link to="/dashboard" class="nav-item" active-class="nav-item--active">
        <LayoutDashboard class="w-4 h-4 shrink-0" />
        <span>Дашборд</span>
      </router-link>

      <router-link to="/revenue" class="nav-item" active-class="nav-item--active">
        <BarChart2 class="w-4 h-4 shrink-0" />
        <span>Отчёты</span>
      </router-link>

      <router-link to="/stop-list" class="nav-item" active-class="nav-item--active">
        <ClipboardList class="w-4 h-4 shrink-0" />
        <span>Стоп-лист</span>
      </router-link>

      <router-link to="/top-dishes" class="nav-item" active-class="nav-item--active">
        <UtensilsCrossed class="w-4 h-4 shrink-0" />
        <span>Топ блюд</span>
      </router-link>

      <router-link to="/clients" class="nav-item" active-class="nav-item--active">
        <Users class="w-4 h-4 shrink-0" />
        <span>Клиенты</span>
      </router-link>

      <router-link to="/foodcost" class="nav-item" active-class="nav-item--active">
        <Percent class="w-4 h-4 shrink-0" />
        <span>Фудкост</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { LayoutDashboard, BarChart2, ClipboardList, UtensilsCrossed, Users, Percent } from "lucide-vue-next";
</script>

<style scoped>
.nav-item {
  @apply flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground
         hover:bg-accent hover:text-accent-foreground transition-colors no-underline;
}

.nav-item--active {
  @apply bg-primary/10 text-primary font-medium;
}
</style>
