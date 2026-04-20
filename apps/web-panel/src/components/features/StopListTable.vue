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
        <article v-for="item in pagedItems" :key="item.id" class="rounded-lg border border-border/70 bg-background/70 p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-foreground">{{ item.entityName || "—" }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-1">
                <p class="text-xs text-muted-foreground">{{ formatEntityType(item.entityType) }}</p>
                <Badge v-if="item.nameSource === 'fallback'" variant="outline">Удалено из меню</Badge>
              </div>
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
              <p class="text-muted-foreground">Статус</p>
              <p class="font-medium text-foreground">{{ getStatusText(item) }}</p>
            </div>
          </div>
        </article>
      </div>

      <div class="hidden md:block overflow-auto">
        <div class="min-w-[920px]">
          <Table class="min-w-full text-sm">
            <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow>
                <TableHead class="text-left font-semibold text-muted-foreground">Позиция</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Тип</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Подразделение</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">В стопе с</TableHead>
                <TableHead class="text-right font-semibold text-muted-foreground">В стопе сейчас</TableHead>
                <TableHead class="text-left font-semibold text-muted-foreground">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in pagedItems" :key="item.id" class="border-t border-border/70 hover:bg-muted/20">
                <TableCell class="font-medium text-foreground">
                  <div class="flex flex-col gap-1">
                    <span>{{ item.entityName || "—" }}</span>
                    <Badge v-if="item.nameSource === 'fallback'" variant="outline" class="w-fit">Удалено из меню</Badge>
                  </div>
                </TableCell>
                <TableCell class="text-foreground/80">{{ formatEntityType(item.entityType) }}</TableCell>
                <TableCell class="text-foreground/80">{{ formatDepartment(item) }}</TableCell>
                <TableCell class="text-foreground/80 whitespace-nowrap">{{ formatStartedAt(item.startedAt) }}</TableCell>
                <TableCell class="text-right text-foreground tabular-nums">{{ formatDuration(item) }}</TableCell>
                <TableCell>
                  <Badge :variant="item.isInStop ? 'warning' : 'success'">{{ getStatusText(item) }}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div class="p-3 pt-0">
        <PaginationControls
          v-if="items.length > 0"
          :current-page="currentPage"
          :total-pages="totalPages"
          :total-items="items.length"
          :range-start="rangeStart"
          :range-end="rangeEnd"
          :loading="isLoading"
          @prev="goToPrevPage"
          @next="goToNextPage"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { formatDateTimeWithSeconds } from "@/lib/utils";
import Badge from "@/components/ui/Badge.vue";
import PaginationControls from "@/components/ui/PaginationControls.vue";
import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const props = defineProps({
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

const currentPage = ref(1);
const pageSize = 15;
const totalPages = computed(() => Math.max(1, Math.ceil(props.items.length / pageSize)));
const rangeStart = computed(() => (props.items.length ? (currentPage.value - 1) * pageSize + 1 : 0));
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, props.items.length));
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return props.items.slice(start, start + pageSize);
});

function goToPrevPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1;
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1;
  }
}

watch(
  () => props.items,
  () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  },
  { deep: true },
);

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
  const terminalGroup = String(item.terminalGroupName || "").trim();
  if (!terminalGroup) return "—";
  return terminalGroup.split("/")[0].trim() || terminalGroup;
};

const getStatusText = (item) => (item.isInStop ? "Активен" : "Завершен");
</script>
