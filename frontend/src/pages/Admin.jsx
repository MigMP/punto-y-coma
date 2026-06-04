import React, { useEffect, useMemo, useState } from "react";

import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";

export default function Admin() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { user, token: ctxToken } = useAuth();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [materias, setMaterias] = useState([]);
  const [maestros, setMaestros] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  const [materiaNueva, setMateriaNueva] = useState("");
  const [formAsignacion, setFormAsignacion] = useState({
    materiaId: "",
    maestroEmail: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingMateria, setSavingMateria] = useState(false);
  const [savingAsignacion, setSavingAsignacion] = useState(false);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      const [materiasData, maestrosData, asignacionesData] = await Promise.all([
        apiJSON("/materias", { token }),
        apiJSON("/maestros", { token }),
        apiJSON("/asignaciones", { token }),
      ]);

      const materiasArr = Array.isArray(materiasData) ? materiasData : [];
      const maestrosArr = Array.isArray(maestrosData) ? maestrosData : [];
      const asignacionesArr = Array.isArray(asignacionesData)
        ? asignacionesData
        : [];

      setMaterias(materiasArr);
      setMaestros(maestrosArr);
      setAsignaciones(asignacionesArr);

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
        message: error.message || "No se pudo cargar el panel de administración.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMaterias = materias.length;
  const totalMaestros = maestros.length;
  const totalAsignaciones = asignaciones.length;

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

  const addMateria = async (e) => {
    e.preventDefault();

    const nombre = materiaNueva.trim();

    if (!nombre) {
      showToast({
        type: "warning",
        title: "Campo vacío",
        message: "Escribe el nombre de la materia.",
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
        message: error.message,
      });
    } finally {
      setSavingMateria(false);
    }
  };

  const deleteMateria = async (materia) => {
    const ok = await confirm({
      title: "Eliminar materia",
      message: `¿Seguro que quieres eliminar "${materia.nombre}"? También se eliminarán sus asignaciones y calificaciones relacionadas.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    try {
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
        message: error.message,
      });
    }
  };

  const addAsignacion = async (e) => {
    e.preventDefault();

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
        message: error.message,
      });
    } finally {
      setSavingAsignacion(false);
    }
  };

  const deleteAsignacion = async (asignacion) => {
    const ok = await confirm({
      title: "Quitar asignación",
      message: `Se quitará ${asignacion.materiaNombre} del maestro ${
        asignacion.maestroNombre || asignacion.maestroEmail
      }.`,
      confirmText: "Quitar",
      cancelText: "Cancelar",
      tone: "warning",
    });

    if (!ok) return;

    try {
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
        message: error.message,
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
              {user?.name || "Administrador"} · Gestión académica avanzada
            </p>
          </div>

          <button className="btn-ghost" type="button" onClick={loadAdminData}>
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
              <div className="kpiTitle">Maestros sin asignación</div>
              <div className="kpiValue">{maestrosSinAsignacion}</div>
            </div>
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
              onChange={(e) => setMateriaNueva(e.target.value)}
              placeholder="Ej. Matemáticas, Física, Programación Web"
              disabled={savingMateria}
            />

            <button type="submit" disabled={savingMateria}>
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
                >
                  Eliminar
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
                onChange={(e) =>
                  setFormAsignacion((prev) => ({
                    ...prev,
                    materiaId: e.target.value,
                  }))
                }
                disabled={!materias.length || savingAsignacion}
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
                onChange={(e) =>
                  setFormAsignacion((prev) => ({
                    ...prev,
                    maestroEmail: e.target.value,
                  }))
                }
                disabled={!maestros.length || savingAsignacion}
              >
                <option value="">Selecciona un maestro</option>
                {maestros.map((maestro) => (
                  <option key={maestro.email} value={maestro.email}>
                    {maestro.name} · {maestro.email}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={!materias.length || !maestros.length || savingAsignacion}
            >
              {savingAsignacion ? "Asignando..." : "Crear asignación"}
            </button>
          </form>

          {!maestros.length && !loading && (
            <p className="msg">
              No hay maestros registrados. Crea una cuenta con rol de maestro.
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
                >
                  Quitar
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
                    <strong>{maestro.name}</strong>
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
