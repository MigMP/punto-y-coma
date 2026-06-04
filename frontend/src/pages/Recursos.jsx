import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

const RESOURCE_TYPES = [
  { value: "video", label: "Video" },
  { value: "guia", label: "Guía" },
  { value: "pdf", label: "PDF" },
  { value: "link", label: "Link" },
  { value: "recomendacion", label: "Recomendación" },
];

function typeLabel(type) {
  const item = RESOURCE_TYPES.find((option) => option.value === type);
  return item?.label || "Recurso";
}

function typeTone(type) {
  if (type === "video") return "ok";
  if (type === "guia") return "warn";
  if (type === "pdf") return "bad";
  if (type === "recomendacion") return "ok";
  return "";
}

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

export default function Recursos() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);

  const role = user?.role;
  const canManage = role === "administrador" || role === "maestro";

  const [recursos, setRecursos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [materiaFilter, setMateriaFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "link",
    url: "",
    materiaId: "",
  });

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }

      if (materiaFilter !== "ALL") {
        params.set("materiaId", materiaFilter);
      }

      if (query.trim()) {
        params.set("q", query.trim());
      }

      const resourcePath = params.toString()
        ? `/recursos?${params.toString()}`
        : "/recursos";

      const [recursosData, materiasData] = await Promise.all([
        apiJSON(resourcePath, { token }),
        apiJSON("/materias", { token }),
      ]);

      setRecursos(Array.isArray(recursosData) ? recursosData : []);
      setMaterias(Array.isArray(materiasData) ? materiasData : []);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar recursos",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, materiaFilter]);

  const resumen = useMemo(() => {
    return {
      total: recursos.length,
      videos: recursos.filter((item) => item.type === "video").length,
      guias: recursos.filter((item) => item.type === "guia").length,
      pdfs: recursos.filter((item) => item.type === "pdf").length,
      recomendaciones: recursos.filter((item) => item.type === "recomendacion").length,
    };
  }, [recursos]);

  const recursosRecientes = useMemo(() => {
    return [...recursos]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [recursos]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createResource = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim() || !form.url.trim()) {
      showToast({
        type: "warning",
        title: "Faltan datos",
        message: "Completa título, descripción y URL.",
      });
      return;
    }

    try {
      setSaving(true);

      await apiJSON("/recursos", {
        token,
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          url: form.url.trim(),
          materiaId: form.materiaId ? Number(form.materiaId) : null,
        },
      });

      setForm({
        title: "",
        description: "",
        type: "link",
        url: "",
        materiaId: "",
      });

      showToast({
        type: "success",
        title: "Recurso creado",
        message: "El recurso fue agregado correctamente.",
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo crear",
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (resource) => {
    const ok = await confirm({
      title: "Eliminar recurso",
      message: `¿Seguro que quieres eliminar "${resource.title}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    try {
      await apiJSON(`/recursos/${resource.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Recurso eliminado",
        message: resource.title,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se eliminó",
        message: error.message,
      });
    }
  };

  const applySearch = () => {
    loadData();
  };

  const copySummary = async () => {
    const lines = [
      "Recursos de apoyo - Punto y Coma",
      "",
      `Usuario: ${user?.name || "Usuario"}`,
      `Total: ${resumen.total}`,
      `Videos: ${resumen.videos}`,
      `Guías: ${resumen.guias}`,
      `PDFs: ${resumen.pdfs}`,
      `Recomendaciones: ${resumen.recomendaciones}`,
      "",
      "Recursos:",
      ...recursos.map(
        (item) =>
          `- ${typeLabel(item.type)} | ${item.title} | ${item.materiaNombre || "General"} | ${item.url}`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "Los recursos fueron copiados al portapapeles.",
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
            <h1>Recursos de apoyo</h1>
            <p className="msg">
              {user?.name || "Usuario"} · Materiales para estudiar, reforzar temas y preparar evaluaciones.
            </p>
          </div>

          <button type="button" className="btn-ghost" onClick={loadData}>
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
              <div className="kpiTitle">Videos</div>
              <div className="kpiValue">{resumen.videos}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Guías</div>
              <div className="kpiValue">{resumen.guias}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">PDFs</div>
              <div className="kpiValue">{resumen.pdfs}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Recursos recientes</h2>

          <div className="lista">
            {recursosRecientes.map((item) => (
              <div className="item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">
                    {item.materiaNombre || "General"} · {formatDate(item.createdAt)}
                  </p>
                </div>

                <span className={`badge ${typeTone(item.type)}`}>
                  {typeLabel(item.type)}
                </span>
              </div>
            ))}

            {!recursosRecientes.length && (
              <p className="msg">
                {loading ? "Cargando recursos..." : "Todavía no hay recursos registrados."}
              </p>
            )}
          </div>
        </section>

        {canManage && (
          <section className="card">
            <h2>Agregar recurso</h2>
            <p className="msg">
              Registra videos, guías, PDFs externos, links o recomendaciones para los alumnos.
            </p>

            <form className="gridX planSpacingSmall" onSubmit={createResource}>
              <label>
                Título
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Ej. Guía de normalización"
                  disabled={saving}
                />
              </label>

              <label>
                Tipo
                <select
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                  disabled={saving}
                >
                  {RESOURCE_TYPES.map((option) => (
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
                  disabled={saving}
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
                URL
                <input
                  name="url"
                  value={form.url}
                  onChange={handleFormChange}
                  placeholder="https://..."
                  disabled={saving}
                />
              </label>

              <label>
                Descripción
                <input
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Describe para qué sirve este recurso"
                  disabled={saving}
                />
              </label>

              <div className="metaActions">
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Crear recurso"}
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
                placeholder="Título, descripción, materia o link"
              />
            </label>

            <label>
              Tipo
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="ALL">Todos</option>
                {RESOURCE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Materia
              <select
                value={materiaFilter}
                onChange={(event) => setMateriaFilter(event.target.value)}
              >
                <option value="ALL">Todas</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button type="button" className="btn-ghost" onClick={applySearch}>
              Buscar
            </button>

            <button type="button" className="btn-ghost" onClick={copySummary}>
              Copiar resumen
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Listado de recursos</h2>

          <div className="lista">
            {recursos.map((item) => (
              <div className="item" key={item.id}>
                <div className="textClamp">
                  <strong>{item.title}</strong>
                  <p className="muted">{item.description}</p>
                  <p className="muted">
                    {item.materiaNombre || "General"} · {formatDate(item.createdAt)}
                  </p>
                  <p className="muted">
                    Creado por: {item.creadoPorNombre || item.creadoPor || "Sistema"}
                  </p>
                </div>

                <div className="right">
                  <span className={`badge ${typeTone(item.type)}`}>
                    {typeLabel(item.type)}
                  </span>

                  <a
                    className="badge ok"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir
                  </a>

                  {canManage && (
                    <button
                      type="button"
                      className="btn-del"
                      onClick={() => deleteResource(item)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!recursos.length && (
              <p className="msg">
                {loading ? "Cargando recursos..." : "No hay recursos que coincidan con los filtros."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}