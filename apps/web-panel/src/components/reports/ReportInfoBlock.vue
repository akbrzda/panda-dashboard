<template>
  <Card :class="dense ? 'border-border/70 bg-card p-4 md:p-5' : 'border-border/70 bg-card p-5 md:p-6'">
    <h2 class="text-base font-semibold text-foreground">{{ title }}</h2>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ purpose }}</p>
    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-md border border-border/60 bg-muted/25 p-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">Что показывает</p>
        <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ meaning }}</p>
      </div>
      <div class="rounded-md border border-border/60 bg-muted/25 p-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">Как считается</p>
        <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ calculation }}</p>
      </div>
      <div class="rounded-md border border-border/60 bg-muted/25 p-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">За что отвечает</p>
        <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ responsibility }}</p>
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
  dense: { type: Boolean, default: true },
});
</script>
