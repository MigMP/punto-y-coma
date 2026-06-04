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

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "calificaciones_secret_cambia_esto";

const DATA_PATH =
  process.env.DATA_PATH || path.join(__dirname, "../../data/data.json");

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const USE_FIREBASE = readBoolean(process.env.USE_FIREBASE, false);

const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const FIREBASE_PRIVATE_KEY = readPrivateKey(process.env.FIREBASE_PRIVATE_KEY || "");

if (NODE_ENV === "production" && JWT_SECRET === "calificaciones_secret_cambia_esto") {
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