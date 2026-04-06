<template>
  <div class="kpi-cards">
    <div class="kpi-card">
      <div class="kpi-icon">💰</div>
      <div class="kpi-content">
        <div class="kpi-label">Выручка</div>
        <div class="kpi-value">{{ formatMoney(summary.totalRevenue) }} ₽</div>
        <div v-if="summary.lfl !== null" :class="['kpi-change', lflClass]">
          {{ formatLFL(summary.lfl) }}
        </div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon">📦</div>
      <div class="kpi-content">
        <div class="kpi-label">Заказов</div>
        <div class="kpi-value">{{ summary.totalOrders }}</div>
        <div class="kpi-sublabel">всего</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon">🧾</div>
      <div class="kpi-content">
        <div class="kpi-label">Средний чек</div>
        <div class="kpi-value">{{ formatMoney(summary.avgPerOrder) }} ₽</div>
        <div class="kpi-sublabel">на заказ</div>
      </div>
    </div>

    <div v-if="summary.avgDeliveryTime > 0" class="kpi-card">
      <div class="kpi-icon">🚗</div>
      <div class="kpi-content">
        <div class="kpi-label">Доставка</div>
        <div class="kpi-value">{{ Math.round(summary.avgDeliveryTime) }} мин</div>
        <div class="kpi-sublabel">среднее время</div>
      </div>
    </div>

    <div v-if="summary.avgCookingTime > 0" class="kpi-card">
      <div class="kpi-icon">👨‍🍳</div>
      <div class="kpi-content">
        <div class="kpi-label">Приготовление</div>
        <div class="kpi-value">{{ Math.round(summary.avgCookingTime / 60) }} мин</div>
        <div class="kpi-sublabel">среднее время</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  summary: {
    type: Object,
    required: true,
    default: () => ({
      totalRevenue: 0,
      totalOrders: 0,
      avgPerOrder: 0,
      avgDeliveryTime: 0,
      avgCookingTime: 0,
      lfl: null,
    }),
  },
});

const formatMoney = (value) => {
  if (!value) return "0";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatLFL = (lfl) => {
  if (lfl === null || lfl === undefined) return "N/A";
  const sign = lfl > 0 ? "+" : "";
  return `${sign}${lfl.toFixed(1)}%`;
};

const lflClass = computed(() => {
  const lfl = props.summary.lfl;
  if (lfl === null || lfl === undefined) return "";
  return lfl >= 0 ? "positive" : "negative";
});
</script>

<style scoped>
.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.kpi-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.kpi-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.kpi-content {
  flex: 1;
  min-width: 0;
}

.kpi-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 5px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 5px;
  line-height: 1.2;
  word-break: break-word;
}

.kpi-sublabel {
  font-size: 12px;
  color: #999;
}

.kpi-change {
  font-size: 14px;
  font-weight: 600;
  margin-top: 5px;
}

.kpi-change.positive {
  color: #4caf50;
}

.kpi-change.negative {
  color: #f44336;
}

@media (max-width: 768px) {
  .kpi-cards {
    grid-template-columns: 1fr;
  }

  .kpi-value {
    font-size: 20px;
  }
}
</style>
