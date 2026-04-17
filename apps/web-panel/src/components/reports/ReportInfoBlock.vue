<template>
  <Card class="border-border/70 bg-card/95 p-4 md:p-5">
    <h2 class="text-sm font-semibold text-foreground">{{ title }}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{{ purpose }}</p>
    <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-lg border border-border/60 bg-background/60 p-3">
        <p class="text-xs font-semibold text-foreground">Что показывает</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ meaning }}</p>
      </div>
      <div class="rounded-lg border border-border/60 bg-background/60 p-3">
        <p class="text-xs font-semibold text-foreground">Как считается</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ calculation }}</p>
      </div>
      <div class="rounded-lg border border-border/60 bg-background/60 p-3">
        <p class="text-xs font-semibold text-foreground">За что отвечает</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ responsibility }}</p>
      </div>
    </div>
  </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";

defineProps({
  title: { type: String, required: true },
  purpose: { type: String, required: true },
  meaning: { type: String, required: true },
  calculation: { type: String, required: true },
  responsibility: { type: String, required: true },
});
</script>
