(() => {
  'use strict';

  const { SPORTS, mountPlan, waLink } = window.Coliseo;

  const $ = (sel, root = document) => root.querySelector(sel);

  const TYPES = {
    cancha:  'Cancha',
    quincho: 'Quincho con parrilla',
    combo:   'Combo cancha + quincho',
  };

  const state = {
    type: '', sport: '', n: '',
    date: null, time: '',
    qStart: '', qEnd: '', people: '', event: '',
    name: '', notes: '',
  };

  const hasCourt = () => state.type === 'cancha' || state.type === 'combo';
  const hasQuincho = () => state.type === 'quincho' || state.type === 'combo';

  // ---------- Helpers ----------
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const sameDay = (a, b) => a && b && a.getTime() === b.getTime();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const fmtDate = (d, withYear = false) =>
    d.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      ...(withYear || d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });

  // ---------- Calendar ----------
  function mountCalendar(root, onSelect) {
    const MAX_MONTHS_AHEAD = 12;
    let view = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthsAhead = () =>
      (view.getFullYear() - today.getFullYear()) * 12 + view.getMonth() - today.getMonth();

    const chevron = (dir) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;

    function render() {
      const y = view.getFullYear(), m = view.getMonth();
      const offset = (new Date(y, m, 1).getDay() + 6) % 7; // week starts on Monday
      const days = new Date(y, m + 1, 0).getDate();

      let cells = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
        .map((d) => `<span class="cal-dow" aria-hidden="true">${d}</span>`).join('');
      cells += '<span></span>'.repeat(offset);

      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const past = date < today;
        const classes = 'cal-day' + (sameDay(date, today) ? ' is-today' : '');
        cells += `<button type="button" class="${classes}" data-date="${iso(date)}"
          aria-label="${fmtDate(date, true)}" aria-pressed="${sameDay(date, state.date)}"
          ${past ? 'disabled' : ''}>${d}</button>`;
      }

      root.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav" data-dir="-1" aria-label="Mes anterior" ${monthsAhead() <= 0 ? 'disabled' : ''}>${chevron('prev')}</button>
          <p class="cal-title" aria-live="polite">${view.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
          <button type="button" class="cal-nav" data-dir="1" aria-label="Mes siguiente" ${monthsAhead() >= MAX_MONTHS_AHEAD ? 'disabled' : ''}>${chevron('next')}</button>
        </div>
        <div class="cal-grid">${cells}</div>`;
    }

    root.addEventListener('click', (e) => {
      const nav = e.target.closest('.cal-nav');
      if (nav) {
        view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.dir), 1);
        render();
        const again = root.querySelector(`.cal-nav[data-dir="${nav.dataset.dir}"]:not(:disabled)`)
          || root.querySelector('.cal-nav:not(:disabled)');
        if (again) again.focus();
        return;
      }
      const day = e.target.closest('.cal-day');
      if (day) {
        const [y, m, d] = day.dataset.date.split('-').map(Number);
        onSelect(new Date(y, m - 1, d));
        render();
        const pressed = root.querySelector('.cal-day[aria-pressed="true"]');
        if (pressed) pressed.focus();
      }
    });

    render();
    return { render };
  }

  // ---------- Elements ----------
  const form = $('#booking');
  const status = $('#court-status');
  const sumList = $('#sum-list');
  const sumError = $('#sum-error');
  const sumDone = $('#sum-done');
  const sendBtn = $('#send');

  const fields = {
    time:   $('#t-time'),
    qStart: $('#q-start'),
    qEnd:   $('#q-end'),
    people: $('#q-people'),
    event:  $('#q-event'),
    name:   $('#f-name'),
    notes:  $('#f-notes'),
  };

  const plan = mountPlan($('#plan'), {
    animate: false,
    onPick(sport, n) {
      if (sport === state.sport && n === state.n) {
        state.n = '';
      } else {
        state.sport = sport;
        state.n = n;
      }
      render();
    },
  });

  const calendar = mountCalendar($('#cal'), (d) => { state.date = d; render(false); });

  // ---------- Summary ----------
  const courtLabel = () => {
    if (!state.sport) return '';
    return state.n
      ? `${SPORTS[state.sport].name}, cancha ${state.n}`
      : `${SPORTS[state.sport].name}, cualquiera disponible`;
  };

  const quinchoLabel = () => {
    const parts = [];
    if (state.people) parts.push(`${state.people} ${Number(state.people) === 1 ? 'persona' : 'personas'}`);
    if (state.event) parts.push(state.event);
    return parts.join(' · ');
  };

  const timeLabel = () => {
    const lines = [];
    if (hasCourt() && state.time) lines.push(hasQuincho() ? `Cancha: ${state.time}` : state.time);
    if (hasQuincho() && state.qStart) {
      const range = state.qEnd ? `${state.qStart} a ${state.qEnd}` : `desde ${state.qStart}`;
      lines.push(hasCourt() ? `Quincho: ${range}` : range);
    }
    return lines.join('\n');
  };

  function renderSummary() {
    const rows = [['Reserva', TYPES[state.type] || '', 'Sin elegir']];
    if (hasCourt()) rows.push(['Cancha', courtLabel(), 'Sin elegir']);
    if (hasQuincho()) rows.push(['Quincho', quinchoLabel(), 'Sin completar']);
    rows.push(['Día', state.date ? fmtDate(state.date) : '', 'Sin elegir']);
    rows.push(['Horario', timeLabel(), 'Sin completar']);
    rows.push(['A nombre de', state.name.trim(), 'Sin completar']);

    sumList.innerHTML = rows.map(([label, value, empty]) => `
      <div>
        <dt>${label}</dt>
        <dd class="${value ? '' : 'is-empty'}" style="white-space: pre-line">${value || empty}</dd>
      </div>`).join('');
  }

  // ---------- Render ----------
  function render(syncControls = true) {
    // Progressive steps: only show what the chosen type needs.
    form.querySelectorAll('[data-for]').forEach((el) => {
      el.hidden = !(state.type && el.dataset.for.split(' ').includes(state.type));
    });

    plan.set(state.sport, state.n);

    if (!state.sport) {
      status.textContent = 'Elegí el deporte y tocá una cancha en el plano.';
    } else if (state.n) {
      status.textContent = `Elegiste ${SPORTS[state.sport].name}, cancha ${state.n}. Tocala de nuevo para dejar cualquiera disponible.`;
    } else {
      status.textContent = `Elegiste ${SPORTS[state.sport].name}. Tocá una cancha en el plano o dejá cualquiera disponible.`;
    }

    if (syncControls) {
      form.querySelectorAll('input[name="type"]').forEach((r) => { r.checked = r.value === state.type; });
      form.querySelectorAll('input[name="sport"]').forEach((r) => { r.checked = r.value === state.sport; });
    }

    renderSummary();
    sumDone.hidden = true;
  }

  // ---------- Events ----------
  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') {
      state.type = e.target.value;
      render(false);
    } else if (e.target.name === 'sport') {
      if (state.sport !== e.target.value) state.n = '';
      state.sport = e.target.value;
      render(false);
    }
  });

  Object.entries(fields).forEach(([key, el]) => {
    el.addEventListener('input', () => {
      state[key] = el.value;
      el.removeAttribute('aria-invalid');
      renderSummary();
      sumDone.hidden = true;
    });
  });

  // ---------- Validation and message ----------
  function missing() {
    const m = [];
    if (!state.type) return [{ label: 'qué querés reservar', el: '#step-type' }];
    if (hasCourt() && !state.sport) m.push({ label: 'el deporte', el: '#step-court' });
    if (hasQuincho()) {
      if (!(Number(state.people) >= 1)) m.push({ label: 'la cantidad de personas', el: '#q-people' });
      if (!state.event) m.push({ label: 'el tipo de evento', el: '#q-event' });
    }
    if (!state.date) m.push({ label: 'el día', el: '#step-date' });
    if (hasCourt() && !state.time) m.push({ label: 'el horario de la cancha', el: '#t-time' });
    if (hasQuincho() && !state.qStart) m.push({ label: 'el horario de inicio del quincho', el: '#q-start' });
    if (!state.name.trim()) m.push({ label: 'tu nombre', el: '#f-name' });
    return m;
  }

  function buildMessage() {
    const date = fmtDate(state.date);
    const court = `${SPORTS[state.sport] ? SPORTS[state.sport].name : ''}` +
      (state.n ? `, cancha ${state.n}` : ' (cualquier cancha disponible)');
    const people = `${state.people} ${Number(state.people) === 1 ? 'persona' : 'personas'}`;
    const quincho = `desde las ${state.qStart}` + (state.qEnd ? ` hasta las ${state.qEnd}` : '') +
      `, para ${people} (${state.event.toLowerCase()})`;

    let what;
    if (state.type === 'cancha') {
      what = `reservar ${court} el ${date} a las ${state.time}`;
    } else if (state.type === 'quincho') {
      what = `reservar el quincho con parrilla el ${date} ${quincho}`;
    } else {
      what = `reservar el combo cancha + quincho el ${date}: ${court} a las ${state.time} y el quincho ${quincho}`;
    }

    let msg = `Hola, soy ${state.name.trim()}. Quiero ${what}.`;
    if (state.notes.trim()) msg += ` Comentarios: ${state.notes.trim()}.`;
    return `${msg} ¿Tienen disponibilidad?`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = missing();

    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

    if (m.length) {
      m.forEach(({ el }) => { const t = $(el); if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.setAttribute('aria-invalid', 'true'); });
      sumError.hidden = false;
      sumError.innerHTML = `<p>Falta completar:</p><ul>${m.map(({ label }) => `<li>${label}</li>`).join('')}</ul>`;
      const first = $(m[0].el);
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(first.tagName)) first.focus({ preventScroll: true });
      }
      return;
    }

    sumError.hidden = true;
    const url = waLink(buildMessage());
    window.open(url, '_blank', 'noopener');
    sumDone.hidden = false;
    sumDone.innerHTML = `Se abrió WhatsApp con tu mensaje. Si no se abrió, <a href="${url}" target="_blank" rel="noopener">tocá acá</a>. La reserva queda confirmada cuando te respondemos.`;
  });

  // ---------- Preselect from the URL (?tipo=&deporte=&cancha=) ----------
  (function init() {
    const p = new URLSearchParams(location.search);
    const tipo = p.get('tipo');
    const deporte = p.get('deporte');
    const cancha = p.get('cancha');

    if (TYPES[tipo]) state.type = tipo;
    if (SPORTS[deporte]) {
      state.sport = deporte;
      if (!state.type) state.type = 'cancha';
      if (cancha && Number(cancha) >= 1 && Number(cancha) <= SPORTS[deporte].count) state.n = String(Number(cancha));
    }
    render();
  })();
})();
