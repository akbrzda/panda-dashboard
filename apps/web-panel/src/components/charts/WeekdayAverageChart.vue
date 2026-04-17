<template>
  <div class="relative w-full min-h-[18rem]">
    <div v-if="loading" class="flex h-72 items-center justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
    </div>
    <div v-else-if="!hasData" class="flex h-72 items-center justify-center text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="h-72 w-full">
      <Line :key="themeVersion" :data="chartData" :options="chartOptions" class="h-full w-full" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Line } from "vue-chartjs";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const props = defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const themeVersion = ref(0);
let observer = null;

const hasData = computed(() => props.rows.some((item) => Number(item.avgOrders || 0) > 0 || Number(item.avgRevenue || 0) > 0));

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

function withAlpha(color, alpha) {
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }

  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  return color;
}

function getCssColor(variable, alpha = 1) {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

  if (!rawValue) {
    return alpha < 1 ? `rgba(59, 130, 246, ${alpha})` : "rgb(59, 130, 246)";
  }

  if (rawValue.startsWith("#") || rawValue.startsWith("rgb") || rawValue.startsWith("hsl")) {
    return alpha < 1 ? withAlpha(rawValue, alpha) : rawValue;
  }

  return alpha < 1 ? `hsl(${rawValue} / ${alpha})` : `hsl(${rawValue})`;
}

const chartData = computed(() => {
  themeVersion.value;

  return {
    labels: props.rows.map((row) => row.weekday),
    datasets: [
      {
        label: "Среднее количество заказов",
        yAxisID: "ordersAxis",
        data: props.rows.map((row) => Number(row.avgOrders || 0)),
        borderColor: getCssColor("--chart-2", 1),
        backgroundColor: getCssColor("--chart-2", 0.2),
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: "Средняя выручка",
        yAxisID: "revenueAxis",
        data: props.rows.map((row) => Number(row.avgRevenue || 0)),
        borderColor: getCssColor("--chart-1", 1),
        backgroundColor: getCssColor("--chart-1", 0.2),
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
});

const chartOptions = computed(() => {
  themeVersion.value;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: getCssColor("--foreground", 1),
          boxWidth: 20,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: "line",
        },
      },
      tooltip: {
        backgroundColor: getCssColor("--popover", 1),
        titleColor: getCssColor("--popover-foreground", 1),
        bodyColor: getCssColor("--popover-foreground", 0.9),
        borderColor: getCssColor("--border", 1),
        borderWidth: 1,
        callbacks: {
          label(context) {
            if (context.dataset.yAxisID === "ordersAxis") {
              return `${context.parsed.y.toLocaleString("ru-RU")} заказов`;
            }
            return `${context.parsed.y.toLocaleString("ru-RU")} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: getCssColor("--muted-foreground", 1),
          font: { size: 11 },
        },
      },
      ordersAxis: {
        type: "linear",
        position: "left",
        grid: {
          color: getCssColor("--border", 0.45),
          drawBorder: false,
        },
        ticks: {
          color: getCssColor("--muted-foreground", 1),
          font: { size: 11 },
        },
        border: { display: false },
      },
      revenueAxis: {
        type: "linear",
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: getCssColor("--muted-foreground", 1),
          font: { size: 11 },
          callback: (value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value),
        },
        border: { display: false },
      },
    },
  };
});
</script>
