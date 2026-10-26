/* Light Up the Skies — the 3D tab's engine. Each city is its own scene module (world3d-<scene>.js), built from simple
   shapes with Three.js and loaded only while the 3D tab is open; this module holds what they share: the camera you
   look around with, the night sky, the diyas, the burst lights and the API the game draws its fireworks with.

   The scene draws the world; the fireworks stay the game's own 2D effects, drawn over it. The game places them with
   project()/unproject()/ground() and lights the scene with light().

   Built for phones: a scene is a few merged meshes, nothing casts shadows, and a frame is only drawn when the camera
   moves or a burst's light is fading. The low tier drops reflections and the burst lights. */
import * as THREE from './assets/vendor/three.module.min.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mulberry = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
// Polygon corners round (cx, cz): n sides, radius r, in order of increasing angle.
export const ngon = (n, r, cx = 0, cz = 0, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });

// The scenes there are (world3d-<scene>.js); the game maps its worlds onto them.
const SCENES = ['taj', 'india-gate', 'hawa-mahal', 'gateway-of-india', 'charminar', 'konark-sun-temple', 'golden-temple',
  'victoria-memorial', 'red-fort', 'mysore-palace', 'meenakshi-amman-temple', 'brihadeeswarar-temple', 'vivekananda-rock-memorial',
  'velankanni-basilica', 'cross-by-the-sea', 'golden-manor'];

// Where crackers may stand: the ground in front of you (metres; the camera looks towards -z). A scene may narrow it.
export const ZONE = { x0: -11, x1: 11, z0: -30, z1: -5 };
const EYE = 3.4; // eye height: a raised viewpoint, so pools and lawns show
const CAM_Z = { near: 7, far: 15, start: 11 };
// Flat ground layers stand this far apart, so far ones never fight for depth (no shimmer as the view turns).
export const LAYER = 0.08;

// The paved ground where crackers stand: square slabs (rgb) set with pale joints, from z0 to z1, width wide.
export function forecourt({ rgb, z0, z1, width, joint = 'rgba(225,210,190,0.5)', tile = 3, y = LAYER }) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), rnd = mulberry(9);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 0.85 + rnd() * 0.2;
    g.fillStyle = `rgb(${(rgb[0] * v) | 0},${(rgb[1] * v) | 0},${(rgb[2] * v) | 0})`; g.fillRect(x * 32, y * 32, 32, 32);
  }
  g.strokeStyle = joint; g.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const depth = z1 - z0;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(width / tile, depth / tile); t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, y, (z0 + z1) / 2);
  return m;
}

// A rangoli on the ground at (x, z), above the paving at height y; world3d rings it with diyas.
export function rangoli(x, z, y = 2 * LAYER) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), cols = ['#ffffff', '#b56bff', '#ff9a3c', '#4a8dff', '#3ddc97', '#ffd36b', '#ff4a6a'];
  for (let i = 7; i > 0; i--) {
    g.fillStyle = cols[i - 1]; g.beginPath();
    for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2, r = i * 17 * (1 + 0.12 * Math.sin(t * 8)); g.lineTo(128 + Math.cos(t) * r, 128 + Math.sin(t) * r); }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshLambertMaterial({ map: t, transparent: true }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.userData.rangoli = true;
  return m;
}

