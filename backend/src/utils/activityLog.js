const nextId = require("./nextId");

function actorFromRequest(req) {
  return {
    id: req.user?.id || null,
    name: req.user?.name || "Usuario",
    email: req.user?.email || "",
    role: req.user?.role || "desconocido",
  };
}

function addActivity(db, req, data = {}) {
  if (!Array.isArray(db.actividad)) {
    db.actividad = [];
  }

  const now = new Date().toISOString();

  const item = {
    id: nextId(db.actividad),
    type: data.type || "system",
    title: data.title || "Actividad registrada",
    description: data.description || "",
    entity: data.entity || "",
    entityId: data.entityId || null,
    actor: actorFromRequest(req),
    createdAt: now,
  };

  db.actividad.unshift(item);

  db.actividad = db.actividad.slice(0, 200);

  return item;
}

module.exports = {
  addActivity,
};