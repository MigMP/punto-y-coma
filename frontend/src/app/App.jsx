// Archivo: frontend/src/app/App.jsx

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

const ALL_ROLES = ["alumno", "maestro", "administrador"];
const STAFF_ROLES = ["maestro", "administrador"];
const ADMIN_ROLES = ["administrador"];

const PUBLIC_ROUTES = ["/", "/login", "/register"];

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;

  root.dataset.theme = normalized;
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
    return;
  }

  root.style.setProperty("--bg", "#020617");
  root.style.setProperty("--bg2", "#0f172a");
  root.style.setProperty("--card", "#0f172a");
  root.style.setProperty("--text", "#f8fafc");
  root.style.setProperty("--muted", "#94a3b8");
  root.style.setProperty("--border", "rgba(255, 255, 255, 0.12)");
  root.style.setProperty("--surface", "#0f172a");
  root.style.setProperty("--surface-soft", "#1e293b");
}

function getSavedTheme() {
  return localStorage.getItem("punto_coma_theme") || "light";
}

function ProtectedPage({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      {children}
    </ProtectedRoute>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

    document.body.classList.toggle("public-page", isPublicRoute);
    document.body.classList.toggle("app-page", !isPublicRoute);

    applyTheme(isPublicRoute ? "light" : getSavedTheme());
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <ProtectedPage>
            <Dashboard />
          </ProtectedPage>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedPage>
            <Profile />
          </ProtectedPage>
        }
      />

      <Route
        path="/ajustes"
        element={
          <ProtectedPage allowedRoles={ALL_ROLES}>
            <Ajustes />
          </ProtectedPage>
        }
      />

      <Route
        path="/plan"
        element={
          <ProtectedPage allowedRoles={["alumno"]}>
            <Plan />
          </ProtectedPage>
        }
      />

      <Route
        path="/tareas"
        element={
          <ProtectedPage allowedRoles={ALL_ROLES}>
            <Tareas />
          </ProtectedPage>
        }
      />

      <Route
        path="/calendario"
        element={
          <ProtectedPage allowedRoles={ALL_ROLES}>
            <Calendario />
          </ProtectedPage>
        }
      />

      <Route
        path="/recursos"
        element={
          <ProtectedPage allowedRoles={ALL_ROLES}>
            <Recursos />
          </ProtectedPage>
        }
      />

      <Route
        path="/notificaciones"
        element={
          <ProtectedPage allowedRoles={ALL_ROLES}>
            <Notificaciones />
          </ProtectedPage>
        }
      />

      <Route
        path="/capturar"
        element={
          <ProtectedPage allowedRoles={["maestro"]}>
            <Capturar />
          </ProtectedPage>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedPage allowedRoles={ADMIN_ROLES}>
            <Admin />
          </ProtectedPage>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedPage allowedRoles={STAFF_ROLES}>
            <Reportes />
          </ProtectedPage>
        }
      />

      <Route
        path="/analiticas"
        element={
          <ProtectedPage allowedRoles={STAFF_ROLES}>
            <Analiticas />
          </ProtectedPage>
        }
      />

      <Route
        path="/alumnos"
        element={
          <ProtectedPage allowedRoles={STAFF_ROLES}>
            <Alumnos />
          </ProtectedPage>
        }
      />

      <Route
        path="/alumnos/:email"
        element={
          <ProtectedPage allowedRoles={STAFF_ROLES}>
            <AlumnoDetalle />
          </ProtectedPage>
        }
      />

      <Route
        path="/actividad"
        element={
          <ProtectedPage allowedRoles={ADMIN_ROLES}>
            <Actividad />
          </ProtectedPage>
        }
      />

      <Route
        path="/configuracion"
        element={
          <ProtectedPage allowedRoles={ADMIN_ROLES}>
            <Configuracion />
          </ProtectedPage>
        }
      />

      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}