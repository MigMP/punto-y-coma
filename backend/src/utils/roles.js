const ROLES = Object.freeze({
  ALUMNO: "alumno",
  MAESTRO: "maestro",
  ADMIN: "administrador",
});

function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = {
  ROLES,
  isValidRole,
};
