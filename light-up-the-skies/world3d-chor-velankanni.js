/* Light Up the Skies — Pataka Chor: Beach Road · Velankanni: the beach road fair, the basilica a quiet backdrop. The game's own scene
   (world3d-velankanni-basilica.js) as it is, with a festival street over its forecourt from the shared builder
   (world3d-chor-kit.js). Nothing here targets the landmark; play stays on the street. */
import { build as velankanniBasilica } from './world3d-velankanni-basilica.js';
import { landmarkStreet } from './world3d-chor-kit.js';

export function build({ tier }) {
  return landmarkStreet(velankanniBasilica({ tier }), {
    seed: 1962, half: 12, palette: 'vanity', lights: ['#ffe9a8','#8ad8ff'],
    mix: ['anar','flowerpot','chakri','fountain','sparkler','starwheel','rocket','silvertower'],
    left: 'Candle stall lit up', right: 'Seashell stall lit up', cart: 'Cart jumps', animal: 'donkey',
  }, tier);
}
