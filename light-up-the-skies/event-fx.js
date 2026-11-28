/* Light Up the Skies — Event Sky's effects engine, window.EFX (WP-C of research/event-sky-spec.md, §3.4).

   One timeline for every screen. The wall's main, slideshow and mirror screens, a TV and the host's MP4 render draw the
   same frames, because a frame is a pure function of (seed, the scheduled acts, t):
   - acts are data, never callbacks (EFX.burst, rocket, textSparks, reveal, slide, mosaic, countdown, finale);
   - every random draw comes from mulberry32(hash(seed, act id)), and an act's id comes from its content (or the caller's
     id, such as a media id), so the order acts are added in changes nothing;
   - every particle moves in closed form (drag and gravity integrated), so frame t needs no earlier frame, and a screen
     that joins late, or an MP4 rendered offline, draws exactly what the others drew.

   Flash-safe by construction (§4.24). The gate (EFX.FlashGate) places every bright burst so that at most 2 flash in any
   rolling second, at least 600 ms apart; two bursts within 80 ms count as one. A later one moves to the next allowed
   time, or burns dim (non-bright, at most half the luminance, no flare) when that is more than 2 s away. A flare's alpha
   is 0.3 or less and fades to nothing, so no frame turns white; a red one covers a quarter of the frame at most.
   A 'slides' screen never flashes; a 'mirror' flashes with its 'main', at the same instants. Under a reveal, a full
   countdown and the finale the sky (slides, mosaic) dims over half a second or more, so their words read.
   Reduced motion (the OS setting, or the console's "Calmer fireworks"): the finale spaces its shells 0.9 s apart, glitter
   glows instead of strobing, and photos fade instead of flying, popping or panning.

   Units. Positions are fractions of the canvas (x of its width, y of its height). Sizes and radii (slot.r, a tile's r,
   a text's size) are fractions of its shorter side. Times are ms on the caller's clock (the wall passes server time from
   ES.clock; the MP4 passes its own frame time).

   EFX.stage(canvas, {seed, dpr, tier:'tv'|'phone'|'laptop', reduced, role:'main'|'slides'|'mirror',
                      width?, height? (CSS px; else the canvas's client size, else its width/height),
                      bg? (a colour, or an image drawn to cover; default transparent), overlay?(ctx, w, h, t),
                      insetBottom? (CSS px, or a function returning them: the screen's own text at the bottom; slide
                      captions are written above it),
                      readback? (a CPU canvas, for exports and tests)}) → Stage
     Stage.render(t)            draws the frame for absolute time t
     Stage.add(act) → act       schedules an act (an act with the same id replaces the earlier one)
     Stage.remove(act | id) → bool   drops an act now (an erased photo leaves the screen; a closed bitmap never draws)
     Stage.clearBefore(t)       drops acts that ended before t (their flashes still bind the gate); a screen that runs
                                for hours calls it now and then, e.g. clearBefore(now - 60 s)
     Stage.stats() → {bright:[t…] (flash instants), denied (burnt dim), moved, joined (paired), particles, drones, flare, flareMax, frames}
     Stage.when(act) → {at, end, units:[{tag, t, bright, moved}], drones} | null   (resolved timing, after the gate)
     Stage.resize(w, h); Stage.dispose(); Stage.loop(now = Date.now, {fps, onError}) → {stop()}   (tv: 30 fps)
   EFX.burst({t, x, y, kind, hue, size, bright=true, rocket?:true|{x0, ms}}) → act   (t: the burst; a rocket climbs to it)
   EFX.rocket({t, x0, x1, y1, ms=1200}) → act
   EFX.textSparks({t, text, x, y, font, ms=3000, size=0.12, hue?}) → act       (names in sparks; '\n' makes 2 lines)
   EFX.reveal({t, photo, name, wish, slot:{x,y,r}, caption?, mission?, upload?, x?, y?}) → act
     0–1.2 s rocket; 1.2 s burst (bright, gated: the whole reveal moves with it); 1.2–1.9 s the photo grows;
     1.9–3.8 s the name and wish in light (an upload: its caption, "Photo by {0}", "Mission: {0}"); 3.8–4.4 s it flies
     to its slot in the mosaic (with no slot it fades).
   EFX.slide({t, photo, ms=6000, seed, caption?, name?, mission?}) → act       (one big photo, Ken Burns; slides that
     follow each other within 150 ms crossfade; a <video> plays in a layer outside the canvas)
   EFX.mosaic({t, items:[{bitmap, x, y, r, sx?, sy?, sw?, sh? (an atlas cell), at?, id? (a media id)}], ms?, develop?}) → act
     The latest mosaic replaces the earlier one: tiles both share glide to their new places, new ones fade in, and
     develop:true fades them in from sepia, with no flashes (the disposable camera's reveal).
   EFX.countdown({t, endsAt, label, style:'full'|'corner', corner?:'tr'|'tl'|'br'|'bl', finish?}) → act
     full: the sky dims, the label and mm:ss, the last 10 s one big digit, then `finish` (default 3) gated bursts.
     corner: a ring with the time left and the label under it (label: the caller's translated, filled-in line).
   EFX.finale({t, title, names, date, photos:[bitmap], end:'kamuro', drones:true, shells=8, words=true}) → act
     (the drones write the names; the date shows under them as text on a dark pill)
     cdClimax's timing: the pair of peonies bursts at 1.2 s; title words in sparks at +0.2 s, names at +3 s, the date at
     +5.6 s; 8 shells every 0.7 s (0.9 s reduced) from one height from +7.4 s; the photos gather into a heart meanwhile;
     the drones' shell breaks 1.2 s after the last burst and LUTSDroneShow's player writes [names] in lights
     (count 900 on a TV, else 1300; built when the act is added, so no frame waits for it).
   EFX.FlashGate (class; also used by tests and other packages): new FlashGate().place(t, n, spread) → {at, bright},
     FlashGate.verify(times) → {ok, minGap, maxInWindow}, FlashGate.lumaJumps(lumas, fps) → {ok, jumps, maxPerSecond}
   EFX.textPoints(text, font?, weight?) → {n, x, y, w, h, step, area}; EFX.grid(n, {aspect, box, gap}) → [{x, y, r}]
   EFX.ready() → Promise (the bundled Cinzel weights loaded); EFX.FONT_STACK; EFX.LIMITS; EFX.TIERS

   Not drawn here: the brand mark (the wall and the MP4 draw EM.mark in `overlay`, free plans only, §4.23), the QR and
   the wall's DOM text. Canvas lines go through LUTSLang.t(); names, wishes, captions and titles are drawn as typed. */
