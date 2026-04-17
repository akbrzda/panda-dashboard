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
          courierName: row["Delivery.Courier"] || "РќРµРёР·РІРµСЃС‚РЅС‹Р№ РєСѓСЂСЊРµСЂ",
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
      label: `${size} Р·Р°РєР°Р·(РѕРІ) РІ РјР°СЂС€СЂСѓС‚Рµ`,
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
    if (order.prepMinutes != null && order.prepMinutes > prepThreshold) ruleViolations.push("РџСЂРёРіРѕС‚РѕРІР»РµРЅРёРµ");
    if (order.shelfMinutes != null && order.shelfMinutes > shelfThreshold) ruleViolations.push("РџРѕР»РєР°");
    if (order.routeMinutes != null && order.routeMinutes > routeThreshold) ruleViolations.push("Р’ РїСѓС‚Рё");
    if (order.totalMinutes != null && order.totalMinutes > totalThreshold) ruleViolations.push("РћР±С‰РµРµ SLA");

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
    const status = order.status || "РЎРѕР·РґР°РЅ";
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
    if (status === "Р”РѕСЃС‚Р°РІР»РµРЅ") daily.delivered += 1;
    if (status === "РћС‚РјРµРЅРµРЅ") daily.canceled += 1;
  }

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((order) => order.status === "Р”РѕСЃС‚Р°РІР»РµРЅ").length;
  const canceledOrders = orders.filter((order) => order.status === "РћС‚РјРµРЅРµРЅ").length;

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
  const activeOrders = timeline.filter((item) => item.status === "Р’ РїСѓС‚Рё").length;

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

module.exports = {
  buildRouteStats,
  buildSlaReport,
  buildCourierKpiReport,
  buildDeliverySummaryReport,
  buildDeliveryDelaysReport,
  buildCourierMapReport,
};
