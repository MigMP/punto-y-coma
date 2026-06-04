const fs = require("fs");
const path = require("path");

const { DATA_PATH } = require("../config/env");

const EMPTY_DB = {
  users: [],
  materias: [],
  calificaciones: [],
  asignaciones: [],
  actividad: [],
  tareas: [],
  notificaciones: [],
};

function ensureFile() {
  const dir = path.dirname(DATA_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

function normalizeDB(parsed = {}) {
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    materias: Array.isArray(parsed.materias) ? parsed.materias : [],
    calificaciones: Array.isArray(parsed.calificaciones) ? parsed.calificaciones : [],
    asignaciones: Array.isArray(parsed.asignaciones) ? parsed.asignaciones : [],
    actividad: Array.isArray(parsed.actividad) ? parsed.actividad : [],
    tareas: Array.isArray(parsed.tareas) ? parsed.tareas : [],
    notificaciones: Array.isArray(parsed.notificaciones) ? parsed.notificaciones : [],
  };
}

function backupBrokenFile() {
  if (!fs.existsSync(DATA_PATH)) return;

  const dir = path.dirname(DATA_PATH);
  const base = path.basename(DATA_PATH, ".json");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(dir, `${base}.broken-${stamp}.json`);

  fs.copyFileSync(DATA_PATH, backupPath);
}

function loadDB() {
  ensureFile();

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return normalizeDB(JSON.parse(raw));
  } catch {
    backupBrokenFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
    return { ...EMPTY_DB };
  }
}

function saveDB(db) {
  ensureFile();

  const normalized = normalizeDB(db);
  const tempPath = `${DATA_PATH}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(tempPath, DATA_PATH);
}

module.exports = {
  loadDB,
  saveDB,
};
