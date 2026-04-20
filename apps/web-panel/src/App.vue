<template>
  <div class="flex min-h-screen bg-background text-foreground">
    <Sidebar />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-4 md:p-6">
        <router-view />
      </main>
    </div>

    <Sonner />
  </div>
</template>

<script setup>
import Sidebar from "@/components/layout/Sidebar.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import Sonner from "@/components/ui/Sonner.vue";
import { useThemeStore } from "@/stores/theme";

useThemeStore();
</script>
