const ConcurrencyLimiter = require("./ConcurrencyLimiter");
const IikoHttpClient = require("./IikoHttpClient");
const OlapPoller = require("./OlapPoller");
const OlapQueryBuilder = require("./OlapQueryBuilder");
const fileLogger = require("../../utils/fileLogger");

class OlapClient {
  constructor(options = {}) {
    this.resolveOrganizations = typeof options.resolveOrganizations === "function" ? options.resolveOrganizations : async () => [];
    this.customResolveStoreId = typeof options.resolveStoreId === "function" ? options.resolveStoreId : null;
    this.customResolveLegacyStoreId = typeof options.resolveLegacyStoreId === "function" ? options.resolveLegacyStoreId : null;
    this.logger = options.logger || fileLogger;
    this.concurrencyLimiter = options.concurrencyLimiter || OlapClient.sharedConcurrencyLimiter;
    this.queryBuilder = new OlapQueryBuilder();
    this.httpClient = new IikoHttpClient({
      ...options,
      logger: this.logger,
      concurrencyLimiter: this.concurrencyLimiter,
      resolveLegacyStoreId: this.resolveLegacyStoreId.bind(this),
    });
    this.poller = new OlapPoller({
      ...options,
      logger: this.logger,
      httpClient: this.httpClient,
      queryBuilder: this.queryBuilder,
    });

    this.serverBaseUrl = options.serverBaseUrl || process.env.IIKO_SERVER_BASE_URL || process.env.IIKO_BASE_URL;
    this.legacyBaseUrl = options.legacyBaseUrl || process.env.IIKO_WEB_BASE_URL || process.env.IIKO_BASE_URL || process.env.IIKO_SERVER_BASE_URL;
    this.timeout = Number(options.timeout || process.env.IIKO_TIMEOUT || 45000);
    this.pollInterval = Number(options.pollInterval || 500);
    this.maxAttempts = Number(options.maxAttempts || process.env.IIKO_OLAP_MAX_ATTEMPTS || 120);
    this.maxNetworkRetries = Number(options.maxNetworkRetries || process.env.IIKO_NETWORK_RETRIES || 4);
    this.maxConcurrentRequests = Number(options.maxConcurrentRequests || process.env.IIKO_MAX_CONCURRENT_REQUESTS || 1);
  }

  get serverBaseUrl() {
    return this.httpClient.serverBaseUrl;
  }

  set serverBaseUrl(value) {
    this.httpClient.serverBaseUrl = this.normalizeBaseUrl(value);
  }

  get legacyBaseUrl() {
    return this.httpClient.legacyBaseUrl;
  }

  set legacyBaseUrl(value) {
    this.httpClient.legacyBaseUrl = this.normalizeBaseUrl(value);
  }

  get timeout() {
    return this.httpClient.timeout;
  }

  set timeout(value) {
    const normalized = Number(value) || 45000;
    this.httpClient.timeout = normalized;
    this.poller.timeout = normalized;
  }

  get pollInterval() {
    return this.poller.pollInterval;
  }

  set pollInterval(value) {
    this.poller.pollInterval = Number(value) || 500;
  }

  get maxAttempts() {
    return this.poller.maxAttempts;
  }

  set maxAttempts(value) {
    this.poller.maxAttempts = Number(value) || 120;
  }

  get maxNetworkRetries() {
    return this.httpClient.maxNetworkRetries;
  }

  set maxNetworkRetries(value) {
    this.httpClient.maxNetworkRetries = Number(value) || 4;
  }

  get maxConcurrentRequests() {
    return this.concurrencyLimiter.maxConcurrent;
  }

  set maxConcurrentRequests(value) {
    this.concurrencyLimiter.setLimit(value);
  }

  normalizeBaseUrl(value) {
    return (
      this.httpClient?.normalizeBaseUrl(value) ||
      String(value || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/resto\/api$/i, "")
    );
  }

  async delay(ms) {
    return await this.httpClient.delay(ms);
  }

  async runWithConcurrencyLimit(task) {
    return await this.concurrencyLimiter.run(task);
  }

  isRetriableError(error) {
    return this.httpClient.isRetriableError(error);
  }

  getRetryDelay(attempt) {
    return this.httpClient.getRetryDelay(attempt);
  }

