const axios = require("axios");

const reportsService = require("../reports/service");
const { buildOlapBounds } = require("../../utils/dateUtils");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROFILE_MODE = "top";
const SUPPORTED_PROFILE_MODES = new Set(["top", "all", "selected"]);
const DEFAULT_SLEEPING_THRESHOLD_DAYS = Number(process.env.CLIENT_ANALYTICS_SLEEPING_THRESHOLD_DAYS || 30);
const DEFAULT_RAW_CACHE_TTL_MS = Number(process.env.CLIENT_ANALYTICS_RAW_CACHE_TTL_MS || 90000);
const DEFAULT_ANALYTICS_CACHE_TTL_MS = Number(process.env.CLIENT_ANALYTICS_AGG_CACHE_TTL_MS || 60000);
const DEFAULT_PROFILE_CACHE_TTL_MS = Number(process.env.CLIENT_ANALYTICS_PROFILE_CACHE_TTL_MS || 10 * 60 * 1000);
const DEFAULT_MAX_PERIOD_DAYS = Number(process.env.CLIENT_ANALYTICS_MAX_PERIOD_DAYS || 90);
const DEFAULT_PROFILE_LIMIT = Number(process.env.CLIENT_ANALYTICS_PROFILE_LIMIT || 50);
const DEFAULT_OLAP_REG_LOOKBACK_FROM = String(process.env.CLIENT_ANALYTICS_OLAP_LOOKBACK_FROM || "2000-01-01");
const OLAP_PHONE_FIELD_CANDIDATES = [
  "Customer.Phone",
  "GuestPhone",
  "Client.Phone",
  "Delivery.Customer.Phone",
  "Delivery.Phone",
  "Phone",
];
const OLAP_ACCOUNT_CREATED_FIELD_CANDIDATES = [
  "Customer.WhenRegistered",
  "Customer.DateCreated",
  "Customer.CreatedDate",
  "Customer.RegistrationDate",
  "Customer.CreateDate",
  "Customer.DateAdd",
];

class ClientAnalyticsService {
  constructor() {
    this.rawOrdersCache = new Map();
    this.analyticsCache = new Map();
    this.customerInfoCache = new Map();
    this.rawOrdersInflight = new Map();
    this.analyticsInflight = new Map();
    this.customerInfoInflight = new Map();
  }

  createHttpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  parseStringArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
    return digits;
  }

  normalizeStatus(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  roundMetric(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
  }

  getDateTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  getDaysBetween(fromTimestamp, toTimestamp) {
    if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp)) return null;
    return Math.max(0, Math.floor((toTimestamp - fromTimestamp) / DAY_MS));
  }

  getPeriodDays(fromDate, toDate) {
    return Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1);
  }

  buildStatusesHash(statuses = []) {
    return (
      statuses
        .map((item) => this.normalizeStatus(item))
        .filter(Boolean)
        .sort()
        .join("|") || "__all__"
    );
  }

  buildRawCacheKey({ organizationId, terminalGroupId, from, to, statuses }) {
    return ["client-analytics:raw", organizationId, terminalGroupId || "__all__", from, to, this.buildStatusesHash(statuses)].join(":");
  }

  buildAnalyticsCacheKey(params = {}) {
    return [
      "client-analytics:agg",
      params.organizationId,
      params.terminalGroupId || "__all__",
      params.from,
      params.to,
      this.buildStatusesHash(params.statuses),
      params.includeProfile ? "profile" : "no-profile",
      params.profileMode || DEFAULT_PROFILE_MODE,
      Number(params.profileLimit || DEFAULT_PROFILE_LIMIT),
      this.parseStringArray(params.selectedPhones)
        .map((item) => this.normalizePhone(item))
        .filter(Boolean)
        .sort()
        .join("|") || "__none__",
    ].join(":");
  }

  buildCustomerInfoCacheKey(organizationId, normalizedPhone) {
    return ["customer-info", organizationId, normalizedPhone].join(":");
  }

  readCache(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  writeCache(cache, key, value, ttlMs) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  async getOrLoad({ cache, inflight, key, ttlMs, refresh = false, loader }) {
    if (!refresh) {
      const cached = this.readCache(cache, key);
      if (cached) return cached;
      if (inflight.has(key)) {
        return await inflight.get(key);
      }
    }

    const promise = (async () => {
      const value = await loader();
      return this.writeCache(cache, key, value, ttlMs);
    })();

    inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  }

  normalizeProfileMode(value) {
    const normalized =
      String(value || DEFAULT_PROFILE_MODE)
        .trim()
        .toLowerCase() || DEFAULT_PROFILE_MODE;
    return SUPPORTED_PROFILE_MODES.has(normalized) ? normalized : DEFAULT_PROFILE_MODE;
  }

  normalizeFilters(params = {}) {
    const organizationId = String(params.organizationId || "").trim();
    if (!organizationId) {
      throw this.createHttpError("organizationId обязателен");
    }

    const { from, to } = reportsService.normalizeCloudDateBounds(params.from, params.to);
    const periodDays = this.getPeriodDays(from, to);
    if (periodDays > DEFAULT_MAX_PERIOD_DAYS) {
      throw this.createHttpError(`Слишком большой период. Максимум ${DEFAULT_MAX_PERIOD_DAYS} дней`);
    }

    const statuses = this.parseStringArray(params.statuses);
    const selectedPhones = this.parseStringArray(params.selectedPhones)
      .map((item) => this.normalizePhone(item))
      .filter(Boolean);

    return {
      organizationId,
      terminalGroupId: String(params.terminalGroupId || "").trim() || null,
      from,
      to,
      fromRaw: params.from,
      toRaw: params.to,
      statuses,
      includeProfile: Boolean(params.includeProfile),
      profileMode: this.normalizeProfileMode(params.profileMode),
      profileLimit: Math.max(1, Number(params.profileLimit || DEFAULT_PROFILE_LIMIT)),
      selectedPhones,
      refresh: Boolean(params.refresh),
      periodDays,
      sleepingThresholdDays: DEFAULT_SLEEPING_THRESHOLD_DAYS,
      now: new Date(),
    };
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

  normalizeDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const isoPart = source.slice(0, 10).replace(/\./g, "-");
    return /^\d{4}-\d{2}-\d{2}$/.test(isoPart) ? isoPart : null;
  }

  buildPhoneFilterVariants(phones = []) {
    const variants = new Set();

    for (const phone of phones) {
      const normalized = this.normalizePhone(phone);
      if (!normalized) continue;
      variants.add(normalized);
      variants.add(`+${normalized}`);

      if (normalized.length === 11 && normalized.startsWith("7")) {
        variants.add(`8${normalized.slice(1)}`);
        variants.add(`+8${normalized.slice(1)}`);
      }
    }

    return [...variants];
  }

  async fetchAvailableColumns(storeId) {
    try {
      return await reportsService.withAuth(storeId, async (client) => {
        const session = client.__iikoSession || {};
        if (session.mode !== "server-v2") {
          return new Set();
        }

        const response = await reportsService.requestWithRetry(
          client,
          {
            method: "get",
            url: "/resto/api/v2/reports/olap/columns",
            params: {
              reportType: "SALES",
              ...(session.key ? { key: session.key } : {}),
            },
            timeout: Math.min(reportsService.timeout, 20000),
          },
          { stage: "olap-columns", storeId },
        );

        return this.extractColumnNames(response.data);
      });
    } catch (_) {
      return new Set();
    }
  }

  classifyByAccountCreatedTimestamp(accountCreatedTimestamp, filters) {
    if (!Number.isFinite(accountCreatedTimestamp)) {
      return { isNew: false, isReturning: false };
    }

    const fromTs = filters.from.getTime();
    const toTs = filters.to.getTime();

    return {
      isNew: accountCreatedTimestamp >= fromTs && accountCreatedTimestamp <= toTs,
      isReturning: accountCreatedTimestamp < fromTs,
    };
  }

  async fetchAccountCreatedMapViaOlap({ organizationId, phones = [], dateTo }) {
    if (!phones.length) {
      return {
        enabled: false,
        map: new Map(),
        warning: "Нет клиентов для OLAP-классификации.",
      };
    }

    if (!reportsService.serverBaseUrl && !reportsService.legacyBaseUrl) {
      return {
        enabled: false,
        map: new Map(),
        warning: "IIKO Server API не настроен.",
      };
    }

    const storeId = await reportsService.resolveStoreId(organizationId);
    const availableColumns = await this.fetchAvailableColumns(storeId);
    const phoneField = this.pickFirstAvailable(availableColumns, OLAP_PHONE_FIELD_CANDIDATES);
    const accountCreatedField = this.pickFirstAvailable(availableColumns, OLAP_ACCOUNT_CREATED_FIELD_CANDIDATES);

    if (!phoneField || !accountCreatedField) {
      return {
        enabled: false,
        map: new Map(),
        warning: "OLAP не вернул поля телефона/даты регистрации клиента.",
        phoneField,
        accountCreatedField,
      };
    }

    const dateFrom = this.normalizeDateOnly(DEFAULT_OLAP_REG_LOOKBACK_FROM) || "2000-01-01";
    const dateToNormalized = this.normalizeDateOnly(dateTo) || new Date().toISOString().slice(0, 10);
    const { startIso, endIso } = buildOlapBounds(dateFrom, dateToNormalized);
    const phoneFilterValues = this.buildPhoneFilterVariants(phones).slice(0, 5000);

    const body = {
      storeIds: [String(storeId)],
      olapType: "SALES",
      categoryFields: [],
      groupFields: [phoneField, accountCreatedField],
      stackByDataFields: false,
      dataFields: ["UniqOrderId.OrdersCount"],
      calculatedFields: [
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
        {
          field: phoneField,
          filterType: "include_values",
          valueList: phoneFilterValues,
          includeLeft: true,
          includeRight: true,
          inclusiveList: true,
        },
      ],
      includeVoidTransactions: true,
      includeNonBusinessPaymentTypes: true,
    };

    try {
      const result = await reportsService.withAuth(storeId, async (client, delay) => {
        return await reportsService.pollOlap(client, delay, body, {
          maxAttempts: reportsService.maxAttempts,
          fetchTimeoutMs: reportsService.timeout,
          logEvery: 25,
        });
      });

      const rows = reportsService.parseResultRows(result, (group) => group);
      const map = new Map();

      for (const row of rows) {
        const normalizedPhone = this.normalizePhone(row?.[phoneField]);
        const createdTs = this.getDateTimestamp(row?.[accountCreatedField]);
        if (!normalizedPhone || !Number.isFinite(createdTs)) continue;

        const existing = map.get(normalizedPhone);
        if (!Number.isFinite(existing) || createdTs < existing) {
          map.set(normalizedPhone, createdTs);
        }
      }

      return {
        enabled: true,
        map,
        phoneField,
        accountCreatedField,
        warning: null,
      };
    } catch (error) {
      return {
        enabled: false,
        map: new Map(),
        phoneField,
        accountCreatedField,
        warning: `OLAP-классификация недоступна: ${error?.message || "unknown error"}`,
      };
    }
  }

  async requestRawCloudDeliveriesChunk({ token, organizationId, from, to, statuses = [] }) {
    const body = reportsService.buildCloudDeliveriesBody({ organizationId, from, to, statuses });
    const response = await axios.post(`${reportsService.cloudApiBaseUrl}/api/1/deliveries/by_delivery_date_and_status`, body, {
      timeout: reportsService.timeout,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response?.data;
  }

  async requestRawCloudDeliveriesRange({ token, organizationId, from, to, statuses = [] }) {
    try {
      return await this.requestRawCloudDeliveriesChunk({ token, organizationId, from, to, statuses });
    } catch (error) {
      if (!reportsService.isTooManyCloudDataError(error)) {
        throw error;
      }

      const spanMs = to.getTime() - from.getTime();
      if (spanMs <= 60 * 60 * 1000) {
        throw error;
      }

      const midpoint = new Date(Math.floor((from.getTime() + to.getTime()) / 2));
      const leftPayload = await this.requestRawCloudDeliveriesRange({ token, organizationId, from, to: midpoint, statuses });
      const rightStart = new Date(midpoint.getTime() + 1);
      if (rightStart > to) {
        return leftPayload;
      }

      const rightPayload = await this.requestRawCloudDeliveriesRange({ token, organizationId, from: rightStart, to, statuses });
      return this.mergeRawOrdersPayload(leftPayload, rightPayload);
    }
  }

  mergeRawOrdersPayload(leftPayload = {}, rightPayload = {}) {
    const blocks = [...(Array.isArray(leftPayload?.ordersByOrganizations) ? leftPayload.ordersByOrganizations : [])];
    const rightBlocks = Array.isArray(rightPayload?.ordersByOrganizations) ? rightPayload.ordersByOrganizations : [];
    const blockIndex = new Map(blocks.map((block, index) => [String(block?.organizationId || ""), index]));

    for (const block of rightBlocks) {
      const organizationId = String(block?.organizationId || "");
      if (blockIndex.has(organizationId)) {
        const targetBlock = blocks[blockIndex.get(organizationId)];
        targetBlock.orders = [
          ...(Array.isArray(targetBlock?.orders) ? targetBlock.orders : []),
          ...(Array.isArray(block?.orders) ? block.orders : []),
        ];
      } else {
        blocks.push(block);
      }
    }

    return {
      ...leftPayload,
      ...rightPayload,
      ordersByOrganizations: blocks,
    };
  }

  normalizeOrder(sourceOrder = {}, organizationId = "") {
    const phone = sourceOrder?.phone || sourceOrder?.customer?.phone || null;
    const normalizedPhone = this.normalizePhone(phone);

    return {
      id: String(sourceOrder?.id || sourceOrder?.number || "").trim() || null,
      phone: normalizedPhone,
      normalizedPhone,
      organizationId: String(organizationId || sourceOrder?.organizationId || "").trim(),
      terminalGroupId: sourceOrder?.terminalGroupId ? String(sourceOrder.terminalGroupId) : null,
      status: sourceOrder?.status ? String(sourceOrder.status).trim() : null,
      sum: Number(sourceOrder?.sum || sourceOrder?.amount || 0),
      whenCreated: sourceOrder?.whenCreated || sourceOrder?.createdAt || null,
      whenDelivered: sourceOrder?.whenDelivered || sourceOrder?.deliveredAt || sourceOrder?.actualDeliveryDate || null,
      isDeleted: sourceOrder?.isDeleted === true,
    };
  }

  extractNormalizedOrders(payload = {}) {
    const organizations = Array.isArray(payload?.ordersByOrganizations) ? payload.ordersByOrganizations : [];

    return organizations.flatMap((organizationBlock) => {
      const organizationId = String(organizationBlock?.organizationId || "").trim();
      const orders = Array.isArray(organizationBlock?.orders) ? organizationBlock.orders : [];
      return orders.map((item) => {
        const sourceOrder = item?.order || item || {};
        return this.normalizeOrder(sourceOrder, organizationId);
      });
    });
  }

  isCanceledStatus(status) {
    const normalized = this.normalizeStatus(status);
    return normalized.includes("cancel") || normalized.includes("отмен");
  }

  isCompletedStatus(status) {
    const normalized = this.normalizeStatus(status);
    return (
      normalized.includes("deliver") ||
      normalized.includes("complete") ||
      normalized.includes("close") ||
      normalized.includes("достав") ||
      normalized.includes("выполн") ||
      normalized.includes("закры")
    );
  }

  shouldIncludeOrder(order, filters) {
    if (!order || order.isDeleted || !order.normalizedPhone) return false;
    if (filters.terminalGroupId && String(order.terminalGroupId || "") !== filters.terminalGroupId) return false;

    const normalizedStatuses = filters.statuses.map((item) => this.normalizeStatus(item)).filter(Boolean);
    if (normalizedStatuses.length > 0) {
      return normalizedStatuses.includes(this.normalizeStatus(order.status));
    }

    if (this.isCanceledStatus(order.status)) return false;
    return this.isCompletedStatus(order.status) || Boolean(order.whenDelivered);
  }

  defineSegment(client) {
    if (client.isSleeping) return "sleeping";
    if (client.ordersCount === 1) return "new";
    if (client.ordersCount <= 3) return "returning";
    if (client.ordersCount <= 9) return "loyal";
    return "vip";
  }

  createClientRecord(clientKey, phone) {
    return {
      clientKey,
      phone,
      ordersCount: 0,
      revenue: 0,
      avgCheck: 0,
      orderFrequency: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      daysSinceLastOrder: null,
      isNew: false,
      isReturning: false,
      isSleeping: false,
      segment: "new",
      accountCreatedAt: null,
      cohortSource: null,
    };
  }

  recalculateClientCohorts(clients = [], filters, options = {}) {
    const accountCreatedMap = options.accountCreatedMap instanceof Map ? options.accountCreatedMap : new Map();
    const source = options.source || "heuristic";
    const disableReturningDetection = Boolean(options.disableReturningDetection);

    let resolvedByAccountCreated = 0;
    let unresolved = 0;

    const updatedClients = clients.map((client) => {
      const accountCreatedTs = accountCreatedMap.get(client.clientKey);
      const hasAccountCreated = Number.isFinite(accountCreatedTs);
      const accountCreatedIso = hasAccountCreated ? new Date(accountCreatedTs).toISOString() : client.accountCreatedAt || null;
      const cohort = hasAccountCreated ? this.classifyByAccountCreatedTimestamp(accountCreatedTs, filters) : null;

      let isNew = client.isNew;
      let isReturning = client.isReturning;

      if (cohort) {
        isNew = cohort.isNew;
        isReturning = cohort.isReturning;
        resolvedByAccountCreated += 1;
      } else if (disableReturningDetection) {
        isReturning = false;
        unresolved += 1;
      } else {
        unresolved += 1;
      }

      return {
        ...client,
        isNew,
        isReturning,
        accountCreatedAt: accountCreatedIso,
        cohortSource: cohort ? source : client.cohortSource || null,
      };
    });

    return {
      clients: updatedClients,
      meta: {
        source,
        resolvedByAccountCreated,
        unresolved,
        returningDetectionEnabled: !disableReturningDetection,
      },
    };
  }

  refreshSummaryAndSegments(payload = {}) {
    const clients = Array.isArray(payload.clients) ? payload.clients : [];
    payload.summary = {
      ...(payload.summary || {}),
      newClients: clients.filter((item) => item.isNew).length,
      returningClients: clients.filter((item) => item.isReturning).length,
      sleepingClients: clients.filter((item) => item.isSleeping).length,
    };
    payload.segments = ["new", "returning", "loyal", "vip", "sleeping"].map((segment) => ({
      segment,
      count: clients.filter((item) => item.segment === segment).length,
    }));
    return payload;
  }

  buildMetaBuckets(orders = []) {
    const terminalGroups = new Map();
    const statuses = new Map();

    for (const order of orders) {
      const terminalGroupId = String(order?.terminalGroupId || "").trim();
      const status = String(order?.status || "").trim();

      if (terminalGroupId) {
        terminalGroups.set(terminalGroupId, (terminalGroups.get(terminalGroupId) || 0) + 1);
      }

      if (status) {
        statuses.set(status, (statuses.get(status) || 0) + 1);
      }
    }

    return {
      availableTerminalGroups: [...terminalGroups.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
      availableStatuses: [...statuses.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    };
  }

  aggregateClients(orders = [], filters, baseMeta = {}) {
    const clientsMap = new Map();

    for (const order of orders) {
      const key = order.normalizedPhone;
      const client = clientsMap.get(key) || this.createClientRecord(key, order.phone || key);

      client.ordersCount += 1;
      client.revenue += Number(order.sum || 0);

      const createdTimestamp = this.getDateTimestamp(order.whenCreated);
      if (createdTimestamp != null) {
        const createdIso = new Date(createdTimestamp).toISOString();
        if (!client.firstOrderAt || createdIso < client.firstOrderAt) client.firstOrderAt = createdIso;
        if (!client.lastOrderAt || createdIso > client.lastOrderAt) client.lastOrderAt = createdIso;
      }

      clientsMap.set(key, client);
    }

    const nowTimestamp = filters.now.getTime();
    let totalRevenue = 0;
    let totalOrders = 0;

    const clients = [...clientsMap.values()]
      .map((client) => {
        totalRevenue += client.revenue;
        totalOrders += client.ordersCount;

        client.revenue = this.roundMetric(client.revenue);
        client.avgCheck = client.ordersCount > 0 ? this.roundMetric(client.revenue / client.ordersCount) : 0;
        client.orderFrequency = this.roundMetric(client.ordersCount / filters.periodDays);
        const lastOrderTimestamp = this.getDateTimestamp(client.lastOrderAt);
        client.daysSinceLastOrder = lastOrderTimestamp == null ? null : this.getDaysBetween(lastOrderTimestamp, nowTimestamp);
        client.isNew = client.ordersCount === 1;
        client.isReturning = client.ordersCount >= 2;
        client.isSleeping = client.daysSinceLastOrder != null && client.daysSinceLastOrder > filters.sleepingThresholdDays;
        client.segment = this.defineSegment(client);
        client.cohortSource = "heuristic";
        return client;
      })
      .sort((a, b) => b.revenue - a.revenue || b.ordersCount - a.ordersCount || a.clientKey.localeCompare(b.clientKey));

    const summary = {
      uniqueClients: clients.length,
      newClients: clients.filter((item) => item.isNew).length,
      returningClients: clients.filter((item) => item.isReturning).length,
      sleepingClients: clients.filter((item) => item.isSleeping).length,
      totalOrders,
      totalRevenue: this.roundMetric(totalRevenue),
      avgCheck: totalOrders > 0 ? this.roundMetric(totalRevenue / totalOrders) : 0,
      avgOrdersPerClient: clients.length > 0 ? this.roundMetric(totalOrders / clients.length) : 0,
    };

    const segments = ["new", "returning", "loyal", "vip", "sleeping"].map((segment) => ({
      segment,
      count: clients.filter((item) => item.segment === segment).length,
    }));

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        organizationId: filters.organizationId,
        terminalGroupId: filters.terminalGroupId,
        from: filters.from.toISOString(),
        to: filters.to.toISOString(),
        statuses: filters.statuses,
        includeProfile: filters.includeProfile,
        profileMode: filters.profileMode,
        profileLimit: filters.profileLimit,
      },
      summary,
      segments,
      clients,
      meta: {
        source: "iiko-cloud-deliveries",
        periodDays: filters.periodDays,
        sleepingThresholdDays: filters.sleepingThresholdDays,
        ...baseMeta,
      },
    };
  }

  pickClientsForProfile(clients = [], filters) {
    if (!filters.includeProfile || clients.length === 0) return [];

    if (filters.profileMode === "all") {
      return clients;
    }

    if (filters.profileMode === "selected") {
      const selected = new Set(filters.selectedPhones);
      return clients.filter((client) => selected.has(client.clientKey));
    }

    return clients.slice(0, filters.profileLimit);
  }

  mapProfile(profile = {}) {
    const categories = Array.isArray(profile?.categories) ? profile.categories : [];
    return {
      id: profile?.id ? String(profile.id) : undefined,
      name: profile?.name ? String(profile.name) : undefined,
      surname: profile?.surname ? String(profile.surname) : undefined,
      whenRegistered: profile?.whenRegistered || undefined,
      firstOrderDate: profile?.firstOrderDate || undefined,
      lastProcessedOrderDate: profile?.lastProcessedOrderDate || undefined,
      categories: categories.map((category) => ({
        id: String(category?.id || ""),
        name: String(category?.name || ""),
        isActive: Boolean(category?.isActive),
      })),
    };
  }

  async fetchCustomerInfo({ organizationId, normalizedPhone, refresh = false }) {
    const cacheKey = this.buildCustomerInfoCacheKey(organizationId, normalizedPhone);
    return await this.getOrLoad({
      cache: this.customerInfoCache,
      inflight: this.customerInfoInflight,
      key: cacheKey,
      ttlMs: DEFAULT_PROFILE_CACHE_TTL_MS,
      refresh,
      loader: async () => {
        const token = await reportsService.getCloudApiToken();
        const response = await axios.post(
          `${reportsService.cloudApiBaseUrl}/api/1/loyalty/iiko/customer/info`,
          {
            phone: normalizedPhone,
            type: "phone",
            organizationId,
          },
          {
            timeout: reportsService.timeout,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        return this.mapProfile(response?.data || {});
      },
    }).catch((error) => {
      console.error("❌ ClientAnalyticsService.fetchCustomerInfo:", normalizedPhone, error.message);
      return null;
    });
  }

  async enrichClients(clients = [], filters) {
    const targetClients = this.pickClientsForProfile(clients, filters);
    if (targetClients.length === 0) {
      return { clients, profilesRequested: 0 };
    }

    const profileEntries = await Promise.all(
      targetClients.map(async (client) => {
        const profile = await this.fetchCustomerInfo({
          organizationId: filters.organizationId,
          normalizedPhone: client.clientKey,
          refresh: filters.refresh,
        });
        return [client.clientKey, profile];
      }),
    );

    const profilesByClient = new Map(profileEntries.filter(([, profile]) => profile));
    let resolvedByProfileRegistration = 0;
    const enrichedClients = clients.map((client) => {
      const profile = profilesByClient.get(client.clientKey);
      if (!profile) return client;

      const profileRegistrationTs = this.getDateTimestamp(profile.whenRegistered) ?? this.getDateTimestamp(profile.firstOrderDate);
      const hasProfileRegistration = Number.isFinite(profileRegistrationTs);
      const cohort = hasProfileRegistration ? this.classifyByAccountCreatedTimestamp(profileRegistrationTs, filters) : null;

      if (hasProfileRegistration) {
        resolvedByProfileRegistration += 1;
      }

      return {
        ...client,
        isNew: cohort ? cohort.isNew : client.isNew,
        isReturning: cohort ? cohort.isReturning : client.isReturning,
        accountCreatedAt: cohort ? new Date(profileRegistrationTs).toISOString() : client.accountCreatedAt || null,
        cohortSource: cohort ? "profile" : client.cohortSource,
        profile,
      };
    });

    return {
      clients: enrichedClients,
      profilesRequested: targetClients.length,
      resolvedByProfileRegistration,
    };
  }

  async fetchRawOrders(filters) {
    if (!reportsService.canUseCloudDeliveryApi()) {
      throw this.createHttpError("Не настроен доступ к iiko Cloud API", 500);
    }

    const token = await reportsService.getCloudApiToken();
    const payload = await this.requestRawCloudDeliveriesRange({
      token,
      organizationId: filters.organizationId,
      from: filters.from,
      to: filters.to,
      statuses: filters.statuses,
    });

    return this.extractNormalizedOrders(payload);
  }

  async getClientAnalytics(params = {}) {
    const filters = this.normalizeFilters(params);
    const rawCacheKey = this.buildRawCacheKey({
      organizationId: filters.organizationId,
      terminalGroupId: filters.terminalGroupId,
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      statuses: filters.statuses,
    });
    const analyticsCacheKey = this.buildAnalyticsCacheKey({
      ...filters,
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
    });

    const rawOrders = await this.getOrLoad({
      cache: this.rawOrdersCache,
      inflight: this.rawOrdersInflight,
      key: rawCacheKey,
      ttlMs: DEFAULT_RAW_CACHE_TTL_MS,
      refresh: filters.refresh,
      loader: async () => await this.fetchRawOrders(filters),
    });

    const baseOrders = rawOrders.filter((order) => !order.isDeleted && Boolean(order.normalizedPhone));
    const baseMeta = this.buildMetaBuckets(baseOrders);

    return await this.getOrLoad({
      cache: this.analyticsCache,
      inflight: this.analyticsInflight,
      key: analyticsCacheKey,
      ttlMs: DEFAULT_ANALYTICS_CACHE_TTL_MS,
      refresh: filters.refresh,
      loader: async () => {
        const filteredOrders = baseOrders.filter((order) => this.shouldIncludeOrder(order, filters));
        const aggregated = this.aggregateClients(filteredOrders, filters, baseMeta);
        const cohortFromOlap = await this.fetchAccountCreatedMapViaOlap({
          organizationId: filters.organizationId,
          phones: aggregated.clients.map((client) => client.clientKey),
          dateTo: filters.to,
        });
        const olapCohortResult = this.recalculateClientCohorts(aggregated.clients, filters, {
          accountCreatedMap: cohortFromOlap.map,
          source: "olap-server",
          disableReturningDetection: !cohortFromOlap.enabled,
        });

        let finalPayload = {
          ...aggregated,
          clients: olapCohortResult.clients,
          meta: {
            ...aggregated.meta,
            profilesRequested: 0,
            accountCreatedSource: cohortFromOlap.enabled ? "olap-server" : "disabled",
            accountCreatedPhoneField: cohortFromOlap.phoneField || null,
            accountCreatedDateField: cohortFromOlap.accountCreatedField || null,
            accountCreatedResolvedClients: olapCohortResult.meta.resolvedByAccountCreated,
            accountCreatedUnresolvedClients: olapCohortResult.meta.unresolved,
            returningDetectionEnabled: olapCohortResult.meta.returningDetectionEnabled,
            warningMessage: cohortFromOlap.warning || aggregated?.meta?.warningMessage || null,
          },
        };

        if (!filters.includeProfile) {
          return this.refreshSummaryAndSegments(finalPayload);
        }

        const enrichment = await this.enrichClients(finalPayload.clients, filters);
        finalPayload.clients = enrichment.clients;
        finalPayload.meta = {
          ...finalPayload.meta,
          profilesRequested: enrichment.profilesRequested,
          profileRegistrationResolvedClients: enrichment.resolvedByProfileRegistration || 0,
          accountCreatedSource:
            (enrichment.resolvedByProfileRegistration || 0) > 0 && !cohortFromOlap.enabled ? "profile-fallback" : finalPayload.meta.accountCreatedSource,
          returningDetectionEnabled:
            finalPayload.meta.returningDetectionEnabled || (enrichment.resolvedByProfileRegistration || 0) > 0,
        };

        return this.refreshSummaryAndSegments(finalPayload);
      },
    });
  }
}

module.exports = new ClientAnalyticsService();
