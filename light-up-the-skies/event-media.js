/* Event Sky media: window.EM (event-media.js). Spec §3.3 (WP-B), with §1.2 sizes, §4.5 videos, §4.9 voice, §4.19
 * photographer credit, §4.23 brand mark and §4.24 flash safety.
 *
 * What this file does:
 *  - Pictures: EM.image.prepare re-encodes a picture from the phone into the sizes Firestore takes (selfie 360 px, at most
 *    60 KB; photo and photographer 1080 px, aiming at 85 KB, at most 120 KB; moderation thumbnail 240 px, at most 16 KB).
 *    The canvas re-encode drops EXIF and GPS, and every APPn/COM segment is stripped again after encoding. Transparency
 *    becomes black. The work runs in a Worker with OffscreenCanvas when it can (a blob: worker, allowed by
 *    `worker-src 'self' blob:`), otherwise on the main thread, yielding between steps.
 *  - Videos: EM.video.prepare makes a silent 15 s clip, 640×360 or 360×640: WebCodecs H.264 into EM.mp4.muxer when the
 *    browser has it, else canvas.captureStream + MediaRecorder (MP4 if supported, else WebM). It needs event-mp4.js.
 *    It also returns a poster (the frame at 1 s) and a flash score (64×36 luma at 10 fps; flashy above 3 flips a second).
 *  - Voice: EM.voice.record, Opus at 24 kbps (or AAC on iOS), 60 s and 200 KB at most.
 *  - Marks: EM.mark draws the game's brand mark (free plans) and the photographer credit "Photo: {name}" at 35%.
 *  - Crypto: AES-GCM pages ('ESP1') and face pages ('ESF1'); the gallery key wrapped with a password and link token.
 *  - Files: magic-byte sniffing, CRC32, CSV, .ics, saving and sharing.
 *
 * API (all async unless marked sync):
 *  EM.image.prepare(fileOrBlobOrBytes, {kind:'selfie'|'photo'|'pro', mark?:{plan:'free'|'paid', credit?}, worker?:false})
 *      → {display:Uint8Array, thumb:Uint8Array, w, h}
 *  EM.image.thumb(bytes, px=180, q=0.6, {max?}) → Uint8Array      (gallery/face thumbnails, about 5 KB at 180 px)
 *  EM.image.decode(bytes) → ImageBitmap;  EM.image.info(bytes) (sync) → {type, w, h, orientation};  EM.image.strip(jpeg) (sync)
 *  EM.video.probe(file) → {duration (s), w, h}
 *  EM.video.prepare(file, {startMs=0, maxMs=15000, onProgress(0..100), signal}) → {bytes, mime, w, h, du, poster, flashy, maxFlipsPerSec, path}
 *  EM.video.flashScore(videoElOrBlobOrBytes, {maxMs=60000}) → {maxFlipsPerSec, flashy}
 *  EM.voice.record({maxMs=60000, onLevel(0..1), stream?}) → {stop() → {bytes, mime, du}, cancel(), done, elapsed(), mime}
 *      (async: it resolves once the microphone is granted; done settles when recording ends for any reason, including
 *      maxMs or the 200 KB cap; stream: an audio MediaStream the caller already has, left running afterwards)
 *  EM.mark.draw(ctx, w, h, {kind:'brand'|'credit', credit?, corner:'bl'|'br', scale?, alpha?, bottom?}) (sync) → box
 *  EM.mark.apply(jpegBytes, {plan, credit?, quality=0.9}) → Uint8Array (unchanged bytes when there is nothing to draw)
 *  EM.mark.ready() → true once the icon and fonts are loaded (draw() before that uses fallback fonts and no icon)
 *  EM.crypto.key() (sync) / seal(key, bytes, aad?) / open(key, bytes, aad?)
 *  EM.crypto.wrap(key, password, linkToken, iterations=200000) → {s salt, i iv, c ciphertext, n iterations} (the rules' pub/g.wr)
 *  EM.crypto.unwrap(wr, password, linkToken) → key (32 bytes); passwords are case-insensitive, spaces tidied
 *  EM.b64u.enc / dec (sync);  EM.crc32(bytes, prev?) (sync);  EM.sniff(blobOrBytes) → mime|'' (EM.sniff.bytes is sync)
 *  EM.page.encode(items, key, {sealed?}) / decode(bytes, key);  EM.page.info(bytes) (sync)
 *  EM.faces.encode(reps, key) / decode(bytes, key)
 *  EM.csv(rows) (sync) → string;  EM.ics({title, at, url, description?, minutes=30}) (sync) → Blob
 *  EM.save(blob, name) → 'saved'|'shared'|'downloaded'|'cancelled';  EM.share({files?, text, title?, url?}) → 'shared'|'text'|'copied'|'cancelled'|'unsupported'
 *
 * Errors are ESError {code, status, message} (ES.err when event-sky.js is loaded). Codes used here: BAD_FILE (not a
 * picture/video, or it did not open), TOO_BIG, UNSUPPORTED (the browser lacks what is needed), NO_MIC, DENIED (wrong key,
 * wrong password, tampered page), CANCELLED, BAD_ARG. Messages are for logs; pages show their own copy per code.
 * Crypto and WebCodecs need a secure context (https, the app's own origin, or localhost).
 *
 * Load order on a page: event-media.js, then event-zip.js / event-pdf.js / event-mp4.js as needed (videos need event-mp4.js).
 */
