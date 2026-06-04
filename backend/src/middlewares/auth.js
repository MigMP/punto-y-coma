const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../config/env");

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token requerido",
    });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Token vacío",
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };

    return next();
  } catch {
    return res.status(401).json({
      error: "Token inválido o expirado",
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "No autorizado",
        requiredRoles: roles,
      });
    }

    return next();
  };
}

module.exports = {
  auth,
  requireRole,
};