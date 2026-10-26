/* Light Up the Skies — 3D tab: the Taj Mahal at night, seen from the raised forecourt across the reflecting pool.
   Loaded by world3d.js when the Taj Mahal is the chosen world. Built from simple shapes and one drawn texture: the whole
   monument is one mesh (plus its reflection on the normal tier). */
import * as THREE from './assets/vendor/three.module.min.js';
import { clamp, mulberry, at, ngon, forecourt, rangoli, LAYER } from './world3d.js';

const TAJ_Z = -215; // centre of the mausoleum
const POOL = { x: 5, z0: -36, z1: -162, y: -0.35 };
const MARBLE = '#f3eee6', SHADE = '#e2dace', GOLD = '#d9a74a', RED = '#a2492f', RED_DARK = '#7e3624';

// ---------- The texture: one atlas of carved and inlaid surfaces ----------
// Regions across u. A: the great arch (pishtaq). B: two storeys of smaller arches. C: plain stone. D: minaret inlay.
// E: the plinth's blind arches. F: red sandstone framed in white marble.
const R = { A: [0, 0.2], B: [0.2, 0.4], C: [0.4, 0.5], D: [0.5, 0.62], E: [0.62, 0.82], F: [0.82, 1] };
function atlasTexture() {
  const W = 1024, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), px = (r) => [r[0] * W, (r[1] - r[0]) * W];
  const arch = (x, y, w, h, fill) => {
    // A pointed arch, w wide, rising from y + h (its foot) to y (its apex).
    const rise = w * 0.62, spring = y + rise;
    g.beginPath();
    g.moveTo(x, y + h); g.lineTo(x, spring);
    g.quadraticCurveTo(x + w * 0.02, y + rise * 0.18, x + w / 2, y);
    g.quadraticCurveTo(x + w * 0.98, y + rise * 0.18, x + w, spring);
    g.lineTo(x + w, y + h); g.closePath();
    g.fillStyle = fill; g.fill();
  };
  const recess = (x, y, w, h, dark) => {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, dark ? '#4e463e' : '#8d8478'); gr.addColorStop(1, dark ? '#2f2924' : '#655c52');
    arch(x, y, w, h, gr);
  };
  const veins = (x0, w, a = 0.18) => {
    const r = mulberry(x0 | 0);
    g.strokeStyle = `rgba(150,140,125,${a})`; g.lineWidth = 1;
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(x0 + r() * w, r() * H); g.bezierCurveTo(x0 + r() * w, r() * H, x0 + r() * w, r() * H, x0 + r() * w, r() * H); g.stroke(); }
  };
  // Calligraphy and floral inlay: fine dark strokes and small coloured stones.
  const inlay = (x, y, w, h) => {
    const r = mulberry((x + y) | 0);
    g.fillStyle = '#2d2a28';
    for (let i = 0; i < (w * h) / 90; i++) g.fillRect(x + r() * w, y + r() * h, 1 + r() * 2.5, 1);
  };
  const flowers = (x, y, w, h) => {
    const r = mulberry((x * 7 + y) | 0), cols = ['#9b2f3a', '#3f6b45', '#c08a2e', '#2f4f7a'];
    for (let i = 0; i < 7; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(x + r() * w, y + r() * h, 1.6, 0, Math.PI * 2); g.fill(); }
  };

  g.fillStyle = MARBLE; g.fillRect(0, 0, W, H);
  {
    // A: a tall framed panel, a calligraphy band round it, the deep arch with a smaller one inside.
    const [x, w] = px(R.A);
    g.fillStyle = '#e9e2d6'; g.fillRect(x + 4, 4, w - 8, H - 4);
    g.strokeStyle = '#b9ae9e'; g.lineWidth = 3; g.strokeRect(x + 9, 9, w - 18, H - 9);
    inlay(x + 11, 11, w - 22, 9); inlay(x + 11, 11, 9, H - 11); inlay(x + w - 20, 11, 9, H - 11);
    recess(x + 26, 34, w - 52, H - 34);
    flowers(x + 22, 26, 22, 30); flowers(x + w - 44, 26, 22, 30);
    recess(x + 46, 98, w - 92, H - 98, true);
    g.strokeStyle = '#d6cbb9'; g.lineWidth = 2; g.strokeRect(x + 46, 70, w - 92, 18);
    veins(x, w, 0.1);
  }
  {
    // B: two storeys, each a framed bay with a pointed arch.
    const [x, w] = px(R.B);
    for (let r = 0; r < 2; r++) {
      const y = 6 + r * 125;
      g.fillStyle = '#ebe4d8'; g.fillRect(x + 6, y, w - 12, 119);
      g.strokeStyle = '#c3b8a7'; g.lineWidth = 2; g.strokeRect(x + 10, y + 4, w - 20, 111);
      inlay(x + 12, y + 6, w - 24, 5);
      recess(x + 28, y + 22, w - 56, 93);
      recess(x + 46, y + 48, w - 92, 67, true);
      flowers(x + 14, y + 12, 18, 14); flowers(x + w - 32, y + 12, 18, 14);
    }
  }
  { const [x, w] = px(R.C); veins(x, w); }
  {
    // D: minaret shafts: white marble, thin dark inlay in vertical panels and bands.
    const [x, w] = px(R.D);
    g.strokeStyle = '#3a3633'; g.lineWidth = 1.2;
    for (let i = 0; i <= 4; i++) { const lx = x + (i / 4) * w; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, H); g.stroke(); }
    for (let y = 16; y < H; y += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
    veins(x, w, 0.12);
  }
  {
    // E: blind arches along the plinth.
    const [x, w] = px(R.E);
    g.fillStyle = '#e6dfd2'; g.fillRect(x, 0, w, H);
    g.strokeStyle = '#c4b9a8'; g.lineWidth = 3; g.strokeRect(x + 10, 30, w - 20, H - 40);
    recess(x + 34, 60, w - 68, H - 70);
    g.fillStyle = '#d4c9b8'; g.fillRect(x, 0, w, 14);
  }
  {
    // F: red sandstone with white marble framing a pointed arch.
    const [x, w] = px(R.F);
    g.fillStyle = RED; g.fillRect(x, 0, w, H);
    g.strokeStyle = '#efe6d8'; g.lineWidth = 4; g.strokeRect(x + 10, 18, w - 20, H - 18);
    arch(x + 28, 50, w - 56, H - 50, '#efe6d8');
    arch(x + 34, 58, w - 68, H - 58, '#5a2418');
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 22) g.fillRect(x, y, w, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Builder: merges every surface into one geometry (vertex colours tint the atlas) ----------
class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  push(p, n, uv, c) { this.pos.push(...p); this.nor.push(...n); this.uv.push(...uv); this.col.push(c.r, c.g, c.b); }
  // A wall from (x0, z0) to (x1, z1), y0 to y1, facing away from the inside of a shape traced in that order; its
  // surface tiles `cols` x `rows` times with an atlas region.
  wall(x0, z0, x1, z1, y0, y1, region = R.C, cols = 1, rows = 1, color = MARBLE) {
    const c = new THREE.Color(color), dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1, n = [dz / len, 0, -dx / len];
    const [u0, u1] = region, plain = region === R.C;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i / cols, b = (i + 1) / cols, ya = y0 + ((y1 - y0) * j) / rows, yb = y0 + ((y1 - y0) * (j + 1)) / rows;
        const P = (t, y) => [x0 + dx * t, y, z0 + dz * t];
        const U = (s, v) => (plain ? [(u0 + u1) / 2, 0.5] : [u0 + (u1 - u0) * s, v]);
        const p00 = P(a, ya), p10 = P(b, ya), p11 = P(b, yb), p01 = P(a, yb);
        for (const [p, uv] of [[p00, U(0, 0)], [p11, U(1, 1)], [p10, U(1, 0)], [p00, U(0, 0)], [p01, U(0, 1)], [p11, U(1, 1)]]) this.push(p, n, uv, c);
      }
    }
    return this;
  }
  // A closed ring of walls round a polygon (corners in order of increasing angle).
  walls(pts, y0, y1, region, cols = 1, rows = 1, color) {
    for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; this.wall(x0, z0, x1, z1, y0, y1, region, cols, rows, color); }
    return this;
  }
  // A flat polygon (convex) at height y, facing up.
  cap(pts, y, color = SHADE) {
    const c = new THREE.Color(color);
    for (let i = 1; i < pts.length - 1; i++) {
      for (const [x, z] of [pts[0], pts[i + 1], pts[i]]) this.push([x, y, z], [0, 1, 0], [(R.C[0] + R.C[1]) / 2, 0.5], c);
    }
    return this;
  }
  // Any three.js geometry: plain stone (region C), or its own UVs squeezed into a region.
  add(geo, color = MARBLE, m = null, region = R.C) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null, c = new THREE.Color(color);
    for (let i = 0; i < p.length / 3; i++) {
      const u = region === R.C ? 0.5 : clamp(uv ? uv[i * 2] : 0.5, 0, 1), v = region === R.C ? 0.5 : clamp(uv ? uv[i * 2 + 1] : 0.5, 0, 1);
      this.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]], [region[0] + (region[1] - region[0]) * u, v], c);
    }
    geo.dispose(); if (g !== geo) g.dispose();
    return this;
  }
  box(w, h, d, x, y, z, color, region) { return this.add(new THREE.BoxGeometry(w, h, d), color, at(x, y + h / 2, z), region); }
  cyl(r0, r1, h, seg, x, y, z, color) { return this.add(new THREE.CylinderGeometry(r1, r0, h, seg), color, at(x, y + h / 2, z)); }
  dome(r, h, x, y, z, seg, color = MARBLE) { return this.add(onion(r, h, seg), color, at(x, y, z)); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
// Polygon corners round (cx, cz): n sides, radius r, in order of increasing angle.
// The Taj's onion dome profile.
const ONION = [[0.76, 0], [0.9, 0.07], [0.99, 0.18], [1, 0.3], [0.94, 0.44], [0.78, 0.58], [0.55, 0.71], [0.3, 0.83], [0.12, 0.93], [0.05, 1], [0, 1]];
const onion = (r, h, seg) => new THREE.LatheGeometry(ONION.map(([a, b]) => new THREE.Vector2(a * r, b * h)), seg);

// A chhatri: an open drum of arches, a slab, a dome and a gold finial.
function chhatri(b, x, y, z, r, seg) {
  b.walls(ngon(8, r, x, z, Math.PI / 8), y, y + r * 1.15, R.B, 1, 1);
  b.cap(ngon(8, r * 1.18, x, z, Math.PI / 8), y + r * 1.15, SHADE).cyl(r * 1.18, r * 1.18, r * 0.16, 8, x, y + r * 1.15, z, SHADE);
  b.dome(r * 1.02, r * 1.55, x, y + r * 1.3, z, seg);
  b.cyl(r * 0.08, r * 0.05, r * 0.7, 6, x, y + r * 2.8, z, GOLD);
}

// The mausoleum: the plinth, the chamfered hall with its arches, the great dome on its drum, four chhatris and the
// four minarets. Centred on the origin; placed at TAJ_Z.
function tajGeometry(seg) {
  const b = new Builder(), s = 28.5, c = 9.5, base = 7, top = 34;
  // Plinth: blind arches round its sides, marble on top.
  b.walls([[48, -48], [48, 48], [-48, 48], [-48, -48]], 0, base, R.E, 14, 1);
  b.cap([[48, -48], [48, 48], [-48, 48], [-48, -48]], base, '#e8e1d5');
  // Main hall: eight faces. The four broad faces each carry a great arch that rises above the roof, flanked by two
  // storeys of smaller arches; the chamfered corners carry two storeys too.
  const corners = [[s, -s + c], [s, s - c], [s - c, s], [-s + c, s], [-s, s - c], [-s, -s + c], [-s + c, -s], [s - c, -s]];
  for (let i = 0; i < 8; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 8];
    if (i % 2) { b.wall(x0, z0, x1, z1, base, top, R.B, 1, 1); continue; }
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
    const side = (len - 22) / 2, P = (t) => [x0 + ux * t, z0 + uz * t];
    const [ax, az] = P(side), [bx, bz] = P(len - side), f = 1.3; // the arch stands a little proud of the wall
    b.wall(x0, z0, ax, az, base, top, R.B, 1, 1).wall(bx, bz, x1, z1, base, top, R.B, 1, 1);
    b.wall(ax + nx * f, az + nz * f, bx + nx * f, bz + nz * f, base, top + 4.5, R.A, 1, 1);
    b.wall(ax, az, ax + nx * f, az + nz * f, base, top + 4.5).wall(bx + nx * f, bz + nz * f, bx, bz, base, top + 4.5);
    b.cap([[ax, az], [ax + nx * f, az + nz * f], [bx + nx * f, bz + nz * f], [bx, bz]], top + 4.5);
    b.wall(bx, bz, ax, az, top, top + 4.5); // the back of the raised arch, above the roof
  }
  b.cap(corners, top, SHADE);
  b.walls(corners.map(([x, z]) => [x * 1.005, z * 1.005]), top, top + 1.4, R.C, 1, 1, SHADE); // parapet
  // Drum and great dome, with a gold finial.
  b.walls(ngon(16, 14.2), top, top + 7.5, R.B, 1, 1);
  b.cap(ngon(16, 14.2), top + 7.5, SHADE);
  b.dome(18.3, 27, 0, top + 7.3, 0, seg);
  b.cyl(0.65, 0.35, 9, 6, 0, top + 34, 0, GOLD).add(new THREE.SphereGeometry(1.1, 10, 8), GOLD, at(0, top + 35.5, 0)).add(new THREE.SphereGeometry(0.7, 8, 6), GOLD, at(0, top + 38, 0));
  for (const [x, z] of [[17.5, 17.5], [-17.5, 17.5], [17.5, -17.5], [-17.5, -17.5]]) chhatri(b, x, top + 0.2, z, 4.3, Math.max(10, seg - 6));
  // Minarets at the plinth's corners: three storeys with balconies, a chhatri on top.
  for (const [x, z] of [[42, 42], [-42, 42], [42, -42], [-42, -42]]) {
    let y = base, r = 3.1;
    for (const h of [14, 13, 12]) {
      const r2 = r * 0.92;
      for (let k = 0; k < 12; k++) {
        const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2;
        // A gently tapering face: the bottom and top edges come from the two radii.
        const q = new THREE.BufferGeometry(), p = [];
        const v = (a, rr, yy) => [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr];
        p.push(...v(a0, r, y), ...v(a1, r2, y + h), ...v(a1, r, y), ...v(a0, r, y), ...v(a0, r2, y + h), ...v(a1, r2, y + h));
        q.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        q.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
        q.computeVertexNormals();
        b.add(q, MARBLE, null, R.D);
      }
      y += h; r = r2;
      b.cyl(r * 1.45, r * 1.25, 1, 14, x, y - 0.2, z, SHADE); // balcony
    }
    chhatri(b, x, y + 0.8, z, 3, 10);
  }
  return b.build();
}

