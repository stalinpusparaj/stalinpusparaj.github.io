/* Event Sky cinematic trailer: window.ESCine (event-cine.js). Used by ESExport.bestOf({style: 'cinema'}).
 *
 * The EFX stage draws the sky (bursts, reveals, slides, the finale) on its own canvas; ESCine.compose() draws that frame
 * onto the video's canvas through a moving camera and adds the show around it:
 *   - camera: a slow push-in, and a short shake after each big burst (the stage's flash instants);
 *   - lasers: beams from the ground in four patterns (fan, cross, tunnel, scan), faded in and out, never strobing;
 *   - LED lights: a string of bulbs round the frame in four patterns (chase, wave, twinkle, heart);
 *   - light leaks, falling glitter in the theme's colours, a vignette, and letterbox bars on the opening and the end;
 *   - the opening line ("A story for Amma") with a light sweep across it, and a "Wish 2 of 5" / "Reason #2" tag on
 *     each wish.
 * ESCine.sfx(ctx, dest, cues) adds the sound: rocket whistles, booms, crackle, laser zaps, whooshes, a riser before the
 * finale and soft hits under the words, all synthesized (no sound files), mixed under the music.
 *
 * Flash safety (§4.24): nothing here flashes. Beams and bulbs fade over 300 ms or more, the brightest layer is the
 * stage's own bursts (already gated), and the shake moves the picture without changing its brightness.
 *
 *   ESCine.theme(tpl) → {hues:[…], leak, glitter, led, love, opener, tag}
 *   ESCine.plan({dur, sections:[{kind:'open'|'wish'|'photo'|'video'|'finale'|'end', at, ms}], booms:[t…], theme, w, h, seed}) → plan
 *   ESCine.compose(g, src, w, h, t, plan, words) draws one frame (words: {opener, openerUntil?, tags:[{at, ms, text}]})
 *   ESCine.fill(english, …values) the translated line with its holes filled
 *   ESCine.cues(plan) → [{t, kind}]   the sound cues of a plan
 *   ESCine.sfx(ctx, dest, cues)       schedules them on an (Offline)AudioContext
 *   ESCine.live(g, w, h, t, plan, {boost, finale}) the live screen's light show (under the acts; see live() below)
 *   ESCine.music({kind:'birthday'|'tune'|'file'|'none', file?, seconds, cues?, signal?}) → AudioBuffer|null   a reel's sound
 *   ESCine.loop(kind) → {buffer, period}|null   one loop of a tune (the live screen's background music)
 */
