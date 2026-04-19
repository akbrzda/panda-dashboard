import { defineStore } from "pinia";
import { organizationsApi } from "../api/organizations";
import { stopListsApi } from "../api/stopLists";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

const DEFAULT_FILTERS = {
  search: "",
  entityType: "all",
};

export const useStopListStore = defineStore("stopList", {
  state: () => ({
    organizations: [],
    currentOrganizationId: null,
    items: [],
    meta: null,
    filters: { ...DEFAULT_FILTERS },
    isLoading: false,
    error: null,
    lastLoadedAt: null,
    controller: null,
    requestId: 0,
  }),

  getters: {
    organizationOptions: (state) => {
      return (state.organizations || []).map((organization) => ({
        id: String(organization.id),
        name: organization.name,
      }));
    },

    filteredItems: (state) => {
      const search = state.filters.search.trim().toLowerCase();

      return (state.items || []).filter((item) => {
        if (state.currentOrganizationId && String(item.organizationId) !== String(state.currentOrganizationId)) {
          return false;
        }

        if (state.filters.entityType !== "all" && String(item.entityType) !== String(state.filters.entityType)) {
          return false;
        }

        if (search) {
          const haystack = [item.entityName, item.entityId, item.organizationName, item.terminalGroupName, item.reason]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(search)) {
            return false;
          }
        }

        return true;
      });
    },

    summaryCards() {
      const list = this.filteredItems;
      const terminalGroups = new Set(list.map((item) => item.terminalGroupId).filter(Boolean));
      const longerThan2Hours = list.filter((item) => Number.isFinite(Number(item.inStopHours)) && Number(item.inStopHours) > 2).length;
      const longerThan1Day = list.filter((item) => Number.isFinite(Number(item.inStopHours)) && Number(item.inStopHours) > 24).length;
      return {
        total: list.length,
        uniqueTerminalGroups: terminalGroups.size,
        longerThan2Hours,
        longerThan1Day,
      };
    },

    itemsCount() {
      return this.filteredItems.length;
    },

    warnings(state) {
      return Array.isArray(state.meta?.warnings) ? state.meta.warnings : [];
    },

    isPartial(state) {
      return state.meta?.isPartial === true;
    },

    generatedAt(state) {
      return state.meta?.generatedAt || state.lastLoadedAt;
    },

  },

  actions: {
    _getOrganizationIdsQuery() {
      if (this.currentOrganizationId && this.currentOrganizationId !== "all") {
        return String(this.currentOrganizationId);
      }

      return (this.organizations || [])
        .map((organization) => String(organization.id))
        .filter(Boolean)
        .join(",");
    },

    _resolveTimezone() {
      if (this.currentOrganizationId && this.currentOrganizationId !== "all") {
        const selected = this.organizations.find((organization) => String(organization.id) === String(this.currentOrganizationId));
        if (selected?.timezone) {
          return selected.timezone;
        }
      }

      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    },

    async loadOrganizations() {
      try {
        this.isLoading = true;
        this.error = null;

        const response = await organizationsApi.getOrganizations();
        this.organizations = response.organizations || [];

        if (!this.currentOrganizationId && this.organizations.length > 0) {
          this.currentOrganizationId = String(this.organizations[0].id);
        }

        await this.loadStopLists();
      } catch (error) {
        this.error = error.message || "Ошибка загрузки организаций";
      } finally {
        this.isLoading = false;
      }
    },

    async loadStopLists(options = {}) {
      const refresh = options.refresh === true;
      const organizationIdsQuery = this._getOrganizationIdsQuery();

      if (!organizationIdsQuery) {
        this.items = [];
        this.meta = null;
        return;
      }

      this.controller?.abort();
      this.controller = new AbortController();
      this.requestId += 1;
      const currentRequestId = this.requestId;

      try {
        this.isLoading = true;
        this.error = null;

        const timezone = this._resolveTimezone();
        const response = await stopListsApi.getStopLists(organizationIdsQuery, timezone, this.controller.signal, refresh);
        if (currentRequestId !== this.requestId) return;

        this.items = Array.isArray(response?.data?.items) ? response.data.items : [];
        this.meta = response?.meta || null;
        this.lastLoadedAt = this.meta?.generatedAt || new Date().toISOString();
      } catch (error) {
        if (isAbortError(error)) return;
        this.error = error.message || "Ошибка загрузки стоп-листа";
      } finally {
        if (currentRequestId === this.requestId) {
          this.isLoading = false;
          this.controller = null;
        }
      }
    },

    setCurrentOrganization(organizationId) {
      this.currentOrganizationId = String(organizationId || this.organizationOptions[0]?.id || "");
      this.loadStopLists();
    },

    setSearch(value) {
      this.filters.search = String(value || "");
    },

    setEntityType(value) {
      this.filters.entityType = String(value || "all");
    },

    resetFilters() {
      this.filters = { ...DEFAULT_FILTERS };
    },

    stopAll() {
      this.controller?.abort();
      this.controller = null;
      this.requestId += 1;
      this.isLoading = false;
    },
  },
});
