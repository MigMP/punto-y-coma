// Archivo: frontend/src/pages/NotFound.jsx

import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../state/AuthContext.jsx";

import "../styles/dashboard.css";

function getDefaultPathByRole(role) {
  if (role === "alumno") return "/plan";
  if (role === "maestro") return "/capturar";
  if (role === "administrador") return "/admin";

  return "/app";
}

export default function NotFound() {
  const { user, token: ctxToken } = useAuth();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const isLoggedIn = Boolean(token);
  const homePath = isLoggedIn ? getDefaultPathByRole(user?.role) : "/";
  const homeLabel = isLoggedIn ? "Volver al panel" : "Volver al inicio";

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  return (
    <main className="container">
      <section className="card row-between">
        <div>
          <h1>404</h1>

          <p className="msg">
            La página que intentas abrir no existe o fue movida dentro del
            sistema.
          </p>
        </div>

        <Link to={homePath} className="btn-ghost notFoundLink">
          {homeLabel}
        </Link>
      </section>

      <section className="card">
        <h2>¿Qué puedes hacer?</h2>

        <div className="lista">
          <div className="item">
            <div>
              <strong>{isLoggedIn ? "Ir al panel" : "Ir al inicio"}</strong>

              <div className="muted">
                {isLoggedIn
                  ? "Regresa a tu pantalla principal según tu rol dentro del sistema."
                  : "Regresa a la pantalla principal para iniciar sesión o crear una cuenta."}
              </div>
            </div>

            <Link to={homePath} className="badge ok">
              {isLoggedIn ? "Panel" : "Inicio"}
            </Link>
          </div>

          {!isLoggedIn && (
            <div className="item">
              <div>
                <strong>Entrar al sistema</strong>

                <div className="muted">
                  Si ya tienes cuenta, puedes iniciar sesión y volver a tu panel.
                </div>
              </div>

              <Link to="/login" className="badge">
                Login
              </Link>
            </div>
          )}

          {isLoggedIn && (
            <div className="item">
              <div>
                <strong>Ver perfil</strong>

                <div className="muted">
                  También puedes regresar a tu perfil para continuar navegando.
                </div>
              </div>

              <Link to="/profile" className="badge">
                Perfil
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}