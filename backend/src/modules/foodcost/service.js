const OlapClient = require("../shared/olapClient");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class FoodcostService extends OlapClient {
  async getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo }) {
    const [current, lfl] = await Promise.all([
      this.getFoodcostForPeriod({ organizationId, dateFrom, dateTo }),
      lflDateFrom && lflDateTo
        ? this.getFoodcostForPeriod({ organizationId, dateFrom: lflDateFrom, dateTo: lflDateTo }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const calcLFL = (cur, prev) => (cur != null && prev != null && prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null);

    return {
      ...current,
      lfl: calcLFL(current.percent, lfl?.percent),
      lflPeriod: lfl ? { startDate: lflDateFrom, endDate: lflDateTo } : null,
    };
  }

  async getFoodcostForPeriod({ organizationId, dateFrom, dateTo }) {
    const storeId = await this.resolveStoreId(organizationId);

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["ProductCategory"],
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
      return await this.pollOlap(client, delay, body);
    });

    const rows = this.parseResultRows(result, (group, values) => ({
      ...group,
      Sales: parseFloat(values[0]) || 0,
      ProductCost: parseFloat(values[1]) || 0,
    }));

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

    return {
      percent,
      costSum: totalCost,
      revenue: totalRevenue,
      status,
      categories,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    };
  }
}

module.exports = new FoodcostService();
