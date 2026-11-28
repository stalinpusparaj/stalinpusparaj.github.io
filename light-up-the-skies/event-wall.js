/* Event Sky wall: window.EventWall (build spec research/event-sky-spec.md §3.6, §4.13, §4.20, §4.24, §5.5).

   The big screen at the venue. One schedule for every screen of an event: a frame is drawn from server time (ES.clock)
   and from data every screen reads the same way (approved items sorted by (approval time, id), pub, live), so a main
   screen, a mirror and a TV show the same thing at the same instant and the room sees one flash.
   - Data: the RTDB doorbell (ES.bell.watch, wall cadence §4.20) says what changed; only then the wall reads Firestore
     deltas (media and guests with st 1, 2 or 3 and mt after its cursor, with field masks). An idle wall makes 0
     Firestore reads. Bytes go to IndexedDB (luts-es 'blobs'), state to 'cursors', so a reload starts from the cache.
   - Schedule: slot length L = 4.5 s from t0 = live.wall.t0 || pub.o. Item i (a selfie or a guest's photo, in (mt, id)
     order) enters in slot max(ceil((mt_i + 8 s − t0) / L), slot_{i−1} + 1), skipping slots that a full-screen
     announcement, the finale, the disposable reveal or the challenge's end holds. In 'mix' a slot with no entrance
     shows items[hash(seed, s) mod n_s] (n_s = items approved by t0 + s·L − 8 s). An item whose slot has passed joins
     the mosaic and the slideshow without an entrance.
   - Effects: EFX (event-fx.js) draws everything from acts with fixed ids; the flash gate keeps bright bursts to 2 a
     second, 600 ms apart. 'slides' screens never flash; 'mirror' flashes with 'main'.
   - Two windows on one machine: a Web Lock elects the one that talks to the network; it writes bytes to IndexedDB
     and posts on BroadcastChannel 'es-wall-CODE'; the others make no network requests at all.
   - All night: Wake Lock, LUTSAndroid.keepAwake, at most 150 decoded pictures (LRU, closed when dropped), the mosaic
     from one 2048² atlas of 64 px tiles, a frame watchdog (10 s), a soft reload every 3 h, token refresh, and a cached
     slideshow with a 60 s back-off on governor level 3 or a 429.
   - The packer (event-packer.js, window.ESPacker) runs on the window that holds the network, when this screen's role
     allows (host, co-host or wall); the packer itself takes the lk/pack lease.
   Page order: event-config.js, event-wall.js (the language hooks below must exist before i18n.js), i18n.js,
   event-sky.js, tv.js, drone-show.js, event-fx.js, event-media.js, event-packer.js. The wall starts on DOMContentLoaded.

   Test hooks: EventWall.state(), .bursts, .denied, .setMode(), .toggleQr(), .finale(), .reveal(), .schedule(),
   .at(t), .chimes, .tune({...}), .softReload(), ._stage().

STRINGS:
Event Sky – big screen
Music on
Music off
Now playing
That song did not open. Try another one.
Show the screen controls
QR code to join the event
Scan to join the sky
Code {0}
Screen controls
Mode
QR
QR size
Sound
Full screen
Help
Next mode (M)
Show or hide the QR code (H)
QR size (Q)
Arrival sound (S)
Help (?)
Big screen keys
QR corner
Hide or show the QR
Next mode
Grand finale (hosts)
Arrival sound
This help
TV remote: OK shows or hides the QR, left and right change the mode, up and down change the QR size.
Keep this screen plugged in. It runs all night and recovers on its own.
Close
Waiting for the hosts…
Event code
Join
Show a PIN for this screen
Try again
1 guest
{0} guests
Opens in {0}
Photos are kept until {0}. To remove yours, use the event page or ask {1}.
the hosts
Offline – showing saved photos
Paused for a moment — we'll be right back
Mix
Fireworks
Slideshow
Mosaic
Challenge: {0}
Winner!
Revealed! See all the photos
Arrival sound on
Arrival sound off
QR code shown
QR code hidden
Only the hosts can start the finale
Only the hosts can reveal the photos
Show an event on this TV
On your phone, open Event Sky → your event → Screens → Pair a TV, and enter:
QR code to pair this screen
Show “{0}” on this TV?
Yes, show it
No
Enter the event code
It's the 6 letters and numbers under the QR code.
We couldn't find this event. Check the code on the card.
That isn't an event code.
This screen isn't linked to this event
Open the big screen from the event console (Screens → Open on another screen), or pair this screen with a PIN.
This invite link no longer works. Ask the hosts for a new one.
This event has ended. Photos were kept until {0}.
No connection. Trying again…
Something went wrong. Try again.
*/
(function () {
  'use strict';
  if (window.EventWall) return;

  // ================================================================= prelude: runs at once, before i18n.js loads ===
  const P = new URLSearchParams(location.search);
  const LANG_CODES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa'];
  try {
    // Event pages keep their own language choice (luts:es-lang) and dictionaries (i18n/event/), §5.2. A staff page
    // follows ?l= or else the game's language; 'auto' (when nothing was chosen on an event page) lets that win.
    window.LUTS_I18N_KEY = 'luts:es-lang';
    window.LUTS_I18N_DIR = 'i18n/event/';
    const l = String(P.get('l') || '').toLowerCase();
    let game = ''; try { game = localStorage.getItem('luts:lang') || ''; } catch (e) { game = ''; }
    window.LUTS_I18N_LANG = LANG_CODES.includes(l) ? l : (LANG_CODES.includes(game) ? game : '');
    try { if (!localStorage.getItem('luts:es-lang')) localStorage.setItem('luts:es-lang', 'auto'); } catch (e) { /* storage blocked */ }
  } catch (e) { /* the page still works in English */ }
  if (P.get('tv') === '1') document.documentElement.classList.add('tv');

  // ===================================================================================================== constants ===
  const L = 4500, LEAD = 8000, SEC = 1e3, MIN = 6e4, HOUR = 36e5;
  const REV_LEAVE = 3800, REV_DONE = 4400;               // EFX.REVEAL: the photo flies to its tile at 3.8 s, done at 4.4 s
  const FINALE_MS = 30000;                                // cdClimax timing + the drones' 12.5 s
  const DEV_MS = 9000, DEV_SLIDE = 2500, DEV_MAX = 20;    // disposable camera: developing mosaic, then a slideshow burst
  const CH_MOSAIC = 20000, WIN_MS = 5000;                 // challenge: 20 s mosaic of the tagged photos, then the winner
  const BANNER_MS = 20000;
  const MODES = ['mix', 'reveal', 'slide', 'mosaic'];
  const MODE_NAMES = { mix: 'Mix', reveal: 'Fireworks', slide: 'Slideshow', mosaic: 'Mosaic' };
  const QS = ['s', 'm', 'l'], QP = ['br', 'bl', 'tl', 'tr'];
  const ROLES = ['main', 'slides', 'mirror'];
  const SEL = {
    media: ['s', 'k', 'kd', 'd', 't', 'w', 'h', 'du', 'fn', 'm', 'cp', 'st', 'mt', 'at', 'rv', 'hl', 'by', 'xp'],
    guests: ['nm', 'wi', 'im', 'fn', 'st', 'mt', 'at', 'xp'],
  };
  const LIMIT = { media: 20, guests: 30 };                // bytes ride in the query: keep each answer small for a TV
  const ATLAS_SIZE = 2048, CELL = 64, CELLS = (ATLAS_SIZE / CELL) * (ATLAS_SIZE / CELL);
  const KINDS = ['peony', 'chrysanthemum', 'willow', 'kamuro', 'palm', 'ring', 'heart'];
  const HUES = [42, 330, 285, 205, 140, 22, 52];
  // Timings a test may shorten (EventWall.tune); the defaults are the spec's.
  // maxBitmaps is the hard ceiling (§3.6); keepBitmaps the working set kept beyond what is on screen (a TV has little
  // memory: a 1080 px photo decodes to 3.5 MB).
  const TUNE = { quotaBackoff: 60e3, softEvery: 3 * HOUR, watchdog: 10e3, maxBitmaps: 150, keepBitmaps: P.get('tv') === '1' ? 24 : 60, saveEvery: 10e3, lazyGap: 30e3, syncGap: 1200 };

  // ================================================================================================= small helpers ===
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tr = (s) => { try { const T = window.LUTSLang; return (T && typeof T.t === 'function' && T.t(s)) || s; } catch (e) { return s; } };
  const fillEn = (s, ...a) => String(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  const fill = (s, ...a) => tr(fillEn(s, ...a)); // canvas text: the filled English line, then the dictionary's pattern
  const hash = (seed, id) => (window.EFX ? window.EFX.hash(seed, id) : 0);
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lang = () => (window.LUTSLang && window.LUTSLang.lang) || 'en';
  function fmtDate(ms, tz) {
    const l = `${lang()}-IN`, o = { day: 'numeric', month: 'long', year: 'numeric' };
    try { return new Intl.DateTimeFormat(l, Object.assign({ timeZone: tz || undefined }, o)).format(new Date(ms)); } catch (e) {
      try { return new Intl.DateTimeFormat('en-IN', o).format(new Date(ms)); } catch (x) { return new Date(ms).toDateString(); }
    }
  }
  function fmtLeft(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const p = (v) => String(v).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
  }
  const sniff = (u8) => {
    if (!u8 || u8.length < 12) return 'application/octet-stream';
    if (u8[0] === 0xff && u8[1] === 0xd8) return 'image/jpeg';
    if (u8[0] === 0x89 && u8[1] === 0x50) return 'image/png';
    if (u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57) return 'image/webp';
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'video/mp4';
    if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return 'video/webm';
    return 'application/octet-stream';
  };
  const isImage = (u8) => /^image\//.test(sniff(u8));
  const noop = () => {};
  const warn = (what, e) => { try { if (window.console) console.warn(`EventWall ${what}:`, (e && (e.code || e.message)) || e); } catch (x) { /* none */ } };

  // ========================================================================================================= state ===
  const S = {
    code: '', role: ROLES.includes(P.get('screen')) ? P.get('screen') : 'main', tv: P.get('tv') === '1',
    seed: '', staffRole: null, uid: null,
    pub: null, live: {}, bell: {}, wall: { md: 'mix', qs: 'm', qp: 'br', qh: false, snd: false, t0: 0, sl: 6000, fl: 'dim' },
    items: new Map(),        // key ('g:<seat>' | 'm:<media id>') -> item metadata
    gone: new Map(),         // key -> {mt, st} of the removal (an older copy never brings it back)
    names: new Map(),        // seat -> guest name (approved selfies only)
    reports: new Map(),      // media id -> {n, at}
    cursors: { media: null, guests: null },
    winSeen: {},             // challenge id -> server time this screen first saw a winner
    autoWin: {},             // challenge id -> item key picked by reactions
    localRev: 0, localFin: 0,
    leader: false, offset: 0, running: false, ended: false,
    level: 0, offline: false, quotaUntil: 0, paused: false, linked: false,
    version: 0, planV: -1, plan: null,
    sound: false, chimes: [], lastChime: -Infinity, chimeCheck: 0,
    frames: 0, lastFrameAt: 0, watchdogFires: 0, softReloads: 0, softBy: {}, hardReloads: 0, lastSoft: 0, stallUntil: 0, saveDirty: false,
    firstSeen: new Map(),    // key -> server time this screen first knew the item (tests: "within one poll")
    errors: 0, syncs: 0, lastSync: 0,
  };
  const now = () => Date.now() + (S.leader && window.ES ? window.ES.clock.offset() : S.offset);
  const bump = () => { S.version++; };

  // ======================================================================================================== bytes ===
  const blobKey = (key) => `${S.code}/w/${key}`;
  const recent = new Map(); // a few byte records kept in memory (decode bursts)
  async function bytesOf(key) {
    if (recent.has(key)) return recent.get(key);
    let rec = null;
    try { rec = await ES.idb.get('blobs', blobKey(key)); } catch (e) { rec = null; }
    if (rec) { recent.set(key, rec); if (recent.size > 24) recent.delete(recent.keys().next().value); }
    return rec || null;
  }
  async function putBytes(key, rec) {
    recent.delete(key);
    try { await ES.idb.put('blobs', blobKey(key), rec); return true; } catch (e) {
      // Storage full: drop the oldest display copies (keep the small thumbnails), then try once more.
      warn('storage', e);
      await evictDisplay(80).catch(noop);
      try { await ES.idb.put('blobs', blobKey(key), rec); return true; } catch (x) { return false; }
    }
  }
  async function delBytes(key) { recent.delete(key); try { await ES.idb.del('blobs', blobKey(key)); } catch (e) { /* gone already */ } }
  async function evictDisplay(n) {
    const list = [...S.items.values()].filter((it) => it.hasD && it.kind !== 'g' && !it.hl).sort((a, b) => a.mt - b.mt).slice(0, n);
    for (const it of list) {
      const rec = await bytesOf(it.key);
      if (rec && rec.d) { delete rec.d; await ES.idb.put('blobs', blobKey(it.key), rec).catch(noop); }
      it.hasD = false;
    }
    bump();
  }

  // ======================================================================== decoded pictures (LRU, at most 150) ===
  const BM = new Map();      // name ('d:<key>' | 't:<key>') -> {bmp, used}
  const BM_WAIT = new Map(); // name -> Promise
  let pinned = new Set();
  function bitmapNow(name) { const r = BM.get(name); if (r) { r.used = Date.now(); return r.bmp; } return null; }
  function wantBitmap(key, which) {
    const name = `${which}:${key}`;
    if (BM.has(name) || BM_WAIT.has(name)) return;
    const p = (async () => {
      const it = S.items.get(key);
      if (!it) return null;
      const rec = await bytesOf(key);
      if (!rec) return null;
      let bytes = which === 'd' ? rec.d : rec.t;
      if (!bytes || !isImage(bytes)) bytes = (rec.t && isImage(rec.t)) ? rec.t : ((rec.d && isImage(rec.d)) ? rec.d : null); // a video's poster
      if (!bytes) return null;
      let bmp = null;
      try { bmp = await createImageBitmap(new Blob([bytes], { type: sniff(bytes) })); } catch (e) { warn('decode', e); return null; }
      if (!S.items.has(key) || !S.running) { try { bmp.close(); } catch (e) { /* closed */ } return null; } // erased meanwhile
      BM.set(name, { bmp, used: Date.now() });
      trimBitmaps();
      return bmp;
    })().catch((e) => { warn('decode', e); return null; }).finally(() => BM_WAIT.delete(name));
    BM_WAIT.set(name, p);
  }
  function dropBitmaps(key) {
    for (const w of ['d', 't']) {
      const r = BM.get(`${w}:${key}`);
      if (r) { try { r.bmp.close(); } catch (e) { /* closed */ } BM.delete(`${w}:${key}`); }
    }
  }
  function trimBitmaps() {
    const keep = Math.min(TUNE.keepBitmaps, TUNE.maxBitmaps);
    if (BM.size <= keep) return;
    const order = [...BM.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [name, r] of order) {
      if (BM.size <= keep) break;
      if (pinned.has(name)) continue;
      try { r.bmp.close(); } catch (e) { /* closed */ }
      BM.delete(name);
    }
    // Everything left is on screen right now: drop the oldest anyway rather than grow (never more than the cap).
    while (BM.size > TUNE.maxBitmaps) {
      const [name, r] = [...BM.entries()].sort((a, b) => a[1].used - b[1].used)[0];
      try { r.bmp.close(); } catch (e) { /* closed */ } BM.delete(name);
    }
  }
  function closeAllBitmaps() { for (const r of BM.values()) { try { r.bmp.close(); } catch (e) { /* closed */ } } BM.clear(); }

  // ========================================================================== the mosaic atlas (2048², 64 px) ===
  const ATLAS = { canvas: null, g: null, cells: new Map(), free: [], used: new Map(), drawing: new Set(), gen: 0 };
  function atlasReset() {
    if (ATLAS.canvas) { ATLAS.canvas.width = ATLAS.canvas.height = 1; }
    const c = document.createElement('canvas'); c.width = c.height = ATLAS_SIZE;
    ATLAS.canvas = c; ATLAS.g = c.getContext('2d'); ATLAS.gen++;
    ATLAS.cells.clear(); ATLAS.used.clear(); ATLAS.drawing.clear();
    ATLAS.free = Array.from({ length: CELLS }, (_, i) => CELLS - 1 - i);
  }
  const cellXY = (i) => [(i % (ATLAS_SIZE / CELL)) * CELL, Math.floor(i / (ATLAS_SIZE / CELL)) * CELL];
  // The cell of an item (reserved now, drawn when its thumbnail decodes). Returns {sx, sy} or null when full.
  function cellFor(key, keep) {
    let i = ATLAS.cells.get(key);
    if (i === undefined) {
      if (!ATLAS.free.length) { // reuse the least recently used cell that no current mosaic needs
        const old = [...ATLAS.used.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1] - b[1])[0];
        if (!old) return null;
        clearCell(old[0]);
      }
      i = ATLAS.free.pop();
      ATLAS.cells.set(key, i);
      drawCell(key, i);
    }
    ATLAS.used.set(key, Date.now());
    const [sx, sy] = cellXY(i);
    return { sx, sy };
  }
  function clearCell(key) {
    const i = ATLAS.cells.get(key);
    if (i === undefined) return;
    const [x, y] = cellXY(i);
    try { ATLAS.g.clearRect(x, y, CELL, CELL); } catch (e) { /* lost context */ }
    ATLAS.cells.delete(key); ATLAS.used.delete(key); ATLAS.free.push(i);
  }
  async function drawCell(key, i) {
    if (ATLAS.drawing.has(key)) return;
    ATLAS.drawing.add(key);
    const atlas = ATLAS.canvas;
    try {
      const rec = await bytesOf(key);
      const bytes = rec && ((rec.t && isImage(rec.t)) ? rec.t : (rec.d && isImage(rec.d) ? rec.d : null));
      if (!bytes) return;
      const bmp = await createImageBitmap(new Blob([bytes], { type: sniff(bytes) }));
      try {
        if (atlas !== ATLAS.canvas || ATLAS.cells.get(key) !== i || !S.items.has(key)) return; // reset or erased meanwhile
        const s = Math.min(bmp.width, bmp.height), [x, y] = cellXY(i);
        ATLAS.g.imageSmoothingEnabled = true; ATLAS.g.imageSmoothingQuality = 'medium';
        ATLAS.g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, x, y, CELL, CELL);
      } finally { try { bmp.close(); } catch (e) { /* closed */ } }
    } catch (e) { warn('tile', e); } finally { ATLAS.drawing.delete(key); }
  }

  // ======================================================================================================= stage ===
  let stage = null, raf = 0, lastTs = 0, markSprite = null;
  const ACTS = new Map(); // act id -> {sig, keys:[item keys], t, end, type, burstAt?, item?, bmps:[names]}
  function tier() { return S.tv ? 'tv' : undefined; }
  // On a phone held upright the QR card, the retention line and the mark take the bottom of the screen: a slide's "Photo by"
  // line is written above them (measured at most once a second; on a wide screen they sit at the sides, so nothing).
  let footAt = 0, footPx = 0;
  function footInset() {
    const now = Date.now();
    if (now - footAt < 1000) return footPx;
    footAt = now; footPx = 0;
    if (innerWidth >= innerHeight) return 0;
    let top = innerHeight;
    for (const el of document.querySelectorAll('.w-qr, #wKeep')) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity !== 0 && r.bottom > innerHeight * 0.6) top = Math.min(top, r.top);
    }
    if (markSprite && markSprite.y > innerHeight * 0.6) top = Math.min(top, markSprite.y); // the free plan's mark, above the QR
    footPx = Math.max(0, innerHeight - top + 6);
    return footPx;
  }
  // The light show under the sky (event-cine.js ESCine.live): lasers, LED lights, light leaks and glitter in the
  // occasion's colours, brighter while a guest's wish is on screen and in the finale. Still with reduced motion.
  let light = null, lightFor = '';
  function lightShow(ctx, w, h, t) {
    if (!window.ESCine || S.role === 'slides') return;
    const tp = (S.pub && S.pub.tp) || 'party', key = `${tp}|${S.seed}|${w}x${h}`;
    if (key !== lightFor) {
      lightFor = key;
      let reduced = false; try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }
      light = window.ESCine.plan({ theme: window.ESCine.theme(tp), seed: `live:${S.seed}`, w, h, reduced });
    }
    let boost = 0, finale = false, hole = null;
    for (const a of ACTS.values()) {
      // a slide's photo (EFX: fitted into 94% x 88% of the screen, centred): the light show goes round it
      if (a.type === 'slide' && t >= a.t && t < a.end && a.item) {
        const iw = +a.item.w || 4, ih = +a.item.h || 3, k = Math.min((w * 0.94) / iw, (h * 0.88) / ih) * 1.08, pw = iw * k, ph = ih * k;
        hole = { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
      }
      if (a.type === 'rv' && a.item && a.item.kind === 'g') { const x = t - a.t - 1000, d = (a.end || a.t + REV_DONE) - a.t - 1000; if (x > 0 && x < d) boost = Math.max(boost, Math.min(1, x / 400, (d - x) / 400)); }
      else if (a.type === 'finale' && t >= a.t && t < a.t + 20000) finale = true;
    }
    window.ESCine.live(ctx, w, h, t, light, { boost, finale, hole });
  }
  function makeStage() {
    const canvas = $('wSky');
    stage = window.EFX.stage(canvas, {
      seed: S.seed + (S.role === 'slides' ? ':slides' : ''), tier: tier(), role: S.role, dpr: S.tv ? 1 : Math.min(2, window.devicePixelRatio || 1),
      overlay: (ctx, w, h) => drawMark(ctx, w, h), insetBottom: footInset,
      underlay: (ctx, w, h, t) => lightShow(ctx, w, h, t),
    });
    ACTS.clear(); LANES.slot.clear(); LANES.ss.clear();
    S.planV = -1;
  }
  function addAct(act, info) {
    const cur = ACTS.get(act.id);
    if (cur && cur.sig === info.sig) return false;
    try { stage.add(act); } catch (e) { warn('act', e); return false; }
    ACTS.set(act.id, info);
    if (info.type === 'rv' && S.role === 'main') { try { const w = stage.when(act); info.burstAt = w && w.units[0] ? w.units[0].t : act.t + 1200; } catch (e) { info.burstAt = act.t + 1200; } }
    return true;
  }
  function dropAct(id) { if (!ACTS.has(id)) return; try { stage.remove(id); } catch (e) { /* gone */ } ACTS.delete(id); }
  // An erased or hidden item leaves at once: every entrance and slide showing it goes (mosaics are rebuilt by the
  // director on the next tick; its atlas cell is already blank).
  function removeActsWith(key) {
    for (const [id, a] of [...ACTS]) if (a.type !== 'mosaic' && a.keys.includes(key)) dropAct(id);
  }
  // Lanes: one act per slot (an entrance, a slide or an ambient burst) and one per slideshow step. When the plan
  // changes what a slot shows (an item erased, an announcement now, another mode), the old act is dropped.
  const LANES = { slot: new Map(), ss: new Map(), amb: new Map() };
  function lane(name, idx, act, info) {
    const m = LANES[name], old = m.get(idx);
    if (old && (!act || old !== act.id)) dropAct(old);
    if (!act) { m.delete(idx); return; }
    addAct(act, info);
    m.set(idx, act.id);
  }
  function laneClear(name, fromT) {
    for (const [idx, id] of [...LANES[name]]) { const a = ACTS.get(id); if (!a || a.end > fromT) { dropAct(id); LANES[name].delete(idx); } }
  }
  function lanePrune(beforeT) {
    for (const m of Object.values(LANES)) for (const [idx, id] of [...m]) { const a = ACTS.get(id); if (!a || a.end < beforeT) m.delete(idx); }
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const minGap = S.tv ? 1000 / 30 : 1000 / 60;
    if (ts - lastTs < minGap - 1.5) return;
    lastTs = ts;
    if (S.stallUntil && Date.now() < S.stallUntil) return; // EventWall.stall(): a frozen frame loop, for the watchdog test
    S.lastFrameAt = Date.now(); S.frames++;
    if (!stage) return;
    try { stage.render(now()); } catch (e) { S.errors++; if (S.errors < 5) warn('frame', e); }
  }
  function startFrames() { cancelAnimationFrame(raf); lastTs = 0; S.lastFrameAt = Date.now(); raf = requestAnimationFrame(frame); }

  // The app mark on free plans, bottom right (bottom left when the QR is there), drawn once into a sprite.
  function buildMark() {
    markSprite = null;
    if (!S.pub || !S.pub.mk || !window.EM || !window.EM.mark || !stage) return;
    try {
      const W = stage.width, H = stage.height, dpr = stage.dpr, c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
      const g = c.getContext('2d'); g.scale(dpr, dpr);
      // Bottom right (§4.13), stacked above whatever else lives there: the QR box, or the retention line when the QR
      // sits bottom left and the line moves right.
      const qr = $('wQr'), keep = $('wKeep');
      let lift = 0;
      const pre = document.body.classList.contains('pre'); // before opening the QR is in the middle
      if (pre) lift = 0;
      else if (qr && !qr.hidden && S.wall.qp === 'br') lift = H - qr.getBoundingClientRect().top + 6;
      else if (qr && !qr.hidden && S.wall.qp === 'bl' && keep && !keep.hidden) lift = H - keep.getBoundingClientRect().top + 4;
      const box = window.EM.mark.draw(g, W, H, { kind: 'brand', corner: 'br', scale: clamp(Math.min(W, H) / 540, 0.6, 2), bottom: Math.max(0, lift) });
      if (!box) return;
      const s = document.createElement('canvas'); s.width = Math.ceil(box.w * dpr) + 4; s.height = Math.ceil(box.h * dpr) + 4;
      s.getContext('2d').drawImage(c, Math.floor(box.x * dpr) - 2, Math.floor(box.y * dpr) - 2, s.width, s.height, 0, 0, s.width, s.height);
      c.width = c.height = 0;
      markSprite = { c: s, x: Math.floor(box.x * dpr - 2) / dpr, y: Math.floor(box.y * dpr - 2) / dpr, w: s.width / dpr, h: s.height / dpr };
    } catch (e) { warn('mark', e); markSprite = null; }
  }
  function drawMark(ctx) { if (markSprite) ctx.drawImage(markSprite.c, markSprite.x, markSprite.y, markSprite.w, markSprite.h); }

  // =================================================================================================== the plan ===
  // A pure function of the data (items, pub, live, wall settings) and the seed; evaluated at a server time.
  const cmpMt = (a, b) => (a.mt0 - b.mt0) || cmpStr(a.id, b.id) || cmpStr(a.key, b.key);
  const cmpEff = (a, b) => (a._eff - b._eff) || cmpStr(a.id, b.id) || cmpStr(a.key, b.key);
  function reportHidden(it) { const r = it.coll === 'media' ? S.reports.get(it.id) : null; return !!(r && r.n >= 3 && r.at > it.mt); }
  function revAt() { return Math.max((S.live.rev && +S.live.rev.at) || 0, S.localRev || 0); }
  function t0Of() { return +S.wall.t0 || (S.pub && +S.pub.o) || 0; }
  function effMode() {
    if (S.role === 'slides') return 'slide';
    if (S.paused || Date.now() < S.quotaUntil) return 'slide'; // the cached slideshow (quotaUntil is device time)
    return MODES.includes(S.wall.md) ? S.wall.md : 'mix';
  }
  // The finale starts 5 s after the host's tap; a quiet screen polls every 20 s or so and may hear of it late. Heard
  // while it should already be playing (but within its length), it starts 1.2 s after this screen heard, from the top.
  function finAt() {
    const f = (S.live.fin && +S.live.fin.at) || 0, seen = S.finSeen && S.finSeen.at === f ? S.finSeen.seen : 0;
    const t = f && seen > f + 300 && seen < f + FINALE_MS ? seen + 1200 : f;
    return Math.max(t, S.localFin || 0);
  }
  function buildPlan() {
    const t0 = t0Of(), rev = revAt(), seed = S.seed;
    const items = [...S.items.values()].filter((it) => it.st === 1 && !reportHidden(it));
    for (const it of items) {
      // Sent while the camera was "developing": the rules set rv = dp.at (still ahead) at upload, and a reveal moves rv
      // to the reveal time, so rv > at; a photo sent after the reveal has rv <= at. Once seen held, it stays disposable.
      it._disp = it.kind !== 'g' && it.rv > 0 && (it.dp || it.rv > it.at);
      it._eff = it._disp ? ((rev && it.at <= rev + MIN) ? Math.min(it.rv, rev) : it.rv) : it.mt0;
    }
    // ---------- special sequences (they hold the sky; entrances wait) ----------
    const sp = [];
    const fin = finAt();
    if (fin) sp.push({ type: 'finale', id: `fin:${fin}`, t: fin, end: fin + FINALE_MS, block: true, mosaic: true });
    const anns = new Map();
    for (const a of ((S.pub && Array.isArray(S.pub.an)) ? S.pub.an : [])) if (a && a.id && a.t) anns.set(a.id, a);
    if (S.live.ann && S.live.ann.id && S.live.ann.t) anns.set(S.live.ann.id, S.live.ann);
    for (const a of anns.values()) {
      const at = +a.at || 0;
      if (!at) continue;
      if (a.st === 'f') { const cd = Math.max(clamp(+a.cd || 0, 0, 900) * 1000, 8000); sp.push({ type: 'ann', id: `an:${a.id}`, t: at, cdEnd: at + cd, end: at + cd + 3500, block: true, text: String(a.t) }); }
      else sp.push({ type: 'banner', id: `bn:${a.id}`, t: at, end: at + BANNER_MS, block: false, text: String(a.t) });
    }
    // disposable groups: one developing reveal per reveal time
    const groups = new Map();
    for (const it of items) if (it._disp) { if (!groups.has(it._eff)) groups.set(it._eff, []); groups.get(it._eff).push(it); }
    for (const [R, list] of groups) {
      if (fin && R >= fin - 5000 && R <= fin + FINALE_MS) { list.forEach((it) => { it._join = fin + FINALE_MS; it._fin = true; }); continue; } // revealed at the finale
      list.sort((a, b) => (hash(seed, `dv${a.key}`) - hash(seed, `dv${b.key}`)) || cmpStr(a.key, b.key));
      const shows = list.filter((it) => it.kind === 'p').slice(0, DEV_MAX);
      const end = R + DEV_MS + shows.length * DEV_SLIDE + 500;
      list.forEach((it) => { it._join = end; });
      sp.push({ type: 'develop', id: `dv:${R}`, t: R, end, block: true, mosaic: true, list, shows });
    }
    // the challenge
    const ch = S.live.ch;
    if (ch && ch.id && +ch.end) {
      const at = +ch.at || +ch.end - 5 * MIN, end = +ch.end;
      sp.push({ type: 'ring', id: `ch:${ch.id}`, t: at, end, block: false, text: String(ch.t || '') });
      const tagged = items.filter((it) => it.coll === 'media' && !it._disp && (it.m === ch.id || (ch.m && it.m === ch.m && it.at >= at && it.at <= end + MIN))).sort(cmpMt);
      if (tagged.length) {
        sp.push({ type: 'chmosaic', id: `chm:${ch.id}`, t: end, end: end + CH_MOSAIC, block: true, mosaic: true, list: tagged.slice(-120), text: String(ch.t || '') });
        let W = end + 120e3, win = null;
        const seen = S.winSeen[ch.id];
        if (ch.win) { for (let j = 1; j <= 6; j++) if (seen !== undefined && seen <= end + j * CH_MOSAIC - 3000) { W = end + j * CH_MOSAIC; break; } win = tagged.find((it) => it.id === ch.win || it.key === ch.win) || null; }
        if (!win) win = (S.autoWin[ch.id] && tagged.find((it) => it.key === S.autoWin[ch.id])) || tagged.slice().sort((a, b) => (a.at - b.at) || cmpStr(a.key, b.key))[0];
        sp.push({ type: 'winner', id: `chw:${ch.id}`, t: W, end: W + WIN_MS, block: true, item: win, text: String(ch.t || '') });
      }
    }
    sp.sort((a, b) => a.t - b.t || cmpStr(a.id, b.id));
    const blocks = sp.filter((s) => s.block).map((s) => [s.t, s.end]);
    const blocked = (s) => { const a = t0 + s * L, b = a + L; for (const [x, y] of blocks) if (a < y && b > x) return true; return false; };
    // ---------- the entrance chain ----------
    const ent = items.filter((it) => !it._disp && (it.kind === 'g' || it.s >= 0)).sort(cmpMt);
    const slotOf = new Map(), bySlot = new Map();
    let prev = -Infinity;
    for (const it of ent) {
      let s = Math.max(Math.ceil((it.mt0 + LEAD - t0) / L), prev + 1);
      for (let g = 0; g < 20000 && blocked(s); g++) s++;
      slotOf.set(it.key, s); bySlot.set(s, it); prev = s;
    }
    for (const it of items) {
      if (slotOf.has(it.key)) it._join = t0 + slotOf.get(it.key) * L + REV_LEAVE;
      else if (!it._disp) it._join = t0 + Math.ceil((it.mt0 + LEAD - t0) / L) * L;
    }
    // ---------- slideshow pool (photos and videos), mosaic order ----------
    const pool = items.filter((it) => it.kind !== 'g').sort(cmpEff);
    const poolEff = pool.map((it) => it._eff);
    const joins = items.slice().sort((a, b) => (a._join - b._join) || cmpStr(a.key, b.key));
    const mosaicEnds = sp.filter((s) => s.mosaic).map((s) => s.end).sort((a, b) => a - b);
    return { t0, seed, items, sp, blocked, slotOf, bySlot, pool, poolEff, joins, mosaicEnds, last: prev };
  }
  function plan() { if (S.planV !== S.version || !S.plan) { S.plan = buildPlan(); S.planV = S.version; } return S.plan; }
  // How many pool items were approved by time T (binary search on the sorted effective times).
  function countBy(p, T) { let lo = 0, hi = p.poolEff.length; while (lo < hi) { const m = (lo + hi) >> 1; if (p.poolEff[m] <= T) lo = m + 1; else hi = m; } return lo; }
  function pickRaw(p, tag, idx, start) {
    const n = countBy(p, start - LEAD);
    return n ? { n, i: hash(p.seed + (S.role === 'slides' ? ':slides' : ''), `${tag}${idx}`) % n } : { n: 0, i: -1 };
  }
  function pick(p, tag, idx, start, prevStart) {
    const a = pickRaw(p, tag, idx, start);
    if (a.i < 0) return null;
    const b = pickRaw(p, tag, idx - 1, prevStart);
    const i = (a.i === b.i && a.n > 1) ? (a.i + 1) % a.n : a.i;
    return p.pool[i];
  }
  // What a screen shows at server time T: {slot, kind, current, item, special}.
  function at(T) {
    const p = plan(), mode = effMode(), slot = Math.floor((T - p.t0) / L);
    const spNow = p.sp.filter((s) => s.block && s.t <= T && T < s.end).pop();
    if (spNow) {
      let current = `special:${spNow.type}`, item = null;
      if (spNow.type === 'winner' && spNow.item) { item = spNow.item; current = `winner:${item.key}`; }
      if (spNow.type === 'develop' && T >= spNow.t + DEV_MS) { const i = Math.floor((T - spNow.t - DEV_MS) / DEV_SLIDE); item = spNow.shows[i] || null; }
      return { slot, kind: 'special', current, item, special: spNow.type };
    }
    if (mode === 'slide') {
      const sl = clamp(+S.wall.sl || 6000, 3000, 15000), k = Math.floor((T - p.t0) / sl);
      const it = pick(p, 'ss', k, p.t0 + k * sl, p.t0 + (k - 1) * sl);
      return { slot, kind: it ? 'slide' : 'idle', current: it ? `slide:${it.key}` : null, item: it, special: null };
    }
    if (mode === 'mosaic') return { slot, kind: 'mosaic', current: 'mosaic', item: null, special: null };
    const e = p.bySlot.get(slot);
    if (e && T < p.t0 + slot * L + REV_DONE) return { slot, kind: 'entrance', current: e.key, item: e, special: null };
    if (e) return { slot, kind: mode === 'reveal' ? 'mosaic' : 'idle', current: mode === 'reveal' ? 'mosaic' : null, item: null, special: null };
    if (mode === 'mix') {
      const it = pick(p, 'sl', slot, p.t0 + slot * L, p.t0 + (slot - 1) * L);
      return { slot, kind: it ? 'slide' : 'idle', current: it ? `slide:${it.key}` : null, item: it, special: null };
    }
    return { slot, kind: 'mosaic', current: 'mosaic', item: null, special: null };
  }

  // =============================================================================================== the director ===
  // Every 250 ms: turn the plan into acts for the next few seconds (acts have fixed ids, so adding one twice is free).
  const nameOf = (seat) => (seat >= 0 ? S.names.get(seat) || '' : '');
  const missionOf = (m) => {
    if (!m) return '';
    if (S.live.ch && S.live.ch.id === m) return String(S.live.ch.t || '');
    const ms = (S.pub && Array.isArray(S.pub.ms)) ? S.pub.ms : [];
    const f = ms.find((x) => x && x.id === m);
    return f ? String(f.t || '') : '';
  };
  function aspect() { return stage ? stage.width / Math.max(1, stage.height) : 16 / 9; }
  function maxTiles() { if (!stage) return 120; return clamp(Math.round((stage.width * stage.height) / (56 * 56 * 1.6)), 24, 400); }
  const BOX = { x0: 0.02, y0: 0.15, x1: 0.98, y1: 0.86 };
  function tilesFor(list, keep, joinAt) {
    const g = window.EFX.grid(list.length, { aspect: aspect(), box: BOX, gap: 0.08 });
    const out = [];
    list.forEach((it, i) => {
      const c = cellFor(it.key, keep);
      if (!c || !g[i]) return;
      out.push({ bitmap: ATLAS.canvas, sx: c.sx, sy: c.sy, sw: CELL, sh: CELL, x: g[i].x, y: g[i].y, r: g[i].r, id: it.key, at: joinAt ? joinAt(it) : null });
    });
    return out;
  }
  function membersAt(p, T) {
    const list = [];
    for (const it of p.joins) { if (it._join > T) break; list.push(it); }
    return list.slice(-maxTiles());
  }
  function photoOf(it, need) { // a decoded display picture (selfie / photo / a video's poster), requested when missing
    if (!it) return null;
    const which = it.kind === 'v' ? 't' : 'd';
    const b = bitmapNow(`${which}:${it.key}`);
    if (!b) wantBitmap(it.key, which);
    if (need) need.add(`${which}:${it.key}`);
    return b;
  }
  function director() {
    if (!stage || !S.running) return;
    const T = now(), p = plan(), mode = effMode(), cur = Math.floor((T - p.t0) / L);
    const need = new Set(), keepCells = new Set(), want = new Set();
    const pre = S.pub && T < +S.pub.o;
    // ---------- specials: announcements, the challenge, the disposable reveal, the finale ----------
    for (const s of p.sp) {
      if (s.end < T - 2000 || s.t > T + 6000) continue;
      want.add(s.id);
      const base = { keys: [], t: s.t, end: s.end, group: s.id };
      if (s.type === 'ann') addAct(window.EFX.countdown({ id: s.id, t: s.t, endsAt: s.cdEnd, label: s.text, style: 'full', finish: 3 }), Object.assign(base, { sig: `${s.cdEnd}|${s.text}`, type: 'ann' }));
      else if (s.type === 'ring') addAct(window.EFX.countdown({ id: s.id, t: s.t, endsAt: s.end, label: fill('Challenge: {0}', s.text), style: 'corner', corner: ringCorner(), finish: 0 }), Object.assign(base, { sig: `${s.end}|${s.text}|${ringCorner()}|${lang()}`, type: 'ring' }));
      else if (s.type === 'chmosaic') mosaicAct(s.id, s.t, s.list, keepCells, { ms: CH_MOSAIC, end: s.end, group: s.id });
      else if (s.type === 'winner' && s.item) {
        const ph = photoOf(s.item, need);
        if (s.t <= T + 4000 && (ph || s.t <= T + 600)) {
          addAct(window.EFX.reveal({ id: s.id, t: s.t, photo: ph, name: nameOf(s.item.s), caption: tr('Winner!'), mission: s.text }),
            Object.assign(base, { sig: `${s.item.key}|${!!ph}|${lang()}`, keys: [s.item.key], type: 'rv', item: s.item }));
        }
      } else if (s.type === 'develop') {
        mosaicAct(s.id, s.t, s.list.slice(0, 300), keepCells, { ms: DEV_MS, end: s.t + DEV_MS, develop: true, group: s.id });
        s.shows.forEach((it, i) => {
          const t = s.t + DEV_MS + i * DEV_SLIDE;
          if (t > T + 6000 || t + DEV_SLIDE < T - 1000) return;
          const ph = photoOf(it, need);
          addAct(window.EFX.slide({ id: `${s.id}:s${i}`, t, photo: ph, ms: DEV_SLIDE, seed: `${s.id}:${i}`, caption: it.cp, name: nameOf(it.s) }),
            { sig: `${it.key}|${!!ph}`, keys: [it.key], t, end: t + DEV_SLIDE, type: 'slide', item: it, group: s.id });
          const h = hash(p.seed, `${s.id}:b${i}`);
          addAct(window.EFX.burst({ id: `${s.id}:b${i}`, t: t + 600, x: i % 2 ? 0.76 : 0.24, y: 0.2 + (h % 10) / 100, kind: KINDS[h % KINDS.length], hue: HUES[(h >>> 5) % HUES.length], bright: true, rocket: true }),
            { sig: 'b', keys: [], t, end: t + 4000, type: 'burst', group: s.id });
        });
      } else if (s.type === 'finale') {
        const photos = finalePhotos(p, need);
        if (s.t <= T + 1500 && !ACTS.has(s.id)) { // added once: its drone figure is built when it is added
          addAct(window.EFX.finale({ id: s.id, t: s.t, title: finaleTitle(), names: finaleNames(), date: S.pub ? fmtDate(+S.pub.o, S.pub.tz) : '', photos, end: 'kamuro', drones: true }),
            Object.assign(base, { sig: 'f', type: 'finale' }));
        }
      }
    }
    // A special that is no longer planned (an announcement replaced, a challenge cancelled) leaves the sky.
    for (const [id, a] of [...ACTS]) if (a.group && !want.has(a.group) && a.end > T) dropAct(id);
    // ---------- one act per slot: entrance, slide or an ambient burst ----------
    if (mode === 'mix' || mode === 'reveal') {
      laneClear('ss', T);
      for (let s = cur - 1; s <= cur + 3; s++) {
        const a = p.t0 + s * L;
        if (p.blocked(s)) { lane('slot', s, null); continue; }
        const e = p.bySlot.get(s);
        if (e) {
          if (a + REV_DONE < T) continue;
          const ph = photoOf(e, need);
          if (!ph && a > T + 1000) continue; // its picture is decoding: added when ready, or 1 s before it starts
          let slotPos = null;
          if (mode === 'reveal') {
            const mem = membersAt(p, a + REV_LEAVE), i = mem.indexOf(e);
            if (i >= 0) { const g = window.EFX.grid(mem.length, { aspect: aspect(), box: BOX, gap: 0.08 }); slotPos = g[i] || null; }
          }
          const up = e.kind !== 'g';
          lane('slot', s, window.EFX.reveal({ id: `rv:${e.key}:${s}`, t: a, photo: ph, name: up ? nameOf(e.s) : e.nm, wish: up ? '' : e.wi, caption: up ? e.cp : '', mission: up ? missionOf(e.m) : '', upload: up, slot: slotPos, salute: !up }),
            { sig: `${!!ph}|${slotPos ? `${slotPos.x.toFixed(4)},${slotPos.y.toFixed(4)}` : '-'}|${nameOf(e.s)}|${lang()}`, keys: [e.key], t: a, end: a + REV_DONE, type: 'rv', item: e });
        } else if (mode === 'mix' && !pre) {
          const it = pick(p, 'sl', s, a, a - L);
          if (!it) { lane('slot', s, null); continue; }
          const ph = photoOf(it, need);
          lane('slot', s, window.EFX.slide({ id: `sl:${s}:${it.key}`, t: a, photo: ph, ms: L, seed: `sl:${s}`, caption: it.cp, name: nameOf(it.s), mission: missionOf(it.m) }),
            { sig: `${!!ph}|${lang()}`, keys: [it.key], t: a, end: a + L, type: 'slide', item: it });
          // fireworks keep going over the slideshow: a burst high in the sky, above the photo, most slides
          for (const side of [0, 1]) { const sky = slideSkyAct(p, s, a, side); lane('amb', `${s}:${side}`, sky, sky ? { sig: 'a', keys: [], t: a, end: a + 6000, type: 'burst' } : undefined); }
        } else if (mode === 'reveal' || pre) {
          const amb = ambientAct(p, s, a);
          if (amb) lane('slot', s, amb, { sig: 'a', keys: [], t: a, end: a + 6000, type: 'burst' }); else lane('slot', s, null);
        } else lane('slot', s, null);
      }
    } else {
      laneClear('slot', T); laneClear('amb', T);
      if (mode === 'slide') {
        const sl = clamp(+S.wall.sl || 6000, 3000, 15000), k = Math.floor((T - p.t0) / sl);
        for (let i = k - 1; i <= k + 2; i++) {
          const a = p.t0 + i * sl;
          const it = p.sp.some((x) => x.block && a < x.end && a + sl > x.t) ? null : pick(p, 'ss', i, a, a - sl);
          if (!it) { lane('ss', `${sl}:${i}`, null); continue; }
          const ph = photoOf(it, need);
          lane('ss', `${sl}:${i}`, window.EFX.slide({ id: `ss:${sl}:${i}:${it.key}`, t: a, photo: ph, ms: sl, seed: `ss:${i}`, caption: it.cp, name: nameOf(it.s), mission: missionOf(it.m) }),
            { sig: `${!!ph}|${lang()}`, keys: [it.key], t: a, end: a + sl, type: 'slide', item: it });
        }
      } else laneClear('ss', T);
    }
    // ---------- the mosaic (reveal and mosaic modes): everyone who has arrived, newest last ----------
    if (mode === 'reveal' || mode === 'mosaic') {
      const T2 = T + 1500, mem = membersAt(p, T2);
      let tc = 0;
      for (const it of mem) tc = Math.max(tc, it._join);
      for (const e of p.mosaicEnds) if (e <= T2) tc = Math.max(tc, e);
      if (mem.length) {
        const id = `mo:${tc}`;
        if (mosaicAct(id, tc, mem, keepCells, { main: true, end: Infinity, joinFrom: tc - 1 })) {
          for (const [oid, a] of ACTS) if (a.main && oid !== id && a.end === Infinity) a.end = Math.max(tc, T) + 600; // superseded
        }
      }
    } else for (const [id, a] of [...ACTS]) if (a.main) dropAct(id);
    // ---------- decode ahead: the next few entrances ----------
    for (let s = cur; s <= cur + 4; s++) { const e = p.bySlot.get(s); if (e) photoOf(e, need); }
    pinned = need;
    sideEffects(T, p);
  }
  // A mosaic act from a list of items (atlas cells); rebuilt only when the plan or the screen's shape changed.
  function mosaicAct(id, t, list, keepCells, o) {
    list.forEach((it) => keepCells.add(it.key));
    const sig = `${S.version}|${list.length}|${aspect().toFixed(3)}|${ATLAS.gen}`;
    const cur = ACTS.get(id);
    if (cur && cur.sig === sig) return false;
    const tiles = tilesFor(list, keepCells, o.joinFrom !== undefined ? (it) => (it._join >= o.joinFrom ? it._join : null) : null);
    return addAct(window.EFX.mosaic({ id, t, items: tiles, ms: o.ms, develop: !!o.develop }),
      { sig, keys: list.map((it) => it.key), t, end: o.end, type: 'mosaic', main: !!o.main, group: o.group });
  }
  // two a slide, one in each half of the sky, at different moments (bright ones: the flash gate spaces them)
  function slideSkyAct(p, s, a, side) {
    const h = hash(p.seed, `sky${s}:${side}`);
    if (h % 5 === 4) return null;
    return window.EFX.burst({ id: `sky:${s}:${side}`, t: a + 500 + side * 2200 + (h >>> 8) % 1400, x: (side ? 0.56 : 0.1) + ((h >>> 4) % 34) / 100, y: 0.09 + ((h >>> 12) % 8) / 100, kind: KINDS[(h >>> 16) % KINDS.length], hue: HUES[(h >>> 20) % HUES.length], size: 0.85, bright: true, rocket: true });
  }
  function ambientAct(p, s, a) {
    const h = hash(p.seed, `amb${s}`);
    if (h % 4 > 1) return null;
    return window.EFX.burst({ id: `amb:${s}`, t: a + 900 + (h >>> 8) % 1500, x: 0.15 + ((h >>> 4) % 70) / 100, y: 0.16 + ((h >>> 12) % 18) / 100, kind: KINDS[(h >>> 16) % KINDS.length], hue: HUES[(h >>> 20) % HUES.length], size: 0.8, bright: false, rocket: true });
  }
  function finalePhotos(p, need) {
    const fin = finAt();
    const list = p.items.filter((it) => it.kind !== 'g' && it._join <= fin + FINALE_MS).sort((a, b) => (b.hl - a.hl) || (b.mt0 - a.mt0) || cmpStr(a.key, b.key)).slice(0, 48);
    const out = [];
    for (const it of list) { const b = bitmapNow(`t:${it.key}`); if (b) out.push(b); else wantBitmap(it.key, 't'); need.add(`t:${it.key}`); }
    return out;
  }
  function finaleTitle() {
    const pb = S.pub || {}, n = (S.live.fin && S.live.fin.n) || pb.n || '';
    if (pb.tp === 'wedding') return 'Shubh Vivah'; // no-i18n (§4.2)
    if (pb.tp === 'birthday') return n ? fill('Happy Birthday {0}', n) : (pb.t || '');
    // an occasion: its own line with the name ("Merry Christmas, Amma"), translated (event-sky.js TEMPLATES)
    const T0 = window.ES && ES.TEMPLATES && ES.TEMPLATES[pb.tp], w = T0 && T0.finale && T0.finale.i18n && T0.finale.words[0];
    if (w && n) { // (EFX writes up to two lines of 32 letters: a long greeting breaks at the space nearest its middle)
      const g = fill(w, n);
      if (Array.from(g).length <= 32) return g;
      let at = -1;
      for (let i = g.indexOf(' '); i >= 0; i = g.indexOf(' ', i + 1)) if (at < 0 || Math.abs(i - g.length / 2) < Math.abs(at - g.length / 2)) at = i;
      return at > 0 ? `${g.slice(0, at)}\n${g.slice(at + 1)}` : g;
    }
    return pb.t || '';
  }
  function finaleNames() { const pb = S.pub || {}; return String((S.live.fin && S.live.fin.n) || pb.n || ''); }
  // The challenge ring sits in a top corner away from the QR (the guest counter is top left).
  function ringCorner() { return !S.wall.qh && S.wall.qp === 'tr' ? 'tl' : 'tr'; }

  // Chimes, the video layer, banners, counters and status lines: things that follow the plan but are not EFX acts.
  function sideEffects(T, p) {
    // arrival chime: main screen only, sound on, at most one every 5 s
    if (S.role === 'main' && S.sound) {
      for (const a of ACTS.values()) if (a.type === 'rv' && a.burstAt > S.chimeCheck && a.burstAt <= T) chime();
    }
    S.chimeCheck = T;
    videoLayer(T);
    renderFaces(T);
    if (S.role === 'main' && MU.on && !MU.src && !MU.busy) musicStart(); else musicTick();
    // banners from live.ann / pub.an (style 'b'): a gold ticker for 20 s
    const banner = p.sp.filter((s) => s.type === 'banner' && s.t <= T && T < s.end).pop();
    showBanner(banner);
    // special captions
    const spNow = p.sp.filter((s) => s.block && s.t <= T && T < s.end).pop();
    let line = '';
    if (spNow && spNow.type === 'chmosaic') line = fillEn('Challenge: {0}', spNow.text);
    else if (spNow && spNow.type === 'develop') line = 'Revealed! See all the photos';
    setText($('wSpecial'), line);
    if (spNow && spNow.type === 'ann' && S.annSaid !== spNow.id) { S.annSaid = spNow.id; setText($('wLive'), spNow.text); }
    // before the event opens
    const pre = S.pub && T < +S.pub.o;
    if (document.body.classList.contains('pre') !== !!pre) { document.body.classList.toggle('pre', !!pre); buildMark(); }
    const opens = $('wOpens');
    if (pre) { opens.hidden = false; setText(opens, fillEn('Opens in {0}', fmtLeft(+S.pub.o - T))); } else opens.hidden = true;
    statusLine();
    if (S.countV !== S.version) { S.countV = S.version; renderCount(); }
  }

  // ==================================================================================================== video ===
  const VID = { key: null, url: null, start: 0, loading: false };
  const flashTodo = [];
  // fl: 0 calm (checked), 1 flashy, 2 the check failed, null not checked yet. Only a checked calm clip plays at full
  // brightness; 'skip' leaves out the clips found flashy.
  const dimmed = (fl) => fl !== 0;
  function queueFlash(key) {
    if (!flashTodo.includes(key)) flashTodo.push(key);
    setTimeout(flashWork, 3000);
  }
  function videoLayer(T) {
    const v = $('wVid');
    if (!v) return;
    let cur = null;
    for (const a of ACTS.values()) if (a.type === 'slide' && a.item && a.t <= T && T < a.end - 300 && (!cur || a.t > cur.t)) cur = a;
    const it0 = cur && cur.item && cur.item.kind === 'v' ? cur.item : null;
    const it = it0 ? (S.items.get(it0.key) || it0) : null; // the latest copy: its flash check may have finished meanwhile
    const skip = it && it.fl === 1 && S.wall.fl === 'skip';
    if (!it || skip) { stopVideo(); return; }
    if (VID.key === it.key && VID.start === cur.t) { v.classList.toggle('dim', dimmed(it.fl)); placeVideo(v, it); return; }
    stopVideo();
    VID.key = it.key; VID.start = cur.t; VID.loading = true;
    bytesOf(it.key).then((rec) => {
      if (VID.key !== it.key || VID.start !== cur.t) return;
      const b = rec && rec.d;
      if (!b || isImage(b)) { VID.loading = false; return; }
      VID.url = URL.createObjectURL(new Blob([b], { type: sniff(b) }));
      v.src = VID.url; v.hidden = false; v.classList.toggle('dim', dimmed((S.items.get(it.key) || it).fl));
      placeVideo(v, it);
      const off = Math.max(0, (now() - cur.t) / 1000);
      v.addEventListener('loadedmetadata', () => { try { if (off < (v.duration || 0)) v.currentTime = off; } catch (e) { /* not seekable */ } }, { once: true });
      v.play().then(() => v.classList.add('on')).catch(() => { v.classList.add('on'); });
      VID.loading = false;
    }).catch(() => { VID.loading = false; });
  }
  function placeVideo(v, it) {
    if (!stage) return;
    const W = stage.width, H = stage.height, w = it.w || 640, h = it.h || 360, k = Math.min((W * 0.94) / w, (H * 0.88) / h);
    const vw = Math.round(w * k), vh = Math.round(h * k);
    v.style.width = `${vw}px`; v.style.height = `${vh}px`; v.style.left = `${Math.round((W - vw) / 2)}px`; v.style.top = `${Math.round((H - vh) / 2)}px`;
  }
  function stopVideo() {
    const v = $('wVid');
    if (!VID.key || !v) return;
    VID.key = null; VID.start = 0;
    v.classList.remove('on');
    try { v.pause(); } catch (e) { /* none */ }
    const url = VID.url; VID.url = null;
    setTimeout(() => { if (!VID.key) { v.removeAttribute('src'); try { v.load(); } catch (e) { /* none */ } v.hidden = true; } if (url) URL.revokeObjectURL(url); }, 700);
  }
  // Flash analysis on the wall too (§4.24): one video at a time, in the background, on the window that owns the data.
  async function flashWork() {
    if (flashWork.busy || !S.leader) return;
    flashWork.busy = true;
    try {
      while (flashTodo.length) {
        const key = flashTodo.shift(), it = S.items.get(key);
        if (!it || it.kind !== 'v' || it.fl != null) continue;
        let fl = 2; // a failed check is not a calm clip: it stays dimmed
        try {
          const rec = await bytesOf(key);
          if (!rec || !rec.d) fl = null; // not downloaded yet: checked when it is (ingest, restore)
          else if (window.EM && window.EM.video && window.EM.video.flashScore) fl = (await window.EM.video.flashScore(new Blob([rec.d], { type: sniff(rec.d) }), { maxMs: 16000 })).flashy ? 1 : 0;
        } catch (e) { fl = 2; }
        if (fl === null) { await sleep(500); continue; }
        const cur = S.items.get(key);
        if (cur) { cur.fl = fl; post({ t: 'items', items: [cur] }); saveSoon(); }
        await sleep(500);
      }
    } finally { flashWork.busy = false; }
  }

  // ==================================================================================================== sound ===
  let audio = null;
  function audioCtx() {
    try { if (!audio) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; audio = new A(); } if (audio.state === 'suspended') audio.resume().catch(noop); } catch (e) { audio = null; }
    return audio;
  }
  // Two sine partials with an ADSR envelope, volume 0.4, at most one every 5 s.
  function chime() {
    const t = Date.now();
    if (t - S.lastChime < 5000) return false;
    const ac = audioCtx();
    if (!ac || ac.state !== 'running') return false;
    S.lastChime = t;
    try {
      const c = ac.currentTime, out = ac.createGain(); out.gain.value = 0.4; out.connect(ac.destination);
      for (const [f, a] of [[880, 0.8], [1320, 0.4]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, c); g.gain.linearRampToValueAtTime(a, c + 0.02); g.gain.linearRampToValueAtTime(a * 0.55, c + 0.22);
        g.gain.setValueAtTime(a * 0.55, c + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, c + 1.7);
        o.connect(g); g.connect(out); o.start(c); o.stop(c + 1.8);
      }
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, 2200);
    } catch (e) { return false; }
    S.chimes.push(t); if (S.chimes.length > 50) S.chimes.shift();
    return true;
  }

  // ===================================================================================================== DOM bits ===
  function setText(el, s) { if (!el) return; if (!s) { if (!el.hidden) el.hidden = true; return; } if (el.textContent !== s) el.textContent = s; el.hidden = false; }
  let toastT = 0;
  function toast(s) { const el = $('wToast'); setText(el, s); clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
  function showBanner(b) {
    const el = $('wTicker'), span = $('wTickerText');
    if (!b) { if (!el.hidden) el.hidden = true; S.bannerId = null; return; }
    if (S.bannerId === b.id) return;
    S.bannerId = b.id;
    span.textContent = b.text; el.classList.add('short'); el.hidden = false;
    requestAnimationFrame(() => { el.classList.toggle('short', span.scrollWidth <= el.clientWidth - 24); });
    setText($('wLive'), b.text);
  }
  function statusLine() {
    let s = '';
    if (S.paused || Date.now() < S.quotaUntil) s = "Paused for a moment — we'll be right back";
    else if (S.offline) s = 'Offline – showing saved photos';
    setText($('wStatus'), s);
  }
  function renderPub() {
    const p = S.pub;
    if (!p) return;
    $('wHead').hidden = false;
    $('wTitle').textContent = p.t || '';
    $('wNames').textContent = p.n || ''; $('wNames').hidden = !p.n;
    document.title = p.t ? `${p.t} – Event Sky` : document.title;
    const world = (window.ES && Array.isArray(ES.WORLDS) && ES.WORLDS.includes(p.w)) ? p.w : 'golden-manor';
    $('wBg').style.backgroundImage = `url("assets/worlds/scenes/${world}.jpg")`;
    renderQr();
    const who = p.ct || 'the hosts';
    setText($('wKeep'), fillEn('Photos are kept until {0}. To remove yours, use the event page or ask {1}.', fmtDate(+p.x, p.tz), who));
    renderCount();
    buildMark();
  }
  // Approved check-ins this screen holds (not the doorbell counter, which any phone can push up).
  function renderCount() {
    let n = 0;
    for (const it of S.items.values()) if (it.kind === 'g') n++;
    setText($('wCount'), n === 1 ? '1 guest' : (n ? fillEn('{0} guests', n) : ''));
  }
  let qrFor = '';
  function renderQr() {
    const box = $('wQr');
    if (!S.pub || !S.code) { box.hidden = true; return; }
    const url = ES.urls.guest(S.code, { lang: S.pub.l && S.pub.l !== 'en' ? S.pub.l : undefined });
    if (qrFor !== url) { try { ES.QR.draw($('wQrCanvas'), url, 6); qrFor = url; } catch (e) { warn('qr', e); } }
    $('wCode').textContent = fillEn('Code {0}', S.code);
    box.className = `w-qr ${QP.includes(S.wall.qp) ? S.wall.qp : 'br'} ${QS.includes(S.wall.qs) ? S.wall.qs : 'm'}`;
    box.hidden = !!S.wall.qh;
  }

  // ================================================================================================ wall settings ===
  function applyWall(w) {
    if (!w || typeof w !== 'object') return;
    const prev = JSON.stringify(S.wall);
    const n = Object.assign({}, S.wall);
    if (MODES.includes(w.md)) n.md = w.md;
    if (QS.includes(w.qs)) n.qs = w.qs;
    if (QP.includes(w.qp)) n.qp = w.qp;
    if (typeof w.qh === 'boolean') n.qh = w.qh;
    if (typeof w.snd === 'boolean') n.snd = w.snd;
    if (Number.isFinite(+w.t0) && +w.t0 > 0) n.t0 = +w.t0;
    if (Number.isFinite(+w.sl) && +w.sl >= 3000 && +w.sl <= 15000) n.sl = +w.sl;
    if (w.fl === 'dim' || w.fl === 'skip') n.fl = w.fl;
    S.wall = n;
    if (JSON.stringify(n) === prev) return;
    S.sound = !!n.snd;
    if (S.sound) audioCtx();
    const b = $('wBtnSound'); if (b) b.setAttribute('aria-pressed', String(S.sound));
    renderQr(); buildMark(); bump();
  }
  function setWall(patch, say) {
    applyWall(Object.assign({}, S.wall, patch));
    if (say) toast(say);
    post({ t: 'wall', wall: S.wall });
    saveSoon();
    if (S.linked && S.code) ES.live.set(S.code, { wall: patch }).catch((e) => warn('settings', e));
  }
  function nextMode(d) { const i = MODES.indexOf(S.wall.md); const md = MODES[(i + (d || 1) + MODES.length) % MODES.length]; setWall({ md }, MODE_NAMES[md]); }
  function setMode(md) { if (MODES.includes(md)) setWall({ md }, MODE_NAMES[md]); return S.wall.md; }
  function cycleSize(d) {
    const i = QS.indexOf(S.wall.qs);
    const j = d === 0 ? (i + 1) % QS.length : clamp(i + d, 0, QS.length - 1);
    setWall({ qs: QS[j], qh: false });
  }
  function cycleCorner() { const i = QP.indexOf(S.wall.qp); setWall({ qp: QP[(i + 1) % QP.length], qh: false }); }
  function toggleQr() { const qh = !S.wall.qh; setWall({ qh }, qh ? 'QR code hidden' : 'QR code shown'); return !qh; }
  // ---------- background music (the main screen only, so mirrored screens don't play it twice) ----------
  // The occasion's tune (event-cine.js: Happy Birthday for a birthday, else the celebration tune) loops by default; the
  // Song button plays a song from this device instead (kept until the page reloads). Louder in the finale. A browser
  // allows sound only after a tap: until then a "Tap for music" chip shows. The choice is kept per event on this device.
  const MU = { on: true, file: null, name: '', src: null, gain: null, loopBuf: null, loopKind: '', busy: false, asked: false };
  const muKey = () => `luts:es-wall-music:${S.code}`;
  function musicPref() { try { const v = JSON.parse(localStorage.getItem(muKey()) || 'null'); if (v && typeof v.on === 'boolean') MU.on = v.on; } catch (e) { /* defaults */ } }
  function musicSave() { try { localStorage.setItem(muKey(), JSON.stringify({ on: MU.on })); } catch (e) { /* storage full */ } }
  const musicLevel = () => (finAt() && now() >= finAt() && now() < finAt() + FINALE_MS ? 0.55 : 0.3);
  function musicButtons() { const b = $('wBtnMusic'); if (b) b.setAttribute('aria-pressed', String(MU.on)); }
  async function musicStart() {
    if (S.role !== 'main' || !MU.on || MU.src || MU.busy || !S.running) return;
    const ac = audioCtx();
    if (!ac) return;
    if (ac.state !== 'running') { $('wMusicHint').hidden = false; return; }
    $('wMusicHint').hidden = true;
    MU.busy = true;
    try {
      let buf = null;
      if (MU.file) {
        try { buf = await ac.decodeAudioData(await MU.file.arrayBuffer()); } catch (e) { MU.file = null; MU.name = ''; toast('That song did not open. Try another one.'); }
      }
      if (!buf && window.ESCine && ESCine.loop) {
        const kind = (S.pub && S.pub.tp) === 'birthday' ? 'birthday' : 'tune';
        if (MU.loopKind !== kind || !MU.loopBuf) { const l = await ESCine.loop(kind); MU.loopBuf = l && l.buffer; MU.loopKind = kind; }
        buf = MU.loopBuf;
      }
      if (!buf || !MU.on || MU.src) return;
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(musicLevel(), ac.currentTime + 1.5);
      src.connect(g); g.connect(ac.destination); src.start();
      MU.src = src; MU.gain = g;
    } catch (e) { warn('music', e); } finally { MU.busy = false; }
  }
  function musicStop() {
    const s = MU.src, g = MU.gain;
    MU.src = null; MU.gain = null;
    if (!s) return;
    try { g.gain.setTargetAtTime(0, audio.currentTime, 0.25); } catch (e) { /* closed */ }
    setTimeout(() => { try { s.stop(); s.disconnect(); } catch (e) { /* stopped */ } }, 1400);
  }
  function toggleMusic() {
    MU.on = !MU.on; musicSave(); musicButtons();
    if (MU.on) { musicStart(); toast('Music on'); } else { musicStop(); $('wMusicHint').hidden = true; toast('Music off'); }
  }
  function pickSong(f) {
    if (!f) return;
    MU.file = f; MU.name = f.name.replace(/\.[^.]+$/, ''); MU.on = true; musicSave(); musicButtons();
    musicStop(); setTimeout(() => { musicStart(); }, 300);
    toast(`${tr('Now playing')}: ${MU.name}`);
  }
  function musicTick() {
    if (!MU.gain || !audio) return;
    try { MU.gain.gain.setTargetAtTime(musicLevel(), audio.currentTime, 0.6); } catch (e) { /* closed */ }
  }

  // ---------- the guests' faces along the top ----------
  // Everyone who checked in, oldest first, as round photos with their names, drifting right to left in a seamless loop
  // (two copies of the row, the track moving by one copy); still with reduced motion, or when they all fit. The newest
  // glows for a few seconds. Hidden in the finale, which writes in that part of the sky.
  let facesSig = '';
  function renderFaces(T) {
    const box = $('wFaces'), track = $('wFacesTrack');
    if (!box) return;
    const fin = finAt(), inFinale = fin && T >= fin - 500 && T < fin + FINALE_MS;
    const list = [...S.items.values()].filter((it) => it.kind === 'g' && it.st === 1 && !reportHidden(it) && it.mt0 <= T).sort((a, b) => a.mt0 - b.mt0);
    const ready = list.map((it) => { const b = bitmapNow(`t:${it.key}`); if (!b) wantBitmap(it.key, 't'); return b; });
    const newest = list.length ? list[list.length - 1] : null, glow = newest && T - newest.mt0 < 8000 ? newest.key : '';
    box.classList.toggle('away', !!inFinale);
    const sig = `${list.map((it, i) => `${it.key}:${!!ready[i]}:${it.nm || ''}`).join('|')}|${glow}`;
    if (sig === facesSig) return;
    facesSig = sig;
    box.hidden = !list.length || S.role === 'slides';
    if (box.hidden) return;
    const chip = (it, b, copy) => {
      const d = document.createElement('span'); d.className = `w-face${it.key === glow ? ' new' : ''}`;
      const Z = 256, c = document.createElement('canvas'); c.width = c.height = Z; // (sharp up to 190 CSS px on a 1.35x screen)
      const g = c.getContext('2d');
      g.beginPath(); g.arc(Z / 2, Z / 2, Z / 2 - 2, 0, Math.PI * 2); g.closePath(); g.save(); g.clip();
      if (b) { const s = Math.max(Z / (b.width || Z), Z / (b.height || Z)), w = (b.width || Z) * s, h = (b.height || Z) * s; g.drawImage(b, (Z - w) / 2, (Z - h) / 2, w, h); }
      else { g.fillStyle = '#2a1f4d'; g.fillRect(0, 0, Z, Z); g.fillStyle = '#ffe2a6'; g.font = `700 ${Z * 0.46}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Array.from(String(it.nm || '?'))[0].toUpperCase(), Z / 2, Z * 0.54); }
      g.restore();
      const n = document.createElement('span'); n.className = 'w-face-name'; n.textContent = String(it.nm || '');
      d.append(c, n);
      if (copy) d.setAttribute('aria-hidden', 'true');
      return d;
    };
    track.textContent = '';
    list.forEach((it, i) => track.append(chip(it, ready[i], false)));
    // scroll only when the row is wider than the screen: then a second copy makes the loop seamless
    requestAnimationFrame(() => {
      const wide = track.scrollWidth > box.clientWidth * 0.92;
      let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
      box.classList.toggle('moving', wide && !reduce);
      if (wide && !reduce) {
        list.forEach((it, i) => track.append(chip(it, ready[i], true)));
        track.style.setProperty('--w-faces-dur', `${Math.max(18, Math.round(track.scrollWidth / 2 / 45))}s`); // about 45 px a second
      }
    });
  }

  function toggleSound() { const snd = !S.wall.snd; if (snd) audioCtx(); setWall({ snd }, snd ? 'Arrival sound on' : 'Arrival sound off'); return snd; }
  const canLive = () => S.staffRole === 'h' || S.staffRole === 'c';
  async function finale(fromKey) {
    if (canLive()) { await ES.live.finale(S.code); markLive(); return 'live'; }
    if (fromKey) { toast('Only the hosts can start the finale'); return 'denied'; }
    S.localFin = now() + 5000; bump(); post({ t: 'local', localFin: S.localFin }); return 'local';
  }
  async function reveal(fromKey) {
    if (canLive()) { await ES.live.reveal(S.code); markLive(); return 'live'; }
    if (fromKey) { toast('Only the hosts can reveal the photos'); return 'denied'; }
    S.localRev = now(); bump(); post({ t: 'local', localRev: S.localRev }); return 'local';
  }
  function markLive() { dirty.live = true; dirty.media = 'now'; schedSync(); }

  // =========================================================================================== network (leader) ===
  const dirty = { pub: false, live: false, media: false, guests: false, reports: false, key: false };
  let watcher = null, syncTimer = 0, packer = null, galleryKey = '';
  function onBell(changed, b, info) {
    S.bell = b || {}; renderCount();
    post({ t: 'bell', bell: S.bell });
    S.offline = false;
    const first = info && info.first;
    if (first) { Object.assign(dirty, { pub: true, live: true, media: 'now', guests: 'now', reports: true, key: !!packer }); }
    const ap = !!(S.pub && S.pub.ap);
    for (const k of changed) {
      if (k === 'o' || k === 'g' || k === 'e') { dirty.media = 'now'; }
      if (k === 'g' || k === 'e' || (k === 'a' && !ap)) dirty.guests = 'now';
      if (k === 'q' && !dirty.media) dirty.media = 'lazy'; // a photographer's photos are shown at once even on approval events
      if (k === 'r') dirty.reports = true;
      if (k === 's') { dirty.pub = true; dirty.key = !!packer; }
      if (k === 'l' || k === 'w') dirty.live = true;
    }
    schedSync();
  }
  function schedSync(delay) {
    if (!S.leader) return;
    clearTimeout(syncTimer);
    const t = Date.now();
    let wait = delay || 0;
    if (t < S.quotaUntil) wait = Math.max(wait, S.quotaUntil - t);
    if (S.level === 2) wait = Math.max(wait, S.lastSync + 30e3 - t); // governor level 2: arrivals in batches every 30 s
    if (S.paused) wait = Math.max(wait, S.lastSync + 60e3 - t);      // es_cfg.pause: the cached slideshow, a look a minute
    const urgent = dirty.pub || dirty.live || dirty.media === 'now' || dirty.guests === 'now' || dirty.reports || dirty.key;
    if (!urgent && (dirty.media === 'lazy' || dirty.guests === 'lazy')) wait = Math.max(wait, S.lastSync + TUNE.lazyGap - t);
    else wait = Math.max(wait, S.lastSync + TUNE.syncGap - t);
    syncTimer = setTimeout(sync, Math.max(0, wait));
  }
  let syncing = null;
  async function sync() {
    if (syncing) { S.resync = true; return syncing; }
    syncing = (async () => {
      const code = S.code;
      S.lastSync = Date.now(); S.syncs++;
      try {
        if (dirty.pub) { const p = await ES.pub.get(code); dirty.pub = false; if (p) setPub(p); else if (S.linked) S.pubMissing = true; }
        if (dirty.live) { const l = await ES.live.get(code); dirty.live = false; setLive(l); }
        if (dirty.key && packer) {
          const k = await ES.gallery.key.get(code); dirty.key = false;
          if (k && k !== galleryKey) { galleryKey = k; try { packer.setKey(k); } catch (e) { warn('packer key', e); } }
        }
        if (dirty.media) { const was = dirty.media; dirty.media = false; try { await pull('media'); } catch (e) { dirty.media = was; throw e; } }
        if (dirty.guests) { const was = dirty.guests; dirty.guests = false; try { await pull('guests'); } catch (e) { dirty.guests = was; throw e; } }
        if (dirty.reports) { // reports only hide items; a failure here never holds up the photos
          try { await pullReports(); dirty.reports = false; } catch (e) { if (e && e.code === 'DENIED') dirty.reports = false; else throw e; }
        }
        if (S.quotaUntil) { S.quotaUntil = 0; ES.gov.refresh().catch(noop); bump(); }
        S.offline = false;
        postNet();
      } catch (e) { onNetError(e); }
    })().finally(() => { syncing = null; if (S.resync) { S.resync = false; schedSync(); } });
    return syncing;
  }
  function onNetError(e) {
    const c = e && e.code;
    if (c === 'QUOTA') {
      S.quotaUntil = Date.now() + TUNE.quotaBackoff; bump(); schedSync(TUNE.quotaBackoff + 50);
      // ES holds governor level 3 for 60 s after a 429 (and the doorbell at 60 s): ask it again once that has passed.
      clearTimeout(S.govT); S.govT = setTimeout(() => { ES.gov.refresh().then(() => postNet()).catch(noop); }, 61e3);
    }
    else if (c === 'OFFLINE') { S.offline = true; schedSync(15e3); }
    else if (c === 'DENIED') { if (!S.items.size && !S.everSynced) notLinked(); else schedSync(60e3); }
    else { warn('sync', e); schedSync(10e3); }
    postNet();
  }
  function postNet() { S.level = ES.gov.state().level; S.paused = !!ES.cfg.cached().pause; post({ t: 'net', offline: S.offline, quotaUntil: S.quotaUntil, level: S.level, paused: S.paused, offset: ES.clock.offset() }); }
  async function pull(coll) {
    const api = coll === 'media' ? ES.media : ES.guests;
    for (let guard = 0; guard < 500; guard++) {
      const r = await api.changes(S.code, { cursor: S.cursors[coll], st: [1, 2, 3], select: SEL[coll], limit: LIMIT[coll] });
      const upd = [], gone = [];
      for (const d of r.items) {
        const res = await ingest(coll, d);
        if (res === 'gone') gone.push(keyOf(coll, d._id)); else if (res) upd.push(res);
      }
      S.cursors[coll] = r.cursor || S.cursors[coll];
      S.everSynced = true;
      if (upd.length) post({ t: 'items', items: upd });
      if (gone.length) post({ t: 'gone', keys: gone });
      if (upd.length || gone.length) { bump(); saveSoon(); notifyPacker(); }
      if (r.items.length < LIMIT[coll]) break;
    }
  }
  const keyOf = (coll, id) => `${coll === 'guests' ? 'g' : 'm'}:${id}`;
  async function ingest(coll, d) {
    const key = keyOf(coll, d._id), mt = +d.mt || 0;
    const g = S.gone.get(key);
    if (g && g.mt >= mt) return null;                           // an older copy of something already removed
    if (d.st !== 1) { removeItem(key, mt, d.st === 3 ? 3 : 2); return 'gone'; }
    if (d.xp && +d.xp < now() && !d.hl) { removeItem(key, mt, 4); return 'gone'; } // past its full-size window
    S.gone.delete(key);
    const prev = S.items.get(key);
    const it = {
      key, coll, id: String(d._id), kind: coll === 'guests' ? 'g' : (d.kd === 'v' ? 'v' : 'p'),
      s: coll === 'guests' ? (+d._id) : (Number.isInteger(d.s) ? d.s : -1), k: +d.k || 0, fn: String(d.fn || ''), m: String(d.m || ''), cp: String(d.cp || ''),
      w: +d.w || 0, h: +d.h || 0, du: +d.du || 0, mt, mt0: prev && prev.mt0 ? prev.mt0 : mt, at: +d.at || mt, st: 1, rv: +d.rv || 0, hl: !!d.hl, xp: +d.xp || 0,
      by: String(d.by || ''), nm: coll === 'guests' ? String(d.nm || '') : '', wi: coll === 'guests' ? String(d.wi || '') : '', fl: prev ? prev.fl : null,
      dp: !!((prev && prev.dp) || (coll === 'media' && +d.rv > 0 && +d.rv > (+d.at || mt))),
      hasD: false, hasT: false,
    };
    const rec = coll === 'guests' ? { d: d.im, t: d.im } : { d: d.d, t: d.t };
    it.hasD = !!(rec.d && rec.d.length); it.hasT = !!(rec.t && rec.t.length);
    if (it.hasD || it.hasT) await putBytes(key, rec);
    if (prev) { if (prev.hasD && !it.hasD) it.hasD = prev.hasD; if (prev.hasT && !it.hasT) it.hasT = prev.hasT; }
    S.items.set(key, it);
    if (coll === 'guests') { if (it.nm) S.names.set(it.s, it.nm); }
    if (!S.firstSeen.has(key)) S.firstSeen.set(key, now());
    if (it.kind === 'v' && it.fl == null) queueFlash(key);
    if (prev) { dropBitmaps(key); clearCell(key); } // a changed copy (a purge, a re-show): draw it afresh
    return it;
  }
  function removeItem(key, mt, st) {
    S.gone.set(key, { mt: mt || now(), st: st === 3 || st === 4 ? st : 2 }); // 4: expired here, still in the gallery
    if (S.gone.size > 4000) S.gone.delete(S.gone.keys().next().value);
    const it = S.items.get(key);
    if (it && it.coll === 'guests') S.names.delete(it.s);
    S.items.delete(key);
    dropBitmaps(key); clearCell(key);
    if (stage) removeActsWith(key);
    if (VID.key === key) stopVideo();
    if (S.leader) delBytes(key);
    S.firstSeen.delete(key);
    bump();
  }
  async function pullReports() {
    const docs = await ES.fs.query(`events/${S.code}`, { from: 'reports', where: [['n', '>=', 3]], select: ['n', 'at'], limit: 300, auth: true });
    S.reports = new Map(docs.map((d) => [d._id, { n: +d.n || 0, at: +d.at || 0 }]));
    post({ t: 'reports', reports: [...S.reports] }); bump(); saveSoon();
    hideReported();
  }
  // Three reports hide a photo here until a moderator decides (§4.12): every act showing it leaves the stage now.
  function hideReported() {
    if (!stage) return;
    for (const it of S.items.values()) if (reportHidden(it)) { removeActsWith(it.key); if (VID.key === it.key) stopVideo(); }
  }
  function setPub(p) {
    const prevX = S.pub && S.pub.x;
    S.pub = p; renderPub(); bump(); post({ t: 'pub', pub: p }); saveSoon();
    if (watcher && watcher.setOpensAt) watcher.setOpensAt(+p.o);
    if (prevX && prevX !== p.x && packer && packer.poke) packer.poke();
    checkEnded();
  }
  function setLive(l) {
    l = l || {};
    const ch = l.ch;
    if (ch && ch.id && ch.win && S.winSeen[ch.id] === undefined) S.winSeen[ch.id] = (S.live.ch && S.live.ch.id === ch.id) ? now() : (+ch.end || now()) - 60e3;
    if (l.fin && +l.fin.at && !(S.finSeen && S.finSeen.at === +l.fin.at)) S.finSeen = { at: +l.fin.at, seen: now() };
    S.live = l; if (l.wall) applyWall(l.wall);
    bump(); post({ t: 'live', live: l, winSeen: S.winSeen, finSeen: S.finSeen }); saveSoon();
    autoWinner();
  }
  // No winner picked by the hosts within 2 minutes: the most reactions wins, the earliest photo breaks a tie.
  async function autoWinner() {
    const ch = S.live.ch;
    if (!S.leader || !ch || !ch.id || ch.win || S.autoWin[ch.id] || autoWinner.busy) return;
    const wait = +ch.end + 120e3 - 9000 - now();
    if (wait > 0) { clearTimeout(autoWinner.t); autoWinner.t = setTimeout(autoWinner, Math.min(wait, 10 * MIN)); return; }
    if (now() > +ch.end + 120e3) return;
    autoWinner.busy = true;
    try {
      const p = plan(), sp = p.sp.find((s) => s.type === 'chmosaic' && s.id === `chm:${ch.id}`);
      if (!sp) return;
      const gi = await giMap(sp.list.map((it) => it.id));
      const rx = gi.size ? ((await ES.reactions(S.code)) || {}) : {};
      let best = null, bs = -1;
      for (const it of sp.list.slice().sort((a, b) => (a.at - b.at) || cmpStr(a.key, b.key))) {
        const g = gi.get(it.id), r = g !== undefined ? rx[g] || {} : {}, sc = (+r.h || 0) + (+r.f || 0) + (+r.w || 0) + (+r.c || 0);
        if (sc > bs) { bs = sc; best = it; }
      }
      if (best) { S.autoWin[ch.id] = best.key; bump(); post({ t: 'autowin', id: ch.id, key: best.key }); }
    } catch (e) { warn('winner', e); } finally { autoWinner.busy = false; }
  }
  // Gallery indexes for media ids: from this device's packer, else from the newest gallery pages (staff have the key).
  async function giMap(ids) {
    const out = new Map(), want = new Set(ids);
    if (packer && packer.giOf) { for (const id of ids) { const g = packer.giOf(id); if (g !== undefined && g !== null) out.set(id, g); } if (out.size) return out; }
    try {
      const m = await ES.gallery.manifest(S.code, { maxAge: 30e3 });
      if (!m || !m.pc) return out;
      const key = ES.b64u.dec(galleryKey || await ES.gallery.key.get(S.code));
      for (let n = m.pc - 1; n >= Math.max(0, m.pc - 3) && want.size; n--) {
        const items = await ES.gallery.page(S.code, n, key, { vr: m.vr });
        for (const x of items) if (want.has(x.id)) { out.set(x.id, x.gi); want.delete(x.id); }
      }
    } catch (e) { warn('gallery index', e); }
    return out;
  }
  function checkEnded() {
    if (!S.pub || S.ended) return false;
    if (now() <= +S.pub.x) return false;
    S.ended = true;
    endShow();
    purgeCache().catch(noop);
    card({ title: S.pub.t || '', text: fillEn('This event has ended. Photos were kept until {0}.', fmtDate(+S.pub.x, S.pub.tz)) });
    return true;
  }

  // ============================================================================================ state in IndexedDB ===
  // At most one save every 10 s, and only when something changed (an 8 h night of arrivals must not write constantly).
  let saveT = 0;
  function saveSoon() {
    if (!S.leader) return;
    S.saveDirty = true;
    if (!saveT) saveT = setTimeout(() => { saveT = 0; if (S.saveDirty) saveState().catch(noop); }, TUNE.saveEvery);
  }
  function snapshot() {
    return {
      v: 1, code: S.code, at: Date.now(), cursors: S.cursors, items: [...S.items.values()].map(meta), gone: [...S.gone].slice(-1500),
      names: [...S.names], reports: [...S.reports], wall: S.wall, pub: S.pub, live: S.live, bell: S.bell, winSeen: S.winSeen, autoWin: S.autoWin,
      staffRole: S.staffRole, offset: now() - Date.now(), offline: S.offline, quotaUntil: S.quotaUntil, level: S.level, paused: S.paused,
    };
  }
  function meta(it) { const o = {}; for (const k of Object.keys(it)) if (k[0] !== '_') o[k] = it[k]; return o; }
  async function saveState() { if (!S.code || S.ended) return; S.saveDirty = false; await ES.idb.put('cursors', `wall/${S.code}`, snapshot()); }
  function absorb(s, all) {
    if (!s || s.code !== S.code) return false;
    if (s.cursors) S.cursors = s.cursors;
    if (Array.isArray(s.items)) {
      S.items = new Map(s.items.filter((it) => it && it.key).map((it) => [it.key, Object.assign({}, it)]));
      for (const it of S.items.values()) if (it.kind === 'v' && it.fl == null) queueFlash(it.key); // restored before its check ran
    }
    if (Array.isArray(s.gone)) S.gone = new Map(s.gone.map(([k, v]) => [k, typeof v === 'number' ? { mt: v, st: 2 } : v]));
    if (Array.isArray(s.names)) S.names = new Map(s.names);
    if (Array.isArray(s.reports)) S.reports = new Map(s.reports);
    if (s.wall) applyWall(s.wall);
    if (s.winSeen) S.winSeen = Object.assign({}, s.winSeen, S.winSeen);
    if (s.autoWin) S.autoWin = Object.assign({}, s.autoWin, S.autoWin);
    if (all) {
      if (s.pub) { S.pub = s.pub; renderPub(); }
      if (s.live) S.live = s.live;
      if (s.bell) { S.bell = s.bell; renderCount(); }
      if (s.staffRole) S.staffRole = s.staffRole;
      if (Number.isFinite(+s.offset)) S.offset = +s.offset;
      S.offline = !!s.offline; S.quotaUntil = +s.quotaUntil || 0; S.level = +s.level || 0; S.paused = !!s.paused;
    }
    bump();
    return true;
  }
  async function restoreState(all) {
    try { const s = await ES.idb.get('cursors', `wall/${S.code}`); return absorb(s, all); } catch (e) { return false; }
  }
  async function purgeCache() {
    try { for (const x of await ES.idb.list('blobs', `${S.code}/w/`)) await ES.idb.del('blobs', x.key); } catch (e) { /* best effort */ }
    try { await ES.idb.del('cursors', `wall/${S.code}`); } catch (e) { /* best effort */ }
  }

  // =================================================================== two windows on one machine (BroadcastChannel) ===
  let bc = null;
  function post(m) { if (bc && S.leader) { try { bc.postMessage(m); } catch (e) { /* closed */ } } }
  function onMessage(ev) {
    const m = ev.data || {};
    if (m.t === 'hello') { if (S.leader) { try { bc.postMessage({ t: 'snap', snap: snapshot() }); } catch (e) { /* closed */ } } return; }
    if (S.leader) { if (m.t === 'wallset' && m.patch) setWall(m.patch); return; }
    switch (m.t) {
      case 'snap': absorb(m.snap, true); S.gotSnap = true; startShow(); break;
      case 'items': for (const it of m.items || []) { const prev = S.items.get(it.key); S.items.set(it.key, Object.assign({}, it)); if (it.coll === 'guests' && it.nm) S.names.set(it.s, it.nm); if (!S.firstSeen.has(it.key)) S.firstSeen.set(it.key, now()); if (prev && prev.mt !== it.mt) { dropBitmaps(it.key); clearCell(it.key); recent.delete(it.key); } } bump(); break;
      case 'gone': for (const k of m.keys || []) removeItem(k, now()); break;
      case 'pub': S.pub = m.pub; renderPub(); bump(); checkEnded(); break;
      case 'live': S.live = m.live || {}; if (m.winSeen) S.winSeen = m.winSeen; if (m.finSeen) S.finSeen = m.finSeen; if (S.live.wall) applyWall(S.live.wall); bump(); break;
      case 'wall': applyWall(m.wall); break;
      case 'bell': S.bell = m.bell || {}; renderCount(); break;
      case 'reports': S.reports = new Map(m.reports || []); bump(); hideReported(); break;
      case 'net': S.offline = !!m.offline; S.quotaUntil = +m.quotaUntil || 0; S.level = +m.level || 0; S.paused = !!m.paused; if (Number.isFinite(+m.offset)) S.offset = +m.offset; bump(); break;
      case 'autowin': S.autoWin[m.id] = m.key; bump(); break;
      case 'local': if (m.localFin) S.localFin = m.localFin; if (m.localRev) S.localRev = m.localRev; bump(); break;
      default: break;
    }
  }
  // Resolves true when this window holds the network (the Web Lock), false when another window does.
  function elect() {
    const name = `es-wall-fetch-${S.code}`;
    if (!(navigator.locks && typeof navigator.locks.request === 'function') || typeof BroadcastChannel === 'undefined') return Promise.resolve(true);
    try { bc = new BroadcastChannel(`es-wall-${S.code}`); bc.onmessage = onMessage; } catch (e) { return Promise.resolve(true); }
    return new Promise((resolve) => {
      navigator.locks.request(name, { ifAvailable: true }, (lock) => {
        if (!lock) { resolve(false); return undefined; }
        resolve(true);
        return new Promise((release) => { S.releaseLead = release; });
      }).catch(() => resolve(true));
    });
  }
  function waitForLead() {
    navigator.locks.request(`es-wall-fetch-${S.code}`, () => {
      if (S.ended) return undefined;
      becomeLeader().catch((e) => warn('lead', e));
      return new Promise((release) => { S.releaseLead = release; });
    }).catch(noop);
  }

  // ===================================================================================================== boot ===
  async function boot() {
    wireUi();
    if (!window.ES || !window.EFX) { card({ title: 'Something went wrong. Try again.', retry: true }); return; }
    if (P.get('host') === '1') { const c = ES.events.normCode(P.get('e') || ''); location.replace(`event-host.html${ES.CODE_RE.test(c) ? `?e=${c}` : ''}`); return; }
    if (P.get('pair') === '1') { pairing(); return; }
    const code = ES.events.normCode(P.get('e') || '');
    if (!ES.CODE_RE.test(code)) { codeEntry(''); return; }
    S.code = code; S.seed = code; musicPref(); musicButtons();
    const j = P.get('j');
    if (j) {
      stripParam('j');
      const dot = j.indexOf('.'), role = dot > 0 ? j.slice(0, dot) : 'w', secret = dot > 0 ? j.slice(dot + 1) : '';
      try { await ES.roles.join(code, role, secret); } catch (e) {
        if (e && e.code === 'OFFLINE') { card({ title: 'No connection. Trying again…', retry: true }); return; }
        card({ title: 'This invite link no longer works. Ask the hosts for a new one.', pair: true }); return;
      }
    }
    atlasReset();
    const lead = await elect();
    if (!lead) {
      // Another window of this browser already shows this event: take everything from it, ask for nothing.
      S.leader = false;
      await restoreState(true);
      if (S.pub) renderPub();
      try { bc.postMessage({ t: 'hello' }); } catch (e) { /* closed */ }
      setTimeout(() => { if (!S.running && S.pub) startShow(); }, 2500);
      waitForLead();
      return;
    }
    await becomeLeader();
  }
  async function becomeLeader() {
    if (S.leader && S.netStarted) return;
    S.leader = true;
    const code = S.code;
    const had = S.gotSnap ? true : await restoreState(!S.pub);
    let pub = null;
    try { pub = await ES.pub.get(code); } catch (e) {
      if (!(e && e.code === 'OFFLINE')) warn('pub', e);
      if (!S.pub) { card({ title: 'No connection. Trying again…', retry: true }); setTimeout(() => location.reload(), 30e3); return; }
      S.offline = true;
    }
    if (pub) S.pub = pub;
    if (!S.pub) { codeEntry('We couldn\'t find this event. Check the code on the card.'); return; }
    renderPub();
    if (checkEnded()) return;
    if (!ES.staff.uid()) { notLinked(); return; }
    try {
      const ev = await ES.events.get(code), uid = ES.staff.uid();
      S.uid = uid; S.staffRole = ev.host === uid ? 'h' : ((ev.roles || {})[uid] || null);
    } catch (e) { if (e && e.code === 'DENIED') S.staffRole = null; else if (!had) warn('event', e); }
    if (!S.staffRole || !['h', 'c', 'm', 'w'].includes(S.staffRole)) { if (!(S.offline && had && S.staffRole)) { notLinked(); return; } }
    // After the role check: the server-time probe (es/{code}/sync/{uid}) is refused for anyone outside the team, so an
    // account that is not linked to this event (Sky Duel shares luts:fb) would only log a 401.
    await ES.clock.sync(code).catch(noop);
    S.linked = true;
    hideCard();
    S.netStarted = true;
    startShow();
    watcher = ES.bell.watch(code, { mode: 'wall', opensAt: +S.pub.o, onChange: onBell,
      onError: (e) => { if (e && e.code === 'OFFLINE') { S.offline = true; postNet(); } else if (e && e.code === 'QUOTA') onNetError(e); },
      onGov: (lvl) => { S.level = lvl; postNet(); bump(); } });
    window.addEventListener('es:gov', (e) => { S.level = (e.detail && e.detail.level) || 0; S.paused = !!ES.cfg.cached().pause; bump(); });
    window.addEventListener('online', () => { if (watcher) watcher.poke(); });
    startPacker().catch((e) => warn('packer', e));
    try { bc && bc.postMessage({ t: 'snap', snap: snapshot() }); } catch (e) { /* closed */ }
    setInterval(() => { ES.staff.token().catch(noop); }, 45 * MIN);                                  // keep the sign-in fresh
    setInterval(() => { ES.clock.sync(code).then(() => postNet()).catch(noop); }, 30 * MIN);        // clocks drift
  }
  async function startPacker() {
    if (!window.ESPacker || !['h', 'c', 'w'].includes(S.staffRole)) return;
    try { galleryKey = await ES.gallery.key.get(S.code); } catch (e) { warn('gallery key', e); return; }
    packer = window.ESPacker.start(S.code, { key: galleryKey, prio: S.role === 'main' ? 'main' : 'wall', wallCache: cacheApi });
  }
  const cacheSubs = new Set();
  function notifyPacker() { for (const f of cacheSubs) { try { f(); } catch (e) { /* the packer's */ } } }
  // What the packer reads from this wall: items it can index, thumbnails, names, and when each shows on screen.
  const cacheApi = {
    items() {
      const out = [];
      for (const it of S.items.values()) out.push({ coll: it.coll, id: it.id, s: it.s, k: it.k, kd: it.kind === 'g' ? '' : it.kind, fn: it.fn, m: it.m, cp: it.cp, w: it.w, h: it.h, du: it.du, mt: it.mt, at: it.at, st: 1, rv: it.rv, hl: it.hl, xp: it.xp, by: it.by, nm: it.nm });
      for (const [key, g] of S.gone) { if (g.st === 4) continue; const c = key[0] === 'g' ? 'guests' : 'media'; out.push({ coll: c, id: key.slice(2), st: g.st, mt: g.mt, s: c === 'guests' ? +key.slice(2) : (/^\d+-/.test(key.slice(2)) ? +key.slice(2).split('-')[0] : -1), k: c === 'media' ? +(key.slice(2).split('-')[1] || 0) : 0 }); }
      return out;
    },
    async thumb(coll, id) { const r = await bytesOf(keyOf(coll, id)); return (r && r.t && isImage(r.t)) ? r.t : null; },
    name: (seat) => nameOf(seat),
    showAt(coll, id) {
      const p = plan(), key = keyOf(coll, id), s = p.slotOf.get(key);
      if (s !== undefined) return p.t0 + s * L;
      const it = S.items.get(key);
      return it && it._join ? it._join : null;
    },
    pub: () => S.pub,
    on(f) { cacheSubs.add(f); return () => cacheSubs.delete(f); },
  };

  // ======================================================================================================= show ===
  function startShow() {
    if (S.running || S.ended || !S.pub) return;
    S.running = true;
    hideCard();
    renderPub();
    makeStage();
    buildMark();
    const fontsReady = (window.EFX.ready ? window.EFX.ready() : Promise.resolve()).catch(noop);
    const markReady = (window.EM && window.EM.mark && window.EM.mark.ready ? window.EM.mark.ready() : Promise.resolve()).catch(noop);
    Promise.all([fontsReady, markReady]).then(() => { buildMark(); });
    fontsReady.then(() => { if (S.running) startFrames(); });
    setTimeout(() => { if (S.running && !S.frames) startFrames(); }, 3000); // fonts slow: draw anyway
    clearInterval(S.dirT); S.dirT = setInterval(() => { try { director(); } catch (e) { S.errors++; if (S.errors < 8) warn('director', e); } }, 250);
    clearInterval(S.houseT); S.houseT = setInterval(housekeeping, 30e3);
    clearInterval(S.dogT); S.dogT = setInterval(watchdog, 2000);
    S.lastSoft = Date.now();
    wake();
  }
  function endShow() {
    S.running = false;
    clearInterval(S.dirT); clearInterval(S.houseT); clearInterval(S.dogT);
    cancelAnimationFrame(raf);
    stopVideo();
    if (watcher) { watcher.stop(); watcher = null; }
    if (packer) { try { packer.stop(); } catch (e) { /* stopped */ } packer = null; }
    if (stage) { stage.dispose(); stage = null; }
    closeAllBitmaps();
    if (S.releaseLead) S.releaseLead();
  }
  function housekeeping() {
    if (!stage) return;
    const T = now();
    try { stage.clearBefore(T - 60e3); } catch (e) { warn('clear', e); }
    for (const [id, a] of ACTS) if (a.end < T - 60e3) ACTS.delete(id);
    lanePrune(T - 60e3);
    // Full-size copies past their window leave this screen too (the server deletes them at xp).
    for (const it of [...S.items.values()]) if (it.xp && it.xp < T && !it.hl) removeItem(it.key, T, 4);
    trimBitmaps();
    if (checkEnded()) return;
    if (S.leader && S.saveDirty) saveState().catch(noop);
    // A soft reload every 3 h, when no entrance is on screen.
    if (Date.now() - S.lastSoft >= TUNE.softEvery && !entranceOn(T)) softReload('timer');
  }
  function entranceOn(T) { for (const a of ACTS.values()) if (a.type === 'rv' && a.t - 500 <= T && T < a.end) return true; return false; }
  // No frame for 10 s while visible: rebuild the stage from the cache; if that does not help, reload the page.
  function watchdog() {
    if (!S.running || document.hidden) { S.lastFrameAt = Date.now(); return; }
    if (Date.now() - S.lastFrameAt <= TUNE.watchdog) return;
    S.watchdogFires++;
    if (S.lastDog && Date.now() - S.lastDog < TUNE.watchdog * 4) { S.hardReloads++; saveState().catch(noop).then(() => location.reload()); return; }
    S.lastDog = Date.now();
    softReload('watchdog');
  }
  // Drops everything drawn (stage, pictures, atlas) and rebuilds it from the state saved in IndexedDB.
  async function softReload(why) {
    if (!S.running || softReload.busy) return;
    softReload.busy = true;
    try {
      S.softReloads++; S.lastSoft = Date.now(); S.lastSoftWhy = why; S.softBy[why] = (S.softBy[why] || 0) + 1;
      cancelAnimationFrame(raf);
      stopVideo();
      if (stage) { stage.dispose(); stage = null; }
      ACTS.clear(); LANES.slot.clear(); LANES.ss.clear(); closeAllBitmaps(); recent.clear(); atlasReset();
      // The window that owns the data saves and reads it back; another window keeps what its leader sent it.
      if (S.leader) { await saveState().catch(noop); await restoreState(false); }
      makeStage(); buildMark(); bump();
      startFrames();
    } finally { softReload.busy = false; }
  }
  async function wake() {
    try { if (navigator.wakeLock && !document.hidden && (!S.wl || S.wl.released)) S.wl = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed here */ }
    try { if (window.LUTSAndroid && typeof window.LUTSAndroid.keepAwake === 'function') window.LUTSAndroid.keepAwake(true); } catch (e) { /* old app */ }
  }

  // ======================================================================================================= cards ===
  function card(o) {
    const c = $('wCard');
    setText($('wCardTitle'), o.title || '');
    setText($('wCardText'), o.text || '');
    setText($('wCardSmall'), o.small || '');
    $('wPin').hidden = true; $('wPinWait').hidden = true;
    $('wCodeForm').hidden = !o.form;
    $('wCardPair').hidden = !o.pair;
    $('wCardRetry').hidden = !o.retry;
    c.hidden = false;
    const f = o.form ? $('wCodeInput') : (o.pair ? $('wCardPair') : (o.retry ? $('wCardRetry') : null));
    if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) { /* none */ } }, 50);
  }
  function hideCard() { $('wCard').hidden = true; }
  function notLinked() {
    S.linked = false;
    if (watcher) { watcher.stop(); watcher = null; }
    card({ title: "This screen isn't linked to this event", text: 'Open the big screen from the event console (Screens → Open on another screen), or pair this screen with a PIN.', pair: true });
  }
  function codeEntry(err) {
    card({ title: 'Enter the event code', text: "It's the 6 letters and numbers under the QR code.", form: true, pair: true });
    setText($('wCodeErr'), err || '');
  }
  async function pairing() {
    card({ title: 'Show an event on this TV', text: 'On your phone, open Event Sky → your event → Screens → Pair a TV, and enter:' });
    const pin = $('wPin'), waitEl = $('wPinWait'), qr = $('wPinQr'), ask = $('wPairAsk');
    // The code as text (ABCDE-FGHJK) and as a QR that opens the host console with it filled in.
    const show = (p, text, url) => {
      const t = String(text || (p && ES.pair.format ? ES.pair.format(p) : p) || '');
      pin.textContent = t; pin.setAttribute('aria-label', t.replace(/-/g, '').split('').join(' ')); pin.hidden = !t;
      const u = url || (p && ES.urls.pair ? ES.urls.pair(p) : '');
      if (u && qr && qr.dataset.url !== u) { try { ES.QR.draw(qr, u, 4); qr.dataset.url = u; qr.hidden = false; } catch (e) { qr.hidden = true; } }
    };
    // A host paired this TV: it shows the event only after a yes here (OK on the remote), so a stray code is refused.
    const confirm = ({ code, title }) => new Promise((resolve) => {
      setText($('wPairTitle'), fill('Show “{0}” on this TV?', title || code));
      ask.hidden = false; waitEl.hidden = true;
      const done = (v) => { ask.hidden = true; waitEl.hidden = false; $('wPairYes').onclick = null; $('wPairNo').onclick = null; resolve(v); };
      $('wPairYes').onclick = () => done(true); $('wPairNo').onclick = () => done(false);
      setTimeout(() => { try { $('wPairYes').focus(); } catch (e) { /* none */ } }, 30);
    });
    try { await ES.staff.token(); } catch (e) {
      setText($('wCardSmall'), 'No connection. Trying again…'); $('wCardRetry').hidden = false;
      setTimeout(() => { if (!$('wCard').hidden) location.reload(); }, 20e3); return;
    }
    let h;
    try { h = ES.pair.show({ onPin: show, confirm }); } catch (e) { setText($('wCardSmall'), 'Something went wrong. Try again.'); $('wCardRetry').hidden = false; return; }
    S.pairing = h;
    show(h.pin, h.text, h.url); waitEl.hidden = false;
    h.ready.then((p) => show(p, h.text, h.url)).catch(noop);
    try {
      const code = await h.wait();
      const q = new URLSearchParams({ e: code, tv: '1', screen: 'main' });
      if (P.get('l')) q.set('l', P.get('l'));
      location.replace(`event-wall.html?${q.toString()}`);
    } catch (e) {
      if (e && e.code === 'CLOSED') return;
      setText($('wCardSmall'), e && e.code === 'OFFLINE' ? 'No connection. Trying again…' : 'Something went wrong. Try again.');
      $('wCardRetry').hidden = false; waitEl.hidden = true;
    }
  }
  function stripParam(name) {
    try { const u = new URL(location.href); u.searchParams.delete(name); history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch (e) { /* old browser */ }
  }
  function leave() {
    if (window.LUTSNative) { location.replace('index.html'); return; }
    if (history.length > 1) history.back(); else location.replace('index.html');
  }

  // ========================================================================================== keys, remote, touch ===
  const overlayOpen = () => !$('wHelp').hidden || !$('wCard').hidden || !$('wBar').hidden;
  function openHelp() { $('wHelp').hidden = false; hideBar(); setTimeout(() => { try { $('wHelpClose').focus(); } catch (e) { /* none */ } }, 30); }
  function closeHelp() { $('wHelp').hidden = true; }
  let barT = 0;
  function showBar() { $('wBar').hidden = false; clearTimeout(barT); barT = setTimeout(hideBar, 6000); }
  function hideBar() { $('wBar').hidden = true; clearTimeout(barT); }
  function dpad(d) {
    if (d === 'left') nextMode(-1);
    else if (d === 'right') nextMode(1);
    else if (d === 'up') cycleSize(1);
    else if (d === 'down') cycleSize(-1);
  }
  function wrapTv() {
    const T = window.LUTSTv;
    if (!T || T.__wall) return;
    const nav = T.nav, ok = T.ok;
    // TvRemote.kt calls these: on the running show the remote drives the wall; on a card it moves focus as usual.
    T.nav = (d) => { if (S.running && !overlayOpen()) { dpad(d); return 'moved'; } return nav(d); };
    T.ok = () => { if (S.running && !overlayOpen()) { toggleQr(); return 'pressed'; } return ok(); };
    T.__wall = true;
  }
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target;
    if (tgt && tgt.matches && tgt.matches('input, textarea, select')) return;
    const k = e.key;
    if (!$('wHelp').hidden) { if (k === 'Escape' || k === '?') { closeHelp(); e.preventDefault(); } return; }
    if (!$('wCard').hidden) return;
    if (!S.running) return;
    const onButton = tgt && tgt.matches && tgt.matches('button') && !$('wBar').hidden;
    switch (k) {
      case '?': openHelp(); break;
      case 'q': case 'Q': if (e.shiftKey) cycleCorner(); else cycleSize(0); break;
      case 'h': case 'H': toggleQr(); break;
      case 'm': case 'M': nextMode(1); break;
      case 'f': case 'F': finale(true).catch((x) => warn('finale', x)); break;
      case 's': case 'S': toggleSound(); break;
      case 'u': case 'U': toggleMusic(); break;
      case 'ArrowLeft': if (onButton) return; dpad('left'); break;
      case 'ArrowRight': if (onButton) return; dpad('right'); break;
      case 'ArrowUp': if (onButton) return; dpad('up'); break;
      case 'ArrowDown': if (onButton) return; dpad('down'); break;
      case 'Enter': if (onButton) return; toggleQr(); break;
      case 'Escape': hideBar(); break;
      default: return;
    }
    e.preventDefault();
  }
  function wireUi() {
    window.addEventListener('keydown', onKey);
    window.LUTSBack = () => {
      if (!$('wHelp').hidden) { closeHelp(); return true; }
      if (!$('wBar').hidden) { hideBar(); return true; }
      if (S.pairing) { try { S.pairing.cancel(); } catch (e) { /* cancelled */ } }
      leave();
      return true;
    };
    wrapTv();
    $('wTap').addEventListener('click', () => { if (S.running) { if ($('wBar').hidden) showBar(); else hideBar(); } audioCtx(); });
    $('wBtnMode').addEventListener('click', () => { nextMode(1); showBar(); });
    $('wBtnQr').addEventListener('click', () => { toggleQr(); showBar(); });
    $('wBtnSize').addEventListener('click', () => { cycleSize(0); showBar(); });
    $('wBtnSound').addEventListener('click', () => { toggleSound(); showBar(); });
    $('wBtnMusic').addEventListener('click', () => { toggleMusic(); showBar(); });
    $('wBtnSong').addEventListener('click', () => { $('wSongIn').click(); showBar(); });
    $('wSongIn').addEventListener('change', () => { const f = $('wSongIn').files && $('wSongIn').files[0]; pickSong(f); $('wSongIn').value = ''; });
    $('wMusicHint').addEventListener('click', () => { audioCtx(); setTimeout(() => { musicStart(); }, 50); });
    // the first tap or key anywhere lets the browser play sound: start the music then
    const unlock = () => { const ac = audioCtx(); if (ac && MU.on && S.role === 'main') setTimeout(() => { musicStart(); }, 50); };
    window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
    $('wBtnFull').addEventListener('click', () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(noop); } catch (e) { /* not allowed */ }
      showBar();
    });
    $('wBtnHelp').addEventListener('click', openHelp);
    $('wHelpClose').addEventListener('click', closeHelp);
    $('wCardPair').addEventListener('click', () => { const q = new URLSearchParams({ pair: '1' }); if (S.tv) q.set('tv', '1'); if (P.get('l')) q.set('l', P.get('l')); location.href = `event-wall.html?${q.toString()}`; });
    $('wCardRetry').addEventListener('click', () => location.reload());
    $('wCodeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const c = window.ES ? ES.events.normCode($('wCodeInput').value) : '';
      if (!window.ES || !ES.CODE_RE.test(c)) { setText($('wCodeErr'), "That isn't an event code."); return; }
      const q = new URLSearchParams({ e: c }); if (S.tv) q.set('tv', '1'); if (P.get('screen')) q.set('screen', P.get('screen')); if (P.get('l')) q.set('l', P.get('l'));
      location.href = `event-wall.html?${q.toString()}`;
    });
    window.addEventListener('resize', () => { if (stage) { stage.resize(); buildMark(); bump(); if (VID.key) { const it = S.items.get(VID.key); if (it) placeVideo($('wVid'), it); } } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); S.lastFrameAt = Date.now(); } });
    window.addEventListener('pagehide', () => { if (S.leader) saveState().catch(noop); });
  }

  // ================================================================================================= test hooks ===
  window.EventWall = {
    state() {
      const T = now(), a = S.running && S.pub ? at(T) : { slot: 0, kind: 'idle', current: null, special: null };
      const p = S.pub ? plan() : null;
      let queue = 0;
      if (p) for (const [s] of p.bySlot) if (p.t0 + s * L > T) queue++;
      return {
        mode: effMode(), md: S.wall.md, role: S.role, slot: a.slot, current: a.current, kind: a.kind, special: a.special, count: p ? p.items.length : 0, queue,
        qr: { s: S.wall.qs, p: S.wall.qp, h: !!S.wall.qh }, level: S.level, offset: S.leader ? ES.clock.offset() : S.offset, now: T,
        phase: p ? (T - p.t0) - a.slot * L : 0, t0: p ? p.t0 : 0, leader: S.leader, linked: S.linked, running: S.running, staffRole: S.staffRole,
        cached: S.paused || Date.now() < S.quotaUntil, offline: S.offline, paused: S.paused, quotaUntil: S.quotaUntil, sound: S.sound, chimes: S.chimes.slice(),
        bitmaps: BM.size, cells: ATLAS.cells.size, acts: ACTS.size, frames: S.frames, lastFrameAt: S.lastFrameAt, watchdog: S.watchdogFires,
        softReloads: S.softReloads, softBy: Object.assign({}, S.softBy), hardReloads: S.hardReloads, syncs: S.syncs, held: p ? p.items.filter((it) => it._disp && it._eff > T).length : 0,
        items: [...S.items.keys()], mark: !!markSprite, ended: S.ended, packer: packer && packer.state ? packer.state() : null, audio: audio ? audio.state : 'none', music: { on: MU.on, playing: !!MU.src, song: MU.name, hint: !$('wMusicHint').hidden }, faces: $('wFacesTrack') ? $('wFacesTrack').children.length : 0,
      };
    },
    get bursts() { return stage ? stage.stats().bright : []; },
    get denied() { return stage ? stage.stats().denied : 0; },
    get chimes() { return S.chimes.slice(); },
    setMode, toggleQr, nextMode, toggleSound,
    finale: () => finale(false),
    reveal: () => reveal(false),
    schedule() { const p = plan(); return [...p.slotOf.entries()].map(([key, slot]) => ({ key, slot, at: p.t0 + slot * L, mt: (S.items.get(key) || {}).mt0, seen: S.firstSeen.get(key) || null })).sort((a, b) => a.slot - b.slot); },
    at: (t) => { const a = at(t); return { slot: a.slot, kind: a.kind, current: a.current, special: a.special }; },
    specials() { return plan().sp.map((s) => ({ type: s.type, id: s.id, t: s.t, end: s.end, n: s.list ? s.list.length : undefined, item: s.item ? s.item.key : undefined })); },
    tune(o) { Object.assign(TUNE, o || {}); return Object.assign({}, TUNE); },
    softReload: () => softReload('hook'),
    stall(ms) { S.stallUntil = Date.now() + (+ms || 0); return S.stallUntil; },
    item(key) { const it = S.items.get(key); return it ? meta(it) : null; },
    flashQueue: () => flashTodo.slice(),
    _dimmed: dimmed,
    _absorb: (s, all) => absorb(s, all),
    _snapshot: () => snapshot(),
    sync: () => sync(),
    _stage: () => stage,
    _acts: () => [...ACTS.entries()].map(([id, a]) => ({ id, type: a.type, t: a.t, end: a.end, keys: a.keys })),
  };

  document.addEventListener('DOMContentLoaded', () => { boot().catch((e) => { warn('boot', e); try { card({ title: 'Something went wrong. Try again.', retry: true }); } catch (x) { /* no page */ } }); });
})();
