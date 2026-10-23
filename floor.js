/*
 * The floor of the Senate: what is happening at a given moment, and the chamber animation.
 * Live during sittings (19:00 to 23:30 UTC); otherwise a replay of the last sitting at high speed.
 * Speakers and speeches are seeded by time, so every visitor sees the same senator speaking at the same moment.
 * The flickers, whispers and fidgeting are decoration only.
 */
(function () {
  const M = window.SM, S = M.S, DAY = M.DAY, H = M.H, MIN = M.MIN;
  const rng = S._internals.rng, hash = S._internals.hash;
  const REPLAY_SPEED = 90;
  const F = (window.SF = {});
  F.REPLAY_SPEED = REPLAY_SPEED;

  const FLOOR = {
    'senate.opening': 1, 'senate.lots': 1, 'leader.elected': 1, 'resolution.passed': 1,
    'bill.introduced': 1, 'bill.emergency': 1, 'budget.introduced': 1, 'bill.amended': 1, 'bill.lapsed': 1, 'bill.concession': 1,
    'bill.passed': 1, 'bill.failed': 1, 'budget.passed': 1, 'budget.defeated': 1, 'shutdown.end': 1,
    'filibuster.start': 1, 'filibuster.end': 1, 'senate.rebellion': 1,
    'senator.censured': 1, 'censure.failed': 1, 'senator.expelled': 1, 'expulsion.failed': 1
  };
  const DIVISION = { 'bill.passed': 1, 'bill.failed': 1, 'budget.passed': 1, 'budget.defeated': 1, 'senator.censured': 1, 'censure.failed': 1, 'senator.expelled': 1, 'expulsion.failed': 1 };
  F.isDivision = (e) => !!DIVISION[e.type];
  F.reveal = (base) => (base.mode === 'replay' ? 300000 : 90000);
  /** Events that would give away a division still being counted are held back until the count ends. */
  F.spoils = (e) => !!DIVISION[e.type] || e.type === 'senate.rebellion' || e.type === 'shutdown.end';

  function windowEvents(model, d) {
    const from = d + 19 * H, to = d + 33 * H;
    return model.events.filter((e) => e.ms >= from && e.ms < to && FLOOR[e.type]);
  }
  const paperCache = {};
  /** The order paper as it stood when the sitting opened: the same in live and replay. */
  function orderPaper(d) {
    if (paperCache[d]) return paperCache[d];
    const st = S.stateAt(d + 19 * H + 1 * MIN);
    const date = new Date(d), dom = date.getUTCDate();
    const bills = (st.bills || []).filter((b) => b.stage === 'floor' && b.floorDay <= d && (b.kind !== 'budget' ||
      st.shutdown || (date.getUTCMonth() === 5 && dom >= 16 && ((dom - 16) % 4 === 0 || dom === 30)))).sort((a, b) => a.no - b.no);
    const seats = st.seats || [];
    const out = { bills: st.shutdown ? bills.filter((b) => b.kind === 'budget') : bills.slice(0, 7), seats, shutdown: !!st.shutdown };
    paperCache[d] = out;
    return out;
  }

  /** Recomputed about once a second: which sitting we are showing, and its events. */
  F.base = function (model, now) {
    const st = model.st;
    if (!st.started) return { mode: 'pre' };
    if (st.dissolved) return { mode: 'dissolved' };
    const day = M.dayOf(now);
    const fil = st.filibuster;
    const live = (S.calendar.isSitting(day) && now >= day + 19 * H && now < day + 23 * H + 30 * MIN) || !!fil;
    if (live) {
      const d = fil ? M.dayOf(fil.start) : day;
      return { mode: 'live', day: d, events: windowEvents(model, d).filter((e) => e.ms <= now), paper: orderPaper(d), speed: 1 };
    }
    let d = now >= day + 23 * H + 30 * MIN ? day : day - DAY;
    let ev = [];
    for (let k = 0; k < 30; k++, d -= DAY) {
      if (d < M.FIRST_SITTING) break;
      ev = windowEvents(model, d);
      if (ev.length) break;
    }
    if (!ev.length) return { mode: 'idle' };
    const start = d + 19 * H;
    const end = Math.max(ev[ev.length - 1].ms + 8 * MIN, d + 22 * H + 30 * MIN);
    let nextSitting = day + 19 * H;
    for (let k = 0; k < 40 && (nextSitting <= now || !S.calendar.isSitting(M.dayOf(nextSitting))); k++) nextSitting = M.dayOf(nextSitting) + DAY + 19 * H;
    return { mode: 'replay', day: d, all: ev, start, end, paper: orderPaper(d), speed: REPLAY_SPEED, nextSitting };
  };
  F.simNow = function (base, now) {
    if (base.mode !== 'replay') return now;
    const len = base.end - base.start;
    return base.start + ((now * REPLAY_SPEED) % len);
  };
  F.eventsAt = (base, sim) => (base.mode === 'replay' ? base.all.filter((e) => e.ms <= sim) : base.events || []);

  // ---------------------------------------------------------------- business and speakers
  /** What the Senate is doing at simulated time `sim`. */
  F.business = function (base, sim, model) {
    const d = base.day, ev = F.eventsAt(base, sim);
    const out = { phase: 'sitting', bill: null, division: null, result: null, filibuster: null };
    // filibusters
    for (let i = ev.length - 1; i >= 0; i--) {
      if (ev[i].type === 'filibuster.end') break;
      if (ev[i].type === 'filibuster.start') { out.filibuster = ev[i]; break; }
    }
    if (!out.filibuster && base.mode === 'live' && model.st.filibuster) {
      const f = model.st.filibuster;
      out.filibuster = { ms: f.start, data: { senator: f.senator, name: f.name, bill: f.bill } };
    }
    // divisions in progress or just decided
    const reveal = F.reveal(base);
    const hold = base.mode === 'replay' ? 330000 : 270000;
    for (let i = ev.length - 1; i >= 0; i--) {
      const e = ev[i];
      if (!DIVISION[e.type]) continue;
      const age = sim - e.ms;
      if (age < reveal) { out.division = { e, p: age / reveal }; }
      else if (age < reveal + hold) out.result = e;
      break;
    }
    if (out.filibuster) { out.phase = 'filibuster'; out.bill = model.billIndex[out.filibuster.data.bill] || null; return out; }
    const paper = base.paper.bills;
    const decided = {};
    for (const e of ev) if (DIVISION[e.type] && e.data.bill) decided[e.data.bill] = true;
    const t = sim - (d + 19 * H);
    if (out.division) { out.phase = 'division'; return out; }
    if (t < 30 * MIN) { out.phase = 'opening'; return out; }
    const pending = paper.filter((b) => !decided[b.id]);
    if (!pending.length) { out.phase = sim > d + 22 * H ? 'risen' : 'business'; return out; }
    if (t >= 3 * H) { out.phase = 'divisions'; out.bill = pending[0]; return out; }
    // 19:40 to 22:00: debate, time shared between tonight's bills
    const slot = (2 * H + 20 * MIN) / paper.length;
    const idx = Math.min(paper.length - 1, Math.max(0, Math.floor((t - 40 * MIN) / slot)));
    out.phase = t < 40 * MIN ? 'introductions' : 'debate';
    out.bill = paper[idx];
    out.billStart = d + 19 * H + 40 * MIN + idx * slot;
    return out;
  };

  const FOR = [
    'This chamber cannot in conscience leave {thing} as it is.',
    'The people of {district} have waited long enough for the {short}.',
    'I commend the {short} to the Senate without reservation.',
    'Every careful observer agrees: {thing} must change, and it must change tonight.',
    'History will judge us by how we vote on the {short}.',
    'My constituents in {district} wrote to me about this. Two of them.',
    'The {short} is modest, sensible and long overdue.',
    'I have studied the committee report closely. All four pages.',
    'Let the record show that {party} stands for progress on this matter.',
    'If not now, then at the next sitting, and that is simply too late.'
  ];
  const AGAINST = [
    'The {short} is a solution in search of a problem.',
    'I urge my colleagues to consider what this would do to {district}.',
    'We have managed perfectly well with {thing} as it is.',
    'This is change for its own sake, and {party} will not support it.',
    'Has anyone asked the voters whether they want the {short}? I have. They do not.',
    'The member opposite has not read the bill. I have read it twice.',
    'With respect, the {short} goes too far, too fast, and in the wrong direction.',
    'I rise with a heavy heart to oppose this reckless measure.',
    'The committee was rushed. The bill is rushed. I will not be rushed.',
    'Future senators will ask what we were thinking.'
  ];
  const FILIBUSTER = [
    'continues reading the 2026 pixel census aloud, district by district.',
    'recites the full colour history of the race screen.',
    'reads every amendment ever proposed to the commentary standards.',
    'lists, alphabetically, every shade the background has never been.',
    'reads the minutes of the founding sitting for the third time.',
    'describes, at length, a memorable Daily Crawl from last spring.',
    'reads aloud the opening odds for every race this year.',
    'pauses for water, then resumes reading the parks register.'
  ];
  function thingOf(b) {
    if (!b) return 'the matter before us';
    const t = b.title.replace(/ Bill$/, '').replace(/^Air Quality Emergency \((.*)\)$/, '$1');
    return 'the ' + t.replace(/\s*\(.*\)$/, '').toLowerCase().replace('appropriations', 'budget');
  }
  F.SPEECH_SLOT = (base) => (base.mode === 'replay' ? 20000 * REPLAY_SPEED / 4 : 20000);

  /** The speaker for the slot containing `sim`, and what they said. */
  F.speech = function (base, sim, biz, model) {
    const slotLen = F.SPEECH_SLOT(base);
    const slotStart = sim - (sim % slotLen);
    const seats = base.paper.seats.filter((s) => s.senator);
    if (!seats.length) return null;
    if (biz.filibuster) {
      const r = rng(hash('senate:floor:filibuster:' + slotStart));
      const p = model.people[biz.filibuster.data.senator];
      return { slotStart, id: biz.filibuster.data.senator, filibuster: true, text: (p ? p.name : 'The senator') + ' ' + FILIBUSTER[Math.floor(r() * FILIBUSTER.length)] };
    }
    if (biz.phase !== 'debate' && biz.phase !== 'divisions') return null;
    const b = biz.bill;
    const r = rng(hash('senate:floor:' + slotStart));
    const n = Math.floor(slotStart / slotLen);
    let id, side;
    if (b && biz.billStart !== undefined && slotStart - biz.billStart < slotLen) { id = b.sponsor; side = 'for'; }
    else {
      side = n % 2 === 0 ? 'for' : 'against';
      const pool = seats.filter((s) => (side === 'for') === (b && s.senator.party === b.sponsorParty));
      const list = pool.length ? pool : seats;
      id = list[Math.floor(r() * list.length)].senator.id;
    }
    const p = model.people[id];
    if (!p) return null;
    const seat = seats.find((s) => s.senator.id === id);
    const lines = side === 'for' ? FOR : AGAINST;
    const short = b ? b.title.replace(/ Bill$/, ' Bill') : 'motion';
    const text = lines[Math.floor(r() * lines.length)]
      .replace('{thing}', thingOf(b)).replace('{short}', short)
      .replace('{district}', seat ? seat.district : 'my district').replace('{party}', M.PFULL[p.party] || 'my party');
    return { slotStart, id, side, text };
  };

  // ---------------------------------------------------------------- the chamber canvas
  const W = 960, HGT = 430, CX = 480, CY = 372;
  const ROWS = [9, 11, 13, 15], RADII = [132, 178, 224, 270];
  function layout() {
    const pos = [];
    ROWS.forEach((n, r) => {
      for (let i = 0; i < n; i++) {
        const a = Math.PI - (Math.PI * i) / (n - 1);
        pos.push({ x: CX + RADII[r] * Math.cos(a), y: CY - RADII[r] * Math.sin(a) * 0.98, a, ph: Math.random() * 6.28, f: 0.6 + Math.random() });
      }
    });
    return pos.sort((p, q) => q.a - p.a || q.y - p.y);
  }
  F.Chamber = function (canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = HGT * dpr;
    ctx.scale(dpr, dpr);
    const pos = layout();
    const flashes = [];
    const whispers = [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const font = () => getComputedStyle(document.documentElement).getPropertyValue('--display') || 'sans-serif';

    function seatOrder(seats, majority) {
      const order = ['B', 'V', 'L'].filter((p) => p !== majority).concat(['I', majority]);
      return seats.slice().sort((x, y) => {
        const px = x.senator ? order.indexOf(x.senator.party) : 9, py = y.senator ? order.indexOf(y.senator.party) : 9;
        return px - py || x.seat - y.seat;
      });
    }
    function voteOrder(e) {
      const r = rng(hash('senate:reveal:' + e.id));
      const idx = pos.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      const rank = [];
      idx.forEach((v, k) => (rank[v] = k));
      return rank;
    }

    this.tally = null;
    this.draw = function (f) {
      const t = performance.now();
      if (!f.division && !f.result) this.tally = null;
      ctx.clearRect(0, 0, W, HGT);
      // floor and rostrum
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let y = 0; y < HGT; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(CX - 60, CY + 28, 120, 2);
      ctx.fillStyle = '#9AA7B0';
      ctx.fillRect(CX - 5, CY + 14, 10, 10);
      const seats = seatOrder(f.seats || [], f.majority);
      const dim = f.shutdown ? 0.32 : 1;
      if (!reduce && f.active && Math.random() < 0.05) flashes.push({ i: Math.floor(Math.random() * pos.length), until: t + 140 });
      if (!reduce && f.active && Math.random() < 0.012) { const i = Math.floor(Math.random() * (pos.length - 1)); whispers.push({ i, until: t + 380 }); }
      const div = f.division, res = f.result;
      const rank = div ? voteOrder(div.e) : null;
      let ayes = 0, noes = 0;
      const flying = [];
      for (let k = 0; k < pos.length; k++) {
        const s = seats[k], p = pos[k];
        const jx = reduce ? 0 : Math.sin(t * 0.004 * p.f + p.ph) * 0.9, jy = reduce ? 0 : Math.cos(t * 0.005 * p.f + p.ph) * 0.7;
        const x = p.x + jx, y = p.y + jy;
        if (!s || !s.senator || f.dissolved) {
          ctx.strokeStyle = 'rgba(147,164,174,0.55)';
          ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
          continue;
        }
        const sen = s.senator;
        let alpha = (sen.lameDuck ? 0.55 : 1) * dim;
        let size = 10, outline = null;
        const showVotes = div || res;
        const votes = showVotes ? (div ? div.e : res).data.votes : null;
        const v = votes ? votes[sen.id] : null;
        if (v) {
          const revealed = res || rank[k] / pos.length <= div.p * 0.85;
          if (revealed) {
            const lp = res ? 1 : Math.min(1, (div.p * 0.85 - rank[k] / pos.length) / 0.12);
            if (v === 'A') { ayes += lp >= 1 ? 1 : 0; outline = '#FFFFFF'; }
            else if (v === 'N') { noes += lp >= 1 ? 1 : 0; alpha *= 0.35; }
            else alpha *= 0.2;
            if (lp < 1 && v !== '-') flying.push({ x, y, v, lp, c: M.COLORS[sen.party] });
          }
        }
        if (f.speaker === sen.id && !div) {
          size = 10 + (reduce ? 2 : 4 * Math.abs(Math.sin(t * 0.012)));
          if (!reduce) for (let r = 0; r < 3; r++) {
            const rr = ((t * (f.filibuster ? 0.025 : 0.07)) + r * 22) % 66;
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - rr / 66)).toFixed(3) + ')';
            ctx.strokeRect(x - rr / 2 - 5, y - rr / 2 - 5, rr + 10, rr + 10);
          }
        }
        for (const fl of flashes) if (fl.i === k && fl.until > t && !div) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 6, y - 6, 12, 12); }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = M.COLORS[sen.party];
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.globalAlpha = 1;
        if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.strokeRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4); ctx.lineWidth = 1; }
      }
      for (const w of whispers) if (w.until > t && !div) {
        const a = pos[w.i], b = pos[w.i + 1];
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      while (flashes.length && flashes[0].until < t) flashes.shift();
      while (whispers.length && whispers[0].until < t) whispers.shift();
      // the lobbies
      const AYE = { x: 96, y: 386 }, NO = { x: W - 96, y: 386 };
      for (const fl of flying) {
        const to = fl.v === 'A' ? AYE : NO;
        const e = fl.lp * fl.lp * (3 - 2 * fl.lp);
        ctx.fillStyle = fl.c;
        ctx.fillRect(fl.x + (to.x - fl.x) * e - 3, fl.y + (to.y - 30 - fl.y) * e - 3, 6, 6);
      }
      if (div || res) {
        const e = (div ? div.e : res);
        const finalA = e.data.ayes, finalN = e.data.noes;
        const a = res ? finalA : Math.min(ayes, finalA), n = res ? finalN : Math.min(noes, finalN);
        this.tally = { a, n, done: !!res };
        ctx.textAlign = 'center';
        ctx.fillStyle = '#E1E9EC';
        ctx.font = '800 54px ' + font();
        ctx.fillText(String(a), AYE.x, AYE.y);
        ctx.fillText(String(n), NO.x, NO.y);
        ctx.font = '500 14px ' + font();
        ctx.fillStyle = 'rgba(214,230,236,0.75)';
        ctx.fillText('Ayes', AYE.x, AYE.y + 22);
        ctx.fillText('Noes', NO.x, NO.y + 22);
        if (res) {
          const passed = M.passedDivision(res);
          ctx.font = '800 26px ' + font();
          ctx.fillStyle = passed ? '#7EE2A8' : '#F2767B';
          ctx.fillText(passed ? 'Carried' : (res.data.tie ? 'Tied: falls on the casting vote' : 'Defeated'), CX, 46);
        } else {
          ctx.font = '800 26px ' + font();
          ctx.fillStyle = (Math.floor(t / 250) % 2) ? '#FFFFFF' : 'rgba(255,255,255,0.55)';
          ctx.fillText('Division', CX, 46);
        }
      }
      if (f.dissolved || f.pre) {
        ctx.textAlign = 'center';
        ctx.font = '700 22px ' + font();
        ctx.fillStyle = 'rgba(214,230,236,0.8)';
        ctx.fillText(f.dissolved ? 'Dissolved' : 'Awaiting the founding election', CX, 60);
      } else if (f.shutdown) {
        ctx.textAlign = 'center';
        ctx.font = '700 22px ' + font();
        ctx.fillStyle = 'rgba(214,230,236,0.8)';
        ctx.fillText('Shutdown', CX, 60);
      }
    };
  };
})();
