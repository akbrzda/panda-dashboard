const OlapClient = require("../shared/olapClient");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class FoodcostService extends OlapClient {
  constructor() {
    super();
    this.maxChunkDays = Number(process.env.IIKO_FOODCOST_CHUNK_DAYS || 1);
    this.cacheTtlMs = Number(process.env.IIKO_FOODCOST_CACHE_TTL_MS || 120000);
    this.reportCache = new Map();
    this.categoryMaxAttempts = Number(process.env.IIKO_FOODCOST_CATEGORY_MAX_ATTEMPTS || 6);
    this.summaryMaxAttempts = Number(process.env.IIKO_FOODCOST_SUMMARY_MAX_ATTEMPTS || 2);
    this.lflMaxWaitMs = Number(process.env.IIKO_FOODCOST_LFL_MAX_WAIT_MS || 6000);
    this.fetchTimeoutMs = Number(process.env.IIKO_FOODCOST_FETCH_TIMEOUT_MS || 3000);
    this.maxPeriodWaitMs = Number(process.env.IIKO_FOODCOST_MAX_WAIT_MS || 20000);
  }

  calculateLflPercent(currentValue, previousValue) {
    return currentValue != null && previousValue != null && previousValue > 0
      ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100
      : null;
  }

  buildDateChunks(dateFrom, dateTo) {
    const chunks = [];
    const end = new Date(dateTo);
    let cursor = new Date(dateFrom);

    while (cursor <= end) {
      const chunkStart = new Date(cursor);
      const chunkEnd = new Date(chunkStart);
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + this.maxChunkDays - 1);

      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime());
      }

      chunks.push({
        dateFrom: toMoscowDateStr(chunkStart),
        dateTo: toMoscowDateStr(chunkEnd),
      });

      cursor = new Date(chunkEnd);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return chunks;
  }

  getChunkDays(dateFrom, dateTo) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }

  splitDateChunk(dateFrom, dateTo) {
    const totalDays = this.getChunkDays(dateFrom, dateTo);

    if (totalDays <= 1) {
      return [{ dateFrom, dateTo }];
    }

    const start = new Date(dateFrom);
    const middle = new Date(start);
    middle.setUTCDate(middle.getUTCDate() + Math.floor(totalDays / 2) - 1);

    const nextStart = new Date(middle);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);

    return [
      { dateFrom: toMoscowDateStr(start), dateTo: toMoscowDateStr(middle) },
      { dateFrom: toMoscowDateStr(nextStart), dateTo: toMoscowDateStr(new Date(dateTo)) },
    ];
  }

  getCacheKey(storeId, dateFrom, dateTo) {
    return `${storeId}:${dateFrom}:${dateTo}`;
  }

  appendWarningMessage(currentMessage, nextMessage) {
    if (!nextMessage) return currentMessage || null;
    if (!currentMessage) return nextMessage;
    return currentMessage.includes(nextMessage) ? currentMessage : `${currentMessage}. ${nextMessage}`;
  }

  buildUnavailableReport(dateFrom, dateTo, warningMessage = "IIKO отвечает слишком долго, показаны неполные данные") {
    return {
      percent: null,
      costSum: null,
      revenue: null,
      status: "unavailable",
      categories: [],
      degraded: true,
      warningMessage,
      period: {
        startDate: String(dateFrom),
        endDate: String(dateTo),
      },
    };
  }

  createFoodcostBody(storeId, startIso, endIso, groupFields = ["ProductCategory"]) {
    return {
      storeIds: [String(storeId)],
      olapType: "SALES",
      categoryFields: [],
      groupFields,
      stackByDataFields: false,
      dataFields: ["Sales", "ProductCost"],
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
          name: "ProductCost",
          title: "Food cost",
          description: "Себестоимость",
          formula: "[ProductCostBase.ProductCost]",
          type: "MONEY",
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
      includeVoidTransactions: false,
      includeNonBusinessPaymentTypes: false,
    };
  }

  parseFoodcostRows(result) {
    return this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      ProductCost: parseFloat(values[1]) || 0,
    }));
  }

  async fetchFoodcostRows(client, delay, storeId, dateFrom, dateTo, groupFields = ["ProductCategory"]) {
    const { startIso, endIso } = buildOlapBounds(dateFrom, dateTo);
    const body = this.createFoodcostBody(storeId, startIso, endIso, groupFields);
    const isSummaryMode = groupFields.length === 0;
    const result = await this.pollOlap(client, delay, body, {
      maxAttempts: isSummaryMode ? this.summaryMaxAttempts : this.categoryMaxAttempts,
      fetchTimeoutMs: this.fetchTimeoutMs,
      logEvery: 10,
    });
    return this.parseFoodcostRows(result);
  }

  async loadChunkRows(client, delay, storeId, chunk) {
    try {
      return {
        rows: await this.fetchFoodcostRows(client, delay, storeId, chunk.dateFrom, chunk.dateTo, ["ProductCategory"]),
        degraded: false,
        warningMessage: null,
      };
    } catch (error) {
      const chunkDays = this.getChunkDays(chunk.dateFrom, chunk.dateTo);

      if (chunkDays > 1) {
        console.warn("⚠️ Foodcost chunk будет разбит на более мелкие части:", {
          storeId,
          dateFrom: chunk.dateFrom,
          dateTo: chunk.dateTo,
          chunkDays,
          message: error?.message,
        });

        const nestedRows = [];
        let warningMessage = "Часть категорий временно недоступна, показаны неполные данные";
        const subChunks = this.splitDateChunk(chunk.dateFrom, chunk.dateTo);

        for (const subChunk of subChunks) {
          const subResult = await this.loadChunkRows(client, delay, storeId, subChunk);
          nestedRows.push(...subResult.rows);
          warningMessage = this.appendWarningMessage(warningMessage, subResult.warningMessage);
        }

        return {
          rows: nestedRows,
          degraded: true,
          warningMessage,
        };
      }

      console.warn("⚠️ Foodcost fallback на сводный запрос без категорий:", {
        storeId,
        dateFrom: chunk.dateFrom,
        dateTo: chunk.dateTo,
        message: error?.message,
      });

      try {
        const summaryRows = await this.fetchFoodcostRows(client, delay, storeId, chunk.dateFrom, chunk.dateTo, []);
        return {
          rows: summaryRows,
          degraded: true,
          warningMessage: "Категории временно недоступны, показан сводный фудкост",
        };
      } catch (fallbackError) {
        console.warn("⚠️ Foodcost chunk пропущен после таймаута:", {
          storeId,
          dateFrom: chunk.dateFrom,
          dateTo: chunk.dateTo,
          message: fallbackError?.message,
        });

        return {
          rows: [],
          degraded: true,
          warningMessage: "IIKO отвечает слишком долго, показаны неполные данные",
        };
      }
    }
  }

  async getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const currentStartedAt = Date.now();
    const current = await this.getFoodcostForPeriod({ organizationId, dateFrom, dateTo });

    let lfl = null;
    let degraded = Boolean(current.degraded);
    let warningMessage = current.warningMessage || null;
    const currentDurationMs = Date.now() - currentStartedAt;

    if (lflDateFrom && lflDateTo && currentDurationMs < this.lflMaxWaitMs) {
      try {
        lfl = await Promise.race([
          this.getFoodcostForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }),
          this.delay(this.lflMaxWaitMs).then(() => {
            throw new Error("Превышено время ожидания LFL");
          }),
        ]);
      } catch (error) {
        degraded = true;
        warningMessage = this.appendWarningMessage(warningMessage, "LFL временно недоступен для ускорения ответа");
        console.warn("⚠️ Не удалось получить LFL по фудкосту:", {
          organizationId,
          dateFrom: lflDateFrom,
          dateTo: lflDateTo,
          message: error?.message || String(error),
        });
      }
    } else if (lflDateFrom && lflDateTo) {
      degraded = true;
      warningMessage = this.appendWarningMessage(warningMessage, "LFL пропущен для ускорения ответа");
    }

    return {
      ...current,
      degraded,
      warningMessage,
      lfl: this.calculateLflPercent(current.percent, lfl?.percent),
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }

  async getFoodcostForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);
    const cacheKey = this.getCacheKey(storeId, dateFrom, dateTo);
    const cachedReport = this.reportCache.get(cacheKey);

    if (cachedReport && cachedReport.expiresAt > Date.now()) {
      console.log(`⚡ Foodcost cache hit ${dateFrom} — ${dateTo} (store ${storeId})`);
      return cachedReport.data;
    }

    const chunks = this.buildDateChunks(dateFrom, dateTo);
    const startedAt = Date.now();
    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    console.log(`📊 Foodcost: store ${storeId}, период ${dateFrom} — ${dateTo}, частей ${chunks.length}`);

    const loadResult = await this.withAuth(storeId, async (client, delay) => {
      const aggregatedRows = [];
      let degraded = false;
      let warningMessage = null;

      for (const chunk of chunks) {
        if (Date.now() - startedAt >= this.maxPeriodWaitMs) {
          degraded = true;
          warningMessage = this.appendWarningMessage(warningMessage, "Показаны частичные данные для ускорения ответа");
          console.warn("⚠️ Foodcost остановлен по лимиту времени:", {
            storeId,
            maxPeriodWaitMs: this.maxPeriodWaitMs,
          });
          break;
        }

        const chunkStartedAt = Date.now();
        const chunkResult = await this.loadChunkRows(client, delay, storeId, chunk);

        aggregatedRows.push(...chunkResult.rows);
        degraded = degraded || chunkResult.degraded;
        warningMessage = this.appendWarningMessage(warningMessage, chunkResult.warningMessage);

        console.log(`✅ Foodcost chunk: ${chunk.dateFrom} — ${chunk.dateTo}, строк ${chunkResult.rows.length}, ${Date.now() - chunkStartedAt} мс`);
      }

      return { rows: aggregatedRows, degraded, warningMessage };
    });

    const rows = loadResult.rows;

    if (rows.length === 0) {
      return this.buildUnavailableReport(dateFrom, dateTo, loadResult.warningMessage || "IIKO отвечает слишком долго, показаны неполные данные");
    }

    const byCategory = {};
    let totalRevenue = 0;
    let totalCost = 0;

    for (const row of rows) {
      const category = row.ProductCategory || row.Category || "Без категории";
      const revenue = Number(row.Sales) || 0;
      const cost = Number(row.ProductCost) || 0;

      if (!byCategory[category]) {
        byCategory[category] = { name: category, revenue: 0, cost: 0 };
      }

      byCategory[category].revenue += revenue;
      byCategory[category].cost += cost;
      totalRevenue += revenue;
      totalCost += cost;
    }

    const categories = Object.values(byCategory)
      .map((item) => ({
        ...item,
        percent: item.revenue > 0 ? Math.round((item.cost / item.revenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent);

    const percent = totalRevenue > 0 ? Math.round((totalCost / totalRevenue) * 10000) / 100 : 0;
    const status = percent > 35 ? "critical" : percent >= 30 ? "warning" : "normal";

    console.log(`✅ Foodcost: store ${storeId}, период ${dateFrom} — ${dateTo}, строк ${rows.length}, ${Date.now() - startedAt} мс`);

    const report = {
      percent,
      costSum: totalCost,
      revenue: totalRevenue,
      status,
      categories,
      degraded: loadResult.degraded,
      warningMessage: loadResult.warningMessage,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };

    this.reportCache.set(cacheKey, {
      data: report,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return report;
  }
}

module.exports = new FoodcostService();
