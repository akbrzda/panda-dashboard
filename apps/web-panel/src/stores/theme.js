import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useThemeStore = defineStore("theme", () => {
  const themeMode = ref(localStorage.getItem("themeMode") || "light");
  const systemPrefersDark = ref(false);
  let mediaQuery = null;

  const isDark = computed(() => {
    if (themeMode.value === "system") {
      return systemPrefersDark.value;
    }
    return themeMode.value === "dark";
  });

  function apply() {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark.value);
  }

  function init() {
    if (typeof window === "undefined") return;

    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.matches;

    const onChange = (event) => {
      systemPrefersDark.value = event.matches;
      if (themeMode.value === "system") {
        apply();
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
    } else {
      mediaQuery.addListener(onChange);
    }

    apply();
  }

  function toggle() {
    themeMode.value = isDark.value ? "light" : "dark";
    localStorage.setItem("themeMode", themeMode.value);
    apply();
  }

  return { themeMode, isDark, init, toggle, apply };
});