/* STRINGS:
A story for {0}
A birthday surprise for {0}
With love, for {0}
Get well soon, {0}
Merry Christmas, {0}
Happy New Year, {0}
Happy Anniversary, {0}
Happy Diwali, {0}
Thank you, {0}
We miss you, {0}
Sorry, {0}
Congratulations, {0}
Wish {0} of {1}
Reason #{0}
*/
(function () {
  'use strict';
  if (window.ESCine) return;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const tr = (s) => { try { const L = window.LUTSLang; return (L && typeof L.t === 'function' && L.t(s)) || s; } catch (e) { return s; } };
  const fill = (s, ...a) => tr(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  function rng(seed) { let x = 0; for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0; x = x || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

  // ---------- themes, by the event's template (an occasion) ----------
  const LOVE = { hues: [340, 0, 320, 45], leak: '255,120,160', glitter: [340, 45, 0], led: 'heart', love: true, tag: 'reason' };
  const THEMES = {
    birthday: { hues: [45, 320, 190, 280], leak: '255,190,90', glitter: [45, 320, 190], led: 'chase', opener: 'A birthday surprise for {0}', tag: 'wish' },
    wedding: Object.assign({}, LOVE, { hues: [45, 30, 340, 0], leak: '255,200,120', opener: 'With love, for {0}', tag: 'wish' }),
    anniversary: Object.assign({}, LOVE, { opener: 'Happy Anniversary, {0}' }),
    valentine: Object.assign({}, LOVE, { opener: 'With love, for {0}' }),
    proposal: Object.assign({}, LOVE, { opener: 'A story for {0}' }),
    missyou: Object.assign({}, LOVE, { opener: 'We miss you, {0}', tag: 'wish' }),
    mothersday: Object.assign({}, LOVE, { hues: [330, 290, 45, 0], opener: 'A story for {0}' }),
    fathersday: Object.assign({}, LOVE, { hues: [210, 45, 190, 260], leak: '140,190,255', glitter: [210, 45], led: 'wave', opener: 'A story for {0}' }),
    christmas: { hues: [0, 130, 45, 200], leak: '255,170,120', glitter: [200, 0, 45], led: 'twinkle', snow: true, opener: 'Merry Christmas, {0}', tag: 'wish' },
    newyear: { hues: [45, 200, 280, 0], leak: '200,170,255', glitter: [45, 200, 280], led: 'wave', opener: 'Happy New Year, {0}', tag: 'wish' },
    diwali: { hues: [35, 15, 300, 50], leak: '255,170,70', glitter: [40, 20, 300], led: 'twinkle', opener: 'Happy Diwali, {0}', tag: 'wish' },
    getwell: { hues: [160, 190, 50, 280], leak: '160,255,210', glitter: [160, 190, 50], led: 'wave', opener: 'Get well soon, {0}', tag: 'wish' },
    thanks: { hues: [45, 160, 200, 320], leak: '255,210,140', glitter: [45, 160], led: 'chase', opener: 'Thank you, {0}', tag: 'reason' },
    sorry: { hues: [210, 280, 330, 190], leak: '170,170,255', glitter: [210, 280], led: 'wave', opener: 'Sorry, {0}', tag: 'wish' },
    graduation: { hues: [45, 210, 0, 130], leak: '255,210,120', glitter: [45, 210], led: 'chase', opener: 'Congratulations, {0}', tag: 'wish' },
    justbecause: Object.assign({}, LOVE, { hues: [290, 190, 45, 340], opener: 'A story for {0}', tag: 'reason' }),
  };
  const DEFAULT = { hues: [45, 300, 190, 0], leak: '255,190,110', glitter: [45, 300, 190], led: 'chase', opener: 'A story for {0}', tag: 'wish' };
  const theme = (tpl) => Object.assign({}, DEFAULT, THEMES[tpl] || {});

  // ---------- plan ----------
  // Which laser and LED pattern each section gets, and when the camera shakes.
  const LASERS = ['fan', 'cross', 'tunnel', 'scan'];
  function plan(o) {
    const th = o.theme || DEFAULT, rnd = rng(o.seed || 'cine');
    const sections = (o.sections || []).map((s, i) => {
      const laser = s.kind === 'open' ? 'fan' : s.kind === 'finale' ? 'tunnel' : s.kind === 'end' || s.kind === 'video' ? '' : LASERS[(i + Math.floor(rnd() * 4)) % 4];
      const led = s.kind === 'finale' ? 'wave' : s.kind === 'open' ? 'chase' : th.led === 'heart' && s.kind !== 'wish' ? 'twinkle' : th.led;
      return Object.assign({ laser, led, hue: th.hues[i % th.hues.length] }, s);
    });
    const booms = (o.booms || []).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    const flakes = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), s: 0.4 + rnd() * 1.2, v: 0.03 + rnd() * 0.06, w: rnd() * TAU, h: th.glitter[Math.floor(rnd() * th.glitter.length)] }));
    const bulbs = 44;
    const tw = Array.from({ length: bulbs }, () => rnd() * TAU);
    return { dur: o.dur || 0, w: o.w, h: o.h, sections, booms, theme: th, flakes, bulbs, tw, reduced: !!o.reduced, seed: String(o.seed || 'cine') };
  }
  const sectionAt = (p, t) => p.sections.find((s) => t >= s.at && t < s.at + s.ms) || null;

  // ---------- drawing ----------
  function camera(g, src, w, h, t, p) {
    // a slow push-in over the whole video, a little faster in the finale; a shake after big bursts (smooth, 0.5 s).
    // Calmer fireworks (p.reduced): the picture holds still.
    if (p.reduced) { const dw = w * 1.02, dh = h * 1.02; g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh); return; }
    const fin = p.sections.find((s) => s.kind === 'finale');
    let z = 1.02 + 0.03 * clamp(t / Math.max(1, p.dur), 0, 1);
    if (fin && t > fin.at) z += 0.025 * sm((t - fin.at) / 3000);
    let dx = 0, dy = 0;
    for (const b of p.booms) {
      const a = t - b;
      if (a < 0) break;
      if (a > 600) continue;
      const k = (1 - a / 600) * Math.min(w, h) * 0.008;
      dx += Math.sin(a * 0.06 + b) * k; dy += Math.cos(a * 0.075 + b * 1.3) * k;
    }
    const dw = w * z, dh = h * z;
    g.drawImage(src, (w - dw) / 2 + dx, (h - dh) / 2 + dy, dw, dh);
  }
  function beam(g, x0, y0, ang, len, width, hue, al) {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `hsla(${hue},100%,70%,${al})`); gr.addColorStop(1, `hsla(${hue},100%,60%,0)`);
    g.strokeStyle = gr; g.lineCap = 'round';
    g.lineWidth = width * 4; g.globalAlpha = 0.18; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = width; g.globalAlpha = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  function lasers(g, w, h, t, s, p) {
    if (!s || !s.laser) return;
    const a = t - s.at, al = 0.55 * (s.level == null ? 1 : s.level) * sm(a / 500) * (1 - sm((a - s.ms + 500) / 500));
    if (al <= 0.01) return;
    const M = Math.min(w, h), L = Math.hypot(w, h), u = p && p.reduced ? 0 : a / 1000, wd = Math.max(1.5, M * 0.004); // (calm: beams hold still, only fade)
    g.save(); g.globalCompositeOperation = 'lighter';
    if (s.laser === 'fan') { // a fan of beams from the middle of the ground, opening and sweeping
      const n = 9, open = 0.25 + 0.6 * sm(a / 1500);
      for (let i = 0; i < n; i++) { const k = i / (n - 1) - 0.5; beam(g, w / 2, h * 1.02, -Math.PI / 2 + k * open * Math.PI + Math.sin(u * 1.3) * 0.12, L, wd, s.hue + i * 6, al); }
    } else if (s.laser === 'cross') { // two corners, beams crossing over the middle
      for (let i = 0; i < 5; i++) {
        const sw = Math.sin(u * 1.6 + i * 0.5) * 0.25;
        beam(g, 0, h * 1.01, -Math.PI / 4 - 0.18 + i * 0.09 + sw, L, wd, s.hue, al);
        beam(g, w, h * 1.01, -Math.PI * 3 / 4 + 0.18 - i * 0.09 - sw, L, wd, s.hue + 40, al);
      }
    } else if (s.laser === 'tunnel') { // beams round the centre, turning slowly
      const n = 16;
      for (let i = 0; i < n; i++) beam(g, w / 2, h * 0.38, (i / n) * TAU + u * 0.5, L * 0.7, wd, s.hue + (i % 4) * 30, al * 0.8);
    } else { // 'scan': a sheet of light that rises and falls across the sky
      const y = h * (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(u * 1.1)));
      for (let i = 0; i < 7; i++) beam(g, -w * 0.05, y + (i - 3) * M * 0.012, Math.sin(u * 0.7) * 0.05, w * 1.1, wd * 0.8, s.hue + i * 8, al * 0.9);
    }
    g.restore();
  }
  function bulbPos(i, n, w, h) { // round the frame, clockwise from the top left, a little inside the edge
    const m = Math.min(w, h) * 0.035, pw = w - 2 * m, ph = h - 2 * m, per = 2 * (pw + ph);
    let d = (i / n) * per;
    if (d < pw) return [m + d, m]; d -= pw;
    if (d < ph) return [w - m, m + d]; d -= ph;
    if (d < pw) return [w - m - d, h - m]; d -= pw;
    return [m, h - m - d];
  }
  function heartPos(i, n, w, h) {
    const q = (i / n) * TAU, x = 16 * Math.pow(Math.sin(q), 3), y = 13 * Math.cos(q) - 5 * Math.cos(2 * q) - 2 * Math.cos(3 * q) - Math.cos(4 * q);
    const k = Math.min(w, h) * 0.021;
    return [w / 2 + x * k, h * 0.36 - y * k];
  }
  function leds(g, w, h, t, s, p) {
    if (!s || !s.led) return;
    const a = t - s.at, al = (s.level == null ? 1 : 0.55 + 0.45 * s.level) * sm(a / 400) * (1 - sm((a - s.ms + 400) / 400));
    if (al <= 0.01) return;
    const n = s.led === 'heart' ? 36 : p.bulbs, r = Math.max(2, Math.min(w, h) * 0.007), u = p.reduced ? 0 : a / 1000; // (calm: bulbs hold still)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const [x, y] = s.led === 'heart' ? heartPos(i, n, w, h) : bulbPos(i, n, w, h);
      let lv, hue = s.hue;
      if (s.led === 'chase') { const d = ((i / n - u * 0.35) % 1 + 1) % 1; lv = 0.25 + 0.75 * Math.pow(Math.max(0, Math.cos(d * TAU * 3)), 6); }
      else if (s.led === 'wave') { lv = 0.55 + 0.45 * Math.sin(i * 0.45 - u * 3); hue = (s.hue + i * 9 + u * 40) % 360; }
      else if (s.led === 'twinkle') lv = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(u * 2.2 + p.tw[i % p.tw.length]), 3);
      else lv = (0.5 + 0.5 * Math.sin(u * 2.4)) * 0.6 + 0.4 * sm((a - i * 30) / 300); // heart: drawn bulb by bulb, then breathing
      const A = al * lv;
      if (A <= 0.02) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 4);
      gr.addColorStop(0, `hsla(${hue},100%,85%,${A})`); gr.addColorStop(0.3, `hsla(${hue},100%,60%,${A * 0.5})`); gr.addColorStop(1, `hsla(${hue},100%,50%,0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 4, 0, TAU); g.fill();
    }
    g.restore();
  }
  function leaks(g, w, h, t, p) {
    const c = p.theme.leak || '255,190,110', u = t / 1000;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const x = w * (0.5 + 0.55 * Math.sin(u * 0.13 + i * 2.4)), y = h * (0.3 + 0.4 * Math.cos(u * 0.09 + i * 1.7)), R = Math.max(w, h) * 0.55;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${c},0.13)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    g.restore();
  }
  function glitter(g, w, h, t, p) {
    const M = Math.min(w, h), u = t / 1000;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const f of p.flakes) {
      const y = ((f.y + u * f.v) % 1) * h, x = (f.x + 0.02 * Math.sin(u * 1.5 + f.w)) * w, tw = p.reduced ? 0.6 : 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(u * 4 + f.w * 3), 2);
      g.fillStyle = p.theme.snow ? `rgba(255,255,255,${0.55 * tw})` : `hsla(${f.h},100%,75%,${0.6 * tw})`;
      const s = f.s * M * (p.theme.snow ? 0.005 : 0.003);
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    g.restore();
  }
  function vignette(g, w, h, t, p) {
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // letterbox bars: on the opening (sliding away) and coming back for the end
    const open = p.sections.find((s) => s.kind === 'open'), fin = p.sections.find((s) => s.kind === 'finale');
    let k = 0;
    if (open && t < open.at + open.ms + 600) k = 1 - sm((t - open.at - open.ms + 400) / 900);
    if (fin && t > fin.at + fin.ms - 2500) k = Math.max(k, sm((t - fin.at - fin.ms + 2500) / 1200));
    if (k > 0.01) { const bh = h * 0.09 * k; g.fillStyle = '#000'; g.fillRect(0, 0, w, bh); g.fillRect(0, h - bh, w, bh); }
  }
  function sweepText(g, text, x, y, px, t0, t, w, color) {
    const a = t - t0;
    if (a < 0 || !text) return;
    g.save();
    g.font = `700 ${px}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = px; while (g.measureText(text).width > w * 0.88 && s > 10) { s *= 0.92; g.font = `700 ${s}px Cinzel, Georgia, serif`; }
    const tw = g.measureText(text).width;
    g.globalAlpha *= sm(a / 600); // (times the caller's fade)
    g.shadowColor = color; g.shadowBlur = s * 0.6; g.fillStyle = '#fff6e0'; g.fillText(text, x, y);
    // a light sweep across the words
    const sx = x - tw / 2 - s * 2 + ((a % 2600) / 2600) * (tw + s * 4);
    const gr = g.createLinearGradient(sx - s * 1.5, 0, sx + s * 1.5, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop'; g.shadowBlur = 0; g.fillStyle = gr; g.fillText(text, x, y);
    g.restore();
  }
  // The same show drawn inside the EFX stage, with no second canvas (the trailer, ESExport.bestOf): cameraAt() for the
  // stage's camera, under() as its underlay (behind the bursts, the selfies and the words), over() in its overlay.
  // (Copying the stage's canvas into a second one each frame went wrong in some Android WebViews: a white glare.)
  function cameraAt(t, p, w, h) {
    if (p.reduced) return { z: 1.02, dx: 0, dy: 0 };
    const fin = p.sections.find((s) => s.kind === 'finale');
    let z = 1.02 + 0.03 * clamp(t / Math.max(1, p.dur), 0, 1);
    if (fin && t > fin.at) z += 0.025 * sm((t - fin.at) / 3000);
    let dx = 0, dy = 0;
    for (const b of p.booms) {
      const a = t - b;
      if (a < 0) break;
      if (a > 600) continue;
      const k = (1 - a / 600) * Math.min(w, h) * 0.008;
      dx += Math.sin(a * 0.06 + b) * k; dy += Math.cos(a * 0.075 + b * 1.3) * k;
    }
    return { z, dx, dy };
  }
  function under(g, w, h, t, p) {
    const s = sectionAt(p, t);
    leaks(g, w, h, t, p); lasers(g, w, h, t, s, p); leds(g, w, h, t, s, p); glitter(g, w, h, t, p);
  }
  function over(g, w, h, t, p, words) {
    words = words || {};
    vignette(g, w, h, t, p);
    const open = p.sections.find((x) => x.kind === 'open');
    const until = words.openerUntil || (open ? open.at + open.ms : 0);
    if (open && words.opener && t < until) {
      g.save(); g.globalAlpha = 1 - sm((t - until + 700) / 700);
      sweepText(g, words.opener, w / 2, h * 0.2, Math.min(w, h) * 0.075, open.at + 400, t, w, `hsl(${p.theme.hues[0]},100%,60%)`);
      g.restore();
    }
    for (const tg of words.tags || []) {
      const a = t - tg.at;
      if (a < 0 || a > tg.ms) continue;
      const al = sm(a / 300) * (1 - sm((a - tg.ms + 400) / 400));
      g.save(); g.globalAlpha = al;
      const px = Math.min(w, h) * 0.04;
      g.font = `600 ${px}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(tg.text).width + px * 1.6, y = h * (h > w ? 0.1 : 0.12);
      g.fillStyle = 'rgba(10,6,30,0.55)'; g.strokeStyle = `hsla(${p.theme.hues[0]},100%,70%,0.9)`; g.lineWidth = Math.max(1, px * 0.06);
      const r = px * 0.9; g.beginPath(); g.moveTo(w / 2 - tw / 2 + r, y - r); g.arcTo(w / 2 + tw / 2, y - r, w / 2 + tw / 2, y + r, r); g.arcTo(w / 2 + tw / 2, y + r, w / 2 - tw / 2, y + r, r); g.arcTo(w / 2 - tw / 2, y + r, w / 2 - tw / 2, y - r, r); g.arcTo(w / 2 - tw / 2, y - r, w / 2 + tw / 2, y - r, r); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffe9b8'; g.fillText(tg.text, w / 2, y + px * 0.04);
      g.restore();
    }
  }
  function compose(g, src, w, h, t, p, words) {
    words = words || {};
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    camera(g, src, w, h, t, p);
    const s = sectionAt(p, t);
    leaks(g, w, h, t, p);
    lasers(g, w, h, t, s, p);
    leds(g, w, h, t, s, p);
    glitter(g, w, h, t, p);
    vignette(g, w, h, t, p);
    const open = p.sections.find((x) => x.kind === 'open');
    const until = words.openerUntil || (open ? open.at + open.ms : 0);
    if (open && words.opener && t < until) {
      const fade = 1 - sm((t - until + 700) / 700);
      g.globalAlpha = fade;
      sweepText(g, words.opener, w / 2, h * (h > w ? 0.2 : 0.2), Math.min(w, h) * 0.075, open.at + 400, t, w, `hsl(${p.theme.hues[0]},100%,60%)`);
      g.globalAlpha = 1;
    }
    for (const tg of words.tags || []) {
      const a = t - tg.at;
      if (a < 0 || a > tg.ms) continue;
      const al = sm(a / 300) * (1 - sm((a - tg.ms + 400) / 400));
      g.save(); g.globalAlpha = al;
      const px = Math.min(w, h) * 0.04;
      g.font = `600 ${px}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(tg.text).width + px * 1.6, y = h * (h > w ? 0.1 : 0.12);
      g.fillStyle = 'rgba(10,6,30,0.55)'; g.strokeStyle = `hsla(${p.theme.hues[0]},100%,70%,0.9)`; g.lineWidth = Math.max(1, px * 0.06);
      const r = px * 0.9; g.beginPath(); g.moveTo(w / 2 - tw / 2 + r, y - r); g.arcTo(w / 2 + tw / 2, y - r, w / 2 + tw / 2, y + r, r); g.arcTo(w / 2 + tw / 2, y + r, w / 2 - tw / 2, y + r, r); g.arcTo(w / 2 - tw / 2, y + r, w / 2 - tw / 2, y - r, r); g.arcTo(w / 2 - tw / 2, y - r, w / 2 + tw / 2, y - r, r); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffe9b8'; g.fillText(tg.text, w / 2, y + px * 0.04);
      g.restore();
    }
    g.restore();
  }

  // ---------- sound ----------
  function cues(p) {
    const out = [];
    for (const b of p.booms) { out.push({ t: b - 1150, kind: 'rocket' }, { t: b, kind: 'boom' }, { t: b + 250, kind: 'crackle' }); }
    for (const s of p.sections) {
      if (s.kind === 'open') out.push({ t: s.at + 200, kind: 'riser', ms: Math.max(1500, s.ms - 300) }, { t: s.at + 450, kind: 'hit' });
      else if (s.kind === 'finale') out.push({ t: s.at - 2200, kind: 'riser', ms: 2200 }, { t: s.at, kind: 'hit' });
      else out.push({ t: s.at - 250, kind: 'whoosh' });
      if (s.laser) out.push({ t: s.at + 150, kind: 'laser' });
    }
    return out.filter((c) => c.t >= 0 && (!p.dur || c.t < p.dur)).sort((a, b) => a.t - b.t);
  }
  function noiseBuffer(ctx, sec) {
    const n = Math.ceil(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let x = 12345; for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; d[i] = (x / 4294967296) * 2 - 1; }
    return b;
  }
  function sfx(ctx, dest, list) {
    const noise = noiseBuffer(ctx, 2), out = ctx.createGain(); out.gain.value = 0.7; out.connect(dest);
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const pan = (v) => { if (!ctx.createStereoPanner) return out; const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(out); return p; };
    let k = 0;
    for (const c of list) {
      const t = c.t / 1000, side = pan(((k++ * 0.37) % 1) * 1.2 - 0.6);
      if (c.kind === 'rocket') { // a rising whistle with a little hiss
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(2400, t + 1.05);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(side); o.start(t); o.stop(t + 1.15);
      } else if (c.kind === 'boom') { // a low thump and a burst of filtered noise
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
        env(g, t, 0.01, 0.6, 0.9); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
        const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
        n.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.8);
        env(g2, t, 0.005, 0.35, 0.8); n.connect(f); f.connect(g2); g2.connect(side); n.start(t, (k * 0.173) % 0.5, 1);
      } else if (c.kind === 'crackle') { // a dozen tiny pops
        for (let i = 0; i < 12; i++) {
          const tt = t + i * 0.07 + ((i * 37) % 11) / 200, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          n.buffer = noise; f.type = 'highpass'; f.frequency.value = 2500; env(g, tt, 0.002, 0.12, 0.04);
          n.connect(f); f.connect(g); g.connect(pan(((i * 0.29) % 1) * 1.6 - 0.8)); n.start(tt, (i * 0.13) % 1.5, 0.06);
        }
      } else if (c.kind === 'whoosh') { // noise through a sweeping band-pass
        const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        n.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.45);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        n.connect(f); f.connect(g); g.connect(side); n.start(t, 0.3, 0.7);
      } else if (c.kind === 'laser') { // a soft falling zap
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.35);
        env(g, t, 0.01, 0.035, 0.35); o.connect(g); g.connect(side); o.start(t); o.stop(t + 0.4);
      } else if (c.kind === 'riser') { // rising noise and a climbing tone into the next part
        const d = (c.ms || 2000) / 1000, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        n.buffer = noise; n.loop = true; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + d * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
        n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + d + 0.1);
        const o = ctx.createOscillator(), g2 = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + d);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.05, t + d * 0.9); g2.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
        o.connect(g2); g2.connect(out); o.start(t); o.stop(t + d + 0.1);
      } else if (c.kind === 'hit') { // a deep, soft impact under the words
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(40, t + 1.2);
        env(g, t, 0.01, 0.5, 1.6); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.8);
      }
    }
  }

  // ---------- music (the best-of's sound and the live screen's background music) ----------
  // The sound under a best-of, mixed offline to its exact length (48 kHz stereo AudioBuffer):
  //   'birthday' the Happy Birthday melody (public domain) on a music box over soft chords, 120 beats a minute, repeated;
  //   'tune'     a calm celebration arpeggio (C, G, Am, F, two seconds each);
  //   'file'     the host's own song (a File or Blob from this phone), from its start, looped if short;
  // all with a 0.6 s fade in and a 2.5 s fade out. Null for 'none' or when the song does not open.
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const HB = [ // [midi, beats]: G G A G C B | G G A G D C | G G G' E C B A | F F E C D C
    [67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2], [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
    [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2], [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 3]];
  const HB_CHORDS = [[48, 1], [48, 3], [43, 3], [43, 3], [48, 3], [48, 3], [41, 3], [48, 2], [43, 1], [48, 3]]; // [root, beats], from the pickup
  // Each piece is rendered once in a short OfflineAudioContext and laid into the reel as buffers: the tunes as one
  // loop (a verse of Happy Birthday, 14 s; the celebration tune, 8 s), the trailer's effects in 10 s windows. Making
  // every note of a 3-minute reel at once cost time growing with the square of its length (a minute on a laptop).
  // o.signal: checked between pieces (Cancel). o.failed is set when the host's song does not open.
  const SR = 48000;
  function voices(ac, dest) {
    const bell = (t, midi, len, vol) => { // a music-box note: a few partials, quick attack, long fall
      [[1, 1], [2, 0.32], [3, 0.12], [4.2, 0.05]].forEach(([m, a]) => {
        const os = ac.createOscillator(), g = ac.createGain();
        os.type = 'sine'; os.frequency.value = NOTE(midi) * m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.4, len) * 1.6);
        os.connect(g); g.connect(dest); os.start(t); os.stop(t + Math.max(0.4, len) * 1.6 + 0.05);
      });
    };
    const pad = (t, root, len, minor) => { // a soft chord under the melody
      [0, minor ? 3 : 4, 7, 12].forEach((iv, k) => {
        const os = ac.createOscillator(), g = ac.createGain();
        os.type = 'triangle'; os.frequency.value = NOTE(root + iv + 12);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k ? 0.028 : 0.04, t + 0.25); g.gain.setValueAtTime(k ? 0.028 : 0.04, t + len - 0.3); g.gain.linearRampToValueAtTime(0, t + len);
        os.connect(g); g.connect(dest); os.start(t); os.stop(t + len + 0.02);
      });
    };
    return { bell, pad };
  }
  async function piece(sec, build) {
    const ac = new OfflineAudioContext(2, Math.max(1, Math.ceil(SR * sec)), SR);
    const out = ac.createGain(); out.connect(ac.destination);
    build(ac, out);
    return ac.startRendering();
  }
  const BIRTHDAY_LOOP = (HB.reduce((a, n) => a + n[1], 0) + 3) * 0.5; // one verse and a bar's rest, 120 beats a minute
  function birthdayLoop() {
    return piece(BIRTHDAY_LOOP + 2, (ac, out) => { // (+2 s: the last notes ring on into the next verse)
      const { bell, pad } = voices(ac, out), B = 0.5;
      let t = 0; for (const [m, b] of HB) { bell(t, m, b * B, 0.22); t += b * B; }
      t = HB[0][1] * B + HB[1][1] * B; // chords start on "birth-"
      for (const [r, b] of HB_CHORDS.slice(1)) { pad(t, r, b * B); t += b * B; }
    });
  }
  const TUNE_LOOP = 8;
  function tuneLoop() {
    return piece(TUNE_LOOP + 1, (ac, out) => {
      const { bell, pad } = voices(ac, out), P = [[48, 0], [43, 0], [45, 1], [41, 0]], ARP = [0, 7, 12, 16, 19, 16, 12, 7];
      P.forEach(([r, mi], i) => {
        const t = i * 2;
        pad(t, r, 2, mi);
        ARP.forEach((iv, k) => bell(t + k * 0.25, r + 24 + (mi && iv === 16 ? iv - 1 : iv), 0.25, 0.1));
      });
    });
  }
  async function music(o = {}) {
    const kind = o.kind || 'none', seconds = Math.max(1, +o.seconds || 30), cues = (o.cues && o.cues.length) ? o.cues : null;
    if ((kind === 'none' && !cues) || typeof OfflineAudioContext !== 'function') return null;
    const stop = () => { if (o.signal && o.signal.aborted) { const e = new Error('Cancelled'); e.name = 'ESError'; e.code = 'CANCELLED'; throw e; } };
    // the pieces: [buffer, start s, gain, through the music's fades?]
    const parts = [];
    if (kind === 'file') {
      let buf = null;
      try { const dc = new OfflineAudioContext(2, SR, SR); buf = await dc.decodeAudioData(await (o.file.arrayBuffer ? o.file.arrayBuffer() : new Response(o.file).arrayBuffer())); } catch (e) { buf = null; }
      if (!buf || !buf.duration) { o.failed = true; if (!cues) return null; } else for (let t = 0; t < seconds; t += buf.duration) parts.push([buf, t, 0.9, true]);
    } else if (kind === 'birthday') {
      const loop = await birthdayLoop();
      for (let t = 0.8; t < seconds; t += BIRTHDAY_LOOP) parts.push([loop, t, 1, true]);
    } else if (kind === 'tune') {
      const loop = await tuneLoop();
      for (let t = 0.3; t < seconds; t += TUNE_LOOP) parts.push([loop, t, 1, true]);
    }
    stop();
    // the trailer's sound effects (event-cine.js), in 10 s windows (each cue lands in its own window, its tail rings 3 s)
    if (cues) {
      const WIN = 10000;
      for (let w0 = 0; w0 < seconds * 1000; w0 += WIN) {
        const mine = cues.filter((c) => c.t >= w0 && c.t < w0 + WIN).map((c) => Object.assign({}, c, { t: c.t - w0 }));
        if (!mine.length) continue;
        const buf = await piece(WIN / 1000 + 3, (ac, out) => sfx(ac, out, mine));
        parts.push([buf, w0 / 1000, kind === 'none' ? 1 : 0.85, false]);
        stop();
      }
    }
    if (!parts.length) return null;
    const ac = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
    const master = ac.createGain(); master.gain.value = 0;
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.85, 0.6);
    master.gain.setValueAtTime(0.85, Math.max(0.7, seconds - 2.5)); master.gain.linearRampToValueAtTime(0, seconds);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    for (const [buf, t, gain, faded] of parts) {
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; g.gain.value = gain; src.connect(g); g.connect(faded ? master : comp);
      src.start(t);
    }
    try { const r = await ac.startRendering(); stop(); return r; } catch (e) { if (e && e.code === 'CANCELLED') throw e; return null; }
  }

  // One loop of a tune, for the live screen to play over and over: {buffer, period (s)}. Null where audio can't be made.
  // The ringing tail past the loop's end is folded back onto its start, so it plays round with no seam or click.
  async function loop(kind) {
    if (typeof OfflineAudioContext !== 'function') return null;
    try {
      const period = kind === 'birthday' ? BIRTHDAY_LOOP : TUNE_LOOP, raw = kind === 'birthday' ? await birthdayLoop() : await tuneLoop();
      const n = Math.round(period * SR), out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR });
      for (let c = 0; c < 2; c++) {
        const src = raw.getChannelData(Math.min(c, raw.numberOfChannels - 1)), dst = out.getChannelData(c);
        dst.set(src.subarray(0, n));
        for (let i = n; i < src.length; i++) dst[i - n] += src[i];
      }
      return { buffer: out, period };
    } catch (e) { return null; }
  }

  // ---------- the live screen (event-wall.js) ----------
  // The same light show under the sky's acts (EFX stage underlay), so photos and words stay on top. A new laser and
  // LED pattern every 12 s, picked from the event's seed and the time, so every screen of the event shows the same;
  // brighter while a guest's wish is on screen (o.boost, 0..1) and in the finale (o.finale: tunnel lasers, a wave).
  const LIVE_PERIOD = 12000;
  function live(g, w, h, t, p, o = {}) {
    if (!p) return;
    // o.hole {x, y, w, h}: a photo on screen (a slide): the light show goes round it, never over it
    if (o.hole) { g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(o.hole.x, o.hole.y, o.hole.w, o.hole.h); g.clip('evenodd'); }
    const k = Math.floor(t / LIVE_PERIOD), r = rng(`${p.seed}:${k}`), th = p.theme, boost = clamp(+o.boost || 0, 0, 1), fin = !!o.finale;
    const love = th.led === 'heart';
    const s = {
      at: k * LIVE_PERIOD, ms: LIVE_PERIOD, hue: th.hues[(k + Math.floor(r() * 4)) % th.hues.length],
      laser: fin ? 'tunnel' : LASERS[(k + Math.floor(r() * 4)) % 4],
      led: fin ? 'wave' : love && boost > 0.5 ? 'heart' : ['chase', 'wave', 'twinkle'][(k + Math.floor(r() * 3)) % 3],
      level: fin ? 1.25 : 0.75 + 0.5 * boost,
    };
    leaks(g, w, h, t, p);
    lasers(g, w, h, t, s, p);
    leds(g, w, h, t, s, p);
    glitter(g, w, h, t, p);
    if (o.hole) g.restore();
  }

  window.ESCine = Object.freeze({ theme, plan, compose, cameraAt, under, over, cues, sfx, fill, live, music, loop, THEMES: Object.keys(THEMES) });
})();
