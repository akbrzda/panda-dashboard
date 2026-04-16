<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Планы</h1>
        <p class="text-sm text-muted-foreground">Управление целями для KPI и прогрессом выполнения.</p>
      </div>

      <button
        class="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        @click="resetForm"
      >
        {{ isEditing ? "Новый план" : "Очистить форму" }}
      </button>
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
            <input
              v-model="form.targetValue"
              type="number"
              min="0"
              step="0.01"
              placeholder="Например, 150000"
              class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:ring-1 focus:ring-ring"
              :disabled="plansStore.isSaving"
            />
          </div>

          <div class="flex gap-2 pt-2">
            <button
              class="h-9 flex-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              :disabled="plansStore.isSaving"
              @click="handleSubmit"
            >
              {{ plansStore.isSaving ? "Сохранение..." : isEditing ? "Сохранить" : "Добавить" }}
            </button>

            <button
              v-if="isEditing"
              class="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              :disabled="plansStore.isSaving"
              @click="resetForm"
            >
              Отмена
            </button>
          </div>
        </div>
      </Card>

      <Card class="overflow-hidden">
        <div class="border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold text-foreground">Список планов</h2>
        </div>

        <div v-if="plansStore.isLoading" class="space-y-2 p-4">
          <div v-for="i in 6" :key="i" class="h-11 rounded bg-muted animate-pulse" />
        </div>

        <div v-else-if="!plans.length" class="p-8 text-center text-sm text-muted-foreground">Планы пока не добавлены</div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/50">
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">Метрика</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">Период</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Подразделение</th>
                <th class="px-4 py-3 text-right font-medium text-muted-foreground">Цель</th>
                <th class="px-4 py-3 text-right font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="plan in plans" :key="plan.id" class="border-b border-border/50 last:border-0">
                <td class="px-4 py-3 text-foreground">{{ getMetricLabel(plan.metric) }}</td>
                <td class="px-4 py-3 text-muted-foreground">{{ getPeriodLabel(plan.period) }}</td>
                <td class="px-4 py-3 text-muted-foreground hidden md:table-cell">{{ plan.organizationName || "Все подразделения" }}</td>
                <td class="px-4 py-3 text-right font-medium text-foreground">{{ formatValue(plan) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button class="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent" @click="startEdit(plan)">Изменить</button>
                    <button
                      class="rounded-md border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                      @click="handleDelete(plan)"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import Card from "@/components/ui/Card.vue";
import Select from "@/components/ui/Select.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import { PERIOD_PRESETS } from "@/composables/usePeriod";
import { toast } from "@/lib/sonner";
import { usePlansStore } from "@/stores/plans";
import { useRevenueStore } from "@/stores/revenue";

const plansStore = usePlansStore();
const revenueStore = useRevenueStore();
const editingId = ref(null);

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
});
</script>
