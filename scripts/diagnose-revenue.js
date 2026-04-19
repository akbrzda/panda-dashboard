#!/usr/bin/env node
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
const axisModule = require(path.join(__dirname, "../backend/node_modules/axios"));
const axios = axisModule.default || axisModule;
const crypto = require("crypto");
const { CookieJar } = require(path.join(__dirname, "../backend/node_modules/tough-cookie"));
const { wrapper } = require(path.join(__dirname, "../backend/node_modules/axios-cookiejar-support"));

const SERVER_BASE_URL = process.env.IIKO_SERVER_BASE_URL;
const IIKO_USER = process.env.IIKO_USER;
const IIKO_PASSWORD = process.env.IIKO_PASSWORD;
const BACKEND_URL = `http://localhost:${process.env.PORT || 3000}`;

const ORGS = [
  { id: "48b9f0aa-6a54-408a-a546-b26dcd1b047b", name: "Пенза" },
  { id: "4bf8b2cd-066b-462e-833b-27c77b4d2d58", name: "Когалым" },
];

const now = new Date();
const dayOfWeek = now.getUTCDay();
const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const monday = new Date(now);
monday.setUTCDate(monday.getUTCDate() - daysToMon);
monday.setUTCHours(0, 0, 0, 0);
const formatDate = (d) => d.toISOString().split("T")[0];
const argFrom = process.argv[2] || formatDate(monday);
const argTo = process.argv[3] || formatDate(now);

console.log(`\n\u{1F4C5} \u{1D13B}\u{1D13B}\u{1D13B}\u{1D13B}: ${argFrom} \u2014 ${argTo}`);

function createHttpClient(baseURL) {
  const jar = new CookieJar();
  return wrapper(axios.create({ baseURL, jar, withCredentials: true, timeout: 90000 }));
}

async function authenticate(client) {
  const hash = crypto.createHash("sha1").update(String(IIKO_PASSWORD || "")).digest("hex");
  const resp = await client.get("/resto/api/auth", {
    params: { login: IIKO_USER, pass: hash },
    responseType: "text",
    transformResponse: [(d) => d],
    timeout: 15000,
  });
  const key = String(resp.data || "").trim().replace(/^"+|"+$/g, "");
  if (!key) throw new Error("Нет key от iiko");
  client.__iikoKey = key;
}

function buildServerBody(body) {
  const storeIds = (body.storeIds || []).map(String).filter(Boolean);
  const calcFields = body.calculatedFields || [];
  const aggregateFields = calcFields
    .map((f) => { const m = String(f?.formula || "").match(/^\[([^\]]+)\]$/); return m?.[1] || null; })
    .filter(Boolean);
  const filters = {};
  if (storeIds.length) filters["Department.Id"] = { filterType: "IncludeValues", values: storeIds };
  for (const f of body.filters || []) {
    if (!f?.field) continue;
    if (String(f.filterType || "").toLowerCase() === "date_range") {
      filters[f.field] = {
        filterType: "DateRange", periodType: "CUSTOM",
        from: String(f.dateFrom || "").replace(/\.\d{3}/g, "").replace(/Z$/i, ""),
        to:   String(f.dateTo   || "").replace(/\.\d{3}/g, "").replace(/Z$/i, ""),
        includeLow: f.includeLeft ?? true, includeHigh: f.includeRight ?? false,
      };
    }
  }
  return { reportType: body.olapType || "SALES", buildSummary: true, groupByRowFields: body.groupFields || [], groupByColFields: [], aggregateFields, filters };
}

function parseServerRows(result, body) {
  if (Array.isArray(result?.data)) {
    const aliasMap = new Map();
    for (const f of body.calculatedFields || []) {
      const m = String(f?.formula || "").match(/^\[([^\]]+)\]$/);
      if (m?.[1] && f?.name) aliasMap.set(m[1], f.name);
    }
    return result.data.map((row) => {
      const out = { ...row };
      for (const [actual, alias] of aliasMap.entries()) {
        if (out[alias] === undefined && row[actual] !== undefined) out[alias] = row[actual];
      }
      return out;
    });
  }
  if (result?.result?.rawData) return result.result.rawData;
  return [];
}

