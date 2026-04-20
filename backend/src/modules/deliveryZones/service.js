const repository = require("./repository");

class DeliveryZonesService {
  normalizeTerminalGroupId(value) {
    return (
      String(value || "")
        .trim()
        .toLowerCase() || "__all__"
    );
  }

  buildStorageKey({ organizationId, terminalGroupId }) {
    return `${String(organizationId)}::${this.normalizeTerminalGroupId(terminalGroupId)}`;
  }

  validateGeoJson(geoJson) {
    if (!geoJson || geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
      throw new Error("GeoJSON должен быть в формате FeatureCollection");
    }
    for (const feature of geoJson.features) {
      const type = feature?.geometry?.type;
      if (!type) continue;
      if (type !== "Polygon" && type !== "MultiPolygon") {
        throw new Error("Поддерживаются только Polygon и MultiPolygon");
      }
    }
  }

  async save({ organizationId, terminalGroupId = null, geoJson }) {
    if (!organizationId) throw new Error("organizationId обязателен");
    this.validateGeoJson(geoJson);
    const store = await repository.read();
    const key = this.buildStorageKey({ organizationId, terminalGroupId });
    const previous = store[key] || store[String(organizationId)] || null;
    store[key] = {
      geoJson,
      updatedAt: new Date().toISOString(),
      version: Number(previous?.version || 0) + 1,
    };
    await repository.write(store);
    return {
      organizationId: String(organizationId),
      terminalGroupId: this.normalizeTerminalGroupId(terminalGroupId),
      zonesCount: geoJson.features.length,
      updatedAt: store[key].updatedAt,
      version: store[key].version,
    };
  }

  async get({ organizationId, terminalGroupId = null }) {
    if (!organizationId) throw new Error("organizationId обязателен");
    const store = await repository.read();
    const exactKey = this.buildStorageKey({ organizationId, terminalGroupId });
    const fallbackKey = this.buildStorageKey({ organizationId, terminalGroupId: null });
    const record = store[exactKey] || store[fallbackKey] || store[String(organizationId)] || null;
    return {
      organizationId: String(organizationId),
      terminalGroupId: this.normalizeTerminalGroupId(terminalGroupId),
      zonesConfigured: Boolean(record?.geoJson),
      zonesCount: Array.isArray(record?.geoJson?.features) ? record.geoJson.features.length : 0,
      updatedAt: record?.updatedAt || null,
      version: Number(record?.version || 0),
      geoJson: record?.geoJson || null,
    };
  }
}

module.exports = new DeliveryZonesService();