// Mosque and its twin (the jawab): red sandstone halls with marble-framed arches and three marble domes.
function mosque(b, x, z, seg) {
  const w = 58, d = 22, h = 15;
  // Traced round the outside in order of increasing angle, so every wall faces out; the arched front faces you.
  b.wall(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, R.C, 1, 1, RED);
  b.wall(x + w / 2, z + d / 2, x - w / 2, z + d / 2, 0, h, R.F, 5, 1, '#ffffff');
  b.wall(x - w / 2, z + d / 2, x - w / 2, z - d / 2, 0, h, R.C, 1, 1, RED).wall(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 0, h, R.C, 1, 1, RED);
  b.cap([[x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2], [x - w / 2, z - d / 2]], h, RED_DARK);
  for (const [dx, r] of [[0, 6], [-17, 4.2], [17, 4.2]]) {
    b.cyl(r * 0.86, r * 0.86, 2.4, 16, x + dx, h, z, MARBLE);
    b.dome(r, r * 1.7, x + dx, h + 2.2, z, seg);
    b.cyl(r * 0.07, r * 0.04, r * 0.6, 6, x + dx, h + 2.2 + r * 1.7, z, GOLD);
  }
  for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) {
    b.walls(ngon(8, 1.8, x + dx, z + dz, Math.PI / 8), 0, h + 3, R.C, 1, 1, RED);
    chhatri(b, x + dx, h + 3, z + dz, 1.9, 8);
  }
}

