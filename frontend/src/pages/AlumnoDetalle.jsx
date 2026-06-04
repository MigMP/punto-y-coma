import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

function decodeEmail(value) {
  try {
    return decodeURIComponent(value || "").toLowerCase();
  } catch {
    return String(value || "").toLowerCase();
  }
}

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

function getStatus(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      className: "",
      label: "Sin datos",
      message: "Este alumno aún no tiene calificaciones registradas.",
    };
  }
  if (n < 6) {
    return {
      className: "bad",
      label: "Riesgo alto",
      message: "Requiere intervención académica inmediata y seguimiento semanal.",
    };
  }
  if (n < 8) {
    return {
      className: "warn",
      label: "En observación",
      message: "Tiene avance aceptable, pero debe reforzar materias específicas.",
    };
  }
  return {
    className: "ok",
    label: "Estable",
    message: "Mantiene un desempeño favorable. La prioridad es conservar constancia.",
  };
}

function buildAdvice(stats) {
  if (!stats.registros) {
    return "Primero se necesitan calificaciones registradas para generar recomendaciones.";
  }
  if (stats.promedio < 6) {
    return "Recomendación: revisar materias críticas, programar asesoría y priorizar actividades de recuperación.";
  }
  if (stats.promedio < 8) {
    return "Recomendación: reforzar las materias con promedio más bajo y revisar avances cada semana.";
  }
  return "Recomendación: mantener el ritmo actual y usar ejercicios de mayor dificultad para consolidar conocimientos.";
}

function toCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

