(() => {
  'use strict';

  const { SPORTS, mountPlan } = window.Coliseo;

  const status = document.getElementById('plan-status');
  const go = document.getElementById('plan-go');
  const state = { sport: '', n: '' };

  const plan = mountPlan(document.getElementById('plan'), {
    onPick(sport, n) {
      const same = sport === state.sport && n === state.n;
      state.sport = same ? '' : sport;
      state.n = same ? '' : n;
      render();
    },
  });

  function render() {
    plan.set(state.sport, state.n);

    if (!state.sport) {
      status.textContent = 'Tocá una cancha del plano para elegirla.';
    } else {
      status.textContent = `Elegiste ${SPORTS[state.sport].name}, cancha ${state.n}.`;
    }

    go.hidden = !state.sport;
    if (state.sport) {
      go.href = `reservar.html?tipo=cancha&deporte=${state.sport}&cancha=${state.n}`;
    }
  }

  render();
})();
