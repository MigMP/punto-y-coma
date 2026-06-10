// Archivo: frontend/src/pages/Analiticas.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

const SECTION_OPTIONS = [
  { value: "resumen", label: "Resumen" },
  { value: "rendimiento", label: "Rendimiento" },
  { value: "alumnos", label: "Alumnos" },
  { value: "sistema", label: "Sistema" },
  { value: "todo", label: "Ver todo" },
];

const RISK_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "riesgo_alto", label: "Riesgo alto" },
  { value: "observacion", label: "Observación" },
  { value: "estable", label: "Estables" },
  { value: "sin_calificaciones", label: "Sin calificaciones" },
];

const SORT_OPTIONS = [
  { value: "promedio_asc", label: "Promedio menor a mayor" },
  { value: "promedio_desc", label: "Promedio mayor a menor" },
  { value: "nombre_asc", label: "Nombre A-Z" },
  { value: "registros_desc", label: "Más registros" },
];

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

function fmtShort(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function gradeTone(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "";
  if (n < 6) return "bad";
  if (n < 8) return "warn";

  return "ok";
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

function getIndicator(indicadores, ...keys) {
  for (const key of keys) {
    if (indicadores?.[key] !== undefined && indicadores?.[key] !== null) {
      return indicadores[key];
    }
  }

  return 0;
}

function sortByMode(items, mode, labelKey = "nombre") {
  const data = [...items];

  if (mode === "promedio_desc") {
    return data.sort((a, b) => safeNumber(b.promedio) - safeNumber(a.promedio));
  }

  if (mode === "nombre_asc") {
    return data.sort((a, b) =>
      String(a[labelKey] || a.nombre || a.email || "").localeCompare(
        String(b[labelKey] || b.nombre || b.email || ""),
        "es",
        { sensitivity: "base" }
      )
    );
  }

  if (mode === "registros_desc") {
    return data.sort(
      (a, b) =>
        safeNumber(b.totalCalificaciones || b.total) -
        safeNumber(a.totalCalificaciones || a.total)
    );
  }

  return data.sort((a, b) => safeNumber(a.promedio) - safeNumber(b.promedio));
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
  const numericAverage = Number(promedio);

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

      <span className={`badge ${gradeTone(promedio)}`}>{fmt(promedio)}</span>
    </div>
  );
}

function SectionButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={active ? "" : "btn-ghost"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Analiticas() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [section, setSection] = useState("resumen");
  const [query, setQuery] = useState("");
  const [materiaFilter, setMateriaFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState("promedio_asc");
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);

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
  const distribucion = data?.distribucionRendimiento || {};

  const promedioPorMateria = useMemo(() => {
    return toArray(data?.promedioPorMateria);
  }, [data]);

  const materiasCriticas = useMemo(() => {
    return toArray(data?.materiasCriticas);
  }, [data]);

  const alumnosResumen = useMemo(() => {
    return toArray(data?.alumnosResumen);
  }, [data]);

  const alumnosSinCalificaciones = useMemo(() => {
    return toArray(data?.alumnosSinCalificaciones).map((item) => ({
      ...item,
      promedio: null,
      totalCalificaciones: 0,
      nivel: "sin_calificaciones",
    }));
  }, [data]);

  const eventosProximos = useMemo(() => {
    return toArray(data?.eventosProximos);
  }, [data]);

  const topAlumnos = useMemo(() => {
    return toArray(data?.topAlumnos);
  }, [data]);

  const alumnosPrioritarios = useMemo(() => {
    return toArray(data?.alumnosPrioritarios || data?.alumnosResumen);
  }, [data]);

  const materiaOptions = useMemo(() => {
    return promedioPorMateria
      .filter((item) => item.materiaId || item.materiaNombre)
      .map((item) => ({
        value: String(item.materiaId || item.materiaNombre),
        label: item.materiaNombre || "Materia sin nombre",
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );
  }, [promedioPorMateria]);

  const allStudents = useMemo(() => {
    const map = new Map();

    for (const item of [...alumnosResumen, ...topAlumnos, ...alumnosPrioritarios]) {
      const key = normalizeText(item.email || item.nombre);

      if (key) {
        map.set(key, item);
      }
    }

    for (const item of alumnosSinCalificaciones) {
      const key = normalizeText(item.email || item.nombre);

      if (key && !map.has(key)) {
        map.set(key, item);
      }
    }

    return [...map.values()];
  }, [
    alumnosResumen,
    topAlumnos,
    alumnosPrioritarios,
    alumnosSinCalificaciones,
  ]);

  const filteredMaterias = useMemo(() => {
    const term = normalizeText(query);

    let items = [...promedioPorMateria];

    if (materiaFilter !== "ALL") {
      items = items.filter(
        (item) => String(item.materiaId || item.materiaNombre) === materiaFilter
      );
    }

    if (showOnlyCritical) {
      items = items.filter(
        (item) => safeNumber(item.promedio) > 0 && safeNumber(item.promedio) < 8
      );
    }

    if (term) {
      items = items.filter((item) =>
        normalizeText(item.materiaNombre).includes(term)
      );
    }

    return sortByMode(items, sortMode, "materiaNombre");
  }, [promedioPorMateria, materiaFilter, query, showOnlyCritical, sortMode]);

  const filteredCriticalMaterias = useMemo(() => {
    return filteredMaterias.filter(
      (item) => safeNumber(item.promedio) > 0 && safeNumber(item.promedio) < 8
    );
  }, [filteredMaterias]);

  const filteredStudents = useMemo(() => {
    const term = normalizeText(query);

    let items = [...allStudents];

    if (riskFilter !== "ALL") {
      items = items.filter((item) => item.nivel === riskFilter);
    }

    if (showOnlyCritical) {
      items = items.filter((item) =>
        ["riesgo_alto", "observacion", "sin_calificaciones"].includes(item.nivel)
      );
    }

    if (term) {
      items = items.filter((item) => {
        const searchable = [
          item.nombre,
          item.email,
          item.grupo,
          item.nivel,
          item.rendimiento,
        ]
          .filter(Boolean)
          .join(" ");

        return normalizeText(searchable).includes(term);
      });
    }

    return sortByMode(items, sortMode, "nombre");
  }, [allStudents, riskFilter, query, showOnlyCritical, sortMode]);

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

  const clearFilters = () => {
    setQuery("");
    setMateriaFilter("ALL");
    setRiskFilter("ALL");
    setSortMode("promedio_asc");
    setShowOnlyCritical(false);
  };

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
      `Alumnos en observación: ${resumen.alumnosObservacion || 0}`,
      `Alumnos sin calificaciones: ${resumen.alumnosSinCalificaciones || 0}`,
      `Tareas: ${resumen.totalTareas || 0}`,
      `Tareas pendientes: ${resumen.tareasPendientes || 0}`,
      `Tareas vencidas: ${resumen.tareasVencidas || 0}`,
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

  const showResumen = section === "resumen" || section === "todo";
  const showRendimiento = section === "rendimiento" || section === "todo";
  const showAlumnos = section === "alumnos" || section === "todo";
  const showSistema = section === "sistema" || section === "todo";

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Analíticas visuales</h1>

            <p className="msg">
              {getUserName(user)} · Panel filtrable de rendimiento académico y
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

        <section className="card">
          <h2>Vista y filtros</h2>

          <div className="row planWrap">
            {SECTION_OPTIONS.map((option) => (
              <SectionButton
                key={option.value}
                active={section === option.value}
                onClick={() => setSection(option.value)}
              >
                {option.label}
              </SectionButton>
            ))}
          </div>

          <div className="gridX planSpacingSmall">
            <label>
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Alumno, correo, grupo o materia"
                disabled={loading}
              />
            </label>

            <label>
              Materia
              <select
                value={materiaFilter}
                onChange={(event) => setMateriaFilter(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todas las materias</option>

                {materiaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Riesgo
              <select
                value={riskFilter}
                onChange={(event) => setRiskFilter(event.target.value)}
                disabled={loading}
              >
                {RISK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Orden
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
                disabled={loading}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className={showOnlyCritical ? "" : "btn-ghost"}
              onClick={() => setShowOnlyCritical((prev) => !prev)}
              disabled={loading}
            >
              {showOnlyCritical ? "Mostrando prioridad" : "Solo prioridad"}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={clearFilters}
              disabled={loading}
            >
              Limpiar filtros
            </button>

            <span className="badge">
              Materias: {filteredMaterias.length}
            </span>

            <span className="badge">
              Alumnos: {filteredStudents.length}
            </span>
          </div>
        </section>

        {resumenEjecutivo && showResumen && (
          <section className="card">
            <h2>Resumen ejecutivo</h2>

            <div className="lista">
              <div className="item">
                <div>
                  <strong>
                    Prioridad {resumenEjecutivo.prioridad || "general"}
                  </strong>

                  <p className="muted">
                    {resumenEjecutivo.mensaje ||
                      "No hay mensaje ejecutivo disponible."}
                  </p>

                  <p className="muted">
                    {resumenEjecutivo.recomendacion ||
                      "No hay recomendación disponible."}
                  </p>
                </div>

                <span
                  className={`badge ${
                    resumenEjecutivo.prioridad === "alta"
                      ? "bad"
                      : resumenEjecutivo.prioridad === "media"
                        ? "warn"
                        : "ok"
                  }`}
                >
                  Sistema
                </span>
              </div>
            </div>
          </section>
        )}

        {showResumen && (
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
                <div className="kpiTitle">En riesgo</div>
                <div className="kpiValue">{resumen.alumnosEnRiesgo || 0}</div>
                <span className="badge bad">Menor a 6</span>
              </div>

              <div className="kpi">
                <div className="kpiTitle">Observación</div>
                <div className="kpiValue">
                  {resumen.alumnosObservacion || 0}
                </div>
                <span className="badge warn">6 - 7.99</span>
              </div>

              <div className="kpi">
                <div className="kpiTitle">Estables</div>
                <div className="kpiValue">{resumen.alumnosEstables || 0}</div>
                <span className="badge ok">8 - 10</span>
              </div>

              <div className="kpi">
                <div className="kpiTitle">Sin calificaciones</div>
                <div className="kpiValue">
                  {resumen.alumnosSinCalificaciones || 0}
                </div>
              </div>
            </div>
          </section>
        )}

        {showResumen && (
          <section className="card">
            <h2>Distribución de rendimiento</h2>

            <div className="lista">
              <Bar
                label="Excelente"
                value={distribucion.excelente || 0}
                max={resumen.totalAlumnos || 1}
              />

              <Bar
                label="Bueno"
                value={distribucion.bueno || 0}
                max={resumen.totalAlumnos || 1}
              />

              <Bar
                label="Regular"
                value={distribucion.regular || 0}
                max={resumen.totalAlumnos || 1}
              />

              <Bar
                label="Riesgo"
                value={distribucion.riesgo || 0}
                max={resumen.totalAlumnos || 1}
              />

              <Bar
                label="Sin calificaciones"
                value={distribucion.sinCalificaciones || 0}
                max={resumen.totalAlumnos || 1}
              />
            </div>
          </section>
        )}

        {showResumen && (
          <section className="card">
            <h2>Indicadores principales</h2>

            <div className="lista">
              <Bar
                label="Alumnos en riesgo"
                value={getIndicator(
                  indicadores,
                  "porcentajeAlumnosEnRiesgo",
                  "porcentajeRiesgo"
                )}
                max={100}
                suffix="%"
              />

              <Bar
                label="Alumnos estables"
                value={getIndicator(indicadores, "porcentajeAlumnosEstables")}
                max={100}
                suffix="%"
              />

              <Bar
                label="Tareas completadas"
                value={getIndicator(
                  indicadores,
                  "porcentajeTareasCompletadas"
                )}
                max={100}
                suffix="%"
              />

              <Bar
                label="Materias con calificaciones"
                value={getIndicator(
                  indicadores,
                  "porcentajeMateriasConCalificaciones"
                )}
                max={100}
                suffix="%"
              />
            </div>
          </section>
        )}

        {showRendimiento && (
          <section className="card">
            <h2>Promedio por materia</h2>

            <p className="msg">
              Usa los filtros de arriba para revisar una materia específica o
              mostrar solo áreas prioritarias.
            </p>

            <div className="lista">
              {filteredMaterias.map((item) => (
                <GradeBar
                  key={item.materiaId || item.materiaNombre}
                  item={item}
                />
              ))}

              {!filteredMaterias.length && (
                <p className="msg">
                  {loading
                    ? "Cargando promedios..."
                    : "No hay materias que coincidan con los filtros."}
                </p>
              )}
            </div>
          </section>
        )}

        {showRendimiento && (
          <section className="card">
            <h2>Materias que requieren atención</h2>

            <div className="lista">
              {filteredCriticalMaterias.map((item) => (
                <GradeBar
                  key={item.materiaId || item.materiaNombre}
                  item={item}
                />
              ))}

              {!filteredCriticalMaterias.length && (
                <p className="msg">
                  No hay materias críticas con los filtros actuales.
                </p>
              )}
            </div>
          </section>
        )}

        {showAlumnos && (
          <section className="card">
            <h2>Alumnos filtrados</h2>

            <p className="msg">
              El listado responde al buscador, riesgo y orden seleccionados.
            </p>

            <div className="lista">
              {filteredStudents.map((item) => (
                <div className="item" key={item.email || item.id || item.nombre}>
                  <div>
                    <strong>{item.nombre || item.email}</strong>

                    <p className="muted">
                      {item.email || "Sin correo"}{" "}
                      {item.grupo ? `· Grupo: ${item.grupo}` : ""} · Promedio:{" "}
                      {fmt(item.promedio)} · Registros:{" "}
                      {item.totalCalificaciones || 0}
                    </p>
                  </div>

                  <span className={`badge ${riskTone(item.nivel)}`}>
                    {riskLabel(item.nivel)}
                  </span>
                </div>
              ))}

              {!filteredStudents.length && (
                <p className="msg">
                  {loading
                    ? "Cargando alumnos..."
                    : "No hay alumnos que coincidan con los filtros."}
                </p>
              )}
            </div>
          </section>
        )}

        {showAlumnos && !!topAlumnos.length && (
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

        {showSistema && (
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
        )}

        {showSistema && (
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
        )}

        {showSistema && (
          <section className="card">
            <h2>Eventos próximos</h2>

            <div className="lista">
              {eventosProximos.map((item) => (
                <div className="item" key={item.id}>
                  <div>
                    <strong>{item.title || "Evento sin título"}</strong>

                    <p className="muted">
                      {formatDate(item.startAt)} ·{" "}
                      {item.materiaNombre || "General"}
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
        )}

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
