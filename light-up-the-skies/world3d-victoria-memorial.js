/* Light Up the Skies — 3D background: the Victoria Memorial on Diwali night, seen from the north across the gardens
   and the great reflecting pool, the path running on past Queen Victoria's statue to the steps. Loaded by world3d.js
   when the Victoria Memorial is the chosen world. Its colours follow the game's 2D picture: a deep blue night going
   purple and pink at the horizon, the white Makrana marble floodlit warm cream and gold, lit windows along the lower
   storey, rain trees and lamps round a dark pool full of their reflections.

   Proportions follow published figures: a hall about 103 m by 69 m on a raised terrace, two storeys to a balustrade at
   about 21 m, a taller central block with an arched porch, the drum and the central dome topped by the bronze Angel of
   Victory at 56 m, four small domed turrets round the dome, and at the ends of the long arcaded wings four domed corner
   towers of about 38 m. Everything is a box, an extruded outline or a lathe, merged into a few meshes with one drawn
   marble texture; the floodlit look is baked into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the memorial's local origin is the centre of its base. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const MZ = -205; // the memorial's centre, across the pool and the gardens
const T = 2.2; // the terrace's top, the hall's floor
const HX = 52, HZ = 30; // the hall: half width, half depth
const CB = 20, CT = 27; // the central block: half width, its roof
const DOME = 36; // the dome's springing, on the drum
const POOL = { x: 70, z0: -48, z1: -116, y: -0.35 }; // the reflecting pool
const PATH = { z0: -125, z1: MZ + 52 }; // the path from the pool's far walk to the steps
const STATUE = -140; // Queen Victoria's statue on the path

// ---------- Marble: white Makrana in courses of 0.6 m, faint veins, one tile per 4 m ----------
function marbleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(31), px = 256 / 4;
  g.fillStyle = '#f7f2e9'; g.fillRect(0, 0, 256, 256);
  let y = 0, row = 0;
  while (y < 256) {
    const h = 0.6 * px;
    let x = -(row % 2) * 30;
    while (x < 256) {
      const w = (1.2 + rnd() * 0.9) * px, v = 0.96 + rnd() * 0.04;
      g.fillStyle = `rgb(${(247 * v) | 0},${(242 * v) | 0},${(233 * v) | 0})`;
      g.fillRect(x + 1, y + 1, w - 2, h - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(130,110,90,0.12)'; g.fillRect(0, y, 256, 1);
    y += h; row++;
  }
  g.strokeStyle = 'rgba(150,135,120,0.12)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(rnd() * 256, rnd() * 256); g.bezierCurveTo(rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base, set) gives a vertex colour; glow(cx, cy, cz, normal) sends a triangle to the second,
// unlit set (or force does). frame, when set, places everything added in the world.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null, glow = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.glow = glow; this.frame = null; this.force = null;
  }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (this.frame) g.applyMatrix4(this.frame);
    const p = g.attributes.position, base = new THREE.Color(color);
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
      const cx = (tmpA.x + tmpB.x + tmpC.x) / 3, cy = (tmpA.y + tmpB.y + tmpC.y) / 3, cz = (tmpA.z + tmpB.z + tmpC.z) / 3;
      const si = this.force ?? (this.glow && this.glow(cx, cy, cz, tmpN) ? 1 : 0), set = this.sets[si];
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        set.pos.push(v.x, v.y, v.z); set.nor.push(tmpN.x, tmpN.y, tmpN.z);
        set.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = this.colour ? this.colour(v.x, v.y, v.z, tmpN, base, si) : base;
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
// Turned to face outward at angle a round the origin, radius r: for drum windows and pilasters.
const round = (a, r, y) => new THREE.Matrix4().makeRotationY(a).setPosition(Math.sin(a) * r, y, Math.cos(a) * r);

// A round arch over (cx, spring), half span wide: its points from the left springing to the right.
const roundArch = (cx, spring, half, n) => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI - (Math.PI * i) / n; return [cx + Math.cos(a) * half, spring + Math.sin(a) * half]; });
// The same arch as a closed opening, down to its sill.
const archHole = (cx, sill, spring, half, n) => [[cx - half, sill], ...roundArch(cx, spring, half, n), [cx + half, sill]];

// The floodlit marble of the 2D picture, by height: warm gold low down where the floods graze, cream higher up, the
// dome golden; the bronze angel keeps her own colour.
const BANDS = [[T, '#c8a67c', '#e6c89a'], [11, '#ffe0a8', '#ffeac4'], [21.5, '#ffeed2', '#ffe2b8'], [DOME, '#ffe4b6', '#f8d8a6'], [53.2, '#ffe4ae', '#f0c88c'], [99, '#ffffff', '#ffffff']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color(), WARM = new THREE.Color('#ffc874');
function marbleColour(x, y, z, n, base, si) {
  if (si) return Math.abs(x) < 5.3 && z > HZ + 1 ? WARM : base; // the porch's passage glows; lit openings keep theirs
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)).multiply(base);
    lo = top;
  }
  return base;
}
// The porch's passage: its walls and vault lit from inside.
const inPorch = (cx, cy, cz, n) => Math.abs(cx) < 5.3 && cz > HZ + 2.05 && cz < HZ + 13.95 && cy > T + 0.05 && cy < 18.3 && Math.abs(n.z) < 0.5;

// The memorial, around its local origin.
function memorialGeometry(s, tier) {
  const n = tier ? 10 : 6, buff = '#ffffff', shade = '#a88a6c', deep = '#6e5644', lamp = '#ffcf7a', bronze = '#6a4a2a';
  const FZ = HZ; // the wings' front face
  // The terrace, its steps and the hall: two storeys, a string course, a cornice and a balustrade.
  s.box(-60, 60, 0, T, -42, 42, buff);
  for (let i = 0; i < 4; i++) s.box(-14, 14, 0, T - i * 0.55, 42, 43.6 + i * 1.6, buff);
  s.box(-HX, HX, T, 19, -HZ, HZ, buff);
  s.box(-HX - 0.3, HX + 0.3, 10.5, 11.2, -HZ - 0.3, HZ + 1, buff); // string course, the loggia's floor
  s.box(-HX - 0.5, HX + 0.5, 19, 20.2, -HZ - 0.5, HZ + 1.6, buff); // cornice
  s.box(-HX, HX, 20.2, 21.2, -HZ + 0.3, HZ + 1.2, buff).box(-HX - 0.2, HX + 0.2, 21.2, 21.5, -HZ + 0.1, HZ + 1.4, buff);
  for (const sx of [-1, 1]) {
    // The long wings between the central block and the corner towers.
    const x0 = CB, x1 = 41, k = tier ? 6 : 4, pitch = (x1 - x0) / k;
    for (let i = 0; i < k; i++) {
      const cx = sx * (x0 + pitch * (i + 0.5));
      // Lower storey: tall arched windows, lit, between pilasters.
      s.force = 1; s.extrudeZ(archHole(cx, 3.6, 7.6, 0.85, n >> 1), FZ, FZ + 0.12, lamp); s.force = null;
      s.box(cx - 1.25, cx + 1.25, 8.9, 9.3, FZ, FZ + 0.35, buff); // a hood over each
    }
    for (let i = 0; i <= k; i++) { const px = sx * (x0 + pitch * i); s.box(px - 0.35, px + 0.35, T, 10.5, FZ, FZ + 0.45, buff); }
    // Upper storey: the arcaded loggia, shadowed, a lit doorway at the back of each bay.
    const m = tier ? 7 : 5, ap = (x1 - x0) / m, half = ap * 0.34;
    const [a0, a1] = sx > 0 ? [x0, x1] : [-x1, -x0];
    s.box(a0, a1, 11.2, 19, FZ, FZ + 0.05, shade);
    const holes = Array.from({ length: m }, (_, i) => archHole(a0 + ap * (i + 0.5), 11.2, 16, half, n >> 1));
    s.extrudeZ([[a0, 11.2], [a1, 11.2], [a1, 19], [a0, 19]], FZ + 0.9, FZ + 1.7, buff, holes);
    s.force = 1;
    for (let i = 0; i < m; i++) { const cx = a0 + ap * (i + 0.5); s.box(cx - half * 0.45, cx + half * 0.45, 11.2, 14.4, FZ + 0.05, FZ + 0.12, '#ffbe6a'); }
    s.force = null;
    for (let x = x0 + 0.6; x < x1; x += tier > 1 ? 1.1 : 2.2) s.box(sx * x - 0.18, sx * x + 0.18, 20.2, 21.2, FZ + 1.2, FZ + 1.5, buff); // balusters
    // The corner towers at the wings' ends, front and back: a broad pavilion, a lantern stage, a dome.
    for (const sz of [-1, 1]) {
      const tx = sx * 47, tz = sz * 27, f = (d) => tz + sz * (7 + d); // f: a depth out from the tower's face
      const span = (a, b) => (sz > 0 ? [f(a), f(b)] : [f(b), f(a)]);
      s.box(tx - 6, tx + 6, T, 25, tz - 7, tz + 7, buff);
      s.box(tx - 6.4, tx + 6.4, 10.5, 11.2, tz - 7.4, tz + 7.4, buff).box(tx - 6.6, tx + 6.6, 22.6, 23.6, tz - 7.6, tz + 7.6, buff);
      s.box(tx - 6.2, tx + 6.2, 23.6, 25.4, tz - 7.2, tz + 7.2, buff);
      for (const cx of [-1, 1]) s.box(tx + cx * 5.4 - 0.6, tx + cx * 5.4 + 0.6, T, 22.6, ...span(0, 0.5), buff); // corner pilasters
      s.force = 1; s.extrudeZ(archHole(tx, 3.6, 7.6, 2, n), ...span(0, 0.12), lamp); s.force = null;
      s.extrudeZ([[tx - 3.2, T], [tx + 3.2, T], [tx + 3.2, 9.8], [tx - 3.2, 9.8]], ...span(0, 0.5), buff, [archHole(tx, T + 0.6, 7.6, 2.4, n)]);
      s.box(tx - 2.6, tx + 2.6, 12, 20.4, ...span(0, 0.05), shade);
      s.extrudeZ([[tx - 3.6, 11.2], [tx + 3.6, 11.2], [tx + 3.6, 21.2], [tx - 3.6, 21.2]], ...span(0.05, 0.7), buff, [archHole(tx, 12, 18.2, 2.2, n)]);
      s.force = 1; s.box(tx - 1.1, tx + 1.1, 12, 16, ...span(0.05, 0.12), '#ffbe6a'); s.force = null;
      // Lantern stage: a square drum with lit arches, little corner pinnacles, an octagonal neck, the dome.
      s.box(tx - 4, tx + 4, 25.4, 29.4, tz - 4, tz + 4, buff).box(tx - 4.4, tx + 4.4, 29.4, 30, tz - 4.4, tz + 4.4, buff);
      s.force = 1; for (const d of [-1, 1]) s.extrudeZ(archHole(tx, 26, 27.8, 1.1, 4), d > 0 ? tz + 4 : tz - 4.1, d > 0 ? tz + 4.1 : tz - 4, '#ffc066'); s.force = null;
      for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
        s.cyl(0.45, 0.35, 25.4, 30.8, tx + cx * 5.6, tz + cz * 6.6, 6, buff).lathe([[0.55, 0], [0.4, 0.6], [0, 1.2]], tx + cx * 5.6, 30.8, tz + cz * 6.6, 6, buff);
      }
      s.cyl(3.4, 3.4, 30, 31.4, tx, tz, 8, buff);
      s.lathe([[3.9, 0], [4, 1], [3.5, 2.6], [2.4, 4.2], [1.1, 5.3], [0.3, 5.8], [0, 5.9]], tx, 31.4, tz, tier ? 14 : 8, buff);
      s.cyl(0.18, 0.08, 37.2, 39, tx, tz, 4, buff);
    }
  }
  // The central block, taller, with turrets round the dome; its front stands forward of the wings.
  s.box(-CB, CB, T, CT, -24, HZ + 2, buff);
  s.box(-CB - 0.5, CB + 0.5, 23.4, 24.4, -24.5, HZ + 2.8, buff).box(-CB, CB, CT, CT + 0.4, -24, HZ + 2.2, buff);
  for (const sx of [-1, 1]) {
    // Beside the porch: a lit arched window below, a deep arched niche above.
    const cx = sx * 15.5, FB = HZ + 2;
    s.force = 1; s.extrudeZ(archHole(cx, 3.6, 7.8, 1.6, n), FB, FB + 0.12, lamp); s.force = null;
    s.box(cx - 2.8, cx + 2.8, 10.5, 11.2, FB, FB + 0.6, buff);
    s.box(cx - 2.2, cx + 2.2, 12, 20.6, FB, FB + 0.05, deep);
    s.extrudeZ([[cx - 3.2, 11.2], [cx + 3.2, 11.2], [cx + 3.2, 22.4], [cx - 3.2, 22.4]], FB + 0.05, FB + 0.8, buff, [archHole(cx, 12, 18.6, 2, n)]);
    s.force = 1; s.box(cx - 1, cx + 1, 12, 16, FB + 0.05, FB + 0.12, '#ffbe6a'); s.force = null;
    s.box(sx * 11 - 0.1, sx * 20, CT - 1.6, CT + 1.4, HZ + 1.6, HZ + 2.3, buff); // attic over the bays
  }
  // The porch: the great arch through a block with paired columns, an entablature, an attic and a sculpture group.
  const PZ = HZ + 2, PF = HZ + 14; // its back and front
  s.extrudeZ([[-11, T], [11, T], [11, 21], [-11, 21]], PZ, PF, buff, [archHole(0, T, 13, 5.2, n + 2)]);
  s.extrudeZ([...roundArch(0, 13, 6.3, n + 2), ...roundArch(0, 13, 5.2, n + 2).reverse()], PF, PF + 0.4, buff); // archivolt
  s.force = 1; s.extrudeZ(archHole(0, T, 13, 5.2, n + 2), PZ, PZ + 0.1, '#ffd27a'); s.force = null;
  for (const sx of [-1, 1]) {
    for (const x of [6.9, 9.1]) {
      s.cyl(0.6, 0.5, T, 19, sx * x, PF + 0.7, tier ? 10 : 6, buff);
      s.box(sx * x - 0.75, sx * x + 0.75, T, T + 1.2, PF + 0.05, PF + 1.45, buff).box(sx * x - 0.8, sx * x + 0.8, 18.4, 19, PF + 0.05, PF + 1.5, buff);
    }
  }
  s.box(-11.4, 11.4, 19, 21, PZ, PF + 1.7, buff); // entablature
  s.box(-11, 11, 21, 24.6, PZ, PF + 0.6, buff).box(-11.3, 11.3, 24.6, 25.2, PZ, PF + 0.9, buff); // attic
  s.box(-4, 4, 25.2, 26.6, PF - 4, PF, buff); // the sculpture group's pedestal
  s.add(new THREE.SphereGeometry(1.1, 8, 6), buff, at(0, 27.6, PF - 2)).add(new THREE.ConeGeometry(1, 2.6, 6), buff, at(0, 27.6, PF - 2));
  for (const sx of [-1, 1]) s.add(new THREE.IcosahedronGeometry(0.9, 0), buff, at(sx * 2.4, 27.3, PF - 2)).box(sx * 10.4 - 0.5, sx * 10.4 + 0.5, 25.2, 26.8, PF - 0.8, PF + 0.2, buff);
  // Four domed turrets on the central block's corners, round the dome.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 16, z = sz * 16;
    s.box(x - 2.2, x + 2.2, CT, 32.4, z - 2.2, z + 2.2, buff).box(x - 2.6, x + 2.6, 32.4, 33, z - 2.6, z + 2.6, buff);
    s.force = 1; for (const d of [-1, 1]) s.box(x - 0.6, x + 0.6, 28.4, 31.2, z + d * 2.2 - 0.05, z + d * 2.2 + 0.05, '#ffc066'); s.force = null;
    s.lathe([[2.5, 0], [2.6, 0.7], [2.2, 1.9], [1.4, 2.9], [0.5, 3.5], [0, 3.6]], x, 33, z, tier ? 12 : 8, buff);
    s.cyl(0.14, 0.06, 36.6, 38, x, z, 4, buff);
  }
  // The drum: a plinth, a ring of windows between pilasters, a cornice.
  const seg = tier > 1 ? 24 : tier ? 20 : 12, wn = tier ? 16 : 8;
  s.cyl(15, 15, CT, 28.4, 0, 0, seg, buff).cyl(12.6, 12.6, 28.4, 35, 0, 0, seg, buff);
  for (let i = 0; i < wn; i++) {
    const a = (i / wn) * Math.PI * 2, b = a + Math.PI / wn;
    s.force = 1; s.add(new THREE.BoxGeometry(1.5, 3.4, 0.2), '#ffc87a', round(a, 12.6, 32)); s.force = null;
    s.add(new THREE.BoxGeometry(0.9, 6.6, 0.6), buff, round(b, 12.7, 31.7));
  }
  s.cyl(13.4, 13.4, 35, DOME, 0, 0, seg, buff);
  // The dome, a little raised, with a ring a third of the way up; the lantern; the angel.
  s.lathe([[12.6, 0], [12.8, 1.6], [12.5, 4], [11.5, 7], [9.6, 9.8], [6.8, 12.1], [3.6, 13.7], [1.8, 14.2], [0, 14.4]], 0, DOME, 0, seg, buff);
  s.cyl(12.65, 12.6, DOME + 3.9, DOME + 4.3, 0, 0, seg, buff);
  s.cyl(2.5, 2.5, 50.2, 50.6, 0, 0, 10, buff);
  s.force = 1; s.cyl(1.7, 1.7, 50.6, 52.2, 0, 0, 8, '#ffd890'); s.force = null;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; s.cyl(0.18, 0.18, 50.6, 52.2, Math.sin(a) * 2, Math.cos(a) * 2, 4, buff); }
  s.cyl(2.4, 2.4, 52.2, 52.6, 0, 0, 10, buff);
  s.lathe([[2.1, 0], [1.7, 0.5], [0.8, 0.9], [0, 1.05]], 0, 52.6, 0, 10, buff);
  // The Angel of Victory: on a globe, wings spread, a trumpet raised; bronze, turning in the wind.
  s.add(new THREE.SphereGeometry(0.4, 8, 6), bronze, at(0, 53.9, 0));
  s.cyl(0.42, 0.26, 54.2, 55.4, 0, 0, 6, bronze);
  s.add(new THREE.SphereGeometry(0.22, 6, 5), bronze, at(0, 55.65, 0));
  for (const sx of [-1, 1]) s.beam(new THREE.Vector3(sx * 0.15, 55, -0.2), new THREE.Vector3(sx * 1.2, 56, -0.35), 0.5, 0.08, bronze);
  s.beam(new THREE.Vector3(0.2, 55.3, 0.1), new THREE.Vector3(0.45, 56.05, 0.75), 0.12, 0.12, bronze);
  return s;
}

// A lamp standard: a black post and a glowing globe.
function lampAt(s, lit, x, z) {
  s.cyl(0.14, 0.09, 0, 3.8, x, z, 5, '#141418');
  lit.add(new THREE.SphereGeometry(0.22, 6, 4), '#ffe2a0', at(x, 4, z));
}
const LAMPS = [];
for (let z = 16; z > -40; z -= 12) for (const sx of [-1, 1]) LAMPS.push([sx * 16.5, z]);
for (let x = 22; x < POOL.x; x += 10) for (const sx of [-1, 1]) LAMPS.push([sx * x, -44.4]);
for (let x = 6; x < POOL.x; x += 8) for (const sx of [-1, 1]) LAMPS.push([sx * x, -119.6]);
for (let z = -130; z > MZ + 52; z -= 9) for (const sx of [-1, 1]) LAMPS.push([sx * 7.5, z]);
for (let z = -132; z > MZ + 52; z -= 12) for (const sx of [-1, 1]) LAMPS.push([sx * 78, z]);

// Everything round the memorial: lawns, the pool's kerb, the path, the statue, lamps, rain trees, the Maidan's trees,
// St Paul's Cathedral's spire to the right and the city beyond.
function groundsGeometry(s, lit, tier) {
  const L1 = LAYER, earth = '#141310', lawn = '#16261a', walk = '#6e625a', kerb = '#d8cdbd';
  // Earth everywhere but the pool, which is cut out of it so its reflection shows below.
  s.plane(-900, 900, POOL.z0, 200, 0, earth).plane(-900, 900, -1400, POOL.z1, 0, earth);
  s.plane(-900, -POOL.x, POOL.z1, POOL.z0, 0, earth).plane(POOL.x, 900, POOL.z1, POOL.z0, 0, earth);
  // Lawns LAYER above the earth, round the pool and its walks; walks and the path LAYER above the lawns.
  const K = 1.2; // the kerb's width
  s.plane(-500, 500, POOL.z0 + K, 60, L1, lawn).plane(-500, 500, -900, POOL.z1 - K, L1, lawn);
  s.plane(-500, -POOL.x - K, POOL.z1 - K, POOL.z0 + K, L1, lawn).plane(POOL.x + K, 500, POOL.z1 - K, POOL.z0 + K, L1, lawn);
  s.plane(-POOL.x - K, POOL.x + K, POOL.z0 + K, -40.5, 2 * L1, walk); // the near walk, up to the forecourt
  s.plane(-POOL.x - K, POOL.x + K, PATH.z0, POOL.z1 - K, 2 * L1, walk); // the far walk
  s.plane(-5, 5, PATH.z1, PATH.z0, 2 * L1, walk); // the path to the steps
  s.plane(-62, 62, MZ + 44, MZ + 52, 2 * L1, walk); // and the paving before the terrace
  // The pool's marble kerb, dropping to the water.
  for (const sx of [-1, 1]) s.box(sx * POOL.x, sx * (POOL.x + K), -0.8, 0.35, POOL.z1 - K, POOL.z0 + K, kerb);
  for (const [z0, z1] of [[POOL.z0, POOL.z0 + K], [POOL.z1 - K, POOL.z1]]) s.box(-POOL.x, POOL.x, -0.8, 0.35, z0, z1, kerb);
  // Queen Victoria on her throne, on a tall pedestal.
  s.box(-3, 3, 0, 0.8, STATUE - 3, STATUE + 3, kerb).box(-1.4, 1.4, 0.8, 3.4, STATUE - 1.4, STATUE + 1.4, kerb).box(-1.7, 1.7, 3.4, 3.7, STATUE - 1.7, STATUE + 1.7, kerb);
  s.box(-0.7, 0.7, 3.7, 5, STATUE - 0.7, STATUE + 0.5, '#3a3026').add(new THREE.SphereGeometry(0.28, 6, 5), '#3a3026', at(0, 5.3, STATUE));
  for (const [x, z] of LAMPS) lampAt(s, lit, x, z);
  // Rain trees: broad, flat canopies; a line along the forecourt, groves round the pool and either side of the hall.
  const rnd = mulberry(5), tree = (x, z, r = 5) => {
    r *= 0.8 + rnd() * 0.4;
    const cy = r * 0.7 + 3.4, near = Math.abs(z) < 160 && Math.abs(x) < 100; // lamps light the near groves from below
    s.colour = near ? (vx, vy, vz, nn, base) => tmpCol.copy(base).lerp(LEAF, clamp((cy - vy) / (r * 0.8) + 0.3, 0, 1) * 0.7) : null;
    s.add(new THREE.IcosahedronGeometry(r, tier && near ? 1 : 0).scale(1, 0.7, 1), rnd() < 0.5 ? '#14261a' : '#1b3222', at(x, cy, z));
    s.colour = null;
    s.cyl(0.4, 0.28, 0, r * 0.7 + 1.5, x, z, 5, '#2a1e16');
  };
  for (let z = 22; z > -40; z -= tier ? 11 : 22) for (const sx of [-1, 1]) tree(sx * (24 + rnd() * 6), z, 4.5);
  for (let i = 0; i < (tier ? 14 : 7); i++) for (const sx of [-1, 1]) tree(sx * (82 + rnd() * 60), -30 - rnd() * 100, 6);
  for (const [x, z] of [[36, -132], [-38, -134], [58, -140], [-60, -142], [26, -150], [-28, -148]]) tree(x, z, 6.5);
  for (let i = 0; i < (tier ? 16 : 8); i++) for (const sx of [-1, 1]) tree(sx * (72 + rnd() * 40), -150 - rnd() * 90, 7);
  // The Maidan's trees far behind, and along the sides.
  for (let x = -480; x < 480; x += tier ? 26 : 48) tree(x + rnd() * 10, -340 - rnd() * 40, 9);
  for (let z = 40; z > -340; z -= tier ? 30 : 55) for (const sx of [-1, 1]) tree(sx * (200 + rnd() * 30), z, 8);
  // St Paul's Cathedral, off to the right: a gothic tower and spire, pale and floodlit.
  const CX = 175, CZ = -390;
  s.box(CX - 18, CX + 18, 0, 22, CZ - 40, CZ + 10, '#8e8478').box(CX - 6, CX + 6, 0, 46, CZ - 6, CZ + 6, '#c8bca8');
  s.add(new THREE.ConeGeometry(5, 22, 8), '#c8bca8', at(CX, 57, CZ));
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) s.cyl(0.6, 0.4, 40, 50, CX + cx * 6, CZ + cz * 6, 4, '#c8bca8');
  // The city beyond: dark blocks, a few towers (their windows are spots).
  const r2 = mulberry(19);
  for (let i = 0; i < (tier ? 30 : 15); i++) {
    const a = -1.1 + r2() * 2.2, d = 520 + r2() * 300, x = Math.sin(a) * d, z = -Math.cos(a) * d, w = 16 + r2() * 24, h = 14 + r2() * (Math.abs(a) > 0.4 ? 50 : 22);
    s.box(x - w / 2, x + w / 2, 0, h, z - 12, z + 12, '#1c1a20');
    BLOCKS.push([x, z, w, h]);
  }
  return s;
}
const BLOCKS = [], LEAF = new THREE.Color('#7a8638');

// The pool's water and, on it, the long glowing streaks of the lamps and the memorial's lit windows: one mesh, its
// alpha in the vertex colours (dark and see-through over the reflection, the streaks fading away from their lights).
function waterMesh(tier) {
  const pos = [], col = [], c = new THREE.Color(), y = POOL.y, a0 = tier ? 0.55 : 0.92;
  const quad = (q, hex, alphas, yy) => {
    c.set(hex);
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], yy, q[k][1]); col.push(c.r, c.g, c.b, alphas[k]); }
  };
  quad([[-POOL.x, POOL.z1], [POOL.x, POOL.z1], [POOL.x, POOL.z0], [-POOL.x, POOL.z0]], '#081236', [a0, a0, a0, a0], y);
  const streak = (x, z, len, w, hex, a) => {
    const z1 = Math.min(POOL.z0 - 0.5, z + len);
    quad([[x - w, z], [x + w, z], [x + w * 0.35, z1], [x - w * 0.35, z1]], hex, [a, a, 0, 0], y + LAYER);
  };
  for (const [x, z] of LAMPS) if (z < POOL.z1) streak(x, POOL.z1 + 0.3, 34, 0.7, '#ffcf80', 0.75);
  for (const [x, z] of LAMPS) if (z > POOL.z0 && z < -40) streak(x, POOL.z1 + 0.3, 8, 0.4, '#ffcf80', 0.3);
  // The memorial's glow, broad and soft, under its porch and its wings.
  streak(0, POOL.z1 + 0.3, 60, 7, '#ffbf6a', 0.45);
  for (const sx of [-1, 1]) for (const x of [16, 27, 36, 47]) streak(sx * x * 0.62, POOL.z1 + 0.3, 44, 1.6, '#ffc274', 0.4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  m.renderOrder = 1;
  return m;
}

// The memorial's reflection: its stone and its lit openings in one geometry, mirrored below the water line.
function mirrorMesh(a, b, map) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const x = a.attributes[name], y = b.attributes[name], arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array); arr.set(y.array, x.array.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, x.itemSize));
  }
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, vertexColors: true, color: '#7a7a98' }));
  m.scale.y = -1; m.position.set(0, POOL.y * 2, MZ);
  return m;
}

// Diyas along the forecourt, the pool's kerb, the path and the memorial's terrace; lamps; the city's windows.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) {
    for (let z = 18; z > -40; z -= step) out.push([sx * 14.6, 0.3, z, diya]);
    for (let z = POOL.z0; z > POOL.z1; z -= step * 1.5) out.push([sx * (POOL.x + 0.6), 0.6, z, diya]);
    for (let z = PATH.z0; z > PATH.z1; z -= step) out.push([sx * 5.2, 0.35, z, diya]);
  }
  for (let x = -POOL.x; x <= POOL.x; x += step * 0.8) out.push([x, 0.6, POOL.z0 + 0.6, diya], [x, 0.6, POOL.z1 - 0.6, diya]);
  for (let x = -59; x <= 59; x += step * 0.7) out.push([x, T + 0.25, MZ + 41.6, diya]);
  for (let i = 0; i < 4; i++) for (let x = -13.5; x <= 13.6; x += step * 0.6) out.push([x, T - i * 0.55 + 0.25, MZ + 42.4 + i * 1.6, diya]);
  for (let a = 0; a < 16; a++) out.push([Math.cos((a / 16) * Math.PI * 2) * 3.6, 0.3, STATUE + Math.sin((a / 16) * Math.PI * 2) * 3.6, diya]);
  for (const [x, z] of LAMPS) out.push([x, 4, z, lamp]);
  const rnd = mulberry(77);
  for (const [x, z, w, h] of BLOCKS) for (let i = 0; i < (tier ? 5 : 2); i++) out.push([x - w / 2 + rnd() * w, 3 + rnd() * (h - 4), z + 12.2, rnd() < 0.8 ? '#ffd9a0' : '#ffffff']);
  for (let i = 0; i < (tier ? 80 : 40); i++) { const a = -1.2 + rnd() * 2.4, d = 450 + rnd() * 500; out.push([Math.sin(a) * d, 1 + rnd() * 6, -Math.cos(a) * d, rnd() < 0.75 ? '#ffd28a' : '#ffffff']); }
  out.push([175, 68.5, -390, '#ff3a2a']); // the spire's warning light
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  BLOCKS.length = 0;
  const map = marbleTexture();
  const mem = memorialGeometry(new Stone(marbleColour, inPorch), tier);
  const stone = mem.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a3018' }));
  const glow = mem.mesh(1, new THREE.MeshBasicMaterial({ map, vertexColors: true }));
  for (const m of [stone, glow]) m.position.z = MZ;
  const lit = new Stone();
  const world = groundsGeometry(new Stone(), lit, tier);
  const objects = [stone, glow, world.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })), lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })), waterMesh(tier)];
  if (tier) {
    // The reflection only shows the lower storeys, so it is built at the low tier's detail.
    const low = memorialGeometry(new Stone(marbleColour, inPorch), 0), a = low.mesh(0, null), b = low.mesh(1, null);
    objects.push(mirrorMesh(a.geometry, b.geometry, map));
    a.geometry.dispose(); b.geometry.dispose();
  }
  // The forecourt where crackers stand: pale sandstone flags.
  objects.push(forecourt({ rgb: [118, 100, 86], z0: -40, z1: 20, width: 28, tile: 2, joint: 'rgba(215,195,170,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower down, a pink and amber glow at the horizon.
    sky: ['#03061a', '#151a4e', '#56398a', '#d07a72'],
    fog: ['#3e3068', 340, 1600],
    clouds: { colour: '#8a6ab0', count: tier ? 9 : 5, seed: 13 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffe4c0', 1.6, [-40, 30, 300]], ['#ffe6c4', 0.45, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
