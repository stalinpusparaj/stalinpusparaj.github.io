/* Light Up the Skies — 3D background for Pataka Chor (chor.js): a bazaar street on Diwali night, built from Pilgrim's
   code-made props (assets/vendor/pilgrim-kit.js, rebuilt by tools/pilgrim-kit/build.mjs). Shops and houses line both
   sides of a paved street that runs away from you to a chowk with a rangoli and a well, closed by a town gate.

   Every prop is merged by the kit into one lit mesh and one glow mesh (lit windows, lamps, candles): two draw calls for
   the whole street. Nothing casts shadows.

   The street has fixed viewpoints (views) that the game eases between instead of walking, and stash spots where crackers
   are hidden; chor.js picks the day's stashes from them.

   Frame: +x to your right, +y up, +z towards you; the street runs along -z. */
import { forecourt, rangoli, LAYER } from './world3d.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const HALF = 5.5; // half the paved street's width
const SIDE = 10; // where the shop and house fronts stand, either side
const L = Math.PI / 2;
const TREES = [[-17, -4], [17, -14], [-17, -30], [17, -40], [-14, -58], [14, -66]]; // turns a prop (built facing +z) to face the street from the left; -L from the right

function street(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1, params) => items.push({ type, at: [x, 0, z], rotY, scale, params });
  // Shops on the left, houses on the right, each with a stall in front; the far end opens into the chowk.
  const rows = [6, -8, -22, -36];
  rows.forEach((z, i) => {
    add(['house_b', 'house_a', 'house_c', 'house_b'][i], -SIDE - 1, z, L);
    add('stall', -HALF - 1.6, z + 1.5, L);
    add(['house_a', 'house_c', 'house_b', 'house_a'][i], SIDE + 1, z - 4, -L);
    add(i % 2 ? 'crate' : 'barrel', SIDE - 3.2, z - 1, -L);
  });
  // Street lamps both sides, every 12 m.
  for (let z = 8; z >= -50; z -= 12) { add('lamp', -HALF - 0.4, z, L); add('lamp', HALF + 0.4, z - 6, -L); }
  // Clutter: a cart, crates and barrels, a bench and a sign.
  add('cart', HALF - 1.4, -14, -0.3);
  add('crate', -HALF + 0.6, -2, 0.4); add('crate', -HALF + 0.9, -2.9, 1.1, 0.8);
  add('barrel', HALF - 0.8, -29, 0); add('barrel', HALF - 1.5, -29.6, 0, 0.9);
  add('bench', -HALF + 0.6, -44, L);
  add('sign', -HALF - 0.6, -15, L);
  // The chowk: a well, flags, candles round its edge, the town gate closing it, trees behind the houses.
  add('well', 6, -60, 0);
  add('town_gate', 0, -78, 0);
  for (const x of [-8, 8]) add('flag', x, -52, 0);
  for (let i = 0; i < (tier ? 10 : 6); i++) add('candle', -9 + i * 2, -70, 0);
  for (const [x, z] of TREES) add('tree_round', x, z, 0, 1.3);
  return placeProps(items, new Rng(2026), getPalette('vanity'));
}

