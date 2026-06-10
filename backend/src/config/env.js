// Archivo: backend/src/config/env.js

const path = require("path");

try {
  require("dotenv").config({
    path: path.join(__dirname, "../../.env"),
  });
} catch {
  // dotenv es opcional para ejecución local
}

function readBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function readPrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function readPort(value, defaultValue = 3001) {
  const port = Number(value || defaultValue);

  if (!Number.isInteger(port) || port <= 0) {
    return defaultValue;
  }

  return port;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = readPort(process.env.PORT, 3001);

const JWT_SECRET =
  process.env.JWT_SECRET || "calificaciones_secret_cambia_esto_en_desarrollo";

const DATA_PATH =
  process.env.DATA_PATH || path.join(__dirname, "../../data/data.json");

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

/*
  El proyecto actual está pensado para usar Firestore.
  Por eso el valor por defecto es true.
  Si algún día quieres probar con JSON local, pon USE_FIREBASE=false en .env.
*/
const USE_FIREBASE = readBoolean(process.env.USE_FIREBASE, true);

const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const FIREBASE_PRIVATE_KEY = readPrivateKey(
  process.env.FIREBASE_PRIVATE_KEY || ""
);

if (
  NODE_ENV === "production" &&
  JWT_SECRET === "calificaciones_secret_cambia_esto_en_desarrollo"
) {
  throw new Error("JWT_SECRET debe configurarse en producción.");
}

module.exports = {
  NODE_ENV,
  PORT,
  JWT_SECRET,
  DATA_PATH,
  CLIENT_ORIGIN,
  USE_FIREBASE,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
};