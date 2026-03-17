/**
 * @file server.js
 * @description Punto de entrada de la aplicación PocketPal Finance.
 *
 * Responsabilidades:
 *   1. Cargar variables de entorno desde .env (dotenv).
 *   2. Inicializar el esquema de base de datos (crear tablas si no existen).
 *   3. Arrancar el servidor HTTP en el puerto configurado.
 *
 * Si cualquier paso falla (DB no disponible, puerto en uso), el proceso
 * termina con exit(1) para que gestores de procesos como PM2 reinicien.
 *
 * Inicio del cron de sincronización de Gmail:
 *   Se importa startSyncCron() del jobs/syncCron.js y se llama después de
 *   que el servidor esté escuchando.
 */

/*import "dotenv/config"; // Cargar .env ANTES de cualquier otro import

import { app } from "./src/app.js";
import { initializeDatabase } from "./src/db/init.js";
import { startSyncCron } from "./src/jobs/syncCron.js";

const PORT = process.env.PORT || 3000;

/**
 * Arranca la aplicación:
 *   1. Inicializa la base de datos (tablas + categorías por defecto).
 *   2. Inicia el servidor HTTP.
 *   3. Inicia el cron job de sincronización de Gmail.
 *
 * @returns {Promise<void>}
 
const startServer = async () => {
  try {
    // Paso 1: Crear tablas e índices si no existen
    console.log("Inicializando base de datos...");
    await initializeDatabase();
    console.log("Base de datos inicializada correctamente");

    // Paso 2: Iniciar servidor HTTP
    // app.listen(PORT, () => {
    //   console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    //   console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
    // });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });

    // Paso 3: Iniciar cron de sincronización de Gmail (cada hora)
    startSyncCron();

  } catch (error) {
    console.error("❌ Error al arrancar el servidor:", error);
    // exit(1) para que PM2 / Docker reinicie el proceso automáticamente
    process.exit(1);
  }
};

startServer();
*/

/**
 * @file server.js
 * @description Servidor principal PocketPal listo para Railway.
 */

// import "dotenv/config";
// import { app } from "./src/app.js";
// import { initializeDatabase } from "./src/db/init.js";
// import { startSyncCron } from "./src/jobs/syncCron.js";

// // Puerto asignado por Railway
// const PORT = process.env.PORT || 3000;

// // Endpoint para que Railway verifique que el contenedor está activo
// app.get("/health", (req, res) => res.send("OK"));

// // Inicia la base de datos y el servidor
// const startServer = async () => {
//   try {
//     console.log("🗄️ Inicializando base de datos MySQL...");
//     await initializeDatabase();
//     console.log("✅ Base de datos lista");

//     // Inicia servidor escuchando en 0.0.0.0 para que Railway pueda conectarse
//     app.listen(PORT, "0.0.0.0", () => {
//       console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
//       console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
//     });

//     // Inicia cron de sincronización de Gmail
//     startSyncCron();
//     console.log("⏰ Cron de sincronización Gmail iniciado (cada hora)");

//   } catch (err) {
//     console.error("❌ Error arrancando servidor:", err);
//     process.exit(1);
//   }
// };

// startServer();



/**
 * @file server.js
 * @description Servidor principal PocketPal listo para Railway.
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { app as baseApp } from "./src/app.js";           // Tu app Express original con rutas API
import { initializeDatabase } from "./src/db/init.js";   // Inicialización de MySQL
import { startSyncCron } from "./src/jobs/syncCron.js";  // Cron de Gmail

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= Express principal =================
const app = express();

// ================= Middleware =================
// Servir frontend estático
const frontendPath = path.join(__dirname, "frontend"); // Cambia "frontend" si tu carpeta se llama diferente
app.use(express.static(frontendPath));

// Servir index.html en la raíz
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Montar tu app de rutas API bajo /api
app.use("/api", baseApp);

// Endpoint health check para Railway
app.get("/health", (req, res) => res.send("OK"));

// ================= Servidor =================
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log("🗄️ Inicializando base de datos MySQL...");
    await initializeDatabase();
    console.log("✅ Base de datos lista");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
    });

    // Iniciar cron de sincronización Gmail
    startSyncCron();
    console.log("⏰ Cron de sincronización Gmail iniciado (cada hora)");

  } catch (err) {
    console.error("❌ Error arrancando servidor:", err);
    process.exit(1);
  }
};

startServer();