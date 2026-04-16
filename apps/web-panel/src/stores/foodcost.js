import { defineStore } from "pinia";
import { ref } from "vue";
import { foodcostApi } from "../api/foodcost";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export const useFoodcostStore = defineStore("foodcost", () => {
  const foodcostData = ref(null);
  const isLoadingFoodcost = ref(false);
  const error = ref(null);

  let controller = null;
  let requestId = 0;

  async function loadFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    if (!organizationId || !dateFrom || !dateTo) return null;

    controller?.abort();
    controller = new AbortController();
    requestId += 1;
    const currentRequestId = requestId;

    try {
      isLoadingFoodcost.value = true;
      error.value = null;

      const resp = await foodcostApi.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo, signal: controller.signal });
      if (currentRequestId !== requestId) return null;

      foodcostData.value = resp.data;
      return resp;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (currentRequestId === requestId) {
        error.value = e.message || "Ошибка загрузки фудкоста";
        console.error("❌ foodcostStore.loadFoodcost:", e);
      }
      throw e;
    } finally {
      if (currentRequestId === requestId) {
        isLoadingFoodcost.value = false;
        controller = null;
      }
    }
  }

  return {
    foodcostData,
    isLoadingFoodcost,
    error,
    loadFoodcost,
  };
});
