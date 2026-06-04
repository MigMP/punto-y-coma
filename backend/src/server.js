const app = require("./app");
const { PORT, NODE_ENV } = require("./config/env");

app.listen(PORT, () => {
  if (NODE_ENV !== "production") {
    console.log(`Servidor iniciado en puerto ${PORT}`);
  }
});