  shouldSuppressRetryLog(context = {}, error) {
    return this.httpClient.shouldSuppressRetryLog(context, error);
  }

  async withRetry(fn, context = {}, retries = this.maxNetworkRetries) {
    return await this.httpClient.withRetry(fn, context, retries);
  }

  async requestWithRetry(client, config, context = {}, retries = this.maxNetworkRetries) {
    return await this.httpClient.requestWithRetry(client, config, context, retries);
  }

  isPendingOlapResponse(response) {
    return response?.status === 400;
  }

  createPasswordHash(password) {
    return this.httpClient.createPasswordHash(password);
  }

  extractToken(data) {
    return this.httpClient.extractToken(data);
  }

  shouldFallbackToLegacy(error) {
    return this.httpClient.shouldFallbackToLegacy(error);
  }

  extractOlapFieldName(value) {
    return this.queryBuilder.extractOlapFieldName(value);
  }

  normalizeServerDateValue(value) {
    return this.queryBuilder.normalizeServerDateValue(value);
  }

  normalizeServerFilter(filter = {}) {
    return this.queryBuilder.normalizeServerFilter(filter);
  }

  normalizeFilters(filters) {
    return this.queryBuilder.normalizeFilters(filters);
  }

  buildServerReportBody(body = {}) {
    return this.queryBuilder.buildServerReportBody(body);
  }

  normalizeServerRows(result, body = {}) {
    return this.queryBuilder.normalizeServerRows(result, body);
  }

  normalizeFlag(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim().toUpperCase();
  }

  isTrueFlag(value) {
    if (value === true || value === 1) {
      return true;
    }

    const flag = this.normalizeFlag(value);
    return flag === "TRUE" || flag === "YES" || flag === "1";
  }

  isDeletedOrderFlag(value) {
    const flag = this.normalizeFlag(value);
    return flag === "DELETED" || flag === "ORDER_DELETED";
  }

  hasItemDeletionFlag(value) {
    const flag = this.normalizeFlag(value);
    return Boolean(flag) && flag !== "NOT_DELETED";
  }

  getOrderId(row = {}) {
    return row["UniqOrderId.Id"] || row.OrderId || `${row.OrderNum || "NA"}|${row.OpenTime || ""}|${row.CloseTime || ""}`;
  }

