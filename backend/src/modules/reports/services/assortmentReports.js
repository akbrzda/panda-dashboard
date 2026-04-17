function buildMenuAssortmentReport({ topDishes, stopListItems, timezone = "Europe/Moscow" }, ctx) {
  const topRows = [...(topDishes?.top || []), ...(topDishes?.outsiders || [])];
  const uniqueItems = new Map();
  const categories = new Map();
  const stopListByName = new Map();
  const nowTs = Date.now();

  const parseStopDate = (value) => {
    if (!value) return null;
    const normalized = String(value).replace(" ", "T");
    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  for (const item of stopListItems || []) {
    const name = String(item.productName || item.itemName || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const openedAtTs = parseStopDate(item.dateAdd || item.openedAt || item.dateAddOriginal || item.openedAtOriginal);
    const closedAtTs = parseStopDate(item.closedAt || item.closedAtOriginal);
    const finishTs = closedAtTs || nowTs;
    const inStopHours = openedAtTs && finishTs >= openedAtTs ? ctx.roundMetric((finishTs - openedAtTs) / (1000 * 60 * 60)) : null;
    const inStopDays = inStopHours != null ? ctx.roundMetric(inStopHours / 24) : null;

    if (!stopListByName.has(key)) {
      stopListByName.set(key, {
        name,
        reason: item.reason || "",
        balance: Number(item.balance || 0),
        dateAdd: item.dateAdd || item.openedAt || null,
        closedAt: item.closedAt || null,
        inStopHours,
        inStopDays,
        timezone,
      });
    }
  }

  for (const item of topRows) {
    const name = String(item.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const category = String(item.category || "Без категории").trim();
    const stop = stopListByName.get(key);

    uniqueItems.set(key, {
      name,
      category,
      soldQty: Number(item.qty || 0),
      revenue: ctx.roundMetric(item.revenue),
      avgPrice: ctx.roundMetric(item.avgPrice),
      available: !stop,
      stopReason: stop?.reason || null,
      stopSince: stop?.dateAdd || null,
      inStopHours: stop?.inStopHours ?? null,
      inStopDays: stop?.inStopDays ?? null,
    });

    if (!categories.has(category)) {
      categories.set(category, { category, items: 0, soldQty: 0, revenue: 0, unavailable: 0 });
    }
    const categorySummary = categories.get(category);
    categorySummary.items += 1;
    categorySummary.soldQty += Number(item.qty || 0);
    categorySummary.revenue += Number(item.revenue || 0);
    if (stop) categorySummary.unavailable += 1;
  }

  const items = [...uniqueItems.values()].sort((a, b) => b.revenue - a.revenue);
  const categoriesList = [...categories.values()]
    .map((item) => ({ ...item, revenue: ctx.roundMetric(item.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  const stopListDigest = [...stopListByName.values()].sort((a, b) => (b.inStopHours || 0) - (a.inStopHours || 0)).slice(0, 200);
  const totalSoldQty = items.reduce((sum, item) => sum + item.soldQty, 0);
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const unavailableCount = items.filter((item) => !item.available).length;

  return {
    summary: {
      totalItems: items.length,
      totalRevenue: ctx.roundMetric(totalRevenue),
      totalSoldQty,
      categories: categoriesList.length,
      unavailableCount,
      availabilityRate: items.length > 0 ? ctx.roundMetric(((items.length - unavailableCount) / items.length) * 100) : 0,
    },
    categories: categoriesList,
    items: items.slice(0, 300),
    stopListDigest,
    timezone,
  };
}

module.exports = {
  buildMenuAssortmentReport,
};
