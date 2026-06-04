import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";

import "../styles/auth.css";

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
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.classList.add("auth-bg");

    return () => {
      document.body.classList.remove("auth-bg");
    };
  }, []);

  const isAlumno = form.role === "alumno";

  const roleDescription = useMemo(() => {
    const roles = {
      alumno:
        "Consulta tus calificaciones, riesgos académicos y planes de estudio personalizados.",
      maestro:
        "Administra materias y registra calificaciones de alumnos.",
    };

    return roles[form.role] || roles.alumno;
  }, [form.role]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "role") {
      const allowedRoles = ["alumno", "maestro"];

      setForm((prev) => ({
        ...prev,
        role: allowedRoles.includes(value) ? value : "alumno",
        grupo: value === "alumno" ? prev.grupo : "",
        boleta: value === "alumno" ? prev.boleta : "",
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

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const email = form.email.trim().toLowerCase();

    if (!["alumno", "maestro"].includes(form.role)) {
      return "No puedes crear cuentas de administrador desde el registro.";
    }

    if (!nombre || !apellido) {
      return "Ingresa nombre y apellido.";
    }

    if (!email.includes("@")) {
      return "Ingresa un correo válido.";
    }

    if (form.password.length < 4) {
      return "La contraseña debe tener mínimo 4 caracteres.";
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
            <p>Alumno · Maestro</p>
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

                <select name="role" value={form.role} onChange={handleChange}>
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
                    />
                  </label>

                  <label className="fieldGroup">
                    <span>Boleta</span>

                    <input
                      name="boleta"
                      value={form.boleta}
                      onChange={handleChange}
                      placeholder="10 dígitos"
                    />
                  </label>
                </div>
              )}

              <label className="fieldGroup">
                <span>Correo</span>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={
                    isAlumno ? "usuario@alumno.ipn.mx" : "correo@ejemplo.com"
                  }
                  autoComplete="email"
                  required
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
                    placeholder="Mínimo 4 caracteres"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="passwordToggle"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              <button className="authSubmit" disabled={loading}>
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