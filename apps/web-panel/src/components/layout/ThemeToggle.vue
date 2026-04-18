<template>
  <Button
    @click="themeStore.toggle()"
    :title="themeStore.isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'"
    variant="outline"
    size="icon"
    class="h-9 w-9"
  >
    <Sun v-if="themeStore.isDark" class="w-4 h-4" />
    <Moon v-else class="w-4 h-4" />
  </Button>
</template>

<script setup>
import { Sun, Moon } from "lucide-vue-next";
import { useThemeStore } from "@/stores/theme";
import Button from "@/components/ui/Button.vue";

const themeStore = useThemeStore();
</script>
