/* Light Up the Skies — Pataka Chor's festival dressing, matched street by street to its eye-level concept (made in
   Google Flow): low-poly, flat-shaded, like the rest of the world. Every street gets what all the concepts share —
   paper lanterns hanging off the shop fronts, marigold garlands swagged along them, small rangolis down the street
   with diyas round them, diyas along the kerbs — in that street's own colours, plus its own goods out on the kerbs
   (bangles in Hyderabad, jasmine heaps in Madurai, candles at Velankanni...), palms by the sea, and bunting overhead.

   dress(THREE, def, tier, id) reads the street's play zone and returns { objects, spots }: one merged, unlit mesh (it
   glows at night without lights), one instanced mesh of marigold beads, and glowing points for lanterns and flames.
   Nothing here collides or is a target. */

// Each street's look, from its concept: lantern and rangoli colours, bunting (null: none), its goods, palms, jasmine.
const W = '#ffffff', PINK = '#ff5fa2', GOLD = '#ffd27a', SAFF = '#ff9a3c', RED = '#ff4d4d', BLUE = '#5fc8ff', GREEN = '#5fd07a', VIOLET = '#9b6bff';
const STYLE = {
  'chor-street': { lan: [PINK, GOLD, VIOLET, SAFF], ran: [PINK, GOLD, BLUE, SAFF], bun: [PINK, GOLD, BLUE, GREEN, SAFF], goods: ['sweets', 'fruit'] },
  'chor-lane': { lan: [GOLD, SAFF, RED], ran: [W, RED, GOLD, W], bun: null, goods: ['flowers', 'fruit'], jasmine: true },
  'chor-charminar': { lan: [GREEN, PINK, GOLD, VIOLET], ran: [PINK, GREEN, GOLD, VIOLET], bun: [GREEN, PINK, GOLD], goods: ['bangles', 'bangles', 'sweets'] },
  'chor-redfort': { lan: [RED, SAFF, GOLD], ran: [RED, GOLD, SAFF, W], bun: [RED, GOLD, SAFF, GREEN], goods: ['sweets', 'fruit'] },
  'chor-hawamahal': { lan: [PINK, '#ff8ab8', GOLD], ran: [PINK, GOLD, '#ff8ab8', W], bun: [PINK, GOLD, SAFF], goods: ['bangles', 'sweets'] },
  'chor-gateway': { lan: [BLUE, W, GOLD], ran: [BLUE, GOLD, W, PINK], bun: [BLUE, W, GOLD, PINK], goods: ['fruit', 'shells'], palms: true },
  'chor-mysore': { lan: [GOLD, '#ffe9a8', SAFF], ran: [GOLD, PINK, GREEN, W], bun: [GOLD, PINK, GREEN, BLUE], goods: ['sweets', 'flowers'] },
  'chor-taj': { lan: ['#ffc0dc', W, GOLD], ran: [PINK, W, GOLD, BLUE], bun: ['#ffc0dc', W, GOLD], goods: ['sweets', 'sweets'] },
  'chor-indiagate': { lan: [SAFF, W, GREEN], ran: [SAFF, W, GREEN, BLUE], bun: [SAFF, W, GREEN], goods: ['balloons', 'fruit'] },
  'chor-victoria': { lan: [RED, W, GOLD], ran: [W, RED, W, GOLD], bun: [RED, W, GOLD], goods: ['sweets', 'fruit'] },
  'chor-manor': { lan: [GOLD, W, PINK], ran: [GOLD, PINK, W, VIOLET], bun: [GOLD, W, PINK, BLUE], goods: ['sweets', 'balloons'] },
  'chor-konark': { lan: [SAFF, RED, GOLD], ran: [SAFF, RED, GOLD, W], bun: [SAFF, RED, GOLD, BLUE], goods: ['shells', 'fruit'], palms: true },
  'chor-goldentemple': { lan: [SAFF, GOLD, BLUE], ran: [SAFF, GOLD, BLUE, W], bun: null, goods: ['sweets', 'flowers'] },
  'chor-meenakshi': { lan: [GOLD, PINK, GREEN, SAFF], ran: [PINK, GREEN, GOLD, BLUE], bun: null, goods: ['flowers', 'bangles'], jasmine: true },
  'chor-thanjavur': { lan: [GOLD, SAFF, RED], ran: [W, RED, GOLD, GREEN], bun: null, goods: ['flowers', 'sweets'], jasmine: true },
  'chor-velankanni': { lan: [W, BLUE, GOLD], ran: [BLUE, W, GOLD, PINK], bun: [W, BLUE, GOLD], goods: ['candles', 'shells'], palms: true },
  'chor-cross': { lan: [W, BLUE, GOLD], ran: [BLUE, W, GOLD, GREEN], bun: [W, BLUE, GOLD, PINK], goods: ['candles', 'fruit'], palms: true },
  'chor-kanyakumari': { lan: [SAFF, GOLD, BLUE], ran: [SAFF, BLUE, GOLD, W], bun: [SAFF, GOLD, BLUE, W], goods: ['shells', 'fruit'], palms: true },
};
const BANGLES = ['#ff3d7f', '#ffd23c', '#3cc8ff', '#5fd07a', '#b07bff', '#ff8a1c'];

