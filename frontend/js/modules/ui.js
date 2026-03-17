/**
 * @file frontend/js/modules/ui.js
 * @description Helpers de UI compartidos por todos los módulos del dashboard.
 *
 * Funciones puras de DOM: abrir/cerrar modales, gestionar botones,
 * toggle de tipo de transacción, rellenar selects de categoría.
 * NO hace llamadas a la API ni contiene lógica de negocio.
 *
 * Usa delegación de eventos para los botones data-close y data-scroll,
 * lo que elimina todos los handlers onclick="..." del HTML.
 *
 * Expone como globales:
 *   openModal(id), closeModal(id)
 *   setTxType(type)
 *   populateCategorySelects(list)
 *   setButtonLoading(btn, label), setButtonReady(btn, label)
 */

// ─── Modales ──────────────────────────────────────────────────────────────────

/**
 * Abre un modal añadiendo la clase "open" al overlay.
 * La clase .open activa opacity:1 y pointer-events:all (ver components.css).
 *
 * @param {string} id - ID del .modal-overlay.
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  // Mover foco al primer campo interactivo del modal (accesibilidad)
  const firstFocusable = el.querySelector('input, select, textarea, button:not(.modal-close)');
  if (firstFocusable) firstFocusable.focus();
}

/**
 * Cierra un modal removiendo la clase "open".
 *
 * @param {string} id - ID del .modal-overlay.
 */
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/**
 * Delegación de eventos globales para el dashboard.
 * Centralizar aquí evita handlers onclick dispersos en el HTML.
 *
 * Patrones manejados:
 *   data-close="<modal-id>"   → cierra ese modal
 *   data-scroll="<section-id>" → scroll suave a esa sección
 *   .modal-overlay (click fuera del .modal) → cierra el modal
 */
document.addEventListener('click', (e) => {
  // Cerrar modal con botón data-close
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
    return;
  }

  // Scroll a sección con botón data-scroll
  const scrollBtn = e.target.closest('[data-scroll]');
  if (scrollBtn) {
    document.getElementById(scrollBtn.dataset.scroll)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Clic en el overlay oscuro (fuera del contenido del modal) → cerrar
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelector('.modal-overlay.open')?.classList.remove('open');
  }
});

// ─── Toggle tipo de transacción ───────────────────────────────────────────────

/**
 * Cambia el tipo de transacción en el modal (Ingreso / Gasto).
 *
 * Efectos:
 *   1. Actualiza el input hidden #tx-type.
 *   2. Activa/desactiva los botones del toggle.
 *   3. Filtra #tx-category para mostrar solo opciones del tipo elegido.
 *   4. Limpia la selección si la categoría actual no corresponde al nuevo tipo.
 *
 * @param {'income'|'expense'} type
 */
function setTxType(type) {
  const hiddenInput = document.getElementById('tx-type');
  const btnIncome   = document.getElementById('type-income');
  const btnExpense  = document.getElementById('type-expense');
  const catSelect   = document.getElementById('tx-category');

  if (hiddenInput) hiddenInput.value = type;
  if (btnIncome)   btnIncome.classList.toggle('active',  type === 'income');
  if (btnExpense)  btnExpense.classList.toggle('active', type === 'expense');

  if (catSelect) {
    // Ocultar opciones del tipo contrario (mantener la vacía siempre visible)
    Array.from(catSelect.options).forEach((opt) => {
      if (opt.dataset.type) opt.hidden = opt.dataset.type !== type;
    });

    // Si la categoría seleccionada no corresponde al tipo nuevo → limpiar
    const sel = catSelect.options[catSelect.selectedIndex];
    if (sel?.dataset.type && sel.dataset.type !== type) catSelect.value = '';
  }
}

// Delegación para los botones del type-toggle (están en el HTML como data-type)
document.addEventListener('click', (e) => {
  const typeBtn = e.target.closest('[data-type]');
  if (typeBtn && typeBtn.classList.contains('type-btn')) {
    setTxType(typeBtn.dataset.type);
  }
});

// ─── Selects de categoría ─────────────────────────────────────────────────────

/**
 * Rellena los selects de categoría en el modal de transacción y en los filtros.
 * Preserva la selección actual para no perder el filtro activo al recargar.
 *
 * @param {Array<{id: number, name: string, type: string}>} list - Categorías.
 */
function populateCategorySelects(list) {
  ['tx-category', 'filter-category'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const current = el.value;

    el.innerHTML = id === 'filter-category'
      ? '<option value="">Todas las categorías</option>'
      : '<option value="">Selecciona categoría</option>';

    list.forEach((c) => {
      const opt = document.createElement('option');
      opt.value            = c.id;
      opt.dataset.type     = c.type;
      opt.textContent      = `${c.name} (${c.type === 'income' ? 'Ingreso' : 'Gasto'})`;
      el.appendChild(opt);
    });

    if (current) el.value = current;
  });
}

// ─── Estado de botones ────────────────────────────────────────────────────────

/**
 * Pone un botón en estado "cargando": deshabilitado + spinner.
 * Guarda el texto original en dataset.originalText para restaurarlo.
 *
 * @param {HTMLButtonElement} btn
 * @param {string} [label='Guardando...']
 */
function setButtonLoading(btn, label = 'Guardando...') {
  if (!btn) return;
  btn.disabled             = true;
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML            = `<span class="spinner" aria-hidden="true"></span> ${label}`;
}

/**
 * Restaura un botón a su estado normal después de una carga.
 *
 * @param {HTMLButtonElement} btn
 * @param {string} [label] - Texto a mostrar (usa el original guardado si se omite).
 */
function setButtonReady(btn, label) {
  if (!btn) return;
  btn.disabled    = false;
  btn.textContent = label ?? btn.dataset.originalText ?? 'Guardar';
}
