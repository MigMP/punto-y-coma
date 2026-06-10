// Archivo: frontend/src/pages/Reportes.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

const TYPES = [
  { value: "contenido", label: "Contenido incorrecto" },
  { value: "calificacion", label: "Calificación incorrecta" },
  { value: "tarea", label: "Problema con tarea" },
  { value: "calendario", label: "Evento de calendario" },
  { value: "recurso", label: "Recurso o enlace" },
  { value: "cuenta", label: "Problema de cuenta" },
  { value: "error_tecnico", label: "Error técnico" },
  { value: "otro", label: "Otro" },
];

const MODULES = [
  { value: "general", label: "General" },
  { value: "calificaciones", label: "Calificaciones" },
  { value: "tareas", label: "Tareas" },
  { value: "calendario", label: "Calendario" },
  { value: "recursos", label: "Recursos" },
  { value: "cuenta", label: "Cuenta / perfil" },
  { value: "analiticas", label: "Analíticas" },
  { value: "reportes", label: "Reportes" },
  { value: "otro", label: "Otro" },
];

const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const STATUS = [
  { value: "all", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "revision", label: "En revisión" },
  { value: "resuelto", label: "Resuelto" },
  { value: "rechazado", label: "Rechazado" },
];

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function labelFrom(list, value, fallback = "Sin dato") {
  return list.find((item) => item.value === value)?.label || fallback;
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

function priorityTone(value) {
  if (value === "alta") return "bad";
  if (value === "media") return "warn";

  return "ok";
}

function statusTone(value) {
  if (value === "pendiente") return "warn";
  if (value === "revision") return "";
  if (value === "resuelto") return "ok";
  if (value === "rechazado") return "bad";

  return "";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function validateForm(form) {
  const title = String(form.title || "").trim();
  const description = String(form.description || "").trim();

  if (title.length < 4) {
    return "El asunto debe tener mínimo 4 caracteres.";
  }

  if (title.length > 120) {
    return "El asunto no puede pasar de 120 caracteres.";
  }

  if (description.length < 10) {
    return "La descripción debe tener mínimo 10 caracteres.";
  }

  if (description.length > 1500) {
    return "La descripción no puede pasar de 1500 caracteres.";
  }

  return "";
}

export default function Reportes() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const isAdmin = user?.role === "administrador";

  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");

  const [updatingId, setUpdatingId] = useState(null);
  const [resolutionMessages, setResolutionMessages] = useState({});

  const [form, setForm] = useState({
    type: "contenido",
    module: "general",
    priority: "media",
    title: "",
    description: "",
  });

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadReportes = useCallback(async () => {
    if (!token) {
      setReportes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (query.trim()) params.set("search", query.trim());

      const path = params.toString()
        ? `/reportes?${params.toString()}`
        : "/reportes";

      const data = await apiJSON(path, { token });

      setReportes(toArray(data));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar reportes",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, typeFilter, priorityFilter, query, showToast]);

  useEffect(() => {
    loadReportes();
  }, [loadReportes]);

  const resumen = useMemo(() => {
    return {
      total: reportes.length,
      pendientes: reportes.filter((item) => item.status === "pendiente").length,
      revision: reportes.filter((item) => item.status === "revision").length,
      resueltos: reportes.filter((item) => item.status === "resuelto").length,
      alta: reportes.filter((item) => item.priority === "alta").length,
    };
  }, [reportes]);

  const filteredReportes = useMemo(() => {
    const term = normalizeText(query);

    if (!term) return reportes;

    return reportes.filter((item) => {
      const searchable = [
        item.title,
        item.description,
        item.type,
        item.module,
        item.priority,
        item.status,
        item.creadoPorEmail,
        item.creadoPorNombre,
      ]
        .filter(Boolean)
        .join(" ");

      return normalizeText(searchable).includes(term);
    });
  }, [reportes, query]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createReport = async (event) => {
    event.preventDefault();

    const error = validateForm(form);

    if (error) {
      showToast({
        type: "warning",
        title: "Revisa el reporte",
        message: error,
      });
      return;
    }

    try {
      setSaving(true);

      await apiJSON("/reportes", {
        token,
        method: "POST",
        body: {
          type: form.type,
          module: form.module,
          priority: form.priority,
          title: form.title.trim(),
          description: form.description.trim(),
        },
      });

      setForm({
        type: "contenido",
        module: "general",
        priority: "media",
        title: "",
        description: "",
      });

      showToast({
        type: "success",
        title: "Reporte enviado",
        message: "El administrador recibirá una notificación.",
      });

      await loadReportes();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo enviar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateReportStatus = async (report, nextStatus) => {
    if (!isAdmin) return;

    try {
      setUpdatingId(report.id);

      const message =
        resolutionMessages[report.id] || report.resolutionMessage || "";

      await apiJSON(`/reportes/${report.id}/status`, {
        token,
        method: "PATCH",
        body: {
          status: nextStatus,
          resolutionMessage: message,
        },
      });

      showToast({
        type: "success",
        title: "Reporte actualizado",
        message: `Estado: ${labelFrom(STATUS, nextStatus, nextStatus)}`,
      });

      await loadReportes();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se actualizó",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const copyReport = async (report) => {
    const text = [
      "Reporte de plataforma - Punto y Coma",
      "",
      `Asunto: ${report.title}`,
      `Tipo: ${labelFrom(TYPES, report.type)}`,
      `Módulo: ${labelFrom(MODULES, report.module)}`,
      `Prioridad: ${labelFrom(PRIORITIES, report.priority)}`,
      `Estado: ${labelFrom(STATUS, report.status, report.status)}`,
      `Enviado por: ${report.creadoPorNombre || report.creadoPorEmail}`,
      `Fecha: ${formatDate(report.createdAt)}`,
      "",
      "Descripción:",
      report.description,
      "",
      "Respuesta / resolución:",
      report.resolutionMessage || "Sin respuesta todavía.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);

      showToast({
        type: "success",
        title: "Reporte copiado",
        message: "La información fue copiada al portapapeles.",
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
            <h1>Reportes de la plataforma</h1>

            <p className="msg">
              {getUserName(user)} · Reporta contenido incorrecto, errores de la
              app o problemas académicos para que el administrador les dé
              seguimiento.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadReportes}
            disabled={loading || saving}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Nuevo reporte</h2>

          <p className="msg">
            Describe el problema con claridad. El administrador recibirá una
            notificación y podrá cambiar el estado del reporte.
          </p>

          <form className="gridX planSpacingSmall" onSubmit={createReport}>
            <label>
              Tipo
              <select
                name="type"
                value={form.type}
                onChange={handleFormChange}
                disabled={loading || saving}
              >
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Módulo afectado
              <select
                name="module"
                value={form.module}
                onChange={handleFormChange}
                disabled={loading || saving}
              >
                {MODULES.map((module) => (
                  <option key={module.value} value={module.value}>
                    {module.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prioridad
              <select
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
                disabled={loading || saving}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Asunto
              <input
                name="title"
                value={form.title}
                onChange={handleFormChange}
                placeholder="Ej. La calificación aparece incorrecta"
                disabled={loading || saving}
              />
            </label>

            <label>
              Descripción
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                placeholder="Explica qué pasó, dónde ocurrió y qué esperabas ver."
                disabled={loading || saving}
                rows={4}
              />
            </label>

            <div className="metaActions">
              <button type="submit" disabled={loading || saving}>
                {saving ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>{isAdmin ? "Reportes recibidos" : "Mis reportes enviados"}</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Total</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Pendientes</div>
              <div className="kpiValue">{resumen.pendientes}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">En revisión</div>
              <div className="kpiValue">{resumen.revision}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Resueltos</div>
              <div className="kpiValue">{resumen.resueltos}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Prioridad alta</div>
              <div className="kpiValue">{resumen.alta}</div>
            </div>
          </div>

          <div className="gridX planSpacingSmall">
            <label>
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Asunto, descripción, usuario o estado"
                disabled={loading}
              />
            </label>

            <label>
              Estado
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={loading}
              >
                {STATUS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                disabled={loading}
              >
                <option value="all">Todos</option>

                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prioridad
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                disabled={loading}
              >
                <option value="all">Todas</option>

                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="lista planSpacingSmall">
            {filteredReportes.map((report) => (
              <div className="item" key={report.id}>
                <div className="textClamp">
                  <strong>{report.title}</strong>

                  <p className="muted">
                    {labelFrom(TYPES, report.type)} ·{" "}
                    {labelFrom(MODULES, report.module)} ·{" "}
                    {formatDate(report.createdAt)}
                  </p>

                  <p className="muted">{report.description}</p>

                  {isAdmin && (
                    <p className="muted">
                      Enviado por: {report.creadoPorNombre || "Usuario"} ·{" "}
                      {report.creadoPorEmail}
                    </p>
                  )}

                  {report.resolutionMessage && (
                    <p className="muted">
                      Respuesta: {report.resolutionMessage}
                    </p>
                  )}

                  {isAdmin && (
                    <div className="gridX planSpacingSmall">
                      <label>
                        Respuesta del administrador
                        <input
                          value={
                            resolutionMessages[report.id] ??
                            report.resolutionMessage ??
                            ""
                          }
                          onChange={(event) =>
                            setResolutionMessages((prev) => ({
                              ...prev,
                              [report.id]: event.target.value,
                            }))
                          }
                          placeholder="Ej. Se revisó y ya quedó corregido."
                          disabled={updatingId === report.id}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="right">
                  <span className={`badge ${priorityTone(report.priority)}`}>
                    {labelFrom(PRIORITIES, report.priority)}
                  </span>

                  <span className={`badge ${statusTone(report.status)}`}>
                    {labelFrom(STATUS, report.status, report.status)}
                  </span>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => copyReport(report)}
                  >
                    Copiar
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => updateReportStatus(report, "revision")}
                        disabled={updatingId === report.id}
                      >
                        Revisar
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report, "resuelto")}
                        disabled={updatingId === report.id}
                      >
                        Resolver
                      </button>

                      <button
                        type="button"
                        className="btn-del"
                        onClick={() => updateReportStatus(report, "rechazado")}
                        disabled={updatingId === report.id}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {!filteredReportes.length && (
              <p className="msg">
                {loading
                  ? "Cargando reportes..."
                  : "No hay reportes que coincidan con los filtros."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
