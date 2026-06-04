const express = require("express");

const { getCollection } = require("../db/firestoreStore");
const { auth, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../utils/roles");

const router = express.Router();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function average(numbers) {
  const valid = numbers
    .map(Number)
    .filter((item) => Number.isFinite(item));

  if (!valid.length) return 0;

  return round(valid.reduce((sum, item) => sum + item, 0) / valid.length);
}

function findMateria(materias, materiaId) {
  return materias.find((materia) => Number(materia.id) === Number(materiaId));
}

function groupBy(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function getRiskLevel(promedio) {
  if (promedio < 6) return "riesgo_alto";
  if (promedio < 8) return "observacion";
  return "estable";
}

router.get("/analiticas", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const [
      users,
      materias,
      calificaciones,
      asignaciones,
      tareas,
      recursos,
      calendario,
      notificaciones,
    ] = await Promise.all([
      getCollection("users"),
      getCollection("materias"),
      getCollection("calificaciones"),
      getCollection("asignaciones"),
      getCollection("tareas"),
      getCollection("recursos"),
      getCollection("calendario"),
      getCollection("notificaciones"),
    ]);

    const isTeacher = req.user.role === ROLES.MAESTRO;
    const teacherEmail = normalizeEmail(req.user.email);

    const teacherSubjectIds = new Set(
      asignaciones
        .filter((asignacion) => normalizeEmail(asignacion.maestroEmail) === teacherEmail)
        .map((asignacion) => Number(asignacion.materiaId))
    );

    const visibleCalificaciones = isTeacher
      ? calificaciones.filter((item) => teacherSubjectIds.has(Number(item.materiaId)))
      : calificaciones;

    const visibleTareas = isTeacher
      ? tareas.filter((item) => teacherSubjectIds.has(Number(item.materiaId)))
      : tareas;

    const visibleRecursos = isTeacher
      ? recursos.filter((item) => normalizeEmail(item.creadoPor) === teacherEmail)
      : recursos;

    const visibleCalendario = isTeacher
      ? calendario.filter((item) => normalizeEmail(item.creadoPor) === teacherEmail)
      : calendario;

    const alumnos = users.filter((user) => user.role === ROLES.ALUMNO);
    const maestros = users.filter((user) => user.role === ROLES.MAESTRO);
    const admins = users.filter((user) => user.role === ROLES.ADMIN);

    const promedioGeneral = average(
      visibleCalificaciones.map((item) => item.calificacion)
    );

    const calificacionesPorAlumno = groupBy(
      visibleCalificaciones,
      (item) => normalizeEmail(item.alumnoEmail)
    );

    const alumnosResumen = Object.entries(calificacionesPorAlumno).map(([email, grades]) => {
      const alumno = alumnos.find((user) => normalizeEmail(user.email) === email);
      const promedio = average(grades.map((item) => item.calificacion));

      return {
        email,
        nombre: alumno?.name || grades[0]?.alumnoNombre || email,
        promedio,
        totalCalificaciones: grades.length,
        nivel: getRiskLevel(promedio),
      };
    });

    const alumnosEnRiesgo = alumnosResumen.filter((item) => item.promedio < 6);
    const alumnosObservacion = alumnosResumen.filter(
      (item) => item.promedio >= 6 && item.promedio < 8
    );
    const alumnosEstables = alumnosResumen.filter((item) => item.promedio >= 8);

    const promedioPorMateria = materias.map((materia) => {
      const grades = visibleCalificaciones.filter(
        (item) => Number(item.materiaId) === Number(materia.id)
      );

      return {
        materiaId: materia.id,
        materiaNombre: materia.nombre,
        promedio: average(grades.map((item) => item.calificacion)),
        total: grades.length,
      };
    });

    const tareasPorEstado = {
      pendiente: visibleTareas.filter((item) => item.status === "pendiente").length,
      en_progreso: visibleTareas.filter((item) => item.status === "en_progreso").length,
      completada: visibleTareas.filter((item) => item.status === "completada").length,
    };

    const recursosPorTipo = {
      video: visibleRecursos.filter((item) => item.type === "video").length,
      guia: visibleRecursos.filter((item) => item.type === "guia").length,
      pdf: visibleRecursos.filter((item) => item.type === "pdf").length,
      link: visibleRecursos.filter((item) => item.type === "link").length,
      recomendacion: visibleRecursos.filter((item) => item.type === "recomendacion").length,
    };

    const now = Date.now();

    const eventosProximos = visibleCalendario
      .filter((item) => new Date(item.startAt || 0).getTime() >= now)
      .sort((a, b) => {
        const dateA = new Date(a.startAt || 0).getTime();
        const dateB = new Date(b.startAt || 0).getTime();
        return dateA - dateB;
      })
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        materiaNombre: item.materiaNombre || "General",
        startAt: item.startAt,
      }));

    const notificacionesNoLeidas = notificaciones.filter((item) => !item.read).length;

    const materiasCriticas = promedioPorMateria
      .filter((item) => item.total > 0)
      .sort((a, b) => a.promedio - b.promedio)
      .slice(0, 5);

    const mejoresMaterias = promedioPorMateria
      .filter((item) => item.total > 0)
      .sort((a, b) => b.promedio - a.promedio)
      .slice(0, 5);

    return res.json({
      scope: isTeacher ? "maestro" : "administrador",
      generatedAt: new Date().toISOString(),
      resumen: {
        totalUsuarios: users.length,
        totalAlumnos: alumnos.length,
        totalMaestros: maestros.length,
        totalAdministradores: admins.length,
        totalMaterias: materias.length,
        totalCalificaciones: visibleCalificaciones.length,
        promedioGeneral,
        alumnosEnRiesgo: alumnosEnRiesgo.length,
        alumnosObservacion: alumnosObservacion.length,
        alumnosEstables: alumnosEstables.length,
        totalTareas: visibleTareas.length,
        totalRecursos: visibleRecursos.length,
        totalEventos: visibleCalendario.length,
        notificacionesNoLeidas,
      },
      promedioPorMateria,
      materiasCriticas,
      mejoresMaterias,
      alumnosResumen: alumnosResumen
        .sort((a, b) => a.promedio - b.promedio)
        .slice(0, 10),
      tareasPorEstado,
      recursosPorTipo,
      eventosProximos,
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron generar las analíticas",
      detalle: error.message,
    });
  }
});

module.exports = router;