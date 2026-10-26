/* Light Up the Skies — 3D background: Golden Manor, a low-poly Georgian manor in its walled garden, seen from the
   paved terrace outside its gate. You arrive at golden hour and night falls within seconds (at once when the show
   starts): the sky goes from hazy amber to the game's deep navy, the stars come out, every window lights up warm in
   turn and the fountain's pool glows cyan. The fountain plays and the leaves and grass sway in the breeze.

   Everything is drawn from code, flat-shaded: boxes, cylinders, cones and lathes merged into a few meshes, the windows
   two instanced shapes (square-headed and arched), the fountain's water one cloud of points moved on the GPU, the sway a
   few lines added to the foliage's vertex shader, the gate's sign one small canvas. Built for phones: the low tier has
   fewer droplets, flowers and pickets, no sway, and asks for a new frame 20 times a second (30 and 60 on the higher
   tiers); once night has fallen only the fountain and the leaves still move.

   The house: a two-storey centre block 22 m wide under a slate hipped roof with dormers and two tall chimneys, a
   tetrastyle portico with a pediment and an oculus, and single-storey wings with balustraded flat roofs and tall arched
   windows.

   Frame: +x to your right, +y up, +z towards you; the house front is at z MZ. */
import * as THREE from './assets/vendor/three.module.min.js';
import { mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const MZ = -62; // the centre block's face
const FZ = -48; // the fountain's centre
const GZ = -40; // the garden gate, where the terrace ends
const FENCE = 24; // the picket fences, either side of the garden
const STONE = '#eadcc2', TRIM = '#f8f1e2', ROOF = '#3b4152', BRICK = '#b88a6a', IRON = '#26262c';
// The evening's two ends: hazy golden hour and the game's night (dark overhead so fireworks stand out).
const DUSK = { sky: ['#2a2f5e', '#7a6a8e', '#e9b07a', '#f6d39a'], fog: '#d8b48a', hemi: ['#ffe2bc', '#4a3c26', 1.2], dirs: [1.6, 0.2, 0.15], stars: 0.08, water: '#7a96b8', drops: '#e8f2ff' };
const NIGHT = { sky: ['#03061a', '#101a46', '#25305e', '#4a4470'], fog: '#1c2440', hemi: ['#4a5a96', '#1a1810', 0.7], dirs: [0, 1.1, 0.3], stars: 1, water: '#3fd4f4', drops: '#c9f4ff' };
const LIT = ['#ffd98c', '#ffe6b0', '#ffcf78', '#fff0cc'];
// How far the evening had got. A scene rebuilt moments later (a new Detail setting, a slower phone stepping down a
// tier) carries on from there instead of going back to golden hour.
let lastEvening = null;

// ---------- Parts: merges shapes, colouring every vertex; sway is metres of sway per metre above `base` ----------
class Parts {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.sway = []; }
  add(geo, color, m, sway = 0, base = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals(); // flat: every face its own normal
    const p = g.attributes.position, n = g.attributes.normal, c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(c.r, c.g, c.b); this.sway.push(sway * Math.max(0, p.getY(i) - base));
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color, sway, base) { return this.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), sway, base); }
  plane(x0, x1, z0, z1, y, color) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  cyl(r0, r1, y0, y1, x, z, seg, color, sway, base) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z), sway, base); }
  // A hipped roof: a four-sided frustum over a w x d rectangle, h high, its ridge `ridge` of the way in.
  roof(x, z, w, d, y, h, ridge = 0.3) {
    const g = new THREE.CylinderGeometry(ridge, 1, h, 4, 1).rotateY(Math.PI / 4);
    g.scale((w / 2) * Math.SQRT2, 1, (d / 2) * Math.SQRT2);
    return this.add(g, ROOF, at(x, y + h / 2, z));
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    return new THREE.Mesh(g, material);
  }
}

