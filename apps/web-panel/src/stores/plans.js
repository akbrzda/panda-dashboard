import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { plansApi } from "@/api/plans";

export const usePlansStore = defineStore("plans", () => {
  const plans = ref([]);
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
    try {
      isSaving.value = true;
      error.value = null;
      const response = await plansApi.deletePlan(id);
      plans.value = plans.value.filter((plan) => plan.id !== id);
      return response.data;
    } catch (e) {
      error.value = e.response?.data?.error || e.message || "Ошибка удаления плана";
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  function getMetricPlan(metric, period, organizationId, currentValue) {
    const normalizedOrgId = organizationId ? String(organizationId) : "";

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
    isLoading,
    isSaving,
    error,
    sortedPlans,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getMetricPlan,
  };
});
