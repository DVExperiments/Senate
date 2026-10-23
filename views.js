/* Every page of the Senate site. Each view returns HTML; the chamber view also animates. */
(function () {
  const M = window.SM, F = window.SF, S = M.S, esc = M.esc, DAY = M.DAY, H = M.H, MIN = M.MIN;
  const V = (window.SV = {});
  const head = (title, lede, kicker) => '<section class="page-head">' + (kicker ? '<p class="kicker">' + kicker + '</p>' : '') +
    '<h1>' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + '</section>';
  const table = (cols, rows, opts) => '<div class="table-wrap"><table class="data' + (opts && opts.cls ? ' ' + opts.cls : '') + '"' + (opts && opts.id ? ' id="' + opts.id + '"' : '') + '>' +
    (opts && opts.caption ? '<caption>' + opts.caption + '</caption>' : '') + '<thead><tr>' +
    cols.map((c) => '<th' + (c.n ? ' class="n"' : '') + (c.sort ? ' data-sort="' + c.sort + '"' : '') + '>' + (c.sort ? '<button type="button">' + c.label + '</button>' : c.label) + '</th>').join('') +
    '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + cols.length + '" class="muted">Nothing yet.</td></tr>') + '</tbody></table></div>';
  const td = (v, n, sortVal) => '<td' + (n ? ' class="n"' : '') + (sortVal !== undefined ? ' data-v="' + esc(sortVal) + '"' : '') + '>' + v + '</td>';
  const notStarted = (model) => '<p class="banner">The Senate has not been elected yet. The founding election is on ' + M.date(M.START) +
    '. To look ahead, add <code>?at=2027-03-14T21:30</code> to the address.</p>';
  function voteCell(v) {
    return v === 'A' ? '<span class="v A">Aye</span>' : v === 'N' ? '<span class="v N">No</span>' : '<span class="v X">Absent</span>';
  }
  function compBar(c) {
    return '<div class="compbar" role="img" aria-label="Seats">' + ['B', 'V', 'L', 'I'].map((p) => c[p] ? '<i style="width:' + (c[p] / 48 * 100) + '%;background:' + M.COLORS[p] + '"></i>' : '').join('') + '</div>';
  }
  function compText(c) {
    return ['B', 'V', 'L', 'I'].filter((p) => c[p]).map((p) => M.chip(p) + M.PNAME[p] + ' ' + c[p]).join(', ') + (c.vacant ? ', vacant ' + c.vacant : '');
  }
  function lawValue(key, v) {
    if (v && typeof v === 'object') {
      if (!v.h && !v.s && !v.l) return 'Original';
      const sg = (x) => (x > 0 ? '+' : '') + x;
      return 'Hue ' + sg(v.h) + '\u00b0, saturation ' + sg(v.s) + '%, lightness ' + sg(v.l) + '%';
    }
    return esc(v);
  }

  // ================================================================ chamber
  V.chamber = {
    title: 'Chamber',
    render(model) {
      return '<section class="page-head" style="padding-bottom:16px"><p class="kicker" id="kicker">\u00a0</p><h1 class="status" id="status">\u00a0</h1></section>' +
        '<figure class="screen"><canvas id="chamber" width="960" height="430" role="img" aria-label="The Senate chamber, one pixel per senator. Select a senator to see their record."></canvas>' +
        '<figcaption class="screen-bar"><span id="mode"></span><span class="clock" id="clock"></span></figcaption></figure>' +
        '<div class="ticker" aria-hidden="true"><div class="ticker-track" id="ticker"></div></div>' +
        '<div class="live-body"><section class="log"><h2>On the floor</h2><ul class="feed" id="floorfeed"></ul></section>' +
        '<aside class="side"><h2>The chamber</h2><div id="composition"></div><h2>Order paper</h2><div id="paper"></div>' +
        '<h2>Coming up</h2><dl class="facts" id="upcoming" style="grid-template-columns:1fr 1fr"></dl></aside></div>';
    },
    mount(model) {
      const canvas = document.getElementById('chamber');
      const chamber = new F.Chamber(canvas);
      canvas.addEventListener('pointermove', (ev) => {
        const h = chamber.hitTest(ev.clientX, ev.clientY);
        chamber.hover = h ? h.id : null;
        canvas.style.cursor = h ? 'pointer' : 'default';
      });
      canvas.addEventListener('pointerleave', () => { chamber.hover = null; canvas.style.cursor = 'default'; });
      canvas.addEventListener('click', (ev) => {
        const h = chamber.hitTest(ev.clientX, ev.clientY);
        if (h) location.hash = '#/senator/' + h.id;
      });
      const shown = new Set();
      let base = null, lastBase = 0, raf = 0, timer = 0, firstFeed = true;
      const st = () => M.build().st;
      function frameState(now) {
        const m = M.build();
        if (!base || now - lastBase > 1000) { base = F.base(m, now); lastBase = now; }
        const f = { seats: (m.st.seats || []), majority: m.st.majority, shutdown: !!m.st.shutdown, dissolved: base.mode === 'dissolved', pre: base.mode === 'pre', active: base.mode === 'live' || base.mode === 'replay' };
        if (f.active) {
          const sim = F.simNow(base, now);
          const biz = F.business(base, sim, m);
          const sp = F.speech(base, sim, biz, m);
          f.sim = sim; f.biz = biz; f.speaker = sp ? sp.id : null; f.speech = sp;
          f.division = biz.division; f.result = biz.division ? null : biz.result; f.filibuster = biz.filibuster;
          if (base.mode === 'replay') f.seats = base.paper.seats;
        }
        return f;
      }
      function loop() {
        chamber.draw(frameState(M.now()));
        raf = requestAnimationFrame(loop);
      }
      function tick() {
        const now = M.now(), m = M.build(), f = frameState(now);
        const set = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
        set('clock', M.timeSec(now));
        let kicker = '', status = '', mode = '';
        if (base.mode === 'pre') {
          kicker = 'Awaiting the founding election';
          status = 'The founding election is in ' + M.dur(M.START + 11 * H - now, true) + '.';
          mode = 'Empty chamber';
        } else if (base.mode === 'dissolved') {
          kicker = 'The Senate is dissolved';
          status = 'The snap election is in ' + M.dur(Date.parse(m.st.snapElection) + 11 * H - now, true) + '.';
          mode = 'No sittings until the snap election';
        } else if (base.mode === 'idle') {
          kicker = 'Between elections and the first sitting';
          status = 'The Senate first sits in ' + M.dur(M.FIRST_SITTING + 19 * H - now, true) + '.';
          mode = 'The chamber is quiet';
        } else {
          const biz = f.biz;
          const title = (b) => (b ? M.link('bill/' + b.id, esc(b.title)) : 'the matter before it');
          if (biz.division) {
            const e = biz.division.e, tl = chamber.tally || { a: 0, n: 0 };
            const counting = tl.a < e.data.ayes || tl.n < e.data.noes;
            status = 'Division on the ' + (e.data.bill ? M.link('bill/' + e.data.bill, esc(M.divisionTitle(e))) : esc(M.divisionTitle(e))) + ': ' +
              tl.a + '\u2013' + tl.n + (counting ? ' and counting.' : '.');
          } else if (biz.result) {
            status = M.linkHeadline(m, biz.result) + '.';
          } else if (biz.filibuster) {
            status = M.senLink(m, biz.filibuster.data.senator, { plain: 1 }) + ' has held the floor for ' + M.dur(f.sim - biz.filibuster.ms, true) + '.';
          } else if (f.speech) {
            status = M.senLink(m, f.speech.id, { plain: 1 }) + ' has the floor on the ' + title(biz.bill) + '.';
          } else if (biz.phase === 'introductions') status = 'New bills are being introduced.';
          else if (biz.phase === 'opening') status = 'The Senate is sitting.';
          else if (biz.phase === 'risen') status = 'The Senate has risen for the night.';
          else status = 'The Senate is dealing with formal business.';
          if (base.mode === 'live') { kicker = m.st.shutdown ? 'Live from the chamber, shutdown day ' + m.st.shutdown.days : 'Live from the chamber'; mode = 'Live'; }
          else {
            kicker = (base.adjourned ? 'Today\u2019s sitting was called off: ' + esc(base.adjourned.text) + '. ' : '') + 'Replay of the sitting on ' + M.date(base.day) + ' at ' + F.REPLAY_SPEED + '\u00d7 speed. The Senate sits again in ' + M.dur(base.nextSitting - now, true) + '.';
            mode = 'Replay ' + F.REPLAY_SPEED + '\u00d7, ' + M.timeSec(f.sim);
          }
        }
        set('kicker', kicker); set('status', status); set('mode', mode);
        // the floor feed
        if (f.active) {
          const hold = F.reveal(base);
          const evs = F.eventsAt(base, f.sim).filter((e) => !F.spoils(e) || f.sim - e.ms >= hold).slice(-30).map((e) => ({ id: e.id, ms: e.ms, html: M.linkHeadline(m, e) }));
          const slot = F.SPEECH_SLOT(base);
          for (let k = 0; k < 8; k++) {
            const s0 = f.sim - (f.sim % slot) - k * slot;
            const biz = F.business(base, s0, m);
            const sp = F.speech(base, s0, biz, m);
            if (sp) evs.push({ id: 'sp' + s0, ms: s0, speech: true, html: sp.filibuster ? esc(sp.text) : M.senLink(m, sp.id) + ': <q>' + esc(sp.text) + '</q>' });
          }
          evs.sort((a, b) => b.ms - a.ms);
          const html = evs.slice(0, 40).map((e) => {
            const fresh = !firstFeed && !shown.has(e.id);
            shown.add(e.id);
            return '<li class="' + (e.speech ? 'speech' : '') + (fresh ? ' fresh' : '') + '"><time>' + M.time(e.ms) + '</time><span>' + e.html + '</span></li>';
          }).join('');
          firstFeed = false;
          set('floorfeed', html || '<li class="empty">The sitting has only just begun.</li>');
          // order paper
          const decided = {};
          for (const e of F.eventsAt(base, f.sim)) if (F.isDivision(e) && e.data.bill && f.sim - e.ms >= F.reveal(base)) decided[e.data.bill] = e;
          const rows = base.paper.bills.map((b) => {
            const d = decided[b.id];
            const stat = d ? (M.passedDivision(d) ? 'Passed ' : 'Defeated ') + d.data.ayes + '\u2013' + d.data.noes : f.biz.bill && f.biz.bill.id === b.id ? '<b>Now</b>' : 'Waiting';
            return '<tr><td class="wrap">' + M.link('bill/' + b.id, esc(b.title)) + '</td><td>' + (b.sponsor ? M.senLink(m, b.sponsor) : '') + '</td><td>' + stat + '</td></tr>';
          });
          set('paper', rows.length ? '<div class="table-wrap"><table class="data"><tbody>' + rows.join('') + '</tbody></table></div>' : '<p class="muted">No divisions on tonight\u2019s order paper.</p>');
        } else {
          set('floorfeed', '<li class="empty">Nothing on the floor.</li>');
          set('paper', '<p class="muted">No sitting.</p>');
        }
        // composition and coming up
        const s = m.st;
        if (s.started) {
          const lead = ['B', 'V', 'L'].map((p) => s.leaders[p] ? '<div>' + M.PNAME[p] + ': ' + M.senLink(m, s.leaders[p].id) + (s.majority === p ? ' <span class="tag">Majority Leader</span>' : '') + '</div>' : '').join('');
          set('composition', compBar(s.composition) + '<p style="margin:0 0 10px">' + compText(s.composition) + '</p>' + lead +
            '<p class="muted" style="margin-top:10px">' + esc(s.presidingOfficer.title + ' ' + s.presidingOfficer.name) + ' presides.</p>');
          const up = [];
          const add = (k, v) => up.push('<div><dt>' + k + '</dt><dd>' + v + '</dd></div>');
          const nextEl = Date.parse(s.nextElection) + 11 * H;
          add(s.dissolved ? 'Snap election' : 'Next election', M.dur(nextEl - now, true));
          add('Budget', s.budget ? esc(s.budget.fy) + (s.budget.passed ? ' passed' : ' pending') : 'Due in June');
          add('Shutdown', s.shutdown ? 'Day ' + s.shutdown.days : 'No');
          add('Inquiries', s.inquiries.length ? String(s.inquiries.length) : 'None');
          if (s.lastPoll) add('Latest poll', 'B ' + s.lastPoll.B + ', V ' + s.lastPoll.V + ', L ' + s.lastPoll.L);
          add('Bills in committee', String((s.bills || []).filter((b) => b.stage === 'committee').length));
          const wx = window.PixelUniverse.climate && window.PixelUniverse.climate.sample(now);
          if (wx) add('Outside', esc(wx.cond) + ', ' + Math.round(wx.temp) + '\u00b0C');
          set('upcoming', up.join(''));
          const tk = m.events.filter((e) => e.importance >= 3 && now - e.ms > 15 * MIN).slice(-14).reverse();
          set('ticker', tk.map((e) => '<span><b>' + M.dateShort(e.ms) + '</b>' + esc(e.headline) + '</span>').join(''));
        } else {
          set('composition', '<p class="muted">48 seats across 16 districts, elected on ' + M.date(M.START) + '.</p>');
          set('upcoming', '<div><dt>Founding election</dt><dd>' + M.date(M.START) + '</dd></div><div><dt>First sitting</dt><dd>' + M.date(M.FIRST_SITTING) + '</dd></div>');
          set('ticker', '');
        }
      }
      tick();
      timer = setInterval(tick, 1000);
      raf = requestAnimationFrame(loop);
      return () => { clearInterval(timer); cancelAnimationFrame(raf); };
    }
  };

  // ================================================================ senators
  V.senators = {
    title: 'Senators',
    render(model) {
      if (!model.st.started) return head('Senators', 'Forty-eight pixels, three for each district.') + notStarted(model);
      const seats = model.st.seats.filter((s) => s.senator).sort((a, b) => a.senator.party.localeCompare(b.senator.party) || a.senator.name.localeCompare(b.senator.name));
      const tiles = seats.map((s, i) => {
        const x = M.senator(model, s.senator.id);
        const role = x.roles[0] || (s.senator.lameDuck ? 'Lame duck' : '');
        return '<li><a class="tile" href="' + M.atParam + '#/senator/' + s.senator.id + '"><span class="swatch' + (s.senator.lameDuck ? ' duck' : '') + '" style="--c:' + M.COLORS[s.senator.party] + ';--d:-' + (i % 7) * 0.13 + 's"><i></i>' +
          (role ? '<span class="role">' + esc(role) + '</span>' : '') + '</span><span class="tile-name">' + esc(s.senator.name) + '</span><span class="tile-meta">' +
          M.PNAME[s.senator.party] + ', ' + esc(s.district) + '</span></a></li>';
      }).join('');
      const rows = seats.map((s) => {
        const x = M.senator(model, s.senator.id), p = s.senator;
        return '<tr>' + td(M.senLink(model, p.id, { duck: p.lameDuck }), false, p.name) + td(M.PNAME[p.party], false, p.party) + td(M.district(s.district), false, s.district) +
          td(p.termsWon, true, p.termsWon) + td(x.cast, true, x.cast) + td(M.pct(x.attendance), true, x.attendance || 0) + td(x.rebels, true, x.rebels) +
          td(x.p.stats.sponsored, true, x.p.stats.sponsored) + td(x.p.stats.passed, true, x.p.stats.passed) + td(x.p.stats.scandals, true, x.p.stats.scandals) +
          td(s.termEnds ? M.date(Date.parse(s.termEnds)) : '\u2013', true, s.termEnds || '') + '</tr>';
      });
      const former = Object.values(model.people).filter((p) => p.since && p.status !== 'serving').sort((a, b) => b.since - a.since);
      const formerRows = former.map((p) => '<tr>' + td(M.senLink(model, p.id)) + td(M.PNAME[p.party]) + td(M.district(model.st.seats[p.district * 3] ? model.st.seats[p.district * 3].district : '')) +
        td(M.date(p.since)) + td(p.termsWon, true) + td(esc(M.STATUS[p.status] || p.status)) + '</tr>');
      return head('Senators', 'The 48 pixels currently serving. Faded pixels are lame ducks: in their final term or retiring.') +
        '<ul class="tiles">' + tiles + '</ul>' +
        '<h2>Every serving senator</h2><p class="hint">Select a column heading to sort.</p>' +
        table([{ label: 'Senator', sort: 's' }, { label: 'Party', sort: 's' }, { label: 'District', sort: 's' }, { label: 'Terms', n: 1, sort: 'n' }, { label: 'Votes', n: 1, sort: 'n' },
          { label: 'Attendance', n: 1, sort: 'n' }, { label: 'Rebellions', n: 1, sort: 'n' }, { label: 'Bills', n: 1, sort: 'n' }, { label: 'Passed', n: 1, sort: 'n' },
          { label: 'Scandals', n: 1, sort: 'n' }, { label: 'Term ends', n: 1, sort: 's' }], rows, { id: 'sentable' }) +
        '<h2>Former senators</h2>' + table([{ label: 'Senator' }, { label: 'Party' }, { label: 'District' }, { label: 'First elected' }, { label: 'Terms', n: 1 }, { label: 'How they left' }], formerRows);
    },
    mount() { sortable('sentable'); }
  };
  function sortable(id) {
    const t = document.getElementById(id);
    if (!t) return;
    t.querySelectorAll('th[data-sort] button').forEach((btn, col) => {
      btn.addEventListener('click', () => {
        const th = btn.parentElement, idx = Array.from(th.parentElement.children).indexOf(th);
        const desc = th.getAttribute('aria-sort') !== 'descending';
        t.querySelectorAll('th').forEach((x) => x.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
        const num = th.dataset.sort === 'n';
        const rows = Array.from(t.tBodies[0].rows);
        rows.sort((a, b) => {
          const x = a.cells[idx].dataset.v, y = b.cells[idx].dataset.v;
          const c = num ? (+x) - (+y) : String(x).localeCompare(String(y));
          return desc ? -c : c;
        });
        rows.forEach((r) => t.tBodies[0].appendChild(r));
      });
    });
  }

  // ================================================================ one senator
  V.senator = {
    title: 'Senator',
    render(model, id) {
      const x = M.senator(model, id);
      if (!x) return head('Unknown senator', 'No senator by that id has served yet.');
      const p = x.p, seat = x.seat;
      const serving = p.status === 'serving';
      const districtName = seat ? seat.district : (model.st.seats[p.district * 3] || {}).district || '';
      const status = serving ? (x.roles.length ? x.roles.join(', ') : 'Senator') + ' for ' + esc(districtName) : esc(M.STATUS[p.status] || p.status);
      const facts = [];
      const fact = (k, v, small) => facts.push('<div><dt>' + k + '</dt><dd>' + v + (small ? ' <small>' + small + '</small>' : '') + '</dd></div>');
      fact('Party', M.chip(p.party) + M.PNAME[p.party]);
      fact('First elected', M.date(p.since));
      fact('Terms won', p.termsWon, p.termsWon >= model.st.termLimit ? 'term-limited' : 'of ' + model.st.termLimit);
      if (seat && seat.termEnds) fact('Term ends', M.date(Date.parse(seat.termEnds)));
      fact('Votes cast', x.cast, x.ayes + ' aye, ' + x.noes + ' no');
      fact('Attendance', M.pct(x.attendance), x.absent + ' missed');
      fact('Rebellions', x.rebels, x.cast ? M.pct(x.rebels / x.cast) + ' of votes' : '');
      fact('On the winning side', M.pct(x.winningSide));
      fact('Votes with own party', M.pct(x.partyAgreement));
      fact('Bills sponsored', x.sponsored.length, x.passedBills.length + ' passed');
      fact('Filibusters', p.stats.filibusters, p.stats.longestFilibusterMs ? 'longest ' + M.dur(p.stats.longestFilibusterMs) : '');
      fact('Scandals', p.stats.scandals, x.inquiry ? 'inquiry under way' : '');
      fact('Party switches', x.defections.length);
      const traits = (label, v, c) => '<div class="trait"><dt>' + label + '</dt><dd><span class="bar" style="--v:' + Math.max(0, Math.min(1, v)) + ';--c:' + c + '"></span></dd></div>';
      const axis = (label, v, lo, hi) => '<div class="trait axis"><dt>' + label + '</dt><dd><span class="bar" style="--v:' + ((v + 1) / 2) + ';--c:' + M.COLORS[p.party] + '"></span></dd></div><div class="axis-labels"><span>' + lo + '</span><span>' + hi + '</span></div>';
      const c = M.COLORS[p.party];
      const traitHtml = '<dl class="traits">' + axis('Environment', p.env, 'Industrial', 'Green') + axis('Aesthetics', p.aes, 'Tradition', 'Change') +
        traits('Party loyalty', p.loyalty, c) + traits('Ambition', p.ambition, c) + traits('Presence', (p.quality - 0.7) / 0.45, c) + traits('Scandal risk', p.scandalRisk, c) + '</dl>' +
        (p.pet ? '<p class="muted">Pet cause: ' + esc(S.lawKeys.policy[p.pet.key] ? (p.pet.dir > 0 ? S.lawKeys.policy[p.pet.key].up : S.lawKeys.policy[p.pet.key].down) : p.pet.key) + '</p>' : '');
      const allies = x.allies.length ? '<ul class="timeline">' + x.allies.map((a) => '<li><span>' + M.pct(a.rate) + '</span><span>' + M.senLink(model, a.id) + ' <small>' + a.n + ' shared votes</small></span></li>').join('') + '</ul>' : '<p class="muted">Not enough shared votes yet.</p>';
      const foes = x.opponents.length ? '<ul class="timeline">' + x.opponents.map((a) => '<li><span>' + M.pct(a.rate) + '</span><span>' + M.senLink(model, a.id) + ' <small>' + a.n + ' shared votes</small></span></li>').join('') + '</ul>' : '';
      const votes = x.record.slice(-60).reverse().map((r) => '<tr>' + td(M.dateShort(r.e.ms)) + '<td class="wrap">' + (r.e.data.bill ? M.link('bill/' + r.e.data.bill, esc(M.divisionTitle(r.e))) : esc(M.divisionTitle(r.e))) + '</td>' +
        td(voteCell(r.v) + (r.rebel ? '<span class="tag">Rebel</span>' : '')) + td((M.passedDivision(r.e) ? 'Carried ' : 'Defeated ') + r.e.data.ayes + '\u2013' + r.e.data.noes) + '</tr>');
      const bills = x.sponsored.slice().reverse().map((b) => '<tr><td class="wrap">' + M.link('bill/' + b.id, esc(b.title)) + '</td>' + td(M.dateShort(b.introduced)) + td(b.stage === 'committee' ? 'In committee' : b.stage === 'floor' ? 'Awaiting a vote' : b.stage === 'passed' ? 'Passed' : b.stage === 'failed' ? 'Defeated' : 'Lapsed') + '</tr>');
      const els = x.elections.slice().reverse().map((el) => '<tr>' + td(M.date(el.ms)) + td(esc(el.kind)) + td(M.district(el.district)) + td(el.won ? '<b>Won</b>' : 'Lost to ' + esc(el.winner.name)) +
        td(M.pct(el.first), true) + td(M.pct(el.final), true) + td(el.rounds, true) + td(el.opponents.map((o) => M.chip(o.party) + esc(o.name)).join(', ')) + '</tr>');
      const timeline = x.events.slice().reverse().filter((e) => e.type !== 'bill.introduced' || e.data.sponsor === id).slice(0, 80)
        .map((e) => '<li><time>' + M.dateShort(e.ms) + ' ' + new Date(e.ms).getUTCFullYear() + '</time><span>' + M.linkHeadline(model, e) + '</span></li>').join('');
      const scandals = x.scandals.slice().reverse().map((e) => '<li><time>' + M.date(e.ms) + '</time><span>' + M.linkHeadline(model, e) + '</span></li>').join('');
      const affil = [];
      affil.push('<li><time>' + M.date(p.since) + '</time><span>Elected for ' + M.district(districtName) + '</span></li>');
      for (const e of x.leaderships) affil.push('<li><time>' + M.date(e.ms) + '</time><span>' + M.linkHeadline(model, e) + '</span></li>');
      for (const e of x.defections) affil.push('<li><time>' + M.date(e.ms) + '</time><span>' + M.linkHeadline(model, e) + '</span></li>');
      return '<section class="profile-head"><div class="big-swatch' + (serving ? '' : ' gone') + '" style="--c:' + c + '"><i style="' + (x.lameDuck ? 'opacity:.5' : '') + '"></i></div><div>' +
        '<p class="kicker">' + status + (x.lameDuck ? ' <span class="tag">Lame duck</span>' : '') + (x.inquiry ? ' <span class="tag">Under inquiry</span>' : '') + '</p>' +
        '<h1>' + esc(p.name) + '</h1><p class="lede">' + M.PFULL[p.party] + '. ' + (p.env > 0.3 ? 'A committed green' : p.env < -0.3 ? 'Unapologetically industrial' : 'Undecided on the environment') +
        ' and ' + (p.aes > 0.3 ? 'eager for change' : p.aes < -0.3 ? 'devoted to tradition' : 'relaxed about appearances') + '; ' + (p.loyalty > 0.7 ? 'reliably loyal to the party line.' : p.loyalty < 0.4 ? 'known to defy the whips.' : 'usually loyal.') + '</p></div></section>' +
        '<dl class="facts" style="margin-top:20px">' + facts.join('') + '</dl>' +
        '<div class="profile-grid"><section><h2>Leanings</h2>' + traitHtml + '</section><section><h2>Closest allies across the floor</h2>' + allies + (foes ? '<h2 style="margin-top:28px">Votes least often with</h2>' + foes : '') + '</section></div>' +
        '<div class="two-col"><section><h2>Affiliations and roles</h2><ul class="timeline">' + affil.join('') + '</ul></section><section><h2>Scandals and inquiries</h2>' + (scandals ? '<ul class="timeline">' + scandals + '</ul>' : '<p class="muted">An unblemished record, so far.</p>') + '</section></div>' +
        '<h2>Elections</h2>' + table([{ label: 'Date' }, { label: 'Kind' }, { label: 'District' }, { label: 'Result' }, { label: 'First preferences', n: 1 }, { label: 'Final count', n: 1 }, { label: 'Rounds', n: 1 }, { label: 'Opponents' }], els) +
        '<h2>Bills sponsored</h2>' + table([{ label: 'Bill' }, { label: 'Introduced' }, { label: 'Outcome' }], bills) +
        '<h2>Voting record</h2><p class="hint">The latest 60 divisions.</p>' + table([{ label: 'Date' }, { label: 'Division' }, { label: 'Vote' }, { label: 'Result' }], votes) +
        '<h2>Career</h2><ul class="timeline">' + (timeline || '<li class="muted">No events yet.</li>') + '</ul>';
    }
  };

  // ================================================================ bills
  const STAGE = { committee: 'In committee', floor: 'Awaiting a vote', passed: 'Passed', failed: 'Defeated', lapsed: 'Lapsed' };
  V.bills = {
    title: 'Bills',
    render(model) {
      if (!model.st.started) return head('Bills', 'Every bill before the Senate, and every one it has decided.') + notStarted(model);
      const active = (model.st.bills || []).slice().sort((a, b) => a.no - b.no).map((b) => '<tr>' + td(b.no, true) + '<td class="wrap">' + M.link('bill/' + b.id, esc(b.title)) + '</td>' + td(M.senLink(model, b.sponsor)) + td(esc(b.kind)) +
        td(b.stage === 'committee' ? 'Committee, reports ' + M.dateShort(b.due) : STAGE[b.stage]) + '</tr>');
      const done = model.bills.slice().reverse().map((b) => '<tr data-stage="' + b.stage + '" data-kind="' + b.kind + '">' + td(b.no, true) + '<td class="wrap">' + M.link('bill/' + b.id, esc(b.title)) + '</td>' + td(M.senLink(model, b.sponsor)) +
        td(esc(b.kind)) + td(STAGE[b.stage]) + td(b.result ? b.result.ayes + '\u2013' + b.result.noes : '\u2013', true) + td(M.dateShort(b.finished) + ' ' + new Date(b.finished).getUTCFullYear()) + '</tr>');
      return head('Bills', 'Introduced, sent to committee, amended, bargained over and voted on, usually within a week.') +
        '<h2>Before the Senate</h2>' + table([{ label: 'No.', n: 1 }, { label: 'Bill' }, { label: 'Sponsor' }, { label: 'Kind' }, { label: 'Stage' }], active) +
        '<h2>Decided</h2><label class="filter">Outcome <select id="fstage"><option value="">All</option><option value="passed">Passed</option><option value="failed">Defeated</option><option value="lapsed">Lapsed</option></select></label>' +
        '<label class="filter">Kind <select id="fkind"><option value="">All</option><option>cosmetic</option><option>environmental</option><option>restoration</option><option>emergency</option><option>budget</option></select></label>' +
        table([{ label: 'No.', n: 1 }, { label: 'Bill' }, { label: 'Sponsor' }, { label: 'Kind' }, { label: 'Outcome' }, { label: 'Vote', n: 1 }, { label: 'Decided' }], done, { id: 'billtable' });
    },
    mount() {
      const apply = () => {
        const s = document.getElementById('fstage').value, k = document.getElementById('fkind').value;
        document.querySelectorAll('#billtable tbody tr').forEach((r) => { r.hidden = (s && r.dataset.stage !== s) || (k && r.dataset.kind !== k); });
      };
      const a = document.getElementById('fstage'), b = document.getElementById('fkind');
      if (a) { a.addEventListener('change', apply); b.addEventListener('change', apply); }
    }
  };
  V.bill = {
    title: 'Bill',
    render(model, id) {
      const b = model.billIndex[id];
      if (!b) return head('Unknown bill', 'No bill with that number has been introduced yet.');
      const evs = model.events.filter((e) => e.data && e.data.bill === id);
      const divs = evs.filter((e) => F.isDivision(e));
      const last = divs[divs.length - 1];
      const facts = [];
      const fact = (k, v) => facts.push('<div><dt>' + k + '</dt><dd>' + v + '</dd></div>');
      fact('Sponsor', M.senLink(model, b.sponsor));
      fact('Introduced', M.date(b.introduced));
      fact('Status', STAGE[b.stage] || b.stage);
      if (last) fact('Final vote', last.data.ayes + '\u2013' + last.data.noes + (last.data.tie ? ' (tie)' : ''));
      if (b.kind === 'budget') fact('Attempts', divs.length);
      if (last && last.data.rebels && last.data.rebels.length) fact('Rebels', last.data.rebels.length);
      const changes = [b.change].concat(b.riders || []).filter((c) => c && (c.delta || c.op !== 'step'));
      const describe = (c) => {
        const L = S.lawKeys;
        if (L.colours[c.key]) return L.colours[c.key].label + (c.op === 'reset' ? ' restored to the original' : ' ' + (c.field === 'h' ? 'hue' : c.field === 's' ? 'saturation' : 'lightness') + ' ' + (c.delta > 0 ? '+' : '') + c.delta + (c.field === 'h' ? '\u00b0' : '%'));
        if (L.choices[c.key]) return L.choices[c.key].label + (c.op === 'reset' ? ' restored to ' + L.choices[c.key].def : ' set to ' + c.value);
        if (L.policy[c.key]) return c.delta > 0 ? L.policy[c.key].up : L.policy[c.key].down;
        return c.key;
      };
      let roll = '';
      if (last) {
        const groups = { A: [], N: [], '-': [] };
        for (const sid in last.data.votes) groups[last.data.votes[sid]].push(sid);
        const list = (ids) => ids.map((sid) => '<div><span>' + M.senLink(model, sid) + '</span>' + (last.data.rebels && last.data.rebels.indexOf(sid) >= 0 ? '<span class="tag">Rebel</span>' : '') + '</div>').join('');
        roll = '<h2>Roll call</h2><p class="hint">' + M.dateTime(last.ms) + '.</p><h3 class="muted" style="font-weight:500">Ayes, ' + groups.A.length + '</h3><div class="rollcall">' + list(groups.A) + '</div>' +
          '<h3 class="muted" style="font-weight:500">Noes, ' + groups.N.length + '</h3><div class="rollcall">' + list(groups.N) + '</div>' +
          (groups['-'].length ? '<h3 class="muted" style="font-weight:500">Absent, ' + groups['-'].length + '</h3><div class="rollcall">' + list(groups['-']) + '</div>' : '');
      }
      return head(esc(b.title), 'Bill No. ' + b.no + '. ' + esc(changes.map(describe).join('; ')) + '.', esc(b.kind.charAt(0).toUpperCase() + b.kind.slice(1)) + ' bill' + (b.members ? ', drawn from the members\u2019 ballot' : '')) +
        '<dl class="facts">' + facts.join('') + '</dl>' +
        ((b.amendments || []).length ? '<h2>Amendments</h2><ul class="timeline">' + b.amendments.map((a) => '<li><span>Committee</span><span>' + esc(a) + '</span></li>').join('') + '</ul>' : '') +
        '<h2>History</h2><ul class="timeline">' + evs.map((e) => '<li><time>' + M.dateTime(e.ms) + '</time><span>' + M.linkHeadline(model, e) + '</span></li>').join('') + '</ul>' + roll;
    }
  };

  // ================================================================ elections
  V.elections = {
    title: 'Elections',
    render(model) {
      if (!model.st.started) return head('Elections', 'Preferential voting, staggered terms, one seat per district at each election.') + notStarted(model);
      const rows = model.elections.map((el, i) => ({ el, i })).reverse().map(({ el, i }) => {
        const flips = el.results.filter((r) => r.prevParty && r.prevParty !== r.cands[r.winner].party).length;
        return '<tr>' + td(M.link('election/' + i, M.date(el.ms))) + td(esc(el.kind)) + td(compBar(el.composition)) + td(compText(el.composition)) + td(el.kind === 'founding' ? '\u2013' : flips, true) + '</tr>';
      });
      const s = model.st;
      return head('Elections', 'Sixteen seats are contested on the last Saturday of every May and November, decided on preferences. Snap elections contest all 48.') +
        '<p class="lede">Next: ' + M.date(Date.parse(s.nextElection)) + (s.dissolved ? ' (snap election)' : '') + '.</p>' +
        table([{ label: 'Date' }, { label: 'Kind' }, { label: 'Seats after' }, { label: 'Composition' }, { label: 'Seats changing party', n: 1 }], rows);
    }
  };
  V.election = {
    title: 'Election',
    render(model, idx) {
      const el = model.elections[+idx];
      if (!el) return head('Unknown election', '');
      const rows = el.results.map((r) => {
        const valid = r.total - r.informal;
        const fin = r.rounds[r.rounds.length - 1];
        let ft = 0; for (const v of fin) ft += v;
        const w = r.cands[r.winner];
        const cands = r.cands.map((c, i) => M.chip(c.party) + (model.people[c.id] ? M.link('senator/' + c.id, esc(c.name)) : esc(c.name)) + ' ' + M.pct(r.rounds[0][i] / valid) + (fin[i] ? ' \u2192 ' + M.pct(fin[i] / ft) : '')).join('<br>');
        return '<tr>' + td(M.district(r.district)) + td(M.chip(w.party) + (model.people[w.id] ? M.link('senator/' + w.id, esc(w.name)) : esc(w.name))) + td(r.prevParty ? M.PNAME[r.prevParty] + (r.prevParty !== w.party ? ' <span class="tag">Gain</span>' : '') : '\u2013') +
          '<td class="wrap">' + cands + '</td>' + td(r.rounds.length, true) + td(M.pct(r.margin), true) + td(r.total.toLocaleString(), true) + '</tr>';
      });
      return head(M.date(el.ms), compText(el.composition) + '.', el.kind.charAt(0).toUpperCase() + el.kind.slice(1) + ' election') + compBar(el.composition) +
        '<h2>Results by seat</h2><p class="hint">Each candidate\u2019s first preferences, then their share in the final count.</p>' +
        table([{ label: 'District' }, { label: 'Winner' }, { label: 'Held by' }, { label: 'Candidates' }, { label: 'Rounds', n: 1 }, { label: 'Margin', n: 1 }, { label: 'Turnout', n: 1 }], rows);
    }
  };

  // ================================================================ laws
  V.laws = {
    title: 'Laws',
    render(model) {
      const laws = model.st.laws, L = S.lawKeys;
      const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const vars = S.styleVars(model.now, scheme);
      const changed = {};
      for (const e of model.events) if (e.type === 'law.in_effect') for (const c of e.data.changes) changed[c.key] = e;
      const row = (key, label, value, swatch) => '<tr>' + td(esc(label)) + td((swatch ? '<span class="chip" style="--c:' + swatch + '"></span>' : '') + value) +
        td(changed[key] ? M.link('bill/' + changed[key].data.bill, esc(changed[key].data.title)) + ' <small>' + M.date(changed[key].ms) + '</small>' : '<span class="muted">Never changed</span>') + '</tr>';
      const cos = [];
      for (const k in L.colours) cos.push(row(k, L.colours[k].label, lawValue(k, laws[k]), vars[L.colours[k].vars[0]]));
      for (const k in L.choices) cos.push(row(k, L.choices[k].label, esc(laws[k]) + (laws[k] === L.choices[k].def ? ' <small>original</small>' : '')));
      const pol = [];
      for (const k in L.policy) pol.push(row(k, L.policy[k].up.replace(/ \(.*\)$/, ''), laws[k] + ' <small>of ' + L.policy[k].max + ', originally ' + L.policy[k].def + '</small>'));
      const hist = model.events.filter((e) => e.type === 'law.in_effect').slice(-120).reverse()
        .map((e) => '<li><time>' + M.date(e.ms) + '</time><span>' + M.link('bill/' + e.data.bill, esc(e.data.title)) + ': ' + esc(e.headline.replace(/^Now in effect: /, '')) + '</span></li>').join('');
      return head('Laws in effect', 'The Senate may change how the universe looks and reads, never what happens in it. Every site that follows these laws changes at 00:00 UTC.') +
        '<h2>Appearance and names</h2><p class="hint">Colour laws are small shifts on Glacial\u2019s palette, capped and checked for readability. This site obeys them too.</p>' +
        table([{ label: 'Law' }, { label: 'In effect' }, { label: 'Last changed by' }], cos) +
        '<h2>Environmental policy</h2><p class="hint">Waiting for the city, which will build what these laws require.</p>' +
        table([{ label: 'Policy' }, { label: 'Level' }, { label: 'Last changed by' }], pol) +
        '<h2>Recent changes</h2><ul class="timeline">' + (hist || '<li class="muted">No laws have been changed yet.</li>') + '</ul>';
    }
  };

  // ================================================================ parties
  function lineChart(series, opts) {
    const W = 760, Hh = 240, P = 34;
    let minX = Infinity, maxX = -Infinity;
    for (const s of series) for (const pt of s.pts) { minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]); }
    if (!isFinite(minX) || minX === maxX) return '<p class="muted">Not enough data yet.</p>';
    const minY = opts.min, maxY = opts.max;
    const x = (v) => P + (v - minX) / (maxX - minX) * (W - P - 10), y = (v) => Hh - P + 10 - (v - minY) / (maxY - minY) * (Hh - P - 10);
    let g = '';
    for (let v = minY; v <= maxY; v += opts.step) g += '<line x1="' + P + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="currentColor" stroke-opacity="0.12"/><text x="' + (P - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">' + v + opts.unit + '</text>';
    const lines = series.map((s) => '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + s.pts.map((pt) => x(pt[0]).toFixed(1) + ',' + y(pt[1]).toFixed(1)).join(' ') + '"/>').join('');
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(opts.label) + '">' + g + lines + '<text x="' + P + '" y="' + (Hh - 8) + '" font-size="11" fill="currentColor" opacity="0.6">' + M.date(minX) + '</text><text x="' + (W - 10) + '" y="' + (Hh - 8) + '" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">' + M.date(maxX) + '</text></svg>';
  }
  V.parties = {
    title: 'Parties',
    render(model) {
      if (!model.st.started) return head('Parties', 'Three parties and the occasional independent.') + notStarted(model);
      const s = model.st, P = S.parties;
      const cards = ['B', 'V', 'L'].map((p) => {
        const leaders = model.events.filter((e) => (e.type === 'leader.elected' && e.data.party === p) || (e.type === 'leader.challenge' && e.data.party === p && e.data.won));
        const env = P[p].env, aes = P[p].aes;
        return '<section><h2>' + M.chip(p) + esc(P[p].name) + '</h2><p class="lede" style="font-size:1rem">' +
          (env > 0.3 ? 'Green' : env < -0.3 ? 'Industrial' : 'Mildly green') + ' on the environment, ' + (aes > 0.2 ? 'for change' : 'for tradition') + ' in matters of appearance.</p>' +
          '<dl class="facts" style="grid-template-columns:1fr 1fr"><div><dt>Seats</dt><dd>' + s.composition[p] + '</dd></div><div><dt>Support</dt><dd>' + M.pct(s.support[p]) + '</dd></div>' +
          '<div><dt>Leader</dt><dd style="font:600 1rem var(--body)">' + (s.leaders[p] ? M.senLink(model, s.leaders[p].id) : 'Vacant') + '</dd></div><div><dt>Leaders so far</dt><dd>' + leaders.length + '</dd></div></dl>' +
          '<ul class="timeline">' + leaders.slice(-5).reverse().map((e) => '<li><time>' + M.date(e.ms) + '</time><span>' + M.linkHeadline(model, e) + '</span></li>').join('') + '</ul></section>';
      }).join('');
      const polls = model.events.filter((e) => e.type === 'poll.published');
      const series = ['B', 'V', 'L'].map((p) => ({ color: M.COLORS[p], pts: polls.map((e) => [e.ms, e.data.poll[p]]) }));
      const els = model.elections.filter((e) => e.kind !== 'by-election');
      const seatSeries = ['B', 'V', 'L', 'I'].map((p) => ({ color: M.COLORS[p], pts: els.map((e) => [e.ms, e.composition[p]]) }));
      const legend = '<div class="legend">' + ['B', 'V', 'L', 'I'].map((p) => '<span>' + M.chip(p) + M.PNAME[p] + '</span>').join('') + '</div>';
      return head('Parties', 'Each party sits on two axes, so every pair agrees on something and alliances shift from bill to bill.') +
        '<div class="profile-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">' + cards + '</div>' +
        '<h2>Weekly polls</h2><figure class="chart">' + lineChart(series, { min: 15, max: 50, step: 5, unit: '%', label: 'Weekly polls' }) + '<figcaption>' + legend + '</figcaption></figure>' +
        '<h2>Seats after each election</h2><figure class="chart">' + lineChart(seatSeries, { min: 0, max: 30, step: 5, unit: '', label: 'Seats after each election' }) + '<figcaption>' + legend + '</figcaption></figure>';
    }
  };

  // ================================================================ records
  V.records = {
    title: 'Records',
    render(model) {
      if (!model.st.started) return head('Records', 'Superlatives, once there is a Senate to have them.') + notStarted(model);
      const r = M.records(model);
      const rec = (label, value, holder) => '<div class="record"><dt>' + label + '</dt><dd class="rec-value">' + value + '</dd><dd class="rec-holder">' + holder + '</dd></div>';
      const who = (x) => (x ? M.senLink(model, x.p.id) : '\u2013');
      const items = [];
      if (r.filibuster) items.push(rec('Longest filibuster', M.dur(r.filibuster.v), who(r.filibuster)));
      if (r.rebel) items.push(rec('Most rebellions', r.rebel.v, who(r.rebel)));
      if (r.lawmaker) items.push(rec('Most bills passed', r.lawmaker.v, who(r.lawmaker)));
      if (r.sponsor) items.push(rec('Most bills sponsored', r.sponsor.v, who(r.sponsor)));
      if (r.terms) items.push(rec('Most terms won', r.terms.v, who(r.terms)));
      if (r.scandals) items.push(rec('Most scandals', r.scandals.v, who(r.scandals)));
      if (r.absent) items.push(rec('Most votes missed', r.absent.v, who(r.absent)));
      if (r.veteran) items.push(rec('Longest-serving senator', M.date(r.veteran.since), M.senLink(model, r.veteran.id)));
      if (r.closest) items.push(rec('Closest election', M.pct(r.closest.r.margin), esc(r.closest.r.district) + ', ' + M.date(r.closest.el.ms)));
      if (r.landslide) items.push(rec('Biggest landslide', M.pct(r.landslide.r.margin), esc(r.landslide.r.district) + ', ' + M.date(r.landslide.el.ms)));
      items.push(rec('Longest shutdown', r.longestShutdown ? r.longestShutdown.data.days + ' days' : 'None yet', r.longestShutdown ? M.date(r.longestShutdown.ms) : ''));
      items.push(rec('Tied votes', r.tieCount, 'Each settled by the Presiding Officer'));
      items.push(rec('Dissolutions', r.dissolutions, ''));
      items.push(rec('Expulsions', r.expulsions, ''));
      return head('Records', 'Every superlative the Senate has produced so far.') + '<dl class="records">' + items.join('') + '</dl>';
    }
  };

  // ================================================================ about
  V.about = {
    title: 'About',
    render() {
      return head('About the Senate', 'Forty-eight pixels, sixteen districts, three parties and a Presiding Officer who always votes for the status quo.') +
        '<div class="prose"><p>The Pixel Senate is part of the Pixel Universe, alongside Glacial, the world\u2019s slowest race. Where a Glacial race takes a day, the Senate can introduce, debate, amend and pass a bill in a week, and divide on it in seconds.</p>' +
        '<p>Nothing is stored and nobody steers. Every election, speech, scandal and vote is computed in your browser from the date, so every visitor sees the same Senate at the same moment.</p>' +
        '<p>The Senate sits from 19:00 UTC most days. Outside sitting hours, the chamber replays the last sitting at ' + F.REPLAY_SPEED + '\u00d7 speed. It does not sit on the 1st of each month, when the Grand Prix has the day to itself, on election days, or while dissolved.</p>' +
        '<p>Laws passed here take effect at 00:00 UTC and may change how other Pixel Universe sites look and read, but never what happens in them.</p></div>';
    }
  };
})();
