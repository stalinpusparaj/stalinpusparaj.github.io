/* Light Up the Skies — Pataka Chor at the Hawa Mahal: Johari Bazaar in Jaipur's Pink City on Diwali night (Premium).
   The game's own Hawa Mahal scene (world3d-hawa-mahal.js: the paved square with its bazaar arcades, the palace's pink
   screen of windows glowing across the road) as it is, with the bazaar filling the square: jewellers' and bandhani
   stalls in two rows, carts, crates and barrels from Pilgrim's kit (cover, targets and colliders), and a camel in a
   Rajasthani saddle cloth doing the donkey's rounds. Then Pataka Chor's viewpoints, hiding places, patrols, stashes and
   Seth-ji's shop.

   The palace stays a backdrop across the road, beyond a throw from the square; nothing here targets it.

   Frame: +x to your right, +y up, +z towards you; the palace faces you down -z. */
import { build as hawaMahal } from './world3d-hawa-mahal.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const ROW = 11; // the two rows of stalls, either side of the square's middle
const L = Math.PI / 2;
const STALLS = [14, 4, -6, -16, -26, -35]; // along each row

function bazaar(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  STALLS.forEach((z, i) => {
    add('stall', -ROW, z, L); add('stall', ROW, z - 4, -L);
    if (i % 2) add('crate', -ROW + 1.6, z - 4, 0.3); else add('barrel', ROW - 1.4, z, 0);
  });
  for (const z of [10, -10, -30]) { add('lamp', -ROW + 2, z, L); add('lamp', ROW - 2, z - 6, -L); }
  add('cart', 7.5, -12, -0.35); add('cart', -7.2, -30, 0.3);
  add('crate', -7.8, 6, 0.2); add('crate', -8.2, 5.2, 1.0, 0.85);
  add('barrel', 8, -22, 0); add('barrel', 8.6, -22.6, 0, 0.9);
  add('bench', 0, 4, 0); add('well', 13, -38, 0);
  if (tier) for (const z of [0, -20]) add('flag', -ROW - 1.2, z, 0);
  return placeProps(items, new Rng(1799), getPalette('vanity')); // 1799: the Hawa Mahal's year
}

export function build({ tier }) {
  const base = hawaMahal({ tier });
  const merged = bazaar(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  return {
    ...base,
    objects, folk: true,
    colliders: merged.colliders, bounds: { x0: -18, x1: 18, z0: -40, z1: 20 },
    zone: { x0: -9, x1: 9, z0: -39, z1: 16 },
    views: [
      { name: 'Square corner', x: 0, z: 18, eye: 2.2, yaw: 0 },
      { name: 'Jewellers', x: -4, z: 0, eye: 2.0, yaw: 0.75 },
      { name: 'Bandhani stalls', x: 4, z: -18, eye: 2.0, yaw: -0.75 },
      { name: 'By the palace road', x: 0, z: -36, eye: 2.4, yaw: 0 },
      { name: 'Arcade roof', x: -15, z: 12, eye: 9, yaw: -0.35 },
      { name: 'Behind the cart', x: 8.4, z: -14.6, eye: 1.3, yaw: 0.4, hide: true },
      { name: 'Behind the crates', x: -8.6, z: 7.4, eye: 1.2, yaw: -0.3, hide: true },
    ],
    patrols: {
      keeper: [[-7.5, 16], [-7.5, 0], [-6.5, -18], [-7.5, -34], [-6.5, -18], [-7.5, 0]],
      man: [[7, -36], [7, -20], [6, -4], [7, -20]],
      dog: [[0, -34], [-4, -22], [3, -10], [0, 4], [4, -28]],
    },
    // The camel's slow round of the square.
    donkey: { kind: 'camel', route: [[2, 14], [-3, 2], [2, -12], [-2.5, -26], [2.5, -36], [-2.5, -26], [2, -12], [-3, 2]] },
    heist: { x: -ROW + 1.1, z: -16.6 },
    // Jaipur's lean: anars and flower pots, chakris and fountains, rockets over the Pink City.
    mix: ['anar', 'flowerpot', 'chakri', 'fountain', 'rocket', 'sparkler', 'starwheel', 'bijili'],
    stashes: [[-ROW + 1, 15.5], [ROW - 1, 11], [-ROW + 1, 5.5], [ROW - 1, 0.5], [-ROW + 1, -4.5], [ROW - 1, -9.5], [-ROW + 1, -24.5],
      [ROW - 1, -29.5], [-ROW + 1, -33.5], [7.4, -10.2], [-7.4, -28.2], [-8.6, 4.4], [8.3, -21], [0, -38]],
    targets: [
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Jeweller’s stall lit up', pts: 80, x: -ROW, y: 1.4, z, r: 2.6, id: `jl${i}` })),
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Bandhani stall lit up', pts: 80, x: ROW, y: 1.4, z: z - 4, r: 2.6, id: `jr${i}` })),
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: 7.5, y: 0.8, z: -12, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: -7.2, y: 0.8, z: -30, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -8, y: 0.5, z: 5.6, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: 8.3, y: 0.6, z: -22.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Stepwell echoes', pts: 40, x: 13, y: 0.8, z: -38, r: 2.6, id: 'well' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
