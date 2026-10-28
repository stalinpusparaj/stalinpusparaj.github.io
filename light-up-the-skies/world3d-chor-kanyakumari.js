/* Light Up the Skies — Pataka Chor: Sunrise Bazaar · Kanyakumari: the shore bazaar at Kanyakumari, the rock memorial a quiet backdrop at sea. The game's own scene
   (world3d-vivekananda-rock-memorial.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as vivekanandaRockMemorial } from './world3d-vivekananda-rock-memorial.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(vivekanandaRockMemorial({ tier }), {
    seed: 1970, half: 10, palette: 'vanity', lights: ['#ffd27a','#ff9a3c'],
    mix: ['anar','flowerpot','chakri','fountain','sparkler','rocket','bomb','laddi'],
    left: 'Seashell stall lit up', right: 'Snack stall lit up', cart: 'Cart jumps', animal: 'donkey',
  }, tier);
}
