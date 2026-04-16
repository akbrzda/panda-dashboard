import { onMounted, onUnmounted, unref } from "vue";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export function useAutoRefresh(callback, options = {}) {
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const enabled = options.enabled ?? true;
  let timerId = null;

  const isEnabled = () => {
    if (typeof enabled === "function") {
      return enabled();
    }

    return unref(enabled);
  };

  const stop = () => {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };

  const start = () => {
    stop();

    if (!isEnabled()) {
      return;
    }

    timerId = window.setInterval(() => {
      if (isEnabled()) {
        callback();
      }
    }, intervalMs);
  };

  onMounted(start);
  onUnmounted(stop);

  return { start, stop };
}
