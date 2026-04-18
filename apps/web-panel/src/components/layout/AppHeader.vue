<template>
  <header class="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="flex h-14 items-center gap-3 px-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground"
        @click="handleSidebarTrigger"
      >
        <PanelLeft class="h-4 w-4" />
      </Button>

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
import { useWindowSize } from "@vueuse/core";
import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { Panda, PanelLeft } from "lucide-vue-next";
import { useSidebarStore } from "@/stores/sidebar";
import Button from "@/components/ui/Button.vue";

const sidebarStore = useSidebarStore();
const { width } = useWindowSize();

function handleSidebarTrigger() {
  if (width.value >= 768) {
    sidebarStore.toggleDesktop();
    return;
  }

  sidebarStore.toggleMobile();
}
</script>
