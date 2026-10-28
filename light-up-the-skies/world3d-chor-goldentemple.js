/* Light Up the Skies — Pataka Chor: Heritage Street · Amritsar: the heritage street outside the Golden Temple, the shrine a quiet backdrop. The game's own scene
   (world3d-golden-temple.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as goldenTemple } from './world3d-golden-temple.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(goldenTemple({ tier }), {
    seed: 1604, half: 11, palette: 'vanity', lights: ['#ffd27a','#ffb84a'],
    mix: ['anar','flowerpot','chakri','fountain','sparkler','starwheel','rocket','silvertower'],
    left: 'Phulkari stall lit up', right: 'Lassi stall lit up', cart: 'Rickshaw jumps', animal: 'donkey',
  }, tier);
}
