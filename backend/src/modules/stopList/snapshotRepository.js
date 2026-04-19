const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const SNAPSHOT_FILE = path.join(__dirname, "../../..", "data", "stop-list-snapshots.json");
const MAX_SNAPSHOTS = Number(process.env.STOP_LIST_SNAPSHOTS_MAX || 20000);

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

class StopListSnapshotRepository {
  constructor() {
    this.lock = new AsyncLock();
  }

  async ensureStorage() {
    await fs.mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
    try {
      await fs.access(SNAPSHOT_FILE);
    } catch {
      await writeFileAtomic(SNAPSHOT_FILE, "[]\n");
    }
  }

  async readAll() {
    return this.lock.run(async () => {
      await this.ensureStorage();
      const content = await fs.readFile(SNAPSHOT_FILE, "utf8");
      try {
        const parsed = JSON.parse(content || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });
  }

  async writeAll(items) {
    return this.lock.run(async () => {
      await this.ensureStorage();
      await writeFileAtomic(SNAPSHOT_FILE, `${JSON.stringify(items, null, 2)}\n`);
    });
  }

  async appendSnapshots(stopListItems = [], capturedAt = new Date().toISOString()) {
    const snapshots = stopListItems
      .filter((item) => item?.startedAt && item?.organizationId && item?.entityId)
      .map((item) => ({
        id: String(item.id || ""),
        orgId: String(item.organizationId || ""),
        entityId: String(item.entityId || ""),
        entityName: String(item.entityName || ""),
        startedAt: item.startedAt,
        endedAt: item.endedAt || null,
        inStopHours: Number.isFinite(Number(item.inStopHours)) ? Number(item.inStopHours) : null,
        estimatedLostRevenue: Number.isFinite(Number(item.estimatedLostRevenue)) ? Number(item.estimatedLostRevenue) : null,
        capturedAt,
      }));

    if (!snapshots.length) return 0;

    const existing = await this.readAll();
    const nextItems = [...existing];
    const incidentIndex = new Map(nextItems.map((item, index) => [`${item.id}:${item.startedAt}`, index]));
    let createdCount = 0;

    for (const snapshot of snapshots) {
      const incidentKey = `${snapshot.id}:${snapshot.startedAt}`;
      const existingIndex = incidentIndex.get(incidentKey);

      if (existingIndex == null) {
        incidentIndex.set(incidentKey, nextItems.length);
        nextItems.push(snapshot);
        createdCount += 1;
        continue;
      }

      const currentItem = nextItems[existingIndex] || {};
      nextItems[existingIndex] = {
        ...currentItem,
        ...snapshot,
        entityName: snapshot.entityName || currentItem.entityName || "",
        endedAt: snapshot.endedAt || currentItem.endedAt || null,
        inStopHours: Number.isFinite(Number(snapshot.inStopHours)) ? Number(snapshot.inStopHours) : (currentItem.inStopHours ?? null),
        estimatedLostRevenue: Number.isFinite(Number(snapshot.estimatedLostRevenue))
          ? Number(snapshot.estimatedLostRevenue)
          : (currentItem.estimatedLostRevenue ?? null),
        capturedAt: snapshot.capturedAt || currentItem.capturedAt || capturedAt,
      };
    }

    if (nextItems.length > MAX_SNAPSHOTS) {
      nextItems.splice(0, nextItems.length - MAX_SNAPSHOTS);
    }

    await this.writeAll(nextItems);
    return createdCount;
  }
}

module.exports = new StopListSnapshotRepository();
