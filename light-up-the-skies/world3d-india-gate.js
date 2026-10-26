/* Light Up the Skies — 3D background: India Gate on Diwali night, seen from the avenue to the west, with the canopy and
   Netaji's statue framed in its arch. Loaded by world3d.js when India Gate is the chosen world. Its colours follow the
   game's 2D India Gate picture: a deep blue twilight going purple and warm at the horizon, the arch glowing amber, a
   dark avenue lined with lanterns.

   Proportions follow published and surveyed figures: 42 m high, a 9.14 m main arch with its crown at 22.86 m, side
   arches crowned at 16.46 m, a 31 x 18 m body under the cornice and four attic stages to the dish; the canopy 160 m
   behind it, 22.25 m high, with the 8.53 m granite statue. Everything is a box, an extruded outline or a lathe, merged
   into a few meshes with one drawn masonry texture; the carving is one sheet of drawn decals. The floodlit look (warm
   light grazing up from the plinth, the vault glowing) is baked into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the gate's local origin is the centre of its base. */
import * as THREE from './assets/vendor/three.module.min.js';
import { mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const GZ = -150; // the gate's centre, down the avenue from you
const CANOPY_Z = GZ - 160;
const MEMORIAL_Z = GZ - 348; // the National War Memorial's obelisk, where the eternal flame now burns
const SPAN = 9.14, SPRING = 18.29, R = SPAN / 2; // main arch: crown 22.86
const SIDE_SPRING = 13.71, SR = 2.75; // side arches: crown 16.46
const HX = 15.5, HZ = 9, LEG_Z = 2.75; // body half-width and half-depth; the side passage's half-width
const BODY = 27.3; // the body's top, under the cornice

// ---------- Masonry: ashlar courses alternating 0.30 and 0.45 m, one tile per 4 m ----------
function masonryTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(31), px = 256 / 4;
  g.fillStyle = '#f4ead9'; g.fillRect(0, 0, 256, 256);
  let y = 0, row = 0;
  while (y < 256) {
    const h = (row % 2 ? 0.45 : 0.3) * px;
    let x = -(row % 3) * 20;
    while (x < 256) {
      const w = (0.9 + rnd() * 0.7) * px, v = 0.9 + rnd() * 0.1;
      g.fillStyle = `rgb(${(244 * v) | 0},${(234 * v) | 0},${(217 * v) | 0})`;
      g.fillRect(x + 1, y + 1, w - 2, h - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(80,58,38,0.4)'; g.fillRect(0, y, 256, 1.2);
    y += h; row++;
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,70,50,${rnd() * 0.07})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 5); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a vertex colour; glow(cx, cy, cz, normal) sends a triangle to the second,
// unlit set: the floodlit vault and passages.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null, glow = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.glow = glow;
  }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, base = new THREE.Color(color);
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
      const cx = (tmpA.x + tmpB.x + tmpC.x) / 3, cy = (tmpA.y + tmpB.y + tmpC.y) / 3, cz = (tmpA.z + tmpB.z + tmpC.z) / 3;
      const set = this.sets[this.glow && this.glow(cx, cy, cz, tmpN) ? 1 : 0];
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        set.pos.push(v.x, v.y, v.z); set.nor.push(tmpN.x, tmpN.y, tmpN.z);
        set.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = this.colour ? this.colour(v.x, v.y, v.z, tmpN, base) : base;
        set.col.push(c.r, c.g, c.b);
      }
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color) { return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); }
  // An outline in the x-y plane, extruded from z0 to z1.
  extrudeZ(pts, z0, z1, color) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false });
    return this.add(g, color, at(0, 0, z0));
  }
  // An outline in the z-y plane (given as [z, y]), extruded from x0 to x1.
  extrudeX(pts, x0, x1, color) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // the outline's x becomes -z, its depth +x
    return this.add(g, color, at(x0, 0, 0));
  }
  lathe(profile, x, y, z, seg, color) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  // A beam w x h in section from point a to point b.
  beam(a, b, w, h, color) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, len, h), color, m);
  }
  mesh(i, material) {
    const s = this.sets[i];
    if (!s.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

// Points round (cx, cy), radius r, from angle a0 to a1.
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

// The floodlit amber of the 2D picture, by height: brightest low on the piers where the floods graze up.
const BANDS = [[0.6, '#c8703f', '#c8703f'], [6, '#ffcf86', '#ffc77a'], [17.9, '#ffbe6e', '#f2a85a'], [25, '#e89c55', '#d8894a'], [27.3, '#d8894a', '#d8894a'],
  [28.6, '#f0a860', '#f0a860'], [34.1, '#d68c4c', '#d08548'], [99, '#c88044', '#bf7840']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function gateColour(x, y) {
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, Math.min(1, Math.max(0, (y - lo) / (top - lo))));
    lo = top;
  }
  return tmpCol.copy(BANDS[BANDS.length - 1][2]);
}
// The vault and the passage walls: the brightest stone, lit from inside the passages.
function inPassage(cx, cy, cz, n) {
  const main = Math.abs(cx) < R + 0.05 && Math.abs(cz) < HZ + 0.05 && cy < SPRING + R + 0.05 && (Math.abs(n.x) > 0.5 || n.y < -0.2);
  const side = Math.abs(cz) < LEG_Z + 0.05 && Math.abs(cx) > R - 0.25 && Math.abs(cx) < HX - 0.95 && cy < SIDE_SPRING + SR + 0.05 && (Math.abs(n.z) > 0.5 || n.y < -0.2);
  return main || side;
}

// India Gate, around its local origin.
function gateGeometry(s, tier) {
  const seg = tier ? 20 : 12, buff = '#d8c2a0';
  s.box(-15.8, 15.8, 0, 0.6, -9.3, 9.3, '#9a5a45'); // the red base course
  // The two long faces: arched slabs over the four legs.
  const face = [[-HX, 0.6], [-R, 0.6], ...arc(0, SPRING, R, Math.PI, 0, seg), [R, 0.6], [HX, 0.6], [HX, BODY], [-HX, BODY]];
  s.extrudeZ(face, LEG_Z, HZ, buff).extrudeZ(face, -HZ, -LEG_Z, buff);
  // Over the side passages, and the crown of the crossing.
  const spandrel = [[-LEG_Z, SIDE_SPRING], [-LEG_Z, BODY], [LEG_Z, BODY], [LEG_Z, SIDE_SPRING], ...arc(0, SIDE_SPRING, SR, 0, Math.PI, seg).slice(1, -1)];
  s.extrudeX(spandrel, R, HX, buff).extrudeX(spandrel, -HX, -R, buff);
  s.extrudeZ([[-R, SPRING], [-R, BODY], [R, BODY], [R, SPRING], ...arc(0, SPRING, R, 0, Math.PI, seg).slice(1, -1)], -LEG_Z, LEG_Z, buff);
  for (const sx of [-1, 1]) {
    // Low screen walls across the side passages, with copings and lotus-bud finials.
    s.box(sx * 14.5, sx * HX, 0.6, 3.45, -LEG_Z, LEG_Z, buff).box(sx * 14.35, sx * 15.7, 3.45, 3.9, -2.95, 2.95, buff);
    s.box(sx * 14.4, sx * 15.6, 3.9, 5.1, -0.6, 0.6, buff);
    s.lathe([[0.35, 0], [0.6, 0.6], [0.55, 1.4], [0.3, 1.9], [0.08, 2.3], [0, 2.3]], sx * 15, 5.1, 0, tier ? 10 : 6, buff);
    // Bands wrapping each leg (the dado and the side impost); the main impost runs the full depth.
    for (const sz of [-1, 1]) {
      const [z0, z1] = sz > 0 ? [2.55, 9.2] : [-9.2, -2.55], [x0, x1] = sx > 0 ? [4.37, 15.7] : [-15.7, -4.37];
      s.box(x0, x1, 3.45, 3.9, z0, z1, buff).box(x0, x1, 13.2, 13.7, z0, z1, buff);
    }
    s.box(sx > 0 ? 4.37 : -15.7, sx > 0 ? 15.7 : -4.37, 17.4, 17.9, -9.2, 9.2, buff);
    // Side keystones and the corner pilaster strips.
    s.box(sx * HX, sx * 15.75, 16.2, 17.4, -0.5, 0.5, buff);
    for (const sz of [-1, 1]) s.box(sx * 14.1, sx * HX, 0.6, BODY, sz * HZ, sz * 9.12, buff);
  }
  for (const sz of [-1, 1]) {
    // Keystone and archivolt round the main arch on each long face.
    s.box(-0.7, 0.7, 22.6, 24.8, sz * HZ, sz * 9.3, buff);
    const rim = [...arc(0, SPRING, R + 0.7, 0, Math.PI, seg), ...arc(0, SPRING, R, Math.PI, 0, seg)];
    s.extrudeZ(rim, sz > 0 ? HZ : -9.15, sz > 0 ? 9.15 : -HZ, buff);
  }
  // The cornice, deep and thin, and the attics stepping in to the dish.
  s.box(-16.3, 16.3, BODY, 27.8, -9.8, 9.8, buff).box(-16.9, 16.9, 27.8, 28.6, -10.4, 10.4, buff);
  s.box(-15.5, 15.5, 28.6, 31.7, -8.8, 8.8, buff).box(-15, 15, 31.7, 34.1, -8.15, 8.15, buff);
  s.box(-6.5, 6.5, 34.1, 39.9, -6, 6, buff);
  // Attic B's ends: a saddle, scooped between two full-height ears.
  const scoop = arc(0, 0, 1, 0, -Math.PI, seg).slice(1, -1).map(([z, y]) => [z * 3.25, 39.9 + y * 2.7]);
  const saddle = [[-6, 34.1], [6, 34.1], [6, 39.9], [3.25, 39.9], ...scoop, [-3.25, 39.9], [-6, 39.9]];
  for (const sx of [-1, 1]) {
    if (tier) s.extrudeX(saddle, sx > 0 ? 6.5 : -12.3, sx > 0 ? 12.3 : -6.5, buff);
    else s.box(sx > 0 ? 6.5 : -12.3, sx > 0 ? 12.3 : -6.5, 34.1, 39.9, -6, 6, buff);
  }
  s.box(-6.5, 6.5, 39.9, 40.8, -4.5, 4.5, buff);
  s.lathe([[3.75, 0], [3.75, 0.2], [3.3, 0.35], [2.3, 0.5], [2, 0.55], [1.6, 0.9], [1, 1.1], [0, 1.2]], 0, 40.8, 0, seg, buff);
  return s;
}

// The canopy (chhatri) in its pool, with Netaji Subhas Chandra Bose's statue saluting towards the gate.
function canopyGeometry(s, tier) {
  const z = CANOPY_Z, seg = tier ? 18 : 10, red = '#c8703f', buff = '#ffdca8';
  s.box(-6.5, 6.5, 0, 1, z - 6.5, z + 6.5, red).box(-5.6, 5.6, 1, 1.6, z - 5.6, z + 5.6, red);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 4.6, cz = z + sz * 4.6;
    s.box(x - 0.8, x + 0.8, 1.6, 2.6, cz - 0.8, cz + 0.8, buff);
    s.cyl(0.55, 0.55, 2.6, 12.6, x, cz, tier ? 12 : 8, buff);
    s.lathe([[0.55, 0], [0.8, 0.6], [0.95, 1.2], [0, 1.2]], x, 12.6, cz, tier ? 12 : 8, buff);
    s.box(x - 0.95, x + 0.95, 13.8, 14.3, cz - 0.95, cz + 0.95, buff);
  }
  for (const sz of [-1, 1]) s.box(-5.6, 5.6, 14.3, 15.7, z + sz * 5, z + sz * 5.6, buff).box(sz * 5, sz * 5.6, 14.3, 15.7, z - 5.6, z + 5.6, buff);
  s.box(-6.6, 6.6, 15.7, 16.1, z - 6.6, z + 6.6, red).box(-4.6, 4.6, 16.1, 17.6, z - 4.6, z + 4.6, buff);
  s.cyl(3.8, 3.8, 17.6, 18.3, 0, z, seg, buff);
  s.lathe([[3.8, 0], [3.7, 1], [3.3, 1.9], [2.5, 2.6], [1.4, 3.1], [0.4, 3.3], [0, 3.35]], 0, 18.3, z, seg, buff);
  s.cyl(0.2, 0.08, 21.65, 22.25, 0, z, 6, buff);
  return s;
}
// Netaji's statue in black granite, 8.53 m, in uniform and peaked cap, saluting with his right hand (your left).
function statueGeometry(s) {
  const z = CANOPY_Z, granite = '#ffffff';
  s.box(-1.8, 1.8, 1.6, 3.2, z - 1.5, z + 1.5, granite).box(-1.52, 1.52, 3.2, 3.6, z - 1.22, z + 1.22, granite);
  for (const sx of [-1, 1]) s.box(sx * 0.48 - 0.4, sx * 0.48 + 0.4, 3.6, 7.1, z - 0.47, z + 0.47, granite);
  s.cyl(1.05, 0.95, 6.3, 7.9, 0, z, 8, granite).cyl(1, 1, 7.9, 8.15, 0, z, 8, granite);
  s.box(-1, 1, 8.15, 10.25, z - 0.55, z + 0.55, granite).box(-1.25, 1.25, 9.85, 10.3, z - 0.55, z + 0.55, granite);
  s.cyl(0.28, 0.28, 10.25, 10.6, 0, z, 8, granite);
  s.add(new THREE.SphereGeometry(0.5, 10, 8), granite, at(0, 11, z));
  s.cyl(0.55, 0.55, 11.25, 11.55, 0, z, 10, granite).cyl(0.62, 0.62, 11.55, 11.73, 0, z, 10, granite);
  s.box(-0.45, 0.45, 11.26, 11.34, z + 0.27, z + 0.72, granite); // the cap's peak, towards you
  s.box(0.97, 1.53, 7.6, 10.2, z - 0.3, z + 0.3, granite); // left arm, hanging
  const V = (x, y, dz) => new THREE.Vector3(x, y, z + dz);
  s.beam(V(-1.2, 10, 0), V(-2.3, 10.3, 0.1), 0.5, 0.55, granite).beam(V(-2.3, 10.3, 0.1), V(-0.55, 11.15, 0.35), 0.42, 0.45, granite);
  return s;
}

