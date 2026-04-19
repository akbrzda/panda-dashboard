const path = require("path");
const { createFileLogger } = require("../../../packages/shared/fileLogger");

module.exports = createFileLogger({
  appName: "bot",
  logsDir: path.join(__dirname, "..", "logs"),
});
