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

      <div class="flex items-center gap-2"><Badge v-if="isLive" variant="success">LIVE</Badge></div>

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

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Организация</label>
          <Select v-model="selectedOrganizationId" :disabled="isLoading || store.organizationOptions.length === 0" placeholder="Выберите организацию">
            <SelectItem v-for="org in store.organizationOptions" :key="org.id" :value="org.id">
              {{ org.name }}
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
          <label class="text-xs font-medium text-muted-foreground">Поиск по названию</label>
          <Input v-model="searchText" type="text" placeholder="Название или подразделение" class="h-9" />
        </div>
      </section>
    </header>

    <StopListTable :items="filteredItems" :is-loading="isLoading" :error="error" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAutoRefresh } from "../composables/useAutoRefresh";
import { useStopListStore } from "../stores/stopList";
import { getFeatureReadiness } from "@/config/featureReadiness";
import { pickQueryValue } from "@/composables/filterQuery";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import StopListTable from "../components/StopListTable.vue";
import Select from "../components/ui/Select.vue";
import SelectItem from "../components/ui/SelectItem.vue";
import Input from "../components/ui/Input.vue";
import Badge from "../components/ui/Badge.vue";
import Card from "../components/ui/Card.vue";
import CardHeader from "../components/ui/CardHeader.vue";
import CardContent from "../components/ui/CardContent.vue";

const store = useStopListStore();
const route = useRoute();
const router = useRouter();

const filteredItems = computed(() => store.filteredItems);
const summary = computed(() => store.summaryCards);
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
const isSyncingQuery = ref(false);

const selectedOrganizationId = computed({
  get: () => store.currentOrganizationId,
  set: (value) => store.setCurrentOrganization(value),
});

const searchText = computed({
  get: () => store.filters.search,
  set: (value) => store.setSearch(value),
});

const entityTypeFilter = computed({
  get: () => store.filters.entityType,
  set: (value) => store.setEntityType(value),
});

let eventSource = null;

function applyQueryState(query) {
  const org = pickQueryValue(query, ["org", "orgs", "organizationId"]);
  const search = pickQueryValue(query, ["q", "search", "filterText"]);
  const entityType = pickQueryValue(query, ["type", "entityType"]);
  const nextOrg = org || store.organizationOptions[0]?.id || store.currentOrganizationId;
  if (nextOrg && String(store.currentOrganizationId) !== String(nextOrg)) {
    store.setCurrentOrganization(nextOrg);
  }

  if (entityType && ["all", "product", "modifier", "group"].includes(entityType)) {
    store.setEntityType(entityType);
  }

  store.setSearch(search || "");
}

function buildCanonicalQuery() {
  const nextQuery = { ...route.query };

  delete nextQuery.orgs;
  delete nextQuery.organizationId;
  delete nextQuery.search;
  delete nextQuery.filterText;
  delete nextQuery.entityType;
  delete nextQuery.statusFilter;
  delete nextQuery.status;
  delete nextQuery.terminalGroupId;
  delete nextQuery.tg;
  delete nextQuery.duration;

  if (store.currentOrganizationId) {
    nextQuery.org = store.currentOrganizationId;
  }

  if (store.filters.search.trim()) {
    nextQuery.q = store.filters.search.trim();
  } else {
    delete nextQuery.q;
  }

  if (store.filters.entityType !== "all") {
    nextQuery.type = store.filters.entityType;
  } else {
    delete nextQuery.type;
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
    store.filters.entityType,
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