async function pollOlap(client, body) {
  const resp = await client.post("/resto/api/v2/reports/olap", buildServerBody(body), {
    params: client.__iikoKey ? { key: client.__iikoKey } : {},
    headers: { "Content-Type": "application/json" },
  });
  return resp.data;
}

function nf(v) { return String(v ?? "").trim().toUpperCase(); }
function isOrderDeleted(v) { const f = nf(v); return f === "DELETED" || f === "ORDER_DELETED"; }
function isStorned(v) { if (v === true || v === 1) return true; const f = nf(v); return f === "TRUE" || f === "YES" || f === "1"; }
function isItemDeletion(v) { const f = nf(v); return Boolean(f) && f !== "NOT_DELETED"; }

function aggregateOrders(rows, excludeItemDeletion) {
  const map = new Map();
  for (const row of rows) {
    const id = row["UniqOrderId.Id"] || `${row.OrderNum || "NA"}|${row.OpenTime || ""}`;
    if (!map.has(id)) map.set(id, { sales: 0, disc: 0, del: false, sto: false, cc: false, itd: false });
    const o = map.get(id);
    o.sales += Number(row.Sales) || 0;
    o.disc  += Number(row.DiscountSum) || 0;
    o.del = o.del || isOrderDeleted(row.OrderDeleted);
    o.sto = o.sto || isStorned(row.Storned);
    o.cc  = o.cc  || Boolean(String(row["Delivery.CancelCause"] || "").trim());
    o.itd = o.itd || isItemDeletion(row.DeletedWithWriteoff);
  }

  const stats = { total: map.size, del: 0, sto: 0, cc: 0, itd: 0, canceled: 0, active: 0 };
  let revenue = 0, disc = 0, orders = 0;

  for (const o of map.values()) {
    if (o.del) stats.del++;
    if (o.sto) stats.sto++;
    if (o.cc)  stats.cc++;
    if (o.itd) stats.itd++;
    const canceled = o.del || o.sto || o.cc || (excludeItemDeletion && o.itd);
    if (canceled) { stats.canceled++; continue; }
    stats.active++;
    revenue += o.sales;
    disc    += o.disc;
    orders++;
  }

  return {
    revenue: Math.round(revenue * 100) / 100,
    orders,
    avg: orders > 0 ? Math.round(revenue / orders * 100) / 100 : 0,
    disc: Math.round(disc * 100) / 100,
    stats,
  };
}

async function resolveStoreId(orgId) {
  try {
    const resp = await axios.get(`${BACKEND_URL}/api/organizations`);
    const orgs = resp.data?.data || resp.data?.organizations || resp.data || [];
    const org = Array.isArray(orgs) ? orgs.find((o) => String(o.id) === String(orgId)) : null;
    return org?.serverStoreId || org?.storeId || org?.iikoId || null;
  } catch { return null; }
}

async function queryBackend(orgId, dateFrom, dateTo) {
  try {
    const resp = await axios.get(`${BACKEND_URL}/api/revenue/report`, {
      params: { organizationId: orgId, startDate: dateFrom, endDate: dateTo }, timeout: 120000,
    });
    const s = resp.data?.summary || resp.data?.data?.summary || {};
    return { orders: s.totalOrders, revenue: s.totalRevenue, avg: s.avgPerOrder, disc: s.discountSum, stats: s.orderStats };
  } catch (e) { return { error: e.message }; }
}

