/**
 * @file frontend/js/script.js
 * @description Sidebar móvil del dashboard.
 *
 * En pantallas < 1024px el sidebar está fuera de pantalla (transform: translateX(-100%)).
 * Este script lo desliza dentro (añade .open) al tocar ☰, y lo desliza fuera
 * al tocar el overlay, al tocar un enlace/botón del sidebar, o al pulsar Escape.
 *
 * La clase .open también se aplica al #sidebar-overlay para mostrar el fondo oscuro.
 * El CSS de transición está en dashboard.css.
 *
 * Depende de: dashboard.html (IDs: sidebar, sidebar-overlay, btn-menu).
 */

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const btnMenu = document.getElementById('btn-menu');

/** Abre el sidebar y el overlay. */
function openSidebar() {
  sidebar?.classList.add('open');
  overlay?.classList.add('open');
  // Mover foco al primer enlace del sidebar (accesibilidad)
  sidebar?.querySelector('a, button')?.focus();
}

/** Cierra el sidebar y el overlay. */
function closeSidebar() {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
  // Devolver foco al botón de menú (accesibilidad)
  btnMenu?.focus();
}

// Abrir con el botón hamburguesa
btnMenu?.addEventListener('click', openSidebar);

// Cerrar al tocar el overlay (zona oscura fuera del sidebar)
overlay?.addEventListener('click', closeSidebar);

// Cerrar con la tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
    closeSidebar();
  }
});

// Cerrar automáticamente al tocar cualquier elemento interactivo del sidebar en móvil.
// Esto da sensación nativa: el usuario navega y el menú se cierra solo.
sidebar?.addEventListener('click', (e) => {
  if (window.innerWidth >= 1024) return; // solo en móvil
  const target = e.target.closest('a, button, [data-scroll]');
  if (target) closeSidebar();
});
