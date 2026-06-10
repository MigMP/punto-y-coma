// Archivo: frontend/src/features/study/studyCoach.js

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePeriodo(value) {
  const clean = normalizeText(value || "Final");

  const periodos = [
    "Primer parcial",
    "Segundo parcial",
    "Tercer parcial",
    "Final",
    "Extraordinario",
  ];

  const found = periodos.find(
    (periodo) => periodo.toLowerCase() === clean.toLowerCase()
  );

  return found || clean || "Final";
}

function getMateriaName(calificacion) {
  return normalizeText(calificacion?.materiaNombre || "Sin materia");
}

function getGradeLevel(avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return {
      level: "sin_datos",
      label: "Sin datos",
      intensity: 1,
    };
  }

  if (n < 6) {
    return {
      level: "critico",
      label: "Crítico",
      intensity: 5,
    };
  }

  if (n < 7) {
    return {
      level: "riesgo",
      label: "En riesgo",
      intensity: 4,
    };
  }

  if (n < 8.5) {
    return {
      level: "refuerzo",
      label: "Refuerzo",
      intensity: 3,
    };
  }

  return {
    level: "mantenimiento",
    label: "Buen desempeño",
    intensity: 2,
  };
}

function buildDetailedGoal(materia, avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return `Revisar apuntes y detectar qué temas faltan por estudiar en ${materia}.`;
  }

  if (n < 6) {
    return `Subir ${materia} de ${n.toFixed(1)} a mínimo 6.5 en la próxima evaluación.`;
  }

  if (n < 7) {
    return `Subir ${materia} de ${n.toFixed(1)} a mínimo 7.5 reforzando errores concretos.`;
  }

  if (n < 8.5) {
    return `Consolidar ${materia} para pasar de ${n.toFixed(1)} a 8.5 o más.`;
  }

  return `Mantener el nivel de ${materia} y practicar ejercicios de mayor dificultad.`;
}

function buildActions(materia, avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return [
      "Reunir apuntes, tareas y guías disponibles de la materia.",
      "Hacer una lista de temas que no entiendes o que no tienes completos.",
      "Resolver una actividad corta para diagnosticar el nivel real.",
      "Anotar dudas concretas para preguntarlas al maestro o investigarlas.",
    ];
  }

  if (n < 6) {
    return [
      "Repasar primero los conceptos base antes de intentar ejercicios largos.",
      "Identificar los errores del último parcial y clasificarlos por tema.",
      "Resolver 15 ejercicios o preguntas tipo examen, empezando por los más sencillos.",
      "Corregir cada error escribiendo por qué ocurrió y cuál era el procedimiento correcto.",
      "Preparar 3 dudas concretas para pedir apoyo antes de la siguiente clase.",
    ];
  }

  if (n < 7) {
    return [
      "Repasar los temas donde fallaste y hacer un resumen de una cuartilla.",
      "Resolver 12 ejercicios enfocados en los errores más repetidos.",
      "Comparar respuestas con apuntes o rúbrica para detectar pasos incompletos.",
      "Hacer una mini autoevaluación de 10 preguntas al final de la sesión.",
    ];
  }

  if (n < 8.5) {
    return [
      "Revisar apuntes y marcar los conceptos que todavía causan duda.",
      "Resolver 10 ejercicios de dificultad media sin consultar la respuesta al inicio.",
      "Corregir errores y escribir una regla práctica para no repetirlos.",
      "Hacer una explicación breve del tema como si se lo enseñaras a otro alumno.",
    ];
  }

  return [
    "Resolver ejercicios de dificultad alta o problemas integradores.",
    "Hacer una revisión rápida de errores menores para evitar bajar el promedio.",
    "Crear una guía corta con fórmulas, conceptos o pasos importantes.",
    "Ayudar a explicar un tema a un compañero para reforzar dominio.",
  ];
}

function buildEvidence(materia, avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return `Lista de temas pendientes y diagnóstico inicial de ${materia}.`;
  }

  if (n < 6) {
    return `Ejercicios corregidos, lista de errores frecuentes y dudas preparadas para ${materia}.`;
  }

  if (n < 7) {
    return `Resumen de temas débiles, ejercicios resueltos y autoevaluación de ${materia}.`;
  }

  if (n < 8.5) {
    return `Apuntes corregidos, ejercicios de práctica y explicación breve de ${materia}.`;
  }

  return `Guía personal de repaso y ejercicios avanzados de ${materia}.`;
}