/* STRINGS:
Photo by {0}
Mission: {0}
*/
(() => {
  'use strict';
  if (window.EFX) return; // loaded twice: the first one stays

  // ---------- Small helpers ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const out3 = (u) => { u = clamp(u, 0, 1); return 1 - (1 - u) * (1 - u) * (1 - u); };
  const back = (u) => { u = clamp(u, 0, 1) - 1; return 1 + 2.3 * u * u * u + 1.3 * u * u; }; // a small overshoot
  const num = (v, d) => { const x = typeof v === 'string' && v.trim() ? Number(v) : v; return typeof x === 'number' && Number.isFinite(x) ? x : d; };
  // A line as typed, made safe to draw: control characters out, spaces folded, at most `max` characters (whole code points).
  const clean = (v, max) => {
    const s = v == null ? '' : String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim(), a = Array.from(s);
    return a.length > max ? `${a.slice(0, max - 1).join('')}…` : s;
  };
  const tr = (s) => { try { const L = window.LUTSLang; return (L && typeof L.t === 'function' && L.t(s)) || s; } catch (e) { return s; } };
  const fill = (s, ...a) => tr(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // ---------- Seeded randomness ----------
  function fnv(str) { // FNV-1a with a final mix: a 32-bit hash of a string
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  const hash = (seed, id) => fnv(`${seed}\u0001${id}`);
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const bit = (i, s) => { // a stateless 0..1 for (particle, step): glitter that needs no earlier frame
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s + 0x632be5ab) | 0, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  };
  const idOf = (type, parts) => `${type}:${fnv(parts.map((p) => (p == null ? '' : String(p))).join('\u0002')).toString(36)}`;

  // ---------- Constants ----------
  const FONT_STACK = 'Cinzel, "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gurmukhi", sans-serif';
  const TIERS = Object.freeze({ tv: Object.freeze({ budget: 1500, fps: 30, k: 0.8 }), phone: Object.freeze({ budget: 3000, fps: 60, k: 0.9 }), laptop: Object.freeze({ budget: 6000, fps: 60, k: 1 }) });
  const ROLES = ['main', 'slides', 'mirror'];
  const KINDS = ['peony', 'chrysanthemum', 'willow', 'kamuro', 'palm', 'ring', 'heart'];
  const ENDS = { kamuro: 'kamuro', heart: 'heart', kingwillow: 'willow', willow: 'willow', peony: 'peony', chrysanthemum: 'chrysanthemum' };
  const HUES = [42, 330, 285, 205, 140, 22, 52, 350, 175]; // gold, pink, violet, blue, green, orange, yellow, rose, teal
  const LIMITS = Object.freeze({ gap: 600, window: 1000, max: 2, pair: 80, maxDelay: 2000, flare: 0.3, red: 0.25, dim: 0.5 });
  const LIFE_OF = { peony: 1800, chrysanthemum: 2050, willow: 4100, kamuro: 3450, palm: 2550, ring: 1900, heart: 2050 }; // ms, longest star + a margin
  const REVEAL = { rise: 1200, grown: 1900, leave: 3800, done: 4400 };
  const DRONE_LIFE = 12500;
  const isRed = (h) => h != null && (h <= 15 || h >= 345);

  // ---------- The flash gate ----------
  // Flashes are kept as {start, last, count}: a pair (two bursts within 80 ms) is one flash of count 2. A new flash needs
  // 600 ms clear of every other one, before and after, which also keeps any rolling second to 2 flashes at most.
  class FlashGate {
    constructor(o = {}) {
      this.gap = num(o.gap, LIMITS.gap); this.pair = num(o.pair, LIMITS.pair); this.maxDelay = num(o.maxDelay, LIMITS.maxDelay);
      this.flashes = []; this.denied = 0; this.moved = 0; this.joined = 0;
    }
    // Flashes already shown (by acts since dropped) bind the gate as they were.
    fix(list) {
      for (const f of list || []) if (Number.isFinite(f.start)) this.flashes.push({ start: f.start, last: num(f.last, f.start), count: clamp(num(f.count, 1), 1, 2), members: [] });
      this.flashes.sort((a, b) => a.start - b.start);
      return this;
    }
    clear(start, last, skip) {
      for (const f of this.flashes) if (f !== skip && !(start >= f.last + this.gap || last + this.gap <= f.start)) return false;
      return true;
    }
    // n: bursts going off together (2 for a pair); spread: ms between the first and the last of them.
    place(t, n = 1, spread = 0) {
      t = num(t, 0); n = clamp(Math.round(num(n, 1)), 1, 2); spread = clamp(num(spread, 0), 0, this.pair);
      for (const f of this.flashes) { // a burst within 80 ms of a single one makes a pair with it, if that keeps the gaps
        if (f.count + n > 2 || t < f.start || t + spread > f.start + this.pair) continue;
        const last = Math.max(f.last, t + spread);
        if (this.flashes.every((g) => g === f || g.start < f.start || last + this.gap <= g.start)) { f.last = last; f.count += n; this.joined++; return { at: t, bright: true, flash: f }; }
      }
      const cand = [t];
      for (const f of this.flashes) if (f.last + this.gap > t) cand.push(f.last + this.gap);
      cand.sort((a, b) => a - b);
      for (const c of cand) {
        if (c - t > this.maxDelay) break;
        if (this.clear(c, c + spread)) {
          const f = { start: c, last: c + spread, count: n, members: [] };
          this.flashes.push(f); this.flashes.sort((a, b) => a.start - b.start);
          if (c > t) this.moved++;
          return { at: c, bright: true, flash: f };
        }
      }
      this.denied++;
      return { at: t, bright: false, flash: null };
    }
    times() { return this.flashes.map((f) => f.start).sort((a, b) => a - b); }
    // Checks a list of flash instants: every gap, and the most in any rolling window.
    static verify(times, o = {}) {
      const gap = num(o.gap, LIMITS.gap), win = num(o.window, LIMITS.window), max = num(o.max, LIMITS.max);
      const ts = (times || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
      let minGap = Infinity, most = 0;
      for (let i = 0, j = 0; i < ts.length; i++) {
        if (i) minGap = Math.min(minGap, ts[i] - ts[i - 1]);
        while (ts[i] - ts[j] >= win) j++;
        most = Math.max(most, i - j + 1);
      }
      return { ok: minGap >= gap && most <= max, minGap, maxInWindow: most, count: ts.length };
    }
    // Mean frame luminance (0..1) per frame: a jump is a change of more than `jump` between two frames; at most 2 in any
    // second is the rule (WCAG's general flash threshold is 3).
    static lumaJumps(lumas, fps = 30, o = {}) {
      const jump = num(o.jump, 0.1), max = num(o.max, LIMITS.max), per = Math.max(1, Math.round(num(fps, 30))), jumps = [];
      for (let i = 1; i < (lumas || []).length; i++) if (Math.abs(lumas[i] - lumas[i - 1]) > jump) jumps.push(i);
      let most = 0;
      for (let i = 0, j = 0; i < jumps.length; i++) { while (jumps[i] - jumps[j] >= per) j++; most = Math.max(most, i - j + 1); }
      return { ok: most <= max, jumps, maxPerSecond: most };
    }
  }

  // ---------- Acts (plain data) ----------
  const needT = (v, what) => {
    const t = num(v, NaN);
    if (!Number.isFinite(t)) throw new TypeError(`EFX.${what}: t must be a time in ms`);
    return t;
  };
  const pos = (v, d) => clamp(num(v, d), -0.25, 1.25);
  const hueOf = (v) => { const h = num(v, NaN); return Number.isFinite(h) ? ((h % 360) + 360) % 360 : null; };
  const bitmapOk = (b) => !!b && typeof b === 'object';
  // A mosaic tile's identity across mosaics: the caller's id (a media id), else its picture and, for an atlas cell, the cell.
  const BITMAP_IDS = new WeakMap();
  let bitmapNext = 1;
  const bitmapId = (b) => { let id = BITMAP_IDS.get(b); if (!id) BITMAP_IDS.set(b, (id = bitmapNext++)); return id; };

  function burst(o = {}) {
    const t = needT(o.t, 'burst');
    const a = { type: 'burst', t, x: pos(o.x, 0.5), y: pos(o.y, 0.3), kind: KINDS.includes(o.kind) ? o.kind : 'peony', hue: hueOf(o.hue),
      size: clamp(num(o.size, 1), 0.3, 2), bright: o.bright !== false, rocket: null };
    if (o.rocket) { const r = typeof o.rocket === 'object' ? o.rocket : {}; a.rocket = { x0: pos(r.x0, a.x), ms: clamp(num(r.ms, 1200), 300, 4000) }; }
    a.id = o.id != null ? String(o.id) : idOf('burst', [t, a.x, a.y, a.kind, a.hue, a.size, a.bright, a.rocket && a.rocket.x0, a.rocket && a.rocket.ms]);
    return a;
  }
  function rocket(o = {}) {
    const t = needT(o.t, 'rocket');
    const a = { type: 'rocket', t, x0: pos(o.x0, 0.5), x1: pos(o.x1, num(o.x0, 0.5)), y1: pos(o.y1, 0.3), ms: clamp(num(o.ms, 1200), 300, 4000) };
    a.id = o.id != null ? String(o.id) : idOf('rocket', [t, a.x0, a.x1, a.y1, a.ms]);
    return a;
  }
  const lines2 = (v, max) => String(v == null ? '' : v).split('\n').map((l) => clean(l, max)).filter(Boolean).slice(0, 2).join('\n');
  function textSparks(o = {}) {
    const t = needT(o.t, 'textSparks');
    const a = { type: 'textSparks', t, text: lines2(o.text, 40), x: pos(o.x, 0.5), y: pos(o.y, 0.3), font: o.font ? String(o.font) : FONT_STACK,
      ms: clamp(num(o.ms, 3000), 1200, 15000), size: clamp(num(o.size, 0.12), 0.03, 0.4), hue: hueOf(o.hue) };
    a.id = o.id != null ? String(o.id) : idOf('text', [t, a.text, a.x, a.y, a.font, a.ms, a.size, a.hue]);
    return a;
  }
  const slotOf = (s) => (s && Number.isFinite(num(s.x, NaN)) && Number.isFinite(num(s.y, NaN)) ? { x: pos(s.x, 0.5), y: pos(s.y, 0.5), r: clamp(num(s.r, 0.04), 0.004, 0.5) } : null);
  function reveal(o = {}) {
    const t = needT(o.t, 'reveal');
    const a = { type: 'reveal', t, photo: bitmapOk(o.photo) ? o.photo : null, name: clean(o.name, 60), wish: clean(o.wish, 200), caption: clean(o.caption, 140),
      mission: clean(o.mission, 80), slot: slotOf(o.slot), x: clamp(num(o.x, 0.5), 0.15, 0.85), y: clamp(num(o.y, 0.36), 0.2, 0.7),
      kind: KINDS.includes(o.kind) ? o.kind : null, hue: hueOf(o.hue) };
    a.upload = o.upload != null ? !!o.upload : !!(a.caption || a.mission);
    a.id = o.id != null ? String(o.id) : idOf('reveal', [t, a.name, a.wish, a.caption, a.mission, a.upload, a.x, a.y, a.slot && a.slot.x, a.slot && a.slot.y, a.slot && a.slot.r, a.kind, a.hue]);
    return a;
  }
  function slide(o = {}) {
    const t = needT(o.t, 'slide');
    const a = { type: 'slide', t, photo: bitmapOk(o.photo) ? o.photo : null, ms: clamp(num(o.ms, 6000), 1500, 60000), seed: o.seed == null ? null : String(o.seed),
      caption: clean(o.caption, 140), name: clean(o.name, 60), mission: clean(o.mission, 80) };
    a.id = o.id != null ? String(o.id) : idOf('slide', [t, a.ms, a.seed, a.caption, a.name, a.mission]);
    return a;
  }
  function mosaic(o = {}) {
    const t = needT(o.t, 'mosaic');
    const items = (Array.isArray(o.items) ? o.items : []).slice(0, 3000).filter((it) => it && bitmapOk(it.bitmap) && Number.isFinite(num(it.x, NaN)) && Number.isFinite(num(it.y, NaN)))
      .map((it) => {
        const tile = { bitmap: it.bitmap, x: pos(it.x, 0.5), y: pos(it.y, 0.5), r: clamp(num(it.r, 0.04), 0.002, 0.5), at: Number.isFinite(num(it.at, NaN)) ? num(it.at, 0) : null, id: it.id == null ? null : String(it.id) };
        if (num(it.sw, 0) > 0 && num(it.sh, 0) > 0) Object.assign(tile, { sx: num(it.sx, 0), sy: num(it.sy, 0), sw: num(it.sw, 1), sh: num(it.sh, 1) });
        tile.key = tile.id != null ? `i:${tile.id}` : tile.sw ? `b:${bitmapId(tile.bitmap)}@${tile.sx},${tile.sy},${tile.sw},${tile.sh}` : `b:${bitmapId(tile.bitmap)}`;
        return tile;
      });
    const a = { type: 'mosaic', t, items, ms: num(o.ms, 0) > 0 ? clamp(num(o.ms, 0), 500, 864e5) : null, develop: !!o.develop };
    a.id = o.id != null ? String(o.id) : idOf('mosaic', [t, items.length, a.ms, a.develop, ...items.map((i) => `${i.x.toFixed(4)},${i.y.toFixed(4)},${i.r.toFixed(4)},${i.at == null ? '' : i.at},${i.id == null ? '' : i.id}`)]);
    return a;
  }
  function countdown(o = {}) {
    const t = needT(o.t, 'countdown'), endsAt = num(o.endsAt, NaN);
    if (!Number.isFinite(endsAt)) throw new TypeError('EFX.countdown: endsAt must be a time in ms');
    const style = o.style === 'corner' ? 'corner' : 'full';
    const a = { type: 'countdown', t, endsAt: Math.max(endsAt, t), label: clean(o.label, 90), style, corner: ['tr', 'tl', 'br', 'bl'].includes(o.corner) ? o.corner : 'tr',
      finish: clamp(Math.round(num(o.finish, style === 'full' ? 3 : 0)), 0, 3) };
    a.id = o.id != null ? String(o.id) : idOf('countdown', [t, a.endsAt, a.label, style, a.corner, a.finish]);
    return a;
  }
  function finale(o = {}) {
    const t = needT(o.t, 'finale');
    const a = { type: 'finale', t, title: lines2(o.title, 32), names: lines2(o.names, 32), date: clean(o.date, 32),
      photos: (Array.isArray(o.photos) ? o.photos : []).filter(bitmapOk).slice(0, 48), end: ENDS[o.end] ? o.end : 'kamuro',
      drones: o.drones !== false, shells: clamp(Math.round(num(o.shells, 8)), 0, 8), words: o.words !== false };
    a.id = o.id != null ? String(o.id) : idOf('finale', [t, a.title, a.names, a.date, a.photos.length, a.end, a.drones, a.shells, a.words]);
    return a;
  }

  // ---------- Expanding an act into timed items ----------
  // An item: {k: kind, off: ms from the act's t, dur, u: its gate unit (or -1)}. A unit is one flash the gate places;
  // moving it moves every item of that unit (a shell's rocket with its burst; a whole reveal with its burst).
  const item = (k, off, dur, u, o) => Object.assign({ k, off, dur, u, at: 0, end: 0, bright: false, want: false }, o);
  const unit = (tag, off, n = 1) => ({ tag, off, n, spread: 0, shift: 0, bright: false, flash: null });
  const EXPAND = {
    burst(a) {
      const units = a.bright ? [unit('burst', 0)] : [], u = a.bright ? 0 : -1, items = [];
      if (a.rocket) items.push(item('rk', -a.rocket.ms, a.rocket.ms + 700, u, { x0: a.rocket.x0, x1: a.x, y1: a.y, ms: a.rocket.ms, key: `${a.id}:r` }));
      items.push(item('bu', 0, LIFE_OF[a.kind], u, { x: a.x, y: a.y, kind: a.kind, hue: a.hue, size: a.size, key: `${a.id}:b`, want: a.bright }));
      return { items, units };
    },
    rocket(a) { return { items: [item('rk', 0, a.ms + 700, -1, { x0: a.x0, x1: a.x1, y1: a.y1, ms: a.ms, key: a.id })], units: [] }; },
    textSparks(a) { return { items: [item('tx', 0, a.ms, -1, { text: a.text, x: a.x, y: a.y, size: a.size, font: a.font, hue: a.hue, key: a.id })], units: [] }; },
    reveal(a, s) {
      const rnd = mulberry32(hash(s.seed, `${a.id}:plan`));
      const kind = a.kind || ['peony', 'chrysanthemum', 'ring', 'heart'][(rnd() * 4) | 0];
      const hue = a.hue != null ? a.hue : HUES[(rnd() * HUES.length) | 0], x0 = clamp(a.x + (rnd() - 0.5) * 0.2, 0.05, 0.95);
      return {
        units: [unit('reveal', REVEAL.rise)],
        items: [
          item('rk', 0, REVEAL.rise + 700, 0, { x0, x1: a.x, y1: a.y, ms: REVEAL.rise, key: `${a.id}:r` }),
          item('bu', REVEAL.rise, LIFE_OF[kind], 0, { x: a.x, y: a.y, kind, hue, size: 1.5, key: `${a.id}:b`, want: true }),
          item('ph', 0, REVEAL.done, 0, { a, key: `${a.id}:p` }),
        ],
      };
    },
    slide(a, s) {
      const rnd = mulberry32(hash(s.seed, `slide:${a.seed != null ? a.seed : a.id}`));
      const zin = rnd() < 0.5, ang = rnd() * TAU, d = 0.022;
      return { units: [], items: [item('sl', 0, a.ms, -1, { a, z0: zin ? 1 : 1.07, z1: zin ? 1.07 : 1, px0: Math.cos(ang) * d, py0: Math.sin(ang) * d, px1: -Math.cos(ang) * d, py1: -Math.sin(ang) * d, key: a.id })] };
    },
    mosaic(a) { return { units: [], items: [item('mo', 0, a.ms || Infinity, -1, { a, key: a.id })] }; },
    countdown(a) {
      const lead = a.endsAt - a.t, items = [item('cd', 0, lead + 700, -1, { a, key: a.id })], units = [];
      const X = [0.3, 0.7, 0.5], K = ['peony', 'chrysanthemum', 'kamuro'];
      for (let i = 0; i < a.finish; i++) {
        const off = lead + i * 700;
        units.push(unit('finish', off));
        items.push(item('rk', off - 1200, 1900, i, { x0: X[i], x1: X[i], y1: 0.3, ms: 1200, key: `${a.id}:r${i}` }));
        items.push(item('bu', off, LIFE_OF[K[i]], i, { x: X[i], y: 0.3, kind: K[i], hue: null, size: 1.1, key: `${a.id}:b${i}`, want: true }));
      }
      return { items, units };
    },
    // cdClimax (game.js), timed from Z, when the first pair bursts: the pair goes up as one with no hang; the words come
    // seconds apart; the finale is one shell every 0.7 s (0.9 s reduced) from one height, so equal climbs keep the bursts
    // apart; then the drones' shell 1.2 s after the last one (no third burst in a second).
    finale(a, s) {
      const gap = s.reduced ? 900 : 700, Z = 1200, items = [], units = [unit('pair', Z, 2)];
      for (const x of [0.25, 0.75]) {
        items.push(item('rk', 0, 1900, 0, { x0: x, x1: x, y1: 0.28, ms: 1200, key: `${a.id}:pr${x}` }));
        items.push(item('bu', Z, LIFE_OF.peony, 0, { x, y: 0.28, kind: 'peony', hue: 42, size: 1.3, key: `${a.id}:p${x}`, want: true }));
      }
      if (a.words) {
        if (a.title) items.push(item('tx', Z + 200, 3400, -1, { text: a.title, x: 0.5, y: 0.15, size: 0.1, font: FONT_STACK, hue: 44, key: `${a.id}:w1` }));
        if (a.names) items.push(item('tx', Z + 3000, 4800, -1, { text: a.names, x: 0.5, y: 0.3, size: 0.13, font: FONT_STACK, hue: 40, key: `${a.id}:w2` }));
        if (a.date) items.push(item('tx', Z + 5600, 3200, -1, { text: a.date, x: 0.5, y: 0.43, size: 0.06, font: FONT_STACK, hue: 46, key: `${a.id}:w3` }));
      }
      const all = ['peony', 'chrysanthemum', 'willow', 'kamuro', 'palm', 'ring', 'heart', ENDS[a.end] || 'kamuro'];
      const types = a.shells ? all.slice(all.length - a.shells) : [], X = [0.2, 0.8, 0.5], first = Z + (a.words ? 7400 : 1400);
      const rnd = mulberry32(hash(s.seed, `${a.id}:hues`));
      types.forEach((kind, i) => {
        const off = first + i * gap, x = X[i % 3], ui = units.push(unit('shell', off)) - 1, hue = HUES[(rnd() * HUES.length) | 0];
        items.push(item('rk', off - 1200, 1900, ui, { x0: x, x1: x, y1: 0.22, ms: 1200, key: `${a.id}:sr${i}` }));
        items.push(item('bu', off, LIFE_OF[kind], ui, { x, y: 0.22, kind, hue, size: 1, key: `${a.id}:s${i}`, want: true }));
      });
      const last = types.length ? first + (types.length - 1) * gap : Z;
      // The drones write the names alone, as big as they fit: a long date ("28 November 2026") squeezed into the drone
      // mask broke its thin letters apart. The date is written under them as sharp text on a dark pill ('dc').
      const D = window.LUTSDroneShow, lines = [a.names.replace(/\n/g, ' ')].filter(Boolean);
      const drones = a.drones && !!D && typeof D.player === 'function' && lines.length > 0;
      const droneAt = last + 1200, life = drones ? num(D.LIFE, DRONE_LIFE / 1000) * 1000 : 0;
      if (drones) {
        const ui = units.push(unit('drones', droneAt)) - 1;
        items.push(item('rk', droneAt - 1200, 1500, ui, { x0: 0.5, x1: 0.5, y1: 0.42, ms: 1200, comet: true, key: `${a.id}:dr` }));
        items.push(item('dr', droneAt, life, ui, { lines, cy: 0.42, count: s.tier === 'tv' ? 900 : 1300, key: `${a.id}:d`, player: undefined }));
        if (a.date) items.push(item('dc', droneAt + 1800, Math.max(1200, life - 1800), -1, { text: String(a.date), cy: 0.42, key: `${a.id}:dc` }));
      } else if (a.date) items.push(item('dc', last + 1400, 4200, -1, { text: String(a.date), cy: 0.42, key: `${a.id}:dc` }));
      if (a.photos.length) {
        const start = Z + 500, fadeAt = drones ? droneAt - 500 : last + 2600;
        items.push(item('ht', start, Math.max(1500, fadeAt + 900 - start), -1, { photos: a.photos, fadeOff: fadeAt - start, key: `${a.id}:h` }));
      }
      const end = Math.max(...items.map((i) => i.off + i.dur)); // the finale takes the sky: whatever is under it dims
      items.push(item('dm', 0, end, -1, { level: 0.6, fadeIn: 800, fadeOut: 1500, key: `${a.id}:dm` }));
      return { items, units };
    },
  };

  // ---------- Particles of a burst (built once per stage and act, from its own seed) ----------
  const TAILS = [[[0.05, 0.45, 0.78], [0.1, 0.22, 0.6]], [[0.06, 0.55, 0.85], [0.12, 0.36, 0.72], [0.18, 0.22, 0.6], [0.24, 0.12, 0.5]]]; // [seconds back, alpha, size]
  const STREAK = 0.45; // stars without a tail streak while they are fast (their first 0.45 s)
  function buildBurst(kind, hue, size, rnd, k) {
    const B = { dx: [], dy: [], life: [], sz: [], hue: [], tone: [], k: [], g: [], gl: [], fade: [], tail: [], ch: [], keep: [], ph: [] };
    const add = (dx, dy, life, o) => {
      B.dx.push(dx); B.dy.push(dy); B.life.push(life); B.sz.push(o.sz || 2.2); B.hue.push(o.hue); B.tone.push(o.tone || 0); B.k.push(o.k || 1.5);
      B.g.push(o.g == null ? 1 : o.g); B.gl.push(o.gl || 0); B.fade.push(o.fade || 0.35); B.tail.push(o.tail ? o.tail : 0); B.ch.push(o.ch || 0);
      B.keep.push(rnd()); B.ph.push(rnd() * TAU);
    };
    const cnt = (c) => Math.max(8, Math.round(c * size * k));
    const gold = kind === 'kamuro' || (kind === 'willow' && hue == null) || (kind === 'palm' && hue == null);
    const h0 = gold ? (kind === 'willow' ? 34 : 40) : hue != null ? hue : HUES[(rnd() * HUES.length) | 0];
    const h2 = (h0 + 150 + rnd() * 60) % 360;
    const sph = (count, cb) => { // directions on a projected sphere (golden spiral): a shell's 3D look
      const off = rnd() * TAU;
      for (let i = 0; i < count; i++) { const z = 1 - (2 * (i + 0.5)) / count, r = Math.sqrt(1 - z * z), ph = i * 2.399963 + off; cb(Math.cos(ph) * r, Math.sin(ph) * r); }
    };
    switch (kind) {
      case 'chrysanthemum':
        sph(cnt(125), (dx, dy) => { const j = 0.94 + rnd() * 0.09; add(dx * j, dy * j, 1.5 + rnd() * 0.4, { sz: 2.1, hue: h0, k: 1.5, gl: 0.35, ch: 1.3 }); });
        break;
      case 'willow':
        sph(cnt(95), (dx, dy) => add(dx * 0.95, dy * 0.95, 3 + rnd() * 0.9, { sz: 1.8, hue: h0, tone: 1, k: 1.3, g: 0.85, gl: 0.7, fade: 0.55, tail: 2 }));
        break;
      case 'kamuro':
        sph(cnt(125), (dx, dy) => { const j = 0.92 + rnd() * 0.12; add(dx * j * 1.05, dy * j * 1.05, 2.6 + rnd() * 0.7, { sz: 1.8, hue: h0, tone: rnd() < 0.8 ? 1 : 2, k: 1.4, g: 0.7, gl: 1.1, fade: 0.6, tail: 1 }); });
        break;
      case 'palm': {
        const n = Math.round(9 + size * 4), off = rnd() * TAU;
        for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU + (rnd() - 0.5) * 0.2, j = (0.85 + rnd() * 0.2) * 1.1; add(Math.cos(a) * j, Math.sin(a) * j, 2 + rnd() * 0.4, { sz: 4.4, hue: h0, tone: 1, k: 1.25, gl: 1.2, fade: 0.45, tail: 2 }); }
        sph(cnt(24), (dx, dy) => add(dx * 0.32, dy * 0.32, 0.45 + rnd() * 0.1, { sz: 2, hue: 44, tone: 2, k: 2 }));
        break;
      }
      case 'ring': {
        const sq = 0.3 + rnd() * 0.7, tilt = rnd() * TAU, c = Math.cos(tilt), s = Math.sin(tilt), m = cnt(66);
        for (let i = 0; i < m; i++) { const a = (i / m) * TAU, px = Math.cos(a) * 0.95, py = Math.sin(a) * sq * 0.95; add(px * c - py * s, px * s + py * c, 1.6 + rnd() * 0.15, { sz: 2.5, hue: h0, k: 1.6 }); }
        sph(cnt(26), (dx, dy) => add(dx * 0.3, dy * 0.3, 1.15 + rnd() * 0.1, { sz: 2, hue: h2, tone: 1, k: 1.6 }));
        break;
      }
      case 'heart': {
        const m = cnt(84), hh = hue != null ? h0 : 335;
        for (let i = 0; i < m; i++) { const [x, y] = heartAt(i / m); add(x * 0.95, (y + 0.155) * 0.95, 1.8 + rnd() * 0.1, { sz: 2.5, hue: hh, k: 1.6 }); }
        sph(cnt(20), (dx, dy) => add(dx * 0.25, dy * 0.25, 1.1 + rnd() * 0.2, { sz: 2, hue: 44, tone: 1, k: 1.6 }));
        break;
      }
      default: // peony
        sph(cnt(112), (dx, dy) => { const j = 0.93 + rnd() * 0.11; add(dx * j, dy * j, 1.3 + rnd() * 0.4, { sz: 2.4, hue: h0, k: 1.6 }); });
        if (rnd() < 0.5) sph(cnt(40), (dx, dy) => add(dx * 0.5, dy * 0.5, 1.1 + rnd() * 0.3, { sz: 2.2, hue: h2, tone: 1, k: 1.6 }));
        else sph(cnt(24), (dx, dy) => add(dx * 0.28, dy * 0.28, 0.42 + rnd() * 0.13, { sz: 2.4, hue: 44, tone: 2, k: 1.6 }));
    }
    const F = (a) => Float32Array.from(a), n = B.dx.length;
    let extra = 0; for (const v of B.tail) extra += v ? TAILS[v - 1].length : 1; // a tail's samples, or one streak
    const hue0 = kind === 'heart' && hue == null ? 335 : h0;
    return { n, cost: n + extra, hue0, red: isRed(hue0),
      dx: F(B.dx), dy: F(B.dy), life: F(B.life), sz: F(B.sz), hue: F(B.hue), tone: Uint8Array.from(B.tone), k: F(B.k), g: F(B.g), gl: F(B.gl), fade: F(B.fade),
      tail: Uint8Array.from(B.tail), ch: F(B.ch), keep: F(B.keep), ph: F(B.ph), salt: (rnd() * 1e9) | 0 };
  }

  // ---------- The heart ----------
  const HEART = (() => { // the classic heart curve, its lobes up, centred, x in [-1, 1]; cum: length along it
    const N = 480, px = new Float32Array(N), py = new Float32Array(N), cum = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, s = Math.sin(a);
      px[i] = s * s * s; py[i] = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 - 0.155;
    }
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; cum[i + 1] = cum[i] + Math.hypot(px[j] - px[i], py[j] - py[i]); }
    return { N, px, py, cum, len: cum[N] };
  })();
  function heartAt(u) { // the point at share u of the outline, from the notch at the top
    const L = (((u % 1) + 1) % 1) * HEART.len;
    let lo = 0, hi = HEART.N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (HEART.cum[m] <= L) lo = m; else hi = m; }
    const j = (lo + 1) % HEART.N, f = (L - HEART.cum[lo]) / Math.max(1e-9, HEART.cum[lo + 1] - HEART.cum[lo]);
    return [lerp(HEART.px[lo], HEART.px[j], f), lerp(HEART.py[lo], HEART.py[j], f)];
  }
  function inHeart(x, y) {
    let c = false;
    for (let i = 0, j = HEART.N - 1; i < HEART.N; j = i++) {
      const yi = HEART.py[i], yj = HEART.py[j];
      if ((yi > y) !== (yj > y) && x < ((HEART.px[j] - HEART.px[i]) * (y - yi)) / (yj - yi) + HEART.px[i]) c = !c;
    }
    return c;
  }
  const LAYOUTS = new Map();
  function heartLayout(count) { // up to 48 photos: the outline first, the rest filling it from the middle
    const n = clamp(count | 0, 0, 48);
    if (LAYOUTS.has(n)) return LAYOUTS.get(n);
    const nOut = n <= 14 ? n : Math.max(14, Math.round(n * 0.6)), pts = [];
    for (let i = 0; i < nOut; i++) pts.push(heartAt(i / nOut));
    let r = (HEART.len / Math.max(1, nOut)) * 0.46;
    const rest = n - nOut;
    if (rest > 0) {
      let sp = 0.6, inner = [];
      for (let k = 0; k < 30; k++, sp *= 0.92) {
        inner = [];
        for (let row = 0, y = -0.95; y < 1.0; row++, y += sp * 0.87) for (let x = -1 + (row % 2 ? sp / 2 : 0); x <= 1; x += sp) {
          const m = sp * 0.85;
          if (inHeart(x, y) && inHeart(x + m, y) && inHeart(x - m, y) && inHeart(x, y + m) && inHeart(x, y - m)) inner.push([x, y]);
        }
        if (inner.length >= rest) break;
      }
      inner.sort((p, q) => Math.hypot(p[0], p[1] - 0.05) - Math.hypot(q[0], q[1] - 0.05) || p[0] - q[0] || p[1] - q[1]);
      for (let i = 0; i < rest && i < inner.length; i++) pts.push(inner[i]);
      r = Math.min(r, sp * 0.46);
    }
    const out = { pts, r: Math.min(r, 0.16) };
    LAYOUTS.set(n, out);
    return out;
  }

  // ---------- Text into points (names in sparks) ----------
  const REF = 96, TEXT_CAP = 900, TEXTS = new Map(), LOOSE = new Map(); // LOOSE: drawn with fallback glyphs until the fonts load
  const fontsCheck = (f, s) => { try { const F = document.fonts; return !F || typeof F.check !== 'function' || F.check(f, s); } catch (e) { return true; } };
  // The letters' points, in units of the font size, centred; step: their spacing. Cached once its fonts have loaded.
  function textPoints(str, font, weight) {
    font = font || FONT_STACK; weight = weight || 800;
    const lines = String(str == null ? '' : str).split('\n').map((l) => clean(l, 40)).filter(Boolean).slice(0, 2);
    const key = `${weight}|${font}|${lines.join('\n')}`;
    if (TEXTS.has(key)) return TEXTS.get(key);
    if (LOOSE.has(key)) return LOOSE.get(key);
    const res = { n: 0, x: new Float32Array(0), y: new Float32Array(0), w: 0, h: 0, step: 0.05, area: 0, lines: lines.length, loose: false };
    if (!lines.length || typeof document === 'undefined') return res;
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return res;
    const f = `${weight} ${REF}px ${font}`;
    g.font = f;
    const tw = Math.max(...lines.map((l) => g.measureText(l).width), 1), lh = REF * 1.4, pad = 14, k = Math.min(1, 4000 / (tw + pad * 2));
    c.width = Math.ceil((tw + pad * 2) * k); c.height = Math.ceil((lh * lines.length + pad * 2) * k);
    g.scale(k, k); g.font = f; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, (tw + pad * 2) / 2, pad + lh * (i + 0.5)));
    let d;
    try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return res; }
    let area = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 127) area++;
    let xs = [], ys = [], step = 3;
    for (; step <= 30; step++) {
      xs = []; ys = [];
      for (let row = 0, y = step / 2; y < c.height; row++, y += step * 0.87) {
        for (let x = (row % 2 ? step / 2 : 0) + step / 4; x < c.width; x += step) { const i = ((y | 0) * c.width + (x | 0)) * 4 + 3; if (d[i] > 127) { xs.push(x); ys.push(y); } }
      }
      if (xs.length <= TEXT_CAP) break;
    }
    if (xs.length > TEXT_CAP) { xs.length = TEXT_CAP; ys.length = TEXT_CAP; }
    const u = REF * k;
    res.n = xs.length; res.x = Float32Array.from(xs, (v) => (v - c.width / 2) / u); res.y = Float32Array.from(ys, (v) => (v - c.height / 2) / u);
    res.w = tw / REF; res.h = (lh * lines.length) / REF; res.step = step / u; res.area = area / (k * k);
    res.loose = !fontsCheck(f, lines.join(''));
    if (!res.loose) { TEXTS.set(key, res); if (TEXTS.size > 64) TEXTS.delete(TEXTS.keys().next().value); return res; }
    LOOSE.set(key, res); if (LOOSE.size > 64) LOOSE.delete(LOOSE.keys().next().value);
    const settle = (final) => { LOOSE.delete(key); if (final) { res.loose = false; TEXTS.set(key, res); } }; // loaded: built again; failed: the fallback stays
    try { document.fonts.load(f, lines.join('')).then(() => settle(false), () => settle(true)); } catch (e) { settle(true); }
    return res;
  }

  // ---------- Sprites: one atlas of glowing dots, 36 hues x 3 tones ----------
  const SP = 32, TONES = [[100, 60], [95, 75], [65, 93]]; // [saturation, lightness]: full colour, pastel, white-hot
  let ATLAS = null;
  function atlas() {
    if (ATLAS) return ATLAS;
    const c = document.createElement('canvas'); c.width = SP * 36; c.height = SP * TONES.length;
    const g = c.getContext('2d');
    TONES.forEach(([s, l], row) => {
      for (let b = 0; b < 36; b++) {
        const h = b * 10, cx = b * SP + SP / 2, cy = row * SP + SP / 2, gr = g.createRadialGradient(cx, cy, 0, cx, cy, SP / 2), col = (al) => `hsla(${h},${s}%,${l}%,${al})`;
        gr.addColorStop(0, `hsla(${h},${s}%,${Math.min(97, l + 30)}%,1)`); gr.addColorStop(0.16, col(1)); gr.addColorStop(0.38, col(0.42));
        gr.addColorStop(0.66, col(0.1)); gr.addColorStop(1, col(0));
        g.fillStyle = gr; g.fillRect(b * SP, row * SP, SP, SP);
      }
    });
    return (ATLAS = c);
  }
  const hueBin = (h) => ((Math.round(h / 10) % 36) + 36) % 36;
  function hslRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  // ---------- Photos: small cached copies (circle, rounded square, tile, blurred backdrop) ----------
  const PHOTOS = new WeakMap();
  const dims = (b) => { try { const w = b.naturalWidth || b.videoWidth || b.width, h = b.naturalHeight || b.videoHeight || b.height; return w > 0 && h > 0 ? [w, h] : null; } catch (e) { return null; } };
  function roundPath(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function photoCopy(b, shape, size) {
    if (!b || typeof b !== 'object') return null;
    let rec = PHOTOS.get(b);
    if (!rec) PHOTOS.set(b, (rec = {}));
    const key = shape + size;
    if (key in rec) return rec[key] && dims(b) ? rec[key] : null; // a picture closed since (an erased photo) never shows again
    let c = null;
    try {
      const d = dims(b);
      if (!d) throw new Error('no picture');
      const [w, h] = d;
      c = document.createElement('canvas');
      const g = c.getContext('2d');
      if (shape === 'b') { // a blurred backdrop: down to a few pixels, then up again with smoothing
        const t = document.createElement('canvas'), tg = t.getContext('2d'); t.width = 12; t.height = Math.max(4, Math.round((12 * h) / w));
        tg.imageSmoothingEnabled = true; tg.drawImage(b, 0, 0, t.width, t.height);
        c.width = 96; c.height = Math.max(32, Math.round((96 * h) / w)); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(t, 0, 0, c.width, c.height);
      } else {
        c.width = c.height = size; const s = Math.min(w, h);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(b, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
        if (shape === 'c' || shape === 'q') {
          g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#000';
          if (shape === 'c') { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, TAU); } else roundPath(g, 0, 0, size, size, size * 0.09);
          g.fill();
        }
      }
    } catch (e) { c = null; }
    rec[key] = c;
    return c;
  }

  // ---------- Environment ----------
  const prefersReduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  function guessTier() {
    try {
      if (document.documentElement.classList.contains('tv') || /\b(Android ?TV|GoogleTV|BRAVIA|AFT[A-Z]\w*|SMART-TV|SmartTV)\b/i.test(navigator.userAgent)) return 'tv';
      const s = Math.min(screen.width || 0, screen.height || 0);
      return s && s < 600 ? 'phone' : 'laptop';
    } catch (e) { return 'phone'; }
  }
  function ready() {
    try {
      const F = document.fonts;
      if (!F || typeof F.load !== 'function') return Promise.resolve();
      return Promise.all(['600 48px Cinzel', '800 48px Cinzel'].map((s) => F.load(s).catch(() => null))).then(() => F.ready).then(() => undefined, () => undefined);
    } catch (e) { return Promise.resolve(); }
  }

  // ---------- The stage ----------
  function stage(canvas, opts = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('EFX.stage: a canvas is needed');
    const seed = opts.seed == null ? '1' : String(opts.seed);
    const dpr = clamp(num(opts.dpr, Math.min(2, window.devicePixelRatio || 1)), 0.5, 3);
    const tier = TIERS[opts.tier] ? opts.tier : guessTier(), TK = TIERS[tier];
    const reduced = opts.reduced != null ? !!opts.reduced : prefersReduced();
    const role = ROLES.includes(opts.role) ? opts.role : 'main';
    const ctx = canvas.getContext('2d', opts.readback ? { willReadFrequently: true } : undefined);
    const env = { seed, tier, reduced, role };
    let W = 1, H = 1, sx = 1, sy = 1, bg = opts.bg == null ? null : opts.bg, disposed = false;
    const overlay = typeof opts.overlay === 'function' ? opts.overlay : null;
    // CSS px at the bottom that the screen's own text covers (a QR card, the retention line): slide captions stay above it
    const insetB = typeof opts.insetBottom === 'function' ? opts.insetBottom : () => num(opts.insetBottom, 0);
    const entries = new Map(), loops = new Set();
    let order = [], dirty = false, history = [], shownTo = -Infinity; // shownTo: the latest time rendered
    const S = { bright: [], denied: 0, moved: 0, joined: 0, particles: 0, drones: 0, flare: 0, flareMax: 0, frames: 0 };
    const L = { sl: [], mo: [], cd: [], dm: [], ht: [], rk: [], bu: [], tx: [], ph: [], dr: [], dc: [] }, FL = [];

    function resize(w, h) {
      const cw = num(w, 0) || canvas.clientWidth || canvas.width || 1, ch = num(h, 0) || canvas.clientHeight || canvas.height || 1;
      W = Math.max(1, Math.round(cw)); H = Math.max(1, Math.round(ch));
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      sx = canvas.width / W; sy = canvas.height / H;
      for (const e of entries.values()) for (const it of e.items) if (it.k === 'dr') it.unit = 0; // the drones' sprites follow the size
    }
    resize(opts.width, opts.height);

    // ----- scheduling -----
    function add(act) {
      if (disposed) return act;
      if (!act || typeof act !== 'object' || !EXPAND[act.type] || act.id == null || !Number.isFinite(act.t)) throw new TypeError('EFX: Stage.add takes an act made by EFX');
      const { items, units } = EXPAND[act.type](act, env);
      const e = { act, id: String(act.id), t: act.t, items, units, at: act.t, end: act.t };
      entries.set(e.id, e);
      for (const it of items) if (it.k === 'dr') makeDrones(it); // built now, so no frame waits for it
      dirty = true;
      return act;
    }
    function resolve() {
      dirty = false;
      order = Array.from(entries.values()).sort((a, b) => a.t - b.t || cmp(a.id, b.id));
      const gate = new FlashGate().fix(history), reqs = [];
      for (const e of order) e.units.forEach((u, i) => { u.shift = 0; u.bright = false; u.flash = null; if (role !== 'slides') reqs.push({ t: e.t + u.off, e, u, i }); });
      reqs.sort((p, q) => p.t - q.t || cmp(p.e.id, q.e.id) || p.i - q.i);
      for (const r of reqs) {
        const p = gate.place(r.t, r.u.n, r.u.spread);
        r.u.shift = p.at - r.t; r.u.bright = p.bright; r.u.flash = p.flash;
        if (p.flash) p.flash.members.push(r.e.id);
      }
      S.bright = gate.times(); S.denied = gate.denied; S.moved = gate.moved; S.joined = gate.joined;
      for (const e of order) for (const it of e.items) {
        const u = it.u >= 0 ? e.units[it.u] : null;
        it.at = e.t + it.off + (u ? u.shift : 0); it.end = it.at + it.dur; it.bright = !!(it.want && u && u.bright);
      }
      supersede();
      for (const e of order) { let lo = Infinity, hi = -Infinity; for (const it of e.items) { if (it.at < lo) lo = it.at; if (it.end > hi) hi = it.end; } e.at = lo; e.end = hi; }
    }
    // The latest mosaic takes over from the one before; a slide followed by another holds until that one has faded in.
    function supersede() {
      const mos = [], sls = [], byAt = (p, q) => p.at - q.at || cmp(p.key, q.key);
      for (const e of order) for (const it of e.items) {
        if (it.k === 'mo') { it.cut = null; it.nextHas = null; it.prevPos = null; mos.push(it); } else if (it.k === 'sl') { it.hold = false; sls.push(it); }
      }
      mos.sort(byAt);
      for (let i = 0; i + 1 < mos.length; i++) {
        const p = mos[i], q = mos[i + 1];
        p.cut = q.at; p.end = Math.min(p.end, q.at + 600);
        p.nextHas = new Set(q.a.items.map((x) => x.key)); q.prevPos = new Map(p.a.items.map((x) => [x.key, x]));
      }
      sls.sort(byAt);
      for (const s of sls) { const e0 = s.at + s.dur; for (const q of sls) if (q !== s && Math.abs(q.at - e0) <= 150) { s.hold = true; s.end = Math.max(s.end, q.at + 700); } }
    }
    // Drops one act at once (an erased or hidden photo's slide, reveal or mosaic): later acts may take its flash slot.
    // A flash it already set off stays in the gate's history (the room saw it), so the 2-a-second cap still holds.
    function remove(actOrId) {
      const id = actOrId != null && typeof actOrId === 'object' ? actOrId.id : actOrId;
      if (disposed || id == null || !entries.has(String(id))) return false;
      if (dirty) resolve();
      const e = entries.get(String(id));
      entries.delete(String(id));
      for (const u of e.units) {
        const f = u.flash;
        // a flash shared with an act that stays is placed again with that act; only a flash this act owned alone is kept
        if (f && f.start <= shownTo && !f.members.some((m) => m !== e.id && entries.has(m))) history.push({ start: f.start, last: f.last, count: f.count });
      }
      dirty = true;
      return true;
    }
    function clearBefore(tMs) {
      if (disposed) return;
      if (dirty) resolve();
      const cut = num(tMs, -Infinity), gone = new Set();
      for (const e of order) if (e.end < cut) gone.add(e.id);
      for (let changed = true; changed;) { // an act stays while it shares a flash with one that stays
        changed = false;
        for (const id of gone) { const e = entries.get(id); if (e.units.some((u) => u.flash && u.flash.members.some((m) => !gone.has(m)))) { gone.delete(id); changed = true; } }
      }
      if (!gone.size) return;
      for (const id of gone) { const e = entries.get(id); for (const u of e.units) if (u.flash) history.push(u.flash); entries.delete(id); }
      let first = Infinity;
      for (const e of entries.values()) for (const u of e.units) first = Math.min(first, e.t + u.off);
      const starts = new Set();
      history = history.filter((f) => f.last + LIMITS.gap * 4 + LIMITS.maxDelay >= Math.min(first, cut) && !starts.has(f.start) && starts.add(f.start))
        .map((f) => ({ start: f.start, last: f.last, count: f.count })).slice(-400);
      dirty = true;
    }
    function makeDrones(it) {
      const D = window.LUTSDroneShow;
      if (!D || typeof D.player !== 'function') { it.player = null; return; }
      try {
        it.player = D.player({ count: it.count, dpr, greeting: it.lines, font: FONT_STACK });
        it.unit = droneUnit(); if (typeof it.player.prepare === 'function') it.player.prepare(it.unit);
        if (!it.player.figs || !it.player.figs.greet) it.player = null;
      } catch (e) { it.player = null; }
    }
    const droneUnit = () => Math.min(W * 0.4, H * 0.36);

    // ----- drawing helpers -----
    let drawn = 0, cap = Infinity, sheet = null, dry = false, seen = 0;
    function spr(x, y, s, hue, tone, al) {
      if (al < 0.015 || x < -s || y < -s || x > W + s || y > H + s) return;
      if (dry) { seen++; return; } // counting only: how many would be drawn
      if (drawn >= cap) return;
      ctx.globalAlpha = al > 1 ? 1 : al;
      ctx.drawImage(sheet, hueBin(hue) * SP, tone * SP, SP, SP, x - s / 2, y - s / 2, s, s);
      drawn++;
    }
    const font = (weight, px) => `${weight} ${px}px ${FONT_STACK}`;
    function glowText(str, x, y, px, weight, al, maxW, color, glow) {
      if (!str || al <= 0.01 || px < 1) return;
      ctx.font = font(weight, px);
      const w = ctx.measureText(str).width;
      if (w > maxW && w > 0) { px *= maxW / w; ctx.font = font(weight, px); }
      ctx.globalAlpha = clamp(al, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color || '#fff4d8'; ctx.shadowColor = glow || 'rgba(255,186,80,0.9)'; ctx.shadowBlur = px * 0.3 * sx; ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.fillText(str, x, y);
      ctx.shadowBlur = 0;
    }
    // The finale's date: under the drones' names, gold on a dark rounded pill, so it reads over a lit landmark too.
    function drawDateCard(it, t) {
      const a = t - it.at, al = sm(a / 600) * (1 - sm((a - it.dur + 600) / 600));
      if (al <= 0.01) return;
      const u = droneUnit(), px = Math.max(12, Math.min(W, H) * 0.045);
      ctx.font = font(700, px);
      const w = Math.min(W * 0.86, ctx.measureText(it.text).width + px * 1.6), hh = px * 1.7, x = W / 2, y = H * it.cy + u * 0.48;
      ctx.save(); ctx.globalAlpha = al * 0.78; ctx.fillStyle = 'rgba(6,6,24,1)';
      const r = hh / 2; ctx.beginPath(); ctx.moveTo(x - w / 2 + r, y - r); ctx.arcTo(x + w / 2, y - r, x + w / 2, y + r, r); ctx.arcTo(x + w / 2, y + r, x - w / 2, y + r, r); ctx.arcTo(x - w / 2, y + r, x - w / 2, y - r, r); ctx.arcTo(x - w / 2, y - r, x + w / 2, y - r, r); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = al * 0.9; ctx.strokeStyle = 'rgba(255,214,140,0.85)'; ctx.lineWidth = Math.max(1, px * 0.06); ctx.stroke();
      ctx.restore();
      glowText(it.text, x, y + px * 0.04, px, 700, al, w - px, '#ffe3a3', 'rgba(255,170,60,0.85)');
    }
    function fitLine(str, maxW) { // the line as it fits, with an ellipsis
      if (ctx.measureText(str).width <= maxW) return str;
      const a = Array.from(str);
      while (a.length > 1 && ctx.measureText(`${a.join('')}…`).width > maxW) a.pop();
      return `${a.join('').trim()}…`;
    }
    function wrap(str, px, weight, maxW, most) {
      if (!str) return [];
      ctx.font = font(weight, px);
      const words = str.split(' '), out = [];
      let cur = '';
      for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (!cur || ctx.measureText(next).width <= maxW) cur = next; else { out.push(cur); cur = w; } }
      if (cur) out.push(cur);
      if (out.length > most) { const rest = out.slice(most - 1).join(' '); out.length = most; out[most - 1] = fitLine(rest, maxW); }
      return out;
    }
    function placeholder(x, y, r, round) { // a photo that cannot be drawn: a warm glow in its place, never a broken frame
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,214,140,0.9)'); g.addColorStop(0.7, 'rgba(214,120,40,0.55)'); g.addColorStop(1, 'rgba(120,50,20,0.35)');
      ctx.fillStyle = g;
      if (round) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } else ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function photo(b, x, y, r, shape, size, al) {
      if (al <= 0.004 || r < 0.5) return;
      ctx.globalAlpha = clamp(al, 0, 1);
      const c = photoCopy(b, shape, size);
      if (c) ctx.drawImage(c, x - r, y - r, r * 2, r * 2); else placeholder(x, y, r, shape === 'c');
    }
    function ring(x, y, r, shape, al, M) {
      ctx.globalAlpha = clamp(al, 0, 1); ctx.lineWidth = Math.max(1.5, 0.007 * M); ctx.strokeStyle = 'rgba(255,214,130,0.95)';
      ctx.shadowColor = 'rgba(255,180,70,0.85)'; ctx.shadowBlur = 0.025 * M * sx;
      if (shape === 'c') { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); } else roundPath(ctx, x - r, y - r, r * 2, r * 2, r * 0.18);
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    function drawBg() {
      if (!bg) return;
      if (typeof bg === 'string') { ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); return; }
      const d = dims(bg);
      if (!d) return;
      const k = Math.max(W / d[0], H / d[1]), w = d[0] * k, h = d[1] * k;
      try { ctx.globalAlpha = 1; ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h); } catch (e) { bg = null; }
    }

    // ----- layers -----
    function drawSlide(it, t, M) {
      const A = it.a, a = t - it.at;
      let al = sm(a / 700);
      if (!it.hold) al *= 1 - sm((a - (it.dur - 700)) / 700);
      if (al <= 0.004) return;
      const d = A.photo && dims(A.photo);
      if (!d) { ctx.globalAlpha = al; placeholder(W / 2, H / 2, M * 0.25, true); return; }
      const bl = photoCopy(A.photo, 'b', 0);
      if (bl) { // the photo's own colours, blurred, behind it
        const k = Math.max(W / bl.width, H / bl.height);
        ctx.globalAlpha = al * 0.6; ctx.imageSmoothingEnabled = true; ctx.drawImage(bl, (W - bl.width * k) / 2, (H - bl.height * k) / 2, bl.width * k, bl.height * k);
        ctx.globalAlpha = al * 0.45; ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, W, H);
      }
      const u = clamp(a / it.dur, 0, 1.15), z = reduced ? 1 : lerp(it.z0, it.z1, u);
      const px = reduced ? 0 : lerp(it.px0, it.px1, u) * M, py = reduced ? 0 : lerp(it.py0, it.py1, u) * M;
      const k = Math.min((W * 0.94) / d[0], (H * 0.88) / d[1]) * z, w = d[0] * k, h = d[1] * k;
      try { ctx.globalAlpha = al; ctx.drawImage(A.photo, (W - w) / 2 + px, (H - h) / 2 + py, w, h); } catch (e) { placeholder(W / 2, H / 2, Math.min(w, h) / 2, true); }
      const lines = [];
      if (A.caption) lines.push([A.caption, 0.042, '#ffffff']);
      if (A.name) lines.push([fill('Photo by {0}', A.name), 0.03, '#ffd88a']);
      if (A.mission) lines.push([fill('Mission: {0}', A.mission), 0.028, '#ffd88a']);
      if (lines.length) {
        let ib = 0; try { ib = clamp(+insetB() || 0, 0, H * 0.4); } catch (e) { ib = 0; }
        const band = H * 0.2, gr = ctx.createLinearGradient(0, H - ib - band, 0, H - ib);
        gr.addColorStop(0, 'rgba(4,3,14,0)'); gr.addColorStop(1, 'rgba(4,3,14,0.72)');
        ctx.globalAlpha = al; ctx.fillStyle = gr; ctx.fillRect(0, H - ib - band, W, band);
        if (ib) { ctx.fillStyle = 'rgba(4,3,14,0.72)'; ctx.fillRect(0, H - ib, W, ib); }
        let y = H - ib - M * 0.045 - lines.reduce((s, l) => s + l[1] * M * 1.35, 0) + lines[0][1] * M * 0.7;
        for (const [s, k2, col] of lines) { glowText(s, W / 2, y, k2 * M, 600, al, W * 0.7, col, 'rgba(0,0,0,0.7)'); y += k2 * M * 1.35; }
      }
    }
    function drawMosaic(it, t, M) {
      const A = it.a, a = t - it.at, tiles = A.items, n = tiles.length, st = Math.min(25, 1500 / Math.max(1, n));
      const after = it.cut != null && t >= it.cut;
      for (let i = 0; i < n; i++) {
        const T2 = tiles[i];
        let x = T2.x * W, y = T2.y * H, r = T2.r * M, al = 1, t0 = 0;
        if (after) {
          if (!reduced && it.nextHas && it.nextHas.has(T2.key)) continue; // the next mosaic carries it
          al = 1 - sm((t - it.cut) / 600);
        } else {
          const pv = it.prevPos && it.prevPos.get(T2.key);
          if (pv && !reduced) { const v = sm(a / 600); x = lerp(pv.x * W, x, v); y = lerp(pv.y * H, y, v); r = lerp(pv.r * M, r, v); } else {
            t0 = T2.at != null ? Math.max(0, T2.at - it.at) : pv ? 0 : i * st;
            al = sm((a - t0) / (A.develop ? 1200 : 500));
          }
        }
        if (al <= 0.004 || r < 0.5 || x < -r || y < -r || x > W + r || y > H + r) continue;
        ctx.globalAlpha = al;
        try {
          if (T2.sw) ctx.drawImage(T2.bitmap, T2.sx, T2.sy, T2.sw, T2.sh, x - r, y - r, r * 2, r * 2);
          else { const c = photoCopy(T2.bitmap, 's', 128); if (c) ctx.drawImage(c, x - r, y - r, r * 2, r * 2); else placeholder(x, y, r, false); }
        } catch (e) { placeholder(x, y, r, false); }
        if (A.develop) { // fades in from sepia: the colour comes up over 2.5 s, with no flash
          const dv = 1 - sm((a - t0 - 300) / 2500);
          if (dv > 0.01) { ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = al * dv; ctx.fillStyle = '#9a6a38'; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over'; }
        }
        ctx.globalAlpha = al * 0.6; ctx.lineWidth = Math.max(1, r * 0.04); ctx.strokeStyle = '#ffd282'; ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // The sky under a full countdown, a reveal or the finale dims, so their words read over a busy mosaic or slide: one
    // fill at the strongest of them, faded in and out over 0.5 s or more (never a flash).
    function drawDim(t) {
      let al = 0;
      for (const it of L.cd) if (it.a.style === 'full') al = Math.max(al, 0.62 * sm((t - it.at) / 600) * (1 - sm((t - it.a.endsAt) / 600)));
      for (const it of L.ph) { const a = t - it.at; al = Math.max(al, 0.5 * sm((a - 900) / 600) * (1 - sm((a - REVEAL.leave - 100) / 500))); }
      for (const it of L.dm) { const a = t - it.at; al = Math.max(al, it.level * sm(a / it.fadeIn) * (1 - sm((a - (it.dur - it.fadeOut)) / it.fadeOut))); }
      if (al > 0.003) { ctx.globalAlpha = al; ctx.fillStyle = '#04030e'; ctx.fillRect(0, 0, W, H); }
    }
    const pad2 = (v) => String(v).padStart(2, '0');
    const clock = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad2(m)}:${pad2(x)}` : `${pad2(m)}:${pad2(x)}`; };
    function digits(str, x, y, px, al, maxW) { // each figure in a cell of its own, so the clock never jitters as it counts
      ctx.font = font(800, px);
      let cell = 0;
      for (let d = 0; d <= 9; d++) cell = Math.max(cell, ctx.measureText(String(d)).width);
      const wOf = (ch) => (ch === ':' ? cell * 0.5 : cell), total = Array.from(str).reduce((s, ch) => s + wOf(ch), 0);
      if (total > maxW) { const k = maxW / total; px *= k; cell *= k; ctx.font = font(800, px); }
      let cx = x - Array.from(str).reduce((s, ch) => s + wOf(ch), 0) / 2;
      ctx.globalAlpha = clamp(al, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9b8'; ctx.shadowColor = 'rgba(255,170,60,0.85)'; ctx.shadowBlur = px * 0.18 * sx;
      for (const ch of str) { const w = wOf(ch); ctx.fillText(ch, cx + w / 2, y); cx += w; }
      ctx.shadowBlur = 0;
    }
    function drawCountdown(it, t, M) {
      const A = it.a;
      if (t >= A.endsAt) return;
      const msLeft = A.endsAt - t, left = Math.ceil(msLeft / 1000), al = sm((t - it.at) / 600);
      if (A.style === 'full') {
        const lines = wrap(A.label, 0.06 * M, 600, W * 0.86, 2);
        lines.forEach((l, i) => glowText(l, W / 2, H * 0.27 + i * 0.075 * M, 0.06 * M, 600, al, W * 0.86));
        if (left > 10) digits(clock(left), W / 2, H * 0.57, 0.2 * M, al, W * 0.9);
        else { const into = 1 - (msLeft / 1000 - (left - 1)), k = reduced ? 1 : 1 + 0.12 * (1 - sm(into / 0.3)); digits(String(left), W / 2, H * 0.57, 0.34 * M * k, al, W * 0.9); }
        return;
      }
      const r = 0.07 * M, m = 0.035 * M, left2 = /l$/.test(A.corner), top = /^t/.test(A.corner), lab = 0.026 * M;
      const cx = left2 ? m + r : W - m - r, cy = top ? m + r : H - m - r - lab * 1.6, frac = clamp(msLeft / Math.max(1, A.endsAt - A.t), 0, 1);
      ctx.globalAlpha = al; ctx.fillStyle = 'rgba(8,6,20,0.66)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(2, 0.011 * M); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, 0, TAU); ctx.stroke();
      if (frac > 0.002) { ctx.strokeStyle = '#ffcf6b'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.stroke(); }
      digits(clock(left).replace(/^0(\d:)/, '$1'), cx, cy, 0.036 * M, al, r * 1.4);
      if (A.label) {
        ctx.font = font(600, lab);
        const maxW = Math.min(W >= H ? W * 0.32 : W * 0.62, W - m * 2), s = fitLine(A.label, maxW), w = ctx.measureText(s).width;
        const lx = clamp(cx, m + w / 2, W - m - w / 2), ly = cy + r + lab * 1.1;
        ctx.globalAlpha = al; ctx.fillStyle = 'rgba(8,6,20,0.66)'; roundPath(ctx, lx - w / 2 - lab * 0.5, ly - lab * 0.75, w + lab, lab * 1.5, lab * 0.75); ctx.fill();
        glowText(s, lx, ly, lab, 600, al, maxW, '#ffe9b8', 'rgba(0,0,0,0.85)');
      }
    }
    function drawHeart(it, t, M) {
      const Lh = heartLayout(it.photos.length), n = Lh.pts.length;
      if (!n) return;
      if (!it.R) { const rnd = mulberry32(hash(seed, it.key)), R = []; for (let i = 0; i < n; i++) { const a = rnd() * TAU; R.push([0.5 + Math.cos(a) * 0.85, 0.5 + Math.sin(a) * 0.85]); } it.R = R; }
      const a = t - it.at, s = Math.min(0.3 * W, 0.27 * H), cx = 0.5 * W, cy = 0.66 * H, fade = 1 - sm((a - it.fadeOff) / 900);
      const k = reduced ? 1 : 1 + 0.02 * Math.sin((a / 1000) * 2.2), r = Lh.r * s, stg = Math.min(60, 1600 / n);
      for (let i = 0; i < n; i++) {
        const u = (a - i * stg) / 1200;
        if (u <= 0) continue;
        const tx = cx + Lh.pts[i][0] * s * k, ty = cy + Lh.pts[i][1] * s * k;
        let x = tx, y = ty, al = fade;
        if (reduced) al *= sm(u); else { const e = sm(u); x = lerp(it.R[i][0] * W, tx, e); y = lerp(it.R[i][1] * H, ty, e); al *= Math.min(1, u * 2.5); }
        photo(it.photos[i], x, y, r, 'c', 160, al);
        ring(x, y, r, 'c', al * 0.8, M * 0.5);
      }
    }
    function drawFlares(t, M) {
      FL.length = 0;
      let tot = 0;
      for (const it of L.bu) {
        if (!it.bright) continue;
        const a = t - it.at;
        if (a < 0 || a > 800) continue;
        const env = sm(a / 70) * Math.exp(-Math.max(0, a - 70) / 170);
        if (env < 0.01) continue;
        FL.push(it, env); tot += env * LIMITS.flare;
      }
      const k = tot > LIMITS.flare ? LIMITS.flare / tot : 1;
      let sum = 0;
      for (let i = 0; i < FL.length; i += 2) {
        const it = FL[i], al = FL[i + 1] * LIMITS.flare * k, P = parts(it), red = P.red;
        const [r0, g0, b0] = hslRgb(P.hue0, 85, 62), m = red ? 0.75 : 0.5, col = [r0 + (255 - r0) * m, g0 + (214 - g0) * m, b0 + (160 - b0) * m].map(Math.round).join(',');
        const x = it.x * W, y = it.y * H;
        let rad = 0.6 * Math.hypot(W, H);
        if (red) rad = Math.min(rad, Math.sqrt((LIMITS.red * W * H) / Math.PI)); // a red flare stays within a quarter of the frame
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(0.3, `rgba(${col},${al * 0.5})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.globalAlpha = 1; ctx.fillStyle = gr;
        ctx.fillRect(Math.max(0, x - rad), Math.max(0, y - rad), Math.min(W, x + rad) - Math.max(0, x - rad), Math.min(H, y + rad) - Math.max(0, y - rad));
        sum += al;
      }
      S.flare = sum; if (sum > S.flareMax) S.flareMax = sum;
    }
    const parts = (it) => it.P || (it.P = buildBurst(it.kind, it.hue, it.size, mulberry32(hash(seed, it.key)), TK.k));
    function alive(it, t) { // the sprites a burst will draw at t: its live stars, their tail samples and streaks
      const P = parts(it), a = (t - it.at) / 1000;
      let n = 0;
      if (a < 0) return 0;
      for (let i = 0; i < P.n; i++) {
        if (a > P.life[i]) continue;
        n++;
        if (P.tail[i]) { for (const tl of TAILS[P.tail[i] - 1]) if (a > tl[0]) n++; } else if (a > 0.03 && a < STREAK) n++;
      }
      return n;
    }
    function drawBurst(it, t, M, f) {
      const P = parts(it), a = (t - it.at) / 1000;
      if (a < 0) return;
      let R = 0.2 * M * it.size;
      if (P.red) R = Math.min(R, 0.28 * Math.sqrt(W * H)); // a red burst's disc stays within a quarter of the frame
      const G = 0.1 * M, cx = it.x * W, cy = it.y * H, S0 = Math.max(1.6, 0.009 * M), bright = it.bright, dim = bright ? 1 : LIMITS.dim;
      for (let i = 0; i < P.n; i++) {
        if (P.keep[i] >= f) continue;
        const life = P.life[i];
        if (a > life) continue;
        const k = P.k[i], e = Math.exp(-k * a), s1 = 1 - e, gk = (G * P.g[i]) / k;
        const x = cx + P.dx[i] * R * s1, y = cy + P.dy[i] * R * s1 + gk * (a - s1 / k);
        let al = a < 0.04 ? a / 0.04 : 1;
        const fs = life * (1 - P.fade[i]);
        if (a > fs) al *= 1 - (a - fs) / (life - fs);
        const gl = P.gl[i];
        if (gl) al *= reduced ? 1 - 0.22 * Math.min(1, gl) * (0.5 + 0.5 * Math.sin(a * 5 + P.ph[i])) : bit(i * 31 + P.salt, (a * 14) | 0) < 0.5 ? 1 : 1 - 0.6 * Math.min(1, gl);
        al *= dim;
        let tone = P.tone[i], hue = P.hue[i];
        if (bright && a < 0.1) tone = 2; // white-hot as it breaks
        if (P.ch[i] && a > P.ch[i]) { hue = 20; tone = 0; al *= 0.8; } // cooled to embers, all at once
        const ss = S0 * P.sz[i];
        spr(x, y, ss, hue, tone, al);
        if (P.tail[i]) for (const [b, ka, ks] of TAILS[P.tail[i] - 1]) {
          const a2 = a - b;
          if (a2 <= 0) break;
          const e2 = Math.exp(-k * a2), s2 = 1 - e2;
          spr(cx + P.dx[i] * R * s2, cy + P.dy[i] * R * s2 + gk * (a2 - s2 / k), ss * ks, hue, tone, al * ka);
        } else if (a > 0.03 && a < STREAK) { // speed shows as a short streak, gone as the star slows
          const a2 = a - 0.03, e2 = Math.exp(-k * a2), s2 = 1 - e2;
          spr(cx + P.dx[i] * R * s2, cy + P.dy[i] * R * s2 + gk * (a2 - s2 / k), ss * 0.8, hue, tone, al * 0.5 * (1 - a / STREAK));
        }
      }
    }
    const RK = 16;
    function drawRocket(it, t, M, f) {
      if (!it.P) { const rnd = mulberry32(hash(seed, it.key)), P = []; for (let k = 0; k < RK; k++) P.push([0.35 + rnd() * 0.35, (rnd() - 0.5) * 0.05, rnd()]); it.P = P; }
      const a = t - it.at, u = a / it.ms, S0 = Math.max(1.6, 0.009 * M), G = 0.1 * M, y0 = 1.03;
      const at = (v) => { const e = 1 - (1 - v) * (1 - v); return [lerp(it.x0, it.x1, e) * W, lerp(y0, it.y1, e) * H]; };
      for (let k = 0; k < RK; k++) { // the trail: sparks shed along the climb, each falling from where it was shed
        const [life, dx, keep] = it.P[k];
        if (keep >= f) continue;
        const uk = (k + 0.5) / RK, age = (a - uk * it.ms) / 1000;
        if (age < 0 || age > life) continue;
        const [px, py] = at(uk);
        spr(px + dx * M * age, py + 0.5 * G * 0.6 * age * age, S0 * 1.5, 36, 1, (1 - age / life) * 0.75);
      }
      if (u >= 0 && u < 1) {
        const [hx, hy] = at(u);
        spr(hx, hy, S0 * (it.comet ? 3.4 : 2.4), 40, 2, 1);
        if (it.comet) spr(hx, hy, S0 * 6, 36, 1, 0.35);
      }
    }
    function drawText(it, t, M, f) {
      let tp = it.tp;
      if (!tp || tp.loose) tp = it.tp = textPoints(it.text, it.font, 800);
      if (!tp.n) return;
      if (!it.R || it.R.n !== tp.n) {
        const rnd = mulberry32(hash(seed, it.key)), n = tp.n, R = { n, d: new Float32Array(n), sx: new Float32Array(n), sy: new Float32Array(n), ph: new Float32Array(n), vy: new Float32Array(n), w: new Uint8Array(n), keep: new Float32Array(n) };
        for (let i = 0; i < n; i++) { R.d[i] = rnd() * 0.25; const an = rnd() * TAU, rr = rnd() * 0.06; R.sx[i] = Math.cos(an) * rr; R.sy[i] = Math.sin(an) * rr; R.ph[i] = rnd() * TAU; R.vy[i] = rnd(); R.w[i] = rnd() < 0.3 ? 1 : 0; R.keep[i] = rnd(); }
        it.R = R;
      }
      const R = it.R, a = (t - it.at) / 1000, T2 = it.dur / 1000, G = 0.1 * M;
      let scale = it.size * M;
      if (tp.w * scale > W * 0.92) scale = (W * 0.92) / tp.w;
      const cx = it.x * W, cy = it.y * H, ss = Math.max(1.8, tp.step * scale * 1.9), hue = it.hue != null ? it.hue : 42;
      const glow = sm((a - 0.6) / 0.5) * (1 - sm((a - (T2 - 0.9)) / 0.6)); // the letters themselves, softly, so a name reads
      if (glow > 0.01 && !dry) {
        const lines = it.text.split('\n'), lh = 1.4 * scale;
        ctx.font = `800 ${scale}px ${it.font || FONT_STACK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.3 * glow;
        ctx.fillStyle = `hsl(${hue},90%,62%)`; ctx.shadowColor = `hsl(${hue},100%,55%)`; ctx.shadowBlur = scale * 0.35 * sx;
        lines.forEach((l, i) => ctx.fillText(l, cx, cy + (i + 0.5 - lines.length / 2) * lh));
        ctx.shadowBlur = 0;
      }
      for (let i = 0; i < tp.n; i++) {
        if (R.keep[i] >= f) continue;
        const u = (a - R.d[i]) / 0.65;
        if (u <= 0) continue;
        const e = out3(u), tx = cx + tp.x[i] * scale, ty = cy + tp.y[i] * scale;
        const x = lerp(cx + R.sx[i] * M, tx, e);
        let y = lerp(cy + R.sy[i] * M, ty, e), al = Math.min(1, u * 4);
        if (!reduced) al *= 0.82 + 0.18 * Math.sin(a * 6 + R.ph[i]);
        const fall = a - (T2 - 0.9);
        if (fall > 0) { y += 0.3 * G * fall * fall + R.vy[i] * fall * M * 0.02; al *= Math.max(0, 1 - fall / 0.9); }
        spr(x, y, ss, hue, R.w[i] ? 2 : 1, al);
      }
    }
    const SPARKS = 24;
    function revealGeom(it, t, M) {
      const A = it.a, a = t - it.at, cx0 = A.x * W, cy0 = A.y * H, r0 = (A.upload ? 0.19 : 0.17) * M;
      let cx = cx0, cy = cy0, r = r0, al = 1;
      if (a < REVEAL.rise) return null;
      if (a < REVEAL.grown) { const u = (a - REVEAL.rise) / (REVEAL.grown - REVEAL.rise); r = r0 * (reduced ? lerp(0.9, 1, sm(u)) : back(u)); al = reduced ? sm(u) : Math.min(1, u * 3); } else if (a >= REVEAL.leave) {
        const v = sm((a - REVEAL.leave) / (REVEAL.done - REVEAL.leave));
        if (A.slot) { cx = lerp(cx0, A.slot.x * W, v); cy = lerp(cy0, A.slot.y * H, v); r = lerp(r0, A.slot.r * M, v); } else { r = r0 * lerp(1, 0.85, v); al = 1 - v; }
      }
      return { a, cx0, cy0, r0, cx, cy, r, al };
    }
    function drawRevealSparks(it, t, M, f) {
      const g = revealGeom(it, t, M);
      if (!g || g.a >= REVEAL.leave) return;
      if (!it.P) { const rnd = mulberry32(hash(seed, it.key)), P = []; for (let k = 0; k < SPARKS; k++) P.push([rnd() * TAU, 1.08 + rnd() * 0.18, rnd() * TAU, rnd()]); it.P = P; }
      const w = sm((g.a - REVEAL.grown + 300) / 500) * (1 - sm((g.a - REVEAL.leave + 300) / 300)), S0 = Math.max(1.6, 0.009 * M);
      if (w <= 0.01) return;
      for (const [an, rr, ph, keep] of it.P) {
        if (keep >= f) continue;
        const ang = an + (reduced ? 0 : (g.a / 1000) * 0.35);
        spr(g.cx + Math.cos(ang) * g.r * rr, g.cy + Math.sin(ang) * g.r * rr, S0 * 1.8, 44, 1, w * (reduced ? 0.7 : 0.45 + 0.35 * Math.sin(g.a / 160 + ph)));
      }
    }
    function drawReveal(it, t, M) {
      const g = revealGeom(it, t, M);
      if (!g || g.r < 0.5 || g.al <= 0.01) return;
      const A = it.a, shape = A.upload ? 'q' : 'c';
      if (A.photo) photo(A.photo, g.cx, g.cy, g.r, shape, 512, g.al); else { ctx.globalAlpha = g.al; placeholder(g.cx, g.cy, g.r, shape === 'c'); }
      ring(g.cx, g.cy, g.r, shape, g.al, M);
      const ta = sm((g.a - REVEAL.grown) / 400) * (1 - sm((g.a - REVEAL.leave) / 300));
      if (ta <= 0.01) return;
      let y = g.cy0 + g.r0 + 0.065 * M;
      const maxW = W * 0.86;
      if (A.upload) {
        for (const l of wrap(A.caption, 0.05 * M, 600, maxW, 2)) { glowText(l, W * A.x, y, 0.05 * M, 600, ta, maxW); y += 0.062 * M; }
        if (A.name) { glowText(fill('Photo by {0}', A.name), W * A.x, y, 0.034 * M, 600, ta, maxW, '#ffe2a6'); y += 0.05 * M; }
        if (A.mission) glowText(fill('Mission: {0}', A.mission), W * A.x, y, 0.032 * M, 600, ta, maxW, '#ffe2a6');
      } else {
        if (A.name) { glowText(A.name, W * A.x, y, 0.075 * M, 800, ta, maxW); y += 0.085 * M; }
        for (const l of wrap(A.wish, 0.04 * M, 600, maxW, 2)) { glowText(l, W * A.x, y, 0.04 * M, 600, ta, maxW, '#ffe9c4'); y += 0.052 * M; }
      }
    }
    function drawDrones(it, t) {
      if (it.player === undefined) makeDrones(it);
      const pl = it.player, age = (t - it.at) / 1000;
      if (!pl || age < 0 || age * 1000 >= it.dur) return 0;
      try {
        const u = droneUnit();
        if (it.unit !== u && typeof pl.prepare === 'function') { pl.prepare(u); it.unit = u; }
        pl.fire('greet'); if (age > 0) pl.tick(age);
        if (!pl.on) return 0;
        pl.draw(ctx, W, H, W * 0.5, H * it.cy, u, tier === 'tv', false);
        ctx.globalCompositeOperation = 'lighter';
        return pl.figs.greet.n;
      } catch (e) { it.player = null; return 0; }
    }

    // Everything that sparkles, names first, so the budget's last trim (if any) falls on a burst, never on a name.
    // Drawn with 'lighter', which adds light in any order.
    function sparkle(t, M, f) {
      for (const it of L.tx) drawText(it, t, M, f);
      for (const it of L.ph) drawRevealSparks(it, t, M, f);
      for (const it of L.rk) drawRocket(it, t, M, f);
      for (const it of L.bu) drawBurst(it, t, M, f);
    }

    // ----- one frame -----
    function render(tMs) {
      if (disposed || !ctx) return;
      const t = num(tMs, 0);
      if (t > shownTo) shownTo = t;
      if (dirty) resolve();
      sheet = atlas();
      const M = Math.min(W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      ctx.imageSmoothingEnabled = true;
      drawBg();
      for (const k in L) L[k].length = 0;
      for (const e of order) {
        if (e.at > t || e.end <= t) continue;
        for (const it of e.items) if (it.at <= t && t < it.end) L[it.k].push(it);
      }
      // the particle budget, shared by everything that sparkles (fewer drawn evenly when it runs over)
      let cost = 0, dr = 0;
      for (const it of L.dr) if (it.player) dr += it.count;
      for (const it of L.bu) cost += alive(it, t);
      for (const it of L.rk) cost += RK + 1;
      for (const it of L.ph) cost += SPARKS;
      for (const it of L.tx) { if (!it.tp || it.tp.loose) it.tp = textPoints(it.text, it.font, 800); cost += it.tp.n; }
      const budget = Math.max(300, TK.budget - dr);
      let f = 1;
      if (cost > budget) { // over budget: count what would really show (faint and off-screen stars draw nothing), thin evenly
        dry = true; seen = 0;
        try { sparkle(t, M, 1); } finally { dry = false; }
        f = seen > budget ? budget / seen : 1;
      }
      drawn = 0; cap = budget;
      for (const it of L.sl) drawSlide(it, t, M);
      for (const it of L.mo) drawMosaic(it, t, M);
      drawDim(t);
      for (const it of L.ht) drawHeart(it, t, M);
      ctx.globalCompositeOperation = 'lighter';
      drawFlares(t, M);
      sparkle(t, M, f);
      let lights = 0;
      for (const it of L.dr) lights += drawDrones(it, t);
      cap = Infinity;
      ctx.globalCompositeOperation = 'source-over';
      for (const it of L.ph) drawReveal(it, t, M);
      for (const it of L.cd) drawCountdown(it, t, M);
      for (const it of L.dc) drawDateCard(it, t);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      S.particles = drawn + lights; S.drones = lights; S.frames++;
      if (!L.bu.length) S.flare = 0;
      if (overlay) { ctx.save(); try { overlay(ctx, W, H, t); } catch (e) { /* the caller's overlay never stops a frame */ } ctx.restore(); }
    }

    function when(act) {
      if (!act || act.id == null) return null;
      if (dirty) resolve();
      const e = entries.get(String(act.id));
      if (!e) return null;
      const d = e.items.find((i) => i.k === 'dr');
      return { at: e.at, end: e.end, units: e.units.map((u) => ({ tag: u.tag, t: e.t + u.off + u.shift, bright: u.bright, moved: u.shift })), drones: d && d.player ? d.at : null };
    }
    function stats() {
      if (dirty) resolve();
      return { bright: S.bright.slice(), denied: S.denied, moved: S.moved, joined: S.joined, particles: S.particles, drones: S.drones, flare: S.flare, flareMax: S.flareMax, frames: S.frames };
    }
    function loop(now, o = {}) {
      const clockFn = typeof now === 'function' ? now : () => Date.now(), every = 1000 / clamp(num(o.fps, TK.fps), 1, 120);
      let id = 0, last = -Infinity, on = true;
      const step = (ts) => {
        if (!on || disposed) return;
        id = requestAnimationFrame(step);
        if (ts - last < every - 1.5) return;
        last = ts;
        try { render(clockFn()); } catch (err) { if (typeof o.onError === 'function') o.onError(err); else if (window.console) console.warn('EFX frame', err); }
      };
      id = requestAnimationFrame(step);
      const h = { stop() { on = false; cancelAnimationFrame(id); loops.delete(h); } };
      loops.add(h);
      return h;
    }
    function dispose() {
      if (disposed) return;
      for (const h of Array.from(loops)) h.stop();
      disposed = true; entries.clear(); order = []; history = []; shownTo = -Infinity;
      Object.assign(S, { bright: [], denied: 0, moved: 0, joined: 0, particles: 0, drones: 0, flare: 0 });
      for (const k in L) L[k].length = 0;
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (e) { /* a lost context */ }
    }
    return {
      canvas, seed, dpr, tier, reduced, role,
      get width() { return W; }, get height() { return H; },
      render, add, remove, clearBefore, stats, when, resize: (w, h) => { resize(w, h); }, dispose, loop,
      setBg(b) { bg = b == null ? null : b; },
    };
  }

  // A grid for a mosaic: n tiles as large as fit in a box (fractions of the canvas), for a canvas of the given aspect.
  function grid(count, o = {}) {
    const N = clamp(Math.floor(num(count, 0)), 0, 5000), aspect = clamp(num(o.aspect, 16 / 9), 0.2, 5), b = o.box || {};
    const x0 = num(b.x0, 0.03), y0 = num(b.y0, 0.1), x1 = num(b.x1, 0.97), y1 = num(b.y1, 0.9), gap = clamp(num(o.gap, 0.1), 0, 0.6);
    if (!N || x1 <= x0 || y1 <= y0) return [];
    const bw = (x1 - x0) * aspect, bh = y1 - y0; // in units of the canvas's height
    let best = null;
    for (let c = 1; c <= N; c++) { const r = Math.ceil(N / c), s = Math.min(bw / c, bh / r); if (!best || s > best.s) best = { c, r, s }; }
    const { c, r, s } = best, ox = x0 * aspect + (bw - c * s) / 2, oy = y0 + (bh - r * s) / 2, minSide = Math.min(aspect, 1), out = [];
    for (let i = 0; i < N; i++) { const col = i % c, row = (i / c) | 0; out.push({ x: (ox + (col + 0.5) * s) / aspect, y: oy + (row + 0.5) * s, r: (s * (1 - gap)) / 2 / minSide }); }
    return out;
  }

  window.EFX = Object.freeze({
    stage, burst, rocket, textSparks, reveal, slide, mosaic, countdown, finale,
    FlashGate, FONT_STACK, LIMITS, TIERS, KINDS: KINDS.slice(), REVEAL: Object.freeze({ ...REVEAL }),
    textPoints, grid, ready, hash, mulberry32, version: 1,
  });
})();
