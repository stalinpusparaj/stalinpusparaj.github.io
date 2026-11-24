/* Event Sky gallery: window.EventGallery (event-gallery.js). Build spec research/event-sky-spec.md §3.8, §4.15, §4.21,
 * §4.23 (brand mark), §4.24 (flash safety), §4.25 (consent and deletion).
 *
 * "Photos from the evening": event-gallery.html?e=CODE#k=<key> (or #t=<linkToken>, which asks for the password).
 *  - The thumbnails come in encrypted pages of 100 (Firestore pages/{n}, AES-GCM); the key is in the #fragment and
 *    never reaches a server. Without a fragment the page uses the live key from the RTDB mirror (pub.gk, while the
 *    event is open) or the one this phone kept at check-in (luts:es-seat:<code>).
 *  - Pages load lazily (the next one only when the grid's end comes near) and are cached in IndexedDB by version, so a
 *    repeat visit reads no pages. Opening a photo reads its display copy by id (only approved, revealed photos inside
 *    their full-size window can be read). Albums: All, each function, Missions, Highlights, Photographer, My favourites.
 *  - Lightbox: Download (display size; free plans get the Light Up the Skies mark burned in), favourite (on this
 *    device), reactions 😍 🔥 😮 👏 (once each per device), Report this photo. Videos play on tap, dimmed and
 *    desaturated if the flash check finds them flashy. A ZIP of the favourites. Share the gallery.
 *  - The delete date and the full-size date are shown; an ended gallery says so.
 *  - Selfie search ("Find my photos") appears only when es_cfg.face, the plan and the event allow it and the hosts have
 *    prepared it (manifest fc > 0). Its code is bundled (face/face-search.js); only the model data (SHA-256 checked, run
 *    in a Worker) comes from cfg.faceBase.
 *  - On the host's (or a co-host's) own phone: "Keep the gallery for 7 / 30 / 90 days", within the plan.
 *  - Counters only (stt: gallery opens once a session, downloads, video plays, searches); no cookies, no identifiers.
 * Governor: level 1 serves previews only, stops video plays and pauses selfie search; level 3 pauses loading.
 * Test hooks: window.EventGallery.state(), open(gi), close(), album(id), loadMore(), refresh().
 *
 * STRINGS:
 * Photos from the evening
 * Photos from {0}
 * Loading photos…
 * Open the gallery link the hosts shared.
 * This gallery link is missing its key. Ask the hosts for the full link.
 * This gallery link no longer works. Ask the hosts for the new link.
 * This gallery has ended.
 * Could not load the photos. Check the connection and try again.
 * The gallery is resting for a moment. Try again soon.
 * Enter the password
 * Wrong password
 * Open
 * Try again
 * Photos are kept until {0}, then deleted.
 * Full-size copies are kept until {0}.
 * To have a photo removed, tap Report this photo or ask {0}.
 * To have a photo removed, tap Report this photo.
 * Albums
 * All
 * Missions
 * Highlights
 * Photographer
 * My favourites
 * No photos here yet
 * Tap ♥ on a photo to keep it here.
 * Show more photos
 * Photo from {0}
 * Video from {0}
 * Photo
 * Video
 * Photos
 * Close
 * Previous photo
 * Next photo
 * Favourite
 * Reactions
 * Love it
 * Fire
 * Wow
 * Clap
 * Download
 * Preparing…
 * Saved
 * Play video
 * Report this photo
 * It's me and I want it removed
 * It's rude or unkind
 * It shows a child who shouldn't be shown
 * Something else
 * Pick a reason
 * Send
 * Cancel
 * Thanks — the hosts will check it.
 * The full-size copy was kept until {0}.
 * Showing a small preview for now.
 * Videos play on the big screen. Here you see the first frame.
 * This video flickers, so it plays dimmed.
 * Mission: {0}
 * Share the gallery
 * Link copied
 * Download favourites (ZIP)
 * Preparing… {0}%
 * Saved to Downloads
 * This is a big download (about {0} MB). Use Wi-Fi?
 * No connection
 * Find my photos
 * Selfie search looks for your face in the event photos, on this phone only. Nothing about your face is sent or stored.
 * Take a selfie
 * Downloading the face finder (about 7 MB)…
 * Looking… {0} of {1}
 * Likely you
 * Maybe you
 * Not me
 * 1 photo
 * {0} photos
 * No photos found. Try a selfie in better light.
 * Selfie search is resting for tonight — try again tomorrow.
 * Selfie search did not start on this phone. Try another browser.
 * Keep the gallery for
 * {0} days
 * Updating the gallery…
 * Full-size photos are kept for 14 days; after that your 300 highlights stay full size and the rest stay as small previews.
 * Could not change this
 * Language
 * Phone language
 * Get it on Google Play
 */
