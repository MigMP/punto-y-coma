// Archivo: backend/src/server.js

const app = require("./app");
const { PORT, NODE_ENV } = require("./config/env");

app.listen(PORT, () => {
  console.log(
    `Servidor Punto y Coma iniciado en puerto ${PORT} - entorno: ${
      NODE_ENV || "development"
    }`
  );
});