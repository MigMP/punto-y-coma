// Archivo: backend/src/routes/calendar.routes.js

const express = require("express");

const {
  getCollection,
  saveDocument,
  deleteDocument,
} = require("../db/firestoreStore");

const { auth, requireRole } = require("../middlewares/auth");
const nextId = require("../utils/nextId");
const { ROLES } = require("../utils/roles");

const router = express.Router();

const VALID_TYPES = ["examen", "entrega", "asesoria", "aviso", "clase"];
const VALID_AUDIENCE = ["todos", "alumnos", "maestros", "administradores"];

const TITLE_MIN_LENGTH = 4;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 1000;
const MAX_EVENT_DURATION_DAYS = 30;

const BLOCKED_TITLES = new Set([
  "aaa",
  "aaaa",
  "test",
  "prueba",
  "evento",
  "sin titulo",
  "sin título",
]);

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAudience(value) {
  return String(value || "todos").trim().toLowerCase();
}

function parsePositiveId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function sameId(a, b) {
  return String(a) === String(b);
}

function parseDate(value) {
  const raw = String(value || "").trim();
  const time = new Date(raw).getTime();

  if (!raw || !Number.isFinite(time)) {
    return null;
  }

  return {
    raw,
    time,
  };
}

function validateEventText(title, description) {
  const comparableTitle = title.toLowerCase();

  if (!title || title.length < TITLE_MIN_LENGTH) {
    return `El título debe tener al menos ${TITLE_MIN_LENGTH} caracteres`;
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return `El título no debe superar ${TITLE_MAX_LENGTH} caracteres`;
  }

  if (BLOCKED_TITLES.has(comparableTitle)) {
    return "El título no puede ser un dato de prueba";
  }

  if (!/[a-záéíóúüñ]/i.test(title)) {
    return "El título debe incluir letras";
  }

  if (description && description.length > DESCRIPTION_MAX_LENGTH) {
    return `La descripción no debe superar ${DESCRIPTION_MAX_LENGTH} caracteres`;
  }

  return null;
}

function validateEventDates(startDate, endDate) {
  if (!startDate) {
    return "Fecha de inicio inválida";
  }

  if (!endDate) {
    return "Fecha de fin inválida";
  }

  if (endDate.time < startDate.time) {
    return "La fecha de fin no puede ser menor que la fecha de inicio";
  }

  const durationMs = endDate.time - startDate.time;
  const maxDurationMs = MAX_EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;

  if (durationMs > maxDurationMs) {
    return `El evento no puede durar más de ${MAX_EVENT_DURATION_DAYS} días`;
  }

  return null;
}

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function canSeeEvent(req, event) {
  if (event.audience === "todos") return true;

  if (event.audience === "alumnos") {
    return req.user.role === ROLES.ALUMNO || req.user.role === ROLES.ADMIN;
  }

  if (event.audience === "maestros") {
    return req.user.role === ROLES.MAESTRO || req.user.role === ROLES.ADMIN;
  }

  if (event.audience === "administradores") {
    return req.user.role === ROLES.ADMIN;
  }

  return true;
}

function canManageEvent(req, event) {
  if (req.user.role === ROLES.ADMIN) return true;

  if (req.user.role === ROLES.MAESTRO) {
    return normalizeEmail(event.creadoPor) === normalizeEmail(req.user.email);
  }

  return false;
}

function withMateriaName(materias, event) {
  const materia = findMateria(materias, event.materiaId);

  return {
    ...event,
    materiaNombre: materia?.nombre || event.materiaNombre || "General",
  };
}

function sortEvents(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.startAt || 0).getTime();
    const dateB = new Date(b.startAt || 0).getTime();
    return dateA - dateB;
  });
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
    targetEmail: "",
    entity: data.entity || "",
    entityId: data.entityId || null,
    read: false,
    createdAt: now,
  };

  await saveDocument("notificaciones", item);

  return item;
}

function roleForAudience(audience) {
  if (audience === "alumnos") return ROLES.ALUMNO;
  if (audience === "maestros") return ROLES.MAESTRO;
  if (audience === "administradores") return ROLES.ADMIN;
  return "";
}

