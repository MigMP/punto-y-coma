// Archivo: frontend/src/pages/Notificaciones.jsx

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

function notificationTone(type) {
  const text = String(type || "");

  if (text.includes("eliminada") || text.includes("eliminado")) return "bad";
  if (text.includes("editada") || text.includes("actualizada")) return "warn";
  if (text.includes("creada") || text.includes("registrada")) return "ok";

  return "";
}

function notificationLabel(type) {
  const labels = {
    tarea_creada: "Tarea creada",
    tarea_actualizada: "Tarea actualizada",
    tarea_eliminada: "Tarea eliminada",

    calificacion_creada: "Calificación registrada",
    calificacion_editada: "Calificación actualizada",
    calificacion_actualizada: "Calificación actualizada",
    calificacion_eliminada: "Calificación eliminada",

    materia_creada: "Materia creada",
    materia_eliminada: "Materia eliminada",

    asignacion_creada: "Asignación creada",
    asignacion_eliminada: "Asignación eliminada",

    recurso_creado: "Recurso creado",
    recurso_eliminado: "Recurso eliminado",

    evento_creado: "Evento creado",
    evento_eliminado: "Evento eliminado",

    usuario_actualizado: "Usuario actualizado",
    info: "Información",
  };

  return labels[type] || "Notificación";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

export default function Notificaciones() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [notificaciones, setNotificaciones] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRead, setDeletingRead] = useState(false);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotificaciones([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const path = unreadOnly
        ? "/notificaciones?unread=true"
        : "/notificaciones";

      const data = await apiJSON(path, { token });

      setNotificaciones(toArray(data));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar notificaciones",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, unreadOnly, showToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const notificacionesFiltradas = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return notificaciones;

    return notificaciones.filter((item) => {
      const searchable = [item.title, item.message, item.type, item.entity]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [notificaciones, query]);

  const resumen = useMemo(() => {
    const total = notificaciones.length;
    const unread = notificaciones.filter((item) => !item.read).length;
    const read = total - unread;
    const tareas = notificaciones.filter((item) =>
      String(item.type || "").includes("tarea")
    ).length;
    const calificaciones = notificaciones.filter((item) =>
      String(item.type || "").includes("calificacion")
    ).length;

    return {
      total,
      unread,
      read,
      tareas,
      calificaciones,
    };
  }, [notificaciones]);

  const markAsRead = async (notification) => {
    if (notification.read || saving || deletingRead) return;

    try {
      setSaving(true);

      await apiJSON(`/notificaciones/${notification.id}/read`, {
        token,
        method: "PATCH",
      });

      showToast({
        type: "success",
        title: "Notificación leída",
        message: notification.title || "Se marcó como leída.",
      });

      await loadNotifications();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo marcar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const markAllAsRead = async () => {
    if (!resumen.unread) {
      showToast({
        type: "info",
        title: "Sin pendientes",
        message: "No tienes notificaciones sin leer.",
      });
      return;
    }

    try {
      setSaving(true);

      const result = await apiJSON("/notificaciones/read-all", {
        token,
        method: "PATCH",
      });

      showToast({
        type: "success",
        title: "Notificaciones actualizadas",
        message: `Se marcaron ${
          result.updated || resumen.unread || 0
        } notificación(es) como leídas.`,
      });

      await loadNotifications();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo actualizar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteReadNotifications = async () => {
    if (!resumen.read) {
      showToast({
        type: "info",
        title: "Sin notificaciones leídas",
        message: "No tienes notificaciones leídas para eliminar.",
      });
      return;
    }

    try {
      setDeletingRead(true);

      const result = await apiJSON("/notificaciones/read", {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Notificaciones eliminadas",
        message: `Se eliminaron ${
          result.deleted || resumen.read || 0
        } notificación(es) leída(s).`,
      });

      await loadNotifications();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron eliminar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setDeletingRead(false);
    }
  };

  const copySummary = async () => {
    const lines = [
      "Notificaciones - Punto y Coma",
      "",
      `Usuario: ${getUserName(user)}`,
      `Total: ${resumen.total}`,
      `No leídas: ${resumen.unread}`,
      `Leídas: ${resumen.read}`,
      "",
      "Listado:",
      ...notificacionesFiltradas.map(
        (item) =>
          `- ${formatDate(item.createdAt)} | ${notificationLabel(
            item.type
          )} | ${item.title || "Sin título"}: ${
            item.message || "Sin mensaje."
          }`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "Las notificaciones fueron copiadas al portapapeles.",
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
            <h1>Notificaciones</h1>

            <p className="msg">
              {getUserName(user)} · Avisos importantes sobre tareas,
              calificaciones y seguimiento académico.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadNotifications}
            disabled={loading || saving || deletingRead}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Total</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">No leídas</div>
              <div className="kpiValue">{resumen.unread}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Leídas</div>
              <div className="kpiValue">{resumen.read}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Calificaciones</div>
              <div className="kpiValue">{resumen.calificaciones}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Filtros</h2>

          <div className="gridX">
            <label>
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, mensaje o tipo"
                disabled={loading || deletingRead}
              />
            </label>

            <label>
              Vista
              <select
                value={unreadOnly ? "UNREAD" : "ALL"}
                onChange={(event) =>
                  setUnreadOnly(event.target.value === "UNREAD")
                }
                disabled={loading || deletingRead}
              >
                <option value="ALL">Todas</option>
                <option value="UNREAD">No leídas</option>
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className="btn-ghost"
              onClick={copySummary}
              disabled={loading || deletingRead || !notificacionesFiltradas.length}
            >
              Copiar resumen
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={markAllAsRead}
              disabled={loading || saving || deletingRead || !resumen.unread}
            >
              {saving ? "Marcando..." : "Marcar todas como leídas"}
            </button>

            <button
              type="button"
              className="btn-del"
              onClick={deleteReadNotifications}
              disabled={loading || saving || deletingRead || !resumen.read}
            >
              {deletingRead ? "Eliminando..." : "Eliminar leídas"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || saving || deletingRead}
            >
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Listado de notificaciones</h2>

          <div className="lista">
            {notificacionesFiltradas.map((item) => {
              const tone = notificationTone(item.type);

              return (
                <div className="item" key={item.id}>
                  <div className="textClamp">
                    <strong>{item.title || notificationLabel(item.type)}</strong>

                    <p className="muted">{item.message || "Sin mensaje."}</p>

                    <p className="muted">
                      {notificationLabel(item.type)} ·{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="right">
                    <span className={`badge ${tone}`}>
                      {notificationLabel(item.type)}
                    </span>

                    <span className={`badge ${item.read ? "ok" : "warn"}`}>
                      {item.read ? "Leída" : "No leída"}
                    </span>

                    {!item.read && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => markAsRead(item)}
                        disabled={saving || loading || deletingRead}
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!notificacionesFiltradas.length && (
              <p className="msg">
                {loading
                  ? "Cargando notificaciones..."
                  : "No hay notificaciones para mostrar."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}