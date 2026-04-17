function buildOperationalSummary(rows = [], ctx) {
  const ordersMap = new Map();
  const deliveryTimes = [];
  const cookingTimes = [];

  rows.forEach((row, index) => {
    const orderId = String(row["UniqOrderId.Id"] || `row-${index}`);
    if (!ordersMap.has(orderId)) ordersMap.set(orderId, { ...row, Sales: 0 });
    const order = ordersMap.get(orderId);
    order.Sales += Number(row.Sales) || 0;
  });

  let totalRevenue = 0;
  let totalOrders = 0;

  for (const row of ordersMap.values()) {
    totalRevenue += Number(row.Sales) || 0;
    totalOrders += 1;

    const wayDuration = Number(row["Delivery.WayDuration"]) || 0;
    const averageOrderTime = Number(row.AverageOrderTime || row["OrderTime.AverageOrderTime"]) || 0;
    const orderLength = Number(row["OrderTime.OrderLength"]) || 0;
    const cookingFinishTime = ctx.parseDateTime(row["Delivery.CookingFinishTime"]);
    const openTime = ctx.parseDateTime(row.OpenTime);
    const deliveryDuration = averageOrderTime > 0 ? averageOrderTime : wayDuration;

    if (ctx.isDeliveryOrder(row) && deliveryDuration > 0) deliveryTimes.push(deliveryDuration);

    let cookingTime = null;
    if (openTime && cookingFinishTime && cookingFinishTime >= openTime) {
      cookingTime = (cookingFinishTime - openTime) / (1000 * 60);
    } else if (orderLength > 0) {
      cookingTime = Math.max(orderLength - Math.max(wayDuration, 0), 0);
    }
    if (cookingTime && cookingTime > 0) cookingTimes.push(cookingTime);
  }

  const avgDeliveryTime = deliveryTimes.length > 0 ? ctx.roundMetric(deliveryTimes.reduce((sum, value) => sum + value, 0) / deliveryTimes.length) : 0;
  const avgCookingTime = cookingTimes.length > 0 ? ctx.roundMetric(cookingTimes.reduce((sum, value) => sum + value, 0) / cookingTimes.length) : 0;

  return {
    totalRevenue,
    totalOrders,
    avgPerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    avgDeliveryTime,
    avgCookingTime,
  };
}

