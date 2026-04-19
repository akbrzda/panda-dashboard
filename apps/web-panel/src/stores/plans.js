import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { plansApi } from "@/api/plans";

export const usePlansStore = defineStore("plans", () => {
  const plans = ref([]);
  const monthlyDistribution = ref(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref(null);

  const sortedPlans = computed(() => {
    return [...plans.value].sort((a, b) => {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  });

  async function loadPlans(filters = {}) {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await plansApi.getPlans(filters);
      plans.value = response.data || [];
      return plans.value;
    } catch (e) {
      error.value = e.response?.data?.error || e.message || "Ошибка загрузки планов";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createPlan(payload) {
    try {
      isSaving.value = true;
      error.value = null;
      const response = await plansApi.createPlan(payload);
      await loadPlans();
      return response.data;
    } catch (e) {
      error.value = e.response?.data?.error || e.message || "Ошибка создания плана";
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function updatePlan(id, payload) {
    try {
      isSaving.value = true;
      error.value = null;
      const response = await plansApi.updatePlan(id, payload);
      await loadPlans();
      return response.data;
    } catch (e) {
      error.value = e.response?.data?.error || e.message || "Ошибка обновления плана";
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function deletePlan(id) {
    const previousPlans = [...plans.value];
    try {
      isSaving.value = true;
      error.value = null;
      plans.value = plans.value.filter((plan) => plan.id !== id);
      const response = await plansApi.deletePlan(id);
      return response.data;
    } catch (e) {
      plans.value = previousPlans;
      error.value = e.response?.data?.error || e.message || "Ошибка удаления плана";
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function loadMonthlyRevenueDistribution(payload) {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await plansApi.getMonthlyRevenueDistribution(payload);
      monthlyDistribution.value = response.data || null;
      return monthlyDistribution.value;
    } catch (e) {
      error.value = e.response?.data?.error || e.message || "Ошибка расчета месячной раскладки";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveMonthlyRevenuePlan() {
    const distribution = monthlyDistribution.value;
    const month = String(distribution?.summary?.month || "").trim();
    const organizationId = String(distribution?.summary?.organizationId || "").trim();
    const organizationName = String(distribution?.summary?.organizationName || "").trim();
    const totalRevenue = Number(distribution?.summary?.totalRevenue || 0);

    if (!month || !organizationId || !Number.isFinite(totalRevenue) || totalRevenue <= 0) {
      const error = new Error("Нет рассчитанного месячного плана для сохранения");
      error.statusCode = 400;
      throw error;
    }

    return await createPlan({
      metric: "revenue",
      period: "monthly",
      planMonth: month,
      organizationId,
      organizationName,
      targetValue: totalRevenue,
      distributionDays: Array.isArray(distribution.days) ? distribution.days : [],
    });
  }

  function getMetricPlan(metric, period, organizationId, currentValue, options = {}) {
    const normalizedOrgId = organizationId ? String(organizationId) : "";
    const planMonth = options.planMonth ? String(options.planMonth).trim() : "";

    if (metric === "revenue" && planMonth) {
      const exactMonthlyPlan = plans.value.find(
        (plan) =>
          plan.metric === metric &&
          plan.period === "monthly" &&
          String(plan.planMonth || "") === planMonth &&
          String(plan.organizationId || "") === normalizedOrgId,
      );
      const commonMonthlyPlan = normalizedOrgId
        ? plans.value.find(
            (plan) => plan.metric === metric && plan.period === "monthly" && String(plan.planMonth || "") === planMonth && !String(plan.organizationId || ""),
          )
        : null;

      const monthlyPlan = exactMonthlyPlan || commonMonthlyPlan;
      if (monthlyPlan) {
        return {
          target: Number(monthlyPlan.targetValue) || 0,
          current: Number(currentValue) || 0,
        };
      }
    }

    const exactPlan = plans.value.find(
      (plan) => plan.metric === metric && plan.period === period && String(plan.organizationId || "") === normalizedOrgId,
    );

    const commonPlan = normalizedOrgId
      ? plans.value.find((plan) => plan.metric === metric && plan.period === period && !String(plan.organizationId || ""))
      : null;

    const matchedPlan = exactPlan || commonPlan;

    if (!matchedPlan) {
      return null;
    }

    return {
      target: Number(matchedPlan.targetValue) || 0,
      current: Number(currentValue) || 0,
    };
  }

  return {
    plans,
    monthlyDistribution,
    isLoading,
    isSaving,
    error,
    sortedPlans,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    loadMonthlyRevenueDistribution,
    saveMonthlyRevenuePlan,
    getMetricPlan,
  };
});
