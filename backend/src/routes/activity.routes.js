// Archivo: backend/src/routes/activity.routes.js

const express = require("express");

const { getCollection } = require("../db/firestoreStore");
const { auth, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../utils/roles");

const router = express.Router();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeFilter(value) {
  return normalizeText(value).toLowerCase();
}

function parseLimit(value) {
  const limit = Number(value || DEFAULT_LIMIT);

  if (!Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
}

function sortActivity(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();

    return dateB - dateA;
  });
}

router.get("/actividad", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const actividad = await getCollection("actividad");

    const type = normalizeFilter(req.query.type);
    const entity = normalizeFilter(req.query.entity);
    const actorEmail = normalizeFilter(req.query.actorEmail);
    const query = normalizeFilter(req.query.q);
    const limit = parseLimit(req.query.limit);

    let items = actividad;

    if (type && type !== "all") {
      items = items.filter(
        (item) => normalizeFilter(item.type) === type
      );
    }

    if (entity && entity !== "all") {
      items = items.filter(
        (item) => normalizeFilter(item.entity) === entity
      );
    }

    if (actorEmail) {
      items = items.filter(
        (item) => normalizeFilter(item.actor?.email) === actorEmail
      );
    }

    if (query) {
      items = items.filter((item) => {
        const searchable = [
          item.type,
          item.title,
          item.description,
          item.entity,
          item.actor?.name,
          item.actor?.email,
          item.actor?.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    const sorted = sortActivity(items);
    const limited = sorted.slice(0, limit);

    return res.json({
      ok: true,
      total: items.length,
      limit,
      items: limited,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo consultar la actividad",
      detalle: error.message,
    });
  }
});

module.exports = router;