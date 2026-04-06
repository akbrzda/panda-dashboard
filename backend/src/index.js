require("dotenv").config();

const express = require("express");
const config = require("./config");
const apiRoutes = require("./routes/api");

const app = express();

// Middleware
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
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: config.env === "development" ? err.message : "Internal server error",
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${config.env}`);
  console.log(`🏢 Organizations loaded: ${config.organizations.length}`);
});

module.exports = app;
