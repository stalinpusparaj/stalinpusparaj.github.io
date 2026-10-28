/* Light Up the Skies — Pataka Chor at the Gateway of India: the Colaba seafront on Diwali night (Premium). The game's
   own Gateway scene (world3d-gateway-of-india.js: the Apollo Bunder, the Gateway floodlit gold, the harbour full of
   boat lights behind it, the Taj Mahal Palace hotel to the left) as it is, with an evening promenade on the bunder:
   snack stalls in two rows (vada pav, bhel puri), pav bhaji carts, benches, crates and lamps from Pilgrim's kit (cover,
   targets and colliders), and the donkey's rounds. Then Pataka Chor's viewpoints, hiding places, patrols, stashes and
   Seth-ji's shop.

   The Gateway stays a backdrop at the end of the promenade, beyond a throw; nothing here targets it, the hotel or the
   boats.

   Frame: +x to your right, +y up, +z towards you; the Gateway stands down -z, the sea behind it. */
import { build as gateway } from './world3d-gateway-of-india.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const ROW = 12; // the two rows of stalls along the promenade
const L = Math.PI / 2;
const STALLS = [12, 0, -12, -24, -36, -48];

function promenade(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  STALLS.forEach((z, i) => {
    add('stall', -ROW, z, L); add('stall', ROW, z - 5, -L);
    add('bench', i % 2 ? -ROW + 2.6 : ROW - 2.6, z - 2.5, i % 2 ? L : -L);
  });
  for (const z of [16, -4, -24, -44]) { add('lamp', -ROW + 1.5, z, L); add('lamp', ROW - 1.5, z - 8, -L); }
  add('cart', 7, -8, -0.3); add('cart', -6.8, -30, 0.35); // pav bhaji carts
  add('crate', -7.4, 4, 0.3); add('crate', -7.9, 3.2, 1.1, 0.85);
  add('barrel', 7.6, -20, 0); add('barrel', 8.2, -20.6, 0, 0.9);
  if (tier) for (const z of [6, -18, -42]) add('flag', ROW + 1.2, z, 0);
  return placeProps(items, new Rng(1924), getPalette('vanity')); // 1924: the Gateway opened
}

export function build({ tier }) {
  const base = gateway({ tier });
  const merged = promenade(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  // Strings of festival lights across the promenade, stall to stall.
  const spots = base.spots.slice();
  for (let z = 10; z >= -50; z -= 10) for (let i = 0; i <= 16; i++) { const x = -ROW + 1 + i * ((2 * ROW - 2) / 16), sag = 1.2 * Math.sin((i / 16) * Math.PI); spots.push([x, 6.8 - sag, z, i % 3 ? '#ffd27a' : '#5ad1ff']); }
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -18, x1: 18, z0: -60, z1: 22 },
    zone: { x0: -9.5, x1: 9.5, z0: -58, z1: 18 },
    views: [
      { name: 'Promenade', x: 0, z: 18, eye: 2.2, yaw: 0 },
      { name: 'Vada pav stalls', x: -4, z: -2, eye: 2.0, yaw: 0.75 },
      { name: 'Bhel puri row', x: 4, z: -26, eye: 2.0, yaw: -0.75 },
      { name: 'Before the Gateway', x: 0, z: -54, eye: 2.4, yaw: 0 },
      { name: 'Hotel balcony', x: -16, z: 10, eye: 9, yaw: -0.3 },
      { name: 'Behind the cart', x: 7.8, z: -10.6, eye: 1.3, yaw: 0.4, hide: true },
      { name: 'Behind the crates', x: -8.2, z: 5.6, eye: 1.2, yaw: -0.3, hide: true },
    ],
    patrols: {
      keeper: [[-8, 16], [-8, -4], [-7, -24], [-8, -46], [-7, -24], [-8, -4]],
      man: [[7.5, -54], [7.5, -34], [6.5, -14], [7.5, -34]],
      dog: [[0, -52], [-4, -36], [3, -20], [0, -4], [4, -44]],
    },
    donkey: { route: [[2, 14], [-3, 0], [2.5, -16], [-2.5, -32], [2, -50], [-2.5, -32], [2.5, -16], [-3, 0]] },
    heist: { x: -ROW + 1.1, z: -12.6 },
    // Mumbai's lean: rockets over the harbour, anars, bombs and the loud ones.
    mix: ['rocket', 'rocketcombo', 'anar', 'bomb', 'laddi', 'chakri', 'cometchain', 'twosound'],
    stashes: [[-ROW + 1, 13.5], [ROW - 1, 8], [-ROW + 1, 1.5], [ROW - 1, -4], [-ROW + 1, -22.5], [ROW - 1, -28], [-ROW + 1, -34.5],
      [ROW - 1, -40], [-ROW + 1, -46.5], [6.6, -6.2], [-6.4, -28.2], [-8.4, 2.4], [8.4, -19], [0, -57]],
    targets: [
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Vada pav stall lit up', pts: 80, x: -ROW, y: 1.4, z, r: 2.6, id: `vl${i}` })),
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Bhel puri stall lit up', pts: 80, x: ROW, y: 1.4, z: z - 5, r: 2.6, id: `vr${i}` })),
      { kind: 'cart', name: 'Pav bhaji cart jumps', pts: 50, x: 7, y: 0.8, z: -8, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Pav bhaji cart jumps', pts: 50, x: -6.8, y: 0.8, z: -30, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -7.6, y: 0.5, z: 3.6, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: 7.9, y: 0.6, z: -20.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
