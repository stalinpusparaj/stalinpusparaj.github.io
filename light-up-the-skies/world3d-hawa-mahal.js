/* Light Up the Skies — 3D background: the Hawa Mahal, Jaipur, on Diwali night, seen across the Sireh Deori Bazaar from
   a paved square in the Pink City. Loaded by world3d.js when the Hawa Mahal is the chosen world. Its colours follow the
   game's 2D Hawa Mahal picture: a deep blue sky going purple and then orange at the horizon, the pink sandstone glowing
   salmon under the floodlights, every window lit gold, the bazaar arcades bright beneath.

   Proportions follow the real palace's street front: a screen of five storeys stepping in to a crown, about 15 m from
   its high base and about 26 m to the top finial over the street arcade, built of columns of semi-hexagonal jharokhas
   (oriels) about 2.6 m across, each storey's oriel under its own eave, each column capped by a small dome where the
   pyramid steps in; 953 latticed windows in all (drawn here as one sheet of window decals, fewer on the low tier).
   Everything is a box, a half-hexagon prism or a lathe, merged into a few meshes; the floodlighting (warm light grazing
   up the facade) is baked into vertex colours.

   Frame: +x to your right, +y up, +z towards you; the facade's front face stands at z = HZ, centred on x = 0. */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, forecourt, rangoli, LAYER } from './world3d.js';

const HZ = -77; // the facade's front, across the bazaar road from you
const ROAD = { z0: -61, z1: -41 }; // the bazaar road; the square runs from its near kerb to you
const SQ = 21; // the square's half-width; the bazaar arcades line it
const ARCADE = 4.5, AHW = 26; // the street arcade under the palace: its height and half-width
// The five storeys over the arcade and the crown: [bottom, top, half-width]. Each steps in by one column of oriels.
const LEVELS = [[4.5, 8, 22], [8, 11.4, 18.8], [11.4, 14.6, 15.4], [14.6, 17.6, 12], [17.6, 20.4, 8.5], [20.4, 22.8, 5]];
const COL = 3.4, BAY = 1.3; // oriel columns' spacing, and an oriel's radius (a half hexagon 2.6 m across)

// ---------- Sandstone: pink, faintly coursed and mottled, one tile per 4 m ----------
function stoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry(23), px = 256 / 4;
  g.fillStyle = '#f6e8e2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 0.4 * px) {
    let x = -rnd() * 30;
    while (x < 256) {
      const w = (0.8 + rnd() * 0.8) * px, v = 0.92 + rnd() * 0.08;
      g.fillStyle = `rgb(${(246 * v) | 0},${(232 * v) | 0},${(226 * v) | 0})`; g.fillRect(x + 1, y + 1, w - 2, 0.4 * px - 1.5);
      x += w;
    }
    g.fillStyle = 'rgba(110,60,50,0.25)'; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,60,50,${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  return t;
}

// ---------- Windows: a jharokha's latticed arch (left half) and a lit shop arch (right half), on one sheet ----------
function windowTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const arch = (x, y, w, h) => { const r = w / 2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); };
  const glow = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  // The jharokha: a white-lined frame, warm light through a diamond lattice.
  arch(12, 4, 104, 122); g.fillStyle = '#ffeedd'; g.fill();
  arch(22, 14, 84, 108); g.fillStyle = glow(14, 122, '#ffe9a0', '#ff9a3a'); g.fill();
  g.save(); arch(22, 14, 84, 108); g.clip();
  g.strokeStyle = 'rgba(120,45,20,0.6)'; g.lineWidth = 2.5;
  for (let k = -120; k < 140; k += 12) { g.beginPath(); g.moveTo(22 + k, 14); g.lineTo(22 + k + 108, 122); g.stroke(); g.beginPath(); g.moveTo(22 + k, 122); g.lineTo(22 + k + 108, 14); g.stroke(); }
  g.restore();
  // The shop arch: a pale frame, a bright interior over a darker counter.
  arch(136, 4, 112, 122); g.fillStyle = '#ffe2c8'; g.fill();
  arch(144, 12, 96, 114); g.fillStyle = glow(12, 126, '#fff2c0', '#ffa848'); g.fill();
  g.fillStyle = 'rgba(110,40,20,0.55)'; g.fillRect(144, 100, 96, 26);
  g.fillStyle = 'rgba(120,50,25,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(150 + i * 15, 70 + (i % 2) * 8, 10, 30 - (i % 2) * 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const JHAROKHA = [0, 0.5], SHOP = [0.5, 1];

