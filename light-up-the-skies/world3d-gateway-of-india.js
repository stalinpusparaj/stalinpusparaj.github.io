/* Light Up the Skies — 3D background: the Gateway of India on Diwali night, seen across the Apollo Bunder from the city
   side, with Mumbai harbour behind it and the Taj Mahal Palace hotel to your left. Loaded by world3d.js when the
   Gateway is the chosen world. Its colours follow the game's 2D Gateway picture: a deep blue night going purple and
   warm at the horizon, the yellow basalt floodlit gold, dark water full of boat lights.

   Proportions follow published figures and the picture: a 26 m basalt arch, a 8.4 m pointed main arch with its crown
   at 12.2 m, a gallery of small arches over it, the central block topped out at 20.8 m between four corner turrets
   whose domed kiosks reach 26 m, and lower wings each side with a tall arched recess and a doorway. The hotel is the
   1903 wing: about 90 m of floodlit stone, corner towers and the great red ribbed dome. Everything is a box, an
   extruded outline or a lathe, merged into a few meshes with one drawn masonry texture; the floodlit look is baked
   into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the Gateway's local origin is the centre of its base. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const GZ = -82; // the Gateway's centre, across the bunder from you
const EDGE = GZ - 12; // the sea wall behind it
const SEA = -1.2; // the harbour's surface, below the bunder
const AH = 4.2, SPRING = 6; // main arch: half span, springing; crown 12.2
const TOP = 20.8; // the central block's roof, under the parapet
const TAJ = { x: -110, z: -130, rot: 0.66 }; // the hotel's centre, its front turned towards the bunder

// ---------- Masonry: yellow basalt in courses of 0.35 and 0.5 m, one tile per 4 m ----------
function masonryTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(23), px = 256 / 4;
  g.fillStyle = '#f2e4c8'; g.fillRect(0, 0, 256, 256);
  let y = 0, row = 0;
  while (y < 256) {
    const h = (row % 2 ? 0.5 : 0.35) * px;
    let x = -(row % 3) * 22;
    while (x < 256) {
      const w = (0.8 + rnd() * 0.8) * px, v = 0.88 + rnd() * 0.12;
      g.fillStyle = `rgb(${(242 * v) | 0},${(228 * v) | 0},${(200 * v) | 0})`;
      g.fillRect(x + 1, y + 1, w - 2, h - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(80,56,30,0.42)'; g.fillRect(0, y, 256, 1.2);
    y += h; row++;
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(90,66,40,${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 5); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base, set) gives a vertex colour; glow(cx, cy, cz, normal) sends a triangle to the second,
// unlit set (or force does). frame, when set, places everything added (the hotel, a boat) in the world.
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
  // A disc facing you, r round, from z0 to z1.
  disc(x, y, z0, z1, r, seg, color) { return this.add(new THREE.CylinderGeometry(r, r, z1 - z0, seg).rotateX(Math.PI / 2), color, at(x, y, (z0 + z1) / 2)); }
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
const place = (x, z, rot) => new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);

// A two-centred pointed arch over (cx, spring), half span wide: its points from the left springing to the right.
function pointed(cx, spring, half, n) {
  const rho = half * 1.6, d = rho - half, tc = Math.acos(d / rho), out = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI - ((Math.PI - tc) * i) / n; out.push([cx + d + Math.cos(a) * rho, spring + Math.sin(a) * rho]); }
  for (let i = 1; i <= n; i++) { const a = tc - (tc * i) / n; out.push([cx - d + Math.cos(a) * rho, spring + Math.sin(a) * rho]); }
  return out;
}
// The same arch as a closed opening, down to its sill.
const archHole = (cx, sill, spring, half, n) => [[cx - half, sill], ...pointed(cx, spring, half, n), [cx + half, sill]];

// The floodlit gold of the 2D picture, by height: brightest on the lower storey where the floods graze up.
const BANDS = [[1, '#9a5e34', '#b8783f'], [7, '#ffd894', '#ffcf80'], [15, '#ffc874', '#f2ad5e'], [TOP, '#eaa056', '#d88c48'], [99, '#eaa65c', '#d39050']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function gateColour(x, y, z, n, base, si) {
  if (si) return base; // lit openings keep their own colour
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) return tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)).multiply(base);
    lo = top;
  }
  return tmpCol.copy(BANDS[BANDS.length - 1][2]).multiply(base);
}
// The main passage: its walls and vault lit from inside, as in the picture.
const inPassage = (cx, cy, cz, n) => Math.abs(cx) < AH + 0.05 && Math.abs(cz) < 8.05 && cy > 1 && cy < 12.3 && Math.abs(n.z) < 0.5;

// The Gateway, around its local origin.
function gateGeometry(s, tier) {
  const n = tier ? 10 : 6, buff = '#ffffff', shade = '#8a6a52', deep = '#5e4434', lamp = '#ffcf78';
  s.box(-22, 22, 0, 1, -10.5, 10.5, buff); // the platform
  s.box(-12, 12, 0, 0.5, 10.5, 11.6, buff); // and its steps from the bunder
  // The central block, pierced front to back by the great arch.
  s.extrudeZ([[-6.8, 1], [-AH, 1], ...pointed(0, SPRING, AH, n), [AH, 1], [6.8, 1], [6.8, TOP], [-6.8, TOP]], -8, 8, buff);
  for (const sz of [-1, 1]) {
    const out = (d) => sz * (8 + d); // a depth out from this face
    const span = (a, b) => (sz > 0 ? [out(a), out(b)] : [out(b), out(a)]);
    // Jambs, the archivolt and the rectangular frame round it.
    for (const sx of [-1, 1]) s.box(sx * AH, sx * 5.1, 1, SPRING, ...span(0, 0.45), buff).box(sx * 5.6, sx * 6.3, 1, 14.6, ...span(0, 0.6), buff);
    s.extrudeZ([...pointed(0, SPRING, 5.1, n), ...pointed(0, SPRING, AH, n).reverse()], ...span(0, 0.45), buff);
    s.box(-6.3, 6.3, 14, 14.6, ...span(0, 0.6), buff);
    for (const sx of [-1, 1]) s.disc(sx * 4.6, 12.6, ...span(0, 0.3), 0.55, 8, buff); // spandrel roundels
    // The gallery: a row of small arches over the frame, shadowed behind.
    const k = tier ? 7 : 5, pitch = 13.6 / k, half = pitch * 0.28;
    s.box(-6.6, 6.6, 14.7, 17.3, ...span(0, 0.12), shade);
    s.extrudeZ([[-6.8, 14.6], [6.8, 14.6], [6.8, 17.4], [-6.8, 17.4]], ...span(0.12, 0.7), buff,
      Array.from({ length: k }, (_, i) => archHole(-6.8 + pitch * (i + 0.5), 14.95, 16.4, half, tier ? 4 : 2)));
    // The upper storey: a frieze, the cornice, the parapet with its centre panel.
    s.box(-6.8, 6.8, 17.4, 17.9, ...span(0, 0.8), buff).box(-6.8, 6.8, 19.6, 20.2, ...span(0, 0.4), buff);
    s.box(-6.8, 6.8, 20.2, TOP, ...span(0, 0.9), buff);
    for (let x = -6.35; x <= 6.4; x += tier ? 0.9 : 1.8) s.box(x - 0.25, x + 0.25, TOP, 21.6, ...span(0.2, 0.7), buff);
    s.box(-2.2, 2.2, TOP, 22.4, ...span(0, 0.6), buff);
  }
  s.cyl(0.07, 0.05, 22.4, 25.2, 0, 8.2, 4, '#3a2a20'); // the flagstaff
  for (const sx of [-1, 1]) {
    s.box(sx * 6.8, sx * 10, 1, TOP, -6, 6, buff); // between the turrets
    // The wings: an arched recess the full height of the storey, a lit doorway in it, a rosette over the door.
    const [w0, w1] = sx > 0 ? [10, 19.5] : [-19.5, -10], wc = sx * 14.75;
    s.box(w0, w1, 1, 15, -6.5, 6.5, buff);
    for (const sz of [-1, 1]) {
      const span = (a, b) => (sz > 0 ? [6.5 + a, 6.5 + b] : [-6.5 - b, -6.5 - a]);
      s.box(wc - 3, wc + 3, 2, 13.7, ...span(0, 0.1), shade);
      s.extrudeZ([[w0, 1.4], [w1, 1.4], [w1, 15], [w0, 15]], ...span(0.1, 0.7), buff, [archHole(wc, 2, 9.2, 3, n)]);
      s.box(wc - 2.95, wc + 2.95, 7, 7.4, ...span(0.1, 0.4), buff); // the transom
      s.disc(wc, 9.9, ...span(0.1, 0.35), 1.3, tier ? 12 : 8, buff).disc(wc, 9.9, ...span(0.35, 0.45), 0.6, 8, deep);
      s.box(w0, w1, 14.2, 14.6, ...span(0.7, 0.9), buff); // a string course
      s.force = 1; s.extrudeZ(archHole(wc, 2, 4.4, 1.3, n), ...span(0.1, 0.18), lamp); s.force = null;
    }
    // Cornice, parapet and the slim corner posts with their little domes.
    s.box(w0 - sx * 0.2, w1 + sx * 0.4, 15, 15.6, -6.9, 6.9, buff);
    for (let x = 10.4; x < 19.6; x += tier ? 0.9 : 1.8) for (const sz of [-1, 1]) s.box(sx * x - 0.25, sx * x + 0.25, 15.6, 16.4, sz * 6.5 - 0.25, sz * 6.5 + 0.25, buff);
    for (const sz of [-1, 1]) {
      s.cyl(0.75, 0.7, 1, 16.6, sx * 19.6, sz * 6.6, 8, buff);
      s.lathe([[0.85, 0], [0.8, 0.4], [0.45, 0.9], [0, 1.2]], sx * 19.6, 16.6, sz * 6.6, 8, buff);
    }
    // The four turrets: shafts banded at each storey, a lit kiosk on top, a ribbed dome and finial.
    for (const sz of [-1, 1]) {
      const tx = sx * 8.4, tz = sz * 7.6;
      s.box(tx - 1.6, tx + 1.6, 1, 21.4, tz - 1.6, tz + 1.6, buff);
      for (const [y0, y1] of [[6, 6.4], [14, 14.6], [17.4, 17.9], [20.4, 21]]) s.box(tx - 1.8, tx + 1.8, y0, y1, tz - 1.8, tz + 1.8, buff);
      s.box(tx - 1.85, tx + 1.85, 21.4, 21.8, tz - 1.85, tz + 1.85, buff);
      for (const cx of [-1, 1]) for (const cz of [-1, 1]) s.box(tx + cx * 1.5 - 0.22, tx + cx * 1.5 + 0.22, 21.8, 23.6, tz + cz * 1.5 - 0.22, tz + cz * 1.5 + 0.22, buff);
      s.box(tx - 1.95, tx + 1.95, 23.6, 23.95, tz - 1.95, tz + 1.95, buff);
      s.lathe([[1.75, 0], [1.8, 0.35], [1.6, 0.9], [1.05, 1.35], [0.4, 1.62], [0, 1.7]], tx, 23.95, tz, tier ? 12 : 8, buff);
      s.cyl(0.12, 0.05, 25.65, 26.2, tx, tz, 4, buff);
      s.force = 1;
      s.box(tx - 1.15, tx + 1.15, 21.8, 23.6, tz - 1.15, tz + 1.15, lamp); // the kiosk, lit inside
      s.extrudeZ(archHole(tx, 15.2, 16.3, 0.5, 3), sz > 0 ? tz + 1.6 : tz - 1.65, sz > 0 ? tz + 1.65 : tz - 1.6, '#ffc066'); // a window
      s.force = null;
    }
  }
  return s;
}

// The Taj Mahal Palace, around its own centre, its front towards +z; place() turns it to face the bunder.
function tajGeometry(s, lit, tier) {
  const stone = '#c9a57a', trim = '#efe0c4', dome = '#c4522e', seg = tier ? 16 : 8;
  s.box(-45, 45, 0, 30, -9, 9, stone);
  for (let y = 7.6; y < 30; y += 8.4) s.box(-45.3, 45.3, y, y + 0.5, -9.3, 9.3, trim); // floor bands
  s.box(-45.5, 45.5, 30, 31.2, -9.5, 9.5, trim);
  // The central tower, its drum and the great red ribbed dome.
  s.box(-11, 11, 0, 38, -11, 11, stone).box(-11.6, 11.6, 37, 38.4, -11.6, 11.6, trim);
  s.cyl(8.4, 8, 38.4, 43, 0, 0, 8, stone).cyl(8.9, 8.9, 43, 43.6, 0, 0, 8, trim);
  s.lathe([[8.6, 0], [9.1, 2], [8.7, 5], [7.2, 8], [4.8, 11], [2.2, 13.2], [0.7, 14.4], [0, 14.8]], 0, 43.6, 0, seg, dome);
  s.cyl(0.9, 0.6, 58.4, 60.4, 0, 0, 6, trim).cyl(0.15, 0.08, 60.4, 62.5, 0, 0, 4, trim);
  // Corner towers with their smaller domes; the front ones stand forward.
  for (const x of [-45, -24, 24, 45]) {
    s.box(x - 4.5, x + 4.5, 0, 36, -7, 11, stone).box(x - 5, x + 5, 35, 36.4, -7.5, 11.5, trim);
    s.cyl(3.6, 3.4, 36.4, 38.4, x, 2, 8, stone);
    s.lathe([[3.8, 0], [3.9, 1], [3.2, 2.8], [1.6, 4.4], [0.3, 5.2], [0, 5.4]], x, 38.4, 2, tier ? 12 : 8, dome);
    s.cyl(0.1, 0.06, 43.8, 45.4, x, 2, 4, trim);
  }
  // Lit windows, about half of them: rows on every floor of the wings, the towers and the central block.
  const rnd = mulberry(41), win = (x, y, z) => { if (rnd() < 0.55) lit.box(x - 0.6, x + 0.6, y, y + 1.8, z, z + 0.12, rnd() < 0.8 ? '#ffcf7a' : '#fff0c8'); };
  for (let f = 0; f < 6; f++) {
    const y = 2.6 + f * 4.2;
    for (const sx of [-1, 1]) {
      for (let x = 12.8; x < 19; x += 3) win(sx * x, y, 9);
      for (let x = 30.4; x < 40; x += 3) win(sx * x, y, 9);
      for (const x of [24, 45]) for (const dx of [-2, 2]) win(sx * x + dx, y, 11);
    }
    for (const x of [-6, -2, 2, 6]) win(x, y, 11);
  }
  for (const x of [-6, -2, 2, 6]) win(x, 28, 11);
  for (const x of [-6, -2, 2, 6]) win(x, 32.4, 11);
}

// A harbour launch: blue hull, white cabin with a lit window strip, along its own z.
function boat(s, lit, x, z, rot, len) {
  s.frame = lit.frame = place(x, z, rot);
  s.box(-1.7, 1.7, SEA - 0.5, SEA + 0.7, -len / 2, len / 2, '#1f4796');
  s.add(new THREE.CylinderGeometry(1.7, 0.01, 2.6, 3).rotateX(-Math.PI / 2).rotateZ(Math.PI).scale(1, 0.4, 1), '#1f4796', at(0, SEA + 0.5, -len / 2 - 1.3));
  s.box(-1.75, 1.75, SEA + 0.55, SEA + 0.75, -len / 2, len / 2, '#e8e2d6');
  s.box(-1.4, 1.4, SEA + 0.75, SEA + 2.6, -len / 3, len / 3, '#dcd6cc').box(-1.6, 1.6, SEA + 2.6, SEA + 2.8, -len / 3 - 0.4, len / 3 + 0.4, '#e8e2d6');
  lit.box(-1.48, 1.48, SEA + 1.4, SEA + 2.1, -len / 3 + 0.4, len / 3 - 0.4, '#ffd590');
  s.cyl(0.06, 0.05, SEA + 2.8, SEA + 5, 0, len / 6, 4, '#2a2a2a');
  s.frame = lit.frame = null;
}

// Everything round the Gateway: the bunder, the sea wall, lamps, trees, the hotel, boats, ship and docks.
function groundsGeometry(s, lit, tier) {
  const L1 = LAYER, ground = '#15120f', pavers = '#4e443e', lawn = '#17271a', wall = '#6a5a4a';
  // The land: the bunder and the hotel's side, the gardens to your right; the harbour lies beyond and below.
  s.plane(-500, 45, EDGE, 200, 0, ground).plane(-500, -45, -400, EDGE, 0, ground).plane(45, 600, -30, 200, 0, ground);
  // The paving stands LAYER above the ground; the forecourt lies LAYER above the paving.
  s.plane(-45, 45, EDGE, 25, L1, pavers).plane(-60, -45, -400, 25, L1, '#2a2522');
  s.plane(45, 140, -30, 40, L1, lawn);
  // The sea wall's face and its parapet, open behind the Gateway where steps go down to the boats.
  s.box(-45, 45, SEA - 0.6, 0, EDGE - 0.5, EDGE, wall).box(-45.5, -45, SEA - 0.6, 0, -400, EDGE, wall);
  s.box(45, 45.5, SEA - 0.6, 0, EDGE, -30, wall).box(45, 600, SEA - 0.6, 0, -30.5, -30, wall);
  for (const [x0, x1] of [[-45.5, -13], [13, 45.5]]) s.box(x0, x1, 0, 0.9, EDGE - 0.1, EDGE + 0.4, wall);
  s.box(-45.5, -45, 0, 0.9, -400, EDGE, wall).box(45, 45.5, 0, 0.9, EDGE, -30, wall).box(45, 600, 0, 0.9, -30.5, -30, wall);
  for (let i = 0; i < 4; i++) s.box(-12, 12, SEA - 0.6, -i * 0.3, EDGE - 0.6 - i * 0.5, EDGE - 0.1 - i * 0.5, wall);
  // Victorian lamp standards: a black post, a cross-arm, three lanterns.
  const lampAt = (x, z) => {
    s.cyl(0.16, 0.1, 0, 4.4, x, z, 6, '#141418').box(x - 0.8, x + 0.8, 4.1, 4.25, z - 0.06, z + 0.06, '#141418');
    for (const dx of [-0.75, 0, 0.75]) lit.box(x + dx - 0.18, x + dx + 0.18, dx ? 4.25 : 4.5, dx ? 4.75 : 5, z - 0.18, z + 0.18, '#ffe2a0');
  };
  for (const [x, z] of LAMPS) lampAt(x, z);
  // Bollards along the forecourt.
  for (let z = 18; z > EDGE + 26; z -= tier ? 3 : 6) for (const sx of [-1, 1]) s.box(sx * 12.6 - 0.15, sx * 12.6 + 0.15, 0, 0.75, z - 0.15, z + 0.15, '#2a2420');
  // Trees: rain trees and palms on the bunder's edges, a garden to your right.
  const rnd = mulberry(5), tree = (x, z, r = 4.5) => {
    r *= 0.85 + rnd() * 0.3;
    s.add(new THREE.IcosahedronGeometry(r, tier > 1 ? 1 : 0), rnd() < 0.5 ? '#13241a' : '#1a3122', at(x, r + 3.5, z));
    s.cyl(0.35, 0.25, 0, r + 2, x, z, 5, '#2a1e16');
  };
  for (let z = 22; z > EDGE + 8; z -= tier ? 11 : 22) { if (z > -40) tree(-30, z - 5, 3.6); tree(30, z - 4, 3.6); }
  for (let z = 22; z > -60; z -= tier ? 14 : 28) tree(-52, z);
  for (let i = 0; i < (tier ? 18 : 9); i++) tree(55 + rnd() * 80, -22 + rnd() * 60, 5);
  // The hotel, turned to face the bunder.
  s.frame = lit.frame = place(TAJ.x, TAJ.z, TAJ.rot);
  s.colour = (x, y, z, nn, base) => tmpCol.copy(base).multiplyScalar(clamp(1.3 - y * 0.011, 0.75, 1.3));
  tajGeometry(s, lit, tier);
  s.colour = null; s.frame = lit.frame = null;
  // The Taj Tower behind it, and Colaba's blocks beyond, dark with a few lit windows (spots).
  s.box(-170, -140, 0, 70, -150, -120, '#2a2624');
  const r2 = mulberry(19);
  for (let i = 0; i < (tier ? 26 : 13); i++) {
    const x = -150 - r2() * 250, z = -260 + r2() * 360, w = 14 + r2() * 18, h = 12 + r2() * 30;
    s.box(x - w / 2, x + w / 2, 0, h, z - 10, z + 10, '#1e1b1b');
  }
  // Launches at the steps and out in the harbour.
  for (const [x, z, rot, len] of BOATS.slice(0, tier ? BOATS.length : 4)) boat(s, lit, x, z, rot, len);
  // A cargo ship at anchor, and the port's cranes off to the right.
  s.box(200, 290, SEA - 1, SEA + 9, -585, -570, '#14161c').box(268, 286, SEA + 9, SEA + 22, -584, -571, '#1c1f26');
  for (const [x, z] of CRANES) {
    for (const dx of [-4, 4]) for (const dz of [-4, 4]) s.box(x + dx - 0.5, x + dx + 0.5, 0, 34, z + dz - 0.5, z + dz + 0.5, '#2a2a30');
    s.box(x - 5, x + 5, 34, 40, z - 5, z + 5, '#2a2a30').box(x - 48, x + 6, 38, 40, z - 1, z + 1, '#2a2a30');
  }
  return s;
}
const LAMPS = [];
for (let z = 16; z > EDGE + 10; z -= 16) for (const sx of [-1, 1]) LAMPS.push([sx * 14, z]);
for (const x of [-38, -24, 24, 38]) LAMPS.push([x, EDGE + 1.2]);
for (const z of [EDGE + 20, -60, -40]) LAMPS.push([43.5, z]);
const BOATS = [[-30, EDGE - 22, 1.45, 13], [33, EDGE - 30, -1.5, 12], [-6, EDGE - 60, 1.4, 14], [64, -70, 1.2, 12], [-40, EDGE - 95, 0.9, 15], [95, -120, -0.6, 13], [30, EDGE - 150, 1.6, 16]];
const CRANES = [[470, -240], [540, -300], [610, -360]];

// The harbour's surface: dark, warmer where the floodlit Gateway and the lamps shine on it.
function waterMesh() {
  const g = new THREE.PlaneGeometry(4000, 2700, 40, 30).rotateX(-Math.PI / 2);
  g.translate(0, SEA, -1150);
  const p = g.attributes.position, col = [], c = new THREE.Color(), deepC = new THREE.Color('#070d2a'), warm = new THREE.Color('#4a3030');
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), (p.getZ(i) - EDGE) * 0.8);
    c.copy(deepC).lerp(warm, clamp(1 - d / 260, 0, 1) * 0.8);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
// Reflections: long glowing streaks on the water under each light, fading away from it towards you.
function streakMesh(lights) {
  const pos = [], col = [], c = new THREE.Color(), y = SEA + LAYER;
  for (const [x, z, hex, len, w] of lights) {
    c.set(hex);
    const q = [[x - w, z, 1], [x + w, z, 1], [x + w * 0.4, z + len, 0], [x - w * 0.4, z + len, 0]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], y, q[k][1]); col.push(c.r * q[k][2], c.g * q[k][2], c.b * q[k][2]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// Diyas along the forecourt, the Gateway's platform and the sea wall; lamps; boat, ship, dock and far shore lights.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) {
    for (let z = 18; z > EDGE + 26; z -= step) out.push([sx * 11.8, 0.25, z, diya]);
    for (let z = 10.3; z > -10.4; z -= step * 0.8) out.push([sx * 22.4, 1.05, GZ + z, diya]);
    for (let z = -32; z > -400; z -= step * 3) out.push([-45.25, 1.05, z, diya]);
  }
  for (let x = -21.6; x <= 21.7; x += step * 0.6) out.push([x, 1.05, GZ + 10.7, diya]);
  for (let x = -12; x <= 12.1; x += step * 0.8) out.push([x, 0.6, GZ + 11.9, diya]);
  for (let x = -45; x <= 45; x += step * 1.5) if (Math.abs(x) > 13) out.push([x, 1.05, EDGE + 0.15, diya]);
  for (let z = EDGE; z < -30; z += step * 1.5) out.push([45.25, 1.05, z, diya]);
  for (let x = 46; x < 600; x += step * 3) out.push([x, 1.05, -30.25, diya]);
  for (const [x, z] of LAMPS) for (const dx of [-0.75, 0, 0.75]) out.push([x + dx, dx ? 4.5 : 4.75, z, lamp]);
  // Boats: masthead, port and starboard, a string of bulbs along the roof.
  for (const [x, z, rot, len] of BOATS.slice(0, tier ? BOATS.length : 4)) {
    const m = place(x, z, rot), v = new THREE.Vector3(), p = (lx, ly, lz, col) => { v.set(lx, ly, lz).applyMatrix4(m); out.push([v.x, v.y, v.z, col]); };
    p(0, SEA + 5.1, len / 6, '#ffffff'); p(-1.75, SEA + 0.9, -len / 2, '#ff4040'); p(1.75, SEA + 0.9, -len / 2, '#40ff80');
    for (let k = -1; k <= 1; k += tier ? 0.25 : 0.5) for (const sx of [-1, 1]) p(sx * 1.6, SEA + 2.85, (k * len) / 3, k % 0.5 ? '#ffb347' : '#ffe08a');
  }
  const rnd = mulberry(77);
  for (let i = 0; i < (tier ? 24 : 12); i++) out.push([200 + rnd() * 90, SEA + 1 + rnd() * 21, -569, rnd() < 0.8 ? '#ffe0a0' : '#ffffff']); // the ship
  for (const [x, z] of CRANES) out.push([x, 41, z, '#ff3a2a'], [x - 47, 40.5, z, '#ff3a2a']);
  // Far shore across the harbour, and Colaba's windows to the left.
  for (let i = 0; i < (tier ? 110 : 55); i++) { const a = -1.15 + rnd() * 2.3, d = 650 + rnd() * 450; out.push([Math.sin(a) * d, 1 + rnd() * 8, -Math.cos(a) * d, rnd() < 0.75 ? '#ffd28a' : '#ffffff']); }
  for (let i = 0; i < (tier ? 70 : 35); i++) out.push([-150 - rnd() * 250, 3 + rnd() * 30, -260 + rnd() * 360, '#ffd9a0']);
  for (let i = 0; i < (tier ? 30 : 15); i++) out.push([-170 + rnd() * 30, 4 + rnd() * 64, -119.5, '#ffe8c0']); // the Taj Tower's windows
  out.push([0, 25.4, GZ + 8.2, '#ffffff']);
  // The Taj's dome lantern.
  const v = new THREE.Vector3(0, 60, 0).applyMatrix4(place(TAJ.x, TAJ.z, TAJ.rot));
  out.push([v.x, v.y, v.z, '#ffcf7a']);
  return out;
}
// The streaks: under the boats and the ship.
function reflections(tier) {
  const out = [];
  for (const [x, z, , len] of BOATS.slice(0, tier ? BOATS.length : 4)) out.push([x, z, '#a8702a', 22 + len, 1.6]);
  out.push([245, -568, '#5a4020', 90, 30]);
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = masonryTexture();
  const gate = gateGeometry(new Stone(gateColour, inPassage), tier);
  const front = gate.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a2810' }));
  const glow = gate.mesh(1, new THREE.MeshBasicMaterial({ map, vertexColors: true }));
  const pc = glow.geometry.attributes.color, pp = glow.geometry.attributes.position, warm = new THREE.Color('#ffd27a');
  for (let k = 0; k < pc.count; k++) if (Math.abs(pp.getX(k)) <= AH + 0.01 && Math.abs(pp.getZ(k)) <= 8.01) pc.setXYZ(k, warm.r, warm.g, warm.b); // the passage glows
  for (const m of [front, glow]) { m.position.z = GZ; }
  const lit = new Stone();
  const world = groundsGeometry(new Stone(), lit, tier);
  const objects = [front, glow, world.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })), lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })),
    waterMesh(), streakMesh(reflections(tier))];
  // The bunder where crackers stand: grey basalt pavers.
  objects.push(forecourt({ rgb: [92, 84, 80], z0: -40, z1: 20, width: 24, tile: 2, joint: 'rgba(190,170,150,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue overhead, violet lower down, a warm glow over the harbour; no moon on Diwali.
    sky: ['#03061a', '#141a4c', '#4a3a86', '#c8785c'],
    fog: ['#3a2e62', 340, 1600],
    clouds: { colour: '#8a6aa8', count: tier ? 9 : 5, seed: 21 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.75, [-40, 25, 300]], ['#ffe0b8', 0.45, [150, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
