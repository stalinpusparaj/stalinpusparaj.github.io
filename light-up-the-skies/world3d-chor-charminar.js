/* Light Up the Skies — Pataka Chor at the Charminar: Laad Bazaar on Diwali night (Premium). The game's own Charminar
   scene (world3d-charminar.js: the old-city bazaar street, its shop fronts, lamps and autos, the monument floodlit at
   its end) as it is, with Pataka Chor's street life added in front of the monument: bangle and sweet stalls, carts,
   crates and barrels from Pilgrim's kit (cover, targets and colliders), the viewpoints, hiding places, patrols, stashes
   and Seth-ji's shop.

   The Charminar stays a backdrop: it stands 170 m down the street, far beyond a throw, and nothing here targets it.

   Frame: +x to your right, +y up, +z towards you; the street runs along -z to the monument. */
import { build as charminar } from './world3d-charminar.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const STALL = 10; // the stalls stand in front of the shop fronts (13 m out)
const L = Math.PI / 2; // turns a prop (built facing +z) to face the street from the left; -L from the right
const ROWS = [6, -16, -38, -60, -84]; // where the stalls stand, alternating sides

function bazaar(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  ROWS.forEach((z, i) => {
    add('stall', -STALL, z, L); add('stall', STALL, z - 10, -L);
    if (i % 2) add('crate', STALL - 1.2, z - 13, -0.4); else add('barrel', -STALL + 1.3, z - 3, 0);
  });
  add('cart', -8.4, -26, 0.3); add('cart', 8.2, -72, -0.25);
  add('crate', 9.2, -44, 0.2); add('crate', 9.6, -44.9, 1.1, 0.8); add('crate', 8.8, -45.4, 0.6, 0.9);
  add('barrel', 8.2, -8, 0); add('barrel', 8.8, -8.6, 0, 0.9);
  add('bench', -9.2, -50, L);
  if (tier) for (const z of [-2, -30, -66]) add('sign', -STALL - 0.8, z, L);
  return placeProps(items, new Rng(1591), getPalette('vanity')); // 1591: the year the Charminar was built
}

export function build({ tier }) {
  const base = charminar({ tier });
  const merged = bazaar(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  return {
    ...base,
    objects, folk: true,
    colliders: merged.colliders, bounds: { x0: -10.8, x1: 10.8, z0: -128, z1: 20 },
    zone: { x0: -8.5, x1: 8.5, z0: -112, z1: 16 },
    views: [
      { name: 'Bazaar gate', x: 0, z: 16, eye: 2.2, yaw: 0 },
      { name: 'Bangle stalls', x: 3, z: -12, eye: 2.0, yaw: 0.7 },
      { name: 'Lamp row', x: -3, z: -46, eye: 2.0, yaw: -0.6 },
      { name: 'Near the Charminar', x: 0, z: -100, eye: 2.4, yaw: 0 },
      { name: 'Rooftop', x: 9.5, z: 8, eye: 10, yaw: 0.12 },
      { name: 'Behind the cart', x: -8.1, z: -28.6, eye: 1.3, yaw: -0.4, hide: true },
      { name: 'Behind the crates', x: 9.4, z: -42.3, eye: 1.2, yaw: 0.5, hide: true },
    ],
    patrols: {
      keeper: [[-6.5, 12], [-6.5, -14], [-5.5, -40], [-6.5, -64], [-5.5, -40], [-6.5, -14]],
      man: [[6, -96], [6, -70], [5, -44], [6, -70]],
      dog: [[0, -90], [-4, -70], [3, -52], [0, -30], [4, -14], [-3, -60]],
    },
    donkey: { route: [[1.5, 12], [-2, -14], [2, -40], [-1.5, -66], [2, -94], [-1.5, -66], [2, -40], [-2, -14]] },
    heist: { x: -8.6, z: -36.5 },
    // Hyderabad's lean: bijili and sutli, anars and chakris, rockets over the old city.
    mix: ['bijili', 'sutli', 'twosound', 'anar', 'chakri', 'flowerpot', 'rocket', 'kuruvi'],
    stashes: [[-STALL + 1, 7.5], [STALL - 1, -3], [-STALL + 1, -14.5], [STALL - 1, -25], [-STALL + 1, -36], [STALL - 1, -47],
      [-STALL + 1, -58.5], [STALL - 1, -69], [-STALL + 1, -82.5], [STALL - 1, -93], [7.6, -9.6], [-7.2, -24.2], [8, -46.4], [-8, -51.5]],
    targets: [
      ...ROWS.map((z, i) => ({ kind: 'shop', name: 'Bangle stall lit up', pts: 80, x: -STALL, y: 1.4, z, r: 2.6, id: `bl${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'shop', name: 'Sweet stall lit up', pts: 80, x: STALL, y: 1.4, z: z - 10, r: 2.6, id: `br${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: -12.6, y: 4, z: z - 5, r: 4, id: `wl${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Window flash', pts: 40, x: 12.6, y: 4, z: z - 15, r: 4, id: `wr${i}` })),
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: -8.4, y: 0.8, z: -26, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: 8.2, y: 0.8, z: -72, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: 9.2, y: 0.5, z: -44.6, r: 2.2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: 8.5, y: 0.6, z: -8.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
