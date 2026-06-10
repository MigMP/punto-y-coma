// Archivo: frontend/src/pages/Plan.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";

import NavBar from "../components/layout/NavBar.jsx";

import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import {
  buildWeeklyPlan,
  computeInsights,
  planToText,
} from "../features/study/studyCoach.js";

import "../styles/dashboard.css";
import "../styles/coach.css";

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmt(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function gradeClass(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const n = Number(value);

  if (!Number.isFinite(n)) return "";
  if (n < 6) return "bad";
  if (n < 8) return "warn";

  return "ok";
}

function buildAdvice(avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return "Aún no hay datos suficientes para generar una recomendación.";
  }

  if (n < 6) {
    return "Prioridad alta: repasa bases, entrega pendientes y pide apoyo al profesor antes del siguiente parcial.";
  }

  if (n < 7) {
    return "Zona de riesgo: dedica sesiones cortas pero constantes para subir esta materia arriba de 7.";
  }

  if (n < 8.5) {
    return "Buen avance: mantén práctica semanal y corrige errores frecuentes para subir tu promedio.";
  }

  return "Excelente desempeño: conserva el ritmo y refuerza con ejercicios más retadores.";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Alumno";
}

function validateMeta(value) {
  const clean = String(value || "").trim();

  if (!clean) {
    return "Ingresa una meta de promedio.";
  }

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    return "La meta debe ser numérica y máximo con 2 decimales.";
  }

  const n = Number(clean);

  if (!Number.isFinite(n) || n < 0 || n > 10) {
    return "La meta debe ser un número entre 0 y 10.";
  }

  return "";
}

