/* Light Up the Skies — 3D background: the Charminar on Diwali night, seen from the old-city bazaar street to its
   north, its arch glowing and the street lit by shops and strings of lights. Loaded by world3d.js when the Charminar is
   the chosen world. Its colours follow the game's 2D Charminar picture: a deep blue night going purple and orange at
   the horizon, the monument floodlit cream and gold, the passage under the arch glowing amber, a bright bazaar.

   Proportions follow published figures: a square of about 20 m a side (22 m here to the minarets' centres), four
   pointed arches 11 m wide rising about 20 m, the clock just above each arch, a balcony at 23 m, an arcaded gallery
   and a pierced parapet to the roof at about 32 m, and four fluted minarets of 56 m with two more balconies, an
   arcaded drum and an onion dome on a ring of petals. Everything is a box, an extruded outline or a lathe, merged into
   a few meshes with one drawn plaster texture; the floodlit look is baked into vertex colours.

   Frame: +x to your right, +y up, +z towards you; the monument's local origin is the centre of its base. */
import * as THREE from './assets/vendor/three.module.min.js';
import { mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const CZ = -170; // the Charminar's centre, down the bazaar street
const HX = 11; // half the side, to the minarets' centres
const SPAN = 11, SPRING = 13, RISE = 6.5; // the great arches: apex at 19.5
const LEG = 3.6; // the depth of each face's piers
const S1 = 22.6, S2 = 29.4; // the first balcony's floor; the roof
const STREET = 13; // the shop fronts stand this far either side of the street's centre
const PLAZA = 34; // the paved square round the monument

// ---------- Plaster: lime stucco over granite, faint courses, one tile per 4 m ----------
function plasterTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(47), px = 256 / 4;
  g.fillStyle = '#f6ecda'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 0.5 * px) {
    let x = -rnd() * 40;
    while (x < 256) {
      const w = (1.1 + rnd() * 0.9) * px, v = 0.93 + rnd() * 0.07;
      g.fillStyle = `rgb(${(246 * v) | 0},${(236 * v) | 0},${(218 * v) | 0})`; g.fillRect(x + 1, y + 1, w - 2, 0.5 * px - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(90,66,40,0.28)'; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(100,76,50,${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a lit vertex colour; glow(cx, cy, cz, normal) sends a triangle to the second,
// unlit set (coloured glowColour). A shape added with set 1 goes there whole, in its own colour.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null, glow = null, glowColour = '#ffb060') {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.glow = glow; this.glowColour = new THREE.Color(glowColour);
  }
  add(geo, color, m, force = -1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, base = new THREE.Color(color);
    for (let i = 0; i < p.count; i += 3) {
      tmpA.fromBufferAttribute(p, i); tmpB.fromBufferAttribute(p, i + 1); tmpC.fromBufferAttribute(p, i + 2);
      tmpN.subVectors(tmpB, tmpA).cross(tmpE.subVectors(tmpC, tmpA));
      if (tmpN.lengthSq() < 1e-12) continue; // degenerate
      tmpN.normalize();
      const cx = (tmpA.x + tmpB.x + tmpC.x) / 3, cy = (tmpA.y + tmpB.y + tmpC.y) / 3, cz = (tmpA.z + tmpB.z + tmpC.z) / 3;
      const k = force >= 0 ? force : this.glow && this.glow(cx, cy, cz, tmpN) ? 1 : 0;
      const set = this.sets[k];
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        set.pos.push(v.x, v.y, v.z); set.nor.push(tmpN.x, tmpN.y, tmpN.z);
        set.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = force >= 0 ? base : k ? this.glowColour : this.colour ? this.colour(v.x, v.y, v.z, tmpN, base) : base;
        set.col.push(c.r, c.g, c.b);
      }
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color, force) { return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), force); }
  // An outline in the x-y plane, with holes, extruded from z0 to z1.
  extrudeZ(pts, z0, z1, color, holes = []) { return this.add(extruded(pts, holes, z1 - z0), color, at(0, 0, z0)); }
  // An outline in the z-y plane (given as [z, y]), with holes, extruded from x0 to x1.
  extrudeX(pts, x0, x1, color, holes = []) {
    const flip = (q) => q.map(([z, y]) => [-z, y]);
    const g = extruded(flip(pts), holes.map(flip), x1 - x0);
    g.rotateY(Math.PI / 2); // the outline's x becomes -z, its depth +x
    return this.add(g, color, at(x0, 0, 0));
  }
  lathe(profile, x, y, z, seg, color, force) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z), force); }
  cyl(r0, r1, y0, y1, x, z, seg, color, force, open = false) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open), color, at(x, (y0 + y1) / 2, z), force); }
  // A fluted shaft: the cylinder's corners pushed in and out to make the ribs.
  fluted(r0, r1, y0, y1, x, z, ribs, color) {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, ribs * 2, 1, true), p = g.attributes.position, row = ribs * 2 + 1;
    for (let i = 0; i < p.count; i++) if ((i % row) % 2) { p.setX(i, p.getX(i) * 0.86); p.setZ(i, p.getZ(i) * 0.86); }
    return this.add(g, color, at(x, (y0 + y1) / 2, z));
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
function extruded(pts, holes, depth) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

