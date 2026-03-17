/**
 * @file frontend/js/modules/txModule.js
 * @description Módulo CRUD de transacciones + paginación del dashboard.
 *
 * Estado interno (prefijo _):
 *   _pagination — página actual, limit, total, totalPages
 *   _filters    — filtros activos enviados al servidor en cada listado
 *   _deleteTxId — ID guardado para confirmar la eliminación
 *
 * Expone como globales (llamadas desde dashboard.js o desde el HTML):
 *   loadTransactions(resetPage?)
 *   openCreateTxModal()
 *   openEditTxModal(tx)
 *   openDeleteTxModal(id, info)
 *   confirmDeleteTx()
 *   handleSubmitTx(e)
 *   applyFilters()
 *   clearFilters()
 *   changePage(n)
 *
 * Depende de:
 *   config.js   → APP_CONFIG.UI.txDefaultLimit
 *   api.js      → transactions, fmt, toast
 *   ui.js       → openModal, closeModal, setTxType, setButtonLoading, setButtonReady
 *   dashboard.js → loadAllData (global expuesta por el orquestador)
 */

// ─── Estado ───────────────────────────────────────────────────────────────────

let _pagination = {
  page:       1,
  limit:      APP_CONFIG.UI.txDefaultLimit,
  total:      0,
  totalPages: 1,
};

/** Filtros activos que se incluyen en cada petición GET /transactions. */
let _filters = {};

/** ID de la transacción pendiente de eliminación (confirmación en modal). */
let _deleteTxId = null;

// ─── Carga de transacciones ───────────────────────────────────────────────────

/**
 * Carga la página actual de transacciones desde el servidor.
 * Combina _pagination y _filters en los query params.
 * Actualiza _pagination con los datos devueltos y re-renderiza tabla + paginación.
 *
 * @param {boolean} [resetPage=false] — Si es true, vuelve a la página 1 antes de cargar.
 * @returns {Promise<Array>} Lista de transacciones de la página actual.
 */
async function loadTransactions(resetPage = false) {
  if (resetPage) _pagination.page = 1;

  try {
    const res = await transactions.list({
      ..._filters,
      page:  _pagination.page,
      limit: _pagination.limit,
    });

    const { transactions: txList, pagination } = res.data;

    // Sincronizar estado local con los datos del servidor
    _pagination = { ..._pagination, ...pagination };

    _renderTable(txList);
    _renderPagination();
    _updateSubtitle(pagination.total);

    return txList;
  } catch (err) {
    toast.error('Error cargando transacciones: ' + err.message);
    return [];
  }
}

/**
 * Actualiza el subtítulo de la sección con el conteo de transacciones.
 * @param {number} total
 */
function _updateSubtitle(total) {
  const el = document.getElementById('tx-subtitle');
  if (el) el.textContent = total === 0
    ? 'Sin resultados'
    : `${total} registro${total !== 1 ? 's' : ''}`;
}

// ─── Render de la tabla ───────────────────────────────────────────────────────

/**
 * Renderiza la tabla de transacciones en #tx-tbody.
 * Cada fila tiene botón de editar (solo income/expense) y eliminar.
 * Las transacciones tipo 'saving' son generadas automáticamente por los aportes
 * a metas — no se editan desde aquí pero sí se pueden eliminar.
 *
 * @param {Array} txList
 */
