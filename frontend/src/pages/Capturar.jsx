// Archivo: frontend/src/pages/Capturar.jsx

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

function fmtGrade(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
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

function validateGrade(value) {
  const clean = String(value || "").trim();

  if (!clean) {
    return "Ingresa una calificación.";
  }

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    return "La calificación debe ser numérica y máximo con 2 decimales.";
  }

  const grade = Number(clean);

  if (!Number.isFinite(grade) || grade < 0 || grade > 10) {
    return "La calificación debe estar entre 0 y 10.";
  }

  return "";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Maestro";
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sortByName(items) {
  return [...items].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "es", {
      sensitivity: "base",
    })
  );
}

export default function Capturar() {
  const { showToast } = useToast();

  const { user, token: ctxToken } = useAuth();

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [materias, setMaterias] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);

  const [form, setForm] = useState({
    materiaId: "",
    grupo: "",
    alumnoEmail: "",
    calificacion: "",
  });

  const [filtroMateria, setFiltroMateria] = useState("ALL");
  const [filtroGrupo, setFiltroGrupo] = useState("ALL");
  const [orden, setOrden] = useState("DESC");

  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadTeacherData = useCallback(async () => {
    if (!token) {
      setMaterias([]);
      setCalificaciones([]);
      setAlumnos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [materiasData, calificacionesData, alumnosData] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/calificaciones", { token }),
        apiJSON("/alumnos", { token }),
      ]);

      const materiasArr = toArray(materiasData);
      const calificacionesArr = toArray(calificacionesData);
      const alumnosArr = sortByName(toArray(alumnosData));

      setMaterias(materiasArr);
      setCalificaciones(calificacionesArr);
      setAlumnos(alumnosArr);

      setForm((prev) => ({
        ...prev,
        materiaId:
          prev.materiaId ||
          (materiasArr[0]?.id ? String(materiasArr[0].id) : ""),
      }));
    } catch (error) {
      showToast({
        type: "error",
        title: "Error al cargar datos",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadTeacherData();
  }, [loadTeacherData]);

  const grupos = useMemo(() => {
    const set = new Set(
      alumnos.map((alumno) => normalizeText(alumno.grupo)).filter(Boolean)
    );

    return [...set].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  }, [alumnos]);

  const alumnosDelGrupo = useMemo(() => {
    if (!form.grupo) return [];

    return alumnos.filter(
      (alumno) => normalizeText(alumno.grupo) === normalizeText(form.grupo)
    );
  }, [alumnos, form.grupo]);

  const alumnoSeleccionado = useMemo(() => {
    const email = normalizeEmail(form.alumnoEmail);

    if (!email) return null;

    return alumnos.find((alumno) => normalizeEmail(alumno.email) === email);
  }, [alumnos, form.alumnoEmail]);

  const calificacionesFiltradas = useMemo(() => {
    let data = [...calificaciones];

    if (filtroMateria !== "ALL") {
      data = data.filter(
        (item) => String(item.materiaId) === String(filtroMateria)
      );
    }

    if (filtroGrupo !== "ALL") {
      data = data.filter(
        (item) => normalizeText(item.alumnoGrupo) === normalizeText(filtroGrupo)
      );
    }

    data.sort((a, b) => {
      const gradeA = Number(a.calificacion);
      const gradeB = Number(b.calificacion);

      return orden === "DESC" ? gradeB - gradeA : gradeA - gradeB;
    });

    return data;
  }, [calificaciones, filtroMateria, filtroGrupo, orden]);

  const alumnosEvaluados = useMemo(() => {
    return new Set(
      calificaciones
        .map((item) => normalizeEmail(item.alumnoEmail))
        .filter(Boolean)
    ).size;
  }, [calificaciones]);

  const promedioGeneral = useMemo(() => {
    const nums = calificaciones
      .map((item) => Number(item.calificacion))
      .filter(Number.isFinite);

    if (!nums.length) return null;

    return nums.reduce((total, value) => total + value, 0) / nums.length;
  }, [calificaciones]);

  const enRiesgo = useMemo(() => {
    return calificaciones.filter((item) => Number(item.calificacion) < 7)
      .length;
  }, [calificaciones]);

  const updateForm = (name, value) => {
    setForm((prev) => {
      if (name === "grupo") {
        return {
          ...prev,
          grupo: value,
          alumnoEmail: "",
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const validateForm = () => {
    const gradeError = validateGrade(form.calificacion);

    if (!form.materiaId || !form.grupo || !form.alumnoEmail) {
      return "Selecciona materia, grupo y alumno.";
    }

    if (!alumnoSeleccionado) {
      return "Selecciona un alumno válido.";
    }

    if (gradeError) {
      return gradeError;
    }

    return "";
  };

  const addCalificacion = async (event) => {
    event.preventDefault();

    const error = validateForm();

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

      await apiJSON("/calificaciones", {
        token,
        method: "POST",
        body: {
          alumnoEmail: alumnoSeleccionado.email,
          materiaId: Number(form.materiaId),
          calificacion: Number(form.calificacion),
        },
      });

      showToast({
        type: "success",
        title: "Calificación registrada",
        message: "El alumno fue actualizado correctamente.",
      });

      setForm((prev) => ({
        ...prev,
        alumnoEmail: "",
        calificacion: "",
      }));

      await loadTeacherData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se guardó",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCalificacion = async (calificacion) => {
    try {
      setDeletingId(String(calificacion.id));

      await apiJSON(`/calificaciones/${calificacion.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Eliminado",
        message: "La calificación fue eliminada.",
      });

      await loadTeacherData();
    } catch (error) {
      showToast({
        type: "error",
        title: "Error",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setDeletingId("");
    }
  };

  const startEdit = (calificacion) => {
    setEditId(calificacion.id);
    setEditVal(String(calificacion.calificacion));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditVal("");
  };

  const saveEdit = async () => {
    const error = validateGrade(editVal);

    if (error) {
      showToast({
        type: "warning",
        title: "Revisa la calificación",
        message: error,
      });
      return;
    }

    try {
      setUpdatingId(String(editId));

      await apiJSON(`/calificaciones/${editId}`, {
        token,
        method: "PATCH",
        body: {
          calificacion: Number(editVal),
        },
      });

      showToast({
        type: "success",
        title: "Cambios guardados",
        message: "Calificación actualizada.",
      });

      cancelEdit();

      await loadTeacherData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No actualizado",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Gestión de calificaciones</h1>

            <p className="msg">
              {getUserName(user)} · Control académico por materia, grupo y
              alumno
            </p>
          </div>

          <button
            className="btn-ghost"
            type="button"
            onClick={loadTeacherData}
            disabled={loading || saving || Boolean(deletingId) || Boolean(updatingId)}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen del maestro</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{materias.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Grupos</div>
              <div className="kpiValue">{grupos.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Registros</div>
              <div className="kpiValue">{calificaciones.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Alumnos</div>
              <div className="kpiValue">{alumnosEvaluados}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Promedio</div>

              <div className={`kpiValue ${gradeClass(promedioGeneral)}`}>
                {fmtGrade(promedioGeneral)}
              </div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">En riesgo</div>
              <div className="kpiValue">{enRiesgo}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Capturar calificación</h2>

          <p className="msg">
            Selecciona una materia, después el grupo y finalmente el alumno. El
            sistema usará automáticamente su nombre, correo y boleta.
          </p>

          <form className="gridX" onSubmit={addCalificacion}>
            <label>
              Materia
              <select
                value={form.materiaId}
                onChange={(event) => updateForm("materiaId", event.target.value)}
                disabled={!materias.length || saving || loading}
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
              Grupo
              <select
                value={form.grupo}
                onChange={(event) => updateForm("grupo", event.target.value)}
                disabled={!grupos.length || saving || loading}
              >
                <option value="">Selecciona un grupo</option>

                {grupos.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Alumno
              <select
                value={form.alumnoEmail}
                onChange={(event) =>
                  updateForm("alumnoEmail", event.target.value)
                }
                disabled={!form.grupo || !alumnosDelGrupo.length || saving || loading}
              >
                <option value="">Selecciona un alumno</option>

                {alumnosDelGrupo.map((alumno) => (
                  <option key={alumno.email} value={alumno.email}>
                    {alumno.name} · {alumno.boleta || "Sin boleta"} ·{" "}
                    {alumno.email}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Calificación
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                placeholder="Ej. 8.5"
                value={form.calificacion}
                onChange={(event) =>
                  updateForm("calificacion", event.target.value)
                }
                disabled={saving || loading}
              />
            </label>

            <button
              type="submit"
              disabled={
                saving ||
                loading ||
                !materias.length ||
                !form.grupo ||
                !form.alumnoEmail
              }
            >
              {saving ? "Guardando..." : "Guardar calificación"}
            </button>
          </form>

          {alumnoSeleccionado && (
            <div className="item planSpacingSmall">
              <div>
                <strong>{alumnoSeleccionado.name}</strong>
                <p className="muted">
                  Grupo {alumnoSeleccionado.grupo || "sin grupo"} · Boleta{" "}
                  {alumnoSeleccionado.boleta || "sin boleta"} ·{" "}
                  {alumnoSeleccionado.email}
                </p>
              </div>

              <span className="badge ok">Alumno seleccionado</span>
            </div>
          )}

          {!alumnos.length && !loading && (
            <p className="msg">
              No hay alumnos registrados. Primero debe existir al menos un alumno
              con grupo y boleta.
            </p>
          )}
        </section>

        <section className="card">
          <h2>Filtros de registros</h2>

          <div className="gridX">
            <label>
              Materia
              <select
                value={filtroMateria}
                onChange={(event) => setFiltroMateria(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todas las materias</option>

                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Grupo
              <select
                value={filtroGrupo}
                onChange={(event) => setFiltroGrupo(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todos los grupos</option>

                {grupos.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Orden
              <select
                value={orden}
                onChange={(event) => setOrden(event.target.value)}
                disabled={loading}
              >
                <option value="DESC">Mayor a menor</option>
                <option value="ASC">Menor a mayor</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Registros</h2>

          <div className="lista">
            {calificacionesFiltradas.map((calificacion) => (
              <div className="item" key={calificacion.id}>
                <div>
                  <strong>{calificacion.alumnoNombre}</strong>

                  <p className="muted">
                    {calificacion.materiaNombre} · Grupo{" "}
                    {calificacion.alumnoGrupo || "sin grupo"} · Boleta{" "}
                    {calificacion.alumnoBoleta || "sin boleta"} ·{" "}
                    {calificacion.alumnoEmail}
                  </p>
                </div>

                <div className="right">
                  {editId === calificacion.id ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        value={editVal}
                        onChange={(event) => setEditVal(event.target.value)}
                        disabled={Boolean(updatingId)}
                      />

                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={Boolean(updatingId)}
                      >
                        {updatingId === String(calificacion.id)
                          ? "Guardando..."
                          : "Guardar"}
                      </button>

                      <button
                        type="button"
                        className="btn-del"
                        onClick={cancelEdit}
                        disabled={Boolean(updatingId)}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`badge ${gradeClass(
                          calificacion.calificacion
                        )}`}
                      >
                        {fmtGrade(calificacion.calificacion)}
                      </span>

                      <button
                        type="button"
                        onClick={() => startEdit(calificacion)}
                        disabled={Boolean(deletingId)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn-del"
                        onClick={() => deleteCalificacion(calificacion)}
                        disabled={deletingId === String(calificacion.id)}
                      >
                        {deletingId === String(calificacion.id)
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {!calificacionesFiltradas.length && (
              <p className="msg">
                {loading ? "Cargando..." : "Sin registros"}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}