<template>
  <span :class="badgeClass">
    <component :is="iconComponent" class="w-3 h-3" />
    {{ formattedValue }}
  </span>
</template>

<script setup>
import { computed } from "vue";
import { TrendingUp, TrendingDown, Minus } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps({
  // Числовое значение изменения в процентах (положительное или отрицательное)
  value: { type: Number, required: true },
  // Инвертировать цвета: для метрик, где рост — негатив (время, дисконт)
  inverse: { type: Boolean, default: false },
});

const direction = computed(() => {
  if (props.value > 0) return "up";
  if (props.value < 0) return "down";
  return "neutral";
});

// Положительный ли результат с учётом инверсии
const isPositive = computed(() => {
  if (direction.value === "neutral") return null;
  const growthIsGood = direction.value === "up";
  return props.inverse ? !growthIsGood : growthIsGood;
});

const badgeClass = computed(() => {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";

  if (direction.value === "neutral") {
    return cn(base, "bg-muted text-muted-foreground");
  }

  return isPositive.value ? cn(base, "bg-success/15 text-success") : cn(base, "bg-destructive/15 text-destructive");
});

const iconComponent = computed(() => {
  if (direction.value === "neutral") return Minus;
  return direction.value === "up" ? TrendingUp : TrendingDown;
});

const formattedValue = computed(() => {
  const abs = Math.abs(props.value);
  const sign = props.value > 0 ? "+" : props.value < 0 ? "−" : "";
  return `${sign}${abs.toFixed(1)}%`;
});
</script>
