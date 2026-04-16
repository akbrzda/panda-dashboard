<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="toastItem in toasts"
        :key="toastItem.id"
        class="pointer-events-auto overflow-hidden rounded-lg border bg-card shadow-lg"
        :class="toastClass(toastItem.variant)"
      >
        <div class="flex items-start gap-3 p-4">
          <component :is="getIcon(toastItem.variant)" class="mt-0.5 h-4 w-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-foreground">{{ toastItem.title }}</p>
            <p v-if="toastItem.description" class="mt-1 text-xs text-muted-foreground">
              {{ toastItem.description }}
            </p>
          </div>
          <button class="text-muted-foreground transition-colors hover:text-foreground" @click="dismiss(toastItem.id)">
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { CircleAlert, CircleCheck, Info, X } from "lucide-vue-next";
import { useSonnerState } from "@/lib/sonner";

const { toasts, dismiss } = useSonnerState();

function getIcon(variant) {
  if (variant === "success") return CircleCheck;
  if (variant === "error") return CircleAlert;
  return Info;
}

function toastClass(variant) {
  if (variant === "success") return "border-emerald-500/30";
  if (variant === "error") return "border-destructive/30";
  return "border-border";
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
