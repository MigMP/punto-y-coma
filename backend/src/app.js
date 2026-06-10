// Archivo: backend/src/app.js

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { CLIENT_ORIGIN, NODE_ENV } = require("./config/env");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const subjectsRoutes = require("./routes/subjects.routes");
const assignmentsRoutes = require("./routes/assignments.routes");
const gradesRoutes = require("./routes/grades.routes");
const activityRoutes = require("./routes/activity.routes");
const tasksRoutes = require("./routes/tasks.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const firebaseRoutes = require("./routes/firebase.routes");
const calendarRoutes = require("./routes/calendar.routes");
const resourcesRoutes = require("./routes/resources.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const teacherCodesRoutes = require("./routes/teacher-codes.routes");
const reportsRoutes = require("./routes/reports.routes");
const scheduleRoutes = require("./routes/schedule.routes");

const app = express();

const allowedOrigins = [
  CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "JSON inválido en la petición",
    });
  }

  next(err);
});

/*
  Ruta principal para comprobar que el backend funciona.
  Esta ruta sirve para tomar la captura de evidencia JSON.
*/
app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Backend funcionando correctamente",
    proyecto: "Punto y Coma",
    servidor: "Node.js",
    entorno: NODE_ENV || "development",
  });
});

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", subjectsRoutes);
app.use("/api", assignmentsRoutes);
app.use("/api", gradesRoutes);
app.use("/api", activityRoutes);
app.use("/api", tasksRoutes);
app.use("/api", notificationsRoutes);
app.use("/api", firebaseRoutes);
app.use("/api", calendarRoutes);
app.use("/api", resourcesRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", teacherCodesRoutes);
app.use("/api", reportsRoutes);
app.use("/api", scheduleRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  if (NODE_ENV !== "production") {
    console.error(err);
  }

  if (err.message === "Origen no permitido por CORS") {
    return res.status(403).json({
      error: "Origen no permitido por CORS",
    });
  }

  res.status(500).json({
    error: "Error interno del servidor",
  });
});

module.exports = app;
