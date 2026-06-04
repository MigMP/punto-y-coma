import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

function formatDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Bar({ label, value, max, suffix = "" }) {
  const safeMax = Math.max(Number(max || 0), 1);
  const safeValue = Number(value || 0);
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

function GradeBar({ item, max }) {
  const promedio = Number(item.promedio || 0);
  let tone = "ok";

  if (promedio < 6) tone = "bad";
  else if (promedio < 8) tone = "warn";

  return (
    <div className="item">
      <div className="textClamp">
        <strong>{item.materiaNombre}</strong>
        <p className="muted">
          Promedio: {promedio} · Registros: {item.total}
        </p>
        <div className="progressTrack">
          <div
            className="progressFill"
            style={{ width: `${Math.min(100, promedio * 10)}%` }}
          />
        </div>
      </div>

      <span className={`badge ${tone}`}>{promedio}</span>
    </div>
  );
}

function riskLabel(value) {
  if (value === "riesgo_alto") return "Riesgo alto";
  if (value === "observacion") return "Observación";
  return "Estable";
}

function riskTone(value) {
  if (value === "riesgo_alto") return "bad";
  if (value === "observacion") return "warn";
  return "ok";
}

export default function Analiticas() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await apiJSON("/analiticas", { token });
      setData(result);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar analíticas",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumen = data?.resumen || {};

  const maxTareas = useMemo(() => {
    const tareas = data?.tareasPorEstado || {};
    return Math.max(tareas.pendiente || 0, tareas.en_progreso || 0, tareas.completada || 0, 1);
  }, [data]);

  const maxRecursos = useMemo(() => {
    const recursos = data?.recursosPorTipo || {};
    return Math.max(
      recursos.video || 0,
      recursos.guia || 0,
      recursos.pdf || 0,
      recursos.link || 0,
      recursos.recomendacion || 0,
      1
    );
  }, [data]);

  const copySummary = async () => {
    if (!data) return;

    const lines = [
      "Analíticas - Punto y Coma",
      "",
      `Usuario: ${user?.name || "Usuario"}`,
      `Alcance: ${data.scope}`,
      `Generado: ${formatDate(data.generatedAt)}`,
      "",
      `Alumnos: ${resumen.totalAlumnos || 0}`,
      `Maestros: ${resumen.totalMaestros || 0}`,
      `Materias: ${resumen.totalMaterias || 0}`,
      `Promedio general: ${resumen.promedioGeneral || 0}`,
      `Alumnos en riesgo: ${resumen.alumnosEnRiesgo || 0}`,
      `Tareas: ${resumen.totalTareas || 0}`,
      `Recursos: ${resumen.totalRecursos || 0}`,
      `Eventos: ${resumen.totalEventos || 0}`,
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
              {user?.name || "Usuario"} · Panel general de rendimiento académico y actividad del sistema.
            </p>
          </div>

          <button type="button" className="btn-ghost" onClick={loadData}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen general</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio general</div>
              <div className="kpiValue">{resumen.promedioGeneral || 0}</div>
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
              <div className="kpiValue">{resumen.notificacionesNoLeidas || 0}</div>
              <span className="badge">Notificaciones</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Promedio por materia</h2>

          <div className="lista">
            {(data?.promedioPorMateria || []).map((item) => (
              <GradeBar key={item.materiaId} item={item} />
            ))}

            {!data?.promedioPorMateria?.length && (
              <p className="msg">
                {loading ? "Cargando promedios..." : "No hay calificaciones suficientes."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Materias críticas</h2>

          <div className="lista">
            {(data?.materiasCriticas || []).map((item) => (
              <GradeBar key={item.materiaId} item={item} />
            ))}

            {!data?.materiasCriticas?.length && (
              <p className="msg">No hay materias críticas registradas.</p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Alumnos con seguimiento</h2>

          <div className="lista">
            {(data?.alumnosResumen || []).map((item) => (
              <div className="item" key={item.email}>
                <div>
                  <strong>{item.nombre}</strong>
                  <p className="muted">
                    {item.email} · Promedio: {item.promedio} · Registros: {item.totalCalificaciones}
                  </p>
                </div>

                <span className={`badge ${riskTone(item.nivel)}`}>
                  {riskLabel(item.nivel)}
                </span>
              </div>
            ))}

            {!data?.alumnosResumen?.length && (
              <p className="msg">
                {loading ? "Cargando alumnos..." : "No hay alumnos con calificaciones registradas."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Tareas por estado</h2>

          <div className="lista">
            <Bar label="Pendientes" value={data?.tareasPorEstado?.pendiente || 0} max={maxTareas} />
            <Bar label="En progreso" value={data?.tareasPorEstado?.en_progreso || 0} max={maxTareas} />
            <Bar label="Completadas" value={data?.tareasPorEstado?.completada || 0} max={maxTareas} />
          </div>
        </section>

        <section className="card">
          <h2>Recursos por tipo</h2>

          <div className="lista">
            <Bar label="Videos" value={data?.recursosPorTipo?.video || 0} max={maxRecursos} />
            <Bar label="Guías" value={data?.recursosPorTipo?.guia || 0} max={maxRecursos} />
            <Bar label="PDFs" value={data?.recursosPorTipo?.pdf || 0} max={maxRecursos} />
            <Bar label="Links" value={data?.recursosPorTipo?.link || 0} max={maxRecursos} />
            <Bar label="Recomendaciones" value={data?.recursosPorTipo?.recomendacion || 0} max={maxRecursos} />
          </div>
        </section>

        <section className="card">
          <h2>Eventos próximos</h2>

          <div className="lista">
            {(data?.eventosProximos || []).map((item) => (
              <div className="item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">
                    {formatDate(item.startAt)} · {item.materiaNombre || "General"}
                  </p>
                </div>

                <span className="badge">{item.type}</span>
              </div>
            ))}

            {!data?.eventosProximos?.length && (
              <p className="msg">No hay próximos eventos registrados.</p>
            )}
          </div>
        </section>

        <section className="card row-between">
          <div>
            <h2>Exportar resumen</h2>
            <p className="msg">
              Copia o imprime las métricas principales para tu reporte o exposición.
            </p>
          </div>

          <div className="row planWrap">
            <button type="button" className="btn-ghost" onClick={copySummary}>
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