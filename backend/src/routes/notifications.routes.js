const express = require("express");

const { getCollection, saveDocument } = require("../db/firestoreStore");
const { auth } = require("../middlewares/auth");

const router = express.Router();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function canSeeNotification(req, notification) {
  const userEmail = normalizeEmail(req.user?.email);
  const userRole = normalizeRole(req.user?.role);

  const targetEmail = normalizeEmail(notification.targetEmail);
  const targetRole = normalizeRole(notification.targetRole);

  if (targetEmail && targetEmail === userEmail) return true;
  if (targetRole && targetRole === userRole) return true;

  return false;
}

router.get("/notificaciones", auth, async (req, res) => {
  try {
    const notificaciones = await getCollection("notificaciones");
    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";

    let items = notificaciones.filter((notification) =>
      canSeeNotification(req, notification)
    );

    if (unreadOnly) {
      items = items.filter((notification) => !notification.read);
    }

    items = items.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return res.json(items.slice(0, 100));
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
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
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