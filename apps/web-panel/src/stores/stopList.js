import { defineStore } from "pinia";
import { organizationsApi, stopListsApi } from "../api";

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
        console.log("🔄 Загрузка организаций...");
        const response = await organizationsApi.getOrganizations();
        console.log("✅ Ответ API организаций:", response);
        this.organizations = response.organizations || [];
        console.log("📋 Организации:", this.organizations);

        if (this.organizations.length > 0) {
          this.currentOrganizationId = this.organizations[0].id;
          console.log("🏢 Выбрана организация:", this.currentOrganizationId);
          await this.loadStopLists();
        }
      } catch (error) {
        this.error = error.message || "Ошибка загрузки организаций";
        console.error("❌ Error loading organizations:", error);
        console.error("❌ Error details:", error.response?.data);
      } finally {
        this.isLoading = false;
      }
    },

    async loadStopLists() {
      if (!this.currentOrganizationId) {
        console.warn("⚠️ Нет выбранной организации");
        return;
      }

      try {
        this.isLoading = true;
        this.error = null;
        console.log("🔄 Загрузка стоп-листа для организации:", this.currentOrganizationId);
        const response = await stopListsApi.getStopLists(this.currentOrganizationId);
        console.log("✅ Ответ API стоп-листа:", response);

        // normalizedItems - это уже плоский массив элементов
        const normalizedItems = response.normalizedItems || [];
        console.log("📦 normalizedItems:", normalizedItems.length);

        if (normalizedItems.length > 0) {
          console.log("📋 Первый элемент:", normalizedItems[0]);
        }

        // Сортировка от новых к старым
        normalizedItems.sort((a, b) => {
          const dateA = new Date(a.dateAdd || a.openedAt || 0);
          const dateB = new Date(b.dateAdd || b.openedAt || 0);
          return dateB - dateA;
        });

        this.stopListItems = normalizedItems;
        this.applyFilters();
        console.log("✅ Стоп-лист загружен. Отфильтровано:", this.filteredItems.length);
      } catch (error) {
        this.error = error.message || "Ошибка загрузки стоп-листа";
        console.error("❌ Error loading stop lists:", error);
        console.error("❌ Error details:", error.response?.data);
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
        // Фильтр по тексту
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
