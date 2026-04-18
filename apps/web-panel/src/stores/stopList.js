import { defineStore } from "pinia";
import { organizationsApi } from "../api/organizations";
import { stopListsApi } from "../api/stopLists";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

const DEFAULT_FILTERS = {
  search: "",
  terminalGroupId: "all",
  entityType: "all",
  status: "active",
  duration: "all",
};

export const useStopListStore = defineStore("stopList", {
  state: () => ({
    organizations: [],
    currentOrganizationId: "all",
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
      const orgs = (state.organizations || []).map((organization) => ({
        id: String(organization.id),
        name: organization.name,
      }));
      return [{ id: "all", name: "Все подразделения" }, ...orgs];
    },

    terminalGroupOptions: (state) => {
      const map = new Map();
      for (const item of state.items) {
        const id = String(item.terminalGroupId || "").trim();
        if (!id) continue;
        if (!map.has(id)) {
          map.set(id, item.terminalGroupName || "Без названия подразделения");
        }
      }

      const values = Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      return [{ id: "all", name: "Все terminal groups" }, ...values];
    },

    filteredItems: (state) => {
      const search = state.filters.search.trim().toLowerCase();

      return (state.items || []).filter((item) => {
        if (state.currentOrganizationId !== "all" && String(item.organizationId) !== String(state.currentOrganizationId)) {
          return false;
        }

        if (state.filters.terminalGroupId !== "all" && String(item.terminalGroupId) !== String(state.filters.terminalGroupId)) {
          return false;
        }

        if (state.filters.entityType !== "all" && String(item.entityType) !== String(state.filters.entityType)) {
          return false;
        }

        if (state.filters.status === "active" && item.isInStop !== true) {
          return false;
        }

        if (state.filters.status === "completed" && item.isInStop === true) {
          return false;
        }

        const hours = Number(item.inStopHours);
        if (state.filters.duration === "gt1h" && !(Number.isFinite(hours) && hours > 1)) {
          return false;
        }

        if (state.filters.duration === "gt2h" && !(Number.isFinite(hours) && hours > 2)) {
          return false;
        }

        if (state.filters.duration === "gt24h" && !(Number.isFinite(hours) && hours > 24)) {
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
      const estimatedLostRevenue = list.reduce((sum, item) => {
        const value = Number(item.estimatedLostRevenue);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      return {
        total: list.length,
        uniqueTerminalGroups: terminalGroups.size,
        longerThan2Hours,
        longerThan1Day,
        estimatedLostRevenue,
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

    lostRevenueMeta(state) {
      return state.meta?.lostRevenue || null;
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

        if (!this.currentOrganizationId) {
          this.currentOrganizationId = "all";
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
      this.currentOrganizationId = String(organizationId || "all");
      this.loadStopLists();
    },

    setSearch(value) {
      this.filters.search = String(value || "");
    },

    setTerminalGroup(value) {
      this.filters.terminalGroupId = String(value || "all");
    },

    setEntityType(value) {
      this.filters.entityType = String(value || "all");
    },

    setStatus(value) {
      this.filters.status = String(value || "active");
    },

    setDuration(value) {
      this.filters.duration = String(value || "all");
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
