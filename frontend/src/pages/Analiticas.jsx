// Archivo: frontend/src/pages/Analiticas.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Bar({ label, value, max, suffix = "" }) {
  const safeMax = Math.max(safeNumber(max), 1);
  const safeValue = safeNumber(value);
  const width = Math.min(100, Math.round((safeValue / safeMax) * 100));

  return (
    <div className="item">
      <div className="textClamp">
        <strong>{label}</strong>

        <p className="muted">
          {safeValue}
          {suffix}
        </p>

        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${width}%` }} />
        </div>
      </div>

      <span className="badge">{width}%</span>
    </div>
  );
}

function GradeBar({ item }) {
  const promedio = item.promedio;

  let tone = "ok";
  const numericAverage = Number(promedio);

  if (!Number.isFinite(numericAverage)) {
    tone = "";
  } else if (numericAverage < 6) {
    tone = "bad";
  } else if (numericAverage < 8) {
    tone = "warn";
  }

  return (
    <div className="item">
      <div className="textClamp">
        <strong>{item.materiaNombre || "Materia sin nombre"}</strong>

        <p className="muted">
          Promedio: {fmt(promedio)} · Registros: {item.total || 0}
        </p>

        <div className="progressTrack">
          <div
            className="progressFill"
            style={{
              width: Number.isFinite(numericAverage)
                ? `${Math.min(100, numericAverage * 10)}%`
                : "0%",
            }}
          />
        </div>
      </div>

      <span className={`badge ${tone}`}>{fmt(promedio)}</span>
    </div>
  );
}

function riskLabel(value) {
  if (value === "riesgo_alto") return "Riesgo alto";
  if (value === "observacion") return "Observación";
  if (value === "estable") return "Estable";
  if (value === "sin_calificaciones") return "Sin calificaciones";

  return "Estable";
}

function riskTone(value) {
  if (value === "riesgo_alto") return "bad";
  if (value === "observacion") return "warn";
  if (value === "sin_calificaciones") return "";

  return "ok";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

export default function Analiticas() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const result = await apiJSON("/analiticas", { token });
      setData(result || {});
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar analíticas",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resumen = data?.resumen || {};
  const indicadores = data?.indicadores || {};
  const resumenEjecutivo = data?.resumenEjecutivo || null;

  const promedioPorMateria = useMemo(() => {
    return toArray(data?.promedioPorMateria);
  }, [data]);

  const materiasCriticas = useMemo(() => {
    return toArray(data?.materiasCriticas);
  }, [data]);

  const alumnosResumen = useMemo(() => {
    return toArray(data?.alumnosResumen);
  }, [data]);

  const eventosProximos = useMemo(() => {
    return toArray(data?.eventosProximos);
  }, [data]);

  const topAlumnos = useMemo(() => {
    return toArray(data?.topAlumnos);
  }, [data]);

  const alumnosPrioritarios = useMemo(() => {
    return toArray(data?.alumnosPrioritarios);
  }, [data]);

  const maxTareas = useMemo(() => {
    const tareas = data?.tareasPorEstado || {};

    return Math.max(
      safeNumber(tareas.pendiente),
      safeNumber(tareas.en_progreso),
      safeNumber(tareas.completada),
      1
    );
  }, [data]);

  const maxRecursos = useMemo(() => {
    const recursos = data?.recursosPorTipo || {};

    return Math.max(
      safeNumber(recursos.video),
      safeNumber(recursos.guia),
      safeNumber(recursos.pdf),
      safeNumber(recursos.link),
      safeNumber(recursos.recomendacion),
      1
    );
  }, [data]);

  const copySummary = async () => {
    if (!data) return;

    const lines = [
      "Analíticas - Punto y Coma",
      "",
      `Usuario: ${getUserName(user)}`,
      `Alcance: ${data.scope || "general"}`,
      `Generado: ${formatDate(data.generatedAt)}`,
      "",
      `Alumnos: ${resumen.totalAlumnos || 0}`,
      `Maestros: ${resumen.totalMaestros || 0}`,
      `Materias: ${resumen.totalMaterias || 0}`,
      `Promedio general: ${fmt(resumen.promedioGeneral)}`,
      `Alumnos en riesgo: ${resumen.alumnosEnRiesgo || 0}`,
      `Tareas: ${resumen.totalTareas || 0}`,
      `Recursos: ${resumen.totalRecursos || 0}`,
      `Eventos: ${resumen.totalEventos || 0}`,
      "",
      `Prioridad: ${resumenEjecutivo?.prioridad || "Sin prioridad definida"}`,
      `Recomendación: ${
        resumenEjecutivo?.recomendacion || "Sin recomendación disponible"
      }`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "Las analíticas fueron copiadas al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa permisos del navegador.",
      });
    }
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Analíticas visuales</h1>

            <p className="msg">
              {getUserName(user)} · Panel general de rendimiento académico y
              actividad del sistema.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        {resumenEjecutivo && (
          <section className="card">
            <h2>Resumen ejecutivo</h2>

            <div className="lista">
              <div className="item">
                <div>
                  <strong>{resumenEjecutivo.prioridad || "Estado general"}</strong>

                  <p className="muted">
                    {resumenEjecutivo.recomendacion ||
                      "No hay recomendación disponible."}
                  </p>
                </div>

                <span className="badge ok">Sistema</span>
              </div>
            </div>
          </section>
        )}

        <section className="card">
          <h2>Resumen general</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio general</div>
              <div className="kpiValue">{fmt(resumen.promedioGeneral)}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Alumnos</div>
              <div className="kpiValue">{resumen.totalAlumnos || 0}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Alumnos en riesgo</div>
              <div className="kpiValue">{resumen.alumnosEnRiesgo || 0}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{resumen.totalMaterias || 0}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Riesgo académico</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Riesgo alto</div>
              <div className="kpiValue">{resumen.alumnosEnRiesgo || 0}</div>
              <span className="badge bad">Menor a 6</span>
            </div>

            <div className="kpi">
              <div className="kpiTitle">En observación</div>
              <div className="kpiValue">{resumen.alumnosObservacion || 0}</div>
              <span className="badge warn">6 - 7.99</span>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Estables</div>
              <div className="kpiValue">{resumen.alumnosEstables || 0}</div>
              <span className="badge ok">8 - 10</span>
            </div>

            <div className="kpi">
              <div className="kpiTitle">No leídas</div>
              <div className="kpiValue">
                {resumen.notificacionesNoLeidas || 0}
              </div>
              <span className="badge">Notificaciones</span>
            </div>
          </div>
        </section>

        {(indicadores.porcentajeRiesgo !== undefined ||
          indicadores.porcentajeTareasPendientes !== undefined) && (
          <section className="card">
            <h2>Indicadores</h2>

            <div className="lista">
              <Bar
                label="Porcentaje de riesgo"
                value={indicadores.porcentajeRiesgo || 0}
                max={100}
                suffix="%"
              />

              <Bar
                label="Tareas pendientes"
                value={indicadores.porcentajeTareasPendientes || 0}
                max={100}
                suffix="%"
              />

              <Bar
                label="Tareas vencidas"
                value={indicadores.porcentajeTareasVencidas || 0}
                max={100}
                suffix="%"
              />
            </div>
          </section>
        )}

        <section className="card">
          <h2>Promedio por materia</h2>

          <div className="lista">
            {promedioPorMateria.map((item) => (
              <GradeBar key={item.materiaId || item.materiaNombre} item={item} />
            ))}

            {!promedioPorMateria.length && (
              <p className="msg">
                {loading
                  ? "Cargando promedios..."
                  : "No hay calificaciones suficientes."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Materias críticas</h2>

          <div className="lista">
            {materiasCriticas.map((item) => (
              <GradeBar key={item.materiaId || item.materiaNombre} item={item} />
            ))}

            {!materiasCriticas.length && (
              <p className="msg">No hay materias críticas registradas.</p>
            )}
          </div>
        </section>

        {!!alumnosPrioritarios.length && (
          <section className="card">
            <h2>Alumnos prioritarios</h2>

            <div className="lista">
              {alumnosPrioritarios.map((item) => (
                <div className="item" key={item.email}>
                  <div>
                    <strong>{item.nombre || item.email}</strong>

                    <p className="muted">
                      {item.email} · Promedio: {fmt(item.promedio)} ·{" "}
                      {item.motivo || "Requiere seguimiento"}
                    </p>
                  </div>

                  <span className={`badge ${riskTone(item.nivel)}`}>
                    {riskLabel(item.nivel)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!topAlumnos.length && (
          <section className="card">
            <h2>Mejores promedios</h2>

            <div className="lista">
              {topAlumnos.map((item) => (
                <div className="item" key={item.email}>
                  <div>
                    <strong>{item.nombre || item.email}</strong>

                    <p className="muted">
                      {item.email} · Promedio: {fmt(item.promedio)} · Registros:{" "}
                      {item.totalCalificaciones || 0}
                    </p>
                  </div>

                  <span className="badge ok">{fmt(item.promedio)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2>Alumnos con seguimiento</h2>

          <div className="lista">
            {alumnosResumen.map((item) => (
              <div className="item" key={item.email}>
                <div>
                  <strong>{item.nombre || item.email}</strong>

                  <p className="muted">
                    {item.email} · Promedio: {fmt(item.promedio)} · Registros:{" "}
                    {item.totalCalificaciones || 0}
                  </p>
                </div>

                <span className={`badge ${riskTone(item.nivel)}`}>
                  {riskLabel(item.nivel)}
                </span>
              </div>
            ))}

            {!alumnosResumen.length && (
              <p className="msg">
                {loading
                  ? "Cargando alumnos..."
                  : "No hay alumnos con calificaciones registradas."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Tareas por estado</h2>

          <div className="lista">
            <Bar
              label="Pendientes"
              value={data?.tareasPorEstado?.pendiente || 0}
              max={maxTareas}
            />

            <Bar
              label="En progreso"
              value={data?.tareasPorEstado?.en_progreso || 0}
              max={maxTareas}
            />

            <Bar
              label="Completadas"
              value={data?.tareasPorEstado?.completada || 0}
              max={maxTareas}
            />
          </div>
        </section>

        <section className="card">
          <h2>Recursos por tipo</h2>

          <div className="lista">
            <Bar
              label="Videos"
              value={data?.recursosPorTipo?.video || 0}
              max={maxRecursos}
            />

            <Bar
              label="Guías"
              value={data?.recursosPorTipo?.guia || 0}
              max={maxRecursos}
            />

            <Bar
              label="PDFs"
              value={data?.recursosPorTipo?.pdf || 0}
              max={maxRecursos}
            />

            <Bar
              label="Links"
              value={data?.recursosPorTipo?.link || 0}
              max={maxRecursos}
            />

            <Bar
              label="Recomendaciones"
              value={data?.recursosPorTipo?.recomendacion || 0}
              max={maxRecursos}
            />
          </div>
        </section>

        <section className="card">
          <h2>Eventos próximos</h2>

          <div className="lista">
            {eventosProximos.map((item) => (
              <div className="item" key={item.id}>
                <div>
                  <strong>{item.title || "Evento sin título"}</strong>

                  <p className="muted">
                    {formatDate(item.startAt)} · {item.materiaNombre || "General"}
                  </p>
                </div>

                <span className="badge">{item.type || "evento"}</span>
              </div>
            ))}

            {!eventosProximos.length && (
              <p className="msg">No hay próximos eventos registrados.</p>
            )}
          </div>
        </section>

        <section className="card row-between">
          <div>
            <h2>Exportar resumen</h2>

            <p className="msg">
              Copia o imprime las métricas principales para tu reporte o
              exposición.
            </p>
          </div>

          <div className="row planWrap">
            <button
              type="button"
              className="btn-ghost"
              onClick={copySummary}
              disabled={loading || !data}
            >
              Copiar resumen
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>
      </main>
    </>
  );
}