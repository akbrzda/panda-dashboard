<template>
  <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden min-w-0">
    <div v-if="isLoading" class="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">Загрузка данных...</div>

    <div v-else-if="error" class="px-4 py-6 text-sm text-destructive">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
      <p>Нет позиций в стоп-листе по текущим фильтрам.</p>
    </div>

    <div v-else>
      <div class="space-y-3 p-3 md:hidden">
        <article v-for="item in items" :key="item.id" class="rounded-lg border border-border/70 bg-background/70 p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-foreground">{{ item.entityName || "—" }}</p>
              <p class="text-xs text-muted-foreground">{{ formatEntityType(item.entityType) }}</p>
            </div>
            <Badge :variant="item.isInStop ? 'warning' : 'success'">{{ getStatusText(item) }}</Badge>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Подразделение</p>
              <p class="font-medium text-foreground">{{ formatDepartment(item) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">В стопе с</p>
              <p class="font-medium text-foreground">{{ formatStartedAt(item.startedAt) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">В стопе сейчас</p>
              <p class="font-medium text-foreground">{{ formatDuration(item) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2">
              <p class="text-muted-foreground">Баланс / статус</p>
              <p class="font-medium text-foreground">{{ formatBalanceAndStatus(item) }}</p>
            </div>
            <div class="rounded-md bg-muted/40 p-2 col-span-2">
              <p class="text-muted-foreground">Упущенная выручка (оценка)</p>
              <p class="font-medium text-foreground">{{ formatCurrency(item.estimatedLostRevenue) }}</p>
            </div>
          </div>

          <div class="mt-3 flex justify-end">
            <Button variant="outline" size="sm" @click="emit('select', item)">Детали</Button>
          </div>
        </article>
      </div>

      <div class="hidden md:block overflow-auto">
        <div class="min-w-[1220px]">
          <Table class="min-w-full text-sm">
            <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow>
                <TableHead class="text-left font-semibold text-muted-foreground">Позиция</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Тип</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Подразделение</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">В стопе с</TableHead>
                <TableHead class="text-right font-semibold text-muted-foreground">В стопе сейчас</TableHead>
                <TableHead class="text-right font-semibold text-muted-foreground">Упущ. выручка (оценка)</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Баланс / статус</TableHead>
                <TableHead class="text-right font-semibold text-muted-foreground">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in items" :key="item.id" class="border-t border-border/70 hover:bg-muted/20">
                <TableCell class="font-medium text-foreground">{{ item.entityName || "—" }}</TableCell>
                <TableCell class="text-foreground/80">{{ formatEntityType(item.entityType) }}</TableCell>
                <TableCell class="text-foreground/80">{{ formatDepartment(item) }}</TableCell>
                <TableCell class="text-foreground/80 whitespace-nowrap">{{ formatStartedAt(item.startedAt) }}</TableCell>
                <TableCell class="text-right text-foreground tabular-nums">{{ formatDuration(item) }}</TableCell>
                <TableCell class="text-right text-foreground tabular-nums">{{ formatCurrency(item.estimatedLostRevenue) }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <span class="text-foreground/80">{{ formatBalanceAndStatus(item) }}</span>
                    <Badge :variant="item.isInStop ? 'warning' : 'success'">{{ getStatusText(item) }}</Badge>
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <Button variant="outline" size="sm" @click="emit('select', item)">Открыть</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatDateTimeWithSeconds } from "../lib/utils";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

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

const emit = defineEmits(["select"]);

const ENTITY_TYPE_LABEL = {
  product: "Товар",
  modifier: "Модификатор",
  group: "Группа",
};

const formatEntityType = (type) => ENTITY_TYPE_LABEL[type] || "Товар";

const formatStartedAt = (value) => {
  if (!value) return "—";
  return formatDateTimeWithSeconds(value);
};

const formatDuration = (item) => {
  const hours = Number(item.inStopHours);
  const minutes = Number(item.inStopMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "—";
  }

  if (hours >= 24) {
    const days = Number(item.inStopDays);
    if (Number.isFinite(days)) {
      return `${days.toFixed(2)} дн`;
    }
  }

  if (hours >= 1) {
    return `${hours.toFixed(2)} ч`;
  }

  return `${Math.round(minutes)} мин`;
};

const formatDepartment = (item) => {
  const org = item.organizationName || "—";
  const terminalGroup = item.terminalGroupName || "—";
  return `${org} / ${terminalGroup}`;
};

const formatBalanceAndStatus = (item) => {
  const balance = Number(item.balance);
  const balanceLabel = Number.isFinite(balance) ? `${balance}` : "—";
  if (item.status) {
    return `${balanceLabel} / ${item.status}`;
  }
  return balanceLabel;
};

const getStatusText = (item) => (item.isInStop ? "Активен" : "Завершен");

const formatCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(numericValue);
};
</script>
