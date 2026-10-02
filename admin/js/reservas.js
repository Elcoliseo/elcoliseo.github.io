// Reservas: calendario del día, lista, detalle, formulario, cancelación e historial.
// Las otras secciones (quincho, resumen) usan las funciones que se exponen al final.
window.Reservas = (() => {
  'use strict';

  const U = window.PanelUtil;
  const esc = U.esc;
  const $ = (sel, root = document) => root.querySelector(sel);

  let db = null;
  let bound = false;
  let canchas = [];
  let canchaById = {};
  const known = new Map();   // reservas que ya se vieron en pantalla, por id
  let view = 'calendario';   // 'calendario' o 'lista'
  let day = U.today();       // día que se está mirando
  let rows = [];             // reservas de ese día
  let editing = null;        // reserva que se está editando (null = reserva nueva)
  let detailId = null;       // reserva abierta en el detalle
  let loadToken = 0;
  let conflictToken = 0;

  // ---------- Elementos de la pantalla ----------
  const list = $('#day-list');
  const gridBox = $('#day-grid');
  const agenda = $('#agenda');
  const summary = $('#day-summary');
  const dayInput = $('#day-input');
  const dayLabel = $('#day-label');
  const dlgForm = $('#dlg-form');
  const dlgDetail = $('#dlg-detail');
  const dlgCancel = $('#dlg-cancel');
  const toastEl = $('#toast');

  const f = {
    form:      $('#res-form'),
    title:     $('#form-title'),
    cancha:    $('#r-cancha'),
    fecha:     $('#r-fecha'),
    estado:    $('#r-estado'),
    desde:     $('#r-desde'),
    hasta:     $('#r-hasta'),
    cliente:   $('#r-cliente'),
    telefono:  $('#r-telefono'),
    personas:  $('#r-personas'),
    evento:    $('#r-evento'),
    eventoBox: $('#r-evento-box'),
    total:     $('#r-total'),
    sena:      $('#r-sena'),
    prices:    $('#r-prices'),
    notas:     $('#r-notas'),
    conflict:  $('#r-conflict'),
    error:     $('#r-error'),
    save:      $('#r-save'),
  };

  const canchaName = (id) => (canchaById[id] ? canchaById[id].nombre : id);
  const timeRange = (r) => `${U.fmtHour(r.hora_inicio)} a ${U.fmtHour(r.hora_fin)}`;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  }

  const remember = (list_) => list_.forEach((r) => known.set(r.id, r));

  // ---------- Inicio ----------
  async function init(client) {
    db = client;
    if (canchas.length) return true;

    const { data, error } = await db.from('canchas').select('*').order('orden');
    if (error) {
      list.innerHTML = '<p class="adm-error">No se pudieron cargar las canchas. Revisá tu conexión y recargá la página.</p>';
      return false;
    }
    canchas = data;
    canchaById = Object.fromEntries(data.map((c) => [c.id, c]));
    buildCanchaSelect();
    buildEstadoSelect();
    buildEventoSelect();
    buildDesdeSelect();
    if (!bound) bind();
    return true;
  }

  // ---------- Elegir día ----------
  function setDay(d) {
    day = d;
    dayInput.value = U.iso(d);
    const t = U.today();
    const diff = Math.round((d - t) / 86400000);
    const extra = diff === 0 ? 'Hoy · ' : diff === 1 ? 'Mañana · ' : diff === -1 ? 'Ayer · ' : '';
    dayLabel.textContent = extra + U.fmtDayLong(d);
    loadDay();
  }

  function renderAll() {
    if (view === 'calendario') renderGrid(); else renderList();
  }

  // quiet = true: se vuelve a pedir la información sin tapar la pantalla con "Cargando…".
  async function loadDay(quiet) {
    const token = ++loadToken;
    if (!quiet) {
      const loading = '<p class="adm-muted">Cargando…</p>';
      list.innerHTML = loading;
      agenda.innerHTML = loading;
    }
    const { data, error } = await db
      .from('reservas').select('*')
      .eq('fecha', U.iso(day))
      .order('hora_inicio');
    if (token !== loadToken) return;      // el usuario ya cambió de día
    if (error) {
      const msg = '<p class="adm-error">No se pudieron cargar las reservas. Revisá tu conexión.</p>';
      list.innerHTML = msg;
      agenda.innerHTML = msg;
      summary.textContent = '';
      return;
    }
    rows = data;
    remember(data);
    renderAll();
  }

  // ---------- Calendario del día ----------
  // Canchas en filas y horas en columnas. Una reserva ocupa tantas columnas como horas dura.
  function renderGrid() {
    const hours = U.range(U.HOURS.firstStart, U.HOURS.lastStart + 1);
    const active = rows.filter((r) => r.estado !== 'cancelada');

    const now = new Date();
    const isToday = U.iso(day) === U.iso(U.today());
    const nowHour = now.getHours() < 3 ? now.getHours() + 24 : now.getHours();

    let html = '<div class="agenda">';
    html += '<div class="ag-corner" style="grid-row:1;grid-column:1"></div>';
    html += hours.map((h, i) =>
      `<div class="ag-hour${isToday && h === nowHour ? ' is-now' : ''}" style="grid-row:1;grid-column:${i + 2}">${U.fmtHour(h)}</div>`).join('');

    let lastTipo = null;
    canchas.forEach((c, ri) => {
      const row = ri + 2;
      const groupStart = lastTipo !== null && c.tipo !== lastTipo;
      lastTipo = c.tipo;
      const edge = groupStart ? ' ag-group' : '';

      html += `<div class="ag-name${edge}" style="grid-row:${row};grid-column:1"><strong>${esc(c.nombre)}</strong>` +
        `<small>${esc(U.TIPOS[c.tipo])}</small></div>`;

      const mine = active.filter((r) => r.cancha_id === c.id);

      hours.forEach((h, i) => {
        if (mine.some((r) => r.hora_inicio <= h && h < r.hora_fin)) return;
        html += `<button type="button" class="ag-free${edge}" style="grid-row:${row};grid-column:${i + 2}"` +
          ` data-cancha="${esc(c.id)}" data-hour="${h}"` +
          ` aria-label="${esc(c.nombre)}, ${U.fmtHour(h)} a ${U.fmtHour(h + 1)}: libre. Tocar para reservar">Libre</button>`;
      });

      mine.forEach((r) => {
        const col = hours.indexOf(r.hora_inicio) + 2;
        const span = r.hora_fin - r.hora_inicio;
        html += `<button type="button" class="ag-res ag--${r.estado}" style="grid-row:${row};grid-column:${col} / span ${span}"` +
          ` data-id="${r.id}"` +
          ` aria-label="${esc(c.nombre)}, ${timeRange(r)}: ${esc(r.cliente)}, ${U.ESTADOS[r.estado].toLowerCase()}">` +
          `<strong>${esc(r.cliente)}</strong>` +
          (span > 1 ? `<small>${timeRange(r)}</small>` : '') +
          '</button>';
      });
    });
    html += '</div>';
    agenda.innerHTML = html;

    // Resumen: cuántos turnos de cancha están ocupados y si el quincho está reservado.
    const courtCount = canchas.filter((c) => c.tipo !== 'quincho').length;
    const total = courtCount * hours.length;
    const used = active.filter((r) => r.cancha_id !== 'quincho')
      .reduce((sum, r) => sum + (r.hora_fin - r.hora_inicio), 0);
    const quincho = active.some((r) => canchaById[r.cancha_id] && canchaById[r.cancha_id].tipo === 'quincho');
    summary.textContent = `${used} de ${total} turnos de cancha ocupados · Quincho ${quincho ? 'reservado' : 'libre'}`;
  }

  // ---------- Lista del día ----------
  function byTime(a, b) {
    return a.hora_inicio - b.hora_inicio ||
      (canchaById[a.cancha_id]?.orden ?? 0) - (canchaById[b.cancha_id]?.orden ?? 0);
  }

  // Tarjeta de una reserva (se usa también en la sección Quincho).
  function card(r, opts = {}) {
    const cancelled = r.estado === 'cancelada';
    const parts = [];
    if (r.telefono) parts.push(esc(r.telefono));
    if (r.personas) parts.push(`${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`);
    if (r.tipo_evento) parts.push(esc(r.tipo_evento));

    let money = '';
    if (cancelled) {
      money = `Cancelada el ${U.fmtDateTime(r.cancelada_en)}${r.cancelada_por ? ' por ' + esc(r.cancelada_por) : ''}`;
    } else if (r.monto_total || r.sena) {
      money = `Seña ${U.fmtMoney(r.sena)} · Total ${U.fmtMoney(r.monto_total)}`;
    }

    const when = opts.withDate
      ? `<span class="res-time res-time--date">${U.parseISO(r.fecha).getDate()}<small>${U.parseISO(r.fecha).toLocaleDateString('es-AR', { weekday: 'short' })}</small></span>`
      : `<span class="res-time">${U.fmtHour(r.hora_inicio)}<small>a ${U.fmtHour(r.hora_fin)}</small></span>`;

    return `
      <button type="button" class="res-card res--${r.estado}" data-id="${r.id}">
        ${when}
        <span class="res-main">
          <strong>${esc(canchaName(r.cancha_id))}${opts.withDate ? ' · ' + timeRange(r) : ''}</strong>
          <span class="res-client">${esc(r.cliente)}</span>
          ${parts.length ? `<small>${parts.join(' · ')}</small>` : ''}
          ${money ? `<small class="res-money">${money}</small>` : ''}
        </span>
        <span class="badge badge--${r.estado}">${U.ESTADOS[r.estado]}</span>
      </button>`;
  }

  function renderList() {
    const active = rows.filter((r) => r.estado !== 'cancelada').sort(byTime);
    const cancelled = rows.filter((r) => r.estado === 'cancelada').sort(byTime);

    const bits = [`${active.length} ${active.length === 1 ? 'reserva' : 'reservas'}`];
    if (cancelled.length) bits.push(`${cancelled.length} ${cancelled.length === 1 ? 'cancelada' : 'canceladas'}`);
    summary.textContent = bits.join(' · ');

    if (!rows.length) {
      list.innerHTML = '<p class="adm-empty">No hay reservas para este día. Tocá “Nueva reserva” para cargar la primera.</p>';
      return;
    }
    list.innerHTML = active.map((r) => card(r)).join('') +
      (cancelled.length ? `<h2 class="res-sep">Canceladas</h2>` + cancelled.map((r) => card(r)).join('') : '');
  }

  // ---------- Detalle ----------
  function detailRow(label, value) {
    return value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '';
  }

  function openDetail(id) {
    const r = known.get(id);
    if (!r) return;
    detailId = id;

    const saldo = Math.max(0, r.monto_total - r.sena);
    const tel = r.telefono ? `<a href="tel:${esc(r.telefono.replace(/[^\d+]/g, ''))}">${esc(r.telefono)}</a>` : '';
    const cancelled = r.estado === 'cancelada';

    dlgDetail.innerHTML = `
      <div class="sheet-head">
        <h2>${esc(canchaName(r.cancha_id))}</h2>
        <button type="button" class="sheet-close" data-close aria-label="Cerrar">×</button>
      </div>
      <div class="sheet-body">
        <p class="detail-when">${U.fmtDayLong(U.parseISO(r.fecha))} · ${timeRange(r)}</p>
        <p><span class="badge badge--${r.estado}">${U.ESTADOS[r.estado]}</span></p>
        <dl class="detail-list">
          ${detailRow('Cliente', esc(r.cliente))}
          ${detailRow('Teléfono', tel)}
          ${detailRow('Personas', r.personas || '')}
          ${detailRow('Tipo de evento', esc(r.tipo_evento || ''))}
          ${detailRow('Total', r.monto_total ? U.fmtMoney(r.monto_total) : '')}
          ${detailRow('Seña', r.sena ? U.fmtMoney(r.sena) : '')}
          ${detailRow('Saldo a cobrar', !cancelled && r.monto_total ? U.fmtMoney(saldo) : '')}
          ${detailRow('Notas', esc(r.notas || '').replace(/\n/g, '<br>'))}
          ${detailRow('Cargada por', r.creado_por ? `${esc(r.creado_por)} · ${U.fmtDateTime(r.creado_en)}` : '')}
          ${cancelled ? detailRow('Cancelada', `${U.fmtDateTime(r.cancelada_en)}${r.cancelada_por ? ' por ' + esc(r.cancelada_por) : ''}`) : ''}
        </dl>
        <h3 class="sheet-sub">Historial</h3>
        <ol id="hist-list" class="hist"><li class="adm-muted">Cargando…</li></ol>
      </div>
      <div class="sheet-foot">
        ${cancelled ? '' : '<button type="button" class="btn btn-danger-ghost" data-action="cancel">Cancelar reserva</button>'}
        <button type="button" class="btn btn-primary" data-action="edit">Editar</button>
      </div>`;

    dlgDetail.showModal();
    loadHistory(id);
  }

  const FIELDS = [
    ['cancha_id',   'Cancha',    (v) => canchaName(v)],
    ['fecha',       'Fecha',     (v) => U.fmtDayShort(U.parseISO(v))],
    ['hora_inicio', 'Desde',     (v) => U.fmtHour(v)],
    ['hora_fin',    'Hasta',     (v) => U.fmtHour(v)],
    ['cliente',     'Cliente',   (v) => v],
    ['telefono',    'Teléfono',  (v) => v],
    ['personas',    'Personas',  (v) => v],
    ['tipo_evento', 'Evento',    (v) => v],
    ['monto_total', 'Total',     (v) => U.fmtMoney(v)],
    ['sena',        'Seña',      (v) => U.fmtMoney(v)],
    ['estado',      'Estado',    (v) => U.ESTADOS[v] || v],
  ];

  function changes(before, after) {
    const out = FIELDS
      .filter(([k]) => (before[k] ?? null) !== (after[k] ?? null))
      .map(([k, label, fmt]) => {
        const show = (v) => (v === null || v === undefined || v === '' ? '—' : fmt(v));
        return `${label}: ${esc(show(before[k]))} → ${esc(show(after[k]))}`;
      });
    if ((before.notas ?? null) !== (after.notas ?? null)) out.push('Notas modificadas');
    return out;
  }

  async function loadHistory(id) {
    const { data, error } = await db
      .from('historial').select('*').eq('reserva_id', id)
      .order('fecha', { ascending: false });
    const box = $('#hist-list');
    if (!box || id !== detailId) return;
    if (error) { box.innerHTML = '<li class="adm-error">No se pudo cargar el historial.</li>'; return; }

    const verbs = { creada: 'Creada', editada: 'Editada', cancelada: 'Cancelada' };
    box.innerHTML = data.map((h) => {
      const detail = h.accion === 'editada' && h.antes && h.despues ? changes(h.antes, h.despues) : [];
      return `
        <li>
          <strong>${verbs[h.accion]}</strong> por ${esc(h.usuario || 'desconocido')}
          <small>${U.fmtDateTime(h.fecha)}</small>
          ${detail.length ? `<small class="hist-changes">${detail.join('<br>')}</small>` : ''}
        </li>`;
    }).join('') || '<li class="adm-muted">Sin movimientos registrados.</li>';
  }

  // ---------- Formulario ----------
  function buildCanchaSelect() {
    const groups = {};
    canchas.forEach((c) => { (groups[c.tipo] = groups[c.tipo] || []).push(c); });
    f.cancha.innerHTML = Object.entries(groups).map(([tipo, cs]) =>
      `<optgroup label="${esc(U.TIPOS[tipo])}">` +
      cs.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('') +
      '</optgroup>').join('');
  }

  function buildEstadoSelect() {
    f.estado.innerHTML = Object.entries(U.ESTADOS)
      .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  }

  function buildEventoSelect() {
    f.evento.innerHTML = '<option value="">Elegí una opción</option>' +
      U.EVENTOS.map((e) => `<option>${esc(e)}</option>`).join('');
  }

  function buildDesdeSelect() {
    const { firstStart, lastStart } = U.HOURS;
    f.desde.innerHTML = U.range(firstStart, lastStart + 1)
      .map((h) => `<option value="${h}">${U.fmtHour(h)}</option>`).join('');
  }

  function buildHastaSelect(selected) {
    const from = Number(f.desde.value) + 1;
    f.hasta.innerHTML = U.range(from, U.HOURS.lastEnd + 1)
      .map((h) => `<option value="${h}">${U.fmtHour(h)}</option>`).join('');
    const want = selected && selected >= from ? selected : from;
    f.hasta.value = String(want);
  }

  function syncQuincho() {
    f.eventoBox.hidden = f.cancha.value !== 'quincho';
  }

  // Precio según el horario: cada hora de cancha vale distinto con luz (desde las 19:00) o sin luz.
  // El quincho se alquila por evento. Devuelve null si falta algún precio en la base de datos.
  function suggestedPrice() {
    const c = canchaById[f.cancha.value];
    if (!c) return null;
    if (c.tipo === 'quincho') return c.precio_sin_luz || c.precio_con_luz || null;

    let total = 0;
    let lit = 0;
    for (let h = Number(f.desde.value); h < Number(f.hasta.value); h++) {
      const withLight = h >= U.HOURS.luzDesde;
      const price = withLight ? c.precio_con_luz : c.precio_sin_luz;
      if (!price) return null;
      total += price;
      if (withLight) lit++;
    }
    const hours = Number(f.hasta.value) - Number(f.desde.value);
    return { total, lit, hours };
  }

  let autoTotal = false;     // true mientras el monto lo completa el sistema (se apaga si alguien lo escribe)

  function renderPrices() {
    const c = canchaById[f.cancha.value];
    const s = suggestedPrice();
    if (!s) { f.prices.innerHTML = ''; return; }

    let total, text;
    if (c.tipo === 'quincho') {
      total = s;
      text = 'Alquiler del quincho';
    } else {
      total = s.total;
      text = s.lit === 0 ? 'Sin luz' : s.lit === s.hours ? 'Con luz' : `${s.hours - s.lit} h sin luz y ${s.lit} h con luz`;
    }

    f.prices.innerHTML =
      `<span class="price-hint">Precio según el horario (la luz se cobra desde las ${U.fmtHour(U.HOURS.luzDesde)}):</span>` +
      `<button type="button" class="chip" data-price="${total}">${text} · ${U.fmtMoney(total)}</button>`;

    if (autoTotal) f.total.value = total;
  }

  // `preset` (opcional) completa cancha, fecha y hora cuando se llega desde el calendario o el quincho.
  function openForm(record, preset) {
    editing = record || null;
    f.error.hidden = true;
    f.conflict.hidden = true;
    f.title.textContent = record ? 'Editar reserva' : 'Nueva reserva';
    const p = preset || {};

    const r = record || {
      cancha_id: p.cancha_id || canchas[0].id, fecha: p.fecha || U.iso(day),
      hora_inicio: p.hora_inicio || 17, hora_fin: p.hora_inicio ? p.hora_inicio + 1 : 18,
      cliente: '', telefono: '', personas: '', tipo_evento: '',
      monto_total: '', sena: '', estado: 'pendiente', notas: '',
    };

    f.cancha.value = r.cancha_id;
    f.fecha.value = r.fecha;
    f.estado.value = r.estado;
    f.desde.value = String(r.hora_inicio);
    buildHastaSelect(r.hora_fin);
    f.cliente.value = r.cliente || '';
    f.telefono.value = r.telefono || '';
    f.personas.value = r.personas || '';
    f.evento.value = r.tipo_evento || '';
    f.total.value = r.monto_total || '';
    f.sena.value = r.sena || '';
    f.notas.value = r.notas || '';
    syncQuincho();
    autoTotal = !record;      // en una reserva nueva el monto se completa solo
    renderPrices();

    if (dlgDetail.open) dlgDetail.close();
    dlgForm.showModal();
    checkConflict();
  }

  function readForm() {
    const isQuincho = f.cancha.value === 'quincho';
    return {
      cancha_id:   f.cancha.value,
      fecha:       f.fecha.value,
      hora_inicio: Number(f.desde.value),
      hora_fin:    Number(f.hasta.value),
      cliente:     f.cliente.value.trim(),
      telefono:    f.telefono.value.trim() || null,
      personas:    f.personas.value ? Number(f.personas.value) : null,
      tipo_evento: isQuincho ? (f.evento.value || null) : null,
      monto_total: Number(f.total.value || 0),
      sena:        Number(f.sena.value || 0),
      estado:      f.estado.value,
      notas:       f.notas.value.trim() || null,
    };
  }

  function validate(r) {
    if (!r.fecha) return 'Elegí la fecha.';
    if (!r.cliente) return 'Escribí el nombre del cliente.';
    if (r.hora_fin <= r.hora_inicio) return 'La hora de fin tiene que ser después de la de inicio.';
    if (r.cancha_id === 'quincho' && !r.tipo_evento) return 'Elegí el tipo de evento del quincho.';
    if (r.cancha_id === 'quincho' && !r.personas) return 'Indicá la cantidad de personas del quincho.';
    if (r.sena < 0 || r.monto_total < 0) return 'Los montos no pueden ser negativos.';
    if (r.monto_total > 0 && r.sena > r.monto_total) return 'La seña no puede ser mayor que el total.';
    if (r.estado === 'senada' && r.sena <= 0) return 'Para marcarla como señada, ingresá el monto de la seña.';
    if (r.estado === 'pagada' && r.monto_total <= 0) return 'Para marcarla como pagada, ingresá el monto total.';
    return '';
  }

  // Reservas activas que se pisan con el horario elegido (para avisar antes de guardar).
  async function findConflicts(r) {
    let q = db.from('reservas')
      .select('id,cliente,hora_inicio,hora_fin')
      .eq('cancha_id', r.cancha_id).eq('fecha', r.fecha)
      .neq('estado', 'cancelada')
      .lt('hora_inicio', r.hora_fin).gt('hora_fin', r.hora_inicio);
    if (editing) q = q.neq('id', editing.id);
    const { data } = await q;
    return data || [];
  }

  function conflictText(r, clashes) {
    return `${canchaName(r.cancha_id)} ya está ocupada: ` +
      clashes.map((c) => `${U.fmtHour(c.hora_inicio)} a ${U.fmtHour(c.hora_fin)} (${esc(c.cliente)})`).join(', ') + '.';
  }

  let conflictTimer = null;
  function checkConflict() {
    clearTimeout(conflictTimer);
    conflictTimer = setTimeout(async () => {
      const r = readForm();
      if (!r.fecha || r.estado === 'cancelada' || r.hora_fin <= r.hora_inicio) { f.conflict.hidden = true; return; }
      const token = ++conflictToken;
      const clashes = await findConflicts(r);
      if (token !== conflictToken) return;
      if (clashes.length) {
        f.conflict.innerHTML = `⚠ ${conflictText(r, clashes)} Elegí otro horario u otra cancha.`;
        f.conflict.hidden = false;
      } else {
        f.conflict.hidden = true;
      }
    }, 250);
  }

  // Después de guardar o cancelar: actualiza la pantalla que se esté viendo.
  function afterChange(savedDate) {
    const cur = window.PanelNav.current();
    if (cur === 'calendario' || cur === 'lista') {
      if (savedDate && savedDate !== U.iso(day)) setDay(U.parseISO(savedDate)); else loadDay(true);
    } else {
      window.PanelNav.refresh();
    }
  }

  async function save(e) {
    e.preventDefault();
    f.error.hidden = true;
    const r = readForm();
    const problem = validate(r);
    if (problem) { f.error.textContent = problem; f.error.hidden = false; return; }

    f.save.disabled = true;
    f.save.textContent = 'Guardando…';

    const query = editing
      ? db.from('reservas').update(r).eq('id', editing.id).select()
      : db.from('reservas').insert(r).select();
    const { data, error } = await query;

    f.save.disabled = false;
    f.save.textContent = 'Guardar';

    if (error) {
      if (error.code === '23P01') {
        // La base de datos rechazó la reserva porque la cancha ya está ocupada.
        const clashes = await findConflicts(r);
        f.error.innerHTML = clashes.length
          ? `⚠ ${conflictText(r, clashes)} No se guardó.`
          : '⚠ Esa cancha ya está ocupada en ese horario. No se guardó.';
      } else {
        console.error(error);
        f.error.textContent = 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.';
      }
      f.error.hidden = false;
      return;
    }
    if (!data || !data.length) {
      f.error.textContent = 'No se pudo guardar: no tenés permiso o la reserva ya no existe.';
      f.error.hidden = false;
      return;
    }

    remember(data);
    dlgForm.close();
    toast(editing ? 'Reserva actualizada.' : 'Reserva guardada.');
    afterChange(r.fecha);
  }

  // ---------- Cancelar ----------
  function openCancel() {
    const r = known.get(detailId);
    if (!r) return;
    $('#cancel-info').textContent =
      `${canchaName(r.cancha_id)} · ${timeRange(r)} · ${r.cliente}`;
    $('#c-motivo').value = '';
    $('#cancel-error').hidden = true;
    dlgDetail.close();
    dlgCancel.showModal();
  }

  async function confirmCancel() {
    const r = known.get(detailId);
    if (!r) return;
    const motivo = $('#c-motivo').value.trim();
    const notas = motivo ? [r.notas, `Cancelada: ${motivo}`].filter(Boolean).join('\n') : r.notas;

    const btn = $('#cancel-confirm');
    btn.disabled = true;
    const { data, error } = await db.from('reservas')
      .update({ estado: 'cancelada', notas })
      .eq('id', r.id).select();
    btn.disabled = false;

    if (error || !data || !data.length) {
      const box = $('#cancel-error');
      box.textContent = 'No se pudo cancelar. Revisá tu conexión e intentá de nuevo.';
      box.hidden = false;
      return;
    }
    remember(data);
    dlgCancel.close();
    toast('Reserva cancelada.');
    afterChange();
  }

  // ---------- Eventos de pantalla (se conectan una sola vez) ----------
  function bind() {
    bound = true;

    $('#day-prev').addEventListener('click', () => setDay(U.addDays(day, -1)));
    $('#day-next').addEventListener('click', () => setDay(U.addDays(day, 1)));
    $('#day-today').addEventListener('click', () => setDay(U.today()));
    dayInput.addEventListener('change', () => { if (dayInput.value) setDay(U.parseISO(dayInput.value)); });
    dayInput.addEventListener('click', () => { if (dayInput.showPicker) dayInput.showPicker(); });

    list.addEventListener('click', (e) => {
      const c = e.target.closest('.res-card');
      if (c) openDetail(c.dataset.id);
    });

    agenda.addEventListener('click', (e) => {
      const free = e.target.closest('.ag-free');
      if (free) {
        openForm(null, { cancha_id: free.dataset.cancha, hora_inicio: Number(free.dataset.hour) });
        return;
      }
      const res = e.target.closest('.ag-res');
      if (res) openDetail(res.dataset.id);
    });

    f.form.addEventListener('submit', save);
    f.cancha.addEventListener('change', () => { syncQuincho(); renderPrices(); checkConflict(); });
    f.desde.addEventListener('change', () => { buildHastaSelect(); renderPrices(); checkConflict(); });
    f.hasta.addEventListener('change', () => { renderPrices(); checkConflict(); });
    [f.fecha, f.estado].forEach((el) => el.addEventListener('change', checkConflict));
    f.prices.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-price]');
      if (chip) { f.total.value = chip.dataset.price; autoTotal = true; }
    });
    // Si alguien escribe el monto a mano, el sistema deja de pisarlo.
    f.total.addEventListener('input', () => { autoTotal = false; });

    dlgDetail.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      const r = known.get(detailId);
      if (a.dataset.action === 'edit' && r) openForm(r);
      if (a.dataset.action === 'cancel') openCancel();
    });
    $('#cancel-confirm').addEventListener('click', confirmCancel);

    // Cerrar con la X, con "Volver" o tocando afuera de la ventana.
    document.querySelectorAll('dialog').forEach((dlg) => {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      });
    });

    // Si alguien más cargó algo mientras tanto, se ve al volver a esta pantalla.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !$('#v-app').hidden && !document.querySelector('dialog[open]')) window.PanelNav.refresh();
    });
  }

  // ---------- Pestañas Calendario y Reservas ----------
  function showDayView(v) {
    view = v;
    gridBox.hidden = v !== 'calendario';
    list.hidden = v !== 'lista';
    if (db && canchas.length) setDay(day);
  }

  window.PanelNav.register('calendario', {
    section: 'dia', title: 'Calendario',
    fab: { label: '+ Nueva reserva', click: () => openForm(null) },
    show: () => showDayView('calendario'),
    reload: (quiet) => loadDay(quiet),
  });
  window.PanelNav.register('lista', {
    section: 'dia', title: 'Reservas',
    fab: { label: '+ Nueva reserva', click: () => openForm(null) },
    show: () => showDayView('lista'),
    reload: (quiet) => loadDay(quiet),
  });

  // Lo que usan las otras secciones.
  return {
    init, openDetail, openForm, remember, card, toast,
    getCanchas: () => canchas,
    canchaName,
  };
})();
