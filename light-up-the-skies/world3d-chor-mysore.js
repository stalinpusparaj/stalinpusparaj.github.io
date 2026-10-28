/* Light Up the Skies — Pataka Chor at Mysore Palace: the Dasara fair on its grounds (Premium). The game's own Mysore
   Palace scene (world3d-mysore-palace.js: the palace across its grounds, every line of it outlined in warm bulbs) as it
   is, with the Dasara exhibition fair laid out in front of it: two lanes of stalls (sandalwood and silk, Mysore pak and
   toys), carts, crates and barrels from Pilgrim's kit (cover, targets and colliders), and strings of bulbs over the
   whole fair, as Mysore lights up for Dasara. A Dasara elephant in a red and gold caparison, with a golden howdah,
   does the donkey's rounds. Then Pataka Chor's viewpoints, hiding places, patrols, stashes and Seth-ji's shop.

   The palace stays a backdrop, 170 m away across the grounds and beyond any throw; nothing here targets it.

   Frame: +x to your right, +y up, +z towards you; the palace faces you down -z. */
import { build as mysore } from './world3d-mysore-palace.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const ROW = 12; // the fair's two lanes of stalls
const L = Math.PI / 2;
const STALLS = [14, 2, -10, -22, -34, -46, -58, -70];

function fair(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  STALLS.forEach((z, i) => {
    add('stall', -ROW, z, L); add('stall', ROW, z - 6, -L);
    if (i % 2) add('crate', ROW - 1.4, z, -0.3); else add('barrel', -ROW + 1.4, z - 5, 0);
  });
  for (let z = 18; z >= -74; z -= 12) { add('lamp', -ROW + 2.2, z - 4, L); add('lamp', ROW - 2.2, z - 10, -L); }
  add('cart', 7.4, -16, -0.3); add('cart', -7.2, -52, 0.3);
  add('crate', -7.8, -2, 0.2); add('crate', -8.2, -2.8, 1.0, 0.85);
  add('barrel', 7.8, -40, 0); add('barrel', 8.4, -40.6, 0, 0.9);
  add('bench', 0, 6, 0); add('bench', 0, -64, Math.PI);
  if (tier) for (const z of [8, -28, -64]) { add('flag', -ROW - 1.4, z, 0); add('flag', ROW + 1.4, z - 6, 0); }
  return placeProps(items, new Rng(1610), getPalette('vanity')); // 1610: the first Dasara at Mysore
}

export function build({ tier }) {
  const base = mysore({ tier });
  const merged = fair(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  // Strings of bulbs over the whole fair, the way Mysore lights up for Dasara: warm gold, with a few rose ones.
  const spots = base.spots.slice();
  const step = tier ? 7 : 12;
  for (let z = 16; z >= -76; z -= step) for (let i = 0; i <= 18; i++) { const x = -ROW + 1 + i * ((2 * ROW - 2) / 18), sag = 1.3 * Math.sin((i / 18) * Math.PI); spots.push([x, 7 - sag, z, i % 4 ? '#ffd27a' : '#ff7a9a']); }
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -18, x1: 18, z0: -82, z1: 22 },
    zone: { x0: -9.5, x1: 9.5, z0: -80, z1: 18 },
    views: [
      { name: 'Fair gate', x: 0, z: 18, eye: 2.2, yaw: 0 },
      { name: 'Silk stalls', x: -4, z: -4, eye: 2.0, yaw: 0.75 },
      { name: 'Mysore pak row', x: 4, z: -30, eye: 2.0, yaw: -0.75 },
      { name: 'Facing the palace', x: 0, z: -76, eye: 2.4, yaw: 0 },
      { name: 'Ferris wheel view', x: -16, z: 12, eye: 10, yaw: -0.25 },
      { name: 'Behind the cart', x: 7.8, z: -18.6, eye: 1.3, yaw: 0.4, hide: true },
      { name: 'Behind the crates', x: -8.6, z: -0.4, eye: 1.2, yaw: -0.3, hide: true },
    ],
    patrols: {
      keeper: [[-8, 16], [-8, -8], [-7, -32], [-8, -58], [-7, -32], [-8, -8]],
      man: [[7.5, -74], [7.5, -50], [6.5, -26], [7.5, -50]],
      dog: [[0, -72], [-4, -54], [3, -36], [0, -16], [4, -2], [-3, -46]],
    },
    // The Dasara elephant's stately round of the fair.
    donkey: { kind: 'elephant', route: [[2.5, 14], [-3, -4], [2.5, -24], [-3, -44], [2.5, -64], [-3, -44], [2.5, -24], [-3, -4]] },
    heist: { x: -ROW + 1.1, z: -22.6 },
    // Mysore's lean: flower pots and anars, chakris, rockets and sky shells over the palace.
    mix: ['flowerpot', 'anar', 'chakri', 'fountain', 'rocket', 'starwheel', 'silvertower', 'sparkler', 'chrysline'],
    stashes: [[-ROW + 1, 15.5], [ROW - 1, 8], [-ROW + 1, 3.5], [ROW - 1, -4], [-ROW + 1, -20.5], [ROW - 1, -28], [-ROW + 1, -32.5],
      [ROW - 1, -52], [-ROW + 1, -56.5], [ROW - 1, -64], [6.8, -14.2], [-6.6, -50.2], [-8.6, -4.4], [8.2, -39], [0, -78]],
    targets: [
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Silk stall lit up', pts: 80, x: -ROW, y: 1.4, z, r: 2.6, id: `fl${i}` })),
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Mysore pak stall lit up', pts: 80, x: ROW, y: 1.4, z: z - 6, r: 2.6, id: `fr${i}` })),
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: 7.4, y: 0.8, z: -16, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Cart jumps', pts: 50, x: -7.2, y: 0.8, z: -52, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -8, y: 0.5, z: -2.4, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: 8.1, y: 0.6, z: -40.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
