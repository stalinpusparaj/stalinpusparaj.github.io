/* Light Up the Skies — Pataka Chor: Seaside Fair · Konark: a fair on the open ground outside the Sun Temple, the sea beyond. The game's own scene
   (world3d-konark-sun-temple.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as konarkSunTemple } from './world3d-konark-sun-temple.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(konarkSunTemple({ tier }), {
    seed: 1250, half: 10, palette: 'vanity', lights: ['#ffd27a','#ff9a3c'],
    mix: ['anar','flowerpot','chakri','fountain','rocket','bomb','sutli','laddi'],
    left: 'Pattachitra stall lit up', right: 'Seashell stall lit up', cart: 'Cart jumps', animal: 'donkey',
  }, tier);
}
