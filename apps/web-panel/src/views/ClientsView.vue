<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <ReportPageHeader
        title="Клиентская аналитика"
        description="Метрики клиентской базы, сегменты и профиль повторных заказов по выбранному периоду."
        details="Отчет показывает структуру клиентской базы, активность сегментов и вклад клиентов в выручку. Используется для решений по retention и маркетингу."
        :status="readiness.status"
        :tier="readiness.tier"
        :source="readiness.source"
        :coverage="trustCoverage"
        :updated-at="lastLoadedAt"
        :last-reviewed-at="readiness.lastReviewedAt"
        :warnings="readiness.knownLimitations"
        :show-refresh="true"
        :refreshing="clientsStore.isLoadingClients"
        @refresh="handleRefresh"
      />
      <PageFilters :loading="clientsStore.isLoadingClients" @apply="handleApply" />
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
              class="flex cursor-pointer items-center justify-between rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-muted/20"
              :class="selectedSegment === segment.segment ? 'bg-muted/40' : ''"
              @click="selectSegment(segment.segment)"
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
              <Badge v-if="selectedSegment" variant="outline">Сегмент: {{ getSegmentLabel(selectedSegment) }}</Badge>
              <Badge v-if="customerSource" variant="outline">Источник: {{ customerSource }}</Badge>
            </div>
          </div>
          <div class="space-y-2 md:hidden">
            <div
              v-for="client in visibleClients"
              :key="`${client.clientKey}-mobile`"
              class="rounded-lg border border-border/70 bg-background/70 p-3 transition-colors"
              :class="selectedClientKey === client.clientKey ? 'bg-muted/40' : ''"
              @click="selectClient(client.clientKey)"
            >
              <div class="mb-2 flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-foreground">{{ client.phone || client.clientKey }}</p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ [client.profile?.name, client.profile?.surname].filter(Boolean).join(" ") || "Профиль не обогащен" }}
                  </p>
                </div>
                <Badge :variant="getSegmentBadgeVariant(client.segment)">{{ getSegmentLabel(client.segment) }}</Badge>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Заказов</p>
                  <p class="font-medium text-foreground">{{ formatNumber(client.ordersCount) }}</p>
                </div>
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Выручка</p>
                  <p class="font-medium text-foreground">{{ formatCurrency(client.revenue) }}</p>
                </div>
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Средний чек</p>
                  <p class="font-medium text-foreground">{{ formatCurrency(client.avgCheck) }}</p>
                </div>
                <div class="rounded-md bg-muted/40 p-2">
                  <p class="text-muted-foreground">Частота</p>
                  <p class="font-medium text-foreground">{{ formatDecimal(client.orderFrequency) }}</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">
                Последний заказ: {{ formatDateTime(client.lastOrderAt) }} ({{ formatSleepingLabel(client.daysSinceLastOrder) }})
              </p>
            </div>
          </div>
          <div class="table-shell hidden md:block">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader class="sticky top-0 z-10 bg-muted/80 backdrop-blur">
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
                <TableRow
                  v-for="client in visibleClients"
                  :key="client.clientKey"
                  class="cursor-pointer border-t border-border/50 align-top transition-colors hover:bg-muted/20"
                  :class="selectedClientKey === client.clientKey ? 'bg-muted/40' : ''"
                  @click="selectClient(client.clientKey)"
                >
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
          <PaginationControls
            v-if="clientsPagination.totalItems > 0"
            :current-page="clientsPagination.currentPage"
            :total-pages="clientsPagination.totalPages"
            :total-items="clientsPagination.totalItems"
            :range-start="clientsPagination.rangeStart"
            :range-end="clientsPagination.rangeEnd"
            :loading="clientsStore.isLoadingClients"
            @prev="clientsPagination.prevPage"
            @next="clientsPagination.nextPage"
          />
        </Card>
      </div>

      <Card v-if="selectedClient" class="p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-foreground">Карточка клиента</h3>
          <Button type="button" variant="outline" size="sm" @click="openMarketingContext">Открыть источники</Button>
        </div>
        <div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Телефон</p>
            <p class="font-medium text-foreground">{{ selectedClient.phone || selectedClient.clientKey }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Сегмент</p>
            <p class="font-medium text-foreground">{{ getSegmentLabel(selectedClient.segment) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Заказов</p>
            <p class="font-medium text-foreground">{{ formatNumber(selectedClient.ordersCount) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Выручка</p>
            <p class="font-medium text-foreground">{{ formatCurrency(selectedClient.revenue) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Средний чек</p>
            <p class="font-medium text-foreground">{{ formatCurrency(selectedClient.avgCheck) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Последний заказ</p>
            <p class="font-medium text-foreground">{{ formatDateTime(selectedClient.lastOrderAt) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Частота</p>
            <p class="font-medium text-foreground">{{ formatDecimal(selectedClient.orderFrequency) }}</p>
          </div>
          <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs text-muted-foreground">Профиль</p>
            <p class="font-medium text-foreground">
              {{ [selectedClient.profile?.name, selectedClient.profile?.surname].filter(Boolean).join(" ") || "Не обогащен" }}
            </p>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Users } from "lucide-vue-next";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import Card from "../components/ui/Card.vue";
import { useClientsStore } from "../stores/clients";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";
import { usePagination } from "@/composables/usePagination";
import PaginationControls from "@/components/ui/PaginationControls.vue";

const clientsStore = useClientsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();
const route = useRoute();
const router = useRouter();

const lastLoadedAt = ref(null);
const selectedSegment = ref("");
const selectedClientKey = ref("");
const customerSource = ref("");
const isSyncingQuery = ref(false);

const report = computed(() => clientsStore.clientsData);
const pageError = computed(() => clientsStore.error || "");
const readiness = computed(() => getFeatureReadiness(route.path));
const filteredClients = computed(() => {
  const clients = report.value?.clients || [];
  const filteredBySegment = selectedSegment.value ? clients.filter((client) => client.segment === selectedSegment.value) : clients;
  return filteredBySegment;
});
const clientsPagination = usePagination(filteredClients, { pageSize: 20 });
const visibleClients = computed(() => clientsPagination.pageItems.value);
const selectedClient = computed(() => filteredClients.value.find((client) => client.clientKey === selectedClientKey.value) || null);
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

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

  const result = await clientsStore.loadClients({
    organizationId,
    dateFrom,
    dateTo,
    refresh: Boolean(extra.refresh),
  });

  if (result) {
    lastLoadedAt.value = new Date();
  }
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

function selectSegment(segment) {
  selectedSegment.value = selectedSegment.value === segment ? "" : segment;
}

function selectClient(clientKey) {
  selectedClientKey.value = selectedClientKey.value === clientKey ? "" : clientKey;
}

async function handleRefresh() {
  await applyCurrentFilters({ refresh: true });
}

function applyQueryState(query) {
  const segment = pickQueryValue(query, ["segment"]);
  const clientKey = pickQueryValue(query, ["clientKey"]);
  const source = pickQueryValue(query, ["customerSource", "source"]);

  selectedSegment.value = segment || "";
  selectedClientKey.value = clientKey || "";
  customerSource.value = source || "";
}

function buildCanonicalQuery() {
  const nextQuery = { ...route.query };

  delete nextQuery.tg;
  delete nextQuery.statuses;
  delete nextQuery.status;
  delete nextQuery.profiles;
  delete nextQuery.profileMode;
  delete nextQuery.profileLimit;
  delete nextQuery.terminalGroupId;
  delete nextQuery.includeProfile;

  if (selectedSegment.value) {
    nextQuery.segment = selectedSegment.value;
  } else {
    delete nextQuery.segment;
  }

  if (selectedClientKey.value) {
    nextQuery.clientKey = selectedClientKey.value;
  } else {
    delete nextQuery.clientKey;
  }

  if (customerSource.value) {
    nextQuery.customerSource = customerSource.value;
  } else {
    delete nextQuery.customerSource;
  }

  return nextQuery;
}

async function syncQueryState() {
  const nextQuery = buildCanonicalQuery();
  if (JSON.stringify(route.query) === JSON.stringify(nextQuery)) {
    return;
  }

  isSyncingQuery.value = true;
  try {
    await router.replace({ query: nextQuery });
  } finally {
    isSyncingQuery.value = false;
  }
}

watch(
  () => [selectedSegment.value, selectedClientKey.value],
  () => {
    syncQueryState();
  },
);

watch(
  () => selectedSegment.value,
  () => {
    clientsPagination.resetPage();
  },
);

function openMarketingContext() {
  router.push({
    path: "/marketing-sources",
    query: {
      ...route.query,
      source: customerSource.value || undefined,
      drill: "customer-pack-client",
    },
  });
}

watch(
  () => route.query,
  (query) => {
    if (isSyncingQuery.value) return;
    applyQueryState(query);
  },
  { deep: true },
);

useAutoRefresh(() => {
  if (report.value && revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo) {
    applyCurrentFilters();
  }
});

onMounted(async () => {
  applyQueryState(route.query);

  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo && !report.value) {
    await applyCurrentFilters();
  }
});
</script>
