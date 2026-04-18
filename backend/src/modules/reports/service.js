const OlapClient = require("../shared/olapClient");
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const organizationsService = require("../organizations/service");
const revenueService = require("../revenue/service");
const topDishesService = require("../topDishes/service");
const deliveryReports = require("./services/deliveryReports");
const salesReports = require("./services/salesReports");
const marketingReports = require("./services/marketingReports");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class ReportsService extends OlapClient {
  constructor() {
    super();
    this.operationalRowsCacheTtlMs = Number(process.env.REPORTS_OPERATIONAL_CACHE_TTL_MS || 90000);
    this.heatmapCacheTtlMs = Number(process.env.REPORTS_HEATMAP_CACHE_TTL_MS || 45000);
    this.operationalRowsCache = new Map();
    this.operationalRowsInflight = new Map();
    this.heatmapResultCache = new Map();
    this.heatmapInflight = new Map();
    this.deliveryZonesFilePath = path.resolve(__dirname, "../../../data/deliveryZones.json");
    this.cloudApiBaseUrl = String(process.env.IIKO_CLOUD_BASE_URL || process.env.IIKO_API_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/api\/1$/i, "");
    this.cloudApiLogin = String(process.env.IIKO_CLOUD_API_LOGIN || process.env.IIKO_API_LOGIN || "").trim();
    this.cloudTokenCache = {
      value: null,
      expiresAt: 0,
    };
  }

  normalizeTerminalGroupId(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return normalized || "__all__";
  }

  buildZoneStorageKey({ organizationId, terminalGroupId }) {
    return `${String(organizationId)}::${this.normalizeTerminalGroupId(terminalGroupId)}`;
  }

  clearHeatmapCacheByOrganization(organizationId) {
    const orgPrefix = `${String(organizationId)}:`;
    for (const key of this.heatmapResultCache.keys()) {
      if (key.startsWith(orgPrefix)) {
        this.heatmapResultCache.delete(key);
      }
    }
  }

  canUseCloudDeliveryApi() {
    return Boolean(this.cloudApiBaseUrl && this.cloudApiLogin);
  }

  async getCloudApiToken() {
    if (!this.canUseCloudDeliveryApi()) return null;

    if (this.cloudTokenCache.value && this.cloudTokenCache.expiresAt > Date.now()) {
      return this.cloudTokenCache.value;
    }

    const response = await axios.post(
      `${this.cloudApiBaseUrl}/api/1/access_token`,
      {
        apiLogin: this.cloudApiLogin,
      },
      {
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const token = String(response?.data?.token || "").trim();
    if (!token) {
      throw new Error("iiko Cloud не вернул access token");
    }

    this.cloudTokenCache = {
      value: token,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    return token;
  }

  normalizeCloudDeliveryOrders(payload = {}, timezone = "Europe/Moscow") {
    const organizations = Array.isArray(payload?.ordersByOrganizations) ? payload.ordersByOrganizations : [];

    return organizations.flatMap((organizationBlock, orgIndex) => {
      const organizationId = String(organizationBlock?.organizationId || "").trim();
      const orders = Array.isArray(organizationBlock?.orders) ? organizationBlock.orders : [];

      return orders.map((item, orderIndex) => {
        const sourceOrder = item?.order || item || {};
        const deliveredAt = this.parsePossibleDateTime(sourceOrder?.whenDelivered || sourceOrder?.deliveredAt || sourceOrder?.actualDeliveryDate);
        const promisedAt = this.parsePossibleDateTime(sourceOrder?.completeBefore || sourceOrder?.promisedTime || sourceOrder?.expectedDeliveryDate);
        const createdAt = this.parsePossibleDateTime(sourceOrder?.whenCreated || sourceOrder?.createdAt || sourceOrder?.createdDate);
        const sentAt = this.parsePossibleDateTime(sourceOrder?.whenSended || sourceOrder?.sentAt);
        const dateBase = deliveredAt || promisedAt || createdAt;
        const totalMinutes = createdAt && deliveredAt && deliveredAt > createdAt ? (deliveredAt - createdAt) / (1000 * 60) : null;

        let lat = this.parseNumber(sourceOrder?.deliveryPoint?.coordinates?.latitude);
        let lng = this.parseNumber(sourceOrder?.deliveryPoint?.coordinates?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          const pointCoordinates = sourceOrder?.deliveryPoint?.coordinates;
          if (Array.isArray(pointCoordinates) && pointCoordinates.length >= 2) {
            lng = this.parseNumber(pointCoordinates[0]);
            lat = this.parseNumber(pointCoordinates[1]);
          }
        }
        const courier = sourceOrder?.courierInfo?.courier || sourceOrder?.courier || {};
        const orderServiceType = String(sourceOrder?.orderType?.orderServiceType || "DELIVERY_BY_COURIER")
          .trim()
          .toUpperCase();

        const rawStatus = String(sourceOrder?.status || "").trim();

        return {
          orderId: String(item?.id || sourceOrder?.id || sourceOrder?.number || `cloud-${orgIndex}-${orderIndex}`),
          orderServiceType: orderServiceType || "DELIVERY_BY_COURIER",
          orderType: String(sourceOrder?.orderType?.name || "Доставка"),
          courierId: String(courier?.id || "unknown"),
          courierName: String(courier?.name || "Неизвестный курьер"),
          deliveryZoneId: sourceOrder?.deliveryZoneId || null,
          deliveryZoneName: sourceOrder?.deliveryZone || null,
          deliveryPoint: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
          terminalGroupId: sourceOrder?.terminalGroupId ? String(sourceOrder.terminalGroupId) : null,
          organizationId: organizationId || String(sourceOrder?.organizationId || ""),
          promisedAt,
          actualDeliveryAt: deliveredAt,
          sentAt,
          totalMinutes,
          revenue: Number(sourceOrder?.sum || 0),
          rawStatus: rawStatus || null,
          status: this.normalizeCloudDeliveryStatus(rawStatus),
          sourceKey: sourceOrder?.sourceKey || null,
          hour: this.getHourInTimezone(dateBase, timezone),
          weekdayIndex: this.getWeekdayIndexInTimezone(dateBase, timezone),
          date: this.getDateInTimezone(dateBase, timezone),
        };
      });
    });
  }

  formatCloudDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new Error("Некорректная дата для iiko Cloud API");
    }

    const pad = (number, size = 2) => String(number).padStart(size, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(
      date.getUTCMinutes(),
    )}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
  }

  normalizeCloudDateBounds(dateFrom, dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      throw new Error("Некорректные границы периода для iiko Cloud API");
    }

    const fromIsDateOnly = typeof dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom.trim());
    const toIsDateOnly = typeof dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim());

    const normalizedFrom = fromIsDateOnly ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0)) : from;
    const normalizedTo = toIsDateOnly ? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999)) : to;

    if (normalizedTo < normalizedFrom) {
      throw new Error("dateTo не может быть раньше dateFrom");
    }

    return { from: normalizedFrom, to: normalizedTo };
  }

  buildCloudDeliveriesBody({ organizationId, from, to, statuses = [], sourceKeys = [], courierIds = [] }) {
    const body = {
      organizationIds: [String(organizationId)],
      deliveryDateFrom: this.formatCloudDateTime(from),
      deliveryDateTo: this.formatCloudDateTime(to),
    };

    if (Array.isArray(statuses) && statuses.length > 0) {
      body.statuses = statuses;
    }
    if (Array.isArray(sourceKeys) && sourceKeys.length > 0) {
      body.sourceKeys = sourceKeys.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (Array.isArray(courierIds) && courierIds.length > 0) {
      body.courierIds = courierIds.map((item) => String(item || "").trim()).filter(Boolean);
    }

    return body;
  }

  isTooManyCloudDataError(error) {
    const status = Number(error?.response?.status || 0);
    const errorCode = String(error?.response?.data?.error || "")
      .trim()
      .toUpperCase();
    return status === 422 && errorCode === "TOO_MANY_DATA_REQUESTED";
  }

  async requestCloudDeliveriesChunk({
    token,
    organizationId,
    from,
    to,
    statuses = [],
    sourceKeys = [],
    courierIds = [],
    timezone = "Europe/Moscow",
  }) {
    const body = this.buildCloudDeliveriesBody({ organizationId, from, to, statuses, sourceKeys, courierIds });
    const response = await axios.post(`${this.cloudApiBaseUrl}/api/1/deliveries/by_delivery_date_and_status`, body, {
      timeout: this.timeout,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return this.normalizeCloudDeliveryOrders(response?.data, timezone);
  }

  async requestCloudDeliveriesRange({
    token,
    organizationId,
    from,
    to,
    statuses = [],
    sourceKeys = [],
    courierIds = [],
    timezone = "Europe/Moscow",
  }) {
    try {
      return await this.requestCloudDeliveriesChunk({
        token,
        organizationId,
        from,
        to,
        statuses,
        sourceKeys,
        courierIds,
        timezone,
      });
    } catch (error) {
      if (!this.isTooManyCloudDataError(error)) {
        throw error;
      }

      const spanMs = to.getTime() - from.getTime();
      if (spanMs <= 60 * 60 * 1000) {
        throw error;
      }

      const midpoint = new Date(Math.floor((from.getTime() + to.getTime()) / 2));
      const leftOrders = await this.requestCloudDeliveriesRange({
        token,
        organizationId,
        from,
        to: midpoint,
        statuses,
        sourceKeys,
        courierIds,
        timezone,
      });
      const rightStart = new Date(midpoint.getTime() + 1);
      if (rightStart > to) {
        return leftOrders;
      }
      const rightOrders = await this.requestCloudDeliveriesRange({
        token,
        organizationId,
        from: rightStart,
        to,
        statuses,
        sourceKeys,
        courierIds,
        timezone,
      });

      return [...leftOrders, ...rightOrders];
    }
  }

  async getCloudDeliveryOrders({
    organizationId,
    dateFrom,
    dateTo,
    terminalGroupId = null,
    statuses = [],
    sourceKeys = [],
    courierIds = [],
    timezone = "Europe/Moscow",
  }) {
    if (!this.canUseCloudDeliveryApi()) {
      throw new Error("Не настроены IIKO_CLOUD_BASE_URL/IIKO_API_BASE_URL или IIKO_CLOUD_API_LOGIN/IIKO_API_LOGIN");
    }

    const token = await this.getCloudApiToken();
    const { from, to } = this.normalizeCloudDateBounds(dateFrom, dateTo);
    const normalizedOrders = await this.requestCloudDeliveriesRange({
      token,
      organizationId,
      from,
      to,
      statuses,
      sourceKeys,
      courierIds,
      timezone,
    });
    return normalizedOrders.filter((item) => {
      if (terminalGroupId && String(item?.terminalGroupId || "") !== String(terminalGroupId)) {
        return false;
      }
      if (Array.isArray(courierIds) && courierIds.length > 0) {
        const allowed = new Set(courierIds.map((id) => String(id)));
        if (!allowed.has(String(item?.courierId || ""))) {
          return false;
        }
      }
      return true;
    });
  }

  async readDeliveryZonesStore() {
    try {
      const raw = await fs.readFile(this.deliveryZonesFilePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      if (error?.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  async writeDeliveryZonesStore(store) {
    const content = JSON.stringify(store || {}, null, 2);
    await fs.writeFile(this.deliveryZonesFilePath, content, "utf8");
  }

  validateGeoJsonFeatureCollection(geoJson) {
    if (!geoJson || geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
      throw new Error("GeoJSON должен быть в формате FeatureCollection");
    }

    for (const feature of geoJson.features) {
      const geometryType = feature?.geometry?.type;
      if (!geometryType) continue;
      if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") {
        throw new Error("Поддерживаются только Polygon и MultiPolygon");
      }
    }
  }

  async saveDeliveryZones({ organizationId, terminalGroupId = null, geoJson }) {
    if (!organizationId) {
      throw new Error("organizationId обязателен");
    }

    this.validateGeoJsonFeatureCollection(geoJson);
    const store = await this.readDeliveryZonesStore();
    const storageKey = this.buildZoneStorageKey({ organizationId, terminalGroupId });
    const previousRecord = store[storageKey] || store[String(organizationId)] || null;

    store[storageKey] = {
      geoJson,
      updatedAt: new Date().toISOString(),
      version: Number(previousRecord?.version || 0) + 1,
    };

    this.clearHeatmapCacheByOrganization(organizationId);
    await this.writeDeliveryZonesStore(store);

    return {
      organizationId: String(organizationId),
      terminalGroupId: this.normalizeTerminalGroupId(terminalGroupId),
      zonesCount: geoJson.features.length,
      updatedAt: store[storageKey].updatedAt,
      version: store[storageKey].version,
    };
  }

  async getDeliveryZones({ organizationId, terminalGroupId = null }) {
    if (!organizationId) {
      throw new Error("organizationId обязателен");
    }

    const store = await this.readDeliveryZonesStore();
    const exactKey = this.buildZoneStorageKey({ organizationId, terminalGroupId });
    const fallbackKey = this.buildZoneStorageKey({ organizationId, terminalGroupId: null });
    const record = store[exactKey] || store[fallbackKey] || store[String(organizationId)] || null;

    return {
      organizationId: String(organizationId),
      terminalGroupId: this.normalizeTerminalGroupId(terminalGroupId),
      zonesConfigured: Boolean(record?.geoJson),
      zonesCount: Array.isArray(record?.geoJson?.features) ? record.geoJson.features.length : 0,
      updatedAt: record?.updatedAt || null,
      version: Number(record?.version || 0),
      geoJson: record?.geoJson || null,
    };
  }

  roundMetric(value, digits = 2) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    const factor = 10 ** digits;
    return Math.round(numericValue * factor) / factor;
  }

  parseDateTime(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  toDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const isoPart = source.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoPart) ? isoPart : null;
  }

  validateHeatmapPeriod(dateFrom, dateTo, maxDays = 30) {
    const start = new Date(dateFrom).getTime();
    const end = new Date(dateTo).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error("Некорректный период для тепловой карты");
    }
    if (end < start) {
      throw new Error("dateTo не может быть раньше dateFrom");
    }

    const diffDays = (end - start) / (24 * 60 * 60 * 1000);
    if (diffDays > maxDays) {
      throw new Error(`Слишком большой период. Максимум ${maxDays} дней`);
    }
  }

  isDeliveryOrder(row = {}) {
    const courierId = String(row["Delivery.Courier.Id"] || "").trim();
    const orderType = String(row.OrderType || "").toLowerCase();
    return Boolean(courierId) || orderType.includes("достав") || orderType.includes("delivery") || orderType.includes("courier");
  }

  extractOrderServiceType(row = {}) {
    return this.pickFirstValue(row, ["OrderServiceType", "Order.ServiceType", "OrderServiceType.Name", "Delivery.OrderServiceType"]);
  }

  normalizeOrderServiceType(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    if (!raw) return "";

    const compact = raw.replace(/[^A-Z]/g, "");
    if (compact === "DELIVERYBYCOURIER") return "DELIVERY_BY_COURIER";
    if (compact === "DELIVERYBYCLIENT") return "DELIVERY_BY_CLIENT";
    if (compact === "COMMON") return "COMMON";
    return raw;
  }

  isCourierDeliveryByServiceType(row = {}) {
    const serviceType = this.normalizeOrderServiceType(this.extractOrderServiceType(row));
    return serviceType === "DELIVERY_BY_COURIER";
  }

  normalizeOrderType(order = {}) {
    const serviceType = this.normalizeOrderServiceType(order.orderServiceType || order.OrderServiceType || "");
    if (serviceType === "DELIVERY_BY_COURIER") return "Доставка курьером";
    if (serviceType === "DELIVERY_BY_CLIENT") return "Самовывоз";
    if (serviceType === "COMMON") return "В зале";

    const orderType = String(order.orderType || order.OrderType || "")
      .trim()
      .toLowerCase();
    if (orderType.includes("достав") || orderType.includes("delivery") || orderType.includes("courier")) return "Доставка курьером";
    if (orderType.includes("самовы") || orderType.includes("pickup") || orderType.includes("takeaway")) return "Самовывоз";
    if (orderType.includes("зал") || orderType.includes("dine")) return "В зале";
    return String(order.orderType || order.OrderType || "Неизвестно");
  }

  normalizeChannelName(channel) {
    const source = String(channel || "")
      .trim()
      .toLowerCase();
    if (!source) return "Неизвестный канал";
    if (source.includes("яндекс") || source.includes("yandex")) return "Яндекс.Еда";
    if (source.includes("самовы") || source.includes("takeaway") || source.includes("pickup")) return "Самовынос";
    if (source.includes("достав") || source.includes("delivery") || source.includes("courier")) return "Доставка";
    if (source.includes("зал") || source.includes("dine")) return "Зал";
    return String(channel || "Прочее");
  }

  normalizeCloudDeliveryStatus(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    if (!raw) return "Создан";

    if (raw.includes("CANCEL")) return "Отменен";
    if (raw.includes("DELIVER") || raw.includes("CLOSE")) return "Доставлен";
    if (raw.includes("ON_WAY") || raw.includes("ONWAY") || raw.includes("COURIER")) return "В пути";
    if (raw.includes("READY") || raw.includes("PACK")) return "Готов";
    return "Создан";
  }

  extractOrderNumber(row = {}) {
    const candidates = [row.OrderNum, row["Order.Num"], row["Order.Number"], row.OrderNumber, row["Delivery.OrderNum"], row["Delivery.OrderNumber"]];

    for (const value of candidates) {
      const normalized = String(value || "").trim();
      if (normalized) return normalized;
    }

    return null;
  }

  formatDisplayOrderNumber(row = {}) {
    return this.extractOrderNumber(row) || "Без номера";
  }

  extractDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;

    const isoMatch = source.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year}-${month}-${day}`;
    }

    const ruMatch = source.match(/^(\d{2})[.](\d{2})[.](\d{4})/);
    if (ruMatch) {
      const [, day, month, year] = ruMatch;
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  extractHourLocal(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const match = source.match(/(?:\s|T)(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  getWeekdayIndexFromDate(dateStr) {
    if (!dateStr) return null;
    const ts = new Date(`${dateStr}T12:00:00Z`).getTime();
    if (!Number.isFinite(ts)) return null;
    const day = new Date(ts).getUTCDay();
    return day === 0 ? 7 : day;
  }

  getHourInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false });
    const hour = Number(formatter.format(new Date(timestamp)));
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  getWeekdayIndexInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
    return weekdayMap[formatter.format(new Date(timestamp))] || null;
  }

  getDateInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(new Date(timestamp));
    } catch (_) {
      return toMoscowDateStr(new Date(timestamp));
    }
  }

  async getOrganizationTimezone(organizationId) {
    try {
      const organizations = await organizationsService.getOrganizations();
      const organization = (organizations || []).find((item) => String(item.id) === String(organizationId));
      return organization?.timezone || "Europe/Moscow";
    } catch (_) {
      return "Europe/Moscow";
    }
  }

  parseNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  extractCoordinatePairFromRow(row = {}) {
    const latitude = this.parseNumber(
      this.pickFirstValue(row, ["Delivery.Address.Latitude", "DeliveryPoint.Latitude", "Delivery.Latitude", "Latitude"]),
    );
    const longitude = this.parseNumber(
      this.pickFirstValue(row, ["Delivery.Address.Longitude", "DeliveryPoint.Longitude", "Delivery.Longitude", "Longitude"]),
    );

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { lat: latitude, lng: longitude };
    }

    const combined = this.pickFirstValue(row, ["Delivery.Address.Coordinates", "DeliveryPoint.Coordinates", "Delivery.Coordinates", "Coordinates"]);

    if (Array.isArray(combined) && combined.length >= 2) {
      const lng = this.parseNumber(combined[0]);
      const lat = this.parseNumber(combined[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    if (typeof combined === "string") {
      const parts = combined
        .split(",")
        .map((item) => this.parseNumber(item.trim()))
        .filter((item) => Number.isFinite(item));
      if (parts.length >= 2) {
        const lng = parts[0];
        const lat = parts[1];
        return { lat, lng };
      }
    }

    return null;
  }

  parsePossibleDateTime(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  pickFirstValue(row = {}, candidates = []) {
    for (const fieldName of candidates) {
      const value = row[fieldName];
      if (value == null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return null;
  }

  extractColumnNames(payload) {
    const names = new Set();

    const walk = (value) => {
      if (!value) return;

      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
        return;
      }

      if (typeof value === "string") {
        const normalized = value.trim();
        if (normalized && /^[A-Za-z0-9_.]+$/.test(normalized)) {
          names.add(normalized);
        }
        return;
      }

      if (typeof value === "object") {
        const possibleNames = [value.name, value.field, value.id, value.columnName, value.code];
        for (const item of possibleNames) {
          if (typeof item === "string" && item.trim() && /^[A-Za-z0-9_.]+$/.test(item.trim())) {
            names.add(item.trim());
          }
        }

        for (const child of Object.values(value)) {
          walk(child);
        }
      }
    };

    walk(payload);
    return names;
  }

  pickFirstAvailable(columnsSet, candidates = []) {
    for (const candidate of candidates) {
      if (columnsSet.has(candidate)) return candidate;
    }
    return null;
  }

  async fetchAvailableColumns(storeId) {
    try {
      return await this.withAuth(storeId, async (client) => {
        const session = client.__iikoSession || {};

        if (session.mode === "server-v2") {
          const response = await this.requestWithRetry(
            client,
            {
              method: "get",
              url: "/resto/api/v2/reports/olap/columns",
              params: {
                reportType: "SALES",
                ...(session.key ? { key: session.key } : {}),
              },
              timeout: Math.min(this.timeout, 20000),
            },
            { stage: "olap-columns", storeId },
          );

          return this.extractColumnNames(response.data);
        }

        return new Set();
      });
    } catch (_) {
      return new Set();
    }
  }

  escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  formatTimestampForExport(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(timestamp));
    } catch (_) {
      return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
    }
  }

  formatDurationMinutesForExport(value) {
    const totalMinutes = Number(value);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "00:00:00";

    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  buildExcelXmlBuffer({ sheetName, headers, rows }) {
    const safeSheetName = this.escapeXml(String(sheetName || "Отчет").slice(0, 31));
    const headerRow = headers.map((header) => `<Cell><Data ss:Type=\"String\">${this.escapeXml(header)}</Data></Cell>`).join("");
    const bodyRows = rows
      .map((row) => {
        const cells = row.map((value) => `<Cell><Data ss:Type=\"String\">${this.escapeXml(value)}</Data></Cell>`).join("");
        return `<Row>${cells}</Row>`;
      })
      .join("");

    const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"
 xmlns:o=\"urn:schemas-microsoft-com:office:office\"
 xmlns:x=\"urn:schemas-microsoft-com:office:excel\"
 xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"
 xmlns:html=\"http://www.w3.org/TR/REC-html40\">
 <Worksheet ss:Name=\"${safeSheetName}\">
  <Table>
   <Row>${headerRow}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

    return Buffer.from(xml, "utf8");
  }

  extractPromisedMinutes(row = {}, openAt = null, totalMinutes = null) {
    const promisedMinutesFields = [
      row["Delivery.PromisedTimeMinutes"],
      row["Delivery.PromisedDuration"],
      row["Delivery.ExpectedDuration"],
      row["Delivery.ExpectedMinutes"],
      row["OrderTime.PromisedOrderLength"],
    ];

    for (const value of promisedMinutesFields) {
      const minutes = this.parseNumber(value);
      if (minutes != null && minutes > 0) {
        return minutes;
      }
    }

    const promisedDateFields = [
      row["Delivery.PromiseTime"],
      row["Delivery.PromisedTime"],
      row["Delivery.ExpectedCloseTime"],
      row["Delivery.ExpectedDeliveryTime"],
    ];

    for (const value of promisedDateFields) {
      const promisedAt = this.parsePossibleDateTime(value);
      if (promisedAt && openAt && promisedAt >= openAt) {
        return (promisedAt - openAt) / (1000 * 60);
      }
    }

    if (totalMinutes != null && totalMinutes > 0) {
      return Math.max(45, Math.min(75, totalMinutes));
    }

    return 60;
  }

  extractOrderStatus(row = {}, order = null) {
    const cancelCause = String(row["Delivery.CancelCause"] || "").trim();
    const isCanceled = this.isDeletedOrderFlag(row.OrderDeleted) || this.isTrueFlag(row.Storned) || Boolean(cancelCause);
    if (isCanceled) return "Отменен";

    const deliveredAt = order?.deliveredAt || this.parseDateTime(row["Delivery.CloseTime"]);
    const sentAt = order?.sentAt || this.parseDateTime(row["Delivery.SendTime"]);
    const cookedAt = order?.cookedAt || this.parseDateTime(row["Delivery.CookingFinishTime"]);

    if (deliveredAt) return "Доставлен";
    if (sentAt) return "В пути";
    if (cookedAt) return "Готов";
    return "Создан";
  }

  getStablePoint(seed) {
    const source = String(seed || "point");
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash << 5) - hash + source.charCodeAt(index);
      hash |= 0;
    }

    const x = 15 + Math.abs(hash % 70);
    const y = 15 + Math.abs((hash * 31) % 70);
    return { x, y };
  }

  getOperationalRowsCacheKey({ organizationId, dateFrom, dateTo }) {
    const normalizedFrom = this.toDateOnly(dateFrom) || String(dateFrom || "").slice(0, 10);
    const normalizedTo = this.toDateOnly(dateTo) || String(dateTo || "").slice(0, 10);
    return `${organizationId}:${normalizedFrom}:${normalizedTo}`;
  }

  getHeatmapResultCacheKey({
    organizationId,
    dateFrom,
    dateTo,
    terminalGroupId = null,
    statuses = [],
    sourceKeys = [],
    courierIds = [],
    zoneVersion = 0,
  }) {
    const normalizedFrom = this.toDateOnly(dateFrom) || String(dateFrom || "").slice(0, 10);
    const normalizedTo = this.toDateOnly(dateTo) || String(dateTo || "").slice(0, 10);
    const normalizedTerminalGroupId = this.normalizeTerminalGroupId(terminalGroupId);
    const normalizedStatuses = Array.isArray(statuses)
      ? statuses
          .map((item) =>
            String(item || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
          .sort()
          .join(",")
      : "";
    const normalizedSourceKeys = Array.isArray(sourceKeys)
      ? sourceKeys
          .map((item) =>
            String(item || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
          .sort()
          .join(",")
      : "";
    const normalizedCourierIds = Array.isArray(courierIds)
      ? courierIds
          .map((item) =>
            String(item || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
          .sort()
          .join(",")
      : "";

    return `${organizationId}:${normalizedTerminalGroupId}:${normalizedFrom}:${normalizedTo}:${normalizedStatuses}:${normalizedSourceKeys}:${normalizedCourierIds}:${Number(zoneVersion || 0)}`;
  }

  async getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo }) {
    const cacheKey = this.getOperationalRowsCacheKey({ organizationId, dateFrom, dateTo });
    const cached = this.operationalRowsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rows;
    }

    if (this.operationalRowsInflight.has(cacheKey)) {
      return await this.operationalRowsInflight.get(cacheKey);
    }

    const loadPromise = (async () => {
      const storeId = await this.resolveStoreId(organizationId);
      const startDate = this.toDateOnly(dateFrom);
      const endDate = this.toDateOnly(dateTo);
      const { startIso, endIso } = buildOlapBounds(startDate || toMoscowDateStr(new Date(dateFrom)), endDate || toMoscowDateStr(new Date(dateTo)));

      const result = await this.withAuth(storeId, async (client, delay) => {
        const buildBody = (groupFields) => ({
          storeIds: [String(storeId)],
          olapType: "SALES",
          categoryFields: [],
          groupFields,
          stackByDataFields: false,
          dataFields: ["Sales", "UniqOrderId.OrdersCount", "AverageOrderTime"],
          calculatedFields: [
            {
              name: "Sales",
              title: "Sales",
              description: "Net sales",
              formula: "[DishDiscountSumInt.withoutVAT]",
              type: "MONEY",
              canSum: false,
            },
            {
              name: "UniqOrderId.OrdersCount",
              title: "Orders Count",
              description: "Number of unique orders",
              formula: "[UniqOrderId.OrdersCount]",
              type: "NUMERIC",
              canSum: true,
            },
            {
              name: "AverageOrderTime",
              title: "Average Order Time",
              description: "Average order duration",
              formula: "[OrderTime.AverageOrderTime]",
              type: "NUMERIC",
              canSum: false,
            },
          ],
          filters: [
            {
              field: "OpenDate.Typed",
              filterType: "date_range",
              dateFrom: startIso,
              dateTo: endIso,
              valueMin: null,
              valueMax: null,
              valueList: [],
              includeLeft: true,
              includeRight: false,
              inclusiveList: true,
            },
          ],
          includeVoidTransactions: true,
          includeNonBusinessPaymentTypes: true,
        });

        const primaryGroupFields = [
          "OrderType",
          "OrderServiceType",
          "OrderNum",
          "UniqOrderId.Id",
          "OrderDeleted",
          "Storned",
          "DeletedWithWriteoff",
          "Delivery.CancelCause",
          "Delivery.Courier.Id",
          "Delivery.Courier",
          "Delivery.SendTime",
          "Delivery.CloseTime",
          "Delivery.ExpectedTime",
          "Delivery.ActualTime",
          "OpenTime",
          "Delivery.CookingFinishTime",
          "Delivery.WayDuration",
          "OrderTime.OrderLength",
        ];

        const fallbackGroupFields = primaryGroupFields.filter((fieldName) => fieldName !== "OrderNum" && fieldName !== "OrderServiceType");

        try {
          return await this.pollOlap(client, delay, buildBody(primaryGroupFields), {
            maxAttempts: this.maxAttempts,
            fetchTimeoutMs: this.timeout,
            logEvery: 10,
          });
        } catch (error) {
          console.warn("⚠ getOperationalRowsForPeriod fallback без OrderNum:", error?.message);
          return await this.pollOlap(client, delay, buildBody(fallbackGroupFields), {
            maxAttempts: this.maxAttempts,
            fetchTimeoutMs: this.timeout,
            logEvery: 10,
          });
        }
      });

      const rows = this.parseResultRows(result, (group, values) => ({
        ...group,
        Sales: parseFloat(values[0]) || 0,
        "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
        AverageOrderTime: parseFloat(values[2]) || 0,
      }));

      const filteredRows = this.filterCanceledOrders(rows).rows;
      this.operationalRowsCache.set(cacheKey, {
        rows: filteredRows,
        expiresAt: Date.now() + this.operationalRowsCacheTtlMs,
      });

      return filteredRows;
    })();

    this.operationalRowsInflight.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.operationalRowsInflight.delete(cacheKey);
    }
  }

  async getOperationalRowsForDeliveryDelayExport({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const startDate = this.toDateOnly(dateFrom);
    const endDate = this.toDateOnly(dateTo);
    const { startIso, endIso } = buildOlapBounds(startDate || toMoscowDateStr(new Date(dateFrom)), endDate || toMoscowDateStr(new Date(dateTo)));

    const buildBody = (groupFields) => ({
      storeIds: [String(storeId)],
      olapType: "SALES",
      categoryFields: [],
      groupFields,
      stackByDataFields: false,
      dataFields: ["Sales", "UniqOrderId.OrdersCount", "AverageOrderTime"],
      calculatedFields: [
        {
          name: "Sales",
          title: "Sales",
          description: "Net sales",
          formula: "[DishDiscountSumInt.withoutVAT]",
          type: "MONEY",
          canSum: false,
        },
        {
          name: "UniqOrderId.OrdersCount",
          title: "Orders Count",
          description: "Number of unique orders",
          formula: "[UniqOrderId.OrdersCount]",
          type: "NUMERIC",
          canSum: true,
        },
        {
          name: "AverageOrderTime",
          title: "Average Order Time",
          description: "Average order duration",
          formula: "[OrderTime.AverageOrderTime]",
          type: "NUMERIC",
          canSum: false,
        },
      ],
      filters: [
        {
          field: "OpenDate.Typed",
          filterType: "date_range",
          dateFrom: startIso,
          dateTo: endIso,
          valueMin: null,
          valueMax: null,
          valueList: [],
          includeLeft: true,
          includeRight: false,
          inclusiveList: true,
        },
      ],
      includeVoidTransactions: true,
      includeNonBusinessPaymentTypes: true,
    });

    const baseFields = [
      "OrderType",
      "OrderServiceType",
      "Department",
      "OpenDate.Typed",
      "OrderNum",
      "UniqOrderId.Id",
      "OrderDeleted",
      "Storned",
      "DeletedWithWriteoff",
      "Delivery.CancelCause",
      "Delivery.Courier.Id",
      "Delivery.Courier",
      "Delivery.SendTime",
      "Delivery.CloseTime",
      "Delivery.ExpectedTime",
      "Delivery.ActualTime",
      "OpenTime",
      "Delivery.CookingFinishTime",
      "Delivery.WayDuration",
      "OrderTime.OrderLength",
      "Department.Id",
      "Department.Code",
    ];

    const fieldsWithDepartmentName = [...new Set(["Department.Name", ...baseFields])];
    const fieldsWithoutOrderNum = baseFields.filter((fieldName) => fieldName !== "OrderNum");
    const fieldsWithoutDepartment = fieldsWithoutOrderNum.filter(
      (fieldName) => fieldName !== "Department" && fieldName !== "Department.Id" && fieldName !== "Department.Code",
    );

    const fieldAttempts = [
      fieldsWithDepartmentName,
      [...new Set(baseFields)],
      [...new Set(fieldsWithoutOrderNum)],
      [...new Set(fieldsWithoutDepartment)],
    ];

    let rows = [];
    let lastError = null;
    for (const groupFields of fieldAttempts) {
      try {
        const result = await this.withAuth(
          storeId,
          async (client, delay) => {
            return await this.pollOlap(client, delay, buildBody(groupFields), {
              maxAttempts: this.maxAttempts,
              fetchTimeoutMs: this.timeout,
              logEvery: 10,
              allowLegacy: false,
            });
          },
          { allowLegacy: false },
        );

        rows = this.parseResultRows(result, (group, values) => ({
          ...group,
          Sales: parseFloat(values[0]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
          AverageOrderTime: parseFloat(values[2]) || 0,
        }));
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    return this.filterCanceledOrders(rows).rows;
  }

  toOrderEntities(rows = [], timezone = "Europe/Moscow") {
    const orderMap = new Map();

    rows.forEach((row, index) => {
      const rawId = String(row["UniqOrderId.Id"] || "").trim();
      const orderId = rawId || `row-${index}`;
      const orderNumber = this.extractOrderNumber(row);

      if (!orderMap.has(orderId)) {
        const openAt = this.parseDateTime(row.OpenTime);
        const cookedAt = this.parseDateTime(row["Delivery.CookingFinishTime"]);
        const sentAt = this.parseDateTime(row["Delivery.SendTime"]);
        const deliveredAt = this.parseDateTime(row["Delivery.CloseTime"]);
        const promisedAt = this.parsePossibleDateTime(
          this.pickFirstValue(row, [
            "Delivery.ExpectedTime",
            "Delivery.PromiseTime",
            "Delivery.PromisedTime",
            "Delivery.ExpectedDeliveryTime",
            "Delivery.ExpectedCloseTime",
          ]),
        );
        const actualDeliveryAt = this.parsePossibleDateTime(this.pickFirstValue(row, ["Delivery.ActualTime"])) || deliveredAt;
        const routeMinutesRaw = Number(row["Delivery.WayDuration"]) || 0;
        const avgOrderMinutesRaw = Number(row.AverageOrderTime || row["OrderTime.AverageOrderTime"]) || 0;
        const orderLengthRaw = Number(row["OrderTime.OrderLength"]) || 0;

        let routeMinutes = null;
        if (sentAt && deliveredAt && deliveredAt >= sentAt) {
          routeMinutes = (deliveredAt - sentAt) / (1000 * 60);
        } else if (routeMinutesRaw > 0) {
          routeMinutes = routeMinutesRaw;
        }

        let prepMinutes = null;
        if (openAt && cookedAt && cookedAt >= openAt) {
          prepMinutes = (cookedAt - openAt) / (1000 * 60);
        }

        let shelfMinutes = null;
        if (cookedAt && sentAt && sentAt >= cookedAt) {
          shelfMinutes = (sentAt - cookedAt) / (1000 * 60);
        }

        let totalMinutes = null;
        if (openAt && deliveredAt && deliveredAt >= openAt) {
          totalMinutes = (deliveredAt - openAt) / (1000 * 60);
        } else if (avgOrderMinutesRaw > 0) {
          totalMinutes = avgOrderMinutesRaw;
        } else if (orderLengthRaw > 0) {
          totalMinutes = orderLengthRaw;
        }

        const promisedMinutes = this.extractPromisedMinutes(row, openAt, totalMinutes);
        const localDate = this.extractDateOnly(row["OpenDate.Typed"] || row.OpenTime) || this.getDateInTimezone(openAt, timezone);
        const localHour = this.extractHourLocal(row.OpenTime) ?? this.getHourInTimezone(openAt, timezone);
        const localWeekdayIndex = this.getWeekdayIndexFromDate(localDate) || this.getWeekdayIndexInTimezone(openAt, timezone);

        orderMap.set(orderId, {
          orderId,
          orderNumber,
          displayOrderNumber: orderNumber || "Без номера",
          orderType: row.OrderType || "Неизвестно",
          orderServiceType: this.extractOrderServiceType(row) || null,
          channel: this.normalizeChannelName(row.OrderType),
          departmentId: String(row["Department.Id"] || row["Department.Code"] || "").trim() || "unknown",
          departmentName: this.pickFirstValue(row, ["Department", "Department.Name"]) || null,
          courierId: String(row["Delivery.Courier.Id"] || "").trim() || "unknown",
          courierName: String(row["Delivery.Courier"] || "").trim() || "Неизвестный курьер",
          deliveryZoneId: this.pickFirstValue(row, ["Delivery.DeliveryZone.Id", "Delivery.Zone.Id", "DeliveryZone.Id"]) || null,
          deliveryZoneName:
            this.pickFirstValue(row, [
              "Delivery.DeliveryZone",
              "Delivery.DeliveryZone.Name",
              "Delivery.Zone",
              "Delivery.Zone.Name",
              "DeliveryZone",
            ]) || null,
          deliveryPoint: this.extractCoordinatePairFromRow(row),
          rawStatus: this.pickFirstValue(row, ["Delivery.Status", "OrderStatus", "Status"]) || null,
          cancelCause: String(row["Delivery.CancelCause"] || "").trim(),
          isOrderDeleted: this.isDeletedOrderFlag(row.OrderDeleted),
          isStorned: this.isTrueFlag(row.Storned),
          openAt,
          cookedAt,
          sentAt,
          deliveredAt,
          promisedAt,
          actualDeliveryAt,
          prepMinutes,
          shelfMinutes,
          routeMinutes,
          totalMinutes,
          promisedMinutes,
          hour: localHour,
          weekdayIndex: localWeekdayIndex,
          date: localDate,
          revenue: 0,
        });
      }

      const order = orderMap.get(orderId);
      if (!order.orderNumber) {
        order.orderNumber = this.extractOrderNumber(row);
        order.displayOrderNumber = order.orderNumber || "Без номера";
      }
      order.revenue += Number(row.Sales) || 0;
      order.cancelCause = order.cancelCause || String(row["Delivery.CancelCause"] || "").trim();
      order.isOrderDeleted = order.isOrderDeleted || this.isDeletedOrderFlag(row.OrderDeleted);
      order.isStorned = order.isStorned || this.isTrueFlag(row.Storned);
      order.departmentName = order.departmentName || this.pickFirstValue(row, ["Department", "Department.Name"]);
      order.promisedAt =
        order.promisedAt ||
        this.parsePossibleDateTime(
          this.pickFirstValue(row, [
            "Delivery.ExpectedTime",
            "Delivery.PromiseTime",
            "Delivery.PromisedTime",
            "Delivery.ExpectedDeliveryTime",
            "Delivery.ExpectedCloseTime",
          ]),
        );
      order.actualDeliveryAt =
        order.actualDeliveryAt || this.parsePossibleDateTime(this.pickFirstValue(row, ["Delivery.ActualTime"])) || order.deliveredAt;
      order.orderServiceType = order.orderServiceType || this.extractOrderServiceType(row) || null;
      order.deliveryZoneId =
        order.deliveryZoneId || this.pickFirstValue(row, ["Delivery.DeliveryZone.Id", "Delivery.Zone.Id", "DeliveryZone.Id"]) || null;
      order.deliveryZoneName =
        order.deliveryZoneName ||
        this.pickFirstValue(row, ["Delivery.DeliveryZone", "Delivery.DeliveryZone.Name", "Delivery.Zone", "Delivery.Zone.Name", "DeliveryZone"]) ||
        null;
      order.deliveryPoint = order.deliveryPoint || this.extractCoordinatePairFromRow(row);
      order.rawStatus = order.rawStatus || this.pickFirstValue(row, ["Delivery.Status", "OrderStatus", "Status"]) || null;
    });
    return [...orderMap.values()].map((order) => ({
      ...order,
      status: order.isOrderDeleted || order.isStorned || order.cancelCause ? "Отменен" : this.extractOrderStatus({}, order),
    }));
  }

  buildRouteStats(rows = [], options = {}) {
    return deliveryReports.buildRouteStats(rows, this, options);
  }

  buildOperationalSummary(rows = []) {
    return salesReports.buildOperationalSummary(rows, this);
  }

  buildHourlySalesReport(rows = [], timezone = "Europe/Moscow") {
    return salesReports.buildHourlySalesReport(rows, timezone, this);
  }

  buildSlaReport(rows = [], timezone = "Europe/Moscow", options = {}) {
    return deliveryReports.buildSlaReport(rows, timezone, this, options);
  }

  buildCourierKpiReport(rows = [], timezone = "Europe/Moscow", options = {}) {
    return deliveryReports.buildCourierKpiReport(rows, timezone, this, options);
  }

  buildMarketingSourcesReport(rows = [], timezone = "Europe/Moscow") {
    return marketingReports.buildMarketingSourcesReport(rows, timezone, this);
  }

  buildDeliverySummaryReport(rows = [], timezone = "Europe/Moscow", options = {}) {
    return deliveryReports.buildDeliverySummaryReport(rows, timezone, this, options);
  }

  buildDeliveryDelaysReport(rows = [], timezone = "Europe/Moscow", options = {}) {
    return deliveryReports.buildDeliveryDelaysReport(rows, timezone, this, options);
  }

  buildCourierMapReport(rows = [], dateTo = null, timezone = "Europe/Moscow", options = {}) {
    return deliveryReports.buildCourierMapReport(rows, dateTo, timezone, this, options);
  }

  async getPromotionsRowsForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const startDate = this.toDateOnly(dateFrom);
    const endDate = this.toDateOnly(dateTo);
    const { startIso, endIso } = buildOlapBounds(startDate || toMoscowDateStr(new Date(dateFrom)), endDate || toMoscowDateStr(new Date(dateTo)));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: [
          "OpenDate.Typed",
          "OrderType",
          "UniqOrderId.Id",
          "ItemSaleEventDiscountType",
          "OrderDeleted",
          "Storned",
          "DeletedWithWriteoff",
          "Delivery.CancelCause",
        ],
        stackByDataFields: false,
        dataFields: ["Sales", "RevenueWithoutDiscount", "DiscountSum", "UniqOrderId.OrdersCount"],
        calculatedFields: [
          {
            name: "Sales",
            title: "Sales",
            description: "Net sales",
            formula: "[DishDiscountSumInt.withoutVAT]",
            type: "MONEY",
            canSum: false,
          },
          {
            name: "RevenueWithoutDiscount",
            title: "Revenue Before Discount",
            description: "Gross revenue before discount",
            formula: "[DishSumInt]",
            type: "MONEY",
            canSum: true,
          },
          {
            name: "DiscountSum",
            title: "Discount",
            description: "Actual discount amount",
            formula: "[DiscountSum]",
            type: "MONEY",
            canSum: true,
          },
          {
            name: "UniqOrderId.OrdersCount",
            title: "Orders Count",
            description: "Number of unique orders",
            formula: "[UniqOrderId.OrdersCount]",
            type: "NUMERIC",
            canSum: true,
          },
        ],
        filters: [
          {
            field: "OpenDate.Typed",
            filterType: "date_range",
            dateFrom: startIso,
            dateTo: endIso,
            valueMin: null,
            valueMax: null,
            valueList: [],
            includeLeft: true,
            includeRight: false,
            inclusiveList: true,
          },
        ],
        includeVoidTransactions: true,
        includeNonBusinessPaymentTypes: true,
      };

      return await this.pollOlap(client, delay, body, {
        maxAttempts: this.maxAttempts,
        fetchTimeoutMs: this.timeout,
        logEvery: 10,
      });
    });

    const rows = this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      RevenueWithoutDiscount: parseFloat(values[1]) || 0,
      DiscountSum: parseFloat(values[2]) || 0,
      "UniqOrderId.OrdersCount": parseInt(values[3]) || 0,
    }));

    return this.filterCanceledOrders(rows).rows;
  }

  buildPromotionsReport(rows = []) {
    return marketingReports.buildPromotionsReport(rows, this);
  }

  async getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo }) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const rows = await this.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo });
    const summary = this.buildOperationalSummary(rows);
    return {
      ...summary,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }

  async getRevenueWithLFL({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const includeOperationalSummary =
      String(process.env.REPORTS_ENABLE_REVENUE_OPERATIONAL_SUMMARY || "true")
        .trim()
        .toLowerCase() === "true";

    const [current, currentSummary] = await Promise.all([
      revenueService.getRevenueReport(organizationId, new Date(dateFrom), new Date(dateTo)),
      includeOperationalSummary ? this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo }).catch(() => null) : Promise.resolve(null),
    ]);

    let lfl = null;
    let lflSummary = null;
    if (lflDateFrom && lflDateTo) {
      [lfl, lflSummary] = await Promise.all([
        revenueService.getRevenueReport(organizationId, new Date(lflDateFrom), new Date(lflDateTo)).catch(() => null),
        includeOperationalSummary
          ? this.getRevenueSummaryForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null)
          : Promise.resolve(null),
      ]);
    }

    const channelsWithLFL = {};
    for (const [channel, data] of Object.entries(current.revenueByChannel || {})) {
      const lflRevenue = lfl?.revenueByChannel?.[channel]?.revenue ?? null;
      const lflOrders = lfl?.revenueByChannel?.[channel]?.orders ?? null;

      channelsWithLFL[channel] = {
        ...data,
        lflRevenue,
        lflOrders,
        revenueLFL: lflRevenue != null && lflRevenue > 0 ? Math.round(((data.revenue - lflRevenue) / lflRevenue) * 10000) / 100 : null,
        ordersLFL: lflOrders != null && lflOrders > 0 ? Math.round(((data.orders - lflOrders) / lflOrders) * 10000) / 100 : null,
        avgCheckLFL:
          lflRevenue != null && lflOrders != null && lflOrders > 0
            ? (() => {
                const lflAvg = lflRevenue / lflOrders;
                return lflAvg > 0 ? Math.round(((data.avgCheck - lflAvg) / lflAvg) * 10000) / 100 : null;
              })()
            : null,
      };
    }

    const lflTotalRevenue = lfl?.summary?.totalRevenue ?? null;
    const lflTotalOrders = lfl?.summary?.totalOrders ?? null;
    const revenueLFL =
      lflTotalRevenue != null && lflTotalRevenue > 0
        ? Math.round(((current.summary.totalRevenue - lflTotalRevenue) / lflTotalRevenue) * 10000) / 100
        : current.summary.lfl;
    const ordersLFL =
      lflTotalOrders != null && lflTotalOrders > 0
        ? Math.round(((current.summary.totalOrders - lflTotalOrders) / lflTotalOrders) * 10000) / 100
        : null;
    const calculateMetricLFL = (currentValue, previousValue) =>
      currentValue != null && previousValue != null && previousValue > 0
        ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100
        : null;

    return {
      ...current,
      summary: {
        ...current.summary,
        avgPerOrder: currentSummary?.avgPerOrder ?? current.summary.avgPerOrder,
        avgDeliveryTime: currentSummary?.avgDeliveryTime ?? null,
        avgCookingTime: currentSummary?.avgCookingTime ?? null,
        lfl: revenueLFL,
        ordersLFL,
        avgDeliveryTimeLFL: lflSummary ? calculateMetricLFL(currentSummary?.avgDeliveryTime, lflSummary?.avgDeliveryTime) : null,
        avgCookingTimeLFL: lflSummary ? calculateMetricLFL(currentSummary?.avgCookingTime, lflSummary?.avgCookingTime) : null,
        lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
      },
      revenueByChannel: channelsWithLFL,
    };
  }

  async getHourlySalesReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const rows = await this.getOperationalRowsForPeriod({ organizationId, dateFrom, dateTo });
    return { ...this.buildHourlySalesReport(rows, timezone), timezone };
  }

  async getSlaReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return { ...this.buildSlaReport([], timezone, { preparedOrders: orders }), timezone, source: "iiko-cloud" };
  }

  async getCourierKpiReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return { ...this.buildCourierKpiReport([], timezone, { preparedOrders: orders }), timezone, source: "iiko-cloud" };
  }

  async getMarketingSourcesReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    if (!this.canUseCloudDeliveryApi()) {
      throw new Error("Маркетинговые источники требуют включенный iikoCloud API (IIKO_CLOUD_BASE_URL + IIKO_CLOUD_API_LOGIN)");
    }

    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return {
      ...marketingReports.buildMarketingSourcesFromOrders(orders, this),
      timezone,
      source: "transport",
    };
  }

  async getDeliverySummaryReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return { ...this.buildDeliverySummaryReport([], timezone, { preparedOrders: orders }), timezone, source: "iiko-cloud" };
  }

  async getDeliveryDelaysReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return { ...this.buildDeliveryDelaysReport([], timezone, { preparedOrders: orders }), timezone, source: "iiko-cloud" };
  }

  async exportDeliveryDelaysReport({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const rows = await this.getOperationalRowsForDeliveryDelayExport({ organizationId, dateFrom, dateTo });
    const orders = this.toOrderEntities(rows, timezone).filter((order) =>
      this.isCourierDeliveryByServiceType({ OrderServiceType: order.orderServiceType }),
    );

    const delayedOrders = [];
    for (const order of orders) {
      const expectedDeliveryAt = order.promisedAt;
      const actualDeliveryAt = order.actualDeliveryAt;
      const actualMinutes = Number(order.totalMinutes || 0);

      if (!expectedDeliveryAt || !actualDeliveryAt) continue;

      const lateMinutes = Math.max(0, (Number(actualDeliveryAt) - Number(expectedDeliveryAt)) / (1000 * 60));

      if (lateMinutes <= 0) continue;

      delayedOrders.push({
        date: order.date || "",
        orderNumber: order.displayOrderNumber || "Без номера",
        orderType: order.orderType || "",
        orderTypeNormalized: this.normalizeOrderType(order),
        orderServiceType: order.orderServiceType || "",
        status: order.status || "",
        departmentId: order.departmentId || "",
        departmentName: order.departmentName || order.departmentId || "",
        courierId: order.courierId || "",
        courierName: order.courierName || "",
        promisedMinutes: order.openAt && expectedDeliveryAt ? this.roundMetric((Number(expectedDeliveryAt) - Number(order.openAt)) / (1000 * 60)) : 0,
        actualMinutes: this.roundMetric(actualMinutes),
        lateMinutes: this.roundMetric(lateMinutes),
        prepMinutes: this.roundMetric(order.prepMinutes),
        shelfMinutes: this.roundMetric(order.shelfMinutes),
        routeMinutes: this.roundMetric(order.routeMinutes),
        revenue: this.roundMetric(order.revenue),
        openAt: this.formatTimestampForExport(order.openAt, timezone),
        cookedAt: this.formatTimestampForExport(order.cookedAt, timezone),
        sentAt: this.formatTimestampForExport(order.sentAt, timezone),
        promisedAt: this.formatTimestampForExport(order.promisedAt, timezone),
        actualDeliveryAt: this.formatTimestampForExport(order.actualDeliveryAt, timezone),
        deliveredAt: this.formatTimestampForExport(order.deliveredAt, timezone),
      });
    }

    delayedOrders.sort((left, right) => Number(right.lateMinutes) - Number(left.lateMinutes));

    const headers = [
      "Дата",
      "Номер заказа",
      "Тип заказа",
      "Тип заказа (норм.)",
      "Тип сервиса",
      "Статус",
      "Подразделение ID",
      "Подразделение",
      "ID курьера",
      "Курьер",
      "Обещано (hh:mm:ss)",
      "Факт (hh:mm:ss)",
      "Опоздание (hh:mm:ss)",
      "Подготовка (hh:mm:ss)",
      "Ожидание на полке (hh:mm:ss)",
      "В пути (hh:mm:ss)",
      "Выручка",
      "Открыт",
      "Готов",
      "Отправлен",
      "Обещанное время",
      "Фактическое время доставки",
      "Закрыт",
    ];

    const tableRows = delayedOrders.map((item) => [
      item.date,
      item.orderNumber,
      item.orderType,
      item.orderTypeNormalized,
      item.orderServiceType,
      item.status,
      item.departmentId,
      item.departmentName,
      item.courierId,
      item.courierName,
      this.formatDurationMinutesForExport(item.promisedMinutes),
      this.formatDurationMinutesForExport(item.actualMinutes),
      this.formatDurationMinutesForExport(item.lateMinutes),
      this.formatDurationMinutesForExport(item.prepMinutes),
      this.formatDurationMinutesForExport(item.shelfMinutes),
      this.formatDurationMinutesForExport(item.routeMinutes),
      String(item.revenue),
      item.openAt,
      item.cookedAt,
      item.sentAt,
      item.promisedAt,
      item.actualDeliveryAt,
      item.deliveredAt,
    ]);

    const buffer = this.buildExcelXmlBuffer({
      sheetName: "Опоздания",
      headers,
      rows: tableRows,
    });

    const safeFrom = String(dateFrom || "").slice(0, 10);
    const safeTo = String(dateTo || "").slice(0, 10);

    return {
      buffer,
      filename: `opozdaniya-${safeFrom}-${safeTo}.xls`,
      total: delayedOrders.length,
      timezone,
    };
  }

  async getCourierMapReport({ organizationId, dateFrom, dateTo, terminalGroupId = null, statuses = [], sourceKeys = [], courierIds = [] }) {
    return await this.getDeliveryHeatmapReport({
      organizationId,
      dateFrom,
      dateTo,
      terminalGroupId,
      statuses,
      sourceKeys,
      courierIds,
    });
  }

  async getDeliveryHeatmapReport({ organizationId, dateFrom, dateTo, terminalGroupId = null, statuses = [], sourceKeys = [], courierIds = [] }) {
    this.validateHeatmapPeriod(dateFrom, dateTo);

    const timezone = await this.getOrganizationTimezone(organizationId);
    const zonesPayload = await this.getDeliveryZones({ organizationId, terminalGroupId }).catch(() => ({ geoJson: null, version: 0 }));
    const cacheKey = this.getHeatmapResultCacheKey({
      organizationId,
      dateFrom,
      dateTo,
      terminalGroupId,
      statuses,
      sourceKeys,
      courierIds,
      zoneVersion: zonesPayload.version,
    });

    const cached = this.heatmapResultCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (this.heatmapInflight.has(cacheKey)) {
      return await this.heatmapInflight.get(cacheKey);
    }

    const loadPromise = (async () => {
      const cloudOrders = await this.getCloudDeliveryOrders({
        organizationId,
        dateFrom,
        dateTo,
        terminalGroupId,
        statuses,
        sourceKeys,
        courierIds,
        timezone,
      });

      const payload = {
        ...deliveryReports.buildDeliveryHeatmapReport([], timezone, this, {
          organizationId,
          terminalGroupId,
          statuses,
          preparedOrders: cloudOrders,
          zonesGeoJson: zonesPayload.geoJson,
          zonesVersion: zonesPayload.version,
        }),
        timezone,
        source: "iiko-cloud",
      };
      this.heatmapResultCache.set(cacheKey, {
        data: payload,
        expiresAt: Date.now() + this.heatmapCacheTtlMs,
      });
      return payload;
    })();

    try {
      this.heatmapInflight.set(cacheKey, loadPromise);
      return await loadPromise;
    } finally {
      this.heatmapInflight.delete(cacheKey);
    }
  }

  async getPromotionsReport({ organizationId, dateFrom, dateTo }) {
    const rows = await this.getPromotionsRowsForPeriod({ organizationId, dateFrom, dateTo });
    return this.buildPromotionsReport(rows);
  }

  async getProductAbcReport({ organizationId, dateFrom, dateTo, abcGroup, page, limit }) {
    return await topDishesService.getMenuAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit });
  }

  async getMenuAbcReport(params) {
    return await this.getProductAbcReport(params);
  }

  async getCourierRoutes({ organizationId, dateFrom, dateTo }) {
    const timezone = await this.getOrganizationTimezone(organizationId);
    const orders = await this.getCloudDeliveryOrders({
      organizationId,
      dateFrom,
      dateTo,
      timezone,
    });
    return {
      ...this.buildRouteStats([], { preparedOrders: orders }),
      timezone,
      source: "iiko-cloud",
    };
  }

  async getOperationalMetrics({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const current = await this.getRevenueSummaryForPeriod({ organizationId, dateFrom, dateTo });

    let lfl = null;
    if (lflDateFrom && lflDateTo) {
      lfl = await this.getRevenueSummaryForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null);
    }

    const currentSummary = current;
    const lflSummary = lfl ?? null;
    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);

    return {
      avgDeliveryTime: {
        value: currentSummary.avgDeliveryTime,
        lfl: calcLFL(currentSummary.avgDeliveryTime, lflSummary?.avgDeliveryTime),
      },
      avgCookingTime: {
        value: currentSummary.avgCookingTime,
        lfl: calcLFL(currentSummary.avgCookingTime, lflSummary?.avgCookingTime),
      },
      avgPerOrder: {
        value: currentSummary.avgPerOrder,
        lfl: calcLFL(currentSummary.avgPerOrder, lflSummary?.avgPerOrder),
      },
      period: current.period,
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }
}

module.exports = new ReportsService();
