const { AsyncLocalStorage } = require("async_hooks");

const requestContextStorage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return requestContextStorage.run(context || {}, callback);
}

function getRequestContext() {
  return requestContextStorage.getStore() || {};
}

function getCorrelationId() {
  return getRequestContext().correlationId || null;
}

module.exports = {
  runWithRequestContext,
  getRequestContext,
  getCorrelationId,
};
