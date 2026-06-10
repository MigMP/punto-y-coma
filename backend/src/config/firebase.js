// Archivo: backend/src/config/firebase.js

const admin = require("firebase-admin");
const path = require("path");

const {
  USE_FIREBASE,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} = require("./env");

let db = null;

function shouldUseFirebase() {
  return USE_FIREBASE === true;
}

function getServiceAccountFromFile() {
  if (!FIREBASE_SERVICE_ACCOUNT_PATH) return null;

  const fullPath = path.isAbsolute(FIREBASE_SERVICE_ACCOUNT_PATH)
    ? FIREBASE_SERVICE_ACCOUNT_PATH
    : path.join(__dirname, "../../", FIREBASE_SERVICE_ACCOUNT_PATH);

  try {
    return require(fullPath);
  } catch (error) {
    throw new Error(
      `No se pudo leer el archivo de credenciales Firebase: ${error.message}`
    );
  }
}

function getFirebaseCredential() {
  const serviceAccount = getServiceAccountFromFile();

  if (serviceAccount) {
    return admin.credential.cert(serviceAccount);
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      "Faltan credenciales Firebase. Configura FIREBASE_SERVICE_ACCOUNT_PATH o las variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY."
    );
  }

  return admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY,
  });
}

function getFirebaseApp() {
  if (!shouldUseFirebase()) {
    return null;
  }

  if (admin.apps.length > 0) {
    return admin.app();
  }

  return admin.initializeApp({
    credential: getFirebaseCredential(),
  });
}

function getFirestore() {
  if (!shouldUseFirebase()) {
    return null;
  }

  if (db) {
    return db;
  }

  getFirebaseApp();
  db = admin.firestore();

  return db;
}

module.exports = {
  shouldUseFirebase,
  getFirebaseApp,
  getFirestore,
};