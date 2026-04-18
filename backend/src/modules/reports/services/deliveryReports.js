function buildRouteStats(rows = [], ctx) {
  const routeMergeWindowMs = 5 * 60 * 1000;
  const groupedByCourier = new Map();

  for (const row of rows) {
    if (!ctx.isDeliveryOrder(row)) continue;
    const courierId = String(row["Delivery.Courier.Id"] || "").trim();
    if (!courierId) continue;
    if (!groupedByCourier.has(courierId)) groupedByCourier.set(courierId, []);
    groupedByCourier.get(courierId).push(row);
  }

  const routes = [];

  for (const [courierId, courierRows] of groupedByCourier.entries()) {
    const sortedRows = [...courierRows].sort((left, right) => {
      return (ctx.parseDateTime(left["Delivery.SendTime"]) || 0) - (ctx.parseDateTime(right["Delivery.SendTime"]) || 0);
    });

    let currentRoute = null;

    for (const row of sortedRows) {
      const sendAt = ctx.parseDateTime(row["Delivery.SendTime"]) || ctx.parseDateTime(row.OpenTime) || 0;
      const closeAt = ctx.parseDateTime(row["Delivery.CloseTime"]) || sendAt;
      const orderId = String(row["UniqOrderId.Id"] || "").trim();

      if (!currentRoute || sendAt > currentRoute.endAt + routeMergeWindowMs) {
        currentRoute = {
          courierId,
          courierName: row["Delivery.Courier"] || "Неизвестный курьер",
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
  const totalOrdersInRoutes = routes.reduce((sum, route) => sum + route.orders.size, 0);
  const routeCountBySize = new Map();
  routes.forEach((route) => {
    const size = route.orders.size;
    routeCountBySize.set(size, (routeCountBySize.get(size) || 0) + 1);
  });

  const distribution = [...routeCountBySize.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, routeCount]) => ({
      label: `${size} заказ(ов) в маршруте`,
      ordersInRoute: size,
      count: routeCount,
      routeCount,
      ordersCount: routeCount * size,
      percent: totalRoutes > 0 ? ctx.roundMetric((routeCount / totalRoutes) * 100) : 0,
    }));

  return {
    totalCouriers: groupedByCourier.size,
    totalRoutes,
    totalOrdersInRoutes,
    distribution,
  };
}

function buildSlaReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const orders = ctx
    .toOrderEntities(rows, timezone)
    .filter((order) => ctx.isDeliveryOrder({ OrderType: order.orderType, "Delivery.Courier.Id": order.courierId }));
  const prepThreshold = 25;
  const shelfThreshold = 10;
  const routeThreshold = 40;
  const totalThreshold = 60;

  const toAverage = (values) => (values.length ? ctx.roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

  const prepValues = [];
  const shelfValues = [];
  const routeValues = [];
  const totalValues = [];
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, violations: 0 }));
  const violations = [];

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
    },
    stageKpi: {
      prep: { avg: toAverage(prepValues), threshold: prepThreshold },
      shelf: { avg: toAverage(shelfValues), threshold: shelfThreshold },
      route: { avg: toAverage(routeValues), threshold: routeThreshold },
      total: { avg: toAverage(totalValues), threshold: totalThreshold },
    },
    funnel: {
      created: totalOrders,
      cooked: orders.filter((order) => order.cookedAt).length,
      dispatched: orders.filter((order) => order.sentAt).length,
      delivered: orders.filter((order) => order.deliveredAt).length,
    },
    hourly: hourly.map((item) => ({
      ...item,
      violationRate: item.orders > 0 ? ctx.roundMetric((item.violations / item.orders) * 100) : 0,
    })),
    violations: violations.sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0)).slice(0, 100),
  };
}

function buildCourierKpiReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const orders = ctx
    .toOrderEntities(rows, timezone)
    .filter((order) => ctx.isDeliveryOrder({ OrderType: order.orderType, "Delivery.Courier.Id": order.courierId }));
  const totalThreshold = 60;
  const couriers = new Map();

  for (const order of orders) {
    if (!couriers.has(order.courierId)) {
      couriers.set(order.courierId, {
        courierId: order.courierId,
        courierName: order.courierName,
        orders: 0,
        revenue: 0,
        lateOrders: 0,
        routeMinutes: [],
        totalMinutes: [],
        hours: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 })),
      });
    }

    const courier = couriers.get(order.courierId);
    courier.orders += 1;
    courier.revenue += Number(order.revenue) || 0;
    if (order.totalMinutes != null) courier.totalMinutes.push(order.totalMinutes);
    if (order.routeMinutes != null) courier.routeMinutes.push(order.routeMinutes);
    if (order.totalMinutes != null && order.totalMinutes > totalThreshold) courier.lateOrders += 1;
    if (Number.isInteger(order.hour) && order.hour >= 0 && order.hour <= 23) courier.hours[order.hour].orders += 1;
  }

  const toAverage = (values) => (values.length ? ctx.roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

  const couriersList = [...couriers.values()].map((courier) => {
    const violationRate = courier.orders > 0 ? ctx.roundMetric((courier.lateOrders / courier.orders) * 100) : 0;
    return {
      courierId: courier.courierId,
      courierName: courier.courierName,
      orders: courier.orders,
      revenue: ctx.roundMetric(courier.revenue),
      avgRouteMinutes: toAverage(courier.routeMinutes),
      avgTotalMinutes: toAverage(courier.totalMinutes),
      lateOrders: courier.lateOrders,
      violationRate,
      onTimeRate: courier.orders > 0 ? ctx.roundMetric(100 - violationRate) : 0,
      hourly: courier.hours,
    };
  });

  const totalOrders = couriersList.reduce((sum, item) => sum + item.orders, 0);
  const totalRevenue = couriersList.reduce((sum, item) => sum + item.revenue, 0);
  const weightedLate = couriersList.reduce((sum, item) => sum + item.lateOrders, 0);

  return {
    summary: {
      totalCouriers: couriersList.length,
      totalOrders,
      totalRevenue: ctx.roundMetric(totalRevenue),
      avgOrdersPerCourier: couriersList.length > 0 ? ctx.roundMetric(totalOrders / couriersList.length) : 0,
      lateOrders: weightedLate,
      violationRate: totalOrders > 0 ? ctx.roundMetric((weightedLate / totalOrders) * 100) : 0,
    },
    couriers: couriersList.sort((a, b) => b.orders - a.orders),
    routeDistribution: buildRouteStats(rows, ctx).distribution,
  };
}

function buildMarketingSourcesReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const orders = ctx.toOrderEntities(rows, timezone);
  const channelMap = new Map();
  const dailyMap = new Map();

  for (const order of orders) {
    const channel = ctx.normalizeChannelName(order.orderType);
    const date = order.date;
    if (!date) continue;

    if (!channelMap.has(channel)) channelMap.set(channel, { source: channel, orders: 0, revenue: 0 });
    const sourceItem = channelMap.get(channel);
    sourceItem.orders += 1;
    sourceItem.revenue += Number(order.revenue) || 0;

    if (!dailyMap.has(date)) dailyMap.set(date, { date, orders: 0, revenue: 0, channels: {} });
    const daily = dailyMap.get(date);
    daily.orders += 1;
    daily.revenue += Number(order.revenue) || 0;
    if (!daily.channels[channel]) daily.channels[channel] = { orders: 0, revenue: 0 };
    daily.channels[channel].orders += 1;
    daily.channels[channel].revenue += Number(order.revenue) || 0;
  }

  const sources = [...channelMap.values()]
    .map((item) => ({
      ...item,
      revenue: ctx.roundMetric(item.revenue),
      avgCheck: item.orders > 0 ? ctx.roundMetric(item.revenue / item.orders) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalOrders = sources.reduce((sum, item) => sum + item.orders, 0);
  const totalRevenue = sources.reduce((sum, item) => sum + item.revenue, 0);

  const sourcesWithShare = sources.map((item) => ({
    ...item,
    ordersShare: totalOrders > 0 ? ctx.roundMetric((item.orders / totalOrders) * 100) : 0,
    revenueShare: totalRevenue > 0 ? ctx.roundMetric((item.revenue / totalRevenue) * 100) : 0,
  }));

  const dailyBreakdown = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ ...item, revenue: ctx.roundMetric(item.revenue) }));

  return {
    summary: {
      totalOrders,
      totalRevenue: ctx.roundMetric(totalRevenue),
      totalSources: sourcesWithShare.length,
      avgCheck: totalOrders > 0 ? ctx.roundMetric(totalRevenue / totalOrders) : 0,
    },
    sources: sourcesWithShare,
    dailyBreakdown,
    revenueByChannel: sourcesWithShare.reduce((acc, item) => {
      acc[item.source] = { revenue: item.revenue, orders: item.orders, avgCheck: item.avgCheck };
      return acc;
    }, {}),
  };
}

function buildDeliverySummaryReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const orders = ctx
    .toOrderEntities(rows, timezone)
    .filter((order) => ctx.isDeliveryOrder({ OrderType: order.orderType, "Delivery.Courier.Id": order.courierId }));
  const statusMap = new Map();
  const channelMap = new Map();
  const departmentMap = new Map();
  const dailyMap = new Map();

  let totalRevenue = 0;
  for (const order of orders) {
    const status = order.status || "Создан";
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

    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, orders: 0, revenue: 0, delivered: 0, canceled: 0 });
    }
    const daily = dailyMap.get(date);
    daily.orders += 1;
    daily.revenue += revenue;
    if (status === "Доставлен") daily.delivered += 1;
    if (status === "Отменен") daily.canceled += 1;
  }

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((order) => order.status === "Доставлен").length;
  const canceledOrders = orders.filter((order) => order.status === "Отменен").length;

  const statuses = [...statusMap.values()]
    .map((item) => ({
      ...item,
      revenue: ctx.roundMetric(item.revenue),
      share: totalOrders > 0 ? ctx.roundMetric((item.orders / totalOrders) * 100) : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const channels = [...channelMap.values()]
    .map((item) => ({
      ...item,
      revenue: ctx.roundMetric(item.revenue),
      ordersShare: totalOrders > 0 ? ctx.roundMetric((item.orders / totalOrders) * 100) : 0,
      revenueShare: totalRevenue > 0 ? ctx.roundMetric((item.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const departments = [...departmentMap.values()]
    .map((item) => ({
      ...item,
      revenue: ctx.roundMetric(item.revenue),
      avgCheck: item.orders > 0 ? ctx.roundMetric(item.revenue / item.orders) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const dailyBreakdown = [...dailyMap.values()]
    .filter((item) => item.date !== "unknown")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      revenue: ctx.roundMetric(item.revenue),
    }));

  return {
    summary: {
      totalOrders,
      totalRevenue: ctx.roundMetric(totalRevenue),
      avgCheck: totalOrders > 0 ? ctx.roundMetric(totalRevenue / totalOrders) : 0,
      deliveredOrders,
      canceledOrders,
      deliveredRate: totalOrders > 0 ? ctx.roundMetric((deliveredOrders / totalOrders) * 100) : 0,
    },
    statuses,
    channels,
    departments,
    dailyBreakdown,
  };
}

function buildDeliveryDelaysReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const orders = ctx
    .toOrderEntities(rows, timezone)
    .filter((order) => ctx.isCourierDeliveryByServiceType({ OrderServiceType: order.orderServiceType }));
  const delayedOrders = [];
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, delayed: 0, lateMinutes: 0 }));
  const couriersMap = new Map();
  const departmentsMap = new Map();

  for (const order of orders) {
    const expectedDeliveryAt = order.promisedAt;
    const actualDeliveryAt = order.actualDeliveryAt;
    if (!expectedDeliveryAt || !actualDeliveryAt) continue;

    const promisedMinutes = order.openAt && expectedDeliveryAt ? (Number(expectedDeliveryAt) - Number(order.openAt)) / (1000 * 60) : 0;
    const actualMinutes = Number(order.totalMinutes || 0);

    const lateMinutes = Math.max(0, (Number(actualDeliveryAt) - Number(expectedDeliveryAt)) / (1000 * 60));

    const isDelayed = lateMinutes > 0;
    const hour = Number.isInteger(order.hour) ? order.hour : null;
    const departmentId = order.departmentId || "unknown";

    if (hour != null && hour >= 0 && hour <= 23) {
      const bucket = hourly[hour];
      bucket.total += 1;
      if (isDelayed) {
        bucket.delayed += 1;
        bucket.lateMinutes += lateMinutes;
      }
    }

    if (!couriersMap.has(order.courierId)) {
      couriersMap.set(order.courierId, {
        courierId: order.courierId,
        courierName: order.courierName,
        total: 0,
        delayed: 0,
        lateMinutes: 0,
      });
    }
    const courier = couriersMap.get(order.courierId);
    courier.total += 1;
    if (isDelayed) {
      courier.delayed += 1;
      courier.lateMinutes += lateMinutes;
    }

    if (!departmentsMap.has(departmentId)) {
      departmentsMap.set(departmentId, { departmentId, total: 0, delayed: 0, lateMinutes: 0 });
    }
    const department = departmentsMap.get(departmentId);
    department.total += 1;
    if (isDelayed) {
      department.delayed += 1;
      department.lateMinutes += lateMinutes;
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

  const totalOrders = orders.length;
  const delayedCount = delayedOrders.length;
  const totalLateMinutes = delayedOrders.reduce((sum, item) => sum + item.lateMinutes, 0);

  const couriers = [...couriersMap.values()]
    .map((item) => ({
      ...item,
      lateMinutes: ctx.roundMetric(item.lateMinutes),
      delayRate: item.total > 0 ? ctx.roundMetric((item.delayed / item.total) * 100) : 0,
    }))
    .sort((a, b) => b.delayRate - a.delayRate || b.delayed - a.delayed);

  const departments = [...departmentsMap.values()]
    .map((item) => ({
      ...item,
      lateMinutes: ctx.roundMetric(item.lateMinutes),
      delayRate: item.total > 0 ? ctx.roundMetric((item.delayed / item.total) * 100) : 0,
    }))
    .sort((a, b) => b.delayRate - a.delayRate || b.delayed - a.delayed);

  return {
    summary: {
      totalOrders,
      delayedOrders: delayedCount,
      onTimeOrders: totalOrders - delayedCount,
      delayRate: totalOrders > 0 ? ctx.roundMetric((delayedCount / totalOrders) * 100) : 0,
      totalLateMinutes: ctx.roundMetric(totalLateMinutes),
      avgLateMinutes: delayedCount > 0 ? ctx.roundMetric(totalLateMinutes / delayedCount) : 0,
    },
    hourly: hourly.map((item) => ({
      ...item,
      lateMinutes: ctx.roundMetric(item.lateMinutes),
      delayRate: item.total > 0 ? ctx.roundMetric((item.delayed / item.total) * 100) : 0,
      avgLateMinutes: item.delayed > 0 ? ctx.roundMetric(item.lateMinutes / item.delayed) : 0,
    })),
    couriers,
    departments,
    delayedOrders: delayedOrders.sort((a, b) => b.lateMinutes - a.lateMinutes).slice(0, 100),
  };
}

function buildCourierMapReport(rows = [], dateTo = null, timezone = "Europe/Moscow", ctx) {
  const orders = ctx
    .toOrderEntities(rows, timezone)
    .filter((order) => ctx.isDeliveryOrder({ OrderType: order.orderType, "Delivery.Courier.Id": order.courierId }));
  const couriersMap = new Map();
  const timeline = [];
  const toTimestamp = (value) => (value ? new Date(`${value}T23:59:59`).getTime() : Date.now());
  const pivotTimestamp = toTimestamp(dateTo);

  for (const order of orders) {
    if (!couriersMap.has(order.courierId)) {
      const point = ctx.getStablePoint(order.courierId || order.courierName);
      couriersMap.set(order.courierId, {
        courierId: order.courierId,
        courierName: order.courierName,
        orders: 0,
        revenue: 0,
        lastTimestamp: 0,
        x: point.x,
        y: point.y,
      });
    }

    const courier = couriersMap.get(order.courierId);
    const lastTimestamp = Math.max(order.deliveredAt || 0, order.sentAt || 0, order.openAt || 0);
    courier.orders += 1;
    courier.revenue += Number(order.revenue) || 0;
    courier.lastTimestamp = Math.max(courier.lastTimestamp, lastTimestamp);

    const point = ctx.getStablePoint(`${order.orderId}:${order.date}`);
    timeline.push({
      orderId: order.orderId,
      orderNumber: order.displayOrderNumber,
      courierId: order.courierId,
      courierName: order.courierName,
      status: order.status,
      revenue: ctx.roundMetric(order.revenue),
      date: order.date,
      x: point.x,
      y: point.y,
    });
  }

  const couriers = [...couriersMap.values()]
    .map((courier) => {
      const diffMinutes = courier.lastTimestamp > 0 ? (pivotTimestamp - courier.lastTimestamp) / (1000 * 60) : Infinity;
      return {
        ...courier,
        revenue: ctx.roundMetric(courier.revenue),
        isActive: Number.isFinite(diffMinutes) ? diffMinutes <= 90 : false,
        lastActivityMinutesAgo: Number.isFinite(diffMinutes) ? ctx.roundMetric(Math.max(0, diffMinutes)) : null,
      };
    })
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.orders - a.orders);

  const activeCouriers = couriers.filter((courier) => courier.isActive).length;
  const activeOrders = timeline.filter((item) => item.status === "В пути").length;

  return {
    summary: {
      totalCouriers: couriers.length,
      activeCouriers,
      totalOrders: orders.length,
      activeOrders,
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
  const candidates = [props.id, props.zoneId, props.zone_id, props.externalId, props.code, props.name, props.zone, props.zoneName, props.title];

  for (const candidate of candidates) {
    const normalized = normalizeZoneValue(candidate);
    if (normalized) aliases.add(normalized);
  }

  return aliases;
}

function resolveFeatureZoneName(feature = {}, index = 0) {
  const props = feature?.properties || {};

  const directCandidates = [props.zoneName, props.name, props.zone, props.title, props.label, props.description, props.desc, props.fullName];

  for (const candidate of directCandidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  const lowerCaseMap = Object.entries(props).reduce((acc, [key, value]) => {
    acc[
      String(key || "")
        .trim()
        .toLowerCase()
    ] = value;
    return acc;
  }, {});

  const keyCandidates = ["zonename", "zone_name", "zone-name", "name_ru", "zone_title", "название", "названиезоны", "зона"];

  for (const key of keyCandidates) {
    const value = String(lowerCaseMap[key] || "").trim();
    if (value) return value;
  }

  return `Зона ${index + 1}`;
}

function resolveOrderZoneAlias(order = {}) {
  return normalizeZoneValue(order.deliveryZoneId || order.deliveryZoneName);
}

function normalizeRing(ring = []) {
  if (!Array.isArray(ring)) return [];
  return ring
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
}

function getFeaturePolygons(feature = {}) {
  const geometry = feature?.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === "Polygon") {
    const polygon = geometry.coordinates.map((ring) => normalizeRing(ring)).filter((ring) => ring.length >= 3);
    return polygon.length > 0 ? [polygon] : [];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => polygon.map((ring) => normalizeRing(ring)).filter((ring) => ring.length >= 3))
      .filter((polygon) => polygon.length > 0);
  }

  return [];
}

function isPointInRing(lng, lat, ring = []) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > lat !== yj > lat;
    if (!crosses) continue;
    const intersectX = ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi;
    if (lng < intersectX) inside = !inside;
  }
  return inside;
}

function isPointInPolygonWithHoles(lng, lat, polygon = []) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  const outerRing = polygon[0];
  if (!isPointInRing(lng, lat, outerRing)) return false;

  for (let ringIndex = 1; ringIndex < polygon.length; ringIndex += 1) {
    if (isPointInRing(lng, lat, polygon[ringIndex])) {
      return false;
    }
  }

  return true;
}

function isPointInFeature(lng, lat, feature = {}) {
  const polygons = getFeaturePolygons(feature);
  return polygons.some((polygon) => isPointInPolygonWithHoles(lng, lat, polygon));
}

function resolveOrderStatusForFilter(order = {}) {
  return normalizeZoneValue(order.rawStatus || order.status);
}

function buildDeliveryHeatmapReport(rows = [], timezone = "Europe/Moscow", ctx, options = {}) {
  const weekdayLabels = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
  const statusesFilter = new Set(
    (Array.isArray(options?.statuses) ? options.statuses : []).map((value) => normalizeZoneValue(value)).filter(Boolean),
  );

  const baseOrders = Array.isArray(options?.preparedOrders) ? options.preparedOrders : ctx.toOrderEntities(rows, timezone);

  const orders = baseOrders
    .filter((order) => ctx.isCourierDeliveryByServiceType({ OrderServiceType: order.orderServiceType }))
    .filter((order) => {
      if (statusesFilter.size === 0) return true;
      return statusesFilter.has(resolveOrderStatusForFilter(order));
    });
  const totalRevenue = ctx.roundMetric(orders.reduce((sum, order) => sum + Number(order?.revenue || 0), 0));

  const zonesGeoJson = options?.zonesGeoJson && options.zonesGeoJson.type === "FeatureCollection" ? options.zonesGeoJson : null;

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    delayed: 0,
    totalLateMinutes: 0,
  }));

  const weekdayBuckets = Array.from({ length: 7 }, (_, index) => ({
    weekdayIndex: index + 1,
    weekday: weekdayLabels[index + 1],
    totalOrders: 0,
    delayed: 0,
    totalLateMinutes: 0,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: 0,
      delayed: 0,
      totalLateMinutes: 0,
    })),
  }));

  let delayedOrders = 0;

  for (const order of orders) {
    const hour = Number.isInteger(order.hour) && order.hour >= 0 && order.hour <= 23 ? order.hour : null;
    const weekdayIndex = Number(order.weekdayIndex);
    if (hour == null || !weekdayIndex || weekdayIndex < 1 || weekdayIndex > 7) continue;

    const expectedDeliveryAt = Number(order.promisedAt || 0);
    const actualDeliveryAt = Number(order.actualDeliveryAt || 0);
    const lateMinutes = expectedDeliveryAt > 0 && actualDeliveryAt > 0 ? Math.max(0, (actualDeliveryAt - expectedDeliveryAt) / (1000 * 60)) : 0;
    const isDelayed = lateMinutes > 0;

    const hourBucket = hourly[hour];
    hourBucket.orders += 1;
    if (isDelayed) {
      hourBucket.delayed += 1;
      hourBucket.totalLateMinutes += lateMinutes;
      delayedOrders += 1;
    }

    const weekdayBucket = weekdayBuckets[weekdayIndex - 1];
    weekdayBucket.totalOrders += 1;
    if (isDelayed) {
      weekdayBucket.delayed += 1;
      weekdayBucket.totalLateMinutes += lateMinutes;
    }

    const weekdayHourBucket = weekdayBucket.hours[hour];
    weekdayHourBucket.orders += 1;
    if (isDelayed) {
      weekdayHourBucket.delayed += 1;
      weekdayHourBucket.totalLateMinutes += lateMinutes;
    }
  }

  const normalizeBucket = (bucket) => ({
    hour: bucket.hour,
    orders: bucket.orders,
    delayed: bucket.delayed,
    delayRate: bucket.orders > 0 ? ctx.roundMetric((bucket.delayed / bucket.orders) * 100) : 0,
    avgLateMinutes: bucket.delayed > 0 ? ctx.roundMetric(bucket.totalLateMinutes / bucket.delayed) : 0,
  });

  const normalizedHourly = hourly.map((bucket) => normalizeBucket(bucket));
  const peakHour = normalizedHourly.reduce((best, item) => (item.orders > best.orders ? item : best), {
    hour: 0,
    orders: 0,
    delayed: 0,
    delayRate: 0,
    avgLateMinutes: 0,
  });

  const weekdayHeatmap = weekdayBuckets.map((weekday) => ({
    weekdayIndex: weekday.weekdayIndex,
    weekday: weekday.weekday,
    totalOrders: weekday.totalOrders,
    delayed: weekday.delayed,
    delayRate: weekday.totalOrders > 0 ? ctx.roundMetric((weekday.delayed / weekday.totalOrders) * 100) : 0,
    avgLateMinutes: weekday.delayed > 0 ? ctx.roundMetric(weekday.totalLateMinutes / weekday.delayed) : 0,
    hours: weekday.hours.map((bucket) => normalizeBucket(bucket)),
  }));

  const topRiskHours = weekdayHeatmap
    .flatMap((weekday) =>
      weekday.hours.map((hourBucket) => ({
        weekdayIndex: weekday.weekdayIndex,
        weekday: weekday.weekday,
        hour: hourBucket.hour,
        orders: hourBucket.orders,
        delayed: hourBucket.delayed,
        delayRate: hourBucket.delayRate,
        avgLateMinutes: hourBucket.avgLateMinutes,
      })),
    )
    .filter((item) => item.orders > 0)
    .sort((left, right) => right.delayRate - left.delayRate || right.orders - left.orders)
    .slice(0, 20);

  let zones = null;
  let zoneStats = [];
  let matchedByCoordinates = 0;
  let matchedByZoneAlias = 0;
  let unassignedOrders = 0;

  if (zonesGeoJson?.features?.length) {
    const zoneOrderStats = new Map();
    const featureIndexByAlias = new Map();
    const featuresPrepared = zonesGeoJson.features.map((feature, index) => {
      const aliases = resolveFeatureZoneAliases(feature);
      if (aliases.size === 0) {
        aliases.add(`zone-index-${index}`);
      }

      for (const alias of aliases) {
        if (!featureIndexByAlias.has(alias)) {
          featureIndexByAlias.set(alias, index);
        }
      }

      return {
        index,
        feature,
        aliases,
      };
    });

    const getZoneStat = (zoneIndex) => {
      if (!zoneOrderStats.has(zoneIndex)) {
        zoneOrderStats.set(zoneIndex, {
          orders: 0,
          revenue: 0,
          totalMinutesSum: 0,
          totalMinutesCount: 0,
          delayedOrders: 0,
        });
      }
      return zoneOrderStats.get(zoneIndex);
    };

    for (const order of orders) {
      let matchedZoneIndex = null;
      const lat = Number(order?.deliveryPoint?.lat);
      const lng = Number(order?.deliveryPoint?.lng);
      const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

      if (hasCoordinates) {
        const matchedByGeometry = featuresPrepared.find((item) => isPointInFeature(lng, lat, item.feature));
        if (matchedByGeometry) {
          matchedZoneIndex = matchedByGeometry.index;
          matchedByCoordinates += 1;
        }
      }

      if (matchedZoneIndex == null) {
        const alias = resolveOrderZoneAlias(order);
        if (alias && featureIndexByAlias.has(alias)) {
          matchedZoneIndex = featureIndexByAlias.get(alias);
          matchedByZoneAlias += 1;
        }
      }

      if (matchedZoneIndex == null) {
        unassignedOrders += 1;
        continue;
      }

      const stat = getZoneStat(matchedZoneIndex);
      stat.orders += 1;
      stat.revenue += Number(order.revenue || 0);
      if (Number.isFinite(Number(order.totalMinutes))) {
        stat.totalMinutesSum += Number(order.totalMinutes || 0);
        stat.totalMinutesCount += 1;
      }
      if (
        Number.isFinite(Number(order.promisedAt)) &&
        Number.isFinite(Number(order.actualDeliveryAt)) &&
        Number(order.actualDeliveryAt) > Number(order.promisedAt)
      ) {
        stat.delayedOrders += 1;
      }
    }

    const maxOrders = Math.max(...Array.from(zoneOrderStats.values()).map((item) => Number(item.orders || 0)), 1);

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
        const intensity = maxOrders > 0 ? Math.max(0, Math.min(1, Math.sqrt(ordersCount / maxOrders))) : 0;

        return {
          ...feature,
          properties: {
            ...(feature.properties || {}),
            zoneName,
            name: String(feature?.properties?.name || zoneName),
            heatIntensity: intensity,
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
      .map((feature) => ({
        zoneName: resolveFeatureZoneName(feature),
        orders: Number(feature?.properties?.orders || 0),
        revenue: Number(feature?.properties?.revenue || 0),
        avgReceiveMinutes: Number(feature?.properties?.avgReceiveMinutes || 0),
        delayedOrders: Number(feature?.properties?.delayedOrders || 0),
        lateRate: Number(feature?.properties?.lateRate || 0),
        heatIntensity: Number(feature?.properties?.heatIntensity || 0),
      }))
      .sort((left, right) => right.orders - left.orders);
  }

  return {
    summary: {
      totalOrders: orders.length,
      totalRevenue,
      delayedOrders,
      onTimeOrders: Math.max(orders.length - delayedOrders, 0),
      delayRate: orders.length > 0 ? ctx.roundMetric((delayedOrders / orders.length) * 100) : 0,
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
