// Archivo: backend/src/routes/reports.routes.js

const express = require("express");

const {
  getCollection,
  saveDocument,
} = require("../db/firestoreStore");

const { auth, requireRole } = require("../middlewares/auth");
const nextId = require("../utils/nextId");
const { ROLES } = require("../utils/roles");

const router = express.Router();

const VALID_TYPES = [
  "contenido",
  "calificacion",
  "tarea",
  "calendario",
  "recurso",
  "cuenta",
  "error_tecnico",
  "otro",
];

const VALID_MODULES = [
  "general",
  "calificaciones",
  "tareas",
  "calendario",
  "recursos",
  "cuenta",
  "analiticas",
  "reportes",
  "otro",
];

const VALID_PRIORITIES = ["baja", "media", "alta"];
const VALID_STATUS = ["pendiente", "revision", "resuelto", "rechazado"];

const TITLE_MIN_LENGTH = 4;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 1500;

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parsePositiveId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function sameId(a, b) {
  return String(a) === String(b);
}

function isAdmin(req) {
  return req.user?.role === ROLES.ADMIN;
}

function canSeeReport(req, report) {
  if (isAdmin(req)) return true;

  return normalizeEmail(report.creadoPorEmail) === normalizeEmail(req.user.email);
}

function validateReportPayload(body = {}) {
  const title = normalizeText(body.title);
  const description = normalizeText(body.description);
  const type = normalizeLower(body.type || "otro");
  const module = normalizeLower(body.module || "general");
  const priority = normalizeLower(body.priority || "media");

  if (!title || title.length < TITLE_MIN_LENGTH) {
    return {
      error: `El asunto debe tener al menos ${TITLE_MIN_LENGTH} caracteres.`,
    };
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return {
      error: `El asunto no puede pasar de ${TITLE_MAX_LENGTH} caracteres.`,
    };
  }

  if (!description || description.length < DESCRIPTION_MIN_LENGTH) {
    return {
      error: `La descripción debe tener al menos ${DESCRIPTION_MIN_LENGTH} caracteres.`,
    };
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return {
      error: `La descripción no puede pasar de ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    };
  }

  if (!VALID_TYPES.includes(type)) {
    return {
      error: "Tipo de reporte inválido.",
    };
  }

  if (!VALID_MODULES.includes(module)) {
    return {
      error: "Módulo inválido.",
    };
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    return {
      error: "Prioridad inválida.",
    };
  }

  return {
    title,
    description,
    type,
    module,
    priority,
  };
}

async function createActivity(req, data = {}) {
  const actividad = await getCollection("actividad");
  const now = new Date().toISOString();

  const item = {
    id: nextId(actividad),
    type: data.type || "actividad",
    title: data.title || "Actividad del sistema",
    description: data.description || "",
    entity: data.entity || "",
    entityId: data.entityId || null,
    actor: {
      id: req.user?.id || null,
      name: req.user?.name || "",
      email: req.user?.email || "",
      role: req.user?.role || "",
    },
    createdAt: now,
  };

  await saveDocument("actividad", item);

  return item;
}

async function createNotification(data = {}) {
  const notificaciones = await getCollection("notificaciones");
  const now = new Date().toISOString();

  const item = {
    id: nextId(notificaciones),
    type: data.type || "info",
    title: data.title || "Nueva notificación",
    message: data.message || "",
    targetRole: data.targetRole || "",
    targetEmail: normalizeEmail(data.targetEmail || ""),
    entity: data.entity || "",
    entityId: data.entityId || null,
    read: false,
    createdAt: now,
  };

  await saveDocument("notificaciones", item);

  return item;
}

function publicReport(report) {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    type: report.type,
    module: report.module,
    priority: report.priority,
    status: report.status,
    resolutionMessage: report.resolutionMessage || "",
    creadoPorEmail: report.creadoPorEmail,
    creadoPorNombre: report.creadoPorNombre,
    creadoPorRole: report.creadoPorRole,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolvedAt: report.resolvedAt || "",
  };
}

router.get("/reportes", auth, async (req, res) => {
  try {
    const reportes = await getCollection("reportes");

    const status = normalizeLower(req.query.status || "all");
    const type = normalizeLower(req.query.type || "all");
    const priority = normalizeLower(req.query.priority || "all");
    const search = normalizeLower(req.query.search || "");

    if (status !== "all" && !VALID_STATUS.includes(status)) {
      return res.status(400).json({
        error: "Estado inválido.",
      });
    }

    if (type !== "all" && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo inválido.",
      });
    }

    if (priority !== "all" && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: "Prioridad inválida.",
      });
    }

    let items = reportes.filter((report) => canSeeReport(req, report));

    if (status !== "all") {
      items = items.filter((report) => report.status === status);
    }

    if (type !== "all") {
      items = items.filter((report) => report.type === type);
    }

    if (priority !== "all") {
      items = items.filter((report) => report.priority === priority);
    }

    if (search) {
      items = items.filter((report) => {
        const searchable = [
          report.title,
          report.description,
          report.type,
          report.module,
          report.priority,
          report.status,
          report.creadoPorEmail,
          report.creadoPorNombre,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      });
    }

    items = [...items].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();

      return dateB - dateA;
    });

    return res.json(items.map(publicReport));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar reportes",
      detalle: error.message,
    });
  }
});

router.post("/reportes", auth, async (req, res) => {
  try {
    const validation = validateReportPayload(req.body);

    if (validation.error) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    const reportes = await getCollection("reportes");
    const now = new Date().toISOString();

    const nuevo = {
      id: nextId(reportes),
      title: validation.title,
      description: validation.description,
      type: validation.type,
      module: validation.module,
      priority: validation.priority,
      status: "pendiente",
      resolutionMessage: "",
      creadoPorEmail: normalizeEmail(req.user.email),
      creadoPorNombre: req.user.name || req.user.email,
      creadoPorRole: req.user.role,
      createdAt: now,
      updatedAt: now,
      resolvedAt: "",
    };

    await saveDocument("reportes", nuevo);

    await createActivity(req, {
      type: "reporte_creado",
      title: "Reporte enviado",
      description: `Se creó el reporte "${nuevo.title}".`,
      entity: "reportes",
      entityId: nuevo.id,
    });

    await createNotification({
      type: "reporte_creado",
      title: "Nuevo reporte recibido",
      message: `${nuevo.creadoPorNombre} envió un reporte: "${nuevo.title}".`,
      targetRole: ROLES.ADMIN,
      entity: "reportes",
      entityId: nuevo.id,
    });

    return res.status(201).json(publicReport(nuevo));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear el reporte",
      detalle: error.message,
    });
  }
});

router.patch(
  "/reportes/:id/status",
  auth,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      const id = parsePositiveId(req.params.id);

      if (!id) {
        return res.status(400).json({
          error: "ID de reporte inválido.",
        });
      }

      const status = normalizeLower(req.body.status || "");
      const resolutionMessage = normalizeText(req.body.resolutionMessage || "");

      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({
          error: "Estado inválido.",
        });
      }

      if (resolutionMessage.length > 1000) {
        return res.status(400).json({
          error: "El mensaje de resolución no puede pasar de 1000 caracteres.",
        });
      }

      const reportes = await getCollection("reportes");
      const existing = reportes.find((report) => sameId(report.id, id));

      if (!existing) {
        return res.status(404).json({
          error: "Reporte no encontrado.",
        });
      }

      const now = new Date().toISOString();

      const updated = {
        ...existing,
        status,
        resolutionMessage,
        updatedAt: now,
        resolvedAt:
          status === "resuelto" || status === "rechazado"
            ? now
            : existing.resolvedAt || "",
      };

      await saveDocument("reportes", updated);

      await createActivity(req, {
        type: "reporte_actualizado",
        title: "Reporte actualizado",
        description: `Se actualizó el reporte "${updated.title}" a ${status}.`,
        entity: "reportes",
        entityId: updated.id,
      });

      await createNotification({
        type: "reporte_actualizado",
        title: "Tu reporte fue actualizado",
        message: `El reporte "${updated.title}" cambió a estado: ${status}.`,
        targetEmail: updated.creadoPorEmail,
        entity: "reportes",
        entityId: updated.id,
      });

      return res.json(publicReport(updated));
    } catch (error) {
      return res.status(500).json({
        error: "No se pudo actualizar el reporte",
        detalle: error.message,
      });
    }
  }
);

module.exports = router;
