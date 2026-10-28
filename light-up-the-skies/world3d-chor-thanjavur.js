/* Light Up the Skies — Pataka Chor: Big Temple Street · Thanjavur: the street outside the Big Temple, the vimana a quiet backdrop. The game's own scene
   (world3d-brihadeeswarar-temple.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as brihadeeswararTemple } from './world3d-brihadeeswarar-temple.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(brihadeeswararTemple({ tier }), {
    seed: 1010, half: 10, palette: 'vanity', lights: ['#ffd27a','#ff9a3c'],
    mix: ['flowerpot','anar','chakri','sparkler','laddi','bomb','rocket','fountain'],
    left: 'Thalaiyatti bommai stall lit up', right: 'Veena shop lit up', cart: 'Cart jumps', animal: 'elephant',
  }, tier);
}
