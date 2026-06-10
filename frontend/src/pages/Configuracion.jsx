// Archivo: frontend/src/pages/Configuracion.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";
import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";
import { getSavedTheme, getSystemTheme, toggleTheme } from "../utils/theme.js";
import "../styles/dashboard.css";
import "../styles/coach.css";

function getThemeLabel(theme) {
  return theme === "dark" ? "Modo oscuro" : "Modo claro";
}

function getUserName(user) {
  return user?.nombre || user?.name || user?.email || "Administrador";
}

function boolLabel(value) {
  return value ? "true" : "false";
}

function isFirebaseReady(status) {
  if (!status) return false;

  return (
    status.useFirebase === true &&
    status.firebasePreparado === true &&
    status.conexionFirestore === "ok"
  );
}

function getMigrationValue(resumen, key) {
  const value = resumen?.[key];

  if (Number.isFinite(Number(value))) {
    return Number(value);
  }

  return 0;
}

export default function Configuracion() {
  const { user, token: ctxToken } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const [health, setHealth] = useState(null);
  const [firebaseStatus, setFirebaseStatus] = useState(null);
  const [theme, setTheme] = useState(() => getSavedTheme() || getSystemTheme());
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  useEffect(() => {
    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };
  }, []);

  const loadSystemStatus = useCallback(async () => {
    if (!token) {
      setHealth(null);
      setFirebaseStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [healthData, firebaseData] = await Promise.all([
        apiJSON("/health", { token }),
        apiJSON("/firebase/status", { token }),
      ]);

      setHealth(healthData || null);
      setFirebaseStatus(firebaseData || null);
    } catch (error) {
      setHealth(null);
      setFirebaseStatus(null);

      showToast({
        type: "error",
        title: "No se pudo verificar el sistema",
        message:
          error.message || "No se pudo consultar el estado del servidor.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadSystemStatus();
  }, [loadSystemStatus]);

  const handleToggleTheme = () => {
    const next = toggleTheme();

    setTheme(next);

    showToast({
      type: "info",
      title: "Apariencia actualizada",
      message: `Ahora estás usando ${getThemeLabel(next).toLowerCase()}.`,
    });
  };

  const handleMigrateToFirebase = async () => {
    if (!isFirebaseReady(firebaseStatus)) {
      showToast({
        type: "warning",
        title: "Firebase no está listo",
        message:
          "Primero verifica que USE_FIREBASE esté activo y que Firestore responda correctamente.",
      });
      return;
    }

    const ok = await confirm({
      title: "Migrar JSON a Firebase",
      message:
        "Esta acción intentará copiar los datos actuales del archivo JSON local a Firestore. Ejecútala solo si ya revisaste que Firebase está conectado.",
      confirmText: "Migrar",
      cancelText: "Cancelar",
      tone: "warning",
    });

    if (!ok) return;

    try {
      setMigrating(true);

      const result = await apiJSON("/firebase/migrate-json", {
        token,
        method: "POST",
      });

      setMigrationResult(result || null);

      showToast({
        type: "success",
        title: "Migración completada",
        message: result?.message || "Los datos fueron enviados a Firestore.",
      });

      await loadSystemStatus();
    } catch (error) {
      setMigrationResult(null);

      showToast({
        type: "error",
        title: "No se pudo migrar",
        message: error.message || "Revisa la configuración de Firebase.",
      });
    } finally {
      setMigrating(false);
    }
  };

  const firebaseReady = isFirebaseReady(firebaseStatus);

  const systemCards = useMemo(() => {
    const backendOk = Boolean(health);
    const firebaseMode = firebaseStatus?.modoActual === "firebase";

    return [
      {
        title: "Frontend",
        value: "React + Vite",
        description:
          "Interfaz web modular con rutas protegidas y componentes reutilizables.",
        status: "Activo",
        tone: "ok",
      },
      {
        title: "Backend",
        value: backendOk ? "Conectado" : "Sin respuesta",
        description: backendOk
          ? "API activa y respondiendo correctamente."
          : "No se pudo confirmar el estado del backend.",
        status: backendOk ? "OK" : "Revisar",
        tone: backendOk ? "ok" : "warn",
      },
      {
        title: "Autenticación",
        value: "JWT",
        description:
          "Sesiones protegidas mediante token y control de acceso por roles.",
        status: token ? "Seguro" : "Sin token",
        tone: token ? "ok" : "warn",
      },
      {
        title: "Persistencia",
        value: firebaseMode ? "Firestore" : "JSON local",
        description:
          firebaseStatus?.mensaje ||
          "El sistema puede trabajar con JSON local y está preparado para Firestore.",
        status: firebaseReady ? "Conectado" : "Revisar",
        tone: firebaseReady ? "ok" : "warn",
      },
    ];
  }, [health, firebaseStatus, firebaseReady, token]);

  const migrationSummary = migrationResult?.resumen || null;

  return (
    <>
      <NavBar />

      <main className="container">
        <section className="card row-between">
          <div>
            <h1>Configuración del sistema</h1>

            <p className="msg">
              {getUserName(user)} · Estado técnico, reglas académicas y
              preparación para Firebase.
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={loadSystemStatus}
            disabled={loading || migrating}
          >
            {loading ? "Verificando..." : "Verificar estado"}
          </button>
        </section>

        <section className="card">
          <h2>Estado del sistema</h2>

          <div className="coachRow">
            {systemCards.map((card) => (
              <div className="kpi" key={card.title}>
                <div className="kpiTitle">{card.title}</div>

                <div className="kpiValue">{card.value}</div>

                <p className="msg">{card.description}</p>

                <span className={`badge ${card.tone}`}>{card.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Estado de Firebase</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Modo actual</strong>

                <p className="muted">
                  {firebaseStatus?.modoActual === "firebase"
                    ? "El backend está configurado para usar Firestore."
                    : "El backend sigue usando JSON local para mantener estable la demo."}
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.modoActual === "firebase" ? "ok" : "warn"
                }`}
              >
                {firebaseStatus?.modoActual || "sin datos"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>USE_FIREBASE</strong>

                <p className="muted">
                  Controla si el backend debe usar Firestore o JSON local.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.useFirebase ? "ok" : "warn"
                }`}
              >
                {boolLabel(firebaseStatus?.useFirebase)}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Modo de credenciales</strong>

                <p className="muted">
                  Indica si Firebase usa archivo de cuenta de servicio o
                  variables separadas en .env.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.credencialesModo ? "ok" : "warn"
                }`}
              >
                {firebaseStatus?.credencialesModo || "sin datos"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Service Account Path</strong>

                <p className="muted">
                  Indica si FIREBASE_SERVICE_ACCOUNT_PATH está configurado en el
                  archivo .env.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.serviceAccountPathConfigurado ? "ok" : "warn"
                }`}
              >
                {firebaseStatus?.serviceAccountPathConfigurado
                  ? "Configurado"
                  : "Pendiente"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Archivo Service Account</strong>

                <p className="muted">
                  Verifica si el archivo firebase-service-account.json existe en
                  el backend sin mostrar sus credenciales.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.serviceAccountExiste ? "ok" : "warn"
                }`}
              >
                {firebaseStatus?.serviceAccountExiste
                  ? "Encontrado"
                  : "No encontrado"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Variables alternativas</strong>

                <p className="muted">
                  Project ID, Client Email y Private Key solo se requieren si no
                  usas archivo de service account.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.projectIdConfigurado &&
                  firebaseStatus?.clientEmailConfigurado &&
                  firebaseStatus?.privateKeyConfigurada
                    ? "ok"
                    : "warn"
                }`}
              >
                {firebaseStatus?.projectIdConfigurado &&
                firebaseStatus?.clientEmailConfigurado &&
                firebaseStatus?.privateKeyConfigurada
                  ? "Configuradas"
                  : "No usadas"}
              </span>
            </div>

            <div className="item">
              <div>
                <strong>Conexión Firestore</strong>

                <p className="muted">
                  Solo se prueba cuando USE_FIREBASE está en true.
                </p>
              </div>

              <span
                className={`badge ${
                  firebaseStatus?.conexionFirestore === "ok" ? "ok" : "warn"
                }`}
              >
                {firebaseStatus?.conexionFirestore || "No activa"}
              </span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Migración a Firebase</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Migrar JSON local a Firestore</strong>

                <p className="muted">
                  Copia usuarios, materias, calificaciones, asignaciones,
                  actividad, tareas, notificaciones, recursos y calendario al
                  proyecto Firebase configurado.
                </p>

                <p className="muted">
                  Estado actual:{" "}
                  {firebaseReady
                    ? "Firebase conectado y listo"
                    : "Firebase todavía no está listo para migrar"}.
                </p>
              </div>

              <button
                type="button"
                className={firebaseReady ? "" : "btn-ghost"}
                onClick={handleMigrateToFirebase}
                disabled={migrating || loading || !firebaseReady}
              >
                {migrating ? "Migrando..." : "Migrar JSON a Firebase"}
              </button>
            </div>

            {!firebaseReady && (
              <div className="item">
                <div>
                  <strong>Migración bloqueada por seguridad</strong>

                  <p className="muted">
                    Para ejecutar la migración real, verifica que USE_FIREBASE
                    esté en true, que las credenciales existan y que la conexión
                    Firestore responda con ok.
                  </p>
                </div>

                <span className="badge warn">Requiere revisión</span>
              </div>
            )}

            {migrationSummary && (
              <div className="item">
                <div>
                  <strong>Última migración</strong>

                  <p className="muted">
                    Usuarios: {getMigrationValue(migrationSummary, "users")} ·
                    Materias: {getMigrationValue(migrationSummary, "materias")} ·
                    Calificaciones:{" "}
                    {getMigrationValue(migrationSummary, "calificaciones")}
                  </p>

                  <p className="muted">
                    Tareas: {getMigrationValue(migrationSummary, "tareas")} ·
                    Notificaciones:{" "}
                    {getMigrationValue(migrationSummary, "notificaciones")} ·
                    Actividad:{" "}
                    {getMigrationValue(migrationSummary, "actividad")}
                  </p>

                  <p className="muted">
                    Recursos: {getMigrationValue(migrationSummary, "recursos")} ·
                    Calendario:{" "}
                    {getMigrationValue(migrationSummary, "calendario")}
                  </p>
                </div>

                <span className="badge ok">Completada</span>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Información del proyecto</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Nombre del sistema</strong>

                <p className="muted">
                  Punto y Coma — Plataforma de seguimiento académico.
                </p>
              </div>

              <span className="badge ok">v1.0</span>
            </div>

            <div className="item">
              <div>
                <strong>Objetivo</strong>

                <p className="muted">
                  Gestionar calificaciones, detectar riesgo académico y generar
                  planes de mejora.
                </p>
              </div>

              <span className="badge">Académico</span>
            </div>

            <div className="item">
              <div>
                <strong>Arquitectura</strong>

                <p className="muted">
                  Cliente React, servidor Node.js, API REST, autenticación JWT y
                  almacenamiento modular.
                </p>
              </div>

              <span className="badge ok">Cliente-servidor</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Apariencia</h2>

          <div className="item">
            <div>
              <strong>{getThemeLabel(theme)}</strong>

              <p className="muted">
                Cambia entre modo claro y oscuro para adaptar la interfaz a la
                presentación o uso diario.
              </p>
            </div>

            <button type="button" onClick={handleToggleTheme}>
              Cambiar tema
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Roles y permisos</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Alumno</strong>

                <p className="muted">
                  Consulta calificaciones, promedio, riesgo académico, tareas y
                  notificaciones.
                </p>
              </div>

              <span className="badge ok">Lectura</span>
            </div>

            <div className="item">
              <div>
                <strong>Maestro</strong>

                <p className="muted">
                  Captura calificaciones, crea tareas y da seguimiento a
                  alumnos.
                </p>
              </div>

              <span className="badge warn">Gestión</span>
            </div>

            <div className="item">
              <div>
                <strong>Administrador</strong>

                <p className="muted">
                  Gestiona materias, maestros, asignaciones, actividad y
                  configuración general.
                </p>
              </div>

              <span className="badge bad">Control total</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Reglas académicas</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Calificación válida</strong>

                <p className="muted">
                  El sistema acepta valores numéricos desde 0 hasta 10.
                </p>
              </div>

              <span className="badge">0 - 10</span>
            </div>

            <div className="item">
              <div>
                <strong>Riesgo alto</strong>

                <p className="muted">
                  Promedio menor a 6 o materias críticas con bajo rendimiento.
                </p>
              </div>

              <span className="badge bad">Menor a 6</span>
            </div>

            <div className="item">
              <div>
                <strong>En observación</strong>

                <p className="muted">
                  Promedios entre 6 y 7.99 requieren seguimiento constante.
                </p>
              </div>

              <span className="badge warn">6 - 7.99</span>
            </div>

            <div className="item">
              <div>
                <strong>Rendimiento estable</strong>

                <p className="muted">
                  Promedios iguales o superiores a 8 se consideran favorables.
                </p>
              </div>

              <span className="badge ok">8 - 10</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Preparación para Firebase</h2>

          <div className="lista">
            <div className="item">
              <div>
                <strong>Fase 1 · Configuración</strong>

                <p className="muted">
                  Firebase Admin SDK instalado, configuración separada y
                  variables de entorno preparadas.
                </p>
              </div>

              <span className="badge ok">Lista</span>
            </div>

            <div className="item">
              <div>
                <strong>Fase 2 · Firestore</strong>

                <p className="muted">
                  Servicio firestoreStore.js creado para migrar colecciones de
                  forma gradual.
                </p>
              </div>

              <span className="badge warn">Preparada</span>
            </div>

            <div className="item">
              <div>
                <strong>Fase 3 · Migración</strong>

                <p className="muted">
                  El cambio real a Firestore debe hacerse por módulos para no
                  romper rutas actuales.
                </p>
              </div>

              <span className="badge">Siguiente</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}