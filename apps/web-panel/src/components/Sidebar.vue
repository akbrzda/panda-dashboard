<template>
  <aside
      :class="[
        'sticky top-0 hidden h-screen shrink-0 border-r border-border/70 bg-card/95 transition-[width] duration-200 md:flex md:flex-col',
        sidebarStore.open ? 'w-72' : 'w-20',
      ]"
    >
      <div class="flex h-14 items-center justify-between border-b border-border/70 px-3">
        <router-link to="/dashboard" class="flex min-w-0 items-center gap-2 no-underline text-foreground">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Panda class="h-4 w-4" />
          </div>
          <div v-if="sidebarStore.open" class="min-w-0">
            <p class="truncate text-sm font-semibold">Panda Dashboard</p>
            <p class="truncate text-xs text-muted-foreground">Analytics</p>
          </div>
        </router-link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground"
          @click="sidebarStore.toggleDesktop"
        >
          <PanelLeftClose v-if="sidebarStore.open" class="h-4 w-4" />
          <PanelLeftOpen v-else class="h-4 w-4" />
        </Button>
      </div>

      <nav class="flex-1 overflow-y-auto p-2">
        <section v-for="section in menuSections" :key="section.title" class="mb-4 space-y-1">
          <p
            v-if="sidebarStore.open"
            class="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            {{ section.title }}
          </p>

          <router-link
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="sidebar-menu-item"
            active-class="sidebar-menu-item--active"
            :title="item.label"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span v-if="sidebarStore.open" class="truncate">{{ item.label }}</span>
          </router-link>
        </section>
      </nav>
  </aside>

    <transition name="fade">
      <div
        v-if="sidebarStore.openMobile"
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
        @click="sidebarStore.closeMobile"
      />
    </transition>

  <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 w-[18rem] border-r border-border/70 bg-card/95 p-2 shadow-2xl transition-transform duration-200 md:hidden',
        sidebarStore.openMobile ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex h-12 items-center justify-between px-1">
        <router-link to="/dashboard" class="flex items-center gap-2 no-underline text-foreground" @click="sidebarStore.closeMobile">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Panda class="h-4 w-4" />
          </div>
          <span class="text-sm font-semibold">Panda Dashboard</span>
        </router-link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground"
          @click="sidebarStore.closeMobile"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <nav class="mt-2 h-[calc(100%-3rem)] overflow-y-auto">
        <section v-for="section in menuSections" :key="`mobile-${section.title}`" class="mb-4 space-y-1">
          <p class="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {{ section.title }}
          </p>

          <router-link
            v-for="item in section.items"
            :key="`mobile-${item.to}`"
            :to="item.to"
            class="sidebar-menu-item"
            active-class="sidebar-menu-item--active"
            @click="sidebarStore.closeMobile"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </router-link>
        </section>
      </nav>
  </aside>
</template>

<script setup>
import { onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Panda, PanelLeftClose, PanelLeftOpen, X } from "lucide-vue-next";
import { reportSectionsCatalog as menuSections } from "@/config/reportCatalog";
import { useSidebarStore } from "@/stores/sidebar";
import Button from "@/components/ui/Button.vue";

const sidebarStore = useSidebarStore();
const router = useRouter();
const removeAfterEach = router.afterEach(() => {
  sidebarStore.closeMobile();
});

onUnmounted(() => {
  removeAfterEach();
});
</script>

<style scoped>
.sidebar-menu-item {
  @apply flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground no-underline;
}

.sidebar-menu-item--active {
  @apply bg-primary/10 font-medium text-primary;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
