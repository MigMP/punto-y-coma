// Archivo: backend/src/routes/tasks.routes.js

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

const VALID_STATUS = ["pendiente", "en_progreso", "completada"];
const VALID_PRIORITIES = ["alta", "media", "baja"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TITLE_MIN_LENGTH = 4;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MIN_LENGTH = 8;
const DESCRIPTION_MAX_LENGTH = 800;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parsePositiveId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePriority(value) {
  return normalizeText(value || "media").toLowerCase();
}

function validateTaskText({ titulo, descripcion }) {
  if (!titulo || titulo.length < TITLE_MIN_LENGTH) {
    return `El título debe tener al menos ${TITLE_MIN_LENGTH} caracteres`;
  }

  if (titulo.length > TITLE_MAX_LENGTH) {
    return `El título no debe superar ${TITLE_MAX_LENGTH} caracteres`;
  }

  if (!descripcion || descripcion.length < DESCRIPTION_MIN_LENGTH) {
    return `La descripción debe tener al menos ${DESCRIPTION_MIN_LENGTH} caracteres`;
  }

  if (descripcion.length > DESCRIPTION_MAX_LENGTH) {
    return `La descripción no debe superar ${DESCRIPTION_MAX_LENGTH} caracteres`;
  }

  return null;
}

function findAlumno(users, email) {
  const normalizedEmail = normalizeEmail(email);

  return users.find(
    (user) =>
      normalizeEmail(user.email) === normalizedEmail &&
      user.role === ROLES.ALUMNO &&
      (!user.status || user.status === "active")
  );
}

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function isMaestroAsignadoA(asignaciones, materiaId, maestroEmail) {
  const id = Number(materiaId);
  const email = normalizeEmail(maestroEmail);

  return asignaciones.some(
    (asignacion) =>
      Number(asignacion.materiaId) === id &&
      normalizeEmail(asignacion.maestroEmail) === email
  );
}

function canSeeTask(req, asignaciones, task) {
  if (req.user.role === ROLES.ADMIN) return true;

  if (req.user.role === ROLES.ALUMNO) {
    return normalizeEmail(task.alumnoEmail) === normalizeEmail(req.user.email);
  }

  if (req.user.role === ROLES.MAESTRO) {
    return isMaestroAsignadoA(asignaciones, task.materiaId, req.user.email);
  }

  return false;
}

function withDetails({ users, materias }, task) {
  const alumno = findAlumno(users, task.alumnoEmail);
  const materia = findMateria(materias, task.materiaId);

  return {
    ...task,
    alumnoNombre: alumno?.name || task.alumnoNombre || "(alumno no encontrado)",
    materiaNombre:
      materia?.nombre || task.materiaNombre || "(materia no encontrada)",
  };
}

function sortTasks(items) {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();

    return bDate - aDate;
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
    targetEmail: normalizeEmail(data.targetEmail || ""),
    entity: data.entity || "",
    entityId: data.entityId || null,
    read: false,
    createdAt: now,
  };

  await saveDocument("notificaciones", item);

  return item;
}

async function notifyUser(targetEmail, data = {}) {
  return createNotification({
    ...data,
    targetEmail,
  });
}

async function notifyAdmins(data = {}) {
  return createNotification({
    ...data,
    targetRole: ROLES.ADMIN,
  });
}

router.get("/tareas", auth, async (req, res) => {
  try {
    const [tareas, users, materias, asignaciones] = await Promise.all([
      getCollection("tareas"),
      getCollection("users"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const status = normalizeStatus(req.query.status);
    const alumnoEmail = normalizeEmail(req.query.alumnoEmail);

    let items = tareas.filter((task) => canSeeTask(req, asignaciones, task));

    if (status && status !== "all") {
      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({
          error: "Estado inválido",
        });
      }

      items = items.filter((task) => task.status === status);
    }

    if (alumnoEmail && req.user.role !== ROLES.ALUMNO) {
      if (!EMAIL_RE.test(alumnoEmail)) {
        return res.status(400).json({
          error: "Correo del alumno inválido",
        });
      }

      items = items.filter(
        (task) => normalizeEmail(task.alumnoEmail) === alumnoEmail
      );
    }

    const detailed = items.map((task) => withDetails({ users, materias }, task));

    return res.json(sortTasks(detailed));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar tareas",
      detalle: error.message,
    });
  }
});

