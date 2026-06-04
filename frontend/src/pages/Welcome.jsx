import React from "react";
import { Link } from "react-router-dom";
import "../styles/welcome.css";

export default function Welcome() {
  return (
    <main className="welcomePage">
      <section className="welcomeShell">
        <div className="welcomeLeft">
          <header className="welcomeBrand">
            <span className="welcomeLogo">;</span>

            <div>
              <strong>Punto y Coma</strong>
              <small>Seguimiento académico</small>
            </div>
          </header>

          <div className="welcomeIntro">
            <span className="welcomeLabel">Plataforma académica</span>

            <h1>Bienvenido</h1>

            <p>
              Consulta calificaciones, tareas, recursos, calendario,
              notificaciones y reportes en una sola plataforma. Punto y Coma
              ayuda a alumnos, maestros y administradores a dar seguimiento al
              rendimiento académico de forma clara y ordenada.
            </p>
          </div>

          <div className="welcomeFeatures">
            <span>Calificaciones y progreso</span>
            <span>Tareas y calendario</span>
            <span>Recursos y reportes</span>
            <span>Acceso por roles</span>
          </div>
        </div>

        <div className="welcomeRight">
          <div className="accessBlock">
            <span className="accessLabel">Comenzar</span>

            <h2>Tu acceso a la plataforma</h2>

            <p>
              Inicia sesión o crea una cuenta para revisar tu avance,
              administrar materias y acceder a las funciones disponibles según
              tu rol.
            </p>

            <div className="accessActions">
              <Link to="/login" className="accessButton primary">
                Iniciar sesión
              </Link>

              <Link to="/register" className="accessButton secondary">
                Crear cuenta
              </Link>
            </div>

            <div className="infoCard">
              <strong>Funciones principales</strong>
              <p>
                Diseñada para alumnos, maestros y administradores. Accede a
                calificaciones, tareas, reportes y notificaciones desde un solo
                lugar.
              </p>
            </div>

            <div className="infoCard">
              <strong>Acceso recomendado</strong>
              <p>
                Usa tu correo institucional para una mejor experiencia dentro de
                la plataforma.
              </p>
            </div>

            <footer className="welcomeFooter">
              Proyecto académico · Punto y Coma
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}