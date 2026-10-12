/* Light Up the Skies — interactive fireworks show + greeting cards */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = hex.length === 4
      ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
      : [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanMsg = (s, max) => String(s || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

  // ---------- Settings ----------
  const DEFAULTS = {
    shell: 'random', size: 3, theme: 'classic', quality: 'normal', skyLight: 'normal',
    auto: true, finale: false, longExposure: false, skyline: true, sound: true, volume: 0.7,
    item: 'flowerpot', spark: 'gold',
  };
  const settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('luts:settings') || '{}');
    for (const k in DEFAULTS) if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) settings[k] = saved[k];
  } catch (e) { /* storage unavailable */ }
  const saveSettings = () => { try { localStorage.setItem('luts:settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  const QUALITY = {
    low: { dpr: 1, count: 0.55, glitter: 0.45, maxStars: 2600 },
    normal: { dpr: 1.5, count: 1, glitter: 1, maxStars: 5500 },
    high: { dpr: 2, count: 1.4, glitter: 1.3, maxStars: 9000 },
  };
  const Q = () => QUALITY[settings.quality] || QUALITY.normal;
  const SKY_LIGHT = { off: 0, dim: 0.5, normal: 1 };
  const SIZE_SCALE = [0.6, 0.75, 0.9, 1.05, 1.25, 1.5];
  const sizeScale = () => SIZE_SCALE[clamp(settings.size, 1, 6) - 1];

  const COLORS = {
    red: '#ff4a4a', gold: '#ffc94d', green: '#4df29a', blue: '#4aa8ff', purple: '#b56bff',
    pink: '#ff5fc1', white: '#fff4e0', cyan: '#5ff0ff', orange: '#ff8a2b',
  };
  const PALETTES = {
    classic: Object.values(COLORS),
    gold: ['#ffd36b', '#ffb347', '#fff1c9', '#ff9a3c', '#ffe08a'],
    rainbow: ['#ff4d6d', '#ffb347', '#ffe66d', '#4dff9a', '#4dc3ff', '#b06bff'],
    rose: ['#ff5fa2', '#ff8fb8', '#ff3b6b', '#ffd1e1', '#e04dff'],
    ocean: ['#4dc3ff', '#5ff0ff', '#4a7dff', '#b0f0ff', '#8f7bff'],
    festive: ['#3dff8a', '#ff4040', '#ffd36b', '#e8fff2'],
  };
  const THEME_LABELS = { classic: 'Classic', gold: 'Golden', rainbow: 'Rainbow', rose: 'Rose', ocean: 'Ocean', festive: 'Festive' };
  let palette = PALETTES[settings.theme] || PALETTES.classic;
  const color = () => pick(palette);

  // ---------- Worlds of India: background configuration ----------
  // image: file name under assets/worlds/bg (.webp, .jpg fallback). focus: [x, y] focal position of the landmark (as object-position).
  // skyline: top of the tallest structure as a fraction of image height. keep: horizontal span of the structure.
  // overlay: how strongly the sky above the landmark is darkened. sacred: bursts are lifted clear of the structure.
  const WORLDS = [
    { id: 'default', name: 'Default Night Sky', place: 'Classic', image: null, thumb: 'default-night-sky' },
    { id: 'taj-mahal', name: 'Taj Mahal', place: 'Agra', image: 'taj-mahal', focus: [0.5, 1], skyline: 0.4, keep: [0.08, 0.92], overlay: 0.6, sacred: true,
      preset: { name: 'Pearl & royal blue', colors: ['#fff6ea', '#ffd36b', '#4a6dff', '#9fc0ff', '#fff1c9'] } },
    { id: 'india-gate', name: 'India Gate', place: 'New Delhi', image: 'india-gate', focus: [0.5, 1], skyline: 0.4, keep: [0.3, 0.7], overlay: 0.55,
      preset: { name: 'Tiranga', colors: ['#ff9933', '#fff4e0', '#3ddc84', '#ffd36b'] } },
    { id: 'hawa-mahal', name: 'Hawa Mahal', place: 'Jaipur', image: 'hawa-mahal', focus: [0.45, 1], skyline: 0.46, keep: [0.18, 1], overlay: 0.5,
      preset: { name: 'Pink City', colors: ['#ff7eb6', '#ff3fb4', '#ffc46b', '#ffd1e1'] } },
    { id: 'mysore-palace', name: 'Mysore Palace', place: 'Mysuru', image: 'mysore-palace', focus: [0.5, 1], skyline: 0.54, keep: [0, 1], overlay: 0.5,
      preset: { name: 'Dasara royal', colors: ['#ffd36b', '#a56bff', '#ff4a4a', '#ffb347'] } },
    { id: 'gateway-of-india', name: 'Gateway of India', place: 'Mumbai', image: 'gateway-of-india', focus: [0.5, 1], skyline: 0.37, keep: [0.2, 0.82], overlay: 0.55,
      preset: { name: 'Arabian Sea', colors: ['#4dc3ff', '#e6ecf5', '#ffd36b', '#4a7dff'] } },
    { id: 'charminar', name: 'Charminar', place: 'Hyderabad', image: 'charminar', focus: [0.5, 1], skyline: 0.31, keep: [0.28, 0.72], overlay: 0.6,
      preset: { name: 'Emerald & magenta', colors: ['#3ddc97', '#ff3fb4', '#ffd36b', '#fff4e0'] } },
    { id: 'konark-sun-temple', name: 'Konark Sun Temple', place: 'Odisha', image: 'konark-sun-temple', focus: [0.5, 1], skyline: 0.33, keep: [0.18, 0.82], overlay: 0.5, sacred: true,
      preset: { name: 'Sun chariot', colors: ['#ffbf3c', '#ff8a2b', '#e0975a', '#ffe08a'] } },
    { id: 'golden-temple', name: 'Golden Temple', place: 'Amritsar', image: 'golden-temple', focus: [0.52, 1], skyline: 0.33, keep: [0.18, 0.85], overlay: 0.6, sacred: true,
      preset: { name: 'Golden glow', colors: ['#ffd36b', '#fff4e0', '#4a6dff', '#ffe9a8'] } },
    { id: 'victoria-memorial', name: 'Victoria Memorial', place: 'Kolkata', image: 'victoria-memorial', focus: [0.5, 1], skyline: 0.31, keep: [0.15, 0.85], overlay: 0.55,
      preset: { name: 'Marble night', colors: ['#fff4e0', '#9fc8ff', '#c9a6ff', '#ffd36b'] } },
    { id: 'red-fort', name: 'Red Fort', place: 'Delhi', image: 'red-fort', focus: [0.5, 1], skyline: 0.38, keep: [0.1, 0.95], overlay: 0.5,
      preset: { name: 'Independence Day', colors: ['#ff9933', '#fff4e0', '#3ddc84', '#ff6a4d'] } },
    { id: 'meenakshi-amman-temple', name: 'Meenakshi Amman Temple', place: 'Madurai', image: 'meenakshi-amman-temple', focus: [0.32, 1], skyline: 0.08, keep: [0.18, 0.45], overlay: 0.5, sacred: true,
      preset: { name: 'Temple jewels', colors: ['#ff4a6a', '#3ddc97', '#4a8dff', '#ffd36b', '#b56bff'] } },
    { id: 'brihadeeswarar-temple', name: 'Brihadeeswarar Temple', place: 'Thanjavur', image: 'brihadeeswarar-temple', focus: [0.42, 1], skyline: 0.08, keep: [0.18, 0.64], overlay: 0.5, sacred: true,
      preset: { name: 'Chola bronze', colors: ['#e0975a', '#ffbf3c', '#ffd36b', '#fff1d6'] } },
    { id: 'vivekananda-rock-memorial', name: 'Vivekananda Rock Memorial', place: 'Kanyakumari', image: 'vivekananda-rock-memorial', focus: [0.5, 1], skyline: 0.33, keep: [0.18, 0.78], overlay: 0.55, sacred: true,
      preset: { name: 'Three seas', colors: ['#3fe0d0', '#ff9933', '#4aa8ff', '#fff4e0'] } },
  ];
  const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
  // img is null for the default painted sky. rect is the landmark's on-screen placement, set by drawWorldSky().
  const world = { id: 'default', cfg: WORLD_BY_ID.default, img: null, rect: null, preset: false, pending: null, blur: null, masked: null, maskKey: '' };

  // ---------- Premium: what's free ----------
  // Free: the classic sky, Taj Mahal and India Gate. Premium (a subscription in the Android and iOS apps) unlocks the
  // other landmarks and Celebration Colours. Crackers, shells, cards, AR, photos and videos are free for everyone.
  const FREE_WORLDS = new Set(['default', 'taj-mahal', 'india-gate']);
  // status: web (no store here) | loading | ready | purchasing | restoring | error | unavailable
  const premium = { active: false, status: window.LUTSNative ? 'loading' : 'web', plans: [], pick: 'annual', intent: null, manageUrl: null, message: '' };
  // In the app, start from the last state the store confirmed, so a subscriber's landmark shows at once, even offline.
  if (window.LUTSNative) { try { premium.active = localStorage.getItem('luts:premium') === '1'; } catch (e) { /* storage unavailable */ } }
  const worldLocked = (cfg) => !premium.active && !FREE_WORLDS.has(cfg.id);
  const CROWN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-10-4.6 4.2L12 5l-2.8 7.2L4.6 8z"/></svg>';

  // ---------- Canvas setup ----------
  const skyC = $('#sky'), fxC = $('#fx'), cityC = $('#city');
  // Front layers: street floor, sparkler light-painting and ground effects all sit in front of the skyline.
  const floorC = $('#floor'), itemsC = $('#items'), paintC = $('#paint'), gfxC = $('#gfx');
  const fctx = floorC.getContext('2d'), ictx = itemsC.getContext('2d'), pctx = paintC.getContext('2d'), gctx = gfxC.getContext('2d');
  let curLayer = 0; // 0 = sky (behind city), 1 = ground (in front)
  const sctx = skyC.getContext('2d');
  const ctx = fxC.getContext('2d');
  const cctx = cityC.getContext('2d');
  const skyGlow = $('#skyGlow');
  let W = 0, H = 0, DPR = 1, U = 1;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, Q().dpr);
    U = clamp(Math.min(W, H * 1.25) / 800, 0.5, 1.6);
    for (const c of [skyC, fxC, cityC, floorC, itemsC, paintC, gfxC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    for (const g of [sctx, ctx, cctx, fctx, ictx, pctx, gctx]) g.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = gctx.lineCap = pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    drawFloor();
    repaintStrokes();
    drawSky();
    drawCity();
  }

  function drawSky() {
    const g = sctx;
    if (world.img) { drawWorldSky(g); return; }
    world.rect = null;
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#020309');
    grd.addColorStop(0.5, '#060920');
    grd.addColorStop(0.82, '#130f2d');
    grd.addColorStop(1, '#261736');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // Faint milky band
    g.save();
    g.translate(W * 0.5, H * 0.35);
    g.rotate(-0.35);
    const band = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H) * 0.6);
    band.addColorStop(0, 'rgba(120,110,200,0.08)');
    band.addColorStop(1, 'rgba(120,110,200,0)');
    g.scale(1, 0.22);
    g.fillStyle = band;
    g.beginPath(); g.arc(0, 0, Math.max(W, H) * 0.6, 0, TAU); g.fill();
    g.restore();

    const rnd = mulberry(7);
    const n = Math.round((W * H) / 2400);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H * 0.85;
      const big = rnd() < 0.06;
      const r = big ? 0.9 + rnd() * 0.8 : 0.3 + rnd() * 0.6;
      const a = (0.25 + rnd() * 0.75) * (1 - y / H * 0.8);
      g.fillStyle = rnd() < 0.2 ? `rgba(200,215,255,${a})` : `rgba(255,248,235,${a})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }

    // Moon
    const mx = W * 0.84, my = H * 0.13, mr = Math.max(12, 20 * U);
    const halo = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(255,240,210,0.16)');
    halo.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(mx, my, mr * 6, 0, TAU); g.fill();
    // Crescent: cut the shadow out on a scratch canvas so only the lit sliver lands on the sky.
    const mc = document.createElement('canvas'), ms = Math.ceil(mr * 2 + 4);
    mc.width = mc.height = ms;
    const m = mc.getContext('2d');
    m.fillStyle = '#f3ecdc';
    m.beginPath(); m.arc(ms / 2, ms / 2, mr, 0, TAU); m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath(); m.arc(ms / 2 + mr * 0.42, ms / 2 - mr * 0.2, mr * 0.92, 0, TAU); m.fill();
    g.drawImage(mc, mx - ms / 2, my - ms / 2);
  }

  function drawCity() {
    const g = cctx;
    g.clearRect(0, 0, W, H);
    // A landmark scene brings its own skyline, so the painted city is only drawn over the default sky.
    if (!settings.skyline || arOn || world.img) return;
    const rnd = mulberry(42);
    const maxH = Math.min(H * 0.24, 200 * U + 30);

    // Distant hills
    g.fillStyle = '#0b0c20';
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) {
      g.lineTo(x, H - maxH * (0.55 + 0.18 * Math.sin(x / (W * 0.18)) + 0.08 * Math.sin(x / 37)));
    }
    g.lineTo(W, H); g.closePath(); g.fill();

    // Far buildings
    g.fillStyle = '#080917';
    let x = -10;
    while (x < W + 10) {
      const w = (16 + rnd() * 40) * U, h = maxH * (0.4 + rnd() * 0.5);
      g.fillRect(x, H - h, w + 1, h);
      if (rnd() < 0.2) g.fillRect(x + w * 0.45, H - h - 14 * U, 2, 14 * U);
      x += w;
    }
    for (let i = 0; i < W / 6; i++) {
      g.fillStyle = `rgba(255,210,150,${0.08 + rnd() * 0.2})`;
      g.fillRect(rnd() * W, H - maxH * (0.1 + rnd() * 0.75), 1.5, 1.5);
    }

    // Near buildings with lit windows
    x = -6;
    while (x < W + 6) {
      const w = (28 + rnd() * 56) * U;
      const h = maxH * (0.15 + rnd() * 0.6) * (rnd() < 0.12 ? 1.4 : 1);
      g.fillStyle = '#03040b';
      g.fillRect(x, H - h, w + 1, h);
      if (rnd() < 0.3) {
        g.fillRect(x + w * 0.2, H - h - 6 * U, w * 0.35, 6 * U);
      }
      if (rnd() < 0.15) {
        g.fillRect(x + w * 0.5, H - h - 22 * U, 1.5, 22 * U);
        g.fillStyle = '#ff4d4d';
        g.fillRect(x + w * 0.5 - 1, H - h - 23 * U, 3, 3);
      }
      const ww = Math.max(2, 3 * U), wh = Math.max(2, 4 * U), gx = ww * 2.3, gy = wh * 2.1;
      for (let wy = H - h + gy; wy < H - wh * 2; wy += gy) {
        for (let wx = x + gx * 0.6; wx < x + w - ww - gx * 0.3; wx += gx) {
          if (rnd() < 0.2) {
            g.fillStyle = `rgba(255,${(185 + rnd() * 55) | 0},${(110 + rnd() * 70) | 0},${0.25 + rnd() * 0.55})`;
            g.fillRect(wx, wy, ww, wh);
          }
        }
      }
      x += w + (rnd() < 0.3 ? rnd() * 10 * U : 0);
    }

    const haze = g.createLinearGradient(0, H - maxH * 1.2, 0, H);
    haze.addColorStop(0, 'rgba(60,40,90,0)');
    haze.addColorStop(1, 'rgba(60,40,90,0.18)');
    g.fillStyle = haze;
    g.fillRect(0, H - maxH * 1.2, W, maxH * 1.2);
  }

  // ---------- Particles ----------
  const stars = [], sparks = [], starPool = [], sparkPool = [];
  const G = () => 110 * U; // star gravity (px/s²)

  function star(x, y, vx, vy, col, life, o) {
    if (stars.length >= Q().maxStars) return null;
    o = o || {};
    const p = starPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y;
    p.vx = vx; p.vy = vy;
    p.color = col; p.life = life; p.age = 0;
    p.w = o.w || Math.max(1, (o.size || 2.2) * U);
    p.k = o.drag || 1.5;
    p.grav = o.grav ?? 1;
    p.hold = o.hold || 0;
    p.glitter = o.glitter || 0;
    p.gcol = o.gcol || '#ffd98a';
    p.strobe = o.strobe || 0;
    p.color2 = o.color2 || null;
    p.change = o.change || 0;
    p.twinkle = !!o.twinkle;
    p.fade = o.fade || 0.35;
    p.onDeath = o.onDeath || null;
    p.L = o.L ?? curLayer;
    p.floorY = o.floorY || 0;
    stars.push(p);
    return p;
  }

  function spark(x, y, vx, vy, col, life) {
    if (sparks.length > Q().maxStars) return;
    const p = sparkPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y; p.vx = vx; p.vy = vy; p.color = col; p.life = life; p.age = 0; p.L = curLayer;
    sparks.push(p);
  }

  const cnt = (n) => Math.max(6, Math.round(n * Q().count));

  // Directions on a projected sphere (golden spiral) — gives a natural 3D shell look.
  function sphere(n, cb) {
    const off = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - z * z);
      const phi = i * 2.399963 + off;
      cb(Math.cos(phi) * r, Math.sin(phi) * r);
    }
  }

  // Launch stars towards exact offsets (drag makes them settle at the offset).
  function shape(x, y, pts, col, o) {
    const k = o.drag;
    for (const p of pts) {
      const c = typeof col === 'function' ? col(p) : col;
      star(x, y, p[0] * k, p[1] * k, c, o.life * rand(0.95, 1.05), o);
    }
  }
  const rotate = (pts, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  };

  function crackleBurst(x, y) {
    const n = 5 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = rand(60, 160) * U;
      spark(x, y, Math.cos(a) * v, Math.sin(a) * v, '#fff8e0', rand(0.08, 0.2));
    }
  }

  // ---------- Shell types ----------
  const R0 = () => 190 * U;
  const TYPES = {
    peony: {
      label: 'Peony', icon: '🌸',
      fn(x, y, sz, c1, c2) {
        const R = R0() * sz, k = 1.6;
        sphere(cnt(110 * sz), (dx, dy) => {
          const j = rand(0.93, 1.04);
          star(x, y, dx * R * k * j, dy * R * k * j, c1, rand(1.3, 1.7), { drag: k, size: 2.4 });
        });
        if (Math.random() < 0.45) sphere(cnt(40 * sz), (dx, dy) => star(x, y, dx * R * 0.5 * k, dy * R * 0.5 * k, c2, rand(1.1, 1.4), { drag: k, size: 2.2 }));
      },
    },
    chrysanthemum: {
      label: 'Chrysanth.', icon: '🌼',
      fn(x, y, sz, c1) {
        const R = R0() * sz, k = 1.5;
        sphere(cnt(120 * sz), (dx, dy) => {
          const j = rand(0.94, 1.03);
          star(x, y, dx * R * k * j, dy * R * k * j, c1, rand(1.5, 1.9), { drag: k, size: 2, glitter: 0.35, gcol: '#ffe2a0' });
        });
      },
    },
    willow: {
      label: 'Willow', icon: '🌿',
      fn(x, y, sz) {
        const R = R0() * sz * 0.95, k = 1.3;
        const col = palette === PALETTES.classic ? '#ffb54a' : color();
        sphere(cnt(90 * sz), (dx, dy) => {
          star(x, y, dx * R * k, dy * R * k, col, rand(3, 3.9), { drag: k, grav: 0.85, size: 1.8, glitter: 0.7, gcol: '#ffcf85', fade: 0.55 });
        });
      },
    },
    palm: {
      label: 'Palm', icon: '🌴',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 1.1, k = 1.25, n = Math.round(9 + sz * 4);
        const off = Math.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU + rand(-0.1, 0.1), j = rand(0.85, 1.05);
          star(x, y, Math.cos(a) * R * k * j, Math.sin(a) * R * k * j, c1, rand(2, 2.4), { drag: k, size: 4, glitter: 1.6, gcol: '#ffd27a', fade: 0.45 });
        }
        sphere(cnt(24), (dx, dy) => star(x, y, dx * 60 * U, dy * 60 * U, '#fff4e0', 0.5, { drag: 2, size: 2 }));
      },
    },
    ring: {
      label: 'Ring', icon: '⭕',
      fn(x, y, sz, c1, c2) {
        const R = R0() * sz * 0.95, k = 1.6;
        const squash = rand(0.3, 1), tilt = rand(0, TAU), n = cnt(64 * Math.sqrt(sz));
        const pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([Math.cos(a) * R, Math.sin(a) * R * squash]); }
        shape(x, y, rotate(pts, tilt), c1, { drag: k, life: 1.6, size: 2.5 });
        sphere(cnt(28), (dx, dy) => star(x, y, dx * R * 0.3 * k, dy * R * 0.3 * k, c2, 1.2, { drag: k, size: 2 }));
      },
    },
    crossette: {
      label: 'Crossette', icon: '✚',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 0.7, k = 1.2, n = cnt(20 * Math.sqrt(sz));
        const split = (p) => {
          const a = Math.random() * TAU;
          for (let i = 0; i < 4; i++) {
            const b = a + (i * Math.PI) / 2;
            star(p.x, p.y, Math.cos(b) * 120 * U, Math.sin(b) * 120 * U, p.color, rand(0.55, 0.75), { drag: 1.8, size: 2 });
          }
          Sound.pop(pan(p.x));
        };
        sphere(n, (dx, dy) => star(x, y, dx * R * k, dy * R * k, c1, rand(0.85, 1.05), { drag: k, size: 2.6, glitter: 0.25, onDeath: split }));
      },
    },
    crackle: {
      label: 'Crackle', icon: '⚡',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 0.9, k = 1.6;
        const col = palette === PALETTES.classic ? '#ffd36b' : c1;
        const die = (p) => { if (Math.random() < 0.6) crackleBurst(p.x, p.y); Sound.crackle(pan(p.x)); };
        sphere(cnt(75 * sz), (dx, dy) => {
          const j = rand(0.9, 1.05);
          star(x, y, dx * R * k * j, dy * R * k * j, col, rand(0.9, 1.35), { drag: k, size: 2, glitter: 0.2, onDeath: die });
        });
      },
    },
    strobe: {
      label: 'Strobe', icon: '💡',
      fn(x, y, sz, c1) {
        const R = R0() * sz, k = 1.8;
        const col = Math.random() < 0.5 ? '#fff4e0' : c1;
        sphere(cnt(70 * sz), (dx, dy) => {
          star(x, y, dx * R * k, dy * R * k, col, rand(1.9, 2.7), { drag: k, grav: 0.6, size: 2.6, strobe: rand(7, 13) });
        });
      },
    },
    horsetail: {
      label: 'Horsetail', icon: '🎐',
      fn(x, y, sz, c1) {
        const R = R0() * sz, n = cnt(45 * sz);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + rand(-1.1, 1.1), v = rand(0.35, 1) * R * 1.1;
          star(x, y, Math.cos(a) * v, Math.sin(a) * v, c1, rand(2.4, 3), { drag: 1.1, grav: 2.4, size: 2, glitter: 0.6, fade: 0.5 });
        }
      },
    },
    kamuro: {
      label: 'Kamuro', icon: '🌟',
      fn(x, y, sz) {
        const R = R0() * sz * 1.05, k = 1.4;
        sphere(cnt(120 * sz), (dx, dy) => {
          const j = rand(0.92, 1.04);
          star(x, y, dx * R * k * j, dy * R * k * j, Math.random() < 0.8 ? '#ffd89a' : '#fff6e6', rand(2.6, 3.3), { drag: k, grav: 0.7, size: 1.8, glitter: 1.1, gcol: '#ffe7b0', fade: 0.6 });
        });
      },
    },
    kaleido: {
      label: 'Kaleido', icon: '🌈',
      fn(x, y, sz, c1, c2) {
        const R = R0() * sz, k = 1.6;
        sphere(cnt(100 * sz), (dx, dy) => {
          const j = rand(0.93, 1.04), swap = Math.random() < 0.5;
          star(x, y, dx * R * k * j, dy * R * k * j, swap ? c1 : c2, rand(1.7, 2.1), { drag: k, size: 2.4, color2: swap ? c2 : c1, change: rand(0.45, 0.6), glitter: 0.15 });
        });
      },
    },
    heart: {
      label: 'Heart', icon: '💖',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 0.85, n = cnt(80 * Math.sqrt(sz));
        const col = palette === PALETTES.classic ? pick(['#ff4d6d', '#ff5fc1', '#ff3b6b']) : c1;
        const pts = [];
        for (let i = 0; i < n; i++) {
          const t = (i / n) * TAU;
          const hx = 16 * Math.sin(t) ** 3;
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          pts.push([(hx / 17) * R, (hy / 17) * R]);
        }
        shape(x, y, rotate(pts, rand(-0.25, 0.25)), col, { drag: 2.4, life: 2.3, size: 2.5, hold: 0.9, grav: 0.6 });
        sphere(cnt(20), (dx, dy) => star(x, y, dx * 50 * U, dy * 50 * U, '#fff4e0', 0.9, { drag: 2, size: 1.6, glitter: 0.4 }));
      },
    },
    star: {
      label: 'Star', icon: '⭐',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 0.9, per = Math.max(4, Math.round(9 * Q().count * Math.sqrt(sz)));
        const rot = -Math.PI / 2 + rand(-0.3, 0.3);
        const verts = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? R * 0.42 : R, a = rot + (i * Math.PI) / 5;
          verts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % 10];
          for (let j = 0; j < per; j++) { const t = j / per; pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); }
        }
        shape(x, y, pts, c1, { drag: 2.4, life: 2.2, size: 2.4, hold: 0.9, grav: 0.6 });
      },
    },
    smile: {
      label: 'Smile', icon: '😊',
      fn(x, y, sz) {
        const R = R0() * sz * 0.8, col = '#ffd36b', pts = [];
        const n = cnt(44);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
        for (const ex of [-0.33, 0.33]) for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; pts.push([ex * R + Math.cos(a) * R * 0.07, -0.25 * R + Math.sin(a) * R * 0.1]); }
        for (let i = 0; i <= 16; i++) { const a = 0.25 + (i / 16) * (Math.PI - 0.5); pts.push([Math.cos(a) * R * 0.52, 0.02 * R + Math.sin(a) * R * 0.45]); }
        shape(x, y, pts, col, { drag: 2.4, life: 2.3, size: 2.5, hold: 1, grav: 0.6 });
      },
    },
  };
  // Five-point star outline with `per` points along each edge.
  function starOutline(R, per, rot) {
    const verts = [], pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? R * 0.42 : R, a = rot + (i * Math.PI) / 5;
      verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = 0; i < 10; i++) {
      const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % 10];
      for (let j = 0; j < per; j++) { const t = j / per; pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); }
    }
    return pts;
  }
  Object.assign(TYPES, {
    butterfly: {
      label: 'Butterfly', icon: '🦋',
      fn(x, y, sz, c1, c2) {
        // Temple Fay's butterfly curve; upper and lower wings take the two shell colours.
        const R = R0() * sz * 0.29, n = cnt(170 * Math.sqrt(sz)), pts = [];
        for (let i = 0; i < n; i++) {
          const t = (i / n) * TAU, r = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.sin(t / 12) ** 5;
          pts.push([Math.sin(t) * r * R, -Math.cos(t) * r * R]);
        }
        shape(x, y, rotate(pts, rand(-0.2, 0.2)), (p) => (p[1] < 0 ? c1 : c2), { drag: 2.4, life: 2.4, size: 2.6, hold: 1, grav: 0.55 });
        for (let k = -5; k <= 5; k++) star(x, y, 0, k * R * 0.32 * 2.4, '#fff4e0', 2, { drag: 2.4, size: 1.8, hold: 1, grav: 0.55 });
      },
    },
    peacock: {
      label: 'Peacock', icon: '🦚',
      fn(x, y, sz) {
        // A fan of long teal and green feathers, each ending in a gold-and-blue "eye".
        const R = R0() * sz, n = Math.max(9, Math.round(17 * Q().count * Math.sqrt(sz)));
        const eye = (p) => {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            star(p.x, p.y, Math.cos(a) * 80 * U, Math.sin(a) * 80 * U, i % 2 ? '#ffd36b' : '#4a7dff', 0.9, { drag: 3, size: 3, grav: 0.3, L: p.L });
          }
          star(p.x, p.y, 0, 0, '#3fe0d0', 1, { drag: 1, size: 6, grav: 0, L: p.L });
        };
        for (let i = 0; i < n; i++) {
          const a = -Math.PI + 0.35 + (i / (n - 1)) * (Math.PI - 0.7), v = R * 3.2 * rand(0.92, 1.05);
          const col = ['#3ddc97', '#3fe0d0', '#4aa8ff', '#2fd27a'][i % 4];
          star(x, y, Math.cos(a) * v, Math.sin(a) * v, col, 1.6, { drag: 2.2, grav: 0.45, size: 3.6, glitter: 0.9, gcol: '#bff7e8', onDeath: eye });
          star(x, y, Math.cos(a) * v * 0.6, Math.sin(a) * v * 0.6, '#ffd36b', 1.1, { drag: 2.4, grav: 0.5, size: 1.6 });
        }
        sphere(cnt(16), (dx, dy) => star(x, y, dx * 40 * U, dy * 40 * U, '#2f5bd1', 1, { drag: 2, size: 2 }));
      },
    },
    wand: {
      label: 'Magic wand', icon: '🪄',
      fn(x, y, sz) {
        // A rainbow streak sweeping up from one side, finished with a twinkling star at the tip.
        const R = R0() * sz, dir = Math.random() < 0.5 ? -1 : 1, rainbow = PALETTES.rainbow, len = cnt(30);
        for (let i = 0; i < len; i++) {
          const t = i / (len - 1), col = rainbow[Math.min(rainbow.length - 1, (t * rainbow.length) | 0)];
          // Placed directly on the trail (not shot out from the centre), so the colours stay separate; the tail fades first.
          const ox = -dir * R * 1.7 * (1 - t), oy = R * 1.15 * (1 - t), drift = 60 * U;
          star(x + ox, y + oy, -dir * drift * 0.83, drift * 0.56, col, 0.8 + t * 1.4, { drag: 2.2, grav: 0.25, size: 5 + t * 3, glitter: 0.5, gcol: col });
        }
        const per = Math.max(3, Math.round(6 * Q().count * Math.sqrt(sz)));
        shape(x, y, starOutline(R * 0.52, per, -Math.PI / 2), '#ffd36b', { drag: 2.4, life: 2, size: 2.8, hold: 0.9, grav: 0.4, twinkle: true });
        sphere(cnt(14), (dx, dy) => star(x, y, dx * 30 * U, dy * 30 * U, '#fff4e0', 1.2, { drag: 2, size: 1.8, twinkle: true }));
      },
    },
  });
  const DOCK_ORDER = ['random', 'peony', 'chrysanthemum', 'willow', 'palm', 'ring', 'crossette', 'crackle', 'strobe', 'horsetail', 'kamuro', 'kaleido', 'heart', 'star', 'butterfly', 'peacock', 'wand', 'smile'];
  const WEIGHTS = { peony: 3, chrysanthemum: 3, willow: 2, palm: 2, ring: 2, crossette: 2, crackle: 2, strobe: 1.4, horsetail: 1.4, kamuro: 1.6, kaleido: 2, heart: 0.6, star: 0.6, butterfly: 0.5, peacock: 0.8, wand: 0.5, smile: 0.3 };
  // Dock artwork (assets/crackers/<name>.webp, .jpg fallback). Crackers without artwork keep their drawn icon.
  const CRACKER_ART = {
    flowerpot: 'flower-pot', anar: 'anar', fountain: 'fountain', chakri: 'ground-spinner', heli: 'chakra', rocket: 'rocket', rocketcombo: 'rocket-combo',
    mine: 'sky-shot', multishot: 'multi-color-shot', roman: 'roman-candle', shell: 'shell', cake: 'wedding-cake', finale: 'grand-finale', basket: 'flower-basket',
    bomb: 'bulb', firecracker: 'firecracker', laddi: 'ladi', sparkler: 'sparkler', lantern: 'sky-lantern',
    heart: 'heart', star: 'star', butterfly: 'butterfly', peacock: 'peacock', wand: 'magic-wand',
  };
  function randomType(romantic) {
    let total = 0;
    const w = { ...WEIGHTS };
    if (romantic) { w.heart = 2.2; w.smile = 0; }
    for (const k in w) total += w[k];
    let r = Math.random() * total;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'peony';
  }
  const resolveType = (t) => (!t || t === 'random' || !TYPES[t] ? randomType(mode === 'card') : t);

  // ---------- Text written in fireworks ----------
  const textCanvas = document.createElement('canvas');
  const tctx = textCanvas.getContext('2d', { willReadFrequently: true });
  function textPoints(text, maxW, maxH, target) {
    const font = (px) => `800 ${px}px Outfit, "Segoe UI", system-ui, sans-serif`;
    let fs = Math.max(14, maxH);
    tctx.font = font(fs);
    let w = tctx.measureText(text).width;
    if (w > maxW) { fs = Math.max(14, (fs * maxW) / w); tctx.font = font(fs); w = tctx.measureText(text).width; }
    const cw = Math.ceil(w + fs * 0.4), ch = Math.ceil(fs * 1.5);
    textCanvas.width = cw; textCanvas.height = ch;
    tctx.font = font(fs);
    tctx.textAlign = 'center'; tctx.textBaseline = 'middle'; tctx.fillStyle = '#fff';
    tctx.fillText(text, cw / 2, ch / 2);
    const data = tctx.getImageData(0, 0, cw, ch).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 128) filled++;
    const step = Math.max(1.6, Math.sqrt((filled * 4) / target));
    const pts = [];
    for (let y = step / 2; y < ch; y += step) {
      for (let x = step / 2; x < cw; x += step) {
        if (data[((y | 0) * cw + (x | 0)) * 4 + 3] > 128) {
          pts.push([x - cw / 2 + rand(-0.25, 0.25) * step, y - ch / 2 + rand(-0.25, 0.25) * step]);
        }
      }
    }
    return { pts, step, width: cw };
  }

  function textBurst(x, y, s) {
    const target = Math.min(1500, 950 * Q().count);
    const { pts, step, width } = textPoints(s.text, W * 0.9, s.textH, target);
    const k = 3.2, hold = s.hold || 2.8;
    const cols = palette;
    const w = clamp(step * 0.6, 1.3, 3.4);
    for (const p of pts) {
      const idx = clamp(Math.floor(((p[0] / width) + 0.5) * cols.length), 0, cols.length - 1);
      star(x, y, p[0] * k, p[1] * k, cols[idx], hold + rand(1.1, 1.7), { drag: k, grav: 0.9, hold, w, twinkle: true, glitter: 0.015, gcol: cols[idx] });
    }
    sphere(cnt(40), (dx, dy) => star(x, y, dx * 260 * U, dy * 260 * U, '#ffe2a0', rand(1, 1.5), { drag: 1.4, size: 1.6, glitter: 0.4 }));
  }

  // ---------- Recipient photo revealed inside a ring of fireworks ----------
  let portrait = null;
  function photoBurst(x, y, s) {
    const r = s.r, hold = s.hold || 3.4, n = cnt(80), pts = [];
    portrait = { img: s.img, x, y, r, t0: gameTime, dur: hold + 1 };
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28]); }
    shape(x, y, pts, (p) => palette[Math.floor(((Math.atan2(p[1], p[0]) + Math.PI) / TAU) * palette.length) % palette.length],
      { drag: 2.6, life: hold + 1.4, hold, grav: 0.8, size: 2.4, twinkle: true });
    const R = r * 2.4, k = 1.5;
    sphere(cnt(70), (dx, dy) => star(x, y, dx * R * k, dy * R * k, color(), rand(1.3, 1.7), { drag: k, size: 2, glitter: 0.3 }));
  }
  function drawPortrait() {
    const p = portrait, t = gameTime - p.t0;
    if (t > p.dur || !p.img.complete || !p.img.naturalWidth) { if (t > p.dur) portrait = null; return; }
    const a = clamp(Math.min(t / 0.7, (p.dur - t) / 0.9), 0, 1);
    const r = p.r * (0.88 + 0.12 * Math.min(1, t / 0.7));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.7;
    const glow = ctx.createRadialGradient(p.x, p.y, r * 0.8, p.x, p.y, r * 1.7);
    glow.addColorStop(0, 'rgba(255,210,140,0.5)');
    glow.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.7, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.save(); ctx.clip();
    ctx.drawImage(p.img, p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(2, 3 * U);
    ctx.strokeStyle = '#ffd27a';
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Shells (the rising comets) ----------
  const shells = [];
  const pan = (x) => (x / W) * 2 - 1;

  function launchShell(o = {}) {
    const sz = o.size ?? sizeScale();
    const tx = clamp(o.x ?? rand(W * 0.12, W * 0.88), 16, W - 16);
    let ty = clamp(o.y ?? rand(H * 0.1, H * 0.42), H * 0.05, H * 0.78);
    if (world.rect && world.cfg.sacred && o.type !== 'text' && o.type !== 'photo') ty = worldSkyY(tx, ty);
    const sx = o.sx ?? (o.straight ? tx : clamp(tx + rand(-50, 50) * U, 0, W));
    const sy = o.sy ?? H + 8;
    const g = 900 * U;
    const vy = -Math.sqrt(2 * g * (sy - ty));
    const t = -vy / g;
    shells.push({
      x: sx, y: sy, px: sx, py: sy, vx: (tx - sx) / t, vy, g, age: 0,
      type: o.type, size: sz, c1: o.c1, c2: o.c2, text: o.text, textH: o.textH, hold: o.hold, user: !!o.user,
      img: o.img, r: o.r, L: o.L || 0,
    });
    Sound.lift(pan(sx), t, o.whistle);
  }

  function burstShell(s) {
    const [c1, c2raw] = [s.c1 || color(), s.c2 || color()];
    let c2 = c2raw;
    if (c2 === c1 && palette.length > 1) c2 = palette[(palette.indexOf(c1) + 1) % palette.length];
    const special = s.type === 'text' || s.type === 'photo';
    flash(s.x, s.y, c1, special ? 1.4 : s.size);
    if (s.type === 'text') textBurst(s.x, s.y, s);
    else if (s.type === 'photo') photoBurst(s.x, s.y, s);
    else TYPES[resolveType(s.type)].fn(s.x, s.y, s.size, c1, c2, s);
    addLight(c1, special ? 1.5 : s.size);
    Sound.burst(special ? 1.3 : s.size, pan(s.x));
    onBurst(s);
  }

  function flash(x, y, c, sz, cx = ctx) {
    const r = 80 * U * sz;
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.18, rgba(c, 0.4));
    g.addColorStop(1, rgba(c, 0));
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 1;
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
  }

  // ---------- Sky light ----------
  let gR = 255, gG = 200, gB = 150, gI = 0, lastGlowA = -1;
  function addLight(c, sz) {
    const [r, g, b] = rgb(c), i = 0.9 * sz, tot = gI + i;
    gR = (gR * gI + r * i) / tot; gG = (gG * gI + g * i) / tot; gB = (gB * gI + b * i) / tot;
    gI = Math.min(3.2, tot);
  }
  function renderGlow(dt) {
    gI *= Math.exp(-2.4 * dt);
    const a = Math.min(0.5, gI * 0.17) * SKY_LIGHT[settings.skyLight];
    if (Math.abs(a - lastGlowA) < 0.004) return;
    lastGlowA = a;
    const r = gR | 0, g = gG | 0, b = gB | 0;
    skyGlow.style.background = a < 0.005 ? 'none'
      : `radial-gradient(130% 90% at 50% 30%, rgba(${r},${g},${b},${a}), rgba(${r},${g},${b},${a * 0.3}) 70%, rgba(${r},${g},${b},${a * 0.15}))`;
  }
  const glowAlpha = () => Math.max(0, lastGlowA);

  // ---------- Sound (synthesised with Web Audio) ----------
  const Sound = {
    ctx: null, out: null, comp: null, noise: null, recDest: null,
    lastBurst: 0, lastCrackle: 0, lastPop: 0, lastLift: 0,
    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); } catch (e) { return false; }
      const c = this.ctx;
      this.out = c.createGain();
      this.out.gain.value = settings.sound ? settings.volume : 0;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 6;
      this.out.connect(this.comp); this.comp.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      return true;
    },
    resume() { if (this.init() && this.ctx.state === 'suspended') this.ctx.resume(); },
    apply() { if (this.ctx) this.out.gain.setTargetAtTime(settings.sound ? settings.volume : 0, this.ctx.currentTime, 0.05); },
    ready() { return this.ctx && settings.sound && this.ctx.state === 'running' && !paused; },
    dest(p) {
      const c = this.ctx;
      if (!c.createStereoPanner) return this.out;
      const n = c.createStereoPanner();
      n.pan.value = clamp(p, -1, 1) * 0.75;
      n.connect(this.out);
      return n;
    },
    noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },
    burst(size, p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime + 0.01;
      if (t - this.lastBurst < 0.06) return;
      this.lastBurst = t;
      const out = this.dest(p), vol = clamp(0.3 + size * 0.45, 0.3, 1.1);
      const n = this.noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1600 + size * 700, t);
      lp.frequency.exponentialRampToValueAtTime(160, t + 1.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.3 + size * 0.5);
      n.connect(lp); lp.connect(g); g.connect(out);
      n.start(t, Math.random() * 1.5); n.stop(t + 2.3);
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(100, t);
      o.frequency.exponentialRampToValueAtTime(36, t + 0.4);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(og); og.connect(out);
      o.start(t); o.stop(t + 0.7);
    },
    lift(p, dur, whistle) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      if (t - this.lastLift < 0.08) return;
      this.lastLift = t;
      const out = this.dest(p);
      const n = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(1400, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(out);
      n.start(t, Math.random()); n.stop(t + dur + 0.05);
      if (whistle || Math.random() < 0.25) {
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(rand(1400, 1800), t);
        o.frequency.exponentialRampToValueAtTime(rand(2400, 3000), t + dur);
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.035, t + 0.15);
        og.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(og); og.connect(out);
        o.start(t); o.stop(t + dur + 0.05);
      }
    },
    crackle(p) {
      if (!this.ready()) return;
      const c = this.ctx, t0 = c.currentTime;
      if (t0 - this.lastCrackle < 0.12) return;
      this.lastCrackle = t0;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      hp.connect(this.dest(p));
      for (let i = 0; i < 12; i++) {
        const t = t0 + 0.02 + Math.random() * 0.4;
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = this.noise;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(rand(0.12, 0.35), t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, t + rand(0.02, 0.05));
        s.connect(g); g.connect(hp);
        s.start(t, Math.random() * 1.8, 0.06);
      }
    },
    // Continuous hiss for fountains, spinners and smoke; optional wobble (spinner) and whistle.
    hiss(dur, freq, vol, p, o = {}) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime, out = this.dest(p);
      const n = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = o.q || 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.3);
      g.gain.setValueAtTime(vol, t + Math.max(0.31, dur - 1));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(out);
      n.start(t, Math.random()); n.stop(t + dur + 0.05);
      if (o.wobble) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = o.wobble; lg.gain.value = freq * 0.35;
        l.connect(lg); lg.connect(bp.frequency); l.start(t); l.stop(t + dur);
      }
      if (o.whistle) {
        const w = c.createOscillator(), wg = c.createGain(), v = c.createOscillator(), vg = c.createGain();
        w.frequency.setValueAtTime(o.whistle, t);
        w.frequency.linearRampToValueAtTime(o.whistle * 1.3, t + dur);
        v.frequency.value = 8; vg.gain.value = 70;
        v.connect(vg); vg.connect(w.frequency);
        wg.gain.setValueAtTime(0.0001, t);
        wg.gain.exponentialRampToValueAtTime(0.03, t + 0.4);
        wg.gain.setValueAtTime(0.03, t + Math.max(0.41, dur - 0.6));
        wg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        w.connect(wg); wg.connect(out);
        w.start(t); v.start(t); w.stop(t + dur); v.stop(t + dur);
      }
    },
    tick(p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(bp); bp.connect(g); g.connect(this.dest(p)); n.start(t, Math.random() * 1.8, 0.06);
    },
    thump(p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime, out = this.dest(p);
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.55, t + 0.006);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.3);
      const n = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(lp); lp.connect(g); g.connect(out); n.start(t, Math.random() * 1.8, 0.2);
    },
    snap(p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      if (t - (this.lastSnap || 0) < 0.03) return;
      this.lastSnap = t;
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = rand(1800, 3200); bp.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rand(0.35, 0.7), t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(bp); bp.connect(g); g.connect(this.dest(p)); n.start(t, Math.random() * 1.8, 0.08);
    },
    bang(p) {
      if (!this.ready()) return;
      this.lastBurst = 0;
      this.burst(2.4, p);
      const c = this.ctx, t = c.currentTime + 0.28;
      const n = this.noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      n.connect(lp); lp.connect(g); g.connect(this.dest(-p)); n.start(t, Math.random()); n.stop(t + 1.5);
    },
    sparklerStart() {
      if (!this.ready() || this.spk) return;
      const c = this.ctx, t = c.currentTime;
      const n = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.type = 'square'; lfo.frequency.value = 19; lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
      n.connect(bp); bp.connect(g); g.connect(this.out); n.start(t, Math.random());
      this.spk = { n, g, lfo };
    },
    sparklerStop() {
      if (!this.spk || !this.ctx) return;
      const { n, g, lfo } = this.spk, t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.05);
      n.stop(t + 0.3); lfo.stop(t + 0.3);
      this.spk = null;
    },
    pop(p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      if (t - this.lastPop < 0.1) return;
      this.lastPop = t;
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise;
      bp.type = 'bandpass'; bp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      s.connect(bp); bp.connect(g); g.connect(this.dest(p));
      s.start(t, Math.random() * 1.8, 0.16);
    },
  };

  // ---------- Game state ----------
  let mode = 'intro'; // intro | play | envelope | card
  let paused = false, gameTime = 0;
  let meter = 0, level = 1, bursts = 0, combo = 0, lastUserBurst = -9, finaleUntil = 0;
  let autoTimer = 0.6, cardAuto = false, cardAutoCount = 0;
  const timers = [];
  const after = (sec, fn, tag) => timers.push({ t: gameTime + sec, fn, tag });
  const clearTimers = (tag) => { for (let i = timers.length - 1; i >= 0; i--) if (timers[i].tag === tag) timers.splice(i, 1); };

  const el = {
    meterFill: $('#meterFill'), meter: $('#meter'), level: $('#level'), bursts: $('#burstCount'),
    combo: $('#combo'), toast: $('#toast'), hint: $('#hint'),
  };

  const COMBOS = [[20, 'Legendary!'], [12, 'Sky on fire!'], [8, 'Spectacular!'], [5, 'Brilliant!'], [3, 'Triple!'], [2, 'Double!']];
  function onBurst(s) {
    bursts++;
    el.bursts.textContent = bursts;
    if (mode !== 'play') return;
    meter += (s.user ? 7 : 2) * s.size / (1 + (level - 1) * 0.2);
    if (s.user) {
      combo = gameTime - lastUserBurst < 1.3 ? combo + 1 : 1;
      lastUserBurst = gameTime;
      const hit = COMBOS.find(([n]) => combo === n);
      if (hit) showCombo(hit[1], `${combo}× combo`);
      if (combo >= 8) achieve('combo');
    }
    if (meter >= 100 && gameTime > finaleUntil) levelUp();
  }

  function showCombo(text, sub) {
    el.combo.innerHTML = '';
    el.combo.append(text);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; el.combo.append(s); }
    el.combo.classList.remove('pop');
    void el.combo.offsetWidth;
    el.combo.classList.add('pop');
  }

  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function levelUp() {
    level++;
    meter = 0;
    el.level.textContent = `Lv ${level}`;
    if (level >= 3) achieve('level3');
    showCombo('Sky ablaze!', `level ${level} · grand finale`);
    grandFinale();
  }

  function grandFinale() {
    const n = 30;
    finaleUntil = gameTime + 6.5;
    $('#btnFinale').disabled = true;
    const pool = ['peony', 'chrysanthemum', 'crackle', 'strobe', 'kamuro', 'ring', 'kaleido', 'crossette', 'willow'];
    for (let i = 0; i < n; i++) {
      after(i * 0.15 + rand(0, 0.12), () => launchShell({ x: rand(W * 0.08, W * 0.92), y: rand(H * 0.08, H * 0.45), type: pick(pool), size: rand(0.8, 1.3) }), 'finale');
    }
    after(n * 0.15 + 0.4, () => {
      for (const fx of [0.25, 0.5, 0.75]) launchShell({ x: W * fx, y: H * 0.2, type: pick(['kamuro', 'willow']), size: 1.5 });
    }, 'finale');
    after(6.5, () => { $('#btnFinale').disabled = false; }, 'finale');
  }

  // ---------- Auto launch ----------
  function autoOn() {
    if (mode === 'play') return settings.auto && playMode !== 'spark';
    if (mode === 'card') return cardAuto;
    return true; // intro / envelope ambience
  }
  function runSequence() {
    const r = Math.random();
    const type = mode === 'play' ? settings.shell : 'random';
    if (mode === 'card' && cardAuto && currentCard && ++cardAutoCount % 6 === 0) {
      if (currentCard.img && (cardAutoCount / 6) % 2 === 1) launchPhoto(currentCard.img, H * 0.3, 3.2);
      else launchText(currentCard.t, H * 0.3, 0.16, 3.2);
      return;
    }
    if (r < 0.45) {
      launchShell({ type });
    } else if (r < 0.72) {
      const t = resolveType(type), a = rand(0.15, 0.38), y = rand(H * 0.15, H * 0.38), c1 = color(), c2 = color();
      launchShell({ x: W * a, y, type: t, c1, c2 });
      launchShell({ x: W * (1 - a), y, type: t, c1, c2 });
    } else if (r < 0.9) {
      const t = resolveType(type), n = W < 600 ? 3 : 4 + ((Math.random() * 2) | 0), y = rand(H * 0.15, H * 0.35), c1 = color();
      for (let i = 0; i < n; i++) after(i * 0.13, () => launchShell({ x: W * ((i + 1) / (n + 1)), y: y + rand(-15, 15) * U, type: t, c1, size: sizeScale() * 0.8 }));
    } else {
      const n = 4 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) after(i * rand(0.08, 0.2), () => launchShell({ type, size: sizeScale() * rand(0.6, 0.85) }));
    }
  }
  function updateAuto(dt) {
    if (!autoOn()) return;
    autoTimer -= dt;
    if (autoTimer <= 0) {
      runSequence();
      const busy = mode === 'play' && settings.finale;
      autoTimer = busy ? rand(0.3, 0.8) : mode === 'intro' || mode === 'envelope' ? rand(1.4, 2.6) : rand(1.1, 2.4);
    }
  }

  // ---------- Update & render ----------
  let pointer = null, holdTimer = 0, idleClear = 0;

  function update(dt) {
    gameTime += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].t <= gameTime) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    }
    updateAuto(dt);

    updateGround(dt);
    updateSparkler(dt);
    if (pointer && pointer.kind === 'sky') {
      holdTimer -= dt;
      if (holdTimer <= 0) { userLaunch(pointer.x + rand(-30, 30) * U, pointer.y + rand(-20, 20) * U); holdTimer = 0.22; }
    }

    if (mode === 'play') {
      meter = Math.max(0, meter - dt * (4 + level * 2.5));
      el.meterFill.style.width = `${Math.min(100, meter)}%`;
      el.meter.classList.toggle('hot', meter > 70);
    }

    const g = G();
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.age += dt; s.px = s.x; s.py = s.y;
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      curLayer = s.L;
      if (Math.random() < 0.85) spark(s.x, s.y, rand(-25, 25) * U, rand(10, 70) * U, '#ffc987', rand(0.25, 0.55));
      curLayer = 0;
      if (s.vy >= -25 * U) { shells.splice(i, 1); burstShell(s); }
    }

    const glit = Q().glitter;
    for (let i = stars.length - 1; i >= 0; i--) {
      const p = stars[i];
      p.age += dt;
      if (p.age >= p.life) {
        stars[i] = stars[stars.length - 1]; stars.pop();
        starPool.push(p);
        if (p.onDeath) p.onDeath(p);
        continue;
      }
      const e = Math.exp(-p.k * dt);
      p.vx *= e; p.vy *= e;
      if (p.age > p.hold) p.vy += g * p.grav * dt;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floorY && p.y > p.floorY) { p.y = p.floorY; p.vy *= -0.3; p.vx *= 0.75; }
      if (p.glitter && Math.random() < p.glitter * glit * dt * 30) {
        curLayer = p.L;
        spark(p.x, p.y, p.vx * 0.15 + rand(-15, 15) * U, p.vy * 0.15 + rand(-5, 25) * U, p.gcol, rand(0.3, 0.8));
        curLayer = 0;
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); sparkPool.push(p); continue; }
      const e = Math.exp(-3 * dt);
      p.vx *= e; p.vy = p.vy * e + g * 0.7 * dt;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    updateSmoke(dt);
    updateConfetti(dt);
  }

  function fade(dt) {
    const base = settings.longExposure ? 0.045 : 0.2;
    const a = 1 - Math.pow(1 - base, dt * 60);
    for (const g of [ctx, gctx]) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = 1;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(0, 0, W, H);
    }
    // Low-alpha fades can leave faint residue; wipe once the sky has been empty for a moment.
    if (!stars.length && !sparks.length && !shells.length && !smokes.length && !groundItems.length && !confettis.length && !pen) {
      idleClear += dt;
      if (idleClear > 1.5) { ctx.clearRect(0, 0, W, H); gctx.clearRect(0, 0, W, H); idleClear = 0; }
    } else idleClear = 0;
  }

  function draw() {
    if (portrait) drawPortrait();
    drawSmoke();
    drawGroundItems();
    ctx.globalCompositeOperation = gctx.globalCompositeOperation = 'lighter';

    // Shells
    for (const s of shells) {
      const g = s.L ? gctx : ctx;
      g.globalAlpha = 1;
      g.strokeStyle = '#ffe2b0';
      g.lineWidth = Math.max(1.5, 2.6 * U);
      g.beginPath(); g.moveTo(s.px, s.py); g.lineTo(s.x, s.y); g.stroke();
    }

    // Stars
    for (const p of stars) {
      const left = p.life - p.age;
      let a = Math.min(1, left / (p.life * p.fade));
      if (p.strobe && p.age > 0.35 && ((p.age * p.strobe) | 0) % 2) continue;
      if (p.twinkle) a *= 0.6 + Math.random() * 0.4;
      const g = p.L ? gctx : ctx;
      g.globalAlpha = a;
      g.strokeStyle = p.color2 && p.age > p.life * p.change ? p.color2 : p.color;
      g.lineWidth = p.w;
      g.beginPath();
      g.moveTo(p.px, p.py);
      g.lineTo(p.x + 0.01, p.y);
      g.stroke();
    }

    // Sparks
    ctx.lineWidth = gctx.lineWidth = Math.max(1, 1.2 * U);
    for (const p of sparks) {
      const g = p.L ? gctx : ctx;
      g.globalAlpha = 1 - p.age / p.life;
      g.strokeStyle = p.color;
      g.beginPath();
      g.moveTo(p.px, p.py);
      g.lineTo(p.x + 0.01, p.y);
      g.stroke();
    }
    drawPenHead();
    ctx.globalAlpha = gctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      fade(dt);
      update(dt);
      draw();
      renderGlow(dt);
      applyShake(dt);
    }
    if (rec) recordFrame(now);
  }

  // ---------- Input ----------
  const stage = $('#stage');
  function userLaunch(x, y) {
    launchShell({ x, y: clamp(y, H * 0.08, H * 0.72), type: mode === 'card' ? 'random' : settings.shell, user: true });
  }
  stage.addEventListener('pointerdown', (e) => {
    Sound.resume();
    if (paused || pointer) return;
    const kind = mode === 'play' ? playMode : 'sky';
    el.hint.classList.add('gone');
    pointer = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId, kind };
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (kind === 'ground') {
      // Tap a waiting cracker to light it, drag it to move it, or tap the street to place a new one.
      const hit = hitItem(e.clientX, e.clientY);
      pointer.kind = 'item';
      pointer.item = hit || placeItem(settings.item, e.clientX, e.clientY);
      pointer.fresh = !hit;
      pointer.oy = pointer.item.y - e.clientY;
      return;
    }
    if (kind === 'spark') { sparkDown(e.clientX, e.clientY); return; }
    userLaunch(pointer.x, pointer.y);
    holdTimer = 0.3;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    if (pointer.kind === 'spark') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) sparkMove(ev.clientX, ev.clientY);
    } else if (pointer.kind === 'item') {
      if (!pointer.moved && Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy) > 8) pointer.moved = true;
      if (pointer.moved && !pointer.item.armed) moveItem(pointer.item, e.clientX, e.clientY + pointer.oy);
    }
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  const endPointer = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    if (pointer.kind === 'spark') sparkUp();
    else if (pointer.kind === 'item' && !pointer.moved && !pointer.fresh) armItem(pointer.item);
    pointer = null;
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  function typingTarget(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
  document.addEventListener('keydown', (e) => {
    if (typingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { closeDrawer(); closeCardModal(); return; }
    if (mode === 'intro' || mode === 'envelope') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); togglePause(); }
    else if (k === 's') toggleSound();
    else if (k === 'h') toggleUi();
    else if (k === 'f' && mode === 'play') triggerFinale();
    else if (/^[1-9]$/.test(k) && mode === 'play' && playMode === 'sky') setShell(DOCK_ORDER[+k - 1]);
    else if (k === '0' && mode === 'play') setShell(DOCK_ORDER[9]);
  });

  // ---------- Controls ----------
  function togglePause(force) {
    paused = typeof force === 'boolean' ? force : !paused;
    if (pen) penUp();
    pointer = null;
    document.body.classList.toggle('paused', paused);
    $('#btnPause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }
  function toggleSound() {
    settings.sound = !settings.sound;
    Sound.resume(); Sound.apply(); saveSettings(); syncSettingsUi();
  }
  function toggleUi() {
    document.body.classList.toggle('ui-hidden');
    drawFloor();
    if (world.img) drawSky(); // the landmark moves down into the space the controls used
    if (document.body.classList.contains('ui-hidden')) toast('Controls hidden. Press H or tap “Show controls”.');
  }
  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const r = d.documentElement;
      (r.requestFullscreen || r.webkitRequestFullscreen || (() => toast('Fullscreen is not available here'))).call(r);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    }
  }
  function triggerFinale() {
    if (gameTime < finaleUntil) return;
    Sound.resume();
    showCombo('Grand finale!');
    grandFinale();
  }

  $('#btnPause').addEventListener('click', () => togglePause());
  $('#btnSound').addEventListener('click', toggleSound);
  $('#btnFull').addEventListener('click', toggleFullscreen);
  $('#btnFinale').addEventListener('click', triggerFinale);
  $('#btnShowUi').addEventListener('click', toggleUi);
  $('#btnPhoto').addEventListener('click', savePhoto);
  $('#btnRec').addEventListener('click', () => toggleRecording());
  $('#recBadge').addEventListener('click', () => toggleRecording());

  // Dock
  function shellIcon(type) {
    const c = document.createElement('canvas'), d = 2;
    c.width = c.height = 40 * d;
    const g = c.getContext('2d');
    g.scale(d, d);
    g.clearRect(0, 0, 40, 40);

    const drawSpark = (x, y, r, col, a = 1) => {
      const glow = g.createRadialGradient(x, y, 0, x, y, r * 1.45);
      glow.addColorStop(0, `rgba(255,255,245,${0.9 * a})`);
      glow.addColorStop(0.22, rgba(col, 0.75 * a));
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y, r * 1.45, 0, TAU); g.fill();
      g.fillStyle = '#fff9df';
      g.beginPath(); g.arc(x, y, Math.max(0.8, r * 0.2), 0, TAU); g.fill();
    };
    const streak = (x1, y1, x2, y2, col, w = 1.2, a = 0.85) => {
      const lg = g.createLinearGradient(x1, y1, x2, y2);
      lg.addColorStop(0, rgba(col, 0));
      lg.addColorStop(0.5, rgba(col, a));
      lg.addColorStop(1, 'rgba(255,255,245,0)');
      g.strokeStyle = lg;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    };
    const burst = (cx, cy, r, spokes, colors, o = {}) => {
      const rot = o.rot || 0;
      for (let i = 0; i < spokes; i++) {
        const ang = rot + (i / spokes) * TAU;
        const len = r * (0.74 + 0.28 * ((i * 17) % 9) / 8);
        const col = colors[i % colors.length];
        streak(cx + Math.cos(ang) * r * 0.12, cy + Math.sin(ang) * r * 0.12, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len, col, o.w || 1.15, 0.9);
        drawSpark(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len, 1.8, col, 0.75);
      }
      drawSpark(cx, cy, 2.8, colors[0], 0.85);
    };
    const comet = (x1, y1, x2, y2, col) => {
      streak(x1, y1, x2, y2, col, 1.5, 0.95);
      drawSpark(x2, y2, 2.4, col, 0.9);
    };

    const map = {
      random() {
        burst(16, 17, 10, 10, ['#ffd36b', '#ff5fa2', '#5ff0ff'], { rot: 0.2 });
        burst(27, 25, 7, 8, ['#fff4e0', '#4df29a', '#b56bff'], { rot: 0.5, w: 0.9 });
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.font = '700 11px Outfit, system-ui';
        g.textAlign = 'center';
        g.fillText('?', 20, 23);
      },
      peony() { burst(20, 20, 14, 18, ['#ff5fa2', '#ffd36b', '#fff4e0']); },
      chrysanthemum() { burst(20, 20, 15, 22, ['#ffd36b', '#fff4e0', '#ff8a2b'], { rot: 0.1 }); burst(20, 20, 9, 14, ['#fff4e0', '#ffd36b'], { w: 0.85 }); },
      willow() { for (let i = 0; i < 13; i++) { const a = -Math.PI + i / 12 * Math.PI; streak(20, 14, 20 + Math.cos(a) * 15, 16 + Math.sin(a) * 7 + 12, '#ffd36b', 1.3, 0.9); } drawSpark(20, 14, 2.3, '#fff4e0'); },
      palm() { comet(20, 34, 20, 12, '#ffd36b'); burst(20, 13, 12, 8, ['#ffd36b', '#ff8a2b', '#fff4e0'], { rot: -0.25, w: 1.25 }); },
      ring() { for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; drawSpark(20 + Math.cos(a) * 12, 20 + Math.sin(a) * 12, 1.9, i % 2 ? '#ffd36b' : '#5ff0ff', 0.9); } drawSpark(20, 20, 1.7, '#fff4e0', 0.7); },
      crossette() { for (const [x, y, col] of [[14, 15, '#ff5fa2'], [26, 15, '#5ff0ff'], [14, 26, '#ffd36b'], [26, 26, '#4df29a']]) { streak(x - 4, y - 4, x + 4, y + 4, col, 1.4); streak(x + 4, y - 4, x - 4, y + 4, col, 1.4); drawSpark(x, y, 1.8, col); } },
      crackle() { burst(20, 20, 13, 14, ['#fff4e0', '#ffd36b'], { w: 0.95 }); for (let i = 0; i < 12; i++) drawSpark(8 + ((i * 7) % 25), 8 + ((i * 11) % 25), 1.1, '#fff4e0', 0.7); },
      strobe() { for (let i = 0; i < 7; i++) drawSpark(9 + ((i * 6) % 24), 9 + ((i * 10) % 23), i % 2 ? 2.6 : 1.5, i % 2 ? '#fff4e0' : '#5ff0ff', 1); },
      horsetail() { for (let i = 0; i < 11; i++) { const x = 8 + i * 2.4; streak(x, 10, x + Math.sin(i) * 3, 30, i % 2 ? '#ffd36b' : '#fff4e0', 1.15); drawSpark(x + Math.sin(i) * 3, 30, 1.4, '#ffd36b'); } },
      kamuro() { burst(20, 16, 11, 16, ['#ffd36b', '#fff4e0'], { w: 1 }); for (let i = 0; i < 10; i++) streak(20 + Math.cos(i) * 6, 20, 16 + i, 33, '#ffd36b', 0.8, 0.55); },
      kaleido() { burst(20, 20, 13, 16, ['#ff4d6d', '#ffe66d', '#4dff9a', '#4dc3ff', '#b06bff'], { rot: 0.35 }); },
      heart() { const pts = [[20,31],[12,22],[10,15],[15,11],[20,15],[25,11],[30,15],[28,22]]; for (let i = 0; i < pts.length; i++) streak(pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], '#ff5fa2', 1.5); pts.forEach(([x, y]) => drawSpark(x, y, 1.8, '#ff5fa2')); },
      star() { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; streak(20, 20, 20 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, '#ffd36b', 1.6); } drawSpark(20, 20, 2.3, '#fff4e0'); },
      smile() { this.ring(); drawSpark(16, 17, 1.7, '#fff4e0'); drawSpark(24, 17, 1.7, '#fff4e0'); streak(14, 24, 26, 24, '#ffd36b', 1.3); },
    };
    (map[type] || map.random).call(map);
    return c.toDataURL();
  }

  // Dock icon: the cracker's artwork when it has one (WebP, then JPEG), otherwise its drawn icon.
  function setChipArt(chip, id, drawn) {
    const img = chip.querySelector('img'), art = CRACKER_ART[id];
    if (!art) { img.src = drawn(); return; }
    chip.classList.add('art');
    img.decoding = 'async';
    img.addEventListener('error', () => {
      if (img.src.endsWith('.webp')) img.src = `assets/crackers/${art}.jpg`;
      else { chip.classList.remove('art'); img.src = drawn(); }
    });
    img.src = `assets/crackers/${art}.webp`;
  }
  const shellList = $('#shellList');
  for (const id of DOCK_ORDER) {
    const b = document.createElement('button');
    b.className = 'shell-chip';
    b.dataset.shell = id;
    const t = TYPES[id];
    b.innerHTML = '<span class="ico"><img alt=""></span><span></span>';
    setChipArt(b, id, () => shellIcon(id));
    b.lastChild.textContent = id === 'random' ? 'Random' : t.label;
    b.title = id === 'random' ? 'Random shells' : `${t.label} shell`;
    b.addEventListener('click', () => setShell(id));
    shellList.append(b);
  }
  function setShell(id) {
    settings.shell = id;
    saveSettings();
    syncSettingsUi();
    const chip = shellList.querySelector(`[data-shell="${id}"]`);
    if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }

  // ---------- Settings drawer ----------
  const drawer = $('#settings');
  const setShellSel = $('#setShell');
  for (const id of DOCK_ORDER) {
    const o = document.createElement('option');
    o.value = id; o.textContent = id === 'random' ? 'Random' : TYPES[id].label.replace('Chrysanth.', 'Chrysanthemum');
    setShellSel.append(o);
  }
  function themeChips(container, current, onPick) {
    container.innerHTML = '';
    for (const id in PALETTES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (id === current ? ' active' : '');
      const sw = document.createElement('span');
      sw.className = 'sw';
      for (const c of PALETTES[id].slice(0, 4)) { const i = document.createElement('i'); i.style.background = c; sw.append(i); }
      b.append(sw, THEME_LABELS[id]);
      b.addEventListener('click', () => onPick(id));
      container.append(b);
    }
  }
  function syncSettingsUi() {
    setShellSel.value = settings.shell;
    $('#setSize').value = settings.size;
    $('#sizeVal').textContent = ['XS', 'S', 'M', 'L', 'XL', 'XXL'][settings.size - 1];
    $('#setQuality').value = settings.quality;
    $('#setSkyLight').value = settings.skyLight;
    $('#setAuto').checked = settings.auto;
    $('#setFinale').checked = settings.finale;
    $('#setLong').checked = settings.longExposure;
    $('#setSkyline').checked = settings.skyline;
    $('#setSound').checked = settings.sound;
    $('#setVolume').value = settings.volume;
    document.body.classList.toggle('muted', !settings.sound);
    themeChips($('#setTheme'), settings.theme, (id) => {
      settings.theme = id;
      releaseWorldPreset(); // a manual colour choice always wins over a landmark preset
      if (mode !== 'card') palette = basePalette();
      saveSettings(); syncSettingsUi();
    });
    shellList.querySelectorAll('.shell-chip').forEach((c) => c.classList.toggle('active', c.dataset.shell === settings.shell));
  }
  const bind = (id, ev, fn) => $(id).addEventListener(ev, (e) => { fn(e.target); saveSettings(); syncSettingsUi(); });
  bind('#setShell', 'change', (t) => { settings.shell = t.value; });
  bind('#setSize', 'input', (t) => { settings.size = +t.value; });
  bind('#setQuality', 'change', (t) => { settings.quality = t.value; resize(); });
  bind('#setSkyLight', 'change', (t) => { settings.skyLight = t.value; lastGlowA = -1; });
  bind('#setAuto', 'change', (t) => { settings.auto = t.checked; });
  bind('#setFinale', 'change', (t) => { settings.finale = t.checked; autoTimer = Math.min(autoTimer, 0.3); });
  bind('#setLong', 'change', (t) => { settings.longExposure = t.checked; });
  bind('#setSkyline', 'change', (t) => { settings.skyline = t.checked; drawCity(); });
  bind('#setSound', 'change', (t) => { settings.sound = t.checked; Sound.resume(); Sound.apply(); });
  bind('#setVolume', 'input', (t) => { settings.volume = +t.value; Sound.apply(); });
  $('#setPhoto').addEventListener('click', () => { closeDrawer(); savePhoto(); });
  $('#setRec').addEventListener('click', () => { closeDrawer(); toggleRecording(); });
  $('#setFull').addEventListener('click', toggleFullscreen);
  $('#setHide').addEventListener('click', () => { closeDrawer(); toggleUi(); });
  $('#setReset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS);
    if (mode !== 'card') palette = basePalette();
    saveSettings(); resize(); Sound.apply(); syncSettingsUi();
    toast('Settings reset');
  });

  function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  $('#btnSettings').addEventListener('click', () => (drawer.classList.contains('open') ? closeDrawer() : openDrawer()));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.close === 'settings') closeDrawer(); else closeCardModal();
  }));
  stage.addEventListener('pointerdown', closeDrawer);

  // ---------- Photo & video ----------
  function composite(g, w, h) {
    if (arOn) drawCamera(g, w, h); else g.drawImage(skyC, 0, 0, w, h);
    const a = glowAlpha();
    if (a > 0) { g.fillStyle = `rgba(${gR | 0},${gG | 0},${gB | 0},${a * 0.6})`; g.globalCompositeOperation = 'screen'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
    g.drawImage(fxC, 0, 0, w, h);
    g.drawImage(cityC, 0, 0, w, h);
    g.drawImage(floorC, 0, 0, w, h);
    g.drawImage(itemsC, 0, 0, w, h);
    g.drawImage(paintC, 0, 0, w, h);
    g.drawImage(gfxC, 0, 0, w, h);
    drawGreeting(g, w / W, h / H);
  }

  // The greeting is HTML; mirror it onto the canvas so photos and videos include it.
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function wrapLines(g, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (g.measureText(test).width <= maxW || !line.trim()) {
          if (g.measureText(test).width > maxW) {
            for (const ch of word) { if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; } line += ch; }
          } else line = test;
        } else { out.push(line.trimEnd()); line = word.trimStart(); }
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  function drawTextEl(g, node) {
    const text = node.textContent;
    if (!text.trim()) return;
    const cs = getComputedStyle(node), r = node.getBoundingClientRect();
    const fs = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight) || fs * 1.3;
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    g.fillStyle = cs.color;
    g.textBaseline = 'middle';
    const right = cs.textAlign === 'right' || cs.textAlign === 'end';
    g.textAlign = right ? 'right' : 'left';
    wrapLines(g, text, r.width + 1).forEach((line, i) => g.fillText(line, right ? r.right : r.left, r.top + lh * (i + 0.5)));
  }
  function drawGreeting(g, sx, sy) {
    const box = $('#greeting');
    if (box.hidden) return;
    const cardEl = $('#gCard'), r = cardEl.getBoundingClientRect();
    g.save();
    g.scale(sx, sy);
    g.globalAlpha = parseFloat(getComputedStyle(box).opacity) || 1;
    const bgGrad = g.createLinearGradient(r.left, r.top, r.right, r.bottom);
    bgGrad.addColorStop(0, 'rgba(34,22,64,0.9)');
    bgGrad.addColorStop(1, 'rgba(14,12,34,0.93)');
    roundRect(g, r.left, r.top, r.width, r.height, 18);
    g.fillStyle = bgGrad; g.fill();
    g.strokeStyle = 'rgba(255,210,122,0.45)'; g.lineWidth = 1; g.stroke();
    g.font = '16px Outfit, sans-serif'; g.fillStyle = 'rgba(255,210,122,0.6)';
    g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('✦', r.right - 18, r.top + 12);
    const ph = $('#gPhoto');
    if (!ph.hidden && ph.complete && ph.naturalWidth) {
      const pr = ph.getBoundingClientRect(), cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2, rad = pr.width / 2;
      g.save();
      g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.clip();
      g.drawImage(ph, pr.left, pr.top, pr.width, pr.height);
      g.restore();
      g.beginPath(); g.arc(cx, cy, rad - 1, 0, TAU);
      g.strokeStyle = '#ffd27a'; g.lineWidth = 2; g.stroke();
    }
    cardEl.querySelectorAll('p').forEach((n) => drawTextEl(g, n));
    g.restore();
  }
  function download(blob, name) {
    // Inside the Android/iOS app the native shell saves or shares the file; WebViews ignore <a download>.
    if (window.LUTSNative && typeof window.LUTSNative.saveFile === 'function') { window.LUTSNative.saveFile(blob, name); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function savePhoto() {
    const c = document.createElement('canvas');
    c.width = fxC.width; c.height = fxC.height;
    composite(c.getContext('2d'), c.width, c.height);
    c.toBlob((b) => { if (b) { download(b, 'light-up-the-skies.png'); toast('Photo saved'); } }, 'image/png');
  }

  let rec = null;
  function toggleRecording() { rec ? stopRecording() : startRecording(); }
  function startRecording(msg) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('Video recording is not supported in this browser'); return; }
    // Phones get upscaled to ~720×1280; add ?hq to the URL for full-HD capture (used for promo footage).
    const recMax = /[?&]hq\b/.test(location.search) ? 1920 : 1280;
    const s = Math.min(2, recMax / Math.max(W, H));
    const rc = document.createElement('canvas');
    rc.width = Math.round(W * s) & ~1; rc.height = Math.round(H * s) & ~1;
    const stream = rc.captureStream(30);
    Sound.resume();
    if (Sound.ctx) {
      if (!Sound.recDest) { Sound.recDest = Sound.ctx.createMediaStreamDestination(); Sound.comp.connect(Sound.recDest); }
      Sound.recDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    // H.264 + AAC in MP4 first: it's the only combination WhatsApp, Instagram and iPhones all accept.
    const types = [
      'video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
    ];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: recMax > 1280 ? 16e6 : 6e6 } : undefined); } catch (e) { toast('Could not start recording'); return; }
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const type = mr.mimeType || mime || 'video/webm';
      const mp4 = type.includes('mp4');
      const name = `light-up-the-skies.${mp4 ? 'mp4' : 'webm'}`, blob = new Blob(chunks, { type });
      stream.getVideoTracks().forEach((t) => t.stop());
      let file = null;
      try { file = new File([blob], name, { type: type.split(';')[0] }); } catch (e) { /* old browser */ }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        offerShare(file, blob, name);
      } else {
        download(blob, name);
        toast(mp4 ? 'Video saved' : 'Video saved as WebM. For WhatsApp, record in Chrome, Edge or Safari to get MP4.', mp4 ? 2400 : 6000);
      }
    };
    mr.start(250);
    rec = { mr, rc, g: rc.getContext('2d'), start: performance.now() };
    document.body.classList.add('recording');
    $('#recBadge').hidden = false;
    toast(msg || 'Recording… tap REC to stop (max 30 s)');
  }
  // Phones: let people send the video straight to WhatsApp & co. (sharing needs a tap, so it's a button).
  let pendingShare = null;
  function offerShare(file, blob, name) {
    pendingShare = { file, blob, name };
    $('#shareBar').hidden = false;
  }
  const closeShare = () => { pendingShare = null; $('#shareBar').hidden = true; };
  $('#btnShareVideo').addEventListener('click', async () => {
    if (!pendingShare) return;
    try { await navigator.share({ files: [pendingShare.file], title: 'Light Up the Skies' }); closeShare(); } catch (e) { /* cancelled */ }
  });
  $('#btnSaveVideo').addEventListener('click', () => { if (pendingShare) download(pendingShare.blob, pendingShare.name); closeShare(); });
  $('#btnCloseShare').addEventListener('click', closeShare);

  function stopRecording() {
    if (!rec) return;
    rec.mr.stop();
    rec = null;
    document.body.classList.remove('recording');
    $('#recBadge').hidden = true;
  }
  function recordFrame(now) {
    composite(rec.g, rec.rc.width, rec.rc.height);
    const sec = (now - rec.start) / 1000;
    $('#recTime').textContent = `0:${String(sec | 0).padStart(2, '0')}`;
    if (sec >= 30) stopRecording();
  }

  // ---------- Greeting cards ----------
  const OCCASIONS = [
    { id: 'birthday', label: '🎂 Birthday', head: 'Happy Birthday', msg: 'Wishing you a year full of light, laughter and wonderful surprises.', theme: 'rainbow' },
    { id: 'newyear', label: '🥂 New Year', head: 'Happy New Year', msg: 'May the year ahead sparkle as brightly as these skies.', theme: 'gold' },
    { id: 'diwali', label: '🪔 Diwali', head: 'Happy Diwali', msg: 'May the festival of lights fill your home with joy, peace and prosperity.', theme: 'gold' },
    { id: 'christmas', label: '🎄 Christmas', head: 'Merry Christmas', msg: 'Warm wishes for a season full of peace, love and a little magic.', theme: 'festive' },
    { id: 'love', label: '💖 Love', head: 'I Love You', msg: 'You light up my sky every single day.', theme: 'rose' },
    { id: 'anniversary', label: '💍 Anniversary', head: 'Happy Anniversary', msg: 'Here’s to every year we have shared, and all the ones still to come.', theme: 'rose' },
    { id: 'congrats', label: '🏆 Congrats', head: 'Congratulations', msg: 'You did it! The whole sky is celebrating you tonight.', theme: 'rainbow' },
    { id: 'thanks', label: '🙏 Thank you', head: 'Thank You', msg: 'For everything you do, this show is for you.', theme: 'ocean' },
    { id: 'custom', label: '✨ Custom', head: 'Hello', msg: '', theme: 'classic' },
  ];
  const TEMPLATE_HEADS = new Set(OCCASIONS.map((o) => o.head));
  const TEMPLATE_MSGS = new Set(OCCASIONS.map((o) => o.msg));
  const card = { o: 'birthday', t: '', f: '', h: OCCASIONS[0].head, m: OCCASIONS[0].msg, p: OCCASIONS[0].theme, img: '' };
  const toB64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64url = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };
  const imgCache = new Map();
  function photoImage(b64) {
    if (!imgCache.has(b64)) { const im = new Image(); im.src = `data:image/jpeg;base64,${b64}`; imgCache.set(b64, im); }
    return imgCache.get(b64);
  }
  const photoSrc = (b64) => `data:image/jpeg;base64,${b64}`;
  function setImg(node, b64) {
    node.hidden = !b64;
    if (b64) node.src = photoSrc(b64); else node.removeAttribute('src');
  }
  // Square-crop and shrink the photo so it fits comfortably inside a share link.
  function processPhoto(file) {
    if (!file || !/^image\//.test(file.type)) { toast('Please choose an image file'); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 200, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d'), w = img.naturalWidth, h = img.naturalHeight, m = Math.min(w, h);
      g.fillStyle = '#111'; g.fillRect(0, 0, S, S);
      g.drawImage(img, (w - m) / 2, (h - m) * 0.3, m, m, 0, 0, S, S);
      let q = 0.78, d;
      do { d = c.toDataURL('image/jpeg', q); q -= 0.1; } while (d.length > 18000 && q > 0.3);
      card.img = d.split(',')[1];
      URL.revokeObjectURL(url);
      fillForm();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image'); };
    img.src = url;
  }
  const f = { to: $('#cTo'), from: $('#cFrom'), head: $('#cHead'), msg: $('#cMsg') };

  function encodeCard(c) {
    const bytes = new TextEncoder().encode(JSON.stringify(c));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeCard(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    return normaliseCard(raw);
  }
  function normaliseCard(raw) {
    const c = {
      o: clean(raw.o, 16), t: clean(raw.t, 20), f: clean(raw.f, 24),
      h: clean(raw.h, 24), m: cleanMsg(raw.m, 160), p: PALETTES[raw.p] ? raw.p : 'rainbow', img: '',
    };
    if (!c.t) throw new Error('empty card');
    return c;
  }

  function renderOccasions() {
    const box = $('#occasions');
    box.innerHTML = '';
    for (const o of OCCASIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (o.id === card.o ? ' active' : '');
      b.textContent = o.label;
      b.addEventListener('click', () => {
        card.o = o.id;
        if (!card.h || TEMPLATE_HEADS.has(card.h)) card.h = o.head;
        if (!card.m || TEMPLATE_MSGS.has(card.m)) card.m = o.msg;
        card.p = o.theme;
        fillForm();
      });
      box.append(b);
    }
  }
  function fillForm() {
    f.to.value = card.t; f.from.value = card.f; f.head.value = card.h; f.msg.value = card.m;
    renderOccasions();
    themeChips($('#cThemes'), card.p, (id) => { card.p = id; fillForm(); });
    updatePreview();
  }
  function readForm() {
    card.t = clean(f.to.value, 20);
    card.f = clean(f.from.value, 24);
    card.h = clean(f.head.value, 24);
    card.m = cleanMsg(f.msg.value, 160);
  }
  function updatePreview() {
    readForm();
    $('#pvHead').textContent = card.h || ' ';
    $('#pvName').textContent = card.t || 'Their name';
    $('#pvTo').textContent = card.t || '…';
    $('#pvMsg').textContent = card.m;
    $('#pvFrom').textContent = card.f ? `— ${card.f}` : '';
    $('#msgCount').textContent = `${f.msg.value.length}/160`;
    const cols = PALETTES[card.p];
    setImg($('#pvPhoto'), card.img);
    setImg($('#pvAvatar'), card.img);
    $('#pvCard').classList.toggle('has-photo', !!card.img);
    setImg($('#cPhotoPrev'), card.img);
    $('#cPhotoRemove').hidden = !card.img;
    $('#cPhotoLabel').textContent = card.img ? 'Change photo' : 'Add photo';
    document.querySelector('.preview-sky').style.setProperty('--pv-grad', `linear-gradient(90deg, ${cols.join(', ')})`);
  }
  $('#cPhoto').addEventListener('change', (e) => { processPhoto(e.target.files[0]); e.target.value = ''; });
  $('#cPhotoRemove').addEventListener('click', () => { card.img = ''; updatePreview(); });
  for (const k in f) f[k].addEventListener('input', () => { f.to.closest('.field').classList.remove('invalid'); updatePreview(); });

  function validCard() {
    readForm();
    if (!card.t) {
      const fld = f.to.closest('.field');
      fld.classList.remove('invalid'); void fld.offsetWidth; fld.classList.add('invalid');
      f.to.focus();
      return false;
    }
    return true;
  }
  function cardUrl() {
    const { img, ...data } = card;
    // The app is served from a private origin, so it links to the public web copy of the game instead.
    const base = window.LUTSNative && window.LUTSNative.shareBase ? window.LUTSNative.shareBase
      : location.origin === 'null' ? location.href.split('#')[0] : location.origin + location.pathname;
    return `${base}#card=${encodeCard(data)}${img ? `&photo=${toB64url(img)}` : ''}`;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  const modal = $('#cardModal');
  function openCardModal(prefill) {
    closeDrawer();
    if (prefill) { card.o = prefill.o || card.o; card.p = prefill.p || card.p; card.h = prefill.h || card.h; card.m = prefill.m || card.m; card.t = ''; card.f = ''; card.img = ''; }
    fillForm();
    modal.hidden = false;
    if (location.protocol === 'file:') $('#linkNote').textContent = 'The link contains the whole card, so nothing is uploaded. Host the game online (for example GitHub Pages or Netlify) so friends can open the link.';
    setTimeout(() => f.to.focus(), 50);
  }
  function closeCardModal() { modal.hidden = true; }
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeCardModal(); });
  $('#btnShare').hidden = !navigator.share;

  $('#btnCard').addEventListener('click', () => openCardModal());
  $('#btnIntroCard').addEventListener('click', () => { Sound.resume(); openCardModal(); });
  $('#btnPreview').addEventListener('click', () => {
    if (!validCard()) return;
    Sound.resume();
    closeCardModal();
    hideOverlay($('#intro'));
    playCard({ ...card });
  });
  $('#btnCopyLink').addEventListener('click', async () => {
    if (!validCard()) return;
    toast((await copyText(cardUrl())) ? 'Card link copied. Paste it anywhere to share.' : 'Could not copy the link');
  });
  $('#btnShare').addEventListener('click', async () => {
    if (!validCard()) return;
    try {
      await navigator.share({ title: `A fireworks card for ${card.t}`, text: `${card.f || 'Someone'} sent you a fireworks greeting ✨`, url: cardUrl() });
    } catch (e) { /* cancelled */ }
  });

  // Card show
  let currentCard = null;
  function playCard(c) {
    currentCard = c;
    mode = 'card';
    achieve('card');
    cardAuto = false; cardAutoCount = 0;
    document.body.classList.add('card-mode');
    $('#greeting').hidden = true;
    clearTimers('card');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    const T = 'card';
    after(0.2, () => launchShell({ x: W * 0.22, y: H * 0.3, type: 'chrysanthemum' }), T);
    after(0.55, () => launchShell({ x: W * 0.78, y: H * 0.3, type: 'chrysanthemum' }), T);
    after(1.0, () => launchShell({ x: W * 0.5, y: H * 0.2, type: 'kamuro' }), T);
    let t = 3;
    if (c.h) { after(2.6, () => launchText(c.h, H * 0.24, 0.12, 3), T); t = 6; }
    if (c.img) { after(t, () => launchPhoto(c.img, H * 0.52, 3.4), T); t += 4.8; }
    after(t, () => launchText(c.t, H * 0.42, 0.2, 4), T);
    after(t + 0.4, () => {
      launchShell({ x: W * 0.15, y: H * 0.22, type: 'heart' });
      launchShell({ x: W * 0.85, y: H * 0.22, type: 'heart' });
    }, T);
    const tGreet = t + 2.8;
    after(tGreet, () => { showGreeting(c); cardAuto = true; autoTimer = 1.2; }, T);
    return tGreet;
  }
  function launchText(text, y, hFrac, hold) {
    launchShell({ x: W / 2, y, type: 'text', text, textH: Math.min(H * hFrac, W * 0.22), hold, straight: true, size: 1 });
  }
  function launchPhoto(b64, y, hold) {
    const r = Math.min(W * 0.2, H * 0.14, 150);
    launchShell({ x: W / 2, y, type: 'photo', img: photoImage(b64), r, hold, straight: true, size: 1 });
  }
  function showGreeting(c) {
    $('#gTo').textContent = c.t;
    $('#gMsg').textContent = c.m;
    $('#gFrom').textContent = c.f ? `— ${c.f}` : '';
    setImg($('#gPhoto'), c.img);
    $('#gCard').classList.toggle('has-photo', !!c.img);
    $('#greeting').hidden = false;
  }
  function exitCardMode() {
    clearTimers('card');
    $('#greeting').hidden = true;
    document.body.classList.remove('card-mode');
    palette = basePalette();
    portrait = null;
    mode = 'play';
    autoTimer = 1;
  }
  $('#btnReplay').addEventListener('click', () => currentCard && playCard(currentCard));
  $('#btnMakeOwn').addEventListener('click', () => openCardModal(currentCard && { o: currentCard.o, p: currentCard.p, h: currentCard.h, m: currentCard.m }));
  $('#btnCloseGreeting').addEventListener('click', exitCardMode);
  // Replays the whole card show from the start while recording, then saves the video.
  $('#btnRecordCard').addEventListener('click', () => {
    if (!currentCard) return;
    if (rec) stopRecording();
    Sound.resume();
    const tGreet = playCard(currentCard);
    startRecording('Recording the card show… it saves automatically');
    if (rec) after(Math.min(29, tGreet + 7), stopRecording, 'card');
  });

  // ---------- Intro / envelope ----------
  function hideOverlay(o) {
    if (o.hidden) return;
    o.classList.add('leaving');
    setTimeout(() => { o.hidden = true; o.classList.remove('leaving'); }, 600);
  }
  $('#btnStart').addEventListener('click', () => {
    Sound.resume();
    hideOverlay($('#intro'));
    mode = 'play';
    autoTimer = 1.2;
    launchShell({ x: W * 0.5, y: H * 0.25, type: 'chrysanthemum', size: 1.2 });
  });

  let incoming = null;
  function readHash() {
    const m = location.hash.match(/card=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    let c;
    try { c = decodeCard(m[1]); } catch (e) { return null; }
    const ph = location.hash.match(/photo=([A-Za-z0-9_-]+)/);
    if (ph && ph[1].length < 80000) c.img = fromB64url(ph[1]);
    return c;
  }
  $('#btnOpenCard').addEventListener('click', () => {
    Sound.resume();
    hideOverlay($('#envelope'));
    playCard(incoming);
  });
  window.addEventListener('hashchange', () => {
    const c = readHash();
    if (c) { incoming = c; closeCardModal(); $('#intro').hidden = true; showEnvelope(c); }
  });
  function showEnvelope(c) {
    mode = 'envelope';
    clearTimers('card');
    $('#greeting').hidden = true;
    document.body.classList.add('card-mode');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    $('#envTo').textContent = c.t;
    $('#envFrom').textContent = c.f ? `from ${c.f}` : '';
    setImg($('#envPhoto'), c.img);
    $('#btnOpenCard').classList.toggle('has-photo', !!c.img);
    $('#envelope').hidden = false;
  }


  // ---------- Play modes: sky shells, ground crackers, sparkler writing ----------
  let playMode = 'sky';
  const HINTS = {
    sky: 'Tap anywhere to launch · hold to keep firing',
    ground: 'Drag a cracker onto the street, then tap it to light',
    spark: 'Draw with your finger to write in sparkler light',
  };
  function setPlayMode(m) {
    if (pen) penUp();
    eraser = null;
    dragPreview = null;
    pointer = null;
    playMode = m;
    document.body.classList.remove('mode-sky', 'mode-ground', 'mode-spark');
    document.body.classList.add(`mode-${m}`);
    document.querySelectorAll('#modeTabs [data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    el.hint.textContent = HINTS[m];
    el.hint.classList.remove('gone');
    drawFloor();
  }
  document.querySelectorAll('#modeTabs [data-mode]').forEach((b) => b.addEventListener('click', () => setPlayMode(b.dataset.mode)));

  // ---------- Street floor ----------
  // The street ends just above the dock so crackers are never hidden under the controls.
  function groundBottom() {
    const tabs = $('#modeTabs');
    if (document.body.classList.contains('ui-hidden') || !tabs.offsetParent) return H - 12;
    return Math.min(H - 12, tabs.getBoundingClientRect().top - 8);
  }
  const floorH = () => clamp(H * 0.15, 70, 150);
  const floorTop = () => (arOn ? H * 0.55 : groundBottom() - floorH());
  function drawFloor() {
    const g = fctx;
    g.clearRect(0, 0, W, H);
    if (playMode !== 'ground' || arOn) return;
    const top = floorTop(), fh = H - top;
    if (world.img) {
      // Blend the street into the landmark scene instead of cutting across it with a hard edge.
      const fadeH = Math.min(70, fh * 0.6), blend = g.createLinearGradient(0, top - fadeH, 0, top);
      blend.addColorStop(0, 'rgba(29,22,51,0)');
      blend.addColorStop(1, 'rgba(29,22,51,0.85)');
      g.fillStyle = blend;
      g.fillRect(0, top - fadeH, W, fadeH);
    }
    const grd = g.createLinearGradient(0, top, 0, H);
    grd.addColorStop(0, '#1d1633');
    grd.addColorStop(0.35, '#15102a');
    grd.addColorStop(1, '#09070f');
    g.fillStyle = grd;
    g.fillRect(0, top, W, fh);
    // Perspective paving
    const vx = W / 2, vy = top - fh * 1.6;
    g.strokeStyle = 'rgba(255,220,180,0.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = -14; i <= 14; i++) {
      const bx = vx + i * (W / 9);
      const t = (top - vy) / (H - vy);
      g.moveTo(vx + (bx - vx) * t, top); g.lineTo(bx, H);
    }
    for (let k = 1; k < 7; k++) {
      const y = top + fh * Math.pow(k / 7, 1.6);
      g.moveTo(0, y); g.lineTo(W, y);
    }
    g.stroke();
    // Kerb highlight
    g.fillStyle = 'rgba(255,200,140,0.18)';
    g.fillRect(0, top, W, 1.5);
    const kerb = g.createLinearGradient(0, top, 0, top + 10);
    kerb.addColorStop(0, 'rgba(0,0,0,0.5)');
    kerb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = kerb;
    g.fillRect(0, top + 1.5, W, 10);
  }

  // ---------- Smoke ----------
  const smokes = [], smokeSprites = {};
  function smokeSprite(col) {
    if (smokeSprites[col]) return smokeSprites[col];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 0.9));
    gr.addColorStop(0.5, rgba(col, 0.45));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return (smokeSprites[col] = c);
  }
  function smoke(x, y, vx, vy, col, r0, r1, life, a = 0.07) {
    if (smokes.length > 260) return;
    smokes.push({ x, y, vx, vy, col, r0, r1, life, a, age: 0 });
  }
  function updateSmoke(dt) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const m = smokes[i];
      m.age += dt;
      if (m.age >= m.life) { smokes.splice(i, 1); continue; }
      const e = Math.exp(-0.9 * dt);
      m.vx = m.vx * e + 6 * U * dt; m.vy *= e;
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
  }
  function drawSmoke() {
    gctx.globalCompositeOperation = 'source-over';
    for (const m of smokes) {
      const t = m.age / m.life, r = m.r0 + (m.r1 - m.r0) * Math.sqrt(t);
      gctx.globalAlpha = m.a * Math.min(1, m.age / 0.25) * (1 - t);
      gctx.drawImage(smokeSprite(m.col), m.x - r, m.y - r, r * 2, r * 2);
    }
    gctx.globalAlpha = 1;
  }

  // ---------- Screen shake ----------
  let shake = 0;
  const shakeEls = ['#sky', '#fx', '#city', '#floor', '#items', '#paint', '#gfx'].map((q) => $(q));
  function applyShake(dt) {
    if (shake <= 0) return;
    shake = Math.max(0, shake - dt);
    const m = (shake / 0.45) * 9 * U;
    const tf = shake ? `translate(${rand(-m, m).toFixed(1)}px,${rand(-m, m).toFixed(1)}px)` : '';
    for (const e of shakeEls) e.style.transform = tf;
  }

  // ---------- Ground crackers ----------
  const groundItems = [];
  const GOLD = ['#ffcf6b', '#fff3d6', '#ffb347'];
  const ITEMS = {
    flowerpot: {
      label: 'Flower pot', fuse: 0.5, dur: 5.5,
      tip: [0, -27],
      ignite(it) { Sound.hiss(it.dur, 3400, 0.17, pan(it.x)); },
      run(it, a, dt) {
        const k = Math.min(1, a / 0.4) * Math.min(1, (it.dur - a) / 1.2);
        const [tx, ty] = tipPos(it), n = k * 520 * dt * Q().count;
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.3, 0.3) * (1 + 0.25 * Math.sin(a * 3));
          const v = rand(250, 560) * U * it.s * (0.55 + 0.45 * k);
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.72 ? pick(GOLD) : it.color, rand(0.7, 1.3),
            { drag: 0.9, grav: 2.2, size: 1.3, glitter: 0.25, floorY: it.y + 2 });
        }
        glowAt(tx, ty, it.color, 70 * U * it.s, 0.35 * k);
        addLight(it.color, dt * 1.4 * k);
      },
    },
    chakri: {
      label: 'Spinner', fuse: 0.5, dur: 4.8,
      tip: [11, -6],
      ignite(it) { Sound.hiss(it.dur, 2600, 0.14, pan(it.x), { wobble: 9, whistle: 1700 }); },
      run(it, a, dt) {
        const w = 3 + 26 * Math.min(1, a / 0.8) * Math.min(1, (it.dur - a) / 0.8 + 0.2);
        it.rot += w * dt;
        it.x += Math.sin(a * 1.9) * 24 * U * dt;
        const S = it.s * U * 1.3, cy = it.y - 6 * S, R = 11 * S;
        const col = palette[((a * 2) | 0) % palette.length];
        const n = Math.max(1, Math.round(5 * Q().count));
        for (const off of [0, Math.PI]) {
          const ang = it.rot + off, ex = it.x + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R * 0.45;
          for (let i = 0; i < n; i++) {
            const d = ang + Math.PI / 2 + rand(-0.25, 0.25), v = rand(140, 320) * U * it.s;
            star(ex, ey, Math.cos(d) * v, Math.sin(d) * v * 0.45 - rand(0, 60) * U, Math.random() < 0.5 ? col : '#fff3d6', rand(0.3, 0.65),
              { drag: 1.3, grav: 1.4, size: 1.4, floorY: it.y + 3 });
          }
        }
        glowAt(it.x, cy, col, 60 * U * it.s, 0.35);
        addLight(col, dt * 1.1);
      },
    },
    rocket: {
      label: 'Rocket', fuse: 0.8, dur: 0.1,
      tip: [0, -30],
      ignite(it) {
        const S = it.s * U * 1.3;
        it.fired = true;
        launchShell({ sx: it.x, sy: it.y - 60 * S, x: it.x + rand(-80, 80) * U, y: rand(H * 0.12, H * 0.34), size: rand(0.55, 0.75), L: 1, whistle: true });
        smoke(it.x, it.y - 30 * S, 0, -20 * U, '#a9a4b8', 8 * U, 40 * U, 2.2, 0.08);
      },
      run() {},
    },
    bomb: {
      label: 'Atom bomb', fuse: 1.8, dur: 0.05,
      tip: [6, -30],
      ignite(it) {
        const S = it.s * U * 1.3, x = it.x, y = it.y - 11 * S;
        curLayer = 1;
        flash(x, y, '#fff1d0', 2.2, gctx);
        const n = cnt(110);
        for (let i = 0; i < n; i++) {
          const ang = rand(-Math.PI, 0.15), v = rand(200, 650) * U * it.s;
          star(x, y, Math.cos(ang) * v, Math.sin(ang) * v, pick(['#fff4dc', '#ffb347', '#ff7a2b', '#ffd36b']), rand(0.3, 0.9),
            { drag: 3, grav: 1.6, size: 1.6, floorY: it.y + 2 });
        }
        curLayer = 0;
        for (let i = 0; i < 16; i++) smoke(x + rand(-20, 20) * U, y + rand(-10, 5) * U, rand(-60, 60) * U, rand(-70, -10) * U, '#8d8898', 16 * U, 70 * U, rand(2.5, 4), 0.09);
        shake = 0.45;
        buzz(80);
        // Chain reaction: the blast lights any unlit cracker close by.
        for (const o of groundItems) {
          if (o !== it && !o.armed && !o.done && Math.hypot(o.x - it.x, (o.y - it.y) * 2) < 190 * U) {
            armItem(o);
            o.t = -rand(0.05, 0.3);
            achieve('chain');
          }
        }
        Sound.bang(pan(x));
        addLight('#ffe6b8', 2.6 * it.s);
        it.done = true;
        bumpMeter(9);
      },
      run() {},
    },
    laddi: {
      label: 'Cracker string', fuse: 0.5, dur: 3.4,
      tip: [-66, -4],
      ignite() {},
      run(it, a) {
        const total = 24, want = Math.min(total, Math.floor((a / it.dur) * total * 1.02));
        const S = it.s * U * 1.3;
        while (it.popped < want) {
          const i = it.popped++;
          const x = it.x + (-60 + (120 * i) / (total - 1)) * S, y = it.y - 4 * S;
          curLayer = 1;
          flash(x, y, '#ffd9a0', 0.22 * it.s, gctx);
          for (let k = 0; k < 9; k++) {
            const ang = rand(-Math.PI, 0), v = rand(120, 300) * U * it.s;
            spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.5 ? '#fff4dc' : '#ff8a2b', rand(0.06, 0.18));
          }
          curLayer = 0;
          if (i % 2 === 0) smoke(x, y, rand(-10, 10) * U, -rand(20, 45) * U, '#8d8898', 6 * U, 30 * U, 1.8, 0.07);
          Sound.snap(pan(x));
          addLight('#ffd9a0', 0.12);
        }
      },
    },
    roman: {
      label: 'Roman candle', fuse: 0.5, dur: 4.6,
      tip: [0, -45],
      ignite() {},
      run(it, a) {
        const shots = Math.min(7, Math.floor(a / 0.62) + 1);
        const [tx, ty] = tipPos(it);
        while (it.shots < shots) {
          it.shots++;
          const col = color(), v = rand(430, 560) * U * (0.8 + it.s * 0.3);
          curLayer = 1;
          star(tx, ty, rand(-45, 45) * U, -v, col, 1.5, { drag: 0.55, grav: 1.25, size: 5, glitter: 1.4, gcol: col });
          flash(tx, ty, col, 0.35, gctx);
          curLayer = 0;
          smoke(tx, ty, 0, -30 * U, '#9d98aa', 6 * U, 28 * U, 1.6, 0.06);
          Sound.thump(pan(tx));
          addLight(col, 0.5);
        }
        glowAt(tx, ty, '#ffcf6b', 26 * U * it.s, 0.25);
      },
    },
    cake: {
      label: 'Sky cake', fuse: 0.6, dur: 4.4,
      tip: [0, -26],
      ignite() {},
      run(it, a) {
        const total = 14, want = Math.min(total, Math.floor(a / 0.3) + 1);
        const S = it.s * U * 1.3;
        while (it.shots < want) {
          const i = it.shots++;
          launchShell({
            sx: it.x + rand(-10, 10) * S, sy: it.y - 26 * S,
            x: clamp(it.x + Math.sin(i * 1.3) * W * 0.2, 20, W - 20), y: rand(H * 0.12, H * 0.42),
            size: rand(0.45, 0.65), type: pick(['peony', 'chrysanthemum', 'crackle', 'strobe', 'ring', 'kaleido']), L: 1,
          });
          flash(it.x, it.y - 26 * S, '#ffd9a0', 0.3, gctx);
          Sound.thump(pan(it.x));
        }
      },
    },
    smoke: {
      label: 'Color smoke', fuse: 0.4, dur: 6,
      tip: [0, -21],
      ignite(it) { Sound.hiss(it.dur, 900, 0.07, pan(it.x), { q: 0.5 }); },
      run(it, a, dt) {
        const k = Math.min(1, a / 0.5) * Math.min(1, (it.dur - a) / 1.5);
        const [tx, ty] = tipPos(it);
        it.acc += dt * 14 * k;
        while (it.acc > 1) {
          it.acc--;
          smoke(tx, ty, rand(-25, 25) * U, -rand(50, 110) * U, it.color, 8 * U * it.s, rand(50, 90) * U * it.s, rand(2.6, 3.6), 0.11);
        }
      },
    },
  };
  Object.assign(ITEMS, {
    sparkler: {
      label: 'Sparkler', fuse: 0.4, dur: 7,
      tip: [0, -46],
      tipAt(it) { return [0, -46 + 30 * (it.lit ? clamp(it.t / it.dur, 0, 1) : 0)]; },
      ignite(it) { Sound.hiss(it.dur, 5200, 0.08, pan(it.x), { q: 0.6 }); },
      run(it, a, dt) {
        const [tx, ty] = tipPos(it), n = Math.round(6 * Q().count);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * TAU, v = rand(60, 280) * U * it.s;
          spark(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.6 ? '#fff4dc' : pick(GOLD), rand(0.1, 0.4));
        }
        if (Math.random() < dt * 6) Sound.crackle(pan(tx));
        glowAt(tx, ty, '#fff1c8', 30 * U * it.s, 0.7);
        addLight('#ffe6b8', dt * 0.6);
      },
    },
    heli: {
      label: 'Helicopter', fuse: 0.5, dur: 4,
      tip: [12, -6],
      ignite(it) { it.vy = 0; Sound.hiss(it.dur, 3000, 0.12, pan(it.x), { wobble: 12, whistle: 2200 }); },
      run(it, a, dt) {
        it.rot += (6 + 30 * Math.min(1, a / 0.6)) * dt;
        if (a > 0.7) { it.vy = Math.min(it.vy + 420 * U * dt, 260 * U); it.hy += it.vy * dt; it.x += Math.sin(a * 2.3) * 40 * U * dt; }
        const S = it.s * U * 1.3, cy = it.y - it.hy - 6 * S, R = 12 * S;
        const col = palette[((a * 3) | 0) % palette.length];
        for (const off of [0, Math.PI]) {
          const ang = it.rot + off, ex = it.x + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R * 0.35;
          for (let i = 0; i < 3; i++) {
            const d = ang + Math.PI / 2 + rand(-0.3, 0.3), v = rand(120, 260) * U * it.s;
            star(ex, ey, Math.cos(d) * v, Math.sin(d) * v * 0.35 + rand(0, 80) * U, Math.random() < 0.5 ? col : '#fff3d6', rand(0.3, 0.6),
              { drag: 1.4, grav: 1.4, size: 1.3, floorY: it.y + 3 });
          }
        }
        glowAt(it.x, cy, col, 50 * U * it.s, 0.35);
        if (!it.end && a >= it.dur - 0.06) {
          it.end = true;
          flash(it.x, cy, col, 0.6, gctx);
          sphere(cnt(40), (dx, dy) => star(it.x, cy, dx * 180 * U, dy * 180 * U, col, rand(0.8, 1.2), { drag: 1.6, size: 1.8 }));
          Sound.pop(pan(it.x));
        }
      },
    },
    mine: {
      label: 'Star mine', fuse: 0.9, dur: 0.05, keep: 1.5,
      tip: [0, -24],
      ignite(it) {
        const [tx, ty] = tipPos(it), n = cnt(55), c1 = color(), c2 = color();
        const crackleEnd = (p) => { curLayer = 1; crackleBurst(p.x, p.y); curLayer = 0; Sound.crackle(pan(p.x)); };
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.45, 0.45), v = rand(480, 820) * U * (0.8 + it.s * 0.25), c = i % 2 ? c1 : c2;
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, c, rand(1.1, 1.6),
            { drag: 1.1, grav: 1, size: 2.6, glitter: 0.5, gcol: c, onDeath: Math.random() < 0.3 ? crackleEnd : null });
        }
        flash(tx, ty, c1, 0.9, gctx);
        for (let i = 0; i < 4; i++) smoke(tx, ty, rand(-30, 30) * U, -rand(30, 60) * U, '#8d8898', 10 * U, 45 * U, 2.4, 0.08);
        Sound.thump(pan(tx)); Sound.lastBurst = 0; Sound.burst(0.9, pan(tx));
        shake = Math.max(shake, 0.15); buzz(30);
        addLight(c1, 1.5); bumpMeter(6);
      },
      run() {},
    },
    wheel: {
      label: 'Fire wheel', fuse: 0.5, dur: 5.5,
      tip: [0, -44],
      ignite(it) { Sound.hiss(it.dur, 2400, 0.13, pan(it.x), { wobble: 7 }); },
      run(it, a, dt) {
        it.rot += (4 + 18 * Math.min(1, a / 0.8)) * dt;
        const S = it.s * U * 1.3, cx = it.x, cy = it.y - 44 * S, R = 12 * S;
        const col = palette[((a * 1.5) | 0) % palette.length];
        for (let k = 0; k < 3; k++) {
          const ang = it.rot + (k * TAU) / 3, ex = cx + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R;
          for (let i = 0; i < 3; i++) {
            const d = ang + Math.PI / 2 + rand(-0.2, 0.2), v = rand(150, 300) * U * it.s;
            star(ex, ey, Math.cos(d) * v, Math.sin(d) * v, Math.random() < 0.55 ? col : '#fff3d6', rand(0.35, 0.7), { drag: 1.3, grav: 1.3, size: 1.4, floorY: it.y + 3 });
          }
        }
        glowAt(cx, cy, col, 55 * U * it.s, 0.4);
        addLight(col, dt * 1.1);
      },
    },
    strobe: {
      label: 'Strobe pot', fuse: 0.5, dur: 4.5,
      tip: [0, -20],
      ignite() {},
      run(it, a, dt) {
        const [tx, ty] = tipPos(it);
        it.acc += dt * 22 * Q().count;
        while (it.acc > 1) {
          it.acc--;
          const x = tx + rand(-70, 70) * U * it.s, y = ty - rand(10, 150) * U * it.s;
          star(x, y, 0, 0, Math.random() < 0.7 ? '#ffffff' : it.color, rand(0.06, 0.14), { drag: 1, grav: 0, size: rand(3, 5) });
          if (Math.random() < 0.3) glowAt(x, y, '#ffffff', 22 * U, 0.5);
        }
        if (Math.random() < dt * 14) Sound.snap(pan(tx));
        spark(tx, ty, rand(-20, 20) * U, -rand(80, 200) * U, '#fff4dc', rand(0.2, 0.5));
      },
    },
    popper: {
      label: 'Party popper', fuse: 0.3, dur: 0.05, keep: 1.2,
      tip: [0, -28],
      ignite(it) {
        const [tx, ty] = tipPos(it), n = Math.round(90 * Q().count);
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.5, 0.5), v = rand(250, 640) * U * it.s;
          confetti(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, pick(CONFETTI), it.y + rand(-4, 10) * U);
        }
        flash(tx, ty, '#fff1d0', 0.4, gctx);
        Sound.pop(pan(tx)); Sound.snap(pan(tx));
        bumpMeter(3);
      },
      run() {},
    },
    snake: {
      label: 'Snake tablet', fuse: 0.6, dur: 6, keep: 3,
      tip: [0, -3],
      ignite(it) { it.pts = [[0, -3]]; it.dir = -Math.PI / 2; it.turn = rand(-1, 1); Sound.hiss(it.dur, 700, 0.05, pan(it.x), { q: 0.4 }); },
      run(it, a, dt) {
        const S = it.s * U * 1.3;
        it.acc += dt * 26;
        while (it.acc > 1 && it.pts.length < 160) {
          it.acc--;
          it.turn = clamp(it.turn + rand(-0.3, 0.3), -1.4, 1.4);
          it.dir = clamp(it.dir + it.turn * 0.09, -Math.PI + 0.25, -0.25);
          const [lx, ly] = it.pts[it.pts.length - 1];
          it.pts.push([lx + Math.cos(it.dir) * 0.7, Math.min(-2, ly + Math.sin(it.dir) * 0.7)]);
        }
        const [hx, hy] = it.pts[it.pts.length - 1];
        if (Math.random() < dt * 6) smoke(it.x + hx * S, it.y + hy * S, rand(-8, 8) * U, -rand(15, 35) * U, '#8d8898', 4 * U, 22 * U, 1.6, 0.06);
        if (Math.random() < dt * 10) spark(it.x + hx * S, it.y + hy * S, rand(-20, 20) * U, -rand(10, 40) * U, '#ff8a2b', 0.25);
      },
    },
    lantern: {
      label: 'Sky lantern', fuse: 0.8, dur: 18,
      tip: [0, -4],
      ignite(it) { Sound.hiss(1.2, 1200, 0.04, pan(it.x), { q: 0.5 }); bumpMeter(3); },
      run(it, a, dt) {
        it.hy += Math.min(1, a / 2) * 38 * U * dt;
        it.x += Math.sin(a * 0.9 + it.rot) * 14 * U * dt;
        const S = it.s * U * 1.3, cy = it.y - it.hy - 16 * S;
        glowAt(it.x, cy, '#ffb347', 60 * U * it.s, 0.35 + 0.08 * Math.sin(a * 7));
        if (Math.random() < dt * 3) spark(it.x, cy + 14 * S, rand(-6, 6) * U, rand(10, 30) * U, '#ffcf6b', 0.4);
        addLight('#ffb347', dt * 0.25);
        if (it.y - it.hy < -60) it.t = it.dur;
      },
    },
  });
  ITEMS.bomb.keep = 0;
  // Crackers from the artwork set (assets/crackers).
  Object.assign(ITEMS, {
    anar: {
      label: 'Anar', fuse: 0.5, dur: 7,
      tip: [0, -32],
      ignite(it) { Sound.hiss(it.dur, 3800, 0.18, pan(it.x)); },
      run(it, a, dt) {
        // A tall, narrow golden fountain with crackle.
        const k = Math.min(1, a / 0.6) * Math.min(1, (it.dur - a) / 1.5);
        const [tx, ty] = tipPos(it), n = k * 600 * dt * Q().count;
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.17, 0.17), v = rand(380, 760) * U * it.s * (0.5 + 0.5 * k);
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.55 ? '#fff4dc' : pick(GOLD), rand(0.8, 1.5),
            { drag: 0.8, grav: 2, size: 1.2, glitter: 0.5, floorY: it.y + 2 });
        }
        if (Math.random() < dt * 8 * k) Sound.crackle(pan(tx));
        glowAt(tx, ty, '#ffcf6b', 80 * U * it.s, 0.4 * k);
        addLight('#ffcf6b', dt * 1.6 * k);
      },
    },
    fountain: {
      label: 'Fountain', fuse: 0.5, dur: 6,
      tip: [0, -38],
      ignite(it) { Sound.hiss(it.dur, 3000, 0.15, pan(it.x), { q: 0.7 }); },
      run(it, a, dt) {
        // A high column that arcs back down, cycling through the theme colours.
        const k = Math.min(1, a / 0.5) * Math.min(1, (it.dur - a) / 1.2);
        const [tx, ty] = tipPos(it), n = k * 420 * dt * Q().count, col = palette[((a * 1.2) | 0) % palette.length];
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.08, 0.08), v = rand(520, 900) * U * it.s * (0.6 + 0.4 * k);
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.5 ? col : '#fff3d6', rand(1.2, 1.9),
            { drag: 0.7, grav: 2.4, size: 1.3, glitter: 0.3, gcol: col, floorY: it.y + 2 });
        }
        glowAt(tx, ty, col, 60 * U * it.s, 0.35 * k);
        addLight(col, dt * 1.2 * k);
      },
    },
    basket: {
      label: 'Flower basket', fuse: 0.5, dur: 5,
      tip: [0, -18],
      ignite(it) { Sound.hiss(it.dur, 2800, 0.14, pan(it.x)); },
      run(it, a, dt) {
        // A wide bouquet of coloured stars, some popping as they fall.
        const k = Math.min(1, a / 0.4) * Math.min(1, (it.dur - a) / 1);
        const [tx, ty] = tipPos(it), n = k * 210 * dt * Q().count;
        const popEnd = (p) => { crackleBurst(p.x, p.y); Sound.crackle(pan(p.x)); };
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.75, 0.75), v = rand(250, 520) * U * it.s;
          star(tx + rand(-10, 10) * U * it.s, ty, Math.cos(ang) * v, Math.sin(ang) * v, color(), rand(0.9, 1.4),
            { drag: 1, grav: 1.6, size: 1.8, floorY: it.y + 2, onDeath: Math.random() < 0.12 ? popEnd : null });
        }
        glowAt(tx, ty, it.color, 55 * U * it.s, 0.3 * k);
        addLight(it.color, dt * 1.1 * k);
      },
    },
    shell: {
      label: 'Shell', fuse: 1, dur: 0.1, keep: 1.4,
      tip: [0, -58],
      ignite(it) {
        // A mortar: one big aerial shell, high and wide.
        const S = it.s * U * 1.3, mx = it.x, my = it.y - 44 * S;
        it.fired = true;
        launchShell({ sx: mx, sy: my, x: mx + rand(-40, 40) * U, y: rand(H * 0.1, H * 0.22), size: rand(1.2, 1.45), type: pick(['chrysanthemum', 'peony', 'kamuro', 'willow']), L: 1 });
        flash(mx, my, '#ffd9a0', 0.8, gctx);
        for (let i = 0; i < 6; i++) smoke(mx, my, rand(-30, 30) * U, -rand(30, 70) * U, '#8d8898', 10 * U, 50 * U, 2.6, 0.09);
        Sound.thump(pan(mx));
        shake = Math.max(shake, 0.12); buzz(25);
      },
      run() {},
    },
    multishot: {
      label: 'Multi-colour shot', fuse: 0.5, dur: 3.6,
      tip: [9, -36],
      ignite() {},
      run(it, a) {
        // Twelve rainbow comets from a tilted tube, each popping into a small burst.
        const total = 12, want = Math.min(total, Math.floor(a / 0.28) + 1), [tx, ty] = tipPos(it);
        while (it.shots < want) {
          const i = it.shots++, col = PALETTES.rainbow[i % PALETTES.rainbow.length];
          const ang = -Math.PI / 2 + 0.28 + Math.sin(i * 0.9) * 0.12, v = rand(520, 640) * U * (0.8 + it.s * 0.3);
          const pop = (p) => { sphere(cnt(18), (dx, dy) => star(p.x, p.y, dx * 70 * U, dy * 70 * U, col, 0.7, { drag: 2, size: 1.6, L: 1 })); Sound.pop(pan(p.x)); };
          curLayer = 1;
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, col, 1.4, { drag: 0.55, grav: 1.2, size: 4, glitter: 1.2, gcol: col, onDeath: pop });
          flash(tx, ty, col, 0.3, gctx);
          curLayer = 0;
          Sound.thump(pan(tx));
          addLight(col, 0.4);
        }
      },
    },
    firecracker: {
      label: 'Firecracker', fuse: 0.6, dur: 2.4, keep: 1,
      tip: [16, -10],
      ignite() {},
      run(it, a) {
        // A bundle that pops faster and faster, then ends with one big bang.
        const total = 18, want = Math.min(total, Math.floor((a / it.dur) ** 0.8 * total) + 1), S = it.s * U * 1.3;
        while (it.popped < want) {
          it.popped++;
          const x = it.x + rand(-14, 14) * S, y = it.y - rand(2, 10) * S;
          curLayer = 1;
          flash(x, y, '#ffe0a8', 0.3 * it.s, gctx);
          for (let k = 0; k < 10; k++) {
            const ang = rand(-Math.PI, 0), v = rand(140, 340) * U * it.s;
            spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.5 ? '#fff4dc' : '#ff7a2b', rand(0.08, 0.2));
          }
          curLayer = 0;
          smoke(x, y, rand(-12, 12) * U, -rand(25, 50) * U, '#8d8898', 7 * U, 34 * U, 2, 0.08);
          Sound.snap(pan(x));
          addLight('#ffd9a0', 0.15);
        }
        if (!it.end && a >= it.dur - 0.06) {
          it.end = true;
          flash(it.x, it.y - 8 * S, '#fff1d0', 1.4, gctx);
          Sound.bang(pan(it.x));
          shake = Math.max(shake, 0.25); buzz(40);
          addLight('#ffe6b8', 1.5);
        }
      },
    },
    rocketcombo: {
      label: 'Rocket combo', fuse: 0.8, dur: 1.3, keep: 1,
      tip: [0, -50],
      ignite() {},
      run(it, a) {
        // Three rockets from one stand, fanning out across the sky.
        const S = it.s * U * 1.3, want = Math.min(3, Math.floor(a / 0.38) + 1);
        while (it.shots < want) {
          const i = it.shots++, ox = (i - 1) * 9 * S;
          launchShell({
            sx: it.x + ox, sy: it.y - 50 * S, x: clamp(it.x + (i - 1) * W * 0.12 + rand(-30, 30) * U, 20, W - 20),
            y: rand(H * 0.1, H * 0.3), size: rand(0.6, 0.8), L: 1, whistle: true,
          });
          smoke(it.x + ox, it.y - 30 * S, 0, -20 * U, '#a9a4b8', 8 * U, 36 * U, 2, 0.08);
        }
      },
    },
    finale: {
      label: 'Grand finale', fuse: 0.8, dur: 5.2, keep: 1.2,
      tip: [0, -26],
      ignite() { bumpMeter(6); },
      run(it, a) {
        // A box that fires a rapid barrage and closes with three big golden willows.
        const total = 26, want = Math.min(total, Math.floor(a / 0.18) + 1), S = it.s * U * 1.3;
        while (it.shots < want) {
          const i = it.shots++, last = i >= total - 3;
          launchShell({
            sx: it.x + rand(-14, 14) * S, sy: it.y - 26 * S,
            x: clamp(it.x + rand(-0.35, 0.35) * W, 20, W - 20), y: last ? H * rand(0.14, 0.2) : rand(H * 0.1, H * 0.42),
            size: last ? 1.3 : rand(0.5, 0.8), L: 1,
            type: last ? 'kamuro' : pick(['peony', 'chrysanthemum', 'crackle', 'strobe', 'ring', 'kaleido', 'crossette', 'palm']),
          });
          if (i % 2 === 0) flash(it.x, it.y - 26 * S, '#ffd9a0', 0.3, gctx);
          Sound.thump(pan(it.x));
        }
      },
    },
  });
  // Names match the artwork set; behaviour is unchanged.
  Object.assign(ITEMS.chakri, { label: 'Ground spinner' });
  Object.assign(ITEMS.heli, { label: 'Chakra' });
  Object.assign(ITEMS.mine, { label: 'Sky shot' });
  Object.assign(ITEMS.cake, { label: 'Wedding cake' });
  Object.assign(ITEMS.bomb, { label: 'Bulb bomb' });
  Object.assign(ITEMS.laddi, { label: 'Ladi' });
  // Grab area [half width, height] in sprite units, used to tap or drag a placed cracker.
  const HIT = {
    flowerpot: [14, 30], chakri: [14, 14], rocket: [9, 70], bomb: [13, 32], laddi: [68, 14], roman: [7, 48], cake: [22, 30], smoke: [8, 24],
    sparkler: [7, 48], heli: [14, 16], mine: [12, 26], wheel: [14, 58], strobe: [12, 22], popper: [10, 30], snake: [9, 10], lantern: [12, 36],
    anar: [14, 34], fountain: [9, 40], basket: [16, 22], shell: [9, 58], multishot: [13, 40], firecracker: [18, 16], rocketcombo: [16, 66], finale: [26, 32],
  };
  const ITEM_ORDER = ['flowerpot', 'anar', 'fountain', 'chakri', 'heli', 'rocket', 'rocketcombo', 'mine', 'multishot', 'roman', 'shell', 'cake', 'finale',
    'basket', 'bomb', 'firecracker', 'laddi', 'sparkler', 'lantern', 'wheel', 'strobe', 'popper', 'smoke', 'snake'];

  // ---------- Confetti ----------
  const confettis = [];
  const CONFETTI = ['#ff4d6d', '#ffd23f', '#3fd0ff', '#7dff6b', '#b46bff', '#ff9ad5', '#ffffff'];
  function confetti(x, y, vx, vy, col, floorY) {
    if (confettis.length > 600) return;
    confettis.push({ x, y, vx, vy, col, floorY, rot: rand(0, TAU), vr: rand(-12, 12), w: rand(4, 8) * U, h: rand(2, 4) * U, age: 0, life: rand(4, 6), ph: rand(0, TAU), landed: false });
  }
  function updateConfetti(dt) {
    for (let i = confettis.length - 1; i >= 0; i--) {
      const c = confettis[i];
      c.age += dt;
      if (c.age >= c.life) { confettis.splice(i, 1); continue; }
      if (c.landed) continue;
      const e = Math.exp(-2.2 * dt);
      c.vx = c.vx * e + Math.sin(c.age * 5 + c.ph) * 40 * U * dt;
      c.vy = c.vy * e + 160 * U * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > c.floorY) { c.y = c.floorY; c.landed = true; }
    }
  }
  function drawConfetti() {
    if (!confettis.length) return;
    const gctx = ictx;
    gctx.globalCompositeOperation = 'source-over';
    for (const c of confettis) {
      gctx.globalAlpha = Math.min(1, (c.life - c.age) / 0.8);
      gctx.save();
      gctx.translate(c.x, c.y);
      gctx.rotate(c.rot);
      gctx.scale(1, c.landed ? 0.5 : Math.cos(c.age * 8 + c.ph));
      gctx.fillStyle = c.col;
      gctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      gctx.restore();
    }
    gctx.globalAlpha = 1;
  }
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ } };
  const SMOKE_COLORS = ['#ff4d8d', '#ffd23f', '#3fd0ff', '#7dff6b', '#b46bff', '#ff7a2b'];

  function itemScale(y) { const top = floorTop(); return 0.7 + 0.6 * clamp((y - top) / (groundBottom() - top), 0, 1); }
  function tipPos(it) {
    const def = ITEMS[it.type], S = it.s * U * 1.3;
    let [x, y] = def.tipAt ? def.tipAt(it) : def.tip;
    if (it.type === 'bomb' && !it.lit) { const f = it.armed ? clamp(it.t / def.fuse, 0, 1) : 0; x = 6 * (1 - f) + 2 * f; y = -30 + 8 * f; }
    return [it.x + x * S, it.y - (it.hy || 0) + y * S];
  }
  function glowAt(x, y, col, r, a) {
    if (a <= 0.01) return;
    const g = gctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    gctx.globalCompositeOperation = 'lighter';
    gctx.fillStyle = g;
    gctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function bumpMeter(n) {
    if (mode !== 'play') return;
    meter += n / (1 + (level - 1) * 0.2);
    if (meter >= 100 && gameTime > finaleUntil) levelUp();
  }

  // Street position for a tap/drop; taps above the street pick a random spot on it.
  function groundPoint(x, y) {
    const top = floorTop(), bot = groundBottom(), fh = bot - top;
    const py = y >= top - 40 * U ? clamp(y, top + fh * 0.25, bot) : top + fh * rand(0.45, 0.9);
    return [clamp(x, 30, W - 30), py];
  }
  // Drag-and-drop only accepts drops on (or just above) the street.
  function dropPoint(x, y) {
    const top = floorTop(), bot = groundBottom();
    if (y < top - 50 * U || y > bot + 40) return null;
    return [clamp(x, 30, W - 30), clamp(y, top + (bot - top) * 0.25, bot)];
  }
  const sortItems = () => groundItems.sort((a, b) => a.y - b.y);
  function placeItem(type, x, y) {
    if (!ITEMS[type]) type = 'flowerpot';
    const [px, py] = groundPoint(x, y);
    if (groundItems.length >= 22) {
      const old = groundItems.find((o) => !o.armed) || groundItems[0];
      groundItems.splice(groundItems.indexOf(old), 1);
    }
    const def = ITEMS[type];
    const it = {
      type, x: px, y: py, s: itemScale(py), t: 0, rot: Math.random() * TAU, armed: false, lit: false, done: false, gone: 0, hy: 0,
      dur: def.dur, color: type === 'smoke' ? pick(SMOKE_COLORS) : color(), popped: 0, shots: 0, acc: 0,
    };
    groundItems.push(it);
    sortItems();
    Sound.tick(pan(px));
    return it;
  }
  function moveItem(it, x, y) {
    const [px, py] = groundPoint(x, Math.max(y, floorTop()));
    it.x = px; it.y = py; it.s = itemScale(py);
    sortItems();
  }
  function hitItem(x, y) {
    for (let i = groundItems.length - 1; i >= 0; i--) {
      const it = groundItems[i];
      if (it.armed || it.done) continue;
      const S = it.s * U * 1.3, [hw, hh] = HIT[it.type] || [14, 30];
      if (Math.abs(x - it.x) < hw * S + 14 && y > it.y - hh * S - 14 && y < it.y + 14) return it;
    }
    return null;
  }
  const tried = new Set();
  try { JSON.parse(localStorage.getItem('luts:tried') || '[]').forEach((t) => tried.add(t)); } catch (e) { /* ignore */ }
  function armItem(it) {
    if (it.armed || it.done) return;
    it.armed = true;
    it.t = 0;
    Sound.hiss(ITEMS[it.type].fuse + 0.1, 6000, 0.05, pan(it.x), { q: 0.4 });
    achieve('first');
    if (!tried.has(it.type)) {
      tried.add(it.type);
      try { localStorage.setItem('luts:tried', JSON.stringify([...tried])); } catch (e) { /* ignore */ }
      if (ITEM_ORDER.every((t) => tried.has(t))) achieve('collector');
    }
  }
  // Lights every cracker waiting on the street, left to right. With an empty street it sets up a row first.
  function lightAll() {
    Sound.resume();
    let idle = groundItems.filter((it) => !it.armed && !it.done);
    if (!idle.length) {
      const n = W < 600 ? 5 : 8;
      idle = [];
      for (let i = 0; i < n; i++) idle.push(placeItem(pick(ITEM_ORDER), W * ((i + 0.5) / n) + rand(-20, 20), -1));
    }
    idle.sort((a, b) => a.x - b.x).forEach((it, i) => after(i * 0.22, () => armItem(it)));
  }
  function clearStreet() {
    for (let i = groundItems.length - 1; i >= 0; i--) if (!groundItems[i].armed) groundItems.splice(i, 1);
  }

  function updateGround(dt) {
    let burning = 0;
    for (let i = groundItems.length - 1; i >= 0; i--) {
      const it = groundItems[i], def = ITEMS[it.type];
      if (it.done) { it.gone += dt; if (it.gone >= (def.keep ?? 0.7)) groundItems.splice(i, 1); continue; }
      if (!it.armed) continue;
      it.t += dt;
      if (it.t < 0) continue;
      if (!it.lit) {
        // Burning fuse
        const [fx, fy] = tipPos(it);
        curLayer = 1;
        if (Math.random() < 0.8) spark(fx, fy, rand(-40, 40) * U, rand(-60, 10) * U, pick(GOLD), rand(0.1, 0.3));
        curLayer = 0;
        glowAt(fx, fy, '#ffcf6b', 10 * U, 0.6);
        if (it.t >= def.fuse) {
          it.lit = true; it.t = 0;
          curLayer = 1; def.ignite(it); curLayer = 0;
          if (!['bomb', 'mine', 'popper'].includes(it.type)) bumpMeter(4);
        }
        continue;
      }
      burning++;
      curLayer = 1;
      def.run(it, it.t, dt);
      curLayer = 0;
      if (it.t >= it.dur) it.done = true;
    }
    if (burning >= 5) achieve('festival');
  }

  function drawItemShape(g, type, S, it) {
    const lit = it && it.lit, t = it ? it.t : 0;
    if (!(it && it.hy > 2)) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(0, 1, (SHADOW_W[type] || 13) * S, 3.5 * S, 0, 0, TAU); g.fill();
    }
    switch (type) {
      case 'sparkler': {
        const tipY = it ? ITEMS.sparkler.tipAt(it)[1] : -46;
        g.fillStyle = '#5a4636';
        g.beginPath(); g.ellipse(0, 0, 6 * S, 2.5 * S, 0, 0, TAU); g.fill();
        g.strokeStyle = '#9a96a0'; g.lineWidth = 1.2 * S;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -46 * S); g.stroke();
        if (tipY < -16) {
          g.strokeStyle = '#4d4752'; g.lineWidth = 2.8 * S;
          g.beginPath(); g.moveTo(0, -16 * S); g.lineTo(0, tipY * S); g.stroke();
        }
        break;
      }
      case 'heli': {
        g.save(); g.translate(0, -6 * S); g.scale(1, 0.35);
        g.fillStyle = '#2d2344';
        g.beginPath(); g.arc(0, 0, 12 * S, 0, TAU); g.fill();
        g.strokeStyle = '#3fbf6f'; g.lineWidth = 2.4 * S;
        g.beginPath(); g.arc(0, 0, 9 * S, 0, TAU); g.stroke();
        g.restore();
        const r = it ? it.rot : 0.4;
        g.strokeStyle = '#ffcf6b'; g.lineWidth = 2 * S;
        g.beginPath();
        g.moveTo(-Math.cos(r) * 18 * S, -12 * S - Math.sin(r) * 4 * S); g.lineTo(Math.cos(r) * 18 * S, -12 * S + Math.sin(r) * 4 * S);
        g.stroke();
        g.fillStyle = '#e33a4f';
        g.fillRect(-1.5 * S, -12 * S, 3 * S, 6 * S);
        break;
      }
      case 'mine': {
        const gr = g.createLinearGradient(-9 * S, 0, 9 * S, 0);
        gr.addColorStop(0, '#12603f'); gr.addColorStop(0.5, '#27a36b'); gr.addColorStop(1, '#0d4a31');
        g.fillStyle = gr;
        g.fillRect(-9 * S, -24 * S, 18 * S, 24 * S);
        g.fillStyle = '#ffcf6b';
        g.fillRect(-9 * S, -16 * S, 18 * S, 3 * S);
        g.fillRect(-9 * S, -7 * S, 18 * S, 1.5 * S);
        g.fillStyle = '#1a1030';
        g.beginPath(); g.ellipse(0, -24 * S, 9 * S, 2.6 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'wheel': {
        g.fillStyle = '#6b4a2e';
        g.fillRect(-1.6 * S, -44 * S, 3.2 * S, 44 * S);
        const r = it ? it.rot : 0.3;
        g.save(); g.translate(0, -44 * S); g.rotate(r);
        g.strokeStyle = '#ffcf6b'; g.lineWidth = 1.6 * S;
        g.beginPath(); g.arc(0, 0, 12 * S, 0, TAU); g.stroke();
        for (let k = 0; k < 3; k++) {
          g.rotate(TAU / 3);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(12 * S, 0); g.stroke();
          g.fillStyle = k === 0 ? '#e33a4f' : k === 1 ? '#3fbf6f' : '#2f5bd1';
          g.fillRect(9 * S, -2 * S, 6 * S, 4 * S);
        }
        g.fillStyle = '#fff3d6';
        g.beginPath(); g.arc(0, 0, 2.2 * S, 0, TAU); g.fill();
        g.restore();
        break;
      }
      case 'strobe': {
        const gr = g.createLinearGradient(-10 * S, 0, 10 * S, 0);
        gr.addColorStop(0, '#7d7a8c'); gr.addColorStop(0.5, '#e8e6f2'); gr.addColorStop(1, '#6b6878');
        g.fillStyle = gr;
        g.fillRect(-10 * S, -20 * S, 20 * S, 20 * S);
        g.fillStyle = it ? it.color : '#b46bff';
        for (let k = 0; k < 3; k++) { g.beginPath(); g.arc((-5 + k * 5) * S, -10 * S, 1.8 * S, 0, TAU); g.fill(); }
        g.fillStyle = '#1a1030';
        g.beginPath(); g.ellipse(0, -20 * S, 10 * S, 2.6 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'popper': {
        g.save();
        g.beginPath(); g.moveTo(-2.5 * S, 0); g.lineTo(2.5 * S, 0); g.lineTo(9 * S, -28 * S); g.lineTo(-9 * S, -28 * S); g.closePath();
        g.clip();
        g.fillStyle = '#ff5fa2'; g.fillRect(-10 * S, -30 * S, 20 * S, 30 * S);
        g.fillStyle = '#ffd23f';
        for (let k = -30; k < 4; k += 7) g.fillRect(-10 * S, k * S, 20 * S, 3 * S);
        g.restore();
        if (!(it && it.lit)) {
          g.fillStyle = '#b46bff';
          g.beginPath(); g.ellipse(0, -28 * S, 9 * S, 2.4 * S, 0, 0, TAU); g.fill();
        }
        g.strokeStyle = '#fff3d6'; g.lineWidth = 1 * S;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4 * S, 4 * S, 8 * S, 2 * S); g.stroke();
        break;
      }
      case 'snake': {
        g.fillStyle = '#1b1820';
        g.beginPath(); g.ellipse(0, -1.5 * S, 7 * S, 3 * S, 0, 0, TAU); g.fill();
        if (it && it.pts && it.pts.length > 1) {
          g.lineCap = 'round'; g.lineJoin = 'round';
          for (const [w, c] of [[6, '#2e2934'], [3.5, '#4a4452'], [1.2, '#7a7084']]) {
            g.strokeStyle = c; g.lineWidth = w * S;
            g.beginPath();
            it.pts.forEach(([x, y], k) => (k ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
            g.stroke();
          }
        }
        break;
      }
      case 'lantern': {
        const on = it && it.lit;
        g.save(); g.translate(0, -16 * S);
        const gr = g.createLinearGradient(0, -18 * S, 0, 16 * S);
        gr.addColorStop(0, on ? '#ffe7a8' : '#efe3cc');
        gr.addColorStop(1, on ? '#ff7a2b' : '#d9c3a0');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-12 * S, -18 * S); g.lineTo(12 * S, -18 * S); g.lineTo(8 * S, 14 * S); g.lineTo(-8 * S, 14 * S); g.closePath(); g.fill();
        g.strokeStyle = on ? 'rgba(160,60,10,0.45)' : 'rgba(120,90,60,0.4)'; g.lineWidth = 0.8 * S;
        for (const x of [-6, 0, 6]) { g.beginPath(); g.moveTo(x * S, -18 * S); g.lineTo(x * 0.7 * S, 14 * S); g.stroke(); }
        g.fillStyle = '#c9a36b';
        g.fillRect(-8 * S, 13 * S, 16 * S, 1.8 * S);
        if (on) { g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(0, 10 * S, 2.2 * S, 3.2 * S, 0, 0, TAU); g.fill(); }
        g.restore();
        break;
      }
      case 'flowerpot': {
        const gr = g.createLinearGradient(-11 * S, 0, 11 * S, 0);
        gr.addColorStop(0, '#8e1026'); gr.addColorStop(0.45, '#e33a4f'); gr.addColorStop(1, '#6d0b1c');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-11 * S, 0); g.lineTo(11 * S, 0); g.lineTo(5 * S, -26 * S); g.lineTo(-5 * S, -26 * S); g.closePath(); g.fill();
        g.fillStyle = '#ffcf6b';
        g.fillRect(-9 * S, -8 * S, 18 * S, 2.5 * S);
        g.fillRect(-6.5 * S, -18 * S, 13 * S, 2 * S);
        g.fillStyle = '#2a1a12';
        g.beginPath(); g.ellipse(0, -26 * S, 5 * S, 1.6 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'chakri': {
        g.save(); g.translate(0, -6 * S); g.scale(1, 0.45);
        g.fillStyle = '#2d2344';
        g.beginPath(); g.arc(0, 0, 12 * S, 0, TAU); g.fill();
        const rot = it ? it.rot : 0.6;
        ['#e33a4f', '#3fbf6f', '#ffcf6b'].forEach((c, i) => {
          g.strokeStyle = c; g.lineWidth = 2.2 * S;
          g.beginPath(); g.arc(0, 0, (10 - i * 3) * S, rot + i, rot + i + 4.2); g.stroke();
        });
        g.fillStyle = '#ffcf6b';
        g.beginPath(); g.arc(0, 0, 2 * S, 0, TAU); g.fill();
        g.restore();
        break;
      }
      case 'rocket': {
        g.fillStyle = 'rgba(70,170,110,0.85)';
        g.beginPath(); g.roundRect(-7 * S, -22 * S, 14 * S, 22 * S, 3 * S); g.fill();
        g.fillRect(-3 * S, -30 * S, 6 * S, 9 * S);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(-5 * S, -19 * S, 2 * S, 15 * S);
        if (!(it && it.fired)) {
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1.2 * S;
          g.beginPath(); g.moveTo(0, -24 * S); g.lineTo(0, -46 * S); g.stroke();
          g.fillStyle = '#e33a4f';
          g.fillRect(-3.5 * S, -62 * S, 7 * S, 16 * S);
          g.fillStyle = '#ffcf6b';
          g.fillRect(-3.5 * S, -52 * S, 7 * S, 2 * S);
          g.beginPath(); g.moveTo(-3.5 * S, -62 * S); g.lineTo(3.5 * S, -62 * S); g.lineTo(0, -70 * S); g.closePath(); g.fill();
        }
        break;
      }
      case 'bomb': {
        const gr = g.createRadialGradient(-4 * S, -15 * S, 1, 0, -11 * S, 12 * S);
        gr.addColorStop(0, '#ff5a6e'); gr.addColorStop(0.5, '#b3122e'); gr.addColorStop(1, '#4a0612');
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, -11 * S, 11 * S, 0, TAU); g.fill();
        g.strokeStyle = '#ffcf6b'; g.lineWidth = 2 * S;
        g.beginPath(); g.ellipse(0, -11 * S, 11 * S, 3.5 * S, 0, 0, Math.PI); g.stroke();
        const f = it && !it.lit ? clamp(t / ITEMS.bomb.fuse, 0, 1) : 0;
        g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.4 * S;
        g.beginPath(); g.moveTo(0, -22 * S); g.quadraticCurveTo(1 * S, -27 * S, (6 * (1 - f) + 2 * f) * S, (-30 + 8 * f) * S); g.stroke();
        break;
      }
      case 'laddi': {
        const popped = it ? it.popped : 0;
        g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
        g.beginPath(); g.moveTo(-66 * S, -4 * S); g.lineTo(62 * S, -4 * S); g.stroke();
        for (let i = popped; i < 24; i++) {
          const x = (-60 + (120 * i) / 23) * S;
          g.save(); g.translate(x, -4 * S); g.rotate(i % 2 ? 0.35 : -0.35);
          g.fillStyle = i % 3 ? '#d7263d' : '#f2a33a';
          g.fillRect(-2 * S, -6 * S, 4 * S, 12 * S);
          g.restore();
        }
        break;
      }
      case 'roman': {
        g.save();
        g.beginPath(); g.rect(-4 * S, -44 * S, 8 * S, 44 * S); g.clip();
        g.fillStyle = '#2f5bd1'; g.fillRect(-4 * S, -44 * S, 8 * S, 44 * S);
        g.strokeStyle = '#f4f1ff'; g.lineWidth = 2.5 * S;
        for (let k = -60; k < 10; k += 9) { g.beginPath(); g.moveTo(-6 * S, k * S); g.lineTo(6 * S, (k - 8) * S); g.stroke(); }
        g.restore();
        g.fillStyle = '#1a1030';
        g.beginPath(); g.ellipse(0, -44 * S, 4 * S, 1.4 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'cake': {
        g.fillStyle = '#c21d3a';
        g.fillRect(-19 * S, -22 * S, 38 * S, 22 * S);
        g.fillStyle = '#ffcf6b';
        g.fillRect(-19 * S, -13 * S, 38 * S, 3 * S);
        g.fillStyle = '#8e1026';
        g.beginPath(); g.moveTo(-19 * S, -22 * S); g.lineTo(19 * S, -22 * S); g.lineTo(15 * S, -27 * S); g.lineTo(-23 * S, -27 * S); g.closePath(); g.fill();
        g.fillStyle = '#1a1030';
        for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
          g.beginPath(); g.ellipse((-15 + c * 7 - r * 2) * S, (-23.5 - r * 2.2) * S, 2.2 * S, 0.9 * S, 0, 0, TAU); g.fill();
        }
        break;
      }
      case 'smoke': {
        g.fillStyle = '#d8d4e4';
        g.beginPath(); g.roundRect(-6 * S, -20 * S, 12 * S, 20 * S, 2 * S); g.fill();
        g.fillStyle = it ? it.color : '#ff4d8d';
        g.fillRect(-6 * S, -14 * S, 12 * S, 6 * S);
        g.fillStyle = '#4a4458';
        g.fillRect(-3 * S, -23 * S, 6 * S, 3 * S);
        break;
      }
      case 'anar': {
        const gr = g.createLinearGradient(-12 * S, 0, 12 * S, 0);
        gr.addColorStop(0, '#b45a00'); gr.addColorStop(0.45, '#ffc23a'); gr.addColorStop(1, '#9a4c00');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-12 * S, 0); g.lineTo(12 * S, 0); g.lineTo(3 * S, -32 * S); g.lineTo(-3 * S, -32 * S); g.closePath(); g.fill();
        g.fillStyle = '#d7263d'; g.fillRect(-10 * S, -9 * S, 20 * S, 3 * S);
        g.fillStyle = '#2fa36b'; g.fillRect(-7 * S, -20 * S, 14 * S, 2.4 * S);
        g.fillStyle = '#2f5bd1';
        for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(dx * S, -15 * S); g.lineTo((dx + 2) * S, -13 * S); g.lineTo(dx * S, -11 * S); g.lineTo((dx - 2) * S, -13 * S); g.closePath(); g.fill(); }
        g.fillStyle = '#2a1a12';
        g.beginPath(); g.ellipse(0, -32 * S, 3 * S, 1.2 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'fountain': {
        const gr = g.createLinearGradient(-6 * S, 0, 6 * S, 0);
        gr.addColorStop(0, '#1c3a9e'); gr.addColorStop(0.5, '#3f6ff0'); gr.addColorStop(1, '#162f80');
        g.fillStyle = gr;
        g.fillRect(-6 * S, -38 * S, 12 * S, 38 * S);
        g.fillStyle = '#ffcf6b';
        for (const y of [-34, -22, -10]) g.fillRect(-6 * S, y * S, 12 * S, 2 * S);
        g.fillStyle = '#e33a4f';
        g.beginPath(); g.arc(0, -16 * S, 2.6 * S, 0, TAU); g.fill();
        g.fillStyle = '#1a1030';
        g.beginPath(); g.ellipse(0, -38 * S, 6 * S, 1.8 * S, 0, 0, TAU); g.fill();
        break;
      }
      case 'basket': {
        const gr = g.createLinearGradient(0, -18 * S, 0, 0);
        gr.addColorStop(0, '#d9a25a'); gr.addColorStop(1, '#8a5a24');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-10 * S, 0); g.lineTo(10 * S, 0); g.lineTo(15 * S, -17 * S); g.lineTo(-15 * S, -17 * S); g.closePath(); g.fill();
        g.save(); g.clip();
        g.strokeStyle = 'rgba(80,45,15,0.55)'; g.lineWidth = 1 * S;
        for (let k = -20; k <= 20; k += 5) {
          g.beginPath(); g.moveTo(k * S, 0); g.lineTo((k + 8) * S, -18 * S); g.stroke();
          g.beginPath(); g.moveTo(k * S, 0); g.lineTo((k - 8) * S, -18 * S); g.stroke();
        }
        g.restore();
        g.fillStyle = '#e8b86a';
        g.beginPath(); g.ellipse(0, -17 * S, 15 * S, 2.4 * S, 0, 0, TAU); g.fill();
        if (!(it && it.lit)) {
          for (const [dx, c] of [[-7, '#ff5fa2'], [0, '#ffd36b'], [7, '#5ff0ff']]) { g.fillStyle = c; g.beginPath(); g.arc(dx * S, -19 * S, 2.4 * S, 0, TAU); g.fill(); }
        }
        break;
      }
      case 'shell': {
        const gr = g.createLinearGradient(-7 * S, 0, 7 * S, 0);
        gr.addColorStop(0, '#1d3c9c'); gr.addColorStop(0.5, '#3a68e8'); gr.addColorStop(1, '#152c78');
        g.fillStyle = gr;
        g.fillRect(-7 * S, -44 * S, 14 * S, 44 * S);
        g.fillStyle = '#ffcf6b';
        for (const y of [-40, -6]) g.fillRect(-7 * S, y * S, 14 * S, 2.2 * S);
        g.save(); g.translate(0, -23 * S);
        g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.2 : 5.5, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(a) * r * S, Math.sin(a) * r * S); }
        g.closePath(); g.fill();
        g.restore();
        if (!(it && it.fired)) {
          g.fillStyle = '#e33a4f';
          g.beginPath(); g.moveTo(-8 * S, -44 * S); g.lineTo(8 * S, -44 * S); g.lineTo(0, -57 * S); g.closePath(); g.fill();
        } else {
          g.fillStyle = '#1a1030';
          g.beginPath(); g.ellipse(0, -44 * S, 7 * S, 2 * S, 0, 0, TAU); g.fill();
        }
        break;
      }
      case 'multishot': {
        g.save(); g.rotate(0.25);
        g.beginPath(); g.rect(-6 * S, -38 * S, 12 * S, 38 * S); g.save(); g.clip();
        g.fillStyle = '#23306e'; g.fillRect(-6 * S, -38 * S, 12 * S, 38 * S);
        PALETTES.rainbow.forEach((c, i) => { g.fillStyle = c; g.fillRect(-6 * S, (-34 + i * 5.5) * S, 12 * S, 2 * S); });
        g.restore();
        g.fillStyle = '#1a1030';
        g.beginPath(); g.ellipse(0, -38 * S, 6 * S, 1.8 * S, 0, 0, TAU); g.fill();
        g.restore();
        break;
      }
      case 'firecracker': {
        const left = it ? Math.ceil(9 * (1 - it.popped / 18)) : 9;
        for (let i = 0; i < left; i++) {
          const x = (-12 + (i % 5) * 6 + (i >= 5 ? 3 : 0)) * S, y = (i >= 5 ? -12 : -5) * S;
          g.save(); g.translate(x, y); g.rotate(-0.5 + (i % 3) * 0.12);
          g.fillStyle = i % 2 ? '#d7263d' : '#b81830';
          g.beginPath(); g.roundRect(-2.4 * S, -6 * S, 4.8 * S, 12 * S, 1.2 * S); g.fill();
          g.restore();
        }
        if (left) {
          g.strokeStyle = '#ffcf6b'; g.lineWidth = 1.4 * S;
          g.beginPath(); g.moveTo(-14 * S, -8 * S); g.lineTo(14 * S, -8 * S); g.stroke();
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo(12 * S, -9 * S); g.quadraticCurveTo(15 * S, -12 * S, 16 * S, -10 * S); g.stroke();
        }
        break;
      }
      case 'rocketcombo': {
        g.fillStyle = '#1f6b46';
        g.beginPath(); g.roundRect(-15 * S, -10 * S, 30 * S, 10 * S, 2 * S); g.fill();
        g.fillStyle = '#ffcf6b'; g.fillRect(-15 * S, -6 * S, 30 * S, 1.6 * S);
        const shots = it ? it.shots : 0;
        ['#e33a4f', '#3fbf6f', '#2f5bd1'].forEach((c, i) => {
          if (i < shots) return;
          const x = (i - 1) * 9 * S;
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo(x, -10 * S); g.lineTo(x, -34 * S); g.stroke();
          g.fillStyle = c; g.fillRect(x - 3 * S, -50 * S, 6 * S, 16 * S);
          g.fillStyle = '#ffcf6b'; g.fillRect(x - 3 * S, -42 * S, 6 * S, 1.6 * S);
          g.fillStyle = c;
          g.beginPath(); g.moveTo(x - 3 * S, -50 * S); g.lineTo(x + 3 * S, -50 * S); g.lineTo(x, -57 * S); g.closePath(); g.fill();
        });
        break;
      }
      case 'finale': {
        const gr = g.createLinearGradient(0, -24 * S, 0, 0);
        gr.addColorStop(0, '#6b2fbf'); gr.addColorStop(1, '#3a1470');
        g.fillStyle = gr;
        g.fillRect(-24 * S, -24 * S, 48 * S, 24 * S);
        g.fillStyle = '#ffcf6b';
        g.fillRect(-24 * S, -15 * S, 48 * S, 3 * S);
        g.fillStyle = '#4a1d8c';
        g.beginPath(); g.moveTo(-24 * S, -24 * S); g.lineTo(24 * S, -24 * S); g.lineTo(20 * S, -29 * S); g.lineTo(-28 * S, -29 * S); g.closePath(); g.fill();
        g.fillStyle = '#1a1030';
        for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) {
          g.beginPath(); g.ellipse((-21 + c * 6.4 - r * 2) * S, (-25.5 - r * 2.2) * S, 2 * S, 0.9 * S, 0, 0, TAU); g.fill();
        }
        g.fillStyle = '#fff3d6';
        g.font = `${10 * S}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('★', 0, -7 * S);
        break;
      }
    }
  }
  const SHADOW_W = { laddi: 68, cake: 22, finale: 26, basket: 15, firecracker: 18, rocketcombo: 16, anar: 13 };
  let dragPreview = null;
  const ringW = (type) => Math.max(18, (HIT[type] || [14])[0] + 4);
  function drawGroundItems() {
    ictx.clearRect(0, 0, W, H);
    if (!groundItems.length && !dragPreview && !confettis.length) return;
    const gctx = ictx; // sprites are redrawn crisply each frame, so they never smear
    for (const it of groundItems) {
      const keep = ITEMS[it.type].keep ?? 0.7;
      gctx.globalAlpha = it.done ? (keep ? Math.max(0, 1 - it.gone / keep) : 0) : 1;
      gctx.save();
      gctx.translate(it.x, it.y - (it.hy || 0));
      drawItemShape(gctx, it.type, it.s * U * 1.3, it);
      gctx.restore();
      if (!it.armed) {
        // Waiting to be lit: a soft pulsing ring invites a tap.
        const S = it.s * U * 1.3, pulse = 0.35 + 0.25 * Math.sin(gameTime * 5 + it.rot);
        gctx.strokeStyle = `rgba(255,210,122,${pulse})`;
        gctx.lineWidth = 1.5;
        gctx.beginPath(); gctx.ellipse(it.x, it.y + 1, ringW(it.type) * S, 5.5 * S, 0, 0, TAU); gctx.stroke();
      }
    }
    if (dragPreview) {
      const s = itemScale(dragPreview.y), S = s * U * 1.3;
      gctx.globalAlpha = 0.6;
      gctx.save();
      gctx.translate(dragPreview.x, dragPreview.y);
      drawItemShape(gctx, dragPreview.type, S, null);
      gctx.restore();
      gctx.globalAlpha = 1;
      gctx.strokeStyle = 'rgba(255,230,170,0.85)';
      gctx.setLineDash([4, 4]);
      gctx.beginPath(); gctx.ellipse(dragPreview.x, dragPreview.y + 1, (ringW(dragPreview.type) + 2) * S, 6 * S, 0, 0, TAU); gctx.stroke();
      gctx.setLineDash([]);
    }
    gctx.globalAlpha = 1;
    drawConfetti();
  }

  // Dock chips use the same drawings as the game.
  function itemIcon(type) {
    const c = document.createElement('canvas'), d = 2;
    c.width = c.height = 34 * d;
    const g = c.getContext('2d');
    g.scale(d, d);
    const S = { rocket: 0.42, roman: 0.62, laddi: 0.22, cake: 0.75, sparkler: 0.6, wheel: 0.52, lantern: 0.72, popper: 0.9, heli: 0.85,
      anar: 0.82, fountain: 0.7, shell: 0.48, multishot: 0.7, firecracker: 0.9, rocketcombo: 0.48, finale: 0.6 }[type] || 0.95;
    g.translate(17, type === 'laddi' ? 19 : type === 'firecracker' ? 26 : 30);
    drawItemShape(g, type, S, null);
    return c.toDataURL();
  }
  const groundList = $('#groundList');
  for (const id of ITEM_ORDER) {
    const b = document.createElement('button');
    b.className = 'shell-chip';
    b.dataset.item = id;
    b.innerHTML = '<span class="ico"><img alt=""></span><span></span>';
    b.dataset.sprite = itemIcon(id); // the drawn cracker, also used while dragging it onto the street
    setChipArt(b, id, () => b.dataset.sprite);
    b.lastChild.textContent = ITEMS[id].label;
    b.title = ITEMS[id].label;
    b.addEventListener('click', () => { settings.item = id; saveSettings(); syncModeUi(); });
    groundList.append(b);
  }
  $('#btnLightAll').addEventListener('click', lightAll);
  $('#btnClearStreet').addEventListener('click', clearStreet);

  // Drag a cracker from the dock onto the street. Vertical drags start a drag; sideways swipes still scroll the list.
  const ghost = document.createElement('img');
  ghost.className = 'drag-ghost';
  ghost.alt = '';
  ghost.hidden = true;
  document.body.append(ghost);
  let chipDrag = null;
  groundList.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('[data-item]');
    if (chip) chipDrag = { type: chip.dataset.item, pid: e.pointerId, sx: e.clientX, sy: e.clientY, on: false, chip, touch: e.pointerType !== 'mouse' };
  });
  window.addEventListener('pointermove', (e) => {
    const d = chipDrag;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.on) {
      const dx = e.clientX - d.sx, dy = d.sy - e.clientY;
      if (dy < 12 || dy < Math.abs(dx)) return;
      d.on = true;
      Sound.resume();
      try { d.chip.setPointerCapture(d.pid); } catch (err) { /* ignore */ }
      ghost.src = d.chip.dataset.sprite || d.chip.querySelector('img').src;
      ghost.hidden = false;
      settings.item = d.type; saveSettings(); syncModeUi();
    }
    // On touch, drop slightly above the finger so the preview stays visible.
    const pt = dropPoint(e.clientX, e.clientY - (d.touch ? 44 : 0));
    dragPreview = pt ? { type: d.type, x: pt[0], y: pt[1] } : null;
    ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    ghost.classList.toggle('over', !!pt);
  });
  const endChipDrag = (e, cancel) => {
    const d = chipDrag;
    if (!d || e.pointerId !== d.pid) return;
    chipDrag = null;
    if (!d.on) return;
    ghost.hidden = true;
    if (!cancel && dragPreview) {
      placeItem(d.type, dragPreview.x, dragPreview.y);
      el.hint.classList.add('gone');
    } else if (!cancel) toast('Drop crackers on the street');
    dragPreview = null;
  };
  window.addEventListener('pointerup', (e) => endChipDrag(e, false));
  window.addEventListener('pointercancel', (e) => endChipDrag(e, true));

  // ---------- Sparkler writing ----------
  let pen = null;
  const strokes = []; // {x, y, c, id}
  let strokeId = 0;
  const SPARK_COLORS = { gold: '#ffcf6b', white: '#fff4dc', pink: '#ff6ec7', cyan: '#6ff3ff', rainbow: '' };
  function penColor() {
    if (settings.spark === 'rainbow') return `hsl(${(pen.hue += 1.2) % 360},100%,68%)`;
    return SPARK_COLORS[settings.spark] || SPARK_COLORS.gold;
  }
  function paintSegment(x0, y0, x1, y1, c) {
    const g = pctx;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = c;
    g.globalAlpha = 0.09; g.lineWidth = 18 * U;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.globalAlpha = 0.4; g.lineWidth = 6.5 * U;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.95; g.strokeStyle = '#fffaf0'; g.lineWidth = Math.max(1.5, 2.4 * U);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.globalAlpha = 1;
  }
  function repaintStrokes() {
    pctx.clearRect(0, 0, W, H);
    for (let i = 1; i < strokes.length; i++) {
      const a = strokes[i - 1], b = strokes[i];
      if (a.id === b.id) paintSegment(a.x, a.y, b.x, b.y, b.c);
    }
  }
  function penSparks(x, y, n) {
    curLayer = 1;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU, v = rand(60, 320) * U;
      spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.6 ? '#fff4dc' : (settings.spark === 'rainbow' ? pick(GOLD) : SPARK_COLORS[settings.spark]), rand(0.1, 0.4));
    }
    if (Math.random() < 0.12) star(x, y, rand(-120, 120) * U, rand(-120, 60) * U, '#ffe7b0', rand(0.15, 0.3), { drag: 2, size: 1.1, onDeath: (p) => { curLayer = 1; crackleBurst(p.x, p.y); curLayer = 0; } });
    curLayer = 0;
  }
  function penDown(x, y) {
    strokeId++;
    pen = { x, y, hue: rand(0, 360) };
    strokes.push({ x, y, c: penColor(), id: strokeId });
    penSparks(x, y, 8);
    Sound.sparklerStart();
  }
  function penMove(x, y) {
    if (!pen) return;
    const d = Math.hypot(x - pen.x, y - pen.y);
    if (d < 1.5) return;
    const c = penColor();
    paintSegment(pen.x, pen.y, x, y, c);
    if (strokes.length < 8000) strokes.push({ x, y, c, id: strokeId });
    penSparks(x, y, Math.min(10, 1 + d / 6));
    pen.x = x; pen.y = y;
  }
  function penUp() { pen = null; Sound.sparklerStop(); }
  let sparkTool = 'pen', eraser = null, strokesDirty = false;
  function sparkDown(x, y) {
    if (sparkTool === 'erase') { eraser = { x, y }; eraseAt(x, y); } else penDown(x, y);
  }
  function sparkMove(x, y) {
    if (eraser) { eraser.x = x; eraser.y = y; eraseAt(x, y); } else penMove(x, y);
  }
  function sparkUp() { eraser = null; if (pen) penUp(); }
  // Removes light under the eraser and splits strokes where a gap was rubbed out.
  function eraseAt(x, y) {
    const r = 24 * U, out = [];
    let lastOrig = null, cur = null, brk = false, changed = false;
    for (const p of strokes) {
      if (p.id !== lastOrig) { lastOrig = p.id; cur = p.id; brk = false; }
      if (Math.hypot(p.x - x, p.y - y) < r) { changed = true; brk = true; continue; }
      if (brk) { cur = ++strokeId; brk = false; }
      p.id = cur;
      out.push(p);
    }
    if (!changed) return;
    strokes.length = 0;
    strokes.push(...out);
    strokesDirty = true;
  }
  function undoStroke() {
    if (!strokes.length) { toast('Nothing to undo'); return; }
    const id = strokes[strokes.length - 1].id;
    while (strokes.length && strokes[strokes.length - 1].id === id) strokes.pop();
    repaintStrokes();
  }
  function setSparkTool(t) {
    sparkTool = t;
    document.querySelectorAll('#sparkFloat [data-tool]').forEach((b) => {
      const on = b.dataset.tool === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  document.querySelectorAll('#sparkFloat [data-tool]').forEach((b) => b.addEventListener('click', () => setSparkTool(b.dataset.tool)));
  $('#btnUndo').addEventListener('click', undoStroke);
  function updateSparkler(dt) {
    if (strokesDirty) { repaintStrokes(); strokesDirty = false; }
    if (pen) {
      penSparks(pen.x, pen.y, Math.round(4 * Q().count));
      if (Math.random() < dt * 5) Sound.crackle(pan(pen.x));
    }
    // Written strokes keep twinkling
    if (strokes.length && playMode === 'spark') {
      curLayer = 1;
      for (let i = 0; i < 3; i++) {
        const p = strokes[(Math.random() * strokes.length) | 0];
        spark(p.x, p.y, rand(-40, 40) * U, rand(-40, 30) * U, '#fff4dc', rand(0.1, 0.3));
      }
      curLayer = 0;
    }
  }
  function drawPenHead() {
    if (eraser) {
      gctx.globalCompositeOperation = 'source-over';
      gctx.globalAlpha = 1;
      gctx.fillStyle = 'rgba(255,255,255,0.08)';
      gctx.strokeStyle = 'rgba(255,255,255,0.75)';
      gctx.lineWidth = 1.5;
      gctx.beginPath(); gctx.arc(eraser.x, eraser.y, 24 * U, 0, TAU); gctx.fill(); gctx.stroke();
      gctx.globalCompositeOperation = 'lighter';
    }
    if (!pen) return;
    const r = 26 * U * rand(0.85, 1.15);
    glowAt(pen.x, pen.y, '#fff1c8', r, 0.9);
    glowAt(pen.x, pen.y, SPARK_COLORS[settings.spark] || '#ff6ec7', r * 2.2, 0.25);
  }
  function clearWriting() { strokes.length = 0; pctx.clearRect(0, 0, W, H); }
  // Turns the written light into a burst of fireworks.
  function lightUpWriting() {
    if (!strokes.length) { toast('Write something first, then light it up'); return; }
    Sound.resume();
    let cx = 0, cy = 0;
    const step = Math.max(1, Math.floor(strokes.length / 600));
    curLayer = 1;
    for (let i = 0; i < strokes.length; i += step) {
      const p = strokes[i], ang = Math.random() * TAU, v = rand(40, 220) * U;
      cx += p.x; cy += p.y;
      star(p.x, p.y, Math.cos(ang) * v, Math.sin(ang) * v - 40 * U, settings.spark === 'rainbow' ? p.c : pick([p.c, ...palette]), rand(1, 1.9),
        { drag: 1.4, grav: 0.8, size: 2, glitter: 0.3 });
    }
    const n = Math.ceil(strokes.length / step);
    flash(cx / n, cy / n, '#fff1d0', 2.5, gctx);
    curLayer = 0;
    Sound.lastBurst = 0;
    Sound.burst(1.6, pan(cx / n));
    Sound.crackle(pan(cx / n));
    addLight('#ffe6b8', 2.5);
    bumpMeter(15);
    buzz(40);
    achieve('signed');
    clearWriting();
  }
  const sparkColors = $('#sparkColors');
  for (const id in SPARK_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.spark = id;
    b.title = `${id[0].toUpperCase()}${id.slice(1)} sparkler`;
    b.setAttribute('aria-label', b.title);
    b.style.background = id === 'rainbow' ? 'conic-gradient(#ff4d6d,#ffb347,#ffe66d,#4dff9a,#4dc3ff,#b06bff,#ff4d6d)' : SPARK_COLORS[id];
    b.addEventListener('click', () => { settings.spark = id; saveSettings(); syncModeUi(); });
    sparkColors.append(b);
  }
  $('#btnSparkClear').addEventListener('click', clearWriting);
  $('#btnSparkBurst').addEventListener('click', lightUpWriting);

  function syncModeUi() {
    groundList.querySelectorAll('[data-item]').forEach((c) => c.classList.toggle('active', c.dataset.item === settings.item));
    sparkColors.querySelectorAll('[data-spark]').forEach((c) => c.classList.toggle('active', c.dataset.spark === settings.spark));
  }
  syncModeUi();
  setPlayMode('sky');

  // ---------- Achievements ----------
  const ACH = [
    ['first', '🧨', 'First spark', 'Light your first cracker'],
    ['chain', '💥', 'Chain reaction', 'Let a bomb set off another cracker'],
    ['festival', '🎉', 'Festival street', 'Have 5 crackers burning at once'],
    ['collector', '🧺', 'Collector', 'Light every kind of cracker'],
    ['signed', '✍️', 'Signed in light', 'Write something and light it up'],
    ['combo', '⚡', 'Spectacular', 'Reach an 8× launch combo in the sky'],
    ['level3', '🌌', 'Sky ablaze', 'Reach level 3'],
    ['card', '💌', 'Card sender', 'Play a greeting card show'],
  ];
  let achieved = {};
  try { achieved = JSON.parse(localStorage.getItem('luts:ach') || '{}') || {}; } catch (e) { achieved = {}; }
  function achieve(id) {
    if (achieved[id]) return;
    achieved[id] = Date.now();
    try { localStorage.setItem('luts:ach', JSON.stringify(achieved)); } catch (e) { /* ignore */ }
    const a = ACH.find((x) => x[0] === id);
    if (a) toast(`🏅 Achievement unlocked: ${a[2]}`, 3200);
    renderAch();
  }
  function renderAch() {
    const list = $('#achList');
    list.innerHTML = '';
    for (const [id, icon, name, desc] of ACH) {
      const li = document.createElement('li');
      li.className = achieved[id] ? 'done' : '';
      const i = document.createElement('span'); i.className = 'ach-icon'; i.textContent = icon;
      const tx = document.createElement('span'); tx.className = 'ach-text';
      const b = document.createElement('b'); b.textContent = name;
      const sm = document.createElement('small'); sm.textContent = desc;
      tx.append(b, sm);
      li.append(i, tx);
      list.append(li);
    }
    $('#achCount').textContent = `${ACH.filter(([id]) => achieved[id]).length}/${ACH.length}`;
  }
  renderAch();

  // ---------- AR camera mode ----------
  // The live camera replaces the painted sky, so fireworks burst over the viewer's real surroundings.
  const cam = $('#cam');
  let arOn = false, arStream = null, facing = 'environment';
  function drawCamera(g, w, h) {
    const vw = cam.videoWidth, vh = cam.videoHeight;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    if (!vw) return;
    const s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s;
    g.save();
    if (facing === 'user') { g.translate(w, 0); g.scale(-1, 1); }
    g.filter = 'brightness(0.78) saturate(1.1)';
    g.drawImage(cam, (w - dw) / 2, (h - dh) / 2, dw, dh);
    g.restore();
  }
  function stopStream() {
    if (arStream) arStream.getTracks().forEach((t) => t.stop());
    arStream = null;
  }
  async function startAR() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast(window.isSecureContext ? 'This browser has no camera access' : 'AR needs a secure (https://) link to use the camera', 5000);
      return;
    }
    stopStream();
    try {
      arStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      });
    } catch (e) {
      toast(e && e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in your browser to use AR.' : 'Could not start the camera', 5000);
      if (!arOn) return;
      return stopAR();
    }
    cam.srcObject = arStream;
    cam.play().catch(() => {});
    const first = !arOn;
    arOn = true;
    document.body.classList.add('ar');
    cam.classList.toggle('mirror', facing === 'user');
    $('#btnFlip').hidden = false;
    $('#btnAR').setAttribute('aria-pressed', 'true');
    drawCity();
    drawFloor();
    if (first) toast('AR on: point your camera at the sky and tap to launch', 3500);
  }
  function stopAR() {
    stopStream();
    cam.srcObject = null;
    arOn = false;
    document.body.classList.remove('ar');
    $('#btnFlip').hidden = true;
    $('#btnAR').setAttribute('aria-pressed', 'false');
    drawCity();
    drawFloor();
  }
  const toggleAR = () => { Sound.resume(); arOn ? stopAR() : startAR(); };
  $('#btnAR').addEventListener('click', toggleAR);
  $('#setAR').addEventListener('click', () => { closeDrawer(); toggleAR(); });
  $('#btnFlip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startAR(); });

  // ---------- Worlds of India: background manager ----------
  // Landmark scenes are painted into the #sky canvas, so the fireworks canvas stays in front of them and photos and
  // videos (composite) include them automatically. Nothing here touches bursts, level, achievements or sound.
  const WORLD_DIR = 'assets/worlds/';
  const WORLD_KEY = 'luts:world';
  const MIN_SKY = 0.3; // open sky kept above the roofline, as a fraction of the screen height
  let worldStripH = 0, worldGroundCache = 0;
  // Where the landmark stands: just above the bottom controls and the Choose Your World strip. The strip's space is
  // kept in every play mode, so switching between Sky, Ground and Sparkler never moves the scene.
  function worldGround(portrait) {
    const fallback = H * (portrait ? 0.8 : 0.86), tabs = $('#modeTabs');
    if (document.body.classList.contains('ui-hidden')) return fallback;
    if (!tabs.offsetParent) return worldGroundCache || fallback; // tabs hidden during a card show
    const strip = $('#worldStrip');
    if (strip.offsetHeight) worldStripH = strip.offsetHeight + 8;
    // Wide screens let the strip overlap the reflection a little, so the landmark keeps its size.
    const reserve = window.matchMedia && matchMedia('(max-height: 560px)').matches ? 0 : worldStripH * (portrait ? 1 : 0.5);
    return (worldGroundCache = clamp(tabs.getBoundingClientRect().top - reserve - 4, H * 0.5, fallback));
  }
  const worldImages = new Map(); // decoded landmark images, most recently used last
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const thumbSrc = (cfg, ext) => `${WORLD_DIR}thumb/${cfg.thumb || cfg.image}.${ext}`;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        if (!im.naturalWidth) { reject(new Error(`Empty image ${src}`)); return; }
        // Decode before first use so drawing it never stalls a frame.
        (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(im));
      };
      im.onerror = () => reject(new Error(`Could not load ${src}`));
      im.src = src;
    });
  }

  // WebP first; JPEG covers browsers without WebP. Rejects when neither loads, so the caller keeps the current sky.
  function loadWorldBackground(id) {
    const cfg = WORLD_BY_ID[id];
    if (!cfg || !cfg.image) return Promise.reject(new Error(`No image for world ${id}`));
    if (worldImages.has(id)) {
      const im = worldImages.get(id);
      worldImages.delete(id); worldImages.set(id, im);
      return Promise.resolve(im);
    }
    const base = `${WORLD_DIR}bg/${cfg.image}`;
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out loading ${base}`)), 20000));
    return Promise.race([loadImage(`${base}.webp`).catch(() => loadImage(`${base}.jpg`)), timeout]).then((im) => {
      worldImages.set(id, im);
      while (worldImages.size > 3) worldImages.delete(worldImages.keys().next().value);
      return im;
    });
  }

  // Fades the image's edges to transparent where it meets the blurred backdrop (only when it doesn't fill the screen).
  function featherImage(img, sides, top) {
    if (!sides && !top) return img;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const m = c.getContext('2d');
    m.drawImage(img, 0, 0);
    m.globalCompositeOperation = 'destination-in';
    if (sides) {
      const gr = m.createLinearGradient(0, 0, c.width, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.1, '#000'); gr.addColorStop(0.9, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = gr; m.fillRect(0, 0, c.width, c.height);
    }
    if (top) {
      const gr = m.createLinearGradient(0, 0, 0, c.height);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.18, '#000');
      m.fillStyle = gr; m.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }

  function drawWorldSky(g) {
    const c = world.cfg, img = world.img, iw = img.naturalWidth, ih = img.naturalHeight, [fx, fy] = c.focus;
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#04050d';
    g.fillRect(0, 0, W, H);
    // A heavily blurred copy (a 24px thumbnail scaled up) fills any area the sharp image doesn't reach.
    if (!world.blur) {
      const b = document.createElement('canvas');
      b.width = 24; b.height = Math.max(2, Math.round((24 * ih) / iw));
      b.getContext('2d').drawImage(img, 0, 0, b.width, b.height);
      world.blur = b;
    }
    const sCover = Math.max(W / iw, H / ih);
    g.globalAlpha = 0.6;
    g.drawImage(world.blur, (W - iw * sCover) * fx, (H - ih * sCover) * fy, iw * sCover, ih * sCover);
    g.globalAlpha = 1;
    // Place the landmark in the lower part of the scene: about 85% of the screen wide (at least full width on phones),
    // its base just above the bottom controls, capped in height so its roofline leaves MIN_SKY of open sky above.
    const portrait = H > W, ground = worldGround(portrait);
    const span = c.keep[1] - c.keep[0];
    const sWide = Math.max((W * 0.85) / (span * iw), portrait ? W / iw : 0);
    const sTall = (H * (portrait ? 0.62 : 0.86)) / ih;
    const sSky = fy > c.skyline ? (ground * fy - H * MIN_SKY) / (ih * (fy - c.skyline)) : sTall;
    const s = Math.min(sWide, sTall, sSky);
    const dw = iw * s, dh = ih * s;
    const dx = (W - dw) * fx, dy = (ground - dh) * fy;
    const sides = dw < W - 1, top = dy > 1, key = `${sides}|${top}`;
    if (world.maskKey !== key) { world.masked = featherImage(img, sides, top); world.maskKey = key; }
    g.drawImage(world.masked, dx, dy, dw, dh);
    // Below the landmark, a dimmed mirror image reads as water or a wet street under the controls.
    const base = dy + dh;
    if (base < H - 0.5) {
      g.save();
      g.beginPath(); g.rect(0, base, W, H - base); g.clip();
      g.translate(0, base * 2); g.scale(1, -1);
      g.globalAlpha = 0.5;
      g.drawImage(world.masked, dx, dy, dw, dh);
      g.restore();
      const water = g.createLinearGradient(0, base, 0, H);
      water.addColorStop(0, 'rgba(3,4,14,0.3)');
      water.addColorStop(1, 'rgba(3,4,14,0.85)');
      g.fillStyle = water;
      g.fillRect(0, base, W, H - base);
    }

    // Darken the sky above the roofline so real fireworks out-shine the painted ones, then dim slightly overall.
    const roof = dy + dh * c.skyline, k = c.overlay, skyH = Math.max(roof, H * 0.2);
    const shade = g.createLinearGradient(0, 0, 0, skyH);
    shade.addColorStop(0, `rgba(3,4,14,${0.35 + 0.5 * k})`);
    shade.addColorStop(0.7, `rgba(3,4,14,${0.42 * k})`);
    shade.addColorStop(1, 'rgba(3,4,14,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, skyH);
    g.fillStyle = `rgba(2,3,10,${0.08 + 0.14 * k})`;
    g.fillRect(0, 0, W, H);
    const foot = g.createLinearGradient(0, H * 0.75, 0, H);
    foot.addColorStop(0, 'rgba(3,4,12,0)');
    foot.addColorStop(1, 'rgba(3,4,12,0.5)');
    g.fillStyle = foot;
    g.fillRect(0, H * 0.75, W, H * 0.25);
    const rnd = mulberry(7), n = Math.round((W * skyH) / 4200);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * skyH * 0.9;
      const r = rnd() < 0.06 ? 0.9 + rnd() * 0.7 : 0.3 + rnd() * 0.5;
      g.fillStyle = `rgba(255,248,235,${(0.2 + rnd() * 0.6) * (1 - y / skyH)})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.restore();
    world.rect = { dx, dy, dw, dh, roof };
  }

  // Sacred sites: bursts aimed over the structure are lifted proportionally into the open sky above its roofline,
  // so the show frames the building rather than appearing to happen on it.
  function worldSkyY(x, y) {
    const r = world.rect, [k0, k1] = world.cfg.keep, pad = 30 * U;
    if (x < r.dx + r.dw * k0 - pad || x > r.dx + r.dw * k1 + pad) return y;
    const top = H * 0.06, ceil = r.roof - H * 0.07;
    if (ceil <= top) return top;
    return y <= top ? y : Math.min(y, top + (y - top) * ((ceil - top) / (H * 0.78 - top)));
  }

  // The user's colour theme, or the landmark's celebration colours when they have switched those on.
  function basePalette() {
    const p = premium.active && world.preset && world.cfg.preset;
    return p ? p.colors : PALETTES[settings.theme] || PALETTES.classic;
  }
  function releaseWorldPreset() {
    if (!world.preset) return;
    world.preset = false;
    saveWorld();
    syncWorldUi();
  }
  function saveWorld() {
    try { localStorage.setItem(WORLD_KEY, JSON.stringify({ id: world.id, preset: world.preset })); } catch (e) { /* ignore */ }
  }

  // Cross-fades a copy of the old layer over the new one, so a switch never shows a blank or half-drawn frame.
  function snapshotLayer(src) {
    const c = document.createElement('canvas');
    c.className = 'scene-fade';
    c.width = src.width; c.height = src.height;
    c.style.zIndex = getComputedStyle(src).zIndex;
    c.getContext('2d').drawImage(src, 0, 0);
    src.after(c);
    return c;
  }
  function applyWorld(cfg, img) {
    document.querySelectorAll('.scene-fade').forEach((f) => f.remove()); // rapid switching: one fade at a time
    const fades = arOn || reduceMotion() ? [] : [snapshotLayer(skyC), snapshotLayer(cityC)];
    world.id = cfg.id; world.cfg = cfg; world.img = img;
    world.blur = world.masked = null; world.maskKey = '';
    drawSky(); drawCity(); drawFloor();
    if (mode !== 'card' && mode !== 'envelope') palette = basePalette();
    if (fades.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => fades.forEach((f) => f.classList.add('out'))));
      setTimeout(() => fades.forEach((f) => f.remove()), 900);
    }
    syncWorldUi();
  }

  // Switches scene without restarting anything. A landmark only replaces the sky once its image has loaded;
  // if loading fails the current scene stays and nothing is saved.
  function selectWorld(id, { silent = false } = {}) {
    const cfg = WORLD_BY_ID[id] || WORLD_BY_ID.default;
    if (cfg.id === world.id && !world.pending) return Promise.resolve(true);
    if (worldLocked(cfg)) { if (!silent) openPremium({ world: cfg.id }); return Promise.resolve(false); }
    if (!cfg.image) {
      world.pending = null;
      document.querySelectorAll('.world-card.loading, .world-mini.loading').forEach((b) => setCardLoading(b.dataset.world, false));
      applyWorld(cfg, null);
      saveWorld();
      if (!silent) toast('Back to the classic night sky');
      return Promise.resolve(true);
    }
    if (world.pending && world.pending !== cfg.id) setCardLoading(world.pending, false);
    const token = world.pending = cfg.id;
    setCardLoading(cfg.id, true);
    return loadWorldBackground(cfg.id).then((img) => {
      if (world.pending !== token) return false; // superseded by a newer choice
      world.pending = null;
      applyWorld(cfg, img);
      saveWorld();
      if (!silent) toast(`${cfg.name} · ${cfg.place}`);
      return true;
    }, () => {
      if (world.pending !== token) return false;
      world.pending = null;
      if (!silent) toast(`Couldn’t load ${cfg.name}. Keeping your current sky.`, 3200);
      return false;
    }).finally(() => { if (world.pending !== token) setCardLoading(cfg.id, false); syncWorldUi(); });
  }

  function restoreSelectedWorld() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(WORLD_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved || typeof saved !== 'object') return;
    world.preset = saved.preset === true;
    syncWorldUi();
    if (typeof saved.id !== 'string' || !WORLD_BY_ID[saved.id] || saved.id === 'default') return;
    // A Premium landmark waits until the store confirms the subscription (see onPremiumState).
    if (worldLocked(WORLD_BY_ID[saved.id])) premium.intent = { world: saved.id, quiet: true };
    else selectWorld(saved.id, { silent: true });
  }

  // Selector panel
  const worldPanel = $('#worldPanel'), worldGrid = $('#worldGrid'), worldPresetInput = $('#setWorldPreset');
  function buildWorldGrid() {
    if (worldGrid.childElementCount) return;
    for (const cfg of WORLDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'world-card';
      b.dataset.world = cfg.id;
      b.setAttribute('aria-label', `${cfg.name}, ${cfg.place}`);
      const thumb = document.createElement('span');
      thumb.className = 'world-thumb';
      const pic = document.createElement('picture');
      const webp = document.createElement('source');
      webp.type = 'image/webp';
      webp.srcset = thumbSrc(cfg, 'webp');
      const im = document.createElement('img');
      im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.width = 300; im.height = 270;
      im.src = thumbSrc(cfg, 'jpg');
      pic.append(webp, im);
      // A few animated bursts in the landmark's colours preview how the show looks against it.
      const preview = document.createElement('span');
      preview.className = 'world-preview';
      preview.setAttribute('aria-hidden', 'true');
      const cols = cfg.preset ? cfg.preset.colors : PALETTES.classic;
      for (let i = 0; i < 3; i++) { const s = document.createElement('i'); s.style.setProperty('--c', cols[(i * 2) % cols.length]); preview.append(s); }
      const badge = document.createElement('span');
      badge.className = 'world-badge';
      badge.textContent = '✓ Selected';
      const lock = document.createElement('span');
      lock.className = 'world-lock';
      lock.innerHTML = CROWN_SVG + 'Premium';
      const spin = document.createElement('span');
      spin.className = 'world-spinner';
      spin.setAttribute('aria-hidden', 'true');
      thumb.append(pic, preview, badge, lock, spin);
      const meta = document.createElement('span');
      meta.className = 'world-meta';
      const name = document.createElement('b');
      name.textContent = cfg.name;
      const place = document.createElement('small');
      place.textContent = cfg.place;
      meta.append(name, place);
      const foot = document.createElement('span');
      foot.className = 'world-card-foot';
      const sw = document.createElement('span');
      sw.className = 'world-sw';
      if (cfg.preset) {
        sw.title = cfg.preset.name;
        for (const col of cfg.preset.colors.slice(0, 4)) { const i = document.createElement('i'); i.style.background = col; sw.append(i); }
      }
      const cta = document.createElement('span');
      cta.className = 'world-cta';
      foot.append(sw, cta);
      b.append(thumb, meta, foot);
      b.addEventListener('click', () => selectWorld(cfg.id));
      worldGrid.append(b);
    }
  }
  // Main-screen strip: one tap switches the scene; its header opens the full panel.
  const worldStripList = $('#worldStripList');
  let stripShown = '';
  function buildWorldStrip() {
    for (const cfg of WORLDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'world-mini';
      b.dataset.world = cfg.id;
      b.setAttribute('aria-label', `${cfg.name}, ${cfg.place}`);
      const thumb = document.createElement('span');
      thumb.className = 'world-mini-thumb';
      const pic = document.createElement('picture');
      const webp = document.createElement('source');
      webp.type = 'image/webp';
      webp.srcset = thumbSrc(cfg, 'webp');
      const im = document.createElement('img');
      im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.width = 84; im.height = 52;
      im.src = thumbSrc(cfg, 'jpg');
      pic.append(webp, im);
      const spin = document.createElement('span');
      spin.className = 'world-spinner';
      spin.setAttribute('aria-hidden', 'true');
      const lock = document.createElement('span');
      lock.className = 'world-lock';
      lock.innerHTML = CROWN_SVG;
      lock.title = 'Premium';
      thumb.append(pic, lock, spin);
      const name = document.createElement('b');
      name.textContent = cfg.image ? cfg.name : 'Night Sky';
      const place = document.createElement('small');
      place.textContent = cfg.place;
      b.append(thumb, name, place);
      b.addEventListener('click', () => selectWorld(cfg.id));
      worldStripList.append(b);
    }
  }
  buildWorldStrip();
  function setCardLoading(id, on) {
    document.querySelectorAll(`.world-card[data-world="${id}"], .world-mini[data-world="${id}"]`).forEach((b) => {
      b.classList.toggle('loading', on);
      b.setAttribute('aria-busy', String(on));
      const cta = b.querySelector('.world-cta');
      if (on && cta) cta.textContent = 'Loading…';
    });
  }
  function syncWorldUi() {
    const cfg = world.cfg;
    $('#worldEntryName').textContent = cfg.image ? `${cfg.name} · ${cfg.place}` : cfg.name;
    $('#worldEntryThumb').src = thumbSrc(cfg, 'jpg');
    $('#skylineNote').hidden = !world.img;
    worldGrid.querySelectorAll('.world-card').forEach((b) => {
      const on = b.dataset.world === world.id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
      const locked = worldLocked(WORLD_BY_ID[b.dataset.world]);
      b.classList.toggle('locked', locked);
      if (!b.classList.contains('loading')) b.querySelector('.world-cta').textContent = on ? 'Selected' : locked ? 'Unlock' : 'Select';
    });
    worldStripList.querySelectorAll('.world-mini').forEach((b) => {
      const on = b.dataset.world === world.id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('locked', worldLocked(WORLD_BY_ID[b.dataset.world]));
      if (on && stripShown !== world.id) {
        stripShown = world.id;
        worldStripList.scrollTo({ left: b.offsetLeft - (worldStripList.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
      }
    });
    // The saved preference survives a lapsed subscription, but the switch only shows it while Premium is active.
    worldPresetInput.checked = world.preset && premium.active;
    $('#worldPresetNote').textContent = !premium.active ? 'Premium · match firework colours to the landmark'
      : !cfg.preset ? 'Pick a landmark to use its colours'
        : world.preset ? `Using ${cfg.preset.name.toLowerCase()} colours` : 'Match firework colours to the landmark';
    $('#btnWorldReset').disabled = world.id === 'default' && !world.pending;
  }

  let worldReturnFocus = null;
  function openWorldSelector(e) {
    buildWorldGrid();
    syncWorldUi();
    // The drawer covers phones edge to edge; close it so the new scene is visible behind the sheet.
    closeDrawer();
    const from = e && e.currentTarget;
    worldReturnFocus = from && !from.closest('#settings') ? from : $('#btnSettings');
    worldPanel.hidden = false;
    const sel = worldGrid.querySelector('.world-card.selected') || worldGrid.firstElementChild;
    requestAnimationFrame(() => { sel.scrollIntoView({ block: 'nearest', inline: 'center' }); sel.focus({ preventScroll: true }); });
  }
  function closeWorldSelector() {
    if (worldPanel.hidden) return;
    worldPanel.hidden = true;
    if (worldReturnFocus) worldReturnFocus.focus({ preventScroll: true });
  }
  $('#btnWorlds').addEventListener('click', openWorldSelector);
  $('#btnWorldStrip').addEventListener('click', openWorldSelector);
  $('#btnCloseWorlds').addEventListener('click', closeWorldSelector);
  // Taps on the dimmed backdrop close the sheet; they never reach #stage, so they can't launch fireworks.
  worldPanel.addEventListener('click', (e) => { if (e.target === worldPanel) closeWorldSelector(); });
  $('#btnWorldReset').addEventListener('click', () => selectWorld('default'));
  worldPresetInput.addEventListener('change', () => {
    if (worldPresetInput.checked && !premium.active) {
      worldPresetInput.checked = false;
      openPremium({ colours: true });
      return;
    }
    world.preset = worldPresetInput.checked;
    if (mode !== 'card' && mode !== 'envelope') palette = basePalette();
    saveWorld();
    syncWorldUi();
  });
  // While the sheet is open it owns the keyboard: Escape closes only the sheet, focus stays inside it,
  // and game shortcuts (Space, F, 1–9…) are held back.
  document.addEventListener('keydown', (e) => {
    const sheet = !premiumPanel.hidden ? premiumPanel : !worldPanel.hidden ? worldPanel : null;
    if (!sheet) return;
    if (e.key === 'Escape') { e.preventDefault(); if (sheet === premiumPanel) closePremium(); else closeWorldSelector(); }
    else if (e.key === 'Tab') {
      const items = [...sheet.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), a[href]:not([hidden])')];
      const first = items[0], lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastItem.focus(); }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
    }
    e.stopImmediatePropagation();
  }, true);

  // ---------- Premium: paywall ----------
  // In the apps, the KMP shell talks to the stores through RevenueCat and sends its state via window.LUTSNative.
  // The web version has no store, so its paywall points to the apps instead.
  const PREMIUM_LINKS = {
    play: 'https://play.google.com/store/apps/details?id=com.stalinpusparaj.lightuptheskies',
    appStore: '', // https://apps.apple.com/app/id… once the iOS app is live
    terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    privacy: 'https://stalinpusparaj.github.io/light-up-the-skies/privacy.html',
    manage: { android: 'https://play.google.com/store/account/subscriptions?package=com.stalinpusparaj.lightuptheskies', ios: 'https://apps.apple.com/account/subscriptions' },
  };
  const PLAN_NAMES = { annual: 'Yearly', monthly: 'Monthly', lifetime: 'Lifetime', other: 'Premium' };
  const PREMIUM_HERO = ['golden-temple', 'hawa-mahal', 'mysore-palace', 'gateway-of-india', 'meenakshi-amman-temple', 'victoria-memorial'];
  const premiumPanel = $('#premiumPanel'), premiumPlans = $('#premiumPlans');
  const nativeApp = window.LUTSNative;
  const storeAccount = () => (nativeApp && nativeApp.platform === 'ios' ? 'Apple ID' : 'Google Play account');
  const trialWords = (t) => { const [n, unit] = t.split('-'); return `${n} ${unit}${n === '1' ? '' : 's'}`; };
  const selectedPlan = () => premium.plans.find((p) => p.kind === premium.pick) || premium.plans[0] || null;
  let premiumReturnFocus = null;

  function renderPremiumHero() {
    const hero = $('#premiumHero'), id = premium.intent && premium.intent.world;
    hero.innerHTML = '';
    hero.classList.toggle('single', !!id);
    for (const wid of id ? [id] : PREMIUM_HERO) {
      const cfg = WORLD_BY_ID[wid];
      const pic = document.createElement('picture');
      const webp = document.createElement('source');
      webp.type = 'image/webp';
      webp.srcset = id ? `${WORLD_DIR}bg/${cfg.image}.webp` : thumbSrc(cfg, 'webp');
      const im = document.createElement('img');
      im.alt = ''; im.decoding = 'async';
      im.src = id ? `${WORLD_DIR}bg/${cfg.image}.jpg` : thumbSrc(cfg, 'jpg');
      pic.append(webp, im);
      hero.append(pic);
    }
  }

  function fineprint(p) {
    const per = p.kind === 'annual' ? 'year' : p.kind === 'monthly' ? 'month' : '';
    const price = per ? `${p.price}/${per}` : p.price;
    const start = p.trial ? `Free for ${trialWords(p.trial)}, then ${price}. You won’t be charged until the trial ends.` : `${price}, charged to your ${storeAccount()} when you confirm.`;
    return `${start} Renews automatically until cancelled. Cancel anytime in your ${storeAccount()} settings, at least 24 hours before the renewal date.`;
  }

  function renderPaywall() {
    if (premiumPanel.hidden) return;
    const web = premium.status === 'web', busy = ['loading', 'purchasing', 'restoring'].includes(premium.status);
    const intent = premium.intent || {}, intentWorld = intent.world && WORLD_BY_ID[intent.world];
    $('#premiumTitle').textContent = intentWorld ? `Unlock ${intentWorld.name}` : intent.colours ? 'Unlock Celebration Colours' : 'Unlock all of India';
    $('#premiumGet').hidden = !web;
    for (const node of [premiumPlans, $('#btnPremiumBuy'), $('#premiumFine'), $('#btnPremiumRestore')]) node.hidden = web;
    $('#premiumPlay').href = PREMIUM_LINKS.play;
    $('#premiumAppStore').hidden = !PREMIUM_LINKS.appStore;
    if (PREMIUM_LINKS.appStore) $('#premiumAppStore').href = PREMIUM_LINKS.appStore;
    $('#premiumTerms').href = PREMIUM_LINKS.terms;
    $('#premiumPrivacy').hidden = !PREMIUM_LINKS.privacy;
    if (PREMIUM_LINKS.privacy) $('#premiumPrivacy').href = PREMIUM_LINKS.privacy;
    $('#premiumStatus').textContent = web ? '' : premium.message;
    if (web) return;

    premiumPlans.innerHTML = '';
    premiumPlans.classList.toggle('loading', premium.status === 'loading' && !premium.plans.length);
    const chosen = selectedPlan();
    for (const p of premium.plans) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'premium-plan' + (p === chosen ? ' on' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(p === chosen));
      const name = document.createElement('span');
      name.className = 'premium-plan-name';
      name.textContent = PLAN_NAMES[p.kind] || 'Premium';
      if (p.kind === 'annual' && premium.plans.length > 1) { const tag = document.createElement('em'); tag.textContent = 'Best value'; name.append(tag); }
      const price = document.createElement('span');
      price.className = 'premium-plan-price';
      price.textContent = p.kind === 'annual' ? `${p.price} / year` : p.kind === 'monthly' ? `${p.price} / month` : p.price;
      const sub = document.createElement('small');
      sub.textContent = [p.trial ? `${p.trial} free trial` : '', p.perMonth ? `just ${p.perMonth} / month` : ''].filter(Boolean).join(' · ');
      b.append(name, price, sub);
      b.addEventListener('click', () => { premium.pick = p.kind; renderPaywall(); });
      premiumPlans.append(b);
    }
    const cta = $('#btnPremiumBuy'), unavailable = premium.status === 'unavailable';
    cta.disabled = busy || (!chosen && !unavailable);
    cta.classList.toggle('busy', premium.status === 'purchasing' || premium.status === 'restoring');
    cta.textContent = unavailable ? 'Try again' : premium.status === 'loading' ? 'Loading plans…'
      : !chosen ? 'Continue' : chosen.trial ? `Start ${chosen.trial} free trial` : 'Subscribe';
    $('#premiumFine').textContent = chosen ? fineprint(chosen) : '';
    $('#btnPremiumRestore').disabled = busy;
  }

  function openPremium(intent) {
    premium.intent = intent || null;
    premium.message = '';
    premiumReturnFocus = document.activeElement;
    closeDrawer();
    premiumPanel.hidden = false;
    renderPremiumHero();
    renderPaywall();
    if (nativeApp && (!premium.plans.length || premium.status === 'unavailable' || premium.status === 'error')) nativeApp.premium('plans');
    requestAnimationFrame(() => $('#btnClosePremium').focus({ preventScroll: true }));
  }
  function closePremium() {
    if (premiumPanel.hidden) return;
    premiumPanel.hidden = true;
    premium.intent = null;
    if (premiumReturnFocus && premiumReturnFocus.focus) premiumReturnFocus.focus({ preventScroll: true });
  }
  function celebrate() {
    for (let i = 0; i < 5; i++) after(i * 0.22, () => launchShell({ x: W * (0.15 + 0.175 * i), y: H * rand(0.14, 0.3), type: pick(['kamuro', 'chrysanthemum', 'peony']), size: 1.1 }));
  }
  function syncPremiumRow() {
    const on = premium.active, manage = $('#premiumManage');
    $('#premiumRow').classList.toggle('on', on);
    $('#premiumRowNote').textContent = on ? 'Active · every landmark unlocked' : 'All 13 landmarks + Celebration Colours';
    $('#btnPremiumRow').hidden = on;
    manage.hidden = !on || !nativeApp;
    if (on && nativeApp) manage.href = premium.manageUrl || PREMIUM_LINKS.manage[nativeApp.platform] || PREMIUM_LINKS.manage.android;
  }

  // Subscription started or ended: apply what the player was trying to unlock, or step back to the free tier.
  function premiumChanged(was) {
    if (premium.active) {
      const it = premium.intent;
      if (it && it.world) selectWorld(it.world, { silent: true }); // the welcome message speaks for it
      if (it && it.colours) { world.preset = true; saveWorld(); }
    } else if (was && worldLocked(world.cfg)) {
      selectWorld('default', { silent: true });
    }
    if (mode !== 'card' && mode !== 'envelope') palette = basePalette();
  }
  function onPremiumState(s) {
    if (!s || typeof s !== 'object') return;
    const was = premium.active;
    premium.status = s.status || 'ready';
    premium.manageUrl = s.manageUrl || null;
    if (Array.isArray(s.plans) && s.plans.length) premium.plans = s.plans;
    if (s.known) {
      premium.active = !!s.active;
      try { localStorage.setItem('luts:premium', premium.active ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    premium.message = s.status === 'unavailable'
      ? (s.message === 'not-configured' ? 'Premium isn’t set up in this build yet.' : 'Purchases aren’t available right now. Check your connection and try again.')
      : s.status === 'error' ? (s.message || 'Something went wrong. Please try again.')
        : s.event === 'pending' ? 'Your payment is processing. Premium unlocks as soon as it completes.'
          : s.event === 'nothing-to-restore' ? 'No active subscription was found for this account.' : '';
    if (premium.active !== was) premiumChanged(was);
    if (s.event === 'purchased' || s.event === 'restored') {
      closePremium();
      toast(s.event === 'purchased' ? 'Welcome to Premium ✨ All of India is unlocked' : 'Premium restored. Every landmark is yours again.', 3200);
      celebrate();
    }
    renderPaywall();
    syncWorldUi();
    syncPremiumRow();
  }

  $('#btnPremiumRow').addEventListener('click', () => openPremium(null));
  $('#btnClosePremium').addEventListener('click', closePremium);
  premiumPanel.addEventListener('click', (e) => { if (e.target === premiumPanel) closePremium(); });
  $('#btnPremiumBuy').addEventListener('click', () => {
    if (!nativeApp) return;
    const plan = selectedPlan();
    if (premium.status === 'unavailable' || !plan) { nativeApp.premium('plans'); return; }
    premium.message = '';
    nativeApp.premium('purchase', plan.id);
  });
  $('#btnPremiumRestore').addEventListener('click', () => { if (nativeApp) nativeApp.premium('restore'); });
  window.addEventListener('luts:premium', (e) => onPremiumState(e.detail));
  if (nativeApp && nativeApp.lastPremium) onPremiumState(nativeApp.lastPremium);
  syncPremiumRow();

  // ---------- Native app shell (Android / iOS) ----------
  // The KMP app injects window.LUTSNative before this script runs. Fullscreen means nothing inside the app, and card
  // links only work when the app knows the public web address of the game, so those controls adapt there.
  if (window.LUTSNative) {
    document.body.classList.add('in-app');
    if (!window.LUTSNative.shareBase) {
      $('#btnCopyLink').hidden = true;
      $('#btnShare').hidden = true;
      $('#linkNote').textContent = 'Tap “Play the show”, then “Save video” to share it.';
    }
  }

  // ---------- Boot ----------
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pointer = null; });

  resize();
  syncSettingsUi();
  syncWorldUi();
  restoreSelectedWorld();
  incoming = readHash();
  if (incoming) { $('#intro').hidden = true; showEnvelope(incoming); }
  if (document.fonts && document.fonts.load) {
    for (const font of ['800 40px Outfit', '300 16px Outfit', '40px "Great Vibes"']) document.fonts.load(font).catch(() => {});
  }
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