// A balustrade from a0 to a1 at height y: along x at z = fixed, or along z at x = fixed.
function balustrade(s, a0, a1, y, fixed, alongZ, tier) {
  const step = tier ? 0.45 : 0.9;
  for (let a = a0 + 0.2; a < a1 - 0.1; a += step) {
    if (alongZ) s.box(fixed - 0.09, fixed + 0.09, y, y + 0.75, a - 0.09, a + 0.09, TRIM);
    else s.box(a - 0.09, a + 0.09, y, y + 0.75, fixed - 0.09, fixed + 0.09, TRIM);
  }
  if (alongZ) s.box(fixed - 0.18, fixed + 0.18, y + 0.75, y + 0.95, a0, a1, TRIM);
  else s.box(a0, a1, y + 0.75, y + 0.95, fixed - 0.18, fixed + 0.18, TRIM);
}

// ---------- The house ----------
function houseGeometry(s, glow, rects, arches, tier) {
  // A window: a white surround on the wall, the glass (an instance) just in front of it; an iron balcony if asked.
  const win = (x, y, z, w, h, balcony) => {
    s.box(x - w / 2 - 0.3, x + w / 2 + 0.3, y - h / 2 - 0.3, y + h / 2 + 0.45, z, z + 0.1, TRIM);
    rects.push([x, y, z + 0.12, w, h]);
    if (balcony) {
      const by = y - h / 2 - 0.25;
      s.box(x - w / 2 - 0.5, x + w / 2 + 0.5, by - 0.15, by, z, z + 0.9, TRIM);
      for (let bx = x - w / 2 - 0.4; bx <= x + w / 2 + 0.45; bx += tier ? 0.22 : 0.44) s.box(bx - 0.03, bx + 0.03, by, by + 0.9, z + 0.82, z + 0.88, IRON);
      s.box(x - w / 2 - 0.5, x + w / 2 + 0.5, by + 0.88, by + 0.96, z + 0.8, z + 0.9, IRON);
    }
  };
  const archWin = (x, y0, z, w, h) => { s.box(x - w / 2 - 0.3, x + w / 2 + 0.3, y0 - 0.3, y0 + h + 0.35, z, z + 0.1, TRIM); arches.push([x, y0, z + 0.12, w, h]); };
  // Centre block on its plinth; quoins, a string course and the cornice.
  s.box(-11.4, 11.4, 0, 0.9, MZ - 11.4, MZ + 0.4, '#cdbb9c');
  s.box(-11, 11, 0.9, 10.6, MZ - 11, MZ, STONE);
  for (const sx of [-1, 1]) for (let y = 1.2; y < 10.4; y += 0.9) s.box(sx * 11 - 0.55, sx * 11 + 0.55, y, y + 0.55, MZ - 0.3, MZ + 0.12, TRIM);
  s.box(-11.2, 11.2, 5.6, 5.9, MZ - 11.2, MZ + 0.2, TRIM);
  s.box(-11.6, 11.6, 10.6, 11.3, MZ - 11.6, MZ + 0.6, TRIM);
  s.roof(0, MZ - 5.5, 23, 11.8, 11.3, 5.2);
  for (const sx of [-1, 1]) { // tall brick chimneys and their caps
    s.box(sx * 8.2 - 0.9, sx * 8.2 + 0.9, 12, 19.5, MZ - 6.5, MZ - 4.7, BRICK).box(sx * 8.2 - 1.1, sx * 8.2 + 1.1, 19.5, 20, MZ - 6.7, MZ - 4.5, TRIM);
    for (const dx of [-0.45, 0.45]) s.cyl(0.22, 0.22, 20, 20.6, sx * 8.2 + dx, MZ - 5.6, 6, '#9a6248');
  }
  for (const sx of [-1, 1]) { // dormers: a little gabled window in the roof
    const x = sx * 4.6, z = MZ - 1.6;
    s.box(x - 1.2, x + 1.2, 11.3, 13.8, z - 1.6, z + 0.2, STONE);
    const gab = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(0, 1.2)]);
    s.add(new THREE.ExtrudeGeometry(gab, { depth: 2.2, bevelEnabled: false }), ROOF, at(x, 13.8, z - 1.9));
    rects.push([x, 12.6, z + 0.22, 1.1, 1.5]);
  }
  // Windows: two floors, the door in the middle; balconies on the upper floor's outer pair.
  for (const sx of [-1, 1]) {
    win(sx * 3.3, 3.4, MZ, 1.5, 2.6); win(sx * 8.4, 3.4, MZ, 1.5, 2.6);
    win(sx * 3.3, 8.2, MZ, 1.5, 2.5); win(sx * 8.4, 8.2, MZ, 1.5, 2.5, true);
  }
  win(0, 8.2, MZ, 1.5, 2.5);
  // The dark double front door, a fanlight over it, and a lantern above.
  s.box(-1.2, 1.2, 0.9, 4.6, MZ, MZ + 0.08, '#1b1d24').box(-0.03, 0.03, 0.9, 4.6, MZ + 0.08, MZ + 0.1, '#3a3d48');
  s.box(-1.6, 1.6, 4.6, 5.2, MZ, MZ + 0.2, TRIM);
  glow.add(new THREE.CircleGeometry(1.1, 16, 0, Math.PI), '#ffd890', at(0, 5.2, MZ + 0.22));
  glow.add(new THREE.OctahedronGeometry(0.32, 0), '#ffe4a8', at(0, 6.3, MZ + 0.8));
  // The portico: four columns on bases with capitals, the entablature with its blank plaque, the pediment and oculus.
  for (const x of [-5.1, -1.7, 1.7, 5.1]) {
    s.box(x - 0.75, x + 0.75, 0.9, 1.3, MZ + 2.6, MZ + 4.1, TRIM);
    s.cyl(0.55, 0.46, 1.3, 9.6, x, MZ + 3.35, tier ? 12 : 8, TRIM);
    s.box(x - 0.7, x + 0.7, 9.6, 9.95, MZ + 2.65, MZ + 4.05, TRIM);
  }
  s.box(-6.4, 6.4, 9.95, 11.2, MZ, MZ + 4.4, TRIM);
  s.box(-2.8, 2.8, 10.2, 10.95, MZ + 4.4, MZ + 4.46, '#e2d3b2'); // the plaque, left blank
  const ped = new THREE.Shape([new THREE.Vector2(-6.8, 0), new THREE.Vector2(6.8, 0), new THREE.Vector2(0, 3.1)]);
  s.add(new THREE.ExtrudeGeometry(ped, { depth: 4.6, bevelEnabled: false }), TRIM, at(0, 11.2, MZ - 0.1));
  s.roof(0, MZ + 2.2, 13.6, 4.6, 11.2, 0.12, 0.98);
  glow.add(new THREE.CircleGeometry(0.62, 16), '#ffd890', at(0, 12.35, MZ + 4.52));
  s.add(new THREE.TorusGeometry(0.7, 0.12, 4, 16), TRIM, at(0, 12.35, MZ + 4.52));
  for (let i = 0; i < 4; i++) s.box(-5.6 - i * 0.6, 5.6 + i * 0.6, 0, 0.9 - i * 0.22, MZ + 4.1, MZ + 4.1 + (i + 1) * 0.75, '#d8c8aa'); // steps
  // Wings: one storey, flat-roofed behind balustrades, with tall arched windows.
  for (const sx of [-1, 1]) {
    const a = 11 * sx, b = 19.5 * sx, lo = Math.min(a, b), hi = Math.max(a, b), wz = MZ - 2;
    s.box(lo, hi, 0, 0.9, wz - 9.2, wz + 0.3, '#cdbb9c');
    s.box(lo, hi, 0.9, 6.6, wz - 9, wz, STONE);
    s.box(lo - 0.2, hi + 0.2, 6.6, 7.1, wz - 9.2, wz + 0.25, TRIM);
    balustrade(s, lo, hi, 7.1, wz, false, tier);
    balustrade(s, wz - 9, wz, 7.1, sx * 19.5, true, tier);
    for (const x of [sx * 13.6, sx * 17]) archWin(x, 1.5, wz, 1.6, 3.9);
    for (let y = 1.2; y < 6.4; y += 0.9) s.box(sx * 19.5 - 0.5, sx * 19.5 + 0.5, y, y + 0.55, wz - 0.25, wz + 0.12, TRIM);
  }
}

