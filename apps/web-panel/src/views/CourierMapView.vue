<template>
  <div class="space-y-5">
    <div class="space-y-4">
      <ReportPageHeader
        title="Карта курьеров"
        description="Интенсивность заказов и риски опозданий по зонам доставки."
        details="Отчет показывает распределение заказов по зонам, долю опозданий и среднее время доставки. Используется для балансировки зон и контроля нагрузки курьеров."
        :status="readiness.status"
        :tier="readiness.tier"
        :source="readiness.source"
        :coverage="trustCoverage"
        :updated-at="lastLoadedAt"
        :last-reviewed-at="readiness.lastReviewedAt"
        :warnings="readiness.knownLimitations"
        :show-refresh="true"
        :refreshing="isPageLoading"
        @refresh="handleApply()"
      />
      <PageFilters :loading="isPageLoading" @apply="handleApply" />

      <Card class="border-border/70 bg-card/95 p-4">
        <div v-if="zonesMeta.zonesConfigured" class="space-y-2">
          <p class="text-xs text-muted-foreground">GeoJSON зон доставки</p>
          <p class="text-xs text-muted-foreground">{{ zonesInfoText }}</p>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted"
            @click="openGeoJsonPicker"
          >
            Загрузить заново
          </button>
        </div>

        <div v-else class="flex flex-wrap items-end gap-3">
          <div class="min-w-[260px] flex-1">
            <label class="mb-1 block text-xs font-medium text-muted-foreground">GeoJSON зон доставки</label>
            <input
              ref="geoJsonInputRef"
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              class="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              @change="handleGeoJsonUpload"
            />
          </div>
        </div>

        <input
          ref="geoJsonInputRefHidden"
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          class="hidden"
          @change="handleGeoJsonUpload"
        />

        <p class="mt-2 text-xs text-muted-foreground">Поддерживаются Polygon и MultiPolygon. Зоны сохраняются для выбранного подразделения.</p>
        <p v-if="zonesInfoText && !zonesMeta.zonesConfigured" class="mt-1 text-xs text-muted-foreground">{{ zonesInfoText }}</p>
        <p v-if="zonesActionMessage" class="mt-1 text-xs text-foreground">{{ zonesActionMessage }}</p>
      </Card>
    </div>

    <div v-if="pageError" class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span>{{ pageError }}</span>
    </div>

    <div v-if="report?.warningMessage" class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
      {{ report.warningMessage }}
    </div>

    <div v-if="!report && !isPageLoading" class="rounded-lg border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
      Выберите период, чтобы отобразить интенсивность заказов по зонам.
    </div>

    <template v-if="report || isPageLoading">
      <section>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Заказов" :value="report?.summary?.totalOrders ?? null" format="number" icon="ShoppingCart" :loading="isPageLoading" />
          <MetricCard
            title="Опозданий"
            :value="report?.summary?.delayedOrders ?? null"
            format="number"
            icon="AlertTriangle"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard
            title="Доля опозданий"
            :value="report?.summary?.delayRate ?? null"
            format="percent"
            icon="Percent"
            :inverse="true"
            :loading="isPageLoading"
          />
          <MetricCard title="Выручка" :value="report?.summary?.totalRevenue ?? null" format="currency" icon="DollarSign" :loading="isPageLoading" />
        </div>
      </section>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-foreground">Интенсивность заказов по зонам</h3>
          <span class="text-xs text-muted-foreground">Обновлено: {{ formatDateTime(report?.generatedAt) }}</span>
        </div>

        <div class="rounded-lg border border-border/70">
          <div ref="mapRef" class="h-[560px] w-full rounded-lg" />
        </div>

        <div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Низкая интенсивность</span>
          <div class="h-2 w-48 rounded-full bg-gradient-to-r from-blue-400 via-lime-400 to-red-500" />
          <span>Высокая интенсивность</span>
        </div>
      </Card>

      <Card class="border-border/70 bg-card/95 p-4 md:p-5">
        <div class="table-shell">
          <Table class="min-w-full border-collapse text-xs">
            <TableHeader>
              <TableRow class="bg-muted/30 text-muted-foreground">
                <TableHead class="text-left font-medium">Зона</TableHead>
                <TableHead class="text-left font-medium">Заказов</TableHead>
                <TableHead class="text-left font-medium">Выручка</TableHead>
                <TableHead class="text-left font-medium">Среднее время, hh:mm:ss</TableHead>
                <TableHead class="text-left font-medium">Опозданий</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in report?.zoneStats || []" :key="item.zoneName" class="border-t border-border/50">
                <TableCell class="text-foreground">{{ item.zoneName }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.orders) }}</TableCell>
                <TableCell class="text-foreground">{{ formatCurrency(item.revenue) }}</TableCell>
                <TableCell class="text-foreground">{{ formatDuration(item.avgReceiveMinutes) }}</TableCell>
                <TableCell class="text-foreground">{{ formatNumber(item.delayedOrders) }}</TableCell>
              </TableRow>
              <TableRow v-if="(report?.zoneStats || []).length === 0" class="border-t border-border/50">
                <TableCell colspan="5" class="text-center text-muted-foreground">Для выбранного периода нет привязки заказов к зонам</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import { useReportsStore } from "../stores/reports";
