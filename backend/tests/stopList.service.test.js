const test = require("node:test");
const assert = require("node:assert/strict");

const { stopListService } = require("../src/modules/stopList/service");
const { IikoService } = require("../src/modules/stopList/iikoService");
const snapshotRepository = require("../src/modules/stopList/snapshotRepository");

test("enrichEntityNames заменяет технический UUID на читаемое название из меню", () => {
  const items = [
    {
      id: "org-1:tg-1:product:dish-1",
      organizationId: "org-1",
      entityId: "dish-1",
      entityType: "product",
      entityName: "dish-1",
    },
  ];

  const index = {
    products: new Map([["dish-1", "Пицца Маргарита"]]),
    modifiers: new Map(),
    groups: new Map(),
  };

  const [result] = stopListService.enrichEntityNames(items, index);

  assert.equal(result.entityName, "Пицца Маргарита");
  assert.equal(result.nameSource, "menu");
});

test("enrichEstimatedLostRevenue сопоставляет позиции при разном регистре и лишних пробелах", () => {
  const items = [
    {
      id: "org-1:tg-1:product:dish-1",
      organizationId: "org-1",
      entityId: "dish-1",
      entityName: "Пицца Маргарита",
      isInStop: true,
      inStopHours: 2.5,
    },
  ];

  const revenueIndex = new Map([
    [
      "org-1",
      {
        byEntityId: new Map(),
        byName: new Map([[stopListService._normalizeKey("  Пицца    Маргарита "), 120]]),
      },
    ],
  ]);

  const [result] = stopListService.enrichEstimatedLostRevenue(items, revenueIndex);

  assert.equal(result.avgRevenuePerHour, 120);
  assert.equal(result.estimatedLostRevenue, 300);
});

test("menu v2 external menu маппит itemSizes.itemId на читаемое название блюда", () => {
  const iikoService = new IikoService();
  const maps = iikoService._collectNomenclatureEntityMaps({
    itemCategories: [
      {
        id: "cat-1",
        name: "Пиццы",
        items: [
          {
            id: "parent-item-1",
            name: "Пепперони",
            itemSizes: [
              {
                id: "size-1",
                itemId: "ffeb06bc-a604-441d-9402-d14609f3a63a",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(maps.products.get("ffeb06bc-a604-441d-9402-d14609f3a63a"), "Пепперони");
});

test("appendSnapshots обновляет активный инцидент, а не хранит устаревшую оценку потерь", async () => {
  const originalReadAll = snapshotRepository.readAll.bind(snapshotRepository);
  const originalWriteAll = snapshotRepository.writeAll.bind(snapshotRepository);

  let storedItems = [
    {
      id: "org-1:tg-1:product:dish-1",
      orgId: "org-1",
      entityId: "dish-1",
      entityName: "Старое имя",
      startedAt: "2026-04-18T10:00:00.000Z",
      endedAt: null,
      inStopHours: 1,
      estimatedLostRevenue: 100,
      capturedAt: "2026-04-18T11:00:00.000Z",
    },
  ];

  snapshotRepository.readAll = async () => JSON.parse(JSON.stringify(storedItems));
  snapshotRepository.writeAll = async (items) => {
    storedItems = JSON.parse(JSON.stringify(items));
    return items;
  };

  try {
    const added = await snapshotRepository.appendSnapshots(
      [
        {
          id: "org-1:tg-1:product:dish-1",
          organizationId: "org-1",
          entityId: "dish-1",
          entityName: "Пицца Маргарита",
          startedAt: "2026-04-18T10:00:00.000Z",
          endedAt: null,
          inStopHours: 3,
          estimatedLostRevenue: 450,
        },
      ],
      "2026-04-18T13:00:00.000Z",
    );

    assert.equal(added, 0);
    assert.equal(storedItems.length, 1);
    assert.equal(storedItems[0].entityName, "Пицца Маргарита");
    assert.equal(storedItems[0].inStopHours, 3);
    assert.equal(storedItems[0].estimatedLostRevenue, 450);
    assert.equal(storedItems[0].capturedAt, "2026-04-18T13:00:00.000Z");
  } finally {
    snapshotRepository.readAll = originalReadAll;
    snapshotRepository.writeAll = originalWriteAll;
  }
});