// Everything between you and the gate, and round it: the avenue, walks, bollards, lawns, pools, trees, lamps.
function groundsGeometry(s, tier, lanterns) {
  const plane = (x0, x1, z0, z1, y, color) => s.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2));
  const lawn = '#1c3020', granite = '#6e3d34', pavers = '#6f5546', asphalt = '#1c1b22', kerb = '#5e6b66';
  plane(-1500, 1500, -1500, 200, 0, '#121212');
  // Each layer stands LAYER above the one it lies on: the lawn on the ground, the paving on the lawn.
  const L1 = LAYER, L2 = 2 * LAYER;
  plane(-256, 256, GZ - 108, GZ + 159, L1, lawn);
  for (const sx of [-1, 1]) plane(sx > 0 ? 6 : -9, sx > 0 ? 9 : -6, GZ + 44.5, 20, L2, granite);
  plane(-23, 23, GZ - 44.5, GZ + 44.5, L2, pavers); // the gate plaza
  plane(-4, 4, CANOPY_Z + 14, GZ - 44.5, L2, granite); // the walk on to the canopy
  // The centre line of the avenue, as in the picture.
  for (let z = 14; z > GZ + 48; z -= 9) s.box(-0.12, 0.12, L2, L2 + 0.03, z - 2.2, z + 2.2, '#cfc6b8');
  // The hexagon's ring road, centred on the canopy, its flat sides square to the avenue.
  const k = 1 / Math.cos(Math.PI / 6); // a hexagon's corners lie this much further out than its sides
  s.add(new THREE.RingGeometry(329 * k, 345 * k, 6, 1).rotateX(-Math.PI / 2), asphalt, at(0, L2, CANOPY_Z + 1));
  // Bollards: along both edges of the avenue, and round the gate.
  const bollard = (x, z) => s.box(x - 0.15, x + 0.15, 0, 0.7, z - 0.15, z + 0.15, '#c79a74');
  for (let z = 18; z > GZ + 44.5; z -= tier ? 2.5 : 5) for (const sx of [-1, 1]) bollard(sx * 9.2, z);
  for (let x = -18; x <= 18; x += tier ? 2.5 : 5) for (const z of [GZ - 30, GZ + 22]) bollard(x, z);
  for (let z = GZ - 30; z <= GZ + 22; z += tier ? 2.5 : 5) for (const sx of [-1, 1]) bollard(sx * 18, z);
  // The India Gate pools either side, out of line with the gate, with their round basins.
  for (const sx of [-1, 1]) {
    for (const kx of [76, 100]) s.box(sx * kx - 0.25, sx * kx + 0.25, 0, 0.4, GZ + 9, GZ + 151, kerb);
    for (const kz of [GZ + 9, GZ + 151]) s.box(sx > 0 ? 76 : -100, sx > 0 ? 100 : -76, 0, 0.4, kz - 0.25, kz + 0.25, kerb);
    s.add(new THREE.TorusGeometry(19, 0.3, 4, tier ? 40 : 20).rotateX(-Math.PI / 2), kerb, at(sx * 91, 0.25, GZ - 4));
  }
  // The canopy's pool kerb.
  for (const sz of [-1, 1]) s.box(-27.75, 27.75, 0, 0.45, CANOPY_Z + sz * 14 - 0.25, CANOPY_Z + sz * 14 + 0.25, kerb);
  for (const sx of [-1, 1]) s.box(sx * 27.75 - 0.25, sx * 27.75 + 0.25, 0, 0.45, CANOPY_Z - 14, CANOPY_Z + 14, kerb);
  // Jamun trees in two rows each side, along the avenue and on past the gate.
  const rnd = mulberry(5), tree = (x, z) => {
    const r = 5.5 * (0.85 + rnd() * 0.3);
    s.add(new THREE.IcosahedronGeometry(r, tier ? 1 : 0), rnd() < 0.5 ? '#13241a' : '#1a3322', at(x, 9.5, z));
    s.cyl(0.4, 0.3, 0, 7, x, z, 5, '#2a1e16');
  };
  for (let z = 128.5; z > -260; z -= tier ? 15.5 : 31) for (const sx of [-1, 1]) { tree(sx * 41, GZ + z); tree(sx * 65, GZ + z + 10); }
  // A band of trees and low heritage buildings beyond the ring road (no high-rises in Lutyens' Delhi).
  for (let i = 0; i < (tier ? 60 : 30); i++) {
    const a = -Math.PI * 0.9 + rnd() * Math.PI * 1.8, d = 420 + rnd() * 260, x = Math.sin(a) * d, z = CANOPY_Z - Math.cos(a) * d * 0.9;
    if (rnd() < 0.3) s.box(x - 15, x + 15, 0, 12 + rnd() * 6, z - 10, z + 10, '#23201d');
    else s.add(new THREE.IcosahedronGeometry(9 + rnd() * 5, 0), '#0f1c13', at(x, 10, z));
  }
  s.box(-86, 96, 0, 18, GZ - 729, GZ - 673, '#1a1816'); // the stadium's west stand, far beyond
  // Lantern standards along the avenue, as in the picture: a dark post, a cross-arm, the lantern.
  for (let z = 15; z > GZ + 50; z -= 22) for (const sx of [-1, 1]) {
    s.cyl(0.16, 0.1, 0, 7, sx * 10, z, 6, '#16151a');
    lanterns.box(sx * 10 - 0.35, sx * 10 + 0.35, 6.6, 7.6, z - 0.35, z + 0.35, '#ffd27a');
    s.cyl(0.42, 0.05, 7.6, 8.1, sx * 10, z, 4, '#16151a');
  }
  // The National War Memorial's obelisk.
  s.add(new THREE.CylinderGeometry(0.85, 1.7, 15.5, 4).rotateY(Math.PI / 4), '#5a5a60', at(0, 7.75, MEMORIAL_Z));
  return s;
}

