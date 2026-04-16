<template>
  <div class="relative w-full min-h-[18rem]">
    <div v-if="loading" class="flex items-center justify-center h-72">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!hasData" class="flex items-center justify-center h-72 text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="h-72 w-full">
      <Line :key="themeVersion" :data="chartData" :options="chartOptions" class="h-full w-full" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Line } from "vue-chartjs";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const props = defineProps({
  breakdown: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  metric: { type: String, default: "revenue" },
  label: { type: String, default: "Выручка" },
  colorVar: { type: String, default: "--chart-1" },
});

const themeVersion = ref(0);
let observer = null;

const hasData = computed(() => props.breakdown.some((item) => Number(item?.revenue || 0) > 0 || Number(item?.orders || 0) > 0));

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

function formatAxisValue(value) {
  if (props.metric === "orders") {
    return value;
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} млн`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }

  return value;
}

const chartData = computed(() => {
  themeVersion.value;

  const labels = props.breakdown.map((item) => {
    const source = String(item.date || "")
      .slice(0, 10)
      .replace(/\./g, "-");
    const [, month = "00", day = "00"] = source.split("-");
    return `${day}.${month}`;
  });

  const points = props.breakdown.map((item) => (props.metric === "orders" ? Number(item.orders || 0) : Number(item.revenue || 0)));
  const lineColor = getCssColor(props.colorVar, 1);
  const fillTop = getCssColor(props.colorVar, 0.35);
  const fillBottom = getCssColor(props.colorVar, 0.03);

  return {
    labels,
    datasets: [
      {
        label: props.label,
        data: points,
        borderColor: lineColor,
        backgroundColor(context) {
          const { chart } = context;
          const { ctx, chartArea } = chart;

          if (!chartArea) {
            return fillTop;
          }

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, fillTop);
          gradient.addColorStop(1, fillBottom);
          return gradient;
        },
        fill: true,
        tension: 0.38,
        borderWidth: 2,
        pointRadius: points.length > 20 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: lineColor,
        pointBorderWidth: 0,
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
      legend: { display: false },
      tooltip: {
        backgroundColor: getCssColor("--popover", 1),
        titleColor: getCssColor("--popover-foreground", 1),
        bodyColor: getCssColor("--popover-foreground", 0.9),
        borderColor: getCssColor("--border", 1),
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label(ctx) {
            if (props.metric === "orders") {
              return `${ctx.parsed.y.toLocaleString("ru-RU")} заказов`;
            }

            return `${ctx.parsed.y.toLocaleString("ru-RU")} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: getCssColor("--muted-foreground", 1),
          font: { size: 11 },
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: {
          color: getCssColor("--border", 0.5),
          drawBorder: false,
        },
        ticks: {
          color: getCssColor("--muted-foreground", 1),
          font: { size: 11 },
          callback: (value) => formatAxisValue(value),
        },
        border: { display: false },
      },
    },
  };
});
</script>
