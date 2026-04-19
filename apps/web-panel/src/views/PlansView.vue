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

    <div class="flex justify-end">
      <Button variant="outline" size="sm" @click="resetForm">Очистить форму</Button>
    </div>

    <div v-if="plansStore.error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ plansStore.error }}
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
      <Card class="p-5">
        <h2 class="mb-4 text-sm font-semibold text-foreground">
          {{ isEditing ? "Редактирование плана" : "Новый план" }}
        </h2>

        <div class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Метрика</label>
            <Select v-model="form.metric" :disabled="plansStore.isSaving">
              <SelectItem v-for="option in metricOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </Select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Период</label>
            <Select v-model="form.period" :disabled="plansStore.isSaving">
              <SelectItem v-for="option in periodOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </Select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Подразделение</label>
            <Select v-model="form.organizationId" :disabled="plansStore.isSaving">
              <SelectItem :value="ALL_ORGANIZATIONS">Все подразделения</SelectItem>
              <SelectItem v-for="org in revenueStore.organizations" :key="org.id" :value="org.id">
                {{ org.name }}
              </SelectItem>
            </Select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Целевое значение</label>
            <Input v-model="form.targetValue" type="number" min="0" step="0.01" placeholder="Например, 150000" :disabled="plansStore.isSaving" />
          </div>

          <div class="flex gap-2 pt-2">
            <Button class="h-9 flex-1" :disabled="plansStore.isSaving" @click="handleSubmit">
              {{ plansStore.isSaving ? "Сохранение..." : isEditing ? "Сохранить" : "Добавить" }}
            </Button>

            <Button v-if="isEditing" variant="outline" class="h-9" :disabled="plansStore.isSaving" @click="resetForm"> Отмена </Button>
          </div>
        </div>
      </Card>

      <Card class="overflow-hidden">
        <div v-if="plansStore.isLoading" class="space-y-2 p-4">
          <div v-for="i in 6" :key="i" class="h-11 rounded bg-muted animate-pulse" />
        </div>

        <div v-else-if="!plans.length" class="p-8 text-center text-sm text-muted-foreground">Планы пока не добавлены</div>

        <div v-else class="table-shell">
          <Table class="w-full text-sm">
            <TableHeader>
              <TableRow class="border-b border-border bg-muted/50">
                <TableHead class="text-left font-medium text-muted-foreground">Метрика</TableHead>
                <TableHead class="text-left font-medium text-muted-foreground">Период</TableHead>
                <TableHead class="text-left font-medium text-muted-foreground hidden md:table-cell">Подразделение</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">Цель</TableHead>
                <TableHead class="text-right font-medium text-muted-foreground">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="plan in plans" :key="plan.id" class="border-b border-border/50 last:border-0">
                <TableCell class="text-foreground">{{ getMetricLabel(plan.metric) }}</TableCell>
                <TableCell class="text-muted-foreground">{{ getPeriodLabel(plan.period) }}</TableCell>
                <TableCell class="text-muted-foreground hidden md:table-cell">{{ plan.organizationName || "Все подразделения" }}</TableCell>
                <TableCell class="text-right font-medium text-foreground">{{ formatValue(plan) }}</TableCell>
                <TableCell class="">
                  <div class="flex justify-end gap-2">
                    <Button size="sm" variant="outline" class="h-7 px-2.5 text-xs" @click="startEdit(plan)">Изменить</Button>
                    <Button size="sm" variant="destructive" class="h-7 px-2.5 text-xs" @click="handleDelete(plan)"> Удалить </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
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
import { PERIOD_PRESETS } from "@/composables/usePeriod";
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
const editingId = ref(null);
const lastLoadedAt = ref(null);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => `Все подразделения (${revenueStore.organizations.length || 0})`);

const metricOptions = [
  { value: "revenue", label: "Выручка" },
  { value: "orders", label: "Заказы" },
  { value: "avgPerOrder", label: "Средний чек" },
  { value: "discountSum", label: "Дисконт" },
  { value: "foodcost", label: "Фудкост" },
];

const periodOptions = PERIOD_PRESETS;
const ALL_ORGANIZATIONS = "__all_organizations__";

const form = reactive({
  metric: "revenue",
  period: "current-month",
  organizationId: ALL_ORGANIZATIONS,
  targetValue: "",
});

const plans = computed(() => plansStore.sortedPlans);
const isEditing = computed(() => Boolean(editingId.value));

function resetForm() {
  editingId.value = null;
  form.metric = "revenue";
  form.period = "current-month";
  form.organizationId = ALL_ORGANIZATIONS;
  form.targetValue = "";
}

function getMetricLabel(metric) {
  return metricOptions.find((option) => option.value === metric)?.label || metric;
}

function getPeriodLabel(period) {
  return periodOptions.find((option) => option.value === period)?.label || period;
}

function getFormat(metric) {
  if (["revenue", "avgPerOrder", "discountSum"].includes(metric)) {
    return "currency";
  }

  if (metric === "foodcost") {
    return "percent";
  }

  return "number";
}

function formatValue(plan) {
  const value = Number(plan.targetValue) || 0;
  const format = getFormat(plan.metric);

  if (format === "currency") {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
  }

  if (format === "percent") {
    return `${value.toFixed(2)}%`;
  }

  return new Intl.NumberFormat("ru-RU").format(value);
}

function startEdit(plan) {
  editingId.value = plan.id;
  form.metric = plan.metric;
  form.period = plan.period;
  form.organizationId = plan.organizationId || ALL_ORGANIZATIONS;
  form.targetValue = String(plan.targetValue || "");
}

async function handleSubmit() {
  const normalizedOrganizationId = form.organizationId === ALL_ORGANIZATIONS ? "" : form.organizationId;
  const organization = revenueStore.organizations.find((org) => String(org.id) === String(normalizedOrganizationId));
  const payload = {
    metric: form.metric,
    period: form.period,
    organizationId: normalizedOrganizationId,
    organizationName: organization?.name || "Все подразделения",
    targetValue: Number(form.targetValue),
  };

  try {
    if (isEditing.value) {
      await plansStore.updatePlan(editingId.value, payload);
      toast.success("План обновлен", "Изменения сохранены");
    } else {
      await plansStore.createPlan(payload);
      toast.success("План добавлен", "Целевое значение сохранено");
    }
    lastLoadedAt.value = new Date();

    resetForm();
  } catch (error) {
    toast.error("Не удалось сохранить план", error.response?.data?.error || error.message || "Проверьте данные формы");
  }
}

async function handleDelete(plan) {
  if (!window.confirm(`Удалить план «${getMetricLabel(plan.metric)}»?`)) {
    return;
  }

  try {
    await plansStore.deletePlan(plan.id);
    toast.success("План удален", "Запись убрана из списка");
    lastLoadedAt.value = new Date();

    if (editingId.value === plan.id) {
      resetForm();
    }
  } catch (error) {
    toast.error("Не удалось удалить план", error.response?.data?.error || error.message || "Повторите попытку");
  }
}

onMounted(async () => {
  if (!revenueStore.organizations.length) {
    await revenueStore.loadOrganizations();
  }

  await plansStore.loadPlans();
  lastLoadedAt.value = new Date();
});
</script>
