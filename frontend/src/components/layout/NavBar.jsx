import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";
import { apiJSON } from "../../services/api.js";
import "../../styles/navbar.css";

function BellIcon() {
  return (
    <svg
      className="navBellIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M18 9.5V11.8C18 13.3 18.5 14.7 19.4 15.9L20 16.7C20.3 17.1 20 17.8 19.5 17.8H4.5C4 17.8 3.7 17.1 4 16.7L4.6 15.9C5.5 14.7 6 13.3 6 11.8V9.5C6 6.2 8.7 3.5 12 3.5C15.3 3.5 18 6.2 18 9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20C10.4 20.6 11.1 21 12 21C12.9 21 13.6 20.6 14 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NavBar() {
  const { user, logout, token: ctxToken } = useAuth();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const [academicReminders, setAcademicReminders] = useState(
    localStorage.getItem("ajustes_academic_reminders") !== "false"
  );

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const role = user?.role;
  const displayUser = user?.name || user?.nombre || user?.email || "Cuenta";
  const email = user?.email || "";

  const photoKey = useMemo(() => {
    const cleanEmail = String(email || "usuario").trim().toLowerCase();
    return `punto_coma_profile_photo_${cleanEmail}`;
  }, [email]);

  useEffect(() => {
    if (!email) return;

    const savedPhoto = localStorage.getItem(photoKey) || "";
    setProfilePhoto(savedPhoto);

    const onPhotoUpdated = (event) => {
      const eventEmail = String(event.detail?.email || "").trim().toLowerCase();
      const currentEmail = String(email || "").trim().toLowerCase();

      if (eventEmail === currentEmail) {
        setProfilePhoto(event.detail?.photo || "");
      }
    };

    window.addEventListener("profile-photo-updated", onPhotoUpdated);

    return () => {
      window.removeEventListener("profile-photo-updated", onPhotoUpdated);
    };
  }, [email, photoKey]);

  useEffect(() => {
    const saved = localStorage.getItem("ajustes_academic_reminders") !== "false";
    setAcademicReminders(saved);

    const onAcademicRemindersUpdated = (event) => {
      setAcademicReminders(Boolean(event.detail?.enabled));
    };

    window.addEventListener(
      "academic-reminders-updated",
      onAcademicRemindersUpdated
    );

    return () => {
      window.removeEventListener(
        "academic-reminders-updated",
        onAcademicRemindersUpdated
      );
    };
  }, []);

  const loadUnreadNotifications = async () => {
    if (!token || !role) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await apiJSON("/notificaciones?unread=true", { token });

      if (Array.isArray(data)) {
        setUnreadCount(data.length);
      } else {
        setUnreadCount(0);
      }
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadUnreadNotifications();

    const interval = window.setInterval(() => {
      loadUnreadNotifications();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  useEffect(() => {
    loadUnreadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const roleInfo = useMemo(() => {
    const roles = {
      alumno: {
        label: "Alumno",
        path: "/plan",
        link: "Plan",
      },
      maestro: {
        label: "Maestro",
        path: "/capturar",
        link: "Capturar",
      },
      administrador: {
        label: "Administrador",
        path: "/admin",
        link: "Admin",
      },
    };

    return roles[role] || {
      label: "Usuario",
      path: "/app",
      link: "Panel",
    };
  }, [role]);

  const canSeeResources =
    role === "alumno" || role === "maestro" || role === "administrador";

  const canSeeCalendar =
    role === "alumno" || role === "maestro" || role === "administrador";

  const canSeeTasks =
    role === "alumno" || role === "maestro" || role === "administrador";

  const canSeeNotifications =
    role === "alumno" || role === "maestro" || role === "administrador";

  const canSeeAcademicTracking =
    role === "maestro" || role === "administrador";

  const canSeeAdminTools = role === "administrador";

  const initials = useMemo(() => {
    const cleanName = String(displayUser || "").trim();

    if (!cleanName) return "PC";

    const parts = cleanName.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return cleanName.slice(0, 2).toUpperCase();
  }, [displayUser]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const hardLogout = () => {
    setMenuOpen(false);

    try {
      logout?.();
    } catch {
      // Si el logout del contexto falla, igual limpiamos abajo.
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("authUser");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("punto_coma_user");
    localStorage.removeItem("punto_coma_token");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("authUser");
    sessionStorage.removeItem("currentUser");

    window.location.href = "/";
  };

  const shouldShowNotificationDot =
    canSeeNotifications && academicReminders && unreadCount > 0;

  return (
    <header className="nav">
      <div className="navInner">
        <Link to="/app" className="navBrand">
          <span className="navBrandMark">;</span>

          <div className="navBrandText">
            <strong>Punto y Coma</strong>
            <span>Seguimiento académico</span>
          </div>
        </Link>

        <nav className="navLinks" aria-label="Navegación principal">
          <NavLink
            to="/app"
            className={({ isActive }) =>
              isActive ? "navLink active" : "navLink"
            }
          >
            Inicio
          </NavLink>

          {role && (
            <NavLink
              to={roleInfo.path}
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              {roleInfo.link}
            </NavLink>
          )}

          {canSeeCalendar && (
            <NavLink
              to="/calendario"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Calendario
            </NavLink>
          )}

          {canSeeResources && (
            <NavLink
              to="/recursos"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Recursos
            </NavLink>
          )}

          {canSeeTasks && (
            <NavLink
              to="/tareas"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Tareas
            </NavLink>
          )}

          {canSeeAcademicTracking && (
            <NavLink
              to="/analiticas"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Analíticas
            </NavLink>
          )}
        </nav>

        <div className="navRight">
          {canSeeNotifications && (
            <NavLink
              to="/notificaciones"
              className={({ isActive }) =>
                isActive ? "navBell active" : "navBell"
              }
              aria-label={`Notificaciones${
                unreadCount > 0 ? `, ${unreadCount} sin leer` : ""
              }`}
              title={
                unreadCount > 0
                  ? `${unreadCount} notificación(es) sin leer`
                  : "Notificaciones"
              }
            >
              <BellIcon />

              {shouldShowNotificationDot && <span className="navBellDot" />}
            </NavLink>
          )}

          <div className="navAccountCompact">
            <button
              type="button"
              className="navUserButton"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-label="Abrir menú de usuario"
            >
              <span className="navAvatar">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Foto de perfil" />
                ) : (
                  initials
                )}
              </span>

              <span className="navUserMini">
                <strong>{displayUser}</strong>
                <small>{roleInfo.label}</small>
              </span>

              <span className={`navChevron ${menuOpen ? "open" : ""}`}>
                ⌄
              </span>
            </button>

            {menuOpen && (
              <div className="navDropdown">
                <div className="navDropdownHeader">
                  <strong>{displayUser}</strong>
                  {email && <span>{email}</span>}
                </div>

                <div className="navDropdownDivider" />

                <Link to="/profile" onClick={closeMenu}>
                  Perfil
                </Link>

                <Link to="/ajustes" onClick={closeMenu}>
                  Ajustes
                </Link>

                {canSeeAcademicTracking && (
                  <Link to="/alumnos" onClick={closeMenu}>
                    Alumnos
                  </Link>
                )}

                {canSeeAcademicTracking && (
                  <Link to="/reportes" onClick={closeMenu}>
                    Reportes
                  </Link>
                )}

                {canSeeAdminTools && (
                  <Link to="/actividad" onClick={closeMenu}>
                    Actividad
                  </Link>
                )}

                {canSeeAdminTools && (
                  <Link to="/configuracion" onClick={closeMenu}>
                    Configuración
                  </Link>
                )}

                <div className="navDropdownDivider" />

                <a
                  href="/"
                  className="navDropdownLogout"
                  onClick={(event) => {
                    event.preventDefault();
                    hardLogout();
                  }}
                >
                  Cerrar sesión
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}