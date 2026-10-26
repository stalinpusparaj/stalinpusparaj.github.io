/* Light Up the Skies — the 3D forecourt's two regulars (not a scene: world3d.js adds them to every scene; the game shows
   them in Ground mode): a little street dog with a marigold collar and an old man with a walking stick. They stroll the
   front of the forecourt either side of the crackers, near you, never through the middle where the crackers and the
   rangoli are, and never stopping where a cracker stands. A cracker lit near them sends the dog bolting with a bark (to
   hide behind the old man, if he is the safer side) while the old man covers his ears; a burst overhead gets a fist
   shaken at the sky. Once it has been quiet a moment they wander back, the dog every other time proudly carrying a spent
   casing to the old man. A good show gets a round of applause. The dog plays with you: taps on it are tricks in turn (sit
   and wag, a spinning jump, a roll over, begging), and a drag from it pulls out a ball it crouches for; let go and it
   races after the ball, leaps to catch it and brings it back to you. A tap on the old man has him wave his stick at you.
   (Taps on them are theirs; taps anywhere else still place crackers.)

   Built for phones: both are one merged mesh of flat-coloured parts (a few hundred triangles each, one draw call), posed
   by a small vertex shader in which each vertex follows its part's matrix; their blob shadows are a second mesh (not on
   the low tier). They ask for a frame only while they move on screen, at most 15, 30 or 60 times a second by tier (8 on
   a phone already under 30), and not at all while they stand still. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp } from './world3d.js';

const DOG = 1.75, MAN = 1.4; // larger than life, as the crackers are, so they read on a phone
// Parts: each vertex follows its part's matrix (rows of an affine matrix, in partRows).
const D_BODY = 0, D_HEAD = 1, D_EAR = 2 /* 2, 3 */, D_LEG = 4 /* 4..7: front left, front right, back left, back right */,
  D_TAIL = 8, D_TONGUE = 9, D_TUBE = 10;
const M_TORSO = 11, M_HEAD = 12, M_LEG = 13 /* 13, 14 */, M_ARM = 15 /* upper, fore; left 15, 16; right 17, 18 */, M_STICK = 19;
const D_BALL = 20; // the dog's ball, for fetch
const PARTS = 21;
const SPEED = { walk: 1.15, trot: 2.3, run: 5.2, man: 0.5 };
const SHADOW = [0.24 * DOG, 0.42 * DOG, 0.34 * MAN, 0.34 * MAN]; // blob shadows' half width and length: the dog's, the old man's
// Bubbles over their heads, from one sheet: no words, so nothing to translate.
const BANG = 0, BARK = 1, HEART = 2, GRUMBLE = 3, CLAP = 4, NOTE = 5, SWEAT = 6;

const C = {
  coat: '#c98a48', coatDark: '#a5682f', cream: '#f3e2c2', dark: '#1d1512', pink: '#ff7d8e', collar: '#ff8f1f', gold: '#ffd34d',
  tube: '#c8352c', char: '#2b1e18', kurta: '#efe7d6', jacket: '#7d2e27', skin: '#b9784d', skinDark: '#9c6039', white: '#f5f2ea',
  pyjama: '#f3eee2', sandal: '#5b3920', wood: '#7a4f27', ball: '#d9f23c',
};

// ---------- Geometry: flat-shaded parts, merged ----------
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tN = new THREE.Vector3(), tE = new THREE.Vector3();
const tCol = new THREE.Color();
const mat = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n) => new THREE.CylinderGeometry(r1, r0, h, n); // r0 at the bottom
const ball = (r) => new THREE.IcosahedronGeometry(r, 0);
const cone = (r, h, n) => new THREE.ConeGeometry(r, h, n);
class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.part = []; this.tris = [0, 0]; }
  // geo, placed in its part's own space by m, coloured `color` (or by color(v, n), for a two-tone coat).
  add(part, geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      tA.fromBufferAttribute(p, i); tB.fromBufferAttribute(p, i + 1); tC.fromBufferAttribute(p, i + 2);
      tN.subVectors(tB, tA).cross(tE.subVectors(tC, tA));
      if (tN.lengthSq() < 1e-14) continue;
      tN.normalize();
      for (const v of [tA, tB, tC]) {
        tCol.set(typeof color === 'function' ? color(v, tN) : color);
        this.pos.push(v.x, v.y, v.z); this.nor.push(tN.x, tN.y, tN.z); this.col.push(tCol.r, tCol.g, tCol.b); this.part.push(part);
      }
      this.tris[part < M_TORSO || part === D_BALL ? 0 : 1]++;
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
}
// The dog faces +z with its feet at y = 0; each part is built round its pivot.
function dogParts(k) {
  const coat = (v, n) => (n.y < -0.4 ? C.cream : C.coat); // a pale belly
  k.add(D_BODY, cyl(0.15, 0.15, 0.56, 7), coat, mat(0, 0, 0, Math.PI / 2))
    .add(D_BODY, ball(0.16), coat, mat(0, 0.01, -0.25))
    .add(D_BODY, ball(0.135), C.cream, mat(0, -0.02, 0.24, 0, 0, 0, 1, 1.05, 0.9)) // the white chest
    .add(D_BODY, cyl(0.085, 0.075, 0.22, 6), C.coat, mat(0, 0.1, 0.27, 0.5))
    .add(D_BODY, new THREE.TorusGeometry(0.095, 0.03, 3, 8), C.collar, mat(0, 0.11, 0.29, -1.07)) // a marigold collar, for Diwali
    .add(D_BODY, ball(0.032), C.gold, mat(0, 0.03, 0.375)); // and its bell
  k.add(D_HEAD, ball(0.15), C.coat, mat(0, 0.06, 0.05, 0, 0, 0, 1, 0.9, 1.05))
    .add(D_HEAD, box(0.13, 0.095, 0.15), C.cream, mat(0, -0.005, 0.19))
    .add(D_HEAD, box(0.055, 0.03, 0.04), C.dark, mat(0, 0.04, 0.262)) // the nose, on top of the muzzle's tip
    .add(D_HEAD, box(0.036, 0.044, 0.02), C.dark, mat(0.066, 0.09, 0.165))
    .add(D_HEAD, box(0.036, 0.044, 0.02), C.dark, mat(-0.066, 0.09, 0.165));
  for (const s of [1, -1]) k.add(D_EAR + (s > 0 ? 0 : 1), cone(0.058, 0.15, 4), C.coatDark, mat(0, 0.07, 0, 0, Math.PI / 4, -0.22 * s));
  for (let i = 0; i < 4; i++) k.add(D_LEG + i, cyl(0.035, 0.042, 0.3, 5), C.coat, mat(0, -0.15, 0)).add(D_LEG + i, box(0.075, 0.055, 0.1), C.cream, mat(0, -0.31, 0.02));
  k.add(D_TAIL, cone(0.042, 0.3, 5), (v) => (v.length() > 0.24 ? C.cream : C.coat), mat(0, 0, 0, -0.7).multiply(mat(0, 0.15, 0)));
  k.add(D_TONGUE, box(0.05, 0.014, 0.08), C.pink, mat(0, 0, 0.035, 0.5));
  // A spent sky-shell tube, for fetching: red, a gold band, a charred end.
  k.add(D_TUBE, cyl(0.055, 0.055, 0.34, 7), (v) => (v.x > 0.13 ? C.char : Math.abs(v.x) < 0.035 ? C.gold : C.tube), mat(0, 0, 0, 0, 0, Math.PI / 2));
  // A tennis ball, for fetch.
  k.add(D_BALL, new THREE.IcosahedronGeometry(0.07, 1), (v) => (Math.abs(v.y) < 0.014 ? C.white : C.ball));
}
// The old man faces +z with his feet at y = 0: a cream kurta, a maroon jacket over a round belly, white hair and moustache.
function manParts(k) {
  k.add(M_TORSO, cyl(0.25, 0.2, 0.7, 7), C.kurta, mat(0, 0.05, 0))
    .add(M_TORSO, cyl(0.225, 0.215, 0.5, 7), C.jacket, mat(0, 0.25, 0))
    .add(M_TORSO, ball(0.17), C.jacket, mat(0, 0.14, 0.08, 0, 0, 0, 1, 1, 0.9))
    .add(M_TORSO, box(0.025, 0.36, 0.02), C.gold, mat(0, 0.27, 0.205))
    .add(M_TORSO, cyl(0.055, 0.055, 0.1, 6), C.skin, mat(0, 0.54, 0.01));
  k.add(M_HEAD, ball(0.13), C.skin, mat(0, 0.12, 0, 0, 0, 0, 1, 1.06, 1))
    .add(M_HEAD, box(0.04, 0.055, 0.05), C.skinDark, mat(0, 0.11, 0.13))
    .add(M_HEAD, box(0.035, 0.035, 0.02), C.dark, mat(0.05, 0.15, 0.118))
    .add(M_HEAD, box(0.035, 0.035, 0.02), C.dark, mat(-0.05, 0.15, 0.118));
  for (const s of [1, -1]) {
    k.add(M_HEAD, box(0.078, 0.032, 0.035), C.white, mat(0.037 * s, 0.07, 0.125, 0, 0, -0.28 * s)) // the moustache
      .add(M_HEAD, box(0.058, 0.02, 0.02), C.white, mat(0.05 * s, 0.19, 0.118, 0, 0, 0.15 * s)) // bushy brows
      .add(M_HEAD, ball(0.065), C.white, mat(0.112 * s, 0.11, -0.03)); // the hair left round a bald top
  }
  k.add(M_HEAD, ball(0.08), C.white, mat(0, 0.1, -0.085, 0, 0, 0, 1.3, 0.8, 0.7));
  for (const s of [0, 1]) {
    k.add(M_LEG + s, cyl(0.065, 0.075, 0.8, 6), C.pyjama, mat(0, -0.4, 0)).add(M_LEG + s, box(0.1, 0.045, 0.22), C.sandal, mat(0, -0.82, 0.04));
    k.add(M_ARM + s * 2, cyl(0.055, 0.065, 0.3, 6), C.kurta, mat(0, -0.15, 0));
    k.add(M_ARM + s * 2 + 1, cyl(0.05, 0.055, 0.26, 6), C.kurta, mat(0, -0.13, 0)).add(M_ARM + s * 2 + 1, ball(0.055), C.skin, mat(0, -0.3, 0));
  }
  // The walking stick, held at its crook.
  k.add(M_STICK, cyl(0.02, 0.022, 0.86, 5), C.wood, mat(0, -0.375, 0)).add(M_STICK, box(0.04, 0.04, 0.15), C.wood, mat(0, 0.05, 0.05));
}