(function () {
  'use strict';

  // ============================================================= before i18n.js: point it at the event dictionaries ===
  // This file is loaded before i18n.js (see event-gallery.html) only for these four lines; the gallery itself starts on
  // DOMContentLoaded, when event-sky.js, event-media.js and event-zip.js have loaded too. §5.2: the event pages keep
  // their own language (luts:es-lang, default 'auto' = the phone's) and never load the game's dictionaries.
  const QS = new URLSearchParams(location.search);
  const LANG_CODES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa'];
  const LANG_KEY = 'luts:es-lang';
  if (!window.LUTSLang) {
    window.LUTS_I18N_KEY = LANG_KEY;
    window.LUTS_I18N_DIR = 'i18n/event/';
    const l = String(QS.get('l') || '').toLowerCase();
    if (LANG_CODES.includes(l)) window.LUTS_I18N_LANG = l;
    try { if (!localStorage.getItem(LANG_KEY)) localStorage.setItem(LANG_KEY, 'auto'); } catch (e) { /* storage blocked */ }
  }

  // §3.0: Back closes the top sheet first; then leaves (the app's home, or the previous web page).
  window.LUTSBack = function () {
    if (closeTop()) return true;
    if (window.LUTSNative) location.replace('index.html');
    else if (history.length > 1) history.back();
    return true;
  };

  const DAY = 864e5, HOUR = 36e5;
  const FULL_LRU = 12;           // display copies kept in memory (never on disk: an erased photo must not linger)
  const SEARCH_CAP = 50;         // selfie searches per event per day (§4.21)
  const ZIP_WARN_MB = 50;
  const REACTIONS = ['h', 'f', 'w', 'c'];
  const MSG = {
    loading: 'Loading photos…',
    noCode: 'Open the gallery link the hosts shared.',
    missing: 'This gallery link is missing its key. Ask the hosts for the full link.',
    stale: 'This gallery link no longer works. Ask the hosts for the new link.',
    ended: 'This gallery has ended.',
    error: 'Could not load the photos. Check the connection and try again.',
    paused: 'The gallery is resting for a moment. Try again soon.',
    rest: 'Selfie search is resting for tonight — try again tomorrow.',
  };

  const $ = (id) => document.getElementById(id);
  const fill = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined ? m : String(a[+i])));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
  const ssGet = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } };
  const cleanText = (s, n) => (window.ES && ES.clean ? ES.clean(s, n) : String(s == null ? '' : s).slice(0, n));

  // ================================================================================================== state ===
  const S = {
    code: '', screen: 'loading', pub: null, cfg: null, man: null, key: null, keySrc: '', keyB64: '', frag: '',
    pages: new Map(),     // n -> normalised items
    pageVer: new Map(),   // n -> the page version (manifest pv[n], else vr) those items came from
    loading: new Set(),
    items: [], byGi: new Map(),
    album: 'all', favs: new Set(), rx: {}, level: 0,
    thumbs: new Map(),    // gi -> object URL (per page version)
    tiles: new Map(),     // gi -> <li>
    full: new Map(),      // media id -> {bytes, url, wm, kd, mime} (LRU)
    calm: new Map(),      // media id -> flashy verdict
    lb: { open: false, list: [], i: 0, seq: 0, opener: null },
    watch: null, io: null, hasPro: false, plays: new Set(), errors: [],
    face: { visible: false, res: null, urls: [], busy: false, runs: 0, found: [] },
    host: { visible: false, busy: false },
  };

  // ================================================================================================= helpers ===
  function pageLang() { const l = (window.LUTSLang && LUTSLang.lang) || 'en'; return LANG_CODES.includes(l) ? l : 'en'; }
  function fmtDate(ms) {
    const lang = `${pageLang()}-IN`, opts = { day: 'numeric', month: 'long', year: 'numeric' };
    const tz = S.pub && S.pub.tz ? S.pub.tz : undefined;
    try { return new Intl.DateTimeFormat(lang, Object.assign({ timeZone: tz }, opts)).format(new Date(ms)); } catch (e) {
      try { return new Intl.DateTimeFormat(lang, opts).format(new Date(ms)); } catch (x) { return new Date(ms).toDateString(); }
    }
  }
  function now() { return window.ES ? ES.clock.now() : Date.now(); }
  let toastTimer = 0;
  function toast(text, ms) {
    const el = $('gToast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 3500);
  }
  function errText(e) {
    const c = e && e.code;
    if (c === 'OFFLINE') return 'No connection';
    if (c === 'QUOTA' || c === 'PAUSED') return MSG.paused;
    if (c === 'CLOSED') return MSG.ended;
    return MSG.error;
  }
  function note(e) { S.errors.push(`${(e && e.code) || 'ERR'}: ${(e && e.message) || e}`); if (S.errors.length > 30) S.errors.shift(); }
  function setInert(on) {
    for (const el of [document.querySelector('.g-head'), $('gMain')]) {
      if (!el) continue;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    }
  }
  function fileBase() {
    const t = String((S.pub && S.pub.t) || 'event photos').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*#%]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (t || 'event photos').slice(0, 60);
  }
  const extOf = (mime) => (mime === 'video/mp4' ? '.mp4' : mime === 'video/webm' ? '.webm' : mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg');
  function mimeOf(bytes, kd) {
    let m = '';
    try { m = window.EM && EM.sniff && EM.sniff.bytes ? EM.sniff.bytes(bytes.subarray(0, 64)) : ''; } catch (e) { m = ''; }
    return m || (kd === 'v' ? 'video/mp4' : 'image/jpeg');
  }

  // ============================================================================================ gate screens ===
  function gate(kind, e) {
    if (e) note(e);
    S.screen = kind;
    const g = $('gGate');
    g.hidden = false;
    $('gGateMsg').textContent = kind === 'password' ? '' : (MSG[kind] || MSG.error);
    $('gPw').hidden = kind !== 'password';
    $('gRetry').hidden = !(kind === 'error' || kind === 'paused');
    if (kind !== 'loading' && kind !== 'password') $('gBody').hidden = true;
    if (kind === 'ended' || kind === 'missing' || kind === 'stale' || kind === 'noCode') stopWatch();
    if (kind === 'ended') { $('gKeep').textContent = ''; }
  }
  function showBody() {
    S.screen = 'grid';
    $('gGate').hidden = true;
    $('gBody').hidden = false;
  }

  // ================================================================================================== boot ===
  async function boot() {
    setupStatic();
    if (!window.ES || !window.EM) { gate('error', new Error('scripts missing')); return; }
    const code = ES.events.normCode(QS.get('e') || '');
    S.code = code;
    S.frag = location.hash || '';
    window.addEventListener('es:gov', (ev) => setLevel(ev && ev.detail ? ev.detail.level : 0));
    setLevel(ES.gov.state().level);
    if (!ES.CODE_RE.test(code)) { gate('noCode'); return; }
    S.favs = new Set((lsGet(`luts:es-fav:${code}`, []) || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0));
    gate('loading');
    let pub;
    try {
      const r = await Promise.all([ES.cfg().catch(() => ES.cfg.cached()), ES.pub.get(code)]);
      S.cfg = r[0]; pub = r[1];
    } catch (e) { gate(e && (e.code === 'QUOTA' || e.code === 'PAUSED') ? 'paused' : 'error', e); return; }
    if (!pub) { gate('ended'); return; }  // the event tree is removed once the gallery has ended
    applyPub(pub);
    if (await hasEnded(pub.x)) { gate('ended'); return; }
    hostBox().catch(note);
    await unlockFlow();
  }
  // A phone with a wrong clock must not call a live gallery ended: check the server's clock first.
  async function hasEnded(x) {
    if (!x || now() < x) return false;
    await ES.clock.sync().catch(() => {});
    return now() >= x;
  }

  function applyPub(p) {
    S.pub = p;
    p.ft = p.ft || {}; p.cap = p.cap || {}; p.fns = p.fns || []; p.ms = p.ms || [];
    const title = cleanText(p.t, 60);
    $('gTitle').textContent = title ? fill('Photos from {0}', title) : 'Photos from the evening';
    document.title = title ? `${title} · Light Up the Skies` : 'Photos from the evening';
    const names = cleanText(p.n, 40);
    $('gNames').textContent = names; $('gNames').hidden = !names || names === title;
    const logo = $('gLogo');
    if (p.logo && /^data:image\/(png|jpeg|webp);base64,/.test(p.logo)) { logo.src = p.logo; logo.hidden = false; } else { logo.removeAttribute('src'); logo.hidden = true; }
    keepLines();
  }
  function keepLines() {
    const p = S.pub, box = $('gKeep');
    box.textContent = '';
    if (!p || !p.x) return;
    const add = (text) => { const el = document.createElement('p'); el.textContent = text; box.appendChild(el); };
    add(fill('Photos are kept until {0}, then deleted.', fmtDate(p.x)));
    if (p.fu && p.fu < p.x) add(fill('Full-size copies are kept until {0}.', fmtDate(p.fu)));
    const ct = cleanText(p.ct, 80);
    add(ct ? fill('To have a photo removed, tap Report this photo or ask {0}.', ct) : 'To have a photo removed, tap Report this photo.');
  }

  // ================================================================================================ the key ===
  const SS_KEY = () => `luts:es-gk:${S.code}`;
  async function unlockFlow() {
    const p = new URLSearchParams(S.frag.replace(/^#/, ''));
    const k = p.get('k'), tok = p.get('t');
    const cands = [];
    const add = (src, b64) => { if (typeof b64 === 'string' && /^[A-Za-z0-9_-]{43}$/.test(b64) && !cands.some((c) => c.b64 === b64)) cands.push({ src, b64 }); };
    if (k) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(k)) { gate('missing'); return; }
      add('link', k);
    } else if (tok) {
      const saved = ssGet(SS_KEY());
      if (saved && saved.t === tok) add('password', saved.k);
      else { askPassword(); return; }
    } else {
      const saved = ssGet(SS_KEY());
      if (saved && !saved.t) add('session', saved.k);
      add('live', S.pub.gk);
      const seat = ES.guest.session(S.code);
      if (seat) add('seat', seat.k);
    }
    if (!cands.length) { gate('missing'); return; }
    await openWith(cands);
  }
  function askPassword() {
    gate('password');
    $('gGateMsg').textContent = '';
    $('gPwErr').hidden = true;
    setTimeout(() => { try { $('gPwIn').focus(); } catch (e) { /* hidden */ } }, 0);
  }
  async function submitPassword(ev) {
    ev.preventDefault();
    const pw = $('gPwIn').value;
    if (!pw.trim()) return;
    const btn = $('gPwGo');
    btn.disabled = true; $('gPwErr').hidden = true;
    try {
      const key = await ES.gallery.unlock(S.code, { fragment: S.frag, password: pw });
      const b64 = ES.b64u.enc(key);
      const ok = await openWith([{ src: 'password', b64 }], { fromPassword: true });
      if (ok) ssSet(SS_KEY(), { t: new URLSearchParams(S.frag.replace(/^#/, '')).get('t'), k: b64 });
    } catch (e) {
      if (e && e.code === 'DENIED') { $('gPwErr').hidden = false; $('gPwIn').select(); }
      else if (e && e.code === 'NOT_FOUND') gate('missing', e);
      else { $('gPwErr').hidden = true; toast(errText(e)); note(e); }
    } finally { btn.disabled = false; }
  }

  // Try each candidate key on the first page. A wrong key is DENIED by the page codec.
  async function openWith(cands, o = {}) {
    let man;
    try { man = await ES.gallery.manifest(S.code); } catch (e) { gate(e && e.code === 'QUOTA' ? 'paused' : 'error', e); return false; }
    if (man && man.xp && await hasEnded(man.xp)) { gate('ended'); return false; }
    S.man = man || { pc: 0, fc: 0, vr: 0, gi: 0 };
    if (!S.man.pc) { // nothing packed yet: the first candidate is taken on trust until a page arrives
      setKey(cands[0]);
      startGrid();
      return true;
    }
    for (const c of cands) {
      const key = ES.b64u.dec(c.b64);
      if (key.length !== 32) continue;
      try {
        const items = await ES.gallery.page(S.code, 0, key, pageOpts(S.man, 0));
        setKey(c);
        S.pages.set(0, normPage(items, 0)); S.pageVer.set(0, verOf(S.man, 0));
        startGrid();
        return true;
      } catch (e) {
        if (e && e.code === 'DENIED') continue; // not this key
        if (e && e.code === 'CLOSED') { gate('ended', e); return false; }
        if (o.fromPassword) throw e;
        gate(e && e.code === 'QUOTA' ? 'paused' : 'error', e);
        return false;
      }
    }
    gate(cands.some((c) => c.src === 'link' || c.src === 'password') ? 'stale' : 'missing');
    return false;
  }
  function setKey(c) {
    S.key = ES.b64u.dec(c.b64); S.keyB64 = c.b64; S.keySrc = c.src;
    if (c.src === 'link') { try { ES.guest.saveKey(S.code, c.b64); } catch (e) { /* not checked in on this phone */ } }
    if (c.src === 'live' || c.src === 'seat' || c.src === 'session') ssSet(SS_KEY(), { k: c.b64 });
  }

  // ================================================================================================= pages ===
  const ID_RE = /^[A-Za-z0-9-]{3,60}$/;
  function normPage(items, n) {
    const out = [];
    for (const it of items || []) {
      if (!it || !ID_RE.test(String(it.id || '')) || !(Number(it.gi) >= 0)) continue;
      const fuRaw = typeof it.o === 'number' && it.o > 1e12 ? it.o : (typeof it.xp === 'number' && it.xp > 1e12 ? it.xp : 0);
      out.push({
        gi: Math.round(+it.gi), id: String(it.id), kd: it.kd === 'v' ? 'v' : 'p', s: Number.isFinite(+it.s) ? Math.round(+it.s) : 0,
        nm: cleanText(it.nm, 40), fn: String(it.fn || '').slice(0, 8), m: String(it.m || '').slice(0, 8), cp: cleanText(it.cp, 80),
        w: +it.w || 0, h: +it.h || 0, at: +it.at || 0, du: +it.du || 0,
        hl: it.hl === true || it.l === true || it.l === 1, fu: fuRaw, thumb: it.thumb instanceof Blob ? it.thumb : null, page: n,
      });
    }
    return out;
  }
  function rebuild() {
    const all = [];
    for (const list of S.pages.values()) all.push(...list);
    all.sort((a, b) => a.gi - b.gi);
    S.items = all;
    S.byGi = new Map(all.map((it) => [it.gi, it]));
    S.hasPro = all.some((it) => it.s === -1);
  }
  function nextPage() {
    for (let n = 0; n < (S.man ? S.man.pc : 0); n++) if (!S.pages.has(n) && !S.loading.has(n)) return n;
    return -1;
  }
  const morePages = () => !!S.man && S.pages.size + S.loading.size < S.man.pc;
  async function loadPage(n) {
    if (!S.key || !S.man || n < 0 || n >= S.man.pc || S.pages.has(n) || S.loading.has(n)) return false;
    if (S.level >= 3) { banner(MSG.paused); return false; }
    S.loading.add(n);
    updateMore();
    try {
      const man = S.man;
      const items = await ES.gallery.page(S.code, n, S.key, pageOpts(man, n));
      dropPageUrls(n);
      S.pages.set(n, normPage(items, n)); S.pageVer.set(n, verOf(man, n));
      rebuild(); render();
      return true;
    } catch (e) {
      note(e);
      if (e && e.code === 'CLOSED') { gate('ended', e); return false; }
      if (e && e.code === 'DENIED') { gate('stale', e); return false; }
      toast(errText(e)); // the page stays unloaded: the next scroll (or Show more photos) tries again
      return false;
    } finally {
      S.loading.delete(n);
      updateMore();
      setTimeout(checkNear, 50);
    }
  }
  async function loadMore() { const n = nextPage(); if (n >= 0) return loadPage(n); return false; }
  // Load pages in order until every wanted gi is known (or there are no more pages).
  async function ensureGis(gis) {
    const want = new Set(gis);
    for (let guard = 0; guard < 120; guard++) {
      for (const g of [...want]) if (S.byGi.has(g)) want.delete(g);
      if (!want.size) return true;
      const n = nextPage();
      if (n < 0) return false;
      if (!(await loadPage(n)) && S.screen !== 'grid') return false;
    }
    return false;
  }
  function dropPageUrls(n) {
    const old = S.pages.get(n);
    if (!old) return;
    for (const it of old) {
      const u = S.thumbs.get(it.gi);
      if (u) { URL.revokeObjectURL(u); S.thumbs.delete(it.gi); }
      S.tiles.delete(it.gi);
    }
  }

  // =========================================================================================== grid and albums ===
  function startGrid() {
    showBody();
    rebuild();
    buildAlbums();
    render();
    updateTools();
    if (!S.io && 'IntersectionObserver' in window) {
      S.io = new IntersectionObserver((list) => { if (!S.loading.size && list.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '0px 0px 700px 0px' });
      S.io.observe($('gMore'));
    }
    setTimeout(checkNear, 100);
    startWatch();
    countOpen();
    loadReactions();
  }
  // The end of the grid is near the screen (a short album, or after a page arrived): fetch the next page.
  function checkNear() {
    if (S.screen !== 'grid' || !morePages() || S.loading.size) return;
    const r = $('gMore').getBoundingClientRect();
    if (r.top < innerHeight + 700) loadMore();
  }
  function msMap() { const m = new Map(); for (const x of (S.pub && S.pub.ms) || []) if (x && x.id) m.set(String(x.id), String(x.t || '')); return m; }
  function albums() {
    const tabs = [['all', 'All']];
    const fns = (S.pub.fns || []).filter((f) => f && f.id);
    if (fns.length > 1) for (const f of fns) tabs.push([`fn:${f.id}`, cleanText(f.n, 30) || f.id]);
    if ((S.pub.ms || []).length) tabs.push(['missions', 'Missions']);
    tabs.push(['hl', 'Highlights']);
    if (S.hasPro || S.album === 'pro') tabs.push(['pro', 'Photographer']);
    tabs.push(['fav', 'My favourites']);
    return tabs;
  }
  function buildAlbums() {
    const nav = $('gAlbums');
    const tabs = albums();
    const sig = tabs.map((x) => x[0]).join('|');
    if (nav.dataset.sig === sig) { for (const b of nav.children) b.setAttribute('aria-selected', String(b.dataset.album === S.album)); return; }
    nav.dataset.sig = sig;
    nav.textContent = '';
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.album = id; b.textContent = label;
      b.setAttribute('aria-selected', String(id === S.album));
      nav.appendChild(b);
    }
  }
  function filterFor(id) {
    if (id === 'all') return () => true;
    if (id.startsWith('fn:')) { const f = id.slice(3); return (it) => it.fn === f; }
    if (id === 'missions') { const ms = msMap(); return (it) => !!it.m && ms.has(it.m); }
    if (id === 'hl') return (it) => it.hl;
    if (id === 'pro') return (it) => it.s === -1;
    if (id === 'fav') return (it) => S.favs.has(it.gi);
    return () => true;
  }
  function shown() { const f = filterFor(S.album); return S.items.filter(f); }
  function setAlbum(id) {
    S.album = albums().some((x) => x[0] === id) || id === 'pro' ? id : 'all';
    buildAlbums(); render(); updateTools();
    setTimeout(checkNear, 50);
  }
  function tileFor(it) {
    let li = S.tiles.get(it.gi);
    if (!li) {
      li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'g-tile'; b.dataset.gi = String(it.gi);
      b.setAttribute('aria-label', it.nm ? fill(it.kd === 'v' ? 'Video from {0}' : 'Photo from {0}', it.nm) : (it.kd === 'v' ? 'Video' : 'Photo'));
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
      let url = S.thumbs.get(it.gi);
      if (!url && it.thumb) { url = URL.createObjectURL(it.thumb); S.thumbs.set(it.gi, url); }
      if (url) img.src = url;
      b.appendChild(img);
      if (it.kd === 'v') {
        const badge = document.createElement('span');
        badge.className = 'g-badge'; badge.setAttribute('aria-hidden', 'true');
        const s = Math.round(it.du / 1000);
        badge.textContent = `▶ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        b.appendChild(badge);
      }
      if (it.hl) { const st = document.createElement('span'); st.className = 'g-star'; st.setAttribute('aria-hidden', 'true'); st.textContent = '★'; b.appendChild(st); }
      const heart = document.createElement('span');
      heart.className = 'g-heart'; heart.setAttribute('aria-hidden', 'true'); heart.textContent = '♥';
      b.appendChild(heart);
      li.appendChild(b);
      S.tiles.set(it.gi, li);
    }
    li.querySelector('.g-heart').hidden = !S.favs.has(it.gi);
    return li;
  }
  function render() {
    if (S.screen !== 'grid') return;
    buildAlbums();
    const list = shown();
    $('gGrid').replaceChildren(...list.map(tileFor));
    const empty = $('gEmpty');
    const settled = !morePages() && !S.loading.size;
    empty.hidden = list.length > 0 || !settled;
    empty.textContent = S.album === 'fav' ? 'Tap ♥ on a photo to keep it here.' : 'No photos here yet';
    updateMore();
    if (S.lb.open) syncLbList();
  }
  function updateMore() {
    const btn = $('gMoreBtn');
    btn.hidden = !(S.screen === 'grid' && morePages());
    btn.disabled = S.loading.size > 0;
  }
  function updateTools() {
    const p = S.pub || { ft: {}, cap: {} };
    $('gZip').hidden = !(S.album === 'fav' && S.favs.size > 0 && p.ft.dl !== false);
    $('gZip').disabled = S.level >= 1;
    S.face.visible = !!(S.cfg && S.cfg.face && p.ft.sx && p.cap.sx && S.man && S.man.fc > 0);
    $('gFind').hidden = !S.face.visible;
  }

  // ================================================================================================= lightbox ===
  function openLb(gi, opener, list) {
    const it = S.byGi.get(gi);
    if (!it) return false;
    S.lb.list = list && list.length ? list.map((g) => S.byGi.get(g)).filter(Boolean) : shown();
    if (!S.lb.list.some((x) => x.gi === gi)) S.lb.list = [it].concat(S.lb.list);
    S.lb.i = Math.max(0, S.lb.list.findIndex((x) => x.gi === gi));
    S.lb.opener = opener || document.activeElement;
    if (!S.lb.open) {
      S.lb.open = true;
      $('gLb').hidden = false;
      setInert(true);
      if (!$('gFace').hidden) $('gFace').setAttribute('inert', '');
      try { history.pushState({ esLb: 1 }, '', location.href); } catch (e) { /* sandboxed */ }
    }
    showItem();
    setTimeout(() => { try { $('gLbClose').focus(); } catch (e) { /* hidden */ } }, 0);
    return true;
  }
  function closeLb(fromPop) {
    if (!S.lb.open) return false;
    S.lb.open = false; S.lb.seq++;
    $('gLb').hidden = true;
    stopVideo();
    $('gFace').removeAttribute('inert');
    setInert(!$('gFace').hidden);
    if (!fromPop && history.state && history.state.esLb) { try { history.back(); } catch (e) { /* ignore */ } }
    const o = S.lb.opener;
    if (o && o.isConnected) { try { o.focus(); } catch (e) { /* ignore */ } }
    return true;
  }
  function syncLbList() {
    const cur = S.lb.list[S.lb.i];
    if (!cur) return;
    const fresh = S.byGi.get(cur.gi);
    if (!fresh) { closeLb(); return; } // the photo left the gallery (hidden or erased)
    S.lb.list = S.lb.list.map((x) => S.byGi.get(x.gi)).filter(Boolean);
    S.lb.i = Math.max(0, S.lb.list.findIndex((x) => x.gi === cur.gi));
    $('gLbCount').textContent = `${S.lb.i + 1} / ${S.lb.list.length}`;
  }
  function step(d) {
    if (!S.lb.open) return;
    const n = S.lb.i + d;
    if (n < 0 || n >= S.lb.list.length) return;
    S.lb.i = n;
    showItem();
  }
  function stopVideo() {
    const v = $('gLbVid');
    try { v.pause(); } catch (e) { /* ignore */ }
    v.removeAttribute('src'); v.hidden = true; v.classList.remove('g-calm');
    try { v.load(); } catch (e) { /* ignore */ }
  }
  function setNote(text) { const n = $('gLbNote'); n.textContent = text || ''; n.hidden = !text; }
  async function showItem() {
    const seq = ++S.lb.seq;
    const it = S.lb.list[S.lb.i];
    if (!it) { closeLb(); return; }
    const p = S.pub, ft = p.ft || {};
    stopVideo();
    $('gLbPlay').hidden = true; $('gLbPlay').onclick = null;
    $('gLbCount').textContent = `${S.lb.i + 1} / ${S.lb.list.length}`;
    $('gLbPrev').disabled = S.lb.i <= 0;
    $('gLbNext').disabled = S.lb.i >= S.lb.list.length - 1;
    $('gLbName').textContent = it.nm || '';
    $('gLbCap').textContent = it.cp || '';
    const mt = it.m ? msMap().get(it.m) : '';
    $('gLbMission').textContent = mt ? fill('Mission: {0}', cleanText(mt, 80)) : '';
    $('gLbFav').setAttribute('aria-pressed', String(S.favs.has(it.gi)));
    syncRx(it);
    $('gLbRx').hidden = ft.rx === false;
    const dl = $('gLbDl');
    dl.hidden = ft.dl === false; dl.disabled = true; dl.textContent = 'Download';
    dl.dataset.state = '';
    const img = $('gLbImg');
    img.hidden = false;
    img.alt = it.nm ? fill(it.kd === 'v' ? 'Video from {0}' : 'Photo from {0}', it.nm) : (it.kd === 'v' ? 'Video' : 'Photo');
    const thumb = S.thumbs.get(it.gi) || (it.thumb ? (() => { const u = URL.createObjectURL(it.thumb); S.thumbs.set(it.gi, u); return u; })() : '');
    if (thumb) img.src = thumb; else img.removeAttribute('src');
    setNote('');
    const spin = $('gLbSpin');
    spin.hidden = true;
    if (it.kd === 'v') {
      if (ft.vp === false || S.level >= 1) { setNote('Videos play on the big screen. Here you see the first frame.'); dl.hidden = true; return; }
      dl.disabled = false;
      playButton(it, seq);
      return;
    }
    if (S.level >= 1) { setNote('Showing a small preview for now.'); dl.hidden = true; return; }
    spin.hidden = false;
    let full = null;
    try { full = await getFull(it); } catch (e) {
      if (seq !== S.lb.seq) return;
      spin.hidden = true; setNote(errText(e)); note(e); dl.hidden = true; return;
    }
    if (seq !== S.lb.seq) return;
    spin.hidden = true;
    if (!full) {
      setNote(fill('The full-size copy was kept until {0}.', fmtDate(it.fu || p.fu || p.x)));
      dl.hidden = true;
      return;
    }
    img.src = full.url;
    dl.disabled = false;
  }
  // The display copy, read by id (1 read); kept in memory only.
  async function getFull(it) {
    const hit = S.full.get(it.id);
    if (hit) { S.full.delete(it.id); S.full.set(it.id, hit); return hit; }
    const sel = it.kd === 'v' ? ['d', 'kd', 'du'] : ['d', 'kd', 'wm'];
    const docs = await ES.media.get(S.code, [it.id], { select: sel, auth: 'opt' });
    const d = docs && docs[0];
    if (!d || !(d.d instanceof Uint8Array) || d.d.length < 100) return null;
    const mime = mimeOf(d.d, it.kd);
    const rec = { bytes: d.d, mime, wm: !!d.wm, kd: it.kd, url: URL.createObjectURL(new Blob([d.d], { type: mime })) };
    S.full.set(it.id, rec);
    while (S.full.size > FULL_LRU) { const [k, v] = S.full.entries().next().value; URL.revokeObjectURL(v.url); S.full.delete(k); }
    return rec;
  }
  function playButton(it, seq) {
    const spin = $('gLbSpin'), b = $('gLbPlay');
    b.hidden = false;
    b.onclick = async () => {
      if (seq !== S.lb.seq) return;
      b.hidden = true; spin.hidden = false;
      let full = null;
      try { full = await getFull(it); } catch (e) { note(e); if (seq === S.lb.seq) { spin.hidden = true; setNote(errText(e)); b.hidden = false; } return; }
      if (seq !== S.lb.seq) return;
      spin.hidden = true;
      if (!full) { setNote(fill('The full-size copy was kept until {0}.', fmtDate(it.fu || S.pub.fu || S.pub.x))); return; }
      const v = $('gLbVid');
      // §4.24: dimmed and desaturated until the flash check says the clip is calm (it runs alongside, at 2x speed).
      const verdict = S.calm.get(it.id);
      v.classList.toggle('g-calm', verdict !== false);
      if (verdict === true) setNote('This video flickers, so it plays dimmed.');
      v.src = full.url; v.hidden = false; $('gLbImg').hidden = true;
      v.play().catch(() => { /* the controls are there */ });
      if (!S.plays.has(it.id)) { S.plays.add(it.id); ES.stat(S.code, 'v'); }
      if (verdict === undefined && window.EM && EM.video && EM.video.flashScore) {
        EM.video.flashScore(new Blob([full.bytes], { type: full.mime }), { maxMs: 16000 }).then((r) => {
          const flashy = !!(r && r.flashy);
          S.calm.set(it.id, flashy);
          if (seq !== S.lb.seq) return;
          if (flashy) { setNote('This video flickers, so it plays dimmed.'); v.classList.add('g-calm'); } else v.classList.remove('g-calm');
        }).catch(() => { /* unknown: it stays dimmed */ });
      }
    };
  }
  function current() { return S.lb.open ? S.lb.list[S.lb.i] : null; }

  async function download() {
    const it = current();
    if (!it || (S.pub.ft || {}).dl === false) return;
    const btn = $('gLbDl');
    if (btn.dataset.state === 'busy') return;
    btn.dataset.state = 'busy'; btn.disabled = true; btn.textContent = 'Preparing…';
    const seq = S.lb.seq;
    try {
      const full = await getFull(it);
      if (!full) { toast(fill('The full-size copy was kept until {0}.', fmtDate(it.fu || S.pub.fu || S.pub.x))); return; }
      let bytes = full.bytes, mime = full.mime;
      // §4.23: free plans burn the mark into downloads (photographer photos already carry it in the stored copy).
      if (it.kd === 'p' && (S.pub.mk || (S.pub.cap || {}).mk) && !full.wm) { bytes = await EM.mark.apply(bytes, { plan: 'free' }); mime = 'image/jpeg'; }
      const res = await EM.save(new Blob([bytes], { type: mime }), `${fileBase()} ${String(it.gi + 1).padStart(4, '0')}${extOf(mime)}`);
      if (res !== 'cancelled') {
        ES.stat(S.code, 'd');
        if (seq === S.lb.seq) { btn.textContent = 'Saved'; btn.dataset.state = 'saved'; return; }
      }
    } catch (e) { note(e); toast(errText(e)); } finally {
      if (btn.dataset.state === 'busy') { btn.dataset.state = ''; btn.textContent = 'Download'; }
      if (seq === S.lb.seq) btn.disabled = false;
    }
  }

  // ================================================================================== favourites and reactions ===
  function toggleFav() {
    const it = current();
    if (!it) return;
    if (S.favs.has(it.gi)) S.favs.delete(it.gi); else S.favs.add(it.gi);
    lsSet(`luts:es-fav:${S.code}`, [...S.favs].sort((a, b) => a - b));
    $('gLbFav').setAttribute('aria-pressed', String(S.favs.has(it.gi)));
    const li = S.tiles.get(it.gi);
    if (li) li.querySelector('.g-heart').hidden = !S.favs.has(it.gi);
    if (S.album === 'fav') render();
    updateTools();
  }
  async function loadReactions() {
    if ((S.pub.ft || {}).rx === false) return;
    try { S.rx = (await ES.reactions(S.code)) || {}; } catch (e) { S.rx = {}; note(e); }
    const it = current(); if (it) syncRx(it);
  }
  const given = () => lsGet(`luts:es-rx:${S.code}`, {}) || {};
  function syncRx(it) {
    const mine = String(given()[it.gi] || ''), counts = S.rx[it.gi] || {};
    for (const b of $('gLbRx').querySelectorAll('button')) {
      const e = b.dataset.e;
      b.querySelector('b').textContent = String(Math.max(0, +counts[e] || 0));
      b.setAttribute('aria-pressed', String(mine.includes(e)));
    }
  }
  async function react(e) {
    const it = current();
    if (!it || !REACTIONS.includes(e)) return;
    if (String(given()[it.gi] || '').includes(e)) return;
    try {
      const ok = await ES.react(S.code, it.gi, e);
      if (ok) { const c = (S.rx[it.gi] = Object.assign({}, S.rx[it.gi] || {})); c[e] = (+c[e] || 0) + 1; }
    } catch (x) { note(x); toast(errText(x)); }
    const cur = current(); if (cur) syncRx(cur);
  }

  // ================================================================================================== report ===
  function openReport() {
    if (!current()) return;
    $('gRepForm').reset(); $('gRepErr').hidden = true;
    $('gRep').hidden = false;
    $('gLb').setAttribute('inert', '');
    setTimeout(() => { const r = $('gRep').querySelector('input'); if (r) r.focus(); }, 0);
  }
  function closeReport() {
    $('gRep').hidden = true; $('gLb').removeAttribute('inert');
    try { $('gLbReport').focus(); } catch (e) { /* ignore */ }
  }
  async function sendReport(ev) {
    ev.preventDefault();
    const it = current();
    const why = ($('gRepForm').querySelector('input[name=why]:checked') || {}).value;
    if (!why) { $('gRepErr').hidden = false; return; }
    if (!it) { closeReport(); return; }
    const btn = $('gRepSend'); btn.disabled = true;
    try {
      await ES.report(S.code, it.id, why);
      closeReport();
      toast('Thanks — the hosts will check it.');
    } catch (e) { note(e); toast(errText(e)); } finally { btn.disabled = false; }
  }

  // ===================================================================================================== share ===
  function shareUrl() {
    const t = new URLSearchParams(S.frag.replace(/^#/, '')).get('t');
    if (S.keySrc === 'password' && t) return ES.urls.gallery(S.code, { t });
    return S.keyB64 ? ES.urls.gallery(S.code, { k: S.keyB64 }) : ES.urls.gallery(S.code);
  }
  async function share() {
    const text = ES.caption('gallery', { title: S.pub.t, names: S.pub.n, url: shareUrl() });
    try {
      const r = await EM.share({ text, title: cleanText(S.pub.t, 60) || 'Photos from the evening' });
      if (r === 'copied') toast('Link copied');
    } catch (e) { note(e); }
  }

  // ======================================================================================= ZIP of favourites ===
  function ask(text) {
    return new Promise((resolve) => {
      $('gAskMsg').textContent = text;
      $('gAsk').hidden = false;
      const done = (v) => { $('gAsk').hidden = true; $('gAskYes').onclick = $('gAskNo').onclick = null; S.askDone = null; resolve(v); };
      S.askDone = done;
      $('gAskYes').onclick = () => done(true);
      $('gAskNo').onclick = () => done(false);
      setTimeout(() => { try { $('gAskYes').focus(); } catch (e) { /* ignore */ } }, 0);
    });
  }
  async function zipFavourites() {
    if (S.zipBusy || !S.favs.size || (S.pub.ft || {}).dl === false) return;
    if (S.level >= 1) { toast('Showing a small preview for now.'); return; }
    const btn = $('gZip');
    S.zipBusy = true; btn.disabled = true;
    try {
      await ensureGis([...S.favs]);
      const list = [...S.favs].map((g) => S.byGi.get(g)).filter(Boolean).sort((a, b) => a.gi - b.gi);
      if (!list.length) return;
      const mb = Math.round(list.reduce((a, it) => a + (it.kd === 'v' ? 0.8 : 0.1), 0));
      if (mb >= ZIP_WARN_MB && !(await ask(fill('This is a big download (about {0} MB). Use Wi-Fi?', mb)))) return;
      const base = fileBase();
      const zw = EM.zip.writer({});
      const free = !!(S.pub.mk || (S.pub.cap || {}).mk);
      let done = 0;
      toast(fill('Preparing… {0}%', 0), 600000);
      for (let i = 0; i < list.length; i += 20) {
        const chunk = list.slice(i, i + 20);
        let docs;
        try { docs = await ES.media.get(S.code, chunk.map((x) => x.id), { select: ['d', 'kd', 'wm'], auth: 'opt' }); } catch (e) { note(e); toast(errText(e)); return; }
        for (let j = 0; j < chunk.length; j++) {
          const it = chunk[j], d = docs[j];
          const n = String(it.gi + 1).padStart(4, '0');
          if (d && d.d instanceof Uint8Array && d.d.length >= 100) {
            let bytes = d.d, mime = mimeOf(d.d, it.kd);
            if (it.kd === 'p' && free && !d.wm) { bytes = await EM.mark.apply(bytes, { plan: 'free' }); mime = 'image/jpeg'; }
            await zw.add(`${base} ${n}${extOf(mime)}`, bytes, it.at || Date.now());
          } else if (it.thumb) {
            // past the full-size window: the small preview is all that is left
            await zw.add(`${base} ${n} preview.jpg`, it.thumb, it.at || Date.now());
          }
          done++;
          toast(fill('Preparing… {0}%', Math.round((done / list.length) * 100)), 600000);
        }
      }
      const all = await zw.finish();
      let saved = false;
      for (let i = 0; i < all.length; i++) {
        const name = all.length > 1 ? `${base} favourites ${i + 1}-${all.length}.zip` : `${base} favourites.zip`;
        const r = await EM.save(new Blob([all[i]], { type: 'application/zip' }), name);
        if (r !== 'cancelled') saved = true;
      }
      if (saved) { ES.stat(S.code, 'd'); toast('Saved to Downloads'); } else $('gToast').hidden = true;
    } catch (e) { note(e); toast(errText(e)); } finally { S.zipBusy = false; btn.disabled = S.level >= 1; }
  }

  // ============================================================================================ selfie search ===
  function openFace() {
    if (!S.face.visible) return;
    resetFace();
    $('gFace').hidden = false;
    setInert(true);
    setTimeout(() => { try { $('gFaceTake').focus(); } catch (e) { /* ignore */ } }, 0);
  }
  function closeFace() {
    if ($('gFace').hidden) return false;
    $('gFace').hidden = true;
    setInert(S.lb.open);
    resetFace();
    try { $('gFind').focus(); } catch (e) { /* ignore */ }
    return true;
  }
  function resetFace() {
    if (window.ESFace && typeof ESFace.forget === 'function') { try { ESFace.forget(); } catch (e) { /* ignore */ } }
    S.face.res = null;
    for (const u of S.face.urls) URL.revokeObjectURL(u);
    S.face.urls = [];
    for (const id of ['gFaceLikely', 'gFaceMaybe']) { $(id).hidden = true; $(id).querySelector('ul').textContent = ''; }
    faceStatus('');
    $('gFaceProg').hidden = true;
    $('gFaceFile').value = '';
  }
  function faceStatus(text, frac) {
    $('gFaceStatus').textContent = text || '';
    const p = $('gFaceProg');
    if (typeof frac === 'number') { p.hidden = false; p.value = clamp(frac, 0, 1); } else p.hidden = true;
  }
  // stt/{day}/s: one counter per 24 hours since opening (guests cannot read stt, but the increment answers with the
  // new value). null when it could not be counted (the search then goes ahead).
  async function countSearch() {
    const h = clamp(Math.floor((now() - (+S.pub.o || 0)) / HOUR), 0, 499);
    const day = Math.floor(h / 24) * 24;
    try {
      const v = await ES.db.put(`es/${S.code}/stt/${day}/s`, ES.db.inc(1));
      return typeof v === 'number' ? v : null;
    } catch (e) {
      note(e);
      if (e && (e.code === 'QUOTA' || e.code === 'PAUSED')) return Infinity;
      return null;
    }
  }
  let faceScriptP = null;
  function faceScript() {
    if (window.ESFace) return Promise.resolve(window.ESFace);
    if (!faceScriptP) {
      faceScriptP = new Promise((resolve, reject) => {
        // Bundled with this page (face/): never a script from another origin, least of all inside the app, where the
        // page has the native bridge. Only the model's data comes from cfg.faceBase, checked by ESFace (SHA-256).
        const s = document.createElement('script');
        s.src = 'face/face-search.js';
        s.async = true;
        s.onload = () => (window.ESFace ? resolve(window.ESFace) : reject(new Error('ESFace missing')));
        s.onerror = () => reject(new Error('face-search.js did not load'));
        document.head.appendChild(s);
      }).catch((e) => { faceScriptP = null; throw e; });
    }
    return faceScriptP;
  }
  async function runSearch(file) {
    if (S.face.busy || !file) return;
    S.face.busy = true;
    $('gFaceTake').setAttribute('aria-disabled', 'true');
    try {
      resetFaceResults();
      if (S.level >= 1) { faceStatus(MSG.rest); return; }
      const n = await countSearch();
      if (n !== null && n > SEARCH_CAP) { faceStatus(MSG.rest); return; }
      let F;
      try { F = await faceScript(); } catch (e) { note(e); faceStatus('Selfie search did not start on this phone. Try another browser.'); return; }
      if (!F || (typeof F.available === 'function' && !F.available())) { faceStatus('Selfie search did not start on this phone. Try another browser.'); return; }
      faceStatus('Downloading the face finder (about 7 MB)…', 0);
      await F.load({ onProgress: (f) => faceStatus('Downloading the face finder (about 7 MB)…', typeof f === 'number' ? f : 0) });
      faceStatus(fill('Looking… {0} of {1}', 0, '…'), 0);
      const res = await F.search(S.code, {
        key: S.key, selfie: file,
        onProgress: (f, pr) => { if (pr && pr.total) faceStatus(fill('Looking… {0} of {1}', pr.done, pr.total), f); },
        onResult: (r) => { renderFace(r, false).catch(note); },
      });
      await renderFace(res, true);
    } catch (e) {
      note(e);
      if (e && (e.code === 'QUOTA' || e.code === 'PAUSED' || e.code === 'NOT_FOUND')) faceStatus(MSG.rest); // not prepared (again) yet
      else if (e && e.code === 'CLOSED') faceStatus(MSG.ended);
      else if (e && (e.code === 'UNSUPPORTED' || e.code === 'BAD_FILE')) faceStatus('Selfie search did not start on this phone. Try another browser.');
      else faceStatus(errText(e));
    } finally {
      S.face.busy = false; S.face.runs++;
      $('gFaceTake').removeAttribute('aria-disabled');
      $('gFaceFile').value = '';
    }
  }
  function resetFaceResults() {
    for (const u of S.face.urls) URL.revokeObjectURL(u);
    S.face.urls = [];
    for (const id of ['gFaceLikely', 'gFaceMaybe']) { $(id).hidden = true; $(id).querySelector('ul').textContent = ''; }
    S.face.res = null;
  }
  async function renderFace(res, final) {
    if (!res || $('gFace').hidden) return;
    S.face.res = res;
    const tiers = [['likely', 'gFaceLikely'], ['maybe', 'gFaceMaybe']];
    const gis = [];
    for (const [k] of tiers) for (const c of res[k] || []) gis.push(...(c.gis || []));
    if (final && gis.length) await ensureGis(gis);
    for (const u of S.face.urls) URL.revokeObjectURL(u);
    S.face.urls = [];
    const allFound = [];
    for (const [k] of tiers) for (const c of res[k] || []) for (const g of c.gis || []) if (S.byGi.has(g) && !allFound.includes(g)) allFound.push(g);
    for (const [k, id] of tiers) {
      const list = res[k] || [];
      const sec = $(id), ul = sec.querySelector('ul');
      ul.textContent = '';
      sec.hidden = !list.length;
      for (const c of list) {
        const li = document.createElement('li');
        li.className = 'g-cluster'; li.dataset.c = String(c.c);
        const face = document.createElement('img');
        face.alt = '';
        if (c.crop instanceof Blob) { const u = URL.createObjectURL(c.crop); S.face.urls.push(u); face.src = u; }
        li.appendChild(face);
        const right = document.createElement('div');
        const head = document.createElement('div'); head.className = 'g-cl-head';
        const cnt = document.createElement('span');
        const n = (c.gis || []).length;
        cnt.textContent = n === 1 ? '1 photo' : fill('{0} photos', n);
        const nm = document.createElement('button');
        nm.type = 'button'; nm.className = 'g-notme'; nm.textContent = 'Not me'; nm.dataset.c = String(c.c);
        head.append(cnt, nm);
        const ph = document.createElement('div'); ph.className = 'g-cl-photos';
        for (const g of c.gis || []) {
          const it = S.byGi.get(g);
          if (!it) continue;
          const b = document.createElement('button');
          b.type = 'button'; b.dataset.gi = String(g);
          b.setAttribute('aria-label', it.nm ? fill('Photo from {0}', it.nm) : 'Photo');
          const im = document.createElement('img'); im.alt = '';
          const u = S.thumbs.get(g) || (it.thumb ? (() => { const x = URL.createObjectURL(it.thumb); S.thumbs.set(g, x); return x; })() : '');
          if (u) im.src = u;
          b.appendChild(im); ph.appendChild(b);
        }
        right.append(head, ph);
        li.appendChild(right);
        ul.appendChild(li);
      }
    }
    S.face.found = allFound;
    const any = (res.likely || []).length + (res.maybe || []).length > 0;
    if (final) faceStatus(any ? '' : 'No photos found. Try a selfie in better light.');
  }
  async function notMe(c) {
    if (!window.ESFace || typeof ESFace.notMe !== 'function') return;
    try { const r = await ESFace.notMe(c); await renderFace(r, true); } catch (e) { note(e); }
  }

  // ======================================================================================= host: gallery days ===
  async function hostBox() {
    const mine = (ES.events.mine() || []).find((x) => x.code === S.code);
    if (!mine || !['h', 'c'].includes(mine.role) || !ES.staff.uid()) return;
    const p = S.pub, gd = +(p.cap || {}).gd || 0;
    const opts = [7, 30, 90].filter((d) => d <= gd);
    if (!opts.length) return;
    S.host.visible = true;
    $('gHost').hidden = false;
    $('gHostNote').hidden = !!(p.cap || {}).mk;
    drawDays();
  }
  function drawDays() {
    const p = S.pub, gd = +(p.cap || {}).gd || 0;
    const cur = Math.round(((+p.x || 0) - (+p.c || 0)) / DAY);
    const box = $('gDays');
    box.textContent = '';
    for (const d of [7, 30, 90].filter((x) => x <= gd)) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.days = String(d);
      b.setAttribute('aria-checked', String(d === cur));
      b.textContent = fill('{0} days', d);
      b.disabled = S.host.busy || (+p.c || 0) + d * DAY <= now() + HOUR; // would end the gallery now
      box.appendChild(b);
    }
  }
  async function setDays(d) {
    if (S.host.busy) return;
    S.host.busy = true; drawDays();
    $('gHostMsg').textContent = 'Updating the gallery…';
    try {
      await ES.events.update(S.code, { gd: d });
      await restamp();
      const p = await ES.pub.get(S.code);
      if (p) applyPub(p);
      $('gHostMsg').textContent = fill('Photos are kept until {0}, then deleted.', fmtDate(S.pub.x));
    } catch (e) { note(e); $('gHostMsg').textContent = e && e.code === 'OFFLINE' ? 'No connection' : 'Could not change this'; } finally {
      S.host.busy = false; drawDays();
    }
  }
  // Pages, face pages, the manifest and the highlights carry xp = expiresAt (rules). When no wall is packing (its
  // packer rewrites everything when expiresAt changes, §3.6), stamp the new date on the existing bytes here.
  async function restamp() {
    const code = S.code;
    try {
      const lk = await ES.db.get(`es/${code}/lk/pack`, { auth: true });
      if (lk && lk.u !== ES.staff.uid() && +lk.un > now()) return { skipped: true };
    } catch (e) { if (e.code !== 'DENIED') throw e; }
    const e = await ES.events.get(code);
    const m = await ES.gallery.manifest(code);
    if (m) {
      for (let n = 0; n < m.pc; n++) {
        const d = await ES.fs.get(`events/${code}/pages/${n}`, { auth: true });
        if (d && d.pk && d.xp !== e.expiresAt) await ES.gallery.writePage(code, n, d.pk, { count: d.c, sealed: d.se, vr: d.vr });
      }
      for (let n = 0; n < m.fc; n++) {
        const d = await ES.fs.get(`events/${code}/faces/${n}`, { auth: true });
        if (d && d.pk && d.xp !== e.expiresAt) {
          await ES.fs.commit([ES.fs.w.update(`events/${code}/faces/${n}`, { pk: d.pk, c: d.c, se: !!d.se, vr: d.vr || 0, xp: ES.fs.ts(e.expiresAt) }, { serverTime: ['at'] })], { auth: true });
        }
      }
      await ES.fs.commit([ES.fs.w.update(`events/${code}/pub/g`, { xp: ES.fs.ts(e.expiresAt) }, { mask: ['xp', 'at'], serverTime: ['at'] })], { auth: true });
    }
    // Highlights stay full size until the gallery ends.
    for (let guard = 0; guard < 10; guard++) {
      const hl = (await ES.fs.query(`events/${code}`, { from: 'media', where: [['hl', '==', true]], select: ['hl', 'xp', 'st'], limit: 300, auth: true }))
        .filter((d) => d.st !== 3 && d.xp !== e.expiresAt);
      if (!hl.length) break;
      await ES.fs.commit(hl.map((d) => ES.fs.w.update(d._path, { xp: ES.fs.ts(e.expiresAt) }, { mask: ['xp'] })), { auth: true });
      if (hl.length < 300) break;
    }
    return { skipped: false };
  }

  // ======================================================================================== live refresh ===
  function startWatch() {
    if (S.watch) return;
    S.watch = ES.bell.watch(S.code, {
      mode: 'gallery',
      onChange: (changed, bell, info) => {
        if (info && info.first) return;
        if (changed.includes('s') || changed.includes('l')) refreshPub().catch(note);
        if (changed.includes('p')) refreshManifest().catch(note);
      },
      onGov: (lvl) => setLevel(lvl),
    });
  }
  function stopWatch() { if (S.watch) { S.watch.stop(); S.watch = null; } }
  async function refreshPub() {
    const p = await ES.pub.get(S.code);
    if (!p) { gate('ended'); return; }
    applyPub(p);
    if (await hasEnded(p.x)) { gate('ended'); return; }
    updateTools();
    if (S.lb.open) showItem();
  }
  // A page's version: the manifest's pv[n] (bumped only when that page is rewritten); a manifest without pv falls back
  // to vr, which moves on every write (then every loaded page is fetched again, as before pv).
  function pvOf(m, n) {
    if (!m) return undefined;
    if (ES.gallery.pageVersion) return ES.gallery.pageVersion(m, n);
    return Array.isArray(m.pv) && Number.isFinite(+m.pv[n]) ? +m.pv[n] : undefined;
  }
  function verOf(m, n) { const v = pvOf(m, n); return v === undefined || v === null ? `r${(m && m.vr) || 0}` : `p${v}`; }
  function pageOpts(m, n) { const v = pvOf(m, n); return v === undefined || v === null ? { vr: m.vr } : { vr: m.vr, pv: v }; }
  async function refreshManifest() {
    const m = await ES.gallery.manifest(S.code);
    if (!m) return;
    if (m.xp && await hasEnded(m.xp)) { gate('ended'); return; }
    const old = S.man || { vr: -1, pc: 0 };
    S.man = m;
    if (m.vr !== old.vr || m.pc !== old.pc) {
      // Only the pages whose version moved are fetched again; the others stay as they are (with their thumbnails).
      const stale = [];
      for (const n of [...S.pages.keys()]) {
        if (n >= m.pc) { dropPageUrls(n); S.pages.delete(n); S.pageVer.delete(n); continue; }
        if (S.pageVer.get(n) !== verOf(m, n)) stale.push(n);
      }
      if (!S.pages.size && m.pc) stale.push(0);
      for (const n of stale) { dropPageUrls(n); S.pages.delete(n); S.pageVer.delete(n); }
      for (const n of stale) await loadPage(n);
      S.refetched = (S.refetched || 0) + stale.length;
      rebuild(); render();
    }
    updateTools(); updateMore();
    setTimeout(checkNear, 50);
  }
  function setLevel(l) {
    const lvl = clamp(Math.round(+l || 0), 0, 3);
    if (lvl === S.level) return;
    S.level = lvl;
    banner(lvl >= 3 ? MSG.paused : '');
    updateTools();
    if (S.lb.open) showItem();
  }
  function banner(text) { const b = $('gBanner'); b.textContent = text || ''; b.hidden = !text; }
  function countOpen() {
    const k = `luts:es-gopen:${S.code}`;
    if (ssGet(k)) return;
    ssSet(k, 1);
    ES.stat(S.code, 'o');
  }

  // =========================================================================================== static wiring ===
  function closeTop() {
    if (S.askDone && !$('gAsk').hidden) { S.askDone(false); return true; }
    if (!$('gRep').hidden) { closeReport(); return true; }
    if (S.lb.open) { closeLb(); return true; }   // a photo opened from the selfie results sits above that sheet
    if (!$('gFace').hidden) { closeFace(); return true; }
    return false;
  }
  function setupStatic() {
    $('gPw').addEventListener('submit', submitPassword);
    $('gRetry').addEventListener('click', () => location.reload());
    $('gAlbums').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-album]'); if (b) setAlbum(b.dataset.album); });
    $('gGrid').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-gi]'); if (b) openLb(+b.dataset.gi, b); });
    $('gMoreBtn').addEventListener('click', () => loadMore());
    $('gShare').addEventListener('click', share);
    $('gZip').addEventListener('click', zipFavourites);
    $('gFind').addEventListener('click', openFace);
    $('gFaceClose').addEventListener('click', closeFace);
    $('gFaceFile').addEventListener('change', (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) runSearch(f); });
    $('gFace').addEventListener('click', (ev) => {
      const nm = ev.target.closest('button.g-notme');
      if (nm) { notMe(isNaN(+nm.dataset.c) ? nm.dataset.c : +nm.dataset.c); return; }
      const b = ev.target.closest('button[data-gi]');
      if (b) openLb(+b.dataset.gi, b, S.face.found || []);
    });
    $('gLbClose').addEventListener('click', () => closeLb());
    $('gLbPrev').addEventListener('click', () => step(-1));
    $('gLbNext').addEventListener('click', () => step(1));
    $('gLbFav').addEventListener('click', toggleFav);
    $('gLbDl').addEventListener('click', download);
    $('gLbReport').addEventListener('click', openReport);
    $('gLbRx').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-e]'); if (b) react(b.dataset.e); });
    $('gRepForm').addEventListener('submit', sendReport);
    $('gRepCancel').addEventListener('click', closeReport);
    $('gDays').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-days]'); if (b && !b.disabled) setDays(+b.dataset.days); });
    // Swipe between photos.
    let sx = null, sy = 0;
    const stage = document.querySelector('.g-lb-stage');
    stage.addEventListener('pointerdown', (ev) => { if (ev.isPrimary) { sx = ev.clientX; sy = ev.clientY; } });
    stage.addEventListener('pointerup', (ev) => {
      if (sx === null) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { sx = null; });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { if (closeTop()) ev.preventDefault(); return; }
      if (S.lb.open && $('gRep').hidden && !ev.target.closest('input,select,textarea')) {
        if (ev.key === 'ArrowLeft') { step(-1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { step(1); ev.preventDefault(); }
      }
    });
    window.addEventListener('popstate', () => { if (S.lb.open) closeLb(true); });
    // Descriptors live in the worker only while the search sheet is open (the camera app may hide the page meanwhile);
    // closing the sheet or leaving the page wipes them.
    window.addEventListener('pagehide', () => { if (window.ESFace && ESFace.forget) { try { ESFace.forget(); } catch (e) { /* ignore */ } } });
    // Language: the event pages' own choice (luts:es-lang), never the game's.
    const sel = $('gLang');
    const langs = (window.LUTSLang && LUTSLang.langs) || [['auto', 'Phone language'], ['en', 'English']];
    let chosen = 'auto';
    try { chosen = localStorage.getItem(LANG_KEY) || 'auto'; } catch (e) { /* blocked */ }
    for (const [c, label] of langs) {
      const o = document.createElement('option');
      o.value = c; o.textContent = label;
      if (c !== 'auto') o.setAttribute('data-no-i18n', '');
      if (c === chosen) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      try { localStorage.setItem(LANG_KEY, sel.value); } catch (e) { /* blocked */ }
      location.reload();
    });
    const play = $('gPlay');
    if (!window.LUTSNative && window.ES) { play.href = ES.urls.play('event_gallery', 'web'); play.hidden = false; }
  }

  // ============================================================================================== test hooks ===
  window.EventGallery = {
    state() {
      return {
        screen: S.screen, code: S.code, album: S.album, pages: [...S.pages.keys()].sort((a, b) => a - b), pc: S.man ? S.man.pc : 0,
        fc: S.man ? S.man.fc : 0, items: S.items.length, shown: S.screen === 'grid' ? shown().length : 0, favs: [...S.favs].sort((a, b) => a - b),
        level: S.level, open: S.lb.open ? (current() || {}).gi : null, keySrc: S.keySrc, face: S.face.visible, faceRuns: S.face.runs, host: S.host.visible, refetched: S.refetched || 0, pageVer: Object.fromEntries(S.pageVer),
        loading: S.loading.size, errors: S.errors.slice(),
      };
    },
    open: (gi) => openLb(+gi),
    close: () => closeLb(),
    album: (id) => setAlbum(String(id)),
    loadMore,
    refresh: () => Promise.all([refreshPub(), refreshManifest()]),
    restamp,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot().catch((e) => { note(e); gate('error', e); }); });
  else setTimeout(() => { boot().catch((e) => { note(e); gate('error', e); }); }, 0);
})();
