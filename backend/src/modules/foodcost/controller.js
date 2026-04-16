const foodcostService = require("./service");

class FoodcostController {
  async getFoodcost(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await foodcostService.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ FoodcostController.getFoodcost:", error);
      return res.status(500).json({ error: "Ошибка получения фудкоста", message: error.message });
    }
  }
}

module.exports = new FoodcostController();
