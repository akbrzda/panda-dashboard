<template>
  <div class="relative">
    <div v-if="loading" class="flex items-center justify-center h-48">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!hasData" class="flex items-center justify-center h-48 text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="flex flex-col items-center gap-4">
      <div class="w-48 h-48">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <!-- Легенда -->
      <div class="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <div v-for="(key, idx) in channelKeys" :key="key" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: chartColors[idx] }"></span>
          <span>{{ key }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Doughnut } from "vue-chartjs";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);

const props = defineProps({
  channels: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
});

const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
function getCssColor(variable) {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return `hsl(${hsl})`;
}

const hasData = computed(() => Object.keys(props.channels).length > 0);
const channelKeys = computed(() => Object.keys(props.channels));
const chartColors = computed(() => channelKeys.value.map((_, i) => getCssColor(CHART_VARS[i % CHART_VARS.length])));

const chartData = computed(() => ({
  labels: channelKeys.value,
  datasets: [
    {
      data: channelKeys.value.map((k) => props.channels[k].revenue),
      backgroundColor: chartColors.value,
      borderWidth: 0,
      hoverOffset: 4,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: "68%",
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "hsl(var(--popover))",
      titleColor: "hsl(var(--popover-foreground))",
      bodyColor: "hsl(var(--muted-foreground))",
      borderColor: "hsl(var(--border))",
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label(ctx) {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          return ` ${ctx.parsed.toLocaleString("ru-RU")} ₽ (${pct}%)`;
        },
      },
    },
  },
};
</script>