// Window quads, each turned rot about +y (0 faces you), tinted by vertex colour.
class Panes {
  constructor() { this.pos = []; this.uv = []; this.nor = []; this.col = []; }
  add([u0, u1], x, y, z, w, h, rot = 0, tint = '#ffffff') {
    const cs = Math.cos(rot), sn = Math.sin(rot), c = new THREE.Color(tint);
    const p = [[-w / 2, -h / 2, u0, 0], [w / 2, -h / 2, u1, 0], [w / 2, h / 2, u1, 1], [-w / 2, h / 2, u0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [a, b, u, v] = p[k];
      this.pos.push(x + a * cs, y + b, z - a * sn); this.uv.push(u, v); this.nor.push(sn, 0, cs); this.col.push(c.r, c.g, c.b);
    }
    return this;
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

// ---------- Merging shapes, laying the texture on in metres and colouring every vertex ----------
const tmpN = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpE = new THREE.Vector3();
class Merge {
  constructor(colour = null) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.colour = colour; }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
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
  // Half a hexagon in plan, standing out from a wall at z towards you: an oriel, an eave, a bracket (r0 at the bottom).
  oriel(x, y0, y1, z, r0, r1, color) { return this.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, 3, 1, false, -Math.PI / 2, Math.PI), color, at(x, (y0 + y1) / 2, z)); }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

// The floodlit pink of the picture: brightest low down where the floods graze up, sides and backs in shade.
const tmpCol = new THREE.Color();
function floodColour(x, y, z, n, base) {
  let k = 1.05 - clamp(y / 28, 0, 1) * 0.22 + Math.max(0, 1 - y / 7) * 0.1;
  if (n.z < -0.5) k *= 0.45; else if (Math.abs(n.x) > 0.7) k *= z > ROAD.z1 ? 1.25 : 0.85; // the bazaar fronts round the square, lit from the square
  return tmpCol.copy(base).multiplyScalar(k);
}

const PINK = '#ff9468', TRIM = '#ffd2b4', DOME = '#ffa070', SHADE = '#d8704e';
// A small onion dome on a drum, with its finial, standing at (x, y, z), radius r.
function dome(s, x, y, z, r, seg) {
  s.cyl(r * 0.85, r * 0.85, y, y + r * 0.35, x, z, seg, TRIM);
  s.lathe([[r, 0], [r * 1.08, r * 0.25], [r * 0.95, r * 0.7], [r * 0.6, r * 1.05], [r * 0.2, r * 1.3], [0, r * 1.38]], x, y + r * 0.35, z, seg, DOME);
  s.cyl(r * 0.06, r * 0.03, y + r * 1.65, y + r * 2.2, x, z, 4, TRIM);
}

// The Hawa Mahal's street front: the arcade, then columns of oriels stepping in storey by storey to the crown.
function palaceGeometry(s, panes, tier) {
  const Z = HZ, seg = tier ? 8 : 6, rc = BAY * Math.cos(Math.PI / 6); // rc: an oriel face's distance from its axis
  // The street arcade, its base course and the cornice over it.
  s.box(-AHW, AHW, 0, ARCADE, Z - 9, Z, PINK).box(-AHW - 0.3, AHW + 0.3, 0, 0.5, Z - 9, Z + 0.3, SHADE);
  s.box(-AHW - 0.2, AHW + 0.2, ARCADE - 0.3, ARCADE, Z - 9, Z + 0.9, TRIM);
  for (let x = -23.8; x <= 23.9; x += COL) panes.add(SHOP, x, 2.25, Z + 0.03, 2.4, 3.3);
  for (let i = 0; i < LEVELS.length; i++) {
    const [y0, y1, hw] = LEVELS[i], next = LEVELS[i + 1] ? LEVELS[i + 1][2] : 0, below = i ? LEVELS[i - 1][2] : AHW;
    const bh = y1 - y0 - 0.5; // an oriel's height under its eave
    s.box(-hw, hw, y0, y1, Z - (i < 2 ? 7 : 4), Z, PINK);
    s.box(-hw - 0.15, hw + 0.15, y1 - 0.2, y1, Z - 0.1, Z + 0.45, TRIM); // the white-lined string course
    // The terrace where the storey below steps out: a low parapet along its front, small domes on it.
    for (const sx of [-1, 1]) {
      s.box(sx * hw, sx * below, y0, y0 + 0.7, Z + 0.05, Z + 0.4, TRIM);
      if (i && tier) dome(s, sx * (hw + (below - hw) / 2), y0 + 0.7, Z + 0.2, 0.42, 6);
    }
    for (let k = -6; k <= 6; k++) {
      const x = k * COL;
      if (Math.abs(x) + BAY + 0.3 > hw) continue;
      s.oriel(x, y0 + 0.1, y0 + 0.1 + bh, Z, BAY, BAY, PINK); // the oriel
      s.oriel(x, y0 + 0.1 + bh, y0 + 0.35 + bh, Z, BAY + 0.28, BAY + 0.28, TRIM); // its eave
      if (!i) s.oriel(x, y0 - 0.65, y0 + 0.1, Z, 0.35, BAY, PINK); // the bracket it springs from
      // Where this column ends (the pyramid steps in) it is capped by a dome.
      if (Math.abs(x) + BAY + 0.3 > next) dome(s, x, y0 + 0.35 + bh, Z + 0.55, x ? 1.05 : 1.6, seg);
      // The lattice windows on its three faces, a smaller one over the front.
      const wy = y0 + 0.1 + bh * 0.46, wh = Math.min(1.6, bh * 0.58);
      for (const a of [-Math.PI / 3, 0, Math.PI / 3]) panes.add(JHAROKHA, x + Math.sin(a) * (rc + 0.03), wy, Z + Math.cos(a) * (rc + 0.03), 0.74, wh, a, a ? '#ffd0a0' : '#ffffff');
      if (tier) panes.add(JHAROKHA, x, y0 + 0.1 + bh * 0.88, Z + rc + 0.03, 0.5, 0.36, 0, '#ffc890');
      // Between the oriels, small windows in the flat wall.
      if (tier && k < 6 && Math.abs(x + COL / 2) + 0.5 < hw) panes.add(JHAROKHA, x + COL / 2, wy, Z + 0.03, 0.42, wh * 0.75, 0, '#ffb878');
    }
  }
  // The crown: a pavilion over the middle column, with the highest dome.
  const top = LEVELS[LEVELS.length - 1][1];
  s.box(-1.9, 1.9, top, top + 1.5, Z - 2, Z + 1, PINK).box(-2.2, 2.2, top + 1.5, top + 1.75, Z - 2.3, Z + 1.3, TRIM);
  panes.add(JHAROKHA, 0, top + 0.72, Z + 1.03, 0.9, 1.1);
  dome(s, 0, top + 1.75, Z - 0.5, 1.7, seg);
  for (const sx of [-1, 1]) dome(s, sx * 1.75, top + 1.75, Z + 0.9, 0.42, 6);
  return s;
}

// A Pink City building fronting a street, its face at x = fx (facing dir: -1 left, +1 right) or at z = fz facing you.
// Arcaded shops below, windows above, a white-lined cornice and a parapet with small domes.
function cityFront(s, panes, tier, { x0, x1, z0, z1, h, face, rnd }) {
  const facingZ = face === 'z';
  s.box(x0, x1, 0, h, z0, z1, PINK);
  const len = facingZ ? x1 - x0 : z1 - z0, n = Math.max(1, Math.floor(len / 3.4)), step = len / n;
  const rot = facingZ ? 0 : face > 0 ? Math.PI / 2 : -Math.PI / 2;
  const fx = face > 0 ? x1 : x0;
  const P = (t, y, out) => facingZ ? [x0 + t, y, z1 + out] : [fx + face * out, y, z0 + t];
  // Cornice over the shops, cornice at the top, parapet.
  if (facingZ) s.box(x0 - 0.1, x1 + 0.1, 4.1, 4.4, z1 - 0.2, z1 + 0.8, TRIM).box(x0 - 0.1, x1 + 0.1, h - 0.3, h, z1 - 0.2, z1 + 0.5, TRIM).box(x0, x1, h, h + 0.8, z1 - 0.3, z1, TRIM);
  else {
    const [a, b] = face > 0 ? [x1 - 0.2, x1 + 0.8] : [x0 - 0.8, x0 + 0.2];
    s.box(a, b, 4.1, 4.4, z0 - 0.1, z1 + 0.1, TRIM).box(a, b - face * 0.3, h - 0.3, h, z0 - 0.1, z1 + 0.1, TRIM);
    s.box(face > 0 ? x1 - 0.3 : x0, face > 0 ? x1 : x0 + 0.3, h, h + 0.8, z0, z1, TRIM);
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * step;
    panes.add(SHOP, ...P(t, 2, 0.03), Math.min(2.4, step - 0.6), 3.2, rot, rnd() < 0.25 ? '#c88060' : '#ffffff');
    for (let y = 5.6; y + 1.6 < h; y += 3.2) if (rnd() < 0.8) panes.add(JHAROKHA, ...P(t, y, 0.03), 0.8, 1.4, rot, rnd() < 0.5 ? '#ffd8a8' : '#ff9e60');
    if (tier && i % 2) { const [x, , z] = P(t, 0, -0.15); dome(s, x, h + 0.8, z, 0.45, 6); }
  }
  return s;
}

// The rest of the street front either side of the palace, the bazaar arcades round the square, the city behind.
function cityGeometry(s, panes, tier) {
  const rnd = mulberry(41);
  // The palace's wings along the bazaar, two storeys, as in the picture; a taller tower on the right.
  for (const sx of [-1, 1]) {
    let x = AHW;
    while (x < 150) {
      const w = 10 + rnd() * 8, h = 9 + rnd() * 3;
      const [x0, x1] = sx > 0 ? [x, x + w] : [-x - w, -x];
      cityFront(s, panes, tier, { x0, x1, z0: HZ - 10, z1: HZ, h, face: 'z', rnd });
      x += w;
    }
  }
  s.box(34, 42, 0, 16, HZ - 12, HZ - 2, PINK).box(33.8, 42.2, 15.7, 16.1, HZ - 12.2, HZ - 1.8, TRIM);
  for (const [x, z] of [[34.5, HZ - 2.5], [41.5, HZ - 2.5], [34.5, HZ - 11.5], [41.5, HZ - 11.5]]) s.box(x - 0.25, x + 0.25, 16.1, 18.4, z - 0.25, z + 0.25, TRIM);
  s.box(33.6, 42.4, 18.4, 18.8, HZ - 12.4, HZ - 1.6, TRIM);
  dome(s, 38, 18.8, HZ - 7, 2.2, tier ? 8 : 6);
  for (const y of [11, 13.6]) for (const x of [36, 40]) panes.add(JHAROKHA, x, y, HZ - 1.97, 0.9, 1.6);
  s.box(-46, -36, 0, 13, HZ - 14, HZ - 3, PINK).box(-46.3, -35.7, 12.7, 13.1, HZ - 14.3, HZ - 2.7, TRIM);
  dome(s, -41, 13.1, HZ - 8.5, 1.8, tier ? 8 : 6);
  // The bazaar arcades either side of the square, facing in.
  for (const sx of [-1, 1]) {
    let z = 24;
    while (z > ROAD.z1 + 4) {
      const d = Math.min(z - ROAD.z1 - 4, 11 + rnd() * 6), h = 8 + rnd() * 4;
      const [x0, x1] = sx > 0 ? [SQ, SQ + 12] : [-SQ - 12, -SQ];
      cityFront(s, panes, tier, { x0, x1, z0: z - d, z1: z, h, face: -sx, rnd });
      z -= d;
    }
    // Across the road from the square, the corners of the street front facing you.
    const [x0, x1] = sx > 0 ? [SQ + 2, SQ + 30] : [-SQ - 30, -SQ - 2];
    cityFront(s, panes, tier, { x0, x1, z0: ROAD.z1 + 1 - 14, z1: ROAD.z1 + 1, h: 10, face: 'z', rnd });
  }
  // The old city behind: flat roofs and the odd dome rising over the street fronts.
  for (let i = 0; i < (tier ? 70 : 36); i++) {
    const x = -260 + rnd() * 520, z = HZ - 20 - rnd() * 260, w = 8 + rnd() * 14, d = 8 + rnd() * 14, h = 8 + rnd() * 12;
    if (Math.abs(x) < 28 && z > HZ - 40) continue; // keep the crown against the sky
    s.box(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2, '#a8604c');
    if (rnd() < 0.25) dome(s, x, h, z, 1.5 + rnd() * 1.5, 6);
  }
  for (let i = 0; i < 40; i++) {
    const sx = rnd() < 0.5 ? -1 : 1, x = sx * (SQ + 14 + rnd() * 120), z = 30 - rnd() * 110;
    s.box(x - 6, x + 6, 0, 9 + rnd() * 8, z - 6, z + 6, '#a8604c');
  }
  return s;
}

// The ground, the road, the kerbs, lamps, cars, trees and the Aravalli ridge with Nahargarh Fort.
function groundGeometry(s, lanterns, tier) {
  const plane = (x0, x1, z0, z1, y, color) => s.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), color, at((x0 + x1) / 2, y, (z0 + z1) / 2));
  const L1 = LAYER, L2 = 2 * LAYER;
  plane(-1500, 1500, -1500, 200, 0, '#17121a');
  plane(-400, 400, ROAD.z0, ROAD.z1, L1, '#26222c'); // the bazaar road
  plane(-400, 400, HZ - 12, ROAD.z0, L2, '#6a4a44'); // the pavement before the palace
  for (const z of [ROAD.z0, ROAD.z1]) s.box(-400, 400, 0, 0.3, z - 0.3, z, '#9a8a80'); // kerbs
  // The road's centre line and a zebra crossing from the square to the palace.
  for (let x = -396; x < 400; x += 8) if (Math.abs(x) > 6) s.box(x - 1.6, x + 1.6, L1, L2, -51.1, -50.9, '#d8d0c4');
  for (let x = -4.5; x <= 4.5; x += 1.1) s.box(x - 0.3, x + 0.3, L1, L2, ROAD.z0 + 1.5, ROAD.z1 - 1.5, '#d8d0c4');
  // Lamp standards: a dark post, a bracket, a lantern.
  const lamp = (x, z) => {
    s.cyl(0.14, 0.08, 0, 5.2, x, z, 6, '#1c1820');
    lanterns.box(x - 0.28, x + 0.28, 5.2, 5.9, z - 0.28, z + 0.28, '#ffd890');
    s.cyl(0.38, 0.04, 5.9, 6.3, x, z, 4, '#1c1820');
  };
  for (let z = 16; z > ROAD.z1; z -= 12) for (const sx of [-1, 1]) lamp(sx * (SQ - 3), z);
  for (let x = -60; x <= 60; x += 12) lamp(x + 6, ROAD.z0 - 1.5);
  // Cars on the road, as in the picture: a body and a cabin, dark and pale.
  const car = (x, z, dir, color) => {
    s.box(x - 2.2, x + 2.2, 0.3, 1.1, z - 0.9, z + 0.9, color).box(x - 1.2 - dir * 0.2, x + 1.2 - dir * 0.2, 1.1, 1.6, z - 0.8, z + 0.8, '#151520');
    for (const sx of [-1.6, 1.6]) for (const sz of [-0.85, 0.85]) s.cyl(0.33, 0.33, 0, 0.66, x + sx, z + sz, 6, '#0c0c10');
  };
  car(-14, -46, 1, '#3a3e48'); car(9, -46.5, 1, '#d8d8d8'); car(-30, -56, -1, '#6a1e22'); car(24, -56.5, -1, '#2a2a30');
  // Neem trees on the square's corners and among the roofs.
  const rnd = mulberry(8), tree = (x, z, r) => {
    s.add(new THREE.IcosahedronGeometry(r, tier ? 1 : 0), rnd() < 0.5 ? '#16261a' : '#1d3121', at(x, r * 1.4, z));
    s.cyl(0.35, 0.25, 0, r * 0.9, x, z, 5, '#2a1e16');
  };
  for (const sx of [-1, 1]) { tree(sx * (SQ - 1.5), 21, 3.2); tree(sx * (SQ - 1.2), ROAD.z1 + 2, 2.4); }
  for (let i = 0; i < (tier ? 30 : 14); i++) { const x = -300 + rnd() * 600; if (Math.abs(x) > 40) tree(x, HZ - 30 - rnd() * 200, 5 + rnd() * 4); }
  // The Aravalli ridge behind the city, with Nahargarh Fort's long wall along its crest.
  for (let i = 0; i < 9; i++) {
    const x = -900 + i * 210 + rnd() * 60, r = 160 + rnd() * 90;
    s.add(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.38 + rnd() * 0.12, 0.6), '#1d1624', at(x, 0, -820 - rnd() * 120));
  }
  return s;
}

