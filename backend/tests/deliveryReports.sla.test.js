const test = require("node:test");
const assert = require("node:assert/strict");

const reportsService = require("../src/modules/reports/service");

test("SLA доставки корректно считается для cloud-заказов по временным меткам", () => {
  const orders = reportsService.normalizeCloudDeliveryOrders(
    {
      ordersByOrganizations: [
        {
          organizationId: "org-1",
          orders: [
            {
              id: "cloud-1",
              order: {
                id: "order-1",
                number: "101",
                status: "Closed",
                whenCreated: "2026-04-18T10:00:00.000Z",
                whenSended: "2026-04-18T10:20:00.000Z",
                whenDelivered: "2026-04-18T10:45:00.000Z",
                orderType: {
                  name: "Доставка",
                  orderServiceType: "DELIVERY_BY_COURIER",
                },
                courierInfo: {
                  courier: {
                    id: "courier-1",
                    name: "Тестовый курьер",
                  },
                },
              },
            },
          ],
        },
      ],
    },
    "Europe/Moscow",
  );

  const report = reportsService.buildSlaReport([], "Europe/Moscow", { preparedOrders: orders });

  assert.equal(report.summary.totalOrders, 1);
  assert.equal(report.funnel.created, 1);
  assert.equal(report.funnel.cooked, 1);
  assert.equal(report.funnel.dispatched, 1);
  assert.equal(report.funnel.delivered, 1);
  assert.equal(report.stageKpi.prep.avg, 20);
  assert.equal(report.stageKpi.route.avg, 25);
  assert.equal(report.stageKpi.total.avg, 45);
});

test("KPI курьеров не подменяет отсутствие времени в пути нулём", () => {
  const orders = reportsService.normalizeCloudDeliveryOrders(
    {
      ordersByOrganizations: [
        {
          organizationId: "org-1",
          orders: [
            {
              id: "cloud-2",
              order: {
                id: "order-2",
                number: "102",
                status: "Closed",
                whenCreated: "2026-04-18T11:00:00.000Z",
                whenDelivered: "2026-04-18T11:42:00.000Z",
                orderType: {
                  name: "Доставка",
                  orderServiceType: "DELIVERY_BY_COURIER",
                },
                courierInfo: {
                  courier: {
                    id: "courier-2",
                    name: "Курьер без route-метки",
                  },
                },
              },
            },
          ],
        },
      ],
    },
    "Europe/Moscow",
  );

  const report = reportsService.buildCourierKpiReport([], "Europe/Moscow", { preparedOrders: orders });

  assert.equal(report.summary.totalCouriers, 1);
  assert.equal(report.couriers[0].avgRouteMinutes, null);
  assert.equal(report.couriers[0].avgTotalMinutes, 42);
});

test("KPI курьеров считает late только по promised/actual timestamp", () => {
  const report = reportsService.buildCourierKpiReport(
    [],
    "Europe/Moscow",
    {
      preparedOrders: [
        {
          orderId: "order-late",
          orderType: "Доставка",
          orderServiceType: "DELIVERY_BY_COURIER",
          courierId: "courier-1",
          courierName: "Курьер 1",
          revenue: 100,
          totalMinutes: 80,
          promisedAt: new Date("2026-04-18T10:30:00.000Z").getTime(),
          actualDeliveryAt: new Date("2026-04-18T10:45:00.000Z").getTime(),
          hour: 13,
        },
        {
          orderId: "order-unknown",
          orderType: "Доставка",
          orderServiceType: "DELIVERY_BY_COURIER",
          courierId: "courier-1",
          courierName: "Курьер 1",
          revenue: 100,
          totalMinutes: 120,
          promisedAt: null,
          actualDeliveryAt: null,
          hour: 14,
        },
      ],
    },
  );

  assert.equal(report.summary.totalOrders, 2);
  assert.equal(report.summary.comparableOrders, 1);
  assert.equal(report.summary.excludedOrdersWithoutTimestamps, 1);
  assert.equal(report.summary.lateOrders, 1);
  assert.equal(report.summary.violationRate, 100);
});

test("KPI курьеров исключает самовывоз и заказы в зале", () => {
  const report = reportsService.buildCourierKpiReport([], "Europe/Moscow", {
    preparedOrders: [
      {
        orderId: "delivery-1",
        orderType: "Доставка",
        orderServiceType: "DELIVERY_BY_COURIER",
        courierId: "courier-1",
        courierName: "Курьер 1",
        revenue: 1000,
      },
      {
        orderId: "pickup-1",
        orderType: "Самовывоз",
        orderServiceType: "DELIVERY_BY_CLIENT",
        courierId: "unknown",
        courierName: "Неизвестный курьер",
        revenue: 500,
      },
      {
        orderId: "hall-1",
        orderType: "В зале",
        orderServiceType: "COMMON",
        courierId: "unknown",
        courierName: "Неизвестный курьер",
        revenue: 300,
      },
    ],
  });

  assert.equal(report.summary.totalOrders, 1);
  assert.equal(report.summary.totalRevenue, 1000);
  assert.equal(report.summary.totalCouriers, 1);
  assert.equal(report.couriers[0].courierId, "courier-1");
});
