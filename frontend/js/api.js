/**
 * @file frontend/js/api.js
 * @description Cliente HTTP centralizado para consumir la API de PocketPal.
 *
 * Lee la configuración de window.APP_CONFIG (definido en config.js).
 * Debe cargarse DESPUÉS de config.js y ANTES que cualquier otro script.
 *
 * Expone como globales:
 *   getToken, getUser, saveAuth, clearAuth, isLoggedIn, requireAuth
 *   apiFetch
 *   auth, transactions, categories, goals, summary, ai
 *   fmt, toast
 */

/* ─── Validación de dependencia ─────────────────────────────────────────────
   Si config.js no se cargó antes, todo lo que sigue fallará con errores
   difíciles de depurar. Fallar explícito aquí es más fácil de diagnosticar. */
if (!window.APP_CONFIG) {
  throw new Error('[api.js] window.APP_CONFIG no está definido. Asegúrate de cargar config.js ANTES de api.js.');
}

const { API_BASE_URL, PAGES, UI } = window.APP_CONFIG;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** @returns {string|null} Token JWT del usuario en localStorage. */
const getToken = () => localStorage.getItem('token');

/** @returns {object|null} Datos del usuario almacenados en localStorage. */
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');

/**
 * Guarda el token JWT y los datos del usuario en localStorage.
 * @param {string} token
 * @param {object} user
 */
const saveAuth = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

/** Elimina el token y los datos del usuario de localStorage. */
const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/** @returns {boolean} true si el usuario tiene sesión activa. */
const isLoggedIn = () => !!getToken();

/**
 * Protege una página: redirige al login si no hay sesión activa.
 * Llamar al inicio de cada página protegida.
 * @returns {boolean} true si el usuario está autenticado.
 */
const requireAuth = () => {
  if (!isLoggedIn()) {
    window.location.href = PAGES.login;
    return false;
  }
  return true;
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Realiza una petición HTTP autenticada al backend.
 * Agrega el token JWT en el header Authorization automáticamente.
 * Si el servidor responde 401, cierra la sesión y redirige al login.
 *
 * @param {string} endpoint     - Ruta relativa a la API, ej: '/transactions?page=1'.
 * @param {object} [options={}] - Opciones de fetch (method, body, headers...).
 * @returns {Promise<object>}   - Respuesta JSON del servidor.
 * @throws {Error}              - Si la respuesta no es 2xx.
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`https://pocketpal-production.up.railway.app/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      // Token expirado o inválido — cerrar sesión y redirigir
      clearAuth();
      window.location.href = PAGES.login;
      return; // detener ejecución
    }
    throw new Error(data.message || `Error ${response.status}`);
  }

  return data;
};

// ─── Módulos de la API ────────────────────────────────────────────────────────

/**
 * Autenticación: registro, login y sesión.
 */
const auth = {
  register: (name, email, password) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => apiFetch('/auth/me'),

  /** Cierra la sesión localmente y redirige al login. */
  logout: () => {
    clearAuth();
    window.location.href = PAGES.login;
  },
};

/**
 * Transacciones — CRUD completo + paginación server-side.
 */
const transactions = {
  /**
   * Lista transacciones con paginación y filtros opcionales.
   * @param {object} [params={}] — type, category_id, start_date, end_date, page, limit.
   */
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/transactions${qs ? '?' + qs : ''}`);
  },

  get:    (id)       => apiFetch(`/transactions/${id}`),
  create: (data)     => apiFetch('/transactions',    { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/transactions/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)       => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
};

/**
 * Categorías — CRUD de categorías personalizadas.
 * Las globales (scope='global') son de solo lectura.
 */
const categories = {
  list:   ()         => apiFetch('/categories'),
  create: (data)     => apiFetch('/categories',    { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/categories/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)       => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
};

/**
 * Metas de ahorro — CRUD + aportes.
 */
const goals = {
  list:   ()         => apiFetch('/goals'),
  get:    (id)       => apiFetch(`/goals/${id}`),
  create: (data)     => apiFetch('/goals',    { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/goals/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)       => apiFetch(`/goals/${id}`, { method: 'DELETE' }),

  /**
   * Registra un aporte a una meta.
   * Crea una transacción tipo 'saving' que resta del balance.
   * @param {number} id     - ID de la meta.
   * @param {number} amount - Monto a abonar.
   */
  contribute: (id, amount) =>
    apiFetch(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) }),
};

/**
 * Resúmenes financieros — solo lectura.
 */
const summary = {
  get: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/summary${qs ? '?' + qs : ''}`);
  },
  goals: () => apiFetch('/summary/goals'),
};

/**
 * Agente IA NOVA — chat con contexto financiero.
 */
const ai = {
  /**
   * Envía un mensaje al agente y recibe su respuesta.
   * @param {string} message          - Texto del usuario.
   * @param {Array}  [history=[]]     - Historial reciente para contexto.
   */
  chat: (message, history = []) =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

  history:      () => apiFetch('/ai/history'),
  clearHistory: () => apiFetch('/ai/history', { method: 'DELETE' }),
};

// ─── Utilidades de formato ────────────────────────────────────────────────────

/**
 * Funciones de formato para mostrar datos en la UI.
 */
const fmt = {
  /**
   * Formatea un número como moneda colombiana.
   * @param {number} n
   * @returns {string} Ej: "$1.500.000"
   */
  currency: (n) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n),

  /**
   * Formatea una fecha ISO (YYYY-MM-DD) como texto legible.
   * @param {string} d
   * @returns {string} Ej: "15 ene 2025"
   */
  date: (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),

  /**
   * Trunca un texto largo agregando "…".
   * @param {string} str
   * @param {number} [max=30]
   */
  truncate: (str, max = 30) =>
    str && str.length > max ? str.slice(0, max) + '…' : str,
};

// ─── Toast notifications ──────────────────────────────────────────────────────

/**
 * Sistema de notificaciones toast.
 * Los toasts aparecen en #toast-container (definido en cada HTML).
 * La duración viene de APP_CONFIG.UI.toastDuration.
 */
const toast = {
  /**
   * Muestra un toast.
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   */
  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">
        ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span>${message}</span>`;

    container.appendChild(el);

    // Animar entrada
    requestAnimationFrame(() => el.classList.add('show'));

    // Programar salida
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, UI.toastDuration);
  },

  success: (msg) => toast.show(msg, 'success'),
  error:   (msg) => toast.show(msg, 'error'),
  info:    (msg) => toast.show(msg, 'info'),
};
