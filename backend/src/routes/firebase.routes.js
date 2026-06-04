const fs = require("fs");
const path = require("path");
const express = require("express");

const { auth, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../utils/roles");
const { loadDB } = require("../db/jsonStore");
const { saveFirebaseDB } = require("../db/firestoreStore");

const {
  USE_FIREBASE,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} = require("../config/env");

const { shouldUseFirebase, getFirestore } = require("../config/firebase");

const router = express.Router();

function getServiceAccountStatus() {
  if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
    return {
      serviceAccountPathConfigurado: false,
      serviceAccountExiste: false,
    };
  }

  const fullPath = path.isAbsolute(FIREBASE_SERVICE_ACCOUNT_PATH)
    ? FIREBASE_SERVICE_ACCOUNT_PATH
    : path.resolve(process.cwd(), FIREBASE_SERVICE_ACCOUNT_PATH);

  return {
    serviceAccountPathConfigurado: true,
    serviceAccountExiste: fs.existsSync(fullPath),
  };
}

router.get("/firebase/status", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  const enabled = shouldUseFirebase();
  const serviceAccount = getServiceAccountStatus();

  const status = {
    firebasePreparado: true,
    modoActual: enabled ? "firebase" : "json_local",
    useFirebase: USE_FIREBASE,
    serviceAccountPathConfigurado: serviceAccount.serviceAccountPathConfigurado,
    serviceAccountExiste: serviceAccount.serviceAccountExiste,
    projectIdConfigurado: Boolean(FIREBASE_PROJECT_ID),
    clientEmailConfigurado: Boolean(FIREBASE_CLIENT_EMAIL),
    privateKeyConfigurada: Boolean(FIREBASE_PRIVATE_KEY),
    credencialesModo: serviceAccount.serviceAccountPathConfigurado
      ? "service_account_file"
      : "variables_env",
    mensaje: enabled
      ? "Firebase está activado. El backend intentará usar Firestore."
      : "Firebase está preparado, pero el sistema sigue usando JSON local.",
  };

  if (!enabled) {
    return res.json(status);
  }

  try {
    const db = getFirestore();

    await db.collection("_diagnostico").doc("status").set(
      {
        ok: true,
        checkedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.json({
      ...status,
      conexionFirestore: "ok",
    });
  } catch (error) {
    return res.status(500).json({
      ...status,
      conexionFirestore: "error",
      error: error.message,
    });
  }
});

router.post("/firebase/migrate-json", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  if (!shouldUseFirebase()) {
    return res.status(400).json({
      error: "Firebase no está activado.",
      detalle: "Para migrar datos, configura USE_FIREBASE=true en el archivo .env.",
    });
  }

  try {
    const jsonData = loadDB();

    const resumen = {
      users: jsonData.users.length,
      materias: jsonData.materias.length,
      calificaciones: jsonData.calificaciones.length,
      asignaciones: jsonData.asignaciones.length,
      actividad: jsonData.actividad.length,
      tareas: jsonData.tareas.length,
      notificaciones: jsonData.notificaciones.length,
    };

    await saveFirebaseDB(jsonData);

    return res.json({
      ok: true,
      message: "Datos migrados de JSON local a Firestore correctamente.",
      resumen,
      migratedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo migrar JSON a Firebase.",
      detalle: error.message,
    });
  }
});

module.exports = router;