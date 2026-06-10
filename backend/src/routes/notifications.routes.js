// Archivo: backend/src/routes/notifications.routes.js

const express = require("express");

const { getCollection, saveDocument } = require("../db/firestoreStore");
const { auth } = require("../middlewares/auth");

const router = express.Router();

const MAX_NOTIFICATIONS_LIMIT = 100;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function parsePositiveId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function parseLimit(value) {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit <= 0) {
    return MAX_NOTIFICATIONS_LIMIT;
  }

  return Math.min(limit, MAX_NOTIFICATIONS_LIMIT);
}

function canSeeNotification(req, notification) {
  const userEmail = normalizeEmail(req.user?.email);
  const userRole = normalizeRole(req.user?.role);

  const targetEmail = normalizeEmail(notification.targetEmail);
  const targetRole = normalizeRole(notification.targetRole);

  /*
    Si no tiene targetEmail ni targetRole, se interpreta como notificación general.
    Esto permite mostrar avisos globales para todos los usuarios.
  */
  if (!targetEmail && !targetRole) return true;

  if (targetEmail && targetEmail === userEmail) return true;
  if (targetRole && targetRole === userRole) return true;

  return false;
}

function sortNotifications(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();

    return dateB - dateA;
  });
}

router.get("/notificaciones", auth, async (req, res) => {
  try {
    const notificaciones = await getCollection("notificaciones");

    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";
    const limit = parseLimit(req.query.limit);

    let items = notificaciones.filter((notification) =>
      canSeeNotification(req, notification)
    );

    if (unreadOnly) {
      items = items.filter((notification) => !notification.read);
    }

    items = sortNotifications(items).slice(0, limit);

    return res.json(items);
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar notificaciones",
      detalle: error.message,
    });
  }
});

router.patch("/notificaciones/:id/read", auth, async (req, res) => {
  try {
    const notificaciones = await getCollection("notificaciones");
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de notificación inválido",
      });
    }

    const notification = notificaciones.find(
      (item) => Number(item.id) === id
    );

    if (!notification) {
      return res.status(404).json({
        error: "Notificación no encontrada",
      });
    }

    if (!canSeeNotification(req, notification)) {
      return res.status(403).json({
        error: "No tienes permiso para leer esta notificación",
      });
    }

    if (notification.read) {
      return res.json({
        ok: true,
        message: "La notificación ya estaba marcada como leída",
        updated: notification,
      });
    }

    const updated = {
      ...notification,
      read: true,
      readAt: new Date().toISOString(),
    };

    await saveDocument("notificaciones", updated);

    return res.json({
      ok: true,
      updated,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo marcar la notificación como leída",
      detalle: error.message,
    });
  }
});

router.patch("/notificaciones/read-all", auth, async (req, res) => {
  try {
    const notificaciones = await getCollection("notificaciones");
    const now = new Date().toISOString();

    const visiblesPendientes = notificaciones.filter(
      (notification) => canSeeNotification(req, notification) && !notification.read
    );

    await Promise.all(
      visiblesPendientes.map((notification) =>
        saveDocument("notificaciones", {
          ...notification,
          read: true,
          readAt: now,
        })
      )
    );

    return res.json({
      ok: true,
      updated: visiblesPendientes.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron marcar las notificaciones como leídas",
      detalle: error.message,
    });
  }
});

module.exports = router;