function buildSessionType(avg, sessionIndex) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return "Diagnóstico";
  }

  if (n < 6) {
    return sessionIndex % 2 === 0 ? "Rescate académico" : "Corrección de errores";
  }

  if (n < 7) {
    return sessionIndex % 2 === 0 ? "Refuerzo guiado" : "Práctica tipo examen";
  }

  if (n < 8.5) {
    return sessionIndex % 2 === 0 ? "Consolidación" : "Práctica media";
  }

  return sessionIndex % 2 === 0 ? "Mantenimiento" : "Reto avanzado";
}

export function computeInsights(califs) {
  const map = new Map();

  for (const c of califs) {
    const materia = getMateriaName(c);
    const val = Number(c.calificacion);
    const periodo = normalizePeriodo(c.periodo);

    if (!Number.isFinite(val)) continue;

    if (!map.has(materia)) {
      map.set(materia, {
        materia,
        values: [],
        periodos: [],
      });
    }

    const current = map.get(materia);

    current.values.push(val);
    current.periodos.push({
      periodo,
      calificacion: val,
    });
  }

  const materias = [];
  let all = [];

  for (const item of map.values()) {
    const nums = item.values;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const level = getGradeLevel(avg);

    materias.push({
      materia: item.materia,
      avg,
      count: nums.length,
      periodos: item.periodos,
      level: level.level,
      label: level.label,
      intensity: level.intensity,
    });

    all = all.concat(nums);
  }

  materias.sort((a, b) => {
    const intensityCompare = b.intensity - a.intensity;
    if (intensityCompare !== 0) return intensityCompare;

    return a.avg - b.avg;
  });

  const overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  const risk = materias.filter((m) => m.avg > 0 && m.avg < 7);

  return { overall, materias, risk };
}

export function buildWeeklyPlan(califs, hoursPerWeek = 6) {
  const { materias } = computeInsights(califs);
  const candidates = materias.filter((m) => Number.isFinite(Number(m.avg)) && m.avg > 0);

  if (!candidates.length) return [];

  const weak = [...candidates]
    .sort((a, b) => {
      const intensityCompare = b.intensity - a.intensity;
      if (intensityCompare !== 0) return intensityCompare;

      return a.avg - b.avg;
    })
    .slice(0, 4);

  const sessions = [];

  for (let i = 0; i < hoursPerWeek; i += 1) {
    sessions.push(weak[i % weak.length]);
  }

  const slots = [
    { day: "Lunes", time: "10:00–11:00 am" },
    { day: "Martes", time: "10:00–11:00 am" },
    { day: "Miércoles", time: "11:00 am–12:00 pm" },
    { day: "Jueves", time: "11:00 am–12:00 pm" },
    { day: "Viernes", time: "12:00–1:00 pm" },
    { day: "Sábado", time: "10:00–11:00 am" },
  ];

  return sessions.slice(0, slots.length).map((materiaInfo, i) => ({
    ...slots[i],
    materia: materiaInfo.materia,
    avg: Number(materiaInfo.avg.toFixed(2)),
    status: materiaInfo.label,
    sessionType: buildSessionType(materiaInfo.avg, i),
    goal: buildDetailedGoal(materiaInfo.materia, materiaInfo.avg),
    actions: buildActions(materiaInfo.materia, materiaInfo.avg),
    evidence: buildEvidence(materiaInfo.materia, materiaInfo.avg),
  }));
}

export function planToText(plan) {
  if (!plan.length) {
    return "No hay plan: aún no hay suficientes calificaciones para generar recomendaciones.";
  }

  return plan
    .map((p) => {
      const actions = Array.isArray(p.actions)
        ? p.actions.map((action, index) => `   ${index + 1}. ${action}`).join("\n")
        : `   1. ${p.goal}`;

      return (
        `- ${p.day} ${p.time}: ${p.materia}\n` +
        `  Tipo: ${p.sessionType || "Sesión de estudio"}\n` +
        `  Objetivo: ${p.goal}\n` +
        `${actions}\n` +
        `  Evidencia: ${p.evidence || "Apuntes y ejercicios corregidos."}`
      );
    })
    .join("\n\n");
}
