import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getDateRange, getLFLRange, formatDateISO } from "../composables/usePeriod";

export const useFiltersStore = defineStore("filters", () => {
  const preset = ref("today");
  const customFrom = ref(null);
  const customTo = ref(null);
  const organizationId = ref(null);
  // Пустой массив = все подразделения
  const departments = ref([]);

  const dateRange = computed(() => getDateRange(preset.value, customFrom.value, customTo.value));

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
  }

  function setCustomRange(from, to) {
    customFrom.value = from;
    customTo.value = to;
    preset.value = "custom";
  }

  function setDateRange(from, to) {
    if (dateFrom.value === from && dateTo.value === to) {
      return;
    }
    setCustomRange(from, to);
  }

  function setOrganization(id) {
    organizationId.value = id || null;
  }

  function setDepartments(ids) {
    departments.value = ids;
  }

  return {
    preset,
    customFrom,
    customTo,
    organizationId,
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
    setDepartments,
  };
});
