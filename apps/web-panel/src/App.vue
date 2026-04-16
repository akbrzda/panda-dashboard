<template>
  <div class="min-h-screen bg-background text-foreground flex">
    <!-- Боковая навигация -->
    <Sidebar />

    <!-- Основная область -->
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <main class="flex-1 overflow-auto p-4 md:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import Sidebar from "@/components/Sidebar.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { useThemeStore } from "@/stores/theme";

// Инициализируем тему при старте приложения
useThemeStore();
</script>
