<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>

<script setup>
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "default",
    // default | secondary | destructive | outline | success | warning
  },
  class: { type: String, default: "" },
});

const badgeClass = computed(() => {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors";

  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border text-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };

  return cn(base, variants[props.variant] || variants.default, props.class);
});
</script>
