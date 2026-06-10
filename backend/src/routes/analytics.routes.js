// Archivo: backend/src/routes/analytics.routes.js

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

function percentage(part, total) {
  if (!total) return 0;
  return round((Number(part || 0) / Number(total || 0)) * 100);
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

function getPerformanceLabel(promedio) {
  if (promedio >= 9) return "excelente";
  if (promedio >= 8) return "bueno";
  if (promedio >= 6) return "regular";
  return "riesgo";
}

function isValidDate(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time);
}

function sortByAverageAsc(items) {
  return [...items].sort((a, b) => a.promedio - b.promedio);
}

function sortByAverageDesc(items) {
  return [...items].sort((a, b) => b.promedio - a.promedio);
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

    const visibleMaterias = isTeacher
      ? materias.filter((materia) => teacherSubjectIds.has(Number(materia.id)))
      : materias;

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
        rendimiento: getPerformanceLabel(promedio),
      };
    });

    const alumnosConCalificaciones = new Set(
      visibleCalificaciones.map((item) => normalizeEmail(item.alumnoEmail))
    );

    const alumnosSinCalificaciones = alumnos
      .filter((alumno) => !alumnosConCalificaciones.has(normalizeEmail(alumno.email)))
      .map((alumno) => ({
        id: alumno.id,
        nombre: alumno.name,
        email: alumno.email,
        grupo: alumno.grupo || "",
      }));

    const alumnosEnRiesgo = alumnosResumen.filter((item) => item.promedio < 6);
    const alumnosObservacion = alumnosResumen.filter(
      (item) => item.promedio >= 6 && item.promedio < 8
    );
    const alumnosEstables = alumnosResumen.filter((item) => item.promedio >= 8);

    const distribucionRendimiento = {
      excelente: alumnosResumen.filter((item) => item.promedio >= 9).length,
      bueno: alumnosResumen.filter((item) => item.promedio >= 8 && item.promedio < 9).length,
      regular: alumnosResumen.filter((item) => item.promedio >= 6 && item.promedio < 8).length,
      riesgo: alumnosResumen.filter((item) => item.promedio < 6).length,
      sinCalificaciones: alumnosSinCalificaciones.length,
    };

    const promedioPorMateria = visibleMaterias.map((materia) => {
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

    const tareasPendientes = visibleTareas.filter((item) => item.status !== "completada");

    const now = Date.now();

    const tareasVencidas = visibleTareas.filter((item) => {
      const dueDate = item.dueAt || item.fechaEntrega || item.deadline;

      if (!dueDate || !isValidDate(dueDate)) return false;

      return item.status !== "completada" && new Date(dueDate).getTime() < now;
    });

    const recursosPorTipo = {
      video: visibleRecursos.filter((item) => item.type === "video").length,
      guia: visibleRecursos.filter((item) => item.type === "guia").length,
      pdf: visibleRecursos.filter((item) => item.type === "pdf").length,
      link: visibleRecursos.filter((item) => item.type === "link").length,
      recomendacion: visibleRecursos.filter((item) => item.type === "recomendacion").length,
    };

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

    const materiasCriticas = sortByAverageAsc(
      promedioPorMateria.filter((item) => item.total > 0)
    ).slice(0, 5);

    const mejoresMaterias = sortByAverageDesc(
      promedioPorMateria.filter((item) => item.total > 0)
    ).slice(0, 5);

    const topAlumnos = sortByAverageDesc(alumnosResumen).slice(0, 5);
    const alumnosPrioritarios = sortByAverageAsc(alumnosResumen).slice(0, 10);

    const totalAlumnosEvaluados = alumnosResumen.length;

    const indicadores = {
      porcentajeAlumnosEnRiesgo: percentage(alumnosEnRiesgo.length, totalAlumnosEvaluados),
      porcentajeAlumnosEstables: percentage(alumnosEstables.length, totalAlumnosEvaluados),
      porcentajeTareasCompletadas: percentage(tareasPorEstado.completada, visibleTareas.length),
      porcentajeMateriasConCalificaciones: percentage(
        promedioPorMateria.filter((item) => item.total > 0).length,
        visibleMaterias.length
      ),
    };

    const resumenEjecutivo = {
      mensaje:
        alumnosEnRiesgo.length > 0
          ? `Se detectaron ${alumnosEnRiesgo.length} alumno(s) en riesgo académico.`
          : "No se detectaron alumnos en riesgo con las calificaciones actuales.",
      prioridad:
        alumnosEnRiesgo.length > 0 || tareasVencidas.length > 0
          ? "alta"
          : alumnosObservacion.length > 0
            ? "media"
            : "baja",
      recomendacion:
        alumnosEnRiesgo.length > 0
          ? "Dar seguimiento a los alumnos con promedio menor a 6 y revisar materias críticas."
          : "Mantener seguimiento preventivo y actualizar calificaciones periódicamente.",
    };

    return res.json({
      scope: isTeacher ? "maestro" : "administrador",
      generatedAt: new Date().toISOString(),
      resumenEjecutivo,
      resumen: {
        totalUsuarios: users.length,
        totalAlumnos: alumnos.length,
        totalMaestros: maestros.length,
        totalAdministradores: admins.length,
        totalMaterias: visibleMaterias.length,
        totalCalificaciones: visibleCalificaciones.length,
        promedioGeneral,
        alumnosEnRiesgo: alumnosEnRiesgo.length,
        alumnosObservacion: alumnosObservacion.length,
        alumnosEstables: alumnosEstables.length,
        alumnosSinCalificaciones: alumnosSinCalificaciones.length,
        totalTareas: visibleTareas.length,
        tareasPendientes: tareasPendientes.length,
        tareasVencidas: tareasVencidas.length,
        totalRecursos: visibleRecursos.length,
        totalEventos: visibleCalendario.length,
        notificacionesNoLeidas,
      },
      indicadores,
      distribucionRendimiento,
      promedioPorMateria,
      materiasCriticas,
      mejoresMaterias,
      alumnosResumen: alumnosPrioritarios,
      topAlumnos,
      alumnosSinCalificaciones: alumnosSinCalificaciones.slice(0, 10),
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