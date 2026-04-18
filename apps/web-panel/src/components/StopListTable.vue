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
      <Table class="min-w-full text-sm">
        <TableHeader class="bg-muted/40">
          <TableRow>
            <TableHead class="text-left font-semibold text-muted-foreground">Дата создания</TableHead>
            <TableHead class="text-left font-semibold text-muted-foreground">Наименование</TableHead>
            <TableHead class="text-left font-semibold text-muted-foreground">SKU</TableHead>
            <TableHead class="text-left font-semibold text-muted-foreground">Филиал</TableHead>
            <TableHead class="text-left font-semibold text-muted-foreground">Причина</TableHead>
            <TableHead class="text-right font-semibold text-muted-foreground">В стопе</TableHead>
            <TableHead class="text-left font-semibold text-muted-foreground">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(item, index) in items" :key="index" class="border-t border-border/70 hover:bg-muted/20">
            <TableCell class="text-foreground/80 whitespace-nowrap">{{ formatDate(item) }}</TableCell>
            <TableCell class="font-medium text-foreground">{{ getProductName(item) }}</TableCell>
            <TableCell class="text-foreground/80 whitespace-nowrap">{{ item.sku || item.productCode ||"—" }}</TableCell>
            <TableCell class="text-foreground/80">{{ item.organizationName ||"—" }}</TableCell>
            <TableCell class="text-foreground/80">{{ item.reason ||"—" }}</TableCell>
            <TableCell class="text-right text-foreground tabular-nums">{{ formatDuration(item) }}</TableCell>
            <TableCell class="">
              <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', getStatusClass(item)]">
                {{ getStatusText(item) }}
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup>
import { formatDateTimeWithSeconds } from"../lib/utils";

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

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

const formatDate = (item) => {
  const dateString = item.dateAdd || item.openedAt;
  if (!dateString) return"—";
  return formatDateTimeWithSeconds(dateString);
};

const formatDuration = (item) => {
  const hours = Number(item.inStopHours);
  if (!Number.isFinite(hours) || hours < 0) return"—";

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

  return"Товар без названия";
};

const getStatusClass = (item) => {
  if (item.balance > 0) {
    return"bg-emerald-500/15 text-emerald-400";
  }
  return"bg-rose-500/15 text-rose-400";
};

const getStatusText = (item) => {
  if (item.balance > 0) {
    return `Остаток: ${item.balance}`;
  }
  return"В стопе";
};
</script>
