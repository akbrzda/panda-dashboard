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

module.exports = {
  buildOperationalSummary,
  buildHourlySalesReport,
};
