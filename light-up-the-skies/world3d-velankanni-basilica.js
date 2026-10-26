/* Light Up the Skies — 3D background: the Basilica of Our Lady of Good Health, Velankanni, on a festival night, seen
   from the far end of its great forecourt, the Bay of Bengal off to the right beyond the palms and the beach road.
   Loaded by world3d.js when Velankanni is the chosen world. Its colours follow the game's 2D picture: a deep blue night
   going violet and orange at the horizon, the whitewashed church floodlit white and gold, its spires tipped red, red
   tiles along the nave, strings of golden lights on every edge and a pink glow on the surf.

   Proportions follow published figures and photographs: a Gothic front about 22 m wide between two square towers that
   rise through two stages to a pinnacled parapet at about 21 m, then octagonal spires to about 32 m and their crosses;
   a pointed gable between them with a rose window over the great door; a long nave about 80 m with lower aisles under
   red-tiled roofs, a transept and a gilded dome over the crossing. Everything is a box, an extruded outline, a cone or
   a lathe, merged into a few meshes with one drawn plaster texture; the floodlit look is baked into vertex colours: no
   extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the basilica's local origin is the middle of its front, at ground. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const BZ = -94; // the basilica's front, across the forecourt
const P = 0.8; // the plinth's top, the church's floor
const TX = 7.5, TH = 2.6; // the towers: centre either side, half width
const SPIRE = [21.6, 32]; // a spire's foot and tip
const NAVE = 6.5, AISLE = 11; // half widths
const END = -80; // the nave's far end (local)
const CROSS = -46; // the crossing, under the dome (local)
const SHORE = 98; // where the beach meets the sea (x)
const WALL = 62; // the beach road's sea wall (x)

// ---------- Plaster: whitewashed lime over brick, faint courses, one tile per 4 m ----------
function plasterTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(41), px = 256 / 4;
  g.fillStyle = '#f8f4ec'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 0.5 * px) {
    g.fillStyle = 'rgba(120,105,90,0.08)'; g.fillRect(0, y, 256, 1);
    for (let i = 0; i < 6; i++) { const v = 0.95 + rnd() * 0.05; g.fillStyle = `rgba(${(240 * v) | 0},${(234 * v) | 0},${(222 * v) | 0},0.5)`; g.fillRect(rnd() * 256, y + 1, 20 + rnd() * 60, 0.5 * px - 2); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base, set) gives a vertex colour; force sends what is added to the second, unlit set.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.force = null;
  }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, base = new THREE.Color(color), set = this.sets[this.force ?? 0];
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
  // An outline in the z-y plane (given as [z, y]), extruded from x0 to x1.
  extrudeX(pts, x0, x1, color) {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
    return this.add(new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false }), color, at(x0, 0, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
  }
  lathe(profile, x, y, z, seg, color) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  cone(r, y0, y1, x, z, seg, color, rot = 0) { return this.add(new THREE.ConeGeometry(r, y1 - y0, seg).rotateY(rot), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  // A box w x h in section from point a to point b (a rod with seg sides when seg is given).
  beam(a, b, w, h, color, seg = 0) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(seg ? new THREE.CylinderGeometry(h, w, len, seg, 1, true) : new THREE.BoxGeometry(w, len, h), color, m);
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

// A pointed (equilateral) Gothic arch over (cx, spring), half span wide: its points from the left springing to the right.
const lancet = (cx, spring, half, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI - (Math.PI / 3) * (i / n); out.push([cx + half + Math.cos(a) * 2 * half, spring + Math.sin(a) * 2 * half]); }
  for (let i = n - 1; i >= 0; i--) { const a = Math.PI - (Math.PI / 3) * (i / n); out.push([cx - half - Math.cos(a) * 2 * half, spring + Math.sin(a) * 2 * half]); }
  return out;
};
// The same arch as a closed window or door, down to its sill.
const lancetHole = (cx, sill, spring, half, n) => [[cx - half, sill], ...lancet(cx, spring, half, n), [cx + half, sill]];

// The floodlit whitewash of the 2D picture: gold where the floods graze low down, whiter higher up; side faces a
// little dimmer than the front.
const BANDS = [[P, '#f0c890', '#fcdcaa'], [8, '#ffe4b4', '#fff0d6'], [16, '#fff4e2', '#fff8ec'], [26, '#fff2de', '#fff8ee'], [99, '#fff8ee', '#ffffff']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function floodColour(x, y, z, n, base) {
  let lo = 0, k = 1 - Math.abs(n.x) * 0.22 - Math.max(0, -n.z) * 0.3;
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)).multiply(base).multiplyScalar(k);
    lo = top;
  }
  return tmpCol.copy(base).multiplyScalar(k);
}

const WHITE = '#ffffff', RED = '#c03a2a', TILE = '#a8442c', GOLD = '#ffd27a', LIT = '#ffc464';

// A slim pinnacle: a shaft and a little spire.
function pinnacle(s, x, z, y0, y1, r, tier, tip = WHITE) {
  s.cyl(r, r * 0.85, y0, y1, x, z, tier ? 6 : 4, WHITE).cone(r * 1.1, y1, y1 + r * 4.5, x, z, tier ? 6 : 4, tip);
}

// One of the two front towers, centred on x = tx.
function tower(s, tx, tier) {
  const h = TH, n = tier ? 5 : 3, f = 0; // its front face is the church's front
  s.box(tx - h, tx + h, P, 14, f - 2 * h, f, WHITE);
  // Corner buttresses running up the first stage, stepping back.
  for (const sx of [-1, 1]) {
    s.box(tx + sx * h - 0.45, tx + sx * h + 0.45, P, 14.6, f - 0.5, f + 0.5, WHITE);
    s.box(tx + sx * (h + 0.1) - 0.4, tx + sx * (h + 0.1) + 0.4, P, 10, f - 2 * h - 0.4, f - 2 * h + 0.4, WHITE);
    pinnacle(s, tx + sx * h, f, 14.6, 16.4, 0.42, tier);
  }
  // String courses, then lit lancets: a pair low down, a tall one above, the belfry openings in the second stage.
  for (const y of [5.4, 10, 14]) s.box(tx - h - 0.15, tx + h + 0.15, y, y + 0.35, f - 2 * h - 0.15, f + 0.15, WHITE);
  s.force = 1;
  for (const dx of [-0.8, 0.8]) s.extrudeZ(lancetHole(tx + dx, 2.2, 4.2, 0.45, n), f, f + 0.08, LIT);
  s.extrudeZ(lancetHole(tx, 6.4, 8.4, 0.75, n), f, f + 0.08, LIT);
  s.extrudeZ(lancetHole(tx, 15.2, 17.6, 0.85, n), f - 0.4, f - 0.32, GOLD);
  for (const sx of [-1, 1]) { const x = tx + sx * h * 0.85; s.extrudeX(lancetHole(f - h, 15.2, 17.6, 0.85, n), x - 0.04, x + 0.04, GOLD); } // side belfry openings
  s.force = null;
  for (const dx of [-0.8, 0.8]) s.box(tx + dx - 0.6, tx + dx + 0.6, 4.9, 5.2, f, f + 0.15, WHITE); // hoods
  // The second stage, a little narrower; its parapet; corner pinnacles.
  const h2 = h * 0.85;
  s.box(tx - h2, tx + h2, 14, 20.6, f - h - h2, f - h + h2, WHITE);
  s.box(tx - h - 0.2, tx + h + 0.2, 20.6, 21.6, f - 2 * h - 0.2, f + 0.2, WHITE);
  for (const sx of [-1, 1]) for (const sz of [0, 1]) pinnacle(s, tx + sx * (h - 0.2), f - sz * 2 * h + (sz ? 0.2 : -0.2), 21.6, 22.8, 0.32, tier, RED);
  // The octagonal spire with four little white gables round its foot, and its cross.
  const cz = f - h;
  s.cone(1.95, SPIRE[0], SPIRE[1], tx, cz, 8, RED, Math.PI / 8);
  s.cyl(2.05, 2.05, SPIRE[0], SPIRE[0] + 0.5, tx, cz, 8, WHITE);
  const gab = [[-0.7, 0], [0.7, 0], [0, 2.2]];
  s.extrudeZ(gab.map(([x, y]) => [tx + x, SPIRE[0] + 0.3 + y]), cz + 1.2, cz + 2.05, WHITE);
  s.extrudeZ(gab.map(([x, y]) => [tx + x, SPIRE[0] + 0.3 + y]), cz - 2.05, cz - 1.2, WHITE);
  s.extrudeX(gab.map(([x, y]) => [cz + x, SPIRE[0] + 0.3 + y]), tx + 1.2, tx + 2.05, WHITE);
  s.extrudeX(gab.map(([x, y]) => [cz + x, SPIRE[0] + 0.3 + y]), tx - 2.05, tx - 1.2, WHITE);
  s.cyl(0.22, 0.22, SPIRE[1] - 0.2, SPIRE[1] + 0.5, tx, cz, 6, GOLD);
  s.box(tx - 0.07, tx + 0.07, SPIRE[1] + 0.5, SPIRE[1] + 2.3, cz - 0.07, cz + 0.07, GOLD).box(tx - 0.5, tx + 0.5, SPIRE[1] + 1.55, SPIRE[1] + 1.7, cz - 0.07, cz + 0.07, GOLD);
}


// Turned to face outward at angle a round (0, cz), radius r: for the drum's windows.
const round = (a, r, y, cz) => new THREE.Matrix4().makeRotationY(a).setPosition(Math.sin(a) * r, y, cz + Math.cos(a) * r);

// The basilica, around its local origin; the shrine's newer halls to its right and a little chapel on the left.
function basilicaGeometry(s, tier) {
  const n = tier ? 5 : 3;
  // The plinth and the steps up to the doors.
  s.box(-AISLE - 1.5, AISLE + 1.5, 0, P, END - 2, 1.5, WHITE);
  for (let i = 0; i < 3; i++) s.box(-6, 6, 0, P - i * 0.27, 1.5, 2.5 + i, WHITE);
  for (const sx of [-1, 1]) tower(s, sx * TX, tier);
  // The front between the towers: the great door, a pair of lancets, the rose window, the gable and its cross.
  const F = -0.6, W = TX - TH; // the front's face; half its width
  s.box(-W, W, P, 15.4, F - 1.2, F, WHITE);
  s.extrudeZ([[-W - 0.2, 15.4], [W + 0.2, 15.4], [0, 21.2]], F - 1.2, F + 0.1, WHITE);
  s.box(-W - 0.3, W + 0.3, 15, 15.5, F - 1.2, F + 0.3, WHITE);
  // The porch round the door: a deep pointed archivolt standing forward.
  s.extrudeZ([[-2.6, P], [2.6, P], [2.6, 6.6], [0, 9.6], [-2.6, 6.6]], F, F + 0.9, WHITE, [lancetHole(0, P, 4.4, 1.5, n + 1)]);
  s.force = 1;
  s.extrudeZ(lancetHole(0, P, 4.4, 1.5, n + 1), F + 0.05, F + 0.12, '#ffb04a');
  for (const sx of [-1, 1]) s.extrudeZ(lancetHole(sx * 3.4, 6.2, 8.6, 0.45, n), F, F + 0.08, LIT);
  s.add(new THREE.CircleGeometry(1.5, tier ? 16 : 10), GOLD, at(0, 12.2, F + 0.06));
  s.extrudeZ(lancetHole(0, 16.2, 17.6, 0.35, n), F + 0.1, F + 0.18, LIT);
  s.force = null;
  s.add(new THREE.TorusGeometry(1.6, 0.18, 4, tier ? 16 : 10), WHITE, at(0, 12.2, F + 0.08));
  for (const sx of [-1, 1]) pinnacle(s, sx * (W - 0.1), F, 15.5, 17.6, 0.3, tier);
  s.box(-0.09, 0.09, 21, 23.2, F - 0.6, F - 0.42, GOLD).box(-0.6, 0.6, 22.2, 22.38, F - 0.6, F - 0.42, GOLD);
  // The nave: tall walls with lit clerestory lancets, a steep red-tiled roof and its ridge.
  s.box(-NAVE, NAVE, P, 13, END, -1.8, WHITE);
  s.extrudeZ([[-NAVE - 0.6, 12.8], [NAVE + 0.6, 12.8], [0, 19.4]], END, -1.4, TILE);
  s.box(-0.18, 0.18, 19.1, 19.6, END, -1.4, '#7a2a1c');
  const bays = [];
  for (let z = -9; z > END + 3; z -= tier ? 6 : 9) if (Math.abs(z - CROSS) > 8) bays.push(z);
  s.force = 1;
  for (const z of bays) for (const sx of [-1, 1]) s.extrudeX(lancetHole(z, 9.2, 10.8, 0.5, n), sx * NAVE - 0.05, sx * NAVE + 0.05, LIT);
  s.force = null;
  // The aisles, lower, under lean-to roofs: lit lancets between buttresses with little pinnacles.
  for (const sx of [-1, 1]) {
    const [x0, x1] = sx > 0 ? [NAVE, AISLE] : [-AISLE, -NAVE];
    s.box(x0, x1, P, 8, END + 4, -2 * TH - 0.4, WHITE);
    s.extrudeZ([[sx * (NAVE - 0.2), 10.6], [sx * (AISLE + 0.7), 7.6], [sx * (AISLE + 0.7), 8.1], [sx * (NAVE - 0.2), 11.1]], END + 3.6, -2 * TH - 0.1, TILE);
    s.box(x0 - 0.2, x1 + 0.2, 7.5, 8, END + 4, -2 * TH - 0.2, WHITE); // the cornice under the eaves
    s.force = 1;
    for (const z of bays) s.extrudeX(lancetHole(z, 2.4, 5, 0.65, n), sx * AISLE - 0.05, sx * AISLE + 0.05, LIT);
    s.force = null;
    for (const z of bays) {
      const bx = sx * (AISLE + 0.3), bz = z + (tier ? 3 : 4.5);
      s.box(bx - 0.35, bx + 0.35, P, 7.2, bz - 0.35, bz + 0.35, WHITE);
      if (tier) pinnacle(s, bx, bz, 7.2, 8.6, 0.26, tier);
    }
  }
  // The transept: gabled arms with a rose window at each end.
  s.box(-18, 18, P, 13, CROSS - 6, CROSS + 6, WHITE);
  s.extrudeX([[CROSS - 6.6, 12.8], [CROSS + 6.6, 12.8], [CROSS, 19.4]], -18.5, 18.5, TILE);
  for (const sx of [-1, 1]) {
    s.extrudeX([[CROSS - 6, 12.8], [CROSS + 6, 12.8], [CROSS, 18.8]], sx > 0 ? 18 : -18.3, sx > 0 ? 18.3 : -18, WHITE);
    s.force = 1;
    s.add(new THREE.CircleGeometry(1.6, tier ? 14 : 8).rotateY(sx * Math.PI / 2), GOLD, at(sx * 18.06, 9.4, CROSS));
    for (const dz of [-2.6, 0, 2.6]) s.extrudeX(lancetHole(CROSS + dz, 2.4, 5.4, 0.6, n), sx * 18 - 0.05, sx * 18 + 0.05, LIT);
    s.force = null;
    for (const dz of [-6, 6]) pinnacle(s, sx * 18, CROSS + dz, 12.8, 15.4, 0.34, tier);
  }
  // The gilded dome over the crossing: an octagonal drum with lit windows, the dome, a lantern, the cross.
  const seg = tier > 1 ? 20 : tier ? 14 : 10;
  s.cyl(4.8, 4.8, 17, 19.2, 0, CROSS, 8, WHITE).cyl(4.4, 4.4, 19.2, 24, 0, CROSS, 8, WHITE).cyl(4.8, 4.8, 24, 24.6, 0, CROSS, 8, WHITE);
  s.force = 1;
  for (let i = 0; i < 8; i++) s.add(new THREE.BoxGeometry(1.1, 2.6, 0.1), LIT, round(((i + 0.5) / 8) * Math.PI * 2, 4.12, 21.6, CROSS));
  s.force = null;
  s.lathe([[4.5, 0], [4.4, 1.4], [3.9, 3], [2.9, 4.5], [1.6, 5.5], [0.6, 6], [0, 6.1]], 0, 24.6, CROSS, seg, '#ffe0a0');
  s.cyl(0.8, 0.8, 30.4, 31.8, 0, CROSS, 6, WHITE).cone(1, 31.8, 33, 0, CROSS, 6, '#ffe0a0');
  s.box(-0.07, 0.07, 33, 34.6, CROSS - 0.07, CROSS + 0.07, GOLD).box(-0.4, 0.4, 33.9, 34.04, CROSS - 0.07, CROSS + 0.07, GOLD);
  // The apse at the far end under a red conical roof.
  s.cyl(NAVE, NAVE, P, 13, 0, END, 10, WHITE).cone(NAVE + 0.6, 12.8, 18.4, 0, END, 10, TILE);

  // The shrine's newer halls to the right: a long two-storey arcade under red tiles and a golden dome on a drum.
  const HX0 = 26, HX1 = 54, HZ0 = -84, HZ1 = -24;
  s.box(HX0, HX1, 0, 9, HZ0, HZ1, WHITE).box(HX0 - 0.3, HX1 + 0.3, 4.4, 4.8, HZ0 - 0.3, HZ1 + 0.3, WHITE).box(HX0 - 0.4, HX1 + 0.4, 9, 9.6, HZ0 - 0.4, HZ1 + 0.4, WHITE);
  s.extrudeX([[HZ0 - 0.4, 9.6], [HZ1 + 0.4, 9.6], [(HZ0 + HZ1) / 2, 13.2]], HX0 - 0.4, HX1 + 0.4, TILE);
  s.force = 1;
  for (let z = HZ1 - 3; z > HZ0 + 2; z -= tier ? 4 : 8) for (const y of [P, 5.4]) s.extrudeX(lancetHole(z, y, y + 2, 0.9, n - 1), HX0 - 0.05, HX0 + 0.05, LIT);
  for (let x = HX0 + 3; x < HX1 - 2; x += tier ? 4 : 8) for (const y of [P, 5.4]) s.extrudeZ(lancetHole(x, y, y + 2, 0.9, n - 1), HZ1 - 0.05, HZ1 + 0.05, LIT);
  s.force = null;
  const DX = 40, DZ = -54;
  s.cyl(4.2, 4.2, 12, 16, DX, DZ, 8, WHITE).cyl(4.6, 4.6, 16, 16.5, DX, DZ, 8, WHITE);
  s.lathe([[4.3, 0], [4, 2], [2.8, 4], [1.2, 5.2], [0, 5.5]], DX, 16.5, DZ, seg, '#ffe0a0');
  s.cone(0.6, 22, 23.4, DX, DZ, 6, GOLD).box(DX - 0.06, DX + 0.06, 23.2, 24.8, DZ - 0.06, DZ + 0.06, GOLD).box(DX - 0.35, DX + 0.35, 24.1, 24.22, DZ - 0.06, DZ + 0.06, GOLD);
  for (const x of [HX0, HX1]) pinnacle(s, x, HZ1, 9.6, 12, 0.36, tier);
  // A little chapel on the left of the forecourt: a gabled shrine with pinnacles and a lit arch.
  const CX = -36, CZ = 38;
  s.box(CX - 3.4, CX + 3.4, 0, 6.4, CZ - 4, CZ + 3, WHITE);
  s.extrudeZ([[CX - 3.6, 6.4], [CX + 3.6, 6.4], [CX, 9.4]], CZ - 4, CZ + 3.2, WHITE);
  for (const sx of [-1, 1]) pinnacle(s, CX + sx * 3.4, CZ + 3, 0, 8.2, 0.4, tier);
  s.box(CX - 0.06, CX + 0.06, 9.3, 10.8, CZ + 3.1, CZ + 3.22, GOLD).box(CX - 0.4, CX + 0.4, 10.1, 10.22, CZ + 3.1, CZ + 3.22, GOLD);
  s.force = 1; s.extrudeZ(lancetHole(CX, 0.4, 3.4, 1.2, n), CZ + 3, CZ + 3.08, '#ffb85a'); s.force = null;
  s.cyl(2, 2, 6.4, 8, CX, CZ - 1.6, 8, WHITE).lathe([[2.1, 0], [1.6, 1.4], [0.6, 2.2], [0, 2.3]], CX, 8, CZ - 1.6, tier ? 12 : 8, '#ffe0a0');
  return s;
}

// A lamp standard: a dark post and a glowing globe.
function lampAt(s, lit, x, z, h = 4.2) {
  s.cyl(0.13, 0.08, 0, h, x, z, 4, '#18161a');
  lit.add(new THREE.OctahedronGeometry(0.26), '#ffe6a8', at(x, h + 0.15, z));
}
const LAMPS = [], PALMS = [], BLOCKS = [], LODGES = [];

// A coconut palm: a leaning trunk and a crown of drooping fronds.
function palm(s, rnd, x, z, h, tier, near) {
  const lean = (rnd() - 0.5) * 0.18 * h, la = rnd() * Math.PI * 2;
  const top = new THREE.Vector3(x + Math.cos(la) * lean, h, z + Math.sin(la) * lean);
  s.beam(new THREE.Vector3(x, 0, z), top, 0.24, 0.16, '#4a3a2c', tier ? 5 : 4);
  // Each frond is a flat diamond, narrow at the crown, widest a little out, drooping to its tip (seen from both sides).
  const k = tier > 1 ? 9 : tier ? 8 : 6, leaf = near ? '#2f4a28' : '#1a2e1c', pos = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + rnd() * 0.5, dx = Math.cos(a), dz = Math.sin(a), L = 2.8 + rnd() * 1.4, w = 0.5;
    const mx = top.x + dx * L * 0.45, my = top.y + 0.35, mz = top.z + dz * L * 0.45;
    const e = [top.x + dx * L, top.y - 1.4 - rnd() * 0.7, top.z + dz * L];
    pos.push(top.x, top.y, top.z, mx - dz * w, my, mz + dx * w, mx + dz * w, my, mz - dx * w);
    pos.push(mx + dz * w, my, mz - dx * w, mx - dz * w, my, mz + dx * w, ...e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  s.add(g, leaf);
}

// Everything round the basilica: the plaza, the beach road and its sea wall, the sand and the sea, palms, lamps, the
// pilgrims' lodges on the left and the town beyond.
function groundsGeometry(s, lit, tier) {
  const L2 = 2 * LAYER, earth = '#17140f', plaza = '#6e6158', road = '#26221f', sand = '#4c3c32';
  s.plane(-900, WALL + 2, -1400, 300, 0, earth);
  s.plane(WALL + 2, SHORE, -1400, 300, 0, sand);
  // The plaza round the forecourt and up to the steps, LAYER twice over the earth; the road along the sea wall.
  s.plane(-50, 50, -230, -40, L2, plaza).plane(-50, -14, -40, 30, L2, plaza).plane(14, 50, -40, 30, L2, plaza);
  s.plane(50, WALL, -400, 300, L2, road);
  s.plane(-3.5, 3.5, BZ + 4.6, -40, 3 * LAYER, '#8c7c6e'); // the processional way to the steps
  // The sea wall along the beach road, white, with lamps.
  s.box(WALL, WALL + 0.6, 0, 0.7, -400, 120, '#cfc4b6');
  // Lamps: two rows either side of the forecourt and on to the steps, the plaza's edges, the beach road.
  for (const [x, z] of LAMPS) lampAt(s, lit, x, z);
  // The pilgrims' lodges on the left: white blocks with lit windows facing the plaza.
  const rnd = mulberry(23);
  for (const [x0, x1, z0, z1, h] of LODGES) {
    s.box(x0, x1, 0, h, z0, z1, '#bdb2a4').box(x0 - 0.3, x1 + 0.3, h, h + 0.6, z0 - 0.3, z1 + 0.3, '#d8cfc2');
    for (let y = 1.4; y < h - 1.5; y += 3.4) for (let z = z0 + 1.5; z < z1 - 1; z += tier ? 2.6 : 5.2) {
      if (rnd() < 0.75) lit.box(x1, x1 + 0.08, y, y + 1.5, z, z + 1.1, rnd() < 0.7 ? '#ffcf80' : '#fff0d0');
    }
    for (let x = x0 + 1.5; x < x1 - 1; x += tier ? 2.6 : 5.2) for (let y = 1.4; y < h - 1.5; y += 3.4) if (rnd() < 0.75) lit.box(x, x + 1.1, y, y + 1.5, z1, z1 + 0.08, '#ffcf80');
  }
  // Palms everywhere: along the forecourt, round the plaza, along the beach, in the gardens to the left.
  for (const [x, z, h] of PALMS) palm(s, rnd, x, z, h, tier, Math.abs(x) < 70 && z > -140);
  // The town beyond, inland and up the coast: dark blocks (their windows are spots).
  for (let i = 0; i < (tier ? 34 : 16); i++) {
    const a = -1.25 + rnd() * 1.45, d = 380 + rnd() * 340, x = Math.sin(a) * d, z = -Math.cos(a) * d, w = 14 + rnd() * 22, h = 8 + rnd() * 16;
    if (x > SHORE - 20) continue;
    s.box(x - w / 2, x + w / 2, 0, h, z - 10, z + 10, '#1c1a1e');
    BLOCKS.push([x, z, w, h]);
  }
  return s;
}

// The sea: dark far out, a pink and gold glow on the near water, lines of surf breaking along the shore.
function seaGeometry(lit, tier) {
  const y = -0.4;
  const bands = [[SHORE - 4, 125, '#7a4e6a'], [125, 170, '#523a62'], [170, 220, '#34305a'], [220, 400, '#1c1d44'], [400, 2200, '#0c1434']];
  for (const [x0, x1, c] of bands) lit.plane(x0, x1, -2000, 400, y, c);
  const rnd = mulberry(61);
  for (let i = 0; i < (tier ? 40 : 18); i++) {
    const x = SHORE + 1 + rnd() * (i % 3 ? 26 : 6), z = 300 - rnd() * 900, len = 30 + rnd() * 90;
    lit.plane(x, x + 0.6 + rnd() * 0.8, z - len, z, y + LAYER, rnd() < 0.5 ? '#e0b4c0' : '#c890a8');
  }
}

// Diyas along the forecourt, the processional way and the steps; strings of golden lights on the basilica's edges;
// lamps; the town's windows.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', gold = '#ffd36a', step = tier ? 2.2 : 3.6, d = tier ? 0.9 : 1.6;
  const line = (a, b, gap, c = gold) => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / gap));
    for (let i = 0; i <= n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + BZ, c]); }
  };
  for (const sx of [-1, 1]) {
    for (let z = 18; z > -40; z -= step) out.push([sx * 13.6, 0.32, z, diya]);
    for (let z = -42; z > BZ + 5; z -= step) out.push([sx * 3.7, 0.36, z, diya]);
    // The towers: corners and string courses, the spire's edges.
    const tx = sx * TX;
    for (const ex of [-1, 1]) line([tx + ex * (TH + 0.5), 1, 0.55], [tx + ex * (TH + 0.5), 14.6, 0.55], d);
    line([tx - TH - 0.2, 21.7, 0.25], [tx + TH + 0.2, 21.7, 0.25], d);
    line([tx - TH - 0.2, 14.4, 0.25], [tx + TH + 0.2, 14.4, 0.25], d);
    for (const ex of [-1, 1]) line([tx + ex * 1.5, SPIRE[0] + 0.6, -TH + 1.5], [tx, SPIRE[1] - 0.3, -TH], d * 0.9);
    // The gable, the aisles' and the nave's eaves.
    line([sx * (TX - TH), 15.6, -0.4], [0, 21.4, -0.4], d * 0.8);
    line([sx * (AISLE + 0.8), 7.6, -6], [sx * (AISLE + 0.8), 7.6, END + 4], d * 1.6);
    line([sx * (NAVE + 0.7), 12.8, -2], [sx * (NAVE + 0.7), 12.8, END], d * 1.6);
    line([sx * 18.4, 12.8, CROSS + 6.6], [sx * 18.4, 19.4, CROSS], d);
  }
  for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; out.push([Math.cos(t) * 4.9, 24.4, CROSS + BZ + Math.sin(t) * 4.9, gold]); }
  for (let x = -12; x <= 12; x += step * 0.5) out.push([x, P + 0.25, BZ + 1.7, diya]);
  for (const [x, z] of LAMPS) out.push([x, 4.35, z, lamp]);
  for (let z = 100; z > -400; z -= step * 2) out.push([WALL + 0.3, 0.9, z, gold]); // the sea wall's string of lights
  const rnd = mulberry(77);
  for (const [x, z, w, h] of BLOCKS) for (let i = 0; i < (tier ? 5 : 2); i++) out.push([x - w / 2 + rnd() * w, 2 + rnd() * (h - 3), z + 10.2, rnd() < 0.8 ? '#ffd9a0' : '#ffffff']);
  for (let i = 0; i < (tier ? 70 : 35); i++) { const a = -1.3 + rnd() * 1.6, dd = 300 + rnd() * 500; if (Math.sin(a) * dd < SHORE) out.push([Math.sin(a) * dd, 1 + rnd() * 5, -Math.cos(a) * dd, rnd() < 0.75 ? '#ffd28a' : '#ffffff']); }
  for (let i = 0; i < 6; i++) out.push([260 + rnd() * 600, 0.2, -200 - rnd() * 900, '#ffe0a0']); // fishing boats' lamps
  return out;
}

function layout(tier) {
  LAMPS.length = PALMS.length = BLOCKS.length = LODGES.length = 0;
  for (let z = 16; z > BZ + 6; z -= 12) for (const sx of [-1, 1]) LAMPS.push([sx * 16.5, z]);
  for (let z = 24; z > -220; z -= 16) for (const sx of [-1, 1]) LAMPS.push([sx * 48, z]);
  for (let z = 60; z > -380; z -= 18) LAMPS.push([WALL - 1, z]);
  const rnd = mulberry(5), k = tier ? 1 : 2;
  for (let z = 22; z > BZ + 4; z -= 9 * k) for (const sx of [-1, 1]) PALMS.push([sx * (24 + rnd() * 4), z, 8 + rnd() * 4]);
  for (let i = 0; i < (tier ? 26 : 12); i++) PALMS.push([WALL + 4 + rnd() * 50, 40 - rnd() * 360, 7 + rnd() * 6]);
  for (let i = 0; i < (tier ? 22 : 10); i++) PALMS.push([-52 - rnd() * 8, 30 - rnd() * 260, 8 + rnd() * 5]);
  for (let i = 0; i < (tier ? 24 : 10); i++) PALMS.push([-40 + rnd() * 100, -205 - rnd() * 120, 9 + rnd() * 6]);
  for (let i = 0; i < (tier ? 20 : 8); i++) PALMS.push([-110 - rnd() * 120, 20 - rnd() * 300, 9 + rnd() * 6]);
  for (let z = 30; z > -230; z -= 34) LODGES.push([-92, -62, z - 26, z, rnd() < 0.5 ? 8 : 11.5]);
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  layout(tier);
  const map = plasterTexture();
  const bas = basilicaGeometry(new Stone(floodColour), tier);
  const stone = bas.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#5a4026' }));
  const glow = bas.mesh(1, new THREE.MeshBasicMaterial({ map, vertexColors: true }));
  for (const m of [stone, glow]) m.position.z = BZ;
  const lit = new Stone();
  const world = groundsGeometry(new Stone(), lit, tier);
  seaGeometry(lit, tier);
  const objects = [stone, glow, world.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })), lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true }))];
  // The forecourt where crackers stand: pale granite flags.
  objects.push(forecourt({ rgb: [124, 110, 100], z0: -40, z1: 20, width: 28, tile: 2, joint: 'rgba(220,200,180,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower down, an orange glow along the horizon.
    sky: ['#03061a', '#141a4c', '#4e3a7e', '#d8805a'],
    fog: ['#3c2e60', 320, 1500],
    clouds: { colour: '#8a5e9e', count: tier ? 8 : 4, seed: 17 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffe4c0', 1.6, [-30, 30, 300]], ['#ffe6c4', 0.45, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
