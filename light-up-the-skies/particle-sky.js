/* Light Up the Skies — "Particle Festival", an animated world (background) players can pick from the world list.
   The sky, the moon and the water are drawn as tiny glowing specks (no solid fills); a few people walk the ghat
   trailing ribbons of light and a few lanterns rise. The game shows it at night (setHour picks the time).

   Built for phones: everything that stands still is drawn once into a cached layer; each frame only
   redraws the moving specks, at most 30 times a second, and it only runs while the world is showing.
   It draws offscreen and hands each frame to opts.onDraw(canvas), so the game can put it on its own sky layer
   (where photos, recorded videos and the 3D view already pick the sky up). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // Keyframes through the day (hour of day, 0–24). Each names the colours the specks take.
  const DAY = [
    { h: 0, top: '#03040f', low: '#1a1236', speck: '#c9c2ff', stone: '#e8e2ff', water: '#2a2a6a', disc: '#f3ecdc', stars: 1, lamps: 1, sun: 0 },
    { h: 5, top: '#0b0b2a', low: '#3a2450', speck: '#d6c4ff', stone: '#efe4ff', water: '#3a3070', disc: '#f3ecdc', stars: 0.7, lamps: 0.8, sun: 0 },
    { h: 6.5, top: '#2b2a6e', low: '#ff9a6a', speck: '#ffd2b0', stone: '#ffe2d0', water: '#7a5a9a', disc: '#ffd27a', stars: 0.1, lamps: 0.2, sun: 1 },
    { h: 9, top: '#3a7ad8', low: '#bfe0ff', speck: '#ffffff', stone: '#ffd9b8', water: '#5aa0e0', disc: '#fff1c0', stars: 0, lamps: 0, sun: 1 },
    { h: 16, top: '#2f6fd0', low: '#ffe2b0', speck: '#fff8ea', stone: '#ffd2b0', water: '#4f8fd8', disc: '#fff1c0', stars: 0, lamps: 0, sun: 1 },
    { h: 18, top: '#3a2a7a', low: '#ff7a5a', speck: '#ffc0a0', stone: '#ffd6c0', water: '#8a4a8a', disc: '#ffb060', stars: 0.15, lamps: 0.6, sun: 1 },
    { h: 19.5, top: '#0c0b30', low: '#5a2a6a', speck: '#e0c0ff', stone: '#f4e2ff', water: '#3a2a6a', disc: '#f3ecdc', stars: 0.8, lamps: 1, sun: 0 },
    { h: 24, top: '#03040f', low: '#1a1236', speck: '#c9c2ff', stone: '#e8e2ff', water: '#2a2a6a', disc: '#f3ecdc', stars: 1, lamps: 1, sun: 0 },
  ];
  function phaseAt(hour) {
    let i = 0;
    while (i < DAY.length - 2 && hour >= DAY[i + 1].h) i++;
    const a = DAY[i], b = DAY[i + 1], t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const out = { hour };
    for (const k of ['top', 'low', 'speck', 'stone', 'water', 'disc']) out[k] = mix(hex(a[k]), hex(b[k]), t);
    for (const k of ['stars', 'lamps', 'sun']) out[k] = lerp(a[k], b[k], t);
    out.night = out.lamps > 0.5;
    return out;
  }

  // ---------- Shapes, sampled into point clouds ----------
  function personPath(g, w, h) {
    g.beginPath();
    g.arc(w * 0.5, h * 0.12, w * 0.18, 0, TAU); // head
    g.moveTo(w * 0.28, h * 0.26); g.lineTo(w * 0.72, h * 0.26); g.lineTo(w * 0.82, h * 0.72); g.lineTo(w * 0.18, h * 0.72); g.closePath();
    g.rect(w * 0.3, h * 0.7, w * 0.14, h * 0.3); g.rect(w * 0.56, h * 0.7, w * 0.14, h * 0.3); // legs
  }
  // Samples a shape into points (0..1 in the box). Edge points are marked so outlines glow brighter.
  function sample(drawPath, w, h, n, seed) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; drawPath(g, w, h); g.fill('nonzero');
    const d = g.getImageData(0, 0, w, h).data, inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 128;
    const cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) cells.push(x, y, (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2)) ? 1 : 0);
    const rnd = mulberry(seed), pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Edges get a third of the specks so the silhouette reads crisply at small sizes.
      let k;
      for (let tries = 0; tries < 6; tries++) { k = ((rnd() * cells.length / 3) | 0) * 3; if (cells[k + 2] || rnd() > 0.45) break; }
      pts[i * 3] = (cells[k] + rnd()) / w; pts[i * 3 + 1] = (cells[k + 1] + rnd()) / h; pts[i * 3 + 2] = cells[k + 2];
    }
    return pts;
  }

  function glowSprite(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), r = size / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return c;
  }

  // ---------- The scene ----------
  function create(opts = {}) {
    const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
    const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Budget from the device: fewer specks on low-memory phones and the Android WebView.
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    const tier = opts.tier != null ? opts.tier : (mem <= 2 || cores <= 4 ? 0 : mem >= 6 && cores >= 8 ? 2 : 1);
    // Kept small on purpose so low-end phones never stall: few moving things, short ribbons, a light water layer.
    const BUDGET = [{ sky: 700, water: 160, person: 50, people: 2, fliers: 2, dpr: 1 }, { sky: 1100, water: 260, person: 60, people: 3, fliers: 3, dpr: 1.25 }, { sky: 1500, water: 360, person: 70, people: 4, fliers: 4, dpr: 1.5 }][tier];
    const cap = opts.maxDpr || BUDGET.dpr;
    const sprite = glowSprite(32);
    const personPts = sample(personPath, 24, 60, BUDGET.person, 5);
    const staticC = document.createElement('canvas'), sg = staticC.getContext('2d');
    let W = 0, H = 0, DPR = 1, raf = 0, last = 0, acc = 0, running = false, phase = null, phaseKey = '', hourOverride = null, t = 0;
    let twinkle = null, people = [], fliers = [];

    const hourNow = () => {
      if (hourOverride != null) return hourOverride;
      const d = new Date(); return d.getHours() + d.getMinutes() / 60;
    };
    // Layout: where the skyline, ghat and water sit for this screen shape.
    // The water line sits above the game's bottom controls (opts.horizon, a fraction of the height).
    let paintedHorizon = -1;
    const L = () => {
      const portrait = H > W * 1.25, horizon = H * (opts.horizon ? opts.horizon(portrait) : portrait ? 0.7 : 0.68);
      const tw = Math.min(W * 0.95, H * (portrait ? 0.46 : 0.62)), th = tw * 0.66;
      return { tw, th, tx: (W - tw) / 2, horizon, ghat: horizon + H * 0.012, water: horizon + H * 0.03 };
    };

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      DPR = Math.min(window.devicePixelRatio || 1, cap);
      for (const c of [canvas, staticC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
      g.setTransform(DPR, 0, 0, DPR, 0, 0); sg.setTransform(DPR, 0, 0, DPR, 0, 0);
      phaseKey = '';
      paintStatic();
      spawn();
    }

    // Everything that does not move: the specked sky, the moon, the ghat steps. Repainted when the hour moves on.
    function paintStatic() {
      phase = phaseAt(hourNow());
      phaseKey = phase.hour.toFixed(1);
      const p = phase, l = L(), rnd = mulberry(3);
      paintedHorizon = l.horizon;
      sg.globalCompositeOperation = 'source-over';
      const sky = sg.createLinearGradient(0, 0, 0, l.horizon);
      sky.addColorStop(0, css(p.top)); sky.addColorStop(1, css(p.low));
      sg.fillStyle = sky; sg.fillRect(0, 0, W, H);
      sg.fillStyle = css(mix(p.low, [0, 0, 0], 0.55)); sg.fillRect(0, l.horizon, W, H - l.horizon);
      sg.globalCompositeOperation = 'lighter';
      // Sky specks, denser and warmer near the horizon: the particle look instead of a flat fill.
      const twk = [];
      for (let i = 0; i < BUDGET.sky; i++) {
        const y = Math.pow(rnd(), 0.7) * l.horizon, x = rnd() * W, near = y / l.horizon;
        const c = mix(p.speck, p.low, near * 0.6), a = (0.05 + 0.22 * near) + p.stars * (rnd() < 0.25 ? 0.5 : 0);
        if (p.stars > 0.3 && rnd() < 0.08) { twk.push(x, y, rnd() * TAU, 0.6 + rnd()); continue; }
        sg.fillStyle = css(c, a); sg.fillRect(x, y, 1, 1);
      }
      twinkle = new Float32Array(twk);
      // Sun or moon as a disc of specks with a soft halo.
      const dx = W * (p.sun > 0.5 ? lerp(0.15, 0.85, clamp((p.hour - 6) / 13, 0, 1)) : 0.8), dy = H * (p.sun > 0.5 ? 0.12 + 0.18 * Math.abs(p.hour - 12.5) / 6.5 : 0.14), dr = Math.max(14, Math.min(W, H) * 0.045);
      sg.globalAlpha = 0.5; sg.drawImage(sprite, dx - dr * 4, dy - dr * 4, dr * 8, dr * 8); sg.globalAlpha = 1;
      for (let i = 0; i < 260; i++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * dr;
        sg.fillStyle = css(p.disc, 0.5 + rnd() * 0.5); sg.fillRect(dx + Math.cos(a) * r, dy + Math.sin(a) * r, 1.3, 1.3);
      }
      // Ghat edge: a row of diyas at night, a bright stone line by day.
      for (let x = W * 0.04; x < W * 0.96; x += Math.max(6, W / 70)) {
        if (p.lamps > 0.3) { sg.globalAlpha = 0.35 * p.lamps; sg.drawImage(sprite, x - 6, l.ghat - 6, 12, 12); sg.globalAlpha = 1; }
        sg.fillStyle = p.lamps > 0.3 ? css([255, 190, 110], 0.9) : css(p.stone, 0.5); sg.fillRect(x, l.ghat, 1.6, 1.6);
      }
      sg.globalCompositeOperation = 'source-over';
    }

    function spawn() {
      const rnd = mulberry(9), l = L(), n = BUDGET.people;
      people = [];
      for (let i = 0; i < n; i++) {
        const s = lerp(0.7, 1.15, rnd()) * clamp(H / 900, 0.6, 1.2);
        people.push({ x: rnd() * W, y: l.ghat - 2, s, v: (rnd() < 0.5 ? -1 : 1) * lerp(6, 16, rnd()), ph: rnd() * TAU, trail: [], hue: rnd() });
      }
      fliers = [];
      for (let i = 0; i < BUDGET.fliers; i++) fliers.push({ x: rnd() * W, y: lerp(l.horizon, H * 0.15, rnd()), v: lerp(8, 18, rnd()), ph: rnd() * TAU, trail: [], k: rnd() });
    }

    // Ribbons: a soft stroke along a short history of positions, fading to nothing at the tail.
    function ribbon(trail, color, width, alpha) {
      if (trail.length < 3) return;
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = css(color);
      for (let i = 1; i < trail.length; i++) {
        const f = i / trail.length;
        g.globalAlpha = alpha * f * f; g.lineWidth = width * f;
        g.beginPath(); g.moveTo(trail[i - 1][0], trail[i - 1][1]); g.lineTo(trail[i][0], trail[i][1]); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // Colour strings are built once per phase, not per speck: each frame only changes globalAlpha (cheap on phones).
    let speckCss = '', waterCss = '', cssPhase = null, phaseCheck = 0;
    const lampCss = 'rgb(255,190,110)';
    function draw(dt) {
      t += dt;
      phaseCheck -= dt;
      if (phaseCheck <= 0) { phaseCheck = 5; if (Math.abs(phaseAt(hourNow()).hour - phase.hour) > 0.1) paintStatic(); }
      if (cssPhase !== phase) { cssPhase = phase; speckCss = css(phase.speck); waterCss = css(phase.water); }
      const p = phase, l = L(), night = p.lamps > 0.5;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(staticC, 0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      // Twinkling stars.
      g.fillStyle = speckCss;
      for (let i = 0; i < twinkle.length; i += 4) {
        g.globalAlpha = p.stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * twinkle[i + 3] * 2 + twinkle[i + 2])));
        g.fillRect(twinkle[i], twinkle[i + 1], 1.4, 1.4);
      }
      // Water: the sky's colours as drifting horizontal specks, shimmering under the lamps.
      const rnd = mulberry(21);
      for (let i = 0; i < BUDGET.water; i++) {
        const y = l.water + Math.pow(rnd(), 1.6) * (H - l.water), x = (rnd() * W + t * lerp(4, 14, rnd())) % W;
        g.globalAlpha = (0.2 + 0.45 * rnd()) * (0.6 + 0.4 * Math.sin(t * 1.5 + i));
        g.fillStyle = rnd() < 0.15 * p.lamps ? lampCss : waterCss; g.fillRect(x, y, 2 + rnd() * 3, 1);
      }
      g.globalAlpha = 1;
      // Lanterns (night) or kites (day), each trailing a ribbon.
      for (const f of fliers) {
        f.ph += dt;
        if (night) { f.y -= f.v * dt; f.x += Math.sin(f.ph * 0.8) * 6 * dt; if (f.y < -20) { f.y = l.horizon; f.x = Math.random() * W; f.trail.length = 0; } }
        else { f.x += f.v * dt * 0.6; f.y += Math.sin(f.ph * 1.3) * 10 * dt; if (f.x > W + 20) { f.x = -20; f.trail.length = 0; } }
        f.trail.push([f.x, f.y + (night ? 6 : 4)]); if (f.trail.length > 8) f.trail.shift();
        ribbon(f.trail, night ? [255, 160, 80] : f.k < 0.5 ? [255, 90, 160] : [255, 200, 60], night ? 2.2 : 1.6, night ? 0.5 : 0.65);
        const r = night ? 5 : 4;
        g.globalAlpha = night ? 0.8 : 0.5; g.drawImage(sprite, f.x - r * 3, f.y - r * 3, r * 6, r * 6); g.globalAlpha = 1;
        g.fillStyle = night ? css([255, 210, 140], 0.95) : css(f.k < 0.5 ? [255, 120, 180] : [255, 210, 90], 0.95);
        g.fillRect(f.x - r * 0.5, f.y - r * 0.6, r, r * 1.2);
      }
      // People on the ghat: speck figures; a sparkler ribbon at night, a flowing dupatta by day.
      for (const m of people) {
        m.x += m.v * dt; m.ph += dt * 3;
        if (m.x < -30) m.x = W + 30; else if (m.x > W + 30) m.x = -30;
        const w = 12 * m.s, h = 30 * m.s, bx = m.x - w / 2, by = m.y - h + Math.abs(Math.sin(m.ph)) * 1.2;
        const hand = [m.x + (night ? 0 : -Math.sign(m.v) * w * 0.4), by + h * (night ? 0.05 : 0.3) + Math.sin(m.ph * 1.7) * (night ? 5 : 2)];
        if (night) hand[0] += Math.cos(m.ph * 1.3) * 7;
        m.trail.push(hand); if (m.trail.length > (night ? 12 : 8)) m.trail.shift();
        const rc = night ? [255, 200, 110] : m.hue < 0.33 ? [255, 120, 60] : m.hue < 0.66 ? [255, 80, 160] : [250, 210, 70];
        ribbon(m.trail, rc, night ? 2.6 : 3.2 * m.s, night ? 0.85 : 0.55);
        if (night) { g.globalAlpha = 0.9; g.drawImage(sprite, hand[0] - 7, hand[1] - 7, 14, 14); g.globalAlpha = 1; }
        g.fillStyle = css(night ? [200, 190, 255] : [60, 40, 90], night ? 0.7 : 0.75);
        for (let i = 0; i < personPts.length; i += 3) g.fillRect(bx + personPts[i] * w, by + personPts[i + 1] * h, 1.2, 1.2);
      }
      g.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
      if (acc < 1 / 30) return; // 30 fps is plenty for drifting specks, and halves the battery cost
      const step = acc; acc = 0;
      draw(step);
      if (opts.onDraw) opts.onDraw(canvas);
    }

    function start() {
      if (running) return;
      if (!W) resize();
      else if (L().horizon !== paintedHorizon) { paintStatic(); spawn(); } // the game's controls moved: follow the ground
      if (reduce()) { drawNow(); return; }
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    // One still frame now (the game asks for this when the sky is repainted, e.g. after a resize or a world switch).
    function drawNow() { if (!W || W !== window.innerWidth || H !== window.innerHeight) resize(); draw(0); if (opts.onDraw) opts.onDraw(canvas); }
    // The game moved its ground line (another play mode, the controls changed size): repaint the ghat there.
    function refit() { if (W && L().horizon !== paintedHorizon) { paintStatic(); spawn(); if (!running) drawNow(); } }
    function setHour(h) { hourOverride = h == null ? null : ((h % 24) + 24) % 24; if (W) { paintStatic(); spawn(); } }

    // skyTop: the colour at the top of the sky now, for the game to extend the sky above it during a rocket's flight;
    // skyTopRgb the same as "r,g,b", and stars how starry it is now (1 at night, 0 by day), so that sky has stars too.
    return { start, stop, drawNow, setHour, refit, canvas, get skyTop() { return phase ? css(phase.top) : '#020309'; },
      get skyTopRgb() { return phase ? phase.top.map((v) => v | 0).join(',') : '2,3,9'; }, get stars() { return phase ? phase.stars : 1; },
      get tier() { return tier; }, get running() { return running; } };
  }

  window.LUTSParticleSky = { create, phaseAt };
})();
