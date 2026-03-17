/**
 * @file frontend/js/dashboard.js
 * @description Orquestador del dashboard de PocketPal.
 *
 * Responsabilidades:
 *   1. Capturar el token JWT de la URL al regresar de Google OAuth.
 *   2. Verificar autenticación y mostrar datos del usuario en el sidebar.
 *   3. Conectar los botones del sidebar/header a los módulos correspondientes.
 *   4. Llamar loadAllData() para traer datos en paralelo y distribuirlos.
 *   5. Exponer loadAllData() globalmente para que los módulos la llamen tras mutaciones.
 *
 * POLÍTICA DE RECARGA:
 *   Cada módulo llama a loadAllData() después de cualquier operación que cambie
 *   datos en el servidor. Esto garantiza que el dashboard siempre refleja el
 *   estado real de la base de datos.
 *
 * Depende de (cargados antes en dashboard.html):
 *   config.js, api.js, ui.js, charts.js, txModule.js, goalsModule.js, categoriesModule.js.
 */

// ─── Captura de token OAuth ───────────────────────────────────────────────────

/**
 * Al regresar del callback de Google, la URL contiene:
 *   ?token=<jwt>&name=<nombre>&email=<email>&avatar=<url>
 *
 * Se guardan en localStorage y se limpia la URL inmediatamente
 * para no exponer el token en el historial del navegador.
 */
(function captureOAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (!urlToken) return;

  saveAuth(urlToken, {
    name:   params.get('name')   || '',
    email:  params.get('email')  || '',
    avatar: params.get('avatar') || '',
  });

  // Limpiar query params: reemplaza la entrada en el historial (no añade una nueva)
  window.history.replaceState({}, document.title, APP_CONFIG.PAGES.dashboard);
})();

// Proteger la página: si no hay token, redirigir al login
if (!localStorage.getItem('token')) {
  window.location.href = APP_CONFIG.PAGES.login;
}

// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  _initUserDisplay();
  _bindSidebarButtons();
  await loadAllData();
});

/**
 * Muestra nombre, email y avatar del usuario en el sidebar y el header.
 * Lee de localStorage (guardado en saveAuth al hacer login o volver de OAuth).
 */
function _initUserDisplay() {
  const user = getUser();
  if (!user) return;

  // Sidebar
  const nameEl   = document.getElementById('user-name');
  const emailEl  = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl)  nameEl.textContent  = user.name  || '—';
  if (emailEl) emailEl.textContent = user.email || '—';

  if (avatarEl) {
    if (user.avatar) {
      const img     = document.createElement('img');
      img.src       = user.avatar;
      img.alt       = `Foto de perfil de ${user.name}`;
      avatarEl.innerHTML = '';
      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = user.name?.charAt(0).toUpperCase() || '?';
    }
  }

  // Header — saludo con el primer nombre
  const greetingEl = document.getElementById('greeting-name');
  if (greetingEl) greetingEl.textContent = user.name?.split(' ')[0] || '';
}

/**
 * Conecta los botones del sidebar a los módulos correspondientes.
 * Evita handlers onclick en el HTML — toda la lógica queda en JS.
 */
function _bindSidebarButtons() {
  // Abrir modales desde el sidebar o la tabla
  _on('nav-new-tx',       () => openCreateTxModal());
  _on('nav-new-goal',     () => openCreateGoalModal());
  _on('nav-new-category', () => openCreateCategoryModal());
  _on('btn-new-tx',       () => openCreateTxModal());
  _on('btn-new-goal',     () => openCreateGoalModal());
  _on('btn-new-category', () => openCreateCategoryModal());

  // Sincronización con Gmail
  _on('btn-sync', syncGmail);

  // Logout
  _on('btn-logout', () => auth.logout());

  // Filtros de la tabla de transacciones
  _on('filter-type',       () => applyFilters(), 'change');
  _on('filter-category',   () => applyFilters(), 'change');
  _on('filter-start',      () => applyFilters(), 'change');
  _on('filter-end',        () => applyFilters(), 'change');
  _on('btn-clear-filters', () => clearFilters());

  // Formularios (submit)
  _onSubmit('form-tx',       handleSubmitTx);
  _onSubmit('form-goal',     handleSubmitGoal);
  _onSubmit('form-allocate', handleAllocate);
  _onSubmit('form-category', handleSubmitCategory);

  // Botones de confirmación de eliminación
  _on('confirm-delete-tx-btn',       confirmDeleteTx);
  _on('confirm-delete-goal-btn',     confirmDeleteGoal);
  _on('confirm-delete-category-btn', confirmDeleteCategory);
}

