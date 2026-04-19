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
      <router-link
        to="/stop-list"
        class="mr-2 inline-flex items-center gap-2 rounded-md border border-border/70 px-2.5 py-1 text-xs text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="alertHint"
      >
        <Bell class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Алерты</span>
        <span class="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
          {{ criticalStopListCount }}
        </span>
      </router-link>
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useWindowSize } from "@vueuse/core";
import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { Panda, PanelLeft, Bell } from "lucide-vue-next";
import { useSidebarStore } from "@/stores/sidebar";
import { useStopListStore } from "@/stores/stopList";
import Button from "@/components/ui/Button.vue";

const sidebarStore = useSidebarStore();
const stopListStore = useStopListStore();
const { width } = useWindowSize();
const criticalStopListCount = computed(() => stopListStore.summaryCards?.longerThan2Hours || 0);
const alertHint = computed(() => `Критичные позиции в стоп-листе: ${criticalStopListCount.value}`);

function handleSidebarTrigger() {
  if (width.value >= 768) {
    sidebarStore.toggleDesktop();
    return;
  }

  sidebarStore.toggleMobile();
}

onMounted(() => {
  if (!stopListStore.organizations.length) {
    stopListStore.loadOrganizations();
  }
});
</script>
