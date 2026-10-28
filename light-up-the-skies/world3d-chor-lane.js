/* Light Up the Skies — 3D background for Pataka Chor's Premium street (chor.js): Temple Lane on Diwali night, a narrow
   old lane of houses and flower-and-diya stalls on both sides, under flowered arches, that ends at a temple tower in its
   walls. Built like the bazaar street (world3d-chor-street.js) from Pilgrim's code-made props, merged into one lit mesh
   and one glow mesh. Diyas line both sides all the way to the temple.

   Frame: +x to your right, +y up, +z towards you; the lane runs along -z. */
import { forecourt, rangoli, LAYER } from './world3d.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const HALF = 4.2; // half the paved lane's width
const SIDE = 8.5; // where the house fronts stand, either side
const L = Math.PI / 2; // turns a prop (built facing +z) to face the lane from the left; -L from the right
const ROWS = [8, -4, -16, -28, -40]; // where the houses stand, on both sides
const TREES = [[-14, 2], [14, -10], [-14, -34], [14, -46]];

function lane(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1, params) => items.push({ type, at: [x, 0, z], rotY, scale, params });
  ROWS.forEach((z, i) => {
    add(['house_c', 'house_a', 'house_b', 'house_c', 'house_a'][i], -SIDE - 1, z, L, 0.9);
    add(['house_a', 'house_b', 'house_c', 'house_b', 'house_c'][i], SIDE + 1, z - 6, -L, 0.9);
    // A stall in front of every other house, either side by turns.
    if (i % 2) add('stall', -HALF - 1.4, z + 1, L); else add('stall', HALF + 1.4, z - 5, -L);
  });
  // Flowered arches across the lane, lamps between them, diyas along both edges.
  for (const z of [2, -12, -26, -40]) add('arbour', 0, z, 0, 1.6);
  for (let z = 10; z >= -50; z -= 10) { add('lamp', -HALF - 0.3, z, L); add('lamp', HALF + 0.3, z - 5, -L); }
  const step = tier ? 3 : 5;
  for (let z = 10; z >= -52; z -= step) { add('candle', -HALF + 0.3, z, 0); add('candle', HALF - 0.3, z - step / 2, 0); }
  // Clutter for cover and for the crackers: a cart, crates, barrels, benches.
  add('cart', -HALF + 1.2, -21, 0.25);
  add('crate', HALF - 0.7, -33, 0.3); add('crate', HALF - 0.9, -33.9, 1.2, 0.8);
  add('barrel', -HALF + 0.8, -6, 0); add('barrel', -HALF + 1.4, -6.6, 0, 0.9);
  add('bench', HALF - 0.5, 4, -L);
  // The temple at the end: its tower, its walls and gate, flags either side.
  add('palace_tower', 0, -66, 0, 0.8);
  add('town_wall', -9, -60, 0); add('town_wall', 9, -60, 0);
  add('town_gate', 0, -58, 0, 0.8);
  for (const x of [-5, 5]) add('flag', x, -55, 0);
  for (const [x, z] of TREES) add('tree_fruit', x, z, 0, 1.3);
  return placeProps(items, new Rng(1408), getPalette('city'));
}

