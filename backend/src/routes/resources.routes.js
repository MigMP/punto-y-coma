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

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

  return String(recurso.creadoPor || "").toLowerCase() ===
    String(req.user.email || "").toLowerCase();
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
    const materiaId = req.query.materiaId ? Number(req.query.materiaId) : null;
    const query = normalizeText(req.query.q).toLowerCase();

    let items = recursos;

    if (type && type !== "ALL") {
      items = items.filter((recurso) => recurso.type === type);
    }

    if (materiaId !== null && Number.isFinite(materiaId)) {
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

    items = items
      .map((recurso) => withMateriaName(materias, recurso))
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

    return res.json(items);
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
    const materiaId = req.body.materiaId ? Number(req.body.materiaId) : null;

    if (!title || title.length < 4) {
      return res.status(400).json({
        error: "El título debe tener al menos 4 caracteres",
      });
    }

    if (!description || description.length < 8) {
      return res.status(400).json({
        error: "La descripción debe tener al menos 8 caracteres",
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
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
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