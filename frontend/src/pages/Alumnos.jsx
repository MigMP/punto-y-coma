// Archivo: frontend/src/pages/Alumnos.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Link } from "react-router-dom";

import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "riesgo_alto", label: "Riesgo alto" },
  { value: "observacion", label: "En observación" },
  { value: "estable", label: "Estables" },
  { value: "sin_datos", label: "Sin calificaciones" },
];

const ORDEN_OPTIONS = [
  { value: "RIESGO", label: "Mayor riesgo" },
  { value: "PROMEDIO_ASC", label: "Promedio más bajo" },
  { value: "PROMEDIO_DESC", label: "Promedio más alto" },
  { value: "NOMBRE", label: "Nombre A-Z" },
  { value: "ULTIMO", label: "Última actualización" },
  { value: "REGISTROS", label: "Más registros" },
];

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function fmt(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function fmtShort(value) {
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

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function getStudentName(alumno) {
  return alumno?.nombre || alumno?.name || alumno?.email || "Alumno";
}

function academicStatus(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return {
      value: "sin_datos",
      className: "",
      label: "Sin datos",
      description: "Aún no tiene calificaciones registradas.",
      priority: 4,
    };
  }

  if (n < 6) {
    return {
      value: "riesgo_alto",
      className: "bad",
      label: "Riesgo alto",
      description: "Necesita atención inmediata para evitar reprobación.",
      priority: 1,
    };
  }

  if (n < 8) {
    return {
      value: "observacion",
      className: "warn",
      label: "En observación",
      description: "Tiene avance aceptable, pero requiere refuerzo.",
      priority: 2,
    };
  }

  return {
    value: "estable",
    className: "ok",
    label: "Estable",
    description: "Mantiene un rendimiento académico favorable.",
    priority: 3,
  };
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

function dateTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function recommendationForStudent(alumno) {
  const promedio = Number(alumno.promedio);

  if (!Number.isFinite(promedio)) {
    return "Registrar calificaciones para iniciar seguimiento real del alumno.";
  }

  if (promedio < 6) {
    return "Atención urgente: revisar materias más bajas, tareas pendientes y acordar apoyo con el maestro.";
  }

  if (promedio < 8) {
    return "Refuerzo preventivo: practicar temas débiles y revisar avances antes del siguiente parcial.";
  }

  return "Mantener desempeño: conservar hábitos de estudio y reforzar con ejercicios de mayor dificultad.";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadHTML(filename, html) {
  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function applyCellStyle(sheet, rangeAddress, style) {
  const range = XLSX.utils.decode_range(rangeAddress);

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });

      if (!sheet[cellAddress]) {
        sheet[cellAddress] = { t: "s", v: "" };
      }

      sheet[cellAddress].s = style;
    }
  }
}

function styleHeaderRow(sheet, rowIndex, fromCol, toCol, style) {
  for (let col = fromCol; col <= toCol; col += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: col });

    if (sheet[address]) {
      sheet[address].s = style;
    }
  }
}

