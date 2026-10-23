/*
 * Reads the Senate simulation and derives everything the pages show.
 * Nothing here changes history: it only reads PixelUniverse.senate.
 */
(function () {
  const S = PixelUniverse.senate;
  const M = (window.SM = {});
  const DAY = 86400000, H = 3600000, MIN = 60000;
  const START = S.calendar.start;
  Object.assign(M, { S, DAY, H, MIN, START, FIRST_SITTING: S.calendar.firstSitting });

  M.COLORS = { B: S.parties.B.color, V: S.parties.V.color, L: S.parties.L.color, I: S.independent.color };
  M.PNAME = { B: 'Brightness', V: 'Verdant', L: 'Legacy Mode', I: 'Independent' };
  M.PFULL = { B: 'Brightness Party', V: 'Verdant Party', L: 'Legacy Mode', I: 'Independent' };

  // ---------------------------------------------------------------- clock
  // ?at=2027-03-14T21:30 runs the site from that moment (UTC), so the Senate can be watched before launch.
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  const parsed = at ? Date.parse(at.length <= 16 ? at + ':00Z' : at) : NaN;
  const offset = isNaN(parsed) ? 0 : parsed - Date.now();
  M.now = () => Date.now() + offset;
  M.timeTravel = !isNaN(parsed);
  M.atParam = M.timeTravel ? '?at=' + encodeURIComponent(at) : '';

  // ---------------------------------------------------------------- formatting
  const esc = (M.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  M.dayOf = (ms) => ms - (ms % DAY);
  M.date = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  M.dateShort = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  M.time = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  M.timeSec = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  M.dateTime = (ms) => M.dateShort(ms) + ', ' + M.time(ms);
  M.ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
  M.pct = (x) => (isFinite(x) ? Math.round(x * 100) + '%' : '\u2013');
  M.dur = function (ms, secs) {
    if (ms < 0) ms = 0;
    const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), m = Math.floor((ms % H) / MIN), s = Math.floor((ms % MIN) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    if (d) return d + 'd ' + h + 'h ' + pad(m) + 'm' + (secs ? ' ' + pad(s) + 's' : '');
    if (h) return h + 'h ' + pad(m) + 'm' + (secs ? ' ' + pad(s) + 's' : '');
    return m + 'm' + (secs ? ' ' + pad(s) + 's' : '');
  };
  M.chip = (p, duck) => '<span class="chip' + (duck ? ' duck' : '') + '" style="--c:' + M.COLORS[p] + '"></span>';
  M.link = (route, text) => '<a href="' + M.atParam + '#/' + route + '">' + text + '</a>';
  M.senLink = function (model, id, opts) {
    const p = model.people[id];
    if (!p) return 'an unknown senator';
    if (opts && opts.plain) return M.link('senator/' + id, esc(p.name));
    return '<span class="px">' + M.chip(p.party, opts && opts.duck) + M.link('senator/' + id, esc(p.name)) + '</span>';
  };
  M.districtColor = function (name) {
    const G = window.G;
    if (!G || !G.PIXELS) return null;
    const p = G.PIXELS.find((x) => x.name === name);
    return p ? p.color : null;
  };
  M.district = function (name) {
    const c = M.districtColor(name);
    return '<span class="px">' + (c ? '<span class="chip" style="--c:' + c + '"></span>' : '') + esc(name) + '</span>';
  };
  /** Rewrites senator names in a headline as links. */
  M.linkHeadline = function (model, e) {
    let h = esc(e.headline);
    const ids = [];
    const d = e.data || {};
    for (const k of ['senator', 'winner', 'challenger', 'leader', 'sponsor']) if (typeof d[k] === 'string') ids.push(d[k]);
    for (const id of ids) {
      const p = model.people[id];
      if (p) h = h.replace(esc(p.name), M.link('senator/' + id, esc(p.name)));
    }
    if (d.bill && d.title && model.billIndex[d.bill]) h = h.replace(esc(d.title), M.link('bill/' + d.bill, esc(d.title)));
    return h;
  };

  // ---------------------------------------------------------------- the model
  let cached = null;
  M.build = function (force) {
    const now = M.now();
    if (!force && cached && now - cached.now < 15000 && M.dayOf(now) === M.dayOf(cached.now)) return cached;
    const st = S.stateAt(now);
    const model = { now, st, people: st.people || {}, events: [], bills: [], elections: [], billIndex: {}, memo: {} };
    if (st.started) {
      model.events = S.eventsBetween(START, now);
      model.bills = S.billsBetween(START, now);
      model.elections = S.electionsBetween(START, now);
    }
    for (const b of model.bills) model.billIndex[b.id] = b;
    for (const b of st.bills || []) model.billIndex[b.id] = b;
    model.serving = (st.seats || []).filter((s) => s.senator).map((s) => s.senator.id);
    model.seatOf = {};
    for (const s of st.seats || []) if (s.senator) model.seatOf[s.senator.id] = s;
    cached = model;
    return model;
  };

  /** Divisions with a roll call, oldest first. */
  M.divisions = function (model) {
    if (model.memo.divisions) return model.memo.divisions;
    const types = { 'bill.passed': 1, 'bill.failed': 1, 'budget.passed': 1, 'budget.defeated': 1, 'senator.censured': 1, 'censure.failed': 1, 'senator.expelled': 1, 'expulsion.failed': 1 };
    const out = model.events.filter((e) => types[e.type] && e.data && e.data.votes);
    model.memo.divisions = out;
    return out;
  };
  M.divisionTitle = function (e) {
    if (e.data.title) return e.data.title;
    const n = e.data.name || 'a senator';
    return (e.type.indexOf('expel') >= 0 ? 'Motion to expel Senator ' : 'Motion to censure Senator ') + n;
  };
  M.passedDivision = (e) => e.type === 'bill.passed' || e.type === 'budget.passed' || e.type === 'senator.censured' || e.type === 'senator.expelled';

  const touches = (e, id) => {
    const d = e.data || {};
    return d.senator === id || d.winner === id || d.challenger === id || d.leader === id || d.sponsor === id ||
      (Array.isArray(d.rebels) && d.rebels.indexOf(id) >= 0);
  };

  /** Everything known about one senator. */
  M.senator = function (model, id) {
    const key = 'sen:' + id;
    if (model.memo[key]) return model.memo[key];
    const p = model.people[id];
    if (!p) return null;
    const seat = model.seatOf[id] || null;
    const divs = M.divisions(model);
    const record = [];
    let ayes = 0, noes = 0, absent = 0, rebels = 0, withMajority = 0;
    for (const e of divs) {
      const v = e.data.votes[id];
      if (!v) continue;
      const rebel = Array.isArray(e.data.rebels) && e.data.rebels.indexOf(id) >= 0;
      const passed = M.passedDivision(e);
      if (v === 'A') ayes++; else if (v === 'N') noes++; else absent++;
      if (rebel) rebels++;
      if ((v === 'A' && passed) || (v === 'N' && !passed)) withMajority++;
      record.push({ e, v, rebel, passed });
    }
    const cast = ayes + noes;
    const sponsored = model.bills.filter((b) => b.sponsor === id).concat((model.st.bills || []).filter((b) => b.sponsor === id && b.stage !== 'passed'));
    const passedBills = sponsored.filter((b) => b.stage === 'passed');
    const events = model.events.filter((e) => touches(e, id));
    const elections = [];
    for (const el of model.elections) {
      for (const r of el.results) {
        const i = r.cands.findIndex((c) => c.id === id);
        if (i < 0) continue;
        const valid = r.total - r.informal;
        const final = r.rounds[r.rounds.length - 1];
        let finalTotal = 0;
        for (let k = 0; k < final.length; k++) finalTotal += final[k];
        const opponents = r.cands.filter((c, k) => k !== i).map((c, k) => c);
        elections.push({ ms: el.ms, kind: el.kind, district: r.district, won: r.winner === i, first: r.rounds[0][i] / valid,
          final: final[i] / (finalTotal || 1), rounds: r.rounds.length, margin: r.margin, opponents, winner: r.cands[r.winner] });
      }
    }
    const scandals = events.filter((e) => /scandal|resigned|inquiry|censure|expel|expulsion/.test(e.type));
    const leaderships = events.filter((e) => e.type === 'leader.elected' && e.data.senator === id || (e.type === 'leader.challenge' && e.data.won && e.data.challenger === id));
    const defections = events.filter((e) => e.type === 'senator.defected');
    // allies and opponents: agreement with each serving senator over shared votes
    const agree = {};
    for (const r of record) {
      if (r.v === '-') continue;
      const votes = r.e.data.votes;
      for (const other in votes) {
        if (other === id || votes[other] === '-') continue;
        const a = (agree[other] = agree[other] || [0, 0]);
        a[1]++;
        if (votes[other] === r.v) a[0]++;
      }
    }
    const pairs = Object.keys(agree).filter((o) => agree[o][1] >= 10 && model.people[o] && model.people[o].status === 'serving')
      .map((o) => ({ id: o, rate: agree[o][0] / agree[o][1], n: agree[o][1] }))
      .sort((a, b) => b.rate - a.rate || (a.id < b.id ? -1 : 1));
    const roles = [];
    const st = model.st;
    if (st.started) for (const party of ['B', 'V', 'L']) {
      const l = st.leaders && st.leaders[party];
      if (l && l.id === id) roles.push(st.majority === party ? 'Majority Leader' : M.PNAME[party] + ' leader');
    }
    const inquiry = (st.inquiries || []).find((qq) => qq.senator === id) || null;
    const out = {
      p, seat, record, ayes, noes, absent, cast, rebels, attendance: record.length ? (record.length - absent) / record.length : NaN,
      loyaltyRate: cast ? 1 - rebels / cast : NaN, winningSide: cast ? withMajority / cast : NaN,
      sponsored, passedBills, events, elections, scandals, leaderships, defections,
      allies: pairs.filter((x) => model.people[x.id].party !== p.party).slice(0, 4), opponents: pairs.slice(-4).reverse(), roles, inquiry,
      partyAgreement: (() => { const mates = pairs.filter((x) => model.people[x.id].party === p.party); let a = 0, n = 0; for (const x of mates) { a += x.rate * x.n; n += x.n; } return n ? a / n : NaN; })(),
      lameDuck: seat ? seat.senator.lameDuck : false
    };
    model.memo[key] = out;
    return out;
  };

  /** Hall of records. */
  M.records = function (model) {
    if (model.memo.records) return model.memo.records;
    const people = Object.values(model.people).filter((p) => p.since);
    const best = (f, min) => {
      let top = null, v = min === undefined ? -Infinity : min;
      for (const p of people) { const x = f(p); if (x > v) { v = x; top = p; } }
      return top ? { p: top, v } : null;
    };
    const ev = model.events;
    const longestShutdown = ev.filter((e) => e.type === 'shutdown.end').reduce((a, e) => (!a || e.data.days > a.data.days ? e : a), null);
    let closest = null, landslide = null;
    for (const el of model.elections) for (const r of el.results) {
      const rec = { el, r };
      if (!closest || r.margin < closest.r.margin) closest = rec;
      if (!landslide || r.margin > landslide.r.margin) landslide = rec;
    }
    const tieCount = ev.filter((e) => (e.type === 'bill.failed' || e.type === 'budget.defeated') && e.data.tie).length;
    const servingSince = people.filter((p) => p.status === 'serving');
    const out = {
      filibuster: best((p) => p.stats.longestFilibusterMs, 0),
      rebel: best((p) => p.stats.rebellions, 0),
      lawmaker: best((p) => p.stats.passed, 0),
      sponsor: best((p) => p.stats.sponsored, 0),
      scandals: best((p) => p.stats.scandals, 0),
      terms: best((p) => p.termsWon, 0),
      absent: best((p) => p.stats.missed, 0),
      veteran: servingSince.length ? servingSince.reduce((a, p) => (!a || p.since < a.since ? p : a), null) : null,
      longestShutdown, closest, landslide, tieCount,
      dissolutions: ev.filter((e) => e.type === 'senate.dissolved').length,
      expulsions: ev.filter((e) => e.type === 'senator.expelled').length
    };
    model.memo.records = out;
    return out;
  };

  M.STATUS = { serving: 'Serving', defeated: 'Defeated at the polls', retired: 'Retired', resigned: 'Resigned', expelled: 'Expelled', 'term-limited': 'Term-limited', candidate: 'Candidate' };
})();
