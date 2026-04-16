<template>
  <aside class="flex min-h-screen w-16 shrink-0 flex-col border-r border-border bg-card sm:w-52">
    <nav class="flex flex-1 flex-col gap-1 p-2 pt-4 sm:p-3">
      <router-link to="/dashboard" class="nav-item" active-class="nav-item--active">
        <LayoutDashboard class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Дашборд</span>
      </router-link>

      <router-link to="/revenue" class="nav-item" active-class="nav-item--active">
        <BarChart2 class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Отчёты</span>
      </router-link>

      <router-link to="/stop-list" class="nav-item" active-class="nav-item--active">
        <ClipboardList class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Стоп-лист</span>
      </router-link>

      <router-link to="/top-dishes" class="nav-item" active-class="nav-item--active">
        <UtensilsCrossed class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Топ блюд</span>
      </router-link>

      <router-link to="/clients" class="nav-item" active-class="nav-item--active">
        <Users class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Клиенты</span>
      </router-link>

      <router-link to="/foodcost" class="nav-item" active-class="nav-item--active">
        <Percent class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Фудкост</span>
      </router-link>

      <router-link to="/plans" class="nav-item" active-class="nav-item--active">
        <Target class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">Планы</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { LayoutDashboard, BarChart2, ClipboardList, UtensilsCrossed, Users, Percent, Target } from "lucide-vue-next";
</script>

<style scoped>
.nav-item {
  @apply flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:justify-start sm:px-3 no-underline;
}

.nav-item--active {
  @apply bg-primary/10 text-primary font-medium;
}
</style>
