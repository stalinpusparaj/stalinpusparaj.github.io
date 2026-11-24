/* Event Sky PDF files: EM.pdf (event-pdf.js). Spec §3.3 (WP-B); used by the photo book (ESExport.book: cover, up to 300
 * photos, 1 or 4 a page, names and captions) and the printables (ESPrint: table cards and posters with a vector QR).
 *
 *  EM.pdf.doc({size:'A4'|'A5'|'A6', landscape?, title?}) → doc
 *    doc.w, doc.h            page size in points (1/72 inch); every coordinate below is in points from the TOP-LEFT corner
 *    doc.page()              starts a new page (the first drawing call starts one by itself)
 *    doc.jpeg(bytes, x, y, w, h, {fit:'fill'|'contain'|'cover'}?)  embeds the JPEG as it is (/DCTDecode, no re-encode);
 *                            the same bytes used twice are stored once. Baseline and progressive JPEGs; grey, RGB or CMYK.
 *    doc.canvasImage(canvas, x, y, w, h, {quality=0.92}?)   a canvas (or OffscreenCanvas) as a JPEG (no transparency)
 *    doc.text(str, x, y, w, h, {size=12, color='#000', bg='#fff', align, valign, weight, font, lineHeight=1.3, maxLines, scale=3})
 *                            text drawn by the browser on a canvas (so every script shapes correctly: Devanagari, Tamil…)
 *                            and embedded as a JPEG on its background colour. Returns {lines}.
 *    doc.rect(x, y, w, h, rgb)                 a filled rectangle; rgb is '#rrggbb' or [r, g, b] (0–255)
 *    doc.qr(modules, x, y, size, {quiet=4, dark, light}?)  a vector QR: one rectangle per run of dark modules, on a light
 *                            square with a quiet zone of `quiet` modules. modules is ES.QR.encode(text) or its .modules.
 *    doc.finish() → Blob('application/pdf')   PDF 1.4 with a correct cross-reference table
 *    doc.pages               pages so far
 *  EM.pdf.jpegInfo(bytes) → {w, h, comps, bits, progressive}|null
 *
 * Memory: each object is turned into bytes as soon as it is complete; image bytes are referenced, not copied, until the
 * final Blob is made. 300 display photos (about 85 KB each) make a PDF of about 26 MB.
 */