import { useFiltersStore } from "../stores/filters";
import { useRevenueStore } from "../stores/revenue";
import { reportsApi } from "../api/reports";
import PageFilters from "../components/filters/PageFilters.vue";
import ReportPageHeader from "@/components/reports/ReportPageHeader.vue";
import Card from "../components/ui/Card.vue";
import MetricCard from "../components/metrics/MetricCard.vue";
import { formatMinutesToHms, formatTimeHms } from "../lib/utils";
import { getFeatureReadiness } from "@/config/featureReadiness";

import Table from "@/components/ui/Table.vue";
import TableBody from "@/components/ui/TableBody.vue";
import TableCell from "@/components/ui/TableCell.vue";
import TableHead from "@/components/ui/TableHead.vue";
import TableHeader from "@/components/ui/TableHeader.vue";
import TableRow from "@/components/ui/TableRow.vue";

const reportsStore = useReportsStore();
const filtersStore = useFiltersStore();
const revenueStore = useRevenueStore();
const route = useRoute();

const report = computed(() => reportsStore.courierMapReport);
const isPageLoading = computed(() => reportsStore.isLoadingCourierMap);
const pageError = computed(() => reportsStore.error);
const lastLoadedAt = ref(null);
const readiness = computed(() => getFeatureReadiness(route.path));
const trustCoverage = computed(() => {
  if (!route.query.org) {
    return `Все подразделения (${revenueStore.organizations.length || 0})`;
  }
  const selectedOrganization = revenueStore.organizations.find((organization) => organization.id === revenueStore.currentOrganizationId);
  return selectedOrganization?.name || "Выбранное подразделение";
});

const zonesMeta = ref({
  organizationId: null,
  zonesConfigured: false,
  zonesCount: 0,
  updatedAt: null,
});
const zonesActionMessage = ref("");
const geoJsonInputRef = ref(null);
const geoJsonInputRefHidden = ref(null);

const mapRef = ref(null);
let mapInstance = null;
let zonesLayer = null;
let heatLayer = null;

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_HEAT_JS_URL = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";

const zonesInfoText = computed(() => {
  if (!zonesMeta.value?.organizationId) return "";
  if (!zonesMeta.value.zonesConfigured) return "Зоны для этого подразделения еще не загружены.";

  const count = Number(zonesMeta.value.zonesCount || 0);
  const updatedAt = zonesMeta.value.updatedAt ? formatTimeHms(zonesMeta.value.updatedAt) : "—";
  return `Загружено зон: ${count}. Обновлено: ${updatedAt}.`;
});

