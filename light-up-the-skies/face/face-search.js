/* Event Sky selfie search: window.ESFace (face/face-search.js). Build spec research/event-sky-spec.md §3.8, §4.21.
 *
 * Bundled with the pages (face/ ships in the APK; web-only/ does not). This file and face-worker.js always load from the
 * page's own origin: inside the app, where the page has the native bridge (window.LUTSNative), no script from the website
 * ever runs on the page. Only data comes from cfg.faceBase (web-only/face/ on the website): the model library and its
 * weights, each checked against its SHA-256 in SUMS below, and nothing at all when SUMS is not filled in. The library
 * (third-party code) runs only inside a dedicated Worker, which has no window, no DOM and no bridge, and whose network
 * functions are switched off before the library starts. A faceBase that RTDB (es_cfg) hands over is used only when it
 * is on the page's own origin; otherwise the bundled event-config.js value is. Private by design:
 *  - Matching runs on the phone. Face descriptors live only inside the worker (face-worker.js) and are zero-filled when a
 *    search or a preparation ends; they are never stored, sent or handed to the page. The page only sees distances.
 *  - The hosts' device prepares encrypted pages of representative face crops (Firestore faces/{n}, 'ESF1', AES-GCM with
 *    the gallery key), up to 2 crops of 112 px per person. Guests who said no (guests.fo == false) are left out:
 *    faces within 0.45 of their selfie never enter a cluster, and a cluster whose centre is that close is dropped.
 *  - A guest's search describes their selfie and every crop in memory; 'likely' below 0.45, 'maybe' below 0.55.
 *    "Not me" removes a person and re-ranks the rest.
 *
 * Files: face-worker.js (this project) sits next to this file. From cfg.faceBase, cached in Cache Storage 'luts-face-v1'
 *  (see web-only/face/README.md), from @vladmandic/face-api (MIT): face-api.js (the IIFE build, tfjs inside),
 *  tiny_face_detector_model-weights_manifest.json + .bin, face_landmark_68_tiny_model-weights_manifest.json + .bin,
 *  face_recognition_model-weights_manifest.json + .bin. The worker runs from a Blob made of a short prelude (no fetch,
 *  XHR, sockets or importScripts), face-api.js and face-worker.js, so it needs only `worker-src blob:`; it fetches
 *  nothing itself (the weights are handed to it).
 *  A model other than face-api can be plugged in by shipping, under the name face-api.js, a script that sets
 *  self.ESFaceEngine = {name, load(models), detect(imageData, {minScore, inputSize}), describe(imageData)} (see face-worker.js).
 *
 * API:
 *  ESFace.available() (sync) → boolean (the browser can run it; the gallery also checks es_cfg.face and ft.sx)
 *  ESFace.load({onProgress(fraction 0..1)}) → {engine, backend}   (UNSUPPORTED while SUMS is empty)
 *  ESFace.prepare(code, {items:[{gi, bytes}], key?, excludeSelfies:[bytes], onProgress(fraction, {stage, done, total})})
 *     → {pages, faces, clusters, reps, excluded, dropped}  (host or co-host; writes faces/{n} and the manifest's fc;
 *       lease lk/face). stage: 'load' | 'faces' | 'cluster' | 'write'.
 *  ESFace.search(code, {key, selfie: Blob, onResult(results), onProgress(fraction, {done, total})}) → results
 *     results = {likely:[{c, d, gis, crop: Blob}], maybe:[…], photos:{likely:[gi], maybe:[gi]}, looked, total, none, done}
 *  ESFace.notMe(c) → results (re-ranked);  ESFace.forget() (sync: the worker wipes every descriptor)
 *  ESFace.clearCache() → removes the cached files;  ESFace.FILES, ESFace.THRESHOLDS, ESFace.VERSION
 * Errors are ESError {code, status, message}: UNSUPPORTED (this browser cannot run it), OFFLINE (a file did not
 * download), BAD_FILE (a file is damaged or fails its SHA-256), NOT_FOUND (not prepared), BUSY (another device is
 * preparing), DENIED (the event does not allow selfie search, or a wrong key), CLOSED (the gallery has ended).
 * No user-visible strings: the gallery page owns the copy.
 */
