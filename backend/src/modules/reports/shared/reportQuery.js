const {
  validatePeriodParams,
  validatePositiveInteger,
  validateEnum,
  validateGeoJsonFeatureCollection,
} = require("../../shared/requestValidation");

function validateCommonParams(payload = {}) {
  return validatePeriodParams(payload, {
    organizationField: "organizationId",
    fromField: "dateFrom",
    toField: "dateTo",
  });
}

function validateMenuAbcParams(payload = {}) {
  const base = validateCommonParams(payload);
  if (!base.isValid) return base;

  const abcGroupValidation = validateEnum(payload.abcGroup || "all", "abcGroup", ["all", "a", "b", "c"]);
  if (!abcGroupValidation.isValid) return abcGroupValidation;

  const pageValidation = validatePositiveInteger(payload.page || 1, "page", { min: 1, max: 100000 });
  if (!pageValidation.isValid) return pageValidation;

  const limitValidation = validatePositiveInteger(payload.limit || 50, "limit", { min: 1, max: 200 });
  if (!limitValidation.isValid) return limitValidation;

  return {
    isValid: true,
    normalized: {
      ...base.normalized,
      abcGroup: String(payload.abcGroup || "all").trim().toLowerCase(),
      page: pageValidation.value,
      limit: limitValidation.value,
    },
  };
}

function validateDeliveryZonesGetParams(payload = {}) {
  const organizationId = String(payload.organizationId || "").trim();
  if (!organizationId) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: "Обязательный параметр: organizationId",
    };
  }

  return {
    isValid: true,
    normalized: {
      organizationId,
      terminalGroupId: payload.terminalGroupId ? String(payload.terminalGroupId).trim() : null,
    },
  };
}

function validateDeliveryZonesSaveParams(payload = {}) {
  const base = validateDeliveryZonesGetParams(payload);
  if (!base.isValid) return base;

  const geoJsonValidation = validateGeoJsonFeatureCollection(payload.geoJson, "geoJson");
  if (!geoJsonValidation.isValid) return geoJsonValidation;

  return {
    isValid: true,
    normalized: {
      ...base.normalized,
      geoJson: payload.geoJson,
    },
  };
}

function validateProductionForecastParams(payload = {}) {
  const base = validateCommonParams(payload);
  if (!base.isValid) return base;

  const forecastDate = String(payload.forecastDate || "").trim();
  if (forecastDate && Number.isNaN(new Date(forecastDate).getTime())) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: "Параметр forecastDate имеет некорректный формат даты",
    };
  }

  return {
    isValid: true,
    normalized: {
      ...base.normalized,
      forecastDate: forecastDate || null,
    },
  };
}

module.exports = {
  validateCommonParams,
  validateMenuAbcParams,
  validateDeliveryZonesGetParams,
  validateDeliveryZonesSaveParams,
  validateProductionForecastParams,
};
