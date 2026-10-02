(() => {
  'use strict';

  const WA_NUMBER = '5493764110811';

  const waLink = (text) =>
    `https://wa.me/${WA_NUMBER}` + (text ? `?text=${encodeURIComponent(text)}` : '');

  // Opening hours: 17:00 to 01:00. Hours past midnight count on from 24
  // (24 = 00:00, 25 = 01:00), so a turn that starts at h always ends at h + 1.
  const HOURS = { open: 17, close: 25 };
  const fmtHour = (h) => `${String(h % 24).padStart(2, '0')}:00`;

  const SPORTS = {
    f5:    { name: 'Fútbol 5', short: 'F5',    type: 'football', count: 3, icon: { w: 90,  h: 150 } },
    f6:    { name: 'Fútbol 6', short: 'F6',    type: 'football', count: 2, icon: { w: 100, h: 150 } },
    padel: { name: 'Pádel',    short: 'Pádel', type: 'padel',    count: 2, icon: { w: 70,  h: 140 } },
  };

  // Precios por hora. La luz se cobra desde las 19:00 (luzDesde).
  // El quincho se alquila por evento, no por hora.
  const PRICES = {
    luzDesde: 19,
    f5:    { sinLuz: 30000, conLuz: 35000 },
    f6:    { sinLuz: 30000, conLuz: 35000 },
    padel: { sinLuz: 25000, conLuz: 30000 },
    quincho: 100000,
  };

  const fmtMoney = (n) =>
    Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  // Precio de una cancha entre dos horas (cada hora vale distinto según haya luz o no).
  const courtPrice = (sport, from, to) => {
    let total = 0;
    for (let h = from; h < to; h++) total += h >= PRICES.luzDesde ? PRICES[sport].conLuz : PRICES[sport].sinLuz;
    return total;
  };

  // Plan layout in a 640x520 space: courts are drawn top-down, not to scale.
  // Las canchas de fútbol se numeran del 1 al 5 (1 a 3 son de fútbol 5 y 4 y 5 de fútbol 6);
  // las de pádel son Pádel 1 y Pádel 2.
  const COURTS = [
    { sport: 'f5',    n: 1, x: 30,  y: 50,  w: 135, h: 200 },
    { sport: 'f5',    n: 2, x: 180, y: 50,  w: 135, h: 200 },
    { sport: 'f5',    n: 3, x: 330, y: 50,  w: 135, h: 200 },
    { sport: 'padel', n: 1, x: 490, y: 50,  w: 120, h: 200 },
    { sport: 'f6',    n: 4, x: 30,  y: 290, w: 210, h: 200 },
    { sport: 'f6',    n: 5, x: 255, y: 290, w: 210, h: 200 },
    { sport: 'padel', n: 2, x: 490, y: 290, w: 120, h: 200 },
  ];

  // Texto corto que va arriba de cada cancha en el plano: "1 · F5", "4 · F6", "Pádel 1".
  const courtLabel = (c) => (c.sport === 'padel' ? `Pádel ${c.n}` : `${c.n} · ${SPORTS[c.sport].short}`);

  // ---------- Court drawings ----------
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

  // ---------- Interactive plan ----------
  // onPick(sport, n) fires on click or keyboard; the caller owns the selection
  // state and reflects it back with plan.set(sport, n).
  function mountPlan(svg, { animate = true, onPick } = {}) {
    svg.innerHTML =
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
            <text class="court-label" x="0" y="-12">${courtLabel(c)}</text>
          </g>`;
      }).join('');

    svg.querySelectorAll('.lines > *').forEach((el) => el.setAttribute('pathLength', '1'));
    if (!animate) svg.classList.add('is-static');

    const pick = (g) => { if (onPick) onPick(g.dataset.sport, g.dataset.n); };
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('.court');
      if (g) pick(g);
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest('.court');
      if (g) { e.preventDefault(); pick(g); }
    });

    return {
      set(sport, n) {
        svg.querySelectorAll('.court').forEach((g) => {
          const on = !!n && g.dataset.sport === sport && g.dataset.n === String(n);
          g.setAttribute('aria-pressed', String(on));
        });
        if (sport) svg.dataset.sport = sport; else delete svg.dataset.sport;
      },
    };
  }

  // ---------- Court drawings on the Canchas page ----------
  function mountArt(root = document) {
    root.querySelectorAll('[data-icon]').forEach((svg) => {
      const key = svg.dataset.icon;
      const { w, h } = SPORTS[key].icon;
      svg.setAttribute('viewBox', `-8 -14 ${w + 16} ${h + 28}`);
      svg.innerHTML =
        `<rect class="court-fill" width="${w}" height="${h}"/>` +
        `<g class="lines">${linesFor(key, w, h)}</g>`;
    });
  }

  // ---------- Header: current page + mobile menu ----------
  function initNav() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const page = document.body.dataset.page;
    header.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    });

    const toggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('.nav');
    if (!toggle || !nav) return;

    const setOpen = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    toggle.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); toggle.focus(); }
    });
  }

  // Plain WhatsApp links: <a data-wa="mensaje opcional">
  function initWaLinks() {
    document.querySelectorAll('[data-wa]').forEach((a) => {
      a.href = waLink(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initWaLinks();
    mountArt();
  });

  window.Coliseo = { WA_NUMBER, SPORTS, COURTS, HOURS, PRICES, fmtHour, fmtMoney, courtPrice, waLink, mountPlan };
})();
