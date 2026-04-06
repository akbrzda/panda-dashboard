/**
 * OLAP Query Builder - построение OLAP запросов
 */
class OlapBuilder {
  buildReportQuery(restaurantId, shiftStart, shiftEnd, groupByDiscountType = false) {
    const baseGroupFields = [
      "Department.Code",
      "OrderType",
      "OrderNum",
      "UniqOrderId.Id",
      "OrderDeleted",
      "Storned",
      "DeletedWithWriteoff",
      "Delivery.CancelCause",
      "Delivery.CancelComment",
      "OpenTime",
      "CloseTime",
    ];
    const groupFields = groupByDiscountType ? [...baseGroupFields, "ItemSaleEventDiscountType"] : baseGroupFields;

    return {
      storeIds: [String(restaurantId)],
      olapType: "SALES",
      categoryFields: [],
      groupFields,
      stackByDataFields: false,
      dataFields: ["Sales", "UniqOrderId.OrdersCount", "RevenueWithoutDiscount", "DiscountSum"],
      calculatedFields: [
        { name: "Sales", title: "Sales", formula: "[DishDiscountSumInt.withoutVAT]", type: "MONEY", canSum: false },
        { name: "UniqOrderId.OrdersCount", title: "Orders", formula: "[UniqOrderId.OrdersCount]", type: "NUMERIC", canSum: true },
        { name: "RevenueWithoutDiscount", title: "Revenue", formula: "[DishSumInt]", type: "MONEY", canSum: true },
        { name: "DiscountSum", title: "Discount", formula: "[DiscountSum]", type: "MONEY", canSum: true },
      ],
      filters: [
        { field: "OpenDate.Typed", filterType: "date_range", dateFrom: shiftStart, dateTo: shiftEnd, includeLeft: true, includeRight: false },
      ],
      includeVoidTransactions: true,
      includeNonBusinessPaymentTypes: true,
    };
  }
}

module.exports = new OlapBuilder();
