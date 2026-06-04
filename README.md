# Punto y Coma — Plataforma de Seguimiento Académico

**Punto y Coma** es una plataforma web académica enfocada en el seguimiento del rendimiento estudiantil. El sistema permite gestionar usuarios por rol, administrar materias, asignar docentes, capturar calificaciones, detectar riesgo académico, generar planes de estudio, registrar tareas, mostrar notificaciones y preparar la migración de datos hacia Firebase Firestore.

El proyecto está construido con arquitectura cliente-servidor, usando **React + Vite** en el frontend y **Node.js + Express** en el backend.

---

## Objetivo del sistema

El objetivo principal es brindar una herramienta académica que permita:

* Dar seguimiento al desempeño de los alumnos.
* Identificar materias en riesgo.
* Facilitar la captura y consulta de calificaciones.
* Generar recomendaciones de estudio.
* Centralizar tareas académicas y notificaciones.
* Ofrecer una base preparada para migración a Firebase / Firestore.

---

## Características principales

* Autenticación con JWT.
* Registro e inicio de sesión.
* Control de acceso basado en roles.
* Dashboard dinámico según tipo de usuario.
* Gestión de materias.
* Gestión de maestros.
* Asignación de materias a maestros.
* Captura, edición y eliminación de calificaciones.
* Expediente individual de alumnos.
* Análisis de promedio general.
* Detección de materias en riesgo.
* Semáforo académico.
* Generador de plan de estudio.
* Módulo de tareas académicas.
* Módulo de notificaciones.
* Historial de actividad del sistema.
* Reportes académicos.
* Configuración técnica del sistema.
* Modo claro / oscuro.
* Interfaz responsive.
* Preparación para Firebase Admin SDK y Firestore.
* Migración JSON local → Firestore.

---

## Roles disponibles

### Administrador

El administrador tiene control general sobre la estructura académica.

Funciones principales:

* Gestionar materias.
* Consultar maestros registrados.
* Crear asignaciones entre maestros y materias.
* Consultar alumnos.
* Revisar reportes.
* Consultar historial de actividad.
* Revisar notificaciones del sistema.
* Ver estado técnico del backend.
* Ver estado de Firebase.
* Ejecutar migración JSON local → Firestore cuando Firebase está activo.

---

### Maestro

El maestro puede dar seguimiento académico a los alumnos según sus materias asignadas.

Funciones principales:

* Ver materias asignadas.
* Capturar calificaciones.
* Editar calificaciones.
* Eliminar calificaciones.
* Consultar alumnos evaluados.
* Crear tareas académicas.
* Eliminar tareas.
* Ver reportes.
* Recibir notificaciones relacionadas con seguimiento académico.

---

### Alumno

El alumno puede consultar su estado académico y dar seguimiento a sus actividades.

Funciones principales:

* Consultar calificaciones.
* Ver promedio general.
* Revisar materias en riesgo.
* Consultar estado académico.
* Ver plan de estudio recomendado.
* Consultar tareas asignadas.
* Cambiar estado de tareas.
* Ver notificaciones.

---

## Módulos del sistema

### Dashboard

Pantalla principal del sistema. Su contenido cambia según el rol del usuario.

Incluye:

* Resumen académico.
* Resumen administrativo.
* Resumen docente.
* Tareas recientes.
* Notificaciones recientes.
* Actividad académica.
* Accesos rápidos.

---

### Administración

Módulo disponible para administradores.

Permite:

* Crear materias.
* Consultar docentes.
* Asignar materias a maestros.
* Eliminar asignaciones.
* Preparar la estructura académica antes de capturar calificaciones.

---

### Captura de calificaciones

Módulo disponible para maestros.

Permite:

* Registrar calificaciones.
* Editar calificaciones existentes.
* Eliminar calificaciones.
* Validar que las calificaciones estén entre 0 y 10.
* Registrar actividad en el historial.
* Generar notificaciones automáticas.

---

### Plan de estudio

Módulo disponible para alumnos.

Permite:

