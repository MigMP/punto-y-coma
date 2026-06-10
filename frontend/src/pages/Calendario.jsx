// Archivo: frontend/src/pages/Calendario.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

const EVENT_TYPES = [
  { value: "examen", label: "Examen" },
  { value: "entrega", label: "Entrega" },
  { value: "asesoria", label: "Asesoría" },
  { value: "aviso", label: "Aviso" },
  { value: "clase", label: "Clase" },
];

const AUDIENCES = [
  { value: "todos", label: "Todos" },
  { value: "alumnos", label: "Alumnos" },
  { value: "maestros", label: "Maestros" },
  { value: "administradores", label: "Administradores" },
];

const MAX_EVENT_DURATION_DAYS = 30;

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function eventTypeLabel(type) {
  const item = EVENT_TYPES.find((option) => option.value === type);
  return item?.label || "Evento";
}

function audienceLabel(audience) {
  const item = AUDIENCES.find((option) => option.value === audience);
  return item?.label || "Todos";
}

function eventTone(type) {
  if (type === "examen") return "bad";
  if (type === "entrega") return "warn";
  if (type === "asesoria") return "ok";
  if (type === "clase") return "ok";

  return "";
}

function formatDateTime(value) {
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

function toDatetimeLocalValue(date = new Date()) {
  const pad = (num) => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getDefaultEventDates() {
  const start = new Date();
  start.setHours(start.getHours() + 1);
  start.setMinutes(0);
  start.setSeconds(0);
  start.setMilliseconds(0);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startAt: toDatetimeLocalValue(start),
    endAt: toDatetimeLocalValue(end),
  };
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function isValidOption(value, options) {
  return options.some((option) => option.value === value);
}

function validateEventForm(form) {
  const title = form.title.trim();
  const description = form.description.trim();

  if (!title || !description || !form.startAt || !form.endAt) {
    return "Completa título, descripción, fecha de inicio y fecha de fin.";
  }

  if (title.length < 4) {
    return "El título debe tener mínimo 4 caracteres.";
  }

  if (title.length > 120) {
    return "El título no puede pasar de 120 caracteres.";
  }

  if (description.length > 1000) {
    return "La descripción no puede pasar de 1000 caracteres.";
  }

  if (!isValidOption(form.type, EVENT_TYPES)) {
    return "Selecciona un tipo de evento válido.";
  }

  if (!isValidOption(form.audience, AUDIENCES)) {
    return "Selecciona una audiencia válida.";
  }

  const startDate = new Date(form.startAt);
  const endDate = new Date(form.endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Las fechas del evento no son válidas.";
  }

  if (endDate.getTime() < startDate.getTime()) {
    return "La fecha de fin no puede ser anterior a la fecha de inicio.";
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const maxDurationMs = MAX_EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;

  if (durationMs > maxDurationMs) {
    return `El evento no puede durar más de ${MAX_EVENT_DURATION_DAYS} días.`;
  }

  return "";
}

export default function Calendario() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const role = user?.role;
  const canManage = role === "administrador" || role === "maestro";

  const [eventos, setEventos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => {
    const dates = getDefaultEventDates();

    return {
      title: "",
      description: "",
      type: "aviso",
      audience: "todos",
      materiaId: "",
      startAt: dates.startAt,
      endAt: dates.endAt,
    };
  });

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!token) {
      setEventos([]);
      setMaterias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }

      if (upcomingOnly) {
        params.set("upcoming", "true");
      }

      const calendarPath = params.toString()
        ? `/calendario?${params.toString()}`
        : "/calendario";

      const [eventosData, materiasData] = await Promise.all([
        apiJSON(calendarPath, { token }),
        apiJSON("/materias", { token }),
      ]);

      setEventos(toArray(eventosData));
      setMaterias(toArray(materiasData));

      setForm((prev) => ({
        ...prev,
        materiaId: prev.materiaId || "",
      }));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el calendario",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, typeFilter, upcomingOnly, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eventosFiltrados = useMemo(() => {
    const term = query.trim().toLowerCase();

    let data = [...eventos];

    if (term) {
      data = data.filter((event) => {
        const searchable = [
          event.title,
          event.description,
          event.type,
          event.audience,
          event.materiaNombre,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    return data.sort((a, b) => {
      const dateA = new Date(a.startAt || 0).getTime();
      const dateB = new Date(b.startAt || 0).getTime();

      return dateA - dateB;
    });
  }, [eventos, query]);

  const resumen = useMemo(() => {
    return {
      total: eventos.length,
      examenes: eventos.filter((event) => event.type === "examen").length,
      entregas: eventos.filter((event) => event.type === "entrega").length,
      asesorias: eventos.filter((event) => event.type === "asesoria").length,
      avisos: eventos.filter((event) => event.type === "aviso").length,
    };
  }, [eventos]);

  const proximosEventos = useMemo(() => {
    const now = Date.now();

    return eventos
      .filter((event) => {
        const date = new Date(event.startAt).getTime();
        return Number.isFinite(date) && date >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startAt || 0).getTime();
        const dateB = new Date(b.startAt || 0).getTime();

        return dateA - dateB;
      })
      .slice(0, 5);
  }, [eventos]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createEvent = async (event) => {
    event.preventDefault();

    const error = validateEventForm(form);

    if (error) {
      showToast({
        type: "warning",
        title: "Revisa los datos",
        message: error,
      });
      return;
    }

    try {
      setSaving(true);

      await apiJSON("/calendario", {
        token,
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          audience: form.audience,
          materiaId: form.materiaId ? Number(form.materiaId) : null,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
        },
      });

      setForm((prev) => {
        const dates = getDefaultEventDates();

        return {
          ...prev,
          title: "",
          description: "",
          type: "aviso",
          startAt: dates.startAt,
          endAt: dates.endAt,
        };
      });

      showToast({
        type: "success",
        title: "Evento creado",
        message: "El evento fue agregado al calendario académico.",
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo crear",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (calendarEvent) => {
    const ok = await confirm({
      title: "Eliminar evento",
      message: `¿Seguro que quieres eliminar "${calendarEvent.title}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    try {
      await apiJSON(`/calendario/${calendarEvent.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Evento eliminado",
        message: calendarEvent.title,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se eliminó",
        message: error.message || "Intenta nuevamente.",
      });
    }
  };

  const copySummary = async () => {
    const lines = [
      "Calendario académico - Punto y Coma",
      "",
      `Usuario: ${getUserName(user)}`,
      `Total de eventos: ${resumen.total}`,
      `Exámenes: ${resumen.examenes}`,
      `Entregas: ${resumen.entregas}`,
      `Asesorías: ${resumen.asesorias}`,
      `Avisos: ${resumen.avisos}`,
      "",
      "Eventos:",
      ...eventosFiltrados.map(
        (event) =>
          `- ${formatDateTime(event.startAt)} | ${eventTypeLabel(
            event.type
          )} | ${event.title || "Sin título"} | ${
            event.materiaNombre || "General"
          }`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "El calendario fue copiado al portapapeles.",
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
            <h1>Calendario académico</h1>

            <p className="msg">
              {getUserName(user)} · Eventos, entregas, exámenes y avisos
              importantes.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadData}
            disabled={loading || saving}
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
              <div className="kpiTitle">Exámenes</div>
              <div className="kpiValue">{resumen.examenes}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Entregas</div>
              <div className="kpiValue">{resumen.entregas}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Asesorías</div>
              <div className="kpiValue">{resumen.asesorias}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Próximos eventos</h2>

          <div className="lista">
            {proximosEventos.map((calendarEvent) => (
              <div className="item" key={calendarEvent.id}>
                <div>
                  <strong>{calendarEvent.title || "Evento sin título"}</strong>

                  <p className="muted">
                    {formatDateTime(calendarEvent.startAt)} ·{" "}
                    {calendarEvent.materiaNombre || "General"}
                  </p>
                </div>

                <span className={`badge ${eventTone(calendarEvent.type)}`}>
                  {eventTypeLabel(calendarEvent.type)}
                </span>
              </div>
            ))}

            {!proximosEventos.length && (
              <p className="msg">
                {loading
                  ? "Cargando eventos..."
                  : "No hay próximos eventos registrados."}
              </p>
            )}
          </div>
        </section>

        {canManage && (
          <section className="card">
            <h2>Crear evento</h2>

            <p className="msg">
              Registra exámenes, entregas, asesorías, avisos o clases
              especiales.
            </p>

            <form className="gridX planSpacingSmall" onSubmit={createEvent}>
              <label>
                Título
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Ej. Examen parcial de base de datos"
                  disabled={saving || loading}
                />
              </label>

              <label>
                Tipo
                <select
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                  disabled={saving || loading}
                >
                  {EVENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Audiencia
                <select
                  name="audience"
                  value={form.audience}
                  onChange={handleFormChange}
                  disabled={saving || loading}
                >
                  {AUDIENCES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Materia
                <select
                  name="materiaId"
                  value={form.materiaId}
                  onChange={handleFormChange}
                  disabled={saving || loading}
                >
                  <option value="">General</option>

                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Inicio
                <input
                  type="datetime-local"
                  name="startAt"
                  value={form.startAt}
                  onChange={handleFormChange}
                  disabled={saving || loading}
                />
              </label>

              <label>
                Fin
                <input
                  type="datetime-local"
                  name="endAt"
                  value={form.endAt}
                  onChange={handleFormChange}
                  disabled={saving || loading}
                />
              </label>

              <label>
                Descripción
                <input
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Describe el evento académico"
                  disabled={saving || loading}
                />
              </label>

              <div className="metaActions">
                <button type="submit" disabled={saving || loading}>
                  {saving ? "Guardando..." : "Crear evento"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="card">
          <h2>Filtros</h2>

          <div className="gridX">
            <label>
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, materia, tipo o descripción"
                disabled={loading}
              />
            </label>

            <label>
              Tipo
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todos</option>

                {EVENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Vista
              <select
                value={upcomingOnly ? "UPCOMING" : "ALL"}
                onChange={(event) =>
                  setUpcomingOnly(event.target.value === "UPCOMING")
                }
                disabled={loading}
              >
                <option value="ALL">Todos</option>
                <option value="UPCOMING">Solo próximos</option>
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className="btn-ghost"
              onClick={copySummary}
              disabled={loading || !eventosFiltrados.length}
            >
              Copiar resumen
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Listado de eventos</h2>

          <div className="lista">
            {eventosFiltrados.map((calendarEvent) => (
              <div className="item" key={calendarEvent.id}>
                <div className="textClamp">
                  <strong>{calendarEvent.title || "Evento sin título"}</strong>

                  <p className="muted">
                    {calendarEvent.description || "Sin descripción."}
                  </p>

                  <p className="muted">
                    {formatDateTime(calendarEvent.startAt)} -{" "}
                    {formatDateTime(calendarEvent.endAt)}
                  </p>

                  <p className="muted">
                    {calendarEvent.materiaNombre || "General"} ·{" "}
                    {audienceLabel(calendarEvent.audience)}
                  </p>
                </div>

                <div className="right">
                  <span className={`badge ${eventTone(calendarEvent.type)}`}>
                    {eventTypeLabel(calendarEvent.type)}
                  </span>

                  <span className="badge">
                    {audienceLabel(calendarEvent.audience)}
                  </span>

                  {canManage && (
                    <button
                      type="button"
                      className="btn-del"
                      onClick={() => deleteEvent(calendarEvent)}
                      disabled={loading || saving}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!eventosFiltrados.length && (
              <p className="msg">
                {loading
                  ? "Cargando calendario..."
                  : "No hay eventos que coincidan con los filtros."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}