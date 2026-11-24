/* Event Sky selfie search worker (face/face-worker.js, bundled with the pages). Build spec §3.8, §4.21.
 *
 * face-search.js starts this worker from a Blob made of a prelude (fetch, XHR, sockets and importScripts switched off),
 * the model library (face-api.js, from cfg.faceBase, SHA-256 checked) and this file, so the library's globals are
 * already here. A dedicated worker has no window, no DOM and no native bridge: the library's code never runs on the
 * page. The worker fetches nothing: the weights arrive in the 'init' message.
 * Face descriptors stay in this worker. The page gets face boxes, opaque numbers (refs) and distances, never a
 * descriptor, and 'forget' zero-fills them all.
 *
 * Model interface (pluggable). The worker drives an engine:
 *   engine.load(models) → {backend}      models = {net: [{weights: [specs], buffers: [ArrayBuffer]}]} (face-api manifests)
 *   engine.detect(imageData, {minScore, inputSize}) → [{box: [x, y, w, h], score, d: Float32Array}]
 *   engine.describe(imageData) → Float32Array | null   (the image is one face crop)
 * When the library script sets self.ESFaceEngine with that shape, it is used as is. Otherwise the @vladmandic/face-api
 * adapter below is used (self.faceapi: tinyFaceDetector + faceLandmark68TinyNet + faceRecognitionNet, tensor inputs, so
 * no DOM is needed in the worker).
 *
 * Messages: {id, op, …} → {id, ok, result} or {id, ok: false, error: {code, message}}; {progress: {op, done, total}}.
 *  init {models} → {engine, backend}
 *  detect {img: {w, h, data: ArrayBuffer RGBA}, tag: 'face'|'probe'|'excl', minScore, inputSize}
 *     → {faces: [{box, score, ref}]}: 'face' keeps every face; 'probe' (the guest's selfie) and 'excl' (an opted-out
 *       guest's selfie) keep only the largest face. Boxes are in the image's pixels.
 *  describe {img, tag: 'rep'} → {ref, d}: d is the distance to the probe (Infinity without one)
 *  drop {refs} → wipes those descriptors
 *  cluster {threshold, exclude, seed} → {clusters: [{refs (most central first)}] (largest first), dropped, droppedClusters}
 *  near {groups: [{c, refs}], against: [refs]} → {c: smallest distance from the group to any of `against`}
 *  forget → wipes everything
 */
