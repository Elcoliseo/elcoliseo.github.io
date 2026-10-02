(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const views = {
    loading: $('#v-loading'),
    login:   $('#v-login'),
    denied:  $('#v-denied'),
    app:     $('#v-app'),
  };
  const show = (name) => Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });

  const form = $('#login-form');
  const errorBox = $('#login-error');
  const loginBtn = $('#login-btn');

  const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
  const clearError = () => { errorBox.hidden = true; errorBox.textContent = ''; };

  // ---------- Conexión con la base de datos ----------
  const cfg = window.COLISEO_CONFIG || {};
  const notConfigured = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('TU-PROYECTO');

  if (!window.supabase) {
    show('login');
    showError('No se pudo cargar el sistema. Revisá tu conexión a internet y recargá la página.');
    loginBtn.disabled = true;
    return;
  }
  if (notConfigured) {
    show('login');
    showError('Falta completar la dirección del proyecto en admin/js/config.js.');
    loginBtn.disabled = true;
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

  // ---------- Entrar al panel ----------
  // Tener cuenta no alcanza: además tiene que estar en la lista de administradores.
  // La base de datos solo devuelve esa fila si la persona está autorizada.
  async function enter(session) {
    if (!session) { show('login'); return; }

    const { data, error } = await db.from('administradores').select('email').maybeSingle();

    if (error) {
      show('login');
      showError('No se pudo verificar tu permiso. Revisá tu conexión e intentá de nuevo.');
      return;
    }
    if (!data) {
      $('#denied-email').textContent = session.user.email;
      show('denied');
      return;
    }

    $('#user-email').textContent = session.user.email;
    show('app');

    // Primero se cargan las canchas; las demás secciones las necesitan.
    const ready = await window.Reservas.init(db);
    if (!ready) return;
    window.Quincho.init(db);
    window.Eventos.init(db);
    window.Resumen.init(db);
    window.PanelNav.start();
  }

  async function signOut() {
    await db.auth.signOut();
    form.reset();
    clearError();
    show('login');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    if (!email || !password) {
      showError('Completá el email y la contraseña.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Entrando…';

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'El email o la contraseña no son correctos.'
        : 'No se pudo iniciar sesión. Revisá tu conexión e intentá de nuevo.');
      return;
    }
    form.password.value = '';
    await enter(data.session);
  });

  $('#show-pass').addEventListener('change', (e) => {
    form.password.type = e.target.checked ? 'text' : 'password';
  });

  $('#logout').addEventListener('click', signOut);
  $('#denied-out').addEventListener('click', signOut);

  // Si ya había una sesión abierta en este celular, entra directo.
  db.auth.getSession().then(({ data }) => enter(data.session));
})();
