// Archivo: frontend/src/pages/Admin.jsx

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

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Administrador";
}

function normalizeSubjectName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateSubjectName(value) {
  const nombre = normalizeSubjectName(value);

  if (!nombre) {
    return "Escribe el nombre de la materia.";
  }

  if (nombre.length < 4) {
    return "El nombre de la materia debe tener mínimo 4 caracteres.";
  }

  if (nombre.length > 80) {
    return "El nombre de la materia no puede pasar de 80 caracteres.";
  }

  return "";
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no válida";
  }

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Admin() {
  const { showToast } = useToast();
  const { user, token: ctxToken } = useAuth();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [materias, setMaterias] = useState([]);
  const [maestros, setMaestros] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [teacherCodes, setTeacherCodes] = useState([]);

  const [materiaNueva, setMateriaNueva] = useState("");
  const [formAsignacion, setFormAsignacion] = useState({
    materiaId: "",
    maestroEmail: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingMateria, setSavingMateria] = useState(false);
  const [savingAsignacion, setSavingAsignacion] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [cancelingCodeId, setCancelingCodeId] = useState("");
  const [deletingMateriaId, setDeletingMateriaId] = useState("");
  const [deletingAsignacionId, setDeletingAsignacionId] = useState("");

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!token) {
      setMaterias([]);
      setMaestros([]);
      setAsignaciones([]);
      setTeacherCodes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [
        materiasData,
        maestrosData,
        asignacionesData,
        teacherCodesData,
      ] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/maestros", { token }),
        apiJSON("/asignaciones", { token }),
        apiJSON("/teacher-codes", { token }),
      ]);

      const materiasArr = toArray(materiasData);
      const maestrosArr = toArray(maestrosData);
      const asignacionesArr = toArray(asignacionesData);
      const teacherCodesArr = toArray(teacherCodesData);

      setMaterias(materiasArr);
      setMaestros(maestrosArr);
      setAsignaciones(asignacionesArr);
      setTeacherCodes(teacherCodesArr);

      setFormAsignacion((prev) => ({
        materiaId:
          prev.materiaId ||
          (materiasArr[0]?.id ? String(materiasArr[0].id) : ""),
        maestroEmail:
          prev.maestroEmail ||
          (maestrosArr[0]?.email ? maestrosArr[0].email : ""),
      }));
    } catch (error) {
      showToast({
        type: "error",
        title: "Error al cargar",
        message:
          error.message || "No se pudo cargar el panel de administración.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const totalMaterias = materias.length;
  const totalMaestros = maestros.length;
  const totalAsignaciones = asignaciones.length;
  const codigosDisponibles = teacherCodes.filter((item) => !item.used).length;
  const codigosUsados = teacherCodes.filter((item) => item.used).length;

  const maestrosSinAsignacion = useMemo(() => {
    const asignados = new Set(
      asignaciones.map((asignacion) =>
        String(asignacion.maestroEmail || "").toLowerCase()
      )
    );

    return maestros.filter(
      (maestro) => !asignados.has(String(maestro.email || "").toLowerCase())
    ).length;
  }, [maestros, asignaciones]);

  const addMateria = async (event) => {
    event.preventDefault();

    const nombre = normalizeSubjectName(materiaNueva);
    const error = validateSubjectName(nombre);

    if (error) {
      showToast({
        type: "warning",
        title: "Revisa la materia",
        message: error,
      });
      return;
    }

    try {
      setSavingMateria(true);

      await apiJSON("/materias", {
        token,
        method: "POST",
        body: { nombre },
      });

      setMateriaNueva("");

      showToast({
        type: "success",
        title: "Materia creada",
        message: `${nombre} fue agregada correctamente.`,
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo crear",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSavingMateria(false);
    }
  };

  const deleteMateria = async (materia) => {
    try {
      setDeletingMateriaId(String(materia.id));

      await apiJSON(`/materias/${materia.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Materia eliminada",
        message: materia.nombre,
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se eliminó",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setDeletingMateriaId("");
    }
  };

  const addAsignacion = async (event) => {
    event.preventDefault();

    if (!formAsignacion.materiaId || !formAsignacion.maestroEmail) {
      showToast({
        type: "warning",
        title: "Faltan datos",
        message: "Selecciona una materia y un maestro.",
      });
      return;
    }

    try {
      setSavingAsignacion(true);

      await apiJSON("/asignaciones", {
        token,
        method: "POST",
        body: {
          materiaId: Number(formAsignacion.materiaId),
          maestroEmail: formAsignacion.maestroEmail,
        },
      });

      showToast({
        type: "success",
        title: "Asignación creada",
        message: "El maestro recibió una nueva materia.",
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo asignar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setSavingAsignacion(false);
    }
  };

  const deleteAsignacion = async (asignacion) => {
    try {
      setDeletingAsignacionId(String(asignacion.id));

      await apiJSON(`/asignaciones/${asignacion.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Asignación eliminada",
        message: "La materia fue retirada del maestro.",
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "Error",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setDeletingAsignacionId("");
    }
  };

  const generateTeacherCode = async () => {
    try {
      setGeneratingCode(true);

      const response = await apiJSON("/teacher-codes", {
        token,
        method: "POST",
        body: {},
      });

      const code = response?.item?.code || "Código generado";

      showToast({
        type: "success",
        title: "Código docente generado",
        message: code,
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo generar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setGeneratingCode(false);
    }
  };

  const cancelTeacherCode = async (codeItem) => {
    try {
      setCancelingCodeId(String(codeItem.id));

      await apiJSON(`/teacher-codes/${codeItem.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        type: "success",
        title: "Código cancelado",
        message: codeItem.code,
      });

      await loadAdminData();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cancelar",
        message: error.message || "Intenta nuevamente.",
      });
    } finally {
      setCancelingCodeId("");
    }
  };

  const copyTeacherCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);

      showToast({
        type: "success",
        title: "Código copiado",
        message: code,
      });
    } catch {
      showToast({
        type: "info",
        title: "Copia manual",
        message: code,
      });
    }
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Administración del sistema</h1>

            <p className="msg">
              {getUserName(user)} · Gestión académica avanzada
            </p>
          </div>

          <button
            className="btn-ghost"
            type="button"
            onClick={loadAdminData}
            disabled={
              loading ||
              savingMateria ||
              savingAsignacion ||
              generatingCode ||
              Boolean(cancelingCodeId) ||
              Boolean(deletingMateriaId) ||
              Boolean(deletingAsignacionId)
            }
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen administrativo</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{totalMaterias}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Maestros</div>
              <div className="kpiValue">{totalMaestros}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Asignaciones</div>
              <div className="kpiValue">{totalAsignaciones}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Códigos disponibles</div>
              <div className="kpiValue">{codigosDisponibles}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row-between">
            <div>
              <h2>Códigos docentes</h2>

              <p className="msg">
                Genera códigos únicos para que solo maestros autorizados puedan
                crear una cuenta. Cada código solo puede usarse una vez.
              </p>
            </div>

            <button
              type="button"
              onClick={generateTeacherCode}
              disabled={loading || generatingCode}
            >
              {generatingCode ? "Generando..." : "Generar código"}
            </button>
          </div>

          <div className="coachRow planSpacingSmall">
            <div className="kpi">
              <div className="kpiTitle">Disponibles</div>
              <div className="kpiValue">{codigosDisponibles}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Usados / cancelados</div>
              <div className="kpiValue">{codigosUsados}</div>
            </div>
          </div>

          <div className="lista">
            {teacherCodes.map((codeItem) => {
              const usedBy = codeItem.usedBy || "";
              const isCanceled =
                usedBy.toUpperCase() === "CANCELADO POR ADMIN";

              return (
                <div className="item" key={codeItem.id}>
                  <div>
                    <strong>{codeItem.code}</strong>

                    <p className="muted">
                      Creado por {codeItem.createdBy || "Administrador"} ·{" "}
                      {formatDate(codeItem.createdAt)}
                    </p>

                    {codeItem.used && (
                      <p className="muted">
                        {isCanceled
                          ? "Cancelado por administrador"
                          : `Usado por ${codeItem.usedBy}`}{" "}
                        · {formatDate(codeItem.usedAt)}
                      </p>
                    )}
                  </div>

                  <div className="right">
                    <span className={`badge ${codeItem.used ? "warn" : "ok"}`}>
                      {codeItem.used ? "No disponible" : "Disponible"}
                    </span>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => copyTeacherCode(codeItem.code)}
                    >
                      Copiar
                    </button>

                    {!codeItem.used && (
                      <button
                        type="button"
                        className="btn-del"
                        onClick={() => cancelTeacherCode(codeItem)}
                        disabled={cancelingCodeId === String(codeItem.id)}
                      >
                        {cancelingCodeId === String(codeItem.id)
                          ? "Cancelando..."
                          : "Cancelar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!teacherCodes.length && !loading && (
              <p className="msg">
                Todavía no hay códigos docentes. Genera uno para registrar
                maestros autorizados.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Crear materia</h2>

          <p className="msg">
            Registra las materias que podrán asignarse a maestros y usarse para
            capturar calificaciones.
          </p>

          <form className="row planWrap planSpacingSmall" onSubmit={addMateria}>
            <input
              value={materiaNueva}
              onChange={(event) => setMateriaNueva(event.target.value)}
              placeholder="Ej. Matemáticas, Física, Programación Web"
              disabled={savingMateria}
            />

            <button type="submit" disabled={savingMateria || loading}>
              {savingMateria ? "Guardando..." : "Agregar materia"}
            </button>
          </form>

          <div className="lista">
            {materias.map((materia) => (
              <div className="item" key={materia.id}>
                <div>
                  <strong>{materia.nombre}</strong>
                  <p className="muted">ID interno: {materia.id}</p>
                </div>

                <button
                  type="button"
                  className="btn-del"
                  onClick={() => deleteMateria(materia)}
                  disabled={
                    savingMateria ||
                    savingAsignacion ||
                    deletingMateriaId === String(materia.id)
                  }
                >
                  {deletingMateriaId === String(materia.id)
                    ? "Eliminando..."
                    : "Eliminar"}
                </button>
              </div>
            ))}

            {!materias.length && !loading && (
              <p className="msg">Todavía no hay materias registradas.</p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Asignar materia a maestro</h2>

          <p className="msg">
            Selecciona una materia y un maestro para permitirle capturar
            calificaciones en esa asignatura.
          </p>

          <form className="gridX" onSubmit={addAsignacion}>
            <label>
              Materia
              <select
                value={formAsignacion.materiaId}
                onChange={(event) =>
                  setFormAsignacion((prev) => ({
                    ...prev,
                    materiaId: event.target.value,
                  }))
                }
                disabled={!materias.length || savingAsignacion || loading}
              >
                <option value="">Selecciona una materia</option>

                {materias.map((materia) => (
                  <option value={materia.id} key={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Maestro
              <select
                value={formAsignacion.maestroEmail}
                onChange={(event) =>
                  setFormAsignacion((prev) => ({
                    ...prev,
                    maestroEmail: event.target.value,
                  }))
                }
                disabled={!maestros.length || savingAsignacion || loading}
              >
                <option value="">Selecciona un maestro</option>

                {maestros.map((maestro) => (
                  <option key={maestro.email} value={maestro.email}>
                    {getUserName(maestro)} · {maestro.email}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={
                !materias.length ||
                !maestros.length ||
                savingAsignacion ||
                loading
              }
            >
              {savingAsignacion ? "Asignando..." : "Crear asignación"}
            </button>
          </form>

          {!maestros.length && !loading && (
            <p className="msg">
              No hay maestros registrados. Genera un código docente y crea una
              cuenta con rol de maestro.
            </p>
          )}
        </section>

        <section className="card">
          <h2>Asignaciones activas</h2>

          <div className="lista">
            {asignaciones.map((asignacion) => (
              <div className="item" key={asignacion.id}>
                <div>
                  <strong>{asignacion.materiaNombre}</strong>

                  <p className="muted">
                    {asignacion.maestroNombre || "Maestro"} ·{" "}
                    {asignacion.maestroEmail}
                  </p>
                </div>

                <button
                  className="btn-del"
                  type="button"
                  onClick={() => deleteAsignacion(asignacion)}
                  disabled={
                    savingMateria ||
                    savingAsignacion ||
                    deletingAsignacionId === String(asignacion.id)
                  }
                >
                  {deletingAsignacionId === String(asignacion.id)
                    ? "Quitando..."
                    : "Quitar"}
                </button>
              </div>
            ))}

            {!asignaciones.length && !loading && (
              <p className="msg">No hay asignaciones activas.</p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Maestros registrados</h2>

          <div className="lista">
            {maestros.map((maestro) => {
              const total = asignaciones.filter(
                (asignacion) =>
                  String(asignacion.maestroEmail || "").toLowerCase() ===
                  String(maestro.email || "").toLowerCase()
              ).length;

              return (
                <div className="item" key={maestro.email}>
                  <div>
                    <strong>{getUserName(maestro)}</strong>
                    <p className="muted">{maestro.email}</p>
                  </div>

                  <span className={`badge ${total ? "ok" : "warn"}`}>
                    {total ? `${total} materia(s)` : "Sin asignar"}
                  </span>
                </div>
              );
            })}

            {!maestros.length && !loading && (
              <p className="msg">No hay maestros registrados.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}