// A pointed arch w wide springing at height s round centre line cx, rising h to its apex: points from the left jamb
// over the apex to the right jamb.
function pointed(cx, s, w, h, n) {
  const r = (h * h + (w * w) / 4) / w, th = Math.acos((r - w / 2) / r), out = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI - (th * i) / n; out.push([cx - w / 2 + r + Math.cos(a) * r, s + Math.sin(a) * r]); }
  for (let i = n - 1; i >= 0; i--) { const a = (th * i) / n; out.push([cx + w / 2 - r + Math.cos(a) * r, s + Math.sin(a) * r]); }
  return out;
}
// An arched opening as a closed hole: its sill at b, springing at s.
const opening = (cx, b, s, w, h, n) => [[cx - w / 2, b], ...pointed(cx, s, w, h, n), [cx + w / 2, b]].reverse();
// A row of k openings across a wall from -half to half.
const openings = (k, half, b, s, w, h, n) => Array.from({ length: k }, (_, i) => opening(-half + ((i + 0.5) * 2 * half) / k, b, s, w, h, n));

// The floodlit cream and gold of the 2D picture, by height: brightest low down where the floods graze up.
const BANDS = [[0.5, '#c98d5a', '#c98d5a'], [8, '#fff0cf', '#ffe6b8'], [S1, '#ffe2ad', '#f6cf92'], [S2 + 3, '#f8d79e', '#ecc184'], [42, '#f0c88e', '#e2b276'], [99, '#e4b77c', '#d4a066']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function floodColour(x, y, z, n, base) {
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) { tmpCol.copy(a).lerp(b, Math.min(1, Math.max(0, (y - lo) / (top - lo)))); break; }
    lo = top;
  }
  if (y >= BANDS[BANDS.length - 1][0]) tmpCol.copy(BANDS[BANDS.length - 1][2]);
  return tmpCol.multiply(base);
}
// The passages under the arches and the crossing: lit from inside, the brightest amber.
const inCrossing = (cx, cy, cz, n) => Math.abs(cx) < HX - 0.03 && Math.abs(cz) < HX - 0.03 && cy > 0.55 && cy < S1 - 0.05 && n.y < 0.5;

