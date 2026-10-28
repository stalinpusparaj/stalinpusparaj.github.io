/* Light Up the Skies — Pataka Chor: Manor Mela · Golden Manor: a festival fair laid out on the lawn before the Golden Manor. The game's own scene
   (world3d-golden-manor.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as goldenManor } from './world3d-golden-manor.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(goldenManor({ tier }), {
    seed: 1900, half: 10, palette: 'vanity', lights: ['#ffd27a','#ffe9a8'],
    mix: ['rocket','rocketcombo','anar','chakri','starwheel','silvertower','fountain','sparkler'],
    left: 'Sweet stall lit up', right: 'Toy stall lit up', cart: 'Cart jumps', animal: 'donkey',
  }, tier);
}
