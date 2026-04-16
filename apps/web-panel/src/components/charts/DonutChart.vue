<template>
  <div class="relative w-full">
    <div v-if="loading" class="flex items-center justify-center h-72">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!hasData" class="flex items-center justify-center h-72 text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="grid h-full items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div class="mx-auto h-52 w-52 self-center">
        <Pie :key="themeVersion" :data="chartData" :options="chartOptions" class="h-full w-full" />
      </div>

      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <div
          v-for="item in channelItems"
          :key="item.name"
          class="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 shadow-sm"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }"></span>
            <span class="truncate text-sm font-semibold text-foreground">{{ item.name }}</span>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-foreground">{{ formatCurrency(item.revenue) }}</div>
            <div class="text-xs text-muted-foreground">{{ item.percent.toFixed(1) }}%</div>
          </div>
        </div>

        <div class="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 sm:col-span-2 lg:col-span-1 2xl:col-span-2">
          <div class="text-sm font-semibold text-foreground">Итого: {{ formatCurrency(totalRevenue) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Pie } from "vue-chartjs";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);

const props = defineProps({
  channels: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
});

const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const themeVersion = ref(0);
let observer = null;

onMounted(() => {
  if (typeof document === "undefined") return;

  observer = new MutationObserver(() => {
    themeVersion.value += 1;
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

function getCssColor(variable, alpha = 1) {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

  if (!rawValue) {
    return alpha < 1 ? `rgba(59, 130, 246, ${alpha})` : "rgb(59, 130, 246)";
  }

  if (rawValue.startsWith("#") || rawValue.startsWith("rgb") || rawValue.startsWith("hsl")) {
    return rawValue;
  }

  return alpha < 1 ? `hsl(${rawValue} / ${alpha})` : `hsl(${rawValue})`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

const hasData = computed(() => Object.keys(props.channels || {}).length > 0);
const channelItems = computed(() => {
  themeVersion.value;

  const items = Object.entries(props.channels || {}).map(([name, data], index) => ({
    name,
    revenue: Number(data?.revenue || 0),
    color: getCssColor(CHART_VARS[index % CHART_VARS.length]),
  }));

  const total = items.reduce((sum, item) => sum + item.revenue, 0);
  return items.map((item) => ({
    ...item,
    percent: total > 0 ? (item.revenue / total) * 100 : 0,
  }));
});
const totalRevenue = computed(() => channelItems.value.reduce((sum, item) => sum + item.revenue, 0));

const chartData = computed(() => ({
  labels: channelItems.value.map((item) => item.name),
  datasets: [
    {
      data: channelItems.value.map((item) => item.revenue),
      backgroundColor: channelItems.value.map((item) => item.color),
      borderColor: getCssColor("--card", 1),
      borderWidth: 1,
      hoverOffset: 6,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: getCssColor("--popover", 1),
      titleColor: getCssColor("--popover-foreground", 1),
      bodyColor: getCssColor("--popover-foreground", 0.9),
      borderColor: getCssColor("--border", 1),
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label(ctx) {
          const total = ctx.dataset.data.reduce((sum, value) => sum + value, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          return `${ctx.label}: ${ctx.parsed.toLocaleString("ru-RU")} ₽ (${pct}%)`;
        },
      },
    },
  },
}));
</script>
