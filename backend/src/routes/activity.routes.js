const express = require("express");

const { getCollection } = require("../db/firestoreStore");
const { auth, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../utils/roles");

const router = express.Router();

function normalizeType(value) {
  return String(value || "").trim();
}

router.get("/actividad", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const actividad = await getCollection("actividad");

    const type = normalizeType(req.query.type);
    const limit = Number(req.query.limit || 100);

    let items = actividad;

    if (type && type !== "ALL") {
      items = items.filter((item) => item.type === type);
    }

    items = items.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return res.json(items.slice(0, Number.isFinite(limit) ? limit : 100));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo consultar la actividad",
      detalle: error.message,
    });
  }
});

module.exports = router;