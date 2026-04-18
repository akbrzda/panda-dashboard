const test = require("node:test");
const assert = require("node:assert/strict");

const reportsController = require("../src/modules/reports/controller");
const deliveryDomain = require("../src/modules/reports/domains/delivery");
const marketingDomain = require("../src/modules/reports/domains/marketing");

function createMockResponse() {
  return {
    statusCode: 200,
    jsonPayload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };
}

test("reports controller: getDeliverySummary -> domain -> success response contract", async () => {
  const originalGetDeliverySummary = deliveryDomain.getDeliverySummary;
  const capturedCalls = [];

  deliveryDomain.getDeliverySummary = async (params) => {
    capturedCalls.push(params);
    return {
      summary: {
        totalOrders: 42,
      },
    };
  };

  try {
    const req = {
      body: {
        organizationId: "org-1",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
      },
    };
    const res = createMockResponse();

    await reportsController.getDeliverySummary(req, res);

    assert.equal(capturedCalls.length, 1);
    assert.deepEqual(capturedCalls[0], {
      organizationId: "org-1",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-07",
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.success, true);
    assert.equal(res.jsonPayload.meta.report, "delivery-summary");
    assert.deepEqual(res.jsonPayload.data.summary, {
      totalOrders: 42,
    });
  } finally {
    deliveryDomain.getDeliverySummary = originalGetDeliverySummary;
  }
});

test("reports controller: getDeliverySummary returns validation error contract", async () => {
  const req = {
    body: {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-07",
    },
  };
  const res = createMockResponse();

  await reportsController.getDeliverySummary(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonPayload.success, false);
  assert.equal(res.jsonPayload.error.code, "VALIDATION_ERROR");
  assert.equal(res.jsonPayload.meta.report, "delivery-summary");
});

test("reports controller: getMarketingSources returns internal error contract", async () => {
  const originalGetMarketingSources = marketingDomain.getMarketingSources;
  const originalConsoleError = console.error;

  marketingDomain.getMarketingSources = async () => {
    throw new Error("boom");
  };
  console.error = () => {};

  try {
    const req = {
      body: {
        organizationId: "org-2",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
      },
    };
    const res = createMockResponse();

    await reportsController.getMarketingSources(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.jsonPayload.success, false);
    assert.equal(res.jsonPayload.error.code, "INTERNAL_ERROR");
    assert.equal(res.jsonPayload.meta.report, "marketing-sources");
  } finally {
    marketingDomain.getMarketingSources = originalGetMarketingSources;
    console.error = originalConsoleError;
  }
});
