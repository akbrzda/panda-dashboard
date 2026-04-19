const axios = require("axios");
const config = require("../../config");
const { TTLCache } = require("../shared/cache");

const DEFAULT_TOKEN_TTL_MS = 9 * 60 * 1000;
const DEFAULT_RAW_STOP_LIST_TTL_MS = 45 * 1000;
const DEFAULT_NOMENCLATURE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MENU_V2_TTL_MS = 10 * 60 * 1000;

const sharedCache = {
  tokens: new TTLCache(DEFAULT_TOKEN_TTL_MS),
  rawStopLists: new TTLCache(DEFAULT_RAW_STOP_LIST_TTL_MS),
  nomenclature: new TTLCache(DEFAULT_NOMENCLATURE_TTL_MS),
  menuV2: new TTLCache(DEFAULT_MENU_V2_TTL_MS),
};

class IikoApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = "IikoApiError";
    this.status = status;
    this.details = details;
  }
}

class IikoService {
  constructor() {
    this.baseUrl = config.iiko.baseUrl;
    this.apiLogin = config.iiko.apiLogin;
    this.timeout = 30000;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  _ensureApiLogin() {
    if (!this.apiLogin) {
      throw new IikoApiError("Не задан IIKO_API_LOGIN", 500);
    }
  }

  _wrapError(error, fallbackMessage) {
    if (error instanceof IikoApiError) {
      return error;
    }

    const status = error.response?.status || 502;
    const message =
      error.response?.data?.description ||
      error.response?.data?.errorDescription ||
      error.response?.data?.message ||
      error.message ||
      fallbackMessage;

    return new IikoApiError(message, status, error.response?.data || null);
  }

  _isCacheValid(expiresAt) {
    return Number(expiresAt) > Date.now();
  }

  _buildRawStopListCacheKey(organizationIds = []) {
    return organizationIds
      .map((id) => String(id).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(",");
  }

  _buildNomenclatureCacheKey(organizationIds = []) {
    return this._buildRawStopListCacheKey(organizationIds);
  }

  _buildMenuV2CacheKey(organizationIds = [], externalMenuId = "") {
    return `${this._buildRawStopListCacheKey(organizationIds)}::${String(externalMenuId || "").trim()}`;
  }

  _parseDateToIso(value) {
    if (!value) return null;
    const source = String(value).trim();
    if (!source) return null;

    const normalizedSource = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(source) ? `${source.replace(" ", "T")}Z` : source;
    const date = new Date(normalizedSource);

    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  _resolveTokenTtlMs(responseData) {
    const candidates = [
      responseData?.expiresIn,
      responseData?.expires_in,
      responseData?.tokenTtl,
      responseData?.ttl,
      responseData?.tokenExpiresIn,
    ];

    for (const value of candidates) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.max(60, seconds - 30) * 1000;
      }
    }

    return DEFAULT_TOKEN_TTL_MS;
  }

  _resolveEntityType(item = {}) {
    const explicitType = String(item.entityType || item.itemType || item.type || item.stopListItemType || "")
      .trim()
      .toLowerCase();

    if (["product", "modifier", "group"].includes(explicitType)) {
      return explicitType;
    }

    if (item.modifierId || item.productModifierId || item.modifierGroupId || item.modifier?.id) {
      return "modifier";
    }

    if (item.productGroupId || item.groupId || item.menuGroupId || item.categoryId) {
      return "group";
    }

    return "product";
  }

  _resolveEntity(item = {}) {
    const entityType = this._resolveEntityType(item);
    const product = item.product || {};
    const modifier = item.modifier || {};
    const group = item.group || item.productGroup || {};

    if (entityType === "modifier") {
      const entityId = item.modifierId || item.productModifierId || modifier.id || item.id || "";
      const entityName = item.modifierName || modifier.name || item.name || item.itemName || "";
      return {
        entityType,
        entityId: String(entityId || ""),
        entityName: String(entityName || ""),
      };
    }

    if (entityType === "group") {
      const entityId = item.productGroupId || item.groupId || item.menuGroupId || group.id || item.id || "";
      const entityName = item.groupName || item.productGroupName || group.name || item.name || item.itemName || "";
      return {
        entityType,
        entityId: String(entityId || ""),
        entityName: String(entityName || ""),
      };
    }

    const entityId = item.productId || product.id || item.id || "";
    const entityName = item.productFullName || item.productName || product.fullName || product.name || item.itemName || item.name || "";

    return {
      entityType: "product",
      entityId: String(entityId || ""),
      entityName: String(entityName || ""),
    };
  }

  _hasEntityMarkers(item = {}) {
    if (!item || typeof item !== "object") return false;
    return Boolean(
      item.productId ||
        item.modifierId ||
        item.productModifierId ||
        item.productGroupId ||
        item.groupId ||
        item.menuGroupId ||
        item.entityId,
    );
  }

  _collectNormalizedItemFromNode(node = {}, context = {}, orgMap = new Map()) {
    const organizationId = String(node.organizationId || node.orgId || context.organizationId || "");
    const organizationName =
      String(node.organizationName || node.organization?.name || context.organizationName || orgMap.get(organizationId) || "");
    const terminalGroupId = String(node.terminalGroupId || node.terminalGroup?.id || context.terminalGroupId || "");
    const terminalGroupName = String(node.terminalGroupName || node.terminalGroup?.name || node.departmentName || context.terminalGroupName || "");
    const entity = this._resolveEntity(node);
    const startedAt = this._parseDateToIso(node.openedAt || node.dateAdd || node.date || node.startDate || node.createdAt || null);
    const endedAt = this._parseDateToIso(node.closedAt || node.endDate || null);
    const status = String(node.status || node.state || "").trim() || null;
    const isInStop = endedAt ? false : node.isInStop === false ? false : node.isInStopList === false ? false : true;
    const normalizedEntityName =
      String(entity.entityName || node.entityName || node.productName || node.itemName || node.name || "").trim() || "Без названия";
    const safeEntityId = String(entity.entityId || node.entityId || node.productId || node.id || "").trim();

    // Не пропускаем в итог контейнеры без сущности.
    if (!safeEntityId && !this._hasEntityMarkers(node)) {
      return null;
    }

    return {
      id: `${organizationId || "unknown-org"}:${terminalGroupId || "unknown-tg"}:${entity.entityType}:${safeEntityId || "unknown-entity"}`,
      organizationId,
      organizationName,
      terminalGroupId,
      terminalGroupName,
      entityId: safeEntityId,
      entityName: normalizedEntityName,
      entityType: entity.entityType,
      balance: Number(node.balance || 0),
      reason: String(node.reason || node.comment || context.reason || ""),
      isInStop,
      startedAt,
      endedAt,
      status,
      raw: {
        groupId: String(context.groupId || ""),
        itemId: String(node.id || ""),
        sku: String(node.sku || node.productCode || ""),
        productCode: String(node.productCode || ""),
      },
    };
  }

  _collectNomenclatureEntityMaps(payload = {}) {
    const productMap = new Map();
    const modifierMap = new Map();
    const groupMap = new Map();
    const visited = new Set();

    const rememberEntity = (map, ids, name) => {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) return;

      const candidates = Array.isArray(ids) ? ids : [ids];
      for (const id of candidates) {
        const normalizedId = String(id || "").trim();
        if (!normalizedId) continue;
        if (!map.has(normalizedId)) {
          map.set(normalizedId, normalizedName);
        }
      }
    };

    const rememberProductEntity = (value = {}, fallbackName = "") => {
      if (!value || typeof value !== "object") return;

      const name = String(value.name || value.productName || value.fullName || value.title || fallbackName || "").trim();
      if (!name) return;

      rememberEntity(
        productMap,
        [value.id, value.productId, value.itemId, value.product?.id, value.product?.productId, value.product?.itemId, value.externalId],
        name,
      );

      if (Array.isArray(value.itemSizes)) {
        for (const itemSize of value.itemSizes) {
          const itemSizeName = String(itemSize?.name || name).trim() || name;
          rememberEntity(productMap, [itemSize?.id, itemSize?.itemId, itemSize?.productId, itemSize?.sizeId], itemSizeName);
        }
      }

      if (Array.isArray(value.sizePrices)) {
        for (const sizePrice of value.sizePrices) {
          const sizePriceName = String(sizePrice?.name || name).trim() || name;
          rememberEntity(productMap, [sizePrice?.id, sizePrice?.itemId, sizePrice?.productId, sizePrice?.sizeId], sizePriceName);
        }
      }
    };

    const walk = (value) => {
      if (!value || typeof value !== "object") return;
      if (visited.has(value)) return;
      visited.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
        return;
      }

      const id = value.id || value.productId || value.modifierId || value.groupId || value.itemId;
      const name = value.name || value.productName || value.fullName || value.title;
      const marker = String(value.type || value.itemType || value.entityType || value.classifier || "").toLowerCase();

      if (
        value.productCategoryId ||
        marker.includes("product") ||
        marker.includes("dish") ||
        "fatAmount" in value ||
        "sizePrices" in value ||
        "price" in value ||
        "itemSizes" in value ||
        "itemId" in value
      ) {
        rememberProductEntity(value, name);
      }

      if (value.minAmount != null || value.maxAmount != null || marker.includes("modifier") || "defaultAmount" in value) {
        rememberEntity(modifierMap, [id, value.itemId, value.productModifierId], name);
      }

      if (Array.isArray(value.childModifiers) || Array.isArray(value.groups) || Array.isArray(value.itemCategories) || marker.includes("group") || marker.includes("category")) {
        rememberEntity(groupMap, [id, value.productGroupId, value.categoryId], name);
      }

      if ("products" in value && Array.isArray(value.products)) {
        for (const product of value.products) {
          rememberProductEntity(product, product?.name || product?.fullName || name);
        }
      }

      if ("items" in value && Array.isArray(value.items)) {
        for (const item of value.items) {
          rememberProductEntity(item, item?.name || name);
        }
      }

      if ("modifiers" in value && Array.isArray(value.modifiers)) {
        for (const modifier of value.modifiers) {
          rememberEntity(modifierMap, [modifier?.id, modifier?.modifierId, modifier?.itemId], modifier?.name || name);
        }
      }

      if ("groups" in value && Array.isArray(value.groups)) {
        for (const group of value.groups) {
          rememberEntity(groupMap, [group?.id, group?.groupId, group?.categoryId], group?.name || name);
        }
      }

      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    };

