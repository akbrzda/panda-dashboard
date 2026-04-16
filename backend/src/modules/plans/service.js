const plansRepository = require("./repository");

class PlansService {
  normalizePlanPayload(payload = {}) {
    const metric = String(payload.metric || "").trim();
    const period = String(payload.period || "").trim();
    const targetValue = Number(payload.targetValue);
    const organizationId = payload.organizationId ? String(payload.organizationId).trim() : "";
    const organizationName = payload.organizationName ? String(payload.organizationName).trim() : "Все подразделения";

    if (!metric) {
      const error = new Error("Не указана метрика плана");
      error.statusCode = 400;
      throw error;
    }

    if (!period) {
      const error = new Error("Не указан период плана");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      const error = new Error("Целевое значение должно быть больше нуля");
      error.statusCode = 400;
      throw error;
    }

    return {
      metric,
      period,
      organizationId,
      organizationName,
      targetValue,
    };
  }

  matchesFilters(plan, filters = {}) {
    const metric = filters.metric ? String(filters.metric).trim() : "";
    const period = filters.period ? String(filters.period).trim() : "";
    const organizationId = filters.organizationId ? String(filters.organizationId).trim() : "";

    if (metric && plan.metric !== metric) {
      return false;
    }

    if (period && plan.period !== period) {
      return false;
    }

    if (organizationId && String(plan.organizationId || "") !== organizationId) {
      return false;
    }

    return true;
  }

  async listPlans(filters = {}) {
    const plans = await plansRepository.readAll();

    return plans
      .filter((plan) => this.matchesFilters(plan, filters))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }

  async createPlan(payload = {}) {
    const plans = await plansRepository.readAll();
    const normalized = this.normalizePlanPayload(payload);

    const duplicate = plans.find(
      (plan) =>
        plan.metric === normalized.metric &&
        plan.period === normalized.period &&
        String(plan.organizationId || "") === String(normalized.organizationId || ""),
    );

    if (duplicate) {
      const error = new Error("План для этой метрики, периода и подразделения уже существует");
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const plan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...normalized,
      createdAt: now,
      updatedAt: now,
    };

    plans.unshift(plan);
    await plansRepository.writeAll(plans);
    return plan;
  }

  async updatePlan(id, payload = {}) {
    const plans = await plansRepository.readAll();
    const index = plans.findIndex((plan) => plan.id === id);

    if (index === -1) {
      const error = new Error("План не найден");
      error.statusCode = 404;
      throw error;
    }

    const normalized = this.normalizePlanPayload(payload);

    const duplicate = plans.find(
      (plan) =>
        plan.id !== id &&
        plan.metric === normalized.metric &&
        plan.period === normalized.period &&
        String(plan.organizationId || "") === String(normalized.organizationId || ""),
    );

    if (duplicate) {
      const error = new Error("План с такими параметрами уже существует");
      error.statusCode = 409;
      throw error;
    }

    const updatedPlan = {
      ...plans[index],
      ...normalized,
      updatedAt: new Date().toISOString(),
    };

    plans[index] = updatedPlan;
    await plansRepository.writeAll(plans);
    return updatedPlan;
  }

  async deletePlan(id) {
    const plans = await plansRepository.readAll();
    const index = plans.findIndex((plan) => plan.id === id);

    if (index === -1) {
      const error = new Error("План не найден");
      error.statusCode = 404;
      throw error;
    }

    const [removedPlan] = plans.splice(index, 1);
    await plansRepository.writeAll(plans);
    return removedPlan;
  }
}

module.exports = new PlansService();
