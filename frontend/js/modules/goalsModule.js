/**
 * @file frontend/js/modules/goalsModule.js
 * @description Módulo CRUD de metas de ahorro + aportes.
 *
 * Estado interno:
 *   _allocateGoalId — ID activo en el modal de aporte
 *   _deleteGoalId   — ID activo en el modal de eliminación
 *
 * Expone como globales:
 *   renderGoals(list)
 *   openCreateGoalModal()
 *   openEditGoalModal(goal)
 *   openAllocateModal(id, title, current, target)
 *   openDeleteGoalModal(id, title)
 *   handleSubmitGoal(e)
 *   handleAllocate(e)
 *   confirmDeleteGoal()
 *
 * SOBRE ELIMINAR UNA META:
 *   Los aportes previos (transacciones tipo 'saving') PERMANECEN en el historial.
 *   El servidor borra la meta y goal_allocations, pero NO revierte las transacciones.
 *   El balance ya fue afectado en cada aporte — revertirlo crearía ingresos fantasma.
 *   El modal de confirmación explica esto explícitamente al usuario.
 *
 * Depende de:
 *   api.js     → goals, apiFetch, fmt, toast
 *   ui.js      → openModal, closeModal, setButtonLoading, setButtonReady
 *   dashboard.js → loadAllData (global)
 */

let _allocateGoalId = null;
let _deleteGoalId   = null;

// ─── Render de tarjetas ───────────────────────────────────────────────────────

/**
 * Renderiza las metas en #goals-list.
 * Separa activas y completadas. Cada tarjeta activa tiene: Abonar, Editar, Eliminar.
 * Las completadas solo tienen: Eliminar.
 *
 * @param {Array} goalsList — respuesta de GET /api/goals
 */
function renderGoals(goalsList) {
  const container = document.getElementById('goals-list');
  if (!container) return;

  if (!goalsList || goalsList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <p class="empty-state-text">No hay metas activas. ¡Crea una!</p>
      </div>`;
    return;
  }

  const active    = goalsList.filter((g) => !g.is_completed);
  const completed = goalsList.filter((g) =>  g.is_completed);

  let html = active.map((g) => _goalCardHtml(g, false)).join('');

  if (completed.length > 0) {
    html += `
      <div class="goals-completed-section">
        <p class="goals-completed-label">Completadas (${completed.length})</p>
        ${completed.map((g) => _goalCardHtml(g, true)).join('')}
      </div>`;
  }

  container.innerHTML = html;
}

/**
 * Genera el HTML de una tarjeta de meta.
 * Embebe el JSON de la meta en data-goal para que el modal de edición no
 * necesite hacer una petición adicional.
 *
 * @param {object}  goal
 * @param {boolean} completed
 * @returns {string}
 */
function _goalCardHtml(goal, completed) {
  const pct     = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
  const goalJson = JSON.stringify(goal).replace(/"/g, '&quot;');

  return `
    <div class="goal-card ${completed ? 'goal-card--completed' : ''}">
      <div class="goal-card-header">
        <div class="goal-title">${_escapeHtml(goal.title)} ${completed ? '✅' : ''}</div>
        <div class="goal-actions">
          ${!completed ? `
            <button class="btn btn-ghost btn-icon"
              data-action="edit-goal" data-goal="${goalJson}"
              title="Editar meta" aria-label="Editar meta">✏</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-danger-text"
            data-action="delete-goal"
            data-id="${goal.id}"
            data-title="${_escapeHtml(goal.title)}"
            title="Eliminar meta" aria-label="Eliminar meta">✕</button>
        </div>
      </div>

      <div class="goal-amounts">
        <span>${fmt.currency(goal.current_amount)} ahorrado</span>
        <span class="goal-pct">${pct}%</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="--pct:${pct}%;width:${pct}%"></div>
      </div>
      <div class="goal-footer">
        <span class="goal-target">Meta: ${fmt.currency(goal.target_amount)}</span>
        ${!completed ? `
          <button class="btn btn-ghost btn-sm goal-contribute-btn"
            data-action="allocate-goal"
            data-id="${goal.id}"
            data-title="${_escapeHtml(goal.title)}"
            data-current="${goal.current_amount}"
            data-target="${goal.target_amount}">
            + Abonar
          </button>` : ''}
      </div>
    </div>`;
}

/** Escapa HTML para prevenir XSS al embeber datos en atributos. */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Delegación de eventos en la lista de metas.
 * Maneja: editar, eliminar y abonar desde los botones de las tarjetas.
 */
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-action="edit-goal"]');
  if (editBtn) {
    openEditGoalModal(JSON.parse(editBtn.dataset.goal.replace(/&quot;/g, '"')));
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete-goal"]');
  if (deleteBtn) {
    openDeleteGoalModal(parseInt(deleteBtn.dataset.id), deleteBtn.dataset.title);
    return;
  }

  const allocateBtn = e.target.closest('[data-action="allocate-goal"]');
  if (allocateBtn) {
    openAllocateModal(
      parseInt(allocateBtn.dataset.id),
      allocateBtn.dataset.title,
      parseFloat(allocateBtn.dataset.current),
      parseFloat(allocateBtn.dataset.target),
    );
  }
});

// ─── Modal crear ──────────────────────────────────────────────────────────────

function openCreateGoalModal() {
  document.getElementById('goal-id').value                    = '';
  document.getElementById('form-goal').reset();
  document.getElementById('modal-goal-title').textContent     = 'Nueva meta de ahorro';
  document.getElementById('submit-goal-btn').textContent      = 'Crear meta';

  const hint = document.getElementById('goal-amount-hint');
  if (hint) { hint.textContent = ''; hint.hidden = true; }

  openModal('modal-goal');
}

