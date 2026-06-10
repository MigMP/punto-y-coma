// Archivo: backend/src/routes/health.routes.js

const express = require("express");

const { NODE_ENV } = require("../config/env");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "punto-y-coma-api",
    project: "Punto y Coma Académico",
    environment: NODE_ENV || "development",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;