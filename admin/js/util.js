// Funciones de ayuda compartidas por todo el panel.
// Las horas son números enteros: 17 = 17:00, 24 = 00:00, 25 = 01:00.
window.PanelUtil = (() => {
  'use strict';

  // luzDesde: desde esa hora (19:00) se cobra el precio "con luz".
  const HOURS = { firstStart: 17, lastStart: 24, lastEnd: 25, luzDesde: 19 };

  const ESTADOS = {
    pendiente: 'Pendiente',
    senada: 'Señada',
    pagada: 'Pagada',
    cancelada: 'Cancelada',
  };

  const EVENTOS = ['Cumpleaños', 'Evento infantil', 'Reunión de amigos o familia', 'Otro'];

  const TIPOS = {
    futbol5: 'Fútbol 5',
    futbol6: 'Fútbol 6',
    padel: 'Pádel',
    quincho: 'Quincho',
  };

  const pad = (n) => String(n).padStart(2, '0');
  const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);
  const fmtHour = (h) => `${pad(h % 24)}:00`;

  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  // La jornada del complejo termina a la 01:00: de madrugada todavía "es" el día anterior.
  const today = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return now.getHours() < 3 ? addDays(d, -1) : d;
  };

  const fmtDayLong = (d) =>
    d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDayShort = (d) =>
    d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  const fmtDateTime = (ts) =>
    new Date(ts).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', ' a las');

  // Todo texto que escribe una persona se "escapa" antes de mostrarlo en pantalla,
  // para que nadie pueda meter código raro desde un nombre o una nota.
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return {
    HOURS, ESTADOS, EVENTOS, TIPOS,
    range, fmtHour, iso, parseISO, addDays, today,
    fmtDayLong, fmtDayShort, fmtMoney, fmtDateTime, esc,
  };
})();
