/* Event Sky exports: window.ESExport (event-export.js). Build spec: research/event-sky-spec.md §3.7, §4.16 and §4.23.
 * Everything is made on the host's device and saved or shared from there; nothing is stored in the cloud (§0.9).
 *
 *  ESExport.zip(code, {only:'all'|'highlights'|fnId, onProgress(0..1), signal, maxPart, onPart(blob, i)}) → Blob[] (parts)
 *     Photos and videos (shown or waiting; hidden and erased ones are left out) in a folder per function, named
 *     "HHMM_<guest>_<n>.jpg" in the event's time zone; guest selfies in "Guests/"; guestbook.html and voice/ (host and
 *     co-hosts); rsvp.csv (RSVP plans); guests.csv, consent.csv, stats.csv; README.txt (retention and consent).
 *     Free plans: the brand mark is burned into every photo (photographer photos already carry it). Parts ≤ 190 MB.
 *  ESExport.bestOf(code, {aspect:'9:16'|'16:9', seconds=60, reduced, onProgress, signal, prefer, full, music:{kind, file}}) → Blob (MP4, else WebM)
 *     full (the Wish Reel): every wish, as long as it needs (30 s to 3 min), 1080×1920 or 1920×1080, 5 Mbps, no mark.
 *     music: 'birthday' | 'tune' | 'file' (+ file) | 'none' (ESExport.music), an AAC track where the browser encodes it.
 *     720×1280 or 1280×720, 30 fps, 3 Mbps, silent unless music is chosen. A 3 s title; then the guests' wishes, each guest's selfie going up
 *     in a rocket with their name and wish in light (EFX.reveal, one every 3 s; the guests who wrote a wish first, in
 *     the order they came; as many as fit: the whole reel on a birthday, else half of it); up to 24 photos at 2.2 s (as many as fit the length),
 *     up to 2 videos (their first 4 s, muted; dimmed and grey if they flash), and a 10 s drone-name finale, all on one
 *     EFX timeline, so bursts are flash-gated (§4.24). Free: the brand mark in the corner and a 3 s end card.
 *     Photos are picked in this order: highlights, this device's favourites, reactions, one per mission, then the rest.
 *  ESExport.book(code, {perPage:1|4, max=300, only:'highlights'|'all', onProgress, signal}) → Blob (A4 PDF)
 *     A cover (title, names, date, world art), the photos with names and captions, the guestbook's messages, a back page.
 *     More than `max` photos is refused (ESError FULL).
 *  ESExport.csv(code, 'guests'|'rsvp'|'stats'|'consent'|'analytics'|'orders') → Blob (text/csv, UTF-8 with BOM)
 *     Phone numbers appear only in the RSVP list (and in shop orders, for delivery).
 *  ESExport.select(code, {n, ev?, media?}) → [media docs] the best-of choice (exported for tests)
 *  ESExport.last → details of the last best-of render: {du, frames, mime, path, photos, videos, bright, markBox, w, h}
 *
 * Needs event-sky.js, event-media.js, event-zip.js, event-pdf.js, event-mp4.js, event-fx.js (and drone-show.js for the
 * finale's drones); event-stats.js for the analytics CSV.
 */
