const test = require("node:test");
const assert = require("node:assert/strict");

const topDishesService = require("../src/modules/topDishes/service");

test("buildAbcReportFromDishes classifies dishes by cumulative Pareto share", () => {
  const dataset = {
    dishes: [
      { name: "A", category: "Main", revenue: 80, qty: 8 },
      { name: "B", category: "Main", revenue: 15, qty: 3 },
      { name: "C", category: "Dessert", revenue: 5, qty: 1 },
    ],
    totalRevenue: 100,
    degraded: false,
  };

  const result = topDishesService.buildAbcReportFromDishes(dataset, {
    abcGroup: "all",
    page: 1,
    limit: 50,
  });

  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].abcGroup, "A");
  assert.equal(result.items[1].abcGroup, "B");
  assert.equal(result.items[2].abcGroup, "C");

  assert.equal(result.summary.countA, 1);
  assert.equal(result.summary.countB, 1);
  assert.equal(result.summary.countC, 1);
  assert.equal(result.summary.groupAShare, 0.8);
});

test("buildAbcReportFromDishes applies abcGroup filter and pagination", () => {
  const dataset = {
    dishes: [
      { name: "Dish 1", category: "Main", revenue: 60, qty: 6 },
      { name: "Dish 2", category: "Main", revenue: 30, qty: 3 },
      { name: "Dish 3", category: "Main", revenue: 10, qty: 2 },
    ],
    totalRevenue: 100,
  };

  const result = topDishesService.buildAbcReportFromDishes(dataset, {
    abcGroup: "b",
    page: 1,
    limit: 10,
  });

  assert.equal(result.filters.abcGroup, "B");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Dish 2");
  assert.equal(result.pagination.filteredTotal, 1);
  assert.equal(result.pagination.total, 3);
});
