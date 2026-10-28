/* Light Up the Skies — Pataka Chor's landmark-street builder: takes one of the game's landmark scenes as it is and
   lays a festival street over its forecourt (the paved ground in front of you, z 18 to -38 in every landmark scene):
   two rows of stalls facing each other, carts, crates, barrels, benches, lamps and trees from Pilgrim's kit (cover,
   targets and colliders), strings of lights across, and the street's viewpoints, hiding places, patrols, stashes and
   Seth-ji's stall. The landmark stays a backdrop beyond the forecourt: the street stops at its far edge, and a throw
   always comes down inside it, so nothing reaches a shrine, a pool or the sea.

   One call per street (world3d-chor-<name>.js), with its own feel: the stalls' width apart, a palette, the lights'
   colours, the crackers its stashes lean to, and extra props. */
import { placeProps, Rng, getPalette } from './assets/vendor/pilgrim-kit.js';

const L = Math.PI / 2;
const Z1 = 18, Z0 = -38; // the forecourt every landmark scene has, near to far

/** base: the landmark scene's build() result. o: { seed, half (the stalls' distance from the middle, 9-12), palette,
    lights: [colour, colour], mix: [types], extra(add) for more props, trees: [[x, z]], left/right: stall names,
    cart: cart name, animal: 'donkey' | 'camel' | 'elephant' }. */
export function landmarkStreet(base, o, tier) {
  const half = Math.min(o.half || 10, 8.5), rows = [14, 2, -10, -22, -34]; // a close street, as the concepts have it
  const items = [];
  const add = (type, x, z, rotY = 0, scale = 1) => items.push({ type, at: [x, 0, z], rotY, scale });
  rows.forEach((z, i) => {
    add('stall', -half, z, L); add('stall', half, z - 5, -L);
    if (i % 2) add('crate', half - 1.5, z, -0.3); else add('barrel', -half + 1.5, z - 4, 0);
  });
  for (let z = 16; z >= -36; z -= 13) { add('lamp', -half + 2.6, z - 3, L); add('lamp', half - 2.6, z - 9, -L); }
  add('cart', half - 4.2, -6, -0.3); add('cart', -half + 4.2, -28, 0.3);
  add('crate', -half + 3.6, 6, 0.2); add('crate', -half + 3.2, 5.2, 1.0, 0.85);
  add('barrel', half - 3.4, -18, 0); add('barrel', half - 2.8, -18.6, 0, 0.9);
  const trees = o.trees || [[-half - 4, -4], [half + 4, -20], [-half - 4, -32]];
  for (const [x, z] of trees) add(o.tree || 'tree_round', x, z, 0, 1.2);
  if (o.extra) o.extra(add, half);
  const merged = placeProps(items, new Rng(o.seed || 7), getPalette(o.palette || 'vanity'));
  const objects = [...base.objects, merged.mesh];
  if (merged.glow) objects.push(merged.glow);
  // Strings of lights across the street, stall to stall.
  const spots = base.spots.slice(), [c1, c2] = o.lights || ['#ffd27a', '#ff5a8a'];
  for (let z = 12; z >= -36; z -= tier ? 8 : 12) for (let i = 0; i <= 14; i++) { const x = -half + 1 + i * ((2 * half - 2) / 14), sag = 1.1 * Math.sin((i / 14) * Math.PI); spots.push([x, 6.4 - sag, z, i % 3 ? c1 : c2]); }
  const sx = half - 1.1; // where a stall's stash hides, just in front of it
  return {
    ...base,
    objects, spots, folk: true,
    colliders: merged.colliders, bounds: { x0: -half - 1, x1: half + 1, z0: Z0 - 1, z1: Z1 + 2 },
    zone: { x0: -half + 1, x1: half - 1, z0: Z0, z1: Z1 },
    views: [
      { name: 'Corner', x: 0, z: Z1, eye: 2.2, yaw: 0 },
      { name: 'Shops', x: -half / 3, z: 4, eye: 2.0, yaw: 0.75 },
      { name: 'Stalls', x: half / 3, z: -16, eye: 2.0, yaw: -0.75 },
      { name: 'Before the gate', x: 0, z: Z0 + 2, eye: 2.4, yaw: 0 },
      { name: 'Lamp post view', x: half - 1, z: 12, eye: 8, yaw: 0.2 },
      { name: 'Behind the cart', x: half - 4.4, z: -8.4, eye: 1.3, yaw: 0.4, hide: true },
      { name: 'Behind the crates', x: -half + 3.8, z: 7.6, eye: 1.2, yaw: -0.3, hide: true },
    ],
    patrols: {
      keeper: [[-half + 2.5, 16], [-half + 2.5, 0], [-half + 3.5, -18], [-half + 2.5, -34], [-half + 3.5, -18], [-half + 2.5, 0]],
      man: [[half - 2.5, -34], [half - 2.5, -18], [half - 3.5, -2], [half - 2.5, -18]],
      dog: [[0, -34], [-4, -22], [3, -10], [0, 6], [4, -28]],
    },
    donkey: { kind: o.animal || 'donkey', route: [[2.5, -12], [-2.5, -24], [2, -30], [-2.5, -24], [2.5, -12], [-2.5, 2], [2, 10], [-2.5, 2]] },
    heist: { x: -half + 1.1, z: -10.6 },
    mix: o.mix || [],
    stashes: [[-sx, 15.5], [sx, 9], [-sx, 3.5], [sx, -3], [-sx, -20.5], [sx, -27], [-sx, -32.5], [half - 4.4, -4.2], [-half + 4.4, -26.2],
      [-half + 3.4, 4.4], [half - 3.2, -17], [0, -36], [3.5, 16], [-3.5, -36]],
    targets: [
      ...rows.map((z, i) => ({ kind: 'shop', name: o.left || 'Shop lit up', pts: 80, x: -half, y: 1.4, z, r: 2.6, id: `kl${i}` })),
      ...rows.map((z, i) => ({ kind: 'shop', name: o.right || 'Stall lit up', pts: 80, x: half, y: 1.4, z: z - 5, r: 2.6, id: `kr${i}` })),
      { kind: 'cart', name: o.cart || 'Cart jumps', pts: 50, x: half - 4.2, y: 0.8, z: -6, r: 2.6, id: 'cart1' },
      { kind: 'cart', name: o.cart || 'Cart jumps', pts: 50, x: -half + 4.2, y: 0.8, z: -28, r: 2.6, id: 'cart2' },
      { kind: 'crate', name: 'Crates rattle', pts: 30, x: -half + 3.4, y: 0.5, z: 5.6, r: 2, id: 'crates' },
      { kind: 'crate', name: 'Barrel bongs', pts: 30, x: half - 3.1, y: 0.6, z: -18.3, r: 2, id: 'barrels' },
      { kind: 'well', name: 'Rangoli sparkles', pts: 40, x: 0, y: 0.3, z: -18, r: 3, id: 'rangoli' },
      ...trees.map(([x, z], i) => ({ kind: 'tree', name: 'In the tree! Birds everywhere', pts: 50, x, y: 4, z, r: 3.5, id: `tree${i}` })),
    ],
  };
}
