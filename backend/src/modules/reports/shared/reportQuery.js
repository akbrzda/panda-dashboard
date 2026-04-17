function validateCommonParams(payload = {}) {
  const { organizationId, dateFrom, dateTo } = payload;
  if (!organizationId || !dateFrom || !dateTo) {
    return {
      isValid: false,
      message: "Обязательные параметры: organizationId, dateFrom, dateTo",
    };
  }

  return { isValid: true, message: null };
}

module.exports = {
  validateCommonParams,
};

