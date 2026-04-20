<template>
  <DialogRoot v-model:open="open">
    <slot />
  </DialogRoot>
</template>

<script setup>
import { DialogRoot } from "radix-vue";

const open = defineModel("open", { type: Boolean, default: false });
</script>
