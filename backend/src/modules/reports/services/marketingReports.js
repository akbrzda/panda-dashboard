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

function resolveMarketingChannel(order, ctx) {
  const sourceKey = String(order?.sourceKey || "").trim();
  if (sourceKey) return sourceKey;
  return ctx.normalizeChannelName(order?.orderType || "");
}

function buildMarketingSourcesFromOrders(orders = [], ctx) {
  const channelMap = new Map();
  const dailyMap = new Map();

  for (const order of orders) {
    const channel = resolveMarketingChannel(order, ctx) || "Не указан";
    const date = String(order?.date || "").trim();
    if (!date) continue;

    if (!channelMap.has(channel)) channelMap.set(channel, { source: channel, orders: 0, revenue: 0 });
    const sourceItem = channelMap.get(channel);
    sourceItem.orders += 1;
    sourceItem.revenue += Number(order?.revenue || 0);

    if (!dailyMap.has(date)) dailyMap.set(date, { date, orders: 0, revenue: 0, channels: {} });
    const daily = dailyMap.get(date);
    daily.orders += 1;
    daily.revenue += Number(order?.revenue || 0);

    if (!daily.channels[channel]) daily.channels[channel] = { orders: 0, revenue: 0 };
    daily.channels[channel].orders += 1;
    daily.channels[channel].revenue += Number(order?.revenue || 0);
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

function buildPromotionsReport(rows = [], ctx) {
  const promoMap = new Map();
  const dailyMap = new Map();
  let totalRevenue = 0;
  let totalRevenueBeforeDiscount = 0;
  let totalDiscount = 0;
  const uniqueOrders = new Set();

  for (const row of rows) {
    const orderId = String(row["UniqOrderId.Id"] || "").trim();
    if (orderId) uniqueOrders.add(orderId);

    const date = String(row["OpenDate.Typed"] || "")
      .slice(0, 10)
      .replace(/\./g, "-");
    const promoType = String(row.ItemSaleEventDiscountType || "").trim() || "Без промо";
    const promoName = promoType;
    const key = `${promoType}::${promoName}`;

    const revenue = Number(row.RevenueWithoutDiscount || row.Sales || 0);
    const discount = Number(row.DiscountSum || 0);
    const netSales = Number(row.Sales || 0);

    totalRevenue += netSales;
    totalRevenueBeforeDiscount += revenue;
    totalDiscount += Math.max(discount, 0);

    if (!promoMap.has(key)) {
      promoMap.set(key, { promoType, promoName, orders: 0, revenue: 0, discountSum: 0, netSales: 0 });
    }
    const promo = promoMap.get(key);
    promo.orders += Number(row["UniqOrderId.OrdersCount"] || 0);
    promo.revenue += revenue;
    promo.discountSum += Math.max(discount, 0);
    promo.netSales += netSales;

    if (!dailyMap.has(date)) dailyMap.set(date, { date, discountSum: 0, orders: 0, netSales: 0 });
    const daily = dailyMap.get(date);
    daily.discountSum += Math.max(discount, 0);
    daily.orders += Number(row["UniqOrderId.OrdersCount"] || 0);
    daily.netSales += netSales;
  }

  const promotions = [...promoMap.values()]
    .map((item) => {
      const discountMetrics = ctx.calculateDiscountMetrics({
        netRevenue: item.netSales,
        revenueBeforeDiscount: item.revenue,
        discountSum: item.discountSum,
      });

      return {
        ...item,
        revenue: ctx.roundMetric(item.revenue),
        discountSum: discountMetrics.discountSum,
        netSales: ctx.roundMetric(item.netSales),
        discountRate: discountMetrics.discountPercent,
      };
    })
    .sort((a, b) => b.discountSum - a.discountSum);

  const dailyBreakdown = [...dailyMap.values()]
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      discountSum: ctx.roundMetric(item.discountSum),
      netSales: ctx.roundMetric(item.netSales),
    }));

  const totalDiscountMetrics = ctx.calculateDiscountMetrics({
    netRevenue: totalRevenue,
    revenueBeforeDiscount: totalRevenueBeforeDiscount,
    discountSum: totalDiscount,
  });

  return {
    summary: {
      totalOrders: uniqueOrders.size,
      totalRevenue: ctx.roundMetric(totalRevenue),
      totalDiscount: totalDiscountMetrics.discountSum,
      discountRate: totalDiscountMetrics.discountPercent,
    },
    promotions,
    dailyBreakdown,
  };
}

module.exports = {
  buildMarketingSourcesReport,
  buildMarketingSourcesFromOrders,
  buildPromotionsReport,
};
