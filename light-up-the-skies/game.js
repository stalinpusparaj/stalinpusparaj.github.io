/* Light Up the Skies — interactive fireworks show + greeting cards */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;
  const ANDROID_WEBVIEW = !!(window.LUTSNative && window.LUTSNative.platform === 'android');
  if (ANDROID_WEBVIEW) document.documentElement.classList.add('android-webview');
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
    shell: 'random', size: 3, theme: 'classic', quality: 'low', skyLight: 'normal',
    longExposure: false, skyline: true, sound: true, volume: 0.7,
    item: 'flowerpot', spark: 'gold', view3d: false, signVideos: true,
  };
  const settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('luts:settings') || '{}');
    for (const k in DEFAULTS) if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) settings[k] = saved[k];
  } catch (e) { /* storage unavailable */ }
  const saveSettings = () => { try { localStorage.setItem('luts:settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };
  saveSettings(); // Discard legacy auto/finale preferences during migration.

  const QUALITY = {
    low: { dpr: 1, count: 0.7, glitter: 0.12, maxStars: 160 },
    normal: { dpr: 1.5, count: 1, glitter: 0.4, maxStars: 420 },
    high: { dpr: 2, count: 1.4, glitter: 0.7, maxStars: 850 },
  };
  let measuredTier = 2, slowFor = 0, fastFor = 0, frameMean = 16.7;
  // A tier that once ran too slowly is never tried again this session, so a weak phone settles instead of bouncing
  // between tiers (each switch reallocates every full-screen canvas, which itself stalls for a few hundred ms).
  let failedTier = 3;
  const CARD_QUALITY = {
    low: { dpr: 1, count: 0.55, glitter: 0.45, maxStars: 2600 },
    normal: { dpr: 1.5, count: 1, glitter: 1, maxStars: 5500 },
    high: { dpr: 2, count: 1.4, glitter: 1.3, maxStars: 9000 },
  };
  const Q = () => (mode === 'card' ? CARD_QUALITY : QUALITY)[['low', 'normal', 'high'][Math.min(measuredTier, Math.max(0, ['low', 'normal', 'high'].indexOf(settings.quality)))]];
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
    // live: an animated scene drawn by particle-sky.js instead of a photo; always the festival night.
    { id: 'particle-festival', name: 'Particle Festival', place: 'Animated night', image: null, live: true, thumb: 'particle-festival',
      preset: { name: 'Diya glow', colors: ['#ffd36b', '#ff8fb8', '#fff1c9', '#c9a6ff', '#ffb347'] } },
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
    { id: 'velankanni-basilica', name: 'Velankanni Basilica', place: 'Velankanni', image: 'velankanni-basilica', focus: [0.42, 1], skyline: 0.22, keep: [0.25, 0.66], overlay: 0.5, sacred: true,
      preset: { name: 'Basilica lights', colors: ['#fff4e0', '#ffd36b', '#ff4a6a', '#4a8dff', '#ff9fd0'] } },
    { id: 'cross-by-the-sea', name: 'Cross by the Sea', place: 'Tamil Nadu coast', image: 'cross-by-the-sea', focus: [0.62, 1], skyline: 0.16, keep: [0.38, 0.86], overlay: 0.5, sacred: true,
      preset: { name: 'Sea of light', colors: ['#ffd36b', '#fff4e0', '#ff5fa2', '#4aa8ff', '#ffb347'] } },
  ];
  const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
  const isWorld = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(WORLD_BY_ID, id);
  // img is null for the default painted sky. rect is the landmark's on-screen placement, set by drawWorldSky().
  const world = { id: 'default', cfg: WORLD_BY_ID.default, img: null, rect: null, preset: false, pending: null, blur: null, masked: null, maskKey: '' };

  // ---------- Premium: what's free ----------
  // Free: the classic sky, Taj Mahal and India Gate. Premium (a subscription in the Android and iOS apps) unlocks the
  // other landmarks, Celebration Colours and cracker replays. Each cracker has one persistent free ignition.
  const FREE_WORLDS = new Set(['default', 'particle-festival', 'taj-mahal', 'india-gate']);
  // status: web (no store here) | loading | ready | purchasing | restoring | error | unavailable
  const premium = { active: false, status: window.LUTSNative ? 'loading' : 'web', plans: [], pick: 'annual', intent: null, manageUrl: null, message: '' };
  let crackerEntitled = false; // A known native store response grants cracker replays.
  // In the app, start from the last state the store confirmed, so a subscriber's landmark shows at once, even offline.
  if (window.LUTSNative) { try { premium.active = localStorage.getItem('luts:premium') === '1'; } catch (e) { /* storage unavailable */ } }
  // Google Play reviewers can't buy subscriptions, so a code given to them in Play Console unlocks Premium on that
  // device (tap the Settings title 7 times). Only the code's SHA-256 is here; the code itself is in mobile/reviewer-code.txt.
  const REVIEWER_HASH = 'aa1dd98c26cbea88ede1bfc82fbd1a072ca0af1998190ea7e6f21ca7a9f641ed';
  let reviewerAccess = false;
  try { reviewerAccess = localStorage.getItem('luts:reviewer') === '1'; } catch (e) { /* storage unavailable */ }
  if (reviewerAccess) premium.active = true;
  const worldLocked = (cfg) => !premium.active && !FREE_WORLDS.has(cfg.id);
  const CROWN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-10-4.6 4.2L12 5l-2.8 7.2L4.6 8z"/></svg>';
  let runningGroundEffect = false, frameRaf = 0, rewardBusy = false;
  const camera = { x: 0, y: 0, zoom: 1, travel: 0 };
  const launch = new window.LUTSLaunchController({
    storage: { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) },
    locks: navigator.locks,
    premium: () => crackerEntitled,
    prepare: prepareLaunch,
    ignite: igniteLaunch,
    changed: syncLaunchUi,
    blocked: () => { $('#crackerTrial').hidden = false; $('#btnTrialPremium').focus(); },
    failed: () => { clearScene(); toast('Could not start. Check device storage and try again.'); },
  });

  // ---------- Canvas setup ----------
  const skyC = $('#sky'), fxC = $('#fx'), cityC = $('#city');
  // Front layers: street floor, sparkler light-painting and ground effects all sit in front of the skyline.
  const floorC = $('#floor'), itemsC = $('#items'), paintC = $('#paint'), gfxC = $('#gfx');
  const atmoC = $('#atmo'), actx = atmoC.getContext('2d'); // 3D view: embers drifting in front of everything
  const fctx = floorC.getContext('2d'), ictx = itemsC.getContext('2d'), pctx = paintC.getContext('2d'), gctx = gfxC.getContext('2d');
  let curLayer = 0; // 0 = sky (behind city), 1 = ground (in front)
  let curDim = 1; // brightness of the stars being made: far bursts are dimmer (3D view)
  let curScale = 1; // size of the effects being made: a far cracker's sparks, smoke and glow are smaller (atDepth)
  const sctx = skyC.getContext('2d');
  const ctx = fxC.getContext('2d');
  const cctx = cityC.getContext('2d');
  const skyGlow = $('#skyGlow');
  const flightC = document.createElement('canvas'), flightCtx = flightC.getContext('2d');
  // Under the sky glow, so a burst's glow tints the flight starfield and the sky alike (no seam between them).
  flightC.id = 'flightClouds'; flightC.setAttribute('aria-hidden', 'true'); skyGlow.before(flightC);
  // The moon has its own layer: it is far away, so during a flight it drifts like the distant stars
  // instead of sliding down with the sky (which cut its halo against the flight starfield).
  const moonC = document.createElement('canvas'), moonCtx = moonC.getContext('2d');
  moonC.id = 'moon'; moonC.setAttribute('aria-hidden', 'true'); flightC.after(moonC);
  let cloudSprite = null, flightStars = null;
  let W = 0, H = 0, DPR = 1, U = 1;
  // Particle Festival world: animated offscreen and copied onto the sky layer, so fireworks, the 3D view, photos and
  // recorded videos treat it like any other sky. It is always night (lanterns, sparklers, diyas); ?tod=<hour> previews
  // the scene at another time of day (7 dawn, 13 noon, 18.5 dusk).
  const liveSky = window.LUTSParticleSky ? window.LUTSParticleSky.create({
    // Low-memory phones get the lightest scene; the WebView often hides deviceMemory, so 4 GB is assumed there.
    tier: settings.quality === 'low' || (navigator.deviceMemory || 4) <= 3 ? 0 : ANDROID_WEBVIEW ? 1 : undefined,
    maxDpr: ANDROID_WEBVIEW ? 1 : undefined,
    onDraw: (c) => { if (liveShown()) sctx.drawImage(c, 0, 0, W, H); },
  }) : null;
  if (liveSky) {
    const tod = new URLSearchParams(location.search).get('tod');
    liveSky.setHour(tod != null && tod !== '' && !Number.isNaN(+tod) ? +tod : 22);
  }
  // The menu keeps the classic night sky; the animated world only shows once the show starts.
  const liveShown = () => world.cfg.live && !!liveSky && !arOn && !document.body.classList.contains('home');
  const syncLiveSky = () => { if (liveSky) (liveShown() && !document.hidden ? liveSky.start() : liveSky.stop()); };

  const targetDpr = () => Math.min(window.devicePixelRatio || 1, Q().dpr, ANDROID_WEBVIEW ? 0.85 : Infinity);
  function setTier(tier) {
    const before = targetDpr();
    measuredTier = tier; slowFor = fastFor = 0;
    if (targetDpr() !== before) resize(); // the particle budgets follow Q() on their own; only sharpness needs new canvases
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${H}px`); // vh units resolve to 0 in the app's WebView
    // Android WebView devices can report a dense screen while the emulator/GPU still has to
    // rasterize every canvas pixel. Keep effects crisp, but avoid a multi-canvas 1080x2400 frame.
    DPR = targetDpr();
    U = clamp(Math.min(W, H * 1.25) / 800, 0.5, 1.6);
    for (const c of [skyC, fxC, cityC, floorC, itemsC, paintC, gfxC, atmoC, flightC, moonC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    for (const g of [sctx, ctx, cctx, fctx, ictx, pctx, gctx, actx, flightCtx, moonCtx]) g.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = gctx.lineCap = pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    drawFloor();
    repaintStrokes();
    drawSky();
    drawCity();
  }

  function drawSky() {
    const g = sctx;
    glSky.dirty = true;
    moonCtx.clearRect(0, 0, W, H);
    if (world.img) { drawWorldSky(g); drawWorldDepth(); return; }
    world.rect = null;
    if (liveShown()) { liveSky.drawNow(); return; }
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
    moonCtx.fillStyle = halo;
    moonCtx.beginPath(); moonCtx.arc(mx, my, mr * 6, 0, TAU); moonCtx.fill();
    // Crescent: cut the shadow out on a scratch canvas so only the lit sliver lands on the sky.
    const mc = document.createElement('canvas'), ms = Math.ceil(mr * 2 + 4);
    mc.width = mc.height = ms;
    const m = mc.getContext('2d');
    m.fillStyle = '#f3ecdc';
    m.beginPath(); m.arc(ms / 2, ms / 2, mr, 0, TAU); m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath(); m.arc(ms / 2 + mr * 0.42, ms / 2 - mr * 0.2, mr * 0.92, 0, TAU); m.fill();
    moonCtx.drawImage(mc, mx - ms / 2, my - ms / 2);
  }

  function drawCity() {
    const g = cctx;
    g.clearRect(0, 0, W, H);
    // A landmark scene brings its own skyline, so the painted city is only drawn over the default sky.
    if (!settings.skyline || arOn || world.img || liveShown()) return;
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
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars) return null;
    o = o || {};
    const p = starPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y;
    p.vx = vx; p.vy = vy;
    p.color = col; p.life = life; p.age = 0;
    p.w = o.w || Math.max(1, (o.size || 2.2) * U);
    p.k = o.drag || 1.5;
    p.grav = o.grav ?? 1;
    if (launch.sequence && !launch.sequence.ground) {
      p.life = Math.min(4.5, life * 1.24); p.grav *= 0.7;
    } else if (launch.sequence && launch.sequence.ground) {
      p.vy *= 1.2; p.vx *= 1.08;
    }
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
    p.dim = o.dim ?? curDim;
    p.sc = curScale;
    if (curScale !== 1) { p.vx *= curScale; p.vy *= curScale; p.w *= curScale; }
    p.floorY = o.floorY || 0;
    stars.push(p);
    return p;
  }

  function spark(x, y, vx, vy, col, life) {
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars) return;
    const p = sparkPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y; p.vx = vx * curScale; p.vy = vy * curScale; p.color = col; p.life = life; p.age = 0; p.L = curLayer;
    p.sc = curScale; p.dim = curDim;
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
    random: 'random', peony: 'peony', chrysanthemum: 'chrysanthemum', willow: 'willow', palm: 'palm', ring: 'ring', crossette: 'crossette',
    crackle: 'crackle', strobe: 'strobe-shell', horsetail: 'horsetail', kamuro: 'kamuro', kaleido: 'kaleido', smile: 'smile',
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
    if (mode === 'play' && !rush.on && !o.tap && (!launch.sequence || !launch.sequence.ground || !runningGroundEffect)) return;
    if (launch.state !== 'READY' && (mode !== 'play' || rush.on)) return;
    const sz = o.size ?? sizeScale();
    const tx = clamp(o.x ?? rand(W * 0.12, W * 0.88), 16, W - 16);
    let ty = clamp(o.y ?? rand(H * 0.1, H * 0.42), H * 0.05, H * 0.78);
    if (world.rect && world.cfg.sacred && !o.exact && o.type !== 'text' && o.type !== 'photo') ty = worldSkyY(tx, ty);
    const sx = o.sx ?? (o.straight ? tx : clamp(tx + rand(-50, 50) * U, 0, W));
    // 3D view: the show's own shells burst at different distances; your taps, words and photos burst right here.
    const z = o.z ?? (!view.on() || o.user || o.straight || o.type === 'text' || o.type === 'photo' ? 1 : rand(0.72, 1.06));
    const sy = o.sy ?? H + 8;
    const g = 900 * U * (o.fast || 1);
    const vy = -Math.sqrt(2 * g * (sy - ty));
    const t = -vy / g;
    shells.push({
      x: sx, y: sy, px: sx, py: sy, vx: (tx - sx) / t, vy, g, age: 0,
      type: o.type, size: sz * z, z, c1: o.c1, c2: o.c2, text: o.text, textH: o.textH, hold: o.hold, user: !!o.user,
      img: o.img, r: o.r, L: o.L || 0,
    });
    Sound.lift(pan(sx), t, o.whistle);
  }

  function burstShell(s) {
    const [c1, c2raw] = [s.c1 || color(), s.c2 || color()];
    let c2 = c2raw;
    if (c2 === c1 && palette.length > 1) c2 = palette[(palette.indexOf(c1) + 1) % palette.length];
    const special = s.type === 'text' || s.type === 'photo';
    const z = s.z || 1;
    flash(s.x, s.y, c1, special ? 1.4 : s.size);
    curDim = Math.min(1, 0.45 + 0.55 * z);
    if (s.type === 'text') textBurst(s.x, s.y, s);
    else if (s.type === 'photo') photoBurst(s.x, s.y, s);
    else TYPES[resolveType(s.type)].fn(s.x, s.y, s.size, c1, c2, s);
    curDim = 1;
    addLight(c1, (special ? 1.5 : s.size) * z);
    Sound.burst(special ? 1.3 : s.size, pan(s.x), Math.max(0, (1 - z) * 0.6));
    onBurst(s);
  }

  function flash(x, y, c, sz, cx = ctx) {
    const r = 80 * U * sz * curScale;
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.18, rgba(c, 0.4));
    g.addColorStop(1, rgba(c, 0));
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = curDim;
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
    cx.globalAlpha = 1;
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
    ctx: null, out: null, comp: null, music: null, bus: null, noise: null, recDest: null,
    dist: 1, // loudness for sounds made now: far crackers are quieter (atDepth)
    lastBurst: 0, lastCrackle: 0, lastPop: 0, lastLift: 0,
    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); } catch (e) { return false; }
      const c = this.ctx;
      this.voices = new Set(); this.outputs = new Set();
      for (const method of ['createBufferSource', 'createOscillator']) {
        const create = c[method].bind(c);
        c[method] = (...args) => {
          const voice = create(...args); this.voices.add(voice);
          voice.addEventListener('ended', () => {
            voice.disconnect(); this.voices.delete(voice);
            if (!this.voices.size) { for (const node of this.outputs) node.disconnect(); this.outputs.clear(); }
          }, { once: true });
          return voice;
        };
      }
      this.out = c.createGain();
      this.out.gain.value = settings.sound ? settings.volume : 0;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 6;
      // A card's music joins beside the compressor (so bursts don't pump the song); a gentle limiter on the shared bus
      // keeps the two together from clipping. Recordings tap the bus, so saved videos carry both.
      this.music = c.createGain();
      this.music.gain.value = settings.sound ? 1 : 0;
      this.bus = c.createDynamicsCompressor();
      this.bus.threshold.value = -2; this.bus.knee.value = 0; this.bus.ratio.value = 20;
      this.bus.attack.value = 0.003; this.bus.release.value = 0.25;
      this.out.connect(this.comp); this.comp.connect(this.bus); this.music.connect(this.bus); this.bus.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      return true;
    },
    resume() { if (this.init() && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
    apply() {
      if (!this.ctx) return;
      this.out.gain.setTargetAtTime(settings.sound ? settings.volume : 0, this.ctx.currentTime, 0.05);
      this.music.gain.setTargetAtTime(settings.sound ? 1 : 0, this.ctx.currentTime, 0.05);
    },
    ready() { return this.ctx && settings.sound && this.ctx.state === 'running' && !paused && !document.hidden && this.voices.size < 10; },
    dest(p) {
      const c = this.ctx;
      let to = this.out;
      if (this.dist < 0.999) { const g = c.createGain(); g.gain.value = this.dist; g.connect(to); to = g; this.outputs.add(g); }
      if (!c.createStereoPanner) return to;
      const n = c.createStereoPanner();
      n.pan.value = clamp(p, -1, 1) * 0.75;
      n.connect(to);
      this.outputs.add(n);
      return n;
    },
    noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },
    burst(size, p, delay = 0) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime + 0.01 + delay;
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

  // Audio failures must not interrupt a visual sequence or hold its launch lock.
  for (const method of ['resume', 'lift', 'burst', 'crackle', 'hiss', 'thump', 'tick', 'snap', 'bang', 'sparklerStart', 'sparklerStop', 'pop']) {
    const original = Sound[method];
    if (typeof original === 'function') Sound[method] = function (...args) {
      try { return original.apply(this, args); } catch (_) { return undefined; }
    };
  }

  // ---------- Game state ----------
  let mode = 'intro'; // intro | play | envelope | card
  let paused = false, gameTime = 0;
  let meter = 0, level = 1, bursts = 0, combo = 0, lastUserBurst = -9, finaleUntil = 0;
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
    if (rush.on) { if (s.user) rushBurst(s); return; } // a Lantern Rush scores its own way
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
    delete el.toast.dataset.badge; // only achievement toasts are tappable (achieve sets it again)
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
    showCombo('Sky ablaze!', `level ${level}`);
  }

  // ---------- Update & render ----------
  let pointer = null, idleClear = 0;
  // On the home screen a single shell goes up now and then behind the title.
  let homeShotAt = 0;

  function update(dt) {
    gameTime += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].t <= gameTime) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    }
    if (mode === 'intro' && launch.state === 'READY' && gameTime >= homeShotAt) {
      homeShotAt = gameTime + rand(3.5, 5.5);
      launchShell({ type: 'shell', x: rand(W * 0.2, W * 0.8), y: rand(H * 0.18, H * 0.42), straight: true });
    }
    updateLaunch(dt);

    updateGround(dt);
    if (mode === 'play' && playMode === 'spark' && launch.state === 'READY') updateSparkler(dt);
    updateRush(dt);

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
      if (p.age > p.hold) p.vy += g * p.grav * p.sc * dt;
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
      p.vx *= e; p.vy = p.vy * e + g * 0.7 * p.sc * dt;
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
    drawRush();
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
    let sparkleIndex = 0;
    for (const p of stars) {
      const left = p.life - p.age;
      let a = Math.min(1, left / (p.life * p.fade));
      if (p.strobe && p.age > 0.35 && ((p.age * p.strobe) | 0) % 2) continue;
      if (p.twinkle) a *= 0.6 + Math.random() * 0.4;
      const g = p.L ? gctx : ctx;
      g.globalAlpha = a * p.dim;
      g.strokeStyle = p.color2 && p.age > p.life * p.change ? p.color2 : p.color;
      g.lineWidth = p.w;
      g.beginPath();
      g.moveTo(p.px, p.py);
      g.lineTo(p.x + 0.01, p.y);
      g.stroke();
      if (launch.sequence && (sparkleIndex++ % 7 === 0)) {
        const r = Math.max(3.5, p.w * 2.4);
        g.globalAlpha *= 0.4;
        g.drawImage(smokeSprite(p.color.startsWith('#') ? p.color : '#ffd27a'), p.x - r, p.y - r, r * 2, r * 2);
      }
    }

    // Sparks
    ctx.lineWidth = gctx.lineWidth = Math.max(1, 1.2 * U);
    for (const p of sparks) {
      const g = p.L ? gctx : ctx;
      g.globalAlpha = (1 - p.age / p.life) * p.dim;
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
    if (document.hidden) { frameRaf = 0; return; }
    frameRaf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    frameMean += ((now - last) - frameMean) * 0.025;
    slowFor = frameMean > 38 ? slowFor + dt : 0;
    fastFor = frameMean < 24 ? fastFor + dt : 0;
    if (slowFor > 2 && measuredTier > 0) { failedTier = measuredTier; setTier(measuredTier - 1); }
    else if (fastFor > 12 && measuredTier + 1 < failedTier) setTier(measuredTier + 1);
    last = now;
    if (!paused) {
      fade(dt);
      try { update(dt); draw(); drawLaunch(); renderGlow(dt); applyShake(dt); updateView(dt); }
      catch (error) { abortLaunch(); console.error('Launch renderer failed', error); }
    }
    if (rec) recordFrame(now);
  }

  // ---------- Input ----------
  const stage = $('#stage');
  function userLaunch(x, y) {
    if (!rush.on) return requestFire();
    const [dx, dy] = layerShift(VIEW_DEPTH.fx);
    x -= dx; y -= dy;
    // In a Lantern Rush the shell flies fast and bursts exactly where you tapped, so aiming is fair over every landmark.
    launchShell({ x, y: clamp(y, H * 0.08, H * 0.72), type: mode === 'card' ? 'random' : settings.shell, user: true, exact: rush.on, fast: rush.on ? 1.7 : 1 });
  }
  stage.addEventListener('pointerdown', (e) => {
    Sound.resume();
    askMotion();
    if (paused || pointer) return;
    if (launch.state !== 'READY') return;
    // Only a sky shell needs a floor spot to launch from; sparkler drawing and ground crackers use the
    // tap/drag they always have, right over the live camera.
    if (roomAr && mode === 'play' && playMode === 'sky' && !rush.on) { window.LUTSAndroid.arcore('place', `${Math.round(e.clientX)},${Math.round(e.clientY)}`); return; }
    const kind = mode === 'play' ? playMode : 'sky';
    if (kind === 'sky' && tapSkyOn()) { tapFire(e.clientX, e.clientY); return; }
    if (kind !== 'spark' && !rush.on) {
      if (nativeRecording === 'recording') userLaunch(e.clientX, e.clientY);
      return;
    }
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
    if (e.key === 'Escape') { $('#rewardsPanel').hidden = true; $('#crackerTrial').hidden = true; closeDrawer(); closeCardModal(); closeSheets(); return; }
    if (mode === 'intro' || mode === 'envelope') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); togglePause(); }
    else if (k === 's') toggleSound();
    else if (k === 'h') toggleUi();
    else if (/^[1-9]$/.test(k) && mode === 'play' && playMode === 'sky') setShell(DOCK_ORDER[+k - 1]);
    else if (k === '0' && mode === 'play') setShell(DOCK_ORDER[9]);
  });

  // ---------- Controls ----------
  function togglePause(force) {
    paused = typeof force === 'boolean' ? force : !paused;
    holdMusic(paused);
    if (pen) penUp();
    pointer = null;
    document.body.classList.toggle('paused', paused);
    $('#btnPause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    $('#setPause').setAttribute('aria-pressed', String(paused));
    $('#setPause').lastChild.textContent = paused ? 'Resume' : 'Pause';
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
  $('#btnPause').addEventListener('click', () => togglePause());
  $('#btnSound').addEventListener('click', toggleSound);
  $('#btnFull').addEventListener('click', toggleFullscreen);
  $('#btnShowUi').addEventListener('click', toggleUi);
  $('#btnPhoto').addEventListener('click', takeScreenshot);
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
    if (launch.state !== 'READY') return;
    settings.shell = id;
    saveSettings();
    syncSettingsUi();
    syncLaunchUi();
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
    $('#setLong').checked = settings.longExposure;
    $('#set3d').checked = settings.view3d;
    $('#setSign').checked = settings.signVideos;
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
  bind('#setShell', 'change', (t) => { if (launch.state === 'READY') { settings.shell = t.value; syncLaunchUi(); } });
  bind('#setSize', 'input', (t) => { settings.size = +t.value; });
  bind('#setQuality', 'change', (t) => { settings.quality = t.value; resize(); });
  bind('#setSkyLight', 'change', (t) => { settings.skyLight = t.value; lastGlowA = -1; });
  bind('#setLong', 'change', (t) => { settings.longExposure = t.checked; });
  bind('#set3d', 'change', (t) => { settings.view3d = t.checked; if (t.checked) askMotion(); });
  bind('#setSign', 'change', (t) => { settings.signVideos = t.checked; });
  bind('#setSkyline', 'change', (t) => { settings.skyline = t.checked; drawCity(); });
  bind('#setSound', 'change', (t) => { settings.sound = t.checked; Sound.resume(); Sound.apply(); });
  bind('#setVolume', 'input', (t) => { settings.volume = +t.value; Sound.apply(); });
  $('#setPhoto').addEventListener('click', () => { closeDrawer(); savePhoto(); });
  $('#setRec').addEventListener('click', () => { closeDrawer(); toggleRecording(); });
  $('#setFull').addEventListener('click', toggleFullscreen);
  $('#setHide').addEventListener('click', () => { closeDrawer(); toggleUi(); });
  $('#setPause').addEventListener('click', () => { closeDrawer(); togglePause(); });
  $('#setBirthdays').addEventListener('click', () => $('#btnBirthdays').click());
  $('#setJoy').addEventListener('click', () => $('#btnJoy').click());
  $('#setReset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS);
    if (mode !== 'card') palette = basePalette();
    saveSettings(); resize(); Sound.apply(); syncSettingsUi();
    toast('Settings reset');
  });

  function openDrawer() { updateHomeTiles(); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  $('#btnSettings').addEventListener('click', () => (drawer.classList.contains('open') ? closeDrawer() : openDrawer()));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    const which = b.dataset.close;
    if (which === 'settings') closeDrawer(); else if (which === 'cardModal') closeCardModal(); else closeSheet($('#' + which));
  }));
  stage.addEventListener('pointerdown', closeDrawer);

  // ---------- Photo & video ----------
  function composite(g, w, h) {
    if (launch.sequence) {
      if (arOn) drawCamera(g, w, h);
      else { g.fillStyle = '#020309'; g.fillRect(0, 0, w, h); }
      for (const c of [skyC, flightC, moonC, fxC, cityC, floorC, itemsC, paintC, gfxC]) {
        if ((c === skyC || c === moonC) && arOn) continue;
        const matrix = new DOMMatrix(c.style.transform || undefined);
        g.save(); g.scale(w / W, h / H);
        g.translate(W / 2, H / 2); g.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); g.translate(-W / 2, -H / 2);
        g.drawImage(c, 0, 0, W, H); g.restore();
      }
      drawGreeting(g, w / W, h / H);
      return;
    }
    // Each layer where the 3D view has moved it (screen shake stays out of photos and videos).
    const layer = (c, d, s = 1) => {
      const [dx, dy] = layerShift(d);
      g.drawImage(c, (w - w * s) / 2 + (dx * w) / W, (h - h * s) / 2 + (dy * h) / H, w * s, h * s);
    };
    if (arOn) drawCamera(g, w, h);
    else if (view.active && world.img && glSky.ready) g.drawImage(glSky.c, 0, 0, w, h);
    else { layer(skyC, VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky)); layer(moonC, VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky)); }
    const a = glowAlpha();
    if (a > 0) { g.fillStyle = `rgba(${gR | 0},${gG | 0},${gB | 0},${a * 0.6})`; g.globalCompositeOperation = 'screen'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
    layer(fxC, VIEW_DEPTH.fx);
    layer(cityC, VIEW_DEPTH.city, layerScale(VIEW_DEPTH.city));
    g.drawImage(floorC, 0, 0, w, h);
    g.drawImage(itemsC, 0, 0, w, h);
    g.drawImage(paintC, 0, 0, w, h);
    g.drawImage(gfxC, 0, 0, w, h);
    if (view.active) layer(atmoC, VIEW_DEPTH.atmo);
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
    cardEl.querySelectorAll('p').forEach((n) => { if (!n.hidden) drawTextEl(g, n); });
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
    const g = c.getContext('2d');
    composite(g, c.width, c.height);
    drawDiwaliReveal(g, c.width / W, c.height / H);
    c.toBlob((b) => { if (b) { download(b, 'light-up-the-skies.png'); toast('Photo saved'); } }, 'image/png');
  }
  // The Happy Diwali sign is HTML; copy it into a photo as it looks right now (mid-animation included).
  function drawDiwaliReveal(g, sx, sy) {
    const img = $('#diwaliReveal img');
    if ($('#diwaliReveal').hidden || !img.complete || !img.naturalWidth) return;
    const opacity = +getComputedStyle(img).opacity;
    if (!(opacity > 0.02)) return;
    const r = img.getBoundingClientRect();
    g.save(); g.globalAlpha = opacity; g.globalCompositeOperation = 'screen'; // neon adds light, like on screen
    g.drawImage(img, r.left * sx, r.top * sy, r.width * sx, r.height * sy);
    g.restore();
  }
  // Screenshot: the scene only (no buttons), with a camera-flash cue.
  function takeScreenshot() {
    const flash = $('#shotFlash');
    savePhoto();
    flash.hidden = true; void flash.offsetWidth; flash.hidden = false;
    setTimeout(() => { flash.hidden = true; }, 400);
    buzz(12);
    safeSound(() => Sound.resume());
  }

  let rec = null;
  const nativeRecorder = ANDROID_WEBVIEW && window.LUTSAndroid && typeof window.LUTSAndroid.recording === 'function';
  let nativeRecording = 'idle';
  let nativeRecordingReady = null;
  window.addEventListener('luts:recording', (event) => {
    nativeRecording = event.detail;
    const active = nativeRecording === 'recording';
    document.body.classList.toggle('native-capture', active || nativeRecording === 'requesting');
    document.body.classList.toggle('recording', active);
    $('#recBadge').hidden = !active;
    $('#recLabel').textContent = active ? 'Stop recording' : 'REC';
    $('#recTime').textContent = '';
    const ready = nativeRecordingReady;
    if (active || nativeRecording === 'idle') nativeRecordingReady = null;
    if (active && ready) ready();
    if (nativeRecording === 'idle' && shotShare && shotShare.native && launch.state === 'READY') shotShare = null;
  });
  function toggleRecording() {
    if (nativeRecorder) {
      if (nativeRecording === 'idle' && mode === 'card' && currentCard) { recordShow(currentCard); return; }
      window.LUTSAndroid.recording(nativeRecording === 'recording' ? 'stop' : 'start');
      return;
    }
    if (rec && rec.quiet) discardRecording(); // REC wins over a show's background recording
    rec ? stopRecording() : startRecording();
  }
  const canRecord = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  // quiet: no REC badge or toast, and the finished file goes to onDone(blob, name, type) instead of being saved.
  function startRecording(msg, { quiet = false, onDone = null } = {}) {
    if (nativeRecorder) { if (!quiet) window.LUTSAndroid.recording('start'); return; }
    if (!canRecord()) { if (!quiet) toast('Video recording is not supported in this browser'); return; }
    // Phones get upscaled to ~720×1280; add ?hq to the URL for full-HD capture (used for promo footage).
    const recMax = /[?&]hq\b/.test(location.search) ? 1920 : 1280;
    const s = Math.min(2, recMax / Math.max(W, H));
    const rc = document.createElement('canvas');
    rc.width = Math.round(W * s) & ~1; rc.height = Math.round(H * s) & ~1;
    const stream = rc.captureStream(30);
    Sound.resume();
    if (Sound.ctx) {
      if (!Sound.recDest) { Sound.recDest = Sound.ctx.createMediaStreamDestination(); Sound.bus.connect(Sound.recDest); }
      Sound.recDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t.clone()));
    }
    // H.264 + AAC in MP4 first: it's the only combination WhatsApp, Instagram and iPhones all accept.
    const types = [
      'video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
    ];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: recMax > 1280 ? 16e6 : 6e6 } : undefined); } catch (e) { if (!quiet) toast('Could not start recording'); return; }
    const chunks = [], r = { mr, rc, g: rc.getContext('2d'), start: performance.now(), quiet, discard: false };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      // Stop audio as well as video. Leaving the MediaStream audio track alive on Android
      // keeps the WebView media pipeline busy after recording and can stall later launches.
      stream.getTracks().forEach((t) => t.stop());
      if (r.discard) return;
      const type = mr.mimeType || mime || 'video/webm';
      const name = `light-up-the-skies.${type.includes('mp4') ? 'mp4' : 'webm'}`, blob = new Blob(chunks, { type });
      if (onDone) onDone(blob, name, type); else deliverVideo(blob, name, type);
    };
    mr.start(250);
    rec = r;
    if (quiet) return;
    document.body.classList.add('recording');
    $('#recBadge').hidden = false;
    toast(msg || 'Recording… tap REC to stop (max 30 s)');
  }
  // Hands a finished video to the person: the share sheet where there is one, otherwise a download.
  function deliverVideo(blob, name, type) {
    achieve('video');
    let file = null;
    try { file = new File([blob], name, { type: type.split(';')[0] }); } catch (e) { /* old browser */ }
    offerShare(file, blob, name);
  }
  function discardRecording() {
    if (!rec) return;
    rec.discard = true;
    stopRecording();
  }
  // Phones: let people send the video straight to WhatsApp & co. (sharing needs a tap, so it's a button).
  let pendingShare = null, previewVideoUrl = null;
  function offerShare(file, blob, name) {
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    pendingShare = { file, blob, name };
    previewVideoUrl = URL.createObjectURL(blob);
    $('#videoPreview').src = previewVideoUrl;
    $('#btnShareVideo').hidden = !(file && navigator.canShare && navigator.canShare({ files: [file] }));
    $('#shareBar').hidden = false;
  }
  const closeShare = () => {
    $('#videoPreview').pause(); $('#videoPreview').removeAttribute('src'); $('#videoPreview').load();
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    previewVideoUrl = null; pendingShare = null; $('#shareBar').hidden = true;
  };
  $('#btnShareVideo').addEventListener('click', async () => {
    if (!pendingShare) return;
    try { await navigator.share({ files: [pendingShare.file], title: 'Light Up the Skies', text: shareCaption || undefined }); closeShare(); countLight(); } catch (e) { /* cancelled */ }
  });
  $('#btnSaveVideo').addEventListener('click', () => { if (pendingShare) { download(pendingShare.blob, pendingShare.name); countLight(); } closeShare(); });
  $('#btnCloseShare').addEventListener('click', closeShare);

  // ---------- Share a show: record it, then open the share sheet with the app's name and link ----------
  // A single shot records the flight, the burst and Happy Diwali; a card (birthdays included) records its card show.
  let shareCaption = '';
  function setShareCaption(text) {
    shareCaption = text;
    try { if (window.LUTSAndroid && typeof window.LUTSAndroid.shareCaption === 'function') window.LUTSAndroid.shareCaption(text); } catch (e) { /* older app */ }
  }
  function cardCaption(c) {
    const link = appLink(), name = (c.t || '').trim();
    if (c.o === 'birthday') return `🎂 Happy Birthday${name ? `, ${name}` : ''}! A fireworks wish from Light Up the Skies 🎆\nMake your own: ${link}`;
    return `✨ ${c.h || 'A fireworks greeting'}${name ? ` for ${name}` : ''}, made with Light Up the Skies 🎆\nMake your own: ${link}`;
  }
  const shotCaption = () => `🪔 Happy Diwali! I lit up the sky with Light Up the Skies 🎆\nLight yours: ${appLink()}`;
  let shotShare = null; // set while a single shot is being recorded for sharing
  function shareShow() {
    if (mode === 'card' && currentCard) { setShareCaption(cardCaption(currentCard)); recordShow(currentCard); return; }
    if (mode !== 'play' || rush.on || launch.state !== 'READY' || shotShare) { toast('Wait for the sky to clear, then tap Share'); return; }
    if (!nativeRecorder && !canRecord()) { toast('Video recording is not supported in this browser'); return; }
    setShareCaption(shotCaption());
    const fire = () => Promise.resolve(requestFire()).then((ok) => { if (!ok) cancelShotShare(); }).catch(cancelShotShare);
    if (nativeRecorder) {
      if (nativeRecording !== 'idle') return;
      shotShare = { native: true };
      nativeRecordingReady = fire; // fire once the screen recorder has started
      window.LUTSAndroid.recording('start');
      return;
    }
    if (rec) { if (rec.quiet) discardRecording(); else stopRecording(); }
    startRecording('Recording your shot… Share opens when the sky clears');
    if (!rec) return;
    shotShare = { native: false, rec };
    fire();
  }
  function cancelShotShare() {
    const s = shotShare; shotShare = null;
    if (!s) return;
    if (s.native) { if (nativeRecording === 'recording') window.LUTSAndroid.recording('stop'); }
    else if (rec === s.rec) discardRecording();
  }
  // When the shot's launch ends: the closing card plays for two seconds, then the video goes to the share sheet.
  function finishShotShare() {
    const s = shotShare; shotShare = null;
    if (!s) return;
    if (s.native) { setTimeout(() => { if (nativeRecording === 'recording') window.LUTSAndroid.recording('stop'); }, 800); return; }
    if (rec !== s.rec) return;
    s.rec.outro = performance.now();
    setTimeout(() => { if (rec === s.rec) stopRecording(); }, 2000);
  }
  $('#btnShareShow').addEventListener('click', shareShow);

  function stopRecording() {
    if (!rec) return;
    try { rec.mr.stop(); } catch (e) { /* already stopped */ }
    rec = null;
    document.body.classList.remove('recording');
    $('#recBadge').hidden = true;
  }
  function recordFrame(now) {
    const active = rec;
    try {
      composite(active.g, active.rc.width, active.rc.height);
      drawDiwaliReveal(active.g, active.rc.width / W, active.rc.height / H);
      if (settings.signVideos) signVideo(active.g, active.rc.width, active.rc.height, active.outro ? (now - active.outro) / 1000 : -1);
      const sec = (now - active.start) / 1000;
      $('#recTime').textContent = `0:${String(sec | 0).padStart(2, '0')}`;
      if (sec >= 30) stopRecording();
    } catch (error) {
      console.error('Recorder frame failed', error);
      active.discard = true;
      stopRecording();
      abortLaunch();
      toast('Recording stopped. You can fire again.');
    }
  }

  // Saved videos say where they came from: a small mark in the corner, and for card shows a closing card in the last
  // two seconds, so everyone a video is shared with can make their own. Settings can turn it off.
  const brandIcon = new Image();
  brandIcon.src = 'assets/icons/icon-192.png';
  function signVideo(g, w, h, outro) {
    const u = Math.min(w, h) / 400;
    g.save();
    g.textBaseline = 'alphabetic';
    if (outro < 0 || outro < 0.3) {
      g.globalAlpha = 0.72;
      g.font = `600 ${(11 * u).toFixed(1)}px Outfit, sans-serif`;
      g.textAlign = 'right';
      g.fillStyle = '#fff4e0';
      g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 6 * u;
      g.fillText('✦ Light Up the Skies', w - 12 * u, h - 14 * u);
    }
    if (outro >= 0) {
      const a = clamp(outro / 0.45, 0, 1);
      g.shadowBlur = 0;
      g.globalAlpha = a * 0.78;
      g.fillStyle = '#05061a';
      g.fillRect(0, 0, w, h);
      g.globalAlpha = a;
      const cy = h * 0.42, icon = 76 * u;
      if (brandIcon.complete && brandIcon.naturalWidth) {
        g.save();
        roundRect(g, w / 2 - icon / 2, cy - icon - 18 * u, icon, icon, 18 * u);
        g.clip();
        g.drawImage(brandIcon, w / 2 - icon / 2, cy - icon - 18 * u, icon, icon);
        g.restore();
      }
      g.textAlign = 'center';
      g.fillStyle = '#c9c6e6';
      g.font = `500 ${(13 * u).toFixed(1)}px Outfit, sans-serif`;
      g.fillText('MADE WITH', w / 2, cy + 8 * u);
      const grad = g.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
      grad.addColorStop(0, '#ffe29a'); grad.addColorStop(0.5, '#ffb347'); grad.addColorStop(1, '#ff5fa2');
      g.fillStyle = grad;
      g.font = `800 ${(30 * u).toFixed(1)}px Cinzel, Georgia, serif`;
      g.fillText('Light Up the Skies', w / 2, cy + 44 * u);
      g.fillStyle = '#fff4e0';
      g.font = `500 ${(15 * u).toFixed(1)}px Outfit, sans-serif`;
      const store = window.LUTSNative && window.LUTSNative.platform === 'ios' ? 'Make yours in the app' : 'Make yours free on Google Play';
      g.fillText(store, w / 2, cy + 74 * u);
      // The sender's light-bringer rank, once they have shared a few.
      const r = rankOf(lights());
      if (r[0] > 0) {
        g.fillStyle = '#c9c6e6';
        g.font = `500 ${(12 * u).toFixed(1)}px Outfit, sans-serif`;
        g.fillText(`${r[1]} Sent by a ${r[2]} light-bringer`, w / 2, cy + 100 * u);
      }
    }
    g.restore();
  }

  // ---------- Greeting cards ----------
  const OCCASIONS = [
    { id: 'birthday', label: '🎂 Birthday', head: 'Happy Birthday', msg: 'Wishing you a year full of light, laughter and wonderful surprises.', theme: 'rainbow' },
    { id: 'newyear', label: '🎉 New Year', head: 'Happy New Year', msg: 'May the year ahead sparkle as brightly as these skies.', theme: 'gold' },
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
  // Message ideas for when the words won't come ("Try another message" steps through them, after the occasion's own).
  const IDEAS = {
    birthday: [
      'Another trip around the sun, and you make it brighter every time. Happy birthday!',
      'Here’s to big dreams, small joys and everything in between. Have your best year yet!',
      'Happy birthday to someone who inspires me every day. Keep shining!',
      'जन्मदिन की हार्दिक शुभकामनाएँ! आपका हर दिन रोशनी और खुशियों से भरा रहे।',
      'இனிய பிறந்தநாள் வாழ்த்துகள்! உங்கள் வாழ்வு என்றும் ஒளியும் மகிழ்ச்சியும் நிறைந்ததாக இருக்கட்டும்.',
    ],
    newyear: [
      'New year, new sky, same wonderful you. Wishing you joy all year long.',
      'May every month of the new year bring a new reason to celebrate.',
      'नया साल मुबारक! यह साल आपके लिए ढेर सारी खुशियाँ और सफलता लेकर आए।',
      'இனிய புத்தாண்டு வாழ்த்துகள்! இந்த ஆண்டு உங்களுக்கு மகிழ்ச்சியும் வெற்றியும் தரட்டும்.',
    ],
    diwali: [
      'May a thousand diyas light your path to happiness this Diwali.',
      'Wishing you sweets, sparkle and the warmth of family this Diwali.',
      'दीपावली की हार्दिक शुभकामनाएँ! आपका घर खुशियों, सुख और समृद्धि से जगमगाता रहे।',
      'இனிய தீபாவளி நல்வாழ்த்துகள்! உங்கள் இல்லம் மகிழ்ச்சியாலும் வளத்தாலும் ஒளிரட்டும்.',
    ],
    christmas: ['May your home be merry, your heart be light and your sky full of stars.', 'Sending you warmth, wonder and a sleigh full of joy this Christmas.'],
    love: ['Every firework tonight is a reason I love you.', 'With you, every ordinary day feels like a celebration.'],
    anniversary: ['Happy anniversary to the couple who make love look easy.', 'Another year of us. My favourite story keeps getting better.'],
    congrats: ['All that hard work paid off. So proud of you!', 'Here’s to this milestone and all the ones still to come.'],
    thanks: [
      'Thank you for the lovely wishes! Sending a sky full of light right back to you.',
      'You made my day. Thank you from the bottom of my heart.',
      'दिल से धन्यवाद! आपकी शुभकामनाओं ने मेरा दिन रोशन कर दिया।',
      'மனமார்ந்த நன்றி! உங்கள் வாழ்த்துகள் என் நாளை ஒளிரச் செய்தன.',
    ],
    custom: ['Thinking of you today. This sky is for you.', 'Just because you deserve fireworks.', 'Sending you a little light, wherever you are.'],
  };
  for (const o of OCCASIONS) IDEAS[o.id] = [o.msg, ...(IDEAS[o.id] || [])].filter(Boolean);
  Object.values(IDEAS).flat().forEach((m) => TEMPLATE_MSGS.add(m)); // an idea counts as untouched: a new occasion replaces it
  // w: the background (world id) the show plays on; '' for links made before backgrounds were part of a card.
  // imgFull: a sharper copy of the photo kept on this device for your own show and videos (never in the link).
  const card = { o: 'birthday', t: '', f: '', h: OCCASIONS[0].head, m: OCCASIONS[0].msg, p: OCCASIONS[0].theme, w: '', img: '', imgFull: '' };
  const toB64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64url = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };
  const imgCache = new Map();
  function photoImage(b64) {
    if (!imgCache.has(b64)) { const im = new Image(); im.src = `data:image/jpeg;base64,${b64}`; imgCache.set(b64, im); }
    return imgCache.get(b64);
  }
  const photoSrc = (b64) => `data:image/jpeg;base64,${b64}`;
  const showPhoto = (c) => c.imgFull || c.img;
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
      // A sharper copy plays your own show and goes into saved videos; the link keeps the small one.
      const L = Math.min(480, m), big = document.createElement('canvas');
      big.width = big.height = L;
      big.getContext('2d').drawImage(img, (w - m) / 2, (h - m) * 0.3, m, m, 0, 0, L, L);
      card.imgFull = big.toDataURL('image/jpeg', 0.85).split(',')[1];
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
      h: clean(raw.h, 24), m: cleanMsg(raw.m, 160), p: PALETTES[raw.p] ? raw.p : 'rainbow', w: isWorld(raw.w) ? raw.w : '', img: '',
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
    card.w = world.pending || world.id; // the background picker drives the live scene; the card takes whatever it shows
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
    const sky = document.querySelector('.preview-sky'), wcfg = WORLD_BY_ID[card.w];
    sky.style.setProperty('--pv-grad', `linear-gradient(90deg, ${cols.join(', ')})`);
    sky.style.setProperty('--pv-world', wcfg && wcfg.image ? `url("${thumbSrc(wcfg, 'jpg')}")` : 'none');
  }
  $('#cPhoto').addEventListener('change', (e) => { processPhoto(e.target.files[0]); e.target.value = ''; });
  $('#cPhotoRemove').addEventListener('click', () => { card.img = card.imgFull = ''; updatePreview(); });
  for (const k in f) f[k].addEventListener('input', () => { f.to.closest('.field').classList.remove('invalid'); updatePreview(); });
  $('#btnMsgIdea').addEventListener('click', () => {
    const list = IDEAS[card.o] || IDEAS.custom;
    card.m = list[(list.indexOf(cleanMsg(f.msg.value, 160)) + 1) % list.length];
    f.msg.value = card.m;
    updatePreview();
  });

  // ---------- Card music ----------
  // A song from this device plays under your card show and is mixed into the sound that recordings capture, so saved
  // videos carry it. It never leaves the device: card links hold only text and a small photo.
  const MUSIC_LEVEL = 0.5;
  const music = { el: null, fade: null, url: '', name: '', start: 0, preview: false, held: false, stopTimer: 0 };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function parseTime(s) {
    const m = String(s).trim().match(/^(?:(\d{1,3}):)?(\d{1,4})$/);
    return m ? (m[1] ? +m[1] * 60 : 0) + +m[2] : NaN;
  }
  const musicDuration = () => (music.el && isFinite(music.el.duration) ? music.el.duration : 0);
  // The <audio> element streams the file (a whole decoded song would cost ~100 MB); Web Audio carries it to the bus.
  function musicNodes() {
    if (music.fade) return true;
    if (!Sound.init()) return false;
    try {
      const src = Sound.ctx.createMediaElementSource(music.el);
      music.fade = Sound.ctx.createGain();
      music.fade.gain.value = 0;
      src.connect(music.fade); music.fade.connect(Sound.music);
      return true;
    } catch (e) { return false; }
  }
  function playMusic(from, fadeIn = 0.6) {
    if (!music.url || !musicNodes()) return;
    const t = Sound.ctx.currentTime, g = music.fade.gain;
    clearTimeout(music.stopTimer);
    music.held = false;
    g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(MUSIC_LEVEL, t + fadeIn);
    try { music.el.currentTime = from; } catch (e) { /* not seekable yet: starts from the top */ }
    const p = music.el.play();
    if (p && p.catch) p.catch(() => {});
  }
  function stopMusic(fade = 1) {
    music.preview = false; music.held = false;
    if (music.fade && !music.el.paused) {
      const t = Sound.ctx.currentTime, g = music.fade.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
      clearTimeout(music.stopTimer);
      music.stopTimer = setTimeout(() => music.el.pause(), fade * 1000 + 60);
    }
    syncMusicUi();
  }
  // Pausing the show pauses its song too.
  function holdMusic(on) {
    if (!music.el) return;
    if (on && !music.el.paused) { music.held = true; music.el.pause(); }
    else if (!on && music.held) { music.held = false; const p = music.el.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function loadMusic(file) {
    if (!file) return;
    if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(file.name)) { toast('Please choose an audio file'); return; }
    if (!music.el) {
      music.el = new Audio();
      music.el.preload = 'auto';
      music.el.addEventListener('ended', () => { music.preview = false; syncMusicUi(); });
    }
    stopMusic(0);
    const el = music.el, url = URL.createObjectURL(file);
    const done = (ok) => {
      el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('error', onErr);
      if (!ok) {
        URL.revokeObjectURL(url);
        if (music.url) el.src = music.url; else el.removeAttribute('src');
        toast('Couldn’t play that audio file');
      } else {
        if (music.url) URL.revokeObjectURL(music.url);
        music.url = url; music.name = file.name.replace(/\.[^.]+$/, ''); music.start = 0;
      }
      syncMusicUi();
    };
    const onMeta = () => done(true), onErr = () => done(false);
    el.addEventListener('loadedmetadata', onMeta); el.addEventListener('error', onErr);
    $('#cMusicLabel').textContent = 'Loading…';
    el.src = url;
    el.load();
  }
  function removeMusic() {
    stopMusic(0);
    if (music.el) { music.el.pause(); music.el.removeAttribute('src'); music.el.load(); }
    if (music.url) URL.revokeObjectURL(music.url);
    music.url = ''; music.name = ''; music.start = 0;
    syncMusicUi();
  }
  function syncMusicUi() {
    const has = !!music.url, start = $('#cMusicStart'), dur = musicDuration();
    $('#cMusicLabel').textContent = has ? music.name : 'Choose a song';
    $('#cMusicLabel').title = has ? music.name : '';
    $('#cMusicName').textContent = has ? 'Tap to change' : 'From your phone';
    $('.music-pick').classList.toggle('has-song', has);
    $('#cMusicOpts').hidden = !has;
    if (document.activeElement !== start) start.value = mmss(music.start);
    $('#cMusicLen').textContent = dur ? `of ${mmss(dur)}` : '';
    $('#cMusicListen').textContent = music.preview ? 'Stop' : 'Listen';
  }
  $('#cMusic').addEventListener('change', (e) => { Sound.resume(); loadMusic(e.target.files[0]); e.target.value = ''; });
  $('#cMusicRemove').addEventListener('click', removeMusic);
  $('#cMusicStart').addEventListener('change', () => {
    const s = parseTime($('#cMusicStart').value);
    if (!isNaN(s)) music.start = clamp(s, 0, Math.max(0, musicDuration() - 1));
    $('#cMusicStart').value = mmss(music.start);
    if (music.preview) playMusic(music.start, 0.2);
  });
  $('#cMusicListen').addEventListener('click', () => {
    Sound.resume();
    if (music.preview) { stopMusic(0.3); return; }
    playMusic(music.start, 0.3);
    music.preview = true;
    syncMusicUi();
  });

  // ---------- Card background ----------
  // A card plays on the background its sender chose (even a landmark this viewer hasn't unlocked). It is shown, not
  // saved: leaving the show brings back the viewer's own scene.
  let ownWorld = null;
  function showCardWorld(c) {
    const now = world.pending || world.id;
    if (!isWorld(c.w) || c.w === now) return;
    if (ownWorld === null) ownWorld = now;
    selectWorld(c.w, { silent: true, save: false, force: true });
  }
  function restoreOwnWorld() {
    if (ownWorld === null) return;
    const id = ownWorld;
    ownWorld = null;
    selectWorld(id, { silent: true, save: false, force: true });
  }
  // Picking a background yourself keeps it after the show, and the show on screen now uses it (Replay, Save video).
  function worldChosen(id) {
    ownWorld = null;
    if (mode === 'card' && currentCard) currentCard.w = id;
  }

  function validCard() {
    readForm();
    if (!card.t) {
      if (cardStep !== 0) showStep(0);
      const fld = f.to.closest('.field');
      fld.classList.remove('invalid'); void fld.offsetWidth; fld.classList.add('invalid');
      f.to.focus();
      return false;
    }
    return true;
  }
  function cardUrl() {
    const { img, imgFull, friend, ...data } = card; // the link carries the card, not this device's own bookkeeping
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
  function openCardModal(prefill, step = 0) {
    if (launch.state !== 'READY') abortLaunch();
    closeDrawer();
    if (prefill) { card.o = prefill.o || card.o; card.p = prefill.p || card.p; card.h = prefill.h || card.h; card.m = prefill.m || card.m; card.t = ''; card.f = ''; card.img = card.imgFull = ''; card.friend = ''; }
    fillForm();
    syncMusicUi();
    modal.hidden = false;
    showStep(step);
    if (location.protocol === 'file:') $('#linkNote').textContent = 'The link contains the whole card, so nothing is uploaded. Host the game online (for example GitHub Pages or Netlify) so friends can open the link.';
    // Desktop: start typing straight away. Phones keep the keyboard closed until a field is tapped, so the step stays in view.
    if (step === 0 && window.matchMedia && matchMedia('(pointer: fine)').matches) setTimeout(() => f.to.focus(), 50);
  }
  function closeCardModal() {
    modal.hidden = true;
    if (music.preview) stopMusic(0.3);
  }

  // ---------- Card creator steps ----------
  // Wish → Message → Scene → Music, one short screen each. The step bar jumps anywhere; Back / Next sit at the bottom;
  // the last step plays the show. Steps after Wish need the recipient's name.
  const STEP_HINTS = [
    'Who is it for? Their name is written in fireworks.',
    'The headline flies across the sky; the message appears on the card.',
    'Choose where the show happens.',
    'Add a song. It plays during the show and in saved videos.',
  ];
  const sheet = modal.querySelector('.modal-box');
  const stepTabs = [...document.querySelectorAll('#cardSteps [data-step]')];
  const stepPanels = [...document.querySelectorAll('#cardForm .step')];
  const LAST_STEP = stepPanels.length - 1;
  let cardStep = 0;
  function showStep(n) {
    cardStep = n;
    sheet.dataset.step = n;
    stepPanels.forEach((p, i) => { p.hidden = i !== n; });
    stepTabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === n));
      t.tabIndex = i === n ? 0 : -1;
      t.classList.toggle('done', i < n);
    });
    $('#cardStepHint').textContent = STEP_HINTS[n];
    $('#btnCardBack').hidden = n === 0;
    $('#btnCardNext').hidden = n === LAST_STEP;
    $('#btnPreview').hidden = n !== LAST_STEP;
    $('#cardModal .modal-body').scrollTop = 0;
    if (music.preview && n !== LAST_STEP) stopMusic(0.3);
  }
  const goStep = (n) => { if (n === cardStep || (n > 0 && !validCard())) return; showStep(clamp(n, 0, LAST_STEP)); };
  stepTabs.forEach((t, i) => t.addEventListener('click', () => goStep(i)));
  // Arrow keys move along the step bar, as in any tab list.
  $('#cardSteps').addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    goStep(clamp(cardStep + d, 0, LAST_STEP));
    stepTabs[cardStep].focus();
  });
  $('#btnCardHome').addEventListener('click', () => {
    closeCardModal();
    if (mode === 'card') exitCardMode();
  });
  $('#btnCardNext').addEventListener('click', () => goStep(cardStep + 1));
  $('#btnCardBack').addEventListener('click', () => goStep(cardStep - 1));
  // Android's Back button asks the page first (NativeBridge.BACK_PRESS_SCRIPT): inside the card creator it goes back a
  // step, like any step-by-step screen. Anything else (closing a panel, leaving the app) stays with the app shell.
  window.LUTSBack = () => {
    if (!$('#rewardsPanel').hidden) { closeRewards(); return true; }
    if (!$('#crackerTrial').hidden) { $('#crackerTrial').hidden = true; return true; }
    if (launch.state !== 'READY') { abortLaunch(); return true; }
    if (closeSheets()) return true;
    if (modal.hidden || cardStep === 0 || !$('#premiumPanel').hidden || !$('#worldPanel').hidden) return false;
    goStep(cardStep - 1);
    return true;
  };
  // The keyboard's Next key walks through the fields, then on to the next step.
  const NEXT_FIELD = { cTo: 'cFrom', cHead: 'cMsg' };
  $('#cardForm').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.isComposing) return;
    e.preventDefault();
    const next = NEXT_FIELD[e.target.id];
    if (next) $('#' + next).focus(); else { e.target.blur(); goStep(cardStep + 1); }
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeCardModal(); });
  $('#btnShare').hidden = !navigator.share;

  $('#btnCard').addEventListener('click', () => openCardModal());
  $('#btnIntroCard').addEventListener('click', () => { Sound.resume(); openCardModal(); });
  $('#btnPreview').addEventListener('click', () => {
    if (!validCard()) return;
    Sound.resume();
    closeCardModal();
    hideOverlay($('#intro'));
    if (card.f) { try { localStorage.setItem('luts:from', card.f); } catch (e) { /* ignore */ } } // signs the next birthday video
    if (card.friend) achieve('hero');
    playAndKeep({ ...card, own: true }); // own: your card, so your music plays with it
  });
  $('#btnCopyLink').addEventListener('click', async () => {
    if (!validCard()) return;
    const ok = await copyText(cardUrl());
    toast(ok ? 'Card link copied. Paste it anywhere to share.' : 'Could not copy the link');
    if (ok) countLight();
  });
  $('#btnShare').addEventListener('click', async () => {
    if (!validCard()) return;
    try {
      await navigator.share({ title: `A fireworks card for ${card.t}`, text: `${card.f || 'Someone'} sent you a fireworks greeting ✨`, url: cardUrl() });
      countLight();
    } catch (e) { /* cancelled */ }
  });

  // Card show
  let currentCard = null;
  function playCard(c) {
    abortLaunch();
    currentCard = c;
    mode = 'card';
    achieve('card');
    document.body.classList.add('card-mode');
    $('#greeting').hidden = true;
    clearTimers('card');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    showCardWorld(c);
    if (c.own && music.url) playMusic(music.start); else stopMusic(0.4);
    const T = 'card';
    after(0.2, () => launchShell({ x: W * 0.22, y: H * 0.3, type: 'chrysanthemum' }), T);
    after(0.55, () => launchShell({ x: W * 0.78, y: H * 0.3, type: 'chrysanthemum' }), T);
    after(1.0, () => launchShell({ x: W * 0.5, y: H * 0.2, type: 'kamuro' }), T);
    let t = 3;
    if (c.h) { after(2.6, () => launchText(c.h, H * 0.24, 0.12, 3), T); t = 6; }
    if (c.img) { after(t, () => launchPhoto(showPhoto(c), H * 0.52, 3.4), T); t += 4.8; }
    // Over a landmark the name goes into the open sky above its roofline, so the building doesn't hide it.
    after(t, () => launchText(c.t, world.img && world.rect ? clamp(world.rect.roof - H * 0.1, H * 0.2, H * 0.42) : H * 0.42, 0.2, 4), T);
    after(t + 0.4, () => {
      launchShell({ x: W * 0.15, y: H * 0.22, type: 'heart' });
      launchShell({ x: W * 0.85, y: H * 0.22, type: 'heart' });
    }, T);
    const tGreet = t + 2.8;
    after(tGreet, () => showGreeting(c), T);
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
    const joy = c.kind === 'joy';
    $('#gTo').textContent = c.t;
    $('#gDear').hidden = joy;
    $('#gJoyHead').hidden = !joy;
    if (joy) $('#gJoyHead').textContent = `${MOODS[c.mood - 1][0]} Day ${c.day} of gratitude`;
    $('#gMsg').textContent = c.m;
    $('#gFrom').textContent = joy ? niceDate(c.date) : c.f ? `— ${c.f}` : '';
    setImg($('#gPhoto'), showPhoto(c));
    $('#gCard').classList.toggle('has-photo', !!c.img);
    // Your card: Save video leads. A card you received: Send one back leads, Save video moves to the tools.
    const received = !c.own && !joy, sender = clean(c.f, 20);
    // Android records the full card through the shared top Record control.
    $('#btnRecordCard').hidden = received || nativeRecorder;
    $('#btnSendBack').hidden = !received;
    $('#btnSendBack').lastChild.textContent = sender ? `Send one back to ${sender}` : 'Make one of your own';
    $('#btnSaveTool').hidden = !received || nativeRecorder;
    $('#btnEditCard').hidden = !c.own || joy;
    $('#btnMakeOwn').hidden = true;
    $('#btnShareJoy').hidden = !joy;
    $('#greeting').hidden = false;
  }
  function exitCardMode() {
    if (rec && rec.quiet) discardRecording();
    readyVideo = null;
    clearTimers('card');
    $('#greeting').hidden = true;
    document.body.classList.remove('card-mode');
    stopMusic(1);
    restoreOwnWorld();
    palette = basePalette();
    portrait = null;
    mode = 'play';
  }
  $('#btnReplay').addEventListener('click', () => currentCard && playAndKeep(currentCard));
  $('#btnMakeOwn').addEventListener('click', () => openCardModal(currentCard && { o: currentCard.o, p: currentCard.p, h: currentCard.h, m: currentCard.m }));
  $('#btnCloseGreeting').addEventListener('click', exitCardMode);
  $('#btnEditCard').addEventListener('click', () => openCardModal(null, 2));
  // Replays the whole card show from the start while recording, then saves the video.
  // Plays a show and records the whole of it: the song fades out with the video and the closing card comes last.
  function recordShow(c, opts) {
    if (nativeRecorder) {
      const play = () => {
        Sound.resume();
        closeCardModal();
        hideOverlay($('#intro'));
        const end = Math.min(29, playCard(c) + 7);
        after(end, () => { if (nativeRecording === 'recording') window.LUTSAndroid.recording('stop'); }, 'card');
      };
      if (nativeRecording === 'recording') play();
      else if (nativeRecording === 'idle') { nativeRecordingReady = play; window.LUTSAndroid.recording('start'); }
      return;
    }
    if (rec) { if (rec.quiet) discardRecording(); else stopRecording(); }
    const tGreet = playCard(c);
    startRecording('Recording the card show… it saves automatically', opts);
    if (!rec) return;
    const r = rec, end = Math.min(29, tGreet + 7);
    after(end - 1.6, () => { if (rec === r) stopMusic(1.5); }, 'card');
    after(end - 2, () => { if (rec === r) r.outro = performance.now(); }, 'card');
    after(end, () => { if (rec === r) stopRecording(); }, 'card');
  }
  // The first time a show plays, its video is made in the background, so Save video is instant afterwards (no second
  // wait while the show replays). Skipped on Low quality, where recording during play could slow the show down.
  let readyVideo = null; // { card, blob, name, type, want }
  function playAndKeep(c) {
    readyVideo = null;
    if (nativeRecorder || !canRecord() || settings.quality === 'low') { playCard(c); return; }
    const keep = { card: c, blob: null, want: false };
    readyVideo = keep;
    recordShow(c, {
      quiet: true,
      onDone: (blob, name, type) => {
        Object.assign(keep, { blob, name, type });
        if (keep.want && readyVideo === keep) { keep.want = false; deliverVideo(blob, name, type); }
      },
    });
  }
  $('#btnRecordCard').addEventListener('click', () => {
    if (!currentCard) return;
    Sound.resume();
    const ready = readyVideo && readyVideo.card === currentCard ? readyVideo : null;
    if (ready && ready.blob) { deliverVideo(ready.blob, ready.name, ready.type); return; }
    if (ready && rec && rec.quiet) { ready.want = true; toast('Your video is almost ready…', 2200); return; }
    readyVideo = null;
    recordShow(currentCard);
  });
  $('#btnSaveTool').addEventListener('click', () => $('#btnRecordCard').click());
  // Received cards: answer the sender with a thank-you card already addressed to them.
  const REPLY = { o: 'thanks', h: 'Thank You', m: 'Thank you for the lovely wishes! Sending a sky full of light right back to you.', p: 'gold' };
  $('#btnSendBack').addEventListener('click', () => {
    const to = currentCard ? clean(currentCard.f, 20) : '';
    openCardModal({ ...REPLY });
    card.t = to;
    try { card.f = localStorage.getItem('luts:from') || ''; } catch (e) { /* ignore */ }
    fillForm();
    showStep(to ? 1 : 0);
  });

  // ---------- Intro / envelope ----------
  function hideOverlay(o) {
    if (o === $('#intro')) document.body.classList.remove('home');
    if (o.hidden) return;
    o.classList.add('leaving');
    setTimeout(() => { o.hidden = true; o.classList.remove('leaving'); }, 600);
  }
  $('#btnStart').addEventListener('click', () => {
    Sound.resume();
    askMotion();
    hideOverlay($('#intro'));
    mode = 'play';
    clearScene(); syncLaunchUi();
    maybeWelcome();
    maybeNudge();
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
    playAndKeep(incoming);
  });
  window.addEventListener('hashchange', () => {
    const c = readHash();
    if (c) { incoming = c; closeCardModal(); $('#intro').hidden = true; document.body.classList.remove('home'); showEnvelope(c); }
  });
  function showEnvelope(c) {
    abortLaunch();
    mode = 'envelope';
    clearTimers('card');
    $('#greeting').hidden = true;
    document.body.classList.add('card-mode');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    stopMusic(0.4);
    showCardWorld(c); // the sender's background is already behind the envelope
    $('#envTo').textContent = c.t;
    $('#envFrom').textContent = c.f ? `from ${c.f}` : '';
    setImg($('#envPhoto'), c.img);
    $('#btnOpenCard').classList.toggle('has-photo', !!c.img);
    $('#envelope').hidden = false;
  }



  // ---------- Birthdays and daily joy ----------
  // Both live only on this device. Birthdays: the people you love, a reminder the day before (a phone notification in
  // the Android and iOS apps; a calendar event on the web) and their fireworks video one tap away. Daily joy: how happy
  // you are and one thing you're grateful for, written in fireworks every day, with a streak to keep going.
  const BDAY_KEY = 'luts:birthdays', JOY_KEY = 'luts:joy';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // [face, word, firework colours]
  const MOODS = [['😔', 'Low', 'ocean'], ['😐', 'Okay', 'classic'], ['🙂', 'Good', 'gold'], ['😄', 'Happy', 'festive'], ['🤩', 'Amazing', 'rainbow']];
  const loadList = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveList = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { toast('Couldn’t save on this device. It may be full.'); return false; } };
  const dayKey = (dt = new Date()) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const niceDate = (key) => { const [y, m, d] = String(key).split('-').map(Number); return y ? `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}` : ''; };
  const appLink = () => (window.LUTSNative && window.LUTSNative.shareBase) || (location.origin === 'null' ? '' : location.origin + location.pathname);
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  // ----- Sheets (the two screens) -----
  const sheets = [$('#bdayModal'), $('#joyModal'), $('#welcomeModal')];
  function openSheet(el) {
    closeDrawer();
    sheets.forEach((s) => { s.hidden = s !== el; });
    el.hidden = false;
    const body = el.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
    const first = el.querySelector('.nav-back, .btn.primary'); // screen readers start inside the new screen
    if (first) first.focus({ preventScroll: true });
  }
  function closeSheet(el) { if (el) el.hidden = true; updateHomeTiles(); }
  function closeSheets() { const open = sheets.filter((s) => !s.hidden); open.forEach((s) => closeSheet(s)); return open.length > 0; }
  sheets.forEach((el) => el.addEventListener('pointerdown', (e) => { if (e.target === el) closeSheet(el); }));

  // ----- Birthdays -----
  let friends = loadList(BDAY_KEY).filter((f) => f && typeof f.name === 'string' && f.m >= 1 && f.m <= 12 && f.d >= 1 && f.d <= 31);
  const birthdayIn = (f, y) => {
    const leap = new Date(y, 1, 29).getMonth() === 1;
    return new Date(y, f.m - 1, f.m === 2 && f.d === 29 && !leap ? 28 : f.d); // 29 February: the 28th in other years
  };
  function nextBirthday(f) {
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let date = birthdayIn(f, today.getFullYear());
    if (date < today) date = birthdayIn(f, today.getFullYear() + 1);
    return { date, days: Math.round((date - today) / 864e5) };
  }
  const whenText = (days, date) => {
    const d = `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
    return days === 0 ? `Today 🎉 · ${d}` : days === 1 ? `Tomorrow · ${d}` : days < 7 ? `In ${days} days · ${d}` : d;
  };
  const upcoming = () => friends.map((f) => ({ f, ...nextBirthday(f) })).sort((a, b) => a.days - b.days || a.f.name.localeCompare(b.f.name));
  // In the apps the phone itself reminds you; see NativeBridge (reminders) in the app shell.
  const nativeReminders = () => !!(window.LUTSNative && typeof window.LUTSNative.reminders === 'function');
  function syncReminders() {
    // One "id<TAB>month<TAB>day<TAB>name" line each (names never hold tabs or line breaks; see clean()).
    if (nativeReminders()) window.LUTSNative.reminders(friends.map((f) => [f.id, f.m, f.d, f.name].join('\t')).join('\n'));
  }

  function renderBirthdays() {
    const list = $('#bdayList'), rows = upcoming();
    list.innerHTML = '';
    $('#bdayEmpty').hidden = rows.length > 0 || !$('#bdayForm').hidden;
    $('#bdayHint').textContent = nativeReminders() ? 'We’ll remind you the day before, with their fireworks video one tap away.'
      : 'Add each one to your calendar for a reminder the day before. Their fireworks video is one tap away here.';
    for (const { f, date, days } of rows) {
      const li = document.createElement('li');
      li.className = 'sheet-row' + (days <= 1 ? ' soon' : '');
      const av = document.createElement(f.img ? 'img' : 'span');
      av.className = 'row-avatar';
      if (f.img) { av.src = photoSrc(f.img); av.alt = ''; } else av.textContent = initials(f.name) || '🎂';
      const text = document.createElement('span');
      text.className = 'row-text';
      const b = document.createElement('b'); b.textContent = f.name;
      const sm = document.createElement('small'); sm.textContent = whenText(days, date);
      text.append(b, sm);
      const make = document.createElement('button');
      make.type = 'button';
      make.className = `btn small ${days <= 1 ? 'primary' : 'ghost'}`;
      make.textContent = 'Make video';
      make.addEventListener('click', () => makeBirthdayVideo(f));
      li.append(av, text, make);
      if (!nativeReminders()) {
        const cal = document.createElement('button');
        cal.type = 'button'; cal.className = 'row-icon'; cal.title = 'Add to calendar'; cal.setAttribute('aria-label', `Add ${f.name}’s birthday to your calendar`);
        cal.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
        cal.addEventListener('click', () => addToCalendar(f));
        li.append(cal);
      }
      // Remove asks once: the first tap turns the button into "Remove?"
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'row-icon row-del'; del.setAttribute('aria-label', `Remove ${f.name}`);
      del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
      del.addEventListener('click', () => {
        if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'Remove?'; return; }
        friends = friends.filter((x) => x.id !== f.id);
        saveList(BDAY_KEY, friends);
        syncReminders();
        renderBirthdays();
      });
      li.append(del);
      list.append(li);
    }
    updateHomeTiles();
  }

  // Add form
  const bForm = $('#bdayForm');
  let bPhoto = '';
  function fillDays() {
    const m = +$('#bMonth').value || 1, n = new Date(2024, m, 0).getDate(), keep = +$('#bDay').value || 1; // 2024: a leap year, so 29 Feb is offered
    $('#bDay').innerHTML = '';
    for (let d = 1; d <= n; d++) $('#bDay').append(new Option(String(d), String(d)));
    $('#bDay').value = String(Math.min(keep, n));
  }
  MONTHS.forEach((m, i) => $('#bMonth').append(new Option(m, String(i + 1))));
  $('#bMonth').addEventListener('change', fillDays);
  function showBdayForm(on) {
    bForm.hidden = !on;
    $('#btnBdayAdd').hidden = on;
    $('#bdayImport').hidden = on;
    $('#bdayEmpty').hidden = on || friends.length > 0;
    if (!on) return;
    const now = new Date();
    $('#bName').value = ''; bPhoto = ''; setImg($('#bPhotoPrev'), ''); $('#bPhotoLabel').textContent = 'Add photo';
    $('#bName').closest('.field').classList.remove('invalid');
    $('#bMonth').value = String(now.getMonth() + 1); fillDays(); $('#bDay').value = String(now.getDate());
    $('#bdayModal .modal-body').scrollTop = 0;
    setTimeout(() => $('#bName').focus(), 50);
  }
  $('#btnBdayAdd').addEventListener('click', () => showBdayForm(true));
  $('#bCancel').addEventListener('click', () => showBdayForm(false));
  $('#bPhoto').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    readPhoto(file, 360, 0.82).then((b64) => { bPhoto = b64; setImg($('#bPhotoPrev'), b64); $('#bPhotoLabel').textContent = 'Change photo'; }, () => toast('Could not read that image'));
  });
  $('#bName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#bSave').click(); } });
  $('#bSave').addEventListener('click', () => {
    const name = clean($('#bName').value, 20), fld = $('#bName').closest('.field');
    if (!name) { fld.classList.remove('invalid'); void fld.offsetWidth; fld.classList.add('invalid'); $('#bName').focus(); return; }
    const f = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, m: +$('#bMonth').value, d: +$('#bDay').value, img: bPhoto };
    friends.push(f);
    if (!saveList(BDAY_KEY, friends)) { friends.pop(); return; }
    syncReminders();
    showBdayForm(false);
    renderBirthdays();
    achieve('bday1');
    if (friends.length >= 5) achieve('bday5');
    const { date } = nextBirthday(f), eve = new Date(date.getTime() - 864e5);
    toast(nativeReminders() ? `🎂 Saved. We’ll remind you on ${eve.getDate()} ${MONTHS[eve.getMonth()].slice(0, 3)}.` : `🎂 Saved ${name}’s birthday`, 3200);
  });


  // ----- Import birthdays: the phone's contacts (apps) or a contacts file (.vcf, anywhere) -----
  // Nothing is added until the person ticks who to add; contacts already saved are shown but can't be added twice.
  const nativeContacts = () => !!(window.LUTSNative && typeof window.LUTSNative.contacts === 'function');
  let importing = []; // [{ name, m, d, img, on, saved }]
  function importPanel(which) {
    $('#importConsent').hidden = which !== 'consent';
    $('#importPick').hidden = which !== 'pick';
    $('#bdayImport').hidden = !!which;
    $('#btnBdayAdd').hidden = !!which || !bForm.hidden;
    if (which) { bForm.hidden = true; $('#bdayEmpty').hidden = true; }
  }
  $('#btnImportContacts').addEventListener('click', () => importPanel('consent'));
  $('#consentNo').addEventListener('click', () => { importPanel(null); renderBirthdays(); });
  $('#consentYes').addEventListener('click', () => { importPanel(null); toast('Looking for birthdays…'); window.LUTSNative.contacts(); });
  // The app shell answers with [{ name, month, day, photo }], or null when contacts access was declined.
  window.addEventListener('luts:contacts', (e) => {
    const list = e.detail;
    if (list == null) { toast('Contacts access is off. You can turn it on in your phone’s Settings.', 4200); return; }
    showImport(list.map((c) => ({ name: clean(c.name, 20), m: +c.month, d: +c.day, img: typeof c.photo === 'string' ? c.photo : '' })));
  });
  $('#bVcf').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((text) => showImport(parseVcards(text)), () => toast('Could not read that file'));
  });
  // vCards (what phones and Google Contacts export): FN or N for the name, BDAY for the date.
  function parseVcards(text) {
    const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/), out = [];
    const unesc = (v) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
    let cur = null;
    for (const line of lines) {
      if (/^BEGIN:VCARD/i.test(line)) cur = {};
      else if (/^END:VCARD/i.test(line)) { if (cur && cur.name && cur.m) out.push(cur); cur = null; }
      else if (cur) {
        const i = line.indexOf(':');
        if (i < 0) continue;
        const key = line.slice(0, i).split(';')[0].replace(/^item\d+\./i, '').toUpperCase(), val = line.slice(i + 1).trim();
        if (key === 'FN') cur.name = clean(unesc(val), 20);
        else if (key === 'N' && !cur.name) { const [fam = '', giv = ''] = unesc(val).split(';'); cur.name = clean(`${giv} ${fam}`, 20); }
        else if (key === 'BDAY') { const md = parseBday(val); if (md) [cur.m, cur.d] = md; }
      }
    }
    return out.map((c) => ({ ...c, img: '' }));
  }
  // 1990-10-14, 19901014, --1014, --10-14 (no year), with or without a time after it.
  function parseBday(v) {
    const m = String(v).trim().match(/^(?:\d{4}|--)-?(\d{2})-?(\d{2})/);
    if (!m) return null;
    const mo = +m[1], d = +m[2];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(2024, mo, 0).getDate() ? [mo, d] : null;
  }
  function showImport(list) {
    const seen = new Set(), key = (x) => `${x.name.toLowerCase()}|${x.m}|${x.d}`;
    const have = new Set(friends.map(key));
    importing = list.filter((c) => c.name && c.m >= 1 && c.m <= 12 && c.d >= 1 && c.d <= 31 && !seen.has(key(c)) && seen.add(key(c)))
      .map((c) => ({ ...c, saved: have.has(key(c)), on: !have.has(key(c)) }))
      .sort((a, b) => nextBirthday(a).days - nextBirthday(b).days);
    if (!importing.length) { toast('No birthdays found there', 3000); importPanel(null); renderBirthdays(); return; }
    renderImport();
    importPanel('pick');
    $('#bdayModal .modal-body').scrollTop = 0;
  }
  function renderImport() {
    const list = $('#importList'), fresh = importing.filter((c) => !c.saved), on = fresh.filter((c) => c.on).length;
    $('#importTitle').textContent = `${importing.length} ${importing.length === 1 ? 'birthday' : 'birthdays'} found`;
    $('#importAll').textContent = on === fresh.length ? 'Select none' : 'Select all';
    $('#importAdd').textContent = on ? `Add ${on}` : 'Add';
    $('#importAdd').disabled = !on;
    list.innerHTML = '';
    for (const c of importing) {
      const li = document.createElement('label');
      li.className = 'sheet-row pick-row' + (c.saved ? ' saved' : '');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = c.on; box.disabled = c.saved;
      box.addEventListener('change', () => { c.on = box.checked; renderImport(); });
      const av = document.createElement(c.img ? 'img' : 'span');
      av.className = 'row-avatar';
      if (c.img) { av.src = photoSrc(c.img); av.alt = ''; } else av.textContent = initials(c.name) || '🎂';
      const text = document.createElement('span'); text.className = 'row-text';
      const b = document.createElement('b'); b.textContent = c.name;
      const sm = document.createElement('small'); const nb = nextBirthday(c);
      sm.textContent = c.saved ? 'Already saved' : whenText(nb.days, nb.date);
      text.append(b, sm);
      li.append(box, av, text);
      list.append(li);
    }
  }
  $('#importAll').addEventListener('click', () => {
    const fresh = importing.filter((c) => !c.saved), all = fresh.every((c) => c.on);
    fresh.forEach((c) => { c.on = !all; });
    renderImport();
  });
  $('#importCancel').addEventListener('click', () => { importing = []; importPanel(null); renderBirthdays(); });
  $('#importAdd').addEventListener('click', () => {
    const add = importing.filter((c) => c.on && !c.saved).map((c, i) => ({
      id: Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 5), name: c.name, m: c.m, d: c.d, img: c.img || '',
    }));
    if (!add.length) return;
    const before = friends;
    friends = friends.concat(add);
    // Photos take the most room on the device: if everything doesn't fit, keep the birthdays without their photos.
    if (!saveList(BDAY_KEY, friends)) {
      friends = before.concat(add.map((f) => ({ ...f, img: '' })));
      if (!saveList(BDAY_KEY, friends)) { friends = before; return; }
    }
    importing = [];
    importPanel(null);
    syncReminders();
    renderBirthdays();
    achieve('bday1');
    if (friends.length >= 5) achieve('bday5');
    toast(`🎂 Added ${add.length} ${add.length === 1 ? 'birthday' : 'birthdays'}`, 3000);
  });

  // A square photo, shrunk to `size` px (JPEG base64).
  function readPhoto(file, size, quality) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight, m = Math.min(w, h), S = Math.min(size, m);
        c.width = c.height = S;
        c.getContext('2d').drawImage(img, (w - m) / 2, (h - m) * 0.3, m, m, 0, 0, S, S);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }
  // The small copy a card link carries (see processPhoto).
  function linkPhoto(b64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 200;
        c.getContext('2d').drawImage(img, 0, 0, 200, 200);
        let q = 0.78, d;
        do { d = c.toDataURL('image/jpeg', q); q -= 0.1; } while (d.length > 18000 && q > 0.3);
        resolve(d.split(',')[1]);
      };
      img.onerror = () => resolve('');
      img.src = photoSrc(b64);
    });
  }

  // Their card, filled in: name, photo, a birthday wish and your name; it opens at Scene to pick a background and music.
  async function makeBirthdayVideo(f) {
    const o = OCCASIONS[0];
    card.o = o.id; card.h = o.head; card.m = o.msg; card.p = o.theme; card.t = f.name; card.friend = f.id;
    try { card.f = card.f || localStorage.getItem('luts:from') || ''; } catch (e) { /* ignore */ }
    card.imgFull = f.img || '';
    card.img = f.img ? await linkPhoto(f.img) : '';
    closeSheets();
    openCardModal(null, 2);
  }

  // Web: a yearly calendar event with an alert the day before (the apps use a phone notification instead).
  function addToCalendar(f) {
    const { date } = nextBirthday(f), pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const esc = (t) => t.replace(/[\;,]/g, (c) => '\\' + c);
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Light Up the Skies//Birthdays//EN', 'BEGIN:VEVENT',
      `UID:${f.id}@lightuptheskies`, `DTSTAMP:${ymd(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(new Date(date.getTime() + 864e5))}`, 'RRULE:FREQ=YEARLY',
      `SUMMARY:${esc(`🎂 ${f.name}’s birthday`)}`,
      `DESCRIPTION:${esc(`Make ${f.name} a fireworks birthday video: ${appLink()}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15H', `DESCRIPTION:${esc(`${f.name}’s birthday is tomorrow`)}`, 'END:VALARM', // 9 am the day before
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    download(new Blob([ics], { type: 'text/calendar' }), `${f.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'birthday'}-birthday.ics`);
    toast('Open the file to add it to your calendar', 3200);
  }

  // ----- Daily joy -----
  let joys = loadList(JOY_KEY).filter((j) => j && /^\d{4}-\d\d-\d\d$/.test(j.d) && j.mood >= 1 && j.mood <= 5 && typeof j.t === 'string');
  const todayJoy = () => joys.find((j) => j.d === dayKey());
  // Days in a row, ending today, or yesterday while today is still to do.
  function joyStreak() {
    const days = new Set(joys.map((j) => j.d)), dt = new Date();
    if (!days.has(dayKey(dt))) dt.setDate(dt.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(dt))) { n++; dt.setDate(dt.getDate() - 1); }
    return n;
  }
  function bestStreak() {
    const days = [...new Set(joys.map((j) => j.d))].sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) {
      const t = new Date(`${d}T12:00:00`);
      run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    }
    return best;
  }
  let joyMood = 4;
  MOODS.forEach(([face, word], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mood'; b.setAttribute('role', 'radio');
    b.innerHTML = `<span aria-hidden="true">${face}</span><small>${word}</small>`;
    b.addEventListener('click', () => { joyMood = i + 1; renderMoods(); });
    $('#joyMoods').append(b);
  });
  function renderMoods() {
    [...$('#joyMoods').children].forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === joyMood)); b.classList.toggle('on', i + 1 === joyMood); });
  }
  function renderJoy() {
    const n = joyStreak(), best = bestStreak(), today = todayJoy();
    $('#joyStreak').innerHTML = '';
    const big = document.createElement('b');
    big.textContent = n ? `🔥 ${n}-day streak` : '✨ Start your streak today';
    const sm = document.createElement('small');
    sm.textContent = joys.length ? `Best ${best} ${best === 1 ? 'day' : 'days'} · ${joys.length} ${joys.length === 1 ? 'joy' : 'joys'} celebrated` : 'Come back each day to keep it going';
    $('#joyStreak').append(big, sm);
    $('#joyToday').hidden = !today;
    $('#joyForm').hidden = !!today;
    if (today) {
      $('#joyToday').innerHTML = '';
      const h = document.createElement('b'); h.textContent = `${MOODS[today.mood - 1][0]} Today you’re grateful for ${today.t}`;
      const p2 = document.createElement('small'); p2.textContent = today.m || 'Celebrated. See you tomorrow!';
      const share = document.createElement('button');
      share.type = 'button'; share.className = 'btn ghost small'; share.innerHTML = '<span class="btn-ico share-glyph" aria-hidden="true"></span>Share';
      share.addEventListener('click', () => shareJoy(today, n));
      $('#joyToday').append(h, p2, share);
    } else {
      renderMoods();
    }
    $('#btnJoyGo').innerHTML = `<span class="btn-ico firework-glyph" aria-hidden="true"></span>${today ? 'Play it again' : 'Celebrate'}`;
    const past = joys.filter((j) => !today || j !== today).slice(-14).reverse();
    $('#joyHistoryWrap').hidden = !past.length;
    $('#joyHistory').innerHTML = '';
    for (const j of past) {
      const li = document.createElement('li');
      li.className = 'sheet-row';
      const face = document.createElement('span'); face.className = 'row-avatar'; face.textContent = MOODS[j.mood - 1][0];
      const text = document.createElement('span'); text.className = 'row-text';
      const b = document.createElement('b'); b.textContent = j.t;
      const sm2 = document.createElement('small'); sm2.textContent = niceDate(j.d);
      text.append(b, sm2);
      li.append(face, text);
      $('#joyHistory').append(li);
    }
    updateHomeTiles();
  }
  $('#joyText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btnJoyGo').click(); } });
  $('#btnJoyGo').addEventListener('click', () => {
    Sound.resume();
    let j = todayJoy();
    if (!j) {
      const t = clean($('#joyText').value, 20), fld = $('#joyText').closest('.field');
      if (!t) { fld.classList.remove('invalid'); void fld.offsetWidth; fld.classList.add('invalid'); $('#joyText').focus(); return; }
      j = { d: dayKey(), mood: joyMood, t, m: cleanMsg($('#joyNote').value, 120) };
      joys.push(j);
      if (joys.length > 400) joys = joys.slice(-400);
      saveList(JOY_KEY, joys);
      $('#joyText').value = ''; $('#joyNote').value = '';
      const n = joyStreak();
      achieve('joy1');
      if (n >= 3) achieve('joy3');
      if (n >= 7) achieve('joy7');
      if (n >= 30) achieve('joy30');
      if (n > 1) toast(`🔥 ${n}-day streak! Keep the light going.`, 3000);
    }
    closeSheets();
    hideOverlay($('#intro'));
    playJoy(j);
  });
  function playJoy(j) {
    const mood = MOODS[j.mood - 1];
    playAndKeep({ kind: 'joy', o: 'thanks', t: j.t, h: 'Grateful for', m: j.m || `Today I’m grateful for ${j.t}.`, f: '', p: mood[2], w: '', img: '', own: true, day: joyStreak(), mood: j.mood, date: j.d });
  }
  // Shares how your day is going, with the app link for friends to celebrate theirs.
  async function shareJoy(j, day) {
    const text = `${MOODS[j.mood - 1][0]} Day ${day || joyStreak()} of gratitude: today I’m grateful for ${j.t}. ✨\nCelebrate yours in fireworks:`;
    const url = appLink();
    try {
      if (navigator.share) await navigator.share({ title: 'My daily joy', text, url });
      else { toast((await copyText(`${text} ${url}`)) ? 'Copied. Paste it anywhere to share.' : 'Could not copy'); }
      achieve('share');
      countLight();
    } catch (e) { /* cancelled */ }
  }
  $('#btnShareJoy').addEventListener('click', () => { if (currentCard && currentCard.kind === 'joy') shareJoy(currentCard, currentCard.day); });

  // ----- Home tiles: the next birthday and today's joy, at a glance -----
  function updateHomeTiles() {
    const next = upcoming()[0], tile = $('#btnBirthdays');
    tile.classList.toggle('soon', !!next && next.days <= 1);
    $('#tileBday').textContent = !next ? 'Never miss a friend’s day'
      : next.days === 0 ? `🎉 ${next.f.name} · today` : next.days === 1 ? `${next.f.name} · tomorrow` : `${next.f.name} · ${whenText(next.days, next.date)}`;
    const n = joyStreak(), done = !!todayJoy();
    $('#btnJoy').classList.toggle('soon', !done && n > 0);
    $('#tileJoy').textContent = done ? `🔥 ${n} ${n === 1 ? 'day' : 'days'} · done today` : n ? `🔥 ${n}-day streak · keep it going` : 'Celebrate one good thing';
    $('#setBdayNote').textContent = $('#tileBday').textContent;
    $('#setBirthdays').classList.toggle('soon', tile.classList.contains('soon'));
    $('#setJoyNote').textContent = $('#tileJoy').textContent;
    $('#setJoy').classList.toggle('soon', $('#btnJoy').classList.contains('soon'));
    syncRushTiles();
  }

  // First play: three things to try, once.
  function maybeWelcome() {
    let seen = true;
    try { seen = localStorage.getItem('luts:welcomed') === '1'; localStorage.setItem('luts:welcomed', '1'); } catch (e) { /* storage unavailable: skip it */ }
    if (!seen) setTimeout(() => { if (mode === 'play') openSheet($('#welcomeModal')); }, 900);
  }
  $('#btnWelcome').addEventListener('click', () => closeSheet($('#welcomeModal')));
  // A saved birthday today or tomorrow: a gentle pill on the play screen, once a day, straight to their video.
  let nudgeFriend = null, nudgeTimer = 0;
  function maybeNudge() {
    const next = upcoming()[0];
    if (!next || next.days > 1) return;
    const key = `${dayKey()}|${next.f.id}`;
    try { if (localStorage.getItem('luts:nudged') === key) return; localStorage.setItem('luts:nudged', key); } catch (e) { /* ignore */ }
    nudgeFriend = next.f;
    $('#nudgeText').textContent = next.days === 0 ? `🎉 ${next.f.name}’s birthday is today` : `🎂 ${next.f.name}’s birthday is tomorrow`;
    $('#nudge').hidden = false;
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => { $('#nudge').hidden = true; }, 12000);
  }
  $('#nudge').addEventListener('click', () => { $('#nudge').hidden = true; if (nudgeFriend) makeBirthdayVideo(nudgeFriend); });
  $('#btnBirthdays').addEventListener('click', () => {
    Sound.resume();
    $('#btnImportContacts').hidden = !nativeContacts();
    importing = []; importPanel(null); showBdayForm(false); renderBirthdays();
    openSheet($('#bdayModal'));
  });
  $('#btnJoy').addEventListener('click', () => { Sound.resume(); renderJoy(); openSheet($('#joyModal')); });

  // ---------- Lantern Rush: Daily Sky, friend challenges and free rounds ----------
  // 30 seconds of sky lanterns drifting up, to burst with fireworks. Each hit in a row raises the multiplier (×1 … ×10)
  // and a miss resets it. The lanterns come from a seed, so everyone gets the same sky on the same day (Daily Sky) and a
  // friend who opens your challenge link gets exactly your lanterns. Scores stay on this device; links carry the rest.
  const RUSH_SECS = 30, RUSH_KEY = 'luts:rush', LIGHTS_KEY = 'luts:lights';
  const DAILY_EPOCH = Date.UTC(2026, 9, 13); // Daily Sky #1
  const STARS = [300, 1000, 2000]; // points for one, two and three stars
  const RUSH_WORLDS = WORLDS.filter((w) => w.image).map((w) => w.id);
  const rush = { on: false, kind: 'free', seed: 0, world: '', t: 0, count: 4, plan: [], next: 0, live: [], pops: [], score: 0, combo: 0, best: 0, hits: 0, vs: null, ownWorld: null, last: null };
  const loadRush = () => { try { const v = JSON.parse(localStorage.getItem(RUSH_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const saveRush = (v) => { try { localStorage.setItem(RUSH_KEY, JSON.stringify(v)); } catch (e) { /* storage full: the round still counts on screen */ } };
  const fmt = (n) => Math.round(n).toLocaleString('en-IN');
  const starsFor = (score) => STARS.filter((s) => score >= s).length;
  const starText = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
  const dailyNo = (dt = new Date()) => Math.floor((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - DAILY_EPOCH) / 864e5) + 1;
  const dailyWorld = (n) => RUSH_WORLDS[((n % RUSH_WORLDS.length) + RUSH_WORLDS.length) % RUSH_WORLDS.length];
  const placeName = (id) => (WORLD_BY_ID[id] && WORLD_BY_ID[id].image ? WORLD_BY_ID[id].name : 'the night sky');
  const savedName = () => { try { return localStorage.getItem('luts:from') || ''; } catch (e) { return ''; } };
  const newSeed = () => (Math.random() * 2147483647) | 0;
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // The round's lanterns, in fractions of the screen and seconds, so every phone gets the same sky.
  function lanternPlan(seed) {
    const r = seeded(seed), out = [];
    for (let t = 0.6; t < RUSH_SECS - 2;) {
      const k = t / RUSH_SECS; // later lanterns come faster and more often
      out.push({ t, x: 0.12 + r() * 0.76, v: 0.05 + r() * 0.035 + k * 0.05, sway: 0.015 + r() * 0.03, ph: r() * TAU, gold: r() < 0.12 });
      t += 0.95 - k * 0.45 + r() * 0.3;
    }
    return out;
  }
  // Consecutive days with a Daily Sky, counting today once it is played.
  function dailyStreak(st = loadRush()) {
    const days = st.days || {}, d = new Date();
    if (days[dayKey(d)] === undefined) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days[dayKey(d)] !== undefined) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function startRush(kind, seed, wid, vs = null) {
    abortLaunch();
    Sound.resume();
    closeDrawer(); closeCardModal(); closeSheets();
    if (mode === 'card' || mode === 'envelope') { $('#envelope').hidden = true; exitCardMode(); }
    hideOverlay($('#intro'));
    mode = 'play';
    if (playMode !== 'sky') setPlayMode('sky');
    const now = world.pending || world.id;
    if (rush.ownWorld === null) rush.ownWorld = now;
    // A challenge or the Daily Sky may be over a Premium landmark: everyone gets to play it (like a received card).
    if (isWorld(wid) && wid !== now) selectWorld(wid, { silent: true, save: false, force: true });
    Object.assign(rush, { on: true, kind, seed, world: wid, t: -3, count: 4, plan: lanternPlan(seed), next: 0, live: [], pops: [], score: 0, combo: 0, best: 0, hits: 0, vs });
    document.body.classList.add('rushing');
    $('#rushHud').hidden = false;
    $('#rushTarget').hidden = !vs;
    if (vs) $('#rushTarget').textContent = `to beat ${fmt(vs.s)}`;
    el.hint.classList.add('gone');
    hudText = '';
    renderRushHud();
  }
  // Back to the landmark that was showing before a challenge borrowed the sky.
  function restoreRushWorld() {
    if (rush.ownWorld === null) return;
    const id = rush.ownWorld;
    rush.ownWorld = null;
    if (id !== (world.pending || world.id)) selectWorld(id, { silent: true, save: false, force: true });
  }

  function updateRush(dt) {
    if (!rush.on) return;
    rush.t += dt;
    if (rush.t < 0) {
      const c = Math.ceil(-rush.t);
      if (c !== rush.count) { rush.count = c; showCombo(String(c), rush.vs ? `beat ${fmt(rush.vs.s)}` : 'burst the lanterns'); }
      return;
    }
    if (rush.count) { rush.count = 0; showCombo('Go!', 'tap the lanterns'); }
    while (rush.next < rush.plan.length && rush.plan[rush.next].t <= rush.t) {
      const p = rush.plan[rush.next++];
      rush.live.push({ ...p, x0: p.x * W, x: p.x * W, y: H * 0.72, age: 0 });
    }
    for (let i = rush.live.length - 1; i >= 0; i--) {
      const l = rush.live[i];
      l.age += dt;
      l.y -= l.v * H * dt;
      l.x = l.x0 + Math.sin(l.ph + l.age * 1.4) * l.sway * W;
      if (l.y < H * 0.05) rush.live.splice(i, 1); // drifted away
    }
    for (let i = rush.pops.length - 1; i >= 0; i--) { rush.pops[i].age += dt; if (rush.pops[i].age > 0.9) rush.pops.splice(i, 1); }
    if (rush.t >= RUSH_SECS) endRush(false);
    else renderRushHud();
  }
  let hudText = '';
  function renderRushHud() {
    const left = Math.max(0, Math.ceil(RUSH_SECS - Math.max(0, rush.t)));
    const key = `${left}|${rush.score}|${rush.combo}`;
    if (key === hudText) return;
    hudText = key;
    $('#rushTime').textContent = left;
    $('#rushScore').textContent = fmt(rush.score);
    $('#rushCombo').textContent = rush.combo > 1 ? `×${Math.min(rush.combo, 10)}` : '';
    $('#rushHud').classList.toggle('ending', left <= 5 && rush.t >= 0);
  }
  // A burst from your tap: every lantern it reaches lights up and scores; reaching none breaks the run.
  function rushBurst(s) {
    if (rush.t < 0) return;
    const R = Math.max(54, 78 * U);
    const hits = rush.live.filter((l) => Math.hypot(l.x - s.x, l.y - s.y) < R);
    if (!hits.length) {
      // A second shell at a lantern that was just hit is not a miss (it was still in the air when you tapped again).
      if (rush.pops.some((p) => p.age < 1.2 && Math.hypot(p.x - s.x, p.y - s.y) < R * 1.4)) return;
      if (rush.combo >= 3) showCombo('Missed', `×${Math.min(rush.combo, 10)} lost`);
      rush.combo = 0;
      renderRushHud();
      return;
    }
    for (const l of hits) {
      rush.live.splice(rush.live.indexOf(l), 1);
      rush.combo++; rush.hits++;
      rush.best = Math.max(rush.best, rush.combo);
      const pts = 10 * Math.min(rush.combo, 10) * (l.gold ? 3 : 1);
      rush.score += pts;
      rush.pops.push({ x: l.x, y: l.y, age: 0, txt: `+${pts}`, gold: l.gold });
      crackleBurst(l.x, l.y);
    }
    if ([3, 5, 8, 12, 20].includes(rush.combo)) showCombo(`${rush.combo} in a row!`, `×${Math.min(rush.combo, 10)} points`);
    renderRushHud();
  }
  // A paper sky lantern: a warm glowing shade with a flame inside (gold ones score triple).
  function drawLantern(g, x, y, s, gold, age) {
    const w = 26 * s, h = 34 * s, flick = 0.85 + Math.sin(age * 9 + x) * 0.15;
    const glow = g.createRadialGradient(x, y + h * 0.1, 2, x, y, h * 1.9);
    glow.addColorStop(0, gold ? `rgba(255,236,150,${0.75 * flick})` : `rgba(255,180,90,${0.65 * flick})`);
    glow.addColorStop(0.45, gold ? 'rgba(255,214,90,0.22)' : 'rgba(255,150,60,0.18)');
    glow.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, h * 1.9, 0, TAU); g.fill();
    const body = g.createLinearGradient(x, y - h / 2, x, y + h / 2);
    body.addColorStop(0, gold ? '#fff3bf' : '#ffd38a');
    body.addColorStop(0.6, gold ? '#ffd24a' : '#ff9d3f');
    body.addColorStop(1, gold ? '#e8a300' : '#dc5a22');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(x - w * 0.42, y - h / 2); g.lineTo(x + w * 0.42, y - h / 2);
    g.quadraticCurveTo(x + w * 0.62, y, x + w * 0.36, y + h / 2); g.lineTo(x - w * 0.36, y + h / 2);
    g.quadraticCurveTo(x - w * 0.62, y, x - w * 0.42, y - h / 2);
    g.closePath(); g.fill();
    g.strokeStyle = gold ? 'rgba(255,248,214,0.9)' : 'rgba(255,236,200,0.75)'; g.lineWidth = 1.6; // a pale rim, so it reads over any landmark
    g.stroke();
    g.strokeStyle = 'rgba(150,60,20,0.35)'; g.lineWidth = 1;
    for (const k of [-0.17, 0.17]) { g.beginPath(); g.moveTo(x + w * k, y - h / 2); g.lineTo(x + w * k * 0.85, y + h / 2); g.stroke(); }
    g.fillStyle = '#fff7d6';
    g.beginPath(); g.ellipse(x, y + h * 0.34, 3 * s, 4.6 * s * flick, 0, 0, TAU); g.fill();
  }
  function drawRush() {
    if (!rush.on || (!rush.live.length && !rush.pops.length)) return;
    const g = ictx, s = Math.max(1.25, U * 1.7);
    g.save();
    for (const l of rush.live) drawLantern(g, l.x, l.y, s, l.gold, l.age);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(20 * s)}px Outfit, sans-serif`;
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6;
    for (const p of rush.pops) {
      g.globalAlpha = Math.max(0, 1 - p.age / 0.9);
      g.fillStyle = p.gold ? '#ffe27a' : '#fff4e0';
      g.fillText(p.txt, p.x, p.y - p.age * 46 * s);
    }
    g.restore();
  }

  function endRush(quit) {
    if (!rush.on) return;
    rush.on = false;
    document.body.classList.remove('rushing');
    $('#rushHud').hidden = true;
    rush.live = []; rush.pops = [];
    if (quit) return;
    const r = { kind: rush.kind, seed: rush.seed, world: rush.world, score: rush.score, best: rush.best, hits: rush.hits, total: rush.plan.length, vs: rush.vs };
    const st = loadRush();
    r.newBest = r.score > (st.best || 0) && r.score > 0;
    st.best = Math.max(st.best || 0, r.score);
    st.rounds = (st.rounds || 0) + 1;
    if (r.kind === 'daily') {
      st.days = st.days || {};
      st.days[dayKey()] = Math.max(st.days[dayKey()] ?? 0, r.score);
      const keys = Object.keys(st.days).sort();
      for (const old of keys.slice(0, Math.max(0, keys.length - 120))) delete st.days[old];
    }
    saveRush(st);
    rush.last = r;
    achieve('rush');
    if (r.kind === 'daily' && dailyStreak(st) >= 7) achieve('daily7');
    const won = r.vs && r.score > r.vs.s;
    if (won) achieve('rival');
    if (won || r.newBest) celebrate();
    showRushSheet('result');
  }

  // ----- The Lantern Rush screen: Daily Sky, a new round, a friend's invite, or a result -----
  let rushPlan = null, rushInvite = null; // what Play starts; the challenge from an opened link
  function showRushSheet(state) {
    const st = loadRush(), n = dailyNo(), card = $('#rushCard');
    card.innerHTML = '';
    const line = (cls, txt) => { const e = document.createElement('div'); e.className = cls; e.textContent = txt; card.append(e); };
    let title = 'Lantern Rush', sub = '', go = 'Play', share = false, chal = '';
    if (state === 'daily') {
      const wid = dailyWorld(n), today = st.days && st.days[dayKey()], streak = dailyStreak(st);
      rushPlan = { kind: 'daily', seed: 7919 * n + 13, world: wid };
      title = `Daily Sky #${n}`;
      sub = `Today’s lanterns over ${placeName(wid)}. The same sky for everyone, all day.`;
      if (today !== undefined) { line('rush-big', fmt(today)); line('rush-stars', starText(starsFor(today))); }
      line('rush-meta', today !== undefined ? `Today’s best · 🔥 ${streak}-day streak` : streak ? `🔥 ${streak}-day streak · keep it going` : 'Play every day to build a streak');
      go = today !== undefined ? 'Play again' : 'Play today’s sky';
    } else if (state === 'free') {
      rushPlan = { kind: 'free', seed: newSeed(), world: rush.ownWorld ?? (world.pending || world.id) };
      sub = 'Burst the lanterns, then dare a friend to beat your score on the very same sky.';
      line('rush-meta', st.best ? `Your best: ${fmt(st.best)} points` : 'Your first round');
    } else if (state === 'invite') {
      const vs = rushInvite;
      rushPlan = { kind: 'vs', seed: vs.k, world: vs.w, vs };
      title = `${vs.n || 'A friend'} challenges you!`;
      sub = `Beat ${fmt(vs.s)} points over ${placeName(vs.w)} in 30 seconds. Same lanterns, same sky.`;
      line('rush-big', fmt(vs.s));
      line('rush-meta', `${vs.n ? `${vs.n}’s` : 'Their'} score · best ${vs.c} in a row`);
      go = 'Accept challenge';
    } else {
      const r = rush.last;
      rushPlan = { kind: r.kind, seed: r.kind === 'free' ? newSeed() : r.seed, world: r.world, vs: r.vs };
      if (r.vs) {
        title = r.score > r.vs.s ? 'You won! 🥇' : r.score === r.vs.s ? 'A perfect tie!' : 'So close!';
        sub = `You ${fmt(r.score)} · ${r.vs.n || 'Your friend'} ${fmt(r.vs.s)}`;
        chal = 'Challenge back'; go = 'Try again';
      } else if (r.kind === 'daily') {
        title = `Daily Sky #${n}`;
        sub = r.newBest ? 'A new personal best!' : 'A new sky comes tomorrow.';
        share = true; chal = 'Challenge a friend'; go = 'Play again';
      } else {
        title = r.newBest ? 'New best score! ✨' : 'Lantern Rush';
        sub = 'Dare a friend to beat it on the very same sky.';
        chal = 'Challenge a friend'; go = 'Play again';
      }
      line('rush-big', fmt(r.score));
      line('rush-stars', starText(starsFor(r.score)));
      line('rush-meta', `${r.hits}/${r.total} lanterns · best ${r.best} in a row`);
    }
    $('#rushTitle').textContent = title;
    $('#rushSub').textContent = sub;
    $('#rushRules').hidden = state === 'result';
    $('#rushNameField').hidden = !chal;
    if (chal) $('#rushName').value = savedName();
    $('#btnRushShare').hidden = !share;
    $('#btnRushChallenge').hidden = !chal;
    if (chal) $('#btnRushChallenge').lastChild.textContent = chal;
    $('#btnRushGo').lastChild.textContent = go;
    openSheet($('#rushModal'));
  }
  sheets.push($('#rushModal'));
  $('#rushModal').addEventListener('pointerdown', (e) => { if (e.target === $('#rushModal')) closeSheet($('#rushModal')); });
  $('#btnRushGo').addEventListener('click', () => { if (rushPlan) startRush(rushPlan.kind, rushPlan.seed, rushPlan.world, rushPlan.vs || null); });
  $('#btnRushHome').addEventListener('click', () => {
    closeSheet($('#rushModal'));
    if (mode !== 'intro') $('#btnHome').click();
  });
  $('#btnDailySky').addEventListener('click', () => { Sound.resume(); showRushSheet('daily'); });
  $('#btnRush').addEventListener('click', () => { Sound.resume(); showRushSheet('free'); });

  // ----- Sharing: results, challenge links, badges -----
  const rushLink = (hash) => { const base = appLink(); return base ? `${base}#${hash}` : ''; };
  // Shares an image (when given) or text with a link; without a share sheet, saves the image and copies the text.
  async function shareThing({ title, text, url, blob, name }) {
    const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title, text: url ? `${text}\n${url}` : text });
      else if (navigator.share) await navigator.share(url ? { title, text, url } : { title, text });
      else {
        if (blob) download(blob, name);
        const ok = await copyText(url ? `${text} ${url}` : text);
        toast(blob ? (ok ? 'Badge saved and its text copied. Share them anywhere.' : 'Badge saved') : ok ? 'Copied. Paste it anywhere to share.' : 'Could not copy');
      }
    } catch (e) { return false; } // cancelled
    countLight();
    return true;
  }
  $('#btnRushShare').addEventListener('click', () => {
    const r = rush.last;
    if (!r) return;
    const text = `🏮 Light Up the Skies · Daily Sky #${dailyNo()}\n${starText(starsFor(r.score))} ${fmt(r.score)} points · ${r.best} in a row · 🔥 ${dailyStreak()}\nPlay today’s sky:`;
    shareThing({ title: `Daily Sky #${dailyNo()}`, text, url: rushLink('daily') });
  });
  $('#btnRushChallenge').addEventListener('click', () => {
    const r = rush.last;
    if (!r) return;
    const name = clean($('#rushName').value, 20);
    if (name) { try { localStorage.setItem('luts:from', name); } catch (e) { /* ignore */ } }
    const link = rushLink(`vs=${encodeCard({ n: name, s: r.score, c: r.best, k: r.seed, w: r.world })}`);
    const who = name || 'I';
    const text = r.vs && r.score > r.vs.s
      ? `🥇 ${who} beat ${r.vs.n || 'your'}${r.vs.n ? '’s' : ''} ${fmt(r.vs.s)} with ${fmt(r.score)} points of lanterns! Your turn, same sky:`
      : `🏮 ${who} burst ${fmt(r.score)} points of lanterns over ${placeName(r.world)}. Can you beat it? Same sky, 30 seconds:`;
    shareThing({ title: 'Lantern Rush challenge', text, url: link });
  });
  // A challenge or the Daily Sky, opened from a link: #vs=<b64 JSON> or #daily.
  function readRushHash() {
    if (/^#daily\b/.test(location.hash)) return { daily: true };
    const m = location.hash.match(/vs=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))));
      const num = (v, max) => (Number.isFinite(+v) ? clamp(Math.round(+v), 0, max) : 0);
      return { vs: { n: clean(raw.n, 20), s: num(raw.s, 999999), c: num(raw.c, 999), k: num(raw.k, 2147483647), w: isWorld(raw.w) ? raw.w : 'taj-mahal' } };
    } catch (e) { return null; }
  }
  function openRushFromHash() {
    const h = readRushHash();
    if (!h) return false;
    if (h.vs) { rushInvite = h.vs; showRushSheet('invite'); } else showRushSheet('daily');
    return true;
  }
  window.addEventListener('hashchange', () => { if (!rush.on) openRushFromHash(); });

  // A square-ish badge picture for an achievement, with the game's name, for WhatsApp status and the like.
  async function badgeImage(a) {
    if (document.fonts && document.fonts.load) await Promise.all(['700 78px Cinzel', '300 38px Outfit', '600 36px Outfit'].map((f) => document.fonts.load(f).catch(() => {})));
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1350);
    bg.addColorStop(0, '#2a1f5e'); bg.addColorStop(0.6, '#120f33'); bg.addColorStop(1, '#07071a');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    g.save();
    g.translate(540, 560);
    for (let i = 0; i < 24; i++) {
      g.rotate(TAU / 24);
      g.fillStyle = i % 2 ? 'rgba(255,210,122,0.07)' : 'rgba(255,160,90,0.03)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-70, -760); g.lineTo(70, -760); g.closePath(); g.fill();
    }
    g.restore();
    const glow = g.createRadialGradient(540, 560, 40, 540, 560, 340);
    glow.addColorStop(0, 'rgba(255,214,120,0.5)'); glow.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 1080, 1350);
    const ring = g.createLinearGradient(310, 330, 770, 790);
    ring.addColorStop(0, '#fff0bf'); ring.addColorStop(0.5, '#ffc95c'); ring.addColorStop(1, '#d98a1c');
    g.fillStyle = ring; g.beginPath(); g.arc(540, 560, 230, 0, TAU); g.fill();
    g.fillStyle = '#1b1745'; g.beginPath(); g.arc(540, 560, 200, 0, TAU); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '190px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.fillText(a[1], 540, 572);
    g.fillStyle = '#c9c6e6'; g.font = '600 34px Outfit, sans-serif';
    g.fillText('ACHIEVEMENT UNLOCKED', 540, 878);
    const tg = g.createLinearGradient(0, 925, 0, 1000);
    tg.addColorStop(0, '#fff2c4'); tg.addColorStop(1, '#f2a83a');
    g.fillStyle = tg; g.font = '700 78px Cinzel, Georgia, serif';
    g.fillText(a[2], 540, 962, 960);
    g.fillStyle = '#ebe5fb'; g.font = '300 38px Outfit, sans-serif';
    g.fillText(a[3], 540, 1044, 960);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 1178, 1080, 172);
    if (brandIcon.complete && brandIcon.naturalWidth) {
      g.save(); roundRect(g, 80, 1204, 120, 120, 28); g.clip(); g.drawImage(brandIcon, 80, 1204, 120, 120); g.restore();
    }
    g.textAlign = 'left';
    g.fillStyle = '#ffd77e'; g.font = '700 46px Cinzel, Georgia, serif';
    g.fillText('Light Up the Skies', 232, 1242);
    g.fillStyle = '#d2cdea'; g.font = '400 30px Outfit, sans-serif';
    g.fillText(window.LUTSNative ? 'Fireworks for every celebration · free on Google Play' : appLink().replace(/^https?:\/\//, '').replace(/\/$/, ''), 232, 1296, 800);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  async function shareBadge(id) {
    const a = ACH.find((x) => x[0] === id);
    if (!a || !achieved[id]) return;
    const blob = await badgeImage(a);
    shareThing({ title: a[2], text: `${a[1]} I unlocked “${a[2]}” in Light Up the Skies: ${a[3].charAt(0).toLowerCase()}${a[3].slice(1)}!`, url: appLink(), blob, name: `light-up-the-skies-${id}.png` });
  }

  // ----- Light-bringer: a rank for spreading light (cards, videos, challenges, badges and joy you share) -----
  const RANKS = [[0, '✨', 'Spark'], [3, '🪔', 'Diya'], [10, '🎇', 'Phuljhadi'], [25, '🚀', 'Rocket'], [60, '🌌', 'Sky Master']];
  const lights = () => { try { return +localStorage.getItem(LIGHTS_KEY) || 0; } catch (e) { return 0; } };
  const rankOf = (n) => RANKS.filter(([at]) => n >= at).pop();
  function countLight() {
    const before = lights(), n = before + 1;
    try { localStorage.setItem(LIGHTS_KEY, String(n)); } catch (e) { /* ignore */ }
    const r = rankOf(n);
    if (r !== rankOf(before)) {
      setTimeout(() => {
        toast(`${r[1]} You’re now a ${r[2]} light-bringer!`, 3600);
        if (r[2] === 'Sky Master') setTimeout(() => achieve('bringer'), 3800);
      }, 900);
    }
    renderBringer();
  }
  function renderBringer() {
    const n = lights(), r = rankOf(n), next = RANKS[RANKS.indexOf(r) + 1];
    $('#bringerRank').textContent = `${r[1]} ${r[2]}`;
    $('#bringerFill').style.width = `${next ? Math.round(((n - r[0]) / (next[0] - r[0])) * 100) : 100}%`;
    $('#bringerNote').textContent = next ? `${n} shared · ${next[0] - n} more to ${next[1]} ${next[2]}` : `${n} shared · the highest rank`;
  }
  renderBringer();

  // Home tiles for the Daily Sky and challenges.
  function syncRushTiles() {
    const st = loadRush(), n = dailyNo(), today = st.days && st.days[dayKey()], streak = dailyStreak(st);
    $('#btnDailySky').classList.toggle('soon', today === undefined);
    $('#tileDaily').textContent = today !== undefined ? `#${n} · ${starText(starsFor(today))} ${fmt(today)}` : streak ? `#${n} · 🔥 ${streak} · play today` : `#${n} · today’s lanterns`;
    $('#tileRush').textContent = st.best ? `Best ${fmt(st.best)} · dare a friend` : 'Beat a friend’s score';
  }

  // The logo takes you back home from anywhere.
  $('#btnHome').addEventListener('click', () => {
    abortLaunch();
    if (rush.on) endRush(true);
    restoreRushWorld();
    closeDrawer(); closeCardModal(); closeSheets();
    if (mode === 'card' || mode === 'envelope') { $('#envelope').hidden = true; exitCardMode(); }
    mode = 'intro';
    updateHomeTiles();
    $('#intro').hidden = false;
    document.body.classList.add('home');
  });
  updateHomeTiles();
  syncReminders();

  // ---------- Play modes: sky shells, ground crackers, sparkler writing ----------
  let playMode = 'sky';
  const HINTS = {
    sky: 'Choose a cracker. Tap Fire. Follow it into the sky.',
    ground: 'Choose a cracker. Place it. Tap Fire.',
    spark: 'Draw with your finger to write in sparkler light',
  };
  function setPlayMode(m) {
    if (launch.state !== 'READY') return;
    if (rush.on && m !== 'sky') endRush(true); // lanterns are a sky game
    if (pen) penUp();
    eraser = null;
    dragPreview = null;
    pointer = null;
    if (m !== 'spark') clearWriting();
    if (m !== 'ground') clearStreet();
    playMode = m;
    document.body.classList.remove('mode-sky', 'mode-ground', 'mode-spark');
    document.body.classList.add(`mode-${m}`);
    document.querySelectorAll('#modeTabs [data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    el.hint.textContent = HINTS[m];
    el.hint.classList.remove('gone');
    drawFloor();
    if (m === 'ground' && mode === 'play') placeSelectedCracker();
    syncLaunchUi();
  }
  document.querySelectorAll('#modeTabs [data-mode]').forEach((b) => b.addEventListener('click', () => setPlayMode(b.dataset.mode)));

  // ---------- Street floor ----------
  // The street ends just above the dock so crackers are never hidden under the controls.
  function groundBottom() {
    const controls = $('.bottom-ui');
    const bounds = controls.getBoundingClientRect();
    if (document.body.classList.contains('ui-hidden') || !bounds.height) return H - 12;
    return Math.min(H - 12, bounds.top - 12);
  }
  const floorH = () => clamp(H * 0.19, 80, 180); // deep enough for crackers to sit near and far
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
  const smokes = [], smokePool = [], smokeSprites = {};
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
    if (smokes.length >= 12 || stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars) return;
    const k = curScale;
    const m = smokePool.pop() || {};
    Object.assign(m, { x, y, vx: vx * k, vy: vy * k, col, r0: r0 * k, r1: r1 * k, life: Math.min(life, 3), a: a * curDim, age: 0 });
    smokes.push(m);
  }
  function updateSmoke(dt) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const m = smokes[i];
      m.age += dt;
      if (m.age >= m.life) { smokes[i] = smokes[smokes.length - 1]; smokes.pop(); smokePool.push(m); continue; }
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
  // Only the offset is worked out here; the 3D view's applyView() moves the layers (camera + shake together).
  let shake = 0, shakeX = 0, shakeY = 0;
  function applyShake(dt) {
    if (launch.state !== 'READY') { shake = shakeX = shakeY = 0; return; }
    if (shake <= 0) { shakeX = shakeY = 0; return; }
    shake = Math.max(0, shake - dt);
    const m = (shake / 0.45) * 9 * U;
    shakeX = shake ? rand(-m, m) : 0;
    shakeY = shake ? rand(-m, m) : 0;
  }

  // ---------- 3D view ----------
  // A camera that pivots on the street. Tilting the phone (or moving the mouse; otherwise a slow drift) moves far
  // layers more than near ones, so the sky, the fireworks and the skyline separate into depth, while everything you
  // touch on the street stays put. A landmark is drawn as a 3D photo: its depth map (assets/worlds/depth) lets the
  // building stand out from its sky. Embers drift in front of it all. Off in AR, with the setting off, and for people
  // who ask their device for reduced motion.
  const VIEW_DEPTH = { sky: 1, fx: 0.55, city: 0.22, atmo: -0.45 }; // share of the camera's move; the street is 0
  const view = {
    x: 0, y: 0, t: 0, A: 0, key: '', active: false,
    gyro: null, gyroAt: -1e9, base: null, mouse: null, mouseAt: -1e9, asked: false,
    on: () => settings.view3d && !arOn && !reduceMotion(),
  };
  // Where a layer at this depth sits now, in CSS px (up/down moves a little less than sideways).
  const layerShift = (d) => (view.active ? [-view.x * view.A * d, -view.y * view.A * 0.6 * d] : [0, 0]);
  // Opaque layers are drawn a touch larger so their edges never show while they move.
  const layerScale = (d) => (view.active ? 1 + (2.1 * view.A * d) / Math.min(W, H) : 1);

  function updateView(dt) {
    if (launch.state !== 'READY') { applyLaunchCamera(); return; }
    const on = view.on();
    if (on !== view.active) {
      view.active = on;
      document.body.classList.toggle('view3d', on);
      if (!on) { view.x = view.y = 0; clearAtmo(); }
      view.key = '';
    }
    if (on) {
      view.t += dt;
      const now = performance.now(), gyro = now - view.gyroAt < 1500;
      let tx = 0, ty = 0;
      if (gyro && view.gyro) [tx, ty] = view.gyro;
      else if (now - view.mouseAt < 4000 && view.mouse) [tx, ty] = view.mouse;
      // A slow drift keeps the scene alive when nothing moves it, and gives saved videos from a still phone depth.
      const drift = gyro ? 0.12 : 0.32;
      tx = clamp(tx + drift * Math.sin(view.t * 0.23), -1, 1);
      ty = clamp(ty + drift * 0.6 * Math.sin(view.t * 0.17 + 1.3), -1, 1);
      const k = 1 - Math.exp(-dt * 3.5);
      view.x += (tx - view.x) * k; view.y += (ty - view.y) * k;
      view.A = Math.min(W, H) * 0.05;
      drawAtmo(dt);
    }
    applyView();
  }

  function applyView() {
    const gl = view.active && world.img && glSky.ready;
    const key = `${gl}|${view.x.toFixed(4)}|${view.y.toFixed(4)}|${shakeX.toFixed(1)}|${shakeY.toFixed(1)}|${W}x${H}`;
    if (key === view.key && !glSky.dirty) return;
    view.key = key;
    const tf = (d, s) => {
      const [dx, dy] = layerShift(d), x = dx + shakeX, y = dy + shakeY;
      return x || y || s !== 1 ? `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})` : '';
    };
    // The 3D-photo sky moves itself (in its shader); the plain sky moves as a layer.
    skyC.style.visibility = gl ? 'hidden' : '';
    glSky.c.style.display = gl ? 'block' : 'none';
    skyC.style.transform = gl ? '' : tf(VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky));
    moonC.style.transform = skyC.style.transform;
    glSky.c.style.transform = gl && (shakeX || shakeY) ? `translate(${shakeX.toFixed(1)}px,${shakeY.toFixed(1)}px)` : '';
    fxC.style.transform = tf(VIEW_DEPTH.fx, 1);
    cityC.style.transform = tf(VIEW_DEPTH.city, layerScale(VIEW_DEPTH.city));
    atmoC.style.transform = tf(VIEW_DEPTH.atmo, 1);
    const front = shakeX || shakeY ? `translate(${shakeX.toFixed(1)}px,${shakeY.toFixed(1)}px)` : '';
    for (const c of [floorC, itemsC, paintC, gfxC]) c.style.transform = front;
    if (gl) renderGlSky();
  }

  // ----- The 3D-photo sky (WebGL) -----
  const glSky = { c: document.createElement('canvas'), gl: null, tex: null, dtex: null, uni: {}, ready: false, dirty: true };
  glSky.c.id = 'sky3d';
  glSky.c.setAttribute('aria-hidden', 'true');
  skyC.after(glSky.c);
  const depthC = document.createElement('canvas'), dctx = depthC.getContext('2d');
  (function initGlSky() {
    let gl = null;
    try { gl = glSky.c.getContext('webgl', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return; // no WebGL: the sky still moves as a flat layer
    const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
    // Each pixel shows the sky moved by the camera, pulled back towards the street by its depth (0 = sky, 1 = street);
    // three refinement steps find which pixel of the photo lands here.
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `precision mediump float;
      varying vec2 v; uniform sampler2D img, dep; uniform vec2 shift, inner; uniform float zoom;
      void main() {
        vec2 uv = (vec2(v.x, 1.0 - v.y) - 0.5) / zoom + 0.5;
        vec2 o = shift;
        for (int i = 0; i < 3; i++) o = shift + inner * texture2D(dep, uv - o).r;
        gl_FragColor = texture2D(img, clamp(uv - o, 0.0, 1.0));
      }`));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const texture = (unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    };
    glSky.tex = texture(0); glSky.dtex = texture(1);
    gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'dep'), 1);
    for (const n of ['shift', 'inner', 'zoom']) glSky.uni[n] = gl.getUniformLocation(prog, n);
    glSky.gl = gl;
    glSky.ready = true;
    glSky.c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glSky.ready = false; view.key = ''; });
  })();

  function renderGlSky() {
    const gl = glSky.gl;
    if (glSky.c.width !== skyC.width || glSky.c.height !== skyC.height) { glSky.c.width = skyC.width; glSky.c.height = skyC.height; glSky.dirty = true; }
    if (glSky.dirty) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glSky.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skyC);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glSky.dtex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthC);
      glSky.dirty = false;
    }
    const [sx, sy] = layerShift(VIEW_DEPTH.sky), zoom = layerScale(VIEW_DEPTH.sky);
    gl.viewport(0, 0, glSky.c.width, glSky.c.height);
    gl.uniform2f(glSky.uni.shift, sx / W / zoom, sy / H / zoom);
    gl.uniform2f(glSky.uni.inner, -0.85 * sx / W / zoom, -0.85 * sy / H / zoom); // the street (depth 1) barely moves
    gl.uniform1f(glSky.uni.zoom, zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // The landmark's depth map, laid out exactly like the photo in drawWorldSky (world.rect), with the reflection and
  // the street below it nearest. Without a depth map the whole sky moves as one flat layer.
  const depthImages = new Map();
  function loadWorldDepth(cfg) {
    if (!cfg.image) return Promise.resolve(null);
    if (!depthImages.has(cfg.id)) depthImages.set(cfg.id, loadImage(`${WORLD_DIR}depth/${cfg.image}.png`).catch(() => null));
    return depthImages.get(cfg.id);
  }
  function drawWorldDepth() {
    const w = Math.max(2, Math.round(W / 2)), h = Math.max(2, Math.round(H / 2));
    if (depthC.width !== w || depthC.height !== h) { depthC.width = w; depthC.height = h; }
    dctx.setTransform(w / W, 0, 0, h / H, 0, 0);
    dctx.fillStyle = '#000';
    dctx.fillRect(0, 0, W, H);
    const r = world.rect, cfg = world.cfg;
    if (!r) return;
    const base = r.dy + r.dh;
    const near = dctx.createLinearGradient(0, base, 0, H);
    near.addColorStop(0, 'rgb(225,225,225)'); near.addColorStop(1, '#fff');
    dctx.fillStyle = near;
    dctx.fillRect(0, base, W, H - base);
    loadWorldDepth(cfg).then((im) => {
      if (!im || world.cfg !== cfg) return;
      dctx.setTransform(w / W, 0, 0, h / H, 0, 0);
      dctx.drawImage(im, r.dx, r.dy, r.dw, r.dh);
      glSky.dirty = true;
      view.key = '';
    });
  }

  // ----- Embers in front of everything: the nearest thing in the scene, so they move against the sky -----
  const embers = [];
  function drawAtmo(dt) {
    if (!embers.length) {
      for (let i = 0; i < 12; i++) embers.push({ x: Math.random(), y: Math.random(), v: rand(0.012, 0.035), r: rand(0.9, 2.4), a: rand(0.25, 0.6), p: rand(0, TAU) });
    }
    actx.clearRect(0, 0, W, H);
    actx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.v * dt; e.p += dt * 1.3;
      if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
      const x = (e.x + Math.sin(e.p * 0.4) * 0.01) * W, y = e.y * H, r = e.r * U * 2.4;
      const g = actx.createRadialGradient(x, y, 0, x, y, r);
      const a = e.a * (0.7 + 0.3 * Math.sin(e.p * 2));
      g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(1, 'rgba(255,170,90,0)');
      actx.fillStyle = g;
      actx.beginPath(); actx.arc(x, y, r, 0, TAU); actx.fill();
    }
    actx.globalCompositeOperation = 'source-over';
  }
  function clearAtmo() { actx.clearRect(0, 0, W, H); }

  // ----- What moves the camera: the phone's tilt, else the mouse -----
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    const a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const [gx, gy] = a === 90 ? [e.beta, -e.gamma] : a === -90 || a === 270 ? [-e.beta, e.gamma] : a === 180 ? [-e.gamma, -e.beta] : [e.gamma, e.beta];
    // "Level" is however the phone is held: the reference follows slowly, so only fresh tilts move the view.
    if (!view.base) view.base = [gx, gy];
    view.base[0] += (gx - view.base[0]) * 0.006; view.base[1] += (gy - view.base[1]) * 0.006;
    view.gyro = [clamp((gx - view.base[0]) / 14, -1, 1), clamp((gy - view.base[1]) / 14, -1, 1)];
    view.gyroAt = performance.now();
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    view.mouse = [clamp((e.clientX / W - 0.5) * 1.6, -1, 1), clamp((e.clientY / H - 0.5) * 1.6, -1, 1)];
    view.mouseAt = performance.now();
  });
  // iPhone and iPad ask before sharing motion; that question has to come from a tap.
  function askMotion() {
    if (view.asked || !settings.view3d) return;
    const D = window.DeviceOrientationEvent;
    if (!D || typeof D.requestPermission !== 'function') return;
    view.asked = true;
    D.requestPermission().catch(() => {});
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
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars) return;
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

  // A cracker's depth on the street: 0 at the far kerb, 1 nearest you. Higher up means farther away: smaller and
  // dimmer, with smaller sparks, smoke and glow (atDepth), and quieter.
  function itemDepth(y) { const top = floorTop(), bot = groundBottom(); return clamp((y - top) / Math.max(1, bot - top), 0, 1); }
  // Ground crackers drawn 35% larger so they read clearly on phones; their spark budgets stay capped (atDepth clamps s).
  function itemScale(y) { return (0.55 + 0.75 * itemDepth(y)) * 1.35; }
  // Runs a cracker's effects and sounds at its distance.
  function atDepth(it, fn) {
    const z = it.z ?? itemDepth(it.y);
    curLayer = 1; curScale = clamp(it.s, 0.6, 1.15); curDim = 0.6 + 0.4 * z; Sound.dist = 0.4 + 0.6 * z;
    try { fn(); } finally { curLayer = 0; curScale = 1; curDim = 1; Sound.dist = 1; }
  }
  function tipPos(it) {
    const def = ITEMS[it.type], S = it.s * U * 1.3;
    let [x, y] = def.tipAt ? def.tipAt(it) : def.tip;
    if (it.type === 'bomb' && !it.lit) { const f = it.armed ? clamp(it.t / def.fuse, 0, 1) : 0; x = 6 * (1 - f) + 2 * f; y = -30 + 8 * f; }
    return [it.x + x * S, it.y - (it.hy || 0) + y * S];
  }
  function glowAt(x, y, col, r, a) {
    r *= curScale; a *= curDim;
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
    const py = y >= top - 40 * U ? clamp(y, top + fh * 0.12, bot) : top + fh * rand(0.15, 0.95);
    return [clamp(x, 30, W - 30), py];
  }
  // Drag-and-drop only accepts drops on (or just above) the street.
  function dropPoint(x, y) {
    const top = floorTop(), bot = groundBottom();
    if (y < top - 50 * U || y > bot + 40) return null;
    return [clamp(x, 30, W - 30), clamp(y, top + (bot - top) * 0.12, bot)];
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
      type, x: px, y: py, s: itemScale(py), z: itemDepth(py), t: 0, rot: Math.random() * TAU, armed: false, lit: false, done: false, gone: 0, hy: 0,
      dur: def.dur, color: type === 'smoke' ? pick(SMOKE_COLORS) : color(), popped: 0, shots: 0, acc: 0,
    };
    groundItems.push(it);
    sortItems();
    queueBurstSync();
    atDepth(it, () => Sound.tick(pan(px)));
    return it;
  }
  function moveItem(it, x, y) {
    const [px, py] = groundPoint(x, Math.max(y, floorTop()));
    it.x = px; it.y = py; it.s = itemScale(py); it.z = itemDepth(py);
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
    if (!launch.sequence || launch.sequence.item !== it) return;
    if (it.armed || it.done) return;
    it.armed = true;
    it.t = 0;
    atDepth(it, () => Sound.hiss(ITEMS[it.type].fuse + 0.1, 6000, 0.05, pan(it.x), { q: 0.4 }));
    achieve('first');
    if (!tried.has(it.type)) {
      tried.add(it.type);
      try { localStorage.setItem('luts:tried', JSON.stringify([...tried])); } catch (e) { /* ignore */ }
      if (ITEM_ORDER.every((t) => tried.has(t))) achieve('collector');
    }
  }
  function clearStreet() {
    for (let i = groundItems.length - 1; i >= 0; i--) if (!groundItems[i].armed) groundItems.splice(i, 1);
    queueBurstSync();
  }
  // The Burst all count follows the street; deferred a frame so it is safe to call from anywhere, even during boot.
  let burstSyncRaf = 0;
  function queueBurstSync() { if (!burstSyncRaf) burstSyncRaf = requestAnimationFrame(() => { burstSyncRaf = 0; syncBurstAll(); }); }

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
        atDepth(it, () => {
          if (Math.random() < 0.8) spark(fx, fy, rand(-40, 40) * U, rand(-60, 10) * U, pick(GOLD), rand(0.1, 0.3));
          glowAt(fx, fy, '#ffcf6b', 10 * U, 0.6);
        });
        if (it.t >= def.fuse) {
          it.lit = true; it.t = 0;
          runningGroundEffect = true;
          try { atDepth(it, () => def.ignite(it)); } finally { runningGroundEffect = false; }
          if (!['bomb', 'mine', 'popper'].includes(it.type)) bumpMeter(4);
        }
        continue;
      }
      burning++;
      runningGroundEffect = true;
      try { atDepth(it, () => def.run(it, it.t, dt)); } finally { runningGroundEffect = false; }
      if (it.t >= it.dur) it.done = true;
    }
    if (burning >= 5) achieve('festival');
  }

  // Real crackers on the street: transparent cutouts (assets/ground/<type>.webp, .png fallback), drawn standing on the
  // item's base point at its hit-box size. Crackers whose shape changes as they burn (the laddi's links popping, the
  // spinners) stay drawn; a rocket keeps its cutout only until it has flown.
  const GROUND_ART = ['flowerpot', 'anar', 'fountain', 'mine', 'multishot', 'roman', 'shell', 'cake', 'finale', 'basket', 'bomb',
    'firecracker', 'strobe', 'popper', 'smoke', 'lantern', 'rocket', 'rocketcombo'];
  const groundArt = {};
  for (const type of GROUND_ART) {
    const img = new Image();
    img.decoding = 'async';
    img.addEventListener('error', () => { if (img.src.endsWith('.webp')) img.src = `assets/ground/${type}.png`; else delete groundArt[type]; });
    img.src = `assets/ground/${type}.webp`;
    groundArt[type] = img;
  }
  function drawGroundArt(g, type, S, it) {
    const img = groundArt[type];
    if (!img || !img.complete || !img.naturalWidth) return false;
    if (type === 'rocket' && it && it.fired) return false;
    if (type === 'rocketcombo' && it && (it.shots > 0 || it.lit)) return false;
    const [hw, hh] = HIT[type] || [13, 30];
    const k = Math.min((hw * 2.3) / img.naturalWidth, (hh * 1.05) / img.naturalHeight) * S;
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    if (type === 'lantern' && it && it.lit) { // a lit lantern glows from inside
      const glow = g.createRadialGradient(0, -h * 0.4, 0, 0, -h * 0.4, h * 0.9);
      glow.addColorStop(0, 'rgba(255,190,90,0.55)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(0, -h * 0.4, h * 0.9, 0, TAU); g.fill();
    }
    g.drawImage(img, -w / 2, -h, w, h);
    return true;
  }
  function drawItemShape(g, type, S, it) {
    const lit = it && it.lit, t = it ? it.t : 0;
    if (!(it && it.hy > 2)) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(0, 1, (SHADOW_W[type] || 13) * S, 3.5 * S, 0, 0, TAU); g.fill();
    }
    if (drawGroundArt(g, type, S, it)) return;
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
  // Burning crackers light a flickering pool of street around them in their own colour, and every other cracker casts
  // a shadow away from that light. Both follow the street's perspective: flatter and smaller farther away. In AR they
  // fall on the camera picture.
  const catchLight = []; // crackers lit by a neighbour this frame: [item, strength, colour, side facing the light]
  function drawStreetLight() {
    const lights = [];
    catchLight.length = 0;
    for (const it of groundItems) {
      if (!it.armed || it.done || it.t < 0) continue;
      const k = it.lit ? 0.78 + 0.22 * Math.sin(gameTime * 23 + it.rot) * Math.sin(gameTime * 7.3 + it.rot) : 0.3; // a fuse glows small
      lights.push({ it, k, z: it.z ?? 1, S: it.s * U * 1.3 });
    }
    if (!lights.length) return;
    const g = ictx;
    g.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const { it } = L, rx = 150 * L.S, flat = 0.24 + 0.14 * L.z; // a street seen at a low angle looks flatter far away
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, rgba(it.color, 0.42 * L.k * (0.6 + 0.4 * L.z)));
      grd.addColorStop(0.4, rgba(it.color, 0.17 * L.k));
      grd.addColorStop(1, rgba(it.color, 0));
      g.save();
      g.translate(it.x, it.y + 2);
      g.scale(1, flat);
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    for (const it of groundItems) {
      if (it.done) continue;
      let sx = 0, sy = 0, w = 0, col = null, best = 0;
      for (const L of lights) {
        if (L.it === it) continue;
        const dx = it.x - L.it.x, dy = it.y - L.it.y, d = Math.hypot(dx, dy * 1.6) || 1; // across the street counts more
        const R = 340 * U * (0.6 + 0.4 * L.z);
        if (d > R) continue;
        const f = (1 - d / R) ** 2 * L.k;
        sx += (dx / d) * f; sy += (dy / d) * f; w += f;
        if (f > best) { best = f; col = L.it.color; }
      }
      if (w < 0.03) continue;
      catchLight.push([it, Math.min(1, w), col, Math.sign(-sx) || 1]);
      const S = it.s * U * 1.3, len = (20 + 34 * Math.min(1, w)) * S, half = (SHADOW_W[it.type] || 13) * S * 0.5;
      const sh = g.createLinearGradient(0, 0, len, 0);
      sh.addColorStop(0, 'rgba(0,0,0,0.75)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(it.x, it.y + 1);
      g.rotate(Math.atan2(sy * 0.35, sx)); // laid flat on the street
      g.globalAlpha = Math.min(0.75, w * 0.9) * (0.6 + 0.4 * (it.z ?? 1));
      g.fillStyle = sh;
      g.beginPath(); g.ellipse(len * 0.45, 0, len * 0.55, Math.max(2, half * 0.55), 0, 0, TAU); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }
  // After the crackers are drawn: the side facing a burning neighbour catches its colour.
  function drawCatchLight() {
    if (!catchLight.length) return;
    const g = ictx;
    g.globalCompositeOperation = 'lighter';
    for (const [it, w, col, side] of catchLight) {
      const S = it.s * U * 1.3, r = 22 * S, x = it.x + side * 5 * S, y = it.y - (it.hy || 0) - 14 * S;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(col, 0.55 * w));
      grd.addColorStop(1, rgba(col, 0));
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
  }
  let dragPreview = null;
  const ringW = (type) => Math.max(18, (HIT[type] || [14])[0] + 4);
  function drawGroundItems() {
    ictx.clearRect(0, 0, W, H);
    if (!groundItems.length && !dragPreview && !confettis.length) return;
    const gctx = ictx; // sprites are redrawn crisply each frame, so they never smear
    drawStreetLight();
    for (const it of groundItems) {
      const keep = ITEMS[it.type].keep ?? 0.7;
      // Far crackers fade a little into the night.
      gctx.globalAlpha = (it.done ? (keep ? Math.max(0, 1 - it.gone / keep) : 0) : 1) * (0.62 + 0.38 * (it.z ?? 1));
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
    drawCatchLight();
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
  function placeSelectedCracker() {
    if (launch.state !== 'READY') return;
    clearStreet();
    placeItem(settings.item, W * 0.5, floorTop() + floorH() * 0.58);
  }
  // Premium: each cracker picked joins the others on the street (spread out so they don't overlap), ready for Burst all.
  const BURST_MAX = 8;
  // Premium from the store, or the Play reviewer code (Settings title tapped 7 times), so reviewers can try it too.
  const burstEntitled = () => crackerEntitled || reviewerAccess;
  const waitingItems = () => groundItems.filter((it) => !it.armed && !it.done);
  function addSelectedCracker() {
    if (launch.state !== 'READY') return;
    const n = waitingItems().length;
    if (n >= BURST_MAX) { toast(`Up to ${BURST_MAX} crackers at once. Tap Burst all!`); return; }
    placeItem(settings.item, W * (0.14 + 0.72 * ((n * 0.618 + 0.5) % 1)), floorTop() + floorH() * (0.42 + 0.3 * ((n * 0.37) % 1)));
  }
  // Drag a cracker from the list onto the street: Premium players add it there (up to BURST_MAX, for Burst all);
  // free players move their one cracker to the drop spot. A short tap still works as before.
  function startChipDrag(e, chip, id) {
    if (launch.state !== 'READY' || mode !== 'play' || playMode !== 'ground') return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let dragging = false;
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!dragging && Math.abs(ev.clientY - sy) > 14 && Math.abs(ev.clientY - sy) > Math.abs(ev.clientX - sx)) {
        dragging = true; chip.dataset.dragged = '1';
        try { chip.setPointerCapture(pid); } catch (err) { /* ignore */ }
      }
      if (!dragging) return;
      ev.preventDefault();
      const [x, y] = groundPoint(ev.clientX, Math.max(ev.clientY, floorTop()));
      dragPreview = { type: id, x, y };
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      if (dragging) setTimeout(() => { delete chip.dataset.dragged; }, 400); // a cancelled drag sends no click to clear it
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      const drop = dragPreview; dragPreview = null;
      if (!dragging || !drop || ev.type === 'pointercancel' || launch.state !== 'READY') return;
      if (ev.clientY > chip.getBoundingClientRect().top - 8) return; // released back over the list: nothing placed
      settings.item = id; saveSettings(); syncModeUi();
      if (burstEntitled()) {
        if (waitingItems().length >= BURST_MAX) { toast(`Up to ${BURST_MAX} crackers at once. Tap Burst all!`); return; }
      } else clearStreet();
      placeItem(id, drop.x, drop.y);
      syncLaunchUi();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  // Premium "Tap sky": every tap fires a fast shell that bursts where you touched, for a relaxed show. No points are
  // earned. Shells in flight are capped (fewer on the low tier) so a weak phone never floods with particles.
  let tapSky = false;
  try { tapSky = localStorage.getItem('luts:tapsky') === '1'; } catch (e) { /* ignore */ }
  const tapSkyOn = () => tapSky && burstEntitled() && mode === 'play' && playMode === 'sky' && !rush.on && launch.state === 'READY';
  function tapFire(x, y) {
    if (shells.length >= (Q().maxStars < 300 ? 3 : 6)) return;
    el.hint.classList.add('gone');
    const [dx, dy] = layerShift(VIEW_DEPTH.fx);
    launchShell({ x: x - dx, y: clamp(y - dy, H * 0.08, H * 0.72), type: resolveType(settings.shell), user: true, exact: true, fast: 1.5, tap: true });
  }
  const tapSkyBtn = $('#btnTapSky');
  tapSkyBtn.addEventListener('click', () => {
    if (!burstEntitled()) { openPremium(); return; }
    tapSky = !tapSky;
    try { localStorage.setItem('luts:tapsky', tapSky ? '1' : '0'); } catch (e) { /* ignore */ }
    toast(tapSky ? 'Tap anywhere in the sky to fire' : 'Tap sky off');
    syncBurstAll();
  });
  const burstAllBtn = $('#btnBurstAll');
  function syncBurstAll() {
    const n = waitingItems().length, busy = launch.state !== 'READY';
    burstAllBtn.hidden = mode !== 'play' || playMode !== 'ground' || rush.on;
    const paid = burstEntitled();
    burstAllBtn.classList.toggle('locked', !paid);
    $('#burstAllLabel').textContent = paid && n > 1 ? `Burst all · ${n}` : 'Burst all';
    burstAllBtn.disabled = busy || (paid && n < 2);
    for (const b of [$('#btnAR'), $('#setAR')]) b.classList.toggle('locked', !paid); // AR is Premium too
    tapSkyBtn.classList.toggle('locked', !paid);
    tapSkyBtn.setAttribute('aria-pressed', String(paid && tapSky));
    $('#tapSkyLabel').textContent = paid && tapSky ? 'Tap sky: on' : 'Tap sky';
    tapSkyBtn.hidden = mode !== 'play' || rush.on;
    tapSkyBtn.disabled = launch.state !== 'READY';
    burstAllBtn.title = paid ? 'Light every cracker on the street together' : 'Premium: light many crackers together';
  }
  burstAllBtn.addEventListener('click', () => {
    if (!burstEntitled()) { openPremium(); return; }
    if (waitingItems().length < 2) { toast('Pick a few crackers first, then Burst all'); return; }
    if (mode !== 'play' || paused || document.hidden || rewardBusy || launch.state !== 'READY') return;
    launch.request({ id: 'item:all', label: 'Burst all', type: settings.item, ground: true, multi: true });
  });
  for (const id of ITEM_ORDER) {
    const b = document.createElement('button');
    b.className = 'shell-chip';
    b.dataset.item = id;
    b.innerHTML = '<span class="ico"><img alt=""></span><span></span>';
    b.dataset.sprite = itemIcon(id); // the drawn cracker, also used while dragging it onto the street
    setChipArt(b, id, () => b.dataset.sprite);
    b.lastChild.textContent = ITEMS[id].label;
    b.title = ITEMS[id].label;
    b.addEventListener('pointerdown', (e) => startChipDrag(e, b, id));
    b.addEventListener('click', () => {
      if (b.dataset.dragged) { delete b.dataset.dragged; return; } // a drag already placed it
      if (launch.state !== 'READY') return;
      settings.item = id; saveSettings(); syncModeUi();
      if (mode === 'play' && playMode === 'ground') (burstEntitled() ? addSelectedCracker() : placeSelectedCracker());
      syncLaunchUi();
    });
    groundList.append(b);
  }
  $('#btnClearStreet').addEventListener('click', () => { clearStreet(); clearWriting(); });

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
  function penUp() { pen = null; Sound.sparklerStop(); syncDrawingAction(); }
  let sparkTool = 'pen', eraser = null, strokesDirty = false;
  function sparkDown(x, y) {
    if (sparkTool === 'erase') { eraser = { x, y }; eraseAt(x, y); return; }
    // Touching a placed shape picks it up; otherwise the chosen shape is stamped here (and can be slid at once).
    const hit = shapeAt(x, y);
    if (hit) { shapeDrag = { g: hit, x, y }; return; }
    if (sparkShape) { const g = placeShape(sparkShape, x, y); if (g) shapeDrag = { g, x, y }; return; }
    penDown(x, y);
  }
  function sparkMove(x, y) {
    if (eraser) { eraser.x = x; eraser.y = y; eraseAt(x, y); return; }
    if (shapeDrag) { moveShape(shapeDrag.g, x - shapeDrag.x, y - shapeDrag.y); shapeDrag.x = x; shapeDrag.y = y; return; }
    penMove(x, y);
  }
  function sparkUp() { eraser = null; shapeDrag = null; if (pen) penUp(); }

  // ---------- Sparkler shapes (faces, crown, ...) ----------
  // Each shape is a few polylines in a -1..1 box; placing it adds sparkler strokes sharing a group id (g), so it
  // glows, erases, undoes and bursts like hand-drawn writing. Works over the sky and over the AR camera alike.
  const arc = (cx, cy, rx, ry, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const ring = (cx, cy, r, ry = r) => arc(cx, cy, r, ry, 0, TAU, 28);
  const heartPath = (cx, cy, s) => Array.from({ length: 33 }, (_, i) => { const t = i / 32 * TAU; return [cx + s * 0.0625 * 16 * Math.sin(t) ** 3, cy - s * 0.0625 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; });
  const starPath = (cx, cy, r) => Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r; return [cx + Math.cos(a) * k, cy + Math.sin(a) * k]; });
  const SHAPES = {
    smile: { label: 'Smile', lines: () => [ring(0, 0, 1), ring(-0.35, -0.25, 0.1), ring(0.35, -0.25, 0.1), arc(0, 0.05, 0.55, 0.5, 0.2, Math.PI - 0.2)] },
    love: { label: 'Love eyes', lines: () => [ring(0, 0, 1), heartPath(-0.36, -0.2, 0.3), heartPath(0.36, -0.2, 0.3), arc(0, 0.1, 0.5, 0.45, 0.25, Math.PI - 0.25)] },
    cat: { label: 'Cat face', lines: () => [arc(0, 0.1, 0.95, 0.85, -0.3, Math.PI + 0.3, 24), [[-0.9, -0.05], [-0.75, -0.95], [-0.3, -0.6]], [[0.9, -0.05], [0.75, -0.95], [0.3, -0.6]], ring(-0.35, 0.05, 0.1), ring(0.35, 0.05, 0.1), [[-0.12, 0.3], [0, 0.4], [0.12, 0.3]], [[-0.9, 0.35], [-0.3, 0.4]], [[0.9, 0.35], [0.3, 0.4]]] },
    crown: { label: 'Crown', lines: () => [[[-1, 0.5], [-1, -0.4], [-0.5, 0.1], [0, -0.7], [0.5, 0.1], [1, -0.4], [1, 0.5], [-1, 0.5]], ring(-1, -0.5, 0.1), ring(0, -0.8, 0.12), ring(1, -0.5, 0.1), ring(0, 0.25, 0.1)] },
    shades: { label: 'Sunglasses', lines: () => [arc(-0.5, -0.05, 0.42, 0.32, 0, TAU, 22), arc(0.5, -0.05, 0.42, 0.32, 0, TAU, 22), arc(0, -0.05, 0.16, 0.12, Math.PI, TAU, 8), [[-0.92, -0.15], [-1, -0.3]], [[0.92, -0.15], [1, -0.3]]] },
    moustache: { label: 'Moustache', lines: () => [[[0, -0.1], ...arc(-0.45, -0.05, 0.45, 0.3, 0, Math.PI, 14), ...arc(-0.95, -0.25, 0.15, 0.2, Math.PI * 0.5, -Math.PI * 0.6, 8)], [[0, -0.1], ...arc(0.45, -0.05, 0.45, 0.3, Math.PI, 0, 14), ...arc(0.95, -0.25, 0.15, 0.2, Math.PI * 0.5, Math.PI * 1.6, 8)]] },
    halo: { label: 'Halo', lines: () => [ring(0, 0, 1, 0.32), ring(0, 0, 0.82, 0.24)] },
    bunny: { label: 'Bunny ears', lines: () => [arc(-0.45, -0.1, 0.25, 0.85, 0, TAU, 24), arc(0.45, -0.1, 0.25, 0.85, 0, TAU, 24), arc(-0.45, -0.05, 0.1, 0.55, 0, TAU, 16), arc(0.45, -0.05, 0.1, 0.55, 0, TAU, 16)] },
    heart: { label: 'Heart', lines: () => [heartPath(0, 0.05, 1)] },
    star: { label: 'Star', lines: () => [starPath(0, 0.05, 1)] },
    diya: { label: 'Diya', lines: () => [[...arc(0, 0.1, 1, 0.55, 0, Math.PI, 18), [-1, 0.1], [1, 0.1]], [[0, 0.05], [-0.18, -0.35], [0, -0.85], [0.18, -0.35], [0, 0.05]]] },
  };
  let sparkShape = null, shapeDrag = null, shapeGroup = 0;
  const shapeSize = () => clamp(Math.min(W, H) * 0.17, 46, 150);
  function placeShape(id, x, y) {
    const def = SHAPES[id]; if (!def) return 0;
    if (strokes.length > 7400) { toast('The sky is full of light. Burst it first!'); return 0; }
    const g = ++shapeGroup, s = shapeSize(), hue = rand(0, 360), step = Math.max(4, 5 * U);
    for (const line of def.lines()) {
      strokeId++;
      for (let i = 0; i < line.length; i++) {
        const [px, py] = line[i], c = settings.spark === 'rainbow' ? `hsl(${(hue + i * 9) % 360},100%,68%)` : (SPARK_COLORS[settings.spark] || SPARK_COLORS.gold);
        strokes.push({ x: x + px * s, y: y + py * s, c, id: strokeId, g });
        // densify long segments so the shape bursts evenly
        const nx = line[i + 1];
        if (nx) { const d = Math.hypot((nx[0] - px) * s, (nx[1] - py) * s), k = Math.floor(d / step); for (let j = 1; j < k; j++) strokes.push({ x: x + (px + (nx[0] - px) * j / k) * s, y: y + (py + (nx[1] - py) * j / k) * s, c, id: strokeId, g }); }
      }
    }
    penSparks(x, y, 14); Sound.tick(pan(x));
    strokesDirty = true;
    return g;
  }
  function moveShape(g, dx, dy) {
    for (const p of strokes) if (p.g === g) { p.x += dx; p.y += dy; }
    strokesDirty = true;
  }
  // The placed shape under a touch: nearest light point of any shape within reach (newest shapes win ties).
  function shapeAt(x, y) {
    const r = Math.max(28, shapeSize() * 0.35); let best = 0, bd = r;
    for (let i = strokes.length - 1; i >= 0; i--) { const p = strokes[i]; if (!p.g) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.g; } }
    if (best) return best;
    // inside a shape's outline also counts (e.g. touching the middle of a face)
    const boxes = {};
    for (const p of strokes) if (p.g) { const b = boxes[p.g] || (boxes[p.g] = [p.x, p.y, p.x, p.y]); b[0] = Math.min(b[0], p.x); b[1] = Math.min(b[1], p.y); b[2] = Math.max(b[2], p.x); b[3] = Math.max(b[3], p.y); }
    for (const g of Object.keys(boxes).reverse()) { const b = boxes[g]; if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return +g; }
    return 0;
  }
  function shapeIcon(id) {
    const c = document.createElement('canvas'); c.width = c.height = 68;
    const g = c.getContext('2d'); g.strokeStyle = '#ffd27a'; g.lineWidth = 3.2; g.lineCap = g.lineJoin = 'round'; g.shadowColor = '#ffb347'; g.shadowBlur = 6;
    for (const line of SHAPES[id].lines()) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, 34 + x * 26, 36 + y * 26)); g.stroke(); }
    return c.toDataURL();
  }
  const shapeList = $('#shapeList');
  function syncShapeUi() { shapeList.querySelectorAll('.shape-chip').forEach((b) => { const on = (b.dataset.shape || null) === sparkShape; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }); }
  for (const id of [null, ...Object.keys(SHAPES)]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'shape-chip';
    if (id) b.dataset.shape = id;
    const img = document.createElement('img'); img.alt = '';
    img.src = id ? shapeIcon(id) : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"/></svg>');
    const t = document.createElement('span'); t.textContent = id ? SHAPES[id].label : 'Draw';
    b.append(img, t);
    b.addEventListener('click', () => {
      sparkShape = id; setSparkTool('pen'); syncShapeUi();
      if (!id) { toast('Draw with your finger'); return; }
      // Tapping a shape puts one on screen straight away, a little apart from the last; drag it into place.
      if (mode === 'play' && playMode === 'spark' && launch.state === 'READY') {
        const n = new Set(strokes.filter((p) => p.g).map((p) => p.g)).size;
        const g = placeShape(id, W * (0.5 + 0.22 * Math.sin(n * 2.4)), H * clamp(0.3 + 0.08 * (n % 4), 0.2, 0.55));
        if (g) toast(`${SHAPES[id].label} added. Drag to move, tap the sky for more`);
      }
    });
    shapeList.append(b);
  }
  syncShapeUi();
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
    const last = strokes[strokes.length - 1], id = last.id, g = last.g;
    // A placed shape is undone whole; a freehand stroke one at a time.
    if (g) while (strokes.length && strokes[strokes.length - 1].g === g) strokes.pop();
    else while (strokes.length && strokes[strokes.length - 1].id === id) strokes.pop();
    repaintStrokes();
    syncDrawingAction();
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
    if (strokesDirty) { repaintStrokes(); strokesDirty = false; syncDrawingAction(); }
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
  function syncDrawingAction() {
    const b = $('#btnSparkBurst');
    b.disabled = launch.state !== 'READY' || strokes.length < 2;
    b.setAttribute('aria-label', 'Burst my drawing');
  }
  function clearWriting() {
    if (pen) penUp();
    eraser = null; shapeDrag = null; strokesDirty = false;
    if (pointer && pointer.kind === 'spark') pointer = null;
    strokes.length = 0; pctx.clearRect(0, 0, W, H);
    if (launch.state === 'READY') {
      while (stars.length) { const p = stars.pop(); p.onDeath = null; starPool.push(p); }
      while (sparks.length) sparkPool.push(sparks.pop());
      gctx.clearRect(0, 0, W, H);
    }
    syncDrawingAction();
  }
  // Turns the written light into a burst of fireworks.
  function lightUpWriting() {
    if (!launch.sequence || launch.sequence.id !== 'spark:writing') return;
    if (!strokes.length) { toast('Write something first, then light it up'); return; }
    Sound.resume();
    let cx = 0, cy = 0;
    for (const p of strokes) { cx += p.x; cy += p.y; }
    cx /= strokes.length; cy /= strokes.length;
    const step = Math.max(1, strokes.length / Math.max(12, Q().maxStars * 0.7));
    curLayer = 1;
    for (let i = 0; i < strokes.length; i += step) {
      const p = strokes[Math.floor(i)], ang = Math.atan2(p.y - cy, p.x - cx), v = rand(70, 240) * U;
      star(p.x, p.y, Math.cos(ang) * v, Math.sin(ang) * v - 55 * U, p.c, rand(2, 2.8),
        { drag: 1.2, grav: 0.5, size: 2.8, glitter: 0.4, hold: 0.3 });
    }
    flash(cx, cy, '#fff1d0', 2.5, gctx);
    curLayer = 0;
    Sound.lastBurst = 0;
    Sound.burst(1.6, pan(cx));
    Sound.crackle(pan(cx));
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
  $('#btnSparkBurst').addEventListener('click', requestFire);

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
    ['video', '🎬', 'Director', 'Save your first video'],
    ['bday1', '🎂', 'Birthday keeper', 'Save a friend’s birthday'],
    ['bday5', '👯', 'Friend magnet', 'Save 5 birthdays'],
    ['hero', '🎁', 'Birthday hero', 'Make a video for a saved friend'],
    ['joy1', '✨', 'Grateful heart', 'Celebrate your first daily joy'],
    ['joy3', '🕯️', 'Three bright days', 'Keep a 3-day joy streak'],
    ['joy7', '🔥', 'Week of joy', 'Keep a 7-day joy streak'],
    ['joy30', '🌟', 'Month of light', 'Keep a 30-day joy streak'],
    ['share', '📣', 'Spread the joy', 'Share your daily joy'],
    ['rush', '🏮', 'Lantern lighter', 'Finish your first Lantern Rush'],
    ['daily7', '📅', 'Week of skies', 'Play the Daily Sky 7 days in a row'],
    ['rival', '🥇', 'Champion', 'Beat a friend’s challenge'],
    ['bringer', '🌌', 'Sky Master', 'Reach the Sky Master light-bringer rank'],
  ];
  let achieved = {};
  try { achieved = JSON.parse(localStorage.getItem('luts:ach') || '{}') || {}; } catch (e) { achieved = {}; }
  function achieve(id) {
    if (achieved[id]) return;
    achieved[id] = Date.now();
    try { localStorage.setItem('luts:ach', JSON.stringify(achieved)); } catch (e) { /* ignore */ }
    const a = ACH.find((x) => x[0] === id);
    if (a) {
      toast(`🏅 Achievement unlocked: ${a[2]} · tap to share`, 4200);
      el.toast.dataset.badge = id; // the toast is tappable while it shows
    }
    renderAch();
  }
  el.toast.addEventListener('click', () => { if (el.toast.dataset.badge && el.toast.classList.contains('show')) shareBadge(el.toast.dataset.badge); });
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
      if (achieved[id]) {
        const sh = document.createElement('button');
        sh.type = 'button'; sh.className = 'ach-share'; sh.setAttribute('aria-label', `Share the ${name} badge`);
        sh.innerHTML = '<span class="btn-ico share-glyph" aria-hidden="true"></span>';
        sh.addEventListener('click', () => shareBadge(id));
        li.append(sh);
      }
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
    syncLiveSky();
    if (first) toast('AR on: point your camera at the sky and tap to launch', 3500);
  }
  function stopAR() {
    stopStream();
    cam.srcObject = null;
    arOn = false;
    document.body.classList.remove('ar');
    $('#btnFlip').hidden = true;
    $('#btnAR').setAttribute('aria-pressed', 'false');
    drawSky();
    drawCity();
    drawFloor();
    syncLiveSky();
  }
  const toggleAR = () => {
    if (launch.state !== 'READY') return;
    Sound.resume();
    if (roomAr) return stopRoomAr();
    if (arOn) return stopAR();
    if (!burstEntitled()) { openPremium(); return; } // AR is Premium (store subscription or the reviewer code)
    if (roomArBridge && (roomArSupport === 'supported' || roomArSupport === 'install')) startRoomAr(); else startAR();
  };

  // ---------- Room AR (ARCore on Android): crackers stand on the real floor ----------
  // Android tracks the room and draws the camera behind this page; the page draws the crackers and fireworks
  // at the screen positions it reports (window.LUTSAr.frame). Elsewhere the AR button keeps the camera AR above.
  const roomArBridge = ANDROID_WEBVIEW && window.LUTSAndroid && typeof window.LUTSAndroid.arcore === 'function';
  let roomAr = false, roomArSupport = roomArBridge ? 'checking' : 'unsupported';
  let arSpot = null; // the spot the next cracker fires from: { id, x, y, s, seen }
  const arReticle = $('#arReticle'), arSpotEl = $('#arSpot');
  const placeAt = (el, p) => { el.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-50%) scale(${p[2]})`; };
  window.addEventListener('luts:ar', (e) => {
    const d = e.detail || {};
    if (d.support) roomArSupport = d.support;
    if (d.state === 'running') enterRoomAr();
    else if (d.state === 'installing') toast('Installing Google Play Services for AR…', 4000);
    else if (d.state) leaveRoomAr(d.state);
    if (d.placed) { arSpot = { id: d.placed, x: 0, y: 0, s: 1, seen: false }; buzz(12); el.hint.classList.add('gone'); }
    if (d.miss) toast('Move your phone slowly over the floor until the ring appears, then tap it', 3000);
  });
  if (roomArBridge) window.LUTSAndroid.arcore('check', '');
  window.LUTSAr = {
    frame(f) {
      if (!roomAr) return;
      const showRing = !!f.r && launch.state === 'READY';
      arReticle.hidden = !showRing;
      if (showRing) placeAt(arReticle, f.r);
      const p = arSpot && f.a && f.a[arSpot.id];
      if (arSpot) {
        arSpot.seen = !!p;
        if (p) { [arSpot.x, arSpot.y, arSpot.s] = p; placeAt(arSpotEl, p); }
      }
      arSpotEl.hidden = !(p && launch.state === 'READY');
      // Keep a lit cracker standing on its spot while the phone moves.
      const seq = launch.sequence;
      if (p && seq && seq.arId === arSpot.id) {
        if (seq.item) { seq.item.x = p[0]; seq.item.y = p[1]; }
        if (launch.state === 'IGNITING') { seq.x = seq.sx = p[0]; seq.y = seq.sy = p[1]; }
      }
      document.body.classList.toggle('ar-searching', f.t !== 'tracking' || !f.floor);
    },
  };
  function startRoomAr() {
    if (roomArSupport === 'install') toast('Room AR needs Google Play Services for AR. Opening Play…', 4000);
    window.LUTSAndroid.arcore('start', '');
  }
  function stopRoomAr() { window.LUTSAndroid.arcore('stop', ''); }
  function enterRoomAr() {
    if (roomAr) return;
    stopStream(); cam.srcObject = null;
    roomAr = arOn = true;
    syncLiveSky();
    arSpot = null;
    document.documentElement.classList.add('room-ar');
    document.body.classList.add('ar', 'room-ar', 'ar-searching');
    $('#btnFlip').hidden = true;
    $('#btnAR').setAttribute('aria-pressed', 'true');
    drawSky(); drawCity(); drawFloor();
    toast('Room AR: move your phone slowly to find the floor, then tap the ring to place a cracker', 4500);
  }
  function leaveRoomAr(state) {
    const was = roomAr;
    roomAr = false; arSpot = null;
    arReticle.hidden = arSpotEl.hidden = true;
    document.documentElement.classList.remove('room-ar');
    document.body.classList.remove('room-ar', 'ar-searching');
    if (was) { arOn = false; document.body.classList.remove('ar'); $('#btnAR').setAttribute('aria-pressed', 'false'); drawSky(); drawCity(); drawFloor(); syncLiveSky(); }
    const why = { unsupported: 'Room AR is not supported on this phone, so AR uses the camera view instead.', declined: 'Room AR needs Google Play Services for AR. Using the camera view instead.',
      camera: 'The camera is busy. Using the camera view instead.', error: 'Room AR could not start. Using the camera view instead.' }[state];
    if (why) { roomArSupport = state === 'declined' ? roomArSupport : 'unsupported'; toast(why, 4500); startAR(); }
    else if (state === 'camera-denied') toast('Allow camera access to use AR.', 4000);
  }
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
    (src === skyC && glSky.c.style.display === 'block' ? glSky.c : src).after(c); // over the 3D-photo sky when it's showing
    return c;
  }
  function applyWorld(cfg, img) {
    document.querySelectorAll('.scene-fade').forEach((f) => f.remove()); // rapid switching: one fade at a time
    const fades = arOn || reduceMotion() ? [] : [snapshotLayer(skyC), snapshotLayer(moonC), snapshotLayer(cityC)];
    world.id = cfg.id; world.cfg = cfg; world.img = img;
    world.blur = world.masked = null; world.maskKey = '';
    drawSky(); drawCity(); drawFloor();
    syncLiveSky();
    if (mode !== 'card' && mode !== 'envelope') palette = basePalette();
    if (fades.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => fades.forEach((f) => f.classList.add('out'))));
      setTimeout(() => fades.forEach((f) => f.remove()), 900);
    }
    syncWorldUi();
  }

  // Switches scene without restarting anything. A landmark only replaces the sky once its image has loaded;
  // if loading fails the current scene stays and nothing is saved. A card show passes save: false and force: true
  // to show its sender's background for a while without making it the viewer's own (see showCardWorld).
  function selectWorld(id, { silent = false, save = true, force = false } = {}) {
    if (launch.state !== 'READY' && !force) return Promise.resolve(false);
    const cfg = isWorld(id) ? WORLD_BY_ID[id] : WORLD_BY_ID.default;
    if (cfg.id === world.id && !world.pending) return Promise.resolve(true);
    if (!force && worldLocked(cfg)) { if (!silent) openPremium({ world: cfg.id }); return Promise.resolve(false); }
    const keep = () => { if (save) { saveWorld(); worldChosen(cfg.id); } };
    if (!cfg.image) {
      world.pending = null;
      document.querySelectorAll('.world-card.loading, .world-mini.loading').forEach((b) => setCardLoading(b.dataset.world, false));
      applyWorld(cfg, null);
      keep();
      if (!silent) toast(cfg.live ? `${cfg.name} · ${cfg.place}` : 'Back to the classic night sky');
      return Promise.resolve(true);
    }
    if (world.pending && world.pending !== cfg.id) setCardLoading(world.pending, false);
    const token = world.pending = cfg.id;
    setCardLoading(cfg.id, true);
    return loadWorldBackground(cfg.id).then((img) => {
      if (world.pending !== token) return false; // superseded by a newer choice
      world.pending = null;
      applyWorld(cfg, img);
      keep();
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
  // Main-screen strip: one tap switches the scene; its header opens the full panel. The card form has the same row,
  // so the background can be chosen while making the card.
  const worldStripList = $('#worldStripList'), cardWorldList = $('#cWorlds');
  let stripShown = '';
  function buildWorldMinis(list) {
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
      name.textContent = cfg.image || cfg.live ? cfg.name : 'Night Sky';
      const place = document.createElement('small');
      place.textContent = cfg.place;
      b.append(thumb, name, place);
      b.addEventListener('click', () => selectWorld(cfg.id));
      list.append(b);
    }
  }
  buildWorldMinis(worldStripList);
  buildWorldMinis(cardWorldList);
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
    $('#worldStripName').textContent = cfg.image || cfg.live ? cfg.name : 'Night Sky';
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
    cardWorldList.querySelectorAll('.world-mini').forEach((b) => {
      const on = b.dataset.world === world.id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('locked', worldLocked(WORLD_BY_ID[b.dataset.world]));
    });
    if (!modal.hidden) updatePreview(); // the card preview shows the background too
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
    // Lead with the outcome the player was reaching for when the paywall opened.
    $('#premiumTitle').textContent = intent.cracker ? 'Fire every cracker, as often as you like'
      : intentWorld ? `Light up ${intentWorld.name} tonight`
        : intent.colours ? 'Fireworks in each landmark’s own colours' : 'Light up all of India this Diwali';
    $('#premiumSub').textContent = intent.cracker ? 'Unlimited replays of all 41 crackers, all 15 landmarks, and no ads.'
      : intentWorld ? `${intentWorld.name} and 12 more landmarks, unlimited crackers, no ads.`
        : 'Every cracker, every landmark, as often as you like. No ads.';
    document.querySelectorAll('#premiumPanel .premium-store').forEach((n) => { n.textContent = storeAccount(); });
    $('#premiumGet').hidden = !web;
    for (const node of [premiumPlans, $('#btnPremiumBuy'), $('#premiumTrust'), $('#premiumFine'), $('#btnPremiumRestore')]) node.hidden = web;
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
    const saving = yearlySaving();
    for (const p of premium.plans) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'premium-plan' + (p === chosen ? ' on' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(p === chosen));
      const name = document.createElement('span');
      name.className = 'premium-plan-name';
      name.textContent = PLAN_NAMES[p.kind] || 'Premium';
      if (p.kind === 'annual' && premium.plans.length > 1) { const tag = document.createElement('em'); tag.textContent = saving ? `Save ${saving}%` : 'Best value'; name.append(tag); }
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
      : !chosen ? 'Continue' : chosen.trial ? `Start ${chosen.trial} free trial`
        : `Get Premium · ${chosen.kind === 'annual' ? `${chosen.price}/year` : chosen.kind === 'monthly' ? `${chosen.price}/month` : chosen.price}`;
    $('#premiumFine').textContent = chosen ? fineprint(chosen) : '';
    $('#btnPremiumRestore').disabled = busy;
    // Risk reversal, right under the button.
    const trust = $('#premiumTrust');
    trust.innerHTML = '';
    const lines = chosen && chosen.trial
      ? [`Nothing to pay today · ${trialWords(chosen.trial)} free`, 'Cancel before the trial ends and you pay nothing', `Cancel anytime in your ${storeAccount()}`]
      : [`Cancel anytime in your ${storeAccount()}`, 'No ads while you’re Premium', 'Restore on a new phone with the same account'];
    for (const text of lines) { const li = document.createElement('li'); li.textContent = text; trust.append(li); }
  }
  // Yearly vs twelve months, from the store's own prices (so it is never a made-up discount).
  function yearlySaving() {
    const num = (s) => { const n = parseFloat(String(s || '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };
    const year = premium.plans.find((p) => p.kind === 'annual'), month = premium.plans.find((p) => p.kind === 'monthly');
    if (!year || !month) return 0;
    const pct = Math.round((1 - num(year.price) / (num(month.price) * 12)) * 100);
    return pct >= 5 && pct < 95 ? pct : 0;
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
    syncLaunchUi();
  }
  function syncPremiumRow() {
    const on = premium.active, manage = $('#premiumManage');
    $('#premiumRow').classList.toggle('on', on);
    $('#premiumRowNote').textContent = on ? 'Active · landmarks, AR & Burst all unlocked' : 'All 15 landmarks, AR & Burst all';
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
      crackerEntitled = !!(nativeApp && nativeApp.lastPremium === s && s.active);
      premium.active = !!s.active || reviewerAccess;
      try { localStorage.setItem('luts:premium', s.active ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    premium.message = s.status === 'unavailable'
      ? (s.message === 'not-configured' ? 'Premium isn’t set up in this build yet.'
        // Google Play Billing refuses to run without a signed-in store account (and on some emulators).
        : /billing (is )?(not available|unavailable)|BILLING_UNAVAILABLE|PurchaseNotAllowed/i.test(s.message || '')
          ? `Sign in to the ${nativeApp && nativeApp.platform === 'ios' ? 'App Store' : 'Play Store'} on this device to see Premium plans, then tap Try again.`
          : 'Purchases aren’t available right now. Check your connection and try again.')
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
    syncLaunchUi();
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

  // Reviewer code (see REVIEWER_HASH): seven quick taps on the Settings title show the field.
  let reviewerTaps = 0, reviewerTapAt = 0;
  $('#settings .drawer-head h2').addEventListener('click', () => {
    const now = performance.now();
    reviewerTaps = now - reviewerTapAt < 900 ? reviewerTaps + 1 : 1;
    reviewerTapAt = now;
    if (reviewerTaps >= 7 && !reviewerAccess) { $('#reviewerBox').hidden = false; $('#reviewerCode').focus(); }
  });
  $('#reviewerCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btnReviewer').click(); } });
  $('#btnReviewer').addEventListener('click', async () => {
    const code = $('#reviewerCode').value.trim().toUpperCase();
    if (!code || !(window.crypto && crypto.subtle)) return;
    const sum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const hex = [...new Uint8Array(sum)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (hex !== REVIEWER_HASH) { toast('That code isn’t valid'); return; }
    reviewerAccess = true;
    try { localStorage.setItem('luts:reviewer', '1'); } catch (err) { /* ignore */ }
    const was = premium.active;
    premium.active = true;
    if (!was) premiumChanged(was);
    $('#reviewerCode').value = '';
    $('#reviewerBox').hidden = true;
    renderPaywall();
    syncWorldUi();
    queueBurstSync();
    syncPremiumRow();
    toast('Premium unlocked for review ✨ Every landmark is open', 3200);
  });
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
      $('#shareLabel').hidden = true;
      $('#linkNote').textContent = 'Tap “Play the show”, then “Save video” to share it.';
    }
  }

  // ---------- Deliberate cracker launch ----------
  const AERIAL_ITEMS = new Set(['rocket', 'rocketcombo', 'shell', 'cake', 'finale']);
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const safeSound = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* Sound is optional. */ } };
  function selection() {
    if (playMode === 'spark') return { id: 'spark:writing', label: 'Sparkler', writing: true };
    if (playMode === 'ground') return { id: `item:${settings.item}`, label: ITEMS[settings.item].label, type: settings.item, ground: !AERIAL_ITEMS.has(settings.item) };
    return { id: `shell:${settings.shell}`, label: settings.shell === 'random' ? 'Random' : TYPES[settings.shell].label.replace('Chrysanth.', 'Chrysanthemum'), type: settings.shell };
  }
  function syncLaunchUi() {
    const busy = launch.state !== 'READY', fire = $('#btnFire');
    document.body.classList.toggle('launch-active', busy);
    document.body.dataset.launchState = launch.state;
    const labels = { READY: '', IGNITING: 'Igniting…', ASCENDING: 'Flying…', BURSTING: 'Enjoy the burst', FADING: 'Enjoy the sparks', RETURNING: 'Returning…' };
    $('#launchStatus').textContent = labels[launch.state];
    syncRewardsUi();
    if (!fire || !$('#groundList').children.length) return;
    const s = selection();
    const usedSelection = launch.used(s.id), points = launch.balance().points;
    fire.textContent = busy ? labels[launch.state] : `Fire ${s.label}${usedSelection && !crackerEntitled && points >= 50 ? ' · 50 pts' : ''}`;
    fire.disabled = busy || rewardBusy;
    fire.hidden = playMode === 'spark';
    for (const b of document.querySelectorAll('#shellList button, #groundList button')) {
      const id = b.dataset.shell ? `shell:${b.dataset.shell}` : `item:${b.dataset.item}`;
      let status = b.querySelector('.trial-status');
      if (!status) { status = document.createElement('small'); status.className = 'trial-status'; b.append(status); }
      const used = launch.used(id);
      status.textContent = crackerEntitled ? 'Premium' : used ? points >= 50 ? 'Replay · 50 pts' : 'Free launch used' : '1 free launch';
      b.classList.toggle('trial-used', used && !crackerEntitled);
      b.setAttribute('aria-pressed', String(id === s.id));
      b.classList.toggle('active', id === s.id);
      b.disabled = busy;
    }
    for (const b of document.querySelectorAll('#modeTabs button, #sparkFloat button, #sparkColors button, #settings input, #settings select, #setReset, #btnSparkBurst, #btnClearStreet, #btnFlip')) b.disabled = busy;
    syncDrawingAction();
    syncBurstAll();
  }
  function requestFire() {
    if (mode !== 'play' || rush.on || paused || document.hidden || rewardBusy || launch.state !== 'READY') return;
    const s = selection();
    if (s.writing && !strokes.length) { toast('Write something first, then light it up'); return; }
    if (roomAr && !s.writing && !s.ground && !(arSpot && arSpot.seen)) { toast(arSpot ? 'Point your phone at your cracker spot' : 'Tap the floor to place your cracker first'); return; }
    return launch.request(s);
  }
  function prepareLaunch(s) {
    if (!W || !H || !ctx || !gctx) throw Error('Renderer not ready');
    const type = s.id.startsWith('shell:') ? resolveType(s.type) : ({ rocket: 'peony', rocketcombo: 'kaleido', shell: 'chrysanthemum', cake: 'kaleido', finale: 'kamuro', lantern: 'willow' }[s.type] || s.type);
    const size = Math.min(1.9, Math.min(W * 0.43, H * 0.27) / (R0() * 1.16));
    const seq = { ...s, burstType: type, size, age: 0, since: 0, burst: false, x: W * 0.5, y: Math.min(H * 0.72, groundBottom() - 18), sx: W * 0.5, sy: Math.min(H * 0.72, groundBottom() - 18), c: color(), emission: 0, smokeAt: 0 };
    if (!s.ground && !s.writing && !TYPES[type]) throw Error('Unknown cracker');
    if (s.ground && !ITEMS[s.type]) throw Error('Unknown ground cracker');
    if (s.multi) {
      seq.batch = waitingItems().slice(0, BURST_MAX).map((it) => ({ type: it.type, x: it.x, y: it.y }));
      if (seq.batch.length < 2) throw Error('Nothing to burst');
    }
    const placed = !s.multi && s.id.startsWith('item:') && groundItems.find(it => !it.armed && it.type === s.type);
    if (placed) seq.placed = { x: placed.x, y: placed.y };
    if (roomAr && arSpot && !s.writing && !s.ground) { seq.arId = arSpot.id; seq.placed = { x: arSpot.x, y: arSpot.y }; seq.x = seq.sx = arSpot.x; seq.y = seq.sy = arSpot.y; }
    if (!cloudSprite) {
      flightStars = document.createElement('canvas'); flightStars.width = flightStars.height = 512;
      const sg = flightStars.getContext('2d'), random = mulberry(73);
      sg.fillStyle = '#020309'; sg.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 130; i++) {
        sg.fillStyle = `rgba(220,232,255,${0.2 + random() * 0.5})`;
        sg.fillRect(random() * 512, random() * 512, 0.7, 0.7);
      }
      cloudSprite = document.createElement('canvas'); cloudSprite.width = 256; cloudSprite.height = 80;
      const g = cloudSprite.getContext('2d');
      for (let i = 0; i < 6; i++) {
        const x = 28 + i * 40, y = 40 + Math.sin(i * 2) * 9;
        const gradient = g.createRadialGradient(x, y, 0, x, y, 47);
        gradient.addColorStop(0, 'rgba(175,190,215,.24)'); gradient.addColorStop(1, 'rgba(175,190,215,0)');
        g.fillStyle = gradient; g.fillRect(x - 47, y - 47, 94, 94);
      }
    }
    return seq;
  }
  function igniteLaunch(seq) {
    clearScene();
    pointer = null; if (pen) penUp();
    if (seq.multi) {
      // One launch, every cracker: lit in a quick left-to-right cascade so the street erupts rather than going off at once.
      seq.items = seq.batch.sort((a, b) => a.x - b.x).map((p, i) => {
        const it = placeItem(p.type, p.x, p.y);
        it.dur = Math.min(it.dur, 7); it.armed = true; it.t = -i * 0.22;
        if (!tried.has(it.type)) tried.add(it.type);
        return it;
      });
      try { localStorage.setItem('luts:tried', JSON.stringify([...tried])); } catch (e) { /* ignore */ }
      achieve('first');
    } else if (seq.id.startsWith('item:')) {
      seq.item = placeItem(seq.type, seq.placed ? seq.placed.x : W * 0.5, seq.placed ? seq.placed.y : floorTop() + floorH() * 0.58);
      seq.item.dur = Math.min(seq.item.dur, 7);
      if (seq.ground) armItem(seq.item);
      else { [seq.sx, seq.sy] = tipPos(seq.item); seq.x = seq.sx; seq.y = seq.sy; }
    }
    safeSound(() => Sound.resume());
    safeSound(() => Sound.hiss(0.55, 4800, 0.055, 0));
    buzz(15);
  }
  function clearScene() {
    shells.length = 0;
    while (stars.length) { const p = stars.pop(); p.onDeath = null; starPool.push(p); }
    while (sparks.length) sparkPool.push(sparks.pop());
    while (smokes.length) smokePool.push(smokes.pop());
    confettis.length = 0; groundItems.length = 0;
    timers.length = 0; portrait = null; shake = shakeX = shakeY = 0;
    for (const g of [ctx, gctx, ictx, flightCtx]) g.clearRect(0, 0, W, H);
  }
  const diwaliReveal = $('#diwaliReveal');
  // Returns how long the reveal takes, in seconds, so the launch can wait for it.
  function showDiwaliReveal() {
    const dur = reduceMotion() ? 2.2 : 3.4;
    diwaliReveal.hidden = true;
    diwaliReveal.classList.remove('play');
    diwaliReveal.style.setProperty('--reveal-dur', `${dur}s`);
    diwaliReveal.hidden = false;
    void diwaliReveal.offsetWidth; // restart the animation for back-to-back launches
    diwaliReveal.classList.add('play');
    return dur;
  }
  function hideDiwaliReveal() {
    diwaliReveal.classList.remove('play');
    diwaliReveal.hidden = true;
  }
  diwaliReveal.addEventListener('animationend', hideDiwaliReveal);

  function abortLaunch() {
    hideDiwaliReveal();
    finishShotShare();
    clearScene();
    safeSound(() => Sound.sparklerStop());
    if (Sound.voices) for (const voice of Sound.voices) { try { voice.stop(); } catch (_) { /* Already ended. */ } }
    Sound.spk = null;
    Object.assign(camera, { x: 0, y: 0, zoom: 1, travel: 0 });
    launch.reset();
    resetLaunchCamera();
  }
  function resetLaunchCamera() {
    for (const c of [skyC, moonC, cityC, floorC, itemsC, paintC, gfxC, fxC, atmoC, glSky.c]) { c.style.transform = ''; c.style.opacity = ''; }
    skyC.style.visibility = ''; glSky.c.style.display = 'none';
    flightCtx.clearRect(0, 0, W, H);
    view.key = '';
  }
  function updateLaunch(dt) {
    const s = launch.sequence;
    if (!s) return;
    s.age += dt; s.since += dt;
    const change = (state) => { s.since = 0; launch.setState(state); };
    if (s.age > 19 + (s.hold || 0)) { abortLaunch(); toast('Launch ended. You can choose another cracker.'); return; }
    if (launch.state === 'IGNITING' && s.since >= 0.6) {
      if (s.ground || s.writing) {
        if (s.writing) lightUpWriting();
        change('BURSTING');
      } else { groundItems.length = 0; change('ASCENDING'); safeSound(() => Sound.lift(0, 2.9, true)); }
    }
    if (launch.state === 'ASCENDING') {
      const t = clamp(s.since / 3, 0, 1), p = 1 - (1 - t) ** 1.65;
      s.x = s.sx + Math.sin(t * Math.PI) * W * 0.065;
      s.y = s.sy + (H * 0.20 - s.sy) * p;
      const reveal = ease((t - 0.72) / 0.28);
      camera.travel = (reduceMotion() || roomAr) ? 0 : ease(t);
      camera.y = (reduceMotion() || roomAr) ? 0 : H * 0.12 * ease(t);
      camera.x = (reduceMotion() || roomAr) ? 0 : -W * 0.02 * Math.sin(t * Math.PI);
      camera.zoom = (reduceMotion() || roomAr) ? 1 : 1 + 0.16 * Math.sin(t * Math.PI) - 0.06 * reveal;
      s.emission += dt * 24;
      while (s.emission >= 1) { s.emission--; spark(s.x, s.y, rand(-9, 9), rand(30, 80), '#ffd27a', 0.24); }
      if (t >= 1 && !s.burst) {
        s.burst = true;
        burstShell({ x: s.x, y: s.y, type: s.burstType, size: s.size, z: 1, c1: s.c, user: true });
        buzz(25); change('BURSTING');
      }
    }
    if (launch.state === 'BURSTING') {
      if (s.multi) {
        if (s.items.every((it) => it.done || it.t >= it.dur)) change('FADING');
      } else if (s.ground) {
        const it = s.item;
        if (it && (it.done || it.t >= it.dur)) change('FADING');
      } else if (s.since >= 0.65) change('FADING');
    }
    if (launch.state === 'FADING' && !stars.length && !sparks.length && !smokes.length && !confettis.length && !shells.length && s.since >= 0.8) {
      s.returnFrom = { ...camera };
      // Sky crackers end on Happy Diwali; the camera holds until it has faded, then glides back down.
      if (!s.ground && !s.writing && mode === 'play' && !rush.on) s.hold = showDiwaliReveal();
      change('RETURNING');
    }
    if (launch.state === 'RETURNING') {
      const p = 1 - ease(Math.max(0, s.since - (s.hold || 0)) / 1.15), from = s.returnFrom;
      camera.x = from.x * p; camera.y = from.y * p; camera.zoom = 1 + (from.zoom - 1) * p; camera.travel = from.travel * p;
      if (!p && !s.completing) {
        launch.complete().then(earned => {
          if (launch.sequence !== s) return;
          abortLaunch(); if (earned) toast(`+${earned} points`);
        }).catch(() => { if (launch.sequence === s) { abortLaunch(); toast('Firework complete. Points could not be saved.'); } });
        return;
      }
    }
    if (s.ground && launch.state !== 'RETURNING') {
      camera.zoom = (reduceMotion() || roomAr) ? 1 : 1 + 0.045 * ease(s.age);
      camera.travel = camera.y = camera.x = 0;
    }
  }
  function applyLaunchCamera() {
    const s = launch.sequence; if (!s) return;
    skyC.style.visibility = ''; glSky.c.style.display = 'none';
    const tf = (x, y, zoom) => `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${zoom.toFixed(4)})`;
    const front = tf(camera.x, camera.y, camera.zoom);
    fxC.style.transform = front;
    for (const c of [floorC, itemsC, paintC, gfxC]) c.style.transform = s.ground || s.writing ? front : tf(camera.x, camera.travel * H * 0.64, 1);
    skyC.style.transform = s.ground ? front : tf(camera.x * 0.35, camera.travel * H * 0.42, 1.02);
    moonC.style.transform = s.ground ? front : tf(camera.x * 0.1, camera.travel * H * 0.035, 1); // drifts with the distant stars
    cityC.style.transform = s.ground ? front : tf(camera.x * 0.5, camera.travel * H * 0.64, 1);
    atmoC.style.opacity = '0';
  }
  function drawLaunch() {
    const s = launch.sequence;
    flightCtx.clearRect(0, 0, W, H);
    if (!s) return;
    // In AR the camera feed is the sky, so the painted flight sky and clouds would show as a dark band from the top.
    if (!s.ground && !s.writing && cloudSprite && !arOn) {
      const g = flightCtx;
      // Extend the sky exposed above the descending landmark; distant stars move slowly.
      if (camera.travel > 0) {
        g.save(); g.beginPath(); g.rect(0, 0, W, camera.travel * H * 0.42 + 3); g.clip();
        if (liveShown()) { g.fillStyle = liveSky.skyTop; g.fillRect(0, 0, W, H); } // the animated world's own sky, day or night
        else g.drawImage(flightStars, 0, camera.travel * H * 0.035 - H * 0.04, W, H * 1.05);
        g.restore();
      }
      for (let i = 0; i < 2; i++) {
        const y = H * (-0.08 + i * 0.14 + camera.travel * (0.48 + i * 0.16));
        g.globalAlpha = 0.1; // faint, and no flash at the burst (it washed the sky out white)
        g.drawImage(cloudSprite, -W * 0.18 + camera.x * (i + 1), y, W * 1.4, H * 0.22);
      }
      g.globalAlpha = 1;
    }
    if (s.ground || s.writing || !['IGNITING', 'ASCENDING'].includes(launch.state)) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const y = s.y, x = s.x, ascent = launch.state === 'ASCENDING';
    ctx.strokeStyle = '#ff9a3c'; ctx.lineCap = 'round'; ctx.lineWidth = 6 * U; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + (ascent ? 48 : 5) * U); ctx.stroke();
    ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 2 * U; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + (ascent ? 30 : 4) * U); ctx.stroke();
    ctx.fillStyle = '#fff9e9'; ctx.beginPath(); ctx.arc(x, y, 3 * U, 0, TAU); ctx.fill();
    if (ascent) { ctx.globalAlpha = 0.13; ctx.drawImage(smokeSprite('#a9a4b8'), x - 7, y + 22 * U, 14, 32 * U); }
    ctx.restore();
  }
  $('#btnFire').addEventListener('click', requestFire);
  $('#btnTrialAnother').addEventListener('click', () => { $('#crackerTrial').hidden = true; $('#btnFire').focus(); });
  $('#btnTrialPremium').addEventListener('click', () => { $('#crackerTrial').hidden = true; openPremium({ cracker: selection().id }); });
  window.addEventListener('storage', (e) => { if (e.key === 'luts:cracker-trials:v1') syncLaunchUi(); });

  // ---------- Points, verified reward receipts and invitations ----------
  function rewardsProvider() { return window.LUTSRewardProvider || null; }
  function syncRewardsUi() {
    const balance = launch.balance(), provider = rewardsProvider();
    const ads = !!(provider && provider.watchAd && provider.verifyReceipt && provider.adsAvailable !== false);
    const referrals = !!(provider && provider.createInvite && provider.fetchRewards && provider.verifyReceipt);
    $('#pointsBalance').textContent = balance.points;
    $('#rewardPoints').textContent = balance.points;
    $('#btnRewards').disabled = launch.state !== 'READY' || rewardBusy;
    $('#btnRewardVideo').disabled = !ads || rewardBusy;
    $('#btnInviteFriends').disabled = $('#btnInviteFacebook').disabled = rewardBusy;
    $('#btnCheckInvites').hidden = !(provider && provider.fetchRewards && provider.verifyReceipt);
    $('#btnCheckInvites').disabled = rewardBusy;
    $('#adAvailability').textContent = ads ? 'Reward is added after the video is completed.' : 'Reward videos are not available yet.';
    $('#referralOffer').textContent = referrals ? '100 points when a new friend joins · 2 extra launches' : 'Invite a friend to join your sky.';
    $('#inviteAvailability').textContent = referrals ? 'Rewards are confirmed when your friend joins, once per new friend.' : 'Invite rewards are not available yet.';
    const privacy = !!(window.LUTSNative && window.LUTSNative.lastAds && window.LUTSNative.lastAds.privacyRequired);
    $('#btnAdPrivacy').hidden = $('#setAdPrivacy').hidden = !privacy;
  }
  function openRewards() {
    if (launch.state !== 'READY') return;
    $('#crackerTrial').hidden = true; $('#rewardStatus').textContent = '';
    syncRewardsUi(); $('#rewardsPanel').hidden = false; $('#btnCloseRewards').focus();
  }
  function closeRewards() { $('#rewardsPanel').hidden = true; $('#btnRewards').focus(); }
  async function rewardTimeout(action) {
    let timer;
    try {
      return await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('This is taking longer than expected. Try again.')), 120000); })]);
    } finally { clearTimeout(timer); }
  }
  async function acceptReward(provider, receipt, kind) {
    if (!receipt || (kind && receipt.kind !== kind) || !['ad', 'referral'].includes(receipt.kind)) return 0;
    if (await provider.verifyReceipt(receipt) !== true) throw Error('Reward could not be confirmed yet.');
    const amount = await launch.grantReceipt({ id: receipt.id, kind: receipt.kind, verified: true });
    if (provider.acknowledgeReceipt) {
      try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* Recover and deduplicate on the next check. */ }
    }
    return amount;
  }
  async function watchRewardVideo() {
    if (rewardBusy || launch.state !== 'READY') return;
    const provider = rewardsProvider();
    if (!provider || !provider.watchAd || !provider.verifyReceipt) return;
    rewardBusy = true; syncLaunchUi();
    $('#rewardStatus').textContent = 'Loading your reward video…';
    const wasPaused = paused;
    if (!wasPaused) togglePause(true);
    try {
      const amount = await rewardTimeout(async () => acceptReward(provider, await provider.watchAd({ points: 150, launches: 3 }), 'ad'));
      $('#rewardStatus').textContent = amount ? '+150 points · 3 extra launches are yours.' : 'No new reward. You can watch another available video.';
    } catch (error) { $('#rewardStatus').textContent = error.message || 'No video is available. Try again later.'; }
    finally { rewardBusy = false; if (!wasPaused) togglePause(false); syncLaunchUi(); }
  }
  async function checkInviteRewards() {
    const provider = rewardsProvider();
    if (rewardBusy || !provider || !provider.fetchRewards || !provider.verifyReceipt) return;
    rewardBusy = true; syncLaunchUi(); $('#rewardStatus').textContent = 'Checking your rewards…';
    try {
      const amount = await rewardTimeout(async () => {
        const receipts = await provider.fetchRewards();
        if (!Array.isArray(receipts)) throw Error('Rewards are not available right now.');
        let total = 0;
        for (const receipt of receipts.slice(0, 100)) total += await acceptReward(provider, receipt);
        return total;
      });
      $('#rewardStatus').textContent = amount ? `+${amount} points added.` : 'No new rewards yet.';
    } catch (error) { $('#rewardStatus').textContent = error.message || 'Could not check rewards.'; }
    finally { rewardBusy = false; syncLaunchUi(); }
  }
  async function inviteFriends(channel) {
    if (rewardBusy) return;
    const provider = rewardsProvider();
    let popup = null;
    if (channel === 'facebook') { popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null; }
    rewardBusy = true; syncLaunchUi();
    try {
      const url = provider && provider.createInvite
        ? await rewardTimeout(() => provider.createInvite())
        : (window.LUTSNative && window.LUTSNative.shareBase) || 'https://stalinpusparaj.github.io/light-up-the-skies/';
      if (typeof url !== 'string' || new URL(url).protocol !== 'https:') throw Error('Invite link is not available.');
      if (channel === 'facebook' && popup) popup.location.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      else if (navigator.share) await navigator.share({ title: 'Light Up the Skies', text: 'Come celebrate with me. Choose a cracker and light up the sky!', url });
      else if (!(await copyText(url))) throw Error('Could not copy your invite.');
      $('#rewardStatus').textContent = provider && provider.fetchRewards ? 'Invite ready. Rewards arrive when a new friend joins.' : 'Invite ready. Invite rewards are not available yet.';
    } catch (error) {
      if (popup) popup.close();
      if (error.name !== 'AbortError') $('#rewardStatus').textContent = error.message || 'Could not create an invite.';
    } finally { rewardBusy = false; syncLaunchUi(); }
  }
  $('#btnRewards').addEventListener('click', openRewards);
  $('#btnTrialRewards').addEventListener('click', openRewards);
  $('#btnCloseRewards').addEventListener('click', closeRewards);
  $('#rewardsPanel').addEventListener('click', e => { if (e.target === $('#rewardsPanel')) closeRewards(); });
  $('#btnRewardVideo').addEventListener('click', watchRewardVideo);
  $('#btnCheckInvites').addEventListener('click', checkInviteRewards);
  $('#btnInviteFriends').addEventListener('click', () => inviteFriends('share'));
  $('#btnInviteFacebook').addEventListener('click', () => inviteFriends('facebook'));
  async function showAdPrivacy() {
    if (!window.LUTSNative || !window.LUTSNative.ads) return;
    try { await window.LUTSNative.ads('privacy'); }
    catch (_) { toast('Privacy choices are not available right now.'); }
  }
  $('#btnAdPrivacy').addEventListener('click', showAdPrivacy);
  $('#setAdPrivacy').addEventListener('click', showAdPrivacy);
  window.addEventListener('luts:ads', syncRewardsUi);

  // ---------- Boot ----------
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });
  document.addEventListener('visibilitychange', () => {
    syncLiveSky();
    pointer = null; if (pen) penUp();
    if (document.hidden) {
      cancelAnimationFrame(frameRaf); frameRaf = 0;
      holdMusic(true);
      if (Sound.ctx) safeSound(() => Sound.ctx.suspend());
    } else {
      last = performance.now(); frameMean = 16.7; slowFor = fastFor = 0;
      if (!frameRaf) frameRaf = requestAnimationFrame(frame);
      if (!paused) { holdMusic(false); if (Sound.ctx) safeSound(() => Sound.ctx.resume()); }
    }
  });
  window.addEventListener('pagehide', () => { abortLaunch(); cancelAnimationFrame(frameRaf); frameRaf = 0; });
  window.addEventListener('pageshow', () => { last = performance.now(); if (!document.hidden && !frameRaf) frameRaf = requestAnimationFrame(frame); });

  resize();
  syncSettingsUi();
  syncLaunchUi();
  syncWorldUi();
  restoreSelectedWorld();
  incoming = readHash();
  if (incoming) { $('#intro').hidden = true; showEnvelope(incoming); }
  else openRushFromHash(); // a friend's challenge or the Daily Sky, opened from a link
  document.body.classList.toggle('home', !$('#intro').hidden);
  // Entering or leaving the menu swaps the Particle Festival world for the classic sky and back.
  let wasHome = document.body.classList.contains('home');
  new MutationObserver(() => {
    const home = document.body.classList.contains('home');
    if (home === wasHome) return;
    wasHome = home;
    if (world.cfg.live) { drawSky(); drawCity(); }
    syncLiveSky();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncLiveSky();
  if (document.fonts && document.fonts.load) {
    for (const font of ['800 40px Outfit', '300 16px Outfit', '40px "Great Vibes"']) document.fonts.load(font).catch(() => {});
  }
  if (!frameRaf) frameRaf = requestAnimationFrame((t) => { last = t; frame(t); });
})();
