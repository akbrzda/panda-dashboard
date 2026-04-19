import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { DEFAULT_PERIOD_TIMEZONE, getDateRange, getLFLRange, formatDateISO } from "../composables/usePeriod";

const FILTERS_STORAGE_KEY = "panda_dashboard_filters_v1";
const DEFAULT_OPERATING_DAY_START = "00:00";

function normalizeOperatingDayStart(value) {
  const normalized = String(value || "").trim();
  return /^(\d{2}):(\d{2})$/.test(normalized) ? normalized : DEFAULT_OPERATING_DAY_START;
}

export const useFiltersStore = defineStore("filters", () => {
  const preset = ref("today");
  const customFrom = ref(null);
  const customTo = ref(null);
  const organizationId = ref(null);
  const timezone = ref(DEFAULT_PERIOD_TIMEZONE);
  const operatingDayStart = ref(DEFAULT_OPERATING_DAY_START);
  const completedOnly = ref(true);
  // Пустой массив = все подразделения
  const departments = ref([]);

  const dateRange = computed(() =>
    getDateRange(preset.value, customFrom.value, customTo.value, {
      timezone: timezone.value,
      operatingDayStart: operatingDayStart.value,
    }),
  );

  const lflRange = computed(() => getLFLRange(preset.value, dateRange.value));

  const dateFrom = computed(() => formatDateISO(dateRange.value.from));
  const dateTo = computed(() => formatDateISO(dateRange.value.to));
  const lflDateFrom = computed(() => formatDateISO(lflRange.value.from));
  const lflDateTo = computed(() => formatDateISO(lflRange.value.to));

  function setPreset(value) {
    preset.value = value;
    if (value !== "custom") {
      customFrom.value = null;
      customTo.value = null;
    }
    persistToStorage();
  }

  function setCustomRange(from, to) {
    customFrom.value = from;
    customTo.value = to;
    preset.value = "custom";
    persistToStorage();
  }

  function setDateRange(from, to) {
    if (dateFrom.value === from && dateTo.value === to) {
      return;
    }
    setCustomRange(from, to);
  }

  function setOrganization(id) {
    organizationId.value = id || null;
    persistToStorage();
  }

  function setOrganizationContext(context = {}) {
    timezone.value = String(context.timezone || DEFAULT_PERIOD_TIMEZONE).trim() || DEFAULT_PERIOD_TIMEZONE;
    operatingDayStart.value = normalizeOperatingDayStart(context.operatingDayStart);
    persistToStorage();
  }

  function setDepartments(ids) {
    departments.value = ids;
    persistToStorage();
  }

  function setCompletedOnly(value) {
    completedOnly.value = value !== false;
    persistToStorage();
  }

  function hydrateFromStorage() {
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.preset) preset.value = parsed.preset;
      if (parsed?.customFrom) customFrom.value = parsed.customFrom;
      if (parsed?.customTo) customTo.value = parsed.customTo;
      if (parsed?.organizationId) organizationId.value = parsed.organizationId;
      if (parsed?.timezone) timezone.value = parsed.timezone;
      if (parsed?.operatingDayStart) operatingDayStart.value = normalizeOperatingDayStart(parsed.operatingDayStart);
      if (Array.isArray(parsed?.departments)) departments.value = parsed.departments;
      if (typeof parsed?.completedOnly === "boolean") completedOnly.value = parsed.completedOnly;
    } catch (error) {
      console.warn("Не удалось восстановить фильтры из localStorage:", error);
    }
  }

  function persistToStorage() {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          preset: preset.value,
          customFrom: customFrom.value,
          customTo: customTo.value,
          organizationId: organizationId.value,
          timezone: timezone.value,
          operatingDayStart: operatingDayStart.value,
          departments: departments.value,
          completedOnly: completedOnly.value,
        }),
      );
    } catch (error) {
      console.warn("Не удалось сохранить фильтры в localStorage:", error);
    }
  }

  return {
    preset,
    customFrom,
    customTo,
    organizationId,
    timezone,
    operatingDayStart,
    completedOnly,
    departments,
    dateRange,
    lflRange,
    dateFrom,
    dateTo,
    lflDateFrom,
    lflDateTo,
    setPreset,
    setCustomRange,
    setDateRange,
    setOrganization,
    setOrganizationContext,
    setDepartments,
    setCompletedOnly,
    hydrateFromStorage,
    persistToStorage,
  };
});
