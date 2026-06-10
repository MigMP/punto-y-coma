// Archivo: frontend/src/pages/Actividad.jsx

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

function activityTone(type) {
  const cleanType = String(type || "");

  if (cleanType.includes("eliminada") || cleanType.includes("eliminado")) {
    return "bad";
  }

  if (cleanType.includes("editada") || cleanType.includes("actualizada")) {
    return "warn";
  }

  if (cleanType.includes("creada") || cleanType.includes("registrada")) {
    return "ok";
  }

  return "";
}

function activityLabel(type) {
  const labels = {
    materia_creada: "Materia creada",
    materia_eliminada: "Materia eliminada",
    asignacion_creada: "Asignación creada",
    asignacion_eliminada: "Asignación eliminada",
    calificacion_creada: "Calificación registrada",
    calificacion_editada: "Calificación editada",
    calificacion_eliminada: "Calificación eliminada",
    tarea_creada: "Tarea creada",
    tarea_actualizada: "Tarea actualizada",
    tarea_eliminada: "Tarea eliminada",
    recurso_creado: "Recurso creado",
    recurso_eliminado: "Recurso eliminado",
    evento_creado: "Evento creado",
    evento_eliminado: "Evento eliminado",
    usuario_actualizado: "Usuario actualizado",
  };

  return labels[type] || "Actividad";
}

function getActorName(actor) {
  return actor?.nombre || actor?.name || actor?.email || "Usuario";
}

export default function Actividad() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [actividad, setActividad] = useState([]);
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadActividad = useCallback(async () => {
    if (!token) {
      setActividad([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const query =
        type === "ALL"
          ? "/actividad?limit=100"
          : `/actividad?limit=100&type=${encodeURIComponent(type)}`;

      const data = await apiJSON(query, { token });

      setActividad(toArray(data));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar actividad",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, type, showToast]);

  useEffect(() => {
    loadActividad();
  }, [loadActividad]);

  const tiposDisponibles = useMemo(() => {
    return [
      "materia_creada",
      "materia_eliminada",
      "asignacion_creada",
      "asignacion_eliminada",
      "calificacion_creada",
      "calificacion_editada",
      "calificacion_eliminada",
      "tarea_creada",
      "tarea_actualizada",
      "tarea_eliminada",
      "recurso_creado",
      "recurso_eliminado",
      "evento_creado",
      "evento_eliminado",
      "usuario_actualizado",
    ];
  }, []);

  const resumen = useMemo(() => {
    const total = actividad.length;

    const creaciones = actividad.filter((item) => {
      const cleanType = String(item.type || "");
      return cleanType.includes("creada") || cleanType.includes("registrada");
    }).length;

    const ediciones = actividad.filter((item) => {
      const cleanType = String(item.type || "");
      return cleanType.includes("editada") || cleanType.includes("actualizada");
    }).length;

    const eliminaciones = actividad.filter((item) => {
      const cleanType = String(item.type || "");
      return cleanType.includes("eliminada") || cleanType.includes("eliminado");
    }).length;

    return {
      total,
      creaciones,
      ediciones,
      eliminaciones,
    };
  }, [actividad]);

  const copyActivity = async () => {
    const lines = [
      "Historial de actividad - Punto y Coma",
      "",
      `Usuario: ${user?.nombre || user?.name || "Administrador"}`,
      `Eventos mostrados: ${resumen.total}`,
      "",
      ...actividad.map((item) => {
        const actor = getActorName(item.actor);

        return `- ${formatDate(item.createdAt)} | ${activityLabel(
          item.type
        )} | ${actor} | ${item.description || "Sin descripción."}`;
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Actividad copiada",
        message: "El historial fue copiado al portapapeles.",
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
            <h1>Actividad del sistema</h1>

            <p className="msg">
              {user?.nombre || user?.name || "Administrador"} · Historial de
              acciones importantes realizadas en la plataforma.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadActividad}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen de actividad</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Eventos</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Creaciones</div>
              <div className="kpiValue">{resumen.creaciones}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Ediciones</div>
              <div className="kpiValue">{resumen.ediciones}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Eliminaciones</div>
              <div className="kpiValue">{resumen.eliminaciones}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Filtros</h2>

          <div className="gridX">
            <label>
              Tipo de evento
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todos los eventos</option>

                {tiposDisponibles.map((item) => (
                  <option value={item} key={item}>
                    {activityLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Acciones
              <div className="row planWrap">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={copyActivity}
                  disabled={loading || !actividad.length}
                >
                  Copiar historial
                </button>

                <button type="button" onClick={() => window.print()}>
                  Imprimir
                </button>
              </div>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Historial reciente</h2>

          <div className="lista">
            {actividad.map((item) => {
              const tone = activityTone(item.type);
              const actor = getActorName(item.actor);

              return (
                <div className="item" key={item.id || `${item.type}-${item.createdAt}`}>
                  <div className="textClamp">
                    <strong>{item.title || activityLabel(item.type)}</strong>

                    <p className="muted">
                      {item.description || "Sin descripción."}
                    </p>

                    <p className="muted">
                      {actor} · {item.actor?.role || "rol"} ·{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <span className={`badge ${tone}`}>
                    {activityLabel(item.type)}
                  </span>
                </div>
              );
            })}

            {!actividad.length && (
              <p className="msg">
                {loading
                  ? "Cargando actividad..."
                  : "Todavía no hay actividad registrada."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}