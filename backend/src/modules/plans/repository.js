const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../../..", "data");
const JSON_DATA_FILE = path.join(DATA_DIR, "plans.json");
const SQLITE_DATA_FILE = path.join(DATA_DIR, "plans.sqlite");

class AsyncLock {
  constructor() {
    this.current = Promise.resolve();
  }

  async run(task) {
    const previous = this.current;
    let release;
    this.current = new Promise((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }
}

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`);

  await fs.writeFile(tempFile, content, "utf8");
  await fs.rename(tempFile, filePath);
}

class PlansRepository {
  constructor() {
    this.lock = new AsyncLock();
    this.driver = String(process.env.PLANS_STORAGE_DRIVER || "json").trim().toLowerCase();
    this.sqlite = null;
  }

  async ensureStorage() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    if (this.driver === "sqlite") {
      this._ensureSqliteStorage();
      return;
    }

    try {
      await fs.access(JSON_DATA_FILE);
    } catch {
      await writeFileAtomic(JSON_DATA_FILE, "[]\n");
    }
  }

  _ensureSqliteStorage() {
    if (this.sqlite) return;

    let DatabaseSync;
    try {
      ({ DatabaseSync } = require("node:sqlite"));
    } catch {
      this.driver = "json";
      return;
    }

    this.sqlite = new DatabaseSync(SQLITE_DATA_FILE);
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL,
        period TEXT NOT NULL,
        planMonth TEXT,
        organizationId TEXT,
        organizationName TEXT,
        targetValue REAL NOT NULL,
        distributionJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    const existingColumns = this.sqlite.prepare("PRAGMA table_info(plans);").all();
    const columnNames = new Set(existingColumns.map((column) => String(column.name)));
    if (!columnNames.has("planMonth")) {
      this.sqlite.exec("ALTER TABLE plans ADD COLUMN planMonth TEXT;");
    }
    if (!columnNames.has("distributionJson")) {
      this.sqlite.exec("ALTER TABLE plans ADD COLUMN distributionJson TEXT;");
    }
  }

  _readAllFromSqlite() {
    const stmt = this.sqlite.prepare(
      `SELECT id, metric, period, planMonth, organizationId, organizationName, targetValue, distributionJson, createdAt, updatedAt
       FROM plans
       ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC`,
    );
    return stmt.all().map((item) => {
      let distributionDays = [];
      if (item.distributionJson) {
        try {
          const parsed = JSON.parse(item.distributionJson);
          if (Array.isArray(parsed)) {
            distributionDays = parsed;
          }
        } catch (_) {}
      }

      return {
        ...item,
        distributionDays,
      };
    });
  }

  _writeAllToSqlite(plans) {
    this.sqlite.exec("BEGIN TRANSACTION;");
    try {
      this.sqlite.exec("DELETE FROM plans;");
      const insert = this.sqlite.prepare(
        `INSERT INTO plans (id, metric, period, planMonth, organizationId, organizationName, targetValue, distributionJson, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const plan of plans) {
        insert.run(
          plan.id,
          plan.metric,
          plan.period,
          plan.planMonth || "",
          plan.organizationId || "",
          plan.organizationName || "",
          Number(plan.targetValue || 0),
          JSON.stringify(Array.isArray(plan.distributionDays) ? plan.distributionDays : []),
          plan.createdAt,
          plan.updatedAt,
        );
      }

      this.sqlite.exec("COMMIT;");
    } catch (error) {
      this.sqlite.exec("ROLLBACK;");
      throw error;
    }
  }

  async readAll() {
    return this.lock.run(async () => {
      await this.ensureStorage();

      if (this.driver === "sqlite" && this.sqlite) {
        return this._readAllFromSqlite();
      }

      const content = await fs.readFile(JSON_DATA_FILE, "utf8");
      try {
        const parsed = JSON.parse(content || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });
  }

  async writeAll(plans) {
    return this.lock.run(async () => {
      await this.ensureStorage();

      if (this.driver === "sqlite" && this.sqlite) {
        this._writeAllToSqlite(plans);
        return plans;
      }

      await writeFileAtomic(JSON_DATA_FILE, `${JSON.stringify(plans, null, 2)}\n`);
      return plans;
    });
  }
}

module.exports = new PlansRepository();
