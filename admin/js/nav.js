// Pestañas del panel. Cada sección se "registra" acá y este archivo se encarga de
// mostrar la correcta, cambiar el título y el botón flotante de abajo a la derecha.
window.PanelNav = (() => {
  'use strict';

  const views = {};
  let current = null;
  let bound = false;

  const $ = (sel) => document.querySelector(sel);

  // def: { section, title, fab: { label, click } | null, show(), reload(quiet) }
  function register(name, def) { views[name] = def; }

  function remember(name) {
    try { localStorage.setItem('coliseo.vista', name); } catch (e) { /* no pasa nada */ }
  }
  function recall() {
    try { return localStorage.getItem('coliseo.vista'); } catch (e) { return null; }
  }

  function go(name) {
    const def = views[name];
    if (!def) return;
    current = name;
    remember(name);

    document.querySelectorAll('.adm-tabs [data-view]').forEach((b) => {
      const on = b.dataset.view === name;
      b.setAttribute('aria-current', on ? 'page' : 'false');
      // En el celular la barra se desliza: se asegura de que la pestaña activa quede a la vista.
      if (on && b.scrollIntoView) b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    });
    document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = s.dataset.section !== def.section; });
    $('#view-title').textContent = def.title;

    const fab = $('#new-res');
    fab.hidden = !def.fab;
    if (def.fab) fab.textContent = def.fab.label;

    if (def.show) def.show();
  }

  function start() {
    if (!bound) {
      bound = true;
      document.querySelectorAll('.adm-tabs [data-view]').forEach((b) =>
        b.addEventListener('click', () => go(b.dataset.view)));
      $('#new-res').addEventListener('click', () => {
        const def = views[current];
        if (def && def.fab) def.fab.click();
      });
    }
    const saved = recall();
    go(views[saved] ? saved : 'calendario');
  }

  // Vuelve a pedir los datos de la pestaña que se está viendo.
  function refresh() {
    const def = views[current];
    if (def && def.reload) def.reload(true);
  }

  return { register, start, go, refresh, current: () => current };
})();