function fmt(v) {
  if (v == null) return "N/A";
  return Number(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  for (const org of ORGS) {
    console.log(`\n${"=".repeat(65)}`);
    console.log(`org: ${org.name}  ${org.id}`);
    console.log(`${"=".repeat(65)}`);

    const storeId = await resolveStoreId(org.id);
    if (!storeId) { console.log("storeId not found"); continue; }
    console.log(`storeId: ${storeId}`);

    console.log("\nПрямой запрос к iiko...");
    let rows;
    try {
      const client = createHttpClient(SERVER_BASE_URL);
      await authenticate(client);
      const endShifted = new Date(argTo);
      endShifted.setUTCDate(endShifted.getUTCDate() + 1);
      const body = {
        storeIds: [storeId],
        olapType: "SALES",
        groupFields: ["OpenDate.Typed","OrderType","UniqOrderId.Id","OrderDeleted","Storned","DeletedWithWriteoff","Delivery.CancelCause"],
        calculatedFields: [
          { name: "Sales",                   formula: "[DishDiscountSumInt.withoutVAT]" },
          { name: "UniqOrderId.OrdersCount", formula: "[UniqOrderId.OrdersCount]" },
          { name: "RevenueWithoutDiscount",  formula: "[DishSumInt]" },
          { name: "DiscountSum",             formula: "[DiscountSum]" },
        ],
        filters: [{ field: "OpenDate.Typed", filterType: "date_range", dateFrom: `${argFrom}T00:00:00`, dateTo: `${formatDate(endShifted)}T00:00:00`, includeLeft: true, includeRight: false }],
        includeVoidTransactions: true, includeNonBusinessPaymentTypes: true,
      };
      const raw = await pollOlap(client, body);
      rows = parseServerRows(raw, body);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      continue;
    }

    const buggy   = aggregateOrders(rows, true);
    const correct = aggregateOrders(rows, false);

    console.log(`\nСырые данные из iiko:`);
    console.log(`  Строк OLAP:           ${rows.length}`);
    console.log(`  Уникальных заказов:   ${buggy.stats.total}`);
    console.log(`  Флаги отмены:`);
    console.log(`    OrderDeleted:   ${buggy.stats.del}`);
    console.log(`    Storned:        ${buggy.stats.sto}`);
    console.log(`    CancelCause:    ${buggy.stats.cc}`);
    console.log(`    ItemDeletion:   ${buggy.stats.itd}  <-- DeletedWithWriteoff (позиция удалена, не весь заказ)`);

    console.log(`\n[БАГОВЫЙ вариант — текущий бекенд, excludeItemDeletion=true]:`);
    console.log(`  Заказов:   ${buggy.orders}   (отменено: ${buggy.stats.canceled})`);
    console.log(`  Выручка:   ${fmt(buggy.revenue)}`);
    console.log(`  Ср. чек:   ${fmt(buggy.avg)}`);
    console.log(`  Скидки:    ${fmt(buggy.disc)}`);

    console.log(`\n[ПРАВИЛЬНЫЙ вариант — excludeItemDeletion=false]:`);
    console.log(`  Заказов:   ${correct.orders}   (отменено: ${correct.stats.canceled})`);
    console.log(`  Выручка:   ${fmt(correct.revenue)}`);
    console.log(`  Ср. чек:   ${fmt(correct.avg)}`);
    console.log(`  Скидки:    ${fmt(correct.disc)}`);

    console.log(`\nРазница из-за бага (ПРАВИЛЬНЫЙ - БАГОВЫЙ):`);
    console.log(`  Заказов: +${correct.orders - buggy.orders}`);
    console.log(`  Выручка: +${fmt(correct.revenue - buggy.revenue)}`);

    console.log("\nЗапрос через бекенд...");
    const backend = await queryBackend(org.id, argFrom, argTo);
    if (backend.error) { console.log(`ERROR: ${backend.error}`); continue; }

    console.log(`\nБекенд /revenue/report:`);
    console.log(`  Заказов:   ${backend.orders}`);
    console.log(`  Выручка:   ${fmt(backend.revenue)}`);
    console.log(`  Ср. чек:   ${fmt(backend.avg)}`);
    console.log(`  Скидки:    ${fmt(backend.disc)}`);
    if (backend.stats) console.log(`  Stats:     ${JSON.stringify(backend.stats)}`);

    const ordDiff  = (backend.orders || 0) - buggy.orders;
    const ordDiff2 = (backend.orders || 0) - correct.orders;
    console.log(`\nСверка:`);
    console.log(`  Бекенд == БАГОВЫЙ?    заказов delta=${ordDiff}  ${ordDiff === 0 ? "YES (оба применяют одинаковый баг)" : "NO"}`);
    console.log(`  Бекенд == ПРАВИЛЬНЫЙ? заказов delta=${ordDiff2} ${ordDiff2 === 0 ? "YES" : "NO"}`);
  }
}

main().catch(console.error);
