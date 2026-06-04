import React, { useEffect } from "react";
import { Link } from "react-router-dom";

import "../styles/dashboard.css";

export default function NotFound() {
  useEffect(() => {
    document.body.classList.add("app-bg");
    return () => document.body.classList.remove("app-bg");
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

        <Link to="/" className="btn-ghost notFoundLink">
          Volver al inicio
        </Link>
      </section>

      <section className="card">
        <h2>¿Qué puedes hacer?</h2>

        <div className="lista">
          <div className="item">
            <div>
              <strong>Ir al inicio</strong>
              <div className="muted">
                Regresa a la pantalla principal para iniciar sesión o crear una
                cuenta.
              </div>
            </div>

            <Link to="/" className="badge ok">
              Inicio
            </Link>
          </div>

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
        </div>
      </section>
    </main>
  );
}