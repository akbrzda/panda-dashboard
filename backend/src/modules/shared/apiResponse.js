function buildTimestamp() {
  return new Date().toISOString();
}

function successResponse(data, meta = {}) {
  const timestamp = buildTimestamp();
  return {
    success: true,
    data,
    timestamp,
    meta: {
      ...meta,
      timestamp,
    },
  };
}

function errorResponse({ code = "INTERNAL_ERROR", message = "Unexpected server error", details = null, meta = {} } = {}) {
  const timestamp = buildTimestamp();
  const error = {
    code,
    message,
  };

  if (details != null) {
    error.details = details;
  }

  return {
    success: false,
    error,
    timestamp,
    meta: {
      ...meta,
      timestamp,
    },
  };
}

module.exports = {
  successResponse,
  errorResponse,
};