// Each vertex follows its part (three vec4 rows per part); a touch of their own colour glows, so they read at night.
function folkMaterial(rows) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (s) => {
    s.uniforms.partRows = { value: rows };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float part;\nuniform vec4 partRows[${PARTS * 3}];`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        int pk = int(part + 0.5) * 3;
        vec4 r0 = partRows[pk], r1 = partRows[pk + 1], r2 = partRows[pk + 2];
        objectNormal = vec3(dot(r0.xyz, objectNormal), dot(r1.xyz, objectNormal), dot(r2.xyz, objectNormal));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = vec3(dot(r0, vec4(transformed, 1.0)), dot(r1, vec4(transformed, 1.0)), dot(r2, vec4(transformed, 1.0)));`);
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.24;');
  };
  return m;
}

function bubbleSheet() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  const slot = (i, fn) => { g.save(); g.translate(i * 64 + 32, 32); fn(); g.restore(); };
  const star = (n, r0, r1, x = 0, y = 0) => { g.beginPath(); for (let k = 0; k < n * 2; k++) { const a = (k / n) * Math.PI - Math.PI / 2, r = k % 2 ? r0 : r1; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
  g.lineJoin = g.lineCap = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle';
  slot(BANG, () => { star(9, 17, 28); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#3a1d08'; g.stroke(); g.fillStyle = '#3a1d08'; g.font = '900 32px sans-serif'; g.fillText('!', 0, 2); });
  slot(BARK, () => { g.strokeStyle = '#fff1cf'; g.lineWidth = 5; for (const r of [9, 18, 27]) { g.beginPath(); g.arc(-20, 0, r, -0.75, 0.75); g.stroke(); } });
  slot(HEART, () => { g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-36, -2, -16, -28, 0, -10); g.bezierCurveTo(16, -28, 36, -2, 0, 22); g.fillStyle = '#ff5f8a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a1030'; g.stroke(); });
  slot(GRUMBLE, () => {
    g.beginPath();
    for (const [x, y, r] of [[-14, 2, 15], [0, -8, 16], [15, 2, 14], [0, 10, 13]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
    g.fillStyle = '#ffffff'; g.fill(); g.fillStyle = '#c4161c'; g.font = '900 19px sans-serif'; g.fillText('#@!', 0, 1);
  });
  slot(CLAP, () => { g.fillStyle = '#ffd86b'; for (const [x, y, r] of [[-12, -8, 15], [13, -12, 10], [8, 13, 12], [-15, 15, 7]]) { star(4, r * 0.28, r, x, y); g.fill(); } });
  slot(NOTE, () => { g.fillStyle = '#fff1cf'; g.beginPath(); g.ellipse(-6, 14, 9, 7, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(1, -20, 4, 34); g.beginPath(); g.moveTo(5, -20); g.quadraticCurveTo(22, -12, 15, 2); g.quadraticCurveTo(16, -10, 5, -10); g.fill(); });
  slot(SWEAT, () => { g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(14, -4, 16, 8, 0, 20); g.bezierCurveTo(-16, 8, -14, -4, 0, -24); g.fillStyle = '#8fdcff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1d5f8a'; g.stroke(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  t.repeat.set(1 / 8, 1);
  return t;
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (o, k, key, to) => { o[key] += (to - o[key]) * k; };

/** The dog and the old man for a scene's cracker `zone`, standing on the ground at height `ground`. view: { project,
    ppm, frame, floor } from the engine (frame() is { w, bottom }: the screen's width and where the ground stops showing
    above the controls; floor(sx, sy) is where a screen point meets the forecourt, { x, z, hit }). sound(name, x, y, z) plays 'bark', 'yip', 'grumble' or 'clap' from there. */
export function build({ tier, zone, ground = 0.17, view, sound = () => {} }) {
  // Where they walk: the zone, kept off its edges, round a narrow oval down its middle, where crackers stand in the view
  // you start with and the rangoli lies; either side of it, near you, is where they like to be.
  const R = { x0: zone.x0 + 0.7, x1: zone.x1 - 0.7, z0: zone.z0 + 1, z1: zone.z1 - 0.4 }, depth = zone.z1 - zone.z0;
  const K = { x: (zone.x0 + zone.x1) / 2, z: zone.z1 - depth * 0.35, a: clamp((zone.x1 - zone.x0) * 0.15, 2.6, 3.4), b: depth * 0.37 };

  const kit = new Kit();
  dogParts(kit); manParts(kit);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(kit.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(kit.nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(kit.col, 3));
  geo.setAttribute('part', new THREE.Float32BufferAttribute(kit.part, 1));
  const rows = new Float32Array(PARTS * 12), drawn = new Float32Array(PARTS * 12).fill(NaN);
  const mesh = new THREE.Mesh(geo, folkMaterial(rows));
  mesh.frustumCulled = false; // its parts are placed in the shader
  mesh.userData.folk = true;
  const objects = [mesh];
  // Their blob shadows: two quads on the ground, moved with them (none on the low tier).
  let shadow = null;
  if (tier) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
    shadow = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    shadow.frustumCulled = false;
    objects.push(shadow);
  }
  const sheet = bubbleSheet();
  const bubble = () => {
    const t = sheet.clone();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    s.center.set(0.5, 0); s.renderOrder = 10; s.visible = false;
    objects.push(s);
    return s;
  };

  const walker = (top) => ({ x: 0, z: 0, yaw: 0, v: 0, speed: 0, tx: 0, tz: 0, side: 1, act: '', t: 0, dur: 0, phase: 0, amp: 0,
    from: null, bub: null, sprite: bubble(), top, said: -9 });
  const dog = walker(0.87 * DOG), man = walker(1.77 * MAN), both = [dog, man];
  // The dog's pose, eased towards what it is doing.
  Object.assign(dog, { p: { sit: 0, lie: 0, roll: 0, ear: 0, head: 0, tuck: 0, hop: 0, wag: 0.2, tongue: 0, tremble: 0, wiggle: 0, lean: 0, leap: 0, beg: 0, bow: 0 }, wagT: 0, wagRate: 4, tube: 0, tubeAt: null, barks: 0, spin: 0 });
  // The ball: 0 put away, 1 in your finger, 2 flying, 3 on the ground, 4 in the dog's mouth, 5 brought back to you.
  const ball = { mode: 0, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, tx: 0, tz: 0, t: 0, dur: 1 };
  // The old man's: how much of each gesture is showing (they blend), and his stick in hand or propped against him.
  Object.assign(man, { w: { ears: 0, fist: 0, glare: 0, grumble: 0, clap: 0, shoo: 0 }, want: { ears: 0, fist: 0, glare: 0, grumble: 0, clap: 0, shoo: 0 }, prop: false, look: 0, fistAt: -9, earsAt: -9 });

  let on = true, busy = false, shown = true, placed = false, clock = 0, quiet = 99, acc = 0, lastSeen = false, bubbles = false, slow = 0;
  let spent = false, fetches = 0, cheerAt = -99, pets = 0, petAt = -9, crackers = [];
  const cam = new THREE.Vector3(), fp = [];

  // ---------- Where to go ----------
  const inside = (x, z) => ((x - K.x) / K.a) ** 2 + ((z - K.z) / K.b) ** 2;
  // On screen, above the controls (the feet; a little margin round the sides).
  const seen = (x, z) => { const f = view.frame(), p = view.project(x, 0, z, fp); return !!p && p[0] > 24 && p[0] < f.w - 24 && p[1] < f.bottom - 6 && p[1] > 0; };
  // A cracker stands within 1.6 m of (x, z).
  const byCracker = (x, z) => { for (const it of crackers) if (it.an && Math.hypot(it.an.wx - x, it.an.wz - z) < 1.6) return true; return false; };
  // Nearer you is better: they are there to be seen.
  const front = (x, z) => -0.5 * Math.hypot(x - cam.x, z - cam.z);
  // The best of a few spots in the walk (score(x, z) is higher for better spots; spots on screen and clear of the
  // crackers come first).
  function spot(score = (x, z) => front(x, z) + Math.random() * 6) {
    let best = null, top = -Infinity;
    for (let i = 0; i < 20; i++) {
      const x = R.x0 + Math.random() * (R.x1 - R.x0), z = R.z0 + Math.random() * (R.z1 - R.z0);
      if (inside(x, z) < 1.25) continue;
      const s = (seen(x, z) ? 100 : 0) + (byCracker(x, z) ? -60 : 0) + score(x, z);
      if (s > top) { top = s; best = [x, z]; }
    }
    return best || [R.x0 + 0.3, K.z];
  }
  const near = (x, z, r0, r1) => spot((sx, sz) => { const d = Math.hypot(sx - x, sz - z); return (d < r0 ? -d : d > r1 ? -d : 10 + Math.random()) + front(sx, sz) * 0.4; });
  function act(w, name, dur = 0) { w.act = name; w.t = 0; w.dur = dur; }
  function go(w, [x, z], speed, name = 'walk') {
    act(w, name); w.tx = x; w.tz = z; w.speed = speed;
    // round the middle the shorter way, unless that is round its near end, which the zone's edge closes
    const a0 = Math.atan2((w.z - K.z) / K.b, (w.x - K.x) / K.a), a1 = Math.atan2((z - K.z) / K.b, (x - K.x) / K.a);
    let arc = wrap(a1 - a0);
    const nearEnd = wrap(Math.PI / 2 - a0);
    if (K.z + K.b > R.z1 && (arc >= 0 ? nearEnd >= 0 && nearEnd <= arc : nearEnd <= 0 && nearEnd >= arc)) arc = -arc;
    w.side = arc >= 0 ? 1 : -1;
  }
  function say(w, icon, life = 1.3) { w.bub = { icon, age: 0, life }; }
  function noise(w, name) { if (clock - w.said < 0.22) return; w.said = clock; sound(name, w.x, w.top * 0.6, w.z); }
  function turn(w, to, dt, rate) { w.yaw += wrap(to - w.yaw) * Math.min(1, dt * rate); }
  const face = (w, x, z, dt, rate = 6) => turn(w, Math.atan2(x - w.x, z - w.z), dt, rate);
  // Steps towards the target; true once there. Near the middle the part of a step heading inwards is dropped, so they
  // go round it, never through.
  function moveTo(w, dt, rate) {
    let dx = w.tx - w.x, dz = w.tz - w.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) return true;
    dx /= dist; dz /= dist;
    const u = (w.x - K.x) / K.a, v = (w.z - K.z) / K.b;
    if (u * u + v * v < 1.7) {
      let nx = u / K.a, nz = v / K.b; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if (dx * nx + dz * nz < 0) { dx = -nz * w.side; dz = nx * w.side; } // heading inwards: along its edge, the chosen way
    }
    turn(w, Math.atan2(dx, dz), dt, rate);
    const step = Math.min(dist, w.v * dt);
    w.x += Math.sin(w.yaw) * step; w.z += Math.cos(w.yaw) * step;
    const r = inside(w.x, w.z);
    if (r < 1) { const k = 1 / Math.sqrt(r || 1e-6); w.x = K.x + (w.x - K.x) * k; w.z = K.z + (w.z - K.z) * k; }
    w.x = clamp(w.x, R.x0, R.x1); w.z = clamp(w.z, R.z0, R.z1);
    // (kept off the zone's edge, a point by the oval's near end can land back in it: out sideways)
    if (inside(w.x, w.z) < 1) w.x = K.x + Math.sign(w.x - K.x || 1) * K.a * Math.sqrt(Math.max(0, 1 - ((w.z - K.z) / K.b) ** 2)) * 1.001;
    return false;
  }
  const calm = () => quiet > 1.4 && !busy;

  // ---------- The dog ----------
  function nextDog() {
    const r = Math.random(), byMan = Math.hypot(dog.x - man.x, dog.z - man.z) < 3.5;
    if (cheerAt > clock - 8 && man.act === 'clap') { act(dog, 'happy', 2); say(dog, HEART); return; }
    if (!byMan || r < 0.35) go(dog, near(man.x, man.z, 1.2, 3), SPEED.walk * (Math.random() < 0.12 ? 2 : 1));
    else if (r < 0.55) act(dog, 'sniff', 1.4 + Math.random() * 1.6);
    else if (r < 0.82) act(dog, 'sit', 2 + Math.random() * 3);
    else go(dog, spot(), SPEED.walk);
  }
  // Off it goes, away from the noise (a burst overhead: away from where it stood): behind the old man if he is the safer
  // side, else well off to one side, as far as it can see.
  function flee() {
    const f = dog.from, fx = f ? f.x : dog.x, fz = f ? f.z : dog.z;
    const manFar = Math.hypot(man.x - fx, man.z - fz), dogFar = Math.hypot(dog.x - fx, dog.z - fz);
    if (f && manFar > dogFar + 1.5 && manFar > 5 && Math.hypot(man.x - dog.x, man.z - dog.z) < 12) {
      const l = manFar || 1;
      go(dog, [man.x + ((man.x - fx) / l) * 0.9, man.z + ((man.z - fz) / l) * 0.9], SPEED.run, 'flee');
    } else go(dog, spot((x, z) => Math.hypot(x - fx, z - fz) + 0.6 * Math.abs(x - fx) + 0.4 * Math.hypot(x - dog.x, z - dog.z) + front(x, z) * 0.3), SPEED.run, 'flee'); // sideways and far, not just behind it
    dog.barks = 0;
  }
  // Back once it is quiet: with a spent casing for the old man after a cracker lit (the first time, then every other).
  function comeBack() {
    if (spent && fetches++ % 2 === 0) { go(dog, near(man.x, man.z, 0.6, 1.4), SPEED.trot, 'fetch'); dog.tube = 1; }
    else go(dog, near(man.x, man.z, 1.2, 2.6), SPEED.walk * 1.4);
    spent = false;
  }
  function thinkDog(dt) {
    const d = dog, p = d.p, k = Math.min(1, dt * 9);
    d.t += dt;
    let speed = 0, sit = 0, lie = 0, roll = 0, ear = 0, head = 0, tuck = 0, hop = 0, wag = 0, tongue = 0, tremble = 0, wiggle = 0, lean = 0, leap = 0, beg = 0, bow = 0;
    d.wagRate = 4; d.spin = 0; // (only the jump turns it, step by step)
    switch (d.act) {
      case 'walk': speed = d.speed; wag = 0.25; ear = 0.1; tongue = d.speed > 2 ? 1 : 0; if (moveTo(d, dt, 7) || d.t > 20) nextDog(); break;
      case 'sniff': head = 0.6 + 0.1 * Math.sin(d.t * 11); wag = 0.15; if (d.t > d.dur) nextDog(); break;
      case 'sit': sit = 1; if (d.t > d.dur) nextDog(); break;
      case 'alert':
        ear = 1; head = -0.3; hop = Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * 0.14;
        if (d.from) face(d, d.from.x, d.from.z, dt, 12);
        if (d.t > d.dur) flee();
        break;
      case 'flee':
        speed = SPEED.run; ear = -1; tuck = 1; lean = 0.12;
        if (d.barks < 2 && d.t > 0.4 + d.barks * 0.45) { d.barks++; noise(d, 'bark'); say(d, BARK, 0.5); }
        if (moveTo(d, dt, 10) || d.t > 3.2) { act(d, 'cower'); say(d, SWEAT, 1.6); }
        break;
      case 'cower':
        lie = 1; ear = -1; tuck = 1; head = 0.3; tremble = tier ? 1 : 0;
        face(d, cam.x, cam.z, dt, 4);
        if (calm()) comeBack();
        break;
      case 'fetch':
        speed = SPEED.trot; wag = 0.6; d.wagRate = 8; ear = 0.3; head = -0.15;
        d.tx = man.x + Math.sin(man.yaw) * 0.9; d.tz = man.z + Math.cos(man.yaw) * 0.9; // to the old man's feet
        if (moveTo(d, dt, 8) || d.t > 9) {
          act(d, 'drop', 2.4); d.tube = 2;
          d.tubeAt = { x: d.x + Math.sin(d.yaw) * 0.3 * DOG, z: d.z + Math.cos(d.yaw) * 0.3 * DOG, yaw: d.yaw + Math.PI / 2, t: 0 };
          if (calmMan()) { act(man, 'grumble', 1.6); say(man, GRUMBLE); noise(man, 'grumble'); }
        }
        break;
      case 'drop': sit = 1; wag = 0.8; d.wagRate = 10; tongue = 1; face(d, man.x, man.z, dt); if (d.t > d.dur) nextDog(); break;
      case 'pet': case 'jump': case 'roll': case 'beg':
        // A hop aside first (the tap may have put a cracker where it stood), then the trick.
        if (d.t < 0.35) { speed = 4; hop = Math.sin((d.t / 0.35) * Math.PI) * 0.12; moveTo(d, dt, 16); break; }
        tongue = 1; wag = 0.9; d.wagRate = 11; ear = 0.35;
        if (d.act === 'roll') { lie = 1; roll = 1; wiggle = 1; wag = 0.5; }
        else if (d.act === 'jump' && d.t < 1.25) { // up, a full turn in the air, and down
          const f = (d.t - 0.35) / 0.9;
          hop = Math.sin(f * Math.PI) * 0.6; leap = 1; d.spin = f * Math.PI * 2;
          if (d.t - dt < 0.75 && d.t >= 0.75) noise(d, 'yip');
        } else if (d.act === 'beg') { sit = 1; beg = 1; head = -0.35; face(d, cam.x, cam.z, dt, 8); }
        else { d.spin = 0; sit = 1; head = -0.25; face(d, cam.x, cam.z, dt, 8); }
        if (d.t > d.dur) { d.spin = 0; nextDog(); }
        break;
      case 'eager': // a ball in your finger: a play bow, eyes on it, little bounces
        bow = 1; wag = 1; d.wagRate = 12; tongue = 1; ear = 0.6; hop = Math.abs(Math.sin(d.t * 6)) * 0.04;
        face(d, ball.x, ball.z, dt, 10);
        if (ball.mode !== 1 || d.t > 10) { if (ball.mode === 1) ball.mode = 0; nextDog(); }
        break;
      case 'chase': // after the ball, as fast as it can
        ear = 0.5; tongue = 1; wag = 0.7; d.wagRate = 10; lean = 0.1;
        d.tx = ball.mode === 2 ? ball.tx : ball.x; d.tz = ball.mode === 2 ? ball.tz : ball.z;
        if (Math.hypot(d.tx - d.x, d.tz - d.z) < 0.9 * DOG) {
          face(d, d.tx, d.tz, dt, 10);
          if (ball.mode === 3) { act(d, 'catch', 0.55); noise(d, 'bark'); }
        } else { speed = SPEED.run; moveTo(d, dt, 10); }
        if (ball.mode !== 2 && ball.mode !== 3 || d.t > 8) nextDog();
        break;
      case 'catch': // a leap onto it
        hop = Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * 0.3; leap = 1; speed = 2; tongue = 0; wag = 1; d.wagRate = 12;
        if (d.t < d.dur * 0.5) { d.tx = ball.x; d.tz = ball.z; moveTo(d, dt, 12); } else if (ball.mode === 3) ball.mode = 4;
        if (d.t > d.dur) { ball.mode = 4; go(d, spot((x, z) => front(x, z) * 3 + Math.random()), SPEED.trot, 'bring'); }
        break;
      case 'bring': // back to you, proud
        speed = SPEED.trot; wag = 0.9; d.wagRate = 11; ear = 0.4; head = -0.15;
        if (moveTo(d, dt, 8) || d.t > 9) {
          act(d, 'present', 2.6); ball.mode = 5; ball.t = 0;
          ball.x = d.x + Math.sin(d.yaw) * 0.35 * DOG; ball.z = d.z + Math.cos(d.yaw) * 0.35 * DOG;
          say(d, HEART, 1.4); noise(d, 'yip');
        }
        break;
      case 'present': sit = 1; wag = 1; d.wagRate = 12; tongue = 1; ear = 0.4; head = -0.3; face(d, cam.x, cam.z, dt, 6); if (d.t > d.dur) nextDog(); break;
      case 'happy': hop = Math.abs(Math.sin(d.t * 7)) * 0.16; wag = 0.9; d.wagRate = 11; tongue = 1; ear = 0.4; face(d, cam.x, cam.z, dt); if (d.t > d.dur) nextDog(); break;
      default: nextDog();
    }
    d.v += (speed - d.v) * Math.min(1, dt * 6);
    ease(p, k, 'sit', sit); ease(p, k, 'lie', lie); ease(p, k, 'roll', roll); ease(p, k, 'ear', ear); ease(p, k, 'head', head);
    ease(p, k, 'tuck', tuck); ease(p, k, 'wag', wag); ease(p, k, 'tongue', tongue); ease(p, k, 'tremble', tremble); ease(p, k, 'wiggle', wiggle);
    ease(p, k, 'lean', lean); ease(p, k, 'beg', beg); ease(p, k, 'bow', bow);
    p.hop = hop; p.leap = leap;
    // The ball flies in an arc, bounces once and settles; one left lying is tidied away.
    if (ball.mode === 2) {
      ball.t += dt;
      const f = Math.min(1, ball.t / ball.dur), arc = 0.4 + ball.dur * 1.2;
      ball.x = ball.fx + (ball.tx - ball.fx) * f; ball.z = ball.fz + (ball.tz - ball.fz) * f;
      ball.y = ball.fy * (1 - f) + Math.sin(f * Math.PI) * arc;
      if (f >= 1) { ball.mode = 3; ball.t = 0; }
    } else if (ball.mode === 3 || ball.mode === 5) {
      ball.t += dt;
      ball.y = ball.mode === 3 ? Math.abs(Math.sin(Math.min(1, ball.t / 0.4) * Math.PI)) * 0.25 * (1 - Math.min(1, ball.t / 0.4)) : 0;
      if (ball.t > 6 && d.act !== 'chase' && d.act !== 'catch') ball.mode = 0;
    }
    if (d.tube === 2 && d.tubeAt && (d.tubeAt.t += dt) > 7) d.tube = 0; // the dropped tube is tidied away
  }

  // ---------- The old man ----------
  const calmMan = () => man.act === 'walk' || man.act === 'look' || man.act === '';
  function nextMan() {
    if (cheerAt > clock - 10) { cheerAt = -99; act(man, 'clap', 2.6); say(man, CLAP, 2); noise(man, 'clap'); if (dog.act === 'sit' || dog.act === 'walk' || dog.act === 'sniff') { act(dog, 'happy', 2); say(dog, HEART); } return; }
    if (Math.random() < 0.6) go(man, near(man.x, man.z, 2.5, 8), SPEED.man);
    else { act(man, 'look', 3 + Math.random() * 3); man.look = Math.random() < 0.5 ? Math.PI : Math.atan2(dog.x - man.x, dog.z - man.z); }
  }
  function thinkMan(dt) {
    const m = man, k = Math.min(1, dt * 8);
    m.t += dt;
    let speed = 0;
    const want = m.want;
    for (const key in want) want[key] = 0;
    switch (m.act) {
      case 'walk':
        speed = SPEED.man;
        if (!m.bub && Math.random() < dt * 0.05) say(m, NOTE, 1.6); // he hums as he goes
        if (moveTo(m, dt, 3) || m.t > 30) nextMan(); // (a spot it can't reach: on to the next)
        break;
      case 'look': turn(m, m.look, dt, 2); if (m.t > m.dur) nextMan(); break;
      case 'ears': want.ears = 1; if (m.from) face(m, m.from.x, m.from.z, dt, 3); if (quiet > 1 && !busy) { act(m, 'grumble', 1.4); say(m, GRUMBLE); noise(m, 'grumble'); } break;
      case 'fist': want.fist = 1; if (m.from) face(m, m.from.x, m.from.z, dt, 3); if (m.t > m.dur) act(m, clock - m.earsAt < 2.5 ? 'ears' : 'glare'); break;
      case 'glare':
        want.glare = 1;
        if (quiet > 1 && !busy) { act(m, 'grumble', 1.4); say(m, GRUMBLE); noise(m, 'grumble'); }
        else if (m.t > 1.6) { act(m, 'fist', 1.4); say(m, GRUMBLE); } // and another fist for the sky, while the show lasts
        break;
      case 'grumble': want.grumble = 1; if (m.t > m.dur) nextMan(); break;
      case 'clap': want.clap = 1; face(m, K.x, K.z, dt, 3); if (m.t > m.dur) nextMan(); break;
      case 'shoo': want.shoo = 1; face(m, cam.x, cam.z, dt, 6); if (m.t > m.dur) nextMan(); break;
      default: nextMan();
    }
    m.v += (speed - m.v) * Math.min(1, dt * 4);
    for (const key in want) ease(m.w, k, key, want[key]);
    m.prop = m.w.ears + m.w.clap > 0.5; // both hands busy: the stick leans on him
  }

  // ---------- Posing ----------
  const eu = new THREE.Euler(), qu = new THREE.Quaternion(), ve = new THREE.Vector3(), sc = new THREE.Vector3();
  const mRoot = new THREE.Matrix4(), mBody = new THREE.Matrix4(), mHead = new THREE.Matrix4(), mArm = new THREE.Matrix4(), mFore = new THREE.Matrix4(), mOut = new THREE.Matrix4();
  // out = parent · T(x, y, z) · R(rx, ry, rz) · S(s)
  function local(out, parent, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, order = 'XYZ') {
    eu.set(rx, ry, rz, order); qu.setFromEuler(eu); ve.set(x, y, z); sc.set(s, s, s);
    out.compose(ve, qu, sc);
    return parent ? out.premultiply(parent) : out;
  }
  function put(i, m) {
    const e = m.elements, o = i * 12;
    rows[o] = e[0]; rows[o + 1] = e[4]; rows[o + 2] = e[8]; rows[o + 3] = e[12];
    rows[o + 4] = e[1]; rows[o + 5] = e[5]; rows[o + 6] = e[9]; rows[o + 7] = e[13];
    rows[o + 8] = e[2]; rows[o + 9] = e[6]; rows[o + 10] = e[10]; rows[o + 11] = e[14];
  }
  function poseDog(dt) {
    const d = dog, p = d.p;
    d.phase += dt * d.v * 9;
    d.amp += (clamp(d.v * 0.3, 0, 0.75) - d.amp) * Math.min(1, dt * 8);
    const sw = Math.sin(d.phase) * d.amp, bob = Math.abs(Math.sin(d.phase)) * 0.035 * Math.min(1, d.v) + p.hop;
    const shake = p.tremble * Math.sin(clock * 55) * 0.012;
    local(mRoot, null, d.x + shake * Math.cos(d.yaw), ground + bob * DOG, d.z - shake * Math.sin(d.yaw), 0, d.yaw + d.spin, 0, DOG, 'YXZ');
    // (begging sits up straighter; a play bow puts the chest down and the rump up)
    local(mBody, mRoot, 0, 0.43 - p.lie * 0.21 - p.sit * 0.1 + p.beg * 0.07 - p.bow * 0.05, -p.sit * 0.04, p.lean - p.sit * 0.6 - p.beg * 0.55 + p.bow * 0.32, 0, p.roll * Math.PI);
    put(D_BODY, mBody);
    local(mHead, mBody, 0, 0.19, 0.31, p.head + p.sit * 0.5 + p.lie * 0.05 + p.beg * 0.45 - p.bow * 0.45, 0, 0);
    put(D_HEAD, mHead);
    for (let s = 0; s < 2; s++) {
      const sign = s ? -1 : 1, e = p.ear;
      put(D_EAR + s, local(mOut, mHead, 0.085 * sign, 0.16, 0.02, e < 0 ? e * 1.25 : e * 0.15, 0, -e * 0.12 * sign, 1 + 0.12 * Math.max(0, e)));
    }
    const wig = p.wiggle * Math.sin(clock * 16) * 0.5;
    for (let i = 0; i < 4; i++) {
      const front = i < 2, left = i % 2 === 0, swing = (front === left ? sw : -sw);
      // (leaping: stretched out front and back; begging: front paws up, waving; a play bow: front legs flat out)
      const paw = p.beg * (-1.1 + 0.25 * Math.sin(clock * 9 + (left ? 0 : 1.5)));
      const rx = front ? swing + p.sit * 0.6 - p.lie * 1.35 + wig - p.leap * 0.9 + paw - p.bow * 1.0 : swing - p.sit * 0.5 + p.lie * 1.35 - wig + p.leap * 0.9 + p.beg * 0.3 + p.bow * 0.3;
      put(D_LEG + i, local(mOut, mBody, left ? 0.085 : -0.085, -0.09, front ? 0.19 : -0.19, rx, 0, p.lie * (left ? -0.25 : 0.25)));
    }
    d.wagT += dt * d.wagRate * Math.PI * 2 * 0.5;
    put(D_TAIL, local(mOut, mBody, 0, 0.07, -0.29, -p.tuck * 1.7, Math.sin(d.wagT) * p.wag, 0, 1, 'YXZ')); // tucked: down between the legs
    put(D_TONGUE, local(mOut, mHead, 0, -0.055, 0.2, 0, 0, 0, p.tongue > 0.05 ? p.tongue : 0));
    // (drawn half as big again as it was built, so it reads in the dog's mouth)
    if (d.tube === 1) put(D_TUBE, local(mOut, mHead, 0, -0.03, 0.27, 0, 0, 0, 1.5));
    else if (d.tube === 2) { const a = d.tubeAt, s = clamp(7 - a.t, 0, 1) * 1.5; put(D_TUBE, local(mOut, null, a.x, ground + 0.055 * DOG * s, a.z, 0, a.yaw, 0, DOG * s)); }
    else put(D_TUBE, local(mOut, null, d.x, ground, d.z, 0, 0, 0, 0));
    if (ball.mode === 4) put(D_BALL, local(mOut, mHead, 0, -0.035, 0.27));
    else if (ball.mode) put(D_BALL, local(mOut, null, ball.x, ground + 0.07 * 1.6 * DOG + ball.y, ball.z, 0, 0, 0, 1.6 * DOG)); // (bigger than life, so you can follow it)
    else put(D_BALL, local(mOut, null, d.x, ground, d.z, 0, 0, 0, 0));
  }
  function poseMan(dt) {
    const m = man, w = m.w;
    m.phase += dt * m.v * 8.5;
    m.amp += (clamp(m.v * 0.7, 0, 0.35) - m.amp) * Math.min(1, dt * 6);
    const ph = Math.sin(m.phase), sw = ph * m.amp, t = clock;
    const rest = Math.max(0, 1 - (w.ears + w.fist + w.glare + w.grumble + w.clap + w.shoo));
    // Each joint: rest (and walking), plus each gesture by how much of it shows.
    const mix = (r, e, f, gl, gr, c, sh) => r * rest + e * w.ears + f * w.fist + gl * w.glare + gr * w.grumble + c * w.clap + sh * w.shoo;
    const clapOpen = 0.5 + 0.5 * Math.sin(t * 15);
    const lean = mix(0.13, 0.3, -0.05, 0.04, 0.13, 0.08, 0);
    const headP = mix(0.05, 0.18, -0.55, -0.4, 0.05, -0.1, -0.05), headY = w.grumble * Math.sin(t * 11) * 0.45;
    const jit = w.ears * Math.sin(t * 31) * 0.035;
    local(mRoot, null, m.x, ground + Math.abs(ph) * 0.025 * Math.min(1, m.v * 3) * MAN, m.z, 0, m.yaw, 0, MAN, 'YXZ');
    local(mBody, mRoot, 0, 0.9, 0, lean, 0, jit);
    put(M_TORSO, mBody);
    put(M_HEAD, local(mHead, mBody, 0, 0.58, 0.02, headP, headY, 0));
    for (let s = 0; s < 2; s++) put(M_LEG + s, local(mOut, mRoot, s ? -0.1 : 0.1, 0.86, 0, s ? -sw : sw));
    // Left arm (no stick): swings, covers an ear, shakes a fist at the sky, claps, rests on the hip.
    local(mArm, mBody, 0.25, 0.45, 0, mix(-sw * 0.8, -0.25, -2.8, 0, 0, -1.15, 0), 0, mix(0.06, 2.2, 0.25, 0.06, 0.06, 0.3, 1));
    put(M_ARM, mArm);
    put(M_ARM + 1, local(mOut, mArm, 0, -0.3, 0, mix(-0.1, 0, -0.6 + 0.45 * Math.sin(t * 19), -0.1, -0.1, 0, 0), 0, mix(0, 2.4, 0, 0, 0, -1.5 + 0.45 * clapOpen, -2.3)));
    // Right arm: the stick hand (its gestures wave the stick).
    local(mArm, mBody, -0.25, 0.45, 0, mix(-0.3, -0.25, -0.9, -0.3, -0.3, -1.15, -2.5), 0, mix(-0.06, -2.2, -0.1, -0.06, -0.06, -0.3, -0.15));
    put(M_ARM + 2, mArm);
    local(mFore, mArm, 0, -0.3, 0, mix(-0.3, 0, -0.4, -0.3, -0.3, 0, -0.3), 0, mix(0, -2.4, 0, 0, 0, 1.5 - 0.45 * clapOpen, 0));
    put(M_ARM + 3, mFore);
    if (m.prop) put(M_STICK, local(mOut, mRoot, -0.36, 0.8, 0.08, 0, 0, -0.1)); // leant on him
    else {
      const plant = 0.5 + 0.22 * Math.sin(m.phase + Math.PI / 2) * (m.amp / 0.35);
      put(M_STICK, local(mOut, mFore, 0, -0.3, 0, mix(plant, 0, 0.3 + 0.55 * Math.sin(t * 11), 0.45 + 0.12 * Math.sin(t * 8), 0.5 + 0.2 * Math.sin(t * 9), 0, 0.5 * Math.sin(t * 13)), 0, 0));
    }
  }
  function shadows() {
    if (!shadow) return;
    const a = shadow.geometry.attributes.position, y = ground + 0.012;
    let o = 0;
    for (let i = 0; i < 2; i++) {
      const w = both[i], hw = SHADOW[i * 2], hl = SHADOW[i * 2 + 1], c = Math.cos(w.yaw), s = Math.sin(w.yaw);
      for (let j = 0; j < 4; j++) { const u = j & 1 ? hw : -hw, v = j & 2 ? hl : -hl; a.array[o++] = w.x + u * c + v * s; a.array[o++] = y; a.array[o++] = w.z - u * s + v * c; }
    }
    a.needsUpdate = true;
  }
  // Bubbles pop up over their heads, float a little and fade.
  function bubbleStep(dt) {
    bubbles = false;
    for (const w of both) {
      const b = w.bub, s = w.sprite;
      if (!b || (b.age += dt) > b.life) { if (s.visible) { s.visible = false; bubbles = true; } w.bub = null; continue; }
      bubbles = true;
      s.visible = true;
      s.material.map.offset.x = b.icon / 8;
      const pop = b.age < 0.12 ? (b.age / 0.12) * 1.25 : 1 + 0.25 * Math.max(0, 1 - (b.age - 0.12) / 0.12);
      const d = Math.hypot(w.x - cam.x, w.z - cam.z), size = clamp(d * 0.034, 0.5, 2) * pop;
      s.scale.set(size, size, 1);
      s.position.set(w.x, ground + (w.top - (w === dog ? dog.p.lie * 0.25 : 0)) + 0.08 + (b.age / b.life) * 0.3, w.z);
      s.material.opacity = clamp((b.life - b.age) / 0.25, 0, 1);
    }
  }
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  function inView(camera) {
    frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const w of both) { sphere.center.set(w.x, ground + w.top / 2, w.z); sphere.radius = w.top; if (frustum.intersectsSphere(sphere)) return true; }
    return false;
  }
  const show = (v) => { for (const o of objects) o.visible = v && !o.isSprite; if (!v) { dog.bub = man.bub = null; } };

  return {
    objects,
    tris: kit.tris, // [dog, old man]
    /** Shown or put away, whether a show is on (they stay hidden or covering their ears till it ends), and the crackers
        standing (the game's ground items, pinned at it.an), which they keep clear of. */
    set(o, b, standing) { on = o; busy = b; if (standing) crackers = standing; },
    /** Steps them on; true when they need a frame drawn. */
    update(dt, camera) {
      if (!on) { if (shown) { shown = false; show(false); return true; } return false; }
      if (!shown) { shown = true; show(true); drawn.fill(NaN); }
      cam.copy(camera.position);
      if (!placed) {
        placed = true;
        [man.x, man.z] = spot(); [dog.x, dog.z] = near(man.x, man.z, 1, 2.5);
        man.yaw = Math.PI; dog.yaw = Math.atan2(man.x - dog.x, man.z - dog.z);
      }
      clock += dt; quiet = busy ? 0 : quiet + dt;
      thinkDog(dt); thinkMan(dt);
      // Posed (and drawn) so many times a second at most: by tier, and fewer still on a phone already struggling (under
      // 30 frames a second).
      acc += dt;
      slow += ((dt > 1 / 30 ? 1 : 0) - slow) * Math.min(1, dt * 2);
      if (acc < (slow > 0.5 ? 1 / 8 : [1 / 15, 1 / 30, 0][tier]) - 1e-4) return false;
      const step = acc; acc = 0;
      poseDog(step); poseMan(step); shadows(); bubbleStep(step);
      let moved = bubbles;
      for (let i = 0; i < rows.length && !moved; i++) if (!(Math.abs(rows[i] - drawn[i]) < 1e-4)) moved = true; // (NaN: not drawn yet)
      if (!moved) return false;
      const seenNow = inView(camera);
      if (!seenNow && !lastSeen) return false;
      lastSeen = seenNow; drawn.set(rows);
      return true;
    },
    /** Something loud: a cracker lit at pos ({ x, y, z } metres; null or high up: a burst overhead), power about 1;
        kind 'tube' for a shell leaving its tube, 'ground' for a ground cracker (the dog may bring the casing back). */
    startle(pos, power = 1, kind = 'ground') {
      if (!on || !placed) return;
      quiet = 0;
      const sky = !pos || pos.y > 6;
      if (!sky) spent = true;
      if (dog.tube === 2) dog.tube = 0;
      if (ball.mode === 4) { ball.x = dog.x; ball.z = dog.z; }
      if (ball.mode && ball.mode !== 3) { ball.mode = 3; ball.t = 0; ball.y = 0; } // dropped, mid-game
      // The dog: ears up, a bark, and off.
      if (!['alert', 'flee', 'cower'].includes(dog.act)) {
        const d = sky ? 0 : Math.hypot(dog.x - pos.x, dog.z - pos.z);
        if (d < 18 * power) { dog.from = sky ? null : { x: pos.x, z: pos.z }; act(dog, 'alert', 0.35); say(dog, BANG, 0.9); noise(dog, 'bark'); dog.tube = 0; }
      }
      // The old man: hands over his ears for a cracker near him; a fist at the sky for a burst.
      if (sky) {
        if (man.act !== 'fist' && !(man.act === 'ears' && man.t < 1.2) && clock - man.fistAt > 3) {
          man.fistAt = clock; man.from = pos ? { x: pos.x, z: pos.z } : null;
          act(man, 'fist', 1.8); say(man, GRUMBLE); noise(man, 'grumble');
        }
      } else if (Math.hypot(man.x - pos.x, man.z - pos.z) < 24 * power) {
        man.earsAt = clock; man.from = { x: pos.x, z: pos.z };
        if (man.act !== 'ears') act(man, 'ears');
      } else if (calmMan()) { act(man, 'look', 1.5); man.look = Math.atan2(pos.x - man.x, pos.z - man.z); }
    },
    /** A show worth applauding: the old man claps once it is quiet (and the dog joins in). */
    cheer() { if (!on) return; cheerAt = clock; if (calmMan() && calm()) nextMan(); },
    /** A tap at (sx, sy) CSS px: true when it touched the dog (a trick: taps within 5 s go sit and wag, a spinning jump,
        a roll over, begging) or the old man (he waves his stick at you); the game then places no cracker there. */
    pet(sx, sy) {
      if (!on || !shown || !placed) return false;
      // How near the tap is to each, as a share of its size on screen (under 1: a touch); the nearer one is touched.
      const pd = view.project(dog.x, ground + 0.45 * DOG, dog.z, []), pm = view.project(man.x, ground + MAN, man.z, []);
      const toDog = pd ? Math.hypot(pd[0] - sx, pd[1] - sy) / Math.max(30, 0.6 * DOG * view.ppm(pd[2])) : 9;
      const toMan = pm ? Math.max(Math.abs(pm[0] - sx) / Math.max(22, 0.4 * MAN * view.ppm(pm[2])), Math.abs(pm[1] - sy) / Math.max(34, 1.05 * MAN * view.ppm(pm[2]))) : 9;
      if (Math.min(toDog, toMan) >= 1) return false;
      if (toDog <= toMan) {
        if (dog.act === 'flee' || dog.act === 'alert') return true; // too busy running
        pets = clock - petAt < 5 ? pets + 1 : 1; petAt = clock;
        const trick = ['pet', 'jump', 'roll', 'beg'][(pets - 1) % 4];
        // across the view: away from the middle of the zone, unless that is off the screen
        let ax = dog.z - cam.z, az = cam.x - dog.x; const l = Math.hypot(ax, az) || 1;
        if ((dog.x - K.x) * ax + (dog.z - K.z) * az < 0) { ax = -ax; az = -az; }
        if (!seen(dog.x + (ax / l) * 1.3, dog.z + (az / l) * 1.3)) { ax = -ax; az = -az; }
        go(dog, [dog.x + (ax / l) * 1.3, dog.z + (az / l) * 1.3], 4, trick);
        dog.dur = trick === 'jump' ? 2.2 : 2.8; dog.spin = 0;
        if (ball.mode === 4) { ball.mode = 3; ball.t = 0; ball.x = dog.x; ball.z = dog.z; }
        if (dog.tube === 1) dog.tube = 0;
        say(dog, HEART, 1.4); noise(dog, 'yip');
      } else if (calmMan() || man.act === 'grumble' || man.act === 'clap') { act(man, 'shoo', 1.7); say(man, GRUMBLE); noise(man, 'grumble'); }
      return true;
    },
    /** A finger down at (sx, sy): true when it is on the dog, and a drag from there pulls out its ball (dragBall). */
    grab(sx, sy) {
      if (!on || !shown || !placed || ['alert', 'flee', 'cower'].includes(dog.act)) return false;
      const p = view.project(dog.x, ground + 0.45 * DOG, dog.z, []);
      return !!p && Math.hypot(p[0] - sx, p[1] - sy) < Math.max(30, 0.6 * DOG * view.ppm(p[2]));
    },
    /** The ball under the finger at (sx, sy), held up over the ground; the dog crouches for it. */
    dragBall(sx, sy) {
      if (!on || busy || ['alert', 'flee', 'cower'].includes(dog.act)) return; // a show or a fright comes first
      const g = view.floor(sx, sy);
      if (!g.hit) return;
      ball.mode = 1; ball.x = clamp(g.x, R.x0, R.x1); ball.z = clamp(g.z, R.z0, R.z1); ball.y = 0.55;
      if (dog.act !== 'eager') { act(dog, 'eager'); if (dog.tube === 1) dog.tube = 0; noise(dog, 'yip'); }
    },
    /** Let go at (sx, sy): the ball flies there (somewhere the dog can run to) and the dog races after it. */
    throwBall(sx, sy) {
      if (ball.mode !== 1) return;
      const g = view.floor(sx, sy);
      let x = clamp(g.hit ? g.x : ball.x, R.x0, R.x1), z = clamp(g.hit ? g.z : ball.z, R.z0, R.z1);
      if (inside(x, z) < 1.1) { const k = Math.sqrt(1.1 / Math.max(inside(x, z), 1e-6)); x = clamp(K.x + (x - K.x) * k, R.x0, R.x1); z = clamp(K.z + (z - K.z) * k, R.z0, R.z1); }
      Object.assign(ball, { mode: 2, fx: ball.x, fz: ball.z, fy: ball.y, tx: x, tz: z, t: 0 });
      ball.dur = clamp(Math.hypot(x - ball.fx, z - ball.fz) / 9, 0.35, 1.1);
      go(dog, [x, z], SPEED.run, 'chase'); noise(dog, 'bark'); say(dog, BANG, 0.6);
    },
    // For tests: where they are and what they are up to.
    get state() {
      const at = (w, h) => { const p = view.project(w.x, ground + h, w.z, []); return p && [Math.round(p[0]), Math.round(p[1])]; };
      return { tier, shown, ball: ball.mode, dog: { x: dog.x, z: dog.z, act: dog.act, tube: dog.tube, at: at(dog, 0.45 * DOG) }, man: { x: man.x, z: man.z, act: man.act, at: at(man, MAN) }, keepOut: K, walk: R };
    },
  };
}
