<template>
  <SelectRoot v-bind="forwarded" v-model="model">
    <SelectTrigger
      :class="
        cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&>span]:line-clamp-1',
          $props.class,
        )
      "
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon as-child>
        <ChevronDown class="h-4 w-4 opacity-50 shrink-0" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        :class="
          cn(
            'relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )
        "
        :position="position"
      >
        <SelectScrollUpButton class="flex cursor-default items-center justify-center py-1">
          <ChevronUp class="h-4 w-4" />
        </SelectScrollUpButton>

        <SelectViewport class="p-1">
          <slot />
        </SelectViewport>

        <SelectScrollDownButton class="flex cursor-default items-center justify-center py-1">
          <ChevronDown class="h-4 w-4" />
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup>
import { ChevronDown, ChevronUp } from "lucide-vue-next";
import {
  SelectContent,
  SelectIcon,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  useForwardPropsEmits,
} from "radix-vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  defaultValue: { type: [String, Number], default: undefined },
  modelValue: { type: [String, Number], default: undefined },
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: "Выбрать..." },
  position: { type: String, default: "popper" },
  class: { type: String, default: "" },
});

const emits = defineEmits(["update:modelValue", "update:open"]);
const forwarded = useForwardPropsEmits(props, emits);
const model = defineModel();
</script>
