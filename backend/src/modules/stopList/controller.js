const { stopListService, IikoApiError } = require("./service");

class StopListController {
  async getStopLists(req, res) {
    try {
      const payload = await stopListService.getStopLists(req.query || {});
      return res.json(payload);
    } catch (error) {
      if (error instanceof IikoApiError) {
        const status = error.status ?? 502;
        return res.status(status).json({
          success: false,
          error: error.message,
          status,
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message ?? "Unexpected server error.",
      });
    }
  }
}

module.exports = new StopListController();
