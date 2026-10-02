// Sección Quincho: calendario del mes con las fechas reservadas y la lista de reservas.
window.Quincho = (() => {
  'use strict';

  const U = window.PanelUtil;
  const esc = U.esc;
  const $ = (sel) => document.querySelector(sel);

  const QUINCHO = 'quincho';

  let db = null;
  let month = firstOfMonth(U.today());
  let rows = [];
  let loadToken = 0;

  const label = $('#q-month-label');
  const summary = $('#q-summary');
  const grid = $('#q-grid');
  const listEl = $('#q-list');
  const listTitle = $('#q-list-title');

  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  function init(client) {
    db = client;
    $('#q-prev').addEventListener('click', () => shift(-1));
    $('#q-next').addEventListener('click', () => shift(1));

    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.mcal-day');
      if (!cell) return;
      const date = cell.dataset.date;
      const mine = rows.filter((r) => r.fecha === date && r.estado !== 'cancelada')
        .sort((a, b) => a.hora_inicio - b.hora_inicio);
      if (mine.length) window.Reservas.openDetail(mine[0].id);
      else window.Reservas.openForm(null, { cancha_id: QUINCHO, fecha: date });
    });

    listEl.addEventListener('click', (e) => {
      const c = e.target.closest('.res-card');
      if (c) window.Reservas.openDetail(c.dataset.id);
    });
  }

  function shift(n) {
    month = new Date(month.getFullYear(), month.getMonth() + n, 1);
    load();
  }

  async function load(quiet) {
    const token = ++loadToken;
    label.textContent = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    if (!quiet) {
      grid.innerHTML = '<p class="adm-muted">Cargando…</p>';
      listEl.innerHTML = '';
    }

    const from = U.iso(month);
    const to = U.iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const { data, error } = await db.from('reservas').select('*')
      .eq('cancha_id', QUINCHO).gte('fecha', from).lte('fecha', to)
      .order('fecha').order('hora_inicio');
    if (token !== loadToken) return;
    if (error) {
      grid.innerHTML = '<p class="adm-error">No se pudieron cargar las reservas del quincho. Revisá tu conexión.</p>';
      summary.textContent = '';
      return;
    }
    rows = data;
    window.Reservas.remember(data);
    render();
  }

  function render() {
    const y = month.getFullYear();
    const m = month.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;   // la semana empieza el lunes
    const todayIso = U.iso(U.today());

    const active = rows.filter((r) => r.estado !== 'cancelada');
    const cancelled = rows.filter((r) => r.estado === 'cancelada');

    let cells = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
      .map((d) => `<span class="mcal-dow" aria-hidden="true">${d}</span>`).join('');
    cells += '<span></span>'.repeat(offset);

    for (let d = 1; d <= days; d++) {
      const date = U.iso(new Date(y, m, d));
      const mine = active.filter((r) => r.fecha === date).sort((a, b) => a.hora_inicio - b.hora_inicio);
      const cls = ['mcal-day'];
      if (date === todayIso) cls.push('is-today');
      if (mine.length) cls.push(`ag--${mine[0].estado}`, 'is-booked');
      const note = mine.length > 1 ? `<small>×${mine.length}</small>` : '';
      const aria = mine.length
        ? `${U.fmtDayLong(new Date(y, m, d))}: quincho reservado por ${mine.map((r) => r.cliente).join(' y ')}`
        : `${U.fmtDayLong(new Date(y, m, d))}: quincho libre. Tocar para reservar`;
      cells += `<button type="button" class="${cls.join(' ')}" data-date="${date}" aria-label="${esc(aria)}">${d}${note}</button>`;
    }

    grid.innerHTML = `
      <ul class="ag-legend" aria-label="Colores">
        <li><i class="ag-dot ag-dot--libre"></i>Libre</li>
        <li><i class="ag-dot ag-dot--pendiente"></i>Pendiente</li>
        <li><i class="ag-dot ag-dot--senada"></i>Señada</li>
        <li><i class="ag-dot ag-dot--pagada"></i>Pagada</li>
      </ul>
      <div class="mcal">${cells}</div>
      <p class="adm-muted ag-hint">Tocá un día libre para reservar el quincho, o un día marcado para ver la reserva.</p>`;

    summary.textContent = `${active.length} ${active.length === 1 ? 'reserva' : 'reservas'} este mes` +
      (cancelled.length ? ` · ${cancelled.length} ${cancelled.length === 1 ? 'cancelada' : 'canceladas'}` : '');

    listTitle.hidden = !rows.length;
    listEl.innerHTML = rows.length
      ? active.map((r) => window.Reservas.card(r, { withDate: true })).join('') +
        (cancelled.length ? '<h2 class="res-sep">Canceladas</h2>' +
          cancelled.map((r) => window.Reservas.card(r, { withDate: true })).join('') : '')
      : '<p class="adm-empty">No hay reservas del quincho este mes.</p>';
  }

  window.PanelNav.register('quincho', {
    section: 'quincho', title: 'Quincho',
    fab: {
      label: '+ Reservar quincho',
      click: () => {
        const t = U.today();
        const sameMonth = month.getFullYear() === t.getFullYear() && month.getMonth() === t.getMonth();
        window.Reservas.openForm(null, { cancha_id: QUINCHO, fecha: U.iso(sameMonth ? t : month) });
      },
    },
    show: () => load(),
    reload: (quiet) => load(quiet),
  });

  return { init };
})();