router.post("/tareas", auth, requireRole(ROLES.MAESTRO), async (req, res) => {
  try {
    const [tareas, users, materias, asignaciones] = await Promise.all([
      getCollection("tareas"),
      getCollection("users"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const alumnoEmail = normalizeEmail(req.body.alumnoEmail);
    const materiaId = parsePositiveId(req.body.materiaId);
    const titulo = normalizeText(req.body.titulo);
    const descripcion = normalizeText(req.body.descripcion);
    const prioridad = normalizePriority(req.body.prioridad);

    if (!alumnoEmail || !EMAIL_RE.test(alumnoEmail)) {
      return res.status(400).json({
        error: "Correo del alumno inválido",
      });
    }

    const alumno = findAlumno(users, alumnoEmail);

    if (!alumno) {
      return res.status(404).json({
        error: "No existe un alumno activo con ese correo",
      });
    }

    if (!materiaId) {
      return res.status(400).json({
        error: "materiaId inválido",
      });
    }

    const materia = findMateria(materias, materiaId);

    if (!materia) {
      return res.status(404).json({
        error: "Materia no encontrada",
      });
    }

    if (!isMaestroAsignadoA(asignaciones, materiaId, req.user.email)) {
      return res.status(403).json({
        error: "No estás asignado a esa materia",
      });
    }

    const textError = validateTaskText({ titulo, descripcion });

    if (textError) {
      return res.status(400).json({
        error: textError,
      });
    }

    if (!VALID_PRIORITIES.includes(prioridad)) {
      return res.status(400).json({
        error: "Prioridad inválida. Usa alta, media o baja.",
      });
    }

    const now = new Date().toISOString();

    const nueva = {
      id: nextId(tareas),
      alumnoEmail: alumno.email,
      alumnoNombre: alumno.name,
      materiaId,
      materiaNombre: materia.nombre,
      titulo,
      descripcion,
      prioridad,
      status: "pendiente",
      creadoPor: req.user.email,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("tareas", nueva);

    await createActivity(req, {
      type: "tarea_creada",
      title: "Tarea académica creada",
      description: `Se creó la tarea "${titulo}" para ${alumno.name} en ${materia.nombre}.`,
      entity: "tarea",
      entityId: nueva.id,
    });

    await notifyUser(alumno.email, {
      type: "tarea_creada",
      title: "Nueva tarea académica",
      message: `Se te asignó la tarea "${titulo}" en ${materia.nombre}.`,
      entity: "tarea",
      entityId: nueva.id,
    });

    await notifyAdmins({
      type: "tarea_creada",
      title: "Tarea académica creada",
      message: `${req.user.name || req.user.email} creó una tarea para ${alumno.name} en ${materia.nombre}.`,
      entity: "tarea",
      entityId: nueva.id,
    });

    return res.status(201).json(withDetails({ users, materias }, nueva));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear la tarea",
      detalle: error.message,
    });
  }
});

router.patch("/tareas/:id/status", auth, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const status = normalizeStatus(req.body.status);

    if (!id) {
      return res.status(400).json({
        error: "ID de tarea inválido",
      });
    }

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({
        error: "Estado inválido",
      });
    }

    const [tareas, users, materias, asignaciones] = await Promise.all([
      getCollection("tareas"),
      getCollection("users"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const current = tareas.find((task) => Number(task.id) === id);

    if (!current) {
      return res.status(404).json({
        error: "Tarea no encontrada",
      });
    }

    if (!canSeeTask(req, asignaciones, current)) {
      return res.status(403).json({
        error: "No tienes permiso para modificar esta tarea",
      });
    }

    if (
      req.user.role === ROLES.MAESTRO &&
      !isMaestroAsignadoA(asignaciones, current.materiaId, req.user.email)
    ) {
      return res.status(403).json({
        error: "No estás asignado a esa materia",
      });
    }

    const anterior = current.status;

    if (anterior === status) {
      return res.status(400).json({
        error: "La tarea ya tiene ese estado",
      });
    }

    const updated = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email,
    };

    await saveDocument("tareas", updated);

    await createActivity(req, {
      type: "tarea_actualizada",
      title: "Estado de tarea actualizado",
      description: `La tarea "${current.titulo}" cambió de ${anterior} a ${status}.`,
      entity: "tarea",
      entityId: current.id,
    });

    if (req.user.role === ROLES.ALUMNO) {
      await notifyAdmins({
        type: "tarea_actualizada",
        title: "Alumno actualizó tarea",
        message: `${current.alumnoNombre || current.alumnoEmail} cambió la tarea "${current.titulo}" a ${status}.`,
        entity: "tarea",
        entityId: current.id,
      });
    } else {
      await notifyUser(current.alumnoEmail, {
        type: "tarea_actualizada",
        title: "Tu tarea fue actualizada",
        message: `La tarea "${current.titulo}" cambió de ${anterior} a ${status}.`,
        entity: "tarea",
        entityId: current.id,
      });
    }

    return res.json({
      ok: true,
      updated: withDetails({ users, materias }, updated),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo actualizar la tarea",
      detalle: error.message,
    });
  }
});

router.delete("/tareas/:id", auth, requireRole(ROLES.MAESTRO), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de tarea inválido",
      });
    }

    const [tareas, users, materias, asignaciones] = await Promise.all([
      getCollection("tareas"),
      getCollection("users"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const deleted = tareas.find((task) => Number(task.id) === id);

    if (!deleted) {
      return res.status(404).json({
        error: "Tarea no encontrada",
      });
    }

    if (!isMaestroAsignadoA(asignaciones, deleted.materiaId, req.user.email)) {
      return res.status(403).json({
        error: "No estás asignado a esa materia",
      });
    }

    await deleteDocument("tareas", id);

    await createActivity(req, {
      type: "tarea_eliminada",
      title: "Tarea académica eliminada",
      description: `Se eliminó la tarea "${deleted.titulo}" de ${deleted.alumnoNombre}.`,
      entity: "tarea",
      entityId: deleted.id,
    });

    await notifyUser(deleted.alumnoEmail, {
      type: "tarea_eliminada",
      title: "Tarea eliminada",
      message: `La tarea "${deleted.titulo}" fue eliminada.`,
      entity: "tarea",
      entityId: deleted.id,
    });

    await notifyAdmins({
      type: "tarea_eliminada",
      title: "Tarea eliminada",
      message: `${req.user.name || req.user.email} eliminó la tarea "${deleted.titulo}" de ${deleted.alumnoNombre}.`,
      entity: "tarea",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted: withDetails({ users, materias }, deleted),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar la tarea",
      detalle: error.message,
    });
  }
});

module.exports = router;