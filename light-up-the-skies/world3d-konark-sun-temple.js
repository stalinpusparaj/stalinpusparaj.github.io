/* Light Up the Skies — 3D background: the Konark Sun Temple on Diwali night, the Sun god's stone chariot seen across
   the lawns from the east, a little to its north, so its front stairs, the horses and the long side with its great
   wheels all show, and the roofless Nata Mandir stands in front of it to your right. Loaded by world3d.js when Konark
   is the chosen world. Its colours follow the game's 2D Konark picture: a dark sky going violet and then orange at the
   horizon, the sandstone floodlit gold and amber, the wheels standing out against their shadowed recesses.

   Proportions follow published figures: the chariot's plinth about 4 m high and some 30 m wide, carrying twelve pairs
   of carved wheels about 3 m across; the jagamohana (the porch, the part still standing) about 24 m square on its own
   moulded base, walls to 14 m, then a stepped pyramidal roof in three tiers of slabs with sculpture terraces between,
   crowned by the ribbed amalaka and kalasa at about 31 m; the sanctum tower behind it long fallen, its base a broken
   ruin. Seven horses stand at the front stairs; the Nata Mandir, the dance hall, is a carved platform about 5 m high
   with its pillars broken off, guarded by lions on elephants. Everything is a box, an extruded outline or a lathe,
   merged into a few meshes with one drawn carved-stone texture; the floodlit look is baked into vertex colours.

   Frame: +x to your right, +y up, +z towards you. The temple's local origin is the centre of the jagamohana at
   ground level, its front (east, the stairs) along local +z; place() turns it to face you three-quarters on. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const TX = -3, TZ = -108, ROT = 0.95; // the jagamohana's centre and the temple's turn (its front faces right of you)
const PH = 5.2; // the chariot's plinth: its deck
const PW = 15; // half its width, to the face of the piers between the wheels
const WR = 2.1, WY = 2.55; // the wheels: radius, axle height
const WHEELS = Array.from({ length: 12 }, (_, i) => 12.6 - i * 6.2); // the wheel centres along the chariot (local z)
const NZ = 42; // the Nata Mandir's centre, in front of the stairs (local z)
const NH = 5.2; // its platform's height

// ---------- Carved khondalite: mouldings, friezes of little figures and scrolls, one tile per 4 m ----------
function carvedTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(31), px = 64; // pixels per metre
  g.fillStyle = '#f0dcbc'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * px * 0.5;
    if (row % 2 === 0) {
      // A frieze of niches with figures in them.
      for (let x = (row % 4) * 4; x < 256; x += 16) {
        g.fillStyle = 'rgba(70,40,20,0.5)'; g.fillRect(x + 2, y + 5, 11, 24);
        g.fillStyle = 'rgba(250,230,200,0.75)'; g.fillRect(x + 5, y + 9, 5, 4); g.fillRect(x + 4.5, y + 13, 6, 12);
      }
    } else {
      // Scrollwork: little rosettes and leaves.
      for (let x = 8; x < 256; x += 21) {
        g.strokeStyle = 'rgba(80,48,24,0.45)'; g.lineWidth = 2;
        g.beginPath(); g.arc(x + (row % 3) * 5, y + 16, 6 + rnd() * 2, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(x - 6, y + 26); g.quadraticCurveTo(x + 4, y + 4, x + 16, y + 26); g.stroke();
      }
    }
    g.fillStyle = 'rgba(70,42,22,0.5)'; g.fillRect(0, y, 256, 2); // the moulding's shadow
    g.fillStyle = 'rgba(255,240,215,0.5)'; g.fillRect(0, y + 2, 256, 1.5);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(90,58,30,${rnd() * 0.12})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base, set) gives a vertex colour (in world space); force sends what is added to the second,
// unlit set. frame, when set, places everything added (the temple, a tree) in the world.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) {
    this.sets = [{ pos: [], nor: [], uv: [], col: [] }, { pos: [], nor: [], uv: [], col: [] }];
    this.colour = colour; this.frame = null; this.force = null;
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
        set.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = this.colour ? this.colour(v.x, v.y, v.z, tmpN, base, si) : base;
        set.col.push(c.r, c.g, c.b);
      }
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color) { return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); }
  lathe(profile, x, y, z, seg, color) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color, sx = 1, sz = 1) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
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
const FRAME = place(TX, TZ, ROT);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// A point of the temple's local frame, in the world.
const world = (x, y, z) => V(x, y, z).applyMatrix4(FRAME);

// The floodlit gold of the 2D picture, by height: brightest on the plinth and wheels where the floods graze up,
// amber up the roof, deeper towards the crown; tops of slabs a little darker than their lit faces.
const BANDS = [[0.6, '#a06a3a', '#e0a560'], [PH + 1.5, '#ffd690', '#ffcc80'], [PH + 10.5, '#ffc477', '#f2ae62'], [PH + 20, '#f0a458', '#d88a48'], [99, '#d08646', '#b87040']]
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

// One wheel in its own frame: in the x-y plane round the axle, its face towards +z; m puts it on the chariot.
function wheel(s, m, tier, stone) {
  const seg = tier ? 18 : 10, rim = new THREE.Shape().absarc(0, 0, WR, 0, Math.PI * 2, false);
  rim.holes.push(new THREE.Path().absarc(0, 0, WR - 0.24, 0, Math.PI * 2, true));
  s.add(new THREE.ExtrudeGeometry(rim, { depth: 0.36, bevelEnabled: false, curveSegments: seg }), stone, m);
  const spokes = tier > 1 ? 12 : tier ? 8 : 6;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2, thick = tier > 1 ? (i % 2 ? 0.09 : 0.17) : 0.16;
    s.add(new THREE.BoxGeometry(thick, WR - 0.5, 0.24).translate(0, (WR - 0.5) / 2 + 0.36, 0.14).rotateZ(a), stone, m);
  }
  s.add(new THREE.CylinderGeometry(0.42, 0.42, 0.5, tier ? 12 : 8).rotateX(Math.PI / 2).translate(0, 0, 0.2), stone, m); // the hub
}

// A horse at (x, z) on its pedestal, leaping forwards (+z), in the temple's frame.
function horse(s, x, z, rot, stone) {
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z), keep = s.frame;
  s.frame = keep.clone().multiply(m);
  s.box(-0.9, 0.9, 0, 1.2, -2, 2, stone); // the pedestal
  s.box(-0.55, 0.55, 2.6, 3.8, -1.4, 1.2, stone); // the body
  s.box(-0.5, 0.5, 2.9, 4, 0.9, 1.7, stone); // the chest
  for (const sx of [-1, 1]) {
    s.beam(V(sx * 0.32, 2.8, -1.1), V(sx * 0.32, 1.2, -1.3), 0.26, 0.3, stone); // hind legs
    s.beam(V(sx * 0.32, 3, 1.3), V(sx * 0.32, 2, 2.1), 0.24, 0.26, stone); // forelegs, raised
    s.beam(V(sx * 0.32, 2.05, 2.05), V(sx * 0.32, 1.5, 1.7), 0.2, 0.2, stone);
  }
  s.beam(V(0, 3.6, 1.2), V(0, 5, 1.9), 0.55, 0.75, stone); // the neck
  s.beam(V(0, 5.1, 1.7), V(0, 4.5, 2.6), 0.4, 0.55, stone); // the head
  s.box(-0.08, 0.08, 4.2, 5.4, 1.1, 1.6, stone); // the mane's crest
  s.beam(V(0, 3.4, -1.4), V(0, 2.4, -2), 0.22, 0.22, stone); // the tail
  s.frame = keep;
}

// The temple, in its own frame: the chariot's plinth and wheels, the jagamohana, the ruined sanctum, the stairs and
// horses, and the Nata Mandir in front.
function templeGeometry(s, tier) {
  const stone = '#ffffff', shade = '#4a3020', deep = '#3a261a', chlorite = '#5a5248';
  s.frame = FRAME;
  // ---- The chariot's plinth: a dark core, carved piers between the wheels, mouldings above and below ----
  const back = WHEELS[WHEELS.length - 1] - 3.2, front = WHEELS[0] + 3.4;
  s.box(-PW + 0.8, PW - 0.8, 0, PH, back, front, shade);
  s.box(-PW - 0.4, PW + 0.4, 0, 0.45, back - 0.4, front + 0.4, stone).box(-PW - 0.2, PW + 0.2, 0.45, 0.75, back - 0.2, front + 0.2, stone);
  s.box(-PW - 0.3, PW + 0.3, PH - 0.55, PH - 0.2, back - 0.3, front + 0.3, stone).box(-PW - 0.5, PW + 0.5, PH - 0.2, PH, back - 0.5, front + 0.5, stone);
  s.box(-PW, PW, 0.75, PH - 0.55, front - 0.6, front, stone).box(-PW, PW, 0.75, PH - 0.55, back, back + 0.6, stone); // its ends
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= WHEELS.length; i++) {
      // A pier between two wheels (and at each end).
      const zA = i === 0 ? front : WHEELS[i - 1] - WR - 0.15, zB = i === WHEELS.length ? back : WHEELS[i] + WR + 0.15;
      if (zA - zB > 0.1) s.box(sx * (PW - 0.8), sx * PW, 0.75, PH - 0.55, zB, zA, stone);
    }
    for (const wz of WHEELS) wheel(s, new THREE.Matrix4().makeRotationY(sx * Math.PI / 2).setPosition(sx * (PW - 0.7), WY, wz), tier, stone);
  }
  // ---- The jagamohana: its moulded base, the walls with their projections, three doorways ----
  const J = 12;
  s.box(-J - 1.2, J + 1.2, PH, PH + 0.6, -J - 1.2, J + 1.2, stone).box(-J - 0.8, J + 0.8, PH + 0.6, PH + 1.6, -J - 0.8, J + 0.8, stone);
  s.box(-J - 0.5, J + 0.5, PH + 1.6, PH + 2, -J - 0.5, J + 0.5, stone);
  s.box(-J, J, PH + 2, PH + 9.4, -J, J, stone);
  for (const [w, d] of [[4.2, 1.1], [8.4, 0.5]]) { // the central and side projections (rathas), all four faces
    s.box(-w, w, PH + 2, PH + 9.4, -J - d, J + d, stone).box(-J - d, J + d, PH + 2, PH + 9.4, -w, w, stone);
  }
  s.box(-J - 1.4, J + 1.4, PH + 9.4, PH + 10.4, -J - 1.4, J + 1.4, stone); // the cornice
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0]]) { // the doorways, sealed, in dark chlorite frames
    const along = (a, b, y0, y1, o0, o1, col) => (dz ? s.box(a, b, y0, y1, o0, o1, col) : s.box(dx * o0, dx * o1, y0, y1, a, b, col));
    along(-3.2, 3.2, PH + 1.6, PH + 8.6, J + 1.1, J + 1.6, chlorite);
    along(-2.2, 2.2, PH + 2, PH + 7.4, J + 1.6, J + 1.7, deep);
    along(-3.4, 3.4, PH + 8.6, PH + 9.2, J + 1.1, J + 1.8, chlorite);
  }
  // ---- The pyramidal roof: three tiers of slabs, cross-shaped with their projections, terraces of statues ----
  let y = PH + 10.4;
  const tiers = [[6, 12.6, 9.8], [5, 8.8, 7], [3, 6, 4.8]], rnd = mulberry(13);
  tiers.forEach(([k, w0, w1], t) => {
    for (let i = 0; i < k; i++) {
      const w = w0 + ((w1 - w0) * i) / Math.max(1, k - 1);
      s.box(-w, w, y, y + 0.48, -w, w, stone); // the slab, its edge overhanging
      if (tier || i % 2 === 0) s.box(-w * 0.38, w * 0.38, y, y + 0.48, -w - 0.55, w + 0.55, stone).box(-w - 0.55, w + 0.55, y, y + 0.48, -w * 0.38, w * 0.38, stone);
      s.box(-w + 0.6, w - 0.6, y + 0.48, y + 0.8, -w + 0.6, w - 0.6, shade); // the recess under the next
      y += 0.8;
    }
    if (t === 2) return;
    // The terrace: a recessed drum with its statues of musicians standing at the edge.
    const tw = w1 - 1.3, gap = t ? 1.1 : 1.5;
    s.box(-tw, tw, y, y + gap, -tw, tw, shade);
    const per = tier ? (t ? 3 : 4) : 2;
    for (let side = 0; side < 4; side++) for (let i = 0; i < per; i++) {
      const u = -tw + ((i + 0.5) * 2 * tw) / per, h = gap + 0.7 + rnd() * 0.4, e = tw + 0.45;
      const [x, z] = [[u, e], [e, -u], [-u, -e], [-e, u]][side];
      s.box(x - 0.35, x + 0.35, y, y + h, z - 0.35, z + 0.35, stone);
    }
    y += gap;
  });
  // The neck, the ribbed amalaka, the kalasa.
  s.box(-3.4, 3.4, y, y + 0.7, -3.4, 3.4, shade);
  y += 0.7;
  s.lathe([[2.6, 0], [3.7, 0.35], [3.9, 0.75], [3.6, 1.15], [2.4, 1.45], [1.2, 1.55]], 0, y, 0, tier ? 16 : 10, stone);
  s.lathe([[1.2, 0], [1.4, 0.3], [0.9, 0.7], [0.5, 0.9], [0.7, 1.2], [0.15, 1.6], [0, 1.7]], 0, y + 1.5, 0, tier ? 10 : 6, stone);
  // ---- The sanctum behind: fallen, its base and the broken stumps of its walls ----
  const D0 = -J - 2, D1 = back + 0.5, DW = 12.5;
  s.box(-DW, DW, PH, PH + 2.4, D1, D0, stone).box(-DW - 0.6, DW + 0.6, PH, PH + 0.6, D1 - 0.3, D0, stone);
  const r2 = mulberry(5);
  for (let z = D0 - 1.5; z > D1 + 1; z -= tier ? 3.2 : 5) for (const sx of [-1, 1]) {
    const h = PH + 2.4 + 1 + r2() * (z > -26 ? 6 : 3);
    s.box(sx * DW - 2.4 * sx, sx * DW, PH + 2.4, h, z - 1.5, z + 1.5, r2() < 0.3 ? shade : stone);
  }
  s.box(-DW, DW, PH + 2.4, PH + 6 + r2() * 2, D1, D1 + 2.4, stone); // the back wall
  s.box(-3, 3, PH + 2.4, PH + 5.2, -26, -22, chlorite); // the empty pedestal of the image
  for (const sx of [-1, 1]) { // the Surya shrines on the sanctum's sides, with their steps
    s.box(sx * DW, sx * (DW + 1.6), PH, PH + 7, -32, -26, stone);
    s.box(sx * (DW + 1.6), sx * (DW + 1.75), PH + 1, PH + 5.4, -31, -27, chlorite);
  }
  // ---- The front stairs down to the lawn, their side walls, the seven horses ----
  const steps = Math.ceil(PH / 0.52);
  for (let i = 0; i < steps; i++) s.box(-6, 6, 0, PH - (i * PH) / steps, front, front + (i + 1) * 0.6, stone);
  for (const sx of [-1, 1]) s.box(sx * 6, sx * 7.2, 0, PH + 0.6, front, front + steps * 0.6 - 0.6, stone);
  for (const [x, z] of HORSES) horse(s, x, z, x < 0 ? 0.08 : -0.08, stone);
  // ---- The Nata Mandir: a carved platform with projections on each face, stairs, broken pillars ----
  const N = 8;
  s.box(-N - 0.9, N + 0.9, 0, 0.6, NZ - N - 0.9, NZ + N + 0.9, stone);
  s.box(-N, N, 0.6, NH - 0.6, NZ - N, NZ + N, stone);
  s.box(-3.6, 3.6, 0.6, NH - 0.6, NZ - N - 0.9, NZ + N + 0.9, stone).box(-N - 0.9, N + 0.9, 0.6, NH - 0.6, NZ - 3.6, NZ + 3.6, stone);
  s.box(-N - 0.4, N + 0.4, 2.4, 2.8, NZ - N - 0.4, NZ + N + 0.4, stone);
  s.box(-N - 0.6, N + 0.6, NH - 0.6, NH, NZ - N - 0.6, NZ + N + 0.6, stone);
  for (const sz of [-1, 1]) for (let i = 0; i < 10; i++) {
    const e = NZ + sz * (N + 0.9), d = e + sz * (i + 1) * 0.45;
    s.box(-2.6, 2.6, 0, NH - i * 0.52, Math.min(e, d), Math.max(e, d), stone);
  }
  const r3 = mulberry(17);
  for (const px of [-6, -2, 2, 6]) for (const pz of [-6, -2, 2, 6]) {
    if (!tier && (Math.abs(px) < 3 && Math.abs(pz) < 3)) continue;
    const h = NH + 1.4 + r3() * 2.6;
    s.box(px - 0.55, px + 0.55, NH, NH + 0.5, NZ + pz - 0.55, NZ + pz + 0.55, stone);
    s.box(px - 0.4, px + 0.4, NH + 0.5, h, NZ + pz - 0.4, NZ + pz + 0.4, stone);
  }
  // Lions on elephants at its front stairs.
  for (const sx of [-1, 1]) {
    const x = sx * 4.4, z = NZ + N + 4;
    s.box(x - 0.8, x + 0.8, 0, 0.8, z - 1.4, z + 1.4, stone);
    s.box(x - 0.6, x + 0.6, 0.8, 2.2, z - 1.1, z + 1.1, stone).beam(V(x, 1.9, z + 1), V(x, 0.9, z + 1.5), 0.3, 0.3, stone);
    s.beam(V(x, 2.2, z - 0.3), V(x, 4.4, z + 0.3), 0.75, 0.9, stone);
    s.box(x - 0.35, x + 0.35, 4.2, 4.9, z + 0.1, z + 0.9, stone);
  }
  s.frame = null;
  return s;
}
const HORSES = [[-8.4, 19.5], [-11, 19], [-13.6, 18.4], [8.4, 19.5], [11, 19], [13.6, 18.4], [16.2, 17.6]];

// Everything round the temple: the lawns and the paved court, the path, hedges, lamps, the compound wall, trees.
function groundsGeometry(s, lit, tier) {
  const L1 = LAYER, warmLawn = new THREE.Color('#5a5a2a'), warmSand = new THREE.Color('#e8b078');
  // The floods warm the ground round the temple.
  const nm = world(0, 0, NZ);
  s.colour = (x, y, z, n, base) => {
    if (n.y < 0.9 || y > 0.4) return base;
    const d = Math.min(Math.hypot(x - TX, (z - TZ) * 0.8), Math.hypot(x - nm.x, z - nm.z) + 10);
    const w = clamp(1 - d / 95, 0, 1) ** 1.2;
    return tmpCol.copy(base).lerp(y > 1.5 * L1 ? warmSand : warmLawn, w * 0.7);
  };
  s.plane(-700, 700, -700, 200, 0, '#0e0c0a');
  s.plane(-260, 260, -330, 60, L1, '#24402a', tier ? 26 : 13, tier ? 20 : 10); // the lawns
  s.plane(-82, 62, -182, -50, 2 * L1, '#5e4a38', tier ? 14 : 7, tier ? 13 : 7); // the temple's laterite court
  s.plane(-6, 6, -50, -40, 2 * L1, '#5e4a38'); // the path on from the forecourt
  s.colour = null;
  // Clipped hedges along the forecourt and the court's front; low posts.
  for (const sx of [-1, 1]) {
    s.box(sx * 13.2, sx * 14.2, 0, 0.8, -46, 18, '#20381f');
  }
  // The compound wall of laterite, round the court's sides and back, lit with diyas (spots).
  const wall = '#5a3a2a';
  s.box(-84, -82, 0, 2.6, -184, -50, wall).box(62, 64, 0, 2.6, -184, -50, wall).box(-84, 64, 0, 2.6, -186, -184, wall);
  // Lamp standards: a dark post and a lantern.
  for (const [x, z] of LAMPS) { s.cyl(0.14, 0.09, 0, 4.2, x, z, 6, '#16140f'); lit.box(x - 0.24, x + 0.24, 4.2, 4.8, z - 0.24, z + 0.24, '#ffe0a0'); }
  // Ground floodlights round the temple: low boxes, their faces lit.
  for (const [x, z] of FLOODS) { s.box(x - 0.4, x + 0.4, 0, 0.5, z - 0.4, z + 0.4, '#24201c'); }
  // Trees: rain trees and mango on the lawns, casuarinas and palms along the edges (Konark is by the sea).
  const rnd = mulberry(9), roundTree = (x, z, r = 4.5) => {
    r *= 0.8 + rnd() * 0.4;
    s.add(new THREE.IcosahedronGeometry(r, tier > 1 ? 1 : 0), rnd() < 0.5 ? '#13241a' : '#1b3020', at(x, r + 2.6, z));
    s.cyl(0.35, 0.25, 0, r + 1.5, x, z, 5, '#2a1e16');
  };
  const casuarina = (x, z) => {
    const h = 11 + rnd() * 7;
    s.cyl(0.25, 0.15, 0, h * 0.4, x, z, 4, '#2a1e16');
    s.add(new THREE.ConeGeometry(2 + rnd(), h * 0.75, tier ? 7 : 5), '#14241a', at(x, h * 0.62, z));
  };
  const palm = (x, z) => {
    const h = 9 + rnd() * 5, lean = (rnd() - 0.5) * 1.6;
    s.beam(V(x, 0, z), V(x + lean, h, z), 0.4, 0.4, '#3a2a1c');
    for (let i = 0; i < (tier ? 7 : 4); i++) {
      const a = (i / (tier ? 7 : 4)) * Math.PI * 2;
      s.beam(V(x + lean, h, z), V(x + lean + Math.cos(a) * 3.6, h - 1.3, z + Math.sin(a) * 3.6), 0.9, 0.12, '#1c3220');
    }
  };
  for (let z = 14; z > -44; z -= tier ? 10 : 20) { roundTree(-21, z, 3.8); roundTree(21, z - 5, 3.8); }
  for (let z = 10; z > -46; z -= tier ? 14 : 28) { palm(-30, z); palm(31, z - 6); }
  for (let i = 0; i < (tier ? 16 : 8); i++) { const sx = i % 2 ? 1 : -1; roundTree(sx * (40 + rnd() * 50), -30 + rnd() * 70, 5); }
  for (let z = -60; z > -190; z -= tier ? 9 : 18) { casuarina(-92 - rnd() * 8, z); casuarina(72 + rnd() * 8, z); }
  for (let x = -80; x < 64; x += tier ? 10 : 20) casuarina(x + rnd() * 4, -194 - rnd() * 8);
  // The far tree line round the lawns, so the horizon is never bare.
  for (let i = 0; i < (tier ? 46 : 22); i++) {
    const a = -1.5 + (i / (tier ? 46 : 22)) * 3, d = 280 + rnd() * 60;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d - 40, r = 9 + rnd() * 7;
    s.add(new THREE.IcosahedronGeometry(r, 0), '#101c14', at(x, r * 0.8, z));
  }
  return s;
}
const LAMPS = [];
for (let z = 14; z > -46; z -= 15) for (const sx of [-1, 1]) LAMPS.push([sx * 15.4, z]);
for (const x of [-70, -50, -30, 30, 50]) LAMPS.push([x, -52]);
const FLOODS = [];
for (const lz of [-40, -20, 0, 20]) FLOODS.push([-PW - 7, lz]);
for (const lx of [-16, 16]) FLOODS.push([lx, 30]);
for (const lx of [-12, 12]) FLOODS.push([lx, 52]);
// The floods, put in the world.
for (const f of FLOODS) { const v = world(f[0], 0, f[1]); f[0] = v.x; f[1] = v.z; }

// Diyas along the forecourt, the plinth's deck and the Nata Mandir; lamps, floods, the wall; far village lights.
function lightSpots(tier) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  const put = (x, y, z, col) => { const v = world(x, y, z); out.push([v.x, v.y, v.z, col]); };
  for (const sx of [-1, 1]) for (let z = 18; z > -48; z -= step) out.push([sx * 12.4, 0.3, z, diya]);
  const back = WHEELS[WHEELS.length - 1] - 3.2, front = WHEELS[0] + 3.4;
  for (const sx of [-1, 1]) for (let z = front; z > back; z -= step * 1.2) put(sx * (PW + 0.3), PH + 0.15, z, diya);
  for (let x = -PW; x <= PW; x += step * 0.8) if (Math.abs(x) > 6.5) put(x, PH + 0.15, front + 0.4, diya);
  for (let x = -13; x <= 13; x += step) put(x, 0.25, front + 7.5, diya);
  for (const sx of [-1, 1]) for (let z = NZ - 8.5; z <= NZ + 8.6; z += step * 0.8) { put(sx * 8.7, NH + 0.12, z, diya); put(z - NZ, NH + 0.12, NZ + sx * 8.7, diya); }
  for (let z = -52; z > -184; z -= step * 2) { out.push([-83, 2.75, z, diya]); out.push([63, 2.75, z, diya]); }
  for (let x = -82; x < 62; x += step * 2) out.push([x, 2.75, -184, diya]);
  for (const [x, z] of LAMPS) out.push([x, 4.5, z, lamp]);
  for (const [x, z] of FLOODS) out.push([x, 0.6, z, '#fff2c8']);
  put(0, PH + 28.3, 0, '#ffd27a'); // a lamp on the kalasa
  // Village and resort lights through the trees, far off.
  const rnd = mulberry(77);
  for (let i = 0; i < (tier ? 80 : 40); i++) { const a = -1.2 + rnd() * 2.4, d = 330 + rnd() * 300; out.push([Math.sin(a) * d, 1 + rnd() * 6, -Math.cos(a) * d - 40, rnd() < 0.8 ? '#ffd28a' : '#ffffff']); }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = carvedTexture();
  const temple = templeGeometry(new Stone(templeColour), tier);
  const lit = new Stone();
  const grounds = groundsGeometry(new Stone(), lit, tier);
  const objects = [
    temple.mesh(0, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a2810' })),
    grounds.mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })),
    lit.mesh(0, new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  // The forecourt where crackers stand: sandstone flags.
  objects.push(forecourt({ rgb: [112, 92, 72], z0: -40, z1: 20, width: 24, tile: 2, joint: 'rgba(200,170,140,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's evening, darkened: deep blue overhead, violet lower down, an orange glow at the horizon.
    sky: ['#03061a', '#16194a', '#5a3a72', '#d8784a'],
    fog: ['#4a3058', 320, 1500],
    clouds: { colour: '#b0708a', count: tier ? 9 : 5, seed: 33 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1e14', 0.85],
    directional: [['#ffc98e', 1.75, [-40, 25, 300]], ['#ffe0b8', 0.45, [150, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
