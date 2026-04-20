const topDishesService = require("../topDishes/service");

class AssortmentAnalyticsService {
  async getProductAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit, completedOnly = true }) {
    const report = await topDishesService.getMenuAbc({ organizationId, dateFrom, dateTo, abcGroup, page, limit });
    return {
      ...report,
      filters: { ...(report?.filters || {}), completedOnly },
    };
  }
}

module.exports = new AssortmentAnalyticsService();
