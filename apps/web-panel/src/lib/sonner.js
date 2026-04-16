import { ref } from "vue";

const toasts = ref([]);
let nextToastId = 1;

function dismiss(id) {
  toasts.value = toasts.value.filter((toastItem) => toastItem.id !== id);
}

function show(options = {}) {
  const id = nextToastId++;
  const toastItem = {
    id,
    title: options.title || "Уведомление",
    description: options.description || "",
    variant: options.variant || "info",
  };

  toasts.value = [...toasts.value, toastItem];

  const duration = Number(options.duration || 4000);
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }

  return id;
}

export const toast = {
  show,
  success(title, description = "") {
    return show({ title, description, variant: "success" });
  },
  error(title, description = "") {
    return show({ title, description, variant: "error", duration: 5000 });
  },
  info(title, description = "") {
    return show({ title, description, variant: "info" });
  },
};

export function useSonnerState() {
  return {
    toasts,
    dismiss,
  };
}
