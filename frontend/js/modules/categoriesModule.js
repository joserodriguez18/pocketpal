/**
 * @file frontend/js/modules/categoriesModule.js
 * @description Módulo CRUD de categorías personalizadas del usuario.
 *
 * Las categorías tienen dos scopes:
 *   'global' — del sistema (db/init.js). Solo lectura para el usuario.
 *   'custom' — creadas por el usuario. Se pueden editar y eliminar.
 *
 * Estado interno:
 *   _deleteCategoryId — ID activo en el modal de eliminación
 *
 * Expone como globales:
 *   renderCategories(list)
 *   openCreateCategoryModal()
 *   openEditCategoryModal(cat)
 *   openDeleteCategoryModal(id, name)
 *   handleSubmitCategory(e)
 *   confirmDeleteCategory()
 *
 * Depende de:
 *   api.js     → categories, toast
 *   ui.js      → openModal, closeModal, setButtonLoading, setButtonReady
 *   dashboard.js → loadAllData (global)
 */

let _deleteCategoryId = null;

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Renderiza las categorías en #categories-list.
 * Las custom aparecen como pills editables con botones ✏ y ✕.
 * Las globales aparecen en un bloque separado de solo lectura.
 *
 * @param {Array} list — respuesta de GET /api/categories
 */
function renderCategories(list) {
  const container = document.getElementById('categories-list');
  if (!container) return;

  const custom = list.filter((c) => c.scope === 'custom');
  const global = list.filter((c) => c.scope === 'global');

  let html = '';

  if (custom.length > 0) {
    html += custom.map((c) => {
      const catJson = JSON.stringify(c).replace(/"/g, '&quot;');
      const typeCls = c.type === 'income' ? 'badge-income' : 'badge-expense';
      const typeTxt = c.type === 'income' ? '↑ Ingreso' : '↓ Gasto';

      return `
        <div class="cat-pill">
          <span class="badge ${typeCls} cat-pill-badge">${typeTxt}</span>
          <span class="cat-pill-name">${_escapeHtml(c.name)}</span>
          <button class="btn-icon-plain"
            data-action="edit-category" data-cat="${catJson}"
            title="Editar" aria-label="Editar categoría ${_escapeHtml(c.name)}">✏</button>
          <button class="btn-icon-plain btn-icon-danger"
            data-action="delete-category"
            data-id="${c.id}"
            data-name="${_escapeHtml(c.name)}"
            title="Eliminar" aria-label="Eliminar categoría ${_escapeHtml(c.name)}">✕</button>
        </div>`;
    }).join('');
  } else {
    html += `<p class="text-dim" style="width:100%">Aún no tienes categorías propias.</p>`;
  }

  if (global.length > 0) {
    html += `
      <div class="global-cats-section">
        <p class="global-cats-label">Globales del sistema (${global.length}) — solo lectura</p>
        <div class="global-cats-list">
          ${global.map((c) => {
            const typeCls = c.type === 'income' ? 'badge-income' : 'badge-expense';
            return `<span class="badge ${typeCls}">${_escapeHtml(c.name)}</span>`;
          }).join('')}
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

/** Escapa texto para prevenir XSS al embeber en atributos HTML. */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Delegación de eventos para editar y eliminar categorías.
 */
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-action="edit-category"]');
  if (editBtn) {
    openEditCategoryModal(JSON.parse(editBtn.dataset.cat.replace(/&quot;/g, '"')));
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete-category"]');
  if (deleteBtn) {
    openDeleteCategoryModal(parseInt(deleteBtn.dataset.id), deleteBtn.dataset.name);
  }
});

// ─── Modal crear ──────────────────────────────────────────────────────────────

function openCreateCategoryModal() {
  document.getElementById('category-id').value                    = '';
  document.getElementById('form-category').reset();
  document.getElementById('modal-category-title').textContent     = 'Nueva categoría';
  document.getElementById('submit-category-btn').textContent      = 'Crear';
  openModal('modal-category');
}

// ─── Modal editar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal en modo editar con los datos pre-rellenos.
 * @param {{ id, name, type }} cat
 */
function openEditCategoryModal(cat) {
  document.getElementById('category-id').value                = cat.id;
  document.getElementById('category-name').value              = cat.name;
  document.getElementById('category-type').value              = cat.type;
  document.getElementById('modal-category-title').textContent = 'Editar categoría';
  document.getElementById('submit-category-btn').textContent  = 'Actualizar';
  openModal('modal-category');
}

// ─── Submit ───────────────────────────────────────────────────────────────────

/**
 * Maneja el submit del formulario de categoría (crear o editar).
 * @param {Event} e
 */
async function handleSubmitCategory(e) {
  e.preventDefault();
  const btn    = document.getElementById('submit-category-btn');
  const catId  = document.getElementById('category-id').value;
  const isEdit = !!catId;

  setButtonLoading(btn, isEdit ? 'Actualizando...' : 'Creando...');

  const payload = {
    name: document.getElementById('category-name').value.trim(),
    type: document.getElementById('category-type').value,
  };

  try {
    if (isEdit) {
      await categories.update(catId, payload);
      toast.success('Categoría actualizada ✓');
    } else {
      await categories.create(payload);
      toast.success('Categoría creada ✓');
    }
    closeModal('modal-category');
    document.getElementById('form-category').reset();
    // Recargar para actualizar los selects de categoría en el modal de transacción
    if (typeof loadAllData === 'function') await loadAllData();
  } catch (err) {
    toast.error(err.message);
    setButtonReady(btn);
  }
}

// ─── Modal eliminar ───────────────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación.
 * El backend responde 409 si la categoría tiene transacciones asociadas.
 *
 * @param {number} id
 * @param {string} name
 */
function openDeleteCategoryModal(id, name) {
  _deleteCategoryId = id;
  const el = document.getElementById('delete-category-info');
  if (el) {
    el.textContent =
      `¿Seguro que quieres eliminar la categoría "${name}"? ` +
      `Solo se puede eliminar si no tiene transacciones asociadas.`;
  }
  openModal('modal-delete-category');
}

/**
 * Ejecuta la eliminación de _deleteCategoryId.
 * El backend retorna 409 si la categoría está en uso — se muestra el mensaje al usuario.
 */
async function confirmDeleteCategory() {
  if (!_deleteCategoryId) return;
  closeModal('modal-delete-category');

  try {
    await categories.delete(_deleteCategoryId);
    toast.success('Categoría eliminada');
    _deleteCategoryId = null;
    if (typeof loadAllData === 'function') await loadAllData();
  } catch (err) {
    // El backend devuelve un mensaje descriptivo si está en uso (409 CONFLICT)
    toast.error(err.message);
    _deleteCategoryId = null;
  }
}
