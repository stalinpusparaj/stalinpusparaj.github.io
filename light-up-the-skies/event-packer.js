/* Event Sky packer: window.ESPacker (build spec research/event-sky-spec.md §3.6 "Packer", §4.8, §4.15, §4.25).

   Turns the approved photos and videos of an event into the gallery's encrypted pages: 100 thumbnails of 180 px a
   page (EM.page, AES-GCM with the gallery key), written to Firestore pages/{n}, with the manifest pub/g {pc, fc, vr, gi, pv}.
   vr counts every write; pv[n] is page n's own version, bumped only when page n is rewritten, so a gallery refetches
   just the pages that changed.
   It runs on one device at a time, the holder of the RTDB lease es/{code}/lk/pack (60 s, renewed every 30 s): a 'main'
   wall first, otherwise any wall (after 45 s), otherwise the host console (after 90 s). On one machine a Web Lock keeps
   it to one window.
     1. Indexing: each approved and revealed item, in mt order, gets the next gallery index gi and joins the open page.
     2. Writing: the open page is written when it has news and 120 s have passed since its last write; at 100 items it
        is sealed (written at once) and the next page opens. The manifest follows and rings b/p.
     3. Removing: a hidden or erased item is taken out of its page (rewritten, vr + 1, pv[n] + 1); its gi stays unused; face
        pages are switched off (fc = 0) until the hosts update selfie search.
     4. Disposable camera: items wait until their reveal time.
     5. A new gallery key or a new expiry date rewrites every page.
     6. Statuses: RTDB st/{seat} {s, t} for each change, batched every 5 s (t = when the item shows on the big screen).
        24 h after closesAt the live key pub/gk is removed: guests then need the gallery link (their phones keep theirs).
     7. Metering: es_meter every 5 minutes (this device's Firestore use plus an estimate for the guests' commits).
     8. Sweep: ES.sweep(code) at most every 6 hours.
   Data source: the wall's cache (no extra reads), or, on the host console, its own doorbell and delta queries without
   the display bytes.

   PageItem (the format WP-G's gallery reads): {gi, id, kd 'p'|'v', s seat (-1 photographer), nm guest name, fn, m,
   cp caption, w, h, at (sent, ms), du (video ms), o (the full-size copy is kept until, ms), l (1 = highlight), thumb}.

   API: ESPacker.start(code, {key, wallCache?, prio?: 'main'|'wall'|'host', onState?}) → {stop(), setKey(k), poke(),
   state(), giOf(id)}; ESPacker.state() → {pages, gi, pending, lease, ...}; ESPacker.tune(o) (tests).

STRINGS:
(none: the packer shows nothing)
*/
(function () {
  'use strict';
  if (window.ESPacker) return;

  const SEC = 1e3, MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const TUNE = {
    tick: 5 * SEC, minGap: 120 * SEC, lease: 60 * SEC, renew: 30 * SEC, retry: 10 * SEC,
    grace: { main: 0, wall: 45 * SEC, host: 90 * SEC },
    statusEvery: 5 * SEC, meterEvery: 5 * MIN, sweepFirst: 90 * MIN, sweepEvery: 6 * HOUR,
    perTick: 60, maxBytes: 880000, perPage: 100,
  };
  const MEDIA_SEL = ['s', 'k', 'kd', 't', 'w', 'h', 'du', 'fn', 'm', 'cp', 'st', 'mt', 'at', 'rv', 'hl', 'by', 'xp'];
  const noop = () => {};
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const warn = (what, e) => { try { if (window.console) console.warn(`ESPacker ${what}:`, (e && (e.code || e.message)) || e); } catch (x) { /* none */ } };
  async function toU8(x) {
    if (!x) return null;
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (typeof Blob !== 'undefined' && x instanceof Blob) return new Uint8Array(await x.arrayBuffer());
    return null;
  }
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }

  let current = null;

  function create(code, opts) {
    const ES = window.ES;
    const prio = TUNE.grace[opts.prio] !== undefined ? opts.prio : 'main';
    const cache = opts.wallCache || null;
    const P = {
      code, prio, stopped: false, lease: false, leaseUntil: 0, ready: false, loading: null, full: false, error: '',
      key: null, keyStr: '', keyHash: '', m: { pc: 0, fc: 0, vr: 0, gi: 0, pv: [] }, pages: [], index: new Map(), removed: new Map(),
      xp: 0, zeroFaces: false, writes: 0, pageWrites: 0, lastWrite: 0, pending: 0, writing: false,
      stSent: new Map(), statusAt: 0, meterAt: Date.now(), sweepAt: Date.now() + TUNE.sweepFirst, gkDone: false,
      est: 0, seen: new Set(), timers: [], releaseLock: null, unsub: null,
      feed: null, // standalone data (host console)
    };
    // ------------------------------------------------------------------------------------------------- the key ---
    async function setKey(k) {
      const u8 = typeof k === 'string' ? ES.b64u.dec(k) : await toU8(k);
      if (!u8 || u8.length !== 32) throw ES.err('DENIED', 0, 'A gallery key has 32 bytes');
      const str = ES.b64u.enc(u8);
      if (str === P.keyStr) return;
      const had = !!P.keyStr;
      P.key = u8; P.keyStr = str; P.keyHash = fnv(str);
      if (had && P.ready) { for (const pg of P.pages) pg.force = true; persist().catch(noop); } // a new link: every page again
    }

    // ------------------------------------------------------------------------------------------------ the lease ---
    async function leaseTick() {
      if (P.stopped) return;
      const uid = ES.staff.uid();
      if (!uid) { lose(); return; }
      const nowS = ES.clock.now();
      let lk;
      try { lk = await ES.db.get(`es/${code}/lk/pack`, { auth: true }); } catch (e) {
        if (e && e.code === 'DENIED') lose(); // not staff (any more)
        else if (P.lease && Date.now() > P.leaseUntil) lose(); // offline past the lease: someone else may pack now
        return;
      }
      const mine = !!(lk && lk.u === uid);
      if (!mine && lk && +lk.un >= nowS - TUNE.grace[prio]) { lose(); return; }
      if (mine && P.lease && +lk.un - nowS > TUNE.lease - TUNE.renew + 5 * SEC) return; // renewed recently enough
      try {
        await ES.db.put(`es/${code}/lk/pack`, { u: uid, un: Math.round(nowS + TUNE.lease) }, { auth: true });
        P.lease = true; P.leaseUntil = Date.now() + TUNE.lease - 5 * SEC;
        if (!P.ready && !P.loading) P.loading = load().catch((e) => { P.error = String((e && e.code) || e); warn('load', e); }).finally(() => { P.loading = null; });
      } catch (e) { lose(); }
    }
    function lose() {
      if (P.lease) { P.lease = false; P.ready = false; stopFeed(); }
      P.lease = false;
    }
    async function release() {
      if (!P.lease) return;
      P.lease = false;
      try { await ES.db.put(`es/${code}/lk/pack`, { u: ES.staff.uid(), un: Math.round(ES.clock.now()) }, { auth: true }); } catch (e) { /* it expires in 60 s */ }
    }

    // ---------------------------------------------------------------------------------- state: load and persist ---
    const thumbKey = (n) => `${code}/pk/${n}`;
    // pv: one version per page (manifest pub/g.pv). A manifest from before pv: every page starts at 0.
    function pvList(m) { return Array.isArray(m && m.pv) ? m.pv.map((v) => Math.max(0, Math.round(+v) || 0)) : []; }
    function pvOut(pc) { const out = []; for (let n = 0; n < pc; n++) out.push(Math.max(0, Math.round(+P.m.pv[n]) || 0)); P.m.pv = out.slice(); return out; }
    function pageOpts(m, n) {
      const pv = ES.gallery.pageVersion ? ES.gallery.pageVersion(m, n) : (Array.isArray(m && m.pv) ? m.pv[n] : undefined);
      return pv === undefined || pv === null ? { vr: m.vr } : { vr: m.vr, pv };
    }
    async function load() {
      const m = await ES.gallery.manifest(code, { maxAge: 0 });
      const pub = await pubNow();
      P.xp = pub ? +pub.x || 0 : 0;
      let local = null;
      try { local = await ES.idb.get('cursors', `pack/${code}`); } catch (e) { local = null; }
      P.pages = []; P.index.clear();
      if (local && m && local.keyHash === P.keyHash && local.vr === m.vr && local.gi === m.gi && local.pc === m.pc && Array.isArray(local.pages)) {
        P.m = { pc: m.pc, fc: m.fc || 0, vr: m.vr, gi: m.gi, pv: pvList(m) };
        for (const pg of local.pages) P.pages.push({ n: pg.n, items: pg.items || [], thumbs: null, sealed: !!pg.sealed, dirty: false, force: false, lastWrite: +pg.lastWrite || 0 });
        P.removed = new Map(local.removed || []);
        if (local.xp && P.xp && local.xp !== P.xp) P.pages.forEach((pg) => { pg.force = true; });
      } else if (m && m.pc > 0) {
        P.m = { pc: m.pc, fc: m.fc || 0, vr: m.vr || 0, gi: m.gi || 0, pv: pvList(m) };
        let lost = false;
        for (let n = 0; n < m.pc && !P.stopped; n++) {
          let items;
          try { items = await ES.gallery.page(code, n, P.key, pageOpts(m, n)); } catch (e) { if (e && (e.code === 'DENIED' || e.code === 'BAD_FILE')) { lost = true; break; } throw e; }
          const thumbs = new Map(), list = [];
          for (const it of items) { const t = await toU8(it.thumb); const x = Object.assign({}, it); delete x.thumb; list.push(x); thumbs.set(x.id, t || new Uint8Array(0)); }
          P.pages.push({ n, items: list, thumbs, sealed: !!items.sealed || list.length >= TUNE.perPage, dirty: false, force: false, lastWrite: 0 });
          await saveThumbs(P.pages[n]);
        }
        // Pages this key cannot open (made with an older key on another device): start a new layout; gi carries on.
        if (lost) { P.pages = []; P.m.pc = 0; }
      } else P.m = { pc: 0, fc: m ? m.fc || 0 : 0, vr: m ? m.vr || 0 : 0, gi: m ? m.gi || 0 : 0, pv: m ? pvList(m) : [] };
      for (const pg of P.pages) for (const it of pg.items) P.index.set(it.id, { n: pg.n, gi: it.gi });
      P.ready = true;
      if (!cache) startFeed();
      await persist();
      tick().catch(noop);
    }
    async function saveThumbs(pg) {
      if (!pg.thumbs) return;
      try { await ES.idb.put('blobs', thumbKey(pg.n), { thumbs: [...pg.thumbs] }); } catch (e) { warn('save', e); }
    }
    async function ensureThumbs(pg) {
      if (pg.thumbs) return pg.thumbs;
      let rec = null;
      try { rec = await ES.idb.get('blobs', thumbKey(pg.n)); } catch (e) { rec = null; }
      if (rec && Array.isArray(rec.thumbs)) { pg.thumbs = new Map(rec.thumbs); return pg.thumbs; }
      // Not on this device any more: read the page back (it is ours, so the key opens it).
      const map = new Map();
      try { for (const it of await ES.gallery.page(code, pg.n, P.key, pageOpts(P.m, pg.n))) map.set(it.id, (await toU8(it.thumb)) || new Uint8Array(0)); } catch (e) { warn('page', e); }
      pg.thumbs = map;
      return map;
    }
    async function persist() {
      const pages = P.pages.map((pg) => ({ n: pg.n, items: pg.items, sealed: pg.sealed, lastWrite: pg.lastWrite }));
      try {
        await ES.idb.put('cursors', `pack/${code}`, { v: 1, keyHash: P.keyHash, vr: P.m.vr, gi: P.m.gi, pc: P.pages.length, fc: P.m.fc, xp: P.xp,
          pages, removed: [...P.removed].slice(-3000) });
      } catch (e) { warn('persist', e); }
    }

    // --------------------------------------------------------------------------------------------- data source ---
    async function pubNow() {
      if (cache && cache.pub) { const p = cache.pub(); if (p) return p; }
      try { return await ES.pub.get(code, { maxAge: MIN }); } catch (e) { return ES.pub.cached(code); }
    }
    function items() { return cache ? cache.items() : (P.feed ? [...P.feed.items.values()] : []); }
    async function thumbOf(x) {
      if (cache) return cache.thumb(x.coll, x.id);
      const t = P.feed && P.feed.thumbs.get(x.id);
      return t && t.length ? t : null;
    }
    const nameOf = (seat) => (cache ? cache.name(seat) : ((P.feed && P.feed.names.get(seat)) || ''));
    const showAt = (x) => (cache && cache.showAt ? cache.showAt(x.coll, x.id) : null);
    // Host console: its own doorbell and delta queries (no display bytes), only while it holds the lease.
    function startFeed() {
      if (cache || P.feed || P.stopped) return;
      const F = P.feed = { items: new Map(), thumbs: new Map(), names: new Map(), cursors: { media: null, guests: null }, busy: false, again: false, watch: null };
      const pull = async () => {
        if (F.busy) { F.again = true; return; }
        F.busy = true;
        try {
          do {
            F.again = false;
            for (const coll of ['media', 'guests']) {
              for (let guard = 0; guard < 100; guard++) {
                const api = coll === 'media' ? ES.media : ES.guests;
                const r = await api.changes(code, { cursor: F.cursors[coll], st: [1, 2, 3], select: coll === 'media' ? MEDIA_SEL : ['nm', 'st', 'mt'], limit: 100 });
                for (const d of r.items) {
                  const x = { coll, id: d._id, st: d.st, mt: d.mt, s: coll === 'guests' ? +d._id : (Number.isInteger(d.s) ? d.s : -1), k: +d.k || 0, kd: d.kd || 'p', fn: d.fn || '', m: d.m || '', cp: d.cp || '',
                    w: +d.w || 0, h: +d.h || 0, du: +d.du || 0, at: +d.at || d.mt, rv: +d.rv || 0, hl: !!d.hl, xp: +d.xp || 0, nm: d.nm || '' };
                  F.items.set(`${coll}/${d._id}`, x);
                  if (coll === 'media') { if (d.st === 1 && d.t && d.t.length) F.thumbs.set(d._id, d.t); else F.thumbs.delete(d._id); }
                  if (coll === 'guests') { if (d.st === 1 && d.nm) F.names.set(+d._id, d.nm); else F.names.delete(+d._id); }
                }
                F.cursors[coll] = r.cursor || F.cursors[coll];
                if (r.items.length < 100) break;
              }
            }
          } while (F.again && !P.stopped);
        } catch (e) { warn('feed', e); } finally { F.busy = false; }
        if (!P.stopped) tick().catch(noop);
      };
      F.watch = ES.bell.watch(code, { mode: 'host', onChange: (changed, b, info) => {
        if ((info && info.first) || changed.some((k) => 'oqgea'.includes(k))) pull();
        if (changed.includes('s')) pubNow().catch(noop);
      } });
    }
    function stopFeed() { if (P.feed && P.feed.watch) P.feed.watch.stop(); P.feed = null; }

    // ----------------------------------------------------------------------------------------- pages and items ---
    function pageItem(x, gi) {
      const it = { gi, id: x.id, kd: x.kd === 'v' ? 'v' : 'p', s: Number.isInteger(x.s) ? x.s : -1, nm: x.s >= 0 ? nameOf(x.s) : '', fn: x.fn || '', m: x.m || '', cp: x.cp || '',
        w: +x.w || 0, h: +x.h || 0, at: +x.at || +x.mt || 0, o: +x.xp || 0, l: x.hl ? 1 : 0 };
      if (it.kd === 'v') it.du = +x.du || 0;
      return it;
    }
    function maxPages() {
      const pub = cache && cache.pub ? cache.pub() : ES.pub.cached(code);
      const c = (pub && pub.cap) || {};
      if (!c.lim) return 100;
      return Math.max(1, Math.min(100, Math.ceil((c.lim * ((c.pg || 0) + (c.vg || 0) + 1) + (c.pc || 0) + 200) / TUNE.perPage)));
    }
    async function openPage() {
      let pg = P.pages[P.pages.length - 1];
      if (pg && !pg.sealed && pg.items.length < TUNE.perPage) { await ensureThumbs(pg); return pg; }
      if (P.pages.length >= maxPages()) { P.full = true; return null; }
      pg = { n: P.pages.length, items: [], thumbs: new Map(), sealed: false, dirty: true, force: false, lastWrite: 0 };
      P.pages.push(pg);
      return pg;
    }
    async function thumb180(t) {
      try { if (window.EM && window.EM.image && window.EM.image.thumb) return await window.EM.image.thumb(t, 180, 0.6); } catch (e) { /* keep the 240 px one */ }
      return t;
    }
    async function index() {
      const nowS = ES.clock.now();
      const all = items();
      let changed = false, pending = 0;
      // removals and updates
      for (const x of all) {
        if (x.coll !== 'media') continue;
        const ix = P.index.get(x.id);
        if (!ix) continue;
        if (x.st !== 1) { await removeFromPage(x.id, x.mt); changed = true; continue; }
        const pg = P.pages[ix.n], cur = pg && pg.items.find((i) => i.id === x.id);
        if (!cur) continue;
        const nx = pageItem(x, cur.gi);
        if (!nx.nm && cur.nm) nx.nm = cur.nm;
        if (nx.cp !== cur.cp || nx.o !== cur.o || nx.l !== cur.l || nx.fn !== cur.fn || nx.m !== cur.m || nx.nm !== cur.nm) { Object.assign(cur, nx); pg.dirty = true; changed = true; }
      }
      // new items: approved, revealed, within their window, in mt order
      const cand = all.filter((x) => x.coll === 'media' && x.st === 1 && !P.index.has(x.id) && !((+x.rv || 0) > nowS)
        && !(P.removed.has(x.id) && P.removed.get(x.id) >= x.mt) && !(x.xp && x.xp < nowS)).sort((a, b) => (a.mt - b.mt) || cmpStr(a.id, b.id));
      pending = cand.length;
      for (const x of cand.slice(0, TUNE.perTick)) {
        if (P.stopped || !P.lease) break;
        const t = await thumbOf(x);
        if (!t) { pending--; continue; }
        const pg = await openPage();
        if (!pg) break;
        const th = await thumb180(t);
        const gi = P.m.gi++;
        pg.items.push(pageItem(x, gi)); pg.thumbs.set(x.id, th); pg.dirty = true;
        P.index.set(x.id, { n: pg.n, gi });
        if (pg.items.length >= TUNE.perPage) { pg.sealed = true; pg.sealNow = true; }
        pending--; changed = true;
      }
      // the estimate for es_meter: guests' commits cost reads this device never sees (2 per upload, 3 per check-in)
      for (const x of all) {
        if (x.st !== 1) continue;
        const k = `${x.coll}/${x.id}`;
        if (!P.seen.has(k)) { P.seen.add(k); P.est += x.coll === 'media' ? 2 : 3; }
      }
      if (P.seen.size > 20000) P.seen.clear();
      P.pending = Math.max(0, pending) + P.pages.filter((p) => p.dirty || p.force).length;
      if (changed) persist().catch(noop);
    }
    async function removeFromPage(id, mt) {
      const ix = P.index.get(id);
      P.index.delete(id); P.removed.set(id, mt || ES.clock.now());
      const pg = ix && P.pages[ix.n];
      if (!pg) return;
      await ensureThumbs(pg);
      pg.items = pg.items.filter((i) => i.id !== id); pg.thumbs.delete(id); pg.dirty = true; pg.removal = true;
      if (P.m.fc > 0) P.zeroFaces = true; // selfie search pauses until the hosts update it (§4.21)
    }
    async function encode(pg) {
      const thumbs = await ensureThumbs(pg);
      const list = pg.items.slice().sort((a, b) => a.gi - b.gi);
      let tl = list.map((it) => thumbs.get(it.id) || new Uint8Array(0));
      let bytes = await window.EM.page.encode(list.map((it, i) => Object.assign({}, it, { thumb: tl[i] })), P.key, { sealed: pg.sealed });
      for (const px of [150, 120]) { // over the 900 KB rule: smaller thumbnails for the biggest ones
        if (bytes.length <= TUNE.maxBytes) break;
        tl = await Promise.all(tl.map(async (t) => (t.length > 3500 && window.EM.image.thumb ? window.EM.image.thumb(t, px, 0.5).catch(() => t) : t)));
        list.forEach((it, i) => thumbs.set(it.id, tl[i]));
        bytes = await window.EM.page.encode(list.map((it, i) => Object.assign({}, it, { thumb: tl[i] })), P.key, { sealed: pg.sealed });
      }
      return { bytes, count: list.length };
    }
    async function write() {
      if (P.writing || !P.lease || !P.ready || !window.EM || !window.EM.page) return;
      const t = Date.now();
      const due = P.pages.filter((pg) => (pg.dirty || pg.force) && (pg.sealNow || pg.force || !pg.lastWrite || t - pg.lastWrite >= TUNE.minGap)).slice(0, 2);
      if (!due.length) return;
      P.writing = true;
      try {
        const cur = await ES.gallery.manifest(code, { maxAge: 0 });
        if (cur && cur.vr > P.m.vr) { // another device packed meanwhile: step back and read its work
          warn('manifest', 'newer manifest from another device');
          P.ready = false; P.loading = load().catch(noop).finally(() => { P.loading = null; });
          return;
        }
        const vr = Math.max(P.m.vr, cur ? cur.vr : 0) + 1;
        for (const pg of due) {
          if (!P.lease) return;
          const { bytes, count } = await encode(pg);
          try { await ES.gallery.writePage(code, pg.n, bytes, { count, sealed: pg.sealed, vr }); } catch (e) {
            if (!(e && e.code === 'DENIED')) throw e;
            await ES.events.get(code); // its expiry may have changed: read the event afresh, then once more
            await ES.gallery.writePage(code, pg.n, bytes, { count, sealed: pg.sealed, vr });
          }
          pg.dirty = false; pg.force = false; pg.sealNow = false; pg.removal = false; pg.lastWrite = Date.now(); pg.vr = vr;
          P.m.pv[pg.n] = (Math.round(+P.m.pv[pg.n]) || 0) + 1; // only this page's version moves
          P.pageWrites++;
          await saveThumbs(pg);
          if (pg.sealed && !pg.force) pg.thumbs = null; // sealed pages live in IndexedDB until they change again
        }
        P.m.vr = vr;
        const fc = P.zeroFaces ? 0 : (cur ? cur.fc || 0 : P.m.fc || 0);
        await ES.gallery.writeManifest(code, { pc: P.pages.length, fc, vr, gi: P.m.gi, pv: pvOut(P.pages.length) });
        P.m.fc = fc; P.m.pc = P.pages.length; P.zeroFaces = false;
        P.writes++; P.lastWrite = Date.now(); P.error = '';
        await persist();
      } catch (e) {
        P.error = String((e && e.code) || e);
        warn('write', e);
      } finally { P.writing = false; }
    }

    // ------------------------------------------------------------------------------------------------ statuses ---
    // RTDB st/{seat}.s: [0] the selfie, [1..6] the slots ('-' none, 0 waiting, 1 shown, 2 hidden, 3 erased);
    // t: when the seat's newest item shows on the big screen (a time ahead means "in about N s").
    async function statuses() {
      const want = new Map();
      for (const x of items()) {
        const seat = x.coll === 'guests' ? +x.id : x.s;
        if (!Number.isInteger(seat) || seat < 0 || seat > 999) continue;
        const pos = x.coll === 'guests' ? 0 : 1 + (+x.k || 0);
        if (pos > 6) continue;
        if (!want.has(seat)) want.set(seat, { pos: new Map(), t: 0 });
        const w = want.get(seat), st = x.st === 1 ? 1 : (x.st === 3 ? 3 : 2);
        w.pos.set(pos, st);
        // No slot known yet (a console packing without a wall): the same estimate as ES.media.decide, mt + 10 s.
        if (st === 1) { const at = showAt(x) || (x.mt ? x.mt + 10e3 : 0); if (at > w.t) w.t = Math.round(at); }
      }
      const changed = [];
      for (const [seat, w] of want) {
        const sig = [...w.pos].sort((a, b) => a[0] - b[0]).map(([p, s]) => `${p}${s}`).join('') + `@${w.t}`;
        if (P.stSent.get(seat) !== sig) changed.push([seat, w, sig]);
      }
      if (!changed.length) return;
      const batch = changed.slice(0, 50), upd = {};
      await Promise.all(batch.map(async ([seat, w]) => {
        let curV = null;
        try { curV = await ES.db.get(`es/${code}/st/${seat}`); } catch (e) { curV = null; }
        const s = ((curV && typeof curV.s === 'string') ? curV.s : '').padEnd(7, '-').slice(0, 7).split('');
        for (const [pos, st] of w.pos) s[pos] = String(st);
        upd[seat] = { s: s.join(''), t: w.t || ((curV && +curV.t) || 0) };
      }));
      await ES.db.patch(`es/${code}/st`, upd, { auth: true });
      for (const [seat, , sig] of batch) P.stSent.set(seat, sig);
    }

    // ---------------------------------------------------------------------------------------------- the ticker ---
    let ticking = null;
    async function tick() {
      if (ticking) return ticking;
      ticking = (async () => {
        if (P.stopped || !P.lease || !P.ready) return;
        try {
          const pub = await pubNow();
          if (pub && +pub.x && P.xp && +pub.x !== P.xp) { P.pages.forEach((pg) => { pg.force = true; }); } // a new expiry: every page again
          if (pub && +pub.x) P.xp = +pub.x;
          await index();
          await write();
          if (Date.now() - P.statusAt >= TUNE.statusEvery) { P.statusAt = Date.now(); await statuses().catch((e) => warn('status', e)); }
          // 24 h after close the live key leaves the public mirror (§3.6 step 6, §4.15)
          if (pub && pub.gk && !P.gkDone && ES.clock.now() > +pub.c + DAY) {
            P.gkDone = true;
            await ES.db.del(`es/${code}/pub/gk`, { auth: true }).catch((e) => { P.gkDone = false; warn('live key', e); });
          }
          if (Date.now() - P.meterAt >= TUNE.meterEvery) {
            P.meterAt = Date.now();
            const m = ES.gov.take();
            m.r = (m.r || 0) + P.est; P.est = 0;
            await ES.gov.meter(m).catch((e) => warn('meter', e));
          }
          if (Date.now() >= P.sweepAt) { P.sweepAt = Date.now() + TUNE.sweepEvery; ES.sweep(code).catch((e) => warn('sweep', e)); }
        } catch (e) { P.error = String((e && e.code) || e); warn('tick', e); }
      })().finally(() => { ticking = null; if (opts.onState) { try { opts.onState(state()); } catch (e) { /* caller's */ } } });
      return ticking;
    }

    function state() {
      return { pages: P.pages.length, gi: P.m.gi, vr: P.m.vr, pv: P.m.pv.slice(), fc: P.m.fc, pending: P.pending, lease: P.lease, ready: P.ready, indexed: P.index.size,
        writes: P.writes, pageWrites: P.pageWrites, lastWrite: P.lastWrite, full: P.full, error: P.error, prio,
        sealed: P.pages.filter((p) => p.sealed).length, counts: P.pages.map((p) => p.items.length) };
    }
    async function begin() {
      await setKey(opts.key);
      // One packer per machine: another window (a second wall, the console) may already hold it.
      if (navigator.locks && typeof navigator.locks.request === 'function') {
        const got = await new Promise((resolve) => {
          navigator.locks.request(`es-pack-${code}`, { ifAvailable: true }, (lock) => {
            if (!lock) { resolve(false); return undefined; }
            resolve(true);
            return new Promise((r) => { P.releaseLock = r; });
          }).catch(() => resolve(true));
        });
        if (!got) {
          // Wait in line: when that window closes, this one takes over.
          navigator.locks.request(`es-pack-${code}`, () => { if (P.stopped) return undefined; run(); return new Promise((r) => { P.releaseLock = r; }); }).catch(noop);
          return;
        }
      }
      run();
    }
    function run() {
      if (P.stopped || P.running) return;
      P.running = true;
      if (cache && cache.on) P.unsub = cache.on(() => { if (P.lease && P.ready) tick().catch(noop); });
      leaseTick().catch(noop);
      const loop = async () => {
        if (P.stopped) return;
        await leaseTick().catch(noop);
        P.timers[0] = setTimeout(loop, P.lease ? TUNE.renew : TUNE.retry);
      };
      P.timers[0] = setTimeout(loop, P.lease ? TUNE.renew : TUNE.retry);
      P.timers[1] = setInterval(() => { tick().catch(noop); }, TUNE.tick);
    }
    const handle = {
      async stop() {
        P.stopped = true;
        clearTimeout(P.timers[0]); clearInterval(P.timers[1]);
        if (P.unsub) P.unsub();
        stopFeed();
        await release();
        if (P.releaseLock) P.releaseLock();
        if (current === handle) current = null;
      },
      setKey: (k) => setKey(k).catch((e) => warn('key', e)),
      poke: () => tick(),
      state,
      giOf: (id) => { const ix = P.index.get(id); return ix ? ix.gi : null; },
      _P: P,
    };
    begin().catch((e) => { P.error = String((e && e.code) || e); warn('start', e); });
    return handle;
  }

  window.ESPacker = {
    start(code, opts = {}) {
      if (!window.ES || !window.ES.CODE_RE.test(String(code))) throw new Error('ESPacker.start: an event code is needed');
      if (current) current.stop();
      current = create(String(code), opts);
      return current;
    },
    state() { return current ? current.state() : { pages: 0, gi: 0, pending: 0, lease: false }; },
    tune(o) { Object.assign(TUNE, o || {}); return JSON.parse(JSON.stringify(TUNE)); },
    version: 1,
  };
})();
