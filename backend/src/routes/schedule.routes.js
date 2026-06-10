// Archivo: backend/src/routes/schedule.routes.js

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

const VALID_DAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

const COLOR_RE = /^#[0-9a-f]{6}$/i;

const SUBJECT_MIN_LENGTH = 2;
const SUBJECT_MAX_LENGTH = 80;
const ROOM_MAX_LENGTH = 60;
const TEACHER_MAX_LENGTH = 80;
const NOTES_MAX_LENGTH = 300;

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDay(value) {
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

function isTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function minutesFromTime(value) {
  const [hh, mm] = String(value || "00:00")
    .split(":")
    .map((part) => Number(part));

  const hours = Number.isFinite(hh) ? hh : 0;
  const minutes = Number.isFinite(mm) ? mm : 0;

  return hours * 60 + minutes;
}

function hasOverlap(newClass, existingClass) {
  if (newClass.dia !== existingClass.dia) return false;
  if (sameId(newClass.id, existingClass.id)) return false;

  const newStart = minutesFromTime(newClass.inicio);
  const newEnd = minutesFromTime(newClass.fin);
  const oldStart = minutesFromTime(existingClass.inicio);
  const oldEnd = minutesFromTime(existingClass.fin);

  return newStart < oldEnd && oldStart < newEnd;
}

function canManageClass(req, item) {
  return normalizeEmail(item.alumnoEmail) === normalizeEmail(req.user.email);
}

function validateClassPayload(body = {}) {
  const materia = normalizeText(body.materia);
  const dia = normalizeDay(body.dia);
  const inicio = normalizeText(body.inicio);
  const fin = normalizeText(body.fin);
  const aula = normalizeText(body.aula);
  const profesor = normalizeText(body.profesor);
  const notas = normalizeText(body.notas);
  const color = normalizeText(body.color || "#0f766e");

  if (!materia || materia.length < SUBJECT_MIN_LENGTH) {
    return {
      error: `La materia debe tener al menos ${SUBJECT_MIN_LENGTH} caracteres`,
    };
  }

  if (materia.length > SUBJECT_MAX_LENGTH) {
    return {
      error: `La materia no debe superar ${SUBJECT_MAX_LENGTH} caracteres`,
    };
  }

  if (!VALID_DAYS.includes(dia)) {
    return {
      error: "Día inválido",
    };
  }

  if (!isTime(inicio)) {
    return {
      error: "Hora de inicio inválida",
    };
  }

  if (!isTime(fin)) {
    return {
      error: "Hora de salida inválida",
    };
  }

  if (minutesFromTime(fin) <= minutesFromTime(inicio)) {
    return {
      error: "La hora de salida debe ser mayor que la hora de inicio",
    };
  }

  if (aula.length > ROOM_MAX_LENGTH) {
    return {
      error: `El aula no debe superar ${ROOM_MAX_LENGTH} caracteres`,
    };
  }

  if (profesor.length > TEACHER_MAX_LENGTH) {
    return {
      error: `El profesor no debe superar ${TEACHER_MAX_LENGTH} caracteres`,
    };
  }

  if (notas.length > NOTES_MAX_LENGTH) {
    return {
      error: `Las notas no deben superar ${NOTES_MAX_LENGTH} caracteres`,
    };
  }

  if (!COLOR_RE.test(color)) {
    return {
      error: "Color inválido",
    };
  }

  return {
    data: {
      materia,
      dia,
      inicio,
      fin,
      aula,
      profesor,
      notas,
      color,
    },
  };
}

function sortSchedule(items) {
  const dayOrder = new Map(VALID_DAYS.map((day, index) => [day, index]));

  return [...items].sort((a, b) => {
    const dayA = dayOrder.get(a.dia) ?? 99;
    const dayB = dayOrder.get(b.dia) ?? 99;

    if (dayA !== dayB) {
      return dayA - dayB;
    }

    return minutesFromTime(a.inicio) - minutesFromTime(b.inicio);
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

router.get("/horario", auth, requireRole(ROLES.ALUMNO), async (req, res) => {
  try {
    const horario = await getCollection("horario");

    const alumnoEmail = normalizeEmail(req.user.email);
    const day = normalizeDay(req.query.day || "");

    if (day && day !== "all" && !VALID_DAYS.includes(day)) {
      return res.status(400).json({
        error: "Día inválido",
      });
    }

    let items = horario.filter(
      (item) => normalizeEmail(item.alumnoEmail) === alumnoEmail
    );

    if (day && day !== "all") {
      items = items.filter((item) => item.dia === day);
    }

    return res.json(sortSchedule(items));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo consultar el horario escolar",
      detalle: error.message,
    });
  }
});

router.post("/horario", auth, requireRole(ROLES.ALUMNO), async (req, res) => {
  try {
    const validation = validateClassPayload(req.body);

    if (validation.error) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    const horario = await getCollection("horario");
    const alumnoEmail = normalizeEmail(req.user.email);
    const now = new Date().toISOString();

    const nuevo = {
      id: nextId(horario),
      alumnoId: req.user.id || null,
      alumnoEmail,
      alumnoNombre: req.user.name || req.user.email,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
      updatedBy: alumnoEmail,
    };

    const ownClasses = horario.filter(
      (item) => normalizeEmail(item.alumnoEmail) === alumnoEmail
    );

    const collision = ownClasses.some((item) => hasOverlap(nuevo, item));

    if (collision) {
      return res.status(400).json({
        error: "Ya tienes una clase registrada en ese mismo horario",
      });
    }

    await saveDocument("horario", nuevo);

    await createActivity(req, {
      type: "horario_clase_creada",
      title: "Clase agregada al horario",
      description: `Se agregó "${nuevo.materia}" al horario escolar.`,
      entity: "horario",
      entityId: nuevo.id,
    });

    return res.status(201).json(nuevo);
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear la clase del horario",
      detalle: error.message,
    });
  }
});