// Gardens, walks, the terrace, cypresses and trees: everything that isn't the Taj or water. The ground has an
// opening for the pool, so the reflection underneath shows through the water.
function groundGeometry(tier) {
  const b = new Builder();
  const plane = (x0, x1, z0, z1, y, color) => b.cap([[x1, z0], [x1, z1], [x0, z1], [x0, z0]], y, color);
  const earth = '#1b1914', grass = '#25402a', walk = '#8a7766', stone = '#9c8c7c';
  plane(-900, 900, POOL.z0, 120, 0, earth);
  plane(-900, -POOL.x, POOL.z1, POOL.z0, 0, grass);
  plane(POOL.x, 900, POOL.z1, POOL.z0, 0, grass);
  plane(-900, 900, -1400, POOL.z1, 0, earth);
  // Each layer stands LAYER above the one it lies on, so far ones never fight for depth.
  plane(-POOL.x - 4, -POOL.x, POOL.z1, POOL.z0, LAYER, walk);
  plane(POOL.x, POOL.x + 4, POOL.z1, POOL.z0, LAYER, walk);
  plane(-165, 165, -330, POOL.z1, LAYER, RED); // the sandstone terrace the Taj stands on
  plane(-60, 60, POOL.z1 - 6, POOL.z1, 2 * LAYER, stone);
  plane(-30, -POOL.x, -104, -92, LAYER, walk); plane(POOL.x, 30, -104, -92, LAYER, walk); // the cross walk
  // The marble platform at the garden's centre.
  for (const sx of [-1, 1]) b.box(5.5, 0.7, 20, sx * (POOL.x + 2.75), 0, -98, '#e9e2d6');
  // The pool's marble kerb.
  for (const sx of [-1, 1]) b.box(0.6, 0.4, POOL.z0 - POOL.z1, sx * (POOL.x + 0.3), 0, (POOL.z0 + POOL.z1) / 2, '#ddd5c8');
  for (const zz of [POOL.z0, POOL.z1]) b.box(POOL.x * 2 + 1.2, 0.4, 0.6, 0, 0, zz, '#ddd5c8');
  const rnd = mulberry(11);
  // Lantern posts along both walks, as in the 2D picture.
  for (let z = POOL.z0 - 8; z > POOL.z1; z -= 16) for (const sx of [-1, 1]) {
    const x = sx * (POOL.x + 4.4);
    b.cyl(0.13, 0.09, 3, 6, x, 0, z, '#1c1b1d');
    b.box(0.5, 0.6, 0.5, x, 3, z, '#ffd27a');
  }
  // Cypress rows along the walks.
  for (let z = POOL.z0 - 6; z > POOL.z1 + 4; z -= tier ? 9 : 15) {
    for (const sx of [-1, 1]) {
      const x = sx * (POOL.x + 7.5);
      b.add(new THREE.ConeGeometry(1.6, 9.5, tier ? 8 : 6), '#1f3d27', at(x, 5.6, z));
      b.add(new THREE.CylinderGeometry(0.22, 0.28, 1.2, 5), '#3a2a1c', at(x, 0.6, z));
    }
  }
  // Broad trees in the garden.
  for (let i = 0; i < (tier ? 54 : 22); i++) {
    const sx = rnd() < 0.5 ? -1 : 1, x = sx * (22 + rnd() * 125), z = POOL.z0 - 10 - rnd() * 120, r = 3 + rnd() * 3.5;
    b.add(new THREE.IcosahedronGeometry(r, tier ? 1 : 0), rnd() < 0.5 ? '#1c3824' : '#24472c', at(x, r * 1.4, z));
    b.add(new THREE.CylinderGeometry(0.3, 0.4, r, 5), '#3a2a1c', at(x, r * 0.4, z));
  }
  // Red sandstone walls closing the garden at the sides, with domed corner towers.
  for (const sx of [-1, 1]) {
    b.box(2, 7, 300, sx * 168, 0, -170, RED);
    for (const zz of [-30, -320]) { b.walls(ngon(8, 4, sx * 168, zz, Math.PI / 8), 0, 12, R.C, 1, 1, RED); chhatri(b, sx * 168, 12, zz, 4, 10); }
  }
  mosque(b, -118, TAJ_Z, tier ? 16 : 10);
  mosque(b, 118, TAJ_Z, tier ? 16 : 10);
  return b.build();
}

