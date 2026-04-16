<template>
  <div class="relative w-full">
    <div v-if="loading" class="flex items-center justify-center h-56">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!hasData" class="flex items-center justify-center h-56 text-sm text-muted-foreground">Нет данных</div>
    <Line v-else :data="chartData" :options="chartOptions" class="max-h-56" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Line } from "vue-chartjs";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const props = defineProps({
  breakdown: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const hasData = computed(() => props.breakdown.length > 0);

// Читаем CSS-переменную --chart-1 как цвет
function getCssColor(variable, alpha = 1) {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return alpha < 1 ? `hsla(${hsl}, ${alpha})` : `hsl(${hsl})`;
}

const chartData = computed(() => {
  const labels = props.breakdown.map((d) => {
    const dt = new Date(d.date);
    return `${String(dt.getUTCDate()).padStart(2, "0")}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const revenues = props.breakdown.map((d) => d.revenue);
  const color = getCssColor("--chart-1");
  const colorFill = getCssColor("--chart-1", 0.12);

  return {
    labels,
    datasets: [
      {
        label: "Выручка",
        data: revenues,
        borderColor: color,
        backgroundColor: colorFill,
        fill: true,
        tension: 0.35,
        pointRadius: revenues.length > 14 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        borderWidth: 2,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  interaction: { mode: "index", intersect: false },
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
          return ` ${ctx.parsed.y.toLocaleString("ru-RU")} ₽`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 11 },
        maxRotation: 0,
      },
      border: { display: false },
    },
    y: {
      grid: {
        color: "hsl(var(--border))",
        drawBorder: false,
      },
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 11 },
        callback: (v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v),
      },
      border: { display: false },
    },
  },
};
</script>
