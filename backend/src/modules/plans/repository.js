const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../..", "data", "plans.json");

class PlansRepository {
  async ensureStorage() {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

    try {
      await fs.access(DATA_FILE);
    } catch {
      await fs.writeFile(DATA_FILE, "[]\n", "utf8");
    }
  }

  async readAll() {
    await this.ensureStorage();
    const content = await fs.readFile(DATA_FILE, "utf8");

    try {
      const parsed = JSON.parse(content || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async writeAll(plans) {
    await this.ensureStorage();
    await fs.writeFile(DATA_FILE, `${JSON.stringify(plans, null, 2)}\n`, "utf8");
    return plans;
  }
}

module.exports = new PlansRepository();