// ---------- Decals: one drawn sheet, cut into quads on the faces you see ----------
const SHEET = 1024;
function decalSheet() {
  const c = document.createElement('canvas'); c.width = c.height = SHEET;
  const g = c.getContext('2d');
  const LIGHT = 'rgba(255,240,215,0.95)', GROOVE = 'rgba(70,45,25,0.85)';
  // Incised lettering, lit from below: the groove's shadow sits above the letters.
  const carve = (text, x, y, size, weight = 600) => {
    g.font = `${weight} ${size}px Georgia, 'Times New Roman', serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = GROOVE; g.fillText(text, x, y - size * 0.05);
    g.fillStyle = LIGHT; g.fillText(text, x, y);
  };
  const sun = (x, y, r) => {
    g.save(); g.translate(x, y);
    for (const [d, col] of [[-1.5, GROOVE], [0, LIGHT]]) {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = r * 0.12;
      g.beginPath(); g.arc(0, d, r * 0.32, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.45, d + Math.sin(a) * r * 0.45); g.lineTo(Math.cos(a) * r, d + Math.sin(a) * r); g.stroke(); }
    }
    g.restore();
  };
  // Frieze: 13 rayed suns, modillion blocks along its top (31 x 2.3 m).
  g.fillStyle = 'rgba(70,45,25,0.18)'; g.fillRect(0, 0, 1024, 76);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(70,45,25,0.5)'; g.fillRect(8 + i * 72.7, 0, 22, 10); }
  for (let i = 0; i < 13; i++) sun(512 + (i - 6) * 75.3, 42, 24);
  // INDIA tablet (11 x 2.6 m) with a thin border.
  g.strokeStyle = GROOVE; g.lineWidth = 3; g.strokeRect(6, 86, 500, 109);
  carve('INDIA', 256, 142, 72);
  // Date roundels: MCM over XIV, MCM over XIX.
  for (const [i, low] of [[0, 'XIV'], [1, 'XIX']]) {
    const cx = 584 + i * 136, cy = 144;
    g.strokeStyle = GROOVE; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = LIGHT; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy + 1.5, 58, 0, Math.PI * 2); g.stroke();
    carve('MCM', cx, cy - 18, 30); carve(low, cx, cy + 20, 30);
  }
  // Pier roundel: a plain sunk dish with a raised disc.
  g.fillStyle = 'rgba(60,40,24,0.55)'; g.beginPath(); g.arc(912, 144, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,236,205,0.55)'; g.beginPath(); g.arc(912, 144, 32, 0, Math.PI * 2); g.fill();
  // The dedication: one line, then three, too fine to read from here.
  const ded = ['TO THE DEAD OF THE INDIAN ARMIES WHO FELL AND ARE HONOURED',
    'IN FRANCE AND FLANDERS MESOPOTAMIA AND PERSIA EAST AFRICA GALLIPOLI AND ELSEWHERE IN THE NEAR AND FAR EAST',
    'AND IN SACRED MEMORY ALSO OF THOSE WHOSE NAMES ARE HERE RECORDED AND WHO FELL IN INDIA OR THE NORTH WEST FRONTIER',
    'AND DURING THE THIRD AFGHAN WAR'];
  for (let i = 0; i < 4; i++) carve(ded[i], 512, 226 + i * 22, i ? 13 : 16, 500);
  // Sunk panels on the piers: a little darker, a shadow along the top.
  for (const [x, h] of [[0, 208], [104, 86]]) {
    g.fillStyle = 'rgba(70,45,25,0.16)'; g.fillRect(x + 4, 340, 92, h);
    g.fillStyle = 'rgba(70,45,25,0.45)'; g.fillRect(x + 4, 340, 92, 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Regions of the sheet, in pixels: [x, y, w, h].
const REG = {
  frieze: [0, 0, 1024, 76], india: [0, 82, 512, 117], xiv: [520, 80, 128, 128], xix: [656, 80, 128, 128], dish: [848, 80, 128, 128],
  ded: [0, 212, 1024, 98], panel: [0, 338, 100, 212], panelHigh: [104, 338, 100, 90],
};
function decalGeometry(quads) {
  const pos = [], uv = [], nor = [];
  for (const [[rx, ry, rw, rh], x, y, z, w, h] of quads) {
    const u0 = rx / SHEET, u1 = (rx + rw) / SHEET, v1 = 1 - ry / SHEET, v0 = 1 - (ry + rh) / SHEET;
    const p = [[x - w / 2, y - h / 2, u0, v0], [x + w / 2, y - h / 2, u1, v0], [x + w / 2, y + h / 2, u1, v1], [x - w / 2, y + h / 2, u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(p[k][0], p[k][1], z); uv.push(p[k][2], p[k][3]); nor.push(0, 0, 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// Diyas along the avenue, the plaza, the bollards round the gate and the pools; the lanterns. [x, y, z, colour]
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lantern = '#ffe6a8', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) {
    for (let z = 17; z > GZ + 44.5; z -= step) { out.push([sx * 6, 0.15, z, diya]); out.push([sx * 8.8, 0.15, z, diya]); }
    for (let z = GZ + 44.5; z > GZ - 44.5; z -= step * 1.5) out.push([sx * 23, 0.15, z, diya]);
    for (let z = GZ - 30; z <= GZ + 22; z += 2.5) out.push([sx * 18, 0.15, z + 0.4, diya]);
    for (const kx of [76, 100]) for (let z = GZ + 9; z < GZ + 151; z += step * 2) out.push([sx * kx, 0.55, z, diya]);
    for (let z = 15; z > GZ + 50; z -= 22) for (const dy of [0, 0.25]) out.push([sx * 10, 7.1 + dy, z, lantern]);
    // A ring just outside the gate's base, the passages left clear.
    for (let z = -10.3; z <= 10.3; z += step * 0.7) if (Math.abs(z) > LEG_Z + 0.3) out.push([sx * 16.8, 0.15, GZ + z, diya]);
  }
  for (let x = -23; x <= 23; x += step * 1.5) for (const z of [GZ + 44.5, GZ - 44.5]) out.push([x, 0.15, z, diya]);
  for (let x = -16.8; x <= 16.8; x += step * 0.7) if (Math.abs(x) > R + 0.3) for (const z of [GZ + 10.3, GZ - 10.3]) out.push([x, 0.15, z, diya]);
  // Far city lights low on the horizon, as in the picture.
  const rnd = mulberry(77);
  for (let i = 0; i < (tier ? 90 : 45); i++) { const a = -1.2 + rnd() * 2.4, d = 700 + rnd() * 300; out.push([Math.sin(a) * d, 2 + rnd() * 14, CANOPY_Z - Math.cos(a) * d, rnd() < 0.7 ? '#ffd28a' : '#ffffff']); }
  out.push([0, 0.6, MEMORIAL_Z + 2, '#ff8a1f'], [0.3, 0.9, MEMORIAL_Z + 2, '#ffc04a']); // the eternal flame
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = masonryTexture();
  const lit = new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a2810' });
  const glow = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  const objects = [];
  const gate = gateGeometry(new Stone((x, y) => gateColour(x, y), inPassage), tier);
  const front = gate.mesh(0, lit), vault = gate.mesh(1, glow);
  const vc = vault.geometry.attributes.color;
  const warm = new THREE.Color('#ffd27a');
  for (let k = 0; k < vc.count; k++) vc.setXYZ(k, warm.r, warm.g, warm.b); // the vault glows warm yellow
  for (const m of [front, vault]) { m.position.z = GZ; objects.push(m); }
  objects.push(canopyGeometry(new Stone((x, y, z, n, base) => tmpCol.copy(base).multiplyScalar(base.r > 0.5 ? 1.1 - y * 0.008 : 1)), tier).mesh(0, lit));
  objects.push(statueGeometry(new Stone(), tier).mesh(0, new THREE.MeshLambertMaterial({ color: '#2a2a2e' })));
  const lanterns = new Stone();
  objects.push(groundsGeometry(new Stone(), tier, lanterns).mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })));
  objects.push(lanterns.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })));
  // The carving on the face you see.
  const F = HZ + 0.03;
  const quads = [
    [REG.frieze, 0, 26.15, F, 31, 2.3],
    [REG.india, 0, 36.6, 6.03, 11, 2.6], [REG.xiv, -7, 36.6, 6.03, 2.9, 2.9], [REG.xix, 7, 36.6, 6.03, 2.9, 2.9],
    [REG.ded, 0, 33.05, 8.18, 24, 1.85],
    ...[-1, 1].flatMap((sx) => [[REG.dish, sx * 11.3, 22.4, F, 3.4, 3.4], [REG.panel, sx * 10, 8.55, F, 3, 6.5], [REG.panelHigh, sx * 10, 15.65, F, 3, 2.7]]),
  ];
  const carving = new THREE.Mesh(decalGeometry(quads), new THREE.MeshLambertMaterial({ map: decalSheet(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: '#2a1808' }));
  carving.position.z = GZ;
  objects.push(carving);
  // Water: the canopy's pool and the India Gate pools, dark and still.
  const water = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: '#0a1230', transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 3 * LAYER, (z0 + z1) / 2); return m;
  };
  objects.push(water(-27.75, 27.75, CANOPY_Z - 14, CANOPY_Z + 14), water(76, 100, GZ + 9, GZ + 151), water(-100, -76, GZ + 9, GZ + 151));
  // The avenue where crackers stand: dark pavers.
  objects.push(forecourt({ rgb: [62, 56, 66], z0: GZ + 44.5, z1: 20, width: 12, tile: 1.6, joint: 'rgba(170,150,150,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -5.4, x1: 5.4, z0: -30, z1: -5 },
    // The 2D picture's twilight: deep blue overhead, purple, a warm glow at the horizon, soft clouds; no moon on Diwali.
    sky: ['#03061a', '#151b4c', '#5a3a7e', '#d0725e'],
    fog: ['#4a3366', 320, 1500],
    clouds: { colour: '#9a6aa8', count: tier ? 9 : 5, seed: 12 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.75, [-40, 25, 300]], ['#ffe0b8', 0.45, [150, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
