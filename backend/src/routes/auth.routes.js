// Archivo: backend/src/routes/auth.routes.js

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../config/env");
const { getCollection, saveDocument } = require("../db/firestoreStore");
const nextId = require("../utils/nextId");
const { isValidRole, ROLES } = require("../utils/roles");

const router = express.Router();

const ALUMNO_EMAIL_RE = /^[^\s@]+@alumno\.ipn\.mx$/i;
const MAESTRO_EMAIL_RE = /^[^\s@]+@ipn\.mx$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN_LENGTH = 8;

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_TIME_MS = 10 * 60 * 1000;

const loginAttempts = new Map();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTeacherCode(value) {
  return String(value || "").trim().toUpperCase();
}

function getLoginAttemptKey(email, req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  return `${normalizeEmail(email)}:${ip}`;
}

function getLoginBlockInfo(key) {
  const attempt = loginAttempts.get(key);

  if (!attempt) return null;

  if (attempt.blockedUntil && attempt.blockedUntil > Date.now()) {
    const remainingMs = attempt.blockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return {
      blocked: true,
      remainingMinutes,
    };
  }

  if (attempt.blockedUntil && attempt.blockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }

  return null;
}

function registerFailedLogin(key) {
  const current = loginAttempts.get(key) || {
    count: 0,
    blockedUntil: null,
  };

  const nextCount = current.count + 1;

  if (nextCount >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.set(key, {
      count: nextCount,
      blockedUntil: Date.now() + LOGIN_BLOCK_TIME_MS,
    });

    return true;
  }

  loginAttempts.set(key, {
    count: nextCount,
    blockedUntil: null,
  });

  return false;
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function validatePassword(password) {
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) {
    return "La contraseña debe incluir al menos una mayúscula";
  }

  if (!/[a-záéíóúñ]/.test(value)) {
    return "La contraseña debe incluir al menos una minúscula";
  }

  if (!/\d/.test(value)) {
    return "La contraseña debe incluir al menos un número";
  }

  return null;
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
    const role = normalizeRole(req.body.role);
    const grupo = String(req.body.grupo || "").trim().toUpperCase();
    const boleta = String(req.body.boleta || "").replace(/\D/g, "").slice(0, 10);
    const teacherCode = normalizeTeacherCode(req.body.teacherCode);

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

    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
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

    let teacherCodeItem = null;

    if (role === ROLES.MAESTRO) {
      if (!MAESTRO_EMAIL_RE.test(email)) {
        return res.status(400).json({
          error:
            "Como maestro, debes registrarte con tu correo institucional @ipn.mx",
        });
      }

      if (!teacherCode) {
        return res.status(400).json({
          error: "Código docente obligatorio",
        });
      }

      const teacherCodes = await getCollection("teacherCodes");

      teacherCodeItem = teacherCodes.find(
        (item) => normalizeTeacherCode(item.code) === teacherCode
      );

      if (!teacherCodeItem) {
        return res.status(403).json({
          error: "Código docente inválido",
        });
      }

      if (teacherCodeItem.used) {
        return res.status(409).json({
          error: "Este código docente ya fue usado",
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

    if (role === ROLES.MAESTRO && teacherCodeItem) {
      await saveDocument("teacherCodes", {
        ...teacherCodeItem,
        used: true,
        usedBy: email,
        usedAt: now,
        updatedAt: now,
      });
    }

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

    const attemptKey = getLoginAttemptKey(email, req);
    const blockInfo = getLoginBlockInfo(attemptKey);

    if (blockInfo?.blocked) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${blockInfo.remainingMinutes} minuto(s).`,
      });
    }

    if (!EMAIL_RE.test(email) || !password) {
      return res.status(400).json({
        error: "Correo y contraseña obligatorios",
      });
    }

    const user = users.find((item) => normalizeEmail(item.email) === email);

    if (!user) {
      registerFailedLogin(attemptKey);

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
      registerFailedLogin(attemptKey);

      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    clearLoginAttempts(attemptKey);

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