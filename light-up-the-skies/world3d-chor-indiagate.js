/* Light Up the Skies — Pataka Chor at India Gate: an evening on Kartavya Path on Diwali night. The game's own India
   Gate scene (world3d-india-gate.js: the avenue to the gate, its lawns, the arch floodlit amber at the end, the canopy
   framed in it) as it is, with the evening crowd's stalls along the lawns either side of the avenue: ice-cream carts,
   balloon and snack stalls, benches, crates and lamps from Pilgrim's kit (cover, targets and colliders). Then Pataka
   Chor's viewpoints, hiding places, patrols, stashes and Seth-ji's stall.

   The gate stays a backdrop, 150 m down the avenue and beyond any throw; nothing here targets it, the canopy or the
   memorial behind.

   Frame: +x to your right, +y up, +z towards you; the gate stands down -z. */
import { build as indiaGate } from './world3d-india-gate.js';
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const ROW = 11.5; // the stalls on the lawns, either side of the avenue's walks
const L = Math.PI / 2;
const STALLS = [14, 0, -14, -28, -42, -56, -70];

function lawns(tier) {
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  STALLS.forEach((z, i) => {
    add('stall', -ROW, z, L); add('stall', ROW, z - 7, -L);
    add(i % 2 ? 'cart' : 'bench', i % 2 ? -7.6 : 7.8, z - 3, i % 2 ? 0.3 : -L); // ice-cream carts and benches by the walks
  });
  for (let z = 18; z >= -78; z -= 16) { add('lamp', -6.6, z, L); add('lamp', 6.6, z - 8, -L); }
  add('crate', 8.4, -20, 0.2); add('crate', 8.9, -20.8, 1.0, 0.85);
  add('barrel', -8.2, -50, 0); add('barrel', -8.8, -50.6, 0, 0.9);
  if (tier) for (const z of [6, -34, -62]) { add('flag', -ROW - 1.4, z, 0); add('flag', ROW + 1.4, z - 7, 0); } // balloon sellers' bunches
  for (const [x, z] of [[-15, -6], [15, -22], [-15, -40], [15, -58]]) add('tree_round', x, z, 0, 1.2);
  return placeProps(items, new Rng(1931), getPalette('vanity')); // 1931: India Gate inaugurated
}

export function build({ tier }) {
  const base = indiaGate({ tier });
  const merged = lawns(tier);
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  // Strings of lights between the lamps either side, as the avenue is lit for the festival.
  const spots = base.spots.slice();
  for (let z = 10; z >= -74; z -= 12) for (let i = 0; i <= 12; i++) { const x = -9 + i * 1.5, sag = 1 * Math.sin((i / 12) * Math.PI); spots.push([x, 6 - sag, z, i % 3 ? '#ffd27a' : '#ff9a3c']); }
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -14, x1: 14, z0: -98, z1: 22 },
    zone: { x0: -9, x1: 9, z0: -96, z1: 18 },
    views: [
      { name: 'The avenue', x: 0, z: 18, eye: 2.2, yaw: 0 },
      { name: 'Ice-cream carts', x: -3, z: -4, eye: 2.0, yaw: 0.75 },
      { name: 'Balloon sellers', x: 3, z: -34, eye: 2.0, yaw: -0.75 },
      { name: 'Before the gate', x: 0, z: -90, eye: 2.4, yaw: 0 },
      { name: 'Lamp post view', x: 10, z: 10, eye: 8, yaw: 0.2 },
      { name: 'Behind the cart', x: -7.9, z: -19.4, eye: 1.3, yaw: -0.4, hide: true },
      { name: 'Behind the crates', x: 9.2, z: -22.6, eye: 1.2, yaw: 0.5, hide: true },
    ],
    patrols: {
      keeper: [[-8.5, 16], [-8.5, -12], [-7.5, -40], [-8.5, -68], [-7.5, -40], [-8.5, -12]],
      man: [[8, -88], [8, -62], [7, -36], [8, -62]],
      dog: [[0, -86], [-4, -66], [3, -46], [0, -24], [4, -6], [-3, -56]],
    },
    donkey: { route: [[2, 14], [-2.5, -10], [2.5, -34], [-2.5, -58], [2, -84], [-2.5, -58], [2.5, -34], [-2.5, -10]] },
    heist: { x: -ROW + 1.1, z: -28.6 },
    // Delhi's lean, as at the Red Fort: ladis and bombs, rockets over the avenue, anars.
    mix: ['laddi', 'bomb', 'rocket', 'rocketcombo', 'anar', 'sutli', 'chakri', 'cometchain'],
    stashes: [[-ROW + 1, 15.5], [ROW - 1, 7], [-ROW + 1, 1.5], [ROW - 1, -7], [-ROW + 1, -12.5], [ROW - 1, -21], [-ROW + 1, -40.5],
      [ROW - 1, -49], [-ROW + 1, -54.5], [ROW - 1, -63], [-6.8, -15.6], [8.6, -18.6], [-8, -48.4], [0, -94]],
    targets: [
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Snack stall lit up', pts: 80, x: -ROW, y: 1.4, z, r: 2.6, id: `il${i}` })),
      ...STALLS.map((z, i) => ({ kind: 'shop', name: 'Balloon stall lit up', pts: 80, x: ROW, y: 1.4, z: z - 7, r: 2.6, id: `ir${i}` })),
      ...STALLS.filter((_, i) => i % 2).map((z, i) => ({ kind: 'cart', name: 'Ice-cream cart jumps', pts: 50, x: -7.6, y: 0.8, z: z - 3, r: 2.4, id: `ic${i}` })),
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: 8.6, y: 0.5, z: -20.4, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: -8.5, y: 0.6, z: -50.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
      ...[[-15, -6], [15, -22], [-15, -40], [15, -58]].map(([x, z], i) => ({ kind: 'tree', name: 'In the tree! Birds everywhere', pts: 50, x, y: 4, z, r: 3.5, id: `tree${i}` })),
    ],
  };
}
