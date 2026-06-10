// Archivo: frontend/src/pages/Ajustes.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";
import "../styles/compact.css";
import "../styles/settings.css";

function safeGetItem(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function getThemePreference() {
  return safeGetItem("punto_coma_theme", "light");
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;

  safeSetItem("punto_coma_theme", normalized);
  safeSetItem("theme", normalized);

  root.dataset.theme = normalized;
  document.body.dataset.theme = normalized;

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

  window.dispatchEvent(
    new CustomEvent("theme-updated", {
      detail: {
        theme: normalized,
      },
    })
  );
}

function applyCompactMode(enabled) {
  safeSetItem("ajustes_compact_mode", String(enabled));
  document.body.classList.toggle("compact-mode", enabled);

  window.dispatchEvent(
    new CustomEvent("compact-mode-updated", {
      detail: {
        enabled,
      },
    })
  );
}

function clearAuthStorage() {
  const localKeys = [
    "token",
    "user",
    "authUser",
    "currentUser",
    "punto_coma_user",
    "punto_coma_token",
  ];

  const sessionKeys = ["token", "user", "authUser", "currentUser"];

  for (const key of localKeys) {
    safeRemoveItem(key);
  }

  for (const key of sessionKeys) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}

function validatePasswordForm(passwordForm) {
  if (
    !passwordForm.currentPassword ||
    !passwordForm.newPassword ||
    !passwordForm.confirmPassword
  ) {
    return "Completa la contraseña actual, la nueva y la confirmación.";
  }

  if (passwordForm.newPassword.length < 8) {
    return "La nueva contraseña debe tener mínimo 8 caracteres.";
  }

  if (!/[A-Z]/.test(passwordForm.newPassword)) {
    return "La nueva contraseña debe incluir al menos una letra mayúscula.";
  }

  if (!/[a-z]/.test(passwordForm.newPassword)) {
    return "La nueva contraseña debe incluir al menos una letra minúscula.";
  }

  if (!/\d/.test(passwordForm.newPassword)) {
    return "La nueva contraseña debe incluir al menos un número.";
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    return "La confirmación debe ser igual a la nueva contraseña.";
  }

  if (passwordForm.currentPassword === passwordForm.newPassword) {
    return "La nueva contraseña debe ser diferente a la contraseña actual.";
  }

  return "";
}

export default function Ajustes() {
  const { user, token: ctxToken, logout } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const token = useMemo(() => {
    return ctxToken || safeGetItem("token", "");
  }, [ctxToken]);

  const [theme, setTheme] = useState(getThemePreference());
  const [savingPassword, setSavingPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [preferences, setPreferences] = useState(() => ({
    toastsEnabled: safeGetItem("ajustes_toasts_enabled", "true") !== "false",
    academicReminders:
      safeGetItem("ajustes_academic_reminders", "true") !== "false",
    compactMode: safeGetItem("ajustes_compact_mode", "false") === "true",
  }));

  useEffect(() => {
    document.body.classList.add("app-bg");

    const savedTheme = getThemePreference();
    setTheme(savedTheme);
    applyTheme(savedTheme);

    const compactEnabled = safeGetItem("ajustes_compact_mode", "false") === "true";
    document.body.classList.toggle("compact-mode", compactEnabled);

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);

    showToast({
      type: "success",
      title: "Tema actualizado",
      message:
        nextTheme === "dark" ? "Modo oscuro activado." : "Modo claro activado.",
    });
  };

  const updatePreference = (key, value) => {
    const updated = {
      ...preferences,
      [key]: value,
    };

    setPreferences(updated);

    if (key === "toastsEnabled") {
      safeSetItem("ajustes_toasts_enabled", String(value));

      window.dispatchEvent(
        new CustomEvent("toasts-preference-updated", {
          detail: {
            enabled: value,
          },
        })
      );
    }

    if (key === "academicReminders") {
      safeSetItem("ajustes_academic_reminders", String(value));

      window.dispatchEvent(
        new CustomEvent("academic-reminders-updated", {
          detail: {
            enabled: value,
          },
        })
      );
    }

    if (key === "compactMode") {
      applyCompactMode(value);
    }

    showToast({
      type: "success",
      title: "Preferencia guardada",
      message: "El ajuste se guardó correctamente.",
    });
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitPassword = async (event) => {
    event.preventDefault();

    const error = validatePasswordForm(passwordForm);

    if (error) {
      showToast({
        type: "warning",
        title: "Revisa la contraseña",
        message: error,
      });
      return;
    }

    try {
      setSavingPassword(true);

      await apiJSON("/me/password", {
        token,
        method: "PATCH",
        body: passwordForm,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      showToast({
        type: "success",
        title: "Contraseña actualizada",
        message: "Tu contraseña se cambió correctamente.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo cambiar",
        message: error.message || "Revisa tu contraseña actual.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const onLogout = async () => {
    const ok = await confirm({
      title: "Cerrar sesión",
      message: "¿Seguro que quieres salir de tu cuenta?",
      confirmText: "Cerrar sesión",
      cancelText: "Cancelar",
      tone: "warning",
    });

    if (!ok) return;

    try {
      logout?.();
    } catch {
      // Si el contexto falla, limpiamos manualmente abajo.
    }

    clearAuthStorage();

    showToast({
      type: "info",
      title: "Sesión cerrada",
      message: "Saliste correctamente del sistema.",
    });

    navigate("/login", { replace: true });
  };

  if (!user) return null;

  return (
    <>
      <NavBar />

      <main className="container settingsPage">
        <section className="card settingsHero">
          <div>
            <span className="settingsTag">Cuenta</span>

            <h1>Ajustes</h1>

            <p className="msg">
              Personaliza tu cuenta, seguridad y preferencias de la aplicación.
            </p>
          </div>

          <Link to="/profile" className="settingsButton primary">
            Ver perfil
          </Link>
        </section>

        <section className="card settingsSection">
          <div className="settingsSectionHeader">
            <h2>Apariencia</h2>

            <p className="msg">Cambia el aspecto general de la aplicación.</p>
          </div>

          <div className="settingsList">
            <div className="settingsItem">
              <div>
                <strong>Tema de la app</strong>

                <p>
                  Actual: {theme === "dark" ? "Modo oscuro" : "Modo claro"}.
                </p>
              </div>

              <button
                type="button"
                className="settingsButton primary"
                onClick={toggleTheme}
              >
                {theme === "dark"
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"}
              </button>
            </div>

            <div className="settingsItem">
              <div>
                <strong>Modo compacto</strong>

                <p>Reduce espacios y muestra más información en pantalla.</p>
              </div>

              <button
                type="button"
                className={
                  preferences.compactMode
                    ? "settingsButton active"
                    : "settingsButton"
                }
                onClick={() =>
                  updatePreference("compactMode", !preferences.compactMode)
                }
              >
                {preferences.compactMode ? "Activo" : "Inactivo"}
              </button>
            </div>
          </div>
        </section>

        <section className="card settingsSection">
          <div className="settingsSectionHeader">
            <h2>Seguridad</h2>

            <p className="msg">
              Cambia tu contraseña de acceso. La actualización se guarda en
              Firebase.
            </p>
          </div>

          <form className="settingsForm" onSubmit={submitPassword}>
            <label>
              Contraseña actual
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Escribe tu contraseña actual"
                disabled={savingPassword}
              />
            </label>

            <label>
              Nueva contraseña
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Mínimo 8 caracteres, mayúscula y número"
                disabled={savingPassword}
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Repite la nueva contraseña"
                disabled={savingPassword}
              />
            </label>

            <button
              type="submit"
              className="settingsButton primary"
              disabled={savingPassword}
            >
              {savingPassword ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        </section>

        <section className="card settingsSection">
          <div className="settingsSectionHeader">
            <h2>Preferencias</h2>

            <p className="msg">
              Controla cómo quieres recibir avisos dentro de la aplicación.
            </p>
          </div>

          <div className="settingsList">
            <div className="settingsItem">
              <div>
                <strong>Notificaciones emergentes</strong>

                <p>
                  Muestra avisos temporales cuando se guardan cambios o se
                  realizan acciones.
                </p>
              </div>

              <button
                type="button"
                className={
                  preferences.toastsEnabled
                    ? "settingsButton active"
                    : "settingsButton"
                }
                onClick={() =>
                  updatePreference("toastsEnabled", !preferences.toastsEnabled)
                }
              >
                {preferences.toastsEnabled ? "Activadas" : "Desactivadas"}
              </button>
            </div>

            <div className="settingsItem">
              <div>
                <strong>Recordatorios académicos</strong>

                <p>
                  Muestra el indicador rojo en la campanita cuando hay avisos
                  importantes.
                </p>
              </div>

              <button
                type="button"
                className={
                  preferences.academicReminders
                    ? "settingsButton active"
                    : "settingsButton"
                }
                onClick={() =>
                  updatePreference(
                    "academicReminders",
                    !preferences.academicReminders
                  )
                }
              >
                {preferences.academicReminders ? "Activados" : "Desactivados"}
              </button>
            </div>
          </div>
        </section>

        <section className="card settingsSection">
          <div className="settingsSectionHeader">
            <h2>Cuenta</h2>

            <p className="msg">Información básica de la sesión actual.</p>
          </div>

          <div className="settingsList">
            <div className="settingsItem">
              <div>
                <strong>{getUserName(user)}</strong>

                <p>
                  {user.email} · {user.role}
                </p>
              </div>

              <Link to="/profile" className="settingsButton primary">
                Perfil
              </Link>
            </div>

            <div className="settingsItem danger">
              <div>
                <strong>Cerrar sesión</strong>

                <p>Salir de esta cuenta en el dispositivo actual.</p>
              </div>

              <button
                type="button"
                className="settingsButton danger"
                onClick={onLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}