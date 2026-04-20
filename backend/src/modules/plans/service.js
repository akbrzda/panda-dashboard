const plansRepository = require("./repository");
const olapRepository = require("../shared/olapRepository");
const organizationsService = require("../organizations/service");

const DEFAULT_MONTHLY_ANALYSIS_DAYS = Number(process.env.PLANS_MONTHLY_ANALYSIS_DAYS || 28);
const UNKNOWN_NAME_TOKENS = new Set(["unknown", "неизвестно", "n/a", "null", "undefined", "-"]);
const DEFAULT_WEEKDAY_PROFILE = {
  1: 0.95,
  2: 0.98,
  3: 1.0,
  4: 1.05,
  5: 1.12,
  6: 1.25,
  7: 1.15,
};

class PlansService {
  normalizeOrganizationName(name, organizationId = "") {
    const normalizedName = String(name || "").trim();
    const normalizedId = String(organizationId || "").trim();

    if (!normalizedId) {
      return "Все подразделения";
    }

    if (!normalizedName) {
      return `Подразделение ${normalizedId}`;
    }

    const lowered = normalizedName.toLowerCase();
    if (UNKNOWN_NAME_TOKENS.has(lowered)) {
      return `Подразделение ${normalizedId}`;
    }

    return normalizedName;
  }

  normalizeAnalysisDays(value) {
    const parsed = Number.parseInt(String(value || DEFAULT_MONTHLY_ANALYSIS_DAYS), 10);
    if (!Number.isInteger(parsed)) return DEFAULT_MONTHLY_ANALYSIS_DAYS;
    return Math.min(90, Math.max(7, parsed));
  }

  parseMonthStart(month) {
    const normalized = String(month || "").trim();
    const match = normalized.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      const error = new Error("Параметр month должен быть в формате YYYY-MM");
      error.statusCode = 400;
      throw error;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    if (!Number.isFinite(monthStart.getTime())) {
      const error = new Error("Некорректный month");
      error.statusCode = 400;
      throw error;
    }

    return monthStart;
  }

