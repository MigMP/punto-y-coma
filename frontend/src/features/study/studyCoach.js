// name=frontend/src/features/study/studyCoach.js

export function computeInsights(califs) {
  const map = new Map();

  for (const c of califs) {
    const materia = c.materiaNombre || "Sin materia";
    const val = Number(c.calificacion);
    if (!Number.isFinite(val)) continue;
    if (!map.has(materia)) map.set(materia, []);
    map.get(materia).push(val);
  }

  const materias = [];
  let all = [];

  for (const [materia, nums] of map.entries()) {
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    materias.push({ materia, avg, count: nums.length });
    all = all.concat(nums);
  }

  materias.sort((a, b) => a.avg - b.avg);

  const overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  const risk = materias.filter((m) => m.avg > 0 && m.avg < 7);

  return { overall, materias, risk };
}

export function buildWeeklyPlan(califs, hoursPerWeek = 6) {
  const { materias } = computeInsights(califs);
  const weak = materias.filter((m) => m.avg > 0).slice(0, 4);
  if (!weak.length) return [];

  // crea sesiones según horas
  const sessions = [];
  for (let i = 0; i < hoursPerWeek; i++) {
    sessions.push(weak[i % weak.length].materia);
  }

  const slots = [
  { day: "Lunes", time: "10:00–11:00 am" },
  { day: "Martes", time: "10:00–11:00 am" },
  { day: "Miércoles", time: "11:00 am–12:00 pm" },
  { day: "Jueves", time: "11:00 am–12:00 pm" },
  { day: "Viernes", time: "12:00–1:00 pm" },
  { day: "Sábado", time: "10:00–11:00 am" },
];

  return sessions.slice(0, slots.length).map((materia, i) => ({
    ...slots[i],
    materia,
    goal: "Resumen + 10 ejercicios + repaso de errores",
  }));
}

export function planToText(plan) {
  if (!plan.length) return "No hay plan (aún no hay suficientes calificaciones).";
  return plan.map((p) => `- ${p.day} ${p.time}: ${p.materia} — ${p.goal}`).join("\n");
}