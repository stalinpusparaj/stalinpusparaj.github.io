/* Light Up the Skies — Laser Light Gala, a Live Sky show of LED light, laser beams and fireworks together.
   After the big harbour LED + laser + fireworks festivals: the landmark's own LEDs washed in colour (rainbow sweeps,
   a chase running across it, white strobes on the beat), fans of laser beams from the ground cutting through haze
   (opening fans, crossing scissors, a tunnel that meets in one point, a running chase), and pictures of LED light in
   the sky (a rainbow halo, a spiral, wings, an infinity, a rainbow arch, a mandala) that draw themselves on, hold,
   and fall away as glitter while the fountains rise in front.
   The wash reads the scene once into a mask (its lights as alpha), so the colour lands only on the LEDs and the dark
   sky stays clear for the fireworks behind.
   The rig runs on its own clock (tick), so it pauses with the game; cues are started by the show's director.
   Built for phones: no allocation a frame beyond a few gradients, a small offscreen canvas for the LED wash, one
   sprite a dot of light, fewer beams and dots on a slow phone. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  const hsl = (h, l = 60) => `hsl(${((h % 360) + 360) % 360},100%,${l}%)`;
  const hueRgb = (h) => { // h in degrees -> "r,g,b" (full saturation, a touch light)
    h = (((h % 360) + 360) % 360) / 60;
    const x = 1 - Math.abs((h % 2) - 1), [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    const L = (v) => Math.round(60 + v * 195);
    return `${L(r)},${L(g)},${L(b)}`;
  };

  // ---------- dots of LED light: one glow sprite per hue step ----------
  const HUES = 24;
  let dots = null;
  function dotSprites() {
    if (dots) return dots;
    dots = [];
    for (let i = 0; i <= HUES; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), rgb = i === HUES ? '255,255,255' : hueRgb((i / HUES) * 360);
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, `rgba(${rgb},1)`); gr.addColorStop(0.45, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      dots.push(c);
    }
    return dots;
  }


  // ---------- the festival's other pictures: line drawings in unit space, sampled into evenly spaced LED dots ----------
  // Each builder returns strokes (lists of [x, y]); the dots light along the strokes in order, coloured left to right in
  // a rainbow as the harbour pictures are.
  const arc = (cx, cy, rx, ry, a0, a1, k = 40, rot = 0) => { const o = []; for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return o; };
  const ring = (cx, cy, r, k) => arc(cx, cy, r, r, 0, TAU, k);
  const petal = (bx, by, len, wid, rot, k = 24) => { const o = []; for (let i = 0; i <= k; i++) { const u = i / k, side = u <= 0.5 ? 1 : -1, v = u <= 0.5 ? u * 2 : 2 - u * 2, x = side * wid * Math.sin(Math.PI * v), y = -len * v; o.push([bx + x * Math.cos(rot) - y * Math.sin(rot), by + x * Math.sin(rot) + y * Math.cos(rot)]); } return o; }; // a pointed leaf, base at (bx, by)
  const flower = (cx, cy, r, n = 5) => { const o = []; for (let i = 0; i <= 60; i++) { const a = (i / 60) * TAU, rr = r * (0.55 + 0.45 * Math.abs(Math.cos((a * n) / 2))); o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return [o, ring(cx, cy, r * 0.22, 10)]; };
  const PICS = {
    sun() { const S = [ring(0, 0, 0.42, 50), ring(0, 0, 0.3, 36)]; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, l = i % 2 ? 0.75 : 0.98; S.push([[Math.cos(a) * 0.52, Math.sin(a) * 0.52], [Math.cos(a + 0.09) * (l - 0.1), Math.sin(a + 0.09) * (l - 0.1)], [Math.cos(a) * l, Math.sin(a) * l], [Math.cos(a - 0.09) * (l - 0.1), Math.sin(a - 0.09) * (l - 0.1)], [Math.cos(a) * 0.52, Math.sin(a) * 0.52]]); } return S; },
    crown() { const top = [[-0.85, 0.3], [-0.95, -0.35], [-0.5, 0.0], [-0.42, -0.6], [-0.15, -0.05], [0, -0.8], [0.15, -0.05], [0.42, -0.6], [0.5, 0], [0.95, -0.35], [0.85, 0.3]]; return [top, arc(0, 0.3, 0.85, 0.16, 0, Math.PI, 30), arc(0, 0.3, 0.85, 0.16, Math.PI, TAU, 30), arc(0, 0.52, 0.85, 0.16, 0, Math.PI, 30), [[-0.85, 0.3], [-0.85, 0.52]], [[0.85, 0.3], [0.85, 0.52]], ...[[-0.95, -0.35], [-0.42, -0.6], [0, -0.8], [0.42, -0.6], [0.95, -0.35]].map(([x, y]) => ring(x, y - 0.08, 0.07, 10))]; },
    umbrella() { const S = [arc(0, 0.1, 0.95, 0.8, Math.PI, TAU, 50)]; for (let i = 0; i < 6; i++) { const x0 = -0.95 + (i * 1.9) / 6; S.push(arc(x0 + 1.9 / 12, 0.1, 1.9 / 12, 0.1, 0, Math.PI, 10)); } for (let i = 0; i <= 6; i++) S.push([[0, -0.7], [-0.95 + (i * 1.9) / 6, 0.1]]); S.push([[0, -0.7], [0, 0.85]], arc(-0.1, 0.85, 0.1, 0.1, 0, Math.PI, 10)); return S; },
    yinyang() { return [ring(0, 0, 1, 70), [...arc(0, -0.5, 0.5, 0.5, -Math.PI / 2, Math.PI / 2, 30), ...arc(0, 0.5, 0.5, 0.5, -Math.PI / 2, -Math.PI * 1.5, 30)], ring(0, -0.5, 0.13, 12), ring(0, 0.5, 0.13, 12)]; },
    lotus() { const S = []; for (let k = -3; k <= 3; k++) S.push(petal(0, 0.45, 0.6 + 0.35 * (1 - Math.abs(k) / 3), 0.22, k * 0.42)); S.push(arc(0, 0.5, 0.95, 0.12, 0, Math.PI, 30), arc(0, 0.62, 0.7, 0.08, 0, Math.PI, 24)); return S; },
    bouquet() { const S = []; [[0, -0.1, 0.32], [-0.55, 0.1, 0.27], [0.55, 0.1, 0.27], [-0.3, -0.55, 0.24], [0.3, -0.55, 0.24], [-0.3, 0.45, 0.24], [0.3, 0.45, 0.24], [-0.8, -0.35, 0.18], [0.8, -0.35, 0.18]].forEach(([x, y, r], i) => S.push(...flower(x, y, r, 5 + (i % 3)))); return S; },
    blossom() { const S = [[[-1, 0.5], [-0.6, 0.3], [-0.2, 0.25], [0.2, 0.05], [0.6, -0.1], [1, -0.4]], [[-0.2, 0.25], [0, 0.55], [0.3, 0.7]], [[0.2, 0.05], [0.25, -0.35], [0.45, -0.6]]]; [[-0.6, 0.1], [-0.15, 0.0], [0.25, -0.25], [0.6, -0.35], [0.9, -0.6], [0.05, 0.55], [0.45, -0.65], [0.3, 0.7]].forEach(([x, y]) => S.push(...flower(x, y, 0.15, 5))); return S; },
    pagoda() { const S = [[[0, -1], [0, -0.82]]]; for (let k = 0; k < 6; k++) { const y = -0.8 + k * 0.3, w = 0.22 + k * 0.12; S.push([[-w - 0.12, y + 0.14], [-w, y + 0.1], [-w * 0.4, y], [w * 0.4, y], [w, y + 0.1], [w + 0.12, y + 0.14]], [[-w * 0.75, y + 0.11], [-w * 0.75, y + 0.3]], [[w * 0.75, y + 0.11], [w * 0.75, y + 0.3]]); } S.push([[-0.9, 1], [0.9, 1]]); return S; },
    teapot() { return [arc(0, 0.25, 0.62, 0.5, 0, TAU, 60), [[0.6, 0.15], [0.85, -0.05], [1, -0.3], [0.95, -0.35], [0.75, -0.05], [0.55, 0.0]], arc(-0.68, 0.22, 0.25, 0.3, Math.PI / 2, Math.PI * 1.5, 20), arc(0, -0.25, 0.32, 0.1, Math.PI, TAU, 20), ring(0, -0.42, 0.07, 10), arc(0.05, -0.75, 0.15, 0.15, Math.PI * 0.5, Math.PI * 2.2, 24), arc(-0.1, -0.95, 0.12, 0.08, 0, Math.PI * 1.5, 16)]; },
    moonrabbit() { return [arc(0, 0, 1, 1, -Math.PI * 0.6, Math.PI * 0.6, 50, Math.PI), arc(-0.38, 0, 0.78, 0.82, -Math.PI * 0.55, Math.PI * 0.55, 40, Math.PI), arc(0.25, 0.35, 0.35, 0.28, 0, TAU, 30), ring(0.45, 0.02, 0.17, 18), petal(0.42, -0.1, 0.5, 0.08, -0.2, 14), petal(0.52, -0.1, 0.48, 0.08, 0.25, 14), ring(-0.85, -0.7, 0.05, 6), ring(0.9, -0.85, 0.04, 6), ring(0.8, 0.75, 0.04, 6)]; },
    koi() { const fish = (r) => [arc(0, 0, 0.62, 0.62, r, r + 2.2, 40), arc(0, 0, 0.35, 0.35, r + 2.2, r + 0.2, 30), [[Math.cos(r) * 0.48, Math.sin(r) * 0.48], [Math.cos(r - 0.5) * 0.7, Math.sin(r - 0.5) * 0.7], [Math.cos(r - 0.45) * 0.3, Math.sin(r - 0.45) * 0.3], [Math.cos(r) * 0.48, Math.sin(r) * 0.48]], ring(Math.cos(r + 2) * 0.5, Math.sin(r + 2) * 0.5, 0.05, 6)]; return [ring(0, 0, 1, 70), ring(0, 0, 0.9, 60), ...fish(0), ...fish(Math.PI)]; },
    dragon() { const top = [], bot = [], S = []; for (let i = 0; i <= 60; i++) { const u = i / 60, x = -0.95 + u * 1.6, y = Math.sin(u * TAU * 1.25) * 0.35, w = 0.05 + 0.08 * Math.sin(u * Math.PI); top.push([x, y - w]); bot.push([x, y + w]); if (i % 5 === 0 && i < 58) S.push([[x, y - w], [x + 0.03, y - w - 0.12], [x + 0.06, y - w]]); } S.push(top, bot, arc(0.78, -0.02, 0.2, 0.14, 0, TAU, 24), [[0.75, -0.14], [0.65, -0.45]], [[0.85, -0.14], [0.85, -0.45]], [[0.98, 0], [1.05, 0.08], [0.9, 0.08]], ring(0.84, -0.06, 0.03, 6), [[-0.95, -0.05], [-1.05, -0.25]], [[-0.95, 0.05], [-1.05, 0.2]]); return S; },
    phoenix() { const S = [arc(0, -0.1, 0.12, 0.28, 0, TAU, 24), ring(0, -0.5, 0.1, 12), [[0.08, -0.5], [0.22, -0.45], [0.08, -0.43]], [[0, -0.6], [-0.1, -0.85], [0.05, -0.75], [0.1, -0.9]]]; for (let s = -1; s <= 1; s += 2) for (let f = 0; f < 6; f++) { const a = -0.3 - f * 0.18, l = 0.55 + f * 0.08; S.push([[s * 0.1, -0.2], [s * (0.1 + Math.cos(a) * l), -0.2 + Math.sin(a) * l * 1.1]]); } for (let k = -2; k <= 2; k++) S.push([[0, 0.15], [k * 0.15, 0.5], [k * 0.35, 0.8], [k * 0.45 + 0.1 * k, 0.95]], ring(k * 0.5, 0.95, 0.05, 6)); return S; },
    carp() { const S = [arc(0, -0.25, 0.6, 0.3, 0, TAU, 50, -0.35), [[0.48, -0.47], [0.85, -0.8], [0.9, -0.35], [0.5, -0.45]], ring(-0.42, -0.06, 0.05, 6), [[-0.1, -0.53], [0.05, -0.75], [0.2, -0.55]], [[-0.1, 0.0], [0.0, 0.18], [0.1, -0.02]]]; for (let k = 0; k < 4; k++) { const x = -0.75 + k * 0.5; S.push(arc(x, 0.6, 0.25, 0.25, Math.PI, TAU * 1.1, 28), arc(x + 0.06, 0.62, 0.12, 0.12, Math.PI, TAU * 1.2, 16)); } S.push([[-1, 0.85], [1, 0.85]]); return S; },
    lantern() { const S = [arc(0, 0, 0.6, 0.75, 0, TAU, 60), [[-0.3, -0.85], [0.3, -0.85]], [[-0.3, 0.85], [0.3, 0.85]], [[0, -0.85], [0, -1]], [[0, 0.85], [0, 1]], [[-0.1, 0.9], [-0.1, 1]], [[0.1, 0.9], [0.1, 1]]]; for (let k = -2; k <= 2; k++) if (k) S.push(arc(0, 0, 0.6 * Math.abs(k) / 2.5, 0.75, -Math.PI / 2, Math.PI / 2, 24, k < 0 ? Math.PI : 0)); S.push([[0, -0.75], [0, 0.75]]); return S; },
    butterfly() { const o = []; for (let i = 0; i <= 220; i++) { const a = (i / 220) * TAU * 2, r = Math.exp(Math.cos(a)) - 2 * Math.cos(4 * a) + Math.pow(Math.sin(a / 12), 5); o.push([Math.sin(a) * r * 0.27, -Math.cos(a) * r * 0.27 + 0.1]); } return [o, [[0, -0.2], [-0.12, -0.6]], [[0, -0.2], [0.12, -0.6]]]; },
    heart() { const o = [], i2 = []; for (let i = 0; i <= 80; i++) { const a = (i / 80) * TAU, x = 16 * Math.sin(a) ** 3, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); o.push([x / 17, y / 17]); i2.push([(x / 17) * 0.72, (y / 17) * 0.72 + 0.03]); } return [o, i2]; },
    stars() { const star = (cx, cy, r) => { const o = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return o; }; return [star(0, 0.05, 0.75), star(0, 0.08, 0.5), star(-0.8, -0.65, 0.18), star(0.8, -0.65, 0.18), star(-0.8, 0.7, 0.14), star(0.8, 0.7, 0.14)]; },
    palace() { const S = [[[-1, 0.9], [1, 0.9]]]; [[-0.8, 0.18, 0.55], [-0.4, 0.2, 0.85], [0, 0.26, 1.15], [0.4, 0.2, 0.85], [0.8, 0.18, 0.55]].forEach(([x, w, h]) => { const y = 0.9 - h; S.push([[x - w / 2, 0.9], [x - w / 2, y], [x + w / 2, y], [x + w / 2, 0.9]], [[x - w / 2 - 0.04, y], [x, y - 0.3], [x + w / 2 + 0.04, y]], [[x, y - 0.3], [x, y - 0.42]], arc(x, 0.9, w * 0.25, w * 0.4, Math.PI, TAU, 10)); }); return S; },
    gate() { return [[[-0.95, 0.9], [-0.95, -0.2], [0.95, -0.2], [0.95, 0.9]], arc(0, 0.9, 0.42, 0.75, Math.PI, TAU, 30), [[-1.05, -0.2], [-0.8, -0.45], [0.8, -0.45], [1.05, -0.2]], [[-0.6, -0.45], [-0.6, -0.65], [0.6, -0.65], [0.6, -0.45]], [[-0.75, -0.65], [0, -0.9], [0.75, -0.65]], [[-0.95, 0.2], [-0.55, 0.2]], [[0.55, 0.2], [0.95, 0.2]], ring(-0.75, -0.02, 0.08, 10), ring(0.75, -0.02, 0.08, 10)]; },
  };
  function sampleStrokes(S, n) {
    const segs = []; let L = 0;
    for (let k = 0; k < S.length; k++) for (let i = 1; i < S[k].length; i++) { const a = S[k][i - 1], b = S[k][i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > 0) { segs.push([a, b, L, l]); L += l; } }
    const P = [], step = L / n; let j = 0;
    for (let i = 0; i < n; i++) { const d = i * step; while (j < segs.length - 1 && segs[j][2] + segs[j][3] < d) j++; const [a, b, s0, l] = segs[j], u = clamp((d - s0) / l, 0, 1), x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u; P.push([x, y, d / L, (x + 1) * 160 + y * 30]); }
    return P;
  }

  // ---------- the LED pictures: points in a unit circle, each with its order (when it lights) and hue ----------
  // [x, y, order 0..1, hue degrees]
  function shape(id, n) {
    if (PICS[id]) return sampleStrokes(PICS[id](), Math.round(n * 1.5)); // (line drawings need more dots to read)
    const P = [];
    const add = (x, y, o, h) => P.push([x, y, o, h]);
    if (id === 'ring') { // a rainbow halo, two rings, drawn round from the top
      for (let i = 0; i < n; i++) { const f = i / n, k = i % 2, a = -Math.PI / 2 + f * TAU, r = k ? 0.78 : 1; add(Math.cos(a) * r, Math.sin(a) * r, f, f * 360 + k * 40); }
    } else if (id === 'spiral') { // three rainbow arms winding out from the middle
      for (let i = 0; i < n; i++) { const arm = i % 3, f = Math.floor(i / 3) / Math.ceil(n / 3), a = f * TAU * 1.6 + (arm * TAU) / 3, r = 0.08 + f * 0.92; add(Math.cos(a) * r, Math.sin(a) * r, f, f * 300 + arm * 120); }
    } else if (id === 'infinity') { // a figure eight lying down, two strands
      for (let i = 0; i < n; i++) { const k = i % 2, f = Math.floor(i / 2) / Math.ceil(n / 2), a = f * TAU, d = 1 + Math.sin(a) ** 2, s = k ? 0.88 : 1; add((Math.cos(a) / d) * 1.05 * s, ((Math.sin(a) * Math.cos(a)) / d) * 1.3 * s, f, f * 360 + k * 60); }
    } else if (id === 'arch') { // a rainbow across the sky, red outside, violet in
      const bands = 6, per = Math.ceil(n / bands);
      for (let b = 0; b < bands; b++) for (let i = 0; i < per; i++) { const f = i / (per - 1), a = Math.PI + f * Math.PI, r = 1 - b * 0.075; add(Math.cos(a) * r, Math.sin(a) * r + 0.45, f, b * 52); }
    } else if (id === 'wings') { // a halo with two great wings of feathers, pink to violet to teal to gold
      const halo = Math.round(n * 0.22);
      for (let i = 0; i < halo; i++) { const f = i / halo, a = -Math.PI / 2 + f * TAU; add(Math.cos(a) * 0.32, -0.42 + Math.sin(a) * 0.32, f * 0.4, 45); }
      const feathers = 9, per = Math.max(4, Math.floor((n - halo) / (feathers * 2)));
      for (let s = -1; s <= 1; s += 2) for (let fi = 0; fi < feathers; fi++) {
        const u = fi / (feathers - 1), ang = -0.95 + u * 1.25, len = 0.55 + 0.45 * Math.sin(u * Math.PI * 0.9 + 0.2);
        for (let j = 0; j < per; j++) { const v = (j + 1) / per; add(s * (0.12 + Math.cos(ang) * len * v), -0.05 + Math.sin(ang) * len * v * 0.9, 0.3 + u * 0.5 + v * 0.2, 320 - u * 200); }
      }
    } else if (id === 'fan') { // an open folding fan, ribs from the pivot, every rib its own colour
      const ribs = 13, per = Math.ceil(n / ribs);
      for (let r = 0; r < ribs; r++) { const u = r / (ribs - 1), a = Math.PI + 0.35 + u * (Math.PI - 0.7); for (let j = 0; j < per; j++) { const v = 0.25 + (j / (per - 1)) * 0.95; add(Math.cos(a) * v * 0.92, 0.45 + Math.sin(a) * v * 0.92, u * 0.6 + ((v - 0.25) / 0.95) * 0.4, u * 330); } }
    } else { // 'mandala': eight petals around a ring, the finale
      for (let i = 0; i < n; i++) { const k = i % 3, f = Math.floor(i / 3) / Math.ceil(n / 3), a = f * TAU, r = k === 0 ? 0.55 + 0.45 * Math.abs(Math.cos(a * 4)) : k === 1 ? 0.42 : 0.2 + 0.12 * Math.cos(a * 8); add(Math.cos(a) * r, Math.sin(a) * r, k === 2 ? f * 0.3 : f, f * 360 * 2 + k * 90); }
    }
    return P;
  }

  // ---------- the rig ----------
  function rig(opts = {}) {
    const lite = !!opts.lite;
    let t = 0, frame = 0;
    const cues = [];
    let off = null, octx = null, mask = null, mctx = null, maskKey = ''; // the LED wash's small canvases
    const R = {
      lite,
      get time() { return t; },
      get cues() { return cues; },
      // kind: 'fan' (laser beams), 'wash' (LED colour over the landmark), 'figure' (an LED picture in the sky)
      cue(kind, o = {}) {
        const c = { kind, at: t, dur: o.dur || 6, ...o };
        if (kind === 'fan') c.n = Math.max(2, Math.min(c.n || 8, lite ? 6 : 14));
        if (kind === 'figure') c.pts = shape(c.shape || 'ring', lite ? 130 : 240);
        cues.push(c);
        return c;
      },
      tick(dt) { t += dt; for (let i = cues.length - 1; i >= 0; i--) if (t - cues[i].at > cues[i].dur) cues.splice(i, 1); },
      // s: { W, H, top, roof, ground, water, sky (the scene's canvas), rect, dpr, U }
      draw(g, s) {
        frame++;
        if (!cues.length) return;
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (const c of cues) if (c.kind === 'wash') wash(g, s, c);
        for (const c of cues) if (c.kind === 'fan') fan(g, s, c);
        for (const c of cues) if (c.kind === 'figure') figure(g, s, c);
        g.restore();
      },
    };
    const env = (c, inT = 0.3, outT = 0.5) => { const u = t - c.at; return sm(u / inT) * sm((c.dur - u) / outT); };
    const beatOn = (u, beat, duty) => (u % beat) / beat < duty;

    // A beam: a soft cone of haze, then the bright line, fading along its length.
    function beam(g, x, y, ang, len, rgb, a, w, glow, wide) {
      if (a < 0.01) return;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      const gr = g.createLinearGradient(x, y, ex, ey);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      if (glow) {
        const half = len * (wide || 0.035), px = -Math.sin(ang) * half, py = Math.cos(ang) * half;
        g.globalAlpha = 0.28; g.fillStyle = gr;
        g.beginPath(); g.moveTo(x, y); g.lineTo(ex + px, ey + py); g.lineTo(ex - px, ey - py); g.closePath(); g.fill();
      }
      g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    }
    function fan(g, s, c) {
      const u = t - c.at, e = env(c, 0.35, 0.45) * (c.amt || 1), n = c.n, cols = c.cols || ['#33ff66'], speed = c.speed || 1, spread = c.spread || 1;
      const xs = c.xs || [0.5], len = Math.hypot(s.W, s.H) * 1.1, w = Math.max(1.2, 1.7 * s.U), glow = !lite;
      const beat = c.beat || 0.5;
      if (c.strobe && !beatOn(u, beat, 0.45)) return;
      for (let k = 0; k < xs.length; k++) {
        const ox = s.W * xs[k], oy = s.ground;
        // the mouth: a hot spot of the fan's colour on the ground, lighting its haze
        const mouthRgb = c.rainbow ? hueRgb(u * 90 + k * 80) : rgbOf(cols[k % cols.length]);
        if (!lite) { const r = 46 * s.U, gr = g.createRadialGradient(ox, oy, 0, ox, oy, r); gr.addColorStop(0, `rgba(${mouthRgb},${0.55 * e})`); gr.addColorStop(1, `rgba(${mouthRgb},0)`); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(ox - r, oy - r, r * 2, r * 2); }
        for (let i = 0; i < n; i++) {
          const f = n > 1 ? i / (n - 1) - 0.5 : 0;
          let ang = -Math.PI / 2, a = e;
          if (c.mode === 'open') ang += f * spread * sm(u / 2.5) * (0.75 + 0.25 * Math.sin(u * speed * 2));
          else if (c.mode === 'sweep') ang += f * spread + 0.75 * Math.sin(u * speed + k * Math.PI);
          else if (c.mode === 'scissor') { const dir = k % 2 ? -1 : 1; ang += dir * (0.55 + 0.45 * Math.sin(u * speed)) * 0.9 + f * spread; }
          else if (c.mode === 'aim') { // every beam meets one moving point in the sky: the tunnel
            const bx = s.W * (0.06 + (0.88 * i) / Math.max(1, n - 1)), tx = s.W * (0.5 + 0.28 * Math.sin(u * speed)), ty = s.top + (s.roof - s.top) * (0.35 + 0.12 * Math.cos(u * speed * 1.3));
            const rgb = c.rainbow ? hueRgb(i * (360 / n) + u * 60) : rgbOf(cols[i % cols.length]);
            beam(g, bx, oy, Math.atan2(ty - oy, tx - bx), len, rgb, e * 0.9, w, glow);
            if (s.water && !lite) beam(g, bx, oy, -Math.atan2(ty - oy, tx - bx), (s.H - oy) * 1.2, rgb, e * 0.18, w, false);
            continue;
          } else if (c.mode === 'chase') { ang += f * spread; const head = (u / beat) % n; const d = Math.min(Math.abs(i - head), n - Math.abs(i - head)); a = e * Math.max(0.12, 1 - d * 0.45); }
          else ang += f * spread; // 'still'
          const rgb = c.rainbow ? hueRgb((i / n) * 360 + u * 90) : rgbOf(cols[(i + k) % cols.length]);
          beam(g, ox, oy, ang, len, rgb, a, w, glow || !!c.wide, c.wide);
          if (s.water && !lite) beam(g, ox, oy, -ang, (s.H - oy) * 1.2, rgb, a * 0.18, w, false); // shining back in the water
        }
      }
      g.globalAlpha = 1;
    }
    // The LED wash: the scene's own lights (the landmark's LEDs; the sky is nearly black) as a mask, filled with a moving colour field and
    // added back, so only what is lit takes the colour: the sky stays dark.
    function wash(g, s, c) {
      if (!s.sky || !s.rect) return;
      const r = s.rect, sx = Math.max(0, r.dx), sy = Math.max(0, r.dy), sw = Math.min(s.W, r.dx + r.dw) - sx, sh = Math.min(s.H, r.dy + r.dh) - sy;
      if (sw < 4 || sh < 4) return;
      const scale = lite ? 0.3 : 0.5, ow = Math.max(8, Math.round(sw * scale)), oh = Math.max(8, Math.round(sh * scale));
      if (!off) { off = document.createElement('canvas'); octx = off.getContext('2d'); }
      const u = t - c.at, e = env(c, 0.6, 0.8), speed = c.speed || 0.4, col = (c.cols || ['#ffffff'])[0];
      let amt = (c.amt == null ? 0.8 : c.amt) * e;
      if (c.mode === 'strobe') amt *= beatOn(u, c.beat || 0.5, 0.3) ? 1 : 0.06;
      if (c.mode === 'pulse') amt *= 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((u / (c.beat || 0.5)) * TAU));
      if (amt < 0.02) return;
      // The mask: the scene's lights as alpha (bright LED = opaque, dark sky = clear), built once a scene and size.
      const key = `${sx},${sy},${sw},${sh},${ow}`;
      if (maskKey !== key) {
        maskKey = key;
        if (!mask) { mask = document.createElement('canvas'); mctx = mask.getContext('2d', { willReadFrequently: true }); }
        mask.width = off.width = ow; mask.height = off.height = oh;
        mctx.drawImage(s.sky, sx * s.dpr, sy * s.dpr, sw * s.dpr, sh * s.dpr, 0, 0, ow, oh);
        const im = mctx.getImageData(0, 0, ow, oh), d = im.data;
        for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = 255; const v = clamp((m - 70) / 150, 0, 1); d[i + 3] = 255 * v * Math.sqrt(v); } // (the stone court stays nearly clear)
        mctx.putImageData(im, 0, 0);
      }
      // (a slow phone repaints the field every other frame; the light still moves smoothly enough at that size)
      if (!lite || frame % 2 === 0 || !c.painted) {
        c.painted = true;
        octx.globalCompositeOperation = 'copy'; octx.globalAlpha = 1;
        octx.drawImage(mask, 0, 0);
        octx.globalCompositeOperation = 'source-in';
        let fill;
        if (c.mode === 'rainbow') { fill = octx.createLinearGradient(0, 0, ow, oh * 0.3); for (let i = 0; i <= 6; i++) fill.addColorStop(i / 6, hsl((i / 6) * 300 - u * speed * 360, 60)); }
        else if (c.mode === 'chase') { const p = ((u * speed) % 1) * 1.6 - 0.3; fill = octx.createLinearGradient(0, 0, ow, 0); const rgb = rgbOf(col); fill.addColorStop(0, `rgba(${rgb},0.12)`); fill.addColorStop(clamp(p - 0.16, 0, 1), `rgba(${rgb},0.12)`); fill.addColorStop(clamp(p, 0, 1), `rgba(${rgb},1)`); fill.addColorStop(clamp(p + 0.16, 0, 1), `rgba(${rgb},0.12)`); fill.addColorStop(1, `rgba(${rgb},0.12)`); }
        else if (c.mode === 'rise') { const p = 1 - ((u * speed) % 1) * 1.4 + 0.2; fill = octx.createLinearGradient(0, 0, 0, oh); const rgb = rgbOf(col); fill.addColorStop(0, `rgba(${rgb},0.06)`); fill.addColorStop(clamp(p - 0.25, 0, 1), `rgba(${rgb},0.06)`); fill.addColorStop(clamp(p, 0, 1), `rgba(${rgb},1)`); fill.addColorStop(1, `rgba(${rgb},1)`); }
        else fill = col; // 'solid', 'pulse', 'strobe'
        octx.fillStyle = fill; octx.fillRect(0, 0, ow, oh);
      }
      g.globalAlpha = Math.min(1, amt);
      g.drawImage(off, sx, sy, sw, sh);
      if (amt > 1) { g.globalAlpha = amt - 1; g.drawImage(off, sx, sy, sw, sh); }
      g.globalAlpha = 1;
    }
    // (On a phone on its side the roofline leaves only a strip of sky: the picture floats over the landmark instead, as
    // LED pictures do over a harbour skyline.)
    // An LED picture: drawn on in order (a bright head running ahead), holding with a twinkle and a slow hue drift, then
    // falling away as glitter.
    function figure(g, s, c) {
      const u = t - c.at, D = dotSprites(), pts = c.pts;
      const skyH = Math.max(40, s.roof - s.top, (s.H - s.top) * 0.45), cx = s.W * (c.x == null ? 0.5 : c.x), cy = s.top + skyH * (c.y == null ? 0.5 : c.y);
      const rad = Math.min(s.W * (c.r || 0.4), skyH * 0.46) * (0.96 + 0.04 * sm(u / 2));
      const build = c.build || 1.4, fall = c.fall || 1.6, fallAt = c.dur - fall, spin = c.spin || 0;
      const ds = Math.max(3, rad * (lite ? 0.075 : 0.06));
      const ca = Math.cos(spin * u), sa = Math.sin(spin * u);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], on = (u - p[2] * build) / 0.25;
        if (on <= 0) continue;
        let x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca, a = Math.min(1, on), size = ds;
        if (on < 1.6) size *= 1 + (1.6 - on) * 0.9; // the head burns bright as it lights
        a *= 0.72 + 0.28 * Math.sin(i * 12.9898 + u * 7);
        let px = cx + x * rad, py = cy + y * rad;
        if (u > fallAt) { const v = (u - fallAt) / fall; py += v * v * rad * (0.5 + ((i * 7) % 5) * 0.12); px += Math.sin(i * 3.1) * v * rad * 0.08; a *= (1 - v) * (0.5 + 0.5 * Math.sin(i * 5.3 + u * 30)); size *= 1 - v * 0.5; }
        if (a < 0.03) continue;
        const h = Math.round(((((p[3] + u * (c.drift || 25)) % 360) + 360) % 360) / 360 * HUES) % HUES;
        g.globalAlpha = a;
        g.drawImage(c.white ? D[HUES] : D[h], px - size, py - size, size * 2, size * 2);
      }
      g.globalAlpha = 1;
    }
    return R;
  }

  window.LUTSLaserShow = { rig, shape, SHAPES: ['ring', 'spiral', 'infinity', 'arch', 'wings', 'fan', 'mandala', ...Object.keys(PICS)] };
})();