(function () {
  'use strict';
  const EM = window.EM = window.EM || {};
  const err = (code, message) => {
    if (typeof EM.err === 'function') return EM.err(code, 0, message);
    const e = new Error(message || code); e.name = 'ESError'; e.code = code; e.status = 0; return e;
  };
  function toU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    throw err('BAD_ARG', 'Expected JPEG bytes');
  }
  const SIZES = { A4: [595.28, 841.89], A5: [419.53, 595.28], A6: [297.64, 419.53] };

  function jpegInfo(b) {
    b = toU8(b);
    if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    let i = 2, adobe = false;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9 || m === 0xda) return null; // image data before any frame header
      const len = (b[i + 2] << 8) | b[i + 3];
      if (len < 2) return null;
      if (m === 0xee && len >= 7 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7], b[i + 8]) === 'Adobe') adobe = true;
      if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
        if (i + 10 > b.length) return null;
        const bits = b[i + 4], h = (b[i + 5] << 8) | b[i + 6], w = (b[i + 7] << 8) | b[i + 8], comps = b[i + 9];
        if (!w || !h || bits !== 8 || ![1, 3, 4].includes(comps)) return null;
        return { w, h, comps, bits, progressive: m === 0xc2, adobe };
      }
      if (m >= 0xc3 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return null; // lossless / arithmetic: PDF readers can't
      i += 2 + len;
    }
    return null;
  }
  const latin1 = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
  const num = (v) => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r); };
  function rgbOf(c) {
    if (Array.isArray(c)) return c.slice(0, 3).map((v) => Math.max(0, Math.min(255, +v || 0)));
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c || '#000000').trim());
    if (!m) return [0, 0, 0];
    const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
    return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  }
  const rgbOps = (c, op) => `${rgbOf(c).map((v) => num(v / 255)).join(' ')} ${op}`;
  function pdfText(s) {
    s = String(s == null ? '' : s);
    if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (x) => `\\${x}`)})`;
    let hex = 'FEFF';
    for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return `<${hex}>`;
  }
  function canvasJpeg(canvas, q) {
    let c = canvas;
    if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) {
      c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      c.getContext('2d').drawImage(canvas, 0, 0);
    }
    const url = c.toDataURL('image/jpeg', q > 0 && q <= 1 ? q : 0.92);
    if (c !== canvas) c.width = c.height = 0;
    if (!url.startsWith('data:image/jpeg')) throw err('UNSUPPORTED', 'This browser cannot make JPEG pictures.');
    const bin = atob(url.slice(url.indexOf(',') + 1)), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function doc(opts) {
    opts = opts || {};
    let [W, H] = SIZES[String(opts.size || 'A4').toUpperCase()] || SIZES.A4;
    if (opts.landscape) [W, H] = [H, W];
    const parts = [], offsets = [], pageIds = [], images = new Map();
    let offset = 0, nextId = 4, cur = null, done = false; // 1 catalog, 2 pages, 3 info
    const emit = (b) => { parts.push(b); offset += b.length; };
    const emitS = (s) => emit(latin1(s));
    emitS('%PDF-1.4\n%âãÏÓ\n');
    const obj = (id, body) => { offsets[id] = offset; emitS(`${id} 0 obj\n${body}\nendobj\n`); };
    const stream = (id, dict, bytes) => { offsets[id] = offset; emitS(`${id} 0 obj\n<< ${dict} /Length ${bytes.length} >>\nstream\n`); emit(bytes); emitS('\nendstream\nendobj\n'); };
    const live = () => { if (done) throw err('BAD_ARG', 'The PDF is finished'); };
    function closePage() {
      if (!cur) return;
      const cid = nextId++, pid = nextId++;
      stream(cid, '', latin1(cur.ops.join('\n')));
      const xo = [...cur.xobj].map(([n, id]) => `/${n} ${id} 0 R`).join(' ');
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(W)} ${num(H)}] /Resources << /ProcSet [/PDF /ImageB /ImageC] /XObject << ${xo} >> >> /Contents ${cid} 0 R >>`);
      pageIds.push(pid);
      cur = null;
    }
    function page() { live(); closePage(); cur = { ops: [], xobj: new Map() }; return api; }
    const ensure = () => { live(); if (!cur) page(); };
    function image(bytes) {
      let im = images.get(bytes);
      if (im) return im;
      const inf = jpegInfo(bytes);
      if (!inf) throw err('BAD_FILE', 'Not a JPEG this PDF can hold.');
      const id = nextId++, cs = inf.comps === 1 ? 'DeviceGray' : inf.comps === 4 ? 'DeviceCMYK' : 'DeviceRGB';
      stream(id, `/Type /XObject /Subtype /Image /Width ${inf.w} /Height ${inf.h} /ColorSpace /${cs} /BitsPerComponent 8 /Filter /DCTDecode${inf.comps === 4 && inf.adobe ? ' /Decode [1 0 1 0 1 0 1 0]' : ''}`, bytes);
      im = { id, name: `Im${id}`, w: inf.w, h: inf.h };
      images.set(bytes, im);
      return im;
    }
    function jpeg(bytes, x, y, w, h, o) {
      ensure();
      bytes = toU8(bytes);
      const im = image(bytes), fit = (o && o.fit) || 'fill';
      cur.xobj.set(im.name, im.id);
      let dx = x, dy = y, dw = w, dh = h, clip = false;
      if (fit === 'contain' || fit === 'cover') {
        const s = fit === 'contain' ? Math.min(w / im.w, h / im.h) : Math.max(w / im.w, h / im.h);
        dw = im.w * s; dh = im.h * s; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2; clip = fit === 'cover';
      }
      cur.ops.push(`q${clip ? ` ${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re W n` : ''} ${num(dw)} 0 0 ${num(dh)} ${num(dx)} ${num(H - dy - dh)} cm /${im.name} Do Q`);
      return api;
    }
    function canvasImage(canvas, x, y, w, h, o) {
      ensure();
      return jpeg(canvasJpeg(canvas, o && o.quality), x, y, w, h);
    }
    function rect(x, y, w, h, rgb) {
      ensure();
      cur.ops.push(`${rgbOps(rgb, 'rg')} ${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re f`);
      return api;
    }
    function qr(modules, x, y, size, o) {
      ensure();
      o = o || {};
      const m = modules && modules.modules ? modules.modules : modules;
      if (!Array.isArray(m) || !m.length || m.some((r) => !r || r.length !== m.length)) throw err('BAD_ARG', 'QR modules must be a square grid');
      const n = m.length, quiet = o.quiet >= 0 ? o.quiet : 4, cell = size / (n + 2 * quiet);
      const ops = [`${rgbOps(o.light || '#ffffff', 'rg')} ${num(x)} ${num(H - y - size)} ${num(size)} ${num(size)} re f`, rgbOps(o.dark || '#000000', 'rg')];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n;) {
          if (!m[r][c]) { c++; continue; }
          let e = c;
          while (e < n && m[r][e]) e++;
          const px = x + (quiet + c) * cell, py = y + (quiet + r) * cell, ph = cell + (r + 1 < n ? 0.02 : 0); // a hair of overlap: no seams
          ops.push(`${num(px)} ${num(H - py - ph)} ${num((e - c) * cell)} ${num(ph)} re`);
          c = e;
        }
      }
      ops.push('f');
      cur.ops.push(ops.join('\n'));
      return api;
    }
    function text(str, x, y, w, h, o) {
      ensure();
      o = o || {};
      const scale = o.scale > 0 ? o.scale : 3, size = (o.size > 0 ? o.size : 12) * scale, lh = size * (o.lineHeight > 0 ? o.lineHeight : 1.3);
      const cw = Math.max(1, Math.min(4096, Math.round(w * scale))), ch = Math.max(1, Math.min(4096, Math.round(h * scale)));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      g.fillStyle = o.bg || '#ffffff'; g.fillRect(0, 0, cw, ch);
      g.font = `${o.weight || 400} ${size}px ${o.font || '"Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", system-ui, sans-serif'}`;
      g.fillStyle = o.color || '#000000'; g.textBaseline = 'middle';
      const maxW = cw - 2, lines = [];
      for (const para of String(str == null ? '' : str).split(/\r?\n/)) {
        const words = para.split(/(\s+)/);
        let line = '';
        for (const wd of words) {
          const next = line + wd;
          if (line && g.measureText(next.trimEnd()).width > maxW) { lines.push(line.trimEnd()); line = wd.trimStart(); } else line = next;
          while (g.measureText(line).width > maxW && line.length > 1) { // one word wider than the box: break it
            let k = line.length - 1;
            while (k > 1 && g.measureText(line.slice(0, k)).width > maxW) k--;
            lines.push(line.slice(0, k)); line = line.slice(k);
          }
        }
        lines.push(line.trimEnd());
      }
      const max = Math.max(1, Math.min(o.maxLines > 0 ? o.maxLines : Infinity, Math.floor(ch / lh) || 1));
      if (lines.length > max) {
        lines.length = max;
        let last = lines[max - 1];
        while (last && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        lines[max - 1] = `${last}…`;
      }
      const align = o.align === 'center' || o.align === 'right' ? o.align : 'left';
      g.textAlign = align;
      const ax = align === 'center' ? cw / 2 : align === 'right' ? cw - 1 : 1;
      const block = lines.length * lh, top = o.valign === 'top' ? 0 : o.valign === 'bottom' ? ch - block : (ch - block) / 2;
      lines.forEach((ln, i) => g.fillText(ln, ax, top + lh * (i + 0.5)));
      const bytes = canvasJpeg(c, 0.9);
      c.width = c.height = 0;
      jpeg(bytes, x, y, w, h);
      return { lines: lines.length };
    }
    function finish() {
      live();
      if (!cur && !pageIds.length) page();
      closePage();
      done = true;
      obj(2, `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      const d = new Date(), pad = (v) => String(v).padStart(2, '0');
      const stamp = `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
      obj(3, `<< /Producer (Light Up the Skies) /Creator (Event Sky) /CreationDate (${stamp})${opts.title ? ` /Title ${pdfText(String(opts.title).slice(0, 200))}` : ''} >>`);
      const size = nextId, xref = offset;
      let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
      for (let i = 1; i < size; i++) {
        if (offsets[i] == null) throw err('BAD_ARG', `PDF object ${i} was never written`);
        table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
      }
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => v.toString(16).padStart(2, '0')).join('');
      emitS(`${table}trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF\n`);
      const blob = new Blob(parts, { type: 'application/pdf' });
      parts.length = 0; images.clear();
      return blob;
    }
    const api = {
      w: W, h: H,
      get pages() { return pageIds.length + (cur ? 1 : 0); },
      page, jpeg, canvasImage, text, rect, qr, finish,
    };
    return api;
  }

  EM.pdf = { doc, jpegInfo, SIZES };
})();
