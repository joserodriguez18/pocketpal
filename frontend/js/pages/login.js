/**
 * @file frontend/js/pages/login.js
 * @description Lógica de la página de login/registro (index.html).
 *
 * Depende de: config.js (APP_CONFIG), api.js (auth, toast, saveAuth, isLoggedIn).
 */

// Redirigir si ya hay sesión activa
if (isLoggedIn()) window.location.href = APP_CONFIG.PAGES.dashboard;

// ─── Referencias ──────────────────────────────────────────────────────────────
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabsContainer = document.querySelector('.auth-tabs');
const btnGoogle    = document.getElementById('btn-google');

// ─── Cambio de pestañas ───────────────────────────────────────────────────────

/**
 * Activa la pestaña indicada y muestra el formulario correspondiente.
 * @param {'login'|'register'} tab
 */
function switchTab(tab) {
  const isLogin = tab === 'login';

  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  document.getElementById('tab-login').setAttribute('aria-selected', isLogin);
  document.getElementById('tab-register').setAttribute('aria-selected', !isLogin);

  loginForm.hidden    = !isLogin;
  registerForm.hidden = isLogin;

  // Enfocar el primer campo del formulario activo
  const firstInput = (isLogin ? loginForm : registerForm).querySelector('input');
  if (firstInput) firstInput.focus();
}

// Delegación de clicks en las pestañas
tabsContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.auth-tab');
  if (btn) switchTab(btn.dataset.tab);
});

// ─── Login ────────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn      = document.getElementById('login-btn');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Entrando…';

  try {
    const res = await auth.login(email, password);
    saveAuth(res.data.token, res.data.user);
    window.location.href = APP_CONFIG.PAGES.dashboard;
  } catch (err) {
    toast.error(err.message);
    btn.disabled    = false;
    btn.textContent = 'Iniciar sesión';
  }
});

// ─── Registro ─────────────────────────────────────────────────────────────────

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn      = document.getElementById('register-btn');
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Creando cuenta…';

  try {
    const res = await auth.register(name, email, password);
    saveAuth(res.data.token, res.data.user);
    window.location.href = APP_CONFIG.PAGES.dashboard;
  } catch (err) {
    toast.error(err.message);
    btn.disabled    = false;
    btn.textContent = 'Crear mi cuenta';
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * Redirige al endpoint de inicio de OAuth de Google.
 * El backend (passport.js) maneja todo el flujo y redirige de vuelta
 * a dashboard.html con el token en los query params.
 */
btnGoogle.addEventListener('click', () => {
  window.location.href = `https://pocketpal-production.up.railway.app/api/auth/google/callback`;
});
