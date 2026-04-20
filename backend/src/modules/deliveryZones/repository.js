const fs = require("fs/promises");
const path = require("path");

const ZONES_FILE_PATH = path.resolve(__dirname, "../../../data/deliveryZones.json");

class DeliveryZonesRepository {
  async read() {
    try {
      const raw = await fs.readFile(ZONES_FILE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
  }

  async write(store) {
    await fs.writeFile(ZONES_FILE_PATH, JSON.stringify(store || {}, null, 2), "utf8");
  }
}

module.exports = new DeliveryZonesRepository();
