function normalizeStatusToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function resolveOrderStatusCategory(value) {
  const token = normalizeStatusToken(value);
  if (!token) return "other";

  if (
    token.includes("CANCEL") ||
    token.includes("CANCELED") ||
    token.includes("CANCELLED") ||
    token.includes("STORN") ||
    token.includes("VOID") ||
    token.includes("DELETED") ||
    token.includes("ОТМЕН")
  ) {
    return "canceled";
  }

  if (
    token.includes("DELIVER") ||
    token.includes("CLOSE") ||
    token.includes("CLOSED") ||
    token.includes("COMPLETE") ||
    token.includes("FINISH") ||
    token.includes("DONE") ||
    token.includes("SUCCESS") ||
    token.includes("ДОСТАВ") ||
    token.includes("ЗАВЕРШ") ||
    token.includes("ВЫПОЛН")
  ) {
    return "completed";
  }

  if (
    token.includes("ON_WAY") ||
    token.includes("ONWAY") ||
    token.includes("COURIER") ||
    token.includes("DISPATCH") ||
    token.includes("TRANSIT") ||
    token.includes("В_ПУТИ") ||
    token.includes("ВПУТИ")
  ) {
    return "in_transit";
  }

  return "other";
}

function getCanonicalDeliveryStatus(value) {
  const category = resolveOrderStatusCategory(value);
  if (category === "completed") return "Завершен";
  if (category === "canceled") return "Отменен";
  if (category === "in_transit") return "В пути";
  return "Прочие";
}

function isCompletedStatus(value) {
  return resolveOrderStatusCategory(value) === "completed";
}

function calculateLateMetrics({ promisedAt, actualDeliveryAt }) {
  const expected = Number(promisedAt);
  const actual = Number(actualDeliveryAt);
  const hasComparableTimes = Number.isFinite(expected) && expected > 0 && Number.isFinite(actual) && actual > 0;

  if (!hasComparableTimes) {
    return {
      hasComparableTimes: false,
      lateMinutes: 0,
      isLate: false,
    };
  }

  const lateMinutes = Math.max(0, (actual - expected) / (1000 * 60));
  return {
    hasComparableTimes: true,
    lateMinutes,
    isLate: lateMinutes > 0,
  };
}

function calculateLateOrdersSummary(orders = [], options = {}) {
  const getPromisedAt = typeof options.getPromisedAt === "function" ? options.getPromisedAt : (order) => order?.promisedAt;
  const getActualAt = typeof options.getActualAt === "function" ? options.getActualAt : (order) => order?.actualDeliveryAt;
  const round = typeof options.round === "function" ? options.round : (value) => value;

  let comparableOrders = 0;
  let lateOrders = 0;
  let totalLateMinutes = 0;

  for (const order of orders) {
    const lateMetrics = calculateLateMetrics({
      promisedAt: getPromisedAt(order),
      actualDeliveryAt: getActualAt(order),
    });
    if (!lateMetrics.hasComparableTimes) continue;

    comparableOrders += 1;
    if (lateMetrics.isLate) {
      lateOrders += 1;
      totalLateMinutes += lateMetrics.lateMinutes;
    }
  }

  const totalOrders = orders.length;
  const excludedOrders = Math.max(totalOrders - comparableOrders, 0);
  const onTimeOrders = Math.max(comparableOrders - lateOrders, 0);
  const lateRate = comparableOrders > 0 ? round((lateOrders / comparableOrders) * 100) : 0;
  const onTimeRate = comparableOrders > 0 ? round((onTimeOrders / comparableOrders) * 100) : 0;

  return {
    totalOrders,
    comparableOrders,
    excludedOrders,
    lateOrders,
    onTimeOrders,
    lateRate,
    onTimeRate,
    totalLateMinutes: round(totalLateMinutes),
    avgLateMinutes: lateOrders > 0 ? round(totalLateMinutes / lateOrders) : 0,
  };
}

function calculateDiscountMetrics({ netRevenue, revenueBeforeDiscount, discountSum }, round = (value) => value) {
  const net = Number(netRevenue) || 0;
  const grossInput = Number(revenueBeforeDiscount) || 0;
  const explicitDiscount = Number(discountSum) || 0;
  const normalizedDiscount = explicitDiscount > 0 ? explicitDiscount : Math.max(0, grossInput - net);
  const gross = grossInput > 0 ? grossInput : net + normalizedDiscount;
  const discountPercent = gross > 0 ? round((normalizedDiscount / gross) * 100) : 0;

  return {
    netRevenue: round(net),
    revenueBeforeDiscount: round(gross),
    discountSum: round(normalizedDiscount),
    discountPercent,
  };
}

module.exports = {
  resolveOrderStatusCategory,
  getCanonicalDeliveryStatus,
  isCompletedStatus,
  calculateLateMetrics,
  calculateLateOrdersSummary,
  calculateDiscountMetrics,
};