// Diyas lining the pool, the platform, the plinth and the forecourt; lamps along the walks. [x, y, z, colour]
function lightSpots(tier) {
  const out = [], diya = '#ffa63c', lamp = '#ffe6a8', step = tier ? 2.5 : 4;
  for (let z = POOL.z0 - 1; z > POOL.z1; z -= step) for (const sx of [-1, 1]) out.push([sx * (POOL.x + 0.3), 0.55, z, diya]);
  for (let x = -POOL.x; x <= POOL.x; x += 1.4) out.push([x, 0.55, POOL.z0 + 0.3, diya]);
  for (let x = -46; x <= 46; x += tier ? 3 : 5) out.push([x, 7.35, TAJ_Z + 48.6, diya]);
  for (const sx of [-1, 1]) for (let z = -88.5; z > -108; z -= 2.2) out.push([sx * (POOL.x + 5.3), 0.9, z, diya]);
  for (let x = -36; x <= 36; x += 2.4) out.push([x, 0.3, POOL.z0 + 1.6, diya]);
  for (let z = POOL.z0 - 8; z > POOL.z1; z -= 16) for (const sx of [-1, 1]) for (const dy of [0.2, 0.45]) out.push([sx * (POOL.x + 4.4), 3 + dy, z, lamp]);
  return out;
}

