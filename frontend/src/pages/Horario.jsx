// Archivo: frontend/src/pages/Horario.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";

import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";

const DAYS = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
];

const EMPTY_FORM = {
  materia: "",
  dia: "lunes",
  inicio: "07:00",
  fin: "08:00",
  aula: "",
  profesor: "",
  notas: "",
  color: "#0f766e",
};

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

function minutesFromTime(value) {
  const [hh, mm] = String(value || "00:00")
    .split(":")
    .map((part) => Number(part));

  const hours = Number.isFinite(hh) ? hh : 0;
  const minutes = Number.isFinite(mm) ? mm : 0;

  return hours * 60 + minutes;
}

function formatTime(value) {
  return value || "—";
}

function sortClasses(a, b) {
  if (a.dia !== b.dia) {
    const dayA = DAYS.findIndex((day) => day.value === a.dia);
    const dayB = DAYS.findIndex((day) => day.value === b.dia);

    return dayA - dayB;
  }

  return minutesFromTime(a.inicio) - minutesFromTime(b.inicio);
}

function getCurrentDayKey() {
  const day = new Date().getDay();

  const map = {
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    6: "sabado",
  };

  return map[day] || "lunes";
}

function getNextClass(classes) {
  const now = new Date();
  const todayKey = getCurrentDayKey();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayPending = classes
    .filter((item) => item.dia === todayKey)
    .filter((item) => minutesFromTime(item.fin) >= currentMinutes)
    .sort((a, b) => minutesFromTime(a.inicio) - minutesFromTime(b.inicio));

  if (todayPending.length) {
    return todayPending[0];
  }

  return [...classes].sort(sortClasses)[0] || null;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function Horario() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!token) {
      setClasses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiJSON("/horario", { token });
      setClasses(toArray(data));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el horario",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const filteredClasses = useMemo(() => {
    const term = query.trim().toLowerCase();

    return [...classes]
      .filter((item) => (dayFilter === "ALL" ? true : item.dia === dayFilter))
      .filter((item) => {
        if (!term) return true;

        return [
          item.materia,
          item.aula,
          item.profesor,
          item.notas,
          DAYS.find((day) => day.value === item.dia)?.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort(sortClasses);
  }, [classes, dayFilter, query]);

  const nextClass = useMemo(() => getNextClass(classes), [classes]);

  const summary = useMemo(() => {
    const total = classes.length;
    const daysUsed = new Set(classes.map((item) => item.dia)).size;
    const subjects = new Set(
      classes.map((item) => item.materia.trim().toLowerCase()).filter(Boolean)
    ).size;

    const totalMinutes = classes.reduce((acc, item) => {
      const start = minutesFromTime(item.inicio);
      const end = minutesFromTime(item.fin);
      return acc + Math.max(0, end - start);
    }, 0);

    return {
      total,
      daysUsed,
      subjects,
      hours: totalMinutes / 60,
    };
  }, [classes]);

  const updateForm = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  const saveClass = async (event) => {
    event.preventDefault();

    if (!form.materia.trim()) {
      showToast({
        type: "error",
        title: "Falta la materia",
        message: "Escribe el nombre de la materia o clase.",
      });
      return;
    }

    try {
      setSaving(true);

      const endpoint = editingId
        ? `/horario/${encodeURIComponent(editingId)}`
        : "/horario";

      const method = editingId ? "PATCH" : "POST";

      const response = await apiJSON(endpoint, {
        method,
        token,
        body: form,
      });

      const saved = editingId ? response.updated : response;

      setClasses((prev) => {
        if (editingId) {
          return prev.map((item) => (String(item.id) === String(editingId) ? saved : item));
        }

        return [...prev, saved];
      });

      showToast({
        type: "success",
        title: editingId ? "Clase actualizada" : "Clase agregada",
        message: "El horario escolar fue guardado en la base de datos.",
      });

      resetForm();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo guardar",
        message: error.message || "Revisa los datos de la clase.",
      });
    } finally {
      setSaving(false);
    }
  };

  const editClass = (item) => {
    setEditingId(item.id);
    setForm({
      materia: item.materia || "",
      dia: item.dia || "lunes",
      inicio: item.inicio || "07:00",
      fin: item.fin || "08:00",
      aula: item.aula || "",
      profesor: item.profesor || "",
      notas: item.notas || "",
      color: item.color || "#0f766e",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteClass = async (id) => {
    const target = classes.find((item) => String(item.id) === String(id));

    if (!target) return;

    const confirmed = window.confirm(
      `¿Eliminar la clase "${target.materia}" del horario?`
    );

    if (!confirmed) return;

    try {
      await apiJSON(`/horario/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token,
      });

      setClasses((prev) => prev.filter((item) => String(item.id) !== String(id)));

      if (String(editingId) === String(id)) {
        resetForm();
      }

      showToast({
        type: "success",
        title: "Clase eliminada",
        message: "Se quitó del horario escolar.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo eliminar",
        message: error.message || "Intenta de nuevo.",
      });
    }
  };

  const copySchedule = async () => {
    const lines = [
      "Horario escolar - Punto y Coma",
      "",
      `Alumno: ${getUserName(user)}`,
      "",
      ...DAYS.flatMap((day) => {
        const rows = classes
          .filter((item) => item.dia === day.value)
          .sort((a, b) => minutesFromTime(a.inicio) - minutesFromTime(b.inicio));

        if (!rows.length) {
          return [`${day.label}: Sin clases registradas`];
        }

        return [
          `${day.label}:`,
          ...rows.map(
            (item) =>
              `- ${item.inicio} a ${item.fin} | ${item.materia}${
                item.aula ? ` | Aula: ${item.aula}` : ""
              }${item.profesor ? ` | Profesor: ${item.profesor}` : ""}`
          ),
        ];
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Horario copiado",
        message: "Tu horario fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa los permisos del navegador.",
      });
    }
  };

  const printSchedule = () => {
    const rows = DAYS.map((day) => {
      const dayClasses = classes
        .filter((item) => item.dia === day.value)
        .sort((a, b) => minutesFromTime(a.inicio) - minutesFromTime(b.inicio));

      return `
        <section>
          <h2>${escapeHTML(day.label)}</h2>
          ${
            dayClasses.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Materia</th>
                      <th>Aula</th>
                      <th>Profesor</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${dayClasses
                      .map(
                        (item) => `
                          <tr>
                            <td>${escapeHTML(item.inicio)} - ${escapeHTML(
                          item.fin
                        )}</td>
                            <td>${escapeHTML(item.materia)}</td>
                            <td>${escapeHTML(item.aula || "—")}</td>
                            <td>${escapeHTML(item.profesor || "—")}</td>
                            <td>${escapeHTML(item.notas || "—")}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>`
              : "<p>Sin clases registradas.</p>"
          }
        </section>
      `;
    }).join("");

    const win = window.open("", "_blank", "noopener,noreferrer");

    if (!win) {
      showToast({
        type: "error",
        title: "No se pudo imprimir",
        message: "El navegador bloqueó la ventana emergente.",
      });
      return;
    }

    win.document.open();
    win.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Horario escolar - Punto y Coma</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              margin: 32px;
              line-height: 1.45;
            }

            h1 {
              color: #7a0033;
              border-bottom: 3px solid #7a0033;
              padding-bottom: 12px;
            }

            h2 {
              color: #111827;
              margin-top: 24px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }

            th {
              background: #7a0033;
              color: white;
              text-align: left;
            }

            th, td {
              border: 1px solid #d1d5db;
              padding: 8px;
              font-size: 12px;
              vertical-align: top;
            }

            button {
              margin-bottom: 16px;
              padding: 10px 14px;
              border-radius: 10px;
              border: 0;
              background: #7a0033;
              color: white;
              font-weight: 700;
              cursor: pointer;
            }

            @media print {
              button {
                display: none;
              }

              body {
                margin: 18px;
              }
            }
          </style>
        </head>

        <body>
          <button onclick="window.print()">Imprimir</button>
          <h1>Horario escolar - Punto y Coma</h1>
          <p><strong>Alumno:</strong> ${escapeHTML(getUserName(user))}</p>
          ${rows}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <span className="badge ok">Organización escolar</span>

            <h1>Horario escolar</h1>

            <p className="msg">
              {getUserName(user)} · Registra tus clases de la semana, horarios,
              salones, profesores y notas importantes.
            </p>
          </div>

          <div className="row planWrap">
            <button
              type="button"
              className="btn-ghost"
              onClick={loadSchedule}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>

            <button type="button" className="btn-ghost" onClick={copySchedule}>
              Copiar horario
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Resumen del horario</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Clases</div>
              <div className="kpiValue">{summary.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{summary.subjects}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Días con clase</div>
              <div className="kpiValue">{summary.daysUsed}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Horas semanales</div>
              <div className="kpiValue">{summary.hours.toFixed(1)}</div>
            </div>
          </div>

          {nextClass && (
            <div className="item planSpacingSmall">
              <div>
                <strong>Próxima clase registrada</strong>
                <p className="muted">
                  {nextClass.materia} · {formatTime(nextClass.inicio)} a{" "}
                  {formatTime(nextClass.fin)} ·{" "}
                  {DAYS.find((day) => day.value === nextClass.dia)?.label}
                  {nextClass.aula ? ` · Aula ${nextClass.aula}` : ""}
                </p>
              </div>

              <span className="badge ok">Siguiente</span>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{editingId ? "Editar clase" : "Agregar clase"}</h2>

          <form onSubmit={saveClass}>
            <div className="gridX">
              <label>
                Materia
                <input
                  value={form.materia}
                  onChange={(event) => updateForm("materia", event.target.value)}
                  placeholder="Ej. Programación"
                  disabled={saving}
                />
              </label>

              <label>
                Día
                <select
                  value={form.dia}
                  onChange={(event) => updateForm("dia", event.target.value)}
                  disabled={saving}
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Hora de entrada
                <input
                  type="time"
                  value={form.inicio}
                  onChange={(event) => updateForm("inicio", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label>
                Hora de salida
                <input
                  type="time"
                  value={form.fin}
                  onChange={(event) => updateForm("fin", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label>
                Aula / salón
                <input
                  value={form.aula}
                  onChange={(event) => updateForm("aula", event.target.value)}
                  placeholder="Ej. Aula 203"
                  disabled={saving}
                />
              </label>

              <label>
                Profesor
                <input
                  value={form.profesor}
                  onChange={(event) =>
                    updateForm("profesor", event.target.value)
                  }
                  placeholder="Nombre del profesor"
                  disabled={saving}
                />
              </label>

              <label>
                Color
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => updateForm("color", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label>
                Notas
                <input
                  value={form.notas}
                  onChange={(event) => updateForm("notas", event.target.value)}
                  placeholder="Ej. Llevar cuaderno, laboratorio, etc."
                  disabled={saving}
                />
              </label>
            </div>

            <div className="row planWrap planSpacingSmall">
              <button type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Agregar clase"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Vista semanal</h2>

          <div className="gridX">
            <label>
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Materia, aula, profesor o notas"
              />
            </label>

            <label>
              Filtrar día
              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
              >
                <option value="ALL">Toda la semana</option>

                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button type="button" className="btn-ghost" onClick={copySchedule}>
              Copiar horario
            </button>

            <button type="button" onClick={printSchedule}>
              Imprimir limpio
            </button>
          </div>

          <div className="lista">
            {DAYS.filter((day) =>
              dayFilter === "ALL" ? true : day.value === dayFilter
            ).map((day) => {
              const dayClasses = filteredClasses.filter(
                (item) => item.dia === day.value
              );

              return (
                <div className="item" key={day.value}>
                  <div className="textClamp">
                    <strong>{day.label}</strong>

                    {!dayClasses.length && (
                      <p className="muted">Sin clases registradas.</p>
                    )}

                    {dayClasses.map((item) => (
                      <div
                        key={item.id}
                        className="item planSpacingSmall"
                        style={{
                          borderLeft: `6px solid ${item.color || "#0f766e"}`,
                        }}
                      >
                        <div className="textClamp">
                          <strong>{item.materia}</strong>

                          <p className="muted">
                            {formatTime(item.inicio)} a {formatTime(item.fin)}
                            {item.aula ? ` · Aula ${item.aula}` : ""}
                            {item.profesor ? ` · ${item.profesor}` : ""}
                          </p>

                          {item.notas && <p className="muted">{item.notas}</p>}
                        </div>

                        <div className="right">
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => editClass(item)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteClass(item.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <span className="badge">{dayClasses.length}</span>
                </div>
              );
            })}

            {loading && <p className="msg">Cargando horario...</p>}

            {!loading && !filteredClasses.length && classes.length > 0 && (
              <p className="msg">
                No hay clases que coincidan con la búsqueda o el filtro.
              </p>
            )}

            {!loading && !classes.length && (
              <p className="msg">
                Aún no tienes clases registradas. Agrega tu primera clase desde
                el formulario.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
