// Pure-function библиотека: построение отчётов по доставке на основе нормализованных данных.
// ctx — объект с методами: roundMetric, toOrderEntities, isCourierDeliveryByServiceType, isDeliveryOrder,
//   normalizeChannelName, buildLateOrdersSummary, calculateLateMetrics, getStablePoint, calculateDiscountMetrics.

function resolveOrders(rows, timezone, ctx, options) {
  return Array.isArray(options?.preparedOrders) ? options.preparedOrders : ctx.toOrderEntities(rows, timezone);
}

function buildTechnicalReconciliation(orders, ctx, options) {
  if (!options?.enabled) return null;
  const ids = Array.from(new Set(orders.map((o) => String(o?.orderId || o?.orderNumber || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  const checksum = ids.reduce((hash, id) => {
    let next = hash;
    for (let i = 0; i < id.length; i++) next = (next * 31 + id.charCodeAt(i)) >>> 0;
    return next;
  }, 2166136261);
  const lateSummary = options?.lateSummary || ctx.buildLateOrdersSummary(orders);
  return {
    enabled: true,
    scope: String(options?.scope || "orders"),
    totalOrders: orders.length,
    uniqueOrderIds: ids.length,
    comparableOrders: Number(lateSummary?.comparableOrders || 0),
    excludedOrdersWithoutTimestamps: Number(lateSummary?.excludedOrders || 0),
    lateOrders: Number(lateSummary?.lateOrders || 0),
    orderIds: ids,
    sampleOrderIds: ids.slice(0, 30),
    orderIdsChecksum: checksum.toString(16),
  };
}

function buildRouteStats(rows = [], ctx, options = {}) {
  const routeMergeWindowMs = 5 * 60 * 1000;
  const groupedByCourier = new Map();
  const preparedOrders = Array.isArray(options?.preparedOrders) ? options.preparedOrders : null;

  if (preparedOrders) {
    for (const order of preparedOrders) {
      if (!ctx.isCourierDeliveryByServiceType({ OrderServiceType: order?.orderServiceType })) continue;
      const courierId = String(order?.courierId || "").trim();
      if (!courierId) continue;
      if (!groupedByCourier.has(courierId)) groupedByCourier.set(courierId, []);
      groupedByCourier.get(courierId).push(order);
    }
  } else {
    for (const row of rows) {
      if (!ctx.isDeliveryOrder(row)) continue;
      const courierId = String(row["Delivery.Courier.Id"] || "").trim();
      if (!courierId) continue;
      if (!groupedByCourier.has(courierId)) groupedByCourier.set(courierId, []);
      groupedByCourier.get(courierId).push(row);
    }
  }

  const routes = [];
  for (const [courierId, courierRows] of groupedByCourier.entries()) {
    const sorted = [...courierRows].sort((a, b) => {
      const aT = preparedOrders ? Number(a?.sentAt || a?.openAt || 0) : ctx.parseDateTime(a["Delivery.SendTime"]) || 0;
      const bT = preparedOrders ? Number(b?.sentAt || b?.openAt || 0) : ctx.parseDateTime(b["Delivery.SendTime"]) || 0;
      return aT - bT;
    });
    let currentRoute = null;
    for (const row of sorted) {
      const sendAt = preparedOrders
        ? Number(row?.sentAt || row?.openAt || 0)
        : ctx.parseDateTime(row["Delivery.SendTime"]) || ctx.parseDateTime(row.OpenTime) || 0;
      const closeAt = preparedOrders
        ? Number(row?.actualDeliveryAt || row?.deliveredAt || sendAt)
        : ctx.parseDateTime(row["Delivery.CloseTime"]) || sendAt;
      const orderId = preparedOrders ? String(row?.orderId || "").trim() : String(row["UniqOrderId.Id"] || "").trim();
      if (!currentRoute || sendAt > currentRoute.endAt + routeMergeWindowMs) {
        currentRoute = {
          courierId,
          courierName: preparedOrders ? row?.courierName || "Неизвестный курьер" : row["Delivery.Courier"] || "Неизвестный курьер",
          endAt: closeAt,
          orders: new Set(orderId ? [orderId] : []),
        };
        routes.push(currentRoute);
        continue;
      }
      currentRoute.endAt = Math.max(currentRoute.endAt, closeAt);
      if (orderId) currentRoute.orders.add(orderId);
    }
  }

  const totalRoutes = routes.length;
  const totalOrdersInRoutes = routes.reduce((sum, r) => sum + r.orders.size, 0);
  const routeCountBySize = new Map();
  routes.forEach((r) => routeCountBySize.set(r.orders.size, (routeCountBySize.get(r.orders.size) || 0) + 1));
  const distribution = [...routeCountBySize.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, count]) => ({
      label: `${size} заказ(ов) в маршруте`,
      ordersInRoute: size,
      count,
      routeCount: count,
      ordersCount: count * size,
      percent: totalRoutes > 0 ? ctx.roundMetric((count / totalRoutes) * 100) : 0,
    }));
  return { totalCouriers: groupedByCourier.size, totalRoutes, totalOrdersInRoutes, distribution };
}

function buildSlaReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const orders = resolveOrders(rows, timezone, ctx, options);
  const prepThreshold = 25;
  const shelfThreshold = 10;
  const routeThreshold = 40;
  const totalThreshold = 60;
  const toAverage = (values) => (values.length ? ctx.roundMetric(values.reduce((s, v) => s + v, 0) / values.length) : 0);
  const prepValues = [],
    shelfValues = [],
    routeValues = [],
    totalValues = [];
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, violations: 0 }));
  const violations = [];
  const lateSummary = ctx.buildLateOrdersSummary(orders);

  orders.forEach((order) => {
    if (order.prepMinutes != null) prepValues.push(order.prepMinutes);
    if (order.shelfMinutes != null) shelfValues.push(order.shelfMinutes);
    if (order.routeMinutes != null) routeValues.push(order.routeMinutes);
    if (order.totalMinutes != null) totalValues.push(order.totalMinutes);
    const ruleViolations = [];
    if (order.prepMinutes != null && order.prepMinutes > prepThreshold) ruleViolations.push("Приготовление");
    if (order.shelfMinutes != null && order.shelfMinutes > shelfThreshold) ruleViolations.push("Полка");
    if (order.routeMinutes != null && order.routeMinutes > routeThreshold) ruleViolations.push("В пути");
    if (order.totalMinutes != null && order.totalMinutes > totalThreshold) ruleViolations.push("Общее SLA");
    if (Number.isInteger(order.hour) && order.hour >= 0 && order.hour <= 23) {
      hourly[order.hour].orders += 1;
      if (ruleViolations.length) hourly[order.hour].violations += 1;
    }
    if (ruleViolations.length) {
      violations.push({
        orderId: order.orderId,
        orderNumber: order.displayOrderNumber,
        courierName: order.courierName,
        date: order.date,
        prepMinutes: ctx.roundMetric(order.prepMinutes),
        shelfMinutes: ctx.roundMetric(order.shelfMinutes),
        routeMinutes: ctx.roundMetric(order.routeMinutes),
        totalMinutes: ctx.roundMetric(order.totalMinutes),
        violations: ruleViolations,
      });
    }
  });

  const totalOrders = orders.length;
  const violationsCount = violations.length;
  const violationRate = totalOrders > 0 ? ctx.roundMetric((violationsCount / totalOrders) * 100) : 0;
  return {
    summary: {
      totalOrders,
      violationsCount,
      violationRate,
      onTimeRate: totalOrders > 0 ? ctx.roundMetric(100 - violationRate) : 0,
      lateOrders: lateSummary.lateOrders,
      lateRate: lateSummary.lateRate,
      comparableOrders: lateSummary.comparableOrders,
      excludedOrdersWithoutTimestamps: lateSummary.excludedOrders,
    },
    stageKpi: {
      prep: { avg: toAverage(prepValues), threshold: prepThreshold, count: prepValues.length },
      shelf: { avg: toAverage(shelfValues), threshold: shelfThreshold, count: shelfValues.length },
      route: { avg: toAverage(routeValues), threshold: routeThreshold, count: routeValues.length },
      total: { avg: toAverage(totalValues), threshold: totalThreshold, count: totalValues.length },
    },
    funnel: {
      created: totalOrders,
      cooked: orders.filter((o) => o.cookedAt || o.sentAt || o.deliveredAt || o.actualDeliveryAt).length,
      dispatched: orders.filter((o) => o.sentAt || o.deliveredAt || o.actualDeliveryAt).length,
      delivered: orders.filter((o) => o.deliveredAt || o.actualDeliveryAt).length,
    },
    hourly: hourly.map((item) => ({ ...item, violationRate: item.orders > 0 ? ctx.roundMetric((item.violations / item.orders) * 100) : 0 })),
    violations: violations.sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0)).slice(0, 100),
    reconciliation: buildTechnicalReconciliation(orders, ctx, {
      enabled: options?.reconciliationMode === true,
      scope: "all-orders-sla",
      lateSummary,
    }),
  };
}

function buildCourierKpiReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const orders = resolveOrders(rows, timezone, ctx, options).filter((o) =>
    ctx.isCourierDeliveryByServiceType({ OrderServiceType: o.orderServiceType }),
  );
  const couriers = new Map();

  for (const order of orders) {
    if (!couriers.has(order.courierId)) {
      couriers.set(order.courierId, {
        courierId: order.courierId,
        courierName: order.courierName,
        orders: 0,
        revenue: 0,
        lateOrders: 0,
        comparableOrders: 0,
        excludedOrdersWithoutTimestamps: 0,
        totalLateMinutes: 0,
        routeMinutes: [],
        totalMinutes: [],
        hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 })),
      });
    }
    const c = couriers.get(order.courierId);
    c.orders += 1;
    c.revenue += Number(order.revenue) || 0;
    if (order.totalMinutes != null) c.totalMinutes.push(order.totalMinutes);
    if (order.routeMinutes != null) c.routeMinutes.push(order.routeMinutes);
    const lm = ctx.calculateLateMetrics(order);
    if (lm.hasComparableTimes) {
      c.comparableOrders += 1;
      if (lm.isLate) {
        c.lateOrders += 1;
        c.totalLateMinutes += lm.lateMinutes;
      }
    } else {
      c.excludedOrdersWithoutTimestamps += 1;
    }
    if (Number.isInteger(order.hour) && order.hour >= 0 && order.hour <= 23) c.hours[order.hour].orders += 1;
  }

  const toAvg = (values) => (values.length ? ctx.roundMetric(values.reduce((s, v) => s + v, 0) / values.length) : null);
  const couriersList = [...couriers.values()].map((c) => {
    const vr = c.comparableOrders > 0 ? ctx.roundMetric((c.lateOrders / c.comparableOrders) * 100) : 0;
    return {
      courierId: c.courierId,
      courierName: c.courierName,
      orders: c.orders,
      revenue: ctx.roundMetric(c.revenue),
      avgRouteMinutes: toAvg(c.routeMinutes),
      avgTotalMinutes: toAvg(c.totalMinutes),
      lateOrders: c.lateOrders,
      comparableOrders: c.comparableOrders,
      excludedOrdersWithoutTimestamps: c.excludedOrdersWithoutTimestamps,
      avgLateMinutes: c.lateOrders > 0 ? ctx.roundMetric(c.totalLateMinutes / c.lateOrders) : 0,
      violationRate: vr,
      onTimeRate: c.comparableOrders > 0 ? ctx.roundMetric(100 - vr) : 0,
      hourly: c.hours,
    };
  });

  const totalOrders = couriersList.reduce((s, i) => s + i.orders, 0);
  const totalRevenue = couriersList.reduce((s, i) => s + i.revenue, 0);
  const weightedLate = couriersList.reduce((s, i) => s + i.lateOrders, 0);
  const comparableOrders = couriersList.reduce((s, i) => s + i.comparableOrders, 0);
  const excluded = couriersList.reduce((s, i) => s + i.excludedOrdersWithoutTimestamps, 0);

  return {
    summary: {
      totalCouriers: couriersList.length,
      totalOrders,
      totalRevenue: ctx.roundMetric(totalRevenue),
      avgOrdersPerCourier: couriersList.length > 0 ? ctx.roundMetric(totalOrders / couriersList.length) : 0,
      lateOrders: weightedLate,
      comparableOrders,
      excludedOrdersWithoutTimestamps: excluded,
      violationRate: comparableOrders > 0 ? ctx.roundMetric((weightedLate / comparableOrders) * 100) : 0,
    },
    couriers: couriersList.sort((a, b) => b.orders - a.orders),
    routeDistribution: buildRouteStats(rows, ctx, options).distribution,
    reconciliation: buildTechnicalReconciliation(orders, ctx, {
      enabled: options?.reconciliationMode === true,
      scope: "completed-courier-delivery-orders",
      lateSummary: { comparableOrders, excludedOrders: excluded, lateOrders: weightedLate },
    }),
  };
}

function buildDeliverySummaryReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const orders = resolveOrders(rows, timezone, ctx, options).filter((o) =>
    ctx.isDeliveryOrder({ OrderType: o.orderType, "Delivery.Courier.Id": o.courierId }),
  );
  const statusMap = new Map(),
    channelMap = new Map(),
    departmentMap = new Map(),
    dailyMap = new Map();
  let totalRevenue = 0;

  for (const order of orders) {
    const status = order.status || "Прочие";
    const channel = ctx.normalizeChannelName(order.orderType);
    const departmentId = order.departmentId || "unknown";
    const date = order.date || "unknown";
    const revenue = Number(order.revenue) || 0;
    totalRevenue += revenue;

    if (!statusMap.has(status)) statusMap.set(status, { status, orders: 0, revenue: 0 });
    statusMap.get(status).orders += 1;
    statusMap.get(status).revenue += revenue;

    if (!channelMap.has(channel)) channelMap.set(channel, { channel, orders: 0, revenue: 0 });
    channelMap.get(channel).orders += 1;
    channelMap.get(channel).revenue += revenue;

    if (!departmentMap.has(departmentId)) departmentMap.set(departmentId, { departmentId, orders: 0, revenue: 0 });
    departmentMap.get(departmentId).orders += 1;
    departmentMap.get(departmentId).revenue += revenue;

    if (!dailyMap.has(date)) dailyMap.set(date, { date, orders: 0, revenue: 0, delivered: 0, canceled: 0 });
    const daily = dailyMap.get(date);
    daily.orders += 1;
    daily.revenue += revenue;
    if (status === "Завершен") daily.delivered += 1;
    if (status === "Отменен") daily.canceled += 1;
  }

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === "Завершен").length;
  const canceledOrders = orders.filter((o) => o.status === "Отменен").length;

  return {
    summary: {
      totalOrders,
      totalRevenue: ctx.roundMetric(totalRevenue),
      avgCheck: totalOrders > 0 ? ctx.roundMetric(totalRevenue / totalOrders) : 0,
      deliveredOrders,
      canceledOrders,
      deliveredRate: totalOrders > 0 ? ctx.roundMetric((deliveredOrders / totalOrders) * 100) : 0,
    },
    statuses: [...statusMap.values()]
      .map((i) => ({ ...i, revenue: ctx.roundMetric(i.revenue), share: totalOrders > 0 ? ctx.roundMetric((i.orders / totalOrders) * 100) : 0 }))
      .sort((a, b) => b.orders - a.orders),
    channels: [...channelMap.values()]
      .map((i) => ({
        ...i,
        revenue: ctx.roundMetric(i.revenue),
        ordersShare: totalOrders > 0 ? ctx.roundMetric((i.orders / totalOrders) * 100) : 0,
        revenueShare: totalRevenue > 0 ? ctx.roundMetric((i.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    departments: [...departmentMap.values()]
      .map((i) => ({ ...i, revenue: ctx.roundMetric(i.revenue), avgCheck: i.orders > 0 ? ctx.roundMetric(i.revenue / i.orders) : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    dailyBreakdown: [...dailyMap.values()]
      .filter((i) => i.date !== "unknown")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((i) => ({ ...i, revenue: ctx.roundMetric(i.revenue) })),
  };
}

function buildDeliveryDelaysReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const orders = resolveOrders(rows, timezone, ctx, options).filter((o) =>
    ctx.isCourierDeliveryByServiceType({ OrderServiceType: o.orderServiceType }),
  );
  const delayedOrders = [];
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, delayed: 0, lateMinutes: 0 }));
  const couriersMap = new Map(),
    departmentsMap = new Map();
  const lateSummary = ctx.buildLateOrdersSummary(orders);

  for (const order of orders) {
    const lm = ctx.calculateLateMetrics(order);
    if (!lm.hasComparableTimes) continue;
    const expectedDeliveryAt = Number(order.promisedAt || 0);
    const actualDeliveryAt = Number(order.actualDeliveryAt || 0);
    const promisedMinutes = order.openAt && expectedDeliveryAt ? (expectedDeliveryAt - Number(order.openAt)) / (1000 * 60) : 0;
    const actualMinutes = Number(order.totalMinutes || 0);
    const lateMinutes = lm.lateMinutes;
    const isDelayed = lateMinutes > 0;
    const hour = Number.isInteger(order.hour) ? order.hour : null;
    const departmentId = order.departmentId || "unknown";

    if (hour != null && hour >= 0 && hour <= 23) {
      hourly[hour].total += 1;
      if (isDelayed) {
        hourly[hour].delayed += 1;
        hourly[hour].lateMinutes += lateMinutes;
      }
    }

    if (!couriersMap.has(order.courierId))
      couriersMap.set(order.courierId, { courierId: order.courierId, courierName: order.courierName, total: 0, delayed: 0, lateMinutes: 0 });
    couriersMap.get(order.courierId).total += 1;
    if (isDelayed) {
      couriersMap.get(order.courierId).delayed += 1;
      couriersMap.get(order.courierId).lateMinutes += lateMinutes;
    }

    if (!departmentsMap.has(departmentId)) departmentsMap.set(departmentId, { departmentId, total: 0, delayed: 0, lateMinutes: 0 });
    departmentsMap.get(departmentId).total += 1;
    if (isDelayed) {
      departmentsMap.get(departmentId).delayed += 1;
      departmentsMap.get(departmentId).lateMinutes += lateMinutes;
    }

    if (isDelayed) {
      delayedOrders.push({
        orderId: order.orderId,
        orderNumber: order.displayOrderNumber,
        date: order.date,
        courierId: order.courierId,
        courierName: order.courierName,
        departmentId,
        promisedMinutes: ctx.roundMetric(promisedMinutes),
        actualMinutes: ctx.roundMetric(actualMinutes),
        lateMinutes: ctx.roundMetric(lateMinutes),
        revenue: ctx.roundMetric(order.revenue),
      });
    }
  }

  return {
    summary: {
      totalOrders: orders.length,
      comparableOrders: lateSummary.comparableOrders,
      excludedOrdersWithoutTimestamps: lateSummary.excludedOrders,
      delayedOrders: lateSummary.lateOrders,
      onTimeOrders: lateSummary.onTimeOrders,
      delayRate: lateSummary.lateRate,
      totalLateMinutes: lateSummary.totalLateMinutes,
      avgLateMinutes: lateSummary.avgLateMinutes,
    },
    hourly: hourly.map((i) => ({
      ...i,
      lateMinutes: ctx.roundMetric(i.lateMinutes),
      delayRate: i.total > 0 ? ctx.roundMetric((i.delayed / i.total) * 100) : 0,
      avgLateMinutes: i.delayed > 0 ? ctx.roundMetric(i.lateMinutes / i.delayed) : 0,
    })),
    couriers: [...couriersMap.values()]
      .map((i) => ({ ...i, lateMinutes: ctx.roundMetric(i.lateMinutes), delayRate: i.total > 0 ? ctx.roundMetric((i.delayed / i.total) * 100) : 0 }))
      .sort((a, b) => b.delayRate - a.delayRate || b.delayed - a.delayed),
    departments: [...departmentsMap.values()]
      .map((i) => ({ ...i, lateMinutes: ctx.roundMetric(i.lateMinutes), delayRate: i.total > 0 ? ctx.roundMetric((i.delayed / i.total) * 100) : 0 }))
      .sort((a, b) => b.delayRate - a.delayRate || b.delayed - a.delayed),
    delayedOrders: delayedOrders.sort((a, b) => b.lateMinutes - a.lateMinutes).slice(0, 100),
    reconciliation: buildTechnicalReconciliation(orders, ctx, {
      enabled: options?.reconciliationMode === true,
      scope: "completed-courier-delivery-orders",
      lateSummary,
    }),
  };
}

function buildCourierMapReport(rows = [], dateTo = null, timezone = "Europe/Moscow", ctx, options = {}) {
  const orders = resolveOrders(rows, timezone, ctx, options).filter((o) =>
    ctx.isDeliveryOrder({ OrderType: o.orderType, "Delivery.Courier.Id": o.courierId }),
  );
  const couriersMap = new Map();
  const timeline = [];
  const toTimestamp = (v) => (v ? new Date(`${v}T23:59:59`).getTime() : Date.now());
  const pivotTimestamp = toTimestamp(dateTo);

  for (const order of orders) {
    if (!couriersMap.has(order.courierId)) {
      const pt = ctx.getStablePoint(order.courierId || order.courierName);
      couriersMap.set(order.courierId, {
        courierId: order.courierId,
        courierName: order.courierName,
        orders: 0,
        revenue: 0,
        lastTimestamp: 0,
        x: pt.x,
        y: pt.y,
      });
    }
    const c = couriersMap.get(order.courierId);
    const lastTs = Math.max(order.deliveredAt || 0, order.sentAt || 0, order.openAt || 0);
    c.orders += 1;
    c.revenue += Number(order.revenue) || 0;
    c.lastTimestamp = Math.max(c.lastTimestamp, lastTs);
    const pt = ctx.getStablePoint(`${order.orderId}:${order.date}`);
    timeline.push({
      orderId: order.orderId,
      orderNumber: order.displayOrderNumber,
      courierId: order.courierId,
      courierName: order.courierName,
      status: order.status,
      revenue: ctx.roundMetric(order.revenue),
      date: order.date,
      x: pt.x,
      y: pt.y,
    });
  }

  const couriers = [...couriersMap.values()]
    .map((c) => {
      const diff = c.lastTimestamp > 0 ? (pivotTimestamp - c.lastTimestamp) / (1000 * 60) : Infinity;
      return {
        ...c,
        revenue: ctx.roundMetric(c.revenue),
        isActive: Number.isFinite(diff) ? diff <= 90 : false,
        lastActivityMinutesAgo: Number.isFinite(diff) ? ctx.roundMetric(Math.max(0, diff)) : null,
      };
    })
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.orders - a.orders);

  return {
    summary: {
      totalCouriers: couriers.length,
      activeCouriers: couriers.filter((c) => c.isActive).length,
      totalOrders: orders.length,
      activeOrders: timeline.filter((i) => i.status === "В пути").length,
    },
    couriers,
    orders: timeline.slice(0, 300),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeZoneValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveFeatureZoneAliases(feature = {}) {
  const props = feature?.properties || {};
  const aliases = new Set();
  for (const c of [props.id, props.zoneId, props.zone_id, props.externalId, props.code, props.name, props.zone, props.zoneName, props.title]) {
    const n = normalizeZoneValue(c);
    if (n) aliases.add(n);
  }
  return aliases;
}

function resolveFeatureZoneName(feature = {}, index = 0) {
  const props = feature?.properties || {};
  for (const c of [props.zoneName, props.name, props.zone, props.title, props.label, props.description, props.desc, props.fullName]) {
    const v = String(c || "").trim();
    if (v) return v;
  }
  const lc = Object.entries(props).reduce((acc, [k, v]) => {
    acc[
      String(k || "")
        .trim()
        .toLowerCase()
    ] = v;
    return acc;
  }, {});
  for (const key of ["zonename", "zone_name", "zone-name", "name_ru", "zone_title", "название", "названиезоны", "зона"]) {
    const v = String(lc[key] || "").trim();
    if (v) return v;
  }
  return `Зона ${index + 1}`;
}

function normalizeRing(ring = []) {
  if (!Array.isArray(ring)) return [];
  return ring
    .map((p) => {
      if (!Array.isArray(p) || p.length < 2) return null;
      const lng = Number(p[0]),
        lat = Number(p[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
}

function getFeaturePolygons(feature = {}) {
  const geo = feature?.geometry;
  if (!geo || !Array.isArray(geo.coordinates)) return [];
  if (geo.type === "Polygon") {
    const poly = geo.coordinates.map(normalizeRing).filter((r) => r.length >= 3);
    return poly.length > 0 ? [poly] : [];
  }
  if (geo.type === "MultiPolygon") {
    return geo.coordinates.map((poly) => poly.map(normalizeRing).filter((r) => r.length >= 3)).filter((poly) => poly.length > 0);
  }
  return [];
}

function isPointInRing(lng, lat, ring = []) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function isPointInPolygonWithHoles(lng, lat, polygon = []) {
  if (!Array.isArray(polygon) || !polygon.length) return false;
  if (!isPointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (isPointInRing(lng, lat, polygon[i])) return false;
  return true;
}

function isPointInFeature(lng, lat, feature = {}) {
  return getFeaturePolygons(feature).some((poly) => isPointInPolygonWithHoles(lng, lat, poly));
}

function buildDeliveryHeatmapReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const weekdayLabels = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
  const statusesFilter = new Set((Array.isArray(options?.statuses) ? options.statuses : []).map(normalizeZoneValue).filter(Boolean));
  const baseOrders = Array.isArray(options?.preparedOrders) ? options.preparedOrders : ctx.toOrderEntities(rows, timezone);
  const orders = baseOrders
    .filter((o) => ctx.isCourierDeliveryByServiceType({ OrderServiceType: o.orderServiceType }))
    .filter((o) => statusesFilter.size === 0 || statusesFilter.has(normalizeZoneValue(o.rawStatus || o.status)));

  const lateSummary = ctx.buildLateOrdersSummary(orders);
  const totalRevenue = ctx.roundMetric(orders.reduce((s, o) => s + Number(o?.revenue || 0), 0));
  const zonesGeoJson = options?.zonesGeoJson?.type === "FeatureCollection" ? options.zonesGeoJson : null;

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, delayed: 0, totalLateMinutes: 0 }));
  const weekdayBuckets = Array.from({ length: 7 }, (_, idx) => ({
    weekdayIndex: idx + 1,
    weekday: weekdayLabels[idx + 1],
    totalOrders: 0,
    delayed: 0,
    totalLateMinutes: 0,
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, delayed: 0, totalLateMinutes: 0 })),
  }));

  for (const order of orders) {
    const hour = Number.isInteger(order.hour) && order.hour >= 0 && order.hour <= 23 ? order.hour : null;
    const wi = Number(order.weekdayIndex);
    if (hour == null || !wi || wi < 1 || wi > 7) continue;
    const lm = ctx.calculateLateMetrics(order);
    const isDelayed = lm.isLate;
    hourly[hour].orders += 1;
    if (isDelayed) {
      hourly[hour].delayed += 1;
      hourly[hour].totalLateMinutes += lm.lateMinutes;
    }
    const wb = weekdayBuckets[wi - 1];
    wb.totalOrders += 1;
    if (isDelayed) {
      wb.delayed += 1;
      wb.totalLateMinutes += lm.lateMinutes;
    }
    wb.hours[hour].orders += 1;
    if (isDelayed) {
      wb.hours[hour].delayed += 1;
      wb.hours[hour].totalLateMinutes += lm.lateMinutes;
    }
  }

  const nb = (b) => ({
    hour: b.hour,
    orders: b.orders,
    delayed: b.delayed,
    delayRate: b.orders > 0 ? ctx.roundMetric((b.delayed / b.orders) * 100) : 0,
    avgLateMinutes: b.delayed > 0 ? ctx.roundMetric(b.totalLateMinutes / b.delayed) : 0,
  });
  const normalizedHourly = hourly.map(nb);
  const peakHour = normalizedHourly.reduce((best, i) => (i.orders > best.orders ? i : best), {
    hour: 0,
    orders: 0,
    delayed: 0,
    delayRate: 0,
    avgLateMinutes: 0,
  });
  const weekdayHeatmap = weekdayBuckets.map((wb) => ({
    weekdayIndex: wb.weekdayIndex,
    weekday: wb.weekday,
    totalOrders: wb.totalOrders,
    delayed: wb.delayed,
    delayRate: wb.totalOrders > 0 ? ctx.roundMetric((wb.delayed / wb.totalOrders) * 100) : 0,
    avgLateMinutes: wb.delayed > 0 ? ctx.roundMetric(wb.totalLateMinutes / wb.delayed) : 0,
    hours: wb.hours.map(nb),
  }));
  const topRiskHours = weekdayHeatmap
    .flatMap((wd) =>
      wd.hours.map((h) => ({
        weekdayIndex: wd.weekdayIndex,
        weekday: wd.weekday,
        hour: h.hour,
        orders: h.orders,
        delayed: h.delayed,
        delayRate: h.delayRate,
        avgLateMinutes: h.avgLateMinutes,
      })),
    )
    .filter((i) => i.orders > 0)
    .sort((a, b) => b.delayRate - a.delayRate || b.orders - a.orders)
    .slice(0, 20);

  let zones = null,
    zoneStats = [],
    matchedByCoordinates = 0,
    matchedByZoneAlias = 0,
    unassignedOrders = 0;

  if (zonesGeoJson?.features?.length) {
    const zoneOrderStats = new Map();
    const featureIndexByAlias = new Map();
    const featuresPrepared = zonesGeoJson.features.map((feature, index) => {
      const aliases = resolveFeatureZoneAliases(feature);
      if (!aliases.size) aliases.add(`zone-index-${index}`);
      for (const alias of aliases) if (!featureIndexByAlias.has(alias)) featureIndexByAlias.set(alias, index);
      return { index, feature, aliases };
    });
    const getZoneStat = (zi) => {
      if (!zoneOrderStats.has(zi)) zoneOrderStats.set(zi, { orders: 0, revenue: 0, totalMinutesSum: 0, totalMinutesCount: 0, delayedOrders: 0 });
      return zoneOrderStats.get(zi);
    };

    for (const order of orders) {
      let mi = null;
      const lat = Number(order?.deliveryPoint?.lat),
        lng = Number(order?.deliveryPoint?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const mf = featuresPrepared.find((fp) => isPointInFeature(lng, lat, fp.feature));
        if (mf) {
          mi = mf.index;
          matchedByCoordinates += 1;
        }
      }
      if (mi == null) {
        const alias = normalizeZoneValue(order.deliveryZoneId || order.deliveryZoneName);
        if (alias && featureIndexByAlias.has(alias)) {
          mi = featureIndexByAlias.get(alias);
          matchedByZoneAlias += 1;
        }
      }
      if (mi == null) {
        unassignedOrders += 1;
        continue;
      }
      const stat = getZoneStat(mi);
      stat.orders += 1;
      stat.revenue += Number(order.revenue || 0);
      if (Number.isFinite(Number(order.totalMinutes))) {
        stat.totalMinutesSum += Number(order.totalMinutes || 0);
        stat.totalMinutesCount += 1;
      }
      if (ctx.calculateLateMetrics(order).isLate) stat.delayedOrders += 1;
    }

    const maxOrders = Math.max(...Array.from(zoneOrderStats.values()).map((i) => Number(i.orders || 0)), 1);
    zones = {
      type: "FeatureCollection",
      features: zonesGeoJson.features.map((feature, index) => {
        const merged = zoneOrderStats.get(index) || null;
        const zoneName = resolveFeatureZoneName(feature, index);
        const ordersCount = Number(merged?.orders || 0);
        const revenue = ctx.roundMetric(merged?.revenue || 0);
        const avgReceiveMinutes = merged?.totalMinutesCount > 0 ? ctx.roundMetric(merged.totalMinutesSum / merged.totalMinutesCount) : 0;
        const delayed = Number(merged?.delayedOrders || 0);
        const lateRate = ordersCount > 0 ? ctx.roundMetric((delayed / ordersCount) * 100) : 0;
        return {
          ...feature,
          properties: {
            ...(feature.properties || {}),
            zoneName,
            name: String(feature?.properties?.name || zoneName),
            heatIntensity: maxOrders > 0 ? Math.max(0, Math.min(1, Math.sqrt(ordersCount / maxOrders))) : 0,
            orders: ordersCount,
            revenue,
            avgReceiveMinutes,
            delayedOrders: delayed,
            lateRate,
          },
        };
      }),
    };
    zoneStats = zones.features
      .map((f) => ({
        zoneName: resolveFeatureZoneName(f),
        orders: Number(f?.properties?.orders || 0),
        revenue: Number(f?.properties?.revenue || 0),
        avgReceiveMinutes: Number(f?.properties?.avgReceiveMinutes || 0),
        delayedOrders: Number(f?.properties?.delayedOrders || 0),
        lateRate: Number(f?.properties?.lateRate || 0),
        heatIntensity: Number(f?.properties?.heatIntensity || 0),
      }))
      .sort((a, b) => b.orders - a.orders);
  }

  return {
    summary: {
      totalOrders: orders.length,
      comparableOrders: lateSummary.comparableOrders,
      excludedOrdersWithoutTimestamps: lateSummary.excludedOrders,
      totalRevenue,
      delayedOrders: lateSummary.lateOrders,
      onTimeOrders: lateSummary.onTimeOrders,
      delayRate: lateSummary.lateRate,
      peakHour,
      matchedByCoordinates,
      matchedByZoneAlias,
      unassignedOrders,
    },
    zonesConfigured: Boolean(zonesGeoJson),
    zonesVersion: Number(options?.zonesVersion || 0),
    geojson: zones,
    zones,
    zoneStats,
    hourly: normalizedHourly,
    weekdayHeatmap,
    topRiskHours,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildRouteStats,
  buildSlaReport,
  buildCourierKpiReport,
  buildDeliverySummaryReport,
  buildDeliveryDelaysReport,
  buildCourierMapReport,
  buildDeliveryHeatmapReport,
};
