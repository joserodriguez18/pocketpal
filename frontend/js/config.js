/**
 * @file frontend/js/config.js
 * @description Configuración centralizada del frontend de PocketPal.
 *
 * ─── POR QUÉ EXISTE ESTE ARCHIVO ────────────────────────────────────────────
 * El frontend corre en el navegador: no puede leer variables de entorno del
 * sistema operativo (.env). Para que el deploy sea configurable sin tocar el
 * código, este archivo centraliza TODAS las rutas y parámetros que pueden
 * cambiar entre entornos (desarrollo, staging, producción).
 *
 * Para hacer un deploy solo hay que editar las constantes de este archivo
 * (o generarlo automáticamente con un build step si se usa CI/CD).
 *
 * ─── USO ────────────────────────────────────────────────────────────────────
 * Este archivo SIEMPRE debe cargarse PRIMERO en el HTML, antes que api.js.
 * Todos los demás scripts leen de window.APP_CONFIG.
 *
 *   <script src="js/config.js"></script>   ← primero
 *   <script src="js/api.js"></script>      ← segundo
 *   ...
 *
 * ─── CÓMO CAMBIAR EL ENTORNO ─────────────────────────────────────────────────
 * Desarrollo local:
 *   API_BASE_URL = ''               (mismo servidor, sin prefijo)
 *   PAGES.dashboard = '/frontend/dashboard.html'
 *
 * Producción en dominio propio (ej: app.pocketpal.co):
 *   API_BASE_URL = ''               (mismo servidor)
 *   PAGES.dashboard = '/frontend/dashboard.html'
 *
 * Producción con API separada (ej: api.pocketpal.co):
 *   API_BASE_URL = 'https://api.pocketpal.co'
 *   PAGES.dashboard = '/dashboard.html'   (si el frontend está en otro servidor)
 *
 * ─── NOTA DE SEGURIDAD ───────────────────────────────────────────────────────
 * NO pongas aquí secretos (API keys, JWT secrets, contraseñas).
 * Este archivo es público — cualquiera que cargue la página puede verlo.
 * Los secretos van en el .env del BACKEND, nunca en el frontend.
 */

window.APP_CONFIG = Object.freeze({

  /**
   * URL base de la API del backend.
   *
   * - Vacío (''): el frontend y el backend corren en el mismo servidor
   *   (Express sirve el frontend como estático). La mayoría de los despliegues.
   * - URL completa: el backend está en un servidor distinto (CORS habilitado).
   *   Ej: 'https://api.pocketpal.co'
   *
   * @type {string}
   */
  API_BASE_URL: '',

  /**
   * Rutas de las páginas del frontend.
   * Centralizar aquí evita strings hardcodeados dispersos en cada .js.
   * Si el frontend se mueve a una carpeta diferente, solo cambia aquí.
   *
   * @type {{ login: string, dashboard: string, ai: string }}
   */
  PAGES: {
    login:     '/index.html',
    dashboard: '/dashboard.html',
    ai:        '/ai.html',
  },

  /**
   * Configuración de la UI.
   *
   * @type {{ toastDuration: number, txDefaultLimit: number }}
   */
  UI: {
    /** Duración de los toasts en milisegundos antes de desaparecer. */
    toastDuration: 3500,

    /** Número de transacciones por página en el historial. */
    txDefaultLimit: 5,

    /** Máximo de mensajes del historial enviados al agente IA como contexto. */
    aiHistoryWindow: 8,
  },

});
