<template>
  <div class="space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Клиентская база</h1>
      <PageFilters :loading="clientsStore.isLoadingClients" :require-organization="false" :show-organization="false" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="pageError" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ pageError }}
    </div>

    <!-- API не настроен -->
    <div
      v-else-if="clientsStore.clientsData && clientsStore.clientsData.configured === false"
      class="flex flex-col items-center justify-center py-16 text-center gap-3"
    >
      <Users class="w-12 h-12 text-muted-foreground/40" />
      <p class="text-sm font-medium text-foreground">API клиентской базы не настроен</p>
      <p class="text-xs text-muted-foreground max-w-sm">
        Задайте переменные <code class="font-mono bg-muted px-1 rounded">PREMIUM_BONUS_API_URL</code> и
        <code class="font-mono bg-muted px-1 rounded">PREMIUM_BONUS_API_KEY</code> в
        <code class="font-mono bg-muted px-1 rounded">backend/.env</code>
      </p>
    </div>

    <!-- Пустое состояние -->
    <div v-else-if="!clientsStore.isLoadingClients && !clientsStore.clientsData" class="flex flex-col items-center justify-center py-16 text-center">
      <Users class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите период и нажмите «Применить»</p>
    </div>

    <!-- Данные -->
    <template v-if="clientsStore.clientsData && clientsStore.clientsData.configured !== false">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Активная база"
          :value="clientsStore.clientsData.activeBase ?? null"
          format="number"
          icon="Users"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Новые клиенты"
          :value="clientsStore.clientsData.newClients ?? null"
          format="number"
          icon="UserPlus"
          :loading="clientsStore.isLoadingClients"
        />
      </div>

      <!-- Группы клиентов -->
      <Card v-if="clientGroups.length > 0" class="p-5">
        <h3 class="text-sm font-semibold text-foreground mb-3">Группы клиентов</h3>
        <div class="space-y-2">
          <div v-for="group in clientGroups" :key="group.id" class="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span class="text-sm text-foreground">{{ group.name }}</span>
            <span class="text-sm font-medium text-foreground tabular-nums">{{ group.count.toLocaleString("ru-RU") }}</span>
          </div>
        </div>
      </Card>

      <Card class="p-5">
        <p class="text-xs text-muted-foreground">
          Данные предоставлены PremiumBonus API. Активная база — суммарное кол-во участников во всех группах.
        </p>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { Users, UserPlus } from "lucide-vue-next";
import { useClientsStore } from "../stores/clients";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import PageFilters from "../components/filters/PageFilters.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import Card from "../components/ui/Card.vue";

const clientsStore = useClientsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const clientGroups = computed(() => clientsStore.clientsData?.groups || []);
const pageError = computed(() => clientsStore.clientsData?.error || clientsStore.error || "");

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? filtersStore.organizationId ?? null;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  filtersStore.setOrganization(organizationId);
  filtersStore.setDateRange(dateFrom, dateTo);
  await clientsStore.loadClients({ dateFrom, dateTo });
}

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (filtersStore.dateFrom && filtersStore.dateTo && !clientsStore.clientsData) {
    await clientsStore.loadClients({
      dateFrom: filtersStore.dateFrom,
      dateTo: filtersStore.dateTo,
    });
  }
});
</script>
