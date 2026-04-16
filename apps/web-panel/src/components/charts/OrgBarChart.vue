<template>
  <div class="relative w-full min-h-[18rem]">
    <div v-if="loading" class="flex items-center justify-center h-72">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!rows.length" class="flex items-center justify-center h-72 text-sm text-muted-foreground">Нет данных</div>
    <div v-else class="space-y-4">
      <div class="h-72 w-full">
        <Bar :key="themeVersion" :data="chartData" :options="chartOptions" class="h-full w-full" />
      </div>

      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="row in rows" :key="row.id" class="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div class="text-sm font-medium text-foreground truncate">{{ row.name }}</div>
          <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ formatCurrency(row.revenue) }}</span>
            <span>{{ formatNumber(row.orders) }} зак.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Bar } from "vue-chartjs";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const props = defineProps({
  orgs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

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

const rows = computed(() => {
  if (!props.orgs.length) return [];

  return [...props.orgs]
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue || 0),
      orders: Number(item.orders || 0),
    }));
});

const chartData = computed(() => {
  themeVersion.value;

  return {
    labels: rows.value.map((row) => row.name),
    datasets: [
      {
        label: "Выручка",
        data: rows.value.map((row) => row.revenue),
        backgroundColor: rows.value.map((_, index) => getCssColor(`--chart-${(index % 5) + 1}`, 0.9)),
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 42,
      },
    ],
  };
});

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
          const row = rows.value[ctx.dataIndex];
          return `${ctx.parsed.y.toLocaleString("ru-RU")} ₽ · ${formatNumber(row?.orders || 0)} зак.`;
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
    y: {
      grid: {
        color: getCssColor("--border", 0.5),
        drawBorder: false,
      },
      border: { display: false },
      ticks: {
        color: getCssColor("--muted-foreground", 1),
        font: { size: 11 },
        callback: (value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value),
      },
    },
  },
}));

function formatCurrency(val) {
  if (!val) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(val);
}
</script>
