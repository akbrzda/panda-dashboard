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