  toDateOnly(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  formatDateOnly(date) {
    return date.toISOString().slice(0, 10);
  }

  buildMonthDays(monthStart) {
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0)).getUTCDate();
    const days = [];

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      days.push(date);
    }

    return days;
  }

  toWeekdayWeights(orders = []) {
    const map = new Map();
    const global = { revenue: 0, ordersCount: 0, days: new Set() };

    for (const order of orders) {
      const weekdayIndex = Number(order.weekdayIndex || 0);
      const date = String(order.date || "").trim();
      if (weekdayIndex < 1 || weekdayIndex > 7 || !date) continue;

      if (!map.has(weekdayIndex)) {
        map.set(weekdayIndex, { revenue: 0, ordersCount: 0, days: new Set() });
      }

      const bucket = map.get(weekdayIndex);
      bucket.revenue += Number(order.revenue || 0);
      bucket.ordersCount += 1;
      bucket.days.add(date);
      global.revenue += Number(order.revenue || 0);
      global.ordersCount += 1;
      global.days.add(date);
    }

    const globalRevenueAverage = global.days.size > 0 ? global.revenue / global.days.size : 0;
    const globalOrdersAverage = global.days.size > 0 ? global.ordersCount / global.days.size : 0;

    return {
      hasHistory: global.days.size > 0,
      globalRevenueAverage,
      globalOrdersAverage,
      byWeekday: map,
    };
  }

  splitMonthlyPlan(totalRevenue, weights = []) {
    const normalizedTotal = Number(totalRevenue || 0);
    if (!Number.isFinite(normalizedTotal) || normalizedTotal <= 0) {
      const error = new Error("Общий месячный план должен быть больше нуля");
      error.statusCode = 400;
      throw error;
    }

    const totalWeight = weights.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (totalWeight <= 0) {
      const equalShare = Number((normalizedTotal / Math.max(weights.length, 1)).toFixed(2));
      return weights.map((item, index) => ({
        ...item,
        dayPlan: equalShare,
        sharePercent: Number((100 / Math.max(weights.length, 1)).toFixed(2)),
        _index: index,
      }));
    }

    const distributed = weights.map((item, index) => {
      const share = Number(item.weight || 0) / totalWeight;
      return {
        ...item,
        dayPlan: Number((normalizedTotal * share).toFixed(2)),
        sharePercent: Number((share * 100).toFixed(2)),
        _index: index,
      };
    });

    const currentSum = distributed.reduce((sum, item) => sum + item.dayPlan, 0);
    const delta = Number((normalizedTotal - currentSum).toFixed(2));
    if (distributed.length > 0 && delta !== 0) {
      const last = distributed[distributed.length - 1];
      last.dayPlan = Number((last.dayPlan + delta).toFixed(2));
    }

    return distributed;
  }

  normalizePlanPayload(payload = {}) {
    const metric = String(payload.metric || "").trim();
    const period = String(payload.period || "").trim();
    const targetValue = Number(payload.targetValue);
    const organizationId = payload.organizationId ? String(payload.organizationId).trim() : "";
    const organizationName = this.normalizeOrganizationName(payload.organizationName, organizationId);
    const planMonth = payload.planMonth ? String(payload.planMonth).trim() : "";
    const distributionDays = Array.isArray(payload.distributionDays) ? payload.distributionDays : [];

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

    if (period === "monthly") {
      if (!/^\d{4}-\d{2}$/.test(planMonth)) {
        const error = new Error("Для monthly-плана обязателен planMonth в формате YYYY-MM");
        error.statusCode = 400;
        throw error;
      }
    }

    return {
      metric,
      period,
      organizationId,
      organizationName,
      targetValue,
      planMonth: period === "monthly" ? planMonth : "",
      distributionDays: period === "monthly" ? distributionDays : [],
    };
  }

  matchesFilters(plan, filters = {}) {
    const metric = filters.metric ? String(filters.metric).trim() : "";
    const period = filters.period ? String(filters.period).trim() : "";
    const organizationId = filters.organizationId ? String(filters.organizationId).trim() : "";
    const planMonth = filters.planMonth ? String(filters.planMonth).trim() : "";

    if (metric && plan.metric !== metric) {
      return false;
    }

    if (period && plan.period !== period) {
      return false;
    }

    if (organizationId && String(plan.organizationId || "") !== organizationId) {
      return false;
    }

    if (planMonth && String(plan.planMonth || "") !== planMonth) {
      return false;
    }

    return true;
  }

  async listPlans(filters = {}) {
    const plans = await plansRepository.readAll();

    return plans
      .filter((plan) => this.matchesFilters(plan, filters))
      .map((plan) => ({
        ...plan,
        organizationName: this.normalizeOrganizationName(plan.organizationName, plan.organizationId),
      }))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }

  async createPlan(payload = {}) {
    const plans = await plansRepository.readAll();
    const normalized = this.normalizePlanPayload(payload);

    const duplicate = plans.find(
      (plan) =>
        plan.metric === normalized.metric &&
        plan.period === normalized.period &&
        String(plan.planMonth || "") === String(normalized.planMonth || "") &&
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
        String(plan.planMonth || "") === String(normalized.planMonth || "") &&
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

  async buildMonthlyRevenueDistribution(payload = {}) {
    const organizationId = String(payload.organizationId || "").trim();
    if (!organizationId) {
      const error = new Error("Не указан organizationId");
      error.statusCode = 400;
      throw error;
    }

    const monthStart = this.parseMonthStart(payload.month);
    const totalRevenue = Number(payload.totalRevenue);
    const analysisDays = this.normalizeAnalysisDays(payload.analysisDays);

    if (!Number.isFinite(totalRevenue) || totalRevenue <= 0) {
      const error = new Error("totalRevenue должен быть больше нуля");
      error.statusCode = 400;
      throw error;
    }

    const organizations = await organizationsService.getOrganizations();
    const organization = (organizations || []).find((item) => String(item.id) === organizationId);
    const timezone = organization?.timezone || "Europe/Moscow";
    const organizationName = this.normalizeOrganizationName(organization?.name, organizationId);

    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 0, 0, 0, 0));
    const today = this.toDateOnly(new Date());
    const analysisEnd = new Date(Math.min(monthStart.getTime() - 24 * 60 * 60 * 1000, today.getTime() - 24 * 60 * 60 * 1000));

    if (!Number.isFinite(analysisEnd.getTime())) {
      const error = new Error("Не удалось определить исторический период для анализа");
      error.statusCode = 400;
      throw error;
    }

    const analysisStart = new Date(analysisEnd);
    analysisStart.setUTCDate(analysisStart.getUTCDate() - (analysisDays - 1));

    const historicalRows = await olapRepository.getOperationalRowsForPeriod({
      organizationId,
      dateFrom: this.formatDateOnly(analysisStart),
      dateTo: this.formatDateOnly(analysisEnd),
      timezone,
      completedOnly: true,
    });
    const orders = olapRepository.toOrderEntities(historicalRows, timezone);
    const weekdayWeights = this.toWeekdayWeights(orders);
    const monthDays = this.buildMonthDays(monthStart);
    const dayWeights = monthDays.map((date) => {
      const weekdayIndex = (date.getUTCDay() || 7);
      const byWeekday = weekdayWeights.byWeekday.get(weekdayIndex);
      const weekdayRevenueAverage = byWeekday && byWeekday.days.size > 0 ? byWeekday.revenue / byWeekday.days.size : 0;
      const weekdayOrdersAverage = byWeekday && byWeekday.days.size > 0 ? byWeekday.ordersCount / byWeekday.days.size : 0;
      const defaultProfileWeight = DEFAULT_WEEKDAY_PROFILE[weekdayIndex] || 1;
      const weekdayAverage =
        weekdayRevenueAverage > 0
          ? weekdayRevenueAverage
          : weekdayOrdersAverage > 0
            ? weekdayOrdersAverage
            : weekdayWeights.globalRevenueAverage > 0
              ? weekdayWeights.globalRevenueAverage * defaultProfileWeight
              : weekdayWeights.globalOrdersAverage > 0
                ? weekdayWeights.globalOrdersAverage * defaultProfileWeight
                : defaultProfileWeight;

      return {
        date: this.formatDateOnly(date),
        weekdayIndex,
        weight: Number.isFinite(weekdayAverage) && weekdayAverage > 0 ? weekdayAverage : 1,
      };
    });

    const days = this.splitMonthlyPlan(totalRevenue, dayWeights).map((item) => ({
      date: item.date,
      weekdayIndex: item.weekdayIndex,
      dayPlan: item.dayPlan,
      sharePercent: item.sharePercent,
    }));

    return {
      summary: {
        organizationId,
        organizationName,
        month: this.formatDateOnly(monthStart).slice(0, 7),
        totalRevenue: Number(totalRevenue.toFixed(2)),
        analysisWindowDays: analysisDays,
        analysisDateFrom: this.formatDateOnly(analysisStart),
        analysisDateTo: this.formatDateOnly(analysisEnd),
        timezone,
        historyAvailable: weekdayWeights.hasHistory,
      },
      days,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = new PlansService();
