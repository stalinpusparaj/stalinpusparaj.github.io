/* Light Up the Skies — 3D background: Harmandir Sahib, the Golden Temple in Amritsar, on Diwali night, seen from the
   white marble parikrama across the Amrit Sarovar. Loaded by world3d.js when the Golden Temple is the chosen world.
   Its colours follow the game's 2D picture: a deep blue starry night, the gilded sanctum blazing gold in the middle of
   the dark pool with its reflection beneath it, and the white buildings round the water glowing warm.

   Proportions follow published figures: the sanctum is about 12.3 m square on a 20 m platform in the pool, two storeys
   (marble below, gilded copper above) under a parapet of small domes, a kiosk at each roof corner and a square
   pavilion carrying the fluted, lotus-shaped golden dome, its finial about 26 m above the water. A 60 m marble causeway
   runs west from it to the Darshani Deori, the gilded gateway on the parikrama, with the Akal Takht beyond. The pool
   is about 150 m across, ringed by a 12 m marble walkway and two- and three-storey white buildings. Everything is a
   box, a wall of one drawn texture or a lathe, merged into a few meshes; the floodlit look is in vertex colours.

   Frame: +x to your right, +y up, +z towards you; the walkway is at y 0 and the water a little below it. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, ngon, forecourt, rangoli, LAYER } from './world3d.js';

const POOL = { x: 70, z0: -42, z1: -138 }; // the water: x ±70, from the near walkway to the far one
const TZ = (POOL.z0 + POOL.z1) / 2; // the sanctum stands in the middle of it
const W = -0.7; // the water's surface, below the walkway
const K = 1.25; // the sanctum is drawn a quarter larger than life, so it holds the screen as in the picture
const WALK = 12; // the parikrama's width
const BX = POOL.x + WALK, BZ = POOL.z1 - WALK; // where the buildings round the pool begin
const MARBLE = '#fff4e2', GOLD = '#ffc24a', TEX = '#ffffff';

// ---------- The texture: four drawn surfaces in one 256 px canvas ----------
// Regions as [u0, u1, v0, v1]. GILT: a gilded bay round a cusped arch. INLAY: white marble with inlaid vines.
// ARCADE: a bay of the white buildings, its arch dark and warm. RAIL: a marble balustrade. Plain surfaces sample white.
const R = { GILT: [0, 0.5, 0.5, 1], INLAY: [0.5, 1, 0.5, 1], ARCADE: [0, 0.5, 0, 0.5], RAIL: [0.5, 1, 0.25, 0.5] };
const PLAIN = [0.875, 0.125];
function atlasTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(31);
  // A cusped (lobed) pointed arch with its foot at y + h and its apex at y.
  const arch = (x, y, w, h, fill) => {
    const rise = w * 0.7, spring = y + rise;
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, spring);
    for (let i = 1; i <= 3; i++) g.quadraticCurveTo(x + (w * (i - 0.9)) / 6, spring - (rise * (i - 0.2)) / 3, x + (w * i) / 6, spring - (rise * i) / 3.3);
    g.lineTo(x + w / 2, y);
    for (let i = 3; i >= 1; i--) g.lineTo(x + w - (w * i) / 6, spring - (rise * i) / 3.3);
    g.lineTo(x + w, spring); g.lineTo(x + w, y + h); g.closePath();
    g.fillStyle = fill; g.fill();
  };
  // GILT (top left): beaten gold, a raised frame, a deep arch glowing warm inside.
  let gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#f4b848'); gr.addColorStop(1, '#ffd878');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,170,0.5)' : 'rgba(150,90,20,0.35)'; g.fillRect(rnd() * 128, rnd() * 128, 1.5, 1.5); }
  g.strokeStyle = '#a8701c'; g.lineWidth = 3; g.strokeRect(6, 6, 116, 120);
  g.strokeStyle = '#fff0b0'; g.lineWidth = 1; g.strokeRect(10, 10, 108, 112);
  arch(26, 30, 76, 98, '#b07a24');
  gr = g.createLinearGradient(0, 40, 0, 128); gr.addColorStop(0, '#6a3410'); gr.addColorStop(1, '#a85a18');
  arch(34, 40, 60, 88, gr);
  for (const x of [16, 104]) { g.fillStyle = '#fff0b0'; g.beginPath(); g.arc(x + 4, 22, 5, 0, Math.PI * 2); g.fill(); }
  // INLAY (top right): white marble, a blind arch, vines and coloured stones.
  g.fillStyle = '#f4ede2'; g.fillRect(128, 0, 128, 128);
  g.strokeStyle = '#c9b494'; g.lineWidth = 2; g.strokeRect(134, 6, 116, 116);
  g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    const x = 142 + rnd() * 100, y = 14 + rnd() * 100;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 12, y - 10, x + 20, y + 10, x + 30 * (rnd() - 0.5), y + 22); g.stroke();
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = ['#a8323a', '#3f7048', '#c08a2e', '#2f4f7a'][i % 4]; g.beginPath(); g.arc(140 + rnd() * 104, 12 + rnd() * 104, 2, 0, Math.PI * 2); g.fill(); }
  // ARCADE (bottom left): white plaster, a cornice band, an arch open onto a lit verandah.
  g.fillStyle = '#f2eadc'; g.fillRect(0, 128, 128, 128);
  g.fillStyle = '#d6c9b4'; g.fillRect(0, 128, 128, 10);
  gr = g.createLinearGradient(0, 160, 0, 256); gr.addColorStop(0, '#5a3214'); gr.addColorStop(1, '#a8682a');
  arch(22, 152, 84, 104, '#cdbda4'); arch(28, 160, 72, 96, gr);
  // RAIL (bottom right, upper half): a balustrade of posts and dark gaps; below it, plain white.
  g.fillStyle = '#f4ede2'; g.fillRect(128, 128, 128, 128);
  g.fillStyle = '#5a4430';
  for (let x = 134; x < 256; x += 20) g.fillRect(x, 146, 10, 34);
  g.fillStyle = '#ffffff'; g.fillRect(128, 192, 128, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- Builder: merges every surface into one geometry, flat shaded, coloured per vertex ----------
// tint(x, y, z, base) may shade a vertex (world position); frame, when set, places everything added.
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tN = new THREE.Vector3(), tE = new THREE.Vector3(), tCol = new THREE.Color();
class Builder {
  constructor(tint = null) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.tint = tint; this.frame = null; }
  // One triangle (Vector3s, in order counter-clockwise seen from its front) with its uvs.
  tri(a, b, c, uvs, base) {
    if (this.frame) { a.applyMatrix4(this.frame); b.applyMatrix4(this.frame); c.applyMatrix4(this.frame); }
    tN.subVectors(b, a).cross(tE.subVectors(c, a));
    if (tN.lengthSq() < 1e-12) return;
    tN.normalize();
    [a, b, c].forEach((v, i) => {
      this.pos.push(v.x, v.y, v.z); this.nor.push(tN.x, tN.y, tN.z); this.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      const k = this.tint ? this.tint(v.x, v.y, v.z, base) : base;
      this.col.push(k.r, k.g, k.b);
    });
  }
  // A wall from (x0, z0) to (x1, z1), y0 to y1, facing to the right of that direction (a ring traced in order of
  // increasing angle faces out); its surface tiles a region cols x rows times.
  wall(x0, z0, x1, z1, y0, y1, region = null, cols = 1, rows = 1, color = MARBLE) {
    const base = new THREE.Color(color), dx = x1 - x0, dz = z1 - z0;
    const U = (s, v) => (region ? [region[0] + (region[1] - region[0]) * s, region[2] + (region[3] - region[2]) * v] : PLAIN);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const a = i / cols, b = (i + 1) / cols, ya = y0 + ((y1 - y0) * j) / rows, yb = y0 + ((y1 - y0) * (j + 1)) / rows;
      const P = (t, y) => new THREE.Vector3(x0 + dx * t, y, z0 + dz * t);
      this.tri(P(a, ya), P(b, yb), P(b, ya), [...U(0, 0), ...U(1, 1), ...U(1, 0)], base);
      this.tri(P(a, ya), P(a, yb), P(b, yb), [...U(0, 0), ...U(0, 1), ...U(1, 1)], base);
    }
    return this;
  }
  walls(pts, y0, y1, region, cols = 1, rows = 1, color) {
    for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; this.wall(x0, z0, x1, z1, y0, y1, region, cols, rows, color); }
    return this;
  }
  // A railing: both faces of a ring of walls.
  fence(pts, y0, y1, cols, color = MARBLE) { this.walls(pts, y0, y1, R.RAIL, cols, 1, color); return this.walls(pts.slice().reverse(), y0, y1, R.RAIL, cols, 1, color); }
  // A flat convex polygon at height y, facing up.
  cap(pts, y, color = MARBLE) {
    const base = new THREE.Color(color), V = ([x, z]) => new THREE.Vector3(x, y, z);
    for (let i = 1; i < pts.length - 1; i++) this.tri(V(pts[0]), V(pts[i + 1]), V(pts[i]), [...PLAIN, ...PLAIN, ...PLAIN], base);
    return this;
  }
  // Any three.js geometry, plain (no region) or with its own uvs squeezed into a region.
  add(geo, color, m = null, region = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, uv = g.attributes.uv, base = new THREE.Color(color), uvs = [];
    for (let i = 0; i < p.count; i += 3) {
      uvs.length = 0;
      for (let k = i; k < i + 3; k++) {
        if (!region || !uv) { uvs.push(...PLAIN); continue; }
        uvs.push(region[0] + (region[1] - region[0]) * clamp(uv.getX(k), 0, 1), region[2] + (region[3] - region[2]) * clamp(uv.getY(k), 0, 1));
      }
      this.tri(tA.fromBufferAttribute(p, i), tB.fromBufferAttribute(p, i + 1), tC.fromBufferAttribute(p, i + 2), uvs, base);
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color, region) { return this.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), region); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color) { return this.cap([[x1, z0], [x1, z1], [x0, z1], [x0, z0]], y, color); }
  mesh(material) { return this.pos.length ? new THREE.Mesh(this.geometry(), material) : null; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const sq = (s, cx = 0, cz = 0) => [[cx + s, cz - s], [cx + s, cz + s], [cx - s, cz + s], [cx - s, cz - s]];
const turn = (k, x = 0, z = 0) => new THREE.Matrix4().makeRotationY((k * Math.PI) / 2).setPosition(x, 0, z);

// The lotus dome: a lathe whose every other meridian is pulled in, so it reads as fluted ribs.
const LOTUS = [[0.78, 0], [0.94, 0.08], [1, 0.22], [0.98, 0.36], [0.88, 0.52], [0.68, 0.68], [0.44, 0.82], [0.2, 0.93], [0.07, 0.98], [0, 1]];
// Kiosk domes and the little domes of the parapets get fewer rings.
const SMALL = [[0.8, 0], [1, 0.25], [0.86, 0.55], [0.45, 0.85], [0, 1]], BUD = [[1, 0], [0.8, 0.5], [0, 1]];
function fluted(r, h, flutes, depth = 0.07, profile = r < 2 ? SMALL : LOTUS) {
  const g = new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(a * r, b * h)), flutes * 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), k = 1 - depth * (0.5 - 0.5 * Math.cos(Math.atan2(x, z) * flutes));
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  return g;
}
// A gilded dome and finial: the fluted dome r round, a stem, the kalash and a tiny umbrella on top.
function goldDome(b, x, y, z, r, flutes) {
  b.add(fluted(r, r * 1.5, flutes), GOLD, at(x, y, z));
  b.cyl(r * 0.12, r * 0.08, y + r * 1.45, y + r * 1.9, x, z, 6, GOLD);
  b.add(new THREE.SphereGeometry(r * 0.14, 6, 4), GOLD, at(x, y + r * 2, z));
  b.add(new THREE.ConeGeometry(r * 0.18, r * 0.22, 6), GOLD, at(x, y + r * 2.25, z));
}
// A kiosk (chhatri): four slim posts, a slab and a fluted dome.
function kiosk(b, x, y, z, s, h, flutes) {
  for (const [px, pz] of sq(s * 0.8, x, z)) b.box(px - s * 0.12, px + s * 0.12, y, y + h, pz - s * 0.12, pz + s * 0.12, GOLD);
  b.box(x - s * 1.05, x + s * 1.05, y + h, y + h + s * 0.18, z - s * 1.05, z + s * 1.05, GOLD);
  goldDome(b, x, y + h + s * 0.18, z, s * 0.9, flutes);
}
// A pointed arch outline (x-y plane): the opening of a doorway, sill to apex.
function archShape(w, h) {
  const s = new THREE.Shape(), rise = w * 0.75;
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - rise);
  s.quadraticCurveTo(w / 2, h - rise * 0.25, 0, h); s.quadraticCurveTo(-w / 2, h - rise * 0.25, -w / 2, h - rise);
  return s;
}

// The floodlit gold, by height: brightest low down where the lights graze up, a little deeper towards the dome.
function goldTint(x, y, z, base) {
  return tCol.copy(base).multiplyScalar(clamp(1.12 - y * 0.008, 0.95, 1.12));
}

// Harmandir Sahib, its causeway and the Darshani Deori: everything that stands in the water and is reflected in it.
// Centred on the sanctum, at walkway height; lit receives the glowing doorways and lanterns. low: only the parts near
// the water, for the reflection (from a standing eye the pool's near edge hides the image of anything higher).
function templeGeometry(b, lit, tier, low = false) {
  const fl = tier > 1 ? 16 : tier ? 12 : 8, big = new THREE.Matrix4().makeScale(K, K, K);
  b.frame = lit.frame = big;
  // The platform in the water, its gilded railing and corner lamps.
  b.box(-11.5, 11.5, W - 0.6, 0.5, -11.5, 11.5, MARBLE);
  b.fence(sq(11.3), 0.5, 1.4, tier ? 12 : 6).walls(sq(11.35), 1.4, 1.55, null, 1, 1, GOLD);
  for (const [x, z] of sq(11.3)) { b.cyl(0.14, 0.1, 0.5, 3.6, x, z, 6, GOLD); lit.box(x - 0.2, x + 0.2, 3.6, 4.1, z - 0.2, z + 0.2, '#ffcf70'); }
  // The sanctum: inlaid marble below, gilded above, two storeys under a cornice.
  const s = 7.2;
  b.walls(sq(s), 0.5, 4.2, R.INLAY, 4, 1, TEX).walls(sq(s), 4.2, 8.4, R.GILT, 4, 1, TEX);
  if (!low) {
    b.box(-s - 0.6, s + 0.6, 8.4, 8.9, -s - 0.6, s + 0.6, GOLD); // the chhajja between the storeys
    b.walls(sq(s - 0.1), 8.9, 13, R.GILT, 5, 1, TEX);
    b.box(-s - 0.5, s + 0.5, 13, 13.5, -s - 0.5, s + 0.5, GOLD);
    b.walls(sq(s + 0.2), 13.5, 14.2, null, 1, 1, GOLD); // the parapet
    b.cap(sq(s + 0.2), 14.2, GOLD);
    // A row of small domes along the parapet.
    const step = tier > 1 ? 1.1 : tier ? 1.55 : 2.4;
    for (let t = -s + 1.6; t <= s - 1.5; t += step) for (const [x, z] of [[t, s + 0.2], [t, -s - 0.2], [s + 0.2, t], [-s - 0.2, t]]) b.add(fluted(0.32, 0.65, 4, 0.05, BUD), GOLD, at(x, 14.2, z));
    // Each face: a lit doorway, and on the tiers that afford it a projecting balcony window with a curved roof.
    for (let k = 0; k < 4; k++) {
      b.frame = lit.frame = big.clone().multiply(turn(k));
      lit.add(new THREE.ShapeGeometry(archShape(2.6, 3.4)), '#ffd27a', at(0, 0.5, s + 0.03));
      if (tier) {
        b.box(-1.6, 1.6, 9.4, 12.2, s - 0.1, s + 0.9, TEX, R.GILT);
        b.add(new THREE.CylinderGeometry(1, 1, 3.6, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.55, 1.1), GOLD, at(0, 12.2, s + 0.4));
      }
      lit.add(new THREE.ShapeGeometry(archShape(1.4, 2.6)), '#ffcf70', at(0, 9.6, s + (tier ? 0.93 : 0.03)));
    }
    b.frame = lit.frame = big;
    // The four kiosks at the roof's corners.
    for (const [x, z] of sq(s - 0.7)) kiosk(b, x, 14.2, z, 1.2, 2.4, fl / 2);
    // The square pavilion on the roof, and the great fluted dome on its lotus base.
    b.walls(sq(3.8), 14.2, 17.4, R.GILT, 3, 1, TEX).box(-4.3, 4.3, 17.4, 17.9, -4.3, 4.3, GOLD);
    for (const [x, z] of sq(3.8)) b.add(fluted(0.45, 0.9, 4, 0.05, BUD), GOLD, at(x, 17.9, z));
    b.add(fluted(4.1, 0.9, fl, 0.12, [[0.9, 0], [1, 0.5], [0.85, 1], [0, 1]]), GOLD, at(0, 17.9, 0)); // the lotus petals
    b.add(fluted(3.9, 5.6, fl, 0.08), GOLD, at(0, 18.6, 0));
    b.cyl(0.32, 0.22, 24, 25.4, 0, 0, 6, GOLD);
    b.add(new THREE.SphereGeometry(0.55, 8, 6), GOLD, at(0, 25.6, 0)).add(new THREE.SphereGeometry(0.35, 6, 4), GOLD, at(0, 26.3, 0));
    b.add(new THREE.ConeGeometry(0.75, 0.6, 8), GOLD, at(0, 26.9, 0)).cyl(0.05, 0.03, 27.2, 28, 0, 0, 4, GOLD);
  }
  b.frame = lit.frame = null;

  // The causeway west to the gateway: marble, its railings, gilded lamps along it.
  const cx0 = -POOL.x - 1, cx1 = -11.5 * K;
  b.box(cx0, cx1, W - 0.6, 0.4, -3, 3, MARBLE);
  for (const sz of [-1, 1]) {
    b.fence([[cx1, sz * 2.9], [cx0, sz * 2.9]], 0.4, 1.3, tier ? 24 : 12);
    b.box(cx0, cx1, 1.3, 1.42, sz * 2.9 - 0.12, sz * 2.9 + 0.12, GOLD);
    for (let x = cx1 - 4; x > cx0; x -= 8) { b.cyl(0.12, 0.09, 0.4, 3.4, x, sz * 2.9, 6, GOLD); lit.box(x - 0.2, x + 0.2, 3.4, 3.9, sz * 2.9 - 0.2, sz * 2.9 + 0.2, '#ffcf70'); }
  }
  // The Darshani Deori: a two-storey gilded gateway on the walkway, its arch facing the temple, three domes on top.
  const gx = -POOL.x - WALK / 2, gw = 6, gd = 9, gh = 9.5;
  b.walls(sq(1).map(([x, z]) => [gx + x * gw, z * gd]), 0, 4, R.INLAY, 3, 1, TEX);
  b.walls(sq(1).map(([x, z]) => [gx + x * gw, z * gd]), 4, gh, R.GILT, 3, 1, TEX);
  b.box(gx - gw - 0.5, gx + gw + 0.5, gh, gh + 0.5, -gd - 0.5, gd + 0.5, GOLD).walls(sq(1).map(([x, z]) => [gx + x * (gw + 0.3), z * (gd + 0.3)]), gh + 0.5, gh + 1.1, null, 1, 1, GOLD);
  b.cap(sq(1).map(([x, z]) => [gx + x * (gw + 0.3), z * (gd + 0.3)]), gh + 1.1, GOLD);
  b.frame = lit.frame = turn(1, gx, 0);
  lit.add(new THREE.ShapeGeometry(archShape(3.4, 5.4)), '#ffd27a', at(0, 0, gw + 0.03));
  b.frame = lit.frame = null;
  if (low) return b;
  goldDome(b, gx, gh + 1.1, 0, 2.3, fl);
  for (const z of [-gd + 1.6, gd - 1.6]) kiosk(b, gx, gh + 1.1, z, 1, 2, fl / 2);
  return b;
}

// The white buildings round the pool: an arcaded front facing the water, a parapet, now and then a domed kiosk.
// side: -1 left (front faces +x), 1 right (faces -x), 0 the far side (faces +z).
function buildings(b, lit, side, from, to, rnd, tier) {
  const cream = '#fff0dc', len = Math.abs(to - from);
  for (let t = 0; t < len; ) {
    const seg = 14 + rnd() * 16, a = from + Math.sign(to - from) * t, e = from + Math.sign(to - from) * Math.min(len, t + seg), h = 7 + rnd() * 5, d = 14;
    const lo = Math.min(a, e), hi = Math.max(a, e), bays = Math.max(2, Math.round((hi - lo) / 4)), rows = h > 10.5 ? 3 : 2;
    if (side) {
      const x = side * BX, xb = x + side * d;
      b.box(Math.min(x, xb), Math.max(x, xb), 0, h, lo, hi, cream);
      if (side < 0) b.wall(x + 0.08, lo, x + 0.08, hi, 0, h - 0.8, R.ARCADE, bays, rows, TEX); else b.wall(x - 0.08, hi, x - 0.08, lo, 0, h - 0.8, R.ARCADE, bays, rows, TEX);
      if (tier && rnd() < 0.5) kiosk(b, x + side * 2.5, h, (lo + hi) / 2, 1.3, 2.2, 6);
    } else {
      b.box(lo, hi, 0, h, BZ - d, BZ, cream);
      b.wall(hi, BZ + 0.08, lo, BZ + 0.08, 0, h - 0.8, R.ARCADE, bays, rows, TEX);
      if (tier && rnd() < 0.5) kiosk(b, (lo + hi) / 2, h, BZ - 2.5, 1.3, 2.2, 6);
    }
    t += seg;
  }
}

// The parikrama, the pool's sides, the buildings round it, the Akal Takht, the Ramgarhia towers, trees and the city.
function groundsGeometry(b, lit, tier) {
  const earth = '#141210', walk = '#d6cfc4', kerb = '#efe8dc', rnd = mulberry(17);
  // The ground (y 0) and the marble walkway (LAYER above it), both open over the pool.
  const ring = (x, z0, z1, y, col) => { b.plane(-x, x, POOL.z0, z1, y, col).plane(-x, x, z0, POOL.z1, y, col).plane(-x, -POOL.x, POOL.z1, POOL.z0, y, col).plane(POOL.x, x, POOL.z1, POOL.z0, y, col); };
  ring(900, -1400, 200, 0, earth);
  ring(BX + 14, BZ - 14, 60, LAYER, walk);
  b.plane(-POOL.x - 2, POOL.x + 2, POOL.z1 - 2, POOL.z0 + 2, -60, '#03040a'); // deep under the water: the dark the reflection hangs in
  // The pool's marble kerb, standing just above the walkway, its inner face going down to the water.
  b.box(-POOL.x - 0.3, POOL.x + 0.3, W - 0.5, 0.3, POOL.z0 - 0.3, POOL.z0 + 0.3, kerb).box(-POOL.x - 0.3, POOL.x + 0.3, W - 0.5, 0.3, POOL.z1 - 0.3, POOL.z1 + 0.3, kerb);
  for (const sx of [-1, 1]) b.box(sx * POOL.x - 0.3, sx * POOL.x + 0.3, W - 0.5, 0.3, POOL.z1, POOL.z0, kerb);
  // Gilded lamp posts along the water's edge.
  for (const [x, z] of LAMPS) { b.cyl(0.14, 0.1, 0.3, 3.8, x, z, 6, GOLD); lit.box(x - 0.2, x + 0.2, 3.8, 4.3, z - 0.2, z + 0.2, '#ffcf70'); }
  // The buildings round three sides; the near side is behind you.
  buildings(b, lit, -1, 40, BZ, rnd, tier);
  buildings(b, lit, 1, 40, BZ, rnd, tier);
  buildings(b, lit, 0, -BX, BX, rnd, tier);
  // The Akal Takht beyond the gateway: white storeys, gilded above, a golden dome.
  const ax = -BX - 30;
  b.box(ax - 10, ax + 10, 0, 14, TZ - 10, TZ + 10, '#fff0dc');
  b.wall(ax + 10.08, TZ - 10, ax + 10.08, TZ + 10, 0, 14, R.ARCADE, 5, 3, TEX).wall(ax + 10, TZ + 10.08, ax - 10, TZ + 10.08, 0, 14, R.ARCADE, 5, 3, TEX);
  b.walls(sq(8, ax, TZ), 14, 22, R.GILT, 4, 1, TEX).box(ax - 8.6, ax + 8.6, 22, 22.6, TZ - 8.6, TZ + 8.6, GOLD);
  goldDome(b, ax, 22.6, TZ, 4.2, tier > 1 ? 16 : 10);
  for (const [x, z] of sq(7, ax, TZ)) kiosk(b, x, 22.6, z, 1, 2, 6);
  // The two tall Ramgarhia towers, far to your right.
  if (tier) for (const z of [BZ + 30, BZ + 50]) {
    const x = BX + 20;
    b.add(new THREE.CylinderGeometry(2.4, 3.2, 40, 8), '#e8d2b4', at(x, 20, z));
    for (const y of [14, 27, 39]) b.cyl(3.6, 3.4, y, y + 0.8, x, z, 8, '#f4e6d0');
    kiosk(b, x, 40, z, 2, 2.6, 8);
  }
  // Trees on the walkway's outer edge and above the rooftops, and the dark city beyond.
  const tree = (x, z, r) => {
    b.add(new THREE.IcosahedronGeometry(r, tier > 1 ? 1 : 0), rnd() < 0.5 ? '#14261a' : '#1b3222', at(x, r + 2.4, z));
    b.cyl(0.35, 0.25, 0, r + 1, x, z, 5, '#2a1e16');
  };
  for (const [x, z] of [[-BX + 4, 20], [BX - 4, 26], [-BX + 4, -150], [BX - 4, -60]]) tree(x, z, 3.2);
  for (let i = 0; i < (tier ? 30 : 14); i++) {
    const a = -1.3 + rnd() * 2.6, d = 140 + rnd() * 120;
    tree(Math.sin(a) * d, -Math.cos(a) * d * 0.9 + TZ * 0.4, 5 + rnd() * 4);
  }
  for (let i = 0; i < (tier ? 40 : 20); i++) {
    const a = -1.35 + rnd() * 2.7, d = 280 + rnd() * 300, x = Math.sin(a) * d, z = -Math.cos(a) * d + 30, w = 14 + rnd() * 20, h = 8 + rnd() * 16;
    b.box(x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, '#1a1716');
    CITY.push([x, z, w, h]);
  }
  return b;
}
const LAMPS = [];
for (let x = -POOL.x + 6; x < POOL.x; x += 14) LAMPS.push([x, POOL.z0 + 1.2], [x, POOL.z1 - 1.2]);
for (let z = POOL.z0 - 8; z > POOL.z1; z -= 14) for (const sx of [-1, 1]) if (Math.abs(z - TZ) > 8) LAMPS.push([sx * (POOL.x + 1.2), z]);
const CITY = [];

// The dark water: deep blue, warmer where the gold shines on it.
function waterMesh(tier) {
  const g = new THREE.PlaneGeometry(POOL.x * 2, POOL.z0 - POOL.z1, 14, 12).rotateX(-Math.PI / 2);
  g.translate(0, W, TZ);
  const p = g.attributes.position, col = [], c = new THREE.Color(), deep = new THREE.Color('#050a24'), warm = new THREE.Color('#3a2410');
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i) * 0.6, p.getZ(i) - TZ);
    c.copy(deep).lerp(warm, clamp(1 - d / 60, 0, 1) * 0.7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: tier ? 0.62 : 0.94, depthWrite: false }));
  m.renderOrder = 1;
  return m;
}
// Reflections: glowing streaks on the water running towards you under each light; under the temple they stand in for
// the mirrored image on the low tier and brighten it on the others.
function streakMesh(tier) {
  const pos = [], col = [], c = new THREE.Color(), y = W + LAYER;
  const streak = (x, z, hex, len, w, k = 1) => {
    c.set(hex).multiplyScalar(k);
    const q = [[x - w, z, 1], [x + w, z, 1], [x + w * 0.5, z + len, 0], [x - w * 0.5, z + len, 0]];
    for (const i of [0, 2, 1, 0, 3, 2]) { pos.push(q[i][0], y, Math.min(POOL.z0 - 0.4, q[i][1])); col.push(c.r * q[i][2], c.g * q[i][2], c.b * q[i][2]); }
  };
  for (let x = -12; x <= 12; x += tier ? 1.2 : 1.6) streak(x, TZ + 11.5 * K + 0.5, '#ff9a30', 22 + Math.abs(Math.sin(x * 3.1)) * 30, 0.9, tier ? 0.4 : 0.7);
  for (let x = -64; x < -11.5 * K - 2; x += 8) streak(x, TZ + 3.5, '#ffb050', 20, 0.3, 0.7);
  for (const [x, z] of LAMPS) if (z < POOL.z0 - 2) streak(x, z + 1, '#ffb050', 18, 0.35, 0.6);
  for (let x = -POOL.x + 3; x < POOL.x; x += tier ? 5 : 9) streak(x, POOL.z1 + 0.5, '#d8a060', 24, 1.6, 0.35);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.renderOrder = 2;
  return m;
}

// Diyas on the kerb, the temple's platform, parapets and causeway; lanterns; strings of lights on the buildings;
// windows in the city. [x, y, z, colour]
function lightSpots(tier) {
  const out = [], diya = '#ffa63c', lamp = '#ffe6a8', step = tier ? 2.2 : 3.6;
  for (let x = -POOL.x; x <= POOL.x; x += step) out.push([x, 0.45, POOL.z0, diya], [x, 0.45, POOL.z1, diya]);
  for (let z = POOL.z0; z > POOL.z1; z -= step) for (const sx of [-1, 1]) out.push([sx * POOL.x, 0.45, z, diya]);
  const ring = (s, y, st) => { s *= K; y *= K; for (let t = -s; t < s; t += st) out.push([t, y, TZ + s, diya], [t + st, y, TZ - s, diya], [s, y, TZ + t + st, diya], [-s, y, TZ + t, diya]); };
  ring(11.35, 1.7, step * 0.6); ring(7.8, 8.95, step * 0.5); ring(7.7, 13.6, step * 0.5); ring(7.4, 14.35, step * 0.5);
  for (let x = -11.5 * K - 1; x > -POOL.x - 1; x -= step * 0.7) for (const sz of [-1, 1]) out.push([x, 1.55, TZ + sz * 2.9, diya]);
  for (const [x, z] of LAMPS) out.push([x, 4.05, z, lamp]);
  for (const [x, z] of sq(11.3 * K)) out.push([x, 3.85 * K, TZ + z, lamp]);
  for (let x = -11.5 * K - 4; x > -POOL.x; x -= 8) for (const sz of [-1, 1]) out.push([x, 3.7, TZ + sz * 2.9, lamp]);
  // Strings of festival lights along the buildings' parapets, and their lit windows.
  const rnd = mulberry(53), bulb = () => (rnd() < 0.7 ? '#ffd27a' : rnd() < 0.5 ? '#fff4d8' : '#ff8a3a');
  for (let z = 38; z > BZ; z -= step) for (const sx of [-1, 1]) out.push([sx * (BX - 0.2), 6.4, z, bulb()], [sx * (BX - 0.2), 3.2, z, bulb()]);
  for (let x = -BX; x < BX; x += step) out.push([x, 6.4, BZ + 0.2, bulb()], [x, 3.2, BZ + 0.2, bulb()]);
  for (const [x, z, w, h] of CITY) for (let i = 0; i < (tier ? 4 : 2); i++) out.push([x + (rnd() - 0.5) * w, 2 + rnd() * (h - 3), z + w / 2 + 0.3, rnd() < 0.8 ? '#ffd9a0' : '#ffffff']);
  for (let i = 0; i < (tier ? 90 : 45); i++) { const a = -1.2 + rnd() * 2.4, d = 600 + rnd() * 500; out.push([Math.sin(a) * d, 2 + rnd() * 10, -Math.cos(a) * d, rnd() < 0.8 ? '#ffd28a' : '#ffffff']); }
  if (tier) for (const z of [BZ + 30, BZ + 50]) out.push([BX + 20, 46.5, z, lamp]);
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const atlas = atlasTexture();
  const lit = new Builder();
  const temple = templeGeometry(new Builder(goldTint), lit, tier);
  const gold = temple.mesh(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, emissive: '#5a3008' }));
  const glow = lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const m of [gold, glow]) m.position.z = TZ;
  const objects = [gold, glow];
  if (tier) {
    // The reflection: the temple's lower parts mirrored below the water line, seen through the dark, translucent water.
    const mirror = new THREE.Mesh(templeGeometry(new Builder(goldTint), new Builder(), 0, true).geometry(), new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, color: '#c09060', emissive: '#3a1c04' }));
    mirror.scale.y = -1; mirror.position.set(0, W * 2, TZ);
    objects.push(mirror);
  }
  CITY.length = 0;
  const wlit = new Builder();
  const world = groundsGeometry(new Builder(), wlit, tier);
  objects.push(world.mesh(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, emissive: '#1c140c' })), wlit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })),
    waterMesh(tier), streakMesh(tier));
  // The white marble parikrama where crackers stand.
  const court = forecourt({ rgb: [236, 230, 218], z0: -40, z1: 20, width: POOL.x * 2, tile: 2, joint: 'rgba(150,130,110,0.4)', y: 2 * LAYER });
  court.material.color.setScalar(1.35); // white marble catches the glow more than the pavers elsewhere
  objects.push(court, rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's night: deep blue and starry overhead, a violet-blue glow low over the rooftops; no moon on Diwali.
    sky: ['#03061a', '#141a4c', '#3a3a86', '#8a6a92'],
    fog: ['#2a2a5c', 360, 1600],
    clouds: { colour: '#6a6aa8', count: tier ? 6 : 3, seed: 12 },
    moon: null, stars: tier ? 220 : 110,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    // Warm floodlights from your side of the pool; a cool sky light from behind.
    directional: [['#ffcf8a', 1.6, [-60, 40, 300]], ['#ffe0b0', 0.5, [160, 60, 120]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
