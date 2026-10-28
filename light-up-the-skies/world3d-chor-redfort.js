/* Light Up the Skies — Pataka Chor at the Red Fort: Chandni Chowk on Diwali night (Premium). The game's own Red Fort
   scene (world3d-red-fort.js: the Lahori Gate floodlit across its lawns, the flag over it, the long walls) as it is,
   with a crowded old-Delhi market street built in front of it from Pilgrim's kit: havelis and shops close on both
   sides, stalls and a rickshaw cart, lamps and strings of lights, running down to the fort's low outer wall, so the
   gate fills the gap at the end of the street. Then Pataka Chor's viewpoints, hiding places, patrols, stashes and
   Seth-ji's shop.

   The fort stays a backdrop: its gate stands 125 m away, beyond any throw, and nothing here targets it.

   Frame: +x to your right, +y up, +z towards you; the street runs along -z to the fort. */
import { forecourt, LAYER } from './world3d.js';
import { build as redFort } from './world3d-red-fort.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const HALF = 6; // half the paved street
const SIDE = 11; // the haveli fronts
const L = Math.PI / 2;
const ROWS = [10, -4, -18, -32, -46, -60]; // the havelis, on both sides

function chowk(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  ROWS.forEach((z, i) => {
    add(['house_b', 'house_a', 'house_c'][i % 3], -SIDE - 1.5, z, L);
    add(['house_c', 'house_b', 'house_a'][i % 3], SIDE + 1.5, z - 7, -L);
    add('stall', -HALF - 1.6, z + 1.2, L);
    add('stall', HALF + 1.6, z - 6, -L);
  });
  for (let z = 14; z >= -66; z -= 14) { add('lamp', -HALF - 0.3, z - 3, L); add('lamp', HALF + 0.3, z - 10, -L); }
  add('cart', HALF - 1.5, -12, -0.3); add('cart', -HALF + 1.6, -40, 0.25); // rickshaw carts
  add('crate', -HALF + 0.8, -21, 0.4); add('crate', -HALF + 1.2, -21.9, 1.2, 0.8);
  add('barrel', HALF - 0.9, -27, 0); add('barrel', HALF - 1.5, -27.6, 0, 0.9);
  add('bench', HALF - 0.6, -52, -L);
  if (tier) for (const z of [-8, -36]) add('sign', -HALF - 0.8, z, L);
  return placeProps(items, new Rng(1650), getPalette('vanity')); // 1650: Chandni Chowk laid out by Jahanara Begum
}

export function build({ tier }) {
  const base = redFort({ tier });
  const merged = chowk(tier);
  const objects = [...base.objects, forecourt({ rgb: [92, 70, 62], z0: -78, z1: -40, width: 2 * HALF + 6, tile: 2, joint: 'rgba(200,160,140,0.3)', y: 2 * LAYER }), merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  // Strings of lights across the street, house to house.
  const spots = base.spots.slice();
  for (let z = 6; z >= -62; z -= 9) for (let i = 0; i <= 14; i++) { const x = -SIDE + 2 + i * ((2 * SIDE - 4) / 14), sag = 1 * Math.sin((i / 14) * Math.PI); spots.push([x, 7.2 - sag, z, i % 3 ? '#ffd27a' : '#ff5a8a']); }
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -9.4, x1: 9.4, z0: -76, z1: 20 },
    zone: { x0: -HALF + 0.4, x1: HALF - 0.4, z0: -72, z1: 16 },
    views: [
      { name: 'Chowk corner', x: 0, z: 16, eye: 2.2, yaw: 0 },
      { name: 'Paratha stalls', x: 2.5, z: -8, eye: 2.0, yaw: 0.7 },
      { name: 'Haveli row', x: -2.5, z: -34, eye: 2.0, yaw: -0.6 },
      { name: 'By the fort', x: 0, z: -66, eye: 2.4, yaw: 0 },
      { name: 'Haveli roof', x: 8.5, z: 6, eye: 10, yaw: 0.12 },
      { name: 'Behind the rickshaw', x: HALF - 0.6, z: -14.4, eye: 1.3, yaw: 0.35, hide: true },
      { name: 'Behind the crates', x: -HALF + 0.5, z: -23.6, eye: 1.2, yaw: -0.4, hide: true },
    ],
    patrols: {
      keeper: [[-3.8, 12], [-3.8, -10], [-3.2, -30], [-3.8, -52], [-3.2, -30], [-3.8, -10]],
      man: [[3.6, -64], [3.6, -44], [2.8, -24], [3.6, -44]],
      dog: [[0, -66], [-3, -50], [2.5, -36], [0, -18], [3, -4], [-2.5, -40]],
    },
    donkey: { route: [[1, 12], [-1.5, -10], [1.5, -30], [-1, -50], [1.5, -68], [-1, -50], [1.5, -30], [-1.5, -10]] },
    heist: { x: -HALF - 0.9, z: -30.5 },
    // Old Delhi's lean: ladis and bombs, rockets, anars and the noisy ones.
    mix: ['laddi', 'bomb', 'firecracker', 'rocket', 'rocketcombo', 'anar', 'twosound', 'sutli', 'cometchain'],
    stashes: [[-HALF - 1.1, 11.5], [HALF + 1.1, -6], [-HALF - 1.1, -2.5], [HALF + 1.1, -20], [-HALF - 1.1, -16.5], [HALF + 1.1, -34],
      [-HALF - 1.1, -30.5], [HALF + 1.1, -48], [-HALF - 1.1, -44.5], [HALF + 1.1, -62], [HALF - 1.8, -10.4], [-HALF + 1.4, -19.6], [HALF - 1.6, -25.6], [-3.5, -70]],
    targets: [
      ...ROWS.map((z, i) => ({ kind: 'shop', name: 'Stall lit up', pts: 80, x: -HALF - 1.6, y: 1.4, z: z + 1.2, r: 2.6, id: `sl${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'shop', name: 'Stall lit up', pts: 80, x: HALF + 1.6, y: 1.4, z: z - 6, r: 2.6, id: `sr${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Haveli window flash', pts: 40, x: -SIDE + 1.2, y: 4, z, r: 4, id: `wl${i}` })),
      ...ROWS.map((z, i) => ({ kind: 'window', name: 'Haveli window flash', pts: 40, x: SIDE - 1.2, y: 4, z: z - 7, r: 4, id: `wr${i}` })),
      { kind: 'cart', name: 'Rickshaw jumps', pts: 50, x: HALF - 1.5, y: 0.8, z: -12, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: 'Rickshaw jumps', pts: 50, x: -HALF + 1.6, y: 0.8, z: -40, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -HALF + 1, y: 0.5, z: -21.4, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: HALF - 1.2, y: 0.6, z: -27.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
    ],
  };
}
