/* Light Up the Skies — Pataka Chor's donkey (world3d.js adds it to a scene that asks for one, def.donkey): a grey
   low-poly donkey in a red festival blanket with a saddle basket on its back, ambling along its route and stopping now
   and then to graze. Drag a cracker onto its back and it sits in the basket and rides along; light it and the donkey
   perks up and trots, with a happy little hop each time it bangs, until the cracker is spent.

   Built for phones like the forecourt's folk: flat vertex-coloured parts merged into seven meshes (body and basket,
   head, four legs, tail) on one shared material, moved as a small rig; nothing casts shadows; it asks for a frame only
   while it moves on screen, at most 15, 30 or 60 times a second by tier. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp } from './world3d.js';

const C = { coat: '#8f877c', belly: '#cfc6b8', dark: '#3b332c', muzzle: '#dcd3c4', mane: '#4a423a', blanket: '#c0392b',
  trim: '#ffd34d', basket: '#b98a45', basketDark: '#8a6431', eye: '#16110e' };
const SCALE = 1.35; // a touch bigger than life, as the crackers and the folk are, so it reads on a phone
const SPEED = { walk: 0.9, trot: 2.4 };
const BACK_Y = 1.42; // the basket's top, where a cracker sits (before SCALE)

// A few coloured shapes, placed and merged into one non-indexed geometry with vertex colours.
function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [geo, color, m] of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m || new THREE.Matrix4());
    g.computeVertexNormals();
    c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    geo.dispose(); if (g !== geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 6) => new THREE.CylinderGeometry(r1, r0, h, n);

// The camel (kind 'camel', Jaipur's street): sandy and long-legged, a hump under a Rajasthani saddle cloth of red and
// gold with mirror work, a basket on the saddle where a cracker rides.
const K = { coat: '#c8a06a', belly: '#e0c79a', dark: '#5a4330', muzzle: '#d9bd8e', cloth: '#c2185b', trim: '#ffd34d', mirror: '#e6f2ff', tassel: '#ff7a2b' };
function camelParts() {
  const body = merge([
    [box(0.56, 0.6, 1.3), K.coat, at(0, 1.6, 0)],
    [box(0.48, 0.14, 1.1), K.belly, at(0, 1.3, 0)],
    [new THREE.SphereGeometry(0.42, 7, 5), K.coat, at(0, 2.0, -0.05)], // the hump
    [box(0.24, 0.62, 0.26), K.coat, at(0, 1.95, 0.72, -0.9)], // the neck, out and up
    [box(0.22, 0.5, 0.22), K.coat, at(0, 2.35, 0.98, -0.2)],
    // The saddle cloth over the hump, its trim, mirrors and tassels, and the basket on top.
    [box(0.72, 0.06, 0.9), K.cloth, at(0, 2.3, -0.05)], [box(0.74, 0.03, 0.92), K.trim, at(0, 2.26, -0.05)],
    [box(0.06, 0.5, 0.7), K.cloth, at(0.36, 2.0, -0.05)], [box(0.06, 0.5, 0.7), K.cloth, at(-0.36, 2.0, -0.05)],
    ...[-0.25, 0, 0.25].flatMap((z) => [[box(0.03, 0.08, 0.08), K.mirror, at(0.4, 2.05, z - 0.05)], [box(0.03, 0.08, 0.08), K.mirror, at(-0.4, 2.05, z - 0.05)]]),
    ...[-0.3, 0, 0.3].flatMap((z) => [[box(0.05, 0.14, 0.05), K.tassel, at(0.38, 1.7, z - 0.05)], [box(0.05, 0.14, 0.05), K.tassel, at(-0.38, 1.7, z - 0.05)]]),
    [box(0.36, 0.12, 0.36), C.basket, at(0, 2.4, -0.05)],
  ]);
  const head = merge([
    [box(0.24, 0.24, 0.5), K.coat, at(0, 0, 0.14)], [box(0.2, 0.18, 0.2), K.muzzle, at(0, -0.04, 0.42)],
    [box(0.04, 0.04, 0.02), C.eye, at(0.11, 0.06, 0.2)], [box(0.04, 0.04, 0.02), C.eye, at(-0.11, 0.06, 0.2)],
    [box(0.05, 0.1, 0.04), K.coat, at(0.09, 0.15, -0.06)], [box(0.05, 0.1, 0.04), K.coat, at(-0.09, 0.15, -0.06)],
    [box(0.26, 0.04, 0.04), K.tassel, at(0, 0.02, 0.36)], // a bright bridle
  ]);
  const leg = () => merge([[cyl(0.06, 0.08, 1.25), K.coat, at(0, -0.62, 0)], [cyl(0.1, 0.1, 0.06), K.dark, at(0, -1.26, 0)]]);
  const tail = merge([[box(0.05, 0.5, 0.05), K.coat, at(0, -0.25, 0)], [box(0.08, 0.14, 0.08), K.dark, at(0, -0.52, 0)]]);
  return { body, head, leg, tail, headAt: [0, 2.62, 1.12], tailAt: [0, 1.8, -0.66], hip: 1.3, legs: [[0.18, 0.45], [-0.18, 0.45], [0.18, -0.45], [-0.18, -0.45]], back: 2.48, scale: 1.15 };
}

// The Dasara elephant (kind 'elephant', Mysore's grounds): grey and stately, its forehead painted, a red and gold
// caparison over its back and a golden howdah on top where a cracker rides, gold anklets on its legs.
const E = { skin: '#7d7a82', dark: '#5c5960', paint: '#ff7a2b', paint2: '#ffd34d', cloth: '#b3123a', gold: '#f2b632', tusk: '#f4ecd8' };
function elephantParts() {
  const body = merge([
    [box(0.95, 0.9, 1.5), E.skin, at(0, 1.55, 0)],
    [box(1.0, 0.08, 1.2), E.cloth, at(0, 2.02, -0.05)], [box(1.02, 0.6, 0.06), E.cloth, at(0, 1.7, 0.52)],
    [box(0.06, 0.62, 1.1), E.cloth, at(0.5, 1.72, -0.05)], [box(0.06, 0.62, 1.1), E.cloth, at(-0.5, 1.72, -0.05)],
    [box(0.07, 0.06, 1.12), E.gold, at(0.51, 1.42, -0.05)], [box(0.07, 0.06, 1.12), E.gold, at(-0.51, 1.42, -0.05)],
    // The howdah: a gilded seat with posts and a little canopy.
    [box(0.62, 0.3, 0.62), E.gold, at(0, 2.22, -0.05)], [box(0.66, 0.04, 0.66), E.cloth, at(0, 2.38, -0.05)],
    ...[[0.28, 0.24], [-0.28, 0.24], [0.28, -0.34], [-0.28, -0.34]].map(([x, z]) => [box(0.04, 0.4, 0.04), E.gold, at(x, 2.58, z)]),
    [box(0.7, 0.05, 0.7), E.gold, at(0, 2.8, -0.05)],
  ]);
  const head = merge([
    [box(0.62, 0.66, 0.5), E.skin, at(0, 0, 0.1)],
    [box(0.4, 0.34, 0.04), E.paint, at(0, 0.08, 0.36)], [box(0.18, 0.12, 0.05), E.paint2, at(0, 0.12, 0.37)], // painted forehead
    [box(0.04, 0.05, 0.02), '#16110e', at(0.2, 0.08, 0.35)], [box(0.04, 0.05, 0.02), '#16110e', at(-0.2, 0.08, 0.35)],
    [box(0.06, 0.6, 0.5), E.dark, at(0.36, 0, -0.02, 0, 0.35, 0)], [box(0.06, 0.6, 0.5), E.dark, at(-0.36, 0, -0.02, 0, -0.35, 0)], // the ears
    [box(0.2, 0.5, 0.2), E.skin, at(0, -0.48, 0.32, 0.25)], [box(0.15, 0.45, 0.15), E.skin, at(0, -0.9, 0.42, 0.05)], // the trunk
    [box(0.06, 0.06, 0.3), E.tusk, at(0.16, -0.26, 0.42, 0.4)], [box(0.06, 0.06, 0.3), E.tusk, at(-0.16, -0.26, 0.42, 0.4)],
  ]);
  const leg = () => merge([[cyl(0.15, 0.17, 1.1), E.skin, at(0, -0.55, 0)], [cyl(0.18, 0.18, 0.08), E.gold, at(0, -0.92, 0)], [cyl(0.19, 0.19, 0.06), E.dark, at(0, -1.1, 0)]]);
  const tail = merge([[box(0.05, 0.6, 0.05), E.skin, at(0, -0.3, 0)], [box(0.08, 0.12, 0.08), E.dark, at(0, -0.62, 0)]]);
  return { body, head, leg, tail, headAt: [0, 1.75, 0.95], tailAt: [0, 1.85, -0.76], hip: 1.12, legs: [[0.3, 0.5], [-0.3, 0.5], [0.3, -0.5], [-0.3, -0.5]], back: 2.42, scale: 1.75 };
}

/** route: a loop of [x, z] it walks; ground: the ground's height; view: { project, ppm } from the engine; kind:
    'donkey' (the default) or 'camel'. */