* Consultar recomendaciones académicas.
* Ver materias prioritarias.
* Revisar plan semanal.
* Identificar áreas de mejora.

---

### Alumnos

Módulo disponible para maestros y administradores.

Permite:

* Consultar alumnos registrados.
* Buscar alumnos.
* Revisar información académica.
* Entrar al expediente individual del alumno.

---

### Expediente individual

Pantalla de detalle de cada alumno.

Incluye:

* Información general del alumno.
* Calificaciones.
* Promedio.
* Materias en riesgo.
* Seguimiento académico.
* Acceso a tareas y reportes relacionados.

---

### Tareas académicas

Módulo para seguimiento de actividades de mejora.

Permite:

* Crear tareas para alumnos.
* Consultar tareas por rol.
* Filtrar tareas por estado.
* Buscar tareas.
* Cambiar estado: pendiente, en progreso o completada.
* Copiar resumen.
* Imprimir tareas.
* Registrar actividad.
* Generar notificaciones automáticas.

---

### Notificaciones

Módulo de avisos internos.

Permite:

* Ver notificaciones por usuario o rol.
* Filtrar todas / no leídas.
* Buscar notificaciones.
* Marcar una notificación como leída.
* Marcar todas como leídas.
* Copiar resumen.
* Imprimir notificaciones.

Ejemplos de notificaciones:

* Nueva tarea académica.
* Tarea actualizada.
* Tarea eliminada.
* Nueva calificación registrada.
* Calificación actualizada.
* Calificación eliminada.

---

### Historial de actividad

Módulo disponible para administradores.

Registra eventos importantes como:

* Materia creada.
* Materia eliminada.
* Asignación creada.
* Asignación eliminada.
* Calificación registrada.
* Calificación editada.
* Calificación eliminada.
* Tarea creada.
* Tarea actualizada.
* Tarea eliminada.

---

### Reportes

Módulo disponible para maestros y administradores.

Permite:

* Consultar información académica.
* Revisar registros.
* Exportar o copiar información.
* Apoyar la toma de decisiones.

---

### Configuración

Módulo técnico del sistema.

Incluye:

* Estado del frontend.
* Estado del backend.
* Tipo de autenticación.
* Tipo de persistencia.
* Estado de Firebase.
* Modo de credenciales.
* Conexión Firestore.
* Migración JSON local → Firestore.
* Información del proyecto.
* Roles y permisos.
* Reglas académicas.
* Cambio de tema claro / oscuro.

---

## Tecnologías utilizadas

### Frontend

* React
* Vite
* React Router
* CSS modular por secciones
* LocalStorage para sesión y tema
* Consumo centralizado de API

### Backend

* Node.js
* Express
* JWT
* bcryptjs
* CORS
* dotenv
* Firebase Admin SDK

### Persistencia

Actualmente el sistema usa:

* JSON local para demo y pruebas.

Archivo principal:

```txt
backend/data/data.json
```

También está preparado para:

* Firebase Firestore.
* Migración JSON local → Firestore.
* Diagnóstico de conexión Firebase.

---

## Arquitectura del proyecto

```txt
punto-y-coma-academico/
├── backend/
│   ├── data/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   └── firebase.js
│   │   ├── db/
│   │   │   ├── jsonStore.js
│   │   │   └── firestoreStore.js
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── app.js
│   ├── .env.example
│   ├── FIREBASE_SETUP.md
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── state/
│   │   ├── styles/
│   │   └── utils/
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

---

## Instalación

Desde la carpeta raíz del proyecto:

```bash
npm run install:all
```

Instalación manual:

```bash
cd backend
npm install

cd ../frontend
npm install
```

---

## Ejecutar proyecto

Desde la raíz:

```bash
npm run dev
```

También puede ejecutarse por separado:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Rutas locales:

```txt
Frontend: http://localhost:5173
Backend: http://localhost:3001
Health Check: http://localhost:3001/api/health
```

---

## Variables de entorno

El backend usa un archivo `.env` dentro de la carpeta `backend`.

Ejemplo:

```env
PORT=3001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=punto_y_coma_2026_secret_local
DATA_PATH=./data/data.json

