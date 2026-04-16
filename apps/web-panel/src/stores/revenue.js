import { defineStore } from "pinia";
import { organizationsApi } from "../api/organizations";
import { revenueApi } from "../api/revenue";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
let revenueController = null;
let revenueRequestId = 0;

export const useRevenueStore = defineStore("revenue", {
  state: () => ({
    organizations: [],
    currentOrganizationId: null,
    revenueData: null,
    startDate: null,
    endDate: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    currentOrganization: (state) => {
      return state.organizations.find((org) => org.id === state.currentOrganizationId);
    },

    hasData: (state) => state.revenueData !== null,

    summary: (state) => state.revenueData?.summary || null,

    revenueByChannel: (state) => state.revenueData?.revenueByChannel || {},

    dailyBreakdown: (state) => state.revenueData?.dailyBreakdown || [],

    period: (state) => state.revenueData?.period || null,

    // Форматированная дата для отображения
    formattedPeriod: (state) => {
      if (!state.startDate || !state.endDate) return "";

      const start = new Date(state.startDate);
      const end = new Date(state.endDate);

      const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      if (state.startDate === state.endDate) {
        return formatDate(start);
      }

      return `${formatDate(start)} - ${formatDate(end)}`;
    },
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

        if (this.organizations.length > 0 && !this.currentOrganizationId) {
          this.currentOrganizationId = this.organizations[0].id;
          console.log("🏢 Выбрана организация:", this.currentOrganizationId);
          // watch в PageFilters автоматически запустит загрузку отчёта
        }
      } catch (error) {
        this.error = error.message || "Ошибка загрузки организаций";
        console.error("❌ Error loading organizations:", error);
        console.error("❌ Error details:", error.response?.data);
      } finally {
        this.isLoading = false;
      }
    },

    async loadRevenueReport() {
      if (!this.currentOrganizationId || !this.startDate || !this.endDate) {
        console.warn("⚠️ Недостаточно данных для загрузки отчета");
        return;
      }

      revenueController?.abort();
      revenueController = new AbortController();
      revenueRequestId += 1;
      const currentRequestId = revenueRequestId;

      try {
        this.isLoading = true;
        this.error = null;
        console.log(`🔄 Загрузка отчета за период ${this.startDate} - ${this.endDate} для ${this.currentOrganizationId}`);

        const response = await revenueApi.getRevenueReport(this.currentOrganizationId, this.startDate, this.endDate, revenueController.signal);

        if (currentRequestId !== revenueRequestId) {
          return;
        }

        console.log("✅ Ответ API отчета:", response);
        this.revenueData = response.data;
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        this.error = error.message || "Ошибка загрузки отчета";
        console.error("❌ Error loading revenue report:", error);
        console.error("❌ Error details:", error.response?.data);
      } finally {
        if (currentRequestId === revenueRequestId) {
          this.isLoading = false;
          revenueController = null;
        }
      }
    },

    setCurrentOrganization(organizationId) {
      if (this.currentOrganizationId !== organizationId) {
        this.currentOrganizationId = organizationId;
      }
    },
  },
});