export default function Plan() {
  const { showToast } = useToast();
  const { user, token: ctxToken } = useAuth();

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const metaKey = useMemo(() => {
    const id = user?.id || user?._id || user?.email || "anon";
    return `meta_promedio:${id}`;
  }, [user]);

  const [calificaciones, setCalificaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [metaInput, setMetaInput] = useState("8.5");
  const [metaPromedio, setMetaPromedio] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStudentData = useCallback(async () => {
    if (!token) {
      setCalificaciones([]);
      setMaterias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [calificacionesData, materiasData] = await Promise.all([
        apiJSON("/calificaciones", { token }),
        apiJSON("/materias", { token }),
      ]);

      setCalificaciones(toArray(calificacionesData));
      setMaterias(toArray(materiasData));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el plan",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(metaKey);

      if (raw != null && raw !== "") {
        const n = Number(raw);

        if (Number.isFinite(n) && n >= 0 && n <= 10) {
          setMetaPromedio(n);
          setMetaInput(String(n));
          return;
        }
      }

      setMetaPromedio(null);
      setMetaInput("8.5");
    } catch {
      setMetaPromedio(null);
      setMetaInput("8.5");
    }
  }, [metaKey]);

  const insights = useMemo(() => {
    return computeInsights(calificaciones);
  }, [calificaciones]);

  const plan = useMemo(() => {
    return buildWeeklyPlan(calificaciones, 6);
  }, [calificaciones]);

  const promedioGeneral = Number.isFinite(insights.overall)
    ? insights.overall
    : null;

  const progreso = Number.isFinite(promedioGeneral)
    ? clamp((promedioGeneral / 10) * 100, 0, 100)
    : 0;

  const riskLevel = useMemo(() => {
    const riskCount = insights.risk.length;
    const promedio = Number(promedioGeneral);

    if (!Number.isFinite(promedio)) {
      return {
        cls: "med",
        label: "Sin datos",
        message: "Aún no hay calificaciones suficientes para calcular tu riesgo académico.",
      };
    }

    if (promedio < 6 || riskCount >= 2) {
      return {
        cls: "high",
        label: "Riesgo alto",
        message: "Necesitas atender tus materias más bajas esta semana.",
      };
    }

    if (promedio < 8 || riskCount === 1) {
      return {
        cls: "med",
        label: "Riesgo medio",
        message: "Vas avanzando, pero todavía hay materias que conviene reforzar.",
      };
    }

    return {
      cls: "low",
      label: "Riesgo bajo",
      message: "Buen rendimiento. Mantén constancia para no bajar el promedio.",
    };
  }, [promedioGeneral, insights.risk.length]);

  const materiaStats = useMemo(() => {
    const map = new Map();

    for (const c of calificaciones) {
      const materiaId = String(c.materiaId || "");
      const calificacion = Number(c.calificacion);

      if (!materiaId || !Number.isFinite(calificacion)) continue;

      const materiaNombre =
        c.materiaNombre ||
        materias.find((m) => String(m.id) === materiaId)?.nombre ||
        "Materia";

      if (!map.has(materiaId)) {
        map.set(materiaId, {
          materiaId,
          materia: materiaNombre,
          valores: [],
        });
      }

      map.get(materiaId).valores.push(calificacion);
    }

    return [...map.values()]
      .map((m) => {
        const avg = m.valores.reduce((a, b) => a + b, 0) / m.valores.length;

        return {
          ...m,
          avg: Number(avg.toFixed(2)),
          count: m.valores.length,
          advice: buildAdvice(avg),
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [calificaciones, materias]);

  const materiasRiesgo = useMemo(() => {
    return materiaStats.filter((m) => m.avg < 7);
  }, [materiaStats]);

  const mejoresMaterias = useMemo(() => {
    return [...materiaStats].sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [materiaStats]);

  const prioridadSemana = useMemo(() => {
    if (!materiaStats.length) {
      return "Aún no hay calificaciones suficientes para definir una prioridad.";
    }

    const peor = materiaStats[0];

    if (peor.avg < 6) {
      return `Prioridad inmediata: ${peor.materia}. Está por debajo de 6 y necesita atención antes de la siguiente evaluación.`;
    }

    if (peor.avg < 7) {
      return `Prioridad de refuerzo: ${peor.materia}. Está cerca del límite, conviene subirla primero.`;
    }

    return `Prioridad de mejora: ${peor.materia}. Es tu materia más baja, aunque vas en rango aprobatorio.`;
  }, [materiaStats]);

  const metaStatus = useMemo(() => {
    if (!Number.isFinite(metaPromedio) || !Number.isFinite(promedioGeneral)) {
      return null;
    }

    const diff = Number((metaPromedio - promedioGeneral).toFixed(2));

    if (diff <= 0) {
      return {
        kind: "ok",
        text: `Meta alcanzada. Tu promedio actual supera o iguala ${metaPromedio.toFixed(2)}.`,
      };
    }

    return {
      kind: "pending",
      text: `Te faltan ${diff.toFixed(2)} puntos para llegar a tu meta de ${metaPromedio.toFixed(2)}.`,
    };
  }, [metaPromedio, promedioGeneral]);

  const saveMeta = () => {
    const error = validateMeta(metaInput);

    if (error) {
      showToast({
        type: "warning",
        title: "Meta inválida",
        message: error,
      });
      return;
    }

    const n = Number(metaInput);

    setMetaPromedio(n);

    try {
      localStorage.setItem(metaKey, String(n));
    } catch {
      // no-op
    }

    showToast({
      type: "success",
      title: "Meta guardada",
      message: `Tu nueva meta es ${n.toFixed(2)}.`,
    });
  };

  const clearMeta = () => {
    setMetaPromedio(null);
    setMetaInput("8.5");

    try {
      localStorage.removeItem(metaKey);
    } catch {
      // no-op
    }

    showToast({
      type: "info",
      title: "Meta eliminada",
      message: "Puedes guardar una nueva meta cuando quieras.",
    });
  };

  const copyPlan = async () => {
    const metaLine = Number.isFinite(metaPromedio)
      ? `Meta de promedio: ${metaPromedio.toFixed(2)}\n`
      : "";

    const metaStatusLine = metaStatus ? `${metaStatus.text}\n` : "";

    const text =
      `Plan de estudio - Punto y Coma\n\n` +
      `Alumno: ${getUserName(user)}\n` +
      `Promedio general: ${fmt(promedioGeneral)}\n` +
      `Semáforo: ${riskLevel.label}\n` +
      `Materias en riesgo: ${materiasRiesgo.length}\n` +
      metaLine +
      metaStatusLine +
      `\nPrioridad de la semana:\n${prioridadSemana}\n\n` +
      `Plan semanal:\n${planToText(plan)}\n`;

    try {
      await navigator.clipboard.writeText(text);

      showToast({
        type: "success",
        title: "Plan copiado",
        message: "El plan fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa los permisos del navegador.",
      });
    }
  };

  const printPlan = () => {
    window.print();
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Plan de estudio</h1>

            <p className="msg">
              {getUserName(user)} · Recomendaciones automáticas según tus
              calificaciones.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadStudentData}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar datos"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen académico</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio general</div>

              <div className="kpiValue">
                {loading ? "..." : fmt(promedioGeneral)}
              </div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias registradas</div>
              <div className="kpiValue">{materiaStats.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias en riesgo</div>
              <div className="kpiValue">{materiasRiesgo.length}</div>
            </div>

            <div className={`traffic ${riskLevel.cls}`}>
              <span className="dot"></span>
              {riskLevel.label}
            </div>
          </div>

          <div className="planSpacing">
            <div className="row-between planWrap">
              <div>
                <strong>Progreso general</strong>
                <p className="msg">{riskLevel.message}</p>
              </div>

              <span className={`badge ${gradeClass(promedioGeneral)}`}>
                {fmt(promedioGeneral)} / 10
              </span>
            </div>

            <div className="progress planSpacingSmall">
              <div
                style={{ "--progress": `${progreso}%` }}
                className="progressFill"
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Meta personal</h2>

          <div className="row planWrap">
            <label className="metaLabel">
              <span className="muted">Meta de promedio</span>

              <input
                className="metaInput"
                inputMode="decimal"
                value={metaInput}
                onChange={(event) => setMetaInput(event.target.value)}
                placeholder="Ej. 8.5"
                disabled={loading}
              />
            </label>

            <div className="row metaActions">
              <button type="button" onClick={saveMeta} disabled={loading}>
                Guardar meta
              </button>

              <button
                type="button"
                className="btn-del"
                onClick={clearMeta}
                disabled={loading}
              >
                Quitar
              </button>
            </div>
          </div>

          <div className="planSpacingSmall">
            {!metaStatus && (
              <p className="msg">
                Todavía no tienes una meta guardada o aún no hay promedio para
                compararla.
              </p>
            )}

            {metaStatus?.kind === "ok" && (
              <span className="badge ok">{metaStatus.text}</span>
            )}

            {metaStatus?.kind === "pending" && (
              <span className="badge warn">{metaStatus.text}</span>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Prioridad de la semana</h2>

          <div className="item">
            <div>
              <strong>Enfoque recomendado</strong>
              <div className="muted">{prioridadSemana}</div>
            </div>

            <span
              className={`badge ${
                materiasRiesgo.length ? "warn" : gradeClass(promedioGeneral)
              }`}
            >
              {materiasRiesgo.length ? "Reforzar" : "Mantener"}
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Plan semanal automático</h2>

          <p className="msg">
            El plan se genera con tus materias más bajas para ayudarte a
            estudiar con más intención.
          </p>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className="btn-ghost"
              onClick={copyPlan}
              disabled={loading || !plan.length}
            >
              Copiar plan
            </button>

            <button type="button" onClick={printPlan}>
              Imprimir plan
            </button>
          </div>

          <div className="plan">
            {plan.map((p, index) => (
              <div className="planItem" key={`${p.materia}-${index}`}>
                <div className="planLeft">
                  <div className="planMateria">{p.materia}</div>

                  <div className="planMeta">
                    {p.day} · {p.time}
                  </div>

                  <div className="muted">{p.goal}</div>
                </div>

                <span className="badge ok">1h</span>
              </div>
            ))}

            {!plan.length && (
              <div className="msg">
                {loading
                  ? "Generando plan..."
                  : "Aún no hay calificaciones suficientes para generar un plan."}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Análisis por materia</h2>

          <div className="lista">
            {materiaStats.map((materia) => (
              <div className="item" key={materia.materiaId}>
                <div className="textClamp">
                  <strong>{materia.materia}</strong>

                  <div className="muted">
                    {materia.count} registro(s) · {materia.advice}
                  </div>
                </div>

                <div className="right">
                  <span className={`badge ${gradeClass(materia.avg)}`}>
                    {fmt(materia.avg)}
                  </span>
                </div>
              </div>
            ))}

            {!materiaStats.length && (
              <div className="msg">
                {loading
                  ? "Cargando materias..."
                  : "Todavía no tienes calificaciones registradas."}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Fortalezas académicas</h2>

          <div className="lista">
            {mejoresMaterias.map((materia) => (
              <div className="item" key={materia.materiaId}>
                <div>
                  <strong>{materia.materia}</strong>

                  <div className="muted">
                    Esta materia está entre tus mejores resultados registrados.
                  </div>
                </div>

                <span className={`badge ${gradeClass(materia.avg)}`}>
                  {fmt(materia.avg)}
                </span>
              </div>
            ))}

            {!mejoresMaterias.length && (
              <div className="msg">
                Todavía no hay suficientes datos para detectar fortalezas.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}