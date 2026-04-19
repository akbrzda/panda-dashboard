import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { organizationsApi } from "../api/organizations";
import { revenueApi } from "../api/revenue";
import { useFiltersStore } from "./filters";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
const DEFAULT_ORGANIZATION_TIMEZONE = "Europe/Moscow";

function normalizeOperatingDayStart(organization) {
  const normalized = String(
    organization?.operatingDayStart || organization?.businessDayStart || organization?.dayStartTime || "00:00",
  ).trim();

  return /^(\d{2}):(\d{2})$/.test(normalized) ? normalized : "00:00";
}

export const useRevenueStore = defineStore("revenue", () => {
  const filtersStore = useFiltersStore();

  const organizations = ref([]);
  const revenueData = ref(null);
  const startDate = ref(null);
  const endDate = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  let revenueController = null;
  let revenueRequestId = 0;

  function syncOrganizationContext(organizationId) {
    filtersStore.setOrganization(organizationId || null);

    const selectedOrganization = organizations.value.find((organization) => String(organization.id) === String(organizationId));
    filtersStore.setOrganizationContext({
      timezone: selectedOrganization?.timezone || DEFAULT_ORGANIZATION_TIMEZONE,
      operatingDayStart: normalizeOperatingDayStart(selectedOrganization),
    });
  }

  const currentOrganizationId = computed({
    get: () => filtersStore.organizationId,
    set: (organizationId) => {
      syncOrganizationContext(organizationId || null);
    },
  });

  const currentOrganization = computed(() => {
    return organizations.value.find((org) => org.id === currentOrganizationId.value);
  });

  const hasData = computed(() => revenueData.value !== null);
  const summary = computed(() => revenueData.value?.summary || null);
  const revenueByChannel = computed(() => revenueData.value?.revenueByChannel || {});
  const dailyBreakdown = computed(() => revenueData.value?.dailyBreakdown || []);
  const period = computed(() => revenueData.value?.period || null);

  const formattedPeriod = computed(() => {
    if (!startDate.value || !endDate.value) return "";

    const start = new Date(startDate.value);
    const end = new Date(endDate.value);

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    if (startDate.value === endDate.value) {
      return formatDate(start);
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
  });

  async function loadOrganizations() {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await organizationsApi.getOrganizations();
      organizations.value = response.organizations || [];

      if (organizations.value.length > 0 && !currentOrganizationId.value) {
        setCurrentOrganization(organizations.value[0].id);
      } else if (currentOrganizationId.value) {
        syncOrganizationContext(currentOrganizationId.value);
      }
    } catch (loadError) {
      error.value = loadError.message || "Ошибка загрузки организаций";
      console.error("Ошибка загрузки организаций:", loadError);
    } finally {
      isLoading.value = false;
    }
  }

  async function loadRevenueReport() {
    if (!currentOrganizationId.value || !startDate.value || !endDate.value) {
      return;
    }

    revenueController?.abort();
    revenueController = new AbortController();
    revenueRequestId += 1;
    const currentRequestId = revenueRequestId;

    try {
      isLoading.value = true;
      error.value = null;

      const response = await revenueApi.getRevenueReport(
        currentOrganizationId.value,
        startDate.value,
        endDate.value,
        revenueController.signal,
        currentOrganization.value?.timezone || DEFAULT_ORGANIZATION_TIMEZONE,
      );

      if (currentRequestId !== revenueRequestId) {
        return;
      }

      revenueData.value = response.data;
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return;
      }

      error.value = loadError.message || "Ошибка загрузки отчета";
      console.error("Ошибка загрузки отчета:", loadError);
    } finally {
      if (currentRequestId === revenueRequestId) {
        isLoading.value = false;
        revenueController = null;
      }
    }
  }

  function setCurrentOrganization(organizationId) {
    currentOrganizationId.value = organizationId;
  }

  return {
    organizations,
    currentOrganizationId,
    currentOrganization,
    revenueData,
    startDate,
    endDate,
    isLoading,
    error,
    hasData,
    summary,
    revenueByChannel,
    dailyBreakdown,
    period,
    formattedPeriod,
    loadOrganizations,
    loadRevenueReport,
    setCurrentOrganization,
  };
});