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
    if (hex[0] !== '#') return rgb(toHex(hex)); // hsl() (the rainbow pen): parsed as hex would cache NaN, one key per hue
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = hex.length === 4
      ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
      : [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  // Any colour the game makes ('#rgb', '#rrggbb', or the rainbow pen's 'hsl(h,s%,l%)') as '#rrggbb'. Hues snap to 10°
  // bins, so a pen sweeping the rainbow resolves to 36 colours (sprite slots, rgbCache keys) instead of one per stroke.
  // Defined with rgb() because rgb() routes hsl through it.
  const hexCache = new Map();
  const rgbHex = (c) => `#${((1 << 24) | (clamp(Math.round(c[0]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[2]), 0, 255)).toString(16).slice(1)}`;
  function toHex(c) {
    if (c[0] === '#' && c.length === 7) return c;
    let h = hexCache.get(c);
    if (h) return h;
    if (c[0] === '#' && c.length === 4) h = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    else {
      const m = /hsla?\(\s*(-?[\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/.exec(c);
      if (!m) h = '#ffd27a'; // unknown: the warm gold smokeSprite always fell back to
      else {
        const hu = ((Math.round(m[1] / 10) * 10) % 360 + 360) % 360, s = Math.min(1, m[2] / 100), l = Math.min(1, m[3] / 100), a = s * Math.min(l, 1 - l);
        const f = (n) => { const k = (n + hu / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
        h = rgbHex([f(0), f(8), f(4)]);
      }
    }
    if (hexCache.size >= 256) hexCache.clear();
    hexCache.set(c, h);
    return h;
  }
  const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // c moved t of the way to `to`, then scaled by k (k < 1 cools/darkens), as '#rrggbb'. Bounded like hexCache.
  const tintCache = new Map();
  function tintHex(c, to, t, k = 1) {
    const key = `${c}|${to}|${t}|${k}`;
    let h = tintCache.get(key);
    if (h) return h;
    h = rgbHex(mixRgb(rgb(c), rgb(to), t).map((v) => v * k));
    if (tintCache.size >= 512) tintCache.clear();
    tintCache.set(key, h);
    return h;
  }
  const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanMsg = (s, max) => String(s || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

  // ---------- Settings ----------
  const DEFAULTS = {
    shell: 'random', size: 3, theme: 'classic', quality: 'low', skyLight: 'normal',
    longExposure: false, skyline: true, sound: true, volume: 0.7,
    item: 'flowerpot', spark: 'gold', view3d: false, signVideos: true, scene3d: false,
  };
  const settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('luts:settings') || '{}');
    for (const k in DEFAULTS) if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) settings[k] = saved[k];
  } catch (e) { /* storage unavailable */ }
  const saveSettings = () => { try { localStorage.setItem('luts:settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };
  saveSettings(); // Discard legacy auto/finale preferences during migration.

  // heads: stars drawn with a glowing head sprite (headK scales it); tailN: history points of a long-tail star; smoke:
  // live smoke puffs; glints: sparkler shimmer pops; bloom: low-res bloom octaves; poolCap: recycled particles kept per pool.
  // The renderer reads these as it lands; until then drawing is as before.
  const QUALITY = {
    low: { dpr: 1, count: 0.7, glitter: 0.3, maxStars: 220, heads: 220, headK: 1.25, tailN: 8, smoke: 8, glints: 6, bloom: 0, poolCap: 180 },
    normal: { dpr: 1.5, count: 1, glitter: 0.5, maxStars: 480, heads: 480, headK: 1.1, tailN: 12, smoke: 14, glints: 10, bloom: 1, poolCap: 480 },
    high: { dpr: 2, count: 1.4, glitter: 0.75, maxStars: 1000, heads: 1000, headK: 1, tailN: 12, smoke: 20, glints: 14, bloom: 2, poolCap: 1000 },
  };
  let measuredTier = 2, slowFor = 0, fastFor = 0, frameMean = 16.7, crawlFor = 0;
  // A tier that once ran too slowly is never tried again this session, so a weak phone settles instead of bouncing
  // between tiers (each switch reallocates every full-screen canvas, which itself stalls for a few hundred ms).
  let failedTier = 3;
  const CARD_QUALITY = {
    low: { dpr: 1, count: 0.55, glitter: 0.45, maxStars: 2600, heads: 900, headK: 1.25, tailN: 6, smoke: 8, glints: 6, bloom: 0, poolCap: 2600 },
    normal: { dpr: 1.5, count: 1, glitter: 1, maxStars: 5500, heads: 1800, headK: 1.1, tailN: 8, smoke: 14, glints: 10, bloom: 1, poolCap: 5500 },
    high: { dpr: 2, count: 1.4, glitter: 1.3, maxStars: 9000, heads: 3000, headK: 1, tailN: 10, smoke: 20, glints: 14, bloom: 2, poolCap: 9000 },
  };
  const Q0 = () => (mode === 'card' ? CARD_QUALITY : QUALITY)[['low', 'normal', 'high'][Math.min(measuredTier, Math.max(0, ['low', 'normal', 'high'].indexOf(settings.quality)))]];
  // A show in 3D on a weak phone: the scene already fills the GPU, so the fireworks get a much smaller budget (see lite3d).
  let lite3d = false;
  const LITE = new Map();
  const Q = () => {
    const q = Q0();
    if (!lite3d) return q;
    if (!LITE.has(q)) LITE.set(q, { ...q, count: q.count * 0.55, glitter: q.glitter * 0.5, maxStars: Math.round(q.maxStars * 0.45), heads: Math.round(q.heads * 0.45), poolCap: Math.round(q.poolCap * 0.45), tailN: Math.max(4, q.tailN - 4), smoke: Math.round(q.smoke / 2), bloom: 0 });
    return LITE.get(q);
  };
  const SKY_LIGHT = { off: 0, dim: 0.5, normal: 1 };
  const SIZE_SCALE = [0.6, 0.75, 0.9, 1.05, 1.25, 1.5];
  const sizeScale = () => SIZE_SCALE[clamp(settings.size, 1, 6) - 1];

  const COLORS = {
    red: '#ff4a4a', gold: '#ffc94d', green: '#4df29a', blue: '#4aa8ff', purple: '#b56bff',
    pink: '#ff5fc1', white: '#fff4e0', cyan: '#5ff0ff', orange: '#ff8a2b',
  };
  const PALETTES = {
    classic: Object.values(COLORS),
    tricolor: ['#ff9933', '#ffffff', '#138808', '#ffb15c', '#e8ffe8'],
    gold: ['#ffd36b', '#ffb347', '#fff1c9', '#ff9a3c', '#ffe08a'],
    rainbow: ['#ff4d6d', '#ffb347', '#ffe66d', '#4dff9a', '#4dc3ff', '#b06bff'],
    rose: ['#ff5fa2', '#ff8fb8', '#ff3b6b', '#ffd1e1', '#e04dff'],
    ocean: ['#4dc3ff', '#5ff0ff', '#4a7dff', '#b0f0ff', '#8f7bff'],
    festive: ['#3dff8a', '#ff4040', '#ffd36b', '#e8fff2'],
  };
  const THEME_LABELS = { classic: 'Classic', gold: 'Golden', rainbow: 'Rainbow', rose: 'Rose', ocean: 'Ocean', festive: 'Festive', tricolor: 'Tricolour' };
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
    // Not a landmark: a country house and its garden, built only in code; in 3D its evening turns to night.
    { id: 'golden-manor', name: 'Golden Manor', place: 'Garden estate', image: 'golden-manor', focus: [0.5, 1], skyline: 0.41, keep: [0.13, 0.87], overlay: 0.5,
      preset: { name: 'Golden hour', colors: ['#ffd36b', '#ffb070', '#fff1c9', '#ff8fb8', '#c9a6ff'] } },
  ];
  const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
  const isWorld = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(WORLD_BY_ID, id);
  // img is null for the default painted sky. rect is the landmark's on-screen placement, set by drawWorldSky().
  const world = { id: 'default', cfg: WORLD_BY_ID.default, img: null, rect: null, preset: false, pending: null, blur: null, masked: null, maskKey: '' };

  // ---------- Premium: what's free ----------
  // Everything is free: every landmark in 2D and 3D, AR, Burst all, Tap Sky, Celebration Colours and unlimited launches.
  // Free players see ads (a banner, and a short video at natural breaks); Premium, a subscription in the apps, removes them.
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
  const worldLocked = () => false;
  // Streaks forgive one missed day a week; Premium forgives one every 3 days (up to two a week).
  const graceDays = () => (premium.active ? 3 : 7);
  const CROWN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-10-4.6 4.2L12 5l-2.8 7.2L4.6 8z"/></svg>';
  let runningGroundEffect = false, frameRaf = 0, rewardBusy = false, lastLaunchState = 'READY';
  const camera = { x: 0, y: 0, zoom: 1, travel: 0 };
  const launch = new window.LUTSLaunchController({
    storage: { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) },
    locks: navigator.locks,
    premium: () => true, // unlimited launches for everyone
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
  let curHang = 1; // bigger sky shells hang longer (set while a shell bursts)
  // 3D worlds: the scene point the effects being made belong to (a cracker on the ground, a burst in the sky). When the
  // 3D camera turns or steps, everything pinned to an anchor moves with it (followAnchors).
  let curAnchor = null;
  const sctx = skyC.getContext('2d');
  const ctx = fxC.getContext('2d');
  // #glow: the sky's glowing heads and lights, cleared each frame they were drawn (the trails on #fx persist and fade).
  const glowC = $('#glow'), glx = glowC.getContext('2d');
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
    // The ghat rises to where the Sky tube stands (just above the world chip), so crackers sit on the ground, not the sky.
    horizon: (portrait) => {
      if (mode === 'play' && playMode === 'ground' && !arOn) return clamp((floorTop() + 6) / H, 0.35, 0.75); // the street's far edge
      const chip = document.getElementById('worldStrip'), r = chip && chip.getBoundingClientRect();
      if (!r || !r.height || !window.innerHeight) return portrait ? 0.7 : 0.68;
      return Math.min(0.75, Math.max(0.45, (r.top - 6) / window.innerHeight - 0.035));
    },
    onDraw: (c) => { if (liveShown()) sctx.drawImage(c, 0, 0, W, H); },
  }) : null;
  if (liveSky) {
    const tod = new URLSearchParams(location.search).get('tod');
    liveSky.setHour(tod != null && tod !== '' && !Number.isNaN(+tod) ? +tod : 22);
  }
  // The menu keeps the classic night sky; the animated world only shows once the show starts.
  const liveShown = () => world.cfg.live && !!liveSky && !arOn && !document.body.classList.contains('home') && !w3dShown();
  const syncLiveSky = () => { if (liveSky) (liveShown() && !document.hidden ? liveSky.start() : liveSky.stop()); syncWorld3d(); };
  // The 3D background (world3d.js): the chosen landmark rebuilt in 3D replaces the sky, moon, skyline and street layers.
  // The engine is only loaded while it shows; the menu, card shows, Lantern Rush and AR keep the flat scene.
  let w3dCanvas = document.createElement('canvas');
  w3dCanvas.id = 'world3d'; w3dCanvas.setAttribute('aria-hidden', 'true'); w3dCanvas.hidden = true; skyC.after(w3dCanvas);
  let w3d = null, w3dLoading = null, w3dMoved = false, w3dKey = '', w3dVersion = -1, w3dFlatWorld = null; // null: the switch has not followed a world yet
  // w3dPending: a scene that finished building during a launch, waiting for it to end. w3dFailed: 3D couldn't start
  // (or kept losing its GPU context) this session. w3dTier: the detail the scene was built at; w3dDrawn: the frame
  // it last drew on (WebGL keeps no picture between frames, so photos and videos may need a fresh one).
  let w3dPending = null, w3dFailed = false, w3dLosses = [], w3dTier = -1, w3dQuality = '', w3dDrawn = -1, frameNo = 0;
  // The detail a scene is built at: the Detail setting, lowered on a slow phone; the lightest on low-memory phones.
  const wantedTier = () => ((navigator.deviceMemory || 4) <= 2 ? 0 : Math.min(measuredTier, Math.max(0, ['low', 'normal', 'high'].indexOf(settings.quality))));
  // The cities built in 3D so far (world3d-<scene>.js); any other world shows the Taj Mahal on the 3D background.
  const SCENES_3D = { 'taj-mahal': 'taj', 'india-gate': 'india-gate', 'hawa-mahal': 'hawa-mahal', 'gateway-of-india': 'gateway-of-india', 'charminar': 'charminar',
    'konark-sun-temple': 'konark-sun-temple', 'golden-temple': 'golden-temple', 'victoria-memorial': 'victoria-memorial', 'red-fort': 'red-fort',
    'mysore-palace': 'mysore-palace', 'meenakshi-amman-temple': 'meenakshi-amman-temple', 'brihadeeswarar-temple': 'brihadeeswarar-temple',
    'vivekananda-rock-memorial': 'vivekananda-rock-memorial', 'velankanni-basilica': 'velankanni-basilica', 'cross-by-the-sea': 'cross-by-the-sea',
    'golden-manor': 'golden-manor' };
  // A world still loading its picture counts already. The night skies (Default, Particle Festival) have no 3D scene:
  // they stay flat, and 3D comes back with the next landmark.
  // Pataka Chor (chor.js) plays on its own bazaar street, whatever the chosen world. placing: chor.js is putting down a
  // cracker the player found; any other cracker placement is refused while the mode is on (no shop, nothing to buy).
  // street: which of its streets (world3d-<street>.js): the free bazaar, or a Premium one.
  const chor = { on: false, placing: false, street: 'chor-street' };
  const skyOf = (t) => (typeof t === 'string' && t.startsWith('sky:') ? t.slice(4) : null); // a found sky shell's shell
  const model3d = () => (chor.on ? chor.street : SCENES_3D[world.pending || world.id] || '');
  // The 3D landmarks are Premium; 2D stays free for everyone. Pataka Chor's street is free, and always 3D.
  const has3d = () => premium.active;
  const w3dWanted = () => mode === 'play' && (chor.on || (settings.scene3d && has3d())) && !w3dFailed && !!model3d() && !arOn && !rush.on && !document.body.classList.contains('home');
  // Ready: built and wanted. Shown: ready and published to the screen by syncWorld3d (so nothing treats a scene that
  // finished building while the game was paused as on screen before it is).
  const w3dReady = () => !!w3d && w3dWanted() && w3d.id === model3d();
  const w3dShown = () => w3dReady() && w3dKey === w3d.id;

  const targetDpr = () => Math.min(window.devicePixelRatio || 1, Q().dpr, ANDROID_WEBVIEW ? 0.85 : Infinity);
  function setTier(tier) {
    const before = targetDpr();
    measuredTier = tier; slowFor = fastFor = 0;
    if (targetDpr() !== before) resize(); // the particle budgets follow Q() on their own; only sharpness needs new canvases
    else if (w3d) sizeWorld3d();
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${H}px`); // vh units resolve to 0 in the app's WebView
    // Android WebView devices can report a dense screen while the emulator/GPU still has to
    // rasterize every canvas pixel. Keep effects crisp, but avoid a multi-canvas 1080x2400 frame.
    DPR = targetDpr();
    // The effects' unit: the screen's width, but on a wide screen (a TV) its height, so fountains and bursts keep the
    // proportions they have on a phone and stay on screen.
    U = clamp(Math.min(W, H * 0.8) / 800, 0.5, 1.6);
    for (const c of [skyC, fxC, glowC, cityC, floorC, itemsC, paintC, gfxC, atmoC, flightC, moonC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    for (const g of [sctx, ctx, glx, cctx, fctx, ictx, pctx, gctx, actx, flightCtx, moonCtx]) g.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = gctx.lineCap = pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    if (w3d) sizeWorld3d();
    drawFloor();
    repaintStrokes();
    drawSky();
    drawCity();
  }

  // Whether the moon and city layers hold anything: a landmark picture or a live sky brings its own, and then the empty
  // layers are hidden (syncLayers), since each full-screen layer costs graphics memory even when transparent.
  let moonDrawn = false, cityDrawn = false;
  function drawSky() {
    const g = sctx;
    moonCtx.clearRect(0, 0, W, H);
    moonDrawn = false;
    if (world.img) { drawWorldSky(g); return; }
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
    moonDrawn = true;
  }

  function drawCity() {
    const g = cctx;
    g.clearRect(0, 0, W, H);
    // A landmark scene brings its own skyline, so the painted city is only drawn over the default sky.
    cityDrawn = !(!settings.skyline || arOn || world.img || liveShown());
    if (!cityDrawn) return;
    const rnd = mulberry(42);
    const maxH = Math.min(H * 0.24, 200 * U + 30);
    // The city stands on the same ground line as a landmark: just above the controls, or at the far edge of the street.
    const base = Math.round(worldGround(H > W));
    g.fillStyle = '#03040b';
    g.fillRect(0, base, W, H - base);
    // The painted old city (Google Flow), its top fading into the sky; the drawn city below stands in until it loads
    const art = drawCity.art || (drawCity.art = Object.assign(new Image(), { onload: () => drawCity(), src: 'assets/worlds/bg/night-city-skyline.webp' }));
    if (art.complete && art.naturalWidth) {
      // As wide as the screen, never taller than one and a half drawn cities (on a wide screen it widens a little instead)
      const ratio = art.naturalWidth / art.naturalHeight;
      const w = Math.max(W, maxH * 1.5 * ratio), h = Math.min(w / ratio, maxH * 1.5);
      g.drawImage(art, (W - w) / 2, base - h, w, h);
      return;
    }
    g.save(); g.translate(0, base - H);

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
    g.restore();
  }

  // ---------- Glow sprites ----------
  // One atlas of light sprites, three 32px cells per colour: head (white-hot core, saturated band, soft halo), glint (a
  // 4-ray pop) and soft (a colour gaussian). Drawn with drawImage from a single ImageBitmap, so a frame of glowing
  // heads costs one texture and no gradients. 1024x512 stays GPU-backed (Chrome keeps canvases under 128x129 on the CPU).
  // Full: everything is cleared and gen bumps, and holders re-resolve their slots lazily (ramp(), p.rg !== SPR.gen).
  const SPR = (() => {
    const CELL = 32, COLS = 32, ROWS = 16, atlas = document.createElement('canvas');
    atlas.width = CELL * COLS; atlas.height = CELL * ROWS;
    const g = atlas.getContext('2d'), ids = new Map();
    let next = 0, ver = 0, bmp = null, bmpVer = -1, pending = 0;
    const S = { gen: 0, hexOf: [], atlas, HEAD: 0, GLINT: 1, SOFT: 2, get size() { return ids.size; }, get bitmap() { return bmpVer === ver ? bmp : null; } };
    const at = (c) => [(c % COLS) * CELL + CELL / 2, ((c / COLS) | 0) * CELL + CELL / 2];
    const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
    const sstep = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    function paint(s, c) {
      const R = CELL / 2 - 1, W1 = [255, 255, 255];
      let [x, y] = at(s), gr = g.createRadialGradient(x, y, 0, x, y, R);
      for (const t of [0, 0.04, 0.08, 0.13, 0.19, 0.27, 0.37, 0.5, 0.65, 0.82, 1]) { // core to ~.1, band to ~.25, halo
        const a = Math.min(1, Math.exp(-((t / 0.1) ** 2)) + 0.7 * Math.exp(-((t / 0.24) ** 2)) + 0.2 * Math.exp(-((t / 0.55) ** 2))) * (1 - t ** 3);
        gr.addColorStop(t, css(mixRgb(c, W1, 1 - sstep(0.04, 0.26, t)), a));
      }
      g.fillStyle = gr; g.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
      [x, y] = at(s + 1); // glint: two thin crossed rays, white at the middle, over a small hot core
      g.globalCompositeOperation = 'lighter';
      for (const v of [0, 1]) {
        const lg = v ? g.createLinearGradient(x, y - R, x, y + R) : g.createLinearGradient(x - R, y, x + R, y);
        lg.addColorStop(0, css(c, 0)); lg.addColorStop(0.35, css(c, 0.35)); lg.addColorStop(0.5, css(W1, 1)); lg.addColorStop(0.65, css(c, 0.35)); lg.addColorStop(1, css(c, 0));
        g.fillStyle = lg;
        if (v) g.fillRect(x - 0.9, y - R, 1.8, 2 * R); else g.fillRect(x - R, y - 0.9, 2 * R, 1.8);
      }
      gr = g.createRadialGradient(x, y, 0, x, y, 6);
      gr.addColorStop(0, css(W1, 0.9)); gr.addColorStop(0.4, css(mixRgb(c, W1, 0.5), 0.5)); gr.addColorStop(1, css(c, 0));
      g.fillStyle = gr; g.fillRect(x - 6, y - 6, 12, 12);
      g.globalCompositeOperation = 'source-over';
      [x, y] = at(s + 2); gr = g.createRadialGradient(x, y, 0, x, y, R); // soft
      for (const t of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) gr.addColorStop(t, css(c, Math.exp(-((t / 0.45) ** 2)) * (1 - t * t)));
      g.fillStyle = gr; g.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
    }
    S.id = (col) => {
      const k = toHex(col).toLowerCase();
      let s = ids.get(k);
      if (s !== undefined) return s;
      if (next + 3 > COLS * ROWS) { ids.clear(); next = 0; S.gen++; S.hexOf.length = 0; g.clearRect(0, 0, atlas.width, atlas.height); }
      s = next; next += 3; ids.set(k, s); S.hexOf[s] = k;
      paint(s, rgb(k)); ver++;
      return s;
    };
    // kind: S.HEAD, S.GLINT or S.SOFT. The bitmap only while it matches the atlas (a new colour since: the canvas itself).
    S.draw = (gc, s, kind, x, y, r) => {
      const c = s + kind;
      gc.drawImage(bmpVer === ver ? bmp : atlas, (c % COLS) * CELL, ((c / COLS) | 0) * CELL, CELL, CELL, x - r, y - r, r * 2, r * 2);
    };
    S.refresh = () => {
      if (bmpVer === ver || pending === ver || !window.createImageBitmap) return;
      const v = pending = ver;
      createImageBitmap(atlas).then((b) => {
        if (v === ver) { if (bmp && bmp.close) bmp.close(); bmp = b; bmpVer = v; } else if (b.close) b.close();
        if (pending === v) pending = 0;
      }, () => { if (pending === v) pending = 0; });
    };
    return S;
  })();
  // Colour-temperature ramps, as atlas slots. 'k' (a coloured star): white-tinted, tinted, its colour, a deep cooled shade.
  // 'c' (charcoal/gold): the glowing-ember ramp from white-hot to dull red. stageOf(p) picks the stage a star is at.
  const CHARCOAL = ['#fff8ea', '#ffe8b0', '#ffcf72', '#ffad48', '#ff8a34', '#e8622a', '#b8441f'];
  const ramps = new Map();
  let rampGen = 0;
  function ramp(col, kind = 'k') {
    if (rampGen !== SPR.gen) { ramps.clear(); rampGen = SPR.gen; }
    const k = kind === 'c' ? 'c' : `k${toHex(col)}`;
    let r = ramps.get(k);
    if (r) return r;
    if (kind === 'c') r = CHARCOAL.map(SPR.id);
    else { const c = toHex(col); r = [tintHex(c, '#ffffff', 0.72), tintHex(c, '#ffffff', 0.32), c, tintHex(c, '#ff783c', 0.3, 0.82)].map(SPR.id); }
    if (rampGen !== SPR.gen) { rampGen = SPR.gen; ramps.clear(); return ramp(col, kind); } // the atlas filled up part-way
    ramps.set(k, r);
    return r;
  }
  function stageOf(p) {
    const s = p.age / p.life;
    return p.kind === 'c' ? (p.age < 0.08 ? 0 : Math.min(6, 1 + ((s * 6) | 0))) : (p.age < 0.05 ? 0 : p.age < 0.16 ? 1 : s > 0.8 ? 3 : 2);
  }
  // Every colour a show starts with, so the bitmap exists before the first burst (called just above Boot).
  function warmSprites() {
    for (const k in PALETTES) for (const c of PALETTES[k]) ramp(c);
    for (const c of GOLD) ramp(c);
    ramp('', 'c');
    for (const k in SPARK_COLORS) if (SPARK_COLORS[k]) ramp(SPARK_COLORS[k]);
    SPR.refresh();
  }

  // ---------- Particles ----------
  const stars = [], sparks = [], starPool = [], sparkPool = [];
  const G = () => 110 * U; // star gravity (px/s²)
  // Pools stay small on low phones: a long show otherwise keeps every particle it ever had (catalogue: pools <= 400).
  function release(pool, p) { p.onDeath = null; if (pool.length < Q().poolCap) pool.push(p); }

  function star(x, y, vx, vy, col, life, o) {
    o = o || {};
    // Scripted picture stars (the tiger, the flag) may go 200 past the budget: a picture needs its points, and they
    // are cheap (no glitter, no tails, no physics while scripted).
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars + (o.follow ? 200 : 0)) return null;
    const p = starPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y;
    p.vx = vx; p.vy = vy;
    p.color = col; p.life = life * curHang; p.age = 0;
    const size = o.size || 2.2, uv = UV();
    p.w = o.w || Math.max(1.1, size * uv);
    p.k = o.drag || 1.5;
    p.grav = o.grav ?? 1;
    if (launch.sequence && !launch.sequence.ground) {
      if (!o.follow) p.life = Math.min(4.5, life * 1.24); // a scripted picture (the tiger) keeps its own timing
      p.grav *= 0.7;
    } else if (launch.sequence && launch.sequence.ground) {
      p.vy *= 1.2; p.vx *= 1.08;
    }
    p.hold = o.hold || 0;
    p.glitter = o.glitter || 0;
    p.gcol = o.gcol || '#ffd98a';
    p.strobe = o.strobe || 0;
    p.color2 = o.color2 || null;
    p.change = o.change || 0;
    // changeT (seconds) flips every star of a shell at the same instant, as real colour-change stars do.
    p.chT = o.changeT !== undefined ? o.changeT * curHang : p.change * p.life;
    p.fl = !o.w && !o.hold && o.flicker !== false; // flickers out at the end of its life, as a burning star does
    p.fol = o.follow || null; // follow(p) -> [x, y] while it is scripted, or null to let it go
    p.wig = (o.wig || 0) * U; p.sw = o.swirl || 0; // wig: a go-getter's random wander; swirl: turns its path (rad/s)
    p.twinkle = !!o.twinkle;
    p.fade = o.fade || 0.35;
    p.onDeath = o.onDeath || null;
    p.L = o.L ?? curLayer;
    p.an = curAnchor;
    p.dim = o.dim ?? curDim;
    p.sc = curScale;
    if (curScale !== 1) { p.vx *= curScale; p.vy *= curScale; p.w *= curScale; }
    p.floorY = o.floorY || 0;
    // The look, fixed at spawn: temperature ramps (atlas slots), head radius and whether it gets a head at all. Text and
    // shape stars keep a core-only halo so letters stay crisp; past the tier's head budget only a quarter get one.
    p.kind = o.kind || 'k';
    p.rp = ramp(col, p.kind); p.rp2 = p.color2 ? ramp(p.color2, p.kind) : null; p.rg = SPR.gen;
    p.hr = (o.head ?? 3.4 + 2 * size) * uv * Q().headK * curScale;
    p.halo = o.w || o.hold ? 'core' : stars.length < Q().heads || Math.random() < 0.25;
    p.sp = !!o.sputter; p.dz = Math.random();
    // Streak length as speed x tl: the distance covered over the last tau seconds under drag k (0 under long exposure,
    // which already keeps the whole path).
    const tau = settings.longExposure || p.hold ? 0 : o.tau ?? 0.03;
    p.tl = tau ? (Math.exp(p.k * tau) - 1) / p.k : 0;
    // History tail (willow-like types): up to tn points sampled every tdt, kept in a pooled Float32Array. Off under long
    // exposure, where the slow fade already keeps the whole path.
    p.tail = settings.longExposure ? 0 : o.tail || 0;
    if (p.tail) {
      if (!p.hx) p.hx = new Float32Array(24);
      p.tn = Math.min(12, o.tn || Q().tailN, Q().tailN); p.tdt = o.tdt || 0.05; p.hn = 0; p.ht = 0;
    }
    stars.push(p);
    return p;
  }

  // o: { gl: glitters, st: streak seconds, c2: the colour it cools to, drag, grav, onDeath, gen, cap: share of the budget }.
  // Children (glitter .92, forks .98) only spawn below the full budget, and a fork's fork (gen 2) never.
  function spark(x, y, vx, vy, col, life, o) {
    if (o && o.gen > 1) return;
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars * ((o && o.cap) || 1)) return;
    const p = sparkPool.pop() || {};
    p.x = p.px = x; p.y = p.py = y; p.vx = vx * curScale; p.vy = vy * curScale; p.color = col; p.life = life; p.age = 0; p.L = curLayer; p.an = curAnchor;
    p.sc = curScale; p.dim = curDim;
    p.cs = SPR.id(col); p.c2s = (o && o.c2) || null; p.c2 = p.c2s ? SPR.id(p.c2s) : -1; p.rg = SPR.gen;
    p.gl = !!(o && o.gl); p.st = (o && o.st) || 0; p.k = (o && o.drag) ?? 3; p.grav = (o && o.grav) ?? 0.7;
    p.dz = Math.random(); p.onDeath = (o && o.onDeath) || null; p.gen = (o && o.gen) || 0;
    p.gt = p.gl && Math.random() < 0.07; // a few glitter sparks pop as a 4-ray glint
    sparks.push(p);
  }
  const GLIT = { cap: 0.92, gl: true };

  function liftTrail(s) {
    if (s.lift === 'comet') { // a thick burning comet: white-hot head, a long brocade tail
      for (let k = 0; k < 2; k++) spark(s.x, s.y, rand(-18, 18) * U, rand(5, 45) * U, Math.random() < 0.5 ? '#ffe9c4' : '#ffc46e', rand(0.5, 0.95), { drag: 2.4, grav: 0.5, st: 0.04 });
      if (Math.random() < 0.6) spark(s.x, s.y, rand(-30, 30) * U, rand(0, 40) * U, '#ffd98a', rand(0.4, 0.8), GLIT);
    } else if (s.lift === 'crackle') {
      if (Math.random() < 0.85) spark(s.x, s.y, rand(-25, 25) * U, rand(10, 70) * U, '#ffc987', rand(0.25, 0.55));
      if (Math.random() < 0.18) spark(s.x, s.y, rand(-20, 20) * U, rand(0, 30) * U, '#fff3d0', rand(0.3, 0.6), { onDeath: (p) => { crackleBurst(p.x, p.y); if (Math.random() < 0.3) Sound.crackle(pan(p.x)); } });
    } else if (Math.random() < 0.85) spark(s.x, s.y, rand(-25, 25) * U, rand(10, 70) * U, '#ffc987', rand(0.25, 0.55));
  }

  // Layered breaks, as real shells are built: a pistil, one to three petals and rings in one call.
  // Each layer: { r: radius as a share of the shell, n: stars, col, col2 + changeT (s), life, size, drag, glitter, gcol,
  // tail, strobe, grav, fade, ring: { squash, tilt } for a flat ring }.
  function layers(x, y, sz, list) {
    const R = R0() * sz;
    for (const l of list) {
      const k = l.drag || 1.5, r = R * (l.r || 1) * k, n = cnt((l.n || 60) * (l.ring ? Math.sqrt(sz) : sz));
      const o = { drag: k, size: l.size || 2.2, color2: l.col2, changeT: l.col2 ? l.changeT ?? (l.life || 1.6) * 0.55 : undefined,
        glitter: l.glitter || 0, gcol: l.gcol, tail: l.tail || 0, strobe: l.strobe || 0, grav: l.grav, fade: l.fade, twinkle: l.twinkle };
      const life = l.life || 1.6;
      if (l.ring) {
        const sq = l.ring.squash ?? rand(0.3, 1), tilt = l.ring.tilt ?? rand(0, TAU), c = Math.cos(tilt), si = Math.sin(tilt);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU, px = Math.cos(a), py = Math.sin(a) * sq; star(x, y, (px * c - py * si) * r, (px * si + py * c) * r, l.col, life * rand(0.96, 1.04), o); }
      } else sphere(n, (dx, dy) => { const j = rand(0.93, 1.04); star(x, y, dx * r * j, dy * r * j, l.col, life * rand(0.94, 1.05), o); });
    }
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
  const UV = () => Math.max(U, 0.65); // a visual floor for sprite sizes: U is .5 on every portrait phone
  // Picture shells' points, [x, y, colour] around the burst point, scaled to the shell and this phone's star budget.
  function flagIndiaPts(sz) {
    const w = R0() * sz * 1.25, h = w * 2 / 3, cols = Math.max(11, Math.round(17 * Math.sqrt(Q().count))), rows = 3;
    const wave = (px) => Math.sin(px / w * Math.PI * 1.6) * h * 0.06;
    const pts = [], cols3 = ['#ff7a00', '#fff4e6', '#0fb23a']; // deeper saffron and green: a held star cools towards white
    for (let b = 0; b < 3; b++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = -w + (c / (cols - 1)) * w * 2, py = -h + ((b * rows + r + 0.5) / (rows * 3)) * h * 2;
      if (b === 1 && Math.hypot(px, py) < h * 0.27) continue; // the chakra's place
      pts.push([px, py + wave(px), cols3[b]]);
    }
    const cr = h * 0.24, spokes = Math.round(24 * Math.min(1, Q().count + 0.3));
    for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; pts.push([Math.cos(a) * cr, Math.sin(a) * cr + wave(0), '#5b7bff']); }
    for (let i = 0; i < spokes; i++) { const a = (i / spokes) * TAU; for (const f of [0.35, 0.7]) pts.push([Math.cos(a) * cr * f, Math.sin(a) * cr * f + wave(0), '#5b7bff']); }
    return pts;
  }
  // The animal's size: big, but never past the screen's width or up behind the buttons.
  const tigerS = (sz) => Math.min(R0() * sz * 0.95, W * 0.3, H * 0.17);
  // National animals drawn in stars, front view, after drone shows and drawing guides (research/fireworks-videos).
  // Each art function adds lines in face units: add(colour, polyline, role, move(open, i) -> [x, y]). Roles: 'eye' (seen
  // first, blinks), 'fang' (bared only as the mouth opens), 'mouth' (moves with open), '' (the face).
  const mouthParts = (add, o) => { // an oval mouth at cy that opens, with fangs and a tongue
    const C = (k) => o.cy + 0.06 * k, R = (k) => 0.035 + o.open * k, oval = (k) => arc(0, C(k), o.rx, R(k), 0, TAU, 20);
    add(o.lip || '#ffffff', oval(1), 'mouth', (k, i) => oval(k)[i]);
    const fang = (sx, top, len) => (k) => { const c = C(k), r = R(k), y0 = top ? c - r : c + r, d = (top ? 1 : -1) * len * Math.min(1, k * 1.4); return [[sx - 0.035, y0], [sx, y0 + d], [sx + 0.035, y0]]; };
    for (const [sx, top, len] of o.fangs || []) { const f = fang(sx, top, len); add('#ffffff', f(1), 'fang', (k, i) => f(k)[i]); }
    const tongue = (k) => arc(0, C(k) + R(k) * 0.45, o.rx * 0.48, 0.06 + 0.04 * k, Math.PI * 1.05, Math.PI * 1.95, 6);
    add('#ff5f7a', tongue(1), 'fang', (k, i) => tongue(k)[i]);
  };
  const ring2 = (cx, cy, r, n = 8) => arc(cx, cy, r, r, 0, TAU, n);
  const ANIMAL_ART = {
    // The Bengal tiger: angry V brows, slanted eyes, a big nose, a jagged ruff and jagged stripes.
    tiger(add, spots) {
      const gold = spots, face = gold ? '#ffc23d' : '#ff8a2b', ruffC = gold ? '#ffd36b' : '#ffb347', mark = gold ? '#ff7a1a' : '#e2462a';
      const head = [], ruff = [];
      for (let i = 0; i <= 40; i++) { const a = Math.PI * (0.95 + 1.1 * i / 40); head.push([Math.cos(a) * 0.9, Math.sin(a) * 0.85]); }
      for (let i = 0; i <= 22; i++) { const a = Math.PI * (0.05 + 0.9 * i / 22), r = i % 2 ? 0.86 : 1.02; ruff.push([Math.cos(a) * r * 0.95, 0.05 + Math.sin(a) * r * 0.9]); }
      add(face, head); add(ruffC, ruff);
      add(face, arc(-0.66, -0.72, 0.22, 0.2, Math.PI * 0.9, Math.PI * 2.1, 10)); add(face, arc(0.66, -0.72, 0.22, 0.2, Math.PI * 0.9, Math.PI * 2.1, 10));
      add('#fff4e6', arc(-0.66, -0.68, 0.1, 0.08, Math.PI, Math.PI * 2, 5)); add('#fff4e6', arc(0.66, -0.68, 0.1, 0.08, Math.PI, Math.PI * 2, 5));
      add('#ffd36b', [[-0.62, -0.46], [-0.4, -0.38], [-0.14, -0.26]]); add('#ffd36b', [[0.62, -0.46], [0.4, -0.38], [0.14, -0.26]]);
      add('#d8ff5a', [[-0.56, -0.24], [-0.36, -0.3], [-0.16, -0.18], [-0.36, -0.13], [-0.56, -0.24]], 'eye');
      add('#d8ff5a', [[0.56, -0.24], [0.36, -0.3], [0.16, -0.18], [0.36, -0.13], [0.56, -0.24]], 'eye');
      add('#ffffff', [[-0.36, -0.22], [-0.35, -0.2]], 'eye'); add('#ffffff', [[0.36, -0.22], [0.35, -0.2]], 'eye');
      add('#ffd36b', [[-0.1, -0.24], [-0.13, 0.02]]); add('#ffd36b', [[0.1, -0.24], [0.13, 0.02]]);
      add('#ff5f7a', [[-0.17, 0.04], [0.17, 0.04], [0, 0.2], [-0.17, 0.04]]);
      add('#fff4e6', arc(-0.2, 0.3, 0.2, 0.14, Math.PI * 0.75, Math.PI * 1.9, 8)); add('#fff4e6', arc(0.2, 0.3, 0.2, 0.14, Math.PI * 1.1, Math.PI * 2.25, 8));
      for (const sg of [-1, 1]) { add('#fff4e6', [[sg * 0.34, 0.3], [sg * 0.8, 0.22]]); add('#fff4e6', [[sg * 0.34, 0.36], [sg * 0.82, 0.4]]); }
      if (gold) { // the jaguar's rosettes
        for (const [rx, ry] of [[-0.25, -0.62], [0.25, -0.62], [0, -0.72], [-0.47, -0.5], [0.47, -0.5], [-0.74, -0.08], [0.74, -0.08], [-0.78, 0.18], [0.78, 0.18], [-0.6, 0.08], [0.6, 0.08]]) add(mark, ring2(rx, ry, 0.065, 7));
      } else {
        add(mark, [[-0.06, -0.84], [0, -0.52], [0.06, -0.84]]); add(mark, [[-0.3, -0.8], [-0.17, -0.55], [-0.2, -0.8]]); add(mark, [[0.3, -0.8], [0.17, -0.55], [0.2, -0.8]]);
        for (const sg of [-1, 1]) { add(mark, [[sg * 0.88, -0.3], [sg * 0.6, -0.22], [sg * 0.86, -0.18]]); add(mark, [[sg * 0.95, 0], [sg * 0.62, 0.05], [sg * 0.94, 0.12]]); add(mark, [[sg * 0.88, 0.32], [sg * 0.64, 0.3], [sg * 0.84, 0.42]]); }
      }
      mouthParts(add, { cy: 0.42, rx: 0.27, open: 0.24, fangs: [[-0.15, true, 0.17], [0.15, true, 0.17], [-0.1, false, 0.11], [0.1, false, 0.11]] });
    },
    jaguar(add) { ANIMAL_ART.tiger(add, true); },
    // The lion: a face inside a great jagged mane.
    lion(add) {
      const mane = [], inner = [];
      for (let i = 0; i <= 32; i++) { const a = (i / 32) * TAU, r = i % 2 ? 0.98 : 1.18; mane.push([Math.cos(a) * r, 0.05 + Math.sin(a) * r * 0.98]); }
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, r = i % 2 ? 0.8 : 0.9; inner.push([Math.cos(a) * r, 0.05 + Math.sin(a) * r * 0.98]); }
      add('#ff8a2b', mane); add('#e2662a', inner);
      add('#ffcf6b', arc(0, 0.06, 0.62, 0.7, 0, TAU, 30)); // the face
      add('#ffcf6b', ring2(-0.44, -0.56, 0.1, 6)); add('#ffcf6b', ring2(0.44, -0.56, 0.1, 6)); // ears
      add('#fff4e6', [[-0.46, -0.32], [-0.28, -0.26], [-0.12, -0.22]]); add('#fff4e6', [[0.46, -0.32], [0.28, -0.26], [0.12, -0.22]]);
      add('#ffe14d', [[-0.42, -0.14], [-0.27, -0.2], [-0.12, -0.12], [-0.27, -0.07], [-0.42, -0.14]], 'eye');
      add('#ffe14d', [[0.42, -0.14], [0.27, -0.2], [0.12, -0.12], [0.27, -0.07], [0.42, -0.14]], 'eye');
      add('#ffffff', [[-0.27, -0.15], [-0.26, -0.13]], 'eye'); add('#ffffff', [[0.27, -0.15], [0.26, -0.13]], 'eye');
      add('#ffcf6b', [[-0.09, -0.18], [-0.12, 0.06]]); add('#ffcf6b', [[0.09, -0.18], [0.12, 0.06]]);
      add('#ff8a8a', [[-0.15, 0.08], [0.15, 0.08], [0, 0.22], [-0.15, 0.08]]);
      add('#fff4e6', arc(-0.15, 0.32, 0.16, 0.12, Math.PI * 0.7, Math.PI * 1.9, 7)); add('#fff4e6', arc(0.15, 0.32, 0.16, 0.12, Math.PI * 1.1, Math.PI * 2.3, 7));
      for (const sg of [-1, 1]) add('#fff4e6', [[sg * 0.28, 0.34], [sg * 0.62, 0.3]]);
      mouthParts(add, { cy: 0.44, rx: 0.22, open: 0.22, fangs: [[-0.12, true, 0.15], [0.12, true, 0.15], [-0.08, false, 0.1], [0.08, false, 0.1]] });
    },
    // The bald eagle: a white head, fierce brows, a hooked yellow beak that opens in a screech, brown shoulders.
    eagle(add) {
      const head = [];
      for (let i = 0; i <= 30; i++) { const a = Math.PI * (0.92 + 1.16 * i / 30); head.push([Math.cos(a) * 0.62, -0.05 + Math.sin(a) * 0.72]); }
      const neck = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14, x = -0.6 + 1.2 * t; neck.push([x, 0.62 + (i % 2 ? 0.1 : 0) - Math.abs(x) * 0.1]); }
      add('#f4f6ff', head); add('#f4f6ff', neck);
      add('#c8722a', [[-1.05, 0.95], [-0.8, 0.66], [-0.55, 0.62]]); add('#c8722a', [[1.05, 0.95], [0.8, 0.66], [0.55, 0.62]]); // shoulders
      add('#c8722a', [[-1.12, 1.08], [-0.86, 0.82]]); add('#c8722a', [[1.12, 1.08], [0.86, 0.82]]);
      add('#ffd36b', [[-0.5, -0.3], [-0.3, -0.24], [-0.12, -0.12]]); add('#ffd36b', [[0.5, -0.3], [0.3, -0.24], [0.12, -0.12]]); // heavy brows
      add('#ffd23d', [[-0.42, -0.16], [-0.3, -0.21], [-0.18, -0.12], [-0.3, -0.07], [-0.42, -0.16]], 'eye');
      add('#ffd23d', [[0.42, -0.16], [0.3, -0.21], [0.18, -0.12], [0.3, -0.07], [0.42, -0.16]], 'eye');
      add('#ffffff', [[-0.3, -0.15], [-0.29, -0.13]], 'eye'); add('#ffffff', [[0.3, -0.15], [0.29, -0.13]], 'eye');
      add('#ffc21a', [[-0.17, -0.04], [0.17, -0.04], [0.11, 0.22], [0, 0.4], [-0.11, 0.22], [-0.17, -0.04]]); // the hooked upper beak
      add('#ffe7b0', [[-0.06, 0.04], [-0.04, 0.06]]); add('#ffe7b0', [[0.06, 0.04], [0.04, 0.06]]); // nostrils
      const low = (k) => [[-0.1, 0.24], [0, 0.32 + 0.22 * k], [0.1, 0.24]];
      add('#ffc21a', low(1), 'mouth', (k, i) => low(k)[i]); // the lower beak drops in the screech
      const tng = (k) => [[-0.03, 0.27], [0, 0.27 + 0.16 * k], [0.03, 0.27]];
      add('#ff5f7a', tng(1), 'fang', (k, i) => tng(k)[i]);
    },
    // The giant panda: a round white face, grey ear and eye patches, a small nose and a smile that grows.
    panda(add) {
      add('#f4f6ff', arc(0, 0.04, 0.86, 0.78, 0, TAU, 36));
      add('#9aa3b5', ring2(-0.62, -0.66, 0.2, 10)); add('#9aa3b5', ring2(0.62, -0.66, 0.2, 10)); // ears
      add('#9aa3b5', ring2(-0.62, -0.66, 0.1, 6)); add('#9aa3b5', ring2(0.62, -0.66, 0.1, 6));
      const patch = (sg) => arc(sg * 0.33, -0.06, 0.19, 0.26, 0, TAU, 14).map(([px, py]) => { const dx = px - sg * 0.33, dy = py + 0.06, a = sg * 0.5; return [sg * 0.33 + dx * Math.cos(a) - dy * Math.sin(a), -0.06 + dx * Math.sin(a) + dy * Math.cos(a)]; });
      add('#9aa3b5', patch(-1)); add('#9aa3b5', patch(1));
      add('#ffffff', ring2(-0.33, -0.08, 0.07, 6), 'eye'); add('#ffffff', ring2(0.33, -0.08, 0.07, 6), 'eye');
      add('#ffffff', [[-0.31, -0.1], [-0.3, -0.09]], 'eye'); add('#ffffff', [[0.31, -0.1], [0.3, -0.09]], 'eye');
      add('#9aa3b5', arc(0, 0.2, 0.1, 0.06, 0, TAU, 8)); // nose
      add('#ff8ab0', arc(-0.5, 0.3, 0.1, 0.05, 0, TAU, 6)); add('#ff8ab0', arc(0.5, 0.3, 0.1, 0.05, 0, TAU, 6)); // blush
      const smile = (k) => Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = -0.2 - 0.06 * k + (0.4 + 0.12 * k) * t; return [x, 0.34 + Math.sin(t * Math.PI) * (0.06 + 0.1 * k)]; });
      add('#ff8ab0', smile(1), 'mouth', (k, i) => smile(k)[i]);
    },
  };
  // How each animal's big moment plays: a roar (tiger, jaguar, lion), a screech (eagle) or a burst of hearts (panda).
  const ANIMAL_FX = { tiger: 'roar', jaguar: 'roar', lion: 'roar', eagle: 'screech', panda: 'hearts' };
  // Points spread evenly along an animal's lines by length (about 220 even on a low phone); each is
  // [x, y, colour, role, at(open) -> [x, y] or null], scaled by S.
  function animalPts(kind, sz) {
    const S = tigerS(sz), lines = [];
    ANIMAL_ART[kind]((c, l, r = '', mv = null) => lines.push({ c, l, r, mv }));
    const len = (l) => l.slice(1).reduce((d, p, i) => d + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0);
    const total = lines.reduce((a, L) => a + len(L.l), 0), n = Math.round(Math.max(170, 260 * Math.sqrt(Q().count))), step = total / n, out = [];
    for (const L of lines) {
      const tot = len(L.l), k = Math.max(L.r === 'eye' && L.l.length === 2 ? 1 : 2, Math.round(tot / step));
      for (let j = 0; j < k; j++) {
        const f = k === 1 ? 0 : j / (k - 1);
        const at = (l) => { const want = f * len(l); let d = 0; for (let i = 1; i < l.length; i++) { const sg = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); if (d + sg >= want || i === l.length - 1) { const t = sg ? Math.min(1, (want - d) / sg) : 0; return [l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t]; } d += sg; } return l[0]; };
        const p0 = at(L.l);
        out.push([p0[0] * S, p0[1] * S, L.c, L.r, L.mv ? (o) => { const q = at(L.l.map((_, i) => L.mv(o, i))); return [q[0] * S, q[1] * S]; } : null]);
      }
    }
    return out;
  }
  const tigerPts = (sz) => animalPts('tiger', sz);
  // The animal, cinematic. Two eyes open in the dark sky and blink; the face gathers round them (from the flag's stars
  // when `from` is given, else from the burst); it lunges towards you; then its moment: the mouth opens and, a beat
  // later, a roar (a cone of breath, shockwave rings, a trembling head, a shaking sky), a screech (a wind blast and
  // feathers) or a burst of hearts; then it calms, breathes and the stars fall away. Timed on each star's own age.
  function animalCinema(kind, x, y0, sz, from) {
    const T = animalPts(kind, sz), S = tigerS(sz), fx = ANIMAL_FX[kind], show = { roared: false };
    const y = Math.max(y0, safeTop() + S * 1.35 + 64 * U); // the ears (or the mane) stay clear of the top buttons
    const back = (u) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2, ease = (u) => 1 - (1 - u) ** 3, sm = (u) => u * u * (3 - 2 * u);
    const EYES = 0.9, FORM = 0.8, LUNGE = 0.8, ROAR = 1.7, CALM = 0.9;
    const tF = EYES, tL = tF + FORM, tR = tL + LUNGE, tC = tR + ROAR, tEnd = tC + CALM;
    const ring = (mx, my, v, col) => { for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; star(mx, my, Math.cos(a) * v * U, Math.sin(a) * v * 0.8 * U, col, 0.45, { drag: 3.2, grav: 0, size: 1.6, flicker: false }); } };
    const momentFx = () => {
      show.roared = true;
      const my = y + S * (kind === 'eagle' ? 0.3 : kind === 'panda' ? 0.36 : 0.5);
      if (fx === 'hearts') { // the panda's smile: little hearts float up and sparkle
        flash(x, my, '#ff8ab0', 1.2); addLight('#ff8ab0', 1.8);
        for (let h = 0; h < 6; h++) {
          const hx = x + rand(-1.1, 1.1) * S, hy = y + rand(-0.6, 0.2) * S, hs = rand(0.12, 0.2) * S, vy = -rand(40, 80) * U;
          heartPath(0, 0, 1).forEach(([px, py]) => star(hx, hy, px * hs * 2.2, py * hs * 2.2 + vy, h % 2 ? '#ff6ec7' : '#ff8ab0', rand(1.2, 1.6), { drag: 2.2, grav: -0.15, size: 1.8 }));
        }
        for (let i = 0; i < cnt(24); i++) { const a = rand(0, TAU), v = rand(80, 260) * U; star(x, my, Math.cos(a) * v, Math.sin(a) * v, '#fff4e6', rand(0.5, 0.9), { drag: 2, size: 1.4, twinkle: true }); }
        Sound.pop(pan(x)); Sound.crackle(pan(x)); buzz(25);
        return;
      }
      const eagle = fx === 'screech';
      flash(x, my, eagle ? '#f4f6ff' : '#ffb347', 1.9); addLight(eagle ? '#e8ecff' : '#ff8a2b', 2.8); addLight('#ffffff', 0.8);
      ring(x, my, 600, '#fff1d6'); after(0.16, () => ring(x, my, 420, '#fff1d6'));
      for (let i = 0; i < cnt(50); i++) { // a cone of breath (or a blast of wind), out of the mouth and towards you
        const a = Math.PI / 2 + rand(-0.95, 0.95), v = rand(160, 620) * U;
        const col = eagle ? (Math.random() < 0.6 ? '#f4f6ff' : '#cfe0ff') : kind === 'jaguar' ? (Math.random() < 0.55 ? '#ffe14d' : '#ff9a1a') : (Math.random() < 0.55 ? '#ffcf6b' : '#ff5f2b');
        star(x + rand(-14, 14) * U, my + rand(-6, 6) * U, Math.cos(a) * v, Math.sin(a) * v * 0.75, col, rand(0.5, 1.1), { drag: 1.7, grav: -0.1, size: rand(1.6, 2.6), glitter: 0.9, gcol: eagle ? '#ffffff' : '#ffe7b0' });
      }
      if (eagle) for (let i = 0; i < 10; i++) star(x + rand(-1, 1) * S, y + rand(-0.4, 0.6) * S, rand(-40, 40) * U, rand(-30, 10) * U, '#f4f6ff', rand(1.6, 2.4), { drag: 1.2, grav: 0.25, size: 2, wig: 600 }); // drifting feathers
      shake = Math.max(shake, eagle ? 0.4 : 0.6); buzz([60, 40, 90]);
      Sound.thump(pan(x)); Sound.bang(pan(x), { rate: eagle ? 1.3 : 0.45, gain: 1.35 }); Sound.crackle(pan(x));
    };
    T.forEach((t, i) => {
      const [sx, sy] = from ? from[i % from.length] : [x, y], role = t[3], eye = role === 'eye', fang = role === 'fang', mv = t[4];
      star(sx, sy, 0, 0, t[2], tEnd + rand(1, 1.5), { size: eye ? 3.5 : fang ? 3 : 2.7, grav: 0.55, drag: 2, fade: 0.2, flicker: false, tau: 0.01, follow: (p) => {
        const a = p.age;
        if (a >= tEnd) { p.dim = 1; return null; } // let go: it droops and fades
        let sc = 0.62, rot = 0, cy = y, open = 0;
        if (a < tL) { // the eyes first, then the face gathering round them
          const at = eye ? Math.min(1, a / (EYES * 0.7)) : Math.max(0, (a - tF) / FORM);
          p.dim = fang ? 0 : eye ? (a > 0.55 && a < 0.68 ? 0.15 : 1) : sm(at); // a blink; the fangs wait
          const [qx, qy] = mv ? mv(0) : [t[0], t[1]], tx = x + qx * sc, ty = y + qy * sc, u = ease(at);
          return [sx + (tx - sx) * u, sy + (ty - sy) * u];
        }
        p.dim = 1;
        if (a < tR) { const u = (a - tL) / LUNGE; sc = 0.62 + (1.1 - 0.62) * back(u); rot = 0.2 * (1 - u) * Math.sin(u * Math.PI * 2.2); cy = y - S * 0.1 * (1 - u); }
        else if (a < tC) { // its moment: the mouth opens first, the roar (screech, hearts) follows
          const r = a - tR; open = r < 0.28 ? sm(r / 0.28) : r > ROAR - 0.35 ? sm((ROAR - r) / 0.35) : 1;
          if (r > 0.3 && !show.roared) momentFx();
          const tremble = fx !== 'hearts' && show.roared && r < 1 ? (Math.random() - 0.5) * 0.014 : 0;
          sc = 1.1 + 0.06 * open + tremble; cy = y - S * 0.06 * open;
          if (fx === 'hearts') rot = 0.12 * Math.sin(r * 6) * open; // the panda wobbles happily
        } else { const b = a - tC; sc = 1.1 + 0.03 * Math.sin(b * 5); rot = 0.04 * Math.sin(b * 2.4); }
        if (fang) p.dim = open > 0.2 ? Math.min(1, open * 1.3) : 0; // bared only in its moment
        const [qx, qy] = mv ? mv(open) : [t[0], t[1]], c = Math.cos(rot), si = Math.sin(rot), px = qx * sc, py = qy * sc;
        return [x + px * c - py * si, cy + px * si + py * c];
      } });
    });
  }
  const tigerCinema = (x, y0, sz, from) => animalCinema('tiger', x, y0, sz, from);
  // Flags as a grid of stars, from a colour at each (u, v) in 0..1 and optional extra lines (stars, a band), scaled to the
  // shell and the screen. Returns [x, y, colour] points around the burst point.
  const FLAGS = {
    bangladesh: { ar: 0.6, at: (u, v) => (((u - 0.45) / 0.6) ** 2 + (v - 0.5) ** 2 < 0.33 ** 2 ? '#ff3344' : '#0fb23a') },
    usa: {
      ar: 10 / 19,
      at: (u, v) => (u < 0.4 && v < 7 / 13 ? '#2f55ff' : Math.floor(v * 13) % 2 ? '#fff4e6' : '#ff3344'),
      extra: () => { const l = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) l.push([0.035 + c * 0.066 + (r % 2) * 0.033, 0.055 + r * 0.1, '#ffffff']); return l; },
    },
    uk: {
      ar: 0.5,
      at: (u, v) => {
        const X = u * 2, Y = v, d1 = Math.abs(X * 1 - Y * 2) / Math.sqrt(5), d2 = Math.abs((2 - X) * 1 - Y * 2) / Math.sqrt(5);
        const cx = Math.abs(X - 1), cy = Math.abs(Y - 0.5);
        if (cx < 0.1 || cy < 0.1) return '#ff3344';
        if (cx < 1 / 6 || cy < 1 / 6) return '#fff4e6';
        if (Math.min(d1, d2) < 0.035) return '#ff3344';
        if (Math.min(d1, d2) < 0.1) return '#fff4e6';
        return '#2f55ff';
      },
    },
    china: {
      ar: 2 / 3, at: () => '#ff2a2a',
      extra: () => {
        const l = [], starAt = (cx, cy, r, n) => starPath(0, 0, 1).forEach(([px, py]) => l.push([cx + px * r * (2 / 3), cy + py * r, '#ffd400']));
        starAt(5 / 30, 5 / 20, 0.15); for (const [cx, cy] of [[10 / 30, 2 / 20], [12 / 30, 4 / 20], [12 / 30, 7 / 20], [10 / 30, 9 / 20]]) starAt(cx, cy, 0.05);
        return l;
      },
    },
    brazil: {
      ar: 0.7,
      at: (u, v) => (((u - 0.5) / 0.7) ** 2 + (v - 0.5) ** 2 < 0.25 ** 2 ? '#2f55ff' : Math.abs(u - 0.5) / 0.415 + Math.abs(v - 0.5) / 0.41 <= 1 ? '#ffd400' : '#0fb23a'),
      extra: () => arc(0.5, 0.62, 0.22, 0.2, Math.PI * 1.15, Math.PI * 1.85, 8).map(([u, v]) => [u, v, '#ffffff']),
    },
  };
  function flagPts(id, sz) {
    const F = FLAGS[id], w = Math.min(R0() * sz * 1.25, W * 0.46), h = w * F.ar * 2 / 2;
    const cols = Math.round(clamp(26 * Math.sqrt(Q().count), 22, 30)), rows = Math.max(8, Math.round(cols * F.ar)), pts = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols, v = (r + 0.5) / rows, px = -w + u * w * 2;
      pts.push([px, -h + v * h * 2 + Math.sin(px / w * Math.PI * 1.6) * h * 0.06, F.at(u, v)]);
    }
    for (const [u, v, c] of F.extra ? F.extra() : []) { const px = -w + u * w * 2; pts.push([px, -h + v * h * 2 + Math.sin(px / w * Math.PI * 1.6) * h * 0.06, c]); }
    return pts;
  }
  // A country in one shot: its flag forms and holds, then every star becomes its national animal (animalCinema).
  function countryShow(x, y, sz, F, kind) {
    // The flag's stars are scripted (fly out, hold with a slow wave), so even a low phone draws the whole flag.
    const made = F.map((p) => star(x, y, 0, 0, p[2], 3, { size: 2.5, grav: 0.55, drag: 2, flicker: false, tau: 0.01, follow: (q) => {
      const a = q.age, u = Math.min(1, a / 0.55), e = 1 - (1 - u) ** 3, wave = Math.sin(p[0] / 40 + a * 2.4) * 2.5 * U;
      return [x + p[0] * e, y + p[1] * e + wave * u];
    } }));
    addLight(F[0][2], 0.8); addLight(F[F.length - 1][2], 0.6);
    after(1.9, () => {
      const from = made.filter((p) => p && stars.includes(p)).map((p) => [p.x, p.y]);
      // The flag's stars become the animal's: freed now, so a low phone's star budget has room for it.
      for (const p of made) { const i = p ? stars.indexOf(p) : -1; if (i >= 0) { stars[i] = stars[stars.length - 1]; stars.pop(); release(starPool, p); } }
      if (!from.length) return;
      animalCinema(kind, x, y, sz, from);
      Sound.crackle(pan(x));
    });
  }
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
        else if (Math.random() < 0.5) sphere(cnt(22 * sz), (dx, dy) => star(x, y, dx * R * 0.28 * k, dy * R * 0.28 * k, '#ffffff', rand(0.4, 0.55), { drag: k, size: 2.6 })); // a white flash core
      },
    },
    chrysanthemum: {
      label: 'Chrysanth.', icon: '🌼',
      fn(x, y, sz, c1) {
        const R = R0() * sz, k = 1.5;
        sphere(cnt(120 * sz), (dx, dy) => {
          const j = rand(0.94, 1.03);
          star(x, y, dx * R * k * j, dy * R * k * j, c1, rand(1.5, 1.9), { drag: k, size: 2, glitter: 0.35, gcol: '#ffe2a0', color2: '#b8401f', changeT: 1.3 }); // all cool to embers together
        });
      },
    },
    willow: {
      label: 'Willow', icon: '🌿',
      fn(x, y, sz, c1, c2, s) {
        const R = R0() * sz * 0.95, k = 1.3;
        const col = s && s.tint ? c1 : palette === PALETTES.classic ? '#ffb54a' : color(); // Rocket Rush asks for its rocket's colour
        sphere(cnt(90 * sz), (dx, dy) => {
          star(x, y, dx * R * k, dy * R * k, col, rand(3, 3.9), { drag: k, grav: 0.85, size: 1.8, glitter: 0.7, gcol: '#ffcf85', fade: 0.55 });
        });
      },
    },
    palm: {
      label: 'Palm', icon: '🌴', lift: 'comet', // the trunk: a thick rising comet
      fn(x, y, sz, c1) {
        const R = R0() * sz * 1.1, k = 1.25, n = Math.round(9 + sz * 4);
        const off = Math.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU + rand(-0.1, 0.1), j = rand(0.85, 1.05);
          star(x, y, Math.cos(a) * R * k * j, Math.sin(a) * R * k * j, c1, rand(2, 2.4), { drag: k, size: 4.6, glitter: 1.6, gcol: '#ffd27a', fade: 0.45, tail: 0.5 });
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
        if (Math.random() < 0.4) shape(x, y, rotate(pts, tilt), '#ffd36b', { drag: k, life: 1.8, size: 2.5, glitter: 0.8, color2: c1, changeT: 0.8, onDeath: (p) => { if (Math.random() < 0.35) crackleBurst(p.x, p.y); } });
        else shape(x, y, rotate(pts, tilt), c1, { drag: k, life: 1.6, size: 2.5 });
        sphere(cnt(28), (dx, dy) => star(x, y, dx * R * 0.3 * k, dy * R * 0.3 * k, c2, 1.2, { drag: k, size: 2 }));
      },
    },
    crossette: {
      label: 'Crossette', icon: '✚',
      fn(x, y, sz, c1) {
        const R = R0() * sz * 0.7, k = 1.2, n = cnt(20 * Math.sqrt(sz));
        const v = Math.random() < 0.35; // V pairs: each star splits in two at ±30° from its path
        const split = (p) => {
          const a = v ? Math.atan2(p.vy, p.vx) : Math.random() * TAU;
          for (let i = 0; i < (v ? 2 : 4); i++) {
            const b = v ? a + (i ? 0.52 : -0.52) : a + (i * Math.PI) / 2;
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
        const ball = Math.random() < 0.3; // a slow-falling ball of twinkles
        sphere(cnt(70 * sz), (dx, dy) => {
          star(x, y, dx * R * k, dy * R * k, col, rand(1.9, 2.7) * (ball ? 1.3 : 1), { drag: ball ? 2.2 : k, grav: ball ? 0.25 : 0.6, size: 2.6, strobe: ball ? rand(9, 12) : rand(7, 13) });
        });
        if (Math.random() < 0.25) TYPES.horsetail.fn(x, y, sz * 0.7, '#ffd36b');
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
      fn(x, y, sz, c1, c2, s) {
        if (!(s && s.cluster) && Math.random() < 0.3) { // a cluster of three, as the Yokohama finale fired them
          for (const d of [-1, 1]) after(rand(0.08, 0.25), () => TYPES.kamuro.fn(x + d * R0() * sz * 0.55, y + rand(-20, 30) * U, sz * 0.7, c1, c2, { cluster: true }));
        }
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
    // ---- Real-show shells (research/fireworks-videos): PGI, Malta, Yokohama, Lonestar and the biggest shells of 2020-24.
    dahlia: {
      label: 'Dahlia', icon: '🌺',
      fn(x, y, sz, c1) { layers(x, y, sz, [{ n: 42, col: c1, life: 2.7, size: 3.4, drag: 1.2, glitter: 0.2 }]); },
    },
    pistil: {
      label: 'Pistil', icon: '🏵️',
      fn(x, y, sz, c1, c2) {
        layers(x, y, sz, [
          { r: 0.38, n: 50, col: c2, life: 1.15, size: 2.4, drag: 1.7 },
          { r: 1, n: 85, col: '#f2f4ff', life: 2.2, drag: 1.5, tail: 0.6, glitter: 0.3, gcol: '#e8ecff' },
        ]);
      },
    },
    doublepetal: {
      label: 'Double petal', icon: '🌹',
      fn(x, y, sz, c1, c2) {
        layers(x, y, sz, [
          { r: 0.34, n: 45, col: c1, life: 1.2, size: 2.4 },
          { r: 0.7, n: 70, col: c2, life: 1.7 },
          { r: 1.05, n: 95, col: Math.random() < 0.5 ? c1 : '#fff4e0', life: 2.35, glitter: 0.15 },
        ]);
      },
    },
    brocade: {
      label: 'Brocade', icon: '👑',
      fn(x, y, sz, c1) {
        const tip = palette === PALETTES.classic ? (Math.random() < 0.5 ? '#ff3b3b' : '#4a7dff') : c1;
        layers(x, y, sz * 0.95, [{ n: 110, col: '#ffcf6b', col2: tip, changeT: 2.1, life: 3.1, drag: 1.3, grav: 0.9, size: 2, glitter: 1.4, gcol: '#ffd98a', tail: 0.7, fade: 0.5 }]);
      },
    },
    kingwillow: {
      label: 'King willow', icon: '🌳',
      fn(x, y, sz) {
        layers(x, y, sz * 1.15, [{ n: 140, col: '#ffb54a', col2: '#ff4433', changeT: 4.6, life: 5.6, drag: 1.25, grav: 0.7, size: 1.9, glitter: 1, gcol: '#ffcf85', tail: 0.8, fade: 0.4 }]);
        addLight('#ffb54a', sz);
      },
    },
    colorchange: {
      label: 'Colour change', icon: '🎨',
      fn(x, y, sz, c1, c2) {
        const twinkle = (p) => star(p.x, p.y, p.vx * 0.3, p.vy * 0.3, '#f4f6ff', rand(0.8, 1.1), { drag: 2.2, grav: 0.4, size: 1.8, strobe: 11, L: p.L });
        const R = R0() * sz, k = 1.5;
        sphere(cnt(90 * sz), (dx, dy) => star(x, y, dx * R * k, dy * R * k, '#ffcf55', 1.75, { drag: k, size: 2.4, color2: c2 === c1 ? '#33ff88' : c2, changeT: 0.85, onDeath: twinkle }));
      },
    },
    ghost: {
      label: 'Ghost', icon: '👻',
      fn(x, y, sz, c1, c2) {
        // The colour seems to travel round the sphere: each star changes a little later than its neighbour clockwise.
        const R = R0() * sz, k = 1.5, off = Math.random() * TAU;
        if (c2 === c1) c2 = '#5ff0ff';
        sphere(cnt(110 * sz), (dx, dy) => {
          const a = (Math.atan2(dy, dx) - off + TAU * 2) % TAU;
          star(x, y, dx * R * k, dy * R * k, c1, 2.6, { drag: k, size: 2.3, color2: c2, changeT: 0.45 + (a / TAU) * 1.4, glitter: 0.1 });
        });
      },
    },
    fish: {
      label: 'Fish', icon: '🐟',
      fn(x, y, sz, c1) {
        // A small break whose stars become wriggling go-getters.
        const swim = (p) => { for (let i = 0; i < 2; i++) star(p.x, p.y, p.vx * 0.4 + rand(-40, 40) * U, p.vy * 0.4 + rand(-40, 40) * U, '#fff1c8', rand(1.3, 1.9), { drag: 0.9, grav: 0.25, size: 1.6, wig: 2600, tail: 0.6, glitter: 0.3, L: p.L }); };
        const R = R0() * sz * 0.8, k = 1.5;
        sphere(cnt(36 * sz), (dx, dy) => star(x, y, dx * R * k, dy * R * k, c1, rand(0.55, 0.7), { drag: k, size: 2.4, onDeath: swim }));
      },
    },
    timerain: {
      label: 'Time rain', icon: '🌧️',
      fn(x, y, sz) {
        const R = R0() * sz * 0.9, k = 1.4;
        const tick = (p) => { if (Math.random() < 0.4) { crackleBurst(p.x, p.y); Sound.crackle(pan(p.x)); } };
        sphere(cnt(70 * sz), (dx, dy) => star(x, y, dx * R * k, dy * R * k, '#ffd27a', rand(2.6, 3.4), { drag: k, grav: 0.35, size: 1.4, wig: 900, glitter: 0.9, gcol: '#ffe7b0', tail: 0.5, onDeath: tick }));
      },
    },
    senrin: {
      label: 'Senrin', icon: '✨',
      fn(x, y, sz) {
        // "A thousand flowers": the shell scatters little pellets that pop, one after another, into tiny chrysanthemums.
        const col = Math.random() < 0.6 ? '#fff4e0' : '#ffd27a';
        const bloom = (p) => {
          sphere(cnt(14), (dx, dy) => star(p.x, p.y, dx * 70 * U, dy * 70 * U, col, rand(0.7, 0.95), { drag: 2.4, size: 1.6, glitter: 0.6, gcol: '#ffe7b0', L: p.L }));
          flash(p.x, p.y, col, 0.3); Sound.pop(pan(p.x));
        };
        const R = R0() * sz, k = 1.5;
        sphere(Math.max(10, Math.round(28 * sz * Q().count)), (dx, dy) => star(x, y, dx * R * k * rand(0.5, 1), dy * R * k * rand(0.5, 1), '#ffcf85', rand(0.45, 1.25), { drag: k, size: 1.2, onDeath: bloom }));
      },
    },
    shellofshells: {
      label: 'Shell of shells', icon: '💐',
      fn(x, y, sz, c1, c2) {
        const kind = Math.random() < 0.35 ? 'spider' : 'peony';
        const sub = (p) => {
          if (kind === 'spider') for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; star(p.x, p.y, Math.cos(a) * 160 * U, Math.sin(a) * 160 * U, '#ffd27a', 0.9, { drag: 1.6, grav: 0.3, size: 1.5, tail: 0.6, L: p.L }); }
          else sphere(cnt(22), (dx, dy) => star(p.x, p.y, dx * 110 * U, dy * 110 * U, p.color, rand(0.9, 1.15), { drag: 2, size: 2, L: p.L }));
          flash(p.x, p.y, p.color, 0.45); Sound.pop(pan(p.x));
        };
        const R = R0() * sz * 0.75, k = 1.5, n = Math.max(8, Math.round(13 * Math.sqrt(sz) * Q().count));
        sphere(n, (dx, dy) => star(x, y, dx * R * k, dy * R * k, Math.random() < 0.5 ? c1 : c2, rand(0.55, 0.75), { drag: k, size: 1.4, onDeath: sub }));
      },
    },
    multibreak: {
      label: 'Multi-break', icon: '🎆',
      fn(x, y, sz, c1, c2) {
        // A huge flash, then breaks climbing one after another, then a curtain of silver rain (Del Vicario 16").
        addLight('#ffffff', 1.4);
        const breaks = Math.max(3, Math.round(4 + 2 * sz));
        for (let i = 0; i < breaks; i++) {
          after(0.35 + i * 0.32, () => {
            const bx = x + rand(-0.5, 0.5) * R0() * sz, by = y - i * R0() * 0.18 + rand(-20, 20) * U, col = i % 2 ? c1 : c2;
            flash(bx, by, col, 0.6); Sound.pop(pan(bx));
            layers(bx, by, sz * 0.45, [{ n: 40, col, life: 1.2, drag: 1.7, size: 2.2, glitter: 0.2 }]);
          });
        }
        after(0.35 + breaks * 0.32, () => {
          layers(x, y - breaks * R0() * 0.09, sz, [{ n: 120, col: '#e8ecff', life: 3.6, drag: 1.4, grav: 1, size: 1.6, glitter: 1.2, gcol: '#ffffff', tail: 0.6, fade: 0.55 }]);
          addLight('#e8ecff', sz);
        });
      },
    },
    spider: {
      label: 'Spider', icon: '🕷️',
      fn(x, y, sz) {
        const R = R0() * sz * 1.2, n = Math.max(24, Math.round(46 * Q().count * Math.sqrt(sz))), col = Math.random() < 0.5 ? '#fff2d0' : '#ffd27a', off = Math.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU + rand(-0.04, 0.04), v = R * 1.1 * rand(0.92, 1.05);
          star(x, y, Math.cos(a) * v, Math.sin(a) * v, col, rand(1.6, 1.9), { drag: 1, grav: 0.22, size: 1.6, tail: 0.9, fade: 0.4 });
        }
      },
    },
    rondelle: {
      label: 'Rondelle', icon: '💥',
      fn(x, y, sz) {
        // A flat ring of salute pellets that bang one after another round the ring (single or spiral).
        const n = Math.max(8, Math.round(12 * Math.sqrt(sz))), R = R0() * sz * 0.85, sq = rand(0.25, 0.5), tilt = rand(-0.3, 0.3), spiral = Math.random() < 0.4;
        const bang = (p) => { flash(p.x, p.y, '#ffffff', 0.5); crackleBurst(p.x, p.y); crackleBurst(p.x, p.y); Sound.pop(pan(p.x)); if (Math.random() < 0.3) Sound.bang(pan(p.x)); };
        const pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = spiral ? R * (0.45 + 0.55 * i / n) : R; pts.push([Math.cos(a) * r, Math.sin(a) * r * sq]); }
        rotate(pts, tilt).forEach((p, i) => star(x, y, p[0] * 1.8, p[1] * 1.8, '#fff4e0', 0.45 + (i / n) * 1.3, { drag: 1.8, grav: 0.2, size: 1.6, flicker: false, onDeath: bang }));
      },
    },
    barrel: {
      label: 'Barrel', icon: '🛢️',
      fn(x, y, sz, c1, c2) {
        // Stars laid on a cylinder, seen tilted.
        const R = R0() * sz * 0.8, rows = 5, per = cnt(18 * Math.sqrt(sz)), tilt = rand(-0.6, 0.6), pts = [];
        for (let r = 0; r < rows; r++) { const h = (r / (rows - 1)) * 2 - 1; for (let i = 0; i < per; i++) { const a = (i / per) * TAU; pts.push([Math.cos(a) * R, h * R * 0.75 + Math.sin(a) * R * 0.22]); } }
        shape(x, y, rotate(pts, tilt), (p) => (p[1] < 0 ? c1 : c2), { drag: 1.6, life: 1.9, size: 2.3 });
      },
    },
    sunflower: {
      label: 'Sunflower', icon: '🌻',
      fn(x, y, sz, c1) {
        // Ring stars whose trails curl the same way, so the break seems to spin like a wheel.
        const R = R0() * sz * 0.85, k = 1.4, n = cnt(48 * Math.sqrt(sz)), dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; star(x, y, Math.cos(a) * R * k, Math.sin(a) * R * k, '#ffcf6b', 2, { drag: k, grav: 0.4, size: 2, tail: 0.8, swirl: dir * 1.6, glitter: 0.5 }); }
        sphere(cnt(26), (dx, dy) => star(x, y, dx * R * 0.35 * k, dy * R * 0.35 * k, c1, 1.4, { drag: k, size: 2.4 }));
      },
    },
    bouquet: {
      label: 'Bouquet', icon: '💮',
      fn(x, y, sz, c1, c2) {
        // Three effects in one break: a strobing pistil, a crossette petal and a brocade ring.
        layers(x, y, sz, [{ r: 0.35, n: 30, col: '#f4f6ff', life: 1.8, strobe: 10, grav: 0.5 }]);
        TYPES.crossette.fn(x, y, sz * 0.8, c1);
        layers(x, y, sz, [{ r: 1.05, n: 60, col: '#ffcf6b', life: 2.2, glitter: 1, gcol: '#ffd98a', ring: { squash: rand(0.35, 0.7) } }]);
      },
    },
    twotone: {
      label: 'Two-tone', icon: '🔮',
      fn(x, y, sz) {
        const R = R0() * sz, k = 1.5, head = palette === PALETTES.classic ? '#8a7bff' : color();
        sphere(cnt(95 * sz), (dx, dy) => star(x, y, dx * R * k, dy * R * k, head, rand(1.8, 2.2), { drag: k, size: 2.4, glitter: 1.2, gcol: '#ffcf6b', fade: 0.45 }));
      },
    },
    doublering: {
      label: 'Double ring', icon: '🪐',
      fn(x, y, sz, c1, c2) {
        if (c2 === c1) c2 = '#5ff0ff';
        const tilt = rand(0, TAU), sq = rand(0.28, 0.45);
        if (Math.random() < 0.3) layers(x, y, sz, [0.5, 0.8, 1.1].map((r, i) => ({ r, n: 46, col: i % 2 ? c2 : c1, life: 1.7, size: 2.3, ring: { squash: sq, tilt } })));
        else layers(x, y, sz, [{ n: 60, col: c1, life: 1.8, size: 2.4, ring: { squash: sq, tilt } }, { n: 60, col: c2, life: 1.8, size: 2.4, ring: { squash: sq, tilt: tilt + Math.PI / 2 } }]);
      },
    },
    whistle: {
      label: 'Whistler', icon: '🎶', whistle: true,
      fn(x, y, sz, c1, c2) {
        const sub = (p) => { sphere(cnt(20), (dx, dy) => star(p.x, p.y, dx * 95 * U, dy * 95 * U, p.color, rand(0.9, 1.2), { drag: 2, size: 2, L: p.L })); flash(p.x, p.y, p.color, 0.4); Sound.pop(pan(p.x)); };
        const R = R0() * sz * 0.7, k = 1.5, n = Math.max(6, Math.round(8 * Math.sqrt(sz) * Q().count));
        sphere(n, (dx, dy) => star(x, y, dx * R * k, dy * R * k, Math.random() < 0.5 ? c1 : c2, rand(0.5, 0.8), { drag: k, size: 1.6, onDeath: sub }));
      },
    },
    // ---- Picture shells (research/fireworks-videos/PROMPT-flags.md): stars fly to a flag's or an animal's points,
    // hold the picture for a moment, then droop and fade. Real fireworks can't draw these; drones do in real shows.
    flagindia: {
      label: 'India flag', icon: '🇮🇳',
      fn(x, y, sz) {
        const pts = flagIndiaPts(sz);
        let k = 0;
        shape(x, y, pts.map((p) => [p[0], p[1]]), () => pts[k++][2], { drag: 2.4, life: 3.4, hold: 1.8, grav: 0.55, size: 2.3 });
        addLight('#ff9933', 0.8); addLight('#2fd25a', 0.6);
      },
    },
    tiger: {
      label: 'Tiger', icon: '🐯',
      fn(x, y, sz) {
        tigerCinema(x, y, sz, null);
        addLight('#ff8a2b', 0.9);
      },
    },
    india: {
      label: 'India', icon: '🐅',
      fn(x, y, sz) { countryShow(x, y, sz, flagIndiaPts(sz), 'tiger'); }, // the tricolour, then the Bengal tiger
    },
    bangladesh: { label: 'Bangladesh', icon: '🐅', fn(x, y, sz) { countryShow(x, y, sz, flagPts('bangladesh', sz), 'tiger'); } }, // the Bengal tiger
    usa: { label: 'USA', icon: '🦅', fn(x, y, sz) { countryShow(x, y, sz, flagPts('usa', sz), 'eagle'); } }, // the bald eagle
    uk: { label: 'UK', icon: '🦁', fn(x, y, sz) { countryShow(x, y, sz, flagPts('uk', sz), 'lion'); } }, // the lion
    china: { label: 'China', icon: '🐼', fn(x, y, sz) { countryShow(x, y, sz, flagPts('china', sz), 'panda'); } }, // the giant panda
    brazil: { label: 'Brazil', icon: '🐆', fn(x, y, sz) { countryShow(x, y, sz, flagPts('brazil', sz), 'jaguar'); } }, // the jaguar
    grandshow: {
      label: 'Grand show', icon: '🎇',
      fn(x, y, sz, c1, c2) {
        // The opening shell breaks where it was sent; the show director takes it from there.
        TYPES.peony.fn(x, y, sz * 0.8, c1, c2);
        if (gameTime >= directorUntil) directShow({ len: 15 }); // fits a 30 s shared video; taps mid-show add a shell, not a show
      },
    },
    salute: {
      label: 'Salute', icon: '💥',
      fn(x, y, sz) {
        // A white flash, a bang and a shockwave ring: no colour, all light and sound.
        flash(x, y, '#ffffff', 1.6 * sz); addLight('#ffffff', 2.2 * sz);
        const n = cnt(36);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU, v = 420 * U * sz; star(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.9, '#ffffff', 0.32, { drag: 3.2, grav: 0, size: 1.6, flicker: false }); }
        for (let i = 0; i < 6; i++) crackleBurst(x + rand(-30, 30) * U, y + rand(-20, 20) * U);
        Sound.bang(pan(x)); Sound.thump(pan(x));
        shake = Math.max(shake, 0.35 * sz); buzz(50);
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
  // Gems per launch (see Gems below): the bigger ground crackers and the rarer sky shells; the rest are free.
  const GEM_COST = {
    rocket: 2, roman: 2, fountain: 2, wheel: 2, heli: 2, lantern: 2, strobe: 2,
    bomb: 5, laddi: 5, mine: 5, shell: 5, basket: 5, multishot: 5,
    cake: 10, rocketcombo: 10, finale: 25, sutli: 5, twosound: 3,
    // The Sivakasi crackers: gems since the Hazaar ladi became the Premium one (Build 31).
    fancake: 10, minerow: 10, chrysline: 10, cometchain: 5, cometburst: 5, silvertower: 5, starwheel: 5, kingsalute: 5, // the real-show pieces
    singleshot: 1, chakri: 1, firecracker: 1, popper: 1, smoke: 1, snake: 1, // 1 gem: note shower, rang pencil, flower pot, anar, bijili, kuruvi and the sparkler stay free
    anilvedi: 2, // the Sivakasi Premium five (PREMIUM_ITEMS) have no gem price: they are Premium's, with one free try each
  };
  // The Sky list mirrors the Ground one: three Premium shells (a crown, one free try each, like PREMIUM_ITEMS) and four
  // that cost gems, seen right after Random and Peony; the classics after them stay free, so the sky is still where
  // everyone starts. A Premium shell has no gem price (the crown and the gem badge share a corner).
  // The real-show kings (research/fireworks-videos) join them: King willow, Multi-break, Shell of shells and Ghost.
  const PREMIUM_SHELLS = new Set(['grandshow', 'peacock', 'butterfly', 'wand', 'kingwillow', 'multibreak', 'shellofshells', 'ghost']);
  const SHELL_GEM_COST = { heart: 3, kamuro: 3, star: 2, smile: 2, dahlia: 2, brocade: 3, senrin: 3, spider: 2, rondelle: 3,
    pistil: 2, doublepetal: 2, colorchange: 3, fish: 2, timerain: 3, barrel: 2, sunflower: 3, bouquet: 3, twotone: 2, doublering: 2, whistle: 2, flagindia: 2, tiger: 2, india: 3, bangladesh: 3, usa: 3, uk: 3, china: 3, brazil: 3,
    willow: 1, palm: 1, crossette: 1, crackle: 1, horsetail: 1, kaleido: 1 }; // 1 gem: Random, Peony, Chrysanthemum, Ring and Strobe stay free
  // Random and Peony, then the Premium shells, then every gem shell (the real-show ones among them), then the free classics.
  const DOCK_ORDER = ['random', 'peony', 'grandshow', 'peacock', 'butterfly', 'wand', 'kingwillow', 'multibreak', 'shellofshells', 'ghost', 'heart', 'kamuro', 'star', 'smile',
    'dahlia', 'brocade', 'senrin', 'spider', 'rondelle', 'pistil', 'doublepetal', 'colorchange', 'fish', 'timerain', 'barrel', 'sunflower', 'bouquet', 'twotone', 'doublering', 'whistle', 'flagindia', 'tiger', 'india', 'bangladesh', 'usa', 'uk', 'china', 'brazil',
    'willow', 'palm', 'crossette', 'crackle', 'horsetail', 'kaleido', 'chrysanthemum', 'ring', 'strobe'];
  const WEIGHTS = { peony: 3, chrysanthemum: 3, willow: 2, palm: 2, ring: 2, crossette: 2, crackle: 2, strobe: 1.4, horsetail: 1.4, kamuro: 1.6, kaleido: 2, heart: 0.6, star: 0.6, butterfly: 0.5, peacock: 0.8, wand: 0.5, smile: 0.3,
    dahlia: 1, pistil: 1.2, doublepetal: 1.2, brocade: 1, kingwillow: 0.5, colorchange: 1, ghost: 0.5, fish: 0.8, timerain: 0.8, senrin: 0.9,
    shellofshells: 0.5, multibreak: 0.4, spider: 0.8, rondelle: 0.6, barrel: 0.6, sunflower: 0.8, bouquet: 0.8, twotone: 1, doublering: 0.9, whistle: 0.7 };
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
  // A shell fired from the Sky list: Random never hands a free player a Premium shell. (Shows the game fires itself, a
  // Love card's or a ground rocket's, still draw from every shell through resolveType.)
  function playerType(t) {
    if (t && t !== 'random' && TYPES[t]) return t;
    for (let i = 0; i < 40; i++) { const r = randomType(mode === 'card'); if (premium.active || !PREMIUM_SHELLS.has(r)) return r; }
    return 'peony';
  }
  // A sky shell's key in the free-try ledger and the launch controller ("shell:peacock"), apart from a ground cracker's
  // bare id ('strobe' is both a shell and a ground cracker).
  const shellKey = (id) => `shell:${id}`;
  const shellLabel = (id) => (id === 'random' ? 'Random' : TYPES[id].label.replace('Chrysanth.', 'Chrysanthemum'));

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
  // The status bar's height: the app feeds --safe-t after the page loads (and again on rotation), so it is read each time.
  const safeTop = () => parseFloat(document.documentElement.style.getPropertyValue('--safe-t')) || 0;
  const pan = (x) => (x / W) * 2 - 1;

  const shellTally = {}; // shells sent up, by type (for the tests)
  function launchShell(o = {}) {
    // In play, shells come from taps, a ground show's crackers, or crackers the sparkler lit (no show of their own).
    if (mode === 'play' && !rush.on && !o.tap && !(runningGroundEffect === 'swept' || (runningGroundEffect && launch.sequence && launch.sequence.ground))) return;
    if (launch.state !== 'READY' && (mode !== 'play' || rush.on)) return;
    const sz = o.size ?? sizeScale();
    const tx = clamp(o.x ?? rand(W * 0.12, W * 0.88), 16, W - 16);
    let ty = clamp(o.y ?? rand(H * 0.1, H * 0.42), H * 0.05, H * 0.78);
    if (world.rect && world.cfg.sacred && !o.exact && o.type !== 'text' && o.type !== 'photo') ty = worldSkyY(tx, ty);
    // The whole burst stays on screen: its top ring below the status bar (a recorded video showed the top cut off).
    if (!o.exact) ty = Math.max(ty, Math.min(H * 0.45, safeTop() + R0() * sz * 0.95));
    const sx = o.sx ?? (o.straight ? tx : clamp(tx + rand(-50, 50) * U, 0, W));
    // 3D view: the show's own shells burst at different distances; your taps, words and photos burst right here.
    const z = o.z ?? (!view.on() || o.user || o.straight || o.type === 'text' || o.type === 'photo' ? 1 : rand(0.72, 1.06));
    const sy = o.sy ?? H + 8;
    // A shell must rise to burst: from a mouth at or above its burst height (a tall tube, a cracker on a high street) the
    // lift would be the root of a negative, NaN, and a NaN shell never bursts, trailing sparks for ever and holding the
    // show open. So it always climbs at least a little, and one with no position at all is not fired.
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) return;
    if (sy - ty < 60 * U) ty = sy - 60 * U;
    const g = 900 * U * (o.fast || 1);
    const vy = -Math.sqrt(2 * g * (sy - ty));
    const t = -vy / g;
    shells.push({
      x: sx, y: sy, px: sx, py: sy, vx: (tx - sx) / t, vy, g, age: 0,
      type: o.type, size: sz * z, z, c1: o.c1, c2: o.c2, text: o.text, textH: o.textH, hold: o.hold, user: !!o.user,
      img: o.img, r: o.r, L: o.L || 0, aim: o.aim, tint: !!o.tint,
      // How it rises: 'gold' sparks (default), a fat white 'comet' head with a brocade trail, or a 'crackle' tail.
      lift: o.lift || (TYPES[o.type] && TYPES[o.type].lift) || 'gold',
      // A dark beat at the top before the break (not in Rocket Rush, whose rockets are aimed at targets).
      apex: rush.on || o.type === 'text' || o.type === 'photo' || o.fast ? 0 : rand(0.12, 0.26),
      // In a 3D world a shell is pinned far out along its path, so it keeps its place in the sky as you look around.
      an: o.an !== undefined ? o.an : w3dShown() ? anchorAt(tx, ty, 150) : null,
    });
    shellTally[o.type || 'random'] = (shellTally[o.type || 'random'] || 0) + 1;
    Sound.lift(pan(sx), t, o.whistle || !!(TYPES[o.type] && TYPES[o.type].whistle));
  }

  function burstShell(s) {
    const [c1, c2raw] = [s.c1 || color(), s.c2 || color()];
    let c2 = c2raw;
    if (c2 === c1 && palette.length > 1) c2 = palette[(palette.indexOf(c1) + 1) % palette.length];
    const special = s.type === 'text' || s.type === 'photo';
    const z = s.z || 1;
    const was = curAnchor;
    curAnchor = s.an || null;
    flash(s.x, s.y, c1, special ? 1.4 : s.size);
    curDim = Math.min(1, 0.45 + 0.55 * z);
    if (!special) curHang = 1 + 0.3 * clamp(s.size - 1, 0, 1.5);
    if (s.type === 'text') textBurst(s.x, s.y, s);
    else if (s.type === 'photo') photoBurst(s.x, s.y, s);
    else TYPES[resolveType(s.type)].fn(s.x, s.y, s.size, c1, c2, s);
    curDim = 1; curHang = 1;
    if (!special) breakSmoke(s.x, s.y, s.size * z);
    addLight(c1, (special ? 1.5 : s.size) * z, s.x, s.y);
    // Heard a moment after it is seen: farther in 3D, higher on the flat sky (0.1 s low down, 0.4 s at the top).
    Sound.burst(special ? 1.3 : s.size, pan(s.x), w3dShown() ? Math.max(0, (1 - z) * 0.6) : 0.15 + 0.4 * clamp(1 - s.y / (H * 0.6), 0, 1) + 0.1 * clamp(s.size - 1, 0, 1));
    if (w3dShown()) w3d.startle(s.an ? { x: s.an.wx, y: s.an.wy, z: s.an.wz } : null, s.size, 'sky'); // a fist shaken at it from the forecourt
    curAnchor = was;
    onBurst(s);
  }

  // Burst light is a short-lived entity drawn fresh each frame (sky: #glow, ground: #items), never painted into the
  // fading trail canvases, where it left a grey disc. Kind 0: white pop then a colour bloom; kind 1: the shell's glow.
  // Not particles: outside the budget and the FADING check (they last 1.6s at most).
  const fxLights = [];
  function flash(x, y, c, sz, cx = ctx) {
    const L = cx === ctx ? 0 : 1, s = SPR.id(c);
    fxLights.push({ x, y, vx: 0, vy: 0, s, L, an: curAnchor, dim: curDim, age: 0, life: 0.42, R: 120 * U * sz * curScale, kind: 0 });
    if (sz >= 0.8) fxLights.push({ x, y, vx: 0, vy: 18 * U * curScale, s, L, an: curAnchor, dim: curDim, age: 0, life: 1.6, R: 1.25 * R0() * sz * curScale, kind: 1 });
  }
  function drawLights() {
    if (!fxLights.length) return;
    const white = SPR.id('#ffffff');
    glx.globalCompositeOperation = ictx.globalCompositeOperation = 'lighter';
    for (const l of fxLights) {
      const t = l.age / l.life, g = l.L ? ictx : glx;
      if (!l.L) glowUsed = true;
      if (l.kind) { g.globalAlpha = 0.16 * Math.min(1, l.age / 0.25) * (1 - t) * l.dim; SPR.draw(g, l.s, SPR.SOFT, l.x, l.y, l.R); continue; }
      if (l.age < 0.06) { g.globalAlpha = 0.8 * (1 - l.age / 0.06) * l.dim; SPR.draw(g, white, SPR.SOFT, l.x, l.y, l.R * (0.3 + l.age * 3)); }
      g.globalAlpha = 0.4 * (1 - t) ** 2 * l.dim; SPR.draw(g, l.s, SPR.SOFT, l.x, l.y, l.R * (1 + 0.6 * t));
    }
    // On a water world each burst's light shimmers in the water below the landmark, squashed and dimmer.
    const wy = world.waterY;
    if (wy && !w3dShown() && Q().bloom) {
      glx.save(); glx.beginPath(); glx.rect(0, wy, W, H - wy); glx.clip();
      glx.translate(0, wy * 1.55); glx.scale(1, -0.55);
      for (const l of fxLights) {
        if (l.L || !l.kind || l.y > wy) continue;
        const t = l.age / l.life;
        glx.globalAlpha = 0.22 * Math.min(1, l.age / 0.25) * (1 - t) * l.dim * (0.8 + 0.2 * Math.random());
        SPR.draw(glx, l.s, SPR.SOFT, l.x, l.y, l.R * 0.8);
        glowUsed = true;
      }
      glx.restore();
    }
    glx.globalAlpha = ictx.globalAlpha = 1;
    glx.globalCompositeOperation = ictx.globalCompositeOperation = 'source-over';
  }

  // ---------- Sky light ----------
  // The glow sits over the light's source: gWX/gWY are #fx coordinates weighted by intensity, gX/gY the screen point
  // (through the launch camera), quantised to 1% so the style write stays throttled. gPop: the burst's quick flare.
  let gR = 255, gG = 200, gB = 150, gI = 0, lastGlowA = -1, gWX = -1, gWY = 0, gX = 0, gY = 0, gPop = 0, lastGlowAt = '';
  function addLight(c, sz, x, y) {
    const [r, g, b] = rgb(c), i = 0.9 * sz, tot = gI + i;
    gR = (gR * gI + r * i) / tot; gG = (gG * gI + g * i) / tot; gB = (gB * gI + b * i) / tot;
    if (x === undefined) { x = W / 2; y = H * 0.3; } else gPop = Math.min(1, gPop + i * 0.6);
    if (gWX < 0 || gI < 0.02) { gWX = x; gWY = y; } else { gWX = (gWX * gI + x * i) / tot; gWY = (gWY * gI + y * i) / tot; }
    gI = Math.min(3.2, tot);
    if (w3dShown()) w3d.light(c, sz * 0.6, curAnchor && { x: curAnchor.wx, y: curAnchor.wy + 1.5, z: curAnchor.wz });
  }
  let fxMS = '', fxM = null; // parsed #fx matrix, cached by its transform string (no per-frame garbage)
  function fxToScreen(x, y) {
    const t = launch.sequence ? fxC.style.transform : '';
    if (t !== fxMS) { fxMS = t; fxM = t ? new DOMMatrix(t) : null; }
    const m = fxM;
    if (!m) return [x, y];
    const dx = x - W / 2, dy = y - H / 2; // transform-origin is the centre
    return [W / 2 + m.a * dx + m.c * dy + m.e, H / 2 + m.b * dx + m.d * dy + m.f];
  }
  function renderGlow(dt) {
    gI *= Math.exp(-2.4 * dt); gPop *= Math.exp(-14 * dt);
    const a = Math.min(0.5, gI * 0.17 + gPop * 0.3) * SKY_LIGHT[settings.skyLight];
    let at = lastGlowAt;
    if (a >= 0.005 && gWX >= 0) {
      const [sx, sy] = fxToScreen(gWX, gWY);
      gX = clamp(Math.round((sx / W) * 100), -20, 120); gY = clamp(Math.round((sy / H) * 100), -20, 120);
      at = `${gX}% ${gY}%`;
    }
    if (Math.abs(a - lastGlowA) < 0.004 && at === lastGlowAt) return;
    lastGlowA = a; lastGlowAt = at;
    const r = gR | 0, g = gG | 0, b = gB | 0;
    skyGlow.style.background = a < 0.005 ? 'none'
      : `radial-gradient(130% 90% at ${at || '50% 30%'}, rgba(${r},${g},${b},${a}), rgba(${r},${g},${b},${a * 0.3}) 70%, rgba(${r},${g},${b},${a * 0.15}))`;
    // Unlit, it is taken out altogether: a full-screen blended layer, even empty, holds graphics memory a low-memory
    // phone needs for the sky (it dropped tiles and flashed black blocks).
    skyGlow.style.display = a < 0.005 ? 'none' : '';
  }
  const glowAlpha = () => Math.max(0, lastGlowA);
  // The same glow for photos and videos (sx, sy: output px per CSS px). The one gradient a frame may make.
  function drawGlow(g, sx, sy) {
    const a = glowAlpha() * 0.6;
    if (a <= 0) return;
    const r = gR | 0, gg = gG | 0, b = gB | 0, cx = (lastGlowAt ? gX : 50) / 100 * W, cy = (lastGlowAt ? gY : 30) / 100 * H;
    const rad = Math.hypot(Math.max(cx, W - cx) * 1.3, Math.max(cy, H - cy) * 0.9);
    const gr = g.createRadialGradient(cx * sx, cy * sy, 0, cx * sx, cy * sy, rad * Math.max(sx, sy));
    gr.addColorStop(0, `rgba(${r},${gg},${b},${a})`); gr.addColorStop(0.7, `rgba(${r},${gg},${b},${a * 0.3})`); gr.addColorStop(1, `rgba(${r},${gg},${b},${a * 0.15})`);
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W * sx, H * sy); g.restore();
  }

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
          voice.pri = this.pri; voice.t0 = c.currentTime; // for voice stealing (ready)
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
    // Up to CAP sources play at once. At the cap a louder sound (pri 2: thumps and hisses; 3: bangs, bursts and strings
    // of snaps) stops the oldest quieter ones (pri 1: snaps, pops, crackles) to make room, so a big moment is never the
    // sound that goes missing. pri is read by the source wrapper in init() for the sources made right after.
    CAP: 24, pri: 1, rapids: new Set(),
    ready(pri = 1) {
      if (!(this.ctx && settings.sound && this.ctx.state === 'running' && !paused && !document.hidden)) return false;
      this.pri = pri;
      if (this.voices.size + 3 <= this.CAP) return true;
      if (pri > 1) {
        const old = [...this.voices].filter((v) => (v.pri || 1) < pri).sort((a, b) => (a.pri || 1) - (b.pri || 1) || a.t0 - b.t0).slice(0, 4);
        for (const v of old) { try { v.stop(); } catch (e) { /* not started yet */ } this.voices.delete(v); }
      }
      return this.voices.size < this.CAP;
    },
    // A sound's pitch (rate) and loudness (gain): as asked, or a little different every time, so repeats don't sound alike.
    vary(o) { return [o && o.rate != null ? o.rate : rand(0.88, 1.12), o && o.gain != null ? o.gain : rand(0.8, 1.2)]; },
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
    burst(size, p, delay = 0, opt) {
      if (!this.ready(3)) return;
      const c = this.ctx, t = c.currentTime + 0.01 + delay;
      if (t - this.lastBurst < 0.06) return;
      this.lastBurst = t;
      const [r, k] = this.vary(opt);
      const out = this.dest(p), vol = clamp((0.3 + size * 0.45) * k, 0.25, 1.2), end = t + 1.3 + size * 0.5;
      const n = this.noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime((1600 + size * 700) * r, t);
      lp.frequency.exponentialRampToValueAtTime(160 * r, t + 1.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, end);
      n.connect(lp); lp.connect(g); g.connect(out);
      n.start(t, Math.random() * 1.5); n.stop(end + 0.05); // ends with its fade, freeing the voice
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(100 * r, t);
      o.frequency.exponentialRampToValueAtTime(36 * r, t + 0.4);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(og); og.connect(out);
      o.start(t); o.stop(t + 0.7);
    },
    lift(p, dur, whistle) {
      if (!this.ready(2)) return;
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
      // One noise source through one gain flicked open 12 times over about 0.4 s (12 sources once filled the voice cap).
      const s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t0);
      let t = t0 + 0.02;
      for (let i = 0; i < 12; i++) {
        const gap = rand(0.012, 0.06);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(rand(0.12, 0.35), t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(rand(0.02, 0.05), gap - 0.002));
        t += gap;
      }
      s.connect(hp); hp.connect(g); g.connect(this.dest(p));
      s.start(t0, Math.random() * 1.4); s.stop(t + 0.02);
    },
    // Continuous hiss for fountains, spinners and smoke; optional wobble (spinner) and whistle.
    hiss(dur, freq, vol, p, o = {}) {
      if (!this.ready(2)) return;
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
    thump(p, opt) {
      if (!this.ready(2)) return;
      const c = this.ctx, t = c.currentTime, out = this.dest(p), [r, k] = this.vary(opt);
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(170 * r, t);
      o.frequency.exponentialRampToValueAtTime(55 * r, t + 0.15);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.55 * k, t + 0.006);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.3);
      const n = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; lp.type = 'lowpass'; lp.frequency.value = 900 * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.004);
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
    // opt.rate below 1 makes the bang and its echoing rumble lower and longer (the Sutli bomb).
    bang(p, opt) {
      if (!this.ready(3)) return;
      const [r, k] = this.vary(opt);
      this.lastBurst = 0;
      this.burst(2.4, p, 0, { rate: r, gain: k });
      this.pri = 3;
      const c = this.ctx, t = c.currentTime + 0.28, len = 1.4 / Math.min(1, r);
      const n = this.noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 420 * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3 * k, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      n.connect(lp); lp.connect(g); g.connect(this.dest(-p)); n.start(t, Math.random()); n.stop(t + len + 0.1);
    },
    sparklerStart() {
      if (this.spk || !this.ready(2)) return;
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
      n.pri = lfo.pri = 9; // the held sparkler is never stolen
    },
    sparklerStop() {
      if (!this.spk || !this.ctx) return;
      const { n, g, lfo } = this.spk, t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.05);
      n.stop(t + 0.3); lfo.stop(t + 0.3);
      this.spk = null;
    },
    pop(p, opt) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      if (t - this.lastPop < 0.1) return;
      this.lastPop = t;
      const [r, k] = this.vary(opt);
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise;
      bp.type = 'bandpass'; bp.frequency.value = 900 * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      s.connect(bp); bp.connect(g); g.connect(this.dest(p));
      s.start(t, Math.random() * 1.8, 0.16);
    },
    // A long string of snaps (a saravedi, a wala): ONE looping noise source through a band-pass and a gain that are both
    // moved for every snap, where a source per snap would need hundreds and fill the voice cap. The cracker calls
    // snap(delay, k) a little ahead of each pop it draws, so sound and picture stay together when frames drop; an
    // optional crackle bed (o.bed, its loudness) murmurs underneath. It stops by itself 1.5 s after its last snap (an
    // idle timer), or at once with stop() (or hush(), for every string).
    rapid(p, o = {}) {
      const none = { live: false, snap() {}, stop() {} };
      if (!this.ready(3)) return none;
      const c = this.ctx, t0 = c.currentTime, out = this.dest(p);
      const [lo, hi] = o.f || [1800, 3200], [ga, gb] = o.gain || [0.3, 0.7], gap = o.gap || 0.042; // gap: the closest two snaps may be
      const n = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 0.6; bp.frequency.value = lo;
      g.gain.setValueAtTime(0.0001, t0);
      n.connect(bp); bp.connect(g); g.connect(out); n.start(t0, Math.random());
      let bed = null;
      if (o.bed) {
        const b = this.noiseSrc(), hp = c.createBiquadFilter(), bg = c.createGain();
        hp.type = 'highpass'; hp.frequency.value = 2600;
        bg.gain.setValueAtTime(0.0001, t0); bg.gain.exponentialRampToValueAtTime(o.bed, t0 + 0.3);
        b.connect(hp); hp.connect(bg); bg.connect(out); b.start(t0, Math.random());
        bed = { b, bg };
      }
      let next = t0, live = true, idle = 0;
      // It stops 1.4 s of game time after its last snap. Game time stands still while paused, under a sheet or hidden, so a
      // string waits through those (its murmur ducked) and plays on after.
      const arm = (s) => {
        clearTimeout(idle);
        const from = gameTime;
        idle = setTimeout(function check() {
          if (!live) return;
          if (gameTime - from >= 1.4) { h.stop(); return; }
          if (bed) bed.bg.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
          idle = setTimeout(check, 500);
        }, 1500 + s * 1000);
      };
      const h = {
        get live() { return live; },
        snap: (delay = 0, k = 1) => {
          if (!live || !this.ctx) return;
          const now = c.currentTime, at = Math.max(now + 0.005, next, now + delay); // in order, never overlapping
          next = at + gap;
          bp.frequency.setValueAtTime(rand(lo, hi), at);
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(Math.max(0.002, rand(ga, gb) * k), at + 0.002);
          g.gain.exponentialRampToValueAtTime(0.001, at + gap - 0.002);
          if (bed) bed.bg.gain.setTargetAtTime(o.bed, at, 0.05);
          arm(at - now);
        },
        stop: () => {
          if (!live) return;
          live = false; this.rapids.delete(h); clearTimeout(idle);
          const now = c.currentTime, gp = g.gain;
          // Hold where the gain is now (cancelling alone would jump back to a snap's peak: a click), then fade.
          if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(now); else { const v = gp.value; gp.cancelScheduledValues(now); gp.setValueAtTime(Math.max(0.0001, v), now); }
          gp.setTargetAtTime(0.0001, now, 0.02);
          try { n.stop(now + 0.1); } catch (e) { /* already ended */ }
          if (bed) { bed.bg.gain.cancelScheduledValues(now); bed.bg.gain.setTargetAtTime(0.0001, now, 0.05); try { bed.b.stop(now + 0.2); } catch (e) { /* ended */ } }
        },
      };
      this.rapids.add(h); arm(0);
      return h;
    },
    hush() { for (const h of [...this.rapids]) h.stop(); },
    // The 3D forecourt's dog and old man (world3d-folk.js), kept quiet under the show: a bark (a yip when happy), a
    // grumble, a little applause.
    bark(p, yip) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime, out = this.dest(p), f = yip ? rand(820, 960) : rand(400, 520), len = yip ? 0.09 : 0.15;
      const o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.75, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + len);
      bp.type = 'bandpass'; bp.frequency.value = yip ? 1600 : 950; bp.Q.value = 1.3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(yip ? 0.07 : 0.12, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
      const n = c.createBufferSource(), hp = c.createBiquadFilter(), ng = c.createGain(); // the breath in it
      n.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 1200;
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.001, t + len * 0.8);
      n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t, Math.random() * 1.8, len);
    },
    yip(p) { this.bark(p, true); },
    grumble(p) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime, out = this.dest(p), dur = rand(0.6, 0.85);
      const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(118, 138), t);
      o.frequency.linearRampToValueAtTime(rand(84, 98), t + dur);
      lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.value = 560;
      lfo.frequency.value = rand(5, 7.5); lg.gain.value = 280; // the mouth opening and shutting: a mumble
      lfo.connect(lg); lg.connect(lp.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.07);
      g.gain.setValueAtTime(0.06, t + dur - 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(out);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
    },
    clap(p) {
      if (!this.ready()) return;
      const c = this.ctx, out = this.dest(p);
      for (let i = 0; i < 7; i++) {
        const t = c.currentTime + 0.02 + i * 0.21 + rand(0, 0.03);
        const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = rand(1100, 1600); bp.Q.value = 0.9;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(rand(0.05, 0.08), t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        n.connect(bp); bp.connect(g); g.connect(out); n.start(t, Math.random() * 1.8, 0.06);
      }
    },
  };

  // Audio failures must not interrupt a visual sequence or hold its launch lock.
  for (const method of ['resume', 'lift', 'burst', 'crackle', 'hiss', 'thump', 'tick', 'snap', 'bang', 'sparklerStart', 'sparklerStop', 'pop', 'bark', 'yip', 'grumble', 'clap']) {
    const original = Sound[method];
    if (typeof original === 'function') Sound[method] = function (...args) {
      try { return original.apply(this, args); } catch (_) { return undefined; }
    };
  }

  // ---------- Game state ----------
  let mode = 'intro'; // intro | play | envelope | card | puzzle (Diya Path and Rocket Rush, see diya-path.js, rocket-rush.js)
  let paused = false, gameTime = 0;
  let combo = 0, lastUserBurst = -9;
  const timers = [];
  const after = (sec, fn, tag) => {
    const an = curAnchor; // a burst's later stages stay pinned where it burst
    timers.push({ t: gameTime + sec, fn: an ? () => { const was = curAnchor; curAnchor = an; try { fn(); } finally { curAnchor = was; } } : fn, tag });
  };
  const clearTimers = (tag) => { for (let i = timers.length - 1; i >= 0; i--) if (timers[i].tag === tag) timers.splice(i, 1); };

  const el = {
    combo: $('#combo'), toast: $('#toast'), hint: $('#hint'),
  };

  const COMBOS = [[20, 'Legendary!'], [12, 'Sky on fire!'], [8, 'Spectacular!'], [5, 'Brilliant!'], [3, 'Triple!'], [2, 'Double!']];
  let showBest = 0, showBestTimer = 0;
  function onBurst(s) {
    if (rush.on) { if (s.user && rush.kind !== 'duel') rushBurst(s); return; } // a Lantern Rush scores its own way (a Sky Duel scores its taps)
    if (mode !== 'play') return;
    if (s.user) {
      combo = gameTime - lastUserBurst < 1.3 ? combo + 1 : 1;
      lastUserBurst = gameTime;
      const hit = COMBOS.find(([n]) => combo === n);
      if (hit) showCombo(hit[1], `${combo}× combo`);
      if (combo >= 8) achieve('combo');
      if (combo >= 3) festCombo(combo);
      if (combo === 3 && w3dShown()) w3d.cheer(); // and a round of applause from the 3D forecourt
      if (combo >= 3 && combo > showBest) { // Sky Show leaderboard: the best combo, sent once the run settles
        showBest = combo; clearTimeout(showBestTimer);
        showBestTimer = setTimeout(() => postScores(`show:${showBest}`), 2500);
      }
    }
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

  // ---------- Update & render ----------
  let pointer = null, idleClear = 0;
  // On the home screen a single shell goes up now and then behind the title.

  function update(dt) {
    gameTime += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].t <= gameTime) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    }
    // The home screen's picture already shows fireworks; no hidden shells fire (or bang) behind it or its sheets.
    updateLaunch(dt);

    updateGround(dt);
    updateFit(dt);
    updateLighter(dt);
    if (mode === 'play' && playMode === 'spark' && launch.state === 'READY') updateSparkler(dt);
    updateRush(dt);

    const g = G();
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.age += dt; s.px = s.x; s.py = s.y;
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      curLayer = s.L; curAnchor = s.an || null;
      if (s.vy >= -25 * U) { // at the top: the lift goes dark for a moment, then it breaks
        s.vy = -25 * U; s.vx = 0; s.y = s.py; s.x = s.px; s.dark = true;
        if ((s.apex = (s.apex || 0) - dt) <= 0) { shells.splice(i, 1); curLayer = 0; curAnchor = null; burstShell(s); continue; }
      } else liftTrail(s);
      curLayer = 0; curAnchor = null;
      if (s.age > 8 || !Number.isFinite(s.y)) shells.splice(i, 1); // never in flight for ever, whatever launched it
    }

    const glit = Q().glitter;
    for (let i = stars.length - 1; i >= 0; i--) {
      const p = stars[i];
      p.age += dt;
      if (p.age >= p.life) {
        stars[i] = stars[stars.length - 1]; stars.pop();
        if (p.onDeath) { curAnchor = p.an || null; p.onDeath(p); curAnchor = null; } // before release: children reuse the pool
        release(starPool, p);
        continue;
      }
      if (p.fol) {
        const q = p.fol(p);
        if (q) { p.px = p.x; p.py = p.y; p.vx = (q[0] - p.x) / dt; p.vy = (q[1] - p.y) / dt; p.x = q[0]; p.y = q[1]; continue; }
        p.fol = null; p.vx *= 0.1; p.vy *= 0.1; p.hold = 0;
      }
      const e = Math.exp(-p.k * dt);
      p.vx *= e; p.vy *= e;
      if (p.age > p.hold) p.vy += g * p.grav * p.sc * dt;
      if (p.wig) { p.vx += (Math.random() - 0.5) * p.wig * dt; p.vy += (Math.random() - 0.5) * p.wig * dt; }
      if (p.sw) { const c = Math.cos(p.sw * dt), si = Math.sin(p.sw * dt), vx = p.vx; p.vx = vx * c - p.vy * si; p.vy = vx * si + p.vy * c; }
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floorY && p.y > p.floorY) { p.y = p.floorY; p.vy *= -0.3; p.vx *= 0.75; }
      if (p.glitter && Math.random() < p.glitter * glit * dt * 30) {
        curLayer = p.L; curAnchor = p.an || null;
        spark(p.x, p.y, p.vx * 0.15 + rand(-15, 15) * U, p.vy * 0.15 + rand(-5, 25) * U, toHex(p.gcol), rand(0.25, 0.6), GLIT);
        curLayer = 0; curAnchor = null;
      }
      if (p.tail && (p.ht += dt) >= p.tdt) { // newest history point first
        p.ht -= p.tdt; p.hx.copyWithin(2, 0, 22); p.hx[0] = p.x; p.hx[1] = p.y;
        if (p.hn < p.tn) p.hn++;
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) {
        sparks[i] = sparks[sparks.length - 1]; sparks.pop();
        if (p.onDeath) {
          const l = curLayer, a = curAnchor, d = curDim;
          curLayer = p.L; curAnchor = p.an || null; curDim = p.dim;
          try { p.onDeath(p); } finally { curLayer = l; curAnchor = a; curDim = d; }
        }
        release(sparkPool, p);
        continue;
      }
      const e = Math.exp(-p.k * dt);
      p.vx *= e; p.vy = p.vy * e + g * p.grav * p.sc * dt;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = fxLights.length - 1; i >= 0; i--) {
      const l = fxLights[i];
      if ((l.age += dt) >= l.life) { fxLights[i] = fxLights[fxLights.length - 1]; fxLights.pop(); continue; }
      l.y += l.vy * dt;
    }
    updateSmoke(dt);
    updateConfetti(dt);
  }

  let fadeA = 0;
  function fade(dt) {
    const base = w3dMoved ? 0.55 : settings.longExposure ? 0.045 : 0.2;
    const a = fadeA = 1 - Math.pow(1 - base, dt * 60);
    for (const g of [ctx, gctx]) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = 1;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(0, 0, W, H);
    }
    // Low-alpha fades can leave faint residue; wipe once the sky has been empty for a moment.
    if (!stars.length && !sparks.length && !shells.length && !smokes.length && !hazes.length && !groundItems.length && !confettis.length && !pen) {
      idleClear += dt;
      if (idleClear > 1.5) { ctx.clearRect(0, 0, W, H); gctx.clearRect(0, 0, W, H); idleClear = 0; gfxBlank = true; }
    } else { idleClear = 0; gfxBlank = false; }
  }

  // Every full-screen layer costs the phone's compositor a whole-screen blend each frame, even when it is transparent,
  // so layers with nothing to show are hidden (about twice the frame rate during a launch on a low-end phone).
  let gfxBlank = true;
  // glowUsed: something was drawn on #glow this frame (it shows, and the next frame clears it first).
  let glowUsed = false;
  const layerShown = new Map();
  // A phone short of graphics memory (the low tier, or one Android calls low-RAM) drops the depth effect's embers: one
  // full-screen layer fewer, enough to keep the WebView under its tile budget (it flashed black blocks over the sky).
  const lowMem = () => Q().maxStars < 300 || !!(window.LUTSNative && window.LUTSNative.lastAds && window.LUTSNative.lastAds.lowRam);
  function showLayer(c, on) { if (layerShown.get(c) !== on) { layerShown.set(c, on); c.style.visibility = on ? '' : 'hidden'; } }
  function syncLayers() {
    const s = launch.sequence;
    showLayer(flightC, !!(s && !s.ground && !s.writing && cloudSprite && !arOn && !w3dShown()));
    showLayer(floorC, mode === 'play' && playMode === 'ground' && !arOn);
    showLayer(atmoC, view.active && !lowMem());
    showLayer(moonC, moonDrawn);
    showLayer(cityC, cityDrawn);
    showLayer(gfxC, !gfxBlank);
    // #glow rides with #fx: the 3D view, the launch camera, shake and reduced motion all move #fx only.
    if (glowC.style.transform !== fxC.style.transform) glowC.style.transform = fxC.style.transform;
    if (glowC.style.opacity !== fxC.style.opacity) glowC.style.opacity = fxC.style.opacity;
    showLayer(glowC, glowUsed && fxC.style.visibility !== 'hidden');
  }

  // Trail buckets: every streak of a frame lands in a bucket of (layer, atlas colour slot, width class, alpha level, cap)
  // and each bucket is one path and one stroke(), so a frame costs tens of strokes, not one per particle. Alpha snaps to
  // 7 geometric levels (x.62: fewer buckets, under 100 strokes with 850 ground stars), rounded with a dither fixed per particle (dz): neighbours differ, so a fading burst does not
  // band, but one star keeps its level from frame to frame, so its trail does not turn to dashes; widths to 1.1/1.5/2.1/3, or half pixels for
  // text and shape stars (class 4+) so letters keep their weight. Butt caps: no bead where one frame's streak meets the
  // next. cap 1 is the round-cap dot bucket for stars standing still (held text, strobes).
  const LV = [1, 0.62, 0.38, 0.24, 0.15, 0.09, 0.057], WC = [1.1, 1.5, 2.1, 3];
  const LVL = new Float32Array(256);
  for (let i = 1; i < 256; i++) LVL[i] = Math.log(i / 255) / Math.log(0.62);
  const segB = new Map(), segUsed = [];
  let segK = -1, segL = null;
  const wcOf = (w) => (w < 1.3 ? 0 : w < 1.8 ? 1 : w < 2.6 ? 2 : 3);
  let hotSlot = -1, hotGen = -1;
  const SPR_HOT = () => (hotGen === SPR.gen ? hotSlot : ((hotGen = SPR.gen), (hotSlot = SPR.id('#fff6e4'))));
  function seg(L, s, wc, a, x0, y0, x1, y1, cap, dz) {
    if (a < 0.03) return null;
    const l = LVL[a >= 1 ? 255 : (a * 255) | 0];
    // Text and shape stars (class 4+: thousands of twinkling letter dots in a card) use every other level only, and so
    // does everything once a frame has 64 buckets (stroke() calls stay under 100 in the busiest card show).
    const lv = wc < 4 && segUsed.length < 64 ? Math.min(6, (l + dz) | 0) : Math.min(6, ((l / 2 + dz) | 0) * 2);
    const k = (((cap * 2 + L) * 64 + wc) * 8 + lv) * 1024 + s;
    let b = k === segK ? segL : segB.get(k); // runs of one bucket (tail points) skip the Map
    if (!b) segB.set(k, (b = { L, s, wc, lv, cap, n: 0, xy: [] }));
    segK = k; segL = b;
    if (!b.n) segUsed.push(b);
    const xy = b.xy;
    xy[b.n++] = x0; xy[b.n++] = y0; xy[b.n++] = x1; xy[b.n++] = y1;
    return b;
  }
  function flushSegs() {
    for (const b of segUsed) {
      const g = b.L ? gctx : ctx, xy = b.xy;
      g.globalAlpha = LV[b.lv]; g.strokeStyle = SPR.hexOf[b.s]; g.lineWidth = b.wc < 4 ? WC[b.wc] : (b.wc - 4) / 2;
      g.lineCap = b.cap ? 'round' : 'butt';
      g.beginPath();
      for (let i = 0; i < b.n; i += 4) { // a piece that starts where the last ended (a tail's next point) continues the line
        if (i === 0 || xy[i] !== xy[i - 2] || xy[i + 1] !== xy[i - 1]) g.moveTo(xy[i], xy[i + 1]);
        g.lineTo(xy[i + 2], xy[i + 3]);
      }
      g.stroke(); b.n = 0;
    }
    segUsed.length = 0;
    ctx.lineCap = gctx.lineCap = 'round'; // pctx-style dot paths and resize() expect round
  }

  // Heads: queued during the star loop (layer, slot, kind, x, y, r, alpha) and drawn after the trails as atlas sprites in
  // 'lighter', sky ones on #glow and ground ones on #items (both cleared every frame, so a head never smears). Capped at
  // Q().heads per frame; not particles. hn stays at the last frame's count until the next star loop.
  const HQ = new Float32Array(7 * 3200);
  let hn = 0, hmax = 0;
  function pushHead(L, s, kind, x, y, r, a) {
    const i = hn++ * 7;
    HQ[i] = L; HQ[i + 1] = s; HQ[i + 2] = kind; HQ[i + 3] = x; HQ[i + 4] = y; HQ[i + 5] = r; HQ[i + 6] = a;
  }
  function drawHeads() {
    if (!hn) return;
    glx.globalCompositeOperation = ictx.globalCompositeOperation = 'lighter';
    for (let i = 0, e = hn * 7; i < e; i += 7) {
      const g = HQ[i] ? ictx : glx;
      if (!HQ[i]) glowUsed = true;
      g.globalAlpha = Math.min(1, HQ[i + 6]); SPR.draw(g, HQ[i + 1], HQ[i + 2], HQ[i + 3], HQ[i + 4], HQ[i + 5]);
    }
    glx.globalAlpha = ictx.globalAlpha = 1;
    glx.globalCompositeOperation = ictx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (glowUsed) { glx.clearRect(0, 0, W, H); glowUsed = false; }
    SPR.refresh(); // colours added since the last frame reach the bitmap
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

    // Stars and sparks: velocity streaks batched into buckets, one path and one stroke() per bucket (see seg()).
    hn = 0; hmax = Q().heads;
    for (const p of stars) {
      if (p.strobe && p.age > 0.35 && ((p.age * p.strobe) | 0) % 2) continue;
      let a = Math.min(1, (p.life - p.age) / (p.life * p.fade));
      if (p.fl && a < 0.6) a *= 0.45 + 0.55 * Math.random();
      if (p.twinkle) a *= 0.6 + Math.random() * 0.4;
      if (p.sp && p.age > p.life * 0.72 && Math.random() < 0.35) a *= 0.15;
      a *= p.dim;
      if (p.rg !== SPR.gen) { p.rp = ramp(p.color, p.kind); p.rp2 = p.color2 ? ramp(p.color2, p.kind) : null; p.rg = SPR.gen; }
      const rp = p.rp2 && p.age > p.chT ? p.rp2 : p.rp;
      // Letters keep their own colour once lit (white-hot only at first): crisp, and fewer buckets in a card.
      const st = p.halo === 'core' && p.kind === 'k' ? (p.age < 0.05 ? 0 : 2) : Math.min(rp.length - 1, stageOf(p));
      const wc = p.halo === 'core' ? 4 + Math.round(p.w * 2) : wcOf(p.w);
      if (p.halo && hn < hmax && a >= 0.03) { // a glowing head, faded in so a fresh burst does not white out
        const ha = a * Math.min(1, 0.25 + p.age * 5);
        if (p.halo === 'core') pushHead(p.L, rp[st], SPR.HEAD, p.x, p.y, p.w * 1.8, ha * 0.6);
        else pushHead(p.L, rp[st], SPR.HEAD, p.x, p.y, p.hr * (st === 0 ? 1.3 : st === 1 ? 1.12 : 1), ha);
      }
      if (p.tail && p.hn) { // tapered history polyline: per third one bucket (a stage cooler, wide then thin, alpha falling)
        const hx = p.hx, m = p.hn, ta = a * p.tail, t3 = Math.ceil(m / 3);
        for (let j0 = 0, th = 0; j0 < m; j0 += t3, th++) {
          const j1 = Math.min(m, j0 + t3), x0 = j0 ? hx[j0 * 2 - 2] : p.x, y0 = j0 ? hx[j0 * 2 - 1] : p.y;
          const b = seg(p.L, rp[Math.min(rp.length - 1, st + th + 1)], th ? 0 : wc, ta * (1 - (j0 + j1) / 2 / (m + 1)), x0, y0, hx[j0 * 2], hx[j0 * 2 + 1], 0, p.dz);
          if (b) for (let j = j0 + 1, xy = b.xy; j < j1; j++) { xy[b.n++] = hx[j * 2 - 2]; xy[b.n++] = hx[j * 2 - 1]; xy[b.n++] = hx[j * 2]; xy[b.n++] = hx[j * 2 + 1]; }
        }
      }
      const dx = p.x - p.px, dy = p.y - p.py, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.6) { seg(p.L, rp[st], wc, a, p.x, p.y, p.x + 0.01, p.y, 1, p.dz); continue; } // standing still: a round dot
      // A streak of a whole number n of this frame's moves (about speed x tl), so every point of the trail is covered
      // exactly n times and the fading buffer shows no beads or dashes, at 60 or 30 fps. The newest move is drawn one
      // stage hotter (the burning leading edge); each point is hot exactly once, so that is even along the trail too.
      const n = Math.max(1, Math.round(Math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.tl / d));
      if (n === 1 || p.halo === 'core') { seg(p.L, rp[st], wc, a, p.x - dx * n, p.y - dy * n, p.x, p.y, 0, p.dz); continue; } // letters: one colour
      seg(p.L, rp[st], wc, a, p.x - dx * n, p.y - dy * n, p.px, p.py, 0, p.dz);
      seg(p.L, rp[st ? st - 1 : 0], wc, a, p.px, p.py, p.x, p.y, 0, p.dz);
    }
    for (const p of sparks) {
      let a = (1 - p.age / p.life) * p.dim;
      if (p.gl) a *= 0.35 + 0.65 * Math.random();
      if (p.rg !== SPR.gen) { p.cs = SPR.id(p.color); p.c2 = p.c2s ? SPR.id(p.c2s) : -1; p.rg = SPR.gen; }
      const s = p.age < 0.05 ? SPR_HOT() : p.c2 >= 0 && p.age > p.life * 0.55 ? p.c2 : p.cs;
      if (p.gt && hn < hmax && a > 0.2) pushHead(p.L, s, SPR.GLINT, p.x, p.y, 5 * UV() * p.sc, a);
      const dx = p.x - p.px, dy = p.y - p.py, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.6) { seg(p.L, s, p.L ? 1 : 0, a, p.x, p.y, p.x + 0.01, p.y, 1, p.dz); continue; }
      const n = p.st ? Math.max(1, Math.round(Math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.st / d)) : 1; // as for stars
      seg(p.L, s, p.L ? 1 : 0, a, p.x - dx * n, p.y - dy * n, p.x, p.y, 0, p.dz);
    }
    flushSegs();
    drawLights();
    drawHeads();
    drawPenHead();
    drawLighter();
    flushGlows();
    ctx.globalAlpha = gctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    if (document.hidden) { frameRaf = 0; return; }
    frameRaf = requestAnimationFrame(frame);
    frameNo++;
    const dt = Math.min(0.05, (now - last) / 1000);
    frameMean += ((now - last) - frameMean) * 0.025;
    slowFor = frameMean > 38 ? slowFor + dt : 0;
    fastFor = frameMean < 24 ? fastFor + dt : 0;
    if (slowFor > 2 && measuredTier > 0) { failedTier = measuredTier; setTier(measuredTier - 1); }
    else if (fastFor > 12 && measuredTier + 1 < failedTier) setTier(measuredTier + 1);
    // Weak phone, 3D, a show playing: smaller firework budget and a lower-resolution scene until it ends. Still under
    // about 7 frames a second for 4 seconds of a show, and 3D rests for the session so the show runs on in 2D.
    const lite = w3dShown() && launch.state !== 'READY' && lowEnd3d();
    if (lite !== lite3d) { lite3d = lite; sizeWorld3d(); }
    crawlFor = lite && frameMean > 140 && !adBusy() ? crawlFor + (now - last) / 1000 : 0;
    if (crawlFor > 4) { crawlFor = 0; lite3d = false; give3dUp('3D paused: this device needs a rest. The 2D background stays for now.'); }
    // A low-end phone out of memory freezes for seconds at a time in 3D; twice in two minutes (not counting time the app
    // was in the background or behind a video ad) and 3D rests for the session, as after GPU trouble
    if (now - last > 3000 && w3dHiddenAt < last && !adBusy() && w3dShown() && lowEnd3d()) {
      w3dStalls = w3dStalls.filter((t) => now - t < 120000).concat(now);
      if (w3dStalls.length >= 2) { w3dStalls = []; give3dUp('3D paused: this device needs a rest. The 2D background stays for now.'); }
    }
    last = now;
    // On a phone a sheet (Light someone up, Birthdays, Gems, ...) covers the whole screen: the show behind it waits,
    // so the sheet scrolls smoothly and the battery lasts. Recording keeps every frame.
    const covered = !rec && innerWidth <= 760 && !!document.querySelector('.sheet-modal:not([hidden])');
    if (!paused && !covered) {
      fade(dt);
      try { syncWorld3d(); if (w3dShown()) stepWorld3d(dt); update(dt); draw(); drawLaunch(); renderGlow(dt); applyShake(dt); updateView(dt); if (w3dShown() && w3dRenderDue()) renderWorld3d(); syncLayers(); }
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
    if (rush.kind === 'duel') { if (duelHooks.tap) duelHooks.tap(x / W, clamp(y, H * 0.08, H * 0.72) / H); return; } // duel.js picks the shell
    // In a Lantern Rush the shell flies fast and bursts exactly where you tapped, so aiming is fair over every landmark.
    // The lanterns under your finger when you tap are the ones you aimed at: they still count when the shell bursts,
    // though they have floated on a little while it flew.
    const aim = rush.on ? rush.live.filter((l) => Math.hypot(l.x - x, l.y - y) < rushReach()) : null;
    // A Rush is free play: a Premium or gem shell chosen in the list flies as Random there (no try used, no gems).
    const pick = mode === 'card' || (!premium.active && (PREMIUM_SHELLS.has(settings.shell) || SHELL_GEM_COST[settings.shell])) ? 'random' : settings.shell;
    launchShell({ x, y: clamp(y, H * 0.08, H * 0.72), type: playerType(pick), user: true, exact: rush.on, fast: rush.on ? 1.7 : 1, aim });
  }
  stage.addEventListener('pointerdown', (e) => {
    Sound.resume();
    askMotion();
    // A second finger while one holds a sparkler shape: the two pinch it bigger or smaller.
    if (pointer && pointer.kind === 'spark' && shapeDrag && !shapePinch && e.pointerId !== pointer.id) {
      const x = e.clientX - arPan.x, y = e.clientY - arPan.y;
      shapePinch = { id: e.pointerId, x, y, d: Math.hypot(x - pointer.x, y - pointer.y) };
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      return;
    }
    if (paused || pointer) return;
    if (lighterDown(e)) return;
    if (w3dShown() && (playMode !== 'spark' || shapesClosed)) { look3dDown(e); return; } // the sparkler draws (bar open)
    if (launch.state !== 'READY') return;
    // Only a sky shell needs a floor spot to launch from; sparkler drawing and ground crackers use the
    // tap/drag they always have, right over the live camera.
    if (roomAr && mode === 'play' && playMode === 'sky' && !rush.on) { window.LUTSAndroid.arcore('place', `${Math.round(e.clientX)},${Math.round(e.clientY)}`); return; }
    const kind = mode === 'play' ? playMode : 'sky';
    if (kind === 'sky' && tapSkyOn()) { tapFire((e.clientX - arPan.x), (e.clientY - arPan.y)); return; }
    if (kind !== 'spark' && !rush.on) {
      if (nativeRecording === 'recording') userLaunch((e.clientX - arPan.x), (e.clientY - arPan.y));
      return;
    }
    el.hint.classList.add('gone');
    pointer = { x: (e.clientX - arPan.x), y: (e.clientY - arPan.y), sx: (e.clientX - arPan.x), sy: (e.clientY - arPan.y), id: e.pointerId, kind };
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (kind === 'ground') {
      // Tap a waiting cracker to light it, drag it to move it, or tap the street to place a new one.
      const hit = hitItem((e.clientX - arPan.x), (e.clientY - arPan.y));
      pointer.kind = 'item';
      pointer.item = hit || placeItem(settings.item, (e.clientX - arPan.x), (e.clientY - arPan.y));
      if (!pointer.item) { pointer = null; return; } // Pataka Chor: only the crackers you find go down
      pointer.fresh = !hit;
      pointer.oy = pointer.item.y - (e.clientY - arPan.y);
      return;
    }
    if (kind === 'spark') { sparkDown((e.clientX - arPan.x), (e.clientY - arPan.y)); return; }
    userLaunch(pointer.x, pointer.y);
  });
  stage.addEventListener('pointermove', (e) => {
    if (shapePinch && e.pointerId === shapePinch.id) { shapePinch.x = e.clientX - arPan.x; shapePinch.y = e.clientY - arPan.y; pinchShape(); return; }
    if (!pointer || e.pointerId !== pointer.id) return;
    if (pointer.kind === 'spark') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) sparkMove((ev.clientX - arPan.x), (ev.clientY - arPan.y));
    } else if (pointer.kind === 'item') {
      if (!pointer.moved && Math.hypot((e.clientX - arPan.x) - pointer.sx, (e.clientY - arPan.y) - pointer.sy) > 8) pointer.moved = true;
      if (pointer.moved && !pointer.item.armed) moveItem(pointer.item, (e.clientX - arPan.x), (e.clientY - arPan.y) + pointer.oy);
    }
    pointer.x = (e.clientX - arPan.x); pointer.y = (e.clientY - arPan.y);
    if (shapePinch) pinchShape();
  });
  const endPointer = (e) => {
    if (shapePinch && e.pointerId === shapePinch.id) { shapePinch = null; return; }
    if (!pointer || e.pointerId !== pointer.id) return;
    shapePinch = null;
    if (pointer.kind === 'spark') sparkUp();
    else if (pointer.kind === 'item' && !pointer.moved && !pointer.fresh) armItem(pointer.item);
    pointer = null;
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // ---------- Sparkler lighter ----------
  // Ground and Sky: a lit sparkler waits docked by the right edge. Drag it (it takes the pointer only when the drag starts
  // on it) and its tip lights each fuse it passes, once, so one sweep sets off a chain: ground crackers burn as if
  // tapped, a Sky tube sputters a moment and sends its shell up as Tap sky does. Let go without lighting anything and it
  // glides back to the dock.
  const lighter = { x: 0, y: 0, held: null, lit: 0, log: [], need: null, show: false, quiet: 0, docked: true };
  const SKY_FUSE = 0.6; // a Sky tube's fuse burns this long before its shell leaves
  // Phones and tablets light crackers with the sparkler, so Fire steps aside there in Ground and Sky; a TV remote, a
  // mouse or a keyboard keeps Fire. Camera AR has the sparkler too; room AR, Lantern Rush and recording keep Fire.
  // The Android app is a touch phone unless it is the TV build (an emulator driven by a mouse reports a fine pointer).
  const touchFirst = () => (ANDROID_WEBVIEW || matchMedia('(pointer: coarse)').matches) && !document.documentElement.classList.contains('tv');
  const sparklerFires = () => touchFirst() && mode === 'play' && (playMode === 'ground' || playMode === 'sky') && !rush.on && !roomAr && nativeRecording !== 'recording';
  const lighterOn = () => mode === 'play' && (playMode === 'ground' || playMode === 'sky') && !rush.on && !roomAr && launch.state === 'READY';
  // The dock: the holder at the end of the cracker list (its burning tip at the top of the holder's sparkler). It sits in
  // the controls, clear of the screen's edges, where a swipe would be the phone's Back gesture.
  const holder = $('#lighterHolder'), grip = $('#lighterGrip');
  function lighterDock() {
    const r = grip.getBoundingClientRect();
    if (r.width) return unfit(r.left + r.width / 2 - arPan.x, r.top + 6 - arPan.y);
    const top = playMode === 'ground' ? floorTop() : groundBottom() - H * 0.22;
    return [W - 34 * LU(), clamp(top - 30 * LU(), H * 0.24, groundBottom() - 100 * LU())];
  }
  const LU = () => Math.max(U, 0.85); // the sparkler stays big enough to grab on a phone
  const LIGHTER_STICK = [10, 84]; // the stick's far end from the tip, in LU
  // The touch is on the sparkler: anywhere near its stick or burning tip.
  function onLighter(x, y) {
    const [ex, ey] = [lighter.x + LIGHTER_STICK[0] * LU(), lighter.y + LIGHTER_STICK[1] * LU()];
    return segDist(x, y, lighter.x, lighter.y, ex, ey) < 22 * LU();
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  // Fuses waiting to be lit: ground crackers on the street, or the tubes standing in Sky mode.
  function lighterFuses() {
    if (playMode === 'sky') return groundItems.filter((it) => (it.launcher || it.skyTube) && !it.done && it.skyFuse == null);
    return waitingItems();
  }
  // fromHolder: picked up from its holder, the tip rises a little above the finger so it stays in sight.
  function lighterDown(e, fromHolder) {
    if (!lighterOn() || lighter.held) return false;
    const [x, y] = unfit(e.clientX - arPan.x, e.clientY - arPan.y); // the sparkler is drawn on the street's layer
    if (!fromHolder && (lighter.docked || !onLighter(x, y))) return false;
    lighter.held = fromHolder ? { id: e.pointerId, dx: 0, dy: -56 * LU() } : { id: e.pointerId, dx: lighter.x - x, dy: lighter.y - y };
    if (fromHolder) { lighter.x = x; lighter.y = y - 56 * LU(); }
    lighter.docked = false;
    lighter.lit = 0; lighter.need = lighter.needTry = null;
    el.hint.classList.add('gone');
    try { (fromHolder ? grip : stage).setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    safeSound(() => Sound.sparklerStart());
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId || !lighter.held) return;
      ev.preventDefault();
      const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
      for (const c of evs.length ? evs : [ev]) {
        const [x, y] = unfit(c.clientX - arPan.x, c.clientY - arPan.y);
        lighterTo(x + lighter.held.dx, y + lighter.held.dy);
      }
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      lighterUp();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return true;
  }
  // Moves the tip, lighting every fuse along the way from where it was (so a quick flick misses none).
  function lighterTo(x, y) {
    x = clamp(x, 0, W); y = clamp(y, 0, H);
    const reach = 18 * LU(), px = lighter.x, py = lighter.y;
    const hits = lighterFuses().map((it) => { const [fx, fy] = tipPos(it); return { it, d: segDist(fx, fy, px, py, x, y), t: Math.hypot(fx - px, fy - py) }; })
      .filter((h) => h.d < reach).sort((a, b) => a.t - b.t); // nearest the old tip first: lit in the order passed
    lighter.x = x; lighter.y = y;
    for (const h of hits) lightFuse(h.it);
  }
  function lightFuse(it) {
    const sky = playMode === 'sky', label = sky ? (TYPES[it.shellId || settings.shell] || {}).label || 'Shell' : ITEMS[it.type].label;
    const cost = premium.active || chor.on ? 0 : sky ? SHELL_GEM_COST[it.shellId || settings.shell] || 0 : GEM_COST[it.type] || 0;
    if (cost > gems()) { if (!lighter.need) lighter.need = { cost, label }; return; } // short of gems: the sheet opens on release
    // A Premium cracker or shell a free player lights uses its free try; with none left it stays unlit and the offer
    // opens on release.
    const key = sky ? shellKey(it.shellId || settings.shell) : it.type;
    if (onTry(key) && !useTry(key)) { if (!lighter.needTry) lighter.needTry = key; return; }
    spendGems(cost);
    festLaunched([sky ? it.shellId || settings.shell : it.type]);
    const [fx, fy] = tipPos(it);
    if (sky) {
      it.skyFuse = 0; atDepth(it, () => Sound.hiss(SKY_FUSE + 0.1, 6000, 0.05, pan(it.x), { q: 0.4 }));
      it.paid = { cost, key: onTry(key) ? key : '', video: onTry(key) && triedVideo }; // given back if it never flies (unpay)
    } else lightItem(it);
    it.swept = true;
    lighter.lit++;
    lighter.log.push({ type: it.type, shell: it.shellId || null, x: Math.round(fx), y: Math.round(fy), mode: playMode });
    if (lighter.log.length > 40) lighter.log.shift();
    atDepth(it, () => { flash(fx, fy, '#ffd9a0', 0.25, gctx); for (let i = 0; i < 10; i++) spark(fx, fy, rand(-160, 160) * U, rand(-200, 40) * U, pick(GOLD), rand(0.15, 0.4)); });
    buzz(10);
  }
  function lighterUp() {
    lighter.held = null;
    safeSound(() => Sound.sparklerStop());
    if (lighter.need) { const n = lighter.need; lighter.need = null; openGems(n); }
    else if (lighter.needTry) { const t = lighter.needTry; lighter.needTry = null; offerTry(t); }
    // Nothing lit: back to the dock (updateLighter glides it there). After a sweep it waits where it was let go, then
    // drifts home too, so it is ready for the next one.
    lighter.back = performance.now() + (lighter.lit ? 1200 : 0); lighter.from = [lighter.x, lighter.y];
    if (lighter.lit) lighter.show = true; // a sweep is a show: its end is the break for a video and the rating ask
  }
  // Another mode chosen: what the sparkler lit in this one stops (a ground fountain must not go on spraying over the Sky
  // mode's city, nor a Sky tube send its shell up from the street). A Fire show locks the tabs; a sweep does not.
  function endSweep() {
    if (lighter.held) lighterUp();
    for (let i = groundItems.length - 1; i >= 0; i--) if (groundItems[i].swept) { const it = groundItems[i]; if (it.rapid) it.rapid.stop(); if (it.skyFuse != null) unpay(it); groundItems.splice(i, 1); }
    if (lighter.show && triedNow) afterTry(); // the try's show ends here: its Premium sheet now, not after the next show
    lighter.show = false; lighter.quiet = 0;
  }
  // A Sky tube taken away while its fuse burns (another mode chosen): its shell never flew, so the gems or the free try
  // its lighting took come back.
  function unpay(it) {
    const p = it.paid;
    it.paid = null;
    if (!p) return;
    if (p.cost) { wallet.b += p.cost; saveWallet(); syncGems(); }
    if (p.key) { if (p.video) tries.vfor = p.key; else delete tries.used[p.key]; if (triedNow === p.key) triedNow = null; saveTries(); syncTries(); }
  }
  // A swept Sky tube: its fuse sputters, then its shell goes up. Lit on its own (nothing else burning or in the air), it
  // flies as Fire's launch does: the camera follows the rocket up into the night and the show ends on Happy Diwali, the
  // big moment of Sky mode, on a phone too. A sweep across several tubes stays a quick volley, each shell from its own
  // tube's mouth with no show taking the screen, so a fresh tube stands up at once and the list stays live.
  function updateSweptTube(it, dt) {
    it.skyFuse += dt;
    fuseSputter(it);
    if (it.skyFuse < SKY_FUSE) return;
    // The only tube on the street, and the only one its sweep lit (lighter.lit), with nothing in the air: a show, which
    // clears the street, takes nothing from the player. While the sparkler is still held it waits a moment, in case the
    // sweep goes on to more.
    const alone = lighter.lit <= 1 && !groundItems.some((o) => o !== it && !o.done && (o.launcher || o.skyTube || o.skyFuse != null)) && !shells.length;
    if (alone && lighter.held && it.skyFuse < SKY_FUSE + 1.2) return;
    if (alone && !lighter.held && launch.state === 'READY' && mode === 'play' && !rush.on && !roomAr) {
      const id = it.shellId || settings.shell;
      it.skyFuse = null;
      for (const o of groundItems) o.launcher = o === it; // the launch takes this very tube (prepareLaunch)
      lighter.show = false; // the launch's own end is the show's end: its video break and rating ask
      const s = { id: shellKey(id), label: shellLabel(id), type: id };
      Promise.resolve(launch.request(s)).then((ok) => { if (ok === false) skyVolley(it); }, () => skyVolley(it));
      return;
    }
    skyVolley(it);
  }
  function skyVolley(it) {
    const [sx, sy] = tipPos(it), tx = clamp(it.x + rand(-0.08, 0.08) * W, W * 0.08, W * 0.92), ty = H * rand(0.16, 0.32);
    launchShell({ x: tx, y: ty, sx, sy, type: playerType(it.shellId || settings.shell), user: true, exact: true, fast: 1.5, tap: true, an: w3dShown() ? anchorAt(tx, ty, 150) : undefined });
    it.skyFuse = null; it.done = true;
  }
  // A sweep's show has ended once all it lit has burnt out and its shells have burst: the same natural break a Fire
  // show's end is (an interstitial every 3rd show, 2 minutes apart, and the moment to ask for a rating). On a phone the
  // sparkler is how crackers are lit, so without this a phone would never reach that break.
  function sweepEnded(dt) {
    if (!lighter.show || lighter.held) { lighter.quiet = 0; return; }
    const busy = groundItems.some((it) => it.swept && !it.done) || shells.length;
    lighter.quiet = busy ? 0 : lighter.quiet + dt;
    if (lighter.quiet < 0.8) return;
    lighter.show = false; lighter.quiet = 0;
    if (triedNow) { afterTry(); return; }
    if (mode === 'play' && launch.state === 'READY') adBreak('launch');
    setTimeout(showEndedForRating, 1500);
    setTimeout(showEndedForPremium, 4000);
  }
  // A show that used a free try ends on the Premium sheet naming that cracker, with no video ad or rating ask beside it.
  function afterTry() {
    const type = triedNow;
    triedNow = null;
    setTimeout(() => {
      if (mode === 'play' && launch.state === 'READY' && premiumPanel.hidden && sheets.every((x) => x.hidden) && !rewardBusy && !adShowing && !premium.active && !document.hidden) openPremium({ tried: type });
    }, 1200);
  }
  // Something the sparkler lit is still going: a cracker burning, a Sky tube's fuse, or its shells in the air. Fire waits
  // till it is over, or it would clear the street and fire the same cracker again (and charge for it twice), or send a
  // second shell up from a Sky tube whose fuse is already lit.
  function sweepBusy() {
    return groundItems.some((it) => (it.swept && it.armed && !it.done) || it.skyFuse != null) || (lighter.show && shells.length > 0);
  }
  let sweepWasBusy = false;
  function updateLighter(dt) {
    sweepEnded(dt);
    const busyNow = sweepBusy();
    if (busyNow !== sweepWasBusy) { sweepWasBusy = busyNow; syncLaunchUi(); } // Fire greys out while it lasts
    const on = lighterOn();
    if (holder.hidden === on) holder.hidden = !on;
    holder.classList.toggle('out', !lighter.docked); // out of its holder: drawn on the canvas instead
    if (!on) { if (lighter.held) lighterUp(); lighter.x = lighter.y = 0; lighter.back = null; lighter.docked = true; return; }
    const [dx, dy] = lighterDock();
    if (!lighter.x && !lighter.y) { lighter.x = dx; lighter.y = dy; } // first shown: at the dock
    if (!lighter.held) {
      // A third of a second home by the clock, so a phone slowed by a big chain still sees it back on time.
      const now = performance.now();
      if (lighter.back == null) { lighter.x = dx; lighter.y = dy; lighter.docked = true; }
      else if (now < lighter.back) lighter.from = [lighter.x, lighter.y];
      else {
        const t = Math.min(1, (now - lighter.back) / 330), k = 1 - (1 - t) ** 3;
        lighter.x = lighter.from[0] + (dx - lighter.from[0]) * k; lighter.y = lighter.from[1] + (dy - lighter.from[1]) * k;
        if (t >= 1) { lighter.back = null; lighter.docked = true; }
      }
    }
    // Held, the burning tip throws sparks as the Spark mode pen does. In the dock only its drawn rays flicker
    // (drawLighter), so an idle street holds no particles and the idle wipe still runs.
    if (!lighter.held) return;
    curLayer = 1;
    const n = Math.round(3 * Q().count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = rand(50, 260) * U;
      spark(lighter.x, lighter.y, Math.cos(a) * v, Math.sin(a) * v, Math.random() < 0.6 ? '#fff4dc' : pick(GOLD), rand(0.1, 0.35));
    }
    curLayer = 0;
  }
  // On #items: the wire and its glowing coated end, with the hot tip on top.
  function drawLighter() {
    if (!lighterOn() || lighter.docked || (!lighter.x && !lighter.y) || window.LUTSLighter.hide) return; // hide: tests that read the crackers' pixels
    const g = ictx, x = lighter.x, y = lighter.y, ex = x + LIGHTER_STICK[0] * LU(), ey = y + LIGHTER_STICK[1] * LU();
    const cx = x + (ex - x) * 0.55, cy = y + (ey - y) * 0.55; // the coating burns down from the tip to here
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.lineCap = 'round';
    g.strokeStyle = '#b8bec6'; g.lineWidth = 2.4 * LU();
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = '#5a4a3c'; g.lineWidth = 5.5 * LU();
    g.beginPath(); g.moveTo(x, y); g.lineTo(cx, cy); g.stroke();
    g.lineCap = 'butt';
    const r = 12 * LU() * rand(0.85, 1.15), s = SPR.id('#ffd27a');
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = lighter.held ? 0.45 : 0.3; SPR.draw(g, s, SPR.SOFT, x, y, r * 3.4);
    g.globalAlpha = 0.7; g.strokeStyle = '#ffe7b0'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = rand(0, TAU), l = r * rand(0.8, 2.2); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
    g.stroke();
    g.globalAlpha = 1; SPR.draw(g, SPR.id('#fff4dc'), SPR.HEAD, x, y, r);
    g.globalCompositeOperation = 'source-over';
  }
  // For the browser tests: where the sparkler and the fuses are, and what it has lit.
  grip.addEventListener('pointerdown', (e) => { Sound.resume(); if (!paused && lighterDown(e, true)) e.preventDefault(); });
  window.LUTSLighter = {
    state: () => ({ on: lighterOn(), docked: lighter.docked, shells: shells.length, burning: groundItems.filter((it) => it.swept && !it.done).length, parts: [stars.length, sparks.length, smokes.length, confettis.length, groundItems.length], sample: sparks.slice(0, 3).map((p) => [Math.round(p.x), Math.round(p.y), p.color, +p.age.toFixed(2), +p.life.toFixed(2)]).concat(stars.slice(0, 2).map((p) => ['star', Math.round(p.x), Math.round(p.y), p.color, +p.age.toFixed(2)])), x: lighter.x, y: lighter.y, lift: 56 * LU(), grip: (({ left, top, width, height }) => [left + width / 2, top + height / 2])(grip.getBoundingClientRect()), dock: lighterOn() ? lighterDock() : null, held: !!lighter.held, stick: LIGHTER_STICK.map((v) => v * LU()),
      fuses: lighterOn() ? lighterFuses().map((it) => { const [x, y] = tipPos(it); return { type: it.type, shell: it.shellId || null, x, y }; }) : [], log: lighter.log.slice() }),
  };

  function typingTarget(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
  document.addEventListener('keydown', (e) => {
    if (typingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && !$('#arSafety').hidden) { $('#btnArSafeCancel').click(); return; }
    if (e.key === 'Escape') { $('#rewardsPanel').hidden = true; $('#crackerTrial').hidden = true; closeDrawer(); closeCardModal(); closeSheets(); return; }
    if (mode === 'intro' || mode === 'envelope' || mode === 'puzzle') return;
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
      dahlia() { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; comet(20, 20, 20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13, '#ff5f7a'); } },
      pistil() { burst(20, 20, 15, 18, ['#f2f4ff', '#dfe6ff']); burst(20, 20, 6, 10, ['#ff5fa2', '#ff8ac0'], { w: 1.2 }); },
      doublepetal() { burst(20, 20, 15, 20, ['#ffd36b']); burst(20, 20, 10, 14, ['#5ff0ff'], { w: 1 }); burst(20, 20, 5, 8, ['#ff5fa2'], { w: 0.9 }); },
      brocade() { for (let i = 0; i < 13; i++) { const a = -Math.PI + i / 12 * Math.PI; streak(20, 15, 20 + Math.cos(a) * 15, 15 + Math.sin(a) * 6 + 14, '#ffcf6b', 1.4, 0.95); drawSpark(20 + Math.cos(a) * 15, 15 + Math.sin(a) * 6 + 14, 1.4, '#ff3b3b'); } },
      kingwillow() { for (let i = 0; i < 17; i++) { const a = -Math.PI + i / 16 * Math.PI; streak(20, 11, 20 + Math.cos(a) * 17, 13 + Math.sin(a) * 6 + 18, '#ffb54a', 1.3, 0.9); } drawSpark(20, 11, 2.6, '#fff4e0'); },
      colorchange() { burst(20, 20, 14, 16, ['#ffcf55', '#33ff88'], { rot: 0.2 }); },
      ghost() { burst(20, 20, 14, 18, ['#ff5fa2', '#ff8ac0', '#b56bff', '#5ff0ff', '#4df29a', '#ffd36b']); },
      fish() { for (let i = 0; i < 6; i++) { const x = 9 + i * 4.5, y = 12 + (i % 3) * 7; streak(x, y, x + 4, y + 3 * Math.sin(i), '#fff1c8', 1.2); drawSpark(x + 4, y + 3 * Math.sin(i), 1.5, '#ffd36b'); } },
      timerain() { for (let i = 0; i < 14; i++) { const x = 7 + (i * 9) % 27, y = 8 + (i * 13) % 24; streak(x, y, x + 2, y + 5, '#ffd27a', 1, 0.8); } },
      senrin() { for (const [x, y] of [[12, 12], [27, 13], [18, 22], [30, 26], [10, 28], [22, 31]]) burst(x, y, 4, 7, ['#fff4e0', '#ffd27a'], { w: 0.7 }); },
      shellofshells() { for (const [x, y, c] of [[20, 10, '#ff5fa2'], [11, 18, '#ffd36b'], [29, 18, '#5ff0ff'], [14, 29, '#4df29a'], [26, 29, '#b56bff']]) burst(x, y, 5, 8, [c], { w: 0.8 }); },
      multibreak() { for (const [x, y, r, c] of [[20, 31, 4, '#ff5fa2'], [20, 23, 5, '#ffd36b'], [20, 14, 6, '#5ff0ff']]) burst(x, y, r, 8, [c], { w: 0.8 }); for (let i = 0; i < 8; i++) streak(10 + i * 3, 6, 10 + i * 3, 12, '#e8ecff', 0.8, 0.6); },
      spider() { for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; streak(20, 20, 20 + Math.cos(a) * 17, 20 + Math.sin(a) * 17, '#fff2d0', 0.8, 0.9); } },
      rondelle() { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; drawSpark(20 + Math.cos(a) * 14, 20 + Math.sin(a) * 5, i < 6 ? 2.6 : 1.2, '#ffffff', i < 6 ? 1 : 0.5); } },
      barrel() { for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; drawSpark(20 + Math.cos(a) * 11, 9 + r * 7 + Math.sin(a) * 2.5, 1.3, r < 2 ? '#ff5fa2' : '#5ff0ff', 0.9); } },
      sunflower() { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, b = a + 0.5; streak(20 + Math.cos(a) * 7, 20 + Math.sin(a) * 7, 20 + Math.cos(b) * 15, 20 + Math.sin(b) * 15, '#ffcf6b', 1.3); } drawSpark(20, 20, 3, '#ff8a2b'); },
      bouquet() { this.ring(); burst(20, 20, 7, 4, ['#ff5fa2'], { w: 1.3 }); drawSpark(20, 20, 2.4, '#ffffff'); },
      twotone() { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; streak(20 + Math.cos(a) * 5, 20 + Math.sin(a) * 5, 20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13, '#ffcf6b', 1.2); drawSpark(20 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, 1.8, '#8a7bff'); } },
      doublering() { for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; drawSpark(20 + Math.cos(a) * 14, 20 + Math.sin(a) * 6, 1.5, '#ffd36b'); drawSpark(20 + Math.sin(a) * 6, 20 + Math.cos(a) * 14, 1.5, '#5ff0ff'); } },
      flagindia() { for (const [y, c] of [[12, '#ff9933'], [20, '#fff4e6'], [28, '#2fd25a']]) for (let x = 6; x <= 34; x += 3.5) drawSpark(x, y, 1.3, c, 0.9); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; drawSpark(20 + Math.cos(a) * 3.4, 20 + Math.sin(a) * 3.4, 0.9, '#5b7bff'); } },
      tiger() { for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; drawSpark(20 + Math.cos(a) * 14, 21 + Math.sin(a) * 12, 1.1, '#ff8a2b', 0.9); } drawSpark(14, 18, 1.6, '#c6ff4d'); drawSpark(26, 18, 1.6, '#c6ff4d'); drawSpark(20, 24, 1.6, '#ff5f7a'); for (const x of [16, 20, 24]) streak(x, 9, x, 13, '#ffd36b', 1.2); },
      india() { this.flagindia(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; drawSpark(31 + Math.cos(a) * 5, 9 + Math.sin(a) * 4.5, 0.9, '#ff8a2b'); } },
      ...Object.fromEntries(['bangladesh', 'usa', 'uk', 'china', 'brazil'].map((id) => [id, () => { // a small waving flag
        const F = FLAGS[id];
        for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) { const u = (c + 0.5) / 9, v = (r + 0.5) / 6; drawSpark(5 + u * 30, 20 - 16 * F.ar + v * 32 * F.ar, 1.25, F.at(u, v), 0.9); }
      }])),
      grandshow() { burst(11, 14, 7, 9, ['#ff3355']); burst(29, 14, 7, 9, ['#4a7dff']); burst(20, 25, 9, 12, ['#ffcf6b', '#fff4e0']); for (let i = 0; i < 5; i++) drawSpark(6 + i * 7, 36, 1.4, '#fff4e0', 0.8); },
      whistle() { burst(20, 22, 11, 10, ['#ff5fa2', '#ffd36b']); for (let i = 0; i < 3; i++) streak(8 + i * 3, 6 + i * 2, 12 + i * 3, 4 + i * 2, '#fff4e0', 1, 0.7); },
    };
    (map[type] || map.random).call(map);
    return c.toDataURL();
  }

  // Dock icon: the cracker's artwork when it has one (WebP, then JPEG), otherwise its drawn icon.
  function setChipArt(chip, id, drawn) {
    const img = chip.querySelector('img'), art = CRACKER_ART[id];
    img.draggable = false; // the chip drags itself (onto the street); the picture must not start the browser's image drag
    if (!art) { img.src = drawn(); return; }
    chip.classList.add('art');
    img.decoding = 'async';
    img.addEventListener('error', () => {
      if (img.src.endsWith('.webp')) img.src = `assets/crackers/${art}.jpg`;
      else { chip.classList.remove('art'); img.src = drawn(); }
    });
    img.src = `assets/crackers/${art}.webp`;
  }
  // The lists show the real crackers. A sky shell is fired from a tube, so its chip is its tube, wrapped in its own
  // colour and labelled with its burst (assets/sky, made by tests/make-sky-art.cjs); if that can't load, the chip
  // keeps its burst picture.
  const skyArt = {}; // the same pictures stand on the ground as the tube waiting to fire
  function realShellArt(chip, id) {
    const img = chip.querySelector('img'), pic = skyArt[id] = new Image();
    pic.onload = () => { chip.classList.remove('art'); chip.classList.add('real'); img.onerror = null; img.src = pic.src; };
    pic.src = `assets/sky/${id}.webp`;
  }
  // A ground cracker's chip shows its own cut-out (the drawn one where there is no photo of it).
  function realGroundArt(chip, id, drawn) {
    const img = chip.querySelector('img');
    img.draggable = false;
    chip.classList.add('real');
    if (!GROUND_ART.includes(id)) { img.src = drawn(); return; }
    img.addEventListener('error', () => { img.src = img.src.endsWith('.webp') ? `assets/ground/${id}.png` : drawn(); });
    img.src = `assets/ground/${id}.webp`;
  }
  const shellList = $('#shellList');
  for (const id of DOCK_ORDER) {
    const b = document.createElement('button');
    b.className = 'shell-chip';
    b.dataset.shell = id;
    const t = TYPES[id];
    b.innerHTML = '<span class="ico"><img alt=""></span><span></span>';
    setChipArt(b, id, () => shellIcon(id));
    realShellArt(b, id);
    b.lastChild.textContent = id === 'random' ? 'Random' : t.label;
    gemBadge(b, SHELL_GEM_COST[id]);
    b.title = id === 'random' ? 'Random shells' : PREMIUM_SHELLS.has(id) ? `${t.label} shell · Premium` : SHELL_GEM_COST[id] ? `${t.label} shell · ${SHELL_GEM_COST[id]} gems` : `${t.label} shell`;
    b.classList.toggle('premium-item', PREMIUM_SHELLS.has(id)); // a crown for free players (style.css)
    if (PREMIUM_SHELLS.has(id)) { const e = document.createElement('em'); e.className = 'chip-try'; e.textContent = 'Free try'; b.append(e); } // shown by syncTries
    b.addEventListener('pointerdown', (e) => startChipDrag(e, b, id, true));
    b.addEventListener('click', () => { if (b.dataset.dragged) { delete b.dataset.dragged; return; } setShell(id); });
    shellList.append(b);
  }
  function setShell(id) {
    if (launch.state !== 'READY') return;
    if (itemLocked(shellKey(id))) { offerTry(shellKey(id)); return; } // a Premium shell with no free light left
    settings.shell = id;
    saveSettings();
    syncSettingsUi();
    syncLaunchUi();
    placeSkyLauncher(); // the tapped cracker goes on the ground first; Fire sends it up
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
  bind('#setShell', 'change', (t) => setShell(t.value)); // its tube too; a locked Premium shell offers its try and stays unpicked
  bind('#setSize', 'input', (t) => { settings.size = +t.value; });
  bind('#setQuality', 'change', (t) => { settings.quality = t.value; resize(); });
  // Language: each in its own script, so the list never needs translating; choosing one reloads in it.
  if (window.LUTSLang) {
    const sel = $('#setLang');
    for (const [code, name] of LUTSLang.langs) sel.append(new Option(code === 'auto' ? LUTSLang.t(name) : name, code));
    sel.value = LUTSLang.chosen;
    sel.addEventListener('change', () => LUTSLang.choose(sel.value));
  }
  bind('#setSkyLight', 'change', (t) => { settings.skyLight = t.value; lastGlowA = -1; });
  bind('#setLong', 'change', (t) => { settings.longExposure = t.checked; });
  bind('#set3d', 'change', (t) => { settings.view3d = t.checked; if (t.checked) askMotion(); });
  bind('#setSign', 'change', (t) => { settings.signVideos = t.checked; });
  bind('#setSkyline', 'change', (t) => { settings.skyline = t.checked; drawCity(); });
  bind('#setSound', 'change', (t) => { settings.sound = t.checked; Sound.resume(); Sound.apply(); });
  bind('#setVolume', 'input', (t) => { settings.volume = +t.value; Sound.apply(); });
  $('#setFull').addEventListener('click', toggleFullscreen);
  $('#btnHide').addEventListener('click', toggleUi);
  $('#setReset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS);
    if (mode !== 'card') palette = basePalette();
    saveSettings(); resize(); Sound.apply(); syncSettingsUi(); syncViewToggle(); syncWorld3d();
    toast('Settings reset');
  });

  function openDrawer() { updateHomeTiles(); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  $('#btnIntroSettings').addEventListener('click', openDrawer); // the home screen's own way in
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    const which = b.dataset.close;
    if (which === 'settings') closeDrawer(); else if (which === 'cardModal') closeCardModal(); else closeSheet($('#' + which));
  }));
  stage.addEventListener('pointerdown', closeDrawer);

  // ---------- Photo & video ----------
  // inFrame: called from the frame loop (recording), where a scene drawn this frame can be copied as it is.
  function composite(g, w, h, inFrame = false) {
    if (launch.sequence) {
      if (arOn) drawCamera(g, w, h);
      else if (w3dShown()) drawWorld3d(g, w, h, inFrame);
      else { g.fillStyle = '#020309'; g.fillRect(0, 0, w, h); }
      for (const c of [skyC, flightC, moonC, fxC, glowC, cityC, floorC, itemsC, paintC, gfxC]) {
        if (c === fxC) drawGlow(g, w / W, h / H); // #skyGlow sits just under #fx
        if ((c === skyC || c === moonC) && arOn) continue;
        if (c === glowC && !layerShown.get(glowC)) continue; // hidden while empty
        if ((c === skyC || c === moonC || c === flightC || c === cityC || c === floorC) && w3dShown()) continue;
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
      const [dx, dy] = layerShift(d), px = dx + arPan.x, py = dy + arPan.y;
      g.drawImage(c, (w - w * s) / 2 + (px * w) / W, (h - h * s) / 2 + (py * h) / H, w * s, h * s);
    };
    if (arOn) drawCamera(g, w, h);
    else if (w3dShown()) drawWorld3d(g, w, h, inFrame);
    else { layer(skyC, VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky)); layer(moonC, VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky)); }
    drawGlow(g, w / W, h / H);
    layer(fxC, VIEW_DEPTH.fx);
    if (layerShown.get(glowC)) layer(glowC, VIEW_DEPTH.fx);
    if (!w3dShown()) { layer(cityC, VIEW_DEPTH.city, layerScale(VIEW_DEPTH.city)); g.drawImage(floorC, 0, 0, w, h); }
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
    cardEl.querySelectorAll('p').forEach((n) => { if (!n.hidden && n.getClientRects().length) drawTextEl(g, n); }); // laid out only: the reason pages hide the rest
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
    drawBrandMark(g, c.width / W);
    c.toBlob((b) => { if (b) { download(b, 'light-up-the-skies.png'); toast('Photo saved'); } }, 'image/png');
  }
  // The same mark as on recorded videos (#recMark): the app's icon, name and where to get it, bottom-left.
  function drawBrandMark(g, k) {
    const icon = $('#recMark img'), pad = 14 * k, h = 40 * k, x = pad, y = g.canvas.height - pad - h;
    g.save();
    g.font = `700 ${13 * k}px Cinzel, Georgia, serif`;
    const name = 'Light Up the Skies', get = inLang('Get it on Google Play');
    const tw = Math.max(g.measureText(name).width, (g.font = `500 ${10.5 * k}px Outfit, sans-serif`, g.measureText(get).width));
    const w = 6 * k + 28 * k + 8 * k + tw + 12 * k;
    g.fillStyle = 'rgba(8,6,20,.55)'; g.strokeStyle = 'rgba(255,210,122,.35)'; g.lineWidth = k;
    roundRect(g, x, y, w, h, 14 * k); g.fill(); g.stroke();
    if (icon && icon.complete && icon.naturalWidth) g.drawImage(icon, x + 6 * k, y + 6 * k, 28 * k, 28 * k);
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffd77e'; g.font = `700 ${13 * k}px Cinzel, Georgia, serif`; g.fillText(name, x + 42 * k, y + 18 * k);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `500 ${10.5 * k}px Outfit, sans-serif`; g.fillText(get, x + 42 * k, y + 32 * k);
    g.restore();
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
  // In the app, Record and Share both record a show and open the share sheet, so only Share stays on the top bar.
  if (nativeRecorder) $('#btnRec').style.display = 'none';
  let nativeRecording = 'idle';
  let nativeRecordingReady = null;
  window.addEventListener('luts:recording', (event) => {
    const was = nativeRecording;
    nativeRecording = event.detail;
    const active = nativeRecording === 'recording';
    if (was === 'recording' && nativeRecording === 'idle') {
      setTimeout(() => adBreak('break'), 800); // a video saved: a natural break
      // A card's video is saved, however it was recorded (Save video, or the top Record/Share): its button says so
      if (mode === 'card' && currentCard) { currentCard.saved = true; markSaved(); }
    }
    document.body.classList.toggle('native-capture', active || nativeRecording === 'requesting');
    if (!active) endCardEl.hidden = true;
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
      if (nativeRecording === 'idle' && mode === 'card' && currentCard) { setShareCaption(cardCaption(currentCard)); recordShow(currentCard); return; }
      // Record on the street: the chosen cracker fires as soon as recording starts (the buttons hide while the screen records),
      // and the video stops and goes to the share sheet when the sky clears, with the greeting and the Play link.
      if (nativeRecording === 'idle' && mode === 'play' && !rush.on && launch.state === 'READY' && !shotShare) { shareShow(); return; }
      if (nativeRecording === 'idle') setShareCaption(shotCaption());
      window.LUTSAndroid.recording(nativeRecording === 'recording' ? 'stop' : 'start');
      return;
    }
    if (rec && rec.quiet) discardRecording(); // REC wins over a show's background recording
    if (!rec) { startRecording(); return; }
    // REC tapped to stop: the closing card plays for a moment first (a tap during it stops once it has shown).
    const r = rec;
    if (!settings.signVideos) { stopRecording(); return; }
    if (!r.outro) r.outro = performance.now();
    setTimeout(() => { if (rec === r) stopRecording(); }, Math.max(0, 1600 - (performance.now() - r.outro)));
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
    adBreak('break'); // a video saved: a natural break (the preview waits under it)
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
    const get = getApp(c.kind === 'joy' ? 'dedication' : 'card');
    if (c.o === 'birthday') return `🎂 Happy Birthday${name ? `, ${name}` : ''}! A fireworks wish from Light Up the Skies 🎆\nMake your own: ${link}${get}`;
    return `✨ ${c.h || 'A fireworks greeting'}${name ? ` for ${name}` : ''}, made with Light Up the Skies 🎆\nMake your own: ${link}${get}`;
  }
  const shotCaption = () => {
    if (chor.on) return `🧨 I sneaked crackers past Seth-ji in Pataka Chor, Light Up the Skies 🎆\nCatch me if you can: ${appLink()}${getApp('chor')}`;
    if (document.body.classList.contains('dueling')) return `⚔️ A Sky Duel in Light Up the Skies: whose fireworks win? 🎆\nDuel me: ${appLink()}${getApp('duel')}`;
    return `🪔 Happy Diwali! I lit up the sky with Light Up the Skies 🎆\nLight yours: ${appLink()}${getApp('share')}`;
  };
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
    if (s.native) { nativeOutro(); return; }
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
      composite(active.g, active.rc.width, active.rc.height, true);
      drawDiwaliReveal(active.g, active.rc.width / W, active.rc.height / H);
      if (active.layer) active.layer(active.g, active.rc.width / W, active.rc.height / H);
      if (settings.signVideos) signVideo(active.g, active.rc.width, active.rc.height, active.outro ? (now - active.outro) / 1000 : -1);
      const sec = (now - active.start) / 1000;
      $('#recTime').textContent = `0:${String(sec | 0).padStart(2, '0')}`;
      if (!active.outro && sec >= 28.2) active.outro = now; // the cap ends on the closing card too
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
    if (outro >= 0) drawEndCard(g, w, h, clamp(outro / 0.45, 0, 1));
    g.restore();
  }

  // The closing card at fade a (0-1) over a dark wash: make your own, the app and where to get it, its link and the
  // hashtag the Page features, and the sender's rank once they have shared a few.
  function drawEndCard(g, w, h, a, wash = 0.78) {
    const u = (Math.min(w, h) / 400) * (h > w ? 1.2 : 1); // bigger on a tall (phone) video
    g.save();
    g.textBaseline = 'alphabetic';
    g.shadowBlur = 0;
    g.globalAlpha = a * wash;
    g.fillStyle = '#05061a';
    g.fillRect(0, 0, w, h);
    g.globalAlpha = a;
    const cy = h * 0.4, icon = 76 * u;
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
    g.fillText('MAKE YOUR OWN', w / 2, cy + 8 * u);
    const grad = g.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
    grad.addColorStop(0, '#ffe29a'); grad.addColorStop(0.5, '#ffb347'); grad.addColorStop(1, '#ff5fa2');
    g.fillStyle = grad;
    g.font = `800 ${(30 * u).toFixed(1)}px Cinzel, Georgia, serif`;
    g.fillText('Light Up the Skies', w / 2, cy + 44 * u, w * 0.9);
    g.fillStyle = '#fff4e0';
    g.font = `500 ${(15 * u).toFixed(1)}px Outfit, sans-serif`;
    g.fillText(window.LUTSNative && window.LUTSNative.platform === 'ios' ? 'Free in the app' : 'Free on Google Play', w / 2, cy + 72 * u);
    const link = appLink().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (link) {
      g.fillStyle = 'rgba(255,244,224,0.8)';
      g.font = `500 ${(11.5 * u).toFixed(1)}px Outfit, sans-serif`;
      g.fillText(link, w / 2, cy + 96 * u, w * 0.92);
    }
    g.fillStyle = '#ffd77e';
    g.font = `700 ${(18 * u).toFixed(1)}px Outfit, sans-serif`;
    g.fillText(TAG, w / 2, cy + (link ? 128 : 104) * u);
    const r = rankOf(lights());
    if (r[0] > 0) {
      g.fillStyle = '#c9c6e6';
      g.font = `500 ${(12 * u).toFixed(1)}px Outfit, sans-serif`;
      g.fillText(`${r[1]} Sent by a ${r[2]} light-bringer`, w / 2, cy + (link ? 156 : 132) * u);
    }
    g.restore();
  }
  // In the Android app the screen itself is recorded, so the closing card goes on the screen for the video's last
  // moments (over everything, and it takes the taps), then the recording stops. With "Sign videos" off it just stops.
  const endCardEl = $('#endCard');
  function nativeOutro(ms = 1800) {
    if (nativeRecording !== 'recording') return;
    const stop = () => { if (nativeRecording === 'recording') window.LUTSAndroid.recording('stop'); };
    if (!settings.signVideos) { setTimeout(stop, 800); return; }
    const k = Math.min(2, window.devicePixelRatio || 1), w = Math.round(innerWidth * k), h = Math.round(innerHeight * k);
    endCardEl.width = w; endCardEl.height = h; endCardEl.hidden = false;
    const g = endCardEl.getContext('2d'), t0 = performance.now();
    const paint = (now) => {
      if (endCardEl.hidden) return;
      g.clearRect(0, 0, w, h);
      drawEndCard(g, w, h, clamp((now - t0) / 350, 0, 1), 0.94);
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    setTimeout(stop, ms);
  }

  // ---------- Greeting cards ----------
  // show: the card show's shells (TYPES ids): left, right, centre, then the pair that closes it. dates: the moving
  // festivals' days for 2026-2028 (lunar, so a panchang may differ by a day); on: a fixed [month, day], or the nth
  // Sunday as [month, 0, n]. Both feed the Upcoming row; a festival past its table simply leaves that row.
  const OCCASIONS = [
    { id: 'birthday', label: '🎂 Birthday', head: 'Happy Birthday', msg: 'Wishing you a year full of light, laughter and wonderful surprises.', theme: 'rainbow', show: ['peony', 'peony', 'kaleido', 'star'] },
    { id: 'newyear', label: '🎉 New Year', head: 'Happy New Year', msg: 'May the year ahead sparkle as brightly as these skies.', theme: 'gold', show: ['crossette', 'crossette', 'kamuro', 'strobe'], on: [1, 1] },
    { id: 'diwali', label: '🪔 Diwali', head: 'Happy Diwali', msg: 'May the festival of lights fill your home with joy, peace and prosperity.', theme: 'gold', show: ['willow', 'willow', 'kamuro', 'palm'], dates: ['2026-11-08', '2027-10-29', '2028-10-17'] },
    { id: 'christmas', label: '🎄 Christmas', head: 'Merry Christmas', msg: 'Warm wishes for a season full of peace, love and a little magic.', theme: 'festive', show: ['star', 'star', 'chrysanthemum', 'crackle'], on: [12, 25] },
    { id: 'love', label: '💖 Love', head: 'I Love You', msg: 'You light up my sky every single day.', theme: 'rose', show: ['heart', 'heart', 'peony', 'heart'] },
    { id: 'anniversary', label: '💍 Anniversary', head: 'Happy Anniversary', msg: 'Here’s to every year we have shared, and all the ones still to come.', theme: 'rose', show: ['heart', 'heart', 'ring', 'heart'] },
    { id: 'congrats', label: '🏆 Congrats', head: 'Congratulations', msg: 'You did it! The whole sky is celebrating you tonight.', theme: 'rainbow', show: ['crossette', 'crossette', 'kaleido', 'star'] },
    { id: 'thanks', label: '🙏 Thank you', head: 'Thank You', msg: 'For everything you do, this show is for you.', theme: 'ocean' },
    { id: 'custom', label: '✨ Custom', head: 'Hello', msg: '', theme: 'classic' },
    { id: 'holi', label: '🎨 Holi', head: 'Happy Holi', msg: 'May your life be as bright and colourful as the colours of Holi.', theme: 'rainbow', show: ['peony', 'peony', 'kaleido', 'peony'], dates: ['2026-03-04', '2027-03-22', '2028-03-10'] },
    { id: 'pongal', label: '🌾 Pongal / Sankranti', head: 'Happy Pongal', msg: 'May this harvest festival fill your home with sweetness, sunshine and plenty.', theme: 'gold', show: ['palm', 'palm', 'chrysanthemum', 'willow'], dates: ['2026-01-14', '2027-01-15', '2028-01-15'], on: [1, 14] },
    { id: 'onam', label: '🌼 Onam', head: 'Happy Onam', msg: 'Wishing you a happy Onam full of flowers, feasts and family.', theme: 'gold', show: ['chrysanthemum', 'chrysanthemum', 'kaleido', 'peony'], dates: ['2026-08-26', '2027-09-12', '2028-09-01'] },
    // Eid al-Fitr and Eid al-Adha, by the moon (a day either way where it is sighted).
    { id: 'eid', label: '🌙 Eid', head: 'Eid Mubarak', msg: 'May this Eid bring you peace, happiness and countless blessings. Eid Mubarak!', theme: 'gold', show: ['star', 'star', 'ring', 'crackle'], dates: ['2026-03-20', '2026-05-27', '2027-03-10', '2027-05-17', '2028-02-27', '2028-05-05'] },
    { id: 'navratri', label: '💃 Navratri', head: 'Happy Navratri', msg: 'May the nine nights of Navratri bring you strength, joy and blessings.', theme: 'rainbow', show: ['kaleido', 'kaleido', 'peony', 'butterfly'], dates: ['2026-10-11', '2027-09-30', '2028-09-20'] },
    { id: 'durgapuja', label: '🔱 Durga Puja', head: 'Happy Durga Puja', msg: 'May Maa Durga bless you with strength, joy and prosperity. Shubho Durga Puja!', theme: 'festive', show: ['chrysanthemum', 'chrysanthemum', 'kamuro', 'palm'], dates: ['2026-10-18', '2027-10-07', '2028-09-27'] },
    { id: 'rakhi', label: '🎀 Raksha Bandhan', head: 'Happy Raksha Bandhan', msg: 'Here’s to the bond that grows stronger every year. Happy Raksha Bandhan!', theme: 'rainbow', show: ['ring', 'ring', 'kaleido', 'heart'], dates: ['2026-08-28', '2027-08-17', '2028-08-04'] },
    { id: 'bhaidooj', label: '🪔 Bhai Dooj', head: 'Happy Bhai Dooj', msg: 'May the bond between us keep shining like a diya. Happy Bhai Dooj!', theme: 'gold', show: ['willow', 'willow', 'chrysanthemum', 'heart'], dates: ['2026-11-11', '2027-10-31', '2028-10-19'] },
    { id: 'karwachauth', label: '🌕 Karwa Chauth', head: 'Happy Karwa Chauth', msg: 'May the moonlight bless your bond with love, trust and togetherness.', theme: 'rose', show: ['ring', 'ring', 'kamuro', 'heart'], dates: ['2026-10-29', '2027-10-18', '2028-10-07'] },
    { id: 'ganesh', label: '🐘 Ganesh Chaturthi', head: 'Ganpati Bappa Morya', msg: 'May Lord Ganesha remove every obstacle and fill your life with joy. Happy Ganesh Chaturthi!', theme: 'gold', show: ['chrysanthemum', 'chrysanthemum', 'kaleido', 'kamuro'], dates: ['2026-09-14', '2027-09-04', '2028-08-23'] },
    { id: 'wedding', label: '💒 Wedding', head: 'Happy Married Life', msg: 'Wishing you both a lifetime of love, laughter and happily ever after.', theme: 'rose', show: ['heart', 'heart', 'ring', 'kamuro'] },
    { id: 'baby', label: '👶 New baby', head: 'Welcome, Little One', msg: 'Congratulations on your little bundle of joy! Wishing your family endless love.', theme: 'ocean', show: ['star', 'star', 'butterfly', 'smile'] },
    { id: 'housewarming', label: '🏡 Housewarming', head: 'Happy New Home', msg: 'May your new home be filled with love, laughter and many happy memories.', theme: 'gold', show: ['palm', 'palm', 'chrysanthemum', 'willow'] },
    { id: 'graduation', label: '🎓 Graduation', head: 'Congrats, Graduate', msg: 'You did it! Wishing you a bright future full of success.', theme: 'gold', show: ['star', 'star', 'crossette', 'strobe'] },
    { id: 'newjob', label: '💼 New job', head: 'Congrats on the Job', msg: 'Congratulations on your new job! They are lucky to have you.', theme: 'ocean', show: ['crossette', 'crossette', 'kaleido', 'star'] },
    { id: 'retirement', label: '🌅 Retirement', head: 'Happy Retirement', msg: 'Congratulations on your retirement! Here’s to days of rest, joy and new adventures.', theme: 'gold', show: ['willow', 'willow', 'kamuro', 'palm'] },
    { id: 'goodluck', label: '🍀 Good luck', head: 'Good Luck', msg: 'Wishing you all the luck in the world. You’ve got this!', theme: 'festive', show: ['star', 'star', 'crossette', 'wand'] },
    { id: 'sorry', label: '💐 Sorry', head: 'I’m Sorry', msg: 'I’m sorry. I hope this little sky helps say what words could not.', theme: 'ocean', show: ['peony', 'peony', 'horsetail', 'heart'] },
    { id: 'missyou', label: '💌 Miss you', head: 'Miss You', msg: 'Missing you more than words can say. This sky is for you.', theme: 'ocean', show: ['horsetail', 'horsetail', 'willow', 'heart'] },
    { id: 'getwell', label: '🌻 Get well', head: 'Get Well Soon', msg: 'Sending you healing wishes and a sky full of light. Get well soon!', theme: 'festive', show: ['butterfly', 'butterfly', 'peony', 'smile'] },
    { id: 'justbecause', label: '🌈 Just because', head: 'Thinking of You', msg: 'No reason at all. You just deserve a sky full of light.', theme: 'rainbow', show: ['butterfly', 'butterfly', 'kaleido', 'smile'] },
    { id: 'mothersday', label: '💐 Mother’s Day', head: 'Happy Mother’s Day', msg: 'Thank you for your endless love and care. Happy Mother’s Day!', theme: 'rose', show: ['heart', 'heart', 'peony', 'butterfly'], on: [5, 0, 2] },
    { id: 'independence', label: '🇮🇳 Independence Day', head: 'Happy Independence Day', msg: 'Free skies, bright hearts. Jai Hind!', theme: 'tricolor', show: ['peony', 'willow', 'peony', 'star'], on: [8, 15] },
    { id: 'fathersday', label: '👔 Father’s Day', head: 'Happy Father’s Day', msg: 'Thank you for your strength, your guidance and your love. Happy Father’s Day!', theme: 'ocean', show: ['crossette', 'crossette', 'palm', 'star'], on: [6, 0, 3] },
    { id: 'friendship', label: '🤝 Friendship Day', head: 'Happy Friendship Day', msg: 'Thank you for being my friend through every up and down. Happy Friendship Day!', theme: 'rainbow', show: ['smile', 'smile', 'kaleido', 'heart'], on: [8, 0, 1] },
    { id: 'teachersday', label: '📚 Teachers’ Day', head: 'Happy Teachers’ Day', msg: 'Thank you for teaching, guiding and believing in us. Happy Teachers’ Day!', theme: 'gold', show: ['star', 'star', 'chrysanthemum', 'wand'], on: [9, 5] },
    { id: 'valentine', label: '💘 Valentine’s Day', head: 'Happy Valentine’s Day', msg: 'You are my favourite person in the whole sky. Happy Valentine’s Day!', theme: 'rose', show: ['heart', 'heart', 'peony', 'heart'], on: [2, 14] },
  ];
  // The chips' order, grouped like a greeting site's occasions; Diwali leads the festivals. Custom comes last, on its own.
  const OCC_CATS = [
    { id: 'fest', label: 'Festivals', ids: ['diwali', 'holi', 'pongal', 'onam', 'eid', 'christmas', 'navratri', 'durgapuja', 'rakhi', 'bhaidooj', 'karwachauth', 'ganesh', 'newyear'] },
    { id: 'life', label: 'Life', ids: ['birthday', 'anniversary', 'wedding', 'baby', 'housewarming', 'graduation', 'newjob', 'retirement', 'goodluck'] },
    { id: 'feel', label: 'Feelings', ids: ['love', 'thanks', 'sorry', 'missyou', 'getwell', 'congrats', 'justbecause'] },
    { id: 'days', label: 'Special days', ids: ['mothersday', 'fathersday', 'independence', 'friendship', 'teachersday', 'valentine'] },
  ];
  const SHOW_DEFAULT = ['chrysanthemum', 'chrysanthemum', 'kamuro', 'heart']; // Thank you, Custom and Light someone up
  const TEMPLATE_HEADS = new Set(OCCASIONS.map((o) => o.head));
  const TEMPLATE_MSGS = new Set(OCCASIONS.map((o) => o.msg));
  // Who they are to you, grouped like a greeting site's recipients (k: the group's label, shown before its first chip).
  // g: whose message ideas fit. Picking one fills an empty name with its word, except Anyone and Someone special.
  const RELATIONS = [
    { id: 'anyone', word: 'Anyone', g: 'any', emoji: '✨' },
    { id: 'special', word: 'Someone special', g: 'special', emoji: '💖' },
    { id: 'mom', word: 'Mom', g: 'parent', emoji: '👩', k: 'Family' },
    { id: 'dad', word: 'Dad', g: 'parent', emoji: '👨' },
    { id: 'grandma', word: 'Grandma', g: 'grandparent', emoji: '👵' },
    { id: 'grandpa', word: 'Grandpa', g: 'grandparent', emoji: '👴' },
    { id: 'brother', word: 'Brother', g: 'sibling', emoji: '👦' },
    { id: 'sister', word: 'Sister', g: 'sibling', emoji: '👧' },
    { id: 'son', word: 'Son', g: 'child', emoji: '👦' },
    { id: 'daughter', word: 'Daughter', g: 'child', emoji: '👧' },
    { id: 'aunt', word: 'Aunt', g: 'relative', emoji: '👩' },
    { id: 'uncle', word: 'Uncle', g: 'relative', emoji: '👨' },
    { id: 'cousin', word: 'Cousin', g: 'relative', emoji: '🧑' },
    { id: 'wife', word: 'Wife', g: 'partner', emoji: '👰', k: 'Partner' },
    { id: 'husband', word: 'Husband', g: 'partner', emoji: '🤵' },
    { id: 'partner', word: 'Partner', g: 'partner', emoji: '💑' },
    { id: 'friend', word: 'Friend', g: 'friend', emoji: '🤗', k: 'Friends' },
    { id: 'bestie', word: 'Best friend', g: 'friend', emoji: '💛' },
    { id: 'teacher', word: 'Teacher', g: 'teacher', emoji: '📚', k: 'Work & school' },
    { id: 'colleague', word: 'Colleague', g: 'work', emoji: '💼' },
    { id: 'boss', word: 'Boss', g: 'work', emoji: '👔' },
  ];
  const REL_BY_ID = new Map(RELATIONS.map((r) => [r.id, r])); // a Map: a link's rel can't reach an object's built-ins
  const relOf = (c) => REL_BY_ID.get(c.rel) || RELATIONS[0];
  const fillsName = (r) => r.g !== 'any' && r.g !== 'special';
  // Message ideas for when the words won't come, by occasion and by who they are to you (RELATIONS' g). 'any' is the
  // occasion's general list; "Try another message" steps through the relationship's ideas first, then those.
  const IDEAS = {
    birthday: {
      any: [
        'Another trip around the sun, and you make it brighter every time. Happy birthday!',
        'Here’s to big dreams, small joys and everything in between. Have your best year yet!',
        'Happy birthday to someone who inspires me every day. Keep shining!',
        'जन्मदिन की हार्दिक शुभकामनाएँ! आपका हर दिन रोशनी और खुशियों से भरा रहे।',
        'இனிய பிறந்தநாள் வாழ்த்துகள்! உங்கள் வாழ்வு என்றும் ஒளியும் மகிழ்ச்சியும் நிறைந்ததாக இருக்கட்டும்.',
      ],
      parent: [
        'Happy birthday! Thank you for every early morning, every packed tiffin and every prayer you said for me.',
        'I love that you still worry about me like I’m five. Wishing you a year as warm as your hugs.',
        'Everything good in me started with you. Happy birthday, with all my love.',
      ],
      grandparent: [
        'Happy birthday! Your stories, your blessings and your laddoos make our whole family shine.',
        'Thanks for always having time for me, a hug and something sweet. Wishing you good health and joy.',
        'I love the way the whole house lights up when you laugh. Happy birthday, with love from all of us.',
      ],
      partner: [
        'Happy birthday, my love. I love that I get to celebrate you today and every day after.',
        'You make ordinary days feel like festivals. Here’s to you, and to many more birthdays together.',
        'Thanks for always holding my hand, even on the hard days. Happy birthday to my favourite person.',
      ],
      child: [
        'Happy birthday! Watching you grow has been the greatest joy of our lives.',
        'I love your big heart, your bright laugh and your wild ideas. Never stop being you.',
        'However tall you grow, you will always be our little star. Happy birthday!',
      ],
      sibling: [
        'Happy birthday to my first friend, my partner in crime and my forever back-up.',
        'Thanks for always taking my side, even when I didn’t deserve it. Have the best birthday!',
        'From fighting over the remote to sharing every secret, life is more fun with you. Happy birthday!',
      ],
      relative: [
        'Happy birthday! Family get-togethers are always brighter with you in them.',
        'Thank you for the love, the laughter and the second helpings. Wishing you a wonderful year.',
        'Sending you lots of love and blessings on your birthday. May the year ahead be kind to you.',
      ],
      friend: [
        'Happy birthday to the friend who always picks up the phone. Let’s make this year legendary.',
        'I love that we can talk for hours or sit in comfortable silence. Have the best birthday, my friend!',
        'Thanks for every laugh, every late-night chat and every cup of chai. Happy birthday!',
      ],
      teacher: [
        'Happy birthday! Thank you for believing in us, even when we didn’t believe in ourselves.',
        'Wishing a very happy birthday to the teacher who made learning feel like an adventure.',
        'Your patience and kindness stay with us long after class. Have a wonderful birthday!',
      ],
      work: [
        'Happy birthday! Working with you makes even Mondays better. Have a fantastic day.',
        'Wishing you a brilliant birthday and a year full of wins, big and small.',
        'Thanks for the help, the ideas and the good humour. Enjoy your special day!',
      ],
      special: [
        'Happy birthday to someone who makes my world brighter just by being in it.',
        'I love the way you smile when you’re truly happy. I hope today gives you plenty of reasons.',
        'The sky is lighting up for you tonight, because you deserve every bit of it. Happy birthday!',
      ],
    },
    newyear: {
      any: [
        'New year, new sky, same wonderful you. Wishing you joy all year long.',
        'May every month of the new year bring a new reason to celebrate.',
        'नया साल मुबारक! यह साल आपके लिए ढेर सारी खुशियाँ और सफलता लेकर आए।',
        'இனிய புத்தாண்டு வாழ்த்துகள்! இந்த ஆண்டு உங்களுக்கு மகிழ்ச்சியும் வெற்றியும் தரட்டும்.',
      ],
      parent: [
        'Happy New Year! Thank you for another year of love, advice and home-cooked food. I’m so lucky to be yours.',
        'May this year bring you rest, good health and every bit of the happiness you give us.',
      ],
      grandparent: [
        'Happy New Year! May this year bring you good health, peaceful days and lots of visits from all of us.',
        'Your blessings carry us through every year. Wishing you a joyful new year.',
      ],
      partner: [
        'Another year of us, and I’d choose you again every single day. Happy New Year, my love.',
        'Here’s to new adventures, old jokes and a whole year of holding hands.',
      ],
      child: [
        'Happy New Year! We can’t wait to see all the amazing things you do this year.',
        'Dream big, be kind and keep shining. We’re proud of you, always.',
      ],
      sibling: [
        'Happy New Year! Here’s to another year of inside jokes, snack raids and having each other’s back.',
        'New year, same us. Thanks for always being my favourite person to call.',
      ],
      relative: [
        'Happy New Year to you and the whole family! May the year ahead be full of good news and get-togethers.',
        'Wishing you health, happiness and plenty of reasons to celebrate this year.',
      ],
      friend: [
        'Happy New Year! Thanks for making last year so much fun. Let’s make this one even better.',
        'New year, new plans, same old friendship. Here’s to more laughs and long chats.',
      ],
      teacher: [
        'Happy New Year! Thank you for all you taught us. Wishing you a peaceful and happy year ahead.',
        'May the new year bring you as much joy as you bring to your students.',
      ],
      work: [
        'Happy New Year! Here’s to great teamwork and a year full of success.',
        'Wishing you a happy, healthy new year. It’s a pleasure working with you.',
      ],
      special: [
        'Happy New Year! I hope this year brings you everything that makes your heart smile.',
        'Starting the year thinking of you. May it be your brightest one yet.',
      ],
    },
    diwali: {
      any: [
        'May a thousand diyas light your path to happiness this Diwali.',
        'Wishing you sweets, sparkle and the warmth of family this Diwali.',
        'दीपावली की हार्दिक शुभकामनाएँ! आपका घर खुशियों, सुख और समृद्धि से जगमगाता रहे।',
        'இனிய தீபாவளி நல்வாழ்த்துகள்! உங்கள் இல்லம் மகிழ்ச்சியாலும் வளத்தாலும் ஒளிரட்டும்.',
      ],
      parent: [
        'Every diya I light reminds me of the home you made for us. Happy Diwali, with all my love.',
        'Thank you for the rangoli mornings, the sweets and the blessings. Diwali will always mean you.',
        'Wishing you a Diwali full of peace, good health and the warmth you have always given us.',
      ],
      grandparent: [
        'Happy Diwali! Your stories and blessings make every festival feel complete.',
        'Thank you for teaching us the prayers, the recipes and the joy of Diwali. Wishing you good health.',
        'May this Diwali bring you good health and happy days. Our festival is brighter because of you.',
      ],
      partner: [
        'Happy Diwali, my love. With you beside me, every diya burns a little brighter.',
        'I love lighting the diyas with you. Here’s to many more Diwalis side by side.',
        'You are the light of our home. Wishing you a Diwali full of joy and sweet moments.',
      ],
      child: [
        'Happy Diwali! You bring more light to our home than all the diyas put together.',
        'May this Diwali bring you success, happiness and plenty of sweets. We’re so proud of you.',
        'Watching you light your first diya is still one of our favourite memories. Happy Diwali!',
      ],
      sibling: [
        'From fighting over the last laddoo to bursting crackers together, Diwali is always better with you.',
        'Happy Diwali! Thanks for being my partner in every rangoli, every prank and every celebration.',
        'Miss our childhood Diwalis? Me too. Wishing you light, laughter and lots of sweets.',
      ],
      relative: [
        'Happy Diwali to you and the whole family! May your home glow with joy and togetherness.',
        'Wishing you a Diwali full of sweets, sparkle and family time. Hope to see you soon!',
        'May the festival of lights bring you good health, prosperity and many happy moments.',
      ],
      friend: [
        'Happy Diwali! Friends like you are the real sparkle of the festival.',
        'Sending you sweets, sparkle and a sky full of good wishes this Diwali.',
        'Thanks for always bringing the light, on Diwali and every day. Have a wonderful festival!',
      ],
      teacher: [
        'Happy Diwali! Thank you for lighting the lamp of learning in all of us.',
        'Wishing you and your family a peaceful, joyful Diwali. Thank you for your guidance.',
        'May this Diwali bring you as much light as you bring to your classroom.',
      ],
      work: [
        'Happy Diwali! Wishing you and your family joy, prosperity and a well-earned break.',
        'May this Diwali bring new success and bright beginnings. It’s great working with you.',
        'Sending warm Diwali wishes to you and your loved ones. Have a sparkling festival!',
      ],
      special: [
        'Happy Diwali! Some people make the world brighter, and you are one of them.',
        'This Diwali I’m lighting a diya just for you. May it bring you all the joy you deserve.',
        'Wishing you a Diwali as warm and bright as your smile.',
      ],
    },
    christmas: {
      any: ['May your home be merry, your heart be light and your sky full of stars.', 'Sending you warmth, wonder and a sleigh full of joy this Christmas.'],
      parent: [
        'Merry Christmas! Thank you for every cake, every carol and all the love you put into our home.',
        'The best gift I ever got is a family like ours. Wishing you a peaceful Christmas.',
      ],
      grandparent: [
        'Merry Christmas! Your hugs and your stories are the best part of the season.',
        'Wishing you a warm, joyful Christmas and good health in the year ahead. We love you.',
      ],
      partner: [
        'Merry Christmas, my love. You’re the only gift I need under the tree.',
        'Every Christmas with you feels like the cosiest one yet. Merry Christmas to my favourite person.',
      ],
      child: [
        'Merry Christmas! You make every season magical for us.',
        'Wishing you a Christmas full of fun, presents and plum cake. We love you to the stars and back.',
      ],
      sibling: [
        'Merry Christmas! Thanks for being the best part of every family holiday.',
        'Here’s to cake, carols and fighting over the last present. Merry Christmas!',
      ],
      relative: [
        'Merry Christmas to you and the whole family! May your home be full of joy and good cheer.',
        'Wishing you peace, love and a lovely Christmas with your loved ones.',
      ],
      friend: [
        'Merry Christmas! Thanks for being the kind of friend who feels like family.',
        'Sending you cake, cheer and a sky full of stars this Christmas.',
      ],
      teacher: [
        'Merry Christmas! Thank you for your patience and kindness all year long.',
        'Wishing you a restful holiday and a joyful Christmas with your loved ones.',
      ],
      work: [
        'Merry Christmas! Thanks for being a wonderful teammate this year.',
        'Wishing you a joyful Christmas and a relaxing break. You’ve earned it!',
      ],
      special: [
        'Merry Christmas! Thinking of you and wishing you all the warmth of the season.',
        'May your Christmas be as lovely as you are.',
      ],
    },
    // Love, for family and work: the affection of a family, or thanks and respect.
    love: {
      any: ['Every firework tonight is a reason I love you.', 'With you, every ordinary day feels like a celebration.'],
      parent: [
        'I love that I can still come to you with anything, big or small. Thank you for loving me always.',
        'You taught me what love means without ever saying a word. I love you so much.',
      ],
      grandparent: [
        'I love the way your face lights up when we walk in. You are the heart of our family.',
        'Thank you for loving all of us so generously. We love you more than words can say.',
      ],
      partner: [
        'I love the way you laugh at my worst jokes. You light up my sky every single day.',
        'With you, home is a feeling, not a place. I love you.',
      ],
      child: [
        'I love watching you grow into such a kind and brave person. You are our whole world.',
        'Wherever life takes you, you will always have our love waiting at home.',
      ],
      sibling: [
        'We may fight, but I love you more than I admit. Thanks for always being there.',
        'I love that you know me better than anyone. So lucky to have you as family.',
      ],
      relative: [
        'Sending you lots of love. Our family is richer because you are in it.',
        'I love the warmth you bring to every family gathering. Thank you for being you.',
      ],
      friend: [
        'I love that you always know when I need a call. Grateful for you, my friend.',
        'Friends like you are rare. Thanks for always being in my corner.',
      ],
      teacher: [
        'With love and respect: thank you for caring about us as if we were your own.',
        'Your kindness taught us more than any lesson. We are so grateful for you.',
      ],
      work: [
        'Sending a little appreciation your way. You make every day at work better.',
        'Thank you for your kindness and support. It means more than you know.',
      ],
      special: [
        'You make my days lighter and my smiles bigger. Thank you for being you.',
        'I love the way the world feels a little brighter when you are around.',
      ],
    },
    // Anniversary: their wedding for family, years in the job at work.
    anniversary: {
      any: ['Happy anniversary to the couple who make love look easy.', 'Another year of us. My favourite story keeps getting better.'],
      parent: [
        'Happy anniversary to you both! Thank you for showing us what a home full of love looks like.',
        'So many years of sharing chai, dreams and worries. Happy anniversary to my favourite couple.',
      ],
      grandparent: [
        'Happy anniversary! So many years together and still each other’s best friend.',
        'Your love story is the root of our whole family. Wishing you both many more happy years.',
      ],
      partner: [
        'Happy anniversary, my love. I would choose you all over again, every single time.',
        'Every year with you is my favourite year. Happy anniversary to us.',
      ],
      child: [
        'Happy anniversary to you both! Watching your love grow fills our hearts with joy.',
        'Wishing you a lifetime of laughter, patience and togetherness. Happy anniversary!',
      ],
      sibling: [
        'Happy anniversary to you two! Thanks for making our family bigger and happier.',
        'Wishing you both many more years of love, laughter and arguing over the TV remote.',
      ],
      relative: [
        'Happy anniversary! Wishing you both many more years of togetherness and joy.',
        'May your love keep growing stronger every year. Warm wishes to you both.',
      ],
      friend: [
        'Happy anniversary to my favourite couple! Here’s to many more years of you two.',
        'Seeing you two together always makes me smile. Wishing you a wonderful anniversary.',
      ],
      teacher: [
        'Wishing you a very happy anniversary and many more years of togetherness.',
        'Happy anniversary! May your home always be full of the warmth you share with us.',
      ],
      work: [
        'Happy work anniversary! The team is lucky to have you. Here’s to many more years.',
        'Congratulations on another year! Your hard work and kindness make a real difference.',
      ],
      special: [
        'Happy anniversary! Every year with you is a gift I never stop being grateful for.',
        'Here’s to us, to every memory we’ve made and every one still waiting.',
      ],
    },
    congrats: {
      any: ['All that hard work paid off. So proud of you!', 'Here’s to this milestone and all the ones still to come.'],
      parent: [
        'Congratulations! You always cheered for me, and now it’s my turn to cheer for you.',
        'So proud of you! You show us it’s never too late to chase a dream.',
      ],
      grandparent: [
        'Congratulations! You keep showing us how to live life to the fullest.',
        'So happy for you! Your blessings always bring us luck, and today we celebrate you.',
      ],
      partner: [
        'I’m so proud of you, my love. Watching you shine is my favourite thing.',
        'You worked so hard for this. Congratulations, and let’s celebrate tonight!',
      ],
      child: [
        'Congratulations! We always knew you could do it. We are so proud of you.',
        'All those late nights paid off. Keep reaching for the stars!',
      ],
      sibling: [
        'Congratulations! I always knew you were the clever one (don’t tell anyone I said that).',
        'So proud of you! Now, where is my treat?',
      ],
      relative: [
        'Congratulations! The whole family is so proud of you.',
        'Wonderful news! Wishing you many more successes ahead.',
      ],
      friend: [
        'Congratulations! Nobody deserves this more than you. So proud of you!',
        'You did it! Let’s celebrate, and I’ll bring the sweets.',
      ],
      teacher: [
        'Congratulations! Your students are cheering for you today.',
        'Well deserved! Thank you for inspiring us with your dedication.',
      ],
      work: [
        'Congratulations! Your hard work truly paid off. Well deserved.',
        'Great achievement! It’s inspiring to work alongside you.',
      ],
      special: [
        'Congratulations! I’m so proud of you and everything you’ve worked for.',
        'Seeing your dream come true makes me so happy. Congratulations!',
      ],
    },
    thanks: {
      any: [
        'Thank you for the lovely wishes! Sending a sky full of light right back to you.',
        'You made my day. Thank you from the bottom of my heart.',
        'दिल से धन्यवाद! आपकी शुभकामनाओं ने मेरा दिन रोशन कर दिया।',
        'மனமார்ந்த நன்றி! உங்கள் வாழ்த்துகள் என் நாளை ஒளிரச் செய்தன.',
      ],
      parent: [
        'Thank you for every sacrifice you never talked about. I see them all, and I love you.',
        'Thanks for always being my safe place. I couldn’t have done any of it without you.',
      ],
      grandparent: [
        'Thank you for your blessings, your stories and your endless patience with all of us.',
        'Thanks for always saving the best sweets for me. I’m so grateful for you.',
      ],
      partner: [
        'Thanks for the tea when I’m tired and the listening when I’m stressed. I’m so grateful for you.',
        'Thank you for choosing me, every day. My life is brighter with you.',
      ],
      child: [
        'Thank you for making us laugh, making us proud and making our house a home.',
        'Thanks for being so thoughtful. You make our hearts so happy.',
      ],
      sibling: [
        'Thanks for always having my back, even when I didn’t ask.',
        'Thank you for keeping all my secrets. Nobody could ask for a better sibling.',
      ],
      relative: [
        'Thank you for always making us feel so welcome. It means the world to us.',
        'Thanks for your love and support. Our family is lucky to have you.',
      ],
      friend: [
        'Thanks for always showing up, no questions asked. I’m lucky to call you my friend.',
        'Thank you for every laugh, every chat and every time you cheered me on.',
      ],
      teacher: [
        'Thank you for your patience, your guidance and for never giving up on us.',
        'Thanks for teaching us so much more than what was in the books.',
      ],
      work: [
        'Thank you for your help and support. Working with you makes everything easier.',
        'Thanks for always being ready to lend a hand. It doesn’t go unnoticed.',
      ],
      special: [
        'Thank you for being exactly who you are. You make my world kinder.',
        'Thanks for all the little things you do that mean so much.',
      ],
    },
    custom: {
      any: ['Thinking of you today. This sky is for you.', 'Just because you deserve fireworks.', 'Sending you a little light, wherever you are.'],
      parent: [
        'Just a little sky to say I love you and I’m thinking of you.',
        'No reason at all, except that you are the best. Love you always.',
      ],
      grandparent: [
        'Thinking of you today and sending a sky full of love and blessings back to you.',
        'Just because: we love you, and we miss your stories.',
      ],
      partner: [
        'No special reason. I just wanted to light up the sky for you.',
        'Thinking of you, as always. You make every day better.',
      ],
      child: [
        'Just a little reminder that we love you and we’re always proud of you.',
        'Thinking of you today. Keep shining, wherever you are.',
      ],
      sibling: [
        'Just checking in to say you’re my favourite. Don’t tell the others.',
        'Missing you! This sky is all yours.',
      ],
      relative: [
        'Thinking of you and sending lots of love to the whole family.',
        'Just a little light to say hello, and that we miss you.',
      ],
      friend: [
        'No reason, just a sky full of light for a great friend.',
        'Thinking of you today. Let’s catch up soon!',
      ],
      teacher: [
        'Just a little sky to say thank you for everything you taught me.',
        'Thinking of you with gratitude and respect.',
      ],
      work: [
        'A small thank-you for being such a great person to work with.',
        'Wishing you a great day. Keep doing what you do!',
      ],
      special: [
        'Some people make life sweeter just by being in it. You are one of them.',
        'I made this sky because you came to mind, and that always makes me smile.',
      ],
    },
    // ----- Festivals -----
    holi: {
      any: ['Wishing you a Holi full of colour, laughter and gujiyas.'],
      parent: [
        'Happy Holi! Thank you for filling our home with colour, sweets and so much love.',
        'May this Holi bring you joy, good health and a face full of gulal.',
      ],
      grandparent: [
        'Happy Holi! Your blessings are the brightest colour in our family.',
        'Wishing you a gentle, happy Holi full of sweets and family visits.',
      ],
      partner: [
        'Happy Holi, my love. You are every colour in my life.',
        'I’d choose you to colour my world, this Holi and every one after.',
      ],
      child: [
        'Happy Holi! Play safe, laugh loud and come home colourful.',
        'You are the brightest colour in our lives. Happy Holi!',
      ],
      sibling: [
        'Happy Holi! Ready for revenge for last year’s water balloon?',
        'From pichkari battles to sharing gujiyas, Holi is best with you.',
      ],
      relative: [
        'Happy Holi to the whole family! May your home be full of colour and laughter.',
        'Wishing you a joyful Holi, plenty of sweets and lots of family fun.',
      ],
      friend: [
        'Happy Holi! Let’s get colourful and make memories, my friend.',
        'No one plays Holi like you do. Wishing you a bright, crazy, colourful day!',
      ],
      teacher: [
        'Happy Holi! Thank you for adding so much colour to our learning.',
        'Wishing you and your family a safe, joyful and colourful Holi.',
      ],
      work: [
        'Happy Holi! Wishing you and your family a bright and colourful festival.',
        'May this Holi bring fresh energy and bright new beginnings.',
      ],
      special: [
        'Happy Holi! You add colour to my days without even trying.',
        'Of all the colours this Holi, your smile is my favourite.',
      ],
    },
    pongal: {
      any: [
        'Pongalo Pongal! May your pot overflow with happiness this year.',
        'Happy Makar Sankranti! May your kites fly high and your year be sweet.',
      ],
      parent: [
        'Happy Pongal! Thank you for every harvest of love you have given our family.',
        'May the sun bless you with good health and a sweet, happy year.',
      ],
      grandparent: [
        'Happy Pongal! Your stories make every festival feel like home.',
        'Wishing you good health, warm sunshine and plenty of sweet pongal.',
      ],
      partner: [
        'Happy Pongal, my love. Life with you is my sweetest harvest.',
        'May our home overflow with joy, just like the pongal pot.',
      ],
      child: [
        'Happy Pongal! May your year overflow with happiness and success.',
        'Fly your kite high and dream even higher. Happy Sankranti!',
      ],
      sibling: [
        'Happy Pongal! Still remember fighting over the first spoon of sakkarai pongal?',
        'From kites on the terrace to sweets in the kitchen, the festival is best with you.',
      ],
      relative: [
        'Happy Pongal to the whole family! May your fields and hearts be full.',
        'Wishing you a sweet Sankranti and a year of good harvests.',
      ],
      friend: [
        'Happy Pongal! Wishing you sweet days, bright sun and a year full of plenty.',
        'Kites, sweets and good friends: that’s my perfect Sankranti. Have a great one!',
      ],
      teacher: ['Happy Pongal! Thank you for sowing the seeds of learning in us.'],
      work: [
        'Happy Pongal! May this harvest season bring you success and prosperity.',
        'Wishing you and your family a sweet and happy Sankranti.',
      ],
      special: ['Happy Pongal! May your year be as sweet as you are.'],
    },
    onam: {
      any: ['May King Mahabali bless your home with peace, plenty and happiness. Onam ashamsakal!'],
      parent: [
        'Happy Onam! Every pookalam and every sadya reminds me of the home you made for us.',
        'Wishing you a peaceful Onam, good health and a table full of your favourite dishes.',
      ],
      grandparent: [
        'Happy Onam! Your stories of Mahabali made every festival magical for us.',
        'Wishing you good health and a joyful Onam with all of us around you.',
      ],
      partner: [
        'Happy Onam, my love. Every festival is sweeter sitting next to you at the sadya.',
        'You are the brightest flower in my pookalam. Onam ashamsakal!',
      ],
      child: [
        'Happy Onam! May your life bloom as beautifully as a pookalam.',
        'Wishing you a joyful Onam and a year full of good things.',
      ],
      sibling: [
        'Happy Onam! Remember racing to collect flowers for the pookalam?',
        'The sadya always tastes better with you stealing my payasam. Happy Onam!',
      ],
      relative: [
        'Happy Onam to the whole family! May your home be full of flowers and laughter.',
        'Wishing you a grand sadya and a festival full of togetherness.',
      ],
      friend: [
        'Happy Onam! Save me some payasam, my friend.',
        'Wishing you flowers, feasts and fun this Onam. Onam ashamsakal!',
      ],
      teacher: ['Happy Onam! Wishing you and your family peace, prosperity and joy.'],
      work: [
        'Happy Onam! May this season bring you prosperity and happy days.',
        'Wishing you and your family a wonderful Onam and a delicious sadya.',
      ],
      special: ['Happy Onam! May your days bloom as brightly as a pookalam.'],
    },
    eid: {
      any: ['Wishing you and your family a joyful Eid, full of love, feasts and sweet moments.'],
      parent: [
        'Eid Mubarak! Thank you for every prayer and every blessing you have given us.',
        'May Allah bless you with good health, peace and happiness. Eid Mubarak!',
      ],
      grandparent: [
        'Eid Mubarak! Your duas are the greatest blessing in our family.',
        'Wishing you a peaceful Eid, good health and a home full of family.',
      ],
      partner: [
        'Eid Mubarak, my love. You are my answered prayer.',
        'Wishing us a lifetime of Eids together, full of love and blessings.',
      ],
      child: [
        'Eid Mubarak! May your life be filled with blessings, kindness and success.',
        'Wishing you a happy Eid, full of new clothes, sweets and Eidi!',
      ],
      sibling: [
        'Eid Mubarak! Who’s getting the bigger Eidi this year?',
        'Wishing you a blessed Eid. Every celebration is better with you.',
      ],
      relative: [
        'Eid Mubarak to the whole family! May your home be full of joy and blessings.',
        'Wishing you a blessed Eid full of feasts, family and happy moments.',
      ],
      friend: [
        'Eid Mubarak, my friend! Save some biryani for me.',
        'May this Eid bring you peace, joy and every blessing you wish for.',
      ],
      teacher: ['Eid Mubarak! Wishing you and your family peace, joy and blessings.'],
      work: [
        'Eid Mubarak! Wishing you and your family a peaceful, joyful celebration.',
        'May this Eid bring you happiness and success. Eid Mubarak!',
      ],
      special: ['Eid Mubarak! May your heart be as full as this sky tonight.'],
    },
    navratri: {
      any: ['Wishing you nine nights of devotion, dance and happiness.'],
      parent: [
        'Happy Navratri! You are the strength of our family, every day of the year.',
        'May Maa Durga bless you with good health, peace and happiness.',
      ],
      grandparent: [
        'Happy Navratri! Thank you for teaching us the prayers and the stories.',
        'May the Goddess bless you with good health and joy this Navratri.',
      ],
      partner: [
        'Happy Navratri, my love. Let’s dance the garba together all nine nights.',
        'May the Goddess bless our home with love, strength and happiness.',
      ],
      child: [
        'Happy Navratri! May the Goddess bless you with courage and wisdom.',
        'Dance your heart out at garba tonight. Happy Navratri!',
      ],
      sibling: [
        'Happy Navratri! Ready for nine nights of garba and dandiya?',
        'May Maa Durga bless you with all the strength you need. Happy Navratri!',
      ],
      relative: [
        'Happy Navratri to the whole family! May your home be full of blessings.',
        'Wishing you nine nights of joy, devotion and celebration.',
      ],
      friend: [
        'Happy Navratri! See you on the garba floor, my friend.',
        'May the nine nights bring you nine reasons to smile.',
      ],
      teacher: ['Happy Navratri! May the Goddess of learning bless you always.'],
      work: [
        'Happy Navratri! May this festival bring you strength and success.',
        'Wishing you and your family a blessed and joyful Navratri.',
      ],
      special: ['Happy Navratri! May every night of the festival bring you joy.'],
    },
    durgapuja: {
      any: ['Wishing you pandal hopping, bhog and happy days with loved ones.'],
      parent: [
        'Shubho Durga Puja! You are the strength of our family, just like Maa.',
        'Wishing you a joyful Pujo, good health and lots of happy days.',
      ],
      grandparent: [
        'Shubho Durga Puja! Your blessings make every Pujo complete.',
        'Wishing you good health and a peaceful, joyful Pujo.',
      ],
      partner: [
        'Shubho Durga Puja, my love. Pandal hopping is always better with you.',
        'May Maa Durga bless our home with love and happiness.',
      ],
      child: [
        'Shubho Durga Puja! May Maa bless you with courage and success.',
        'Enjoy every pandal, every bhog and every new outfit this Pujo!',
      ],
      sibling: [
        'Shubho Durga Puja! Same pandal hopping plan as every year?',
        'May Maa Durga bless you with strength and joy. Pujo is best with you.',
      ],
      relative: [
        'Shubho Durga Puja to the whole family! See you at the pandal.',
        'Wishing you a Pujo full of adda, bhog and happy moments.',
      ],
      friend: [
        'Shubho Pujo! Let’s go pandal hopping and eat everything.',
        'Wishing you a Durga Puja full of fun, food and dhunuchi dancing.',
      ],
      teacher: ['Shubho Durga Puja! Wishing you and your family peace and joy.'],
      work: [
        'Shubho Durga Puja! Wishing you a joyful festival and a happy break.',
        'May Maa Durga bless you with success and prosperity.',
      ],
      special: ['Shubho Durga Puja! May Maa bless you with every happiness.'],
    },
    // Raksha Bandhan and Bhai Dooj are about brothers and sisters: the rest wish them through their siblings.
    rakhi: {
      any: ['A thread of love, a promise of care. Happy Raksha Bandhan!'],
      sibling: [
        'Happy Raksha Bandhan! Thank you for always protecting me, even from myself.',
        'You annoy me, you defend me and you know all my secrets. Happy Rakhi!',
        'No distance can loosen this thread. Happy Raksha Bandhan!',
      ],
      relative: [
        'Happy Raksha Bandhan! You have always been like my own sibling.',
        'Wishing you a Rakhi full of sweets and happy memories.',
      ],
      parent: ['Happy Raksha Bandhan! Thank you for raising us to always stand by each other.'],
      grandparent: ['Happy Raksha Bandhan! Thank you for the blessings you give us on every Rakhi.'],
      child: ['Happy Raksha Bandhan! Seeing you look out for each other fills our hearts.'],
      partner: ['Happy Raksha Bandhan to you and your siblings, my love. We are lucky to have them.'],
      friend: ['Happy Raksha Bandhan! You’re the sibling I got to choose.'],
      teacher: ['Happy Raksha Bandhan! Wishing you and your family a happy festival.'],
      work: ['Happy Raksha Bandhan! Wishing you and your family a joyful festival.'],
      special: ['Happy Raksha Bandhan! May the bonds you cherish grow stronger every year.'],
    },
    bhaidooj: {
      any: ['Wishing you a Bhai Dooj full of love, sweets and blessings.'],
      sibling: [
        'Happy Bhai Dooj! I pray for your long life and happiness, today and always.',
        'Thank you for every tilak, every sweet and every time you stood by me.',
      ],
      relative: ['Happy Bhai Dooj! You have always been like my own sibling.'],
      parent: ['Happy Bhai Dooj! Thank you for teaching us to love and care for each other.'],
      grandparent: ['Happy Bhai Dooj! Thank you for your blessings on this festival of siblings.'],
      child: ['Happy Bhai Dooj! Watching you cherish each other is our greatest joy.'],
      partner: ['Happy Bhai Dooj to you and your siblings, my love.'],
      friend: ['Happy Bhai Dooj! You are family to me, always.'],
      teacher: ['Happy Bhai Dooj! Wishing you and your family love and happiness.'],
      work: ['Happy Bhai Dooj! Wishing you and your family a joyful festival.'],
      special: ['Happy Bhai Dooj! May your family bonds grow stronger every year.'],
    },
    // Karwa Chauth is a wife's fast for her husband: the others wish the couple.
    karwachauth: {
      any: ['Wishing you a blessed Karwa Chauth and a love that shines like the moon.'],
      partner: [
        'Happy Karwa Chauth, my love. You are my moon, my sky and my everything.',
        'Every year with you is a blessing. Thank you for your love and your prayers.',
      ],
      parent: ['Happy Karwa Chauth! Your love for each other inspires all of us.'],
      grandparent: ['Happy Karwa Chauth! Your years of love are the best blessing for our family.'],
      child: ['Happy Karwa Chauth! Wishing you both a lifetime of love and happiness.'],
      sibling: ['Happy Karwa Chauth! Wishing you and your partner a lifetime of love.'],
      relative: ['Happy Karwa Chauth! Wishing you both love, health and happiness.'],
      friend: ['Happy Karwa Chauth! May the moon rise early for you tonight.'],
      teacher: ['Wishing you a blessed Karwa Chauth and a home full of love.'],
      work: ['Wishing you a blessed Karwa Chauth and a home full of happiness.'],
      special: ['Happy Karwa Chauth! May your love shine as bright as tonight’s moon.'],
    },
    ganesh: {
      any: ['Wishing you wisdom, prosperity and plenty of modaks this Ganesh Chaturthi.'],
      parent: [
        'Happy Ganesh Chaturthi! May Bappa bless you with good health and happiness.',
        'Thank you for every modak and every prayer. Ganpati Bappa Morya!',
      ],
      grandparent: [
        'Happy Ganesh Chaturthi! Your blessings and Bappa’s keep our family safe.',
        'Wishing you good health and peace this Ganesh Chaturthi.',
      ],
      partner: [
        'Happy Ganesh Chaturthi, my love. May Bappa bless our home with joy.',
        'Welcoming Bappa home is sweetest when it’s with you.',
      ],
      child: [
        'Happy Ganesh Chaturthi! May Bappa bless you with wisdom and success.',
        'May Bappa clear every obstacle on your path. Ganpati Bappa Morya!',
      ],
      sibling: [
        'Happy Ganesh Chaturthi! Don’t eat all the modaks before the aarti this time.',
        'May Bappa bless you with everything you wish for.',
      ],
      relative: [
        'Happy Ganesh Chaturthi to the whole family! Ganpati Bappa Morya!',
        'May Bappa bless your home with peace and prosperity.',
      ],
      friend: [
        'Ganpati Bappa Morya! Wishing you joy, wisdom and lots of modaks.',
        'May Bappa bless you with new beginnings and success.',
      ],
      teacher: ['Happy Ganesh Chaturthi! May Lord Ganesha, the giver of wisdom, bless you always.'],
      work: [
        'Happy Ganesh Chaturthi! May Bappa bring you success in every new beginning.',
        'Wishing you and your family a blessed Ganesh Chaturthi.',
      ],
      special: ['Happy Ganesh Chaturthi! May Bappa bless you with every happiness.'],
    },
    // ----- Life -----
    wedding: {
      any: ['Two hearts, one journey. Congratulations on your wedding!'],
      parent: ['Your love story is the one we all look up to. Congratulations on this beautiful day!'],
      grandparent: ['Thank you for blessing this wedding with your love. It means the world to us.'],
      partner: [
        'Today I married my best friend. Here’s to forever, my love.',
        'I can’t wait to spend every day of my life with you. Happy wedding day!',
      ],
      child: [
        'Congratulations, my dear! May your married life be full of love and laughter.',
        'We are so proud of you both. Wishing you a lifetime of happiness together.',
      ],
      sibling: [
        'Congratulations! I’m so happy for you, and I get a new family member too.',
        'From sharing a room to seeing you get married: I love you. Happy married life!',
      ],
      relative: [
        'Congratulations to the lovely couple! Wishing you a lifetime of happiness.',
        'Wishing you both love, laughter and a home full of joy.',
      ],
      friend: [
        'Congratulations, my friend! You two are perfect together.',
        'Wishing you a lifetime of adventures, inside jokes and love.',
      ],
      teacher: ['Congratulations on your wedding! Wishing you both a lifetime of happiness.'],
      work: [
        'Congratulations on your wedding! Wishing you both a wonderful life together.',
        'Best wishes to you both on your new journey together.',
      ],
      special: ['Congratulations! May your love grow brighter every year.'],
    },
    baby: {
      any: ['A tiny new star has arrived. Congratulations to the proud family!'],
      parent: ['Congratulations, new grandparents! This little one is so lucky to have you.'],
      grandparent: ['Congratulations, great-grandparents! Our family keeps growing with love.'],
      partner: [
        'Thank you for our beautiful baby. I love you more than ever.',
        'Our family just got bigger, and my heart did too.',
      ],
      child: [
        'Congratulations on becoming a parent! We are so proud of you.',
        'Watching you hold your baby is a moment we will never forget.',
      ],
      sibling: [
        'Congratulations! I can’t wait to spoil my new niece or nephew.',
        'You’re going to be an amazing parent. So happy for you!',
      ],
      relative: [
        'Congratulations on the new arrival! Wishing your little one health and happiness.',
        'Welcome to the family, little one! We can’t wait to meet you.',
      ],
      friend: [
        'Congratulations, my friend! Your baby is lucky to have you.',
        'Welcome to the world, little one. Your parents are the best.',
      ],
      teacher: ['Congratulations on your little one! Wishing your family endless joy.'],
      work: [
        'Congratulations on your new arrival! Wishing you joy and plenty of sleep.',
        'Welcome to the little one! Wishing your family all the happiness.',
      ],
      special: ['Congratulations! May your little one bring you endless joy.'],
    },
    housewarming: {
      any: ['New walls, new doors, same wonderful you. Congratulations on your new home!'],
      parent: [
        'Congratulations on the new home! I can’t wait to fill it with family visits.',
        'May your new home be as warm as the one you gave us.',
      ],
      grandparent: ['Congratulations on your new home! May it be blessed with peace and happiness.'],
      partner: [
        'Our first home together. Here’s to a lifetime of memories inside these walls.',
        'Home is wherever you are, and now it has a front door too.',
      ],
      child: [
        'Congratulations on your new home! We’re so proud of you.',
        'May your new home bring you comfort, joy and success.',
      ],
      sibling: [
        'Congratulations on the new place! I’m claiming the guest room.',
        'Your own home at last! So happy for you.',
      ],
      relative: [
        'Congratulations on your new home! May it bring your family much happiness.',
        'Wishing you peace, prosperity and joy in your new home.',
      ],
      friend: [
        'Congratulations on the new home! When’s the party?',
        'May your new home be full of good food, good friends and good times.',
      ],
      teacher: ['Congratulations on your new home! Wishing you many happy days in it.'],
      work: [
        'Congratulations on your new home! Wishing you happy days ahead.',
        'May your new home bring you comfort and joy.',
      ],
      special: ['Congratulations on your new home! May every room be full of happiness.'],
    },
    graduation: {
      any: ['All that hard work paid off. The sky is the limit now!'],
      parent: ['Congratulations on your graduation! You show us it’s never too late to learn.'],
      grandparent: ['Congratulations on your graduation! You inspire us all.'],
      partner: [
        'I’m so proud of you, graduate! The whole sky is cheering for you.',
        'All those late nights were worth it. Congratulations, my love!',
      ],
      child: [
        'Congratulations, graduate! We are so proud of everything you have achieved.',
        'The world is waiting for you. Go and shine!',
      ],
      sibling: [
        'Congratulations, graduate! Now you can finally pay for the snacks.',
        'So proud of you! You worked so hard for this.',
      ],
      relative: [
        'Congratulations on your graduation! The whole family is proud of you.',
        'Wishing you every success in the next chapter.',
      ],
      friend: [
        'Congratulations, graduate! We survived the exams. Let’s celebrate!',
        'So proud of you! Here’s to everything that comes next.',
      ],
      teacher: ['Thank you for helping us reach this day. We couldn’t have done it without you.'],
      work: [
        'Congratulations on your graduation! Wishing you every success ahead.',
        'Well done on this big achievement!',
      ],
      special: ['Congratulations! I’m so proud of you and excited for what comes next.'],
    },
    newjob: {
      any: ['New job, new desk, new adventures. Wishing you every success!'],
      parent: ['Congratulations on your new job! You never stop inspiring me.'],
      grandparent: ['Congratulations on your new role! You keep showing us how it’s done.'],
      partner: [
        'So proud of you, my love! They have no idea how lucky they are.',
        'New job, same amazing you. Let’s celebrate tonight!',
      ],
      child: [
        'Congratulations on your new job! We are so proud of you.',
        'Your hard work paid off. Go and show them what you can do!',
      ],
      sibling: [
        'Congratulations on the new job! So, when is my treat?',
        'So proud of you! They hired the best one in the family.',
      ],
      relative: [
        'Congratulations on your new job! The whole family is proud of you.',
        'Wishing you success and happiness in your new role.',
      ],
      friend: [
        'Congratulations on the new job! They are lucky to have you, my friend.',
        'Go and rock that new job! So proud of you.',
      ],
      teacher: ['Congratulations on your new role! Your new students are lucky to have you.'],
      work: [
        'Congratulations on your new job! We will miss you here.',
        'Wishing you every success in your new role. Stay in touch!',
      ],
      special: ['Congratulations on your new job! I knew you could do it.'],
    },
    retirement: {
      any: ['No more alarms! Wishing you a happy, healthy retirement.'],
      parent: [
        'Happy retirement! After all your hard work for us, it’s your time to relax.',
        'Thank you for every working day you gave for our family. Enjoy every moment now.',
      ],
      grandparent: ['Happy retirement! Now there’s more time for stories and visits.'],
      partner: [
        'Happy retirement, my love! Let’s start our next adventure together.',
        'You worked so hard for so long. Now let’s enjoy every day together.',
      ],
      child: ['Congratulations on your retirement! We’re so proud of everything you achieved.'],
      sibling: ['Happy retirement! Time to finally enjoy life. You’ve earned it.'],
      relative: [
        'Happy retirement! Wishing you good health and many happy years ahead.',
        'Congratulations on your retirement! Enjoy every relaxing moment.',
      ],
      friend: [
        'Happy retirement, my friend! Now you have no excuse to miss our get-togethers.',
        'Here’s to long mornings, good books and endless chai. Happy retirement!',
      ],
      teacher: [
        'Happy retirement! Thank you for the years you gave to your students.',
        'Your lessons will live on in all of us. Enjoy your well-earned rest.',
      ],
      work: [
        'Happy retirement! It has been a privilege working with you.',
        'Thank you for everything you taught us. Enjoy your next chapter!',
      ],
      special: ['Happy retirement! May every day ahead feel like a holiday.'],
    },
    goodluck: {
      any: ['Believe in yourself, because I believe in you. Good luck!'],
      parent: ['Good luck! You have always believed in me; now I believe in you.'],
      grandparent: ['Good luck! Sending you all our love and blessings.'],
      partner: [
        'Good luck, my love. I’ll be cheering for you every step of the way.',
        'You are ready for this. I’m so proud of you, whatever happens.',
      ],
      child: [
        'Good luck! Do your best, and remember we are proud of you no matter what.',
        'You have worked so hard. Go and shine!',
      ],
      sibling: [
        'Good luck! You’ve got this, and I’ve got your back.',
        'Go and show them what our family is made of. Good luck!',
      ],
      relative: [
        'Best of luck! The whole family is cheering for you.',
        'Wishing you success and good luck in everything ahead.',
      ],
      friend: [
        'Good luck, my friend! You are going to do brilliantly.',
        'Breathe, smile and go for it. I’m cheering for you!',
      ],
      teacher: ['Good luck! Thank you for always helping us believe in ourselves.'],
      work: [
        'Good luck! You’ve got the skills, the drive and the whole team behind you.',
        'Wishing you the very best of luck. You’ve got this!',
      ],
      special: ['Good luck! I’m sending you all the good vibes in the world.'],
    },
    // ----- Feelings -----
    sorry: {
      any: ['I was wrong, and I’m truly sorry. You mean a lot to me.'],
      parent: [
        'I’m sorry for what I said. You deserve better from me, and I love you.',
        'Sorry for worrying you. Thank you for always forgiving me.',
      ],
      grandparent: ['I’m sorry I haven’t visited enough. I think of you every day.'],
      partner: [
        'I’m sorry, my love. You matter more to me than being right.',
        'I hate it when we fight. Can we make up under these fireworks?',
      ],
      child: [
        'I’m sorry. Even parents get it wrong sometimes, and I love you so much.',
        'I’m sorry I was upset. Nothing changes how proud I am of you.',
      ],
      sibling: [
        'Sorry! You can have the last laddoo this time.',
        'I’m sorry. Life’s too short to stay angry, and you’re my favourite.',
      ],
      relative: ['I’m sorry. I truly value you and our family bond.'],
      friend: [
        'I’m sorry, my friend. I miss us. Can we talk?',
        'I messed up, and I’m sorry. Our friendship means everything to me.',
      ],
      teacher: ['I’m sorry for my behaviour. Thank you for your patience with me.'],
      work: [
        'I’m sorry about what happened. I value working with you.',
        'My apologies. I’ll do better, and I appreciate your patience.',
      ],
      special: ['I’m sorry. I’d light up the whole sky just to see you smile again.'],
    },
    missyou: {
      any: ['The miles between us don’t change a thing. Thinking of you.'],
      parent: [
        'Missing you and your cooking. Can’t wait to come home.',
        'No matter how far I go, home is wherever you are. Miss you!',
      ],
      grandparent: [
        'Missing your stories and your hugs. See you very soon.',
        'I miss you! Sending you love until I can visit.',
      ],
      partner: [
        'Missing you every minute we’re apart. Come back soon, my love.',
        'The sky looks bigger without you. Counting the days.',
      ],
      child: [
        'Missing you so much! The house is too quiet without you.',
        'Thinking of you every day. Call us soon!',
      ],
      sibling: [
        'Miss you! Nobody annoys me quite like you do.',
        'Home isn’t the same without you. Come back soon!',
      ],
      relative: ['Missing you and the whole family. Let’s meet soon!'],
      friend: [
        'Miss you, my friend! Let’s plan a catch-up soon.',
        'Our chats are the best part of my week. Missing you!',
      ],
      teacher: ['Missing your classes! Thank you for everything you taught me.'],
      work: ['The office isn’t the same without you. Hope you’re well!'],
      special: ['Missing you. I hope this sky reaches you wherever you are.'],
    },
    getwell: {
      any: ['Rest up and feel better soon. Thinking of you.'],
      parent: [
        'Get well soon! You take care of everyone; now let us take care of you.',
        'Sending you all my love and strength. Rest well and feel better soon.',
      ],
      grandparent: [
        'Get well soon! Our home isn’t the same without your laughter.',
        'Sending you love and prayers for a speedy recovery.',
      ],
      partner: [
        'Get well soon, my love. I’ll be right here with soup and hugs.',
        'Rest, heal and let me look after you. Feel better soon.',
      ],
      child: [
        'Get well soon! Rest up, and you’ll be back to your bright self in no time.',
        'Sending you a big hug and lots of love. Feel better soon!',
      ],
      sibling: [
        'Get well soon! I won’t even steal the remote while you rest.',
        'Feel better soon. It’s too quiet without you bossing me around.',
      ],
      relative: [
        'Get well soon! Wishing you a quick and smooth recovery.',
        'Thinking of you and wishing you good health soon.',
      ],
      friend: [
        'Get well soon, my friend! I miss your laugh.',
        'Rest up and feel better soon. Our next outing is on me.',
      ],
      teacher: ['Get well soon! We miss you in class.'],
      work: [
        'Get well soon! Take all the rest you need.',
        'Wishing you a speedy recovery. The team is thinking of you.',
      ],
      special: ['Get well soon! Sending you light and warmth until you feel better.'],
    },
    justbecause: {
      any: ['Just because you make the world a little brighter.'],
      parent: [
        'Just because: thank you for being you. I love you.',
        'No special day needed to say you are the best.',
      ],
      grandparent: ['Just because we love you and think of you every day.'],
      partner: [
        'Just because I love you, today and every day.',
        'No reason. I just wanted to make you smile.',
      ],
      child: [
        'Just because we love you more than all the stars.',
        'A little sky to remind you how proud we are of you.',
      ],
      sibling: [
        'Just because you’re my favourite. Don’t let it go to your head.',
        'No reason, just a sky for my partner in crime.',
      ],
      relative: ['Just because family is everything. Sending love!'],
      friend: [
        'Just because you’re awesome, my friend.',
        'A random sky for a not-so-random friend.',
      ],
      teacher: ['Just because you made such a difference to me. Thank you.'],
      work: ['Just because you make work better. Have a great day!'],
      special: ['Just because you came to mind, and you made me smile.'],
    },
    // ----- Special days -----
    independence: {
      any: ['Free skies, bright hearts. Happy Independence Day! Jai Hind!'],
      parent: ['Happy Independence Day! You taught me to love this country and stand tall.'],
      grandparent: ['Happy Independence Day! Thank you for the stories of the freedom you lived through.'],
      partner: ['Happy Independence Day! Free to dream, and dreaming with you.'],
      child: ['Happy Independence Day! May you grow up proud, free and kind.'],
      sibling: ['Happy Independence Day! Kites, flags and you: the best kind of holiday.'],
      relative: ['Happy Independence Day to our whole family! Jai Hind!'],
      friend: ['Happy Independence Day, friend! Here’s to freedom, and to us.'],
      teacher: ['Happy Independence Day! Thank you for teaching us to think freely.'],
      work: ['Happy Independence Day to the team! Proud to build with you.'],
      special: ['Happy Independence Day! Free skies, bright hearts, and you in mine.'],
    },
    mothersday: {
      any: ['To every mother who makes the world brighter: happy Mother’s Day.'],
      parent: [
        'Happy Mother’s Day! Everything good in me started with you.',
        'Thank you for every lullaby, every lunchbox and every hug. I love you.',
      ],
      grandparent: [
        'Happy Mother’s Day to the mother of our whole family!',
        'Your love made our family. Happy Mother’s Day, with love from all of us.',
      ],
      partner: [
        'Happy Mother’s Day to the most amazing mother our children could have.',
        'Watching you love our family makes me love you even more.',
      ],
      child: [
        'Happy Mother’s Day! Watching you become a mother is our greatest joy.',
        'You are an amazing mom. We are so proud of you.',
      ],
      sibling: [
        'Happy Mother’s Day! You’re a wonderful mom, just like ours.',
        'Watching you raise your little ones makes me so proud.',
      ],
      relative: [
        'Happy Mother’s Day! Thank you for your love and care for the whole family.',
        'Wishing a wonderful mother a very happy Mother’s Day.',
      ],
      friend: [
        'Happy Mother’s Day to a wonderful mom and an even better friend.',
        'Your kids are so lucky. Happy Mother’s Day!',
      ],
      teacher: ['Happy Mother’s Day! You have cared for your students like a mother.'],
      work: ['Happy Mother’s Day! Wishing you a relaxing day with your family.'],
      special: ['Happy Mother’s Day! Your love makes the world softer.'],
    },
    fathersday: {
      any: ['To every dad who lifts us up: happy Father’s Day.'],
      parent: [
        'Happy Father’s Day! You taught me how to ride, how to try and how to never give up.',
        'Thanks for every lesson, every joke and every time you had my back. Love you.',
      ],
      grandparent: [
        'Happy Father’s Day to the head of our whole family!',
        'Your wisdom guides all of us. Happy Father’s Day, with love.',
      ],
      partner: [
        'Happy Father’s Day to the best dad our children could ask for.',
        'Watching you with our kids makes me love you even more.',
      ],
      child: [
        'Happy Father’s Day! You have become such a wonderful dad.',
        'We are so proud of the father you are. Happy Father’s Day!',
      ],
      sibling: [
        'Happy Father’s Day! You’re a great dad, just like ours.',
        'Your kids are lucky to have you. Happy Father’s Day!',
      ],
      relative: [
        'Happy Father’s Day! Thank you for always looking out for the family.',
        'Wishing a wonderful father a very happy Father’s Day.',
      ],
      friend: ['Happy Father’s Day to a great dad and an even better friend.'],
      teacher: ['Happy Father’s Day! Thank you for guiding us like a father.'],
      work: ['Happy Father’s Day! Wishing you a relaxing day with your family.'],
      special: ['Happy Father’s Day! Wishing you a day full of love.'],
    },
    friendship: {
      any: ['Friends make the brightest fireworks of all. Happy Friendship Day!'],
      parent: ['Happy Friendship Day! You are my parent and my first best friend.'],
      grandparent: ['Happy Friendship Day! You were my very first friend.'],
      partner: [
        'Happy Friendship Day to my partner, my love and my best friend.',
        'Before everything else, you were my friend. You still are.',
      ],
      child: ['Happy Friendship Day! Being your parent is great; being your friend is the best.'],
      sibling: [
        'Happy Friendship Day to the friend I was born with.',
        'Sibling by birth, friend by choice. Happy Friendship Day!',
      ],
      relative: ['Happy Friendship Day! Family and friend, all in one.'],
      friend: [
        'Happy Friendship Day! Thanks for every laugh, every secret and every cup of chai.',
        'Life’s better with you in it. Happy Friendship Day, my friend!',
      ],
      teacher: ['Happy Friendship Day! Thank you for being a guide and a friend.'],
      work: [
        'Happy Friendship Day! Thanks for being a friend, not just a colleague.',
        'Work is so much better with friends like you.',
      ],
      special: ['Happy Friendship Day! Thank you for being such a special friend.'],
    },
    teachersday: {
      any: ['To everyone who taught me something: thank you. Happy Teachers’ Day!'],
      teacher: [
        'Happy Teachers’ Day! You made us love learning.',
        'Thank you for your patience and kindness. Your lessons stay with us.',
      ],
      parent: [
        'Happy Teachers’ Day! You were my first and best teacher.',
        'Thank you for every lesson about life. Happy Teachers’ Day!',
      ],
      grandparent: ['Happy Teachers’ Day! Thank you for the life lessons you taught us.'],
      partner: ['Happy Teachers’ Day! You teach me something new every day.'],
      child: ['Happy Teachers’ Day! You teach us more than you know.'],
      sibling: ['Happy Teachers’ Day! Thanks for teaching me everything, even the things I shouldn’t know.'],
      relative: ['Happy Teachers’ Day! Thank you for all the wisdom you share with us.'],
      friend: ['Happy Teachers’ Day, my friend! Your students are lucky to have you.'],
      work: [
        'Happy Teachers’ Day! Thank you for mentoring me and helping me grow.',
        'Every great team has a great teacher. Thank you for being ours.',
      ],
      special: ['Happy Teachers’ Day! Thank you for everything you have taught me.'],
    },
    valentine: {
      any: ['Sending love and a sky full of hearts this Valentine’s Day.'],
      partner: [
        'Happy Valentine’s Day, my love. Every day with you feels like a festival.',
        'You still give me butterflies. Be my Valentine forever?',
      ],
      special: [
        'Will you be my Valentine?',
        'You make my heart light up like the sky tonight.',
      ],
      parent: ['Happy Valentine’s Day! You were my first love, and you always will be.'],
      grandparent: ['Happy Valentine’s Day! Your love story inspires all of us.'],
      child: ['Happy Valentine’s Day! You will always be our little love.'],
      sibling: ['Happy Valentine’s Day! You’re still my favourite, even without chocolates.'],
      relative: ['Happy Valentine’s Day! Sending lots of love to the whole family.'],
      friend: [
        'Happy Valentine’s Day! Friends are the loves that stay.',
        'Who needs roses when I have a friend like you?',
      ],
      teacher: ['Happy Valentine’s Day! Thank you for your kind heart.'],
      work: ['Happy Valentine’s Day! Wishing you a day full of love.'],
    },
  };
  for (const o of OCCASIONS) { const by = IDEAS[o.id] = IDEAS[o.id] || { any: [] }; by.any = [o.msg, ...by.any].filter(Boolean); }
  // An idea counts as untouched: a new occasion or relationship replaces it.
  Object.values(IDEAS).forEach((by) => Object.values(by).flat().forEach((m) => TEMPLATE_MSGS.add(m)));
  // Text the game writes into a field is in the player's language; either wording still counts as untouched.
  const inLang = (s) => (window.LUTSLang ? LUTSLang.t(s) : s);
  for (const set of [TEMPLATE_HEADS, TEMPLATE_MSGS]) [...set].forEach((s) => set.add(inLang(s)));
  const REL_WORDS = new Set(RELATIONS.filter(fillsName).flatMap((r) => [r.word, inLang(r.word)])); // names the game fills in
  const OCC_BY_ID = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));
  const OCC_IDS = new Set(OCCASIONS.map((o) => o.id)); // a Set: a link's o can't reach an object's built-ins
  // Reasons I light up for you: short pages the receiver turns through after the show, one reason each (LoveBook's
  // "reasons" books). Ideas by who they are to you (RELATIONS' g), in LoveBook's page kinds: an opener, qualities,
  // together time, memories, hard times, thank-yous, milestones and a closer. Free cards hold 3, Premium cards 10.
  const PAGE_LEN = 70, PAGES_FREE = 3, PAGES_MAX = 10;
  const PAGE_IDEAS = {
    any: {
      open: ['You brighten my days in so many ways. Here are a few'],
      qual: ['I love how kind you are, even when nobody is looking', 'Your smile can light up a whole room'],
      together: ['I love that every chat with you ends in laughter'],
      memory: ['I still smile when I think of the fun we’ve had'],
      hard: ['When things got hard, you were there without being asked'],
      thanks: ['Thanks for always making time for me', 'Thank you for believing in me'],
      mile: ['I’m so proud of how far you’ve come'],
      close: ['And a thousand more reasons that won’t fit here', 'Most of all, thank you for simply being you'],
    },
    special: {
      open: ['There are so many reasons you’re special. Here are a few'],
      qual: ['I love the way your eyes light up when you laugh', 'You make ordinary days feel like festivals', 'Your kindness makes the world softer'],
      together: ['I love our long talks that never feel long enough', 'Every walk with you turns into an adventure'],
      memory: ['I still remember the first time you made me laugh'],
      hard: ['When I doubted myself, you believed in me'],
      thanks: ['Thanks for always listening, even to my silly stories'],
      mile: ['I can’t wait to see all the good things coming your way'],
      close: ['You light up my sky, every single day', 'And this is only the beginning of the list'],
    },
    parent: {
      open: ['You gave me everything, so here are a few things I love about you'],
      qual: ['You taught me to be brave', 'I love how you make everyone feel at home', 'Your hugs still fix almost everything'],
      together: ['I love our cups of chai and long talks', 'Cooking with you is my favourite kind of afternoon'],
      memory: ['I still remember you waiting up for me every night', 'You never missed a single school function'],
      hard: ['When I felt like giving up, you held my hand', 'I never had to wonder if you loved me'],
      thanks: ['Thanks for every sacrifice you never talked about', 'Thank you for every prayer you said for me'],
      mile: ['Everything good in me started with you'],
      close: ['I’m proud to be your child, today and always'],
    },
    grandparent: {
      open: ['For all your stories and blessings, a few reasons I love you'],
      qual: ['Your patience is endless, and so is your love', 'You always know exactly what to say'],
      together: ['I love listening to your stories of the old days', 'Your kitchen always smells like love'],
      memory: ['I remember the sweets you slipped into my pocket', 'Afternoons at your house were the best part of childhood'],
      hard: ['When life felt confusing, your words made it simple'],
      thanks: ['Thank you for every blessing on my head', 'Thanks for teaching me the old songs and prayers'],
      mile: ['Your wisdom guides our whole family'],
      close: ['I hope I grow up to be just like you'],
    },
    sibling: {
      open: ['My partner in crime, here are some reasons you’re the best'],
      qual: ['You’re the funniest person I know, after me', 'You always take my side, even when I’m wrong'],
      together: ['I love our late-night talks and secret jokes', 'Fighting over the remote is still my favourite sport'],
      memory: ['I still laugh about the mischief we got away with as kids', 'Our childhood games are my happiest memories'],
      hard: ['When I felt alone, you showed up without a word'],
      thanks: ['Thanks for always keeping my secrets', 'Thank you for sharing your snacks, mostly'],
      mile: ['I’m so proud of the person you’ve become'],
      close: ['Lucky me, I got you for life'],
    },
    child: {
      open: ['From the day you arrived, you gave me endless reasons to smile'],
      qual: ['I love your curious mind and your big heart', 'Your laugh is the best sound in our home', 'You are braver than you know'],
      together: ['I love our silly dances in the kitchen', 'Bedtime stories with you are my favourite part of the day'],
      memory: ['I still remember holding your tiny hand for the first time'],
      hard: ['When I was tired, one hug from you made it all better'],
      thanks: ['Thank you for making me a parent', 'Thanks for teaching me to see the world with new eyes'],
      mile: ['Watching you grow is the greatest gift of my life'],
      close: ['Wherever you go, my love goes with you'],
    },
    relative: {
      open: ['Family like you makes every gathering brighter. Here’s why'],
      qual: ['You always make me feel welcome', 'Your laugh is the loudest at every family function'],
      together: ['I love our chats over festival sweets', 'Family weddings are more fun with you around'],
      memory: ['I still remember the summer holidays at your place'],
      hard: ['When I needed advice, you gave it kindly and honestly'],
      thanks: ['Thanks for always treating me like your own', 'Thank you for every gift, call and blessing'],
      mile: ['Our family is stronger because of you'],
      close: ['I’m so glad we are family'],
    },
    partner: {
      open: ['I could fill a whole book, but here are a few reasons I love you'],
      qual: ['Your laugh is my favourite sound', 'I love how you make me feel safe', 'You are my calm in every storm'],
      together: ['I love our quiet evenings, just the two of us', 'Planning trips with you is half the fun'],
      memory: ['I still remember the day I knew it was you'],
      hard: ['When I felt like giving up, you never gave up on me'],
      thanks: ['Thanks for always saving me the last bite', 'Thank you for choosing me, every single day'],
      mile: ['Building a life with you is my favourite adventure'],
      close: ['Forever wouldn’t be long enough with you', 'You are, and always will be, my home'],
    },
    friend: {
      open: ['To my favourite person to laugh with, a few reasons you’re great'],
      qual: ['You’re the most loyal friend anyone could ask for', 'I love that you’re always up for anything'],
      together: ['I love our endless voice notes and inside jokes', 'Road trips with you are the best kind of chaos'],
      memory: ['I still laugh about the day we first met'],
      hard: ['When everything went wrong, you made me laugh anyway', 'You showed up when I needed you most'],
      thanks: ['Thanks for always telling me the truth, kindly', 'Thank you for never judging me'],
      mile: ['I’ve loved watching you chase your dreams'],
      close: ['Friends forever, no matter how far apart'],
    },
    teacher: {
      open: ['You taught me so much, so here are a few reasons I’m grateful'],
      qual: ['Your patience made learning feel easy', 'I love how you made every lesson come alive'],
      together: ['Your classes were the best part of my day'],
      memory: ['I still remember the day you said I could do it'],
      hard: ['When I struggled, you never gave up on me'],
      thanks: ['Thanks for believing in me before I did', 'Thank you for answering every question, even the silly ones'],
      mile: ['Every success of mine carries a lesson from you'],
      close: ['You are the teacher everyone hopes for', 'Your lessons will stay with me for life'],
    },
    work: {
      open: ['Work is better with you around. Here are a few reasons why'],
      qual: ['You make even Monday mornings bearable', 'I admire how calm you stay under pressure'],
      together: ['I love our tea breaks and quick laughs between meetings', 'Every project with you feels like a team win'],
      memory: ['I still remember how you helped me on my first day'],
      hard: ['When deadlines piled up, you always had my back'],
      thanks: ['Thanks for always sharing what you know', 'Thank you for your patience and good humour'],
      mile: ['Your hard work inspires the whole team'],
      close: ['Lucky to work with someone like you'],
    },
  };
  // A page for the occasion itself, offered in the cycle's 'occ' turn; worded to suit anyone it is sent to.
  const PAGE_OCC = {
    birthday: ['Another year of you is the best gift for all of us', 'Every birthday, you shine a little brighter'],
    diwali: ['You bring more light than every diya this Diwali', 'Celebrating Diwali with you feels like home'],
    holi: ['You add colour to my life every single day'],
    christmas: ['You make every season feel merry and bright'],
    newyear: ['I can’t wait to share another year with you'],
    anniversary: ['Every year together is better than the one before', 'Here’s to all the years still to come'],
    wedding: ['Today begins your happily ever after', 'You two make love look easy'],
    congrats: ['You worked so hard for this, and it shows'],
    graduation: ['All those late nights of study were worth it'],
    newjob: ['They are so lucky to have you'],
    retirement: ['You earned every bit of the rest ahead'],
    getwell: ['You are stronger than anything you’re facing'],
    sorry: ['You matter more to me than being right'],
    missyou: ['Every day feels a little dimmer without you'],
    valentine: ['You make every day feel full of love'],
    mothersday: ['You show what a wonderful mom looks like'],
    fathersday: ['You show what a great dad looks like'],
    friendship: ['Every day is Friendship Day with you'],
    teachersday: ['Today the whole class says thank you'],
    rakhi: ['This bond grows stronger with every Rakhi'],
    bhaidooj: ['Bonds like yours make every festival brighter'],
    karwachauth: ['Your love and faith inspire everyone around you'],
  };
  // "✨ Suggest one" walks this cycle, so one suggestion never follows another of the same kind.
  const PAGE_CYCLE = ['open', 'qual', 'together', 'thanks', 'occ', 'memory', 'hard', 'qual', 'mile', 'close'];
  // A card's pages as a link may carry them: text only, each cleaned, empty ones dropped, at most 10.
  const pagesOf = (c) => (Array.isArray(c && c.pg) ? c.pg : []).filter((s) => typeof s === 'string').map((s) => clean(s, PAGE_LEN)).filter(Boolean).slice(0, PAGES_MAX);
  // w: the background (world id) the show plays on; '' for links made before backgrounds were part of a card.
  // imgFull: a sharper copy of the photo kept on this device for your own show and videos (never in the link).
  // id: the card's place in My Cards, so playing an edited card updates it instead of adding another (never in the link).
  // rel: who they are to you (a RELATIONS id, '' for Anyone); links made before relationships have none.
  // pg: the reason pages (PAGE_LEN each; while you write, an empty one is a page not yet filled in).
  // rm: your own reminder for the day ({ m, d, y once only, f follows a moving festival }; see rmOf), never in the link.
  const card = { id: '', o: 'birthday', t: '', f: '', rel: '', h: OCCASIONS[0].head, m: OCCASIONS[0].msg, p: OCCASIONS[0].theme, w: '', img: '', imgFull: '', pg: [], rm: null };
  // A reminder as a saved card may keep it: a real day (29 February only in a leap year when once only), else none.
  function rmOf(v) {
    if (!v || typeof v !== 'object') return null;
    const m = v.m, d = v.d, y = v.y;
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1) return null;
    if (y != null && !(Number.isInteger(y) && y >= 2000 && y <= 2200)) return null;
    if (d > new Date(y != null ? y : 2024, m, 0).getDate()) return null; // 2024: a leap year, so a yearly 29 Feb is kept
    return { m, d, ...(y != null ? { y } : {}), ...(v.f && y == null ? { f: 1 } : {}) };
  }
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
      // An occasion this version doesn't know (a newer app's link) plays as Custom, keeping its own headline and message.
      o: OCC_IDS.has(raw.o) ? raw.o : 'custom', t: clean(raw.t, 20), f: clean(raw.f, 24),
      h: clean(raw.h, 24), m: cleanMsg(raw.m, 160), p: Object.prototype.hasOwnProperty.call(PALETTES, raw.p) ? raw.p : 'rainbow', w: isWorld(raw.w) ? raw.w : '', img: '',
    };
    if (raw.lit) c.lit = 1; // a Light someone up dedication: its receiver is offered to light the sender back
    if (REL_BY_ID.has(raw.rel) && raw.rel !== 'anyone') c.rel = raw.rel; // who they are to the sender (older links: none)
    const pg = pagesOf(raw);
    if (pg.length) c.pg = pg; // reason pages (older links: none)
    if (!c.t) throw new Error('empty card');
    return c;
  }

  // The relationship's own ideas for this occasion come first, then the occasion's general ones.
  function ideasFor(c) {
    const by = IDEAS[c.o] || IDEAS.custom;
    return [...new Set([...(by[relOf(c).g] || []), ...by.any])];
  }
  // The message a new occasion or relationship starts with: the relationship's first idea, else the occasion's own.
  function firstIdea(c) {
    const g = relOf(c).g, mine = g !== 'any' && (IDEAS[c.o] || {})[g];
    return mine ? mine[0] : (OCC_BY_ID[c.o] || OCC_BY_ID.custom).msg;
  }
  const untouchedMsg = () => !card.m || TEMPLATE_MSGS.has(card.m);

  // ----- Occasions -----
  // The next day a dated occasion falls on, from midnight `from` on: its table while that lasts, then its fixed day.
  function occasionDate(o, from) {
    const next = (o.dates || []).map((s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }).find((d) => d >= from);
    if (next || !o.on) return next || null;
    const [m, d, n] = o.on;
    const onIn = (y) => (d ? new Date(y, m - 1, d) : new Date(y, m - 1, 1 + (7 - new Date(y, m - 1, 1).getDay()) % 7 + (n - 1) * 7));
    const day = onIn(from.getFullYear());
    return day >= from ? day : onIn(from.getFullYear() + 1);
  }
  // The next four festivals and days, nearest first, as LoveBook's Upcoming row has them.
  function upcomingOccasions(now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return OCCASIONS.map((o) => ({ o, date: occasionDate(o, today) })).filter((u) => u.date)
      .sort((a, b) => a.date - b.date).slice(0, 4)
      .map((u) => ({ ...u, days: Math.round((u.date - today) / 864e5) }));
  }
  const occName = (o) => o.label.replace(/^\S+\s/, '');
  function pickOccasion(o) {
    card.o = o.id;
    if (!card.h || TEMPLATE_HEADS.has(card.h)) card.h = inLang(o.head);
    if (untouchedMsg()) card.m = inLang(firstIdea(card));
    card.p = o.theme;
    fillForm();
    if (card.rm) setRemind(); // whether it follows a festival's day depends on the occasion
  }
  function occChip(o, when) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.occ = o.id;
    // Painted icon (assets/menu/glyphs, made in Google Flow), or the label's emoji if its file is missing; Thank you
    // shares the folded hands.
    const art = new Image();
    art.className = 'chip-art'; art.alt = ''; art.width = art.height = 22; art.decoding = 'async';
    art.addEventListener('error', () => { const s = document.createElement('span'); s.className = 'chip-art occ-emoji'; s.textContent = o.label.split(' ')[0]; art.replaceWith(s); }, { once: true });
    art.src = `assets/menu/glyphs/${o.id === 'thanks' ? 'grateful' : o.id}.webp`;
    const name = document.createElement('span');
    name.textContent = occName(o);
    b.append(art, name);
    if (when) { const s = document.createElement('small'); s.className = 'occ-when'; s.textContent = when; b.append(s); }
    b.addEventListener('click', () => pickOccasion(o));
    return b;
  }
  // Upcoming, rebuilt each time the creator opens (the days move on); it sits outside the grouped row, which keeps
  // every occasion exactly once.
  function renderUpcoming() {
    const box = $('#occSoon');
    box.textContent = '';
    const k = document.createElement('span'); k.className = 'rel-group'; k.textContent = 'Upcoming'; box.append(k);
    for (const u of upcomingOccasions()) box.append(occChip(u.o, u.days === 0 ? 'Today' : u.days === 1 ? 'Tomorrow' : `In ${u.days} days`));
  }
  // Every occasion in one sideways row, each category led by its label; the tabs above jump to a category and the
  // one in view stays lit. Built once, so picking one doesn't rebuild the row or lose its place.
  function renderOccasions() {
    const box = $('#occasions');
    if (!box.children.length) {
      for (const k of OCC_CATS) {
        const h = document.createElement('span'); h.className = 'rel-group'; h.dataset.cat = k.id; h.textContent = k.label; box.append(h);
        for (const id of k.ids) box.append(occChip(OCC_BY_ID[id]));
        const t = document.createElement('button');
        t.type = 'button'; t.className = 'occ-cat'; t.dataset.cat = k.id; t.textContent = k.label; t.setAttribute('aria-controls', 'occasions');
        t.addEventListener('click', () => occJump(k.id));
        $('#occCats').append(t);
      }
      box.append(occChip(OCC_BY_ID.custom));
      box.addEventListener('scroll', spyCats, { passive: true });
      spyCats();
    }
    for (const b of document.querySelectorAll('#occasions .chip, #occSoon .chip')) {
      b.classList.toggle('active', b.dataset.occ === card.o);
      b.setAttribute('aria-pressed', String(b.dataset.occ === card.o));
    }
  }
  function markCat(id) { for (const t of $('#occCats').children) t.setAttribute('aria-current', String(t.dataset.cat === id)); }
  function occJump(id) {
    const box = $('#occasions'), h = box.querySelector(`[data-cat="${id}"]`);
    box.scrollTo({ left: box.scrollLeft + h.getBoundingClientRect().left - box.getBoundingClientRect().left, behavior: reduceMotion() ? 'auto' : 'smooth' });
    markCat(id);
  }
  // Lit: the last category whose label has reached the row's first third.
  function spyCats() {
    const box = $('#occasions'), x = box.getBoundingClientRect().left + box.clientWidth / 3;
    let id = OCC_CATS[0].id;
    for (const h of box.querySelectorAll('[data-cat]')) if (h.getBoundingClientRect().left <= x) id = h.dataset.cat;
    markCat(id);
  }

  // ----- Who they are to you -----
  // Their face for a relationship: a painted portrait (assets/cards/rel, made in Google Flow), or its emoji while that
  // file isn't there (a missing one is asked for once).
  const relArt = {};
  function relFace(r, cls) {
    const emoji = () => { const s = document.createElement('span'); s.className = `${cls} rel-emoji`; s.textContent = r.emoji; return s; };
    if (relArt[r.id] === false) return emoji();
    const im = new Image();
    im.className = `${cls} rel-art`; im.alt = ''; im.decoding = 'async';
    im.addEventListener('error', () => { relArt[r.id] = false; im.replaceWith(emoji()); }, { once: true });
    im.src = `assets/cards/rel/${r.id}.webp`;
    return im;
  }
  // An avatar: a photo, a face or initials, rebuilt only when it changes (so typing a name doesn't flicker it).
  function setAvatar(node, key, make) {
    if (node.dataset.key === key) return;
    node.dataset.key = key;
    node.textContent = '';
    const v = make();
    if (typeof v === 'string') node.textContent = v; else node.append(v);
  }
  // Theirs: their photo, else their relationship's face, else initials (nobody yet: Anyone's face).
  function toAvatar(node, c) {
    const r = relOf(c), ini = initials(c.t);
    if (c.img) setAvatar(node, `p${c.img.length}${c.img.slice(-16)}`, () => { const im = new Image(); im.alt = ''; im.src = photoSrc(c.img); return im; });
    else if (c.rel || !ini) setAvatar(node, `r${r.id}`, () => relFace(r, 'av-face'));
    else setAvatar(node, `i${ini}`, () => ini);
  }
  // Picking who they are: an empty name (or one the game filled in) becomes the relation's word in your language, and an
  // untouched message becomes that relationship's first idea for the occasion. A name you typed is never changed.
  function pickRelation(r) {
    readForm();
    card.rel = r.g === 'any' ? '' : r.id;
    if (!card.t || REL_WORDS.has(card.t)) card.t = fillsName(r) ? clean(inLang(r.word), 20) : '';
    if (untouchedMsg()) card.m = inLang(firstIdea(card));
    f.to.closest('.field').classList.remove('invalid');
    fillForm();
  }
  // Who they are to you, in three tabs, each a grid of their faces: Family; Partners (Someone special first); Friends,
  // with work and school after a line, and Anyone last. Built on first use, so the portraits load only once the creator opens.
  const REL_TABS = {
    family: ['mom', 'dad', 'grandma', 'grandpa', 'brother', 'sister', 'son', 'daughter', 'aunt', 'uncle', 'cousin'],
    partners: ['special', 'wife', 'husband', 'partner'],
    friends: ['friend', 'bestie', 'teacher', 'colleague', 'boss', 'anyone'],
  };
  const relTabOf = (id) => Object.keys(REL_TABS).find((t) => REL_TABS[t].includes(id)) || 'family';
  let relTab = 'family', relShownFor = null; // the tab on show, and the relationship it last followed
  function renderRelations() {
    const box = $('#cRels');
    for (const [tab, ids] of Object.entries(REL_TABS)) {
      for (const id of ids) {
        const r = REL_BY_ID.get(id);
        if (id === 'teacher') { const k = document.createElement('span'); k.className = 'rel-group'; k.dataset.tab = tab; k.textContent = 'Work & school'; box.append(k); }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.dataset.rel = r.id; b.dataset.tab = tab;
        const word = document.createElement('span');
        word.textContent = r.word;
        b.append(relFace(r, 'chip-art'), word);
        b.addEventListener('click', () => pickRelation(r));
        box.append(b);
      }
    }
  }
  function showRelTab(tab) {
    relTab = tab;
    for (const t of $('#cRelTabs').querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    for (const n of $('#cRels').children) n.hidden = n.dataset.tab !== tab;
  }
  for (const t of document.querySelectorAll('#cRelTabs [data-tab]')) t.addEventListener('click', () => showRelTab(t.dataset.tab));
  function syncRelations() {
    if (!$('#cRels').children.length) renderRelations();
    const id = card.rel || 'anyone';
    for (const b of $('#cRels').querySelectorAll('.chip')) {
      b.classList.toggle('active', b.dataset.rel === id);
      b.setAttribute('aria-pressed', String(b.dataset.rel === id));
    }
    // A card that opens with a relationship (or a new pick) shows its tab; Anyone stays where the player is (Family at
    // first). Browsing the tabs otherwise stays where the player put it.
    if (id !== relShownFor) { relShownFor = id; showRelTab(id === 'anyone' ? relTab : relTabOf(id)); }
    else showRelTab(relTab);
  }
  // A chip far along its row (a saved card's Boss, say) slides into view.
  function showActiveChip(box) {
    const b = box.querySelector('.chip.active');
    if (!b || !box.clientWidth) return;
    const br = b.getBoundingClientRect(), xr = box.getBoundingClientRect();
    box.scrollLeft += br.left - xr.left - (xr.width - br.width) / 2;
  }
  // From → To on the written card, with who they are to the sender. Only cards that say show it (older ones look as
  // they always did), and the relationship only where their name doesn't already say it.
  const saysRel = (c, r) => c.t.toLowerCase() === r.word.toLowerCase() || c.t === inLang(r.word);
  function whoLine(node, c) {
    const r = REL_BY_ID.get(c.rel);
    node.textContent = '';
    node.hidden = !r || r.g === 'any' || (!c.f && saysRel(c, r));
    if (node.hidden) return;
    const name = (s) => { const b = document.createElement('b'); b.textContent = s; b.setAttribute('data-no-i18n', ''); return b; }; // names stay as written
    if (c.f) { const arrow = document.createElement('span'); arrow.className = 'g-arrow'; arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true'); node.append(name(c.f), arrow); }
    node.append(name(c.t));
    if (!saysRel(c, r)) { const tag = document.createElement('span'); tag.className = 'g-rel'; tag.textContent = r.word; node.append(tag); }
  }

  function fillForm() {
    f.to.value = card.t; f.from.value = card.f; f.head.value = card.h; f.msg.value = card.m;
    renderOccasions();
    syncRelations();
    themeChips($('#cThemes'), card.p, (id) => { card.p = id; fillForm(); });
    renderPages();
    renderRemind();
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
    toAvatar($('#cToAv'), card);
    const mine = initials(card.f);
    setAvatar($('#cFromAv'), `i${mine}`, () => mine || '👤');
    whoLine($('#pvWho'), card);
  }
  $('#cPhoto').addEventListener('change', (e) => { processPhoto(e.target.files[0]); e.target.value = ''; });
  $('#cPhotoRemove').addEventListener('click', () => { card.img = card.imgFull = ''; updatePreview(); });
  for (const k in f) f[k].addEventListener('input', () => { f.to.closest('.field').classList.remove('invalid'); updatePreview(); });
  $('#btnMsgIdea').addEventListener('click', () => {
    const list = ideasFor(card), now = cleanMsg(f.msg.value, 160);
    card.m = inLang(list[(list.findIndex((s) => s === now || inLang(s) === now) + 1) % list.length]); // either wording is the one showing
    f.msg.value = card.m;
    updatePreview();
  });

  // ----- Their day: your own reminder (the day before, at 9 am), kept with the card in My Cards (never in the link) -----
  // Every year by default for birthdays, anniversaries, festivals and special days; just once for life's one-off days.
  const YEARLY_OCC = new Set(['birthday', 'anniversary', ...OCC_CATS.filter((k) => k.id === 'fest' || k.id === 'days').flatMap((k) => k.ids)]);
  const midnight = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // A festival on a fixed day (Christmas) can repeat on the phone; one that moves (Diwali, Mother's Day) is sent as this
  // year's day each time the game syncs.
  const movesYearly = (o) => !!(o && ((o.dates && o.dates.length) || (o.on && !o.on[1])));
  // The next day this card's reminder is for, from today on: null once a once-only day has passed.
  function nextRemind(c, now = new Date()) {
    const rm = c && c.rm, today = midnight(now);
    if (!rm) return null;
    let date = rm.f ? occasionDate(OCC_BY_ID[c.o] || {}, today) : null; // follows the festival while its table lasts
    if (!date && rm.y != null) { date = new Date(rm.y, rm.m - 1, rm.d); if (date < today) return null; }
    if (!date) {
      const on = (y) => new Date(y, rm.m - 1, rm.m === 2 && rm.d === 29 && new Date(y, 2, 0).getDate() < 29 ? 28 : rm.d);
      date = on(today.getFullYear());
      if (date < today) date = on(today.getFullYear() + 1);
    }
    return { date, days: Math.round((date - today) / 864e5) };
  }
  const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  function renderRemind() {
    const mo = $('#cRmMonth'), dy = $('#cRmDay'), rm = card.rm, next = nextRemind(card);
    if (!mo.options.length) { mo.append(new Option('No reminder', '')); MONTHS.forEach((m, i) => mo.append(new Option(m, String(i + 1)))); }
    const shown = rm && rm.f && next ? next.date : null; // a festival that moves shows this year's day
    const m = rm ? (shown ? shown.getMonth() + 1 : rm.m) : 0, d = rm ? (shown ? shown.getDate() : rm.d) : 1;
    mo.value = m ? String(m) : '';
    dy.innerHTML = '';
    for (let i = 1, n = new Date(2024, m || 1, 0).getDate(); i <= n; i++) dy.append(new Option(String(i), String(i)));
    dy.value = String(d);
    dy.disabled = !rm;
    $('#cRmYearly').disabled = !rm; // greyed until there is a day
    $('#cRmYearly').checked = !!rm && rm.y == null;
    const eve = next && new Date(next.date.getTime() - 864e5);
    const late = eve && new Date(eve.getFullYear(), eve.getMonth(), eve.getDate(), 9) < new Date(); // the phone can't remind in the past
    $('#cRmHint').textContent = !rm ? 'Pick the day, and we’ll remind you the day before.'
      : !next ? 'That day has passed. Pick another, or turn on Every year.'
        : nativeReminders() && late ? 'That’s too soon for a reminder the day before.'
        : nativeReminders() ? `We’ll remind you the day before: ${shortDate(eve)}, 9 am.` : 'Add it to your calendar for a reminder the day before.';
    $('#cRmCal').hidden = !next || nativeReminders();
  }
  // From the pickers. The first pick of a month starts on the occasion's own day when it falls in it.
  function setRemind() {
    const m = +$('#cRmMonth').value, first = !card.rm, o = OCC_BY_ID[card.o] || OCC_BY_ID.custom, today = midnight();
    if (!m) { card.rm = null; renderRemind(); if (card.id) keepMade(); return; }
    const od = occasionDate(o, today), inMonth = od && od.getMonth() + 1 === m;
    let d = first ? (inMonth ? od.getDate() : today.getMonth() + 1 === m ? today.getDate() : 1) : +$('#cRmDay').value;
    d = Math.min(d || 1, new Date(2024, m, 0).getDate());
    const yearly = first ? YEARLY_OCC.has(o.id) : $('#cRmYearly').checked;
    let y;
    if (!yearly) { // just once: the next time that day comes round (29 February: the next leap year)
      y = today.getFullYear();
      if (new Date(y, m - 1, d) < today) y++;
      while (d > new Date(y, m, 0).getDate()) y++;
    }
    card.rm = rmOf({ m, d, y, f: yearly && inMonth && od.getDate() === d });
    if (card.id) keepMade(); // a saved card's reminder changes at once
    renderRemind();
  }
  for (const id of ['#cRmMonth', '#cRmDay', '#cRmYearly']) $(id).addEventListener('change', setRemind);
  $('#cRmCal').addEventListener('click', () => {
    readForm();
    if (!card.t) { validCard(); return; }
    keepMade();
    addCardToCalendar(card.id, card);
  });

  // ----- Reasons I light up for you (the creator's list) -----
  // Rebuilt whenever the draft changes from outside (an edit, a new card, Premium bought), never while typing.
  const pageCap = () => (premium.active ? PAGES_MAX : PAGES_FREE);
  let pageTurn = 0; // where "Suggest one" is in PAGE_CYCLE
  function renderPages() {
    const box = $('#cReasons'), cap = pageCap(), n = card.pg.length;
    box.textContent = '';
    card.pg.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'reason-row';
      const num = document.createElement('span');
      num.className = 'reason-n'; num.textContent = i + 1; num.setAttribute('aria-hidden', 'true');
      const inp = document.createElement('input');
      inp.className = 'reason-input'; inp.maxLength = PAGE_LEN; inp.value = s; inp.enterKeyHint = 'done';
      inp.placeholder = 'I love that you…'; inp.setAttribute('aria-label', `Reason ${i + 1}`);
      inp.addEventListener('input', () => { card.pg[i] = clean(inp.value, PAGE_LEN); });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'row-icon reason-del'; del.setAttribute('aria-label', 'Remove this reason');
      del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
      del.addEventListener('click', () => { card.pg.splice(i, 1); renderPages(); $('#btnReasonAdd').focus(); });
      li.append(num, inp, del);
      box.append(li);
    });
    // A free card's 4th reason wears the Premium crown and opens Premium; a Premium card stops at 10.
    const add = $('#btnReasonAdd'), full = n >= cap;
    add.classList.toggle('locked', full && !premium.active);
    add.setAttribute('aria-label', full && !premium.active ? 'Add a reason (Premium)' : 'Add a reason');
    add.disabled = $('#btnReasonIdea').disabled = full && premium.active && !card.pg.some((x) => !x);
    $('#reasonCount').textContent = n ? `${n}/${cap}` : 'optional';
  }
  // Room for one more page, or the reason there isn't: Premium for a free card, a toast at Premium's 10.
  function roomForPage() {
    if (card.pg.length < pageCap()) return true;
    if (!premium.active) openPremium({ reasons: true });
    else toast('A card holds up to 10 reasons');
    return false;
  }
  $('#btnReasonAdd').addEventListener('click', () => {
    if (!roomForPage()) return;
    card.pg.push('');
    renderPages();
    $('#cReasons').lastElementChild.querySelector('input').focus();
  });
  // The next idea along the cycle that isn't on the card yet (in either wording): this relationship's first, then
  // everyone's; the occasion's own in its turn.
  function nextPageIdea() {
    const g = relOf(card).g, used = new Set(card.pg);
    for (let k = 0; k < PAGE_CYCLE.length; k++) {
      const at = (pageTurn + k) % PAGE_CYCLE.length, kind = PAGE_CYCLE[at];
      const pool = kind === 'occ' ? PAGE_OCC[card.o] || [] : [...((PAGE_IDEAS[g] || {})[kind] || []), ...PAGE_IDEAS.any[kind]];
      const s = pool.find((x) => !used.has(x) && !used.has(inLang(x)));
      if (s) { pageTurn = at + 1; return inLang(s); }
    }
    return '';
  }
  $('#btnReasonIdea').addEventListener('click', () => {
    if (!card.pg.some(Boolean)) pageTurn = 0; // a fresh list opens with an opener
    const empty = card.pg.findIndex((s) => !s);
    if (empty < 0 && !roomForPage()) return;
    const idea = nextPageIdea();
    if (!idea) { toast('That’s every idea. Write one of your own!'); return; }
    if (empty < 0) card.pg.push(idea); else card.pg[empty] = idea;
    renderPages();
  });
  window.addEventListener('luts:premium-changed', renderPages); // bought in the middle of a card: room for 10 at once

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
  // The app is served from a private origin, so links point at the public web copy of the game instead.
  const linkBase = () => (window.LUTSNative && window.LUTSNative.shareBase ? window.LUTSNative.shareBase
    : location.origin === 'null' ? location.href.split('#')[0] : location.origin + location.pathname);
  function cardUrl(c = card) {
    const { img, imgFull, friend, id, rel, pg, rm, ...data } = c; // the link carries the card, not this device's own bookkeeping (nor your reminder)
    if (rel) data.rel = rel; // Anyone adds nothing to the link
    if (pagesOf(c).length) data.pg = pagesOf(c); // nor does a card without reasons
    return `${linkBase()}#card=${encodeCard(data)}${img ? `&photo=${toB64url(img)}` : ''}${watchCode(id)}`;
  }
  // "Your sky was watched": a card you send carries a random code (&w=); opening it marks seen/<code> on Firebase with
  // only the time (no names, no message), and the sender's phone checks its recent cards' codes now and then.
  const SEEN_DB = window.LUTS_RTDB || 'https://light-up-the-skies-default-rtdb.asia-southeast1.firebasedatabase.app';
  function watchCode(id) {
    const e = id && myCards.find((x) => x.id === id && x.kind === 'made');
    if (!e) return '';
    if (!e.w) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(12)); e.w = Array.from(r, (n) => a[n % a.length]).join(''); saveCards(); }
    return `&w=${e.w}&u=${myId()}`;
  }
  // Sky streaks with one person: this device's random id travels in your links (&u=) and in the watched mark, so each
  // side learns the other's. A day counts once a sky passed between you and was opened, either way; days in a row
  // (ending today or yesterday) make the streak, the same number on both phones. { id: { n: name, days: { day: 1 } } }
  const PAIRS_KEY = 'luts:pairs';
  const ID_RE = /^[A-Za-z0-9]{12}$/;
  function myId() {
    let id = '';
    try { id = localStorage.getItem('luts:me') || ''; } catch (e) { /* ignore */ }
    if (!ID_RE.test(id)) {
      const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(12));
      id = Array.from(r, (n) => a[n % a.length]).join('');
      try { localStorage.setItem('luts:me', id); } catch (e) { /* ignore */ }
    }
    return id;
  }
  const loadPairs = () => { try { const p = JSON.parse(localStorage.getItem(PAIRS_KEY) || '{}'); return p && typeof p === 'object' ? p : {}; } catch (e) { return {}; } };
  function pairDay(id, name, at = Date.now()) {
    if (!ID_RE.test(id || '') || id === myId()) return 0;
    const all = loadPairs(), p = all[id] || { n: '', days: {} };
    if (name) p.n = clean(name, 20);
    p.days[dayKey(new Date(at))] = 1;
    const keys = Object.keys(p.days).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - 400))) delete p.days[old];
    all[id] = p;
    try { localStorage.setItem(PAIRS_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    return pairStreak(p);
  }
  function pairStreak(p) {
    const d = new Date();
    if (!p.days[dayKey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (p.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // Streaks still alive, longest first: { n: name, streak, today: kept today }
  const pairStreaks = () => Object.values(loadPairs()).map((p) => ({ n: p.n, streak: pairStreak(p), today: !!p.days[dayKey()] })).filter((p) => p.streak >= 2).map((p) => ({ ...p, n: p.n || 'a friend' })).sort((a, b) => b.streak - a.streak);
  function markWatched() {
    const m = location.hash.match(/[&#]w=([A-Za-z0-9]{12})\b/);
    if (!m || myCards.some((e) => e.w === m[1])) return; // never your own card
    const u = (location.hash.match(/[&#]u=([A-Za-z0-9]{12})\b/) || [])[1];
    if (u && u !== myId()) { const n = pairDay(u, incoming && incoming.f); if (n >= 2) toast(`🔥 ${n} days in a row with ${clean(incoming.f, 20)}`, 3600); }
    fetch(`${SEEN_DB}/seen/${m[1]}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at: Date.now(), ...(u ? { u: myId() } : {}) }) }).catch(() => {});
  }
  let seenAt = 0;
  async function checkWatched() {
    if (Date.now() - seenAt < 60e3) return;
    seenAt = Date.now();
    const wait = myCards.filter((e) => e.w && !e.seen && Date.now() - e.updated < 30 * 864e5).slice(0, 12);
    for (const e of wait) {
      try {
        const v = await fetch(`${SEEN_DB}/seen/${e.w}.json`).then((r) => r.json());
        if (!v || !Number.isFinite(v.at)) continue;
        e.seen = v.at; saveCards();
        const n = typeof v.u === 'string' ? pairDay(v.u, e.c.t, v.at) : 0;
        toast(n >= 2 ? `💖 ${e.c.t} watched your sky · 🔥 ${n} days in a row` : `💖 ${e.c.t} watched your sky`, 4200);
        celebrate();
        if (!$('#cardsModal').hidden) renderCards();
      } catch (err) { /* offline: next time */ }
    }
  }
  setTimeout(checkWatched, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkWatched(); });

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
  // fromList: opened from My Cards, so the creator's Home goes back there.
  let fromCards = false;
  function openCardModal(prefill, step = 0, fromList = false) {
    if (launch.state !== 'READY') abortLaunch();
    closeDrawer();
    if (prefill) { card.o = prefill.o || card.o; card.p = prefill.p || card.p; card.h = prefill.h || card.h; card.m = prefill.m || card.m; card.t = ''; card.f = ''; card.rel = ''; card.img = card.imgFull = ''; card.friend = ''; card.id = ''; card.pg = []; card.rm = null; }
    fromCards = fromList;
    $('#btnCardHome').lastChild.textContent = fromList ? 'My Cards' : 'Home';
    $('#btnCardHome').setAttribute('aria-label', fromList ? 'Back to My Cards' : 'Back to home');
    renderUpcoming();
    fillForm();
    syncMusicUi();
    modal.hidden = false;
    showStep(step);
    if (location.protocol === 'file:') $('#linkNote').textContent = 'The link contains the whole card, so nothing is uploaded. Host the game online (for example GitHub Pages or Netlify) so friends can open the link.';
    // Desktop: start typing straight away. Phones keep the keyboard closed until a field is tapped, so the step stays in view.
    if (step === 0 && window.matchMedia && matchMedia('(pointer: fine)').matches) setTimeout(() => f.to.focus(), 50);
  }
  function closeCardModal() {
    if (card.rm && card.t) keepMade(); // the phone reminds you from My Cards, so a card with a reminder is kept
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
    if (n === 0) { showActiveChip($('#cRels')); showActiveChip($('#occasions')); spyCats(); }
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
    const back = fromCards;
    closeCardModal();
    if (mode === 'card') exitCardMode();
    else restoreOwnWorld(); // a saved card's background was only on show while editing it
    if (back) openCards();
  });
  $('#btnCardNext').addEventListener('click', () => goStep(cardStep + 1));
  $('#btnCardBack').addEventListener('click', () => goStep(cardStep - 1));
  // Android's Back button asks the page first (NativeBridge.BACK_PRESS_SCRIPT): inside the card creator it goes back a
  // step, like any step-by-step screen. Anything else (closing a panel, leaving the app) stays with the app shell.
  window.LUTSBack = () => {
    if (window.PatakaChor && window.PatakaChor.back()) return true; // a throw being aimed, or a card open
    if (window.DiyaPath && window.DiyaPath.back()) return true;
    if (window.RocketRush && window.RocketRush.back()) return true;
    if (!$('#rewardsPanel').hidden) { closeRewards(); return true; }
    if (!$('#crackerTrial').hidden) { $('#crackerTrial').hidden = true; return true; }
    if (launch.state !== 'READY') { abortLaunch(); return true; }
    if (closeSheets()) return true;
    if (reader.i >= 0 && !$('#greeting').hidden && $('#premiumPanel').hidden) { showPage(-1); return true; } // a reason page: back to the card
    if (!modal.hidden && cardStep === 0 && fromCards && $('#premiumPanel').hidden && $('#worldPanel').hidden) { $('#btnCardHome').click(); return true; } // back to My Cards
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
    if (e.target.classList.contains('reason-input')) e.target.blur(); // a reason is done; the step stays
    else if (next) $('#' + next).focus(); else { e.target.blur(); goStep(cardStep + 1); }
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeCardModal(); });
  $('#btnShare').hidden = !navigator.share;

  // With cards saved, the card buttons open My Cards; the first card goes straight to the creator.
  $('#btnCard').addEventListener('click', () => startCard());
  $('#btnIntroCard').addEventListener('click', () => { Sound.resume(); startCard(); });
  $('#btnPreview').addEventListener('click', () => {
    if (!validCard()) return;
    Sound.resume();
    closeCardModal();
    hideOverlay($('#intro'));
    if (card.f) { try { localStorage.setItem('luts:from', card.f); } catch (e) { /* ignore */ } } // signs the next birthday video
    if (card.friend) achieve('hero');
    keepMade();
    playAndKeep({ ...card, pg: pagesOf(card), own: true }); // own: your card, so your music plays with it
  });
  $('#btnCopyLink').addEventListener('click', async () => {
    if (!validCard()) return;
    keepMade();
    const ok = await copyText(`${cardUrl()}${getApp('card_copy')}`);
    toast(ok ? 'Card link copied. Paste it anywhere to share.' : 'Could not copy the link');
    if (ok) countLight();
  });
  $('#btnShare').addEventListener('click', () => {
    if (!validCard()) return;
    keepMade();
    shareMade(card);
  });
  function shareMade(c) {
    const birthday = c.o === 'birthday';
    const blob = shareCard({ art: birthday ? 'assets/menu/birthdays.jpg' : worldArt(c.w, 'assets/menu/welcome.jpg'), kicker: birthday ? 'A birthday in fireworks' : 'A fireworks greeting', title: `For ${c.t}`, line: c.f ? `from ${c.f} · tap the link to watch it` : 'Tap the link to watch it light up the sky' });
    return shareThing({ title: `A fireworks card for ${c.t}`, text: `${c.f || 'Someone'} sent you a fireworks greeting ✨`, url: cardUrl(c), blob, name: 'fireworks-card.png', src: 'card' });
  }

  // Card show
  let currentCard = null, cardShells = []; // cardShells: the shell types this show has launched so far (for tests)
  function playCard(c) {
    abortLaunch();
    currentCard = c;
    mode = 'card';
    freeShowResources(false);
    if (window.LUTSGoals) LUTSGoals.tick('card'); achieve('card');
    document.body.classList.add('card-mode');
    $('#greeting').hidden = true;
    clearTimers('card');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    showCardWorld(c);
    if (c.own && music.url) playMusic(music.start); else stopMusic(0.4);
    const T = 'card';
    // The occasion's own shells: gold willows for Diwali, colourful peonies for Holi, hearts for love and weddings.
    const [left, right, mid, end] = (OCC_BY_ID[c.o] && OCC_BY_ID[c.o].show) || SHOW_DEFAULT;
    cardShells = [];
    const shell = (o) => { cardShells.push(o.type); launchShell(o); };
    after(0.2, () => shell({ x: W * 0.22, y: H * 0.3, type: left }), T);
    after(0.55, () => shell({ x: W * 0.78, y: H * 0.3, type: right }), T);
    after(1.0, () => shell({ x: W * 0.5, y: H * 0.2, type: mid }), T);
    let t = 3;
    if (c.h) { after(2.6, () => launchText(c.h, H * 0.24, 0.12, 3), T); t = 6; }
    if (c.img) { after(t, () => launchPhoto(showPhoto(c), H * 0.52, 3.4), T); t += 4.8; }
    // Over a landmark the name goes into the open sky above its roofline, so the building doesn't hide it.
    after(t, () => launchText(c.t, world.img && world.rect ? clamp(world.rect.roof - H * 0.1, H * 0.2, H * 0.42) : H * 0.42, 0.2, 4), T);
    after(t + 0.4, () => {
      shell({ x: W * 0.15, y: H * 0.22, type: end });
      shell({ x: W * 0.85, y: H * 0.22, type: end });
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
    whoLine($('#gWho'), c);
    $('#gDear').hidden = joy;
    $('#gJoyHead').hidden = !joy;
    if (joy) $('#gJoyHead').textContent = `${c.r ? REASON_BY_ID[c.r]?.icon || '🪔' : MOODS[c.mood - 1][0]} Day ${c.day} of lighting someone up`;
    $('#gMsg').textContent = c.m;
    $('#gFrom').textContent = joy ? niceDate(c.date) : c.f ? `— ${c.f}` : '';
    setImg($('#gPhoto'), showPhoto(c));
    $('#gCard').classList.toggle('has-photo', !!c.img);
    // Your card: Save video leads. A card you received: Send one back leads, Save video moves to the tools.
    const received = !c.own && !joy, sender = clean(c.f, 20);
    // Save video leads on Android too: it replays the card under the screen recorder (recordShow), then the share sheet.
    $('#btnRecordCard').hidden = received;
    // Already recorded: the big gold button is done; a small "Record again" stays for a second take.
    markSaved();
    $('#btnSendBack').hidden = !received;
    $('#btnSendBack').lastChild.textContent = c.lit ? (sender ? `Light ${sender} back` : 'Light someone up too')
      : sender ? `Send one back to ${sender}` : 'Make one of your own';
    $('#btnSaveTool').hidden = !received || nativeRecorder;
    $('#btnEditCard').hidden = !c.own || joy;
    $('#btnMakeOwn').hidden = true;
    $('#btnShareJoy').hidden = !joy;
    $('#btnGreetCards').hidden = joy || !myCards.length; // dedications live in Light someone up, not My Cards
    reader.pg = joy ? [] : pagesOf(c);
    $('#btnReasonsLabel').textContent = `Read the reasons (${reader.pg.length})`;
    showPage(-1);
    $('#greeting').hidden = false;
  }

  // ----- Reasons: after the show the closing card turns into pages, one reason each, a burst behind every turn -----
  const reader = { pg: [], i: -1 }; // i: the page showing, -1 for the card itself
  // A heart, then the occasion's own centre shell, in turn, in the sky above the card.
  function pageBurst(c, i) {
    const type = i % 2 ? ((OCC_BY_ID[c.o] && OCC_BY_ID[c.o].show) || SHOW_DEFAULT)[2] : 'heart';
    cardShells.push(type);
    launchShell({ x: W * (0.25 + Math.random() * 0.5), y: H * (0.14 + Math.random() * 0.1), type });
  }
  // The last page brings the card's own actions back (Replay, Send one back); Back returns to the card.
  function showPage(i, dir = 1) {
    const n = reader.pg.length, on = i >= 0 && i < n, box = $('#gPages');
    reader.i = on ? i : -1;
    $('#gCard').classList.toggle('paging', on);
    $('#greeting').classList.toggle('paging', on);
    $('#greeting').classList.toggle('last-page', on && i === n - 1);
    box.hidden = $('#gPager').hidden = !on;
    $('#btnReasons').hidden = on || !n;
    if (!on) return;
    $('#gPageN').textContent = `Reason ${i + 1} of ${n}`;
    $('#gPageText').textContent = reader.pg[i];
    $('#btnPageNext').hidden = i === n - 1;
    box.classList.remove('turn', 'turn-back');
    if (!reduceMotion()) { void box.offsetWidth; box.classList.add(dir < 0 ? 'turn-back' : 'turn'); }
    if (currentCard) pageBurst(currentCard, i);
  }
  $('#btnReasons').addEventListener('click', () => { showPage(0); $('#btnPageNext').focus({ preventScroll: true }); });
  $('#btnPageNext').addEventListener('click', () => showPage(reader.i + 1));
  $('#btnPageBack').addEventListener('click', () => { showPage(-1); $('#btnReasons').focus({ preventScroll: true }); });
  // On a page, a tap or a swipe to the left turns to the next one; a swipe to the right goes back one.
  let swipeX = null;
  $('#gCard').addEventListener('pointerdown', (e) => { swipeX = reader.i >= 0 ? e.clientX : null; });
  $('#gCard').addEventListener('pointercancel', () => { swipeX = null; });
  $('#gCard').addEventListener('pointerup', (e) => {
    if (reader.i < 0 || swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (dx > 40) { if (reader.i > 0) showPage(reader.i - 1, -1); } else if (reader.i < reader.pg.length - 1) showPage(reader.i + 1);
  });
  // Saved videos turn the pages by themselves, 2.5 s each from just after the closing card, as many as fit before the
  // 29 s end (whose last 2 s are the outro). page(i) turns to page i; returns when the video should end.
  const PAGE_SEC = 2.5;
  function videoPages(c, tGreet, page) {
    const pg = c.kind === 'joy' ? [] : pagesOf(c), start = tGreet + 1.5;
    const n = Math.min(pg.length, Math.max(0, Math.floor((27 - start) / PAGE_SEC)));
    for (let i = 0; i < n; i++) after(start + i * PAGE_SEC, () => page(i), 'card');
    return Math.min(29, Math.max(tGreet + 7, start + n * PAGE_SEC + 2));
  }
  // A video made in the background while you watch gets its pages drawn into the video only, over the closing card,
  // so the card on your screen stays yours to read.
  function drawVideoPage(g, sx, sy, r, c) {
    const p = r.page, pg = pagesOf(c);
    if (!p || !pg[p.i] || $('#greeting').hidden) return;
    const cr = $('#gCard').getBoundingClientRect(), pad = 22, maxW = cr.width - pad * 2;
    const a = reduceMotion() ? 1 : clamp((performance.now() - p.at) / 400, 0, 1);
    g.save();
    g.scale(sx, sy);
    g.font = '400 20px Outfit, sans-serif';
    const lines = wrapLines(g, pg[p.i], maxW), h = Math.max(cr.height, pad * 2 + 26 + lines.length * 28), top = cr.bottom - h;
    const bg = g.createLinearGradient(cr.left, top, cr.right, cr.bottom);
    bg.addColorStop(0, 'rgba(34,22,64,0.97)'); bg.addColorStop(1, 'rgba(14,12,34,0.98)');
    roundRect(g, cr.left, top, cr.width, h, 18);
    g.fillStyle = bg; g.fill();
    g.strokeStyle = 'rgba(255,210,122,0.45)'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = a;
    g.translate((1 - a) * 24, 0); // the page slides in as it turns
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = '700 12px Outfit, sans-serif'; g.fillStyle = '#ffd27a';
    g.fillText(inLang(`Reason ${p.i + 1} of ${pg.length}`).toUpperCase(), cr.left + pad, top + pad);
    g.font = '400 20px Outfit, sans-serif'; g.fillStyle = '#f6f2ff';
    lines.forEach((line, k) => g.fillText(line, cr.left + pad, top + pad + 26 + k * 28));
    g.restore();
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
  $('#btnGreetCards').addEventListener('click', () => { exitCardMode(); openCards(); });
  $('#btnEditCard').addEventListener('click', () => openCardModal(null, 2));
  // Replays the whole card show from the start while recording, then saves the video.
  // Plays a show and records the whole of it: the song fades out with the video and the closing card comes last.
  function recordShow(c, opts) {
    if (nativeRecorder) {
      const play = () => {
        Sound.resume();
        closeCardModal();
        hideOverlay($('#intro'));
        const end = videoPages(c, playCard(c), (i) => showPage(i)); // the screen recorder films the card's own pages
        after(end - 1.6, () => stopMusic(1.5), 'card');
        after(end - 1.8, () => nativeOutro(), 'card');
      };
      if (nativeRecording === 'recording') play();
      else if (nativeRecording === 'idle') { nativeRecordingReady = play; window.LUTSAndroid.recording('start'); }
      return;
    }
    if (rec) { if (rec.quiet) discardRecording(); else stopRecording(); }
    const tGreet = playCard(c);
    startRecording('Recording the card show… it saves automatically', opts);
    if (!rec) return;
    const r = rec, quiet = !!(opts && opts.quiet);
    // Save video turns the closing card's own pages (the video copies the card); a background video draws its own.
    const end = videoPages(c, tGreet, quiet ? (i) => { if (rec === r) { r.page = { i, at: performance.now() }; pageBurst(c, i); } }
      : (i) => { if (rec === r) showPage(i); });
    if (quiet) r.layer = (g, sx, sy) => drawVideoPage(g, sx, sy, r, c);
    after(end - 1.6, () => { if (rec === r) stopMusic(1.5); }, 'card');
    after(end - 2, () => { if (rec === r) { r.outro = performance.now(); setTimeout(() => { if (rec === r) stopRecording(); }, 2000); } }, 'card');
  }
  // The first time a show plays, its video is made in the background, so Save video is instant afterwards (no second
  // wait while the show replays). Skipped on Low quality, where recording during play could slow the show down.
  let readyVideo = null; // { card, blob, name, type, want }
  function markSaved() {
    const b = $('#btnRecordCard'), saved = !!(currentCard && currentCard.saved);
    b.classList.toggle('done', saved);
    b.lastChild.textContent = saved ? '✓ Video saved · record again' : 'Save video';
  }
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
    setShareCaption(cardCaption(currentCard)); // the card's own greeting and the Play link, never the last show's
    const ready = readyVideo && readyVideo.card === currentCard ? readyVideo : null;
    if (ready && ready.blob) { currentCard.saved = true; markSaved(); deliverVideo(ready.blob, ready.name, ready.type); return; }
    if (ready && rec && rec.quiet) { ready.want = true; toast('Your video is almost ready…', 2200); return; }
    readyVideo = null;
    recordShow(currentCard);
  });
  $('#btnSaveTool').addEventListener('click', () => $('#btnRecordCard').click());
  // Received cards: answer the sender with a thank-you card already addressed to them.
  const REPLY = { o: 'thanks', h: 'Thank You', m: 'Thank you for the lovely wishes! Sending a sky full of light right back to you.', p: 'gold' };
  $('#btnSendBack').addEventListener('click', () => {
    const to = currentCard ? clean(currentCard.f, 20) : '';
    if (window.LUTSGoals) LUTSGoals.tick('back');
    // A dedication someone sent you: light them back, through Light someone up, with Thank you picked.
    if (currentCard && currentCard.lit) { exitCardMode(); openLightBack(to); return; }
    if (currentCard && currentCard.got) markBack(currentCard.got); // My Cards shows it was lit back
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
    setTimeout(() => { if (!o.classList.contains('leaving')) return; o.hidden = true; o.classList.remove('leaving'); }, 600); // unless it came back meanwhile
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
    markWatched();
    playAndKeep(incoming);
  });
  window.addEventListener('hashchange', () => {
    const c = readHash();
    if (c) { incoming = c; keepReceived(c); closeCardModal(); $('#intro').hidden = true; document.body.classList.remove('home'); showEnvelope(c); }
  });
  function showEnvelope(c) {
    abortLaunch();
    mode = 'envelope';
    freeShowResources(false);
    clearTimers('card');
    $('#greeting').hidden = true;
    document.body.classList.add('card-mode');
    palette = PALETTES[c.p] || PALETTES.rainbow;
    stopMusic(0.4);
    showCardWorld(c); // the sender's background is already behind the envelope
    $('#envTo').textContent = c.t;
    $('#envFrom').textContent = c.f ? `from ${c.f}` : '';
    $('#envelope .env-label').textContent = c.lit ? 'Lit up in fireworks for' : 'A fireworks card for';
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
  // The Play page tagged with where the link was shared from, so installs from shared cards can be counted.
  // Only a source tag, never a name.
  const playLink = (src) => `https://play.google.com/store/apps/details?id=com.stalinpusparaj.lightuptheskies&referrer=utm_source%3D${src}%26utm_campaign%3Ddiwali2026`;
  // Every share ends with the hashtag the Facebook Page searches for and reposts with credit (after the Play link, never
  // a second link). Captions stay in English, like the hashtag itself.
  const TAG = '#LightUpTheSkies', TAG_LINE = `${TAG} · tag us and we’ll feature the best`;
  // The website's home screen offers the app (a friend who opened a shared card can install it); the apps hide it.
  if (!window.LUTSNative) { const g = $('#btnGetApp'); if (g) { g.href = playLink('web'); g.hidden = false; } }
  // The website is a card viewer, not a free copy of the game (Premium lives in the app): shared cards, dedications and
  // challenges still play there, but its home is only "Get it on Google Play", and anything that would start your own
  // show or card opens the Play page instead. On the user site (github.io) or with ?viewer; never in the apps.
  const webViewer = !window.LUTSNative && (/(^|\.)github\.io$/.test(location.hostname) || /[?&]viewer\b/.test(location.search));
  if (webViewer) {
    document.body.classList.add('web-viewer');
    const toApp = ['#btnStart', '#btnIntroCard', '#btnMakeOwn', '#btnSendBack', '#btnEditCard', '#btnRecordCard', '#btnSaveTool', '#btnGreetCards', '.home-tile', '#btnIntroSettings'].join(',');
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest(toApp)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      window.open(playLink('viewer'), '_blank', 'noopener');
    }, true);
  }
  // On an Android phone's browser, a challenge or room link opens the app itself (lightuptheskies://open?h=<the #…>,
  // AndroidManifest), with Google Play as the fallback when it isn't installed. Anywhere else: Google Play.
  // The website's way to a challenge: on an Android phone a card with Open in the app (browsers open apps only on a
  // tap), elsewhere straight to Google Play.
  function toApp(src) {
    const url = appOrPlay(src);
    if (!/^intent:/.test(url)) { location.href = url; return; }
    let box = document.getElementById('openApp');
    if (!box) {
      box = document.createElement('div');
      box.id = 'openApp'; box.className = 'open-app';
      box.innerHTML = '<div class="open-app-box"><b>You’re invited!</b><p>Open it in Light Up the Skies to play.</p><a class="btn primary" id="openAppGo">Open in the app</a><a class="btn ghost" id="openAppPlay">Get it on Google Play</a></div>';
      document.body.append(box);
    }
    box.querySelector('#openAppGo').href = url;
    box.querySelector('#openAppPlay').href = playLink(src);
    box.hidden = false;
  }
  const appOrPlay = (src) => {
    const h = location.hash.slice(1);
    if (window.LUTSNative || !/Android/i.test(navigator.userAgent) || !h) return playLink(src);
    return `intent://open?h=${encodeURIComponent(h)}#Intent;scheme=lightuptheskies;package=${window.LUTS_APP_ID || 'com.stalinpusparaj.lightuptheskies'};S.browser_fallback_url=${encodeURIComponent(playLink(src))};end`;
  };
  const appLink = () => (window.LUTSNative && window.LUTSNative.shareBase) || (location.origin === 'null' ? '' : location.origin + location.pathname);
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  // ----- Sheets (the two screens) -----
  const sheets = [$('#bdayModal'), $('#joyModal'), $('#welcomeModal'), $('#achModal'), $('#gemModal'), $('#giftModal'), $('#boardModal'), $('#cardsModal'), $('#festModal'), $('#tryModal')];
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

  // ----- My Cards: the cards you made and the ones friends sent you, on this device -----
  // Newest first. Each entry: { id, kind: 'made' | 'got', created, updated, c: the card as its link carries it, with its
  // small link photo (never imgFull), back: 1 once you sent one back }. A card you make is kept when you play, copy or
  // share it, under its id so edits update it; a card from a link is kept once. Dedications live in Light someone up.
  const CARDS_KEY = 'luts:cards', CARDS_MAX = 60, CARD_PHOTO_MAX = 24000;
  const newCardId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // Checked like a card from a link, so a stored card can't hold anything a link couldn't.
  function cardFields(raw) {
    const rm = rmOf(raw && raw.rm); // a link has none: only the cards you made keep your reminder
    try { return { ...normaliseCard(raw), img: typeof raw.img === 'string' && raw.img.length <= CARD_PHOTO_MAX ? raw.img : '', ...(rm ? { rm } : {}) }; } catch (e) { return null; }
  }
  function readCardEntry(e) {
    const c = e && typeof e.id === 'string' && (e.kind === 'made' || e.kind === 'got') && e.c ? cardFields(e.c) : null;
    if (!c) return null;
    const created = Number.isFinite(e.created) ? e.created : Date.now();
    return { id: e.id.slice(0, 32), kind: e.kind, created, updated: Number.isFinite(e.updated) ? e.updated : created, c, ...(e.back ? { back: 1 } : {}), ...(typeof e.w === 'string' && /^[A-Za-z0-9]{12}$/.test(e.w) ? { w: e.w } : {}), ...(Number.isFinite(e.seen) ? { seen: e.seen } : {}) };
  }
  let myCards = loadList(CARDS_KEY).map(readCardEntry).filter(Boolean).slice(0, CARDS_MAX);
  // Saved quietly. When the device is full, the older cards are kept without their photos.
  function saveCards() {
    const put = (list) => { try { localStorage.setItem(CARDS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
    const ok = put(myCards) || put(myCards.map((e, i) => (i < 10 || !e.c.img ? e : { ...e, c: { ...e.c, img: '' } })));
    try { syncReminders(); } catch (e) { /* at start-up, before the birthdays load: they sync then */ }
    return ok;
  }
  // The phone's card reminders: one "#card<TAB>id<TAB>month<TAB>day<TAB>year or empty<TAB>title<TAB>body" line each,
  // written here in the player's language (Reminders.parse skips them: its month field is the id). A festival that moves
  // is sent as this year's day, with its year; a once-only day that has passed is left out.
  function cardReminderLines() {
    const flat = (s) => String(s).replace(/[\t\r\n]+/g, ' ').trim();
    return myCards.filter((e) => e.kind === 'made' && e.c.rm).flatMap((e) => {
      const rm = e.c.rm, next = nextRemind(e.c);
      if (!next) return [];
      const moving = rm.f && movesYearly(OCC_BY_ID[e.c.o]);
      const [m, d, y] = rm.y != null || moving ? [next.date.getMonth() + 1, next.date.getDate(), next.date.getFullYear()] : [rm.m, rm.d, ''];
      return [['#card', e.id, m, d, y, flat(remindTitle(e.c)), flat(inLang('Tap to send their fireworks card'))].join('\t')];
    });
  }
  // "🎂 Mom’s birthday is tomorrow", "🪔 Diwali is tomorrow: light up Priya’s sky": short, with their name.
  const BIG_DAYS = new Set(['baby', 'housewarming', 'graduation', 'newjob', 'retirement', 'goodluck']);
  function remindTitle(c) {
    const o = OCC_BY_ID[c.o] || OCC_BY_ID.custom, name = c.t;
    if (o.id === 'birthday') return inLang(`🎂 ${name}’s birthday is tomorrow`);
    if (o.id === 'anniversary') return inLang(`💞 ${name}’s anniversary is tomorrow`);
    if (o.id === 'wedding') return inLang(`💍 Tomorrow: ${name}’s wedding`);
    if (BIG_DAYS.has(o.id)) return inLang(`🎆 Tomorrow is ${name}’s big day`);
    if (YEARLY_OCC.has(o.id)) return `${o.label.split(' ')[0]} ${inLang(`${occName(o)} is tomorrow: light up ${name}’s sky`)}`;
    return inLang(`🎆 Tomorrow: your fireworks card for ${name}`);
  }
  // Web: a calendar event the day of the reminder, with an alert at 9 am the day before (as for birthdays).
  function addCardToCalendar(id, c) {
    const next = nextRemind(c), o = OCC_BY_ID[c.o] || OCC_BY_ID.custom;
    if (!next) return;
    const pad = (n) => String(n).padStart(2, '0'), ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const esc = (t) => t.replace(/[\\;,]/g, (ch) => '\\' + ch);
    const yearly = c.rm.y == null && !(c.rm.f && movesYearly(o)); // a festival that moves: just this year's day
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Light Up the Skies//Cards//EN', 'BEGIN:VEVENT',
      `UID:card-${id}@lightuptheskies`, `DTSTAMP:${ymd(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(next.date)}`, `DTEND;VALUE=DATE:${ymd(new Date(next.date.getTime() + 864e5))}`, ...(yearly ? ['RRULE:FREQ=YEARLY'] : []),
      `SUMMARY:${esc(`${o.label.split(' ')[0]} ${c.t} · ${occName(o)}`)}`,
      `DESCRIPTION:${esc(`Send ${c.t} their fireworks card: ${appLink()}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15H', `DESCRIPTION:${esc(remindTitle(c))}`, 'END:VALARM', // 9 am the day before
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    download(new Blob([ics], { type: 'text/calendar' }), `${c.t.replace(/[^\w-]+/g, '-').toLowerCase() || 'card'}-reminder.ics`);
    toast('Open the file to add it to your calendar', 3200);
  }
  function addCard(e) {
    myCards.unshift(e);
    while (myCards.length > CARDS_MAX) { // the oldest received card goes first, so made cards keep their reminders
      const i = myCards.map((x) => x.kind).lastIndexOf('got');
      myCards.splice(i < 0 ? myCards.length - 1 : i, 1);
    }
    saveCards();
  }
  // The card in the creator, kept under its id: the first save gives it one, later ones update it.
  function keepMade() {
    const c = cardFields(card), now = Date.now();
    if (!c) return;
    const have = card.id && myCards.find((e) => e.id === card.id && e.kind === 'made');
    if (have) { have.c = c; have.updated = now; saveCards(); return; }
    card.id = newCardId();
    addCard({ id: card.id, kind: 'made', created: now, updated: now, c });
    festCheck(); // Bhai Dooj's challenge
  }
  // The same words, colours and photo are the same card, however often its link is opened.
  const cardSig = (c) => `${encodeCard({ ...c, img: '' })}|${c.img.length}|${c.img.slice(-24)}`;
  function keepReceived(c) {
    if (c.lit || c.kind === 'joy') return; // a dedication is answered from Light someone up
    const data = cardFields(c);
    if (!data) return;
    const sig = cardSig(data), have = myCards.find((e) => e.kind === 'got' && cardSig(e.c) === sig);
    if (have) { c.got = have.id; return; }
    const now = Date.now();
    c.got = newCardId(); // Send one back marks this entry
    addCard({ id: c.got, kind: 'got', created: now, updated: now, c: data });
  }
  function markBack(id) {
    const e = myCards.find((x) => x.id === id);
    if (!e || e.back) return;
    e.back = 1; e.updated = Date.now();
    saveCards();
  }
  // A saved card into the creator's draft (no sharper photo: the small one plays the show).
  const loadDraft = (e) => Object.assign(card, { rel: '', rm: null }, e.c, { id: e.id, imgFull: '', friend: '', pg: [...(e.c.pg || [])], rm: e.c.rm ? { ...e.c.rm } : null }); // a card saved as Anyone has no rel; its own copy of the pages and reminder
  // A new card: the same occasion written fresh, still signed with your name.
  function freshCard() {
    const o = OCC_BY_ID[card.o] || OCCASIONS[0];
    let from = card.f;
    try { from = from || localStorage.getItem('luts:from') || ''; } catch (e) { /* ignore */ }
    Object.assign(card, { id: '', o: o.id, t: '', f: from, rel: '', h: inLang(o.head), m: inLang(o.msg), p: o.theme, img: '', imgFull: '', friend: '', pg: [], rm: null });
  }
  function startCard() { if (myCards.length) openCards(); else openCardModal(); }

  let cardsTab = 'made';
  function openCards() {
    cardsTab = myCards.some((e) => e.kind === 'made') || !myCards.length ? 'made' : 'got'; // only received ones yet: those
    renderCards();
    openSheet($('#cardsModal'));
  }
  const CARDS_EMPTY = {
    made: 'Cards you make are kept here, ready to play, change or send again.',
    got: 'Cards friends send you are kept here, so you can watch them again.',
  };
  function renderCards() {
    const rows = myCards.filter((e) => e.kind === cardsTab);
    // Received shows up once someone has sent you a card (and stays while you are on it).
    $('#cardsTabs').hidden = cardsTab === 'made' && !myCards.some((e) => e.kind === 'got');
    for (const b of $('#cardsTabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === cardsTab));
    $('#cardsEmpty').hidden = rows.length > 0;
    $('#cardsEmpty').textContent = CARDS_EMPTY[cardsTab];
    $('#cardsList').innerHTML = '';
    for (const e of rows) $('#cardsList').append(cardRow(e));
    renderCardsSoon();
    renderPairs();
  }
  // Sky streaks: one chip each, "🔥 5 days with Amma", and a nudge on the ones not kept today
  function renderPairs() {
    const box = $('#cardsPairs'), list = pairStreaks();
    box.hidden = !list.length;
    box.innerHTML = '';
    for (const p of list.slice(0, 6)) {
      const b = document.createElement('span');
      b.className = `pair-chip${p.today ? '' : ' risk'}`;
      b.textContent = p.today ? `🔥 ${p.streak} days with ${p.n}` : `🔥 ${p.streak} days with ${p.n} · send one today`;
      box.append(b);
    }
  }
  // Upcoming: the nearest reminder within a week, with its card one tap from sending.
  function renderCardsSoon() {
    const box = $('#cardsSoon');
    const soon = myCards.filter((e) => e.kind === 'made').map((e) => ({ e, next: nextRemind(e.c) }))
      .filter((x) => x.next && x.next.days <= 7).sort((a, b) => a.next.days - b.next.days)[0];
    box.hidden = !soon;
    box.innerHTML = '';
    if (!soon) return;
    const { e, next } = soon, o = OCC_BY_ID[e.c.o] || OCC_BY_ID.custom;
    const text = document.createElement('span');
    text.className = 'row-text';
    const b = document.createElement('b'); b.textContent = '⏰ Upcoming';
    const sm = document.createElement('small');
    const name = document.createElement('span'); name.textContent = e.c.t; name.setAttribute('data-no-i18n', '');
    const occ = document.createElement('span'); occ.textContent = occName(o);
    const when = document.createElement('span'); when.textContent = next.days === 0 ? 'Today' : next.days === 1 ? 'Tomorrow' : `In ${next.days} days`;
    sm.append(name, ' · ', occ, ' · ', when);
    text.append(b, sm);
    const send = document.createElement('button');
    send.type = 'button'; send.className = 'btn primary small'; send.textContent = 'Send';
    send.setAttribute('aria-label', `Send the card for ${e.c.t}`);
    send.addEventListener('click', () => shareMade(e.c));
    box.append(text, send);
  }
  for (const b of $('#cardsTabs').children) b.addEventListener('click', () => { cardsTab = b.dataset.tab; renderCards(); });
  const ROW_SVG = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    share: '<path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    del: '<path d="M7 7l10 10M17 7L7 17"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  };
  function rowIcon(svg, title, label, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'row-icon'; b.title = title; b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
    b.addEventListener('click', onClick);
    return b;
  }
  function cardRow(e) {
    const c = e.c, li = document.createElement('li');
    li.className = 'sheet-row card-row';
    li.dataset.id = e.id;
    // The thumbnail: its firework colours over its background, with their photo, their relationship's face or initials.
    const thumb = document.createElement('span'), rel = REL_BY_ID.get(c.rel);
    thumb.className = 'card-thumb';
    thumb.style.setProperty('--th-grad', `linear-gradient(135deg, ${(PALETTES[c.p] || PALETTES.rainbow).join(', ')})`);
    thumb.style.setProperty('--th-world', `url("${thumbSrc(WORLD_BY_ID[c.w] || WORLD_BY_ID.default, 'jpg')}")`);
    const av = c.img || !rel ? document.createElement(c.img ? 'img' : 'span') : relFace(rel, 'row-avatar');
    av.classList.add('row-avatar');
    if (c.img) { av.src = photoSrc(c.img); av.alt = ''; } else if (!rel) av.textContent = initials(c.t) || '✨';
    thumb.append(av);
    const text = document.createElement('span');
    text.className = 'row-text';
    // From → to, or just their name. (No "For {0}": as a translation pattern it would catch every message starting "For ".)
    const b = document.createElement('b'); b.textContent = c.f ? `${c.f} → ${c.t}` : c.t;
    b.setAttribute('data-no-i18n', ''); // names stay as written, even one that happens to be an English word
    const sm = document.createElement('small');
    const occ = document.createElement('span'); occ.textContent = (OCC_BY_ID[c.o] || OCC_BY_ID.custom).label.replace(/^\S+\s/, '');
    // Who they are to you, unless their name already says it ("Alex → Mom").
    if (rel && !saysRel(c, rel)) { const who = document.createElement('span'); who.className = 'row-rel'; who.textContent = rel.word; sm.append(who, ' · '); }
    sm.append(occ, ` · ${niceDate(dayKey(new Date(e.created)))}`);
    const pages = pagesOf(c).length;
    if (pages) { const r = document.createElement('span'); r.className = 'row-pages'; r.textContent = pages === 1 ? '1 reason' : `${pages} reasons`; sm.append(' · ', r); }
    if (e.seen) { const w = document.createElement('span'); w.className = 'card-badge seen'; w.textContent = '👀 Watched'; sm.append(' ', w); }
    if (e.back) { const lit = document.createElement('span'); lit.className = 'card-badge'; lit.textContent = 'Lit back'; sm.append(' ', lit); }
    const next = e.kind === 'made' && nextRemind(c);
    if (next) { const r = document.createElement('span'); r.className = 'row-remind'; r.textContent = `⏰ ${shortDate(next.date)}`; r.title = 'Reminder'; sm.append(' · ', r); }
    text.append(b, sm);
    // Delete asks once: the first tap turns the button into "Delete?"
    const del = rowIcon(ROW_SVG.del, 'Delete', `Delete the card for ${c.t}`, () => {
      if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'Delete?'; return; }
      deleteCard(e.id);
    });
    del.classList.add('row-del');
    const acts = document.createElement('div');
    acts.className = 'card-acts';
    const play = document.createElement('button');
    play.type = 'button'; play.className = 'btn ghost small card-play'; play.setAttribute('aria-label', `Play the card for ${c.t}`);
    play.innerHTML = '<span class="btn-ico firework-glyph" aria-hidden="true"></span>Play';
    play.addEventListener('click', () => playSaved(e));
    acts.append(play);
    if (e.kind === 'made') {
      acts.append(rowIcon(ROW_SVG.edit, 'Edit', `Edit the card for ${c.t}`, () => editSaved(e)),
        rowIcon(ROW_SVG.copy, 'Duplicate', `Duplicate the card for ${c.t}`, () => duplicateCard(e)),
        rowIcon(ROW_SVG.share, 'Share', `Share the card for ${c.t}`, () => shareMade(e.c)));
      if (next && !nativeReminders()) acts.append(rowIcon(ROW_SVG.cal, 'Add to calendar', `Add the reminder for ${c.t} to your calendar`, () => addCardToCalendar(e.id, e.c)));
    }
    li.append(thumb, text, del, acts);
    return li;
  }
  function playSaved(e) {
    Sound.resume();
    closeSheets();
    hideOverlay($('#intro'));
    if (e.kind === 'made') { loadDraft(e); playAndKeep({ ...card, pg: pagesOf(card), own: true }); } // so the show's Edit changes this card
    else playAndKeep({ ...e.c, got: e.id }); // as it came, with Send one back to its sender
  }
  function editSaved(e) {
    closeSheets();
    loadDraft(e);
    showCardWorld(card); // the creator's Scene follows the sky, so the card's own background goes up first
    openCardModal(null, 0, true);
  }
  function duplicateCard(e) {
    const now = Date.now();
    addCard({ id: newCardId(), kind: 'made', created: now, updated: now, c: { ...e.c, rm: null } }); // the copy gets no second reminder
    renderCards();
    toast('Copy added at the top');
  }
  function deleteCard(id) {
    myCards = myCards.filter((e) => e.id !== id);
    if (card.id === id) card.id = ''; // the draft, if played again, is a new card
    saveCards();
    renderCards();
  }
  $('#btnCardsNew').addEventListener('click', () => { closeSheets(); freshCard(); openCardModal(null, 0, true); });

  // ----- Gems: the bigger crackers cost gems; everyday ones stay free -----
  // Gems come free every day (a growing daily gift, lighting someone up, reward videos) and in packs
  // from the Android app (Google Play one-time products, see mobile/.../Gems.kt). The wallet lives on this device; every
  // pack bought is credited once by its store transaction id, so packs come back after a reinstall.
  const GEM_KEY = 'luts:gems';
  const GEM_PACKS = [ // shown on the web, where packs are bought in the app; the app sends its own prices
    { id: 'gems_pouch', name: 'Diya pouch', gems: 120 }, { id: 'gems_box', name: 'Rocket box', gems: 360, bonus: '+10%' },
    { id: 'gems_chest', name: 'Festival chest', gems: 1000, bonus: '+20%' }, { id: 'gems_vault', name: 'Grand vault', gems: 2800, bonus: '+35%', best: true },
  ];
  // The starter pack: one per player, offered for 3 days from the first time the gem sheet shows it (the app only).
  const STARTER = { id: 'gems_starter', name: 'Starter offer', gems: 500 }, STARTER_HOURS = 72;
  // The Diwali box tops the sheet from 6 to 25 Nov; the mini pack shows once the starter is bought or has run out (the app only).
  const DIWALI_BOX = { id: 'gems_diwali', name: 'Diwali box', gems: 720, from: '11-06', to: '11-25' };
  const MINI = { id: 'gems_mini', name: 'Mini pack', gems: 40 };
  const GEM_WELCOME = 50, GEM_VIDEO = 20, GEM_VIDEOS_A_DAY = 3, GEM_JOY = 15, GEM_CHEST = 50;
  function loadWallet() {
    let w = null;
    try { w = JSON.parse(localStorage.getItem(GEM_KEY) || 'null'); } catch (e) { w = null; }
    if (!w || typeof w !== 'object' || !Number.isFinite(w.b)) w = { b: GEM_WELCOME, tx: [], day: '', streak: 0, joy: '', sky: {}, vid: {}, pm: '' };
    w.tx = Array.isArray(w.tx) ? w.tx.slice(-500) : [];
    w.sky = w.sky && typeof w.sky === 'object' ? w.sky : {};
    w.vid = w.vid && typeof w.vid === 'object' ? w.vid : {};
    // Diwali week: launches counted toward each day's challenge, and the days whose challenge is done.
    w.fest = w.fest && typeof w.fest === 'object' ? w.fest : {};
    w.fest.c = w.fest.c && typeof w.fest.c === 'object' ? w.fest.c : {};
    w.fest.done = w.fest.done && typeof w.fest.done === 'object' ? w.fest.done : {};
    return w;
  }
  const wallet = loadWallet();
  const saveWallet = () => { try { localStorage.setItem(GEM_KEY, JSON.stringify(wallet)); } catch (e) { /* storage unavailable */ } };
  const gems = () => wallet.b;
  function syncGems(gain = 0) {
    for (const el of document.querySelectorAll('[data-gems]')) el.textContent = fmtGems(wallet.b);
    $('#btnGems').dataset.cap = `💎 ${fmtGems(wallet.b)}`;
    if (gain > 0) { const pill = $('#btnGems'); pill.classList.remove('gain'); void pill.offsetWidth; pill.classList.add('gain'); }
  }
  const fmtGems = (n) => Math.max(0, Math.floor(n)).toLocaleString('en-IN');
  function addGems(n, why) {
    if (!Number.isFinite(n) || !(n > 0)) return;
    wallet.b += n; saveWallet(); syncGems(n);
    if (why) toast(`💎 +${fmtGems(n)} ${why}`, 3000);
  }
  function spendGems(n) {
    if (!(n > 0)) return true;
    if (wallet.b < n) return false;
    wallet.b -= n; saveWallet(); syncGems();
    return true;
  }
  // What a launch costs: one cracker, or every cracker waiting on the street for Burst all. Sparkler writing is free.
  function gemCost(s) {
    if (!s || s.writing || premium.active || chor.on) return 0; // Premium: every cracker is free; Pataka Chor's are found
    if (s.multi) return waitingItems().slice(0, burstMax()).reduce((sum, it) => sum + (GEM_COST[it.type] || 0), 0);
    if (s.ground || s.id.startsWith('item:')) return GEM_COST[s.type] || 0;
    return SHELL_GEM_COST[s.type] || 0;
  }
  // The daily gift grows with each day in a row: 10, 15, 20 … up to 40 gems.
  // One missed day a week is forgiven, as for the Light someone up diya, so a busy day doesn't reset the gift.
  const giftFor = (day) => Math.min(40, 10 + 5 * (day - 1));
  const chestFor = (day) => (day > 0 && day % 7 === 0 ? GEM_CHEST : 0); // every 7th day in a row: a bonus chest
  function dailyGems() {
    const today = dayKey();
    if (wallet.day === today) return;
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
    let saved = false;
    if (wallet.day === ago(1)) wallet.streak = (wallet.streak || 0) + 1;
    else if (wallet.day === ago(2) && !(wallet.grace > ago(graceDays()))) { wallet.streak = (wallet.streak || 0) + 1; wallet.grace = today; saved = true; }
    else wallet.streak = 1;
    wallet.day = today;
    const gift = giftFor(wallet.streak) * (festToday() ? 2 : 1) + chestFor(wallet.streak); // doubled in Diwali week
    for (const k of Object.keys(wallet.sky)) if (k < dayKey(new Date(Date.now() - 7 * 864e5))) delete wallet.sky[k];
    for (const k of Object.keys(wallet.vid)) if (k !== today) delete wallet.vid[k];
    wallet.b += gift; wallet.gift = gift; saveWallet(); syncGems(gift);
    festCheck(); // a new festival day on the Home tile
    // The gift screen when nothing else is up; mid-show or in a sheet, a toast instead.
    if (document.body.classList.contains('home') && sheets.every((s) => s.hidden) && $('#rewardsPanel').hidden) openGift(saved);
    else toast(`💎 +${fmtGems(gift)} ${wallet.streak > 1 ? `daily gems · day ${wallet.streak} in a row` : 'daily gems'}`, 3000);
  }
  function openGift(saved) {
    const day = wallet.streak || 1, week = Math.floor((day - 1) / 7) * 7;
    $('#giftTitle').textContent = chestFor(day) ? `Day ${day} in a row · bonus chest` : day > 1 ? `Day ${day} in a row` : 'Your daily gift';
    $('#giftAmount').textContent = `+${fmtGems(wallet.gift || giftFor(day))}`;
    $('#giftSaved').hidden = !saved;
    $('#giftFest').hidden = !festToday();
    const ask = askNotify();
    $('#giftRemind').hidden = !ask; $('#btnGiftCollect').hidden = ask;
    const row = $('#giftDays');
    row.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
      const n = week + i, li = document.createElement('li');
      li.className = (n < day ? 'done' : n === day ? 'today' : '') + (chestFor(n) ? ' chest' : '');
      li.innerHTML = '<small></small><b></b>';
      li.querySelector('small').textContent = n === day ? 'Today' : n === day + 1 ? 'Tomorrow' : `Day ${n}`;
      li.querySelector('b').textContent = `${chestFor(n) ? '🎁' : '💎'}${giftFor(n) + chestFor(n)}`;
      row.append(li);
    }
    $('#giftNext').textContent = `Come back tomorrow for 💎${giftFor(day + 1) + chestFor(day + 1)}`;
    renderGift();
    openSheet($('#giftModal'));
  }
  function renderGift() {
    const provider = rewardsProvider(), b = $('#btnGiftDouble');
    b.hidden = !videoOk(provider) || wallet.doubled === dayKey();
    b.disabled = rewardBusy;
    b.lastChild.textContent = `Double it · watch a video · +${fmtGems(wallet.gift || 10)}`;
  }
  // The evening reminder, so tomorrow's gift isn't missed. Where the phone must ask for notifications (Android 13+), the
  // gift sheet asks in the game's own words first, and only "Yes, remind me" leads to the system dialog. Never on TV.
  const askNotify = () => !wallet.remind && !wallet.remindNo && CFG.notifyAsk && !!(window.LUTSNative && window.LUTSNative.needsNotifyPermission)
    && !document.documentElement.classList.contains('tv');
  function collectGift(answer) {
    if (askNotify() && answer !== 'yes') { if (answer === 'no') { wallet.remindNo = true; saveWallet(); } }
    else if (!wallet.remind && !document.documentElement.classList.contains('tv')) { wallet.remind = true; saveWallet(); syncReminders(); }
    closeSheet($('#giftModal'));
  }
  async function doubleGift() {
    const provider = rewardsProvider(), today = dayKey();
    if (rewardBusy || !provider || wallet.doubled === today || wallet.day !== today) return;
    rewardBusy = true; renderGift();
    try {
      const receipt = await rewardTimeout(() => provider.watchAd({ gems: wallet.gift }));
      if (receipt && receipt.kind === 'ad' && await provider.verifyReceipt(receipt) === true && !wallet.tx.includes(`ad:${receipt.id}`)) {
        wallet.tx.push(`ad:${receipt.id}`); wallet.doubled = today;
        if (provider.acknowledgeReceipt) { try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* deduplicated by id */ } }
        addGems(wallet.gift, 'daily gift doubled');
        $('#giftAmount').textContent = `+${fmtGems(wallet.gift * 2)}`;
      }
    } catch (error) { toast(videoMiss(error)); }
    finally { rewardBusy = false; renderGift(); }
  }
  function joyGems() {
    if (wallet.joy === dayKey()) return;
    wallet.joy = dayKey();
    addGems(GEM_JOY, 'for sharing your light');
    festCheck(); // Choti Diwali's challenge
  }
  // Packs bought in the app: credit each store transaction once.
  function creditPurchases(credits) {
    if (!Array.isArray(credits)) return;
    let total = 0;
    for (const c of credits) {
      if (!c || typeof c.tx !== 'string' || !(c.gems > 0) || wallet.tx.includes(c.tx)) continue;
      wallet.tx.push(c.tx); total += Math.min(100000, Math.floor(c.gems));
      if (c.pack === STARTER.id) wallet.starter = true; // once only
    }
    if (total) { saveWallet(); addGems(total, 'added. Enjoy the show!'); renderGemSheet(); }
  }
  const nativeGems = () => !!(window.LUTSNative && typeof window.LUTSNative.premium === 'function' && window.LUTSNative.platform === 'android');
  let gemStore = { status: nativeGems() ? 'loading' : 'web', packs: [], message: '' }, gemNeed = null;
  window.addEventListener('luts:gems', (e) => {
    const st = e.detail || {};
    gemStore = { status: st.status || 'ready', packs: Array.isArray(st.packs) ? st.packs : [], message: st.message || '' };
    creditPurchases(st.credits);
    if (st.event === 'cancelled') toast('Purchase cancelled');
    if (st.event === 'pending') toast('Payment processing: your gems arrive automatically', 5000); // UPI can take minutes; don't buy again
    if (st.status === 'error' && st.message) toast(st.message, 3600);
    renderGemSheet();
    // Back to the launch the player was short for, now that they can afford it.
    if (st.event === 'purchased' && gemNeed && gems() >= gemNeed.cost) { const s = gemNeed.s; gemNeed = null; closeSheet($('#gemModal')); if (s) setTimeout(() => (s.multi ? $('#btnBurstAll').click() : requestFire()), 400); }
  });
  function openGems(need) {
    gemNeed = need || null;
    if (nativeGems() && gemStore.status !== 'purchasing') window.LUTSNative.premium('gems');
    renderGemSheet(true);
    openSheet($('#gemModal'));
  }
  // `opening`: the player is about to see the sheet, so the starter's 3 days may start (never while the sheet is closed).
  function renderGemSheet(opening) {
    const list = $('#gemPacks');
    if (!list) return;
    const short = gemNeed ? gemNeed.cost - gems() : 0;
    $('#gemTitle').textContent = short > 0 ? 'Not enough gems' : 'Gems';
    $('#gemSub').textContent = short > 0
      ? `${gemNeed.label} costs 💎${gemNeed.cost}. You need ${fmtGems(short)} more.`
      : 'The bigger crackers cost gems. Everyday crackers and sparkler writing are always free.';
    list.innerHTML = '';
    const store = gemStore.status !== 'web' && gemStore.packs.length ? gemStore.packs : null;
    const starter = store && !wallet.starter && store.find((x) => x.id === STARTER.id);
    if (starter && !wallet.starterAt) {
      if (opening === true || !$('#gemModal').hidden) { wallet.starterAt = Date.now(); saveWallet(); } // the 3 days start now
    }
    const hours = starter && wallet.starterAt ? Math.ceil((wallet.starterAt + STARTER_HOURS * 36e5 - Date.now()) / 36e5) : 0;
    const special = (pack, live, cls, note, icon) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `gem-pack ${cls}`; b.dataset.pack = pack.id;
      b.innerHTML = `<img class="gem-ico" src="assets/menu/glyphs/${icon}.webp" alt="" width="44" height="44"><span class="gem-text"><b></b><small></small></span><span class="gem-price"></span>`;
      b.querySelector('b').textContent = `${fmtGems(pack.gems)} gems`;
      b.querySelector('small').textContent = note;
      b.querySelector('.gem-price').textContent = live.price;
      b.disabled = gemStore.status === 'purchasing';
      b.addEventListener('click', () => { gemStore.status = 'purchasing'; renderGemSheet(); window.LUTSNative.premium('gems-buy', pack.id); });
      list.append(b);
    };
    const md = dayKey().slice(5), diwali = store && md >= DIWALI_BOX.from && md <= DIWALI_BOX.to && store.find((x) => x.id === DIWALI_BOX.id);
    // The starter first: it's once only and its clock is running.
    if (starter && hours > 0) special(STARTER, starter, 'starter', `${STARTER.name} · about 20 grand finales · once only · ends in ${hours} h`, 'gems_chest');
    if (diwali) special(DIWALI_BOX, diwali, 'diwali', `${DIWALI_BOX.name} · double gems until 25 Nov`, 'gems_vault');
    const mini = store && (wallet.starter || (wallet.starterAt && hours <= 0)) && store.find((x) => x.id === MINI.id);
    if (mini) special(MINI, mini, 'mini', MINI.name, 'gems_pouch');
    for (const p of GEM_PACKS) {
      const live = store ? store.find((x) => x.id === p.id) : null;
      if (store && !live) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = `gem-pack${p.best ? ' best' : ''}`; b.dataset.pack = p.id;
      b.innerHTML = `<img class="gem-ico" src="assets/menu/glyphs/${p.id}.webp" alt="" width="44" height="44"><span class="gem-text"><b></b><small></small></span><span class="gem-price"></span>`;
      b.querySelector('b').textContent = `${fmtGems(p.gems)} gems`;
      b.querySelector('small').textContent = [p.name, p.bonus && `${p.bonus} bonus`, p.best && 'best value'].filter(Boolean).join(' · ');
      b.querySelector('.gem-price').textContent = live ? live.price : 'In the app';
      b.disabled = gemStore.status === 'purchasing' || gemStore.status === 'loading' && !live;
      b.addEventListener('click', () => {
        if (live) { gemStore.status = 'purchasing'; renderGemSheet(); window.LUTSNative.premium('gems-buy', p.id); }
        else window.open(playLink('web'), '_blank', 'noopener');
      });
      list.append(b);
    }
    const status = $('#gemStatus');
    status.textContent = gemStore.status === 'loading' ? 'Loading prices…' : gemStore.status === 'purchasing' ? 'Waiting for Google Play…'
      : gemStore.status === 'unavailable' ? 'Gem packs aren’t available right now. Free gems still arrive every day.'
        : gemStore.status === 'web' ? 'Gem packs are sold in the Android app.' : '';
    const provider = rewardsProvider(), left = GEM_VIDEOS_A_DAY - (wallet.vid[dayKey()] || 0);
    const vid = $('#btnGemVideo');
    vid.hidden = !videoOk(provider);
    vid.disabled = left <= 0 || rewardBusy;
    $('#btnGemPremium').hidden = premium.active;
    const covers = short > 0 && short <= 25;
    vid.lastChild.textContent = left <= 0 ? 'Videos are done for today. Come back tomorrow'
      : covers ? `Watch a video · launch it free (${left} left today)` : `Watch a video · +${GEM_VIDEO} gems (${left} left today)`;
  }
  function gemBadge(chip, cost) {
    if (!cost) return;
    const e = document.createElement('em');
    e.className = cost >= 10 ? 'chip-gem vip' : 'chip-gem'; e.textContent = `💎${cost}`; e.setAttribute('aria-label', `${cost} gems`);
    chip.append(e);
  }
  $('#btnGems').addEventListener('click', () => openGems());
  $('#gemBack').addEventListener('click', () => closeSheet($('#gemModal')));
  $('#btnGemVideo').addEventListener('click', watchGemVideo);
  $('#premiumNudge').addEventListener('click', () => { $('#premiumNudge').hidden = true; openPremium({ ads: true }); });
  $('#btnGemPremium').addEventListener('click', () => { closeSheet($('#gemModal')); openPremium({ gems: true }); });
  $('#btnGiftCollect').addEventListener('click', () => collectGift());
  $('#btnRemindYes').addEventListener('click', () => collectGift('yes'));
  $('#btnRemindNo').addEventListener('click', () => collectGift('no'));
  $('#giftBack').addEventListener('click', () => collectGift());
  $('#btnGiftDouble').addEventListener('click', doubleGift);
  // Back in the app: the day's gift, and any purchase that finished meanwhile (a UPI payment that was still processing).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dailyGems(); if (nativeGems() && gemStore.status !== 'purchasing') window.LUTSNative.premium('gems'); } });
  syncGems();
  setTimeout(() => {
    dailyGems();
    if (!nativeGems()) return;
    window.LUTSNative.premium('gems');
    // RevenueCat attributes, to split buyers by language and phone tier (no personal data).
    const ram = navigator.deviceMemory ? String(navigator.deviceMemory) : '';
    window.LUTSNative.premium('attrs', [`lang\t${document.documentElement.lang || 'en'}`, ram && `ram_gb\t${ram}`].filter(Boolean).join('\n'));
  }, 1200);
  async function watchGemVideo() {
    const provider = rewardsProvider(), today = dayKey();
    if (rewardBusy || !provider || (wallet.vid[today] || 0) >= GEM_VIDEOS_A_DAY) return;
    rewardBusy = true; renderGemSheet();
    try {
      const need = gemNeed ? gemNeed.cost - gems() : 0, amount = Math.max(GEM_VIDEO, Math.min(25, need));
      const receipt = await rewardTimeout(() => provider.watchAd({ gems: amount }));
      if (receipt && receipt.kind === 'ad' && await provider.verifyReceipt(receipt) === true && !wallet.tx.includes(`ad:${receipt.id}`)) {
        wallet.tx.push(`ad:${receipt.id}`);
        wallet.vid[today] = (wallet.vid[today] || 0) + 1;
        if (provider.acknowledgeReceipt) { try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* deduplicated by id */ } }
        addGems(amount, 'for watching');
        // Short for a cracker: the video covers it, so straight back to the launch.
        if (gemNeed && gems() >= gemNeed.cost) { const s = gemNeed.s; gemNeed = null; closeSheet($('#gemModal')); if (s) setTimeout(() => (s.multi ? $('#btnBurstAll').click() : requestFire()), 400); }
      }
    } catch (error) { toast(videoMiss(error)); }
    finally { rewardBusy = false; renderGemSheet(); syncLaunchUi(); }
  }

  // ----- Diwali week: a festival challenge each day from Dhanteras to Bhai Dooj, and the daily gift doubled -----
  // The days follow the Diwali and Bhai Dooj dates in OCCASIONS, so another year needs only those dates.
  const FEST_GOALS = {
    lights: { text: 'Light 10 crackers', n: 10 }, joy: { text: 'Light someone up', n: 1 }, finale: { text: 'Launch a grand finale', n: 1 },
    daily: { text: 'Play today’s Daily Sky', n: 1 }, rockets: { text: 'Launch 5 rockets', n: 5 }, card: { text: 'Make a love card', n: 1 },
  };
  const FEST_SOON = 21; // the Home tile counts down from three weeks before
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  function festDays(year = new Date().getFullYear()) {
    const inYear = (o) => ((o && o.dates) || []).find((d) => d.startsWith(`${year}-`));
    const diwali = inYear(OCC_BY_ID.diwali), dooj = inYear(OCC_BY_ID.bhaidooj);
    if (!diwali || !dooj || dooj < addDays(diwali, 2)) return [];
    const days = [{ key: addDays(diwali, -2), name: 'Dhanteras', goal: 'lights', gems: 50 }, { key: addDays(diwali, -1), name: 'Choti Diwali', goal: 'joy', gems: 50 },
      { key: diwali, name: 'Diwali', goal: 'finale', gems: 100 }];
    for (let k = addDays(diwali, 1); k < addDays(dooj, -1); k = addDays(k, 1)) days.push({ key: k, name: 'Festival night', goal: 'daily', gems: 50 });
    days.push({ key: addDays(dooj, -1), name: 'Govardhan Puja', goal: 'rockets', gems: 50 }, { key: dooj, name: 'Bhai Dooj', goal: 'card', gems: 50 });
    return days;
  }
  const festToday = () => festDays().find((d) => d.key === dayKey()) || null;
  function festProgress(d) {
    if (d.goal === 'joy') { try { return wallet.joy === d.key || joys.some((j) => j.d === d.key) ? 1 : 0; } catch (e) { return 0; } } // lit someone up, shared or not
    if (d.goal === 'daily') { const st = loadRush(); return st.days && st.days[d.key] !== undefined ? 1 : 0; }
    if (d.goal === 'card') return myCards.some((e) => e.kind === 'made' && dayKey(new Date(e.created)) === d.key) ? 1 : 0;
    return Math.min(FEST_GOALS[d.goal].n, wallet.fest.c[d.key] || 0);
  }
  // Crackers the player lit (by type), counted toward today's challenge when it is about launches.
  function festLaunched(types) {
    const d = festToday();
    if (!d || wallet.fest.done[d.key]) return;
    const hits = types.filter((t) => d.goal === 'lights' || (d.goal === 'rockets' && /^rocket/.test(t)) || (d.goal === 'finale' && t === 'finale')).length;
    if (!hits) return;
    wallet.fest.c[d.key] = (wallet.fest.c[d.key] || 0) + hits; saveWallet();
    festCheck();
  }
  function festCheck() {
    const d = festToday();
    if (d && !wallet.fest.done[d.key] && festProgress(d) >= FEST_GOALS[d.goal].n) {
      wallet.fest.done[d.key] = true;
      addGems(d.gems, 'for today’s festival challenge');
    }
    renderFest();
  }
  function renderFest() {
    const days = festDays(), today = dayKey(), tile = $('#btnFest');
    const first = days[0], last = days[days.length - 1];
    const soon = first && today < first.key && addDays(today, FEST_SOON) >= first.key;
    tile.hidden = !(soon || (first && today >= first.key && today <= last.key));
    if (tile.hidden) return;
    const d = festToday(), small = $('#tileFest'), badge = $('#badgeFest');
    small.innerHTML = '';
    const part = (t) => { const s = document.createElement('span'); s.textContent = t; small.append(s); };
    if (soon) {
      const n = Math.round((new Date(`${first.key}T12:00`) - new Date(`${today}T12:00`)) / 864e5);
      part(n === 1 ? 'Starts tomorrow · double daily gifts' : `Starts in ${n} days · double daily gifts`);
      badge.textContent = 'Soon';
    } else if (d) {
      const done = !!wallet.fest.done[d.key], g = FEST_GOALS[d.goal];
      part(d.name); small.append(': ');
      if (done) part(d === last ? 'Done · Happy Diwali!' : 'Done · come back tomorrow');
      else { part(g.text); small.append(g.n > 1 ? ` · ${festProgress(d)}/${g.n} · 💎${d.gems}` : ` · 💎${d.gems}`); }
      badge.textContent = done ? '✓' : 'Today';
    } else { part('Festival night'); badge.textContent = 'Today'; }
    tile.classList.toggle('soon', !!d && !wallet.fest.done[d.key]);
    badge.classList.toggle('done', !!d && !!wallet.fest.done[d.key]);
    if (!$('#festModal').hidden) renderFestSheet();
  }
  function renderFestSheet() {
    const list = $('#festDays'), today = dayKey();
    list.innerHTML = '';
    for (const d of festDays()) {
      const done = !!wallet.fest.done[d.key], g = FEST_GOALS[d.goal], [, m, dd] = d.key.split('-').map(Number);
      const li = document.createElement('li');
      li.className = 'sheet-row fest-day' + (d.key === today ? ' soon' : '') + (done ? ' done' : d.key < today ? ' missed' : '');
      li.innerHTML = '<span class="row-avatar" aria-hidden="true"></span><span class="row-text"><b></b><small></small></span><span class="fest-reward"></span>';
      li.querySelector('.row-avatar').textContent = done ? '✓' : '🪔';
      li.querySelector('b').textContent = d.name;
      const when = document.createElement('span'), what = document.createElement('span'); // each part translated alone
      when.textContent = `${dd} ${MONTHS[m - 1].slice(0, 3)}`; what.textContent = g.text;
      li.querySelector('small').append(when, ' · ', what);
      li.querySelector('.fest-reward').textContent = done ? 'Done' : d.key < today ? 'Missed' : d.key === today && g.n > 1 ? `${festProgress(d)}/${g.n} · 💎${d.gems}` : `💎${d.gems}`;
      list.append(li);
    }
    $('#btnFestPremium').hidden = premium.active;
  }
  function openFest() { renderFestSheet(); openSheet($('#festModal')); }
  // Festival mornings on the phone, through the card reminders (which ring at 9 am the day before the date sent).
  function festReminderLines() {
    const flat = (s) => String(s).replace(/[\t\r\n]+/g, ' ').trim(), today = dayKey(), days = festDays(), lines = [];
    const at = (id, key, title, body) => {
      if (key < today) return;
      const [y, m, d] = addDays(key, 1).split('-').map(Number);
      lines.push(['#card', id, m, d, y, flat(title), flat(body)].join('\t'));
    };
    if (days.length) at('fest-start', addDays(days[0].key, -1), inLang('🪔 Diwali week starts tomorrow'), inLang(`${days.length} festival challenges and double daily gifts`));
    for (const d of days) at(`fest-${d.key}`, d.key, `🪔 ${inLang(d.name)}: ${inLang('today’s festival challenge is ready')}`, `${inLang(FEST_GOALS[d.goal].text)} · 💎${d.gems}`);
    return lines;
  }
  $('#btnFest').addEventListener('click', openFest);
  $('#festBack').addEventListener('click', () => closeSheet($('#festModal')));
  $('#btnFestPremium').addEventListener('click', () => { closeSheet($('#festModal')); openPremium({ diwali: true }); });

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
    // One "id<TAB>month<TAB>day<TAB>name" line each (names never hold tabs or line breaks; see clean()), and once the
    // player has lit someone up, "#evening<TAB>day of the last show" for the 7:30 pm Light someone up reminder.
    if (!nativeReminders()) return;
    const lines = friends.map((f) => [f.id, f.m, f.d, f.name].join('\t')).concat(cardReminderLines(), wallet.remind ? festReminderLines() : []); // and "#card…" lines: your cards' days, Diwali week
    let lit = '';
    try { lit = joys.length ? joys.reduce((a, j) => (j.d > a ? j.d : a), '') : ''; } catch (e) { /* not loaded yet at start-up */ }
    // The evening reminder's words in the player's language (the phone falls back to English without them).
    // The evening reminder's hook changes each day (tomorrow's, since it is set tonight): the week's heist, the Daily
    // Diya, the goals, the Love Sky Wall, Mela Night, and the player's own (their diya or their gift) in between.
    const own = lit ? [inLang('🪔 Who will you light up tonight?'), inLang('Write someone you love across the sky and keep your diya burning')]
      : [inLang('🎁 Your daily gems are waiting'), inLang('Collect today’s gift and play the Daily Sky before midnight to keep your streak')];
    const tr = window.PatakaChor && PatakaChor.treasure ? PatakaChor.treasure() : null;
    const hooks = [own,
      tr ? [inLang(`${tr[2]} The ${tr[1]} is still in Seth-ji's vault`), inLang('Find the 9 key pieces and steal it before the week ends')] : own,
      [inLang('🪔 Today’s Diya Path puzzle is waiting'), inLang('A new board for everyone. Can you solve it in fewer moves?')],
      [inLang('🎯 Four new goals today'), inLang('Two are about the people you love. Claim the gems before midnight')],
      [inLang('💌 Someone could use a love note tonight'), inLang('Pick a reason to love, light it in the sky, and send the video')],
      [inLang('🛕 Fireworks with friends tonight?'), inLang('Up to four at a temple on Mela Night. Most hearts wins')]];
    const t = new Date(Date.now() + 864e5), h = hooks[(t.getFullYear() * 400 + t.getMonth() * 31 + t.getDate()) % hooks.length];
    if (lit) lines.push(`#evening\t${lit}\t\t${h[0]}\t${h[1]}`);
    else if (wallet.remind && wallet.day) lines.push(`#evening\t${wallet.day}\tgift\t${h[0]}\t${h[1]}`);
    window.LUTSNative.reminders(lines.join('\n'));
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
    card.o = o.id; card.h = o.head; card.m = o.msg; card.p = o.theme; card.t = f.name; card.rel = ''; card.friend = f.id; card.id = ''; card.pg = []; card.rm = null; // a new card in My Cards (their birthday reminds you already)
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

  // ----- Light Someone Up (grown from Daily joy) -----
  // Once a day (or more) the player dedicates a fireworks show to someone: a reason, a name, today's landmark.
  // Entries keep Daily joy's shape ({d, mood, t, m}) plus r (reason id) and w (the landmark it lit up).
  const REASONS = [
    { id: 'grateful', icon: '🙏', label: 'Grateful for', palette: 'gold' },
    { id: 'celebrate', icon: '🎉', label: 'Celebrating', palette: 'festive' },
    { id: 'proud', icon: '🌟', label: 'Proud of', palette: 'rainbow' },
    { id: 'missing', icon: '💛', label: 'Missing', palette: 'ocean' },
    { id: 'getwell', icon: '🌿', label: 'Get well soon,', palette: 'classic' },
    { id: 'thanks', icon: '💐', label: 'Thank you,', palette: 'festive' },
  ];
  const REASON_BY_ID = Object.fromEntries(REASONS.map((r) => [r.id, r]));
  const reasonOf = (j) => REASON_BY_ID[j.r] || REASON_BY_ID.grateful;
  // Everyone lights up the same landmark on the same day.
  const LANDMARKS = WORLDS.filter((w) => w.image);
  const todayLandmark = () => {
    const d = new Date(), n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    return LANDMARKS.at(n % LANDMARKS.length);
  };
  let joys = loadList(JOY_KEY).filter((j) => j && /^\d{4}-\d\d-\d\d$/.test(j.d) && j.mood >= 1 && j.mood <= 5 && typeof j.t === 'string');
  syncReminders(); // the evening reminder knows about the last show from the start
  const todayJoys = () => joys.filter((j) => j.d === dayKey());
  const todayJoy = () => todayJoys().at(-1);
  // Days in a row, ending today, or yesterday while today is still to do. One missed day a week is forgiven, so a
  // busy day dims the streak diya instead of putting it out.
  function joyStreak() {
    const days = new Set(joys.map((j) => j.d)), dt = new Date();
    if (!days.has(dayKey(dt))) dt.setDate(dt.getDate() - 1);
    let n = 0, sinceGrace = 7;
    for (;;) {
      if (days.has(dayKey(dt))) { n++; sinceGrace++; }
      else {
        const before = new Date(dt); before.setDate(before.getDate() - 1);
        if (n === 0 || sinceGrace < graceDays() || !days.has(dayKey(before))) break;
        sinceGrace = 0; // the forgiven day: the streak carries on past it
      }
      dt.setDate(dt.getDate() - 1);
    }
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
    return Math.max(best, joyStreak()); // a forgiven day can make today's run the longest
  }
  let joyReason = 'grateful';
  REASONS.forEach((r) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mood reason'; b.setAttribute('role', 'radio'); b.dataset.reason = r.id;
    b.innerHTML = `<img class="mood-art" src="assets/menu/glyphs/${r.id}.webp" alt="" width="40" height="40"><small>${r.label.replace(/,$/, '')}</small>`;
    b.addEventListener('click', () => { joyReason = r.id; renderMoods(); });
    $('#joyMoods').append(b);
  });
  function renderMoods() {
    for (const b of $('#joyMoods').children) { const on = b.dataset.reason === joyReason; b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); }
  }
  const dedication = (j) => `${reasonOf(j).label} ${j.t}`; // e.g. Grateful for Amma; Thank you, Amma
  function renderJoy() {
    const n = joyStreak(), best = bestStreak(), today = todayJoy(), place = todayLandmark();
    $('#joyStreak').innerHTML = '';
    $('#joyStreak').style.setProperty('--diya', String(Math.min(1, 0.35 + n / 14))); // the streak diya burns brighter each day
    const diya = document.createElement('span'); diya.className = 'streak-diya'; diya.setAttribute('aria-hidden', 'true'); diya.textContent = '🪔';
    const big = document.createElement('b');
    big.textContent = n ? `${n}-day streak` : 'Light your first diya today';
    const sm = document.createElement('small');
    const people = new Set(joys.map((j) => j.t.toLowerCase())).size;
    sm.textContent = joys.length ? `Best ${best} ${best === 1 ? 'day' : 'days'} · ${people} ${people === 1 ? 'person' : 'people'} lit up` : 'Come back each day to keep the diya burning';
    const where = document.createElement('small'); where.className = 'streak-place'; where.textContent = place ? `Tonight’s sky: ${place.name}` : '';
    $('#joyStreak').append(diya, big, sm, where);
    $('#joyToday').hidden = !today;
    if (today) {
      $('#joyToday').innerHTML = '';
      const h = document.createElement('b'); h.textContent = `${reasonOf(today).icon} ${dedication(today)}`;
      const p2 = document.createElement('small'); p2.textContent = todayJoys().length > 1 ? `${todayJoys().length} people lit up today` : 'Lit up today. Light up someone else too?';
      const share = document.createElement('button');
      share.type = 'button'; share.className = 'btn ghost small'; share.innerHTML = '<span class="btn-ico share-glyph" aria-hidden="true"></span>Share';
      share.addEventListener('click', () => shareJoy(today, n));
      $('#joyToday').append(h, p2, share);
    }
    renderMoods();
    syncJoyButton();
    if (!$('#joyFrom').value) $('#joyFrom').value = savedName();
    renderJoyCal();
    const past = joys.filter((j) => j !== today).slice(-30).reverse();
    $('#joyHistoryWrap').hidden = !past.length;
    $('#joyHistory').innerHTML = '';
    for (const j of past) {
      const li = document.createElement('li');
      li.className = 'sheet-row';
      const face = document.createElement('span'); face.className = 'row-avatar';
      if (j.r) face.innerHTML = `<img class="row-art" src="assets/menu/glyphs/${reasonOf(j).id}.webp" alt="" width="32" height="32">`;
      else face.textContent = MOODS[j.mood - 1][0];
      const text = document.createElement('span'); text.className = 'row-text';
      const b = document.createElement('b'); b.textContent = dedication(j);
      const sm2 = document.createElement('small'); sm2.textContent = niceDate(j.d);
      text.append(b, sm2);
      li.append(face, text);
      $('#joyHistory').append(li);
    }
    updateHomeTiles();
  }
  // The gratitude calendar: each day someone was lit up shows a small burst in that reason's colours (tap to play it
  // again); today, still empty, is a dashed circle that jumps to the form; other empty days stay empty.
  const BURST = { gold: '#ffd27a', festive: '#ff7a45', rainbow: '#c58bff', ocean: '#7cf7ff', classic: '#9dff6b' };
  let calMonth = null;
  function burstSvg(color) {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r1 = i % 2 ? 4 : 5, r2 = i % 2 ? 8 : 11;
      rays += `<line x1="${(12 + Math.cos(a) * r1).toFixed(1)}" y1="${(12 + Math.sin(a) * r1).toFixed(1)}" x2="${(12 + Math.cos(a) * r2).toFixed(1)}" y2="${(12 + Math.sin(a) * r2).toFixed(1)}"/>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="${color}" stroke-width="1.6" stroke-linecap="round">${rays}</g><circle cx="12" cy="12" r="2.2" fill="#fff"/></svg>`;
  }
  function renderJoyCal() {
    const now = new Date(), lang = document.documentElement.lang || 'en';
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = calMonth.getFullYear(), m = calMonth.getMonth(), todayKey = dayKey(now);
    $('#joyCalMonth').textContent = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(calMonth);
    const first = joys.reduce((a, j) => (j.d < a ? j.d : a), todayKey);
    $('#joyCalPrev').disabled = dayKey(new Date(y, m, 0)) < first;
    $('#joyCalNext').disabled = y === now.getFullYear() && m === now.getMonth();
    const byDay = new Map();
    for (const j of joys) if (j.d.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)) (byDay.get(j.d) || byDay.set(j.d, []).get(j.d)).push(j);
    const grid = $('#joyCalGrid');
    grid.innerHTML = '';
    const wd = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
    for (let i = 0; i < 7; i++) { const h = document.createElement('span'); h.className = 'joy-cal-wd'; h.textContent = wd.format(new Date(2026, 1, 1 + i)); grid.append(h); } // 1 Feb 2026 is a Sunday
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) grid.append(document.createElement('span'));
    const days = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const key = dayKey(new Date(y, m, d)), list = byDay.get(key), cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'joy-cal-day';
      const num = document.createElement('small'); num.textContent = String(d);
      cell.append(num);
      if (list) {
        const j = list.at(-1);
        cell.classList.add('lit');
        cell.insertAdjacentHTML('beforeend', burstSvg(BURST[j.r ? reasonOf(j).palette : MOODS[j.mood - 1][2]] || BURST.gold));
        cell.setAttribute('aria-label', `${niceDate(key)}: ${list.map(dedication).join(', ')}`);
        cell.title = list.map(dedication).join(', ');
        cell.addEventListener('click', () => playJoy(j));
      } else if (key === todayKey) {
        cell.classList.add('today');
        cell.setAttribute('aria-label', 'Today: light someone up');
        cell.addEventListener('click', () => $('#joyText').focus());
      } else cell.disabled = true;
      if (key > todayKey) cell.classList.add('future');
      grid.append(cell);
    }
  }
  $('#joyCalPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderJoyCal(); });
  $('#joyCalNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderJoyCal(); });
  // With a name typed it lights up someone new; with the field empty after today's show, it plays that show again.
  function syncJoyButton() {
    const typed = !!clean($('#joyText').value, 20), today = todayJoy();
    $('#btnJoyGo').innerHTML = `<span class="btn-ico firework-glyph" aria-hidden="true"></span>${today && !typed ? 'Play it again' : 'Light them up'}`;
  }
  $('#joyText').addEventListener('input', syncJoyButton);
  $('#joyText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btnJoyGo').click(); } });
  $('#btnJoyGo').addEventListener('click', () => {
    Sound.resume();
    let j = todayJoy();
    const typed = clean($('#joyText').value, 20);
    if (!j || typed) {
      const t = typed, fld = $('#joyText').closest('.field');
      if (!t) { fld.classList.remove('invalid'); void fld.offsetWidth; fld.classList.add('invalid'); $('#joyText').focus(); return; }
      const place = todayLandmark(), from = clean($('#joyFrom').value, 20);
      if (from) { try { localStorage.setItem('luts:from', from); } catch (e) { /* ignore */ } } // signs the shared link
      j = { d: dayKey(), mood: 4, r: joyReason, t, m: cleanMsg($('#joyNote').value, 120), w: place ? place.id : '' };
      joys.push(j);
      if (joys.length > 400) joys = joys.slice(-400);
      saveList(JOY_KEY, joys);
      syncReminders(); // today is done: no reminder tonight
      festCheck(); // Choti Diwali's challenge
      $('#joyText').value = ''; $('#joyNote').value = '';
      const n = joyStreak();
      if (window.LUTSGoals) LUTSGoals.tick('joy'); achieve('joy1');
      festPoints('joy', 40);
      gratitudeLit();
      postScores(joyScores());
      if (n >= 3) achieve('joy3');
      if (n >= 7) achieve('joy7');
      if (n >= 30) achieve('joy30');
      if (n > 1) toast(`🔥 ${n}-day streak! Keep the light going.`, 3000);
    }
    closeSheets();
    hideOverlay($('#intro'));
    playJoy(j);
  });
  // Sends a dedication as a link that plays it (the web game opens straight into the show) and, when its video is
  // already made, the video too, so it plays in WhatsApp without a tap.
  function dedicationUrl(j) {
    const r = reasonOf(j);
    const data = { o: 'thanks', t: j.t, f: savedName(), h: r.label.replace(/,$/, ''), m: j.m || `${dedication(j)}.`, p: j.r ? r.palette : MOODS[j.mood - 1][2], w: j.w || '', lit: 1 };
    return `${linkBase()}#card=${encodeCard(data)}`;
  }
  function openLightBack(name) {
    hideOverlay($('#intro'));
    renderJoy();
    joyReason = 'thanks'; renderMoods();
    $('#joyText').value = name || ''; syncJoyButton();
    openSheet($('#joyModal'));
    if (!name) $('#joyText').focus();
  }
  function playJoy(j) {
    const r = reasonOf(j), palette = j.r ? r.palette : MOODS[j.mood - 1][2];
    playAndKeep({ kind: 'joy', o: 'thanks', t: j.t, h: r.label.replace(/,$/, ''), m: j.m || `${dedication(j)}.`, f: '', p: palette, w: j.w || '', img: '', own: true, day: joyStreak(), mood: j.mood, r: j.r, date: j.d });
  }
  // Shares today's dedication, with the app link for friends to light up someone of their own.
  async function shareJoy(j, day) {
    const text = `${reasonOf(j).icon} ${dedication(j)}. Day ${day || joyStreak()} of lighting up someone in fireworks ✨\nWatch it, and light someone up too:`;
    const url = dedicationUrl(j);
    const kept = readyVideo && readyVideo.card && readyVideo.card.kind === 'joy' && readyVideo.card.t === j.t && readyVideo.blob;
    const file = kept ? new File([readyVideo.blob], readyVideo.name || 'light-someone-up.mp4', { type: readyVideo.type || 'video/mp4' }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Light someone up', text: `${text}\n${url}${getApp('dedication')}` });
      else {
        const r = reasonOf(j);
        const blob = shareCard({ art: worldArt(j.w, 'assets/menu/daily-joy.jpg'), kicker: `${r.icon} Lit up in fireworks`, title: `${r.label} ${j.t}`, line: `Day ${day || joyStreak()} of lighting up someone` });
        if (!(await shareThing({ title: 'Light someone up', text, url, blob, name: 'light-someone-up.png', src: 'dedication' }))) return;
        if (window.LUTSGoals) LUTSGoals.tick('share'); achieve('share');
        joyGems(); // gems for sharing who you lit up, once a day
        return;
      }
      if (window.LUTSGoals) LUTSGoals.tick('share'); achieve('share');
      joyGems();
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
    $('#tileJoy').textContent = done ? `🪔 ${n} ${n === 1 ? 'day' : 'days'} · lit today` : n ? `🪔 ${n}-day streak · light someone up` : 'Who are you grateful for?';
    syncRushTiles();
    renderFest();
  }

  // First play: three things to try, once.
  function maybeWelcome() {
    let seen = true;
    try { seen = localStorage.getItem('luts:welcomed') === '1'; localStorage.setItem('luts:welcomed', '1'); } catch (e) { /* storage unavailable: skip it */ }
    if (!seen) setTimeout(() => { if (mode === 'play') openSheet($('#welcomeModal')); }, 900);
  }
  $('#btnWelcome').addEventListener('click', () => closeSheet($('#welcomeModal')));
  $('#btnWelcomeX').addEventListener('click', () => closeSheet($('#welcomeModal')));
  $('#btnTrialX').addEventListener('click', () => { $('#crackerTrial').hidden = true; });
  $('#btnArSafeX').addEventListener('click', () => { $('#btnArSafeCancel').click(); $('#arSafety').hidden = true; });
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
  // Consecutive days with a Daily Sky (or a solved Daily Diya or Daily Rocket), counting today once it is played.
  // One missed day a week is forgiven, as for the streak diya.
  function dailyStreak(st = loadRush()) {
    const days = st.days || {}, diya = st.diya || {}, rocket = st.rocket || {}, d = new Date();
    const has = (dt) => days[dayKey(dt)] !== undefined || !!diya[dayKey(dt)] || !!rocket[dayKey(dt)];
    if (!has(d)) d.setDate(d.getDate() - 1);
    let n = 0, sinceGrace = 7;
    for (;;) {
      if (has(d)) { n++; sinceGrace++; }
      else {
        const before = new Date(d); before.setDate(before.getDate() - 1);
        if (n === 0 || sinceGrace < graceDays() || !has(before)) break;
        sinceGrace = 0;
      }
      d.setDate(d.getDate() - 1);
    }
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
    if (!rush.on || rush.kind === 'duel') return; // a Sky Duel keeps its own clock (duel.js)
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
  // How far a tap or a burst reaches a lantern: a fingertip's width round the lantern, on any screen.
  const rushReach = () => Math.max(68, 96 * U);
  // A burst from your tap: every lantern it reaches lights up and scores; reaching none breaks the run.
  function rushBurst(s) {
    if (rush.t < 0) return;
    const R = rushReach();
    const hits = rush.live.filter((l) => (s.aim && s.aim.includes(l)) || Math.hypot(l.x - s.x, l.y - s.y) < R);
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
    if (rush.kind === 'duel') { // left mid-duel (Home, another mode) or duel.js ended it
      document.body.classList.remove('rushing', 'dueling');
      if (quit && duelHooks.quit) duelHooks.quit();
      return;
    }
    document.body.classList.remove('rushing');
    $('#rushHud').hidden = true;
    rush.live = []; rush.pops = [];
    if (quit) return;
    adBreak('break'); // the round's result waits under the video
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
    if (r.kind === 'daily') festCheck(); // a festival night's challenge
    rush.last = r;
    if (r.kind === 'daily') { postScores(`daily:${r.score}`); festPoints('daily', starsFor(r.score) * 100); }
    if (window.LUTSGoals) LUTSGoals.tick('rush'); achieve('rush');
    if (r.kind === 'daily' && dailyStreak(st) >= 7) achieve('daily7');
    const won = r.vs && r.score > r.vs.s;
    if (won) { achieve('rival'); festPoints('rival', 50); }
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
  // Every share carries the Play link, so whoever receives it can install the game: the card or challenge link first
  // (it opens what was shared), then "Get the app: …" tagged with where it was shared from (src).
  const getApp = (src) => `\nGet the app: ${playLink(src)}\n${TAG_LINE}`;
  async function shareThing({ title, text, url, blob, name, src }) {
    if (blob instanceof Promise) blob = await blob.catch(() => null);
    if (src && !/play\.google\.com/.test(url || '')) { // apps put a separate url last, so it goes into the text, before the Play line
      text = `${url ? `${text}\n${url}` : text}${getApp(src)}`; url = '';
    }
    if (window.LUTSGoals && src !== 'wall') LUTSGoals.tick('share');
    const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
    if (file) setShareCaption(url ? `${text}\n${url}` : text); // the Android app sends it with the picture
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title, text: url ? `${text}\n${url}` : text });
      else if (navigator.share) await navigator.share(url ? { title, text, url } : { title, text });
      else {
        if (blob) download(blob, name);
        const ok = await copyText(url ? `${text} ${url}` : text);
        toast(blob ? (ok ? 'Picture saved and its text copied. Share them anywhere.' : 'Picture saved') : ok ? 'Copied. Paste it anywhere to share.' : 'Could not copy');
      }
    } catch (e) { return false; } // cancelled
    countLight();
    return true;
  }
  $('#btnRushShare').addEventListener('click', () => {
    const r = rush.last;
    if (!r) return;
    const text = `🏮 Light Up the Skies · Daily Sky #${dailyNo()}\n${starText(starsFor(r.score))} ${fmt(r.score)} points · ${r.best} in a row · 🔥 ${dailyStreak()}\nPlay today’s sky:`;
    const blob = shareCard({ art: 'assets/menu/daily-sky.jpg', kicker: `Daily Sky #${dailyNo()}`, title: placeName(r.world), big: fmt(r.score), stars: starsFor(r.score), line: `${r.best} in a row · 🔥 ${dailyStreak()}-day streak` });
    shareThing({ title: `Daily Sky #${dailyNo()}`, text, url: rushLink('daily'), blob, name: `daily-sky-${dailyNo()}.png`, src: 'daily' });
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
    const won = r.vs && r.score > r.vs.s;
    const blob = shareCard({ art: 'assets/menu/challenge.jpg', kicker: won ? `${who} won the challenge` : `${name || 'A friend'} challenges you`, title: 'Can you beat it?', big: fmt(r.score), line: `Same lanterns over ${placeName(r.world)} · 30 seconds` });
    shareThing({ title: 'Lantern Rush challenge', text, url: link, blob, name: 'lantern-rush-challenge.png', src: 'challenge' });
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

  // One branded picture for every share (results, challenges, badges, cards, invites): the moment's art, its headline
  // and score, and the app's icon and name with Gem Creators at the bottom, sized for WhatsApp status and the like.
  const APP_NAME = 'Light Up the Skies: Diwali', MAKER = 'Gem Creators';
  const worldArt = (id, fallback) => (isWorld(id) && WORLD_BY_ID[id].image ? `assets/worlds/bg/${WORLD_BY_ID[id].image}.jpg` : fallback);
  const artCache = new Map();
  const loadArt = (src) => {
    if (!artCache.has(src)) artCache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
    return artCache.get(src);
  };
  async function shareCard({ kicker = '', title = '', big = '', stars = -1, line = '', art = '', emoji = '' }) {
    if (document.fonts && document.fonts.load) await Promise.all(['700 78px Cinzel', '300 38px Outfit', '600 36px Outfit'].map((f) => document.fonts.load(f).catch(() => {})));
    const [pic, icon] = await Promise.all([art ? loadArt(art) : null, loadArt('assets/icons/icon-512.png')]);
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1350);
    bg.addColorStop(0, '#2a1f5e'); bg.addColorStop(0.6, '#120f33'); bg.addColorStop(1, '#07071a');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    const cy = big ? 380 : 470, rr = big ? 190 : 230; // the art sits higher when a score needs room
    g.save();
    g.translate(540, cy);
    for (let i = 0; i < 24; i++) {
      g.rotate(TAU / 24);
      g.fillStyle = i % 2 ? 'rgba(255,210,122,0.07)' : 'rgba(255,160,90,0.03)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-70, -760); g.lineTo(70, -760); g.closePath(); g.fill();
    }
    g.restore();
    // A few sparks around the art, so it reads as fireworks even small.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, d = rr + 50 + (i % 3) * 16;
      g.fillStyle = ['#ffd36b', '#ff7ab8', '#7fe3ff'][i % 3];
      g.beginPath(); g.arc(540 + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + (i % 2) * 2, 0, TAU); g.fill();
    }
    const glow = g.createRadialGradient(540, cy, 40, 540, cy, rr + 120);
    glow.addColorStop(0, 'rgba(255,214,120,0.5)'); glow.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 1080, 1350);
    const ring = g.createLinearGradient(540 - rr, cy - rr, 540 + rr, cy + rr);
    ring.addColorStop(0, '#fff0bf'); ring.addColorStop(0.5, '#ffc95c'); ring.addColorStop(1, '#d98a1c');
    g.fillStyle = ring; g.beginPath(); g.arc(540, cy, rr, 0, TAU); g.fill();
    g.fillStyle = '#1b1745'; g.beginPath(); g.arc(540, cy, rr - 26, 0, TAU); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (pic) {
      const r = rr - 26, k = Math.max((2 * r) / pic.naturalWidth, (2 * r) / pic.naturalHeight);
      g.save(); g.beginPath(); g.arc(540, cy, r, 0, TAU); g.clip();
      g.drawImage(pic, 540 - (pic.naturalWidth * k) / 2, cy - (pic.naturalHeight * k) / 2, pic.naturalWidth * k, pic.naturalHeight * k);
      g.restore();
    } else if (emoji) {
      g.font = `${Math.round(rr * 0.82)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      g.fillText(emoji, 540, cy + 12);
    }
    let y = cy + rr + 92;
    if (kicker) { g.fillStyle = '#c9c6e6'; g.font = '600 34px Outfit, sans-serif'; g.fillText(kicker.toUpperCase(), 540, y, 960); y += 84; }
    const gold = (y0, y1) => { const t = g.createLinearGradient(0, y0, 0, y1); t.addColorStop(0, '#fff2c4'); t.addColorStop(1, '#f2a83a'); return t; };
    if (title) { g.fillStyle = gold(y - 40, y + 40); g.font = '700 72px Cinzel, Georgia, serif'; g.fillText(title, 540, y, 960); y += big ? 116 : 96; }
    if (big) { g.fillStyle = gold(y - 60, y + 70); g.font = '700 150px Cinzel, Georgia, serif'; g.fillText(big, 540, y + 20, 960); y += 140; }
    if (stars >= 0) {
      g.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      for (let i = 0; i < 3; i++) {
        const x = 540 + (i - 1) * 86;
        if (i < stars) g.fillText('⭐', x, y);
        else { g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '700 70px Outfit, sans-serif'; g.fillText('☆', x, y + 2); g.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; }
      }
      y += 84;
    }
    if (line) { g.fillStyle = '#ebe5fb'; g.font = '300 38px Outfit, sans-serif'; g.fillText(line, 540, y, 960); }
    // The footer: app icon, app name, and the maker.
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 1178, 1080, 172);
    g.fillStyle = 'rgba(255,210,122,0.35)'; g.fillRect(0, 1178, 1080, 2);
    if (icon) { g.save(); roundRect(g, 70, 1199, 130, 130, 30); g.clip(); g.drawImage(icon, 70, 1199, 130, 130); g.restore(); }
    g.textAlign = 'left';
    g.fillStyle = '#ffd77e'; g.font = '700 46px Cinzel, Georgia, serif';
    g.fillText(APP_NAME, 228, 1240, 800);
    g.fillStyle = '#d2cdea'; g.font = '400 30px Outfit, sans-serif';
    g.fillText(`by ${MAKER} · ${window.LUTSNative ? 'free on Google Play' : appLink().replace(/^https?:\/\//, '').replace(/\/$/, '')}`, 228, 1292, 800);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  const badgeImage = (a) => shareCard({ emoji: a[1], kicker: 'Achievement unlocked', title: a[2], line: a[3] });
  async function shareBadge(id) {
    const a = ACH.find((x) => x[0] === id);
    if (!a || !achieved[id]) return;
    const blob = await badgeImage(a);
    shareThing({ title: a[2], text: `${a[1]} I unlocked “${a[2]}” in Light Up the Skies: ${a[3].charAt(0).toLowerCase()}${a[3].slice(1)}!`, url: appLink(), blob, name: `light-up-the-skies-${id}.png`, src: 'badge' });
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
    $('#badgeDaily').textContent = today !== undefined ? '✓' : 'Today';
    $('#badgeDaily').classList.toggle('done', today !== undefined);
    $('#tileDaily').textContent = today !== undefined ? `#${n} · ${starText(starsFor(today))} ${fmt(today)}` : streak ? `#${n} · 🔥 ${streak} · play today` : `#${n} · today’s lanterns`;
    $('#tileRush').textContent = st.best ? `Best ${fmt(st.best)} · dare a friend` : 'Beat a friend’s score';
  }

  // Leaving the show for another screen (home, a card, a puzzle): the camera AR and room AR end, the 3D scene and the
  // animated sky are let go at once (the frame loop rests behind a full-screen sheet, so it might not get to it), and,
  // off the stage entirely, the firework layers are emptied, so a phone low on memory gets it back straight away.
  function freeShowResources(offStage = true) {
    if (roomAr) stopRoomAr();
    if (arOn) stopAR();
    try { syncWorld3d(); } catch (error) { world3dLost(error); }
    if (liveSky && !liveShown()) liveSky.stop();
    if (offStage) for (const g of [ctx, glx, gctx, actx, flightCtx]) g.clearRect(0, 0, W, H);
  }
  // The logo takes you back home from anywhere.
  $('#btnHome').addEventListener('click', () => {
    abortLaunch();
    if (rush.on) endRush(true);
    restoreRushWorld();
    closeDrawer(); closeCardModal(); closeSheets();
    if (mode === 'card' || mode === 'envelope') { $('#envelope').hidden = true; exitCardMode(); }
    mode = 'intro';
    // No video here: Play's policy bars an ad between a tap and what the player tapped for.
    updateHomeTiles();
    $('#intro').classList.remove('leaving');
    $('#intro').hidden = false;
    document.body.classList.add('home');
    freeShowResources();
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
  // On the 3D background you can also drag to look around (not while drawing with the sparkler).
  const HINTS_3D = {
    sky: 'Choose a cracker. Tap Fire. Drag to look around.',
    ground: 'Tap the ground to place a cracker, then Fire. Drag to look around.',
    spark: 'Draw with your finger. Close the shapes (×) to look around.',
  };
  // Touch: crackers are lit with the sparkler, not Fire.
  const HINTS_TOUCH = {
    sky: 'Choose a cracker. Touch its fuse with the sparkler.',
    ground: 'Choose crackers. Sweep the sparkler across their fuses.',
  };
  const hintFor = (m) => (HINTS_TOUCH[m] && touchFirst() ? HINTS_TOUCH[m] : m === 'spark' && shapesClosed ? (w3dShown() ? 'Drag to look around. Tap Shapes to draw again.' : 'Tap Shapes for the shapes bar.')
    : (w3dShown() && HINTS_3D[m]) || HINTS[m]);
  let shapesClosed = false; // the sparkler's shapes bar, put away with its × (the drawing stays)
  function setShapesBar(open) {
    shapesClosed = !open;
    document.body.classList.toggle('shapes-closed', shapesClosed);
    if (playMode === 'spark') { el.hint.textContent = hintFor('spark'); el.hint.classList.remove('gone'); }
  }
  let groundSky = false; // the scene was last placed for Ground mode
  function refitScene(ground) {
    groundSky = ground;
    if (world.img) drawSky(); else drawCity();
    if (liveSky) liveSky.refit();
  }
  function setPlayMode(m) {
    if (launch.state !== 'READY') return;
    if (m === 'spark') setShapesBar(true); // choosing the Sparkler (again) brings the shapes back
    if (rush.on && m !== 'sky') endRush(true); // lanterns are a sky game
    if (pen) penUp();
    eraser = null;
    dragPreview = null;
    pointer = null;
    if (m !== 'spark') clearWriting();
    if (m !== 'ground') clearStreet();
    if (m !== playMode) endSweep();
    playMode = m;
    document.body.classList.remove('mode-sky', 'mode-ground', 'mode-spark');
    document.body.classList.add(`mode-${m}`);
    document.querySelectorAll('#modeTabs [data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    el.hint.textContent = hintFor(m);
    el.hint.classList.remove('gone');
    drawFloor();
    if ((m === 'ground') !== groundSky) refitScene(m === 'ground'); // the landmark, city or ghat moves to the street's edge
    if (m === 'ground' && mode === 'play') { placeSelectedCracker(); sivakasiHint(settings.item); }
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
  const floorH = () => clamp(H * 0.13, 70, 130); // deep enough for crackers to sit near and far, shallow enough to leave the landmark room
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
    Object.assign(m, { x, y, vx: vx * k, vy: vy * k, col, r0: r0 * k, r1: r1 * k, life: Math.min(life, 3), a: a * curDim, age: 0, an: curAnchor });
    smokes.push(m);
  }
  // Break smoke: drifting banks left by sky shells, nearly invisible until a later burst lights them in its colour.
  const hazes = [];
  function breakSmoke(x, y, sz) {
    if (!Q().bloom || w3dShown()) return; // low tier and the 3D view (whose camera moves) go without
    const n = Math.min(3, Math.round(1 + 1.5 * sz));
    for (let i = 0; i < n && hazes.length < Q().smoke >> 1; i++) {
      const R = R0() * sz;
      hazes.push({ x: x + rand(-0.45, 0.45) * R, y: y + rand(-0.35, 0.45) * R, vx: rand(4, 14) * U, vy: rand(-6, 4) * U,
        r0: R * 0.3, r1: R * rand(0.7, 1), age: 0, life: rand(6, 9), an: curAnchor });
    }
  }
  const hazeSprites = {};
  function hazeTint() { // the sky light's colour, in steps of 32 so the sprite cache stays small
    const q = (v) => Math.min(255, (Math.round(v / 32) * 32) | 0);
    const key = '#' + [q(gR), q(gG), q(gB)].map((v) => v.toString(16).padStart(2, '0')).join('');
    return hazeSprites[key] || (hazeSprites[key] = smokeSprite(key));
  }
  function updateSmoke(dt) {
    for (let i = hazes.length - 1; i >= 0; i--) {
      const h = hazes[i];
      if ((h.age += dt) >= h.life) { hazes[i] = hazes[hazes.length - 1]; hazes.pop(); continue; }
      h.x += h.vx * dt; h.y += h.vy * dt; h.vy *= Math.exp(-0.4 * dt);
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      const m = smokes[i];
      m.age += dt;
      if (m.age >= m.life) { smokes[i] = smokes[smokes.length - 1]; smokes.pop(); release(smokePool, m); continue; }
      const e = Math.exp(-0.9 * dt);
      m.vx = m.vx * e + 6 * U * dt; m.vy *= e;
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
  }
  function drawSmoke() {
    if (hazes.length) { // drawn every frame into the fading sky canvas: a per-frame alpha of target x fadeA settles at target
      const fa = fadeA || 0.2, lit = Math.min(1, gI * 0.5 + gPop), tint = lit > 0.04 ? hazeTint() : null;
      const [lx, ly] = gWX >= 0 ? [gWX, gWY] : [W / 2, H * 0.3], fall = (W * 0.45) ** 2;
      for (const h of hazes) {
        const t = h.age / h.life, r = h.r0 + (h.r1 - h.r0) * Math.sqrt(t), env = Math.min(1, h.age / 0.6) * (1 - t);
        if (!tint) continue; // unlit smoke is lost in the night sky; only light makes it show
        const d2 = (h.x - lx) ** 2 + (h.y - ly) ** 2, al = 0.2 * lit * env * fa / (1 + d2 / fall);
        if (al < 0.002) continue;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
        ctx.drawImage(tint, h.x - r, h.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
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
  // touch on the street stays put. The sky, landmark photo included, is one plain canvas layer (a WebGL photo layer
  // used to swap in for it and flickered as shows began and ended). Embers drift in front of it all. Off in AR, with the setting off, and for people
  // who ask their device for reduced motion.
  const VIEW_DEPTH = { sky: 1, fx: 0.55, city: 0.22, atmo: -0.45 }; // share of the camera's move; the street is 0
  const view = {
    x: 0, y: 0, t: 0, A: 0, key: '', active: false,
    gyro: null, gyroAt: -1e9, base: null, mouse: null, mouseAt: -1e9, asked: false,
    on: () => settings.view3d && !arOn && !reduceMotion() && !w3dShown(),
  };
  // Where a layer at this depth sits now, in CSS px (up/down moves a little less than sideways).
  const layerShift = (d) => (view.active ? [-view.x * view.A * d, -view.y * view.A * 0.6 * d] : [0, 0]);
  // Opaque layers are drawn a touch larger so their edges never show while they move.
  const layerScale = (d) => (view.active ? 1 + (2.1 * view.A * d) / Math.min(W, H) : 1);

  function updateView(dt) {
    stepArPan(dt);
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
      if (!lowMem()) drawAtmo(dt); // hidden there (syncLayers)
    }
    applyView();
  }

  function applyView() {
    const key = `${view.x.toFixed(4)}|${view.y.toFixed(4)}|${shakeX.toFixed(1)}|${shakeY.toFixed(1)}|${arPan.x.toFixed(1)}|${arPan.y.toFixed(1)}|${W}x${H}|${fit.z.toFixed(4)}`;
    if (key === view.key) return;
    view.key = key;
    const tf = (d, s, f) => {
      const [dx, dy] = layerShift(d);
      return layerTf(dx + shakeX + arPan.x, dy + shakeY + arPan.y, s, f);
    };
    skyC.style.transform = tf(VIEW_DEPTH.sky, layerScale(VIEW_DEPTH.sky));
    moonC.style.transform = skyC.style.transform;
    fxC.style.transform = tf(VIEW_DEPTH.fx, 1, fit.z);
    cityC.style.transform = tf(VIEW_DEPTH.city, layerScale(VIEW_DEPTH.city));
    atmoC.style.transform = tf(VIEW_DEPTH.atmo, 1);
    const fx = shakeX + arPan.x, fy = shakeY + arPan.y;
    floorC.style.transform = floorTf(fx, fy, 1);
    const front = layerTf(fx, fy, 1, fit.z);
    for (const c of [itemsC, paintC, gfxC]) c.style.transform = front;
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

  // ----- Camera AR without ARCore: the cracker and firework layers slide against the phone's turn -----
  // so what you placed stays where you put it in the room as you look around (turning only; walking needs ARCore).
  // The heading and pitch come from where the back camera points, which has no gimbal lock when the phone is upright.
  const arPan = { x: 0, y: 0, tx: 0, ty: 0, base: null, awayAt: 0 };
  function trackArPan(e) {
    if (!arOn || roomAr || e.alpha == null || e.beta == null || e.gamma == null) { arPan.base = null; arPan.tx = arPan.ty = 0; return; }
    const r = Math.PI / 180, a = e.alpha * r, b = e.beta * r, g = e.gamma * r;
    const dx = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
    const dy = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
    const yaw = Math.atan2(dx, dy), pitch = Math.asin(clamp(-Math.cos(b) * Math.cos(g), -1, 1));
    // Pointing at the floor or the ceiling the heading means little: hold still and look again from there.
    if (Math.abs(pitch) > 1.1) { arPan.base = null; arPan.tx = arPan.ty = 0; return; }
    if (!arPan.base) arPan.base = [yaw, pitch];
    const turn = Math.atan2(Math.sin(yaw - arPan.base[0]), Math.cos(yaw - arPan.base[0])), tilt = pitch - arPan.base[1];
    // Turned well away (past about 50 degrees) for a moment: what was placed is behind you, so the view starts afresh here.
    const now = performance.now();
    if (Math.abs(turn) > 0.9 || Math.abs(tilt) > 0.9) { if (!arPan.awayAt) arPan.awayAt = now; else if (now - arPan.awayAt > 1500) { arPan.base = [yaw, pitch]; arPan.awayAt = 0; } }
    else arPan.awayAt = 0;
    const f = Math.max(W, H) * 0.8; // about a phone camera's field of view across the screen
    arPan.tx = -Math.tan(clamp(turn, -0.9, 0.9)) * f;
    arPan.ty = Math.tan(clamp(tilt, -0.9, 0.9)) * f;
  }
  function stepArPan(dt) {
    if (!arOn || roomAr) { arPan.x = arPan.y = arPan.tx = arPan.ty = 0; arPan.base = null; return; }
    const k = 1 - Math.exp(-dt * 18);
    arPan.x += (arPan.tx - arPan.x) * k; arPan.y += (arPan.ty - arPan.y) * k;
  }

  // ----- What moves the camera: the phone's tilt, else the mouse -----
  window.addEventListener('deviceorientation', (e) => {
    trackArPan(e);
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
  // A cracker's sprite units to pixels at its depth (it.s): it.s * U * IS. IS draws every cracker (and its fuse, grab
  // area and the spots its pops come from) a quarter bigger than it used to be, for phones and a TV across the room,
  // while the distances its sparks fly (which use it.s alone) stay as they were and on screen.
  const IS = 1.3 * 1.25 * 1.3; // and 30% more (Oct 2026): the crackers read better on a phone
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
        glowAt(tx, ty, it.color, 70 * U * it.s, 0.35 * k, 2.4);
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
        const S = it.s * U * IS, cy = it.y - 6 * S, R = 11 * S;
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
        const S = it.s * U * IS;
        it.fired = true;
        launchShell({ sx: it.x, sy: it.y - 60 * S, x: it.x + rand(-80, 80) * U, y: rand(H * 0.12, H * 0.34), size: rand(0.55, 0.75), L: 1, whistle: true, lift: Math.random() < 0.4 ? 'crackle' : undefined });
        smoke(it.x, it.y - 30 * S, 0, -20 * U, '#a9a4b8', 8 * U, 40 * U, 2.2, 0.08);
      },
      run() {},
    },
    bomb: {
      label: 'Atom bomb', fuse: 1.8, dur: 0.05,
      tip: [6, -30],
      ignite(it) {
        const S = it.s * U * IS, x = it.x, y = it.y - 11 * S;
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
      },
      run() {},
    },
    laddi: {
      label: 'Cracker string', fuse: 0.5, dur: 3.4,
      tip: [-66, -4],
      ignite() {},
      run(it, a) {
        const total = 24, want = Math.min(total, Math.floor((a / it.dur) * total * 1.02));
        const S = it.s * U * IS;
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
        glowAt(tx, ty, '#ffcf6b', 26 * U * it.s, 0.25, 2.4);
      },
    },
    cake: {
      label: 'Sky cake', fuse: 0.6, dur: 4.4,
      tip: [0, -26],
      ignite() {},
      run(it, a) {
        const total = 14, want = Math.min(total, Math.floor(a / 0.3) + 1);
        const S = it.s * U * IS;
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
        glowAt(tx, ty, '#fff1c8', 30 * U * it.s, 0.7, 2.4);
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
        const S = it.s * U * IS, cy = it.y - it.hy - 6 * S, R = 12 * S;
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
        const silver = Math.random() < 0.35; // sometimes a cone of silver comets whose glitter falls back (Lonestar)
        const [tx, ty] = tipPos(it), n = cnt(silver ? 34 : 55), c1 = silver ? '#eef2ff' : color(), c2 = silver ? '#ffffff' : color();
        const crackleEnd = (p) => { curLayer = 1; crackleBurst(p.x, p.y); curLayer = 0; Sound.crackle(pan(p.x)); };
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.45, 0.45), v = rand(480, 820) * U * (0.8 + it.s * 0.25), c = i % 2 ? c1 : c2;
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, c, rand(1.1, 1.6),
            { drag: 1.1, grav: 1, size: silver ? 3 : 2.6, glitter: silver ? 1.4 : 0.5, gcol: c, tail: silver ? 0.4 : 0, onDeath: Math.random() < 0.3 ? crackleEnd : null });
        }
        flash(tx, ty, c1, 0.9, gctx);
        for (let i = 0; i < 4; i++) smoke(tx, ty, rand(-30, 30) * U, -rand(30, 60) * U, '#8d8898', 10 * U, 45 * U, 2.4, 0.08);
        Sound.thump(pan(tx)); Sound.lastBurst = 0; Sound.burst(0.9, pan(tx));
        shake = Math.max(shake, 0.15); buzz(30);
        addLight(c1, 1.5);
      },
      run() {},
    },
    wheel: {
      label: 'Fire wheel', fuse: 0.5, dur: 5.5,
      tip: [0, -44],
      ignite(it) { Sound.hiss(it.dur, 2400, 0.13, pan(it.x), { wobble: 7 }); },
      run(it, a, dt) {
        it.rot += (4 + 18 * Math.min(1, a / 0.8)) * dt;
        const S = it.s * U * IS, cx = it.x, cy = it.y - 44 * S, R = 12 * S;
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
      },
      run() {},
    },
    snake: {
      label: 'Snake tablet', fuse: 0.6, dur: 6, keep: 3,
      tip: [0, -3],
      ignite(it) { it.pts = [[0, -3]]; it.dir = -Math.PI / 2; it.turn = rand(-1, 1); Sound.hiss(it.dur, 700, 0.05, pan(it.x), { q: 0.4 }); },
      run(it, a, dt) {
        const S = it.s * U * IS;
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
      ignite(it) { Sound.hiss(1.2, 1200, 0.04, pan(it.x), { q: 0.5 }); },
      run(it, a, dt) {
        it.hy += Math.min(1, a / 2) * 38 * U * dt;
        it.x += Math.sin(a * 0.9 + it.rot) * 14 * U * dt;
        const S = it.s * U * IS, cy = it.y - it.hy - 16 * S;
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
        glowAt(tx, ty, '#ffcf6b', 80 * U * it.s, 0.4 * k, 2.4);
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
        glowAt(tx, ty, col, 60 * U * it.s, 0.35 * k, 2.4);
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
        glowAt(tx, ty, it.color, 55 * U * it.s, 0.3 * k, 2.4);
        addLight(it.color, dt * 1.1 * k);
      },
    },
    shell: {
      label: 'Shell', fuse: 1, dur: 0.1, keep: 1.4,
      tip: [0, -58],
      ignite(it) {
        // A mortar: one big aerial shell, high and wide.
        const S = it.s * U * IS, mx = it.x, my = it.y - 44 * S;
        it.fired = true;
        // (a tube carrying a chosen shell, as Pataka Chor's found sky shells do, sends up that one)
        launchShell({ sx: mx, sy: my, x: mx + rand(-40, 40) * U, y: rand(H * 0.1, H * 0.22), size: rand(1.2, 1.45), type: it.shellId && TYPES[it.shellId] ? it.shellId : pick(['chrysanthemum', 'peony', 'kamuro', 'willow']), L: 1 });
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
        const total = 18, want = Math.min(total, Math.floor((a / it.dur) ** 0.8 * total) + 1), S = it.s * U * IS;
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
        const S = it.s * U * IS, want = Math.min(3, Math.floor(a / 0.38) + 1);
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
      label: 'Grand finale', fuse: 0.8, dur: 6, keep: 1.2,
      tip: [0, -26],
      ignite() {},
      run(it, a) {
        // A box that fires a rapid barrage and closes with three big golden willows.
        const total = 26, want = Math.min(total, Math.floor(a / 0.18) + 1), S = it.s * U * IS;
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
        if (!it.wall && a > total * 0.18 + 0.45) { // then a titanium wall: white salutes across the sky, left to right
          it.wall = true;
          for (let k = 0; k < 7; k++) after(k * 0.07, () => launchShell({ sx: it.x + rand(-14, 14) * S, sy: it.y - 26 * S, x: W * (0.12 + 0.76 * k / 6), y: H * rand(0.26, 0.32), exact: true, size: 0.55, type: 'salute', L: 1, fast: 1.6 }));
        }
      },
    },
  });
  // ---------- Real-show ground pieces (research/fireworks-videos: Malta, Lonestar, Yokohama, PGI) ----------
  const COMET = (x, y, ang, v, col, o = {}) => star(x, y, Math.cos(ang) * v, Math.sin(ang) * v, col, o.life || rand(1.2, 1.5),
    { drag: 0.6, grav: 1.1, size: o.size || 3.2, glitter: 1.3, gcol: o.gcol || '#ffe7b0', tail: 0.4, swirl: o.swirl || 0, onDeath: o.onDeath || null, floorY: o.floorY });
  const FAN_PATTERNS = ['sweep', 'V', 'W', 'zigzag', 'heart'];
  Object.assign(ITEMS, {
    fancake: {
      label: 'Fan cake', fuse: 0.6, dur: 3.2, keep: 1,
      tip: [0, -26],
      ignite(it) { it.pat = pick(FAN_PATTERNS); it.col = Math.random() < 0.5 ? '#eef2ff' : it.color; },
      run(it, a) {
        // Comets fired at fixed angles, one every 0.2 s, in a pattern: a sweep, a V, a W, a zig-zag or a heart.
        const n = 14, want = Math.min(n, Math.floor(a / 0.2) + 1), [tx, ty] = tipPos(it), D = Math.PI / 180;
        while (it.shots < want) {
          const i = it.shots++, f = i / (n - 1), v = rand(560, 640) * U * (0.8 + it.s * 0.25);
          const shot = (deg, sw) => { COMET(tx, ty, -Math.PI / 2 + deg * D, v, it.col, { swirl: sw }); flash(tx, ty, it.col, 0.25, gctx); };
          curLayer = 1;
          if (it.pat === 'sweep') shot(-60 + 120 * f);
          else if (it.pat === 'V') { shot(-(10 + 50 * f)); shot(10 + 50 * f); }
          else if (it.pat === 'W') shot([-55, -18, 18, 55][i % 4] + rand(-4, 4));
          else if (it.pat === 'zigzag') shot((i % 2 ? 1 : -1) * (55 - 40 * f));
          else { shot(-(15 + 30 * f), 1.1); shot(15 + 30 * f, -1.1); } // two mirrored fans that curl in: a heart
          curLayer = 0;
          if (i % 2 === 0) smoke(tx, ty, rand(-10, 10) * U, -rand(20, 45) * U, '#8d8898', 6 * U, 30 * U, 1.8, 0.07);
          Sound.thump(pan(tx)); addLight(it.col, 0.4);
        }
      },
    },
    cometchain: {
      label: 'Dancing comets', fuse: 0.5, dur: 2.6, keep: 1,
      tip: [0, -24],
      ignite(it) { it.ph = rand(0, TAU); },
      run(it, a) {
        // Comets in a quick sequence, each aimed a little further round and curling the other way: a snake in the sky.
        const n = 12, want = Math.min(n, Math.floor(a / 0.15) + 1), [tx, ty] = tipPos(it);
        while (it.shots < want) {
          const i = it.shots++, ang = -Math.PI / 2 + Math.sin(it.ph + i * 0.7) * 0.85;
          curLayer = 1; COMET(tx, ty, ang, rand(520, 600) * U * (0.8 + it.s * 0.25), i % 3 ? '#ffcf6b' : it.color, { swirl: i % 2 ? 1.6 : -1.6, size: 2.6 }); curLayer = 0;
          Sound.pop(pan(tx));
        }
      },
    },
    silvertower: {
      label: 'Silver tower', fuse: 0.5, dur: 6,
      tip: [0, -30],
      ignite(it) { Sound.hiss(it.dur, 4600, 0.2, pan(it.x)); },
      run(it, a, dt) {
        // A white-hot gerb three times the height of an anar, throwing silver arcs to the sides like a willow.
        const k = Math.min(1, a / 0.5) * Math.min(1, (it.dur - a) / 1.2);
        const [tx, ty] = tipPos(it), n = k * 560 * dt * Q().count;
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + rand(-0.13, 0.13), v = rand(700, 1150) * U * it.s * (0.6 + 0.4 * k);
          star(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.8 ? '#f4f6ff' : '#ffe7b0', rand(0.8, 1.4), { drag: 0.85, grav: 1.6, size: 1.3, glitter: 0.3, gcol: '#ffffff', floorY: it.y + 2 });
        }
        if (Math.random() < dt * 5 * k) {
          const side = Math.random() < 0.5 ? -1 : 1, ang = -Math.PI / 2 + side * rand(0.9, 1.25);
          curLayer = 1; COMET(tx, ty - 20 * U * it.s, ang, rand(380, 480) * U * it.s, '#eef2ff', { size: 2, life: 1.9, gcol: '#ffffff', floorY: it.y + 2 }); curLayer = 0;
        }
        glowAt(tx, ty, '#f4f6ff', 90 * U * it.s, 0.45 * k, 2.4);
        addLight('#e8ecff', dt * 1.8 * k);
      },
    },
    minerow: {
      label: 'Mine row', fuse: 0.7, dur: 1.6, keep: 1.2,
      tip: [0, -24],
      ignite(it) { it.dir = Math.random() < 0.5 ? 1 : -1; },
      run(it, a) {
        // Five mines in a row, left to right (or back), each a cone of silver comets whose glitter falls back.
        const want = Math.min(5, Math.floor(a / 0.25) + 1), S = it.s * U * IS, [, ty] = tipPos(it);
        while (it.shots < want) {
          const i = it.shots++, mx = it.x + it.dir * (i - 2) * 26 * S, n = cnt(16);
          curLayer = 1;
          for (let j = 0; j < n; j++) { const ang = -Math.PI / 2 + rand(-0.32, 0.32); COMET(mx, ty, ang, rand(500, 820) * U * (0.8 + it.s * 0.25), '#eef2ff', { size: 2.2, life: rand(1, 1.4), gcol: '#ffffff' }); }
          flash(mx, ty, '#ffffff', 0.6, gctx); curLayer = 0;
          for (let j = 0; j < 2; j++) smoke(mx, ty, rand(-20, 20) * U, -rand(30, 60) * U, '#8d8898', 10 * U, 45 * U, 2.4, 0.08);
          Sound.thump(pan(mx)); addLight('#e8ecff', 0.8);
        }
      },
    },
    cometburst: {
      label: 'Comet to star', fuse: 0.5, dur: 2.6, keep: 1,
      tip: [0, -26],
      ignite() {},
      run(it, a) {
        // White comets that turn, at the top, into a little burst of red or magenta stars.
        const n = 6, want = Math.min(n, Math.floor(a / 0.4) + 1), [tx, ty] = tipPos(it);
        const pop = (p) => { const c = Math.random() < 0.5 ? '#ff3355' : '#ff4fd8'; sphere(cnt(18), (dx, dy) => star(p.x, p.y, dx * 110 * U, dy * 110 * U, c, rand(0.9, 1.2), { drag: 2, size: 2.2, L: p.L })); flash(p.x, p.y, c, 0.45); Sound.pop(pan(p.x)); };
        while (it.shots < want) {
          it.shots++;
          curLayer = 1; COMET(tx, ty, -Math.PI / 2 + rand(-0.25, 0.25), rand(620, 720) * U * (0.8 + it.s * 0.25), '#f4f6ff', { life: rand(0.95, 1.1), onDeath: pop }); curLayer = 0;
          Sound.thump(pan(tx));
        }
      },
    },
    chrysline: {
      label: 'Line of flowers', fuse: 0.6, dur: 0.4, keep: 1,
      tip: [0, -26],
      ignite(it) {
        // Eight to ten little chrysanthemums breaking side by side at one height.
        const n = 8 + ((Math.random() * 3) | 0), y = rand(H * 0.22, H * 0.32), S = it.s * U * IS, c = Math.random() < 0.6 ? '#ffb347' : color();
        for (let i = 0; i < n; i++) launchShell({ sx: it.x, sy: it.y - 26 * S, x: W * (0.12 + 0.76 * i / (n - 1)), y, exact: true, size: 0.36, type: 'chrysanthemum', c1: c, L: 1 });
        Sound.thump(pan(it.x)); flash(it.x, it.y - 26 * S, '#ffd9a0', 0.5, gctx);
      },
      run() {},
    },
    starwheel: {
      label: 'Maltese wheel', fuse: 0.5, dur: 7, keep: 1,
      tip: [0, -50],
      ignite(it) { Sound.hiss(it.dur, 2200, 0.15, pan(it.x), { wobble: 5 }); },
      run(it, a, dt) {
        // A big wheel on a post with six star-fish arms, each spraying its own colour, changing as it turns.
        it.rot += (2 + 9 * Math.min(1, a / 1)) * dt;
        const S = it.s * U * IS, cx = it.x, cy = it.y - 50 * S, R = 20 * S;
        for (let k = 0; k < 6; k++) {
          const ang = it.rot + (k * TAU) / 6, ex = cx + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R;
          const col = palette[(k + ((a * 0.8) | 0)) % palette.length];
          for (let i = 0; i < 2; i++) {
            const d = ang + Math.PI / 2 + rand(-0.15, 0.15), v = rand(170, 330) * U * it.s;
            star(ex, ey, Math.cos(d) * v, Math.sin(d) * v, Math.random() < 0.65 ? col : '#fff3d6', rand(0.4, 0.75), { drag: 1.3, grav: 1.2, size: 1.5, floorY: it.y + 3 });
          }
        }
        glowAt(cx, cy, '#ffcf6b', 70 * U * it.s, 0.45);
        addLight(palette[((a * 0.8) | 0) % palette.length], dt * 1.4);
        if (!it.end && a >= it.dur - 0.06) { it.end = true; flash(cx, cy, '#ffffff', 0.8, gctx); sphere(cnt(40), (dx, dy) => star(cx, cy, dx * 200 * U, dy * 200 * U, '#ffd36b', rand(0.8, 1.2), { drag: 1.6, size: 1.8 })); Sound.pop(pan(cx)); }
      },
    },
    kingsalute: {
      label: 'King salute', fuse: 1.2, dur: 0.1, keep: 1,
      tip: [0, -30],
      ignite(it) {
        // One shell, no colour: a flash that lights the whole sky and a bang that shakes it.
        const S = it.s * U * IS;
        launchShell({ sx: it.x, sy: it.y - 30 * S, x: it.x + rand(-40, 40) * U, y: H * rand(0.2, 0.28), size: 1.4, type: 'salute', L: 1, lift: 'crackle' });
        smoke(it.x, it.y - 30 * S, 0, -20 * U, '#a9a4b8', 8 * U, 40 * U, 2.2, 0.08);
        Sound.thump(pan(it.x));
      },
      run() {},
    },
  });
  // ---------- Show director ----------
  // A whole show from one Fire, built the way the six reference shows are (research/fireworks-videos): colour acts, a
  // dark beat after each king, height layers (low comets and flowers, mid shells, high kings), mirrored and lined-up
  // launch positions, a low piece followed by an aerial half a second later, and a finale that builds through gold
  // kamuro and white senrin to a wall of salutes and one last king willow. Shells are the game's own (tap: true, not a
  // player's, so no combos), scheduled with after() under the 'director' tag; the launch waits for directorUntil.
  let directorUntil = 0;
  const ACTS = [['#ff3355', '#ff8a8a'], ['#4a7dff', '#5ff0ff'], ['#ffcf6b', '#ffb347'], ['#33ff88', '#b6ff5f'], ['#b56bff', '#ff4fd8']];
  const ACT_SHELLS = ['peony', 'doublepetal', 'pistil', 'dahlia', 'chrysanthemum', 'ring', 'doublering', 'crossette', 'brocade', 'palm', 'colorchange', 'sunflower'];
  const LOW_SHELLS = ['spider', 'chrysanthemum', 'crackle', 'strobe'];
  function directShow(o = {}) {
    const len = o.len || 24, t0 = 0.6, actsEnd = len * 0.72;
    const top = world.img && world.rect ? clamp(world.rect.roof - H * 0.08, H * 0.16, H * 0.42) : H * 0.42;
    const band = (lo, hi) => H * 0.08 + rand(lo, hi) * (top - H * 0.08); // 0 = the top of the sky, 1 = just above the roofline
    const X = [0.15, 0.32, 0.5, 0.68, 0.85];
    const fire = (t, type, x, y, size, c1, c2, extra) => after(t, () => launchShell({ tap: true, type, x: W * x, y, size, c1, c2, exact: true, ...extra }), 'director');
    const acts = [...ACTS].sort(() => Math.random() - 0.5).slice(0, 3);
    let t = t0;
    acts.forEach(([c1, c2], ai) => {
      const end = t0 + ((ai + 1) / acts.length) * (actsEnd - t0);
      const pool = [...ACT_SHELLS].sort(() => Math.random() - 0.5).slice(0, 3);
      while (t < end) {
        const kind = pick(['solo', 'mirror', 'line', 'sweep', 'pair', 'mirror', 'line']), type = pick(pool);
        if (kind === 'solo') { fire(t, type, rand(0.3, 0.7), band(0, 0.25), 1.25, c1, c2); t += 1.9; } // a king, then a dark beat
        else if (kind === 'mirror') { const d = rand(0.18, 0.3), y = band(0.2, 0.5); fire(t, type, 0.5 - d, y, 0.8, c1, c2); fire(t, type, 0.5 + d, y, 0.8, c1, c2); t += 1.1; }
        else if (kind === 'line') { const y = band(0.25, 0.55); for (const x of X) fire(t, type, x, y, 0.6, c1, c2); t += 1.3; }
        else if (kind === 'sweep') { const y = band(0.3, 0.6), back = Math.random() < 0.5; X.forEach((x, i) => fire(t + i * 0.16, type, back ? 1 - x : x, y, 0.6, c1, c2)); t += 1.4; }
        else { const x = pick(X); fire(t, pick(LOW_SHELLS), x, band(0.75, 0.95), 0.5, c1, c2); fire(t + 0.5, type, x, band(0.05, 0.3), 1, c1, c2); t += 1.2; }
      }
    });
    // The finale: gold kamuro across, a quickening build, white senrin, a wall of salutes, then the last king willow.
    t = actsEnd;
    X.forEach((x, i) => fire(t + i * 0.08, 'kamuro', x, band(0.1, 0.3), 1));
    t += 1.6;
    for (let i = 0; i < 12; i++) fire(t + i * (0.22 - i * 0.012), pick(ACT_SHELLS), rand(0.15, 0.85), band(0.1, 0.6), 0.7);
    t += 2.2;
    for (const x of [0.25, 0.5, 0.75]) fire(t, 'senrin', x, band(0.05, 0.25), 1, '#fff4e0');
    t += 1.2;
    X.forEach((x, i) => fire(t + i * 0.06, 'salute', x, band(0.35, 0.45), 0.6, null, null, { fast: 1.6 }));
    t += 0.9;
    fire(t, 'kingwillow', 0.5, band(0, 0.08), 1.3);
    directorUntil = gameTime + t + 2;
    return t + 6;
  }
  // ---------- Sivakasi crackers ----------
  // Saravedi and Chorsa pop fast along the street. The single, double and seven shots throw their shots up one at a
  // time, in a beat you can count, and each bursts low over the street. Every pop and burst tears its paper casing
  // into flakes that drift out and flutter down (short-lived confetti). The paper crackers (nattu vedi), smallest to
  // biggest, each go off once in a shower of their wrapping. Five are Premium, each with one free try: the Hazaar ladi,
  // saravedi, seven shot, double shot and Lakshmi vedi. They lead the Ground list, so they are seen first; then the free
  // hooks (Note shower, Rang pencil, flower pot, anar) and the other Sivakasi crackers.
  const PREMIUM_FIRST = ['hazaar', 'saravedi', 'sevenshot', 'doubleshot', 'lakshmivedi'];
  const SIVAKASI = [...PREMIUM_FIRST, 'sutli', 'twosound', 'anilvedi', 'singleshot', 'bijili', 'kuruvi'];
  const HOOKS = ['notes', 'pencil'];
  const NEW_ITEMS = [...HOOKS, ...SIVAKASI]; // the hint and the tests' view (LUTSFit) cover these
  const PREMIUM_ITEMS = new Set(PREMIUM_FIRST);
  // ---------- Free tries of the Premium crackers ----------
  // A free player may light each Premium-only cracker once, free, and one more a day for watching a video (the video
  // light, for the cracker they asked about). A try is used when the cracker is lit (the sparkler, Fire or Burst all),
  // never when it is only set down; when that show is over, the Premium sheet names it (openPremium({ tried })).
  // The Premium sky shells (PREMIUM_SHELLS) have tries too, under their shellKey ("shell:peacock").
  // luts:tries = { used: { id: 1 }, vday: the day of the last video light, vfor: the cracker it is still waiting for }
  const tries = (() => { try { return JSON.parse(localStorage.getItem('luts:tries') || 'null') || {}; } catch (e) { return {}; } })();
  tries.used = tries.used || {};
  const saveTries = () => { try { localStorage.setItem('luts:tries', JSON.stringify(tries)); } catch (e) { /* storage unavailable */ } };
  const isShellKey = (type) => typeof type === 'string' && type.startsWith('shell:');
  const onTry = (type) => !premium.active && !chor.on && (isShellKey(type) ? PREMIUM_SHELLS.has(type.slice(6)) : PREMIUM_ITEMS.has(type)); // its lights come from the tries
  const crackerName = (type) => (isShellKey(type) ? TYPES[type.slice(6)] && shellLabel(type.slice(6)) : ITEMS[type] && ITEMS[type].label);
  const videoLight = (type) => tries.vday === dayKey() && tries.vfor === type;
  const tryLeft = (type) => !tries.used[type] || videoLight(type);
  // Premium-only with nothing left to light it: tapping it offers the video light or Premium (offerTry).
  const itemLocked = (type) => onTry(type) && !tryLeft(type);
  let triedNow = null, triedVideo = false; // the Premium cracker a try was just used on, and whether it was the video light
  function useTry(type) {
    if (!onTry(type)) return true;
    if (!tryLeft(type)) return false;
    triedVideo = videoLight(type);
    if (triedVideo) tries.vfor = ''; else tries.used[type] = 1;
    saveTries(); triedNow = type; syncTries();
    return true;
  }
  if (itemLocked(settings.item)) settings.item = 'flowerpot';
  if (settings.shell !== 'random' && (!TYPES[settings.shell] || itemLocked(shellKey(settings.shell)))) settings.shell = 'random';
  // A burst that would leave the screen: the street pulls back to show it (fit, below). With reduced motion, in 3D (its
  // own camera) and in AR nothing zooms; the shots burst lower and nearer the middle instead.
  const fitByZoom = () => !reduceMotion() && !w3dShown() && !arOn;
  // The sky's top edge for a burst: below the top controls, whose buttons would hide it.
  const fitTop = () => {
    let t = H * 0.06;
    if (!document.body.classList.contains('ui-hidden')) {
      for (const e of [$('.hud'), $('#sceneBar')]) {
        const r = e && e.getBoundingClientRect();
        if (r && r.height && r.bottom < H * 0.5) t = Math.max(t, r.bottom + 6);
      }
    }
    return t;
  };
  const PAPER = { red: ['#d7263d', '#f05a5a', '#f2a33a', '#efe3cc'], green: ['#2fa36b', '#7bd389', '#ffd23f', '#efe3cc'], kraft: ['#c9a36b', '#e8d5b0', '#d7263d', '#efe3cc'] };
  // n paper flakes thrown up and out from (x, y) at up to v px/s, landing on the street round the cracker.
  function paper(it, x, y, n, v, cols) {
    n = Math.round(n * Math.min(1, Q().count));
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), s = rand(0.35, 1) * v;
      confetti(x, y, Math.cos(a) * s * 1.3, Math.sin(a) * s, pick(cols), it.y + rand(-3, 6) * U * it.s, rand(1.3, 2.3));
    }
  }
  // A quick ground-level pop: a flash, a spray of sparks, paper and now and then a puff of smoke. o.quiet: no sound of its
  // own (a string's snaps come from Sound.rapid); o.noSmoke: no puff; o.flakes: paper flakes (2 by default).
  function groundPop(it, x, y, i, cols, o = {}) {
    flash(x, y, '#ffd9a0', 0.2 * it.s, gctx);
    const n = Math.max(3, Math.round(7 * Q().count));
    for (let k = 0; k < n; k++) {
      const ang = rand(-Math.PI, 0), v = rand(110, 280) * U;
      spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.5 ? '#fff4dc' : '#ff8a2b', rand(0.06, 0.16));
    }
    paper(it, x, y, o.flakes ?? 2.4, 150 * U * it.s, cols);
    if (i % 3 === 0 && !o.noSmoke) smoke(x, y, rand(-10, 10) * U, -rand(20, 45) * U, '#8d8898', 6 * U, 30 * U, 1.8, 0.07);
    if (o.quiet) return addLight('#ffd9a0', 0.1);
    Sound.snap(pan(x));
    if (i % 5 === 4) Sound.pop(pan(x));
    addLight('#ffd9a0', 0.1);
  }
  // Saravedi: a long string laid across the street, burning from its fuse end to the other.
  const SARA_N = () => (Q().count < 0.8 ? 32 : 40);
  const saraLink = (i, n) => [-86 + (172 * i) / (n - 1), -3 + 2.5 * Math.sin(i * 0.7)];
  // The shots: where each tube's mouth is (sprite units) and the order they go off in.
  const SHOT_RISE = 0.7;
  function shotPlan(it) {
    if (it.plan) return it.plan;
    const def = ITEMS[it.type], S = it.s * U * IS, R = 80 * U * it.s, keep = !fitByZoom();
    it.plan = [];
    let at = 0;
    for (let i = 0; i < def.shots; i++) {
      if (i) at += def.gap * rand(1 - def.jit, 1 + def.jit); // a beat you can count, but a hand-made one: never a metronome
      const [mx, my] = def.mouths[i % def.mouths.length], sx = mx * S, sy = my * S;
      const h = rand(340, 410) * U * it.s * (def.shots > 2 ? 1 - 0.08 * (i % 3) : 1);
      let x = it.x + sx + (def.shots > 1 ? (i % 2 ? 1 : -1) * rand(0.05, 0.13) : rand(-0.05, 0.05)) * h, y = it.y + sy - h;
      [x, y] = keepIn(x, y, R * 1.3, keep ? 1 : FIT_MIN); // a cramped screen: lower than it would fly
      y = Math.min(y, it.y + sy - 30 * U * it.s); // but always up a little
      // Kept as offsets from the cracker, which a 3D camera may move.
      it.plan.push({ at, sx, sy, x: x - it.x, y: y - it.y, R, col: def.cols[i % def.cols.length], up: false, gone: false });
    }
    return it.plan;
  }
  function runShots(it, a) {
    for (const p of shotPlan(it)) {
      const u = (a - p.at) / SHOT_RISE;
      if (u < 0 || p.gone) continue;
      const sx = it.x + p.sx, sy = it.y - (it.hy || 0) + p.sy;
      if (!p.up) {
        p.up = true; it.shots++;
        flash(sx, sy, p.col, 0.3, gctx);
        for (let k = 0; k < 6; k++) spark(sx, sy, rand(-90, 90) * U, -rand(20, 120) * U, pick(GOLD), rand(0.1, 0.25));
        smoke(sx, sy, rand(-10, 10) * U, -rand(30, 50) * U, '#9d98aa', 6 * U, 30 * U, 1.8, 0.07);
        Sound.thump(pan(sx));
      }
      if (u < 1) {
        // Rising: fast off the tube, slowing to its height, with a gold tail.
        const k = 1 - (1 - u) ** 2, x = sx + (it.x + p.x - sx) * k, y = sy + (it.y + p.y - sy) * k;
        const n = Math.max(1, Math.round(3 * Q().count));
        for (let j = 0; j < n; j++) spark(x, y, rand(-14, 14) * U, rand(20, 70) * U, '#ffd27a', rand(0.15, 0.3));
        glowAt(x, y, '#ffe9b0', 16 * U * it.s, 0.8, 2.4);
        continue;
      }
      p.gone = true;
      shotBurst(it, it.x + p.x, it.y + p.y, p);
    }
  }
  // A shot's report: a white flash, a ring of sparks with a crackle, its casing in flakes and a puff of smoke.
  function shotBurst(it, x, y, p) {
    flash(x, y, '#fff1d0', 0.75, gctx);
    sphere(cnt(34), (dx, dy) => {
      const v = rand(0.75, 1) * 240 * U;
      spark(x, y, dx * v, dy * v, Math.random() < 0.55 ? p.col : '#fff4dc', rand(0.35, 0.6), { c2: '#ff7a2b', grav: 0.5 });
    });
    crackleBurst(x, y);
    paper(it, x, y, 12, 170 * U * it.s, PAPER.kraft);
    for (let k = 0; k < 3; k++) smoke(x, y, rand(-25, 25) * U, -rand(5, 25) * U, '#8d8898', 12 * U, 55 * U, 2.4, 0.08);
    Sound.bang(pan(x));
    if (!reduceMotion()) shake = Math.max(shake, 0.12);
    buzz(20);
    addLight(p.col, 1.1);
  }
  // Each cracker's whole effect on screen, as [left, top, right, bottom] (the street's own coordinates).
  function shotReach(it) {
    let x0 = it.x, x1 = it.x, y0 = it.y;
    for (const p of shotPlan(it)) {
      const r = p.R * 1.3;
      x0 = Math.min(x0, it.x + p.x - r); x1 = Math.max(x1, it.x + p.x + r); y0 = Math.min(y0, it.y + p.y - r);
    }
    return [x0, y0, x1, it.y];
  }
  // jit: each gap is gap ± that share of it.
  const shot = (shots, gap, mouths, cols, label, jit = 0) => ({
    label, fuse: 0.5, dur: (shots - 1) * gap * (1 + jit) + SHOT_RISE + 0.15, keep: 1.6, shots, gap, jit, mouths, cols,
    tip: [mouths[0][0] + 4, -24],
    ignite() {},
    run: runShots,
    reach: shotReach,
  });
  Object.assign(ITEMS, {
    singleshot: shot(1, 0, [[0, -22]], ['#ffd36b'], 'Single shot'),
    doubleshot: shot(2, 0.9, [[-5, -22], [5, -22]], ['#ff5fa2', '#5ff0ff'], 'Double shot', 0.1),
    // Seven tubes, front row then back, fired in a criss-cross so the beat moves across the pack.
    sevenshot: shot(7, 0.65, [[-9, -20], [0, -24], [-3, -20], [9, -20], [-6, -24], [3, -20], [6, -24]],
      ['#ff4d6d', '#ffd23f', '#3fd0ff', '#7dff6b', '#b46bff', '#ff9a3c', '#ffffff'], 'Seven shot', 0.15),
    saravedi: {
      label: 'Saravedi', fuse: 0.5, dur: 3.1, keep: 1.4,
      tip: [-90, -4],
      ignite(it) {
        // The whole string is planned when it catches: gaps of 55-95 ms, left to right (about 13 pops a second, never a
        // metronome). Its snaps go to one Sound.rapid a moment before each pop is drawn, so they stay together.
        const n = SARA_N();
        it.times = []; it.heard = 0;
        let t = 0;
        for (let i = 0; i < n; i++) { it.times.push(t); t += rand(0.055, 0.095); }
        it.dur = t + 0.15;
        it.rapid = Sound.rapid(pan(it.x), { bed: 0.025 });
      },
      run(it, a) {
        const n = it.times.length, S = it.s * U * IS;
        if (!it.rapid.live && it.heard < n && it.times[it.heard] <= a + 0.15) it.rapid = Sound.rapid(pan(it.x), { bed: 0.025 });
        while (it.heard < n && it.times[it.heard] <= a + 0.15) it.rapid.snap(it.times[it.heard++] - a);
        while (it.popped < n && it.times[it.popped] <= a) {
          const i = it.popped++, [lx, ly] = saraLink(i, n), x = it.x + lx * S;
          groundPop(it, x, it.y + ly * S, i, PAPER.red, { quiet: true });
          if (i % 6 === 5) Sound.pop(pan(x));
        }
      },
      reach(it) {
        // Most paper flies out under 0.4 of its speed (paper(): 150 * U * s) before the air stops it; sparks rise about 100.
        const S = it.s * U * IS, out = 60 * U * it.s;
        return [it.x - 90 * S - out, it.y - 100 * U * it.s, it.x + 90 * S + out, it.y];
      },
    },
    anilvedi: { // Chorsa (the id keeps its first name, so saved streets and tried crackers carry over)
      label: 'Chorsa', fuse: 0.5, dur: 2.6, keep: 1.4,
      tip: [9, -12],
      ignite(it) { it.n = Math.max(12, Math.round(24 * Math.min(1, Q().count))); },
      run(it, a) {
        // A packet of small crackers going off faster and faster, each hop throwing the rest wider over the street.
        const S = it.s * U * IS, want = Math.min(it.n, Math.floor((a / (it.dur - 0.1)) ** 0.75 * it.n) + 1);
        while (it.popped < want) {
          const i = it.popped++, r = (6 + 46 * (i / it.n)) * S, ang = Math.random() * TAU;
          const x = it.x + Math.cos(ang) * r, y = it.y + Math.sin(ang) * r * 0.3 - 3 * S;
          groundPop(it, x, y, i, PAPER.green);
          if (i % 4 === 1) spark(x, y, rand(-60, 60) * U, -rand(140, 220) * U, '#ffcf6b', rand(0.25, 0.4), { grav: 2 });
        }
      },
      reach(it) {
        const S = it.s * U * IS, out = 52 * S + 60 * U * it.s;
        return [it.x - out, it.y - 100 * U * it.s, it.x + out, it.y];
      },
    },
    bijili: paperCracker('Bijili', 0.6, 0.35, [8, -3], PAPER.red),
    kuruvi: paperCracker('Kuruvi vedi', 0.9, 0.7, [2, -17], PAPER.green),
    lakshmivedi: paperCracker('Lakshmi vedi', 1.4, 1.25, [3, -24], ['#d7263d', '#ffd23f', '#ff9ad5', '#efe3cc', '#f2a33a']),
  });
  // A paper cracker: a short wait on its fuse, then one bang, bigger with power p, that tears its wrapping into a
  // shower of coloured flakes. Only the scorch mark stays.
  // One paper cracker's bang at (x, y), bigger with power p: flash, sparks, its wrapping in flakes, smoke, the sound.
  function paperBang(it, x, y, p, cols) {
    flash(x, y, '#fff1d0', 0.5 + p, gctx);
    const n = cnt(30 + 60 * p);
    for (let i = 0; i < n; i++) {
      const ang = rand(-Math.PI, 0.1), v = rand(120, 300 + 260 * p) * U;
      spark(x, y, Math.cos(ang) * v, Math.sin(ang) * v, pick(['#fff4dc', '#ffb347', '#ff7a2b', '#ffd36b']), rand(0.12, 0.3 + 0.2 * p));
    }
    paper(it, x, y, 8 + 34 * p, (130 + 170 * p) * U * it.s, cols);
    for (let i = 0; i < 2 + 6 * p; i++) smoke(x + rand(-12, 12) * U * p, y, rand(-40, 40) * U * p, -rand(20, 60) * U, '#8d8898', 8 * U, (30 + 40 * p) * U, rand(2, 3.2), 0.08);
    if (p < 0.5) { Sound.snap(pan(x)); Sound.pop(pan(x)); } else if (p < 1) { Sound.pop(pan(x)); Sound.thump(pan(x)); } else Sound.bang(pan(x));
    if (!reduceMotion()) shake = Math.max(shake, 0.1 + 0.25 * p);
    buzz(Math.round(20 + 40 * p));
    addLight('#ffe6b8', 0.6 + 1.6 * p);
  }
  function paperCracker(label, fuse, p, tip, cols) {
    return {
      label, fuse, dur: 0.05, keep: 1.8, tip, cols,
      ignite(it) { const S = it.s * U * IS; paperBang(it, it.x, it.y - 6 * S * p, p, cols); },
      run() {},
      reach(it) { // most of its flakes fly out under 0.4 of their speed and rise under 0.45 (paper())
        const v = (130 + 170 * p) * U * it.s;
        return [it.x - v * 0.4, it.y - v * 0.45, it.x + v * 0.4, it.y];
      },
    };
  }

  // ---------- Build 31 crackers: Sutli bomb, Do-dhamaka, Note shower, Rang pencil ----------
  const NOTE_COLS = ['#a8e6b0', '#ffc2d8', '#b8d8ff', '#fff1a6']; // pastel paper notes: no symbol, no portrait, no money look
  const PENCIL_COLS = ['#3f8cff', '#3fe07a', '#ffe14a', '#ff3b3b']; // blue, green, yellow, red: 2.5 s each
  Object.assign(ITEMS, {
    sutli: {
      // A ball wrapped in jute twine. Its long fuse stalls twice (only an ember glows), then the biggest bang on the street.
      label: 'Sutli bomb', fuse: 2.4, dur: 0.05, keep: 1.8, fuseStalls: [0.9, 1.7],
      tip: [6, -31],
      tipAt(it) { const f = it.armed && !it.lit ? clamp(it.t / 2.4, 0, 1) : 0; return [6 - 4 * f, -31 + 6 * f]; }, // the ember crawls down
      ignite(it) {
        const S = it.s * U * IS, x = it.x, y = it.y - 13 * S;
        curLayer = 1;
        flash(x, y, '#fff1d0', 2.8, gctx);
        const n = cnt(143);
        for (let i = 0; i < n; i++) {
          const ang = rand(-Math.PI, 0.15), v = rand(220, 760) * U * it.s;
          star(x, y, Math.cos(ang) * v, Math.sin(ang) * v, pick(['#fff4dc', '#ffb347', '#ff7a2b', '#ffd36b']), rand(0.3, 1),
            { drag: 3, grav: 1.6, size: 1.7, floorY: it.y + 2 });
        }
        curLayer = 0;
        // Its jute in long strands, and a ring of dust along the street.
        const strands = Math.round(24 * Math.min(1, Q().count));
        for (let i = 0; i < strands; i++) {
          const a = rand(-Math.PI, 0), v = rand(120, 320) * U * it.s;
          confetti(x, y, Math.cos(a) * v * 1.3, Math.sin(a) * v, pick(PAPER.kraft), it.y + rand(-3, 6) * U * it.s, rand(3, 4), rand(9, 14) * U, rand(1.2, 2) * U);
        }
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; smoke(x + Math.cos(a) * 14 * S, it.y - 2 * S, Math.cos(a) * 70 * U, -rand(5, 20) * U, '#a39a8a', 12 * U, 70 * U, rand(2.6, 3.4), 0.1); }
        Sound.thump(pan(x)); Sound.bang(pan(x), { rate: 0.75, gain: 1.15 }); // lower and longer than any other bang
        if (!reduceMotion()) shake = Math.max(shake, 0.55);
        buzz(100);
        addLight('#ffe6b8', 3);
      },
      run() {},
      reach(it) { const v = 760 * U * it.s; return [it.x - v * 0.35, it.y - v * 0.4, it.x + v * 0.35, it.y]; },
    },
    twosound: {
      // Do-dhamaka: a bang on the street, then its top half shoots straight up and bangs again in the air.
      label: 'Do-dhamaka', fuse: 1.1, dur: 1.0, keep: 1.5,
      tip: [4, -22],
      ignite(it) {
        const S = it.s * U * IS;
        paperBang(it, it.x, it.y - 5 * S, 0.7, PAPER.red);
        twoPlan(it);
        Sound.lift(pan(it.x), 0.8, false);
      },
      run(it, a) {
        const p = twoPlan(it), S = it.s * U * IS, sx = it.x, sy = it.y - 18 * S;
        if (p.gone) return;
        const u = clamp(a / 0.8, 0, 1), k = 1 - (1 - u) ** 2, x = sx + p.x * k, y = sy + (it.y + p.y - sy) * k;
        if (u < 1) {
          const n = Math.max(1, Math.round(3 * Q().count));
          for (let j = 0; j < n; j++) spark(x, y, rand(-12, 12) * U, rand(20, 80) * U, '#ffe9b0', rand(0.15, 0.25));
          glowAt(x, y, '#fff4dc', 14 * U * it.s, 0.85, 2.4);
          return;
        }
        p.gone = true;
        flash(x, y, '#ffffff', 1.2, gctx);
        sphere(cnt(50), (dx, dy) => { const v = rand(0.8, 1) * 230 * U; spark(x, y, dx * v, dy * v, Math.random() < 0.6 ? '#ffffff' : '#fff4dc', rand(0.35, 0.55), { grav: 0.4 }); });
        paper(it, x, y, 16, 160 * U * it.s, PAPER.kraft);
        smoke(x, y, rand(-15, 15) * U, -rand(5, 15) * U, '#8d8898', 12 * U, 50 * U, 2.4, 0.08);
        Sound.bang(pan(x));
        if (!reduceMotion()) shake = Math.max(shake, 0.2);
        buzz(40);
        addLight('#ffffff', 1.2);
      },
      reach(it) { const p = twoPlan(it), r = 90 * U * it.s; return [it.x + p.x - r, it.y + p.y - r, it.x + p.x + r, it.y]; },
    },
    notes: {
      // Note shower: a cardboard cash box pops and throws pastel paper notes high; they flutter down for about 5 s and lie
      // on the street for 3 more. Quiet, and fewer notes on the low tier, where 90 would fill its particle budget.
      label: 'Note shower', fuse: 0.6, dur: 0.05, keep: 3,
      tip: [7, -15],
      ignite(it) {
        const S = it.s * U * IS, x = it.x, y = it.y - 14 * S, n = Q().maxStars < 300 ? 40 : Math.round(rand(60, 90));
        flash(x, y, '#fff1d0', 0.4, gctx);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + rand(-0.6, 0.6), v = rand(280, 620) * U * it.s;
          confetti(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(NOTE_COLS), it.y + rand(-4, 14) * U * it.s, rand(7.5, 8.5), rand(9, 12) * U, rand(4.5, 6) * U);
        }
        Sound.pop(pan(x)); Sound.snap(pan(x));
        buzz(15);
      },
      run() {},
      reach(it) { const v = 620 * U * it.s; return [it.x - v * 0.3, it.y - v * 0.45, it.x + v * 0.3, it.y]; },
    },
    pencil: {
      // Rang pencil: a thin stick in a cup of sand, burning down with a flickering flame that turns blue, green, yellow
      // and red, 2.5 s each, with smoke in its colour. Gentle, and quiet.
      label: 'Rang pencil', fuse: 0.4, dur: 10, full: true,
      tip: [0, -50],
      tipAt(it) { return [0, -50 + 34 * (it.lit ? clamp(it.t / it.dur, 0, 1) : 0)]; },
      ignite(it) { it.acc = 0; Sound.hiss(it.dur, 1800, 0.05, pan(it.x), { q: 0.5 }); },
      run(it, a, dt) {
        const [tx, ty] = tipPos(it), col = PENCIL_COLS[Math.min(3, (a / 2.5) | 0)];
        it.color = col; // the street's glow round it follows the flame
        it.acc += dt * 60 * Math.min(1, Q().count);
        while (it.acc > 1) {
          it.acc--;
          const ang = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(30, 140) * U * it.s;
          spark(tx, ty, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.6 ? col : '#fff4dc', rand(0.15, 0.4));
        }
        if (Math.random() < dt * 2) smoke(tx, ty, rand(-8, 8) * U, -rand(25, 45) * U, col, 6 * U * it.s, rand(30, 46) * U * it.s, rand(2.2, 3), 0.12);
        if (Math.random() < dt) Sound.crackle(pan(tx));
        glowAt(tx, ty, col, 26 * U * it.s * (0.85 + 0.3 * Math.random()), 0.75, 2.4);
        addLight(col, dt * 0.8);
      },
    },
  });
  // ---------- Hazaar ladi: a thousand-crackers string hanging from a bamboo pole ----------
  // Lit at the fuse hanging below it, it burns UP the string, each pop taking its link away, so the string shortens;
  // every pop kicks the string so it swings (up to 12°). Links drawn: 120, 180 or 240 by the quality tier;
  // the snaps heard: about 200 over 11 s through ONE Sound.rapid, so the voice cap holds. Every 40th link and the last
  // three are small bombs. A paper heap grows at its foot, a plume of smoke climbs with the burning front, and the
  // counter counts to 1000 (it is the string's name, not a particle count).
  // Sprite units: pole height, arm length, the string's foot above the street, its fuse below that, and one paper
  // cracker's length and girth, and the step between rows of them down the cord.
  const WALA_H = 196, WALA_ARM = 30, WALA_GAP = 10, WALA_FUSE = 6, WALA_CL = 10, WALA_CT = 2, WALA_ROW = 1.6;
  const WALA_TOP = 1 + WALA_CT, WALA_FLARE = 9; // the picture's margin above the arm; how far up the front they splay
  const walaLinks = () => (Q().maxStars < 300 ? 120 : Q().maxStars < 700 ? 180 : 240);
  // Where link k of n is on the cord (0 at the foot, where it is lit; n-1 at the arm), for a string swung by angle sw
  // and a pole shrunk by ph.
  function walaLink(k, n, sw, ph) {
    const L = WALA_H * ph, d = (L - WALA_GAP) * (1 - k / Math.max(1, n - 1)); // down from the arm
    return [WALA_ARM + Math.sin(sw) * d, -L + Math.cos(sw) * d];
  }
  // One paper cracker pointing right, a tube lit from above with a thin gold band near its end. Tones 0-2 are reds a
  // shade apart (so the string isn't one flat red), 3 the gold of a bomb link.
  const WALA_TONES = [['#de4a44', '#b01f1f', '#460707'], ['#d23f3c', '#a01a1b', '#3f0606'], ['#e85a4e', '#bd2a26', '#520b0a'], ['#ffe28a', '#e0a52c', '#7a4e0e']];
  function walaPiece(px, tone) {
    const c = document.createElement('canvas'), cl = WALA_CL * px, ct = WALA_CT * px, [hi, mid, lo] = WALA_TONES[tone];
    c.width = Math.ceil(cl) + 1; c.height = Math.ceil(ct) + 1;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, ct);
    gr.addColorStop(0, mid); gr.addColorStop(0.24, hi); gr.addColorStop(0.62, mid); gr.addColorStop(1, lo);
    g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, cl, ct, ct * 0.35); g.fill();
    g.fillStyle = tone === 3 ? '#fff2c0' : '#f0c75e'; g.fillRect(cl * 0.84, 0, Math.max(0.6, cl * 0.035), ct); // the band
    g.fillStyle = 'rgba(30,4,6,0.45)'; g.fillRect(cl - Math.max(0.8, ct * 0.3), 0, Math.max(0.8, ct * 0.3), ct); // its paper end
    return c;
  }
  // The string as a picture, drawn once for its size: rows of red paper crackers on both sides of a twisted grey cord,
  // each row tilted a little the other way (a herringbone), every 22nd row and the top two gold bombs, the fuse
  // hanging below. While it burns only the part above the burning front is shown, so a frame draws one image, not
  // hundreds of crackers. px: picture pixels per sprite unit (S x DPR). Kept for the item, or in a small cache for chips
  // and the drag preview. rows keeps each cracker's place, so the ones at the front can be drawn again, splayed.
  const walaCache = new Map();
  function walaSprite(it, n, ph, px) {
    const key = `${ph.toFixed(3)}|${px.toFixed(2)}`;
    if (it && it.wsp && it.wsp.key === key) return it.wsp;
    if (!it && walaCache.has(key)) return walaCache.get(key);
    const len = WALA_H * ph - WALA_GAP, half = WALA_CL * 1.1 + 0.6, w = Math.ceil(2 * half * px) + 2;
    const h = Math.ceil((WALA_TOP + len + WALA_FUSE + 1) * px), cx = w / 2, rnd = mulberry(Math.round(len * 10));
    const pieces = [0, 1, 2, 3].map((t) => walaPiece(px, t)), rows = [], R = Math.max(2, Math.round(len / WALA_ROW));
    for (let r = 0; r <= R; r++) {
      const bomb = r < 2 || r % 22 === 21;
      for (const side of [-1, 1]) {
        const d = Math.min(len, (len * r) / R + (side > 0 ? WALA_ROW / 2 : 0));
        rows.push({ d, side, a: (r % 2 ? 0.1 : -0.06) + (rnd() - 0.5) * 0.12, l: 0.9 + rnd() * 0.16, x: rnd() * 0.5, v: 0.7 + rnd() * 0.5, p: pieces[bomb ? 3 : Math.floor(rnd() * 3)] });
      }
    }
    rows.sort((a, b) => a.d - b.d); // from the top, so each cracker lies over the one above, as on a real string
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (const q of rows) walaPut(g, q, cx, (WALA_TOP + q.d) * px, px, px, 0);
    // The cord, two strands twisted, over the crackers' inner ends, and on below them as the fuse.
    const end = (WALA_TOP + len + WALA_FUSE) * px;
    g.lineCap = 'round';
    g.strokeStyle = '#7d7a76'; g.lineWidth = Math.max(1, 1.1 * px);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, end); g.stroke();
    g.strokeStyle = '#c4bdb1'; g.lineWidth = Math.max(0.6, 0.4 * px);
    g.beginPath(); g.moveTo(cx, 0);
    for (let y = 0, s = 1; y < end; y += WALA_ROW * 0.5 * px, s = -s) g.lineTo(cx + s * 0.35 * px, Math.min(end, y + WALA_ROW * 0.5 * px));
    g.stroke();
    const out = { key, c, len, rows, px };
    if (it) it.wsp = out; else { if (walaCache.size > 6) walaCache.clear(); walaCache.set(key, out); }
    return out;
  }
  // One cracker q of a string drawn at (x, y) on g (k: g's pixels per sprite unit), tilted down a further `droop`.
  function walaPut(g, q, x, y, k, px, droop) {
    g.save(); g.translate(x, y); g.scale(q.side, 1); g.rotate(q.a + droop);
    g.drawImage(q.p, (0.3 + q.x) * k, (-WALA_CT * k) / 2, (q.p.width / px) * k * q.l, (q.p.height / px) * k);
    g.restore();
  }
  // The string on g, whose origin is the arm and whose units are S: whole while it waits (its fuse too); once it burns,
  // only what is above the burning front, the crackers just above the front splaying out and down as in a photo of
  // one going off.
  function walaString(g, it, n, ph, popped, S) {
    const dpr = g.getTransform().a || 1, px = S * dpr, sp = walaSprite(it, n, ph, px), w = sp.c.width;
    if (!popped) { g.drawImage(sp.c, -w / 2 / dpr, -WALA_TOP * S, w / dpr, sp.c.height / dpr); return; }
    const front = sp.len * (1 - popped / Math.max(1, n - 1)), cut = Math.max(0, front - WALA_FLARE);
    const vis = Math.ceil((WALA_TOP + cut) * px);
    if (vis > 0) g.drawImage(sp.c, 0, 0, w, vis, -w / 2 / dpr, -WALA_TOP * S, w / dpr, vis / dpr);
    const shake = reduceMotion() ? 0 : 0.12;
    for (const q of sp.rows) {
      if (q.d < cut - WALA_CT * 1.5 || q.d > front + 0.5) continue;
      const t = clamp((q.d - cut) / WALA_FLARE, 0, 1);
      walaPut(g, q, 0, q.d * S, S, px, t * t * q.v * (1.1 + shake * Math.random()));
    }
    g.strokeStyle = '#7d7a76'; g.lineWidth = 0.8 * S; // the cord down to the front, over them
    g.beginPath(); g.moveTo(0, (cut - WALA_CT) * S); g.lineTo(0, front * S); g.stroke();
  }
  // In 3D, AR or with reduced motion nothing zooms out, so the pole is made short enough to fit under the top controls.
  const walaPh = (it) => (fitByZoom() ? 1 : clamp((it.y - fitTop() - 24 * U) / (WALA_H * it.s * U * IS), 0.35, 1));
  const walaSound = (it) => Sound.rapid(pan(it.x), { bed: 0.04, gain: [0.25, 0.6], gap: 0.032 }); // its last 1.5 s run 30 a second
  function walaPlan(it) {
    // The heard snaps (no metronome): 10 rising to 20 a second over the first second, 18-24 a second (gaps of
    // 35-75 ms) to 9 s, building to 30 a second by 10.5 s; then three bombs 0.25 s apart. The drawn pops are a
    // subset of the heard ones, spread evenly, so picture and sound stay together.
    const heard = [];
    for (let t = 0; t < 10.5;) {
      heard.push(t);
      t += t < 1 ? 1 / (10 + 10 * t) : t < 9 ? rand(0.035, 0.075) : 1 / (24 + (t - 9) * 4);
    }
    const end = heard[heard.length - 1], n = walaLinks(), seen = [];
    for (let i = 0; i < n - 3; i++) seen.push(heard[Math.round((i * (heard.length - 1)) / (n - 4))]);
    seen.push(end + 0.25, end + 0.5, end + 0.75);
    it.heard = heard; it.seen = seen; it.ph = walaPh(it); it.sw = it.sv = 0; it.puff = 0; it.dur = end + 0.95;
  }
  Object.assign(ITEMS, {
    hazaar: {
      label: 'Hazaar ladi', fuse: 0.8, dur: 11, keep: 3, full: true,
      tip: [WALA_ARM, -WALA_GAP + WALA_FUSE], // the end of the fuse below the string, where it is lit
      ignite(it) { walaPlan(it); it.hi = 0; it.rapid = walaSound(it); },
      run(it, a, dt) {
        const S = it.s * U * IS, n = it.seen.length;
        if (!it.rapid.live && it.hi < it.heard.length && it.heard[it.hi] <= a + 0.15) it.rapid = walaSound(it);
        while (it.hi < it.heard.length && it.heard[it.hi] <= a + 0.15) it.rapid.snap(it.heard[it.hi++] - a); // heard a moment ahead
        if (!reduceMotion()) { // the swing: a spring that each pop kicks across
          it.sv = (it.sv - it.sw * 9 * dt) * Math.exp(-1.4 * dt); it.sw = clamp(it.sw + it.sv * dt, -0.21, 0.21);
        }
        while (it.popped < n && it.seen[it.popped] <= a) {
          const i = it.popped++, [lx, ly] = walaLink(i, n, it.sw, it.ph), x = it.x + lx * S, y = it.y + ly * S;
          const bomb = i % 40 === 39 || i >= n - 3;
          if (bomb) {
            paperBang(it, x, y, Q().maxStars < 300 ? 0.55 : 0.8, PAPER.red);
            if (!reduceMotion()) shake = Math.max(shake, 0.2);
            buzz(90);
          } else {
            groundPop(it, x, y, i, PAPER.red, { quiet: true, noSmoke: true, flakes: Q().maxStars < 300 ? 1 : 2 });
            if (i % 5 === 4) Sound.pop(pan(x), { gain: 0.7 });
            if (i % 4 === 0) buzz(12);
          }
          if (!reduceMotion()) it.sv += (it.sw > 0 ? -1 : 1) * rand(0.25, 0.5);
          if (!reduceMotion()) shake = Math.max(shake, 0.03);
        }
        // The burning front: a hot glow and sparks spraying out and down, every frame.
        if (it.popped < n) {
          const [fx, fy] = walaLink(it.popped, n, it.sw, it.ph), x = it.x + fx * S, y = it.y + fy * S;
          glowAt(x, y, '#ffcf6b', 22 * U * it.s, 0.9, 2.6);
          const k = Math.max(1, Math.round(3 * Math.min(1, Q().count)));
          for (let j = 0; j < k; j++) { const a = rand(-0.2, Math.PI + 0.2), v = rand(80, 260) * U; spark(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.8, Math.random() < 0.6 ? '#fff4dc' : '#ffb347', rand(0.12, 0.3)); }
        }
        // The plume climbs with the burning front: a puff every 0.25 s, bigger as it goes.
        if ((it.puff -= dt) <= 0 && it.popped < n) {
          it.puff = 0.25;
          const [lx, ly] = walaLink(it.popped, n, it.sw, it.ph), k = it.popped / n;
          smoke(it.x + lx * S, it.y + ly * S, rand(-12, 12) * U, -rand(15, 35) * U, '#8d8898', (6 + 10 * k) * U, (16 + 24 * k) * U, 2.6, 0.08);
        }
        if (it.popped >= n && !it.lit3) { it.lit3 = true; addLight('#ffd9a0', 3); }
      },
      reach(it) {
        const S = it.s * U * IS, ph = it.ph || walaPh(it), out = 60 * U * it.s;
        return [it.x - 10 * S - out, it.y - (WALA_H * ph + 20) * S, it.x + (WALA_ARM + WALA_CL + 6) * S + out, it.y];
      },
    },
  });

  // The Do-dhamaka's air bang, fixed when it is lit: straight up (±3°) to 300-420 U, kept on screen as the shots are.
  function twoPlan(it) {
    if (it.air) return it.air;
    const S = it.s * U * IS, h = rand(300, 420) * U * it.s, R = 90 * U * it.s, a = rand(-0.05, 0.05);
    let [x, y] = keepIn(it.x + Math.sin(a) * h, it.y - 18 * S - h, R, fitByZoom() ? FIT_MIN : 1);
    y = Math.min(y, it.y - 18 * S - 60 * U * it.s);
    return (it.air = { x: x - it.x, y: y - it.y, gone: false });
  }

  // ---------- Fit: the street pulls back so a burst stays on screen ----------
  // While a cracker's effect (reach) would leave the screen, the street's crackers and their fireworks scale down about
  // the street's bottom middle (just above the controls), no more than needed, and settle back after it. The sky and
  // the landmark stay as they are, so no edge of a picture ever shows; the street's floor only stretches down to meet
  // the crackers' far edge. fit.z is the scale (1: as framed), fit.py the pivot's height.
  const FIT_MIN = 0.6;
  const fit = { z: 1, target: 1, quiet: 0, py: 0 };
  const fitPivot = () => (fit.z < 1 || fit.target < 1 ? fit.py : groundBottom());
  function fitFor([x0, y0, x1], py, T) {
    const m = 10;
    let z = 1;
    if (y0 < T) z = Math.min(z, (py - T) / (py - y0));
    if (x0 < m) z = Math.min(z, (W / 2 - m) / (W / 2 - x0));
    if (x1 > W - m) z = Math.min(z, (W / 2 - m) / (x1 - W / 2));
    return clamp(z, FIT_MIN, 1);
  }
  // Where a burst of radius r centred near (x, y) has to be so it shows once the street is pulled back by zmin (1: not at all).
  function keepIn(x, y, r, zmin) {
    const py = groundBottom(), m = 10;
    return [clamp(x, W / 2 - (W / 2 - m) / zmin + r, W / 2 + (W / 2 - m) / zmin - r), Math.max(y, py - (py - fitTop()) / zmin + r)];
  }
  function updateFit(dt) {
    if (!fitByZoom() || mode !== 'play') { fit.z = fit.target = 1; fit.quiet = 0; return; }
    let want = 1, busy = false;
    const py = fitPivot();
    let T = 0; // read from the page only while something burns
    for (const it of groundItems) {
      const def = ITEMS[it.type];
      if (!def.reach || !it.armed) continue;
      busy = true; T = T || fitTop();
      want = Math.min(want, fitFor(def.reach(it), py, T));
    }
    if (want < 1 && fit.z === 1 && fit.target === 1) fit.py = py; // the pivot holds still while pulled back
    // Held while anything burns, so a seven shot doesn't pump in and out between its shots.
    if (busy) { fit.target = Math.min(fit.target, want); fit.quiet = 0; } else if ((fit.quiet += dt) > 0.6) fit.target = 1;
    fit.z += (fit.target - fit.z) * (1 - Math.exp(-dt * (fit.target < fit.z ? 3.2 : 2.2)));
    if (Math.abs(fit.target - fit.z) < 0.001) fit.z = fit.target;
  }
  // A layer's transform: moved (x, y) and scaled s about the screen's middle (the canvases' transform-origin), then
  // scaled by f about the fit's pivot.
  function layerTf(x, y, s, f = 1) {
    const X = f * x, Y = f * y + (1 - f) * (fit.py - H / 2), k = f * s;
    if (!X && !Y && k === 1) return '';
    return `translate3d(${X.toFixed(2)}px,${Y.toFixed(2)}px,0) scale(${k.toFixed(4)})`;
  }
  // The street's floor under the same move: its far edge goes where the crackers' far edge goes, its bottom stays on
  // the screen's bottom (it reaches down behind the controls), and it keeps the screen's width.
  function floorTf(x, y, s) {
    const f = fit.z, py = fit.py, F0 = H / 2 + s * (floorTop() - H / 2) + y;
    const a = f === 1 ? 1 : (H - (py - f * (py - F0))) / (H - F0), Y = a * y + ((1 - a) * H) / 2;
    if (!x && !Y && s === 1 && a === 1) return '';
    return `translate3d(${x.toFixed(2)}px,${Y.toFixed(2)}px,0) scale(${s.toFixed(4)},${(a * s).toFixed(4)})`;
  }
  // A screen point to the street's coordinates under the fit (for the sparkler, drawn on the street's layer).
  const unfit = (x, y) => (fit.z === 1 ? [x, y] : [W / 2 + (x - W / 2) / fit.z, fit.py + (y - fit.py) / fit.z]);
  // For the browser tests: the sound engine's live voices against its cap, and whether a bang still gets through.
  window.LUTSSound = {
    state: () => ({ voices: Sound.voices ? Sound.voices.size : 0, cap: Sound.CAP, rapids: Sound.rapids.size, running: !!(Sound.ctx && Sound.ctx.state === 'running') }),
    bang: () => { const was = Sound.voices ? Sound.voices.size : 0; Sound.bang(0); return (Sound.voices ? Sound.voices.size : 0) > was; },
  };
  // For the browser tests: fire a sky shell and read the realism engine (lift, apex beat, hang, colour change, smoke).
  window.LUTSPyro = {
    fire: (o) => launchShell({ tap: true, user: true, ...o }),
    layers: (x, y, sz, list) => layers(x, y, sz, list),
    state: () => ({
      shells: shells.map((s) => ({ type: s.type, lift: s.lift, apex: s.apex, dark: !!s.dark, x: s.x, y: s.y })),
      directorLeft: Math.max(0, directorUntil - gameTime), tally: { ...shellTally },
      strokes: strokes.length,
      trace: launch.sequence && launch.sequence.trace ? { i: launch.sequence.trace.i, done: launch.sequence.trace.done, of: strokes.length } : null,
      hazes: hazes.length, waterY: world.waterY || 0, quality: settings.quality,
      stars: stars.map((p) => ({ age: p.age, life: p.life, chT: p.chT, c2: !!p.color2, fl: p.fl })),
    }),
  };
  // For the browser tests: the fit, and how far each Sivakasi cracker on the street has got.
  window.LUTSFit = () => ({
    z: fit.z, target: fit.target, py: fit.py, byZoom: fitByZoom(), paper: confettis.length, W, H, U, top: fitTop(), t: gameTime,
    particles: stars.length + sparks.length + smokes.length + confettis.length, budget: Q().maxStars, shells: shells.length,
    items: groundItems.filter((it) => NEW_ITEMS.includes(it.type)).map((it) => ({ type: it.type, x: it.x, y: it.y, armed: it.armed, lit: it.lit, done: it.done,
      popped: it.popped, shots: it.shots, links: it.seen ? it.seen.length : 0, air: it.air ? [it.air.y, it.air.gone] : null, s: it.s, reach: it.armed && ITEMS[it.type].reach ? ITEMS[it.type].reach(it) : null, bursts: (it.plan || []).map((p) => [it.x + p.x, it.y + p.y, p.R]) })),
  });
  window.LUTSFit.shell = (t) => playerType(t); // and the shell a Sky-list launch of t bursts as (Random drawn)

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
    singleshot: [9, 26], doubleshot: [13, 26], sevenshot: [17, 28], saravedi: [92, 12], anilvedi: [14, 14], bijili: [9, 10], kuruvi: [9, 18], lakshmivedi: [12, 25],
    sutli: [15, 30], twosound: [9, 22], notes: [12, 16], pencil: [6, 50], hazaar: [22, 40],
  };
  const ITEM_ORDER = [...PREMIUM_FIRST, ...HOOKS, 'flowerpot', 'anar', ...SIVAKASI.filter((t) => !PREMIUM_ITEMS.has(t)), 'fountain', 'chakri', 'heli', 'rocket', 'rocketcombo', 'mine', 'multishot', 'roman', 'shell', 'cake', 'finale',
    'fancake', 'minerow', 'cometchain', 'cometburst', 'chrysline', 'silvertower', 'starwheel', 'kingsalute',
    'basket', 'bomb', 'firecracker', 'laddi', 'sparkler', 'lantern', 'wheel', 'strobe', 'popper', 'smoke', 'snake'];

  // ---------- Confetti ----------
  const confettis = [];
  const CONFETTI = ['#ff4d6d', '#ffd23f', '#3fd0ff', '#7dff6b', '#b46bff', '#ff9ad5', '#ffffff'];
  // w, h: its size in px (a flake by default; a Note shower's notes are bigger).
  function confetti(x, y, vx, vy, col, floorY, life = rand(4, 6), w = rand(4, 8) * U, h = rand(2, 4) * U) {
    if (stars.length + sparks.length + smokes.length + confettis.length >= Q().maxStars) return;
    confettis.push({ x, y, vx, vy, col, floorY, an: curAnchor, rot: rand(0, TAU), vr: rand(-12, 12), w, h, age: 0, life, ph: rand(0, TAU), landed: false });
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
  function itemScale(y, x) {
    if (w3dShown()) return itemScale3d(x ?? W / 2, y);
    return (0.55 + 0.75 * itemDepth(y)) * 1.35;
  }
  // Runs a cracker's effects and sounds at its distance.
  function atDepth(it, fn) {
    const z = it.z ?? itemDepth(it.y);
    const was = curAnchor;
    // a short wide screen (a TV): fountains stay under its top
    curLayer = 1; curScale = clamp(it.s, 0.6, 1.15) * (W > H ? clamp(H / 900, 0.5, 1) : 1); curDim = 0.6 + 0.4 * z; Sound.dist = 0.4 + 0.6 * z; curAnchor = it.an || null;
    try { fn(); } finally { curLayer = 0; curScale = 1; curDim = 1; Sound.dist = 1; curAnchor = was; }
  }
  function tipPos(it) {
    const def = ITEMS[it.type], S = it.s * U * IS;
    let [x, y] = def.tipAt ? def.tipAt(it) : def.tip;
    if (it.type === 'bomb' && !it.lit) { const f = it.armed ? clamp(it.t / def.fuse, 0, 1) : 0; x = 6 * (1 - f) + 2 * f; y = -30 + 8 * f; }
    return [it.x + x * S, it.y - (it.hy || 0) + y * S];
  }
  // Ground glows are queued and drawn once, over the art on #items (flushGlows, end of draw()), with their own alpha.
  // Painted into #gfx they summed frame on frame into a clipped white disc that hid the cracker. core: a hot head
  // sprite at .3r for nozzles, as a multiple of a. The 1.6x halo gain keeps today's brightness until the recipes land.
  const glowQ = [];
  function glowAt(x, y, col, r, a, core = 0) {
    r *= curScale; a *= curDim;
    if (a <= 0.01) return;
    glowQ.push({ x, y, s: SPR.id(col), r, a: a * 1.6, core: a * core });
  }
  function flushGlows() {
    if (!glowQ.length) return;
    ictx.globalCompositeOperation = 'lighter';
    for (const q of glowQ) {
      const f = 0.85 + 0.15 * Math.random();
      ictx.globalAlpha = Math.min(1, q.a * f); SPR.draw(ictx, q.s, SPR.SOFT, q.x, q.y, q.r);
      if (q.core) { ictx.globalAlpha = Math.min(1, q.core * f); SPR.draw(ictx, q.s, SPR.HEAD, q.x, q.y, q.r * 0.3); }
    }
    glowQ.length = 0;
    ictx.globalAlpha = 1; ictx.globalCompositeOperation = 'source-over';
  }

  // Street position for a tap/drop; taps above the street pick a random spot on it.
  function groundPoint(x, y) {
    if (w3dShown()) return groundPoint3d(x, y);
    const top = floorTop(), bot = groundBottom(), fh = bot - top;
    const py = y >= top - 40 * U ? clamp(y, top + fh * 0.12, bot) : top + fh * rand(0.15, 0.95);
    return [clamp(x, 30, W - 30), py];
  }
  // Drag-and-drop only accepts drops on (or just above) the street.
  function dropPoint(x, y) {
    if (w3dShown()) return y > groundBottom() + 40 || !w3d.ground(x, y).hit ? null : groundPoint3d(x, y);
    const top = floorTop(), bot = groundBottom();
    if (y < top - 50 * U || y > bot + 40) return null;
    return [clamp(x, 30, W - 30), clamp(y, top + (bot - top) * 0.12, bot)];
  }
  const sortItems = () => groundItems.sort((a, b) => a.y - b.y);
  // world: a forecourt spot in metres ({ x, z }) for a 3D cracker placed out of view; (x, y) is then only its fallback.
  function placeItem(type, x, y, world) {
    if (chor.on && !chor.placing && launch.state === 'READY') return null; // a launch re-places what is on the street
    if (!ITEMS[type]) type = 'flowerpot';
    const [px, py] = world && w3dShown() ? [x, y] : groundPoint(x, y);
    if (groundItems.length >= 22) {
      const old = groundItems.find((o) => !o.armed) || groundItems[0];
      groundItems.splice(groundItems.indexOf(old), 1);
    }
    const def = ITEMS[type];
    const it = {
      type, x: inStreet(type, px, py), y: py, s: itemScale(py), z: itemDepth(py), t: 0, rot: Math.random() * TAU, armed: false, lit: false, done: false, gone: 0, hy: 0,
      dur: def.dur, color: type === 'smoke' ? pick(SMOKE_COLORS) : color(), popped: 0, shots: 0, acc: 0,
    };
    if (w3dShown()) pinItem(it, world);
    noteSpot(it);
    groundItems.push(it);
    sortItems();
    queueBurstSync();
    atDepth(it, () => Sound.tick(pan(px)));
    return it;
  }
  // A long string (the ladi, the saravedi) is laid out whole on the flat street, never half off its edge (in 3D the
  // forecourt holds it).
  function inStreet(type, x, y) {
    if (type === 'hazaar') { // the pole and its string to the right of it, coil and all
      if (w3dShown()) return x;
      const S = itemScale(y) * U * IS;
      return clamp(x, 14 * S, W - (WALA_ARM + WALA_CL + 6) * S);
    }
    const hw = (HIT[type] || [14])[0];
    if (hw < 40 || w3dShown()) return x;
    const half = hw * itemScale(y) * U * IS + 10;
    return half * 2 >= W ? W / 2 : clamp(x, half, W - half);
  }
  function moveItem(it, x, y) {
    if (w3dShown() && !w3d.ground(x, y).hit) return; // above the horizon: it stays put
    const [px, py] = w3dShown() ? groundPoint(x, y) : groundPoint(x, Math.max(y, floorTop()));
    it.x = inStreet(it.type, px, py); it.y = py; it.s = itemScale(py); it.z = itemDepth(py);
    if (w3dShown()) pinItem(it);
    noteSpot(it);
    sortItems();
  }
  function hitItem(x, y) {
    for (let i = groundItems.length - 1; i >= 0; i--) {
      const it = groundItems[i];
      if (it.armed || it.done) continue;
      const S = it.s * U * IS, [hw, hh] = HIT[it.type] || [14, 30];
      if (Math.abs(x - it.x) < hw * S + 14 && y > it.y - hh * S - 14 && y < it.y + 14) return it;
    }
    return null;
  }
  const tried = new Set();
  try { JSON.parse(localStorage.getItem('luts:tried') || '[]').forEach((t) => tried.add(t)); } catch (e) { /* ignore */ }
  function armItem(it) {
    if (!launch.sequence || launch.sequence.item !== it) return;
    lightItem(it);
  }
  function lightItem(it) {
    if (it.armed || it.done) return;
    it.armed = true;
    it.t = 0;
    queueBurstSync(); // one fewer waiting: Fire's label and Burst all's count follow
    atDepth(it, () => Sound.hiss(ITEMS[it.type].fuse + 0.1, 6000, 0.05, pan(it.x), { q: 0.4 }));
    if (window.LUTSGoals) LUTSGoals.tick('launch'); achieve('first');
    // On a Pataka Chor street in a Mela Night race: the others (and anyone watching) see it go off too (rooms.js)
    if (chor.on && it.an && window.PatakaChor && PatakaChor.onBang && !PatakaChor.quiet) PatakaChor.onBang(it.shellId ? `sky:${it.shellId}` : it.type, it.an.wx, it.an.wz);
    if (!tried.has(it.type)) {
      tried.add(it.type);
      try { localStorage.setItem('luts:tried', JSON.stringify([...tried])); } catch (e) { /* ignore */ }
      if (ITEM_ORDER.every((t) => tried.has(t) || PREMIUM_ITEMS.has(t))) achieve('collector');
    }
  }
  function clearStreet() {
    // A Sky tube whose fuse is lit stays to send its shell up: its gems or free try are already spent.
    for (let i = groundItems.length - 1; i >= 0; i--) if (!groundItems[i].armed && groundItems[i].skyFuse == null) groundItems.splice(i, 1);
    queueBurstSync();
  }
  // The Burst all count follows the street; deferred a frame so it is safe to call from anywhere, even during boot.
  let burstSyncRaf = 0;
  function queueBurstSync() { if (!burstSyncRaf) burstSyncRaf = requestAnimationFrame(() => { burstSyncRaf = 0; syncBurstAll(); syncFireAll(); }); }
  // Fire's label follows the street too ("Fire all 3"), however the crackers got there.
  function syncFireAll() { const fire = $('#btnFire'); if (fire && launch.state === 'READY' && playMode === 'ground' && mode === 'play') syncLaunchUi(); }

  // A burning fuse: sparks spitting from its tip and a hot glow.
  function fuseSputter(it) {
    const [fx, fy] = tipPos(it), stalls = ITEMS[it.type].fuseStalls;
    // A stall (def.fuseStalls: when, 0.25 s each): the sparks stop and only an ember glows. It always catches again.
    if (stalls && stalls.some((t) => it.t >= t && it.t < t + 0.25)) { atDepth(it, () => glowAt(fx, fy, '#ff3b1f', 7 * U, 0.55, 1.6)); return; }
    atDepth(it, () => {
      if (Math.random() < 0.8) spark(fx, fy, rand(-40, 40) * U, rand(-60, 10) * U, pick(GOLD), rand(0.1, 0.3));
      glowAt(fx, fy, '#ffcf6b', 10 * U, 0.6, 2.4);
    });
  }
  function updateGround(dt) {
    let burning = 0;
    for (let i = groundItems.length - 1; i >= 0; i--) {
      const it = groundItems[i], def = ITEMS[it.type];
      if (it.done) { it.gone += dt; if (it.gone >= (def.keep ?? 0.7)) groundItems.splice(i, 1); continue; }
      if (it.skyFuse != null) { updateSweptTube(it, dt); continue; }
      if (!it.armed) continue;
      it.t += dt;
      if (it.t < 0) continue;
      if (!it.lit) {
        fuseSputter(it);
        if (it.t >= def.fuse) {
          it.lit = true; it.t = 0;
          runningGroundEffect = it.swept ? 'swept' : true;
          try { atDepth(it, () => def.ignite(it)); } finally { runningGroundEffect = false; }
        }
        continue;
      }
      burning++;
      runningGroundEffect = it.swept ? 'swept' : true;
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
    const own = it && it.shellId && skyArt[it.shellId];
    if (own && own.complete && own.naturalWidth) { // the chosen shell's own tube (its picture has a 4px margin round 248px)
      const oh = h * (own.naturalHeight / (own.naturalHeight - 8)), ow = oh * (own.naturalWidth / own.naturalHeight);
      g.drawImage(own, -ow / 2, -h - (oh - h) / 2, ow, oh);
      return true;
    }
    if (type === 'lantern' && it && it.lit) { // a lit lantern glows from inside
      const glow = g.createRadialGradient(0, -h * 0.4, 0, 0, -h * 0.4, h * 0.9);
      glow.addColorStop(0, 'rgba(255,190,90,0.55)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(0, -h * 0.4, h * 0.9, 0, TAU); g.fill();
    }
    g.drawImage(img, -w / 2, -h, w, h);
    return true;
  }
  // The real-show pieces stand on the street as the cracker they look like, until they have art of their own.
  const LOOK = { fancake: 'cake', minerow: 'mine', cometchain: 'multishot', cometburst: 'roman', chrysline: 'shell', silvertower: 'fountain', starwheel: 'wheel', kingsalute: 'rocket' };
  function drawItemShape(g, type, S, it) {
    type = LOOK[type] || type;
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
      case 'singleshot': case 'doubleshot': case 'sevenshot': {
        // Paper tubes, each capped with tissue until its shot has gone; the back row first. The seven are wrapped as one pack.
        const def = ITEMS[type], body = { singleshot: '#c8102e', doubleshot: '#2f5bd1', sevenshot: '#d7263d' }[type];
        const r = type === 'sevenshot' ? 3 : type === 'doubleshot' ? 4.6 : 6.5, fired = it ? it.shots : 0;
        const order = def.mouths.map((m, i) => [m, i]).sort((a, b) => a[0][1] - b[0][1]);
        for (const [[mx, my], i] of order) {
          const yb = my < -22 ? -3 : 0, gr = g.createLinearGradient((mx - r) * S, 0, (mx + r) * S, 0);
          gr.addColorStop(0, '#5a0a16'); gr.addColorStop(0.45, body); gr.addColorStop(1, '#3a0610');
          g.fillStyle = gr; g.fillRect((mx - r) * S, my * S, r * 2 * S, (yb - my) * S);
          g.fillStyle = '#ffcf6b'; g.fillRect((mx - r) * S, (my + 4) * S, r * 2 * S, 1.6 * S);
          g.fillStyle = i < fired ? '#1a1030' : '#f2a33a';
          g.beginPath(); g.ellipse(mx * S, my * S, r * S, r * 0.35 * S, 0, 0, TAU); g.fill();
        }
        if (type === 'sevenshot') {
          g.fillStyle = '#1f7a4a'; g.fillRect(-12 * S, -11 * S, 24 * S, 6 * S);
          g.fillStyle = '#ffcf6b'; g.fillRect(-12 * S, -9 * S, 24 * S, 1.4 * S);
        }
        if (!fired) {
          const [tx] = def.tip;
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo((tx - 3) * S, -16 * S); g.quadraticCurveTo((tx + 1) * S, -20 * S, tx * S, -24 * S); g.stroke();
        }
        break;
      }
      case 'saravedi': {
        // The string snakes across the street; the links next to the burning end twitch.
        const n = it && it.times ? it.times.length : SARA_N(), popped = it ? it.popped : 0, lit = it && it.lit;
        g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
        g.beginPath(); g.moveTo(-90 * S, -4 * S);
        for (let i = popped; i < n; i++) { const [lx, ly] = saraLink(i, n); g.lineTo(lx * S, ly * S); }
        g.stroke();
        for (let i = popped; i < n; i++) {
          const [lx, ly] = saraLink(i, n), j = lit && i - popped < 4 ? rand(-1, 1) : 0;
          g.save(); g.translate((lx + j) * S, (ly + j) * S); g.rotate(i % 2 ? 0.45 : -0.45);
          g.fillStyle = i % 4 === 3 ? '#2fa36b' : i % 2 ? '#d7263d' : '#f05a5a';
          g.fillRect(-1.6 * S, -5 * S, 3.2 * S, 10 * S);
          g.restore();
        }
        break;
      }
      case 'anilvedi': {
        // A packet of small green crackers tied with red; it thins as they go off.
        const n = it && it.n ? it.n : 24, left = it ? Math.ceil(7 * (1 - it.popped / n)) : 7;
        for (let i = 0; i < left; i++) {
          const x = (-9 + (i % 4) * 6 + (i >= 4 ? 3 : 0)) * S, y = (i >= 4 ? -9 : -4) * S;
          g.save(); g.translate(x, y); g.rotate(-0.4 + (i % 3) * 0.15);
          g.fillStyle = i % 2 ? '#2fa36b' : '#1f7a4a';
          g.beginPath(); g.roundRect(-2.2 * S, -5 * S, 4.4 * S, 10 * S, 1.2 * S); g.fill();
          g.fillStyle = '#ffd23f'; g.fillRect(-2.2 * S, -1 * S, 4.4 * S, 1.4 * S);
          g.restore();
        }
        if (left) {
          g.fillStyle = '#d7263d'; g.fillRect(-11 * S, -8 * S, 22 * S, 2 * S);
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo(6 * S, -8 * S); g.quadraticCurveTo(9 * S, -11 * S, 9 * S, -12 * S); g.stroke();
        }
        break;
      }
      case 'hazaar': {
        // A bamboo pole on a stand with an arm at the top; the red string hangs from the arm to just above the street. The
        // links already popped are gone (it burns up from its foot), and a heap of red paper grows below it.
        const ph = it ? it.ph || walaPh(it) : 1, n = it && it.seen ? it.seen.length : walaLinks(), popped = it ? it.popped : 0, sw = it ? it.sw || 0 : 0;
        const top = -WALA_H * ph;
        if (popped) {
          const k = popped / n;
          g.fillStyle = 'rgba(205,45,55,0.9)';
          g.beginPath(); g.ellipse((WALA_ARM + 4) * S, 0, (4 + 16 * k) * S, (1 + 5 * k) * S, 0, Math.PI, 0); g.fill();
        }
        g.fillStyle = '#4a3a2a'; g.fillRect(-7 * S, -3 * S, 14 * S, 3 * S);
        const pole = g.createLinearGradient(-2 * S, 0, 2 * S, 0);
        pole.addColorStop(0, '#9a7a3a'); pole.addColorStop(0.5, '#e0c27a'); pole.addColorStop(1, '#8a6a2e');
        g.fillStyle = pole; g.fillRect(-2 * S, top * S, 4 * S, -top * S);
        g.fillStyle = '#7a5a26';
        for (let y = -30 * ph; y > top + 4; y -= 40 * ph) g.fillRect(-2.4 * S, y * S, 4.8 * S, 1.4 * S); // bamboo nodes
        g.fillStyle = '#c9a35a'; g.fillRect(-2 * S, (top - 1) * S, (WALA_ARM + 3) * S, 2.6 * S);
        if (popped < n) { // the string from the arm down to its burning front (popped links are gone)
          g.save(); g.translate(WALA_ARM * S, top * S); g.rotate(-sw);
          walaString(g, it, n, ph, popped, S);
          g.restore();
        }
        if (it && it.lit) { // the count, to a thousand
          g.fillStyle = '#ffd36b'; g.font = `700 ${Math.max(9, 10 * S)}px Outfit, system-ui, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
          g.fillText(String(Math.round((1000 * popped) / n)), -5 * S, -8 * S);
        }
        break;
      }
      case 'sutli': {
        // A ball wrapped in jute twine, its fuse sticking up; gone off, a scorch mark and a few strands.
        if (it && it.lit) {
          g.fillStyle = 'rgba(20,14,12,0.7)'; g.beginPath(); g.ellipse(0, 0, 15 * S, 4.5 * S, 0, 0, TAU); g.fill();
          break;
        }
        const r = 12.6, cy = -13;
        const gr = g.createRadialGradient(-4 * S, (cy - 4) * S, 1, 0, cy * S, r * S);
        gr.addColorStop(0, '#e9cf96'); gr.addColorStop(0.6, '#c49a5c'); gr.addColorStop(1, '#7a5a2e');
        g.fillStyle = gr; g.beginPath(); g.arc(0, cy * S, r * S, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(0, cy * S, r * S, 0, TAU); g.clip();
        g.strokeStyle = 'rgba(90,60,25,0.55)'; g.lineWidth = 0.9 * S;
        for (let k = -16; k <= 16; k += 3.2) {
          g.beginPath(); g.moveTo((k - 8) * S, (cy - r) * S); g.lineTo((k + 8) * S, (cy + r) * S); g.stroke();
          g.beginPath(); g.moveTo((k + 8) * S, (cy - r) * S); g.lineTo((k - 8) * S, (cy + r) * S); g.stroke();
        }
        g.restore();
        const [tx, ty] = ITEMS.sutli.tipAt(it || {});
        g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.4 * S;
        g.beginPath(); g.moveTo(0, (cy - r + 1) * S); g.quadraticCurveTo(1 * S, (cy - r - 4) * S, tx * S, ty * S); g.stroke();
        break;
      }
      case 'twosound': {
        // Two charges stacked: the red one bangs on the street, the green top half flies.
        const flown = it && it.lit;
        g.fillStyle = '#c8102e'; g.beginPath(); g.roundRect(-6 * S, -10 * S, 12 * S, 10 * S, 2 * S); g.fill();
        g.fillStyle = '#ffcf6b'; g.fillRect(-6 * S, -6 * S, 12 * S, 1.6 * S);
        if (!flown) {
          g.fillStyle = '#1f7a4a'; g.beginPath(); g.roundRect(-5 * S, -20 * S, 10 * S, 10 * S, 2 * S); g.fill();
          g.fillStyle = '#ffcf6b'; g.fillRect(-5 * S, -16 * S, 10 * S, 1.4 * S);
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo(0, -20 * S); g.quadraticCurveTo(3 * S, -23 * S, 4 * S, -22 * S); g.stroke();
        } else { g.fillStyle = '#1a1030'; g.beginPath(); g.ellipse(0, -10 * S, 6 * S, 1.8 * S, 0, 0, TAU); g.fill(); }
        break;
      }
      case 'notes': {
        // A purple cardboard cash box with a gold slot; open once it has popped.
        const open = it && it.lit;
        const gr = g.createLinearGradient(0, -14 * S, 0, 0);
        gr.addColorStop(0, '#7a3fc4'); gr.addColorStop(1, '#4b1f86');
        g.fillStyle = gr; g.beginPath(); g.roundRect(-11 * S, -14 * S, 22 * S, 14 * S, 2 * S); g.fill();
        g.fillStyle = '#ffcf6b'; g.fillRect(-11 * S, -5 * S, 22 * S, 1.5 * S);
        if (!open) {
          g.fillStyle = '#5a2a9e'; g.beginPath(); g.moveTo(-12 * S, -14 * S); g.lineTo(12 * S, -14 * S); g.lineTo(10 * S, -17 * S); g.lineTo(-10 * S, -17 * S); g.closePath(); g.fill();
          g.fillStyle = '#ffd36b'; g.fillRect(-5 * S, -16.3 * S, 10 * S, 1.4 * S); // the slot
          g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
          g.beginPath(); g.moveTo(6 * S, -16 * S); g.quadraticCurveTo(8 * S, -17 * S, 7 * S, -15 * S); g.stroke();
        } else { g.fillStyle = '#2a1050'; g.beginPath(); g.ellipse(0, -14 * S, 10 * S, 2 * S, 0, 0, TAU); g.fill(); }
        break;
      }
      case 'pencil': {
        // A cup of sand with a thin coloured stick in it; the coating burns down from the top (like the sparkler).
        const tipY = it ? ITEMS.pencil.tipAt(it)[1] : -50;
        g.fillStyle = '#9a5a2e'; g.beginPath(); g.moveTo(-7 * S, -9 * S); g.lineTo(7 * S, -9 * S); g.lineTo(5 * S, 0); g.lineTo(-5 * S, 0); g.closePath(); g.fill();
        g.fillStyle = '#e5c98d'; g.beginPath(); g.ellipse(0, -9 * S, 7 * S, 1.8 * S, 0, 0, TAU); g.fill();
        g.strokeStyle = '#9a96a0'; g.lineWidth = 1.1 * S;
        g.beginPath(); g.moveTo(0, -9 * S); g.lineTo(0, -16 * S); g.stroke();
        const coat = g.createLinearGradient(0, -50 * S, 0, -16 * S);
        PENCIL_COLS.forEach((c, i) => { coat.addColorStop(i / 4, c); coat.addColorStop((i + 1) / 4 - 0.001, c); });
        g.strokeStyle = coat; g.lineWidth = 2.8 * S;
        g.beginPath(); g.moveTo(0, -16 * S); g.lineTo(0, tipY * S); g.stroke();
        break;
      }
      case 'bijili': case 'kuruvi': case 'lakshmivedi': {
        // Paper crackers: a wrapped packet with its printed label and wick. Gone off, only a scorch mark and scraps stay.
        if (it && it.lit) {
          const r = { bijili: 6, kuruvi: 9, lakshmivedi: 14 }[type];
          g.fillStyle = 'rgba(20,14,12,0.7)'; g.beginPath(); g.ellipse(0, 0, r * S, r * 0.32 * S, 0, 0, TAU); g.fill();
          g.fillStyle = '#c9a36b';
          for (let k = 0; k < 4; k++) g.fillRect((Math.sin(k * 2.3 + it.rot) * r - 1) * S, (-0.8 + 0.5 * (k % 2)) * S, 2.2 * S, 1 * S);
          break;
        }
        if (type === 'bijili') { // a thin red tube lying on the street, its wick at one end
          g.fillStyle = '#d7263d'; g.beginPath(); g.roundRect(-7 * S, -4 * S, 14 * S, 4 * S, 1.5 * S); g.fill();
          g.fillStyle = '#ffd23f'; g.fillRect(-2 * S, -4 * S, 2.4 * S, 4 * S);
          g.strokeStyle = '#c9a36b'; g.lineWidth = 0.9 * S;
          g.beginPath(); g.moveTo(7 * S, -2 * S); g.lineTo(8 * S, -3 * S); g.stroke();
          break;
        }
        const big = type === 'lakshmivedi', w = big ? 18 : 11, h = big ? 19 : 13;
        g.fillStyle = big ? '#c8102e' : '#2fa36b';
        g.beginPath(); g.roundRect(-w / 2 * S, -h * S, w * S, h * S, 2 * S); g.fill();
        if (big) { // plain red paper with a gold star and a gold band (no deity art on a cracker)
          g.fillStyle = '#ffcf6b';
          g.fillRect(-w / 2 * S, -4.5 * S, w * S, 1.6 * S);
          g.beginPath();
          for (let k = 0; k < 10; k++) { const r = (k % 2 ? 2.3 : 5.6) * S, a = -Math.PI / 2 + (k * Math.PI) / 5; g.lineTo(Math.cos(a) * r, -11 * S + Math.sin(a) * r); }
          g.closePath(); g.fill();
        } else { // a little bird (kuruvi) on the label
          g.fillStyle = '#ffe9a8';
          g.beginPath(); g.roundRect((-w / 2 + 2) * S, (-h + 3) * S, (w - 4) * S, (h - 6) * S, 1.5 * S); g.fill();
          g.fillStyle = '#2f5bd1';
          g.beginPath(); g.ellipse(0, -6.5 * S, 2.6 * S, 1.8 * S, 0, 0, TAU); g.fill();
          g.beginPath(); g.arc(2.4 * S, -8 * S, 1.2 * S, 0, TAU); g.fill();
          g.beginPath(); g.moveTo(-2 * S, -7 * S); g.lineTo(-4.2 * S, -8.6 * S); g.lineTo(-3.6 * S, -6 * S); g.closePath(); g.fill();
        }
        const [tx, ty] = ITEMS[type].tip;
        g.strokeStyle = '#c9a36b'; g.lineWidth = 1 * S;
        g.beginPath(); g.moveTo(0, -h * S); g.quadraticCurveTo(tx * S, (-h - 2) * S, tx * S, ty * S); g.stroke();
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
  const SHADOW_W = { hazaar: 26, saravedi: 90, sevenshot: 16, doubleshot: 12, anilvedi: 14, bijili: 8, kuruvi: 8, lakshmivedi: 12, sutli: 15, twosound: 9, notes: 13, pencil: 8, laddi: 68, cake: 22, finale: 26, basket: 15, firecracker: 18, rocketcombo: 16, anar: 13 };
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
      lights.push({ it, k, z: it.z ?? 1, S: it.s * U * IS });
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
      const S = it.s * U * IS, len = (20 + 34 * Math.min(1, w)) * S, half = (SHADOW_W[it.type] || 13) * S * 0.5;
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
      const S = it.s * U * IS, r = 22 * S, x = it.x + side * 5 * S, y = it.y - (it.hy || 0) - 14 * S;
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
      if (it.an && it.an.off && w3dShown()) continue; // behind the camera for now: not drawn at its last spot
      const keep = ITEMS[it.type].keep ?? 0.7;
      // Far crackers fade a little into the night.
      gctx.globalAlpha = (it.done ? (keep ? Math.max(0, 1 - it.gone / keep) : 0) : 1) * (0.62 + 0.38 * (it.z ?? 1));
      gctx.save();
      gctx.translate(it.x, it.y - (it.hy || 0));
      drawItemShape(gctx, it.type, it.s * U * IS, it);
      gctx.restore();
      if (!it.armed) {
        // Waiting to be lit: a soft pulsing ring invites a tap.
        const S = it.s * U * IS, pulse = 0.35 + 0.25 * Math.sin(gameTime * 5 + it.rot);
        gctx.strokeStyle = `rgba(255,210,122,${pulse})`;
        gctx.lineWidth = 1.5;
        gctx.beginPath(); gctx.ellipse(it.x, it.y + 1, ringW(it.type) * S, 5.5 * S, 0, 0, TAU); gctx.stroke();
      }
    }
    drawCatchLight();
    if (dragPreview) {
      const s = itemScale(dragPreview.y, dragPreview.x), S = s * U * IS;
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

  // Dock chips use the same drawings as the game (d: pixels per unit; Pataka Chor's shop draws them bigger, as pictures).
  function itemIcon(type, d = 2) {
    const c = document.createElement('canvas');
    c.width = c.height = 34 * d;
    const g = c.getContext('2d');
    g.scale(d, d);
    const S = { rocket: 0.42, roman: 0.62, laddi: 0.22, cake: 0.75, sparkler: 0.6, wheel: 0.52, lantern: 0.72, popper: 0.9, heli: 0.85,
      anar: 0.82, fountain: 0.7, shell: 0.48, multishot: 0.7, firecracker: 0.9, rocketcombo: 0.48, finale: 0.6, saravedi: 0.17, sevenshot: 0.85, bijili: 1.3, lakshmivedi: 0.95, pencil: 0.58, sutli: 0.85, twosound: 1.05, hazaar: 0.135 }[LOOK[type] || type] || 0.95;
    g.translate(type === 'hazaar' ? 12 : 17, type === 'laddi' || type === 'saravedi' ? 19 : type === 'hazaar' ? 31 : type === 'firecracker' || type === 'anilvedi' ? 24 : type === 'bijili' ? 22 : 30);
    drawItemShape(g, type, S, null);
    return c.toDataURL();
  }
  const groundList = $('#groundList');
  function placeSelectedCracker() {
    if (launch.state !== 'READY') return;
    clearStreet();
    if (w3dShown()) placeInView3d(settings.item, 0.5, 0.5); // in 3D: the middle of the ground in view
    else placeItem(settings.item, ...streetSpot(0.5, 0.8));
  }
  // 3D: a cracker placed without a tap (a chip, Burst all's next one, the Sky tube) stands on the forecourt the player
  // can see, at fractions across (fx) and down (fy, 0 far, 1 near) that visible ground. When they have looked away from
  // the forecourt, the view eases back to it and the cracker stands at that spot on it, so it is never placed out of sight.
  function placeInView3d(type, fx, fy) {
    const spot = visibleSpot3d(fx, fy);
    if (spot) return placeItem(type, spot.sx, spot.sy, spot.world);
    w3d.reset();
    const z = w3d.zone;
    return placeItem(type, W * 0.5, groundBottom() - 10, { x: z.x0 + (z.x1 - z.x0) * (0.12 + 0.76 * fx), z: z.z0 + (z.z1 - z.z0) * (0.15 + 0.7 * fy) });
  }
  // The forecourt in view, as the view will settle (the camera may still be easing after a drag): screen points, clear
  // of the edges and the controls, whose ground is inside the cracker zone. Returns the one nearest fx across and fy down
  // that patch, with its spot on the ground, or null when none of the forecourt is in view.
  function visibleSpot3d(fx, fy) {
    return w3d.atRest(() => {
      const pts = [], bot = groundBottom() - 10;
      for (let sy = bot; sy > H * 0.12; sy -= 10) {
        for (let sx = 24; sx <= W - 24; sx += 16) {
          const g = w3d.ground(sx, sy);
          if (g.inside) pts.push({ sx, sy, world: { x: g.x, z: g.z } });
        }
      }
      if (pts.length < 4) return null;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx); y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy); }
      const tx = x0 + (x1 - x0) * fx, ty = y0 + (y1 - y0) * (0.2 + 0.7 * fy);
      let best = null, bd = Infinity;
      for (const p of pts) { const d = (p.sx - tx) ** 2 + (p.sy - ty) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    });
  }
  // Where a cracker stands as fractions across and down the street (the inverse of streetSpot), so it keeps its place
  // when the background switches between 2D and 3D.
  function noteSpot(it) {
    if (w3dShown() && it.an) {
      const z = w3d.zone;
      it.fx = ((it.an.wx - z.x0) / (z.x1 - z.x0) - 0.12) / 0.76; it.fy = ((it.an.wz - z.z0) / (z.z1 - z.z0) - 0.15) / 0.7;
    } else { it.fx = (it.x - W * 0.14) / (W * 0.72); it.fy = (it.y - floorTop()) / floorH(); }
    it.fx = clamp(it.fx, 0, 1); it.fy = clamp(it.fy, 0, 1);
  }
  // A spot on the street, as fractions across (0 left, 1 right) and down it (0 far, 1 near), in screen pixels.
  function streetSpot(fx, fy) {
    if (!w3dShown()) return [W * (0.14 + 0.72 * fx), floorTop() + floorH() * fy];
    const z = w3d.zone, p = w3d.project(z.x0 + (z.x1 - z.x0) * (0.12 + 0.76 * fx), 0, z.z0 + (z.z1 - z.z0) * (0.15 + 0.7 * fy));
    return p ? [p[0], p[1]] : [W * 0.5, groundBottom() - 30];
  }
  // Premium: each cracker picked joins the others on the street (spread out so they don't overlap), ready for Burst all.
  // A 3D world's forecourt is roomier, so it takes more where the phone has particles to spare.
  const burstMax = () => (w3dShown() && Q().maxStars >= 300 ? 12 : 8);
  // Premium from the store, or the Play reviewer code (Settings title tapped 7 times), so reviewers can try it too.
  const burstEntitled = () => true; // Burst all, AR and multi-place are free for everyone
  const tapSkyEntitled = () => premium.active; // Tap Sky is Premium
  const waitingItems = () => groundItems.filter((it) => !it.armed && !it.done);
  // Crackers that burn more than 10 s (a Hazaar ladi): one waits on the street at a time, so a Burst all stays short.
  const longWaiting = (type) => ITEMS[type].dur > 10 && waitingItems().some((it) => ITEMS[it.type].dur > 10);
  function addSelectedCracker() {
    if (launch.state !== 'READY') return;
    if (longWaiting(settings.item)) { toast('One long cracker at a time. Light it first'); return; }
    const n = waitingItems().length;
    if (n >= burstMax()) { toast(`Up to ${burstMax()} crackers at once. Tap Burst all!`); return; }
    if (w3dShown()) {
      // The first in the middle of the ground in view, the rest round it in a widening spiral.
      const r = 0.16 * Math.sqrt(n), a = n * 2.4;
      placeInView3d(settings.item, clamp(0.5 + r * Math.cos(a), 0, 1), clamp(0.5 + r * 0.8 * Math.sin(a), 0, 1));
      return;
    }
    placeItem(settings.item, W * (0.14 + 0.72 * ((n * 0.618 + 0.5) % 1)), floorTop() + floorH() * (0.64 + 0.26 * ((n * 0.37) % 1)));
  }
  // The dock under the street grows and shrinks (Burst all appears, the list wraps): the street follows its edge, so the
  // waiting crackers keep their places on it and the landmark stays at its far side.
  let dockH = 0;
  if (window.ResizeObserver) new ResizeObserver(() => {
    // The dock hides during a show: its height then means nothing, and the street keeps its place until it returns.
    const h = Math.round($('.bottom-ui').getBoundingClientRect().height);
    if (!h || h === dockH || launch.state !== 'READY') return;
    dockH = h;
    if (mode !== 'play' || arOn) return;
    // In 3D the horizon sits a band above the controls, so the camera follows their edge: the world chip leaves with 2D
    // a frame after the switch, and the scene was framed for the taller dock
    if (w3dShown()) { sizeWorld3d(); return; }
    if (playMode === 'ground') {
      for (const it of waitingItems()) {
        if (it.fx == null) continue;
        const [x, y] = streetSpot(it.fx, it.fy);
        it.x = x; it.y = y; it.s = itemScale(y); it.z = itemDepth(y);
      }
      sortItems(); drawFloor();
    }
    refitScene(playMode === 'ground'); // the dock appeared or changed: the landmark, city or ghat stands just above it
  }).observe($('.bottom-ui'));
  // Drag a cracker from the list onto the street: Premium players add it there (up to burstMax(), for Burst all);
  // free players move their one cracker to the drop spot. A short tap still works as before.
  // In Sky mode a shell chip dragged onto the ground stands another tube there, for the sparkler to light.
  function startChipDrag(e, chip, id, sky) {
    if (launch.state !== 'READY' || mode !== 'play' || playMode !== (sky ? 'sky' : 'ground') || rush.on || itemLocked(sky ? shellKey(id) : id)) return;
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
      const at3d = w3dShown() && dropPoint(ev.clientX, ev.clientY);
      if (w3dShown() && !at3d) return; // over the sky: the preview waits where it was
      const [x, y] = at3d || groundPoint(ev.clientX, Math.max(ev.clientY, floorTop()));
      dragPreview = { type: sky ? 'shell' : id, x, y };
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      if (dragging) setTimeout(() => { delete chip.dataset.dragged; }, 400); // a cancelled drag sends no click to clear it
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      const drop = dragPreview; dragPreview = null;
      if (!dragging || !drop || ev.type === 'pointercancel' || launch.state !== 'READY') return;
      if (ev.clientY > chip.getBoundingClientRect().top - 8) return; // released back over the list: nothing placed
      if (sky) {
        if (groundItems.filter((it) => (it.launcher || it.skyTube) && !it.done).length >= burstMax()) { toast(`Up to ${burstMax()} crackers at once. Tap Burst all!`); return; }
        const tube = placeItem('shell', drop.x, drop.y);
        tube.skyTube = true; tube.shellId = id;
        return;
      }
      settings.item = id; saveSettings(); syncModeUi();
      if (burstEntitled()) {
        if (waitingItems().length >= burstMax()) { toast(`Up to ${burstMax()} crackers at once. Tap Burst all!`); return; }
        if (longWaiting(id)) { toast('One long cracker at a time. Light it first'); return; }
      } else clearStreet();
      placeItem(id, drop.x, drop.y);
      sivakasiHint(id);
      syncLaunchUi();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  // Premium "Tap sky": every tap fires a fast shell that bursts where you touched, for a relaxed show. No points are
  // earned. Shells in flight are capped (fewer on the low tier) so a weak phone never floods with particles.
  let tapSky = false;
  try { tapSky = localStorage.getItem('luts:tapsky') === '1'; } catch (e) { /* ignore */ }
  const tapSkyOn = () => tapSky && tapSkyEntitled() && mode === 'play' && playMode === 'sky' && !rush.on && launch.state === 'READY';
  function tapFire(x, y) {
    if (shells.length >= (Q().maxStars < 300 ? 3 : 6)) return;
    // Each tap is a launch of the chosen shell, so it costs that shell's gems like Fire does.
    const sel = selection(), cost = gemCost(sel);
    if (cost > gems()) { openGems({ cost, label: sel.label }); return; }
    spendGems(cost);
    festLaunched([settings.shell]);
    el.hint.classList.add('gone');
    const [dx, dy] = layerShift(VIEW_DEPTH.fx);
    const tx = x - dx, ty = clamp(y - dy, H * 0.08, H * 0.72);
    // Each shell leaves from the tube waiting on the ground.
    const tube = groundItems.find((it) => it.launcher), tip = tube && tipPos(tube);
    const [sx, sy] = tip && tip[1] > ty + 40 ? tip : [undefined, undefined]; // (a tap right by the tube flies from below)
    launchShell({ x: tx, y: ty, sx, sy, type: playerType(settings.shell), user: true, exact: true, fast: 1.5, tap: true, an: w3dShown() ? anchorAt(tx, ty, 150) : undefined });
  }
  const tapSkyBtn = $('#btnTapSky');
  tapSkyBtn.addEventListener('click', () => {
    if (!tapSkyEntitled()) { openPremium(); return; }
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
    $('#btnAR').classList.toggle('locked', !premium.active); // AR is Premium
    const sky = tapSkyEntitled();
    tapSkyBtn.classList.toggle('locked', !sky);
    tapSkyBtn.setAttribute('aria-pressed', String(sky && tapSky));
    $('#tapSkyLabel').textContent = sky && tapSky ? 'Tap sky: on' : 'Tap sky';
    tapSkyBtn.hidden = mode !== 'play' || rush.on || playMode !== 'sky';
    tapSkyBtn.disabled = launch.state !== 'READY';
    burstAllBtn.title = paid ? 'Light every cracker on the street together' : 'Premium: light many crackers together';
  }
  burstAllBtn.addEventListener('click', () => {
    if (!burstEntitled()) { openPremium(); return; }
    if (waitingItems().length < 2) { toast('Pick a few crackers first, then Burst all'); return; }
    if (mode !== 'play' || paused || document.hidden || rewardBusy || launch.state !== 'READY') return;
    launchWithGems({ id: 'item:all', label: 'Burst all', type: settings.item, ground: true, multi: true });
  });
  // Pays a launch's gems up front (refunded when it does not start), or opens the gem sheet when they fall short.
  function launchWithGems(s) {
    // Pataka Chor: Fire lights the crackers you found and put down; with none on the street there is nothing to light.
    if (chor.on && s.id && s.id.startsWith('item:') && !waitingItems().length) { toast('Find a cracker first, then put it down'); return false; }
    // Premium crackers and shells a free player lights here use their free tries (once the launch starts); one with
    // none left opens the offer instead.
    const items = s.id && s.id.startsWith('item:') ? (s.multi ? [...new Set(waitingItems().slice(0, burstMax()).map((it) => it.type))] : [s.type])
      : s.id && s.id.startsWith('shell:') ? [s.id] : [];
    const out = items.find((t) => onTry(t) && !tryLeft(t));
    if (out) { offerTry(out); return false; }
    const cost = gemCost(s);
    if (cost > gems()) { openGems({ cost, label: s.label, s }); return false; }
    spendGems(cost);
    const refund = () => { if (cost) { wallet.b += cost; saveWallet(); syncGems(); } };
    const types = s.writing ? [] : s.multi ? waitingItems().slice(0, burstMax()).map((it) => it.type) : [s.type];
    return Promise.resolve(launch.request(s)).then((ok) => { if (ok === false) refund(); else { festLaunched(types); items.forEach(useTry); } return ok; }, (e) => { refund(); throw e; });
  }
  for (const id of ITEM_ORDER) {
    const b = document.createElement('button');
    b.className = 'shell-chip';
    b.dataset.item = id;
    b.innerHTML = '<span class="ico"><img alt=""></span><span></span>';
    b.dataset.sprite = itemIcon(id); // the drawn cracker, also used while dragging it onto the street
    realGroundArt(b, id, () => b.dataset.sprite);
    b.lastChild.textContent = ITEMS[id].label;
    b.title = PREMIUM_ITEMS.has(id) ? `${ITEMS[id].label} · Premium` : GEM_COST[id] ? `${ITEMS[id].label} · ${GEM_COST[id]} gems` : `${ITEMS[id].label} · free`;
    b.classList.toggle('premium-item', PREMIUM_ITEMS.has(id)); // a crown for free players (style.css)
    gemBadge(b, GEM_COST[id]);
    if (PREMIUM_ITEMS.has(id)) { const e = document.createElement('em'); e.className = 'chip-try'; e.textContent = 'Free try'; b.append(e); }
    if (id === 'hazaar' && dayKey() <= '2026-11-15') { const e = document.createElement('em'); e.className = 'chip-new'; e.textContent = 'New'; b.append(e); }
    b.addEventListener('pointerdown', (e) => startChipDrag(e, b, id));
    b.addEventListener('click', () => {
      if (b.dataset.dragged) { delete b.dataset.dragged; return; } // a drag already placed it
      if (launch.state !== 'READY') return;
      if (itemLocked(id)) { offerTry(id); return; }
      pickItem(id);
    });
    groundList.append(b);
  }
  // A chip tapped (or a video light won): it becomes the chosen cracker and stands on the street.
  function pickItem(id) {
    settings.item = id; saveSettings(); syncModeUi();
    if (mode === 'play' && playMode === 'ground') (burstEntitled() ? addSelectedCracker() : placeSelectedCracker());
    sivakasiHint(id);
    syncLaunchUi();
    // The first string of crackers a player picks: a word about real ones, once.
    if ((id === 'saravedi' || id === 'hazaar' || id === 'laddi') && mode === 'play') {
      let seen = true;
      try { seen = localStorage.getItem('luts:safety') === '1'; localStorage.setItem('luts:safety', '1'); } catch (e) { /* storage unavailable */ }
      if (!seen) setTimeout(() => toast('Real crackers: follow local rules and timings.', 4000), 600);
    }
  }
  // "Free try" on a Premium cracker's chip while a free player still has its light (hidden for Premium, style.css).
  function syncTries() {
    for (const e of groundList.querySelectorAll('.chip-try')) e.hidden = !tryLeft(e.parentElement.dataset.item);
    for (const e of shellList.querySelectorAll('.chip-try')) e.hidden = !tryLeft(shellKey(e.parentElement.dataset.shell));
  }
  syncTries();
  // A Premium cracker with no light left: one more today for a short video (once a day, when a video is ready), else
  // straight to Premium. Saying no just closes the sheet.
  let tryFor = null;
  function offerTry(type) {
    if (tries.vday !== dayKey() && videoOk(rewardsProvider())) {
      tryFor = type;
      $('#tryLine').textContent = `You have lit your free ${crackerName(type)}. Watch a short video to light it once more today.`;
      // The picture: the Hazaar ladi going off for a ground cracker, the palace finale for a sky shell.
      const art = type.startsWith('shell:') ? 'assets/premium/hero-finale' : 'assets/premium/hero-hazaar';
      $('#tryModal .try-art source').srcset = `${art}.webp`; $('#tryModal .try-art img').src = `${art}.jpg`;
      $('#btnTryVideo').disabled = rewardBusy;
      openSheet($('#tryModal'));
    } else openPremium({ sivakasi: type });
  }
  async function watchTryVideo() {
    const type = tryFor, provider = rewardsProvider();
    if (!type || rewardBusy || !provider || tries.vday === dayKey()) return;
    rewardBusy = true; $('#btnTryVideo').disabled = true;
    try {
      const receipt = await rewardTimeout(() => provider.watchAd({ cracker: type }));
      if (receipt && receipt.kind === 'ad' && await provider.verifyReceipt(receipt) === true && !wallet.tx.includes(`ad:${receipt.id}`)) {
        wallet.tx.push(`ad:${receipt.id}`); saveWallet();
        if (provider.acknowledgeReceipt) { try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* deduplicated by id */ } }
        tries.vday = dayKey(); tries.vfor = type; saveTries(); syncTries();
        closeSheet($('#tryModal'));
        if (launch.state === 'READY') { if (type.startsWith('shell:')) setShell(type.slice(6)); else pickItem(type); }
        toast(`${crackerName(type)} is yours to light once more today`, 3000);
      }
    } catch (error) { toast((error && error.message) || 'No video is available. Try again later.'); }
    finally { rewardBusy = false; $('#btnTryVideo').disabled = false; }
  }
  $('#btnTryVideo').addEventListener('click', watchTryVideo);
  $('#btnTryPremium').addEventListener('click', () => { closeSheet($('#tryModal')); openPremium({ sivakasi: tryFor }); });
  $('#tryBack').addEventListener('click', () => closeSheet($('#tryModal')));
  $('#btnClearStreet').addEventListener('click', () => { clearStreet(); clearWriting(); });
  // A Sivakasi cracker set down: how to light it (a TV's remote has Fire, not the sparkler).
  function sivakasiHint(id) {
    if (!NEW_ITEMS.includes(id) || mode !== 'play' || playMode !== 'ground' || document.documentElement.classList.contains('tv')) return;
    el.hint.textContent = 'Sweep the sparkler across fuses to light them.';
    el.hint.classList.remove('gone');
  }

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
    // Touching a placed shape picks it up to slide it; anywhere else the sparkler draws. (Shapes are added from their
    // chips, one per tap or drag, so a tap on the sky never stamps another copy.)
    const hit = shapeAt(x, y);
    if (hit) { shapeDrag = { g: hit, x, y }; return; }
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
  let shapeDrag = null, shapeGroup = 0;
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
    try { if (!localStorage.getItem('luts:pinch-tip')) { localStorage.setItem('luts:pinch-tip', '1'); setTimeout(() => toast('Pinch a shape to make it bigger or smaller', 3500), 600); } } catch (e) { /* storage unavailable */ }
    return g;
  }
  function moveShape(g, dx, dy) {
    for (const p of strokes) if (p.g === g) { p.x += dx; p.y += dy; }
    strokesDirty = true;
  }
  // Grows or shrinks a placed shape about its middle, from about half to four times its first size.
  function scaleShape(g, k) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of strokes) if (p.g === g) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    if (x0 === Infinity) return;
    const size = Math.max(x1 - x0, y1 - y0, 1), s = shapeSize() * 2;
    k = clamp(k, (s * 0.5) / size, (s * 4) / size);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const p of strokes) if (p.g === g) { p.x = cx + (p.x - cx) * k; p.y = cy + (p.y - cy) * k; }
    strokesDirty = true;
  }
  let shapePinch = null; // the second finger of a pinch on a shape: { id, x, y, d }
  function pinchShape() {
    if (!shapeDrag || !pointer) { shapePinch = null; return; }
    const d = Math.hypot(shapePinch.x - pointer.x, shapePinch.y - pointer.y);
    if (shapePinch.d > 12 && d > 12) scaleShape(shapeDrag.g, d / shapePinch.d);
    shapePinch.d = d;
  }
  // On a computer the mouse wheel over a shape does the same.
  stage.addEventListener('wheel', (e) => {
    if (mode !== 'play' || playMode !== 'spark' || launch.state !== 'READY') return;
    const g = shapeAt(e.clientX - arPan.x, e.clientY - arPan.y);
    if (!g) return;
    e.preventDefault();
    scaleShape(g, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
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
  function syncShapeUi() { shapeList.querySelectorAll('.shape-chip').forEach((b) => { const on = !b.dataset.shape && sparkTool === 'pen'; b.classList.toggle('active', on); if (!b.dataset.shape) b.setAttribute('aria-pressed', String(on)); }); }
  // Drag a shape from its chip onto the sky: it lands where you let go (released back over the controls, nothing).
  function startShapeDrag(e, chip, id) {
    if (launch.state !== 'READY' || mode !== 'play' || playMode !== 'spark') return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let ghost = null;
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!ghost && Math.abs(ev.clientY - sy) > 14 && Math.abs(ev.clientY - sy) > Math.abs(ev.clientX - sx)) {
        chip.dataset.dragged = '1';
        try { chip.setPointerCapture(pid); } catch (err) { /* ignore */ }
        ghost = chip.querySelector('img').cloneNode();
        ghost.className = 'shape-ghost';
        document.body.append(ghost);
      }
      if (!ghost) return;
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      setTimeout(() => { delete chip.dataset.dragged; }, 400); // a cancelled drag sends no click to clear it
      if (ev.type === 'pointercancel' || launch.state !== 'READY' || ev.clientY > $('#shapeStrip').getBoundingClientRect().top - 8) return;
      setSparkTool('pen');
      if (placeShape(id, ev.clientX, ev.clientY)) toast(`${SHAPES[id].label} added. Drag it to move it`);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  for (const id of [null, ...Object.keys(SHAPES)]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'shape-chip';
    if (id) b.dataset.shape = id;
    const img = document.createElement('img'); img.alt = ''; img.draggable = false;
    img.src = id ? shapeIcon(id) : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"/></svg>');
    const t = document.createElement('span'); t.textContent = id ? SHAPES[id].label : 'Draw';
    b.append(img, t);
    if (id) b.addEventListener('pointerdown', (e) => startShapeDrag(e, b, id));
    b.addEventListener('click', () => {
      setSparkTool('pen');
      if (!id) { toast('Draw with your finger'); return; }
      if (b.dataset.dragged) { delete b.dataset.dragged; return; } // a drag already placed it
      // Tapping a shape puts one on screen straight away, a little apart from the last; drag it into place.
      if (mode === 'play' && playMode === 'spark' && launch.state === 'READY') {
        const n = new Set(strokes.filter((p) => p.g).map((p) => p.g)).size;
        const g = placeShape(id, W * (0.5 + 0.22 * Math.sin(n * 2.4)), H * clamp(0.3 + 0.08 * (n % 4), 0.2, 0.55));
        if (g) toast(`${SHAPES[id].label} added. Drag it to move it`);
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
    syncShapeUi(); // the Draw chip lights while the pen is chosen
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
  }
  // On #items (cleared every frame), so neither the pen's light nor the eraser ring is left behind on #gfx.
  function drawPenHead() {
    const g = ictx;
    if (eraser) {
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(eraser.x, eraser.y, 24 * U, 0, TAU); g.fill(); g.stroke();
    }
    // Written strokes keep twinkling: glints on #items, not sparks on #gfx, so nothing lingers after pen-up and the idle wipe can fire.
    if (strokes.length && playMode === 'spark') {
      const s = SPR.id('#fff4dc');
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const p = strokes[(Math.random() * strokes.length) | 0];
        g.globalAlpha = rand(0.4, 0.9); SPR.draw(g, s, SPR.HEAD, p.x + rand(-4, 4) * U, p.y + rand(-4, 4) * U, rand(2, 4) * UV());
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (!pen) return;
    const r = 15 * UV() * rand(0.9, 1.1), col = settings.spark === 'rainbow' ? toHex(`hsl(${pen.hue % 360},100%,68%)`) : SPARK_COLORS[settings.spark] || SPARK_COLORS.gold;
    const s = SPR.id(col);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35; SPR.draw(g, s, SPR.SOFT, pen.x, pen.y, r * 3.2);
    g.globalAlpha = 0.6; g.strokeStyle = col; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 5; i++) { const a = rand(0, TAU), l = r * rand(0.8, 2); g.moveTo(pen.x, pen.y); g.lineTo(pen.x + Math.cos(a) * l, pen.y + Math.sin(a) * l); }
    g.stroke();
    g.globalAlpha = 1; SPR.draw(g, s, SPR.HEAD, pen.x, pen.y, r);
    g.globalCompositeOperation = 'source-over';
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
      while (stars.length) release(starPool, stars.pop());
      while (sparks.length) release(sparkPool, sparks.pop());
      gctx.clearRect(0, 0, W, H);
    }
    syncDrawingAction();
  }
  // Turns the written light into a burst of fireworks.
  function startTrace() {
    pctx.clearRect(0, 0, W, H);
    const dur = clamp(strokes.length / 250, 1.6, 3.5);
    Sound.sparklerStart();
    return { i: 1, f: 1, rate: strokes.length / dur, done: false };
  }
  function traceStep(t, dt) {
    t.f += t.rate * dt;
    const to = Math.min(strokes.length, Math.floor(t.f));
    for (; t.i < to; t.i++) {
      const a = strokes[t.i - 1], b = strokes[t.i];
      if (a.id === b.id) paintSegment(a.x, a.y, b.x, b.y, b.c);
    }
    const head = strokes[Math.min(strokes.length, t.i) - 1];
    penSparks(head.x, head.y, 4);
    glowAt(head.x, head.y, '#fff1c8', 22 * U, 0.8, 2.4);
    if (t.i >= strokes.length) { t.done = true; Sound.sparklerStop(); }
  }
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
    ['card', '💌', 'Card sender', 'Play a love card show'],
    ['video', '🎬', 'Director', 'Save your first video'],
    ['bday1', '🎂', 'Birthday keeper', 'Save a friend’s birthday'],
    ['bday5', '👯', 'Friend magnet', 'Save 5 birthdays'],
    ['hero', '🎁', 'Birthday hero', 'Make a video for a saved friend'],
    ['joy1', '✨', 'Grateful heart', 'Light up your first person'],
    ['joy3', '🕯️', 'Three bright days', 'Keep a 3-day joy streak'],
    ['joy7', '🔥', 'Week of joy', 'Keep a 7-day joy streak'],
    ['joy30', '🌟', 'Month of light', 'Keep a 30-day joy streak'],
    ['share', '📣', 'Spread the joy', 'Share a dedication'],
    ['rush', '🏮', 'Lantern lighter', 'Finish your first Lantern Rush'],
    ['daily7', '📅', 'Week of skies', 'Play the Daily Sky 7 days in a row'],
    ['rival', '🥇', 'Champion', 'Beat a friend’s challenge'],
    ['bringer', '🌌', 'Sky Master', 'Reach the Sky Master light-bringer rank'],
  ];
  let achieved = {};
  try { achieved = JSON.parse(localStorage.getItem('luts:ach') || '{}') || {}; } catch (e) { achieved = {}; }
  // The Android app mirrors badges to Google Play Games (see GameAchievements.kt); elsewhere this does nothing.
  const playGames = (action, arg) => (ANDROID_WEBVIEW && typeof window.LUTSNative.ads === 'function'
    ? window.LUTSNative.ads(action, arg) : Promise.reject(Error('No Play Games here')));
  playGames('games-sync', Object.keys(achieved).join(',')).catch(() => {});
  // Leaderboards (Play Games keeps each player's best): people lit up, longest streak, today's Daily Sky, best combo.
  function postScores(list) { playGames('games-score', list).catch(() => {}); }
  const joyScores = () => `bringers:${joys.length},streak:${bestStreak()}`;
  if (joys.length) postScores(joyScores());

  // ----- Festival Points: a running tally of the core play, kept on the device (no leaderboard of its own) -----
  // Play Games keeps each player's best score per board and span, so each board gets its own running total: today's
  // points (its daily list), this week's (weekly) and every point ever (all time). Days and weeks follow Pacific time,
  // as Play's daily and weekly lists do. Each source has a daily cap so nothing can be farmed.
  const FEST_KEY = 'luts:fest';
  const FEST_CAPS = { daily: 300, rival: 250, puzzle: 2000, puzzleDaily: 120, joy: 40, combo: 100 };
  let fest = null;
  function ptParts(t = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(t).map((x) => [x.type, x.value]));
    const day = `${p.year}-${p.month}-${p.day}`, dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    const sunday = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - Math.max(0, dow)));
    return { day, week: sunday.toISOString().slice(0, 10) };
  }
  function festState() {
    if (!fest) { try { fest = JSON.parse(localStorage.getItem(FEST_KEY) || 'null'); } catch (e) { fest = null; } }
    if (!fest || typeof fest !== 'object') fest = { day: '', d: 0, week: '', w: 0, all: 0, used: {}, combo: 0 };
    const { day, week } = ptParts();
    // gd / gw: people lit up today and this week, for the Top Gratitude boards
    if (fest.day !== day) Object.assign(fest, { day, d: 0, used: {}, combo: 0, gd: 0 });
    if (fest.week !== week) Object.assign(fest, { week, w: 0, gw: 0 });
    return fest;
  }
  function festPoints(source, n) {
    const f = festState(), room = (FEST_CAPS[source] ?? 0) - (f.used[source] || 0), add = Math.max(0, Math.min(Math.floor(n), room));
    if (!add) return 0;
    f.used[source] = (f.used[source] || 0) + add;
    f.d += add; f.w += add; f.all += add;
    try { localStorage.setItem(FEST_KEY, JSON.stringify(f)); } catch (e) { /* storage unavailable */ }
    return add;
  }
  // The best combo of the day: each step past today's best is worth 5 points.
  function festCombo(combo) {
    const f = festState();
    if (combo <= f.combo) return;
    const gained = (combo - Math.max(2, f.combo)) * 5;
    f.combo = combo;
    festPoints('combo', gained);
  }
  // Top Gratitude: each person lit up counts toward today's and this week's boards (all time is the Light Bringers total).
  function gratitudeLit() {
    const f = festState();
    f.gd = (f.gd || 0) + 1; f.gw = (f.gw || 0) + 1;
    try { localStorage.setItem(FEST_KEY, JSON.stringify(f)); } catch (e) { /* storage unavailable */ }
    postScores(`gratday:${f.gd},gratweek:${f.gw}`);
  }
  function achieve(id) {
    if (achieved[id]) return;
    achieved[id] = Date.now();
    try { localStorage.setItem('luts:ach', JSON.stringify(achieved)); } catch (e) { /* ignore */ }
    playGames('games-unlock', id).catch(() => {});
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
    for (const [id, , name, desc] of ACH) {
      const li = document.createElement('li');
      li.className = achieved[id] ? 'done' : '';
      // The painted medal (assets/menu/badges); the badge's name beside it says what it is
      const i = document.createElement('picture'); i.className = 'ach-icon ach-medal';
      i.innerHTML = `<source type="image/webp" srcset="assets/menu/badges/${id}.webp"><img src="assets/menu/badges/${id}.png" alt="" width="48" height="48" loading="lazy" decoding="async">`;
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
    $('#achCount').textContent = `${ACH.filter(([id]) => achieved[id]).length} of ${ACH.length} earned`;
  }
  renderAch();
  $('#setAchievements').addEventListener('click', () => openSheet($('#achModal')));
  $('#achBack').addEventListener('click', () => { closeSheet($('#achModal')); openDrawer(); });
  $('#achPlayGames').hidden = $('#achBoards').hidden = $('.ach-play-row').hidden = !ANDROID_WEBVIEW;
  $('#achBoards').addEventListener('click', () => {
    playGames('games-boards').then((ok) => { if (!ok) toast('Google Play Games is not available right now'); })
      .catch(() => toast('Google Play Games is not available right now'));
  });
  $('#achPlayGames').addEventListener('click', () => {
    playGames('games-show').then((ok) => { if (!ok) toast('Google Play Games is not available right now'); })
      .catch(() => toast('Google Play Games is not available right now'));
  });
  // Leaderboard: top players by game (Top Gratitude: people lit up; the Daily Sky, the Daily Diya, the Daily Rocket),
  // each today, this week and of all time, loaded from Play Games in the Android app. Top Gratitude has a board per
  // period (see gratitudeLit); the daily games have one board each, read in Play's daily, weekly and all-time spans. A
  // board not yet created in Play Console says it opens soon. On the web there is no shared board, so the sheet says
  // where to find it.
  const board = { cat: 'grat', span: 'week', data: {}, rank: 0 };
  const BOARD_SUB = {
    grat: 'The most people lit up with gratitude: today, this week and of all time.',
    daily: 'Top Daily Sky scores. Each player’s best day counts.',
    diya: 'Top Daily Diya scores: stars first, then speed.',
    rocket: 'Top Daily Rocket scores.',
  };
  const boardArg = (cat, span) => (cat === 'grat' ? `${{ day: 'gratday', week: 'gratweek', all: 'bringers' }[span]}:${span}` : `${cat}:${span}`);
  const MEDALS = ['🥇', '🥈', '🥉'];
  function boardRow(r) {
    const li = document.createElement('li');
    li.className = r.me ? 'me' : '';
    const rank = document.createElement('span'); rank.className = 'board-rank';
    rank.textContent = r.rank <= 3 ? MEDALS[r.rank - 1] : `#${r.rank}`;
    const name = document.createElement('span'); name.className = 'board-name';
    name.textContent = r.name || '—';
    if (r.me) { const you = document.createElement('small'); you.textContent = 'You'; name.append(you); }
    const score = document.createElement('b'); score.className = 'board-score'; score.textContent = fmt(r.score);
    li.append(rank, name, score);
    return li;
  }
  // Each board's own game: an empty board, and the footer, start it in one tap.
  const BOARD_GO = {
    grat: ['Light someone up', () => $('#btnJoy').click()],
    daily: ['Play today’s Daily Sky', () => showRushSheet('daily')],
    diya: ['Play Diya Path', () => $('#btnDiya').click()],
    rocket: ['Play Rocket Rush', () => $('#btnRocket').click()],
  };
  function boardGo() { const go = BOARD_GO[board.cat]; closeSheet($('#boardModal')); Sound.resume(); go[1](); }
  function boardMessage(text, retry, play) {
    $('#boardList').innerHTML = '';
    $('#boardState').hidden = false;
    $('#boardMsg').textContent = text;
    $('#boardRetry').hidden = !retry;
    $('#boardGo').hidden = true; // the footer has the same button
  }
  function renderBoard() {
    const { cat, span } = board, d = board.data[`${cat}:${span}`];
    document.querySelectorAll('.board-cat').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    document.querySelectorAll('.board-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.span === span)));
    $('#boardSub').textContent = BOARD_SUB[cat];
    $('#boardPlay').lastChild.textContent = BOARD_GO[cat][0];
    $('#boardGo').textContent = BOARD_GO[cat][0];
    $('#boardList').setAttribute('aria-labelledby', span === 'all' ? 'boardAll' : span === 'day' ? 'boardDay' : 'boardWeek');
    $('#boardMe').hidden = true;
    if (!ANDROID_WEBVIEW) { boardMessage('The leaderboard is in the Android app, with Google Play Games.', false); return; }
    if (d === undefined) return boardMessage('Loading the leaderboard…', false);
    if (d === 'unset') return boardMessage('This leaderboard opens soon.', false);
    if (d === 'error') return boardMessage('Couldn’t load the leaderboard. Check your connection and try again.', true);
    if (!d) return boardMessage('Sign in to Google Play Games to see who is winning.', true);
    const rows = Array.isArray(d.rows) ? d.rows : [];
    if (!rows.length) {
      if (cat === 'diya' || cat === 'rocket') return boardMessage('No scores yet. Solve today’s puzzle to be the first.', false, true);
      if (cat === 'grat') return boardMessage('No one lit up yet. Light someone up to be the first.', false, true);
      return boardMessage(span === 'week' ? 'No scores yet this week. Play today’s Daily Sky to be the first.' : span === 'day' ? 'No scores yet today. Play today’s Daily Sky to be the first.' : 'No scores yet. Play today’s Daily Sky to be the first.', false, true);
    }
    $('#boardState').hidden = true;
    $('#boardList').replaceChildren(...rows.map(boardRow));
    if (d.me && d.me.rank > 0 && !rows.some((r) => r.me)) {
      $('#boardMe').hidden = false;
      $('#boardMe').replaceChildren(boardRow({ ...d.me, me: true }));
    }
  }
  function syncBoardTile() {
    $('#tileBoard').textContent = board.rank ? `You’re #${board.rank} this week` : 'Who is winning the Daily Sky this week';
  }
  function loadBoard(force) {
    const { cat, span } = board, k = `${cat}:${span}`, have = board.data[k];
    if (!ANDROID_WEBVIEW || (!force && have !== undefined && have !== 'error' && have)) { renderBoard(); return; }
    board.data[k] = undefined;
    renderBoard();
    playGames('games-top', boardArg(cat, span)).then((d) => {
      board.data[k] = d === 'unset' ? 'unset' : d && typeof d === 'object' ? d : null;
      if (cat === 'daily' && span === 'week' && d && d.me && d.me.rank > 0) { board.rank = d.me.rank; syncBoardTile(); }
    }).catch(() => { board.data[k] = 'error'; }).then(() => { if (`${board.cat}:${board.span}` === k) renderBoard(); });
  }
  $('#btnBoard').addEventListener('click', () => { openSheet($('#boardModal')); loadBoard(); });
  // The home screen's Challenges row
  $('#btnChBoards').addEventListener('click', () => $('#btnBoard').click());
  $('#btnChRace').addEventListener('click', () => { Sound.resume(); if (window.PatakaChor) PatakaChor.raceFromHome(); });
  $('#btnChRocket').addEventListener('click', () => { Sound.resume(); if (window.RocketRush) RocketRush.open(true); });
  $('#btnChDiya').addEventListener('click', () => { Sound.resume(); if (window.DiyaPath) DiyaPath.open(true); });
  document.querySelectorAll('.board-cat').forEach((b) => b.addEventListener('click', () => {
    board.cat = b.dataset.cat; loadBoard();
    b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }));
  document.querySelectorAll('.board-tab').forEach((b) => b.addEventListener('click', () => { board.span = b.dataset.span; loadBoard(); }));
  $('#boardRetry').addEventListener('click', () => loadBoard(true));
  $('#boardPlay').addEventListener('click', boardGo);
  $('#boardGo').addEventListener('click', boardGo);

  // Rating, reviews and updates go through Google Play in the Android app, and to the Play page elsewhere.
  const PLAY_PAGE = 'https://play.google.com/store/apps/details?id=com.stalinpusparaj.lightuptheskies';
  const playStore = (action) => (window.LUTSNative && typeof window.LUTSNative.ads === 'function'
    ? window.LUTSNative.ads(action) : Promise.reject(Error('No store here')));
  const openPlayPage = () => playStore('store').catch(() => { window.open(PLAY_PAGE, '_blank', 'noopener'); });
  // Play's review sheet; when Play declines to show it (it allows about one a month), the flow ends at once and the
  // Play page opens instead, so the button always does something.
  $('#setRate').addEventListener('click', () => {
    const asked = Date.now();
    playStore('review').then((done) => { if (!done || Date.now() - asked < 1200) openPlayPage(); }).catch(openPlayPage);
  });
  // A newer build on Play: the home screen shows a card (hidden for a day after Later) and Settings keeps an Update row.
  // Update starts Google Play's own in-app update (download, install, restart), or opens the Play page.
  const startUpdate = () => playStore('update-start').then((ok) => { if (!ok) openPlayPage(); }).catch(openPlayPage);
  $('#setUpdate').addEventListener('click', startUpdate);
  $('#btnUpdateNow').addEventListener('click', startUpdate);
  $('#btnUpdateLater').addEventListener('click', () => {
    $('#updateCard').hidden = true;
    try { localStorage.setItem('luts:update-later', String(Date.now())); } catch (e) { /* storage unavailable */ }
  });
  setTimeout(() => playStore('update').then((available) => {
    $('#setUpdate').hidden = available !== true;
    let later = 0;
    try { later = +localStorage.getItem('luts:update-later') || 0; } catch (e) { /* storage unavailable */ }
    $('#updateCard').hidden = !(available === true && Date.now() - later > 24 * 60 * 60 * 1000);
  }).catch(() => {}), 3000);
  $('#setShareApp').addEventListener('click', () => shareThing({
    title: 'Light Up the Skies: Diwali',
    text: `Diwali fireworks over India’s landmarks. Come light up the sky with me! ${TAG}`,
    url: playLink('share'),
  }));

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
  // The AR safety warning, every time AR starts and before the camera opens: grown-ups nearby, mind your surroundings.
  function arSafety() {
    const box = $('#arSafety');
    return new Promise((resolve) => {
      const done = (ok) => { box.hidden = true; $('#btnArSafe').onclick = $('#btnArSafeCancel').onclick = null; resolve(ok); };
      $('#btnArSafe').onclick = () => done(true);
      $('#btnArSafeCancel').onclick = () => done(false);
      box.hidden = false;
      $('#btnArSafe').focus();
    });
  }
  const toggleAR = () => {
    if (launch.state !== 'READY') return;
    Sound.resume();
    if (roomAr) return stopRoomAr();
    if (arOn) return stopAR();
    if (!premium.active) { openPremium({ ar: true }); return; } // AR is Premium
    // With ARCore the crackers stand on the real floor (room AR); without it the camera AR opens instead, where they stay
    // put as you turn the phone.
    adBreak('ar').then(arSafety).then((ok) => {
      if (!ok || launch.state !== 'READY' || roomAr || arOn) return;
      if (roomArBridge && (roomArSupport === 'supported' || roomArSupport === 'install')) startRoomAr(); else startAR();
    });
  };

  // ---------- Remote switches (config.json on the web site) and one limit for every unprompted sheet ----------
  // So a prompt that annoys players in Diwali week can be turned down without a release. The game starts with the
  // built-in values, then the last copy fetched, and fetches a fresh copy for the next start; a failed fetch changes nothing.
  const CFG_KEY = 'luts:config', CFG_URL = 'https://stalinpusparaj.github.io/light-up-the-skies/config.json';
  const CFG_DEFAULTS = {
    premiumAfterShows: 3, premiumMax: 10, // the first automatic Premium sheet, and how many in all
    adGraceShows: 5, adEvery: 3, // no interstitial before show 6, then one every 3rd show
    notifyAsk: true,
    promptsPerSession: 1, promptsPerDay: 2, promptQuietSecs: 90,
  };
  function readConfig(raw) {
    const c = { ...CFG_DEFAULTS };
    if (raw && typeof raw === 'object') for (const k of Object.keys(CFG_DEFAULTS)) if (typeof raw[k] === typeof CFG_DEFAULTS[k]) c[k] = raw[k];
    return c;
  }
  let CFG = CFG_DEFAULTS;
  try { CFG = readConfig(JSON.parse(localStorage.getItem(CFG_KEY) || 'null')); } catch (e) { CFG = { ...CFG_DEFAULTS }; }
  {
    fetch(CFG_URL, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((raw) => {
      if (raw && typeof raw === 'object') { try { localStorage.setItem(CFG_KEY, JSON.stringify(raw)); } catch (e) { /* storage unavailable */ } }
    }).catch(() => { /* offline: keep what we have */ });
  }
  // Unprompted sheets (Premium after a show, the rating ask): one a session, two a day, none in the first 90 seconds.
  const PROMPT_KEY = 'luts:prompts', bootAt = Date.now();
  let promptsThisSession = 0;
  function mayPrompt() {
    if (Date.now() - bootAt < CFG.promptQuietSecs * 1000 || promptsThisSession >= CFG.promptsPerSession) return false;
    let st = {};
    try { st = JSON.parse(localStorage.getItem(PROMPT_KEY) || '{}') || {}; } catch (e) { st = {}; }
    return !(st.day === dayKey() && st.n >= CFG.promptsPerDay);
  }
  function countPrompt() {
    promptsThisSession++;
    let st = {};
    try { st = JSON.parse(localStorage.getItem(PROMPT_KEY) || '{}') || {}; } catch (e) { st = {}; }
    if (st.day !== dayKey()) st = { day: dayKey(), n: 0 };
    st.n++;
    try { localStorage.setItem(PROMPT_KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- Rating: Google Play's own review sheet (stars, then Submit or Not now) ----------
  // First asked after the app has been used on 2 days and 8 shows have ended, then at most every 30 days, right after a
  // show ends and never during a video, AR, a card or Lantern Rush. Play itself shows the sheet about once a month at most.
  const RATE_KEY = 'luts:rate', DAY = 24 * 60 * 60 * 1000;
  let ratePending = false, premiumShownThisSession = false; // a festival challenge just done: a good moment to ask
  function showEndedForRating() {
    let st = {};
    try { st = JSON.parse(localStorage.getItem(RATE_KEY) || '{}') || {}; } catch (e) { return; }
    const now = Date.now();
    st.first = st.first || now;
    st.shows = (st.shows || 0) + 1;
    // A day-2 return (or a finished festival challenge) after a few shows; never in the session Premium was shown.
    const due = st.shows >= 3 && (now - st.first >= DAY || ratePending) && now - (st.asked || 0) >= 30 * DAY && !premiumShownThisSession && mayPrompt();
    const calm = mode === 'play' && launch.state === 'READY' && !adOpen && !arOn && !roomAr && !rush.on && !document.hidden && nativeRecording === 'idle';
    const native = window.LUTSNative;
    if (due && calm && native && typeof native.ads === 'function') {
      st.asked = now; ratePending = false; countPrompt();
      native.ads('review').catch(() => { /* Play declined to show it: try again next month */ });
    }
    try { localStorage.setItem(RATE_KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ }
  }
  // A free player's happy moment, a show just ended: Premium, after the 3rd show ever (config.json), then at most every other day
  // (daily in Diwali week) on the 3rd show of a day, 10 times in all. Never over a video, a sheet or the rating ask.
  const PM_KEY = 'luts:pmoment';
  function showEndedForPremium() {
    if (premium.active || !nativeApp) return;
    let st = {};
    try { st = JSON.parse(localStorage.getItem(PM_KEY) || '{}') || {}; } catch (e) { return; }
    const now = Date.now(), today = dayKey();
    if (st.day !== today) { st.day = today; st.today = 0; }
    st.today = (st.today || 0) + 1; st.shows = (st.shows || 0) + 1;
    let rated = 0;
    try { rated = (JSON.parse(localStorage.getItem(RATE_KEY) || '{}') || {}).asked || 0; } catch (e) { /* ignore */ }
    const due = (st.n || 0) < CFG.premiumMax && (st.last ? now - st.last >= (festToday() ? DAY : 2 * DAY) - 36e5 && st.today >= 3 : st.shows >= CFG.premiumAfterShows) && mayPrompt();
    const calm = mode === 'play' && launch.state === 'READY' && !adOpen && !adShowing && now - adClosedAt > 20000 && now - rated > 60000 && nativeRecording === 'idle'
      && !arOn && !roomAr && !rush.on && !document.hidden && premiumPanel.hidden && sheets.every((s) => s.hidden);
    if (due && calm) { st.last = now; st.n = (st.n || 0) + 1; countPrompt(); premiumShownThisSession = true; openPremium({ moment: true, auto: true }); }
    try { localStorage.setItem(PM_KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- Video ads at natural breaks (free players only; Premium is ad-free) ----------
  // A short video every time AR opens, after every 3rd show, and at the other natural breaks (a Daily Sky or
  // challenge ends, a greeting card's show ends, a recording is saved, back to the home screen), but never within
  // 2 minutes of the last video.
  // A video that isn't loaded yet never holds up play: the native side answers false at once.
  const AD_GAP = 2 * 60 * 1000;
  let adLaunches = 0, adShownAt = 0, adOpen = false;
  // While a video loads or plays (the native side reports both), and for a while after, the game shares the phone's
  // memory and GPU with the ad's page: a slow or frozen frame then is the ad's doing, so the rules that send a weak
  // phone's 3D to rest (crawl, stall, lost GPU) let it be, and 3D eases back in for a moment after a video closes.
  const AD_SETTLE = 8000, AD_REST = 2000;
  let adActive = false, adShowing = false, adQuietAt = 0, adClosedAt = 0;
  function adBusy() { return adOpen || adActive || Date.now() - adQuietAt < AD_SETTLE; }
  window.addEventListener('luts:ads', (e) => {
    const d = e.detail || {}, active = !!(d.loading || d.showing);
    if (adActive && !active) adQuietAt = Date.now();
    if (adShowing && !d.showing) adClosedAt = Date.now();
    adActive = active; adShowing = !!d.showing;
    if (!$('#giftModal').hidden) renderGift(); // a reward video just loaded (or was used): Double it follows
    if (!$('#gemModal').hidden) renderGemSheet();
  });
  // A new player's first shows are ad-free: interstitials start after show 6 (a count kept across visits).
  const AD_SHOWS_KEY = 'luts:adshows';
  const showsEver = () => { try { return +localStorage.getItem(AD_SHOWS_KEY) || 0; } catch (e) { return 0; } };
  async function adBreak(placement) {
    const native = window.LUTSNative;
    if (placement === 'launch') { try { localStorage.setItem(AD_SHOWS_KEY, String(showsEver() + 1)); } catch (e) { /* storage unavailable */ } }
    if (placement !== 'ar' && showsEver() <= CFG.adGraceShows) return false;
    if (premium.active || adOpen || !native || typeof native.ads !== 'function' || !(native.lastAds && native.lastAds.available)) return false;
    // Never while the screen records (it would end up in the shared video, over the closing card); the video's own
    // break comes once it is saved.
    if (nativeRecording === 'recording' || nativeRecording === 'requesting') return false;
    if (placement === 'launch' && (++adLaunches < CFG.adEvery || Date.now() - adShownAt < AD_GAP)) return false;
    if (placement === 'break' && Date.now() - adShownAt < AD_GAP) return false;
    adOpen = true;
    let shown = false;
    try { shown = (await Promise.race([native.ads('interstitial', placement), new Promise((r) => setTimeout(() => r(false), 90000))])) === true; }
    catch (e) { shown = false; }
    adOpen = false;
    if (shown) { adQuietAt = adClosedAt = adShownAt = Date.now(); adLaunches = 0; Sound.resume(); if (++adsThisVisit === 3) premiumNudge(); }
    return shown;
  }
  // After the third video of a visit: a small card above the banner for a few seconds (never a pop-up).
  let adsThisVisit = 0, premiumNudgeTimer = 0;
  function premiumNudge() {
    const n = $('#premiumNudge');
    if (!n || premium.active) return;
    n.hidden = false;
    clearTimeout(premiumNudgeTimer);
    premiumNudgeTimer = setTimeout(() => { n.hidden = true; }, 9000);
  }

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
    if (d.support) { roomArSupport = d.support; $('#btnAR').classList.toggle('ar-ready', d.support === 'supported' || d.support === 'install'); } // no ARCore: the camera AR
    if (d.state === 'running') enterRoomAr();
    else if (d.state === 'installing') toast('Installing Google Play Services for AR…', 4000);
    else if (d.state) leaveRoomAr(d.state);
    if (d.placed) { arSpot = { id: d.placed, x: 0, y: 0, s: 1, seen: false }; buzz(12); el.hint.classList.add('gone'); }
    if (d.miss) toast('Move your phone slowly over the floor until the ring appears, then tap it', 3000);
  });
  if (roomArBridge) { document.documentElement.classList.add('room-ar-bridge'); window.LUTSAndroid.arcore('check', ''); } // room AR once ARCore is known to work here (see .ar-ready), else the camera AR
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
  $('#btnFlip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startAR(); });

  // ---------- Worlds of India: background manager ----------
  // Landmark scenes are painted into the #sky canvas, so the fireworks canvas stays in front of them and photos and
  // videos (composite) include them automatically. Nothing here touches bursts, level, achievements or sound.
  const WORLD_DIR = 'assets/worlds/';
  const WORLD_KEY = 'luts:world';
  const MIN_SKY = 0.3; // open sky kept above the roofline, as a fraction of the screen height
  let worldStripH = 0, worldGroundCache = 0;
  // Where the landmark stands: just above the bottom controls (and, on wide screens, the Choose Your World strip, whose
  // space is kept in every play mode, so switching between Sky, Ground and Sparkler never moves the scene).
  function worldGround(portrait) {
    const fallback = H * (portrait ? 0.8 : 0.86), tabs = $('#modeTabs');
    if (document.body.classList.contains('ui-hidden')) return fallback;
    // Ground mode: the landmark stands at the far edge of the street, so the paving never covers it.
    if (mode === 'play' && playMode === 'ground' && !arOn && tabs.offsetParent) return clamp(floorTop() + 6, H * 0.35, fallback);
    if (!tabs.offsetParent) return worldGroundCache || fallback; // tabs hidden during a card show
    const strip = $('#worldStrip');
    if (strip.offsetHeight) worldStripH = strip.offsetHeight + 8;
    // Wide screens let the strip overlap the reflection a little, so the landmark keeps its size.
    // Phones name the world on the top bar (no strip at the bottom), so nothing is kept for it there.
    const noStrip = window.matchMedia && (matchMedia('(max-height: 560px)').matches || matchMedia('(max-width: 760px)').matches);
    const reserve = noStrip ? 0 : worldStripH * (portrait ? 1 : 0.5);
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
    world.waterY = 0;
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
    // A landscape screen (a TV, a tablet on its side): the whole picture stands from the top of the screen down to the
    // ground line, so nothing of the landmark is cut off and no band of empty night sits above it; the blurred copy
    // fills the sides.
    const fill = !portrait;
    const s = fill ? Math.min(ground / ih, W / iw) : Math.min(sWide, sTall, sSky);
    const dw = iw * s, dh = ih * s;
    // (filled, its bottom sits on the ground line, so its own street shows above the controls as the ground)
    const dx = fill ? (W - dw) / 2 : (W - dw) * fx, dy = fill ? ground - dh : (ground - dh) * fy;
    const sides = dw < W - 1, top = dy > 1, key = `${sides}|${top}`;
    if (world.maskKey !== key) { world.masked = featherImage(img, sides, top); world.maskKey = key; }
    g.drawImage(world.masked, dx, dy, dw, dh);
    // Below the landmark, a dimmed mirror image reads as water or a wet street under the controls.
    const base = dy + dh;
    if (base < H - 0.5) {
      world.waterY = base; // burst lights mirror here (drawLights)
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
    world.rect = { dx, dy, dw, dh, roof, fill };
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
    const p = world.preset && world.cfg.preset;
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
    const fades = arOn || reduceMotion() || w3dWanted() ? [] : [snapshotLayer(skyC), snapshotLayer(moonC), snapshotLayer(cityC)];
    world.id = cfg.id; world.cfg = cfg; world.img = img;
    world.blur = world.masked = null; world.maskKey = ''; world.waterY = 0;
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
      if (SCENES_3D[cfg.id]) b.dataset.has3d = '';
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
      if (SCENES_3D[cfg.id]) b.dataset.has3d = '';
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
    $('#sceneName').textContent = cfg.image || cfg.live ? cfg.name : 'Night Sky';
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
    worldPresetInput.checked = world.preset;
    $('#worldPresetNote').textContent = !cfg.preset ? 'Pick a landmark to use its colours'
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
    worldReturnFocus = from && !from.closest('#settings') ? from : $('#btnWorldStrip');
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
    terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', // iOS: Apple's standard licence
    termsAndroid: 'https://stalinpusparaj.github.io/light-up-the-skies/terms.html',
    privacy: 'https://stalinpusparaj.github.io/light-up-the-skies/privacy.html',
    manage: { android: 'https://play.google.com/store/account/subscriptions?package=com.stalinpusparaj.lightuptheskies', ios: 'https://apps.apple.com/account/subscriptions' },
  };
  const PLAN_NAMES = { annual: 'Yearly', monthly: 'Monthly', lifetime: 'Lifetime', other: 'Premium' };
  const premiumPanel = $('#premiumPanel'), premiumPlans = $('#premiumPlans');
  const nativeApp = window.LUTSNative;
  const storeAccount = () => (nativeApp && nativeApp.platform === 'ios' ? 'Apple ID' : 'Google Play account');
  const trialWords = (t) => { const [n, unit] = t.split('-'); return `${n} ${unit}${n === '1' ? '' : 's'}`; };
  const selectedPlan = () => premium.plans.find((p) => p.kind === premium.pick) || premium.plans[0] || null;
  let premiumReturnFocus = null;

  function renderPremiumHero() {
    // The landmark the player was reaching for, or else the crown over the palace (assets/premium/hero)
    const it = premium.intent || {}, id = it.world, cfg = id && WORLD_BY_ID[id];
    // A cracker reached for (a free try, its locked chip): the Hazaar ladi going off; gems or a show they loved: the
    // palace finale (both made in Google Flow for this sheet).
    const want = it.tried || it.sivakasi;
    const src = cfg ? `${WORLD_DIR}bg/${cfg.image}` : want ? (String(want).startsWith('shell:') ? 'assets/premium/hero-finale' : 'assets/premium/hero-hazaar')
      : it.gems || it.moment || it.diwali ? 'assets/premium/hero-finale' : 'assets/premium/hero';
    $('#premiumHero').innerHTML = `<picture><source type="image/webp" srcset="${src}.webp"><img src="${src}.jpg" alt="" decoding="async"></picture>`;
  }

  function fineprint(p) {
    if (p.kind === 'lifetime') return `One payment of ${p.price}, charged to your ${storeAccount()} when you confirm. Not a subscription: nothing renews, and Premium is yours to keep. Restore it on a new phone with the same account.`;
    const per = p.kind === 'annual' ? 'year' : p.kind === 'monthly' ? 'month' : '';
    const price = per ? `${p.price}/${per}` : p.price;
    const start = p.trial ? `Free for ${trialWords(p.trial)}, then ${price}. You won’t be charged until the trial ends.`
      : p.intro ? `${p.intro} for your ${p.introFor}, then ${price}, charged to your ${storeAccount()} when you confirm.`
        : `${price}, charged to your ${storeAccount()} when you confirm.`;
    return `${start} Renews automatically until cancelled. Cancel anytime in your ${storeAccount()} settings, at least 24 hours before the renewal date.`;
  }

  function renderPaywall() {
    if (premiumPanel.hidden) return;
    const web = premium.status === 'web', busy = ['loading', 'purchasing', 'restoring'].includes(premium.status);
    const intent = premium.intent || {}, intentWorld = intent.world && WORLD_BY_ID[intent.world];
    // Android TV shows no ads (AdMob doesn't serve TV apps), so its sheet never offers to remove them.
    const tv = document.documentElement.classList.contains('tv');
    // The headline speaks to what the player reached for; the rest of the sheet lists everything Premium adds.
    const tried = intent.tried && crackerName(intent.tried); // the Premium cracker or shell the player just lit for free
    const wanted = intent.sivakasi && crackerName(intent.sivakasi); // the one whose chip they tapped with no light left
    let pitch = tried ? [`You just lit ${tried}`, 'Keep it, and every other cracker, free with Premium. No ads, and 1,000 levels each in Diya Path and Rocket Rush.']
      : intent.diwali || (intent.moment && festToday()) ? ['Celebrate Diwali with Premium', 'No ads, every cracker free and 1,000 levels each in Diya Path and Rocket Rush, all through the festival.']
      : intent.moment ? ['Loved that show?', 'Premium makes every cracker free and removes every ad. Every puzzle level and unlimited hints too.']
      : intent.hints ? ['Unlimited hints with Premium', 'Never get stuck in Diya Path or Rocket Rush. Plus no ads and every cracker free.']
      : intent.levels ? ['Unlock 1,000 levels each in Diya Path and Rocket Rush', 'Every chapter of Diya Path and Rocket Rush, open now. Plus no ads and every cracker free.']
        : intent.ar ? ['Fireworks in your room with AR', 'Point your camera and light crackers on your own floor and sky. Plus no ads and every cracker free.']
        : intent.view3d ? ['India’s landmarks in 3D', 'Walk the forecourt of all 15 landmarks in 3D and look around as the fireworks burst. Plus no ads and every cracker free.']
        : intent.reasons ? ['Ten reasons on every card', 'Premium cards hold up to 10 reasons they turn through after the show. Plus no ads and every cracker free.']
        : intent.scenes ? ['Sacred backgrounds for Diya Path', 'Play before Lakshmi, Ganesha, Balaji, the Golden Temple and more. Plus no ads and every cracker free.']
        : intent.styles ? ['Golden diyas and royal boards', 'Premium dresses Diya Path in gold, with palace, river ghat and temple boards. Plus no ads and every cracker free.']
        : intent.archive ? ['Play every past daily puzzle', 'Missed a day? Premium opens every past Daily Diya and Daily Rocket. Plus no ads and every cracker free.']
          : wanted ? [`Light the ${wanted} with Premium`, intent.sivakasi.startsWith('shell:') ? 'Peacock, butterfly and magic wand shells, lit with your sparkler. Plus no ads and every cracker free.'
            : 'Hazaar ladi, saravedi, seven shot, double shot and Lakshmi vedi, lit with your sparkler. Plus no ads and every cracker free.']
          : intent.gems ? ['Every cracker free with Premium', 'Finales, cakes and rocket combos with no gems, plus no ads and unlimited puzzle hints.']
            : intentWorld || intent.ads ? ['Celebrate with no ads', 'No banners or videos, every cracker free, and unlimited puzzle hints.']
              : ['No ads · every cracker free with Premium', 'Grand finales, 3D skylines, AR, and 1,000 levels each in Diya Path and Rocket Rush with unlimited hints.'];
    if (tv) pitch = ['Every cracker. Every level.', 'Premium makes every cracker free and opens 1,000 levels each in Diya Path and Rocket Rush with unlimited hints.'];
    $('#premiumTitle').textContent = pitch[0];
    $('#premiumSub').textContent = pitch[1];
    renderValue(intent, tv, web);
    document.querySelectorAll('#premiumPanel .premium-store').forEach((n) => { n.textContent = storeAccount(); });
    $('#premiumGet').hidden = !web;
    for (const node of [premiumPlans, $('#btnPremiumBuy'), $('#premiumTrust'), $('#premiumFine'), $('#btnPremiumRestore')]) node.hidden = web;
    $('#premiumPlay').href = PREMIUM_LINKS.play;
    $('#premiumAppStore').hidden = !PREMIUM_LINKS.appStore;
    if (PREMIUM_LINKS.appStore) $('#premiumAppStore').href = PREMIUM_LINKS.appStore;
    $('#premiumTerms').href = nativeApp && nativeApp.platform === 'android' ? PREMIUM_LINKS.termsAndroid : PREMIUM_LINKS.terms;
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
      price.textContent = p.kind === 'annual' ? `${p.price} / year` : p.kind === 'monthly' ? `${p.price} / month` : p.kind === 'lifetime' ? `${p.price} once` : p.price;
      const sub = document.createElement('small');
      // The store price stays the biggest number; an offer always says what it renews at.
      sub.textContent = [p.trial ? `${p.trial} free trial` : '',
        p.intro ? `Diwali offer: ${p.intro} for your ${p.introFor}, then ${p.price}/${p.kind === 'annual' ? 'year' : 'month'}. Renews automatically. Cancel any time in ${nativeApp && nativeApp.platform === 'ios' ? 'the App Store' : 'Google Play'}.` : '',
        p.perMonth && !p.intro ? `about ${p.perMonth} a month` : '', p.kind === 'lifetime' ? 'Pay once, keep forever' : ''].filter(Boolean).join(' · ');
      if (p.intro) b.classList.add('has-offer');
      b.append(name, price, sub);
      b.addEventListener('click', () => { premium.pick = p.kind; renderPaywall(); });
      premiumPlans.append(b);
    }
    // The store answered but sent no plans (Play not signed in, or the app not installed from Play): say so, offer a retry.
    const noPlans = !premium.plans.length && premium.status !== 'loading' && premium.status !== 'purchasing' && premium.status !== 'restoring';
    const cta = $('#btnPremiumBuy'), unavailable = premium.status === 'unavailable' || noPlans;
    if (noPlans && !premium.message) $('#premiumStatus').textContent = 'Couldn’t load the plans from the store. Check you’re signed in and online, then try again.';
    cta.disabled = busy || (!chosen && !unavailable);
    cta.classList.toggle('busy', premium.status === 'purchasing' || premium.status === 'restoring');
    cta.textContent = unavailable ? 'Try again' : premium.status === 'loading' ? 'Loading plans…'
      : !chosen ? 'Continue' : chosen.trial ? `Start ${chosen.trial} free trial`
        : chosen.intro ? `Get Premium · ${chosen.intro} for your ${chosen.introFor}`
        : chosen.kind === 'lifetime' ? `Get Premium forever · ${chosen.price}`
          : `Get Premium · ${chosen.kind === 'annual' ? `${chosen.price}/year` : chosen.kind === 'monthly' ? `${chosen.price}/month` : chosen.price}`;
    $('#premiumFine').textContent = chosen ? fineprint(chosen) : '';
    $('#btnPremiumRestore').disabled = busy;
    // Risk reversal, right under the button.
    const trust = $('#premiumTrust');
    trust.innerHTML = '';
    const lines = chosen && chosen.trial
      ? [`Nothing to pay today · ${trialWords(chosen.trial)} free`, 'Cancel before the trial ends and you pay nothing', `Cancel anytime in your ${storeAccount()}`]
      : chosen && chosen.kind === 'lifetime' ? ['One payment, no subscription', 'Every future update included', 'Restore on a new phone with the same account']
        : [`Cancel anytime in your ${storeAccount()}`, 'No ads while you’re Premium', 'Restore on a new phone with the same account'];
    for (const text of lines.filter((t) => !(tv && /ads/i.test(t)))) { const li = document.createElement('li'); li.textContent = text; trust.append(li); }
  }
  // ----- The offer as a value stack (Alex Hormozi, $100M Offers) -----
  // Value = dream outcome × how sure it is ÷ (time to it × effort). So, in that order: what Premium gives, each with what
  // it costs a free player (the game's own gem prices, never an invented price), the total in gems, and in rupees at
  // the best per-gem rate of the packs the store sent (so it never inflates); then proof from the player's own play,
  // honest urgency (only the real Diwali date), and the safety net (Play's own refund window). A cracker the player
  // just tried leads the stack.
  function renderValue(intent, tv, web) {
    const sum = ITEM_ORDER.reduce((n, t) => n + (GEM_COST[t] || 0), 0) + DOCK_ORDER.reduce((n, t) => n + (SHELL_GEM_COST[t] || 0), 0);
    const gem = (n) => `💎\u2060${n.toLocaleString('en-IN')}`; // the word joiner keeps 💎 with its number
    const month = (GEM_COST.finale + GEM_COST.cake) * 30; // the anchor: a grand finale and a wedding cake each evening
    const rows = [
      { id: 'premium5', ico: '🧨', b: 'Five Premium crackers', s: 'The thousand-cracker Hazaar ladi, saravedi, seven shot, double shot and Lakshmi vedi. One free try each.' },
      { id: 'premiumSky', ico: '🦚', b: 'Three Premium sky shells', s: 'Peacock, butterfly and magic wand bursts. One free try each.' },
      { id: 'crackers', ico: '🎆', b: 'Every cracker, free, every night', s: `Grand finales, wedding cakes, sutli bombs and more. One of each costs ${gem(sum)} without Premium.` },
      { id: 'ads', ico: '🚫', b: 'No ads', s: 'No banners, and no videos between shows and levels.', tv: false },
      { id: 'levels', ico: '🧩', b: '1,000 levels each, all open', s: `Diya Path and Rocket Rush: 300 more levels each, every chapter now, and unlimited hints (${gem(PUZZLE_HINT_GEMS)} each without Premium).` },
      { id: 'worlds', ico: '🏛️', b: 'India in 3D, and in your room', s: tv ? 'All 15 landmarks in 3D, and the sacred Diya Path backgrounds.' : 'All 15 landmarks in 3D, AR fireworks, and the sacred Diya Path backgrounds.' },
      { id: 'streak', ico: '🔥', b: 'A safer streak', s: 'Miss a day twice a week and keep your streak and its bigger gifts.' },
    ].filter((r) => !(tv && r.tv === false));
    // The Premium crackers lead; after a free try (or a tap on a locked chip), the row it is in leads, lit up.
    const want = intent && (intent.tried || intent.sivakasi), lead = want ? (String(want).startsWith('shell:') ? 'premiumSky' : 'premium5') : '';
    rows.sort((a, b) => (b.id === lead) - (a.id === lead));
    const list = $('#premiumStack');
    list.innerHTML = '';
    for (const r of rows) {
      const li = document.createElement('li');
      li.classList.toggle('tried-first', r.id === lead);
      const i = document.createElement('span'); i.className = 'premium-vico'; i.textContent = r.ico; i.setAttribute('aria-hidden', 'true');
      const b = document.createElement('b'); b.textContent = r.b;
      const small = document.createElement('small'); small.textContent = r.s;
      li.append(i, b, small);
      list.append(li);
    }
    // The total: in gems always; in rupees only from real store prices (the cheapest per gem), never the web's guesses.
    const packs = !web && gemStore.packs.filter((k) => k.gems > 0 && k.price);
    const per = packs && packs.length ? packs.map((k) => [moneyOf(k.price), k.gems]).filter(([m]) => m).map(([m, g]) => ({ rate: m.n / g, sym: m.sym })).sort((a, b) => a.rate - b.rate)[0] : null;
    $('#premiumTotal').textContent = per
      ? `A grand finale and a wedding cake every evening for a month: ${gem(month)} (about ${per.sym}${Math.round(per.rate * month).toLocaleString('en-IN')} at gem-pack prices). With Premium they’re free, with everything above.`
      : `A grand finale and a wedding cake every evening for a month: ${gem(month)}. With Premium they’re free, with everything above.`;
    // Proof from their own play: how many kinds they have already lit.
    const proof = $('#premiumProof');
    proof.hidden = tried.size < 3;
    if (!proof.hidden) proof.textContent = `You’ve lit ${tried.size} kinds of crackers so far. With Premium, all ${ITEM_ORDER.length} are free.`;
    // Honest urgency: only the real date of Diwali this year (or that it is Diwali week now).
    const soon = $('#premiumSoon'), dw = festDays(), diwali = dw.find((d) => d.name === 'Diwali');
    const days = diwali ? Math.round((new Date(`${diwali.key}T00:00`) - new Date(`${dayKey()}T00:00`)) / 864e5) : -1;
    soon.hidden = !(festToday() || (days > 0 && days <= 21));
    soon.textContent = festToday() ? 'It’s Diwali week. Light the whole street.' : days === 1 ? 'Diwali is tomorrow. Light the whole street.' : `Diwali is in ${days} days. Light the whole street.`;
    // The safety net: Google Play's own refund window (Android app only).
    $('#premiumRefund').hidden = !(nativeApp && nativeApp.platform === 'android') || tv;
  }
  // "₹29.00" or "Rs. 29" or "$0.99": the number and the symbol in front of it.
  function moneyOf(price) {
    const m = String(price).replace(/,/g, '').match(/^([^\d.]*)\s*([\d.]+)/);
    return m && +m[2] > 0 ? { sym: m[1].trim() || '', n: +m[2] } : null;
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
    // A view for RevenueCat's paywall charts, named by why it opened.
    if (nativeApp && nativeApp.platform === 'android') nativeApp.premium('paywall', Object.keys(intent || {}).find((k) => intent[k]) || 'menu');
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
    const tv = document.documentElement.classList.contains('tv'); // no ads on TV to remove
    $('#premiumRowNote').textContent = tv ? (on ? 'Active · every cracker free' : 'Free crackers, every puzzle level')
      : on ? 'Active · no ads, every cracker free' : 'No ads, free crackers, every puzzle level';
    document.body.classList.toggle('premium', on); // hides the gem prices on crackers
    $('#btnPremiumRow').hidden = on;
    manage.hidden = !on || !nativeApp;
    if (on && nativeApp) manage.href = premium.manageUrl || PREMIUM_LINKS.manage[nativeApp.platform] || PREMIUM_LINKS.manage.android;
  }

  // Subscription started or ended: apply what the player was trying to unlock, or step back to the free tier.
  function premiumChanged(was) {
    window.dispatchEvent(new CustomEvent('luts:premium-changed', { detail: { active: premium.active } })); // the puzzles re-open their locks
    document.body.classList.toggle('premium', premium.active);
    if ($('#premiumNudge')) $('#premiumNudge').hidden = true;
    renderGemSheet();
    if (!premium.active && itemLocked(settings.item)) { // lapsed: the Sivakasi Premium crackers leave the street
      settings.item = 'flowerpot'; saveSettings(); syncModeUi();
      for (let i = groundItems.length - 1; i >= 0; i--) if (!groundItems[i].armed && !groundItems[i].shellId && itemLocked(groundItems[i].type)) groundItems.splice(i, 1);
    }
    if (!premium.active) { // and the Premium sky shells: their unlit tubes go, and the chosen one becomes Random
      for (let i = groundItems.length - 1; i >= 0; i--) { const t = groundItems[i]; if (t.shellId && t.skyFuse == null && !t.done && itemLocked(shellKey(t.shellId))) groundItems.splice(i, 1); }
      if (itemLocked(shellKey(settings.shell))) { settings.shell = 'random'; saveSettings(); syncSettingsUi(); syncLaunchUi(); }
      if (playMode === 'sky' && !groundItems.some((t) => t.launcher)) placeSkyLauncher();
    }
    if (premium.intent && premium.intent.view3d && premium.active) { settings.scene3d = true; saveSettings(); } // bought for 3D: show it
    if (typeof syncViewToggle === 'function') { syncViewToggle(); syncWorld3d(); }
    $('#btnAR').classList.toggle('locked', !premium.active);
    if (premium.active) {
      const it = premium.intent;
      if (it && it.world) selectWorld(it.world, { silent: true }); // the welcome message speaks for it
      if (it && it.colours) { world.preset = true; saveWorld(); }
      const got = it && (it.sivakasi || it.tried); // bought for a Premium cracker or shell: it is picked
      if (got && got.startsWith('shell:') && TYPES[got.slice(6)]) { settings.shell = got.slice(6); saveSettings(); syncSettingsUi(); syncLaunchUi(); placeSkyLauncher(); }
      else if (got && ITEMS[got]) { settings.item = got; saveSettings(); syncModeUi(); }
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
        // The Indus Appstore build sells nothing yet (AppStore.kt); everything free still plays.
        : s.message === 'store-unsupported' ? 'Premium isn’t sold in this version of the app yet. Everything free still plays.'
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
      const tv = document.documentElement.classList.contains('tv');
      toast(s.event === 'purchased' ? (tv ? 'Welcome to Premium ✨ Every cracker free, every level open' : 'Welcome to Premium ✨ No ads, every cracker free, every level open')
        : tv ? 'Premium restored ✨ Every cracker free, every level open' : 'Premium restored ✨ No ads, every cracker free, every level open', 3200);
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
    reviewerAdsOff();
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
  // The store's Premium turns the app's ads off by itself; a reviewer's Premium tells the app here. (Older apps answer
  // an unknown action harmlessly.)
  function reviewerAdsOff() {
    if (window.LUTSNative && window.LUTSNative.ads) window.LUTSNative.ads('reviewer').catch(() => { /* ads stay as they were */ });
  }
  if (reviewerAccess) reviewerAdsOff();
  if (window.LUTSNative && window.LUTSNative.version) { $('#appVersion').textContent = `Version ${window.LUTSNative.version}`; $('#appVersion').hidden = false; }
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
  // Fire follows these into the sky as one shell. The cake, the rocket combo and the Grand finale are not here: Fire runs
  // the whole cracker from the street (it used to fly one shell for a Grand finale's 25 gems).
  const AERIAL_ITEMS = new Set(['rocket', 'shell']);
  // How long a cracker may burn in a Fire or Burst all show: 7 s, or its whole run for one made to run long (def.full).
  const showDur = (it) => (ITEMS[it.type].full ? it.dur : Math.min(it.dur, 7));
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const safeSound = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* Sound is optional. */ } };
  function selection() {
    if (playMode === 'spark') return { id: 'spark:writing', label: 'Sparkler', writing: true };
    if (playMode === 'ground') return { id: `item:${settings.item}`, label: ITEMS[settings.item].label, type: settings.item, ground: !AERIAL_ITEMS.has(settings.item) };
    return { id: shellKey(settings.shell), label: shellLabel(settings.shell), type: settings.shell };
  }
  function syncLaunchUi() {
    // A show that ran to the end (not one that was blocked while igniting) is a happy moment to ask for a rating.
    if (launch.state === 'READY' && lastLaunchState !== 'READY' && lastLaunchState !== 'IGNITING') {
      // A show has ended: the natural break for the video (every 3rd show), not the moment Fire is pressed, so the
      // fireworks start at once and a weak phone isn't loading a video as the show begins.
      if (triedNow) afterTry(); // a free try's show ends on Premium alone
      else {
        if (mode === 'play') setTimeout(() => { if (launch.state === 'READY') adBreak('launch'); }, 600);
        setTimeout(showEndedForRating, 1500);
        setTimeout(showEndedForPremium, 4000);
      }
    }
    lastLaunchState = launch.state;
    const busy = launch.state !== 'READY', fire = $('#btnFire');
    document.body.classList.toggle('launch-active', busy);
    document.body.dataset.launchState = launch.state;
    const labels = { READY: '', IGNITING: 'Igniting…', ASCENDING: 'Flying…', BURSTING: 'Enjoy the burst', FADING: 'Enjoy the sparks', RETURNING: 'Returning…' };
    $('#launchStatus').textContent = labels[launch.state];
    syncRewardsUi();
    if (!fire || !$('#groundList').children.length) return;
    const s = selection();
    const usedSelection = launch.used(s.id), points = launch.balance().points, paid = burstEntitled();
    document.body.classList.toggle('paid', paid); // paid: no points row, no "Earn launches"
    const cost = gemCost(s);
    fire.textContent = busy ? labels[launch.state] : fireAll() ? fireAllLabel() : `Fire ${s.label}${cost ? ` · 💎${cost}` : usedSelection && !paid && points >= 50 ? ' · 50 pts' : ''}`;
    fire.disabled = busy || rewardBusy || sweepBusy();
    fire.hidden = playMode === 'spark' || (sparklerFires() && !chor.on); // Pataka Chor keeps Fire beside the sparkler
    // Pataka Chor lights only what you found and put down: say how many are ready, not the shop's chosen cracker.
    if (chor.on && !busy) { const n = waitingItems().length; fire.textContent = n ? `Fire · ${n}` : 'Find a cracker'; fire.classList.toggle('chor-idle', !n); }
    for (const b of document.querySelectorAll('#shellList button, #groundList button')) {
      const id = b.dataset.shell ? `shell:${b.dataset.shell}` : `item:${b.dataset.item}`;
      let status = b.querySelector('.trial-status');
      if (!status) { status = document.createElement('small'); status.className = 'trial-status'; b.append(status); }
      const used = launch.used(id);
      // Paid: no launch counts under the crackers (every cracker fires as often as you like).
      status.hidden = paid;
      status.textContent = paid ? '' : used ? points >= 50 ? 'Replay · 50 pts' : 'Free launch used' : '1 free launch';
      b.classList.toggle('trial-used', used && !paid);
      b.setAttribute('aria-pressed', String(id === s.id));
      b.classList.toggle('active', id === s.id);
      b.disabled = busy;
    }
    for (const b of document.querySelectorAll('#modeTabs button, #viewToggle button, #sparkFloat button, #sparkColors button, #settings input, #settings select, #setReset, #btnSparkBurst, #btnClearStreet, #btnFlip')) b.disabled = busy;
    if (!model3d()) $('#viewToggle [data-view="3d"]').disabled = true; // a night-sky world is 2D only
    syncDrawingAction();
    syncBurstAll();
  }
  // Ground with two or more crackers waiting: Fire lights them all in one show, as one sweep of the sparkler does on a
  // phone (a TV remote or a mouse has only Fire, and a launch clears the street, so the rest would be lost).
  // (Declared, not const: syncLaunchUi runs while the game boots, before this line.)
  function fireAll() { return mode === 'play' && playMode === 'ground' && !rush.on && !roomAr && waitingItems().length >= 2; }
  function allSelection() { return { id: 'item:all', label: 'Burst all', type: settings.item, ground: true, multi: true }; }
  function fireAllLabel() {
    const cost = gemCost(allSelection());
    return `Fire all ${Math.min(burstMax(), waitingItems().length)}${cost ? ` · 💎${cost}` : ''}`;
  }
  function requestFire() {
    if (mode !== 'play' || rush.on || paused || document.hidden || rewardBusy || launch.state !== 'READY') return;
    // Pataka Chor: Fire lights the crackers waiting on the street (and riding the donkey) where they are, as the
    // sparkler does: found crackers, so no gems and no launch, and a cracker on the move keeps moving.
    if (chor.on) {
      const waiting = waitingItems();
      if (!waiting.length) { toast('Find a cracker first, then put it down'); return; }
      for (const it of waiting) { lightItem(it); it.swept = true; }
      festLaunched(waiting.map((it) => it.type));
      return;
    }
    if (sweepBusy()) return; // what the sparkler lit is still going: Fire would clear it and fire it again
    const s = fireAll() ? allSelection() : selection();
    if (s.writing && !strokes.length) { toast('Write something first, then light it up'); return; }
    if (roomAr && !s.writing && !s.ground && !(arSpot && arSpot.seen)) { toast(arSpot ? 'Point your phone at your cracker spot' : 'Tap the floor to place your cracker first'); return; }
    return launchWithGems(s);
  }
  function prepareLaunch(s) {
    if (!W || !H || !ctx || !gctx) throw Error('Renderer not ready');
    const type = s.id.startsWith('shell:') ? playerType(s.type) : ({ rocket: 'peony', rocketcombo: 'kaleido', shell: 'chrysanthemum', cake: 'kaleido', finale: 'kamuro', lantern: 'willow' }[s.type] || s.type);
    const size = Math.min(1.9, Math.min(W * 0.43, H * 0.27) / (R0() * 1.16));
    const seq = { ...s, burstType: type, size, age: 0, since: 0, burst: false, x: W * 0.5, y: Math.min(H * 0.72, groundBottom() - 18), sx: W * 0.5, sy: Math.min(H * 0.72, groundBottom() - 18), c: color(), emission: 0, smokeAt: 0 };
    if (!s.ground && !s.writing && !TYPES[type]) throw Error('Unknown cracker');
    if (s.ground && !ITEMS[s.type]) throw Error('Unknown ground cracker');
    if (s.multi) {
      seq.batch = waitingItems().slice(0, burstMax()).map((it) => ({ type: it.type, x: it.x, y: it.y }));
      if (seq.batch.length < 2) throw Error('Nothing to burst');
    }
    const placed = !s.multi && s.id.startsWith('item:') && groundItems.find(it => !it.armed && it.type === s.type);
    if (placed) seq.placed = { x: placed.x, y: placed.y };
    const tube = s.id.startsWith('shell:') && groundItems.find((it) => it.launcher);
    if (tube) { seq.placed = { x: tube.x, y: tube.y }; seq.launcher = true; seq.tube = tube; }
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
    if (w3dShown()) w3d.cue('launch'); // an animated scene can answer (the manor's evening turns to night)
    pointer = null; if (pen) penUp();
    if (seq.multi) {
      // One launch, every cracker: lit in a quick left-to-right cascade so the street erupts rather than going off at once.
      seq.items = seq.batch.sort((a, b) => a.x - b.x).map((p, i) => {
        const it = placeItem(p.type, p.x, p.y);
        it.dur = showDur(it); it.armed = true; it.t = -i * 0.22;
        if (!tried.has(it.type)) tried.add(it.type);
        return it;
      });
      try { localStorage.setItem('luts:tried', JSON.stringify([...tried])); } catch (e) { /* ignore */ }
      if (window.LUTSGoals) LUTSGoals.tick('launch'); achieve('first');
    } else if (seq.launcher) {
      // A sky shell leaves from its tube on the ground: the very tube that was waiting, just where it stood.
      seq.item = seq.tube;
      groundItems.push(seq.item);
      [seq.sx, seq.sy] = tipPos(seq.item); seq.x = seq.sx; seq.y = seq.sy;
    } else if (seq.id.startsWith('item:')) {
      seq.item = placeItem(seq.type, ...(seq.placed ? [seq.placed.x, seq.placed.y] : streetSpot(0.5, 0.8)));
      seq.item.dur = showDur(seq.item);
      if (seq.ground) armItem(seq.item);
      else { [seq.sx, seq.sy] = tipPos(seq.item); seq.x = seq.sx; seq.y = seq.sy; }
    }
    safeSound(() => Sound.resume());
    safeSound(() => Sound.hiss(0.55, 4800, 0.055, 0));
    if (w3dShown()) startleFolk(seq);
    buzz(15);
  }
  function clearScene() {
    safeSound(() => Sound.hush()); // strings of snaps (saravedi, walas) stop with their crackers
    shells.length = 0;
    while (stars.length) release(starPool, stars.pop());
    while (sparks.length) release(sparkPool, sparks.pop());
    while (smokes.length) release(smokePool, smokes.pop());
    confettis.length = 0; groundItems.length = 0; hazes.length = 0;
    timers.length = 0; directorUntil = 0; portrait = null; shake = shakeX = shakeY = 0;
    for (const g of [ctx, glx, gctx, ictx, flightCtx]) g.clearRect(0, 0, W, H);
    fxLights.length = glowQ.length = 0;
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
    // Cancelled before its Premium cracker caught (left mid-fuse, a show ended early): the free try comes back. A sky
    // shell's try is spent once its shell has burst (every launch ends here, a finished one too).
    const seq = launch.sequence;
    const caught = seq && triedNow && (triedNow.startsWith('shell:') ? seq.id !== triedNow || seq.burst
      : (seq.items || [seq.item]).some((it) => it && it.type === triedNow && it.lit));
    if (seq && triedNow && !caught) {
      if (triedVideo) tries.vfor = triedNow; else delete tries.used[triedNow];
      triedNow = null; saveTries(); syncTries();
    }
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
    for (const c of [skyC, moonC, cityC, floorC, itemsC, paintC, gfxC, fxC, glowC, atmoC]) { c.style.transform = ''; c.style.opacity = ''; }
    flightCtx.clearRect(0, 0, W, H);
    if (w3d) w3d.setTilt(0);
    view.key = '';
  }
  // A show is stopped after 19 s in case something hangs; a long cracker in it (a Hazaar ladi) gets its whole run first.
  function showLimit(s) {
    const its = s.items || (s.item ? [s.item] : []);
    return Math.max(19, s.age + Math.max(0, directorUntil - gameTime) + 6, // a directed show runs as long as it is scheduled
      ...its.map((it) => ITEMS[it.type].fuse + it.dur + (ITEMS[it.type].keep ?? 0.7) + 6)); // + the cascade and the fade
  }
  function updateLaunch(dt) {
    const s = launch.sequence;
    if (!s) return;
    s.age += dt; s.since += dt;
    const change = (state) => { s.since = 0; launch.setState(state); };
    if (s.age > showLimit(s) + (s.hold || 0)) { abortLaunch(); toast('Launch ended. You can choose another cracker.'); return; }
    // A recorded sparkler drawing (Share or Record) is first written again, start to end, by a moving sparkler: the
    // video shows the signature being made, then it lights.
    if (launch.state === 'IGNITING' && s.writing && s.trace === undefined) s.trace = (shotShare || (rec && !rec.quiet) || nativeRecording === 'recording') && strokes.length > 1 ? startTrace() : null;
    if (s.trace && !s.trace.done) traceStep(s.trace, dt);
    if (launch.state === 'IGNITING' && s.since >= 0.6 && (!s.trace || s.trace.done)) {
      if (s.ground || s.writing) {
        if (s.writing) lightUpWriting();
        change('BURSTING');
      } else {
        // In 3D the spent tube stays on the ground while the camera looks up after its rocket (the flat worlds slide
        // the street away instead); it is cleared when the next tube is set down.
        if (s.launcher && s.item && w3dShown()) s.item.launcher = false;
        else groundItems.length = 0;
        change('ASCENDING'); safeSound(() => Sound.lift(0, 2.9, true));
      }
    }
    if (launch.state === 'ASCENDING') {
      // 3D: the trail rises out of the tube, wherever the tilting camera puts it on screen.
      if (s.launcher && s.item && groundItems.includes(s.item)) [s.sx, s.sy] = tipPos(s.item);
      const t = clamp(s.since / 3, 0, 1), p = 1 - (1 - t) ** 1.65;
      s.x = s.sx + Math.sin(t * Math.PI) * W * 0.065;
      // Bursts at a fifth of the way down, or lower if its top ring would reach under the status bar.
      s.y = s.sy + (Math.min(H * 0.4, Math.max(H * 0.20, safeTop() + R0() * s.size + 8 * U)) - s.sy) * p;
      const reveal = ease((t - 0.72) / 0.28);
      const still = reduceMotion() || roomAr;
      camera.travel = still ? 0 : ease(t);
      camera.y = still ? 0 : H * 0.12 * ease(t);
      camera.x = still ? 0 : -W * 0.02 * Math.sin(t * Math.PI);
      camera.zoom = still ? 1 : 1 + 0.16 * Math.sin(t * Math.PI) - 0.06 * reveal;
      s.emission += dt * 24;
      while (s.emission >= 1) { s.emission--; spark(s.x, s.y, rand(-9, 9), rand(30, 80), '#ffd27a', 0.24); }
      if (t >= 1 && !s.burst) {
        s.burst = true;
        burstShell({ x: s.x, y: s.y, type: s.burstType, size: s.size, z: 1, c1: s.c, user: true, an: anchorAt(s.x, s.y, 170) });
        buzz(25); change('BURSTING');
      }
    }
    if (launch.state === 'BURSTING') {
      if (s.multi) {
        if (s.items.every((it) => it.done || (it.lit && it.t >= it.dur))) change('FADING');
      } else if (s.ground) {
        const it = s.item;
        if (it && (it.done || (it.lit && it.t >= it.dur))) change('FADING'); // not during its fuse (the Sutli's stalls)
      } else if (s.since >= 0.65) change('FADING');
    }
    if (launch.state === 'FADING' && !stars.length && !sparks.length && !smokes.length && !confettis.length && !shells.length && s.since >= 0.8 && gameTime >= directorUntil) {
      s.returnFrom = { ...camera };
      // Sky crackers end on Happy Diwali; the camera holds until it has faded, then glides back down.
      if (!s.ground && !s.writing && mode === 'play' && !rush.on) s.hold = showDiwaliReveal();
      // 8-bit destination-out stalls at 1-2/255 and leaves a ghost of the show: wipe it now the sky is empty.
      ctx.clearRect(0, 0, W, H);
      if (!groundItems.length && !pen) gctx.clearRect(0, 0, W, H);
      // A three-star show (Burst all with three or more, or a cake, rocket combo or finale): the 3D forecourt's old man claps.
      if (w3dShown() && (s.multi ? s.items.length >= 3 : ['cake', 'rocketcombo', 'finale'].includes(s.type))) w3d.cheer();
      change('RETURNING');
    }
    if (launch.state === 'RETURNING') {
      const p = 1 - ease(Math.max(0, s.since - (s.hold || 0)) / 1.15), from = s.returnFrom;
      camera.x = from.x * p; camera.y = from.y * p; camera.zoom = 1 + (from.zoom - 1) * p; camera.travel = from.travel * p;
      if (!p && !s.completing) {
        // Launches are unlimited now (gems pay for the big crackers), so the old launch points are kept quietly.
        launch.complete().then(() => { if (launch.sequence === s) abortLaunch(); })
          .catch(() => { if (launch.sequence === s) abortLaunch(); });
        return;
      }
    }
    if (s.ground && launch.state !== 'RETURNING') {
      camera.zoom = (reduceMotion() || roomAr || w3dShown() || W > H) ? 1 : 1 + 0.045 * ease(s.age); // a 3D world has its own camera
      camera.travel = camera.y = camera.x = 0;
    }
  }
  function applyLaunchCamera() {
    const s = launch.sequence; if (!s) return;
    const tf = (x, y, zoom) => `translate3d(${(x + arPan.x).toFixed(2)}px,${(y + arPan.y).toFixed(2)}px,0) scale(${zoom.toFixed(4)})`;
    const front = tf(camera.x, camera.y, camera.zoom);
    fxC.style.transform = front;
    for (const c of [floorC, itemsC, paintC, gfxC]) c.style.transform = s.ground || s.writing ? front : tf(camera.x, camera.travel * H * 0.64, 1);
    skyC.style.transform = s.ground ? front : tf(camera.x * 0.35, camera.travel * H * 0.42, 1.02);
    moonC.style.transform = s.ground ? front : tf(camera.x * 0.1, camera.travel * H * 0.035, 1); // drifts with the distant stars
    cityC.style.transform = s.ground ? front : tf(camera.x * 0.5, camera.travel * H * 0.64, 1);
    if (s.ground && fit.z !== 1) { // a Sivakasi burst too high or wide: the street pulls back inside the camera's push-in
      const x = camera.x + arPan.x, y = camera.y + arPan.y;
      fxC.style.transform = layerTf(x, y, camera.zoom, fit.z);
      for (const c of [itemsC, paintC, gfxC]) c.style.transform = fxC.style.transform;
      floorC.style.transform = floorTf(x, y, camera.zoom);
    }
    atmoC.style.opacity = '0';
  }
  function drawLaunch() {
    const s = launch.sequence;
    flightCtx.clearRect(0, 0, W, H);
    if (!s) return;
    // In AR the camera feed is the sky, so the painted flight sky and clouds would show as a dark band from the top.
    if (!s.ground && !s.writing && cloudSprite && !arOn && !w3dShown()) {
      const g = flightCtx;
      // Extend the sky exposed above the descending landmark; distant stars move slowly.
      if (camera.travel > 0) {
        g.save(); g.beginPath(); g.rect(0, 0, W, camera.travel * H * 0.42 + 3 + H * 0.08); g.clip();
        {
          // The night carries on above the descending picture: deep blue at the top deepening into the colour of the
          // picture's top edge, then the stars over it (added, so their black ground vanishes) and a few that twinkle.
          // An animated world (a live sky) carries on in its own colour at its top edge, starry as far as its hour is
          // (none by day); it used to be one flat fill with a hard edge, black at night.
          const r0 = world.rect, top = camera.travel * H * 0.42 + 3, live = liveShown();
          let c = live ? liveSky.skyTopRgb : '20,22,58';
          const starry = live ? clamp(liveSky.stars, 0, 1) : 1;
          if (!live && world.blur && r0 && !document.body.classList.contains('home')) {
            const bh = world.blur.height, row = clamp(Math.floor((-r0.dy / r0.dh) * bh), 0, bh - 1);
            const b = world.blur.getContext('2d').getImageData(0, row, world.blur.width, 1).data;
            let r = 0, gg = 0, bl = 0; const n = b.length / 4;
            for (let i = 0; i < b.length; i += 4) { r += b[i]; gg += b[i + 1]; bl += b[i + 2]; }
            c = `${(r / n) | 0},${(gg / n) | 0},${(bl / n) | 0}`;
          }
          const sky = g.createLinearGradient(0, 0, 0, top);
          if (live) { // its own top colour, deepening upward into night as far as its hour is night
            const [r, gg, b] = c.split(',').map(Number), k = 0.85 - 0.25 * starry;
            sky.addColorStop(0, `rgb(${Math.round(r * k + 7 * starry * (1 - k))},${Math.round(gg * k + 8 * starry * (1 - k))},${Math.round(b * k + 34 * starry * (1 - k))})`);
          } else {
            sky.addColorStop(0, '#070822');
            sky.addColorStop(0.55, '#141640');
          }
          sky.addColorStop(1, `rgb(${c})`);
          g.fillStyle = sky; g.fillRect(0, 0, W, top);
          g.save(); g.beginPath(); g.rect(0, 0, W, top); g.clip();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = starry; // a live sky by day has none
          g.drawImage(flightStars, 0, camera.travel * H * 0.035 - H * 0.04, W, H * 1.05);
          const tw = performance.now() / 1000, rs = mulberry(311);
          for (let i = 0; i < 70; i++) {
            const x = rs() * W, y = rs() * H * 0.7 + camera.travel * H * 0.035, rad = 0.6 + rs() * 1.4, ph = rs() * TAU, sp = 1.2 + rs() * 2.4;
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tw * sp + ph));
            g.fillStyle = `rgba(255,246,228,${(a * 0.9).toFixed(3)})`;
            g.beginPath(); g.arc(x, y, rad * U * 1.6, 0, TAU); g.fill();
            if (rad > 1.6) { g.fillStyle = `rgba(255,236,200,${(a * 0.18).toFixed(3)})`; g.beginPath(); g.arc(x, y, rad * U * 5, 0, TAU); g.fill(); }
          }
          g.restore();
          // a soft seam: the night fades down over the picture's top edge
          const seam = g.createLinearGradient(0, top, 0, top + H * 0.08);
          seam.addColorStop(0, `rgba(${c},0.95)`);
          seam.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = seam; g.fillRect(0, top, W, H * 0.08);
        }
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
    // Only a thin core line goes on the fading #fx; the soft orange line and smoke stacked up there into a column.
    // The glowing head is drawn fresh on #glow.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const y = s.y, x = s.x, ascent = launch.state === 'ASCENDING';
    ctx.strokeStyle = '#ffe9b0'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, 2 * U); ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + (ascent ? 30 : 4) * U); ctx.stroke();
    ctx.restore();
    glx.globalCompositeOperation = 'lighter';
    glx.globalAlpha = 0.5; SPR.draw(glx, SPR.id('#ff9a3c'), SPR.SOFT, x, y, 26 * UV());
    glx.globalAlpha = 1; SPR.draw(glx, SPR.id('#ffe9b0'), SPR.HEAD, x, y, 11 * UV());
    glx.globalCompositeOperation = 'source-over';
    glowUsed = true;
  }
  $('#btnFire').addEventListener('click', requestFire);
  $('#btnTrialAnother').addEventListener('click', () => { $('#crackerTrial').hidden = true; $('#btnFire').focus(); });
  $('#btnTrialPremium').addEventListener('click', () => { $('#crackerTrial').hidden = true; openPremium({ cracker: selection().id }); });
  window.addEventListener('storage', (e) => { if (e.key === 'luts:cracker-trials:v1') syncLaunchUi(); });

  // ---------- Points, verified reward receipts and invitations ----------
  function rewardsProvider() { return window.LUTSRewardProvider || null; }
  // A reward video can be offered: on a phone that preloads (5 GB+), only once one has loaded.
  function videoOk(p) {
    const st = window.LUTSNative && window.LUTSNative.lastAds;
    return !!(p && p.watchAd && p.verifyReceipt && p.adsAvailable !== false) && !(st && st.rewardReady === false && st.lowRam === false);
  }
  const videoMiss = (error) => (window.LUTSNative && window.LUTSNative.lastAds && window.LUTSNative.lastAds.lowRam
    ? 'No video right now. Come back tonight to double it.' : (error && error.message) || 'No video is available. Try again later.');
  function syncRewardsUi() {
    const balance = launch.balance(), provider = rewardsProvider();
    const ads = videoOk(provider);
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
      else if (!(await shareThing({ title: 'Light Up the Skies', text: 'Come celebrate with me. Choose a cracker and light up the sky!', url,
        blob: shareCard({ art: 'assets/menu/welcome.jpg', kicker: 'You’re invited', title: 'Light up the sky', line: 'Fireworks for every celebration, free to play' }), name: 'light-up-the-skies.png', src: 'invite' }))) throw Object.assign(Error('cancelled'), { name: 'AbortError' });
      $('#rewardStatus').textContent = provider && provider.fetchRewards ? 'Invite ready. Rewards arrive when a new friend joins.' : 'Invite ready. Invite rewards are not available yet.';
    } catch (error) {
      if (popup) popup.close();
      if (error.name !== 'AbortError') $('#rewardStatus').textContent = error.message || 'Could not create an invite.';
    } finally { rewardBusy = false; syncLaunchUi(); }
  }
  $('#btnRewards').addEventListener('click', () => openGems());
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

  // ---------- The 3D background ----------
  // world3d.js draws the scene with Three.js; the fireworks and crackers stay the game's own 2D effects, pinned to
  // points in the scene. Crackers stand on the ground in front of you (pinItem); bursts are pinned far out along their
  // path (anchorAt). When the camera turns or steps, followAnchors moves everything with it. With the flat (2D)
  // background none of this runs: everything here is behind w3dShown().
  // Builds the open world's scene; one at a time. syncWorld3d asks again if the world changed meanwhile.
  function loadWorld3d(model) {
    if (w3dLoading || w3dPending) return;
    if (w3d) { w3d.dispose(); w3d = null; freshW3dCanvas(); }
    const tier = wantedTier(), quality = settings.quality;
    w3dLoading = import('./world3d.js').then((m) => {
      if (!w3dWanted() || model3d() !== model) return null;
      return m.create({ canvas: w3dCanvas, scene: model, tier, onLost: (api) => world3dLost(null, api), onFolk: folkSound });
    }).then((api) => {
      w3dLoading = null;
      if (!api) return;
      if (!w3dWanted() || model3d() !== model) { api.dispose(); freshW3dCanvas(); return; } // moved on while it built
      w3dTier = tier; w3dQuality = quality;
      if (launch.state !== 'READY') { w3dPending = api; return; } // never swap the background mid-show
      w3d = api;
      w3dVersion = -1;
      syncWorld3d(); // on screen now, even while the game is paused
    }).catch((error) => {
      // Once is enough: stay on the flat background (it works in every mode) and say so once.
      w3dLoading = null;
      console.error('3D world failed', error);
      freshW3dCanvas(); // the failed build may have used up this canvas's context
      give3dUp('3D isn’t available on this device, so the 2D background stays.', true);
    });
  }
  // A WebGL context can't be revived once freed, so each scene gets a new canvas.
  function freshW3dCanvas() {
    const c = document.createElement('canvas');
    c.id = 'world3d'; c.setAttribute('aria-hidden', 'true'); c.hidden = true;
    w3dCanvas.replaceWith(c); w3dCanvas = c;
  }
  // 3D off, with the switch back on 2D: nothing else changes (the flat background works in every mode). Saved only when
  // the phone can't do 3D at all; after GPU trouble it is off for this session, and tapping 3D tries again.
  function give3dUp(message, save = false) {
    w3dFailed = true;
    if (save) { settings.scene3d = false; saveSettings(); }
    syncViewToggle();
    // Pataka Chor is 3D only: rather than wait on "loading" for ever (every button dead), it ends and you're home.
    if (chor.on && window.PatakaChor) {
      try { window.PatakaChor.stop(); } catch (e) { /* already ending */ }
      if (mode !== 'intro') $('#btnHome').click();
      toast('The street needs a rest. Open it again in a moment', 3600);
      return;
    }
    toast(message, 3600);
  }
  // A lost GPU context (or an error drawing the scene): the game carries on over the flat background and the scene is
  // built again on a new canvas; two losses within a minute and 3D rests for the session.
  function world3dLost(error, api = w3d) {
    if (error) console.error('3D world failed', error);
    if (api && api === w3dPending) { try { w3dPending.dispose(); } catch (e) { /* already gone */ } w3dPending = null; freshW3dCanvas(); }
    else if (api && api !== w3d) return; // an old scene, already let go
    else { if (w3d) { try { w3d.dispose(); } catch (e) { /* already gone */ } } w3d = null; freshW3dCanvas(); }
    const now = performance.now();
    w3dLosses = w3dLosses.filter((t) => now - t < 60000).concat(now);
    if (w3dLosses.length >= 2 && !adBusy()) give3dUp('3D paused: this device needs a rest. The 2D background stays for now.');
    syncWorld3d();
  }
  function sizeWorld3d() {
    if (!w3d) return;
    // The horizon sits a band above the controls: enough forecourt for the crackers, the rest is landmark and sky.
    // While a show plays on a weak phone (lite3d) the scene renders at about half the pixels.
    // Pataka Chor is about the street, not the sky: its horizon sits higher, so the street fills half the screen.
    w3d.resize(W, H, DPR * (measuredTier ? 1 : 0.85) * (lite3d ? 0.6 : 1), chor.on ? 0.46 : (groundBottom() - H * 0.16) / H);
    if (w3dShown()) renderWorld3d();
  }
  // Sky mode: the chosen shell stands on the ground in its tube, ready for Fire or the sparkler (not in Lantern Rush or room AR, which places its own).
  function placeSkyLauncher() {
    if (mode !== 'play' || playMode !== 'sky' || rush.on || roomAr || launch.state !== 'READY') return;
    clearStreet();
    // at the bottom of the ground, nearest you (in 3D, on the forecourt in view)
    const tube = w3dShown() ? placeInView3d('shell', 0.5, 1) : placeItem('shell', W * 0.5, groundBottom() - 4);
    if (!tube) return; // (the 3D view not ready to place it yet: the next ready state does)
    tube.launcher = true; tube.shellId = settings.shell;
    // On the flat picture the bottom of the ground is the controls' edge: the tube stands lower still, just above
    // the world chip, in front of the hint, nearest you.
    const chip = $('#worldStrip').getBoundingClientRect(), bar = $('.bottom-ui').getBoundingClientRect();
    if (!w3dShown() && chip.height) standAt(tube, Math.max(tube.y, chip.top - 6));
    // A phone without the strip: its base just clear of the mode tabs, a little nearer than the street's usual edge.
    else if (!w3dShown() && W <= H && bar.height && !document.body.classList.contains('ui-hidden')) standAt(tube, Math.max(tube.y, bar.top - 3));
    // A wide screen without the strip whose picture doesn't fill it: the tube stands beside the picture, not in front of
    // it. (A landscape screen's picture fills the screen, so there the tube stays centred above the controls.)
    else if (!w3dShown() && world.rect && W > H && !world.rect.fill && world.rect.dw < W - 1) {
      const r = world.rect, room = 70 * U, right = r.dx + r.dw + room;
      tube.x = right < W - room ? right : Math.max(room, r.dx - room);
    }
  }
  // Stands a flat-picture cracker at y, below the ground's usual edge (placeItem keeps crackers above it).
  function standAt(it, y) {
    it.y = y; it.s = itemScale(y); it.z = itemDepth(y);
    sortItems();
  }
  function syncWorld3d() {
    const want = w3dWanted(), model = want ? model3d() : '', ready = launch.state === 'READY';
    // A tube is always waiting in Sky mode: after a launch, on starting, on returning from a card show.
    if (ready && mode === 'play' && playMode === 'sky' && !rush.on && !roomAr && !groundItems.some((it) => it.launcher)) placeSkyLauncher();
    if (w3dPending && ready) {
      if (want && w3dPending.id === model) { w3d = w3dPending; w3dVersion = -1; } else { w3dPending.dispose(); freshW3dCanvas(); }
      w3dPending = null;
    }
    // A changed Detail setting, or a slower phone than the scene was built for: rebuild it, between shows.
    if (w3d && ready && (settings.quality !== w3dQuality || Math.min(measuredTier, w3dTier) < w3dTier)) { w3d.dispose(); w3d = null; freshW3dCanvas(); }
    if (want && (!w3d || w3d.id !== model)) loadWorld3d(model);
    if (!want) {
      if (w3d) { w3d.dispose(); w3d = null; freshW3dCanvas(); } // leaving 3D frees the engine's memory
      if (w3dPending && ready) { w3dPending.dispose(); w3dPending = null; freshW3dCanvas(); }
    }
    const on = w3dReady(), key = on ? model : '';
    if (w3dFlatWorld !== !model3d()) { w3dFlatWorld = !model3d(); syncViewToggle(); } // the switch follows the world
    if (key === w3dKey) return;
    const was = w3dKey;
    w3dKey = key;
    document.body.classList.toggle('world3d', on);
    w3dCanvas.hidden = !on;
    if (on) { sizeWorld3d(); w3dVersion = -1; w3dCanvas.dataset.scene = model; } else { w3dMoved = false; drawSky(); drawCity(); } // the flat layers, as they should look now
    if (liveSky) (liveShown() && !document.hidden ? liveSky.start() : liveSky.stop()); // the festival sky rests behind 3D
    if (mode !== 'play') return;
    el.hint.textContent = hintFor(playMode);
    if (ready && playMode === 'sky' && (on || was)) placeSkyLauncher(); // the tube moves to the new ground
    // Crackers waiting on the street move to the new ground (the flat street, or this scene's), keeping their places.
    if (ready && playMode === 'ground' && (on || was)) {
      const all = waitingItems(), keep = all.slice(0, burstMax()).map((it) => [it.type, it.fx ?? 0.5, it.fy ?? 0.58]);
      if (all.length > keep.length) toast(`${keep.length} crackers fit on this ground; the rest were put away`);
      clearStreet();
      if (keep.length) for (const [type, fx, fy] of keep) placeItem(type, ...streetSpot(fx, fy));
      else placeSelectedCracker();
      syncLaunchUi();
    }
  }
  function stepWorld3d(dt) {
    const s = launch.sequence;
    try {
      // A sky cracker's flight looks up after it, as the flat worlds slide the city down.
      w3d.setTilt(s && !s.ground && !s.writing && !reduceMotion() ? camera.travel : 0); // weak phones too: a show there is lite3d
      w3d.setMaxPitch(playMode === 'ground' ? 0.1 : 0.42); // in Ground mode you can't look so far up that the crackers go
      w3d.setFolk(playMode === 'ground', launch.state !== 'READY', groundItems); // the dog and the old man: Ground only, round its crackers
      if (chor.on && window.PatakaChor) window.PatakaChor.walk(dt); // Pataka Chor's step, in this frame, before it eases and draws
      w3dMoved = w3d.update(dt) || w3d.version !== w3dVersion; // (a step on foot moves the camera without easing: it counts)
      if (chor.on && window.PatakaChor) window.PatakaChor.place(); // its labels, from this frame's camera
    } catch (error) { world3dLost(error); return; }
    if (w3d.version !== w3dVersion) { w3dVersion = w3d.version; followAnchors(); }
    if (tubeCheck && !w3dMoved && !look3d) { tubeCheck = false; keepTubeInView(); }
  }
  function renderWorld3d() { try { if (w3d.render()) w3dDrawn = frameNo; } catch (error) { world3dLost(error); } }
  // Low-end phones (an Android WebView with 4 GB or less, or one running at the lowest detail): the scene's slow changes
  // (a burst's tint fading, the dog and the old man) are drawn at most four times a second, so the GPU keeps up with the
  // fireworks on top; during a show (lite3d, a lower-resolution scene) about fifteen, so the camera follows the rocket up
  // smoothly. Dragging to look around still draws every frame.
  const lowEnd3d = () => ANDROID_WEBVIEW && ((navigator.deviceMemory || 4) <= 4 || measuredTier === 0 || settings.quality === 'low');
  let w3dLastRender = 0, w3dStalls = [], w3dHiddenAt = -1;
  document.addEventListener('visibilitychange', () => { if (document.hidden) w3dHiddenAt = performance.now(); });
  function w3dRenderDue() {
    const now = performance.now();
    if (lowEnd3d() && !w3dMoved && now - w3dLastRender < (lite3d ? 66 : 250)) return false;
    if (lowEnd3d() && Date.now() - adClosedAt < AD_REST && now - w3dLastRender < 250) return false; // just back from a video
    w3dLastRender = now;
    return true;
  }
  // Photos and videos: the scene is drawn fresh, since WebGL doesn't keep its last frame around.
  // Photos and videos: WebGL keeps no picture after a frame is shown, so outside the frame loop the scene is drawn fresh;
  // inside it (recording), a scene already drawn this frame is copied as it is.
  function drawWorld3d(g, w, h, inFrame) { if (w3d.render(!inFrame || w3dDrawn !== frameNo)) w3dDrawn = frameNo; g.drawImage(w3dCanvas, 0, 0, w, h); }

  // The forecourt's dog and old man (world3d-folk.js). A cracker or shell lit sends the dog running and the old man's hands
  // to his ears; their noises come through the game's sound, quieter farther off.
  function startleFolk(seq) {
    const lit = (seq.items || (seq.item ? [seq.item] : [])).filter((it) => it.an);
    if (!lit.length) { w3d.startle(null, 1, 'sky'); return; }
    const x = lit.reduce((a, it) => a + it.an.wx, 0) / lit.length, z = lit.reduce((a, it) => a + it.an.wz, 0) / lit.length;
    w3d.startle({ x, y: 0, z }, seq.multi ? 1.4 : 1, seq.ground || seq.multi ? 'ground' : 'tube');
  }
  function folkSound(name, p, dist) {
    if (!Sound[name]) return;
    Sound.dist = clamp(1.3 - dist / 45, 0.35, 1);
    try { Sound[name](p); } finally { Sound.dist = 1; }
  }
  function anchorAt(sx, sy, dist) {
    if (!w3dShown()) return null;
    const p = w3d.unproject(sx, sy, dist);
    return { wx: p.x, wy: p.y, wz: p.z, ax: sx, ay: sy, d: dist, f: 0 };
  }
  const distTo = (x, y, z) => { const c = w3d.camera(); return Math.hypot(x - c.x, y - c.y, z - c.z); };
  // Crackers are drawn about a metre tall at their distance (larger than life, so they read on a phone), and dimmer
  // and quieter farther away (as itemDepth does).
  const itemSize3d = (d) => clamp((1.05 * w3d.ppm(d)) / (39 * U), 0.35, 1.75); // no larger than the nearest on the flat street
  const depth3d = (d) => clamp(1 - (d - 12) / 30, 0, 1);
  function itemScale3d(x, y) { const g = w3d.ground(x, y); return itemSize3d(distTo(g.x, 0, g.z)); }
  // Stands a cracker on the forecourt where it was dropped.
  function pinItem(it, world) {
    const g = world || w3d.ground(it.x, it.y), p = w3d.project(g.x, 0, g.z);
    it.an = { wx: g.x, wy: 0, wz: g.z, ax: p ? p[0] : it.x, ay: p ? p[1] : it.y, d: p ? p[2] : distTo(g.x, 0, g.z), f: 0 };
    if (p) { it.x = p[0]; it.y = p[1]; }
    it.s = itemSize3d(it.an.d); it.z = depth3d(it.an.d);
  }
  // A tap or drop on the forecourt, as a screen point; taps on the sky pick a spot. Spots hidden under the controls
  // are moved farther out until they show.
  function groundPoint3d(x, y) {
    const g = w3d.ground(x, y), z = w3d.zone;
    if (!g.hit) { g.x = rand(z.x0, z.x1) * 0.8; g.z = rand(z.z0, z.z1); }
    let p = w3d.project(g.x, 0, g.z);
    for (let i = 0; i < 30 && p && p[1] > groundBottom() - 8 && g.z > z.z0; i++) { g.z = Math.max(z.z0, g.z - 1); p = w3d.project(g.x, 0, g.z); }
    return p ? [p[0], p[1]] : [W * 0.5, groundBottom() - 30];
  }

  const anchorOut = [];
  let anchorFrame = 0;
  function followAnchors() {
    const f = ++anchorFrame;
    const move = (a) => {
      if (a.f === f) return;
      a.f = f; a.ox = a.ax; a.oy = a.ay; a.k = 1;
      const p = w3d.project(a.wx, a.wy, a.wz, anchorOut);
      a.off = !p;
      if (!p) return; // behind the camera for now: leave it be
      a.k = clamp(a.d / p[2], 0.5, 2); a.ax = p[0]; a.ay = p[1]; a.d = p[2];
    };
    for (const it of groundItems) {
      const a = it.an;
      if (!a) continue;
      move(a);
      it.x += a.ax - a.ox; it.y += a.ay - a.oy;
      it.s = itemSize3d(a.d); it.z = depth3d(a.d);
    }
    // While a launch looks up after its rocket, sky effects keep their place on screen, as in the flat worlds.
    const hold = launch.state === 'ASCENDING' || launch.state === 'RETURNING';
    for (const list of [stars, sparks, smokes, confettis, shells, fxLights]) {
      for (const p of list) {
        const a = p.an;
        if (!a) continue;
        move(a);
        if (hold) continue;
        const k = a.k;
        p.x = a.ax + (p.x - a.ox) * k; p.y = a.ay + (p.y - a.oy) * k;
        if (p.px !== undefined) { p.px = a.ax + (p.px - a.ox) * k; p.py = a.ay + (p.py - a.oy) * k; }
        if (p.floorY) p.floorY = a.ay + (p.floorY - a.oy) * k;
        if (p.tail) for (let j = 0; j < p.hn * 2; j += 2) { p.hx[j] = a.ax + (p.hx[j] - a.ox) * k; p.hx[j + 1] = a.ay + (p.hx[j + 1] - a.oy) * k; }
        p.vx *= k; p.vy *= k;
        if (p.g) p.g *= k;
      }
    }
  }

  // Gestures (Sky and Ground): drag to look around, pinch to step closer or back, tap the ground to place a cracker
  // (drag one to move it), tap the sky to fire when Tap sky is on, double-tap the sky to look ahead again.
  const touches3d = new Map();
  let look3d = null, lastTap3d = 0;
  // Looking around is allowed between launches and while a show is lit, not while a rocket is on its way up.
  const lookAllowed = () => launch.state === 'READY' || !!(launch.sequence && (launch.sequence.ground || launch.state === 'BURSTING' || launch.state === 'FADING'));
  function look3dDown(e) {
    if (!lookAllowed()) return;
    touches3d.set(e.pointerId, [e.clientX, e.clientY]);
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (touches3d.size >= 2) {
      const [a, b] = [...touches3d.values()];
      look3d = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, moved: true };
      return;
    }
    el.hint.classList.add('gone');
    const item = playMode === 'ground' && launch.state === 'READY' ? hitItem(e.clientX, e.clientY) : null;
    const dog = !item && launch.state === 'READY' && w3d.dogGrab(e.clientX, e.clientY); // a drag from the dog: fetch
    look3d = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, item, dog, oy: item ? item.y - e.clientY : 0 };
  }
  stage.addEventListener('pointermove', (e) => {
    if (!look3d || !touches3d.has(e.pointerId) || !w3d) return;
    touches3d.set(e.pointerId, [e.clientX, e.clientY]);
    if (look3d.pinch) {
      if (touches3d.size < 2) return;
      const [a, b] = [...touches3d.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      w3d.zoom(d / look3d.pinch); look3d.pinch = d;
      return;
    }
    if (e.pointerId !== look3d.id) return;
    if (!look3d.moved && Math.hypot(e.clientX - look3d.sx, e.clientY - look3d.sy) > 9) look3d.moved = true;
    if (!look3d.moved) return;
    if (look3d.item) {
      if (!look3d.item.armed && launch.state === 'READY') moveItem(look3d.item, e.clientX, e.clientY + look3d.oy);
    } else if (look3d.dog) w3d.dogDrag(e.clientX, e.clientY);
    else {
      const k = 2.3 / (W + H); // the scene follows the finger
      w3d.turn((e.clientX - look3d.x) * k, (e.clientY - look3d.y) * k);
    }
    look3d.x = e.clientX; look3d.y = e.clientY;
  });
  const end3d = (e) => {
    if (!touches3d.delete(e.pointerId) || !look3d || touches3d.size) return;
    const g = look3d;
    look3d = null;
    if (!g.moved && !g.pinch && e.type !== 'pointercancel') tap3d(g.sx, g.sy);
    else if (g.dog) { if (w3d) w3d.dogThrow(g.x, g.y); }
    else if (!g.item) tubeCheck = true; // checked once the view has settled (stepWorld3d)
  };
  // Sky mode: after looking around, the tube Fire launches from comes back onto the forecourt in view if it was left out
  // of it. With no forecourt in view (the player is looking at the landmark), it stays put rather than turning the view.
  let tubeCheck = false;
  function keepTubeInView() {
    if (!w3dShown() || mode !== 'play' || playMode !== 'sky' || launch.state !== 'READY' || look3d) return;
    const t = groundItems.find((it) => it.launcher);
    if (t && !(t.an && t.an.off) && t.x > 24 && t.x < W - 24 && t.y > H * 0.2 && t.y < groundBottom() + 6) return;
    if (visibleSpot3d(0.5, 1)) placeSkyLauncher();
  }
  stage.addEventListener('pointerup', end3d);
  stage.addEventListener('pointercancel', end3d);
  function tap3d(x, y) {
    const now = performance.now(), twice = now - lastTap3d < 320;
    lastTap3d = now;
    if (w3d && w3d.pet(x, y)) return; // the forecourt's dog does a trick (the old man waves his stick); no cracker there
    if (playMode === 'sky' && tapSkyOn()) { tapFire(x, y); return; } // Tap sky, as on the flat sky
    if (nativeRecording === 'recording' && mode === 'play' && !rush.on) { userLaunch(x, y); return; } // Fire is hidden while recording
    if (mode !== 'play' || launch.state !== 'READY' || !w3d) return;
    if (playMode === 'sky') { if (twice) w3d.reset(); return; }
    const onGround = w3d.ground(x, y).hit && y < groundBottom();
    if (!onGround) {
      if (twice) w3d.reset();
      else if (y > groundBottom() * 0.45) toast('Crackers go on the paved ground in front of you. Double-tap the sky to look ahead.');
      return;
    }
    if (hitItem(x, y)) return; // Fire lights it
    if (burstEntitled()) {
      if (waitingItems().length >= burstMax()) { toast(`Up to ${burstMax()} crackers at once. Tap Burst all!`); return; }
      if (longWaiting(settings.item)) { toast('One long cracker at a time. Light it first'); return; }
    } else clearStreet(); // free players move their one cracker
    if (itemLocked(settings.item)) { offerTry(settings.item); return; }
    placeItem(settings.item, x, y);
    syncLaunchUi();
  }

  // The scene bar under the top buttons: the background (world) and the 2D / 3D switch, in every play mode. The switch is a
  // saved preference.
  const viewToggle = $('#viewToggle');
  function syncViewToggle() {
    const on = settings.scene3d && !w3dFailed && has3d(), flat = !model3d();
    // A night-sky world is flat only: 2D shows as chosen and 3D can't be picked (the choice is kept for the landmarks).
    viewToggle.querySelectorAll('[data-view]').forEach((b) => {
      b.setAttribute('aria-pressed', String((b.dataset.view === '3d') === (on && !flat)));
      if (b.dataset.view === '3d') { b.disabled = flat; b.title = flat ? 'This world is 2D only' : ''; b.classList.toggle('premium-lock', !has3d()); }
    });
    document.body.classList.toggle('bg-3d', on);
  }
  viewToggle.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b && b.dataset.view === '3d' && !has3d()) { openPremium({ view3d: true }); return; } // 3D is Premium
    if (!b || launch.state !== 'READY' || !model3d() || (b.dataset.view === '3d') === (settings.scene3d && !w3dFailed)) return;
    settings.scene3d = b.dataset.view === '3d';
    if (settings.scene3d) { w3dFailed = false; w3dLosses = []; } // asked for again: another try
    saveSettings(); syncViewToggle(); syncWorld3d();
  });
  $('#btnScene').addEventListener('click', openWorldSelector);
  // The shapes bar's × puts the bar away (the drawing and shapes stay on screen); Shapes brings it back. On the 3D
  // background, with the bar away, drags look around instead of drawing.
  $('#btnSparkClose').addEventListener('click', () => setShapesBar(false));
  $('#btnShapesOpen').addEventListener('click', () => setShapesBar(true));
  syncViewToggle();
  warmSprites();

  // ---------- Boot ----------
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });
  document.addEventListener('visibilitychange', () => {
    syncLiveSky();
    pointer = null; if (pen) penUp();
    touches3d.clear(); look3d = null;
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

  // ----- Diya Path (diya-path.js): the puzzle borrows the sky, the wallet, the daily streak and the sounds -----
  let hintBusy = false;
  const PUZZLE_HINT_GEMS = 10, PUZZLE_AD_GRACE = 10;
  // No video ads for a player's first 10 puzzle breaks (a level's result, or leaving a puzzle); after that, the usual
  // breaks, at most one every few minutes.
  function puzzleAdBreak() {
    let n = 0;
    try { n = (+localStorage.getItem('luts:puzzles-done') || 0) + 1; localStorage.setItem('luts:puzzles-done', String(n)); } catch (e) { n = PUZZLE_AD_GRACE + 1; }
    if (n > PUZZLE_AD_GRACE) adBreak('break');
  }
  // ----- Sky Duel (duel.js): a 30-second show on a landmark's sky, scored by the crowd, to challenge a friend -----
  // It borrows the Lantern Rush round (rush.kind 'duel', no lanterns), so everything a Rush turns off stays off.
  const duelHooks = { tap: null, quit: null };
  window.LUTSDuel = {
    hooks: duelHooks,
    start(wid) {
      startRush('duel', 0, wid);
      $('#rushHud').hidden = true;
      document.body.classList.add('dueling');
    },
    end() { endRush(false); restoreRushWorld(); },
    get on() { return rush.on && rush.kind === 'duel'; },
    // A shell bursting at a point given in fractions of the screen, so a friend's phone replays the same show.
    fire(type, fx, fy) { launchShell({ x: fx * W, y: fy * H, type: TYPES[type] ? type : 'peony', user: true, exact: true, fast: 1.7, tap: true }); },
    shells: () => DOCK_ORDER.filter((id) => id !== 'random' && TYPES[id]).map((id) => ({ id, label: shellLabel(id), icon: TYPES[id].icon || '🎆', art: CRACKER_ART[id] || '', gems: SHELL_GEM_COST[id] || 0, premium: PREMIUM_SHELLS.has(id) })),
    premium: () => premium.active,
    gems: () => gems(), spend: (n) => spendGems(n), openGems: (cost, label) => openGems({ cost, label }), openPremium: () => openPremium('duel'),
    worlds: () => RUSH_WORLDS.map((id) => ({ id, name: placeName(id) })),
    world: () => (rush.ownWorld ?? (world.pending || world.id)),
    placeName, worldArt: (id) => worldArt(id, 'assets/menu/challenge.jpg'),
    combo: (a, b) => showCombo(a, b), celebrate: () => celebrate(), toast: (t, ms) => toast(t, ms), achieve: (id) => achieve(id),
    share: (o) => shareThing(o), card: (o) => shareCard(o), link: (h) => rushLink(h), encode: (o) => encodeCard(o), clean,
    openSheet: (e) => { if (!sheets.includes(e)) sheets.push(e); openSheet(e); }, closeSheet: (e) => closeSheet(e),
    home: () => { if (mode !== 'intro') $('#btnHome').click(); },
    savedName,
    // A Love Sky Wall note as a fireworks show (the love card's hearts and rose palette): written in the sky, recorded to share.
    // Every occasion the love card has (Custom aside), grouped as its chips are, Love first: for the Love Sky Wall's sky show
    // The wall's default occasion: the nearest big festival or day within a month (the ones most people celebrate), else Love
    nextOccasion: () => {
      const big = new Set(['diwali', 'newyear', 'christmas', 'holi', 'pongal', 'onam', 'eid', 'rakhi', 'valentine', 'mothersday', 'fathersday', 'independence', 'friendship']);
      const today = new Date(), d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const u = OCCASIONS.filter((o) => big.has(o.id)).map((o) => ({ o, date: occasionDate(o, d0) })).filter((x) => x.date).sort((a, b) => a.date - b.date)[0];
      return u && (u.date - d0) / 864e5 <= 30 ? u.o.id : 'love';
    },
    occasions: () => ['love', ...OCC_CATS.flatMap((c) => c.ids).filter((id) => id !== 'love')].map((id) => OCC_BY_ID[id]).filter(Boolean).map((o) => [o.id, o.label]),
    playLove(to, m, occ = 'love') {
      closeSheets(); hideOverlay($('#intro'));
      const oc = OCC_BY_ID[occ] || OCC_BY_ID.love;
      playAndKeep({ kind: 'card', o: oc.id, t: clean(to || '', 20) || 'You', h: oc.head, m: cleanMsg(m || '', 120), f: savedName(), p: PALETTES[oc.theme] ? oc.theme : 'rose', w: world.pending || world.id || '', img: '', own: true });
    },
    addGems: (n, why) => addGems(n, why),
    native: () => !!(window.LUTSNative || window.LUTS_DUEL_ANYWHERE), playLink: (src) => playLink(src), toApp: (src) => toApp(src), // the web sends duels to the app
  };
  window.LUTSGame = {
    // For tests: the 3D forecourt's dog and old man (where they are, what they are up to), or null.
    get folk() { return w3d ? w3d.folk : null; },
    // For tests: the shell types the card show on screen has launched so far.
    get cardShells() { return cardShells.slice(); },
    // ----- Pataka Chor (chor.js): Ground mode on the bazaar street, with only the crackers the player finds -----
    chor: {
      get on() { return chor.on; },
      start() {
        w3dFailed = false; w3dLosses = []; // Pataka Chor needs 3D: each time it opens, 3D gets another try
        Sound.resume();
        abortLaunch();
        if (rush.on) endRush(true);
        closeDrawer(); closeCardModal(); closeSheets();
        hideOverlay($('#intro'));
        mode = 'play';
        chor.on = true;
        document.body.classList.add('chor');
        clearScene();
        setPlayMode('ground');
        syncWorld3d(); syncLaunchUi();
      },
      stop() {
        if (!chor.on) return;
        chor.on = false;
        document.body.classList.remove('chor');
        clearStreet();
        syncWorld3d(); syncLaunchUi();
      },
      // The street's 3D view once it is on screen (views, stashes, project()), or null while it loads.
      get w3d() { return chor.on && w3dShown() ? w3d : null; },
      // Puts a found cracker down at a point on the street (metres), ready to light. False when it can't go there.
      place(type, x, z) {
        if (!chor.on || !w3dShown() || launch.state !== 'READY') return false;
        const sky = skyOf(type); type = sky ? 'shell' : type;
        const p = w3d.project(x, 0, z);
        if (!p) return false;
        chor.placing = true;
        let it = null;
        settings.item = type; // Fire lights this one (the choice isn't saved: it is the found cracker, not the player's pick)
        try { it = placeItem(type, p[0], p[1], { x, z }); } finally { chor.placing = false; }
        if (it && sky) it.shellId = sky;
        syncLaunchUi();
        return !!it;
      },
      // A thrown cracker going off where it hit, at once (a wall, a roof, a tree, the dog, the old man): a flash, a ring of
      // sparks, light on the scene and the bang. size about 1 for an everyday cracker. False when that spot is out of view.
      bang(x, y, z, size = 1) {
        if (!chor.on || !w3dShown()) return false;
        const p = w3d.project(x, y, z);
        if (!p) return false;
        const k = clamp(size * w3d.ppm(p[2]) / 70, 0.25, 1.6);
        flash(p[0], p[1], '#ffd27a', k);
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * TAU, v = rand(140, 420) * U * k;
          star(p[0], p[1], Math.cos(a) * v, Math.sin(a) * v - 80 * U * k, Math.random() < 0.7 ? pick(GOLD) : color(), rand(0.35, 0.8), { drag: 0.88, grav: 1.6, size: 1.2, glitter: 0.3 });
        }
        w3d.light('#ffb347', 1.1 * size, { x, y, z });
        Sound.burst(Math.min(1, 0.5 + size * 0.4), pan(p[0]));
        return true;
      },
      waiting: () => waitingItems().length,
      // A cracker's own picture (assets/ground), to draw it flying through the air; null for one drawn in code only.
      art(type) { const img = groundArt[skyOf(type) ? 'shell' : type]; return img && img.complete && img.naturalWidth ? img : null; },
      // The picture the Sky and Ground lists show for a cracker (its dock chip's: the tube photo, the cut-out, the artwork
      // or the drawing), for Seth-ji's shop; the drawing, big, if the chip has none yet.
      pic(type) {
        const sky = skyOf(type), chip = sky ? shellList.querySelector(`[data-shell="${sky}"]`) : document.querySelector(`[data-item="${type}"]`);
        const img = chip && chip.querySelector('img');
        return img && img.src && !img.src.startsWith('data:') ? img.src : itemIcon(sky ? 'shell' : type, 6); // a drawn one: drawn again, big and sharp
      },
      waiting: () => waitingItems().length,
      // A thrown cracker going off where it hit, as itself (an anar sprays from the roof it landed on, a rocket leaves the
      // wall): placed at that world point and lit at once. Null when that spot can't take it (out of view).
      throwLight(type, x, y, z) { const h = this.ride(type, x, y, z); if (h) h.fire(); return h; },
      // A found cracker riding something that moves (the donkey's basket) at a world point (metres, y up): placed there,
      // ready to light. Returns { move(x, y, z), lit, done }, or null when it can't go down now.
      ride(type, x, y, z) {
        if (!chor.on || !w3dShown()) return null;
        const sky = skyOf(type); type = sky ? 'shell' : type;
        const p = w3d.project(x, y, z);
        if (!p) return null;
        chor.placing = true;
        let it = null;
        settings.item = type;
        try { it = placeItem(type, p[0], p[1], { x, z }); } finally { chor.placing = false; }
        if (!it) return null;
        if (sky) it.shellId = sky;
        const q = [];
        const move = (mx, my, mz) => {
          const a = it.an;
          if (!a || !w3d) return;
          a.wx = mx; a.wy = my; a.wz = mz;
          const r = w3d.project(mx, my, mz, q);
          if (!r) return;
          it.x = a.ax = r[0]; it.y = a.ay = r[1]; a.d = r[2];
          it.s = itemSize3d(r[2]); it.z = depth3d(r[2]);
        };
        move(x, y, z);
        syncLaunchUi();
        // spent: a rocket that has flown leaves only its empty bottle, which needn't ride on; remove() takes it off.
        const remove = () => { const i = groundItems.indexOf(it); if (i >= 0) groundItems.splice(i, 1); it.done = true; };
        const fire = () => { if (!it.armed && !it.done) { lightItem(it); it.swept = true; festLaunched([it.type]); } };
        return { move, remove, fire, get lit() { return it.armed; }, get spent() { return !!it.fired; }, get done() { return it.done || !groundItems.includes(it); } };
      },
      // Which street to play on: the scene loads in its place (chor.js waits for it). The Premium ones need Premium.
      get street() { return chor.street; },
      setStreet(id) { if (id === chor.street) return; chor.street = id; clearStreet(); syncWorld3d(); },
      // A rewarded video (to slip away when caught): whether one can play now, and playing it. Resolves true once the
      // video was watched to the end and its reward confirmed (once per receipt).
      canVideo: () => premium.active || (videoOk(rewardsProvider()) && !rewardBusy),
      async watchVideo(tag) {
        if (premium.active) return true; // Premium: no ads, the reward without the video
        const provider = rewardsProvider();
        if (!provider || rewardBusy) return false;
        rewardBusy = true;
        try {
          const receipt = await rewardTimeout(() => provider.watchAd({ chor: tag }));
          if (!receipt || receipt.kind !== 'ad' || await provider.verifyReceipt(receipt) !== true || wallet.tx.includes(`ad:${receipt.id}`)) return false;
          wallet.tx.push(`ad:${receipt.id}`); saveWallet();
          if (provider.acknowledgeReceipt) { try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* deduplicated by id */ } }
          return true;
        } catch (error) { toast(videoMiss(error)); return false; } finally { rewardBusy = false; }
      },
      gems: () => gems(),
      // A thrown cracker lights as it lands (with any others waiting on the street).
      fire: () => requestFire(),
      ready: () => launch.state === 'READY' && !paused,
      // A night's chaos score, for its Play Games board once one is set up (GameAchievements.LEADERBOARDS "chor").
      score(n) { if (n > 0) postScores(`chor:${Math.round(n)}`); },
      // The crackers that may be found: every ground cracker but the drawing hooks; the Premium ones only in rare stashes.
      types: () => ITEM_ORDER.filter((t) => ITEMS[t] && !HOOKS.includes(t)),
      premiumItem: (t) => PREMIUM_ITEMS.has(t),
      gemItem: (t) => (GEM_COST[t] || 0) > 0, // costs gems to light in the show (found crackers light free)
      gemCost: (t) => GEM_COST[t] || 0,
      label: (t) => (skyOf(t) ? `${shellLabel(skyOf(t))} shell` : crackerName(t) || t),
      // Sky shells found on the street ("sky:<shell>"): a tube that sends up that shell. Everyday ones, and the Premium.
      skyTypes: () => Object.keys(WEIGHTS).filter((k) => TYPES[k] && !PREMIUM_SHELLS.has(k)),
      premiumSky: () => [...PREMIUM_SHELLS].filter((k) => TYPES[k]),
      addGems: (n) => addGems(n),
      premium: () => premium.active,
      // A rare stash opens with Premium, or for gems; short of gems, the shop opens.
      spend(n, label) { if (premium.active || spendGems(n)) return true; openGems({ cost: n, label }); return false; },
      openPremium: () => openPremium({ levels: true }),
      toast, buzz, dayKey,
      tick: () => Sound.tick(0),
    },
    enter() {
      abortLaunch();
      if (rush.on) endRush(true);
      closeDrawer(); closeCardModal(); closeSheets();
      if (mode === 'card' || mode === 'envelope') { $('#envelope').hidden = true; exitCardMode(); }
      hideOverlay($('#intro'));
      mode = 'puzzle';
      freeShowResources();
      clearScene(); // the main show's shells and crackers would go on bursting, unseen but heard, behind the puzzle
      document.body.classList.add('puzzling');
    },
    // Silence the sky: no shells, crackers or queued launches left to make a sound.
    quiet() { if (mode === 'puzzle') clearScene(); },
    leave() {
      document.body.classList.remove('puzzling');
      if (mode === 'puzzle') $('#btnHome').click();
    },
    // A finished puzzle's show over the chosen landmark: more and bigger shells for more stars. Returns its length.
    show(stars) {
      clearTimers('diya');
      const n = 3 + stars * 3, top = world.img && world.rect ? clamp(world.rect.roof - H * 0.08, H * 0.16, H * 0.4) : H * 0.4;
      const kinds = ['chrysanthemum', 'peony', 'willow', 'kamuro', 'crossette', 'ring'];
      for (let i = 0; i < n; i++) {
        after(0.15 + i * (2.6 / n), () => launchShell({ x: W * (0.15 + Math.random() * 0.7), y: H * 0.1 + Math.random() * (top - H * 0.1), type: kinds[(i + stars) % kinds.length], size: 0.8 + stars * 0.15 }), 'diya');
      }
      if (stars >= 3) after(2.9, () => { launchShell({ x: W * 0.25, y: H * 0.2, type: 'heart' }); launchShell({ x: W * 0.75, y: H * 0.2, type: 'heart' }); }, 'diya');
      return 3.4 + (stars >= 3 ? 0.8 : 0);
    },
    // Rocket Rush's finale: one shell where it asks, x and y as shares of the sky (y stays above the landmark).
    fire(o) {
      const top = world.img && world.rect ? clamp(world.rect.roof - H * 0.08, H * 0.16, H * 0.4) : H * 0.4;
      launchShell({ type: o.type, c1: o.c1, c2: o.c2, tint: true, size: o.size, fast: o.fast, x: W * o.x, y: H * 0.1 + o.y * (top - H * 0.1) });
    },
    // Save my sky: records the show start() plays and hands the video to the share sheet. Returns stop(), to call when
    // the show ends, or null when nothing can record here.
    // opts.caption: the share text's first line; opts.layer(g, sx, sy): draws the puzzle's own canvas into each frame of a
    // web recording (the web recorder sees only the sky; the native one records the screen and needs no layer).
    recordSky(start, opts = {}) {
      setShareCaption(`${opts.caption || '🚀 I lit up the sky with Rocket Rush in Light Up the Skies 🎆'}\nPlay it: ${appLink()}${getApp('level')}`);
      if (nativeRecorder) {
        if (nativeRecording !== 'idle') return null;
        nativeRecordingReady = start; // the show starts once the screen recorder has
        window.LUTSAndroid.recording('start');
        return () => nativeOutro();
      }
      if (!canRecord()) { toast('Video recording is not supported in this browser'); return null; }
      if (rec) { if (rec.quiet) discardRecording(); else stopRecording(); }
      startRecording('Recording your sky…');
      if (!rec) return null;
      const r = rec;
      r.layer = opts.layer || null;
      start();
      return () => { if (rec !== r) return; r.outro = performance.now(); setTimeout(() => { if (rec === r) stopRecording(); }, 2000); };
    },
    // A finished level's picture card to the share sheet, the same way Daily Sky results are shared.
    shareResult({ kicker = '', title = '', big = '', stars = -1, line = '', text = '', name = 'light-up-the-skies.png', art = 'assets/menu/diya-path.png' }) {
      return shareThing({ title, text, url: appLink(), blob: shareCard({ art, kicker, title, big, stars, line }), name, src: 'level' });
    },
    // A puzzle's own recorded clip to the share bar, the same way a recorded show is offered.
    shareVideo(blob, name, type, caption) {
      setShareCaption(`${caption}\nPlay it: ${appLink()}${getApp('level')}`);
      deliverVideo(blob, name, type);
    },
    gems, addGems, toast, buzz, dayKey,
    resume: () => Sound.resume(),
    audio: () => (Sound.ready() ? { ctx: Sound.ctx, out: Sound.dest(0) } : null),
    // The fireworks' own sounds, for the puzzles: a rocket's hissing lift (with a whistle), crackle and a burst. pan: -1…1.
    sounds: {
      lift: (pan, dur, whistle) => Sound.lift(pan, dur, whistle),
      crackle: (pan) => Sound.crackle(pan),
      burst: (size, pan, delay) => Sound.burst(size, pan, delay),
    },
    place: () => placeName(world.pending || world.id),
    adBreak: () => puzzleAdBreak(),
    premium: () => premium.active,
    openPremium: (intent) => openPremium(intent || { levels: true }),
    // Puzzle hints past the free ones are paid in gems; short of gems, the shop opens.
    hintCost: () => PUZZLE_HINT_GEMS,
    buyHint() { if (spendGems(PUZZLE_HINT_GEMS)) return true; openGems({ cost: PUZZLE_HINT_GEMS, label: 'Hint' }); return false; },
    // A finished daily puzzle's score for its category leaderboard ("diya" or "rocket"); everyone plays the same puzzle,
    // so Play's daily, weekly and all-time lists rank today's, this week's and the best daily ever.
    dailyScore(kind, score) { if ((kind === 'diya' || kind === 'rocket') && score > 0) postScores(`${kind}:${Math.round(score)}`); },
    // A finished puzzle level (Diya Path, Rocket Rush) pays no gems: gems come from the shop and buy extra hints.
    reward({ stars, had = 0, index = 0, daily = false }) {
      const gain = 0, chest = 0;
      // Festival Points: 20 per new star; the day's daily puzzle (Diya or Rocket) 60 the first time it is solved.
      if (daily) { if (!had && stars) festPoints('puzzleDaily', 60); }
      else festPoints('puzzle', Math.max(0, stars - had) * 20);
      if (stars && window.LUTSGoals) LUTSGoals.tick('puzzle');
      return { gain, chest };
    },
    // A rewarded video doubles a chest: true once Google confirms the video was watched.
    async doubleChest(n) {
      if (!(await this.watchVideo())) return false;
      addGems(n, 'chest doubled');
      return true;
    },
    // The solved Daily Diya (or cleared Daily Rocket) counts toward the Daily Sky streak.
    markDaily(day = dayKey(), kind = 'diya') {
      const st = loadRush(), k = kind === 'rocket' ? 'rocket' : 'diya';
      st[k] = st[k] || {};
      st[k][day] = 1;
      const keys = Object.keys(st[k]).sort();
      for (const old of keys.slice(0, Math.max(0, keys.length - 120))) delete st[k][old];
      saveRush(st);
      if (dailyStreak(st) >= 7) achieve('daily7');
      return dailyStreak(st);
    },
    dailyStreak: () => dailyStreak(),
    // True once today's Daily Sky, Diya or Rocket is played (the streak is safe for today).
    playedToday() { const st = loadRush(), k = dayKey(); return (st.days || {})[k] !== undefined || !!(st.diya || {})[k] || !!(st.rocket || {})[k]; },
    videoReady() { if (premium.active) return true; const p = rewardsProvider(); return videoOk(p); },
    // A rewarded video for more hints: true once Google confirms it was watched (each receipt counts once).
    async watchVideo() {
      if (premium.active) return true; // Premium: no ads, the reward without the video
      const provider = rewardsProvider();
      if (hintBusy || rewardBusy || !this.videoReady()) return false;
      hintBusy = true;
      try {
        const receipt = await rewardTimeout(() => provider.watchAd({ hints: 2 }));
        if (!receipt || receipt.kind !== 'ad' || await provider.verifyReceipt(receipt) !== true || wallet.tx.includes(`ad:${receipt.id}`)) return false;
        wallet.tx.push(`ad:${receipt.id}`); saveWallet();
        if (provider.acknowledgeReceipt) { try { await provider.acknowledgeReceipt(receipt); } catch (_) { /* deduplicated by id */ } }
        return true;
      } catch (error) { toast(error.message || 'No video is available. Try again later.'); return false; }
      finally { hintBusy = false; }
    },
  };
  window.dispatchEvent(new Event('luts:game'));

  resize();
  syncSettingsUi();
  syncLaunchUi();
  syncWorldUi();
  restoreSelectedWorld();
  incoming = readHash();
  if (incoming) { keepReceived(incoming); $('#intro').hidden = true; showEnvelope(incoming); }
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