// ─── Modal editar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal de meta en modo "editar" con datos pre-rellenos.
 * Muestra aviso del mínimo permitido (no puede bajar del monto ya ahorrado).
 *
 * @param {object} goal — objeto meta serializado en el botón de editar.
 */
function openEditGoalModal(goal) {
  document.getElementById('goal-id').value                = goal.id;
  document.getElementById('goal-title-input').value       = goal.title;
  document.getElementById('goal-amount').value            = goal.target_amount;
  document.getElementById('modal-goal-title').textContent = 'Editar meta';
  document.getElementById('submit-goal-btn').textContent  = 'Actualizar meta';

  const hint = document.getElementById('goal-amount-hint');
  if (hint && parseFloat(goal.current_amount) > 0) {
    hint.textContent = `Mínimo: ${fmt.currency(goal.current_amount)} (ya ahorrado)`;
    hint.hidden = false;
  }

  openModal('modal-goal');
}

// ─── Submit meta ──────────────────────────────────────────────────────────────

/**
 * Maneja el submit del formulario de meta (crear o editar).
 * @param {Event} e
 */
async function handleSubmitGoal(e) {
  e.preventDefault();
  const btn    = document.getElementById('submit-goal-btn');
  const goalId = document.getElementById('goal-id').value;
  const isEdit = !!goalId;

  setButtonLoading(btn, isEdit ? 'Actualizando...' : 'Creando...');

  const payload = {
    title:         document.getElementById('goal-title-input').value.trim(),
    target_amount: parseFloat(document.getElementById('goal-amount').value),
  };

  try {
    if (isEdit) {
      await goals.update(goalId, payload);
      toast.success('Meta actualizada ✓');
    } else {
      await goals.create(payload);
      toast.success('Meta creada ✓');
    }
    closeModal('modal-goal');
    document.getElementById('form-goal').reset();
    if (typeof loadAllData === 'function') await loadAllData();
  } catch (err) {
    toast.error(err.message);
    setButtonReady(btn);
  }
}

// ─── Modal abonar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal de aporte con información de la meta pre-rellena.
 *
 * @param {number} id
 * @param {string} title
 * @param {number} current — monto ya ahorrado
 * @param {number} target  — monto objetivo
 */
function openAllocateModal(id, title, current, target) {
  _allocateGoalId = id;

  const nameEl     = document.getElementById('allocate-goal-name');
  const progressEl = document.getElementById('allocate-goal-progress');

  if (nameEl)     nameEl.textContent = title;
  if (progressEl) {
    const remaining = Math.max(0, parseFloat(target) - parseFloat(current));
    progressEl.textContent =
      `Ahorrado: ${fmt.currency(current)} · Faltan: ${fmt.currency(remaining)}`;
  }

  document.getElementById('allocate-amount').value = '';
  openModal('modal-allocate');
}

/**
 * Maneja el submit del formulario de aporte.
 * Si la meta se completa, registra la decisión automáticamente.
 * @param {Event} e
 */
async function handleAllocate(e) {
  e.preventDefault();
  const btn    = document.getElementById('allocate-btn');
  const amount = parseFloat(document.getElementById('allocate-amount').value);

  setButtonLoading(btn, 'Abonando...');

  try {
    const data = await goals.contribute(_allocateGoalId, amount);

    closeModal('modal-allocate');
    document.getElementById('form-allocate').reset();

    if (data.data.completed) {
      toast.success(`🎉 ¡Meta "${data.data.title}" completada!`);
      // Registrar decisión final automáticamente como 'saving' (dinero se mantiene)
      await _registerCompletion(data.data.goalId, 'saving');
    } else {
      toast.success('Abono registrado ✓');
      if (typeof loadAllData === 'function') await loadAllData();
    }
  } catch (err) {
    toast.error(err.message);
    setButtonReady(btn);
  }
}

/**
 * Llama al endpoint POST /goals/:id/complete para registrar la decisión
 * del usuario al completar una meta.
 * En el futuro se puede ampliar para mostrar un modal de elección.
 *
 * @param {number} goalId
 * @param {string} completionType — 'saving' por defecto
 */
async function _registerCompletion(goalId, completionType) {
  try {
    await apiFetch(`/goals/${goalId}/complete`, {
      method: 'POST',
      body:   JSON.stringify({ completionType }),
    });
    if (typeof loadAllData === 'function') await loadAllData();
  } catch (err) {
    toast.error(err.message);
  }
}

// ─── Modal eliminar ───────────────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación.
 * El modal muestra una advertencia sobre el impacto financiero:
 * los aportes ya realizados permanecen en el historial.
 *
 * @param {number} id
 * @param {string} title
 */
function openDeleteGoalModal(id, title) {
  _deleteGoalId = id;
  const el = document.getElementById('delete-goal-info');
  if (el) el.textContent = `Vas a eliminar la meta "${title}".`;
  openModal('modal-delete-goal');
}

/**
 * Ejecuta la eliminación y recarga el dashboard.
 *
 * COMPORTAMIENTO FINANCIERO:
 *   - Se borran: la fila en goals y todas las filas en goal_allocations.
 *   - NO se borran: las transacciones tipo 'saving' generadas en cada aporte.
 *   - El balance NO se revierte — el dinero ya salió en cada aporte.
 */
async function confirmDeleteGoal() {
  if (!_deleteGoalId) return;
  closeModal('modal-delete-goal');

  try {
    await goals.delete(_deleteGoalId);
    toast.success('Meta eliminada');
    _deleteGoalId = null;
    if (typeof loadAllData === 'function') await loadAllData();
  } catch (err) {
    toast.error(err.message);
    _deleteGoalId = null;
  }
}
