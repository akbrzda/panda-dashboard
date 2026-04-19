require("dotenv").config();

const express = require("express");
const config = require("./config");
const requestLogger = require("./middleware/requestLogger");
const fileLogger = require("./utils/fileLogger");

const app = express();

if (config.authMode === "api-key" && !config.apiKey) {
  throw new Error("API_KEY обязателен при AUTH_MODE=api-key.");
}

if (config.authMode === "jwt" && !config.jwtSecret) {
  throw new Error("JWT_SECRET обязателен при AUTH_MODE=jwt.");
}

if (!config.cors.origin) {
  throw new Error("CORS_ORIGIN обязателен для текущего окружения.");
}

const apiRoutes = require("./routes/api");

// Middleware
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const configuredOrigin = String(config.cors.origin || "").trim();
  const allowedOrigins = configuredOrigin
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!requestOrigin) {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.header("Access-Control-Allow-Credentials", config.cors.credentials);
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    return next();
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Origin не разрешен политикой CORS",
    });
  }

  res.header("Access-Control-Allow-Origin", requestOrigin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.header("Access-Control-Allow-Credentials", config.cors.credentials);

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// API routes
app.use("/api", apiRoutes);

// Корневой health check
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
  console.log(`🚀 Backend server запущен на http://localhost:${PORT}`);
  console.log(`🌍 Окружение: ${config.env}`);
  console.log("📊 Данные загружаются из IIKO API");
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
