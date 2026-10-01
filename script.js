(() => {
  'use strict';

  const WA_NUMBER = '5493764110811';

  const SPORTS = {
    f5:    { name: 'Fútbol 5', short: 'F5',    type: 'football', count: 3, icon: { w: 90,  h: 150 } },
    f6:    { name: 'Fútbol 6', short: 'F6',    type: 'football', count: 2, icon: { w: 100, h: 150 } },
    padel: { name: 'Pádel',    short: 'Pádel', type: 'padel',    count: 2, icon: { w: 70,  h: 140 } },
  };

  // Plan layout in the 640x520 viewBox: courts are drawn top-down, not to scale.
  const COURTS = [
    { sport: 'f5',    n: 1, x: 30,  y: 50,  w: 135, h: 200 },
    { sport: 'f5',    n: 2, x: 180, y: 50,  w: 135, h: 200 },
    { sport: 'f5',    n: 3, x: 330, y: 50,  w: 135, h: 200 },
    { sport: 'padel', n: 1, x: 490, y: 50,  w: 120, h: 200 },
    { sport: 'f6',    n: 1, x: 30,  y: 290, w: 210, h: 200 },
    { sport: 'f6',    n: 2, x: 255, y: 290, w: 210, h: 200 },
    { sport: 'padel', n: 2, x: 490, y: 290, w: 120, h: 200 },
  ];

  const footballLines = (w, h) => {
    const r = Math.min(w, h) * 0.13;
    const pw = w * 0.5, ph = h * 0.16;
    const gw = w * 0.22, gh = 7;
    return `
      <rect x="0" y="0" width="${w}" height="${h}"/>
      <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}"/>
      <circle cx="${w / 2}" cy="${h / 2}" r="${r}"/>
      <rect x="${(w - pw) / 2}" y="0" width="${pw}" height="${ph}"/>
      <rect x="${(w - pw) / 2}" y="${h - ph}" width="${pw}" height="${ph}"/>
      <rect x="${(w - gw) / 2}" y="${-gh}" width="${gw}" height="${gh}"/>
      <rect x="${(w - gw) / 2}" y="${h}" width="${gw}" height="${gh}"/>`;
  };

  const padelLines = (w, h) => {
    const mid = h / 2;
    const service = h * 0.3475;
    return `
      <rect class="wall" x="0" y="0" width="${w}" height="${h}"/>
      <line x1="0" y1="${mid - service}" x2="${w}" y2="${mid - service}"/>
      <line x1="0" y1="${mid + service}" x2="${w}" y2="${mid + service}"/>
      <line x1="${w / 2}" y1="${mid - service}" x2="${w / 2}" y2="${mid + service}"/>
      <line class="net" x1="0" y1="${mid}" x2="${w}" y2="${mid}"/>`;
  };

  const linesFor = (sport, w, h) =>
    SPORTS[sport].type === 'padel' ? padelLines(w, h) : footballLines(w, h);

  // ---------- Build the plan ----------
  const plan = document.getElementById('plan');

  plan.innerHTML =
    `<rect class="pista" x="-6" y="-4" width="652" height="528" rx="60" pathLength="1"/>` +
    COURTS.map((c, i) => {
      const s = SPORTS[c.sport];
      return `
        <g class="court court--${c.sport}" data-sport="${c.sport}" data-n="${c.n}"
           role="button" tabindex="0" aria-pressed="false"
           aria-label="${s.name}, cancha ${c.n}"
           transform="translate(${c.x} ${c.y})" style="--i:${i}">
          <rect class="court-hit" x="-8" y="-30" width="${c.w + 16}" height="${c.h + 40}"/>
          <rect class="court-fill" width="${c.w}" height="${c.h}"/>
          <rect class="court-ring" x="-6" y="-6" width="${c.w + 12}" height="${c.h + 12}" rx="6"/>
          <g class="lines">${linesFor(c.sport, c.w, c.h)}</g>
          <text class="court-label" x="0" y="-12">${s.short} · ${c.n}</text>
        </g>`;
    }).join('');

  plan.querySelectorAll('.lines > *').forEach((el) => el.setAttribute('pathLength', '1'));

  // ---------- Court icons in the list ----------
  document.querySelectorAll('[data-icon]').forEach((svg) => {
    const key = svg.dataset.icon;
    const { w, h } = SPORTS[key].icon;
    svg.setAttribute('viewBox', `-8 -14 ${w + 16} ${h + 28}`);
    svg.innerHTML =
      `<rect class="court-fill" width="${w}" height="${h}"/>` +
      `<g class="lines">${linesFor(key, w, h)}</g>`;
  });

  // ---------- Selection state, shared by plan and form ----------
  const state = { sport: '', n: '' };

  const status = document.getElementById('plan-status');
  const go = document.getElementById('plan-go');
  const form = document.getElementById('form');
  const sportSel = document.getElementById('f-sport');
  const courtSel = document.getElementById('f-court');
  const dateInput = document.getElementById('f-date');
  const timeInput = document.getElementById('f-time');
  const nameInput = document.getElementById('f-name');
  const errorBox = document.getElementById('form-error');

  const fillCourtOptions = () => {
    courtSel.innerHTML = '';
    if (!state.sport) {
      courtSel.disabled = true;
      courtSel.innerHTML = '<option value="">Primero elegí un deporte</option>';
      return;
    }
    courtSel.disabled = false;
    const opts = ['<option value="">Cualquiera disponible</option>'];
    for (let i = 1; i <= SPORTS[state.sport].count; i++) {
      opts.push(`<option value="${i}">Cancha ${i}</option>`);
    }
    courtSel.innerHTML = opts.join('');
  };

  const render = () => {
    plan.querySelectorAll('.court').forEach((g) => {
      const on = g.dataset.sport === state.sport && g.dataset.n === String(state.n);
      g.setAttribute('aria-pressed', String(on));
    });
    if (state.sport) plan.dataset.sport = state.sport; else delete plan.dataset.sport;

    if (!state.sport) {
      status.textContent = 'Tocá una cancha del plano para elegirla.';
    } else if (state.n) {
      status.textContent = `Elegiste ${SPORTS[state.sport].name}, cancha ${state.n}.`;
    } else {
      status.textContent = `Elegiste ${SPORTS[state.sport].name}. Tocá una cancha para elegir una en particular.`;
    }
    go.hidden = !state.sport;

    sportSel.value = state.sport;
    fillCourtOptions();
    courtSel.value = String(state.n || '');
  };

  const toggleCourt = (g) => {
    const same = g.dataset.sport === state.sport && g.dataset.n === String(state.n);
    state.sport = same ? '' : g.dataset.sport;
    state.n = same ? '' : g.dataset.n;
    render();
  };

  plan.addEventListener('click', (e) => {
    const g = e.target.closest('.court');
    if (g) toggleCourt(g);
  });
  plan.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('.court');
    if (g) { e.preventDefault(); toggleCourt(g); }
  });

  document.querySelectorAll('[data-pick]').forEach((a) => {
    a.addEventListener('click', () => {
      state.sport = a.dataset.pick;
      state.n = '';
      render();
    });
  });

  sportSel.addEventListener('change', () => { state.sport = sportSel.value; state.n = ''; render(); });
  courtSel.addEventListener('change', () => { state.n = courtSel.value; render(); });

  // ---------- Form -> WhatsApp ----------
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const setInvalid = (el, bad) => el.setAttribute('aria-invalid', bad ? 'true' : 'false');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const missing = [
      [sportSel, 'el deporte'],
      [dateInput, 'el día'],
      [timeInput, 'el horario'],
      [nameInput, 'tu nombre'],
    ].filter(([el]) => !el.value.trim());

    [sportSel, dateInput, timeInput, nameInput].forEach((el) => setInvalid(el, !el.value.trim()));

    if (missing.length) {
      errorBox.hidden = false;
      errorBox.textContent = `Falta completar: ${missing.map(([, label]) => label).join(', ')}.`;
      missing[0][0].focus();
      return;
    }
    errorBox.hidden = true;

    const [y, m, d] = dateInput.value.split('-').map(Number);
    const day = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const sport = SPORTS[sportSel.value].name;
    const court = courtSel.value ? `, cancha ${courtSel.value}` : '';

    const text =
      `Hola, soy ${nameInput.value.trim()}. Quiero reservar ${sport}${court} ` +
      `el ${day} a las ${timeInput.value}. ¿Tienen disponibilidad?`;

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });

  [sportSel, dateInput, timeInput, nameInput].forEach((el) =>
    el.addEventListener('input', () => setInvalid(el, false)));

  render();
})();
