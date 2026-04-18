import { defineStore } from "pinia";
import { ref } from "vue";
import { topDishesApi } from "../api/topDishes";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useTopDishesStore = defineStore("topDishes", () => {
  const topDishes = ref(null);
  const isLoadingTopDishes = ref(false);
  const error = ref(null);

  let controller = null;
  let requestId = 0;

  async function loadTopDishes({ organizationId, dateFrom, dateTo, limit }) {
    if (!organizationId || !dateFrom || !dateTo) return null;

    controller?.abort();
    controller = new AbortController();
    requestId += 1;
    const currentRequestId = requestId;

    try {
      isLoadingTopDishes.value = true;
      error.value = null;

      const resp = await topDishesApi.getTopDishes({ organizationId, dateFrom, dateTo, limit, signal: controller.signal });
      if (currentRequestId !== requestId) return null;

      topDishes.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === requestId) {
        error.value = e.message || "Ошибка загрузки топ блюд";
        console.error("❌ topDishesStore.loadTopDishes:", e);
      }
      throw e;
    } finally {
      if (currentRequestId === requestId) {
        isLoadingTopDishes.value = false;
        controller = null;
      }
    }
  }

  function stopAll() {
    controller?.abort();
    controller = null;
    requestId += 1;
    isLoadingTopDishes.value = false;
  }

  function reset() {
    stopAll();
    topDishes.value = null;
    error.value = null;
  }

  return {
    topDishes,
    isLoadingTopDishes,
    error,
    loadTopDishes,
    stopAll,
    reset,
  };
});