// Diyas along every eave and terrace of the palace, round the square and the pavement; lanterns, shop lights, car lamps,
// the fort's lights on the ridge. [x, y, z, colour]
function lightSpots(tier) {
  const out = [], diya = '#ffa63c', lamp = '#ffe6a8', step = tier ? 2.4 : 4;
  for (let i = 0; i < LEVELS.length; i++) {
    const [y0, y1, hw] = LEVELS[i], bh = y1 - y0 - 0.5;
    for (let k = -6; k <= 6; k++) if (Math.abs(k * COL) + BAY + 0.3 <= hw && (tier || k % 2 === 0)) out.push([k * COL, y0 + 0.45 + bh, HZ + BAY + 0.35, diya]);
    for (let x = -hw; x <= hw; x += tier ? 1.7 : 3.4) out.push([x, y1 + 0.05, HZ + 0.5, '#ffbe5a']);
  }
  for (let x = -AHW; x <= AHW; x += step * 0.6) out.push([x, ARCADE + 0.05, HZ + 1, '#ffbe5a']);
  for (let z = 20; z > ROAD.z1; z -= step) for (const sx of [-1, 1]) out.push([sx * (SQ - 0.6), 0.25, z, diya]);
  for (let x = -40; x <= 40; x += step) { out.push([x, 0.3, ROAD.z0 - 0.4, diya]); out.push([x, 0.25, ROAD.z1 + 0.5, diya]); }
  for (let x = -AHW; x <= AHW; x += step) out.push([x, 0.6, HZ + 0.6, diya]);
  for (let z = 16; z > ROAD.z1; z -= 12) for (const sx of [-1, 1]) for (const dy of [0.15, 0.45]) out.push([sx * (SQ - 3), 5.4 + dy, z, lamp]);
  for (let x = -60; x <= 60; x += 12) for (const dy of [0.15, 0.45]) out.push([x + 6, 5.4 + dy, ROAD.z0 - 1.5, lamp]);
  // Car lamps: headlights white, tail lights red.
  for (const [x, z, dir] of [[-14, -46, 1], [9, -46.5, 1], [-30, -56, -1], [24, -56.5, -1]]) for (const sz of [-0.6, 0.6]) {
    out.push([x + dir * 2.25, 0.85, z + sz, '#fff4d8']); out.push([x - dir * 2.25, 0.85, z + sz, '#ff3a2a']);
  }
  // Nahargarh's lights along the ridge and the city's lights low on the horizon.
  const rnd = mulberry(77);
  for (let i = 0; i < (tier ? 60 : 30); i++) out.push([-500 + rnd() * 700, 55 + rnd() * 10, -800 - rnd() * 40, rnd() < 0.7 ? '#ffc870' : '#ffffff']);
  for (let i = 0; i < (tier ? 80 : 40); i++) { const a = -1.3 + rnd() * 2.6, d = 300 + rnd() * 300; out.push([Math.sin(a) * d, 3 + rnd() * 14, HZ - Math.cos(a) * d, rnd() < 0.7 ? '#ffd28a' : '#ffffff']); }
  return out;
}

