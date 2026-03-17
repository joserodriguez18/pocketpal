/**
 * @file src/app.js
 * @description Configuración principal de la aplicación Express.
 *
 * Registra en orden:
 *   1. Middleware de seguridad (helmet, cors).
 *   2. Body parsing (JSON).
 *   3. Passport (OAuth 2.0 con Google).
 *   4. Rate limiters.
 *   5. Archivos estáticos (frontend).
 *   6. Health check.
 *   7. Rutas de la API.
 *   8. Fallback SPA y 404 para rutas desconocidas.
 *   9. Error handler centralizado (SIEMPRE al final).
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { app as baseApp } from "./src/app.js";
import { initializeDatabase } from "./src/db/init.js";
import { startSyncCron } from "./src/jobs/syncCron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ❌ OPCIONAL: puedes quitar esto también (ya no necesitas frontend aquí)
// const frontendPath = path.join(__dirname, "frontend");
// app.use(express.static(frontendPath));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });

// ✅ IMPORTANTE: montar sin /api
app.use(baseApp);

// Health check
app.get("/health", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log("🗄️ Inicializando base de datos MySQL...");
    await initializeDatabase();
    console.log("✅ Base de datos lista");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });

    startSyncCron();
    console.log("⏰ Cron iniciado");

  } catch (err) {
    console.error("❌ Error arrancando servidor:", err);
    process.exit(1);
  }
};

startServer();