/** Atajo: addEventListener sobre un elemento por ID. */
function _on(id, handler, event = 'click') {
  document.getElementById(id)?.addEventListener(event, handler);
}

/** Atajo: addEventListener submit sobre un form por ID. */
function _onSubmit(id, handler) {
  document.getElementById(id)?.addEventListener('submit', handler);
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

/**
 * Carga todos los datos del dashboard en paralelo y los distribuye a los módulos.
 * Se expone globalmente para que los módulos la llamen tras crear/editar/borrar.
 *
 * Orden:
 *   1. Categorías, metas y resumen en paralelo (Promise.all).
 *   2. Transacciones via loadTransactions() (módulo txModule, tiene su paginación propia).
 *
 * @returns {Promise<void>}
 */
async function loadAllData() {
  try {
    const [catsRes, goalsRes, sumRes] = await Promise.all([
      categories.list(),
      goals.list(),
      summary.get(),
    ]);

    const categoriesList = catsRes.data.categories;
    const goalsList      = goalsRes.data.goals;
    const summaryData    = sumRes.data;

    // Distribuir a cada módulo
    renderStats(summaryData.totals, goalsList);
    renderCharts(summaryData);
    renderGoals(goalsList);
    renderCategories(categoriesList);
    populateCategorySelects(categoriesList);

    // Las transacciones tienen su propio estado de paginación y filtros
    await loadTransactions();

  } catch (err) {
    toast.error('Error al cargar el dashboard: ' + err.message);
    console.error('[dashboard] loadAllData error:', err);
  }
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

/**
 * Actualiza los valores de las tarjetas de estadísticas.
 * El color del balance cambia dinámicamente según sea positivo o negativo.
 *
 * @param {{ total_income: number, total_expenses: number, net_balance: number }} totals
 * @param {Array} goalsList - Para contar las metas activas.
 */
function renderStats(totals, goalsList) {
  _setText('stat-income',  fmt.currency(totals.total_income));
  _setText('stat-expense', fmt.currency(totals.total_expenses));

  const balEl = document.getElementById('stat-balance');
  if (balEl) {
    balEl.textContent = fmt.currency(totals.net_balance);
    // Reemplazar clases de color (positivo/negativo) en lugar de usar style=
    balEl.classList.toggle('positive', parseFloat(totals.net_balance) >= 0);
    balEl.classList.toggle('negative', parseFloat(totals.net_balance) < 0);
  }

  const active = (goalsList || []).filter((g) => !g.is_completed).length;
  _setText('stat-goals', `${active} activa${active !== 1 ? 's' : ''}`);
}

/** Atajo: establecer textContent de un elemento por ID. */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Sincronización Gmail ─────────────────────────────────────────────────────

/**
 * Sincronización manual de transacciones desde Gmail.
 * Requiere que el usuario tenga Google OAuth activo (google_access_token en DB).
 * Actualiza el botón del sidebar con una animación de puntos mientras procesa.
 */
async function syncGmail() {
  const btn = document.getElementById('btn-sync');
  if (!btn || btn.disabled) return;

  btn.disabled = true;

  // Animación de carga
  let dots = 0;
  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    btn.querySelector('.nav-item-icon').textContent = '⟳';
    btn.childNodes[btn.childNodes.length - 1].textContent = ` Buscando${'...'.slice(0, dots)}`;
  }, 400);

  try {
    const data = await apiFetch('/gmail/sync', { method: 'POST' });

    if (data.success) {
      if (data.data.inserted > 0) {
        toast.success(`✅ ${data.data.inserted} movimientos importados`);
        await loadAllData();
      } else {
        toast.info('No hay movimientos nuevos por importar');
      }
    } else {
      toast.error(data.message || 'Error en la sincronización');
    }
  } catch (err) {
    toast.error('Error al conectar con Gmail');
    console.error('[dashboard] syncGmail error:', err);
  } finally {
    clearInterval(interval);
    btn.disabled = false;
    btn.innerHTML = '<span class="nav-item-icon" aria-hidden="true">⟳</span> Sincronizar Gmail';
  }
}
