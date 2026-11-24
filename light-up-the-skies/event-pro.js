/* Event Sky photographer page: window.EventPro (event-pro.js, for event-pro.html). Build spec:
 * research/event-sky-spec.md §3.9 (WP-H), §4.19 (copy, watermark), §4.23 (brand mark), §2.5 (media x-<n>-<token>, xs/{n}).
 *
 *  - Joins with the photographer invite ?e=CODE&j=p.SECRET (the secret is taken out of the address at once).
 *  - Photos arrive dropped, picked, or inside a ZIP (EM.zip.read, one entry at a time). Each goes through
 *    EM.image.prepare(kind 'pro'): 1080 px, at most 120 KB, EXIF and GPS gone. Free events burn in "Photo: {name}" and the
 *    Light Up the Skies mark at 35% in the bottom-right corner; paid events add the credit only if asked.
 *  - The queue lives in its own IndexedDB database (luts-es-pro; the guest queue in luts-es must never see these items),
 *    survives a reload, prepares 3 photos at a time and sends 4 or fewer per commit, each with its own xs/{n} claim.
 *    Before a commit the planned ids are saved, so after a reload a commit that did land is recognised (no duplicates);
 *    the same photo added twice (by content) is sent once.
 *  - "{0} of {1} photos left" counts the event's photographer slots (an aggregation, 1 read); past the limit photos stay
 *    on this device, marked, and nothing is retried against the rules.
 *  - My uploads lists this photographer's photos (thumbnails only, 60 at a time) with Delete (tombstone, as the rules
 *    allow the uploader). With R2 on, the original file and the full-size copy also go to the cloud Worker.
 *  - With es_cfg.shop on, the shop settings and orders (event-shop.js) appear for the photographer.
 * Loaded before i18n.js (only to point it at the event dictionaries); starts on DOMContentLoaded.
 *
 * Test hooks: window.EventPro = {version, ready, state(), items(), add(files), pump(), pause(), resume(), hooks:{afterCommit}}.
 */