/** The scene, for world3d.js: its meshes, lights and the spots where diyas glow. */
export function build({ tier }) {
  const atlas = atlasTexture();
  const stone = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, emissive: '#191619' });
  const taj = new THREE.Mesh(tajGeometry(tier ? 28 : 16), stone);
  taj.position.set(0, 0, TAJ_Z);
  const objects = [taj, new THREE.Mesh(groundGeometry(tier), stone)];
  if (tier) {
    // The reflection: the Taj mirrored below the water line, seen through the pool's dark, translucent surface.
    const mirror = new THREE.Mesh(taj.geometry, new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, color: '#8088a8', emissive: '#08070a' }));
    mirror.scale.y = -1; mirror.position.set(0, POOL.y * 2, TAJ_Z);
    objects.push(mirror);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL.x * 2, POOL.z0 - POOL.z1),
    new THREE.MeshBasicMaterial({ color: '#0a1430', transparent: true, opacity: tier ? 0.5 : 0.92, depthWrite: false }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, POOL.y, (POOL.z0 + POOL.z1) / 2);
  water.renderOrder = 1;
  objects.push(water, forecourt({ rgb: [112, 60, 46], z0: POOL.z0, z1: 32, width: 76 }), rangoli(0, -18));
  return {
    objects, spots: lightSpots(tier),
    // The 2D picture's night: deep blue, starry, going purple and pink at the horizon, a few soft clouds.
    sky: ['#02061a', '#121a4e', '#4a3a8a', '#c06a7a'],
    fog: ['#3e3070', 320, 1500],
    clouds: { colour: '#8a6ab0', count: tier ? 8 : 4, seed: 4 },
    // Moonlight from behind and warm floodlights on the facade; the sky fills the shadows.
    hemi: ['#6a74b8', '#22180f', 1.05],
    directional: [['#b8c6ff', 0.4, [300, 380, -500]], ['#ffdcae', 1.6, [-90, 70, 300]], ['#ffe8cc', 0.45, [140, 40, 260]]],
  };
}
