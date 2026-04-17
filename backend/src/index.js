require("dotenv").config();

const express = require("express");
const config = require("./config");
const apiRoutes = require("./routes/api");
const requestLogger = require("./middleware/requestLogger");
const fileLogger = require("./utils/fileLogger");

const app = express();

// Middleware
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", config.cors.origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", config.cors.credentials);

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// API routes
app.use("/api", apiRoutes);

// Health check на корневом пути
app.get("/", (req, res) => {
  res.json({
    name: "Panda Dashboard API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/health",
      organizations: "/api/organizations",
      stopLists: "/api/stop-lists?organizationId=xxx",
    },
  });
});

// 404 handler
app.use((req, res) => {
  fileLogger.warn("Неизвестный endpoint", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  fileLogger.error("Необработанная ошибка запроса", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    error: config.env === "development" ? err.message : "Internal server error",
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${config.env}`);
  console.log("🏢 Организации загружаются динамически из IIKO API");
  fileLogger.info("Backend server запущен", {
    port: PORT,
    environment: config.env,
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  fileLogger.error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  fileLogger.error("Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });
});

module.exports = app;
