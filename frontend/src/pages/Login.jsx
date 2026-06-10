// Archivo: frontend/src/pages/Login.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import "../styles/auth.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDefaultPathByRole(role) {
  if (role === "alumno") return "/plan";
  if (role === "maestro") return "/capturar";
  if (role === "administrador") return "/admin";

  return "/app";
}

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthed, user } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const email = useMemo(() => {
    return form.email.trim().toLowerCase();
  }, [form.email]);

  useEffect(() => {
    document.body.classList.add("auth-bg");

    return () => {
      document.body.classList.remove("auth-bg");
    };
  }, []);

  useEffect(() => {
    if (isAuthed) {
      navigate(getDefaultPathByRole(user?.role), {
        replace: true,
      });
    }
  }, [isAuthed, navigate, user?.role]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!email || !form.password) {
      showToast({
        type: "warning",
        title: "Campos incompletos",
        message: "Ingresa tu correo y contraseña para continuar.",
      });
      return false;
    }

    if (!EMAIL_RE.test(email)) {
      showToast({
        type: "warning",
        title: "Correo inválido",
        message: "Escribe un correo electrónico válido.",
      });
      return false;
    }

    return true;
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const data = await apiJSON("/auth/login", {
        method: "POST",
        body: {
          email,
          password: form.password,
        },
      });

      if (!data?.token || !data?.user) {
        showToast({
          type: "error",
          title: "Respuesta inválida",
          message: "El servidor no envió los datos necesarios.",
        });
        return;
      }

      const session = login({
        token: data.token,
        user: data.user,
      });

      showToast({
        type: "success",
        title: "Sesión iniciada",
        message: `Bienvenido ${session.user.nombre || session.user.email}.`,
      });

      navigate(getDefaultPathByRole(session.user.role), {
        replace: true,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo iniciar sesión",
        message: error.message || "Revisa tus datos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <header className="authTopbar">
        <Link to="/" className="authTopBrand">
          <span className="authTopLogo">;</span>

          <div>
            <strong>Punto y Coma</strong>
            <small>Seguimiento académico</small>
          </div>
        </Link>
      </header>

      <section className="authShell">
        <aside className="authLeft">
          <div>
            <span className="authEyebrow">Acceso académico</span>

            <h1>Iniciar sesión</h1>

            <p>
              Entra a tu cuenta para consultar calificaciones, revisar tareas,
              acceder a recursos, recibir notificaciones y dar seguimiento a tu
              rendimiento académico.
            </p>

            <div className="authChips">
              <span>Calificaciones</span>
              <span>Tareas</span>
              <span>Recursos</span>
              <span>Reportes</span>
            </div>
          </div>

          <div className="authInfoBox">
            <strong>Acceso por roles</strong>
            <p>Alumno · Maestro · Administrador</p>
          </div>
        </aside>

        <section className="authRight">
          <div className="authCard">
            <header className="authHeader">
              <span className="authTag">Bienvenido de nuevo</span>

              <h2>Accede a la plataforma</h2>

              <p>Ingresa tu correo y contraseña para continuar.</p>
            </header>

            <form className="authForm" onSubmit={onSubmit}>
              <label className="fieldGroup">
                <span>Correo</span>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </label>

              <label className="fieldGroup">
                <span>Contraseña</span>

                <div className="passwordField">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="passwordToggle"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              <button type="submit" className="authSubmit" disabled={loading}>
                {loading ? "Verificando..." : "Entrar"}
              </button>

              <div className="authLinks">
                <Link to="/register">¿No tienes cuenta? Regístrate</Link>

                <Link to="/">← Volver al inicio</Link>
              </div>
            </form>

            <div className="authMiniCard">
              <strong>Funciones principales</strong>

              <p>
                Consulta tu avance, revisa reportes, administra materias y
                accede a las herramientas disponibles según tu rol.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}