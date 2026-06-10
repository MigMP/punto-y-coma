// Archivo: frontend/src/pages/Dashboard.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { computeInsights } from "../features/study/studyCoach.js";

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

function roleLabel(role) {
  const labels = {
    alumno: "Alumno",
    maestro: "Maestro",
    administrador: "Administrador",
  };

  return labels[role] || "Usuario";
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

function gradeTone(value) {
  if (value === null || value === undefined || value === "" || value === "—") {
    return "";
  }

  const n = Number(value);

  if (!Number.isFinite(n)) return "";
  if (n < 6) return "bad";
  if (n < 8) return "warn";

  return "ok";
}

function statusLabel(status) {
  if (status === "en_progreso") return "En progreso";
  if (status === "completada") return "Completada";

  return "Pendiente";
}

function statusTone(status) {
  if (status === "completada") return "ok";
  if (status === "en_progreso") return "warn";

  return "";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

export default function Dashboard() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [materias, setMaterias] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [maestros, setMaestros] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAlumno = user?.role === "alumno";
  const isMaestro = user?.role === "maestro";
  const isAdmin = user?.role === "administrador";

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [
        materiasData,
        calificacionesData,
        tareasData,
        notificacionesData,
        calendarioData,
        recursosData,
      ] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/calificaciones", { token }),
        apiJSON("/tareas", { token }),
        apiJSON("/notificaciones", { token }),
        apiJSON("/calendario?upcoming=true", { token }),
        apiJSON("/recursos", { token }),
      ]);

      setMaterias(toArray(materiasData));
      setCalificaciones(toArray(calificacionesData));
      setTareas(toArray(tareasData));
      setNotificaciones(toArray(notificacionesData));
      setCalendario(toArray(calendarioData));
      setRecursos(toArray(recursosData));

      if (isAdmin) {
        const [maestrosData, asignacionesData] = await Promise.all([
          apiJSON("/maestros", { token }),
          apiJSON("/asignaciones", { token }),
        ]);

        setMaestros(toArray(maestrosData));
        setAsignaciones(toArray(asignacionesData));
      } else {
        setMaestros([]);
        setAsignaciones([]);
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el panel",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const insights = useMemo(() => {
    return computeInsights(calificaciones);
  }, [calificaciones]);

  const promedioGeneral = Number.isFinite(insights.overall)
    ? insights.overall
    : null;

  const materiasEvaluadas = useMemo(() => {
    return new Set(
      calificaciones
        .map((item) => String(item.materiaId || ""))
        .filter(Boolean)
    ).size;
  }, [calificaciones]);

  const alumnosEvaluados = useMemo(() => {
    return new Set(
      calificaciones
        .map((item) => String(item.alumnoEmail || "").toLowerCase())
        .filter(Boolean)
    ).size;
  }, [calificaciones]);

  const tareasPendientes = useMemo(() => {
    return tareas.filter((item) => item.status !== "completada").length;
  }, [tareas]);

  const notificacionesNoLeidas = useMemo(() => {
    return notificaciones.filter((item) => !item.read).length;
  }, [notificaciones]);

  const proximosEventos = useMemo(() => {
    return [...calendario]
      .sort((a, b) => {
        const dateA = new Date(a.startAt || 0).getTime();
        const dateB = new Date(b.startAt || 0).getTime();

        return dateA - dateB;
      })
      .slice(0, 3);
  }, [calendario]);

  const tareasRecientes = useMemo(() => {
    return [...tareas]
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 3);
  }, [tareas]);

  const recursosRecientes = useMemo(() => {
    return [...recursos]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 3);
  }, [recursos]);

  const title = useMemo(() => {
    if (isAdmin) return "Centro de administración";
    if (isMaestro) return "Panel docente";

    return "Panel académico";
  }, [isAdmin, isMaestro]);

  const subtitle = useMemo(() => {
    if (isAdmin) return "Control general del sistema académico.";
    if (isMaestro) return "Seguimiento, calificaciones y apoyo para tus alumnos.";

    return "Tu resumen académico, tareas y recursos importantes.";
  }, [isAdmin, isMaestro]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: "Plan de estudio",
        description: "Ver recomendaciones de mejora.",
        to: "/plan",
        roles: ["alumno"],
      },
      {
        title: "Capturar",
        description: "Registrar calificaciones.",
        to: "/capturar",
        roles: ["maestro"],
      },
      {
        title: "Administración",
        description: "Materias, maestros y asignaciones.",
        to: "/admin",
        roles: ["administrador"],
      },
      {
        title: "Tareas",
        description: "Pendientes y seguimiento.",
        to: "/tareas",
        roles: ["alumno", "maestro", "administrador"],
      },
      {
        title: "Calendario",
        description: "Exámenes, entregas y avisos.",
        to: "/calendario",
        roles: ["alumno", "maestro", "administrador"],
      },
      {
        title: "Recursos",
        description: "Materiales de apoyo.",
        to: "/recursos",
        roles: ["alumno", "maestro", "administrador"],
      },
      {
        title: "Analíticas",
        description: "Métricas generales.",
        to: "/analiticas",
        roles: ["maestro", "administrador"],
      },
      {
        title: "Notificaciones",
        description: "Avisos recientes.",
        to: "/notificaciones",
        roles: ["alumno", "maestro", "administrador"],
      },
    ];

    return actions.filter((action) => action.roles.includes(user?.role));
  }, [user?.role]);

  const mainStats = useMemo(() => {
    if (isAdmin) {
      return [
        { label: "Materias", value: materias.length },
        { label: "Maestros", value: maestros.length },
        { label: "Asignaciones", value: asignaciones.length },
        { label: "Avisos nuevos", value: notificacionesNoLeidas },
      ];
    }

    if (isMaestro) {
      return [
        { label: "Materias", value: materias.length },
        { label: "Registros", value: calificaciones.length },
        { label: "Alumnos", value: alumnosEvaluados },
        { label: "Promedio", value: fmt(promedioGeneral) },
      ];
    }

    return [
      { label: "Promedio", value: fmt(promedioGeneral) },
      { label: "Materias", value: materiasEvaluadas },
      { label: "Tareas", value: tareasPendientes },
      { label: "Avisos", value: notificacionesNoLeidas },
    ];
  }, [
    isAdmin,
    isMaestro,
    materias.length,
    maestros.length,
    asignaciones.length,
    notificacionesNoLeidas,
    calificaciones.length,
    alumnosEvaluados,
    promedioGeneral,
    materiasEvaluadas,
    tareasPendientes,
  ]);

  const recientes = useMemo(() => {
    const items = [];

    for (const task of tareasRecientes) {
      items.push({
        id: `tarea-${task.id}`,
        title: task.titulo || "Tarea sin título",
        description: `${task.materiaNombre || "Materia"} · ${statusLabel(
          task.status
        )}`,
        badge: "Tarea",
        tone: statusTone(task.status),
        to: "/tareas",
      });
    }

    for (const event of proximosEventos) {
      items.push({
        id: `evento-${event.id}`,
        title: event.title || "Evento sin título",
        description: `${formatDate(event.startAt)} · ${
          event.materiaNombre || "General"
        }`,
        badge: "Evento",
        tone: "",
        to: "/calendario",
      });
    }

    for (const resource of recursosRecientes) {
      items.push({
        id: `recurso-${resource.id}`,
        title: resource.title || "Recurso sin título",
        description: resource.materiaNombre || "General",
        badge: "Recurso",
        tone: "ok",
        to: "/recursos",
      });
    }

    return items.slice(0, 6);
  }, [tareasRecientes, proximosEventos, recursosRecientes]);

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>{title}</h1>

            <p className="msg">
              {getUserName(user)} · {roleLabel(user?.role)}
            </p>

            <p className="msg">{subtitle}</p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadDashboard}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen</h2>

          <div className="coachRow">
            {mainStats.map((item) => (
              <div className="kpi" key={item.label}>
                <div className="kpiTitle">{item.label}</div>

                <div
                  className={`kpiValue ${
                    item.label === "Promedio" ? gradeTone(item.value) : ""
                  }`}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Accesos rápidos</h2>

          <div className="lista">
            {quickActions.map((action) => (
              <div className="item" key={action.to}>
                <div>
                  <strong>{action.title}</strong>
                  <p className="muted">{action.description}</p>
                </div>

                <Link to={action.to} className="badge ok">
                  Abrir
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Reciente</h2>

          <div className="lista">
            {recientes.map((item) => (
              <div className="item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.description}</p>
                </div>

                <Link to={item.to} className={`badge ${item.tone}`}>
                  {item.badge}
                </Link>
              </div>
            ))}

            {!recientes.length && (
              <p className="msg">
                {loading
                  ? "Cargando información..."
                  : "Todavía no hay movimientos recientes."}
              </p>
            )}
          </div>
        </section>

        {isAlumno && (
          <section className="card">
            <h2>Estado académico</h2>

            <div className="lista">
              <div className="item">
                <div>
                  <strong>Promedio general</strong>
                  <p className="muted">
                    Revisa tu avance y usa el plan de estudio para reforzar
                    materias.
                  </p>
                </div>

                <span className={`badge ${gradeTone(promedioGeneral)}`}>
                  {fmt(promedioGeneral)}
                </span>
              </div>

              <div className="item">
                <div>
                  <strong>Material de apoyo</strong>
                  <p className="muted">
                    Consulta recursos y próximos eventos antes de exámenes o
                    entregas.
                  </p>
                </div>

                <Link to="/recursos" className="badge ok">
                  Ver recursos
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}