    walk(payload);

    return {
      products: productMap,
      modifiers: modifierMap,
      groups: groupMap,
    };
  }

  async fetchMenuV2Index(token, organizationIds = [], options = {}) {
    if (!token) {
      throw new IikoApiError("Не передан токен IIKO", 500);
    }

    const { forceRefresh = false, menuV2TtlMs = DEFAULT_MENU_V2_TTL_MS } = options;
    const normalizedOrganizationIds = (organizationIds || []).map((id) => String(id)).filter(Boolean);
    const externalMenuId = String(config.iiko.externalMenuId || "").trim();
    const cacheKey = this._buildMenuV2CacheKey(normalizedOrganizationIds, externalMenuId);

    if (!forceRefresh && cacheKey) {
      const cached = sharedCache.menuV2.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const requestQueue = [];

    if (externalMenuId) {
      if (normalizedOrganizationIds.length > 0) {
        requestQueue.push({
          url: "/api/2/menu/by_id",
          body: { externalMenuId, organizationIds: normalizedOrganizationIds },
        });
        requestQueue.push({
          url: "/api/2/menu/by_id",
          body: { externalMenuId, organizationId: normalizedOrganizationIds[0] },
        });
      } else {
        requestQueue.push({
          url: "/api/2/menu/by_id",
          body: { externalMenuId },
        });
      }
    }

    if (normalizedOrganizationIds.length > 0) {
      requestQueue.push({
        url: "/api/2/menu",
        body: { organizationIds: normalizedOrganizationIds },
      });
      requestQueue.push({
        url: "/api/2/menu",
        body: { organizationId: normalizedOrganizationIds[0] },
      });
    }

    let menuIndex = null;
    for (const request of requestQueue) {
      try {
        const response = await this.client.post(request.url, request.body, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const maps = this._collectNomenclatureEntityMaps(response.data || {});
        menuIndex = {
          products: maps.products,
          modifiers: maps.modifiers,
          groups: maps.groups,
        };
        if ((menuIndex.products.size || 0) + (menuIndex.modifiers.size || 0) + (menuIndex.groups.size || 0) > 0) {
          break;
        }
      } catch (_) {
        // пробуем следующий вариант запроса
      }
    }

    if (!menuIndex) {
      menuIndex = {
        products: new Map(),
        modifiers: new Map(),
        groups: new Map(),
      };
    }

    // Fallback для окружений, где menu v2 недоступен.
    if ((menuIndex.products.size || 0) + (menuIndex.modifiers.size || 0) + (menuIndex.groups.size || 0) === 0) {
      const nomenclatureIndex = await this.fetchNomenclatureIndex(token, normalizedOrganizationIds, {
        forceRefresh,
      });
      menuIndex = nomenclatureIndex;
    }

    if (cacheKey) {
      sharedCache.menuV2.set(cacheKey, menuIndex, menuV2TtlMs);
    }

    return menuIndex;
  }

  async fetchNomenclatureIndex(token, organizationIds = [], options = {}) {
    if (!token) {
      throw new IikoApiError("Не передан токен IIKO", 500);
    }

    const { forceRefresh = false, nomenclatureTtlMs = DEFAULT_NOMENCLATURE_TTL_MS } = options;
    const normalizedOrganizationIds = (organizationIds || []).map((id) => String(id)).filter(Boolean);
    const cacheKey = this._buildNomenclatureCacheKey(normalizedOrganizationIds);

    if (!forceRefresh && cacheKey) {
      const cached = sharedCache.nomenclature.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const requestVariants = [];
    if (normalizedOrganizationIds.length > 0) {
      requestVariants.push({ organizationIds: normalizedOrganizationIds });
      for (const organizationId of normalizedOrganizationIds) {
        requestVariants.push({ organizationId });
      }
    }

    let lastError = null;
    for (const body of requestVariants) {
      try {
        const response = await this.client.post("/nomenclature", body, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const maps = this._collectNomenclatureEntityMaps(response.data || {});
        const value = {
          products: maps.products,
          modifiers: maps.modifiers,
          groups: maps.groups,
        };

        if (cacheKey) {
          sharedCache.nomenclature.set(cacheKey, value, nomenclatureTtlMs);
        }

        return value;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      // Названия в stop-list опциональны, поэтому не валим весь endpoint из-за /nomenclature.
      return {
        products: new Map(),
        modifiers: new Map(),
        groups: new Map(),
      };
    }

    return {
      products: new Map(),
      modifiers: new Map(),
      groups: new Map(),
    };
  }

  async fetchAccessToken(options = {}) {
    this._ensureApiLogin();
    const { forceRefresh = false } = options;

    const cachedToken = sharedCache.tokens.get("accessToken");
    if (!forceRefresh && cachedToken) {
      return cachedToken;
    }

    try {
      const response = await this.client.post("/access_token", {
        apiLogin: this.apiLogin,
      });

      const token = response.data?.token || response.data;

      if (!token || typeof token !== "string") {
        throw new IikoApiError("IIKO не вернул токен доступа", 502, response.data);
      }

      const ttlMs = this._resolveTokenTtlMs(response.data);
      sharedCache.tokens.set("accessToken", token, ttlMs);

      return token;
    } catch (error) {
      throw this._wrapError(error, "Не удалось получить токен IIKO");
    }
  }

  async fetchOrganizations(token) {
    if (!token) {
      throw new IikoApiError("Не передан токен IIKO", 500);
    }

    try {
      const response = await this.client.post(
        "/organizations",
        {
          organizationIds: [],
          returnAdditionalInfo: true,
          includeDisabled: false,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data?.organizations || response.data?.items || [];
    } catch (error) {
      throw this._wrapError(error, "Не удалось получить список организаций IIKO");
    }
  }

  async fetchStopListsWithProducts(token, organizationIds = [], organizations = [], options = {}) {
    if (!token) {
      throw new IikoApiError("Не передан токен IIKO", 500);
    }

    const { forceRefresh = false, rawCacheTtlMs = DEFAULT_RAW_STOP_LIST_TTL_MS } = options;
    const normalizedOrganizationIds = (organizationIds || []).map((id) => String(id)).filter(Boolean);

    if (normalizedOrganizationIds.length === 0) {
      return {
        stopLists: [],
        normalizedItems: [],
        rawStopListsResponse: null,
      };
    }

    const cacheKey = this._buildRawStopListCacheKey(normalizedOrganizationIds);

    if (!forceRefresh && cacheKey) {
      const cachedRaw = sharedCache.rawStopLists.get(cacheKey);
      if (cachedRaw) {
        return {
          stopLists: cachedRaw.terminalGroupStopLists || cachedRaw.stopLists || [],
          normalizedItems: this.normalizeStopListItems(cachedRaw, organizations, normalizedOrganizationIds),
          rawStopListsResponse: cachedRaw,
        };
      }
    }

    try {
      const response = await this.client.post(
        "/stop_lists",
        {
          organizationIds: normalizedOrganizationIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const rawStopListsResponse = response.data || {};
      const stopLists = rawStopListsResponse.terminalGroupStopLists || rawStopListsResponse.stopLists || [];
      const normalizedItems = this.normalizeStopListItems(rawStopListsResponse, organizations, normalizedOrganizationIds);

      if (cacheKey) {
        sharedCache.rawStopLists.set(cacheKey, rawStopListsResponse, rawCacheTtlMs);
      }

      return {
        stopLists,
        normalizedItems,
        rawStopListsResponse,
      };
    } catch (error) {
      throw this._wrapError(error, "Не удалось получить стоп-листы IIKO");
    }
  }

  normalizeStopListItems(rawResponse, organizations = [], organizationIds = []) {
    const orgMap = new Map((organizations || []).map((org) => [String(org.id), org.name]));
    const groups = rawResponse?.terminalGroupStopLists || rawResponse?.stopLists || [];
    const flatItems = [];
    const fallbackOrganizationId = String(organizationIds[0] || "");

    const traverse = (node = {}, inheritedContext = {}) => {
      if (!node || typeof node !== "object") return;

      const context = {
        organizationId: String(node.organizationId || node.orgId || inheritedContext.organizationId || fallbackOrganizationId || ""),
        organizationName: String(
          node.organizationName ||
            node.organization?.name ||
            inheritedContext.organizationName ||
            orgMap.get(String(node.organizationId || node.orgId || inheritedContext.organizationId || fallbackOrganizationId || "")) ||
            "",
        ),
        terminalGroupId: String(node.terminalGroupId || node.terminalGroup?.id || node.departmentId || inheritedContext.terminalGroupId || ""),
        terminalGroupName: String(
          node.terminalGroupName || node.terminalGroup?.name || node.departmentName || node.name || inheritedContext.terminalGroupName || "",
        ),
        reason: String(node.reason || node.comment || inheritedContext.reason || ""),
        groupId: String(node.id || inheritedContext.groupId || ""),
      };

      const children = Array.isArray(node.items) ? node.items.filter((item) => item && typeof item === "object") : [];
      const canBeItem = this._hasEntityMarkers(node) || !children.length;

      if (canBeItem) {
        const normalized = this._collectNormalizedItemFromNode(node, context, orgMap);
        if (normalized) {
          flatItems.push(normalized);
        }
      }

      for (const child of children) {
        traverse(child, context);
      }
    };

    for (const group of groups) {
      traverse(group, {});
    }

    return flatItems;
  }
}

module.exports = {
  IikoService,
  IikoApiError,
};