function buildHourlySalesReport(rows = [], timezone = "Europe/Moscow", ctx) {
  const weekdayLabels = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
  const orders = ctx.toOrderEntities(rows, timezone);
  const dailyMap = new Map();
  const weekdayDayCounters = new Map();

  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orderIds: new Set() }));
  const weekdayBuckets = Array.from({ length: 7 }, (_, index) =>
    Array.from({ length: 24 }, (_, hour) => ({ weekdayIndex: index + 1, hour, revenue: 0, orderIds: new Set() })),
  );

  let totalRevenue = 0;
  const allOrderIds = new Set();

  for (const order of orders) {
    const { hour, weekdayIndex, date: dateStr } = order;
    const revenue = Number(order.revenue) || 0;
    const orderId = order.orderId;

    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !weekdayIndex || !dateStr) continue;

    totalRevenue += revenue;
    allOrderIds.add(orderId);

    hourlyBuckets[hour].revenue += revenue;
    hourlyBuckets[hour].orderIds.add(orderId);
    weekdayBuckets[weekdayIndex - 1][hour].revenue += revenue;
    weekdayBuckets[weekdayIndex - 1][hour].orderIds.add(orderId);

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        weekdayIndex,
        weekday: weekdayLabels[weekdayIndex],
        totalOrders: 0,
        totalRevenue: 0,
        hours: Array.from({ length: 24 }, (_, hourNumber) => ({ hour: hourNumber, orders: 0, revenue: 0 })),
      });
    }

    const dailyEntry = dailyMap.get(dateStr);
    dailyEntry.totalOrders += 1;
    dailyEntry.totalRevenue += revenue;
    dailyEntry.hours[hour].orders += 1;
    dailyEntry.hours[hour].revenue += revenue;

    if (!weekdayDayCounters.has(weekdayIndex)) weekdayDayCounters.set(weekdayIndex, new Set());
    weekdayDayCounters.get(weekdayIndex).add(dateStr);
  }

  const hourly = hourlyBuckets.map((bucket) => ({ hour: bucket.hour, revenue: ctx.roundMetric(bucket.revenue), orders: bucket.orderIds.size }));

  const heatmap = weekdayBuckets.map((row) => {
    const weekdayIndex = row[0].weekdayIndex;
    const daysCount = weekdayDayCounters.get(weekdayIndex)?.size || 0;
    return {
      weekdayIndex,
      weekday: weekdayLabels[weekdayIndex],
      daysCount,
      hours: row.map((cell) => ({
        hour: cell.hour,
        revenue: daysCount > 0 ? ctx.roundMetric(cell.revenue / daysCount) : 0,
        orders: daysCount > 0 ? ctx.roundMetric(cell.orderIds.size / daysCount) : 0,
      })),
    };
  });

  const daily = [...dailyMap.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      ...day,
      totalRevenue: ctx.roundMetric(day.totalRevenue),
      hours: day.hours.map((cell) => ({ ...cell, revenue: ctx.roundMetric(cell.revenue) })),
    }));

  const weekdaySummary = Array.from({ length: 7 }, (_, index) => {
    const weekdayIndex = index + 1;
    const weekdayDays = daily.filter((day) => day.weekdayIndex === weekdayIndex);
    const totalWeekdayOrders = weekdayDays.reduce((sum, day) => sum + day.totalOrders, 0);
    const totalWeekdayRevenue = weekdayDays.reduce((sum, day) => sum + day.totalRevenue, 0);
    const daysCount = weekdayDays.length;

    return {
      weekdayIndex,
      weekday: weekdayLabels[weekdayIndex],
      daysCount,
      totalOrders: totalWeekdayOrders,
      totalRevenue: ctx.roundMetric(totalWeekdayRevenue),
      avgOrders: daysCount > 0 ? ctx.roundMetric(totalWeekdayOrders / daysCount) : 0,
      avgRevenue: daysCount > 0 ? ctx.roundMetric(totalWeekdayRevenue / daysCount) : 0,
    };
  });

  const maxRevenueItem = hourly.reduce((best, current) => (current.revenue > best.revenue ? current : best), { hour: 0, revenue: 0, orders: 0 });
  const minRevenueCandidates = hourly.filter((item) => item.orders > 0);
  const minRevenueItem =
    minRevenueCandidates.length > 0
      ? minRevenueCandidates.reduce((best, current) => (current.revenue < best.revenue ? current : best), minRevenueCandidates[0])
      : { hour: 0, revenue: 0, orders: 0 };

  return {
    summary: {
      totalRevenue: ctx.roundMetric(totalRevenue),
      totalOrders: allOrderIds.size,
      avgRevenuePerHour: ctx.roundMetric(totalRevenue / 24),
      peakHour: maxRevenueItem,
      lowHour: minRevenueItem,
    },
    hourly,
    heatmap,
    daily,
    weekdaySummary,
  };
}

