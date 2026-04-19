<template>
  <section class="mx-auto max-w-3xl space-y-4 rounded-xl border border-border/70 bg-card/90 p-6">
    <h1 class="text-2xl font-bold text-foreground">Раздел в планах</h1>
    <p class="text-sm text-muted-foreground">
      Этот раздел запланирован в roadmap и временно недоступен в текущей версии.
    </p>
    <p class="text-sm text-muted-foreground">
      Запрошенный маршрут: <span class="font-mono text-foreground">{{ targetRoute }}</span>
    </p>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const targetRoute = computed(() => String(route.query.target || "не указан"));
</script>
