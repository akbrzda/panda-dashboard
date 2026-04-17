<template>
  <aside class="flex min-h-screen w-16 shrink-0 flex-col border-r border-border bg-card sm:w-56">
    <nav class="flex flex-1 flex-col gap-4 overflow-y-auto p-2 pt-4 sm:p-3">
      <section v-for="section in menuSections" :key="section.title" class="space-y-1">
        <p class="hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:block">
          {{ section.title }}
        </p>

        <router-link v-for="item in section.items" :key="item.to" :to="item.to" class="nav-item" active-class="nav-item--active">
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          <span class="hidden sm:inline">{{ item.label }}</span>
        </router-link>
      </section>
    </nav>
  </aside>
</template>

<script setup>
import { reportSectionsCatalog as menuSections } from "@/config/reportCatalog";
</script>

<style scoped>
.nav-item {
  @apply flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:justify-start sm:px-3 no-underline;
}

.nav-item--active {
  @apply bg-primary/10 font-medium text-primary;
}
</style>
