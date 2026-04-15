<template>
  <div class="revenue-table-container">
    <h3>Детализация по каналам</h3>

    <div v-if="isLoading" class="loading">Загрузка данных...</div>

    <div v-else-if="!hasData" class="empty-state">
      <p>Нет данных для отображения</p>
    </div>

    <table v-else class="revenue-table">
      <thead>
        <tr>
          <th>Канал продаж</th>
          <th class="text-right">Выручка, ₽</th>
          <th class="text-right">Заказов</th>
          <th class="text-right">Средний чек, ₽</th>
          <th class="text-right">Доля, %</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, channel) in tableData" :key="channel">
          <td>
            <span class="channel-dot" :style="{ backgroundColor: getChannelColor(channel) }"></span>
            {{ channel }}
          </td>
          <td class="text-right">{{ formatMoney(item.revenue) }}</td>
          <td class="text-right">{{ item.orders }}</td>
          <td class="text-right">{{ formatMoney(item.avgCheck) }}</td>
          <td class="text-right">
            <span class="percentage">{{ item.percentage.toFixed(1) }}%</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td><strong>Итого</strong></td>
          <td class="text-right">
            <strong>{{ formatMoney(totals.revenue) }}</strong>
          </td>
          <td class="text-right">
            <strong>{{ totals.orders }}</strong>
          </td>
          <td class="text-right">
            <strong>{{ formatMoney(totals.avgCheck) }}</strong>
          </td>
          <td class="text-right"><strong>100%</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  revenueByChannel: {
    type: Object,
    required: true,
    default: () => ({}),
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

// Цветовая палитра для каналов
const channelColors = {
  Доставка: "#ff9800",
  Самовынос: "#2196f3",
  Зал: "#4caf50",
  "Яндекс.Еда": "#f44336",
};

const getChannelColor = (channel) => {
  return channelColors[channel] || "#9e9e9e";
};

const hasData = computed(() => {
  return Object.keys(props.revenueByChannel).length > 0;
});

// Подсчет общих итогов
const totals = computed(() => {
  let totalRevenue = 0;
  let totalOrders = 0;

  for (const data of Object.values(props.revenueByChannel)) {
    totalRevenue += data.revenue || 0;
    totalOrders += data.orders || 0;
  }

  return {
    revenue: totalRevenue,
    orders: totalOrders,
    avgCheck: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
});

// Данные таблицы с процентами
const tableData = computed(() => {
  const data = {};
  const totalRevenue = totals.value.revenue;

  for (const [channel, channelData] of Object.entries(props.revenueByChannel)) {
    data[channel] = {
      revenue: channelData.revenue,
      orders: channelData.orders,
      avgCheck: channelData.avgCheck,
      percentage: totalRevenue > 0 ? (channelData.revenue / totalRevenue) * 100 : 0,
    };
  }

  return data;
});

const formatMoney = (value) => {
  if (!value) return "0";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
</script>

<style scoped>
.revenue-table-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.revenue-table-container h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.revenue-table {
  width: 100%;
  border-collapse: collapse;
}

.revenue-table thead th {
  background-color: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  border-bottom: 2px solid #ddd;
}

.revenue-table tbody td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  color: #333;
}

.revenue-table tfoot td {
  padding: 12px;
  border-top: 2px solid #ddd;
  font-size: 14px;
}

.text-right {
  text-align: right !important;
}

.channel-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

.percentage {
  display: inline-block;
  padding: 4px 8px;
  background-color: #e3f2fd;
  border-radius: 4px;
  color: #1976d2;
  font-weight: 500;
}

.total-row {
  background-color: #fafafa;
}

@media (max-width: 768px) {
  .revenue-table {
    font-size: 12px;
  }

  .revenue-table thead th,
  .revenue-table tbody td,
  .revenue-table tfoot td {
    padding: 8px 4px;
  }

  .channel-dot {
    width: 8px;
    height: 8px;
    margin-right: 4px;
  }
}
</style>
