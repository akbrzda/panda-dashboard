<template>
  <label
    :for="htmlFor"
    :class="cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </label>
</template>

<script setup>
import { cn } from "@/lib/utils";

const props = defineProps({
  htmlFor: { type: String, default: undefined },
  class: { type: String, default: "" },
});

defineOptions({ inheritAttrs: false });
</script>
