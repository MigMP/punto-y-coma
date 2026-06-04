const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../config/env");
const { getCollection, saveDocument } = require("../db/firestoreStore");
const nextId = require("../utils/nextId");
const { isValidRole, ROLES } = require("../utils/roles");

const router = express.Router();

const ALUMNO_EMAIL_RE = /^[^\s@]+@alumno\.ipn\.mx$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    grupo: user.grupo || "",
    boleta: user.boleta || "",
    status: user.status || "active",
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status || "active",
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const users = await getCollection("users");

    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = String(req.body.role || "").trim();
    const grupo = String(req.body.grupo || "").trim().toUpperCase();
    const boleta = String(req.body.boleta || "").replace(/\D/g, "").slice(0, 10);

    if (!name) {
      return res.status(400).json({
        error: "Nombre obligatorio",
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        error: "Correo inválido",
      });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({
        error: "Contraseña mínimo 4 caracteres",
      });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({
        error: "Rol inválido",
      });
    }

    /*
      Seguridad importante:
      No se permite crear administradores desde el registro público.
      Los administradores deben crearse manualmente desde Firebase/Firestore
      cambiando el campo role a "administrador".
    */
    if (role === ROLES.ADMIN) {
      return res.status(403).json({
        error: "No se pueden crear cuentas de administrador desde el registro",
      });
    }

    /*
      Solo permitimos registro público de:
      - alumno
      - maestro
    */
    if (![ROLES.ALUMNO, ROLES.MAESTRO].includes(role)) {
      return res.status(400).json({
        error: "Solo puedes registrarte como alumno o maestro",
      });
    }

    if (role === ROLES.ALUMNO) {
      if (!ALUMNO_EMAIL_RE.test(email)) {
        return res.status(400).json({
          error:
            "Como alumno, debes registrarte con tu correo institucional @alumno.ipn.mx",
        });
      }

      if (!grupo) {
        return res.status(400).json({
          error: "Grupo obligatorio",
        });
      }

      if (boleta.length !== 10) {
        return res.status(400).json({
          error: "Boleta debe tener 10 dígitos",
        });
      }
    }

    const exists = users.some((user) => normalizeEmail(user.email) === email);

    if (exists) {
      return res.status(409).json({
        error: "Ese correo ya está registrado",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user = {
      id: nextId(users),
      name,
      email,
      passwordHash,
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(role === ROLES.ALUMNO
        ? {
            grupo,
            boleta,
          }
        : {
            grupo: "",
            boleta: "",
          }),
    };

    await saveDocument("users", user);

    return res.status(201).json({
      ok: true,
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo registrar el usuario",
      detalle: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const users = await getCollection("users");

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!EMAIL_RE.test(email) || !password) {
      return res.status(400).json({
        error: "Correo y contraseña obligatorios",
      });
    }

    const user = users.find((item) => normalizeEmail(item.email) === email);

    if (!user) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    if (user.status && user.status !== "active") {
      return res.status(403).json({
        error: "Cuenta desactivada",
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || "");

    if (!ok) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    const token = createToken(user);

    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo iniciar sesión",
      detalle: error.message,
    });
  }
});

module.exports = router;