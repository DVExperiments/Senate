/* Routing, the live loop, and obeying the Senate's own laws. */
(function () {
  const M = window.SM, V = window.SV, S = M.S;
  const main = document.getElementById('main');
  const ROUTES = { '': 'chamber', senators: 'senators', senator: 'senator', bills: 'bills', bill: 'bill', elections: 'elections', election: 'election', laws: 'laws', parties: 'parties', records: 'records', about: 'about' };
  const NAV = { senator: 'senators', bill: 'bills', election: 'elections' };
  let unmount = null;

  // ---------------------------------------------------------------- the Senate obeys its own laws
  const FONT_AXES = {
    'Bricolage Grotesque': 'opsz,wght@12..96,700;12..96,800', 'Space Grotesk': 'wght@500;700', 'Fraunces': 'opsz,wght@9..144,700;9..144,800',
    'DM Serif Display': '', 'Syne': 'wght@700;800', 'Archivo Narrow': 'wght@600;700', 'IBM Plex Sans': 'wght@400;500;600',
    'Source Serif 4': 'opsz,wght@8..60,400;8..60,600', 'Work Sans': 'wght@400;500;600', 'Atkinson Hyperlegible': 'wght@400;700',
    'IBM Plex Mono': 'wght@400;500;600', 'Literata': 'opsz,wght@7..72,400;7..72,600'
  };
  const loadedFonts = {};
  function loadFont(name) {
    if (!name || loadedFonts[name] || !(name in FONT_AXES)) return;
    loadedFonts[name] = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + (FONT_AXES[name] ? ':' + FONT_AXES[name] : '') + '&display=swap';
    document.head.appendChild(link);
  }
  let lastVars = '';
  function obeyLaws() {
    try {
      const now = M.now();
      const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const vars = S.styleVars(now, scheme);
      const json = JSON.stringify(vars);
      if (json === lastVars) return;
      lastVars = json;
      for (const k in vars) document.documentElement.style.setProperty(k, vars[k]);
      const laws = S.lawsAt(now);
      loadFont(laws['style.display']);
      loadFont(laws['style.body']);
    } catch (e) { /* defaults stay in place */ }
  }

  // ---------------------------------------------------------------- routing
  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, arg] = h.split('/');
    return { view: ROUTES[name || ''] || 'chamber', arg: arg ? decodeURIComponent(arg) : null };
  }
  function render() {
    if (unmount) { unmount(); unmount = null; }
    if (!S.ready()) { main.innerHTML = '<section class="page-head"><h1>The Senate cannot sit</h1><p class="lede">The Senate needs the Weather Bureau\u2019s records to know what has happened, and they could not be reached. Please try again shortly.</p></section>'; return; }
    const r = parse();
    const view = V[r.view];
    const model = M.build(true);
    main.innerHTML = view.render(model, r.arg);
    document.title = (r.view === 'chamber' ? '' : (view.title || '') + ' \u2013 ') + 'The Pixel Senate';
    const navKey = NAV[r.view] || r.view;
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.view === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (view.mount) unmount = view.mount(model, r.arg) || null;
    window.scrollTo(0, 0);
  }

  // keep links inside the time-travel moment
  if (M.timeTravel) {
    document.querySelectorAll('.nav a, .brand').forEach((a) => { a.href = M.atParam + a.getAttribute('href'); });
    const b = document.getElementById('travel');
    b.hidden = false;
    b.innerHTML = 'Watching the Senate from ' + M.esc(new Date(M.now()).toISOString().slice(0, 16).replace('T', ' ')) + ' UTC onwards. <a href="' + location.pathname + location.hash + '">Return to the present</a>.';
  }
  const dot = document.getElementById('livedot');
  function liveDot() {
    const now = M.now(), day = M.dayOf(now), st = M.build().st;
    const live = st.started && !st.dissolved && ((S.calendar.isSitting(day) && now >= day + 19 * M.H && now < day + 23.5 * M.H && !S.calendar.adjourned(day)) || st.filibuster);
    dot.classList.toggle('off', !live);
    dot.title = live ? 'The Senate is sitting' : 'The Senate is not sitting';
  }

  window.addEventListener('hashchange', render);
  obeyLaws();
  render();
  liveDot();
  setInterval(() => { obeyLaws(); liveDot(); }, 30000);
})();
