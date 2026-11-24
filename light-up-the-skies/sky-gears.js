// Sky Gears: a toothed gear rolls inside a ring, around a fixed gear or along a bar, and a pen in one of its holes draws
// glowing loops on the night sky. Drag a finger round the screen to roll it, hold the big button to spin it, or let
// Finish close the pattern. Launch sends the drawing up as a real firework over the game's sky (a 'drawing' shell, see
// game.js drawingBurst); a drawing saved as a signature can be launched again and flies in Live Sky shows. Some pieces,
// gears and pens unlock once for gems (or all with Premium), and each new pattern pays a few gems (SHOP, reward()).
// The geometry (Rig) is plain hypotrochoid / epitrochoid maths with no DOM, so the tests load this file in Node too.
// Everything is measured in tooth units: a gear of T teeth has a pitch radius of T, and the screen scales by its pitch
// (CSS px per tooth).
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const STEP_ANGLE = (0.5 * Math.PI) / 180; // at most 0.5° of travel between two traced points
  const STEP_PX = 2; // and at most 2 px of pen travel
  const TRACE_CAP = 1 << 20; // a sanity bound only: a long span (a stalled frame during Finish) is traced in full, never coarser

  // ---------- The pieces ----------
  const GEAR_TEETH = [24, 30, 32, 36, 40, 45, 48, 50, 52, 56, 60, 63, 64, 72, 75, 80, 84];
  const FIXED = [
    { id: 'ring96', kind: 'ring', inner: 96, outer: 144, label: 'Ring 96/144' },
    { id: 'ring105', kind: 'ring', inner: 105, outer: 150, label: 'Ring 105/150' },
    { id: 'beam144', kind: 'beam', length: 144, width: 20, label: 'Bar 144' },
    { id: 'beam150', kind: 'beam', length: 150, width: 20, label: 'Bar 150' },
    ...GEAR_TEETH.map((t) => ({ id: `gear${t}`, kind: 'gear', teeth: t, label: String(t) })),
  ];
  const ROLLING = GEAR_TEETH.slice();
  const DEFAULTS = { fixed: 'ring96', rolling: 52, hole: 3 };
  const RING_REF = 144; // the 144-tooth ring's outer edge fills ~90% of the drawing area's shorter side
  const pitchFor = (w, h) => (0.45 * Math.min(w, h)) / RING_REF;

  function gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }
  const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const frac = (x) => x - Math.floor(x);

  // Holes lie on a spiral from near the centre (round, gentle curves) to near the rim (loopy ones). Bigger gears have more.
  const holeCount = (Tr) => Math.max(6, Math.round(Tr / 4));
  function holes(Tr) {
    const n = holeCount(Tr), out = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1); out.push({ d: Tr * (0.15 + 0.75 * f), a: -Math.PI / 2 + f * TAU * 1.25 }); }
    return out;
  }

  // A bar is a stadium (length × width, in the same units as a gear's radius): two straight edges and two half-circle
  // ends. Teeth sit 2π apart along any pitch line (a gear of T teeth is 2πT round), so a bar's tooth count is its
  // perimeter / 2π, which is never whole. It is snapped to the nearest multiple of 4 teeth by shortening or stretching
  // the straights (a few %), so patterns close on whole laps: bar 144 × 20 has 48 teeth (139.4 long), bar 150 × 20 has 52
  // (151.9 long). P is the tooth count, len the perimeter.
  function beamGeom(length, width) {
    const e = width / 2, raw = (2 * (length - width) + Math.PI * width) / TAU, P = Math.max(4, Math.round(raw / 4) * 4), len = P * TAU;
    return { e, a: (len - Math.PI * width) / 4, P, len };
  }
  // A point on a stadium (half straight a, end radius rad) at arc length u from the top straight's left end, going
  // right along the top (clockwise on screen, y down), and the outward normal there.
  function stadiumAt(a, rad, u, out) {
    const L = 2 * a, A = Math.PI * rad;
    if (u < L) { out.x = -a + u; out.y = -rad; out.nx = 0; out.ny = -1; return out; }
    u -= L;
    if (u < A) { const t = -Math.PI / 2 + u / rad; out.nx = Math.cos(t); out.ny = Math.sin(t); out.x = a + rad * out.nx; out.y = rad * out.ny; return out; }
    u -= A;
    if (u < L) { out.x = a - u; out.y = rad; out.nx = 0; out.ny = 1; return out; }
    u -= L;
    const t = Math.PI / 2 + Math.min(u, A) / rad; out.nx = Math.cos(t); out.ny = Math.sin(t); out.x = -a + rad * out.nx; out.y = rad * out.ny; return out;
  }

  // ---------- The rig: one fixed piece, one rolling gear, one pen hole ----------
  // θ is the rolling gear's travel round the fixed piece: one full turn of θ (2π) is one lap. Round a ring or a gear it
  // is the angle of the rolling centre; along a bar it is the arc length of the centre's path, as a fraction of a lap.
  // The gear's spin is φ = kθ + φ0:
  //   inside a ring:   centre (R−r)(cosθ, sinθ), k = −(R−r)/r
  //   outside a gear:  centre (R+r)(cosθ, sinθ), k = (R+r)/r
  //   round a bar:     centre on the stadium offset by r, φ = s/r, so k = (path length)/(2π r)
  // and the pen is centre + d(cos(φ+ψ), sin(φ+ψ)), ψ being the hole's own angle on the gear.
  class Rig {
    constructor(fixedId = DEFAULTS.fixed, Tr = DEFAULTS.rolling, hole = DEFAULTS.hole) {
      this.fixed = FIXED.find((f) => f.id === fixedId) || FIXED[0];
      this.Tr = ROLLING.includes(Tr) ? Tr : DEFAULTS.rolling;
      this.r = this.Tr;
      this.holes = holes(this.Tr);
      this.setHole(hole);
      this.tmp = { x: 0, y: 0, nx: 0, ny: 0 };
      this.phase = 0; // the player's turn of the gear in place, kept to whole teeth so the teeth still mesh
      const f = this.fixed, r = this.r;
      if (f.kind === 'ring') {
        this.Tf = f.inner; this.R = f.inner; this.cr = this.R - r; this.k = -this.cr / r;
        this.phiBase = 0; // the teeth mesh at the start: a ring tip faces a gear gap
      } else if (f.kind === 'gear') {
        this.Tf = f.teeth; this.R = f.teeth; this.cr = this.R + r; this.k = this.cr / r;
        this.phiBase = Math.PI;
      } else {
        const b = beamGeom(f.length, f.width);
        this.beam = b; this.Tf = b.P; this.rho = b.e + r;
        this.Poff = 4 * b.a + TAU * this.rho; // the rolling centre's path
        this.k = this.Poff / (TAU * r);
        this.phiBase = Math.PI / 2;
        this.angles = this.beamAngles();
      }
      const g = gcd(this.Tf, this.Tr);
      this.closure = { g, lobes: this.Tf / g, laps: this.Tr / g };
      this.start = f.kind === 'beam' ? 0 : -Math.PI / 2; // the gear starts at the top
    }
    get kind() { return this.fixed.kind; }
    setHole(i) {
      this.hole = Math.max(0, Math.min(this.holes.length - 1, Math.round(+i || 0)));
      this.d = this.holes[this.hole].d; this.psi = this.holes[this.hole].a;
    }
    // The rolling gear's centre at θ (tooth units, from the fixed centre).
    centre(theta, out = { x: 0, y: 0 }) {
      if (this.kind !== 'beam') { out.x = this.cr * Math.cos(theta); out.y = this.cr * Math.sin(theta); return out; }
      const p = stadiumAt(this.beam.a, this.rho, frac(theta / TAU) * this.Poff, this.tmp);
      out.x = p.x; out.y = p.y; return out;
    }
    spin(theta) { return this.k * theta + this.phiBase + this.phase; }
    pen(theta, out = { x: 0, y: 0 }) {
      this.centre(theta, out);
      const a = this.spin(theta) + this.psi;
      out.x += this.d * Math.cos(a); out.y += this.d * Math.sin(a);
      return out;
    }
    // An upper bound on the pen's speed, in teeth per radian of θ.
    maxSpeed() { return (this.kind === 'beam' ? this.Poff / TAU : this.cr) + this.d * Math.abs(this.k); }
    // Pen points (flat x, y, in teeth) for θ from a (exclusive) to b (inclusive), at most 0.5° and ~2 px apart.
    trace(a, b, pitch, out = []) {
      const dt = b - a;
      if (!dt) return out;
      const n = Math.min(TRACE_CAP, Math.max(1, Math.ceil(Math.abs(dt) / STEP_ANGLE), Math.ceil((Math.abs(dt) * this.maxSpeed() * pitch) / STEP_PX)));
      const p = { x: 0, y: 0 };
      for (let i = 1; i <= n; i++) { this.pen(i === n ? b : a + (dt * i) / n, p); out.push(p.x, p.y); }
      return out;
    }
    // The bar's rolling centre seen from the bar's centre: its angle grows steadily round one lap, so a finger's angle
    // maps to one point on the path. Table of the unwrapped angle at M even steps of θ.
    beamAngles(M = 1024) {
      const t = new Float64Array(M + 1), p = { x: 0, y: 0 };
      let prev = 0;
      for (let i = 0; i <= M; i++) {
        this.centre((i / M) * TAU, p);
        let a = Math.atan2(p.y, p.x);
        if (i) { while (a < prev - Math.PI) a += TAU; while (a > prev + Math.PI) a -= TAU; }
        t[i] = prev = a;
      }
      if (t[M] - t[0] < Math.PI) t[M] = t[0] + TAU; // (the last sample is the first one again)
      return t;
    }
    // The θ within one lap (0..2π for a bar) whose rolling centre lies in direction α from the fixed centre.
    lapAngle(alpha) {
      if (this.kind !== 'beam') return alpha;
      const t = this.angles, M = t.length - 1, a0 = t[0];
      const x = a0 + (((alpha - a0) % TAU) + TAU) % TAU;
      let lo = 0, hi = M;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= x) lo = mid; else hi = mid; }
      const f = t[hi] > t[lo] ? (x - t[lo]) / (t[hi] - t[lo]) : 0;
      return ((lo + Math.max(0, Math.min(1, f))) / M) * TAU;
    }
    // How far a finger's turn from α0 to α1 (round the fixed centre) moves θ: the short way round, never a jump.
    dragDelta(alpha0, alpha1) {
      if (this.kind !== 'beam') return wrapPi(alpha1 - alpha0);
      return wrapPi(this.lapAngle(alpha1) - this.lapAngle(alpha0));
    }
    // How far the set reaches from the fixed centre (teeth), with the rolling gear anywhere round it.
    extent() {
      const f = this.fixed, H = TOOTH_H;
      if (f.kind === 'ring') return f.outer + H;
      if (f.kind === 'gear') return f.teeth + 2 * this.r + H;
      return this.beam.a + this.beam.e + 2 * this.r + H;
    }
    // The θ that closes a pattern begun at θ0 and now at θ: whole closures of the pattern, at least one.
    closeAt(theta0, theta) {
      const span = TAU * this.closure.laps, done = theta - theta0, dir = done < 0 ? -1 : 1;
      const n = Math.max(1, Math.ceil(Math.abs(done) / span - 1e-9));
      return theta0 + dir * n * span;
    }
  }

  // Outlines (tooth units, about the piece's own centre) as flat point lists: 4 points a tooth (two on the tip, two at
  // the root). tipsAt is where the first tip sits, in teeth; out = +1 for teeth pointing out, −1 for in.
  const TOOTH_H = 1.6; // (teeth are 2π apart)
  function toothedCircle(R, T, tipsAt, out) {
    const pts = [];
    for (let k = 0; k < T; k++) {
      for (const [f, h] of [[-0.18, 1], [0.18, 1], [0.32, -1], [0.68, -1]]) {
        const a = ((k + tipsAt + f) / T) * TAU, rr = R + out * h * TOOTH_H;
        pts.push(rr * Math.cos(a), rr * Math.sin(a));
      }
    }
    return pts;
  }
  function toothedStadium(b) {
    const pts = [], p = { x: 0, y: 0, nx: 0, ny: 0 };
    for (let k = 0; k < b.P; k++) {
      for (const [f, h] of [[-0.18, 1], [0.18, 1], [0.32, -1], [0.68, -1]]) {
        stadiumAt(b.a, b.e, ((((k + f) % b.P) + b.P) % b.P) * TAU, p);
        pts.push(p.x + p.nx * h * TOOTH_H, p.y + p.ny * h * TOOTH_H);
      }
    }
    return pts;
  }

  // ---------- Colour ----------
  const hslHex = (h, s = 1, l = 0.66) => {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  // A rainbow's hue, kept to 12 steps of 30° once it becomes firework stars (each colour is a sprite in the game's atlas).
  const HUE_STEPS = 12;
  const quantHue = (h) => (Math.round((((h % 360) + 360) % 360) / (360 / HUE_STEPS)) % HUE_STEPS) * (360 / HUE_STEPS);
  const MAX_COLS = 12;

  // ---------- A drawing as firework points ----------
  // strokes: [{ pts: flat x, y, ..., color: '#rrggbb', rainbow, hue0, hueRate (degrees per unit of length) }].
  // N points spread evenly by arc length over every stroke (the gaps between strokes don't count), centred on the
  // drawing's bounding box and scaled so the largest |x| or |y| is 1. Each point has a colour index into cols (at most 12
  // colours: a rainbow's hues in 30° steps, a colour past 12 takes the nearest one already used).
  // Returns { n, p: [x0, y0, x1, y1, ...] (3 decimals), c: [colour index, ...], cols: ['#rrggbb', ...], rainbow } or null.
  function normalise(strokes, N) {
    N = Math.max(2, Math.round(N));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, L = 0;
    for (const s of strokes) {
      const p = s.pts, n = p.length >> 1;
      for (let i = 0; i < n; i++) {
        const x = p[i * 2], y = p[i * 2 + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (i) L += Math.hypot(x - p[i * 2 - 2], y - p[i * 2 - 1]);
      }
    }
    if (!(L > 0)) return null;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, step = L / N;
    const xs = [], ys = [], c = [], cols = [], rgb = [];
    const colIndex = (hex) => {
      let i = cols.indexOf(hex);
      if (i >= 0) return i;
      const v = parseInt(hex.slice(1), 16), q = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      if (cols.length < MAX_COLS) { cols.push(hex); rgb.push(q); return cols.length - 1; }
      let best = 0, bd = Infinity;
      rgb.forEach((r, j) => { const d = (r[0] - q[0]) ** 2 + (r[1] - q[1]) ** 2 + (r[2] - q[2]) ** 2; if (d < bd) { bd = d; best = j; } });
      return best;
    };
    let rainbow = false, acc = 0, k = 0, next = step / 2;
    for (const s of strokes) {
      const p = s.pts, n = p.length >> 1, hex = /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color.toLowerCase() : '#ffcf6b';
      if (s.rainbow) rainbow = true;
      let len = 0;
      for (let i = 1; i < n && k < N; i++) {
        const ax = p[i * 2 - 2], ay = p[i * 2 - 1], d = Math.hypot(p[i * 2] - ax, p[i * 2 + 1] - ay);
        while (k < N && next <= acc + d) {
          const f = d ? (next - acc) / d : 0;
          xs.push(ax + (p[i * 2] - ax) * f - cx); ys.push(ay + (p[i * 2 + 1] - ay) * f - cy);
          c.push(colIndex(s.rainbow ? hslHex(quantHue((s.hue0 || 0) + (len + f * d) * (s.hueRate || 0))) : hex));
          k++; next = (k + 0.5) * step;
        }
        acc += d; len += d;
      }
    }
    let m = 0;
    for (let i = 0; i < xs.length; i++) m = Math.max(m, Math.abs(xs[i]), Math.abs(ys[i]));
    m = m || 1;
    const out = [];
    for (let i = 0; i < xs.length; i++) out.push(Math.round((xs[i] / m) * 1000) / 1000, Math.round((ys[i] / m) * 1000) / 1000);
    return { n: xs.length, p: out, c, cols, rainbow };
  }
  // A normalised drawing (or a saved signature) as the game's burst points: [[x, y, '#rrggbb'], ...].
  function toPts(d) {
    if (!d || !Array.isArray(d.p) || !Array.isArray(d.cols)) return null;
    const out = [], n = d.p.length >> 1;
    for (let i = 0; i < n; i++) out.push([d.p[i * 2], d.p[i * 2 + 1], d.cols[d.c[i]] || d.cols[0] || '#ffcf6b']);
    return out.length >= 2 ? out : null;
  }

  // ---------- Unlocks, slots and rewards ----------
  // Free: ring 96/144, rolling gears 24-52, the gold, pink and cyan pens, one signature slot and every tool (undo, redo,
  // erase, hide and saving the picture are never locked). Everything else once for gems, or all of it with Premium.
  const SHOP = {
    ring105: { cost: 30, label: 'Ring 105/150' },
    bars: { cost: 40, label: 'Both bars' },
    outside: { cost: 40, label: 'Every outside gear' },
    big: { cost: 30, label: 'Rolling gears 56–84' },
    colors: { cost: 15, label: 'White, green and violet pens' },
    rainbow: { cost: 25, label: 'Rainbow pen' },
    slot: { cost: 20, label: 'One more signature slot' },
  };
  const FREE_SLOTS = 1, MAX_SLOTS = 5;
  // The unlock a choice needs, or null when it is free: { fixed: id } | { rolling: teeth } | { pen: id }.
  function lockFor(o) {
    if (o.fixed) { const f = FIXED.find((x) => x.id === o.fixed); return !f || f.id === 'ring96' ? null : f.kind === 'ring' ? 'ring105' : f.kind === 'beam' ? 'bars' : 'outside'; }
    if (o.rolling) return o.rolling > 52 ? 'big' : null;
    if (o.pen) return o.pen === 'rainbow' ? 'rainbow' : ['white', 'green', 'violet'].includes(o.pen) ? 'colors' : null;
    return null;
  }
  const slotsFor = (owned, premium) => (premium ? MAX_SLOTS : Math.min(MAX_SLOTS, FREE_SLOTS + Math.max(0, Math.floor((owned && owned.slots) || 0))));
  const comboKey = (fixed, rolling, hole) => `${fixed}+${rolling}+${hole}`;
  // A completed pattern's reward: 5 gems the first time a combination (piece + rolling gear + hole) is completed, at most
  // 3 a day. st = { list: [combo keys rewarded], day: { day, n } }. A combo is kept only when it is paid, so a day at the
  // cap doesn't use up new ones.
  const REWARD = { gems: 5, perDay: 3, keep: 1000 };
  function reward(st, key, day) {
    st = st && typeof st === 'object' ? st : {};
    const list = Array.isArray(st.list) ? st.list.slice() : [], d = st.day && st.day.day === day ? { day, n: st.day.n | 0 } : { day, n: 0 };
    if (list.includes(key) || d.n >= REWARD.perDay) return { grant: 0, st: { list, day: d } };
    list.push(key); d.n++;
    return { grant: REWARD.gems, st: { list: list.slice(-REWARD.keep), day: d } };
  }

  // ---------- Storage ----------
  const KEY = 'luts:gears', SIGS_KEY = 'luts:gears:sigs', LAST_KEY = 'luts:gears:last', OWNED_KEY = 'luts:gears:owned', COMBOS_KEY = 'luts:gears:combos';
  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  const readJSON = (k, fb) => { try { const s = store(), v = s && JSON.parse(s.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } };
  const writeJSON = (k, v) => { try { const s = store(); if (!s) return false; s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const loadSigs = () => { const v = readJSON(SIGS_KEY, []); return Array.isArray(v) ? v.filter((x) => x && Array.isArray(x.p) && Array.isArray(x.cols)) : []; };
  // For Live Sky: a random saved signature's points, or null (none saved, or "My signatures in Live Sky" is off).
  function liveSignature(rnd = Math.random) {
    const pr = readJSON(KEY, {});
    if (pr && pr.liveSigs === false) return null;
    const list = loadSigs();
    return list.length ? toPts(list[Math.floor(rnd() * list.length) % list.length]) : null;
  }

  // A normalised drawing packed small for My sky (timeline.js keeps it with the moment, so a shared spiral can be drawn
  // again sharp at any size): each coordinate in 12 bits as two base-64 characters, the colours as runs.
  // { v: 1, p: 'xxyy…', c: [[colour, run], …], cols } — about 2.5 KB for 600 points.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function pack(d) {
    if (!d || !Array.isArray(d.p) || !Array.isArray(d.cols)) return null;
    let p = '';
    for (const v of d.p) { const q = Math.max(0, Math.min(4095, Math.round(((Math.max(-1, Math.min(1, v)) + 1) / 2) * 4095))); p += B64[q >> 6] + B64[q & 63]; }
    const c = [];
    for (const i of d.c || []) { const last = c[c.length - 1]; if (last && last[0] === i) last[1]++; else c.push([i, 1]); }
    return { v: 1, p, c, cols: d.cols.slice(0, MAX_COLS) };
  }
  function unpack(g) {
    if (!g || g.v !== 1 || typeof g.p !== 'string' || !Array.isArray(g.cols)) return null;
    const p = [], c = [];
    for (let i = 0; i + 1 < g.p.length; i += 2) p.push(((B64.indexOf(g.p[i]) << 6) | B64.indexOf(g.p[i + 1])) / 4095 * 2 - 1);
    for (const [i, n] of Array.isArray(g.c) ? g.c : []) for (let k = 0; k < n; k++) c.push(i);
    return p.length >= 4 ? { n: p.length >> 1, p, c, cols: g.cols } : null;
  }

  const api = { pack, unpack, Rig, FIXED, ROLLING, DEFAULTS, gcd, holes, holeCount, beamGeom, pitchFor, toothedCircle, toothedStadium, wrapPi, TAU,
    normalise, toPts, hslHex, quantHue, SHOP, lockFor, slotsFor, FREE_SLOTS, MAX_SLOTS, comboKey, reward, REWARD, liveSignature, loadSigs };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.SkyGears = api;
  api.back = () => false;
  // My sky: a moment's kept drawing ({ g: packed }) drawn at px across (for its share card), or null.
  api.art = (ref, px = 480) => { try { const d = unpack(ref && ref.g); return d ? thumb(d, px, Math.max(1.4, px / 240), 1) : null; } catch (e) { return null; } };
  if (typeof document === 'undefined') return;

  // ---------- The screen ----------
  const PENS = [
    { id: 'gold', hex: '#ffcf6b', name: 'Gold' }, { id: 'white', hex: '#fff4dc', name: 'White' }, { id: 'pink', hex: '#ff6ec7', name: 'Pink' },
    { id: 'cyan', hex: '#6ff3ff', name: 'Cyan' }, { id: 'green', hex: '#7dff9a', name: 'Green' }, { id: 'violet', hex: '#b48cff', name: 'Violet' },
    { id: 'rainbow', hex: '', name: 'Rainbow' },
  ];
  const SKIES = [
    { id: 'deep', name: 'Deep blue', stops: ['#0c1a4a', '#06102e', '#02040f'] },
    { id: 'violet', name: 'Violet', stops: ['#26104e', '#140834', '#06031a'] },
    { id: 'black', name: 'Black', stops: ['#08080f', '#040408', '#000000'] },
    { id: 'dusk', name: 'Dusk', stops: ['#0e1236', '#3a1d4e', '#6a2c3e'] },
  ];
  const UNDO_STEPS = 20, STROKE_CAP = 20000, TOTAL_CAP = 400000, MIN_PX = 0.75, FINISH_S = 2.5;
  const $ = (s) => document.querySelector(s);
  const game = () => root.LUTSGame || null;
  // Phones with little memory or few cores draw at a lower resolution and keep fewer sparks.
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || false;
  const DPR_CAP = lowEnd ? 1.5 : 2;
  const SPARK_MAX = lowEnd ? 90 : 180;
  // Launch: how many points the drawing's burst has (never more than the game's particle budget allows at that moment).
  const capable = !lowEnd && ((navigator.deviceMemory || 0) >= 8 || (navigator.hardwareConcurrency || 0) >= 8);
  const LAUNCH_N = lowEnd ? 300 : capable ? 800 : 600;
  const SIG_N = 400; // a saved signature's points (Live Sky thins them to its budget)
  const LAST_CAP = 20000; // the saved drawing (reopened next time): at most this many points in all

  function loadPrefs() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
    v = v && typeof v === 'object' ? v : {};
    return {
      fixed: FIXED.some((f) => f.id === v.fixed) ? v.fixed : DEFAULTS.fixed,
      rolling: ROLLING.includes(v.rolling) ? v.rolling : DEFAULTS.rolling,
      hole: Number.isFinite(v.hole) ? v.hole : DEFAULTS.hole,
      pen: PENS.some((p) => p.id === v.pen) ? v.pen : 'gold',
      sky: SKIES.some((s) => s.id === v.sky) ? v.sky : 'deep',
      speed: Number.isFinite(v.speed) ? Math.max(0.3, Math.min(3, v.speed)) : 0.8,
      liveSigs: v.liveSigs !== false, // My signatures in Live Sky
    };
  }
  let prefs = loadPrefs();
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* private window: this visit only */ } };

  // ----- State -----
  let el = null, raf = 0, lastT = 0;
  let rig = null, theta = 0, pattern0 = 0, patternDone = false;
  const pan = { x: 0, y: 0 }; // the fixed piece's centre, in u from the drawing area's centre
  // Drawings are kept in screen units u (1 = the drawing area's shorter side, from its centre), so a smaller scale for
  // a wide set of gears (a bar, a big gear round a gear) leaves earlier drawings as they were. S: px per u; k: u per tooth.
  const view = { W: 0, H: 0, cx: 0, cy: 0, S: 1, base: 1, pitch: 1, k: 1, dpr: 1, fxDpr: 1, lw: 2 };
  // The 144 ring fills ~90% of the shorter side; a set that reaches further shrinks to fit.
  function fit() {
    if (!rig) return;
    view.pitch = Math.min(view.base, (0.48 * view.S) / rig.extent());
    view.k = view.pitch / view.S;
  }
  let gearsShown = true;
  // Drawing as vectors (points in u from the drawing area's centre), so undo repaints them instead of keeping
  // bitmaps. history: { type: 'stroke', strokes: [...] } or { type: 'clear' }; the oldest steps beyond the undo limit move
  // into `kept` (and, past the point budget, into the baked picture).
  let history = [], redo = [], kept = [], baked = null, live = null;
  // dragPend: the finger's roll not yet drawn, RELATIVE to θ (so it is applied to wherever θ is when the frame runs).
  let dragPend = 0, spinning = false, finish = null, gearDirty = true, fixedDirty = true, fxLive = false, fxNeedsDot = true;
  // Each pattern (from where it began to where it closes, or until the gears move) is one id; undo takes a pattern back whole.
  let patId = 0, moveMode = false, moving = false, reach = 0;
  let closed = false; // this pattern has come round to where it began (by a drag, a spin or Finish): its reward is settled
  const scratch = [];

  // ----- The DOM -----
  const ICON = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    save: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    gears: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
    redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12"/>',
    move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    erase: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    rocket: '<path d="M12 2.5c3 2.6 4.4 6.2 4.2 10.6L12 16.5l-4.2-3.4C7.6 8.7 9 5.1 12 2.5z"/><circle cx="12" cy="9.5" r="1.7"/><path d="M8.6 17.5L7 21M15.4 17.5L17 21M12 18v3.5"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  function build() {
    const s = document.createElement('section');
    s.className = 'sg'; s.id = 'skyGears'; s.hidden = true;
    s.setAttribute('aria-label', 'Magic Spirals');
    s.innerHTML = `
      <canvas class="sg-bg" id="skgBg" aria-hidden="true"></canvas>
      <div class="sg-stars" id="skgStars" aria-hidden="true"></div>
      <canvas class="sg-draw" id="skgDraw" aria-hidden="true"></canvas>
      <canvas class="sg-gear" id="skgGear" aria-hidden="true"></canvas>
      <canvas class="sg-fx" id="skgFx" aria-hidden="true"></canvas>
      <header class="sg-top">
        <button class="sg-icon" id="skgClose" type="button" aria-label="Close">${svg('close')}</button>
        <h2>Magic Spirals</h2>
        <button class="sg-icon" id="skgSave" type="button" aria-label="Save image">${svg('save')}</button>
      </header>
      <div class="sg-stage" id="skgStage" aria-label="Drag round to roll the gear"></div>
      <div class="sg-ctrl">
        <div class="sg-read">
          <span id="skgPetals" aria-live="polite"></span>
          <label class="sg-speed"><span>Speed</span><input type="range" id="skgSpeed" min="0.3" max="3" step="0.1" aria-label="Spin speed"></label>
        </div>
        <div class="sg-tools">
          <button class="sg-tool" id="skgGearsBtn" type="button" aria-expanded="false" aria-controls="skgSheet">${svg('gears')}<span>Gears</span></button>
          <button class="sg-tool" id="skgMove" type="button" aria-pressed="false" aria-label="Move the gears">${svg('move')}<span>Move</span></button>
          <button class="sg-tool" id="skgUndo" type="button">${svg('undo')}<span>Undo</span></button>
          <button class="sg-tool" id="skgRedo" type="button">${svg('redo')}<span>Redo</span></button>
          <button class="sg-tool" id="skgErase" type="button">${svg('erase')}<span>Erase</span></button>
          <button class="sg-tool" id="skgHide" type="button" aria-pressed="false">${svg('eye')}<span>Hide</span></button>
          <button class="sg-tool sg-launch" id="skgLaunch" type="button" disabled>${svg('rocket')}<span>Launch</span></button>
        </div>
        <div class="sg-main">
          <button class="sg-finish" id="skgFinish" type="button" aria-label="Finish the pattern">
            <svg class="sg-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><circle id="skgRing" cx="32" cy="32" r="29"/></svg>
            <span>Finish</span><small id="skgProgress"></small>
          </button>
          <button class="sg-spin" id="skgSpin" type="button">Hold to spin</button>
        </div>
      </div>
      <div class="sg-sheet" id="skgSheet" role="dialog" aria-label="Gears" hidden>
        <div class="sg-sheet-head"><b>Gears</b><button class="sg-icon" id="skgSheetClose" type="button" aria-label="Close">${svg('close')}</button></div>
        <div class="sg-row"><b>Fixed piece</b><div class="sg-chips" id="skgFixed"></div></div>
        <div class="sg-row"><b>Around a gear</b><div class="sg-chips" id="skgOutside"></div></div>
        <div class="sg-row"><b>Rolling gear</b><div class="sg-chips" id="skgRolling"></div></div>
        <div class="sg-row"><b>Pen hole <small>(the rim draws loopier)</small></b><div class="sg-chips" id="skgHoles"></div></div>
        <div class="sg-row"><b>Pen colour</b><div class="sg-chips" id="skgPens"></div></div>
        <div class="sg-row"><b>Sky</b><div class="sg-chips" id="skgSkies"></div></div>
        <div class="sg-row"><b>My signatures <small id="skgSlots"></small></b><div class="sg-chips sg-sigs" id="skgSigs"></div>
          <div class="sg-chips"><button class="sg-chip" id="skgLiveSigs" type="button" aria-pressed="true">My signatures in Live Sky</button></div></div>
      </div>
      <div class="sg-launchbar" id="skgLaunchBar" hidden>
        <button class="sg-pill" id="skgBackDraw" type="button">‹ Back to drawing</button>
        <button class="sg-pill gold" id="skgSigSave2" type="button">Save as signature</button>
      </div>
      <div class="sg-confirm" id="skgConfirm" role="dialog" aria-modal="true" aria-labelledby="skgConfirmTitle" hidden>
        <div class="sg-confirm-box">
          <b id="skgConfirmTitle"></b><p id="skgConfirmText"></p>
          <button class="sg-buy" id="skgConfirmBuy" type="button"></button>
          <button class="sg-plain" id="skgConfirmPremium" type="button"><i class="crown-ico" aria-hidden="true"></i>Premium unlocks everything</button>
          <button class="sg-plain" id="skgConfirmNo" type="button">Not now</button>
        </div>
      </div>`;
    document.body.append(s);
    el = {
      root: s, bg: $('#skgBg'), draw: $('#skgDraw'), gear: $('#skgGear'), fx: $('#skgFx'), stage: $('#skgStage'), sheet: $('#skgSheet'),
      petals: $('#skgPetals'), progress: $('#skgProgress'), ring: $('#skgRing'), speed: $('#skgSpeed'), spin: $('#skgSpin'),
      undo: $('#skgUndo'), redo: $('#skgRedo'), hide: $('#skgHide'), gearsBtn: $('#skgGearsBtn'), launch: $('#skgLaunch'),
      launchBar: $('#skgLaunchBar'), confirm: $('#skgConfirm'), sigs: $('#skgSigs'), liveSigs: $('#skgLiveSigs'),
    };
    el.dctx = el.draw.getContext('2d');
    el.gctx = el.gear.getContext('2d');
    el.fctx = el.fx.getContext('2d');
    el.fixedLayer = document.createElement('canvas');
    el.speed.value = String(prefs.speed);
    el.speed.addEventListener('input', () => { prefs.speed = +el.speed.value; savePrefs(); });
    addStars($('#skgStars'));
    s.addEventListener('pointerdown', wakeStars, true);
    $('#skgClose').addEventListener('click', close);
    $('#skgSave').addEventListener('click', saveImage);
    el.gearsBtn.addEventListener('click', () => (el.sheet.hidden ? openSheet() : closeSheet()));
    $('#skgSheetClose').addEventListener('click', closeSheet);
    el.undo.addEventListener('click', undo);
    el.move = $('#skgMove');
    el.move.addEventListener('click', () => setMoveMode(!moveMode));
    el.redo.addEventListener('click', redoStep);
    $('#skgErase').addEventListener('click', eraseAll);
    el.hide.addEventListener('click', () => setGearsShown(!gearsShown));
    $('#skgFinish').addEventListener('click', startFinish);
    el.launch.addEventListener('click', () => launchDrawing());
    $('#skgBackDraw').addEventListener('click', () => endLaunch(true));
    $('#skgSigSave2').addEventListener('click', saveSignature);
    $('#skgConfirmNo').addEventListener('click', hideConfirm);
    $('#skgConfirmBuy').addEventListener('click', buyConfirmed);
    $('#skgConfirmPremium').addEventListener('click', () => { hideConfirm(); const sh = shop(); if (sh && sh.openPremium) sh.openPremium(); });
    el.liveSigs.addEventListener('click', () => { prefs.liveSigs = !prefs.liveSigs; savePrefs(); renderSigs(); });
    // Hold to spin: the gear turns while the button is held, at the speed slider's pace.
    const sp = el.spin;
    sp.addEventListener('pointerdown', (e) => { e.preventDefault(); try { sp.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } setSpin(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sp.addEventListener(ev, () => setSpin(false));
    sp.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); setSpin(true); } });
    sp.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') setSpin(false); });
    s.addEventListener('contextmenu', (e) => e.preventDefault());
    const st = el.stage;
    st.addEventListener('pointerdown', onDown);
    st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', onUp);
    st.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey);
    if (root.ResizeObserver) new ResizeObserver(() => { if (!el.root.hidden) layout(); }).observe(el.stage);
    root.addEventListener('resize', () => { if (!el.root.hidden) layout(); });
    renderSheet();
  }
  // The stars rest after a while with no touch (a phone left on the drawing doesn't run the compositor all night).
  const STILL_MS = 45000;
  let stillT = 0;
  function wakeStars() {
    if (!el) return;
    el.root.classList.remove('sg-still');
    clearTimeout(stillT);
    stillT = setTimeout(() => { if (el) el.root.classList.add('sg-still'); }, STILL_MS);
  }
  // Small stars drifting slowly across the sky and twinkling. CSS animations only (transform and opacity, which the
  // compositor runs), so the screen still does no work of its own while nothing is drawing; each star is a tiny layer.
  function addStars(box) {
    const n = lowEnd ? 24 : 44;
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n; i++) {
      const st = document.createElement('i'), near = rnd() < 0.3, dur = near ? 70 + rnd() * 40 : 140 + rnd() * 120;
      st.style.cssText = `top:${(rnd() * 100).toFixed(2)}%;--x:${(rnd() * 100).toFixed(1)};--sz:${(near ? 1.6 + rnd() * 1.2 : 0.9 + rnd() * 0.9).toFixed(2)}px;` +
        `--dy:${((rnd() - 0.5) * 18).toFixed(1)}vh;--tw:${(2.2 + rnd() * 3.5).toFixed(2)}s;` +
        `animation-duration:${dur.toFixed(0)}s,var(--tw);animation-delay:${(-rnd() * dur).toFixed(1)}s,${(-rnd() * 5).toFixed(2)}s`;
      if (rnd() < 0.25) st.className = 'warm';
      box.appendChild(st);
    }
  }
  function onKey(e) {
    if (!el || el.root.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.key === 'Escape') { e.preventDefault(); api.back(); }
    else if (e.key === 'g' || e.key === 'G') setGearsShown(!gearsShown);
    else if (e.key === 'm' || e.key === 'M') setMoveMode(!moveMode);
  }

  // ----- Layout: the canvases fill the screen; the gears centre on the drawing area (the stage) -----
  function layout() {
    const r = el.stage.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const W = el.root.clientWidth, H = el.root.clientHeight, dpr = Math.min(root.devicePixelRatio || 1, DPR_CAP);
    const same = W === view.W && H === view.H && dpr === view.dpr && Math.abs(r.left + r.width / 2 - view.cx) < 0.5 && Math.abs(r.top + r.height / 2 - view.cy) < 0.5;
    if (same && el.draw.width) return;
    Object.assign(view, { W, H, dpr, fxDpr: Math.min(dpr, lowEnd ? 1 : 1.5), cx: r.left + r.width / 2, cy: r.top + r.height / 2,
      S: Math.min(r.width, r.height), base: pitchFor(r.width, r.height), lw: Math.max(1.6, Math.min(2.4, Math.min(r.width, r.height) / 200)) });
    for (const c of [el.bg, el.draw, el.gear, el.fixedLayer]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    el.fx.width = Math.round(W * view.fxDpr); el.fx.height = Math.round(H * view.fxDpr);
    fit();
    drawSky();
    repaint();
    fixedDirty = gearDirty = true; prevBox = null;
    kick();
  }
  // The night sky: a gradient and a few hundred still stars, drawn once per size or sky colour.
  function drawSky() {
    const g = el.bg.getContext('2d'), { W, H, dpr } = view, sky = SKIES.find((x) => x.id === prefs.sky) || SKIES[0];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, sky.stops[0]); gr.addColorStop(0.55, sky.stops[1]); gr.addColorStop(1, sky.stops[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = lowEnd ? 180 : 300;
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H, s = 0.35 + rnd() * rnd() * 1.3, a = 0.25 + rnd() * 0.65;
      g.globalAlpha = a; g.fillStyle = rnd() < 0.15 ? '#ffe2b0' : rnd() < 0.2 ? '#bcd4ff' : '#ffffff';
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ----- Strokes -----
  const pen = () => PENS.find((p) => p.id === prefs.pen) || PENS[0];
  const hsl = (h) => `hsl(${((h % 360) + 360) % 360},100%,66%)`;
  function newStroke(from) {
    const p = pen();
    return { color: p.hex, rainbow: !p.hex, hue0: from ? from.hue1 : Math.random() * 360, hueRate: 0.4 * view.S, hue1: 0, len: 0, pts: [], n: 0, drawn: 0 };
  }
  // hue at a length along the stroke (rainbow pens move the hue as the pen travels)
  const hueAt = (s, len) => s.hue0 + len * s.hueRate;
  function beginStroke() {
    live = { type: 'stroke', pat: patId, strokes: [newStroke()] };
    history.push(live); redo = [];
    syncButtons();
  }
  function addPoint(x, y, force) {
    let s = live.strokes[live.strokes.length - 1];
    const n = s.pts.length;
    if (n) {
      const dx = x - s.pts[n - 2], dy = y - s.pts[n - 1], d = Math.hypot(dx, dy);
      if (!force && d * view.S < MIN_PX) return;
      s.len += d;
    }
    if (n >= STROKE_CAP * 2) {
      // A long stroke goes on in a new piece of the same undo step, from the same point.
      flushStroke(s);
      s.hue1 = hueAt(s, s.len); flushLen0 = 0;
      const nx = newStroke(s); nx.color = s.color; nx.rainbow = s.rainbow; nx.hueRate = s.hueRate;
      nx.pts.push(s.pts[n - 2], s.pts[n - 1]);
      seal(s);
      live.strokes.push(nx); s = nx;
    }
    s.pts.push(x, y);
  }
  const seal = (s) => { if (Array.isArray(s.pts)) s.pts = Float32Array.from(s.pts); };
  function endStroke() {
    if (!live) return;
    const st = live.strokes[live.strokes.length - 1];
    flushStroke(st);
    for (const s of live.strokes) seal(s);
    live.strokes = live.strokes.filter((s) => s.pts.length >= 4);
    if (!live.strokes.length) history.splice(history.indexOf(live), 1);
    live = null;
    trimHistory();
    syncButtons();
  }
  function trimHistory() {
    while (history.length > UNDO_STEPS) {
      const a = history.shift();
      if (a.type === 'clear') { kept = []; baked = null; } else kept.push(...a.strokes);
    }
    // Past the point budget, the oldest kept strokes become a picture.
    let total = 0;
    for (const s of kept) total += s.pts.length / 2;
    for (const a of history) if (a.type === 'stroke') for (const s of a.strokes) total += s.pts.length / 2;
    if (total > TOTAL_CAP && kept.length) bake();
  }
  function bake() {
    const c = document.createElement('canvas');
    c.width = el.draw.width; c.height = el.draw.height;
    const g = c.getContext('2d');
    if (baked) drawBaked(g, baked);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    for (const s of kept) paintStroke(g, s);
    baked = { canvas: c, S: view.S, cx: view.cx, cy: view.cy, dpr: view.dpr };
    kept = [];
  }
  // A baked picture drawn at today's scale and centre.
  function drawBaked(g, b) {
    const s = view.S / b.S, k = (view.dpr * s) / b.dpr;
    g.setTransform(k, 0, 0, k, view.dpr * (view.cx - b.cx * s), view.dpr * (view.cy - b.cy * s));
    g.drawImage(b.canvas, 0, 0);
  }
  // u → CSS px
  const sx = (x) => view.cx + x * view.S;
  const sy = (y) => view.cy + y * view.S;
  function strokeStyle(g, s, x0, y0, x1, y1, l0, l1) {
    if (!s.rainbow) { g.strokeStyle = s.color; return; }
    const c0 = hsl(hueAt(s, l0)), c1 = hsl(hueAt(s, l1));
    if (Math.hypot(x1 - x0, y1 - y0) < 1) { g.strokeStyle = c1; return; }
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.strokeStyle = gr;
  }
  function setPen(g) { g.lineCap = 'round'; g.lineJoin = 'round'; }
  // Each batch is one path stroked twice: a soft halo, then a bright thin core, both in the pen colour. Additive
  // 'lighter' was wrong here. Gold is already full red, so a few crossings climbed to a solid white disc: the gears
  // disappeared under it and the next line could not be seen. The halo stays faint where loops cross; it does not go white.
  function strokeTwice(g) {
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = view.lw * 2.6; g.globalAlpha = 0.2; g.stroke(); // ~4-6 CSS px
    g.lineWidth = Math.max(1.4, view.lw * 0.85); g.globalAlpha = 0.92; g.stroke(); // ~1.4-2 CSS px
  }
  // Whole strokes (repaints): in runs, each run one path. A rainbow run ends after RUN_HUE degrees of hue (not a fixed
  // point count), so its gradient from the first hue to the last stays true while dense parts need fewer gradients.
  const RUN_HUE = 60;
  function paintStroke(g, s) {
    const p = s.pts, n = p.length / 2;
    if (n < 2) return;
    setPen(g);
    const RUN = 4096, runLen = s.rainbow ? RUN_HUE / s.hueRate : Infinity;
    let len = 0;
    for (let i0 = 0; i0 < n - 1;) {
      const l0 = len, iMax = Math.min(n - 1, i0 + RUN);
      let i1 = i0;
      g.beginPath(); g.moveTo(sx(p[i0 * 2]), sy(p[i0 * 2 + 1]));
      while (i1 < iMax) {
        i1++;
        g.lineTo(sx(p[i1 * 2]), sy(p[i1 * 2 + 1]));
        if (s.rainbow) { len += Math.hypot(p[i1 * 2] - p[i1 * 2 - 2], p[i1 * 2 + 1] - p[i1 * 2 - 1]); if (len - l0 >= runLen) break; }
      }
      strokeStyle(g, s, sx(p[i0 * 2]), sy(p[i0 * 2 + 1]), sx(p[i1 * 2]), sy(p[i1 * 2 + 1]), l0, len);
      strokeTwice(g);
      i0 = i1;
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // The new part of the live stroke, once a frame, as one path.
  let flushLen0 = 0;
  function flushStroke(s) {
    const p = s.pts, n = p.length / 2, i0 = Math.max(0, s.drawn - 1), g = el.dctx;
    if (n - i0 < 2) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    setPen(g);
    g.beginPath(); g.moveTo(sx(p[i0 * 2]), sy(p[i0 * 2 + 1]));
    for (let i = i0 + 1; i < n; i++) g.lineTo(sx(p[i * 2]), sy(p[i * 2 + 1]));
    strokeStyle(g, s, sx(p[i0 * 2]), sy(p[i0 * 2 + 1]), sx(p[n * 2 - 2]), sy(p[n * 2 - 1]), flushLen0, s.len);
    strokeTwice(g);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    s.drawn = n; flushLen0 = s.len;
  }
  // The whole drawing from its vectors: after undo, redo, erase, a resize or a new sky.
  function repaint() {
    const g = el.dctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, el.draw.width, el.draw.height);
    let from = 0;
    for (let i = history.length - 1; i >= 0; i--) if (history[i].type === 'clear') { from = i + 1; break; }
    if (!from) {
      if (baked) drawBaked(g, baked);
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      for (const s of kept) paintStroke(g, s);
    }
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    for (let i = from; i < history.length; i++) if (history[i].type === 'stroke') for (const s of history[i].strokes) { paintStroke(g, s); s.drawn = s.pts.length / 2; }
    if (live) flushLen0 = live.strokes[live.strokes.length - 1].len;
  }
  // Undo takes back the last pattern whole (every drag, spin and Finish of it); redo brings it back whole.
  function undo() {
    stopMotion();
    const a = history.pop();
    if (!a) return;
    const grp = [a];
    if (a.type === 'stroke') while (history.length && history[history.length - 1].type === 'stroke' && history[history.length - 1].pat === a.pat) grp.unshift(history.pop());
    redo.push(grp); repaint(); syncButtons(); kick();
  }
  function redoStep() {
    stopMotion();
    const grp = redo.pop();
    if (!grp) return;
    history.push(...grp); trimHistory(); repaint(); syncButtons(); kick();
  }
  function eraseAll() {
    stopMotion();
    if (!hasDrawing()) return;
    history.push({ type: 'clear' }); redo = []; trimHistory(); repaint(); syncButtons();
    resetPattern();
  }
  function hasDrawing() {
    for (let i = history.length - 1; i >= 0; i--) { if (history[i].type === 'clear') return false; if (history[i].strokes.length) return true; }
    return !!(kept.length || baked);
  }
  function syncButtons() {
    if (!el) return;
    el.undo.disabled = !history.length;
    el.redo.disabled = !redo.length;
    el.launch.disabled = !hasDrawing() || !!launching;
    saveLastSoon();
  }
  // Ends whatever is drawing (a drag, a spin, a finish) and closes the stroke.
  function stopMotion() {
    if (rig) flushDrag();
    dragPend = 0; spinning = false; finish = null;
    if (el) el.spin.classList.remove('on');
    endStroke();
  }

  // ----- Rolling -----
  // A new piece or gear starts again at the top; the drawing stays.
  function setRig() {
    rig = new Rig(prefs.fixed, prefs.rolling, prefs.hole);
    theta = rig.start;
    prefs.hole = rig.hole;
    fit();
    reach = penReach();
    resetPattern();
    fixedDirty = gearDirty = fxNeedsDot = true; prevBox = null;
    kick();
  }
  function resetPattern() { pattern0 = theta; patternDone = false; closed = false; patId++; readout(true); }
  const fixedPx = () => ({ x: sx(pan.x), y: sy(pan.y) });
  // How far the pen gets from the fixed piece's centre (in teeth), for the outline shown while the gears move.
  function penReach() {
    let m = 0;
    const span = TAU * Math.min(rig.closure.laps, 40), n = Math.min(4000, 90 * Math.ceil(span / TAU));
    for (let i = 0; i <= n; i++) { const p = rig.pen(rig.start + (span * i) / n); m = Math.max(m, Math.hypot(p.x, p.y)); }
    return m;
  }
  // Rolls the gear from θ to `to`, adding the pen's path to the live stroke.
  function advance(to) {
    if (to === theta) return;
    if (patternDone) resetPattern();
    if (!live) { beginStroke(); const p0 = rig.pen(theta); live.strokes[0].pts.push(pan.x + p0.x * view.k, pan.y + p0.y * view.k); flushLen0 = 0; }
    scratch.length = 0;
    rig.trace(theta, to, view.pitch, scratch);
    const n = scratch.length, p0 = rig.pen(theta);
    let travel = Math.hypot(scratch[0] - p0.x, scratch[1] - p0.y);
    for (let i = 0; i < n; i += 2) {
      if (i) travel += Math.hypot(scratch[i] - scratch[i - 2], scratch[i + 1] - scratch[i - 1]);
      addPoint(pan.x + scratch[i] * view.k, pan.y + scratch[i + 1] * view.k, i === n - 2);
    }
    travel *= view.pitch;
    theta = to;
    if (!closed && Math.abs(theta - pattern0) >= TAU * rig.closure.laps - 1e-6) { closed = true; completed(); }
    flushStroke(live.strokes[live.strokes.length - 1]);
    sparkBudget += Math.min(lowEnd ? 8 : 18, 4 + travel / 2);
    gearDirty = true;
  }

  function flushDrag() { const d = dragPend; dragPend = 0; if (d) advance(theta + d); }

  // ----- Pointer: one finger rolls, two fingers move the set and turn the gear in place -----
  const pointers = new Map();
  let gesture = null; // 'draw' | 'move' | 'turn' | 'two' | 'wait'
  let prevAlpha = 0, two = null;
  const pos = (e) => ({ x: e.clientX, y: e.clientY });
  function angleAt(p) { const c = fixedPx(); return { a: Math.atan2(p.y - c.y, p.x - c.x), r: Math.hypot(p.x - c.x, p.y - c.y) }; }
  function gearAngleAt(p) { const c = rig.centre(theta), x = sx(pan.x + c.x * view.k), y = sy(pan.y + c.y * view.k); return Math.atan2(p.y - y, p.x - x); }
  function onDown(e) {
    if (!rig || e.button > 0) return;
    e.preventDefault();
    try { el.stage.setPointerCapture(e.pointerId); } catch (x) { /* synthetic events */ }
    pointers.set(e.pointerId, pos(e));
    if (!el.sheet.hidden) closeSheet();
    if (pointers.size === 1) {
      if (finish) { gesture = 'wait'; return; }
      gesture = e.shiftKey || moveMode ? 'move' : e.ctrlKey || e.metaKey ? 'turn' : 'draw';
      if (gesture === 'move') { moving = true; tapAt = pos(e); tapMoved = 0; gearDirty = fixedDirty = true; kick(); }
      const p = pos(e);
      prevAlpha = gesture === 'turn' ? gearAngleAt(p) : angleAt(p).a;
      prevPos = p;
    } else if (pointers.size === 2) {
      if (gesture === 'draw') { flushDrag(); endStroke(); }
      gesture = 'two'; two = twoState();
    }
  }
  let prevPos = null;
  function twoState() { const [a, b] = [...pointers.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pos(e));
    const p = pos(e);
    if (gesture === 'draw') {
      const { a, r } = angleAt(p);
      if (r < 6) { prevAlpha = a; return; } // too near the centre for a steady angle
      const d = rig.dragDelta(prevAlpha, a);
      prevAlpha = a;
      if (!d || finish || spinning) return; // Finish or Spin is rolling the gear: the finger's roll is not added on top
      dragPend += d;
      kick();
    } else if (gesture === 'move') {
      tapMoved = Math.max(tapMoved, Math.hypot(p.x - tapAt.x, p.y - tapAt.y));
      panBy(p.x - prevPos.x, p.y - prevPos.y); prevPos = p;
    } else if (gesture === 'turn') {
      const a = gearAngleAt(p); turnBy(wrapPi(a - prevAlpha)); prevAlpha = a;
    } else if (gesture === 'two' && pointers.size === 2) {
      const t = twoState();
      panBy(t.mx - two.mx, t.my - two.my);
      turnBy(wrapPi(t.ang - two.ang));
      two = t;
    }
  }
  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture === 'draw') { flushDrag(); if (!finish && !spinning) endStroke(); kick(); }
    if (gesture === 'turn' || gesture === 'two') snapPhase();
    if (gesture === 'move') {
      // a double tap (two short taps near each other) jumps the gears there
      const now = performance.now(), p = pos(e);
      if (tapMoved < 10) {
        if (lastTap && now - lastTap.t < 350 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { jumpTo(p); lastTap = null; }
        else lastTap = { t: now, x: p.x, y: p.y };
      } else lastTap = null;
      moving = false; fixedDirty = gearDirty = true; kick();
    }
    if (pointers.size === 0) gesture = null;
    else if (gesture === 'two' || gesture === 'draw') gesture = 'wait'; // the other finger waits to be lifted
  }
  let tapAt = null, tapMoved = 0, lastTap = null;
  // The fixed piece's centre stays on the screen.
  function clampPan() {
    const hx = view.W / 2 / view.S, hy = view.H / 2 / view.S, ox = (view.W / 2 - view.cx) / view.S, oy = (view.H / 2 - view.cy) / view.S;
    pan.x = Math.max(ox - hx * 0.96, Math.min(ox + hx * 0.96, pan.x));
    pan.y = Math.max(oy - hy * 0.96, Math.min(oy + hy * 0.96, pan.y));
  }
  function panBy(dx, dy) {
    if (!dx && !dy) return;
    pan.x += dx / view.S; pan.y += dy / view.S; clampPan();
    resetPattern(); fixedDirty = gearDirty = true; kick();
  }
  function jumpTo(p) { panBy(p.x - sx(pan.x), p.y - sy(pan.y)); }
  // Move: one finger places the gears anywhere (a double tap jumps them), so a new pattern can go beside the last.
  function setMoveMode(on) {
    if (!el || on === moveMode) return;
    stopMotion();
    moveMode = on; lastTap = null;
    el.move.setAttribute('aria-pressed', String(on));
    el.stage.setAttribute('aria-label', on ? 'Drag to move the gears; double-tap to jump them there' : 'Drag round to roll the gear');
    el.root.classList.toggle('sg-moving', on);
    if (on && !gearsShown) setGearsShown(true);
    fixedDirty = gearDirty = true; kick();
  }
  function turnBy(d) {
    if (!d) return;
    rig.phase += d; resetPattern(); gearDirty = true; kick();
  }
  // The gear settles on a whole tooth, so its teeth mesh with the fixed piece again.
  function snapPhase() { const t = TAU / rig.Tr; rig.phase = Math.round(rig.phase / t) * t; gearDirty = true; kick(); }

  // ----- Spin and Finish -----
  function setSpin(on) {
    if (on === spinning) return;
    if (on) {
      if (finish) { finish = null; endStroke(); }
      flushDrag();
      spinning = true; el.spin.classList.add('on'); lastT = performance.now(); kick();
    } else { spinning = false; el.spin.classList.remove('on'); endStroke(); kick(); }
  }
  // Finish rolls on to where the pattern closes (whole laps from where it began) in about 2.5 s, and stops exactly there.
  function startFinish() {
    if (!rig || finish) return;
    flushDrag();
    if (gesture === 'draw') gesture = 'wait'; // a finger still down waits to be lifted; it does not roll the gear after Finish
    spinning = false; el.spin.classList.remove('on');
    if (patternDone) resetPattern();
    endStroke();
    finish = { from: theta, to: rig.closeAt(pattern0, theta), t0: performance.now() };
    kick();
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ----- Sparks at the pen: a small pool, a budget a frame -----
  // A Diwali sparkler: short gold and white needles thrown off the tip, the same colours as the game's sparkler.
  const DIWALI = ['#fff4dc', '#fff4dc', '#fff4dc', '#ffe7b0', '#ffd27a', '#ffcf6b', '#ffb347'];
  const SP = { x: new Float32Array(SPARK_MAX), y: new Float32Array(SPARK_MAX), ox: new Float32Array(SPARK_MAX), oy: new Float32Array(SPARK_MAX),
    vx: new Float32Array(SPARK_MAX), vy: new Float32Array(SPARK_MAX),
    life: new Float32Array(SPARK_MAX), max: new Float32Array(SPARK_MAX), ang: new Float32Array(SPARK_MAX),
    star: new Uint8Array(SPARK_MAX), c: new Array(SPARK_MAX).fill('#fff4dc'), n: 0 };
  let sparkBudget = 0;
  function penColourNow() {
    if (!live) { const p = pen(); return p.hex || hsl(Date.now() / 20); }
    const s = live.strokes[live.strokes.length - 1];
    return s.rainbow ? hsl(hueAt(s, s.len)) : s.color;
  }
  function sparks(dt, px, py) {
    let k = Math.floor(sparkBudget); sparkBudget = 0;
    while (k-- > 0 && SP.n < SPARK_MAX) {
      const i = SP.n++, a = Math.random() * TAU, glint = Math.random() < 0.08;
      const v = 150 + Math.random() * (glint ? 120 : 280);
      SP.x[i] = SP.ox[i] = px; SP.y[i] = SP.oy[i] = py;
      SP.vx[i] = Math.cos(a) * v; SP.vy[i] = Math.sin(a) * v;
      SP.max[i] = SP.life[i] = 0.18 + Math.random() * 0.32;
      SP.ang[i] = a; SP.star[i] = glint ? 1 : 0;
      SP.c[i] = DIWALI[(Math.random() * DIWALI.length) | 0];
    }
    const drag = Math.exp(-1.5 * dt);
    for (let i = 0; i < SP.n; i++) {
      SP.life[i] -= dt;
      if (SP.life[i] <= 0) {
        const j = --SP.n;
        SP.x[i] = SP.x[j]; SP.y[i] = SP.y[j]; SP.ox[i] = SP.ox[j]; SP.oy[i] = SP.oy[j];
        SP.vx[i] = SP.vx[j]; SP.vy[i] = SP.vy[j]; SP.life[i] = SP.life[j]; SP.max[i] = SP.max[j];
        SP.ang[i] = SP.ang[j]; SP.star[i] = SP.star[j]; SP.c[i] = SP.c[j];
        i--; continue;
      }
      SP.vx[i] *= drag; SP.vy[i] = SP.vy[i] * drag + 50 * dt;
      SP.ox[i] = SP.x[i]; SP.oy[i] = SP.y[i];
      SP.x[i] += SP.vx[i] * dt; SP.y[i] += SP.vy[i] * dt;
    }
  }
  function drawFx(px, py, hot) {
    const g = el.fctx, k = view.fxDpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, el.fx.width, el.fx.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < SP.n; i++) {
      const f = SP.life[i] / SP.max[i], x = SP.x[i], y = SP.y[i];
      const dx = x - SP.ox[i], dy = y - SP.oy[i], step = Math.hypot(dx, dy) || 0.01;
      const tail = Math.min(34, Math.hypot(SP.vx[i], SP.vy[i]) * 0.1);
      const young = f > 0.55;
      g.strokeStyle = young ? '#fffaf0' : SP.c[i];
      g.globalAlpha = Math.min(1, 0.35 + f * 0.85);
      g.lineWidth = young ? 2.6 : 1.8;
      g.beginPath();
      g.moveTo(x - dx / step * tail, y - dy / step * tail);
      g.lineTo(x, y);
      g.stroke();
      g.fillStyle = young ? '#fffaf0' : SP.c[i];
      g.beginPath(); g.arc(x, y, young ? 2.2 : 1.5, 0, TAU); g.fill();
      if (SP.star[i] && f > 0.4) {
        g.strokeStyle = '#fffaf0'; g.lineWidth = 1.15; g.globalAlpha = f;
        g.beginPath();
        for (let t = 0; t < 4; t++) {
          const a = SP.ang[i] + t * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
          g.moveTo(x + c * 1.2, y + sn * 1.2); g.lineTo(x + c * 6, y + sn * 6);
        }
        g.stroke();
      }
    }
    // The burning tip, as on the sparkler: a gold bloom, flickering needles, a white-hot centre.
    if (hot) {
      const t = performance.now();
      g.globalAlpha = 0.55; g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(px, py, 11, 0, TAU); g.fill();
      g.strokeStyle = '#ffe7b0'; g.lineWidth = 1.15; g.globalAlpha = 0.8; g.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (t * 0.02 + i * 0.9) % TAU, len = 12 + (0.5 + 0.5 * Math.sin(t * 0.05 + i)) * 16;
        g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      }
      g.stroke();
      g.globalAlpha = 1; g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(px, py, 4.2, 0, TAU); g.fill();
    } else {
      const col = penColourNow();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.35; g.fillStyle = col; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
      g.globalAlpha = 1; g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(px, py, 1.8, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // ----- The gears: translucent dark glass, a thin neon edge -----
  const pathCache = new Map();
  function polyPath(pts, p = new Path2D()) {
    p.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
    p.closePath();
    return p;
  }
  function fixedPath(f) {
    const key = `f:${f.id}`;
    if (pathCache.has(key)) return pathCache.get(key);
    let p;
    if (f.kind === 'ring') { p = polyPath(toothedCircle(f.outer, f.outer, 0, 1)); polyPath(toothedCircle(f.inner, f.inner, 0, -1), p); }
    else if (f.kind === 'gear') { p = polyPath(toothedCircle(f.teeth, f.teeth, 0, 1)); p.moveTo(3, 0); p.arc(0, 0, 3, 0, TAU); }
    else { p = polyPath(toothedStadium(beamGeom(f.length, f.width))); }
    pathCache.set(key, p);
    return p;
  }
  function rollingPath(Tr) {
    const key = `r:${Tr}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const p = polyPath(toothedCircle(Tr, Tr, 0.5, 1));
    for (const h of holes(Tr)) { const x = h.d * Math.cos(h.a), y = h.d * Math.sin(h.a), hr = holeR(Tr); p.moveTo(x + hr, y); p.arc(x, y, hr, 0, TAU); }
    pathCache.set(key, p);
    return p;
  }
  const holeR = (Tr) => Math.min(1.6, Tr * 0.035) + 0.6;
  function drawFixedLayer() {
    const c = el.fixedLayer, g = c.getContext('2d'), { dpr, pitch } = view;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(dpr * pitch, 0, 0, dpr * pitch, dpr * sx(pan.x), dpr * sy(pan.y));
    const p = fixedPath(rig.fixed);
    g.fillStyle = 'rgba(30,40,96,0.28)'; g.fill(p, 'evenodd');
    g.strokeStyle = 'rgba(111,243,255,0.22)'; g.lineWidth = 4 / pitch; g.stroke(p);
    g.strokeStyle = 'rgba(160,240,255,0.85)'; g.lineWidth = 1 / pitch; g.stroke(p);
    fixedDirty = false;
  }
  let prevBox = null;
  function drawGears() {
    gearDirty = false;
    if (!gearsShown) return;
    const g = el.gctx, { dpr, pitch } = view;
    const full = fixedDirty || !prevBox;
    if (fixedDirty) drawFixedLayer();
    const c = rig.centre(theta), X = sx(pan.x + c.x * view.k), Y = sy(pan.y + c.y * view.k), R = (rig.r + 1) * pitch + 6;
    const box = [X - R, Y - R, X + R, Y + R];
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (full) { g.clearRect(0, 0, el.gear.width, el.gear.height); g.drawImage(el.fixedLayer, 0, 0); }
    else {
      // only the part the rolling gear left and the part it moved to
      const x0 = Math.max(0, Math.floor(Math.min(box[0], prevBox[0]) * dpr)), y0 = Math.max(0, Math.floor(Math.min(box[1], prevBox[1]) * dpr));
      const x1 = Math.min(el.gear.width, Math.ceil(Math.max(box[2], prevBox[2]) * dpr)), y1 = Math.min(el.gear.height, Math.ceil(Math.max(box[3], prevBox[3]) * dpr));
      if (x1 > x0 && y1 > y0) { g.clearRect(x0, y0, x1 - x0, y1 - y0); g.drawImage(el.fixedLayer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); }
    }
    prevBox = box;
    const phi = rig.spin(theta), cs = Math.cos(phi) * dpr * pitch, sn = Math.sin(phi) * dpr * pitch;
    g.setTransform(cs, sn, -sn, cs, dpr * X, dpr * Y);
    const p = rollingPath(rig.Tr);
    g.fillStyle = 'rgba(40,24,70,0.42)'; g.fill(p, 'evenodd');
    g.strokeStyle = 'rgba(255,207,107,0.25)'; g.lineWidth = 3.5 / pitch; g.stroke(p);
    g.strokeStyle = 'rgba(255,224,160,0.95)'; g.lineWidth = 1 / pitch; g.stroke(p);
    const h = rig.holes[rig.hole], hx = h.d * Math.cos(h.a), hy = h.d * Math.sin(h.a), hr = holeR(rig.Tr);
    g.beginPath(); g.arc(hx, hy, hr + 0.9, 0, TAU);
    g.fillStyle = penColourNow(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.2 / pitch; g.stroke();
    if (moveMode && reach) {
      // where the pattern will land
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.beginPath(); g.arc(sx(pan.x), sy(pan.y), reach * pitch, 0, TAU);
      g.setLineDash([6, 6]); g.lineWidth = moving ? 1.6 : 1.1; g.strokeStyle = moving ? 'rgba(255,224,160,0.9)' : 'rgba(255,224,160,0.5)'; g.stroke(); g.setLineDash([]);
      prevBox = null; // the outline is wider than the rolling gear's box: the next frame redraws in full
    }
  }
  function setGearsShown(on) {
    gearsShown = on;
    el.gear.hidden = !on;
    el.hide.setAttribute('aria-pressed', String(!on));
    el.hide.querySelector('span').textContent = on ? 'Hide' : 'Show';
    if (on) { fixedDirty = gearDirty = true; prevBox = null; kick(); }
  }

  // ----- The readout: petals and laps, and how far round this pattern is -----
  let lastRead = '';
  function readout(force) {
    if (!el || !rig) return;
    const { lobes, laps } = rig.closure;
    const done = patternDone ? laps : Math.min(laps, Math.floor((Math.abs(theta - pattern0) / TAU) * 10 + 1e-6) / 10);
    const text = `${lobes} petals · ${laps} ${laps === 1 ? 'lap' : 'laps'}|${done}`;
    if (!force && text === lastRead) return;
    lastRead = text;
    el.petals.textContent = `${lobes} petals · ${laps} ${laps === 1 ? 'lap' : 'laps'}`;
    el.progress.textContent = `${done}/${laps}`;
    el.root.querySelector('#skgFinish').classList.toggle('done', patternDone);
    const C = TAU * 29;
    el.ring.style.strokeDasharray = `${C}`;
    el.ring.style.strokeDashoffset = `${C * (1 - done / laps)}`;
  }

  // ----- The frame: only while something moves -----
  function active() { return dragPend !== 0 || spinning || !!finish || SP.n > 0 || gearDirty || fxLive; }
  function kick() { if (!raf && el && !el.root.hidden) { lastT = lastT || performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (finish) {
      const t = Math.min(1, (now - finish.t0) / (FINISH_S * 1000));
      advance(t >= 1 ? finish.to : finish.from + (finish.to - finish.from) * ease(t));
      if (t >= 1) { theta = finish.to; finish = null; endStroke(); patternDone = true; readout(true); }
    } else if (spinning) advance(theta + prefs.speed * TAU * dt);
    else flushDrag();
    if (gearDirty) { drawGears(); fxNeedsDot = true; }
    const p = rig.pen(theta), px = sx(pan.x + p.x * view.k), py = sy(pan.y + p.y * view.k);
    const moving = sparkBudget > 0;
    if (moving || SP.n || fxLive || fxNeedsDot) {
      sparks(dt, px, py);
      drawFx(px, py, moving);
      fxNeedsDot = false;
    }
    fxLive = SP.n > 0;
    readout(false);
    if (active()) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  
  // ----- The sheet: pieces, gear, hole, pen and sky -----
  // lock: the unlock this chip needs (SHOP); a locked chip shows its price and asks before it is used.
  function chip(label, on, fn, extra, lock) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sg-chip'; b.textContent = label;
    b.setAttribute('aria-pressed', String(on));
    if (extra) extra(b);
    if (lock && !unlocked(lock)) {
      b.classList.add('locked'); b.dataset.lock = lock;
      const t = document.createElement('small'); t.className = 'sg-price'; t.textContent = `💎${SHOP[lock].cost}`;
      b.append(t);
      b.setAttribute('aria-label', `${b.getAttribute('aria-label') || label}, locked: ${SHOP[lock].cost} gems`);
      b.addEventListener('click', () => askUnlock(lock, fn));
    } else b.addEventListener('click', fn);
    return b;
  }
  function renderSheet() {
    const box = (id) => { const b = $(id); b.innerHTML = ''; return b; };
    const fx = box('#skgFixed'), out = box('#skgOutside');
    for (const f of FIXED) {
      const b = chip(f.label, prefs.fixed === f.id, () => pick({ fixed: f.id }, true), null, lockFor({ fixed: f.id }));
      b.dataset.fixed = f.id;
      (f.kind === 'gear' ? out : fx).append(b);
    }
    const rl = box('#skgRolling');
    for (const t of ROLLING) { const b = chip(String(t), prefs.rolling === t, () => pick({ rolling: t }, true), null, lockFor({ rolling: t })); b.dataset.teeth = t; rl.append(b); }
    renderHoles();
    const pens = box('#skgPens');
    for (const p of PENS) {
      pens.append(chip('', prefs.pen === p.id, () => { prefs.pen = p.id; savePrefs(); renderSheet(); gearDirty = true; fxNeedsDot = true; kick(); }, (b) => {
        b.classList.add('sg-swatch'); b.dataset.pen = p.id; b.setAttribute('aria-label', p.name); b.title = p.name;
        b.style.setProperty('--c', p.hex || 'conic-gradient(#ff6e6e,#ffcf6b,#7dff9a,#6ff3ff,#b48cff,#ff6ec7,#ff6e6e)');
      }, lockFor({ pen: p.id })));
    }
    const sk = box('#skgSkies');
    for (const s of SKIES) {
      sk.append(chip('', prefs.sky === s.id, () => { prefs.sky = s.id; savePrefs(); renderSheet(); drawSky(); }, (b) => {
        b.classList.add('sg-swatch'); b.dataset.sky = s.id; b.setAttribute('aria-label', s.name); b.title = s.name;
        b.style.setProperty('--c', `linear-gradient(180deg, ${s.stops[0]}, ${s.stops[2]})`);
      }));
    }
    renderSigs();
  }
  function renderHoles() {
    const hb = $('#skgHoles'), n = holeCount(prefs.rolling);
    hb.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = chip(String(i + 1), (rig ? rig.hole : prefs.hole) === i, () => {
        stopMotion();
        prefs.hole = i; savePrefs(); rig.setHole(i); resetPattern(); gearDirty = true; fxNeedsDot = true; renderHoles(); kick();
      });
      b.dataset.hole = i; b.setAttribute('aria-label', `Hole ${i + 1}`);
      hb.append(b);
    }
  }
  function pick(change, reset) {
    stopMotion();
    Object.assign(prefs, change);
    if (change.rolling) prefs.hole = Math.min(prefs.hole, holeCount(prefs.rolling) - 1);
    savePrefs();
    setRig();
    renderSheet();
    fxNeedsDot = true;
  }
  function openSheet() {
    stopMotion();
    renderSheet();
    el.sheet.hidden = false; el.gearsBtn.setAttribute('aria-expanded', 'true');
  }
  function closeSheet() { el.sheet.hidden = true; el.gearsBtn.setAttribute('aria-expanded', 'false'); }

  // ----- Unlocks: gems once, or Premium (the game's wallet and paywall, through LUTSGame.gearsShop) -----
  const shop = () => { const g = game(); return g && g.gearsShop ? g.gearsShop : null; };
  const isPremium = () => { const sh = shop(); return !!(sh && sh.premium()); };
  const loadOwned = () => { const v = readJSON(OWNED_KEY, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  let owned = loadOwned();
  const unlocked = (lock) => !lock || isPremium() || !!owned[lock];
  const slots = () => slotsFor(owned, isPremium());
  // A choice that is no longer open (Premium ended) goes back to the free one.
  function sanitise() {
    let changed = false;
    if (!unlocked(lockFor({ fixed: prefs.fixed }))) { prefs.fixed = DEFAULTS.fixed; changed = true; }
    if (!unlocked(lockFor({ rolling: prefs.rolling }))) { prefs.rolling = DEFAULTS.rolling; prefs.hole = Math.min(prefs.hole, holeCount(prefs.rolling) - 1); changed = true; }
    if (!unlocked(lockFor({ pen: prefs.pen }))) { prefs.pen = 'gold'; changed = true; }
    if (changed) savePrefs();
    return changed;
  }
  let asking = null; // { lock, then }
  function askUnlock(lock, then) {
    const it = SHOP[lock];
    if (!it) return;
    asking = { lock, then };
    $('#skgConfirmTitle').textContent = `Unlock ${it.label}?`;
    $('#skgConfirmText').textContent = lock === 'slot' ? `Keep up to ${Math.min(MAX_SLOTS, slots() + 1)} signature fireworks. Yours for good.` : 'Yours for good, on this device.';
    $('#skgConfirmBuy').textContent = `Unlock for 💎${it.cost}`;
    $('#skgConfirmPremium').hidden = !(shop() && shop().openPremium);
    el.confirm.hidden = false;
    $('#skgConfirmBuy').focus({ preventScroll: true });
  }
  function hideConfirm() { if (el) el.confirm.hidden = true; asking = null; }
  function buyConfirmed() {
    const a = asking, sh = shop();
    hideConfirm();
    if (!a || !sh) return;
    // Already unlocked meanwhile (Premium answered while the question was up): nothing to pay for
    if (a.lock === 'slot' ? (isPremium() || slots() >= MAX_SLOTS) : unlocked(a.lock)) { renderSheet(); if (a.then) a.then(); return; }
    const it = SHOP[a.lock];
    if (!sh.spend(it.cost, it.label, a.lock)) return; // short of gems: the gem sheet is open
    owned = loadOwned();
    if (a.lock === 'slot') owned.slots = Math.max(0, Math.floor(owned.slots || 0)) + 1; else owned[a.lock] = 1;
    writeJSON(OWNED_KEY, owned);
    toastMsg(`${it.label} unlocked`);
    renderSheet();
    if (a.then) a.then();
  }
  const toastMsg = (t) => { const g = game(); if (g && g.toast) g.toast(t); };

  // ----- Rewards: 5 gems for a pattern completed with a new piece + gear + hole, 3 a day -----
  function completed() {
    const g = game();
    if (!g || !rig) return;
    // My sky: every closed pattern (paid or not), with its picture once the last stroke is on the canvas
    if (root.LUTSTimeline) {
      const lobes = Math.round(rig.closure.lobes), key = `gears:${comboKey(rig.fixed.id, rig.Tr, rig.hole)}:${patId}`;
      setTimeout(() => {
        const d = normalise(visibleStrokes(), 600);
        // ref: the drawing itself (packed), so a shared spiral is drawn again sharp, even after its small picture is gone
        root.LUTSTimeline.add({ kind: 'gears', icon: '🌀', line: 'Drew a {0}-petal spiral', args: [lobes], thumb: snapshot(112) || (d ? thumb(d, 56) : null), ref: d ? { g: pack(d) } : null, key, within: 60000 });
      }, 0);
    }
    const day = typeof g.dayKey === 'function' ? g.dayKey() : new Date().toISOString().slice(0, 10);
    const r = reward(readJSON(COMBOS_KEY, {}), comboKey(rig.fixed.id, rig.Tr, rig.hole), day);
    if (!r.grant) return;
    writeJSON(COMBOS_KEY, r.st);
    g.addGems(r.grant, 'Magic Spirals pattern');
  }

  // ----- The drawing as data: what is on screen now, and the last drawing kept for next time -----
  function visibleStrokes() {
    let from = 0;
    for (let i = history.length - 1; i >= 0; i--) if (history[i].type === 'clear') { from = i + 1; break; }
    const out = from ? [] : kept.slice();
    for (let i = from; i < history.length; i++) if (history[i].type === 'stroke') out.push(...history[i].strokes);
    return out.filter((st) => st.pts.length >= 4);
  }
  // luts:gears:last = { v, sky, fixed, rolling, hole, s: [{ c, r, h0, hr, p: [x, y, ... in 1/10000 of the shorter side] }] },
  // thinned evenly to at most LAST_CAP points (a picture baked past the undo budget isn't kept).
  let lastTimer = 0, restored = false;
  function saveLastSoon() { clearTimeout(lastTimer); lastTimer = setTimeout(saveLast, 1500); }
  function saveLast() {
    clearTimeout(lastTimer); lastTimer = 0;
    if (!el || live) return;
    const list = visibleStrokes();
    if (!list.length) { try { const st = store(); if (st) st.removeItem(LAST_KEY); } catch (e) { /* storage unavailable */ } return; }
    let total = 0;
    for (const st of list) total += st.pts.length >> 1;
    const every = Math.max(1, Math.ceil(total / LAST_CAP));
    const s = list.map((st) => {
      const p = st.pts, n = p.length >> 1, q = [];
      for (let i = 0; i < n; i += every) q.push(Math.round(p[i * 2] * 1e4), Math.round(p[i * 2 + 1] * 1e4));
      if ((n - 1) % every) q.push(Math.round(p[n * 2 - 2] * 1e4), Math.round(p[n * 2 - 1] * 1e4));
      return { c: st.color, r: st.rainbow ? 1 : 0, h0: Math.round(st.hue0 * 10) / 10, hr: st.hueRate, p: q };
    });
    writeJSON(LAST_KEY, { v: 1, sky: prefs.sky, fixed: prefs.fixed, rolling: prefs.rolling, hole: prefs.hole, s });
  }
  function restoreLast() {
    restored = true;
    if (history.length || kept.length || baked) return;
    const v = readJSON(LAST_KEY, null);
    if (!v || !Array.isArray(v.s)) return;
    for (const d of v.s) {
      if (!d || !Array.isArray(d.p) || d.p.length < 4) continue;
      const pts = new Float32Array(d.p.length);
      for (let i = 0; i < d.p.length; i++) pts[i] = (+d.p[i] || 0) / 1e4;
      let len = 0;
      for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      const rb = !!d.r, hr = Number.isFinite(d.hr) ? d.hr : 0.4 * 400;
      kept.push({ color: rb ? '' : /^#[0-9a-f]{6}$/i.test(d.c || '') ? d.c : '#ffcf6b', rainbow: rb, hue0: +d.h0 || 0, hueRate: hr, hue1: (+d.h0 || 0) + len * hr, len, pts, n: 0, drawn: 0 });
    }
  }

  // ----- Launch: the drawing goes up as a real firework over the game's sky, then the screen comes back -----
  let launching = null; // { timer }
  // given: a saved signature's points (a thumbnail tapped); otherwise the drawing on screen.
  function launchDrawing(given) {
    stopMotion();
    const g = game();
    if (launching || !g || !g.launchDrawing) return;
    let pts = Array.isArray(given) ? given : null;
    if (!pts) {
      if (!hasDrawing()) return;
      const budget = typeof g.drawingBudget === 'function' ? g.drawingBudget() : LAUNCH_N;
      pts = toPts(normalise(visibleStrokes(), Math.max(24, Math.min(LAUNCH_N, budget))));
    }
    if (!pts) return;
    closeSheet(); hideConfirm();
    const dur = g.launchDrawing(pts, { size: 1 });
    if (!dur) return;
    launching = { timer: setTimeout(() => endLaunch(false), dur * 1000), n: pts.length };
    el.root.classList.add('launching');
    document.body.classList.add('gears-launch'); // the game's sky shows again for the burst (style.css)
    el.launchBar.hidden = false;
    el.launch.disabled = true;
    cancelAnimationFrame(raf); raf = 0; lastT = 0;
    if (typeof root.LUTSTrack === 'function') root.LUTSTrack('gears_launch', { points: pts.length });
  }
  // stop: the player came back early (Back or the button): the sky is quietened.
  function endLaunch(stop) {
    if (!launching) return;
    clearTimeout(launching.timer);
    launching = null;
    const g = game(); if (g && g.endSky) g.endSky(!stop); // natural end: no clear, but the sky loop parks behind the screen
    el.root.classList.remove('launching');
    document.body.classList.remove('gears-launch');
    el.launchBar.hidden = true;
    syncButtons();
    fxNeedsDot = gearDirty = true; prevBox = null;
    kick();
  }

  // ----- Signatures: a drawing kept as its firework points, to launch again and to fly in Live Sky -----
  function saveSignature() {
    stopMotion();
    if (!hasDrawing()) { toastMsg('Draw a pattern first, then save it as your signature'); return; }
    const list = loadSigs();
    if (list.length >= slots()) {
      if (slots() < MAX_SLOTS) askUnlock('slot', saveSignature);
      else toastMsg(`All ${MAX_SLOTS} signature slots are full. Delete one to keep this one.`);
      return;
    }
    const d = normalise(visibleStrokes(), SIG_N);
    if (!d) return;
    list.push({ v: 1, p: d.p, c: d.c, cols: d.cols, rainbow: d.rainbow, fixed: prefs.fixed, rolling: prefs.rolling, hole: rig ? rig.hole : prefs.hole, createdAt: Date.now() });
    if (!writeJSON(SIGS_KEY, list)) { toastMsg('Couldn’t save on this device. It may be full.'); return; }
    toastMsg('Saved as your signature firework ✨');
    renderSigs();
  }
  function deleteSignature(i) {
    const list = loadSigs();
    if (!list[i]) return;
    list.splice(i, 1);
    writeJSON(SIGS_KEY, list);
    renderSigs();
  }
  // The drawing as the player sees it (glow and all): a square of the drawing canvas round every stroke, on the night sky.
  function snapshot(px) {
    try {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of visibleStrokes()) for (let i = 0; i < s.pts.length; i += 2) { const x = s.pts[i], y = s.pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (!(x1 > x0)) return null;
      const size = Math.max(sx(x1) - sx(x0), sy(y1) - sy(y0)) + 16, mx = (sx(x0) + sx(x1)) / 2, my = (sy(y0) + sy(y1)) / 2, k = view.dpr;
      const c = document.createElement('canvas'); c.width = c.height = px;
      const g = c.getContext('2d');
      g.fillStyle = '#0b0a22'; g.fillRect(0, 0, px, px);
      g.drawImage(el.draw, (mx - size / 2) * k, (my - size / 2) * k, size * k, size * k, 0, 0, px, px);
      return c;
    } catch (e) { return null; }
  }
  // A thumbnail drawn from the points (a tiny canvas; no picture is stored).
  function thumb(d, px = 52, lw = 1.1, k = Math.min(2, root.devicePixelRatio || 1)) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(px * k); c.style.width = c.style.height = `${px}px`;
    const g = c.getContext('2d'), n = d.p.length >> 1, h = (px * k) / 2, r = h * 0.86;
    g.globalCompositeOperation = 'lighter'; g.lineWidth = lw * k; g.lineCap = g.lineJoin = 'round'; g.globalAlpha = 0.85;
    let gap = 0;
    for (let i = 1; i < n; i++) gap += Math.hypot(d.p[i * 2] - d.p[i * 2 - 2], d.p[i * 2 + 1] - d.p[i * 2 - 1]);
    gap = (gap / Math.max(1, n - 1)) * 4; // a jump between strokes is not drawn
    // Curves through the midpoints (the points are a sample of a smooth pen line), one path per run of a colour
    const X = (i) => h + d.p[i * 2] * r, Y = (i) => h + d.p[i * 2 + 1] * r;
    const joined = (i) => i > 0 && i < n && Math.hypot(d.p[i * 2] - d.p[i * 2 - 2], d.p[i * 2 + 1] - d.p[i * 2 - 1]) <= gap;
    const pass = (w, a) => { // a soft glow, then the bright line (as the drawing screen paints it)
      g.lineWidth = w; g.globalAlpha = a;
      let col = null;
      for (let i = 1; i < n; i++) {
        if (!joined(i)) continue;
        const cc = d.cols[d.c[i]] || '#ffcf6b';
        if (cc !== col) { if (col) g.stroke(); g.beginPath(); g.strokeStyle = col = cc; }
        g.moveTo(joined(i - 1) ? (X(i - 1) + X(i)) / 2 : X(i - 1), joined(i - 1) ? (Y(i - 1) + Y(i)) / 2 : Y(i - 1));
        if (joined(i + 1)) g.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
        else g.lineTo(X(i), Y(i));
      }
      if (col) g.stroke();
    };
    pass(lw * k * 3.2, 0.16);
    pass(lw * k, 0.95);
    return c;
  }
  function renderSigs() {
    if (!el) return;
    const box = el.sigs, list = loadSigs(), n = slots();
    box.innerHTML = '';
    list.forEach((d, i) => {
      const w = document.createElement('div');
      w.className = 'sg-sig'; w.dataset.sig = i;
      const go = document.createElement('button'); // tap: launch it
      go.type = 'button'; go.className = 'sg-sig-go'; go.setAttribute('aria-label', `Launch signature ${i + 1}`);
      go.append(thumb(d));
      go.addEventListener('click', () => launchDrawing(toPts(d)));
      w.append(go);
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'sg-sig-del'; x.textContent = '×'; x.setAttribute('aria-label', `Delete signature ${i + 1}`);
      x.addEventListener('click', () => deleteSignature(i));
      w.append(x);
      box.append(w);
    });
    if (list.length < n) {
      const b = chip('＋ Save drawing', false, saveSignature);
      b.id = 'skgSigSave'; box.append(b);
    } else if (n < MAX_SLOTS) {
      const b = chip('＋ Slot', false, () => askUnlock('slot', () => {}), null, 'slot');
      b.id = 'skgSigSlot'; box.append(b);
    }
    $('#skgSlots').textContent = `(${list.length}/${n})`;
    el.liveSigs.setAttribute('aria-pressed', String(prefs.liveSigs));
  }

  // ----- Save: the sky and the drawing, without the gears -----
  function saveImage() {
    stopMotion();
    const c = document.createElement('canvas');
    c.width = el.draw.width; c.height = el.draw.height;
    const g = c.getContext('2d');
    g.drawImage(el.bg, 0, 0); g.drawImage(el.draw, 0, 0);
    const gm = game();
    if (gm && typeof gm.brandMark === 'function') gm.brandMark(g, view.dpr); // free players' pictures carry the app's mark
    c.toBlob((b) => {
      if (!b) return;
      const name = 'sky-gears.png';
      if (root.LUTSNative && typeof root.LUTSNative.saveFile === 'function') root.LUTSNative.saveFile(b, name);
      else {
        const url = URL.createObjectURL(b), a = document.createElement('a');
        a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      if (gm) gm.toast('Picture saved');
    }, 'image/png');
  }

  // ----- Opening and closing -----
  // While the screen is open, body.gears-open. The app's banner stays below the page (which ends above it), so the
  // controls and the sheet's last row are never under it.
  function open() {
    if (!el) build();
    if (!el.root.hidden) return;
    const g = game();
    if (g) { g.resume(); g.enter(); }
    prefs = loadPrefs();
    owned = loadOwned();
    const changed = sanitise();
    el.speed.value = String(prefs.speed);
    el.root.hidden = false;
    wakeStars();
    document.body.classList.add('gears-open');
    if (!restored) restoreLast();
    if (!rig || changed) setRig();
    closeSheet(); hideConfirm();
    view.W = 0; layout();
    renderSheet(); syncButtons(); readout(true);
    fxNeedsDot = true; gearDirty = true; prevBox = null;
    if (root.LUTSTrack) root.LUTSTrack.screen('sky_gears');
    kick();
  }
  function close() {
    if (!el || el.root.hidden) return;
    if (launching) endLaunch(true);
    stopMotion();
    setMoveMode(false);
    pointers.clear(); gesture = null;
    closeSheet(); hideConfirm();
    saveLast();
    el.root.hidden = true;
    document.body.classList.remove('gears-open'); document.body.classList.remove('gears-launch');
    cancelAnimationFrame(raf); raf = 0; lastT = 0;
    clearTimeout(stillT);
    if (game()) game().leave();
  }
  // Android Back: the unlock question, the launch (back to the drawing), the sheet, Move, then the screen.
  api.back = () => {
    if (!el || el.root.hidden) return false;
    if (!el.confirm.hidden) hideConfirm();
    else if (launching) endLaunch(true);
    else if (!el.sheet.hidden) closeSheet();
    else if (moveMode) setMoveMode(false);
    else close();
    return true;
  };
  api.open = open;
  api.close = close;
  // For tests: the live state.
  api.state = () => (rig ? { theta, pattern0, patternDone, fixed: rig.fixed.id, rolling: rig.Tr, hole: rig.hole, closure: { ...rig.closure },
    steps: history.length, redo: redo.length, moveMode, patterns: new Set(history.slice(history.map((a) => a.type).lastIndexOf('clear') + 1).map((a) => a.pat)).size, reach, finishing: !!finish, spinning, idle: !raf, pitch: view.pitch, pan: { ...pan }, phase: rig.phase,
    launching: launching ? { n: launching.n } : null, strokes: visibleStrokes().length, pen: prefs.pen } : null);
  // Bought (or lost) Premium while the screen is open: the locks again, and a choice that closed goes back to a free one.
  root.addEventListener('luts:premium-changed', () => {
    if (!el || el.root.hidden) return;
    if (sanitise()) { stopMotion(); setRig(); }
    if (isPremium()) hideConfirm();
    renderSheet();
  });
  root.addEventListener('pagehide', () => { if (el && !el.root.hidden) saveLast(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && el && !el.root.hidden) saveLast(); });
  // A link straight to the screen: #gears (the website, or lightuptheskies://open?h=gears in the app, which sets the
  // hash of a page already running). The hash is cleared once it is used, so the same link works again later.
  const fromHash = () => {
    if (!/^#gears\b/.test(location.hash)) return;
    const go = () => { try { root.history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* (the undo list is called history here) */ } open(); };
    if (game()) go(); else root.addEventListener('luts:game', go, { once: true });
  };
  root.addEventListener('hashchange', fromHash);
  document.addEventListener('DOMContentLoaded', () => {
    const b = $('#btnGears');
    if (b) b.addEventListener('click', open);
    fromHash();
  });
})(typeof window !== 'undefined' ? window : globalThis);