// ---------- Sky, moon, stars and glowing points ----------
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
// The sky: a dome coloured by height above the horizon (horizon glow low down, deep blue overhead), so it stays put
// as you look up and around, like the sky in the 2D pictures.
function skyDome(sky) {
  const g = new THREE.SphereGeometry(2400, 32, 16), p = g.attributes.position, c = new THREE.Color();
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -2;
  // Repaintable, so a scene can move its sky through the evening (see def.animate).
  m.userData.paint = ([top, mid, low, horizon]) => {
    // The glow stays low on the horizon; from about halfway up the sky is at its darkest, so bursts stand out.
    const stops = [[0, new THREE.Color(horizon)], [0.07, new THREE.Color(low)], [0.24, new THREE.Color(mid)], [0.55, new THREE.Color(top)], [1, new THREE.Color(top)]];
    const col = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const e = Math.max(0, Math.asin(Math.min(1, p.getY(i) / 2400)) / (Math.PI / 2));
      let k = 1;
      while (k < stops.length - 1 && e > stops[k][0]) k++;
      const [e0, c0] = stops[k - 1], [e1, c1] = stops[k];
      c.copy(c0).lerp(c1, Math.min(1, (e - e0) / (e1 - e0)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  };
  m.userData.paint(sky);
  return m;
}
function moonSprite([x, y, z]) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), halo = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,240,210,0.35)'); halo.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
  const m = document.createElement('canvas'); m.width = m.height = 128;
  const k = m.getContext('2d');
  k.fillStyle = '#f3ecdc'; k.beginPath(); k.arc(64, 64, 20, 0, Math.PI * 2); k.fill();
  k.globalCompositeOperation = 'destination-out'; k.beginPath(); k.arc(73, 60, 18.5, 0, Math.PI * 2); k.fill();
  g.drawImage(m, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
  s.position.set(x, y, z); s.scale.set(140, 140, 1);
  return s;
}
// Soft twilight clouds: a few drawn billboards low in the sky ({ colour, count, seed }).
function cloudSprites({ colour, count, seed }) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d'), rnd = mulberry(seed);
  for (let i = 0; i < 14; i++) {
    const x = 30 + rnd() * 196, y = 40 + rnd() * 26, r = 18 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: colour, fog: false, transparent: true, opacity: 0.35 + rnd() * 0.25, depthWrite: false }));
    const a = -1 + rnd() * 2, d = 900 + rnd() * 400, w = 320 + rnd() * 420;
    s.position.set(Math.sin(a) * d, 90 + rnd() * 260, -Math.cos(a) * d); s.scale.set(w, w * 0.32, 1);
    s.renderOrder = -1;
    out.push(s);
  }
  return out;
}
// Glowing points (diyas, lamps): [x, y, z, colour] each.
function spotPoints(dot, spots) {
  const pos = [], col = [], c = new THREE.Color();
  for (const [x, y, z, hex] of spots) { c.set(hex); pos.push(x, y, z); col.push(c.r, c.g, c.b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function starPoints(dot, n) {
  const pos = [], rnd = mulberry(7);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, e = 0.08 + Math.asin(rnd()) * 0.95, r = 1500;
    pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, map: dot, color: '#dfe6ff', transparent: true, depthWrite: false, fog: false }));
}

/** Creates the 3D world for `scene` (see SCENES) on `canvas`. tier: 0 low, 1 normal, 2 high. Rejects when WebGL or the
    scene can't load. onFolk(name, pan, distance) plays the forecourt dog's and old man's noises (see world3d-folk.js). */