// One minaret, rising from the corner (x, z): fluted below, three balconies, an arcaded drum, the onion dome.
function minaret(s, x, z, tier) {
  const seg = tier ? 16 : 10, ribs = tier ? 12 : 8, white = '#ffffff', rail = '#f2e2c4';
  s.lathe([[3.2, 0], [3.2, 0.5], [2.8, 1.1], [2.75, 1.4], [0, 1.4]], x, 0.5, z, seg, white); // the moulded foot
  s.fluted(2.7, 2.6, 1.9, S1, x, z, ribs, white);
  for (const y of [7, 13]) s.cyl(2.85, 2.85, y, y + 0.5, x, z, seg, white); // bands round the shaft
  s.cyl(2.5, 2.45, S1, S2, x, z, seg, white);
  s.cyl(2.5, 2.5, S2, S2 + 3.4, x, z, seg, white); // through the parapet
  // Balcony at the roof, on a ring of corbels, its railing a low drum.
  s.lathe([[2.4, 0], [3.5, 0.9], [3.6, 1.3], [0, 1.3]], x, S2 + 3.4, z, seg, white);
  s.cyl(3.45, 3.45, S2 + 4.7, S2 + 5.7, x, z, seg, rail, -1, true);
  s.fluted(2.05, 1.85, S2 + 4.7, 41.2, x, z, ribs, white);
  s.lathe([[1.85, 0], [3, 0.8], [3.1, 1.2], [0, 1.2]], x, 41.2, z, seg, white);
  s.cyl(2.95, 2.95, 42.4, 43.3, x, z, seg, rail, -1, true);
  // The arcaded drum: slender columns round a lit core.
  s.cyl(1.25, 1.25, 42.4, 46.4, x, z, seg, '#ffbf72', 1);
  const cols = tier ? 8 : 6;
  for (let i = 0; i < cols; i++) { const a = (i / cols) * Math.PI * 2, px = x + Math.cos(a) * 1.65, pz = z + Math.sin(a) * 1.65; s.box(px - 0.2, px + 0.2, 42.4, 46.4, pz - 0.2, pz + 0.2, white); }
  s.lathe([[1.4, 0], [2.6, 0.6], [2.6, 1], [0, 1]], x, 46.4, z, seg, white);
  s.cyl(2.5, 2.5, 47.4, 48, x, z, seg, rail, -1, true);
  s.cyl(1.45, 1.45, 47.4, 49, x, z, seg, white);
  // A ring of petals, then the onion dome and its finial.
  s.lathe([[1.3, 0], [1.95, 0.5], [1.75, 0.7], [1.5, 0.75], [0, 0.75]], x, 49, z, tier ? 12 : 8, white);
  s.lathe([[1.5, 0], [1.95, 0.9], [1.85, 2], [1.35, 3], [0.6, 3.9], [0.22, 4.5], [0, 4.6]], x, 49.6, z, seg, white);
  s.cyl(0.12, 0.06, 54.2, 56, x, z, 5, white);
  s.add(new THREE.SphereGeometry(0.28, 6, 4), white, at(x, 55, z));
  return s;
}

