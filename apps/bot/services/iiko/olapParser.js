/**
 * OLAP Data Parser - парсинг ответов OLAP
 */

const EXCLUDED_DISCOUNT_TYPES = ["PremiumBonus", "Premium Bonus"];

class OlapParser {
  parseOlapResponse(data, options = {}) {
    const { excludePremiumBonus = true } = options;
    const revenueByChannel = {};
    let totalRevenue = 0,
      totalOrders = 0,
      totalRevenueWithoutDiscount = 0;
    let totalDiscountSum = 0,
      premiumBonusDiscountSum = 0;

    const processRow = (orderType, discountType, sales, ordersCount, revenueWD, discountSum) => {
      revenueByChannel[orderType] = (revenueByChannel[orderType] || 0) + sales;
      totalRevenue += sales;
      totalOrders += ordersCount;
      totalRevenueWithoutDiscount += revenueWD;

      const isPremium = discountType && EXCLUDED_DISCOUNT_TYPES.some((e) => discountType.toLowerCase().includes(e.toLowerCase()));

      if (excludePremiumBonus && isPremium) {
        premiumBonusDiscountSum += discountSum;
      } else {
        totalDiscountSum += discountSum;
      }
    };

    if (data.result?.rawData) {
      for (const row of data.result.rawData) {
        processRow(
          row.OrderType || "Unknown",
          row.ItemSaleEventDiscountType,
          row.Sales || 0,
          row["UniqOrderId.OrdersCount"] || row.OrdersCount || 0,
          row.RevenueWithoutDiscount || 0,
          row.DiscountSum || 0
        );
      }
    } else if (data.cells) {
      for (const [key, values] of Object.entries(data.cells)) {
        const g = JSON.parse(key);
        processRow(
          g.OrderType || "Unknown",
          g.ItemSaleEventDiscountType,
          parseFloat(values[0]) || 0,
          parseInt(values[1]) || 0,
          parseFloat(values[2]) || 0,
          parseFloat(values[3]) || 0
        );
      }
    }

    const avgPerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const discountPercent = totalRevenueWithoutDiscount > 0 ? (totalDiscountSum / totalRevenueWithoutDiscount) * 100 : 0;

    return {
      revenueByChannel,
      totalRevenue,
      totalOrders,
      avgPerOrder,
      totalRevenueWithoutDiscount,
      discountPercent,
      discountSum: totalDiscountSum,
      premiumBonusDiscountSum,
    };
  }
}

module.exports = new OlapParser();
