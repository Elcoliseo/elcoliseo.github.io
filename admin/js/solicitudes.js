// Solicitudes: pedidos de reserva que los clientes mandan desde la página.
// Acá se revisan, se aceptan (se cargan como reserva) o se rechazan.
window.Solicitudes = (() => {
  'use strict';

  const U = window.PanelUtil;
  const esc = U.esc;
  const $ = (sel) => document.querySelector(sel);

  const SPORT_NAMES = { f5: 'Fútbol 5', f6: 'Fútbol 6', padel: 'Pádel', quincho: 'Quincho' };
  const TIPO_OF = { f5: 'futbol5', f6: 'futbol6', padel: 'padel', quincho: 'quincho' };

  let db = null;
  let bound = false;
  let filter = 'nuevas';     // 'nuevas' | 'resueltas'
  let rows = [];
  let reservas = [];         // reservas de los días pedidos, para avisar si hay lugar
  let loadToken = 0;
  let lastCount = null;

  const listEl = $('#sol-list');
  const summary = $('#sol-summary');
  const badge = $('#sol-badge');

  const canchas = () => window.Reservas.getCanchas();
  const canchaName = (id) => window.Reservas.canchaName(id);

  // Cancha concreta que pidió el cliente ("cancha-4", "padel-1"...) o el quincho.
  const idFor = (s) => {
    if (s.recurso === 'quincho') return 'quincho';
    return s.recurso === 'padel' ? `padel-${s.cancha_n}` : `cancha-${s.cancha_n}`;
  };

  // Canchas que podrían servir para este pedido (si no eligió una, cualquiera del deporte).
  const candidates = (s) => {
    if (s.recurso === 'quincho') return ['quincho'];
    if (s.cancha_n) return [idFor(s)];
    return canchas().filter((c) => c.tipo === TIPO_OF[s.recurso]).map((c) => c.id);
  };

  const overlaps = (s, id) => reservas.filter((r) =>
    r.cancha_id === id && r.fecha === s.fecha && r.hora_inicio < s.hora_fin && r.hora_fin > s.hora_inicio);

  function availability(s) {
    const ids = candidates(s);
    const free = ids.filter((id) => overlaps(s, id).length === 0);
    const busy = ids.flatMap((id) => overlaps(s, id));
    return { ids, free, busy };
  }

  // ---------- Aviso en la pestaña ----------
  function setBadge(n) {
    badge.textContent = n;
    badge.hidden = !n;
    document.title = n ? `(${n}) Panel | El Coliseo` : 'Panel | El Coliseo';
  }

  async function refreshBadge() {
    const { count, error } = await db.from('solicitudes')
      .select('id', { count: 'exact', head: true }).eq('estado', 'nueva');
    if (error || count === null || count === undefined) return;
    if (lastCount !== null && count > lastCount) window.Reservas.toast('Llegó una solicitud nueva.');
    lastCount = count;
    setBadge(count);
  }

  // ---------- Inicio ----------
  function init(client) {
    db = client;
    if (!bound) {
      bound = true;

      document.querySelectorAll('[data-sol]').forEach((b) => b.addEventListener('click', () => {
        filter = b.dataset.sol;
        load();
      }));

      listEl.addEventListener('click', (e) => {
        const a = e.target.closest('[data-action]');
        if (!a) return;
        const s = rows.find((r) => r.id === a.closest('[data-id]').dataset.id);
        if (!s) return;
        if (a.dataset.action === 'accept') accept(s);
        if (a.dataset.action === 'reject') reject(s);
      });

      // Mientras el panel está abierto, se fija cada tanto si llegaron pedidos nuevos.
      setInterval(() => {
        if (!document.hidden && !$('#v-app').hidden) refreshBadge();
      }, 45000);
    }
    refreshBadge();
  }

  // ---------- Lista ----------
  async function load(quiet) {
    const token = ++loadToken;
    document.querySelectorAll('[data-sol]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.sol === filter)));
    if (!quiet) listEl.innerHTML = '<p class="adm-muted">Cargando…</p>';

    let q = db.from('solicitudes').select('*');
    q = filter === 'nuevas'
      ? q.eq('estado', 'nueva').order('fecha').order('hora_inicio')
      : q.neq('estado', 'nueva').order('resuelta_en', { ascending: false }).limit(50);
    const { data, error } = await q;
    if (token !== loadToken) return;
    if (error) {
      listEl.innerHTML = '<p class="adm-error">No se pudieron cargar las solicitudes. Revisá tu conexión.</p>';
      summary.textContent = '';
      return;
    }
    rows = data;

    reservas = [];
    if (filter === 'nuevas' && rows.length) {
      const dates = [...new Set(rows.map((r) => r.fecha))];
      const res = await db.from('reservas').select('cancha_id,fecha,hora_inicio,hora_fin,cliente')
        .in('fecha', dates).neq('estado', 'cancelada');
      if (token !== loadToken) return;
      reservas = res.data || [];
    }
    if (filter === 'nuevas') { lastCount = rows.length; setBadge(rows.length); }
    render();
  }

  function whereText(s) {
    const name = SPORT_NAMES[s.recurso];
    if (s.recurso === 'quincho') return 'Quincho con parrilla';
    if (s.recurso === 'padel') return s.cancha_n ? `Pádel ${s.cancha_n}` : 'Pádel, cualquier cancha';
    return s.cancha_n ? `${name}, cancha ${s.cancha_n}` : `${name}, cualquier cancha`;
  }

  function availabilityLine(s) {
    if (U.parseISO(s.fecha) < U.today()) return '<p class="sol-avail sol-avail--warn">La fecha pedida ya pasó.</p>';
    const a = availability(s);
    if (a.free.length) {
      const which = a.ids.length > 1 ? `: ${a.free.map((id) => esc(canchaName(id))).join(', ')}` : '';
      return `<p class="sol-avail sol-avail--ok">✓ Hay lugar${which}</p>`;
    }
    const who = a.busy.map((r) => `${U.fmtHour(r.hora_inicio)} a ${U.fmtHour(r.hora_fin)} (${esc(r.cliente)})`).join(', ');
    return `<p class="sol-avail sol-avail--warn">⚠ Ocupado: ${who}</p>`;
  }

  function card(s) {
    const open = s.estado === 'nueva';
    const lines = [];
    lines.push(`<strong>${esc(s.nombre)}</strong> · ${s.personas} ${s.personas === 1 ? 'persona' : 'personas'}`);
    if (s.tipo_evento) lines.push(esc(s.tipo_evento));
    if (s.notas) lines.push(`“${esc(s.notas)}”`);

    const status = open
      ? ''
      : `<span class="badge badge--${s.estado === 'aceptada' ? 'pagada' : 'cancelada'}">${s.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'}</span>`;
    const resolved = !open && s.resuelta_en
      ? `<p class="sol-by">${s.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'} ${U.fmtDateTime(s.resuelta_en)}${s.resuelta_por ? ' por ' + esc(s.resuelta_por) : ''}</p>`
      : '';

    return `
      <article class="sol-card${open ? '' : ' sol--resuelta'}" data-id="${s.id}">
        <header class="sol-head">
          <h3>${esc(whereText(s))}</h3>
          ${s.combo ? '<span class="badge badge--senada">Combo</span>' : ''}${status}
          <span class="sol-ago">${U.timeAgo(s.creado_en)}</span>
        </header>
        <p class="sol-when">${U.fmtDayLong(U.parseISO(s.fecha))} · ${U.fmtHour(s.hora_inicio)} a ${U.fmtHour(s.hora_fin)}</p>
        <p class="sol-who">${lines.join('<br>')}</p>
        ${open ? availabilityLine(s) : resolved}
        ${open ? `<div class="sol-actions">
          <button type="button" class="btn btn-primary" data-action="accept">Aceptar y cargar reserva</button>
          <button type="button" class="btn btn-danger-ghost" data-action="reject">Rechazar</button>
        </div>` : ''}
      </article>`;
  }

  function render() {
    if (filter === 'nuevas') {
      summary.textContent = rows.length
        ? `${rows.length} ${rows.length === 1 ? 'pedido esperando respuesta' : 'pedidos esperando respuesta'}`
        : 'No hay pedidos nuevos.';
      listEl.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="adm-empty">No hay solicitudes nuevas. Cuando un cliente complete el formulario de la página, el pedido aparece acá.</p>';
    } else {
      summary.textContent = rows.length ? `Últimas ${rows.length} resueltas` : '';
      listEl.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="adm-empty">Todavía no hay solicitudes resueltas.</p>';
    }
  }

  // ---------- Aceptar y rechazar ----------
  // Aceptar abre el formulario de reserva con los datos del cliente ya cargados.
  // Quien lo acepta agrega teléfono, seña y estado, y recién al guardar el pedido queda resuelto.
  function accept(s) {
    const a = availability(s);
    const target = a.free[0] || a.ids[0];

    window.Reservas.openForm(null, {
      title: 'Aceptar pedido',
      cancha_id: target,
      fecha: s.fecha,
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
      cliente: s.nombre,
      personas: s.personas,
      tipo_evento: s.tipo_evento || '',
      notas: s.notas || '',
      onSaved: async (reserva) => {
        const { data, error } = await db.from('solicitudes')
          .update({ estado: 'aceptada', reserva_id: reserva.id }).eq('id', s.id).select();
        if (error || !data || !data.length) {
          window.Reservas.toast('La reserva se guardó, pero el pedido quedó sin marcar. Rechazalo o recargá la página.');
        } else {
          window.Reservas.toast('Pedido aceptado y cargado como reserva.');
        }
        load(true);
        refreshBadge();
      },
    });
  }

  async function reject(s) {
    if (!window.confirm(`¿Rechazar el pedido de ${s.nombre}? Queda guardado como rechazado.`)) return;
    const { data, error } = await db.from('solicitudes').update({ estado: 'rechazada' }).eq('id', s.id).select();
    if (error || !data || !data.length) {
      window.Reservas.toast('No se pudo rechazar el pedido. Revisá tu conexión.');
      return;
    }
    window.Reservas.toast('Pedido rechazado.');
    load(true);
    refreshBadge();
  }

  window.PanelNav.register('solicitudes', {
    section: 'solicitudes', title: 'Solicitudes',
    fab: null,
    show: () => load(),
    reload: (quiet) => load(quiet),
  });

  return { init };
})();
