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
    calificacion_eliminada: "Calificación eliminada",
    info: "Información",
  };

  return labels[type] || "Notificación";
}

export default function Notificaciones() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);

  const [notificaciones, setNotificaciones] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const path = unreadOnly
        ? "/notificaciones?unread=true"
        : "/notificaciones";

      const data = await apiJSON(path, { token });

      setNotificaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar notificaciones",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const notificacionesFiltradas = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return notificaciones;

    return notificaciones.filter((item) => {
      const searchable = [
        item.title,
        item.message,
        item.type,
        item.entity,
      ]
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
    const tareas = notificaciones.filter((item) => String(item.type).includes("tarea")).length;
    const calificaciones = notificaciones.filter((item) => String(item.type).includes("calificacion")).length;

    return {
      total,
      unread,
      read,
      tareas,
      calificaciones,
    };
  }, [notificaciones]);

  const markAsRead = async (notification) => {
    if (notification.read) return;

    try {
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
        message: error.message,
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const result = await apiJSON("/notificaciones/read-all", {
        token,
        method: "PATCH",
      });

      showToast({
        type: "success",
        title: "Notificaciones actualizadas",
        message: `Se marcaron ${result.updated || 0} notificación(es) como leídas.`,
      });

      await loadNotifications();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo actualizar",
        message: error.message,
      });
    }
  };

  const copySummary = async () => {
    const lines = [
      "Notificaciones - Punto y Coma",
      "",
      `Usuario: ${user?.name || "Usuario"}`,
      `Total: ${resumen.total}`,
      `No leídas: ${resumen.unread}`,
      `Leídas: ${resumen.read}`,
      "",
      "Listado:",
      ...notificacionesFiltradas.map(
        (item) =>
          `- ${formatDate(item.createdAt)} | ${notificationLabel(item.type)} | ${item.title}: ${item.message}`
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
              {user?.name || "Usuario"} · Avisos importantes sobre tareas, calificaciones y seguimiento académico.
            </p>
          </div>

          <button type="button" className="btn-ghost" onClick={loadNotifications}>
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
              <div className="kpiTitle">Tareas</div>
              <div className="kpiValue">{resumen.tareas}</div>
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
              />
            </label>

            <label>
              Vista
              <select
                value={unreadOnly ? "UNREAD" : "ALL"}
                onChange={(event) => setUnreadOnly(event.target.value === "UNREAD")}
              >
                <option value="ALL">Todas</option>
                <option value="UNREAD">No leídas</option>
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button type="button" className="btn-ghost" onClick={copySummary}>
              Copiar resumen
            </button>

            <button type="button" className="btn-ghost" onClick={markAllAsRead}>
              Marcar todas como leídas
            </button>

            <button type="button" onClick={() => window.print()}>
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
                      {notificationLabel(item.type)} · {formatDate(item.createdAt)}
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
                      <button type="button" className="btn-ghost" onClick={() => markAsRead(item)}>
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!notificacionesFiltradas.length && (
              <p className="msg">
                {loading ? "Cargando notificaciones..." : "No hay notificaciones para mostrar."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