function buildProductionForecastReport(
  {
    historicalRows = [],
    preorderRows = [],
    forecastDate,
    timezone = "Europe/Moscow",
    organizationId = null,
    verifiedColumns = [],
    missingColumns = [],
  },
  ctx,
) {
  const forecastDateOnly = String(forecastDate || "").slice(0, 10);
  const forecastDateTs = new Date(`${forecastDateOnly}T12:00:00Z`).getTime();
  const forecastWeekdayIndex = Number.isFinite(forecastDateTs) ? (new Date(forecastDateTs).getUTCDay() || 7) : 1;
  const normalizedWeekdayIndex = forecastWeekdayIndex === 0 ? 7 : forecastWeekdayIndex;

  const historicalOrders = ctx.toOrderEntities(historicalRows, timezone);
  const preorderOrders = ctx.toOrderEntities(preorderRows, timezone).filter((order) => order.date === forecastDateOnly);

  const historicalWeekdayOrders = historicalOrders.filter((order) => Number(order.weekdayIndex) === normalizedWeekdayIndex);
  const historicalDays = new Set(historicalWeekdayOrders.map((order) => order.date)).size || 1;

  const byHourBase = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
    departmentCapacity: new Map(),
  }));
  const byHourPreorders = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
    departmentOrders: new Map(),
  }));

  const departmentHistory = new Map();
  const departmentPreorders = new Map();

  const registerDepartment = (map, departmentId, departmentName) => {
    if (!map.has(departmentId)) {
      map.set(departmentId, {
        departmentId,
        departmentName: departmentName || departmentId || "Неизвестно",
        hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 })),
      });
    }
    return map.get(departmentId);
  };

  for (const order of historicalWeekdayOrders) {
    if (!Number.isInteger(order.hour) || order.hour < 0 || order.hour > 23) continue;

    const revenue = Number(order.revenue || 0);
    const departmentId = String(order.departmentId || "unknown");
    const departmentName = order.departmentName || departmentId;
    const hourBucket = byHourBase[order.hour];
    hourBucket.orders += 1;
    hourBucket.revenue += revenue;
    hourBucket.departmentCapacity.set(departmentId, (hourBucket.departmentCapacity.get(departmentId) || 0) + 1);

    const dep = registerDepartment(departmentHistory, departmentId, departmentName);
    dep.hourly[order.hour].orders += 1;
    dep.hourly[order.hour].revenue += revenue;
  }

  for (const order of preorderOrders) {
    if (!Number.isInteger(order.hour) || order.hour < 0 || order.hour > 23) continue;

    const revenue = Number(order.revenue || 0);
    const departmentId = String(order.departmentId || "unknown");
    const departmentName = order.departmentName || departmentId;
    const hourBucket = byHourPreorders[order.hour];
    hourBucket.orders += 1;
    hourBucket.revenue += revenue;
    hourBucket.departmentOrders.set(departmentId, (hourBucket.departmentOrders.get(departmentId) || 0) + 1);

    const dep = registerDepartment(departmentPreorders, departmentId, departmentName);
    dep.hourly[order.hour].orders += 1;
    dep.hourly[order.hour].revenue += revenue;
  }

  const toCapacity = (avgOrders) => Math.max(1, Math.round(avgOrders * 1.2 + 1));
  const hourly = byHourBase.map((base, index) => {
    const preorder = byHourPreorders[index];
    const baseOrders = historicalDays > 0 ? base.orders / historicalDays : 0;
    const baseRevenue = historicalDays > 0 ? base.revenue / historicalDays : 0;
    const forecastOrders = baseOrders + preorder.orders;
    const forecastRevenue = baseRevenue + preorder.revenue;
    const capacity = toCapacity(baseOrders);

    return {
      hour: index,
      baseOrders: ctx.roundMetric(baseOrders),
      preorderOrders: preorder.orders,
      forecastOrders: ctx.roundMetric(forecastOrders),
      baseRevenue: ctx.roundMetric(baseRevenue),
      preorderRevenue: ctx.roundMetric(preorder.revenue),
      forecastRevenue: ctx.roundMetric(forecastRevenue),
      capacity,
      overload: forecastOrders > capacity,
      loadPercent: capacity > 0 ? ctx.roundMetric((forecastOrders / capacity) * 100) : 0,
    };
  });

  const departmentsMap = new Map();
  for (const [departmentId, depHistory] of departmentHistory.entries()) {
    const depPreorders = departmentPreorders.get(departmentId);
    let forecastOrders = 0;
    let capacity = 0;
    let overloadHours = 0;
    let revenue = 0;

    const hourlyForecast = depHistory.hourly.map((cell, hour) => {
      const baseOrders = historicalDays > 0 ? cell.orders / historicalDays : 0;
      const baseRevenue = historicalDays > 0 ? cell.revenue / historicalDays : 0;
      const preorderOrders = depPreorders?.hourly?.[hour]?.orders || 0;
      const preorderRevenue = depPreorders?.hourly?.[hour]?.revenue || 0;
      const hourForecast = baseOrders + preorderOrders;
      const hourCapacity = toCapacity(baseOrders);
      const hourOverload = hourForecast > hourCapacity;

      forecastOrders += hourForecast;
      capacity += hourCapacity;
      revenue += baseRevenue + preorderRevenue;
      if (hourOverload) overloadHours += 1;

      return {
        hour,
        forecastOrders: ctx.roundMetric(hourForecast),
        capacity: hourCapacity,
        overload: hourOverload,
      };
    });

    departmentsMap.set(departmentId, {
      departmentId,
      departmentName: depHistory.departmentName,
      forecastOrders: ctx.roundMetric(forecastOrders),
      forecastRevenue: ctx.roundMetric(revenue),
      capacity,
      overloadHours,
      loadPercent: capacity > 0 ? ctx.roundMetric((forecastOrders / capacity) * 100) : 0,
      isOverloaded: overloadHours > 0,
      hourly: hourlyForecast,
    });
  }

  for (const [departmentId, depPreorders] of departmentPreorders.entries()) {
    if (departmentsMap.has(departmentId)) continue;
    const hourlyForecast = depPreorders.hourly.map((cell) => ({
      hour: cell.hour,
      forecastOrders: ctx.roundMetric(cell.orders),
      capacity: 1,
      overload: cell.orders > 1,
    }));
    const forecastOrders = depPreorders.hourly.reduce((sum, cell) => sum + cell.orders, 0);
    const revenue = depPreorders.hourly.reduce((sum, cell) => sum + cell.revenue, 0);
    const overloadHours = hourlyForecast.filter((cell) => cell.overload).length;
    const capacity = 24;

    departmentsMap.set(departmentId, {
      departmentId,
      departmentName: depPreorders.departmentName,
      forecastOrders: ctx.roundMetric(forecastOrders),
      forecastRevenue: ctx.roundMetric(revenue),
      capacity,
      overloadHours,
      loadPercent: capacity > 0 ? ctx.roundMetric((forecastOrders / capacity) * 100) : 0,
      isOverloaded: overloadHours > 0,
      hourly: hourlyForecast,
    });
  }

  const departments = [...departmentsMap.values()].sort((left, right) => right.loadPercent - left.loadPercent);
  const totalForecastOrders = hourly.reduce((sum, item) => sum + item.forecastOrders, 0);
  const totalForecastRevenue = hourly.reduce((sum, item) => sum + item.forecastRevenue, 0);
  const totalCapacity = hourly.reduce((sum, item) => sum + item.capacity, 0);
  const overloadHours = hourly.filter((item) => item.overload).length;
  const confirmedPreorders = preorderOrders.length;

  return {
    summary: {
      organizationId,
      forecastDate: forecastDateOnly,
      weekdayIndex: normalizedWeekdayIndex,
      historicalDays,
      totalForecastOrders: ctx.roundMetric(totalForecastOrders),
      totalForecastRevenue: ctx.roundMetric(totalForecastRevenue),
      totalCapacity,
      loadPercent: totalCapacity > 0 ? ctx.roundMetric((totalForecastOrders / totalCapacity) * 100) : 0,
      overloadHours,
      overloadDepartments: departments.filter((item) => item.isOverloaded).length,
      confirmedPreorders,
    },
    hourly,
    departments,
    metadata: {
      timezone,
      verifiedColumns,
      missingColumns,
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  buildOperationalSummary,
  buildHourlySalesReport,
  buildProductionForecastReport,
};
