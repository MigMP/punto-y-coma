import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function gradeClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n < 6) return "bad";
  if (n < 8) return "warn";
  return "ok";
}

function statusText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Sin datos";
  if (n < 6) return "Riesgo alto";
  if (n < 8) return "En observación";
  return "Estable";
}

function csvEscape(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);
  const [materias, setMaterias] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [filtroMateria, setFiltroMateria] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadReportes = async () => {
    try {
      setLoading(true);

      const [materiasData, calificacionesData] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/calificaciones", { token }),
      ]);

      setMaterias(Array.isArray(materiasData) ? materiasData : []);
      setCalificaciones(Array.isArray(calificacionesData) ? calificacionesData : []);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar reportes",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calificacionesFiltradas = useMemo(() => {
    if (filtroMateria === "ALL") return calificaciones;
    return calificaciones.filter((item) => String(item.materiaId) === String(filtroMateria));
  }, [calificaciones, filtroMateria]);

  const materiaStats = useMemo(() => {
    const map = new Map();

    for (const item of calificacionesFiltradas) {
      const materiaId = String(item.materiaId || "");
      const calificacion = Number(item.calificacion);

      if (!materiaId || !Number.isFinite(calificacion)) continue;

      const materiaNombre =
        item.materiaNombre ||
        materias.find((materia) => String(materia.id) === materiaId)?.nombre ||
        "Materia";

      if (!map.has(materiaId)) {
        map.set(materiaId, {
          materiaId,
          materia: materiaNombre,
          valores: [],
          alumnos: new Set(),
        });
      }

      map.get(materiaId).valores.push(calificacion);
      map.get(materiaId).alumnos.add(String(item.alumnoEmail || "").toLowerCase());
    }

    return [...map.values()]
      .map((item) => {
        const promedio = item.valores.reduce((acc, value) => acc + value, 0) / item.valores.length;
        const min = Math.min(...item.valores);
        const max = Math.max(...item.valores);

        return {
          materiaId: item.materiaId,
          materia: item.materia,
          promedio,
          min,
          max,
          registros: item.valores.length,
          alumnos: item.alumnos.size,
        };
      })
      .sort((a, b) => a.promedio - b.promedio);
  }, [calificacionesFiltradas, materias]);

  const alumnosStats = useMemo(() => {
    const map = new Map();

    for (const item of calificacionesFiltradas) {
      const email = String(item.alumnoEmail || "").toLowerCase();
      const calificacion = Number(item.calificacion);

      if (!email || !Number.isFinite(calificacion)) continue;

      if (!map.has(email)) {
        map.set(email, {
          email,
          nombre: item.alumnoNombre || email,
          valores: [],
          materias: new Set(),
        });
      }

      map.get(email).valores.push(calificacion);
      map.get(email).materias.add(String(item.materiaNombre || item.materiaId || "Materia"));
    }

    return [...map.values()]
      .map((item) => {
        const promedio = item.valores.reduce((acc, value) => acc + value, 0) / item.valores.length;

        return {
          email: item.email,
          nombre: item.nombre,
          promedio,
          registros: item.valores.length,
          materias: item.materias.size,
        };
      })
      .sort((a, b) => a.promedio - b.promedio);
  }, [calificacionesFiltradas]);

  const resumen = useMemo(() => {
    const valores = calificacionesFiltradas
      .map((item) => Number(item.calificacion))
      .filter(Number.isFinite);

    const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    const reprobadas = valores.filter((value) => value < 6).length;
    const riesgo = valores.filter((value) => value >= 6 && value < 8).length;
    const estables = valores.filter((value) => value >= 8).length;

    return {
      promedio,
      registros: valores.length,
      reprobadas,
      riesgo,
      estables,
      alumnos: alumnosStats.length,
      materias: materiaStats.length,
    };
  }, [calificacionesFiltradas, alumnosStats.length, materiaStats.length]);

  const copyReport = async () => {
    const lines = [
      "Reporte académico - Punto y Coma",
      "",
      `Usuario: ${user?.name || "Usuario"}`,
      `Promedio general: ${fmt(resumen.promedio)}`,
      `Registros analizados: ${resumen.registros}`,
      `Alumnos evaluados: ${resumen.alumnos}`,
      `Materias analizadas: ${resumen.materias}`,
      `En riesgo alto: ${resumen.reprobadas}`,
      "",
      "Promedio por materia:",
      ...materiaStats.map((item) => `- ${item.materia}: ${fmt(item.promedio)} (${statusText(item.promedio)})`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Reporte copiado",
        message: "El resumen fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa permisos del navegador.",
      });
    }
  };

  const exportSummaryCSV = () => {
    const rows = [
      ["Tipo", "Indicador", "Valor"],
      ["Resumen", "Promedio general", fmt(resumen.promedio)],
      ["Resumen", "Registros analizados", resumen.registros],
      ["Resumen", "Alumnos evaluados", resumen.alumnos],
      ["Resumen", "Materias analizadas", resumen.materias],
      ["Resumen", "Riesgo alto", resumen.reprobadas],
      ["Resumen", "En observación", resumen.riesgo],
      ["Resumen", "Estables", resumen.estables],
      [],
      ["Materia", "Promedio", "Estado", "Registros", "Alumnos", "Mínimo", "Máximo"],
      ...materiaStats.map((item) => [
        item.materia,
        fmt(item.promedio),
        statusText(item.promedio),
        item.registros,
        item.alumnos,
        fmt(item.min),
        fmt(item.max),
      ]),
    ];

    downloadCSV("reporte-academico-punto-y-coma.csv", rows);

    showToast({
      type: "success",
      title: "CSV generado",
      message: "El reporte fue descargado correctamente.",
    });
  };

  const exportGradesCSV = () => {
    const rows = [
      ["Alumno", "Correo", "Materia", "Calificación", "Estado", "Fecha creación", "Última actualización"],
      ...calificacionesFiltradas.map((item) => [
        item.alumnoNombre || "",
        item.alumnoEmail || "",
        item.materiaNombre || item.materiaId || "",
        fmt(item.calificacion),
        statusText(item.calificacion),
        item.createdAt || "",
        item.updatedAt || "",
      ]),
    ];

    downloadCSV("calificaciones-punto-y-coma.csv", rows);

    showToast({
      type: "success",
      title: "CSV generado",
      message: "Las calificaciones fueron descargadas correctamente.",
    });
  };

  const printReport = () => {
    window.print();
  };

  return (
    <>
      <NavBar />
      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Reportes académicos</h1>
            <p className="msg">
              {user?.name || "Usuario"} · Análisis general de rendimiento, materias y alumnos.
            </p>
          </div>

          <button type="button" className="btn-ghost" onClick={loadReportes}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Filtros del reporte</h2>

          <div className="row planWrap">
            <label className="metaLabel">
              <span className="muted">Materia</span>
              <select value={filtroMateria} onChange={(e) => setFiltroMateria(e.target.value)}>
                <option value="ALL">Todas las materias</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className="row metaActions">
              <button type="button" className="btn-ghost" onClick={copyReport}>
                Copiar reporte
              </button>

              <button type="button" className="btn-ghost" onClick={exportSummaryCSV}>
                Exportar resumen CSV
              </button>

              <button type="button" className="btn-ghost" onClick={exportGradesCSV}>
                Exportar calificaciones CSV
              </button>

              <button type="button" onClick={printReport}>
                Imprimir
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Resumen general</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio</div>
              <div className="kpiValue">{loading ? "..." : fmt(resumen.promedio)}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Registros</div>
              <div className="kpiValue">{resumen.registros}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Alumnos</div>
              <div className="kpiValue">{resumen.alumnos}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{resumen.materias}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Distribución de rendimiento</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Riesgo alto</strong>
                <p className="muted">Calificaciones menores a 6.</p>
              </div>

              <span className="badge bad">{resumen.reprobadas}</span>
            </div>

            <div className="item">
              <div>
                <strong>En observación</strong>
                <p className="muted">Calificaciones desde 6 hasta menos de 8.</p>
              </div>

              <span className="badge warn">{resumen.riesgo}</span>
            </div>

            <div className="item">
              <div>
                <strong>Rendimiento estable</strong>
                <p className="muted">Calificaciones iguales o superiores a 8.</p>
              </div>

              <span className="badge ok">{resumen.estables}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Promedio por materia</h2>

          <div className="lista">
            {materiaStats.map((materia) => (
              <div className="item" key={materia.materiaId}>
                <div className="textClamp">
                  <strong>{materia.materia}</strong>
                  <p className="muted">
                    {materia.registros} registro(s) · {materia.alumnos} alumno(s) · mínimo {fmt(materia.min)} · máximo {fmt(materia.max)}
                  </p>
                </div>

                <span className={`badge ${gradeClass(materia.promedio)}`}>
                  {fmt(materia.promedio)}
                </span>
              </div>
            ))}

            {!materiaStats.length && (
              <p className="msg">
                {loading ? "Cargando reporte..." : "No hay datos suficientes para mostrar materias."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Alumnos con mayor prioridad</h2>

          <div className="lista">
            {alumnosStats.slice(0, 8).map((alumno) => (
              <div className="item" key={alumno.email}>
                <div className="textClamp">
                  <strong>{alumno.nombre}</strong>
                  <p className="muted">
                    {alumno.email} · {alumno.registros} registro(s) · {alumno.materias} materia(s)
                  </p>
                </div>

                <span className={`badge ${gradeClass(alumno.promedio)}`}>
                  {fmt(alumno.promedio)}
                </span>
              </div>
            ))}

            {!alumnosStats.length && (
              <p className="msg">
                {loading ? "Cargando alumnos..." : "No hay alumnos para analizar."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
