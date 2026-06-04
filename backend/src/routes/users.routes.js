const express = require("express");
const bcrypt = require("bcryptjs");

const { getCollection, saveDocument } = require("../db/firestoreStore");
const { auth, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../utils/roles");

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    grupo: user.grupo || "",
    boleta: user.boleta || "",
    status: user.status || "active",
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || "",
  };
}

router.get("/me", auth, async (req, res) => {
  try {
    const users = await getCollection("users");

    const user = users.find(
      (item) => Number(item.id) === Number(req.user.id)
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    return res.json(publicUser(user));
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo consultar el usuario",
      detalle: error.message,
    });
  }
});

router.patch("/me/password", auth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: "Debes completar todos los campos",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener mínimo 4 caracteres",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: "La confirmación no coincide con la nueva contraseña",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: "La nueva contraseña debe ser diferente a la actual",
      });
    }

    const users = await getCollection("users");

    const user = users.find(
      (item) => Number(item.id) === Number(req.user.id)
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    if (user.status && user.status !== "active") {
      return res.status(403).json({
        error: "Cuenta desactivada",
      });
    }

    const passwordOk = await bcrypt.compare(
      currentPassword,
      user.passwordHash || ""
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: "La contraseña actual es incorrecta",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = {
      ...user,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };

    await saveDocument("users", updatedUser);

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
      user: publicUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo cambiar la contraseña",
      detalle: error.message,
    });
  }
});

router.get("/maestros", auth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await getCollection("users");

    const maestros = users
      .filter((user) => user.role === ROLES.MAESTRO)
      .map(publicUser);

    return res.json(maestros);
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar maestros",
      detalle: error.message,
    });
  }
});

router.get("/alumnos", auth, requireRole(ROLES.ADMIN, ROLES.MAESTRO), async (req, res) => {
  try {
    const users = await getCollection("users");

    const alumnos = users
      .filter((user) => user.role === ROLES.ALUMNO)
      .map(publicUser);

    return res.json(alumnos);
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron consultar alumnos",
      detalle: error.message,
    });
  }
});

module.exports = router;