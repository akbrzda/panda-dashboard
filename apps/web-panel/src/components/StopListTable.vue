<template>
  <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div v-if="isLoading" class="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">Загрузка данных...</div>

    <div v-else-if="error" class="px-4 py-6 text-sm text-destructive">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
      <p>Нет данных для отображения</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">Дата создания</th>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">Наименование</th>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">SKU</th>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">Филиал</th>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">Причина</th>
            <th class="px-4 py-3 text-right font-semibold text-muted-foreground">В стопе</th>
            <th class="px-4 py-3 text-left font-semibold text-muted-foreground">Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="index" class="border-t border-border/70 hover:bg-muted/20">
            <td class="px-4 py-3 text-foreground/80 whitespace-nowrap">{{ formatDate(item) }}</td>
            <td class="px-4 py-3 font-medium text-foreground">{{ getProductName(item) }}</td>
            <td class="px-4 py-3 text-foreground/80 whitespace-nowrap">{{ item.sku || item.productCode || "—" }}</td>
            <td class="px-4 py-3 text-foreground/80">{{ item.organizationName || "—" }}</td>
            <td class="px-4 py-3 text-foreground/80">{{ item.reason || "—" }}</td>
            <td class="px-4 py-3 text-right text-foreground tabular-nums">{{ formatDuration(item) }}</td>
            <td class="px-4 py-3">
              <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', getStatusClass(item)]">
                {{ getStatusText(item) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { formatDateTimeWithSeconds } from "../lib/utils";

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
});

const formatDate = (item) => {
  const dateString = item.dateAdd || item.openedAt;
  if (!dateString) return "—";
  return formatDateTimeWithSeconds(dateString);
};

const formatDuration = (item) => {
  const hours = Number(item.inStopHours);
  if (!Number.isFinite(hours) || hours < 0) return "—";

  if (hours >= 24) {
    const days = Number(item.inStopDays);
    if (Number.isFinite(days)) {
      return `${days.toFixed(1)} дн`;
    }
  }

  return `${hours.toFixed(1)} ч`;
};

const getProductName = (item) => {
  if (item.productFullName) return item.productFullName;
  if (item.productName) return item.productName;
  if (item.itemName) return item.itemName;

  if (item.sku) {
    return `SKU: ${item.sku}`;
  }

  if (item.productId) {
    return `ID: ${item.productId.substring(0, 8)}...`;
  }

  return "Товар без названия";
};

const getStatusClass = (item) => {
  if (item.balance > 0) {
    return "bg-emerald-500/15 text-emerald-400";
  }
  return "bg-rose-500/15 text-rose-400";
};

const getStatusText = (item) => {
  if (item.balance > 0) {
    return `Остаток: ${item.balance}`;
  }
  return "В стопе";
};
</script>
