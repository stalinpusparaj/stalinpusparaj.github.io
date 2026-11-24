/* A full environment has sky above its roof and a courtyard below its base.
   Preserve both on phones and TVs; crop only excess empty sky/near paving. */
(function (root) {
  'use strict';
  function fitScene(width, height, imageWidth, imageHeight, ground, roof = .26, widePlate = false) {
    if (![width, height, imageWidth, imageHeight, ground].every(Number.isFinite) || Math.min(width, height, imageWidth, imageHeight) <= 0) return null;
    const base = .78, sky = height * .30;
    if (widePlate) {
      const scale = Math.max(width / imageWidth, height / imageHeight);
      const dw = imageWidth * scale, dh = imageHeight * scale;
      // A wide phone needs a little more foreground below its distant landmark.
      const dx = (width - dw) / 2, dy = Math.max(height - dh, height * .26 - dh * roof);
      return { dx, dy, dw, dh, roof: dy + dh * roof, fill: true, wide: true };
    }
    const scale = height > width ? width / imageWidth : Math.min(width / imageWidth, Math.max(1, ground - sky) / (imageHeight * (base - roof)));
    const dw = imageWidth * scale, dh = imageHeight * scale;
    const dx = (width - dw) / 2, dy = Math.max(ground - dh * base, sky - dh * roof);
    return { dx, dy, dw, dh, roof: dy + dh * roof, fill: width >= height && dw >= width - .5 };
  }
  if (typeof module === 'object' && module.exports) module.exports = fitScene;
  else root.LUTSSceneLayout = fitScene;
})(typeof window === 'object' ? window : globalThis);
