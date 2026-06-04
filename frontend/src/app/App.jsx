import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Welcome from "../pages/Welcome.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Profile from "../pages/Profile.jsx";
import Ajustes from "../pages/Ajustes.jsx";
import Plan from "../pages/Plan.jsx";
import Capturar from "../pages/Capturar.jsx";
import Admin from "../pages/Admin.jsx";
import Reportes from "../pages/Reportes.jsx";
import Alumnos from "../pages/Alumnos.jsx";
import AlumnoDetalle from "../pages/AlumnoDetalle.jsx";
import Configuracion from "../pages/Configuracion.jsx";
import Actividad from "../pages/Actividad.jsx";
import Tareas from "../pages/Tareas.jsx";
import Notificaciones from "../pages/Notificaciones.jsx";
import Calendario from "../pages/Calendario.jsx";
import Recursos from "../pages/Recursos.jsx";
import Analiticas from "../pages/Analiticas.jsx";
import NotFound from "../pages/NotFound.jsx";

import ProtectedRoute from "../components/routing/ProtectedRoute.jsx";


function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;

  root.dataset.theme = normalized;
  document.body.datasetTheme = normalized;
  document.body.dataset.theme = normalized;

  root.classList.toggle("light", normalized === "light");
  root.classList.toggle("dark", normalized === "dark");

  document.body.classList.toggle("theme-light", normalized === "light");
  document.body.classList.toggle("theme-dark", normalized === "dark");
  document.body.classList.toggle("light", normalized === "light");
  document.body.classList.toggle("dark", normalized === "dark");

  if (normalized === "light") {
    root.style.setProperty("--bg", "#f3f6fb");
    root.style.setProperty("--bg2", "#e8eef8");
    root.style.setProperty("--card", "#ffffff");
    root.style.setProperty("--text", "#111827");
    root.style.setProperty("--muted", "#64748b");
    root.style.setProperty("--border", "rgba(15, 23, 42, 0.12)");
    root.style.setProperty("--surface", "#ffffff");
    root.style.setProperty("--surface-soft", "#f8fafc");
  } else {
    root.style.setProperty("--bg", "#020617");
    root.style.setProperty("--bg2", "#0f172a");
    root.style.setProperty("--card", "#0f172a");
    root.style.setProperty("--text", "#f8fafc");
    root.style.setProperty("--muted", "#94a3b8");
    root.style.setProperty("--border", "rgba(255, 255, 255, 0.12)");
    root.style.setProperty("--surface", "#0f172a");
    root.style.setProperty("--surface-soft", "#1e293b");
  }
}

function getSavedTheme() {
  return localStorage.getItem("punto_coma_theme") || "light";
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const publicRoutes = ["/", "/login", "/register"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    document.body.classList.toggle("public-page", isPublicRoute);
    document.body.classList.toggle("app-page", !isPublicRoute);

    if (isPublicRoute) {
      applyTheme("light");
      return;
    }

    applyTheme(getSavedTheme());
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ajustes"
        element={
          <ProtectedRoute allowedRoles={["alumno", "maestro", "administrador"]}>
            <Ajustes />
          </ProtectedRoute>
        }
      />

      <Route
        path="/plan"
        element={
          <ProtectedRoute allowedRoles={["alumno"]}>
            <Plan />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tareas"
        element={
          <ProtectedRoute allowedRoles={["alumno", "maestro", "administrador"]}>
            <Tareas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendario"
        element={
          <ProtectedRoute allowedRoles={["alumno", "maestro", "administrador"]}>
            <Calendario />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recursos"
        element={
          <ProtectedRoute allowedRoles={["alumno", "maestro", "administrador"]}>
            <Recursos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute allowedRoles={["alumno", "maestro", "administrador"]}>
            <Notificaciones />
          </ProtectedRoute>
        }
      />

      <Route
        path="/capturar"
        element={
          <ProtectedRoute allowedRoles={["maestro"]}>
            <Capturar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["administrador"]}>
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedRoute allowedRoles={["maestro", "administrador"]}>
            <Reportes />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analiticas"
        element={
          <ProtectedRoute allowedRoles={["maestro", "administrador"]}>
            <Analiticas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/alumnos"
        element={
          <ProtectedRoute allowedRoles={["maestro", "administrador"]}>
            <Alumnos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/alumnos/:email"
        element={
          <ProtectedRoute allowedRoles={["maestro", "administrador"]}>
            <AlumnoDetalle />
          </ProtectedRoute>
        }
      />

      <Route
        path="/actividad"
        element={
          <ProtectedRoute allowedRoles={["administrador"]}>
            <Actividad />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracion"
        element={
          <ProtectedRoute allowedRoles={["administrador"]}>
            <Configuracion />
          </ProtectedRoute>
        }
      />

      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}