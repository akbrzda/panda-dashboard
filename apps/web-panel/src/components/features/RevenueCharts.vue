<template>
  <div class="grid gap-4 md:grid-cols-2">
    <Card>
      <CardHeader class="pb-2">
        <h3 class="text-sm font-semibold text-foreground">Выручка по каналам</h3>
      </CardHeader>
      <CardContent>
        <DonutChart :channels="revenueChannels" :loading="loading" />
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="pb-2">
        <h3 class="text-sm font-semibold text-foreground">Заказы по каналам</h3>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex h-52 items-center justify-center">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <div v-else-if="!hasData" class="flex h-52 items-center justify-center text-sm text-muted-foreground">Нет данных</div>
        <div v-else class="space-y-2 pt-2">
          <div
            v-for="(data, name) in revenueByChannel"
            :key="name"
            class="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2.5"
          >
            <span class="text-sm font-medium text-foreground">{{ name }}</span>
            <div class="text-right">
              <div class="text-sm font-bold text-foreground">{{ data.orders }}</div>
              <div class="text-xs text-muted-foreground">заказов</div>
            </div>
          </div>
          <div class="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <span class="text-sm font-semibold text-foreground">Итого</span>
            <div class="text-right">
              <div class="text-sm font-bold text-foreground">{{ totalOrders }}</div>
              <div class="text-xs text-muted-foreground">заказов</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import DonutChart from "@/components/charts/DonutChart.vue";
import Card from "@/components/ui/Card.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardContent from "@/components/ui/CardContent.vue";

const props = defineProps({
  revenueByChannel: {
    type: Object,
    required: true,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const hasData = computed(() => Object.keys(props.revenueByChannel).length > 0);

const totalOrders = computed(() =>
  Object.values(props.revenueByChannel).reduce((sum, data) => sum + (data.orders ?? 0), 0),
);

const revenueChannels = computed(() => {
  const result = {};
  for (const [name, data] of Object.entries(props.revenueByChannel)) {
    result[name] = { revenue: data.revenue ?? 0 };
  }
  return result;
});
</script>
