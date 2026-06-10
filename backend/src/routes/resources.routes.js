// Archivo: backend/src/routes/resources.routes.js

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

const VALID_TYPES = ["video", "guia", "pdf", "link", "recomendacion"];
const TITLE_MIN_LENGTH = 4;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MIN_LENGTH = 8;
const DESCRIPTION_MAX_LENGTH = 1000;

const BLOCKED_TITLES = new Set([
  "test",
  "prueba",
  "aaa",
  "aaaa",
  "recurso",
  "sin titulo",
  "sin título",
]);

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUrl(value) {
  return String(value || "").trim();
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

function isValidUrl(value) {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (!url.hostname || url.hostname.length < 3) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function validateResourceText({ title, description }) {
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

  if (!description || description.length < DESCRIPTION_MIN_LENGTH) {
    return `La descripción debe tener al menos ${DESCRIPTION_MIN_LENGTH} caracteres`;
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return `La descripción no debe superar ${DESCRIPTION_MAX_LENGTH} caracteres`;
  }

  return null;
}

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function withMateriaName(materias, recurso) {
  const materia = findMateria(materias, recurso.materiaId);

  return {
    ...recurso,
    materiaNombre: materia?.nombre || recurso.materiaNombre || "General",
  };
}

function canManageResource(req, recurso) {
  if (req.user.role === ROLES.ADMIN) return true;
  if (req.user.role !== ROLES.MAESTRO) return false;

  return (
    String(recurso.creadoPor || "").toLowerCase() ===
    String(req.user.email || "").toLowerCase()
  );
}

function sortResources(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();

    return dateB - dateA;
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

router.get("/recursos", auth, async (req, res) => {
  try {
    const [recursos, materias] = await Promise.all([
      getCollection("recursos"),
      getCollection("materias"),
    ]);

    const type = normalizeType(req.query.type);
    const materiaIdRaw = req.query.materiaId;
    const materiaId = materiaIdRaw ? parsePositiveId(materiaIdRaw) : null;
    const query = normalizeText(req.query.q).toLowerCase();

    if (type && type !== "all" && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo de recurso inválido",
      });
    }

    if (materiaIdRaw && !materiaId) {
      return res.status(400).json({
        error: "materiaId inválido",
      });
    }

    let items = recursos;

    if (type && type !== "all") {
      items = items.filter((recurso) => recurso.type === type);
    }

    if (materiaId !== null) {
      items = items.filter((recurso) => Number(recurso.materiaId) === materiaId);
    }

    if (query) {
      items = items.filter((recurso) => {
        const searchable = [
          recurso.title,
          recurso.description,
          recurso.type,
          recurso.materiaNombre,
          recurso.url,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    const detailed = items.map((recurso) => withMateriaName(materias, recurso));

    return res.json(sortResources(detailed));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar recursos",
      detalle: error.message,
    });
  }
});

router.post("/recursos", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const [recursos, materias] = await Promise.all([
      getCollection("recursos"),
      getCollection("materias"),
    ]);

    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const type = normalizeType(req.body.type || "link");
    const url = normalizeUrl(req.body.url);
    const materiaId = parsePositiveId(req.body.materiaId);

    const textError = validateResourceText({ title, description });

    if (textError) {
      return res.status(400).json({
        error: textError,
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo de recurso inválido",
      });
    }

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        error: "URL inválida. Debe iniciar con http:// o https://",
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
      id: nextId(recursos),
      title,
      description,
      type,
      url,
      materiaId,
      materiaNombre,
      creadoPor: req.user.email,
      creadoPorNombre: req.user.name || req.user.email,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("recursos", nuevo);

    await createActivity(req, {
      type: "recurso_creado",
      title: "Recurso de apoyo creado",
      description: `Se agregó el recurso "${title}" en ${materiaNombre}.`,
      entity: "recurso",
      entityId: nuevo.id,
    });

    await createNotification({
      type: "recurso_creado",
      title: "Nuevo recurso de apoyo",
      message: `Se agregó "${title}" como material de apoyo.`,
      targetRole: ROLES.ALUMNO,
      entity: "recurso",
      entityId: nuevo.id,
    });

    return res.status(201).json(withMateriaName(materias, nuevo));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear el recurso",
      detalle: error.message,
    });
  }
});

router.delete("/recursos/:id", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de recurso inválido",
      });
    }

    const [recursos, materias] = await Promise.all([
      getCollection("recursos"),
      getCollection("materias"),
    ]);

    const deleted = recursos.find((recurso) => Number(recurso.id) === id);

    if (!deleted) {
      return res.status(404).json({
        error: "Recurso no encontrado",
      });
    }

    if (!canManageResource(req, deleted)) {
      return res.status(403).json({
        error: "No tienes permiso para eliminar este recurso",
      });
    }

    await deleteDocument("recursos", id);

    await createActivity(req, {
      type: "recurso_eliminado",
      title: "Recurso de apoyo eliminado",
      description: `Se eliminó el recurso "${deleted.title}".`,
      entity: "recurso",
      entityId: deleted.id,
    });

    await createNotification({
      type: "recurso_eliminado",
      title: "Recurso eliminado",
      message: `Se eliminó el recurso "${deleted.title}".`,
      targetRole: ROLES.ALUMNO,
      entity: "recurso",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted: withMateriaName(materias, deleted),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar el recurso",
      detalle: error.message,
    });
  }
});

module.exports = router;