export function dress(THREE, def, tier, id) {
  const z = def.zone;
  if (!z) return { objects: [], spots: [] };
  const S = STYLE[id] || STYLE['chor-street'];
  const xl = z.x0 - 0.4, xr = z.x1 + 0.4, near = z.z1 - 2, far = z.z0 + 2, span = near - far;
  const pos = [], col = [], spots = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  // Adds a geometry, placed and coloured, to the merged mesh; its facets shade a little apart, as low-poly does.
  const put = (geo, hex, x, y, zz, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    m.compose(V.set(x, y, zz), q.setFromEuler(e.set(rx, ry, rz)), Sc.set(sx, sy, sz));
    const p = g.attributes.position, v = new THREE.Vector3();
    c.set(hex);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      const shade = 0.8 + 0.1 * ((i / 3 | 0) % 3);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
  };
  const flat = (pts, hex) => { c.set(hex); for (const [x, y, zz] of pts) { pos.push(x, y, zz); col.push(c.r, c.g, c.b); } };
  const oct = new THREE.OctahedronGeometry(0.24, 0), cap = new THREE.CylinderGeometry(0.09, 0.12, 0.08, 6), tassel = new THREE.ConeGeometry(0.05, 0.26, 5);
  const cup = new THREE.CylinderGeometry(0.13, 0.08, 0.09, 6), box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.IcosahedronGeometry(1, 0);
  const ring = new THREE.TorusGeometry(0.16, 0.025, 3, 8), cone = new THREE.ConeGeometry(1, 1, 5), tube = new THREE.CylinderGeometry(1, 1, 1, 6);
  const sides = [z.x0, z.x1], inward = (x) => (x < 0 ? 1 : -1);

  // Lanterns hanging off the shop fronts on both sides, every few metres, each in the street's colours.
  const lstep = tier ? 4.5 : 7;
  sides.forEach((x0, s) => {
    for (let zz = near - s * lstep / 2, i = 0; zz >= far; zz -= lstep, i++) {
      const x = x0 - inward(x0) * 0.3, y = 4.3 + 0.35 * ((i + s) % 2), hex = S.lan[(i + s) % S.lan.length];
      put(oct, hex, x, y, zz, 1, 1.45, 1, i * 0.7);
      put(cap, '#e8b04a', x, y + 0.36, zz); put(cap, '#e8b04a', x, y - 0.36, zz);
      put(tassel, hex, x, y - 0.55, zz, 1, 1, 1, 0, Math.PI);
      put(tube, '#3a2a1a', x, y + 0.8, zz, 0.012, 0.8, 0.012); // its cord
      spots.push([x, y, zz, hex]);
    }
  });
  // Bunting across the street, high, where the street has it.
  if (S.bun && tier) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.28, 0, 0.17, 0, 0, -0.17, 0, 0, 0, -0.28, 0], 3));
    for (let zz = near - 4; zz >= far; zz -= 16) { const n = Math.round((xr - xl) / 0.6); for (let i = 0; i <= n; i++) { const t = i / n; put(tri, S.bun[i % S.bun.length], xl + (xr - xl) * t, 8.2 - 0.35 * Math.sin(t * Math.PI), zz); } }
  }
  // Diyas along both kerbs.
  const step = tier ? 2.4 : 4.5;
  for (let zz = near; zz >= far; zz -= step) for (const x of [z.x0 + 0.2, z.x1 - 0.2]) { put(cup, '#b4532a', x, 0.05, zz); spots.push([x, 0.2, zz, '#ffb347']); }

  // Rangolis down the street, small, alternating sides of the middle, each ringed with diyas: a flower of petals.
  const own = def.objects.some((o) => o.userData && o.userData.rangoli), n = own ? 2 : 3;
  const v0f = !def.wares && def.views && def.views[0];
  for (let k = 0; k < n; k++) {
    const cx = k === 0 && v0f ? v0f.x : (k % 2 ? 1 : -1) * Math.min(2.2, (z.x1 - z.x0) / 5), R = 1.3, [a, b, cc, d] = S.ran;
    // Not under a viewpoint: its diyas would glow right in front of the lens.
    let cz = near - span * (k + 0.5) / n;
    const v0 = !def.wares && def.views && def.views[0]; // (not in the shop: you come in indoors)
    if (k === 0 && v0) { cz = v0.z - 15; } // the first right in front of where you arrive
    for (let t = 0; t < 12 && (def.views || []).some((v) => Math.hypot(v.x - cx, v.z - cz) < 6); t++) cz -= 2;
    if (cz < far) continue;
    const petal = (r0, r1, cnt, hex, off) => { for (let i = 0; i < cnt; i++) { const a0 = ((i + off) / cnt) * Math.PI * 2, a1 = ((i + off + 1) / cnt) * Math.PI * 2, am = (a0 + a1) / 2;
      flat([[cx + Math.cos(a0) * r0, 0.12, cz + Math.sin(a0) * r0], [cx + Math.cos(am) * r1, 0.12, cz + Math.sin(am) * r1], [cx + Math.cos(a1) * r0, 0.12, cz + Math.sin(a1) * r0]], hex); } };
    petal(R * 0.75, R * 1.15, 8, a, 0); petal(R * 0.55, R * 0.9, 8, b, 0.5); petal(R * 0.3, R * 0.62, 6, cc, 0); petal(0, R * 0.34, 5, d, 0.5);
    for (let i = 0; i < (tier ? 8 : 5); i++) { const t = (i / (tier ? 8 : 5)) * Math.PI * 2, x = cx + Math.cos(t) * R * 1.45, zz = cz + Math.sin(t) * R * 1.45; put(cup, '#b4532a', x, 0.05, zz); spots.push([x, 0.2, zz, '#ffb347']); }
  }

  // The street's goods, out on the kerbs in front of the stalls.
  const goods = {
    bangles: (x, zz, ix) => { put(box, '#5a3a22', x, 0.35, zz, 0.7, 0.7, 0.9); for (let r = 0; r < 3; r++) for (let j = 0; j < 4; j++) put(ring, BANGLES[(r * 4 + j) % BANGLES.length], x, 0.75 + j * 0.045, zz - 0.28 + r * 0.28, 1, 1, 1, 0, Math.PI / 2); },
    flowers: (x, zz) => { put(tube, '#7a4a22', x, 0.18, zz, 0.42, 0.36, 0.42); put(ball, '#ff8a1c', x, 0.42, zz - 0.12, 0.3, 0.2, 0.3); put(ball, '#ffc21c', x + 0.1 * Math.sign(x), 0.42, zz + 0.16, 0.26, 0.18, 0.26); },
    fruit: (x, zz) => { put(tube, '#8a5a2a', x, 0.15, zz, 0.45, 0.3, 0.45); for (let j = 0; j < 5; j++) put(ball, ['#ff6a3c', '#ffd23c', '#5fd07a'][j % 3], x + Math.cos(j * 1.3) * 0.2, 0.36, zz + Math.sin(j * 1.3) * 0.2, 0.12, 0.12, 0.12); },
    sweets: (x, zz) => { put(box, '#5a3a22', x, 0.32, zz, 0.75, 0.64, 0.9); for (let j = 0; j < 6; j++) put(box, ['#ffd27a', '#ff8ab8', '#fff2d6'][j % 3], x - 0.18 + (j % 2) * 0.36, 0.7, zz - 0.3 + (j >> 1) * 0.3, 0.26, 0.12, 0.22); },
    shells: (x, zz) => { put(box, '#6a4a2a', x, 0.3, zz, 0.7, 0.6, 0.9); for (let j = 0; j < 5; j++) put(cone, ['#fff2e6', '#ffc0b0', '#f0e0c0'][j % 3], x - 0.2 + (j % 3) * 0.2, 0.68, zz - 0.25 + (j >> 1) * 0.25, 0.09, 0.16, 0.09, j, Math.PI / 2); },
    candles: (x, zz) => { put(box, '#5a3a22', x, 0.3, zz, 0.7, 0.6, 0.9); for (let j = 0; j < 6; j++) { const cx = x - 0.2 + (j % 3) * 0.2, czz = zz - 0.2 + (j > 2) * 0.4, h = 0.14 + (j % 3) * 0.05; put(tube, '#fff6e6', cx, 0.6 + h / 2, czz, 0.04, h, 0.04); spots.push([cx, 0.68 + h, czz, '#ffd27a']); } },
    balloons: (x, zz) => { put(tube, '#e8e0d0', x, 1.2, zz, 0.02, 2.4, 0.02); for (let j = 0; j < 6; j++) { const a = j * 1.05; put(ball, BANGLES[j], x + Math.cos(a) * 0.32, 2.55 + (j % 3) * 0.22, zz + Math.sin(a) * 0.32, 0.22, 0.27, 0.22); } },
  };
  const gstep = tier ? 7 : 11;
  sides.forEach((x0, s) => { for (let zz = near - 3 - s * gstep / 2, i = 0; zz >= far + 1; zz -= gstep, i++) goods[S.goods[(i + s) % S.goods.length]](x0 + inward(x0) * 0.9, zz, i); });

  // Palms by the sea: low-poly trunks of stacked segments and a crown of leaves, just outside the stalls.
  if (S.palms) for (const [x, zz] of [[z.x0 - 4.5, near - 6], [z.x1 + 4.5, near - 18], [z.x0 - 4.5, near - 30], [z.x1 + 4.5, far + 4]]) {
    for (let j = 0; j < 5; j++) put(tube, j % 2 ? '#8a6038' : '#7a5230', x + j * 0.08, 0.8 + j * 1.5, zz, 0.22 - j * 0.02, 1.55, 0.22 - j * 0.02);
    for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2; put(cone, j % 2 ? '#2f8a4a' : '#3aa05a', x + 0.4 + Math.cos(a) * 1.1, 8.2, zz + Math.sin(a) * 1.1, 0.35, 2.4, 0.12, -a, 0, Math.PI / 2 - 0.35); }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.name = 'chor-dress';

  // Marigold garlands swagged along the shop fronts on both sides (with jasmine strings between, in the south).
  const beads = [], fest = 4, per = tier ? 30 : 12;
  for (const x of [z.x0 - 0.6, z.x1 + 0.6]) for (let z0 = near; z0 - fest >= far - 0.1; z0 -= fest) for (let i = 0; i <= per; i++) {
    const t = i / per; beads.push([x, 3.1 - 0.65 * Math.sin(t * Math.PI), z0 - fest * t, i % 2 ? 1 : 0]);
    if (S.jasmine && i % 2) beads.push([x, 3.5 - 0.35 * Math.sin(t * Math.PI), z0 - fest * t, 2]);
  }
  // A marigold arch across the street where you come in, framing the way down it.
  if (!def.wares && def.views && def.views[0]) { const az = def.views[0].z - 10, ax0 = z.x0 - 0.6, ax1 = z.x1 + 0.6, k = Math.round((ax1 - ax0) / (tier ? 0.16 : 0.24));
    for (let i = 0; i <= k; i++) { const t = i / k; beads.push([ax0 + (ax1 - ax0) * t, 4.8 - 1.3 * Math.sin(t * Math.PI), az, i % 2 ? 1 : 0]); if (S.jasmine && i % 2) beads.push([ax0 + (ax1 - ax0) * t, 5.05 - 1.3 * Math.sin(t * Math.PI), az, 2]); } }
  const bead = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(tier ? 0.075 : 0.1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#5a2a00', flatShading: true }), beads.length);
  const tint = [new THREE.Color('#ff8a1c'), new THREE.Color('#ffc21c'), new THREE.Color('#fff6ea')];
  beads.forEach(([x, y, zz, k], i) => { m.makeTranslation(x, y, zz); bead.setMatrixAt(i, m); bead.setColorAt(i, tint[k]); });
  bead.name = 'chor-marigolds';
  return { objects: [mesh, bead], spots };
}