USE_FIREBASE=false
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Importante:

```txt
backend/.env
```

No debe subirse a GitHub.

---

## Firebase / Firestore

El sistema está preparado para usar Firebase mediante Admin SDK.

Archivos relacionados:

```txt
backend/src/config/firebase.js
backend/src/db/firestoreStore.js
backend/src/routes/firebase.routes.js
backend/FIREBASE_SETUP.md
```

Funciones disponibles:

* Diagnóstico de Firebase.
* Verificación de credenciales.
* Verificación de conexión Firestore.
* Migración JSON local → Firestore.

Ruta de diagnóstico:

```http
GET /api/firebase/status
```

Ruta de migración:

```http
POST /api/firebase/migrate-json
```

La migración solo funciona cuando:

```env
USE_FIREBASE=true
```

---

## Seguridad

El archivo `.gitignore` debe proteger archivos sensibles:

```gitignore
node_modules/
dist/
build/
.vite/
.env
.env.local
backend/.env
serviceAccountKey.json
firebase-service-account.json
backend/serviceAccountKey.json
backend/firebase-service-account.json
backend/*.json.key
```

Nunca se deben subir:

* Llaves privadas.
* Archivos de service account.
* `.env` reales.
* Credenciales de Firebase.

---

## Cuentas demo

Contraseña general:

```txt
1234
```

Usuarios sugeridos:

```txt
Administrador:
admin@test.com

Maestro:
maestro@test.com

Alumno:
miguel@alumno.ipn.mx
```

---

## Flujo recomendado de demostración

1. Iniciar sesión como administrador.
2. Revisar el dashboard administrativo.
3. Crear materias.
4. Revisar maestros.
5. Asignar materias a maestros.
6. Consultar actividad del sistema.
7. Revisar configuración y estado de Firebase.
8. Iniciar sesión como maestro.
9. Capturar calificaciones.
10. Crear tareas académicas.
11. Iniciar sesión como alumno.
12. Consultar promedio y materias en riesgo.
13. Revisar plan de estudio.
14. Cambiar estado de tareas.
15. Consultar notificaciones.
16. Volver como admin y revisar historial de actividad.

---

## Reglas académicas

* Las calificaciones válidas van de 0 a 10.
* Promedio menor a 6 se considera riesgo alto.
* Promedio entre 6 y 7.99 se considera en observación.
* Promedio igual o mayor a 8 se considera rendimiento estable.
* Las tareas pueden estar en estado pendiente, en progreso o completada.

---

## Estado del proyecto

Versión actual:

```txt
1.0 estable
```

Implementado:

* Autenticación.
* Roles.
* Dashboard por rol.
* Administración de materias.
* Asignación de docentes.
* Captura de calificaciones.
* Expediente de alumnos.
* Reportes.
* Plan de estudio.
* Tareas académicas.
* Notificaciones.
* Historial de actividad.
* Configuración técnica.
* Firebase Admin SDK.
* Migración JSON local → Firestore.
* Modo claro / oscuro.

---

## Próximas mejoras

* Migración completa de rutas principales a Firestore.
* Recuperación de contraseña.
* Exportación avanzada de reportes.
* Gráficas visuales de desempeño.
* Calendario académico.
* Recursos de apoyo por materia.
* Buscador global.
* Despliegue en hosting.

---

## Nota técnica

Actualmente el proyecto conserva JSON local como persistencia principal para mantener estable la demo. Firebase ya se encuentra configurado y probado mediante Admin SDK, con conexión Firestore activa y migración de datos disponible.

La migración completa a Firestore debe realizarse de forma gradual por módulos, debido a que varias rutas actuales usan funciones síncronas `loadDB()` y `saveDB()`, mientras Firestore trabaja de forma asíncrona.

---

## Autor

Proyecto académico desarrollado como plataforma de seguimiento estudiantil para gestión de calificaciones, tareas, notificaciones y análisis de riesgo académico.
