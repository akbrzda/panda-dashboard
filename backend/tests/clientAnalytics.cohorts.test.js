const test = require("node:test");
const assert = require("node:assert/strict");

const clientAnalyticsService = require("../src/modules/clientAnalytics/service");

test("classifyByAccountCreatedTimestamp marks new and returning by registration date", () => {
  const filters = {
    from: new Date("2026-04-01T00:00:00Z"),
    to: new Date("2026-04-30T23:59:59Z"),
  };

  const registeredInPeriod = clientAnalyticsService.classifyByAccountCreatedTimestamp(new Date("2026-04-10T10:00:00Z").getTime(), filters);
  assert.equal(registeredInPeriod.isNew, true);
  assert.equal(registeredInPeriod.isReturning, false);

  const registeredBeforePeriod = clientAnalyticsService.classifyByAccountCreatedTimestamp(new Date("2026-03-15T10:00:00Z").getTime(), filters);
  assert.equal(registeredBeforePeriod.isNew, false);
  assert.equal(registeredBeforePeriod.isReturning, true);
});

test("recalculateClientCohorts disables returning detection when OLAP registration is unavailable", () => {
  const filters = {
    from: new Date("2026-04-01T00:00:00Z"),
    to: new Date("2026-04-30T23:59:59Z"),
  };

  const clients = [
    {
      clientKey: "79990000001",
      ordersCount: 3,
      isNew: false,
      isReturning: true,
      isSleeping: false,
      segment: "returning",
      accountCreatedAt: null,
      cohortSource: "heuristic",
    },
  ];

  const result = clientAnalyticsService.recalculateClientCohorts(clients, filters, {
    accountCreatedMap: new Map(),
    source: "olap-server",
    disableReturningDetection: true,
  });

  assert.equal(result.clients[0].isReturning, false);
  assert.equal(result.meta.returningDetectionEnabled, false);
  assert.equal(result.meta.resolvedByAccountCreated, 0);
  assert.equal(result.meta.unresolved, 1);
});