/* STRINGS:
Get it on Google Play
Photo: {0}
*/
(function () {
  'use strict';
  const EM = window.EM = window.EM || {};
  const KB = 1024;
  const MAX_IMAGE_BYTES = 80 * 1024 * 1024; // a picture file larger than this is refused before decoding
  const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
  const VIDEO_CAP = 1000000; // media.d for a video (rules)
  const VOICE_CAP = 200 * KB; // book.v (rules)
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/avif'];
  const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/3gpp'];
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Where the bundled assets (icon, fonts) are: next to this script, whatever page loaded it.
  const BASE = (() => {
    try { if (document.currentScript && document.currentScript.src) return new URL('.', document.currentScript.src).href; } catch (e) { /* fall through */ }
    return new URL('.', location.href).href;
  })();

  // ---------- errors and small helpers ----------
  function err(code, status, message) {
    if (typeof status === 'string' && message === undefined) { message = status; status = 0; }
    if (window.ES && typeof window.ES.err === 'function') {
      try { const e = window.ES.err(code, status || 0, message || code); if (e && e.code === code) return e; } catch (e) { /* use our own */ }
    }
    const e = new Error(message || code);
    e.name = 'ESError'; e.code = code; e.status = status || 0;
    return e;
  }
  const tr = (s) => (window.LUTSLang && typeof window.LUTSLang.t === 'function' ? window.LUTSLang.t(s) : s);
  function toU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (Array.isArray(x)) return Uint8Array.from(x);
    throw err('BAD_ARG', 'Expected bytes');
  }
  async function asBytes(x) {
    if (x == null) return new Uint8Array(0);
    if (x instanceof Blob) return new Uint8Array(await x.arrayBuffer());
    return toU8(x);
  }
  function asBlob(x, type) {
    if (x instanceof Blob) return x;
    if (x instanceof ArrayBuffer || ArrayBuffer.isView(x)) return new Blob([x], type ? { type } : undefined);
    throw err('BAD_ARG', 'Expected a file, a Blob or bytes');
  }
  function concat(list) {
    let n = 0;
    for (const a of list) n += a.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of list) { out.set(a, o); o += a.length; }
    return out;
  }
  const utf8 = (s) => new TextEncoder().encode(String(s));
  const unutf8 = (b) => new TextDecoder().decode(b);
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const yieldNow = () => (window.scheduler && typeof window.scheduler.yield === 'function' ? window.scheduler.yield() : sleep(0));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- magic bytes ----------
  const ascii = (b, i, n) => { let s = ''; for (let k = 0; k < n && i + k < b.length; k++) s += String.fromCharCode(b[i + k]); return s; };
  function sniffBytes(b) {
    b = toU8(b);
    if (b.length < 4) return '';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'image/png';
    if (ascii(b, 0, 4) === 'GIF8') return 'image/gif';
    if (ascii(b, 0, 4) === 'RIFF') {
      const t = ascii(b, 8, 4);
      return t === 'WEBP' ? 'image/webp' : t === 'WAVE' ? 'audio/wav' : t === 'AVI ' ? 'video/x-msvideo' : '';
    }
    if (ascii(b, 0, 4) === '%PDF') return 'application/pdf';
    if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7) && (b[3] === 4 || b[3] === 6 || b[3] === 8)) return 'application/zip';
    if (ascii(b, 0, 4) === 'OggS') return 'audio/ogg';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ascii(b, 0, Math.min(b.length, 64)).includes('webm') ? 'video/webm' : 'video/x-matroska';
    if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
      const brand = ascii(b, 8, 4);
      if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'image/heic';
      if (/^(avif|avis)$/.test(brand)) return 'image/avif';
      if (brand === 'qt  ') return 'video/quicktime';
      if (/^M4[AB] $/.test(brand)) return 'audio/mp4';
      if (/^3g/.test(brand)) return 'video/3gpp';
      return 'video/mp4';
    }
    if (b.length >= 8 && /^(moov|mdat|wide|free|skip)$/.test(ascii(b, 4, 4))) return 'video/quicktime';
    if (b[0] === 0x42 && b[1] === 0x4d && b.length >= 26) return 'image/bmp';
    if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
    const t = ascii(b, 0, Math.min(b.length, 64)).replace(/^\uFEFF?\s*/, '').toLowerCase();
    if (t.startsWith('<svg') || t.startsWith('<?xml')) return 'image/svg+xml';
    return '';
  }
  async function sniff(x) {
    if (x instanceof Blob) return sniffBytes(new Uint8Array(await x.slice(0, 64).arrayBuffer()));
    return sniffBytes(toU8(x).subarray(0, 64));
  }
  sniff.bytes = sniffBytes;

  // ---------- CRC32 ----------
  const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })();
  function crc32(bytes, prev) {
    bytes = toU8(bytes);
    let c = ~(prev >>> 0);
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return ~c >>> 0;
  }

  // ---------- base64url ----------
  const b64u = {
    enc(bytes) {
      bytes = toU8(bytes);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      let s = String(str == null ? '' : str).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
      if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw err('BAD_ARG', 'Not base64url');
      while (s.length % 4) s += '=';
      const bin = atob(s), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    },
  };

  // ======================================================================================================================
  // Picture pipeline. CORE is self-contained (no outside names) because its source text also runs inside the Worker.
  // ======================================================================================================================
  function CORE() {
    'use strict';
    const KB = 1024;
    const LADDER = [0.78, 0.7, 0.62, 0.55, 0.48, 0.4];
    const LIMITS = {
      selfie: { long: 360, target: 38 * KB, cap: 60 * KB, q: LADDER },
      photo: { long: 1080, target: 85 * KB, cap: 120 * KB, q: LADDER },
      pro: { long: 1080, target: 85 * KB, cap: 120 * KB, q: LADDER },
      thumb: { long: 240, target: 8 * KB, cap: 16 * KB, q: [0.7, 0.62, 0.55, 0.48, 0.4] },
    };
    const BIG = 24e6; // pixels: above this, decode straight to a smaller size to save memory

    function fail(code, message) { const e = new Error(message || code); e.name = 'ESError'; e.code = code; e.status = 0; return e; }
    const u16 = (b, i) => (b[i] << 8) | b[i + 1];
    const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const str = (b, i, n) => { let s = ''; for (let k = 0; k < n && i + k < b.length; k++) s += String.fromCharCode(b[i + k]); return s; };

    function exifOrientation(b, s, end) {
      if (s + 8 > end) return 1;
      const le = b[s] === 0x49 && b[s + 1] === 0x49;
      if (!le && !(b[s] === 0x4d && b[s + 1] === 0x4d)) return 1;
      const g16 = (i) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
      const g32 = (i) => (le ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) : ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])) >>> 0;
      const ifd = s + g32(s + 4);
      if (ifd + 2 > end) return 1;
      const n = g16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > end) break;
        if (g16(e) === 0x0112) { const v = g16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
      }
      return 1;
    }
    function jpegInfo(b) {
      const r = { type: 'image/jpeg', w: 0, h: 0, comps: 0, bits: 8, sof: 0, adobe: false, orientation: 1 };
      let i = 2;
      while (i + 4 <= b.length) {
        if (b[i] !== 0xff) break;
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        if (m === 0xd9 || m === 0xda) break;
        const len = u16(b, i + 2);
        if (len < 2) break;
        const s = i + 4, end = Math.min(b.length, i + 2 + len);
        if (m === 0xe1 && r.orientation === 1 && str(b, s, 6) === 'Exif\0\0') r.orientation = exifOrientation(b, s + 6, end);
        else if (m === 0xee && str(b, s, 5) === 'Adobe') r.adobe = true;
        else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && s + 6 <= b.length) {
          r.sof = m; r.bits = b[s]; r.h = u16(b, s + 1); r.w = u16(b, s + 3); r.comps = b[s + 5];
          break;
        }
        i += 2 + len;
      }
      return r;
    }
    function info(b) {
      const none = { type: '', w: 0, h: 0, orientation: 1 };
      if (!b || b.length < 12) return none;
      if (b[0] === 0xff && b[1] === 0xd8) return jpegInfo(b);
      if (b[0] === 0x89 && str(b, 1, 3) === 'PNG' && b.length >= 24) return { type: 'image/png', w: u32(b, 16), h: u32(b, 20), orientation: 1 };
      if (str(b, 0, 4) === 'RIFF' && str(b, 8, 4) === 'WEBP' && b.length >= 30) {
        const c = str(b, 12, 4);
        if (c === 'VP8 ') return { type: 'image/webp', w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff, orientation: 1 };
        if (c === 'VP8L') { const v = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0; return { type: 'image/webp', w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1, orientation: 1 }; }
        if (c === 'VP8X') return { type: 'image/webp', w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), orientation: 1 };
        return { type: 'image/webp', w: 0, h: 0, orientation: 1 };
      }
      if (str(b, 0, 4) === 'GIF8') return { type: 'image/gif', w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8), orientation: 1 };
      if (b[0] === 0x42 && b[1] === 0x4d && b.length >= 26) {
        const w = b[18] | (b[19] << 8) | (b[20] << 16) | (b[21] << 24), h = b[22] | (b[23] << 8) | (b[24] << 16) | (b[25] << 24);
        return { type: 'image/bmp', w: Math.abs(w), h: Math.abs(h), orientation: 1 };
      }
      if (str(b, 4, 4) === 'ftyp') {
        const br = str(b, 8, 4);
        if (/^(avif|avis)$/.test(br)) return { type: 'image/avif', w: 0, h: 0, orientation: 1 };
        if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(br)) return { type: 'image/heic', w: 0, h: 0, orientation: 1 };
      }
      return none;
    }
    // Removes APP1–APP15 (EXIF, XMP, ICC, maker notes) and comments from a JPEG; everything else is kept byte for byte.
    function strip(b) {
      if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return b;
      const keep = [b.subarray(0, 2)];
      let i = 2, changed = false, ok = false;
      while (i + 2 <= b.length) {
        if (b[i] !== 0xff) return b;
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xda || m === 0xd9) { keep.push(b.subarray(i)); ok = true; break; }
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { keep.push(b.subarray(i, i + 2)); i += 2; continue; }
        if (i + 4 > b.length) return b;
        const len = u16(b, i + 2);
        if (len < 2 || i + 2 + len > b.length) return b;
        if ((m >= 0xe1 && m <= 0xef) || m === 0xfe) changed = true;
        else keep.push(b.subarray(i, i + 2 + len));
        i += 2 + len;
      }
      if (!ok || !changed) return b;
      let n = 0;
      for (const k of keep) n += k.length;
      const out = new Uint8Array(n);
      let o = 0;
      for (const k of keep) { out.set(k, o); o += k.length; }
      return out;
    }
    function fit(w, h, long) {
      const s = Math.min(1, long / Math.max(w, h));
      return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
    }
    async function decodeBitmap(blob, inf, maxLong) {
      const base = { imageOrientation: 'from-image' };
      const wrap = (bmp) => ({ el: bmp, width: bmp.width, height: bmp.height, close: () => { try { bmp.close(); } catch (e) { /* closed */ } } });
      if (inf && inf.w && inf.h && inf.w * inf.h > BIG && maxLong) {
        const swap = inf.orientation >= 5;
        const ow = swap ? inf.h : inf.w, oh = swap ? inf.w : inf.h;
        const t = Math.min(1, (maxLong * 2) / Math.max(ow, oh));
        const rw = Math.max(1, Math.round(ow * t)), rh = Math.max(1, Math.round(oh * t));
        for (const [a, c] of [[rw, rh], [rh, rw]]) {
          try {
            const bmp = await createImageBitmap(blob, Object.assign({ resizeWidth: a, resizeHeight: c, resizeQuality: 'high' }, base));
            if (bmp.width === rw && bmp.height === rh) return wrap(bmp);
            bmp.close();
          } catch (e) { break; }
        }
      }
      return wrap(await createImageBitmap(blob, base));
    }
    function release(c) { if (c && typeof c.width === 'number') { try { c.width = 0; c.height = 0; } catch (e) { /* ignore */ } } }
    function drawScaled(env, el, sw, sh, dw, dh) {
      let cur = el, cw = sw, ch = sh, tmp = null;
      while (cw / 2 >= dw && ch / 2 >= dh && cw > 2 && ch > 2) {
        const nw = Math.round(cw / 2), nh = Math.round(ch / 2), c = env.canvas(nw, nh), g = c.getContext('2d');
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
        release(tmp); tmp = c; cur = c; cw = nw; ch = nh;
      }
      const out = env.canvas(dw, dh), g = out.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, dw, dh); // transparency becomes black
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, cw, ch, 0, 0, dw, dh);
      release(tmp);
      return out;
    }
    function drawSprite(g, w, h, sp) {
      const s = Math.max(w, h) / sp.ref, bw = sp.bmp.width * s, bh = sp.bmp.height * s;
      const x = sp.corner === 'bl' ? sp.left * s : w - sp.right * s - bw, y = h - sp.bottom * s - bh;
      g.drawImage(sp.bmp, x, y, bw, bh);
    }
    // Quality ladder towards the target; the last rung is accepted up to the cap; above the cap, scale ×0.85 and repeat.
    async function encodeLoop(env, src, lim, sprite) {
      const sw = src.width, sh = src.height;
      let long = Math.min(lim.long, Math.max(sw, sh));
      for (let round = 0; round < 12; round++) {
        const d = fit(sw, sh, long);
        const base = drawScaled(env, src.el, sw, sh, d.w, d.h);
        let target = base;
        if (sprite) {
          target = env.canvas(d.w, d.h);
          const g = target.getContext('2d');
          g.drawImage(base, 0, 0);
          drawSprite(g, d.w, d.h, sprite);
        }
        let out = null;
        for (let k = 0; k < lim.q.length; k++) {
          out = strip(await env.jpeg(target, lim.q[k]));
          if (out.length <= lim.target) break;
          if (out.length > lim.target * 1.8 && k + 2 < lim.q.length) k++; // far over: skip a rung
          await env.tick();
        }
        if (target !== base) release(target);
        if (out && out.length <= lim.cap) return { bytes: out, w: d.w, h: d.h, base };
        release(base);
        long = Math.floor(long * 0.85);
        if (long < 32) break;
        await env.tick();
      }
      throw fail('TOO_BIG', 'This picture could not be made small enough.');
    }
    async function prepare(blob, kind, sprite, env) {
      const lim = LIMITS[kind] || LIMITS.photo;
      const head = new Uint8Array(await blob.slice(0, 1 << 19).arrayBuffer());
      let src;
      try { src = await env.decode(blob, info(head), lim.long); } catch (e) { throw fail('DECODE', 'This picture did not open.'); }
      let disp = null;
      try {
        if (!src.width || !src.height) throw fail('DECODE', 'This picture is empty.');
        disp = await encodeLoop(env, src, lim, sprite);
      } finally { src.close(); }
      try {
        await env.tick();
        const th = await encodeLoop(env, { el: disp.base, width: disp.w, height: disp.h }, LIMITS.thumb, null);
        release(th.base);
        return { display: disp.bytes, thumb: th.bytes, w: disp.w, h: disp.h };
      } finally { release(disp.base); }
    }
    function ladder(q) {
      const out = [];
      for (let v = q; v >= 0.299 && out.length < 5; v = Math.round((v - 0.08) * 100) / 100) out.push(v);
      return out.length ? out : [0.5];
    }
    async function thumb(blob, px, q, max, env) {
      const head = new Uint8Array(await blob.slice(0, 1 << 19).arrayBuffer());
      let src;
      try { src = await env.decode(blob, info(head), px); } catch (e) { throw fail('DECODE', 'This picture did not open.'); }
      try {
        if (!src.width || !src.height) throw fail('DECODE', 'This picture is empty.');
        const target = max > 0 ? max : Math.round(px * px * 0.17);
        const r = await encodeLoop(env, src, { long: px, target, cap: Math.round(target * 1.5), q: ladder(q) }, null);
        release(r.base);
        return r.bytes;
      } finally { src.close(); }
    }
    return { LIMITS, info, strip, fit, decodeBitmap, encodeLoop, prepare, thumb, release, drawSprite };
  }

  // The worker half: OffscreenCanvas for drawing, convertToBlob for JPEG.
  function WORKER_MAIN(C) {
    const env = {
      canvas: (w, h) => new OffscreenCanvas(Math.max(1, w), Math.max(1, h)),
      jpeg: async (c, q) => new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: q })).arrayBuffer()),
      decode: (blob, inf, long) => C.decodeBitmap(blob, inf, long),
      tick: () => Promise.resolve(),
    };
    self.onmessage = async (e) => {
      const m = e.data || {};
      try {
        let result = null, transfer = [];
        if (m.op === 'ping') {
          const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(2, 2) : null;
          result = !!(c && c.getContext('2d') && typeof c.convertToBlob === 'function' && typeof createImageBitmap === 'function');
        } else if (m.op === 'prepare') {
          result = await C.prepare(m.blob, m.kind, m.sprite, env);
          transfer = [result.display.buffer, result.thumb.buffer];
        } else if (m.op === 'thumb') {
          result = await C.thumb(m.blob, m.px, m.q, m.max, env);
          transfer = [result.buffer];
        }
        self.postMessage({ id: m.id, ok: true, result }, transfer.filter((b, i, a) => a.indexOf(b) === i));
      } catch (error) {
        self.postMessage({ id: m.id, ok: false, code: (error && error.code) || 'DECODE', message: String((error && error.message) || error) });
      } finally {
        if (m.sprite && m.sprite.bmp && m.sprite.bmp.close) m.sprite.bmp.close();
      }
    };
  }

  const C = CORE();
  let offscreenOk = null;
  function hasOffscreen() {
    if (offscreenOk === null) {
      try { const c = new OffscreenCanvas(2, 2); offscreenOk = !!(c.getContext('2d') && typeof c.convertToBlob === 'function'); } catch (e) { offscreenOk = false; }
    }
    return offscreenOk;
  }
  function htmlCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  async function decodeViaImg(blob) {
    const url = URL.createObjectURL(blob), img = new Image();
    img.decoding = 'async';
    img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw err('DECODE', 'This picture did not open.'); }
    if (!img.naturalWidth) { URL.revokeObjectURL(url); throw err('DECODE', 'This picture is empty.'); }
    return { el: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }
  const mainEnv = {
    canvas: (w, h) => (hasOffscreen() ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : htmlCanvas(w, h)),
    jpeg: async (c, q) => {
      const blob = typeof c.convertToBlob === 'function' ? await c.convertToBlob({ type: 'image/jpeg', quality: q })
        : await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(err('UNSUPPORTED', 'This browser cannot make JPEG pictures.'))), 'image/jpeg', q));
      const out = new Uint8Array(await blob.arrayBuffer());
      if (out[0] !== 0xff || out[1] !== 0xd8) throw err('UNSUPPORTED', 'This browser cannot make JPEG pictures.');
      return out;
    },
    decode: async (blob, inf, long) => {
      try { return await C.decodeBitmap(blob, inf, long); } catch (e) { return decodeViaImg(blob); }
    },
    tick: yieldNow, // keeps each main-thread step short (one draw or one encode)
  };

  // ---------- worker pool ----------
  let pool = null, poolBroken = false, seq = 0;
  function workerSource() {
    return `'use strict';\nconst C = (${CORE.toString()})();\n(${WORKER_MAIN.toString()})(C);\n`;
  }
  function stopPool(reason) {
    if (!pool) return;
    const p = pool;
    pool = null;
    clearTimeout(p.idle);
    p.workers.forEach((w) => { try { w.worker.terminate(); } catch (e) { /* gone */ } });
    p.pending.forEach((r) => r.reject(err('NO_WORKER', reason || 'worker stopped')));
    p.pending.clear();
    try { URL.revokeObjectURL(p.url); } catch (e) { /* ignore */ }
  }
  function startPool() {
    if (poolBroken || typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') return null;
    if (pool) return pool;
    try {
      const url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
      const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
      const p = { url, workers: [], pending: new Map(), idle: 0, ready: null };
      for (let i = 0; i < n; i++) {
        const worker = new Worker(url);
        const w = { worker, busy: 0 };
        worker.onmessage = (e) => {
          const m = e.data || {}, r = p.pending.get(m.id);
          if (!r) return;
          p.pending.delete(m.id); w.busy--; clearTimeout(r.timer);
          if (m.ok) r.resolve(m.result); else r.reject(err(m.code || 'DECODE', m.message));
          armIdle(p);
        };
        worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); poolBroken = true; stopPool('worker failed'); };
        p.workers.push(w);
      }
      pool = p;
      p.ready = send(p, { op: 'ping' }, [], 8000).then((ok) => { if (!ok) throw err('NO_WORKER', 'no OffscreenCanvas in workers'); return true; })
        .catch((e) => { poolBroken = true; stopPool('worker unavailable'); throw err('NO_WORKER', e.message); });
      return p;
    } catch (e) {
      poolBroken = true;
      return null;
    }
  }
  function armIdle(p) {
    clearTimeout(p.idle);
    if (!p.pending.size) p.idle = setTimeout(() => { if (pool === p && !p.pending.size) stopPool('idle'); }, 20000);
  }
  function send(p, msg, transfer, timeout) {
    return new Promise((resolve, reject) => {
      const w = p.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
      const id = ++seq;
      const timer = setTimeout(() => { if (p.pending.has(id)) { p.pending.delete(id); poolBroken = true; stopPool('timeout'); reject(err('NO_WORKER', 'worker timed out')); } }, timeout || 90000);
      p.pending.set(id, { resolve, reject, timer });
      w.busy++;
      clearTimeout(p.idle);
      try { w.worker.postMessage(Object.assign({ id }, msg), transfer || []); } catch (e) { p.pending.delete(id); w.busy--; clearTimeout(timer); reject(err('NO_WORKER', e.message)); }
    });
  }
  async function viaWorker(msg, transfer) {
    const p = startPool();
    if (!p) throw err('NO_WORKER', 'no worker');
    await p.ready;
    return send(p, msg, transfer);
  }

  // ---------- marks (§4.23, §4.19) ----------
  let assetsP = null;
  function withTimeout(p, ms) { return Promise.race([p, sleep(ms).then(() => { throw new Error('timeout'); })]); }
  function markAssets() {
    if (!assetsP) {
      assetsP = (async () => {
        const out = { icon: null };
        try {
          if (typeof FontFace === 'function' && document.fonts) {
            const faces = [new FontFace('EM Cinzel', `url(${BASE}assets/fonts/cinzel-latin.woff2)`, { weight: '400 900' }),
              new FontFace('EM Outfit', `url(${BASE}assets/fonts/outfit-latin.woff2)`, { weight: '100 900' })];
            await withTimeout(Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)))), 4000);
          }
        } catch (e) { /* the fallback fonts draw it */ }
        try {
          const img = new Image();
          img.src = `${BASE}assets/icons/icon-192.png`;
          await withTimeout(img.decode(), 4000);
          out.icon = img;
        } catch (e) { /* no icon: the box still carries the name */ }
        return out;
      })();
    }
    return assetsP;
  }
  const CINZEL = '"EM Cinzel", Cinzel, Georgia, serif';
  const OUTFIT = '"EM Outfit", Outfit, system-ui, sans-serif';
  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function cleanCredit(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function creditText(name) { const t = tr('Photo: {0}'); return (t.includes('{0}') ? t : 'Photo: {0}').replace('{0}', name); }
  // The game's drawBrandMark (game.js), at scale k, with its top-left at (x, y). Returns the box size.
  function brandBox(g, k) {
    const get = tr('Get it on Google Play');
    g.save();
    g.font = `700 ${13 * k}px ${CINZEL}`; let tw = g.measureText('Light Up the Skies').width;
    g.font = `600 ${9.5 * k}px ${OUTFIT}`; tw = Math.max(tw, g.measureText('✦ by Gem Creators ✦').width);
    g.font = `500 ${10.5 * k}px ${OUTFIT}`; tw = Math.max(tw, g.measureText(get).width);
    g.restore();
    return { w: 6 * k + 34 * k + 8 * k + tw + 12 * k, h: 52 * k, get };
  }
  function drawBrandAt(g, x, y, k, icon) {
    const b = brandBox(g, k);
    g.save();
    g.fillStyle = 'rgba(8,6,20,.55)'; g.strokeStyle = 'rgba(255,210,122,.35)'; g.lineWidth = k;
    roundRect(g, x, y, b.w, b.h, 14 * k); g.fill(); g.stroke();
    if (icon) { try { g.drawImage(icon, x + 6 * k, y + 9 * k, 34 * k, 34 * k); } catch (e) { /* not drawable */ } }
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const tx = x + 48 * k;
    g.fillStyle = '#ffd77e'; g.font = `700 ${13 * k}px ${CINZEL}`; g.fillText('Light Up the Skies', tx, y + 18 * k);
    g.fillStyle = '#ffb6d9'; g.font = `600 ${9.5 * k}px ${OUTFIT}`; g.fillText('✦ by Gem Creators ✦', tx, y + 31 * k);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `500 ${10.5 * k}px ${OUTFIT}`; g.fillText(b.get, tx, y + 44 * k);
    g.restore();
    return b;
  }
  function creditBox(g, k, name) {
    const text = creditText(name), size = 16 * k;
    g.save(); g.font = `600 ${size}px ${OUTFIT}`; const tw = g.measureText(text).width; g.restore();
    return { w: tw + 8 * k, h: size * 1.45, text, size };
  }
  function drawCreditAt(g, x, y, k, b) {
    g.save();
    g.font = `600 ${b.size}px ${OUTFIT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.lineJoin = 'round'; g.lineWidth = Math.max(1, 3 * k); g.strokeStyle = 'rgba(0,0,0,.85)';
    g.strokeText(b.text, x + 4 * k, y + b.h / 2);
    g.fillStyle = '#ffffff'; g.fillText(b.text, x + 4 * k, y + b.h / 2);
    g.restore();
  }
  let iconCache = null;
  markAssets().then((a) => { iconCache = a.icon; }).catch(() => { /* none */ });
  // EM.mark.draw: one mark at a corner. alpha < 1 draws it on its own layer first, so overlaps stay at that alpha.
  function markDraw(g, w, h, o) {
    o = o || {};
    const kind = o.kind === 'credit' ? 'credit' : 'brand';
    const k = o.scale > 0 ? o.scale : Math.max(0.6, Math.max(w, h) / 720);
    const corner = o.corner === 'br' || o.corner === 'bl' ? o.corner : (kind === 'credit' ? 'br' : 'bl');
    const alpha = o.alpha >= 0 && o.alpha <= 1 ? o.alpha : (kind === 'credit' ? 0.35 : 1); // the credit is always faint (§4.19)
    const pad = 14 * k, bottom = o.bottom > 0 ? o.bottom : 0;
    const name = kind === 'credit' ? cleanCredit(o.credit) : '';
    if (kind === 'credit' && !name) return null;
    const box = kind === 'brand' ? brandBox(g, k) : creditBox(g, k, name);
    const x = corner === 'br' ? w - pad - box.w : pad, y = h - pad - bottom - box.h;
    const icon = o.icon || iconCache;
    if (alpha >= 1) {
      if (kind === 'brand') drawBrandAt(g, x, y, k, icon); else drawCreditAt(g, x, y, k, box);
    } else {
      const m = Math.ceil(2 * k) + 2, lw = Math.ceil(box.w) + 2 * m, lh = Math.ceil(box.h) + 2 * m;
      const layer = htmlCanvas(lw, lh), lg = layer.getContext('2d');
      if (kind === 'brand') drawBrandAt(lg, m, m, k, icon); else drawCreditAt(lg, m, m, k, box);
      g.save(); g.globalAlpha = alpha; g.drawImage(layer, x - m, y - m); g.restore();
      layer.width = layer.height = 0;
    }
    return { x, y, w: box.w, h: box.h, corner };
  }
  function needsMark(m) { return !!m && (m.plan === 'free' || !!cleanCredit(m.credit)); }
  // The marks for a plan: free with no credit → the brand mark, bottom left (as the game's photos); a photographer's
  // credit → "Photo: {name}" at 35% bottom right, and on a free plan the brand mark at 35% under it (§4.19). Paid, no credit → none.
  function drawMarks(g, w, h, m) {
    if (!needsMark(m)) return null;
    const free = m.plan === 'free', name = cleanCredit(m.credit), k = Math.max(0.6, Math.max(w, h) / 720);
    if (free && !name) return markDraw(g, w, h, { kind: 'brand', corner: 'bl', scale: k });
    let box = null, bottom = 0;
    if (free) { box = markDraw(g, w, h, { kind: 'brand', corner: 'br', alpha: 0.35, scale: k }); bottom = box.h + 6 * k; }
    const c = markDraw(g, w, h, { kind: 'credit', credit: name, corner: 'br', alpha: 0.35, scale: k, bottom });
    if (!box) return c;
    const x0 = Math.min(box.x, c.x), y0 = Math.min(box.y, c.y), x1 = Math.max(box.x + box.w, c.x + c.w), y1 = Math.max(box.y + box.h, c.y + c.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, corner: 'br' };
  }
  // The marks drawn once at a reference size and cut out, so the Worker can paste them (it has no fonts of its own).
  async function markSprite(m, ref) {
    if (!needsMark(m)) return null;
    const a = await markAssets();
    const c = htmlCanvas(ref, ref), g = c.getContext('2d');
    const box = drawMarks(g, ref, ref, Object.assign({}, m, { icon: a.icon }));
    if (!box) { c.width = 0; return null; }
    const x0 = Math.max(0, Math.floor(box.x) - 2), y0 = Math.max(0, Math.floor(box.y) - 2);
    const x1 = Math.min(ref, Math.ceil(box.x + box.w) + 2), y1 = Math.min(ref, Math.ceil(box.y + box.h) + 2);
    const bmp = await createImageBitmap(c, x0, y0, x1 - x0, y1 - y0);
    c.width = 0;
    return { bmp, ref, corner: box.corner, left: x0, right: ref - x1, bottom: ref - y1 };
  }
  async function markApply(bytes, o) {
    o = o || {};
    bytes = await asBytes(bytes);
    if (!needsMark(o)) return bytes; // paid without a credit: unchanged
    const a = await markAssets();
    const blob = new Blob([bytes]);
    if (!IMAGE_TYPES.includes(sniffBytes(bytes.subarray(0, 64)))) throw err('BAD_FILE', 'Not a picture.');
    let src;
    try { src = await mainEnv.decode(blob, C.info(bytes), 0); } catch (e) { throw err('BAD_FILE', 'This picture did not open.'); }
    try {
      const c = htmlCanvas(src.width, src.height), g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src.el, 0, 0, c.width, c.height);
      drawMarks(g, c.width, c.height, Object.assign({}, o, { icon: a.icon }));
      const out = C.strip(await mainEnv.jpeg(c, o.quality > 0 && o.quality <= 1 ? o.quality : 0.9));
      c.width = c.height = 0;
      return out;
    } finally { src.close(); }
  }

  // ---------- EM.image ----------
  async function imagePrepare(input, opts) {
    opts = opts || {};
    const kind = C.LIMITS[opts.kind] && opts.kind !== 'thumb' ? opts.kind : 'photo';
    const blob = asBlob(input);
    if (!blob.size) throw err('BAD_FILE', 'This picture is empty.');
    if (blob.size > MAX_IMAGE_BYTES) throw err('TOO_BIG', 'This picture is too large.');
    const type = sniffBytes(new Uint8Array(await blob.slice(0, 64).arrayBuffer()));
    if (!IMAGE_TYPES.includes(type)) throw err('BAD_FILE', 'This is not a picture.');
    const ref = C.LIMITS[kind].long;
    if (opts.worker !== false) {
      const sprite = opts.mark ? await markSprite(opts.mark, ref) : null;
      try {
        const r = await viaWorker({ op: 'prepare', blob, kind, sprite }, sprite ? [sprite.bmp] : []);
        imagePrepare.last = 'worker';
        return r;
      } catch (e) {
        if (sprite && sprite.bmp && sprite.bmp.close) { try { sprite.bmp.close(); } catch (x) { /* transferred */ } }
        if (e.code !== 'NO_WORKER' && e.code !== 'DECODE') throw e; // TOO_BIG is final; a decode miss gets a second try below
      }
    }
    const sprite = opts.mark ? await markSprite(opts.mark, ref) : null;
    try {
      const r = await C.prepare(blob, kind, sprite, mainEnv);
      imagePrepare.last = 'main';
      return r;
    } catch (e) {
      if (e.code === 'DECODE') throw err('BAD_FILE', 'This picture did not open.');
      throw e.code ? err(e.code, e.message) : e;
    } finally { if (sprite && sprite.bmp && sprite.bmp.close) sprite.bmp.close(); }
  }
  async function imageThumb(input, px, q, opts) {
    px = px > 0 ? Math.round(px) : 180;
    q = q > 0 && q <= 1 ? q : 0.6;
    opts = opts || {};
    const blob = asBlob(input, 'image/jpeg');
    if (!IMAGE_TYPES.includes(sniffBytes(new Uint8Array(await blob.slice(0, 64).arrayBuffer())))) throw err('BAD_FILE', 'This is not a picture.');
    if (opts.worker !== false) {
      try { return await viaWorker({ op: 'thumb', blob, px, q, max: opts.max || 0 }); } catch (e) { if (e.code !== 'NO_WORKER' && e.code !== 'DECODE') throw e; }
    }
    try { return await C.thumb(blob, px, q, opts.max || 0, mainEnv); } catch (e) {
      if (e.code === 'DECODE') throw err('BAD_FILE', 'This picture did not open.');
      throw e.code ? err(e.code, e.message) : e;
    }
  }
  async function imageDecode(input) {
    const blob = asBlob(input);
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* try an <img> */ }
    const d = await decodeViaImg(blob).catch(() => { throw err('BAD_FILE', 'This picture did not open.'); });
    try { return await createImageBitmap(d.el); } catch (e) { throw err('BAD_FILE', 'This picture did not open.'); } finally { d.close(); }
  }

  // ---------- video helpers ----------
  function once(target, names, ms) {
    return new Promise((resolve, reject) => {
      const list = [].concat(names);
      let t = 0;
      const done = (ok, v) => { clearTimeout(t); list.forEach((n) => target.removeEventListener(n, on)); target.removeEventListener('error', onErr); ok ? resolve(v) : reject(v); };
      const on = (e) => done(true, e);
      const onErr = () => done(false, err('BAD_FILE', 'This video did not open.'));
      list.forEach((n) => target.addEventListener(n, on));
      target.addEventListener('error', onErr);
      if (ms) t = setTimeout(() => done(false, err('BAD_FILE', 'This video did not open.')), ms);
    });
  }
  async function openVideo(src) {
    const own = src instanceof Blob;
    const url = own ? URL.createObjectURL(src) : String(src);
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    (document.body || document.documentElement).appendChild(v);
    const close = () => {
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
      v.remove();
      if (own) URL.revokeObjectURL(url);
    };
    try {
      const meta = once(v, 'loadedmetadata', 20000);
      v.src = url;
      await meta;
      if (!isFinite(v.duration)) { // MediaRecorder WebM has no duration until the end is read
        const p = once(v, ['durationchange', 'timeupdate'], 8000).catch(() => null);
        v.currentTime = 1e101;
        await p;
        for (let i = 0; i < 20 && !isFinite(v.duration); i++) await sleep(50);
        const back = once(v, 'seeked', 8000).catch(() => null);
        v.currentTime = 0;
        await back;
      }
      if (!v.videoWidth || !v.videoHeight || !(v.duration > 0) || !isFinite(v.duration)) throw err('BAD_FILE', 'This video did not open.');
      if (v.readyState < 2) await once(v, ['loadeddata', 'canplay'], 15000);
      return { v, close };
    } catch (e) { close(); throw e.code ? e : err('BAD_FILE', 'This video did not open.'); }
  }
  function seek(v, sec) {
    if (Math.abs(v.currentTime - sec) < 0.005 && v.readyState >= 2) return Promise.resolve();
    const p = once(v, 'seeked', 10000).catch(() => null);
    v.currentTime = sec;
    return p;
  }
  // Plays the video (muted) and calls draw() on every new frame, then frame(t, i) for every output time t = i/fps that the
  // playback has passed. Dropped frames repeat the last picture, so the output timeline is always exact.
  function pump(v, o) {
    return new Promise((resolve, reject) => {
      const step = 1000 / o.fps, total = Math.max(1, Math.round(o.durMs / step));
      let i = 0, done = false, busy = false, endedFlag = false, drawn = false, gen = 0;
      let lastMedia = -Infinity, lastAdvance = performance.now(), lastCb = performance.now();
      let rafMode = typeof v.requestVideoFrameCallback !== 'function';
      const onEnded = () => { endedFlag = true; if (!busy) tick(v.currentTime); };
      const onError = () => finish(err('BAD_FILE', 'This video did not open.'));
      const onVis = () => { if (!document.hidden && !done && v.paused) v.play().catch(() => { /* retried by the watchdog */ }); };
      const onAbort = () => finish(err('CANCELLED', 'Cancelled'));
      const watch = setInterval(() => {
        if (done) return;
        const now = performance.now();
        if (document.hidden) { lastAdvance = now; lastCb = now; return; }
        if (!rafMode && !v.paused && now - lastCb > 1200) { rafMode = true; schedule(); }
        if (now - lastAdvance > 4000 && v.paused && !v.ended) v.play().catch(() => { /* try again */ });
        if (now - lastAdvance > 15000) finish(err('BAD_FILE', 'This video stopped playing.'));
      }, 500);
      function finish(e) {
        if (done) return;
        done = true; gen++;
        clearInterval(watch);
        v.removeEventListener('ended', onEnded); v.removeEventListener('error', onError);
        document.removeEventListener('visibilitychange', onVis);
        if (o.signal) o.signal.removeEventListener('abort', onAbort);
        try { v.pause(); } catch (x) { /* ignore */ }
        if (e) reject(e); else resolve(i);
      }
      async function tick(mediaSec) {
        if (done || busy) return;
        busy = true;
        try {
          for (;;) {
            const ended = endedFlag || v.ended;
            const ms = mediaSec * 1000;
            if (ms > lastMedia + 0.5) { lastMedia = ms; lastAdvance = performance.now(); o.draw(); drawn = true; }
            else if (!drawn) { o.draw(); drawn = true; }
            const m = ended ? Infinity : ms - o.startMs;
            while (i < total && i * step <= m + 1) {
              await o.frame(i * step, i);
              i++;
              if (done) return;
            }
            if (i >= total) { finish(); return; }
            if (!(endedFlag && !ended)) break; // the 'ended' event came in while we were busy: go round once more
          }
        } catch (e) { finish(e); return; } finally { busy = false; }
        schedule();
      }
      function schedule() {
        if (done) return;
        const my = ++gen;
        if (!rafMode) v.requestVideoFrameCallback((now, meta) => { if (my !== gen) return; lastCb = performance.now(); tick(meta && meta.mediaTime != null ? meta.mediaTime : v.currentTime); });
        else requestAnimationFrame(() => { if (my === gen) tick(v.currentTime); });
      }
      v.addEventListener('ended', onEnded);
      v.addEventListener('error', onError);
      document.addEventListener('visibilitychange', onVis);
      if (o.signal) { if (o.signal.aborted) { onAbort(); return; } o.signal.addEventListener('abort', onAbort); }
      v.playbackRate = o.rate || 1;
      schedule();
      v.play().catch((e) => { if (!document.hidden) finish(err('UNSUPPORTED', `This video could not play here (${e && e.name}).`)); });
    });
  }
  // Flash meter (§4.24): 64×36 luma; a flip is a change of more than 20% in luma over at least a quarter of the frame,
  // all in one direction; flashy above 3 flips in any rolling second.
  function flashMeter(landscape) {
    const W = landscape ? 64 : 36, H = landscape ? 36 : 64, N = W * H;
    const c = htmlCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
    let prev = null;
    const flips = [];
    return {
      draw(src) { g.drawImage(src, 0, 0, W, H); },
      sample(t) {
        const d = g.getImageData(0, 0, W, H).data, y = new Float32Array(N);
        for (let i = 0; i < N; i++) y[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
        if (prev) {
          let up = 0, down = 0;
          for (let i = 0; i < N; i++) { const dy = y[i] - prev[i]; if (dy > 0.2) up++; else if (dy < -0.2) down++; }
          if (Math.max(up, down) >= N * 0.25) flips.push(t);
        }
        prev = y;
      },
      result() {
        let max = 0;
        for (let i = 0, j = 0; i < flips.length; i++) { while (flips[i] - flips[j] >= 1000) j++; max = Math.max(max, i - j + 1); }
        return { maxFlipsPerSec: max, flashy: max > 3 };
      },
      close() { c.width = c.height = 0; },
    };
  }
  async function encodeThumbFrom(canvas) {
    const r = await C.encodeLoop(mainEnv, { el: canvas, width: canvas.width, height: canvas.height }, C.LIMITS.thumb, null);
    C.release(r.base);
    return r.bytes;
  }
  async function transcode(v, c) {
    const fps = 24, W = c.W, H = c.H;
    const work = htmlCanvas(W, H), g = work.getContext('2d', { alpha: false });
    const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(W / vw, H / vh), dw = vw * s, dh = vh * s, dx = (W - dw) / 2, dy = (H - dh) / 2;
    const meter = flashMeter(W >= H), posterAt = Math.min(1000, c.du / 2);
    let poster = null, nextFlash = 0, enc = null, rec = null;
    const total = Math.max(1, Math.round(c.du * fps / 1000));
    if (c.path === 'webcodecs') enc = await EM.mp4.encoder({ w: W, h: H, fps, bitrate: c.bitrate, keyEvery: fps * 2 });
    try {
      await seek(v, c.start / 1000);
      if (c.path !== 'webcodecs') rec = EM.mp4.recorder(work, { fps, bitrate: c.bitrate });
      await pump(v, {
        startMs: c.start, durMs: c.du, fps, rate: enc ? (vh > 1100 && vw > 1100 ? 1 : 2) : 1, signal: c.signal,
        draw() { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.drawImage(v, dx, dy, dw, dh); },
        async frame(t, i) {
          if (!poster && t >= posterAt) { poster = htmlCanvas(W, H); poster.getContext('2d').drawImage(work, 0, 0); }
          if (t >= nextFlash) { meter.draw(work); meter.sample(t); nextFlash += 100; }
          if (enc) await enc.frame(work, Math.round(i * 1e6 / fps));
          else rec.frame();
          if (c.onProgress && i % 6 === 0) c.onProgress(i / total);
        },
      });
      let bytes, mime;
      if (enc) { bytes = await enc.finish(); mime = 'video/mp4'; enc = null; }
      else { const r = await rec.stop(); rec = null; bytes = new Uint8Array(await r.blob.arrayBuffer()); mime = r.mime; }
      if (!poster) { poster = htmlCanvas(W, H); poster.getContext('2d').drawImage(work, 0, 0); }
      const posterBytes = await encodeThumbFrom(poster);
      const fl = meter.result();
      return { bytes, mime, w: W, h: H, du: Math.round(total * 1000 / fps), poster: posterBytes, flashy: fl.flashy, maxFlipsPerSec: fl.maxFlipsPerSec };
    } finally {
      if (enc) enc.close();
      if (rec) rec.cancel();
      meter.close();
      if (poster) poster.width = poster.height = 0;
      work.width = work.height = 0;
    }
  }
  async function videoPrepare(file, opts) {
    opts = opts || {};
    const maxMs = clamp(opts.maxMs > 0 ? opts.maxMs : 15000, 300, 15000);
    const blob = asBlob(file);
    if (!blob.size) throw err('BAD_FILE', 'This video is empty.');
    if (blob.size > MAX_VIDEO_BYTES) throw err('TOO_BIG', 'This video is too large.');
    if (!VIDEO_TYPES.includes(sniffBytes(new Uint8Array(await blob.slice(0, 64).arrayBuffer())))) throw err('BAD_FILE', 'This is not a video.');
    if (!EM.mp4 || typeof EM.mp4.recorder !== 'function') throw err('UNSUPPORTED', 'event-mp4.js is not loaded.');
    const progress = (base, span) => (f) => { if (typeof opts.onProgress === 'function') { try { opts.onProgress(Math.min(99, Math.round(base + span * f))); } catch (e) { /* caller's */ } } };
    const vid = await openVideo(blob);
    try {
      const total = vid.v.duration * 1000;
      const start = clamp(+opts.startMs || 0, 0, Math.max(0, total - 300));
      const du = Math.floor(Math.min(maxMs, total - start));
      if (!(du >= 300)) throw err('BAD_FILE', 'This video is too short.');
      const land = vid.v.videoWidth >= vid.v.videoHeight;
      const W = land ? 640 : 360, H = land ? 360 : 640;
      let path = opts._path === 'recorder' || opts._path === 'webcodecs' ? opts._path
        : (typeof EM.mp4.encoderConfig === 'function' && await EM.mp4.encoderConfig({ w: W, h: H, fps: 24, bitrate: 400000 }) ? 'webcodecs' : 'recorder');
      if (path === 'recorder' && !EM.mp4.recorderMime()) {
        if (typeof MediaRecorder !== 'function') throw err('UNSUPPORTED', 'This browser cannot make videos.');
      }
      const run = (bitrate, prog) => transcode(vid.v, { W, H, start, du, path, bitrate, onProgress: prog, signal: opts.signal });
      let out;
      try { out = await run(400000, progress(0, 90)); } catch (e) {
        if (path !== 'webcodecs' || ['BAD_FILE', 'CANCELLED'].includes(e.code) || opts._path) throw e;
        path = 'recorder'; // the encoder failed on this device: record in real time instead
        out = await run(400000, progress(0, 90));
      }
      if (out.bytes.length > VIDEO_CAP) out = await run(300000, progress(50, 49));
      if (out.bytes.length > VIDEO_CAP) throw err('TOO_BIG', 'This video could not be made small enough.');
      if (typeof opts.onProgress === 'function') { try { opts.onProgress(100); } catch (e) { /* caller's */ } }
      out.path = path;
      return out;
    } finally { vid.close(); }
  }
  async function videoProbe(file) {
    const vid = await openVideo(file instanceof Blob ? file : asBlob(file));
    try { return { duration: vid.v.duration, w: vid.v.videoWidth, h: vid.v.videoHeight }; } finally { vid.close(); }
  }
  async function flashScore(input, opts) {
    opts = opts || {};
    let src = input;
    if (typeof HTMLVideoElement !== 'undefined' && input instanceof HTMLVideoElement) {
      if (input.srcObject || !(input.currentSrc || input.src)) throw err('UNSUPPORTED', 'Only file videos can be checked.');
      src = input.currentSrc || input.src;
    } else if (!(input instanceof Blob)) src = asBlob(input);
    const vid = await openVideo(src);
    try {
      const v = vid.v, meter = flashMeter(v.videoWidth >= v.videoHeight);
      try {
        await seek(v, 0);
        await pump(v, { startMs: 0, durMs: Math.min(v.duration * 1000, opts.maxMs > 0 ? opts.maxMs : 60000), fps: 10, rate: 2, signal: opts.signal,
          draw() { meter.draw(v); }, frame(t) { meter.sample(t); } });
        return meter.result();
      } finally { meter.close(); }
    } finally { vid.close(); }
  }

  // ---------- voice (§4.9) ----------
  const VOICE_MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];
  function voiceMime() {
    if (typeof MediaRecorder !== 'function') return '';
    for (const m of VOICE_MIMES) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* next */ } }
    return '';
  }
  async function voiceRecord(opts) {
    opts = opts || {};
    const maxMs = clamp(opts.maxMs > 0 ? opts.maxMs : 60000, 1000, 60000);
    const maxBytes = clamp(opts.maxBytes > 0 ? opts.maxBytes : VOICE_CAP, 8 * KB, VOICE_CAP);
    if (typeof MediaRecorder !== 'function') throw err('UNSUPPORTED', 'This browser cannot record sound.');
    // opts.stream: an audio stream the caller already has (it stays the caller's: its tracks are not stopped here)
    const given = typeof MediaStream === 'function' && opts.stream instanceof MediaStream ? opts.stream : null;
    let stream;
    if (given) {
      if (!given.getAudioTracks().length) throw err('BAD_ARG', 'The stream has no sound.');
      stream = new MediaStream(given.getAudioTracks());
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw err('UNSUPPORTED', 'This browser cannot record sound.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
      } catch (e) {
        throw err(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'NO_MIC' : 'UNSUPPORTED', 'Allow the microphone to record a voice message.');
      }
    }
    const stopTracks = () => { if (!given) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* stopped */ } }); };
    const pick = voiceMime();
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 24000 }, pick ? { mimeType: pick } : {})); } catch (e) {
      try { rec = new MediaRecorder(stream); } catch (x) { stopTracks(); throw err('UNSUPPORTED', 'This browser cannot record sound.'); }
    }
    const chunks = [];
    let size = 0, lastChunk = 0, t0 = 0, t1 = 0, state = 'recording', levelTimer = 0, maxTimer = 0, ac = null;
    let resolveDone, rejectDone;
    const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
    done.catch(() => { /* handled by whoever awaits stop() */ });
    const cleanup = () => {
      clearInterval(levelTimer); clearTimeout(maxTimer); stopTracks();
      if (ac) { try { ac.close(); } catch (e) { /* closed */ } ac = null; }
    };
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      chunks.push(e.data); size += e.data.size; lastChunk = e.data.size;
      if (state === 'recording' && size + lastChunk * 2 + 2 * KB > maxBytes) end(); // the next second would not fit
    };
    rec.onstop = async () => {
      t1 = t1 || performance.now();
      cleanup();
      if (state === 'cancelled') { rejectDone(err('CANCELLED', 'Cancelled')); return; }
      state = 'stopped';
      try {
        const mime = baseMime(rec.mimeType || pick) || 'audio/webm';
        const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
        if (!bytes.length) throw err('NO_MIC', 'Nothing was recorded. Try again.');
        if (bytes.length > maxBytes) throw err('TOO_BIG', 'This voice message is too long.');
        resolveDone({ bytes, mime, du: Math.round(t1 - t0) });
      } catch (e) { rejectDone(e); }
    };
    rec.onerror = () => { if (state === 'recording') { state = 'cancelled'; cleanup(); rejectDone(err('NO_MIC', 'The recording stopped.')); } };
    function end() { if (state !== 'recording') return; state = 'stopping'; t1 = performance.now(); try { rec.stop(); } catch (e) { cleanup(); rejectDone(err('NO_MIC', 'The recording stopped.')); } }
    if (typeof opts.onLevel === 'function') {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ac = new AC();
        const an = ac.createAnalyser();
        an.fftSize = 512;
        ac.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        levelTimer = setInterval(() => {
          if (an.getFloatTimeDomainData) an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          try { opts.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3)); } catch (e) { /* caller's */ }
        }, 66);
        if (ac.state === 'suspended') ac.resume().catch(() => { /* no meter */ });
      } catch (e) { ac = null; }
    }
    t0 = performance.now();
    try { rec.start(1000); } catch (e) { cleanup(); throw err('UNSUPPORTED', 'This browser cannot record sound.'); }
    maxTimer = setTimeout(end, maxMs);
    return {
      mime: baseMime(rec.mimeType || pick),
      done,
      elapsed: () => Math.round((t1 || performance.now()) - t0),
      stop() { end(); return done; },
      cancel() { if (state === 'stopped' || state === 'cancelled') return; const was = state; state = 'cancelled'; if (was === 'recording') { try { rec.stop(); } catch (e) { cleanup(); rejectDone(err('CANCELLED', 'Cancelled')); } } },
    };
  }

  // ---------- crypto (§0.4, §2.1 pages/faces, §4.15 password) ----------
  const subtle = () => {
    if (!window.crypto || !window.crypto.subtle) throw err('UNSUPPORTED', 'This page needs a secure (https) connection.');
    return window.crypto.subtle;
  };
  const keyCache = new Map();
  function keyBytes(k) {
    const b = typeof k === 'string' ? b64u.dec(k) : toU8(k);
    if (b.length !== 32) throw err('DENIED', 'Wrong key.');
    return b;
  }
  async function aesKey(k) {
    const raw = keyBytes(k), id = b64u.enc(raw);
    let p = keyCache.get(id);
    if (!p) {
      p = subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      keyCache.set(id, p);
      if (keyCache.size > 16) keyCache.delete(keyCache.keys().next().value);
    }
    return p;
  }
  async function seal(key, bytes, aad) {
    const k = await aesKey(key), iv = rand(12);
    const params = { name: 'AES-GCM', iv };
    if (aad) params.additionalData = toU8(aad);
    const ct = new Uint8Array(await subtle().encrypt(params, k, await asBytes(bytes)));
    return concat([iv, ct]);
  }
  async function open(key, bytes, aad) {
    const b = await asBytes(bytes);
    if (b.length < 28) throw err('DENIED', 'This can not be opened with this key.');
    const k = await aesKey(key);
    const params = { name: 'AES-GCM', iv: b.subarray(0, 12) };
    if (aad) params.additionalData = toU8(aad);
    try { return new Uint8Array(await subtle().decrypt(params, k, b.subarray(12))); } catch (e) { throw err('DENIED', 'This can not be opened with this key.'); }
  }
  // Passwords are compared case-insensitively with spaces tidied, because phone keyboards capitalise the first letter.
  const normPassword = (p) => String(p == null ? '' : p).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  async function kek(password, linkToken, salt, iterations) {
    const base = await subtle().importKey('raw', utf8(`${normPassword(password)}\u001f${String(linkToken == null ? '' : linkToken)}`), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function wrap(key, password, linkToken, iterations) {
    iterations = Math.round(iterations > 0 ? iterations : 200000);
    if (iterations < 10000 || iterations > 5000000) throw err('BAD_ARG', 'Iterations out of range.');
    if (!normPassword(password)) throw err('BAD_ARG', 'A password is needed.');
    const raw = keyBytes(key), salt = rand(16), iv = rand(12);
    const c = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await kek(password, linkToken, salt, iterations), raw));
    // Field names as the rules store them in pub/g.wr: s salt, i iv, c ciphertext (base64url strings), n iterations (int).
    return { s: b64u.enc(salt), i: b64u.enc(iv), c: b64u.enc(c), n: iterations };
  }
  async function unwrap(wr, password, linkToken) {
    if (!wr || typeof wr !== 'object') throw err('DENIED', 'Wrong password.');
    // Accepts the rules' order {i: iv, n: iterations} and the swapped one {i: iterations, n: iv}.
    const swapped = typeof wr.i === 'number' || (/^\d+$/.test(String(wr.i)) && !/^\d+$/.test(String(wr.n)));
    const i = Math.round(+(swapped ? wr.i : wr.n)), ivText = swapped ? wr.n : wr.i;
    if (!(i >= 10000 && i <= 5000000)) throw err('DENIED', 'Wrong password.');
    let salt, iv, c;
    try { salt = b64u.dec(wr.s); iv = b64u.dec(ivText); c = b64u.dec(wr.c); } catch (e) { throw err('DENIED', 'Wrong password.'); }
    if (salt.length < 8 || iv.length !== 12 || c.length !== 48) throw err('DENIED', 'Wrong password.');
    try {
      const raw = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, await kek(password, linkToken, salt, i), c));
      if (raw.length !== 32) throw new Error('length');
      return raw;
    } catch (e) { throw err('DENIED', 'Wrong password.'); }
  }

  // ---------- packed encrypted pages: 'ESP1' (gallery thumbnails) and 'ESF1' (face crops) ----------
  // Layout: magic(4) | flags(1) | iv(12) | AES-GCM( u32 headerLen | header JSON | blobs… ), with magic+flags as the
  // additional data, so a changed flag is caught too. flags bit 0 = sealed page (100 items, no more appends).
  const jpegOrWebp = (b) => { const t = sniffBytes(b.subarray(0, 16)); return t === 'image/webp' || t === 'image/png' ? t : 'image/jpeg'; };
  async function packEncode(magic, head, blobs, key, flags) {
    const hj = utf8(JSON.stringify(head)), len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, hj.length);
    const prefix = concat([utf8(magic), Uint8Array.of(flags & 0xff)]);
    return concat([prefix, await seal(key, concat([len, hj].concat(blobs)), prefix)]);
  }
  async function packDecode(magic, bytes, key) {
    const b = await asBytes(bytes);
    if (b.length < 5 + 28 || ascii(b, 0, 4) !== magic) throw err('DENIED', 'This page is not readable.');
    const prefix = b.subarray(0, 5), plain = await open(key, b.subarray(5), prefix);
    if (plain.length < 4) throw err('DENIED', 'This page is not readable.');
    const hl = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
    if (4 + hl > plain.length) throw err('DENIED', 'This page is not readable.');
    let head;
    try { head = JSON.parse(unutf8(plain.subarray(4, 4 + hl))); } catch (e) { throw err('DENIED', 'This page is not readable.'); }
    return { head, data: plain.subarray(4 + hl), flags: b[4] };
  }
  function cleanItem(it) {
    const out = {};
    for (const k of Object.keys(it || {})) { if (k !== 'thumb' && k !== 'crop' && it[k] !== undefined && typeof it[k] !== 'function') out[k] = it[k]; }
    return out;
  }
  const page = {
    async encode(items, key, opts) {
      if (!Array.isArray(items)) throw err('BAD_ARG', 'items must be an array');
      const head = { v: 1, items: [], tl: [] }, blobs = [];
      for (const it of items) {
        const t = await asBytes(it && it.thumb);
        head.items.push(cleanItem(it)); head.tl.push(t.length); blobs.push(t);
      }
      return packEncode('ESP1', head, blobs, key, opts && opts.sealed ? 1 : 0);
    },
    async decode(bytes, key) {
      const { head, data, flags } = await packDecode('ESP1', bytes, key);
      if (!head || head.v !== 1 || !Array.isArray(head.items) || !Array.isArray(head.tl) || head.items.length !== head.tl.length) throw err('DENIED', 'This page is not readable.');
      let o = 0;
      const out = head.items.map((it, i) => {
        const n = head.tl[i] >>> 0;
        if (o + n > data.length) throw err('DENIED', 'This page is not readable.');
        const t = data.slice(o, o + n);
        o += n;
        return Object.assign({}, it, { thumb: n ? new Blob([t], { type: jpegOrWebp(t) }) : null });
      });
      Object.defineProperty(out, 'sealed', { value: !!(flags & 1), enumerable: false });
      return out;
    },
    info(bytes) {
      const b = toU8(bytes);
      return b.length >= 5 && ascii(b, 0, 4) === 'ESP1' ? { v: 1, sealed: !!(b[4] & 1) } : null;
    },
  };
  const faces = {
    async encode(reps, key) {
      if (!Array.isArray(reps)) throw err('BAD_ARG', 'reps must be an array');
      const head = { v: 1, reps: [], tl: [] }, blobs = [];
      for (const r of reps) {
        const t = await asBytes(r && r.crop);
        const gis = Array.isArray(r && r.gis) ? r.gis.map((x) => Math.round(+x)).filter((x) => x >= 0) : [];
        head.reps.push(Object.assign(cleanItem(r), { c: r && r.c != null ? r.c : 0, gis })); head.tl.push(t.length); blobs.push(t);
      }
      return packEncode('ESF1', head, blobs, key, 0);
    },
    async decode(bytes, key) {
      const { head, data } = await packDecode('ESF1', bytes, key);
      if (!head || head.v !== 1 || !Array.isArray(head.reps) || !Array.isArray(head.tl) || head.reps.length !== head.tl.length) throw err('DENIED', 'This page is not readable.');
      let o = 0;
      return head.reps.map((r, i) => {
        const n = head.tl[i] >>> 0;
        if (o + n > data.length) throw err('DENIED', 'This page is not readable.');
        const t = data.slice(o, o + n);
        o += n;
        return Object.assign({}, r, { gis: Array.isArray(r.gis) ? r.gis : [], crop: n ? new Blob([t], { type: jpegOrWebp(t) }) : null });
      });
    },
  };

  // ---------- CSV (RFC 4180, CRLF, UTF-8 BOM) ----------
  function csv(rows) {
    const cell = (v) => {
      if (v == null) return '';
      let s;
      if (v instanceof Date) s = isNaN(v) ? '' : v.toISOString();
      else if (typeof v === 'object') s = JSON.stringify(v);
      else s = String(v);
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet would run it as a formula
      return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return `\uFEFF${(rows || []).map((r) => (Array.isArray(r) ? r : [r]).map(cell).join(',')).join('\r\n')}\r\n`;
  }

  // ---------- .ics reminder (§4.16) ----------
  function icsEscape(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    const out = [];
    let cur = '', n = 0;
    for (const ch of line) {
      const b = utf8(ch).length;
      if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function ics(o) {
    o = o || {};
    const at = new Date(+o.at || Date.now());
    if (isNaN(at)) throw err('BAD_ARG', 'Bad time.');
    const end = new Date(at.getTime() + (o.minutes > 0 ? o.minutes : 30) * 60000);
    const title = String(o.title || '').slice(0, 200) || 'Light Up the Skies';
    const id = Array.from(rand(8), (x) => x.toString(16).padStart(2, '0')).join('');
    const desc = [o.description || title, o.url].filter(Boolean).join('\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Light Up the Skies//Event Sky//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:es-${id}@lightuptheskies`, `DTSTAMP:${icsUtc(new Date())}`, `DTSTART:${icsUtc(at)}`, `DTEND:${icsUtc(end)}`,
      `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`].concat(o.url ? [`URL:${String(o.url).replace(/[\r\n]/g, '')}`] : [])
      .concat(['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR']);
    return new Blob([`${lines.map(icsFold).join('\r\n')}\r\n`], { type: 'text/calendar' });
  }

  // ---------- saving and sharing ----------
  function safeFileName(name) {
    const s = String(name || 'light-up-the-skies').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 120);
    return s || 'light-up-the-skies';
  }
  async function save(blob, name) {
    if (!(blob instanceof Blob)) blob = new Blob([toU8(blob)]);
    name = safeFileName(name);
    const N = window.LUTSNative;
    if (N && typeof N.saveFile === 'function') { await N.saveFile(blob, name); return 'saved'; }
    // The picker needs a fresh tap (transient activation); after a long export it has expired, so download instead.
    const activation = navigator.userActivation ? navigator.userActivation.isActive : true;
    if (typeof window.showSaveFilePicker === 'function' && !IOS && activation) {
      const mime = baseMime(blob.type), ext = (/\.[A-Za-z0-9]{1,8}$/.exec(name) || [''])[0];
      const opts = { suggestedName: name };
      if (/^[a-z]+\/[a-z0-9.+-]+$/.test(mime) && ext) opts.types = [{ description: name, accept: { [mime]: [ext] } }];
      try {
        const h = await window.showSaveFilePicker(opts);
        const w = await h.createWritable();
        await w.write(blob); await w.close();
        return 'saved';
      } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* no user gesture left, or refused: download instead */ }
    }
    if (IOS && navigator.share && navigator.canShare && typeof File === 'function') {
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
      }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    (document.body || document.documentElement).appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'downloaded';
  }
  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'application/pdf': '.pdf', 'application/zip': '.zip', 'text/csv': '.csv', 'text/calendar': '.ics' };
  async function share(o) {
    o = o || {};
    const data = {};
    if (o.title) data.title = String(o.title);
    if (o.text) data.text = String(o.text);
    if (o.url) data.url = String(o.url);
    const files = (o.files || []).filter(Boolean).map((f, i) => (typeof File === 'function' && f instanceof File ? f
      : new File([f], `light-up-the-skies-${i + 1}${EXT[baseMime(f.type)] || ''}`, { type: (f && f.type) || 'application/octet-stream' })));
    let result = 'shared';
    if (files.length) {
      data.files = files;
      if (navigator.canShare && !navigator.canShare(data)) { delete data.files; result = 'text'; }
    }
    if (navigator.share && (data.text || data.url || data.files)) {
      try { await navigator.share(data); return result; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const text = [o.text, o.url].filter(Boolean).join('\n');
    if (text && navigator.clipboard && navigator.clipboard.writeText) { try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { /* not allowed */ } }
    return 'unsupported';
  }

  // ---------- public API ----------
  Object.assign(EM, {
    version: 1,
    err,
    sniff,
    crc32,
    b64u,
    image: { prepare: imagePrepare, thumb: imageThumb, decode: imageDecode, info: (b) => C.info(toU8(b)), strip: (b) => C.strip(toU8(b)), LIMITS: C.LIMITS },
    video: { probe: videoProbe, prepare: videoPrepare, flashScore },
    voice: { record: voiceRecord, mime: voiceMime, supported: () => !!(typeof MediaRecorder === 'function' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
    mark: { draw: markDraw, apply: markApply, ready: () => markAssets().then(() => true), needed: needsMark },
    crypto: { key: () => rand(32), seal, open, wrap, unwrap },
    page,
    faces,
    csv,
    save,
    share,
    ics,
  });
})();
