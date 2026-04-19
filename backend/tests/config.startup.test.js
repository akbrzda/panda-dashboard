const test = require("node:test");
const assert = require("node:assert/strict");

const CONFIG_PATH = require.resolve("../src/config");

function withEnv(overrides, fn) {
  const keys = ["NODE_ENV", "AUTH_MODE", "API_KEY", "JWT_SECRET", "CORS_ORIGIN"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    delete process.env[key];
  }

  Object.assign(process.env, overrides);
  delete require.cache[CONFIG_PATH];

  try {
    return fn(require(CONFIG_PATH));
  } finally {
    delete require.cache[CONFIG_PATH];
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

test("config uses safe local defaults when auth is not configured", () => {
  withEnv({ NODE_ENV: "test" }, (config) => {
    assert.equal(config.authMode, "none");
    assert.notEqual(String(config.cors.origin || "").trim(), "");
  });
});

test("config keeps api-key mode when API_KEY is provided", () => {
  withEnv({ NODE_ENV: "test", API_KEY: "secret-key" }, (config) => {
    assert.equal(config.authMode, "api-key");
    assert.equal(config.apiKey, "secret-key");
  });
});
