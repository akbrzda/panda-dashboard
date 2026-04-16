const OlapClient = require("../shared/olapClient");
const { buildOlapBounds, toMoscowDateStr } = require("../../utils/dateUtils");

class TopDishesService extends OlapClient {
  async getTopDishes({ organizationId, dateFrom, dateTo, limit = 20 }) {
    const storeId = await this.resolveStoreId(organizationId);

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const { startIso, endIso } = buildOlapBounds(toMoscowDateStr(start), toMoscowDateStr(end));

    const result = await this.withAuth(storeId, async (client, delay) => {
      const body = {
        storeIds: [String(storeId)],
        olapType: "SALES",
        categoryFields: [],
        groupFields: ["Dish.Name", "ProductCategory"],
        stackByDataFields: false,
        dataFields: ["Sales", "DishAmountInt", "UniqOrderId.OrdersCount"],
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
            name: "DishAmountInt",
            title: "Количество блюд",
            description: "Количество проданных порций",
            formula: "[DishAmountInt]",
            type: "NUMERIC",
            canSum: true,
          },
          {
            name: "UniqOrderId.OrdersCount",
            title: "Orders Count",
            description: "Number of unique orders",
            formula: "[UniqOrderId.OrdersCount]",
            type: "NUMERIC",
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

    const rawRows = [];
    if (result.result?.rawData) {
      rawRows.push(...result.result.rawData);
    } else if (result.cells) {
      for (const [key, values] of Object.entries(result.cells)) {
        const group = JSON.parse(key);
        rawRows.push({
          ...group,
          Sales: parseFloat(values[0]) || 0,
          DishAmountInt: parseInt(values[1]) || 0,
          "UniqOrderId.OrdersCount": parseInt(values[2]) || 0,
        });
      }
    }

    const byDish = {};
    let totalRevenue = 0;
    let totalQty = 0;

    for (const row of rawRows) {
      const name = row["Dish.Name"] || row.DishName || row.Dish || "Неизвестно";
      const category = row.ProductCategory || row.Category || "";
      const revenue = Number(row.Sales) || 0;
      const qty = Number(row.DishAmountInt) || 0;

      if (!byDish[name]) byDish[name] = { name, category, revenue: 0, qty: 0 };
      byDish[name].revenue += revenue;
      byDish[name].qty += qty;
      byDish[name].category = category || byDish[name].category;
      totalRevenue += revenue;
      totalQty += qty;
    }

    const dishes = Object.values(byDish).map((dish) => ({
      ...dish,
      avgPrice: dish.qty > 0 ? Math.round((dish.revenue / dish.qty) * 100) / 100 : 0,
      revenueShare: totalRevenue > 0 ? Math.round((dish.revenue / totalRevenue) * 10000) / 100 : 0,
    }));

    dishes.sort((a, b) => b.revenue - a.revenue);

    const top = dishes.slice(0, limit);
    const withQty = dishes.filter((dish) => dish.qty > 0);
    const outsiders = withQty.slice(-Math.min(limit, withQty.length)).reverse();

    return {
      top,
      outsiders,
      total: dishes.length,
      totalRevenue,
      totalQty,
    };
  }
}

module.exports = new TopDishesService();
