import { ref } from "vue";

const isAbortError = (error) => error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

export function createRequestRunner() {
  const error = ref(null);
  const loadingMap = new Map();
  const controllerMap = new Map();
  const requestIdMap = new Map();

  const getLoadingRef = (key) => {
    if (!loadingMap.has(key)) loadingMap.set(key, ref(false));
    return loadingMap.get(key);
  };

  async function runRequest({ key, hasRequiredParams, request, onSuccess, errorMessage }) {
    if (!hasRequiredParams()) return null;

    controllerMap.get(key)?.abort();
    const controller = new AbortController();
    controllerMap.set(key, controller);

    const requestId = (requestIdMap.get(key) || 0) + 1;
    requestIdMap.set(key, requestId);
    getLoadingRef(key).value = true;

    try {
      error.value = null;
      const response = await request(controller.signal);
      if (requestIdMap.get(key) !== requestId) return null;
      onSuccess(response?.data ?? null);
      return response;
    } catch (e) {
      if (isAbortError(e)) return null;
      if (requestIdMap.get(key) === requestId) {
        error.value = e.message || errorMessage;
      }
      return null;
    } finally {
      if (requestIdMap.get(key) === requestId) {
        getLoadingRef(key).value = false;
        controllerMap.set(key, null);
      }
    }
  }

  function stopAll() {
    for (const controller of controllerMap.values()) {
      controller?.abort();
    }
  }

  return {
    error,
    runRequest,
    getLoadingRef,
    stopAll,
  };
}