function _renderTable(txList) {
  const tbody = document.getElementById('tx-tbody');
  if (!tbody) return;

  if (!txList || txList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-icon">💸</div>
            <p class="empty-state-text">No hay transacciones en este período</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = txList.map((tx) => {
    const dateStr  = tx.date ? tx.date.toString().split('T')[0] : '—';
    const isSaving = tx.type === 'saving';

    const badgeCls = tx.type === 'income'  ? 'badge-income'
                   : tx.type === 'saving'  ? 'badge-saving'
                   : 'badge-expense';
    const badgeTxt = tx.type === 'income'  ? '↑ Ingreso'
                   : tx.type === 'saving'  ? '→ Ahorro'
                   : '↓ Gasto';
    const amtCls   = tx.type === 'income'  ? 'amount-income' : 'amount-expense';

    // Serializar la transacción para pasarla al modal de edición sin hacer una 2ª petición
    const txJson = JSON.stringify(tx).replace(/"/g, '&quot;');

    return `
      <tr>
        <td>${dateStr}</td>
        <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
        <td><span class="${amtCls}">${fmt.currency(tx.amount)}</span></td>
        <td>${tx.category_name || '—'}</td>
        <td class="text-dim">${fmt.truncate(tx.description || '—', 28)}</td>
        <td>
          <div class="row-actions">
            ${!isSaving ? `
              <button class="btn btn-ghost btn-icon"
                data-action="edit-tx"
                data-tx="${txJson}"
                title="Editar transacción"
                aria-label="Editar">✏</button>` : ''}
            <button class="btn btn-ghost btn-icon btn-danger-text"
              data-action="delete-tx"
              data-id="${tx.id}"
              data-info="${fmt.currency(tx.amount)} — ${(tx.description || tx.category_name || '').replace(/"/g, '&quot;')}"
              title="Eliminar transacción"
              aria-label="Eliminar">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/**
 * Delegación de eventos en la tabla de transacciones.
 * Centralizar aquí elimina todos los onclick en el HTML dinámico.
 */
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-action="edit-tx"]');
  if (editBtn) {
    openEditTxModal(JSON.parse(editBtn.dataset.tx.replace(/&quot;/g, '"')));
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete-tx"]');
  if (deleteBtn) {
    openDeleteTxModal(parseInt(deleteBtn.dataset.id), deleteBtn.dataset.info);
  }
});

// ─── Paginación ───────────────────────────────────────────────────────────────

/**
 * Renderiza los controles de paginación en #pagination-controls.
 * Muestra el rango visible (ej: "Mostrando 21–40 de 73") y los botones Ant/Sig.
 */
function _renderPagination() {
  const container = document.getElementById('pagination-controls');
  if (!container) return;

  const { page, totalPages, total, limit } = _pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  container.innerHTML = `
    <div class="pagination-wrap">
      <span class="pagination-info">
        ${total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
      </span>
      <div class="pagination-controls">
        <button class="btn btn-ghost btn-sm"
          data-page="${page - 1}"
          ${page <= 1 ? 'disabled aria-disabled="true"' : ''}
          aria-label="Página anterior">← Anterior</button>
        <span class="pagination-page" aria-current="page">${page} / ${totalPages || 1}</span>
        <button class="btn btn-ghost btn-sm"
          data-page="${page + 1}"
          ${page >= totalPages ? 'disabled aria-disabled="true"' : ''}
          aria-label="Página siguiente">Siguiente →</button>
      </div>
    </div>`;
}

/** Delegación de clicks en los botones de paginación (data-page). */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-page]');
  if (!btn || !btn.closest('#pagination-controls')) return;
  const newPage = parseInt(btn.dataset.page);
  changePage(newPage);
});

/**
 * Navega a una página específica del historial.
 * @param {number} newPage
 */
async function changePage(newPage) {
  if (newPage < 1 || newPage > _pagination.totalPages) return;
  _pagination.page = newPage;
  await loadTransactions();
  document.getElementById('section-transactions')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

/**
 * Lee los controles de filtro y recarga desde la página 1.
 * Solo incluye en _filters los campos que tienen valor.
 */
async function applyFilters() {
  _filters = {};
  const type     = document.getElementById('filter-type')?.value;
  const catId    = document.getElementById('filter-category')?.value;
  const startDt  = document.getElementById('filter-start')?.value;
  const endDt    = document.getElementById('filter-end')?.value;

  if (type)    _filters.type        = type;
  if (catId)   _filters.category_id = catId;
  if (startDt) _filters.start_date  = startDt;
  if (endDt)   _filters.end_date    = endDt;

  await loadTransactions(true);
}

/** Limpia todos los filtros y recarga. */
function clearFilters() {
  ['filter-type', 'filter-category', 'filter-start', 'filter-end']
    .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  _filters = {};
  loadTransactions(true);
}

// ─── Modal crear ──────────────────────────────────────────────────────────────

/**
 * Abre el modal en modo "crear": limpia campos, resetea tipo a 'expense', pone hoy como fecha.
 */
function openCreateTxModal() {
  document.getElementById('tx-id').value           = '';
  document.getElementById('form-tx').reset();
  document.getElementById('modal-tx-title').textContent  = 'Nueva transacción';
  document.getElementById('submit-tx-btn').textContent   = 'Guardar';

  setTxType('expense');

  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  openModal('modal-tx');
}

// ─── Modal editar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal en modo "editar" con los datos de la fila pre-rellenos.
 * El objeto tx viene del data-tx del botón en la tabla (JSON embebido).
 *
 * @param {object} tx — transacción completa serializada en el botón de editar.
 */
function openEditTxModal(tx) {
  document.getElementById('tx-id').value                = tx.id;
  document.getElementById('modal-tx-title').textContent = 'Editar transacción';
  document.getElementById('submit-tx-btn').textContent  = 'Actualizar';

  setTxType(tx.type);

  document.getElementById('tx-amount').value      = tx.amount;
  document.getElementById('tx-description').value = tx.description || '';

  // Normalizar fecha — puede venir como string o Date de MySQL
  const dateStr = tx.date ? tx.date.toString().split('T')[0] : '';
  document.getElementById('tx-date').value = dateStr;

  // Pre-seleccionar categoría: mostrar todas primero, luego seleccionar
  const catSelect = document.getElementById('tx-category');
  if (catSelect) {
    Array.from(catSelect.options).forEach((opt) => { if (opt.dataset.type) opt.hidden = false; });
    catSelect.value = tx.category_id;
  }

  openModal('modal-tx');
}

// ─── Modal eliminar ───────────────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación.
 * Guarda el ID en _deleteTxId para usarlo al confirmar.
 *
 * @param {number} id   — ID de la transacción.
 * @param {string} info — Texto descriptivo para mostrar al usuario.
 */
function openDeleteTxModal(id, info) {
  _deleteTxId = id;
  const el = document.getElementById('delete-tx-info');
  if (el) el.textContent = info;
  openModal('modal-delete-tx');
}

/**
 * Ejecuta la eliminación de _deleteTxId, cierra el modal y recarga.
 * Si era el último elemento de la página, retrocede una página.
 */
async function confirmDeleteTx() {
  if (!_deleteTxId) return;
  closeModal('modal-delete-tx');

  try {
    await transactions.delete(_deleteTxId);
    toast.success('Transacción eliminada');
    _deleteTxId = null;

    // Retroceder de página si el elemento borrado era el único en esta página
    const rowCount = document.querySelectorAll('#tx-tbody tr[data-empty="false"], #tx-tbody tr:not(.empty-row)').length;
    if (rowCount <= 1 && _pagination.page > 1) _pagination.page--;

    // Recargar todo el dashboard (balance, gráficas, etc. cambian al borrar una tx)
    if (typeof loadAllData === 'function') await loadAllData();
    else await loadTransactions();
  } catch (err) {
    toast.error(err.message);
  }
}

// ─── Submit del formulario ────────────────────────────────────────────────────

/**
 * Maneja el submit del form de transacción.
 * Detecta modo crear (tx-id vacío) o editar (tx-id con valor).
 *
 * @param {Event} e
 */
async function handleSubmitTx(e) {
  e.preventDefault();
  const btn  = document.getElementById('submit-tx-btn');
  const txId = document.getElementById('tx-id').value;
  const isEdit = !!txId;

  setButtonLoading(btn, isEdit ? 'Actualizando...' : 'Guardando...');

  const payload = {
    type:        document.getElementById('tx-type').value,
    amount:      parseFloat(document.getElementById('tx-amount').value),
    category_id: parseInt(document.getElementById('tx-category').value),
    description: document.getElementById('tx-description').value.trim() || undefined,
    date:        document.getElementById('tx-date').value || undefined,
  };

  try {
    if (isEdit) {
      // PUT requiere fecha obligatoria (validación en el backend)
      if (!payload.date) {
        toast.error('La fecha es requerida para actualizar');
        setButtonReady(btn);
        return;
      }
      await transactions.update(txId, payload);
      toast.success('Transacción actualizada ✓');
    } else {
      await transactions.create(payload);
      toast.success('Transacción registrada ✓');
    }

    closeModal('modal-tx');
    document.getElementById('form-tx').reset();
    _pagination.page = 1; // ir a la primera página para ver el resultado
    if (typeof loadAllData === 'function') await loadAllData();
    else await loadTransactions();
  } catch (err) {
    toast.error(err.message);
    setButtonReady(btn);
  }
}
