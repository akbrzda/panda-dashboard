const test = require("node:test");
const assert = require("node:assert/strict");

const orderRules = require("../src/modules/shared/orderRules");

test("orderRules normalizes statuses to canonical delivery dictionary", () => {
  assert.equal(orderRules.getCanonicalDeliveryStatus("Closed"), "Завершен");
  assert.equal(orderRules.getCanonicalDeliveryStatus("Cancelled"), "Отменен");
  assert.equal(orderRules.getCanonicalDeliveryStatus("OnWay"), "В пути");
  assert.equal(orderRules.getCanonicalDeliveryStatus("UnknownStatus"), "Прочие");
});

test("orderRules calculates late summary with comparable orders only", () => {
  const summary = orderRules.calculateLateOrdersSummary(
    [
      { promisedAt: 1000, actualDeliveryAt: 2000 },
      { promisedAt: 1000, actualDeliveryAt: 1000 },
      { promisedAt: null, actualDeliveryAt: 1000 },
    ],
    {
      round: (value) => Math.round(value * 100) / 100,
    },
  );

  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.comparableOrders, 2);
  assert.equal(summary.excludedOrders, 1);
  assert.equal(summary.lateOrders, 1);
  assert.equal(summary.lateRate, 50);
});

test("orderRules calculates discount percent from gross revenue", () => {
  const metrics = orderRules.calculateDiscountMetrics(
    {
      netRevenue: 900,
      revenueBeforeDiscount: 1000,
      discountSum: 100,
    },
    (value) => Math.round(value * 100) / 100,
  );

  assert.equal(metrics.discountSum, 100);
  assert.equal(metrics.discountPercent, 10);
});