export function build({ tier, route, ground = 0.17, view, kind = 'donkey' }) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;'); };
  // The donkey faces +z with its hooves at y = 0.
  const body = merge([
    [box(0.5, 0.5, 1.1), C.coat, at(0, 1.0, 0)],
    [box(0.44, 0.12, 0.9), C.belly, at(0, 0.76, 0)],
    [box(0.24, 0.5, 0.26), C.coat, at(0, 1.3, 0.55, -0.55)], // the neck, up and forward
    [box(0.06, 0.42, 0.24), C.mane, at(0, 1.42, 0.5, -0.55)],
    // The festival blanket and the saddle basket on its back, a pannier either side.
    [box(0.6, 0.06, 0.62), C.blanket, at(0, 1.27, -0.05)],
    [box(0.62, 0.03, 0.64), C.trim, at(0, 1.24, -0.05)],
    [box(0.2, 0.3, 0.46), C.basket, at(0.36, 1.05, -0.05)], [box(0.2, 0.3, 0.46), C.basket, at(-0.36, 1.05, -0.05)],
    [box(0.22, 0.04, 0.48), C.basketDark, at(0.36, 1.21, -0.05)], [box(0.22, 0.04, 0.48), C.basketDark, at(-0.36, 1.21, -0.05)],
    [box(0.34, 0.1, 0.34), C.basket, at(0, 1.35, -0.05)], // the basket on top, where a cracker rides
  ]);
  const head = merge([
    [box(0.26, 0.28, 0.46), C.coat, at(0, 0, 0.12)],
    [box(0.22, 0.2, 0.18), C.muzzle, at(0, -0.04, 0.38)],
    [box(0.04, 0.04, 0.02), C.eye, at(0.12, 0.06, 0.2)], [box(0.04, 0.04, 0.02), C.eye, at(-0.12, 0.06, 0.2)],
    [box(0.07, 0.36, 0.05), C.coat, at(0.08, 0.3, -0.04, -0.2, 0, -0.22)], [box(0.07, 0.36, 0.05), C.coat, at(-0.08, 0.3, -0.04, -0.2, 0, 0.22)], // the ears
    [box(0.04, 0.24, 0.02), C.dark, at(0.08, 0.3, -0.015, -0.2, 0, -0.22)], [box(0.04, 0.24, 0.02), C.dark, at(-0.08, 0.3, -0.015, -0.2, 0, 0.22)],
  ]);
  const legGeo = () => merge([[cyl(0.06, 0.075, 0.72), C.coat, at(0, -0.36, 0)], [cyl(0.07, 0.07, 0.08), C.dark, at(0, -0.74, 0)]]);
  const tailGeo = merge([[box(0.05, 0.45, 0.05), C.coat, at(0, -0.22, 0)], [box(0.1, 0.16, 0.1), C.mane, at(0, -0.48, 0)]]);
  // The donkey's shape, or the camel's (which brings its own parts).
  const camel = kind === 'camel' ? camelParts() : kind === 'elephant' ? elephantParts() : null; // (any animal but the donkey)
  const shape = camel || { body, head, leg: legGeo, tail: tailGeo, headAt: [0, 1.55, 0.78], tailAt: [0, 1.18, -0.56], hip: 0.78, legs: [[0.16, 0.42], [-0.16, 0.42], [0.16, -0.42], [-0.16, -0.42]], back: BACK_Y, scale: SCALE };
  if (camel) { body.dispose(); head.dispose(); tailGeo.dispose(); }

  const root = new THREE.Group(), SC = shape.scale;
  root.scale.setScalar(SC);
  const bodyM = new THREE.Mesh(shape.body, mat), headM = new THREE.Mesh(shape.head, mat), tailM = new THREE.Mesh(shape.tail, mat);
  headM.position.set(...shape.headAt);
  tailM.position.set(...shape.tailAt);
  const legs = shape.legs.map(([x, z]) => {
    const m = new THREE.Mesh(shape.leg(), mat); m.position.set(x, shape.hip, z); return m;
  });
  root.add(bodyM, headM, tailM, ...legs);
  for (const m of [bodyM, headM, tailM, ...legs]) m.frustumCulled = false;

  // ---------- Walking its route ----------
  const d = { x: route[0][0], z: route[0][1], yaw: 0, v: 0, leg: 0, act: 'walk', t: 0, dur: 0, phase: 0, loaded: false, excited: 0, hop: 0 };
  let clock = 0, acc = 0, lastSeen = false, drawnKey = '';
  const target = () => route[d.leg];
  function next() {
    d.leg = (d.leg + 1) % route.length;
    if (!d.loaded && Math.random() < 0.35) { d.act = 'graze'; d.t = 0; d.dur = 2 + Math.random() * 3; } else d.act = 'walk';
  }
  function think(dt) {
    d.t += dt;
    let speed = 0;
    if (d.excited > 0) d.excited = Math.max(0, d.excited - dt);
    if (d.act === 'graze') { if (d.t > d.dur || d.loaded) d.act = 'walk'; }
    else {
      speed = d.excited > 0 ? SPEED.trot : SPEED.walk;
      const [tx, tz] = target(), dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
      if (dist < 0.4) next();
      else {
        const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw));
        d.yaw += turn * Math.min(1, dt * 3);
        const step = Math.min(dist, d.v * dt);
        d.x += Math.sin(d.yaw) * step; d.z += Math.cos(d.yaw) * step;
      }
    }
    d.v += (speed - d.v) * Math.min(1, dt * 4);
    d.hop = Math.max(0, d.hop - dt * 3);
  }
  function pose() {
    d.phase += acc * d.v * 7;
    const sw = Math.sin(d.phase) * clamp(d.v * 0.35, 0, 0.6), bob = Math.abs(Math.sin(d.phase)) * 0.03 * d.v;
    const hop = Math.sin(Math.min(1, d.hop) * Math.PI) * 0.25;
    root.position.set(d.x, ground + (bob + hop) * SC, d.z);
    root.rotation.set(0, d.yaw, 0);
    legs[0].rotation.x = sw; legs[3].rotation.x = sw; legs[1].rotation.x = -sw; legs[2].rotation.x = -sw;
    const graze = d.act === 'graze' ? 1 : 0;
    headM.rotation.x = graze * 1.0 + Math.sin(d.phase * 0.5) * 0.06 * d.v - (d.excited > 0 ? 0.25 : 0);
    headM.position.y = shape.headAt[1] - graze * (camel ? 0.9 : 0.45);
    headM.position.z = shape.headAt[2] + graze * 0.1;
    tailM.rotation.z = Math.sin(clock * (d.excited > 0 ? 14 : 3)) * (d.excited > 0 ? 0.6 : 0.25);
  }
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  return {
    objects: [root],
    /** Steps it on; true when it needs a frame drawn. */
    update(dt, camera) {
      clock += dt; think(dt);
      acc += dt;
      if (acc < [1 / 15, 1 / 30, 0][tier] - 1e-4) return false;
      pose(); acc = 0;
      const key = `${d.x.toFixed(3)},${d.z.toFixed(3)},${d.yaw.toFixed(3)},${d.act},${d.hop.toFixed(2)},${d.v.toFixed(2)}`;
      if (key === drawnKey && d.v < 0.01) return false;
      drawnKey = key;
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      sphere.center.set(d.x, ground + 1.2, d.z); sphere.radius = camel ? 3 : 2;
      const seen = frustum.intersectsSphere(sphere);
      const draw = seen || lastSeen; lastSeen = seen;
      return draw;
    },
    /** Where a cracker on its back sits: the top of the basket, in world metres. */
    back() {
      const hop = Math.sin(Math.min(1, d.hop) * Math.PI) * 0.25, z = -0.05 * SC;
      return { x: d.x + Math.sin(d.yaw) * z, y: ground + (shape.back + hop) * SC, z: d.z + Math.cos(d.yaw) * z };
    },
    /** Whether a screen point (CSS px) is on it. */
    hit(sx, sy) {
      const p = view.project(d.x, ground + (camel ? 1.7 : 1.1) * SC, d.z, []);
      if (!p) return false;
      const r = Math.max(34, (camel ? 1.1 : 0.85) * SC * view.ppm(p[2]));
      return Math.abs(p[0] - sx) < r && Math.abs(p[1] - sy) < r * 0.8;
    },
    /** A cracker in its basket (it stops grazing to carry it), or none. */
    load(on) { d.loaded = on; if (on && d.act === 'graze') d.act = 'walk'; },
    /** Its cracker is burning: it perks up, trots and hops. */
    excite(sec = 1.5) { d.excited = Math.max(d.excited, sec); d.hop = 1; },
    get state() { return { kind, x: d.x, z: d.z, yaw: d.yaw, act: d.act, loaded: d.loaded, excited: d.excited > 0 }; },
  };
}
