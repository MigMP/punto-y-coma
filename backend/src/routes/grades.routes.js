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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidGrade(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10;
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

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function findAlumno(users, email) {
  const alumnoEmail = normalizeEmail(email);

  return users.find(
    (user) =>
      normalizeEmail(user.email) === alumnoEmail &&
      user.role === ROLES.ALUMNO
  );
}

function withMateriaName(materias, calificacion) {
  const materia = findMateria(materias, calificacion.materiaId);

  return {
    ...calificacion,
    materiaNombre: materia?.nombre || "(materia no encontrada)",
  };
}

function canTeacherManageGrade(asignaciones, grade, teacherEmail) {
  return isMaestroAsignadoA(asignaciones, grade.materiaId, teacherEmail);
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

router.get("/calificaciones", auth, async (req, res) => {
  try {
    const [calificaciones, materias, asignaciones] = await Promise.all([
      getCollection("calificaciones"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    let items = calificaciones;

    if (req.user.role === ROLES.ALUMNO) {
      const alumnoEmail = normalizeEmail(req.user.email);

      items = items.filter(
        (calificacion) => normalizeEmail(calificacion.alumnoEmail) === alumnoEmail
      );
    }

    if (req.user.role === ROLES.MAESTRO) {
      items = items.filter((calificacion) =>
        isMaestroAsignadoA(asignaciones, calificacion.materiaId, req.user.email)
      );
    }

    return res.json(
      items.map((calificacion) => withMateriaName(materias, calificacion))
    );
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar calificaciones",
      detalle: error.message,
    });
  }
});

router.post("/calificaciones", auth, requireRole(ROLES.MAESTRO), async (req, res) => {
  try {
    const [calificaciones, users, materias, asignaciones] = await Promise.all([
      getCollection("calificaciones"),
      getCollection("users"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const alumnoEmail = normalizeEmail(req.body.alumnoEmail);
    const materiaId = Number(req.body.materiaId);
    const calificacion = Number(req.body.calificacion);

    if (!alumnoEmail) {
      return res.status(400).json({
        error: "Correo del alumno obligatorio",
      });
    }

    const alumno = findAlumno(users, alumnoEmail);

    if (!alumno) {
      return res.status(404).json({
        error: "No existe un alumno registrado con ese correo",
      });
    }

    if (!Number.isFinite(materiaId)) {
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

    if (!isValidGrade(calificacion)) {
      return res.status(400).json({
        error: "La calificación debe ser un número entre 0 y 10",
      });
    }

    const now = new Date().toISOString();

    const nueva = {
      id: nextId(calificaciones),
      alumnoEmail: alumno.email,
      alumnoNombre: alumno.name,
      materiaId,
      calificacion,
      creadoPor: req.user.email,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument("calificaciones", nueva);

    await createActivity(req, {
      type: "calificacion_creada",
      title: "Calificación registrada",
      description: `Se registró ${calificacion} en ${materia.nombre} para ${alumno.name}.`,
      entity: "calificacion",
      entityId: nueva.id,
    });

    await notifyUser(alumno.email, {
      type: "calificacion_creada",
      title: "Nueva calificación registrada",
      message: `Se registró ${calificacion} en ${materia.nombre}.`,
      entity: "calificacion",
      entityId: nueva.id,
    });

    await notifyAdmins({
      type: "calificacion_creada",
      title: "Calificación registrada",
      message: `${req.user.name || req.user.email} registró ${calificacion} en ${materia.nombre} para ${alumno.name}.`,
      entity: "calificacion",
      entityId: nueva.id,
    });

    return res.status(201).json(withMateriaName(materias, nueva));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo registrar la calificación",
      detalle: error.message,
    });
  }
});

router.patch("/calificaciones/:id", auth, requireRole(ROLES.MAESTRO), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        error: "ID inválido",
      });
    }

    const [calificaciones, materias, asignaciones] = await Promise.all([
      getCollection("calificaciones"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const current = calificaciones.find(
      (calificacion) => Number(calificacion.id) === id
    );

    if (!current) {
      return res.status(404).json({
        error: "Calificación no encontrada",
      });
    }

    if (!canTeacherManageGrade(asignaciones, current, req.user.email)) {
      return res.status(403).json({
        error: "No estás asignado a esa materia",
      });
    }

    const calificacion = Number(req.body.calificacion);

    if (!isValidGrade(calificacion)) {
      return res.status(400).json({
        error: "La calificación debe ser un número entre 0 y 10",
      });
    }

    const materia = findMateria(materias, current.materiaId);
    const anterior = current.calificacion;

    const updated = {
      ...current,
      calificacion,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email,
    };

    await saveDocument("calificaciones", updated);

    await createActivity(req, {
      type: "calificacion_editada",
      title: "Calificación actualizada",
      description: `Se actualizó la calificación de ${current.alumnoNombre} en ${materia?.nombre || "materia"} de ${anterior} a ${calificacion}.`,
      entity: "calificacion",
      entityId: current.id,
    });

    await notifyUser(current.alumnoEmail, {
      type: "calificacion_editada",
      title: "Calificación actualizada",
      message: `Tu calificación en ${materia?.nombre || "materia"} cambió de ${anterior} a ${calificacion}.`,
      entity: "calificacion",
      entityId: current.id,
    });

    await notifyAdmins({
      type: "calificacion_editada",
      title: "Calificación actualizada",
      message: `${req.user.name || req.user.email} actualizó la calificación de ${current.alumnoNombre} en ${materia?.nombre || "materia"}.`,
      entity: "calificacion",
      entityId: current.id,
    });

    return res.json({
      ok: true,
      updated: withMateriaName(materias, updated),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo actualizar la calificación",
      detalle: error.message,
    });
  }
});

router.delete("/calificaciones/:id", auth, requireRole(ROLES.MAESTRO), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        error: "ID inválido",
      });
    }

    const [calificaciones, materias, asignaciones] = await Promise.all([
      getCollection("calificaciones"),
      getCollection("materias"),
      getCollection("asignaciones"),
    ]);

    const deleted = calificaciones.find(
      (calificacion) => Number(calificacion.id) === id
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Calificación no encontrada",
      });
    }

    if (!canTeacherManageGrade(asignaciones, deleted, req.user.email)) {
      return res.status(403).json({
        error: "No estás asignado a esa materia",
      });
    }

    const materia = findMateria(materias, deleted.materiaId);

    await deleteDocument("calificaciones", id);

    await createActivity(req, {
      type: "calificacion_eliminada",
      title: "Calificación eliminada",
      description: `Se eliminó la calificación ${deleted.calificacion} de ${deleted.alumnoNombre} en ${materia?.nombre || "materia"}.`,
      entity: "calificacion",
      entityId: deleted.id,
    });

    await notifyUser(deleted.alumnoEmail, {
      type: "calificacion_eliminada",
      title: "Calificación eliminada",
      message: `Se eliminó una calificación de ${materia?.nombre || "materia"}.`,
      entity: "calificacion",
      entityId: deleted.id,
    });

    await notifyAdmins({
      type: "calificacion_eliminada",
      title: "Calificación eliminada",
      message: `${req.user.name || req.user.email} eliminó una calificación de ${deleted.alumnoNombre} en ${materia?.nombre || "materia"}.`,
      entity: "calificacion",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted: withMateriaName(materias, deleted),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar la calificación",
      detalle: error.message,
    });
  }
});

module.exports = router;