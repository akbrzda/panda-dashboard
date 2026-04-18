<template>
  <Card :class="cn('flex h-full flex-col gap-2 border border-border/70 bg-card/95 p-3.5 shadow-sm md:p-4', $props.class)">
    <!-- Состояние загрузки -->
    <template v-if="loading">
      <div class="flex items-center gap-2">
        <div class="h-5 w-5 rounded bg-muted animate-pulse" />
        <div class="h-4 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div class="h-8 w-36 rounded bg-muted animate-pulse" />
      <div class="h-5 w-16 rounded-full bg-muted animate-pulse" />
    </template>

    <!-- Состояние ошибки -->
    <template v-else-if="error">
      <div class="flex items-center gap-2 text-muted-foreground">
        <AlertCircle class="w-4 h-4 text-destructive" />
        <span class="text-sm font-medium">{{ title }}</span>
      </div>
      <p class="text-sm text-destructive">Ошибка загрузки</p>
    </template>

    <!-- Нормальное состояние -->
    <template v-else>
      <!-- Иконка + название -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 text-foreground/80">
          <component :is="iconComponent" class="w-4 h-4 shrink-0" />
          <span class="text-sm font-medium">{{ title }}</span>
        </div>
        <LFLBadge v-if="lfl" :value="lfl.percent" :inverse="inverse" />
      </div>

      <!-- Значение -->
      <div class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {{ formattedValue }}
      </div>

      <!-- Прогресс-бар выполнения плана -->
      <template v-if="plan">
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>План: {{ formatValue(plan.target) }}</span>
            <span :class="planPercentClass">{{ planPercent }}%</span>
          </div>
          <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div :class="cn('h-full rounded-full transition-all', planBarClass)" :style="{ width: `${Math.min(planPercent, 100)}%` }" />
          </div>
        </div>
      </template>
    </template>
  </Card>
</template>

<script setup>
import { computed } from "vue";
import {
  AlertCircle,
  TrendingUp,
  ShoppingCart,
  Truck,
  Store,
  Clock,
  Percent,
  Users,
  UserPlus,
  BarChart2,
  DollarSign,
  Star,
  Factory,
  CalendarCheck,
  Gauge,
} from "lucide-vue-next";
import Card from "@/components/ui/Card.vue";
import LFLBadge from "@/components/metrics/LFLBadge.vue";
import { cn, formatMinutesToHms } from "@/lib/utils";

const ICONS = {
  TrendingUp,
  ShoppingCart,
  Truck,
  Store,
  Clock,
  Percent,
  Users,
  UserPlus,
  BarChart2,
  DollarSign,
  Star,
  Factory,
  CalendarCheck,
  Gauge,
};

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [Number, String], default: null },
  // Готовая строка значения (если нужно кастомное отображение)
  displayValue: { type: String, default: "" },
  // Формат значения: currency | number | percent | time
  format: { type: String, default: "number" },
  // Объект LFL: { percent: Number }
  lfl: { type: Object, default: null },
  // Имя иконки из набора lucide
  icon: { type: String, default: null },
  // Объект плана: { target: Number, current: Number }
  plan: { type: Object, default: null },
  // Инвертировать LFL-цвета
  inverse: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  class: { type: String, default: "" },
});

const iconComponent = computed(() => {
  if (!props.icon) return TrendingUp;
  return ICONS[props.icon] || TrendingUp;
});

function formatValue(val) {
  if (val === null || val === undefined) return "—";

  switch (props.format) {
    case "currency":
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(val);

    case "percent":
      return `${Number(val).toFixed(2)}%`;

    case "time": {
      return formatMinutesToHms(val);
    }

    case "number":
      return new Intl.NumberFormat("ru-RU").format(val);

    default:
      return String(val);
  }
}

const formattedValue = computed(() => {
  if (props.displayValue) return props.displayValue;
  return formatValue(props.value);
});

const planPercent = computed(() => {
  if (!props.plan || !props.plan.target) return 0;
  return Math.round((props.plan.current / props.plan.target) * 100);
});

const planPercentClass = computed(() => {
  const p = planPercent.value;
  if (p >= 90) return "text-success font-semibold";
  if (p >= 70) return "text-warning font-semibold";
  return "text-destructive font-semibold";
});

const planBarClass = computed(() => {
  const p = planPercent.value;
  if (p >= 90) return "bg-success";
  if (p >= 70) return "bg-warning";
  return "bg-destructive";
});
</script>
