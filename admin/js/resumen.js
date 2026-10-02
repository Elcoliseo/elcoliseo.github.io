// Sección Resumen: reservas, canceladas y dinero del día, la semana o el mes.
window.Resumen = (() => {
  'use strict';

  const U = window.PanelUtil;
  const esc = U.esc;
  const $ = (sel) => document.querySelector(sel);

  const PAGE = 1000;         // la base de datos entrega como máximo 1000 filas por pedido

  let db = null;
  let bound = false;
  let period = 'dia';        // 'dia' | 'semana' | 'mes'
  let anchor = U.today();    // día de referencia del período que se está mirando
  let loadToken = 0;

  const body = $('#rs-body');
  const label = $('#rs-label');

  // ---------- Períodos ----------
  function rangeOf() {
    if (period === 'dia') return [anchor, anchor];
    if (period === 'semana') {
      const start = U.addDays(anchor, -((anchor.getDay() + 6) % 7));   // lunes
      return [start, U.addDays(start, 6)];
    }
    return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)];
  }

  function labelText([from, to]) {
    if (period === 'dia') return U.fmtDayLong(from);
    if (period === 'semana') return `Semana del ${U.fmtDayShort(from)} al ${U.fmtDayShort(to)}`;
    return from.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  function shift(n) {
    if (period === 'dia') anchor = U.addDays(anchor, n);
    else if (period === 'semana') anchor = U.addDays(anchor, 7 * n);
    else anchor = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    load();
  }

  function init(client) {
    db = client;
    if (bound) return;
    bound = true;

    $('#rs-prev').addEventListener('click', () => shift(-1));
    $('#rs-next').addEventListener('click', () => shift(1));
    document.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => {
      period = b.dataset.period;
      anchor = U.today();
      load();
    }));
  }

  // ---------- Cálculos ----------
  const sum = (list, fn) => list.reduce((t, r) => t + fn(r), 0);

  // Dinero que ya entró: la seña de las señadas y el total de las pagadas.
  const income = (r) => {
    if (r.estado === 'pagada') return Math.max(r.monto_total, r.sena);
    if (r.estado === 'senada') return r.sena;
    return 0;
  };
  const owed = (r) => (r.estado === 'pagada' ? 0 : Math.max(0, r.monto_total - r.sena));

  async function load(quiet) {
    const token = ++loadToken;
    const [from, to] = rangeOf();
    label.textContent = labelText([from, to]);
    document.querySelectorAll('[data-period]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.period === period)));
    if (!quiet) body.innerHTML = '<p class="adm-muted">Cargando…</p>';

    const { data, error } = await db.from('reservas').select('*')
      .gte('fecha', U.iso(from)).lte('fecha', U.iso(to)).order('fecha');
    if (token !== loadToken) return;
    if (error) {
      body.innerHTML = '<p class="adm-error">No se pudo calcular el resumen. Revisá tu conexión.</p>';
      return;
    }
    render(data, [from, to], data.length >= PAGE);
  }

  // ---------- Pantalla ----------
  const metric = (title, value, hint, cls = '') =>
    `<div class="metric ${cls}"><p class="metric-title">${title}</p><p class="metric-value">${value}</p>${hint ? `<p class="metric-hint">${hint}</p>` : ''}</div>`;

  function render(rows, [from, to], truncated) {
    const active = rows.filter((r) => r.estado !== 'cancelada');
    const cancelled = rows.filter((r) => r.estado === 'cancelada');

    const cobrado = sum(active, income);
    const porCobrar = sum(active, owed);
    const senasCanceladas = sum(cancelled, (r) => r.sena);

    const estados = ['pendiente', 'senada', 'pagada'].map((e) => {
      const list = active.filter((r) => r.estado === e);
      return `<li><span class="badge badge--${e}">${U.ESTADOS[e]}</span>
        <span class="rs-count">${list.length}</span>
        <span class="rs-money">${U.fmtMoney(sum(list, income))}</span></li>`;
    }).join('');

    const canchas = window.Reservas.getCanchas();
    const tipos = Object.entries(U.TIPOS).map(([tipo, nombre]) => {
      const ids = new Set(canchas.filter((c) => c.tipo === tipo).map((c) => c.id));
      const list = active.filter((r) => ids.has(r.cancha_id));
      return `<li><span class="rs-name">${nombre}</span>
        <span class="rs-count">${list.length}</span>
        <span class="rs-money">${U.fmtMoney(sum(list, income))}</span></li>`;
    }).join('');

    let perDay = '';
    if (period !== 'dia') {
      const days = [];
      for (let d = from; d <= to; d = U.addDays(d, 1)) days.push(d);
      const stats = days.map((d) => {
        const list = active.filter((r) => r.fecha === U.iso(d));
        return { d, n: list.length, money: sum(list, income) };
      });
      const max = Math.max(1, ...stats.map((s) => s.n));
      perDay = `
        <h2 class="rs-title">Por día</h2>
        <ul class="rs-days">
          ${stats.map((s) => `
            <li>
              <span class="rs-day">${esc(U.fmtDayShort(s.d))}</span>
              <span class="rs-bar" role="img" aria-label="${s.n} reservas"><i style="width:${(s.n / max) * 100}%"></i></span>
              <span class="rs-count">${s.n}</span>
              <span class="rs-money">${U.fmtMoney(s.money)}</span>
            </li>`).join('')}
        </ul>`;
    }

    body.innerHTML = `
      ${truncated ? '<p class="conflict">⚠ Hay muchísimas reservas en este período y el resumen puede estar incompleto. Probá con una semana o un día.</p>' : ''}
      <div class="metrics">
        ${metric('Reservas', active.length, '')}
        ${metric('Canceladas', cancelled.length, '', 'metric--muted')}
        ${metric('Dinero ingresado', U.fmtMoney(cobrado), 'Señas de las señadas + total de las pagadas', 'metric--main')}
        ${metric('Por cobrar', U.fmtMoney(porCobrar), 'Lo que falta de las reservas no pagadas', 'metric--wide')}
      </div>

      <h2 class="rs-title">Por estado</h2>
      <ul class="rs-list">${estados}</ul>

      <h2 class="rs-title">Por deporte</h2>
      <ul class="rs-list">${tipos}</ul>

      ${perDay}

      ${senasCanceladas > 0 ? `<p class="adm-muted rs-note">Las reservas canceladas tenían ${U.fmtMoney(senasCanceladas)} en señas cargadas. No se suman al dinero ingresado: revisá si se devolvieron o se retuvieron.</p>` : ''}
      ${!rows.length ? '<p class="adm-empty">No hay reservas en este período.</p>' : ''}`;
  }

  window.PanelNav.register('resumen', {
    section: 'resumen', title: 'Resumen',
    fab: null,
    show: () => load(),
    reload: (quiet) => load(quiet),
  });

  return { init };
})();