  filterCanceledOrders(rows = []) {
    const ordersMap = new Map();

    for (const row of rows) {
      const orderId = this.getOrderId(row);
      const isOrderDeleted = this.isDeletedOrderFlag(row.OrderDeleted);
      const isStorned = this.isTrueFlag(row.Storned);
      const hasCancelCause = Boolean(String(row["Delivery.CancelCause"] || "").trim());
      const hasItemDeletion = this.hasItemDeletionFlag(row.DeletedWithWriteoff);
      const sales = Number(row.Sales ?? row["DishDiscountSumInt.withoutVAT"] ?? 0);
      const revenueWithoutDiscount = Number(row.RevenueWithoutDiscount ?? row.DishSumInt ?? 0);

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          rows: [],
          isOrderDeleted: false,
          isStorned: false,
          hasCancelCause: false,
          hasItemDeletion: false,
          sales: 0,
          revenueWithoutDiscount: 0,
        });
      }

      const order = ordersMap.get(orderId);
      order.rows.push(row);
      order.isOrderDeleted = order.isOrderDeleted || isOrderDeleted;
      order.isStorned = order.isStorned || isStorned;
      order.hasCancelCause = order.hasCancelCause || hasCancelCause;
      order.hasItemDeletion = order.hasItemDeletion || hasItemDeletion;
      order.sales += sales;
      order.revenueWithoutDiscount += revenueWithoutDiscount;
    }

    const activeRows = [];
    let includedRows = 0;
    let excludedRows = 0;
    const orderStats = {
      totalDistinctOrders: ordersMap.size,
      canceledOrders: 0,
      orderDeleted: 0,
      storned: 0,
      withCancelCause: 0,
      withItemDeletion: 0,
      activeOrders: 0,
      stornoAdjustment: 0,
    };

    for (const order of ordersMap.values()) {
      const isCanceledOrder = order.isOrderDeleted || order.isStorned || order.hasCancelCause || order.hasItemDeletion;

      if (order.isOrderDeleted) orderStats.orderDeleted += 1;
      if (order.isStorned) orderStats.storned += 1;
      if (order.hasCancelCause) orderStats.withCancelCause += 1;
      if (order.hasItemDeletion) orderStats.withItemDeletion += 1;

      if (isCanceledOrder) {
        orderStats.canceledOrders += 1;

        if (order.isStorned && order.revenueWithoutDiscount < 0) {
          orderStats.stornoAdjustment += order.revenueWithoutDiscount;
        }

        excludedRows += order.rows.length;
        continue;
      }

      includedRows += order.rows.length;
      orderStats.activeOrders += 1;
      activeRows.push(...order.rows);
    }

    return {
      rows: activeRows,
      includedRows,
      excludedRows,
      orderStats,
    };
  }

  async resolveStoreId(organizationId) {
    if (this.customResolveStoreId) {
      return await this.customResolveStoreId(organizationId);
    }

    const normalizedId = String(organizationId || "");
    const organizations = await this.resolveOrganizations().catch(() => []);
    const organization =
      typeof organizationId === "object" && organizationId !== null
        ? organizationId
        : organizations.find(
            (item) =>
              String(item.id) === normalizedId ||
              String(item.storeId) === normalizedId ||
              String(item.serverStoreId) === normalizedId ||
              String(item.legacyStoreId) === normalizedId ||
              String(item.iikoId) === normalizedId ||
              String(item.restaurantId) === normalizedId ||
              String(item.code) === normalizedId,
          );

    if (organization?.serverStoreId) {
      return String(organization.serverStoreId);
    }

    if (organization?.storeId) {
      return String(organization.storeId);
    }

    const fallbackCandidates = [organization?.legacyStoreId, organization?.iikoId, organization?.restaurantId, organization?.code, organization?.id];
    for (const candidate of fallbackCandidates) {
      const normalizedCandidate = String(candidate || "").trim();
      if (/^\d+$/.test(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }

    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    throw new Error(`Не удалось получить storeId из iiko для организации ${normalizedId}`);
  }

  async resolveLegacyStoreId(storeId) {
    if (this.customResolveLegacyStoreId) {
      return await this.customResolveLegacyStoreId(storeId);
    }

    const normalizedId = String(storeId || "").trim();
    if (/^\d+$/.test(normalizedId)) {
      return normalizedId;
    }

    const organizations = await this.resolveOrganizations().catch(() => []);
    const organization = organizations.find(
      (item) =>
        String(item.id) === normalizedId ||
        String(item.storeId) === normalizedId ||
        String(item.serverStoreId) === normalizedId ||
        String(item.legacyStoreId) === normalizedId ||
        String(item.iikoId) === normalizedId ||
        String(item.restaurantId) === normalizedId ||
        String(item.code) === normalizedId,
    );

    const fallbackCandidates = [organization?.legacyStoreId, organization?.iikoId, organization?.restaurantId];
    for (const candidate of fallbackCandidates) {
      const normalizedCandidate = String(candidate || "").trim();
      if (/^\d+$/.test(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }

    return normalizedId;
  }

  createClient(baseURL = this.serverBaseUrl || this.legacyBaseUrl) {
    return this.httpClient.createClient(baseURL);
  }

  async authenticateWithServerApi(client, storeId) {
    return await this.httpClient.authenticateWithServerApi(client, storeId);
  }

  async authenticateLegacyApi(client, storeId) {
    return await this.httpClient.authenticateLegacyApi(client, storeId);
  }

  async logout(client) {
    return await this.httpClient.logout(client);
  }

  async withAuth(storeId, fn, options = {}) {
    return await this.httpClient.withAuth(storeId, fn, options);
  }

  async executeServerOlap(client, body, options = {}) {
    return await this.poller.executeServerOlap(client, body, options);
  }

  async executeLegacyOlap(client, delay, body, options = {}) {
    return await this.poller.executeLegacyOlap(client, delay, body, options);
  }

  async pollOlap(client, delay, body, options = {}) {
    return await this.poller.pollOlap(client, delay, body, options);
  }

  parseResultRows(result, cellsMapper) {
    return this.queryBuilder.parseResultRows(result, cellsMapper);
  }
}

OlapClient.sharedConcurrencyLimiter = new ConcurrencyLimiter(Number(process.env.IIKO_MAX_CONCURRENT_REQUESTS || 1));

module.exports = OlapClient;