function downloadCSV(filename, rows) {
  const blob = new Blob(["\ufeff" + toCSV(rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AlumnoDetalle() {
  const { email } = useParams();
  const alumnoEmail = decodeEmail(email);
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);

  const [alumnos, setAlumnos] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadDetalle = async () => {
    try {
      setLoading(true);
      const [alumnosData, calificacionesData, materiasData] = await Promise.all([
        apiJSON("/alumnos", { token }),
        apiJSON("/calificaciones", { token }),
        apiJSON("/materias", { token }),
      ]);

      setAlumnos(Array.isArray(alumnosData) ? alumnosData : []);
      setCalificaciones(Array.isArray(calificacionesData) ? calificacionesData : []);
      setMaterias(Array.isArray(materiasData) ? materiasData : []);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el expediente",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetalle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoEmail]);

  const alumno = useMemo(() => {
    return alumnos.find((item) => String(item.email || "").toLowerCase() === alumnoEmail);
  }, [alumnos, alumnoEmail]);

  const registros = useMemo(() => {
    return calificaciones
      .filter((item) => String(item.alumnoEmail || "").toLowerCase() === alumnoEmail)
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
  }, [calificaciones, alumnoEmail]);

  const materiaStats = useMemo(() => {
    const map = new Map();

    for (const registro of registros) {
      const materiaId = String(registro.materiaId || "");
      const calificacion = Number(registro.calificacion);

      if (!materiaId || !Number.isFinite(calificacion)) continue;

      const materiaNombre =
        registro.materiaNombre ||
        materias.find((materia) => String(materia.id) === materiaId)?.nombre ||
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
      .map((item) => {
        const promedio = item.valores.reduce((acc, value) => acc + value, 0) / item.valores.length;
        return {
          ...item,
          promedio,
          registros: item.valores.length,
          min: Math.min(...item.valores),
          max: Math.max(...item.valores),
        };
      })
      .sort((a, b) => a.promedio - b.promedio);
  }, [registros, materias]);

  const stats = useMemo(() => {
    const valores = registros
      .map((registro) => Number(registro.calificacion))
      .filter(Number.isFinite);

    const promedio = valores.length
      ? valores.reduce((acc, value) => acc + value, 0) / valores.length
      : null;

    return {
      promedio,
      registros: valores.length,
      materias: materiaStats.length,
      riesgo: materiaStats.filter((materia) => materia.promedio < 7).length,
      mejor: materiaStats.length ? [...materiaStats].sort((a, b) => b.promedio - a.promedio)[0] : null,
      critica: materiaStats.length ? materiaStats[0] : null,
    };
  }, [registros, materiaStats]);

  const status = getStatus(stats.promedio);
  const advice = buildAdvice(stats);

  const copyExpediente = async () => {
    const lines = [
      "Expediente académico - Punto y Coma",
      "",
      `Alumno: ${alumno?.name || alumnoEmail}`,
      `Correo: ${alumnoEmail}`,
      `Grupo: ${alumno?.grupo || "—"}`,
      `Boleta: ${alumno?.boleta || "—"}`,
      `Promedio: ${fmt(stats.promedio)}`,
      `Estado: ${status.label}`,
      `Registros: ${stats.registros}`,
      `Materias evaluadas: ${stats.materias}`,
      "",
      "Recomendación:",
      advice,
      "",
      "Materias:",
      ...materiaStats.map((materia) => `- ${materia.materia}: ${fmt(materia.promedio)}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast({
        type: "success",
        title: "Expediente copiado",
        message: "El resumen del alumno fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa permisos del navegador.",
      });
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Alumno", "Correo", "Grupo", "Boleta", "Materia", "Calificación", "Fecha creación", "Última actualización"],
      ...registros.map((registro) => [
        alumno?.name || registro.alumnoNombre || alumnoEmail,
        alumnoEmail,
        alumno?.grupo || "",
        alumno?.boleta || "",
        registro.materiaNombre || registro.materiaId || "",
        fmt(registro.calificacion),
        registro.createdAt || "",
        registro.updatedAt || "",
      ]),
    ];

    downloadCSV(`expediente-${alumnoEmail}.csv`, rows);

    showToast({
      type: "success",
      title: "CSV generado",
      message: "El expediente fue descargado correctamente.",
    });
  };

  return (
    <>
      <NavBar />
      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Expediente académico</h1>
            <p className="msg">
              {alumno?.name || alumnoEmail} · Seguimiento individual del alumno.
            </p>
          </div>

          <div className="row planWrap">
            <Link to="/alumnos" className="badge">
              Volver
            </Link>

            <button type="button" className="btn-ghost" onClick={loadDetalle}>
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Resumen del alumno</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio</div>
              <div className="kpiValue">{loading ? "..." : fmt(stats.promedio)}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Registros</div>
              <div className="kpiValue">{stats.registros}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{stats.materias}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">En riesgo</div>
              <div className="kpiValue">{stats.riesgo}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Estado académico</h2>

          <div className="item">
            <div>
              <strong>{status.label}</strong>
              <p className="muted">{status.message}</p>
              <p className="muted">{advice}</p>
            </div>

            <span className={`badge ${status.className}`}>
              {fmt(stats.promedio)}
            </span>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button type="button" className="btn-ghost" onClick={copyExpediente}>
              Copiar expediente
            </button>

            <button type="button" className="btn-ghost" onClick={exportCSV}>
              Exportar CSV
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Datos escolares</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>{alumno?.name || "Alumno"}</strong>
                <p className="muted">{alumnoEmail}</p>
              </div>
              <span className="badge ok">Alumno</span>
            </div>

            <div className="item">
              <div>
                <strong>Grupo</strong>
                <p className="muted">{alumno?.grupo || "No registrado"}</p>
              </div>
              <span className="badge">{alumno?.grupo || "—"}</span>
            </div>

            <div className="item">
              <div>
                <strong>Boleta</strong>
                <p className="muted">Identificador escolar del alumno.</p>
              </div>
              <span className="badge">{alumno?.boleta || "—"}</span>
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
                    {materia.registros} registro(s) · mínimo {fmt(materia.min)} · máximo {fmt(materia.max)}
                  </p>
                </div>

                <span className={`badge ${gradeClass(materia.promedio)}`}>
                  {fmt(materia.promedio)}
                </span>
              </div>
            ))}

            {!materiaStats.length && (
              <p className="msg">
                {loading ? "Cargando materias..." : "Este alumno aún no tiene materias evaluadas."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Historial de calificaciones</h2>

          <div className="lista">
            {registros.map((registro) => (
              <div className="item" key={registro.id}>
                <div className="textClamp">
                  <strong>{registro.materiaNombre || "Materia"}</strong>
                  <p className="muted">
                    Registrado por {registro.creadoPor || "maestro"} · {registro.updatedAt || registro.createdAt || "sin fecha"}
                  </p>
                </div>

                <span className={`badge ${gradeClass(registro.calificacion)}`}>
                  {fmt(registro.calificacion)}
                </span>
              </div>
            ))}

            {!registros.length && (
              <p className="msg">
                {loading ? "Cargando historial..." : "No hay calificaciones registradas para este alumno."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Lectura rápida</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Materia más fuerte</strong>
                <p className="muted">
                  {stats.mejor ? stats.mejor.materia : "Aún no hay datos suficientes."}
                </p>
              </div>
              <span className={`badge ${gradeClass(stats.mejor?.promedio)}`}>
                {stats.mejor ? fmt(stats.mejor.promedio) : "—"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Materia con prioridad</strong>
                <p className="muted">
                  {stats.critica ? stats.critica.materia : "Aún no hay datos suficientes."}
                </p>
              </div>
              <span className={`badge ${gradeClass(stats.critica?.promedio)}`}>
                {stats.critica ? fmt(stats.critica.promedio) : "—"}
              </span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