export function build({ tier }) {
  const merged = street(tier);
  const objects = [
    forecourt({ rgb: [92, 80, 70], z0: -76, z1: 14, width: 2 * HALF, tile: 2.5 }),
    forecourt({ rgb: [70, 60, 52], z0: -76, z1: 14, width: 2 * SIDE + 12, tile: 4, y: LAYER / 2 }),
    rangoli(0, -60),
    merged.mesh,
  ];
  if (merged.glow) objects.push(merged.glow);
  // Toran strings of little lights across the street, and lit doorways.
  const spots = [];
  for (let z = -6; z >= -50; z -= 11) for (let i = 0; i <= 14; i++) { const x = -HALF + i * (2 * HALF / 14), sag = 1.1 * Math.sin((i / 14) * Math.PI); spots.push([x, 7.4 - sag, z, i % 2 ? '#ffb347' : '#ff5a8a']); }
  return {
    objects, spots, folk: true,
    // Walking: what you bump into (every prop's collider, from the kit) and the street's ends and house fronts.
    colliders: merged.colliders, bounds: { x0: -8.6, x1: 8.6, z0: -74, z1: 14 },
    zone: { x0: -HALF + 0.4, x1: HALF - 0.4, z0: -72, z1: 10 },
    // Where the game may stand you (x, z, eye height, yaw: + turns left), and what each is called.
    views: [
      { name: 'Corner', x: 0, z: 12, eye: 2.2, yaw: 0 },
      { name: 'Shops', x: 2, z: -6, eye: 2.0, yaw: 0.75 },
      { name: 'Houses', x: -2, z: -26, eye: 2.0, yaw: -0.75 },
      { name: 'Chowk', x: 0, z: -44, eye: 2.4, yaw: 0 },
      { name: 'Rooftop', x: 7, z: 4, eye: 9, yaw: 0.12 },
      // Hiding places (hide: nobody can see you there, and an alert dies down fast).
      { name: 'Behind the cart', x: HALF - 0.5, z: -16.2, eye: 1.3, yaw: 0.35, hide: true },
      { name: 'Doorway', x: -SIDE + 2.6, z: -29, eye: 1.8, yaw: -1.15, hide: true },
    ],
    // Who walks the street (world3d-folk.js): Seth-ji the shopkeeper up and down his shops, the old man along the houses,
    // the dog wherever its nose takes it. Loops of [x, z].
    patrols: {
      keeper: [[-3.4, 7], [-3.4, -12], [-2.6, -24], [-3.4, -38], [-2.6, -24], [-3.4, -12]],
      man: [[3.2, -46], [3.2, -28], [2.4, -10], [3.2, -28]],
      dog: [[0, -58], [-3, -46], [2.5, -34], [0.5, -20], [3.5, -48], [-2, -64]],
    },
    // Seth-ji's shop counter, where he keeps the night's stock (Pataka Chor's heist).
    heist: { x: -6.4, z: -23 },
    // The bazaar's stashes lean to the loud ones: bombs, rockets, sutli, strings.
    mix: ['bomb', 'rocket', 'rocketcombo', 'sutli', 'twosound', 'bijili', 'firecracker', 'laddi', 'cometchain', 'anilvedi'],
    // The donkey's amble: down the middle of the street to the chowk and back.
    donkey: { route: [[1, 8], [-1.5, -10], [1.5, -26], [-1, -42], [2, -56], [-1, -42], [1.5, -26], [-1.5, -10]] },
    // Hiding places for crackers: (x, z), where chor.js may put the day's stashes.
    stashes: [[-HALF - 1.2, 7.5], [-HALF - 1.2, -6.5], [-HALF - 1.2, -20.5], [-HALF - 1.2, -34.5], [SIDE - 3.6, 5], [SIDE - 3.6, -9],
      [SIDE - 3.6, -23], [SIDE - 3.6, -37], [HALF - 1.8, -13], [-HALF + 1.2, -3], [HALF - 2, -28.5], [-HALF + 1, -43], [4.5, -58], [-6, -66]],
    // What a thrown cracker can set off (chor.js scores them): never a person. kind, name, points, where (x, y, z), and
    // how near (metres) a cracker must land.
    targets: [
      ...[6, -8, -22, -36].map((z, i) => ({ kind: 'shop', name: 'Shop lit up', pts: 80, x: -HALF - 1.6, y: 1.4, z: z + 1.5, r: 2.6, id: `shop${i}` })),
      ...[6, -8, -22, -36].map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: -SIDE + 1.6, y: 4, z, r: 4, id: `wl${i}` })),
      ...[6, -8, -22, -36].map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: SIDE - 1.6, y: 4, z: z - 4, r: 4, id: `wr${i}` })),
      ...[6, -8, -22, -36].map((z, i) => ({ kind: 'crate', name: i % 2 ? 'Crates rattle' : 'Barrel bongs', pts: 30, x: SIDE - 3.2, y: 0.6, z: z - 1, r: 2.2, id: `pile${i}` })),
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -HALF + 0.7, y: 0.5, z: -2.4, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: HALF - 1.1, y: 0.6, z: -29.3, r: 2, id: 'barrels' },
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: HALF - 1.4, y: 0.8, z: -14, r: 2.6, id: 'cart' },
      { kind: 'well', name: 'Well echoes', pts: 40, x: 6, y: 0.8, z: -60, r: 2.6, id: 'well' },
      { kind: 'gate', name: 'Gate rings', pts: 60, x: 0, y: 3, z: -77, r: 4, id: 'gate' },
      ...TREES.map(([x, z], i) => ({ kind: 'tree', name: 'In the tree! Birds everywhere', pts: 50, x, y: 4, z, r: 3.5, id: `tree${i}` })),
    ],
    sky: ['#02030c', '#0a0b2c', '#22184a', '#4a2a50'],
    fog: ['#1e1632', 40, 150],
    moon: null, stars: tier ? 500 : 250,
    hemi: ['#6a6ab0', '#2a1e14', 0.9],
    directional: [['#ffc98e', 0.9, [-30, 40, 60]], ['#8e96c8', 0.35, [40, 60, -80]]],
  };
}
