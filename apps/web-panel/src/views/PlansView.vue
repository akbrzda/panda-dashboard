<template>
  <div class="space-y-6">
    <ReportPageHeader
      title="Планы"
      description="Управление целями по KPI и прогрессом выполнения."
      :status="readiness.status"
      :tier="readiness.tier"
      :source="readiness.source"
      :coverage="trustCoverage"
      :updated-at="lastLoadedAt"
      :last-reviewed-at="readiness.lastReviewedAt"
      :warnings="readiness.knownLimitations"
    />

    <div v-if="plansStore.error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ plansStore.error }}
    </div>

    <Card class="overflow-hidden">
      <div class="border-b border-border px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">Сохраненные месячные планы выручки</h2>
      </div>

      <div v-if="plansStore.isLoading" class="space-y-2 p-4">
        <div v-for="i in 6" :key="i" class="h-11 rounded bg-muted animate-pulse" />
      </div>

      <div v-else-if="!monthlyPlans.length" class="p-8 text-center text-sm text-muted-foreground">Сохраненных месячных планов пока нет</div>

      <div v-else class="table-shell">
        <Table class="w-full text-sm">
          <TableHeader>
            <TableRow class="border-b border-border bg-muted/50">
              <TableHead class="text-left font-medium text-muted-foreground">Месяц</TableHead>
              <TableHead class="text-left font-medium text-muted-foreground hidden md:table-cell">Подразделение</TableHead>
              <TableHead class="text-right font-medium text-muted-foreground">План, ₽</TableHead>
              <TableHead class="text-right font-medium text-muted-foreground">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="plan in monthlyPlans" :key="plan.id" class="border-b border-border/50 last:border-0">
              <TableCell class="text-foreground">{{ formatMonth(plan.planMonth) }}</TableCell>
              <TableCell class="text-muted-foreground hidden md:table-cell">{{ resolvePlanOrganizationName(plan) }}</TableCell>
              <TableCell class="text-right font-medium text-foreground">{{ formatCurrency(plan.targetValue) }}</TableCell>
              <TableCell class="">
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="destructive" class="h-7 px-2.5 text-xs" @click="handleDelete(plan)">Удалить</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <Card class="p-5">
      <div class="mb-4">
        <h2 class="text-sm font-semibold text-foreground">Месячный план выручки одной суммой</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          Введите общий план на месяц, система автоматически распределит его по дням на основе исторической загрузки.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,260px)_180px_200px_180px_auto] xl:items-end">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">Подразделение</label>
          <Select v-model="monthlyForm.organizationId" :disabled="plansStore.isLoading">
            <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </SelectItem>
          </Select>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">Месяц плана</label>
          <Input v-model="monthlyForm.month" type="month" :disabled="plansStore.isLoading" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">Общий план, ₽</label>
          <Input v-model="monthlyForm.totalRevenue" type="number" min="1" step="1" placeholder="Например, 2800000" :disabled="plansStore.isLoading" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">Окно авто-анализа, дней</label>
          <Input v-model="monthlyForm.analysisDays" type="number" min="7" max="90" step="1" :disabled="plansStore.isLoading" />
        </div>
        <Button class="h-9" :disabled="plansStore.isLoading" @click="calculateMonthlyDistribution">
          {{ plansStore.isLoading ? "Расчет..." : "Рассчитать раскладку" }}
        </Button>
      </div>

        <div v-if="monthlyDistribution" class="mt-5 space-y-4">
        <div class="flex justify-end">
          <Button
            class="h-9"
            :disabled="plansStore.isSaving || isCalculatedPlanSaved"
            @click="saveCalculatedPlan"
          >
            {{ isCalculatedPlanSaved ? "План уже сохранен" : plansStore.isSaving ? "Сохранение..." : "Сохранить рассчитанный план" }}
          </Button>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">Подразделение</p>
            <p class="text-sm font-medium text-foreground">{{ monthlyDistribution.summary?.organizationName }}</p>
          </div>
          <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">Месяц</p>
            <p class="text-sm font-medium text-foreground">{{ monthlyDistribution.summary?.month }}</p>
          </div>
          <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">Общий план</p>
            <p class="text-sm font-medium text-foreground">{{ formatCurrency(monthlyDistribution.summary?.totalRevenue) }}</p>
          </div>
          <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">Авто-анализ</p>
            <p class="text-sm font-medium text-foreground">
              {{ monthlyDistribution.summary?.analysisDateFrom }} - {{ monthlyDistribution.summary?.analysisDateTo }}
            </p>
          </div>
        </div>

        <div class="table-shell">
          <Table class="w-full text-sm">
            <TableHeader>
              <TableRow class="border-b border-border bg-muted/50">
                <TableHead class="text-left font-medium text-muted-foreground">Дата</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">План на день</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">Доля от общего плана</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="day in monthlyDistribution.days || []" :key="day.date" class="border-b border-border/50 last:border-0">
                <TableCell class="text-foreground">{{ formatDate(day.date) }}</TableCell>
                <TableCell class="text-right font-medium text-foreground">{{ formatCurrency(day.dayPlan) }}</TableCell>
                <TableCell class="text-right text-foreground">{{ formatShare(day.sharePercent) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import Card from "@/components/ui/Card.vue";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import Input from "@/components/ui/Input.vue";
import Button from "@/components/ui/Button.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import { toast } from "@/lib/sonner";
import { usePlansStore } from "@/stores/plans";
import { useRevenueStore } from "@/stores/revenue";
import { getFeatureReadiness } from "@/config/featureReadiness";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const plansStore = usePlansStore();
const revenueStore = useRevenueStore();
const route = useRoute();
const lastLoadedAt = ref(null);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => `Все подразделения (${revenueStore.organizations.length || 0})`);
const monthlyForm = reactive({
  organizationId: "",
  month: "",
  totalRevenue: "",
  analysisDays: "28",
});

const monthlyPlans = computed(() =>
  plansStore.sortedPlans.filter((plan) => plan.metric === "revenue" && plan.period === "monthly" && String(plan.planMonth || "").trim()),
);
const monthlyDistribution = computed(() => plansStore.monthlyDistribution);
const isCalculatedPlanSaved = computed(() => {
  const summary = monthlyDistribution.value?.summary;
  if (!summary?.month || !summary?.organizationId) return false;
  return monthlyPlans.value.some(
    (plan) => String(plan.planMonth || "") === String(summary.month) && String(plan.organizationId || "") === String(summary.organizationId),
  );
});

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

async function handleDelete(plan) {
  if (!window.confirm(`Удалить план за ${formatMonth(plan.planMonth)}?`)) {
    return;
  }

  try {
    await plansStore.deletePlan(plan.id);
    toast.success("План удален", "Запись убрана из списка");
    lastLoadedAt.value = new Date();

  } catch (error) {
    toast.error("Не удалось удалить план", error.response?.data?.error || error.message || "Повторите попытку");
  }
}

function normalizeOrganizationName(name, organizationId) {
  const source = String(name || "").trim();
  if (!organizationId) return "Все подразделения";
  if (!source || /^(unknown|неизвестно|null|undefined|-|n\/a)$/i.test(source)) {
    return `Подразделение ${organizationId}`;
  }
  return source;
}

function resolvePlanOrganizationName(plan) {
  const organizationId = String(plan?.organizationId || "").trim();
  if (!organizationId) {
    return "Все подразделения";
  }
  const org = revenueStore.organizations.find((item) => String(item.id) === organizationId);
  return normalizeOrganizationName(org?.name || plan?.organizationName, organizationId);
}

function formatShare(value) {
  return `${Number(value || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatMonth(value) {
  const [year, month] = String(value || "").split("-");
  if (!year || !month) return value || "—";
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function getNextMonthValue() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function saveCalculatedPlan() {
  if (!monthlyDistribution.value) {
    toast.error("Нет расчета", "Сначала рассчитайте месячную раскладку");
    return;
  }

  try {
    await plansStore.saveMonthlyRevenuePlan();
    toast.success("Месячный план сохранен", "Теперь выполнение будет отображаться в отчете по выручке");
    lastLoadedAt.value = new Date();
  } catch (error) {
    toast.error("Не удалось сохранить план", error.response?.data?.error || error.message || "Повторите попытку");
  }
}

async function calculateMonthlyDistribution() {
  const organizationId = monthlyForm.organizationId || revenueStore.currentOrganizationId;
  if (!organizationId) {
    toast.error("Выберите подразделение", "Без подразделения нельзя построить раскладку");
    return;
  }

  const month = String(monthlyForm.month || "").trim() || getNextMonthValue();
  const payload = {
    organizationId,
    month,
    totalRevenue: Number(monthlyForm.totalRevenue),
    analysisDays: Number(monthlyForm.analysisDays || 28),
  };

  try {
    await plansStore.loadMonthlyRevenueDistribution(payload);
    toast.success("Раскладка построена", "Дневной план рассчитан автоматически");
  } catch (error) {
    toast.error("Не удалось построить раскладку", error.response?.data?.error || error.message || "Проверьте параметры");
  }
}

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  await plansStore.loadPlans();
  lastLoadedAt.value = new Date();

  if (!monthlyForm.organizationId) {
    monthlyForm.organizationId = revenueStore.currentOrganizationId || revenueStore.organizations[0]?.id || "";
  }
  if (!monthlyForm.month) {
    monthlyForm.month = getNextMonthValue();
  }
});
</script>
