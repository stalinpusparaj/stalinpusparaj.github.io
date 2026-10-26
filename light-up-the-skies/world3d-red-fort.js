/* Light Up the Skies — 3D background: the Red Fort (Lal Qila) on Diwali night, seen across the open ground in front
   of the Lahori Gate, the national flag flying over it and the long crenellated walls running off to both sides.
   Loaded by world3d.js when the Red Fort is the chosen world. Its colours follow the game's 2D Red Fort picture: a deep
   blue night going purple and ember orange at the horizon, the red sandstone floodlit orange-red, the chhatris'
   domes pale, a green lawn and a low red wall before the fort.

   Proportions follow published figures and the picture: the gate's central block about 22 m wide and 24 m high with
   its deep pointed archway (7.5 m wide, crown near 15 m) and a gallery of small arches over it, a row of seven small
   white-domed chhatris along its top, two octagonal towers flanking it to 26 m under open octagonal chhatris whose
   domes top out near 36 m, the flagstaff above. The walls stand about 17 m with round bastions, the two by the gate
   crowned by domed pavilions. Everything is a box, an extruded outline or a lathe, merged into a few meshes with one
   drawn sandstone texture; the floodlit look is baked into vertex colours: no extra lights to pay for.

   Frame: +x to your right, +y up, +z towards you; the fort's local origin is the centre of the gate at ground level. */
