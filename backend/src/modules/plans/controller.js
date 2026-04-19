const plansService = require("./service");

class PlansController {
  async getPlans(req, res) {
    try {
      const plans = await plansService.listPlans(req.query || {});
      return res.json({ success: true, data: plans });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Ошибка загрузки планов" });
    }
  }

  async createPlan(req, res) {
    try {
      const plan = await plansService.createPlan(req.body || {});
      return res.status(201).json({ success: true, data: plan });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Ошибка создания плана" });
    }
  }

  async updatePlan(req, res) {
    try {
      const plan = await plansService.updatePlan(req.params.id, req.body || {});
      return res.json({ success: true, data: plan });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Ошибка обновления плана" });
    }
  }

  async deletePlan(req, res) {
    try {
      const plan = await plansService.deletePlan(req.params.id);
      return res.json({ success: true, data: plan });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Ошибка удаления плана" });
    }
  }

  async buildMonthlyRevenueDistribution(req, res) {
    try {
      const result = await plansService.buildMonthlyRevenueDistribution(req.body || {});
      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Ошибка расчета месячного плана" });
    }
  }
}

module.exports = new PlansController();
