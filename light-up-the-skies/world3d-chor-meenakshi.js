/* Light Up the Skies — Pataka Chor: Pudhu Mandapam Street · Madurai: the bazaar street outside the temple, the gopurams a quiet backdrop. The game's own scene
   (world3d-meenakshi-amman-temple.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as meenakshiAmmanTemple } from './world3d-meenakshi-amman-temple.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(meenakshiAmmanTemple({ tier }), {
    seed: 1623, half: 10, palette: 'vanity', lights: ['#ffd27a','#ff5a8a'],
    mix: ['flowerpot','anar','chakri','sparkler','laddi','bomb','rocket','fountain'],
    left: 'Jasmine stall lit up', right: 'Bangle stall lit up', cart: 'Cart jumps', animal: 'elephant',
  }, tier);
}
