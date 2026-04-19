const path = require("path");
const { createFileLogger } = require("../../../packages/shared/fileLogger");
const { getRequestContext } = require("./requestContext");

module.exports = createFileLogger({
  appName: "backend",
  logsDir: path.join(__dirname, "..", "..", "logs"),
  getContext: getRequestContext,
});
