<template>
  <CalendarRoot v-model="internalValue" :locale="'ru-RU'" :week-starts-on="1" v-bind="$attrs" v-slot="{ grid, weekDays }" class="p-0">
    <div class="rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md w-fit">
      <CalendarHeader class="flex items-center justify-between mb-2">
        <CalendarPrev
          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ChevronLeft class="w-4 h-4" />
        </CalendarPrev>
        <CalendarHeading class="text-sm font-semibold" />
        <CalendarNext
          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ChevronRight class="w-4 h-4" />
        </CalendarNext>
      </CalendarHeader>

      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow class="flex mb-1">
            <CalendarHeadCell v-for="day in weekDays" :key="day" class="w-8 text-xs font-normal text-muted-foreground text-center">
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>

        <CalendarGridBody>
          <CalendarGridRow v-for="(week, i) in month.rows" :key="i" class="flex mt-1">
            <CalendarCell v-for="day in week" :key="day.toString()" :date="day" class="relative p-0 text-center text-sm">
              <CalendarCellTrigger
                :day="day"
                :month="month.value"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-sm font-normal ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[outside-view]:text-muted-foreground/40 data-[selected]:border-primary data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:border-primary/40 data-[today]:bg-primary/10 data-[today]:text-primary data-[today]:font-semibold data-[disabled]:opacity-50"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>

<script setup>
import { computed } from "vue";
import {
  CalendarRoot,
  CalendarHeader,
  CalendarPrev,
  CalendarNext,
  CalendarHeading,
  CalendarGrid,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarGridBody,
  CalendarCell,
  CalendarCellTrigger,
} from "radix-vue";
import { parseDate, CalendarDate } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

defineOptions({ inheritAttrs: false });

// modelValue: строка YYYY-MM-DD
const props = defineProps({
  modelValue: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);

// Конвертируем строку → CalendarDate для radix-vue
const internalValue = computed({
  get() {
    if (!props.modelValue) return undefined;
    try {
      return parseDate(props.modelValue);
    } catch {
      return undefined;
    }
  },
  set(val) {
    emit("update:modelValue", val ? val.toString() : null);
  },
});
</script>