// The Charminar, round its local origin.
function charminarGeometry(s, tier) {
  const seg = tier ? 12 : 7, white = '#ffffff', shade = '#e8d6b8';
  s.box(-HX - 3.4, HX + 3.4, 0, 0.5, -HX - 3.4, HX + 3.4, '#c08a62'); // the plinth
  // The ground storey: four faces, each a slab of piers round its great arch; the corners belong to the minarets.
  const face = [[-HX, 0.5], [-SPAN / 2, 0.5], ...pointed(0, SPRING, SPAN, RISE, seg), [SPAN / 2, 0.5], [HX, 0.5], [HX, S1], [-HX, S1]];
  const inner = HX - LEG;
  s.extrudeZ(face, inner, HX, white).extrudeZ(face, -HX, -inner, white);
  const side = face.map(([z, y]) => [Math.max(-inner, Math.min(inner, z)), y]);
  s.extrudeX(side, inner, HX, white).extrudeX(side, -HX, -inner, white);
  s.box(-inner, inner, 20.2, S1, -inner, inner, white); // the crossing's ceiling
  for (const sz of [-1, 1]) {
    const f = sz * HX;
    // The archivolt standing proud round the arch, the impost band, the rosettes in the spandrels.
    const rim = [...pointed(0, SPRING, SPAN + 1.8, RISE + 1, seg), ...pointed(0, SPRING, SPAN, RISE, seg).reverse()];
    s.extrudeZ(rim, sz > 0 ? f : f - 0.35, sz > 0 ? f + 0.35 : f, shade);
    for (const sx of [-1, 1]) {
      s.box(sx * (SPAN / 2 + 0.9), sx * (HX - 1.6), SPRING - 0.5, SPRING, sz > 0 ? f : f - 0.3, sz > 0 ? f + 0.3 : f, shade);
      s.add(new THREE.CylinderGeometry(1.05, 1.05, 0.3, seg).rotateX(Math.PI / 2), shade, at(sx * 7.6, 17.4, f + sz * 0.15));
      s.box(sx * (SPAN / 2 + 0.9) - 0.3, sx * (SPAN / 2 + 0.9) + 0.3, 0.5, SPRING - 0.5, sz > 0 ? f : f - 0.25, sz > 0 ? f + 0.25 : f, shade);
    }
    // The clock above the arch: a lit dial in a moulded frame, its hands near ten to two.
    s.add(new THREE.CylinderGeometry(1.5, 1.5, 0.3, seg + 6).rotateX(Math.PI / 2), shade, at(0, 21.1, f + sz * 0.15));
    s.add(new THREE.CircleGeometry(1.15, seg + 6).rotateY(sz > 0 ? 0 : Math.PI), '#fff4dc', at(0, 21.1, f + sz * 0.32), 1);
    const hand = (len, a, w) => s.add(new THREE.BoxGeometry(w, len, 0.08).translate(0, len / 2, 0).rotateZ(a), '#2a2018', at(0, 21.1, f + sz * 0.4), 1);
    hand(0.95, 0.9, 0.09); hand(0.65, -1.1, 0.13);
  }
  // The first balcony: a deep slab on corbels, its railing a low pierced wall.
  const B = HX + 1.3;
  s.box(-B, B, S1, S1 + 0.6, -B, B, white);
  if (tier) for (let x = -HX + 3.5; x <= HX - 3.4; x += 1.5) for (const sz of [-1, 1]) {
    s.box(x - 0.2, x + 0.2, S1 - 0.9, S1, sz * HX, sz * (HX + 1.1), shade);
    s.box(sz * HX, sz * (HX + 1.1), S1 - 0.9, S1, x - 0.2, x + 0.2, shade);
  }
  const railHoles = (k) => openings(k, HX - 2.6, S1 + 0.85, S1 + 1.25, 0.6, 0.3, 2);
  const railing = [[-HX + 2.4, S1 + 0.6], [HX - 2.4, S1 + 0.6], [HX - 2.4, S1 + 1.7], [-HX + 2.4, S1 + 1.7]];
  for (const sz of [-1, 1]) {
    s.extrudeZ(railing, sz > 0 ? B - 0.25 : -B, sz > 0 ? B : -B + 0.25, white, tier ? railHoles(12) : []);
    s.extrudeX(railing, sz > 0 ? B - 0.25 : -B, sz > 0 ? B : -B + 0.25, white, tier ? railHoles(12) : []);
  }
  // The gallery: an arcade of seven arches each side round a lit core, the roof slab over it.
  s.box(-HX + 2.6, HX - 2.6, S1 + 0.6, S2, -HX + 2.6, HX - 2.6, '#e0954e', 1);
  const wall = [[-HX, S1 + 0.6], [HX, S1 + 0.6], [HX, S2], [-HX, S2]];
  const arches = openings(7, HX - 2.4, S1 + 1.7, S2 - 2.4, 1.7, 1.4, tier ? 4 : 2);
  for (const sz of [-1, 1]) {
    s.extrudeZ(wall, sz > 0 ? HX - 0.7 : -HX, sz > 0 ? HX : -HX + 0.7, white, arches);
    s.extrudeX(wall.map(([z, y]) => [Math.max(-HX + 0.7, Math.min(HX - 0.7, z)), y]), sz > 0 ? HX - 0.7 : -HX, sz > 0 ? HX : -HX + 0.7, white, arches);
  }
  s.box(-HX - 0.9, HX + 0.9, S2, S2 + 0.6, -HX - 0.9, HX + 0.9, white);
  // The parapet: a pierced screen of small arches, with little finials along its top.
  const screen = [[-HX, S2 + 0.6], [HX, S2 + 0.6], [HX, S2 + 3.2], [-HX, S2 + 3.2]];
  const small = openings(tier ? 13 : 9, HX - 2.3, S2 + 1.1, S2 + 2.2, 0.8, 0.6, 2);
  for (const sz of [-1, 1]) {
    s.extrudeZ(screen, sz > 0 ? HX + 0.2 : -HX - 0.2, sz > 0 ? HX + 0.6 : -HX + 0.2, white, small);
    s.extrudeX(screen.map(([z, y]) => [Math.max(-HX - 0.2, Math.min(HX + 0.2, z)), y]), sz > 0 ? HX + 0.2 : -HX - 0.2, sz > 0 ? HX + 0.6 : -HX + 0.2, white, small);
    s.box(-HX, HX, S2 + 3.2, S2 + 3.5, sz * (HX + 0.7) - 0.45, sz * (HX + 0.7) + 0.45, white);
    if (tier) for (let x = -HX + 2.6; x <= HX - 2.5; x += 1.6) {
      s.cyl(0.18, 0.04, S2 + 3.5, S2 + 4.5, x, sz * (HX + 0.4), 4, white);
      s.cyl(0.18, 0.04, S2 + 3.5, S2 + 4.5, sz * (HX + 0.4), x, 4, white);
    }
  }
  // The little mosque at the roof's west end: a low prayer hall under a row of tiny domes.
  s.box(-HX + 1, -2, S2 + 0.6, S2 + 3.4, -6, 6, white);
  for (let z = -4; z <= 4; z += 4) s.lathe([[1.2, 0], [1.2, 0.6], [0.6, 1.5], [0, 1.8]], -5.5, S2 + 3.4, z, seg, white);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) minaret(s, sx * HX, sz * HX, tier);
  return s;
}

