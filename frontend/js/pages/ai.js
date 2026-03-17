/**
 * @file frontend/js/pages/ai.js
 * @description Lógica del chat con el agente NOVA (ai.html).
 *
 * Depende de: config.js (APP_CONFIG), api.js (ai, requireAuth, toast).
 */

if (!requireAuth()) throw new Error('[ai.js] Usuario no autenticado');

// ─── Estado ───────────────────────────────────────────────────────────────────

/** Historial local de la conversación. Se envía al backend como contexto. */
let conversationHistory = [];

/** Bloquea el envío mientras la IA está procesando. */
let isTyping = false;

// ─── Referencias ──────────────────────────────────────────────────────────────

const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');
const welcomeTime  = document.getElementById('welcome-time');

// ─── Inicialización ───────────────────────────────────────────────────────────

if (welcomeTime) {
  welcomeTime.textContent = new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Event listeners ─────────────────────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

chatInput.addEventListener('input', () => _autoResize(chatInput));

/** Delegación de clicks para los botones de acciones rápidas (data-prompt). */
document.getElementById('quick-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('.quick-btn');
  if (!btn) return;
  const prompt = btn.dataset.prompt;
  if (prompt) { chatInput.value = prompt; sendMessage(); }
});

// ─── Envío de mensaje ─────────────────────────────────────────────────────────

/**
 * Lee el input, muestra la burbuja del usuario, llama a la API del agente
 * y muestra la respuesta. Bloquea la UI mientras espera.
 */
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isTyping) return;

  _addBubble('user', message);
  chatInput.value      = '';
  chatInput.style.height = 'auto';

  conversationHistory.push({ role: 'user', content: message });

  isTyping         = true;
  sendBtn.disabled = true;

  const typingEl = _showTypingIndicator();

  try {
    const res   = await ai.chat(message, conversationHistory.slice(-APP_CONFIG.UI.aiHistoryWindow));
    const reply = res.data.message;

    typingEl.remove();
    conversationHistory.push({ role: 'assistant', content: reply });
    _addBubble('assistant', reply, new Date(res.data.timestamp));
  } catch (err) {
    typingEl.remove();
    _addBubble('assistant', '⚠️ Ocurrió un error al conectar con NOVA. Por favor intenta de nuevo.');
    console.error('[ai.js] sendMessage error:', err);
  } finally {
    isTyping         = false;
    sendBtn.disabled = false;
    _scrollToBottom();
  }
}

// ─── Render de burbujas ───────────────────────────────────────────────────────

/**
 * Crea y añade una burbuja de chat al DOM.
 * Convierte Markdown básico (**negrita**, saltos de línea) a HTML seguro.
 *
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {Date}   [time=new Date()]
 */
function _addBubble(role, content, time = new Date()) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  const formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');

  const timeStr = time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    <div class="bubble-body ${role}">
      ${formatted}
      <span class="bubble-time">${timeStr}</span>
    </div>`;

  chatMessages.appendChild(bubble);
  _scrollToBottom();
}

/**
 * Crea el indicador de "escribiendo…" (tres puntos animados).
 * @returns {HTMLElement} Referencia para eliminarlo cuando llegue la respuesta.
 */
function _showTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.setAttribute('aria-label', 'El agente está escribiendo');
  el.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>`;
  chatMessages.appendChild(el);
  _scrollToBottom();
  return el;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Ajusta dinámicamente la altura del textarea al contenido.
 * Max-height está definida en ai.css.
 * @param {HTMLTextAreaElement} el
 */
function _autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
