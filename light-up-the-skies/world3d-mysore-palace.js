/* Light Up the Skies — 3D background: Mysore Palace on a Dasara night, seen from the open grounds before its east
   front, every line of it outlined in warm bulbs. Loaded by world3d.js when Mysore Palace is the chosen world. Its
   colours follow the game's 2D picture: a deep blue night going violet and rose at the horizon, the facade glowing gold
   under its strings of lights, the arches dark and amber inside, the domes rose-red, the central one gilded.

   Proportions follow published figures: a front of about 75 m on a raised plinth (88 m here with the corner towers), a
   projecting portico of seven great arches with a smaller arcade above, the Indo-Saracenic central tower of five
   storeys to a gilded dome whose finial stands about 44 m up, two lower towers flanking the portico, domed towers at
   the corners and little chhatris on the roof. Everything is a box, an extruded outline or a lathe, merged into a few
   meshes with one drawn plaster texture; the gold is baked into vertex colours and the bulbs are the scene's spots.

   Frame: +x to your right, +y up, +z towards you; the palace's local origin is the centre of its base. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const MZ = -170; // the palace's centre, across the grounds
const P = 1.6; // the plinth's top
const FZ = 10, PF = 15; // the wings' front face; the portico's
const WALL = 92; // the fort walls either side of the grounds
const GROUND_Z = MZ + PF + 3.4; // where the grounds meet the plinth

// ---------- Plaster: lime-washed granite in courses of 0.5 m, one tile per 4 m ----------
function plasterTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(61), px = 256 / 4;
  g.fillStyle = '#f6ecda'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 0.5 * px) {
    let x = -rnd() * 40;
    while (x < 256) {
      const w = (1.1 + rnd() * 0.9) * px, v = 0.93 + rnd() * 0.07;
      g.fillStyle = `rgb(${(246 * v) | 0},${(236 * v) | 0},${(218 * v) | 0})`; g.fillRect(x + 1, y + 1, w - 2, 0.5 * px - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(90,66,40,0.22)'; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(100,76,50,${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a lit vertex colour; force = 1 sends what is added to the second, unlit set.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.force = 0;
  }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, base = new THREE.Color(color), set = this.sets[this.force];
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        set.pos.push(v.x, v.y, v.z); set.nor.push(tmpN.x, tmpN.y, tmpN.z);
        set.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = this.colour && !this.force ? this.colour(v.x, v.y, v.z, tmpN, base) : base;
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

// A raised, slightly pointed arch over (cx, spring), half span wide: its points from the left springing to the right.
const archTop = (cx, spring, half, n) => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI - (Math.PI * i) / n; return [cx + Math.cos(a) * half, spring + Math.pow(Math.max(0, Math.sin(a)), 0.75) * half * 1.3]; });
// The same arch as a closed opening, down to its sill.
const archHole = (cx, sill, spring, half, n) => [[cx - half, sill], ...archTop(cx, spring, half, n), [cx + half, sill]];

// ---------- Bulbs: the Dasara strings, as glowing spots in the palace's frame ----------
const BULBS = [];
let STEP = 0.75; // a bulb every this many metres
function bline(x0, y0, z0, x1, y1, z1, first = true) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / STEP));
  for (let i = first ? 0 : 1; i <= n; i++) { const t = i / n; BULBS.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t]); }
}
// A wall face: its centre (x, z) on the ground and its along-the-face direction (ux, uz); it faces (-uz, ux).
const face = (x, z, ux, uz) => ({ x, z, ux, uz });
const onFace = (f, u, y, out) => [f.x + f.ux * u - f.uz * out, y, f.z + f.uz * u + f.ux * out];
function bpath(f, pts, out = 0.15) {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [onFace(f, pts[i - 1][0], pts[i - 1][1], out), onFace(f, pts[i][0], pts[i][1], out)];
    bline(...a, ...b, i === 1);
  }
}
// A flat shape in a face's (u, y) plane, depth d out from it.
function onFaceShape(s, f, pts, d0, d1, color) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.ux, 0, f.uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-f.uz, 0, f.ux));
  m.setPosition(f.x - f.uz * d0, 0, f.z + f.ux * d0);
  s.add(new THREE.ExtrudeGeometry(shape, { depth: d1 - d0, bevelEnabled: false }), color, m);
}
// A lit arched opening on a face: an amber panel just proud of the wall, ringed with bulbs.
function litArch(s, f, u, sill, spring, half, n, color = '#d88a3a') {
  s.force = 1; onFaceShape(s, f, archHole(u, sill, spring, half, n), 0, 0.1, color); s.force = 0;
  bpath(f, archHole(u, sill, spring, half + 0.2, n), 0.2);
}

// The palace's gold, by height: deeper amber low down where the bulbs crowd, paler gold up the towers.
const BANDS = [[P, '#c88a48', '#e2a85c'], [16, '#ffcc78', '#ffd88e'], [30, '#ffd88e', '#ffe2a4'], [99, '#ffe2a4', '#ffe8b4']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function goldColour(x, y, z, n, base) {
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)).multiply(base);
    lo = top;
  }
  return base;
}

const BUFF = '#fff4e2', ROSE = '#e8707a', GILT = '#ffbe48';
// An onion dome's profile, for radius 1: a bulging bell drawn to a point.
const ONION = [[0.82, 0], [0.98, 0.2], [1.06, 0.5], [1, 0.86], [0.78, 1.18], [0.48, 1.46], [0.22, 1.66], [0.08, 1.82], [0, 1.9]];

// An onion dome of radius r at (x, y, z), its ribs strung with bulbs, a finial on top.
function dome(s, x, y, z, r, color, seg, ribs) {
  s.cyl(r * 0.86, r * 0.86, y, y + r * 0.18, x, z, seg, BUFF); // the collar
  const y0 = y + r * 0.18;
  s.lathe(ONION.map(([a, b]) => [a * r, b * r]), x, y0, z, seg, color);
  const top = y0 + r * 1.9;
  s.cyl(r * 0.06, r * 0.03, top, top + r * 0.5, x, z, 4, GILT).add(new THREE.SphereGeometry(r * 0.09, 5, 4), GILT, at(x, top + r * 0.3, z));
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 1; i < ONION.length; i++) {
      const [r0, h0] = ONION[i - 1], [r1, h1] = ONION[i];
      bline(x + sa * r0 * r * 1.04, y0 + h0 * r, z + ca * r0 * r * 1.04, x + sa * r1 * r * 1.04, y0 + h1 * r, z + ca * r1 * r * 1.04, i === 1);
    }
  }
  for (let k = 0; k < ribs * 2; k++) { const a = (k / (ribs * 2)) * Math.PI * 2; BULBS.push([x + Math.sin(a) * r * 0.92, y + r * 0.2, z + Math.cos(a) * r * 0.92]); }
  bline(x, top, z, x, top + r * 0.5, z);
}

// A square tower in stages ([y0, y1, width] each) at (cx, cz): a cornice and a lit arch on each of its three outer
// faces per stage, bulbs up its corners and round every cornice; an octagonal drum and an onion dome on top.
function tower(s, cx, cz, stages, drum, r, color, tier) {
  const n = tier ? 8 : 5;
  for (const [y0, y1, w] of stages) {
    const h = w / 2;
    s.box(cx - h, cx + h, y0, y1, cz - h, cz + h, BUFF);
    s.box(cx - h - 0.3, cx + h + 0.3, y1 - 0.6, y1, cz - h - 0.3, cz + h + 0.3, BUFF);
    const k = w > 9 ? 3 : w > 6.5 ? 2 : 1, pitch = w / k, half = Math.min(pitch * 0.27, 1.4);
    const spring = y1 - 1.1 - half * 1.3, sill = Math.min(y0 + 1, spring - 0.6);
    for (const f of [face(cx, cz + h, 1, 0), face(cx + h, cz, 0, -1), face(cx - h, cz, 0, 1)]) {
      for (let i = 0; i < k; i++) litArch(s, f, -h + pitch * (i + 0.5), sill, spring, half, n);
    }
    const e = h + 0.4;
    bline(cx - e, y1 + 0.05, cz + e, cx + e, y1 + 0.05, cz + e);
    bline(cx - e, y1 + 0.05, cz - e, cx - e, y1 + 0.05, cz + e); bline(cx + e, y1 + 0.05, cz - e, cx + e, y1 + 0.05, cz + e);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bline(cx + sx * (h + 0.12), y0, cz + sz * (h + 0.12), cx + sx * (h + 0.12), y1 - 0.6, cz + sz * (h + 0.12));
    // Little pinnacles on the cornice's corners.
    if (tier) for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.cyl(0.22, 0.16, y1, y1 + 1.2, cx + sx * h, cz + sz * h, 4, BUFF).add(new THREE.ConeGeometry(0.28, 0.7, 4), ROSE, at(cx + sx * h, y1 + 1.55, cz + sz * h));
  }
  const top = stages[stages.length - 1][1], seg = tier > 1 ? 16 : tier ? 12 : 8;
  s.cyl(drum[0], drum[0], top, top + drum[1], cx, cz, 8, BUFF).cyl(drum[0] + 0.3, drum[0] + 0.3, top + drum[1] - 0.4, top + drum[1], cx, cz, 8, BUFF);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; BULBS.push([cx + Math.sin(a) * (drum[0] + 0.4), top + drum[1], cz + Math.cos(a) * (drum[0] + 0.4)]); }
  dome(s, cx, top + drum[1], cz, r, color, seg, tier ? 8 : 6);
}

// A chhatri: four posts, a cornice and a little dome.
function chhatri(s, x, y, z, r, tier) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(x + sx * r * 0.8 - 0.12, x + sx * r * 0.8 + 0.12, y, y + r * 1.6, z + sz * r * 0.8 - 0.12, z + sz * r * 0.8 + 0.12, BUFF);
  s.box(x - r - 0.1, x + r + 0.1, y + r * 1.6, y + r * 1.6 + 0.3, z - r - 0.1, z + r + 0.1, BUFF);
  s.force = 1; s.box(x - r * 0.6, x + r * 0.6, y, y + r * 1.4, z - r * 0.6, z + r * 0.6, '#e09040'); s.force = 0;
  dome(s, x, y + r * 1.6 + 0.3, z, r * 0.95, ROSE, tier ? 10 : 6, 4);
}

// An arcaded front from x0 to x1 (face at z1, depth back to z0), its height in tiers [sill, spring, half, count].
function arcade(s, x0, x1, top, z0, z1, tiers, tier) {
  const n = tier ? 8 : 5, holes = [], f = face(0, z1, 1, 0);
  for (const [sill, spring, half, count] of tiers) {
    const pitch = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const cx = x0 + pitch * (i + 0.5);
      holes.push(archHole(cx, sill, spring, half, n));
      s.force = 1; s.box(cx - half - 0.2, cx + half + 0.2, sill, spring + half * 1.3 + 0.2, z0 - 0.3, z0 - 0.2, '#b8682c'); s.force = 0; // the dim, lamp-lit hall inside
      bpath(f, archHole(cx, sill, spring, half + 0.18, n), 0.12);
    }
  }
  s.extrudeZ([[x0, P], [x1, P], [x1, top], [x0, top]], z0, z1, BUFF, holes);
}

// The palace, around its local origin.
function palaceGeometry(s, tier) {
  // The plinth and the steps up to the portico.
  s.box(-46, 46, 0, P, -30, PF + 3, BUFF);
  for (let i = 0; i < 3; i++) s.box(-9, 9, 0, P - i * 0.5, PF + 3, PF + 3.8 + i * 0.8, BUFF);
  bline(-46, P + 0.1, PF + 3.15, 46, P + 0.1, PF + 3.15);
  // The main block behind the arcades.
  s.box(-36, 36, P, 15, -26, FZ - 1.3, BUFF);
  bline(-36.2, 15.1, -26, -36.2, 15.1, FZ - 7); bline(36.2, 15.1, -26, 36.2, 15.1, FZ - 7);
  // The wings: two tiers of arches between the flanking towers and the corner towers, a parapet over them.
  for (const sx of [-1, 1]) {
    const [x0, x1] = sx > 0 ? [24.5, 36] : [-36, -24.5];
    arcade(s, x0, x1, 15, FZ - 1, FZ, [[P, 6.6, 1.05, 4], [9.6, 12.3, 0.85, 4]], tier);
    s.box(x0, x1, 8.6, 9.2, FZ, FZ + 0.5, BUFF); // the string course between them
    s.box(x0, x1, 15, 15.9, FZ - 1.3, FZ + 0.4, BUFF); // the parapet
    bline(x0, 9.25, FZ + 0.55, x1, 9.25, FZ + 0.55); bline(x0, 15.95, FZ + 0.45, x1, 15.95, FZ + 0.45);
    if (tier) for (let x = x0 + 0.7; x < x1; x += 1.45) s.cyl(0.14, 0.1, 15.9, 16.7, x, FZ + 0.1, 4, BUFF);
    chhatri(s, sx * 30.25, 15.9, FZ - 2, 1.4, tier);
  }
  // The portico: seven great arches, a balcony, fourteen smaller arches, a parapet; columns before its piers.
  s.box(-18.5, 18.5, P, 18, FZ - 1.3, PF - 1.3, BUFF);
  arcade(s, -18.5, 18.5, 18, PF - 1, PF, [[P, 8.4, 1.9, 7], [13.2, 15.2, 0.9, 14]], tier);
  s.box(-18.6, 18.6, 12, 12.6, PF, PF + 0.7, BUFF).box(-18.6, 18.6, 17.4, 18, PF - 1.3, PF + 0.5, BUFF);
  bline(-18.5, 12.7, PF + 0.75, 18.5, 12.7, PF + 0.75); bline(-18.5, 18.05, PF + 0.55, 18.5, 18.05, PF + 0.55);
  for (let i = 1; i < 7; i++) {
    const x = -18.5 + (37 / 7) * i;
    s.cyl(0.42, 0.36, P, 12, x, PF + 0.35, tier ? 8 : 5, BUFF);
    bline(x, P + 0.3, PF + 0.85, x, 11.8, PF + 0.85);
  }
  if (tier) for (let x = -18; x <= 18; x += 1.5) s.cyl(0.14, 0.1, 18, 18.8, x, PF + 0.1, 4, BUFF);
  // The central tower: three more storeys over the portico's two, rising to the gilded dome.
  tower(s, 0, FZ - 3, [[18, 23.5, 14], [23.5, 28.5, 12], [28.5, 32.5, 8]], [3.8, 2.4], 4.8, GILT, tier);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(s, sx * 5.2, 28.5, FZ - 3 + sz * 5.2, 0.8, tier);
  // The towers flanking the portico, and the corner towers.
  for (const sx of [-1, 1]) {
    tower(s, sx * 21.5, FZ + 2.5, [[P, 18, 6], [18, 23, 5.2], [23, 26.5, 4.4]], [2, 1.6], 2.4, ROSE, tier);
    tower(s, sx * 40, FZ - 3, [[P, 16.5, 8], [16.5, 22.5, 7.2], [22.5, 27, 6]], [2.7, 2], 3.2, ROSE, tier);
  }
  return s;
}

// A lamp standard: a black post and a glowing globe.
function lampAt(s, lit, x, z) {
  s.cyl(0.14, 0.09, 0, 3.8, x, z, 5, '#141418');
  lit.add(new THREE.SphereGeometry(0.22, 6, 4), '#ffe2a0', at(x, 4, z));
}
const LAMPS = [];
for (let z = 16; z > -40; z -= 12) for (const sx of [-1, 1]) LAMPS.push([sx * 15.5, z]);
for (let z = -46; z > GROUND_Z; z -= 14) for (const sx of [-1, 1]) LAMPS.push([sx * 61, z]);
for (let x = 14; x < 60; x += 11) for (const sx of [-1, 1]) LAMPS.push([sx * x, GROUND_Z + 6]);

// Everything round the palace: the grounds, lawns, the fort walls with their gates, two temples, trees, lamps, the
// city beyond and Chamundi Hill on the skyline. World coordinates; strings of bulbs go to `bulbs`.
function groundsGeometry(s, lit, tier, bulbs) {
  const L1 = LAYER, earth = '#12110e', lawn = '#15241a', sand = '#76644e', wallC = '#c8b494';
  s.plane(-1200, 1200, -1500, 300, 0, earth);
  // Lawns either side of the forecourt and of the grounds; the grounds themselves gravel, a layer above.
  for (const sx of [-1, 1]) {
    const [a, b] = sx > 0 ? [14, WALL] : [-WALL, -14];
    s.plane(a, b, -40, 60, L1, lawn);
    const [c, d] = sx > 0 ? [62, WALL] : [-WALL, -62];
    s.plane(c, d, MZ - 60, -40, L1, lawn);
  }
  s.plane(-62, 62, GROUND_Z, -40.3, 2 * L1, sand);
  s.plane(-WALL, WALL, MZ - 120, GROUND_Z - 14, L1, lawn); // gardens round the back, past the plinth
  // The fort walls: crenellated, a string of bulbs along the top.
  const b = (x0, y0, z0, x1, y1, z1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / (STEP * 1.6))); for (let i = 0; i <= n; i++) { const t = i / n; bulbs.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t]); } };
  for (const sx of [-1, 1]) {
    const x = sx * WALL;
    s.box(x - 1.2, x + 1.2, 0, 6.5, MZ - 120, 60, wallC);
    if (tier) for (let z = MZ - 118; z < 60; z += 3) s.box(x - 1.1, x + 1.1, 6.5, 7.4, z, z + 1.4, wallC);
    b(x - sx * 1.3, 6.6, MZ - 120, x - sx * 1.3, 6.6, 60);
    // A gateway in each wall, facing the grounds: a lit arch between two domed turrets.
    const gz = -88, fx = x - sx * 1.2;
    s.box(x - 3, x + 3, 0, 13, gz - 7, gz + 7, wallC);
    const f = sx > 0 ? face(x - 3, gz, 0, 1) : face(x + 3, gz, 0, -1);
    s.force = 1; onFaceShape(s, f, archHole(0, 0, 6.5, 2.6, 8), 0, 0.1, '#d08a3c'); s.force = 0;
    for (const [px, py, pz] of archHole(0, 0, 6.5, 2.8, 8).map(([u, y]) => onFace(f, u, y, 0.15))) bulbs.push([px, py, pz]);
    b(fx - sx * 1.9, 13.1, gz - 7, fx - sx * 1.9, 13.1, gz + 7);
    for (const dz of [-1, 1]) {
      const tz = gz + dz * 8.5;
      s.box(x - 2.2, x + 2.2, 0, 15, tz - 2.2, tz + 2.2, wallC);
      s.lathe(ONION.map(([a, h]) => [a * 2, h * 2]), x, 15, tz, tier ? 10 : 6, ROSE);
      b(x - sx * 2.3, 0.4, tz + 2.3 * dz, x - sx * 2.3, 15, tz + 2.3 * dz);
    }
  }
  // Two temples inside the fort, one each side: a stepped gopuram, its tiers outlined.
  for (const [tx, tz] of [[-74, -128], [76, -112]]) {
    s.box(tx - 6, tx + 6, 0, 6, tz - 4, tz + 4, wallC);
    for (let i = 0; i < 4; i++) {
      const y0 = 6 + i * 3, w = 5.4 - i * 1.05, d = 3.4 - i * 0.6;
      s.box(tx - w, tx + w, y0, y0 + 3, tz - d, tz + d, wallC);
      b(tx - w, y0 + 3, tz + d + 0.1, tx + w, y0 + 3, tz + d + 0.1);
    }
    s.add(new THREE.CylinderGeometry(1.2, 1.2, 4, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wallC, at(tx, 18, tz));
    for (const dx of [-1.2, 0, 1.2]) s.cyl(0.25, 0.08, 19.2, 20.6, tx + dx, tz, 5, GILT);
    b(tx - 6, 6, tz + 4.1, tx + 6, 6, tz + 4.1);
  }
  for (const [x, z] of LAMPS) lampAt(s, lit, x, z);
  // Trees: ashokas, tall and narrow, before the wings; broad rain trees on the lawns and round the walls.
  const rnd = mulberry(11), LEAF = new THREE.Color('#6a7a34');
  const tree = (x, z, r, tall = false) => {
    r *= 0.8 + rnd() * 0.4;
    const cy = (tall ? r * 1.8 : r * 0.7) + 2.6, near = Math.abs(z) < 200 && Math.abs(x) < 100;
    s.colour = near ? (vx, vy, vz, nn, base) => tmpCol.copy(base).lerp(LEAF, clamp((cy - vy) / (r * 0.8) + 0.2, 0, 1) * 0.6) : null;
    const geo = tall ? new THREE.ConeGeometry(r, r * 4, tier ? 7 : 5) : new THREE.IcosahedronGeometry(r, 0).scale(1, 0.7, 1);
    s.add(geo, rnd() < 0.5 ? '#13241a' : '#1a3020', at(x, cy, z));
    s.colour = null;
    s.cyl(0.35, 0.25, 0, cy - (tall ? r * 1.6 : 0), x, z, 5, '#2a1e16');
  };
  for (let z = 22; z > -40; z -= tier ? 10 : 20) for (const sx of [-1, 1]) tree(sx * (22 + rnd() * 8), z, 4.2);
  for (let i = 0; i < (tier ? 12 : 6); i++) for (const sx of [-1, 1]) tree(sx * (68 + rnd() * 18), -46 - rnd() * 110, 5);
  for (let x = 28; x < 60; x += tier ? 7 : 14) for (const sx of [-1, 1]) tree(sx * x, GROUND_Z + 9 + rnd() * 3, 1.5, true);
  for (let x = -WALL + 10; x < WALL; x += tier ? 14 : 28) tree(x + rnd() * 6, MZ - 70 - rnd() * 30, 7);
  for (let i = 0; i < (tier ? 24 : 12); i++) for (const sx of [-1, 1]) tree(sx * (110 + rnd() * 160), 40 - rnd() * 400, 8);
  // The city beyond the walls: dark blocks (their windows are spots).
  const r2 = mulberry(23);
  for (let i = 0; i < (tier ? 30 : 15); i++) {
    const a = -1.2 + r2() * 2.4, d = 420 + r2() * 300, x = Math.sin(a) * d, z = -Math.cos(a) * d, w = 16 + r2() * 26, h = 10 + r2() * 26;
    s.box(x - w / 2, x + w / 2, 0, h, z - 12, z + 12, '#1c1a20');
    BLOCKS.push([x, z, w, h]);
  }
  // Chamundi Hill to the south-east: a long dark ridge on the skyline.
  s.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(520, 150, 260), '#15142a', at(420, 0, -1250));
  return s;
}
const BLOCKS = [];

// Bulbs on the palace and the walls; diyas along the forecourt; lamps; the city's windows; the hill's road and temple.
function lightSpots(tier, wallBulbs) {
  const out = [], rnd = mulberry(77), diya = '#ff9f3a', lamp = '#ffe6a8';
  const bulb = () => (rnd() < 0.8 ? '#ffbe50' : rnd() < 0.5 ? '#ffe2a0' : '#ff8a30');
  for (const [x, y, z] of BULBS) out.push([x, y, z + MZ, bulb()]);
  for (const [x, y, z] of wallBulbs) out.push([x, y, z, bulb()]);
  const step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) for (let z = 18; z > -40; z -= step) out.push([sx * 14.4, 0.3, z, diya]);
  for (let x = -60; x <= 60; x += step) out.push([x, 0.35, GROUND_Z + 0.4, diya]);
  for (const [x, z] of LAMPS) out.push([x, 4, z, lamp]);
  for (const [x, z, w, h] of BLOCKS) for (let i = 0; i < (tier ? 5 : 2); i++) out.push([x - w / 2 + rnd() * w, 3 + rnd() * (h - 4), z + 12.2, rnd() < 0.8 ? '#ffd9a0' : '#ffffff']);
  // The road up Chamundi Hill, zigzagging, and the temple lit at the top.
  for (let i = 0; i < (tier ? 60 : 30); i++) {
    const t = i / (tier ? 60 : 30), y = t * 140, rr = Math.sqrt(1 - (y / 150) ** 2);
    out.push([420 + Math.sin(t * 18) * 380 * rr * 0.6, y + 2, -1250 + 260 * rr * 0.96, '#ffd890']);
  }
  for (let i = 0; i < 6; i++) out.push([414 + i * 2.4, 152, -1250, '#ffe2a0']);
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  BULBS.length = 0; BLOCKS.length = 0;
  STEP = tier > 1 ? 0.7 : tier ? 0.8 : 1.1;
  const map = plasterTexture();
  const pal = palaceGeometry(new Stone(goldColour), tier);
  const objects = [];
  for (const m of [pal.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#5a3410' })), pal.mesh(1, new THREE.MeshBasicMaterial({ map, vertexColors: true }))]) {
    m.position.z = MZ; objects.push(m);
  }
  const lit = new Stone(), wallBulbs = [];
  const world = groundsGeometry(new Stone(), lit, tier, wallBulbs);
  objects.push(world.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })), world.mesh(1, new THREE.MeshBasicMaterial({ map, vertexColors: true })), lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })));
  // The forecourt where crackers stand: pale granite flags.
  objects.push(forecourt({ rgb: [112, 100, 92], z0: -40, z1: 20, width: 28, tile: 2, joint: 'rgba(210,190,170,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects: objects.filter(Boolean), spots: lightSpots(tier, wallBulbs),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower down, a rose glow at the horizon.
    sky: ['#03061a', '#151848', '#4a2c7a', '#b85a7c'],
    fog: ['#38285e', 320, 1600],
    clouds: { colour: '#7a5aa8', count: tier ? 9 : 5, seed: 29 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.8],
    directional: [['#ffd890', 1.6, [-30, 25, 300]], ['#ffe2b8', 0.45, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