import * as THREE from './assets/vendor/three.module.min.js';
import { mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const GZ = -125; // the gate's centre, across the open ground
const BX = 11; // half the central block's width
const FZ = 6; // the gate's front face (local z); the body behind it stands at 4
const TOP = 24; // the central block's roof
const TX = 13.5, TZ = 4.5, TR = 4.6, TH = 26; // the octagonal towers: centre, radius, height
const WALL = 17, WZ = -2; // the walls' height and front line (local z)
const BAST = 34; // the domed bastions either side of the gate
const LOW = -80; // the low outer wall across the lawn (world z)

// ---------- Sandstone: pale ashlar in courses of 0.5 m with fine joints, one tile per 4 m; tinted red by vertex ----------
function sandstoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(61), px = 256 / 4;
  g.fillStyle = '#f6eae2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 0.5 * px) {
    let x = -rnd() * 50;
    while (x < 256) {
      const w = (0.9 + rnd() * 0.8) * px, v = 0.9 + rnd() * 0.1;
      g.fillStyle = `rgb(${(246 * v) | 0},${(232 * v) | 0},${(224 * v) | 0})`; g.fillRect(x + 1, y + 1, w - 2, 0.5 * px - 1.5);
      g.fillStyle = 'rgba(70,30,20,0.3)'; g.fillRect(x, y, 1, 0.5 * px);
      x += w;
    }
    g.fillStyle = 'rgba(70,30,20,0.32)'; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 360; i++) { g.fillStyle = `rgba(80,30,20,${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 4); }
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
  lathe(profile, x, y, z, seg, color, force) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z), force); }
  cyl(r0, r1, y0, y1, x, z, seg, color, force, open = false) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open), color, at(x, (y0 + y1) / 2, z), force); }
  // An octagonal shaft with a flat face towards you.
  oct(r0, r1, y0, y1, x, z, color, force) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, 8).rotateY(Math.PI / 8), color, at(x, (y0 + y1) / 2, z), force); }
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
// A blind arched panel w wide from y0 to y1, a thin plate standing 0.22 proud of a face, set by matrix m.
function panel(s, w, y0, y1, m, color, n) {
  const rise = Math.min(w * 0.6, (y1 - y0) * 0.4);
  const out = [[-w / 2, y0], [w / 2, y0], ...pointed(0, y1 - rise, w, rise, n).reverse()];
  s.add(extruded(out, [], 0.22), color, m);
}
// The matrix for a plate on a face at (x, z) whose outward normal points at angle a (0 = towards you).
const onFace = (x, z, a) => at(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(a));

// The floodlit tint by height: the floods sit low, so the walls glow brightest a few metres up and warm towards the
// top; far walls fade. It multiplies each part's own colour (red stone, pale domes).
const BANDS = [[0.6, '#a86a52', '#e8b08c'], [7, '#ffe4c8', '#ffdcbc'], [WALL, '#ffd6b0', '#ffc69c'], [TOP + 3, '#ffc89c', '#f8b88c'], [99, '#f2ae84', '#e09a74']]
  .map(([top, a, b]) => [top, new THREE.Color(a), new THREE.Color(b)]);
const tmpCol = new THREE.Color(), WHITE = new THREE.Color('#ffffff');
function floodColour(x, y, z, n, base) {
  let lo = 0;
  for (const [top, a, b] of BANDS) {
    if (y < top) { tmpCol.copy(a).lerp(b, Math.min(1, Math.max(0, (y - lo) / (top - lo)))); break; }
    lo = top;
  }
  if (y >= BANDS[BANDS.length - 1][0]) tmpCol.copy(BANDS[BANDS.length - 1][2]);
  if (base.g > 0.7) tmpCol.lerp(WHITE, 0.7).multiplyScalar(1.3); // pale marble domes take the light whiter than the red stone
  const far = 1 - Math.min(0.45, Math.max(0, Math.hypot(x, z) - 40) / 500);
  return tmpCol.multiply(base).multiplyScalar(far);
}
// The passage behind the archway and the gallery's arches: lit from inside, warm amber.
const inPassage = (cx, cy, cz, n) => Math.abs(cz - (FZ - 2)) < 0.05 && n.z > 0.5 && Math.abs(cx) < BX;

const RED = '#d0603e', DEEP = '#a84630', TRIM = '#e88a66', DOME = '#fff3e6', GOLD = '#f2c46a';

// An open chhatri on a platform at (x, y, z): pillars round a lit core, a sloping eave, a drum and a pale dome.
function chhatri(s, x, y, z, r, sides, tier) {
  const seg = tier ? 14 : 8, H = 1.25 * r + 0.6;
  s.oct(r + 0.35, r + 0.35, y, y + 0.45, x, z, RED);
  s.oct(r * 0.55, r * 0.55, y + 0.45, y + 0.45 + H, x, z, '#ffb070', 1); // the lit core
  const p = Math.max(0.22, r * 0.11);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides, px = x + Math.sin(a) * r * 0.86, pz = z + Math.cos(a) * r * 0.86;
    s.box(px - p, px + p, y + 0.45, y + 0.45 + H, pz - p, pz + p, RED);
  }
  const e = y + 0.45 + H;
  s.lathe([[r * 0.85, 0], [r * 1.32, -0.25], [r * 1.32, 0.05], [r * 0.95, 0.5], [0, 0.5]], x, e, z, sides === 4 ? 4 : seg, TRIM);
  s.cyl(r * 0.78, r * 0.78, e + 0.5, e + 0.5 + r * 0.3, x, z, seg, RED);
  const d = e + 0.5 + r * 0.3;
  s.lathe([[r * 0.8, 0], [r * 0.9, r * 0.4], [r * 0.84, r * 0.95], [r * 0.6, r * 1.4], [r * 0.24, r * 1.72], [0, r * 1.8]], x, d, z, seg, DOME);
  s.cyl(0.1 * r, 0.02, d + r * 1.75, d + r * 2.3, x, z, 4, GOLD);
  return d + r * 2.3;
}

// One octagonal tower at (x, z): bands, blind arched panels on its five faces you can see, a chhatri on top.
function tower(s, x, z, tier) {
  const ap = TR * Math.cos(Math.PI / 8), fw = 2 * TR * Math.sin(Math.PI / 8);
  s.oct(TR + 0.5, TR + 0.5, 0, 1.2, x, z, DEEP); // the plinth
  s.oct(TR, TR * 0.96, 1.2, TH, x, z, RED);
  for (const y of [8.6, 17]) s.oct(TR + 0.25, TR + 0.25, y, y + 0.5, x, z, TRIM);
  s.oct(TR + 0.9, TR + 0.9, TH, TH + 0.35, x, z, TRIM); // the eave
  const rows = tier ? [[2, 7.8], [9.8, 16.2], [18.2, 24.8]] : [[2, 7.8], [9.8, 16.2]];
  for (let k = -2; k <= 2; k++) {
    const a = (k * Math.PI) / 4;
    for (const [y0, y1] of rows) panel(s, fw * 0.62, y0, y1, onFace(x + Math.sin(a) * ap * 0.985, z + Math.cos(a) * ap * 0.985, a), DEEP, tier ? 3 : 2);
  }
  return chhatri(s, x, TH + 0.35, z, 3.5, 8, tier);
}

// A stretch of wall from (x0, z0) to (x1, z1) (local), its front to the -z side's left: a cornice and merlons on top.
function wall(s, x0, z0, x1, z1, tier, step, panels = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), th = Math.atan2(-(z1 - z0), x1 - x0), T = 7;
  const base = at((x0 + x1) / 2, 0, (z0 + z1) / 2).multiply(new THREE.Matrix4().makeRotationY(th));
  const local = (geo, color, lx, ly, lz) => s.add(geo, color, base.clone().multiply(at(lx, ly, lz)));
  local(new THREE.BoxGeometry(L + 0.2, 1.2, T + 1), DEEP, 0, 0.6, 0); // the battered foot
  local(new THREE.BoxGeometry(L, WALL - 1.2, T), RED, 0, (WALL + 1.2) / 2, 0);
  local(new THREE.BoxGeometry(L, 0.5, T + 1), TRIM, 0, WALL - 1.6, 0); // the cornice
  local(new THREE.BoxGeometry(L, 0.9, 0.7), RED, 0, WALL + 0.45, T / 2 - 0.35); // the parapet under the merlons
  const n = Math.floor(L / step);
  for (let i = 0; i < n; i++) local(new THREE.BoxGeometry(step * 0.5, 1.4, 0.7), RED, -L / 2 + (i + 0.5) * (L / n), WALL + 1.6, T / 2 - 0.35);
  // Blind arcading near the gate: two rows of arched panels.
  for (let i = 0; i < panels; i++) for (const [y0, y1] of [[2, 7.6], [9, 14.4]]) {
    const lx = -L / 2 + (i + 0.5) * (L / panels);
    s.add(extruded([[-1.1, y0], [1.1, y0], ...pointed(0, y1 - 1.2, 2.2, 1.2, 3).reverse()], [], 0.22), DEEP, base.clone().multiply(at(lx, 0, T / 2)));
  }
}

// A round bastion at (x, z): battered, a cornice, a ring of merlons; crown, if given, is a chhatri's radius.
function bastion(s, x, z, r, tier, crown = 0) {
  const seg = tier ? 16 : 10;
  s.cyl(r + 0.6, r, 0, WALL + 0.5, x, z, seg, RED);
  s.cyl(r + 0.5, r + 0.5, WALL - 1.6, WALL - 1.1, x, z, seg, TRIM);
  s.cyl(r, r, WALL + 0.5, WALL + 1.4, x, z, seg, RED);
  const k = Math.round((Math.PI * 2 * r) / (tier ? 2.2 : 3.2));
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2, px = x + Math.sin(a) * (r - 0.35), pz = z + Math.cos(a) * (r - 0.35);
    s.add(new THREE.BoxGeometry(1.1, 1.4, 0.7).rotateY(a), RED, at(px, WALL + 2.1, pz));
  }
  if (crown) chhatri(s, x, WALL + 1.4, z, crown, 8, tier);
}

// The Lahori Gate and the walls, round the gate's local origin.
function fortGeometry(s, tier, out) {
  const seg = tier ? 10 : 6;
  // The central block: the body, and the front slab with the archway and the gallery's arches cut through it.
  s.box(-BX, BX, 0, TOP, -9, FZ - 2, RED);
  const gallery = Array.from({ length: 7 }, (_, i) => opening(-7.2 + i * 2.4, 18.6, 21.4, 1.5, 1.1, tier ? 3 : 2));
  s.extrudeZ([[-BX, 0], [BX, 0], [BX, TOP], [-BX, TOP]], FZ - 2, FZ, RED, [opening(0, 0, 10.2, 7.5, 4.8, seg), ...gallery]);
  // The frame round the archway, the spandrels, the bands, the panels either side.
  const f = FZ, d = 0.3;
  for (const sx of [-1, 1]) s.box(sx * 4.4, sx * 5.2, 0, 16.4, f, f + d, TRIM);
  s.box(-5.2, 5.2, 15.6, 16.4, f, f + d, TRIM);
  for (const sx of [-1, 1]) s.add(new THREE.CylinderGeometry(0.75, 0.75, 0.25, seg + 4).rotateX(Math.PI / 2), TRIM, at(sx * 3.3, 14.2, f + 0.12));
  s.box(-BX - 0.3, BX + 0.3, 17.4, 17.9, f, f + 0.4, TRIM);
  for (const sx of [-1, 1]) for (const [y0, y1] of [[1.6, 7.4], [9, 15]]) panel(s, 2.6, y0, y1, onFace(sx * 7.8, f, 0), DEEP, tier ? 4 : 2);
  // The eave over the top, and the parapet behind the row of seven small chhatris.
  s.box(-BX - 0.6, BX + 0.6, TOP - 0.1, TOP + 0.35, -9.5, FZ + 1.1, TRIM);
  s.box(-BX, BX, TOP + 0.35, TOP + 1.2, -9, -7.8, RED);
  for (let i = 0; i < 7; i++) chhatri(s, -7.8 + i * 2.6, TOP + 0.35, FZ - 1.2, 0.95, 4, tier);
  // The towers either side, and slender pinnacles where they meet the walls.
  for (const sx of [-1, 1]) {
    tower(s, sx * TX, TZ, tier);
    s.box(sx * (TX + TR - 0.5), sx * (TX + TR + 2.5), 0, WALL + 2, WZ - 3, WZ + 3.5, RED); // the shoulder
    s.oct(0.55, 0.45, WALL + 2, WALL + 7, sx * (TX + TR + 1.4), WZ + 3.1, RED);
    s.lathe([[0.6, 0], [0.45, 0.7], [0, 1.4]], sx * (TX + TR + 1.4), WALL + 7, WZ + 3.1, 6, DOME);
  }
  // The walls: from the gate's shoulders to the domed bastions, on to more bastions, then bending away into the dark.
  const step = tier ? 2.2 : 3.2;
  for (const sx of [-1, 1]) {
    const pts = [[TX + TR + 2.5, WZ], [BAST, WZ], [100, WZ - 6], [175, WZ - 26], [270, WZ - 80], [380, WZ - 170]];
    if (!tier) pts.pop();
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], far = i > 2;
      const [x0, z0, x1, z1] = sx > 0 ? [ax, az, bx, bz] : [-bx, bz, -ax, az];
      wall(s, x0, z0, x1, z1, tier, far ? step * 1.6 : step, i === 0 ? 3 : i === 1 && tier ? 12 : 0);
    }
    bastion(s, sx * BAST, WZ + 1.5, 7, tier, 3.2);
    for (let i = 2; i < pts.length; i++) bastion(s, sx * pts[i][0], pts[i][1] + 1, 6.5, tier, i === 2 && tier > 1 ? 2.4 : 0);
  }
  // The flagstaff on the roof behind the chhatris.
  s.cyl(0.14, 0.09, TOP + 1.2, 41.4, 0, -6.5, 6, '#e8e0d4');
  s.add(new THREE.SphereGeometry(0.28, 6, 4), GOLD, at(0, 41.5, -6.5));
  // Strings of lights along the eave, the cornices near the gate and round the tower tops.
  for (let x = -BX; x <= BX; x += tier ? 0.8 : 1.4) out.push([x, TOP - 0.3, GZ + FZ + 1.2, '#ffd27a']);
  for (const sx of [-1, 1]) {
    for (let x = TX + TR + 3; x < 100; x += tier ? 1.6 : 2.8) out.push([sx * x, WALL - 1.9, GZ + WZ + 4.1 - (x > BAST ? (x - BAST) * 0.09 : 0), '#ffc46a']);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; out.push([sx * TX + Math.sin(a) * (TR + 1), TH - 0.2, GZ + TZ + Math.cos(a) * (TR + 1), '#ffd27a']); }
  }
  return s;
}

// The national flag, waving out to the right of the staff's head; drawn unlit so it reads in the floodlight.
function flagGeometry(s, tier) {
  const W = 6, H = 4, x0 = 0.12, y0 = 41.2 - H, z0 = -6.5, nx = tier ? 14 : 7;
  const wave = (g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 1.25 - 0.4) * 0.32 * (x / W)); }
    return g;
  };
  [['#f08a2c', 2], ['#f2ede4', 1], ['#1f8a36', 0]].forEach(([c, k]) => {
    s.add(wave(new THREE.PlaneGeometry(W, H / 3, nx, 1).translate(W / 2, H / 6, 0)), c, at(x0, y0 + (k * H) / 3, z0), 1);
  });
  // The Ashoka Chakra in the white band, riding the wave.
  const cx = W / 2, cz = Math.sin(cx * 1.25 - 0.4) * 0.32 * (cx / W);
  s.add(new THREE.RingGeometry(0.36, 0.48, tier ? 20 : 12), '#1a2a8a', at(x0 + cx, y0 + H / 2, z0 + cz + 0.04), 1);
  if (tier) for (let i = 0; i < 6; i++) s.add(new THREE.PlaneGeometry(0.06, 0.8).rotateZ((i / 6) * Math.PI), '#1a2a8a', at(x0 + cx, y0 + H / 2, z0 + cz + 0.04), 1);
  return s;
}

// The open ground: lawns, the road up to the gate, a low red wall across the lawn, hedges, trees, lamps, floods.
function groundsGeometry(s, lamps, tier, out) {
  const plane = (x0, x1, z0, z1, y, color) => s.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2));
  const rnd = mulberry(29), L1 = LAYER, L2 = 2 * LAYER;
  plane(-1500, 1500, -1500, 200, 0, '#121410');
  plane(-700, 700, GZ - 10, 40, L1, '#24401e'); // the lawns, up to the walls' foot
  plane(-7, 7, GZ + FZ, -40, L2, '#7a5446'); // the road to the gate
  // The low outer wall across the lawn, open where the road passes, with little merlons and a coping.
  for (const sx of [-1, 1]) {
    const x0 = sx * 10, x1 = sx * 420;
    s.box(x0, x1, 0, 1.8, LOW - 0.7, LOW + 0.7, '#a04a32').box(x0, x1, 1.8, 2.05, LOW - 0.85, LOW + 0.85, '#c06848');
    for (let x = 11; x < (tier ? 150 : 100); x += tier ? 3 : 4) s.box(sx * x - 0.5, sx * x + 0.5, 2.05, 2.75, LOW + 0.2, LOW + 0.75, '#a04a32');
    s.box(sx * 9, sx * 11, 0, 3.4, LOW - 1, LOW + 1, '#b0573a'); // the gateposts
    out.push([sx * 10, 3.7, LOW, '#ffe0a0']);
  }
  // Hedges along the forecourt and the road.
  for (const sx of [-1, 1]) {
    s.box(sx * 13.2, sx * 14.4, 0, 0.9, -40, 18, '#1d3a1c');
    s.box(sx * 7.6, sx * 8.6, 0, 0.7, LOW + 2, -42, '#1d3a1c');
  }
  // Trees: rows down the lawns either side, and a dark wood behind the walls.
  const tree = (x, z, k) => {
    const h = (3 + rnd() * 2.5) * k;
    s.box(x - 0.25, x + 0.25, 0, h, z - 0.25, z + 0.25, '#2a1e16');
    s.add(new THREE.IcosahedronGeometry((2.4 + rnd() * 1.6) * k, 0), rnd() < 0.5 ? '#1e3a1e' : '#183018', at(x, h + 1.6 * k, z));
    if (tier) s.add(new THREE.IcosahedronGeometry((1.8 + rnd()) * k, 0), '#24442a', at(x + (rnd() - 0.5) * 2 * k, h + 3 * k, z + (rnd() - 0.5) * 2 * k));
  };
  for (const sx of [-1, 1]) {
    for (let z = 16; z > LOW + 4; z -= tier ? 9 : 14) { tree(sx * (22 + rnd() * 4), z, 0.8); tree(sx * (40 + rnd() * 10), z - 4, 1.1); }
    for (let z = LOW - 6; z > GZ + 12; z -= tier ? 11 : 18) tree(sx * (52 + rnd() * 30), z, 1.2);
    for (let z = 10; z > LOW; z -= tier ? 16 : 26) tree(sx * (70 + rnd() * 60), z, 1.3);
  }
  for (let i = 0; i < (tier ? 40 : 24); i++) {
    const x = (rnd() - 0.5) * 700, z = GZ - 40 - rnd() * 260;
    if (Math.abs(x) < 60 && z > GZ - 80) continue;
    tree(x, z, 2.6 + rnd() * 1.6);
  }
  // Street lamps along the road and the forecourt: a dark post, a lantern.
  const lamp = (x, z) => {
    s.cyl(0.13, 0.08, 0, 5.6, x, z, 6, '#1a1618');
    lamps.box(x - 0.3, x + 0.3, 5.6, 6.3, z - 0.3, z + 0.3, '#fff0c8', 1);
    out.push([x, 6, z, '#ffeec0'], [x, 5.8, z, '#ffd890']);
  };
  for (const sx of [-1, 1]) {
    for (let z = 14; z > -40; z -= 18) lamp(sx * 15, z);
    for (let z = -48; z > GZ + 14; z -= 16) lamp(sx * 9.2, z);
  }
  // Floodlights on the lawn at the walls' foot, aimed up at the stone.
  for (let x = -96; x <= 96; x += tier ? 12 : 24) {
    if (Math.abs(x) < 9) continue;
    const z = GZ + WZ + 8 + (Math.abs(x) > BAST ? 0 : 6);
    s.box(x - 0.5, x + 0.5, 0, 0.6, z - 0.4, z + 0.4, '#202024');
    out.push([x, 0.8, z - 0.3, '#fff2d0']);
  }
  return s;
}

// Diyas along the forecourt, the road and the low wall; far city lights. [x, y, z, colour]
function lightSpots(tier, out) {
  const diya = '#ff9f3a', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) {
    for (let z = 18; z > -40; z -= step) out.push([sx * 12.6, 0.35, z, diya]);
    for (let z = -42; z > GZ + FZ + 2; z -= step * 1.2) out.push([sx * 7.3, 0.35, z, diya]);
    for (let x = 12; x < 120; x += step * 1.4) out.push([sx * x, 2.3, LOW, diya]);
    for (let x = 4.4; x < BX; x += step * 0.5) out.push([sx * x, 0.4, GZ + FZ + 1, diya]);
  }
  for (let x = -12; x <= 12; x += step * 0.6) out.push([x, 0.35, -40.5, diya]);
  const rnd = mulberry(83);
  for (let i = 0; i < (tier ? 90 : 45); i++) {
    const a = rnd() < 0.5 ? -1.5 + rnd() * 0.7 : 0.8 + rnd() * 0.7, d = 500 + rnd() * 400;
    out.push([Math.sin(a) * d, 2 + rnd() * 16, GZ - Math.cos(a) * d * 0.6, rnd() < 0.7 ? '#ffd28a' : '#ffffff']);
  }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = sandstoneTexture();
  const lit = new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a1a0c' });
  const glow = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  const objects = [], spots = [];
  const fort = flagGeometry(fortGeometry(new Stone(floodColour, inPassage, '#ffae5c'), tier, spots), tier);
  const fortLit = fort.mesh(0, lit);
  // The glow set: the lit passage and chhatri cores take the texture; the flag doesn't.
  const glowMesh = fort.mesh(1, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  for (const m of [fortLit, glowMesh]) { m.position.z = GZ; objects.push(m); }
  const lamps = new Stone();
  objects.push(groundsGeometry(new Stone(), lamps, tier, spots).mesh(0, new THREE.MeshLambertMaterial({ vertexColors: true })));
  objects.push(lamps.mesh(1, glow));
  // The forecourt where crackers stand: red sandstone flags.
  objects.push(forecourt({ rgb: [96, 58, 50], z0: -40, z1: 20, width: 26, tile: 1.8, joint: 'rgba(200,160,140,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier, spots),
    zone: { x0: -11, x1: 11, z0: -30, z1: -5 },
    // The 2D picture's night: deep navy overhead, purple lower down, an ember orange glow at the horizon.
    sky: ['#03061a', '#141a4c', '#5a3470', '#d2643c'],
    fog: ['#4a2c52', 320, 1500],
    clouds: { colour: '#9a5a8a', count: tier ? 9 : 5, seed: 33 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1a12', 0.85],
    directional: [['#ffc08a', 1.7, [-30, 20, 300]], ['#ffd8b8', 0.5, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
