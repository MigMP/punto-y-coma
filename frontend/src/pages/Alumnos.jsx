// Archivo: frontend/src/pages/Alumnos.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function getStudentName(alumno) {
  return alumno?.nombre || alumno?.name || alumno?.email || "Alumno";
}

function academicStatus(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return {
      className: "",
      label: "Sin datos",
      description: "Aún no tiene calificaciones registradas.",
    };
  }

  if (n < 6) {
    return {
      className: "bad",
      label: "Riesgo alto",
      description: "Necesita atención inmediata para evitar reprobación.",
    };
  }

  if (n < 8) {
    return {
      className: "warn",
      label: "En observación",
      description: "Tiene avance aceptable, pero requiere refuerzo.",
    };
  }

  return {
    className: "ok",
    label: "Estable",
    description: "Mantiene un rendimiento académico favorable.",
  };
}

export default function Alumnos() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [alumnos, setAlumnos] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState("RIESGO");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadAlumnos = useCallback(async () => {
    if (!token) {
      setAlumnos([]);
      setCalificaciones([]);
      setMaterias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [alumnosData, calificacionesData, materiasData] =
        await Promise.all([
          apiJSON("/alumnos", { token }),
          apiJSON("/calificaciones", { token }),
          apiJSON("/materias", { token }),
        ]);

      setAlumnos(toArray(alumnosData));
      setCalificaciones(toArray(calificacionesData));
      setMaterias(toArray(materiasData));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar alumnos",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadAlumnos();
  }, [loadAlumnos]);

  const alumnosAnalizados = useMemo(() => {
    return alumnos.map((alumno) => {
      const email = String(alumno.email || "").toLowerCase();

      const registros = calificaciones.filter(
        (calificacion) =>
          String(calificacion.alumnoEmail || "").toLowerCase() === email
      );

      const valores = registros
        .map((registro) => Number(registro.calificacion))
        .filter(Number.isFinite);

      const promedio = valores.length
        ? valores.reduce((acc, value) => acc + value, 0) / valores.length
        : null;

      const materiasEvaluadas = new Set(
        registros
          .map((registro) =>
            String(registro.materiaId || registro.materiaNombre || "")
          )
          .filter(Boolean)
      ).size;

      const materiasRiesgo = registros.filter(
        (registro) => Number(registro.calificacion) < 7
      ).length;

      const ultimoRegistro = [...registros].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();

        return dateB - dateA;
      })[0];

      return {
        ...alumno,
        nombreVisible: getStudentName(alumno),
        promedio,
        registros: registros.length,
        materiasEvaluadas,
        materiasRiesgo,
        ultimoRegistro,
        status: academicStatus(promedio),
      };
    });
  }, [alumnos, calificaciones]);

  const alumnosFiltrados = useMemo(() => {
    const term = query.trim().toLowerCase();
    let data = [...alumnosAnalizados];

    if (term) {
      data = data.filter((alumno) => {
        const searchable = [
          alumno.nombre,
          alumno.name,
          alumno.email,
          alumno.grupo,
          alumno.boleta,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    data.sort((a, b) => {
      const promedioA = Number.isFinite(a.promedio) ? a.promedio : null;
      const promedioB = Number.isFinite(b.promedio) ? b.promedio : null;

      if (orden === "NOMBRE") {
        return String(a.nombreVisible || "").localeCompare(
          String(b.nombreVisible || "")
        );
      }

      if (orden === "PROMEDIO_DESC") {
        return Number(promedioB ?? -1) - Number(promedioA ?? -1);
      }

      if (orden === "PROMEDIO_ASC") {
        return Number(promedioA ?? 99) - Number(promedioB ?? 99);
      }

      if (b.materiasRiesgo !== a.materiasRiesgo) {
        return Number(b.materiasRiesgo || 0) - Number(a.materiasRiesgo || 0);
      }

      return Number(promedioA ?? 99) - Number(promedioB ?? 99);
    });

    return data;
  }, [alumnosAnalizados, query, orden]);

  const resumen = useMemo(() => {
    const conDatos = alumnosAnalizados.filter((alumno) =>
      Number.isFinite(alumno.promedio)
    );

    const promedioGeneral = conDatos.length
      ? conDatos.reduce((acc, alumno) => acc + alumno.promedio, 0) /
        conDatos.length
      : null;

    const riesgoAlto = conDatos.filter((alumno) => alumno.promedio < 6).length;

    const observacion = conDatos.filter(
      (alumno) => alumno.promedio >= 6 && alumno.promedio < 8
    ).length;

    const estables = conDatos.filter((alumno) => alumno.promedio >= 8).length;

    return {
      total: alumnos.length,
      conDatos: conDatos.length,
      promedioGeneral,
      riesgoAlto,
      observacion,
      estables,
    };
  }, [alumnosAnalizados, alumnos.length]);

  const copyResumen = async () => {
    const lines = [
      "Seguimiento de alumnos - Punto y Coma",
      "",
      `Usuario: ${getUserName(user)}`,
      `Alumnos registrados: ${resumen.total}`,
      `Alumnos con calificaciones: ${resumen.conDatos}`,
      `Promedio general: ${fmt(resumen.promedioGeneral)}`,
      `Riesgo alto: ${resumen.riesgoAlto}`,
      `En observación: ${resumen.observacion}`,
      `Estables: ${resumen.estables}`,
      "",
      "Alumnos con prioridad:",
      ...alumnosFiltrados
        .slice(0, 8)
        .map(
          (alumno) =>
            `- ${alumno.nombreVisible}: ${fmt(alumno.promedio)} (${
              alumno.status.label
            })`
        ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "El seguimiento fue copiado al portapapeles.",
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
            <h1>Seguimiento de alumnos</h1>

            <p className="msg">
              {getUserName(user)} · Consulta alumnos, promedios, riesgos y
              registros académicos.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadAlumnos}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen del seguimiento</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Alumnos</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Con datos</div>
              <div className="kpiValue">{resumen.conDatos}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Promedio</div>
              <div className="kpiValue">
                {loading ? "..." : fmt(resumen.promedioGeneral)}
              </div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Riesgo alto</div>
              <div className="kpiValue">{resumen.riesgoAlto}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Filtros</h2>

          <div className="gridX">
            <label>
              Buscar alumno
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, correo, grupo o boleta"
                disabled={loading}
              />
            </label>

            <label>
              Ordenar por
              <select
                value={orden}
                onChange={(event) => setOrden(event.target.value)}
                disabled={loading}
              >
                <option value="RIESGO">Mayor riesgo</option>
                <option value="PROMEDIO_ASC">Promedio más bajo</option>
                <option value="PROMEDIO_DESC">Promedio más alto</option>
                <option value="NOMBRE">Nombre</option>
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className="btn-ghost"
              onClick={copyResumen}
              disabled={loading || !alumnosFiltrados.length}
            >
              Copiar resumen
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Distribución académica</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Riesgo alto</strong>
                <p className="muted">Alumnos con promedio menor a 6.</p>
              </div>

              <span className="badge bad">{resumen.riesgoAlto}</span>
            </div>

            <div className="item">
              <div>
                <strong>En observación</strong>
                <p className="muted">Alumnos con promedio entre 6 y 7.99.</p>
              </div>

              <span className="badge warn">{resumen.observacion}</span>
            </div>

            <div className="item">
              <div>
                <strong>Estables</strong>
                <p className="muted">Alumnos con promedio igual o mayor a 8.</p>
              </div>

              <span className="badge ok">{resumen.estables}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Alumnos registrados</h2>

          <div className="lista">
            {alumnosFiltrados.map((alumno) => (
              <div className="item" key={alumno.email}>
                <div className="textClamp">
                  <strong>{alumno.nombreVisible}</strong>

                  <p className="muted">
                    {alumno.email} · Grupo {alumno.grupo || "—"} · Boleta{" "}
                    {alumno.boleta || "—"}
                  </p>

                  <p className="muted">
                    {alumno.registros} registro(s) ·{" "}
                    {alumno.materiasEvaluadas} materia(s) ·{" "}
                    {alumno.status.description}
                  </p>
                </div>

                <div className="right">
                  <span className={`badge ${alumno.status.className}`}>
                    {alumno.status.label}
                  </span>

                  <span className={`badge ${gradeClass(alumno.promedio)}`}>
                    {fmt(alumno.promedio)}
                  </span>

                  <Link
                    to={`/alumnos/${encodeURIComponent(alumno.email)}`}
                    className="badge ok"
                  >
                    Ver expediente
                  </Link>
                </div>
              </div>
            ))}

            {!alumnosFiltrados.length && (
              <p className="msg">
                {loading
                  ? "Cargando alumnos..."
                  : "No hay alumnos que coincidan con la búsqueda."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Materias disponibles</h2>

          <div className="lista">
            {materias.map((materia) => (
              <div className="item" key={materia.id}>
                <div>
                  <strong>{materia.nombre}</strong>
                  <p className="muted">Materia registrada en la plataforma.</p>
                </div>

                <span className="badge">{materia.id}</span>
              </div>
            ))}

            {!materias.length && (
              <p className="msg">
                {loading
                  ? "Cargando materias..."
                  : "No hay materias registradas."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}