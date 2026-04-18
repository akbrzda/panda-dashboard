import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useSidebarStore = defineStore("sidebar", () => {
  const open = ref(true);
  const openMobile = ref(false);

  const state = computed(() => (open.value ? "expanded" : "collapsed"));

  function setOpen(value) {
    open.value = Boolean(value);
  }

  function setOpenMobile(value) {
    openMobile.value = Boolean(value);
  }

  function toggleDesktop() {
    open.value = !open.value;
  }

  function toggleMobile() {
    openMobile.value = !openMobile.value;
  }

  function closeMobile() {
    openMobile.value = false;
  }

  return {
    state,
    open,
    openMobile,
    setOpen,
    setOpenMobile,
    toggleDesktop,
    toggleMobile,
    closeMobile,
  };
});
