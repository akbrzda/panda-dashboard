import { defineStore } from "pinia";
import { ref } from "vue";
import { clientsApi } from "../api/clients";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useClientsStore = defineStore("clients", () => {
  const clientsData = ref(null);
  const isLoadingClients = ref(false);
  const error = ref(null);

  let controller = null;
  let requestId = 0;

  async function loadClients({ organizationId, dateFrom, dateTo }) {
    if (!organizationId || !dateFrom || !dateTo) return null;

    controller?.abort();
    controller = new AbortController();
    requestId += 1;
    const currentRequestId = requestId;

    try {
      isLoadingClients.value = true;
      error.value = null;

      const resp = await clientsApi.getClients({ organizationId, dateFrom, dateTo, signal: controller.signal });
      if (currentRequestId !== requestId) return null;

      clientsData.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === requestId) {
        error.value = e.message || "Ошибка загрузки клиентской базы";
        console.error("❌ clientsStore.loadClients:", e);
      }
      return null;
    } finally {
      if (currentRequestId === requestId) {
        isLoadingClients.value = false;
        controller = null;
      }
    }
  }

  function stopAll() {
    controller?.abort();
    controller = null;
    requestId += 1;
    isLoadingClients.value = false;
  }

  function reset() {
    stopAll();
    clientsData.value = null;
    error.value = null;
  }

  return {
    clientsData,
    isLoadingClients,
    error,
    loadClients,
    stopAll,
    reset,
  };
});
