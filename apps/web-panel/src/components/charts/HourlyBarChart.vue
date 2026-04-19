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
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

const props = defineProps({
  hours: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

function getCssColor(variable, alpha = 1) {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return alpha < 1 ? `hsla(${hsl}, ${alpha})` : `hsl(${hsl})`;
}

const hasData = computed(() => props.hours.some((h) => Number(h?.revenue || 0) > 0 || Number(h?.orders || 0) > 0));

const chartData = computed(() => {
  const labels = props.hours.map((h) => `${String(h.hour).padStart(2, "0")}:00`);
  const revenue = props.hours.map((h) => Number(h?.revenue || 0));
  const orders = props.hours.map((h) => Number(h?.orders || 0));

  return {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Выручка",
        yAxisID: "revenueAxis",
        data: revenue,
        backgroundColor: getCssColor("--chart-1", 0.75),
        hoverBackgroundColor: getCssColor("--chart-1", 1),
        borderRadius: 4,
        borderSkipped: false,
        order: 2,
      },
      {
        type: "line",
        label: "Заказы",
        yAxisID: "ordersAxis",
        data: orders,
        borderColor: getCssColor("--chart-2", 1),
        backgroundColor: getCssColor("--chart-2", 0.25),
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: false,
        order: 1,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      display: true,
      labels: {
        color: "hsl(var(--foreground))",
        usePointStyle: true,
      },
    },
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
          if (ctx.dataset.yAxisID === "ordersAxis") {
            return ` Заказы: ${v.toLocaleString("ru-RU")}`;
          }
          return ` Выручка: ${v.toLocaleString("ru-RU")} ₽`;
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
    ordersAxis: {
      type: "linear",
      position: "left",
      grid: { color: "hsl(var(--border))", drawBorder: false },
      border: { display: false },
      beginAtZero: true,
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 11 },
        callback: (v) => Number(v).toLocaleString("ru-RU"),
      },
    },
    revenueAxis: {
      type: "linear",
      position: "right",
      grid: { drawOnChartArea: false },
      border: { display: false },
      beginAtZero: true,
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: { size: 11 },
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
      },
    },
  },
}));
</script>
