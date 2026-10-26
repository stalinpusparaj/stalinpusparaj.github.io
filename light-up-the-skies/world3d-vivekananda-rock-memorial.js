/* Light Up the Skies — 3D background: the Vivekananda Rock Memorial at Kanyakumari on Diwali night, seen from the
   seafront promenade on the mainland, with the tall Thiruvalluvar statue on its own rock nearer you to the right and the
   dark sea of the three oceans' meeting between. Loaded by world3d.js when Vivekananda Rock is the chosen world. Its
   colours follow the game's 2D picture: a deep blue night going violet and orange at the horizon, the granite of both
   monuments floodlit gold from below, the rocks dark and wet at the waterline, foam round them.

   Proportions follow published figures, scaled for the frame: the memorial's main mandapam is a granite hall about
   16 m square with a pillared porch in front and a square, curved dome roof with its kalasam some 26 m over the rock's
   terrace; the Shripada mandapam with its pyramid roof stands to its left and the low Dhyana mandapam to its right.
   The statue is the real one's 41 m: a 12 m pillared pedestal (the Artha mandapam) and the 29 m figure on it, robed,
   the right hand raised with three fingers up, the left holding the palm-leaf book, a topknot on the head. The rocks
   are noise-jittered icosahedra; everything else is a box, a beam or a lathe, merged into a few meshes with one drawn
   granite texture. The floodlit look is baked into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the promenade's surface is y 0, the sea lies 2.6 m below it. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const EDGE = -46; // the sea wall at the promenade's far side
const SEA = -2.6; // the sea's surface
const VIV = { x: -26, z: -182, top: 5.2, rot: 0.14 }; // the memorial's rock: centre and its terrace's height
const TIR = { x: 30, z: -138, top: 3.4, rot: -0.12 }; // Thiruvalluvar's rock
const S0 = 12.6; // the statue's feet over its rock's top; it is drawn 1.12 times its local units
const SK = 1.12;

// ---------- Granite: blocks in courses of 0.6 m, one tile per 4 m ----------
function graniteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(31), px = 256 / 4;
  g.fillStyle = '#efe2cf'; g.fillRect(0, 0, 256, 256);
  let y = 0, row = 0;
  while (y < 256) {
    const h = 0.6 * px;
    let x = -(row % 3) * 26;
    while (x < 256) {
      const w = (0.9 + rnd() * 0.9) * px, v = 0.86 + rnd() * 0.14;
      g.fillStyle = `rgb(${(240 * v) | 0},${(226 * v) | 0},${(210 * v) | 0})`;
      g.fillRect(x + 1, y + 1, w - 2, h - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(70,50,40,0.4)'; g.fillRect(0, y, 256, 1.2);
    y += h; row++;
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '80,60,60' : '255,250,240'},${rnd() * 0.1})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base, set) gives a vertex colour (world coordinates); force sends shapes to the second, unlit
// set. frame, when set, places everything added in the world.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.frame = null; this.force = null; this.uv = 1;
  }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (this.frame) g.applyMatrix4(this.frame);
    const p = g.attributes.position, base = new THREE.Color(color), si = this.force ?? 0, set = this.sets[si];
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        set.pos.push(v.x, v.y, v.z); set.nor.push(tmpN.x, tmpN.y, tmpN.z);
        const [u, w] = ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y];
        set.uv.push(u * this.uv, w * this.uv);
        const c = this.colour ? this.colour(v.x, v.y, v.z, tmpN, base, si) : base;
        set.col.push(c.r, c.g, c.b);
      }
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color) { return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); }
  lathe(profile, x, y, z, seg, color, phi = 0) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg, phi), color, at(x, y, z)); }
  // A square roof: a lathe of four sides, square to the axes; r is the half side.
  roof(profile, x, y, z, color) { return this.lathe(profile.map(([r, h]) => [r * Math.SQRT2, h]), x, y, z, 4, color, Math.PI / 4); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  // A beam w x h in section from point a to point b.
  beam(a, b, w, h, color) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, len, h), color, m);
  }
  // A boulder: an icosahedron squashed to rx, ry, rz and jittered by a noise of its own corners (shared corners move
  // together, so it stays closed); its underside is cut flat at -ry * flat.
  rock(x, y, z, rx, ry, rz, detail, seed, color, flat = 0.35) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i), b = p.getY(i), c = p.getZ(i);
      const h = Math.sin(Math.round(a * 1e3) * 0.0129898 + Math.round(b * 1e3) * 0.078233 + Math.round(c * 1e3) * 0.037719 + seed * 1.7) * 43758.5453;
      const f = 0.72 + (h - Math.floor(h)) * 0.5;
      p.setXYZ(i, a * f * rx, Math.max(b * f, -flat) * ry, c * f * rz);
    }
    return this.add(g, color, at(x, y, z));
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
const place = (x, y, z, rot) => new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The floodlit granite of the 2D picture, by height over the rock: gold where the floods graze the walls, cooler and
// ruddier up the dome.
const tmpCol = new THREE.Color();
const ramp = (stops) => {
  const s = stops.map(([h, c]) => [h, new THREE.Color(c)]);
  return (h) => {
    if (h <= s[0][0]) return tmpCol.copy(s[0][1]);
    for (let i = 1; i < s.length; i++) if (h < s[i][0]) return tmpCol.copy(s[i - 1][1]).lerp(s[i][1], (h - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
    return tmpCol.copy(s[s.length - 1][1]);
  };
};
const VIV_RAMP = ramp([[-6, '#5a3a26'], [0, '#c88a50'], [3, '#ffd68e'], [10, '#ffc878'], [14, '#f0a860'], [22, '#c8704a'], [30, '#e0a060']]);
const TIR_RAMP = ramp([[-4, '#5a3a26'], [1, '#d89458'], [6, '#ffd08a'], [13, '#f2b070'], [20, '#b89488'], [32, '#8c8ca8'], [46, '#a4a4bc']]);
const ROCK_RAMP = ramp([[SEA - 1, '#120f10'], [SEA + 0.6, '#2a221e'], [SEA + 2.5, '#7a5236'], [SEA + 6, '#c88a52'], [SEA + 10, '#e0a466']]);
const vivColour = (x, y, z, n, base, si) => (si ? base : VIV_RAMP(y - VIV.top).multiply(base));
const tirColour = (x, y, z, n, base, si) => (si ? base : TIR_RAMP(y - TIR.top).multiply(base));
const rockColour = (x, y, z, n, base) => ROCK_RAMP(y).multiply(base).multiplyScalar(n.y < -0.2 ? 0.55 : 1);

// The memorial, around its terrace's centre, its porch towards +z (you).
function memorialGeometry(s, tier) {
  const g = '#ffffff', shade = '#b09484', dark = '#5a4238', lamp = '#ffcf78', foot = SEA - VIV.top + 0.8;
  // The terrace on the rock, its parapet, the steps up from the landing.
  s.box(-25, 25, foot, 0.6, -17, 15, g);
  for (const [x0, x1, z0, z1] of [[-25, 25, 14.6, 15.2], [-25, 25, -17.2, -16.6], [-25.2, -24.6, -17, 15], [24.6, 25.2, -17, 15]]) {
    if (z0 > 14) { s.box(x0, -4, 0.6, 1.6, z0, z1, g).box(4, x1, 0.6, 1.6, z0, z1, g); } else s.box(x0, x1, 0.6, 1.6, z0, z1, g);
  }
  for (let i = 0; i < 5; i++) s.box(-4, 4, foot, 0.6 - i * 0.6, 15 + i * 0.7, 15.7 + i * 0.7, g);
  // The main mandapam: plinth, walls with pilasters, a deep cornice, a drum, the square curved dome and its kalasam.
  s.box(-8.6, 8.6, 0.6, 1.8, -13, 3.4, g).box(-8, 8, 1.8, 12.4, -12.4, 2.8, g);
  const pil = tier ? 1.6 : 3.2;
  for (let x = -7.2; x <= 7.3; x += pil) s.box(x - 0.3, x + 0.3, 1.8, 12.2, 2.8, 3.2, g);
  for (let z = -11.6; z <= 2.1; z += pil) for (const sx of [-1, 1]) s.box(sx * 8 - 0.2, sx * 8 + 0.2, 1.8, 12.2, z - 0.3, z + 0.3, g);
  s.box(-8.9, 8.9, 12.2, 13.2, -13.3, 3.7, g).box(-8.2, 8.2, 13.2, 14.6, -12.6, 3, g);
  s.roof([[8.6, 0], [8.6, 0.6], [8.1, 2.4], [7, 4.6], [5.4, 6.8], [3.4, 8.6], [1.4, 9.8], [0, 10.1]], 0, 14.6, -4.8, '#ffe6d8');
  s.lathe([[1.2, 0], [1.4, 0.5], [0.9, 1.2], [0.4, 1.4], [0.6, 1.9], [0.15, 2.9], [0, 3.1]], 0, 24.4, -4.8, tier ? 10 : 6, g);
  // The pillared porch: floor, a row of square pillars, the roof slab and its own small stepped roof.
  s.box(-6.4, 6.4, 0.6, 1.8, 2.8, 11.4, g);
  for (const x of [-5.6, -2, 2, 5.6]) for (const z of tier ? [6.8, 10.6] : [10.6]) s.box(x - 0.45, x + 0.45, 1.8, 8.4, z - 0.45, z + 0.45, g);
  for (const sx of [-1, 1]) s.box(sx * 5.6 - 0.45, sx * 5.6 + 0.45, 1.8, 8.4, 2.8, 10.2, g); // side walls
  s.box(-6.8, 6.8, 8.4, 9.4, 2.4, 11.8, g);
  s.roof([[6, 0], [5.2, 1], [4.2, 1.4], [3.4, 2.4], [2.2, 2.8], [1.2, 3.8], [0, 4]], 0, 9.4, 7.1, g);
  s.box(-1.6, 1.6, 2.83, 2.9, 2.2, 3, shade); // the door's surround on the hall
  // The Shripada mandapam to the left: a square hall with a pyramid roof.
  s.box(-21.4, -12.6, 0.6, 1.6, -9.4, 0.4, g).box(-20.6, -13.4, 1.6, 8, -8.6, -0.4, g).box(-21.2, -12.8, 8, 8.8, -9.2, 0.2, g);
  s.roof([[4.2, 0], [3.8, 1.2], [3, 1.6], [2.6, 2.8], [1.8, 3.2], [1.2, 4.4], [0, 5]], -17, 8.8, -4.5, '#ffe6d8');
  s.lathe([[0.6, 0], [0.7, 0.4], [0.2, 1.4], [0, 1.6]], -17, 13.8, -4.5, 6, g);
  // The Dhyana mandapam to the right: long and low, with a shallow dome.
  s.box(11, 23, 0.6, 1.6, -8, 1, g).box(11.6, 22.4, 1.6, 6.8, -7.4, 0.4, g).box(11.2, 22.8, 6.8, 7.6, -7.8, 0.8, g);
  s.lathe([[3, 0], [2.9, 0.9], [2.2, 2], [1, 2.8], [0, 3]], 17, 7.6, -3.5, tier ? 10 : 6, '#ffe6d8');
  // The back wing, the office and stores behind the hall.
  s.box(-12, 10, 0.6, 7.6, -16.4, -12.4, shade).box(-12.3, 10.3, 7.6, 8.2, -16.7, -12.1, g);
  // Lit doorways and windows.
  s.force = 1;
  s.box(-1.3, 1.3, 1.8, 6.4, 2.86, 2.94, lamp); // the hall's door, seen through the porch
  s.box(-1, 1, 1.6, 5, 0.4, 0.48, '#ffc066'); // the Shripada mandapam's door
  for (let x = 12.8; x < 22; x += 2.4) s.box(x, x + 1, 2.6, 5, 0.4, 0.48, '#ffcf80'); // the Dhyana mandapam's windows
  for (const x of [-4, 4]) s.box(x - 0.7, x + 0.7, 4, 9.4, 2.82, 2.86, '#ffb85e');
  s.force = null;
  s.box(-6.2, 6.2, 1.8, 8.4, 2.9, 3.05, dark); // shadow in the porch round the door
  return s;
}

// Thiruvalluvar: the pillared pedestal, then the figure (drawn in units of 1/SK m, its feet at local 0).
function statueGeometry(s, tier) {
  const g = '#ffffff', foot = SEA - TIR.top + 0.8;
  s.frame = place(TIR.x, TIR.top, TIR.z, TIR.rot);
  s.box(-8.5, 8.5, foot, 1.2, -8.5, 8.5, g);
  for (let i = 0; i < 4; i++) s.box(-3, 3, foot, 1.2 - i * 0.7, 8.5 + i * 0.7, 9.2 + i * 0.7, g); // the landing steps
  s.box(-5.2, 5.2, 1.2, 10.6, -5.2, 5.2, g);
  // Pillars round the pedestal, a cornice, a smaller plinth.
  const k = tier ? 6 : 4;
  for (let i = 0; i < k; i++) {
    const t = -4.6 + (9.2 * i) / (k - 1);
    for (const sz of [-1, 1]) s.box(t - 0.35, t + 0.35, 1.2, 10.6, sz * 5.2 - 0.35, sz * 5.2 + 0.35, g).box(sz * 5.2 - 0.35, sz * 5.2 + 0.35, 1.2, 10.6, t - 0.35, t + 0.35, g);
  }
  s.box(-5.9, 5.9, 10.6, 11.6, -5.9, 5.9, g).box(-5.5, 5.5, 11.6, 12, -5.5, 5.5, g).box(-4.4, 4.4, 12, S0, -4.4, 4.4, g);
  s.force = 1; s.box(-1.1, 1.1, 1.2, 5.6, 5.2, 5.6, '#ffc874'); s.force = null; // the door into the pedestal
  // The figure.
  s.uv = 0.08; // carved smooth: no courses
  s.frame = place(TIR.x, TIR.top, TIR.z, TIR.rot).multiply(at(0, S0, 0)).multiply(new THREE.Matrix4().makeScale(SK, SK, SK));
  const seg = tier ? 12 : 8, lat = (prof, y, sz, color = g) => s.add(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), seg).scale(1, 1, sz), color, at(0, y, 0));
  s.box(-1.9, 1.9, 0, 0.7, -1.2, 1.9, g); // the feet
  lat([[2.4, 0], [2.6, 0.7], [2.45, 4], [2.25, 8], [2.05, 11.2]], 0.7, 0.72); // the dhoti
  s.cyl(2.15, 2.15, 11.4, 12.1, 0, 0, seg, g); // the waist cloth
  lat([[2.05, 0], [2.15, 2], [2.45, 4.6], [2.85, 6.8], [2.7, 7.6], [1.6, 8.4], [0.8, 8.7]], 12.1, 0.62); // the torso
  s.cyl(0.8, 0.75, 20.4, 21.8, 0, 0.05, 8, g); // the neck
  s.add(new THREE.SphereGeometry(1.7, seg, tier ? 8 : 6).scale(1, 1.18, 1.05), g, at(0, 23.2, 0.1)); // the head
  s.add(new THREE.ConeGeometry(1.15, 2.4, 6).rotateX(Math.PI), g, at(0, 21.6, 0.85)); // the beard
  s.add(new THREE.SphereGeometry(0.85, 8, 6), g, at(0, 25.3, -0.4)); // the topknot
  // The shawl over the left shoulder, across the chest.
  s.beam(V(2.4, 19.4, 0.7), V(-1.7, 12.6, 1.35), 1.1, 0.45, g).beam(V(2.6, 19.4, -0.4), V(2.2, 10.6, -1.3), 1.2, 0.4, g);
  // The right arm (your left): raised from the elbow, three fingers up in blessing.
  s.beam(V(-2.75, 19, 0), V(-3.15, 14.8, 0.3), 1.35, 1.35, g).beam(V(-3.15, 14.8, 0.3), V(-1.75, 17.4, 1.9), 1.15, 1.15, g);
  s.box(-2.2, -1.3, 17.3, 18.3, 1.7, 2.3, g).box(-2.1, -1.4, 18.3, 19.3, 1.85, 2.2, g);
  // The left arm: down to the waist, the book of palm leaves in the hand.
  s.beam(V(2.75, 19, 0), V(3.2, 14.6, 0.2), 1.35, 1.35, g).beam(V(3.2, 14.6, 0.2), V(1.9, 13.4, 1.9), 1.15, 1.15, g);
  s.box(0.8, 2.2, 13.1, 13.8, 1.7, 2.6, g);
  s.frame = null; s.uv = 1;
  return s;
}

// The two rocks and the boulders round them.
function rocks(s, tier) {
  const d = tier > 1 ? 2 : 1, rnd = mulberry(13), c = '#ffffff';
  s.colour = rockColour;
  // The memorial's rock: a broad hump under the terrace, shoulders that run out into the sea, and fallen blocks.
  s.rock(VIV.x, SEA, VIV.z, 31, (VIV.top - SEA + 0.4) / 1.22, 23, d, 1, c, 0.2);
  for (const [dx, dz, rx, ry, rz] of [[-27, 6, 10, 5.5, 9], [21, 8, 8, 5, 7], [-8, 22, 12, 4.5, 7], [10, 19, 8, 4, 6], [-32, -12, 9, 5, 8]]) s.rock(VIV.x + dx, SEA, VIV.z + dz, rx, ry, rz, d - 1 || 1, dx, c, 0.2);
  for (let i = 0; i < (tier ? 12 : 6); i++) {
    const a = rnd() * Math.PI * 2, r = 1.1 + rnd() * 0.25;
    s.rock(VIV.x + Math.cos(a) * 32 * r, SEA, VIV.z + Math.sin(a) * 24 * r, 3 + rnd() * 4, 1.5 + rnd() * 2.5, 2.5 + rnd() * 3, 0, i + 7, c);
  }
  // Great boulders heaped against the terrace's walls, as in the picture, leaving the landing steps clear.
  const v = new THREE.Vector3(), vm = place(VIV.x, 0, VIV.z, VIV.rot), tm = place(TIR.x, 0, TIR.z, TIR.rot);
  for (let x = -23; x <= 23; x += tier ? 5.5 : 9) {
    if (Math.abs(x) < 6) continue;
    v.set(x, 0, 17.5 + rnd() * 2.5).applyMatrix4(vm);
    s.rock(v.x, SEA, v.z, 4 + rnd() * 3, 4.5 + rnd() * 1.5, 3.5 + rnd() * 2, 1, x + 50, c, 0.2);
  }
  for (let z = -14; z <= 12; z += tier ? 6.5 : 13) for (const sx of [-1, 1]) {
    v.set(sx * (26.5 + rnd() * 2), 0, z).applyMatrix4(vm);
    s.rock(v.x, SEA, v.z, 3.5 + rnd() * 2, 4.5 + rnd() * 1.5, 4 + rnd() * 3, 1, z * sx + 70, c, 0.2);
  }
  for (let i = 0; i < (tier ? 7 : 4); i++) {
    const a = 0.3 + (i / (tier ? 7 : 4)) * 2.6;
    v.set(Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5).applyMatrix4(tm);
    if (Math.abs(Math.cos(a)) < 0.3) continue; // the landing steps
    s.rock(v.x, SEA, v.z, 3 + rnd() * 2, 3.6 + rnd() * 1.2, 3 + rnd() * 1.5, 1, i + 90, c, 0.2);
  }
  // Thiruvalluvar's rock: smaller and steeper.
  s.rock(TIR.x, SEA, TIR.z, 15, (TIR.top - SEA + 1) / 1.22, 15, d, 3, c, 0.2);
  for (const [dx, dz, rx, ry, rz] of [[-11, 8, 6, 4, 5], [12, 8, 8, 4, 6], [4, -13, 9, 5, 7]]) s.rock(TIR.x + dx, SEA, TIR.z + dz, rx, ry, rz, 1, dz, c, 0.2);
  for (let i = 0; i < (tier ? 9 : 5); i++) {
    const a = rnd() * Math.PI * 2, r = 1.05 + rnd() * 0.3;
    s.rock(TIR.x + Math.cos(a) * 16 * r, SEA, TIR.z + Math.sin(a) * 15 * r, 2 + rnd() * 3, 1.2 + rnd() * 2, 2 + rnd() * 2.5, 0, i + 31, c);
  }
  s.colour = null;
}

// A Poompuhar ferry: a white hull with a blue band, a two-deck cabin with lit windows, along its own z.
function ferry(s, lit, x, z, rot) {
  s.frame = lit.frame = place(x, 0, z, rot);
  s.box(-2.6, 2.6, SEA - 0.6, SEA + 1.2, -9, 9, '#d8d4cc').box(-2.65, 2.65, SEA + 0.4, SEA + 0.8, -9, 9, '#2a4a9a');
  s.add(new THREE.CylinderGeometry(2.6, 0.01, 3.6, 3).rotateX(-Math.PI / 2).rotateZ(Math.PI).scale(1, 0.5, 1), '#d8d4cc', at(0, SEA + 0.6, -10.8));
  s.box(-2.3, 2.3, SEA + 1.2, SEA + 3.4, -6, 7, '#e6e2da').box(-2, 2, SEA + 3.4, SEA + 5.4, -3, 5, '#e6e2da').box(-2.5, 2.5, SEA + 5.4, SEA + 5.7, -3.5, 5.5, '#c8c0b4');
  lit.box(-2.36, 2.36, SEA + 2, SEA + 2.9, -5.4, 6.4, '#ffd590').box(-2.06, 2.06, SEA + 4.1, SEA + 4.9, -2.5, 4.5, '#ffe2a8');
  s.frame = lit.frame = null;
}

// A coconut palm: a leaning trunk and a crown of drooping fronds.
function palm(s, x, z, h, lean, rnd) {
  const top = V(x + Math.cos(lean) * h * 0.12, h, z + Math.sin(lean) * h * 0.12);
  s.beam(V(x, 0, z), top, 0.45, 0.45, '#3a2c20');
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(), r = 3.6 + rnd();
    const mid = V(top.x + Math.cos(a) * r * 0.55, top.y + 0.8, top.z + Math.sin(a) * r * 0.55), tip = V(top.x + Math.cos(a) * r, top.y - 1.6, top.z + Math.sin(a) * r);
    s.beam(top, mid, 0.7, 0.06, '#1f3a22').beam(mid, tip, 0.4, 0.06, '#1a3020');
  }
}

// Everything on the mainland: the promenade, sea wall and railing, lamps, palms, the jetty and its ferries, the town.
function shoreGeometry(s, lit, tier) {
  const L1 = LAYER, ground = '#16120f', pavers = '#4a403a', wall = '#6a5c50', rail = '#c8c0b0';
  s.plane(-700, 700, EDGE, 200, 0, ground);
  s.plane(-70, 70, EDGE, 25, L1, pavers);
  // The sea wall's face, its foot of boulders, and a railing along the promenade's edge.
  s.box(-700, 700, SEA - 1, 0, EDGE - 0.6, EDGE, wall);
  s.box(-70, 70, 0, 0.18, EDGE, EDGE + 0.5, wall).box(-70, 70, 1, 1.12, EDGE + 0.15, EDGE + 0.35, rail).box(-70, 70, 0.62, 0.7, EDGE + 0.2, EDGE + 0.3, rail);
  for (let x = -70; x <= 70; x += tier ? 2.5 : 5) s.box(x - 0.07, x + 0.07, 0.18, 1.12, EDGE + 0.18, EDGE + 0.32, rail);
  for (const [x0, x1] of [[-700, -70], [70, 700]]) s.box(x0, x1, 0, 0.8, EDGE, EDGE + 0.6, wall);
  const rnd = mulberry(5);
  s.colour = rockColour;
  for (let x = -260; x < 260; x += tier ? 5 : 9) if (x < -68 || x > -56) s.rock(x + rnd() * 3, SEA, EDGE - 2.5 - rnd() * 2, 2.6 + rnd() * 1.6, 1.2 + rnd() * 0.9, 2 + rnd(), 0, x, '#ffffff', 0.4);
  s.colour = null;
  // The ferry jetty to your left, out over the sea on piles, and two ferries at it.
  s.box(-66, -58, 0.2, 0.7, EDGE - 70, EDGE, '#5a5048');
  for (let z = EDGE - 4; z > EDGE - 70; z -= tier ? 6 : 12) for (const x of [-65.4, -58.6]) s.box(x - 0.3, x + 0.3, SEA - 1, 0.2, z - 0.3, z + 0.3, '#3a322c');
  for (const x of [-65.8, -58.2]) s.box(x - 0.08, x + 0.08, 0.7, 1.7, EDGE - 70, EDGE, rail);
  s.box(-68, -56, 0.7, 4.2, EDGE - 76, EDGE - 70, '#8a7a68').box(-68.4, -55.6, 4.2, 4.6, EDGE - 76.4, EDGE - 69.6, '#c8b8a0');
  for (const [x, z, rot] of FERRIES.slice(0, tier ? 3 : 2)) ferry(s, lit, x, z, rot);
  // Seafront lamp standards: a slim post, a curved arm, a lantern.
  for (const [x, z] of LAMPS) s.cyl(0.14, 0.09, 0, 6, x, z, 6, '#1a1a1e').box(x - 0.06, x + 0.06, 5.8, 6, z - 0.9, z, '#1a1a1e');
  // Bollards along the forecourt.
  for (let z = 18; z > -40; z -= tier ? 3 : 6) for (const sx of [-1, 1]) s.box(sx * 12.6 - 0.15, sx * 12.6 + 0.15, 0, 0.7, z - 0.15, z + 0.15, '#2a2420');
  // Palms down both sides of the promenade and along the shore, shade trees behind.
  for (let z = 20; z > EDGE + 2; z -= tier ? 9 : 18) for (const sx of [-1, 1]) palm(s, sx * (22 + rnd() * 6), z, 8 + rnd() * 4, rnd() * 6.28, rnd);
  for (let i = 0; i < (tier ? 14 : 8); i++) { const sx = rnd() < 0.5 ? -1 : 1; palm(s, sx * (75 + rnd() * 160), EDGE + 4 + rnd() * 30, 9 + rnd() * 5, rnd() * 6.28, rnd); }
  for (let i = 0; i < (tier ? 16 : 8); i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 50), z = -10 + rnd() * 40, r = 4 + rnd() * 2;
    s.add(new THREE.IcosahedronGeometry(r, tier > 1 ? 1 : 0), rnd() < 0.5 ? '#13241a' : '#1a3122', at(x, r + 3, z)).cyl(0.35, 0.25, 0, r + 2, x, z, 5, '#2a1e16');
  }
  // Kanyakumari: lodges and houses to the left, the Gandhi Mandapam and more town to the right; windows are spots.
  for (const [x0, x1, z0, z1, h, col] of TOWN.slice(0, tier ? TOWN.length : 10)) s.box(x0, x1, 0, h, z0, z1, col);
  // The Gandhi Mandapam: a pale tower stepped in like a temple's, on a hall.
  const gx = 58, gz = -35;
  s.box(gx - 12, gx + 12, 0, 8, gz - 10, gz + 10, '#c8b4a0').box(gx - 12.5, gx + 12.5, 8, 8.8, gz - 10.5, gz + 10.5, '#e0d0bc');
  for (let i = 0; i < 5; i++) s.box(gx - 5 + i * 0.8, gx + 5 - i * 0.8, 8.8 + i * 4, 12.8 + i * 4, gz - 5 + i * 0.8, gz + 5 - i * 0.8, i % 2 ? '#e0d0bc' : '#c8b4a0');
  s.lathe([[1, 0], [1.1, 0.8], [0.4, 2], [0, 2.4]], gx, 28.8, gz, 6, '#e0d0bc');
  // The Kumari Amman temple's red-and-white striped wall and gopuram, at the shore to your left.
  for (let i = 0; i < 6; i++) s.box(-120, -74, i * 0.8, i * 0.8 + 0.8, EDGE + 6, EDGE + 7, i % 2 ? '#e8e0d4' : '#a83a2a');
  for (let i = 0; i < 5; i++) s.box(-105 + i * 1.2, -89 - i * 1.2, 4.8 + i * 3.4, 8.2 + i * 3.4, EDGE + 8 + i * 0.8, EDGE + 18 - i * 0.8, '#d8c8b0');
  s.box(-100, -94, 21.8, 24, EDGE + 11, EDGE + 15, '#d8c8b0');
  return s;
}
const LAMPS = [];
for (let z = 16; z > EDGE + 4; z -= 16) for (const sx of [-1, 1]) LAMPS.push([sx * 15, z]);
for (const x of [-56, -40, -26, 26, 40]) LAMPS.push([x, EDGE + 1.4]);
const FERRIES = [[-55, EDGE - 62, 0.1], [-71, EDGE - 58, -0.05], [-130, -300, 1.1]];
const TOWN = (() => {
  const out = [], rnd = mulberry(19), cols = ['#2a2420', '#3a302a', '#2e2a2a', '#44382e'];
  for (let i = 0; i < 24; i++) {
    const sx = i % 2 ? 1 : -1, x = sx * (85 + rnd() * 260), z = EDGE + 12 + rnd() * 90, w = 10 + rnd() * 16, d = 8 + rnd() * 10, h = 6 + rnd() * 18;
    if (Math.abs(x - 58) < 26 && z < 0) continue;
    out.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2, h, cols[i % 4]]);
  }
  return out;
})();

// The sea: dark, warmer round the floodlit rocks.
function waterMesh() {
  const g = new THREE.PlaneGeometry(5000, 2400, 32, 26).rotateX(-Math.PI / 2);
  g.translate(0, SEA, EDGE - 1200);
  const p = g.attributes.position, col = [], c = new THREE.Color(), deep = new THREE.Color('#060c2a'), warm = new THREE.Color('#4a3024');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.min(Math.hypot(x - VIV.x, (z - VIV.z) * 1.3), Math.hypot(x - TIR.x, (z - TIR.z) * 1.3));
    c.copy(deep).lerp(warm, clamp(1 - (d - 25) / 90, 0, 1) * 0.85);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
// Glows on the water: gold streaks running towards you under the monuments and lights, and the surf breaking white
// round the rocks and along the sea wall's boulders.
function waterGlow(tier) {
  const pos = [], col = [], c = new THREE.Color(), y = SEA + LAYER;
  const quad = (q) => { for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], y, q[k][1]); col.push(c.r * q[k][2], c.g * q[k][2], c.b * q[k][2]); } };
  const streak = (x, z, hex, len, w, k = 1) => { c.set(hex).multiplyScalar(k); quad([[x - w, z, 1], [x + w, z, 1], [x + w * 0.4, Math.min(EDGE - 4, z + len), 0], [x - w * 0.4, Math.min(EDGE - 4, z + len), 0]]); };
  for (let x = -14; x <= 14; x += tier ? 2 : 4) streak(VIV.x + x, VIV.z + 30, '#ff9a30', 30 + Math.abs(Math.sin(x * 2.3)) * 50, 1.1, 0.5);
  for (let x = -8; x <= 8; x += tier ? 2 : 4) streak(TIR.x + x, TIR.z + 20, '#ffa840', 25 + Math.abs(Math.sin(x * 1.7)) * 45, 1, 0.55);
  for (const [x, z] of FERRIES.slice(0, tier ? 3 : 2)) streak(x, z + 10, '#a8702a', 30, 1.6);
  for (const [x, z] of LAMPS) if (z < EDGE + 2) streak(x, EDGE - 5, '#a87a40', 30, 0.5, 0.6);
  // Surf: broken rings of foam round each rock, whitest on the side the swell comes from.
  const ring = (cx, cz, rx, rz, n, seed) => {
    const rnd = mulberry(seed);
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.2) continue;
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, w = 1.5 + rnd() * 3, r0 = 0.98 + rnd() * 0.06;
      c.set('#8a9ab8').multiplyScalar(0.35 + rnd() * 0.4 + 0.25 * Math.max(0, -Math.sin(a0)));
      const p = (a, r, k) => [cx + Math.cos(a) * (rx * r + k * w), cz + Math.sin(a) * (rz * r + k * w)];
      const q = [[...p(a0, r0, 0), 1], [...p(a1, r0, 0), 1], [...p(a1, r0, 1), 0], [...p(a0, r0, 1), 0]];
      quad([q[0], q[3], q[2], q[1]]);
    }
  };
  ring(VIV.x, VIV.z, 38, 28, tier ? 40 : 24, 3); ring(TIR.x, TIR.z, 19, 18, tier ? 28 : 16, 4);
  for (let x = -260; x < 260; x += 6) { c.set('#7a88a8').multiplyScalar(0.3 + Math.abs(Math.sin(x * 0.37)) * 0.4); quad([[x, EDGE - 4.5, 1], [x + 6, EDGE - 4.5, 1], [x + 6, EDGE - 8 - Math.abs(Math.sin(x)) * 3, 0], [x, EDGE - 8, 0]]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// Diyas on the railing and forecourt, lamps, string lights and floodlamps on both rocks, ferries, fishing boats, town.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', bulb = '#ffd88a', step = tier ? 2.4 : 4, v = new THREE.Vector3();
  const put = (m, x, y, z, col) => { v.set(x, y, z).applyMatrix4(m); out.push([v.x, v.y, v.z, col]); };
  for (let x = -69; x <= 69; x += step) out.push([x, 1.2, EDGE + 0.25, diya]);
  for (const sx of [-1, 1]) for (let z = 18; z > -40; z -= step) out.push([sx * 11.8, 0.25, z, diya]);
  for (const [x, z] of LAMPS) out.push([x, 5.6, z - 0.85, lamp]);
  // The memorial: bulbs along the terrace parapet and the hall's cornice, floodlamps at the rock's foot.
  const vm = place(VIV.x, VIV.top, VIV.z, VIV.rot);
  for (let x = -24.5; x <= 24.6; x += step * 0.7) if (Math.abs(x) > 4.2) put(vm, x, 1.7, 15, bulb);
  for (let z = -16; z < 15; z += step * 0.9) for (const sx of [-1, 1]) put(vm, sx * 24.9, 1.7, z, bulb);
  for (let x = -8.6; x <= 8.7; x += step * 0.5) put(vm, x, 13.3, 3.8, bulb);
  for (let x = -6.6; x <= 6.7; x += step * 0.5) put(vm, x, 9.5, 11.9, bulb);
  for (let i = 0; i < 5; i++) put(vm, -3.6 + i * 1.8, 0.7 - i * 0.6, 15.4 + i * 0.7, diya);
  for (const x of [-20, -12, -4, 4, 12, 20]) put(vm, x, SEA - VIV.top + 4, 26, '#fff0c0');
  // The statue: bulbs along the pedestal's cornice and the platform's edge, floodlamps on the platform's corners.
  const tm = place(TIR.x, TIR.top, TIR.z, TIR.rot);
  for (let t = -5.6; t <= 5.7; t += step * 0.5) put(tm, t, 11.7, 6, bulb);
  for (let t = -8.2; t <= 8.3; t += step * 0.7) for (const [a, b] of [[t, 8.6], [-8.6, t], [8.6, t]]) put(tm, a, 1.3, b, bulb);
  for (const [a, b] of [[-8, 8], [8, 8], [-8, -8], [8, -8]]) put(tm, a, 1.6, b, '#fff4d0');
  // Ferries: masthead, a string of bulbs along the upper deck.
  for (const [x, z, rot] of FERRIES.slice(0, tier ? 3 : 2)) {
    const m = place(x, 0, z, rot);
    put(m, 0, SEA + 8, 2, '#ffffff');
    for (let k = -3; k <= 5; k += tier ? 1 : 2) for (const sx of [-1, 1]) put(m, sx * 2.4, SEA + 5.6, k, k % 2 ? '#ffb347' : '#ffe08a');
  }
  const rnd = mulberry(77);
  // Fishing boats far out, and the jetty's lights.
  for (let i = 0; i < (tier ? 40 : 20); i++) { const a = -1.2 + rnd() * 2.4, d = 500 + rnd() * 1300; out.push([Math.sin(a) * d, SEA + 1 + rnd() * 2, -Math.cos(a) * d, rnd() < 0.8 ? '#ffd28a' : '#ffffff']); }
  for (let z = EDGE - 6; z > EDGE - 70; z -= step * 2) for (const x of [-65.8, -58.2]) out.push([x, 1.8, z, lamp]);
  // The town's windows; the Gandhi Mandapam's outline.
  for (const [x0, x1, z0, z1, h] of TOWN.slice(0, tier ? TOWN.length : 10)) {
    const n = Math.round((x1 - x0) * h * 0.04 * (tier ? 1 : 0.5));
    for (let i = 0; i < n; i++) out.push([x0 + rnd() * (x1 - x0), 2 + rnd() * (h - 3), z0 - 0.2, rnd() < 0.8 ? '#ffd9a0' : '#fff2d8']);
  }
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) out.push([58 + sx * (5 - i * 0.8), 12.9 + i * 4, -29.8 + i * 0.8, bulb]);
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = graniteTexture();
  const mon = new Stone(vivColour);
  mon.frame = place(VIV.x, VIV.top, VIV.z, VIV.rot);
  memorialGeometry(mon, tier);
  mon.frame = null; mon.colour = tirColour;
  statueGeometry(mon, tier);
  const front = mon.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a2810' }));
  const glow = mon.mesh(1, new THREE.MeshBasicMaterial({ vertexColors: true }));
  const lit = new Stone(), world = shoreGeometry(new Stone(), lit, tier);
  rocks(world, tier);
  const objects = [front, glow, world.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#100a08' })), lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })),
    waterMesh(), waterGlow(tier)];
  // The promenade where crackers stand: warm grey granite slabs.
  objects.push(forecourt({ rgb: [104, 94, 86], z0: -40, z1: 20, width: 24, tile: 2, joint: 'rgba(200,180,160,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower, orange and rose over the sea; no moon on Diwali.
    sky: ['#03061a', '#141a4c', '#5a3c80', '#e0845a'],
    fog: ['#3e3060', 420, 1900],
    clouds: { colour: '#b07a9a', count: tier ? 10 : 5, seed: 33 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.7, [-30, 20, 300]], ['#ffe0b8', 0.45, [150, 40, 200]], ['#8e96c8', 0.35, [200, 300, -500]]],
  };
}