export function build({ tier }) {
  const merged = lane(tier);
  const objects = [
    forecourt({ rgb: [104, 84, 66], z0: -60, z1: 14, width: 2 * HALF, tile: 2 }),
    forecourt({ rgb: [76, 62, 50], z0: -62, z1: 14, width: 2 * SIDE + 10, tile: 4, y: LAYER / 2 }),
    rangoli(0, -50),
    merged.mesh,
  ];
  if (merged.glow) objects.push(merged.glow);
  // Strings of lights from house to house, warm and close.
  const spots = [];
  // Marigold garlands along each flowered arch: little orange and yellow lights round its curve and down its posts.
  for (const z of [2, -12, -26, -40]) {
    for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI; spots.push([Math.cos(t) * 2.5, 2.6 + Math.sin(t) * 2.3, z + 0.05, i % 2 ? '#ff9a1f' : '#ffd23f']); }
    for (const x of [-2.5, 2.5]) for (let y = 0.4; y < 2.6; y += 0.45) spots.push([x, y, z + 0.05, '#ff9a1f']);
  }
  for (let z = 6; z >= -46; z -= 7) for (let i = 0; i <= 10; i++) { const x = -SIDE + 2 + i * ((2 * SIDE - 4) / 10), sag = 0.8 * Math.sin((i / 10) * Math.PI); spots.push([x, 6.4 - sag, z, i % 3 ? '#ffd27a' : '#ff8a3c']); }
  return {
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -7.2, x1: 7.2, z0: -56, z1: 14 },
    zone: { x0: -HALF + 0.3, x1: HALF - 0.3, z0: -54, z1: 10 },
    views: [
      { name: 'Lane end', x: 0, z: 12, eye: 2.0, yaw: 0 },
      { name: 'Stalls', x: 1.5, z: -10, eye: 1.9, yaw: 0.7 },
      { name: 'Arches', x: -1, z: -30, eye: 2.0, yaw: -0.4 },
      { name: 'Temple', x: 0, z: -46, eye: 2.2, yaw: 0 },
      { name: 'Balcony', x: -6, z: -2, eye: 7.5, yaw: -0.25 },
      { name: 'Behind the cart', x: -HALF + 0.4, z: -23.2, eye: 1.3, yaw: -0.3, hide: true },
      { name: 'Under the stall', x: HALF + 0.6, z: -38.5, eye: 1.1, yaw: 0.9, hide: true },
    ],
    patrols: {
      keeper: [[2.4, 9], [2.4, -12], [-2.2, -26], [2.4, -42], [-2.2, -26], [2.4, -12]],
      man: [[-2.4, -48], [-2.4, -30], [1.8, -18], [-2.4, -30]],
      dog: [[0, -50], [-2, -38], [2, -24], [0, -8], [-2.5, -44]],
    },
    heist: { x: 5.0, z: -22.5 },
    // Temple Lane's lean to the gentle and bright: anars, flower pots, fountains, wheels, sparklers.
    mix: ['anar', 'flowerpot', 'fountain', 'chakri', 'sparkler', 'starwheel', 'silvertower', 'wheel', 'chrysline'],
    donkey: { route: [[0.5, 8], [-1, -8], [1, -22], [-0.8, -36], [0.6, -48], [-0.8, -36], [1, -22], [-1, -8]] },
    stashes: [[-HALF - 1, 9], [HALF + 1, -13], [-HALF - 1, -3], [HALF + 1, -37], [-HALF - 1, -27], [-HALF + 1.2, -19.5],
      [HALF - 1.2, -32], [-HALF + 1, -8], [HALF - 0.6, 5], [3.5, -52], [-3.5, -53], [0.8, -44], [-6.8, -14], [6.8, -22]],
    targets: [
      ...ROWS.filter((_, i) => i % 2).map((z, i) => ({ kind: 'shop', name: 'Stall lit up', pts: 80, x: -HALF - 1.4, y: 1.4, z: z + 1, r: 2.4, id: `sl${i}` })),
      ...ROWS.filter((_, i) => !(i % 2)).map((z, i) => ({ kind: 'shop', name: 'Stall lit up', pts: 80, x: HALF + 1.4, y: 1.4, z: z - 5, r: 2.4, id: `sr${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: -SIDE + 1.4, y: 4, z, r: 3.5, id: `wl${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: SIDE - 1.4, y: 4, z: z - 6, r: 3.5, id: `wr${i}` })),
      ...[2, -12, -26, -40].map((z, i) => ({ kind: 'arch', name: 'Petals everywhere!', pts: 50, x: 0, y: 3.5, z, r: 3, id: `arch${i}` })),
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: -HALF + 1.2, y: 0.8, z: -21, r: 2.4, id: 'cart' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: HALF - 0.8, y: 0.5, z: -33.4, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: -HALF + 1, y: 0.6, z: -6.3, r: 2, id: 'barrels' },
      { kind: 'gate', name: 'Temple bells ring', pts: 70, x: 0, y: 3, z: -58, r: 4, id: 'gate' },
      ...TREES.map(([x, z], i) => ({ kind: 'tree', name: 'In the tree! Birds everywhere', pts: 50, x, y: 4, z, r: 3.5, id: `tree${i}` })),
    ],
    sky: ['#03020a', '#120a2a', '#3a1a46', '#6a2c3e'],
    fog: ['#2a1630', 30, 120],
    moon: null, stars: tier ? 450 : 220,
    hemi: ['#7a6ab0', '#3a2414', 0.95],
    directional: [['#ffb878', 1.0, [-20, 30, 50]], ['#8e96c8', 0.3, [40, 60, -80]]],
  };
}
