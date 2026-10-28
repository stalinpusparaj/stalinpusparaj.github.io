/* Light Up the Skies — Pataka Chor's cracker shop: Seth-ji's Pataka Mahal, a walk-in showroom at the top of the
   bazaar (world3d-chor-street.js, as it is), laid out like a flagship store (from its Google Flow concept): pale stone
   floor, white walls and recessed ceiling lights, stepped light-oak display risers down both sides with each cracker's
   picture standing on the steps, stocked niches down both walls, and a glass front with a lit signboard open onto the street. Whatever you take goes off out on the street.

   Every cracker the game has sits on a shelf as a ware (def.wares: { x, y, z }), in reach as you walk the aisles;
   chor.js puts one cracker on each and lets you take as many as your bag holds. Seth-ji is out front on the street.

   Frame: +x to your right, +y up, +z towards you; the shop is at +z, the street runs away along -z. */
import * as THREE from './assets/vendor/three.module.min.js';
import { build as bazaar } from './world3d-chor-street.js';

const W = 6.8, Z0 = 15, Z1 = 35, H = 5.2; // the shop: half-width, front and back, height
const BOXES = ['#ff4d4d', '#ffd23c', '#3cc8ff', '#5fd07a', '#ff8a1c', '#b07bff', '#ff5fa2', '#fff2d6'];

function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function shop(tier) {
  const lit = { pos: [], col: [] }, glow = { pos: [], col: [] }, colliders = [], spots = [], wares = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), v = new THREE.Vector3(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), R = rnd(1931);
  const put = (to, hex, x, y, z, sx, sy, sz, ry = 0, solid = false) => {
    m.compose(V.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), S.set(sx, sy, sz));
    const p = box.attributes.position; c.set(hex);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); to.pos.push(v.x, v.y, v.z); const f = 0.78 + 0.11 * ((i / 6 | 0) % 3); to.col.push(c.r * f, c.g * f, c.b * f); }
    if (solid) colliders.push({ kind: 'box', center: [x, y, z], half: [sx / 2, sy / 2, sz / 2], rotY: ry });
  };
  // The shell, bright like a flagship showroom: pale walls, a white ceiling with recessed light panels, the back wall.
  put(lit, '#efe6da', -W - 0.2, H / 2, (Z0 + Z1) / 2, 0.4, H, Z1 - Z0, 0, true);
  put(lit, '#efe6da', W + 0.2, H / 2, (Z0 + Z1) / 2, 0.4, H, Z1 - Z0, 0, true);
  put(lit, '#e8ddce', 0, H / 2, Z1 + 0.2, 2 * W + 0.8, H, 0.4, 0, true);
  put(lit, '#f4eee6', 0, H + 0.1, (Z0 + Z1) / 2, 2 * W + 0.8, 0.2, Z1 - Z0 + 0.4);
  for (let zz = Z0 + 2.5; zz < Z1 - 1; zz += tier ? 3.2 : 4.8) { put(glow, '#fff4dc', -2.6, H - 0.02, zz, 2.6, 0.06, 1.6); put(glow, '#fff4dc', 2.6, H - 0.02, zz, 2.6, 0.06, 1.6); spots.push([-2.6, H - 0.3, zz, '#fff0c8'], [2.6, H - 0.3, zz, '#fff0c8']); }
  // The glass front: tall dark mullions and a transom, open between them onto the bazaar.
  for (const x of [-W, -W / 2, W / 2, W]) put(lit, '#2a2630', x, H / 2, Z0, 0.18, H, 0.18, 0, Math.abs(x) === W);
  put(lit, '#2a2630', 0, H - 0.1, Z0, 2 * W + 0.4, 0.2, 0.2);
  // The signboard over the front, in the festival colours, with a row of bulbs under it.
  put(glow, '#ff3d6a', 0, H + 0.75, Z0 - 0.3, 7.6, 1.2, 0.2); put(glow, '#ffd23c', 0, H + 0.75, Z0 - 0.42, 6.8, 0.75, 0.05);
  for (let i = 0; i <= 18; i++) spots.push([-W + i * (2 * W / 18), H - 0.45, Z0 - 0.5, i % 2 ? '#ffd27a' : '#ff5a8a']);
  // Recessed niches down both walls, each with three shelves of stock in bright boxes.
  for (const side of [-1, 1]) for (let zz = Z0 + 3; zz < Z1 - 2; zz += 4.2) {
    const x = side * (W - 0.05);
    put(lit, '#d9cdbd', x, 1.9, zz, 0.12, 2.6, 2.6); // the niche's back, a shade darker
    for (const y of [0.9, 1.65, 2.4]) {
      put(lit, '#c8b8a2', x - side * 0.25, y - 0.05, zz, 0.5, 0.06, 2.5);
      for (let k = 0; k < 6; k++) { const h = 0.26 + R() * 0.2; put(lit, BOXES[(R() * BOXES.length) | 0], x - side * 0.25, y + h / 2, zz - 1.05 + k * 0.42, 0.34, h, 0.3); }
    }
  }
  // Down both sides of the aisle, stepped display risers in light oak, three steps climbing away from you like a
  // shop's tiered shelf; each step holds a row of cracker pictures (world3d setWares stands them on it, facing you).
  const risers = [Z0 + 3.2, Z0 + 7.6, Z0 + 12], RL = 3.6, STEPS = 3, RISE = 0.34, TREAD = 0.42, BASE = 0.42, PER = 3;
  const onSteps = [];
  for (const side of [-1, 1]) for (const zm of risers) {
    for (let k = 0; k < STEPS; k++) {
      const top = BASE + k * RISE, x = side * (1.25 + k * TREAD); // each step a block from the floor to its tread, further out and higher
      put(lit, k % 2 ? '#d2a064' : '#dcae72', x, top / 2, zm, TREAD, top, RL, 0, true);
      put(glow, '#ffe2a0', x - side * (TREAD / 2 - 0.02), top - 0.02, zm, 0.03, 0.03, RL - 0.1); // a lit strip along each step's edge
      for (let j = 0; j < PER; j++) {
        const pz = zm - RL / 2 + RL / (PER * 2) + j * (RL / PER) + (k % 2 ? RL / (PER * 4) : -RL / (PER * 4)); // staggered, so a picture never hides the one behind
        onSteps.push({ x, y: top + 0.26, z: pz });
      }
    }
  }
  // The steps' crackers, nearest the door first and the two sides in turn: so however many crackers there are, they
  // start where you come in.
  onSteps.sort((a, b) => a.z - b.z || a.x - b.x);
  wares.unshift(...onSteps);
  // The Premium showcase at the far end: a raised stage with a gold back wall and gold steps across it, the Premium
  // crackers' pictures on them under spotlights (stage: true, so chor.js puts the Premium crackers here).
  const SZ = Z1 - 2.4;
  put(lit, '#e6dccd', 0, 0.18, SZ, 8.4, 0.36, 3.2, 0, true);
  put(glow, '#ffd27a', 0, 0.37, SZ - 1.6, 8.4, 0.03, 0.06);
  put(glow, '#e8b04a', 0, 2.4, Z1 - 0.05, 8.6, 3.4, 0.08); put(glow, '#fff0c4', 0, 2.4, Z1 - 0.12, 7.8, 2.8, 0.04);
  const GOLD = [[-2.4, 0], [-1.2, 1], [0, 2], [1.2, 1], [2.4, 0]]; // a pyramid of steps: the middle one highest
  for (const [x, k] of GOLD) {
    const top = 0.36 + 0.3 + k * 0.3, zz = SZ + 0.2;
    put(lit, k === 2 ? '#f6e3a8' : '#efe0b8', x, (0.36 + top) / 2, zz, 1.15, top - 0.36, 1.1, 0, true);
    put(glow, '#ffd23c', x, top - 0.01, zz - 0.56, 1.1, 0.03, 0.03);
    wares.push({ x, y: top + 0.26, z: zz, stage: true });
    spots.push([x, H - 0.3, zz, '#fff2c8']);
  }
  // A pale stone floor, slab by slab, each a shade apart (unlit, like the rest of the showroom).
  put(lit, '#cfc6b8', 0, -0.05, (Z0 + Z1) / 2 - 0.5, 2 * W + 0.4, 0.1, Z1 - Z0 + 1); // the bed under it, so no joint shows the night through
  for (let zz = Z0 + 0.6; zz < Z1; zz += 1.2) for (let x = -W + 0.6; x < W; x += 1.2) put(lit, R() < 0.5 ? '#e4ddd2' : '#d8d0c4', x, 0.02, zz, 1.2, 0.04, 1.2);
  // Street adverts at eye level on both walls, in the gaps between the niches (chor.js puts a street's picture on each;
  // tap one to go there). Up above the niches they sat behind the game's top buttons on a phone.
  const ads = [];
  for (const side of [-1, 1]) for (let zz = Z0 + 5.1; zz < Z1 - 2.5; zz += 4.2) ads.push({ x: side * (W - 0.06), y: 1.95, z: zz, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, w: 1.4, h: 1.05 });
  const mesh = (part, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(part.col, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, mat); };
  return {
    objects: [mesh(lit, new THREE.MeshBasicMaterial({ vertexColors: true })), mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true }))],
    colliders, spots, wares, ads,
  };
}

