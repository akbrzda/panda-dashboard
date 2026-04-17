import { defineStore } from "pinia";
import { organizationsApi } from "../api/organizations";
import { stopListsApi } from "../api/stopLists";

export const useStopListStore = defineStore("stopList", {
  state: () => ({
    organizations: [],
    currentOrganizationId: null,
    stopListItems: [],
    filteredItems: [],
    filterText: "",
    statusFilter: "stopped",
    isLoading: false,
    error: null,
  }),

  getters: {
    currentOrganization: (state) => {
      return state.organizations.find((org) => org.id === state.currentOrganizationId);
    },

    itemsCount: (state) => state.filteredItems.length,
  },

  actions: {
    async loadOrganizations() {
      try {
        this.isLoading = true;
        this.error = null;

        const response = await organizationsApi.getOrganizations();
        this.organizations = response.organizations || [];

        if (!this.currentOrganizationId && this.organizations.length > 0) {
          this.currentOrganizationId = this.organizations[0].id;
        }

        if (this.currentOrganizationId) {
          await this.loadStopLists();
        }
      } catch (error) {
        this.error = error.message || "Ошибка загрузки организаций";
      } finally {
        this.isLoading = false;
      }
    },

    async loadStopLists() {
      if (!this.currentOrganizationId) {
        return;
      }

      try {
        this.isLoading = true;
        this.error = null;

        const currentOrganization = this.organizations.find((organization) => String(organization.id) === String(this.currentOrganizationId));
        const timezone = currentOrganization?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await stopListsApi.getStopLists(this.currentOrganizationId, timezone);
        const normalizedItems = response.normalizedItems || [];

        normalizedItems.sort((a, b) => {
          const dateA = new Date(a.dateAdd || a.openedAt || 0);
          const dateB = new Date(b.dateAdd || b.openedAt || 0);
          return dateB - dateA;
        });

        this.stopListItems = normalizedItems;
        this.applyFilters();
      } catch (error) {
        this.error = error.message || "Ошибка загрузки стоп-листа";
      } finally {
        this.isLoading = false;
      }
    },

    setCurrentOrganization(organizationId) {
      this.currentOrganizationId = organizationId;
      this.loadStopLists();
    },

    setFilterText(text) {
      this.filterText = text;
      this.applyFilters();
    },

    setStatusFilter(status) {
      this.statusFilter = status;
      this.applyFilters();
    },

    applyFilters() {
      const searchText = this.filterText.toLowerCase();

      this.filteredItems = this.stopListItems.filter((item) => {
        if (searchText) {
          const productName = (item.productName || "").toLowerCase();
          const productFullName = (item.productFullName || "").toLowerCase();
          const itemName = (item.itemName || "").toLowerCase();
          const sku = (item.sku || "").toLowerCase();
          const productId = (item.productId || "").toLowerCase();

          if (
            !productName.includes(searchText) &&
            !productFullName.includes(searchText) &&
            !itemName.includes(searchText) &&
            !sku.includes(searchText) &&
            !productId.includes(searchText)
          ) {
            return false;
          }
        }

        return true;
      });
    },
  },
});