/** The scene, for world3d.js: its meshes, lights, glowing spots and cracker zone. */
export function build({ tier }) {
  const map = stoneTexture();
  const lit = new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#4a1a0c' });
  const panes = new Panes(), lanterns = new Merge();
  const stone = new Merge(floodColour);
  palaceGeometry(stone, panes, tier);
  cityGeometry(stone, panes, tier);
  const objects = [stone.mesh(lit)];
  objects.push(groundGeometry(new Merge(), lanterns, tier).mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  objects.push(lanterns.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
  objects.push(panes.mesh(new THREE.MeshBasicMaterial({ map: windowTexture(), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
  // The square where crackers stand: pink sandstone slabs.
  objects.push(forecourt({ rgb: [116, 80, 78], z0: ROAD.z1, z1: 22, width: SQ * 2, tile: 2, joint: 'rgba(230,200,190,0.35)', y: 2 * LAYER }), rangoli(0, -18, 3 * LAYER));
  return {
    objects, spots: lightSpots(tier),
    zone: { x0: -9, x1: 9, z0: -30, z1: -5 },
    // The 2D picture's dusk: deep blue overhead, purple, an orange glow at the horizon, soft clouds; no moon on Diwali.
    sky: ['#03061a', '#16194c', '#6a3c78', '#e2774e'],
    fog: ['#4e2e5e', 320, 1500],
    clouds: { colour: '#b06a90', count: tier ? 9 : 5, seed: 21 },
    moon: null, stars: tier ? 120 : 60,
    hemi: ['#5a5aa0', '#2a1810', 0.85],
    // Floodlights from the street in front, a softer fill from the side, the sky from behind.
    directional: [['#ffb888', 1.7, [-30, 30, 300]], ['#ffd8b0', 0.45, [160, 40, 200]], ['#8e96c8', 0.3, [200, 300, -500]]],
  };
}
