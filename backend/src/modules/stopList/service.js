const organizationsService = require("../organizations/service");
const { TTLCache } = require("../shared/cache");
const { IikoService, IikoApiError } = require("./iikoService");
const topDishesService = require("../topDishes/service");
const stopListSnapshotRepository = require("./snapshotRepository");

const DEFAULT_NORMALIZED_CACHE_TTL_MS = 20 * 1000;
const DEFAULT_RAW_CACHE_TTL_MS = 45 * 1000;
const DEFAULT_LOST_REVENUE_LOOKBACK_DAYS = 14;

class StopListService {
  constructor() {
    this.iikoService = new IikoService();
    this.normalizedCache = new TTLCache(DEFAULT_NORMALIZED_CACHE_TTL_MS);
    this.inflightRefreshes = new Map();
  }

  round(value, digits = 2) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const factor = 10 ** digits;
    return Math.round(numericValue * factor) / factor;
  }

  parseIdQuery(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .flatMap((part) => String(part).split(","))
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  parseBoolean(value) {
    if (typeof value === "boolean") return value;
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return ["1", "true", "yes", "y"].includes(normalized);
  }

  parseTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  toIsoOrNull(value) {
    const ts = this.parseTimestamp(value);
    return ts ? new Date(ts).toISOString() : null;
  }

  getDuration(startedAt, endedAt = null) {
    const startTs = this.parseTimestamp(startedAt);
    if (!startTs) {
      return {
        inStopMinutes: null,
        inStopHours: null,
        inStopDays: null,
        warning: null,
      };
    }

    const endTs = this.parseTimestamp(endedAt) || Date.now();
    if (endTs < startTs) {
      return {
        inStopMinutes: null,
        inStopHours: null,
        inStopDays: null,
        warning: "endedAt раньше startedAt, длительность не рассчитана",
      };
    }

    const durationMinutes = (endTs - startTs) / (1000 * 60);

    return {
      inStopMinutes: this.round(durationMinutes, 0),
      inStopHours: this.round(durationMinutes / 60, 2),
      inStopDays: this.round(durationMinutes / (60 * 24), 2),
      warning: null,
    };
  }

  _buildCacheKey(organizationIds = [], timezone = "") {
    const ids = organizationIds
      .map((id) => String(id).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(",");

    return `${ids}::${String(timezone || "UTC")}`;
  }

  _isCacheValid(expiresAt) {
    return Number(expiresAt) > Date.now();
  }

  _deduplicateItems(items = []) {
    const byId = new Map();

    for (const item of items) {
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
        continue;
      }

      const existingStarted = this.parseTimestamp(existing.startedAt) || 0;
      const nextStarted = this.parseTimestamp(item.startedAt) || 0;
      if (nextStarted > existingStarted) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values());
  }

  _sortItems(items = []) {
    return [...items].sort((a, b) => {
      const aStarted = this.parseTimestamp(a.startedAt) || 0;
      const bStarted = this.parseTimestamp(b.startedAt) || 0;
      return bStarted - aStarted;
    });
  }

  _normalizeKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/ё/gi, "е")
      .replace(/[\[\]{}()]/g, " ")
      .replace(/[\\/_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  _looksLikeTechnicalName(name = "", entityId = "") {
    const normalizedName = String(name || "").trim();
    const normalizedId = String(entityId || "").trim();
    const lowerName = normalizedName.toLowerCase();

    if (!normalizedName) return true;
    if (["без названия", "unknown", "null", "undefined", "n/a", "none"].includes(lowerName)) return true;
    if (normalizedId && lowerName === normalizedId.toLowerCase()) return true;

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedName);
  }

  _buildFallbackEntityName(entityId = "") {
    return "Позиция отсутствует в актуальном меню";
  }

  _resolveLostRevenueLookbackDays(query = {}) {
    const queryValue = Number(query.lostRevenueLookbackDays);
    if (Number.isFinite(queryValue) && queryValue >= 3 && queryValue <= 60) {
      return Math.round(queryValue);
    }

    const envValue = Number(process.env.STOP_LIST_LOST_REVENUE_LOOKBACK_DAYS);
    if (Number.isFinite(envValue) && envValue >= 3 && envValue <= 60) {
      return Math.round(envValue);
    }

    return DEFAULT_LOST_REVENUE_LOOKBACK_DAYS;
  }

  _buildLookbackRange(days) {
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - days);

    const toIsoDate = (date) => date.toISOString().slice(0, 10);

    return {
      dateFrom: toIsoDate(from),
      dateTo: toIsoDate(now),
      hours: Math.max(1, (now.getTime() - from.getTime()) / (1000 * 60 * 60)),
    };
  }

  async _buildRevenuePerHourIndexByOrganization(organizationIds = [], lookbackDays = DEFAULT_LOST_REVENUE_LOOKBACK_DAYS) {
    const { dateFrom, dateTo, hours } = this._buildLookbackRange(lookbackDays);
    const byOrg = new Map();
    const warnings = [];

    await Promise.all(
      organizationIds.map(async (organizationId) => {
        try {
          const dataset = await topDishesService.getDishesDataset({
            organizationId,
            dateFrom,
            dateTo,
          });
          const dishes = Array.isArray(dataset?.dishes) ? dataset.dishes : [];
          const revenueByEntityId = new Map();
          const revenueByName = new Map();

          for (const dish of dishes) {
            const nameKey = this._normalizeKey(dish?.name);
            const entityId = String(dish?.entityId || "").trim();
            if (!nameKey && !entityId) continue;
            const revenue = Number(dish?.revenue || 0);
            if (!Number.isFinite(revenue) || revenue <= 0) continue;
            const revenuePerHour = revenue / hours;
            if (entityId) {
              revenueByEntityId.set(entityId, revenuePerHour);
            }
            revenueByName.set(nameKey, revenuePerHour);
          }

          byOrg.set(String(organizationId), {
            byEntityId: revenueByEntityId,
            byName: revenueByName,
          });

          if (dataset?.degraded) {
            warnings.push(
              `Оценка упущенной выручки для организации ${organizationId} рассчитана в деградированном режиме (источник продаж частично недоступен).`,
            );
          }
        } catch (error) {
          warnings.push(`Не удалось рассчитать оценку упущенной выручки для организации ${organizationId}: ${error.message || "unknown error"}.`);
          byOrg.set(String(organizationId), {
            byEntityId: new Map(),
            byName: new Map(),
          });
        }
      }),
    );

    return {
      byOrg,
      warnings,
      lookbackDays,
      dateFrom,
      dateTo,
    };
  }

  normalizeItems(items = []) {
    return items.map((item) => {
      const startedAt = this.toIsoOrNull(item.startedAt);
      const endedAt = this.toIsoOrNull(item.endedAt);
      const duration = this.getDuration(startedAt, endedAt);

      return {
        id: String(
          item.id ||
            `${item.organizationId || "unknown-org"}:${item.terminalGroupId || "unknown-tg"}:${item.entityType || "product"}:${item.entityId || "unknown-entity"}`,
        ),
        organizationId: String(item.organizationId || ""),
        organizationName: String(item.organizationName || ""),
        terminalGroupId: String(item.terminalGroupId || ""),
        terminalGroupName: String(item.terminalGroupName || ""),
        entityId: String(item.entityId || ""),
        entityName: String(item.entityName || "Без названия"),
        nameSource: this._looksLikeTechnicalName(item.entityName, item.entityId) ? "unresolved" : "iiko",
        entityType: ["product", "modifier", "group"].includes(item.entityType) ? item.entityType : "product",
        balance: Number.isFinite(Number(item.balance)) ? Number(item.balance) : null,
        isInStop: item.isInStop !== false,
        startedAt,
        endedAt,
        status: item.status || null,
        reason: item.reason || "",
        inStopMinutes: duration.inStopMinutes,
        inStopHours: duration.inStopHours,
        inStopDays: duration.inStopDays,
        durationWarning: duration.warning,
        estimatedLostRevenue: null,
        avgRevenuePerHour: null,
        raw: item.raw || null,
      };
    });
  }

  enrichEstimatedLostRevenue(items = [], revenueIndex = new Map()) {
    return items.map((item) => {
      const inStopHours = Number(item.inStopHours);
      const nameKey = this._normalizeKey(item.entityName);
      const entityId = String(item.entityId || "").trim();
      const hasLookupKey = Boolean(entityId || nameKey);
      const orgMap = revenueIndex.get(String(item.organizationId)) || {};
      const byEntityId = orgMap.byEntityId instanceof Map ? orgMap.byEntityId : new Map();
      const byName = orgMap.byName instanceof Map ? orgMap.byName : new Map();
      const avgRevenuePerHour = Number((entityId && byEntityId.get(entityId)) || byName.get(nameKey));

      if (!hasLookupKey || !Number.isFinite(inStopHours) || inStopHours <= 0 || !Number.isFinite(avgRevenuePerHour) || avgRevenuePerHour <= 0) {
        return {
          ...item,
          avgRevenuePerHour: Number.isFinite(avgRevenuePerHour) ? this.round(avgRevenuePerHour, 2) : null,
          estimatedLostRevenue: null,
        };
      }

      return {
        ...item,
        avgRevenuePerHour: this.round(avgRevenuePerHour, 2),
        estimatedLostRevenue: this.round(avgRevenuePerHour * inStopHours, 2),
      };
    });
  }

  enrichEntityNames(items = [], nomenclatureIndex = null) {
    const products = nomenclatureIndex?.products instanceof Map ? nomenclatureIndex.products : new Map();
    const modifiers = nomenclatureIndex?.modifiers instanceof Map ? nomenclatureIndex.modifiers : new Map();
    const groups = nomenclatureIndex?.groups instanceof Map ? nomenclatureIndex.groups : new Map();

    const pickNameByType = (entityType, entityId) => {
      const safeEntityId = String(entityId || "").trim();
      if (!safeEntityId) return "";

      if (entityType === "modifier") {
        return modifiers.get(safeEntityId) || products.get(safeEntityId) || "";
      }

      if (entityType === "group") {
        return groups.get(safeEntityId) || products.get(safeEntityId) || "";
      }

      return products.get(safeEntityId) || "";
    };

    return items.map((item) => {
      const currentName = String(item.entityName || "").trim();
      const shouldResolveByDictionary = this._looksLikeTechnicalName(currentName, item.entityId);

      if (!shouldResolveByDictionary) {
        return {
          ...item,
          nameSource: item.nameSource || "iiko",
        };
      }

      const resolvedName = pickNameByType(item.entityType, item.entityId);
      if (resolvedName) {
        return {
          ...item,
          entityName: resolvedName,
          nameSource: "menu",
        };
      }

      return {
        ...item,
        entityName: this._buildFallbackEntityName(item.entityId),
        nameSource: "fallback",
      };
    });
  }

  _buildMeta({ generatedAt, iikoCount, deduplicatedCount, warnings = [], isPartial = false }) {
    return {
      generatedAt,
      source: "iiko-cloud-stop-lists",
      isPartial,
      warnings,
      counts: {
        iiko: iikoCount,
        deduplicated: deduplicatedCount,
      },
    };
  }

  async getStopLists(query = {}) {
    const refresh = this.parseBoolean(query.refresh);
    const requestedOrganizationIds = this.parseIdQuery(query.organizationId ?? query.id ?? query.ids);
    const attachOrganizations = String(query.includeOrganizations).toLowerCase() !== "false";
    const timezone = query.timezone || "Europe/Moscow";

    const allOrganizations = await organizationsService.getOrganizations();

    const organizationIds =
      requestedOrganizationIds.length > 0
        ? requestedOrganizationIds
        : allOrganizations.map((organization) => String(organization.id)).filter(Boolean);

    if (organizationIds.length === 0) {
      throw new IikoApiError("Не удалось определить organizationId для запроса стоп-листа.", 400);
    }

    const cacheKey = this._buildCacheKey(organizationIds, timezone);
    const cached = this.normalizedCache.get(cacheKey);

    if (!refresh && cached) {
      return cached;
    }

    const organizations = allOrganizations.filter((organization) => organizationIds.includes(String(organization.id)));
    const orgNamesById = new Map(organizations.map((organization) => [String(organization.id), organization.name]));
    const lostRevenueLookbackDays = this._resolveLostRevenueLookbackDays(query);

    if (refresh) {
      const inflight = this.inflightRefreshes.get(cacheKey);
      if (inflight) {
        return inflight;
      }
    }

    const loadPromise = (async () => {
      const token = await this.iikoService.fetchAccessToken({ forceRefresh: refresh });
      const iikoResult = await this.iikoService.fetchStopListsWithProducts(token, organizationIds, organizations, {
        forceRefresh: refresh,
        rawCacheTtlMs: DEFAULT_RAW_CACHE_TTL_MS,
      });
      const menuV2Index = await this.iikoService.fetchMenuV2Index(token, organizationIds, {
        forceRefresh: refresh,
      });
      const lostRevenueIndexResult = await this._buildRevenuePerHourIndexByOrganization(organizationIds, lostRevenueLookbackDays);

      const rawItems = Array.isArray(iikoResult.normalizedItems) ? iikoResult.normalizedItems : [];
      const normalizedWithNames = this.enrichEntityNames(this.normalizeItems(rawItems), menuV2Index).map((item) => ({
        ...item,
        organizationName: item.organizationName || orgNamesById.get(item.organizationId) || "",
      }));
      const normalized = this.enrichEstimatedLostRevenue(normalizedWithNames, lostRevenueIndexResult.byOrg);

      const deduplicatedItems = this._deduplicateItems(normalized);
      const sortedItems = this._sortItems(deduplicatedItems);

      const missingStartCount = sortedItems.filter((item) => !item.startedAt).length;
      const warnings = [];
      if (missingStartCount > 0) {
        warnings.push(`У ${missingStartCount} позиций нет startedAt, длительность не рассчитана.`);
      }
      const invalidDurationCount = sortedItems.filter((item) => item.durationWarning).length;
      if (invalidDurationCount > 0) {
        warnings.push(`У ${invalidDurationCount} позиций endedAt раньше startedAt, длительность не рассчитана.`);
      }
      const fallbackNameCount = sortedItems.filter((item) => item.nameSource === "fallback").length;
      if (fallbackNameCount > 0) {
        warnings.push(`У ${fallbackNameCount} позиций название не найдено в актуальном меню, показан fallback.`);
      }
      warnings.push(...lostRevenueIndexResult.warnings);
      const estimatedLostRevenueTotal = this.round(
        sortedItems.reduce((sum, item) => sum + (Number.isFinite(Number(item.estimatedLostRevenue)) ? Number(item.estimatedLostRevenue) : 0), 0),
        2,
      );
      const estimatedLostRevenueItems = sortedItems.filter((item) => Number.isFinite(Number(item.estimatedLostRevenue))).length;
      const resolvedFromMenuCount = sortedItems.filter((item) => item.nameSource === "menu").length;

      const generatedAt = new Date().toISOString();
      const payload = {
        data: {
          items: sortedItems,
        },
        meta: this._buildMeta({
          generatedAt,
          iikoCount: rawItems.length,
          deduplicatedCount: sortedItems.length,
          warnings,
          isPartial: false,
        }),
      };
      payload.meta.lostRevenue = {
        lookbackDays: lostRevenueIndexResult.lookbackDays,
        periodDateFrom: lostRevenueIndexResult.dateFrom,
        periodDateTo: lostRevenueIndexResult.dateTo,
        estimatedLostRevenueTotal,
        estimatedLostRevenueItems,
        currency: "RUB",
      };
      payload.meta.quality = {
        totalItems: sortedItems.length,
        resolvedFromMenuCount,
        fallbackNameCount,
        estimatedLostRevenueItems,
      };

      if (attachOrganizations) {
        payload.data.organizations = organizations;
      }

      try {
        await stopListSnapshotRepository.appendSnapshots(sortedItems, generatedAt);
      } catch (snapshotError) {
        payload.meta.warnings.push(`Не удалось сохранить снапшоты стоп-листа: ${snapshotError.message || "unknown error"}.`);
      }

      this.normalizedCache.set(cacheKey, payload, DEFAULT_NORMALIZED_CACHE_TTL_MS);

      return payload;
    })();

    if (refresh) {
      this.inflightRefreshes.set(cacheKey, loadPromise);
    }

    try {
      return await loadPromise;
    } finally {
      if (refresh) {
        this.inflightRefreshes.delete(cacheKey);
      }
    }
  }
}

module.exports = {
  stopListService: new StopListService(),
  IikoApiError,
};
