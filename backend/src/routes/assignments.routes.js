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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function findMaestro(users, email) {
  const normalizedEmail = normalizeEmail(email);

  return users.find(
    (user) =>
      normalizeEmail(user.email) === normalizedEmail &&
      user.role === ROLES.MAESTRO
  );
}

function withDetails({ materias, users }, asignacion) {
  const materia = findMateria(materias, asignacion.materiaId);
  const maestro = findMaestro(users, asignacion.maestroEmail);

  return {
    ...asignacion,
    materiaNombre: materia?.nombre || "(materia no encontrada)",
    maestroNombre: maestro?.name || "(maestro no encontrado)",
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

router.get("/asignaciones", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const [asignaciones, materias, users] = await Promise.all([
      getCollection("asignaciones"),
      getCollection("materias"),
      getCollection("users"),
    ]);

    return res.json(
      asignaciones.map((asignacion) =>
        withDetails({ materias, users }, asignacion)
      )
    );
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar asignaciones",
      detalle: error.message,
    });
  }
});

router.post("/asignaciones", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const [asignaciones, materias, users] = await Promise.all([
      getCollection("asignaciones"),
      getCollection("materias"),
      getCollection("users"),
    ]);

    const materiaId = Number(req.body.materiaId);
    const maestroEmail = normalizeEmail(req.body.maestroEmail);

    if (!Number.isFinite(materiaId)) {
      return res.status(400).json({
        error: "materiaId inválido",
      });
    }

    if (!maestroEmail) {
      return res.status(400).json({
        error: "Correo del maestro obligatorio",
      });
    }

    const materia = findMateria(materias, materiaId);

    if (!materia) {
      return res.status(404).json({
        error: "Materia no encontrada",
      });
    }

    const maestro = findMaestro(users, maestroEmail);

    if (!maestro) {
      return res.status(404).json({
        error: "Maestro no encontrado",
      });
    }

    const exists = asignaciones.some(
      (asignacion) =>
        Number(asignacion.materiaId) === materiaId &&
        normalizeEmail(asignacion.maestroEmail) === maestroEmail
    );

    if (exists) {
      return res.status(409).json({
        error: "Esa asignación ya existe",
      });
    }

    const now = new Date().toISOString();

    const nueva = {
      id: nextId(asignaciones),
      materiaId,
      maestroEmail,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("asignaciones", nueva);

    await createActivity(req, {
      type: "asignacion_creada",
      title: "Asignación creada",
      description: `Se asignó la materia ${materia.nombre} al maestro ${maestro.name}.`,
      entity: "asignacion",
      entityId: nueva.id,
    });

    return res.status(201).json(
      withDetails({ materias, users }, nueva)
    );
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear la asignación",
      detalle: error.message,
    });
  }
});

router.delete("/asignaciones/:id", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        error: "ID de asignación inválido",
      });
    }

    const [asignaciones, materias, users] = await Promise.all([
      getCollection("asignaciones"),
      getCollection("materias"),
      getCollection("users"),
    ]);

    const deleted = asignaciones.find(
      (asignacion) => Number(asignacion.id) === id
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Asignación no encontrada",
      });
    }

    const detail = withDetails({ materias, users }, deleted);

    await deleteDocument("asignaciones", id);

    await createActivity(req, {
      type: "asignacion_eliminada",
      title: "Asignación eliminada",
      description: `Se quitó la materia ${detail.materiaNombre} al maestro ${detail.maestroNombre}.`,
      entity: "asignacion",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted: detail,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar la asignación",
      detalle: error.message,
    });
  }
});

module.exports = router;