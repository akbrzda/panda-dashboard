<template>
  <td :class="cn('p-3 align-middle [&:has([role=checkbox])]:pr-0', props.class)">
    <slot />
  </td>
</template>

<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: String, default: '' },
})
</script>
