const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const reportsRoutes = require("../../backend/src/modules/reports/routes");
const ROOT = path.resolve(__dirname, "../..");

function collectRoutePaths(router) {
  if (!router?.stack) return [];
  return router.stack
    .map((layer) => {
      if (!layer?.route?.path) return null;
      const methods = Object.keys(layer.route.methods || {}).filter(Boolean).join(",");
      return `${methods.toUpperCase()}:${layer.route.path}`;
    })
    .filter(Boolean);
}

function runReportsRoutesSmoke() {
  const requiredRoutes = [
    "POST:/delivery-summary",
    "POST:/delivery-delays",
    "POST:/marketing-sources",
    "POST:/sla",
    "POST:/courier-kpi",
  ];
  const availableRoutes = collectRoutePaths(reportsRoutes);

  for (const routePath of requiredRoutes) {
    assert.equal(
      availableRoutes.includes(routePath),
      true,
      `В reports router отсутствует обязательный маршрут: ${routePath}`,
    );
  }
}

function runFeatureReadinessSmoke() {
  const featureReadinessPath = path.join(ROOT, "apps/web-panel/src/config/featureReadiness.js");
  const reportCatalogPath = path.join(ROOT, "apps/web-panel/src/config/reportCatalog.js");

  const featureReadinessContent = fs.readFileSync(featureReadinessPath, "utf8");
  const reportCatalogContent = fs.readFileSync(reportCatalogPath, "utf8");

  const routeMatches = [...reportCatalogContent.matchAll(/to:\s*"([^"]+)"/g)];
  assert.ok(routeMatches.length > 0, "Каталог экранов пуст");

  for (const match of routeMatches) {
    const routePath = match[1];
    if (routePath === "/menu-assortment") {
      continue;
    }
    assert.equal(
      featureReadinessContent.includes(`"${routePath}": {`),
      true,
      `Отсутствует readiness-конфиг для маршрута: ${routePath}`,
    );
  }
}

function main() {
  runReportsRoutesSmoke();
  runFeatureReadinessSmoke();
  console.log("✅ Smoke gate пройден");
}

main();
