/* Event Sky ZIP files: EM.zip (event-zip.js). Spec §3.3 (WP-B); used by the host's full download (ESExport.zip, parts of
 * 190 MB or less, "Part {0} of {1}") and the photographer page (photos arriving in a ZIP).
 *
 *  EM.zip.writer({maxPart = 190 MiB, onPart(blob, i), zip64}) → {add(name, bytes|Blob, date) → Promise, finish() → Promise<Blob[]>}
 *     STORE only (photos and videos are compressed already), CRC32 on every entry, UTF-8 names. Each part is a complete
 *     ZIP of its own, so every part opens by itself. Blob entries are not copied into memory: a part is a Blob made of the
 *     headers and the entries' own Blobs, and onPart(blob, i) hands it out as soon as it is closed, so it can be saved
 *     straight away. ZIP64 records are written when a part needs them (over 4 GiB or 65,535 entries); zip64:true forces
 *     them (tests). Names are cleaned (no "..", no absolute paths, no characters Windows refuses) and made unique.
 *  EM.zip.read(blob) → AsyncIterable<{name, bytes, date}>
 *     STORE and DEFLATE (DecompressionStream('deflate-raw'), or the small inflater below on older WebViews). Reads each
 *     entry from the Blob when it is reached, so memory holds one entry at a time. Skips folders, macOS extras
 *     (__MACOSX/, ._*, .DS_Store), encrypted entries, other methods, entries over 100 MB and entries whose CRC fails.
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
    if (typeof x === 'string') return new TextEncoder().encode(x);
    throw err('BAD_ARG', 'Expected bytes, a string or a Blob');
  }
  const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })();
  function crc32(b, prev) {
    let c = ~(prev >>> 0);
    for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return ~c >>> 0;
  }
  async function crcBlob(blob) {
    let c = 0;
    const STEP = 4 * 1024 * 1024;
    for (let o = 0; o < blob.size; o += STEP) c = crc32(new Uint8Array(await blob.slice(o, Math.min(blob.size, o + STEP)).arrayBuffer()), c);
    return c;
  }

  // ---------- writer ----------
  const MAX32 = 0xffffffff;
  function le(n) { return new DataView(new ArrayBuffer(n)); }
  function set64(dv, o, v) { dv.setUint32(o, v % 0x100000000, true); dv.setUint32(o + 4, Math.floor(v / 0x100000000), true); }
  function dosDateTime(d) {
    d = d instanceof Date ? d : new Date(typeof d === 'number' || typeof d === 'string' ? d : Date.now());
    if (isNaN(d)) d = new Date();
    let y = d.getFullYear();
    if (y < 1980) return { time: 0, date: (1 << 5) | 1 };
    if (y > 2107) y = 2107;
    return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  function cleanName(name) {
    const segs = String(name == null ? '' : name).normalize('NFC').replace(/\\/g, '/').split('/')
      .map((s) => s.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 120))
      .filter((s) => s && s !== '.' && s !== '..');
    return segs.join('/') || 'file';
  }
  function writer(opts) {
    opts = opts || {};
    const maxPart = opts.maxPart > 0 ? opts.maxPart : 190 * 2 ** 20;
    const onPart = typeof opts.onPart === 'function' ? opts.onPart : null;
    const force64 = !!opts.zip64;
    const enc = new TextEncoder();
    const parts = [], used = new Set();
    let cur = null, chain = Promise.resolve(), failure = null, finished = false;
    const newPart = () => ({ pieces: [], size: 0, entries: [], cd: 0 });
    cur = newPart();
    function unique(name) {
      let n = name;
      if (used.has(n.toLowerCase())) {
        const m = /^(.*?)(\.[^./]{1,8})?$/.exec(name);
        for (let i = 2; used.has(n.toLowerCase()); i++) n = `${m[1]} (${i})${m[2] || ''}`;
      }
      used.add(n.toLowerCase());
      return n;
    }
    function centralLen(e) { return 46 + e.name.length + (e.z64 ? 4 + 24 : 0); }
    function localHeader(e) {
      const big = e.z64, dv = le(30 + e.name.length + (big ? 20 : 0)), b = new Uint8Array(dv.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, big ? 45 : 20, true);
      dv.setUint16(6, 0x0800, true); // UTF-8 names
      dv.setUint16(8, 0, true); // STORE
      dv.setUint16(10, e.dos.time, true); dv.setUint16(12, e.dos.date, true);
      dv.setUint32(14, e.crc, true);
      dv.setUint32(18, big ? MAX32 : e.size, true); dv.setUint32(22, big ? MAX32 : e.size, true);
      dv.setUint16(26, e.name.length, true); dv.setUint16(28, big ? 20 : 0, true);
      b.set(e.name, 30);
      if (big) { const o = 30 + e.name.length; dv.setUint16(o, 1, true); dv.setUint16(o + 2, 16, true); set64(dv, o + 4, e.size); set64(dv, o + 12, e.size); }
      return b;
    }
    function centralHeader(e) {
      const sz = e.z64 || e.size >= MAX32, off = e.z64 || e.offset >= MAX32;
      const extra = (sz ? 16 : 0) + (off ? 8 : 0), dv = le(46 + e.name.length + (extra ? 4 + extra : 0)), b = new Uint8Array(dv.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, (3 << 8) | 45, true); // made by: Unix, 4.5
      dv.setUint16(6, sz || off ? 45 : 20, true);
      dv.setUint16(8, 0x0800, true); dv.setUint16(10, 0, true);
      dv.setUint16(12, e.dos.time, true); dv.setUint16(14, e.dos.date, true);
      dv.setUint32(16, e.crc, true);
      dv.setUint32(20, sz ? MAX32 : e.size, true); dv.setUint32(24, sz ? MAX32 : e.size, true);
      dv.setUint16(28, e.name.length, true); dv.setUint16(30, extra ? 4 + extra : 0, true); dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true); dv.setUint16(36, 0, true);
      dv.setUint32(38, 0x81a40000, true); // -rw-r--r--
      dv.setUint32(42, off ? MAX32 : e.offset, true);
      b.set(e.name, 46);
      if (extra) {
        let o = 46 + e.name.length;
        dv.setUint16(o, 1, true); dv.setUint16(o + 2, extra, true); o += 4;
        if (sz) { set64(dv, o, e.size); set64(dv, o + 8, e.size); o += 16; }
        if (off) set64(dv, o, e.offset);
      }
      return b;
    }
    function tail(p, cdOffset, cdSize) {
      const n = p.entries.length, z = force64 || n > 0xffff || cdOffset >= MAX32 || cdSize >= MAX32 || cdOffset + cdSize >= MAX32;
      const out = [];
      if (z) {
        const r = le(56);
        r.setUint32(0, 0x06064b50, true); set64(r, 4, 44); r.setUint16(12, (3 << 8) | 45, true); r.setUint16(14, 45, true);
        r.setUint32(16, 0, true); r.setUint32(20, 0, true); set64(r, 24, n); set64(r, 32, n); set64(r, 40, cdSize); set64(r, 48, cdOffset);
        const l = le(20);
        l.setUint32(0, 0x07064b50, true); l.setUint32(4, 0, true); set64(l, 8, cdOffset + cdSize); l.setUint32(16, 1, true);
        out.push(new Uint8Array(r.buffer), new Uint8Array(l.buffer));
      }
      const e = le(22);
      e.setUint32(0, 0x06054b50, true); e.setUint16(4, 0, true); e.setUint16(6, 0, true);
      e.setUint16(8, z ? 0xffff : n, true); e.setUint16(10, z ? 0xffff : n, true);
      e.setUint32(12, z ? MAX32 : cdSize, true); e.setUint32(16, z ? MAX32 : cdOffset, true); e.setUint16(20, 0, true);
      out.push(new Uint8Array(e.buffer));
      return out;
    }
    async function closePart(allowEmpty) {
      if (!cur.entries.length && !allowEmpty) return;
      const p = cur;
      cur = newPart();
      const cdOffset = p.size, cds = p.entries.map(centralHeader);
      let cdSize = 0;
      for (const c of cds) cdSize += c.length;
      const blob = new Blob(p.pieces.concat(cds, tail(p, cdOffset, cdSize)), { type: 'application/zip' });
      p.pieces.length = 0;
      parts.push(blob);
      if (onPart) await onPart(blob, parts.length - 1);
    }
    async function addNow(name, data, date) {
      const isBlob = data instanceof Blob, bytes = isBlob ? null : toU8(data == null ? new Uint8Array(0) : data);
      const size = isBlob ? data.size : bytes.length;
      const crc = isBlob ? await crcBlob(data) : crc32(bytes, 0);
      const e = { name: enc.encode(unique(cleanName(name))), size, crc, dos: dosDateTime(date), z64: force64 || size >= MAX32, offset: 0 };
      if (e.name.length > 0xffff) throw err('BAD_ARG', 'Name too long');
      const local = localHeader(e), need = local.length + size + centralLen(e) + 22 + 76;
      if (cur.entries.length && cur.size + cur.cd + need > maxPart) await closePart(false);
      e.offset = cur.size;
      cur.pieces.push(local, isBlob ? data : bytes);
      cur.size += local.length + size;
      cur.cd += centralLen(e) + 8; // (+8: the offset field may need ZIP64 room)
      cur.entries.push(e);
    }
    return {
      add(name, data, date) {
        if (finished) return Promise.reject(err('BAD_ARG', 'The ZIP is finished'));
        const p = chain.then(() => { if (failure) throw failure; return addNow(name, data, date); });
        chain = p.catch((e) => { failure = failure || e; });
        return p;
      },
      async finish() {
        if (finished) return parts.slice();
        finished = true;
        await chain;
        if (failure) throw failure;
        if (cur.entries.length || !parts.length) await closePart(true);
        return parts.slice();
      },
      get parts() { return parts.length; },
      get size() { return parts.reduce((a, b) => a + b.size, 0) + cur.size; },
    };
  }

  // ---------- inflate (RFC 1951) for WebViews without DecompressionStream('deflate-raw') ----------
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huff(lengths, n) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), symbol = new Uint16Array(n);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
    return { count, symbol };
  }
  let FIXED = null;
  function fixed() {
    if (!FIXED) {
      const l = new Uint8Array(288);
      for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
      FIXED = { lit: huff(l, 288), dist: huff(new Uint8Array(30).fill(5), 30) };
    }
    return FIXED;
  }
  function inflateRaw(src, expected) {
    const bad = () => err('BAD_FILE', 'Damaged compressed data');
    let pos = 0, buf = 0, cnt = 0, op = 0;
    let out = new Uint8Array(expected > 0 ? expected : Math.max(1024, src.length * 3));
    const bits = (n) => {
      while (cnt < n) { if (pos >= src.length) throw bad(); buf |= src[pos++] << cnt; cnt += 8; }
      const v = buf & ((1 << n) - 1);
      buf >>>= n; cnt -= n;
      return v;
    };
    const room = (n) => {
      if (op + n <= out.length) return;
      let size = out.length * 2;
      while (size < op + n) size *= 2;
      const next = new Uint8Array(size); next.set(out.subarray(0, op)); out = next;
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const c = h.count[len];
        if (code < first + c) return h.symbol[index + code - first];
        index += c; first = (first + c) << 1; code <<= 1;
      }
      throw bad();
    };
    let last = 0;
    while (!last) {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        buf = 0; cnt = 0; // to the byte boundary
        if (pos + 4 > src.length) throw bad();
        const len = src[pos] | (src[pos + 1] << 8), nlen = src[pos + 2] | (src[pos + 3] << 8);
        pos += 4;
        if ((len ^ 0xffff) !== nlen || pos + len > src.length) throw bad();
        room(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
        continue;
      }
      let lit, dist;
      if (type === 1) ({ lit, dist } = fixed());
      else if (type === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        if (nlen > 286 || ndist > 30) throw bad();
        const cl = new Uint8Array(19);
        for (let i = 0; i < ncode; i++) cl[ORDER[i]] = bits(3);
        const ch = huff(cl, 19), lens = new Uint8Array(nlen + ndist);
        for (let i = 0; i < nlen + ndist;) {
          const sym = decode(ch);
          if (sym < 16) { lens[i++] = sym; continue; }
          let rep = 0, val = 0;
          if (sym === 16) { if (!i) throw bad(); val = lens[i - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > nlen + ndist) throw bad();
          while (rep--) lens[i++] = val;
        }
        if (!lens[256]) throw bad();
        lit = huff(lens.subarray(0, nlen), nlen); dist = huff(lens.subarray(nlen), ndist);
      } else throw bad();
      for (;;) {
        const sym = decode(lit);
        if (sym < 256) { room(1); out[op++] = sym; continue; }
        if (sym === 256) break;
        const li = sym - 257;
        if (li >= 29) throw bad();
        const len = LBASE[li] + bits(LEXT[li]);
        const di = decode(dist);
        if (di >= 30) throw bad();
        const d = DBASE[di] + bits(DEXT[di]);
        if (d > op) throw bad();
        room(len);
        for (let k = 0; k < len; k++, op++) out[op] = out[op - d];
      }
    }
    return out.subarray(0, op);
  }
  let nativeRaw = null;
  function hasNativeRaw() {
    if (nativeRaw === null) { try { new DecompressionStream('deflate-raw'); nativeRaw = true; } catch (e) { nativeRaw = false; } }
    return nativeRaw;
  }
  async function inflate(blob, expected) {
    if (hasNativeRaw()) {
      try { return new Uint8Array(await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; }
    }
    try { return inflateRaw(new Uint8Array(await blob.arrayBuffer()), expected); } catch (e) { return null; }
  }

  // ---------- reader ----------
  const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  function decodeName(b, utf8Flag) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) {
      if (utf8Flag) return new TextDecoder('utf-8').decode(b);
      let s = '';
      for (const c of b) s += c < 128 ? String.fromCharCode(c) : CP437[c - 128];
      return s;
    }
  }
  const MAX_ENTRY = 100 * 1024 * 1024;
  async function slice(blob, a, b) { return new Uint8Array(await blob.slice(a, b).arrayBuffer()); }
  const get64 = (dv, o) => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 0x100000000;
  async function* read(input) {
    const blob = input instanceof Blob ? input : new Blob([toU8(input)]);
    const size = blob.size;
    if (size < 22) throw err('BAD_FILE', 'Not a ZIP file');
    const tailLen = Math.min(size, 65557 + 20), tailStart = size - tailLen, t = await slice(blob, tailStart, size);
    const tv = new DataView(t.buffer, t.byteOffset, t.byteLength);
    let eo = -1;
    for (let i = t.length - 22; i >= 0; i--) {
      if (tv.getUint32(i, true) === 0x06054b50) { if (i + 22 + tv.getUint16(i + 20, true) === t.length) { eo = i; break; } if (eo < 0) eo = i; }
    }
    if (eo < 0) throw err('BAD_FILE', 'Not a ZIP file');
    let count = tv.getUint16(eo + 10, true), cdSize = tv.getUint32(eo + 12, true), cdOff = tv.getUint32(eo + 16, true);
    let eocdAbs = tailStart + eo;
    if (eo >= 20 && tv.getUint32(eo - 20, true) === 0x07064b50) {
      const z = await slice(blob, get64(tv, eo - 20 + 8), get64(tv, eo - 20 + 8) + 56);
      const zv = new DataView(z.buffer, z.byteOffset, z.byteLength);
      if (z.length >= 56 && zv.getUint32(0, true) === 0x06064b50) {
        count = get64(zv, 32); cdSize = get64(zv, 40); cdOff = get64(zv, 48);
        eocdAbs = get64(tv, eo - 20 + 8);
      }
    }
    const delta = Math.max(0, eocdAbs - cdSize - cdOff); // data in front of the archive (self-extractors)
    if (cdSize > 64 * 1024 * 1024 || cdOff + delta + cdSize > size || count > 200000) throw err('BAD_FILE', 'This ZIP file is damaged');
    const cd = await slice(blob, cdOff + delta, cdOff + delta + cdSize), cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const entries = [];
    for (let p = 0, k = 0; k < count && p + 46 <= cd.length; k++) {
      if (cv.getUint32(p, true) !== 0x02014b50) break;
      const flags = cv.getUint16(p + 8, true), method = cv.getUint16(p + 10, true), time = cv.getUint16(p + 12, true), date = cv.getUint16(p + 14, true);
      const crc = cv.getUint32(p + 16, true);
      let csize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true), lho = cv.getUint32(p + 42, true);
      const nlen = cv.getUint16(p + 28, true), elen = cv.getUint16(p + 30, true), clen = cv.getUint16(p + 32, true);
      const name = decodeName(cd.subarray(p + 46, p + 46 + nlen), flags & 0x0800);
      for (let x = p + 46 + nlen, end = x + elen; x + 4 <= end && x + 4 <= cd.length;) {
        const id = cv.getUint16(x, true), sz = cv.getUint16(x + 2, true);
        if (id === 1) {
          let q = x + 4;
          if (usize === MAX32 && q + 8 <= x + 4 + sz) { usize = get64(cv, q); q += 8; }
          if (csize === MAX32 && q + 8 <= x + 4 + sz) { csize = get64(cv, q); q += 8; }
          if (lho === MAX32 && q + 8 <= x + 4 + sz) { lho = get64(cv, q); q += 8; }
        }
        x += 4 + sz;
      }
      entries.push({ name, flags, method, crc, csize, usize, lho, time, date });
      p += 46 + nlen + elen + clen;
    }
    for (const e of entries) {
      const base = e.name.split('/').pop();
      if (!base || e.name.endsWith('/') || /(^|\/)__MACOSX\//.test(e.name) || base.startsWith('._') || base === '.DS_Store') continue;
      if (e.flags & 1 || (e.method !== 0 && e.method !== 8) || e.usize > MAX_ENTRY) continue;
      const lh = await slice(blob, e.lho + delta, e.lho + delta + 30);
      if (lh.length < 30) continue;
      const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
      if (lv.getUint32(0, true) !== 0x04034b50) continue;
      const start = e.lho + delta + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
      if (start + e.csize > size) continue;
      const data = blob.slice(start, start + e.csize);
      const bytes = e.method === 0 ? new Uint8Array(await data.arrayBuffer()) : await inflate(data, e.usize);
      if (!bytes || bytes.length !== e.usize || crc32(bytes, 0) !== e.crc) continue; // damaged: leave it out
      const d = new Date(1980 + (e.date >> 9), ((e.date >> 5) & 15) - 1, e.date & 31, e.time >> 11, (e.time >> 5) & 63, (e.time & 31) * 2);
      yield { name: e.name, bytes, date: isNaN(d) ? null : d };
    }
  }

  EM.zip = { writer, read, cleanName, _inflate: inflateRaw };
})();
