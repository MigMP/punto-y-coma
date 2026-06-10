// Archivo: backend/src/db/firestoreStore.js

const { getFirestore, shouldUseFirebase } = require("../config/firebase");

const COLLECTIONS = Object.freeze({
  users: "users",
  materias: "materias",
  calificaciones: "calificaciones",
  asignaciones: "asignaciones",
  actividad: "actividad",
  tareas: "tareas",
  notificaciones: "notificaciones",
  recursos: "recursos",
  calendario: "calendario",
  teacherCodes: "teacherCodes",
});

function assertFirebaseEnabled() {
  if (!shouldUseFirebase()) {
    throw new Error("Firebase no está activado. Usa USE_FIREBASE=true en .env");
  }
}

async function getCollection(name) {
  assertFirebaseEnabled();

  const db = getFirestore();
  const snapshot = await db.collection(name).orderBy("id", "asc").get();

  return snapshot.docs.map((doc) => ({
    firestoreId: doc.id,
    ...doc.data(),
  }));
}

async function saveDocument(name, item) {
  assertFirebaseEnabled();

  if (!item || item.id === undefined || item.id === null) {
    throw new Error(`No se puede guardar en ${name}: falta id`);
  }

  const db = getFirestore();
  const id = String(item.id);

  await db.collection(name).doc(id).set(item, { merge: true });

  return item;
}

async function deleteDocument(name, id) {
  assertFirebaseEnabled();

  const db = getFirestore();

  await db.collection(name).doc(String(id)).delete();

  return true;
}

async function loadFirebaseDB() {
  assertFirebaseEnabled();

  const [
    users,
    materias,
    calificaciones,
    asignaciones,
    actividad,
    tareas,
    notificaciones,
    recursos,
    calendario,
    teacherCodes,
  ] = await Promise.all([
    getCollection(COLLECTIONS.users),
    getCollection(COLLECTIONS.materias),
    getCollection(COLLECTIONS.calificaciones),
    getCollection(COLLECTIONS.asignaciones),
    getCollection(COLLECTIONS.actividad),
    getCollection(COLLECTIONS.tareas),
    getCollection(COLLECTIONS.notificaciones),
    getCollection(COLLECTIONS.recursos),
    getCollection(COLLECTIONS.calendario),
    getCollection(COLLECTIONS.teacherCodes),
  ]);

  return {
    users,
    materias,
    calificaciones,
    asignaciones,
    actividad,
    tareas,
    notificaciones,
    recursos,
    calendario,
    teacherCodes,
  };
}

async function saveFirebaseDB(dbData) {
  assertFirebaseEnabled();

  const collections = [
    COLLECTIONS.users,
    COLLECTIONS.materias,
    COLLECTIONS.calificaciones,
    COLLECTIONS.asignaciones,
    COLLECTIONS.actividad,
    COLLECTIONS.tareas,
    COLLECTIONS.notificaciones,
    COLLECTIONS.recursos,
    COLLECTIONS.calendario,
    COLLECTIONS.teacherCodes,
  ];

  for (const collectionName of collections) {
    const items = Array.isArray(dbData[collectionName])
      ? dbData[collectionName]
      : [];

    for (const item of items) {
      if (item && item.id !== undefined && item.id !== null) {
        await saveDocument(collectionName, item);
      }
    }
  }

  return true;
}

module.exports = {
  COLLECTIONS,
  getCollection,
  saveDocument,
  deleteDocument,
  loadFirebaseDB,
  saveFirebaseDB,
};