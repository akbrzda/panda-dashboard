<template>
  <header class="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="flex h-14 items-center gap-3 px-4 md:px-6">
      <router-link to="/dashboard" class="flex items-center gap-2 font-semibold text-foreground no-underline">
        <Panda size="24" />
        <span class="hidden sm:inline text-sm">Panda Dashboard</span>
      </router-link>
      <div class="flex-1" />
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup>
import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { Panda } from "lucide-vue-next";
</script>
