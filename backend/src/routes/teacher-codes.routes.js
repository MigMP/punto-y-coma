// Archivo: backend/src/routes/teacher-codes.routes.js

const express = require("express");

const { auth, requireRole } = require("../middlewares/auth");
const { getCollection, saveDocument } = require("../db/firestoreStore");
const nextId = require("../utils/nextId");
const { ROLES } = require("../utils/roles");

const router = express.Router();

const CODE_PREFIX = "MTR-CECYT5-2026";

function randomChunk(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";

  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }

  return value;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function publicTeacherCode(item) {
  return {
    id: item.id,
    code: item.code,
    used: Boolean(item.used),
    usedBy: item.usedBy || "",
    usedAt: item.usedAt || "",
    createdBy: item.createdBy || "",
    createdAt: item.createdAt || "",
    status: item.status || (item.used ? "used" : "active"),
  };
}

async function generateUniqueCode(existingCodes) {
  const usedCodes = new Set(
    existingCodes.map((item) => normalizeCode(item.code)).filter(Boolean)
  );

  for (let tries = 0; tries < 30; tries += 1) {
    const code = `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}`;

    if (!usedCodes.has(code)) {
      return code;
    }
  }

  throw new Error("No se pudo generar un código único");
}

router.get(
  "/teacher-codes",
  auth,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      const teacherCodes = await getCollection("teacherCodes");

      const items = teacherCodes
        .slice()
        .sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        )
        .map(publicTeacherCode);

      return res.json({
        ok: true,
        total: items.length,
        items,
      });
    } catch (error) {
      return res.status(500).json({
        error: "No se pudieron cargar los códigos docentes",
        detalle: error.message,
      });
    }
  }
);

router.post(
  "/teacher-codes",
  auth,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      const teacherCodes = await getCollection("teacherCodes");
      const now = new Date().toISOString();

      const code = await generateUniqueCode(teacherCodes);

      const item = {
        id: nextId(teacherCodes),
        code,
        used: false,
        usedBy: "",
        usedAt: "",
        status: "active",
        createdBy: req.user.email,
        createdAt: now,
        updatedAt: now,
      };

      await saveDocument("teacherCodes", item);

      return res.status(201).json({
        ok: true,
        item: publicTeacherCode(item),
      });
    } catch (error) {
      return res.status(500).json({
        error: "No se pudo generar el código docente",
        detalle: error.message,
      });
    }
  }
);

router.delete(
  "/teacher-codes/:id",
  auth,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const teacherCodes = await getCollection("teacherCodes");

      if (!id) {
        return res.status(400).json({
          error: "ID inválido",
        });
      }

      const item = teacherCodes.find(
        (code) => String(code.id) === id || Number(code.id) === Number(id)
      );

      if (!item) {
        return res.status(404).json({
          error: "Código docente no encontrado",
        });
      }

      if (item.used || item.status === "canceled") {
        return res.status(409).json({
          error: "No puedes cancelar un código que ya fue usado o cancelado",
        });
      }

      const now = new Date().toISOString();

      const updated = {
        ...item,
        used: true,
        usedBy: "CANCELADO POR ADMIN",
        usedAt: now,
        status: "canceled",
        updatedAt: now,
      };

      await saveDocument("teacherCodes", updated);

      return res.json({
        ok: true,
        item: publicTeacherCode(updated),
      });
    } catch (error) {
      return res.status(500).json({
        error: "No se pudo cancelar el código docente",
        detalle: error.message,
      });
    }
  }
);

module.exports = router;