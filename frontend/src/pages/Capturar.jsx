// Archivo: frontend/src/pages/Capturar.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";

import NavBar from "../components/layout/NavBar.jsx";

import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";

import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function Capturar() {
  const { showToast } = useToast();
  const confirm = useConfirm();

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

  const [form, setForm] = useState({
    alumnoNombre: "",
    alumnoEmail: "",
    materiaId: "",
    calificacion: "",
  });

  const [filtroMateria, setFiltroMateria] = useState("ALL");
  const [orden, setOrden] = useState("DESC");

  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTeacherData = useCallback(async () => {
    if (!token) {
      setMaterias([]);
      setCalificaciones([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [materiasData, calificacionesData] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/calificaciones", { token }),
      ]);

      const materiasArr = toArray(materiasData);
      const calificacionesArr = toArray(calificacionesData);

      setMaterias(materiasArr);
      setCalificaciones(calificacionesArr);

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

  const calificacionesFiltradas = useMemo(() => {
    let data = [...calificaciones];

    if (filtroMateria !== "ALL") {
      data = data.filter(
        (item) => String(item.materiaId) === String(filtroMateria)
      );
    }

    data.sort((a, b) => {
      const gradeA = Number(a.calificacion);
      const gradeB = Number(b.calificacion);

      return orden === "DESC" ? gradeB - gradeA : gradeA - gradeB;
    });

    return data;
  }, [calificaciones, filtroMateria, orden]);

  const alumnosEvaluados = useMemo(() => {
    return new Set(
      calificaciones
        .map((item) => String(item.alumnoEmail || "").toLowerCase())
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
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const alumnoNombre = form.alumnoNombre.trim();
    const alumnoEmail = form.alumnoEmail.trim().toLowerCase();
    const gradeError = validateGrade(form.calificacion);

    if (!alumnoNombre || !alumnoEmail || !form.materiaId) {
      return "Completa todos los campos.";
    }

    if (!EMAIL_RE.test(alumnoEmail)) {
      return "Ingresa un correo válido para el alumno.";
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
          alumnoNombre: form.alumnoNombre.trim(),
          alumnoEmail: form.alumnoEmail.trim().toLowerCase(),
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
        alumnoNombre: "",
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
    const ok = await confirm({
      title: "Eliminar calificación",
      message: `¿Eliminar registro de ${calificacion.alumnoNombre}?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    try {
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
              {getUserName(user)} · Control académico de alumnos
            </p>
          </div>

          <button
            className="btn-ghost"
            type="button"
            onClick={loadTeacherData}
            disabled={loading || saving}
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

          <form className="gridX" onSubmit={addCalificacion}>
            <input
              placeholder="Alumno"
              value={form.alumnoNombre}
              onChange={(event) =>
                updateForm("alumnoNombre", event.target.value)
              }
              disabled={saving || loading}
            />

            <input
              placeholder="Correo"
              value={form.alumnoEmail}
              onChange={(event) =>
                updateForm("alumnoEmail", event.target.value)
              }
              disabled={saving || loading}
            />

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

            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              placeholder="Calificación"
              value={form.calificacion}
              onChange={(event) =>
                updateForm("calificacion", event.target.value)
              }
              disabled={saving || loading}
            />

            <button type="submit" disabled={saving || loading || !materias.length}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>
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
                    {calificacion.materiaNombre} · {calificacion.alumnoEmail}
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
                      />

                      <button type="button" onClick={saveEdit}>
                        Guardar
                      </button>

                      <button
                        type="button"
                        className="btn-del"
                        onClick={cancelEdit}
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

                      <button type="button" onClick={() => startEdit(calificacion)}>
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn-del"
                        onClick={() => deleteCalificacion(calificacion)}
                      >
                        Eliminar
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