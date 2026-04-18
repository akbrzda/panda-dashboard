const test = require("node:test");
const assert = require("node:assert/strict");

const { buildHourlySalesReport, buildOperationalSummary } = require("../src/modules/reports/services/salesReports");

function roundMetric(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

test("buildHourlySalesReport aggregates hourly and weekday summaries", () => {
  const orders = [
    { orderId: "o-1", hour: 10, weekdayIndex: 1, date: "2026-04-13", revenue: 100 },
    { orderId: "o-2", hour: 10, weekdayIndex: 1, date: "2026-04-13", revenue: 50 },
    { orderId: "o-3", hour: 11, weekdayIndex: 2, date: "2026-04-14", revenue: 70 },
  ];

  const ctx = {
    toOrderEntities: (rows) => rows,
    roundMetric,
  };

  const report = buildHourlySalesReport(orders, "Europe/Moscow", ctx);

  assert.equal(report.summary.totalRevenue, 220);
  assert.equal(report.summary.totalOrders, 3);

  const hour10 = report.hourly.find((item) => item.hour === 10);
  const hour11 = report.hourly.find((item) => item.hour === 11);
  assert.equal(hour10.revenue, 150);
  assert.equal(hour10.orders, 2);
  assert.equal(hour11.revenue, 70);
  assert.equal(hour11.orders, 1);

  const monday = report.weekdaySummary.find((item) => item.weekdayIndex === 1);
  assert.equal(monday.daysCount, 1);
  assert.equal(monday.totalOrders, 2);
  assert.equal(monday.totalRevenue, 150);
});

test("buildOperationalSummary deduplicates orders and calculates averages", () => {
  const rows = [
    {
      "UniqOrderId.Id": "order-1",
      Sales: 100,
      "Delivery.WayDuration": 20,
      "OrderTime.AverageOrderTime": 0,
      "OrderTime.OrderLength": 30,
      OpenTime: "2026-04-15T10:00:00Z",
      "Delivery.CookingFinishTime": "2026-04-15T10:10:00Z",
      orderType: "delivery",
    },
    {
      "UniqOrderId.Id": "order-1",
      Sales: 20,
      "Delivery.WayDuration": 20,
      "OrderTime.AverageOrderTime": 0,
      "OrderTime.OrderLength": 30,
      OpenTime: "2026-04-15T10:00:00Z",
      "Delivery.CookingFinishTime": "2026-04-15T10:10:00Z",
      orderType: "delivery",
    },
    {
      "UniqOrderId.Id": "order-2",
      Sales: 80,
      "Delivery.WayDuration": 40,
      "OrderTime.AverageOrderTime": 50,
      "OrderTime.OrderLength": 60,
      OpenTime: "2026-04-15T11:00:00Z",
      "Delivery.CookingFinishTime": "2026-04-15T11:20:00Z",
      orderType: "delivery",
    },
  ];

  const ctx = {
    parseDateTime: (value) => {
      const ts = new Date(value).getTime();
      return Number.isFinite(ts) ? ts : null;
    },
    isDeliveryOrder: (row) => row.orderType === "delivery",
    roundMetric,
  };

  const summary = buildOperationalSummary(rows, ctx);

  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.totalRevenue, 200);
  assert.equal(summary.avgPerOrder, 100);
  assert.equal(summary.avgDeliveryTime, 35);
  assert.equal(summary.avgCookingTime, 15);
});
