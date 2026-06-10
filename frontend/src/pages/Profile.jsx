// Archivo: frontend/src/pages/Profile.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";

import NavBar from "../components/layout/NavBar.jsx";

import "../styles/dashboard.css";
import "../styles/profile.css";

const MAX_PHOTO_SIZE = 1.5 * 1024 * 1024;

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Usuario";
}

function getPhotoKey(user) {
  const email = String(user?.email || "usuario").trim().toLowerCase();
  return `punto_coma_profile_photo_${email}`;
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
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
    try {
      localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }

  for (const key of sessionKeys) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { showToast } = useToast();
  const confirm = useConfirm();

  const fileInputRef = useRef(null);
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const photoKey = useMemo(() => {
    return getPhotoKey(user);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const savedPhoto = safeGetItem(photoKey);
    setPhoto(savedPhoto);
  }, [user, photoKey]);

  const roleInfo = useMemo(() => {
    const roles = {
      alumno: {
        label: "Alumno",
        description:
          "Consulta tu rendimiento, tareas, recursos y plan de estudio.",
        permissions: [
          "Ver calificaciones personales",
          "Consultar promedio general",
          "Revisar tareas académicas",
          "Consultar calendario y recursos",
        ],
        primaryAction: {
          label: "Ver plan",
          to: "/plan",
        },
      },
      maestro: {
        label: "Maestro",
        description: "Registra calificaciones, crea tareas y comparte recursos.",
        permissions: [
          "Capturar calificaciones",
          "Crear tareas académicas",
          "Agregar recursos de apoyo",
          "Consultar analíticas",
        ],
        primaryAction: {
          label: "Capturar",
          to: "/capturar",
        },
      },
      administrador: {
        label: "Administrador",
        description:
          "Gestiona usuarios, materias, asignaciones y configuración del sistema.",
        permissions: [
          "Crear materias",
          "Asignar materias a docentes",
          "Consultar actividad",
          "Revisar configuración y Firebase",
        ],
        primaryAction: {
          label: "Administrar",
          to: "/admin",
        },
      },
    };

    return (
      roles[user?.role] || {
        label: "Usuario",
        description: "Cuenta registrada en el sistema.",
        permissions: ["Acceso general al sistema"],
        primaryAction: {
          label: "Ir al inicio",
          to: "/app",
        },
      }
    );
  }, [user?.role]);

  const initials = useMemo(() => {
    const name = String(getUserName(user)).trim();

    if (!name) return "PC";

    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }, [user]);

  const notifyPhotoChange = (newPhoto) => {
    window.dispatchEvent(
      new CustomEvent("profile-photo-updated", {
        detail: {
          email: user?.email || "",
          photo: newPhoto,
        },
      })
    );
  };

  const onPickPhoto = () => {
    fileInputRef.current?.click();
  };

  const onPhotoSelected = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast({
        type: "warning",
        title: "Archivo inválido",
        message: "Selecciona una imagen.",
      });

      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      showToast({
        type: "warning",
        title: "Imagen muy pesada",
        message: "Usa una imagen menor a 1.5 MB.",
      });

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");

      if (!result.startsWith("data:image/")) {
        showToast({
          type: "warning",
          title: "Imagen inválida",
          message: "No se pudo leer la imagen seleccionada.",
        });

        event.target.value = "";
        return;
      }

      const saved = safeSetItem(photoKey, result);

      if (!saved) {
        showToast({
          type: "error",
          title: "No se pudo guardar",
          message:
            "El navegador no permitió guardar la foto. Intenta con una imagen más ligera.",
        });

        event.target.value = "";
        return;
      }

      setPhoto(result);
      notifyPhotoChange(result);

      showToast({
        type: "success",
        title: "Foto actualizada",
        message: "Tu foto de perfil se guardó en este navegador.",
      });

      event.target.value = "";
    };

    reader.onerror = () => {
      showToast({
        type: "error",
        title: "No se pudo leer",
        message: "Intenta seleccionar otra imagen.",
      });

      event.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const onRemovePhoto = async () => {
    const ok = await confirm({
      title: "Quitar foto",
      message: "¿Quieres eliminar tu foto de perfil?",
      confirmText: "Quitar",
      cancelText: "Cancelar",
      tone: "warning",
    });

    if (!ok) return;

    safeRemoveItem(photoKey);
    setPhoto("");
    notifyPhotoChange("");

    showToast({
      type: "info",
      title: "Foto eliminada",
      message: "Volverán a mostrarse tus iniciales.",
    });
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

  const isAlumno = user.role === "alumno";
  const displayName = getUserName(user);

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card profileCleanHero">
          <div className="profilePhotoBlock">
            <button
              type="button"
              className="profilePhotoButton"
              onClick={onPickPhoto}
              title="Cambiar foto de perfil"
            >
              {photo ? (
                <img src={photo} alt="Foto de perfil" />
              ) : (
                <span>{initials}</span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPhotoSelected}
            />

            <div className="profilePhotoActions">
              <button type="button" className="btn-ghost" onClick={onPickPhoto}>
                Cambiar foto
              </button>

              {photo && (
                <button
                  type="button"
                  className="btn-del"
                  onClick={onRemovePhoto}
                >
                  Quitar
                </button>
              )}
            </div>
          </div>

          <div className="profileCleanInfo">
            <span className="profileEyebrow">Cuenta activa</span>

            <h1>{displayName}</h1>

            <p className="msg">
              {roleInfo.label} · {user.email}
            </p>

            <p className="profileDescription">{roleInfo.description}</p>

            <div className="profileCleanActions">
              <Link to={roleInfo.primaryAction.to} className="profileAction primary">
                {roleInfo.primaryAction.label}
              </Link>

              <Link to="/calendario" className="profileAction">
                Calendario
              </Link>

              <Link to="/recursos" className="profileAction">
                Recursos
              </Link>

              <button
                type="button"
                className="profileAction danger"
                onClick={onLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </section>

        <section className="profileMinimalGrid">
          <article className="card profilePanel">
            <div className="profileSectionHeader">
              <span className="profileSectionTag">Información</span>

              <h2>Datos de la cuenta</h2>

              <p>Datos principales registrados en el sistema.</p>
            </div>

            <div className="profileSimpleList">
              <div>
                <span>Nombre</span>
                <strong>{displayName}</strong>
              </div>

              <div>
                <span>Correo</span>
                <strong>{user.email || "—"}</strong>
              </div>

              <div>
                <span>Rol</span>
                <strong>{roleInfo.label}</strong>
              </div>

              {isAlumno ? (
                <>
                  <div>
                    <span>Grupo</span>
                    <strong>{user.grupo || "—"}</strong>
                  </div>

                  <div>
                    <span>Boleta</span>
                    <strong>{user.boleta || "—"}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>Datos escolares</span>
                  <strong>No requiere grupo ni boleta</strong>
                </div>
              )}
            </div>
          </article>

          <aside className="card profilePanel">
            <div className="profileSectionHeader">
              <span className="profileSectionTag">Permisos</span>

              <h2>Acceso del rol</h2>

              <p>Funciones principales disponibles para esta cuenta.</p>
            </div>

            <div className="permissionList">
              {roleInfo.permissions.map((permission) => (
                <div className="permissionItem" key={permission}>
                  <span className="permissionDot" />
                  <span>{permission}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}