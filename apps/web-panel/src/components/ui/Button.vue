<template>
  <button :class="buttonClass" :disabled="disabled" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup>
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "default",
    // default | outline | ghost | secondary | destructive
  },
  size: {
    type: String,
    default: "default",
    // default | sm | lg | icon
  },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: "" },
});

const buttonClass = computed(() => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    lg: "h-11 px-8",
    icon: "h-10 w-10",
  };

  return cn(base, variants[props.variant] || variants.default, sizes[props.size] || sizes.default, props.class);
});
</script>
