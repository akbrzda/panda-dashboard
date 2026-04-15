<template>
  <div class="revenue-charts">
    <div class="chart-container">
      <h3>Выручка по каналам</h3>
      <div class="chart-wrapper">
        <Pie v-if="hasData" :data="pieChartData" :options="pieChartOptions" />
        <div v-else class="no-data">Нет данных</div>
      </div>
    </div>

    <div class="chart-container">
      <h3>Количество заказов по каналам</h3>
      <div class="chart-wrapper">
        <Bar v-if="hasData" :data="barChartData" :options="barChartOptions" />
        <div v-else class="no-data">Нет данных</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Pie, Bar } from "vue-chartjs";
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale } from "chart.js";

// Регистрация компонентов Chart.js
ChartJS.register(Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  revenueByChannel: {
    type: Object,
    required: true,
    default: () => ({}),
  },
});

// Цветовая палитра для каналов
const channelColors = {
  Доставка: "#ff9800",
  Самовынос: "#2196f3",
  Зал: "#4caf50",
  "Яндекс.Еда": "#f44336",
};

const getColor = (channel, index) => {
  return channelColors[channel] || `hsl(${(index * 360) / Object.keys(props.revenueByChannel).length}, 70%, 60%)`;
};

const hasData = computed(() => {
  return Object.keys(props.revenueByChannel).length > 0;
});

// Данные для круговой диаграммы (выручка)
const pieChartData = computed(() => {
  const channels = Object.keys(props.revenueByChannel);
  const revenues = channels.map((channel) => props.revenueByChannel[channel].revenue);
  const colors = channels.map((channel, index) => getColor(channel, index));

  return {
    labels: channels,
    datasets: [
      {
        data: revenues,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };
});

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        padding: 15,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = context.label || "";
          const value = context.parsed || 0;
          const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${label}: ${value.toLocaleString("ru-RU")} ₽ (${percentage}%)`;
        },
      },
    },
  },
};

// Данные для столбчатой диаграммы (заказы)
const barChartData = computed(() => {
  const channels = Object.keys(props.revenueByChannel);
  const orders = channels.map((channel) => props.revenueByChannel[channel].orders);
  const colors = channels.map((channel, index) => getColor(channel, index));

  return {
    labels: channels,
    datasets: [
      {
        label: "Количество заказов",
        data: orders,
        backgroundColor: colors,
        borderWidth: 0,
      },
    ],
  };
});

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const value = context.parsed.y || 0;
          return `Заказов: ${value}`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
    },
  },
};
</script>

<style scoped>
.revenue-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.chart-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-container h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chart-wrapper {
  position: relative;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-data {
  color: #999;
  font-size: 14px;
  text-align: center;
}

@media (max-width: 768px) {
  .revenue-charts {
    grid-template-columns: 1fr;
  }

  .chart-wrapper {
    height: 250px;
  }
}
</style>
