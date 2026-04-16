const topDishesService = require("./service");

class TopDishesController {
  isTemporaryNetworkError(error) {
    return (
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.code) ||
      [429, 500, 502, 503, 504].includes(error?.response?.status)
    );
  }

  async getTopDishes(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, limit } = req.body;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: dateFrom, dateTo" });
      }

      const data = await topDishesService.getTopDishes({ organizationId, dateFrom, dateTo, limit: limit ? Number(limit) : 20 });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      const status = this.isTemporaryNetworkError(error) ? 503 : 500;
      const message = status === 503 ? "IIKO временно недоступен, попробуйте повторить запрос" : "Ошибка получения топ блюд";

      console.error("❌ TopDishesController.getTopDishes:", error);
      return res.status(status).json({ error: message, message: error.message });
    }
  }
}

module.exports = new TopDishesController();
