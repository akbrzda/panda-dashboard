<template>
  <header class="space-y-3 rounded-lg border border-border/70 bg-card/95 p-4 md:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
          <Badge :variant="statusVariant">{{ statusLabel }}</Badge>
        </div>
        <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
      </div>

      <div class="flex items-center gap-2">
        <Button v-if="showRefresh" variant="outline" size="sm" :disabled="refreshing" @click="handleRefresh">
          {{ refreshing ? "Обновление..." : "Обновить" }}
        </Button>
        <Button variant="ghost" size="sm" class="h-8 px-2 text-xs" @click="showMeta = !showMeta">
          <Info class="mr-1 h-3.5 w-3.5" />
          {{ showMeta ? "Скрыть детали" : "Показать детали" }}
        </Button>
      </div>
    </div>

    <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
      <p class="text-[11px] uppercase tracking-wide text-foreground/70">Updated at ({{ timezoneLabel }})</p>
      <p class="mt-1 text-foreground">{{ updatedAtLabel }}</p>
    </div>

    <div v-if="showTimezoneWarning" class="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2.5 text-xs text-yellow-900 dark:text-yellow-200">
      Время в отчете показано в МСК. Ваш часовой пояс: {{ userTimezone }}.
    </div>

    <div v-if="showMeta" class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-md border border-border/60 bg-muted/20 p-2.5">
        <p class="text-[11px] uppercase tracking-wide text-foreground/70">Tier</p>
        <p class="mt-1 text-foreground">{{ tier }}</p>
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
import { computed, ref } from "vue";
import { Info } from "lucide-vue-next";
import { getReadinessStatusBadgeVariant, getReadinessStatusLabel } from "@/config/readinessUi";
import { toast } from "@/lib/sonner";
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
  timezone: { type: String, default: "Europe/Moscow" },
});

const emit = defineEmits(["refresh"]);
const showMeta = ref(false);

const statusLabel = computed(() => getReadinessStatusLabel(props.status));
const statusVariant = computed(() => getReadinessStatusBadgeVariant(props.status));

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
    timeZone: props.timezone || "Europe/Moscow",
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

const timezoneLabel = computed(() => {
  if ((props.timezone || "") === "Europe/Moscow") {
    return "МСК";
  }
  return props.timezone || "UTC";
});

const updatedAtLabel = computed(() => formatDateTime(props.updatedAt));
const reviewedAtLabel = computed(() => formatDate(props.lastReviewedAt));
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const showTimezoneWarning = computed(() => (props.timezone || "Europe/Moscow") === "Europe/Moscow" && userTimezone !== "Europe/Moscow");

const normalizedWarnings = computed(() => {
  return props.warnings
    .map((warning) => (typeof warning === "string" ? warning.trim() : ""))
    .filter(Boolean);
});

function handleRefresh() {
  emit("refresh");
  toast.success("Данные обновлены");
}
</script>
