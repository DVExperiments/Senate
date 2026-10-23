/*
 * The Pixel Senate: simulation.
 *
 * Pure functions of time. No DOM code, so any site can load this file safely.
 * Follows the Pixel Universe Shared Conventions:
 *   - all simulation in UTC, time is always passed in
 *   - seeded randomness only (Glacial's mulberry32 + FNV-1a), one stream per purpose per day
 *   - simulation maths uses only + - * / Math.floor Math.imul
 *
 * Registers window.PixelUniverse.senate.
 */
(function (root) {
  'use strict';

  const VERSION = '0.1.0'; // becomes 1.0.0 at the founding election; after that, history is fixed
  const DAY = 86400000, H = 3600000, MIN = 60000;
  const START = Date.UTC(2026, 10, 28); // founding election, Saturday 28 November 2026
  const FIRST_SITTING = Date.UTC(2026, 11, 3); // Glacial's first anniversary
  const CLOTURE = 30; // votes needed to end a filibuster
  const CHECKPOINT_EVERY = 32; // days

  // ---------------------------------------------------------------- shared RNG
  // Identical to G.rng and G.hash in Glacial's js/sim.js. Do not change.
  function rng(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const pad = (n) => (n < 10 ? '0' : '') + n;
  function ymd(ms) {
    const d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  const seeded = (purpose, day) => rng(hash('senate:' + purpose + ':' + ymd(day)));

  // ---------------------------------------------------------------- small maths
  const abs = (x) => (x < 0 ? -x : x);
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const rd = (x) => Math.floor(x * 1000 + 0.5) / 1000;
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const dayOf = (ms) => ms - (ms % DAY);
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  function weighted(r, items, weights) {
    let tot = 0;
    for (let i = 0; i < weights.length; i++) tot += weights[i];
    let x = r() * tot;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x < 0) return items[i];
    }
    return items[items.length - 1];
  }

  // ---------------------------------------------------------------- the world
  const PARTIES = {
    B: { id: 'B', name: 'Brightness Party', short: 'Brightness', color: '#E8A33D', env: -0.6, aes: 0.4, base: 0.36 },
    V: { id: 'V', name: 'Verdant Party', short: 'Verdant', color: '#3FA66A', env: 0.7, aes: 0.35, base: 0.32 },
    L: { id: 'L', name: 'Legacy Mode', short: 'Legacy Mode', color: '#8C9AA6', env: 0.1, aes: -0.8, base: 0.32 }
  };
  const INDEPENDENT = { id: 'I', name: 'Independent', short: 'Independent', color: '#B79AE0' };
  const PARTY_IDS = ['B', 'V', 'L'];
  const partyName = (p) => (p === 'I' ? 'Independent' : PARTIES[p].short);
  const PRESIDING_OFFICER = {
    name: 'Neutral Grey',
    title: 'Presiding Officer',
    rule: 'Casts the deciding vote in a tie, always in favour of the status quo.'
  };

  // Districts are named after the sixteen Glacial pixels. Rename freely before launch.
  const DISTRICT_NAMES = ['Hot Pixel', 'Burn-In', 'Gamma', 'Dither', 'Chroma', 'Vsync', 'Moiré', 'Nibble',
    'Sub-Pixel', 'Anti-Alias', 'Jaggy', 'Off-By-One', 'Bezel', 'Lossless', 'Dead Pixel', 'Null Pointer'];

  const FIRST = ['Hex', 'Kern', 'Pica', 'Lumen', 'Raster', 'Vector', 'Serif', 'Glyph', 'Tint', 'Shade', 'Hue', 'Cyan',
    'Ochre', 'Umber', 'Sepia', 'Indigo', 'Teal', 'Mauve', 'Slate', 'Ember', 'Flicker', 'Glint', 'Gleam', 'Halo',
    'Prism', 'Quill', 'Ruby', 'Sable', 'Tile', 'Vellum', 'Wren', 'Zinc', 'Ash', 'Bit', 'Byte', 'Nyx', 'Opal', 'Pixie',
    'Rune', 'Sprite', 'Dot', 'Ink', 'Lux', 'Matte', 'Nib', 'Pane', 'Strobe', 'Taper', 'Volt', 'Watt'];
  const LAST = ['Halftone', 'Gridley', 'Scanline', 'Bitwell', 'Refresh', 'Kerning', 'Overscan', 'Brightwater', 'Dimmock',
    'Contrastly', 'Gamut', 'Pallett', 'Lumley', 'Hueston', 'Interlace', 'Framewell', 'Pixelby', 'Burnside', 'Glowman',
    'Tintagel', 'Shadwell', 'Vectorman', 'Aliasby', 'Ditherington', 'Monochrome', 'Underscan', 'Backlight', 'Dotson',
    'Inkwell', 'Matteson', 'Quillon', 'Vellacott', 'Whitepoint', 'Blackpoint', 'Greystoke', 'Coldframe', 'Lightfoot',
    'Rasterby', 'Fadewell', 'Glimmerton'];

  // ---------------------------------------------------------------- laws
  // Colour laws are shifts relative to Glacial's palette, applied to light and dark modes alike.
  const COLOUR_KEYS = {
    'style.bg': { label: 'Background', vars: ['--bg'] },
    'style.surface': { label: 'Panel', vars: ['--surface'] },
    'style.link': { label: 'Link Colour', vars: ['--link', '--focus'] },
    'style.screen': { label: 'Race Screen', vars: ['--screen', '--bezel'] }
  };
  const SHIFT_LIMITS = { h: 30, s: 25, l: 6 }; // guardrails: degrees, saturation %, lightness %
  const CHOICES = {
    'style.display': { label: 'Display Typeface', def: 'Bricolage Grotesque',
      options: ['Bricolage Grotesque', 'Space Grotesk', 'Fraunces', 'DM Serif Display', 'Syne', 'Archivo Narrow'] },
    'style.body': { label: 'Body Typeface', def: 'IBM Plex Sans',
      options: ['IBM Plex Sans', 'Source Serif 4', 'Work Sans', 'Atkinson Hyperlegible', 'IBM Plex Mono', 'Literata'] },
    'names.crawl': { label: 'Daily Race Name', def: 'Daily Crawl',
      options: ['Daily Crawl', 'Daily Creep', 'Daily Drift', 'The Long Afternoon', 'Daily Shuffle', 'The Slow Mile'] },
    'names.gp': { label: 'Grand Prix Name', def: 'Grand Prix',
      options: ['Grand Prix', 'Grand Crawl', 'Monthly Classic', 'Grand Procession', 'Long Haul'] },
    'names.trophy': { label: 'Grand Prix Trophy', def: 'Grand Prix Trophy',
      options: ['Grand Prix Trophy', 'The Slow Cup', 'The Golden Bezel', 'The Refresh Rate Shield', 'The Long Pixel Plate',
        'The Patience Cup', 'The Glacial Bowl'] },
    'commentary.tone': { label: 'Commentary Standards', def: 'measured',
      options: ['measured', 'breathless', 'solemn', 'poetic', 'clipped', 'bureaucratic'] }
  };
  // Environmental policy, read by the city once it exists. green: +1 if raising it is the green direction.
  const POLICY = {
    'policy.coalPlants': { def: 3, min: 0, max: 6, green: -1, aUp: 0.3, aDown: 0.2, up: 'Coal Plant Commissioning', down: 'Coal Plant Retirement' },
    'policy.solarSubsidy': { def: 1, min: 0, max: 5, green: 1, aUp: 0.3, aDown: 0, up: 'Solar Subsidy (Increase)', down: 'Solar Subsidy (Reduction)' },
    'policy.windFarms': { def: 0, min: 0, max: 5, green: 1, aUp: 0.5, aDown: 0.1, up: 'Wind Farm Construction', down: 'Wind Farm Decommissioning' },
    'policy.parks': { def: 2, min: 0, max: 20, green: 1, aUp: -0.2, aDown: 0.4, up: 'Parks (New Green Space)', down: 'Parks (Land Release)' },
    'policy.wildlifeZones': { def: 0, min: 0, max: 10, green: 1, aUp: -0.3, aDown: 0.3, up: 'Wildlife Protection Zones', down: 'Wildlife Zones (Rezoning)' },
    'policy.emissionsCap': { def: 0, min: 0, max: 5, green: 1, aUp: 0.1, aDown: 0, up: 'Emissions Cap (Tightening)', down: 'Emissions Cap (Relaxation)' },
    'policy.trafficLimits': { def: 0, min: 0, max: 3, green: 1, aUp: 0.2, aDown: -0.1, up: 'Traffic Restrictions', down: 'Traffic Restrictions (Repeal)' },
    'policy.constructionBudget': { def: 3, min: 1, max: 5, green: -1, aUp: 0.6, aDown: -0.3, up: 'Construction Budget (Increase)', down: 'Construction Budget (Reduction)' }
  };
  const POLICY_KEYS = Object.keys(POLICY);

  function resolveLaws(laws) {
    const out = {};
    for (const k in COLOUR_KEYS) out[k] = laws[k] ? { h: laws[k].h, s: laws[k].s, l: laws[k].l } : { h: 0, s: 0, l: 0 };
    for (const k in CHOICES) out[k] = laws[k] !== undefined ? laws[k] : CHOICES[k].def;
    for (const k in POLICY) out[k] = laws[k] !== undefined ? laws[k] : POLICY[k].def;
    return out;
  }
  function describeChange(c) {
    if (COLOUR_KEYS[c.key]) {
      if (c.op === 'reset') return COLOUR_KEYS[c.key].label + ' restored to its original colour';
      const n = abs(c.delta);
      if (c.field === 'h') return COLOUR_KEYS[c.key].label + ' hue turned ' + n + '° ' + (c.delta > 0 ? 'clockwise' : 'anticlockwise');
      if (c.field === 's') return COLOUR_KEYS[c.key].label + ' saturation ' + (c.delta > 0 ? 'raised' : 'lowered') + ' by ' + n + '%';
      return COLOUR_KEYS[c.key].label + ' ' + (c.delta > 0 ? 'lightened' : 'darkened') + ' by ' + n + '%';
    }
    if (CHOICES[c.key]) {
      if (c.op === 'reset') return CHOICES[c.key].label + ' restored to ' + CHOICES[c.key].def;
      return CHOICES[c.key].label + ' set to ' + c.value;
    }
    if (POLICY[c.key]) return (c.delta > 0 ? POLICY[c.key].up : POLICY[c.key].down);
    return c.key;
  }

  // ---------------------------------------------------------------- calendar
  function lastSaturday(year, month) {
    const last = Date.UTC(year, month + 1, 0);
    return last - ((new Date(last).getUTCDay() + 1) % 7) * DAY;
  }
  function isGeneralElection(day) {
    if (day < START) return false;
    const d = new Date(day), m = d.getUTCMonth();
    return (m === 4 || m === 10) && lastSaturday(d.getUTCFullYear(), m) === day;
  }
  /** The next n general elections strictly after `after`. */
  function electionsAfter(after, n) {
    const out = [];
    let y = new Date(after).getUTCFullYear();
    while (out.length < n) {
      for (const m of [4, 10]) {
        const e = lastSaturday(y, m);
        if (e > after && out.length < n) out.push(e);
      }
      y++;
    }
    return out;
  }
  function saturdayOnOrAfter(ms) {
    const d = dayOf(ms);
    return d + ((6 - new Date(d).getUTCDay() + 7) % 7) * DAY;
  }
  function isSitting(day) {
    return day >= FIRST_SITTING && new Date(day).getUTCDate() !== 1 && !isGeneralElection(day);
  }

  // ---------------------------------------------------------------- state
  function makeDistricts() {
    return DISTRICT_NAMES.map((name, i) => {
      const r = rng(hash('senate:district:' + i));
      return { id: i, name, size: 9000 + Math.floor(r() * 6000), env: rd((r() - 0.5) * 1.2), aes: rd((r() - 0.5) * 1.2), ind: rd(r() * 0.14) };
    });
  }
  function fresh() {
    const seats = [];
    for (let d = 0; d < DISTRICT_NAMES.length; d++) for (let k = 0; k < 3; k++) seats.push({ district: d, slot: k, cls: null, senator: null, termEnds: null });
    return {
      seq: { person: 0, bill: 0 }, names: {}, districts: makeDistricts(), seats, people: {},
      support: { B: 0.36, V: 0.32, L: 0.32 }, mood: { B: 0, V: 0, L: 0 }, fatigue: 0, leaderSupport: { B: 0, V: 0, L: 0 }, seatLoss: { B: 0, V: 0, L: 0 },
      leaders: { B: null, V: null, L: null }, majority: null,
      laws: {}, pending: [], bills: {}, filibuster: null, byelections: [], deals: {},
      concern: 0.4, lastEmergency: 0, lastPoll: null, opened: false, founded: false
    };
  }
  function makePerson(r, st, party, district) {
    let name;
    do { name = pick(r, FIRST) + ' ' + pick(r, LAST); } while (st.names[name]);
    st.names[name] = 1;
    const P = PARTIES[party];
    const env = clamp((P ? P.env : r() * 2 - 1) + (r() - 0.5) * 0.7, -1, 1);
    const aes = clamp((P ? P.aes : r() * 2 - 1) + (r() - 0.5) * 0.7, -1, 1);
    const pet = { key: pick(r, POLICY_KEYS), dir: r() < 0.5 ? 1 : -1 };
    return {
      id: 'S' + (++st.seq.person), name, party, env: rd(env), aes: rd(aes),
      loyalty: rd(0.35 + r() * 0.65), ambition: rd(r()), quality: rd(0.85 + r() * 0.3), scandalRisk: rd(r()),
      pet: party === 'I' ? pet : null, district, seat: null, since: null, termsWon: 0, status: 'candidate', retiring: false,
      stats: { sponsored: 0, passed: 0, rebellions: 0, missed: 0, filibusters: 0, longestFilibusterMs: 0, scandals: 0 }
    };
  }
  function counts(st) {
    const c = { B: 0, V: 0, L: 0, I: 0, vacant: 0 };
    for (const s of st.seats) c[s.senator ? st.people[s.senator].party : 'vacant']++;
    return c;
  }
  function compositionText(c) {
    let t = 'Brightness ' + c.B + ', Verdant ' + c.V + ', Legacy Mode ' + c.L;
    if (c.I) t += ', independents ' + c.I;
    if (c.vacant) t += ', vacant ' + c.vacant;
    return t;
  }
  function normaliseSupport(st) {
    let sum = 0;
    for (const p of PARTY_IDS) { st.support[p] = clamp(st.support[p], 0.08, 0.7); sum += st.support[p]; }
    for (const p of PARTY_IDS) st.support[p] = rd(st.support[p] / sum);
  }
  const serving = (st) => st.seats.filter((s) => s.senator).map((s) => st.people[s.senator]);

  // ---------------------------------------------------------------- engine helpers
  function at(ctx, t, fn) {
    if (ctx.stopped) return false;
    if (t > ctx.limit) { ctx.stopped = true; return false; }
    fn(t);
    return true;
  }
  function emit(ctx, t, type, importance, idPart, data, headline) {
    ctx.ev.push({ id: 'senate:' + idPart, time: iso(t), ms: t, source: 'senate', type, importance, data, headline });
  }

  // ---------------------------------------------------------------- leadership and majority
  function chooseLeader(ctx, t, p, reason) {
    const st = ctx.st;
    const caucus = serving(st).filter((s) => s.party === p);
    let best = null, bestScore = -1;
    for (const s of caucus) {
      const score = s.quality + s.ambition * 0.5 + s.termsWon * 0.1;
      if (score > bestScore) { best = s; bestScore = score; }
    }
    st.leaders[p] = best ? best.id : null;
    st.leaderSupport[p] = st.support[p];
    if (!best) return;
    const role = st.majority === p ? 'Majority Leader' : 'leader';
    emit(ctx, t, 'leader.elected', 3, 'leader:' + p + ':' + best.id + ':' + ymd(t),
      { party: p, senator: best.id, name: best.name, reason },
      'Senator ' + best.name + ' becomes ' + PARTIES[p].short + ' ' + role);
  }
  function updateMajority(ctx, t) {
    const st = ctx.st, c = counts(st);
    let best = null;
    for (const p of PARTY_IDS) if (best === null || c[p] > c[best] || (c[p] === c[best] && st.support[p] > st.support[best])) best = p;
    if (best === st.majority) return;
    const prev = st.majority;
    st.majority = best;
    st.fatigue = 0;
    if (!st.opened) return;
    const leader = st.leaders[best] ? st.people[st.leaders[best]].name : null;
    emit(ctx, t, 'majority.change', 4, 'majority:' + ymd(t) + ':' + best, { party: best, previous: prev, leader },
      PARTIES[best].short + ' becomes the largest party in the Senate' + (leader ? '; Senator ' + leader + ' is Majority Leader' : ''));
  }
  function departed(ctx, t, person, status) {
    const st = ctx.st;
    person.status = status;
    person.seat = null;
    person.retiring = false;
    if (person.party !== 'I' && st.leaders[person.party] === person.id) {
      st.leaders[person.party] = null;
      if (st.opened) chooseLeader(ctx, t, person.party, 'vacancy');
    }
  }
  function vacancy(ctx, t, seatIdx, reason) {
    const st = ctx.st, seat = st.seats[seatIdx];
    const person = st.people[seat.senator];
    seat.senator = null;
    departed(ctx, t, person, reason);
    const dist = st.districts[seat.district].name;
    if (seat.termEnds && seat.termEnds - dayOf(t) < 70 * DAY) {
      emit(ctx, t, 'seat.vacant', 2, 'vacant:' + seatIdx + ':' + ymd(t), { seat: seatIdx, district: dist },
        'The ' + dist + ' seat will remain vacant until the general election');
    } else {
      let by = saturdayOnOrAfter(t + 28 * DAY);
      if (isGeneralElection(by)) by += 7 * DAY;
      st.byelections.push({ day: by, seat: seatIdx });
      emit(ctx, t, 'byelection.called', 3, 'byelection-called:' + seatIdx + ':' + ymd(t),
        { seat: seatIdx, district: dist, date: ymd(by) }, 'By-election called in ' + dist + ' for ' + ymd(by));
    }
    updateMajority(ctx, t);
  }

  // ---------------------------------------------------------------- elections
  function distance(a, b) { return abs(a.env - b.env) + abs(a.aes - b.aes); }

  /** One seat, preferential voting (instant runoff). */
  function contest(ctx, r, seatIdx, day) {
    const st = ctx.st, seat = st.seats[seatIdx], dist = st.districts[seat.district];
    const inc = seat.senator ? st.people[seat.senator] : null;
    const incRuns = inc && !inc.retiring;
    const cands = [];
    for (const p of PARTY_IDS) cands.push(incRuns && inc.party === p ? inc : makePerson(r, st, p, seat.district));
    const indRoll = r();
    if (incRuns && inc.party === 'I') cands.push(inc);
    else if (indRoll < 0.1 + dist.ind * 2) cands.push(makePerson(r, st, 'I', seat.district));

    const total = Math.floor(dist.size * (0.55 + r() * 0.2));
    const w = cands.map((c) => {
      const aff = 1 / (0.6 + distance(dist, c));
      const sup = c.party === 'I' ? dist.ind + (c === inc ? 0.17 : 0.09) : st.support[c.party];
      return sup * aff * c.quality * (c === inc ? 1.12 : 1) * (0.85 + r() * 0.3);
    });
    let W = 0;
    for (const x of w) W += x;
    const votes = w.map((x) => Math.floor((total * x) / W));
    let counted = 0;
    for (const v of votes) counted += v;
    const informal = total - counted;
    const alive = cands.map(() => true);
    const rounds = [votes.slice()];
    let exhausted = 0, winner = -1;
    for (;;) {
      let cont = 0, n = 0, top = -1, low = -1;
      for (let i = 0; i < cands.length; i++) {
        if (!alive[i]) continue;
        cont += votes[i]; n++;
        if (top < 0 || votes[i] > votes[top]) top = i;
        if (low < 0 || votes[i] < votes[low]) low = i;
      }
      if (votes[top] * 2 > cont || n === 1) { winner = top; break; }
      if (n === 2 && votes[top] === votes[low]) { winner = r() < 0.5 ? top : low; break; }
      alive[low] = false;
      const v = votes[low];
      votes[low] = 0;
      const transferable = Math.floor(v * 0.88);
      const pw = [];
      let PW = 0;
      for (let i = 0; i < cands.length; i++) {
        let x = 0;
        if (alive[i]) {
          x = 1 / (0.3 + distance(cands[low], cands[i]));
          if (st.deals[cands[low].party] === cands[i].party) x *= 1.6;
        }
        pw.push(x); PW += x;
      }
      let given = 0;
      for (let i = 0; i < cands.length; i++) {
        if (!alive[i]) continue;
        const g = Math.floor((transferable * pw[i]) / PW);
        votes[i] += g; given += g;
      }
      exhausted += v - given;
      rounds.push(votes.slice());
    }
    const final = rounds[rounds.length - 1];
    let cont = 0, second = 0;
    for (let i = 0; i < cands.length; i++) {
      if (!alive[i]) continue;
      cont += final[i];
      if (i !== winner && final[i] > second) second = final[i];
    }
    let firstLeader = 0;
    for (let i = 1; i < cands.length; i++) if (rounds[0][i] > rounds[0][firstLeader]) firstLeader = i;
    return {
      seat: seatIdx, district: dist.name, total, informal, exhausted,
      cands: cands.map((c) => ({ id: c.id, name: c.name, party: c.party, incumbent: c === inc })),
      rounds, winner, winnerPerson: cands[winner], prevParty: inc ? inc.party : null, prevName: inc ? inc.name : null,
      onPreferences: rounds.length > 1, comeback: firstLeader !== winner,
      margin: cont ? rd((final[winner] - second) / cont) : 1
    };
  }
  function seatWinner(ctx, t, res, termEnds) {
    const st = ctx.st, seat = st.seats[res.seat], win = res.winnerPerson;
    const old = seat.senator ? st.people[seat.senator] : null;
    if (old && old.id !== win.id) departed(ctx, t, old, old.retiring ? 'retired' : 'defeated');
    if (old && old.id === win.id) win.retiring = false;
    if (!st.people[win.id]) st.people[win.id] = win;
    win.status = 'serving';
    win.seat = res.seat;
    win.district = seat.district;
    if (!win.since) win.since = t;
    win.termsWon++;
    seat.senator = win.id;
    seat.termEnds = termEnds;
  }
  function resultHeadline(res, founding, by) {
    const w = res.winnerPerson, party = partyName(w.party);
    const prefs = res.comeback ? ' after trailing on first preferences' : res.onPreferences ? ' on preferences' : '';
    if (founding) return 'Senator-elect ' + w.name + ' (' + party + ') wins ' + res.district + prefs;
    if (res.prevParty && res.prevParty !== w.party) return party + ' gains ' + res.district + ' from ' + partyName(res.prevParty) + prefs;
    if (!res.prevParty) return party + ' wins the vacant ' + res.district + ' seat' + prefs;
    const close = res.margin < 0.03 ? ' by a margin of ' + rd(res.margin * 100) + '%' : '';
    return party + ' holds ' + res.district + close + prefs + (by ? ' in a by-election' : '');
  }
  function generalElection(ctx, t) {
    const st = ctx.st, day = dayOf(t), r = seeded('election', day), founding = !st.founded;
    const idxs = [];
    st.seats.forEach((s, i) => { if (founding || s.termEnds === day) idxs.push(i); });
    if (!idxs.length) return;
    const before = counts(st);
    const results = idxs.map((i) => contest(ctx, r, i, day));
    const termEnds = founding ? null : electionsAfter(day, 3)[2];
    let flips = 0;
    for (const res of results) {
      const flip = !founding && res.prevParty && res.prevParty !== res.winnerPerson.party;
      if (flip) flips++;
      seatWinner(ctx, t, res, termEnds);
      const imp = founding ? 2 : flip ? 4 : res.margin < 0.03 ? 3 : 2;
      emit(ctx, t, 'election.result', imp, 'election-' + ymd(day) + ':seat-' + res.seat,
        { seat: res.seat, district: res.district, winner: res.winnerPerson.id, name: res.winnerPerson.name, party: res.winnerPerson.party,
          previous: res.prevParty, margin: res.margin, onPreferences: res.onPreferences, rounds: res.rounds.length },
        resultHeadline(res, founding, false));
    }
    st.founded = true;
    st.byelections = st.byelections.filter((b) => idxs.indexOf(b.seat) < 0);
    st.deals = {};
    const after = counts(st);
    for (const p of PARTY_IDS) {
      st.support[p] += (after[p] - before[p]) * 0.002;
      st.seatLoss[p] = before[p] > after[p] ? before[p] - after[p] : 0;
    }
    normaliseSupport(st);
    let top = 'B';
    for (const p of PARTY_IDS) if (after[p] > after[top]) top = p;
    const hung = after[top] < 25;
    const head = founding
      ? 'Founding election returns the first Pixel Senate: ' + compositionText(after)
      : (hung ? 'No party holds a majority after the election: ' : PARTIES[top].short + ' holds a majority after the election: ') + compositionText(after);
    emit(ctx, t, 'election.summary', 5, 'election-' + ymd(day) + ':summary',
      { composition: after, before, flips, hung, founding, contested: idxs.length }, head);
    ctx.arch.elections.push({ ms: t, kind: founding ? 'founding' : 'general', composition: after, results: results.map(slimResult) });
    updateMajority(ctx, t);
    if (st.opened) for (const p of PARTY_IDS) if (!st.leaders[p]) chooseLeader(ctx, t, p, 'election');
  }
  function slimResult(res) {
    const o = Object.assign({}, res);
    delete o.winnerPerson;
    return o;
  }
  function byElection(ctx, t, seatIdx) {
    const st = ctx.st, day = dayOf(t), r = seeded('byelection:' + seatIdx, day);
    const seat = st.seats[seatIdx];
    const res = contest(ctx, r, seatIdx, day);
    const before = counts(st);
    seatWinner(ctx, t, res, seat.termEnds);
    const after = counts(st);
    const flip = res.prevParty === null ? false : res.prevParty !== res.winnerPerson.party;
    emit(ctx, t, 'byelection.result', 4, 'byelection:' + seatIdx + ':' + ymd(day),
      { seat: seatIdx, district: res.district, winner: res.winnerPerson.id, name: res.winnerPerson.name, party: res.winnerPerson.party,
        margin: res.margin, composition: after, before },
      'By-election: Senator ' + res.winnerPerson.name + ' (' + partyName(res.winnerPerson.party) + ') wins ' + res.district + (res.onPreferences ? ' on preferences' : ''));
    ctx.arch.elections.push({ ms: t, kind: 'by-election', composition: after, results: [slimResult(res)] });
    st.byelections = st.byelections.filter((b) => b.seat !== seatIdx);
    updateMajority(ctx, t);
    if (st.opened) for (const p of PARTY_IDS) if (!st.leaders[p]) chooseLeader(ctx, t, p, 'by-election');
    return flip;
  }

  // ---------------------------------------------------------------- bills
  function partyU(b, p) {
    const P = PARTIES[p];
    return b.env * P.env + b.aes * P.aes + b.taste[p] + (b.sponsorParty === p ? 0.25 : 0);
  }
  function personU(b, s) {
    let u = b.env * s.env + b.aes * s.aes;
    if (s.party !== 'I') u += b.taste[s.party] * 0.7;
    if (b.sponsor === s.id) u += 0.4;
    if (s.pet && b.change.key === s.pet.key && b.change.delta) u += (b.change.delta > 0) === (s.pet.dir > 0) ? 0.5 : -0.5;
    return u;
  }
  function partyPosition(b, p) {
    if (b.forced[p]) return b.forced[p];
    if (b.conscience) return 'free';
    const u = partyU(b, p);
    return u > 0.08 ? 'aye' : u < -0.08 ? 'no' : 'free';
  }
  function expectedVote(b, s) {
    if (s.party === 'I') return b.forcedInd[s.id] ? 'A' : personU(b, s) > 0 ? 'A' : 'N';
    const pos = partyPosition(b, s.party);
    if (pos === 'free') return personU(b, s) > 0 ? 'A' : 'N';
    return pos === 'aye' ? 'A' : 'N';
  }
  function expectTally(st, b) {
    let ayes = 0, noes = 0;
    const blocs = { B: 0, V: 0, L: 0 };
    for (const s of serving(st)) {
      const v = expectedVote(b, s);
      if (v === 'A') ayes++; else noes++;
      if (s.party !== 'I' && v === 'N') blocs[s.party]++;
    }
    return { ayes, noes, blocs };
  }

  function modifiedKeys(st) {
    return Object.keys(st.laws).filter((k) => !POLICY[k]);
  }
  function billTitle(change, kind) {
    const c = change;
    let t;
    if (COLOUR_KEYS[c.key]) {
      const L = COLOUR_KEYS[c.key].label, n = abs(c.delta || 0);
      if (c.op === 'reset') t = L + ' (Restoration of Original) Bill';
      else if (c.field === 'h') t = L + ' Hue (' + (c.delta > 0 ? 'Clockwise ' : 'Anticlockwise ') + n + '°) Bill';
      else if (c.field === 's') t = L + ' Saturation (' + (c.delta > 0 ? 'Increase' : 'Reduction') + ') Bill';
      else t = L + ' Brightness (' + (c.delta > 0 ? 'Lightening' : 'Darkening') + ') Bill';
    } else if (CHOICES[c.key]) {
      const L = CHOICES[c.key].label;
      t = c.op === 'reset' ? L + ' (Restoration of Original) Bill' : L + ' (' + titleCase(c.value) + ') Bill';
    } else {
      t = (c.delta > 0 ? POLICY[c.key].up : POLICY[c.key].down) + ' Bill';
    }
    return kind === 'emergency' ? 'Air Quality Emergency (' + t.replace(/ Bill$/, '') + ') Bill' : t;
  }
  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Generates a bill. Always consumes the same number of draws for a given kind. */
  function genBill(ctx, t, r, forcedKind, members) {
    const st = ctx.st;
    const mods = modifiedKeys(st);
    const C = st.concern;
    const kind = forcedKind || weighted(r, ['cosmetic', 'environmental', 'restoration'],
      [0.22, 0.4 + C * 0.2, mods.length ? 0.08 + mods.length * 0.02 : 0]);
    const tasteBase = { B: (r() - 0.5) * 0.2, V: (r() - 0.5) * 0.2, L: (r() - 0.5) * 0.2 };
    const extra = { B: r() - 0.5, V: r() - 0.5, L: r() - 0.5 };
    const conscienceRoll = r();
    let change, env = 0, aes = 0, sub = kind, conscience = false;
    const taste = { B: tasteBase.B, V: tasteBase.V, L: tasteBase.L };
    if (kind === 'cosmetic') {
      sub = weighted(r, ['colour', 'font', 'name', 'tone'], [0.6, 0.13, 0.15, 0.12]);
      const r1 = r(), r2 = r(), r3 = r(), r4 = r();
      if (sub === 'colour') {
        const key = weighted(() => r1, ['style.bg', 'style.surface', 'style.link', 'style.screen'], [3, 2, 2, 2]);
        const field = r2 < 0.5 ? 'h' : r2 < 0.8 ? 's' : 'l';
        const mag = field === 'h' ? 4 + Math.floor(r3 * 9) : field === 's' ? 3 + Math.floor(r3 * 8) : 1 + Math.floor(r3 * 3);
        let sign = r4 < 0.5 ? 1 : -1;
        const cur = st.laws[key] ? st.laws[key][field] : 0;
        if (cur + sign * mag > SHIFT_LIMITS[field] || cur + sign * mag < -SHIFT_LIMITS[field]) sign = -sign;
        change = { key, op: 'shift', field, delta: sign * mag };
        aes = 0.7;
        if (field === 'h') { taste.B += extra.B * 0.6; taste.V += extra.V * 0.6; taste.L += extra.L * 0.6; }
        if (field === 's') { if (sign > 0) { taste.B += 0.3; taste.V -= 0.5; } else { taste.B -= 0.4; taste.V += 0.4; } }
      } else {
        const key = sub === 'font' ? (r1 < 0.5 ? 'style.display' : 'style.body') : sub === 'name' ? pick(() => r1, ['names.crawl', 'names.gp', 'names.trophy']) : 'commentary.tone';
        const cur = st.laws[key] !== undefined ? st.laws[key] : CHOICES[key].def;
        const opts = CHOICES[key].options.filter((o) => o !== cur);
        change = { key, op: 'set', value: opts[Math.floor(r2 * opts.length)] };
        aes = sub === 'font' ? 0.8 : sub === 'name' ? 0.7 : 0.6;
        taste.B += extra.B * 0.8; taste.V += extra.V * 0.8; taste.L += extra.L * 0.8;
        conscience = conscienceRoll < 0.35;
      }
    } else if (kind === 'restoration') {
      const key = mods.length ? mods[Math.floor(r() * mods.length)] : null;
      if (!key) return null;
      change = { key, op: 'reset' };
      aes = -1;
    } else {
      const key = kind === 'emergency' ? pick(r, ['policy.emissionsCap', 'policy.trafficLimits', 'policy.coalPlants']) : pick(r, POLICY_KEYS);
      const P = POLICY[key];
      const greenRoll = r();
      const cur = st.laws[key] !== undefined ? st.laws[key] : P.def;
      const greenness = P.green > 0 ? (cur - P.min) / (P.max - P.min) : (P.max - cur) / (P.max - P.min);
      let green = kind === 'emergency' ? 1 : greenRoll < clamp(0.6 + (C - 0.4) * 0.8 - greenness * 0.5, 0.1, 0.9) ? 1 : -1;
      let step = green * P.green;
      if (cur + step > P.max || cur + step < P.min) {
        if (kind === 'emergency') return null;
        step = -step; green = -green;
      }
      change = { key, op: 'step', delta: step };
      env = green;
      aes = step > 0 ? P.aUp : P.aDown;
    }
    const b = {
      id: 'bill-' + (st.seq.bill + 1), no: st.seq.bill + 1, title: billTitle(change, kind), kind, sub, change,
      env, aes, taste: { B: rd(taste.B), V: rd(taste.V), L: rd(taste.L) }, conscience, members: !!members,
      sponsor: null, sponsorParty: null, introduced: t, stage: 'committee', due: null, floorDay: null,
      forced: {}, forcedInd: {}, riders: [], amendments: []
    };
    // sponsor: someone who likes the bill, weighted by ambition
    const keen = serving(st).filter((s) => personU(b, s) > 0.15);
    const sr = r();
    if (!keen.length) return null;
    const sponsor = members ? keen[Math.floor(sr * keen.length)] : weighted(() => sr, keen, keen.map((s) => s.ambition + 0.2));
    st.seq.bill++;
    b.sponsor = sponsor.id;
    b.sponsorName = sponsor.name;
    b.sponsorParty = sponsor.party === 'I' ? null : sponsor.party;
    sponsor.stats.sponsored++;
    return b;
  }
  function introduce(ctx, t, b, dueDays) {
    const st = ctx.st;
    if (dueDays === 0) { b.stage = 'floor'; b.floorDay = dayOf(t); }
    else b.due = dayOf(t) + dueDays * DAY;
    st.bills[b.id] = b;
    const how = b.members ? ' (drawn from the members\u2019 ballot)' : b.kind === 'emergency' ? ' under emergency procedure' : '';
    emit(ctx, t, b.kind === 'emergency' ? 'bill.emergency' : 'bill.introduced', b.kind === 'emergency' ? 3 : 1, b.id + ':introduced',
      { bill: b.id, no: b.no, title: b.title, sponsor: b.sponsor, sponsorName: b.sponsorName, party: b.sponsorParty, change: b.change, kind: b.kind },
      'Senator ' + b.sponsorName + ' introduces the ' + b.title + how);
  }

  function committeeReports(ctx, t, r) {
    const st = ctx.st, day = dayOf(t);
    for (const id of Object.keys(st.bills)) {
      const b = st.bills[id];
      if (b.stage !== 'committee' || b.due > day) continue;
      const kill = r(), amend = r();
      const majorityU = st.majority ? partyU(b, st.majority) : 0;
      if ((majorityU < -0.2 && kill < 0.45) || kill < 0.06) {
        b.stage = 'lapsed';
        finish(ctx, t, b);
        emit(ctx, t, 'bill.lapsed', 2, b.id + ':lapsed', { bill: b.id, title: b.title },
          'The ' + b.title + ' dies in committee');
        continue;
      }
      if (b.change.op === 'shift' && abs(b.change.delta) > 1 && amend < 0.25) {
        const before = b.change.delta;
        b.change.delta = before > 0 ? Math.floor(before / 2) : -Math.floor(-before / 2);
        b.amendments.push('Committee halved the change from ' + before + ' to ' + b.change.delta);
        const oldTitle = b.title;
        b.title = billTitle(b.change, b.kind);
        emit(ctx, t, 'bill.amended', 2, b.id + ':committee', { bill: b.id, from: before, to: b.change.delta, oldTitle },
          'Committee halves the change proposed in the ' + oldTitle);
      }
      b.stage = 'floor';
      b.floorDay = day + DAY;
    }
  }

  function riderFor(st, b, bloc) {
    const mods = modifiedKeys(st).filter((k) => k !== b.change.key);
    const stepIf = (key) => {
      const P = POLICY[key], cur = st.laws[key] !== undefined ? st.laws[key] : P.def;
      return cur + 1 <= P.max && b.change.key !== key ? { key, op: 'step', delta: 1 } : null;
    };
    if (bloc === 'L') return mods.length ? { key: mods[0], op: 'reset' } : stepIf('policy.parks') || stepIf('policy.wildlifeZones');
    if (bloc === 'V') return stepIf('policy.wildlifeZones') || stepIf('policy.parks');
    if (bloc === 'B') return stepIf('policy.constructionBudget');
    return null;
  }
  function tryConcession(ctx, t, b, r) {
    const st = ctx.st;
    const ex = expectTally(st, b);
    const dealRoll = r(), indRoll = r();
    if (ex.ayes > ex.noes) return;
    // a party bloc whose switch would carry the bill
    const order = ['L', 'V', 'B'];
    for (const p of order) {
      if (b.forced[p] || b.sponsorParty === p || !ex.blocs[p]) continue;
      if (ex.ayes + ex.blocs[p] <= ex.noes - ex.blocs[p]) continue;
      const u = partyU(b, p);
      const limit = p === 'L' ? 0.6 : 0.45;
      if (u < -limit || dealRoll > (p === 'L' ? 0.35 : 0.2)) continue;
      const rider = riderFor(st, b, p);
      b.forced[p] = 'aye';
      let what;
      if (rider) { b.riders.push(rider); what = describeChange(rider); }
      else if (b.change.op === 'shift' && abs(b.change.delta) > 1) {
        const before = b.change.delta;
        b.change.delta = before > 0 ? Math.floor(before / 2) : -Math.floor(-before / 2);
        what = 'the change halved';
        b.title = billTitle(b.change, b.kind);
      } else what = 'a promise of future consideration';
      emit(ctx, t, 'bill.concession', 3, b.id + ':concession-' + p, { bill: b.id, party: p, rider: rider || null, terms: what },
        PARTIES[p].short + ' backs the ' + b.title + ' after securing an amendment: ' + what);
      return;
    }
    // an independent holding the deciding vote
    for (const s of serving(st)) {
      if (s.party !== 'I' || b.forcedInd[s.id]) continue;
      if (expectedVote(b, s) !== 'N' || ex.ayes + 1 <= ex.noes - 1) continue;
      if (personU(b, s) < -0.5 || indRoll > 0.5) continue;
      const P = POLICY[s.pet.key], cur = st.laws[s.pet.key] !== undefined ? st.laws[s.pet.key] : P.def;
      const ok = cur + s.pet.dir <= P.max && cur + s.pet.dir >= P.min && s.pet.key !== b.change.key;
      const rider = ok ? { key: s.pet.key, op: 'step', delta: s.pet.dir } : null;
      if (rider) b.riders.push(rider);
      b.forcedInd[s.id] = true;
      emit(ctx, t, 'bill.concession', 3, b.id + ':concession-' + s.id, { bill: b.id, senator: s.id, rider },
        'Independent Senator ' + s.name + ' supports the ' + b.title + (rider ? ' after securing an amendment: ' + describeChange(rider) : ''));
      return;
    }
  }

  function castVotes(ctx, t, b, r) {
    const st = ctx.st;
    const pos = { B: partyPosition(b, 'B'), V: partyPosition(b, 'V'), L: partyPosition(b, 'L') };
    const votes = {}, rebels = [];
    let ayes = 0, noes = 0, absent = 0;
    for (const seat of st.seats) {
      if (!seat.senator) continue;
      const s = st.people[seat.senator];
      const a = r(), n = r(), c = r();
      if (a < 0.05) { votes[s.id] = '-'; absent++; s.stats.missed++; continue; }
      const u = personU(b, s) + (n - 0.5) * 0.2;
      let v;
      if (s.party === 'I') v = b.forcedInd[s.id] || u > 0 ? 'A' : 'N';
      else if (pos[s.party] === 'free') v = u > 0 ? 'A' : 'N';
      else {
        v = pos[s.party] === 'aye' ? 'A' : 'N';
        const disagree = (v === 'A' && u < -0.3) || (v === 'N' && u > 0.3);
        if (disagree && c < (1 - s.loyalty) * 0.6 * abs(u)) {
          v = v === 'A' ? 'N' : 'A';
          rebels.push(s.id);
          s.stats.rebellions++;
          s.loyalty = rd(clamp(s.loyalty - 0.03, 0, 1));
        }
      }
      votes[s.id] = v;
      if (v === 'A') ayes++; else noes++;
    }
    return { votes, ayes, noes, absent, rebels, positions: pos };
  }

  function divide(ctx, t, b, r) {
    const st = ctx.st;
    tryConcession(ctx, t, b, r);
    const res = castVotes(ctx, t, b, r);
    const tie = res.ayes === res.noes;
    const passed = res.ayes > res.noes; // a tie fails: the Presiding Officer votes for the status quo
    b.result = { ayes: res.ayes, noes: res.noes, absent: res.absent, tie, rebels: res.rebels, positions: res.positions };
    b.votes = res.votes;
    b.stage = passed ? 'passed' : 'failed';
    b.decided = t;
    const sponsor = st.people[b.sponsor];
    if (passed && sponsor) sponsor.stats.passed++;
    const tally = res.ayes + '\u2013' + res.noes;
    const visible = b.kind !== 'environmental' && b.kind !== 'emergency';
    if (passed) {
      const changes = [b.change].concat(b.riders);
      st.pending.push({ bill: b.id, title: b.title, effective: dayOf(t) + DAY, changes });
      emit(ctx, t, 'bill.passed', visible || b.kind === 'emergency' ? 3 : 2, b.id + ':passed',
        { bill: b.id, title: b.title, ayes: res.ayes, noes: res.noes, rebels: res.rebels, changes },
        'The ' + b.title + ' passes ' + tally);
    } else if (tie) {
      emit(ctx, t, 'bill.failed', 4, b.id + ':failed', { bill: b.id, title: b.title, ayes: res.ayes, noes: res.noes, tie: true },
        'The ' + b.title + ' falls on the Presiding Officer\u2019s casting vote after a ' + tally + ' tie');
    } else {
      emit(ctx, t, 'bill.failed', 2, b.id + ':failed', { bill: b.id, title: b.title, ayes: res.ayes, noes: res.noes },
        'The ' + b.title + ' is defeated ' + tally);
    }
    if (res.rebels.length >= 2) {
      emit(ctx, t, 'senate.rebellion', 3, b.id + ':rebellion', { bill: b.id, rebels: res.rebels },
        res.rebels.length + ' senators defy their parties on the ' + b.title);
    } else if (res.rebels.length === 1) {
      const s = st.people[res.rebels[0]];
      emit(ctx, t, 'senate.rebellion', 2, b.id + ':rebellion', { bill: b.id, rebels: res.rebels },
        'Senator ' + s.name + ' crosses the floor on the ' + b.title);
    }
    finish(ctx, t, b);
  }
  function finish(ctx, t, b) {
    delete ctx.st.bills[b.id];
    b.finished = t;
    ctx.arch.bills.push(b);
  }

  // ---------------------------------------------------------------- filibusters
  function maybeFilibuster(ctx, t, b, r) {
    const st = ctx.st;
    const roll = r(), lenRoll = r();
    if (b.kind === 'emergency') return null;
    const ex = expectTally(st, b);
    if (ex.ayes <= ex.noes) return null;
    let who = null, worst = -0.55;
    for (const s of serving(st)) {
      if (expectedVote(b, s) !== 'N') continue;
      const u = personU(b, s);
      if (u < worst) { worst = u; who = s; }
    }
    if (!who) return null;
    const canCloture = ex.ayes >= CLOTURE;
    if (roll > (canCloture ? 0.03 : 0.12)) return null;
    let end = canCloture ? t + 2 * H : t + 3 * H + Math.floor(lenRoll * 11 * H / MIN) * MIN;
    const cap = dayOf(t) + DAY + 8 * H + 50 * MIN;
    if (end > cap) end = cap;
    return { bill: b.id, senator: who.id, name: who.name, start: t, end, cloture: canCloture };
  }
  function startFilibuster(ctx, t, fb) {
    const b = ctx.st.bills[fb.bill];
    emit(ctx, t, 'filibuster.start', 3, b.id + ':filibuster', { bill: b.id, senator: fb.senator, name: fb.name },
      'Senator ' + fb.name + ' begins a filibuster against the ' + b.title);
  }
  function endFilibuster(ctx, t, fb) {
    const st = ctx.st, b = st.bills[fb.bill], s = st.people[fb.senator];
    const ms = fb.end - fb.start;
    if (s) {
      s.stats.filibusters++;
      if (ms > s.stats.longestFilibusterMs) s.stats.longestFilibusterMs = ms;
    }
    const hours = Math.floor(ms / (6 * MIN)) / 10;
    const head = fb.cloture
      ? 'Senate invokes cloture, ending Senator ' + fb.name + '\u2019s filibuster after ' + hours + ' hours'
      : 'Senator ' + fb.name + ' yields the floor after speaking for ' + hours + ' hours';
    emit(ctx, t, 'filibuster.end', hours >= 10 ? 4 : 3, (b ? b.id : fb.bill) + ':filibuster-end',
      { bill: fb.bill, senator: fb.senator, hours, cloture: fb.cloture }, head);
  }
  function continueFilibuster(ctx, day) {
    const st = ctx.st, fb = st.filibuster;
    if (!fb || fb.end >= day + DAY) return;
    at(ctx, fb.end, (t) => endFilibuster(ctx, t, fb));
    at(ctx, fb.end + 5 * MIN, (t) => {
      st.filibuster = null;
      const b = st.bills[fb.bill];
      if (b) divide(ctx, t, b, seeded('votes', day));
    });
  }

  // ---------------------------------------------------------------- the daily rhythm
  function applyPending(ctx, t) {
    const st = ctx.st;
    const due = st.pending.filter((p) => p.effective <= t);
    st.pending = st.pending.filter((p) => p.effective > t);
    for (const p of due) {
      const done = [];
      for (const c of p.changes) {
        if (COLOUR_KEYS[c.key]) {
          if (c.op === 'reset') delete st.laws[c.key];
          else {
            const cur = st.laws[c.key] || { h: 0, s: 0, l: 0 };
            cur[c.field] = clamp(cur[c.field] + c.delta, -SHIFT_LIMITS[c.field], SHIFT_LIMITS[c.field]);
            if (!cur.h && !cur.s && !cur.l) delete st.laws[c.key]; else st.laws[c.key] = cur;
          }
        } else if (CHOICES[c.key]) {
          if (c.op === 'reset' || c.value === CHOICES[c.key].def) delete st.laws[c.key]; else st.laws[c.key] = c.value;
        } else if (POLICY[c.key]) {
          const P = POLICY[c.key];
          const v = clamp((st.laws[c.key] !== undefined ? st.laws[c.key] : P.def) + c.delta, P.min, P.max);
          if (v === P.def) delete st.laws[c.key]; else st.laws[c.key] = v;
          st.concern = rd(clamp(st.concern + (c.delta * P.green > 0 ? -0.03 : 0.02), 0, 1));
        }
        done.push(describeChange(c));
      }
      const visible = p.changes.some((c) => !POLICY[c.key]);
      emit(ctx, t, 'law.in_effect', visible ? 3 : 2, p.bill + ':in-effect', { bill: p.bill, title: p.title, changes: p.changes },
        'Now in effect: ' + done.join('; '));
    }
  }
  function drift(ctx, t) {
    // Public mood wanders slowly (weeks to months), and voters tire of whoever leads the Senate.
    const st = ctx.st, r = seeded('drift', dayOf(t));
    const C = st.concern;
    if (st.majority) st.fatigue = rd(clamp(st.fatigue + 0.0002, 0, 0.09) * 1000) / 1000;
    for (const p of PARTY_IDS) {
      st.mood[p] = rd((st.mood[p] * 0.995 + (r() - 0.5) * 0.014) * 1000) / 1000;
      let target = PARTIES[p].base + st.mood[p] - (p === st.majority ? st.fatigue : 0);
      if (p === 'V') target += (C - 0.4) * 0.1;
      if (p === 'B') target -= (C - 0.4) * 0.1;
      st.support[p] += (target - st.support[p]) * 0.05;
    }
    normaliseSupport(st);
  }
  function news(ctx, t) {
    const st = ctx.st, day = dayOf(t), r = seeded('news', day);
    const month = new Date(day).getUTCMonth(), dom = new Date(day).getUTCDate();
    // Public concern about air quality. A stub until the Ecosystem exists; then it reads yesterday's smog.
    st.concern = rd(clamp(st.concern + (r() - 0.5) * 0.03 + (0.4 - st.concern) * 0.015, 0, 1));
    const winter = month >= 5 && month <= 7;
    if (r() < (winter ? 0.02 : 0.006)) {
      st.concern = rd(clamp(st.concern + 0.2 + r() * 0.2, 0, 1));
      emit(ctx, t, 'concern.surge', 3, 'concern:' + ymd(day), { concern: st.concern, stub: true },
        'Complaints about air quality flood Senate offices');
    }
    if (!st.founded) return;
    // senators: scandals and health retirements
    for (let i = 0; i < st.seats.length; i++) {
      const seat = st.seats[i];
      if (!seat.senator) continue;
      const s = st.people[seat.senator];
      const x = r(), y = r();
      if (x < 0.00012 * (0.5 + s.scandalRisk)) {
        s.stats.scandals++;
        const sev = y < 0.55 ? 'minor' : y < 0.9 ? 'major' : 'resign';
        if (s.party !== 'I') st.support[s.party] -= sev === 'minor' ? 0.005 : 0.02;
        if (sev !== 'minor') s.quality = rd(s.quality * 0.85);
        const head = sev === 'minor' ? 'Senator ' + s.name + ' apologises after an expenses irregularity'
          : sev === 'major' ? 'Senator ' + s.name + ' faces calls to resign over undeclared interests in a pixel-coal concern'
            : 'Senator ' + s.name + ' resigns in disgrace';
        emit(ctx, t, sev === 'resign' ? 'senator.resigned' : 'senator.scandal', sev === 'minor' ? 2 : sev === 'major' ? 3 : 4,
          'scandal:' + s.id + ':' + ymd(day), { senator: s.id, name: s.name, party: s.party, severity: sev }, head);
        if (sev === 'resign') vacancy(ctx, t, i, 'resigned');
      } else if (x > 1 - 0.00004 && st.opened) {
        emit(ctx, t, 'senator.retired', 3, 'health:' + s.id + ':' + ymd(day), { senator: s.id, name: s.name, party: s.party },
          'Senator ' + s.name + ' retires from the Senate on health grounds');
        vacancy(ctx, t, i, 'retired');
      }
    }
    normaliseSupport(st);
    // defections, checked monthly
    if (dom === 15 && st.opened) {
      for (let i = 0; i < st.seats.length; i++) {
        const seat = st.seats[i];
        if (!seat.senator) continue;
        const s = st.people[seat.senator];
        const roll = r();
        if (s.party === 'I') continue;
        const own = distance(s, PARTIES[s.party]);
        let to = null, best = 99;
        for (const p of PARTY_IDS) if (p !== s.party && distance(s, PARTIES[p]) < best) { best = distance(s, PARTIES[p]); to = p; }
        let dest = null;
        if (s.loyalty < 0.3 && best - own < 0.9 && roll < 0.25) dest = to;
        else if (s.loyalty < 0.3 && roll < 0.4) dest = 'I';
        if (!dest) continue;
        const from = s.party;
        if (st.leaders[from] === s.id) { st.leaders[from] = null; }
        s.party = dest;
        s.loyalty = rd(0.6 + roll);
        if (dest === 'I') s.pet = { key: POLICY_KEYS[i % POLICY_KEYS.length], dir: s.env > 0 ? (POLICY[POLICY_KEYS[i % POLICY_KEYS.length]].green) : -POLICY[POLICY_KEYS[i % POLICY_KEYS.length]].green };
        st.support[from] -= 0.01;
        emit(ctx, t, 'senator.defected', 5, 'defection:' + s.id + ':' + ymd(day), { senator: s.id, name: s.name, from, to: dest },
          dest === 'I' ? 'Senator ' + s.name + ' quits ' + PARTIES[from].short + ' to sit as an independent'
            : 'Senator ' + s.name + ' crosses from ' + PARTIES[from].short + ' to ' + PARTIES[dest].short);
        if (!st.leaders[from]) chooseLeader(ctx, t, from, 'defection');
        updateMajority(ctx, t);
      }
      normaliseSupport(st);
    }
    // ahead of the next general election
    const next = electionsAfter(day - 1, 1)[0];
    if (next - day === 21 * DAY && st.opened) {
      for (const seat of st.seats) {
        if (seat.termEnds !== next || !seat.senator) continue;
        const s = st.people[seat.senator];
        if (r() < clamp(0.05 + 0.12 * (s.termsWon - 1), 0.05, 0.5)) {
          s.retiring = true;
          emit(ctx, t, 'senator.retiring', 2, 'retiring:' + s.id + ':' + ymd(next), { senator: s.id, name: s.name, party: s.party },
            'Senator ' + s.name + ' will not seek re-election in ' + st.districts[seat.district].name);
        }
      }
    }
    if (next - day === 14 * DAY && st.opened) {
      const deals = {};
      for (const p of PARTY_IDS) {
        let to = null, best = 99;
        for (const q of PARTY_IDS) {
          if (q === p) continue;
          const d = distance(PARTIES[p], PARTIES[q]) + r() * 0.8;
          if (d < best) { best = d; to = q; }
        }
        deals[p] = to;
      }
      st.deals = deals;
      for (const p of PARTY_IDS) {
        const mutual = deals[deals[p]] === p;
        if (mutual && p > deals[p]) continue;
        emit(ctx, t, 'preference.deal', mutual ? 3 : 2, 'deal:' + ymd(next) + ':' + p, { party: p, to: deals[p], mutual },
          mutual ? PARTIES[p].short + ' and ' + PARTIES[deals[p]].short + ' agree to swap preferences'
            : PARTIES[p].short + ' recommends ' + PARTIES[deals[p]].short + ' as its second preference');
      }
    }
  }
  function leadership(ctx, t) {
    const st = ctx.st, r = seeded('leaders', dayOf(t));
    for (const p of PARTY_IDS) {
      const roll = r();
      const leadId = st.leaders[p];
      if (!leadId) continue;
      const caucus = serving(st).filter((s) => s.party === p);
      if (caucus.length < 3) continue;
      const pressure = (st.leaderSupport[p] - st.support[p]) * 12 + st.seatLoss[p] * 0.25;
      st.seatLoss[p] = rd(st.seatLoss[p] * 0.6);
      if (pressure < 0.35 || roll > 0.3) continue;
      const others = caucus.filter((s) => s.id !== leadId).sort((a, b) => b.ambition - a.ambition || (a.id < b.id ? -1 : 1));
      const ch = others[0];
      if (!ch || ch.ambition < 0.4) continue;
      let forCh = 0;
      for (const m of others) {
        const pr = 0.25 + pressure * 0.35 + (m.ambition - 0.5) * 0.2 - (m.loyalty - 0.5) * 0.3;
        if (m === ch || r() < pr) forCh++;
      }
      const leader = st.people[leadId];
      const won = forCh * 2 > caucus.length;
      const tally = forCh + '\u2013' + (caucus.length - forCh);
      if (won) {
        st.leaders[p] = ch.id;
        st.leaderSupport[p] = st.support[p];
        st.support[p] += 0.01;
        leader.loyalty = rd(clamp(leader.loyalty - 0.2, 0, 1));
        normaliseSupport(st);
        emit(ctx, t, 'leader.challenge', 4, 'challenge:' + p + ':' + ymd(t), { party: p, challenger: ch.id, leader: leadId, won, tally },
          'Senator ' + ch.name + ' topples Senator ' + leader.name + ' as ' + PARTIES[p].short + (st.majority === p ? ' leader and Majority Leader ' : ' leader ') + tally);
      } else {
        ch.loyalty = rd(clamp(ch.loyalty - 0.15, 0, 1));
        emit(ctx, t, 'leader.challenge', 3, 'challenge:' + p + ':' + ymd(t), { party: p, challenger: ch.id, leader: leadId, won, tally },
          'Senator ' + leader.name + ' survives a leadership challenge from Senator ' + ch.name + ' ' + (caucus.length - forCh) + '\u2013' + forCh);
      }
    }
  }
  function poll(ctx, t) {
    const st = ctx.st, r = seeded('poll', dayOf(t));
    const raw = {};
    let sum = 0;
    for (const p of PARTY_IDS) { raw[p] = clamp(st.support[p] + (r() + r() + r() - 1.5) * 0.03, 0.02, 0.9); sum += raw[p]; }
    const pct = {};
    for (const p of PARTY_IDS) pct[p] = Math.floor((raw[p] / sum) * 100 + 0.5);
    const prev = st.lastPoll;
    let swing = 0;
    if (prev) for (const p of PARTY_IDS) swing = abs(pct[p] - prev[p]) > swing ? abs(pct[p] - prev[p]) : swing;
    st.lastPoll = pct;
    emit(ctx, t, 'poll.published', swing >= 4 ? 3 : 2, 'poll:' + ymd(t), { poll: pct, swing },
      'Weekly poll: Brightness ' + pct.B + '%, Verdant ' + pct.V + '%, Legacy Mode ' + pct.L + '%');
  }
  function openSenate(ctx, t) {
    const st = ctx.st, day = dayOf(t), r = seeded('lots', day);
    st.opened = true;
    const ends = electionsAfter(day, 3);
    for (let d = 0; d < DISTRICT_NAMES.length; d++) {
      const order = [0, 1, 2];
      for (let i = 2; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      for (let k = 0; k < 3; k++) {
        const seat = st.seats[d * 3 + k];
        seat.cls = order[k];
        seat.termEnds = ends[order[k]];
      }
    }
    emit(ctx, t, 'senate.opening', 5, 'opening', { composition: counts(st), presidingOfficer: PRESIDING_OFFICER.name },
      'The Pixel Senate sits for the first time, with ' + PRESIDING_OFFICER.title + ' ' + PRESIDING_OFFICER.name + ' in the chair');
    emit(ctx, t, 'senate.lots', 3, 'lots', { ends: ends.map(ymd) },
      'Senators draw lots: sixteen will face the voters in ' + ymd(ends[0]) + ', sixteen in ' + ymd(ends[1]) + ' and sixteen in ' + ymd(ends[2]));
    st.majority = null;
    updateMajorityQuiet(st);
    for (const p of PARTY_IDS) chooseLeader(ctx, t, p, 'opening');
  }
  function updateMajorityQuiet(st) {
    const c = counts(st);
    let best = null;
    for (const p of PARTY_IDS) if (best === null || c[p] > c[best] || (c[p] === c[best] && st.support[p] > st.support[best])) best = p;
    st.majority = best;
  }

  const gpCache = {};
  function glacialResolution(ctx, t) {
    // Optional: reads Glacial if its scripts are loaded. Events only; never touches state or randomness.
    const G = root.G;
    if (!G || typeof G.buildLeague !== 'function' || !G.PX) return;
    const d = new Date(t);
    const id = 'GP-' + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
    try {
      if (!(id in gpCache)) {
        const L = G.buildLeague(dayOf(t));
        const race = L.byId[id];
        gpCache[id] = race && race.winner ? G.PX[race.winner.id].name : null;
      }
    } catch (e) { gpCache[id] = null; }
    const winner = gpCache[id];
    if (!winner) return;
    emit(ctx, t, 'resolution.passed', 2, 'resolution:' + id, { race: id, winner },
      'Senate passes, on the voices, a resolution congratulating ' + winner + ' on winning the ' + CHOICES['names.gp'].def + ' of ' + ymd(t).slice(0, 7));
  }

  function sitting(ctx, day) {
    const st = ctx.st;
    if (!st.opened && !at(ctx, day + 19 * H, (t) => openSenate(ctx, t))) return;
    const rb = seeded('bills', day), rv = seeded('votes', day);
    if (!at(ctx, day + 19 * H + 20 * MIN, (t) => committeeReports(ctx, t, rb))) return;
    if (new Date(day).getUTCDate() === 3 && !at(ctx, day + 19 * H + 25 * MIN, (t) => glacialResolution(ctx, t))) return;
    // emergency procedure
    const emergencyRoll = rb();
    if (st.concern > 0.82 && day - st.lastEmergency > 21 * DAY && emergencyRoll < 0.8) {
      if (!at(ctx, day + 19 * H + 28 * MIN, (t) => {
        const b = genBill(ctx, t, rb, 'emergency', false);
        if (b) { introduce(ctx, t, b, 0); st.lastEmergency = day; }
      })) return;
    }
    // ordinary introductions
    const nRoll = rb();
    let n = nRoll < 0.62 ? 0 : nRoll < 0.96 ? 1 : 2;
    if (st.concern > 0.75 && n < 2) n++;
    for (let k = 0; k < n; k++) {
      if (!at(ctx, day + 19 * H + (30 + k * 10) * MIN, (t) => {
        const b = genBill(ctx, t, rb, null, false);
        if (b) introduce(ctx, t, b, 2 + Math.floor(rb() * 4));
      })) return;
    }
    // the members' ballot, drawn from the tin on Thursdays
    if (new Date(day).getUTCDay() === 4) {
      if (!at(ctx, day + 19 * H + 55 * MIN, (t) => {
        const b = genBill(ctx, t, rb, null, true);
        if (b) introduce(ctx, t, b, 2 + Math.floor(rb() * 4));
      })) return;
    }
    // divisions from 22:00, six minutes apart
    if (st.filibuster) return; // the floor is still held
    const ready = Object.keys(st.bills).map((k) => st.bills[k]).filter((b) => b.stage === 'floor' && b.floorDay <= day)
      .sort((a, b) => a.no - b.no);
    let slot = day + 22 * H;
    for (let i = 0; i < ready.length; i++) {
      const b = ready[i];
      if (i >= 6) { b.floorDay = day + DAY; continue; }
      let fb = null;
      if (!at(ctx, slot, (t) => {
        fb = maybeFilibuster(ctx, t, b, rv);
        if (fb) {
          startFilibuster(ctx, t, fb);
          for (let j = i + 1; j < ready.length; j++) ready[j].floorDay = day + DAY;
          if (fb.end + 5 * MIN >= day + DAY) st.filibuster = fb;
        } else divide(ctx, t, b, rv);
      })) return;
      if (fb) {
        if (fb.end + 5 * MIN < day + DAY) {
          if (!at(ctx, fb.end, (t) => endFilibuster(ctx, t, fb))) return;
          if (!at(ctx, fb.end + 5 * MIN, (t) => divide(ctx, t, b, rv))) return;
        }
        return;
      }
      slot += 6 * MIN;
    }
  }

  function runDay(ctx, day) {
    const st = ctx.st;
    const dow = new Date(day).getUTCDay();
    if (!at(ctx, day, (t) => { applyPending(ctx, t); if (st.founded) drift(ctx, t); })) return;
    continueFilibuster(ctx, day);
    if (!at(ctx, day + 9 * H, (t) => news(ctx, t))) return;
    if (dow === 1 && st.opened && !at(ctx, day + 9 * H + 30 * MIN, (t) => leadership(ctx, t))) return;
    if (dow === 1 && st.founded && !at(ctx, day + 10 * H, (t) => poll(ctx, t))) return;
    if (isGeneralElection(day) && !at(ctx, day + 11 * H, (t) => generalElection(ctx, t))) return;
    const bys = st.byelections.filter((b) => b.day === day).map((b) => b.seat).sort((a, b) => a - b);
    for (const seatIdx of bys) if (!at(ctx, day + 11 * H, (t) => byElection(ctx, t, seatIdx))) return;
    if (isSitting(day)) sitting(ctx, day);
  }

  // ---------------------------------------------------------------- the public instance
  function createSenate() {
    const events = [];
    const archive = { bills: [], elections: [] };
    const checkpoints = [{ day: START, json: JSON.stringify(fresh()) }];
    let cache = { day: START, state: fresh() };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    function fullCtx(st) { return { st, limit: Infinity, stopped: false, ev: events, arch: archive }; }
    function scratchCtx(st, limit) { return { st, limit, stopped: false, ev: [], arch: { bills: [], elections: [] } }; }

    /** Simulates every whole day before `day`. */
    function ensure(day) {
      while (cache.day < day) {
        runDay(fullCtx(cache.state), cache.day);
        cache.day += DAY;
        if ((cache.day - START) % (CHECKPOINT_EVERY * DAY) === 0) checkpoints.push({ day: cache.day, json: JSON.stringify(cache.state) });
      }
    }
    function stateAtDayStart(day) {
      if (day >= cache.day) { ensure(day); return clone(cache.state); }
      let cp = checkpoints[0];
      for (const c of checkpoints) if (c.day <= day) cp = c;
      const st = JSON.parse(cp.json);
      for (let d = cp.day; d < day; d += DAY) runDay(scratchCtx(st, Infinity), d);
      return st;
    }
    /** Everything up to and including `time`: a state, plus the day's events and finished business so far. */
    function upTo(time) {
      const day = dayOf(time);
      const st = stateAtDayStart(day);
      const ctx = scratchCtx(st, time);
      runDay(ctx, day);
      return ctx;
    }

    function stateAt(time) {
      if (time < START) {
        return { time, started: false, opened: false, startDate: ymd(START), firstSitting: ymd(FIRST_SITTING),
          laws: resolveLaws({}), pendingLaws: [], nextElection: ymd(START), presidingOfficer: PRESIDING_OFFICER };
      }
      const st = upTo(time).st;
      const c = counts(st);
      const pub = (s) => s && { id: s.id, name: s.name, party: s.party, env: s.env, aes: s.aes, loyalty: s.loyalty,
        ambition: s.ambition, termsWon: s.termsWon, since: s.since ? ymd(s.since) : null, stats: s.stats, pet: s.pet };
      const leader = (p) => (st.leaders[p] ? pub(st.people[st.leaders[p]]) : null);
      return {
        time, started: true, opened: st.opened, version: VERSION,
        composition: c, majority: st.majority, majorityLeader: st.majority ? leader(st.majority) : null,
        leaders: { B: leader('B'), V: leader('V'), L: leader('L') },
        support: st.support, lastPoll: st.lastPoll,
        concern: st.concern, concernSource: 'stub',
        seats: st.seats.map((seat, i) => ({ seat: i, district: st.districts[seat.district].name, cls: seat.cls,
          termEnds: seat.termEnds ? ymd(seat.termEnds) : null, senator: seat.senator ? pub(st.people[seat.senator]) : null })),
        laws: resolveLaws(st.laws), pendingLaws: st.pending,
        bills: Object.keys(st.bills).map((k) => st.bills[k]),
        filibuster: st.filibuster && st.filibuster.start <= time ? st.filibuster : null,
        byelections: st.byelections.map((b) => ({ date: ymd(b.day), seat: b.seat, district: st.districts[st.seats[b.seat].district].name })),
        nextElection: ymd(isGeneralElection(dayOf(time)) && time < dayOf(time) + 11 * H ? dayOf(time) : electionsAfter(dayOf(time), 1)[0]),
        presidingOfficer: PRESIDING_OFFICER,
        people: st.people
      };
    }
    function eventsBetween(from, to) {
      if (to < START) return [];
      const ctx = upTo(to), day = dayOf(to);
      return events.filter((e) => e.ms >= from && e.ms < day).concat(ctx.ev.filter((e) => e.ms >= from && e.ms <= to));
    }
    function billsBetween(from, to) {
      if (to < START) return [];
      const ctx = upTo(to), day = dayOf(to);
      return archive.bills.filter((b) => b.finished < day).concat(ctx.arch.bills).filter((b) => b.finished >= from && b.finished <= to);
    }
    function electionsBetween(from, to) {
      if (to < START) return [];
      const ctx = upTo(to), day = dayOf(to);
      return archive.elections.filter((e) => e.ms < day).concat(ctx.arch.elections).filter((e) => e.ms >= from && e.ms <= to);
    }
    function lawsAt(time) { return stateAt(time).laws; }

    return {
      version: VERSION, startDate: ymd(START), firstSitting: ymd(FIRST_SITTING),
      parties: PARTIES, independent: INDEPENDENT, districts: DISTRICT_NAMES, presidingOfficer: PRESIDING_OFFICER,
      lawKeys: { colours: COLOUR_KEYS, choices: CHOICES, policy: POLICY, shiftLimits: SHIFT_LIMITS },
      stateAt, eventsBetween, billsBetween, electionsBetween, lawsAt,
      styleVars: (time, scheme) => styleVars(lawsAt(time), scheme),
      create: createSenate,
      _internals: { rng, hash, START, DAY }
    };
  }

  // ---------------------------------------------------------------- display helpers (not simulation)
  // Turns colour laws into CSS variable values, with a contrast guardrail. Display code may use any maths.
  const BASE = {
    light: { '--bg': '#E6ECEE', '--surface': '#F3F6F7', '--ink': '#14212A', '--link': '#1C5AB3', '--focus': '#1C5AB3', '--screen': '#0E171C', '--bezel': '#1E2A31' },
    dark: { '--bg': '#10181D', '--surface': '#162128', '--ink': '#E1E9EC', '--link': '#82B6FF', '--focus': '#82B6FF', '--screen': '#0A1115', '--bezel': '#24323A' }
  };
  const FONT_STACKS = {
    'Bricolage Grotesque': '"Bricolage Grotesque", "Arial Narrow", system-ui, sans-serif',
    'Space Grotesk': '"Space Grotesk", system-ui, sans-serif',
    'Fraunces': 'Fraunces, Georgia, serif',
    'DM Serif Display': '"DM Serif Display", Georgia, serif',
    'Syne': 'Syne, system-ui, sans-serif',
    'Archivo Narrow': '"Archivo Narrow", "Arial Narrow", sans-serif',
    'IBM Plex Sans': '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    'Source Serif 4': '"Source Serif 4", Georgia, serif',
    'Work Sans': '"Work Sans", system-ui, sans-serif',
    'Atkinson Hyperlegible': '"Atkinson Hyperlegible", system-ui, sans-serif',
    'IBM Plex Mono': '"IBM Plex Mono", ui-monospace, monospace',
    'Literata': 'Literata, Georgia, serif'
  };
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function shift(hex, sh, k) {
    const c = hexToHsl(hex);
    return hslToHex(c.h + sh.h * k, c.s + sh.s * k, c.l + sh.l * k);
  }
  function styleVars(laws, scheme) {
    const base = BASE[scheme === 'dark' ? 'dark' : 'light'];
    let k = 1, out;
    for (let tries = 0; tries < 10; tries++) {
      out = Object.assign({}, base);
      for (const key in COLOUR_KEYS) for (const v of COLOUR_KEYS[key].vars) out[v] = shift(base[v], laws[key], k);
      const ok = contrast(out['--ink'], out['--bg']) >= 4.5 && contrast(out['--ink'], out['--surface']) >= 4.5 &&
        contrast(out['--link'], out['--bg']) >= 4.5 && contrast(out['--link'], out['--surface']) >= 4.5 &&
        luminance(out['--screen']) < 0.03;
      if (ok) break;
      k *= 0.7;
    }
    delete out['--ink'];
    out['--display'] = FONT_STACKS[laws['style.display']] || FONT_STACKS['Bricolage Grotesque'];
    out['--body'] = FONT_STACKS[laws['style.body']] || FONT_STACKS['IBM Plex Sans'];
    return out;
  }

  root.PixelUniverse = root.PixelUniverse || {};
  root.PixelUniverse.senate = createSenate();
  root.PixelUniverse.senateDisplay = { styleVars, contrast, fontStacks: FONT_STACKS, base: BASE };
})(typeof window !== 'undefined' ? window : globalThis);
