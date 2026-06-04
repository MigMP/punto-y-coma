import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";
import "../styles/dashboard.css";
import "../styles/coach.css";

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completada" },
];

const PRIORITY_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

function statusLabel(status) {
  const item = STATUS_OPTIONS.find((option) => option.value === status);
  return item?.label || "Pendiente";
}

function priorityLabel(priority) {
  const item = PRIORITY_OPTIONS.find((option) => option.value === priority);
  return item?.label || "Media";
}

function statusClass(status) {
  if (status === "completada") return "ok";
  if (status === "en_progreso") return "warn";
  return "";
}

function priorityClass(priority) {
  if (priority === "alta") return "bad";
  if (priority === "media") return "warn";
  return "ok";
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

export default function Tareas() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const token = useMemo(() => ctxToken || localStorage.getItem("token") || "", [ctxToken]);

  const [tareas, setTareas] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    alumnoEmail: "",
    materiaId: "",
    titulo: "",
    descripcion: "",
    prioridad: "media",
  });

  const role = user?.role;
  const canCreate = role === "maestro";
  const canDelete = role === "maestro";

  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const tasksPath = statusFilter === "ALL"
        ? "/tareas"
        : `/tareas?status=${encodeURIComponent(statusFilter)}`;

      const requests = [
        apiJSON(tasksPath, { token }),
        apiJSON("/materias", { token }),
      ];

      if (role !== "alumno") {
        requests.push(apiJSON("/alumnos", { token }));
      }

      const [tareasData, materiasData, alumnosData] = await Promise.all(requests);

      const tareasArr = Array.isArray(tareasData) ? tareasData : [];
      const materiasArr = Array.isArray(materiasData) ? materiasData : [];
      const alumnosArr = Array.isArray(alumnosData) ? alumnosData : [];

      setTareas(tareasArr);
      setMaterias(materiasArr);
      setAlumnos(alumnosArr);

      setForm((prev) => ({
        ...prev,
        materiaId: prev.materiaId || (materiasArr[0]?.id ? String(materiasArr[0].id) : ""),
        alumnoEmail: prev.alumnoEmail || (alumnosArr[0]?.email || ""),
      }));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar tareas",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const tareasFiltradas = useMemo(() => {
    const term = query.trim().toLowerCase();

    let data = [...tareas];

    if (term) {
      data = data.filter((task) => {
        const searchable = [
          task.titulo,
          task.descripcion,
          task.alumnoNombre,
          task.alumnoEmail,
          task.materiaNombre,
          task.status,
          task.prioridad,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    return data.sort((a, b) => {
      const priorityValue = { alta: 3, media: 2, baja: 1 };
      const statusValue = { pendiente: 3, en_progreso: 2, completada: 1 };

      const aScore = (priorityValue[a.prioridad] || 0) + (statusValue[a.status] || 0);
      const bScore = (priorityValue[b.prioridad] || 0) + (statusValue[b.status] || 0);

      if (bScore !== aScore) return bScore - aScore;

      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  }, [tareas, query]);

  const resumen = useMemo(() => {
    const pendiente = tareas.filter((task) => task.status === "pendiente").length;
    const progreso = tareas.filter((task) => task.status === "en_progreso").length;
    const completada = tareas.filter((task) => task.status === "completada").length;
    const alta = tareas.filter((task) => task.prioridad === "alta").length;

    return {
      total: tareas.length,
      pendiente,
      progreso,
      completada,
      alta,
    };
  }, [tareas]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createTask = async (event) => {
    event.preventDefault();

    if (!form.alumnoEmail || !form.materiaId || !form.titulo.trim() || !form.descripcion.trim()) {
      showToast({
        type: "warning",
        title: "Faltan datos",
        message: "Completa alumno, materia, título y descripción.",
      });
      return;
    }

    try {
      setSaving(true);

      await apiJSON("/tareas", {
        token,
        method: "POST",
        body: {
          alumnoEmail: form.alumnoEmail,
          materiaId: Number(form.materiaId),
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim(),
          prioridad: form.prioridad,
        },
      });

      setForm((prev) => ({
        ...prev,
        titulo: "",
        descripcion: "",
        prioridad: "media",
      }));

      showToast({
        type: "success",
        title: "Tarea creada",
        message: "La recomendación académica fue registrada.",
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

  const updateStatus = async (task, status) => {
    try {
      await apiJSON(`/tareas/${task.id}/status`, {
        token,
        method: "PATCH",
        body: { status },
      });

      showToast({
        type: "success",
        title: "Estado actualizado",
        message: `La tarea quedó como ${statusLabel(status).toLowerCase()}.`,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se actualizó",
        message: error.message,
      });
    }
  };

  const deleteTask = async (task) => {
    const ok = await confirm({
      title: "Eliminar tarea",
      message: `¿Seguro que quieres eliminar "${task.titulo}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    try {
      await apiJSON(`/tareas/${task.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Tarea eliminada",
        message: task.titulo,
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

  const copySummary = async () => {
    const lines = [
      "Tareas académicas - Punto y Coma",
      "",
      `Usuario: ${user?.name || "Usuario"}`,
      `Total: ${resumen.total}`,
      `Pendientes: ${resumen.pendiente}`,
      `En progreso: ${resumen.progreso}`,
      `Completadas: ${resumen.completada}`,
      `Prioridad alta: ${resumen.alta}`,
      "",
      "Listado:",
      ...tareasFiltradas.map(
        (task) =>
          `- ${task.titulo} | ${task.alumnoNombre || task.alumnoEmail} | ${task.materiaNombre} | ${statusLabel(task.status)}`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "Las tareas fueron copiadas al portapapeles.",
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
            <h1>Tareas académicas</h1>
            <p className="msg">
              {user?.name || "Usuario"} · Recomendaciones y seguimiento de actividades de mejora.
            </p>
          </div>

          <button type="button" className="btn-ghost" onClick={loadData}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen de tareas</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Total</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Pendientes</div>
              <div className="kpiValue">{resumen.pendiente}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">En progreso</div>
              <div className="kpiValue">{resumen.progreso}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Completadas</div>
              <div className="kpiValue">{resumen.completada}</div>
            </div>
          </div>
        </section>

        {canCreate && (
          <section className="card">
            <h2>Crear recomendación académica</h2>
            <p className="msg">
              Registra una tarea concreta para apoyar el seguimiento de un alumno.
            </p>

            <form className="gridX planSpacingSmall" onSubmit={createTask}>
              <label>
                Alumno
                <select
                  name="alumnoEmail"
                  value={form.alumnoEmail}
                  onChange={handleFormChange}
                  disabled={!alumnos.length || saving}
                >
                  <option value="">Selecciona un alumno</option>
                  {alumnos.map((alumno) => (
                    <option key={alumno.email} value={alumno.email}>
                      {alumno.name} · {alumno.email}
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
                  disabled={!materias.length || saving}
                >
                  <option value="">Selecciona una materia</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Título
                <input
                  name="titulo"
                  value={form.titulo}
                  onChange={handleFormChange}
                  placeholder="Ej. Repasar ecuaciones lineales"
                  disabled={saving}
                />
              </label>

              <label>
                Prioridad
                <select
                  name="prioridad"
                  value={form.prioridad}
                  onChange={handleFormChange}
                  disabled={saving}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Descripción
                <input
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleFormChange}
                  placeholder="Describe qué debe realizar el alumno"
                  disabled={saving}
                />
              </label>

              <div className="metaActions">
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Crear tarea"}
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
                placeholder="Título, alumno, materia o prioridad"
              />
            </label>

            <label>
              Estado
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button type="button" className="btn-ghost" onClick={copySummary}>
              Copiar resumen
            </button>

            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Listado de tareas</h2>

          <div className="lista">
            {tareasFiltradas.map((task) => (
              <div className="item" key={task.id}>
                <div className="textClamp">
                  <strong>{task.titulo}</strong>
                  <p className="muted">{task.descripcion}</p>
                  <p className="muted">
                    {task.alumnoNombre || task.alumnoEmail} · {task.materiaNombre} · {formatDate(task.updatedAt || task.createdAt)}
                  </p>
                </div>

                <div className="right">
                  <span className={`badge ${priorityClass(task.prioridad)}`}>
                    {priorityLabel(task.prioridad)}
                  </span>

                  <span className={`badge ${statusClass(task.status)}`}>
                    {statusLabel(task.status)}
                  </span>

                  <select
                    value={task.status}
                    onChange={(event) => updateStatus(task, event.target.value)}
                    className="metaInput"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {canDelete && (
                    <button type="button" className="btn-del" onClick={() => deleteTask(task)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!tareasFiltradas.length && (
              <p className="msg">
                {loading ? "Cargando tareas..." : "No hay tareas que coincidan con los filtros."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
