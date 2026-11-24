/* Event Sky printables: window.ESPrint (event-print.js). Build spec: research/event-sky-spec.md §3.7 and §4.14.
 *
 *  ESPrint.make(code, {kind:'a6x4'|'a4'|'a5', lang, format:'pdf'|'png', pub?}) → Blob
 *     a6x4: one A4 sheet with 4 A6 table cards (cut along the thin lines); a4 / a5: one poster.
 *     Every card: the event's world scene art (a drawing; never photos), the title and names, "Scan to light up the sky",
 *     a QR of ES.urls.guest(code, {lang}) with "Code {0}", the website address in small print, the delete date, and the
 *     event's logo (paid plans with one) or the Light Up the Skies brand mark (free plans). Card text is in the chosen
 *     language with English under it. Dark navy and gold.
 *     PDF: the art and text are one JPEG per card (text drawn by the browser, so every script shapes), and the QR is
 *     vector (EM.pdf qr). PNG: the whole sheet at 2.5 px per point (180 dpi) with a pixel-exact QR.
 *  ESPrint.dict(lang) → Promise<{english: translation}>   the event dictionary for a card language (i18n/event/<lang>.js)
 *  ESPrint.last → {kind, format, w, h, unit, url, qr:[{x, y, size, quiet, n}]}   where the QR codes went (tests)
 *
 * Needs event-sky.js (ES.pub, ES.urls, ES.QR), event-media.js (EM.mark) and, for PDF, event-pdf.js (EM.pdf).
 */
