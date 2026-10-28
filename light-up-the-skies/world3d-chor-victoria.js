/* Light Up the Skies — Pataka Chor: Maidan Mela · Victoria Memorial: Kolkata's Maidan fair before the Victoria Memorial, white over its gardens. The game's own scene
   (world3d-victoria-memorial.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as victoriaMemorial } from './world3d-victoria-memorial.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(victoriaMemorial({ tier }), {
    seed: 1921, half: 12, palette: 'vanity', lights: ['#ffd27a','#ff5a8a'],
    mix: ['bomb','laddi','rocket','anar','chakri','flowerpot','sutli','cometchain'],
    left: 'Jhalmuri stall lit up', right: 'Sweet shop lit up', cart: 'Phuchka cart jumps', animal: 'donkey',
  }, tier);
}
