/* Event Sky video files: EM.mp4 (event-mp4.js). Spec §3.3 (WP-B), used by EM.video.prepare (15 s guest clips) and by
 * ESExport.bestOf (the best-of video).
 *
 *  EM.mp4.muxer({w, h, fps, avcC}) → {add(chunk, meta?), finish() → Uint8Array}
 *     A plain (not fragmented) MP4: ftyp, moov (first, so it plays as it loads), mdat. One H.264 video track ('avc1'),
 *     and, when finish() is given one, an AAC sound track ('mp4a', after the video in mdat). chunk is an EncodedVideoChunk or {data, ts, key, dur?} with ts/dur in microseconds. avcC may
 *     be left out and taken from the first chunk's meta.decoderConfig.description.
 *  EM.mp4.encoderConfig({w, h, fps, bitrate}) → VideoEncoderConfig|null   the first H.264 profile/level the browser can encode
 *  EM.mp4.encoder({w, h, fps, bitrate, keyEvery}) → {codec, frame(source, tsUs, {key}?), finish() → Uint8Array, close()}
 *     WebCodecs VideoEncoder + the muxer, with back-pressure.
 *  EM.mp4.recorderMime() → the MediaRecorder type used: MP4 when supported, else WebM ('' if none)
 *  EM.mp4.recorder(canvas, {fps, bitrate}) → {mime, frame(), stop() → {blob, mime}, cancel()}
 *     canvas.captureStream + MediaRecorder; the stream has a video track only, so the file is silent.
 *  EM.mp4.encodeAudio(audioBuffer, {bitrate}) → {sampleRate, channels, asc, frames:[{data, dur}]} | null
 *     AAC-LC with WebCodecs' AudioEncoder (null where the browser cannot encode AAC).
 *  EM.mp4.render({w, h, fps=30, bitrate=3e6, frames, draw(ctx, i, tMs), onProgress(0..1), signal, prefer, canvas?, audio?}) → {blob, mime, du, path, audio}
 *     Draws every frame with draw() and encodes it: offline with WebCodecs (fast, exact timing) when available, otherwise
 *     in real time with MediaRecorder. audio (an AudioBuffer as long as the video) becomes the AAC track on the WebCodecs
 *     path when the browser can encode AAC; otherwise, and on the MediaRecorder path, the output is silent (audio: false). Flash safety and the brand mark are the caller's
 *     drawing (EFX and EM.mark.draw).
 *
 * WebCodecs needs a secure context (https, the app's own origin, or localhost).
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
    throw err('BAD_ARG', 'Expected bytes');
  }

  // ---------- ISO BMFF boxes ----------
  const ascii = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
  const u8 = (v) => Uint8Array.of(v & 0xff);
  const u16 = (v) => Uint8Array.of((v >>> 8) & 0xff, v & 0xff);
  const u32 = (v) => Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  const u64 = (v) => concat([u32(Math.floor(v / 0x100000000)), u32(v % 0x100000000)]);
  const zeros = (n) => new Uint8Array(n);
  function concat(list) {
    let n = 0;
    for (const a of list) n += a.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of list) { out.set(a, o); o += a.length; }
    return out;
  }
  const box = (type, ...parts) => { const body = concat(parts); return concat([u32(body.length + 8), ascii(type), body]); };
  const full = (type, version, flags, ...parts) => box(type, u8(version), u8(flags >>> 16), u16(flags & 0xffff), ...parts);
  const MATRIX = concat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  function muxer(opts) {
    opts = opts || {};
    const w = Math.round(opts.w), h = Math.round(opts.h), fps = opts.fps > 0 ? opts.fps : 30;
    if (!(w > 0 && h > 0 && w <= 8192 && h <= 8192)) throw err('BAD_ARG', 'Bad video size');
    const TS = 90000; // track timescale
    let avcC = opts.avcC ? toU8(opts.avcC).slice() : null, finished = false;
    const samples = [];
    return {
      add(chunk, meta) {
        if (finished) throw err('BAD_ARG', 'The muxer is finished');
        if (!avcC && meta && meta.decoderConfig && meta.decoderConfig.description) avcC = toU8(meta.decoderConfig.description).slice();
        let data, ts, key, dur;
        if (typeof EncodedVideoChunk !== 'undefined' && chunk instanceof EncodedVideoChunk) {
          data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
          ts = chunk.timestamp; key = chunk.type === 'key'; dur = chunk.duration;
        } else {
          if (!chunk || !chunk.data) throw err('BAD_ARG', 'A chunk needs data');
          data = toU8(chunk.data).slice(); ts = +chunk.ts || 0; key = !!chunk.key; dur = chunk.dur;
        }
        if (!samples.length && !key) throw err('BAD_ARG', 'The first frame must be a key frame');
        samples.push({ data, ts, key, dur: dur > 0 ? dur : 0 });
      },
      get count() { return samples.length; },
      finish(audio) {
        if (!samples.length) throw err('BAD_ARG', 'No frames');
        const aud = audio && audio.frames && audio.frames.length && audio.asc && audio.asc.length ? audio : null;
        if (!avcC || avcC.length < 7 || avcC[0] !== 1) throw err('BAD_ARG', 'Missing H.264 configuration (avcC)');
        finished = true;
        const n = samples.length, t0 = samples[0].ts;
        const tick = (us) => Math.round(((us - t0) * TS) / 1e6);
        const durs = new Array(n);
        for (let i = 0; i < n; i++) {
          let d = i + 1 < n ? tick(samples[i + 1].ts) - tick(samples[i].ts) : (samples[i].dur ? Math.round((samples[i].dur * TS) / 1e6) : Math.round(TS / fps));
          if (!(d > 0)) d = Math.round(TS / fps);
          durs[i] = d;
        }
        const total = durs.reduce((a, b) => a + b, 0), ms = Math.round((total * 1000) / TS);
        const stts = [];
        for (const d of durs) { const last = stts[stts.length - 1]; if (last && last[1] === d) last[0]++; else stts.push([1, d]); }
        const keys = [];
        samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
        let dataSize = 0;
        for (const s of samples) dataSize += s.data.length;
        const videoSize = dataSize;
        if (aud) for (const a of aud.frames) dataSize += a.data.length;
        const large = dataSize + 8 > 0xffffffff;
        const build = (offset) => {
          const co64 = offset + dataSize > 0xffffffff;
          const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1),
            zeros(32), u16(0x0018), u16(0xffff), box('avcC', avcC));
          const stbl = box('stbl',
            full('stsd', 0, 0, u32(1), avc1),
            full('stts', 0, 0, u32(stts.length), ...stts.map(([c, d]) => concat([u32(c), u32(d)]))),
            keys.length === n ? zeros(0) : full('stss', 0, 0, u32(keys.length), ...keys.map(u32)),
            full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
            full('stsz', 0, 0, u32(0), u32(n), ...samples.map((s) => u32(s.data.length))),
            co64 ? full('co64', 0, 0, u32(1), u64(offset)) : full('stco', 0, 0, u32(1), u32(offset)));
          const minf = box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
            box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
          const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)),
            full('hdlr', 0, 0, u32(0), ascii('vide'), zeros(12), ascii('VideoHandler\0')), minf);
          const trak = box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(w * 65536), u32(h * 65536)), mdia);
          const atrak = aud ? audioTrak(aud, offset + videoSize, offset + dataSize > 0xffffffff, ms) : null;
          const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(aud ? 3 : 2));
          return atrak ? box('moov', mvhd, trak, atrak) : box('moov', mvhd, trak);
        };
        const ftyp = box('ftyp', ascii('isom'), u32(512), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
        const mdatHead = large ? concat([u32(1), ascii('mdat'), u64(dataSize + 16)]) : concat([u32(dataSize + 8), ascii('mdat')]);
        let moov = build(0);
        moov = build(ftyp.length + moov.length + mdatHead.length);
        const offset = ftyp.length + moov.length + mdatHead.length;
        const check = build(offset); // co64 changes the size: settle it
        if (check.length !== moov.length) moov = build(ftyp.length + check.length + mdatHead.length);
        const out = new Uint8Array(ftyp.length + moov.length + mdatHead.length + dataSize);
        let o = 0;
        out.set(ftyp, o); o += ftyp.length;
        out.set(moov, o); o += moov.length;
        out.set(mdatHead, o); o += mdatHead.length;
        for (const s of samples) { out.set(s.data, o); o += s.data.length; }
        if (aud) for (const a of aud.frames) { out.set(a.data, o); o += a.data.length; }
        samples.length = 0;
        return out;
      },
    };
  }

  // The sound track: AAC-LC frames in one chunk after the video's (track 2).
  function descr(tag, body) { return concat([u8(tag), u8(body.length), body]); } // (every descriptor here is under 128 bytes)
  // An edit list skips the encoder's start-up samples (a.prime, 2112 for AAC) and ends the sound with the picture (vms).
  function audioTrak(a, offset, co64, vms) {
    const sr = a.sampleRate, ch = a.channels || 2, n = a.frames.length;
    const durs = a.frames.map((f) => f.dur || 1024), total = durs.reduce((x, d) => x + d, 0);
    const stts = [];
    for (const d of durs) { const last = stts[stts.length - 1]; if (last && last[1] === d) last[0]++; else stts.push([1, d]); }
    const br = a.bitrate || 128000;
    const dcd = descr(0x04, concat([u8(0x40), u8(0x15), u8(0), u16(0), u32(br), u32(br), descr(0x05, a.asc)]));
    const esds = full('esds', 0, 0, descr(0x03, concat([u16(2), u8(0), dcd, descr(0x06, u8(0x02))])));
    const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(ch), u16(16), u16(0), u16(0), u32((sr * 65536) >>> 0), esds);
    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), mp4a),
      full('stts', 0, 0, u32(stts.length), ...stts.map(([c, d]) => concat([u32(c), u32(d)]))),
      full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), ...a.frames.map((f) => u32(f.data.length))),
      co64 ? full('co64', 0, 0, u32(1), u64(offset)) : full('stco', 0, 0, u32(1), u32(offset)));
    const minf = box('minf', full('smhd', 0, 0, u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(sr), u32(total), u16(0x55c4), u16(0)),
      full('hdlr', 0, 0, u32(0), ascii('soun'), zeros(12), ascii('SoundHandler\0')), minf);
    const prime = Math.min(Math.max(0, a.prime || 0), total), ms = Math.max(0, Math.min(vms || Infinity, Math.round(((total - prime) * 1000) / sr)));
    const edts = box('edts', full('elst', 0, 0, u32(1), u32(ms), u32(prime), u16(1), u16(0)));
    return box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(ms), zeros(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)), edts, mdia);
  }
  // AudioSpecificConfig for AAC-LC, when the encoder does not give one.
  function ascFor(sr, ch) {
    const idx = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000].indexOf(sr);
    if (idx < 0) return null;
    return Uint8Array.of((2 << 3) | (idx >> 1), ((idx & 1) << 7) | (ch << 3));
  }
  async function encodeAudio(buf, o) {
    o = o || {};
    if (!buf || typeof AudioEncoder !== 'function' || typeof AudioData !== 'function') return null;
    const sr = buf.sampleRate, ch = Math.min(2, buf.numberOfChannels || 1), bitrate = o.bitrate || 128000;
    const cfg = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate };
    try { const s = await AudioEncoder.isConfigSupported(cfg); if (!s || !s.supported) return null; } catch (e) { return null; }
    const frames = [];
    let asc = null, failure = null;
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        if (!asc && meta && meta.decoderConfig && meta.decoderConfig.description) asc = toU8(meta.decoderConfig.description).slice();
        const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
        frames.push({ data, ts: chunk.timestamp });
      },
      error: (e) => { failure = failure || e; },
    });
    try {
      enc.configure(cfg);
      const N = buf.length, STEP = 4096, chans = [];
      for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
      for (let i = 0; i < N; i += STEP) {
        if (failure) break;
        const n = Math.min(STEP, N - i), planar = new Float32Array(n * ch);
        for (let c = 0; c < ch; c++) planar.set(chans[c].subarray(i, i + n), c * n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((i * 1e6) / sr), data: planar });
        try { enc.encode(ad); } finally { ad.close(); }
        while (enc.encodeQueueSize > 8) await waitDequeue(enc);
      }
      await enc.flush();
    } catch (e) { failure = failure || e; } finally { try { enc.close(); } catch (e) { /* closed */ } }
    if (failure || !frames.length) return null;
    asc = asc || ascFor(sr, ch);
    if (!asc) return null;
    frames.sort((a, b) => a.ts - b.ts);
    // An AAC encoder puts its start-up (priming) samples first: 2112 is the usual delay, seen as the extra frames it gives.
    const expected = Math.ceil(buf.length / 1024), prime = frames.length > expected ? 2112 : 0;
    return { sampleRate: sr, channels: ch, asc, bitrate, prime, frames: frames.map((f) => ({ data: f.data, dur: 1024 })) };
  }

  // ---------- WebCodecs ----------
  // H.264 levels: [level_idc, max frame size in macroblocks, max macroblocks per second]
  // (from 3.1 up: the 640×360 guest clips come out as avc1.42001f, as the spec asks)
  const LEVELS = [[0x1f, 3600, 108000], [0x20, 5120, 216000], [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x33, 36864, 983040]];
  const configCache = new Map();
  async function encoderConfig(o) {
    if (typeof VideoEncoder !== 'function' || typeof VideoFrame !== 'function') return null;
    const w = Math.round(o.w), h = Math.round(o.h), fps = o.fps > 0 ? o.fps : 30, bitrate = o.bitrate > 0 ? Math.round(o.bitrate) : 2e6;
    const id = `${w}x${h}@${fps}:${bitrate}`;
    if (configCache.has(id)) return configCache.get(id);
    const mbs = Math.ceil(w / 16) * Math.ceil(h / 16), rate = mbs * fps;
    let found = null;
    outer: for (const profile of ['42', '4d', '64']) {
      for (const [lvl, maxFs, maxRate] of LEVELS) {
        if (mbs > maxFs || rate > maxRate) continue;
        const codec = `avc1.${profile}00${lvl.toString(16).padStart(2, '0')}`;
        for (const extra of [{ bitrateMode: 'constant' }, {}]) {
          const cfg = Object.assign({ codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' }, extra);
          try { const s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) { found = cfg; break outer; } } catch (e) { /* next */ }
        }
        break; // only the lowest level that fits, per profile
      }
    }
    configCache.set(id, found);
    return found;
  }
  function waitDequeue(enc) {
    return new Promise((resolve) => {
      let t = 0;
      const done = () => { clearTimeout(t); if (enc.removeEventListener) enc.removeEventListener('dequeue', done); resolve(); };
      if (enc.addEventListener) enc.addEventListener('dequeue', done);
      t = setTimeout(done, 15);
    });
  }
  async function encoder(o) {
    o = o || {};
    const w = Math.round(o.w), h = Math.round(o.h);
    if (w % 2 || h % 2) throw err('BAD_ARG', 'H.264 needs an even width and height');
    const fps = o.fps > 0 ? o.fps : 30, keyEvery = o.keyEvery > 0 ? Math.round(o.keyEvery) : fps * 2;
    const cfg = await encoderConfig({ w, h, fps, bitrate: o.bitrate });
    if (!cfg) throw err('UNSUPPORTED', 'This browser cannot encode H.264 video.');
    let mux = null, failure = null, count = 0, closed = false;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          if (!mux) mux = muxer({ w, h, fps, avcC: meta && meta.decoderConfig && meta.decoderConfig.description });
          mux.add(chunk, meta);
        } catch (e) { failure = failure || e; }
      },
      error: (e) => { failure = failure || e; },
    });
    enc.configure(cfg);
    const fail = () => { const e = failure; return e && e.code ? e : err('UNSUPPORTED', `The video encoder stopped (${(e && e.message) || e}).`); };
    return {
      codec: cfg.codec,
      get queue() { return enc.encodeQueueSize; },
      async frame(source, tsUs, fo) {
        if (failure) throw fail();
        if (closed) throw err('BAD_ARG', 'The encoder is closed');
        while (enc.encodeQueueSize > 4) { await waitDequeue(enc); if (failure) throw fail(); }
        const f = new VideoFrame(source, { timestamp: Math.round(tsUs), duration: Math.round(1e6 / fps) });
        try { enc.encode(f, { keyFrame: !!(fo && fo.key) || count % keyEvery === 0 }); } finally { f.close(); }
        count++;
      },
      async finish(audio) {
        if (failure) throw fail();
        await enc.flush();
        closed = true;
        try { enc.close(); } catch (e) { /* closed */ }
        if (failure) throw fail();
        if (!mux || !mux.count) throw err('UNSUPPORTED', 'The video encoder gave no frames.');
        return mux.finish(audio);
      },
      close() { if (closed) return; closed = true; try { enc.close(); } catch (e) { /* closed */ } },
    };
  }

  // ---------- MediaRecorder ----------
  const REC_MIMES = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  function recorderMime() {
    if (typeof MediaRecorder !== 'function') return '';
    for (const m of REC_MIMES) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* next */ } }
    return '';
  }
  const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
  function recorder(canvas, o) {
    o = o || {};
    if (typeof MediaRecorder !== 'function' || !canvas || typeof canvas.captureStream !== 'function') throw err('UNSUPPORTED', 'This browser cannot record video.');
    const fps = o.fps > 0 ? o.fps : 30;
    let stream = canvas.captureStream(0), track = stream.getVideoTracks()[0];
    const manual = !!(track && typeof track.requestFrame === 'function');
    if (!manual) { stream.getTracks().forEach((t) => t.stop()); stream = canvas.captureStream(fps); track = stream.getVideoTracks()[0]; }
    stream.getAudioTracks().forEach((t) => { stream.removeTrack(t); t.stop(); }); // never any sound
    const pick = recorderMime();
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: Math.round(o.bitrate > 0 ? o.bitrate : 2.5e6) }, pick ? { mimeType: pick } : {})); } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw err('UNSUPPORTED', 'This browser cannot record video.');
    }
    const chunks = [];
    let state = 'recording', failure = null;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => { failure = failure || (e && e.error) || new Error('recorder error'); };
    rec.start(1000);
    const stopTracks = () => stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* stopped */ } });
    return {
      get mime() { return baseMime(rec.mimeType || pick) || 'video/webm'; },
      frame() { if (state === 'recording' && manual) track.requestFrame(); },
      stop() {
        if (state !== 'recording') return Promise.reject(err('BAD_ARG', 'Not recording'));
        state = 'stopping';
        return new Promise((resolve, reject) => {
          rec.onstop = () => {
            stopTracks(); state = 'stopped';
            const mime = baseMime(rec.mimeType || pick) || 'video/webm';
            if (failure || !chunks.length) { reject(err('UNSUPPORTED', 'The video could not be recorded.')); return; }
            resolve({ blob: new Blob(chunks, { type: mime }), mime });
          };
          try { rec.stop(); } catch (e) { stopTracks(); reject(err('UNSUPPORTED', 'The video could not be recorded.')); }
        });
      },
      cancel() { if (state !== 'recording' && state !== 'stopping') return; state = 'cancelled'; rec.onstop = null; try { rec.stop(); } catch (e) { /* stopped */ } stopTracks(); },
    };
  }

  // ---------- offline / real-time renderer ----------
  async function render(o) {
    o = o || {};
    const w = Math.round(o.w), h = Math.round(o.h), fps = o.fps > 0 ? o.fps : 30, bitrate = o.bitrate > 0 ? o.bitrate : 3e6;
    const frames = Math.max(1, Math.round(o.frames));
    if (typeof o.draw !== 'function') throw err('BAD_ARG', 'render needs draw()');
    const progress = (f) => { if (typeof o.onProgress === 'function') { try { o.onProgress(Math.min(1, f)); } catch (e) { /* caller's */ } } };
    // o.canvas: the caller's own canvas (an EFX stage, say); draw() then gets its 2D context, or null for a WebGL one.
    const own = !o.canvas, canvas = o.canvas || document.createElement('canvas');
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    const aborted = () => o.signal && o.signal.aborted;
    try {
      if (o.prefer !== 'recorder' && await encoderConfig({ w, h, fps, bitrate })) {
        const enc = await encoder({ w, h, fps, bitrate, keyEvery: fps * 2 });
        try {
          for (let i = 0; i < frames; i++) {
            if (aborted()) throw err('CANCELLED', 'Cancelled');
            await o.draw(ctx, i, (i * 1000) / fps);
            await enc.frame(canvas, Math.round((i * 1e6) / fps));
            if (i % 10 === 9) { progress((i + 1) / frames); await new Promise((r) => setTimeout(r, 0)); }
          }
          let snd = null;
          if (o.audio) { try { snd = await encodeAudio(o.audio, { bitrate: o.audioBitrate }); } catch (e) { snd = null; } }
          const bytes = await enc.finish(snd);
          progress(1);
          return { blob: new Blob([bytes], { type: 'video/mp4' }), mime: 'video/mp4', du: Math.round((frames * 1000) / fps), path: 'webcodecs', audio: !!snd };
        } finally { enc.close(); }
      }
      const rec = recorder(canvas, { fps, bitrate });
      try {
        const t0 = performance.now();
        for (let i = 0; i < frames; i++) {
          if (aborted()) throw err('CANCELLED', 'Cancelled');
          await o.draw(ctx, i, (i * 1000) / fps);
          rec.frame();
          if (i % 10 === 9) progress((i + 1) / frames);
          const wait = t0 + ((i + 1) * 1000) / fps - performance.now();
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        }
        const r = await rec.stop();
        progress(1);
        return { blob: r.blob, mime: r.mime, du: Math.round((frames * 1000) / fps), path: 'recorder', audio: false };
      } catch (e) { rec.cancel(); throw e; }
    } finally { if (own) canvas.width = canvas.height = 0; }
  }

  async function supported() {
    return { webcodecs: !!(await encoderConfig({ w: 640, h: 360, fps: 24, bitrate: 400000 })), recorder: baseMime(recorderMime()) };
  }

  EM.mp4 = { muxer, encoderConfig, encoder, encodeAudio, recorderMime, recorder, render, supported };
})();