// The shop's name, lit, on the signboard over the front (facing the street) and over the door inside (facing in).
function signs() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd23c'; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#7a1030'; g.font = '700 74px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Light Up the Skies', 512, 68, 980);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const out = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.82), mat); out.position.set(0, H + 0.75, Z0 - 0.45); out.rotation.y = Math.PI;
  const inn = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.55), mat); inn.position.set(0, H - 0.75, Z0 + 0.22);
  return [out, inn];
}

export function build({ tier }) {
  const base = bazaar({ tier }), s = shop(tier);
  return {
    ...base,
    objects: [...base.objects, ...s.objects, ...signs()],
    ads: s.ads,
    spots: [...base.spots, ...s.spots],
    colliders: [...base.colliders, ...s.colliders],
    bounds: { ...base.bounds, z1: Z1 - 0.5 },
    wares: s.wares,
    // You come in at the door looking into the showroom; then each side's steps, the back steps, the far end, the street.
    views: [
      { name: 'Shop door', x: 0, z: Z0 - 3.5, eye: 2.4, yaw: Math.PI },
      { name: 'Left steps', x: 0, z: Z0 + 4, eye: 1.7, yaw: Math.PI - 0.5 },
      { name: 'Right steps', x: 0, z: Z0 + 4, eye: 1.7, yaw: Math.PI + 0.5 },
      { name: 'Back steps', x: 0, z: Z0 + 9.5, eye: 1.7, yaw: Math.PI },
      { name: 'Premium showcase', x: 0, z: Z1 - 9.8, eye: 1.8, yaw: Math.PI },
      { name: 'Out to the street', x: 0, z: Z0 - 3, eye: 2.0, yaw: 0 },
      ...base.views.slice(1),
    ],
    // Seth-ji has stepped out: he walks the street in front of his shop, so you can slip in. Keep an eye on the door.
  };
}
