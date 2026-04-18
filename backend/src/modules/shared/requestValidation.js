const DAY_MS = 24 * 60 * 60 * 1000;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function parseDateInput(value) {
  if (value == null) return null;

  const source = toTrimmedString(value);
  if (!source) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const dateOnly = new Date(`${source}T00:00:00Z`);
    return Number.isFinite(dateOnly.getTime()) ? dateOnly : null;
  }

  const parsed = new Date(source);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function validateDateRange({ dateFrom, dateTo, fromField = "dateFrom", toField = "dateTo", maxRangeDays = null }) {
  const from = parseDateInput(dateFrom);
  const to = parseDateInput(dateTo);

  if (!from || !to) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Неверный формат дат: ${fromField}, ${toField}`,
    };
  }

  if (from > to) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `${fromField} не может быть позже ${toField}`,
    };
  }

  if (Number.isFinite(maxRangeDays) && maxRangeDays > 0) {
    const rangeDays = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (rangeDays > maxRangeDays) {
      return {
        isValid: false,
        code: "VALIDATION_ERROR",
        message: `Период не должен превышать ${maxRangeDays} дней`,
      };
    }
  }

  return { isValid: true, from, to };
}

function validatePeriodParams(payload = {}, options = {}) {
  const organizationField = options.organizationField || "organizationId";
  const fromField = options.fromField || "dateFrom";
  const toField = options.toField || "dateTo";
  const maxRangeDays = options.maxRangeDays || null;

  const organizationId = toTrimmedString(payload[organizationField]);
  if (!organizationId) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Обязательный параметр: ${organizationField}`,
    };
  }

  if (!isNonEmptyString(payload[fromField]) || !isNonEmptyString(payload[toField])) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Обязательные параметры: ${organizationField}, ${fromField}, ${toField}`,
    };
  }

  const dateValidation = validateDateRange({
    dateFrom: payload[fromField],
    dateTo: payload[toField],
    fromField,
    toField,
    maxRangeDays,
  });

  if (!dateValidation.isValid) {
    return dateValidation;
  }

  return {
    isValid: true,
    normalized: {
      organizationId,
      [fromField]: toTrimmedString(payload[fromField]),
      [toField]: toTrimmedString(payload[toField]),
    },
  };
}

function validatePositiveInteger(value, fieldName, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed)) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Параметр ${fieldName} должен быть целым числом`,
    };
  }

  if (parsed < min || parsed > max) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Параметр ${fieldName} должен быть в диапазоне ${min}-${max}`,
    };
  }

  return {
    isValid: true,
    value: parsed,
  };
}

function validateEnum(value, fieldName, allowedValues = []) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const allowed = allowedValues.map((item) => String(item).toLowerCase());

  if (!allowed.includes(normalized)) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Параметр ${fieldName} должен быть одним из: ${allowedValues.join(", ")}`,
    };
  }

  return {
    isValid: true,
    value: normalized,
  };
}

function validateGeoJsonFeatureCollection(value, fieldName = "geoJson") {
  if (!value || typeof value !== "object") {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Параметр ${fieldName} должен быть объектом`,
    };
  }

  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return {
      isValid: false,
      code: "VALIDATION_ERROR",
      message: `Параметр ${fieldName} должен быть FeatureCollection`,
    };
  }

  return { isValid: true };
}

module.exports = {
  parseDateInput,
  validatePeriodParams,
  validateDateRange,
  validatePositiveInteger,
  validateEnum,
  validateGeoJsonFeatureCollection,
};
