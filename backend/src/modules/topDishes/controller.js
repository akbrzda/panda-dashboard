const topDishesService = require("./service");

class TopDishesController {
  async getTopDishes(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, limit } = req.body;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: dateFrom, dateTo" });
      }

      const data = await topDishesService.getTopDishes({ organizationId, dateFrom, dateTo, limit: limit ? Number(limit) : 20 });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ TopDishesController.getTopDishes:", error);
      return res.status(500).json({ error: "Ошибка получения топ блюд", message: error.message });
    }
  }
}

module.exports = new TopDishesController();
