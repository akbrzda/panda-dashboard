<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    <MetricCard
      title="Выручка"
      :value="summary.totalRevenue"
      format="currency"
      icon="TrendingUp"
      :lfl="summary.lfl !== null ? { percent: summary.lfl } : null"
      :loading="loading"
    />
    <MetricCard title="Заказов" :value="summary.totalOrders" format="number" icon="ShoppingCart" :loading="loading" />
    <MetricCard title="Средний чек" :value="summary.avgPerOrder" format="currency" icon="BarChart2" :loading="loading" />
    <MetricCard v-if="summary.avgDeliveryTime > 0" title="Доставка" :value="summary.avgDeliveryTime" format="time" icon="Truck" :loading="loading" />
    <MetricCard
      v-if="summary.avgCookingTime > 0"
      title="Приготовление"
      :value="summary.avgCookingTime / 60"
      format="time"
      icon="Clock"
      :loading="loading"
    />
  </div>
</template>

<script setup>
import MetricCard from "@/components/metrics/MetricCard.vue";

defineProps({
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
  loading: {
    type: Boolean,
    default: false,
  },
});
</script>
