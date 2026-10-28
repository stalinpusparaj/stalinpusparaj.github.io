/* Light Up the Skies — Pataka Chor at the Taj Mahal: Taj Ganj's evening bazaar on Diwali night (Premium). The game's
   own Taj Mahal scene (world3d-taj.js: the raised forecourt, the long reflecting pool, the mausoleum white under the
   night sky, its reflection in the water) as it is, with the old Taj Ganj bazaar spread over the forecourt: petha and
   marble-inlay stalls in two rows, carts, crates and barrels from Pilgrim's kit (cover, targets and colliders), lamps
   and strings of lights. Then Pataka Chor's viewpoints, hiding places, patrols, stashes and Seth-ji's shop.

   The street stops at the pool's edge: nothing goes into the pool or the gardens, and the Taj itself, 215 m away,
   stays a quiet backdrop that nothing here targets.

   Frame: +x to your right, +y up, +z towards you; the Taj faces you down -z, past the pool. */
import { build as taj } from './world3d-taj.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const ROW = 13; // the bazaar's two rows of stalls, either side of the pool's axis
const L = Math.PI / 2;
const STALLS = [24, 13, 2, -9, -20, -30];

function bazaar(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  STALLS.forEach((z, i) => {
    add('stall', -ROW, z, L); add('stall', ROW, z - 4, -L);
    if (i % 2) add('crate', -ROW + 1.6, z - 4, 0.3); else add('barrel', ROW - 1.4, z, 0);
  });
  for (const z of [26, 8, -12, -28]) { add('lamp', -ROW + 2, z, L); add('lamp', ROW - 2, z - 5, -L); }
  add('cart', 8, -4, -0.3); add('cart', -7.6, -24, 0.3); // tonga carts
  add('crate', -8.4, 12, 0.2); add('crate', -8.8, 11.2, 1.0, 0.85);
  add('barrel', 8.4, -16, 0); add('barrel', 9, -16.6, 0, 0.9);
  add('bench', -5, 20, 0); add('bench', 5, 20, 0);
  return placeProps(items, new Rng(1632), getPalette('vanity')); // 1632: the Taj begun
}

export function build({ tier }) {
  const base = taj({ tier });
  const merged = bazaar(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  const spots = base.spots.slice();
  for (let z = 26; z >= -30; z -= 8) for (let i = 0; i <= 18; i++) { const x = -ROW + 1 + i * ((2 * ROW - 2) / 18), sag = 1.2 * Math.sin((i / 18) * Math.PI); spots.push([x, 6.6 - sag, z, i % 3 ? '#ffd27a' : '#ff9ad1']); }
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -18, x1: 18, z0: -33, z1: 30 },
    zone: { x0: -10, x1: 10, z0: -32, z1: 28 },
    views: [
      { name: 'Bazaar entrance', x: 0, z: 28, eye: 2.2, yaw: 0 },
      { name: 'Petha stalls', x: -4, z: 10, eye: 2.0, yaw: 0.75 },
      { name: 'Marble craft row', x: 4, z: -10, eye: 2.0, yaw: -0.75 },
      { name: 'By the pool', x: 0, z: -30, eye: 2.4, yaw: 0 },
      { name: 'Gatehouse roof', x: -16, z: 24, eye: 9, yaw: -0.3 },
      { name: 'Behind the tonga', x: 8.4, z: -6.6, eye: 1.3, yaw: 0.4, hide: true },
      { name: 'Behind the crates', x: -8.8, z: 13.6, eye: 1.2, yaw: -0.3, hide: true },
    ],
    patrols: {
      keeper: [[-8.5, 26], [-8.5, 8], [-7.5, -10], [-8.5, -28], [-7.5, -10], [-8.5, 8]],
      man: [[8, -28], [8, -12], [7, 6], [8, -12]],
      dog: [[0, -28], [-4, -16], [3, -2], [0, 14], [4, -22]],
    },
    donkey: { route: [[2.5, 24], [-3, 10], [2.5, -4], [-3, -18], [2.5, -29], [-3, -18], [2.5, -4], [-3, 10]] },
    heist: { x: -ROW + 1.1, z: -9.6 },
    // Agra's lean: the gentle, bright ones that suit a white marble night: flower pots, anars, fountains, wheels.
    mix: ['flowerpot', 'anar', 'fountain', 'chakri', 'sparkler', 'starwheel', 'silvertower', 'chrysline'],
    stashes: [[-ROW + 1, 25.5], [ROW - 1, 20], [-ROW + 1, 14.5], [ROW - 1, 9], [-ROW + 1, 3.5], [ROW - 1, -2], [-ROW + 1, -7.5],
      [ROW - 1, -13], [-ROW + 1, -28.5], [7.4, -2.2], [-7, -22.2], [-9, 10.4], [8.6, -15], [0, 18]],
    targets: [
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Petha stall lit up', pts: 80, x: -ROW, y: 1.4, z, r: 2.6, id: `tl${i}` })),
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Marble craft stall lit up', pts: 80, x: ROW, y: 1.4, z: z - 4, r: 2.6, id: `tr${i}` })),
      { kind: 'cart', name: 'Tonga cart jumps', pts: 50, x: 8, y: 0.8, z: -4, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Tonga cart jumps', pts: 50, x: -7.6, y: 0.8, z: -24, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -8.6, y: 0.5, z: 11.6, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: 8.7, y: 0.6, z: -16.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
