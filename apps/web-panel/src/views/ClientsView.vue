<template>
  <div class="space-y-6">
    <!-- Заголовок + фильтры -->
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-foreground">Клиентская база</h1>
      <PageFilters :loading="clientsStore.isLoadingClients" @apply="handleApply" />
    </div>

    <!-- Ошибка -->
    <div v-if="pageError" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ pageError }}
    </div>

    <div v-else-if="clientsStore.isLoadingClients && !clientsStore.clientsData" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MetricCard title="Активная база" :loading="true" />
      <MetricCard title="Новые клиенты" :loading="true" />
    </div>

    <!-- Пустое состояние -->
    <div v-else-if="!clientsStore.isLoadingClients && !clientsStore.clientsData" class="flex flex-col items-center justify-center py-16 text-center">
      <Users class="w-12 h-12 text-muted-foreground/40 mb-4" />
      <p class="text-sm text-muted-foreground">Выберите организацию и период</p>
    </div>

    <div
      v-else-if="clientsStore.clientsData?.configured === false"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
    >
      Отчёт «Клиенты» не настроен для выбранной организации. Проверьте источник данных и доступность полей клиента в iiko OLAP.
    </div>

    <template v-else-if="clientsStore.clientsData">
      <div
        v-if="clientsStore.clientsData.warningMessage"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
      >
        {{ clientsStore.clientsData.warningMessage }}
      </div>

      <div v-if="hasClientMetrics" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Активная база"
          :value="clientsStore.clientsData.summary?.activeBase ?? clientsStore.clientsData.activeBase ?? null"
          format="number"
          icon="Users"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Новые клиенты"
          :value="clientsStore.clientsData.summary?.newClients ?? clientsStore.clientsData.newClients ?? null"
          format="number"
          icon="UserPlus"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Повторные клиенты"
          :value="clientsStore.clientsData.summary?.repeatClients ?? null"
          format="number"
          icon="Repeat"
          :loading="clientsStore.isLoadingClients"
        />
        <MetricCard
          title="Доля повторных"
          :value="clientsStore.clientsData.summary?.repeatRate ?? null"
          format="percent"
          icon="Percent"
          :loading="clientsStore.isLoadingClients"
        />
      </div>

      <Card v-if="clientGroups.length > 0" class="p-4 md:p-5">
        <h3 class="text-sm font-semibold text-foreground mb-3">Группы клиентов</h3>
        <div class="space-y-2">
          <div v-for="group in clientGroups" :key="group.id" class="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span class="text-sm text-foreground">{{ group.name }}</span>
            <span class="text-sm font-medium text-foreground tabular-nums">{{ group.count.toLocaleString("ru-RU") }}</span>
          </div>
        </div>
      </Card>

      <Card v-if="weeklyRows.length > 0" class="p-4 md:p-5">
        <div class="overflow-x-auto">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Неделя</TableHead>
                <TableHead class="text-left font-medium">Клиентов</TableHead>
                <TableHead class="text-left font-medium">Новых</TableHead>
                <TableHead class="text-left font-medium">Повторных</TableHead>
                <TableHead class="text-left font-medium">Заказов</TableHead>
                <TableHead class="text-left font-medium">Выручка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in weeklyRows" :key="item.weekStart" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ formatWeekLabel(item.weekStart, item.weekEnd) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.totalClients) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.newClients) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.returningClients) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card v-if="topClients.length > 0" class="p-4 md:p-5">
          <div class="overflow-x-auto">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Клиент</TableHead>
                  <TableHead class="text-left font-medium">Телефон</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                  <TableHead class="text-left font-medium">Выручка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="client in topClients" :key="client.clientKey" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ client.clientName }}</TableCell>
                  <TableCell class="text-foreground">{{ client.phone ||"—" }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(client.orders) }}</TableCell>
                  <TableCell class="text-foreground">{{ formatCurrency(client.revenue) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card v-if="newClientsRows.length > 0" class="p-4 md:p-5">
          <div class="overflow-x-auto">
            <Table class="min-w-full border-collapse text-xs">
              <TableHeader>
                <TableRow class="bg-muted/30 text-muted-foreground">
                  <TableHead class="text-left font-medium">Дата первой покупки</TableHead>
                  <TableHead class="text-left font-medium">Клиент</TableHead>
                  <TableHead class="text-left font-medium">Телефон</TableHead>
                  <TableHead class="text-left font-medium">Заказов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="client in newClientsRows" :key="client.clientKey" class="border-t border-border/50">
                  <TableCell class="text-foreground">{{ client.firstOrderDate }}</TableCell>
                  <TableCell class="text-foreground">{{ client.clientName }}</TableCell>
                  <TableCell class="text-foreground">{{ client.phone ||"—" }}</TableCell>
                  <TableCell class="text-foreground">{{ formatNumber(client.orders) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card v-if="hasClientMetrics" class="p-4 md:p-5">
        <p class="text-xs text-muted-foreground">
          Источник данных: iiko OLAP SALES. Для расчета клиентской базы используются доступные в OLAP идентификаторы клиента (телефон/карта/имя).
          Важно: «новый клиент» считается в рамках выбранного периода, так как полный lifetime без CRM не всегда доступен.
        </p>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from"vue";
import { Users } from"lucide-vue-next";
import { useAutoRefresh } from"../composables/useAutoRefresh";
import { useClientsStore } from"../stores/clients";
import { useFiltersStore } from"../stores/filters";
import { useRevenueStore } from"../stores/revenue";
import PageFilters from"../components/filters/PageFilters.vue";
import MetricCard from"../components/metrics/MetricCard.vue";
import Card from"../components/ui/Card.vue";

import Table from"@/components/ui/Table.vue";
import TableBody from"@/components/ui/TableBody.vue";
import TableCell from"@/components/ui/TableCell.vue";
import TableHead from"@/components/ui/TableHead.vue";
import TableHeader from"@/components/ui/TableHeader.vue";
import TableRow from"@/components/ui/TableRow.vue";

const clientsStore = useClientsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();

const clientGroups = computed(() => (clientsStore.clientsData?.groups || []).filter((group) => Number(group.count || 0) > 0));
const weeklyRows = computed(() => clientsStore.clientsData?.weekly || []);
const topClients = computed(() => (clientsStore.clientsData?.topClients || []).slice(0, 15));
const newClientsRows = computed(() => (clientsStore.clientsData?.newClientsList || []).slice(0, 15));
const hasClientMetrics = computed(() => {
  const data = clientsStore.clientsData;
  return (
    Number(data?.summary?.activeBase || data?.activeBase || 0) > 0 ||
    Number(data?.summary?.newClients || data?.newClients || 0) > 0 ||
    Number(data?.summary?.repeatClients || 0) > 0 ||
    clientGroups.value.length > 0 ||
    weeklyRows.value.length > 0
  );
});
const pageError = computed(() => clientsStore.clientsData?.error || clientsStore.error ||"");

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style:"currency", currency:"RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatWeekLabel(weekStart, weekEnd) {
  return `${weekStart} - ${weekEnd}`;
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId ?? filtersStore.organizationId ?? null;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;

  if (!organizationId || !dateFrom || !dateTo) {
    return;
  }

  revenueStore.setCurrentOrganization(organizationId);
  filtersStore.setOrganization(organizationId);
  filtersStore.setDateRange(dateFrom, dateTo);
  await clientsStore.loadClients({ organizationId, dateFrom, dateTo });
}

useAutoRefresh(() => {
  if (revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo && clientsStore.clientsData) {
    handleApply();
  }
});

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  if (revenueStore.currentOrganizationId && filtersStore.dateFrom && filtersStore.dateTo && !clientsStore.clientsData) {
    await clientsStore.loadClients({
      organizationId: revenueStore.currentOrganizationId,
      dateFrom: filtersStore.dateFrom,
      dateTo: filtersStore.dateTo,
    });
  }
});
</script>
