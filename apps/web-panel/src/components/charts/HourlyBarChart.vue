<template>
  <div class="relative w-full">
    <div v-if="loading" class="flex items-center justify-center h-56">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!hasData" class="flex items-center justify-center h-56 text-sm text-muted-foreground">Нет данных</div>
    <Bar v-else :data="chartData" :options="chartOptions" class="max-h-56" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const props = defineProps({
  hours: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  mode: { type: String, default: "revenue" },
});

function getCssColor(variable, alpha = 1) {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return alpha < 1 ? `hsla(${hsl}, ${alpha})` : `hsl(${hsl})`;
}

const hasData = computed(() => props.hours.some((h) => h.revenue > 0 || h.orders > 0));

const chartData = computed(() => {
  const labels = props.hours.map((h) => `${String(h.hour).padStart(2, "0")}:00`);
  const data = props.hours.map((h) => (props.mode === "orders" ? h.orders : h.revenue));
  const color = getCssColor("--chart-1");
  const colorFill = getCssColor("--chart-1", 0.8);

  return {
    labels,
    datasets: [
      {
        label: props.mode === "orders" ? "Заказы" : "Выручка",
        data,
        backgroundColor: colorFill,
        hoverBackgroundColor: color,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };
});

const chartOptions = computed(() => ({
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
          const v = ctx.parsed.y;
          return props.mode === "orders" ? ` Заказов: ${v}` : ` ${v.toLocaleString("ru-RU")} ₽`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 10 },
        maxRotation: 0,
      },
    },
    y: {
      grid: { color: "hsl(var(--border))", drawBorder: false },
      border: { display: false },
      beginAtZero: true,
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 11 },
        callback: (v) => (props.mode === "orders" ? v : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v),
      },
    },
  },
}));
</script>