// The bazaar and the old city round the monument: the street, pavements, shop-houses, lamps, parked autos.
function groundsGeometry(s, shops, tier, out) {
  const plane = (x0, x1, z0, z1, y, color) => s.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2));
  const L1 = LAYER, L2 = 2 * LAYER, asphalt = '#22202a', pavers = '#5e4c44', rnd = mulberry(23);
  plane(-1500, 1500, -1500, 200, 0, '#141216');
  // The street up to the square, the square itself, and the streets leaving it to the sides and beyond.
  plane(-STREET, STREET, CZ + PLAZA, -40, L1, asphalt);
  plane(-PLAZA, PLAZA, CZ - PLAZA, CZ + PLAZA, L1, pavers);
  for (const sx of [-1, 1]) plane(sx > 0 ? PLAZA : -420, sx > 0 ? 420 : -PLAZA, CZ - 11, CZ + 11, L1, asphalt);
  plane(-11, 11, CZ - 420, CZ - PLAZA, L1, asphalt);
  // The centre line, and pale stripes round the square.
  for (let z = -44; z > CZ + PLAZA + 4; z -= 9) plane(-0.12, 0.12, z - 2.2, z + 2.2, L2, '#d8cfc0');
  for (const sx of [-1, 1]) plane(sx > 0 ? HX + 6 : -HX - 7, sx > 0 ? HX + 7 : -HX - 6, CZ - HX - 7, CZ + HX + 7, L2, '#8a7464');
  for (const sz of [-1, 1]) plane(-HX - 6, HX + 6, sz > 0 ? CZ + HX + 6 : CZ - HX - 7, sz > 0 ? CZ + HX + 7 : CZ - HX - 6, L2, '#8a7464');
  // Raised pavements in front of the shops.
  for (const sx of [-1, 1]) s.box(sx * STREET, sx * (STREET + 3), 0, 0.25, CZ + PLAZA, 22, '#4a4048');
  // Shop-houses along both sides: a lit shop under an awning and a sign, lit and dark windows above.
  const walls = ['#4a3b34', '#3d3440', '#57463a', '#36303a', '#5a4a44', '#40383a'];
  const signs = ['#c8485a', '#3a9fb8', '#46a872', '#d8803a', '#9a5ab0', '#e0b848', '#e8e0d0'];
  const awnings = ['#9c2c2c', '#2c6a3c', '#b8662a', '#6a2c6a', '#2c4a7a'];
  const row = (sx, z0, z1, xFront) => {
    // A lit pane on the shop fronts, facing the street.
    const pane = (x, y0, y1, za, zb, c) => shops.add(new THREE.PlaneGeometry(zb - za, y1 - y0).rotateY(-sx * Math.PI / 2), c, at(x, (y0 + y1) / 2, (za + zb) / 2), 1);
    for (let z = z0; z > z1;) {
      const w = 5 + rnd() * 4, h = 7 + rnd() * (tier ? 10 : 7), x0 = sx * xFront, x1 = sx * (xFront + 12);
      const zs = z - w + 0.3, ze = z - 0.3, f = x0 - sx * 0.1;
      s.box(x0, x1, 0, h, zs, ze, walls[(rnd() * walls.length) | 0]);
      if (tier > 1) s.box(x0 - sx * 0.4, x0, h - 0.1, h + 0.5, zs, ze, '#2a2428'); // the parapet's lip
      pane(f, 0.25, 3.3, zs + 0.5, ze - 0.5, rnd() < 0.7 ? '#d89a58' : '#e2c8a0');
      pane(f - sx * 0.15, 3.9, 5, zs + 0.3, ze - 0.3, signs[(rnd() * signs.length) | 0]);
      const a = new THREE.Vector3(x0, 3.75, (zs + ze) / 2), b = new THREE.Vector3(x0 - sx * 1.8, 3.1, (zs + ze) / 2);
      s.add(new THREE.BoxGeometry(0.08, a.distanceTo(b), ze - zs).rotateZ(Math.atan2(a.x - b.x, b.y - a.y)), awnings[(rnd() * awnings.length) | 0], at((a.x + b.x) / 2, (a.y + b.y) / 2, a.z));
      for (let y = 6.3; y < h - 1.5; y += 3.2) for (let wz = zs + 1; wz < ze - 1; wz += 1.9) {
        if (rnd() < (tier ? 0.5 : 0.3)) pane(f, y, y + 1.4, wz, wz + 1, rnd() < 0.8 ? '#ffc977' : '#ffe9c4');
      }
      out.push([f - sx * 0.6, 3.3, (zs + ze) / 2, '#ffe2a8']);
      z -= w;
    }
  };
  for (const sx of [-1, 1]) {
    row(sx, 22, CZ + PLAZA, STREET + 3);
    // Round the square, facing it, and down the far streets.
    for (const zz of [[CZ + PLAZA + 0, CZ + 11], [CZ - 11, CZ - PLAZA - 60]]) row(sx, zz[0], zz[1], PLAZA + 2);
    row(sx, CZ - PLAZA - 2, CZ - 160, 11 + 3);
  }
  // The old city beyond, low and dense, with a few dark domes and towers; trees here and there.
  for (let i = 0; i < (tier ? 90 : 45); i++) {
    const a = -Math.PI * 0.95 + rnd() * Math.PI * 1.9, d = 110 + rnd() * 380, x = Math.sin(a) * d, z = CZ - Math.cos(a) * d * 0.8;
    if (Math.abs(x) < STREET + 20 && z > CZ) continue; // keep the street clear
    const w = 10 + rnd() * 16, h = 8 + rnd() * 18;
    s.box(x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, rnd() < 0.5 ? '#2a2328' : '#231f26');
    if (rnd() < 0.15) s.lathe([[4, 0], [4.4, 2], [3, 4.5], [0, 6]], x, h, z, 8, '#3a3034');
    else if (rnd() < 0.4) out.push([x + (rnd() - 0.5) * w, h * (0.3 + rnd() * 0.6), z + w / 2 + 0.3, '#ffc877']);
    if (rnd() < 0.35) s.add(new THREE.IcosahedronGeometry(4 + rnd() * 3, 0), '#16261a', at(x + w / 2 + 4, 5, z + w / 2 + 3));
  }
  // The Mecca Masjid's great facade off the square to the left, with its two squat minarets.
  s.box(-150, -78, 0, 22, CZ - 70, CZ - 40, '#4a3e38');
  for (const x of [-150, -78]) { s.cyl(3, 3, 0, 32, x, CZ - 40, 10, '#4a3e38'); s.lathe([[3.4, 0], [2.6, 2.4], [0, 4.4]], x, 32, CZ - 40, 10, '#4a3e38'); }
  // Street lamps along the pavements and round the square: a dark post, a curved arm, a lantern.
  const lamp = (x, z, sx) => {
    s.cyl(0.14, 0.09, 0.25, 7.5, x, z, 6, '#1a181e');
    s.box(x, x - sx * 1.4, 7.4, 7.55, z - 0.07, z + 0.07, '#1a181e');
    shops.box(x - sx * 1.4 - 0.3, x - sx * 1.4 + 0.3, 6.8, 7.4, z - 0.3, z + 0.3, '#fff0c8', 1);
    out.push([x - sx * 1.4, 7, z, '#ffeec0'], [x - sx * 1.4, 6.7, z, '#ffd890']);
  };
  for (let z = 14; z > CZ + PLAZA; z -= 24) for (const sx of [-1, 1]) lamp(sx * (STREET + 0.6), z, sx);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lamp(sx * (HX + 12), CZ + sz * (HX + 12), sx);
  // Autos and cars parked along the kerbs beyond the forecourt, tail and side lights on.
  for (let z = -46; z > CZ + PLAZA + 6; z -= tier ? 13 : 22) for (const sx of [-1, 1]) {
    if (rnd() < 0.35) continue;
    const x = sx * (STREET - 1.4), auto = rnd() < 0.55;
    if (auto) {
      s.box(x - 0.7, x + 0.7, 0.3, 1.2, z - 1.4, z + 1.4, '#1f2a1c').box(x - 0.7, x + 0.7, 1.2, 1.95, z - 0.4, z + 1.4, '#c9b02a');
      out.push([x, 0.9, z + 1.45, '#ff5a3a']);
    } else {
      s.box(x - 0.9, x + 0.9, 0.3, 1.1, z - 2.2, z + 2.2, rnd() < 0.5 ? '#c8c8cc' : '#3a3a52').box(x - 0.8, x + 0.8, 1.1, 1.6, z - 1.2, z + 1, '#22222a');
      out.push([x - 0.6, 0.85, z + 2.25, '#ff3a2a'], [x + 0.6, 0.85, z + 2.25, '#ff3a2a']);
    }
  }
  return s;
}