(function () {
  'use strict';
  if (window.ESFace) return;

  const VERSION = 1;
  const CACHE = `luts-face-v${VERSION}`;
  const LIB = 'face-api.js';
  const WORKER = 'face-worker.js';
  // [face-api network, model file stem]: the manifest is `${stem}-weights_manifest.json`, its paths name the .bin files.
  const NETS = [['tinyFaceDetector', 'tiny_face_detector_model'], ['faceLandmark68TinyNet', 'face_landmark_68_tiny_model'],
    ['faceRecognitionNet', 'face_recognition_model']];
  // SHA-256 (hex) of each vendored file, filled in when the files are vendored (web-only/face/README.md step 4). Every
  // file from cfg.faceBase needs its sum here: without one it is never fetched (selfie search stays unavailable), a
  // download that does not match is refused and a cached copy that does not match is fetched again.
  const SUMS = Object.freeze({});
  const NOMINAL_BYTES = 7.3e6;          // about 7 MB: the copy says so
  const T = Object.freeze({ cluster: 0.5, exclude: 0.45, likely: 0.45, maybe: 0.55 });
  const PAGE_REPS = 300, MAX_PAGES = 24, CROP = 112, DETECT_SIDE = 1024, SELFIE_SIDE = 640;

  const ES = () => window.ES;
  const E = (code, status, message) => {
    if (window.ES && ES().err) return ES().err(code, status, message);
    const e = new Error(message || code); e.code = code; e.status = status || 0; return e;
  };
  // Where the data files come from: the bundled config (event-config.js), or es_cfg's faceBase when it is on this page's
  // own origin (never a host that RTDB names).
  const sameOrigin = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; } };
  const base = () => {
    const own = String((window.LUTS_EVENT || {}).faceBase || '');
    let pick = own;
    try {
      const c = window.ES && ES().cfg && ES().cfg.cached ? ES().cfg.cached() : null;
      const given = c && typeof c.faceBase === 'string' ? c.faceBase : '';
      if (given && given !== own && sameOrigin(given)) pick = new URL(given, location.href).href;
    } catch (e) { pick = own; }
    return pick ? pick.replace(/\/?$/, '/') : '';
  };
  // This file's own folder (bundled): face-worker.js is read from here, from the page's origin only.
  const HERE = (() => {
    try { const src = document.currentScript && document.currentScript.src; if (src) return new URL('.', src).href; } catch (e) { /* none */ }
    return new URL('face/', location.href).href;
  })();
  // Every file from faceBase that load() needs before the manifests are read; the .bin files they name need sums too.
  const NEED = [LIB].concat(NETS.map(([, stem]) => `${stem}-weights_manifest.json`));
  const hasSums = () => NEED.every((n) => /^[0-9a-f]{64}$/.test(SUMS[n] || ''));
  // Runs first in the worker: the library gets no way to reach the network or load more code.
  const PRELUDE = '(function(){"use strict";var no=function(){throw new Error("blocked");};'
    + 'try{self.fetch=function(){return Promise.reject(new Error("blocked"));};}catch(e){}'
    + '["XMLHttpRequest","WebSocket","EventSource","importScripts"].forEach(function(k){try{self[k]=no;}catch(e){}});})();\n';
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(buf) { return hex(await crypto.subtle.digest('SHA-256', buf)); }
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));

  function available() {
    try {
      return typeof Worker === 'function' && typeof Blob === 'function' && !!(URL && URL.createObjectURL) && typeof fetch === 'function'
        && typeof createImageBitmap === 'function' && !!(window.crypto && crypto.subtle) && typeof ImageData === 'function'
        && !!(window.EM && EM.faces) && !!window.ES && /^https?:\/\//.test(base()) && hasSums() && sameOrigin(HERE);
    } catch (e) { return false; }
  }

  // ================================================================================================= files ===
  async function openCache() { try { return window.caches ? await caches.open(CACHE) : null; } catch (e) { return null; } }
  function cleanOldCaches() {
    if (!window.caches || !caches.keys) return;
    caches.keys().then((keys) => keys.filter((k) => /^luts-face-v\d+$/.test(k) && k !== CACHE).forEach((k) => caches.delete(k))).catch(() => {});
  }
  const typeFor = (name) => (/\.json$/.test(name) ? 'application/json' : /\.js$/.test(name) ? 'text/javascript' : 'application/octet-stream');
  async function download(url, onBytes) {
    let r;
    try { r = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache' }); } catch (e) { throw E('OFFLINE', 0, 'The face finder did not download'); }
    if (!r.ok) throw E(r.status === 404 ? 'NOT_FOUND' : 'OFFLINE', r.status, `Face finder file missing: ${url.split('/').pop()}`);
    if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); onBytes(b.byteLength); return b; }
    const reader = r.body.getReader(), parts = [];
    let n = 0;
    for (;;) {
      let step;
      try { step = await reader.read(); } catch (e) { throw E('OFFLINE', 0, 'The face finder download stopped'); }
      if (step.done) break;
      parts.push(step.value); n += step.value.length; onBytes(step.value.length);
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out.buffer;
  }
  async function getFile(cache, name, sums, onBytes) {
    if (!/^[0-9a-f]{64}$/.test(sums[name] || '')) throw E('BAD_FILE', 0, `${name} has no SHA-256 in SUMS`);
    const url = base() + name;
    if (cache) {
      const hit = await cache.match(url).catch(() => null);
      if (hit) {
        const buf = await hit.arrayBuffer();
        if ((await sha256(buf)) === sums[name]) { onBytes(buf.byteLength); return buf; }
        await cache.delete(url).catch(() => {});
      }
    }
    const buf = await download(url, onBytes);
    if ((await sha256(buf)) !== sums[name]) throw E('BAD_FILE', 0, `${name} does not match its SHA-256`);
    if (cache) await cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': typeFor(name) } })).catch(() => { /* storage full: next time it downloads again */ });
    return buf;
  }
  // A bundled file next to this one (same origin only; the HTTP cache keeps it).
  async function ownFile(name) {
    const url = new URL(name, HERE).href;
    if (!sameOrigin(url)) throw E('UNSUPPORTED', 0, 'The face finder must be bundled with the page');
    let r;
    try { r = await fetch(url, { credentials: 'same-origin' }); } catch (e) { throw E('OFFLINE', 0, `${name} did not load`); }
    if (!r.ok) throw E('NOT_FOUND', r.status, `${name} is missing`);
    return r.arrayBuffer();
  }
  const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
  function parseManifest(buf, stem) {
    let m;
    try { m = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { throw E('BAD_FILE', 0, `${stem} manifest is not JSON`); }
    if (!Array.isArray(m) || !m.length) throw E('BAD_FILE', 0, `${stem} manifest is empty`);
    return m.map((g) => {
      if (!g || !Array.isArray(g.paths) || !g.paths.length || !Array.isArray(g.weights)) throw E('BAD_FILE', 0, `${stem} manifest is damaged`);
      for (const p of g.paths) if (typeof p !== 'string' || !SAFE_PATH.test(p)) throw E('BAD_FILE', 0, `${stem} manifest names a bad path`);
      return { paths: g.paths.slice(), weights: g.weights };
    });
  }

  // ================================================================================================ worker ===
  let worker = null, workerUrl = '', loadP = null, info = null, seq = 0, progressFn = null;
  const pending = new Map();
  function terminate(why) {
    if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } }
    worker = null;
    if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = ''; }
    for (const p of pending.values()) p.reject(E('UNSUPPORTED', 0, why || 'The face finder stopped'));
    pending.clear();
    loadP = null; info = null;
  }
  function call(op, data, transfer) {
    if (!worker) return Promise.reject(E('UNSUPPORTED', 0, 'The face finder is not loaded'));
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      try { worker.postMessage(Object.assign({ id, op }, data || {}), transfer || []); } catch (e) { pending.delete(id); reject(E('UNSUPPORTED', 0, String(e && e.message || e))); }
    });
  }
  function onMessage(ev) {
    const m = ev.data || {};
    if (m.progress) { if (progressFn) { try { progressFn(m.progress); } catch (e) { /* the caller's */ } } return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.result); else p.reject(E((m.error && m.error.code) || 'UNSUPPORTED', 0, (m.error && m.error.message) || 'The face finder failed'));
  }

  function load(o = {}) {
    if (loadP) {
      if (o.onProgress) loadP.then(() => { try { o.onProgress(1); } catch (e) { /* ignore */ } }, () => {});
      return loadP;
    }
    loadP = (async () => {
      if (!hasSums()) throw E('UNSUPPORTED', 0, 'The face finder is not set up (no checksums)');
      if (!available()) throw E('UNSUPPORTED', 0, 'Selfie search needs a newer browser');
      const sums = SUMS;
      const cache = await openCache();
      cleanOldCaches();
      let got = 0, total = NOMINAL_BYTES;
      const tick = (n) => {
        got += n; if (got > total * 0.98) total = got / 0.98;
        if (o.onProgress) { try { o.onProgress(Math.min(0.99, got / total)); } catch (e) { /* the caller's */ } }
      };
      const manifests = {};
      for (const [net, stem] of NETS) manifests[net] = parseManifest(await getFile(cache, `${stem}-weights_manifest.json`, sums, tick), stem);
      const bins = [...new Set(Object.values(manifests).flatMap((gs) => gs.flatMap((g) => g.paths)))];
      const files = {};
      for (const name of [LIB].concat(bins)) files[name] = await getFile(cache, name, sums, tick);
      files[WORKER] = await ownFile(WORKER);
      // One classic worker: the prelude, the model library, then this project's worker code. Nothing is imported.
      workerUrl = URL.createObjectURL(new Blob([PRELUDE, files[LIB], '\n;\n', files[WORKER]], { type: 'text/javascript' }));
      try { worker = new Worker(workerUrl); } catch (e) { throw E('UNSUPPORTED', 0, 'This page may not start the face finder'); }
      worker.onmessage = onMessage;
      worker.onerror = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); terminate(`The face finder failed: ${(ev && ev.message) || 'error'}`); };
      const models = {}, transfer = [];
      for (const [net] of NETS) {
        models[net] = manifests[net].map((g) => {
          const buffers = g.paths.map((p) => files[p].slice(0));
          transfer.push(...buffers);
          return { weights: g.weights, buffers };
        });
      }
      info = await call('init', { models }, transfer);
      if (o.onProgress) { try { o.onProgress(1); } catch (e) { /* ignore */ } }
      return info;
    })();
    loadP.catch(() => terminate());
    return loadP;
  }

  // ================================================================================================ images ===
  function canvas(w, h) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function toBlob(c, type, q) {
    if (c.convertToBlob) return c.convertToBlob({ type, quality: q });
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(E('BAD_FILE', 0, 'Could not encode a crop'))), type, q));
  }
  async function decode(input, maxSide) {
    const blob = input instanceof Blob ? input : new Blob([input]);
    let bmp;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) {
      try { bmp = await createImageBitmap(blob); } catch (x) { throw E('BAD_FILE', 0, 'That photo did not open'); }
    }
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = canvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return { c, w, h, data: g.getImageData(0, 0, w, h) };
  }
  const msgOf = (im) => ({ w: im.data.width, h: im.data.height, data: im.data.data.buffer });
  function free(im) { if (im && im.c) { im.c.width = 1; im.c.height = 1; } }
  // A 112 px square crop of the face box, padded with black (as the recognition net pads its input), JPEG.
  async function crop(im, box) {
    let [x, y, w, h] = box.map((v) => +v || 0);
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(im.w - x, w); h = Math.min(im.h - y, h);
    if (!(w >= 4 && h >= 4)) return null;
    const c = canvas(CROP, CROP), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, CROP, CROP);
    const k = CROP / Math.max(w, h), dw = w * k, dh = h * k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(im.c, x, y, w, h, (CROP - dw) / 2, (CROP - dh) / 2, dw, dh);
    const b = await toBlob(c, 'image/jpeg', 0.82);
    c.width = c.height = 1;
    return b;
  }

  // ================================================================================================ prepare ===
  async function lease(code, on) {
    const path = `es/${code}/lk/face`, uid = ES().staff.uid();
    if (!on) { await ES().db.del(path, { auth: true }).catch(() => {}); return; }
    const cur = await ES().db.get(path, { auth: true }).catch((e) => { if (e.code === 'DENIED') throw E('DENIED', 403, 'Only the event team can prepare selfie search'); throw e; });
    if (cur && cur.u !== uid && +cur.un > ES().clock.now()) throw E('BUSY', 0, 'Selfie search is being prepared on another device');
    await ES().db.put(path, { u: uid, un: ES().clock.now() + 100e3 }, { auth: true });
  }
  async function prepare(code, o = {}) {
    const es = ES();
    if (!es || !es.CODE_RE.test(String(code))) throw E('NOT_FOUND', 0, 'Not an event code');
    // One fraction for the whole job (download 0–10 %, faces 10–80 %, people 80–90 %, pages 90–100 %), plus the detail.
    const SPAN = { load: [0, 0.1], faces: [0.1, 0.8], cluster: [0.8, 0.9], write: [0.9, 1] };
    const report = (stage, done, total) => {
      if (!o.onProgress) return;
      const [a, b] = SPAN[stage] || [0, 1], f = a + (b - a) * (total > 0 ? Math.min(1, done / total) : 0);
      try { o.onProgress(Math.round(f * 1000) / 1000, { stage, done, total }); } catch (e) { /* the caller's */ }
    };
    await es.staff.token();
    await es.clock.sync(code).catch(() => {});
    const ev = await es.events.get(code);
    if (!(ev.cap && ev.cap.sx) || !(ev.ft && ev.ft.sx)) throw E('DENIED', 0, 'Selfie search is not on for this event');
    const key = o.key || await es.gallery.key.get(code);
    await load({ onProgress: (f) => report('load', f, 1) });
    await lease(code, true);
    let leaseAt = Date.now();
    const keepLease = async () => { if (Date.now() - leaseAt > 50e3) { leaseAt = Date.now(); await lease(code, true); } };
    const items = (o.items || []).filter((it) => it && Number.isInteger(+it.gi) && +it.gi >= 0 && it.bytes);
    const faces = new Map(); // ref -> {gi, crop}
    try {
      await call('forget');
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        let im = null;
        try {
          im = await decode(it.bytes, DETECT_SIDE);
          const r = await call('detect', { img: msgOf(im), tag: 'face', minScore: 0.5 }, [im.data.data.buffer]);
          for (const f of r.faces) {
            const cr = await crop(im, f.box);
            if (cr && f.ref) faces.set(f.ref, { gi: Math.round(+it.gi), crop: cr });
            else if (f.ref) await call('drop', { refs: [f.ref] });
          }
        } catch (e) {
          if (e && e.code === 'UNSUPPORTED') throw e; // the worker itself failed
          /* one picture that does not open must not stop the rest */
        } finally { free(im); }
        report('faces', i + 1, items.length);
        await keepLease();
        if (i % 8 === 7) await yieldNow();
      }
      let excluded = 0;
      for (const sel of o.excludeSelfies || []) {
        let im = null;
        try {
          im = await decode(sel, SELFIE_SIDE);
          const r = await call('detect', { img: msgOf(im), tag: 'excl', minScore: 0.35 }, [im.data.data.buffer]);
          if (r.faces.length) excluded++;
        } catch (e) { if (e && e.code === 'UNSUPPORTED') throw e; } finally { free(im); }
      }
      progressFn = (p) => report('cluster', p.done, p.total);
      const cl = await call('cluster', { threshold: T.cluster, exclude: T.exclude, seed: fnv(code) });
      progressFn = null;
      await keepLease();
      // Representatives: the most central face of each person and the next one (2 at most), with every photo of that person.
      const reps = [];
      let c = 0;
      for (const group of cl.clusters) {
        const members = group.refs.filter((r) => faces.has(r));
        if (!members.length) continue;
        const gis = [...new Set(members.map((r) => faces.get(r).gi))].sort((a, b) => a - b);
        const take = members.slice(0, members.length > 1 ? 2 : 1);
        if (reps.length + take.length > PAGE_REPS * MAX_PAGES) break;
        for (const r of take) reps.push({ c, gis, crop: faces.get(r).crop });
        c++;
      }
      const pages = [];
      for (let i = 0; i < reps.length; i += PAGE_REPS) pages.push(await window.EM.faces.encode(reps.slice(i, i + PAGE_REPS), key));
      const man = await es.gallery.manifest(code);
      const before = man ? man.fc : 0;
      const e2 = await es.events.get(code);
      for (let n = 0; n < pages.length; n++) {
        await es.fs.commit([es.fs.w.update(`events/${code}/faces/${n}`, { pk: pages[n], c: Math.min(PAGE_REPS, reps.length - n * PAGE_REPS), se: true,
          vr: (man && man.vr) || 0, xp: es.fs.ts(e2.expiresAt) }, { serverTime: ['at'] })], { auth: true });
        report('write', n + 1, pages.length);
        await keepLease();
      }
      if (man) {
        await es.fs.commit([es.fs.w.update(`events/${code}/pub/g`, { fc: pages.length, xp: es.fs.ts(e2.expiresAt) }, { mask: ['fc', 'xp', 'at'], serverTime: ['at'] })], { auth: true });
      } else {
        await es.gallery.writeManifest(code, { pc: 0, fc: pages.length, vr: 0, gi: 0 }, { noBell: true });
      }
      // Pages beyond the new count belonged to the previous preparation.
      const stale = [];
      for (let n = pages.length; n < Math.min(MAX_PAGES, Math.max(before, 0)); n++) stale.push(es.fs.w.del(`events/${code}/faces/${n}`));
      if (stale.length) await es.fs.commit(stale, { auth: true }).catch(() => { /* expired or gone */ });
      await es.bell.ring(code, 'p').catch(() => {});
      report('write', 1, 1);
      return { pages: pages.length, faces: faces.size, clusters: c, reps: reps.length, excluded, dropped: cl.dropped || 0 };
    } finally {
      progressFn = null;
      faces.clear();
      await call('forget').catch(() => {});
      await lease(code, false);
    }
  }

  // ================================================================================================= search ===
  let last = null; // {clusters: Map c -> {c, d, gis:Set, crop, refs:[]}, rejected:Set, looked, total, done}
  function rank(st) {
    const likely = [], maybe = [];
    if (st && !st.none) {
      for (const x of st.clusters.values()) {
        if (st.rejected.has(x.c)) continue;
        const tier = (x.d < T.likely ? 0 : x.d < T.maybe ? 1 : 2) + (x.demote || 0);
        const out = { c: x.c, d: Math.round(x.d * 1000) / 1000, gis: [...x.gis].sort((a, b) => a - b), crop: x.crop };
        if (tier === 0) likely.push(out); else if (tier === 1) maybe.push(out);
      }
    }
    const by = (a, b) => a.d - b.d || a.c - b.c;
    likely.sort(by); maybe.sort(by);
    const pl = [...new Set(likely.flatMap((x) => x.gis))].sort((a, b) => a - b);
    const seen = new Set(pl);
    const pm = [...new Set(maybe.flatMap((x) => x.gis))].filter((g) => !seen.has(g)).sort((a, b) => a - b);
    return { likely, maybe, photos: { likely: pl, maybe: pm }, looked: st ? st.looked : 0, total: st ? st.total : 0, none: !!(st && st.none), done: !!(st && st.done) };
  }
  async function search(code, o = {}) {
    const es = ES();
    if (!es || !es.CODE_RE.test(String(code))) throw E('NOT_FOUND', 0, 'Not an event code');
    if (!o.selfie) throw E('BAD_FILE', 0, 'No selfie');
    const progress = (done, total) => { if (o.onProgress) { try { o.onProgress(total > 0 ? done / total : 0, { done, total }); } catch (e) { /* ignore */ } } };
    await load();
    await call('forget');
    last = null;
    const man = await es.gallery.manifest(code);
    const fc = man ? Math.min(MAX_PAGES, Math.max(0, man.fc | 0)) : 0;
    if (!fc) throw E('NOT_FOUND', 0, 'Selfie search is not ready for this event');
    const st = { code, clusters: new Map(), rejected: new Set(), looked: 0, total: 0, none: false, done: false };
    // The selfie: the largest face becomes the probe (inside the worker).
    let im = null;
    try {
      im = await decode(o.selfie, SELFIE_SIDE);
      const r = await call('detect', { img: msgOf(im), tag: 'probe', minScore: 0.35 }, [im.data.data.buffer]);
      if (!r.faces.length) { st.none = true; st.done = true; last = st; return rank(st); }
    } finally { free(im); }
    // Every face page (about 4 for a big wedding), then each representative crop.
    const pages = [];
    for (let n = 0; n < fc; n++) {
      let d;
      try { d = await es.fs.get(`events/${code}/faces/${n}`, { auth: false }); } catch (e) {
        if (e.code === 'DENIED') throw E('CLOSED', e.status, 'This gallery has ended.');
        throw e;
      }
      if (!d || !d.pk) continue;
      const reps = await window.EM.faces.decode(d.pk, o.key);
      pages.push(reps);
      st.total += reps.length;
    }
    last = st;
    progress(0, st.total);
    for (const reps of pages) {
      for (const rep of reps) {
        if (last !== st) throw E('BUSY', 0, 'A newer search started');
        let cim = null;
        try {
          if (rep.crop) {
            cim = await decode(rep.crop, CROP);
            const r = await call('describe', { img: msgOf(cim), tag: 'rep' }, [cim.data.data.buffer]);
            if (r && r.ref && typeof r.d === 'number') {
              let x = st.clusters.get(rep.c);
              if (!x) { x = { c: rep.c, d: Infinity, gis: new Set(), crop: null, refs: [] }; st.clusters.set(rep.c, x); }
              x.refs.push(r.ref);
              for (const g of rep.gis || []) if (Number.isInteger(g) && g >= 0) x.gis.add(g);
              if (r.d < x.d) { x.d = r.d; x.crop = rep.crop; }
            }
          }
        } catch (e) { if (e && (e.code === 'UNSUPPORTED' || e.code === 'BUSY')) throw e; /* a damaged crop is skipped */ } finally { free(cim); }
        st.looked++;
        if (st.looked % 20 === 0 || st.looked === st.total) progress(st.looked, st.total);
      }
      if (o.onResult) { try { o.onResult(rank(st)); } catch (e) { /* the caller's */ } }
    }
    st.done = true;
    progress(st.looked, st.total);
    return rank(st);
  }
  // "Not me": that person goes; anyone who looks more like them than like the selfie moves down a tier.
  async function notMe(c) {
    const st = last;
    if (!st || st.none) return rank(st);
    st.rejected.add(c);
    const rejected = [...st.rejected].flatMap((rc) => (st.clusters.get(rc) || { refs: [] }).refs);
    const groups = [...st.clusters.values()].filter((x) => !st.rejected.has(x.c)).map((x) => ({ c: x.c, refs: x.refs }));
    let near = {};
    if (rejected.length && groups.length) { try { near = await call('near', { groups, against: rejected }); } catch (e) { near = {}; } }
    for (const x of st.clusters.values()) {
      if (st.rejected.has(x.c)) continue;
      x.demote = typeof near[x.c] === 'number' && near[x.c] < x.d ? 1 : 0;
    }
    return rank(st);
  }
  function forget() {
    last = null;
    if (worker) call('forget').catch(() => {});
  }
  async function clearCache() {
    terminate('cleared');
    if (window.caches) { const keys = await caches.keys().catch(() => []); await Promise.all(keys.filter((k) => /^luts-face-v\d+$/.test(k)).map((k) => caches.delete(k))); }
  }

  window.ESFace = Object.freeze({
    VERSION,
    FILES: Object.freeze({ library: LIB, worker: WORKER, models: NETS.map(([net, stem]) => ({ net, manifest: `${stem}-weights_manifest.json` })), cache: CACHE }),
    THRESHOLDS: T,
    available, load, prepare, search, notMe, forget, clearCache,
    state: () => ({ loaded: !!info, engine: info ? info.engine : '', backend: info ? info.backend : '', base: base(), here: HERE, ready: hasSums(), searching: !!last }),
  });
})();
