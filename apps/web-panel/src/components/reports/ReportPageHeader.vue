<template>
  <header class="space-y-3 rounded-lg border border-border/70 bg-card/95 p-4 md:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
          <Badge :variant="statusVariant">{{ statusLabel }}</Badge>
          <Badge variant="outline">Tier {{ tier }}</Badge>
        </div>
        <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
      </div>

      <Button v-if="showRefresh" variant="outline" size="sm" :disabled="refreshing" @click="emit('refresh')">
        {{ refreshing ? "Обновление..." : "Обновить" }}
      </Button>
    </div>

    <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
        <p class="text-[11px] uppercase tracking-wide text-foreground/70">Updated at</p>
        <p class="mt-1 text-foreground">{{ updatedAtLabel }}</p>
      </div>
      <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
        <p class="text-[11px] uppercase tracking-wide text-foreground/70">Source</p>
        <p class="mt-1 text-foreground">{{ source || "—" }}</p>
      </div>
      <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
        <p class="text-[11px] uppercase tracking-wide text-foreground/70">Coverage</p>
        <p class="mt-1 text-foreground">{{ coverage || "—" }}</p>
      </div>
      <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
        <p class="text-[11px] uppercase tracking-wide text-foreground/70">Last reviewed</p>
        <p class="mt-1 text-foreground">{{ reviewedAtLabel }}</p>
      </div>
    </div>

    <div v-if="normalizedWarnings.length" class="flex flex-wrap gap-2">
      <Badge v-for="warning in normalizedWarnings" :key="warning" variant="warning">
        {{ warning }}
      </Badge>
    </div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { getReadinessStatusBadgeVariant, getReadinessStatusLabel } from "@/config/readinessUi";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  status: { type: String, default: "planned" },
  tier: { type: Number, default: 3 },
  source: { type: String, default: "" },
  coverage: { type: String, default: "" },
  updatedAt: { type: [String, Date], default: null },
  lastReviewedAt: { type: String, default: "" },
  warnings: { type: Array, default: () => [] },
  showRefresh: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
});

const emit = defineEmits(["refresh"]);

const statusLabel = computed(() => {
  return getReadinessStatusLabel(props.status);
});

const statusVariant = computed(() => {
  return getReadinessStatusBadgeVariant(props.status);
});

function formatDateTime(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const updatedAtLabel = computed(() => formatDateTime(props.updatedAt));
const reviewedAtLabel = computed(() => formatDate(props.lastReviewedAt));

const normalizedWarnings = computed(() => {
  return props.warnings
    .map((warning) => (typeof warning === "string" ? warning.trim() : ""))
    .filter(Boolean);
});
</script>
