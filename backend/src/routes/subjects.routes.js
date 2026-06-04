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

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSubjectName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function teacherSubjectIds(asignaciones, teacherEmail) {
  const email = normalizeEmail(teacherEmail);

  return new Set(
    asignaciones
      .filter((asignacion) => normalizeEmail(asignacion.maestroEmail) === email)
      .map((asignacion) => Number(asignacion.materiaId))
  );
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

router.get("/materias", auth, async (req, res) => {
  try {
    const [materias, asignaciones] = await Promise.all([
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    if (req.user.role !== ROLES.MAESTRO) {
      return res.json(materias);
    }

    const idsAsignados = teacherSubjectIds(asignaciones, req.user.email);

    return res.json(
      materias.filter((materia) => idsAsignados.has(Number(materia.id)))
    );
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar materias",
      detalle: error.message,
    });
  }
});

router.post("/materias", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const materias = await getCollection("materias");
    const nombre = normalizeSubjectName(req.body.nombre);

    if (!nombre) {
      return res.status(400).json({
        error: "El nombre de la materia es obligatorio",
      });
    }

    if (nombre.length < 3) {
      return res.status(400).json({
        error: "El nombre de la materia debe tener al menos 3 caracteres",
      });
    }

    const existe = materias.some(
      (materia) =>
        normalizeSubjectName(materia.nombre).toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      return res.status(409).json({
        error: "Esa materia ya existe",
      });
    }

    const now = new Date().toISOString();

    const nueva = {
      id: nextId(materias),
      nombre,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("materias", nueva);

    await createActivity(req, {
      type: "materia_creada",
      title: "Materia creada",
      description: `Se creó la materia ${nombre}.`,
      entity: "materia",
      entityId: nueva.id,
    });

    return res.status(201).json(nueva);
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear la materia",
      detalle: error.message,
    });
  }
});

router.delete("/materias/:id", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        error: "ID de materia inválido",
      });
    }

    const [materias, calificaciones, asignaciones] = await Promise.all([
      getCollection("materias"),
      getCollection("calificaciones"),
      getCollection("asignaciones"),
    ]);

    const deleted = materias.find((materia) => Number(materia.id) === id);

    if (!deleted) {
      return res.status(404).json({
        error: "Materia no encontrada",
      });
    }

    const calificacionesRelacionadas = calificaciones.filter(
      (calificacion) => Number(calificacion.materiaId) === id
    );

    const asignacionesRelacionadas = asignaciones.filter(
      (asignacion) => Number(asignacion.materiaId) === id
    );

    await Promise.all([
      deleteDocument("materias", id),
      ...calificacionesRelacionadas.map((calificacion) =>
        deleteDocument("calificaciones", calificacion.id)
      ),
      ...asignacionesRelacionadas.map((asignacion) =>
        deleteDocument("asignaciones", asignacion.id)
      ),
    ]);

    await createActivity(req, {
      type: "materia_eliminada",
      title: "Materia eliminada",
      description: `Se eliminó la materia ${deleted.nombre}. También se removieron ${asignacionesRelacionadas.length} asignación(es) y ${calificacionesRelacionadas.length} calificación(es) relacionadas.`,
      entity: "materia",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar la materia",
      detalle: error.message,
    });
  }
});

module.exports = router;