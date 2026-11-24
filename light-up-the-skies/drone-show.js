/* Light Up the Skies — the Drone Show, a Live Sky show after the real night-sky drone shows of India.
   Each cracker climbs from the ground and breaks into a sphere of lights; the lights fly to their places and make one
   god, as a swarm does: every light of the fill in place but nearly dark, the outline drawing itself, the fill waking
   from the edge inward, a band of white gold, a slow turn in depth, then the lights rise and go out. The figures are
   only points of light, never a picture: a mask is sampled into contour rows and a staggered lattice, ahead of time
   (tools/make-drone-gods.cjs bakes tools/drone-gods/ into drone-gods-data.js, so a phone builds none of it).
   All of it is a pure function of a figure's age (pose/draw), so it pauses, and it can be stepped frame by frame.
   Built for phones: typed arrays, one sprite atlas of 216 colours, one drawImage a light, nothing allocated a frame. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const MASK = 360; // the masks' size in pixels: 1 unit is MASK/2.2 of them
  const UNIT = MASK / 2.2;
  const toM = (v) => v * UNIT + MASK / 2;

  // ---------- Drawing the figures ----------
  // A closed smooth outline through points (Catmull-Rom as Béziers).
  function blob(g, pts, closed = true) {
    const n = pts.length, at = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    g.moveTo(toM(pts[0][0]), toM(pts[0][1]));
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      g.bezierCurveTo(toM(p1[0] + (p2[0] - p0[0]) / 6), toM(p1[1] + (p2[1] - p0[1]) / 6), toM(p2[0] - (p3[0] - p1[0]) / 6), toM(p2[1] - (p3[1] - p1[1]) / 6), toM(p2[0]), toM(p2[1]));
    }
    if (closed) g.closePath();
  }
  const poly = (g, pts) => { pts.forEach((p, i) => (i ? g.lineTo(toM(p[0]), toM(p[1])) : g.moveTo(toM(p[0]), toM(p[1])))); g.closePath(); };
  const fillBlob = (g, pts) => { g.beginPath(); blob(g, pts); g.fill(); };
  const fillPoly = (g, pts) => { g.beginPath(); poly(g, pts); g.fill(); };
  const cut = (g, fn) => { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); };
  // A soft patch of light (+) or shadow (-) on the shade map.
  function shadeSpot(g, x, y, rx, ry, a) {
    g.save(); g.translate(toM(x), toM(y)); g.scale(rx * UNIT, ry * UNIT);
    const c = a > 0 ? '255,255,255' : '0,0,0', gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${c},${Math.abs(a)})`); gr.addColorStop(0.55, `rgba(${c},${Math.abs(a) * 0.75})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
  }
  const shadeLine = (g, pts, w, a) => { g.strokeStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.lineWidth = w * UNIT; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); blob(g, pts, false); g.stroke(); };
  const FIG = {}; // the drawings (tools/drone-gods/): the game reads baked points, never these

  // Text (a greeting), two lines at most, as big as fits.
  function paintText(lines, font) {
    return (m, s) => {
      m.fillStyle = '#fff'; m.textAlign = 'center'; m.textBaseline = 'middle';
      const box = 1.9 * UNIT;
      lines.forEach((tx, i) => {
        let px = 0.62 * UNIT;
        m.font = `800 ${px}px ${font}`;
        const w = m.measureText(tx).width; if (w > box) { px *= box / w; m.font = `800 ${px}px ${font}`; }
        m.fillText(tx, MASK / 2, MASK / 2 + (i - (lines.length - 1) / 2) * 0.74 * UNIT);
      });
      shadeSpot(s, 0, 0, 1, 0.5, 0.5);
    };
  }

  // ---------- A figure into points ----------
  // Two-pass chamfer distance (pixels) to the outside of the mask.
  function distanceMap(a) {
    const n = MASK, d = new Float32Array(n * n), D = 1, E = 1.41;
    for (let i = 0; i < d.length; i++) d[i] = a[i] ? 1e6 : 0;
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) { const i = y * n + x; if (d[i]) d[i] = Math.min(d[i], d[i - 1] + D, d[i - n] + D, d[i - n - 1] + E, d[i - n + 1] + E); }
    for (let y = n - 2; y > 0; y--) for (let x = n - 2; x > 0; x--) { const i = y * n + x; if (d[i]) d[i] = Math.min(d[i], d[i + 1] + D, d[i + n] + D, d[i + n + 1] + E, d[i + n - 1] + E); }
    return d;
  }
  // The shape inflated into rounded forms and lit from the upper right, as a designer shades a figure drone by drone:
  // rims fall away dark, ridges along the arms and legs catch the light.
  function relief(d) {
    const n = MASK, h = new Float32Array(n * n), b = new Float32Array(n * n), out = new Float32Array(n * n), r = 5;
    for (let i = 0; i < h.length; i++) h[i] = Math.sqrt(d[i]);
    for (let y = r; y < n - r; y++) { let a = 0; for (let k = -r; k <= r; k++) a += h[y * n + r + k]; for (let x = r; x < n - r - 1; x++) { b[y * n + x] = a / (2 * r + 1); a += h[y * n + x + r + 1] - h[y * n + x - r]; } }
    for (let x = r; x < n - r; x++) { let a = 0; for (let k = -r; k <= r; k++) a += b[(r + k) * n + x]; for (let y = r; y < n - r - 1; y++) { h[y * n + x] = a / (2 * r + 1); a += b[(y + r + 1) * n + x] - b[(y - r) * n + x]; } }
    const lx = 0.2, ly = -0.3, lz = 0.93, K = 1.7;
    for (let y = 3; y < n - 3; y++) for (let x = 3; x < n - 3; x++) {
      const i = y * n + x, nx = (h[i - 2] - h[i + 2]) * K, ny = (h[i - 2 * n] - h[i + 2 * n]) * K, l = Math.sqrt(nx * nx + ny * ny + 1);
      out[i] = clamp((nx * lx + ny * ly + lz) / l, 0, 1);
    }
    return out;
  }
  // Pixels at distance `at` from the edge, chained into walks and resampled every `step` pixels: an even row of drones
  // right along the shape, as a show's designer sets them by hand.
  function contourPoints(d, at, step, out) {
    const n = MASK, mark = new Uint8Array(n * n), list = [];
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) { const i = y * n + x; if (d[i] >= at - 0.75 && d[i] < at + 0.75) { mark[i] = 1; list.push(i); } }
    for (const start of list) {
      if (!mark[start]) continue;
      let i = start, run = step * 0.5 + 1e-3, moved = 0;
      out.push(i % n, (i / n) | 0); mark[i] = 0;
      for (;;) {
        const x = i % n, y = (i / n) | 0; let best = -1, bd = 1e9;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const j = (y + dy) * n + x + dx, l = dx * dx + dy * dy;
          if (j >= 0 && j < n * n && mark[j] && l < bd) { bd = l; best = j; }
        }
        if (best < 0) break;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * n + dx; if (j >= 0 && j < n * n) mark[j] = 0; } // the chain's width: one pixel kept
        mark[best] = 0; run += Math.sqrt(bd); moved += Math.sqrt(bd); i = best;
        if (run >= step) { run -= step; out.push(i % n, (i / n) | 0); }
      }
      if (moved < step * 0.5) { out.length -= 2; } // a speck
    }
  }
  function sampleAt(d, s) {
    const pts = []; contourPoints(d, s * 0.5, s, pts);
    const edge = pts.length / 2; contourPoints(d, s * 1.36, s, pts);
    const n = MASK, rh = s * 0.866, min = s * 1.98;
    for (let r = 0, y = rh / 2; y < n; r++, y += rh) for (let x = r % 2 ? s / 2 : 0; x < n; x += s) {
      const i = (y | 0) * n + (x | 0); if (d[i] >= min) pts.push(x, y);
    }
    return { pts, edge };
  }
  // Paints a figure, finds the spacing that takes about `count` drones, and returns its points in units:
  // x, y, e (how deep from the edge, 0..1), s (the shade, 0..1), o (1 on the contour rows: lit in the outline shot).
  function figure(doc, paint, count, ring, crease) {
    const mkC = () => { const c = doc.createElement('canvas'); c.width = c.height = MASK; return c; };
    const mc = mkC(), sc = mkC(), m = mc.getContext('2d', { willReadFrequently: true }), s = sc.getContext('2d', { willReadFrequently: true });
    s.fillStyle = '#808080'; s.fillRect(0, 0, MASK, MASK);
    paint(m, s);
    const a = m.getImageData(0, 0, MASK, MASK).data, sh = s.getImageData(0, 0, MASK, MASK).data;
    const al = new Uint8Array(MASK * MASK); for (let i = 0; i < al.length; i++) al[i] = a[i * 4 + 3] > 127 ? 1 : 0;
    const d = distanceMap(al);
    let dMax = 1; for (let i = 0; i < d.length; i++) if (d[i] > dMax) dMax = d[i];
    let dc = d;
    if (crease) { // the same mask, parted along its creases
      const cc = mkC(), g = cc.getContext('2d', { willReadFrequently: true }); g.drawImage(mc, 0, 0); g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; crease(g);
      const a2 = g.getImageData(0, 0, MASK, MASK).data, al2 = new Uint8Array(MASK * MASK); for (let i = 0; i < al2.length; i++) al2[i] = a2[i * 4 + 3] > 127 ? 1 : 0;
      dc = distanceMap(al2);
    }
    const lit = crease ? relief(dc) : null;
    const ringPts = [];
    if (ring) for (let t = ring.from; t < ring.to; t += ring.step) ringPts.push([ring.cx + Math.cos(t) * ring.r, ring.cy + Math.sin(t) * ring.r, t]);
    const want = count - ringPts.length;
    let lo = 2, hi = 40, got = null;
    for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2, r = sampleAt(d, mid); if (r.pts.length / 2 > want) lo = mid; else { hi = mid; got = r; } }
    if (!got) got = sampleAt(d, hi);
    const out = { x: [], y: [], e: [], s: [], o: [], r: [], spacing: hi / UNIT };
    for (let i = 0; i < got.pts.length; i += 2) {
      const px = got.pts[i], py = got.pts[i + 1], j = ((py | 0) * MASK + (px | 0));
      out.x.push((px - MASK / 2) / UNIT); out.y.push((py - MASK / 2) / UNIT);
      out.e.push(clamp(d[j] / dMax, 0, 1));
      if (lit) { const rim = sm(dc[j] / (hi * 1.9)); out.s.push(clamp(((lit[j] - 0.4) * 1.18 + (sh[j * 4] / 255 - 0.5) * 0.8) * (0.3 + 0.7 * rim), 0, 1)); } else out.s.push(sh[j * 4] / 255);
       out.o.push(i / 2 < got.edge ? 1 : d[j] < hi * 2 ? 0.45 : 0); out.r.push(0);
    }
    for (const [x, y, t] of ringPts) { out.x.push(x); out.y.push(y); out.e.push(0); out.s.push(0.5); out.o.push(1); out.r.push((t - ring.from) / (ring.to - ring.from) + 0.001); }
    return out;
  }

  // ---------- Colour: a table of warm light, red at the rim to white at the heart ----------
  const stops = [[0, [255, 28, 8]], [0.26, [255, 78, 10]], [0.5, [255, 138, 14]], [0.72, [255, 196, 42]], [0.88, [255, 226, 120]], [1, [255, 240, 190]]];
  const HEAT = new Float32Array(65 * 3);
  for (let i = 0; i <= 64; i++) {
    const u = i / 64; let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++;
    const f = (u - stops[k][0]) / (stops[k + 1][0] - stops[k][0]);
    for (let c = 0; c < 3; c++) HEAT[i * 3 + c] = stops[k][1][c] + (stops[k + 1][1][c] - stops[k][1][c]) * f;
  }

  // ---------- One figure's life ----------
  // Seconds from the cracker's break: the lights fly out and settle, the outline draws, the fill wakes, it holds, it leaves.
  const SPREAD = 1.1, DANCE = 4.8, REST = 10.7, LEAVE = 11, LIFE = 12.5;
  const CACHE = {}; // figures unpacked: a replay unpacks none
  // A figure's points, from the baked data (or sampled now, for the tools).
  function unpack(id, count) {
    const key = `${id}:${count}`;
    if (CACHE[key]) return CACHE[key];
    const row = (window.LUTSDroneData || {})[id], baked = row && row[count];
    if (!baked) return null;
    const bin = atob(baked.p), n = bin.length / 8, x = [], y = [], e = [], s = [], o = [], r = [];
    for (let i = 0; i < n; i++) {
      const q = i * 8, u = (k) => bin.charCodeAt(q + k);
      x.push(((u(0) | (u(1) << 8)) - 32768) / 16384); y.push(((u(2) | (u(3) << 8)) - 32768) / 16384);
      e.push(u(4) / 255); s.push(u(5) / 255); o.push(u(6) / 255); r.push(u(7) / 255);
    }
    return (CACHE[key] = { x, y, e, s, o, r, spacing: baked.spacing, rig: row.rig, walk: row.walk });
  }
  // Ready to play: typed arrays, each light's own burst direction and timing.
  const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  // The figure's skeleton: a bone is the lights in its region, swung about its pivot, a child before its parent so a hand
  // goes with its arm. Each light keeps its place in the formation; only the bones move, so a god dances in its own lights.
  // { at: [x, y] pivot, area: polygon (none: every light), turn: radians, beat: swings a second, phase, shift: [dx, dy], hop: 1 for a beat that only ever goes one way, soft: how far from the pivot it takes full swing }
  function bones(rig, F) {
    return (rig || []).map((b) => {
      const idx = [], w = [], [cx, cy] = b.at || [0, 0], soft = b.soft == null ? 0.08 : b.soft;
      for (let i = 0; i < F.n; i++) {
        if (F.r[i] && !b.ring) continue; // (the aura stays)
        if (b.area && !inside(b.area, F.x[i], F.y[i])) continue;
        idx.push(i); w.push(soft ? sm(Math.hypot(F.x[i] - cx, F.y[i] - cy) / soft) : 1);
      }
      return { idx: Uint16Array.from(idx), w: Float32Array.from(w), cx, cy, turn: b.turn || 0, spin: b.spin || 0, area: b.area || null, beat: b.beat || 1, phase: b.phase || 0, dx: (b.shift || [0, 0])[0], dy: (b.shift || [0, 0])[1], hop: !!b.hop };
    });
  }
  function ready(raw) {
    const n = raw.x.length, colored = !!(raw.cr && raw.cr.length === n), rnd = mulberry(n * 13 + 5), F = { n, spacing: raw.spacing, colored, x: Float32Array.from(raw.x), y: Float32Array.from(raw.y), z: new Float32Array(n), e: Float32Array.from(raw.e), s: Float32Array.from(raw.s), o: Float32Array.from(raw.o), r: Float32Array.from(raw.r),
      ang: new Float32Array(n), dx: new Float32Array(n), dy: new Float32Array(n), dz: new Float32Array(n), p: new Float32Array(n), q: new Float32Array(n), hue: new Uint8Array(n),
      px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n), cr: new Float32Array(n), cg: new Float32Array(n), cb: new Float32Array(n), ca: new Float32Array(n),
      srcR: colored ? Float32Array.from(raw.cr) : null, srcG: colored ? Float32Array.from(raw.cg) : null, srcB: colored ? Float32Array.from(raw.cb) : null };
    for (let i = 0; i < n; i++) {
      F.z[i] = F.r[i] ? 0.12 : -0.34 * Math.sqrt(F.e[i]) * (0.6 + 0.4 * F.s[i]); // rounded towards you: the figure has depth as it turns
      F.ang[i] = (Math.atan2(F.y[i] + 0.05, F.x[i] + 0.02) / TAU + 0.78) % 1;
      const a = rnd() * TAU, c = rnd() * 2 - 1, k = Math.sqrt(1 - c * c); F.dx[i] = Math.cos(a) * k; F.dy[i] = Math.sin(a) * k; F.dz[i] = c;
      F.p[i] = rnd(); F.q[i] = rnd(); const u = rnd(); F.hue[i] = u < 0.018 ? 1 : u < 0.034 ? 2 : u < 0.044 ? 3 : 0; // green-yellow, blue-white, pink: a phone's sensor on a tiny LED
    }
    F.walk = raw.walk || 0; F.bones = bones(raw.rig, F); F.bx = new Float32Array(n); F.by = new Float32Array(n);
    return F;
  }
  // The dance at u seconds: F.bx, F.by, or the still figure outside it. It starts and ends at rest.
  function dance(F, u) {
    const env = sm((u - DANCE) / 0.9) * (1 - sm((u - REST + 0.8) / 0.8));
    if (!env || !F.bones.length) return false;
    F.bx.set(F.x); F.by.set(F.y);
    for (const b of F.bones) {
      const wave = Math.sin((u - DANCE) * TAU * b.beat + b.phase), k = (b.hop ? Math.abs(wave) : wave) * env, A = b.spin ? b.spin * (u - DANCE) : b.turn * k, /* (spin: a wheel turning) */ ox = b.dx * k, oy = b.dy * k, X = F.bx, Y = F.by, I = b.idx, W = b.w;
      for (let j = 0, n = I.length; j < n; j++) {
        const i = I[j], a = A * W[j], c = Math.cos(a), s = Math.sin(a), rx = X[i] - b.cx, ry = Y[i] - b.cy;
        X[i] = b.cx + rx * c - ry * s + ox * W[j]; Y[i] = b.cy + rx * s + ry * c + oy * W[j];
      }
    }
    return true;
  }
  // The same bones for a picture (Unseen Angles): each bone's angle and shift at u, or null outside the dance.
  function bonePose(F, u) {
    const env = sm((u - DANCE) / 0.9) * (1 - sm((u - REST + 0.8) / 0.8));
    if (!env || !F.bones.length) return null;
    return F.bones.map((b) => { const wave = Math.sin((u - DANCE) * TAU * b.beat + b.phase), k = (b.hop ? Math.abs(wave) : wave) * env; return { b, a: b.spin ? b.spin * (u - DANCE) : b.turn * k, ox: b.dx * k, oy: b.dy * k }; });
  }
  let colR = 0, colG = 0, colB = 0, colA = 0;
  const heat = (k) => { const i = (k <= 0 ? 0 : k >= 1 ? 1 : k) * 64 | 0; colR = HEAT[i * 3]; colG = HEAT[i * 3 + 1]; colB = HEAT[i * 3 + 2]; };
  // A light's colour at u seconds from the break.
  function look(F, i, u) {
    const e = F.e[i], sh = F.s[i], ol = F.o[i], rg = F.r[i], tw = F.q[i], flick = 0.93 + 0.07 * Math.sin(u * (5 + tw * 7) + tw * 40);
    if (rg && !F.colored) { // the circle lights round from the lower left: red there, white at the top, the colour walking round it
      heat(0.1 + 0.8 * Math.sin(rg * Math.PI * 0.95) + 0.14 * Math.sin(u * 1.4 - rg * 9));
      colA = sm((u - 1 - rg * 1.7) * 4) * 1.15 * (0.85 + 0.15 * Math.sin(u * 3 + rg * 20)); return;
    }
    const base = clamp(0.1 + sh * 0.95, 0, 1), ang = F.ang[i];
    const drawn = ol >= 1 ? sm((u - 1 - ang * 1.5) * 4) : ol > 0 ? sm((u - 2.4 - ang * 0.7) * 3.5) * 0.85 : 0; // the outline draws itself; the fill in place, nearly dark
    const patch = sm((u - 2.9) * 1.6) * (1 - sm((u - 3.8) * 1.6)); // the outline breaks into the highlights
    const fill = sm(((u - 3.4) / 1.6 * 1.15 - e) * 6); // the fill wakes from the edge inward
    let a = Math.max(0.035, drawn * (1 - patch * (sh > 0.62 ? 0 : 0.75)), fill);
    if (F.colored) { // a flag keeps its own colours: the same draw-in, then a slow breath, no gold wash
      colR = F.srcR[i]; colG = F.srcG[i]; colB = F.srcB[i];
      if (u > 7) a *= 0.82 + 0.18 * Math.sin((u - 7) * 2.2 - e * 5);
      colA = a * (a > 0.1 ? flick : 1);
      return;
    }
    heat(base * (0.55 + 0.45 * fill) + (1 - fill) * 0.04);
    if (u > 5) { // a band of white gold across the figure, then the whole figure breathing, then a dip to embers
      const band = (F.x[i] * 0.75 + F.y[i] * 0.66 + 1.25) - (u - 5) * 1.05, sw = Math.exp(-band * band * 16), pulse = u > 7 ? 0.5 + 0.5 * Math.sin((u - 7) * 2.4 - e * 6) : 0;
      const k = sm((u - 10) / 1);
      heat(clamp((base + sw * 0.38 + pulse * 0.1) * (1 - k * 0.55), 0, 1));
    }
    colA = a * (a > 0.1 ? flick : 1);
  }
  // Every light at u seconds from the break, around the figure's centre, where the cracker broke.
  function pose(F, u) {
    const N = F.n, rise = u > LEAVE ? (u - LEAVE) / (LIFE - LEAVE) : 0, out = 1 - sm(rise), danced = dance(F, u), bx = danced ? F.bx : F.x, by = danced ? F.by : F.y;
    for (let i = 0; i < N; i++) {
      const p = F.p[i], q = F.q[i], w = clamp((u - p * 0.16) / (SPREAD - 0.16), 0, 1), v = 1 - (1 - w) ** 3, arc = Math.sin(v * Math.PI) * (0.5 + q * 0.5) * 0.62; // out as a sphere, in to its place, at rest
      let x = bx[i] * v + F.dx[i] * arc, y = by[i] * v + F.dy[i] * arc, z = F.z[i] * v + F.dz[i] * arc;
      x += 0.0045 * Math.sin(u * (0.5 + p) + q * 40); y += 0.0045 * Math.sin(u * (0.6 + q) + p * 40); // a light holds its place against a little wind
      if (F.colored && !rise && u > 1.2) x += Math.sin(by[i] * 4 + u * 2.1) * 0.028 * sm((u - 1.2) / 0.5); // a flag ripples; it starts and ends still
      if (rise) { const k = rise * rise; y -= k * (0.45 + p * 0.55); x += k * 0.18 * Math.sin(p * 30 + rise * 3); z += k * 0.25 * (q - 0.5); }
      look(F, i, u);
      if (u < 1.05) { const k = sm((u - 0.55) / 0.5), r0 = colR, g0 = colG, b0 = colB, a0 = colA; heat(0.45 + q * 0.5); colR += (r0 - colR) * k; colG += (g0 - colG) * k; colB += (b0 - colB) * k; colA = (u < 0.06 ? u / 0.06 : 1) * 0.7 * (1 - k) + a0 * k; }
      F.px[i] = x; F.py[i] = y; F.pz[i] = z;
      let r = colR, g = colG, b = colB; const h = F.hue[i];
      if (!F.colored && h === 1) { r *= 0.85; g = Math.min(255, g + 40); b *= 0.5; } else if (!F.colored && h === 2) { r *= 0.8; g = g * 0.9 + 30; b = Math.min(255, b + 110); } else if (!F.colored && h === 3) { g *= 0.8; b = Math.min(255, b + 60); }
      F.cr[i] = r; F.cg[i] = g; F.cb[i] = b; F.ca[i] = colA * out;
    }
    return (F.colored ? 0.08 : 0.3) * Math.sin((u - 2) * 0.52) * sm((u - 1) / 2); // a god turns as a body; a flag only enough to show it is cloth in the air
  }

  // ---------- The sprites ----------
  const LV = 6; // six levels of each channel: 216 sprites
  function atlas(doc, S) {
    const c = doc.createElement('canvas'); c.width = S * LV * LV; c.height = S * LV;
    const g = c.getContext('2d', { willReadFrequently: true }); // on the CPU, as the game's star atlas is (see SPR.refresh)
    for (let r = 0; r < LV; r++) for (let gg = 0; gg < LV; gg++) for (let b = 0; b < LV; b++) {
      const R = (r * 255) / (LV - 1) | 0, G = (gg * 255) / (LV - 1) | 0, B2 = (b * 255) / (LV - 1) | 0;
      const ox = (r * LV + gg) * S, oy = b * S, m = S / 2, gr = g.createRadialGradient(ox + m, oy + m, 0, ox + m, oy + m, m);
      const hot = (k) => `${R + (255 - R) * k | 0},${G + (255 - G) * k | 0},${B2 + (255 - B2) * k | 0}`;
      gr.addColorStop(0, `rgba(${hot(0.85)},1)`); gr.addColorStop(0.15, `rgba(${hot(0.4)},1)`); gr.addColorStop(0.27, `rgba(${R},${G},${B2},.8)`);
      gr.addColorStop(0.42, `rgba(${R},${G},${B2},.24)`); gr.addColorStop(0.68, `rgba(${R},${G},${B2},.05)`); gr.addColorStop(1, `rgba(${R},${G},${B2},0)`);
      g.fillStyle = gr; g.fillRect(ox, oy, S, S);
    }
    return c;
  }
  // ---------- A figure's own small motion (the story shows) ----------
  // Once formed, the whole figure moves as itself, its lights and its picture together: a jellyfish pulses and drifts up,
  // a puppy hops, a horse gallops across, a parachute swings, a car drives. In units of the figure and radians, about a
  // pivot (px, py); it eases in after the figure forms and settles before it leaves. A journey (go) runs the whole life.
  const MO = { x: 0, y: 0, r: 0, sx: 1, sy: 1, px: 0, py: 0 };
  const MOTIONS = {
    jelly(u, e) { const p = Math.sin(u * 2.4); MO.sy = 1 + 0.06 * p * e; MO.sx = 1 - 0.04 * p * e; MO.y = -0.11 * (u - 6) / 6 - 0.025 * p * e; MO.py = -0.4; }, // pulsing as they drift up
    puppy(u, e) { const h = Math.abs(Math.sin(u * 3.4)); MO.y = -0.07 * h * e; MO.r = 0.035 * Math.sin(u * 3.4) * e; MO.py = 0.6; },
    pianist(u, e) { const k = Math.pow(Math.abs(Math.sin(u * 4.4)), 2); MO.r = 0.012 * Math.sin(u * 2.6) * e; MO.y = -0.03 * k * e; MO.sy = 1 + 0.015 * k * e; MO.py = 0.8; }, // a playing bob
    bear(u, e) { MO.r = 0.06 * Math.sin(u * 1.9) * e; MO.py = 0.8; MO.y = -0.015 * Math.abs(Math.sin(u * 1.9)) * e; },
    family(u, e) { const beat = Math.pow(Math.max(0, Math.sin(u * 4.2)), 6) + 0.6 * Math.pow(Math.max(0, Math.sin(u * 4.2 - 0.9)), 6); MO.sx = MO.sy = 1 + 0.04 * beat * e; MO.py = 0.2; }, // a heartbeat
    drummer(u, e) { const b = Math.pow(Math.abs(Math.sin(u * 3.6)), 4); MO.y = 0.05 * b * e; MO.sy = 1 - 0.035 * b * e; MO.sx = 1 + 0.03 * b * e; MO.r = 0.025 * Math.sin(u * 1.8) * e; MO.py = 0.9; }, // a squash on every beat
    warrior(u, e) { MO.x = 0.05 * Math.sin(u * 1.1) * e; MO.r = -0.025 * Math.sin(u * 1.1) * e; MO.py = 0.9; },
    airliner(u, e, go) { MO.x = 0.2 * (go - 0.5); MO.y = -0.24 * (go - 0.5); MO.sx = MO.sy = 0.9; MO.r = -0.03 * e; }, // climbing away, a size smaller so its wings stay in the sky
    globe(u, e) { MO.y = -0.03 * Math.sin(u * 1.3) * e; MO.r = 0.03 * Math.sin(u * 0.8) * e; MO.py = 0.6; },
    taj(u, e) { MO.sx = MO.sy = 1 + 0.035 * Math.sin(u * 1.6) * e; MO.py = 0.9; }, // breathing in its light
    dragon(u, e) { const f = Math.sin(u * 4.2); MO.sy = 1 + 0.06 * f * e; MO.y = -0.05 * f * e - 0.06 * (u - 6) / 6; MO.py = 0.2; }, // wings beating, rising
    horse(u, e, go) { const g = Math.sin(u * 5); MO.x = 0.16 * (0.5 - go); MO.sx = MO.sy = 0.92; MO.y = -0.06 * Math.abs(g) * e; MO.r = 0.04 * g * e; MO.py = 0.4; }, // galloping to the left
    parachute(u, e, go) { MO.r = 0.13 * Math.sin(u * 1.5) * e; MO.px = 0; MO.py = -0.9; MO.y = 0.14 * (go - 0.5); }, // swinging, floating down
    car(u, e, go) { MO.x = 0.34 * (go - 0.5); MO.y = 0.008 * Math.sin(u * 14) * e; }, // driving to the right
    elephants(u, e, go) { MO.x = 0.3 * (0.45 - go); MO.y = -0.035 * Math.abs(Math.sin(u * 2.6)) * e; MO.r = 0.03 * Math.sin(u * 2.6) * e; MO.py = 0.8; }, // walking together, to the left
    // India: Gift to the World
    indiya(u, e) { MO.y = -0.02 * Math.sin(u * 1.2) * e; MO.r = 0.015 * Math.sin(u * 0.9) * e; MO.py = 0.9; }, // the girl breathes, holding her light up
    inzero(u, e) { MO.r = 0.12 * Math.sin(u * 0.5) * e; MO.sx = MO.sy = 1 + 0.03 * Math.sin(u * 1.6) * e; }, // the ring of numbers turns about its zero
    inyoga(u, e) { const b = Math.sin(u * 1.1); MO.sy = 1 + 0.03 * b * e; MO.sx = 1 + 0.012 * b * e; MO.py = 0.85; MO.y = -0.03 * e; }, // slow breaths, floating a little
    inchess(u, e) { MO.r = 0.02 * Math.sin(u * 1.4) * e; MO.py = 0.8; MO.y = -0.015 * Math.abs(Math.sin(u * 1.4)) * e; },
    inayur(u, e) { MO.r = 0.025 * Math.sin(u * 1.3) * e; MO.py = 0.7; },
    innalanda(u, e) { MO.sx = MO.sy = 1 + 0.03 * Math.sin(u * 1.2) * e; MO.py = 0.8; }, // the old walls glowing in and out
    inkonark(u, e) { MO.sx = MO.sy = 1 + 0.02 * Math.sin(u * 2) * e; },
    incharkha(u, e) { MO.y = -0.012 * Math.abs(Math.sin(u * 3)) * e; MO.py = 0.8; },
    indance(u, e) { MO.r = 0.04 * Math.sin(u * 1.8) * e; MO.py = 0.9; MO.y = -0.02 * Math.abs(Math.sin(u * 3.6)) * e; }, // swaying to the beat
    intaj(u, e) { MO.sx = MO.sy = 1 + 0.03 * Math.sin(u * 1.4) * e; },
    inrocket(u, e) { MO.x = 0.008 * Math.sin(u * 23) * e; MO.r = 0.006 * Math.sin(u * 19) * e; MO.py = 0.95; }, // shaking on its fire (the pad and smoke stay with it, so it trembles rather than climbs)
    inmoon(u, e) { MO.y = -0.02 * Math.sin(u * 1.1) * e; MO.sx = MO.sy = 1 + 0.015 * Math.sin(u * 1.1) * e; MO.py = 0.6; },
    incricket(u, e) { MO.r = 0.03 * Math.sin(u * 2.2) * e; MO.py = 0.9; },
    indigital(u, e) { MO.y = -0.04 * Math.sin(u * 1.5) * e; MO.r = 0.025 * Math.sin(u * 1.5) * e; MO.py = 0.8; }, // held up, sending
    inflag(u, e) { MO.r = 0.025 * Math.sin(u * 1.6) * e; MO.px = -0.75; MO.py = 0.9; MO.sx = 1 + 0.05 * Math.sin(u * 3.2) * e; }, // the cloth in the wind, stretching from its pole
    innamaste(u, e) { const beat = Math.pow(Math.max(0, Math.sin(u * 2)), 4); MO.sx = MO.sy = 1 + 0.035 * beat * e; MO.r = 0.04 * Math.sin(u * 0.5) * e; }, // a bow, the world turning behind
  };
  const MOTION_OF = { honeybear: 'bear', worldhand: 'globe', tajlight: 'taj', skydragon: 'dragon', galloper: 'horse', roadster: 'car' };
  function motion(id, u) {
    MO.x = MO.y = MO.r = MO.px = MO.py = 0; MO.sx = MO.sy = 1;
    const key = String(id || '').replace(/2$/, ''), fn = MOTIONS[MOTION_OF[key] || key];
    if (!fn) return false;
    fn(u, sm((u - 2.6) / 1.2) * (1 - sm((u - LEAVE + 0.9) / 0.9)), sm((u - 1.2) / (LEAVE - 1.2)));
    return true;
  }

  // What the game holds: one figure at a time, its age, its sprites.
  function player(opts) {
    const doc = opts.doc || document, dpr = opts.dpr || 1, count = opts.count || 1300;
    let F = null, age = 0, sheet = null, S = 0, bloom = null, bg = null;
    const sheets = {}, reach = (f, unit) => Math.max(3.2, f.spacing * unit * 0.86), size = (rad) => Math.min(48, Math.ceil(rad * 2 * dpr)), use = (want) => { S = want; sheet = sheets[want] || (sheets[want] = atlas(doc, want)); };
    const make = (id) => { const raw = unpack(id, count) || sampled(doc, id, count); return raw ? ready(raw) : null; };
    const figs = {};
    if (opts.figures) { for (const id in opts.figures) { const f = ready(opts.figures[id]); if (f) figs[id] = f; } } // a flag show hands its own coloured points
    else for (const id of opts.ids || []) figs[id] = make(id); // all ready before the show, none built in a frame
    if (opts.greeting) { const lines = opts.greeting, key = `greet:${count}:${lines.join('|')}`; figs.greet = ready(CACHE[key] || (CACHE[key] = figure(doc, paintText(lines, opts.font || 'Cinzel, Georgia, serif'), count))); }
    return {
      figs, count,
      prepare(unit) { for (const id in figs) use(size(reach(figs[id], unit))); },
      get age() { return age; }, get id() { return F && F.id; }, get on() { return !!F; },
      fire(id) { const f = figs[id]; if (!f) return false; f.id = id; F = f; age = 0; return true; },
      stop() { F = null; },
      tick(dt) { if (!F) return; age += dt; if (age >= LIFE) F = null; },
      draw(g, W, H, mx, my, unit, lite, lens, water) {
        if (!F) return 0;
        if (F.walk) mx += F.walk * unit * (0.5 - age / LIFE); // a beast crosses the sky as it walks, right to left
        const rad = reach(F, unit), want = size(rad); // the sprite's reach: its core is about a fifth of it
        if (want !== S) use(want);
        // A figure with its picture (opts.pictures: Unseen Angles) stays flat and square to us, so its lights and the
        // picture it was traced from lie exactly on each other; the picture glows in over the formed lights, holds, and
        // fades as they rise.
        const pic = opts.pictures && opts.pictures[F.id], pa = pic ? sm((age - 2.4) / 1.6) * (1 - sm((age - LEAVE + 0.4) / 0.9)) : 0;
        const turn = pose(F, age), yaw = pic ? 0 : turn, flat = !!pic, c = Math.cos(yaw), si = Math.sin(yaw), f = 3.4, x = F.px, y = F.py, z = F.pz, r = F.cr, gg = F.cg, b = F.cb, a = F.ca, q = (LV - 1) / 255;
        const sway = Math.sin(age * 0.37) * 0.0035 * W, swayY = Math.cos(age * 0.29) * 0.0028 * H;
        const moving = !!opts.motion && motion(F.id, age), mc = Math.cos(MO.r), ms = Math.sin(MO.r), Mx = MO.x, My = MO.y, Mpx = MO.px, Mpy = MO.py, Msx = MO.sx, Msy = MO.sy;
        if (opts.white && !F.colored) for (let i = 0, N = F.n; i < N; i++) { // warm white lights (a city drone show), the gold kept only as a tint
          const L = Math.max(r[i], gg[i], b[i]); r[i] = L * 0.85 + r[i] * 0.15; gg[i] = L * 0.8 + gg[i] * 0.2; b[i] = L * 0.68 + b[i] * 0.32;
        }
        g.save(); g.globalCompositeOperation = 'lighter';
        let lit = 0;
        const rim = !!opts.outline && !F.colored;
        const stride = lite ? (F.n > 1000 ? 2 : 4) : 0, dark = lite ? 0.06 : 0.012; // a phone that proves slow loses dark lights and a share of the fill
        for (let i = 0, N = F.n; i < N; i++) {
          const al = a[i]; if (al < dark || (stride && i % stride === 0 && F.o[i] < 1 && !F.r[i])) continue;
          let X = x[i], Y = y[i];
          if (moving) { const ux = (X - Mpx) * Msx, uy = (Y - Mpy) * Msy; X = Mpx + ux * mc - uy * ms + Mx; Y = Mpy + ux * ms + uy * mc + My; }
          const dz = flat ? 0 : X * si + z[i] * c, k = f / (f + dz), px = mx + sway + (X * c - z[i] * si) * unit * k, py = my + swayY + Y * unit * k;
          let hr = rad * k, av = pa ? al * (1 - 0.6 * pa) : al; // (under the picture the lights soften to its sparkle)
          if (rim) { if (F.o[i] >= 1) { av = al * 1.7; hr *= 1.3; } else av = al * 0.62; } // the outline: a clear bright boundary round a dimmer fill
          g.globalAlpha = av > 1 ? 1 : av;
          g.drawImage(sheet, (((r[i] * q + 0.5) | 0) * LV + ((gg[i] * q + 0.5) | 0)) * S, ((b[i] * q + 0.5) | 0) * S, S, S, px - hr, py - hr, hr * 2, hr * 2);
          lit += al;
          // Over water its lights shine back, upside down and faint, as a real swarm's do in a lake or the sea.
          if (water && !lite) { const ry = water + (water - py) * 0.32; if (ry > water && ry < H) { g.globalAlpha = (al > 1 ? 1 : al) * 0.26; g.drawImage(sheet, (((r[i] * q + 0.5) | 0) * LV + ((gg[i] * q + 0.5) | 0)) * S, ((b[i] * q + 0.5) | 0) * S, S, S, px - hr * 1.2, ry - hr * 0.5, hr * 2.4, hr); } /* squashed, as a far-off reflection is */ }
        }
        if (pa > 0.01) { // the picture itself: black adds nothing, so only its fine lit lines show
          const side = 2.2 * unit; g.globalCompositeOperation = 'lighter'; g.globalAlpha = pa * 0.95; g.imageSmoothingEnabled = true;
          // In the figure's own frame (units): its motion, then each bone's piece of the picture cut out and moved as the
          // bone moves its lights, the rest of the picture still, so the picture dances with its swarm as a god does.
          g.save(); g.translate(mx + sway, my + swayY);
          if (moving) { g.translate((Mpx + Mx) * unit, (Mpy + My) * unit); g.rotate(MO.r); g.scale(Msx, Msy); g.translate(-Mpx * unit, -Mpy * unit); }
          g.scale(unit, unit);
          const parts = bonePose(F, age), poly = (pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]); g.closePath(); };
          if (parts && parts.some((q) => q.b.area)) {
            g.save(); g.beginPath(); g.rect(-1.3, -1.3, 2.6, 2.6); for (const q of parts) if (q.b.area) poly(q.b.area); g.clip('evenodd'); g.drawImage(pic, -1.1, -1.1, 2.2, 2.2); g.restore();
            for (const q of parts) { if (!q.b.area) continue; g.save(); g.translate(q.b.cx + q.ox, q.b.cy + q.oy); g.rotate(q.a); g.translate(-q.b.cx, -q.b.cy); g.beginPath(); poly(q.b.area); g.clip(); g.drawImage(pic, -1.1, -1.1, 2.2, 2.2); g.restore(); }
          } else g.drawImage(pic, -1.1, -1.1, 2.2, 2.2);
          g.restore();
          g.globalAlpha = 1; lit += 40;
        }
        if (lit > 8 && lens) { // the phone's lens: everything lit blooms softly
          if (!bloom) { bloom = doc.createElement('canvas'); bloom.width = 96; bloom.height = Math.round(96 * H / W); bg = bloom.getContext('2d'); }
          bg.globalCompositeOperation = 'copy'; bg.drawImage(g.canvas, 0, 0, bloom.width, bloom.height);
          g.globalAlpha = 0.3; g.imageSmoothingEnabled = true; g.drawImage(bloom, 0, 0, W, H);
        }
        g.restore();
        return lit;
      },
    };
  }

  // ---------- A temple bell as each figure wakes ----------
  let space = null, spaceOf = null;
  function hall(ctx, dest) { // a little night air: built once, at the show's start, not in a frame
    if (spaceOf === dest) return space;
    const len = ctx.sampleRate * 2.6 | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate), rnd = mulberry(77);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.exp(-3.4 * i / len); }
    space = ctx.createConvolver(); space.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.3; space.connect(wet); wet.connect(dest); spaceOf = dest;
    return space;
  }
  function bell(ctx, dest, when, f) {
    const air = hall(ctx, dest);
    for (const [k, l, d] of [[1, 0.42, 4.5], [2.76, 0.2, 2.6], [5.4, 0.09, 1.4]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * k;
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(l, when + 0.012); g.gain.exponentialRampToValueAtTime(0.0002, when + d);
      o.connect(g); g.connect(dest); g.connect(air); o.start(when); o.stop(when + d + 0.05);
    }
  }
  // The figure from its drawing, sampled now: tools only.
  function sampled(doc, id, count) {
    const sp = FIG[id]; if (!sp) return null;
    const f = figure(doc, sp.paint, count, sp.ring, sp.crease); f.rig = sp.rig; f.walk = sp.walk; return f;
  }
  const pen = { blob, poly, fillBlob, fillPoly, cut, shadeSpot, shadeLine, toM, UNIT, TAU };

  // A flag's own points, [x, y, '#rrggbb'] around its centre, as a swarm: the rim draws first, the cloth fills inward.
  function fromPoints(pts) {
    const raw = { x: [], y: [], e: [], s: [], o: [], r: [], cr: [], cg: [], cb: [], spacing: 0.05 };
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
    const hw = (maxX - minX) / 2 || 1, hh = (maxY - minY) / 2 || 1, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    raw.spacing = (Math.max(hw, hh) * 2) / Math.sqrt(Math.max(1, pts.length));
    for (const p of pts) {
      const x = p[0] - cx, y = p[1] - cy, eu = Math.abs(x) / hw, ev = Math.abs(y) / hh, edge = eu > ev ? eu : ev;
      const hex = parseInt(String(p[2]).slice(1), 16) || 0;
      raw.x.push(x); raw.y.push(y); raw.e.push(1 - edge); raw.s.push(0.55);
      raw.o.push(edge > 0.86 ? 1 : edge > 0.72 ? 0.45 : 0); raw.r.push(0);
      raw.cr.push((hex >> 16) & 255); raw.cg.push((hex >> 8) & 255); raw.cb.push(hex & 255);
    }
    return raw;
  }
  window.LUTSDroneShow = { player, bell, hall, fromPoints, rig: (id) => (FIG[id] || {}).rig, walk: (id) => (FIG[id] || {}).walk, ids: () => Object.keys(FIG), figure: (doc, id, n) => sampled(doc, id, n), define: (id, sp) => { FIG[id] = sp; }, pen, LIFE, SPREAD, PROGRAM: ['diya', 'ganesha', 'lakshmi', 'balaji', 'shiva', 'nataraja', 'krishna', 'rama', 'hanuman', 'durga', 'saraswati', 'murugan', 'vishnu', 'ayyappa', 'buddha'], pack: (f) => {
    const n = f.x.length, b = new Uint8Array(n * 8), pu = (v) => clamp(Math.round(v * 16384 + 32768), 0, 65535);
    for (let i = 0; i < n; i++) { const q = i * 8, x = pu(f.x[i]), y = pu(f.y[i]); b[q] = x & 255; b[q + 1] = x >> 8; b[q + 2] = y & 255; b[q + 3] = y >> 8; b[q + 4] = clamp(f.e[i], 0, 1) * 255; b[q + 5] = clamp(f.s[i], 0, 1) * 255; b[q + 6] = clamp(f.o[i], 0, 1) * 255; b[q + 7] = f.r[i] ? Math.max(1, f.r[i] * 255) : 0; }
    let s = ''; for (const v of b) s += String.fromCharCode(v); return { p: btoa(s), spacing: +f.spacing.toFixed(5) };
  } };
})();