// Diyas along the forecourt, round the square and the plinth and on the first balcony; strings of lights across the
// street; far city lights. [x, y, z, colour]
function lightSpots(tier, out) {
  const diya = '#ff9f3a', step = tier ? 2.4 : 4, string = ['#ffd27a', '#ff9a3c', '#ffe9b0', '#ff6a9a', '#7ad7ff'];
  for (const sx of [-1, 1]) {
    for (let z = 18; z > -40; z -= step) out.push([sx * 9.2, 0.3, z, diya]);
    for (let z = CZ + PLAZA; z > CZ - PLAZA; z -= step * 1.5) out.push([sx * (HX + 6.5), 0.3, z, diya]);
    for (let z = -HX - 3.2; z <= HX + 3.2; z += step * 0.6) out.push([sx * (HX + 3.6), 0.6, CZ + z, diya]);
    for (let z = -HX + 2.5; z <= HX - 2.5; z += step * 0.5) out.push([sx * (HX + 1.15), S1 + 1.9, CZ + z, '#ffb24a']);
  }
  for (let x = -HX - 3.2; x <= HX + 3.2; x += step * 0.6) if (Math.abs(x) > SPAN / 2 + 0.4) out.push([x, 0.6, CZ + HX + 3.6, diya]);
  for (let x = -HX + 2.5; x <= HX - 2.5; x += step * 0.5) out.push([x, S1 + 1.9, CZ + HX + 1.15, '#ffb24a']);
  // Strings of lights swagged across the street between the shop fronts.
  for (let z = -24; z > CZ + PLAZA; z -= tier ? 14 : 28) {
    const n = tier ? 26 : 14;
    for (let i = 0; i <= n; i++) { const t = i / n, x = -STREET - 2.8 + t * (2 * STREET + 5.6); out.push([x, 8.6 - Math.sin(t * Math.PI) * 1.6, z, string[i % string.length]]); }
  }
  const rnd = mulberry(91);
  for (let i = 0; i < (tier ? 110 : 55); i++) { const a = -1.3 + rnd() * 2.6, d = 650 + rnd() * 350; out.push([Math.sin(a) * d, 2 + rnd() * 18, CZ - Math.cos(a) * d, rnd() < 0.7 ? '#ffd28a' : '#ffffff']); }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = plasterTexture();
  const lit = new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#64401e' });
  const glow = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  const objects = [];
  const mon = charminarGeometry(new Stone(floodColour, inCrossing, '#ffb262'), tier);
  for (const m of [mon.mesh(0, lit), mon.mesh(1, glow)]) { m.position.z = CZ; objects.push(m); }
  const spots = [];
  const shops = new Stone();
  objects.push(groundsGeometry(new Stone(), shops, tier, spots).mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })));
  objects.push(shops.mesh(1, new THREE.MeshBasicMaterial({ vertexColors: true })));
  // The forecourt where crackers stand: worn granite setts.
  objects.push(forecourt({ rgb: [72, 62, 64], z0: -40, z1: 20, width: 18, tile: 1.4, joint: 'rgba(180,160,150,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier, spots),
    zone: { x0: -7, x1: 7, z0: -30, z1: -5 },
    // The 2D picture's night: deep navy overhead, purple lower down, an orange glow over the city at the horizon.
    sky: ['#03061a', '#131b4e', '#4a3a7c', '#cf6a4c'],
    fog: ['#46305e', 300, 1400],
    clouds: { colour: '#8a5a9a', count: tier ? 9 : 5, seed: 21 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffd9a0', 1.7, [-30, 20, 300]], ['#ffe6c4', 0.5, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
