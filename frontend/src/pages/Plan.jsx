// Archivo: frontend/src/pages/Plan.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";

import NavBar from "../components/layout/NavBar.jsx";

import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import {
  buildWeeklyPlan,
  computeInsights,
  planToText,
} from "../features/study/studyCoach.js";

import "../styles/dashboard.css";
import "../styles/coach.css";

const PERIODOS = [
  "Primer parcial",
  "Segundo parcial",
  "Tercer parcial",
  "Final",
  "Extraordinario",
];

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePeriodo(value) {
  const clean = normalizeText(value || "Final");

  const found = PERIODOS.find(
    (periodo) => periodo.toLowerCase() === clean.toLowerCase()
  );

  return found || clean || "Final";
}

function periodoRank(value) {
  const periodo = normalizePeriodo(value);
  const index = PERIODOS.indexOf(periodo);

  return index >= 0 ? index : 999;
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildAdvice(avg) {
  const n = Number(avg);

  if (!Number.isFinite(n)) {
    return "Aún no hay datos suficientes para generar una recomendación.";
  }

  if (n < 6) {
    return "Prioridad alta: repasa bases, entrega pendientes y pide apoyo al profesor antes del siguiente parcial.";
  }

  if (n < 7) {
    return "Zona de riesgo: dedica sesiones cortas pero constantes para subir esta materia arriba de 7.";
  }

  if (n < 8.5) {
    return "Buen avance: mantén práctica semanal y corrige errores frecuentes para subir tu promedio.";
  }

  return "Excelente desempeño: conserva el ritmo y refuerza con ejercicios más retadores.";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Alumno";
}

function validateMeta(value) {
  const clean = String(value || "").trim();

  if (!clean) {
    return "Ingresa una meta de promedio.";
  }

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    return "La meta debe ser numérica y máximo con 2 decimales.";
  }

  const n = Number(clean);

  if (!Number.isFinite(n) || n < 0 || n > 10) {
    return "La meta debe ser un número entre 0 y 10.";
  }

  return "";
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
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function Plan() {
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

  const metaKey = useMemo(() => {
    const id = user?.id || user?._id || user?.email || "anon";
    return `meta_promedio:${id}`;
  }, [user]);

  const [calificaciones, setCalificaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [metaInput, setMetaInput] = useState("8.5");
  const [metaPromedio, setMetaPromedio] = useState(null);
  const [loading, setLoading] = useState(true);

  const [historialPeriodoFilter, setHistorialPeriodoFilter] =
    useState("TODOS");

  const loadStudentData = useCallback(async () => {
    if (!token) {
      setCalificaciones([]);
      setMaterias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [calificacionesData, materiasData] = await Promise.all([
        apiJSON("/calificaciones", { token }),
        apiJSON("/materias", { token }),
      ]);

      setCalificaciones(toArray(calificacionesData));
      setMaterias(toArray(materiasData));
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cargar el plan",
        message: error.message || "Revisa que el backend esté activo.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(metaKey);

      if (raw != null && raw !== "") {
        const n = Number(raw);

        if (Number.isFinite(n) && n >= 0 && n <= 10) {
          setMetaPromedio(n);
          setMetaInput(String(n));
          return;
        }
      }

      setMetaPromedio(null);
      setMetaInput("8.5");
    } catch {
      setMetaPromedio(null);
      setMetaInput("8.5");
    }
  }, [metaKey]);

  const calificacionesOrdenadas = useMemo(() => {
    return [...calificaciones]
      .map((item) => {
        const materiaId = String(item.materiaId || "");
        const materiaNombre =
          item.materiaNombre ||
          materias.find((m) => String(m.id) === materiaId)?.nombre ||
          "Materia";

        return {
          ...item,
          materiaNombre,
          periodo: normalizePeriodo(item.periodo),
        };
      })
      .sort((a, b) => {
        const periodoCompare = periodoRank(a.periodo) - periodoRank(b.periodo);
        if (periodoCompare !== 0) return periodoCompare;

        const materiaCompare = String(a.materiaNombre || "").localeCompare(
          String(b.materiaNombre || ""),
          "es",
          { sensitivity: "base" }
        );

        if (materiaCompare !== 0) return materiaCompare;

        return String(a.createdAt || "").localeCompare(
          String(b.createdAt || "")
        );
      });
  }, [calificaciones, materias]);

  const historialFiltrado = useMemo(() => {
    if (historialPeriodoFilter === "TODOS") {
      return calificacionesOrdenadas;
    }

    return calificacionesOrdenadas.filter(
      (item) => normalizePeriodo(item.periodo) === historialPeriodoFilter
    );
  }, [calificacionesOrdenadas, historialPeriodoFilter]);

  const insights = useMemo(() => {
    return computeInsights(calificaciones);
  }, [calificaciones]);

  const plan = useMemo(() => {
    return buildWeeklyPlan(calificaciones, 6);
  }, [calificaciones]);

  const promedioGeneral = Number.isFinite(insights.overall)
    ? insights.overall
    : null;

  const metaObjetivo =
    Number.isFinite(metaPromedio) && metaPromedio > 0 ? metaPromedio : 10;

  const progreso = Number.isFinite(promedioGeneral)
    ? clamp((promedioGeneral / metaObjetivo) * 100, 0, 100)
    : 0;

  const riskLevel = useMemo(() => {
    const riskCount = insights.risk.length;
    const promedio = Number(promedioGeneral);

    if (!Number.isFinite(promedio)) {
      return {
        cls: "med",
        label: "Sin datos",
        message:
          "Aún no hay calificaciones suficientes para calcular tu riesgo académico.",
      };
    }

    if (promedio < 6 || riskCount >= 2) {
      return {
        cls: "high",
        label: "Riesgo alto",
        message: "Necesitas atender tus materias más bajas esta semana.",
      };
    }

    if (promedio < 8 || riskCount === 1) {
      return {
        cls: "med",
        label: "Riesgo medio",
        message:
          "Vas avanzando, pero todavía hay materias que conviene reforzar.",
      };
    }

    return {
      cls: "low",
      label: "Riesgo bajo",
      message: "Buen rendimiento. Mantén constancia para no bajar el promedio.",
    };
  }, [promedioGeneral, insights.risk.length]);

  const materiaStats = useMemo(() => {
    const map = new Map();

    for (const c of calificacionesOrdenadas) {
      const materiaId = String(c.materiaId || "");
      const calificacion = Number(c.calificacion);

      if (!materiaId || !Number.isFinite(calificacion)) continue;

      const materiaNombre = c.materiaNombre || "Materia";

      if (!map.has(materiaId)) {
        map.set(materiaId, {
          materiaId,
          materia: materiaNombre,
          valores: [],
          periodos: [],
        });
      }

      const current = map.get(materiaId);

      current.valores.push(calificacion);
      current.periodos.push({
        periodo: normalizePeriodo(c.periodo),
        calificacion,
      });
    }

    return [...map.values()]
      .map((m) => {
        const avg = m.valores.reduce((a, b) => a + b, 0) / m.valores.length;

        const periodosOrdenados = [...m.periodos].sort(
          (a, b) => periodoRank(a.periodo) - periodoRank(b.periodo)
        );

        return {
          ...m,
          avg: Number(avg.toFixed(2)),
          count: m.valores.length,
          periodos: periodosOrdenados,
          advice: buildAdvice(avg),
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [calificacionesOrdenadas]);

  const periodoStats = useMemo(() => {
    return PERIODOS.map((periodo) => {
      const registros = calificacionesOrdenadas.filter(
        (item) => normalizePeriodo(item.periodo) === periodo
      );

      const nums = registros
        .map((item) => Number(item.calificacion))
        .filter(Number.isFinite);

      const avg = nums.length
        ? nums.reduce((total, value) => total + value, 0) / nums.length
        : null;

      return {
        periodo,
        count: registros.length,
        avg: Number.isFinite(avg) ? Number(avg.toFixed(2)) : null,
      };
    }).filter((item) => item.count > 0);
  }, [calificacionesOrdenadas]);

  const materiasRiesgo = useMemo(() => {
    return materiaStats.filter((m) => m.avg < 7);
  }, [materiaStats]);

  const mejoresMaterias = useMemo(() => {
    return [...materiaStats].sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [materiaStats]);

  const prioridadSemana = useMemo(() => {
    if (!materiaStats.length) {
      return "Aún no hay calificaciones suficientes para definir una prioridad.";
    }

    const peor = materiaStats[0];

    if (peor.avg < 6) {
      return `Prioridad inmediata: ${peor.materia}. Está por debajo de 6 y necesita atención antes de la siguiente evaluación.`;
    }

    if (peor.avg < 7) {
      return `Prioridad de refuerzo: ${peor.materia}. Está cerca del límite, conviene subirla primero.`;
    }

    return `Prioridad de mejora: ${peor.materia}. Es tu materia más baja, aunque vas en rango aprobatorio.`;
  }, [materiaStats]);

  const metaStatus = useMemo(() => {
    if (!Number.isFinite(metaPromedio) || !Number.isFinite(promedioGeneral)) {
      return null;
    }

    const diff = Number((metaPromedio - promedioGeneral).toFixed(2));

    if (diff <= 0) {
      return {
        kind: "ok",
        text: `Meta alcanzada. Tu promedio actual supera o iguala ${metaPromedio.toFixed(
          2
        )}.`,
      };
    }

    return {
      kind: "pending",
      text: `Te faltan ${diff.toFixed(2)} puntos para llegar a tu meta de ${metaPromedio.toFixed(
        2
      )}.`,
    };
  }, [metaPromedio, promedioGeneral]);

  const saveMeta = () => {
    const error = validateMeta(metaInput);

    if (error) {
      showToast({
        type: "warning",
        title: "Meta inválida",
        message: error,
      });
      return;
    }

    const n = Number(metaInput);

    setMetaPromedio(n);

    try {
      localStorage.setItem(metaKey, String(n));
    } catch {
      // no-op
    }

    showToast({
      type: "success",
      title: "Meta guardada",
      message: `Tu nueva meta es ${n.toFixed(2)}.`,
    });
  };

  const clearMeta = () => {
    setMetaPromedio(null);
    setMetaInput("8.5");

    try {
      localStorage.removeItem(metaKey);
    } catch {
      // no-op
    }

    showToast({
      type: "info",
      title: "Meta eliminada",
      message: "Puedes guardar una nueva meta cuando quieras.",
    });
  };

  const copyPlan = async () => {
    const text =
      `Plan de estudio - Punto y Coma\n\n` +
      `Alumno: ${getUserName(user)}\n` +
      `Promedio general: ${fmt(promedioGeneral)}\n` +
      `Meta objetivo: ${fmt(metaObjetivo)}\n` +
      `Semáforo: ${riskLevel.label}\n` +
      `Materias en riesgo: ${materiasRiesgo.length}\n\n` +
      `Historial de calificaciones:\n` +
      `${
        calificacionesOrdenadas.length
          ? calificacionesOrdenadas
              .map(
                (item) =>
                  `- ${item.periodo} | ${item.materiaNombre}: ${fmtShort(
                    item.calificacion
                  )}`
              )
              .join("\n")
          : "Sin calificaciones registradas."
      }\n\n` +
      `Prioridad de la semana:\n${prioridadSemana}\n\n` +
      `Plan semanal:\n${planToText(plan)}\n`;

    try {
      await navigator.clipboard.writeText(text);

      showToast({
        type: "success",
        title: "Plan copiado",
        message: "El plan fue copiado al portapapeles.",
      });
    } catch {
      showToast({
        type: "error",
        title: "No se pudo copiar",
        message: "Revisa los permisos del navegador.",
      });
    }
  };

  const printCleanPlan = () => {
    const planRows = plan
      .map(
        (p) => `
          <tr>
            <td>${escapeHTML(p.day)}</td>
            <td>${escapeHTML(p.time)}</td>
            <td>${escapeHTML(p.materia)}</td>
            <td>${escapeHTML(p.sessionType || "Sesión")}</td>
            <td>${escapeHTML(p.goal)}</td>
            <td>
              <ol>
                ${(p.actions || [])
                  .map((action) => `<li>${escapeHTML(action)}</li>`)
                  .join("")}
              </ol>
            </td>
            <td>${escapeHTML(p.evidence || "")}</td>
          </tr>
        `
      )
      .join("");

    const historialRows = calificacionesOrdenadas
      .map(
        (item) => `
          <tr>
            <td>${escapeHTML(item.periodo)}</td>
            <td>${escapeHTML(item.materiaNombre)}</td>
            <td>${escapeHTML(item.alumnoGrupo || "")}</td>
            <td>${escapeHTML(item.alumnoBoleta || "")}</td>
            <td>${escapeHTML(fmtShort(item.calificacion))}</td>
            <td>${escapeHTML(formatDate(item.updatedAt || item.createdAt))}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Plan de estudio - Punto y Coma</title>
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
            page-break-inside: auto;
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

          tr {
            page-break-inside: avoid;
          }

          ol {
            margin: 0;
            padding-left: 18px;
          }

          .note {
            color: #4b5563;
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
          <h1>Plan de estudio - Punto y Coma Académico</h1>
          <p><strong>Alumno:</strong> ${escapeHTML(getUserName(user))}</p>
          <p class="note">Documento generado automáticamente según calificaciones registradas.</p>
        </div>

        <div class="summary">
          <div class="box">
            Promedio general
            <strong>${escapeHTML(fmt(promedioGeneral))}</strong>
          </div>

          <div class="box">
            Meta objetivo
            <strong>${escapeHTML(fmt(metaObjetivo))}</strong>
          </div>

          <div class="box">
            Semáforo
            <strong>${escapeHTML(riskLevel.label)}</strong>
          </div>

          <div class="box">
            Materias en riesgo
            <strong>${materiasRiesgo.length}</strong>
          </div>
        </div>

        <h2>Prioridad de la semana</h2>
        <p>${escapeHTML(prioridadSemana)}</p>

        <h2>Plan semanal detallado</h2>
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Horario</th>
              <th>Materia</th>
              <th>Tipo</th>
              <th>Objetivo</th>
              <th>Actividades</th>
              <th>Evidencia</th>
            </tr>
          </thead>
          <tbody>
            ${planRows || "<tr><td colspan='7'>Sin plan disponible.</td></tr>"}
          </tbody>
        </table>

        <h2>Historial de calificaciones</h2>
        <table>
          <thead>
            <tr>
              <th>Periodo</th>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Boleta</th>
              <th>Calificación</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            ${historialRows || "<tr><td colspan='6'>Sin calificaciones registradas.</td></tr>"}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "noopener,noreferrer");

    if (!win) {
      downloadHTML("plan-estudio-punto-y-coma.html", html);
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const titleStyle = {
      font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "7A0033" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "7A0033" } },
        bottom: { style: "thin", color: { rgb: "7A0033" } },
        left: { style: "thin", color: { rgb: "7A0033" } },
        right: { style: "thin", color: { rgb: "7A0033" } },
      },
    };

    const sectionStyle = {
      font: { bold: true, sz: 13, color: { rgb: "7A0033" } },
      fill: { fgColor: { rgb: "FCE7F3" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E9B8C9" } },
        bottom: { style: "thin", color: { rgb: "E9B8C9" } },
        left: { style: "thin", color: { rgb: "E9B8C9" } },
        right: { style: "thin", color: { rgb: "E9B8C9" } },
      },
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

    const labelStyle = {
      font: { bold: true, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: "F8FAFC" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left: { style: "thin", color: { rgb: "D1D5DB" } },
        right: { style: "thin", color: { rgb: "D1D5DB" } },
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

    const numberStyle = {
      ...valueStyle,
      alignment: { horizontal: "center", vertical: "center" },
      numFmt: "0.00",
    };

    const goodStyle = {
      ...numberStyle,
      font: { bold: true, color: { rgb: "166534" } },
      fill: { fgColor: { rgb: "DCFCE7" } },
    };

    const warnStyle = {
      ...numberStyle,
      font: { bold: true, color: { rgb: "92400E" } },
      fill: { fgColor: { rgb: "FEF3C7" } },
    };

    const badStyle = {
      ...numberStyle,
      font: { bold: true, color: { rgb: "991B1B" } },
      fill: { fgColor: { rgb: "FEE2E2" } },
    };

    const mutedStyle = {
      font: { color: { rgb: "64748B" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    };

    const getGradeStyle = (value) => {
      const n = Number(value);

      if (!Number.isFinite(n)) return valueStyle;
      if (n < 6) return badStyle;
      if (n < 8) return warnStyle;

      return goodStyle;
    };

    const applyStyle = (sheet, rangeAddress, style) => {
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
    };

    const styleHeaderRow = (sheet, rowIndex, fromCol, toCol) => {
      for (let col = fromCol; col <= toCol; col += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: col });

        if (sheet[address]) {
          sheet[address].s = headerStyle;
        }
      }
    };

    const freezeTop = (sheet) => {
      sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    };

    const resumenRows = [
      ["Punto y Coma Académico - Plan de estudio", "", "", ""],
      ["", "", "", ""],
      ["Alumno", getUserName(user), "Fecha de exportación", formatDate(new Date().toISOString())],
      ["Promedio general", Number.isFinite(promedioGeneral) ? Number(promedioGeneral.toFixed(2)) : "", "Meta objetivo", Number.isFinite(metaObjetivo) ? Number(metaObjetivo.toFixed(2)) : ""],
      ["Semáforo", riskLevel.label, "Progreso", `${Math.round(progreso)}%`],
      ["Materias evaluadas", materiaStats.length, "Materias en riesgo", materiasRiesgo.length],
      ["", "", "", ""],
      ["Prioridad de la semana", prioridadSemana, "", ""],
      ["", "", "", ""],
      ["Interpretación", riskLevel.message, "", ""],
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenRows);
    resumenSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 7, c: 1 }, e: { r: 7, c: 3 } },
      { s: { r: 9, c: 1 }, e: { r: 9, c: 3 } },
    ];
    resumenSheet["!cols"] = [{ wch: 26 }, { wch: 50 }, { wch: 24 }, { wch: 32 }];
    resumenSheet["!rows"] = [{ hpt: 28 }];

    applyStyle(resumenSheet, "A1:D1", titleStyle);
    applyStyle(resumenSheet, "A3:A6", labelStyle);
    applyStyle(resumenSheet, "C3:C6", labelStyle);
    applyStyle(resumenSheet, "B3:B6", valueStyle);
    applyStyle(resumenSheet, "D3:D6", valueStyle);
    applyStyle(resumenSheet, "A8:A8", sectionStyle);
    applyStyle(resumenSheet, "B8:D8", valueStyle);
    applyStyle(resumenSheet, "A10:A10", sectionStyle);
    applyStyle(resumenSheet, "B10:D10", valueStyle);

    const historialRows = [
      ["Periodo", "Materia", "Grupo", "Boleta", "Calificación", "Actualizado"],
      ...calificacionesOrdenadas.map((item) => [
        item.periodo,
        item.materiaNombre,
        item.alumnoGrupo || "",
        item.alumnoBoleta || "",
        Number(item.calificacion),
        formatDate(item.updatedAt || item.createdAt),
      ]),
    ];

    const historialSheet = XLSX.utils.aoa_to_sheet(historialRows);
    historialSheet["!cols"] = [
      { wch: 22 },
      { wch: 34 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 28 },
    ];
    historialSheet["!autofilter"] = {
      ref: `A1:F${Math.max(historialRows.length, 1)}`,
    };
    freezeTop(historialSheet);
    styleHeaderRow(historialSheet, 0, 0, 5);

    for (let row = 1; row < historialRows.length; row += 1) {
      for (let col = 0; col <= 5; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (historialSheet[address]) {
          historialSheet[address].s =
            col === 4 ? getGradeStyle(historialRows[row][4]) : valueStyle;
        }
      }
    }

    const materiaRows = [
      ["Materia", "Promedio", "Registros", "Periodos", "Recomendación"],
      ...materiaStats.map((item) => [
        item.materia,
        item.avg,
        item.count,
        item.periodos
          .map((periodo) => `${periodo.periodo}: ${fmtShort(periodo.calificacion)}`)
          .join(" | "),
        item.advice,
      ]),
    ];

    const materiaSheet = XLSX.utils.aoa_to_sheet(materiaRows);
    materiaSheet["!cols"] = [
      { wch: 34 },
      { wch: 14 },
      { wch: 12 },
      { wch: 55 },
      { wch: 85 },
    ];
    materiaSheet["!autofilter"] = {
      ref: `A1:E${Math.max(materiaRows.length, 1)}`,
    };
    freezeTop(materiaSheet);
    styleHeaderRow(materiaSheet, 0, 0, 4);

    for (let row = 1; row < materiaRows.length; row += 1) {
      for (let col = 0; col <= 4; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (materiaSheet[address]) {
          materiaSheet[address].s =
            col === 1 ? getGradeStyle(materiaRows[row][1]) : valueStyle;
        }
      }
    }

    const periodoRows = [
      ["Periodo", "Registros", "Promedio"],
      ...periodoStats.map((item) => [item.periodo, item.count, item.avg]),
    ];

    const periodoSheet = XLSX.utils.aoa_to_sheet(periodoRows);
    periodoSheet["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];
    periodoSheet["!autofilter"] = {
      ref: `A1:C${Math.max(periodoRows.length, 1)}`,
    };
    freezeTop(periodoSheet);
    styleHeaderRow(periodoSheet, 0, 0, 2);

    for (let row = 1; row < periodoRows.length; row += 1) {
      for (let col = 0; col <= 2; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (periodoSheet[address]) {
          periodoSheet[address].s =
            col === 2 ? getGradeStyle(periodoRows[row][2]) : valueStyle;
        }
      }
    }

    const planRows = [
      [
        "Día",
        "Horario",
        "Materia",
        "Tipo de sesión",
        "Promedio",
        "Estado",
        "Objetivo",
        "Actividades detalladas",
        "Evidencia sugerida",
      ],
      ...plan.map((item) => [
        item.day,
        item.time,
        item.materia,
        item.sessionType || "Sesión",
        item.avg ?? "",
        item.status || "",
        item.goal,
        Array.isArray(item.actions)
          ? item.actions.map((action, index) => `${index + 1}. ${action}`).join("\n")
          : "",
        item.evidence || "",
      ]),
    ];

    const planSheet = XLSX.utils.aoa_to_sheet(planRows);
    planSheet["!cols"] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 34 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 },
      { wch: 70 },
      { wch: 95 },
      { wch: 70 },
    ];
    planSheet["!rows"] = planRows.map((_, index) => ({
      hpt: index === 0 ? 24 : 90,
    }));
    planSheet["!autofilter"] = {
      ref: `A1:I${Math.max(planRows.length, 1)}`,
    };
    freezeTop(planSheet);
    styleHeaderRow(planSheet, 0, 0, 8);

    for (let row = 1; row < planRows.length; row += 1) {
      for (let col = 0; col <= 8; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });

        if (planSheet[address]) {
          planSheet[address].s =
            col === 4 ? getGradeStyle(planRows[row][4]) : valueStyle;
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
    XLSX.utils.book_append_sheet(workbook, historialSheet, "Historial");
    XLSX.utils.book_append_sheet(workbook, materiaSheet, "Materias");
    XLSX.utils.book_append_sheet(workbook, periodoSheet, "Periodos");
    XLSX.utils.book_append_sheet(workbook, planSheet, "Plan semanal");

    XLSX.writeFile(workbook, "plan-estudio-punto-y-coma.xlsx");

    showToast({
      type: "success",
      title: "Excel exportado",
      message: "Se descargó el archivo .xlsx con formato mejorado.",
    });
  };

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Plan de estudio</h1>

            <p className="msg">
              {getUserName(user)} · Recomendaciones automáticas según tus
              calificaciones.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadStudentData}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar datos"}
          </button>
        </section>

        <section className="card">
          <h2>Resumen académico</h2>

          <div className="coachRow">
            <div className="kpi">
              <div className="kpiTitle">Promedio general</div>

              <div className="kpiValue">
                {loading ? "..." : fmt(promedioGeneral)}
              </div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias evaluadas</div>
              <div className="kpiValue">{materiaStats.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Registros</div>
              <div className="kpiValue">{calificacionesOrdenadas.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Materias en riesgo</div>
              <div className="kpiValue">{materiasRiesgo.length}</div>
            </div>

            <div className={`traffic ${riskLevel.cls}`}>
              <span className="dot"></span>
              {riskLevel.label}
            </div>
          </div>

          <div className="planSpacing">
            <div className="row-between planWrap">
              <div>
                <strong>Progreso general y meta personal</strong>
                <p className="msg">{riskLevel.message}</p>
              </div>

              <span className={`badge ${gradeClass(promedioGeneral)}`}>
                {fmt(promedioGeneral)} / {fmt(metaObjetivo)}
              </span>
            </div>

            <div className="progress planSpacingSmall">
              <div
                style={{ "--progress": `${progreso}%` }}
                className="progressFill"
              />
            </div>

            <div className="row planWrap planSpacingSmall">
              <label className="metaLabel">
                <span className="muted">Meta de promedio</span>

                <input
                  className="metaInput"
                  inputMode="decimal"
                  value={metaInput}
                  onChange={(event) => setMetaInput(event.target.value)}
                  placeholder="Ej. 8.5"
                  disabled={loading}
                />
              </label>

              <div className="row metaActions">
                <button type="button" onClick={saveMeta} disabled={loading}>
                  Guardar meta
                </button>

                <button
                  type="button"
                  className="btn-del"
                  onClick={clearMeta}
                  disabled={loading}
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="planSpacingSmall">
              {!metaStatus && (
                <p className="msg">
                  Todavía no tienes una meta guardada. Si no guardas una meta,
                  el progreso se calcula sobre 10.
                </p>
              )}

              {metaStatus?.kind === "ok" && (
                <span className="badge ok">{metaStatus.text}</span>
              )}

              {metaStatus?.kind === "pending" && (
                <span className="badge warn">{metaStatus.text}</span>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Historial de calificaciones por periodo</h2>

          <p className="msg">
            Orden cronológico: Primer parcial, Segundo parcial, Tercer parcial,
            Final y Extraordinario.
          </p>

          <div className="gridX planSpacingSmall">
            <label>
              Periodo
              <select
                value={historialPeriodoFilter}
                onChange={(event) =>
                  setHistorialPeriodoFilter(event.target.value)
                }
                disabled={loading}
              >
                <option value="TODOS">Todos los periodos</option>

                {PERIODOS.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {periodo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="lista planSpacingSmall">
            {historialFiltrado.map((item) => (
              <div
                className="item"
                key={`${item.id}-${item.materiaId}-${item.periodo}`}
              >
                <div className="textClamp">
                  <strong>{item.materiaNombre}</strong>

                  <div className="muted">
                    {item.periodo} · Grupo {item.alumnoGrupo || "sin grupo"} ·
                    Boleta {item.alumnoBoleta || "sin boleta"}
                  </div>

                  <div className="muted">
                    Actualizado: {formatDate(item.updatedAt || item.createdAt)}
                  </div>
                </div>

                <span className={`badge ${gradeClass(item.calificacion)}`}>
                  {fmtShort(item.calificacion)}
                </span>
              </div>
            ))}

            {!historialFiltrado.length && (
              <div className="msg">
                {loading
                  ? "Cargando historial..."
                  : "No hay calificaciones en ese periodo."}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Resumen por periodo</h2>

          <div className="lista">
            {periodoStats.map((periodo) => (
              <div className="item" key={periodo.periodo}>
                <div>
                  <strong>{periodo.periodo}</strong>

                  <div className="muted">
                    {periodo.count} registro(s) en este periodo.
                  </div>
                </div>

                <span className={`badge ${gradeClass(periodo.avg)}`}>
                  Promedio {fmt(periodo.avg)}
                </span>
              </div>
            ))}

            {!periodoStats.length && (
              <div className="msg">
                Aún no hay datos suficientes para resumir periodos.
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Análisis por materia</h2>

          <div className="lista">
            {materiaStats.map((materia) => (
              <div className="item" key={materia.materiaId}>
                <div className="textClamp">
                  <strong>{materia.materia}</strong>

                  <div className="muted">
                    {materia.count} registro(s) ·{" "}
                    {materia.periodos
                      .map(
                        (item) =>
                          `${item.periodo}: ${fmtShort(item.calificacion)}`
                      )
                      .join(" · ")}
                  </div>

                  <div className="muted">{materia.advice}</div>
                </div>

                <div className="right">
                  <span className={`badge ${gradeClass(materia.avg)}`}>
                    Promedio {fmt(materia.avg)}
                  </span>
                </div>
              </div>
            ))}

            {!materiaStats.length && (
              <div className="msg">
                {loading
                  ? "Cargando materias..."
                  : "Todavía no tienes calificaciones registradas."}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Prioridad de la semana</h2>

          <div className="item">
            <div>
              <strong>Enfoque recomendado</strong>
              <div className="muted">{prioridadSemana}</div>
            </div>

            <span
              className={`badge ${
                materiasRiesgo.length ? "warn" : gradeClass(promedioGeneral)
              }`}
            >
              {materiasRiesgo.length ? "Reforzar" : "Mantener"}
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Plan semanal automático</h2>

          <p className="msg">
            El plan se genera con tus materias más bajas y contiene acciones
            concretas para mejorar el siguiente parcial.
          </p>

          <div className="row planWrap planSpacingSmall">
            <button
              type="button"
              className="btn-ghost"
              onClick={copyPlan}
              disabled={loading || !plan.length}
            >
              Copiar plan
            </button>

            <button type="button" onClick={printCleanPlan}>
              Imprimir plan limpio
            </button>

            <button type="button" onClick={exportToExcel}>
              Exportar Excel
            </button>
          </div>

          <div className="plan">
            {plan.map((p, index) => (
              <div className="planItem" key={`${p.materia}-${index}`}>
                <div className="planLeft">
                  <div className="planMateria">{p.materia}</div>

                  <div className="planMeta">
                    {p.day} · {p.time} · {p.sessionType || "Sesión"}
                  </div>

                  <div className="muted">
                    <strong>Objetivo:</strong> {p.goal}
                  </div>

                  {Array.isArray(p.actions) && p.actions.length > 0 && (
                    <ol className="muted">
                      {p.actions.map((action, actionIndex) => (
                        <li key={`${p.materia}-${index}-${actionIndex}`}>
                          {action}
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="muted">
                    <strong>Evidencia sugerida:</strong>{" "}
                    {p.evidence || "Apuntes y ejercicios corregidos."}
                  </div>
                </div>

                <span className={`badge ${gradeClass(p.avg)}`}>1h</span>
              </div>
            ))}

            {!plan.length && (
              <div className="msg">
                {loading
                  ? "Generando plan..."
                  : "Aún no hay calificaciones suficientes para generar un plan."}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Fortalezas académicas</h2>

          <div className="lista">
            {mejoresMaterias.map((materia) => (
              <div className="item" key={materia.materiaId}>
                <div>
                  <strong>{materia.materia}</strong>

                  <div className="muted">
                    Esta materia está entre tus mejores resultados registrados.
                  </div>
                </div>

                <span className={`badge ${gradeClass(materia.avg)}`}>
                  {fmt(materia.avg)}
                </span>
              </div>
            ))}

            {!mejoresMaterias.length && (
              <div className="msg">
                Todavía no hay suficientes datos para detectar fortalezas.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
