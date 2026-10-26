// Rocket Rush: an arrow-escape puzzle. The board holds rockets, each a bent or straight body of 2–6 squares with an arrow
// for a nose. Tap a rocket and it flies along its own body and out through its arrow's lane, but only if nothing sits in
// that lane: a blocked tap shakes the rocket and burns one of three fuses. Clear every board (a level has 1–3 waves) to
// win; launch a rocket the previous launch freed, within 1.5 s, for a Chain. Save my sky replays every launched rocket
// as a firework, in launch order: its colour, a bigger burst for a bigger chain, and a shape for its body.
// Boards are built backwards (tools/rocket-rush-levels.cjs writes assets/rocket-rush/levels.json): each rocket is placed
// so its lane is clear of the rockets placed before it, so removing them in reverse order always works, and that order
// drives the hints. Removing a rocket never blocks another, so no board can get stuck. The Daily Rocket is built the
// same way from the day's seed. The rules and the generator have no DOM, so the tests and the tool load this file in Node.
(function (root) {
  'use strict';
  // Directions: up, right, down, left.
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const ARROWS = 'URDL';
  const FUSES = 3, CHAIN_SECS = 1.5, POINTS = 100;

  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- The rules ----------
  // A rocket's cells run from tail to nose; the arrow points the way the last step went.
  function dirOf(cells, w) {
    const a = cells[cells.length - 2], b = cells[cells.length - 1], d = b - a;
    return d === -w ? 0 : d === 1 ? 1 : d === w ? 2 : 3;
  }
  // Straight (I), one bend (L) or two bends (S): the shape picks the finale's burst.
  function kindOf(cells, w) {
    let bends = 0;
    for (let i = 2; i < cells.length; i++) if (cells[i] - cells[i - 1] !== cells[i - 1] - cells[i - 2]) bends++;
    return bends === 0 ? 'I' : bends === 1 ? 'L' : 'S';
  }
  // The squares in front of the nose, out to the edge.
  function laneOf(cells, dir, w, h) {
    const head = cells[cells.length - 1], [dx, dy] = DIRS[dir], out = [];
    for (let x = head % w + dx, y = ((head / w) | 0) + dy; x >= 0 && y >= 0 && x < w && y < h; x += dx, y += dy) out.push(y * w + x);
    return out;
  }

  class Board {
    // wave: { w, h, rockets: [{ c: [cells tail→nose], k: colour }], order: [ids, a safe launch order] }
    constructor(wave) {
      this.wave = wave; this.w = wave.w; this.h = wave.h;
      this.rockets = wave.rockets.map((r, id) => {
        const dir = dirOf(r.c, wave.w);
        return { id, cells: r.c.slice(), k: r.k || 0, dir, kind: kindOf(r.c, wave.w), lane: laneOf(r.c, dir, wave.w, wave.h) };
      });
      this.order = wave.order.slice();
      this.restart();
    }
    restart() {
      this.grid = new Int16Array(this.w * this.h).fill(-1);
      for (const r of this.rockets) for (const c of r.cells) this.grid[c] = r.id;
      this.left = this.rockets.length;
    }
    at(i) { return i >= 0 && i < this.grid.length ? this.grid[i] : -1; }
    on(id) { const r = this.rockets[id]; return !!r && this.grid[r.cells[0]] === id; }
    // The rockets standing in a rocket's lane, nearest first.
    blockers(id) {
      const out = [];
      for (const c of this.rockets[id].lane) { const o = this.grid[c]; if (o >= 0 && !out.includes(o)) out.push(o); }
      return out;
    }
    free(id) { return this.on(id) && this.blockers(id).length === 0; }
    remaining() { return this.rockets.filter((r) => this.on(r.id)).map((r) => r.id); }
    // Takes a clear rocket off the board and returns the rockets that had been blocked and now are free.
    launch(id) {
      if (!this.free(id)) return null;
      const blocked = this.remaining().filter((o) => o !== id && this.blockers(o).length);
      for (const c of this.rockets[id].cells) this.grid[c] = -1;
      this.left--;
      return blocked.filter((o) => !this.blockers(o).length);
    }
    clear() { return this.left === 0; }
    // The next safe rocket: the first one in the built order still on the board. Everything that blocks it comes earlier
    // in that order, so whatever was launched before, it is free.
    hint() { for (const id of this.order) if (this.on(id)) return id; return -1; }
  }

  // One play of a level: the waves, the fuses, the chain, the score and every launch for the finale.
  class Run {
    constructor(level) {
      this.level = level; this.waveNo = 0; this.fuses = FUSES; this.mistakes = 0; this.score = 0;
      this.chain = 0; this.bestChain = 0; this.lastAt = -1e9; this.freed = new Set(); this.launches = [];
      this.board = new Board(level.waves[0]); this.failed = false; this.won = false;
    }
    get waves() { return this.level.waves.length; }
    get over() { return this.failed || this.won; }
    // A tap on a rocket at time now (ms). Blocked: a fuse burns. Clear: the rocket flies, a chain grows when it was freed
    // by the previous launch less than 1.5 s ago.
    tap(id, now) {
      const b = this.board;
      if (this.over || !b.on(id)) return null;
      const blockers = b.blockers(id);
      if (blockers.length) {
        this.fuses--; this.mistakes++; this.chain = 0; this.freed.clear();
        if (this.fuses <= 0) this.failed = true;
        return { ok: false, id, blockers, fail: this.failed };
      }
      const chained = this.freed.has(id) && now - this.lastAt <= CHAIN_SECS * 1000;
      this.chain = chained ? this.chain + 1 : 1;
      this.bestChain = Math.max(this.bestChain, this.chain);
      const r = b.rockets[id], freed = b.launch(id), points = POINTS * this.chain;
      this.freed = new Set(freed); this.lastAt = now;
      this.score += points;
      const head = r.cells[r.cells.length - 1];
      this.launches.push({ id, wave: this.waveNo, k: r.k, kind: r.kind, chain: this.chain, x: (head % b.w + 0.5) / b.w });
      const waveClear = b.clear();
      if (waveClear && this.waveNo === this.waves - 1) this.won = true;
      return { ok: true, id, chain: this.chain, points, freed, waveClear, win: this.won };
    }
    nextWave() {
      if (!this.board.clear() || this.waveNo >= this.waves - 1) return false;
      this.waveNo++;
      this.board = new Board(this.level.waves[this.waveNo]);
      this.chain = 0; this.freed.clear(); this.lastAt = -1e9;
      return true;
    }
    // 1: cleared; 2: no mistakes; 3: no mistakes under par.
    stars(secs) { return !this.won ? 0 : this.mistakes ? 1 : secs <= this.level.par ? 3 : 2; }
  }

  // ---------- The generator ----------
  // How deep the board's dependencies go: a rocket with a clear lane is 0; one blocked by others is one more than the
  // deepest of them. Rockets are listed in insertion order, so a rocket's blockers always come after it.
  function depthOf(w, h, rockets) {
    const grid = new Int16Array(w * h).fill(-1);
    rockets.forEach((r, id) => { for (const c of r.c) grid[c] = id; });
    const depth = new Array(rockets.length).fill(0);
    for (let id = rockets.length - 1; id >= 0; id--) {
      const r = rockets[id];
      for (const c of laneOf(r.c, dirOf(r.c, w), w, h)) { const o = grid[c]; if (o > id) depth[id] = Math.max(depth[id], depth[o] + 1); }
    }
    return { max: depth.length ? Math.max(...depth) : 0, free: depth.filter((d) => d === 0).length, depth };
  }
  // A random rocket body: straight 2–4 squares, L 3–6, S (two bends the opposite way) 4–6. Null if it leaves the board.
  function body(w, h, kind, rnd) {
    const len = kind === 'I' ? 2 + ((rnd() * 3) | 0) : kind === 'L' ? 3 + ((rnd() * 4) | 0) : 4 + ((rnd() * 3) | 0), steps = len - 1;
    let segs;
    if (kind === 'I') segs = [steps];
    else if (kind === 'L') { const a = 1 + ((rnd() * (steps - 1)) | 0); segs = [a, steps - a]; }
    else { const a = 1 + ((rnd() * (steps - 2)) | 0), b = 1 + ((rnd() * (steps - a - 1)) | 0); segs = [a, b, steps - a - b]; }
    const turn = rnd() < 0.5 ? 1 : 3;
    let x = (rnd() * w) | 0, y = (rnd() * h) | 0, d = (rnd() * 4) | 0;
    const cells = [y * w + x];
    segs.forEach((n, i) => {
      if (i === 1) d = (d + turn) % 4;
      if (i === 2) d = (d + 4 - turn) % 4; // back the other way: a zigzag, never a U
      for (let s = 0; s < n; s++) { x += DIRS[d][0]; y += DIRS[d][1]; cells.push(x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1); }
    });
    return cells.includes(-1) ? null : cells;
  }
  // Builds one board: rockets go in one at a time, each with a lane clear of the rockets already there. The order they
  // came out in, reversed, is a safe way to launch them all. spec: { w, h, count, bent, depth: [min, max], free }
  // free: how many rockets may start with a clear lane; new rockets are mostly put in the way of free ones to keep to it.
  function generate(spec, seed) {
    const { w, h, count, bent, depth: [dmin, dmax] } = spec, cap = spec.free ?? Math.max(1, Math.round(count / 4));
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const rnd = mulberry32((seed * 7919 + attempt * 104729) | 0);
      const grid = new Int16Array(w * h).fill(-1), rockets = [];
      for (let tries = 0; tries < count * 60 && rockets.length < count; tries++) {
        const kind = rnd() < bent ? (rnd() < 0.55 ? 'L' : 'S') : 'I', c = body(w, h, kind, rnd);
        if (!c || c.some((i) => grid[i] >= 0)) continue;
        const lane = laneOf(c, dirOf(c, w), w, h);
        if (lane.some((i) => grid[i] >= 0 || c.includes(i))) continue;
        const was = depthOf(w, h, rockets), next = rockets.concat([{ c, k: 0 }]), d = depthOf(w, h, next);
        if (d.max > dmax) continue;
        // Below the wanted depth, a rocket that blocks nothing is often passed over, so the chains grow; with enough
        // free rockets already, one that leaves them all free is too.
        if (d.max < dmin && d.max === was.max && rnd() < 0.6) continue;
        if (was.free >= cap && d.free > was.free && rnd() < 0.85) continue;
        for (const i of c) grid[i] = rockets.length;
        rockets.push({ c, k: 0 });
      }
      if (rockets.length < count) continue;
      const d = depthOf(w, h, rockets);
      if (d.max < dmin || d.max > dmax) continue;
      // A colour each, never the same as a touching rocket.
      rockets.forEach((r, id) => {
        const near = new Set();
        for (const c of r.c) for (const [dx, dy] of DIRS) {
          const x = c % w + dx, y = ((c / w) | 0) + dy;
          if (x >= 0 && y >= 0 && x < w && y < h) { const o = grid[y * w + x]; if (o >= 0 && o < id) near.add(rockets[o].k); }
        }
        const ok = [0, 1, 2, 3, 4, 5].filter((k) => !near.has(k));
        r.k = ok[(rnd() * ok.length) | 0] ?? (id % 6);
      });
      const order = rockets.map((_, i) => rockets.length - 1 - i);
      best = { w, h, rockets, order, depth: d.max, free: d.free };
      break;
    }
    if (!best) throw Error(`no board for ${JSON.stringify(spec)} seed ${seed}`);
    return best;
  }
  // Launches every rocket in a board in a safe order (or the given one). True if all of them flew.
  function solve(wave, order = wave.order) {
    const b = new Board(wave);
    for (const id of order) if (!b.launch(id)) return false;
    return b.clear();
  }
  // The Daily Rocket: two 6×6 waves from the day's number, the same on every phone.
  const DAILY_SPEC = [{ w: 6, h: 6, count: 8, bent: 0.5, depth: [2, 3] }, { w: 6, h: 6, count: 9, bent: 0.55, depth: [3, 4] }];
  function dailyLevel(n) {
    const waves = DAILY_SPEC.map((s, i) => {
      for (let tries = 0; ; tries++) {
        // a seed that can't make the board passes to the next; past a few, any depth will do
        try { const g = generate(tries < 5 ? s : { ...s, depth: [0, 9] }, 900001 + n * 31 + i + tries * 1009); return { w: g.w, h: g.h, rockets: g.rockets, order: g.order }; } catch (e) { /* next seed */ }
      }
    });
    const rockets = waves.reduce((a, wv) => a + wv.rockets.length, 0);
    return { id: `daily-${n}`, waves, par: parFor(rockets, waves.length, 1.9) };
  }
  // Boards are stored compactly: "8x8:" then the rockets, comma-separated, each a colour digit and one character per
  // square (tail to nose). The safe launch order is the reverse of the stored order, so it isn't stored.
  const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';
  const encodeWave = (wv) => `${wv.w}x${wv.h}:` + wv.rockets.map((r) => r.k + r.c.map((i) => CH[i]).join('')).join(',');
  function decodeWave(str) {
    if (typeof str !== 'string') return str;
    const [size, list] = str.split(':'), [w, h] = size.split('x').map(Number);
    const rockets = list.split(',').map((t) => ({ k: +t[0], c: [...t.slice(1)].map((ch) => CH.indexOf(ch)) }));
    return { w, h, rockets, order: rockets.map((_, i) => rockets.length - 1 - i) };
  }
  const decodeLevels = (data) => { for (const wd of data.worlds) for (const lv of wd.levels) lv.waves = lv.waves.map(decodeWave); return data; };
  // Par in seconds: a little under two seconds a rocket, plus a breath for each wave.
  const parFor = (rockets, waves, perRocket) => Math.round(rockets * perRocket + waves * 2);

  const api = { Board, Run, generate, solve, encodeWave, decodeWave, decodeLevels, depthOf, dirOf, kindOf, laneOf, dailyLevel, parFor, mulberry32, FUSES, CHAIN_SECS, ARROWS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RocketRush = api;
  api.back = () => false;
  if (typeof document === 'undefined') return;

  // ---------- The screens ----------
  // Festival colours, each with a lighter second colour for its firework.
  const COLOURS = [['#ff5a4e', '#ffd0a0'], ['#ffb02e', '#fff1b8'], ['#2fd28f', '#c8ffe6'], ['#4fa8ff', '#d4ecff'], ['#c77dff', '#f0d9ff'], ['#ff6fb5', '#ffd6ec']];
  const BURST = { I: 'peony', L: 'willow', S: 'crossette' };
  const WORLDS = { spark: 'First Spark', rooftop: 'Rooftop', temple: 'Temple Festival', bazaar: 'Night Bazaar', ghat: 'Ghat Lights',
    palace: 'Palace Gardens', harbour: 'Harbour Lights', fort: 'Fort Walls', mela: 'Grand Mela', starfall: 'Starfall Sky' };
  // Whole phrases, so each language can put the number where it belongs.
  const levelName = (lv) => (lv.daily ? `Daily Rocket #${lv.no}` : `${WORLDS[data.worlds[lv.world].id]} ${lv.index + 1}`);
  // Gems come from the game's shared puzzle rule (LUTSGame.reward). The last 3 worlds are Premium; free players can play
  // their first 5 levels. Premium also opens every world now, gives unlimited hints and every past daily.
  const UNLOCK = 2 / 3, HINTS_A_DAY = 3, HINT_VIDEOS_A_DAY = 3, HINTS_PER_VIDEO = 2, PREMIUM_WORLDS = 3, TASTER = 5, ARCHIVE_DAYS = 14;
  const TUTORIAL = [
    'Tap a rocket. It flies along its body and out the way its arrow points.',
    'A rocket flies only if its arrow’s lane is empty. A blocked tap burns a fuse.',
    'Launch a rocket within 1.5 s of freeing it for a Chain and a bigger firework.',
  ];
  const KEY = 'luts:rocket';
  const $ = (s) => document.querySelector(s);
  const t = (s) => (root.LUTSLang ? root.LUTSLang.t(s) : s);
  const game = () => root.LUTSGame || null;
  const today = () => (game() ? game().dayKey() : new Date().toISOString().slice(0, 10));
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  function load() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
    if (!v || typeof v !== 'object') v = {};
    for (const k of ['stars', 'best', 'daily', 'vids']) v[k] = v[k] && typeof v[k] === 'object' ? v[k] : {};
    if (!Number.isFinite(v.hints)) v.hints = HINTS_A_DAY;
    // Hints top back up to three every day.
    if (v.hintDay !== today()) { v.hints = Math.max(v.hints, HINTS_A_DAY); v.hintDay = today(); for (const d of Object.keys(v.vids)) if (d !== today()) delete v.vids[d]; }
    return v;
  }
  let prog = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* storage full: progress stays for this visit */ } };

  let data = null, loading = null;
  function levels() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch('assets/rocket-rush/levels.json').then((r) => { if (!r.ok) throw Error(r.status); return r.json(); })
        .then((d) => { data = decodeLevels(d); return data; }).catch((e) => { loading = null; throw e; });
    }
    return loading;
  }
  const worldStars = (wd) => wd.levels.reduce((s, l) => s + (prog.stars[l.id] || 0), 0);
  // A world opens with two thirds of the stars in the one before (200 of 300).
  const unlockAt = (wd) => Math.ceil(wd.levels.length * 3 * UNLOCK);
  const isPremium = () => !!(game() && game().premium());
  const premiumWorld = (i) => i >= data.worlds.length - PREMIUM_WORLDS;
  // Free players try the Premium worlds' first levels any time; the star gates still lead through the free worlds.
  const worldReached = (i) => i === 0 || isPremium() || worldStars(data.worlds[i - 1]) >= unlockAt(data.worlds[i - 1]);
  const worldOpen = (i) => worldReached(i) || premiumWorld(i);
  const premiumLocked = (i, j) => premiumWorld(i) && j >= TASTER && !isPremium();
  const levelOpen = (wd, j) => j === 0 || (prog.stars[wd.levels[j - 1].id] || 0) > 0;
  const startOf = () => (data ? data.from : '2026-10-25').split('-').map(Number);
  function dayNo(d = today()) {
    const [y, m, dd] = d.split('-').map(Number), [y0, m0, d0] = startOf();
    return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(y0, m0 - 1, d0)) / 864e5);
  }
  const dayOf = (n) => { const [y0, m0, d0] = startOf(); return new Date(Date.UTC(y0, m0 - 1, d0 + n)).toISOString().slice(0, 10); };
  // Today's board, or a past day's (the archive is Premium).
  const dailyCache = new Map();
  function daily(day = today()) {
    if (!dailyCache.has(day)) { const n = dayNo(day); dailyCache.set(day, { ...dailyLevel(n), id: `daily-${day}`, daily: true, day, no: n + 1 }); }
    return dailyCache.get(day);
  }

  // ----- Sound: a fizz and whoosh for a launch, a dull thud for a blocked one, rising bells for a chain -----
  function tone(freq, at, dur, vol, type = 'sine', to = 0) {
    const a = game() && game().audio();
    if (!a) return;
    const c = a.ctx, t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // A launch: the fireworks' real rocket lift (a hiss that climbs, whistling on a chain) over a short ignition fizz;
  // a chain adds a bell that rises with each link. pan: where the rocket is, -1 (left) to 1 (right).
  const whoosh = (chain, pan = 0) => {
    const s = game() && game().sounds;
    if (s) { s.lift(pan, 0.7 + Math.min(chain, 4) * 0.05, chain > 1); s.crackle(pan); } else tone(220, 0, 0.45, 0.09, 'sawtooth', 1400);
    tone(1800, 0, 0.12, 0.03, 'square', 600); // the fuse catching
    if (chain > 1) tone(660 * 2 ** ((Math.min(chain, 8) - 1) / 6), 0.02, 0.5, 0.14);
  };
  const pop = (pan, size = 0.5) => { const s = game() && game().sounds; if (s) s.burst(size, pan); };
  const thud = () => { tone(110, 0, 0.22, 0.25, 'square', 70); tone(90, 0.06, 0.25, 0.18, 'triangle', 60); };
  const swell = () => { [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => { tone(f, i * 0.09, 2.2, 0.12, 'triangle'); tone(f * 2, i * 0.09 + 0.02, 1.4, 0.04); }); };

  // ----- The DOM -----
  let el = null;
  const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
  function build() {
    const s = document.createElement('section');
    s.className = 'rr';
    s.id = 'rocketRush';
    s.hidden = true;
    s.setAttribute('aria-label', 'Rocket Rush');
    s.innerHTML = `
      <div class="rr-screen rr-map" id="rrMap">
        <header class="diya-top">
          <button class="diya-icon" id="rrHome" type="button" aria-label="Home">${BACK}</button>
          <h2 class="diya-title">Rocket Rush</h2>
          <span class="diya-gems" aria-label="Gems">💎 <b data-gems></b></span>
        </header>
        <div class="diya-scroll">
          <p class="diya-lead">Launch every rocket in the right order, then save your sky to watch them all as fireworks.</p>
          <div class="diya-archive" id="rrArchive" hidden><b>Past days</b><div class="diya-archive-days" id="rrArchiveDays"></div></div>
          <button class="diya-daily rr-daily" id="rrDaily" type="button"><b>Daily Rocket</b><small id="rrDailyNote"></small><span class="diya-daily-go" id="rrDailyGo"></span></button>
          <div id="rrWorlds"></div>
        </div>
      </div>
      <div class="rr-screen rr-play" id="rrPlay" hidden>
        <header class="diya-top">
          <button class="diya-icon" id="rrBack" type="button" aria-label="Levels">${BACK}</button>
          <h2 class="diya-title" id="rrLevelName"></h2>
          <span class="rr-fuses" id="rrFuses" aria-label="Fuses"><i></i><i></i><i></i></span>
        </header>
        <p class="diya-tip" id="rrTip"></p>
        <p class="rr-stat"><span id="rrWave"></span><b id="rrScore"></b><span class="rr-time"><span class="rr-clock" id="rrClock" data-no-i18n></span><span id="rrPar"></span></span></p>
        <div class="diya-board rr-board" id="rrBoard"><canvas id="rrCanvas"></canvas><p class="rr-chain" id="rrChain" hidden></p><p class="rr-banner" id="rrBanner" hidden></p></div>
        <div class="diya-tools">
          <button class="diya-tool" id="rrRestart" type="button"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 3.5v5.1h5.1"/></svg>Restart</button>
          <button class="diya-tool" id="rrHint" type="button"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>Hint <em id="rrHints"></em></button>
        </div>
      </div>
      <div class="diya-result" id="rrResult" hidden>
        <div class="diya-result-box">
          <p class="diya-kicker" id="rrResKicker"></p>
          <h2 id="rrResTitle"></h2>
          <p class="diya-res-stars" id="rrResStars" aria-hidden="true"></p>
          <p class="diya-res-line" id="rrResLine"></p>
          <p class="diya-res-gems"><span id="rrResGain"></span> <span id="rrResStreak"></span></p>
          <div class="diya-chest" id="rrChest" hidden><span id="rrChestText"></span><button class="btn ghost small" id="rrChestDouble" type="button">Watch a video · double it</button></div>
          <div class="diya-res-actions">
            <button class="btn primary" id="rrNext" type="button">Next level</button>
            <button class="btn ghost" id="rrLevels" type="button">Map</button>
            <div class="rr-res-share">
              <button class="btn ghost" id="rrSave" type="button">Save my sky</button>
              <button class="btn ghost" id="rrShareVideo" type="button">Share video</button>
            </div>
            <button class="btn ghost" id="rrAgain" type="button">Play again</button>
          </div>
          <button class="diya-upsell" id="rrResPremium" type="button" hidden><span aria-hidden="true">👑</span>Unlock all 1000 levels with Premium</button>
        </div>
      </div>
      <div class="diya-hintbox" id="rrHintBox" hidden>
        <div class="diya-result-box">
          <h2>Out of hints</h2>
          <p class="diya-res-line">Three hints come back every day.</p>
          <div class="diya-res-actions">
            <button class="btn primary diya-gem-hint" id="rrHintGems" type="button"></button>
            <button class="btn ghost" id="rrHintVideo" type="button">Watch a video · +2 hints</button>
            <button class="diya-upsell" id="rrHintPremium" type="button"><span aria-hidden="true">👑</span>Unlimited hints with Premium</button>
            <button class="btn ghost" id="rrHintClose" type="button">Not now</button>
          </div>
        </div>
      </div>
      <div class="diya-skip rr-skip" id="rrSkip" hidden><button class="rr-skip-btn" id="rrSkipBtn" type="button">Skip</button><p>Tap to speed up</p></div>`;
    document.body.append(s);
    el = {
      root: s, map: $('#rrMap'), play: $('#rrPlay'), worlds: $('#rrWorlds'), canvas: $('#rrCanvas'), board: $('#rrBoard'),
      result: $('#rrResult'), hintBox: $('#rrHintBox'), skip: $('#rrSkip'), chain: $('#rrChain'), banner: $('#rrBanner'),
    };
    $('#rrHome').addEventListener('click', close);
    $('#rrBack').addEventListener('click', () => showMap());
    $('#rrDaily').addEventListener('click', () => play(daily()));
    $('#rrRestart').addEventListener('click', () => { if (run && !run.over) play(current); });
    $('#rrHint').addEventListener('click', useHint);
    $('#rrHintVideo').addEventListener('click', hintVideo);
    $('#rrHintClose').addEventListener('click', () => { el.hintBox.hidden = true; });
    $('#rrHintGems').addEventListener('click', () => {
      const g = game();
      el.hintBox.hidden = true;
      if (!g || !g.buyHint()) return; // short of gems: the shop is open
      prog.hints += 1; save(); useHint();
    });
    $('#rrHintPremium').addEventListener('click', () => { el.hintBox.hidden = true; if (game()) game().openPremium({ hints: true }); });
    $('#rrResPremium').addEventListener('click', () => { if (game()) game().openPremium({ levels: true }); });
    $('#rrChestDouble').addEventListener('click', async () => {
      const g = game(), btn = $('#rrChestDouble');
      if (!g || !award || !award.chest || btn.disabled) return;
      btn.disabled = true;
      if (await g.doubleChest(award.chest)) { $('#rrChestText').textContent = `🎁 Chest +${award.chest * 2}`; btn.hidden = true; } else btn.disabled = false;
    });
    $('#rrNext').addEventListener('click', () => { const nx = nextLevel(); if (nx) play(nx); else showMap(); });
    $('#rrSave').addEventListener('click', saveSky);
    $('#rrShareVideo').addEventListener('click', shareVideo);
    $('#rrAgain').addEventListener('click', () => play(current));
    $('#rrLevels').addEventListener('click', () => showMap());
    el.skip.addEventListener('pointerdown', (e) => { if (show && e.target.id !== 'rrSkipBtn') show.rate = 3; });
    // Skip: straight to the result (or, while saving the sky, the recording ends where it is)
    $('#rrSkipBtn').addEventListener('click', () => { if (show) { const d = show.done; show = null; d(); } });
    el.canvas.addEventListener('pointerdown', onDown);
    // The board takes the room the other rows leave, which changes with the window and with a translated tip's length.
    if (root.ResizeObserver) new ResizeObserver(() => { if (run && !el.play.hidden) layout(); }).observe(el.board);
    else root.addEventListener('resize', () => { if (run) layout(); });
  }

  // ----- The level map: Daily Rocket, then the worlds -----
  function showMap() {
    stopShow(); cancelFinale();
    el.play.hidden = true; el.result.hidden = true; el.hintBox.hidden = true; el.skip.hidden = true;
    el.root.classList.remove('showing');
    el.map.hidden = false;
    run = null;
    const dl = daily(), done = prog.daily[today()];
    $('#rrDailyNote').textContent = done ? `#${dl.no} · ${starText(done.s)} · come back tomorrow` : `#${dl.no} · a new board every day`;
    $('#rrDailyGo').textContent = done ? '✓' : '▶';
    $('#rrDaily').classList.toggle('done', !!done);
    renderArchive();
    renderWorlds();
  }
  // The last two weeks of daily boards: Premium plays any of them; for free players they open the Premium sheet.
  function renderArchive() {
    const box = $('#rrArchiveDays'), n = dayNo(), premium = isPremium();
    box.innerHTML = '';
    for (let k = n - 1; k >= Math.max(0, n - ARCHIVE_DAYS); k--) {
      const day = dayOf(k), d = prog.daily[day], b = document.createElement('button');
      b.type = 'button'; b.className = `diya-past${d ? ' won' : ''}${premium ? '' : ' premium-only'}`;
      b.innerHTML = '<b></b><small></small>';
      b.querySelector('b').textContent = `#${k + 1}`;
      b.querySelector('small').textContent = d ? starText(d.s) : premium ? '▶' : '👑';
      b.setAttribute('aria-label', `Daily Rocket #${k + 1}`);
      b.addEventListener('click', () => (isPremium() ? play(daily(day)) : game() && game().openPremium({ archive: true })));
      box.append(b);
    }
    $('#rrArchive').hidden = !box.children.length;
  }
  // Worlds of 100 levels fold: only the chosen one shows its levels (at first the newest open world, scrolled to the next
  // level to play). Tapping a world's title opens or folds it.
  let shownWorld = null; // null: pick the newest open world; -1: all folded
  function renderWorlds(scrollToNext = true) {
    const box = el.worlds;
    box.innerHTML = '';
    if (shownWorld === null) { shownWorld = 0; data.worlds.forEach((_, i) => { if (worldReached(i)) shownWorld = i; }); } // the player's own world, not a taster
    let next = null;
    data.worlds.forEach((wd, i) => {
      const open = worldOpen(i), shown = i === shownWorld, sec = document.createElement('section');
      sec.className = `diya-chapter rr-world${open ? '' : ' locked'}${shown ? ' shown' : ''}`;
      const head = document.createElement('button');
      head.type = 'button'; head.className = 'diya-chapter-head'; head.setAttribute('aria-expanded', String(shown));
      head.innerHTML = '<b></b><small></small><span></span><i aria-hidden="true"></i>';
      head.querySelector('b').textContent = WORLDS[wd.id] || wd.id;
      head.querySelector('small').textContent = wd.size;
      head.querySelector('span').textContent = `★ ${worldStars(wd)}/${wd.levels.length * 3}`;
      if (premiumWorld(i)) { const c = document.createElement('em'); c.className = 'diya-crown'; c.textContent = '👑'; c.title = 'Premium'; head.querySelector('b').after(c); }
      head.addEventListener('click', () => { shownWorld = shown ? -1 : i; renderWorlds(!shown); });
      sec.append(head);
      if (!open) {
        const p = document.createElement('p');
        p.className = 'diya-lock';
        p.textContent = `Collect ${unlockAt(data.worlds[i - 1])} stars in ${WORLDS[data.worlds[i - 1].id]} to open`;
        sec.append(p);
      } else if (premiumWorld(i) && !isPremium()) {
        const p = document.createElement('p');
        p.className = 'diya-lock';
        p.textContent = `First ${TASTER} levels free · all 100 with Premium`;
        sec.append(p);
      }
      box.append(sec);
      if (!shown || !open) return;
      const grid = document.createElement('div');
      grid.className = 'diya-levels';
      wd.levels.forEach((lv, j) => {
        const b = document.createElement('button'), st = prog.stars[lv.id] || 0, crown = premiumLocked(i, j), can = !crown && levelOpen(wd, j);
        b.type = 'button'; b.className = `diya-level${st ? ' won' : ''}${st === 3 ? ' gold' : ''}${lv.breather ? ' rr-breather' : ''}${crown ? ' premium-only' : ''}`;
        b.disabled = !can && !crown; // a crowned level opens the Premium sheet
        b.innerHTML = '<b></b><small></small>';
        b.querySelector('b').textContent = String(j + 1);
        b.querySelector('small').textContent = crown ? '👑' : can ? starText(st) : '🔒';
        b.setAttribute('aria-label', `Level ${j + 1}`);
        b.addEventListener('click', () => (crown ? game() && game().openPremium({ levels: true }) : play({ ...lv, world: i, index: j })));
        if (can && !st && !next) next = b;
        grid.append(b);
      });
      sec.append(grid);
    });
    if (scrollToNext && next) requestAnimationFrame(() => next.scrollIntoView({ block: 'center' }));
  }
  function nextLevel() {
    if (!current || current.daily) return null;
    const wd = data.worlds[current.world];
    if (current.index + 1 < wd.levels.length) return premiumLocked(current.world, current.index + 1) ? null : { ...wd.levels[current.index + 1], world: current.world, index: current.index + 1 };
    if (current.world + 1 < data.worlds.length && worldOpen(current.world + 1)) return { ...data.worlds[current.world + 1].levels[0], world: current.world + 1, index: 0 };
    return null;
  }

  // ----- Playing a level -----
  // fly: rockets on their way out; shake: a blocked rocket; slide: the next wave coming in (0 → 1).
  let run = null, current = null, cell = 0, ox = 0, oy = 0, side = 0, dpr = 1, raf = 0, last = 0, secs = 0;
  let fly = [], shakes = [], sparks = [], smoke = [], hintAt = -1, hintId = -1, slide = null, award = null, chainTimer = 0, bannerTimer = 0;
  function play(lv) {
    stopShow(); cancelFinale();
    if (!lv.daily) shownWorld = lv.world; // back on the map, this world stays open
    current = lv; run = new Run(lv); secs = 0;
    el.root.classList.remove('rr-clean'); replay = null;
    fly = []; shakes = []; sparks = []; smoke = []; hintId = -1; slide = null;
    el.map.hidden = true; el.result.hidden = true; el.hintBox.hidden = true; el.skip.hidden = true; el.chain.hidden = true; el.banner.hidden = true;
    el.root.classList.remove('showing');
    el.play.hidden = false;
    $('#rrLevelName').textContent = levelName(lv);
    const tip = !lv.daily && lv.world === 0 && lv.index < TUTORIAL.length ? TUTORIAL[lv.index] : '';
    $('#rrTip').textContent = tip;
    $('#rrTip').hidden = !tip;
    layout();
    changed();
  }
  function layout() {
    if (!run) return;
    const cs = getComputedStyle(el.board), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    side = Math.max(120, Math.floor(Math.min(el.board.clientWidth - padX, el.board.clientHeight - padY)));
    dpr = Math.min(2.5, root.devicePixelRatio || 1);
    const cv = el.canvas;
    cv.style.width = cv.style.height = `${side}px`;
    cv.width = cv.height = Math.round(side * dpr);
    const b = run.board, n = Math.max(b.w, b.h), pad = side * 0.05;
    cell = (side - 2 * pad) / n;
    ox = (side - b.w * cell) / 2; oy = (side - b.h * cell) / 2;
  }
  // The clock beside the par: the very seconds the 3-star rule counts (secs), whole seconds so it changes once a second,
  // warm gold once past par, and still when the level ends (secs stops with it).
  let clockShown = -1;
  function showClock(force) {
    const n = Math.floor(secs);
    if (n === clockShown && !force) return;
    clockShown = n;
    const c = $('#rrClock');
    c.textContent = `⏱ ${n} s`;
    c.classList.toggle('over', !!current && secs > current.par);
  }
  function changed() {
    const r = run;
    $('#rrWave').textContent = r.waves > 1 ? `Wave ${r.waveNo + 1}/${r.waves}` : '';
    $('#rrScore').textContent = `Score ${r.score.toLocaleString('en-IN')}`;
    $('#rrPar').textContent = `Par ${current.par} s`;
    showClock(true);
    $('#rrHints').textContent = isPremium() ? '∞' : prog.hints > 0 ? String(prog.hints) : `💎${game() ? game().hintCost() : 10}`; // past the free ones, a hint costs gems
    [...$('#rrFuses').children].forEach((f, i) => f.classList.toggle('out', i >= r.fuses));
  }
  const cellAt = (e) => {
    const rc = el.canvas.getBoundingClientRect(), x = e.clientX - rc.left - ox, y = e.clientY - rc.top - oy;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), b = run.board;
    return cx < 0 || cy < 0 || cx >= b.w || cy >= b.h ? -1 : cy * b.w + cx;
  };
  function onDown(e) {
    if (finaleTimer) { endFinale(); return; } // a tap skips the win finale
    if (!run || run.over || slide) return;
    if (game()) game().resume();
    const id = run.board.at(cellAt(e));
    if (id < 0) return;
    e.preventDefault();
    tap(id);
  }
  // A tap on a rocket, from a finger or a test.
  function tap(id) {
    if (!run || run.over || slide) return null;
    const now = performance.now(), b = run.board, res = run.tap(id, now);
    if (!res) return null;
    const g = game();
    if (!res.ok) {
      shakes.push({ id, at: now, blockers: res.blockers });
      thud();
      if (g) g.buzz([40, 30, 40]);
      changed();
      if (res.fail) setTimeout(failed, 900);
      return res;
    }
    if (hintId === id) hintId = -1;
    const r = b.rockets[id];
    fly.push({ r, at: now, path: flightPath(b, r), boom: false, chain: res.chain });
    whoosh(res.chain, Math.max(-1, Math.min(1, cxOf(r.cells[0], b.w) / side * 2 - 1)));
    if (g) g.buzz(res.chain > 1 ? [20, 30, 30] : 18);
    if (res.chain > 1) popChain(res.chain, res.points);
    changed();
    // the last board: the win (or, in a Share video replay, the end of the replay); otherwise the next board
    if (res.waveClear) setTimeout(res.win ? (replay ? () => { if (replay) replay.done(); } : win) : replay ? nextWave : waveCleared, 700);
    return res;
  }
  function popChain(n, points) {
    const c = el.chain;
    c.textContent = `Chain ×${n} · +${points}`;
    c.hidden = false;
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    clearTimeout(chainTimer);
    chainTimer = setTimeout(() => { c.hidden = true; }, 1200);
  }
  function banner(text, ms = 1100) {
    el.banner.textContent = text;
    el.banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.banner.hidden = true; }, ms);
  }
  // A board cleared with more to come: its message, bursts in the rockets' colours across it and a short gold shower,
  // then the next board slides in.
  function waveCleared() {
    if (!run || !run.board.clear()) return;
    const no = run.waveNo + 1;
    banner(`Wave ${no} cleared!`, 1200);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!run || run.waveNo !== no - 1) return;
        const x = side * (0.18 + Math.random() * 0.64), y = side * (0.15 + Math.random() * 0.5);
        boom([x, y], (i * 3 + no) % COLOURS.length, 3);
        pop(x / side * 2 - 1, 0.55);
      }, i * 220);
    }
    for (let i = 0; i < 36; i++) {
      sparks.push({ x: Math.random() * side, y: -Math.random() * side * 0.25, vx: (Math.random() - 0.5) * cell * 0.4, vy: cell * (0.5 + Math.random()), life: 1.2 + Math.random() * 0.6, age: 0, col: Math.random() < 0.5 ? '#ffd27a' : '#fff3c4', r: 0.03, tw: true, drag: 0.6, grav: 0.6 });
    }
    const g = game();
    if (g) g.buzz([20, 40, 20]);
    setTimeout(nextWave, 1200);
  }
  // The next board slides in from the right.
  function nextWave() {
    if (!run || !run.board.clear()) return;
    slide = { at: performance.now(), swapped: false };
    banner(`Wave ${run.waveNo + 2}`);
  }
  function useHint() {
    if (!run || run.over || slide) return;
    const free = isPremium(); // Premium: unlimited hints
    if (!free && prog.hints <= 0) { openHintBox(); return; }
    const id = run.board.hint();
    if (id < 0) return;
    if (!free) { prog.hints--; save(); }
    hintId = id; hintAt = performance.now();
    changed();
  }
  function openHintBox() {
    const g = game(), left = HINT_VIDEOS_A_DAY - (prog.vids[today()] || 0), btn = $('#rrHintVideo');
    btn.hidden = !(g && g.videoReady());
    btn.disabled = left <= 0;
    btn.textContent = left <= 0 ? 'Videos are done for today' : `Watch a video · +${HINTS_PER_VIDEO} hints`;
    $('#rrHintPremium').hidden = !g;
    const gb = $('#rrHintGems'), cost = g ? g.hintCost() : 10, have = g ? g.gems() : 0;
    gb.hidden = !g;
    gb.textContent = have >= cost ? `Use 💎 ${cost} for a hint` : `Buy gems · a hint is 💎 ${cost}`;
    el.hintBox.hidden = false;
  }
  async function hintVideo() {
    const g = game(), btn = $('#rrHintVideo');
    if (!g || btn.disabled) return;
    btn.disabled = true;
    const ok = await g.watchVideo();
    if (ok) {
      prog.vids[today()] = (prog.vids[today()] || 0) + 1;
      prog.hints += HINTS_PER_VIDEO; save();
      el.hintBox.hidden = true;
      changed();
    } else btn.disabled = false;
  }

  // ----- The end of a level -----
  function failed() {
    award = { fail: true };
    showResult();
  }
  function win() {
    const r = run, stars = r.stars(secs), id = current.id, g = game();
    swell();
    if (g) g.buzz([30, 60, 30]);
    let had = 0, newBest = false;
    if (current.daily) {
      const d = prog.daily[current.day];
      had = d ? d.s : 0;
      prog.daily[current.day] = { s: Math.max(had, stars), p: d ? Math.max(d.p, r.score) : r.score };
      for (const k of Object.keys(prog.daily).sort().slice(0, -60)) delete prog.daily[k];
    } else had = prog.stars[id] || 0;
    if (!(prog.best[id] >= r.score)) { newBest = !!prog.best[id]; prog.best[id] = r.score; }
    if (!current.daily) prog.stars[id] = Math.max(had, stars);
    save();
    const rw = g ? g.reward({ stars, had, index: current.index || 0, daily: !!current.daily }) : { gain: 0, chest: 0 };
    award = { stars, gain: rw.gain, chest: rw.chest, newBest, streak: current.daily && current.day === today() && g ? g.markDaily(today(), 'rocket') : 0, launches: r.launches.slice() };
    if (current.daily && current.day === today() && g && g.dailyScore) g.dailyScore('rocket', r.score); // the Daily Rocket's leaderboard
    finale(stars);
  }
  // The level is won: the message and its stars over the board, bursts in the rockets' colours across it and a shower of
  // gold glitter, then the result. A tap on the board skips to it.
  let finaleTimer = 0;
  function finale(stars) {
    const title = stars === 3 ? 'Perfect sky!' : stars === 2 ? 'Flawless launch!' : 'Sky cleared!';
    const b = el.banner;
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = title;
    b.lastChild.textContent = starText(stars);
    b.classList.add('win');
    b.hidden = false;
    clearTimeout(bannerTimer);
    const n = 4 + stars * 2;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        if (!finaleTimer) return;
        const x = side * (0.15 + Math.random() * 0.7), y = side * (0.12 + Math.random() * 0.55);
        boom([x, y], (i * 2 + stars) % COLOURS.length, 3 + stars);
        pop(x / side * 2 - 1, 0.6 + stars * 0.15);
      }, 120 + i * (1500 / n));
    }
    for (let i = 0; i < 70; i++) { // glitter rain over the whole board
      sparks.push({ x: Math.random() * side, y: -Math.random() * side * 0.3, vx: (Math.random() - 0.5) * cell * 0.4, vy: cell * (0.5 + Math.random()), life: 1.6 + Math.random() * 0.8, age: 0, col: Math.random() < 0.5 ? '#ffd27a' : '#fff3c4', r: 0.03, tw: true, drag: 0.6, grav: 0.6 });
    }
    finaleTimer = setTimeout(endFinale, 2300);
  }
  function cancelFinale() {
    if (!finaleTimer) return false;
    clearTimeout(finaleTimer); finaleTimer = 0;
    el.banner.hidden = true; el.banner.classList.remove('win');
    return true;
  }
  function endFinale() { if (cancelFinale()) showResult(); }
  // replay: back from Save my sky, so no video break this time.
  function showResult(replay) {
    stopShow();
    el.root.classList.remove('showing');
    el.skip.hidden = true;
    const a = award, r = run;
    $('#rrResKicker').textContent = levelName(current);
    if (a.fail) {
      $('#rrResTitle').textContent = 'Out of fuses';
      $('#rrResStars').textContent = starText(0);
      $('#rrResLine').textContent = 'Three fuses burnt. Try a different order.';
      $('#rrResGain').textContent = ''; $('#rrResStreak').textContent = ''; $('#rrChest').hidden = true;
      $('#rrNext').hidden = true; $('#rrSave').hidden = true; $('#rrShareVideo').hidden = true;
      $('#rrAgain').textContent = 'Try again';
    } else {
      const { stars, gain, newBest, streak } = a;
      $('#rrResTitle').textContent = stars === 3 ? 'Perfect sky!' : stars === 2 ? 'Flawless launch!' : 'Sky cleared!';
      $('#rrResStars').textContent = starText(stars);
      $('#rrResLine').textContent = stars === 1 ? 'Clear it with no mistakes for 2 stars'
        : stars === 2 ? `No mistakes in under ${current.par} s for 3 stars` : newBest ? `New best: ${r.score.toLocaleString('en-IN')}`
        : r.bestChain > 1 ? `Cleared in ${Math.round(secs)} s · best chain ×${r.bestChain}` : `Cleared in ${Math.round(secs)} s`;
      $('#rrResGain').textContent = gain ? `💎 +${gain}` : '';
      const g = game();
      $('#rrChest').hidden = !a.chest;
      if (a.chest && !replay) { $('#rrChestText').textContent = `🎁 Chest +${a.chest}`; const d = $('#rrChestDouble'); d.disabled = false; d.hidden = !(g && g.videoReady()); }
      $('#rrResStreak').textContent = streak ? `🔥 ${streak}-day streak` : '';
      $('#rrNext').hidden = !nextLevel();
      $('#rrSave').hidden = false;
      $('#rrShareVideo').hidden = false;
      $('#rrAgain').textContent = 'Play again';
    }
    $('#rrResPremium').hidden = !game() || isPremium();
    el.result.hidden = false;
    $('#rrNext').hidden ? $('#rrAgain').focus() : $('#rrNext').focus();
    if (game() && !replay) game().adBreak(); // a video at this break, at most one every 2 minutes (the game decides); never mid-show
  }

  // ----- The finale: every launched rocket again, as a firework, in launch order -----
  let show = null;
  const showLength = (n, gap) => (n - 1) * gap + 2.8;
  function startShow(list, done) {
    const g = game();
    el.root.classList.add('showing');
    el.result.hidden = true;
    el.skip.hidden = false;
    const gap = Math.min(0.55, Math.max(0.2, 7 / Math.max(1, list.length)));
    show = { list, i: 0, t: 0, rate: 1, gap, done, end: showLength(list.length, gap) };
    if (!g) { const d = show.done; show = null; setTimeout(d, 300); }
  }
  function stopShow() { show = null; }
  function stepShow(dt) {
    const s = show, g = game();
    if (!s) return;
    s.t += dt * s.rate;
    while (s.i < s.list.length && s.t >= s.i * s.gap) {
      const l = s.list[s.i++], [c1, c2] = COLOURS[l.k % COLOURS.length];
      g.fire({ x: 0.1 + l.x * 0.8 + (Math.random() - 0.5) * 0.08, y: Math.random(), type: BURST[l.kind] || 'peony', c1, c2, size: 0.75 + 0.15 * Math.min(l.chain - 1, 4), fast: s.rate > 1 ? 1.6 : 1 });
    }
    if (s.i >= s.list.length && s.t >= (s.rate > 1 ? (s.list.length - 1) * s.gap + 1.6 : s.end)) { const d = s.done; show = null; d(); }
  }
  // Save my sky: the finale again, recorded with the game's recorder and handed to the share sheet.
  function saveSky() {
    const g = game();
    if (!g || !award || award.fail || show) return;
    let began = false, stop = null;
    const begin = () => { began = true; startShow(award.launches, () => { if (stop) stop(); showResult(true); }); };
    stop = g.recordSky(begin);
    if (!stop) return;
    // A screen recorder that never starts (permission declined) leaves the result where it was.
    setTimeout(() => { if (!began && !show && el.result.hidden) showResult(true); }, 8000);
  }

  // Share video: the level played again from the player's own launches, board by board, recorded with the game's
  // recorder (on the web it sees only the sky, so the board is drawn into each frame) and handed to the share sheet.
  // The result, stars and gems stay as they were.
  let replay = null;
  function shareVideo() {
    const g = game();
    if (!g || !g.recordSky || !award || award.fail || replay || show) return;
    const lv = current, saved = run, savedSecs = secs, list = award.launches.slice();
    let stop = null;
    const begin = () => {
      el.result.hidden = true;
      el.root.classList.add('rr-clean'); // no board panel on screen either (the app's recorder films the screen)
      run = new Run(lv); fly = []; shakes = []; sparks = []; smoke = []; hintId = -1; slide = null;
      layout(); changed();
      replay = {
        list, i: 0, t: -0.6,
        done: () => {
          replay = null;
          setTimeout(() => {
            el.root.classList.remove('rr-clean');
            if (stop) stop();
            if (current !== lv) return;
            run = saved; secs = savedSecs; fly = []; layout(); changed();
            showResult(true);
          }, 1400);
        },
      };
    };
    const layer = (cg, sx, sy) => { const r = el.canvas.getBoundingClientRect(); cg.drawImage(el.canvas, r.left * sx, r.top * sy, r.width * sx, r.height * sy); };
    stop = g.recordSky(begin, { caption: `🚀 I cleared ${levelName(lv)} in Rocket Rush ${starText(award.stars)}`, layer });
  }
  // One launch every 0.45 s, in the player's order; a launch from the next board waits for it to slide in.
  function stepReplay(dt) {
    const r = replay;
    if (!run || slide) return;
    r.t += dt;
    if (r.t < 0.45 || r.i >= r.list.length) return;
    const l = r.list[r.i];
    if (l.wave !== run.waveNo) return;
    r.t = 0; r.i++;
    tap(l.id);
  }

  // ----- Drawing -----
  const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; };
  const cxOf = (i, w) => ox + (i % w + 0.5) * cell, cyOf = (i, w) => oy + (((i / w) | 0) + 0.5) * cell;
  // A flying rocket's track: its own body, then its lane, then on past the edge until it's gone.
  function flightPath(b, r) {
    const pts = r.cells.map((i) => [cxOf(i, b.w), cyOf(i, b.w)]), [dx, dy] = DIRS[r.dir], [hx, hy] = pts[pts.length - 1];
    const beyond = r.lane.length + r.cells.length + 3;
    for (let k = 1; k <= beyond; k++) pts.push([hx + dx * k * cell, hy + dy * k * cell]);
    return pts;
  }
  const along = (pts, u) => {
    const i = Math.max(0, Math.min(pts.length - 2, Math.floor(u))), f = u - i, a = pts[i], b = pts[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (show) stepShow(dt);
    if (replay) stepReplay(dt);
    if (!run || el.play.hidden) return;
    if (!run.over && !slide && el.hintBox.hidden) secs += dt; // the clock runs while the board can be played
    showClock();
    const g = el.canvas.getContext('2d'), b = run.board;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, side, side);
    // The next wave: the cleared board slides off to the left, the new one in from the right.
    let shift = 0;
    if (slide) {
      const k = (now - slide.at) / 700;
      if (k >= 0.5 && !slide.swapped) { slide.swapped = true; run.nextWave(); layout(); changed(); fly = []; }
      shift = k < 0.5 ? -side * ease(k * 2) : side * (1 - ease((k - 0.5) * 2));
      if (k >= 1) { slide = null; shift = 0; }
    }
    g.save();
    g.translate(shift, 0);
    if (!replay) drawGrid(g, run.board); // a Share video shows the rockets, not the grid
    drawSmoke(g, dt);
    // The hinted rocket: its lane lit like a runway.
    if (hintId >= 0 && run.board.on(hintId)) {
      const r = run.board.rockets[hintId], p = 0.5 + 0.5 * Math.sin((now - hintAt) / 160);
      g.save();
      g.fillStyle = `rgba(255, 220, 130, ${0.12 + 0.12 * p})`;
      for (const c of r.lane) g.fillRect(ox + (c % b.w) * cell + 3, oy + ((c / b.w) | 0) * cell + 3, cell - 6, cell - 6);
      g.restore();
    }
    for (const r of run.board.rockets) {
      if (!run.board.on(r.id)) continue;
      const sh = shakes.find((s) => s.id === r.id && now - s.at < 450);
      let jx = 0, jy = 0, red = 0;
      if (sh) {
        const k = (now - sh.at) / 450, a = Math.sin(k * 40) * cell * 0.09 * (1 - k), [dx, dy] = DIRS[r.dir];
        jx = dx * a; jy = dy * a; red = 1 - k;
        // the rocket in the way flashes too
        g.save();
        g.fillStyle = `rgba(255, 60, 60, ${0.35 * (1 - k)})`;
        for (const o of sh.blockers) for (const c of run.board.rockets[o].cells) g.fillRect(ox + (c % b.w) * cell + 2, oy + ((c / b.w) | 0) * cell + 2, cell - 4, cell - 4);
        g.restore();
      }
      const pts = r.cells.map((i) => [cxOf(i, b.w) + jx, cyOf(i, b.w) + jy]);
      const glow = r.id === hintId ? 0.6 + 0.4 * Math.sin((now - hintAt) / 160) : 0;
      drawRocket(g, pts, r.k, red, glow, false, now);
      // the lit fuse sputters: now and then a tiny spark jumps off its tip
      if (!slide && Math.random() < dt * 4) {
        const [tx, ty] = pts[0], [qx, qy] = pts[1], m = Math.hypot(qx - tx, qy - ty) || 1, vx = (qx - tx) / m, vy = (qy - ty) / m;
        const fx = tx - vx * cell * 0.42 - vy * cell * 0.08, fy = ty - vy * cell * 0.42 + vx * cell * 0.08, a = Math.random() * Math.PI * 2, sp = cell * (0.6 + Math.random() * 1.2);
        sparks.push({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cell * 0.6, life: 0.18 + Math.random() * 0.22, age: 0, col: '#ff9a3c', r: 0.018, streak: 0.025 });
      }
    }
    // Rockets on their way: speeding up along the track, a burst of sparks as the nose leaves the board.
    for (let i = fly.length - 1; i >= 0; i--) {
      const f = fly[i], s = (now - f.at) / 1000, u = 7 * s + 22 * s * s, n = f.r.cells.length;
      if (u > f.path.length - n) { fly.splice(i, 1); continue; }
      const pts = [];
      for (let k = 0; k < n; k++) pts.push(along(f.path, u + k));
      drawRocket(g, pts, f.r.k, 0, 0, true, now);
      const edge = n - 1 + f.r.lane.length + 0.5;
      if (!f.boom && u + n - 1 >= edge) { f.boom = true; const at = along(f.path, edge); boom(at, f.r.k, f.chain); pop(at[0] / side * 2 - 1, 0.25 + Math.min(f.chain, 5) * 0.08); }
      exhaust(pts, f, dt);
    }
    g.restore();
    if (sparks.length > 520) sparks.splice(0, sparks.length - 520);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      const drag = 1 - Math.min(0.5, (p.drag ?? 2.2) * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += cell * (p.grav ?? 2) * dt;
      const t = p.age / p.life;
      // hot sparks cool: white, then gold, then their own colour; glitter twinkles
      const col = p.hot ? (t < 0.15 ? '#fffbe8' : t < 0.45 ? '#ffd27a' : p.col) : p.col;
      let a = 1 - t;
      if (p.tw) a *= Math.random() < 0.45 ? 1 : 0.15;
      if (p.glow) { // a soft light, not a disc
        const R = cell * p.r * (0.7 + t * 0.6), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        gr.addColorStop(0, rgba(col, 0.55 * a)); gr.addColorStop(0.35, rgba(col, 0.2 * a)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.fill();
      } else if (p.streak) {
        g.strokeStyle = rgba(col, a); g.lineWidth = Math.max(1, cell * p.r * 2); g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.streak, p.y - p.vy * p.streak); g.stroke();
      } else {
        g.fillStyle = rgba(col, a);
        g.beginPath(); g.arc(p.x, p.y, cell * p.r * (p.tw ? 1 : 1 - t * 0.5), 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) ** 3);
  // A burst on the board's edge, bigger for a chain: hot streaks in the rocket's colours, twinkling glitter, a puff of smoke.
  function boom([x, y], k, chain) {
    const [c1, c2] = COLOURS[k % COLOURS.length], c = Math.min(chain, 6), n = 22 + c * 10, v = cell * (3 + c * 0.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.25, s = v * (0.55 + Math.random() * 0.6);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.55 + Math.random() * 0.35, age: 0, col: i % 3 ? c1 : c2, r: 0.03 + c * 0.004, streak: 0.04, hot: true, drag: 2.6, grav: 1.4 });
    }
    for (let i = 0; i < 10 + c * 4; i++) {
      const a = Math.random() * Math.PI * 2, s = v * Math.random() * 0.5;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7 + Math.random() * 0.6, age: 0, col: '#fff3c4', r: 0.028, tw: true, drag: 3, grav: 0.8 });
    }
    sparks.push({ x, y, vx: 0, vy: 0, life: 0.25, age: 0, col: '#fff1c4', r: 0.6 + c * 0.08, grav: 0, glow: true }); // the flash
    for (let i = 0; i < 4; i++) puff(x, y, 0.35 + Math.random() * 0.2, 1.1);
  }
  // A rocket's exhaust: a stream of hot sparks spraying back from the tail, and a smoke trail.
  function exhaust(pts, f, dt) {
    const [tx, ty] = pts[0], [qx, qy] = pts[1], m = Math.hypot(qx - tx, qy - ty) || 1, vx = (qx - tx) / m, vy = (qy - ty) / m;
    const ex = tx - vx * cell * 0.45, ey = ty - vy * cell * 0.45, [c1] = COLOURS[f.r.k % COLOURS.length];
    if (!f.lit) { // ignition: a white flash and a cough of smoke where it stood
      f.lit = true;
      sparks.push({ x: ex, y: ey, vx: 0, vy: 0, life: 0.2, age: 0, col: '#ffe9b0', r: 0.45, grav: 0, glow: true });
      for (let i = 0; i < 3; i++) puff(ex, ey, 0.3, 0.9);
    }
    const count = Math.round(240 * dt) + 1;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.1, sp = cell * (4 + Math.random() * 5);
      const dx = -vx + -vy * spread, dy = -vy + vx * spread;
      sparks.push({ x: ex, y: ey, vx: dx * sp, vy: dy * sp, life: 0.3 + Math.random() * 0.35, age: 0, col: Math.random() < 0.35 ? c1 : '#ff8a2a', r: 0.025 + Math.random() * 0.02, streak: 0.05, hot: true, drag: 2.6, grav: 1.6 });
    }
    if (Math.random() < 0.7) puff(ex, ey, 0.18 + Math.random() * 0.12, 0.8);
    sparks.push({ x: ex, y: ey, vx: -vx * cell, vy: -vy * cell, life: 0.06, age: 0, col: '#ffb347', r: 0.3, grav: 0, glow: true });
  }
  // Smoke: soft grey puffs that drift up, swell and fade (drawn under the rockets).
  function puff(x, y, size, life) {
    smoke.push({ x: x + (Math.random() - 0.5) * cell * 0.15, y, vx: (Math.random() - 0.5) * cell * 0.3, vy: -cell * (0.2 + Math.random() * 0.3), r: cell * size, age: 0, life: life * (0.8 + Math.random() * 0.4) });
    if (smoke.length > 120) smoke.splice(0, smoke.length - 120);
  }
  function drawSmoke(g, dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt;
      if (p.age > p.life) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const t = p.age / p.life, r = p.r * (0.6 + t * 1.4);
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, `rgba(190, 180, 200, ${0.22 * (1 - t)})`); gr.addColorStop(1, 'rgba(190, 180, 200, 0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    }
  }
  function drawGrid(g, b) {
    g.save();
    for (let i = 0; i < b.w * b.h; i++) {
      const x = ox + (i % b.w) * cell, y = oy + ((i / b.w) | 0) * cell;
      g.fillStyle = 'rgba(255, 220, 160, 0.045)';
      roundRect(g, x + 2, y + 2, cell - 4, cell - 4, cell * 0.16); g.fill();
      g.fillStyle = 'rgba(255, 210, 122, 0.22)';
      g.beginPath(); g.arc(x + cell / 2, y + cell / 2, Math.max(1, cell * 0.035), 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255, 210, 122, 0.35)'; g.lineWidth = 1.2;
    roundRect(g, ox - 3, oy - 3, b.w * cell + 6, b.h * cell + 6, cell * 0.22); g.stroke();
    g.restore();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // A rocket: a slim twisted cord through its squares' centres (about a sixth of a square wide), a gold arrowhead that
  // stays inside the nose square, tiny fins and a fuse spark at the tail. Thin bodies leave dark tile around every
  // rocket, so a crowded board still reads at a glance.
  // The painted rocket (Google Flow): one horizontal sprite cut into a tail (stick, fuse, fins), a paper body and a gold
  // nose. Each colour gets its own body, the ivory paper tinted and the gold spiral kept, made once when it loads.
  const SPR = { img: null, bodies: [], tails: [], ready: false };
  const TAIL = [100, 0, 105, 111], BODY = [215, 29, 650, 54], NOSE = [870, 18, 113, 75], BODY_H = 54, BODY_Y = 55.5;
  function loadSprite() {
    if (SPR.img) return;
    const img = new Image();
    SPR.img = img;
    img.onload = () => {
      try {
        // a piece of the sprite in one colour: the ivory paper takes the colour, the gold keeps its own
        const tint = (rect, c1) => {
          const cv = document.createElement('canvas'), [sx, sy, w, h] = rect;
          cv.width = w; cv.height = h;
          const x = cv.getContext('2d');
          x.drawImage(img, sx, sy, w, h, 0, 0, w, h);
          const d = x.getImageData(0, 0, w, h), p = d.data, v = parseInt(c1.slice(1), 16), tr = v >> 16, tg = (v >> 8) & 255, tb = v & 255;
          for (let i = 0; i < p.length; i += 4) {
            const r = p[i], gg = p[i + 1], b = p[i + 2], hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
            if (!p[i + 3] || (hi > 0 && (hi - lo) / hi > 0.3)) continue; // the gold spiral, fins and fuse stay as painted
            const l = 0.35 + 0.75 * hi / 255; // shaded by the paper's light
            p[i] = Math.min(255, tr * l); p[i + 1] = Math.min(255, tg * l); p[i + 2] = Math.min(255, tb * l);
          }
          x.putImageData(d, 0, 0);
          return cv;
        };
        SPR.bodies = COLOURS.map(([c1]) => tint(BODY, c1));
        SPR.tails = COLOURS.map(([c1]) => tint(TAIL, c1));
        SPR.ready = true;
      } catch (e) { SPR.ready = false; /* a canvas that can't be read: the drawn rockets stay */ }
    };
    img.src = 'assets/rocket-rush/rocket.webp';
  }
  function drawSpriteRocket(g, pts, k, red, glow, flying, now) {
    const n = pts.length, s = (cell * 0.3) / BODY_H, img = SPR.img, body = SPR.bodies[k % SPR.bodies.length];
    const [hx, hy] = pts[n - 1], [px, py] = pts[n - 2], ux = (hx - px) / (Math.hypot(hx - px, hy - py) || 1), uy = (hy - py) / (Math.hypot(hx - px, hy - py) || 1);
    const [tx, ty] = pts[0], [qx, qy] = pts[1], vx = (qx - tx) / (Math.hypot(qx - tx, qy - ty) || 1), vy = (qy - ty) / (Math.hypot(qx - tx, qy - ty) || 1);
    const nb = cell * 0.18; // the nose's base sits a little behind the nose square's centre
    g.save();
    if (glow || flying) { g.shadowColor = glow ? '#ffe08a' : COLOURS[k % COLOURS.length][0]; g.shadowBlur = cell * (glow ? 0.5 * glow : 0.3); }
    // body: a straight piece of paper per run, from the tail to the nose's base
    const runs = pts.slice(0, n - 1).concat([[hx - ux * nb, hy - uy * nb]]);
    let used = 0;
    for (let i = 0; i < runs.length - 1; i++) {
      const [ax, ay] = runs[i], [bx, by] = runs[i + 1], len = Math.hypot(bx - ax, by - ay);
      if (len < 0.5) continue;
      const src = Math.min(BODY[2] - 1, len / s), sx = Math.min(used, BODY[2] - src);
      used = (used + src) % (BODY[2] * 0.6);
      g.save();
      g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax));
      g.drawImage(body, sx, 0, src, BODY_H, -1, -BODY_H * s / 2, len + 2, BODY_H * s);
      g.restore();
    }
    g.shadowBlur = 0;
    // a gold collar on every bend
    g.fillStyle = '#e8b64a'; g.strokeStyle = 'rgba(60, 30, 5, 0.6)'; g.lineWidth = 1;
    for (let i = 1; i < n - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx2, cy2] = pts[i + 1];
      if (Math.abs((bx - ax) * (cy2 - by) - (by - ay) * (cx2 - bx)) < 1) continue;
      g.beginPath(); g.arc(bx, by, BODY_H * s * 0.56, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (red) { g.globalCompositeOperation = 'source-atop'; g.strokeStyle = `rgba(255, 40, 40, ${0.7 * red})`; g.lineWidth = BODY_H * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, ty); for (const [x, y] of runs.slice(1)) g.lineTo(x, y); g.stroke(); g.globalCompositeOperation = 'source-over'; }
    // tail: fins, fuse and stick, reaching back out of the tail square
    g.save();
    g.translate(tx, ty); g.rotate(Math.atan2(vy, vx));
    g.drawImage(SPR.tails[k % SPR.tails.length], -TAIL[2] * s, -BODY_Y * s, TAIL[2] * s, TAIL[3] * s);
    g.restore();
    if (flying) {
      const fl = cell * (0.4 + 0.12 * Math.sin(now / 30)), ex = tx - vx * TAIL[2] * s * 0.6, ey = ty - vy * TAIL[2] * s * 0.6;
      const fg = g.createLinearGradient(ex, ey, ex - vx * fl, ey - vy * fl);
      fg.addColorStop(0, 'rgba(255,250,220,0.95)'); fg.addColorStop(0.5, 'rgba(255,190,80,0.8)'); fg.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = fg;
      g.beginPath(); g.moveTo(ex - vy * cell * 0.08, ey + vx * cell * 0.08); g.lineTo(ex - vx * fl, ey - vy * fl); g.lineTo(ex + vy * cell * 0.08, ey - vx * cell * 0.08); g.closePath(); g.fill();
    }
    // nose: the gold cone, base at the end of the body
    g.save();
    g.translate(hx - ux * nb, hy - uy * nb); g.rotate(Math.atan2(uy, ux));
    g.drawImage(img, NOSE[0], NOSE[1], NOSE[2], NOSE[3], 0, (NOSE[1] - BODY_Y) * s, NOSE[2] * s, NOSE[3] * s);
    g.restore();
    g.restore();
  }
  function drawRocket(g, pts, k, red, glow, flying, now) {
    if (SPR.ready) { drawSpriteRocket(g, pts, k, red, glow, flying, now); return; }
    const [c1, c2] = COLOURS[k % COLOURS.length], n = pts.length, wTube = Math.max(3, cell * 0.16);
    const [hx, hy] = pts[n - 1], [px, py] = pts[n - 2], L = Math.hypot(hx - px, hy - py) || 1, ux = (hx - px) / L, uy = (hy - py) / L;
    const nb = cell * 0.2, tip = cell * 0.2, half = cell * 0.22; // arrowhead: base behind the centre, tip ahead of it
    const trace = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(hx - ux * nb, hy - uy * nb); };
    const body = red ? mix(c1, '#ff2020', red) : c1;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (glow || flying) { g.shadowColor = glow ? '#ffe08a' : c1; g.shadowBlur = cell * (glow ? 0.5 * glow : 0.3); }
    g.strokeStyle = 'rgba(20, 8, 4, 0.8)'; g.lineWidth = wTube + 2.5; trace(); g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = body; g.lineWidth = wTube; trace(); g.stroke();
    // the twist: short light dashes along the cord
    g.setLineDash([wTube * 0.7, wTube * 0.9]); g.lineCap = 'butt';
    g.strokeStyle = rgba(c2, 0.75); g.lineWidth = wTube * 0.55; trace(); g.stroke();
    g.setLineDash([]); g.lineCap = 'round';
    // tail: two small fins
    const [tx, ty] = pts[0], [qx, qy] = pts[1], M = Math.hypot(qx - tx, qy - ty) || 1, vx = (qx - tx) / M, vy = (qy - ty) / M;
    g.fillStyle = mix(c1, '#40100a', 0.35);
    for (const sgn of [1, -1]) {
      g.beginPath();
      g.moveTo(tx + vx * cell * 0.1, ty + vy * cell * 0.1);
      g.lineTo(tx - vy * sgn * cell * 0.15 - vx * cell * 0.08, ty + vx * sgn * cell * 0.15 - vy * cell * 0.08);
      g.lineTo(tx - vx * cell * 0.06, ty - vy * cell * 0.06);
      g.closePath(); g.fill();
    }
    // a fuse spark at the tail, a flame when flying
    if (flying) {
      const fl = cell * (0.35 + 0.12 * Math.sin(now / 30));
      const fg = g.createLinearGradient(tx, ty, tx - vx * fl, ty - vy * fl);
      fg.addColorStop(0, 'rgba(255,250,220,0.95)'); fg.addColorStop(0.5, 'rgba(255,190,80,0.8)'); fg.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(tx - vy * wTube * 0.7, ty + vx * wTube * 0.7); g.lineTo(tx - vx * fl, ty - vy * fl); g.lineTo(tx + vy * wTube * 0.7, ty - vx * wTube * 0.7);
      g.closePath(); g.fill();
    } else {
      const p = 0.6 + 0.4 * Math.sin(now / 120 + k);
      g.fillStyle = `rgba(255, 220, 140, ${0.5 + 0.4 * p})`;
      g.beginPath(); g.arc(tx - vx * cell * 0.16, ty - vy * cell * 0.16, cell * (0.03 + 0.02 * p), 0, Math.PI * 2); g.fill();
    }
    // the arrowhead: gold, with the rocket's colour on its base
    const ng = g.createLinearGradient(hx - ux * nb, hy - uy * nb, hx + ux * tip, hy + uy * tip);
    ng.addColorStop(0, body); ng.addColorStop(0.35, '#fff3c4'); ng.addColorStop(1, '#ffb43a');
    g.fillStyle = ng; g.strokeStyle = 'rgba(20, 8, 4, 0.8)'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(hx + ux * tip, hy + uy * tip);
    g.lineTo(hx - ux * nb - uy * half, hy - uy * nb + ux * half);
    g.lineTo(hx - ux * nb * 0.55, hy - uy * nb * 0.55);
    g.lineTo(hx - ux * nb + uy * half, hy - uy * nb - ux * half);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  function mix(a, b, k) {
    const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), ch = (s) => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ----- Opening and closing -----
  async function open(isDaily) {
    if (!el) build();
    loadSprite();
    const g = game();
    prog = load();
    try { await levels(); } catch (e) { if (g) g.toast('Couldn’t load the puzzles. Try again.'); return; }
    if (g) { g.resume(); g.enter(); }
    el.root.hidden = false;
    document.body.classList.add('rr-open');
    for (const x of el.root.querySelectorAll('[data-gems]')) x.textContent = g ? g.gems().toLocaleString('en-IN') : '';
    if (isDaily) play(daily()); else showMap();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function close() {
    if (!el || el.root.hidden) return;
    stopShow(); cancelFinale();
    el.root.hidden = true;
    el.root.classList.remove('showing');
    document.body.classList.remove('rr-open');
    cancelAnimationFrame(raf); raf = 0;
    run = null;
    if (game()) game().leave();
    tile();
  }
  // Android Back: hint box, then the show (to the result), then the board or result, then the map, then home.
  api.back = () => {
    if (!el || el.root.hidden) return false;
    if (!el.hintBox.hidden) el.hintBox.hidden = true;
    else if (show) { const d = show.done; show = null; d(); }
    else if (finaleTimer) endFinale();
    else if (!el.play.hidden || !el.result.hidden) showMap();
    else close();
    return true;
  };
  api.open = open;
  api.close = close;
  api.run = () => run;
  api.tap = tap;
  // The home tile: today's board and the stars so far.
  function tile() {
    const note = $('#tileRocket');
    if (!note) return;
    prog = load();
    const done = !!prog.daily[today()], stars = Object.values(prog.stars).reduce((a, b) => a + b, 0);
    $('#btnRocket').classList.toggle('soon', !done && stars > 0);
    note.textContent = done ? `★ ${stars} · today’s rockets are up` : stars ? `★ ${stars} · today’s rockets are waiting` : 'Launch the rockets in the right order';
  }
  document.addEventListener('DOMContentLoaded', () => {
    const b = $('#btnRocket');
    if (b) b.addEventListener('click', () => open(false));
    tile();
    // A link to today's board: #rocket
    if (/^#rocket\b/.test(location.hash)) { if (game()) open(true); else root.addEventListener('luts:game', () => open(true), { once: true }); }
  });
  root.addEventListener('focus', () => { if (!el || el.root.hidden) tile(); });
  // Bought (or lost) Premium while the puzzle is open: redraw the locks and the hint count.
  root.addEventListener('luts:premium-changed', () => {
    if (!el || el.root.hidden || !data) return;
    if (!el.map.hidden) showMap();
    else if (run) { changed(); if (!el.result.hidden) $('#rrResPremium').hidden = isPremium(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
