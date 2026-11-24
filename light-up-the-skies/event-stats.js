/* Event Sky stats: window.ESStats (event-stats.js). Build spec: research/event-sky-spec.md §3.7 and §4.17.
 *
 *  ESStats.collect(code, {ev?, key?}) → {hours:[{a,u,o,r,s,d,v}], start, tz, totals:{guests, photos, videos, reactions, opens,
 *       downloads, searches, plays}, top:[{gi, id, n, thumb?:Blob}], perFn:[{id, n, guests, photos}]}
 *     Counters only (RTDB stt and rx), plus aggregation counts in Firestore: no cookies and no identifiers (§4.25).
 *  ESStats.render(container, code, {ev?}) → the same object, after drawing into container:
 *     "Arrivals over time" and photos per hour as canvas bar charts (each with a hidden data table for screen readers),
 *     the totals, "Most loved photos" (top 6 by reactions, thumbnails from the encrypted gallery pages) and "Per function".
 * Staff only (stt is readable by staff; the counts need a staff sign-in).
 */
/* STRINGS:
Arrivals over time
Photos per hour
Guests checked in
Photos
Videos
Reactions
Gallery opens
Downloads
Selfie searches
Video plays
Most loved photos
Per function
{0} reactions
{0} guests · {1} photos
No reactions yet.
Hour
Arrivals
Uploads
Nothing yet. Numbers appear here as guests arrive.
*/
(function () {
  'use strict';
  if (window.ESStats) return;
  const HOUR = 36e5;
  const T = (s) => { try { return (window.LUTSLang && LUTSLang.t && LUTSLang.t(s)) || s; } catch (e) { return s; } };
  const F = (s, ...a) => String(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : String(v)); }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  async function count(code, from, where) {
    try { return (await ES.fs.aggregate(`events/${code}`, { from, where, aggs: { n: ['count'] }, auth: true })).n || 0; } catch (e) { return null; }
  }
  // gi → page item (with its thumbnail), from the encrypted gallery pages.
  async function galleryItems(code, gis, keyB64) {
    const out = new Map();
    if (!gis.length || !window.EM || !EM.page) return out;
    let key = keyB64;
    try { if (!key) key = await ES.gallery.key.get(code); } catch (e) { return out; }
    const kb = ES.b64u.dec(key);
    const m = await ES.gallery.manifest(code).catch(() => null);
    if (!m || !m.pc) return out;
    const want = new Set(gis), seen = new Set();
    const tryPage = async (n) => {
      if (seen.has(n) || n < 0 || n >= m.pc) return;
      seen.add(n);
      const items = await ES.gallery.page(code, n, kb, { vr: m.vr }).catch(() => []);
      for (const it of items) if (want.has(it.gi)) out.set(it.gi, it);
    };
    for (const g of gis) await tryPage(Math.floor(g / 100)); // pages fill 100 at a time
    for (let n = 0; n < m.pc && out.size < want.size; n++) await tryPage(n);
    return out;
  }
  async function collect(code, o = {}) {
    const ev = o.ev || await ES.events.get(code);
    const [st, rx] = await Promise.all([ES.stats(code).catch(() => ({ hours: [] })), ES.reactions(code).catch(() => ({}))]);
    const hours = st.hours || [];
    const sum = (k) => hours.reduce((a, x) => a + (+x[k] || 0), 0);
    let photos = await count(code, 'media', [['kd', '==', 'p'], ['st', 'in', [0, 1, 2]]]);
    if (photos == null) photos = await count(code, 'media', [['kd', '==', 'p']]);
    let videos = await count(code, 'media', [['kd', '==', 'v'], ['st', 'in', [0, 1, 2]]]);
    if (videos == null) videos = await count(code, 'media', [['kd', '==', 'v']]);
    const guests = await count(code, 'guests', [['st', 'in', [0, 1, 2]]]);
    const per = Object.entries(rx || {}).map(([gi, r]) => ({ gi: +gi, n: ['h', 'f', 'w', 'c'].reduce((a, k) => a + (+((r || {})[k]) || 0), 0) })).filter((x) => x.n > 0 && Number.isInteger(x.gi));
    per.sort((a, b) => b.n - a.n || a.gi - b.gi);
    const reactions = per.reduce((a, x) => a + x.n, 0);
    const top = per.slice(0, 6);
    if (o.thumbs !== false) {
      const items = await galleryItems(code, top.map((x) => x.gi), o.key);
      top.forEach((t) => { const it = items.get(t.gi); if (it) { t.id = it.id; t.thumb = it.thumb; } });
    }
    const perFn = [];
    const live = async (coll, f) => { // left out: guests who deleted their check-in and photos (st 3)
      const n = await count(code, coll, [['fn', '==', f], ['st', 'in', [0, 1, 2]]]);
      return n != null ? n : ((await count(code, coll, [['fn', '==', f]])) || 0);
    };
    for (const f of ev.fns || []) perFn.push({ id: f.id, n: f.n, guests: await live('guests', f.id), photos: await live('media', f.id) });
    return {
      hours, start: ev.opensAt, tz: ev.tz, top, perFn,
      totals: { guests: guests || 0, photos: photos || 0, videos: videos || 0, reactions, opens: sum('o'), downloads: sum('d'), searches: sum('s'), plays: sum('v') },
    };
  }

  // ---------- drawing ----------
  function hourLabel(ms, tz) {
    try { return new Intl.DateTimeFormat(((window.LUTSLang && LUTSLang.lang) || 'en') + '-IN', { hour: 'numeric', timeZone: tz || undefined }).format(new Date(ms)); } catch (e) { return new Date(ms).getHours() + ':00'; }
  }
  function bars(canvas, values, labels, color) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(280, canvas.clientWidth || 600), H = Math.max(140, canvas.clientHeight || 180);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const padL = 34, padB = 24, padT = 12, padR = 8, cw = W - padL - padR, ch = H - padT - padB;
    const max = Math.max(1, ...values);
    const step = Math.max(1, Math.ceil(max / 4));
    g.font = '11px system-ui, sans-serif'; g.fillStyle = '#a9acc4'; g.strokeStyle = 'rgba(169,172,196,.25)'; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = 0; v <= max; v += step) {
      const y = padT + ch - (v / max) * ch;
      g.beginPath(); g.moveTo(padL, Math.round(y) + 0.5); g.lineTo(W - padR, Math.round(y) + 0.5); g.stroke();
      g.fillText(String(v), padL - 6, y);
    }
    const n = Math.max(1, values.length), bw = cw / n;
    g.fillStyle = color;
    values.forEach((v, i) => {
      const bh = (v / max) * ch;
      if (bh > 0) g.fillRect(padL + i * bw + bw * 0.15, padT + ch - bh, Math.max(1, bw * 0.7), bh);
    });
    g.fillStyle = '#a9acc4'; g.textAlign = 'center'; g.textBaseline = 'top';
    const every = Math.ceil(n / Math.max(1, Math.floor(cw / 46)));
    labels.forEach((l, i) => { if (i % every === 0) g.fillText(l, padL + i * bw + bw / 2, padT + ch + 6); });
  }
  function chart(title, values, labels, color) {
    const cv = h('canvas', { role: 'img', 'aria-label': `${T(title)}: ${values.reduce((a, b) => a + b, 0)}` });
    const table = h('table', { class: 'es-sr' }, h('caption', null, title),
      h('thead', null, h('tr', null, h('th', null, 'Hour'), h('th', null, title === 'Arrivals over time' ? 'Arrivals' : 'Uploads'))),
      h('tbody', null, values.map((v, i) => h('tr', null, h('td', null, labels[i]), h('td', null, String(v))))));
    const box = h('section', { class: 'eh-card' }, h('h3', null, title), cv, table);
    requestAnimationFrame(() => bars(cv, values, labels, color));
    return { box, cv, draw: () => bars(cv, values, labels, color) };
  }

  async function render(container, code, o = {}) {
    if (!container) return null;
    container.classList.add('es-stats');
    container.setAttribute('aria-busy', 'true');
    let data;
    try { data = await collect(code, o); } finally { container.setAttribute('aria-busy', 'false'); }
    container.textContent = '';
    const hours = data.hours.slice();
    const span = Math.max(hours.length, 1);
    const labels = Array.from({ length: span }, (_, i) => hourLabel(data.start + i * HOUR, data.tz));
    if (!hours.length && !data.totals.guests) container.append(h('p', { class: 'eh-muted' }, 'Nothing yet. Numbers appear here as guests arrive.'));
    const a = chart('Arrivals over time', Array.from({ length: span }, (_, i) => (hours[i] || {}).a || 0), labels, '#f5c451');
    const u = chart('Photos per hour', Array.from({ length: span }, (_, i) => (hours[i] || {}).u || 0), labels, '#ffb6d9');
    const t = data.totals;
    const tot = h('ul', { class: 'es-tot' },
      [['Guests checked in', t.guests], ['Photos', t.photos], ['Videos', t.videos], ['Reactions', t.reactions], ['Gallery opens', t.opens], ['Downloads', t.downloads], ['Selfie searches', t.searches]]
        .map(([k, v]) => h('li', null, h('b', null, String(v)), h('span', null, k))));
    const top = h('section', { class: 'eh-card' }, h('h3', null, 'Most loved photos'));
    if (!data.top.length) top.append(h('p', { class: 'eh-muted' }, 'No reactions yet.'));
    else {
      const ul = h('ul', { class: 'es-top' });
      for (const x of data.top) {
        const url = x.thumb ? URL.createObjectURL(x.thumb) : '';
        const img = url ? h('img', { src: url, alt: '' }) : h('div', { style: 'aspect-ratio:1/1;background:#151c4d' });
        if (url) img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        ul.append(h('li', null, img, h('span', null, F('{0} reactions', x.n))));
      }
      top.append(ul);
    }
    container.append(a.box, u.box, tot, top);
    if (data.perFn.length) {
      container.append(h('section', { class: 'eh-card' }, h('h3', null, 'Per function'),
        h('ul', { class: 'eh-list' }, data.perFn.map((f) => h('li', null, h('b', { 'data-no-i18n': '', class: 'eh-grow' }, f.n), h('span', null, F('{0} guests · {1} photos', f.guests, f.photos)))))));
    }
    const redraw = () => { a.draw(); u.draw(); };
    if (render._ro) render._ro.disconnect();
    if (window.ResizeObserver) { render._ro = new ResizeObserver(() => redraw()); render._ro.observe(container); }
    return data;
  }

  window.ESStats = { render, collect };
})();
