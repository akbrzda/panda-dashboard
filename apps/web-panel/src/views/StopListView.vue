<template>
  <div class="space-y-6">
    <header class="space-y-4">
      <ReportPageHeader
        title="Стоп-лист"
        description="Актуальные позиции, недоступные в iiko"
        :status="readiness.status"
        :tier="readiness.tier"
        :source="store.meta?.source || readiness.source"
        :coverage="trustCoverage"
        :updated-at="store.generatedAt"
        :last-reviewed-at="readiness.lastReviewedAt"
        :warnings="headerWarnings"
        :show-refresh="true"
        :refreshing="isLoading"
        @refresh="store.loadStopLists({ refresh: true })"
      />

      <div class="flex items-center gap-2">
        <Button class="sm:hidden" variant="outline" size="sm" @click="showFiltersMobile = !showFiltersMobile">
          {{ showFiltersMobile ? "Скрыть фильтры" : "Фильтры" }}
        </Button>
        <Badge v-if="isLive" variant="success">LIVE</Badge>
        <Badge v-if="store.isPartial" variant="warning">PARTIAL</Badge>
      </div>

      <!-- Счётчики позиций -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader class="pb-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Всего позиций</p>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-semibold text-foreground">{{ summary.total }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Уникальных terminal group</p>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-semibold text-foreground">{{ summary.uniqueTerminalGroups }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Дольше 2 часов</p>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-semibold text-foreground">{{ summary.longerThan2Hours }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Дольше 1 дня</p>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-semibold text-foreground">{{ summary.longerThan1Day }}</p>
          </CardContent>
        </Card>
      </section>

      <!-- KPI упущенной выгоды -->
      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium text-foreground">KPI упущенной выгоды</p>
          <Badge variant="outline" class="text-xs font-normal">оценка</Badge>
          <p v-if="lostRevenueMeta" class="text-xs text-muted-foreground">
            · по данным за {{ lostRevenueMeta.lookbackDays }} дн ({{ formatShortDate(lostRevenueMeta.periodDateFrom) }} —
            {{ formatShortDate(lostRevenueMeta.periodDateTo) }})
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <!-- Potential Lost Revenue -->
          <Card>
            <CardHeader class="pb-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Упущенная выручка</p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">Средняя выручка позиции × время в стопе</p>
            </CardHeader>
            <CardContent>
              <p class="text-2xl font-semibold text-foreground">{{ formatCurrency(summary.estimatedLostRevenue) }}</p>
              <p v-if="lostRevenueMeta" class="mt-1 text-xs text-muted-foreground">
                {{ lostRevenueMeta.estimatedLostRevenueItems }} из {{ summary.total }} позиций с данными
              </p>
            </CardContent>
          </Card>

          <!-- Stop-list Duration -->
          <Card>
            <CardHeader class="pb-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Длительность стопов</p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">Сколько позиций остаются недоступными</p>
            </CardHeader>
            <CardContent>
              <p class="text-2xl font-semibold text-foreground">{{ summary.longerThan2Hours }}</p>
              <p class="mt-1 text-xs text-muted-foreground">позиций дольше 2 ч · {{ summary.longerThan1Day }} дольше 1 дня</p>
            </CardContent>
          </Card>

          <!-- Potential Lost Gross Profit -->
          <Card class="opacity-60">
            <CardHeader class="pb-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Потенциальная валовая прибыль</p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">Упущенная выручка × маржинальность позиции</p>
            </CardHeader>
            <CardContent>
              <p class="text-2xl font-semibold text-muted-foreground">—</p>
              <p class="mt-1 text-xs text-muted-foreground">требуется фудкост / маржа по позиции</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" :class="showFiltersMobile ? 'grid' : 'hidden sm:grid'">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Организация</label>
          <Select v-model="selectedOrganizationId" :disabled="isLoading || store.organizationOptions.length === 0">
            <SelectItem v-for="org in store.organizationOptions" :key="org.id" :value="org.id">
              {{ org.name }}
            </SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Terminal group</label>
          <Select v-model="terminalGroupFilter" :disabled="isLoading">
            <SelectItem v-for="option in store.terminalGroupOptions" :key="option.id" :value="option.id">
              {{ option.name }}
            </SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Тип сущности</label>
          <Select v-model="entityTypeFilter" :disabled="isLoading">
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="product">Товар</SelectItem>
            <SelectItem value="modifier">Модификатор</SelectItem>
            <SelectItem value="group">Группа</SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Статус</label>
          <Select v-model="statusFilter" :disabled="isLoading">
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="active">Только активные</SelectItem>
            <SelectItem value="completed">Только завершенные</SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Длительность</label>
          <Select v-model="durationFilter" :disabled="isLoading">
            <SelectItem value="all">Любая</SelectItem>
            <SelectItem value="gt1h">Больше 1 часа</SelectItem>
            <SelectItem value="gt2h">Больше 2 часов</SelectItem>
            <SelectItem value="gt24h">Больше 24 часов</SelectItem>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Поиск по названию</label>
          <Input v-model="searchText" type="text" placeholder="Название, ID, подразделение" class="h-9" />
        </div>
      </section>
    </header>

    <StopListTable :items="filteredItems" :is-loading="isLoading" :error="error" @select="openDetails" />

    <div v-if="selectedItem" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/50" @click="selectedItem = null" />
      <aside class="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-background p-5 shadow-lg">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">Детали позиции</h2>
          <Button variant="outline" size="sm" @click="selectedItem = null">Закрыть</Button>
        </div>

        <div class="space-y-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">Полное имя</p>
            <p class="font-medium text-foreground">{{ selectedItem.entityName || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Организация</p>
            <p class="font-medium text-foreground">{{ selectedItem.organizationName || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Terminal group</p>
            <p class="font-medium text-foreground">{{ selectedItem.terminalGroupName || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Время начала</p>
            <p class="font-medium text-foreground">{{ formatDateTimeWithSeconds(selectedItem.startedAt) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Длительность</p>
            <p class="font-medium text-foreground">{{ formatDuration(selectedItem) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Упущенная выручка (оценка)</p>
            <p class="font-medium text-foreground">{{ formatCurrency(selectedItem.estimatedLostRevenue) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">ID</p>
            <p class="font-mono text-xs text-foreground">{{ selectedItem.id }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Дополнительные поля</p>
            <pre class="mt-1 overflow-x-auto rounded-md border border-border bg-muted/20 p-3 text-xs text-foreground">{{
              JSON.stringify(selectedItem.raw || {}, null, 2)
            }}</pre>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import { useStopListStore } from "../stores/stopList";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";
import { formatDateTimeWithSeconds } from "@/lib/utils";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import StopListTable from "../components/StopListTable.vue";
import Select from "../components/ui/Select.vue";
import SelectItem from "../components/ui/SelectItem.vue";
import Input from "../components/ui/Input.vue";
import Badge from "../components/ui/Badge.vue";
import Button from "../components/ui/Button.vue";
import Card from "../components/ui/Card.vue";
import CardHeader from "../components/ui/CardHeader.vue";
import CardContent from "../components/ui/CardContent.vue";

const store = useStopListStore();
const route = useRoute();
const router = useRouter();

const filteredItems = computed(() => store.filteredItems);
const summary = computed(() => store.summaryCards);
const lostRevenueMeta = computed(() => store.lostRevenueMeta);
const isLoading = computed(() => store.isLoading);
const error = computed(() => store.error);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (store.currentOrganizationId === "all") {
    return `Все подразделения (${store.organizations.length || 0})`;
  }
  const selectedOrganization = store.organizations.find((organization) => String(organization.id) === String(store.currentOrganizationId));
  return selectedOrganization?.name || "Выбранное подразделение";
});
const headerWarnings = computed(() => [...(readiness.value?.knownLimitations || []), ...store.warnings]);
const isLive = ref(false);
const showFiltersMobile = ref(false);
const isSyncingQuery = ref(false);
const selectedItem = ref(null);

const selectedOrganizationId = computed({
  get: () => store.currentOrganizationId,
  set: (value) => store.setCurrentOrganization(value),
});

const searchText = computed({
  get: () => store.filters.search,
  set: (value) => store.setSearch(value),
});

const statusFilter = computed({
  get: () => store.filters.status,
  set: (value) => store.setStatus(value),
});

const terminalGroupFilter = computed({
  get: () => store.filters.terminalGroupId,
  set: (value) => store.setTerminalGroup(value),
});

const entityTypeFilter = computed({
  get: () => store.filters.entityType,
  set: (value) => store.setEntityType(value),
});

const durationFilter = computed({
  get: () => store.filters.duration,
  set: (value) => store.setDuration(value),
});

let eventSource = null;

function formatShortDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(item) {
  const hours = Number(item?.inStopHours);
  const minutes = Number(item?.inStopMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "—";
  }

  if (hours >= 24 && Number.isFinite(Number(item?.inStopDays))) {
    return `${Number(item.inStopDays).toFixed(2)} дн`;
  }

  if (hours >= 1) {
    return `${hours.toFixed(2)} ч`;
  }

  return `${Math.round(minutes)} мин`;
}

function formatCurrency(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function openDetails(item) {
  selectedItem.value = item;
}

function applyQueryState(query) {
  const org = pickQueryValue(query, ["org", "orgs", "organizationId"]);
  const status = pickQueryValue(query, ["status", "statusFilter"]);
  const search = pickQueryValue(query, ["q", "search", "filterText"]);
  const terminalGroupId = pickQueryValue(query, ["tg", "terminalGroupId"]);
  const entityType = pickQueryValue(query, ["type", "entityType"]);
  const duration = pickQueryValue(query, ["duration"]);

  const nextOrg = org || "all";
  if (String(store.currentOrganizationId) !== String(nextOrg)) {
    if ((store.organizations || []).length > 0) {
      store.setCurrentOrganization(nextOrg);
    } else {
      store.currentOrganizationId = nextOrg;
    }
  }

  if (status && ["all", "active", "completed"].includes(status)) {
    store.setStatus(status);
  }

  if (terminalGroupId) {
    store.setTerminalGroup(terminalGroupId);
  }

  if (entityType && ["all", "product", "modifier", "group"].includes(entityType)) {
    store.setEntityType(entityType);
  }

  if (duration && ["all", "gt1h", "gt2h", "gt24h"].includes(duration)) {
    store.setDuration(duration);
  }

  store.setSearch(search || "");
}

function buildCanonicalQuery() {
  const nextQuery = { ...route.query };

  delete nextQuery.orgs;
  delete nextQuery.organizationId;
  delete nextQuery.statusFilter;
  delete nextQuery.search;
  delete nextQuery.filterText;
  delete nextQuery.terminalGroupId;
  delete nextQuery.entityType;

  if (store.currentOrganizationId && store.currentOrganizationId !== "all") {
    nextQuery.org = store.currentOrganizationId;
  } else {
    delete nextQuery.org;
  }

  if (store.filters.status !== "active") {
    nextQuery.status = store.filters.status;
  } else {
    delete nextQuery.status;
  }

  if (store.filters.search.trim()) {
    nextQuery.q = store.filters.search.trim();
  } else {
    delete nextQuery.q;
  }

  if (store.filters.terminalGroupId !== "all") {
    nextQuery.tg = store.filters.terminalGroupId;
  } else {
    delete nextQuery.tg;
  }

  if (store.filters.entityType !== "all") {
    nextQuery.type = store.filters.entityType;
  } else {
    delete nextQuery.type;
  }

  if (store.filters.duration !== "all") {
    nextQuery.duration = store.filters.duration;
  } else {
    delete nextQuery.duration;
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

function connectSSE() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
  eventSource = new EventSource(`${apiBase}/stop-lists/events`);

  eventSource.addEventListener("connected", () => {
    isLive.value = true;
  });

  eventSource.addEventListener("stopListUpdate", () => {
    store.loadStopLists({ refresh: true });
  });

  eventSource.onerror = () => {
    isLive.value = false;
  };
}

useAutoRefresh(() => {
  if (!isLoading.value) {
    store.loadStopLists();
  }
});

onMounted(() => {
  applyQueryState(route.query);
  store.loadOrganizations();
  connectSSE();
});

watch(
  () => [
    store.currentOrganizationId,
    store.filters.search,
    store.filters.status,
    store.filters.terminalGroupId,
    store.filters.entityType,
    store.filters.duration,
  ],
  () => {
    syncQueryState();
  },
);

watch(
  () => route.query,
  (query) => {
    if (isSyncingQuery.value) return;
    applyQueryState(query);
  },
  { deep: true },
);

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
  store.stopAll();
});
</script>