export async function create({ canvas, scene: id = 'taj', tier = 1, onLost, onFolk } = {}) {
  if (!SCENES.includes(id)) id = 'taj';
  // The renderer first: a phone without WebGL fails here, before any scene is built.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier >= 2, powerPreference: 'default', alpha: false, stencil: false });
  let def, folkModule;
  try {
    const folkLoad = import('./world3d-folk.js').catch(() => null); // the scene goes on without them
    def = (await import(`./world3d-${id}.js`)).build({ tier });
    folkModule = await folkLoad;
  } catch (error) { renderer.dispose(); renderer.forceContextLoss(); throw error; }
  const scene = new THREE.Scene();
  const sky = def.sky || ['#02030b', '#08092a', '#1a1640', '#2c2048'];
  scene.background = new THREE.Color(sky[0]);
  const dome = skyDome(sky);
  scene.add(dome);
  const [fogColor, fogNear, fogFar] = def.fog || ['#1d1a3c', 300, 1500];
  scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
  const camera = new THREE.PerspectiveCamera(60, 1, 1.5, 3000); // nothing comes nearer; a far near plane keeps depth precise
  camera.rotation.order = 'YXZ';

  const [hSky, hGround] = def.hemi;
  let hI = def.hemi[2];
  const hemi = new THREE.HemisphereLight(hSky, hGround, hI);
  scene.add(hemi);
  const dirs = def.directional.map(([color, intensity, [x, y, z]]) => {
    const l = new THREE.DirectionalLight(color, intensity); l.position.set(x, y, z); scene.add(l);
    return l;
  });
  const hemiBase = hemi.color.clone();
  const lights = [];
  for (let i = 0; i < (tier >= 2 ? 2 : tier ? 1 : 0); i++) {
    const l = new THREE.PointLight('#ffffff', 0, 300, 0);
    scene.add(l); lights.push({ l, I: 0 });
  }

  const dot = dotTexture(), spots = def.spots.slice();
  // Every scene's rangoli is ringed with diyas.
  for (const o of def.objects) if (o.userData.rangoli) for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; spots.push([o.position.x + Math.cos(a) * 3.8, 0.2, o.position.z + Math.sin(a) * 3.8, '#ffa63c']); }
  const stars = starPoints(dot, def.stars ?? (tier ? 700 : 350));
  scene.add(...def.objects, spotPoints(dot, spots), stars);
  if (def.moon !== null) scene.add(moonSprite(def.moon || [330, 380, -1000])); // null: a moonless night (Diwali's)
  if (def.clouds) scene.add(...cloudSprites(def.clouds));
  const zone = def.zone || ZONE;
  // The forecourt's dog and old man, standing on the paving (found by looking straight down, in front of the rangoli).
  let folk = null;
  if (folkModule && def.folk !== false) {
    scene.updateMatrixWorld(true);
    const down = new THREE.Raycaster(new THREE.Vector3(0, 30, (zone.z0 + zone.z1) / 2 + 9), new THREE.Vector3(0, -1, 0));
    const floor = down.intersectObjects(def.objects, true).find((h) => h.point.y < 1.2);
    folk = folkModule.build({
      tier, zone, ground: (floor ? floor.point.y : 2 * LAYER) + 0.01,
      view: { project: (x, y, z, out) => api.project(x, y, z, out), ppm: (d) => api.ppm(d), frame: () => ({ w: W, bottom: (horizon + 0.16) * H }), floor: (sx, sy) => api.ground(sx, sy) },
      sound: (name, x, y, z) => { const p = onFolk && api.project(x, y, z); if (p) onFolk(name, clamp((p[0] / W) * 2 - 1, -1, 1), p[2]); },
    });
    scene.add(...folk.objects);
  }

  // Camera: you stand on the forecourt and look around (yaw, pitch) and step forward or back (pinch).
  const look = { yaw: 0, pitch: 0, z: CAM_Z.start, tYaw: 0, tPitch: 0, tZ: CAM_Z.start, tilt: 0, maxPitch: 0.42 };
  let W = 1, H = 1, horizon = 0.45, dirty = true, version = 0, lost = false;
  const v3 = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function place() {
    const fov = (camera.fov * Math.PI) / 180;
    // Look down just enough that the horizon sits at `horizon` (a fraction of the screen height), above the controls.
    const base = Math.atan(((horizon - 0.5) / 0.5) * Math.tan(fov / 2));
    camera.position.set(0, EYE, look.z);
    camera.rotation.set(base + look.pitch + look.tilt * 0.62, look.yaw, 0);
    camera.updateMatrixWorld();
  }
  // Only a loss the system caused is reported (dispose() frees the context on purpose); the game rebuilds the scene on a
  // new canvas rather than waiting for this one to be restored.
  canvas.addEventListener('webglcontextlost', () => { if (lost) return; lost = true; if (onLost) onLost(api); });

  const glow = { I: 0, c: new THREE.Color() };
  // What an animated scene may change as it runs (see def.animate): the sky, the fog, the base light, the sun and
  // floodlights it asked for, and how bright the stars are.
  const env = {
    tier,
    get height() { return renderer.domElement.height; }, // drawing-buffer pixels, for point sizes
    setSky(colors) { dome.userData.paint(colors); scene.background.set(colors[0]); },
    setFog(color) { scene.fog.color.set(color); },
    setHemi(sky, ground, I) { hemiBase.set(sky); hemi.groundColor.set(ground); hI = I; if (!glow.I) { hemi.color.copy(hemiBase); hemi.intensity = I; } },
    dirs,
    setStars(a) { stars.material.opacity = a; stars.visible = a > 0.01; },
  };
  const api = {
    id, zone,
    get version() { return version; },
    resize(w, h, dpr, horizonFrac) {
      W = w; H = h; horizon = clamp(horizonFrac || 0.45, 0.3, 0.7);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w > h ? 46 : 60;
      camera.updateProjectionMatrix();
      place(); dirty = true; version++;
    },
    // Drag to look around: relative turns, in radians.
    turn(dYaw, dPitch) {
      look.tYaw = clamp(look.tYaw + dYaw, -1.05, 1.05);
      look.tPitch = clamp(look.tPitch + dPitch, -0.12, look.maxPitch);
    },
    // How far up you may look: little in Ground mode, so the crackers stay in view.
    setMaxPitch(v) { look.maxPitch = v; look.tPitch = Math.min(look.tPitch, v); },
    // Pinch: >1 steps forward.
    zoom(f) { look.tZ = clamp(look.tZ / f, CAM_Z.near, CAM_Z.far); },
    reset() { look.tYaw = look.tPitch = 0; look.tZ = CAM_Z.start; },
    // Tells an animated scene what the game is doing (e.g. 'launch' when a show starts).
    cue(name) { if (def.cue) def.cue(name, env); },
    // The forecourt's dog and old man (world3d-folk.js): shown or put away, whether a show is on and the crackers standing
    // (pinned at it.an), which they keep clear of; something loud at a world point (null: overhead); a show worth
    // applauding; a tap (true when it touched one of them).
    setFolk(on, busy, crackers) { if (folk) folk.set(on, busy, crackers); },
    startle(pos, power, kind) { if (folk) folk.startle(pos, power, kind); },
    cheer() { if (folk) folk.cheer(); },
    pet(sx, sy) { return !!folk && folk.pet(sx, sy); },
    // Fetch with the dog: a finger down on it (true when it is), dragged out with its ball, and let go to throw it.
    dogGrab(sx, sy) { return !!folk && folk.grab(sx, sy); },
    dogDrag(sx, sy) { if (folk) folk.dragBall(sx, sy); },
    dogThrow(sx, sy) { if (folk) folk.throwBall(sx, sy); },
    get folk() { return folk && folk.state; },
    // A launch looks up after the rocket (0..1).
    setTilt(t) { if (Math.abs(t - look.tilt) > 1e-5) { look.tilt = t; place(); dirty = true; version++; } },
    /** Eases the camera and the burst light; returns true when the camera moved this frame. */
    update(dt) {
      const k = 1 - Math.exp(-dt * 14);
      let moved = false;
      for (const [a, b] of [['yaw', 'tYaw'], ['pitch', 'tPitch'], ['z', 'tZ']]) {
        const d = look[b] - look[a];
        if (Math.abs(d) > 1e-5) { look[a] += d * k; moved = true; } else look[a] = look[b];
      }
      if (moved) { place(); dirty = true; version++; }
      // An animated scene (a fountain, swaying trees, an evening drawing in) asks for a frame when it has changed.
      if (def.animate && def.animate(dt, env)) dirty = true;
      if (folk && folk.update(dt, camera)) dirty = true; // the dog and the old man, while they move on screen
      for (const L of lights) {
        if (L.I > 0.01) { L.I *= Math.exp(-dt * 2.6); L.l.intensity = L.I; dirty = true; }
        else if (L.I) { L.I = 0; L.l.intensity = 0; dirty = true; }
      }
      // Every burst also tints the whole night a little, the only light the low tier has.
      if (glow.I > 0.005) { glow.I *= Math.exp(-dt * 2.4); hemi.color.copy(hemiBase).lerp(glow.c, Math.min(0.55, glow.I * 0.22)); hemi.intensity = hI + Math.min(1.2, glow.I * 0.5); dirty = true; }
      else if (glow.I) { glow.I = 0; hemi.color.copy(hemiBase); hemi.intensity = hI; dirty = true; }
      return moved;
    },
    /** A burst or a burning cracker lights the scene: colour, strength (about 1 for a big burst), world position. */
    light(hex, amount, pos) {
      const c = new THREE.Color(hex), tot = glow.I + amount;
      glow.c.lerp(c, tot ? amount / tot : 1); glow.I = Math.min(4, tot);
      dirty = true;
      if (!lights.length || !pos) return;
      v3.set(pos.x, pos.y, pos.z);
      let best = lights[0];
      for (const L of lights) {
        if (L.I > 0.05 && L.l.position.distanceTo(v3) < 30) { best = L; break; }
        if (L.I < best.I) best = L;
      }
      const w = best.I > 0.05 ? amount / (best.I + amount) : 1;
      best.l.color.lerp(c, w);
      best.l.position.lerp(v3, w);
      best.I = Math.min(6, best.I + amount * 2.4); best.l.intensity = best.I;
    },
    /** Screen position (CSS px) and distance of a world point; null when it is behind the camera. */
    project(x, y, z, out = []) {
      v3.set(x, y, z);
      const d = v3.distanceTo(camera.position);
      v3.project(camera);
      if (v3.z > 1 || v3.z < -1) return null;
      out[0] = (v3.x + 1) * 0.5 * W; out[1] = (1 - v3.y) * 0.5 * H; out[2] = d;
      return out;
    },
    /** The world point `dist` metres away along the screen ray through (sx, sy). */
    unproject(sx, sy, dist) {
      ndc.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.at(dist, new THREE.Vector3());
    },
    /** Where a tap at (sx, sy) meets the forecourt, kept inside the cracker zone. hit is false for taps on the sky;
     *  inside is true only when the ground there is in the zone itself (hit allows a little slack round its edges). */
    ground(sx, sy) {
      ndc.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = new THREE.Vector3(), m = 3; // a little slack round the edges
      const hit = !!ray.ray.intersectPlane(groundPlane, p) && p.x > zone.x0 - m && p.x < zone.x1 + m && p.z > zone.z0 - m * 4 && p.z < zone.z1 + m * 4;
      const inside = hit && p.x >= zone.x0 && p.x <= zone.x1 && p.z >= zone.z0 && p.z <= zone.z1;
      if (!hit) p.set(0, 0, (zone.z0 + zone.z1) / 2);
      return { x: clamp(p.x, zone.x0, zone.x1), z: clamp(p.z, zone.z0, zone.z1), hit, inside };
    },
    /** Runs fn with the camera where it is easing to (after a drag or reset()), so a placement matches the view as it
     *  will settle; the camera is put back as it was. */
    atRest(fn) {
      const was = [look.yaw, look.pitch, look.z];
      look.yaw = look.tYaw; look.pitch = look.tPitch; look.z = look.tZ; place();
      try { return fn(); } finally { [look.yaw, look.pitch, look.z] = was; place(); }
    },
    /** Pixels per metre at distance d. */
    ppm(d) { return H / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.1, d)); },
    camera: () => camera.position,
    render(force) {
      if (lost || (!dirty && !force)) return false;
      dirty = false;
      renderer.render(scene, camera);
      return true;
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m) for (const mm of [].concat(m)) { if (mm.map) mm.map.dispose(); mm.dispose(); }
      });
      if (scene.background && scene.background.dispose) scene.background.dispose();
      lost = true;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  return api;
}
