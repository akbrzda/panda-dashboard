const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "../..");
const SNAPSHOT_PATH = path.join(__dirname, "component-snapshots.json");
const SHOULD_UPDATE = process.env.UPDATE_COMPONENT_SNAPSHOT === "1";

const COMPONENTS_TO_CHECK = [
  "apps/web-panel/src/views/DeliverySummaryView.vue",
  "apps/web-panel/src/views/DeliveryDelaysView.vue",
  "apps/web-panel/src/views/MarketingSourcesView.vue",
  "apps/web-panel/src/views/ClientsView.vue",
  "apps/web-panel/src/components/reports/ReportPageHeader.vue",
  "apps/web-panel/src/components/Sidebar.vue",
];

const REQUIRED_MARKERS = [
  {
    file: "apps/web-panel/src/views/DeliverySummaryView.vue",
    pattern: "Drill-down: Delivery Pack",
  },
  {
    file: "apps/web-panel/src/views/DeliveryDelaysView.vue",
    pattern: "Карточка заказа (drill-down)",
  },
  {
    file: "apps/web-panel/src/views/MarketingSourcesView.vue",
    pattern: "Drill-down: Customer Pack",
  },
  {
    file: "apps/web-panel/src/views/ClientsView.vue",
    pattern: "Карточка клиента (drill-down)",
  },
  {
    file: "apps/web-panel/src/components/Sidebar.vue",
    pattern: "getReadinessStatusLabel",
  },
  {
    file: "apps/web-panel/src/components/reports/ReportPageHeader.vue",
    pattern: "getReadinessStatusBadgeVariant",
  },
];

function readFile(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.readFileSync(fullPath, "utf8");
}

function buildHash(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function buildCurrentSnapshot() {
  const snapshot = {};
  for (const relativePath of COMPONENTS_TO_CHECK) {
    snapshot[relativePath] = buildHash(readFile(relativePath));
  }
  return snapshot;
}

function validateMarkers() {
  const errors = [];

  for (const marker of REQUIRED_MARKERS) {
    const content = readFile(marker.file);
    if (!content.includes(marker.pattern)) {
      errors.push(`Не найден обязательный маркер "${marker.pattern}" в ${marker.file}`);
    }
  }

  return errors;
}

function main() {
  const markerErrors = validateMarkers();
  if (markerErrors.length > 0) {
    console.error("❌ Component checks не пройдены:");
    for (const error of markerErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const currentSnapshot = buildCurrentSnapshot();

  if (SHOULD_UPDATE || !fs.existsSync(SNAPSHOT_PATH)) {
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(currentSnapshot, null, 2)}\n`, "utf8");
    console.log("✅ Снимок компонентов обновлен");
    return;
  }

  const expectedSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  const changed = Object.entries(currentSnapshot).filter(([file, hash]) => expectedSnapshot[file] !== hash);

  if (changed.length > 0) {
    console.error("❌ Обнаружены изменения ключевых компонентов:");
    for (const [file, hash] of changed) {
      console.error(`- ${file}: ${expectedSnapshot[file] || "нет в snapshot"} -> ${hash}`);
    }
    console.error('Обновите snapshot командой: UPDATE_COMPONENT_SNAPSHOT=1 node scripts/ci/component-checks.js');
    process.exit(1);
  }

  console.log("✅ Component checks пройдены");
}

main();
