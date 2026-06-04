const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "punto-y-coma-api", timestamp: new Date().toISOString() });
});

module.exports = router;
