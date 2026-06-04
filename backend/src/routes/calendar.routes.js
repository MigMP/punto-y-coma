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

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAudience(value) {
  return String(value || "todos").trim().toLowerCase();
}

function isValidDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime());
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

function withMateriaName(materias, event) {
  const materia = findMateria(materias, event.materiaId);

  return {
    ...event,
    materiaNombre: materia?.nombre || event.materiaNombre || "General",
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

    let items = eventos.filter((event) => canSeeEvent(req, event));

    if (type && type !== "ALL") {
      items = items.filter((event) => event.type === type);
    }

    if (upcomingOnly) {
      items = items.filter((event) => new Date(event.startAt).getTime() >= now);
    }

    items = items
      .map((event) => withMateriaName(materias, event))
      .sort((a, b) => {
        const dateA = new Date(a.startAt || 0).getTime();
        const dateB = new Date(b.startAt || 0).getTime();
        return dateA - dateB;
      });

    return res.json(items);
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
    const materiaId = req.body.materiaId ? Number(req.body.materiaId) : null;
    const startAt = String(req.body.startAt || "").trim();
    const endAt = String(req.body.endAt || "").trim();

    if (!title || title.length < 4) {
      return res.status(400).json({
        error: "El título debe tener al menos 4 caracteres",
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

    if (!isValidDate(startAt)) {
      return res.status(400).json({
        error: "Fecha de inicio inválida",
      });
    }

    if (!isValidDate(endAt)) {
      return res.status(400).json({
        error: "Fecha de fin inválida",
      });
    }

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return res.status(400).json({
        error: "La fecha de fin no puede ser menor que la fecha de inicio",
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
      startAt,
      endAt,
      googleEventId: "",
      creadoPor: req.user.email,
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
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        error: "ID de evento inválido",
      });
    }

    const [eventos, materias] = await Promise.all([
      getCollection("calendario"),
      getCollection("materias"),
    ]);

    const deleted = eventos.find((event) => Number(event.id) === id);

    if (!deleted) {
      return res.status(404).json({
        error: "Evento no encontrado",
      });
    }

    await deleteDocument("calendario", id);

    await createActivity(req, {
      type: "calendario_evento_eliminado",
      title: "Evento de calendario eliminado",
      description: `Se eliminó el evento "${deleted.title}".`,
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