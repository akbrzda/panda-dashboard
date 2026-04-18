<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Клиентская аналитика</h1>
      <PageFilters :loading="clientsStore.isLoadingClients" @apply="handleApply" />

      <Card class="p-4 md:p-5">
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] xl:items-end">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Terminal group</label>
            <Select v-model="terminalGroupValue" placeholder="Все группы">
              <SelectItem value="__all__">Все группы</SelectItem>
              <SelectItem v-for="group in terminalGroupOptions" :key="group.id" :value="group.id">
                {{ group.id }} ({{ formatNumber(group.count) }})
              </SelectItem>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-medium text-muted-foreground">Статусы</label>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="status in statusOptions"
                :key="status.status"
                size="sm"
                :variant="selectedStatuses.includes(status.status) ? 'default' : 'outline'"
                @click="toggleStatus(status.status)"
              >
                {{ status.status }}
                <span class="text-[10px] opacity-70">{{ formatNumber(status.count) }}</span>
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">Если ничего не выбрано, backend учитывает завершенные заказы и исключает отмененные.</p>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" :variant="includeProfile ? 'default' : 'outline'" @click="toggleProfiles">
              {{ includeProfile ? "Профиль включен" : "Без профиля" }}
            </Button>
            <Button size="sm" variant="secondary" @click="handleRefresh">Обновить без кэша</Button>
          </div>
        </div>

        <div v-if="includeProfile" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,180px)_120px]">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Режим enrichment</label>
            <Select v-model="profileMode" placeholder="top">
              <SelectItem value="top">Топ клиенты</SelectItem>
              <SelectItem value="all">Все клиенты</SelectItem>
            </Select>
          </div>
          <div v-if="profileMode === 'top'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Лимит профилей</label>
            <Input v-model="profileLimitInput" type="number" min="1" max="200" placeholder="20" />
          </div>
        </div>
      </Card>
    </div>

    <div v-if="pageError" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ pageError }}
    </div>

    <div v-else-if="clientsStore.isLoadingClients && !report" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard title="Уникальные клиенты" :loading="true" />
      <MetricCard title="Новые клиенты" :loading="true" />
      <MetricCard title="Выручка" :loading="true" />
    </div>

    <div v-else-if="!clientsStore.isLoadingClients && !report" class="flex flex-col items-center justify-center py-16 text-center">
      <Users class="mb-4 h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <template v-else-if="report">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          title="Уникальные клиенты"
          :value="report.summary?.uniqueClients"
          format="number"
          icon="Users"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Новые клиенты"
          :value="report.summary?.newClients"
          format="number"
          icon="UserPlus"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Повторные клиенты"
          :value="report.summary?.returningClients"
          format="number"
          icon="BarChart2"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Спящие клиенты"
          :value="report.summary?.sleepingClients"
          format="number"
          icon="Clock"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Выручка"
          :value="report.summary?.totalRevenue"
          format="currency"
          icon="DollarSign"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Средний чек"
          :value="report.summary?.avgCheck"
          format="currency"
          icon="ShoppingCart"
          :loading="clientsStore.isLoadingClients"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card class="p-4 md:p-5">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-foreground">Сегменты</h3>
            <Badge variant="outline">{{ report.clients?.length || 0 }} клиентов</Badge>
          </div>
          <div class="space-y-2">
            <div
              v-for="segment in report.segments || []"
              :key="segment.segment"
              class="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
            >
              <span class="text-sm text-foreground">{{ getSegmentLabel(segment.segment) }}</span>
              <Badge :variant="getSegmentBadgeVariant(segment.segment)">{{ formatNumber(segment.count) }}</Badge>
            </div>
          </div>
          <div class="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>Источник: iiko Cloud deliveries.</p>
            <p>Период: {{ report.filters?.from?.slice(0, 10) }} - {{ report.filters?.to?.slice(0, 10) }}</p>
            <p>Порог сна: {{ report.meta?.sleepingThresholdDays || 30 }} дней.</p>
            <p v-if="report.meta?.profilesRequested">Обогащено профилей: {{ formatNumber(report.meta.profilesRequested) }}</p>
          </div>
        </Card>

        <Card class="p-4 md:p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-foreground">Клиенты</h3>
            <div class="flex flex-wrap gap-2">
              <Badge v-if="report.filters?.terminalGroupId" variant="outline">TG: {{ report.filters.terminalGroupId }}</Badge>
              <Badge v-if="selectedStatuses.length > 0" variant="outline">Статусов: {{ selectedStatuses.length }}</Badge>
            </div>
          </div>
          <div class="table-shell">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Телефон</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                  <TableHead class="text-left font-medium">Средний чек</TableHead>
                  <TableHead class="text-left font-medium">Частота</TableHead>
                  <TableHead class="text-left font-medium">Последний заказ</TableHead>
                  <TableHead class="text-left font-medium">Сегмент</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="client in visibleClients" :key="client.clientKey" class="border-t border-border/50 align-top">
                  <TableCell class="text-foreground">
                    <div class="flex flex-col gap-1">
                      <span>{{ client.phone || client.clientKey }}</span>
                      <span v-if="client.profile?.name || client.profile?.surname" class="text-[11px] text-muted-foreground">
                        {{ [client.profile?.name, client.profile?.surname].filter(Boolean).join(" ") }}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(client.ordersCount) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(client.revenue) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(client.avgCheck) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatDecimal(client.orderFrequency) }}</TableCell>
                  <TableCell class="text-foreground">
                    <div class="flex flex-col gap-1">
                      <span>{{ formatDateTime(client.lastOrderAt) }}</span>
                      <span class="text-[11px] text-muted-foreground">{{ formatSleepingLabel(client.daysSinceLastOrder) }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-foreground">
                    <Badge :variant="getSegmentBadgeVariant(client.segment)">{{ getSegmentLabel(client.segment) }}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Users } from "lucide-vue-next";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import PageFilters from "../components/filters/PageFilters.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import Card from "../components/ui/Card.vue";