/* STRINGS:
Photographer upload
Your name for the photo credit
Drop photos or a ZIP here
Or tap to choose. JPEG, PNG, WebP or HEIC.
Choose photos
Choose a ZIP
{0} of {1} uploaded
{0} of {1} photos left
Paused — will continue when you're back online
{0} photos left for this event
Free events carry a small “Photo: {0}” credit and the Light Up the Skies mark.
Free events carry a small “Photo: your name” credit and the Light Up the Skies mark.
Add my photo credit
Add your name for the photo credit to start.
Function
No particular function
Pause
Resume
Paused
Clear the finished list
Photos being sent
Waiting
Getting ready…
Ready to send
Sending…
Sent ✓
Saving the original…
That photo did not open.
That photo is too big
No photographer photos left for this event
Uploads open when the event opens
Uploads have closed for this event.
Photographer uploads switch on when the pass is confirmed
This photo was refused. Try again or remove it.
Retry
Remove
All sent ✓
{0} photos were already sent.
{0} files were not photos and were left out.
That ZIP did not open.
This browser could not keep the photos for later. Keep this page open until they are sent.
Photos can be sent until {0}.
Uploads open on {0}.
My uploads
Deleting a photo removes it from the screen and the gallery. Deleted photos still count toward the limit.
Show my uploads
Show more
No photos yet
Delete
Delete this photo?
It is removed from the screen and the gallery. This can't be undone.
Keep
Deleted
Sell prints
Event code
Open
Open the photographer link the hosts sent you.
Ask the hosts for a photographer invite link.
This invite link no longer works. Ask the hosts for a new one.
No such event. Check the code.
This event has ended.
Event Sky is paused for a moment. Please try again later.
No connection
Something went wrong. Try again.
Loading…
Close
*/
(function () {
  'use strict';
  // ---- before i18n.js: the event dictionaries and their own saved language; the game's language (or ?l=) first. ----
  const LANGS = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa'];
  try {
    window.LUTS_I18N_KEY = 'luts:es-lang';
    window.LUTS_I18N_DIR = 'i18n/event/';
    const l = String(new URLSearchParams(location.search).get('l') || '').toLowerCase();
    const game = localStorage.getItem('luts:lang');
    if (LANGS.includes(l)) window.LUTS_I18N_LANG = l;
    else if (game && LANGS.includes(game)) window.LUTS_I18N_LANG = game;
    if (!localStorage.getItem('luts:es-lang')) localStorage.setItem('luts:es-lang', 'auto');
  } catch (e) { /* storage blocked: English */ }
  if (window.EventPro) return;

  const DAY = 864e5, MIN = 6e4;
  const PREP_PAR = 3, SEND_PAR = 2, BATCH = 4, RAW_AHEAD = 6, PAGE = 60;
  const MAX_FILE = 80 * 1024 * 1024;
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/avif'];
  const ORIG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'];
  const NAME_KEY = 'luts:es-pro-name', CREDIT_KEY = 'luts:es-pro-credit';
  const $ = (id) => document.getElementById(id);
  const t = (s) => (window.LUTSLang && LUTSLang.t ? LUTSLang.t(s) : s);
  const fill = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined ? m : String(a[+i])));
  const tf = (s, ...a) => fill(t(s), ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } };
  function randStr(n) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', lim = 256 - (256 % 62);
    let out = '';
    while (out.length < n) for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < lim && out.length < n) out += A[b % 62];
    return out;
  }
  const newKey = () => `${Date.now().toString(36)}${randStr(6)}`;
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

  // ============================================================================ the queue's own IndexedDB ===
  // Stores: q (items, key "<code>/<key>"), src (ZIP progress, and "<key>#b" for the ZIP itself), sent ("<code>/<sha256>").
  const DB = (() => {
    let p = null;
    const mem = { q: new Map(), src: new Map(), sent: new Map() };
    let memOnly = false;
    function open() {
      if (p) return p;
      p = new Promise((resolve) => {
        try {
          if (!window.indexedDB) { memOnly = true; return resolve(null); }
          const r = indexedDB.open('luts-es-pro', 1);
          r.onupgradeneeded = () => { for (const s of ['q', 'src', 'sent']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
          r.onsuccess = () => resolve(r.result);
          r.onerror = r.onblocked = () => { memOnly = true; resolve(null); };
        } catch (e) { memOnly = true; resolve(null); }
      });
      return p;
    }
    const tx = async (store, mode, fn) => {
      const d = await open();
      if (!d) return fn(null);
      return new Promise((resolve, reject) => {
        let out;
        const x = d.transaction(store, mode);
        x.oncomplete = () => resolve(out);
        x.onerror = () => reject(x.error);
        x.onabort = () => reject(x.error || new Error('aborted'));
        out = fn(x.objectStore(store));
      });
    };
    return {
      get memOnly() { return memOnly; },
      async put(store, key, val) { if (!(await open())) { mem[store].set(key, val); return; } await tx(store, 'readwrite', (s) => { s.put(val, key); }); },
      async del(store, key) { if (!(await open())) { mem[store].delete(key); return; } await tx(store, 'readwrite', (s) => { s.delete(key); }); },
      async get(store, key) {
        const d = await open();
        if (!d) return mem[store].get(key);
        return new Promise((resolve, reject) => { const r = d.transaction(store, 'readonly').objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      },
      async list(store, prefix) {
        const d = await open();
        if (!d) return [...mem[store].entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value }));
        return new Promise((resolve, reject) => {
          const out = [];
          const r = d.transaction(store, 'readonly').objectStore(store).openCursor(IDBKeyRange.bound(prefix, prefix + '￿'));
          r.onsuccess = () => { const c = r.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out); };
          r.onerror = () => reject(r.error);
        });
      },
    };
  })();

  // ===================================================================================================== state ===
  const S = {
    code: '', ev: null, uid: '', role: '', cfg: null,
    used: 0, left: 0, usedSet: new Set(), takenStreak: 0,
    items: [], srcs: [], iters: new Map(),
    paused: false, block: '', blockUntil: 0, backoff: 0, retryAt: 0, offline: false,
    prepping: 0, sending: 0, extracting: false, r2busy: false,
    dups: 0, skipped: 0, keepWarned: false, single: false,
    mine: { cursor: null, done: false, loaded: false, ids: new Set() },
    urls: new Map(), ringTimer: null, wake: null, startTimer: null,
  };
  const hooks = { afterCommit: null };
  const qKey = (it) => `${S.code}/${it.key}`;
  const free = () => !!(S.ev && S.ev.cap && S.ev.cap.mk);
  const proName = () => String($('proName') ? $('proName').value : '').replace(/\s+/g, ' ').trim().slice(0, 30);
  function markFor() {
    const name = proName();
    if (free()) return { plan: 'free', credit: name };
    return $('creditOn') && $('creditOn').checked && name ? { plan: 'paid', credit: name } : null;
  }
  const r2on = () => !!(S.cfg && S.cfg.r2 && S.cfg.worker && S.ev && S.ev.r2 && window.ESShop && ESShop.cloud);
  const count = (st) => S.items.filter((i) => i.state === st).length;

  // ============================================================================================== persistence ===
  async function saveItem(it) {
    const rec = Object.assign({}, it);
    delete rec.mem;
    try { await DB.put('q', qKey(it), rec); } catch (e) {
      // Quota: keep it in memory only (it is still sent while this page stays open).
      it.mem = true;
      if (!S.keepWarned) { S.keepWarned = true; toast(t('This browser could not keep the photos for later. Keep this page open until they are sent.')); }
    }
  }
  async function dropItem(it) {
    S.items = S.items.filter((x) => x !== it);
    const u = S.urls.get(it.key); if (u) { URL.revokeObjectURL(u); S.urls.delete(it.key); }
    await DB.del('q', qKey(it)).catch(() => {});
  }
  async function saveSrc(src) { const rec = Object.assign({}, src); delete rec.blob; await DB.put('src', `${S.code}/${src.key}`, rec).catch(() => {}); }

  async function loadQueue() {
    const rows = await DB.list('q', `${S.code}/`).catch(() => []);
    const now = Date.now();
    for (const { value } of rows) {
      if (!value || !value.key) continue;
      if (value.state === 'prep') value.state = 'raw'; // the page went away while preparing it
      if (value.state === 'sent' && now - (value.doneAt || 0) > DAY && !(value.r2 && (value.r2.d === 'todo' || value.r2.o === 'todo'))) { await DB.del('q', `${S.code}/${value.key}`).catch(() => {}); continue; }
      S.items.push(value);
    }
    S.items.sort((a, b) => (a.at || 0) - (b.at || 0));
    const srcs = await DB.list('src', `${S.code}/`).catch(() => []);
    for (const { key, value } of srcs) {
      if (key.endsWith('#b') || !value || value.done) continue;
      const blob = await DB.get('src', `${S.code}/${value.key}#b`).catch(() => null);
      if (blob) S.srcs.push(Object.assign(value, { blob })); else { value.done = true; await saveSrc(value); }
    }
    // A commit that was on its way when the page went away: did it land? (The planned id is saved before every commit.)
    for (const it of S.items.filter((i) => i.state === 'sending')) {
      let landed = false;
      try { landed = !!(await ES.fs.get(`events/${S.code}/media/${it.id}`, { mask: ['by'], auth: true })); } catch (e) {
        // The rules refuse a read of a document that is not there (it has no "by" to match): treat that as "not sent".
        if (e.code !== 'DENIED' && e.code !== 'NOT_FOUND') { it.state = 'ready'; it.plan = null; it.id = ''; continue; }
      }
      if (landed) await markSent(it, it.plan && it.plan.j);
      else { if (it.plan) S.usedSet.delete(it.plan.j); it.state = 'ready'; it.plan = null; it.id = ''; await saveItem(it); }
    }
  }

  // ================================================================================================ adding ===
  async function sniffFile(f) {
    try { return EM.sniff.bytes(new Uint8Array(await f.slice(0, 64).arrayBuffer())); } catch (e) { return ''; }
  }
  async function addFiles(list) {
    if (!S.ev) return { added: 0 };
    const files = Array.from(list || []);
    let added = 0, skipped = 0;
    for (const f of files) {
      if (!f || !f.size) { skipped++; continue; }
      const type = await sniffFile(f);
      if (type === 'application/zip' || (!type && /\.zip$/i.test(f.name || ''))) { await addZip(f); added++; continue; }
      if (!IMAGE_TYPES.includes(type) || f.size > MAX_FILE) { skipped++; continue; }
      const it = { key: newKey(), name: String(f.name || 'photo').slice(0, 120), size: f.size, type, kind: 'file', state: 'raw', raw: f, fn: currentFn(), at: Date.now() };
      S.items.push(it);
      await saveItem(it);
      added++;
    }
    if (skipped) toast(tf('{0} files were not photos and were left out.', skipped));
    render(); pump();
    return { added, skipped };
  }
  async function addZip(f) {
    const src = { key: `z${newKey()}`, name: String(f.name || 'photos.zip').slice(0, 80), size: f.size, next: 0, done: false, skipped: 0, fn: currentFn(), at: Date.now(), blob: f };
    try { await DB.put('src', `${S.code}/${src.key}#b`, f); } catch (e) { if (!S.keepWarned) { S.keepWarned = true; toast(t('This browser could not keep the photos for later. Keep this page open until they are sent.')); } }
    await saveSrc(src);
    S.srcs.push(src);
  }
  // Pull entries out of the ZIPs a few at a time, so the device holds only a handful of unprepared photos.
  async function extract() {
    if (S.extracting) return;
    S.extracting = true;
    try {
      for (const src of S.srcs) {
        if (src.done) continue;
        while (count('raw') < RAW_AHEAD) {
          let it = S.iters.get(src.key);
          if (!it) { it = { gen: EM.zip.read(src.blob)[Symbol.asyncIterator](), i: 0 }; S.iters.set(src.key, it); }
          let r;
          try { r = await it.gen.next(); } catch (e) { src.done = true; src.err = 'BAD_FILE'; toast(t('That ZIP did not open.')); break; }
          if (r.done) { src.done = true; break; }
          const idx = it.i++;
          if (idx < src.next) continue; // taken before a reload
          const type = EM.sniff.bytes(r.value.bytes.subarray(0, 64));
          if (IMAGE_TYPES.includes(type)) {
            const base = String(r.value.name || '').split('/').pop() || `photo-${idx + 1}`;
            const item = { key: newKey(), name: `${src.name} › ${base}`.slice(0, 160), size: r.value.bytes.length, type, kind: 'zip', state: 'raw', raw: new Blob([r.value.bytes], { type }), fn: src.fn, at: Date.now() };
            S.items.push(item);
            await saveItem(item);
          } else src.skipped++;
          src.next = idx + 1;
          await saveSrc(src);
        }
        if (src.done) {
          S.iters.delete(src.key);
          if (src.skipped) toast(tf('{0} files were not photos and were left out.', src.skipped));
          await saveSrc(src);
          await DB.del('src', `${S.code}/${src.key}#b`).catch(() => {});
        }
        if (count('raw') >= RAW_AHEAD) break;
      }
      S.srcs = S.srcs.filter((s) => !s.done);
    } finally { S.extracting = false; }
  }

  // ================================================================================================= prepare ===
  async function isDup(it) {
    if (await DB.get('sent', `${S.code}/${it.fp}`).catch(() => null)) return true;
    return S.items.some((x) => x !== it && x.fp === it.fp && !['failed', 'dup'].includes(x.state));
  }
  async function prepare(it) {
    S.prepping++;
    it.state = 'prep';
    render();
    try {
      const raw = it.raw;
      if (!raw) throw Object.assign(new Error('gone'), { code: 'BAD_FILE' });
      it.fp = hex(await crypto.subtle.digest('SHA-256', await raw.arrayBuffer()));
      if (await isDup(it)) { S.dups++; toast(tf('{0} photos were already sent.', S.dups)); await dropItem(it); return; }
      const mark = markFor();
      const r = await EM.image.prepare(raw, { kind: 'pro', mark: mark || undefined });
      Object.assign(it, { display: r.display, thumb: r.thumb, w: r.w, h: r.h, wm: !!(mark && mark.plan === 'free'), state: 'ready', err: '' });
      if (!(r2on() && ORIG_TYPES.includes(it.type) && raw.size <= 12 * 1024 * 1024)) it.raw = null;
      await saveItem(it);
    } catch (e) {
      it.state = 'failed'; it.err = e && e.code === 'TOO_BIG' ? 'TOO_BIG' : 'BAD_FILE'; it.raw = null;
      await saveItem(it);
    } finally { S.prepping--; render(); pump(); }
  }

  // ==================================================================================================== send ===
  function pickSlot() {
    const pc = (S.ev && S.ev.cap && S.ev.cap.pc) || 0;
    const freeSlots = [];
    for (let j = 0; j < pc; j++) if (!S.usedSet.has(j)) freeSlots.push(j);
    if (!freeSlots.length) return -1;
    return freeSlots[crypto.getRandomValues(new Uint32Array(1))[0] % freeSlots.length];
  }
  const saveUsed = () => lsSet(`luts:es-xs:${S.code}`, [...S.usedSet]);
  function writesFor(it) {
    const e = S.ev, code = S.code, f = ES.fs;
    return [
      f.w.create(`events/${code}/xs/${it.plan.j}`, { tk: it.plan.tk, by: S.uid, xp: f.ts(e.expiresAt) }, { serverTime: ['at'] }),
      f.w.create(`events/${code}/media/${it.id}`, {
        s: -1, k: it.plan.j, kd: 'p', d: it.display, t: it.thumb, w: Math.max(1, Math.min(4096, Math.round(+it.w || 1))), h: Math.max(1, Math.min(4096, Math.round(+it.h || 1))),
        fn: it.fn && (e.fi || []).includes(it.fn) ? it.fn : '', m: '', cp: '', st: 1, rv: f.ts(e.dp && e.dp.on ? e.dp.at : 0), hl: false, xp: f.ts(e.fu), wm: !!e.cap.mk, by: S.uid,
      }, { serverTime: ['mt', 'at'] }),
    ];
  }
  async function markSent(it, j) {
    if (Number.isInteger(j)) S.usedSet.add(j);
    saveUsed();
    it.state = 'sent'; it.doneAt = Date.now(); it.err = '';
    S.used = Math.max(S.used, S.usedSet.size); S.left = Math.max(0, ((S.ev && S.ev.cap.pc) || 0) - S.used);
    if (it.fp) await DB.put('sent', `${S.code}/${it.fp}`, { id: it.id, at: Date.now() }).catch(() => {});
    if (r2on()) it.r2 = { d: it.display ? 'todo' : 'skip', o: it.raw ? 'todo' : 'skip', tries: 0 };
    else { it.display = null; it.raw = null; }
    await saveItem(it);
    addMine({ id: it.id, thumb: it.thumb, st: 1 }, true);
  }
  function ringSoon() {
    clearTimeout(S.ringTimer);
    S.ringTimer = setTimeout(() => { ES.bell.ring(S.code, 'o').catch(() => {}); }, 1500); // walls pick up new shown photos
  }
  async function sendBatch(batch) {
    S.sending++;
    // Plan every item before the first await, so the pump never hands the same photo to two commits.
    for (const it of batch) {
      if (it.retry && it.plan && Number.isInteger(it.plan.j) && it.id) { // a commit whose answer was lost: the same slot and id again
        S.usedSet.add(it.plan.j); it.state = 'sending'; continue;
      }
      const j = pickSlot();
      if (j < 0) { it.state = 'refused'; it.err = 'FULL'; continue; }
      S.usedSet.add(j); // reserved locally for this commit
      it.plan = { j, tk: randStr(12) }; it.id = `x-${j}-${it.plan.tk}`; it.state = 'sending'; it.retry = false;
    }
    // The planned ids are on disk before the commit: after a reload, loadQueue() asks whether each one landed.
    await Promise.all(batch.map(saveItem));
    const go = batch.filter((it) => it.state === 'sending');
    render();
    if (!go.length) { S.sending--; return; }
    try {
      await ES.fs.commit([].concat(...go.map(writesFor)), { auth: true });
      if (hooks.afterCommit) await hooks.afterCommit(go.map((it) => it.id));
      for (const it of go) { it.retry = false; await markSent(it, it.plan.j); }
      S.takenStreak = 0; S.backoff = 0; S.single = false;
      ringSoon();
    } catch (e) {
      const code = e && e.code;
      let rest = go;
      const keep = new Set(); // could not ask whether it landed: keeps its slot and id
      if (code === 'TAKEN' && go.some((it) => it.retry)) {
        // TAKEN on an id sent before: that earlier commit did land (only its answer was lost). It counts as sent.
        rest = [];
        for (const it of go) {
          const got = it.retry ? await landed(it) : false;
          if (got) { it.retry = false; await markSent(it, it.plan.j); } else { if (got === null) keep.add(it); rest.push(it); }
        }
        if (go.some((it) => it.state === 'sent')) ringSoon();
      }
      // OFFLINE (or any answer that never came): the commit may have landed. Keep each photo's slot and id, so the retry
      // either lands it or finds it already there (TAKEN, above), and never claims a second slot for the same photo.
      const unsure = !KNOWN_REFUSALS.includes(code);
      for (const it of rest) {
        if (unsure || keep.has(it)) { it.state = 'ready'; it.retry = true; await saveItem(it); continue; }
        // A refused commit claimed nothing. On TAKEN only a lone slot is known to be someone else's.
        if (!(code === 'TAKEN' && rest.length - keep.size === 1)) S.usedSet.delete(it.plan.j);
        it.state = 'ready'; it.plan = null; it.id = ''; it.retry = false;
        await saveItem(it);
      }
      saveUsed();
      if (!rest.length) { if (go.some((it) => it.state === 'sent')) S.takenStreak = 0; return; }
      if (code === 'TAKEN' || code === 'BUSY') {
        // Another photographer took one of these slots: learn which slots are used once collisions repeat.
        if (++S.takenStreak >= 2) await learnSlots().catch(() => {});
      } else if (code === 'DENIED') {
        await recheck().catch(() => {});
        if (!S.block) {
          if (go.length > 1) S.single = true; // find the one the rules refuse
          else { go[0].state = 'failed'; go[0].err = 'DENIED'; await saveItem(go[0]); S.single = false; }
        }
      } else if (code === 'QUOTA' || code === 'PAUSED') { S.backoff = 60e3; S.retryAt = Date.now() + 60e3; }
      else { S.backoff = Math.min(60e3, Math.max(5e3, S.backoff * 2)); S.retryAt = Date.now() + S.backoff; S.offline = navigator.onLine === false || code === 'OFFLINE'; }
    } finally { S.sending--; render(); pump(); }
  }
  // Answers that mean the commit was refused (it claimed nothing); anything else may have landed.
  const KNOWN_REFUSALS = ['TAKEN', 'BUSY', 'DENIED', 'QUOTA', 'PAUSED', 'BAD_ARG', 'NOT_FOUND', 'CLOSED', 'FULL'];
  async function landed(it) {
    // true / false; null when it could not be asked (the photo keeps its slot and id, and is tried again)
    try { return !!(await ES.fs.get(`events/${S.code}/media/${it.id}`, { mask: ['by'], auth: true })); } catch (e) { return e.code === 'DENIED' || e.code === 'NOT_FOUND' ? false : null; }
  }
  async function learnSlots() {
    const docs = await ES.fs.query(`events/${S.code}`, { from: 'xs', select: ['__name__'], limit: 1000, auth: true });
    const inFlight = S.items.filter((i) => (i.state === 'sending' || i.retry) && i.plan).map((i) => i.plan.j);
    S.usedSet = new Set(docs.map((d) => +d._id).filter(Number.isInteger).concat(inFlight)); // the truth, plus our own commits on their way
    S.used = docs.length; S.left = Math.max(0, S.ev.cap.pc - S.used); S.takenStreak = 0;
    saveUsed();
  }
  async function countUsed() {
    try {
      const r = await ES.fs.aggregate(`events/${S.code}`, { from: 'xs', aggs: { n: ['count'] }, auth: true });
      S.used = Math.max(+r.n || 0, 0);
    } catch (e) { S.used = Math.max(S.used, S.usedSet.size); }
    S.left = Math.max(0, ((S.ev && S.ev.cap.pc) || 0) - S.used);
  }

  // ================================================================================================ R2 copies ===
  async function r2Step() {
    if (S.r2busy || !r2on()) return;
    const it = S.items.find((i) => i.state === 'sent' && i.r2 && (i.r2.d === 'todo' || i.r2.o === 'todo') && !(i.r2.at > Date.now()));
    if (!it) return;
    S.r2busy = true;
    try {
      if (it.r2.d === 'todo') { await ESShop.cloud.upload(S.code, { id: it.id, kind: 'd', blob: new Blob([it.display], { type: 'image/jpeg' }), type: 'image/jpeg', crc: EM.crc32(it.display) }); it.r2.d = 'done'; it.display = null; }
      if (it.r2.o === 'todo' && it.raw) {
        const bytes = new Uint8Array(await it.raw.arrayBuffer());
        await ESShop.cloud.upload(S.code, { id: it.id, kind: 'o', blob: it.raw, type: it.type, crc: EM.crc32(bytes) });
        it.r2.o = 'done'; it.raw = null;
      }
      it.r2.tries = 0;
    } catch (e) {
      it.r2.tries = (it.r2.tries || 0) + 1;
      if (it.r2.tries >= 6 || (e && e.code === 'DENIED')) { it.r2.d = it.r2.d === 'todo' ? 'skip' : it.r2.d; it.r2.o = it.r2.o === 'todo' ? 'skip' : it.r2.o; it.raw = null; it.display = null; }
      else it.r2.at = Date.now() + Math.min(60e3, 5e3 * 2 ** it.r2.tries);
    } finally { await saveItem(it); S.r2busy = false; render(); setTimeout(pump, 50); }
  }

  // ==================================================================================================== pump ===
  let pumpTimer = null, pumping = false;
  function pump() {
    clearTimeout(pumpTimer);
    pumpTimer = setTimeout(runPump, 0);
  }
  async function runPump() {
    if (pumping) { pumpTimer = setTimeout(runPump, 120); return; }
    pumping = true;
    try {
      if (!S.ev || S.paused) return;
      const now = Date.now();
      if (S.block && S.blockUntil && now >= S.blockUntil) { S.block = ''; await recheck().catch(() => {}); }
      if (S.block === 'closed' || S.block === 'gone') {
        // Nothing can be sent any more: say so on each waiting photo, so it can be removed.
        for (const it of S.items.filter((i) => ['raw', 'ready'].includes(i.state))) { it.state = 'refused'; it.err = 'CLOSED'; it.raw = null; await saveItem(it); }
        return;
      }
      if (S.block === 'role') return; // a new invite link from the hosts resumes this queue
      if (free() && !proName()) return; // the credit needs a name first (status says so)
      await extract();
      while (S.prepping < PREP_PAR) {
        const it = S.items.find((i) => i.state === 'raw');
        if (!it) break;
        prepare(it);
      }
      if (S.block) return; // before opening, or a pass not yet confirmed: photos get ready, nothing is sent
      if (now < S.retryAt) { pumpTimer = setTimeout(runPump, S.retryAt - now + 20); return; }
      S.offline = false;
      while (S.sending < SEND_PAR) {
        const inFlight = count('sending');
        const room = S.left - inFlight;
        const ready = S.items.filter((i) => i.state === 'ready');
        if (!ready.length) break;
        if (room <= 0) {
          if (!inFlight) {
            await countUsed();
            if (S.left - count('sending') <= 0) for (const it of ready) { it.state = 'refused'; it.err = 'FULL'; await saveItem(it); }
          }
          break;
        }
        const batch = ready.slice(0, Math.min(S.single ? 1 : BATCH, room));
        sendBatch(batch);
        await sleep(0);
      }
      r2Step();
    } finally {
      pumping = false;
      render();
      wake();
    }
  }

  // ============================================================================================== event state ===
  function blockFor(e) {
    const now = ES.clock.now();
    if (now < e.opensAt) return { block: 'early', until: e.opensAt };
    if (now >= e.fu) return { block: 'closed' };
    if (!(e.cap && e.cap.pc > 0)) return { block: 'pass' };
    return { block: '' };
  }
  async function recheck() {
    let e;
    try { e = await ES.events.get(S.code); } catch (x) {
      if (x.code === 'DENIED') { S.block = 'role'; return; }
      if (x.code === 'NOT_FOUND') { S.block = 'gone'; return; }
      throw x;
    }
    S.ev = e;
    const role = e.host === S.uid ? 'h' : (e.roles || {})[S.uid];
    if (!['h', 'c', 'p'].includes(role)) { S.block = 'role'; return; }
    const b = blockFor(e);
    S.block = b.block; S.blockUntil = b.until || 0;
    if (b.block === 'early') { clearTimeout(S.startTimer); S.startTimer = setTimeout(() => { S.block = ''; recheck().then(pump); }, Math.min(2 ** 31 - 1, b.until - ES.clock.now() + 1500)); }
    await countUsed();
  }

  // =============================================================================================== rendering ===
  let renderQueued = false;
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; draw(); });
  }
  const STATE_TEXT = { raw: 'Waiting', prep: 'Getting ready…', ready: 'Ready to send', sending: 'Sending…', sent: 'Sent ✓' };
  const ERR_TEXT = { BAD_FILE: 'That photo did not open.', TOO_BIG: 'That photo is too big', FULL: 'No photographer photos left for this event', CLOSED: 'Uploads have closed for this event.',
    DENIED: 'This photo was refused. Try again or remove it.' };
  function thumbUrl(it) {
    if (!it.thumb || !it.thumb.length) return '';
    let u = S.urls.get(it.key);
    if (!u) { u = URL.createObjectURL(new Blob([it.thumb], { type: 'image/jpeg' })); S.urls.set(it.key, u); }
    return u;
  }
  function draw() {
    if (!S.ev) return;
    const pc = S.ev.cap.pc || 0;
    $('left').textContent = tf('{0} of {1} photos left', Math.max(0, S.left - count('sending')), pc);
    const list = S.items;
    const done = count('sent'), total = list.length;
    $('count').textContent = total ? tf('{0} of {1} uploaded', done, total) : '';
    $('bar').style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
    const busy = list.some((i) => ['raw', 'prep', 'ready', 'sending'].includes(i.state)) || S.srcs.length > 0;
    $('pauseBtn').hidden = !(busy || S.paused);
    $('pauseBtn').textContent = t(S.paused ? 'Resume' : 'Pause');
    $('clearBtn').hidden = !list.some((i) => i.state === 'sent' && !(i.r2 && (i.r2.d === 'todo' || i.r2.o === 'todo')));
    // status line
    const st = $('status');
    let msg = '', err = false;
    const waiting = count('raw') + count('prep') + count('ready');
    if (S.block === 'early') msg = 'Uploads open when the event opens';
    else if (S.block === 'closed') { msg = 'Uploads have closed for this event.'; err = true; }
    else if (S.block === 'pass') msg = 'Photographer uploads switch on when the pass is confirmed';
    else if (S.block === 'role') { msg = 'This invite link no longer works. Ask the hosts for a new one.'; err = true; }
    else if (S.block === 'gone') { msg = 'This event has ended.'; err = true; }
    else if (S.paused) msg = 'Paused';
    else if (S.offline || (navigator.onLine === false && (waiting || count('sending')))) msg = "Paused — will continue when you're back online";
    else if (Date.now() < S.retryAt && S.backoff >= 60e3) msg = 'Event Sky is paused for a moment. Please try again later.';
    else if (free() && !proName() && (waiting || S.srcs.length)) { msg = 'Add your name for the photo credit to start.'; err = true; }
    else if (count('refused')) { msg = 'No photographer photos left for this event'; err = true; }
    else if (waiting > S.left && S.left > 0) msg = fill('{0} photos left for this event', S.left);
    else if (total && done === total && !S.srcs.length) msg = 'All sent ✓';
    st.textContent = t(msg);
    st.className = `msg${err ? ' err' : msg === 'All sent ✓' ? ' ok' : ''}`;
    // the list: newest first, at most 300 rows
    const ul = $('queue');
    const rows = list.slice(-300).reverse();
    ul.textContent = '';
    for (const it of rows) {
      const li = document.createElement('li');
      li.dataset.state = it.state;
      const u = thumbUrl(it);
      const img = document.createElement(u ? 'img' : 'span'); // no picture yet: a plain tile, not an empty <img>
      img.className = 'pv';
      if (u) { img.alt = ''; img.width = 48; img.height = 48; img.src = u; } else img.setAttribute('aria-hidden', 'true');
      const mid = document.createElement('div');
      mid.style.minWidth = '0';
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name; nm.setAttribute('data-no-i18n', '');
      const s2 = document.createElement('div');
      const pending = it.state === 'sent' && it.r2 && (it.r2.d === 'todo' || it.r2.o === 'todo');
      s2.className = `st${it.err ? ' err' : it.state === 'sent' ? ' ok' : ''}`;
      s2.textContent = t(it.err ? ERR_TEXT[it.err] || ERR_TEXT.DENIED : pending ? 'Saving the original…' : STATE_TEXT[it.state] || '');
      mid.append(nm, s2);
      const acts = document.createElement('div'); acts.className = 'acts';
      if (it.state === 'failed' || it.state === 'refused') {
        if (!['BAD_FILE', 'TOO_BIG', 'CLOSED'].includes(it.err) && it.display) acts.append(btn('Retry', () => retry(it)));
        acts.append(btn('Remove', () => { dropItem(it).then(render); }));
      }
      li.append(img, mid, acts);
      ul.append(li);
    }
    // the photo-credit notes
    const name = proName();
    $('freeNote').hidden = !free();
    $('freeNote').textContent = name ? tf('Free events carry a small “Photo: {0}” credit and the Light Up the Skies mark.', name)
      : t('Free events carry a small “Photo: your name” credit and the Light Up the Skies mark.');
    $('creditRow').hidden = free();
  }
  function btn(label, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t(label);
    b.addEventListener('click', fn);
    return b;
  }
  async function retry(it) {
    it.state = 'ready'; it.err = ''; S.single = false;
    if (S.block === 'full') S.block = '';
    await countUsed();
    await saveItem(it);
    render(); pump();
  }
  let toastTimer = null;
  function toast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
  }
  // Keep the screen on while photos are being sent (a phone that sleeps stops the queue until it wakes).
  async function wake() {
    const busy = S.items.some((i) => ['raw', 'prep', 'ready', 'sending'].includes(i.state)) && !S.paused && !S.block;
    if (S.waking) return;
    S.waking = true;
    try {
      if (busy && !S.wake && navigator.wakeLock && document.visibilityState === 'visible') {
        const w = await navigator.wakeLock.request('screen');
        S.wake = w;
        w.addEventListener('release', () => { if (S.wake === w) S.wake = null; });
      } else if (!busy && S.wake) { const w = S.wake; S.wake = null; await w.release(); }
    } catch (e) { S.wake = null; /* not allowed here: the queue still resumes after the screen wakes */ } finally { S.waking = false; }
  }

  // ============================================================================================== my uploads ===
  function addMine(m, front) {
    if (!m || !m.id || S.mine.ids.has(m.id) || m.st === 3) return;
    S.mine.ids.add(m.id);
    const ul = $('mine');
    const li = document.createElement('li');
    li.dataset.id = m.id;
    const img = document.createElement('img');
    img.alt = ''; img.loading = 'lazy'; img.width = 104; img.height = 104;
    if (m.thumb && m.thumb.length) img.src = URL.createObjectURL(new Blob([m.thumb], { type: 'image/jpeg' }));
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'es-btn link danger'; del.textContent = t('Delete');
    del.addEventListener('click', () => askDelete(m.id, img.src));
    li.append(img, del);
    if (front) ul.prepend(li); else ul.append(li);
    $('mineMsg').textContent = '';
  }
  async function loadMine() {
    if (S.mine.done) return;
    const b = $('mineMore');
    b.disabled = true;
    try {
      const q = { from: 'media', where: [['by', '==', S.uid]], orderBy: [['at', 'asc']], limit: PAGE, select: ['st', 'at', 't'], auth: true };
      if (S.mine.cursor) q.startAfter = [ES.fs.ts(S.mine.cursor.at), ES.fs.ref(`events/${S.code}/media/${S.mine.cursor.id}`)];
      const docs = await ES.fs.query(`events/${S.code}`, q);
      for (const d of docs) addMine({ id: d._id, thumb: d.t, st: d.st }, false);
      if (docs.length) S.mine.cursor = { at: docs[docs.length - 1].at, id: docs[docs.length - 1]._id };
      S.mine.done = docs.length < PAGE;
      S.mine.loaded = true;
      if (!$('mine').children.length) $('mineMsg').textContent = t('No photos yet');
    } catch (e) { $('mineMsg').textContent = t(e.code === 'OFFLINE' ? 'No connection' : 'Something went wrong. Try again.'); }
    b.disabled = false;
    b.textContent = t('Show more');
    b.hidden = S.mine.done;
  }
  let delId = '';
  function askDelete(id, src) {
    delId = id;
    $('delImg').src = src || '';
    $('delImg').hidden = !src;
    $('delSheet').hidden = false;
    document.body.classList.add('es-locked');
    $('delNo').focus();
  }
  function closeDel() {
    if ($('delSheet').hidden) return false;
    $('delSheet').hidden = true; delId = '';
    document.body.classList.remove('es-locked');
    return true;
  }
  async function doDelete() {
    const id = delId;
    if (!id) return;
    const b = $('delYes');
    b.disabled = true;
    try {
      await ES.fs.commit([ES.fs.w.update(`events/${S.code}/media/${id}`, { st: 3, d: new Uint8Array(0), t: new Uint8Array(0), cp: '' }, { mask: ['st', 'd', 't', 'cp', 'mt'], serverTime: ['mt'] })], { auth: true });
      const li = document.querySelector(`#mine li[data-id="${CSS.escape(id)}"]`);
      if (li) li.remove();
      ES.bell.ring(S.code, 'e').catch(() => {}); // walls and the packer drop it
      if (r2on()) ESShop.cloud.remove(S.code, id).catch(() => {});
      closeDel();
      toast(t('Deleted'));
    } catch (e) { toast(t(e.code === 'OFFLINE' ? 'No connection' : 'Something went wrong. Try again.')); }
    b.disabled = false;
  }

  // ================================================================================================== start ===
  function gate(msg, showForm) {
    $('kicker').hidden = true; // the heading already says "Photographer upload"
    $('loading').hidden = true;
    $('scrMain').hidden = true;
    $('scrGate').hidden = false;
    $('gateMsg').textContent = t(msg);
    $('codeForm').hidden = !showForm;
  }
  function currentFn() { const s = $('fnPick'); return s && !$('fnRow').hidden ? s.value : ''; }
  function fmtDate(ms) {
    try { return new Intl.DateTimeFormat(`${(window.LUTSLang && LUTSLang.lang) || 'en'}-IN`, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: (S.ev && S.ev.tz) || undefined }).format(new Date(ms)); } catch (e) { return new Date(ms).toLocaleString(); }
  }
  function header() {
    const e = S.ev;
    $('title').textContent = e.title; $('title').setAttribute('data-no-i18n', '');
    document.title = `${e.title} · ${t('Photographer upload')}`;
    $('names').textContent = e.names || ''; $('names').hidden = !e.names;
    const now = ES.clock.now();
    $('when').textContent = now < e.opensAt ? tf('Uploads open on {0}.', fmtDate(e.opensAt)) : tf('Photos can be sent until {0}.', fmtDate(e.fu));
    const fns = e.fns || [];
    $('fnRow').hidden = !fns.length;
    if (fns.length) {
      const sel = $('fnPick');
      sel.textContent = '';
      const none = document.createElement('option'); none.value = ''; none.textContent = t('No particular function'); sel.append(none);
      let pick = '';
      for (const f of fns) { const o = document.createElement('option'); o.value = f.id; o.textContent = f.n; sel.append(o); if (f.at && f.at <= now) pick = f.id; }
      sel.value = pick;
    }
  }
  async function start() {
    window.LUTSBack = () => {
      if (closeDel()) return true;
      if (window.ESShop && ESShop.ui.close()) return true;
      if (window.LUTSNative) location.replace('index.html');
      else if (history.length > 1) history.back();
      return true;
    };
    $('codeForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const c = String($('codeIn').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (ES.CODE_RE.test(c)) location.href = `event-pro.html?e=${c}`;
      else $('gateMsg').textContent = t('No such event. Check the code.');
    });
    const qs = new URLSearchParams(location.search);
    const code = String(qs.get('e') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const j = String(qs.get('j') || '');
    if (!ES.CODE_RE.test(code)) return gate('Open the photographer link the hosts sent you.', true);
    S.code = code;
    if (j) {
      // The invite secret leaves the address bar (and history) whatever happens next.
      try { history.replaceState(null, '', `event-pro.html?e=${code}${qs.get('l') ? `&l=${encodeURIComponent(qs.get('l'))}` : ''}`); } catch (e) { /* file:// */ }
      const dot = j.indexOf('.');
      const role = dot > 0 ? j.slice(0, dot) : '', secret = dot > 0 ? j.slice(dot + 1) : '';
      if (role !== 'p') return gate('Ask the hosts for a photographer invite link.');
      try { await ES.roles.join(code, 'p', secret); } catch (e) {
        if (e.code === 'OFFLINE') return gate('No connection');
        return gate('This invite link no longer works. Ask the hosts for a new one.');
      }
    }
    try {
      S.cfg = await ES.cfg();
      if (S.cfg.pause) return gate('Event Sky is paused for a moment. Please try again later.');
      S.ev = await ES.events.get(code);
    } catch (e) {
      if (e.code === 'DENIED') return gate('Ask the hosts for a photographer invite link.');
      if (e.code === 'NOT_FOUND') return gate('No such event. Check the code.', true);
      if (e.code === 'OFFLINE') return gate('No connection');
      return gate('Something went wrong. Try again.');
    }
    S.uid = ES.staff.uid();
    S.role = S.ev.host === S.uid ? 'h' : (S.ev.roles || {})[S.uid] || '';
    if (!['h', 'c', 'p'].includes(S.role)) return gate('Ask the hosts for a photographer invite link.');
    // The server-time probe (es/{code}/sync/{uid}) is for the host, co-hosts, moderators and walls only (§2.6); a
    // photographer's PUT there is refused (a 401 in the console), so photographers take the Date header instead.
    await ES.clock.sync(S.role === 'p' ? undefined : code).catch(() => {});
    S.usedSet = new Set((lsGet(`luts:es-xs:${code}`, []) || []).map(Number).filter(Number.isInteger));
    const b = blockFor(S.ev);
    S.block = b.block; S.blockUntil = b.until || 0;
    if (b.block === 'early') { S.startTimer = setTimeout(() => { S.block = ''; recheck().then(pump); }, Math.min(2 ** 31 - 1, b.until - ES.clock.now() + 1500)); }
    await countUsed();
    header();
    $('proName').value = String(lsGet(NAME_KEY, '') || '');
    $('creditOn').checked = !!lsGet(CREDIT_KEY, false);
    $('loading').hidden = true;
    $('scrMain').hidden = false;
    await loadQueue();
    // inputs
    $('proName').addEventListener('input', () => { lsSet(NAME_KEY, proName()); render(); pump(); });
    $('creditOn').addEventListener('change', () => lsSet(CREDIT_KEY, $('creditOn').checked));
    const take = (input) => { const f = input.files; addFiles(f).finally(() => { input.value = ''; }); };
    $('pick').addEventListener('change', () => take($('pick')));
    $('pickZip').addEventListener('change', () => take($('pickZip')));
    const drop = $('drop');
    drop.addEventListener('click', () => $('pick').click());
    drop.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); $('pick').click(); } });
    for (const n of [drop, document.body]) {
      n.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('over'); });
      n.addEventListener('dragleave', () => drop.classList.remove('over'));
      n.addEventListener('drop', (ev) => { ev.preventDefault(); ev.stopPropagation(); drop.classList.remove('over'); addFiles(ev.dataTransfer && ev.dataTransfer.files); });
    }
    $('pauseBtn').addEventListener('click', () => { S.paused = !S.paused; render(); if (!S.paused) pump(); });
    $('clearBtn').addEventListener('click', async () => {
      for (const it of S.items.filter((i) => i.state === 'sent' && !(i.r2 && (i.r2.d === 'todo' || i.r2.o === 'todo')))) await dropItem(it);
      render();
    });
    $('mineMore').addEventListener('click', loadMine);
    $('delYes').addEventListener('click', doDelete);
    $('delNo').addEventListener('click', closeDel);
    $('delX').addEventListener('click', closeDel);
    $('delSheet').addEventListener('click', (ev) => { if (ev.target === $('delSheet')) closeDel(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeDel(); });
    window.addEventListener('online', () => { S.retryAt = 0; S.backoff = 0; S.offline = false; pump(); });
    window.addEventListener('offline', () => { S.offline = true; render(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { wake(); pump(); } });
    // the shop, for the photographer (only with es_cfg.shop)
    if (S.cfg.shop && window.ESShop) {
      $('shopCard').hidden = false;
      ESShop.ui.settings($('shopSettings'), code).catch(() => {});
      ESShop.ui.orders($('shopOrders'), code).catch(() => {});
    }
    draw(); // at once, not on the next frame: the page counts as ready with its text in place
    pump();
  }

  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  window.EventPro = {
    version: 1, ready, hooks,
    state: () => ({ code: S.code, uid: S.uid, role: S.role, left: S.left, used: S.used, pc: S.ev ? S.ev.cap.pc : 0, block: S.block, paused: S.paused,
      zips: S.srcs.length, dups: S.dups, counts: ['raw', 'prep', 'ready', 'sending', 'sent', 'failed', 'refused'].reduce((o, k) => Object.assign(o, { [k]: count(k) }), {}) }),
    items: () => S.items.map((i) => ({ key: i.key, name: i.name, state: i.state, err: i.err || '', id: i.id || '', fp: i.fp || '' })),
    add: (files) => addFiles(files),
    pump, pause: () => { S.paused = true; render(); }, resume: () => { S.paused = false; pump(); },
  };
  const boot = () => {
    if (!window.ES || !window.EM || !EM.zip) { gate('Something went wrong. Try again.'); readyResolve(false); return; }
    start().then(() => readyResolve(true), () => { gate('Something went wrong. Try again.'); readyResolve(false); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
