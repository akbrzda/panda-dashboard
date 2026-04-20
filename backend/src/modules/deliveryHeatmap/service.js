const { TTLCache } = require("../shared/cache");
const olapRepository = require("../shared/olapRepository");
const deliveryZonesService = require("../deliveryZones");
const deliveryReports = require("../shared/deliveryReports");

class DeliveryHeatmapService {
  constructor() {
    this.cacheTtlMs = Number(process.env.REPORTS_HEATMAP_CACHE_TTL_MS || 45000);
    this.cache = new TTLCache(this.cacheTtlMs);
    this.inflight = new Map();
  }

  buildCacheKey({ organizationId, dateFrom, dateTo, terminalGroupId = null, statuses = [], sourceKeys = [], courierIds = [], zoneVersion = 0 }) {
    const norm = (v) =>
      String(v || "")
        .trim()
        .toLowerCase() || "__all__";
    const normArr = (arr) =>
      Array.isArray(arr)
        ? arr
            .map((s) =>
              String(s || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean)
            .sort()
            .join(",")
        : "";
    const nFrom = String(dateFrom || "").slice(0, 10);
    const nTo = String(dateTo || "").slice(0, 10);
    return `${organizationId}:${norm(terminalGroupId)}:${nFrom}:${nTo}:${normArr(statuses)}:${normArr(sourceKeys)}:${normArr(courierIds)}:${Number(zoneVersion || 0)}`;
  }

  clearCacheByOrganization(organizationId) {
    const prefix = `${String(organizationId)}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  validatePeriod(dateFrom, dateTo, maxDays = 30) {
    const start = new Date(dateFrom).getTime();
    const end = new Date(dateTo).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Некорректный период для тепловой карты");
    if (end < start) throw new Error("dateTo не может быть раньше dateFrom");
    if ((end - start) / (24 * 60 * 60 * 1000) > maxDays) throw new Error(`Слишком большой период. Максимум ${maxDays} дней`);
  }

  async getHeatmap({ organizationId, dateFrom, dateTo, terminalGroupId = null, statuses = [], sourceKeys = [], courierIds = [] }) {
    this.validatePeriod(dateFrom, dateTo);
    const timezone = await olapRepository.getOrganizationTimezone(organizationId);
    const zonesPayload = await deliveryZonesService.get({ organizationId, terminalGroupId }).catch(() => ({ geoJson: null, version: 0 }));
    const cacheKey = this.buildCacheKey({
      organizationId,
      dateFrom,
      dateTo,
      terminalGroupId,
      statuses,
      sourceKeys,
      courierIds,
      zoneVersion: zonesPayload.version,
    });

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.inflight.has(cacheKey)) return await this.inflight.get(cacheKey);

    const loadPromise = (async () => {
      const orders = await olapRepository.getCloudDeliveryOrders({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
        timezone,
      });
      const result = {
        ...deliveryReports.buildDeliveryHeatmapReport([], timezone, olapRepository, {
          organizationId,
          terminalGroupId,
          statuses,
          preparedOrders: orders,
          zonesGeoJson: zonesPayload.geoJson,
          zonesVersion: zonesPayload.version,
        }),
        timezone,
        source: "iiko-cloud",
      };
      this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    })();

    this.inflight.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }
}

module.exports = new DeliveryHeatmapService();
