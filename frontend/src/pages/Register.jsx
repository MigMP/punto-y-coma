// Archivo: frontend/src/pages/Register.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import "../styles/auth.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["alumno", "maestro"];

function validatePassword(password) {
  if (password.length < 8) {
    return "La contraseña debe tener mínimo 8 caracteres.";
  }

  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }

  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra minúscula.";
  }

  if (!/\d/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }

  return "";
}

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    grupo: "",
    boleta: "",
    email: "",
    password: "",
    role: "alumno",
    teacherCode: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAlumno = form.role === "alumno";
  const isMaestro = form.role === "maestro";

  const roleDescription = useMemo(() => {
    const roles = {
      alumno:
        "Consulta tus calificaciones, riesgos académicos y planes de estudio personalizados.",
      maestro:
        "Administra materias y registra calificaciones de alumnos. Requiere correo institucional y código docente.",
    };

    return roles[form.role] || roles.alumno;
  }, [form.role]);

  useEffect(() => {
    document.body.classList.add("auth-bg");

    return () => {
      document.body.classList.remove("auth-bg");
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "role") {
      const nextRole = VALID_ROLES.includes(value) ? value : "alumno";

      setForm((prev) => ({
        ...prev,
        role: nextRole,
        grupo: nextRole === "alumno" ? prev.grupo : "",
        boleta: nextRole === "alumno" ? prev.boleta : "",
        teacherCode: nextRole === "maestro" ? prev.teacherCode : "",
      }));

      return;
    }

    if (name === "boleta") {
      setForm((prev) => ({
        ...prev,
        boleta: value.replace(/\D/g, "").slice(0, 10),
      }));
      return;
    }

    if (name === "grupo") {
      setForm((prev) => ({
        ...prev,
        grupo: value.toUpperCase().slice(0, 10),
      }));
      return;
    }

    if (name === "teacherCode") {
      setForm((prev) => ({
        ...prev,
        teacherCode: value.toUpperCase().trimStart().slice(0, 40),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const email = form.email.trim().toLowerCase();
    const passwordError = validatePassword(form.password);

    if (!VALID_ROLES.includes(form.role)) {
      return "No puedes crear cuentas de administrador desde el registro.";
    }

    if (!nombre || !apellido) {
      return "Ingresa nombre y apellido.";
    }

    if (!EMAIL_RE.test(email)) {
      return "Ingresa un correo válido.";
    }

    if (passwordError) {
      return passwordError;
    }

    if (isAlumno) {
      if (!email.endsWith("@alumno.ipn.mx")) {
        return "Los alumnos deben usar correo institucional @alumno.ipn.mx.";
      }

      if (!form.grupo.trim()) {
        return "Ingresa tu grupo.";
      }

      if (form.boleta.length !== 10) {
        return "La boleta debe tener 10 dígitos.";
      }
    }

    if (isMaestro) {
      if (!email.endsWith("@ipn.mx")) {
        return "Los maestros deben usar correo institucional @ipn.mx.";
      }

      if (!form.teacherCode.trim()) {
        return "Ingresa el código docente para crear una cuenta de maestro.";
      }
    }

    return "";
  };

  const onSubmit = async (event) => {
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

    const payload = {
      name: `${form.nombre.trim()} ${form.apellido.trim()}`,
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      grupo: isAlumno ? form.grupo.trim().toUpperCase() : "",
      boleta: isAlumno ? form.boleta : "",
      teacherCode: isMaestro ? form.teacherCode.trim().toUpperCase() : "",
    };

    try {
      setLoading(true);

      await apiJSON("/auth/register", {
        method: "POST",
        body: payload,
      });

      showToast({
        type: "success",
        title: "Cuenta creada",
        message: "Ahora puedes iniciar sesión.",
      });

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 900);
    } catch (error) {
      showToast({
        type: "error",
        title: "Registro fallido",
        message: error.message || "No se pudo crear la cuenta.",
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

      <section className="authShell registerShell">
        <aside className="authLeft">
          <div>
            <span className="authEyebrow">Crear cuenta</span>

            <h1>Registro</h1>

            <p>
              Crea tu cuenta para consultar calificaciones, revisar tareas,
              recibir notificaciones, acceder a recursos y usar las funciones
              disponibles según tu rol.
            </p>

            <div className="authChips">
              <span>Acceso académico</span>
              <span>Roles protegidos</span>
              <span>Seguimiento</span>
              <span>Panel personalizado</span>
            </div>
          </div>

          <div className="authInfoBox">
            <strong>Roles disponibles</strong>
            <p>Alumno · Maestro con código docente</p>
          </div>
        </aside>

        <section className="authRight">
          <div className="authCard registerCard">
            <header className="authHeader">
              <span className="authTag">Nuevo acceso</span>

              <h2>Datos de registro</h2>

              <p>
                Completa tu información para crear tu cuenta. Las cuentas de
                administrador solo pueden ser asignadas manualmente.
              </p>
            </header>

            <form className="authForm registerForm" onSubmit={onSubmit}>
              <label className="fieldGroup">
                <span>Rol</span>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="alumno">Alumno</option>
                  <option value="maestro">Maestro</option>
                </select>

                <small className="fieldHint">{roleDescription}</small>
              </label>

              <div className="formRow">
                <label className="fieldGroup">
                  <span>Nombre</span>

                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre"
                    required
                    disabled={loading}
                  />
                </label>

                <label className="fieldGroup">
                  <span>Apellido</span>

                  <input
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    placeholder="Tu apellido"
                    required
                    disabled={loading}
                  />
                </label>
              </div>

              {isAlumno && (
                <div className="formRow">
                  <label className="fieldGroup">
                    <span>Grupo</span>

                    <input
                      name="grupo"
                      value={form.grupo}
                      onChange={handleChange}
                      placeholder="Ej. 6IV10"
                      disabled={loading}
                    />
                  </label>

                  <label className="fieldGroup">
                    <span>Boleta</span>

                    <input
                      name="boleta"
                      value={form.boleta}
                      onChange={handleChange}
                      placeholder="10 dígitos"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </label>
                </div>
              )}

              {isMaestro && (
                <label className="fieldGroup">
                  <span>Código docente</span>

                  <input
                    name="teacherCode"
                    value={form.teacherCode}
                    onChange={handleChange}
                    placeholder="Ej. MTR-CECYT5-2026-A1"
                    autoComplete="off"
                    disabled={loading}
                  />

                  <small className="fieldHint">
                    Este código lo proporciona el administrador del sistema.
                  </small>
                </label>
              )}

              <label className="fieldGroup">
                <span>Correo</span>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={
                    isAlumno ? "usuario@alumno.ipn.mx" : "usuario@ipn.mx"
                  }
                  autoComplete="email"
                  required
                  disabled={loading}
                />

                <small className="fieldHint">
                  {isAlumno
                    ? "Usa tu correo institucional de alumno."
                    : "Usa tu correo institucional docente del IPN."}
                </small>
              </label>

              <label className="fieldGroup">
                <span>Contraseña</span>

                <div className="passwordField">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Mínimo 8 caracteres, mayúscula y número"
                    autoComplete="new-password"
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
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>

              <div className="authLinks">
                <Link to="/login">¿Ya tienes cuenta? Inicia sesión</Link>

                <Link to="/">← Volver al inicio</Link>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}