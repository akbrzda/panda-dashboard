import { computed, proxyRefs, ref, unref, watch } from "vue";

function normalizePageSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.floor(parsed);
}

export function usePagination(items, options = {}) {
  const currentPage = ref(1);
  const pageSize = ref(normalizePageSize(options.pageSize || 20));

  const totalItems = computed(() => {
    const list = unref(items);
    return Array.isArray(list) ? list.length : 0;
  });

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(totalItems.value / pageSize.value));
  });

  const pageItems = computed(() => {
    const list = unref(items);
    if (!Array.isArray(list) || list.length === 0) {
      return [];
    }

    const start = (currentPage.value - 1) * pageSize.value;
    return list.slice(start, start + pageSize.value);
  });

  const rangeStart = computed(() => {
    if (totalItems.value === 0) {
      return 0;
    }
    return (currentPage.value - 1) * pageSize.value + 1;
  });

  const rangeEnd = computed(() => {
    if (totalItems.value === 0) {
      return 0;
    }
    return Math.min(currentPage.value * pageSize.value, totalItems.value);
  });

  const hasPrevPage = computed(() => currentPage.value > 1);
  const hasNextPage = computed(() => currentPage.value < totalPages.value);

  function setPage(nextPage) {
    const parsed = Number(nextPage);
    if (!Number.isFinite(parsed)) {
      return;
    }
    currentPage.value = Math.min(totalPages.value, Math.max(1, Math.floor(parsed)));
  }

  function nextPage() {
    setPage(currentPage.value + 1);
  }

  function prevPage() {
    setPage(currentPage.value - 1);
  }

  function resetPage() {
    currentPage.value = 1;
  }

  function setPageSize(nextSize) {
    pageSize.value = normalizePageSize(nextSize);
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  }

  watch([totalItems, pageSize], () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  });

  return proxyRefs({
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    hasPrevPage,
    hasNextPage,
    setPage,
    nextPage,
    prevPage,
    resetPage,
    setPageSize,
  });
}