/* STRINGS:
Scan to light up the sky
Code {0}
Photos are kept until {0}
*/
(function () {
  'use strict';
  if (window.ESPrint) return;
  const PT = { A4: [595.28, 841.89], A5: [419.53, 595.28] };
  const FONT = 'Cinzel, "Noto Serif Devanagari", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gurmukhi", Georgia, serif';
  const SANS = 'system-ui, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gurmukhi", sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const err = (code, msg) => (window.ES ? ES.err(code, 0, msg) : Object.assign(new Error(msg), { code }));

  // ---------- the card language's dictionary (event dictionaries, loaded without touching the page's own) ----------
  const dicts = new Map();
  function dict(lang) {
    if (!lang || lang === 'en' || !/^[a-z]{2}$/.test(lang)) return Promise.resolve({});
    if (window.LUTSLang && LUTSLang.lang === lang && typeof LUTSLang.t === 'function') return Promise.resolve(null); // the page's own: use LUTSLang.t
    if (dicts.has(lang)) return dicts.get(lang);
    const p = new Promise((resolve) => {
      const had = Object.prototype.hasOwnProperty.call(window, 'LUTS_I18N'), prev = window.LUTS_I18N;
      const s = document.createElement('script');
      s.src = `${window.LUTS_I18N_DIR || 'i18n/event/'}${lang}.js`;
      window.LUTS_I18N = null;
      const restore = () => { if (had) window.LUTS_I18N = prev; else { try { delete window.LUTS_I18N; } catch (e) { window.LUTS_I18N = undefined; } } s.remove(); };
      s.onload = () => { const d = window.LUTS_I18N && typeof window.LUTS_I18N === 'object' ? window.LUTS_I18N : {}; restore(); resolve(d); };
      s.onerror = () => { restore(); resolve({}); };
      document.head.append(s);
    });
    dicts.set(lang, p);
    return p;
  }
  const fill = (s, ...a) => String(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  function trWith(d, key) { if (d === null) { try { return LUTSLang.t(key) || key; } catch (e) { return key; } } return (d && typeof d[key] === 'string' && d[key]) || key; }
  const hasTr = (d, key) => trWith(d, key) !== key;
  function fmtDate(ms, lang, tz) {
    const loc = /^[a-z]{2}$/.test(lang || '') ? `${lang}-IN` : 'en-IN';
    const o = { day: 'numeric', month: 'long', year: 'numeric' };
    try { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: tz || undefined }, o)).format(new Date(ms)); } catch (e) {
      try { return new Intl.DateTimeFormat(loc, o).format(new Date(ms)); } catch (x) { return new Date(ms).toDateString(); }
    }
  }

  // ---------- images ----------
  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  async function fontsReady() {
    try {
      if (document.fonts && document.fonts.load) await Promise.race([Promise.all(['800 40px Cinzel', '600 40px Cinzel'].map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 3000))]);
    } catch (e) { /* fallback fonts */ }
    try { if (window.EM && EM.mark && EM.mark.ready) await Promise.race([EM.mark.ready(), new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* no icon */ }
  }

  // ---------- text ----------
  function wrap(g, text, maxW, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && g.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last.length > 1 && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    return lines;
  }
  // Draw text centred at (cx, y) inside maxW, shrinking to minScale before wrapping. Returns the height used.
  function text(g, str, cx, y, maxW, o) {
    if (!str) return 0;
    let size = o.size;
    const font = (s) => `${o.weight || 400} ${s}px ${o.family || SANS}`;
    g.font = font(size);
    while (size > o.size * (o.minScale || 0.7) && g.measureText(str).width > maxW) { size *= 0.94; g.font = font(size); }
    const lines = wrap(g, str, maxW, o.lines || 1);
    const lh = size * (o.lh || 1.2);
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = o.color || '#fff';
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * 0.35; }
    lines.forEach((l, i) => g.fillText(l, cx, y + i * lh));
    g.restore();
    return lines.length * lh;
  }

  // ---------- one card ----------
  // Draws the card (without the QR) on g at the origin, w×h px; returns where the QR goes, in px.
  function drawCard(g, w, h, c) {
    g.save();
    g.fillStyle = '#070b24'; g.fillRect(0, 0, w, h);
    if (c.art) { // the world scene, covering the card
      const s = Math.max(w / c.art.width, h / c.art.height), dw = c.art.width * s, dh = c.art.height * s;
      g.globalAlpha = 0.9; g.drawImage(c.art, (w - dw) / 2, (h - dh) * 0.35, dw, dh); g.globalAlpha = 1;
    }
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(7,11,36,.62)'); grad.addColorStop(0.45, 'rgba(7,11,36,.72)'); grad.addColorStop(1, 'rgba(7,11,36,.93)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const inset = w * 0.03;
    g.strokeStyle = 'rgba(245,196,81,.75)'; g.lineWidth = Math.max(1, w * 0.004);
    g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
    g.strokeStyle = 'rgba(245,196,81,.35)'; g.lineWidth = Math.max(1, w * 0.002);
    g.strokeRect(inset * 1.6, inset * 1.6, w - 3.2 * inset, h - 3.2 * inset);
    const cx = w / 2, maxW = w * 0.82;
    let y = h * 0.055;
    y += text(g, c.title, cx, y, maxW, { size: w * 0.078, family: FONT, weight: 800, color: '#f5c451', lines: 2, lh: 1.12, glow: 'rgba(245,196,81,.45)' });
    if (c.names) y += text(g, c.names, cx, y + w * 0.005, maxW, { size: w * 0.05, family: FONT, weight: 600, color: '#ffe7a3', lines: 1 }) + w * 0.005;
    y += w * 0.025;
    y += text(g, c.scan, cx, y, maxW, { size: w * 0.056, weight: 700, color: '#ffffff', lines: 2, lh: 1.15 });
    if (c.scanEn && c.scanEn !== c.scan) y += text(g, c.scanEn, cx, y + w * 0.004, maxW, { size: w * 0.036, color: '#c9cbe0' });
    y += w * 0.03;
    const qr = { size: w * 0.5 };
    qr.x = cx - qr.size / 2; qr.y = y;
    // a soft gold frame behind the white QR square
    g.fillStyle = 'rgba(245,196,81,.9)';
    const fr = w * 0.012;
    roundRect(g, qr.x - fr, qr.y - fr, qr.size + 2 * fr, qr.size + 2 * fr, fr * 1.5); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(qr.x, qr.y, qr.size, qr.size);
    y += qr.size + w * 0.03;
    y += text(g, c.codeLine, cx, y, maxW, { size: w * 0.064, family: MONO, weight: 800, color: '#f5c451' });
    y += w * 0.018;
    y += text(g, c.kept, cx, y, maxW, { size: w * 0.031, color: '#e7e3d4', lines: 2 });
    if (c.keptEn && c.keptEn !== c.kept) y += text(g, c.keptEn, cx, y + w * 0.003, maxW, { size: w * 0.027, color: '#a9acc4' });
    y += w * 0.01;
    text(g, c.site, cx, y, maxW, { size: w * 0.026, family: MONO, color: '#a9acc4', minScale: 0.5 });
    // the host's logo (paid) or our brand mark (free plans only, §4.23)
    if (c.free && window.EM && EM.mark && EM.mark.draw) {
      EM.mark.draw(g, w, h, { kind: 'brand', corner: 'br', scale: w / 420 });
    } else if (c.logo) {
      const box = w * 0.16, s = Math.min(box / c.logo.width, box / c.logo.height), lw = c.logo.width * s, lh = c.logo.height * s;
      const lx = cx - lw / 2, ly = h - inset * 2.2 - lh;
      g.fillStyle = 'rgba(255,255,255,.92)'; roundRect(g, lx - w * 0.012, ly - w * 0.012, lw + w * 0.024, lh + w * 0.024, w * 0.015); g.fill();
      g.drawImage(c.logo, lx, ly, lw, lh);
    }
    g.restore();
    return qr;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  // Pixel-exact QR inside a white square (px): whole-pixel modules, centred, quiet zone 4.
  function drawQrPx(g, q, x, y, size) {
    const quiet = 4, n = q.size, cells = n + 2 * quiet, cell = Math.max(1, Math.floor(size / cells)), real = cell * cells;
    const ox = Math.round(x + (size - real) / 2), oy = Math.round(y + (size - real) / 2);
    g.fillStyle = '#ffffff'; g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(size) + 1, Math.ceil(size) + 1);
    g.fillStyle = '#000000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules[r][c]) g.fillRect(ox + (quiet + c) * cell, oy + (quiet + r) * cell, cell, cell);
    return { x: ox, y: oy, size: real, quiet, n, cell };
  }

  async function content(code, o) {
    const p = o.pub || await ES.pub.get(code);
    if (!p) throw err('NOT_FOUND', 'No such event');
    const lang = ES.LANGS.includes(o.lang) ? o.lang : (p.l || 'en');
    const d = await dict(lang);
    const url = ES.urls.guest(code, { lang });
    const base = ES.urls.base().replace(/^https?:\/\//, '');
    const [art, logo] = await Promise.all([loadImage(`assets/worlds/scenes/${/^[a-z-]{2,40}$/.test(p.w || '') ? p.w : 'golden-manor'}.jpg`), p.mk ? null : loadImage(p.logo || '')]);
    await fontsReady();
    const date = fmtDate(p.x, lang, p.tz), dateEn = fmtDate(p.x, 'en', p.tz);
    return {
      lang, url, q: ES.QR.encode(url), art, logo, free: !!p.mk,
      title: p.t || '', names: p.n || '',
      scan: trWith(d, 'Scan to light up the sky'), scanEn: lang === 'en' ? '' : 'Scan to light up the sky',
      codeLine: fill(trWith(d, 'Code {0}'), code),
      // a sentence without a translation stays English, date included
      kept: hasTr(d, 'Photos are kept until {0}') ? fill(trWith(d, 'Photos are kept until {0}'), date) : fill('Photos are kept until {0}', dateEn),
      keptEn: lang === 'en' ? '' : fill('Photos are kept until {0}', dateEn),
      site: `${base}event.html`,
    };
  }
  // The card boxes on a sheet, in points.
  function layout(kind) {
    if (kind === 'a6x4') {
      const [W, H] = PT.A4, cw = W / 2, ch = H / 2;
      return { size: 'A4', W, H, cards: [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => ({ x, y, w: cw, h: ch })), cut: true };
    }
    const [W, H] = kind === 'a5' ? PT.A5 : PT.A4;
    return { size: kind === 'a5' ? 'A5' : 'A4', W, H, cards: [{ x: 0, y: 0, w: W, h: H }], cut: false };
  }

  async function make(code, o = {}) {
    if (!window.ES) throw err('DENIED', 'event-sky.js is not loaded');
    const kind = ['a6x4', 'a4', 'a5'].includes(o.kind) ? o.kind : 'a6x4';
    const format = o.format === 'png' ? 'png' : 'pdf';
    const c = await content(code, o);
    const L = layout(kind);
    const last = { kind, format, url: c.url, qr: [], unit: format === 'pdf' ? 'pt' : 'px' };
    if (format === 'png') {
      const k = 2.5; // px per point: 180 dpi
      const cv = canvasOf(L.W * k, L.H * k), g = cv.getContext('2d');
      last.w = cv.width; last.h = cv.height;
      for (const card of L.cards) {
        const cw = Math.round(card.w * k), ch = Math.round(card.h * k), tmp = canvasOf(cw, ch), tg = tmp.getContext('2d');
        const qr = drawCard(tg, cw, ch, c);
        const at = drawQrPx(tg, c.q, qr.x, qr.y, qr.size);
        g.drawImage(tmp, Math.round(card.x * k), Math.round(card.y * k));
        tmp.width = tmp.height = 0;
        last.qr.push({ x: at.x + Math.round(card.x * k), y: at.y + Math.round(card.y * k), size: at.size, quiet: at.quiet, n: at.n, cell: at.cell });
      }
      if (L.cut) { g.fillStyle = 'rgba(150,150,170,.9)'; g.fillRect(Math.round(L.W * k / 2), 0, 1, cv.height); g.fillRect(0, Math.round(L.H * k / 2), cv.width, 1); }
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      cv.width = cv.height = 0;
      if (!blob) throw err('DENIED', 'This browser could not make the picture.');
      ESPrint.last = last;
      return blob;
    }
    if (!window.EM || !EM.pdf) throw err('DENIED', 'event-pdf.js is not loaded');
    const doc = EM.pdf.doc({ size: L.size, title: c.title });
    last.w = doc.w; last.h = doc.h;
    const k = kind === 'a6x4' ? 3.2 : 2.6; // canvas px per point for the art and text
    doc.page();
    for (const card of L.cards) {
      const cw = Math.round(card.w * k), ch = Math.round(card.h * k), tmp = canvasOf(cw, ch), tg = tmp.getContext('2d');
      const qr = drawCard(tg, cw, ch, c);
      doc.canvasImage(tmp, card.x, card.y, card.w, card.h, { quality: 0.86 });
      tmp.width = tmp.height = 0;
      const q = { x: card.x + qr.x / k, y: card.y + qr.y / k, size: qr.size / k, quiet: 4, n: c.q.size };
      doc.qr(c.q, q.x, q.y, q.size, { quiet: 4, dark: '#000000', light: '#ffffff' });
      last.qr.push(q);
    }
    if (L.cut) { doc.rect(L.W / 2 - 0.3, 0, 0.6, L.H, [150, 150, 170]); doc.rect(0, L.H / 2 - 0.3, L.W, 0.6, [150, 150, 170]); }
    const blob = doc.finish();
    ESPrint.last = last;
    return blob;
  }

  window.ESPrint = { make, dict, last: null, layout };
})();
