const foodcostService = require("./service");

class FoodcostController {
  isTemporaryNetworkError(error) {
    return (
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.code) ||
      [429, 500, 502, 503, 504].includes(error?.response?.status) ||
      /IIKO временно недоступен|разорвал соединение/i.test(error?.message || "")
    );
  }

  async getFoodcost(req, res) {
    try {
      const { organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo } = req.body;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await foodcostService.getFoodcost({ organizationId, dateFrom, dateTo, lflDateFrom, lflDateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      const status = this.isTemporaryNetworkError(error) ? 503 : 500;
      const message = status === 503 ? "IIKO временно недоступен, попробуйте повторить запрос" : "Ошибка получения фудкоста";

      console.error("❌ FoodcostController.getFoodcost:", error);
      return res.status(status).json({ error: message, message: error.message });
    }
  }
}

module.exports = new FoodcostController();