(function () {
  'use strict';
  let engine = null;
  const store = new Map(); // ref -> {d: Float32Array, tag, score}
  let nextRef = 1, probeRef = 0;

  function fail(code, message) { const e = new Error(message); e.code = code; return e; }
  function toVec(d) {
    if (!d || typeof d.length !== 'number' || d.length < 8 || d.length > 2048) return null;
    const v = d instanceof Float32Array ? new Float32Array(d) : Float32Array.from(d);
    for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return null;
    return v;
  }
  function dist(a, b) {
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) { const x = a[i] - b[i]; s += x * x; }
    return Math.sqrt(s);
  }
  function wipe(ref) { const v = store.get(ref); if (v) { v.d.fill(0); store.delete(ref); } if (ref === probeRef) probeRef = 0; }
  function forget() { for (const v of store.values()) v.d.fill(0); store.clear(); probeRef = 0; }
  function keep(d, tag, score) {
    const ref = nextRef++;
    store.set(ref, { d, tag, score: +score || 0 });
    return ref;
  }
  function imageOf(m) {
    if (!m || !(m.w > 0) || !(m.h > 0) || !m.data) throw fail('BAD_FILE', 'No image');
    return new ImageData(new Uint8ClampedArray(m.data), m.w, m.h);
  }
  function concat(buffers) {
    let n = 0;
    for (const b of buffers) n += b.byteLength;
    const out = new Uint8Array(n);
    let o = 0;
    for (const b of buffers) { out.set(new Uint8Array(b), o); o += b.byteLength; }
    return out.buffer;
  }
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ------------------------------------------------------------------------------ @vladmandic/face-api adapter ---
  function faceApiEngine(api) {
    const tf = api.tf;
    if (!tf || !tf.browser || !tf.io || !api.nets || typeof api.detectAllFaces !== 'function') throw fail('UNSUPPORTED', 'face-api.js is not the expected build');
    const NETS = ['tinyFaceDetector', 'faceLandmark68TinyNet', 'faceRecognitionNet'];
    return {
      name: 'face-api',
      async load(models) {
        let backend = '';
        if (typeof tf.setBackend === 'function') {
          for (const b of ['webgl', 'cpu']) {
            try { if (await tf.setBackend(b)) { backend = b; break; } } catch (e) { /* next backend */ }
          }
          if (typeof tf.ready === 'function') await tf.ready();
        }
        for (const net of NETS) {
          const groups = models[net];
          const nn = api.nets[net];
          if (!Array.isArray(groups) || !groups.length || !nn) throw fail('BAD_FILE', `The ${net} weights are missing`);
          const map = {};
          for (const g of groups) Object.assign(map, tf.io.decodeWeights(concat(g.buffers), g.weights));
          if (typeof nn.loadFromWeightMap !== 'function') throw fail('UNSUPPORTED', 'face-api.js cannot take weights directly');
          nn.loadFromWeightMap(map);
        }
        return { backend: backend || (typeof tf.getBackend === 'function' ? tf.getBackend() : '') };
      },
      async detect(img, o) {
        const t = tf.browser.fromPixels(img);
        try {
          const opts = new api.TinyFaceDetectorOptions({ inputSize: o.inputSize || 416, scoreThreshold: o.minScore || 0.5 });
          const res = await api.detectAllFaces(t, opts).withFaceLandmarks(true).withFaceDescriptors();
          return (res || []).map((r) => {
            const b = (r.alignedRect || r.detection).box;
            return { box: [b.x, b.y, b.width, b.height], score: r.detection ? r.detection.score : 0, d: r.descriptor };
          });
        } finally { if (t && t.dispose) t.dispose(); }
      },
      async describe(img) {
        const t = tf.browser.fromPixels(img);
        try { const d = await api.computeFaceDescriptor(t); return Array.isArray(d) ? d[0] : d; } finally { if (t && t.dispose) t.dispose(); }
      },
    };
  }
  function pickEngine() {
    const custom = self.ESFaceEngine;
    if (custom && typeof custom.load === 'function' && typeof custom.detect === 'function' && typeof custom.describe === 'function') return custom;
    if (self.faceapi) return faceApiEngine(self.faceapi);
    throw fail('UNSUPPORTED', 'No face model in the worker');
  }
  const need = () => { if (!engine) throw fail('UNSUPPORTED', 'The face finder is not ready'); };

  // ------------------------------------------------------------------------------------------------ the ops ---
  async function detect(m) {
    need();
    const raw = await engine.detect(imageOf(m.img), { minScore: +m.minScore || 0.5, inputSize: +m.inputSize || 416 });
    const faces = [];
    for (const f of raw || []) {
      const d = toVec(f && f.d);
      const box = Array.isArray(f && f.box) ? f.box.slice(0, 4).map((x) => Math.round(+x || 0)) : null;
      if (!d || !box || !(box[2] > 1 && box[3] > 1)) continue;
      faces.push({ box, score: +f.score || 0, d });
    }
    if (m.tag === 'probe' || m.tag === 'excl') {
      faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
      for (const f of faces.slice(1)) f.d.fill(0);
      const top = faces.slice(0, 1);
      if (top.length) {
        if (m.tag === 'probe') { if (probeRef) wipe(probeRef); probeRef = keep(top[0].d, 'probe', top[0].score); }
        else keep(top[0].d, 'excl', top[0].score);
      }
      return { faces: top.map((f) => ({ box: f.box, score: f.score })) };
    }
    return { faces: faces.map((f) => ({ box: f.box, score: f.score, ref: keep(f.d, 'face', f.score) })) };
  }
  async function describe(m) {
    need();
    const d = toVec(await engine.describe(imageOf(m.img)));
    if (!d) return { ref: 0, d: Infinity };
    const p = probeRef ? store.get(probeRef) : null;
    return { ref: keep(d, m.tag === 'rep' ? 'rep' : 'face', 0), d: p ? dist(d, p.d) : Infinity };
  }
  // Chinese whispers on the graph of faces closer than `threshold`; seeded so a re-run gives the same people.
  function cluster(m) {
    const thr = +m.threshold || 0.5, exThr = +m.exclude || 0.45;
    const excl = [...store.values()].filter((v) => v.tag === 'excl');
    const all = [...store.entries()].filter(([, v]) => v.tag === 'face');
    const kept = [];
    let dropped = 0;
    for (const [ref, v] of all) {
      if (excl.some((x) => dist(v.d, x.d) < exThr)) { wipe(ref); dropped++; } else kept.push([ref, v]);
    }
    const n = kept.length;
    const adj = Array.from({ length: n }, () => []);
    const total = Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const a = kept[i][1].d;
      for (let j = i + 1; j < n; j++) {
        const dd = dist(a, kept[j][1].d);
        if (dd < thr) { const w = 1 - dd; adj[i].push(j, w); adj[j].push(i, w); }
      }
      if (i % 200 === 199) self.postMessage({ progress: { op: 'cluster', done: i + 1, total } });
    }
    const labels = Int32Array.from({ length: n }, (_, i) => i);
    const rnd = mulberry32((+m.seed || 1) >>> 0);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let iter = 0; iter < 40; iter++) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
      let changed = 0;
      for (const i of order) {
        const e = adj[i];
        if (!e.length) continue;
        const tally = new Map();
        for (let k = 0; k < e.length; k += 2) { const l = labels[e[k]]; tally.set(l, (tally.get(l) || 0) + e[k + 1]); }
        let best = labels[i], bw = -1;
        for (const [l, w] of tally) if (w > bw || (w === bw && l < best)) { best = l; bw = w; }
        if (best !== labels[i]) { labels[i] = best; changed++; }
      }
      if (!changed) break;
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) { const l = labels[i]; if (!groups.has(l)) groups.set(l, []); groups.get(l).push(i); }
    const out = [];
    let droppedClusters = 0;
    for (const idx of groups.values()) {
      // Most central first: the smallest sum of distances to the rest (sampled for very large groups).
      const sample = idx.length > 400 ? idx.filter((_, k) => k % Math.ceil(idx.length / 400) === 0) : idx;
      const score = idx.map((i) => {
        let s = 0;
        for (const j of sample) if (j !== i) s += dist(kept[i][1].d, kept[j][1].d);
        return [i, s - kept[i][1].score * 1e-3];
      }).sort((a, b) => a[1] - b[1]);
      const medoid = kept[score[0][0]][1].d;
      if (excl.some((x) => dist(medoid, x.d) < exThr)) {
        for (const i of idx) wipe(kept[i][0]);
        droppedClusters++; dropped += idx.length;
        continue;
      }
      out.push({ refs: score.map(([i]) => kept[i][0]) });
    }
    out.sort((a, b) => b.refs.length - a.refs.length);
    self.postMessage({ progress: { op: 'cluster', done: total, total } });
    return { clusters: out, dropped, droppedClusters };
  }
  function near(m) {
    const against = (m.against || []).map((r) => store.get(r)).filter(Boolean);
    const out = {};
    for (const g of m.groups || []) {
      let best = Infinity;
      for (const r of g.refs || []) {
        const v = store.get(r);
        if (!v) continue;
        for (const a of against) { const dd = dist(v.d, a.d); if (dd < best) best = dd; }
      }
      if (best < Infinity) out[g.c] = best;
    }
    return out;
  }

  self.onmessage = async (ev) => {
    const m = ev.data || {};
    try {
      let result;
      switch (m.op) {
        case 'init': {
          forget();
          engine = pickEngine();
          const r = await engine.load(m.models || {});
          result = { engine: engine.name || 'custom', backend: (r && r.backend) || '' };
          break;
        }
        case 'detect': result = await detect(m); break;
        case 'describe': result = await describe(m); break;
        case 'drop': for (const r of m.refs || []) wipe(r); result = true; break;
        case 'cluster': need(); result = cluster(m); break;
        case 'near': result = near(m); break;
        case 'forget': forget(); result = true; break;
        default: throw fail('BAD_ARG', `Unknown op ${m.op}`);
      }
      self.postMessage({ id: m.id, ok: true, result });
    } catch (e) {
      self.postMessage({ id: m.id, ok: false, error: { code: (e && e.code) || 'UNSUPPORTED', message: String((e && e.message) || e) } });
    }
  };
})();