// ---------- The garden, its fences and gate, and the hills ----------
function gardenGeometry(s, f, glow, spots, sign, tier) {
  const rnd = mulberry(23), L2 = 2 * LAYER;
  s.plane(-1500, 1500, -1500, 200, 0, '#2c4a26'); // grass everywhere
  // Stepping stones from the gate to the fountain's paving, and on from it to the steps.
  const stones = [];
  for (let z = GZ - 1; z > FZ + 5.8; z -= 1.1) stones.push([(rnd() - 0.5) * 0.6, z]);
  for (let z = FZ - 5.8; z > MZ + 7.4; z -= 1.1) stones.push([(rnd() - 0.5) * 0.6, z]);
  for (const [x, z] of stones) s.add(new THREE.CylinderGeometry(0.42 + rnd() * 0.15, 0.48, 0.12, 7), '#c7beae', at(x, L2, z));
  // Round flower beds in pink and purple, in stone rings.
  const blooms = ['#ff6fae', '#d24bb4', '#9b5cff', '#ff9fd0', '#f5f0ff', '#ffd25a'];
  const beds = [[-9, -44, 2.2], [9, -44.5, 2.2], [-13, -53, 2], [13, -53, 2], [-8.5, MZ + 5.6, 1.4], [8.5, MZ + 5.6, 1.4], [-17, -45, 1.8], [17, -46, 1.8]];
  for (const [x, z, r] of beds) {
    s.add(new THREE.TorusGeometry(r, 0.18, 4, tier ? 18 : 10).rotateX(Math.PI / 2), '#d6cab4', at(x, 0.2, z));
    s.add(new THREE.CircleGeometry(r, tier ? 18 : 10).rotateX(-Math.PI / 2), '#3a2a20', at(x, L2, z));
    const n = Math.round(r * r * (tier >= 2 ? 3.2 : tier ? 2.2 : 1.2));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (r - 0.3);
      f.add(new THREE.OctahedronGeometry(0.2 + rnd() * 0.12, 0), blooms[(rnd() * blooms.length) | 0], at(x + Math.cos(a) * d, 0.3 + rnd() * 0.15, z + Math.sin(a) * d), 0.08, 0);
    }
  }
  // Clipped box balls on pedestals beside the steps, cones by the door.
  for (const sx of [-1, 1]) {
    f.add(new THREE.IcosahedronGeometry(0.75, 0), '#2f5a2c', at(sx * 7.2, 1.6, MZ + 4.6), 0.02, 0.8);
    s.box(sx * 7.2 - 0.5, sx * 7.2 + 0.5, 0, 0.8, MZ + 4.1, MZ + 5.1, '#cdbb9c');
    f.add(new THREE.ConeGeometry(0.5, 2.2, 6), '#2a4f2a', at(sx * 3.6, 1.1, MZ + 1.2), 0.02, 0.2);
  }
  // Grass tufts.
  for (let i = 0; i < [70, 160, 260][tier]; i++) {
    const x = (rnd() - 0.5) * 2 * (FENCE - 1), z = GZ - 1 - rnd() * (GZ - MZ + 2);
    if (Math.abs(x) < 1.4 || Math.hypot(x, z - FZ) < 6.2) continue;
    f.add(new THREE.ConeGeometry(0.12, 0.5 + rnd() * 0.3, 3), rnd() < 0.5 ? '#3d6a32' : '#4a7a3a', at(x, 0.3, z), 0.2, 0);
  }
  // A white picket fence each side and along the terrace, a low hedge inside it, and the gate: two stone piers with
  // lanterns, rose bushes at their feet, and the sign on a low board (kept low, so the house stays in view).
  const pick = tier ? 0.42 : 0.84, picket = (x, z) => s.add(new THREE.CylinderGeometry(0.05, 0.07, 1.15, 4), '#f4f1ea', at(x, 0.58, z));
  for (const sx of [-1, 1]) {
    const x = sx * FENCE;
    for (let z = GZ; z > MZ - 14; z -= pick) picket(x, z);
    s.box(x - 0.04, x + 0.04, 0.35, 0.47, MZ - 14, GZ, '#f4f1ea').box(x - 0.04, x + 0.04, 0.8, 0.92, MZ - 14, GZ, '#f4f1ea');
    for (let xx = sx * 2.7; Math.abs(xx) < FENCE; xx += sx * pick) picket(xx, GZ);
    const a = sx * 2.6, b = sx * FENCE;
    s.box(Math.min(a, b), Math.max(a, b), 0.35, 0.47, GZ - 0.04, GZ + 0.04, '#f4f1ea').box(Math.min(a, b), Math.max(a, b), 0.8, 0.92, GZ - 0.04, GZ + 0.04, '#f4f1ea');
    s.box(x - sx * 1.3 - 0.5, x - sx * 1.3 + 0.5, 0, 1.2, MZ - 12, GZ - 1, '#2b5229');
    s.box(sx * 2.4 - 0.3, sx * 2.4 + 0.3, 0, 1.5, GZ - 0.3, GZ + 0.3, '#d8ccb6').box(sx * 2.4 - 0.38, sx * 2.4 + 0.38, 1.5, 1.62, GZ - 0.38, GZ + 0.38, TRIM);
    glow.add(new THREE.OctahedronGeometry(0.2, 0), '#ffe2a0', at(sx * 2.4, 1.9, GZ));
    spots.push([sx * 2.4, 1.9, GZ, '#ffd68a']);
    for (let i = 0; i < (tier ? 5 : 3); i++) f.add(new THREE.IcosahedronGeometry(0.28, 0), i % 2 ? '#ff6fae' : '#2f5a2c', at(sx * (2.9 + i * 0.35), 0.3, GZ - 0.5), 0.05, 0);
  }
  for (const sx of [-1, 1]) s.box(sx * 1.3 - 0.05, sx * 1.3 + 0.05, 0, 0.75, GZ - 0.05, GZ + 0.05, IRON);
  s.box(-1.45, 1.45, 0.75, 1.35, GZ - 0.06, GZ + 0.06, '#2a2018');
  sign.push([0, 1.05, GZ + 0.08, 2.7, 0.6]);
  // Iron lamp posts with warm lanterns, a park bench.
  for (const [x, z] of [[1.6, GZ - 2.5], [-1.6, FZ + 7], [2.2, FZ - 7.2], [-2.2, MZ + 8.6]]) {
    s.cyl(0.07, 0.05, 0, 2.9, x, z, 6, IRON);
    glow.add(new THREE.OctahedronGeometry(0.22, 0), '#ffe2a0', at(x, 3.05, z));
    s.box(x - 0.2, x + 0.2, 3.25, 3.32, z - 0.2, z + 0.2, IRON);
    spots.push([x, 3.05, z, '#ffd68a']);
  }
  s.box(-11.8, -10.2, 0.45, 0.55, -50.6, -49.9, '#7a5634').box(-11.8, -10.2, 0.55, 1.1, -50.65, -50.55, '#7a5634');
  for (const x of [-11.6, -10.4]) s.box(x - 0.05, x + 0.05, 0, 0.5, -50.6, -50, IRON);
  // Trees: round ones and cone pines in and round the garden, a pink blossom tree inside the gate.
  const greens = ['#2f5d2c', '#3a6a30', '#295227', '#447a36'];
  const round = (x, z, h, r, c) => {
    s.cyl(0.25, 0.18, 0, h * 0.5, x, z, 5, '#5a3f2a');
    f.add(new THREE.IcosahedronGeometry(r, tier >= 2 ? 1 : 0), c, at(x, h * 0.5 + r * 0.75, z), 0.04, h * 0.4);
  };
  const pine = (x, z, h) => { s.cyl(0.2, 0.16, 0, h * 0.2, x, z, 5, '#4a3424'); f.add(new THREE.ConeGeometry(h * 0.24, h * 0.85, tier ? 7 : 5), '#22462a', at(x, h * 0.62, z), 0.02, h * 0.3); };
  round(-18, GZ - 3.5, 5, 2.4, '#ff8fc0'); // the blossom tree
  for (const [x, z, k] of [[-20, -58, 0], [19, -40, 1], [21, -60, 2], [-21, -70, 3], [20, -73, 1], [-14, MZ - 13, 2], [14, MZ - 14, 0], [0, MZ - 18, 3], [-25.5, -33, 1], [26, -30, 2], [-30, -50, 0], [31, -48, 3], [-32, -66, 2], [33, -70, 1]]) round(x, z, 5.5 + (k % 2) * 1.5, 2.6 + (k % 3) * 0.4, greens[k]);
  for (const [x, z, h] of [[-23, -46, 9], [23, -52, 10], [-27, -60, 11], [27, -64, 9], [-9, MZ - 16, 12], [10, MZ - 17, 11], [-29, -40, 8], [29, -36, 10]]) pine(x, z, h);
  // Rolling hills behind, with tree silhouettes.
  const hill = (x, z, r, h, c) => s.add(new THREE.SphereGeometry(1, tier ? 10 : 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(r, h, r * 0.6), c, at(x, 0, z));
  for (let i = 0; i < 7; i++) hill(-420 + i * 140 + rnd() * 40, -260 - rnd() * 120, 120 + rnd() * 60, 28 + rnd() * 18, i % 2 ? '#24392c' : '#1f3328');
  for (let i = 0; i < (tier ? 60 : 30); i++) {
    const x = (rnd() - 0.5) * 500, z = -120 - rnd() * 160;
    if (Math.abs(x) < 40 && z > -150) continue;
    if (rnd() < 0.5) s.add(new THREE.ConeGeometry(3 + rnd() * 2, 10 + rnd() * 6, 5), '#1c3324', at(x, 5 + rnd() * 6, z));
    else s.add(new THREE.IcosahedronGeometry(4 + rnd() * 2, 0), '#21392a', at(x, 6 + rnd() * 4, z));
  }
  // Warm windows of a far village.
  for (let i = 0; i < (tier ? 30 : 14); i++) spots.push([(rnd() - 0.5) * 900, 4 + rnd() * 18, -320 - rnd() * 200, '#ffcf8a']);
}