export default function Alumnos() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [alumnos, setAlumnos] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState("RIESGO");
  const [grupoFilter, setGrupoFilter] = useState("ALL");
  const [materiaFilter, setMateriaFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [soloPrioridad, setSoloPrioridad] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadAlumnos = useCallback(async () => {
    if (!token) {
      setAlumnos([]);
      setCalificaciones([]);
      setMaterias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [alumnosData, calificacionesData, materiasData] =
        await Promise.all([
          apiJSON("/alumnos", { token }),
          apiJSON("/calificaciones", { token }),
          apiJSON("/materias", { token }),
        ]);

      setAlumnos(toArray(alumnosData));
      setCalificaciones(toArray(calificacionesData));
      setMaterias(toArray(materiasData));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar alumnos",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadAlumnos();
  }, [loadAlumnos]);

  const groupOptions = useMemo(() => {
    return [...new Set(alumnos.map((item) => item.grupo).filter(Boolean))]
      .map((grupo) => String(grupo))
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [alumnos]);

  const materiaOptions = useMemo(() => {
    return materias
      .map((materia) => ({
        id: String(materia.id),
        nombre: materia.nombre || `Materia ${materia.id}`,
      }))
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );
  }, [materias]);

  const alumnosAnalizados = useMemo(() => {
    return alumnos.map((alumno) => {
      const email = String(alumno.email || "").toLowerCase();

      let registros = calificaciones.filter(
        (calificacion) =>
          String(calificacion.alumnoEmail || "").toLowerCase() === email
      );

      if (materiaFilter !== "ALL") {
        registros = registros.filter(
          (registro) => String(registro.materiaId) === String(materiaFilter)
        );
      }

      const valores = registros
        .map((registro) => Number(registro.calificacion))
        .filter(Number.isFinite);

      const promedio = valores.length
        ? valores.reduce((acc, value) => acc + value, 0) / valores.length
        : null;

      const materiasEvaluadas = new Set(
        registros
          .map((registro) =>
            String(registro.materiaId || registro.materiaNombre || "")
          )
          .filter(Boolean)
      ).size;

      const materiasBajas = registros
        .filter((registro) => Number(registro.calificacion) < 8)
        .sort((a, b) => Number(a.calificacion) - Number(b.calificacion))
        .slice(0, 3)
        .map((registro) => ({
          materia: registro.materiaNombre || registro.materiaId || "Materia",
          calificacion: registro.calificacion,
          periodo: registro.periodo || "Final",
        }));

      const materiasRiesgo = registros.filter(
        (registro) => Number(registro.calificacion) < 7
      ).length;

      const ultimoRegistro = [...registros].sort((a, b) => {
        const dateA = dateTime(a.updatedAt || a.createdAt);
        const dateB = dateTime(b.updatedAt || b.createdAt);

        return dateB - dateA;
      })[0];

      const status = academicStatus(promedio);

      return {
        ...alumno,
        nombreVisible: getStudentName(alumno),
        promedio,
        registros: registros.length,
        materiasEvaluadas,
        materiasRiesgo,
        materiasBajas,
        ultimoRegistro,
        status,
        recomendacion: recommendationForStudent({ promedio }),
      };
    });
  }, [alumnos, calificaciones, materiaFilter]);

  const alumnosFiltrados = useMemo(() => {
    const term = query.trim().toLowerCase();
    let data = [...alumnosAnalizados];

    if (grupoFilter !== "ALL") {
      data = data.filter(
        (alumno) => String(alumno.grupo || "") === String(grupoFilter)
      );
    }

    if (statusFilter !== "ALL") {
      data = data.filter((alumno) => alumno.status.value === statusFilter);
    }

    if (soloPrioridad) {
      data = data.filter((alumno) =>
        ["riesgo_alto", "observacion", "sin_datos"].includes(
          alumno.status.value
        )
      );
    }

    if (term) {
      data = data.filter((alumno) => {
        const searchable = [
          alumno.nombre,
          alumno.name,
          alumno.nombreVisible,
          alumno.email,
          alumno.grupo,
          alumno.boleta,
          alumno.status.label,
          alumno.status.description,
          alumno.materiasBajas
            ?.map((item) => `${item.materia} ${item.periodo}`)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    data.sort((a, b) => {
      const promedioA = Number.isFinite(a.promedio) ? a.promedio : null;
      const promedioB = Number.isFinite(b.promedio) ? b.promedio : null;

      if (orden === "NOMBRE") {
        return String(a.nombreVisible || "").localeCompare(
          String(b.nombreVisible || ""),
          "es",
          { sensitivity: "base" }
        );
      }

      if (orden === "PROMEDIO_DESC") {
        return Number(promedioB ?? -1) - Number(promedioA ?? -1);
      }

      if (orden === "PROMEDIO_ASC") {
        return Number(promedioA ?? 99) - Number(promedioB ?? 99);
      }

      if (orden === "ULTIMO") {
        const dateA = dateTime(a.ultimoRegistro?.updatedAt || a.ultimoRegistro?.createdAt);
        const dateB = dateTime(b.ultimoRegistro?.updatedAt || b.ultimoRegistro?.createdAt);

        return dateB - dateA;
      }

      if (orden === "REGISTROS") {
        return Number(b.registros || 0) - Number(a.registros || 0);
      }

      if (a.status.priority !== b.status.priority) {
        return a.status.priority - b.status.priority;
      }

      if (b.materiasRiesgo !== a.materiasRiesgo) {
        return Number(b.materiasRiesgo || 0) - Number(a.materiasRiesgo || 0);
      }

      return Number(promedioA ?? 99) - Number(promedioB ?? 99);
    });

    return data;
  }, [
    alumnosAnalizados,
    query,
    orden,
    grupoFilter,
    materiaFilter,
    statusFilter,
    soloPrioridad,
  ]);

  const resumen = useMemo(() => {
    const conDatos = alumnosFiltrados.filter((alumno) =>
      Number.isFinite(alumno.promedio)
    );

    const promedioGeneral = conDatos.length
      ? conDatos.reduce((acc, alumno) => acc + alumno.promedio, 0) /
        conDatos.length
      : null;

    const riesgoAlto = conDatos.filter((alumno) => alumno.promedio < 6).length;

    const observacion = conDatos.filter(
      (alumno) => alumno.promedio >= 6 && alumno.promedio < 8
    ).length;

    const estables = conDatos.filter((alumno) => alumno.promedio >= 8).length;

    const sinDatos = alumnosFiltrados.filter(
      (alumno) => !Number.isFinite(alumno.promedio)
    ).length;

    return {
      total: alumnosFiltrados.length,
      registrados: alumnos.length,
      conDatos: conDatos.length,
      promedioGeneral,
      riesgoAlto,
      observacion,
      estables,
      sinDatos,
    };
  }, [alumnosFiltrados, alumnos.length]);

  const clearFilters = () => {
    setQuery("");
    setOrden("RIESGO");
    setGrupoFilter("ALL");
    setMateriaFilter("ALL");
    setStatusFilter("ALL");
    setSoloPrioridad(false);
  };

  const copyResumen = async () => {
    const lines = [
      "Seguimiento de alumnos - Punto y Coma",
      "",
      `Usuario: ${getUserName(user)}`,
      `Alumnos filtrados: ${resumen.total}`,
      `Alumnos registrados: ${resumen.registrados}`,
      `Alumnos con calificaciones: ${resumen.conDatos}`,
      `Promedio general: ${fmt(resumen.promedioGeneral)}`,
      `Riesgo alto: ${resumen.riesgoAlto}`,
      `En observación: ${resumen.observacion}`,
      `Estables: ${resumen.estables}`,
      `Sin calificaciones: ${resumen.sinDatos}`,
      "",
      "Alumnos con prioridad:",
      ...alumnosFiltrados
        .filter((alumno) =>
          ["riesgo_alto", "observacion", "sin_datos"].includes(
            alumno.status.value
          )
        )
        .slice(0, 12)
        .map(
          (alumno) =>
            `- ${alumno.nombreVisible}: ${fmt(alumno.promedio)} (${
              alumno.status.label
            }) | ${alumno.recomendacion}`
        ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));

      showToast({
        type: "success",
        title: "Resumen copiado",
        message: "El seguimiento fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa permisos del navegador.",
      });
    }
  };

  const exportExcel = () => {
    if (!alumnosFiltrados.length) {
      showToast({
        type: "info",
        title: "Sin datos",
        message: "No hay alumnos para exportar.",
      });
      return;
    }

    const workbook = XLSX.utils.book_new();

    const titleStyle = {
      font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "7A0033" } },
      alignment: { horizontal: "center", vertical: "center" },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "7A0033" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "7A0033" } },
        bottom: { style: "thin", color: { rgb: "7A0033" } },
        left: { style: "thin", color: { rgb: "7A0033" } },
        right: { style: "thin", color: { rgb: "7A0033" } },
      },
    };

    const valueStyle = {
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left: { style: "thin", color: { rgb: "D1D5DB" } },
        right: { style: "thin", color: { rgb: "D1D5DB" } },
      },
    };

    const labelStyle = {
      ...valueStyle,
      font: { bold: true, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: "F8FAFC" } },
    };

    const goodStyle = {
      ...valueStyle,
      font: { bold: true, color: { rgb: "166534" } },
      fill: { fgColor: { rgb: "DCFCE7" } },
      alignment: { horizontal: "center", vertical: "center" },
      numFmt: "0.00",
    };

    const warnStyle = {
      ...valueStyle,
      font: { bold: true, color: { rgb: "92400E" } },
      fill: { fgColor: { rgb: "FEF3C7" } },
      alignment: { horizontal: "center", vertical: "center" },
      numFmt: "0.00",
    };

    const badStyle = {
      ...valueStyle,
      font: { bold: true, color: { rgb: "991B1B" } },
      fill: { fgColor: { rgb: "FEE2E2" } },
      alignment: { horizontal: "center", vertical: "center" },
      numFmt: "0.00",
    };

    const getGradeStyle = (value) => {
      const n = Number(value);

      if (!Number.isFinite(n)) return valueStyle;
      if (n < 6) return badStyle;
      if (n < 8) return warnStyle;

      return goodStyle;
    };

    const resumenRows = [
      ["Seguimiento de alumnos - Punto y Coma", "", "", ""],
      ["", "", "", ""],
      ["Usuario", getUserName(user), "Fecha", formatDate(new Date().toISOString())],
      ["Grupo", grupoFilter === "ALL" ? "Todos" : grupoFilter, "Materia", materiaFilter === "ALL" ? "Todas" : materias.find((materia) => String(materia.id) === String(materiaFilter))?.nombre || materiaFilter],
      ["Alumnos filtrados", resumen.total, "Registrados", resumen.registrados],
      ["Con datos", resumen.conDatos, "Sin calificaciones", resumen.sinDatos],
      ["Promedio general", Number.isFinite(resumen.promedioGeneral) ? Number(resumen.promedioGeneral.toFixed(2)) : "", "Riesgo alto", resumen.riesgoAlto],
      ["Observación", resumen.observacion, "Estables", resumen.estables],
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenRows);
    resumenSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    resumenSheet["!cols"] = [{ wch: 24 }, { wch: 42 }, { wch: 24 }, { wch: 42 }];
    resumenSheet["!rows"] = [{ hpt: 28 }];

    applyCellStyle(resumenSheet, "A1:D1", titleStyle);
    applyCellStyle(resumenSheet, "A3:A8", labelStyle);
    applyCellStyle(resumenSheet, "C3:C8", labelStyle);
    applyCellStyle(resumenSheet, "B3:B8", valueStyle);
    applyCellStyle(resumenSheet, "D3:D8", valueStyle);

    const alumnosRows = [
      [
        "Alumno",
        "Correo",
        "Grupo",
        "Boleta",
        "Promedio",
        "Estado",
        "Registros",
        "Materias evaluadas",
        "Materias bajas",
        "Última actualización",
        "Recomendación",
      ],
      ...alumnosFiltrados.map((alumno) => [
        alumno.nombreVisible,
        alumno.email || "",
        alumno.grupo || "",
        alumno.boleta || "",
        Number.isFinite(alumno.promedio) ? Number(alumno.promedio.toFixed(2)) : "",
        alumno.status.label,
        alumno.registros,
        alumno.materiasEvaluadas,
        alumno.materiasBajas
          .map(
            (item) =>
              `${item.materia} (${item.periodo}): ${fmtShort(item.calificacion)}`
          )
          .join(" | "),
        formatDate(alumno.ultimoRegistro?.updatedAt || alumno.ultimoRegistro?.createdAt),
        alumno.recomendacion,
      ]),
    ];

    const alumnosSheet = XLSX.utils.aoa_to_sheet(alumnosRows);
    alumnosSheet["!cols"] = [
      { wch: 28 },
      { wch: 35 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 70 },
      { wch: 26 },
      { wch: 85 },
    ];
    alumnosSheet["!autofilter"] = {
      ref: `A1:K${Math.max(alumnosRows.length, 1)}`,
    };

    styleHeaderRow(alumnosSheet, 0, 0, 10, headerStyle);

    for (let row = 1; row < alumnosRows.length; row += 1) {
      for (let col = 0; col <= 10; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (alumnosSheet[address]) {
          alumnosSheet[address].s =
            col === 4 ? getGradeStyle(alumnosRows[row][4]) : valueStyle;
        }
      }
    }

    const registrosRows = [
      [
        "Alumno",
        "Correo",
        "Grupo",
        "Boleta",
        "Materia",
        "Periodo",
        "Calificación",
        "Actualizado",
      ],
      ...calificaciones
        .filter((item) =>
          alumnosFiltrados.some(
            (alumno) =>
              String(alumno.email || "").toLowerCase() ===
              String(item.alumnoEmail || "").toLowerCase()
          )
        )
        .filter((item) =>
          materiaFilter === "ALL"
            ? true
            : String(item.materiaId) === String(materiaFilter)
        )
        .map((item) => [
          item.alumnoNombre || "",
          item.alumnoEmail || "",
          item.alumnoGrupo || "",
          item.alumnoBoleta || "",
          item.materiaNombre || item.materiaId || "",
          item.periodo || "Final",
          Number(item.calificacion),
          formatDate(item.updatedAt || item.createdAt),
        ]),
    ];

    const registrosSheet = XLSX.utils.aoa_to_sheet(registrosRows);
    registrosSheet["!cols"] = [
      { wch: 28 },
      { wch: 35 },
      { wch: 16 },
      { wch: 16 },
      { wch: 34 },
      { wch: 22 },
      { wch: 14 },
      { wch: 26 },
    ];
    registrosSheet["!autofilter"] = {
      ref: `A1:H${Math.max(registrosRows.length, 1)}`,
    };

    styleHeaderRow(registrosSheet, 0, 0, 7, headerStyle);

    for (let row = 1; row < registrosRows.length; row += 1) {
      for (let col = 0; col <= 7; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (registrosSheet[address]) {
          registrosSheet[address].s =
            col === 6 ? getGradeStyle(registrosRows[row][6]) : valueStyle;
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
    XLSX.utils.book_append_sheet(workbook, alumnosSheet, "Alumnos");
    XLSX.utils.book_append_sheet(workbook, registrosSheet, "Registros");

    XLSX.writeFile(workbook, "seguimiento-alumnos-punto-y-coma.xlsx");

    showToast({
      type: "success",
      title: "Excel exportado",
      message: "Se descargó el seguimiento de alumnos.",
    });
  };

  const printClean = () => {
    const alumnosRows = alumnosFiltrados
      .map(
        (alumno) => `
          <tr>
            <td>${escapeHTML(alumno.nombreVisible)}</td>
            <td>${escapeHTML(alumno.email || "")}</td>
            <td>${escapeHTML(alumno.grupo || "")}</td>
            <td>${escapeHTML(alumno.boleta || "")}</td>
            <td>${escapeHTML(fmt(alumno.promedio))}</td>
            <td>${escapeHTML(alumno.status.label)}</td>
            <td>${escapeHTML(alumno.registros)}</td>
            <td>${escapeHTML(alumno.materiasEvaluadas)}</td>
            <td>${escapeHTML(alumno.recomendacion)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Seguimiento de alumnos - Punto y Coma</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
            margin: 32px;
            line-height: 1.45;
          }

          h1, h2 {
            color: #7a0033;
          }

          .top {
            border-bottom: 3px solid #7a0033;
            padding-bottom: 14px;
            margin-bottom: 22px;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 18px 0;
          }

          .box {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 12px;
            background: #fafafa;
          }

          .box strong {
            display: block;
            color: #7a0033;
            font-size: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0 26px;
          }

          th {
            background: #7a0033;
            color: white;
            text-align: left;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 8px;
            vertical-align: top;
            font-size: 12px;
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

        <div class="top">
          <h1>Seguimiento de alumnos - Punto y Coma</h1>
          <p><strong>Generado por:</strong> ${escapeHTML(getUserName(user))}</p>
          <p><strong>Grupo:</strong> ${escapeHTML(grupoFilter === "ALL" ? "Todos" : grupoFilter)}</p>
          <p><strong>Materia:</strong> ${escapeHTML(
            materiaFilter === "ALL"
              ? "Todas"
              : materias.find((materia) => String(materia.id) === String(materiaFilter))?.nombre ||
                  materiaFilter
          )}</p>
        </div>

        <div class="summary">
          <div class="box">Alumnos filtrados<strong>${resumen.total}</strong></div>
          <div class="box">Con datos<strong>${resumen.conDatos}</strong></div>
          <div class="box">Promedio<strong>${escapeHTML(fmt(resumen.promedioGeneral))}</strong></div>
          <div class="box">Riesgo alto<strong>${resumen.riesgoAlto}</strong></div>
        </div>

        <h2>Listado de seguimiento</h2>

        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Correo</th>
              <th>Grupo</th>
              <th>Boleta</th>
              <th>Promedio</th>
              <th>Estado</th>
              <th>Registros</th>
              <th>Materias</th>
              <th>Recomendación</th>
            </tr>
          </thead>

          <tbody>
            ${alumnosRows || "<tr><td colspan='9'>Sin alumnos para mostrar.</td></tr>"}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "noopener,noreferrer");

    if (!win) {
      downloadHTML("seguimiento-alumnos-punto-y-coma.html", html);
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Seguimiento de alumnos</h1>

            <p className="msg">
              {getUserName(user)} · Consulta alumnos, grupos, materias,
              promedios, riesgos y recomendaciones de seguimiento.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadAlumnos}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen del seguimiento</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Filtrados</div>
              <div className="kpiValue">{resumen.total}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Con datos</div>
              <div className="kpiValue">{resumen.conDatos}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Promedio</div>
              <div className="kpiValue">
                {loading ? "..." : fmt(resumen.promedioGeneral)}
              </div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Riesgo alto</div>
              <div className="kpiValue">{resumen.riesgoAlto}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Observación</div>
              <div className="kpiValue">{resumen.observacion}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Sin datos</div>
              <div className="kpiValue">{resumen.sinDatos}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Filtros</h2>

          <div className="gridX">
            <label>
              Buscar alumno
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, correo, grupo, boleta o materia baja"
                disabled={loading}
              />
            </label>

            <label>
              Grupo
              <select
                value={grupoFilter}
                onChange={(event) => setGrupoFilter(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todos los grupos</option>

                {groupOptions.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Materia
              <select
                value={materiaFilter}
                onChange={(event) => setMateriaFilter(event.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todas las materias</option>

                {materiaOptions.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado académico
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={loading}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ordenar por
              <select
                value={orden}
                onChange={(event) => setOrden(event.target.value)}
                disabled={loading}
              >
                {ORDEN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className={soloPrioridad ? "" : "btn-ghost"}
              onClick={() => setSoloPrioridad((prev) => !prev)}
              disabled={loading}
            >
              {soloPrioridad ? "Mostrando prioridad" : "Solo prioridad"}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={clearFilters}
              disabled={loading}
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={copyResumen}
              disabled={loading || !alumnosFiltrados.length}
            >
              Copiar seguimiento
            </button>

            <button
              type="button"
              onClick={exportExcel}
              disabled={loading || !alumnosFiltrados.length}
            >
              Exportar Excel
            </button>

            <button
              type="button"
              onClick={printClean}
              disabled={loading || !alumnosFiltrados.length}
            >
              Imprimir limpio
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Distribución académica</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Riesgo alto</strong>
                <p className="muted">Alumnos con promedio menor a 6.</p>
              </div>

              <span className="badge bad">{resumen.riesgoAlto}</span>
            </div>

            <div className="item">
              <div>
                <strong>En observación</strong>
                <p className="muted">Alumnos con promedio entre 6 y 7.99.</p>
              </div>

              <span className="badge warn">{resumen.observacion}</span>
            </div>

            <div className="item">
              <div>
                <strong>Estables</strong>
                <p className="muted">Alumnos con promedio igual o mayor a 8.</p>
              </div>

              <span className="badge ok">{resumen.estables}</span>
            </div>

            <div className="item">
              <div>
                <strong>Sin datos</strong>
                <p className="muted">Alumnos sin calificaciones registradas.</p>
              </div>

              <span className="badge">{resumen.sinDatos}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Alumnos registrados</h2>

          <div className="lista">
            {alumnosFiltrados.map((alumno) => (
              <div className="item" key={alumno.email}>
                <div className="textClamp">
                  <strong>{alumno.nombreVisible}</strong>

                  <p className="muted">
                    {alumno.email} · Grupo {alumno.grupo || "—"} · Boleta{" "}
                    {alumno.boleta || "—"}
                  </p>

                  <p className="muted">
                    {alumno.registros} registro(s) ·{" "}
                    {alumno.materiasEvaluadas} materia(s) evaluada(s) ·{" "}
                    Última actualización:{" "}
                    {formatDate(
                      alumno.ultimoRegistro?.updatedAt ||
                        alumno.ultimoRegistro?.createdAt
                    )}
                  </p>

                  {!!alumno.materiasBajas.length && (
                    <p className="muted">
                      Materias a reforzar:{" "}
                      {alumno.materiasBajas
                        .map(
                          (item) =>
                            `${item.materia} (${item.periodo}: ${fmtShort(
                              item.calificacion
                            )})`
                        )
                        .join(" · ")}
                    </p>
                  )}

                  <p className="muted">{alumno.recomendacion}</p>
                </div>

                <div className="right">
                  <span className={`badge ${alumno.status.className}`}>
                    {alumno.status.label}
                  </span>

                  <span className={`badge ${gradeClass(alumno.promedio)}`}>
                    {fmt(alumno.promedio)}
                  </span>

                  <Link
                    to={`/alumnos/${encodeURIComponent(alumno.email)}`}
                    className="badge ok"
                  >
                    Ver expediente
                  </Link>
                </div>
              </div>
            ))}

            {!alumnosFiltrados.length && (
              <p className="msg">
                {loading
                  ? "Cargando alumnos..."
                  : "No hay alumnos que coincidan con los filtros."}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Materias disponibles</h2>

          <div className="lista">
            {materias.map((materia) => (
              <div className="item" key={materia.id}>
                <div>
                  <strong>{materia.nombre}</strong>
                  <p className="muted">Materia registrada en la plataforma.</p>
                </div>

                <span className="badge">{materia.id}</span>
              </div>
            ))}

            {!materias.length && (
              <p className="msg">
                {loading
                  ? "Cargando materias..."
                  : "No hay materias registradas."}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
