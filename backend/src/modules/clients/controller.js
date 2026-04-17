const clientsService = require("./service");

class ClientsController {
  async getClients(req, res) {
    try {
      const { organizationId, dateFrom, dateTo } = req.query;

      if (!organizationId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Обязательные параметры: organizationId, dateFrom, dateTo" });
      }

      const data = await clientsService.getClients({ organizationId, dateFrom, dateTo });
      return res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("❌ ClientsController.getClients:", error);
      return res.status(500).json({ error: "Ошибка получения клиентской базы", message: error.message });
    }
  }
}

module.exports = new ClientsController();
