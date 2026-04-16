<template>
  <button
    @click="themeStore.toggle()"
    :title="themeStore.isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'"
    class="flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Sun v-if="themeStore.isDark" class="w-4 h-4" />
    <Moon v-else class="w-4 h-4" />
  </button>
</template>

<script setup>
import { Sun, Moon } from "lucide-vue-next";
import { useThemeStore } from "@/stores/theme";

const themeStore = useThemeStore();
</script>
