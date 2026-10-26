/* Light Up the Skies — 3D background: the Meenakshi Amman Temple, Madurai, on Diwali night, seen from the street that
   runs up to its great south gopuram, with the other towers of the temple rising over its walls to either side and a
   golden vimana between them. Loaded by world3d.js when Madurai is the chosen world. Its colours follow the game's 2D
   Meenakshi picture: a dark blue sky going violet and then orange at the horizon, the towers floodlit and crowded with
   painted figures in red, blue, green and gold, the granite base warm, the town round it twinkling.

   Proportions follow published figures: the south gopuram about 52 m tall on a granite base some 30 m wide and 18 m
   deep, its two lower storeys of stone (about 10 m) pierced by the tall gateway, then nine storeys of painted stucco
   tapering to about two fifths of the base's width, each with its cornice and its parapet of miniature shrines, under
   a barrel-vaulted roof (the shala) carrying a row of gilded kalasams. The other outer gopurams are 40–46 m, the inner
   ones about 30 m; the outer wall about 9 m, striped red and white. Everything is a box, a lathe or a part-cylinder,
   merged into a few meshes with a drawn texture of painted figures and one of granite; the floodlit look is baked into
   vertex colours.

   Frame: +x to your right, +y up, +z towards you. A gopuram's local origin is the centre of its base at ground level,
   its front (the gateway's mouth) along local +z. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const GZ = -166; // the south gopuram's centre, at the head of the street
const WALL_Z = GZ + 2; // the outer wall's line, through the gopuram
const STREET = 15; // the house fronts stand this far either side of the street's centre
const SQUARE = -112; // where the houses stop and the paved square before the wall begins

// ---------- Painted stucco: rows of gods, guardians and beasts in niches, bright colours, one tile per 8 m ----------
function figuresTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(61);
  const grounds = ['#1e3c9a', '#c0202a', '#1e8a48', '#e0a018', '#2a78d0', '#8a228a', '#e0601a', '#18a0a0'];
  const bodies = ['#3a6aff', '#ffd040', '#ff8a9a', '#40d070', '#ffffff', '#ff5a28', '#58e0f0', '#ffe090', '#ff3a6a', '#b070ff'];
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    // The moulding between rows: a bright band and its shadow.
    g.fillStyle = ['#ffd040', '#ff4a3a', '#40c0ff', '#40d070'][row]; g.fillRect(0, y, 256, 5);
    g.fillStyle = '#fff4d8'; g.fillRect(0, y + 5, 256, 2);
    g.fillStyle = 'rgba(30,20,40,0.55)'; g.fillRect(0, y + 7, 256, 3);
    for (let x = (row % 2) * 12; x < 270; x += 24) {
      // A niche, its coloured ground and a little arch over it.
      g.fillStyle = grounds[(rnd() * grounds.length) | 0]; g.fillRect(x, y + 10, 23, 54);
      g.fillStyle = '#fff0c8'; g.fillRect(x - 1, y + 10, 2, 54);
      g.beginPath(); g.arc(x + 11.5, y + 20, 10, Math.PI, 0); g.strokeStyle = '#ffe070'; g.lineWidth = 2.5; g.stroke();
      // The figure: crown, head, many arms, a robe, feet on a plinth.
      const b = bodies[(rnd() * bodies.length) | 0], robe = bodies[(rnd() * bodies.length) | 0], cx = x + 11.5, w = rnd() < 0.3 ? 1.3 : 1;
      g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(cx - 4, y + 24); g.lineTo(cx, y + 14); g.lineTo(cx + 4, y + 24); g.fill();
      g.fillStyle = b; g.beginPath(); g.arc(cx, y + 27, 4, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - 5 * w, y + 31, 10 * w, 11);
      g.fillRect(cx - 9 * w, y + 31, 3, 9); g.fillRect(cx + 9 * w - 3, y + 31, 3, 9);
      if (rnd() < 0.5) { g.fillRect(cx - 10 * w, y + 27, 2, 6); g.fillRect(cx + 10 * w - 2, y + 27, 2, 6); }
      g.fillStyle = robe; g.fillRect(cx - 6 * w, y + 42, 12 * w, 9);
      g.fillStyle = b; g.fillRect(cx - 5, y + 51, 4, 7); g.fillRect(cx + 1, y + 51, 4, 7);
      g.fillStyle = '#f0e0c0'; g.fillRect(x + 1, y + 58, 21, 4);
      g.fillStyle = 'rgba(20,10,30,0.3)'; g.fillRect(x + 21, y + 10, 2, 54); // the niche's shadowed side
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.125, 0.125); t.anisotropy = 4;
  return t;
}

// ---------- Granite and lime: blocks in courses, a few stains, one tile per 4 m ----------
function graniteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), rnd = mulberry(23);
  g.fillStyle = '#e8e0d4'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    let x = -rnd() * 30;
    while (x < 128) {
      const w = 20 + rnd() * 26, v = 0.88 + rnd() * 0.14;
      g.fillStyle = `rgb(${(232 * v) | 0},${(224 * v) | 0},${(212 * v) | 0})`; g.fillRect(x, y, w, 16);
      g.fillStyle = 'rgba(60,50,40,0.35)'; g.fillRect(x, y, 1, 16);
      x += w;
    }
    g.fillStyle = 'rgba(60,50,40,0.4)'; g.fillRect(0, y, 128, 1);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(70,60,50,${rnd() * 0.15})`; g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Stone: merges shapes, laying the texture on in metres and colouring every vertex ----------
// colour(x, y, z, normal, base) gives a vertex colour (in world space). frame, when set, places everything added.
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Stone {
  constructor(colour = null) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.colour = colour; this.frame = null; }
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
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (const v of [tmpA, tmpB, tmpC]) {
        this.pos.push(v.x, v.y, v.z); this.nor.push(tmpN.x, tmpN.y, tmpN.z);
        this.uv.push(...(ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]));
        const c = this.colour ? this.colour(v.x, v.y, v.z, tmpN, base) : base;
        this.col.push(c.r, c.g, c.b);
      }
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(x0, x1, y0, y1, z0, z1, color) { return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); }
  lathe(profile, x, y, z, seg, color) { return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), color, at(x, y, z)); }
  cyl(r0, r1, y0, y1, x, z, seg, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), color, at(x, (y0 + y1) / 2, z)); }
  plane(x0, x1, z0, z1, y, color, sx = 1, sz = 1) { return this.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2)); }
  // A flat panel (a window, a shop front) on a wall facing +x (dir 1) or -x (dir -1), or +z (dir 0).
  panel(x0, x1, y0, y1, z0, z1, dir, color) {
    const g = dir ? new THREE.PlaneGeometry(Math.abs(z1 - z0), y1 - y0).rotateY(dir * Math.PI / 2) : new THREE.PlaneGeometry(Math.abs(x1 - x0), y1 - y0);
    return this.add(g, color, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  }
  // A tapering block: w0 x d0 (half sizes) at y0 narrowing to k times that at y1.
  frustum(w0, d0, k, y0, y1, color) {
    const r = Math.SQRT2, g = new THREE.CylinderGeometry(r * k, r, y1 - y0, 4, 1).rotateY(Math.PI / 4).scale(w0, 1, d0);
    return this.add(g, color, at(0, (y0 + y1) / 2, 0));
  }
  // A barrel vault: half a cylinder of radius r, its axis along x from x0 to x1 at height y, centred on z.
  vault(x0, x1, y, z, r, seg, color, sy = 1) {
    const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, sy, 1);
    return this.add(g, color, at((x0 + x1) / 2, y, z));
  }
  // A beam w x h in section from point a to point b.
  beam(a, b, w, h, color) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, len, h), color, m);
  }
  mesh(material) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpCol = new THREE.Color();

// The floodlights wash the towers warm from below and fade towards the crown; far towers a little dimmer; the tops
// of cornices darker than their lit faces.
const WARM = new THREE.Color('#ffe2c0'), COOL = new THREE.Color('#c8b8e0');
function paintColour(x, y, z, n, base) {
  const far = clamp((-z - 190) / 120, 0, 1);
  const c = tmpCol.copy(WARM).lerp(COOL, clamp(y / 60, 0, 1) * 0.6).multiplyScalar(1.12 - clamp(y / 55, 0, 1) * 0.3 - far * 0.2);
  c.multiply(base);
  return n.y > 0.7 ? c.multiplyScalar(0.7) : n.y < -0.5 ? c.multiplyScalar(0.5) : c;
}
function stoneColour(x, y, z, n, base) {
  const c = tmpCol.copy(base).multiplyScalar(1.1 - clamp(y / 30, 0, 1) * 0.25);
  return n.y > 0.7 ? c.multiplyScalar(0.8) : c;
}

// A gopuram: the granite base with its gateway (into stone), then n painted storeys, the vault and its kalasams
// (into paint and gold). H its height, W x D its base; x, z where it stands, rot its turn; detail 0..2.
function gopuram(paint, stone, { x, z, rot = 0, H, W, D, n, kal, detail }) {
  const frame = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  paint.frame = stone.frame = frame;
  const granite = '#d8b494', dark = '#120a08', gold = '#ffc23a';
  const hw = W / 2, hd = D / 2, B = H * 0.2, dw = W * 0.09, dh = B * 0.78;
  // ---- The granite base: its moulded plinth, two storeys of pilastered wall split by the gateway ----
  stone.box(-hw - 0.8, hw + 0.8, 0, 1.2, -hd - 0.8, hd + 0.8, granite);
  stone.box(-hw, -dw, 1.2, B, -hd, hd, granite).box(dw, hw, 1.2, B, -hd, hd, granite);
  stone.box(-dw, dw, dh, B, -hd, hd, granite);
  stone.box(-dw, dw, 1.2, dh, -0.6, 0.6, dark); // the passage, deep in shadow (a closed door half way through)
  stone.box(-dw - 0.5, dw + 0.5, dh - 0.5, dh, hd - 0.3, hd + 0.5, '#8a6a50'); // the gateway's lintel
  stone.box(-hw - 0.4, hw + 0.4, B * 0.48, B * 0.48 + 0.5, -hd - 0.4, hd + 0.4, granite); // the cornice between storeys
  if (detail) {
    for (const side of [-1, 1]) for (let px = dw + 1.4; px < hw - 0.5; px += detail > 1 ? 2.2 : 3.6) {
      for (const fz of [-1, 1]) stone.box(side * px - 0.35, side * px + 0.35, 1.2, B, fz * hd - 0.3, fz * hd + 0.3, granite);
    }
  }
  // ---- The painted storeys: each a little narrower and shorter, a projecting bay with its opening at the middle ----
  let y = B;
  paint.box(-hw - 0.6, hw + 0.6, y, y + 0.7, -hd - 0.6, hd + 0.6, '#f0d080'); // the first cornice
  y += 0.7;
  const top = H * 0.86, sum = Array.from({ length: n }, (_, i) => 1 - 0.3 * (i / n)).reduce((a, b) => a + b, 0);
  const width = (t) => hw * (0.92 - 0.5 * t ** 0.9), depth = (t) => hd * (0.9 - 0.42 * t);
  const tones = ['#ffffff', '#fff4e8', '#f4f8ff', '#fffaf0'];
  for (let i = 0; i < n; i++) {
    const t = i / n, h = ((top - B - 0.7) * (1 - 0.3 * t)) / sum;
    const w = width(t), d = depth(t), tone = tones[i % 4];
    const k = width((i + 1) / n) / w;
    paint.frustum(w, d, k, y, y + h - 0.3, tone);
    // The central bay, front and back, with its dark opening; the side bays.
    const bw = Math.max(1.4, w * 0.22);
    paint.box(-bw, bw, y, y + h - 0.3, -d * k - 0.5, d * k + 0.5, tone);
    paint.box(-bw * 0.32, bw * 0.32, y + 0.25, y + h * 0.66, -d * k - 0.6, d * k + 0.6, dark);
    if (detail) for (const sx of [-1, 1]) paint.box(sx * (w * 0.6) - 0.7, sx * (w * 0.6) + 0.7, y, y + h - 0.3, -d * k - 0.25, d * k + 0.25, tone);
    // The cornice, a thin overhang.
    paint.box(-w * k - 0.25, w * k + 0.25, y + h - 0.3, y + h, -d * k - 0.25, d * k + 0.25, i % 2 ? '#ffd060' : '#ff6a50');
    // The parapet of miniature shrines on the cornice, before the next storey: square kutas with domes at the
    // corners, barrel shalas between.
    if (detail || i % 2 === 0) {
      const w2 = w * k, d2 = d * k, py = y + h, ph = Math.min(1.1, h * 0.3);
      const m = Math.max(2, Math.round((w2 * 2) / (detail > 1 ? 3 : 4.2)));
      for (const fz of [-1, 1]) for (let j = 0; j < m; j++) {
        const u = -w2 + ((j + 0.5) * 2 * w2) / m;
        if (Math.abs(u) < bw * 0.6) continue; // the bay's opening above stays clear
        const zz = fz * (d2 + 0.15), corner = j === 0 || j === m - 1;
        paint.box(u - 0.45, u + 0.45, py, py + ph, zz - 0.4, zz + 0.4, tone);
        if (corner) paint.lathe([[0.55, 0], [0.5, 0.35], [0.25, 0.7], [0, 0.8]], u, py + ph, zz, detail > 1 ? 5 : 4, '#ffc848');
        else paint.vault(u - 0.55, u + 0.55, py + ph, zz, 0.42, 3, j % 2 ? '#58c8f0' : '#ff8a6a', 1.3);
      }
      if (detail) for (const fx of [-1, 1]) for (const u of [-d2 * 0.4, 0, d2 * 0.4]) { // the sides
        const xx = fx * (w2 + 0.15);
        paint.box(xx - 0.4, xx + 0.4, py, py + ph, u - 0.45, u + 0.45, tone);
        paint.lathe([[0.55, 0], [0.5, 0.35], [0.25, 0.7], [0, 0.8]], xx, py + ph, u, 4, '#ffc848');
      }
    }
    // Big figures standing out at the corners of the lower storeys.
    if (detail > 1 && i < n - 2) for (const sx of [-1, 1]) for (const fz of [-1, 1]) {
      const fx = sx * (w - 0.6), zz = fz * (d + 0.1);
      paint.box(fx - 0.35, fx + 0.35, y + 0.2, y + h * 0.7, zz - 0.3, zz + 0.3, i % 2 ? '#4a78ff' : '#ffb040');
      paint.box(fx - 0.25, fx + 0.25, y + h * 0.7, y + h * 0.82, zz - 0.25, zz + 0.25, '#ffd050');
    }
    y += h;
  }
  // ---- The barrel-vaulted crown: its base, the vault with horseshoe ends, the kalasams on its ridge ----
  const wt = width(1) * 0.98, dt = Math.max(1.6, depth(1) * 0.8), vr = dt * 1.05;
  paint.box(-wt, wt, y, y + 0.9, -dt - 0.2, dt + 0.2, '#f0c060');
  y += 0.9;
  const sy = Math.max(1, (H * 0.955 - y) / vr); // the vault stands taller than a half-round
  paint.vault(-wt, wt, y, 0, vr, detail ? 10 : 6, '#ffffff', sy);
  for (const ex of [-1, 1]) { // the horseshoe gables at the ends, standing proud
    paint.add(new THREE.CylinderGeometry(vr + 0.5, vr + 0.5, 0.6, detail ? 10 : 6, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, sy, 1), '#e86a50', at(ex * (wt + 0.3), y, 0));
  }
  paint.box(-wt * 0.3, wt * 0.3, y + 0.4, y + vr * sy * 0.7, -vr - 0.1, vr + 0.1, '#58b8d8'); // the kirtimukha window
  paint.box(-wt * 0.08, wt * 0.08, y + 0.8, y + vr * sy * 0.55, -vr - 0.2, vr + 0.2, dark);
  const ridge = y + vr * sy;
  for (let j = 0; j < kal; j++) {
    const u = -wt + 0.5 + (j * (2 * wt - 1)) / (kal - 1);
    paint.lathe([[0.45, 0], [0.55, 0.3], [0.3, 0.6], [0.45, 1], [0.12, 1.9], [0, 2.5]].map(([r, hh]) => [r * kal / 10 * 0.9 + 0.1, hh * Math.min(1, H / 50)]),
      u, ridge - 0.25, 0, detail > 1 ? 6 : detail ? 5 : 4, gold);
  }
  paint.frame = stone.frame = null;
  return ridge + 2.3 * Math.min(1, H / 50);
}

// The golden vimana over the sanctum: a gilded tower of three storeys and a dome, at (x, z).
function vimana(paint, x, z, detail) {
  const gold = '#ffbf30';
  paint.box(x - 5, x + 5, 0, 7, z - 5, z + 5, '#d8b494');
  let y = 7;
  for (let i = 0; i < 3; i++) {
    const w = 4.4 - i * 1.1;
    paint.box(x - w, x + w, y, y + 1.8, z - w, z + w, gold).box(x - w - 0.3, x + w + 0.3, y + 1.8, y + 2.1, z - w - 0.3, z + w + 0.3, gold);
    y += 2.1;
  }
  paint.lathe([[1.6, 0], [2.4, 0.8], [2.2, 1.8], [1.2, 2.6], [0.4, 3], [0.3, 3.8], [0, 4.2]], x, y, z, detail ? 10 : 6, gold);
}

// The temple: the great south gopuram, the other gopurams round it, the vimana, the striped outer wall.
function templeGeometry(paint, stone, tier) {
  const towers = [
    { x: 0, z: GZ, H: 53, W: 32, D: 20, n: 9, kal: 11, detail: tier },
    { x: -80, z: -238, rot: 0.3, H: 46, W: 27, D: 16, n: 9, kal: 9, detail: 0 },
    { x: 86, z: -252, rot: -0.3, H: 44, W: 26, D: 16, n: 9, kal: 9, detail: 0 },
    { x: -38, z: -236, H: 32, W: 18, D: 12, n: 7, kal: 7, detail: 0 },
    { x: 42, z: -246, H: 30, W: 17, D: 11, n: 7, kal: 7, detail: 0 },
  ];
  if (tier) towers.push({ x: -22, z: -330, H: 46, W: 27, D: 16, n: 9, kal: 9, detail: 0 }, { x: 160, z: -230, rot: -Math.PI / 2 + 0.3, H: 26, W: 15, D: 10, n: 6, kal: 5, detail: 0 });
  const tops = towers.map((t) => [t.x, gopuram(paint, stone, t), t.z, t]);
  vimana(paint, 20, -232, tier);
  // ---- The outer wall: lime-washed, with the temple's red and white stripes, a dark band at its foot ----
  const H = 9, wall = '#f2e8d8', red = '#b82a22';
  for (const [x0, x1] of [[-150, -16], [16, 150]]) {
    stone.box(x0, x1, 0, H, WALL_Z - 1.2, WALL_Z + 1.2, wall);
    stone.box(x0, x1, H, H + 0.6, WALL_Z - 1.5, WALL_Z + 1.5, '#e8d8b8');
    stone.box(x0, x1, 0, 1, WALL_Z - 1.4, WALL_Z + 1.4, '#8a6a50');
    const step = tier ? 2.4 : 4.8;
    for (let x = x0 + 1.2; x < x1 - 1; x += step) stone.box(x - step * 0.25, x + step * 0.25, 1.4, H - 0.6, WALL_Z + 1.2, WALL_Z + 1.35, red);
  }
  for (const sx of [-1, 1]) stone.box(sx * 150 - 1.2, sx * 150 + 1.2, 0, H, -360, WALL_Z, wall);
  return tops;
}

// The street up to the gopuram: its houses and shops, the square before the wall, palms and neem trees, the town.
function townGeometry(s, lit, tier) {
  const L1 = LAYER, rnd = mulberry(91);
  const nearGlow = new THREE.Color('#c08050');
  s.colour = (x, y, z, n, base) => {
    if (n.y < 0.9 || y > 0.4) return base;
    const w = clamp(1 - Math.hypot(x * 0.6, z - GZ) / 120, 0, 1) ** 1.3; // the floods warm the square
    return tmpCol.copy(base).lerp(nearGlow, w * 0.5);
  };
  s.plane(-900, 900, -900, 200, 0, '#100c0c');
  s.plane(-STREET, STREET, -168, 40, L1, '#3a3438', 1, tier ? 12 : 6); // the street
  s.plane(-150, 150, -170, SQUARE, 2 * L1, '#6a5a4c', tier ? 12 : 6, tier ? 6 : 3); // the square before the wall
  for (const sx of [-1, 1]) s.plane(sx * STREET + (sx < 0 ? -3 : 0), sx * STREET + (sx < 0 ? 0 : 3), SQUARE, 40, 2 * L1, '#5a4c42'); // the footpaths
  s.colour = null;
  // ---- The houses and shops along the street: two to four storeys, flat roofs, balconies, lit shop fronts ----
  const walls = ['#d8c0a0', '#e8c890', '#a8c8b8', '#e0a888', '#f0e0c8', '#a8c0d8', '#d8a0b0', '#c8d898'];
  for (const sx of [-1, 1]) {
    let z = 34;
    while (z > SQUARE + 4) {
      const len = 7 + rnd() * 6, h = 6.2 + (rnd() < 0.3 ? 3.2 : 0), deep = 12, x0 = sx * (STREET + 3), x1 = sx * (STREET + 3 + deep), col = walls[(rnd() * walls.length) | 0];
      const z1 = z, z0 = z - len;
      s.box(x0, x1, 0, h, z0, z1, col);
      s.box(x0 - sx * 0.3, x1, h, h + 0.8, z0, z1, col); // the parapet
      s.box(x0 - sx * 1.6, x0, 3.2, 3.5, z0 + 0.3, z1 - 0.3, '#5a4a40'); // the shop awning
      for (let b = z0 + 0.8; b < z1 - 2; b += 3.4) lit.panel(x0 - sx * 0.06, x0 - sx * 0.06, 0.4, 2.8, b, Math.min(b + 2.6, z1 - 0.8), -sx, rnd() < 0.5 ? '#e8a050' : '#f0c078'); // the open shop fronts
      for (let fy = 4.6; fy < h - 1; fy += 3.2) for (let wz = z0 + 1.6; wz < z1 - 1; wz += 2.6) {
        if (rnd() < (tier ? 0.55 : 0.35)) lit.panel(x0 - sx * 0.06, x0 - sx * 0.06, fy, fy + 1.4, wz, wz + 1, -sx, rnd() < 0.7 ? '#ffc870' : '#f0f0ff');
        else s.panel(x0 - sx * 0.06, x0 - sx * 0.06, fy, fy + 1.4, wz, wz + 1, -sx, '#2a2230');
      }
      if (tier && rnd() < 0.5) s.box(x0 - sx * 1.2, x0, 4.3, 4.5, z0 + 1, z1 - 1, '#6a5a50'); // a balcony
      z = z0 - (rnd() < 0.2 ? 2 : 0.2);
    }
  }
  // Street lamps on the footpaths; strings of lights across the street (spots).
  for (const [x, z] of LAMPS) { s.cyl(0.13, 0.09, 0, 5.5, x, z, 5, '#1a1818'); s.box(x - 0.1, x + 0.1, 5.4, 5.6, z - 0.1, z + 0.1, '#1a1818'); lit.box(x - 0.25, x + 0.25, 5.6, 6.2, z - 0.25, z + 0.25, '#fff0c8'); }
  // Flower and lamp stalls on the square.
  for (const sx of [-1, 1]) for (let i = 0; i < (tier ? 4 : 2); i++) {
    const x = sx * (24 + i * 9), z = -150 + (i % 2) * 8;
    s.box(x - 1.5, x + 1.5, 0, 1, z - 1, z + 1, '#5a3a2a').box(x - 1.7, x + 1.7, 2.4, 2.6, z - 1.2, z + 1.2, '#c03a2a');
    for (const px of [-1.5, 1.5]) s.box(x + px - 0.06, x + px + 0.06, 1, 2.4, z - 0.06, z + 0.06, '#2a1e16');
    lit.box(x - 1.3, x + 1.3, 1, 1.2, z - 0.8, z + 0.8, '#ffb040'); // marigolds heaped under a bulb
  }
  // Trees: coconut palms and neem along the square and behind the houses, so turning shows no bare sides.
  const palm = (x, z) => {
    const h = 10 + rnd() * 6, lean = (rnd() - 0.5) * 2;
    s.beam(V(x, 0, z), V(x + lean, h, z), 0.45, 0.45, '#3a2a1c');
    const k = tier ? 6 : 5;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      s.beam(V(x + lean, h, z), V(x + lean + Math.cos(a) * 3.8, h - 1.6, z + Math.sin(a) * 3.8), 0.9, 0.12, '#1c3420');
    }
  };
  const neem = (x, z, r = 4.5) => {
    r *= 0.8 + rnd() * 0.4;
    s.cyl(0.4, 0.28, 0, r + 1.5, x, z, 5, '#2a1e16');
    s.add(new THREE.IcosahedronGeometry(r, 0), rnd() < 0.5 ? '#14261a' : '#1a3020', at(x, r + 3, z));
  };
  for (const sx of [-1, 1]) {
    for (let x = 22; x < 140; x += tier ? 16 : 30) palm(sx * x, -124 - rnd() * 8);
    for (let z = 30; z > -110; z -= tier ? 14 : 28) neem(sx * (STREET + 19 + rnd() * 6), z, 5);
  }
  // ---- The town round the temple: blocks of houses, lit windows, a few taller buildings, and far trees ----
  const block = (x, z, w, d, h) => {
    s.box(x - w, x + w, 0, h, z - d, z + d, walls[(rnd() * walls.length) | 0]);
    const fz = z + d + 0.05;
    for (let fy = 1.4; fy < h - 1; fy += 3.2) for (let wx = x - w + 1; wx < x + w - 1; wx += 2.8) if (rnd() < 0.4) lit.panel(wx, wx + 1, fy, fy + 1.3, fz, fz, 0, '#ffc878');
  };
  for (let i = 0; i < (tier ? 44 : 26); i++) {
    const sx = i % 2 ? 1 : -1, x = sx * (50 + rnd() * 160), z = 30 - rnd() * 130;
    block(x, z, 4 + rnd() * 6, 4 + rnd() * 5, 5 + rnd() * 10);
  }
  for (let i = 0; i < (tier ? 16 : 10); i++) { const sx = i % 2 ? 1 : -1; neem(sx * (40 + rnd() * 120), 20 - rnd() * 120, 6); }
  for (let i = 0; i < (tier ? 50 : 24); i++) {
    const a = -1.5 + (i / (tier ? 50 : 24)) * 3, d = 380 + rnd() * 80;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d - 60;
    if (rnd() < 0.5) s.box(x - 8, x + 8, 0, 8 + rnd() * 18, z - 8, z + 8, '#1a1820');
    else { const r = 9 + rnd() * 7; s.add(new THREE.IcosahedronGeometry(r, 0), '#101c14', at(x, r * 0.8, z)); }
  }
  return s;
}
const LAMPS = [];
for (let z = 30; z > SQUARE; z -= 18) for (const sx of [-1, 1]) LAMPS.push([sx * (STREET + 1.2), z]);
for (const x of [-60, -36, 36, 60]) LAMPS.push([x, -132]);

// Diyas along the forecourt and the wall's top, the lamps, floods at the gopuram's foot, strings of lights across the
// street, lamps on the kalasams, the far town.
function lightSpots(tier, tops) {
  const out = [], diya = '#ff9f3a', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  for (const sx of [-1, 1]) for (let z = 18; z > -40; z -= step) out.push([sx * 12.4, 0.3, z, diya]);
  for (const sx of [-1, 1]) for (let x = 18; x < 150; x += step * 2) out.push([sx * x, 9.8, WALL_Z + 1.6, diya]);
  for (const [x, z] of LAMPS) out.push([x, 5.9, z, lamp]);
  // The floods along the gopuram's base, and its gateway lit gold.
  for (let x = -14; x <= 14; x += 4) out.push([x, 0.5, GZ + 12, '#fff2c8']);
  for (let y = 1.5; y < 8; y += 1.6) for (const sx of [-1, 1]) out.push([sx * 2.2, y, GZ + 9.4, '#ffd27a']);
  // Strings of coloured bulbs across the street, sagging a little.
  const bulbs = ['#ff5a5a', '#ffd040', '#5ad0ff', '#80ff80', '#ff80e0'];
  for (let z = -34; z > SQUARE; z -= tier ? 16 : 32) for (let i = 0; i <= 20; i++) {
    const u = i / 20, x = -STREET - 2 + u * (2 * STREET + 4), y = 8.6 - Math.sin(u * Math.PI) * 1.6;
    out.push([x, y, z, bulbs[i % bulbs.length]]);
  }
  // Lamps on the kalasams' tips.
  for (const [x, y, z] of tops) out.push([x, y + 0.3, z, '#ffd27a']);
  const rnd = mulberry(77);
  for (let i = 0; i < (tier ? 90 : 45); i++) { const a = -1.3 + rnd() * 2.6, d = 300 + rnd() * 320; out.push([Math.sin(a) * d, 1 + rnd() * 14, -Math.cos(a) * d - 40, rnd() < 0.8 ? '#ffd28a' : '#ffffff']); }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const figures = figuresTexture(), granite = graniteTexture();
  const paint = new Stone(paintColour), stone = new Stone(stoneColour);
  const tops = templeGeometry(paint, stone, tier);
  const lit = new Stone();
  const town = townGeometry(new Stone(), lit, tier);
  const objects = [
    paint.mesh(new THREE.MeshLambertMaterial({ map: figures, vertexColors: true, emissive: '#8a7c78', emissiveMap: figures })),
    stone.mesh(new THREE.MeshLambertMaterial({ map: granite, vertexColors: true, emissive: '#3a2418' })),
    town.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })),
    lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  // The forecourt where crackers stand: granite flags at the foot of the street.
  objects.push(forecourt({ rgb: [104, 92, 84], z0: -40, z1: 20, width: 24, tile: 2, joint: 'rgba(200,180,160,0.3)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier, tops),
    zone: { x0: -10, x1: 10, z0: -30, z1: -5 },
    // The 2D picture's dusk, darkened: deep blue overhead, violet lower down, a red-orange glow at the horizon.
    sky: ['#03061a', '#151a4e', '#6a3a78', '#e0704a'],
    fog: ['#4a3060', 340, 1500],
    clouds: { colour: '#c07090', count: tier ? 9 : 5, seed: 41 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#6a6ab0', '#2a1e18', 0.9],
    directional: [['#ffd0a0', 1.6, [-60, 30, 300]], ['#ffe0c8', 0.5, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