// ---------- The fountain: a round stone pool and two bowls; its water is a cloud of points moved on the GPU ----------
function fountainGeometry(s) {
  const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  s.add(new THREE.CircleGeometry(5.6, 28).rotateX(-Math.PI / 2), '#cfc4b0', at(0, 3 * LAYER, FZ)); // the paved surround
  s.add(lathe([[3.9, 0], [4.7, 0], [4.8, 0.65], [4.4, 0.75], [3.95, 0.7], [3.9, 0.35]]), '#e2d6c0', at(0, 0, FZ));
  s.cyl(0.5, 0.42, 0.3, 1.9, 0, FZ, 10, '#d8ccb6');
  s.add(lathe([[0.4, 0], [1.9, 0.22], [2.0, 0.48], [1.75, 0.52], [0.3, 0.35]]), '#e6dac4', at(0, 1.85, FZ));
  s.cyl(0.28, 0.22, 2.3, 3.3, 0, FZ, 8, '#d8ccb6');
  s.add(lathe([[0.22, 0], [0.9, 0.16], [0.95, 0.36], [0.8, 0.4], [0.18, 0.26]]), '#e6dac4', at(0, 3.25, FZ));
}
function fountainWater(tier, uTime, uHalfH) {
  const n = [140, 380, 720][tier], rnd = mulberry(7);
  const start = [], vel = [], life = [], phase = [];
  const fall = (y0, vy, yEnd) => (vy + Math.sqrt(vy * vy + 2 * 9.8 * Math.max(0, y0 - yEnd))) / 9.8; // time to come down to yEnd
  for (let i = 0; i < n; i++) {
    const k = rnd();
    let sx, sy, sz, vx, vy, vz, yEnd;
    if (k < 0.35) { // the top jet, falling back over the bowls
      const a = rnd() * Math.PI * 2, sp = 0.3 + rnd() * 0.6;
      sx = 0; sy = 3.7; sz = 0; vx = Math.cos(a) * sp; vy = 4.4 + rnd() * 0.7; vz = Math.sin(a) * sp; yEnd = 2.3;
    } else if (k < 0.8) { // arcs from the pool's rim, falling inward
      const j = (rnd() * 10) | 0, a = (j / 10) * Math.PI * 2 + (rnd() - 0.5) * 0.06, sp = 1.9 + rnd() * 0.25;
      sx = Math.cos(a) * 4.2; sy = 0.75; sz = Math.sin(a) * 4.2; vx = -Math.cos(a) * sp; vy = 3.4 + rnd() * 0.3; vz = -Math.sin(a) * sp; yEnd = 0.45;
    } else { // the lower bowl spilling over its lip
      const a = rnd() * Math.PI * 2, r = 2.0;
      sx = Math.cos(a) * r; sy = 2.3; sz = Math.sin(a) * r; vx = Math.cos(a) * 0.3; vy = 0.1; vz = Math.sin(a) * 0.3; yEnd = 0.45;
    }
    start.push(sx, sy, sz); vel.push(vx, vy, vz); life.push(fall(sy, vy, yEnd)); phase.push(rnd());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(start, 3));
  g.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 3));
  g.setAttribute('aLife', new THREE.Float32BufferAttribute(life, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  const uColor = { value: new THREE.Color(DUSK.drops) };
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime, uHalfH, uColor },
    vertexShader: `uniform float uTime; uniform float uHalfH; attribute vec3 aVel; attribute float aLife; attribute float aPhase; varying float vA;
      void main() {
        float t = fract(uTime / aLife + aPhase) * aLife;
        vec3 p = position + aVel * t + vec3(0.0, -4.9 * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, 0.09 * projectionMatrix[1][1] * uHalfH / -mv.z);
        vA = 0.35 + 0.55 * (1.0 - t / aLife);
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; gl_FragColor = vec4(uColor, vA * (1.0 - d * 4.0)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.position.set(0, 0, FZ); pts.frustumCulled = false;
  return { pts, uColor };
}

// The gate's sign: gold letters on dark wood, drawn once.
function signMesh([[x, y, z, w, h]]) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2018'; g.fillRect(0, 0, 512, 112);
  g.strokeStyle = '#c99a4a'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 96);
  g.fillStyle = '#f2c66a'; g.font = '600 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Light Up the Skies', 256, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z);
  return m;
}

// Windows of one shape as one instanced mesh, dark until their moment in the evening.
function windowSet(geo, list, rnd) {
  const win = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), list.length);
  const mm = new THREE.Matrix4(), dark = new THREE.Color('#2a3050');
  list.forEach(([x, y, z, w, h], i) => { win.setMatrixAt(i, mm.makeScale(w, h, 1).setPosition(x, y, z)); win.setColorAt(i, dark); });
  win.userData.when = list.map(() => 0.1 + rnd() * 0.75);
  win.userData.warm = list.map(() => new THREE.Color(LIT[(rnd() * LIT.length) | 0]));
  return win;
}

export function build({ tier }) {
  const uTime = { value: 0 }, uHalfH = { value: 400 };
  const stone = new Parts(), leaves = new Parts(), glow = new Parts(), rects = [], arches = [], spots = [], sign = [];
  houseGeometry(stone, glow, rects, arches, tier);
  gardenGeometry(stone, leaves, glow, spots, sign, tier);
  fountainGeometry(stone);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; spots.push([Math.cos(a) * 3.4, 0.55, FZ + Math.sin(a) * 3.4, '#9fe8ff']); }
  spots.push([0, 6.3, MZ + 0.8, '#ffd27a']);

  const objects = [];
  objects.push(stone.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // The leaves and grass sway: a few lines added to the Lambert vertex shader (none on the low tier).
  const foliage = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  if (tier) {
    foliage.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = `attribute float aSway;\nuniform float uTime;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += sin(uTime * 1.6 + position.x * 0.31 + position.z * 0.17) * aSway;
        transformed.z += cos(uTime * 1.25 + position.x * 0.23) * aSway * 0.5;`)}`;
    };
  }
  objects.push(leaves.mesh(foliage), glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })), signMesh(sign));
  // The windows: square-headed and arched, each lighting up at its own moment.
  const rnd = mulberry(5);
  const archShape = new THREE.Shape();
  archShape.moveTo(-0.5, 0); archShape.lineTo(0.5, 0); archShape.lineTo(0.5, 0.78);
  archShape.absarc(0, 0.78, 0.5, 0, Math.PI, false); archShape.lineTo(-0.5, 0);
  const archGeo = new THREE.ShapeGeometry(archShape, 8);
  archGeo.scale(1, 1 / 1.28, 1); // unit tall, so an instance scales to w x h
  const wins = [windowSet(new THREE.PlaneGeometry(1, 1), rects, rnd), windowSet(archGeo, arches, rnd)];
  objects.push(...wins);
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.95, tier ? 32 : 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: DUSK.water }));
  water.position.set(0, 0.45, FZ);
  const drops = fountainWater(tier, uTime, uHalfH);
  objects.push(water, drops.pts);
  objects.push(forecourt({ rgb: [134, 120, 104], z0: GZ, z1: 20, width: 22, tile: 1.8, joint: 'rgba(230,215,195,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));

  // The evening: golden hour for a moment, then about 6 s to night, the windows coming on in turn.
  const fps = [20, 30, 60][tier];
  const resume = lastEvening && performance.now() - lastEvening.at < 20000 ? lastEvening : null;
  let time = resume ? 2 : 0, since = 0, night = -1, falling = !!(resume && resume.falling), rate = resume ? resume.rate : 1 / 6;
  const start = resume ? resume.night : 0;
  const cc = new THREE.Color(), cd = new THREE.Color(), dark = new THREE.Color('#2a3050');
  const mix = (a, b, k) => cc.set(a).lerp(cd.set(b), k).getStyle();
  const evening = (env, k) => {
    env.setSky(DUSK.sky.map((c, i) => mix(c, NIGHT.sky[i], k)));
    env.setFog(mix(DUSK.fog, NIGHT.fog, k));
    env.setHemi(mix(DUSK.hemi[0], NIGHT.hemi[0], k), mix(DUSK.hemi[1], NIGHT.hemi[1], k), DUSK.hemi[2] + (NIGHT.hemi[2] - DUSK.hemi[2]) * k);
    env.dirs.forEach((l, i) => { l.intensity = DUSK.dirs[i] + (NIGHT.dirs[i] - DUSK.dirs[i]) * k; });
    env.setStars(DUSK.stars + (NIGHT.stars - DUSK.stars) * k);
    water.material.color.set(mix(DUSK.water, NIGHT.water, k));
    drops.uColor.value.set(mix(DUSK.drops, NIGHT.drops, k));
    for (const w of wins) {
      const { when, warm } = w.userData;
      for (let i = 0; i < w.count; i++) w.setColorAt(i, cc.copy(dark).lerp(warm[i], Math.min(1, Math.max(0, (k - when[i]) / 0.08))));
      w.instanceColor.needsUpdate = true;
    }
  };
  return {
    objects, spots,
    zone: { x0: -8, x1: 8, z0: -30, z1: -5 },
    sky: DUSK.sky, fog: [DUSK.fog, 160, 900],
    clouds: null, moon: null, stars: tier ? 200 : 100,
    hemi: DUSK.hemi,
    // The low sun (golden hour), the floodlight on the house (night), a cool fill from behind.
    directional: [['#ffb878', DUSK.dirs[0], [-220, 60, 200]], ['#ffd9a8', DUSK.dirs[1], [30, 25, 200]], ['#8e96c8', DUSK.dirs[2], [200, 300, -500]]],
    animate(dt, env) {
      let changed = false;
      if (night < 0) { night = start; evening(env, night * night * (3 - 2 * night)); changed = true; }
      time += dt; since += dt;
      if (!falling && time > 2) falling = true;
      if (falling && night < 1) { night = Math.min(1, night + dt * rate); evening(env, night * night * (3 - 2 * night)); changed = true; }
      if (since >= 1 / fps) { // the fountain and the leaves, at this tier's frame rate
        since = 0; uTime.value = time;
        uHalfH.value = env.height / 2;
        changed = true;
      }
      lastEvening = { night, falling, rate, at: performance.now() };
      return changed;
    },
    // The show starts: night falls at once.
    cue(name) { if (name === 'launch') { falling = true; rate = 1 / 2; } },
  };
}
