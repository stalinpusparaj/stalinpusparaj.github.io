/* Light Up the Skies — 3D background: the Brihadeeswarar Temple, Thanjavur, on Diwali night, seen across its great
   courtyard from the south-west, so the granite vimana stands to your left with its mandapams running away to your
   right towards the Nandi mandapam and the two east gopurams, and the long cloisters close the court round you. Loaded
   by world3d.js when Thanjavur is the chosen world. Its colours follow the game's 2D picture: a dark sky going violet
   and then orange at the horizon, the granite floodlit gold and amber from foot to cupola.

   Proportions follow published figures: the vimana stands on a square base about 30 m a side, a moulded plinth and two
   storeys of walls with deity niches to about 18 m, then a straight-sided pyramid of thirteen tiers, each a cornice
   lined with miniature shrines, to a square platform at about 58 m with paired Nandis at its corners, the neck and the
   great octagonal dome-shaped cupola, and the kalasa at 66 m. The ardha, maha and mukha mandapams run some 50 m east
   of it on the same plinth; the Nandi mandapam, a pillared pavilion over the monolithic bull, stands in front; the
   court, enclosed by a pillared cloister, is entered through the Rajarajan gopuram (three tiers, about 23 m) with the
   Keralantakan gopuram (five tiers, about 30 m) beyond it, both crowned by barrel-vaulted roofs. Everything is a box,
   an extruded outline or a lathe, merged into a few meshes with one drawn granite texture; the floodlit look is baked
   into vertex colours.

   Frame: +x to your right, +y up, +z towards you. The temple's local origin is the centre of the vimana at ground
   level, its front (east, the mandapams) along local +z, its north along local +x; place() turns it so its front runs
   away to your right and you look at its south side. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const TX = -35, TZ = -225, ROT = 2.05; // the vimana's centre and the temple's turn (its front runs away to your right)
const PH = 4.2; // the plinth (adhishthana): the floor of the sanctum and mandapams
const VB = 15; // half the vimana's base, to the face of its walls
const S1 = 10.6, S2 = 17.4; // the two storeys' cornices
const T0 = 18.4, TH = 3.04, TIERS = 13; // the pyramid: its first tier, each tier's height
const W0 = 13.6, W1 = 4.8; // the pyramid's half width at its foot and at its top
const NZ = 92; // the Nandi mandapam's centre (local z)
const CX0 = -262, CX1 = 70, CZ0 = -128, CZ1 = 140; // the cloistered court (local)
const GZ2 = 196; // the outer (Keralantakan) gopuram

// ---------- Carved granite: courses, pilasters and niches, friezes of yalis, one tile per 4 m ----------
function graniteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(23), px = 64; // pixels per metre
  g.fillStyle = '#f2dcb6'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * px * 0.5;
    // Ashlar courses: long blocks, each a shade apart.
    let x = -rnd() * 50;
    while (x < 256) {
      const w = (0.9 + rnd() * 1.1) * px, v = 0.9 + rnd() * 0.1;
      g.fillStyle = `rgb(${(242 * v) | 0},${(220 * v) | 0},${(182 * v) | 0})`; g.fillRect(x + 1, y + 1, w - 2, px * 0.5 - 2);
      x += w;
    }
    if (row % 4 === 1) {
      // A frieze of little figures.
      for (let k = (row % 3) * 5; k < 256; k += 14) {
        g.fillStyle = 'rgba(70,42,20,0.45)'; g.fillRect(k + 2, y + 6, 9, 22);
        g.fillStyle = 'rgba(250,232,200,0.7)'; g.fillRect(k + 4.5, y + 9, 4, 4); g.fillRect(k + 4, y + 13, 5, 12);
      }
    }
    g.fillStyle = 'rgba(80,48,24,0.45)'; g.fillRect(0, y, 256, 1.6); // the course's shadow
  }
  // Pilasters: pale shafts with dark edges.
  for (const x of [20, 148]) {
    g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(x, 0, 14, 256);
    g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(x - 2, 0, 2, 256); g.fillRect(x + 14, 0, 2, 256);
  }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(80,52,28,${rnd() * 0.12})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a vertex colour (in world space). frame, when set, places everything added (the
// temple, a cloister) in the world.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) {
    this.set = { pos: [], nor: [], uv: [], col: [] };
    this.colour = colour; this.frame = null;
  }
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
  lathe(profile, x, y, z, seg, color, phi = 0) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg, phi), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color, sx = 1, sz = 1) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  // A beam w x h in section from point a to point b.
  beam(a, b, w, h, color) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, len, h), color, m);
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
const FRAME = new THREE.Matrix4().makeRotationY(ROT).setPosition(TX, 0, TZ);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// A point of the temple's local frame, in the world; and a world point (x, z) in the local frame.
const world = (x, y, z) => V(x, y, z).applyMatrix4(FRAME);
const cosR = Math.cos(ROT), sinR = Math.sin(ROT);
const local = (x, z) => [(x - TX) * cosR - (z - TZ) * sinR, (x - TX) * sinR + (z - TZ) * cosR];

// The floodlit gold of the 2D picture, by height: brightest on the plinth and the walls where the floods graze up,
// gold up the pyramid, deeper amber towards the cupola; tops of cornices a little darker than their lit faces.
const BANDS = [[0.6, '#a06a3a', '#e0a058'], [PH + 1, '#ffd690', '#ffcc80'], [S2 + 1, '#ffc87a', '#f8b868'], [36, '#f6b060', '#e89a50'], [56, '#e49450', '#d08042'], [99, '#d88a48', '#c47a40']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color();
function templeColour(x, y, z, n, base) {
  let lo = 0, c = null;
  for (const [top, a, b] of BANDS) {
    if (y < top) { c = tmpCol.copy(a).lerp(b, clamp((y - lo) / (top - lo), 0, 1)); break; }
    lo = top;
  }
  if (!c) c = tmpCol.copy(BANDS[BANDS.length - 1][2]);
  c.multiply(base);
  return n.y > 0.7 ? c.multiplyScalar(0.8) : c;
}

// A ring of miniature shrines (the hara) along the edges of a rectangle (half hx by hz round cx, cz) from y, h high:
// square kutas at the corners, oblong salas between, about every gap metres.
function hara(s, cx, cz, hx, hz, y, h, gap, d, caps, col) {
  for (const [half, other, along] of [[hx, hz, 'x'], [hz, hx, 'z']]) {
    const n = Math.max(2, Math.round((2 * half) / gap)), w = ((2 * half) / n) * 0.72;
    for (let k = 0; k < n; k++) {
      const u = -half + ((k + 0.5) * 2 * half) / n;
      for (const sv of [-1, 1]) {
        const v = sv * (other - d / 2);
        if (along === 'x') s.box(cx + u - w / 2, cx + u + w / 2, y, y + h, cz + v - d / 2, cz + v + d / 2, col);
        else s.box(cx + v - d / 2, cx + v + d / 2, y, y + h, cz + u - w / 2, cz + u + w / 2, col);
        // Its little roof: a narrower cap.
        if (caps) {
          if (along === 'x') s.box(cx + u - w * 0.3, cx + u + w * 0.3, y + h, y + h * 1.35, cz + v - d * 0.3, cz + v + d * 0.3, col);
          else s.box(cx + v - d * 0.3, cx + v + d * 0.3, y + h, y + h * 1.35, cz + u - w * 0.3, cz + u + w * 0.3, col);
        }
      }
    }
  }
}

// Walls of a storey (half hx by hz round cx, cz, from y0 to y1) set with deity niches and pilasters every gap metres;
// skip names a face left plain (where a mandapam joins).
function niches(s, cx, cz, hx, hz, y0, y1, gap, tier, skip = '') {
  const shade = '#4a3020', stone = '#ffffff';
  for (const [half, other, along, faces] of [[hx, hz, 'x', ['-z', '+z']], [hz, hx, 'z', ['-x', '+x']]]) {
    const n = Math.max(1, Math.round((2 * half) / gap));
    for (const [sv, face] of [[-1, faces[0]], [1, faces[1]]]) {
      if (skip.includes(face)) continue;
      for (let k = 0; k < n; k++) {
        const u = -half + ((k + 0.5) * 2 * half) / n, w = Math.min(1.6, (2 * half) / n * 0.4), v = sv * other;
        const put = (a, b, ya, yb, o0, o1, col) => (along === 'x' ? s.box(cx + u + a, cx + u + b, ya, yb, cz + v + sv * o0, cz + v + sv * o1, col) : s.box(cx + v + sv * o0, cx + v + sv * o1, ya, yb, cz + u + a, cz + u + b, col));
        const yn = y0 + (y1 - y0) * 0.14, ym = y1 - (y1 - y0) * 0.16;
        put(-w / 2, w / 2, yn, ym, 0, 0.25, shade); // the niche, deep in shadow
        if (tier > 1) put(-w * 0.22, w * 0.22, yn + 0.2, ym - 0.6, 0.1, 0.45, stone); // the deity in it
        put(-w / 2 - 0.25, w / 2 + 0.25, ym, ym + 0.5, 0, 0.5, stone); // its little canopy
        if (k < n - 1) put((2 * half) / n / 2 - 0.3, (2 * half) / n / 2 + 0.3, y0, y1, 0, 0.35, stone); // a pilaster
      }
    }
  }
}

// A gopuram on the axis at local z cz: a granite base with the gateway through it, then tiers of brick and stucco
// stepping in, each lined with shrines, and the barrel-vaulted roof with its row of kalasas.
function gopuram(s, cz, hx, hz, bh, tiers, th, tier) {
  const stone = '#ffffff', shade = '#4a3020', deep = '#2a1a10';
  s.box(-hx - 0.8, hx + 0.8, 0, 1.4, cz - hz - 0.8, cz + hz + 0.8, stone);
  for (const sx of [-1, 1]) s.box(sx * 3, sx * hx, 1.4, bh, cz - hz, cz + hz, stone);
  s.box(-3, 3, bh - 3.4, bh, cz - hz, cz + hz, stone); // the lintel over the gateway
  s.box(-3, 3, 0, bh - 3.4, cz - hz + 0.6, cz + hz - 0.6, deep); // the passage
  niches(s, 0, cz, hx, hz, 1.4, bh, tier > 1 ? 6.5 : 9, tier, '');
  s.box(-hx - 0.7, hx + 0.7, bh, bh + 0.8, cz - hz - 0.7, cz + hz + 0.7, stone); // the cornice
  let y = bh + 0.8;
  for (let i = 0; i < tiers; i++) {
    const wx = hx * (1 - (i / tiers) * 0.38) - 0.6, wz = hz * (1 - (i / tiers) * 0.5) - 0.6;
    s.box(-wx, wx, y, y + th * 0.6, cz - wz, cz + wz, stone);
    s.box(-wx - 0.4, wx + 0.4, y + th * 0.45, y + th * 0.62, cz - wz - 0.4, cz + wz + 0.4, stone); // its cornice
    s.box(-wx + 0.6, wx - 0.6, y + th * 0.6, y + th, cz - wz + 0.6, cz + wz - 0.6, shade);
    hara(s, 0, cz, wx, wz, y + th * 0.62, th * 0.38, tier > 1 ? 4.6 : 7, 0.9, false, stone);
    y += th;
  }
  // The barrel vault, its gable ends, the kalasas along its ridge.
  const vx = hx * 0.6, vr = hz * 0.5;
  s.box(-vx, vx, y, y + 0.6, cz - vr - 0.3, cz + vr + 0.3, stone);
  s.add(new THREE.CylinderGeometry(vr, vr, 2 * vx, tier ? 10 : 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), stone, at(0, y + 0.6, cz));
  const k = tier ? 7 : 5;
  for (let i = 0; i < k; i++) s.lathe([[0.32, 0], [0.42, 0.4], [0.2, 0.8], [0.06, 1.4], [0, 1.5]], -vx + 0.8 + (i * (2 * vx - 1.6)) / (k - 1), y + 0.6 + vr - 0.1, cz, tier > 1 ? 6 : 4, '#ffe0a0');
  return y + 0.6 + vr;
}

// One stretch of the cloister (the maalika): its outer wall, the raised verandah floor, a row of pillars, the flat roof
// and its parapet of little shrines. The stretch runs along `axis` from a0 to a1 at `fixed`; `inward` points into the court.
function cloister(s, axis, fixed, a0, a1, inward, tier) {
  const stone = '#ffffff', shade = '#4a3020';
  const B = (u0, u1, y0, y1, v0, v1, col) => (axis === 'z' ? s.box(fixed + inward * v0, fixed + inward * v1, y0, y1, u0, u1, col) : s.box(u0, u1, y0, y1, fixed + inward * v0, fixed + inward * v1, col));
  B(a0, a1, 0, 7.4, -0.7, 0.6, stone); // the outer wall
  B(a0, a1, 1.1, 6.2, 0.6, 0.7, shade); // the dim verandah inside
  B(a0, a1, 0, 1.1, 0.6, 8.2, stone); // its floor
  B(a0, a1, 6.2, 7, -0.7, 8.6, stone); // the roof
  const sp = tier > 1 ? 9 : tier ? 11 : 15;
  for (let u = a0 + sp / 2; u < a1; u += sp) {
    B(u - 0.35, u + 0.35, 1.1, 6.2, 7.2, 7.9, stone);
    if (tier > 1) B(u - 0.7, u + 0.7, 7, 7.9, 7.6, 8.5, stone); // a shrine on the parapet
  }
}

// The temple, in its own frame: the vimana, the mandapams, the Nandi mandapam, the gopurams and the cloisters.
function templeGeometry(s, tier) {
  const stone = '#ffffff', shade = '#4a3020', deep = '#2a1a10', nandi = '#5a4c44';
  s.frame = FRAME;
  // ---- The plinth under the vimana and the mandapams: mouldings stepping in ----
  const front = 66; // the mukha mandapam's front
  s.box(-VB - 1.6, VB + 1.6, 0, 0.8, -VB - 1.6, VB + 1.6, stone).box(-VB - 1.2, VB + 1.2, 0.8, 2, -VB - 1.2, VB + 1.2, stone);
  s.box(-VB - 0.8, VB + 0.8, 2, 3.2, -VB - 0.8, VB + 0.8, shade).box(-VB - 1.1, VB + 1.1, 3.2, PH, -VB - 1.1, VB + 1.1, stone);
  s.box(-13.2, 13.2, 0, 0.8, VB, front + 0.8, stone).box(-12.8, 12.8, 0.8, 2, VB, front + 0.4, stone);
  s.box(-12.4, 12.4, 2, 3.2, VB, front, shade).box(-12.7, 12.7, 3.2, PH, VB, front + 0.3, stone);
  // ---- The vimana's two storeys: walls with projections, niches, the cornices ----
  s.box(-VB, VB, PH, S2, -VB, VB, stone);
  for (const [w, d] of [[4.6, 1.1], [10, 0.5]]) s.box(-w, w, PH, S2, -VB - d, VB + d, stone).box(-VB - d, VB + d, PH, S2, -w, w, stone);
  niches(s, 0, 0, VB + 1.1, VB + 1.1, PH, S1, tier > 1 ? 5.4 : 7, tier, '+z');
  niches(s, 0, 0, VB + 1.1, VB + 1.1, S1 + 0.9, S2, tier > 1 ? 5.4 : 7, tier, '+z');
  s.box(-VB - 1.6, VB + 1.6, S1, S1 + 0.9, -VB - 1.6, VB + 1.6, stone); // the first cornice
  s.box(-VB - 1.8, VB + 1.8, S2, S2 + 1, -VB - 1.8, VB + 1.8, stone); // the second
  hara(s, 0, 0, VB + 0.6, VB + 0.6, S2 + 1, 1.3, tier > 1 ? 3.6 : 6, 1.1, false, stone);
  // ---- The pyramid: thirteen tiers stepping in, each a cornice with its shrines, a projection on every face ----
  let y = T0;
  for (let i = 0; i < TIERS; i++) {
    const w = W0 + ((W1 - W0) * i) / (TIERS - 1);
    s.box(-w, w, y, y + TH * 0.5, -w, w, stone);
    s.box(-w - 0.35, w + 0.35, y + TH * 0.38, y + TH * 0.56, -w - 0.35, w + 0.35, stone); // the cornice
    const p = w * 0.3; // the central projection, one above another up each face
    s.box(-p, p, y, y + TH * 0.56, -w - 0.7, w + 0.7, stone).box(-w - 0.7, w + 0.7, y, y + TH * 0.56, -p, p, stone);
    s.box(-w + 0.5, w - 0.5, y + TH * 0.56, y + TH, -w + 0.5, w - 0.5, shade); // the recess under the next
    hara(s, 0, 0, w - 0.1, w - 0.1, y + TH * 0.56, TH * 0.34, tier > 1 ? 3.3 : tier ? 4.2 : 6, 0.9, false, stone);
    y += TH;
  }
  // ---- The crown: the platform with paired Nandis at its corners, the neck, the octagonal cupola, the kalasa ----
  s.box(-W1 - 1, W1 + 1, y, y + 0.8, -W1 - 1, W1 + 1, stone);
  y += 0.8;
  for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const x = cx * (W1 + 0.2), z = cz * (W1 + 0.2);
    s.box(x - 0.6, x + 0.6, y, y + 1.1, z - 0.6, z + 0.6, stone).box(x - 0.35, x + 0.35, y + 1.1, y + 1.6, z - 0.35, z + 0.35, stone);
  }
  const seg = 8, phi = Math.PI / 8; // an octagon, its faces square to the temple
  s.lathe([[3.8, 0], [4, 0.3], [3.8, 0.5], [3.8, 1.5], [4.5, 1.8]], 0, y, 0, seg, stone, phi);
  y += 1.8;
  s.lathe([[4.5, 0], [5.3, 0.6], [5.5, 1.5], [5.1, 2.6], [4, 3.5], [2.1, 4.1], [0.6, 4.3], [0, 4.3]], 0, y, 0, seg, stone, phi);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { // the four arched dormers (nasikas) on the cupola
    const x = dx * 5.1, z = dz * 5.1;
    s.box(x - (dz ? 1 : 0.5), x + (dz ? 1 : 0.5), y + 0.2, y + 2.6, z - (dx ? 1 : 0.5), z + (dx ? 1 : 0.5), stone);
    s.box(x - (dz ? 0.6 : 0.55), x + (dz ? 0.6 : 0.55), y + 0.5, y + 2, z - (dx ? 0.6 : 0.55), z + (dx ? 0.6 : 0.55), shade);
  }
  y += 4.3;
  s.lathe([[0.7, 0], [0.9, 0.3], [0.6, 0.7], [0.35, 0.9], [0.5, 1.2], [0.15, 2], [0, 2.1]], 0, y - 0.1, 0, tier ? 10 : 6, '#ffe2a0');
  // ---- The mandapams: ardha, maha (with its raised clerestory) and mukha, two storeys of niches ----
  const halls = [[15, 26, 10.5, 15.4], [26, 52, 13, 13.2], [52, front, 10, 10.8]];
  for (const [z0, z1, h, top] of halls) {
    s.box(-h, h, PH, top, z0, z1, stone);
    s.box(-h - 0.8, h + 0.8, top, top + 0.7, z0 - (z0 > 15 ? 0 : 0), z1 + 0.6, stone); // the roof's cornice
    niches(s, 0, (z0 + z1) / 2, h, (z1 - z0) / 2, PH, top, tier > 1 ? 5.5 : 8, tier, z1 === front ? '-z' : '-z+z');
    hara(s, 0, (z0 + z1) / 2, h + 0.3, (z1 - z0) / 2 + 0.2, top + 0.7, 1.1, tier > 1 ? 4.2 : 7, 0.9, false, stone);
  }
  s.box(-7, 7, 13.9, 18.4, 30, 48, stone).box(-7.6, 7.6, 18.4, 19, 29.4, 48.6, stone); // the clerestory
  hara(s, 0, 39, 7.2, 9.2, 19, 1, tier > 1 ? 4.2 : 7, 0.8, false, stone);
  // The entrances: a dark doorway at the front and stairs up the sides of the mukha mandapam, and up the front.
  s.box(-2.2, 2.2, PH, PH + 4.6, front, front + 0.3, deep);
  for (const sx of [-1, 1]) s.box(sx * 10, sx * 10.3, PH, PH + 4.2, 55, 61, deep);
  const steps = Math.ceil(PH / 0.35);
  for (let i = 0; i < steps; i++) {
    s.box(-3.6, 3.6, 0, PH - (i * PH) / steps, front, front + 0.8 + (i + 1) * 0.5, stone);
    for (const sx of [-1, 1]) s.box(sx * 12.7, sx * (12.7 + 0.8 + (i + 1) * 0.5), 0, PH - (i * PH) / steps, 55.5, 60.5, stone);
  }
  for (const sx of [-1, 1]) s.box(sx * 3.6, sx * 4.6, 0, PH + 1.2, front, front + 0.8 + steps * 0.5, stone); // the stair's balustrades
  // ---- The Nandi mandapam: a platform, pillars, the flat roof and its parapet, the great bull under it ----
  const NX = 8.5, NL = 9.5, NP = 2.1, NR = 9.6;
  s.box(-NX - 0.8, NX + 0.8, 0, NP, NZ - NL - 0.8, NZ + NL + 0.8, stone);
  for (let i = 0; i < 6; i++) s.box(-3, 3, 0, NP - i * 0.35, NZ + NL + 0.8, NZ + NL + 0.8 + (i + 1) * 0.45, stone);
  const cols = tier ? [-NX + 0.8, -2.8, 2.8, NX - 0.8] : [-NX + 0.8, NX - 0.8];
  const rows = [NZ - NL + 0.8, NZ - NL / 3, NZ + NL / 3, NZ + NL - 0.8];
  for (const px of cols) for (const pz of rows) {
    if (Math.abs(px) < 3 && Math.abs(pz - NZ) < 4) continue; // the bull's place
    s.box(px - 0.5, px + 0.5, NP, NP + 0.6, pz - 0.5, pz + 0.5, stone).box(px - 0.38, px + 0.38, NP + 0.6, NR - 0.8, pz - 0.38, pz + 0.38, stone);
    s.box(px - 0.6, px + 0.6, NR - 0.8, NR, pz - 0.6, pz + 0.6, stone); // its bracket capital
  }
  s.box(-NX - 1.2, NX + 1.2, NR, NR + 0.9, NZ - NL - 1.2, NZ + NL + 1.2, stone);
  s.box(-NX - 0.6, NX + 0.6, NR + 0.9, NR + 1.5, NZ - NL - 0.6, NZ + NL + 0.6, stone);
  hara(s, 0, NZ, NX + 0.3, NL + 0.3, NR + 1.5, 1.1, tier > 1 ? 3.2 : 6, 0.9, false, stone);
  // Nandi, couched, facing the sanctum (-z): his pedestal, body, hump, head and horns, folded legs.
  s.box(-1.9, 1.9, NP, NP + 0.9, NZ - 3.8, NZ + 3.4, stone);
  const ny = NP + 0.9;
  s.box(-1.35, 1.35, ny, ny + 2.3, NZ - 1.4, NZ + 3, nandi);
  s.box(-1.1, 1.1, ny + 2.1, ny + 3, NZ - 1, NZ + 0.6, nandi); // the hump
  s.beam(V(0, ny + 1.6, NZ - 1.2), V(0, ny + 2.8, NZ - 2.6), 1.3, 1.5, nandi); // the neck
  s.box(-0.7, 0.7, ny + 1.6, ny + 3.5, NZ - 3.5, NZ - 2.3, nandi); // the head
  for (const sx of [-1, 1]) {
    s.beam(V(sx * 0.5, ny + 3.4, NZ - 2.8), V(sx * 0.95, ny + 4.1, NZ - 2.6), 0.22, 0.22, nandi); // a horn
    s.box(sx * 0.5, sx * 1.45, ny, ny + 0.7, NZ - 2.4, NZ - 1, nandi); // a folded foreleg
  }
  // ---- The gopurams on the axis to the east: the Rajarajan in the cloister, the Keralantakan beyond ----
  gopuram(s, CZ1, 14, 7.5, 9.5, 3, 4.2, tier);
  gopuram(s, GZ2, 17.5, 9, 11, 5, 3.6, tier);
  // ---- The cloisters round the court, open towards it; the east side meets the Rajarajan gopuram ----
  cloister(s, 'z', CX0, CZ0, CZ1, 1, tier);
  cloister(s, 'z', CX1, CZ0, CZ1, -1, tier);
  cloister(s, 'x', CZ0, CX0, CX1, 1, tier);
  cloister(s, 'x', CZ1, CX0, -14, -1, tier);
  cloister(s, 'x', CZ1, 14, CX1, -1, tier);
  // The outer court's wall, from the Rajarajan to the Keralantakan.
  for (const sx of [-1, 1]) s.box(sx * 17.5, sx * 70, 0, 6, GZ2 - 0.7, GZ2 + 0.7, stone).box(sx * 70, sx * 71.4, 0, 6, CZ1, GZ2 + 0.7, stone);
  if (tier) { // the little shrines in the court: Chandikeshvara's to the north, a Ganesha shrine to the south-west
    for (const [x, z, w, h] of [[22, 22, 4, 6.5], [-40, -70, 5, 8]]) {
      s.box(x - w - 0.5, x + w + 0.5, 0, 1.2, z - w - 0.5, z + w + 0.5, stone).box(x - w, x + w, 1.2, h, z - w, z + w, stone);
      s.box(x - w - 0.4, x + w + 0.4, h, h + 0.5, z - w - 0.4, z + w + 0.4, stone);
      s.lathe([[w * 0.7, 0], [w * 0.8, 0.6], [w * 0.6, 1.6], [0.3, 2.4], [0, 2.6]], x, h + 0.5, z, 8, stone, Math.PI / 8);
    }
  }
  s.frame = null;
  return s;
}

// Everything round the temple: the ground, the lawns of the court and its granite paving, lamps, floods, trees.
function groundsGeometry(s, lit, tier) {
  const L1 = LAYER, warmLawn = new THREE.Color('#5a5426'), warmStone = new THREE.Color('#e8a868');
  const nm = world(0, 0, NZ), mid = world(0, 0, 35);
  // The floods warm the ground round the temple.
  s.colour = (x, y, z, n, base) => {
    if (n.y < 0.9 || y > 0.4) return base;
    const d = Math.min(Math.hypot(x - mid.x, z - mid.z) - 25, Math.hypot(x - nm.x, z - nm.z));
    const w = clamp(1 - d / 110, 0, 1) ** 1.2;
    return tmpCol.copy(base).lerp(y > 1.5 * L1 ? warmStone : warmLawn, w * 0.7);
  };
  s.plane(-900, 900, -900, 300, 0, '#100e0c');
  s.frame = FRAME;
  s.plane(CX0, CX1, CZ0, CZ1, L1, '#22381f', tier ? 20 : 10, tier ? 16 : 8); // the court's lawns
  s.plane(-38, 38, -36, 108, 2 * L1, '#5a4c3e', tier ? 8 : 4, tier ? 14 : 7); // the granite paving round the temple
  s.frame = null;
  s.colour = null;
  // Clipped hedges along the forecourt.
  for (const sx of [-1, 1]) s.box(sx * 13.2, sx * 14.2, 0, 0.8, -46, 18, '#20381f');
  // Lamp standards: a dark post and a lantern.
  for (const [x, z] of LAMPS) { s.cyl(0.14, 0.09, 0, 4.2, x, z, 6, '#16140f'); lit.box(x - 0.24, x + 0.24, 4.2, 4.8, z - 0.24, z + 0.24, '#ffe0a0'); }
  // Ground floodlights round the temple: low boxes.
  for (const [x, z] of FLOODS) s.box(x - 0.5, x + 0.5, 0, 0.5, z - 0.5, z + 0.5, '#24201c');
  // Trees: rain trees and neem in the court, coconut palms rising over the cloisters outside.
  const rnd = mulberry(19);
  const inCourt = (x, z, m) => { const [lx, lz] = local(x, z); return lx > CX0 + m && lx < CX1 - m && lz > CZ0 + m && lz < CZ1 - m && !(Math.abs(lx) < 48 && lz > -45 && lz < 115); };
  const roundTree = (x, z, r = 4.5, fine = false) => {
    r *= 0.8 + rnd() * 0.4;
    s.add(new THREE.IcosahedronGeometry(r, fine && tier > 1 ? 1 : 0), rnd() < 0.5 ? '#13241a' : '#1b3020', at(x, r + 2.4, z));
    s.cyl(0.35, 0.25, 0, r + 1.5, x, z, 5, '#2a1e16');
  };
  const palm = (x, z) => {
    const h = 13 + rnd() * 7, lean = (rnd() - 0.5) * 2, k = 4;
    s.beam(V(x, 0, z), V(x + lean, h, z), 0.45, 0.45, '#3a2a1c');
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rnd();
      s.beam(V(x + lean, h, z), V(x + lean + Math.cos(a) * 4, h - 1.6, z + Math.sin(a) * 4), 1, 0.12, '#1c3220');
    }
  };
  for (let z = 14; z > -40; z -= tier ? 11 : 22) { roundTree(-25, z, 3.2, tier > 1 && z > 0); roundTree(25, z - 5, 3.2, tier > 1 && z > 0); }
  for (let i = 0; i < (tier ? 16 : 8); i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (28 + rnd() * 70), z = -120 + rnd() * 135;
    if (inCourt(x, z, 12)) roundTree(x, z, 4.6);
  }
  // Palms outside the cloisters, all round the court.
  const P = tier > 1 ? 17 : tier ? 22 : 34;
  const outside = [];
  for (let u = CZ0; u < CZ1 + 60; u += P) outside.push([CX0 - 12 - rnd() * 14, u], [CX1 + 12 + rnd() * 14, u]);
  for (let u = CX0; u < CX1; u += P) { outside.push([u, CZ0 - 12 - rnd() * 14]); if (u < -80 || u > 30) outside.push([u, CZ1 + 12 + rnd() * 30]); }
  for (const [lx, lz] of outside) { const v = world(lx, 0, lz); if (v.z < 10) palm(v.x, v.z); } // not those behind you
  // The far tree line, so the horizon is never bare.
  for (let i = 0; i < (tier ? 46 : 22); i++) {
    const a = -1.6 + (i / (tier ? 46 : 22)) * 3.2, d = 470 + rnd() * 80;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d - 60, r = 11 + rnd() * 8;
    s.add(new THREE.IcosahedronGeometry(r, 0), '#101c14', at(x, r * 0.8, z));
  }
  return s;
}
const LAMPS = [];
for (let z = 14; z > -46; z -= 15) for (const sx of [-1, 1]) LAMPS.push([sx * 15.4, z]);
for (const [lx, lz] of [[-60, -20], [-60, 30], [-60, 80], [-120, 0], [-120, 60], [-180, -40], [-180, 40], [-180, 110]]) { const v = world(lx, 0, lz); LAMPS.push([v.x, v.z]); }
const FLOODS = [];
for (const [lx, lz] of [[-30, -10], [-30, 20], [-26, 45], [-24, 70], [-16, 92], [0, 112], [12, 112], [-14, -26], [14, -26], [-22, 150], [22, 150]]) { const v = world(lx, 0, lz); FLOODS.push([v.x, v.z]); }

// Diyas along the forecourt, the plinth, the cloister roofs and the Nandi mandapam; lamps, floods; far town lights.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  const put = (x, y, z, col) => { const v = world(x, y, z); out.push([v.x, v.y, v.z, col]); };
  for (const sx of [-1, 1]) for (let z = 18; z > -48; z -= step) out.push([sx * 12.4, 0.3, z, diya]);
  // The plinth's edge round the vimana and along the mandapams.
  for (let u = -VB - 1; u <= VB + 1; u += step * 0.9) { put(-VB - 1.3, PH + 0.12, u, diya); put(u, PH + 0.12, -VB - 1.3, diya); put(VB + 1.3, PH + 0.12, u, diya); }
  for (let z = VB + 2; z < 66; z += step * 0.9) for (const sx of [-1, 1]) put(sx * 12.9, PH + 0.12, z, diya);
  for (let u = -VB - 1; u <= VB + 1; u += step * 1.4) for (const sx of [-1, 1]) { put(sx * (VB + 1.9), S2 + 1.05, u, diya); put(u, S2 + 1.05, sx * (VB + 1.9), diya); }
  // The cloister roofs' inner edges.
  const cs = step * 2.2;
  for (let u = CZ0; u < CZ1; u += cs) { put(CX0 + 8.7, 7.1, u, diya); put(CX1 - 8.7, 7.1, u, diya); }
  for (let u = CX0; u < CX1; u += cs) { put(u, 7.1, CZ0 + 8.7, diya); if (Math.abs(u) > 15) put(u, 7.1, CZ1 - 8.7, diya); }
  // The Nandi mandapam's roof and platform.
  for (let u = -9; u <= 9; u += step * 0.8) { put(u, 10.6, NZ + 10.9, diya); put(u, 10.6, NZ - 10.9, diya); put(u, 2.2, NZ + 10.4, diya); }
  for (let u = NZ - 10; u <= NZ + 10; u += step * 0.8) for (const sx of [-1, 1]) put(sx * 9.8, 10.6, u, diya);
  // The gopurams' gateways, lit within.
  for (const cz of [CZ1, GZ2]) for (const sz of [-1, 1]) for (const sx of [-1, 1]) put(sx * 2.4, 3.5, cz + sz * 8, '#ffcf80');
  for (const [x, z] of LAMPS) out.push([x, 4.5, z, lamp]);
  for (const [x, z] of FLOODS) out.push([x, 0.6, z, '#fff2c8']);
  put(0, 67.2, 0, '#ffd27a'); // a lamp on the kalasa
  // Thanjavur's lights through the palms, far off.
  const rnd = mulberry(71);
  for (let i = 0; i < (tier ? 80 : 40); i++) { const a = -1.3 + rnd() * 2.6, d = 420 + rnd() * 300; out.push([Math.sin(a) * d, 1 + rnd() * 8, -Math.cos(a) * d - 60, rnd() < 0.8 ? '#ffd28a' : '#ffffff']); }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = graniteTexture();
  const temple = templeGeometry(new Stone(templeColour), tier);
  const lit = new Stone();
  const grounds = groundsGeometry(new Stone(), lit, tier);
  const objects = [
    temple.mesh(new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a2810' })),
    grounds.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })),
    lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  // The forecourt where crackers stand: granite flags.
  objects.push(forecourt({ rgb: [104, 88, 74], z0: -40, z1: 20, width: 24, tile: 2, joint: 'rgba(200,170,140,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's evening, darkened: deep blue overhead, violet lower down, an orange glow at the horizon.
    sky: ['#03061a', '#16194a', '#6a3a6a', '#e07a40'],
    fog: ['#4e3058', 340, 1600],
    clouds: { colour: '#c0708a', count: tier ? 9 : 5, seed: 41 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.75, [-40, 25, 300]], ['#ffe0b8', 0.45, [150, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