router.get("/calendario", auth, async (req, res) => {
  try {
    const [eventos, materias] = await Promise.all([
      getCollection("calendario"),
      getCollection("materias"),
    ]);

    const type = normalizeType(req.query.type);
    const upcomingOnly = String(req.query.upcoming || "").toLowerCase() === "true";
    const now = Date.now();

    if (type && type !== "all" && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo de evento inválido",
      });
    }

    let items = eventos.filter((event) => canSeeEvent(req, event));

    if (type && type !== "all") {
      items = items.filter((event) => event.type === type);
    }

    if (upcomingOnly) {
      items = items.filter((event) => new Date(event.startAt || 0).getTime() >= now);
    }

    const detailed = items.map((event) => withMateriaName(materias, event));

    return res.json(sortEvents(detailed));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar eventos del calendario",
      detalle: error.message,
    });
  }
});

router.post("/calendario", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const [eventos, materias] = await Promise.all([
      getCollection("calendario"),
      getCollection("materias"),
    ]);

    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const type = normalizeType(req.body.type || "aviso");
    const audience = normalizeAudience(req.body.audience || "todos");
    const materiaId = parsePositiveId(req.body.materiaId);
    const startDate = parseDate(req.body.startAt);
    const endDate = parseDate(req.body.endAt);

    const textError = validateEventText(title, description);

    if (textError) {
      return res.status(400).json({
        error: textError,
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo de evento inválido",
      });
    }

    if (!VALID_AUDIENCE.includes(audience)) {
      return res.status(400).json({
        error: "Audiencia inválida",
      });
    }

    const dateError = validateEventDates(startDate, endDate);

    if (dateError) {
      return res.status(400).json({
        error: dateError,
      });
    }

    if (req.body.materiaId && !materiaId) {
      return res.status(400).json({
        error: "materiaId inválido",
      });
    }

    let materiaNombre = "General";

    if (materiaId !== null) {
      const materia = findMateria(materias, materiaId);

      if (!materia) {
        return res.status(404).json({
          error: "Materia no encontrada",
        });
      }

      materiaNombre = materia.nombre;
    }

    const now = new Date().toISOString();

    const nuevo = {
      id: nextId(eventos),
      title,
      description,
      type,
      audience,
      materiaId,
      materiaNombre,
      startAt: startDate.raw,
      endAt: endDate.raw,
      googleEventId: "",
      creadoPor: req.user.email,
      creadoPorNombre: req.user.name || req.user.email,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("calendario", nuevo);

    await createActivity(req, {
      type: "calendario_evento_creado",
      title: "Evento de calendario creado",
      description: `Se creó el evento "${title}" para ${audience}.`,
      entity: "calendario",
      entityId: nuevo.id,
    });

    const targetRole = roleForAudience(audience);

    await createNotification({
      type: "calendario_evento_creado",
      title: "Nuevo evento académico",
      message: `Se agregó "${title}" al calendario académico.`,
      targetRole,
      entity: "calendario",
      entityId: nuevo.id,
    });

    return res.status(201).json(withMateriaName(materias, nuevo));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear el evento",
      detalle: error.message,
    });
  }
});

router.delete("/calendario/:id", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de evento inválido",
      });
    }

    const [eventos, materias] = await Promise.all([
      getCollection("calendario"),
      getCollection("materias"),
    ]);

    const deleted = eventos.find((event) => sameId(event.id, id));

    if (!deleted) {
      return res.status(404).json({
        error: "Evento no encontrado",
      });
    }

    if (!canManageEvent(req, deleted)) {
      return res.status(403).json({
        error: "No tienes permiso para eliminar este evento",
      });
    }

    await deleteDocument("calendario", String(id));

    await createActivity(req, {
      type: "calendario_evento_eliminado",
      title: "Evento de calendario eliminado",
      description: `Se eliminó el evento "${deleted.title}".`,
      entity: "calendario",
      entityId: deleted.id,
    });

    const targetRole = roleForAudience(deleted.audience || "todos");

    await createNotification({
      type: "calendario_evento_eliminado",
      title: "Evento eliminado",
      message: `Se eliminó el evento "${deleted.title}" del calendario académico.`,
      targetRole,
      entity: "calendario",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted: withMateriaName(materias, deleted),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar el evento",
      detalle: error.message,
    });
  }
});

module.exports = router;