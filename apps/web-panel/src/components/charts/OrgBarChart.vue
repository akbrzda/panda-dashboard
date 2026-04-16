<template>
  <div>
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-8 rounded bg-muted animate-pulse" />
    </div>
    <div v-else-if="!rows.length" class="flex items-center justify-center h-32 text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="space-y-2.5">
      <div v-for="row in rows" :key="row.id" class="flex items-center gap-3">
        <div class="w-28 shrink-0 text-xs text-muted-foreground truncate text-right">{{ row.name }}</div>
        <div class="flex-1 relative h-7 bg-muted/50 rounded overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 rounded transition-all duration-500"
            :style="{ width: `${row.pct}%`, backgroundColor: `hsl(var(--chart-${(rows.indexOf(row) % 5) + 1}))` }"
          />
          <div class="absolute inset-0 flex items-center px-2 gap-2">
            <span class="text-xs font-medium text-foreground tabular-nums">{{ formatCurrency(row.revenue) }}</span>
            <span class="text-xs text-muted-foreground tabular-nums ml-auto">{{ formatNumber(row.orders) }} зак.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  orgs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const rows = computed(() => {
  if (!props.orgs.length) return [];
  const sorted = [...props.orgs].sort((a, b) => b.revenue - a.revenue);
  const max = sorted[0]?.revenue || 1;
  return sorted.map((o) => ({
    ...o,
    pct: Math.round((o.revenue / max) * 100),
  }));
});

function formatCurrency(val) {
  if (!val) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(val);
}
</script>
