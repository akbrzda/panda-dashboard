<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
    <p class="text-xs text-muted-foreground">Показано {{ rangeStart }}-{{ rangeEnd }} из {{ totalItems }}</p>
    <div class="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" :disabled="!hasPrevPage || loading" @click="emit('prev')">Назад</Button>
      <span class="text-xs text-muted-foreground">Стр. {{ currentPage }} / {{ totalPages }}</span>
      <Button type="button" size="sm" variant="outline" :disabled="!hasNextPage || loading" @click="emit('next')">Вперед</Button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Button from "@/components/ui/Button.vue";

const props = defineProps({
  currentPage: {
    type: Number,
    default: 1,
  },
  totalPages: {
    type: Number,
    default: 1,
  },
  totalItems: {
    type: Number,
    default: 0,
  },
  rangeStart: {
    type: Number,
    default: 0,
  },
  rangeEnd: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["prev", "next"]);

const hasPrevPage = computed(() => props.currentPage > 1);
const hasNextPage = computed(() => props.currentPage < props.totalPages);
</script>
