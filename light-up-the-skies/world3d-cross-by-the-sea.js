/* Light Up the Skies — 3D background: the Cross by the Sea on Diwali night, a fishing-coast shrine on the Tamil Nadu
   shore, seen from the paved seafront over the beach. Loaded by world3d.js when the Cross by the Sea is the chosen
   world. Its colours follow the game's 2D picture: a deep blue night going violet and sunset orange at the horizon, the
   tall cross glowing gold over a floodlit stone keep on a heap of boulders, a domed chapel on the rocks to its left,
   surf breaking white round the rocks and a dark sea full of boat lights.

   Proportions follow the picture and the coast's seaside crosses: boulders rising about 8 m out of the sea, a walled
   terrace to 10 m, a square keep to 19 m with a crenellated parapet, a stepped pedestal and a 2 m wide cross reaching
   46 m, its arms 14 m across. The chapel is a square hall under a drum, a dome and a lantern, about 22 m to the cross
   on top. Everything is a box, an extruded outline, a lathe or a jittered boulder, merged into a few meshes with one
   drawn masonry texture; the floodlit look is baked into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the island's local origin is the centre of the keep at sea level. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const CX = 6, CZ = -150; // the cross's island, out beyond the surf
const CH = { x: -44, z: -128 }; // the chapel's rocks, to the left
const SEA = -1.8; // the sea's surface, below the seafront
const SHORE = -40; // the seafront's sea wall; the beach runs down from it
const KEEP = 19; // the keep's roof
const LIGHT = { x: 175, z: -235 }; // the lighthouse on the headland to your right
// The beach: a step down from the seafront, sloping under the surf about 35 m out.
const sandY = (z) => -0.4 + ((z - SHORE) / 60) * 2.4;

// ---------- Masonry: sandstone in courses of 0.4 and 0.6 m, one tile per 4 m ----------
function masonryTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(29), px = 256 / 4;
  g.fillStyle = '#f0dcbc'; g.fillRect(0, 0, 256, 256);
  let y = 0, row = 0;
  while (y < 256) {
    const h = (row % 2 ? 0.6 : 0.4) * px;
    let x = -(row % 3) * 26;
    while (x < 256) {
      const w = (0.9 + rnd() * 0.9) * px, v = 0.86 + rnd() * 0.14;
      g.fillStyle = `rgb(${(240 * v) | 0},${(220 * v) | 0},${(188 * v) | 0})`;
      g.fillRect(x + 1, y + 1, w - 2, h - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(70,48,26,0.45)'; g.fillRect(0, y, 256, 1.3);
    y += h; row++;
  }
  for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(80,56,34,${rnd() * 0.1})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 5); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a vertex colour (in world space). frame, when set, places everything added.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) { this.set = { pos: [], nor: [], uv: [], col: [] }; this.colour = colour; this.frame = null; }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (this.frame) g.applyMatrix4(this.frame);
    const p = g.attributes.position, base = new THREE.Color(color), set = this.set;
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
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
  // An outline in the x-y plane, less any holes, extruded from z0 to z1.
  extrudeZ(pts, z0, z1, color, holes = []) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return this.add(new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }), color, at(0, 0, z0));
  }
  lathe(profile, x, y, z, seg, color) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  // A beam w x h in section from point a to point b.
  beam(a, b, w, h, color) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, len, h), color, m);
  }
  // A boulder: a jittered icosahedron sx x sy x sz round (x, y, z), its shared corners moved alike so it stays closed.
  rock(x, y, z, sx, sy, sz, rot, detail, color) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), h = Math.sin(px * 12.99 + py * 78.23 + pz * 37.72 + x) * 43758.55, k = 0.78 + (h - Math.floor(h)) * 0.4;
      p.setXYZ(i, px * k, Math.max(py * k, -0.55), pz * k);
    }
    return this.add(g, color, new THREE.Matrix4().makeRotationY(rot).scale(new THREE.Vector3(sx, sy, sz)).setPosition(x, y, z));
  }
  mesh(material) {
    const s = this.set;
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

// A round-headed opening over (cx, sill), springing at spring, half wide: its outline, for a lit window or a door.
const roundArch = (cx, sill, spring, half, n) => [[cx - half, sill], [cx + half, sill], ...Array.from({ length: n + 1 }, (_, i) => {
  const a = (i / n) * Math.PI; return [cx + Math.cos(a) * half, spring + Math.sin(a) * half];
})];

// The floodlit gold of the picture, by height: brightest on the keep where the floods graze up, dimmer at the sea.
const BANDS = [[SEA + 2, '#5a3c26', '#8a5c36'], [8, '#c08048', '#f0b46a'], [KEEP, '#ffc070', '#f2a85a'], [99, '#e89a52', '#d88a48']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function stoneColour(x, y, z, n, base) {
  let lo = SEA;
  const face = n.z > 0.5 ? 1 : n.y > 0.5 ? 0.9 : 0.72; // the floods stand on the shore: the faces towards you shine
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)).multiply(base).multiplyScalar(face);
    lo = top;
  }
  return tmpCol.copy(BANDS[BANDS.length - 1][2]).multiply(base).multiplyScalar(face);
}
// Boulders: dark and wet at the waterline, warm gold where the island's lamps reach them.
const ROCK_LO = new THREE.Color('#1c1814'), ROCK_HI = new THREE.Color('#b88a5c');
const rockColour = (x, y, z, n, base) => tmpCol.copy(ROCK_LO).lerp(ROCK_HI, clamp((y - SEA) / 9, 0, 1) ** 0.8).multiply(base).multiplyScalar(0.55 + 0.45 * Math.max(0, n.z * 0.7 + n.y * 0.5));
// The glowing pieces: the faces you look at brightest, the sides of the cross a deeper amber.
const glowColour = (x, y, z, n, base) => tmpCol.copy(base).multiplyScalar(Math.abs(n.z) > 0.5 ? 1 : Math.abs(n.y) > 0.5 ? 0.85 : 0.62);

// The cross's island around its own origin: the keep, the terrace, the hall to the right, stairs, and the cross.
function islandGeometry(s, lit, tier) {
  const buff = '#ffffff', shade = '#6a4c38', lamp = '#ffcf78', n = tier ? 8 : 4;
  s.frame = lit.frame = at(CX, 0, CZ);
  // The lower terrace, its wall following the rocks, a walk along its top.
  s.box(-22, 18, SEA, 8, -12, 8, buff).box(-22.4, 18.4, 8, 8.5, -12.4, 8.4, buff);
  for (let x = -21.8; x < 18; x += tier ? 1.6 : 3.2) s.box(x, x + 0.8, 8.5, 9.4, 7.8, 8.4, buff); // merlons
  // The keep: a square tower over the terrace, a lit arched door and windows on its face.
  s.box(-8, 8, 8, KEEP, -8, 6, buff);
  s.box(-8.5, 8.5, 12.6, 13.1, -8.5, 6.5, buff).box(-8.6, 8.6, KEEP - 0.6, KEEP, -8.6, 6.6, buff);
  for (let x = -8.4; x < 8.4; x += tier ? 1.3 : 2.6) for (const z of [6.1, -8.6]) s.box(x, x + 0.7, KEEP, KEEP + 1.2, z, z + 0.5, buff);
  for (const sx of [-1, 1]) s.box(sx * 8.6 - 0.25, sx * 8.6 + 0.25, KEEP, KEEP + 1.2, -8.6, 6.6, buff);
  for (const [cx, y0, y1, h] of [[0, 8.5, 11.4, 1.3], [-4.6, 14.2, 16.4, 0.7], [-1.6, 14.2, 16.4, 0.7], [1.6, 14.2, 16.4, 0.7], [4.6, 14.2, 16.4, 0.7], [-4.6, 9.4, 11, 0.6], [4.6, 9.4, 11, 0.6]]) {
    s.extrudeZ(roundArch(cx, y0 - 0.25, y1, h + 0.25, n), 6, 6.25, shade); // a deep reveal round each opening
    lit.extrudeZ(roundArch(cx, y0, y1, h, n), 6.25, 6.32, cx || y0 > 9 ? '#ffc868' : '#ffd88a');
  }
  // The pedestal: stepped stone, a lit band, the cross on top.
  s.box(-4.2, 4.2, KEEP, KEEP + 1.4, -4.2, 2.2, buff).box(-3.2, 3.2, KEEP + 1.4, KEEP + 3.6, -3.2, 1.2, buff);
  s.box(-3.6, 3.6, KEEP + 3.6, KEEP + 4.2, -3.6, 1.6, buff).box(-2.2, 2.2, KEEP + 4.2, KEEP + 6, -2.2, 0.2, buff);
  const B = KEEP + 6, TOPC = 46, ARM = 37.2; // the cross: shaft to 46 m, arms centred at 37.2 m
  lit.box(-1, 1, B, TOPC, -1.8, 0, '#ffb444');
  lit.box(-7, 7, ARM - 1, ARM + 1, -1.8, 0, '#ffb444');
  // Its face: a raised, brighter panel inset from the edge, as in the picture.
  lit.box(-0.55, 0.55, B + 0.6, TOPC - 0.45, 0, 0.18, '#ffe7a6').box(-6.55, 6.55, ARM - 0.55, ARM + 0.55, 0, 0.18, '#ffe7a6');
  // The hall to the right: lower, with a row of lit arched windows and a little dome behind.
  s.box(10, 26, SEA, 13, -10, 4, buff).box(9.6, 26.4, 13, 13.6, -10.4, 4.4, buff);
  for (let x = 10.2; x < 26; x += tier ? 1.4 : 2.8) s.box(x, x + 0.7, 13.6, 14.4, 3.9, 4.4, buff);
  for (let i = 0; i < 4; i++) {
    const cx = 12.4 + i * 3.8;
    s.extrudeZ(roundArch(cx, 8.75, 11, 0.95, n), 4, 4.2, shade);
    lit.extrudeZ(roundArch(cx, 9, 11, 0.7, n), 4.2, 4.27, '#ffc464');
    lit.box(cx - 0.6, cx + 0.6, 4.6, 6.4, 4, 4.27, '#ffb04c');
  }
  s.box(17, 23, 13.6, 16, -8, -2, buff).lathe([[3.4, 0], [3.3, 1], [2.6, 2.4], [1.2, 3.3], [0, 3.6]], 20, 16, -5, tier ? 12 : 8, buff);
  // The left wing: a low wall and a stair climbing from the boat landing to the terrace.
  s.box(-30, -21, SEA, 5, -6, 6, buff).box(-30.3, -20.7, 5, 5.4, -6.3, 6.3, buff);
  for (let i = 0; i < 9; i++) s.box(-19 + i * 1.1, -10 + i * 1.1, SEA, 0.4 + i * 0.85, 8 + 4.2 - i * 0.45, 8 + 4.6 - i * 0.45, buff);
  s.box(-21, -9, SEA, 0.6, 8, 13, buff); // the landing
  // Lamps along the wall tops: a lit lantern on a short post.
  for (const [x, y, z] of ISLAND_LAMPS) { s.box(x - 0.08, x + 0.08, y - 1.1, y - 0.2, z - 0.08, z + 0.08, '#2a2018'); lit.box(x - 0.22, x + 0.22, y - 0.2, y + 0.3, z - 0.22, z + 0.22, lamp); }
  s.frame = lit.frame = null;
}
const ISLAND_LAMPS = [[-20, 9.9, 7.6], [-12, 9.9, 7.6], [12, 14.6, 4.1], [24, 14.6, 4.1], [-29, 6.4, 5.6], [-22, 6.4, 5.6], [-20, 1.6, 12.6], [-10, 1.6, 12.6], [16, 9.9, 7.6]];

// The heap of boulders under the island: a ring round the walls, rising to the terrace, and loose ones in the surf.
function islandRocks(s, tier) {
  const rnd = mulberry(13), d = tier > 1 ? 1 : 0;
  s.colour = rockColour;
  const ring = tier ? 34 : 20;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + rnd() * 0.15, rx = 30 + rnd() * 6, rz = 17 + rnd() * 4;
    const x = CX + Math.cos(a) * rx - 4, z = CZ + Math.sin(a) * rz - 1, h = 2.5 + rnd() * 3 + (Math.sin(a) < 0 ? 2 : 0);
    s.rock(x, SEA + h * 0.35, z, 4 + rnd() * 4, h, 3 + rnd() * 3, rnd() * 3, d, '#ffffff');
  }
  // The big boulders heaped against the front, rising to the keep as in the picture.
  for (const [x, y, z, sx, sy, sz] of [[-2, 2.6, 10, 7, 5.5, 5], [6, 3.4, 9, 5.5, 5, 4.5], [-10, 2, 11, 6, 4.4, 4.5], [14, 2.2, 10, 5, 4.4, 4], [22, 1.8, 9.5, 6, 4, 4.5],
    [-18, 1.6, 15, 5, 3.6, 4], [3, 0.8, 15, 8, 3.2, 4], [16, 0.6, 14, 6, 3, 4], [-26, 1, 10, 5, 3.4, 4], [30, 1, 4, 5, 4, 5], [-34, 0.6, 2, 5, 3, 5]]) {
    s.rock(CX + x, y + SEA + 1.6, CZ + z, sx, sy, sz, rnd() * 3, d, '#ffffff');
  }
  for (let i = 0; i < (tier ? 12 : 6); i++) s.rock(CX - 40 + rnd() * 80, SEA + 0.2, CZ + 18 + rnd() * 10, 1.5 + rnd() * 2.5, 1 + rnd() * 1.2, 1.5 + rnd() * 2, rnd() * 3, 0, '#ffffff');
  // The chapel's rocks, and a reef of them linking it to the island.
  for (let i = 0; i < (tier ? 16 : 10); i++) {
    const a = (i / 16) * Math.PI * 2, x = CH.x + Math.cos(a) * (13 + rnd() * 3), z = CH.z + Math.sin(a) * (9 + rnd() * 2);
    s.rock(x, SEA + 0.6, z, 3 + rnd() * 3, 2 + rnd() * 2, 2.5 + rnd() * 2, rnd() * 3, d, '#ffffff');
  }
  for (let x = CH.x + 14; x < CX - 30; x += 4) s.rock(x, SEA + 0.4, CH.z - 6 - (x - CH.x) * 0.3 + rnd() * 2, 3, 1.6 + rnd(), 2.5, rnd() * 3, 0, '#ffffff');
  s.colour = null;
}

// The chapel on its rocks: a square hall, a drum, a dome and a lantern with its own small cross; a long low wing.
function chapelGeometry(s, lit, tier) {
  const buff = '#ffffff', shade = '#6a4c38', seg = tier ? 14 : 8, n = tier ? 6 : 3;
  s.frame = lit.frame = at(CH.x, 0, CH.z);
  s.box(-11, 11, SEA, 3, -8, 7, buff); // the platform on the rocks
  s.box(-5, 5, 3, 10, -5, 5, buff).box(-5.4, 5.4, 10, 10.6, -5.4, 5.4, buff);
  s.cyl(3.6, 3.6, 10.6, 14.4, 0, 0, seg, buff).cyl(4, 4, 14.4, 14.9, 0, 0, seg, buff);
  s.lathe([[3.8, 0], [3.7, 1.4], [3.1, 2.8], [2, 3.9], [0.8, 4.4], [0, 4.5]], 0, 14.9, 0, seg, buff);
  s.cyl(0.9, 0.9, 19.2, 20.6, 0, 0, 6, buff).lathe([[1.1, 0], [0.7, 0.6], [0, 1]], 0, 20.6, 0, 6, buff);
  s.box(-0.1, 0.1, 21.4, 23.2, -0.1, 0.1, buff).box(-0.55, 0.55, 22.4, 22.6, -0.1, 0.1, buff);
  for (const [cx, y0, y1, h] of [[0, 3, 6, 1.1], [-3, 6.8, 8.6, 0.5], [3, 6.8, 8.6, 0.5]]) {
    s.extrudeZ(roundArch(cx, y0, y1, h + 0.2, n), 5, 5.15, shade);
    lit.extrudeZ(roundArch(cx, y0 + 0.2, y1, h, n), 5.15, 5.22, '#ffc464');
  }
  for (let i = 0; i < (tier ? 8 : 4); i++) { const a = (i / (tier ? 8 : 4)) * Math.PI * 2 + 0.4; lit.box(Math.cos(a) * 3.5 - 0.3, Math.cos(a) * 3.5 + 0.3, 11.6, 13.4, Math.sin(a) * 3.5 - 0.3, Math.sin(a) * 3.5 + 0.3, '#ffcf7a'); }
  // The wing towards the island, lit windows along it.
  s.box(5, 24, SEA, 7, -4, 4, buff).box(4.7, 24.3, 7, 7.5, -4.3, 4.3, buff);
  for (let x = 7.5; x < 23; x += 3) lit.box(x - 0.5, x + 0.5, 3.6, 5.4, 4, 4.08, '#ffcf78');
  s.frame = lit.frame = null;
}

// A frond: a flat blade from its base over mid to the tip, half wide at mid, (sx, sz) across it; both faces drawn.
function leaf(s, a, mid, tip, sx, sz, half, color) {
  const l = [mid.x - sx * half, mid.y, mid.z - sz * half], r = [mid.x + sx * half, mid.y, mid.z + sz * half], b = [a.x, a.y, a.z], t = [tip.x, tip.y, tip.z];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...b, ...l, ...r, ...b, ...r, ...l, ...l, ...t, ...r, ...l, ...r, ...t], 3));
  return s.add(g, color);
}

// A coconut palm: a leaning trunk in segments and drooping fronds.
function palm(s, rnd, x, z, h, tier) {
  const lean = (rnd() - 0.5) * 0.25, dir = rnd() * Math.PI * 2, segs = tier > 1 ? 4 : 2, top = new THREE.Vector3();
  let prev = new THREE.Vector3(x, 0, z);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs, p = new THREE.Vector3(x + Math.cos(dir) * lean * h * t * t, h * t, z + Math.sin(dir) * lean * h * t * t);
    s.beam(prev, p, 0.42 - t * 0.12, 0.42 - t * 0.12, '#3a2a1e'); prev = p;
  }
  top.copy(prev);
  const k = tier ? 8 : 5;
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + rnd(), l = 3.6 + rnd() * 1.2;
    const mid = top.clone().add(new THREE.Vector3(Math.cos(a) * l * 0.55, 0.9, Math.sin(a) * l * 0.55));
    const tip = top.clone().add(new THREE.Vector3(Math.cos(a) * l, -1.4, Math.sin(a) * l));
    leaf(s, top, mid, tip, Math.sin(a), -Math.cos(a), 0.5, '#1e341c');
  }
}

// A kattumaram or a planked fishing boat drawn up on the sand (or afloat), along its own z.
function fishingBoat(s, x, y, z, rot, len, hull) {
  s.frame = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
  s.box(-0.8, 0.8, 0, 0.8, -len / 2, len / 2, hull).box(-0.85, 0.85, 0.8, 0.95, -len / 2, len / 2, '#c8b89c');
  s.add(new THREE.CylinderGeometry(0.8, 0.01, 2, 3).rotateX(-Math.PI / 2).rotateZ(Math.PI).scale(1, 0.5, 1), hull, at(0, 0.6, -len / 2 - 1));
  s.box(-0.04, 0.04, 0.95, 3.4, -len / 6 - 0.04, -len / 6 + 0.04, '#2a2018');
  s.frame = null;
}

// The coast round the cross: the seafront, the beach and its boats, palms, the village, the headland and lighthouse.
function coastGeometry(s, lit, tier) {
  const L1 = LAYER, ground = '#17140f', pavers = '#4a423c', wall = '#5a4c40';
  // The land behind the sea wall; the seafront's paving lies LAYER above it, the forecourt a LAYER above that.
  s.plane(-600, 600, SHORE, 300, 0, ground);
  s.plane(-62, 62, SHORE, 32, L1, pavers);
  // The headland to your right, a low cliff of laterite reaching out to the lighthouse.
  const head = new THREE.Shape([[110, 40], [118, 90], [140, 150], [168, 205], [210, 262], [260, 290], [600, 300], [600, 40]].map(([x, z]) => new THREE.Vector2(x, z)));
  s.add(new THREE.ExtrudeGeometry(head, { depth: 9, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -9, 0), '#2a2018');
  // The beach: sand sloping from the sea wall under the surf, darker where it is wet.
  const sand = new THREE.PlaneGeometry(1200, 60, 40, 12).rotateX(-Math.PI / 2).translate(0, 0, SHORE - 30), sp = sand.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setY(i, sandY(sp.getZ(i)));
  const DRY = new THREE.Color('#6a5644'), WET = new THREE.Color('#2a2624');
  s.colour = (x, y) => tmpCol.copy(WET).lerp(DRY, clamp((y - SEA) / 0.6, 0, 1));
  s.add(sand, '#ffffff');
  s.colour = null;
  // The sea wall, a railing along its top (low, so the beach and the surf show over it) and steps down to the sand.
  s.box(-600, 110, SEA, 0, SHORE - 0.8, SHORE, wall);
  for (let x = -62; x <= 62; x += tier ? 2 : 4) if (Math.abs(x) > 3) s.box(x - 0.06, x + 0.06, 0, 0.95, SHORE + 0.15, SHORE + 0.27, '#2a2622');
  for (const [x0, x1] of [[-62, -3], [3, 62]]) s.box(x0, x1, 0.88, 0.98, SHORE + 0.13, SHORE + 0.29, '#2a2622');
  for (let i = 0; i < 2; i++) s.box(-3, 3, SEA, -0.15 - i * 0.15, SHORE - 0.8 - i * 0.5, SHORE - 0.3 - i * 0.5, wall);
  // Lamp posts along the seafront: a slim post, a curved arm, a lit lantern.
  for (const [x, z] of LAMPS) {
    s.cyl(0.14, 0.09, 0, 5.4, x, z, 6, '#141418').box(x - Math.sign(x) * 0.9, x, 5.3, 5.42, z - 0.05, z + 0.05, '#141418');
    lit.box(x - Math.sign(x) * 0.9 - 0.2, x - Math.sign(x) * 0.9 + 0.2, 4.85, 5.3, z - 0.2, z + 0.2, '#ffe2a0');
  }
  // Bollards along the forecourt, benches facing the sea.
  for (let z = 18; z > SHORE + 6; z -= tier ? 3 : 6) for (const sx of [-1, 1]) s.box(sx * 12.6 - 0.15, sx * 12.6 + 0.15, 0, 0.75, z - 0.15, z + 0.15, '#2a2420');
  for (const x of [-40, -26, 26, 40]) s.box(x - 1, x + 1, 0.4, 0.5, SHORE + 3, SHORE + 3.5, '#3a3028').box(x - 1, x + 1, 0.5, 1, SHORE + 3.45, SHORE + 3.55, '#3a3028');
  // Palms along the seafront, thicker in the village and on the headland.
  const rnd = mulberry(5);
  for (let z = 26; z > SHORE + 4; z -= tier ? 9 : 18) for (const sx of [-1, 1]) palm(s, rnd, sx * (17 + rnd() * 3), z, 8 + rnd() * 3, tier);
  for (let i = 0; i < (tier ? 26 : 12); i++) palm(s, rnd, -70 - rnd() * 110, SHORE + 6 + rnd() * 110, 8 + rnd() * 5, tier);
  for (let i = 0; i < (tier ? 18 : 8); i++) palm(s, rnd, 70 + rnd() * 90, SHORE + 8 + rnd() * 90, 8 + rnd() * 5, tier);
  // The fishing village to the left: low huts with thatched or tiled pitched roofs.
  for (const [x, z, w, d, roof] of HUTS.slice(0, tier ? HUTS.length : 8)) {
    s.box(x - w / 2, x + w / 2, 0, 2.6, z - d / 2, z + d / 2, '#6a5a4a');
    s.add(new THREE.CylinderGeometry(0.01, w * 0.62, 1.8, 4, 1).rotateY(Math.PI / 4).scale(1, 1, d / w), roof, at(x, 3.5, z));
    if (rnd() < 0.7) lit.box(x - 0.4, x + 0.4, 0.8, 1.9, z + d / 2, z + d / 2 + 0.06, '#ffb456');
  }
  // The town to the right: houses of two and three storeys with flat roofs, a few windows lit.
  for (const [x, z, w, h] of HOUSES.slice(0, tier ? HOUSES.length : 7)) {
    s.box(x - w / 2, x + w / 2, 0, h, z - 4, z + 4, rnd() < 0.5 ? '#5a5048' : '#4a4652').box(x - w / 2 - 0.2, x + w / 2 + 0.2, h, h + 0.6, z - 4.2, z + 4.2, '#3e3832');
    for (let f = 0; f < h / 3.2 - 0.5; f++) for (let k = -1; k <= 1; k++) if (rnd() < 0.5) lit.box(x + k * w * 0.28 - 0.5, x + k * w * 0.28 + 0.5, 1.2 + f * 3.2, 2.6 + f * 3.2, z + 4, z + 4.08, rnd() < 0.8 ? '#ffcf7a' : '#fff0c8');
  }
  // Boats drawn up on the sand, prows to the sea.
  for (const [x, z, rot, len, hull] of BEACH_BOATS.slice(0, tier ? BEACH_BOATS.length : 5)) fishingBoat(s, x, sandY(z), z, rot, len, hull);
  for (const [x, z, rot] of SEA_BOATS.slice(0, tier ? SEA_BOATS.length : 3)) fishingBoat(s, x, SEA - 0.4, z, rot, 8, '#2a3a5a');
  // The lighthouse: a white tower banded red, its gallery and lit lantern.
  const { x: lx, z: lz } = LIGHT;
  s.cyl(4.6, 3.4, 0, 34, lx, lz, tier ? 12 : 8, '#d8d0c4');
  for (const y of [8, 20]) s.cyl(4.3 - y * 0.034, 4.1 - y * 0.034, y, y + 4, lx, lz, tier ? 12 : 8, '#8a2a24');
  s.cyl(4.4, 4.4, 34, 34.8, lx, lz, 10, '#2a2a30');
  lit.cyl(2.3, 2.3, 34.8, 37.8, lx, lz, 8, '#fff2c0');
  s.lathe([[2.8, 0], [1.4, 1.2], [0, 1.8]], lx, 37.8, lz, 8, '#2a2a30');
  s.box(lx + 5, lx + 15, 0, 4, lz - 4, lz + 4, '#b8b0a4'); // the keeper's house
  return s;
}
const LAMPS = [];
for (let z = 22; z > SHORE; z -= 14) for (const sx of [-1, 1]) LAMPS.push([sx * 14, z]);
for (const x of [-56, -34, 34, 56]) LAMPS.push([x, SHORE + 1.4]);
const HUTS = [[-72, -22, 6, 5, '#3a2a1c'], [-84, -8, 7, 5, '#5a2a1e'], [-96, -26, 6, 5, '#3a2a1c'], [-110, -10, 8, 6, '#5a2a1e'], [-78, 10, 6, 5, '#3a2a1c'],
  [-124, -24, 6, 5, '#3a2a1c'], [-100, 18, 7, 6, '#5a2a1e'], [-140, 2, 8, 6, '#3a2a1c'], [-160, -20, 6, 5, '#5a2a1e'], [-126, 30, 7, 5, '#3a2a1c'], [-150, 40, 6, 5, '#5a2a1e'], [-176, 10, 8, 6, '#3a2a1c']];
const HOUSES = [[74, -26, 12, 7], [90, -20, 10, 10], [106, -28, 12, 7], [124, -14, 14, 10], [80, -2, 10, 7], [142, -26, 12, 10], [100, 6, 12, 7],
  [160, -8, 14, 7], [130, 18, 10, 10], [176, -30, 12, 7], [150, 30, 12, 10]];
const BEACH_BOATS = [[-22, -52, 0.15, 7, '#2a5a8a'], [-30, -50, -0.1, 8, '#8a3a2a'], [-46, -54, 0.25, 7, '#2a6a5a'], [-58, -51, -0.05, 9, '#3a4a8a'], [26, -52, -0.2, 7, '#8a6a2a'],
  [38, -50, 0.1, 8, '#2a5a8a'], [-70, -53, 0.3, 7, '#8a3a2a'], [52, -54, -0.15, 7, '#2a6a5a'], [-86, -50, 0, 8, '#3a4a8a'], [68, -51, 0.2, 7, '#8a3a2a']];
const SEA_BOATS = [[-90, -210, 0.8], [70, -260, -0.4], [-160, -300, 1.2], [140, -380, 0.3], [-40, -420, -0.9], [220, -150, 1.4]];

// The sea: dark blue, glowing gold round the floodlit island, rippled by bands of lighter and darker water.
function waterMesh(tier) {
  const g = new THREE.PlaneGeometry(4000, 2800, tier ? 44 : 30, tier ? 32 : 22).rotateX(-Math.PI / 2);
  g.translate(0, SEA, SHORE - 1400);
  const p = g.attributes.position, col = [], c = new THREE.Color(), deep = new THREE.Color('#0a1a40'), crest = new THREE.Color('#1c3c6c'), warm = new THREE.Color('#5a3c2c');
  const rnd = mulberry(3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x - CX, (z - CZ) * 0.7);
    c.copy(deep).lerp(crest, rnd() * 0.5).lerp(warm, clamp(1 - d / 90, 0, 1) * 0.6);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
// Surf and reflections, laid just over the sea: white foam where the waves break on the sand and round the rocks,
// long gold streaks under the cross and the lamps.
function surfMesh(tier) {
  const pos = [], col = [], c = new THREE.Color(), y = SEA + LAYER, rnd = mulberry(61);
  const quad = (q, hex, k) => { c.set(hex); for (const i of [0, 2, 1, 0, 3, 2]) { pos.push(q[i][0], y, q[i][1]); col.push(c.r * k[i], c.g * k[i], c.b * k[i]); } };
  // A band of foam: bright at its leading edge, fading behind; broken into lengths.
  const band = (x0, x1, z, w, hex, gap) => {
    for (let x = x0; x < x1;) {
      const l = 8 + rnd() * 26, zz = z + (rnd() - 0.5) * 2;
      quad([[x, zz], [x + l, zz], [x + l, zz - w], [x, zz - w]], hex, [1, 1, 0, 0]);
      x += l + rnd() * gap;
    }
  };
  band(-600, 600, -75, 2.4, '#c8d4e8', 2);
  band(-600, 600, -80, 3.4, '#8a9ab8', 10);
  for (let k = 0; k < (tier ? 3 : 2); k++) band(-600, 600, -92 - k * 13, 3, '#5a6a8a', 26);
  // Foam round the rocks: a ring of short strips facing out.
  const ring = (cx, cz, rx, rz, n, hex) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n * (0.6 + rnd() * 0.4), w = 2 + rnd() * 2.5;
      const p = (a, r) => [cx + Math.cos(a) * (rx + r), cz + Math.sin(a) * (rz + r)];
      quad([p(a0, 0), p(a1, 0), p(a1, w), p(a0, w)], hex, [1, 1, 0, 0]);
    }
  };
  ring(CX - 4, CZ - 1, 34, 20, tier ? 40 : 24, '#d8e0f0');
  ring(CX - 4, CZ - 1, 39, 25, tier ? 30 : 16, '#6a7a9a');
  ring(CH.x, CH.z, 16, 11, tier ? 24 : 14, '#c8d4e8');
  // Streaks: the cross's gold down the water towards you, the chapel's, the lighthouse's and the boats'.
  const streak = (x, z, hex, len, w) => quad([[x - w, z], [x + w, z], [x + w * 0.4, z + len], [x - w * 0.4, z + len]], hex, [1, 1, 0, 0]);
  streak(CX, CZ + 22, '#8a5a24', 58, 8);
  streak(CX, CZ + 22, '#c08a38', 45, 2.2);
  streak(CH.x, CH.z + 12, '#9a6628', 60, 5);
  for (const [x, z] of SEA_BOATS.slice(0, tier ? SEA_BOATS.length : 3)) streak(x, z, '#8a6028', 30, 1.2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// Diyas along the forecourt and the parapet; the island's and chapel's lamps; lamps; boats, village, town and far lights.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) for (let z = 18; z > SHORE + 6; z -= step) out.push([sx * 11.8, 0.25, z, diya]);
  for (let x = -60; x <= 60; x += step * 0.8) if (Math.abs(x) > 3.5) out.push([x, 0.95, SHORE + 0.22, diya]);
  for (const [x, z] of LAMPS) out.push([x - Math.sign(x) * 0.9, 5.1, z, lamp]);
  for (const [x, y, z] of ISLAND_LAMPS) out.push([CX + x, y + 0.05, CZ + z, '#ffd27a']);
  // Diyas along the island's terrace wall and the hall's parapet, and along the chapel's platform.
  for (let x = -21.5; x < 18; x += step * 0.7) out.push([CX + x, 9.6, CZ + 8.2, diya]);
  for (let x = 10.5; x < 26; x += step * 0.7) out.push([CX + x, 14.6, CZ + 4.2, diya]);
  for (let x = -10.5; x < 11; x += step * 0.7) out.push([CH.x + x, 3.3, CH.z + 7, diya]);
  out.push([CX, 46.6, CZ - 0.9, '#fff4d0'], [CH.x, 21.8, CH.z, '#ffe0a0']);
  // Boats out at sea: a lantern each and a masthead light.
  for (const [x, z] of SEA_BOATS.slice(0, tier ? SEA_BOATS.length : 3)) out.push([x, SEA + 1.4, z, '#ffc060'], [x, SEA + 3.2, z, '#ffffff']);
  out.push([LIGHT.x, 36.3, LIGHT.z, '#fff6d8'], [LIGHT.x, 36.3, LIGHT.z + 2.4, '#ffffff']);
  // Lamps in the village, windows across the town, ships and a far coast on the horizon.
  const rnd = mulberry(77);
  for (const [x, z] of HUTS.slice(0, tier ? HUTS.length : 8)) if (rnd() < 0.6) out.push([x + 1.6, 2.2, z + 3, '#ffb456']);
  for (let i = 0; i < (tier ? 50 : 25); i++) out.push([70 + rnd() * 130, 2 + rnd() * 8, -30 + rnd() * 70, '#ffd9a0']);
  for (let i = 0; i < (tier ? 16 : 8); i++) { const a = -1.2 + rnd() * 2.4, d = 900 + rnd() * 500; out.push([Math.sin(a) * d, SEA + 1 + rnd() * 3, -Math.cos(a) * d, rnd() < 0.7 ? '#ffe0a0' : '#ffffff']); }
  for (let i = 0; i < (tier ? 40 : 20); i++) out.push([260 + rnd() * 340, 1 + rnd() * 5, -250 - rnd() * 60, '#ffd28a']); // up the coast past the lighthouse
  return out;
}

/** The scene, for world3d.js: its meshes, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = masonryTexture();
  const stone = new Stone(stoneColour), lit = new Stone(glowColour);
  islandGeometry(stone, lit, tier);
  chapelGeometry(stone, lit, tier);
  const world = new Stone();
  islandRocks(world, tier);
  coastGeometry(world, lit, tier);
  const objects = [
    stone.mesh(new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#3a200c' })),
    world.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })),
    lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })),
    waterMesh(tier), surfMesh(tier),
  ];
  // The seafront where crackers stand: sandstone pavers.
  objects.push(forecourt({ rgb: [104, 92, 80], z0: SHORE, z1: 20, width: 24, tile: 2, joint: 'rgba(200,180,150,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower down, a sunset-orange glow along the sea; no moon on Diwali.
    sky: ['#03061a', '#151a4e', '#5a3a7c', '#d87848'],
    fog: ['#3a2c5a', 380, 1700],
    clouds: { colour: '#9a6a9a', count: tier ? 9 : 5, seed: 33 },
    moon: null, stars: tier ? 140 : 70,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.6, [-30, 30, 300]], ['#ffe0b8', 0.4, [150, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