router.patch("/horario/:id", auth, requireRole(ROLES.ALUMNO), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de clase inválido",
      });
    }

    const validation = validateClassPayload(req.body);

    if (validation.error) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    const horario = await getCollection("horario");
    const current = horario.find((item) => sameId(item.id, id));

    if (!current) {
      return res.status(404).json({
        error: "Clase no encontrada",
      });
    }

    if (!canManageClass(req, current)) {
      return res.status(403).json({
        error: "No tienes permiso para modificar esta clase",
      });
    }

    const updated = {
      ...current,
      ...validation.data,
      updatedAt: new Date().toISOString(),
      updatedBy: normalizeEmail(req.user.email),
    };

    const ownClasses = horario.filter(
      (item) => normalizeEmail(item.alumnoEmail) === normalizeEmail(req.user.email)
    );

    const collision = ownClasses.some((item) => hasOverlap(updated, item));

    if (collision) {
      return res.status(400).json({
        error: "Ya tienes una clase registrada en ese mismo horario",
      });
    }

    await saveDocument("horario", updated);

    await createActivity(req, {
      type: "horario_clase_actualizada",
      title: "Clase del horario actualizada",
      description: `Se actualizó "${updated.materia}" en el horario escolar.`,
      entity: "horario",
      entityId: updated.id,
    });

    return res.json({
      ok: true,
      updated,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo actualizar la clase del horario",
      detalle: error.message,
    });
  }
});

router.delete("/horario/:id", auth, requireRole(ROLES.ALUMNO), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "ID de clase inválido",
      });
    }

    const horario = await getCollection("horario");
    const deleted = horario.find((item) => sameId(item.id, id));

    if (!deleted) {
      return res.status(404).json({
        error: "Clase no encontrada",
      });
    }

    if (!canManageClass(req, deleted)) {
      return res.status(403).json({
        error: "No tienes permiso para eliminar esta clase",
      });
    }

    await deleteDocument("horario", String(id));

    await createActivity(req, {
      type: "horario_clase_eliminada",
      title: "Clase eliminada del horario",
      description: `Se eliminó "${deleted.materia}" del horario escolar.`,
      entity: "horario",
      entityId: deleted.id,
    });

    return res.json({
      ok: true,
      deleted,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo eliminar la clase del horario",
      detalle: error.message,
    });
  }
});

module.exports = router;
