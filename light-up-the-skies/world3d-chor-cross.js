/* Light Up the Skies — Pataka Chor: Seafront Fair · Cross by the Sea: a seafront fair, the cross a quiet backdrop over the water. The game's own scene
   (world3d-cross-by-the-sea.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as crossByTheSea } from './world3d-cross-by-the-sea.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(crossByTheSea({ tier }), {
    seed: 1957, half: 10, palette: 'vanity', lights: ['#ffe9a8','#8ad8ff'],
    mix: ['anar','flowerpot','chakri','fountain','sparkler','starwheel','rocket','silvertower'],
    left: 'Snack stall lit up', right: 'Toy stall lit up', cart: 'Cart jumps', animal: 'donkey',
  }, tier);
}
