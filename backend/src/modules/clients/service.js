const OlapClient = require("../shared/olapClient");
const organizationsService = require("../organizations/service");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class ClientsService extends OlapClient {
  constructor() {
    super({
      resolveOrganizations: () => organizationsService.getOrganizations(),
    });
  }

  toDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const isoPart = source.slice(0, 10).replace(/\./g, "-");
    return /^\d{4}-\d{2}-\d{2}$/.test(isoPart) ? isoPart : null;
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

  normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 10) return `7${digits}`;
    return digits;
  }

  getWeekStart(dateStr) {
    const date = new Date(`${dateStr}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return null;
    const day = date.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diffToMonday);
    return date.toISOString().slice(0, 10);
  }

  getWeekEnd(weekStart) {
    const date = new Date(`${weekStart}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return weekStart;
    date.setUTCDate(date.getUTCDate() + 6);
    return date.toISOString().slice(0, 10);
  }

  getDaysDiff(fromDate, toDate) {
    const fromTs = new Date(`${fromDate}T00:00:00Z`).getTime();
    const toTs = new Date(`${toDate}T00:00:00Z`).getTime();
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs < fromTs) return null;
    return Math.floor((toTs - fromTs) / (1000 * 60 * 60 * 24));
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

  pickFirstAvailable(columnsSet, candidates = []) {
    for (const candidate of candidates) {
      if (columnsSet.has(candidate)) return candidate;
    }
    return null;
  }

  async fetchClientRows({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const startDate = this.toDateOnly(dateFrom);
    const endDate = this.toDateOnly(dateTo);
    const { startIso, endIso } = buildOlapBounds(startDate || toMoscowDateStr(new Date(dateFrom)), endDate || toMoscowDateStr(new Date(dateTo)));

    const availableColumns = await this.fetchAvailableColumns(storeId);

    const identityCandidates = {
      id: ["Customer.Id", "Client.Id", "Guest.Id", "CardNumber", "Card.Number", "Delivery.Customer.Id", "ClientCardNumber"],
      phone: ["Customer.Phone", "GuestPhone", "Client.Phone", "Delivery.Customer.Phone", "Delivery.Phone", "Phone"],
      name: ["Customer", "Customer.Name", "Guest", "GuestName", "Client", "Client.Name", "Delivery.Customer"],
    };

    const resolvedIdentity = {
      idField: this.pickFirstAvailable(availableColumns, identityCandidates.id),
      phoneField: this.pickFirstAvailable(availableColumns, identityCandidates.phone),
      nameField: this.pickFirstAvailable(availableColumns, identityCandidates.name),
    };

    const baseFields = ["OpenDate.Typed", "OrderNum", "UniqOrderId.Id", "OrderDeleted", "Storned", "DeletedWithWriteoff", "Delivery.CancelCause"];

    const strategyFields = [];
    if (resolvedIdentity.idField) strategyFields.push(resolvedIdentity.idField);
    if (resolvedIdentity.phoneField && resolvedIdentity.phoneField !== resolvedIdentity.idField) strategyFields.push(resolvedIdentity.phoneField);
    if (resolvedIdentity.nameField && !strategyFields.includes(resolvedIdentity.nameField)) strategyFields.push(resolvedIdentity.nameField);

    const fallbackStrategies = [
      ["Delivery.Customer.Phone", "Delivery.Customer", "OpenDate.Typed", "OrderNum", "UniqOrderId.Id"],
      ["Customer.Phone", "Customer", "OpenDate.Typed", "OrderNum", "UniqOrderId.Id"],
      ["GuestPhone", "Guest", "OpenDate.Typed", "OrderNum", "UniqOrderId.Id"],
      ["CardNumber", "OpenDate.Typed", "OrderNum", "UniqOrderId.Id"],
      ["OpenDate.Typed", "OrderNum", "UniqOrderId.Id"],
    ];

    const fieldAttempts = [];
    fieldAttempts.push([...new Set([...baseFields, ...strategyFields])]);
    for (const strategy of fallbackStrategies) {
      fieldAttempts.push([...new Set([...baseFields, ...strategy])]);
    }

    const buildBody = (groupFields) => ({
      storeIds: [String(storeId)],
      olapType: "SALES",
      categoryFields: [],
      groupFields,
      stackByDataFields: false,
      dataFields: ["Sales", "UniqOrderId.OrdersCount"],
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

    let parsedRows = [];
    let selectedFields = fieldAttempts[fieldAttempts.length - 1];
    let lastError = null;

    for (const fields of fieldAttempts) {
      try {
        const result = await this.withAuth(storeId, async (client, delay) => {
          return await this.pollOlap(client, delay, buildBody(fields), {
            maxAttempts: this.maxAttempts,
            fetchTimeoutMs: this.timeout,
            logEvery: 20,
          });
        });

        parsedRows = this.parseResultRows(result, (group, values) => ({
          ...group,
          Sales: parseFloat(values[0]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[1]) || 0,
        }));
        selectedFields = fields;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    const activeRows = this.filterCanceledOrders(parsedRows).rows;
    return { rows: activeRows, selectedFields, resolvedIdentity };
  }

  resolveClientIdentity(row = {}, resolvedIdentity = {}) {
    const getFieldValue = (field) => (field ? String(row[field] || "").trim() : "");

    const rawId = getFieldValue(resolvedIdentity.idField);
    const rawPhone = getFieldValue(resolvedIdentity.phoneField);
    const rawName = getFieldValue(resolvedIdentity.nameField);

    const normalizedPhone = this.normalizePhone(rawPhone || rawId);
    const normalizedId = rawId || normalizedPhone || rawName;

    if (!normalizedId) {
      return null;
    }

    const normalizedKey = normalizedPhone || normalizedId;
    return {
      clientKey: `client:${normalizedKey}`,
      clientId: normalizedId,
      clientName: rawName || (normalizedPhone ? `Клиент ${normalizedPhone}` : "Клиент без имени"),
      phone: normalizedPhone || null,
    };
  }

  buildClientsPayload(rows = [], { dateFrom, dateTo, selectedFields, resolvedIdentity }) {
    const orderMap = new Map();

    rows.forEach((row, index) => {
      const orderId = String(row["UniqOrderId.Id"] || `row-${index}`).trim();
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          orderId,
          date: this.extractDateOnly(row["OpenDate.Typed"]),
          orderNumber: String(row.OrderNum || "").trim() || null,
          revenue: 0,
          identity: this.resolveClientIdentity(row, resolvedIdentity),
        });
      }

      const order = orderMap.get(orderId);
      order.revenue += Number(row.Sales || 0);
      if (!order.identity) {
        order.identity = this.resolveClientIdentity(row, resolvedIdentity);
      }
      if (!order.date) {
        order.date = this.extractDateOnly(row["OpenDate.Typed"]);
      }
    });

    const clientsMap = new Map();
    let totalRevenue = 0;
    let totalOrders = 0;
    let unidentifiedOrders = 0;

    for (const order of orderMap.values()) {
      totalRevenue += Number(order.revenue || 0);
      totalOrders += 1;

      if (!order.identity || !order.date) {
        unidentifiedOrders += 1;
        continue;
      }

      const { clientKey, clientId, clientName, phone } = order.identity;
      if (!clientsMap.has(clientKey)) {
        clientsMap.set(clientKey, {
          clientKey,
          clientId,
          clientName,
          phone,
          orders: 0,
          revenue: 0,
          firstOrderDate: order.date,
          lastOrderDate: order.date,
          orderDates: new Set(),
        });
      }

      const client = clientsMap.get(clientKey);
      client.orders += 1;
      client.revenue += Number(order.revenue || 0);
      client.orderDates.add(order.date);
      if (order.date < client.firstOrderDate) client.firstOrderDate = order.date;
      if (order.date > client.lastOrderDate) client.lastOrderDate = order.date;
      if (!client.phone && phone) client.phone = phone;
      if ((!client.clientName || client.clientName === "Клиент без имени") && clientName) client.clientName = clientName;
    }

    const clients = [...clientsMap.values()].map((client) => ({
      ...client,
      revenue: Math.round(client.revenue * 100) / 100,
      avgCheck: client.orders > 0 ? Math.round((client.revenue / client.orders) * 100) / 100 : 0,
      orderDates: [...client.orderDates].sort(),
      daysSinceLastOrder: this.getDaysDiff(client.lastOrderDate, dateTo),
    }));

    const newClients = clients.filter((client) => client.firstOrderDate >= dateFrom && client.firstOrderDate <= dateTo);
    const repeatClients = clients.filter((client) => client.orders > 1);

    const weeklyMap = new Map();
    for (const order of orderMap.values()) {
      if (!order.identity || !order.date) continue;
      const weekStart = this.getWeekStart(order.date);
      if (!weekStart) continue;

      if (!weeklyMap.has(weekStart)) {
        weeklyMap.set(weekStart, {
          weekStart,
          weekEnd: this.getWeekEnd(weekStart),
          clients: new Set(),
          newClients: new Set(),
          returningClients: new Set(),
          orders: 0,
          revenue: 0,
        });
      }

      const bucket = weeklyMap.get(weekStart);
      const clientRecord = clientsMap.get(order.identity.clientKey);
      if (!clientRecord) continue;

      bucket.clients.add(order.identity.clientKey);
      bucket.orders += 1;
      bucket.revenue += Number(order.revenue || 0);

      if (clientRecord.firstOrderDate >= bucket.weekStart && clientRecord.firstOrderDate <= bucket.weekEnd) {
        bucket.newClients.add(order.identity.clientKey);
      } else {
        bucket.returningClients.add(order.identity.clientKey);
      }
    }

    const weekly = [...weeklyMap.values()]
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((item) => ({
        weekStart: item.weekStart,
        weekEnd: item.weekEnd,
        totalClients: item.clients.size,
        newClients: item.newClients.size,
        returningClients: item.returningClients.size,
        orders: item.orders,
        revenue: Math.round(item.revenue * 100) / 100,
      }));

    const dailyNewMap = new Map();
    for (const client of newClients) {
      dailyNewMap.set(client.firstOrderDate, (dailyNewMap.get(client.firstOrderDate) || 0) + 1);
    }

    const dailyNewClients = [...dailyNewMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, newClients: count }));

    const groups = [
      { id: "one", name: "1 заказ", count: clients.filter((client) => client.orders === 1).length },
      { id: "two-three", name: "2-3 заказа", count: clients.filter((client) => client.orders >= 2 && client.orders <= 3).length },
      { id: "four-six", name: "4-6 заказов", count: clients.filter((client) => client.orders >= 4 && client.orders <= 6).length },
      { id: "seven-ten", name: "7-10 заказов", count: clients.filter((client) => client.orders >= 7 && client.orders <= 10).length },
      { id: "ten-plus", name: ">10 заказов", count: clients.filter((client) => client.orders > 10).length },
    ].filter((group) => group.count > 0);

    const hasIdentityField = Boolean(resolvedIdentity.idField || resolvedIdentity.phoneField || resolvedIdentity.nameField);
    const warningMessage = !hasIdentityField
      ? "OLAP не вернул поля клиента (phone/card/name). Метрики клиентской базы ограничены."
      : unidentifiedOrders > 0
        ? `Часть заказов (${unidentifiedOrders}) не содержит идентификатор клиента и не учтена в клиентских метриках.`
        : null;

    return {
      configured: true,
      source: "iiko-olap",
      period: { dateFrom, dateTo },
      activeBase: clients.length,
      newClients: newClients.length,
      groups,
      weekly,
      dailyNewClients,
      topClients: [...clients].sort((a, b) => b.revenue - a.revenue).slice(0, 100),
      newClientsList: [...newClients].sort((a, b) => b.firstOrderDate.localeCompare(a.firstOrderDate)).slice(0, 200),
      summary: {
        activeBase: clients.length,
        newClients: newClients.length,
        returningClients: Math.max(clients.length - newClients.length, 0),
        repeatClients: repeatClients.length,
        repeatRate: clients.length > 0 ? Math.round((repeatClients.length / clients.length) * 10000) / 100 : 0,
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgOrdersPerClient: clients.length > 0 ? Math.round((totalOrders / clients.length) * 100) / 100 : 0,
        avgRevenuePerClient: clients.length > 0 ? Math.round((totalRevenue / clients.length) * 100) / 100 : 0,
        unidentifiedOrders,
      },
      identityFieldUsed: {
        idField: resolvedIdentity.idField,
        phoneField: resolvedIdentity.phoneField,
        nameField: resolvedIdentity.nameField,
      },
      selectedGroupFields: selectedFields,
      warningMessage,
    };
  }

  async getClients({ organizationId, dateFrom, dateTo }) {
    if (!organizationId || !dateFrom || !dateTo) {
      throw new Error("Обязательные параметры: organizationId, dateFrom, dateTo");
    }

    const start = this.toDateOnly(dateFrom);
    const end = this.toDateOnly(dateTo);
    if (!start || !end) {
      throw new Error("Неверный формат даты. Используйте YYYY-MM-DD");
    }

    const { rows, selectedFields, resolvedIdentity } = await this.fetchClientRows({
      organizationId,
      dateFrom: start,
      dateTo: end,
    });

    return this.buildClientsPayload(rows, {
      dateFrom: start,
      dateTo: end,
      selectedFields,
      resolvedIdentity,
    });
  }
}

module.exports = new ClientsService();
