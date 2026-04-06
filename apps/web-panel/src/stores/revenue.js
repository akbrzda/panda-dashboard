import { defineStore } from "pinia";
import { organizationsApi, revenueApi } from "../api";

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

          // Устанавливаем сегодняшний день по умолчанию
          const today = new Date().toISOString().split("T")[0];
          this.startDate = today;
          this.endDate = today;

          await this.loadRevenueReport();
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

      try {
        this.isLoading = true;
        this.error = null;
        console.log(`🔄 Загрузка отчета за период ${this.startDate} - ${this.endDate} для ${this.currentOrganizationId}`);

        const response = await revenueApi.getRevenueReport(this.currentOrganizationId, this.startDate, this.endDate);
        console.log("✅ Ответ API отчета:", response);

        this.revenueData = response.data;
        console.log("📊 Данные отчета загружены:", this.revenueData);
      } catch (error) {
        this.error = error.message || "Ошибка загрузки отчета";
        console.error("❌ Error loading revenue report:", error);
        console.error("❌ Error details:", error.response?.data);
      } finally {
        this.isLoading = false;
      }
    },

    setCurrentOrganization(organizationId) {
      if (this.currentOrganizationId !== organizationId) {
        this.currentOrganizationId = organizationId;
        this.loadRevenueReport();
      }
    },

    setDateRange(startDate, endDate) {
      this.startDate = startDate;
      this.endDate = endDate;
      this.loadRevenueReport();
    },

    setToday() {
      const today = new Date().toISOString().split("T")[0];
      this.setDateRange(today, today);
    },

    setYesterday() {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];
      this.setDateRange(dateStr, dateStr);
    },

    setLastWeek() {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      this.setDateRange(startStr, endStr);
    },

    setLastMonth() {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      this.setDateRange(startStr, endStr);
    },
  },
});