import Input from "../components/ui/Input.vue";
import Select from "../components/ui/Select.vue";
import SelectItem from "../components/ui/SelectItem.vue";
import { useClientsStore } from "../stores/clients";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const DEFAULT_STATUS_OPTIONS = [
  { status: "Delivered", count: 0 },
  { status: "Closed", count: 0 },
  { status: "Completed", count: 0 },
  { status: "Доставлен", count: 0 },
];

const clientsStore = useClientsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const selectedStatuses = ref([]);
const includeProfile = ref(false);
const profileMode = ref("top");
const profileLimitInput = ref("20");
const terminalGroupValue = ref("__all__");

let applyTimer = null;

const report = computed(() => clientsStore.clientsData);
const pageError = computed(() => clientsStore.error || "");
const terminalGroupOptions = computed(() => report.value?.meta?.availableTerminalGroups || []);
const statusOptions = computed(() => {
  const dynamicOptions = report.value?.meta?.availableStatuses || [];
  if (dynamicOptions.length === 0) return DEFAULT_STATUS_OPTIONS;

  const optionMap = new Map(DEFAULT_STATUS_OPTIONS.map((item) => [item.status, item]));
  for (const option of dynamicOptions) {
    optionMap.set(option.status, option);
  }
  return [...optionMap.values()];
});
const visibleClients = computed(() => (report.value?.clients || []).slice(0, 200));

function getProfileLimit() {
  const parsed = Number.parseInt(String(profileLimitInput.value || "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 20;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSleepingLabel(value) {
  if (value == null) return "Нет данных";
  return `${formatNumber(value)} дн. назад`;
}

function getSegmentLabel(segment) {
  return (
    {
      new: "Новый",
      returning: "Повторный",
      loyal: "Лояльный",
      vip: "VIP",
      sleeping: "Спящий",
    }[segment] || segment
  );
}

function getSegmentBadgeVariant(segment) {
  return (
    {
      new: "secondary",
      returning: "outline",
      loyal: "success",
      vip: "default",
      sleeping: "warning",
    }[segment] || "outline"
  );
}

async function applyCurrentFilters(extra = {}) {
  const organizationId = revenueStore.currentOrganizationId ?? filtersStore.organizationId ?? null;
  const dateFrom = filtersStore.dateFrom;
  const dateTo = filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) return;

  await clientsStore.loadClients({
    organizationId,
    dateFrom,
    dateTo,
    terminalGroupId: terminalGroupValue.value === "__all__" ? null : terminalGroupValue.value,
    statuses: selectedStatuses.value,
    includeProfile: includeProfile.value,
    profileMode: profileMode.value,
    profileLimit: getProfileLimit(),
    refresh: Boolean(extra.refresh),
  });
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId ?? filtersStore.organizationId ?? null;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  filtersStore.setOrganization(organizationId);
  filtersStore.setDateRange(dateFrom, dateTo);
  await applyCurrentFilters();
}

async function toggleStatus(status) {
  selectedStatuses.value = selectedStatuses.value.includes(status)
    ? selectedStatuses.value.filter((item) => item !== status)
    : [...selectedStatuses.value, status];
  await applyCurrentFilters();
}

async function toggleProfiles() {
  includeProfile.value = !includeProfile.value;
}

async function handleRefresh() {
  await applyCurrentFilters({ refresh: true });
}

function scheduleApply() {
  if (applyTimer) {
    clearTimeout(applyTimer);
  }

  applyTimer = setTimeout(() => {
    applyCurrentFilters();
    applyTimer = null;
  }, 220);
}

watch(
  () => [terminalGroupValue.value, profileMode.value, includeProfile.value, profileMode.value === "top" ? profileLimitInput.value : "all"],
  (_, __, onCleanup) => {
    if (!filtersStore.dateFrom || !filtersStore.dateTo || !revenueStore.currentOrganizationId) {
      return;
    }

    scheduleApply();

    onCleanup(() => {
      if (applyTimer) {
        clearTimeout(applyTimer);
        applyTimer = null;
      }
    });
  },
);

useAutoRefresh(() => {
  if (report.value && revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo) {
    applyCurrentFilters();
  }
});

onBeforeUnmount(() => {
  if (applyTimer) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
});

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo && !report.value) {
    await applyCurrentFilters();
  }
});
</script>
