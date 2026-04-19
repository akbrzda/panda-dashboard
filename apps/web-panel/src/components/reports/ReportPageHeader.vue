<template>
  <header class="space-y-3 rounded-lg border border-border/70 bg-card/95 p-4 md:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
        <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
      </div>

      <div class="flex items-center gap-2">
        <slot name="actions" />
        <Button v-if="showRefresh" variant="outline" size="sm" :disabled="refreshing" @click="handleRefresh">
          {{ refreshing ? "Обновление..." : "Обновить" }}
        </Button>
        <Button v-if="details" variant="ghost" size="sm" class="h-8 px-2 text-xs" @click="showDetails = !showDetails">
          <Info class="mr-1 h-3.5 w-3.5" />
          {{ showDetails ? "Скрыть детали" : "Показать детали" }}
        </Button>
      </div>
    </div>

    <div v-if="showDetails && details" class="rounded-md border border-border/60 bg-muted/20 p-3">
      <p class="text-sm text-foreground">{{ details }}</p>
    </div>
  </header>
</template>

<script setup>
import { ref } from "vue";
import { Info } from "lucide-vue-next";
import { toast } from "@/lib/sonner";
import Button from "@/components/ui/Button.vue";

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  details: { type: String, default: "" },
  status: { type: String, default: "planned" },
  tier: { type: Number, default: 3 },
  source: { type: String, default: "" },
  coverage: { type: String, default: "" },
  updatedAt: { type: [String, Date], default: null },
  lastReviewedAt: { type: String, default: "" },
  warnings: { type: Array, default: () => [] },
  showRefresh: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
  timezone: { type: String, default: "Europe/Moscow" },
});

const emit = defineEmits(["refresh"]);
const showDetails = ref(false);

function handleRefresh() {
  emit("refresh");
  toast.success("Данные обновлены");
}
</script>