/* STRINGS:
Guests
Photographer
Guestbook
Voice message
Photos
Photo book
Seat
Name
Wish
Function
Language
Checked in
Status
Selfie search
Yes
No
Waiting
On screen
Not shown
Deleted by the guest
Phone
Food
Note
Updated
Hour
Arrivals
Uploads
Gallery opens
Reactions
Selfie searches
Downloads
Video plays
Consent version
Adult or guardian
Guests checked in
Gallery number
Households
People
Per function
Top photos
RSVP
Order
Size
Quantity
Address
Reference
Amount (₹)
Placed
Photos are kept until {0}.
Full-size copies are kept until {0}.
Every guest agreed to the notice on the event page before sharing, and confirmed they are 18 or older or a parent or guardian. Each check-in's consent version is in consent.csv.
To remove a photo, a guest taps “Delete my photos” on the event page, or asks the hosts.
Made with Light Up the Skies
Thank you for celebrating with us
Get it on Google Play
*/
(function () {
  'use strict';
  if (window.ESExport) return;
  const DAY = 864e5, HOUR = 36e5;
  const T = (s) => { try { return (window.LUTSLang && LUTSLang.t && LUTSLang.t(s)) || s; } catch (e) { return s; } };
  const F = (s, ...a) => String(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  const TF = (s, ...a) => F(T(s), ...a);
  const err = (code, msg) => ES.err(code, 0, msg);
  const MEDIA_SEL = ['s', 'k', 'kd', 'w', 'h', 'fn', 'm', 'cp', 'st', 'mt', 'at', 'du', 'hl', 'rv', 'by', 'wm'];
  const GUEST_SEL = ['nm', 'wi', 'fn', 'lg', 'cv', 'fo', 'ad', 'st', 'mt', 'at'];
  const cancelled = (signal) => { if (signal && signal.aborted) throw err('CANCELLED', 'Cancelled'); };
  const progress = (o, f) => { if (o && typeof o.onProgress === 'function') { try { o.onProgress(Math.max(0, Math.min(1, f))); } catch (e) { /* the caller's */ } } };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // ---------- reading ----------
  async function listAll(coll, code, st, select) {
    const api = coll === 'media' ? ES.media : ES.guests, out = [];
    let cursor = null;
    for (let page = 0; page < 40; page++) {
      const r = await api.changes(code, { cursor, st, limit: 300, select });
      out.push(...r.items);
      if (r.items.length < 300) break;
      cursor = r.cursor;
    }
    return out;
  }
  async function bytesOf(code, ids, field) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 20) {
      const part = ids.slice(i, i + 20);
      const docs = field === 'im'
        ? await ES.fs.batchGet(part.map((n) => `events/${code}/guests/${n}`), { mask: ['im'], auth: true })
        : await ES.media.get(code, part, { select: [field], auth: true });
      docs.forEach((d, j) => { if (d && d[field] && d[field].length) out.set(String(part[j]), d[field]); });
    }
    return out;
  }
  async function book(code) {
    try {
      const docs = await ES.fs.query(`events/${code}`, { from: 'book', select: ['nm', 'tx', 'vm', 'du', 'at'], orderBy: [['at', 'asc']], limit: 1000, auth: true });
      return docs.filter((d) => d.nm || d.tx);
    } catch (e) { if (e.code === 'DENIED') return null; throw e; }
  }
  function fmt(ms, tz, o, lang) {
    const loc = lang || (((window.LUTSLang && LUTSLang.lang) || 'en') + '-IN');
    try { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: tz || undefined }, o)).format(new Date(ms)); } catch (e) {
      try { return new Intl.DateTimeFormat(loc, o).format(new Date(ms)); } catch (x) { return new Date(ms).toISOString(); }
    }
  }
  const fmtDate = (ms, tz) => fmt(ms, tz, { day: 'numeric', month: 'long', year: 'numeric' });
  // "2026-11-23 19:05" in the event's time zone (sortable in a spreadsheet)
  function stamp(ms, tz) {
    if (!ms) return '';
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    } catch (e) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
  }
  const hhmm = (ms, tz) => stamp(ms, tz).slice(11).replace(':', '');
  const fileSafe = (s) => String(s || '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 40);
  const STATUS = { 0: 'Waiting', 1: 'On screen', 2: 'Not shown', 3: 'Deleted by the guest' };
  const extOf = (bytes) => {
    const t = (window.EM && EM.sniff && EM.sniff.bytes) ? EM.sniff.bytes(bytes.subarray(0, 64)) : '';
    return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' }[t] || '';
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- CSVs ----------
  async function csvRows(code, kind, ev) {
    ev = ev || await ES.events.get(code);
    const tz = ev.tz, fnName = (id) => ((ev.fns || []).find((f) => f.id === id) || {}).n || '';
    if (kind === 'guests') {
      const g = (await listAll('guests', code, [0, 1, 2], GUEST_SEL)).sort((a, b) => a.at - b.at);
      return [[T('Seat'), T('Name'), T('Wish'), T('Function'), T('Language'), T('Checked in'), T('Status'), T('Selfie search')]]
        .concat(g.map((x) => [+x._id, x.nm || '', x.wi || '', fnName(x.fn), x.lg || '', stamp(x.at, tz), T(STATUS[x.st] || ''), x.fo ? T('Yes') : T('No')]));
    }
    if (kind === 'consent') {
      const g = (await listAll('guests', code, [0, 1, 2, 3], GUEST_SEL)).sort((a, b) => a.at - b.at);
      return [[T('Seat'), T('Name'), T('Checked in'), T('Consent version'), T('Adult or guardian'), T('Selfie search'), T('Status')]]
        .concat(g.map((x) => [+x._id, x.st === 3 ? '' : (x.nm || ''), stamp(x.at, tz), x.cv != null ? x.cv : '', x.ad === false ? T('No') : T('Yes'), x.fo ? T('Yes') : T('No'), T(STATUS[x.st] || '')]));
    }
    if (kind === 'rsvp') {
      const list = (await ES.rsvp.list(code)).sort((a, b) => a.at - b.at);
      const fns = ev.fns || [];
      return [[T('Name'), T('Phone'), ...fns.map((f) => f.n), T('Food'), T('Note'), T('Updated')]]
        .concat(list.map((r) => [r.name, r.phone, ...fns.map((f) => +((r.fns || {})[f.id]) || 0), r.diet, r.note, stamp(r.at, tz)]));
    }
    if (kind === 'stats' || kind === 'analytics') {
      const st = await ES.stats(code).catch(() => ({ hours: [] }));
      const rows = [[T('Hour'), T('Arrivals'), T('Uploads'), T('Gallery opens'), T('Reactions'), T('Selfie searches'), T('Downloads'), T('Video plays')]]
        .concat(st.hours.map((x, i) => [stamp(ev.opensAt + i * HOUR, tz), x.a, x.u, x.o, x.r, x.s, x.d, x.v]));
      if (kind === 'stats') return rows;
      const data = window.ESStats ? await ESStats.collect(code, { ev, thumbs: false }) : { perFn: [], top: [] };
      rows.push([], [T('Per function'), T('Guests checked in'), T('Photos')]);
      data.perFn.forEach((f) => rows.push([f.n, f.guests, f.photos]));
      rows.push([], [T('Top photos'), T('Gallery number'), T('Reactions')]);
      data.top.forEach((x, i) => rows.push([i + 1, x.gi, x.n]));
      if (ev.cap && ev.cap.rs) {
        const s = await ES.rsvp.summary(code).catch(() => null);
        if (s) {
          rows.push([], [T('RSVP'), T('Households'), T('People')], ['', s.households, '']);
          (ev.fns || []).forEach((f) => { const b = s.byFn[f.id] || { yes: 0, people: 0 }; rows.push([f.n, b.yes, b.people]); });
        }
      }
      return rows;
    }
    if (kind === 'orders') {
      const docs = await ES.fs.query(`events/${code}`, { from: 'orders', orderBy: [['at', 'asc']], limit: 2000, auth: true });
      return [[T('Order'), T('Size'), T('Quantity'), T('Name'), T('Phone'), T('Address'), T('Reference'), T('Amount (₹)'), T('Status'), T('Placed')]]
        .concat(docs.map((o) => [o._id, o.sz, o.q, o.nm, o.ph, o.ad, o.ref, Math.round((o.amt || 0) / 100), o.st, stamp(o.at, tz)]));
    }
    throw err('DENIED', 'Unknown list');
  }
  async function csv(code, kind, o = {}) {
    const rows = await csvRows(code, kind, o.ev);
    return new Blob([EM.csv(rows)], { type: 'text/csv;charset=utf-8' });
  }

  // ---------- ZIP ----------
  async function zip(code, o = {}) {
    const ev = await ES.events.get(code);
    const tz = ev.tz, free = !!(ev.cap && ev.cap.mk), only = o.only || 'all';
    const fns = ev.fns || [];
    const fnName = (id) => (fns.find((f) => f.id === id) || {}).n || '';
    progress(o, 0.01);
    const guests = await listAll('guests', code, [0, 1, 2], GUEST_SEL.concat([]));
    const gname = new Map(guests.map((g) => [+g._id, g.nm || '']));
    let media = (await listAll('media', code, [0, 1], MEDIA_SEL));
    if (only === 'highlights') media = media.filter((m) => m.hl);
    else if (only !== 'all') media = media.filter((m) => m.fn === only);
    media.sort((a, b) => (a.at - b.at) || String(a._id).localeCompare(String(b._id)));
    cancelled(o.signal);
    const folder = (fn) => fileSafe(fns.length > 1 ? (fnName(fn) || T('Photos')) : T('Photos')) || 'Photos';
    const w = EM.zip.writer({ maxPart: o.maxPart || 190e6, onPart: o.onPart }); // under the app bridge's 200 MB a file
    const selfies = only === 'all' ? guests.filter((g) => g.st === 1) : [];
    const total = media.length + selfies.length + 6;
    let done = 0;
    for (let i = 0; i < media.length; i += 20) {
      cancelled(o.signal);
      const part = media.slice(i, i + 20);
      const bytes = await bytesOf(code, part.map((m) => String(m._id)), 'd');
      for (const m of part) {
        let b = bytes.get(String(m._id));
        done++;
        if (!b) continue; // purged or gone
        if (free && m.kd === 'p' && !m.wm) { try { b = await EM.mark.apply(b, { plan: 'free' }); } catch (e) { /* keep the copy as it is */ } }
        const who = m.s >= 0 ? fileSafe(gname.get(m.s) || T('Guests')) : fileSafe(T('Photographer'));
        const dir = m.s >= 0 ? folder(m.fn) : `${folder(m.fn)}/${fileSafe(T('Photographer'))}`;
        await w.add(`${dir}/${hhmm(m.at, tz)}_${who}_${(m.k || 0) + 1}.${extOf(b) || (m.kd === 'v' ? 'mp4' : 'jpg')}`, new Blob([b]), new Date(m.at || Date.now()));
      }
      progress(o, 0.02 + 0.85 * done / total);
      await tick();
    }
    if (selfies.length) {
      for (let i = 0; i < selfies.length; i += 20) {
        cancelled(o.signal);
        const part = selfies.slice(i, i + 20);
        const bytes = await bytesOf(code, part.map((g) => String(g._id)), 'im');
        for (const g of part) {
          let b = bytes.get(String(g._id));
          done++;
          if (!b) continue;
          if (free) { try { b = await EM.mark.apply(b, { plan: 'free' }); } catch (e) { /* as it is */ } }
          await w.add(`${fileSafe(T('Guests'))}/${hhmm(g.at, tz)}_${fileSafe(g.nm) || g._id}.jpg`, new Blob([b]), new Date(g.at || Date.now()));
        }
        progress(o, 0.02 + 0.85 * done / total);
      }
    }
    // the guestbook (host and co-hosts can read it)
    const msgs = only === 'all' ? await book(code) : null;
    if (msgs && msgs.length) {
      const items = [];
      for (const m of msgs) {
        let audio = '';
        if (m.du) {
          const v = await ES.fs.get(`events/${code}/book/${m._id}`, { mask: ['v', 'vm'], auth: true }).catch(() => null);
          if (v && v.v && v.v.length) {
            const ext = extOf(v.v) || (/mp4|aac/.test(v.vm || '') ? 'm4a' : 'webm');
            audio = `voice/${m._id}.${ext}`;
            await w.add(audio, new Blob([v.v]), new Date(m.at || Date.now()));
          }
        }
        items.push(`<article><h2>${esc(m.nm)}</h2><time>${esc(stamp(m.at, tz))}</time>${m.tx ? `<p>${esc(m.tx).replace(/\n/g, '<br>')}</p>` : ''}${audio ? `<audio controls src="${esc(audio)}" aria-label="${esc(T('Voice message'))}"></audio>` : ''}</article>`);
      }
      const html = `<!DOCTYPE html><html lang="${esc(ev.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(ev.title)} – ${esc(T('Guestbook'))}</title>`
        + '<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#070b24;color:#f4f1e8}h1{color:#f5c451}article{border-bottom:1px solid #2a3263;padding:12px 0}h2{margin:0;color:#ffe7a3;font-size:1.1rem}time{color:#a9acc4;font-size:.85rem}p{white-space:normal}audio{width:100%;margin-top:8px}</style></head>'
        + `<body><h1>${esc(ev.title)}</h1><p>${esc(ev.names || '')}</p>${items.join('')}</body></html>`;
      await w.add('guestbook.html', html);
    }
    done++; progress(o, 0.9);
    const lists = ['guests', 'consent', 'stats'].concat(ev.cap && ev.cap.rs && msgs !== null ? ['rsvp'] : []);
    for (const k of lists) {
      cancelled(o.signal);
      try { await w.add(`${k}.csv`, EM.csv(await csvRows(code, k, ev))); } catch (e) { if (e.code !== 'DENIED') throw e; }
    }
    const lines = [ev.title, ev.names || '', '', F(T('Photos are kept until {0}.'), fmtDate(ev.expiresAt, tz))];
    if (ev.fu < ev.expiresAt) lines.push(F(T('Full-size copies are kept until {0}.'), fmtDate(ev.fu, tz)));
    lines.push('', T('Every guest agreed to the notice on the event page before sharing, and confirmed they are 18 or older or a parent or guardian. Each check-in\'s consent version is in consent.csv.'),
      T('To remove a photo, a guest taps “Delete my photos” on the event page, or asks the hosts.'));
    if (free) lines.push('', `${T('Made with Light Up the Skies')} – ${T('Get it on Google Play')}: ${ES.urls.play('event_zip')}`);
    await w.add('README.txt', lines.join('\r\n') + '\r\n');
    const parts = await w.finish();
    progress(o, 1);
    return parts;
  }

  // ---------- best-of: picking ----------
  async function galleryMap(code) {
    const byGi = new Map();
    try {
      const k = ES.b64u.dec(await ES.gallery.key.get(code));
      const m = await ES.gallery.manifest(code);
      for (let n = 0; m && n < m.pc; n++) (await ES.gallery.page(code, n, k, { vr: m.vr }).catch(() => [])).forEach((it) => byGi.set(it.gi, it.id));
    } catch (e) { /* no pages yet */ }
    return byGi;
  }
  async function select(code, o = {}) {
    const ev = o.ev || await ES.events.get(code);
    const now = ES.clock.now();
    const media = o.media || (await listAll('media', code, [1], MEDIA_SEL)).filter((m) => !(m.rv > now));
    const photos = media.filter((m) => m.kd === 'p'), videos = media.filter((m) => m.kd === 'v');
    const byId = new Map(media.map((m) => [String(m._id), m]));
    const picked = [], seen = new Set();
    const take = (m) => { if (m && m.kd === 'p' && !seen.has(String(m._id))) { seen.add(String(m._id)); picked.push(m); } };
    const n = o.n == null ? 24 : o.n;
    photos.filter((m) => m.hl).sort((a, b) => a.at - b.at).forEach(take); // 1. host highlights
    const gi = await galleryMap(code);
    const favs = (() => { try { const v = JSON.parse(localStorage.getItem(`luts:es-fav:${code}`) || '[]'); return Array.isArray(v) ? v : Object.keys(v || {}); } catch (e) { return []; } })();
    favs.map((g) => byId.get(String(gi.get(+g)))).forEach(take); // 2. favourites on this device
    const rx = await ES.reactions(code).catch(() => ({}));
    const score = (r) => ['h', 'f', 'w', 'c'].reduce((a, k) => a + (+((r || {})[k]) || 0), 0);
    const ranked = Object.entries(rx || {}).map(([g, r]) => ({ id: String(gi.get(+g) || ''), s: score(r) })).filter((x) => x.s > 0 && x.id).sort((a, b) => b.s - a.s);
    ranked.forEach((x) => take(byId.get(x.id))); // 3. reactions
    const missions = new Set();
    photos.slice().sort((a, b) => a.at - b.at).forEach((m) => { if (m.m && !missions.has(m.m)) { missions.add(m.m); take(m); } }); // 4. one per mission
    // then the rest, spread across the evening
    const rest = photos.filter((m) => !seen.has(String(m._id))).sort((a, b) => a.at - b.at);
    const want = Math.max(0, n - picked.length);
    if (rest.length && want) { const stepN = rest.length / Math.min(want, rest.length); for (let i = 0; i < Math.min(want, rest.length); i++) take(rest[Math.floor(i * stepN)]); }
    const sc = new Map(ranked.map((x) => [x.id, x.s]));
    const vids = videos.slice().sort((a, b) => (Number(!!b.hl) - Number(!!a.hl)) || ((sc.get(String(b._id)) || 0) - (sc.get(String(a._id)) || 0)) || (a.at - b.at)).slice(0, 2);
    return { photos: picked.slice(0, n).sort((a, b) => a.at - b.at), videos: vids };
  }

  // ---------- best-of: music ----------
  // The tunes, the host's song and the trailer's effects are made by event-cine.js (ESCine.music), which the live
  // screen shares for its background music.
  const music = (o) => (window.ESCine && ESCine.music ? ESCine.music(o) : Promise.resolve(null));

  // ---------- best-of: rendering ----------
  function loadImage(src) { return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
  async function loadVideo(bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: (EM.sniff && EM.sniff.bytes && EM.sniff.bytes(bytes.subarray(0, 64))) || 'video/mp4' }));
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const ok = await new Promise((r) => { const t = setTimeout(() => r(false), 8000); v.onloadeddata = () => { clearTimeout(t); r(true); }; v.onerror = () => { clearTimeout(t); r(false); }; });
    if (!ok) { URL.revokeObjectURL(url); return null; }
    return { v, url };
  }
  function seek(v, s) {
    return new Promise((r) => {
      if (Math.abs(v.currentTime - s) < 0.001 && v.readyState >= 2) { r(); return; }
      const t = setTimeout(() => { v.removeEventListener('seeked', on); r(); }, 1500);
      const on = () => { clearTimeout(t); r(); };
      v.addEventListener('seeked', on, { once: true });
      try { v.currentTime = s; } catch (e) { clearTimeout(t); r(); }
    });
  }
  function cover(g, img, x, y, w, h, iw, ih) {
    const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  async function bestOf(code, o = {}) {
    if (!window.EFX || !window.EM || !EM.mp4) throw err('DENIED', 'event-fx.js and event-mp4.js are needed');
    const ev = await ES.events.get(code);
    // o.full: the Wish Reel (bought for this event, Premium, or a paid plan): every wish, no mark, Full HD, up to 3 minutes
    const full = !!o.full, free = !full && !!(ev.cap && ev.cap.mk);
    let K = full ? 1.5 : 1;
    // Full HD only where this device's encoder takes it (an emulator, some phones: no 1080p H.264); else 720p, still
    // with sound (the MediaRecorder fallback would make a silent WebM).
    if (K > 1 && o.prefer !== 'recorder' && !(await EM.mp4.encoderConfig({ w: (o.aspect === '16:9' ? 1920 : 1080), h: (o.aspect === '16:9' ? 1080 : 1920), fps: 30, bitrate: 5e6 }))) K = 1;
    const W = Math.round((o.aspect === '16:9' ? 1280 : 720) * K), H = Math.round((o.aspect === '16:9' ? 720 : 1280) * K), FPS = 30;
    // o.style 'cinema': the trailer (event-cine.js): an opening line, lasers, LED lights, camera moves and sound effects
    const cine = o.style === 'cinema' && !!window.ESCine;
    const TITLE = cine ? 4500 : 3000, PHOTO = cine ? 1800 : 2200, VIDEO = 4000, FINALE = 10000, END = free ? 3000 : 0, WISH = 3000, REVEAL = 4400;
    progress(o, 0.01);
    const pick = await select(code, { ev, n: 24 });
    let vids = ev.cap && ev.cap.mk ? [] : pick.videos;
    // The wishes: guests shown on the screen, those who wrote one first, in the order they came. Each reveal takes 4.4 s;
    // the next one's rocket goes up 3 s after the last, while its words fade.
    const wishMs = (n) => (n > 0 ? (n - 1) * WISH + REVEAL : 0);
    let wishers = (await listAll('guests', code, [1], GUEST_SEL).catch(() => []))
      .sort((a, b) => (Number(!!b.wi) - Number(!!a.wi)) || (a.at - b.at));
    // o.pick: the wishes the host chose, in their order (seat numbers); the others stay out
    if (Array.isArray(o.pick)) { const at = new Map(o.pick.map((n, i) => [String(n), i])); wishers = wishers.filter((g) => at.has(String(g._id))).sort((a, b) => at.get(String(a._id)) - at.get(String(b._id))); }
    // The Wish Reel is as long as it needs to be (30 s to 3 minutes); the others have their plan's length.
    const need = TITLE + wishMs(wishers.length) + Math.min(24, pick.photos.length) * PHOTO + vids.length * VIDEO + FINALE;
    const seconds = full ? Math.max(30, Math.min(180, Math.ceil(need / 1000))) : Math.max(20, Math.min(90, +o.seconds || (free ? 30 : 60)));
    const avail = seconds * 1000 - TITLE - FINALE - END;
    // An occasion for one person or a couple (a birthday, an anniversary, get well soon, Christmas for Amma) is about
    // the wishes: they come first, every one that fits. Weddings, parties and office events keep up to half the reel for
    // the photos and clips they have (no more than those can use). The Wish Reel keeps room for 6 photos and the clips.
    const media = Math.min(24, pick.photos.length) * PHOTO + vids.length * VIDEO;
    const wishRoom = !pick.photos.length ? avail
      : full ? Math.max(0, avail - Math.min(6, pick.photos.length) * PHOTO - vids.length * VIDEO)
        : !['wedding', 'party', 'corporate'].includes(ev.tpl) ? avail : Math.max(avail / 2, avail - media);
    let nW = wishers.length;
    while (nW && wishMs(nW) > wishRoom) nW--;
    const room = (ms) => Math.floor((avail - wishMs(nW) - ms) / PHOTO);
    while (vids.length && room(vids.length * VIDEO) < Math.min(6, pick.photos.length)) vids = vids.slice(0, -1);
    const nP = Math.max(0, Math.min(24, pick.photos.length, room(vids.length * VIDEO)));
    // spread the photos we keep across the evening
    const photos = nP >= pick.photos.length ? pick.photos : Array.from({ length: nP }, (_, i) => pick.photos[Math.floor((i * pick.photos.length) / nP)]);
    cancelled(o.signal);
    const bytes = await bytesOf(code, photos.map((m) => String(m._id)), 'd');
    const vbytes = vids.length ? await bytesOf(code, vids.map((m) => String(m._id)), 'd') : new Map();
    const guests = new Map(wishers.map((g) => [+g._id, g.nm || '']));
    const seats = [...new Set(photos.map((m) => m.s).filter((s) => s >= 0 && !guests.has(s)))];
    if (seats.length) {
      const docs = await ES.fs.batchGet(seats.map((s) => `events/${code}/guests/${s}`), { mask: ['nm', 'st'], auth: true }).catch(() => []);
      seats.forEach((s, i) => { if (docs[i] && docs[i].st !== 3) guests.set(s, docs[i].nm || ''); });
    }
    const faces = [];
    const sb = nW ? await bytesOf(code, wishers.slice(0, nW).map((g) => String(g._id)), 'im').catch(() => new Map()) : new Map();
    for (const g of wishers.slice(0, nW)) {
      const b = sb.get(String(g._id));
      if (!b) continue;
      try { faces.push({ g, bmp: await createImageBitmap(new Blob([b], { type: 'image/jpeg' })) }); } catch (e) { /* skip a broken one */ }
    }
    progress(o, 0.08);
    const bitmaps = [];
    for (const m of photos) {
      const b = bytes.get(String(m._id));
      if (!b) continue;
      try { bitmaps.push({ m, bmp: await createImageBitmap(new Blob([b], { type: 'image/jpeg' })) }); } catch (e) { /* skip a broken one */ }
    }
    const clips = [];
    for (const m of vids) {
      const b = vbytes.get(String(m._id));
      if (!b) continue;
      const lv = await loadVideo(b);
      if (!lv) continue;
      let flashy = false;
      try { flashy = !!(await EM.video.flashScore(new Blob([b]), { maxMs: VIDEO, signal: o.signal })).flashy; } catch (e) { flashy = false; }
      clips.push(Object.assign(lv, { m, flashy }));
    }
    progress(o, 0.12);
    const art = await loadImage(`assets/worlds/scenes/${/^[a-z-]{2,40}$/.test(ev.world || '') ? ev.world : 'golden-manor'}.jpg`);
    await EFX.ready().catch(() => {});
    if (free && EM.mark.ready) await Promise.race([EM.mark.ready(), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
    // the timeline
    const tPhotos = TITLE + wishMs(faces.length), tVideos = tPhotos + bitmaps.length * PHOTO, tFinale = tVideos + clips.length * VIDEO, tEnd = tFinale + FINALE;
    const total = tEnd + END, frames = Math.round(total * FPS / 1000);
    const canvas = document.createElement('canvas');
    let markBox = null, current = null;
    const mission = (id) => ((ev.ms || []).find((x) => x.id === id) || {}).t || '';
    const overlay = (g, w, h, t) => {
      if (cine && plan) ESCine.over(g, w, h, t, plan, words); // the trailer's opening line, tags, vignette and bars (still)
      if (current && t >= current.at && t < current.at + VIDEO) { // a guest video, muted, faded in and out
        const a = Math.min(1, (t - current.at) / 300, (current.at + VIDEO - t) / 300);
        g.save(); g.globalAlpha = Math.max(0, a);
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const vw = current.v.videoWidth || 640, vh = current.v.videoHeight || 360, s = Math.min(w / vw, h / vh);
        dimDraw(g, current.v, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s, current.flashy);
        g.restore();
      }
      if (free && t >= tEnd) { // the end card: the mark large, with the Play link
        const a = Math.min(1, (t - tEnd) / 400);
        g.save(); g.globalAlpha = a; g.fillStyle = '#070b24'; g.fillRect(0, 0, w, h);
        const k = (Math.min(w, h) / 300);
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
        const box = EM.mark.draw(tmp.getContext('2d'), w, h, { kind: 'brand', corner: 'bl', scale: k });
        if (box) g.drawImage(tmp, box.x - 4, box.y - 4, box.w + 8, box.h + 8, (w - box.w) / 2 - 4, (h - box.h) / 2 - 4, box.w + 8, box.h + 8);
        tmp.width = tmp.height = 0;
        g.fillStyle = '#ffe7a3'; g.font = `600 ${Math.round(Math.min(w, h) * 0.03)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText('play.google.com · Light Up the Skies', w / 2, h / 2 + (box ? box.h / 2 + 20 : 40));
        g.restore();
      } else if (free) markBox = EM.mark.draw(g, w, h, { kind: 'brand', corner: 'br', scale: Math.min(w, h) / 560 }) || markBox; // §4.23: free MP4s carry the mark
    };
    // Wide: the landmark fills the frame, so the wishes' words would sit on its lit front; a soft dark band behind them.
    let sky = art;
    if (art && W > H && faces.length) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      cover(g, art, 0, 0, W, H, art.naturalWidth || art.width, art.naturalHeight || art.height);
      const band = g.createLinearGradient(0, H * 0.4, 0, H * 0.74);
      band.addColorStop(0, 'rgba(4,6,20,0)'); band.addColorStop(0.3, 'rgba(4,6,20,0.62)'); band.addColorStop(0.7, 'rgba(4,6,20,0.62)'); band.addColorStop(1, 'rgba(4,6,20,0)');
      g.fillStyle = band; g.fillRect(0, 0, W, H);
      sky = c;
    }
    let plan = null; // (the trailer's plan, made once the acts are on the stage: its bursts shake the camera)
    // The trailer is drawn in this one canvas: its lights in the underlay, its camera as the stage's (event-cine.js)
    const stage = EFX.stage(canvas, { seed: `best-of-${code}`, dpr: 1, tier: 'laptop', reduced: !!o.reduced, role: 'main', width: W, height: H, readback: true, bg: sky || '#070b24', overlay,
      underlay: cine ? (g, w, h, t) => { if (plan) ESCine.under(g, w, h, t, plan); } : undefined,
      camera: cine ? (t) => (plan ? ESCine.cameraAt(t, plan, W, H) : null) : undefined });
    const add = (a) => stage.add(a);
    const titleText = [ev.title, ev.names].filter(Boolean).join('\n');
    const T0 = cine ? 2300 : 0; // the trailer opens on its line in light first (ESCine), then the title in sparks
    add(EFX.textSparks({ t: T0 + 300, text: titleText, x: 0.5, y: H > W ? 0.4 : 0.42, ms: cine ? 2100 : 2800, size: H > W ? 0.085 : 0.1, id: 'title' }));
    add(EFX.burst({ t: T0 + 600, x: 0.28, y: 0.22, kind: 'peony', hue: 42, rocket: true, id: 'b0' }));
    add(EFX.burst({ t: T0 + 1500, x: 0.72, y: 0.2, kind: 'chrysanthemum', hue: 330, rocket: true, id: 'b1' }));
    // (high in the sky: the name and wish are written under the photo, and must stay above the landmark's lit roofline)
    faces.forEach((x, i) => add(EFX.reveal({ t: TITLE + i * WISH, photo: x.bmp, name: x.g.nm || '', wish: x.g.wi || '', x: 0.5, y: H > W ? 0.24 : 0.34, salute: true, id: `w${i}` })));
    bitmaps.forEach((x, i) => {
      const t = tPhotos + i * PHOTO;
      add(EFX.slide({ t, photo: x.bmp, ms: PHOTO, seed: `${code}-${i}`, caption: x.m.cp || '', name: x.m.s >= 0 ? guests.get(x.m.s) || '' : T('Photographer'), mission: mission(x.m.m), id: `s${i}` }));
      if (i % 4 === 3) add(EFX.burst({ t: t + 400, x: 0.2 + 0.6 * ((i * 37) % 10) / 10, y: 0.15, kind: ['peony', 'ring', 'palm', 'willow'][i % 4], size: 0.8, id: `sb${i}` }));
    });
    clips.forEach((c, i) => { c.at = tVideos + i * VIDEO; });
    const date = fmtDate(ev.opensAt, ev.tz);
    add(EFX.finale({ t: tFinale, title: ev.title, names: ev.names || ev.title, date, photos: faces.concat(bitmaps).slice(0, 48).map((x) => x.bmp), end: 'kamuro', drones: true, shells: 0, words: false, id: 'finale' }));
    // The trailer's show around the sky: one section per part (each gets its laser and LED pattern), the bursts' instants
    // for the camera shake and the booms, the opening line and a tag on every wish.
    let words = null;
    if (cine) {
      const th = ESCine.theme(ev.tpl), sections = [{ kind: 'open', at: 0, ms: TITLE }];
      faces.forEach((x, i) => sections.push({ kind: 'wish', at: TITLE + i * WISH, ms: i === faces.length - 1 ? REVEAL : WISH }));
      for (let i = 0; i < bitmaps.length; i += 3) sections.push({ kind: 'photo', at: tPhotos + i * PHOTO, ms: Math.min(3, bitmaps.length - i) * PHOTO });
      clips.forEach((c) => sections.push({ kind: 'video', at: c.at, ms: VIDEO }));
      sections.push({ kind: 'finale', at: tFinale, ms: FINALE });
      if (END) sections.push({ kind: 'end', at: tEnd, ms: END });
      plan = ESCine.plan({ dur: total, sections, booms: stage.stats().bright, theme: th, w: W, h: H, seed: `cine-${code}`, reduced: !!o.reduced });
      const who = ev.names || ev.title;
      words = { opener: ESCine.fill(th.opener, who), openerUntil: T0 + 200,
        tags: faces.map((x, i) => ({ at: TITLE + i * WISH + 1300, ms: 2600, text: th.tag === 'reason' ? ESCine.fill('Reason #{0}', i + 1) : ESCine.fill('Wish {0} of {1}', i + 1, faces.length) })) };
    }
    let out, sound = null;
    const kind = o.music && o.music.kind ? o.music.kind : 'none';
    const mo = { kind, file: o.music && o.music.file, seconds: total / 1000, cues: cine ? ESCine.cues(plan) : null, signal: o.signal };
    try {
      // (inside the try: a Cancel during the sound still frees the stage and the bitmaps below)
      if (kind !== 'none' || cine) { try { sound = await music(mo); } catch (e) { if (e && e.code === 'CANCELLED') throw e; sound = null; } }
      out = await EM.mp4.render({
        w: W, h: H, fps: FPS, bitrate: K > 1 ? 5e6 : 3e6, frames, canvas, signal: o.signal, prefer: o.prefer, audio: sound,
        onProgress: (f) => progress(o, 0.12 + 0.88 * f),
        draw: async (ctx, i, tMs) => {
          current = clips.find((c) => tMs >= c.at && tMs < c.at + VIDEO) || null;
          if (current) await seek(current.v, Math.min((tMs - current.at) / 1000, Math.max(0, (current.v.duration || 4) - 0.05)));
          stage.render(tMs);
        },
      });
    } finally {
      const st = stage.stats();
      ESExport.last = { du: Math.round(total), frames, w: W, h: H, photos: bitmaps.length, videos: clips.length, wishes: faces.length, wishesLeft: wishers.length - faces.length, bright: st.bright.slice(), denied: st.denied, markBox, free,
        mime: out && out.mime, path: out && out.path, finaleAt: tFinale, endAt: tEnd, full, audio: !!(out && out.audio), music: !!sound && kind !== 'none' && !mo.failed,
        cine, sections: plan ? plan.sections.map((x) => ({ kind: x.kind, at: x.at, ms: x.ms, laser: x.laser, led: x.led })) : null, cues: plan ? ESCine.cues(plan).length : 0 };
      stage.dispose();
      faces.concat(bitmaps).forEach((x) => { try { x.bmp.close(); } catch (e) { /* closed */ } });
      clips.forEach((c) => { URL.revokeObjectURL(c.url); c.v.removeAttribute('src'); try { c.v.load(); } catch (e) { /* gone */ } });
      canvas.width = canvas.height = 0;
    }
    return out.blob;
  }

  // A flashy clip is drawn grey and at half brightness. Safari 17 and older ignore ctx.filter, so the dimming is a 50 %
  // black layer over the frame (the filter, where it works, only takes the colour out).
  function dimDraw(g, src, x, y, w, h, flashy) {
    const filterOk = flashy && typeof g.filter === 'string';
    if (filterOk) g.filter = 'grayscale(1)';
    try { g.drawImage(src, x, y, w, h); } catch (e) { /* not ready */ }
    if (filterOk) g.filter = 'none';
    if (flashy) { g.save(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, w, h); g.restore(); }
  }

  // ---------- photo book ----------
  async function bookPdf(code, o = {}) {
    const ev = await ES.events.get(code);
    const tz = ev.tz, max = o.max || 300, perPage = o.perPage === 4 ? 4 : 1;
    const now = ES.clock.now();
    let media = (await listAll('media', code, [1], MEDIA_SEL)).filter((m) => m.kd === 'p' && !(m.rv > now));
    if (o.only === 'highlights' && media.some((m) => m.hl)) media = media.filter((m) => m.hl);
    if (media.length > max) throw err('FULL', 'A photo book holds up to 300 photos. Pick highlights first.');
    media.sort((a, b) => a.at - b.at);
    progress(o, 0.02);
    const fns = ev.fns || [];
    const names = new Map();
    const seats = [...new Set(media.map((m) => m.s).filter((s) => s >= 0))];
    for (let i = 0; i < seats.length; i += 100) {
      const part = seats.slice(i, i + 100);
      const docs = await ES.fs.batchGet(part.map((s) => `events/${code}/guests/${s}`), { mask: ['nm'], auth: true }).catch(() => []);
      part.forEach((s, j) => names.set(s, (docs[j] && docs[j].nm) || ''));
    }
    const doc = EM.pdf.doc({ size: 'A4', title: ev.title });
    const PW = doc.w, PH = doc.h, M = 36;
    const NAVY = '#070b24', GOLD = '#f5c451';
    const footer = () => { if (ev.cap && ev.cap.mk) doc.text(`Light Up the Skies · ${T('Get it on Google Play')}`, M, PH - 26, PW - 2 * M, 16, { size: 7.5, color: '#6b6f8c', align: 'center' }); };
    // cover
    doc.page();
    doc.rect(0, 0, PW, PH, NAVY);
    try {
      const r = await fetch(`assets/worlds/scenes/${/^[a-z-]{2,40}$/.test(ev.world || '') ? ev.world : 'golden-manor'}.jpg`);
      if (r.ok) doc.jpeg(new Uint8Array(await r.arrayBuffer()), 0, PH * 0.18, PW, PH * 0.5, { fit: 'cover' });
    } catch (e) { /* no art */ }
    doc.text(ev.title, M, PH * 0.7, PW - 2 * M, 60, { size: 30, color: GOLD, bg: NAVY, align: 'center', weight: 700, maxLines: 2, font: 'Cinzel, "Noto Serif Devanagari", Georgia, serif' });
    if (ev.names) doc.text(ev.names, M, PH * 0.7 + 64, PW - 2 * M, 30, { size: 18, color: '#ffe7a3', bg: NAVY, align: 'center' });
    doc.text(fmtDate(ev.opensAt, tz), M, PH * 0.7 + 100, PW - 2 * M, 22, { size: 12, color: '#a9acc4', bg: NAVY, align: 'center' });
    // photos
    for (let i = 0; i < media.length; i += 20) {
      cancelled(o.signal);
      const part = media.slice(i, i + 20);
      const bytes = await bytesOf(code, part.map((m) => String(m._id)), 'd');
      for (let j = 0; j < part.length; j++) {
        const idx = i + j, m = part[j], b = bytes.get(String(m._id));
        const slot = idx % perPage;
        if (slot === 0) { doc.page(); footer(); }
        const cap = [m.s >= 0 ? names.get(m.s) : T('Photographer'), (fns.find((f) => f.id === m.fn) || {}).n, m.cp].filter(Boolean).join(' · ');
        let x, y, w, hh;
        if (perPage === 1) { x = M; y = M; w = PW - 2 * M; hh = PH - 2 * M - 60; } else {
          const cw = (PW - 2 * M - 14) / 2, ch = (PH - 2 * M - 40) / 2;
          x = M + (slot % 2) * (cw + 14); y = M + Math.floor(slot / 2) * (ch + 20); w = cw; hh = ch - 30;
        }
        // the photo fitted inside its cell (centred on its own page, at the top of a grid cell), the caption right under it
        let bottom = y + hh;
        const inf = b ? EM.pdf.jpegInfo(b) : null;
        if (b && inf) {
          const k = Math.min(w / inf.w, hh / inf.h), dw = inf.w * k, dh = inf.h * k;
          const dy = perPage === 1 ? y + (hh - dh) / 2 : y;
          try { doc.jpeg(b, x + (w - dw) / 2, dy, dw, dh); bottom = dy + dh; } catch (e) { /* not a JPEG this PDF can hold */ }
        }
        if (cap) doc.text(cap, x, bottom + 6, w, perPage === 1 ? 40 : 24, { size: perPage === 1 ? 12 : 9, color: '#222', align: 'center', maxLines: 2 });
      }
      progress(o, 0.05 + 0.85 * Math.min(1, (i + part.length) / Math.max(1, media.length)));
      await tick();
    }
    // the guestbook's messages (host and co-hosts)
    const msgs = await book(code).catch(() => null);
    const texts = (msgs || []).filter((m) => m.tx);
    if (texts.length) {
      let y = PH;
      for (const m of texts) {
        const lines = Math.min(12, Math.ceil(m.tx.length / 80) + (m.tx.match(/\n/g) || []).length + 1);
        const need = 22 + lines * 14 + 14;
        if (y + need > PH - M - 30) {
          doc.page(); footer();
          doc.text(T('Guestbook'), M, M, PW - 2 * M, 30, { size: 20, color: '#8a6a10', weight: 700 });
          y = M + 40;
        }
        doc.text(m.nm, M, y, PW - 2 * M, 20, { size: 12, color: '#111', weight: 700 });
        doc.text(m.tx, M, y + 20, PW - 2 * M, lines * 14 + 4, { size: 10.5, color: '#333', valign: 'top', maxLines: lines });
        y += need;
      }
    }
    // back page
    doc.page();
    doc.rect(0, 0, PW, PH, NAVY);
    doc.text(T('Thank you for celebrating with us'), M, PH * 0.4, PW - 2 * M, 40, { size: 20, color: GOLD, bg: NAVY, align: 'center' });
    doc.text([ev.title, ev.names].filter(Boolean).join(' · '), M, PH * 0.4 + 48, PW - 2 * M, 26, { size: 13, color: '#ffe7a3', bg: NAVY, align: 'center' });
    if (ev.cap && ev.cap.mk) doc.text(`${T('Made with Light Up the Skies')} · ${T('Get it on Google Play')}`, M, PH - 60, PW - 2 * M, 20, { size: 9, color: '#a9acc4', bg: NAVY, align: 'center' });
    progress(o, 1);
    return doc.finish();
  }

  window.ESExport = { zip, bestOf, book: bookPdf, csv, select, csvRows, music, last: null, _dimDraw: dimDraw };
})();
