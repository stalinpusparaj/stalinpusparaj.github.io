// Diya Path: a path puzzle. Each colour has two diyas; drag from one to the other to light the pair. Paths can't cross,
// a path dragged into another colour's path cuts it back, and dragging back over your own path shortens it. Light every
// pair to finish a level; fill every square too for a perfect one.
// The levels are made ahead of time by tools/diya-path-levels.cjs (each has exactly one solution that fills the grid)
// and loaded from assets/diya-path/levels.json. The game lends the sky, the wallet and the sounds through window.LUTSGame.
// The rules (Board) have no DOM, so the tests load this file in Node too.
(function (root) {
  'use strict';
  const LETTERS = 'abcdefghijkl';

  // ---------- The rules ----------
  class Board {
    constructor(level) {
      const n = level.size;
      this.level = level; this.n = n; this.N = n * n; this.k = level.pairs;
      this.ends = new Int8Array(this.N).fill(-1);
      this.endsOf = [];
      for (let c = 0; c < this.k; c++) this.endsOf.push([]);
      for (let i = 0; i < this.N; i++) {
        const ch = level.grid[i];
        if (ch !== '.') { const c = LETTERS.indexOf(ch); this.ends[i] = c; this.endsOf[c].push(i); }
      }
      this.restart();
    }
    restart() {
      this.paths = this.endsOf.map(() => []);
      this.history = [];
      this.moves = 0;
      this.drag = null;
    }
    adjacent(a, b) {
      const n = this.n;
      return (Math.abs(a - b) === 1 && ((a / n) | 0) === ((b / n) | 0)) || Math.abs(a - b) === n;
    }
    // The colour whose path covers a cell, or -1.
    owner(i) {
      for (let c = 0; c < this.k; c++) if (this.paths[c].includes(i)) return c;
      return -1;
    }
    connected(c) {
      const p = this.paths[c];
      return p.length > 1 && this.ends[p[0]] === c && this.ends[p[p.length - 1]] === c;
    }
    connectedCount() { let m = 0; for (let c = 0; c < this.k; c++) if (this.connected(c)) m++; return m; }
    // Cells on a drawn path (an endpoint on its own doesn't count).
    filled() {
      let m = 0;
      for (const p of this.paths) if (p.length > 1) m += p.length;
      return m;
    }
    fill() { return this.filled() / this.N; }
    complete() { return this.connectedCount() === this.k; }
    perfect() { return this.complete() && this.filled() === this.N; }
    stars() { return !this.complete() ? 0 : !this.perfect() ? 1 : this.moves <= this.k ? 3 : 2; }
    snapshot() { return this.paths.map((p) => p.slice()); }
    key(paths = this.paths) { return paths.map((p) => (p.length > 1 ? p.join(',') : '')).join('|'); } // a lone diya is no path

    // A drag starts on a diya (its path starts again from there) or on a path (it carries on from that cell).
    begin(i) {
      if (this.drag || i < 0 || i >= this.N) return false;
      let c = this.ends[i], path;
      if (c >= 0) path = [i];
      else {
        c = this.owner(i);
        if (c < 0) return false;
        const p = this.paths[c];
        path = p.slice(0, p.indexOf(i) + 1);
      }
      this.drag = { c, base: this.snapshot(), path };
      this.apply();
      return true;
    }
    // The dragged path is drawn on top: any other path it runs into is cut back to just before the crossing. The cut is
    // worked out from the paths as they were when the drag began, so pulling back during the same drag restores them.
    apply() {
      const { c, base, path } = this.drag, on = new Set(path);
      for (let o = 0; o < this.k; o++) {
        if (o === c) continue;
        const p = base[o], cut = p.findIndex((x) => on.has(x));
        this.paths[o] = cut < 0 ? p.slice() : p.slice(0, cut);
      }
      this.paths[c] = path.slice();
    }
    // Drag to a cell: steps one square at a time towards it (a fast finger can skip squares). Returns true if it moved.
    move(i) {
      if (!this.drag || i < 0 || i >= this.N) return false;
      const n = this.n;
      let moved = false;
      for (let guard = 0; guard < 2 * n; guard++) {
        const head = this.drag.path[this.drag.path.length - 1];
        if (head === i) break;
        const hx = head % n, hy = (head / n) | 0, tx = i % n, ty = (i / n) | 0;
        // the longer way first, so a diagonal swipe becomes a staircase
        const dx = Math.sign(tx - hx), dy = Math.sign(ty - hy);
        const first = Math.abs(tx - hx) >= Math.abs(ty - hy) ? (dx ? head + dx : head + dy * n) : (dy ? head + dy * n : head + dx);
        const second = first === head + dx ? (dy ? head + dy * n : -1) : (dx ? head + dx : -1);
        if (this.step(first)) { moved = true; continue; }
        if (second >= 0 && this.step(second)) { moved = true; continue; }
        break;
      }
      return moved;
    }
    step(i) {
      const d = this.drag, p = d.path, head = p[p.length - 1];
      if (i < 0 || i >= this.N || !this.adjacent(head, i)) return false;
      const back = p.indexOf(i);
      if (back >= 0) { p.length = back + 1; this.apply(); return true; } // back over your own path: shorten it
      if (p.length > 1 && this.ends[head] === d.c) return false; // already at the other diya
      const e = this.ends[i];
      if (e >= 0 && e !== d.c) return false; // another colour's diya blocks the way
      p.push(i);
      this.apply();
      return true;
    }
    // The drag ends: one move if it changed the board.
    end() {
      if (!this.drag) return false;
      const d = this.drag;
      this.drag = null;
      const changed = this.key() !== this.key(d.base);
      if (changed) { this.history.push(d.base); this.moves++; }
      return changed;
    }
    undo() {
      if (this.drag || !this.history.length) return false;
      this.paths = this.history.pop();
      return true;
    }
    // The solved path of a colour, from its first diya to its second.
    solutionPath(c) {
      const sol = this.level.sol, ch = LETTERS[c], [a, b] = this.endsOf[c];
      const cells = new Set();
      for (let i = 0; i < this.N; i++) if (sol[i] === ch) cells.add(i);
      const path = [a], seen = new Set([a]);
      const nbr = (i) => [i - this.n, i + 1, i + this.n, i - 1].filter((j) => cells.has(j) && this.adjacent(i, j));
      const dfs = (i) => {
        if (i === b) return path.length === cells.size;
        for (const j of nbr(i)) {
          if (seen.has(j)) continue;
          seen.add(j); path.push(j);
          if (dfs(j)) return true;
          seen.delete(j); path.pop();
        }
        return false;
      };
      return dfs(a) ? path : null;
    }
    solved(c) {
      const s = this.solutionPath(c), p = this.paths[c];
      if (!s || p.length !== s.length) return false;
      return p.every((x, i) => x === s[i]) || p.every((x, i) => x === s[s.length - 1 - i]);
    }
    // Hint: lays one colour's whole correct path (the first one not already right). Returns the colour, or -1.
    hint() {
      if (this.drag) return -1;
      for (let c = 0; c < this.k; c++) {
        if (this.solved(c)) continue;
        const base = this.snapshot();
        this.drag = { c, base, path: this.solutionPath(c) };
        this.apply();
        this.drag = null;
        this.history.push(base);
        return c;
      }
      return -1;
    }
  }

  const api = { Board, LETTERS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.DiyaPath = api;
  api.back = () => false;
  if (typeof document === 'undefined') return;

  // ---------- The screens ----------
  // Colourblind-safe colours (Okabe–Ito, lifted for a night background) and four more for the 8×8 boards, each with its
  // own mark on the diya, so no pair depends on colour alone.
  const COLOURS = [
    { hex: '#f5a623', mark: 'circle' }, { hex: '#5cc0f2', mark: 'triangle' }, { hex: '#1fcf98', mark: 'square' },
    { hex: '#f2e64f', mark: 'diamond' }, { hex: '#4f8dff', mark: 'star' }, { hex: '#ff6a2a', mark: 'drop' },
    { hex: '#e58cc0', mark: 'moon' }, { hex: '#f4f1ea', mark: 'hex' }, { hex: '#2ad1c2', mark: 'heart' },
    { hex: '#a77bff', mark: 'cross' }, { hex: '#a8e04a', mark: 'lotus' }, { hex: '#b9c3d3', mark: 'spiral' },
  ];
  const CHAPTERS = { courtyard: 'Courtyard', garden: 'Garden', rangoli: 'Rangoli', lanterns: 'Lantern Lane', market: 'Market',
    temple: 'Temple', ghat: 'River Ghat', palace: 'Palace', fort: 'Fort', festival: 'Festival of Lights' };
  // "Courtyard 3": each language has its own "<chapter> {0}" phrase, so it can put the number where it belongs.
  const levelName = (lv) => (lv.daily ? `Daily Diya #${lv.no}` : `${CHAPTERS[data.chapters[lv.chapter].id]} ${lv.index + 1}`);
  // Gems come from the game's shared puzzle rule (LUTSGame.reward). The last 3 chapters (8×8) are Premium; free players
  // can play their first 5 levels. Premium also opens every chapter now, gives unlimited hints and every past daily.
  const UNLOCK = 2 / 3, HINTS_A_DAY = 1, HINT_VIDEOS_A_DAY = 3, HINTS_PER_VIDEO = 2, PREMIUM_CHAPTERS = 3, TASTER = 5, ARCHIVE_DAYS = 14;
  const TUTORIAL = [
    'Drag from a diya to the diya of the same colour.',
    'Paths can’t cross. Fill every square for a perfect light.',
    'Drag back along a path to shorten it. Undo, Restart and Hint are below.',
  ];
  const KEY = 'luts:diya';
  const $ = (s) => document.querySelector(s);
  const t = (s) => (root.LUTSLang ? root.LUTSLang.t(s) : s);
  const game = () => root.LUTSGame || null;
  const today = () => (game() ? game().dayKey() : new Date().toISOString().slice(0, 10));

  function load() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
    if (!v || typeof v !== 'object') v = {};
    for (const k of ['stars', 'best', 'daily', 'vids']) v[k] = v[k] && typeof v[k] === 'object' ? v[k] : {};
    if (!Number.isFinite(v.hints)) v.hints = HINTS_A_DAY;
    // A free hint comes back every day; more cost gems (or a video, or Premium).
    if (v.hintDay !== today()) { v.hints = Math.max(v.hints, HINTS_A_DAY); v.hintDay = today(); for (const d of Object.keys(v.vids)) if (d !== today()) delete v.vids[d]; }
    return v;
  }
  let prog = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* storage full: progress stays for this visit */ } };

  let data = null, loading = null;
  function levels() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch('assets/diya-path/levels.json').then((r) => { if (!r.ok) throw Error(r.status); return r.json(); })
        .then((d) => { data = d; return d; }).catch((e) => { loading = null; throw e; });
    }
    return loading;
  }
  const chapterStars = (ch) => ch.levels.reduce((s, l) => s + (prog.stars[l.id] || 0), 0);
  // The next chapter opens at two thirds of the previous chapter's stars (200 of 300).
  const unlockAt = (ch) => Math.ceil(ch.levels.length * 3 * UNLOCK);
  const isPremium = () => !!(game() && game().premium());
  // Premium styles (Google Flow art): golden diyas and three royal boards. Without Premium the classic look shows.
  const STYLES = { diya: [['classic', 'Classic', false], ['gold', 'Golden', true]],
    board: [['kolam', 'Kolam', false], ['palace', 'Palace', true], ['ghat', 'River Ghat', true], ['temple', 'Temple', true]],
    // Devotional backgrounds behind the whole screen (assets/diya-path/gods): a sanctum view, the deity or altar above,
    // dark below the board.
    scene: [['night', 'Night', false], ['lakshmi', 'Lakshmi', true], ['kubera', 'Kubera', true], ['balaji', 'Balaji', true],
      ['ganesha', 'Ganesha', true], ['lakshmi-ganesha', 'Lakshmi Ganesha', true], ['golden-temple', 'Golden Temple', true],
      ['mahavira', 'Mahavira', true], ['buddha', 'Buddha', true], ['church', 'Church', true], ['mosque', 'Mosque', true]] };
  const styleOf = (kind) => { const pick = (prog.style || {})[kind], opt = STYLES[kind].find(([id]) => id === pick); return opt && (!opt[2] || isPremium()) ? pick : STYLES[kind][0][0]; };
  function applyStyle() {
    if (!el) return;
    el.root.dataset.board = styleOf('board');
    el.root.dataset.scene = styleOf('scene');
    el.root.dataset.diyas = styleOf('diya');
  }
  function renderStyle() {
    const box = $('#diyaStyle');
    box.innerHTML = '';
    for (const [kind, label] of [['diya', 'Diyas'], ['board', 'Board']]) box.append(styleRow(kind, label));
    // Backgrounds are picked in the puzzle itself, over the board they change
    const pick = $('#diyaBgPick');
    if (pick) { pick.innerHTML = ''; pick.append(styleRow('scene', 'Background')); }
  }
  function styleRow(kind, label) {
    {
      const row = document.createElement('div');
      row.className = 'diya-style-row';
      row.innerHTML = '<b></b><span></span>';
      row.querySelector('b').textContent = label;
      for (const [id, name, paid] of STYLES[kind]) {
        const b = document.createElement('button'), on = styleOf(kind) === id;
        b.type = 'button'; b.className = `chip${on ? ' active' : ''}${paid && !isPremium() ? ' premium-only' : ''}`;
        b.textContent = name;
        // Backgrounds show as pictures, the name under each
        if (kind === 'scene') {
          b.classList.add('diya-pic');
          const img = document.createElement('i');
          img.setAttribute('aria-hidden', 'true');
          if (id !== 'night') img.style.backgroundImage = `url("assets/diya-path/gods/thumbs/${id}.webp")`;
          b.prepend(img);
        }
        if (paid && !isPremium()) { const c = document.createElement('span'); c.className = 'diya-crown'; c.textContent = ' 👑'; c.setAttribute('aria-label', 'Premium'); b.append(c); }
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => {
          if (paid && !isPremium()) { if (kind === 'scene') previewScene(id, name); else if (game()) game().openPremium({ styles: true }); return; }
          prog.style = { ...(prog.style || {}), [kind]: id }; save();
          applyStyle(); renderStyle();
        });
        row.lastChild.append(b);
      }
      return row;
    }
  }
  // A free player's tap on a Premium background shows it behind the board for a few seconds, then the old one comes back
  // and Premium opens. Unlock opens it at once; another picture restarts the preview.
  const PREVIEW_S = 4;
  let previewTimer = 0;
  function previewScene(id, name) {
    clearInterval(previewTimer);
    el.root.dataset.scene = id;
    const bar = $('#diyaPreview');
    let left = PREVIEW_S;
    $('#diyaPreviewName').textContent = name;
    $('#diyaPreviewLeft').textContent = String(left);
    bar.hidden = false;
    previewTimer = setInterval(() => { left -= 1; if (left <= 0) endPreview(true); else $('#diyaPreviewLeft').textContent = String(left); }, 1000);
  }
  function endPreview(offer) {
    if (!previewTimer && $('#diyaPreview').hidden) return;
    clearInterval(previewTimer); previewTimer = 0;
    $('#diyaPreview').hidden = true;
    applyStyle();
    if (offer && game() && !isPremium()) game().openPremium({ scenes: true });
  }
  const premiumChapter = (i) => i >= data.chapters.length - PREMIUM_CHAPTERS;
  // Free players try the Premium chapters' first levels any time; the star gates still lead through the free chapters.
  const chapterReached = (i) => i === 0 || isPremium() || chapterStars(data.chapters[i - 1]) >= unlockAt(data.chapters[i - 1]);
  const chapterOpen = (i) => chapterReached(i) || premiumChapter(i);
  const premiumLocked = (i, j) => premiumChapter(i) && j >= TASTER && !isPremium();
  const levelOpen = (ch, j) => j === 0 || (prog.stars[ch.levels[j - 1].id] || 0) > 0;
  const startOf = () => (data ? data.from : '2026-10-25').split('-').map(Number);
  function dayNo(d = today()) {
    const [y, m, dd] = d.split('-').map(Number), [y0, m0, d0] = startOf();
    return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(y0, m0 - 1, d0)) / 864e5);
  }
  const dayOf = (n) => { const [y0, m0, d0] = startOf(); return new Date(Date.UTC(y0, m0 - 1, d0 + n)).toISOString().slice(0, 10); };
  // Today's puzzle, or a past day's (the archive is Premium).
  function dailyLevel(day = today()) {
    const n = dayNo(day), list = data.daily, lv = list[((n % list.length) + list.length) % list.length];
    return { ...lv, id: `daily-${day}`, daily: true, day, no: n + 1 };
  }

  // ----- Sound: a soft bell for each lit pair, a warm swell when the board is done -----
  const BELL = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  function tone(freq, at, dur, vol, type = 'sine') {
    const a = game() && game().audio();
    if (!a) return;
    const c = a.ctx, t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const chime = (c) => { tone(BELL[c % BELL.length], 0, 1.2, 0.22); tone(BELL[c % BELL.length] * 2, 0.01, 0.7, 0.07); };
  const swell = () => { [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => { tone(f, i * 0.09, 2.2, 0.12, 'triangle'); tone(f * 2, i * 0.09 + 0.02, 1.4, 0.04); }); };

  // ----- The DOM -----
  let el = null;
  function build() {
    const s = document.createElement('section');
    s.className = 'diya';
    s.id = 'diyaPath';
    s.hidden = true;
    s.setAttribute('aria-label', 'Diya Path');
    s.innerHTML = `
      <div class="diya-screen diya-map" id="diyaMap">
        <header class="diya-top">
          <button class="diya-icon" id="diyaHome" type="button" aria-label="Home"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <h2 class="diya-title">Diya Path</h2>
          <span class="diya-gems" aria-label="Gems">💎 <b data-gems></b></span>
        </header>
        <div class="diya-scroll">
          <p class="diya-lead">Join each pair of diyas with a path of light. Fill every square for a perfect sky.</p>
          <div class="diya-style" id="diyaStyle"></div>
          <div class="diya-archive" id="diyaArchive" hidden><b>Past days</b><div class="diya-archive-days" id="diyaArchiveDays"></div></div>
          <button class="diya-daily" id="diyaDaily" type="button"><b>Daily Diya</b><small id="diyaDailyNote"></small><span class="diya-daily-go" id="diyaDailyGo"></span></button>
          <div id="diyaChapters"></div>
        </div>
      </div>
      <div class="diya-screen diya-play" id="diyaPlay" hidden>
        <header class="diya-top">
          <button class="diya-icon" id="diyaBack" type="button" aria-label="Levels"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <h2 class="diya-title" id="diyaLevelName"></h2>
          <span class="diya-moves"><span id="diyaMoves"></span><small id="diyaBest"></small></span>
        </header>
        <p class="diya-tip" id="diyaTip"></p>
        <div class="diya-board" id="diyaBoard"><canvas class="diya-grid" id="diyaGrid" aria-hidden="true"></canvas><canvas id="diyaCanvas"></canvas></div>
        <p class="diya-stat"><span id="diyaPairs"></span> · <span id="diyaFill"></span></p>
        <div class="diya-ambient" id="diyaAmbient" aria-hidden="true"></div>
        <div class="diya-tools">
          <button class="diya-tool" id="diyaUndo" type="button"><svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/></svg>Undo</button>
          <button class="diya-tool" id="diyaRestart" type="button"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 3.5v5.1h5.1"/></svg>Restart</button>
          <button class="diya-tool" id="diyaHint" type="button"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>Hint <em id="diyaHints"></em></button>
          <button class="diya-tool diya-peek" id="diyaPeek" type="button" aria-pressed="false" aria-label="Show the picture" title="Show the picture"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="diya-tool" id="diyaBgBtn" type="button" aria-expanded="true" aria-controls="diyaBgPick"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/></svg>Background</button>
        </div>
        <div class="diya-bg-pick" id="diyaBgPick"></div>
        <div class="diya-preview" id="diyaPreview" role="status" hidden><span><b id="diyaPreviewName"></b> <small>Preview</small> <em id="diyaPreviewLeft"></em></span><button type="button" id="diyaPreviewUnlock">Unlock</button></div>
      </div>
      <div class="diya-result" id="diyaResult" hidden>
        <div class="diya-result-box">
          <button class="icon-btn diya-res-close" id="diyaResClose" type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <p class="diya-kicker" id="diyaResKicker"></p>
          <h2 id="diyaResTitle"></h2>
          <p class="diya-res-stars" id="diyaResStars" aria-hidden="true"></p>
          <p class="diya-res-line" id="diyaResLine"></p>
          <p class="diya-res-gems"><span id="diyaResGain"></span> <span id="diyaResStreak"></span></p>
          <div class="diya-chest" id="diyaChest" hidden><span id="diyaChestText"></span><button class="btn ghost small" id="diyaChestDouble" type="button">Watch a video · double it</button></div>
          <div class="diya-res-actions">
            <button class="btn primary" id="diyaNext" type="button">Next level</button>
            <button class="btn ghost" id="diyaLevels" type="button">Map</button>
            <div class="diya-res-share">
              <button class="btn ghost" id="diyaShare" type="button">Share</button>
              <button class="btn ghost" id="diyaShareVideo" type="button">Share video</button>
              <button class="btn primary" id="diyaChallenge" type="button">Challenge a friend</button>
            </div>
            <button class="btn ghost" id="diyaAgain" type="button">Play again</button>
          </div>
          <button class="diya-upsell" id="diyaResPremium" type="button" hidden><span aria-hidden="true">👑</span>Unlock all 1000 levels with Premium</button>
        </div>
      </div>
      <div class="diya-hintbox" id="diyaHintBox" hidden>
        <div class="diya-result-box">
          <button class="icon-btn diya-res-close" id="diyaHintX" type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <h2>Out of hints</h2>
          <p class="diya-res-line">A free hint comes back every day.</p>
          <div class="diya-res-actions">
            <button class="btn primary diya-gem-hint" id="diyaHintGems" type="button"></button>
            <button class="btn ghost" id="diyaHintVideo" type="button">Watch a video · +2 hints</button>
            <button class="diya-upsell" id="diyaHintPremium" type="button"><span aria-hidden="true">👑</span>Unlimited hints with Premium</button>
            <button class="btn ghost" id="diyaHintClose" type="button">Not now</button>
          </div>
        </div>
      </div>
      <div class="diya-skip" id="diyaSkip" hidden></div>`;
    document.body.append(s);
    el = {
      root: s, map: $('#diyaMap'), play: $('#diyaPlay'), chapters: $('#diyaChapters'), canvas: $('#diyaCanvas'), board: $('#diyaBoard'),
      result: $('#diyaResult'), hintBox: $('#diyaHintBox'), skip: $('#diyaSkip'), ambient: $('#diyaAmbient'),
    };
    for (let i = 0; i < 9; i++) el.ambient.append(document.createElement('i'));
    $('#diyaHome').addEventListener('click', close);
    $('#diyaBack').addEventListener('click', () => showMap());
    $('#diyaDaily').addEventListener('click', () => play(dailyLevel()));
    $('#diyaUndo').addEventListener('click', () => { if (board && board.undo()) changed(); });
    $('#diyaRestart').addEventListener('click', () => { if (board) { board.restart(); changed(); } });
    $('#diyaHint').addEventListener('click', useHint);
    // The eye fades the board down so the picture behind it shows: a tap turns it on or off, holding it peeks until
    // the finger lifts.
    const peekBtn = $('#diyaPeek');
    let peekDown = 0, peekWas = false;
    peekBtn.addEventListener('pointerdown', () => { peekDown = performance.now(); peekWas = peeking(); setPeek(true); });
    peekBtn.addEventListener('pointerup', () => { if (!peekDown) return; setPeek(performance.now() - peekDown > 350 ? false : !peekWas); peekDown = 0; });
    peekBtn.addEventListener('pointercancel', () => { if (peekDown) { setPeek(peekWas); peekDown = 0; } });
    peekBtn.addEventListener('click', (e) => { if (e.detail === 0) setPeek(!peeking()); }); // keyboard
    $('#diyaPreviewUnlock').addEventListener('click', () => endPreview(true));
    $('#diyaBgBtn').addEventListener('click', () => {
      const pick = $('#diyaBgPick'), open = pick.hidden;
      pick.hidden = !open; $('#diyaBgBtn').setAttribute('aria-expanded', String(open));
      if (open) { const on = pick.querySelector('.chip.active'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    });
    $('#diyaHintVideo').addEventListener('click', hintVideo);
    $('#diyaHintClose').addEventListener('click', () => { el.hintBox.hidden = true; });
    $('#diyaHintX').addEventListener('click', () => { el.hintBox.hidden = true; });
    $('#diyaHintGems').addEventListener('click', () => {
      const g = game();
      el.hintBox.hidden = true;
      if (!g || !g.buyHint()) return; // short of gems: the shop is open
      prog.hints += 1; save(); useHint();
    });
    $('#diyaHintPremium').addEventListener('click', () => { el.hintBox.hidden = true; if (game()) game().openPremium({ hints: true }); });
    $('#diyaResPremium').addEventListener('click', () => { if (game()) game().openPremium({ levels: true }); });
    $('#diyaChestDouble').addEventListener('click', async () => {
      const g = game(), btn = $('#diyaChestDouble');
      if (!g || !award || !award.chest || btn.disabled) return;
      btn.disabled = true;
      if (await g.doubleChest(award.chest)) { $('#diyaChestText').textContent = `🎁 Chest +${award.chest * 2}`; btn.hidden = true; } else btn.disabled = false;
    });
    $('#diyaNext').addEventListener('click', () => { const nx = nextLevel(); if (nx) play(nx); else showMap(); });
    $('#diyaAgain').addEventListener('click', () => play(current));
    $('#diyaLevels').addEventListener('click', () => showMap());
    // Close: the card steps aside to show the lit board; a tap on the board brings it back.
    $('#diyaResClose').addEventListener('click', () => { el.result.hidden = true; });
    $('#diyaShare').addEventListener('click', shareLevel);
    $('#diyaShareVideo').addEventListener('click', shareVideo);
    $('#diyaChallenge').addEventListener('click', shareChallenge);
    el.skip.addEventListener('pointerdown', () => { if (showTimer) { clearTimeout(showTimer); showTimer = 0; showResult(); } });
    const cv = el.canvas;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    // The board takes the room the other rows leave, which changes with the window and with a translated tip's length.
    if (root.ResizeObserver) new ResizeObserver(() => { if (board && !el.play.hidden) layout(); }).observe(el.board);
    else root.addEventListener('resize', () => { if (board) layout(); });
  }

  // ----- The level map: Daily Diya, then the chapters -----
  function showMap() {
    endPreview(false);
    el.play.hidden = true; el.result.hidden = true; el.hintBox.hidden = true;
    el.map.hidden = false;
    board = null;
    const dl = dailyLevel(), done = prog.daily[today()];
    $('#diyaDailyNote').textContent = done ? `#${dl.no} · ${starText(done.s)} · come back tomorrow` : `#${dl.no} · a new puzzle every day`;
    $('#diyaDailyGo').textContent = done ? '✓' : '▶';
    $('#diyaDaily').classList.toggle('done', !!done);
    applyStyle();
    renderStyle();
    renderArchive();
    renderChapters();
  }
  // The last two weeks of daily puzzles: Premium plays any of them; for free players they open the Premium sheet.
  function renderArchive() {
    const box = $('#diyaArchiveDays'), n = dayNo(), premium = isPremium();
    box.innerHTML = '';
    for (let k = n - 1; k >= Math.max(0, n - ARCHIVE_DAYS); k--) {
      const day = dayOf(k), d = prog.daily[day], b = document.createElement('button');
      b.type = 'button'; b.className = `diya-past${d ? ' won' : ''}${premium ? '' : ' premium-only'}`;
      b.innerHTML = '<b></b><small></small>';
      b.querySelector('b').textContent = `#${k + 1}`;
      b.querySelector('small').textContent = d ? starText(d.s) : premium ? '▶' : '👑';
      b.setAttribute('aria-label', `Daily Diya #${k + 1}`);
      b.addEventListener('click', () => (isPremium() ? play(dailyLevel(day)) : game() && game().openPremium({ archive: true })));
      box.append(b);
    }
    $('#diyaArchive').hidden = !box.children.length;
  }
  // Chapters of 100 levels fold: only the chosen one shows its levels (at first the newest open chapter, scrolled to the
  // next level to play). Tapping a chapter's title opens or folds it.
  let shownChapter = null; // null: pick the newest open chapter; -1: all folded
  function renderChapters(scrollToNext = true) {
    const box = el.chapters;
    box.innerHTML = '';
    if (shownChapter === null) { shownChapter = 0; data.chapters.forEach((_, i) => { if (chapterReached(i)) shownChapter = i; }); } // the player's own chapter, not a taster
    let next = null;
    data.chapters.forEach((ch, i) => {
      const open = chapterOpen(i), shown = i === shownChapter, sec = document.createElement('section');
      sec.className = `diya-chapter${open ? '' : ' locked'}${shown ? ' shown' : ''}`;
      const head = document.createElement('button');
      head.type = 'button'; head.className = 'diya-chapter-head'; head.setAttribute('aria-expanded', String(shown));
      head.innerHTML = '<b></b><small></small><span></span><i aria-hidden="true"></i>';
      head.querySelector('b').textContent = CHAPTERS[ch.id] || ch.id;
      head.querySelector('small').textContent = `${ch.size}×${ch.size}`;
      head.querySelector('span').textContent = `★ ${chapterStars(ch)}/${ch.levels.length * 3}`;
      if (premiumChapter(i)) { const c = document.createElement('em'); c.className = 'diya-crown'; c.textContent = '👑'; c.title = 'Premium'; head.querySelector('b').after(c); }
      head.addEventListener('click', () => { shownChapter = shown ? -1 : i; renderChapters(!shown); });
      sec.append(head);
      if (!open) {
        const p = document.createElement('p');
        p.className = 'diya-lock';
        p.textContent = `Collect ${unlockAt(data.chapters[i - 1])} stars in ${CHAPTERS[data.chapters[i - 1].id]} to open`;
        sec.append(p);
      } else if (premiumChapter(i) && !isPremium()) {
        const p = document.createElement('p');
        p.className = 'diya-lock';
        p.textContent = `First ${TASTER} levels free · all 100 with Premium`;
        sec.append(p);
      }
      box.append(sec);
      if (!shown || !open) return;
      const grid = document.createElement('div');
      grid.className = 'diya-levels';
      ch.levels.forEach((lv, j) => {
        const b = document.createElement('button'), st = prog.stars[lv.id] || 0, crown = premiumLocked(i, j), can = open && !crown && levelOpen(ch, j);
        b.type = 'button'; b.className = `diya-level${st ? ' won' : ''}${st === 3 ? ' gold' : ''}${crown ? ' premium-only' : ''}`;
        b.disabled = !can && !crown; // a crowned level opens the Premium sheet
        b.innerHTML = '<b></b><small></small>';
        b.querySelector('b').textContent = String(j + 1);
        b.querySelector('small').textContent = crown ? '👑' : can ? starText(st) : '🔒';
        b.setAttribute('aria-label', `Level ${j + 1}`);
        b.addEventListener('click', () => (crown ? game() && game().openPremium({ levels: true }) : play({ ...lv, chapter: i, index: j })));
        if (can && !st && !next) next = b;
        grid.append(b);
      });
      sec.append(grid);
    });
    if (scrollToNext && next) requestAnimationFrame(() => next.scrollIntoView({ block: 'center' }));
  }
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  function nextLevel() {
    if (!current || current.daily) return null;
    const ch = data.chapters[current.chapter];
    if (current.index + 1 < ch.levels.length) return premiumLocked(current.chapter, current.index + 1) ? null : { ...ch.levels[current.index + 1], chapter: current.chapter, index: current.index + 1 };
    if (current.chapter + 1 < data.chapters.length && chapterOpen(current.chapter + 1)) return { ...data.chapters[current.chapter + 1].levels[0], chapter: current.chapter + 1, index: 0 };
    return null;
  }

  // ----- Playing a level -----
  let board = null, current = null, cell = 0, ox = 0, oy = 0, dpr = 1, raf = 0, last = 0, sparks = [], glowAt = [], finished = false, showTimer = 0;
  // ----- Challenge a friend: a link with this level (or this day's Daily Diya) and your moves; it opens the same board
  // for them with your moves to beat (in the app; the web sends to Google Play). -----
  let vs = null; // { id, n, m, day } a friend's challenge being played
  function shareChallenge() {
    const D = root.LUTSDuel;
    if (!D || !board || !current) return;
    const name = D.savedName(), m = board.moves;
    const link = D.link(`dpvs=${D.encode({ n: name, id: current.id, d: current.daily ? current.day : '', m })}`);
    const text = `🪔 I lit ${levelName(current)} in ${m} moves in Diya Path. Can you do it in fewer? Same board:`;
    const blob = D.card({ art: 'assets/menu/diya-path.png', kicker: name ? `${name} challenges you` : 'Diya Path challenge', title: levelName(current), big: `${m} moves`, line: 'Diya Path · same board' });
    D.share({ title: 'Diya Path challenge', text, url: link, blob, name: 'diya-path-challenge.png', src: 'dpvs' });
  }
  function readVs() {
    const mm = location.hash.match(/dpvs=([A-Za-z0-9_-]+)/);
    if (!mm) return null;
    try {
      let b = mm[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))));
      const m = Math.round(+v.m);
      if (!(m > 0 && m < 1000) || typeof v.id !== 'string') return null;
      return { id: v.id.slice(0, 40), day: /^\d{4}-\d{2}-\d{2}$/.test(v.d) ? v.d : '', n: String(v.n || '').slice(0, 20), m };
    } catch (e) { return null; }
  }
  async function openVs() {
    const v = readVs(), D = root.LUTSDuel;
    if (!v) return;
    if (D && !D.native()) { D.toApp('dpvs'); return; }
    history.replaceState(null, '', location.pathname + location.search);
    await open(false);
    if (!data) return;
    let lv = null;
    if (v.day) lv = dailyLevel(v.day);
    else data.chapters.forEach((ch, i) => ch.levels.forEach((l, j) => { if (l.id === v.id) lv = { ...l, chapter: i, index: j }; }));
    if (!lv) { if (game()) game().toast('That level isn’t here. Update the app'); return; }
    vs = { ...v, id: lv.id };
    play(lv);
  }
  if (root.addEventListener) {
    root.addEventListener('hashchange', () => { if (/dpvs=/.test(location.hash)) openVs(); });
    if (/dpvs=/.test(location.hash)) { const wait = () => (root.LUTSGame && root.LUTSDuel ? openVs() : setTimeout(wait, 300)); setTimeout(wait, 800); }
  }
  function play(lv) {
    if (!lv.daily) shownChapter = lv.chapter; // back on the map, this chapter stays open
    current = lv; board = new Board(lv); finished = false; startedAt = Date.now(); replay = null;
    el.root.classList.remove('diya-clean');
    setPeek(false);
    startClip();
    sparks = []; glowAt = new Array(lv.pairs).fill(-9);
    el.map.hidden = true; el.result.hidden = true; el.hintBox.hidden = true; el.skip.hidden = true;
    el.root.classList.remove('showing');
    el.play.hidden = false;
    $('#diyaLevelName').textContent = levelName(lv);
    const dare = vs && vs.id === lv.id ? `Beat ${vs.n || 'your friend'}: ${vs.m} moves` : ''; // (a friend's challenge)
    const tip = dare || (!lv.daily && lv.chapter === 0 && lv.index < TUTORIAL.length ? TUTORIAL[lv.index] : '');
    $('#diyaTip').textContent = tip;
    $('#diyaTip').hidden = !tip;
    layout();
    changed();
  }
  function layout() {
    const cs = getComputedStyle(el.board), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const side = Math.max(120, Math.floor(Math.min(el.board.clientWidth - padX, el.board.clientHeight - padY)));
    dpr = Math.min(2.5, root.devicePixelRatio || 1);
    const cv = el.canvas;
    // the grid has its own canvas underneath, so a recorded clip (which copies the top one) shows no grid
    for (const c of [cv, $('#diyaGrid')]) { c.style.width = c.style.height = `${side}px`; c.width = c.height = Math.round(side * dpr); }
    const pad = side * 0.04;
    cell = (side - 2 * pad) / board.n;
    ox = oy = pad;
  }
  function changed() {
    const b = board, best = prog.best[current.id];
    $('#diyaMoves').textContent = `Moves ${b.moves}`;
    $('#diyaBest').textContent = best ? `Best ${best}` : `Par ${b.k}`;
    $('#diyaPairs').textContent = `Pairs ${b.connectedCount()}/${b.k}`;
    $('#diyaFill').textContent = `Filled ${Math.round(b.fill() * 100)}%`;
    $('#diyaHints').textContent = isPremium() ? '∞' : prog.hints > 0 ? String(prog.hints) : `💎${game() ? game().hintCost() : 10}`; // past the free ones, a hint costs gems
    $('#diyaUndo').disabled = !b.history.length;
    const lit = Math.round(b.fill() * el.ambient.children.length);
    [...el.ambient.children].forEach((d, i) => d.classList.toggle('lit', i < lit));
    el.root.style.setProperty('--diya-fill', b.fill().toFixed(3));
    if (!finished && b.complete() && !b.drag) finish();
  }
  const cellAt = (e) => {
    const r = el.canvas.getBoundingClientRect(), x = e.clientX - r.left - ox, y = e.clientY - r.top - oy;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    return cx < 0 || cy < 0 || cx >= board.n || cy >= board.n ? -1 : cy * board.n + cx;
  };
  let wasConnected = [];
  function onDown(e) {
    if (finished && board && el.result.hidden && !showTimer) { el.result.hidden = false; return; }
    if (!board || finished) return;
    if (game()) game().resume();
    const i = cellAt(e);
    wasConnected = board.paths.map((_, c) => board.connected(c));
    if (!board.begin(i)) return;
    el.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    lit();
  }
  function onMove(e) {
    if (!board || !board.drag) return;
    const i = cellAt(e);
    if (i >= 0 && board.move(i)) { lit(); changedLight(); }
  }
  function onUp() {
    if (!board || !board.drag) return;
    board.end();
    changed();
  }
  // A pair that just lit: bell, buzz and a burst of glow.
  function lit() {
    for (let c = 0; c < board.k; c++) {
      const on = board.connected(c);
      if (on && !wasConnected[c]) { chime(c); if (game()) game().buzz(25); glowAt[c] = performance.now(); }
      wasConnected[c] = on;
    }
  }
  const changedLight = () => {
    $('#diyaPairs').textContent = `Pairs ${board.connectedCount()}/${board.k}`;
    $('#diyaFill').textContent = `Filled ${Math.round(board.fill() * 100)}%`;
    el.root.style.setProperty('--diya-fill', board.fill().toFixed(3));
  };
  function useHint() {
    if (!board || finished) return;
    const free = isPremium(); // Premium: unlimited hints
    if (!free && prog.hints <= 0) { openHintBox(); return; }
    wasConnected = board.paths.map((_, c) => board.connected(c));
    if (board.hint() < 0) return;
    if (!free) { prog.hints--; save(); }
    lit(); changed();
  }
  function openHintBox() {
    const g = game(), left = HINT_VIDEOS_A_DAY - (prog.vids[today()] || 0), btn = $('#diyaHintVideo');
    btn.hidden = !(g && g.videoReady());
    btn.disabled = left <= 0;
    btn.textContent = left <= 0 ? 'Videos are done for today' : `Watch a video · +${HINTS_PER_VIDEO} hints`;
    $('#diyaHintPremium').hidden = !g;
    const gb = $('#diyaHintGems'), cost = g ? g.hintCost() : 10, have = g ? g.gems() : 0;
    gb.hidden = !g;
    gb.textContent = have >= cost ? `Use 💎 ${cost} for a hint` : `Buy gems · a hint is 💎 ${cost}`;
    el.hintBox.hidden = false;
  }
  async function hintVideo() {
    const g = game(), btn = $('#diyaHintVideo');
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

  // ----- A finished level: the show over the landmark, then the stars -----
  let award = null, startedAt = 0;
  function finish() {
    finished = true;
    const b = board, stars = b.stars(), id = current.id, g = game();
    swell();
    if (g) g.buzz([30, 60, 30]);
    let had = 0, newBest = false;
    if (current.daily) {
      const d = prog.daily[current.day];
      had = d ? d.s : 0;
      prog.daily[current.day] = { s: Math.max(had, stars), m: d ? Math.min(d.m, b.moves) : b.moves };
      for (const k of Object.keys(prog.daily).sort().slice(0, -60)) delete prog.daily[k];
    } else had = prog.stars[id] || 0;
    if (!(prog.best[id] <= b.moves)) { newBest = !!prog.best[id]; prog.best[id] = b.moves; }
    if (!current.daily) prog.stars[id] = Math.max(had, stars);
    save();
    const r = g ? g.reward({ stars, had, index: current.index || 0, daily: !!current.daily }) : { gain: 0, chest: 0 };
    award = { stars, gain: r.gain, chest: r.chest, newBest, streak: current.daily && current.day === today() && g ? g.markDaily(today()) : 0 };
    // The Daily Diya's leaderboard score: stars first, then speed (900 points, 3 fewer for every second taken).
    if (current.daily && current.day === today() && g && g.dailyScore) g.dailyScore('diya', stars * 1000 + Math.max(0, 900 - Math.round((Date.now() - startedAt) / 1000) * 3));
    // No fireworks: the lit board glows for a moment, then the level-complete card. The sky is hushed too, so nothing
    // left over from a show goes on bursting behind the puzzle.
    if (g && g.quiet) g.quiet();
    setPeek(false);
    showTimer = setTimeout(() => { showTimer = 0; showResult(); }, 650);
    setTimeout(() => endClip(true), 1200); // the lit board glows on the clip's last second
  }
  const peeking = () => !!el && el.root.classList.contains('peek');
  function setPeek(on) {
    if (!el) return;
    el.root.classList.toggle('peek', on);
    $('#diyaPeek').setAttribute('aria-pressed', String(on));
  }

  // ----- The level's clip: each level is recorded as it is played (the god picture, the board, the diyas), so Share
  // video sends the real game. Kept in memory only, up to two minutes, and dropped when the next level starts. -----
  const CLIP_W = 540, CLIP_H = 960, CLIP_MAX = 120;
  let clip = null, clipVideo = null;
  const sceneArt = {};
  function sceneImage() {
    const id = el.root.dataset.scene || 'night';
    if (id === 'night') return null;
    if (!sceneArt[id]) { const im = new Image(); im.src = `assets/diya-path/gods/${id}.webp`; sceneArt[id] = im; }
    const im = sceneArt[id];
    return im.complete && im.naturalWidth ? im : null;
  }
  function startClip() {
    endClip(false);
    clipVideo = null;
    const cv = document.createElement('canvas');
    if (!root.MediaRecorder || !cv.captureStream) return;
    cv.width = CLIP_W; cv.height = CLIP_H;
    const stream = cv.captureStream(24);
    const types = ['video/mp4;codecs="avc1.42E01E"', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2.5e6 } : undefined); } catch (e) { return; }
    const c = { mr, cv, g: cv.getContext('2d'), chunks: [], start: performance.now(), keep: false, level: current };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) c.chunks.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!c.keep || current !== c.level) return;
      const type = (mr.mimeType || mime || 'video/webm').split(';')[0];
      clipVideo = { blob: new Blob(c.chunks, { type }), type, name: `diya-path.${type.includes('mp4') ? 'mp4' : 'webm'}` };
    };
    try { mr.start(1000); } catch (e) { return; }
    clip = c;
  }
  function endClip(keep) {
    const c = clip;
    if (!c) return;
    clip = null;
    c.keep = keep;
    try { c.mr.stop(); } catch (e) { /* already stopped */ }
  }
  function clipFrame() {
    const c = clip, g = c.g, W = CLIP_W, H = CLIP_H;
    if ((performance.now() - c.start) / 1000 > CLIP_MAX) { endClip(true); return; }
    g.fillStyle = '#07061a'; g.fillRect(0, 0, W, H);
    const im = sceneImage();
    if (im) { const s = Math.max(W / im.naturalWidth, H / im.naturalHeight); g.drawImage(im, (W - im.naturalWidth * s) / 2, 0, im.naturalWidth * s, im.naturalHeight * s); }
    const side = W * 0.92, x = (W - side) / 2, y = H * 0.52 - side / 2;
    const a = parseFloat(getComputedStyle(el.canvas).opacity) || 0;
    g.save();
    g.globalAlpha = a;
    if (!im) { g.fillStyle = 'rgba(10, 10, 40, 0.55)'; g.fillRect(x, y, side, side); }
    g.drawImage(el.canvas, x, y, side, side);
    g.restore();
    g.fillStyle = '#ffe2a8'; g.font = '600 30px Outfit, sans-serif'; g.textAlign = 'center';
    g.fillText(levelName(current), W / 2, y - 28);
    g.font = '500 22px Outfit, sans-serif'; g.fillStyle = 'rgba(255, 226, 168, 0.8)';
    g.fillText('Diya Path · Light Up the Skies', W / 2, H - 40);
  }
  const shareLine = () => `🪔 I lit every diya on ${levelName(current)} in Diya Path ${starText(award.stars)}`;
  function shareLevel() {
    const g = game();
    if (!g || !award || !g.shareResult) return;
    g.shareResult({ kicker: 'Diya Path', title: levelName(current), stars: award.stars, line: `${board.moves} moves`,
      text: `${shareLine()}\nPlay it:`, name: 'diya-path.png' });
  }
  // Share video: the level's paths drawn again, one square at a time, recorded with the game's recorder (on the web it
  // sees only the sky, so the board is drawn into each frame) and handed to the share sheet.
  let replay = null;
  function shareVideo() {
    const g = game();
    if (!g || !award || !board) return;
    if (clipVideo && g.shareVideo) { g.shareVideo(clipVideo.blob, clipVideo.name, clipVideo.type, shareLine()); return; }
    // No clip (this browser can't record a canvas): the level's paths drawn again under the game's recorder.
    if (!g.recordSky || replay) return;
    const lv = current, final = board.snapshot(), b = board;
    let stop = null;
    const begin = () => {
      el.result.hidden = true;
      b.paths = final.map((p) => p.slice(0, 1));
      el.root.classList.add('diya-clean'); // no board picture on screen either (the app's recorder films the screen)
      replay = { final, c: 0, t: 0, done: () => { replay = null; b.paths = final; setTimeout(() => { el.root.classList.remove('diya-clean'); if (stop) stop(); if (current === lv) showResult(); }, 1200); } };
    };
    const layer = (cg, sx, sy) => { const r = el.canvas.getBoundingClientRect(); cg.drawImage(el.canvas, r.left * sx, r.top * sy, r.width * sx, r.height * sy); };
    stop = g.recordSky(begin, { caption: shareLine(), layer });
  }
  function stepReplay(dt) {
    const r = replay;
    r.t += dt;
    while (r.t >= 0.07 && replay) {
      r.t -= 0.07;
      const p = board.paths[r.c], f = r.final[r.c];
      if (p.length < f.length) { p.push(f[p.length]); if (p.length === f.length) { glowAt[r.c] = performance.now(); chime(r.c); } }
      else if (++r.c >= r.final.length) r.done();
    }
  }
  function showResult() {
    el.root.classList.remove('showing');
    el.skip.hidden = true;
    const { stars, gain, newBest, streak } = award, b = board;
    $('#diyaResKicker').textContent = levelName(current);
    $('#diyaResTitle').textContent = stars === 3 ? 'Perfect light!' : stars === 2 ? 'Every square filled!' : 'All diyas lit!';
    $('#diyaResStars').textContent = starText(stars);
    $('#diyaResLine').textContent = stars === 1 ? 'Fill every square for 2 stars'
      : stars === 2 ? `Finish in ${b.k} moves for 3 stars` : newBest ? `New best: ${b.moves} moves` : `${b.moves} moves`;
    $('#diyaResGain').textContent = gain ? `💎 +${gain}` : '';
    const g = game();
    $('#diyaChest').hidden = !award.chest;
    if (award.chest) { $('#diyaChestText').textContent = `🎁 Chest +${award.chest}`; const d = $('#diyaChestDouble'); d.disabled = false; d.hidden = !(g && g.videoReady()); }
    $('#diyaResPremium').hidden = !g || isPremium();
    $('#diyaResStreak').textContent = streak ? `🔥 ${streak}-day streak` : '';
    if (vs && vs.id === current.id) { // against a friend's moves (fewer is better)
      const d = vs.m - b.moves;
      $('#diyaResLine').textContent = d > 0 ? `You beat ${vs.n || 'your friend'} by ${d} moves!` : d === 0 ? `A tie with ${vs.n || 'your friend'}!` : `${vs.n || 'Your friend'} used ${-d} fewer moves. Try again!`;
    }
    $('#diyaChallenge').textContent = vs && vs.id === current.id ? 'Challenge back' : 'Challenge a friend';
    const nx = nextLevel();
    $('#diyaNext').hidden = !nx;
    $('#diyaResult').hidden = false;
    $('#diyaNext').hidden ? $('#diyaAgain').focus() : $('#diyaNext').focus();
    if (game()) game().adBreak(); // a video at this break, at most one every 2 minutes (the game decides)
  }

  // ----- Drawing -----
  const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!board || el.play.hidden) return;
    if (replay) stepReplay(dt);
    if (clip) clipFrame();
    const g = el.canvas.getContext('2d'), n = board.n, W = el.canvas.width;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    const cx = (i) => ox + (i % n + 0.5) * cell, cy = (i) => oy + (((i / n) | 0) + 0.5) * cell;
    // The cell washes and the grid go on the canvas underneath: on screen they look the same, and neither a recorded
    // clip nor a Share video replay shows them.
    const gg = $('#diyaGrid').getContext('2d');
    gg.setTransform(dpr, 0, 0, dpr, 0, 0);
    gg.clearRect(0, 0, W, W);
    // owned cells: a faint wash of the path's colour
    for (let c = 0; c < board.k && !replay; c++) {
      const p = board.paths[c];
      if (p.length < 2) continue;
      gg.fillStyle = rgba(COLOURS[c].hex, board.connected(c) ? 0.16 : 0.09);
      for (const i of p) gg.fillRect(ox + (i % n) * cell + 1, oy + ((i / n) | 0) * cell + 1, cell - 2, cell - 2);
    }
    // The grid: a dark band under a bright line, so the cells read on the night and on any part of a picture
    if (!replay) {
    const g = gg;
    g.save();
    const onPicture = (el.root.dataset.scene || 'night') !== 'night'; // also while a Premium one is previewed
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      g.moveTo(ox + k * cell, oy); g.lineTo(ox + k * cell, oy + n * cell);
      g.moveTo(ox, oy + k * cell); g.lineTo(ox + n * cell, oy + k * cell);
    }
    g.strokeStyle = onPicture ? 'rgba(0, 0, 0, 0.75)' : 'rgba(4, 4, 20, 0.6)'; g.lineWidth = onPicture ? 4.5 : 3.5;
    g.stroke();
    g.strokeStyle = onPicture ? 'rgba(255, 232, 170, 0.95)' : 'rgba(176, 186, 255, 0.62)'; g.lineWidth = onPicture ? 2 : 1.5;
    g.shadowColor = onPicture ? 'rgba(255, 200, 90, 0.55)' : 'rgba(140, 150, 255, 0.8)'; g.shadowBlur = 5;
    g.stroke();
    g.restore();
    }
    // glowing tubes
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let c = 0; c < board.k; c++) {
      const p = board.paths[c];
      if (p.length < 2) continue;
      const col = COLOURS[c].hex, on = board.connected(c), pulse = on ? 0.85 + 0.15 * Math.sin(now / 420 + c) : 0.7;
      const flash = Math.max(0, 1 - (now - glowAt[c]) / 700);
      const trace = () => { g.beginPath(); g.moveTo(cx(p[0]), cy(p[0])); for (const i of p) g.lineTo(cx(i), cy(i)); };
      g.save();
      g.shadowColor = col; g.shadowBlur = cell * (0.35 + flash * 0.6) * pulse;
      g.strokeStyle = rgba(col, 0.55 + flash * 0.3); g.lineWidth = cell * 0.36; trace(); g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255, 252, 240, 0.85)'; g.lineWidth = cell * 0.09; trace(); g.stroke();
      g.restore();
    }
    // diyas
    for (let c = 0; c < board.k; c++) for (const i of board.endsOf[c]) drawDiya(g, cx(i), cy(i), cell, c, board.connected(c), now, Math.max(0, 1 - (now - glowAt[c]) / 700));
    // the drag head: a little sparkle
    if (board.drag) {
      const p = board.drag.path, h = p[p.length - 1], col = COLOURS[board.drag.c].hex;
      for (let s = 0; s < 2; s++) sparks.push({ x: cx(h), y: cy(h), vx: (Math.random() - 0.5) * cell * 2.4, vy: (Math.random() - 0.7) * cell * 2.4, life: 0.5 + Math.random() * 0.3, age: 0, col });
      g.save();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.shadowColor = col; g.shadowBlur = cell * 0.5;
      g.beginPath(); g.arc(cx(h), cy(h), cell * 0.12, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let s = sparks.length - 1; s >= 0; s--) {
      const p = sparks[s];
      p.age += dt;
      if (p.age > p.life) { sparks.splice(s, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += cell * 3 * dt;
      g.fillStyle = rgba(p.col, 1 - p.age / p.life);
      g.beginPath(); g.arc(p.x, p.y, cell * 0.035, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // A flickering flame standing on (x, fy), r tall-ish.
  function drawFlame(g, x, fy, r, c, now, s) {
    const fl = 1 + Math.sin(now / 90 + c * 2) * 0.08 + Math.sin(now / 37 + c) * 0.04, fh = r * 1.15 * fl;
    const fg = g.createLinearGradient(x, fy - fh, x, fy);
    fg.addColorStop(0, 'rgba(255,250,220,0.95)'); fg.addColorStop(0.5, '#ffd36b'); fg.addColorStop(1, '#ff8a2a');
    g.fillStyle = fg; g.shadowColor = '#ffb347'; g.shadowBlur = s * 0.4;
    g.beginPath();
    g.moveTo(x, fy - fh);
    g.quadraticCurveTo(x + r * 0.42, fy - fh * 0.35, x, fy);
    g.quadraticCurveTo(x - r * 0.42, fy - fh * 0.35, x, fy - fh);
    g.fill();
    g.shadowBlur = 0;
  }
  // The enamel diyas painted in Google Flow (assets/diya-path/diya-<colour>.webp), each with its colour's gold emblem;
  // Premium's golden set is gold-<colour>.webp.
  const sprites = {};
  const sprite = (c) => {
    const set = styleOf('diya') === 'gold' ? 'gold' : 'diya';
    if (!sprites[set]) sprites[set] = COLOURS.map((_, i) => { const im = new Image(); im.decoding = 'async'; im.src = `assets/diya-path/${set}-${i}.webp`; return im; });
    const im = sprites[set][c];
    return im && im.complete && im.naturalWidth ? im : null;
  };
  // A diya in its colour; lit pairs carry a flickering flame at the spout. Until the pictures load, a drawn one.
  function drawDiya(g, x, y, s, c, on, now, flash) {
    const col = COLOURS[c].hex, r = s * 0.36;
    g.save();
    const glow = g.createRadialGradient(x, y, 0, x, y, s * (on ? 0.9 : 0.55));
    glow.addColorStop(0, rgba(col, on ? 0.55 + flash * 0.3 : 0.28));
    glow.addColorStop(1, rgba(col, 0));
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, s * (on ? 0.9 : 0.55), 0, Math.PI * 2); g.fill();
    const img = sprite(c);
    if (img) {
      const d = s * 1.12, top = y - d / 2 + s * 0.08;
      if (!on) g.filter = 'brightness(0.8) saturate(0.85)'; // unlit lamps sit a little back
      g.drawImage(img, x - d / 2, top, d, d);
      g.filter = 'none';
      if (on) drawFlame(g, x + d * 0.4, top + d * 0.36, r * 0.85, c, now, s);
      g.restore();
      return;
    }
    // flame
    const fy = y - r * 0.35;
    if (on) drawFlame(g, x, fy, r, c, now, s);
    else {
      g.fillStyle = 'rgba(255,190,120,0.7)';
      g.beginPath(); g.arc(x, fy, r * 0.09, 0, Math.PI * 2); g.fill();
    }
    // bowl: dark clay with a coloured rim
    g.beginPath();
    g.moveTo(x - r, y - r * 0.2);
    g.quadraticCurveTo(x - r * 0.85, y + r * 0.75, x, y + r * 0.78);
    g.quadraticCurveTo(x + r * 0.85, y + r * 0.75, x + r * 1.18, y - r * 0.38); // the spout lifts a little
    g.quadraticCurveTo(x + r * 0.5, y - r * 0.08, x - r, y - r * 0.2);
    const bg = g.createLinearGradient(x, y - r * 0.3, x, y + r * 0.8);
    bg.addColorStop(0, '#a5512c'); bg.addColorStop(1, '#4a1d10');
    g.fillStyle = bg; g.fill();
    g.lineWidth = Math.max(1.5, s * 0.06); g.strokeStyle = col; g.stroke();
    // the mark, so colours can be told apart without colour
    drawMark(g, COLOURS[c].mark, x, y + r * 0.3, r * 0.3, col);
    g.restore();
  }
  function drawMark(g, mark, x, y, m, col) {
    g.save();
    g.fillStyle = col; g.strokeStyle = 'rgba(20,8,4,0.6)'; g.lineWidth = 1;
    g.beginPath();
    const poly = (pts) => { pts.forEach(([a, b], i) => (i ? g.lineTo(x + a * m, y + b * m) : g.moveTo(x + a * m, y + b * m))); g.closePath(); };
    if (mark === 'circle') g.arc(x, y, m * 0.85, 0, Math.PI * 2);
    else if (mark === 'triangle') poly([[0, -1], [1, 0.8], [-1, 0.8]]);
    else if (mark === 'square') poly([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]);
    else if (mark === 'diamond') poly([[0, -1.1], [1, 0], [0, 1.1], [-1, 0]]);
    else if (mark === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.45 : 1.1; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } poly(pts); }
    else if (mark === 'drop') { g.moveTo(x, y - m * 1.1); g.quadraticCurveTo(x + m * 1.1, y + m * 0.2, x, y + m * 0.9); g.quadraticCurveTo(x - m * 1.1, y + m * 0.2, x, y - m * 1.1); }
    else if (mark === 'heart') { g.moveTo(x, y + m * 0.9); g.bezierCurveTo(x - m * 1.4, y - m * 0.1, x - m * 0.6, y - m * 1.1, x, y - m * 0.35); g.bezierCurveTo(x + m * 0.6, y - m * 1.1, x + m * 1.4, y - m * 0.1, x, y + m * 0.9); }
    else if (mark === 'cross') poly([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]]);
    else if (mark === 'lotus') { for (let i = -2; i <= 2; i++) { g.moveTo(x, y + m * 0.8); g.quadraticCurveTo(x + i * m * 0.5 - m * 0.35, y - m * 0.2, x + i * m * 0.4, y - m * (1 - Math.abs(i) * 0.2)); g.quadraticCurveTo(x + i * m * 0.5 + m * 0.35, y - m * 0.2, x, y + m * 0.8); } }
    else if (mark === 'spiral') { g.arc(x, y, m, 0, Math.PI * 2); g.moveTo(x + m * 0.45, y); g.arc(x, y, m * 0.45, 0, Math.PI * 2, true); }
    else if (mark === 'moon') { g.arc(x, y, m, Math.PI * 0.3, Math.PI * 1.7); g.arc(x + m * 0.45, y, m * 0.7, Math.PI * 1.6, Math.PI * 0.4, true); }
    else { const pts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; pts.push([Math.cos(a), Math.sin(a)]); } poly(pts); }
    g.fill(); g.stroke();
    g.restore();
  }

  // ----- Opening and closing -----
  async function open(daily) {
    if (!el) build();
    const g = game();
    prog = load();
    try { await levels(); } catch (e) { if (g) g.toast('Couldn’t load the puzzles. Try again.'); return; }
    if (g) { g.resume(); g.enter(); }
    applyStyle();
    el.root.hidden = false;
    document.body.classList.add('diya-open');
    for (const x of el.root.querySelectorAll('[data-gems]')) x.textContent = g ? g.gems().toLocaleString('en-IN') : '';
    if (daily) play(dailyLevel()); else showMap();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function close() {
    if (el) endPreview(false);
    if (!el || el.root.hidden) return;
    if (showTimer) { clearTimeout(showTimer); showTimer = 0; }
    el.root.hidden = true;
    el.root.classList.remove('showing');
    document.body.classList.remove('diya-open');
    cancelAnimationFrame(raf); raf = 0;
    endClip(false); clipVideo = null;
    board = null;
    if (game()) game().leave();
    tile();
  }
  // Android Back: hint box, then result, then the board, then the map, then home.
  api.back = () => {
    if (!el || el.root.hidden) return false;
    if (!el.hintBox.hidden) el.hintBox.hidden = true;
    else if (showTimer) { clearTimeout(showTimer); showTimer = 0; showResult(); }
    else if (!el.play.hidden || !el.result.hidden) showMap();
    else close();
    return true;
  };
  api.open = open;
  api.close = close;
  api.board = () => board;
  // The home tile: today's puzzle and the stars so far.
  function tile() {
    const note = $('#tileDiya');
    if (!note) return;
    prog = load();
    const done = !!prog.daily[today()], stars = Object.values(prog.stars).reduce((a, b) => a + b, 0);
    $('#btnDiya').classList.toggle('soon', !done && stars > 0);
    note.textContent = done ? `★ ${stars} · today’s diya is lit` : stars ? `★ ${stars} · today’s puzzle is waiting` : 'Join the diyas with light';
  }
  document.addEventListener('DOMContentLoaded', () => {
    const b = $('#btnDiya');
    if (b) b.addEventListener('click', () => open(false));
    tile();
    // A link to today's puzzle: #diya
    if (/^#diya\b/.test(location.hash)) { if (game()) open(true); else root.addEventListener('luts:game', () => open(true), { once: true }); }
  });
  root.addEventListener('focus', () => { if (!el || el.root.hidden) tile(); });
  // Bought (or lost) Premium while the puzzle is open: redraw the locks and the hint count.
  root.addEventListener('luts:premium-changed', () => {
    if (!el || el.root.hidden || !data) return;
    if (!el.map.hidden) showMap();
    else if (board) { changed(); if (!el.result.hidden) $('#diyaResPremium').hidden = isPremium(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
