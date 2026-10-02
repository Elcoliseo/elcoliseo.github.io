// Sección Eventos y torneos: nombre, fecha, canchas que usa e inscriptos.
window.Eventos = (() => {
  'use strict';

  const U = window.PanelUtil;
  const esc = U.esc;
  const $ = (sel) => document.querySelector(sel);

  const TIPOS_EVENTO = { torneo: 'Torneo', evento: 'Evento' };

  let db = null;
  let bound = false;
  let rows = [];
  let editing = null;
  let overlapKey = null;     // aviso de reservas ya mostrado (para guardar igual al segundo toque)
  let loadToken = 0;

  const listEl = $('#ev-list');
  const summary = $('#ev-summary');
  const dlg = $('#dlg-evento');
  const f = {
    form:      $('#ev-form'),
    title:     $('#ev-title'),
    nombre:    $('#ev-nombre'),
    tipo:      $('#ev-tipo'),
    fecha:     $('#ev-fecha'),
    canchas:   $('#ev-canchas'),
    inscritos: $('#ev-inscriptos'),
    notas:     $('#ev-notas'),
    warn:      $('#ev-warn'),
    error:     $('#ev-error'),
    save:      $('#ev-save'),
  };

  const canchas = () => window.Reservas.getCanchas();
  const canchaName = (id) => window.Reservas.canchaName(id);

  function init(client) {
    db = client;
    if (bound) return;
    bound = true;

    f.tipo.innerHTML = Object.entries(TIPOS_EVENTO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    f.canchas.innerHTML = canchas().map((c) =>
      `<label class="check-chip"><input type="checkbox" name="ev-cancha" value="${esc(c.id)}"><span>${esc(c.nombre)}</span></label>`).join('');

    f.form.addEventListener('submit', save);
    $('#ev-all').addEventListener('click', () => {
      const boxes = [...f.canchas.querySelectorAll('input')].filter((i) => i.value !== 'quincho');
      const all = boxes.every((i) => i.checked);
      boxes.forEach((i) => { i.checked = !all; });
      overlapKey = null;
    });
    [f.fecha, f.canchas].forEach((el) => el.addEventListener('change', () => { overlapKey = null; f.warn.hidden = true; f.save.textContent = 'Guardar'; }));

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });

    listEl.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      const ev = rows.find((r) => r.id === a.closest('[data-id]').dataset.id);
      if (!ev) return;
      if (a.dataset.action === 'edit') openForm(ev);
      if (a.dataset.action === 'toggle') toggleCancel(ev);
    });
  }

  // ---------- Lista ----------
  async function load(quiet) {
    const token = ++loadToken;
    if (!quiet) listEl.innerHTML = '<p class="adm-muted">Cargando…</p>';
    const { data, error } = await db.from('eventos').select('*').order('fecha');
    if (token !== loadToken) return;
    if (error) {
      listEl.innerHTML = '<p class="adm-error">No se pudieron cargar los eventos. Revisá tu conexión.</p>';
      summary.textContent = '';
      return;
    }
    rows = data;
    render();
  }

  function eventCard(ev) {
    const d = U.parseISO(ev.fecha);
    const names = (ev.canchas || []).map(canchaName);
    return `
      <article class="ev-card${ev.cancelado ? ' ev--cancelado' : ''}" data-id="${ev.id}">
        <div class="ev-date">${d.getDate()}<small>${d.toLocaleDateString('es-AR', { month: 'short' })}</small></div>
        <div class="ev-main">
          <h3>${esc(ev.nombre)} <span class="badge badge--${ev.tipo === 'torneo' ? 'senada' : 'pendiente'}">${TIPOS_EVENTO[ev.tipo]}</span>${ev.cancelado ? ' <span class="badge badge--cancelada">Cancelado</span>' : ''}</h3>
          <p>${U.fmtDayLong(d)}</p>
          <p class="adm-muted">${names.length ? 'Canchas: ' + esc(names.join(', ')) : 'Sin canchas indicadas'}</p>
          <p class="adm-muted">${ev.inscriptos} ${ev.inscriptos === 1 ? 'inscripto' : 'inscriptos'}</p>
          ${ev.notas ? `<p class="adm-muted">${esc(ev.notas)}</p>` : ''}
          ${ev.creado_por ? `<p class="ev-by">Cargado por ${esc(ev.creado_por)}</p>` : ''}
        </div>
        <div class="ev-actions">
          <button type="button" class="btn btn-ghost" data-action="edit">Editar</button>
          <button type="button" class="btn ${ev.cancelado ? 'btn-ghost' : 'btn-danger-ghost'}" data-action="toggle">${ev.cancelado ? 'Reactivar' : 'Cancelar'}</button>
        </div>
      </article>`;
  }

  function render() {
    const today = U.iso(U.today());
    const upcoming = rows.filter((e) => e.fecha >= today && !e.cancelado);
    const cancelled = rows.filter((e) => e.fecha >= today && e.cancelado);
    const past = rows.filter((e) => e.fecha < today).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    summary.textContent = `${upcoming.length} ${upcoming.length === 1 ? 'próximo' : 'próximos'}` +
      (past.length ? ` · ${past.length} ${past.length === 1 ? 'anterior' : 'anteriores'}` : '');

    if (!rows.length) {
      listEl.innerHTML = '<p class="adm-empty">Todavía no hay eventos ni torneos. Tocá “Nuevo evento” para cargar el primero.</p>';
      return;
    }

    listEl.innerHTML =
      (upcoming.length ? upcoming.map(eventCard).join('') : '<p class="adm-empty">No hay eventos próximos.</p>') +
      (cancelled.length ? '<h2 class="res-sep">Cancelados</h2>' + cancelled.map(eventCard).join('') : '') +
      (past.length ? `<details class="ev-past"><summary>Anteriores (${past.length})</summary>${past.map(eventCard).join('')}</details>` : '');
  }

  // ---------- Formulario ----------
  function openForm(ev) {
    editing = ev || null;
    overlapKey = null;
    f.title.textContent = ev ? 'Editar evento' : 'Nuevo evento';
    f.error.hidden = true;
    f.warn.hidden = true;
    f.save.textContent = 'Guardar';

    f.nombre.value = ev ? ev.nombre : '';
    f.tipo.value = ev ? ev.tipo : 'torneo';
    f.fecha.value = ev ? ev.fecha : U.iso(U.today());
    f.inscritos.value = ev ? ev.inscriptos : '';
    f.notas.value = ev && ev.notas ? ev.notas : '';
    const selected = new Set(ev ? ev.canchas : []);
    f.canchas.querySelectorAll('input').forEach((i) => { i.checked = selected.has(i.value); });

    dlg.showModal();
  }

  function read() {
    return {
      nombre:     f.nombre.value.trim(),
      tipo:       f.tipo.value,
      fecha:      f.fecha.value,
      canchas:    [...f.canchas.querySelectorAll('input:checked')].map((i) => i.value),
      inscriptos: Number(f.inscritos.value || 0),
      notas:      f.notas.value.trim() || null,
    };
  }

  // Reservas ya cargadas en esas canchas ese día (se avisa, pero no se bloquea).
  async function overlapping(r) {
    if (!r.canchas.length) return [];
    const { data } = await db.from('reservas')
      .select('cancha_id,hora_inicio,hora_fin,cliente')
      .eq('fecha', r.fecha).neq('estado', 'cancelada').in('cancha_id', r.canchas);
    return data || [];
  }

  async function save(e) {
    e.preventDefault();
    f.error.hidden = true;
    const r = read();

    if (!r.nombre) { f.error.textContent = 'Escribí el nombre del evento.'; f.error.hidden = false; return; }
    if (!r.fecha) { f.error.textContent = 'Elegí la fecha.'; f.error.hidden = false; return; }
    if (r.inscriptos < 0) { f.error.textContent = 'Los inscriptos no pueden ser negativos.'; f.error.hidden = false; return; }

    f.save.disabled = true;

    // Aviso (una sola vez) si ya hay reservas en esas canchas ese día.
    const key = r.fecha + '|' + r.canchas.join(',');
    if (overlapKey !== key) {
      const clashes = await overlapping(r);
      if (clashes.length) {
        overlapKey = key;
        f.warn.innerHTML = '⚠ Ya hay reservas ese día en esas canchas: ' +
          clashes.map((c) => `${esc(canchaName(c.cancha_id))} ${U.fmtHour(c.hora_inicio)} a ${U.fmtHour(c.hora_fin)} (${esc(c.cliente)})`).join(', ') +
          '. Si querés guardar el evento igual, tocá “Guardar igual”.';
        f.warn.hidden = false;
        f.save.textContent = 'Guardar igual';
        f.save.disabled = false;
        return;
      }
    }

    f.save.textContent = 'Guardando…';
    const query = editing
      ? db.from('eventos').update(r).eq('id', editing.id).select()
      : db.from('eventos').insert(r).select();
    const { data, error } = await query;
    f.save.disabled = false;
    f.save.textContent = 'Guardar';

    if (error || !data || !data.length) {
      console.error(error);
      f.error.textContent = 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.';
      f.error.hidden = false;
      return;
    }
    dlg.close();
    window.Reservas.toast(editing ? 'Evento actualizado.' : 'Evento guardado.');
    load(true);
  }

  async function toggleCancel(ev) {
    const next = !ev.cancelado;
    const ok = window.confirm(next
      ? `¿Cancelar “${ev.nombre}”? Queda guardado como cancelado y se puede reactivar.`
      : `¿Reactivar “${ev.nombre}”?`);
    if (!ok) return;
    const { data, error } = await db.from('eventos').update({ cancelado: next }).eq('id', ev.id).select();
    if (error || !data || !data.length) {
      window.Reservas.toast('No se pudo actualizar el evento.');
      return;
    }
    window.Reservas.toast(next ? 'Evento cancelado.' : 'Evento reactivado.');
    load(true);
  }

  window.PanelNav.register('eventos', {
    section: 'eventos', title: 'Eventos y torneos',
    fab: { label: '+ Nuevo evento', click: () => openForm(null) },
    show: () => load(),
    reload: (quiet) => load(quiet),
  });

  return { init };
})();