function loadCssOnce(href) {
  if (document.querySelector(`link[data-map-asset="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.mapAsset = href;
  document.head.appendChild(link);
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-map-asset="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.mapAsset = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.body.appendChild(script);
  });
}

async function ensureMap() {
  if (typeof window === "undefined") return null;
  loadCssOnce(LEAFLET_CSS_URL);
  if (!window.L) {
    await loadScriptOnce(LEAFLET_JS_URL);
  }
  if (!window.L?.heatLayer) {
    await loadScriptOnce(LEAFLET_HEAT_JS_URL);
  }

  if (!mapRef.value) return null;
  if (mapInstance) return mapInstance;

  const L = window.L;
  mapInstance = L.map(mapRef.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView([55.751244, 37.618423], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapInstance);

  return mapInstance;
}

function normalizeCoordinates(coordinates = []) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
}

function getPrimaryRing(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return normalizeCoordinates(geometry.coordinates?.[0] || []);
  }
  if (geometry.type === "MultiPolygon") {
    return normalizeCoordinates(geometry.coordinates?.[0]?.[0] || []);
  }
  return [];
}

function getRingBounds(ring = []) {
  if (!ring.length) return null;
  let minLng = ring[0][0];
  let maxLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];

  for (const point of ring) {
    minLng = Math.min(minLng, point[0]);
    maxLng = Math.max(maxLng, point[0]);
    minLat = Math.min(minLat, point[1]);
    maxLat = Math.max(maxLat, point[1]);
  }

  return { minLng, maxLng, minLat, maxLat };
}

function pointInPolygon(lng, lat, ring = []) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getCentroid(ring = []) {
  if (!ring.length) return null;
  const sum = ring.reduce(
    (acc, point) => {
      acc.lng += point[0];
      acc.lat += point[1];
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return {
    lng: sum.lng / ring.length,
    lat: sum.lat / ring.length,
  };
}

function intensityToColor(intensity) {
  const value = Math.max(0, Math.min(1, Number(intensity || 0)));
  if (value > 0.85) return "#ef4444";
  if (value > 0.65) return "#f97316";
  if (value > 0.45) return "#eab308";
  if (value > 0.25) return "#22c55e";
  return "#3b82f6";
}

function buildHeatPointsFromZones(zonesGeoJson) {
  const points = [];
  const features = Array.isArray(zonesGeoJson?.features) ? zonesGeoJson.features : [];

  for (const feature of features) {
    const ring = getPrimaryRing(feature);
    if (!ring.length) continue;

    const bounds = getRingBounds(ring);
    if (!bounds) continue;

    const intensity = Math.max(0.05, Number(feature?.properties?.heatIntensity || 0));
    const orders = Number(feature?.properties?.orders || 0);
    if (orders <= 0) continue;

    const centroid = getCentroid(ring);
    if (centroid) {
      points.push([centroid.lat, centroid.lng, intensity]);
    }

    const samples = Math.max(12, Math.min(80, Math.round(orders / 2)));
    for (let attempt = 0, accepted = 0; attempt < samples * 8 && accepted < samples; attempt += 1) {
      const lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
      const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
      if (pointInPolygon(lng, lat, ring)) {
        points.push([lat, lng, intensity]);
        accepted += 1;
      }
    }
  }

  return points;
}

async function redrawMapLayers() {
  const map = await ensureMap();
  if (!map) return;
  const L = window.L;

  if (zonesLayer) {
    map.removeLayer(zonesLayer);
    zonesLayer = null;
  }
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const zonesGeoJson = report.value?.zones;
  if (!zonesGeoJson?.features?.length) {
    return;
  }

  zonesLayer = L.geoJSON(zonesGeoJson, {
    style: (feature) => {
      const intensity = Number(feature?.properties?.heatIntensity || 0);
      return {
        color: "#22c55e",
        weight: 2,
        fillColor: intensityToColor(intensity),
        fillOpacity: 0.2 + intensity * 0.55,
      };
    },
    onEachFeature(feature, layer) {
      const props = feature?.properties || {};
      const title = props.name || props.zoneName || props.zone || props.title || "Зона";
      const orders = Number(props.orders || 0).toLocaleString("ru-RU");
      const revenue = Number(props.revenue || 0).toLocaleString("ru-RU");
      const avgReceiveTime = formatDuration(props.avgReceiveMinutes);

      layer.bindPopup(
        `<strong>${title}</strong><br/>Заказов: ${orders}<br/>Выручка: ${revenue}<br/>Среднее время получения заказа: ${avgReceiveTime}.`,
      );
    },
  }).addTo(map);

  const heatPoints = buildHeatPointsFromZones(zonesGeoJson);
  if (heatPoints.length > 0) {
    heatLayer = L.heatLayer(heatPoints, {
      radius: 26,
      blur: 22,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: {
        0.15: "#3b82f6",
        0.4: "#22c55e",
        0.65: "#fde047",
        0.9: "#f97316",
        1.0: "#ef4444",
      },
    }).addTo(map);
  }

  const bounds = zonesLayer.getBounds?.();
  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds.pad(0.08));
  }
}

async function loadZonesMeta(organizationId) {
  if (!organizationId) return;

  try {
    const response = await reportsApi.getDeliveryZones({ organizationId });
    zonesMeta.value = {
      organizationId,
      zonesConfigured: Boolean(response?.data?.zonesConfigured),
      zonesCount: Number(response?.data?.zonesCount || 0),
      updatedAt: response?.data?.updatedAt || null,
    };
  } catch (error) {
    zonesMeta.value = {
      organizationId,
      zonesConfigured: false,
      zonesCount: 0,
      updatedAt: null,
    };
    console.error("Ошибка загрузки зон доставки", error);
  }
}

async function handleGeoJsonUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const organizationId = revenueStore.currentOrganizationId;
  if (!organizationId) {
    zonesActionMessage.value = "Сначала выберите подразделение";
    return;
  }

  try {
    const text = await file.text();
    const geoJson = JSON.parse(text);
    await reportsApi.saveDeliveryZones({ organizationId, geoJson });
    zonesActionMessage.value = "Зоны успешно сохранены";
    await loadZonesMeta(organizationId);
    await reloadReportIfReady();
  } catch (error) {
    zonesActionMessage.value = "Не удалось сохранить зоны. Проверьте формат GeoJSON";
    console.error("Ошибка сохранения зон", error);
  } finally {
    const input = event?.target;
    if (input && typeof input.value === "string") {
      input.value = "";
    }
  }
}

function openGeoJsonPicker() {
  const hiddenInput = geoJsonInputRefHidden.value;
  if (hiddenInput) {
    hiddenInput.click();
    return;
  }

  const regularInput = geoJsonInputRef.value;
  if (regularInput) {
    regularInput.click();
  }
}

async function clearZones() {
  const organizationId = revenueStore.currentOrganizationId;
  if (!organizationId) return;

  try {
    await reportsApi.saveDeliveryZones({
      organizationId,
      geoJson: { type: "FeatureCollection", features: [] },
    });
    zonesActionMessage.value = "Зоны очищены";
    await loadZonesMeta(organizationId);
    await reloadReportIfReady();
  } catch (error) {
    zonesActionMessage.value = "Не удалось очистить зоны";
    console.error("Ошибка очистки зон", error);
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  return formatTimeHms(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDuration(value) {
  return formatMinutesToHms(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

async function reloadReportIfReady() {
  const organizationId = revenueStore.currentOrganizationId;
  const dateFrom = filtersStore.dateFrom;
  const dateTo = filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  await reportsStore.loadCourierMap({ organizationId, dateFrom, dateTo });
}

async function handleApply(payload = {}) {
  const organizationId = payload.organizationId ?? revenueStore.currentOrganizationId;
  const dateFrom = payload.dateFrom ?? filtersStore.dateFrom;
  const dateTo = payload.dateTo ?? filtersStore.dateTo;
  if (!organizationId || !dateFrom || !dateTo) return;

  revenueStore.setCurrentOrganization(organizationId);
  zonesActionMessage.value = "";
  await loadZonesMeta(organizationId);
  const result = await reportsStore.loadCourierMap({ organizationId, dateFrom, dateTo });
  if (result) {
    lastLoadedAt.value = new Date();
  }
}

onMounted(async () => {
  if (revenueStore.organizations.length === 0) {
    await revenueStore.loadOrganizations();
  }

  await ensureMap();
  if (revenueStore.currentOrganizationId) {
    await loadZonesMeta(revenueStore.currentOrganizationId);
  }
  if (!report.value) {
    await handleApply();
  }
});

watch(
  () => revenueStore.currentOrganizationId,
  async (organizationId) => {
    if (!organizationId) return;
    zonesActionMessage.value = "";
    await loadZonesMeta(organizationId);
  },
);

watch(report, async () => {
  await redrawMapLayers();
});

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  zonesLayer = null;
  heatLayer = null;
});
</script>
