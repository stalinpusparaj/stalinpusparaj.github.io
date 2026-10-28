// Fireworks Street: sneak down a bazaar street on Diwali night and find the crackers hidden in it: on shop counters, behind
// crates, under the stalls. There is no shop and nothing to buy. Whatever you find goes in your bag (3 at a time).
// Tap a cracker in the bag to put it down in front of you and light it with Fire or a tap on it (the street has no
// sparkler: Fire and a throw light everything); or drag it up into the street to throw
// it: its fuse burns while you aim (hold too long and it goes off in your hand: a sooty face, nothing worse). It goes
// off, as itself, wherever it hits: on the street, on a wall, a roof or a tree, over the rooftops, or
// right on the dog, the old man or Seth-ji the shopkeeper (a cartoon fright and a sooty face; nobody is hurt, but they
// will come after you). Whatever it goes off near reacts (a shop lit up, a window flash, the cart jumps) for chaos
// points, more for each one inside a few seconds of the last. A cracker by a stash nobody has found sets that off too.
// Seth-ji, the old man and the dog walk the street. Seen, an alert fills (faster with a lit cracker in your hand, or
// just after a throw); when it is full Seth-ji comes for you. Get to a hiding place and he loses you; caught, he wags a
// finger at you and takes your bag.
// The donkey ambles up and down the street with a saddle basket on its back: drag a cracker onto it and the cracker
// rides in the basket. Light it (Fire, the sparkler, a tap) and the donkey perks up and trots, hopping at each bang,
// carrying the show down the street until the cracker is spent: a Pataka parade.
// You move between the street's fixed viewpoints (world3d-chor-street.js), or, on a phone that can take it (and on a
// PC), walk it yourself: a floating joystick on the left of the screen (or W A S D / the arrows), drag on the right to
// look round. Walking, you must be next to a stash to take it, and a hiding place is where you stand. The day's stashes are the
// same for everyone (seeded by the date); a rare one holds a Premium cracker and opens with Premium or gems.
// The game lends the 3D street, placing, firing and the wallet through window.LUTSGame.chor.
(function () {
  'use strict';
  const ORBS = 5, DIYAS = 6, DIYA_CAP = 10; // sky shells and lucky diyas a day; gems the diyas can pay a day
  const DELIVERY = 150; // seconds between the donkey's deliveries
  const HEIST = 12, REFILL = 75, MIN_LOOT = 6, GUARD = 10; // the shop's dozen; seconds between new stashes while fewer than MIN_LOOT are out; metres Seth-ji guards his shop from
  const RARE = 4, RARE_ORBS = 2, RARE_SHOP = 4, RARE_REFILL = 0.35; // Premium finds: of the day's stashes, sky orbs, the shop's dozen; share of new stashes
  // The street race is a heist: the nine stashes are pieces of a key, the key opens Seth-ji's vault, and the week's
  // treasure has to be carried back to the gate with Seth-ji on your heels. Each week a different treasure.
  const TREASURES = [['lakshmi', 'Golden Lakshmi', '🪷'], ['nataraja', 'Bronze Nataraja', '🔱'], ['ganesha', 'Silver Ganesha', '🐘'], ['peacock', 'Jewelled Peacock', '🦚'], ['diya', 'Diamond Diya', '🪔'], ['crown', 'Maharaja’s Crown', '👑']];
  // Each treasure's own picture (assets/chor/treasure, made in Google Flow); the emoji stays for texts and toasts.
  const tPic = (t) => `<img class="chor-tpic" src="assets/chor/treasure/${t[0]}.webp" alt="" aria-hidden="true">`;
  // The same pictures for canvases (the vault's marker in the street), loaded once each.
  const tImgs = {};
  const tImg = (id) => { if (!tImgs[id]) { tImgs[id] = new Image(); tImgs[id].src = `assets/chor/treasure/${id}.webp`; } return tImgs[id]; };
  const treasureOfWeek = (ms = Date.now()) => TREASURES[Math.floor((ms / 864e5 + 3) / 7) % TREASURES.length];
  const THIEF_HEISTS = 5, ESCAPE_RUN = 3.6, GATE_R = 3.5; // heists for the Master Thief frame; Seth-ji's speed after you; how near the gate counts
  const BAG = 6, BIG_BAG = 10, /* kinds of cracker the bag holds (each up to STACK); it scrolls */ STASHES = 9, RARE_GEMS = 15, REACH = 24; // metres: further away, the stash is only a glow to walk to
  // The Kit, for gems (Premium: the bigger bag free): a bigger bag for good, and decoys, stash pings and lucky charms (keep
  // your bag when caught) a few at a time. A decoy is a noise up the street that the dog runs to and the men turn to.
  const KIT = {
    bigBag: { name: 'Bigger bag', line: 'Carry 10 kinds of cracker, not 6. Yours for good', gems: 60, once: true },
    decoy: { name: 'Decoy ×3', line: 'A noise up the street: the dog runs to it, everyone looks away', gems: 10, adds: 3 },
    ping: { name: 'Stash ping ×3', line: 'Every hidden stash glows through walls for 12 seconds', gems: 8, adds: 3 },
    charm: { name: 'Lucky charm ×2', line: 'Caught? Keep your bag', gems: 12, adds: 2 },
  };
  const PING = 12;
  // The streets, all free to play. (A street can be made Premium again with premium: true: its card then opens Premium.)
  const SHOP_OFF = true; // Seth-ji's 3D shop is off for now: not in the picker, never opened; All crackers lists every cracker
  const STREETS = [{ id: 'chor-street', name: 'Bazaar' }, { id: 'chor-lane', name: 'Temple Lane' },
    { id: 'chor-charminar', name: 'Laad Bazaar · Charminar' },
    { id: 'chor-redfort', name: 'Chandni Chowk · Red Fort' },
    { id: 'chor-hawamahal', name: 'Johari Bazaar · Hawa Mahal' },
    { id: 'chor-gateway', name: 'Colaba · Gateway of India' },
    { id: 'chor-mysore', name: 'Dasara Fair · Mysore Palace' },
    { id: 'chor-taj', name: 'Taj Ganj · Taj Mahal' },
    { id: 'chor-indiagate', name: 'Kartavya Path · India Gate' },
  { id: 'chor-victoria', name: 'Maidan Mela · Victoria Memorial' },
  { id: 'chor-manor', name: 'Manor Mela · Golden Manor' },
  { id: 'chor-konark', name: 'Seaside Fair · Konark' },
  { id: 'chor-goldentemple', name: 'Heritage Street · Amritsar' },
  { id: 'chor-meenakshi', name: 'Pudhu Mandapam Street · Madurai' },
  { id: 'chor-thanjavur', name: 'Big Temple Street · Thanjavur' },
  { id: 'chor-velankanni', name: 'Beach Road · Velankanni' },
  { id: 'chor-cross', name: 'Seafront Fair · Cross by the Sea' },
  { id: 'chor-kanyakumari', name: 'Sunrise Bazaar · Kanyakumari' },
  { id: 'chor-shop', name: "Light Up the Skies · Seth-ji's cracker shop" }];
  const FUSE = 3, THROW = 28, FLIGHT = 0.75, FALL = 0.35, BOUNCE = 0.25, HOT = 0.6; // (FALL: off a wall to the street; HOT: thrown after this share of its fuse, it fires as it falls) // seconds a fuse burns in your hand; metres a throw reaches; seconds in the air
  const COMBO = 4, CHAIN = 3, DONKEY_SNAP = 2.8, DONKEY_TAP = 7; // seconds a combo lasts; metres a landing sets off a stash; metres from the donkey a drop snaps to its basket
  // How the watchers see: metres, half the view cone (radians), alert a second while they see you. From high up (the
  // rooftop) only someone close by notices.
  const EYES = { keeper: { range: 16, cone: 0.95, rate: 20 }, man: { range: 11, cone: 0.85, rate: 11 }, dog: { range: 14, cone: 1.4, rate: 15 } };
  // Metres up that count as high; who notices you up there; how near he must get; seconds a chase lasts, hiding to lose
  // him, his "Oi!" before he runs, and the grace after a catch; his speed after you.
  const HIGH = 6, HIGH_RANGE = 7, CATCH = 2.2, CHASE = 14, LOSE = 2.5, OI = 1, GRACE = 5, RUN = 2.7;
  // The picker's details for each street: its city, the animal that carries the basket, and its painted card
  // (assets/chor/thumb/<id>.webp).
  const PLACE = { 'chor-street': ['Any town', 'donkey'], 'chor-lane': ['Any town', 'donkey'], 'chor-charminar': ['Hyderabad', 'donkey'],
    'chor-redfort': ['Delhi', 'donkey'], 'chor-hawamahal': ['Jaipur', 'camel'], 'chor-gateway': ['Mumbai', 'donkey'],
    'chor-mysore': ['Mysuru', 'elephant'], 'chor-taj': ['Agra', 'donkey'], 'chor-indiagate': ['Delhi', 'donkey'],
    'chor-victoria': ['Kolkata', 'donkey'], 'chor-manor': ['Any town', 'donkey'], 'chor-konark': ['Konark', 'donkey'],
    'chor-goldentemple': ['Amritsar', 'donkey'], 'chor-meenakshi': ['Madurai', 'elephant'], 'chor-thanjavur': ['Thanjavur', 'elephant'],
    'chor-velankanni': ['Velankanni', 'donkey'], 'chor-cross': ['Kanyakumari', 'donkey'], 'chor-kanyakumari': ['Kanyakumari', 'donkey'], 'chor-shop': ['Any town', 'donkey'] };
  // Each street's accent for the HUD's glow, taken from its strings of lights, so the frame belongs to the scene.
  const ACCENT = { 'chor-street': '#ff5fa2', 'chor-lane': '#ff9a3c', 'chor-charminar': '#ff6ad5', 'chor-redfort': '#ff6a3c', 'chor-hawamahal': '#ff7a9a',
    'chor-gateway': '#5fc8ff', 'chor-mysore': '#ffc23c', 'chor-taj': '#ff9ad1', 'chor-indiagate': '#ff9a3c', 'chor-victoria': '#ff5a8a',
    'chor-manor': '#ffd27a', 'chor-konark': '#ff9a3c', 'chor-goldentemple': '#ffb84a', 'chor-meenakshi': '#ff5a8a', 'chor-thanjavur': '#ff9a3c',
    'chor-velankanni': '#8ad8ff', 'chor-cross': '#8ad8ff', 'chor-kanyakumari': '#ff9a3c', 'chor-shop': '#ffd23c' };
  const RIDER = { donkey: ['🫏', 'Donkey'], camel: ['🐪', 'Camel'], elephant: ['🐘', 'Elephant'] };
  const KEY = 'luts:chor';
  const WALK = 3.2, SPRINT = 5.5, STICK = 56, NEAR = 6, HIDE_R = 1.8; // m/s; joystick px; reach and a hiding place's size walking

  // ---------- The rules (no DOM, so the tests load this part in Node) ----------
  function seeded(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return () => {
      h = (h + 0x6D2B79F5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // spots: the street's hiding places; types: what may be found; premium(t): whether t is a Premium cracker.
  // mix: the crackers this street leans to; gem(t): a cracker that costs gems to light in the show. The finds favour
  // the special ones: RARE of the day's stashes hold a Premium cracker, and over half the rest a gem cracker (found
  // crackers light free), the rest the street's own or any everyday one.
  function dayStashes(day, spots, types, premium, mix = [], gem = () => false) {
    const rnd = seeded(`chor:${day}`), free = types.filter((t) => !premium(t)), rare = types.filter(premium);
    const local = mix.filter((t) => free.includes(t)), gems = free.filter(gem);
    const order = spots.map((p, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i).slice(0, Math.min(STASHES, spots.length));
    return order.map((i, k) => {
      const isRare = k < RARE && rare.length > 0;
      const r = rnd(), pool = isRare ? rare : gems.length && r < 0.55 ? gems : local.length && r < 0.85 ? local : free;
      // A box of 1 to 4 of one kind (a rare one is a single cracker).
      const count = isRare ? 1 : 1 + Math.floor(rnd() * rnd() * 4);
      return { spot: i, key: i, x: spots[i].x, z: spots[i].z, type: pool[Math.floor(rnd() * pool.length)], rare: isRare, count };
    });
  }
  // Whether a watcher ({ name, x, z, yaw, act }) sees you at me ({ x, z, eye, hide }): in range, inside its view cone,
  // and you not hiding. Running scared, ears covered or wagging a finger, nobody is looking; one after you always sees you.
  function sees(w, me) {
    const e = EYES[w.name];
    if (!e || me.hide) return false;
    if (w.act === 'hunt') return true;
    if (['flee', 'cower', 'alert', 'ears', 'shoo'].includes(w.act)) return false;
    const dx = me.x - w.x, dz = me.z - w.z, d = Math.hypot(dx, dz);
    if (d > ((me.eye || 0) > HIGH ? HIGH_RANGE : e.range)) return false;
    if (d < 1.5) return true;
    const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - w.yaw), Math.cos(Math.atan2(dx, dz) - w.yaw));
    return Math.abs(off) <= e.cone;
  }
  // The alert (0..100) a moment dt later: up by each watcher who sees you (twice as fast when you're caught red-handed:
  // aiming, or just after a throw), down slowly when nobody does and fast while you hide.
  function alertStep(alert, seers, dt, { hide = false, red = false } = {}) {
    let up = 0;
    for (const n of seers) up += (EYES[n] ? EYES[n].rate : 0) * (red ? 2 : 1);
    const next = up ? alert + up * dt : alert - (hide ? 40 : 10) * dt;
    return Math.max(0, Math.min(100, next));
  }
  // What a landing at p sets off at time t (seconds): the targets in reach, scored. A target hit again within 20 s pays
  // half. Each hit inside COMBO seconds of the last raises the multiplier (up to x5). Every shop lit in one night pays a
  // Full house once. memo carries the night: { last, mult, hits: {id: t}, shops: Set, house }.
  function scoreLanding(p, t, targets, memo) {
    const out = [];
    const shops = targets.filter((g) => g.kind === 'shop');
    for (const g of targets) {
      if (Math.hypot(p.x - g.x, p.z - g.z) > g.r) continue;
      memo.mult = memo.last != null && t - memo.last <= COMBO ? Math.min(5, memo.mult + 1) : 1;
      memo.last = t;
      const again = memo.hits[g.id] != null && t - memo.hits[g.id] < 20;
      memo.hits[g.id] = t;
      out.push({ target: g, pts: Math.round((again ? g.pts / 2 : g.pts) * memo.mult), mult: memo.mult });
      if (g.kind === 'shop') memo.shops.add(g.id);
    }
    if (!memo.house && shops.length && shops.every((g) => memo.shops.has(g.id))) {
      memo.house = true;
      out.push({ target: { kind: 'house', name: 'Full house! Every shop lit', id: 'house' }, pts: 500, mult: 1 });
    }
    return out;
  }
  // The day's sky shells (glowing orbs floating over the street) and lucky diyas (a gem each), the same for everyone:
  // spots along the street (zone: its paved middle), sky: everyday shells, rareSky: Premium ones (one a day).
  function dayExtras(day, zone, sky, rareSky) {
    const rnd = seeded(`extras:${day}`), at = () => ({ x: zone.x0 + 0.5 + rnd() * (zone.x1 - zone.x0 - 1), z: zone.z0 + 4 + rnd() * (zone.z1 - zone.z0 - 8) });
    const orbs = [];
    for (let i = 0; i < ORBS; i++) {
      const rare = i < RARE_ORBS && rareSky.length > 0, pool = rare ? rareSky : sky;
      orbs.push({ key: `o${i}`, orb: true, ...at(), y: 2.4, type: `sky:${pool[Math.floor(rnd() * pool.length)]}`, rare, count: 1 });
    }
    const diyas = [];
    for (let i = 0; i < DIYAS; i++) diyas.push({ key: `y${i}`, diya: true, ...at(), y: 0.2, count: 1 });
    return [...orbs, ...diyas];
  }
  // The collection book's sets: name, what's in it (types, or a test), and the gems it pays once complete.
  const SETS = [
    { id: 'sky6', name: 'Sky painter', line: 'Collect 6 different sky shells', need: 6, test: (t) => t.startsWith('sky:'), gems: 20 },
    { id: 'ground8', name: 'Ground crew', line: 'Collect 8 different ground crackers', need: 8, test: (t) => !t.startsWith('sky:'), gems: 20 },
    { id: 'sivakasi', name: 'Sivakasi set', line: 'Sutli, bijili, kuruvi, two-sound, anil vedi and single shot', list: ['sutli', 'bijili', 'kuruvi', 'twosound', 'anilvedi', 'singleshot'], gems: 30 },
    { id: 'sky16', name: 'Whole sky', line: 'Collect 16 different sky shells', need: 16, test: (t) => t.startsWith('sky:'), gems: 50 },
  ];
  // How far a set is: [have, need].
  function setProgress(set, book) {
    const got = Object.keys(book || {});
    if (set.list) return [set.list.filter((t) => got.includes(t)).length, set.list.length];
    return [Math.min(set.need, got.filter(set.test).length), set.need];
  }
  // Seth-ji's shop: the night's big stash, a dozen crackers (two of them Premium), the same for everyone each day.
  function heistLoot(day, types, premium) {
    const rnd = seeded(`heist:${day}`), free = types.filter((t) => !premium(t)), rare = types.filter(premium);
    const out = [];
    for (let i = 0; i < HEIST - RARE_SHOP; i++) out.push(free[Math.floor(rnd() * free.length)]);
    for (let i = 0; i < RARE_SHOP; i++) out.push((rare.length ? rare : free)[Math.floor(rnd() * (rare.length || free.length))]);
    return out;
  }
  const newMemo = () => ({ last: null, mult: 1, hits: {}, shops: new Set(), house: false });
  if (typeof module === 'object' && module.exports) {
    module.exports = { RARE, RARE_ORBS, RARE_SHOP, dayExtras, SETS, setProgress, ORBS, DIYAS, heistLoot, HEIST, dayStashes, sees, alertStep, scoreLanding, newMemo, BAG, BIG_BAG, STASHES, COMBO, EYES, HIGH_RANGE, KIT, STREETS };
    return;
  }

  // ---------- The mode ----------
  const G = () => window.LUTSGame && window.LUTSGame.chor;
  // Text the page translates on its own (i18n.js) needs nothing; text drawn on a canvas, or names joined into a list,
  // goes through this.
  const T = (text) => (window.LUTSLang && window.LUTSLang.t ? window.LUTSLang.t(text) : text);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } };
  let chosenView = -1; // the spot last chosen in the bar, lit until you walk off
  let state = load(), stashes = [], hud = null, arc = null, raf = 0, shownView = -1, memo = newMemo(), clock = 0, lastT = 0;
  let aim = null, flying = [], marksKey = '', ads = []; // ads: the streets advertised on the shop's walls // aim: the cracker being aimed; flying: thrown ones in the air
  // The watch: the alert (0..100), the chase once it fills ({ t, lost }), when each watcher last noticed you, the last throw.
  let atStart = true; // just arrived on a street and not yet moved: hidden (see where)
  let alert = 0, chase = null, noticed = {}, lastThrow = -99, aimAt = null, aimFrame = 0, graceTo = 0, pingTo = 0;

  function fresh(day) {
    // A new day: new stashes and a new night's score; the bag, the kit, the street and walking carry over.
    if (state.day !== day) {
      const keep = ['bag', 'best', 'seen', 'tut', 'walk', 'walkTip', 'bigBag', 'decoy', 'ping', 'charm', 'street', 'book', 'sets', 'trophies', 'heists', 'raceBest'];
      state = { ...Object.fromEntries(keep.map((k) => [k, state[k]])), day, taken: [], takenBy: {}, score: 0 };
      state.bag = state.bag || [];
    }
  }
  function buildHud() {
    hud = el('div', 'chor-hud');
    hud.id = 'chorHud';
    hud.innerHTML = '<canvas class="chor-arc"></canvas>'
      // Top left, the night at a glance (score, finds, the alert); top right, round icon buttons, each with its name.
      + '<div class="chor-top"><div class="chor-stat"><img class="chor-mask" src="assets/chor/ui/mask.webp" alt="" aria-hidden="true"><span class="chor-score-row"><b class="chor-score"></b><small>chaos</small></span><span class="chor-count"></span>'
      + '<span class="chor-alert" role="img" aria-label="Alert"><i></i></span></div>'
      + '<div class="chor-acts"><button type="button" data-open="street" aria-label="Street"><img src="assets/chor/ui/street.webp" alt="" aria-hidden="true"><small>Street</small></button>'
      + '<button type="button" data-open="kit" aria-label="Kit"><img src="assets/chor/ui/kit.webp" alt="" aria-hidden="true"><small>Kit</small></button>'
      + '<button type="button" data-open="book" aria-label="Book"><img src="assets/chor/ui/book.webp" alt="" aria-hidden="true"><small>Book</small></button>'
      + '<button type="button" class="chor-end" aria-label="End night"><img src="assets/chor/ui/end.webp" alt="" aria-hidden="true"><small>End</small></button></div></div>'
      + '<div class="chor-views" role="group" aria-label="Move to"></div>'
      + '<div class="chor-race" hidden></div>'
      + '<canvas class="chor-mcv" aria-hidden="true"></canvas><div class="chor-marks"></div><div class="chor-pops"></div>'
      + '<div class="chor-ads"></div>'
      + '<div class="chor-stick" hidden aria-hidden="true"><i class="base"></i><i class="knob"></i></div>'
      + '<div class="chor-bottom"><div class="chor-bag" aria-label="Your bag"></div>'
      + '<p class="chor-tip">Tap a cracker to put it down · drag it up to throw</p></div>'
      + '<div class="chor-result" hidden></div><div class="chor-sheet" hidden></div>';
    document.body.appendChild(hud);
    arc = hud.querySelector('.chor-arc');
    // A marker takes the touch itself: down on it, up within a finger's slide, and it's yours (a click alone was lost
    // when the finger moved a little, the phone taking it for a scroll); a click with no touch (a TV remote) still works.
    const marks = hud.querySelector('.chor-marks');
    let press = null;
    marks.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-stash]'); if (!b) return; press = { b, x: e.clientX, y: e.clientY, id: e.pointerId }; try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } e.preventDefault(); e.stopPropagation(); });
    // The click the phone sends after the same touch would land on whatever opened under the finger (a rare stash's card:
    // its Not now) and close it at once: it's swallowed.
    let eatClickTo = 0;
    window.addEventListener('click', (e) => { if (performance.now() < eatClickTo) { e.stopPropagation(); e.preventDefault(); eatClickTo = 0; } }, true);
    marks.addEventListener('pointerup', (e) => { const p = press; press = null; if (!p || p.id !== e.pointerId) return; e.stopPropagation(); if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 48) { eatClickTo = performance.now() + 500; take(+p.b.dataset.stash, p.b.classList.contains('live')); } });
    marks.addEventListener('pointercancel', () => { press = null; });
    marks.addEventListener('click', (e) => { if (e.detail !== 0) return; const b = e.target.closest('[data-stash]'); if (b) take(+b.dataset.stash, b.classList.contains('live')); }); // (a live one: within the tap reach)
    const bag = hud.querySelector('.chor-bag');
    bag.addEventListener('pointerdown', bagDown);
    // A click with no pointer behind it (a TV remote's OK, a keyboard): offer what a finger would do.
    bag.addEventListener('click', (e) => { const b = e.target.closest('[data-bag]'); if (b && e.detail === 0) bagChoice(+b.dataset.bag); });

    hud.querySelector('.chor-views').addEventListener('click', (e) => {
      const w = G().w3d;
      if (!w) return;
      if (e.target.closest('[data-walk]')) { setWalk(!w.walking); return; }
      if (e.target.closest('[data-catalog]')) { openCatalog(); return; }
      if (e.target.closest('[data-trophies]')) { openTrophies(); return; }
      if (e.target.closest('[data-race]')) { if (race) endRace(false); else startRace(null); return; }
      if (e.target.closest('[data-drone]')) { w.drone(); chosenView = -1; G().tick(); syncViews(); return; } // (the joystick brings you down)
      if (e.target.closest('[data-shop]')) { goStreet('chor-shop'); return; }
      const b = e.target.closest('[data-view]');
      if (b) { w.goView(+b.dataset.view); chosenView = +b.dataset.view; atStart = false; G().tick(); syncViews(); } // (gone to a spot: off the start)
    });
    stickPad(hud.querySelector('.chor-stick'));
    // The score card says what it counts when tapped (people asked what "chaos" and "found" mean)
    const stat = hud.querySelector('.chor-stat');
    stat.style.pointerEvents = 'auto'; stat.setAttribute('role', 'button'); stat.tabIndex = 0;
    stat.addEventListener('click', () => G().toast(T('Chaos: points for the mischief your crackers cause (near people, stalls, roofs, the donkey). Found: today’s hidden stashes on this street.'), 5200));
    hud.querySelector('.chor-end').addEventListener('click', endNight);
    hud.querySelector('.chor-ads').addEventListener('click', (e) => { const b = e.target.closest('[data-ad]'); const a = b && ads[+b.dataset.ad]; if (a && a.id !== G().street) goStreet(a.id); });
    hud.querySelector('[data-open="kit"]').addEventListener('click', openKit);
    hud.querySelector('[data-open="street"]').addEventListener('click', () => openPicker(true));
    hud.querySelector('[data-open="book"]').addEventListener('click', openBook);
    hud.querySelector('.chor-sheet').addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target.classList.contains('chor-sheet')) { if (!hud.querySelector('[data-caught]')) closeSheet(); return; }
      const b = e.target.closest('[data-caught], [data-kit], [data-street], [data-cat]');
      if (!b || !sheetAct || b.disabled) return;
      b.disabled = true;
      try { await sheetAct(b.dataset.caught || b.dataset.kit || b.dataset.street || b.dataset.cat); } finally { b.disabled = false; }
    });
    bag.addEventListener('click', (e) => { const t = e.target.closest('[data-tool]'); if (t) (t.dataset.tool === 'decoy' ? decoy : ping)(); });
  }
  function syncViews() {
    const w = G().w3d, box = hud.querySelector('.chor-views');
    if (!w || !w.views) { box.innerHTML = ''; return; }
    // One bar, no modes: on a phone you always walk (the joystick), and a spot takes you there and stays lit until you
    // walk off. The shop lists its own spots only (to "Out to the street"; the bazaar's are behind its door).
    const list = w.wares ? w.views.slice(0, 6) : w.views, key = `${w.id}|${list.length}`;
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      // In the shop, its collection; on a street, the way into the shop (the streets are the Street button above).
      box.innerHTML = '<button type="button" class="chor-catbtn" data-catalog>🛍️ All crackers</button>' // (the 3D shop is off for now: SHOP_OFF)
        + (w.drone ? '<button type="button" data-drone>🚁 Drone view</button>' : '')
        + '<button type="button" class="chor-catbtn" data-race>🗝 Heist</button><button type="button" data-trophies>🏆 Trophies</button>'
        + list.map((v, i) => `<button type="button" data-view="${i}">${v.name}</button>`).join('');
    }
    const dr = box.querySelector('[data-drone]'); if (dr) dr.setAttribute('aria-pressed', String(!!w.aerial));
    const rb = box.querySelector('[data-race]'); if (rb) { rb.setAttribute('aria-pressed', String(!!race)); rb.textContent = race ? T('⏹ Stop heist') : T('🗝 Heist'); }
    box.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(w.walking ? +b.dataset.view === chosenView : +b.dataset.view === w.view)));
    hud.querySelector('.chor-stick').hidden = !w.walking;
    if (w.walking) requestAnimationFrame(() => restStick()); // (once the pad is laid out)
    shownView = w.view;
  }
  function syncBag() {
    const box = hud.querySelector('.chor-bag'), g = G();
    let html = '';
    const ks = kinds();
    for (let i = 0; i < Math.min(bagSize(), ks.length + 1); i++) { // (the kinds you carry and one empty slot; the row scrolls)
      const t = ks[i], n = t ? countOf(t) : 0;
      const art = t && g.art(t);
      html += t ? `<button type="button" class="chor-slot full" data-bag="${state.bag.lastIndexOf(t)}" aria-label="${g.label(t)}">${art ? `<img src="${art.src}" alt="">` : '<i class="chor-slot-ico" aria-hidden="true">🧨</i>'}<small>${g.label(t)}</small>${n > 1 ? `<em class="chor-stack">×${n}</em>` : ''}</button>`
        : '<span class="chor-slot" aria-label="Empty"></span>';
    }
    if (state.decoy > 0) html += `<button type="button" class="chor-slot tool" data-tool="decoy"><i aria-hidden="true">📢</i><small>Decoy</small><em>${state.decoy}</em></button>`;
    if (state.ping > 0) html += `<button type="button" class="chor-slot tool" data-tool="ping"><i aria-hidden="true">📡</i><small>Ping</small><em>${state.ping}</em></button>`;
    box.innerHTML = html;
    const daily = stashes.filter((o) => typeof o.key === 'number');
    hud.querySelector('.chor-count').textContent = race ? `🗝 ${daily.filter(isTaken).length}/${daily.length} keys` : `${daily.filter(isTaken).length}/${daily.length} found today`; // (today's stashes in free play; the key pieces in a heist)
    hud.querySelector('.chor-score').textContent = `${state.score}`;
  }
  // A ware on display: its picture stands on a step (world3d setWares); here, its tag (what you tap): its picture,
  // its name and its price chip (free, its gem value, or Premium).
  function ware(s, i) {
    const g = G();
    const gems = g.gemCost(s.type);
    const price = s.rare ? `<em class="prem">👑${g.premium() ? '' : ` ${RARE_GEMS}💎`}</em>` : gems ? `<em class="gem">💎${gems}</em>` : `<em class="free">${T('Free')}</em>`;
    return `<button type="button" class="chor-stash ware${s.rare ? ' rare' : ''}${s.stage ? ' stage' : ''}" data-stash="${i}" aria-label="${g.label(s.type)}"><small>${g.label(s.type)}</small>${price}</button>`; // (the picture is the one on the step)
  }
  // The markers as pictures drawn in the world (world3d setLabels), so they move with it as you walk; the buttons over
  // them (chor-marks) are only where you tap. A shop tag: its name and price in a pill; a street marker: its glowing box
  // with its sign (a gift, a gem, the shop's stock, a delivery, a star, a diya) and its badge (a price, ×n).
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function tagImage(s) {
    const g0 = G(), gems = g0.gemCost(s.type), name = T(g0.label(s.type));
    const price = s.rare ? `👑${g0.premium() ? '' : ` ${RARE_GEMS}💎`}` : gems ? `💎${gems}` : T('Free');
    const c = document.createElement('canvas'), g = c.getContext('2d'), F = '600 34px Outfit, sans-serif';
    g.font = F; const nw = Math.min(330, g.measureText(name).width), pw = g.measureText(price).width + 28;
    c.width = Math.ceil(nw + pw + 54) * 2; c.height = 128; g.scale(2, 2); // (twice the size, for a sharp tag)
    g.font = F; g.textBaseline = 'middle';
    rr(g, 2, 2, c.width / 2 - 4, 60, 30); g.fillStyle = 'rgba(28, 20, 58, .92)'; g.fill(); g.lineWidth = 3; g.strokeStyle = s.rare ? '#e9b8ff' : '#ffd27a'; g.stroke();
    g.fillStyle = '#fff3dc'; g.fillText(name, 20, 33, 330);
    rr(g, nw + 30, 12, pw, 40, 20); g.fillStyle = s.rare ? 'rgba(120, 70, 10, .85)' : gems ? 'rgba(40, 110, 170, .85)' : 'rgba(30, 120, 70, .85)'; g.fill();
    g.fillStyle = s.rare ? '#ffe6a8' : gems ? '#cfeeff' : '#c8ffd8'; g.fillText(price, nw + 44, 33);
    return c;
  }
  function markImage(s) {
    const sign = s.vault ? treasureOfWeek()[2] : s.gate ? '🏁' : s.heist ? '🏪' : s.delivery ? '📦' : s.orb ? (s.rare ? '🎆' : '🌟') : s.diya ? '🪔' : s.rare ? '💎' : '🎁';
    const edge = s.vault ? '#ffd700' : s.gate ? '#7dffc0' : s.heist ? '#ff8a3c' : s.delivery ? '#7fd3ff' : s.orb ? '#b9a4ff' : s.diya ? '#ffb347' : s.rare ? '#e9b8ff' : '#ffd27a';
    const badge = s.vault || s.gate ? '' : s.rare && !G().premium() ? `${RARE_GEMS}💎` : !s.heist && leftIn(s) > 1 ? `×${leftIn(s)}` : '';
    // Bright, like the old markers: a strong halo, a lit box with a thick rim, a big sign.
    // Drawn at twice its size on screen (256 px), so it stays sharp on a high-density phone.
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = 256; g.scale(2, 2);
    const glow = g.createRadialGradient(64, 70, 12, 64, 70, 64); glow.addColorStop(0, edge); glow.addColorStop(0.55, edge + '88'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.9; g.fillStyle = glow; g.fillRect(0, 0, 128, 128); g.globalAlpha = 1;
    const round = s.orb || s.diya;
    if (round) { g.beginPath(); g.arc(64, 70, 40, 0, Math.PI * 2); } else rr(g, 20, 26, 88, 88, 22);
    const body = g.createLinearGradient(0, 26, 0, 114); body.addColorStop(0, '#5a3a9a'); body.addColorStop(1, '#2a1650');
    g.fillStyle = body; g.fill(); g.lineWidth = 7; g.strokeStyle = edge; g.stroke();
    const pic = s.vault ? tImg(treasureOfWeek()[0]) : null;
    if (pic && pic.complete && pic.naturalWidth) { g.save(); rr(g, 24, 30, 80, 80, 18); g.clip(); g.drawImage(pic, 24, 30, 80, 80); g.restore(); } // the vault: the week's treasure itself
    else {
      if (pic) pic.addEventListener('load', () => syncLabels(), { once: true }); // (the emoji until its picture is in)
      g.font = '54px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sign, 64, 73);
    }
    if (badge) {
      g.font = '700 22px Outfit, sans-serif'; const w = g.measureText(badge).width + 18;
      rr(g, 120 - w, 8, w, 30, 15); g.fillStyle = '#ffd27a'; g.fill(); g.fillStyle = '#2a1640'; g.fillText(badge, 120 - w / 2, 24);
    }
    return c;
  }
  let labelOf = []; // stash index -> its label in the world
  // Each marker's picture, drawn by placeMarks on a full-resolution layer over the 3D view (in the 3D scene they took
  // its lower resolution and went soft), in the same frame as the camera moves, so they stay put on their spots.
  let markImgs = [];
  function syncLabels() {
    const w = G().w3d;
    if (w && w.setLabels) w.setLabels([]); // (none in the scene)
    markImgs = [];
    stashes.forEach((s, i) => { if (!isTaken(s)) markImgs[i] = s.ware ? tagImage(s) : markImage(s); });
  }
  // A marker's size by its distance, so near reads as near: in reach 1.4x, then shrinking to half far down the street.
  const depth = (d, w) => (d <= reach(w) ? 1.4 : Math.max(0.35, Math.min(1.15, 9 / d)));
  function drawMarks(draws) {
    const c = hud.querySelector('.chor-mcv'), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingQuality = 'high';
    const nearest = draws.filter((d) => !d.top).sort((a, b) => a.dist - b.dist)[0]; // (the one to go for first)
    // Distance pills that would overlap a nearer one's are left out (two stashes side by side read "33 m", not "33 m m").
    const pills = [];
    for (const d of [...draws].sort((a, b) => a.dist - b.dist)) {
      if (d.top || d.near || d.dist >= 60) continue;
      const r = { x0: d.x - 26, x1: d.x + 26, y0: d.y + d.h / 2, y1: d.y + d.h / 2 + 19 };
      d.pill = !pills.some((q) => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1);
      if (d.pill) pills.push(r);
    }
    for (const d of draws.sort((a, b) => b.dist - a.dist)) { // (the far ones first, the near ones over them)
      if (d === nearest) { // a pulsing gold ring round the nearest
        const pulse = 0.5 + 0.5 * Math.sin(clock * 5), R = d.h * (0.62 + 0.08 * pulse);
        g.globalAlpha = 0.55 + 0.4 * pulse; g.strokeStyle = '#ffd27a'; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, R, 0, Math.PI * 2); g.stroke();
      }
      const h = d.h, w2 = h * (d.img.width / d.img.height);
      g.globalAlpha = d.a; g.drawImage(d.img, d.x - w2 / 2, d.top ? d.y : d.y - h / 2, w2, h);
      if (d.pill) { // how far: "8 m" under it
        const m = `${Math.round(d.dist)} m`; g.globalAlpha = Math.max(0.6, d.a); g.font = '700 11px Outfit, sans-serif';
        const mw = g.measureText(m).width + 12, my = d.y + d.h / 2 + 1;
        rr(g, d.x - mw / 2, my, mw, 17, 8.5); g.fillStyle = 'rgba(20, 12, 40, .78)'; g.fill();
        g.fillStyle = '#fff3dc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m, d.x, my + 9); g.textAlign = 'start';
      }
      if (d.near) { // in reach: a glowing "Tap to pick" pill under it
        const label = T('Tap to pick'); g.font = '700 14px Outfit, sans-serif';
        const tw = g.measureText(label).width + 22, ty = d.y + h / 2 + 2;
        g.globalAlpha = 1; g.shadowColor = 'rgba(255, 200, 90, .9)'; g.shadowBlur = 12;
        rr(g, d.x - tw / 2, ty, tw, 26, 13); g.fillStyle = '#ffd27a'; g.fill(); g.shadowBlur = 0;
        g.fillStyle = '#2a1640'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, d.x, ty + 13.5); g.textAlign = 'start';
      }
    }
    g.globalAlpha = 1;
  }
  function syncMarks() {
    marksKey = '';
    syncLabels();
    const box = hud.querySelector('.chor-marks');
    box.innerHTML = stashes.map((s, i) => (isTaken(s) ? '' : s.ware ? ware(s, i) : `<button type="button" class="chor-stash${s.rare ? ' rare' : ''}${s.heist ? ' heist' : ''}${s.delivery ? ' delivery' : ''}${s.orb ? ' orb' : ''}${s.diya ? ' diya' : ''}" data-stash="${i}" aria-label="${s.heist ? "Seth-ji's shop stock" : 'Hidden crackers'}">${s.rare && !G().premium() ? `<em>${RARE_GEMS}💎</em>` : !s.heist && leftIn(s) > 1 ? `<em>×${leftIn(s)}</em>` : ''}</button>`)).join('');
  }

  // ---------- Throwing ----------
  // Where a throw leaves from: the bag slot it was picked up from (where the finger started); for a remote, which has no
  // finger, just above the bag's middle.
  const hand = (a) => {
    if (a && a.x0 != null) return [a.x0, a.y0];
    const b = hud && hud.querySelector('.chor-bag').getBoundingClientRect();
    return b && b.width ? [b.left + b.width / 2, b.top - 6] : [innerWidth / 2, innerHeight - 160];
  };
  // Where a throw aimed at screen point (sx, sy) goes off, at most THROW metres off: on whoever is under your finger
  // (kind 'folk'), on whatever the line meets (a wall, a roof, a tree: 'high'), on the street ('ground'), or, aimed over
  // the rooftops into the sky, somewhere behind them ('over'). { kind, x, y, z, who }
  function landing(w, sx, sy) {
    const cam = w.camera();
    // The donkey first, and generously: on it, or anywhere near it on the street (it keeps walking while you aim), the
    // cracker goes into its basket.
    const dk = w.donkey, back = dk && w.donkeyBack();
    if (back && !ride && Math.hypot(dk.x - cam.x, dk.z - cam.z) <= THROW) {
      const g = w.pick(sx, sy), p = w.project(back.x, back.y, back.z);
      const nearGround = g && Math.hypot(g.x - dk.x, g.z - dk.z) < DONKEY_SNAP;
      const nearScreen = p && Math.hypot(p[0] - sx, p[1] - sy) < Math.max(60, 1.6 * w.ppm(p[2]));
      if (w.donkeyAt(sx, sy) || nearGround || nearScreen) return { kind: 'donkey', x: back.x, y: back.y, z: back.z };
    }
    const who = w.folkAt(sx, sy);
    if (who) {
      const f = w.watchers.find((o) => o.name === who);
      if (f && Math.hypot(f.x - cam.x, f.z - cam.z) <= THROW) return { kind: 'folk', who, x: f.x, y: 1, z: f.z };
    }
    const a = w.unproject(sx, sy, 1), b = w.unproject(sx, sy, 2);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const hit = w.pick(sx, sy);
    if (hit && hit.dist <= THROW) return hit.y > 0.35 ? { kind: 'high', x: hit.x, y: hit.y, z: hit.z } : { kind: 'ground', x: hit.x, y: 0, z: hit.z };
    // Nothing in reach along the line: it comes down at most THROW metres off, on the street or beyond the houses.
    const d = dy < -1e-4 ? Math.min(-a.y / dy, THROW) : THROW;
    let x = a.x + dx * d, z = a.z + dz * d;
    const off = Math.hypot(x - cam.x, z - cam.z);
    if (off > THROW) { const k = THROW / off; x = cam.x + (x - cam.x) * k; z = cam.z + (z - cam.z) * k; }
    const over = dy >= -1e-4 || Math.abs(x) > 9;
    return over ? { kind: 'over', x: Math.max(-25, Math.min(25, x)), y: 2, z } : { kind: 'ground', x, y: 0, z };
  }
  function bagDown(e) {
    const b = e.target.closest('[data-bag]'), g = G(), w = g.w3d;
    if (!b || !w || aim) return;
    e.preventDefault();
    const i = +b.dataset.bag, x0 = e.clientX, y0 = e.clientY;
    aim = { i, type: state.bag[i], x0, y0, sx: x0, sy: y0, t: 0, dragged: false, id: e.pointerId, btn: b };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const move = (ev) => {
      if (!aim || ev.pointerId !== aim.id) return;
      aim.sx = ev.clientX; aim.sy = ev.clientY;
      // Sideways first: it scrolls the bag (it holds more than fits), and nothing is thrown; up: aim and throw.
      const bag = b.parentElement, dx = aim.sx - x0, dy = aim.sy - y0;
      if (aim.scroll != null) { bag.scrollLeft = aim.scroll - dx; return; }
      if (!aim.dragged && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && bag.scrollWidth > bag.clientWidth + 4) { aim.scroll = bag.scrollLeft; return; }
      if (Math.hypot(dx, dy) > 10) aim.moved = true; // (a finger that moved never puts a cracker down: only a clean tap does)
      if (!aim.dragged && Math.hypot(dx, dy) > 24) { aim.dragged = true; hud.classList.add('aiming'); g.tick(); }
    };
    const up = (ev) => {
      if (!aim || ev.pointerId !== aim.id) return;
      b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
      const a = aim; aim = null; hud.classList.remove('aiming');
      if (ev.type === 'pointercancel' || a.scroll != null) return; // (a scroll of the bag: nothing put down or thrown)
      if (!a.dragged) { if (!a.moved) putDown(a.i); return; }
      const bag = hud.querySelector('.chor-bag').getBoundingClientRect();
      if (a.sx >= bag.left && a.sx <= bag.right && a.sy >= bag.top - 6) return; // let go back over the bag: kept
      const w2 = G().w3d;
      const to = w2 && landing(w2, a.sx, a.sy);
      if (to && to.kind === 'donkey') { loadDonkey(a); return; } // dropped on or by the donkey: into its basket
      // Pulled back towards you instead of up the street, or aimed at nothing (into the sky, over the houses): it isn't
      // thrown away, it flies back into its slot.
      if (a.sy > a.y0 - 40) { backToBag(a, 'Throw it up the street. Back in your bag'); return; }
      if (to && to.kind === 'over') { backToBag(a, 'Missed! Back in your bag'); return; }
      throwIt(a);
    };
    b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  function backToBag(a, why) {
    const g = G(), slot = a.btn, pic = slot && slot.querySelector('img');
    if (pic) {
      const r = slot.getBoundingClientRect(), ghost = pic.cloneNode();
      ghost.className = 'chor-ghost';
      ghost.style.left = `${a.sx - 22}px`; ghost.style.top = `${a.sy - 22}px`;
      document.body.appendChild(ghost);
      requestAnimationFrame(() => { ghost.style.transform = `translate(${r.left + r.width / 2 - a.sx}px, ${r.top + r.height / 2 - a.sy}px) scale(.7)`; ghost.style.opacity = '0.2'; });
      setTimeout(() => { ghost.remove(); slot.classList.remove('back'); void slot.offsetWidth; slot.classList.add('back'); }, 380);
    }
    g.toast(T(why)); g.buzz(8);
  }
  function throwIt(a) {
    const g = G(), w = g.w3d;
    if (!w || state.bag[a.i] !== a.type) return;
    const p = landing(w, a.sx, a.sy);
    aimAt = null;
    state.bag.splice(a.i, 1); save(); syncBag();
    // It comes down on the street whatever it hits (see street()); thrown late in its fuse, it's already firing as it falls.
    flying.push({ type: a.type, from: hand(a), to: p, ground: street(w, p), hot: a.t / FUSE > HOT, t: 0, fall: 0, spin: Math.random() * 6 });
    g.buzz(15);
  }
  // Where a throw ends up: always on the street. Off a wall or a roof it drops to the street at the foot of the house; at
  // someone, at their feet; aimed into the sky or over the houses, on the street as far as it goes. (x, z on the ground)
  function street(w, p) {
    const z = w.zone, cam = w.camera(), X = 2.4; // the pavement either side of the paved middle
    let x = p.x, zz = p.z;
    if (p.kind === 'high' || p.kind === 'over') { // a step back towards you, off the wall it met
      const dx = cam.x - x, dz = cam.z - zz, d = Math.hypot(dx, dz) || 1;
      x += (dx / d) * 0.9; zz += (dz / d) * 0.9;
    }
    return { x: Math.max(z.x0 - X, Math.min(z.x1 + X, x)), y: 0, z: Math.max(z.z0, Math.min(z.z1, zz)) };
  }

  // ---------- A TV remote ----------
  // OK on a cracker in the bag: put it down, or throw it. Throwing with a remote picks a target instead of dragging: the
  // arrows hop between what's in view and in reach (the stalls, windows and carts, the folk, the donkey, spots along the
  // street), nearest first, with the same arc a finger draws; OK throws, Back puts it back in the bag.
  function bagChoice(i) {
    const t = state.bag[i], g = G();
    if (!t) return;
    sheet(`<b>${g.label(t)}</b>`
      + '<button type="button" class="btn primary" data-kit="throw">Throw it</button>'
      + '<button type="button" class="btn ghost" data-kit="down">Put it down</button>', (act) => {
      closeSheet();
      if (act === 'throw') tvAimStart(i); else putDown(i);
      return true;
    });
  }
  let tvAim = null; // { list: [{ sx, sy, name }], k }
  function tvTargets(w) {
    const cam = w.camera(), out = [], seen = (x, y, z, name, kind) => {
      if (Math.hypot(x - cam.x, z - cam.z) > THROW) return;
      const p = w.project(x, y, z);
      if (!p || p[0] < 24 || p[0] > innerWidth - 24 || p[1] < 140 || p[1] > innerHeight - 200) return;
      out.push({ sx: p[0], sy: p[1], d: p[2], name, kind });
    };
    for (const t of w.targets) seen(t.x, t.y || 0.5, t.z, t.name, 'target');
    for (const o of w.watchers) seen(o.x, 1, o.z, o.name === 'keeper' ? 'Seth-ji' : o.name === 'man' ? 'Grandpa' : 'Dog', 'folk');
    const b = w.donkeyBack(); if (b && !ride) seen(b.x, b.y, b.z, animal(w), 'donkey');
    const h = w.heading;
    for (const d of [5, 10, 16, 24]) seen(cam.x - Math.sin(h) * d, 0, cam.z - Math.cos(h) * d, `${d} m`, 'street');
    return out.sort((p, q) => p.d - q.d);
  }
  function tvAimStart(i) {
    const w = G().w3d;
    if (!w) return;
    const list = tvTargets(w);
    if (!list.length) { G().toast('Nothing in reach from here. Move closer first'); return; }
    tvAim = { list, k: 0 };
    aim = { i, type: state.bag[i], sx: list[0].sx, sy: list[0].sy, t: 0, dragged: true, tv: true };
    hud.classList.add('aiming');
  }
  function tvAimMove(d) {
    const cur = tvAim.list[tvAim.k], [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[d];
    let pick = -1, score = Infinity;
    tvAim.list.forEach((o, j) => {
      if (j === tvAim.k) return;
      const ax = (o.sx - cur.sx) * dx + (o.sy - cur.sy) * dy, side = Math.abs((o.sx - cur.sx) * dy) + Math.abs((o.sy - cur.sy) * dx);
      if (ax <= 4) return;
      const sc = ax + side * 2;
      if (sc < score) { score = sc; pick = j; }
    });
    if (pick >= 0) { tvAim.k = pick; aim.sx = tvAim.list[pick].sx; aim.sy = tvAim.list[pick].sy; aimAt = null; G().tick(); }
  }
  function tvAimEnd(go) {
    const a = aim; tvAim = null; aim = null; aimAt = null; hud.classList.remove('aiming');
    if (!go || !a) return;
    const w = G().w3d;
    if (w && landing(w, a.sx, a.sy).kind === 'donkey') loadDonkey(a); else throwIt(a);
  }
  function wrapRemote() {
    const tv = window.LUTSTv;
    if (!tv || tv.chorWrapped) return;
    const nav = tv.nav, ok = tv.ok;
    tv.nav = (d) => (tvAim ? (tvAimMove(d), 'moved') : nav(d));
    tv.ok = () => (tvAim ? (tvAimEnd(true), 'pressed') : ok());
    tv.chorWrapped = true;
  }
  // Back: put the cracker being aimed back in the bag, or close an open card. False when there's nothing of ours to undo.
  function back() {
    if (closeTutorial() || closePicker()) return true;
    if (tvAim) { tvAimEnd(false); return true; }
    const box = hud && hud.querySelector('.chor-sheet');
    if (box && !box.hidden && !box.querySelector('[data-caught]')) { closeSheet(); return true; }
    return false;
  }

  // ---------- The donkey ----------
  const animal = (w) => (w && w.donkey && w.donkey.kind) || 'donkey'; // Jaipur's is a camel, Mysore's an elephant
  let ride = null; // the cracker in the donkey's basket: { handle, type, lit }
  function loadDonkey(a) {
    const g = G(), w = g.w3d, back = w && w.donkeyBack();
    if (!back || state.bag[a.i] !== a.type) return;
    if (ride) { g.toast(`The ${animal(w)} is already carrying one`); return; }
    const handle = g.ride(a.type, back.x, back.y, back.z);
    if (!handle) { g.toast('Wait for the bang to finish'); return; }
    state.bag.splice(a.i, 1); save(); syncBag();
    ride = { handle, type: a.type, lit: false };
    w.donkeyLoad(true); g.tick(); g.buzz(15);
    g.toast(`${g.label(a.type)} in the ${animal(w)}'s basket. Light it!`);
  }
  function rideStep(w) {
    if (!ride) return;
    const back = w.donkeyBack();
    if (back) ride.handle.move(back.x, back.y, back.z);
    if (ride.handle.lit) {
      w.donkeyExcite(0.6); // trotting while it burns
      if (!ride.lit) {
        ride.lit = true;
        const d = w.donkey, pts = 120;
        state.score += pts; save(); syncBag();
        pop({ x: d.x, y: 3, z: d.z }, `Pataka parade! +${pts}`, true);
        w.startle({ x: d.x, y: 0, z: d.z }, 1, 'ground');
      }
    }
    // A rocket that has flown leaves an empty bottle: it falls off the basket a moment later, so the donkey isn't left
    // carrying it about.
    if (ride.handle.spent) { ride.spentFor = (ride.spentFor || 0) + 1; if (ride.spentFor > 20) ride.handle.remove(); }
    if (ride.handle.done) { w.donkeyLoad(false); ride = null; }
  }

  // Held too long: it goes off in your hand. Cartoon soot, a cough, the cracker is spent.
  function sooty(a) {
    const g = G();
    state.bag.splice(a.i, 1); save(); syncBag();
    hud.classList.add('soot'); setTimeout(() => hud && hud.classList.remove('soot'), 1600);
    g.buzz(60); g.toast('Phat! Sooty face. Throw it sooner next time');
    aim = null; tvAim = null; hud.classList.remove('aiming');
  }
  const SPLAT = { dog: 'The dog jumps a mile!', man: 'Grandpa hops!', keeper: 'Seth-ji yelps!' };
  function land(f) {
    const g = G(), w = g.w3d, hit = f.to, to = { ...f.ground, kind: hit.kind, who: hit.who }; // where it came down
    if (!w) return;
    lastThrow = clock;
    const hits = [];
    // A stash nobody has found, close by, goes up with it: its crackers are gone, but what a bang.
    stashes.forEach((s) => {
      if (isTaken(s) || Math.hypot(s.x - to.x, s.z - to.z) > CHAIN) return;
      if (s.heist || s.orb || s.diya || s.delivery) return; // the shop's stock is behind its counter; the rest isn't a box
      empty(s);
      hits.push({ target: { name: 'Chain! A stash went up', x: s.x, y: 0.6, z: s.z }, pts: 150, mult: 1 });
    });
    for (const h of scoreLanding(to, clock, w.targets, memo)) hits.push(h);
    if (hit.kind === 'folk') {
      w.splat(hit.who);
      hits.unshift({ target: { name: SPLAT[hit.who], x: to.x, y: 2.2, z: to.z }, pts: 90, mult: 1 });
      alert = Math.min(100, alert + 45); // they know exactly who did that
    } else if (hit.kind === 'high' && hit.y > 3.5) hits.unshift({ target: { name: 'Off the roof!', x: to.x, y: 2, z: to.z }, pts: 40, mult: 1 });
    else if (hit.kind === 'high') hits.unshift({ target: { name: 'Off the wall!', x: to.x, y: 1.5, z: to.z }, pts: 20, mult: 1 });
    else if (hit.kind === 'over') hits.unshift({ target: { name: 'Long throw!', x: to.x, y: 2, z: to.z }, pts: 30, mult: 1 });
    // On the street, as itself: one thrown late is already firing and keeps going; one thrown early lands, its fuse
    // fizzes a moment, then it goes off. Only a spot out of view gets a plain bang.
    const fuse = f.hot ? 0 : 0.7;
    const h = g.ride(f.type, to.x, 0, to.z);
    if (h) { if (f.hot) h.fire(); else setTimeout(() => h.fire(), fuse * 1000); } else g.bang(to.x, 0.3, to.z, 1);
    const delay = fuse + (h ? 0.5 : 0.15);
    setTimeout(() => {
      if (!hud || !g.on) return;
      let total = 0;
      hits.forEach((h, k) => {
        const t = h.target, at = t.x != null ? t : { x: to.x, y: 1, z: to.z };
        total += h.pts;
        setTimeout(() => {
          if (!g.w3d) return;
          g.w3d.light(t.kind === 'window' ? '#ffd27a' : t.kind === 'shop' ? '#ff8a3c' : '#ffb347', t.kind === 'shop' ? 1.4 : 0.9, { x: at.x, y: at.y || 1, z: at.z });
          pop(at, `${t.name} +${h.pts}${h.mult > 1 ? ` ×${h.mult}` : ''}`, t.kind === 'house');
        }, k * 260);
      });
      if (total) { state.score += total; save(); syncBag(); }
      if (hits.some((h) => h.target.name.startsWith('Chain'))) syncMarks();
      if (g.w3d && to.kind !== 'folk') g.w3d.startle({ x: to.x, y: to.y || 0, z: to.z }, 1, 'ground');
    }, delay * 1000);
  }
  // A score that floats up from where it happened.
  function pop(at, text, big) {
    const w = G().w3d, p = w && w.project(at.x, (at.y || 1) + 1, at.z);
    if (!p) return;
    const e = el('div', `chor-pop${big ? ' big' : ''}`, text);
    e.style.left = `${p[0]}px`; e.style.top = `${p[1]}px`;
    hud.querySelector('.chor-pops').appendChild(e);
    setTimeout(() => e.remove(), 1700);
  }
  // The aim and the flights, on a full-screen canvas that only exists while there is something to draw on it (a canvas
  // over the whole screen costs a low phone a third of its frames even blank), at the screen's density up to 1.5.
  function drawArc() {
    const busy = (aim && aim.dragged) || flying.length > 0;
    if (!busy) { if (arc.style.display !== 'none') { arc.style.display = 'none'; arc.width = arc.height = 1; } return; }
    if (arc.style.display === 'none') arc.style.display = '';
    const c = arc, dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const w = G().w3d;
    if (!w) return;
    const curve = (from, to3, k) => {
      const p = w.project(to3.x, (to3.y || 0) + 0.2, to3.z);
      if (!p) return null;
      const mx = (from[0] + p[0]) / 2, my = Math.min(from[1], p[1]) - 140 - 0.15 * Math.abs(from[1] - p[1]);
      const u = 1 - k;
      return { p, at: [u * u * from[0] + 2 * u * k * mx + k * k * p[0], u * u * from[1] + 2 * u * k * my + k * k * p[1]], mx, my };
    };
    if (aim && aim.dragged) {
      // (the line is traced through the street every third frame: enough to follow a finger, light on a phone)
      if (!aimAt || ++aimFrame % 3 === 0) aimAt = landing(w, aim.sx, aim.sy);
      const to = aimAt, from = hand(aim), cv = curve(from, to, 0);
      if (cv) {
        g.setLineDash([2, 10]); g.lineCap = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(255, 228, 170, 0.9)';
        g.beginPath(); g.moveTo(from[0], from[1]); g.quadraticCurveTo(cv.mx, cv.my, cv.p[0], cv.p[1]); g.stroke();
        g.setLineDash([]);
        g.beginPath();
        if (to.kind === 'ground') g.ellipse(cv.p[0], cv.p[1], 22, 9, 0, 0, Math.PI * 2); else g.arc(cv.p[0], cv.p[1], 16, 0, Math.PI * 2);
        g.strokeStyle = to.kind === 'folk' ? 'rgba(255, 90, 90, 0.95)' : to.kind === 'donkey' ? 'rgba(120, 230, 140, 0.95)' : 'rgba(255, 160, 70, 0.9)'; g.lineWidth = 3; g.stroke();
        if (to.kind === 'high' || to.kind === 'over') { // off the wall or roof it drops here: a dashed ring on the street
          const gp = street(w, to), q = w.project(gp.x, 0.05, gp.z);
          if (q) { g.setLineDash([4, 4]); g.beginPath(); g.ellipse(q[0], q[1], 20, 8, 0, 0, Math.PI * 2); g.strokeStyle = 'rgba(255, 210, 122, 0.85)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }
        }
        if (aim.tv && tvAim) { // a remote's pick: name it
          const o = tvAim.list[tvAim.k];
          g.font = '700 15px Outfit, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff4dc'; g.shadowColor = '#000'; g.shadowBlur = 6;
          g.fillText(T(o.name), cv.p[0], cv.p[1] - 26); g.shadowBlur = 0;
        } else if (to.kind === 'donkey') { // what letting go here will do
          g.font = '700 14px Outfit, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#b8ffc4';
          g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(T(`Drop on the ${animal(w)}`), cv.p[0], cv.p[1] - 26); g.shadowBlur = 0; // (the canvas isn't translated on its own)
        }
      }
      // The fuse, burning down round your finger.
      const left = Math.max(0, 1 - aim.t / FUSE);
      g.beginPath(); g.arc(aim.sx, aim.sy - 46, 18, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      g.strokeStyle = left > 0.35 ? '#ffd27a' : '#ff5a3c'; g.lineWidth = 5; g.stroke();
    }
    for (const f of flying) {
      // Where it is: along its arc; then falling from where it hit to the street; then a small bounce there.
      let at, d;
      const drops = f.to.kind === 'high' || f.to.kind === 'over';
      if (f.t < FLIGHT) { const cv = curve(f.from, f.to, f.t / FLIGHT); if (!cv) continue; at = cv.at; d = cv.p[2]; }
      else {
        const k = drops ? Math.min(1, f.fall / FALL) : 1, b = Math.max(0, f.fall - (drops ? FALL : 0)) / BOUNCE;
        const x = f.to.x + (f.ground.x - f.to.x) * k, z = f.to.z + (f.ground.z - f.to.z) * k;
        const y = (drops ? (f.to.y || 0) * (1 - k * k) : 0) + Math.sin(Math.min(1, b) * Math.PI) * 0.35;
        const p = w.project(x, y, z);
        if (!p) continue;
        at = [p[0], p[1]]; d = p[2];
      }
      f.spin += f.t < FLIGHT ? 0.35 : 0.12;
      drawFlying(g, f, at, d, w);
    }
  }

  // ---------- Walking ----------
  // Walking: on every phone and PC (measured on the lowest-detail OnePlus, the street runs as fast as the rest of the
  // game), not on a TV, whose remote has no joystick (it keeps the viewpoints). ?walk forces it on for testing.
  const canWalk = () => !document.documentElement.classList.contains('tv') || /[?&]walk\b/.test(location.search);
  const reach = (w) => (w.walking ? NEAR : REACH);
  // Where you are for the watchers: at a viewpoint, its height and whether it hides you; walking, at eye height, hidden
  // only standing in a hiding place.
  function where(w, cam) {
    if (!w.walking) { const v = w.views[w.view]; return { x: cam.x, z: cam.z, eye: v.eye, hide: !!v.hide }; }
    if (atStart) return { x: cam.x, z: cam.z, eye: 1.7, hide: true }; // (where you come in, until you first move: nobody spots you there)
    const hide = w.views.some((v) => v.hide && Math.hypot(v.x - cam.x, v.z - cam.z) < HIDE_R);
    return { x: cam.x, z: cam.z, eye: 1.7, hide };
  }
  const stick = { on: false, id: -1, x0: 0, y0: 0, dx: 0, dy: 0 }, keys = new Set();
  function setWalk(on) {
    const w = G().w3d;
    if (!w) return;
    w.setWalk(on);
    state.walk = on; save();
    if (on && !state.walkTip) { state.walkTip = true; save(); G().toast('Joystick: up and down to walk, left and right to turn'); }
    syncViews();
  }
  // The joystick: a small pad in the bottom-left corner (the rest of the screen is free to look around and tap
  // crackers); put a thumb on it and drag, past a small dead zone, and it walks you the way you push, faster the further
  // (to a run at the edge). At rest it waits, faded, in the middle of its pad.
  let restStick = () => {};
  function stickPad(pad) {
    const knob = pad.querySelector('.knob'), base = pad.querySelector('.base');
    restStick = () => {
      if (stick.on) return;
      const r = pad.getBoundingClientRect();
      if (!r.width) return;
      stick.x0 = r.left + r.width / 2; stick.y0 = r.top + r.height / 2; stick.dx = stick.dy = 0; show();
    };
    const show = () => {
      const r = pad.getBoundingClientRect();
      base.style.transform = `translate(${stick.x0 - r.left}px, ${stick.y0 - r.top}px) translate(-50%, -50%)`;
      knob.style.transform = `translate(${stick.x0 - r.left + stick.dx}px, ${stick.y0 - r.top + stick.dy}px) translate(-50%, -50%)`;
    };
    pad.addEventListener('pointerdown', (e) => {
      if (stick.on) return;
      Object.assign(stick, { on: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: performance.now(), far: 0 });
      try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pad.classList.add('held'); show(); e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!stick.on || e.pointerId !== stick.id) return;
      let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
      const d = Math.hypot(dx, dy);
      stick.far = Math.max(stick.far || 0, d);
      if (d < 10) { stick.dx = stick.dy = 0; show(); return; } // a touch that hardly moves doesn't walk
      if (d > STICK) { dx *= STICK / d; dy *= STICK / d; }
      stick.dx = dx; stick.dy = dy; show();
    });
    // The stick is over the markers (a gift lying where your thumb is mustn't stop you walking); a quick tap that didn't
    // drag still picks up a marker under it.
    const up = (e) => {
      if (e.pointerId !== stick.id) return;
      const tap = e.type === 'pointerup' && (stick.far || 0) < 10 && performance.now() - (stick.t0 || 0) < 350;
      stick.on = false; stick.dx = stick.dy = 0; pad.classList.remove('held'); restStick();
      if (tap) { const b = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.matches && el.matches('.chor-marks [data-stash]')); if (b) take(+b.dataset.stash, b.classList.contains('live')); }
    };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  }
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
  window.addEventListener('keydown', (e) => {
    const w = G() && G().on && G().w3d, k = KEYMAP[e.code];
    if (!w || !w.walking || !k || /input|textarea/i.test(e.target.tagName)) return;
    keys.add(k); e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());
  // The stick's push on a curve: a small push is slow and fine (to line up on a gift), a full one is a brisk walk.
  const ease = (v) => Math.sign(v) * Math.min(1, Math.abs(v)) ** 1.5;
  const vel = { f: 0, r: 0, t: 0 }; // the walk and the turn, easing towards what the stick asks (no jump to full speed)
  function walkStep(dt, w) {
    if (!w.walking) return;
    let fwd = 0, right = 0, turn = 0, speed = keys.has('run') ? SPRINT : WALK;
    // The stick: up and down walk you, left and right turn you (a strong push forward runs).
    if (stick.on) { fwd = ease(-stick.dy / STICK); const t = stick.dx / STICK; if (Math.abs(t) > 0.1) turn = -ease(t); if (-stick.dy / STICK > 0.92) speed = SPRINT; }
    if (keys.has('f')) fwd += 1;
    if (keys.has('b')) fwd -= 1;
    if (keys.has('l')) right -= 1;
    if (keys.has('r')) right += 1;
    if (keys.has('tl')) turn += 1;
    if (keys.has('tr')) turn -= 1;
    const l = Math.hypot(fwd, right);
    if (l > 1) { fwd /= l; right /= l; }
    // Speed up gently and come to a soft stop; the turn follows the stick a little quicker so aiming feels direct.
    const kw = 1 - Math.exp(-dt * 4.5), kt = 1 - Math.exp(-dt * 6); // (soft starts and stops, a steady turn)
    vel.f += (fwd * speed - vel.f) * kw; vel.r += (right * speed - vel.r) * kw; vel.t += (turn * 1.5 - vel.t) * kt;
    if (Math.abs(vel.t) > 0.005) w.turn(vel.t * dt, 0);
    if (Math.hypot(vel.f, vel.r) > 0.02) {
      atStart = false; // (on your way: the watchers can see you now)
      const up = w.aerial;
      w.step(vel.f, vel.r, dt);
      if (up) syncViews(); // (down from the drone: unlit)
      if (chosenView !== -1) { chosenView = -1; syncViews(); } // (off the spot: unlit)
      walkPick(w);
    } else { vel.f = vel.r = 0; }
  }
  // Walk into a gift and it's yours: a plain stash (not a rare one, Seth-ji's stock or a delivery, which ask first) within
  // a step or so goes into your bag as you pass. A full bag says so once, not at every step.
  let fullSaid = 0;
  function walkPick(w) {
    const cam = w.camera();
    for (let i = 0; i < stashes.length; i++) {
      const s = stashes[i];
      if (!s || isTaken(s) || (s.rare && !race) || s.heist || s.delivery || s.ware) continue; // (in a race a rare one is walked into too)
      if (Math.hypot(s.x - cam.x, s.z - cam.z) > 1.6) continue;
      if (roomFor(s.type) <= 0 && !s.diya && !s.orb && !race) { if (clock - fullSaid > 4) { fullSaid = clock; G().toast('Your bag is full. Use a cracker first'); } return; }
      take(i);
      return;
    }
  }

  // ---------- The watch ----------
  function watch(dt, w) {
    const g = G(), cam = w.camera(), me = where(w, cam);
    const red = (aim && aim.dragged) || clock - lastThrow < 2;
    const seers = clock < graceTo ? [] : w.watchers.filter((o) => sees(o, me)).map((o) => o.name);
    for (const n of seers) if (!chase && clock - (noticed[n] || -99) > 5) { noticed[n] = clock; w.notice(n, me.x, me.z); }
    alert = alertStep(alert, seers, dt, { hide: me.hide, red });
    if (!chase && alert >= 100) {
      chase = { t: 0, lost: 0 };
      w.notice('keeper', me.x, me.z); // "Oi!"
      g.toast('Oi! Seth-ji is coming. Get to a hiding place');
      g.buzz(40);
    }
    const escaping = race && race.phase === 'escape';
    if (escaping && !chase && clock > graceTo) chase = { t: OI, lost: 0 }; // with the treasure, he never stops looking
    if (chase) {
      chase.t += dt;
      const k = w.watchers.find((o) => o.name === 'keeper');
      // He heads for where you are, stopping just short of you.
      if (k && !me.hide && chase.t > OI) {
        const dx = me.x - k.x, dz = me.z - k.z, d = Math.hypot(dx, dz) || 1;
        w.hunt('keeper', me.x - (dx / d) * 1.6, me.z - (dz / d) * 1.6, escaping ? ESCAPE_RUN : RUN);
      }
      chase.lost = me.hide ? chase.lost + dt : 0;
      if (k && !me.hide && me.eye <= HIGH && Math.hypot(me.x - k.x, me.z - k.z) < CATCH) { if (escaping) dropTreasure(w, me); else caught(w); }
      else if (!escaping && (chase.lost > LOSE || chase.t > CHASE)) {
        w.calm('keeper'); chase = null; alert = 55;
        g.toast(me.hide ? 'Phew. He lost you' : 'He gave up. For now');
      }
    }
    const bar = hud.querySelector('.chor-alert');
    bar.style.setProperty('--a', `${alert}%`);
    bar.classList.toggle('hot', alert > 70 || !!chase);
    bar.classList.toggle('hidden', me.hide);
    bar.setAttribute('aria-label', me.hide ? 'Hidden' : `Alert ${Math.round(alert)}%`);
  }
  // Caught: a finger wagged in your face. Then a choice: slip away (a video), keep your bag (a lucky charm, or gems), or
  // hand it over and go back to the corner.
  function caught(w) {
    const g = G();
    w.nab('keeper');
    chase = null; alert = 0; graceTo = clock + 60; // nobody looks while you decide
    hud.classList.add('caught'); setTimeout(() => hud && hud.classList.remove('caught'), 1800);
    g.buzz(80);
    if (!state.bag.length) { g.toast('Caught! Seth-ji wagged his finger at you. Off you go'); sendBack(); return; }
    const n = state.bag.length, video = g.canVideo(), charm = (state.charm || 0) > 0;
    sheet(`<b>Caught by Seth-ji!</b><p>"Hand over ${n > 1 ? `those ${n} crackers` : 'that cracker'}, chor!"</p>`
      + (video ? `<button type="button" class="btn primary" data-caught="video">${g.premium() ? '👑 Slip away (Premium)' : '▶ Watch a video to slip away'}</button>` : '')
      + `<button type="button" class="btn ${video ? 'ghost' : 'primary'}" data-caught="keep">${charm ? `🍀 Use a lucky charm (${state.charm} left)` : `Keep my bag · ${KIT.charm.gems / 2} 💎`}</button>`
      + '<button type="button" class="btn ghost" data-caught="give">Hand it over</button>', async (act) => {
      if (act === 'video') {
        if (!(await g.watchVideo('escape'))) return false; // no reward: the choice stays open
        closeSheet(); graceTo = clock + GRACE; alert = 30;
        if (G().w3d) G().w3d.calm('keeper');
        g.toast('You slipped away! Seth-ji is still scratching his head');
        return true;
      }
      if (act === 'keep') {
        if (charm) state.charm--;
        else if (!g.spend(KIT.charm.gems / 2, 'Keep your bag')) return false;
        save(); closeSheet(); g.toast('Bag kept. Seth-ji grumbles off'); sendBack(); return true;
      }
      const lost = state.bag.length;
      state.bag = []; save(); syncBag(); closeSheet();
      g.toast(lost > 1 ? `Seth-ji took your ${lost} crackers` : 'Seth-ji took your cracker'); sendBack();
      return true;
    });
  }
  function sendBack() {
    graceTo = clock + GRACE;
    setTimeout(() => { if (G().w3d) { G().w3d.calm('keeper'); G().w3d.goView(0); syncViews(); } }, 900);
  }

  // ---------- The Kit, the streets ----------
  const bagSize = () => (state.bigBag || (G() && G().premium()) ? BIG_BAG : BAG);
  // The bag's slots hold a kind of cracker each, up to STACK of it (shown as ×N): room for a kind is what its slot has
  // left, or a whole slot while one is free.
  const STACK = 5;
  const kinds = () => [...new Set(state.bag)];
  const countOf = (t) => state.bag.filter((x) => x === t).length;
  const roomFor = (t) => (countOf(t) ? STACK - countOf(t) : kinds().length < bagSize() ? STACK : 0);
  const freeSlots = () => Math.max(0, bagSize() - kinds().length);
  // A small panel over the street: html, and onAct(name) for its [data-caught] / [data-kit] / [data-street] buttons
  // (resolves true when done; the panel stays while it resolves false).
  let sheetAct = null;
  function sheet(html, onAct) {
    const tst = document.getElementById('toast'); if (tst) tst.classList.remove('show'); // (no message over a sheet)
    const box = hud.querySelector('.chor-sheet');
    box.innerHTML = `<div class="chor-card">${html}<button type="button" class="chor-x" data-close aria-label="Close">✕</button></div>`;
    box.hidden = false; sheetAct = onAct;
    const first = box.querySelector('button.btn'); if (first) first.focus();
  }
  function closeSheet() { const box = hud.querySelector('.chor-sheet'); box.hidden = true; box.innerHTML = ''; box.classList.remove('catalog'); sheetAct = null; }
  // Seth-ji's collection, on the shop's back wall (or the All crackers button): every cracker on display as a big, sharp
  // picture in a grid, its name and price under it; a tap puts it in your bag from wherever you stand.
  // Every cracker the game has, free first, then by gems, Premium last (the 3D shop is off for now; this is the way to
  // pick any cracker, from the All crackers button on every street).
  function openCatalog(added = '') {
    const g = G();
    if (!g.w3d) return;
    const room = freeSlots(), all = g.types();
    const types = [...all.filter((t) => !g.premiumItem(t)).sort((a, b) => g.gemCost(a) - g.gemCost(b)), ...all.filter(g.premiumItem)];
    // What each costs here: a free one is free once a day (then 💎1), a gem one its gems, a Premium one its gems; with
    // Premium every one is free. Short of gems, spend opens the gem shop.
    const today = g.dayKey(), freeUsed = state.freeDay === today ? state.freeTaken || [] : [];
    const costOf = (t) => (g.premiumItem(t) ? RARE_GEMS : g.gemCost(t) || (freeUsed.includes(t) ? 1 : 0));
    const tiles = types.map((t) => {
      const rare = g.premiumItem(t), gems = g.gemCost(t), cost = costOf(t);
      const price = g.premium() ? `<em class="prem">👑 ${T('Free')}</em>` : rare ? `<em class="prem">👑 ${RARE_GEMS}💎</em>` : cost ? `<em class="gem">💎${cost}</em>` : `<em class="free">${T('Free')}</em>`;
      return `<button type="button" class="chor-cat ${rare ? 'rare' : gems ? 'gem' : 'free'}" data-cat="${t}"><span class="chor-cat-art"><img src="${g.pic(t)}" alt="" loading="lazy"></span><b>${g.label(t)}</b>${price}</button>`; // (its tint: free, gem or Premium)
    }).join('');
    // What you just took is said in the header (a toast over the middle would cover the cards).
    const note = added ? `✓ ${added} · ${room > 0 ? `${room} free` : T('Your bag is full. Use a cracker first')}` : room > 0 ? `Tap a cracker to put it in your bag · ${room} free` : 'Your bag is full. Use a cracker first';
    const keep = hud.querySelector('.chor-cats'), y = keep ? keep.scrollTop : 0; // (stay where you were in the list)
    sheet(`<b>Seth-ji's collection</b><p class="chor-cat-note${added ? ' added' : ''}">${note}</p><div class="chor-cats">${tiles}</div>`, async (t) => {
      if (roomFor(t) <= 0) { g.toast('Your bag is full. Use a cracker first'); return false; }
      const cost = costOf(t);
      if (cost && !g.spend(cost, g.label(t))) return false; // its gems (Premium: free); short, the gem shop opens
      if (!cost) { state.freeDay = today; state.freeTaken = [...freeUsed, t]; } // (free once a day)
      state.bag.push(t); collect(t); save(); g.buzz(20); g.tick(); syncBag();
      openCatalog(T(g.label(t))); // (the header says it, and the bag count)
      return true;
    });
    const sh = hud.querySelector('.chor-sheet'); sh.classList.add('catalog');
    if (y) sh.querySelector('.chor-cats').scrollTop = y;
  }
  function openKit() {
    const g = G(), rows = Object.entries(KIT).map(([id, k]) => {
      const owned = id === 'bigBag' ? (state.bigBag || g.premium()) : 0, have = id === 'bigBag' ? '' : `<small>You have ${state[id] || 0}</small>`;
      return `<button type="button" class="chor-kit" data-kit="${id}" ${owned ? 'disabled' : ''}><b>${k.name}</b><small>${k.line}</small>${have}<span>${owned ? '✓' : `${k.gems} 💎`}</span></button>`;
    }).join('');
    const video = g.canVideo() ? '<button type="button" class="chor-kit" data-kit="video"><b>▶ A box of 4 crackers</b><small>Watch a short video and it drops at your feet</small><span>Free</span></button>' : '';
    sheet(`<b>Chor's kit</b><p>${g.gems()} 💎</p>${video}${rows}`, async (id) => {
      if (id === 'video') { if (!(await g.watchVideo('box'))) return false; closeSheet(); dropBox(4, 'Video box!'); return true; }
      const k = KIT[id];
      if (!k || !g.spend(k.gems, k.name)) return false;
      if (k.once) state[id] = true; else state[id] = (state[id] || 0) + k.adds;
      save(); syncBag(); g.tick(); g.toast(`${k.name} in your kit`);
      openKit();
      return true;
    });
  }
  // Each street keeps its own day: its stashes (seeded by the date and the street) and what you've taken there.
  function goStreet(id) {
    const g = G();
    state.takenBy = state.takenBy || {};
    state.takenBy[g.street] = state.taken;
    state.taken = state.takenBy[id] || [];
    state.leftBy = state.leftBy || {};
    state.leftBy[g.street] = state.left || {};
    state.left = state.leftBy[id] || {};
    state.street = id; state.visited = { ...(state.visited || {}), [id]: 1 }; save();
    stashes = []; syncMarks(); flying = []; aim = null; chase = null; alert = 0; graceTo = clock + GRACE; ride = null; atStart = true;
    g.setStreet(id);
    whenReady();
  }
  function decoy() {
    const g = G(), w = g.w3d;
    if (!w || !(state.decoy > 0)) return;
    const cam = w.camera(), h = w.heading, x = Math.max(-5, Math.min(5, cam.x - Math.sin(h) * 14)), z = cam.z - Math.cos(h) * 14;
    state.decoy--; save(); syncBag();
    w.lure(x, z); g.bang(x, 0.5, z, 0.6);
    alert = Math.max(0, alert - 45);
    if (chase) { w.calm('keeper'); chase = null; g.toast('Decoy! Seth-ji turned to look'); } else g.toast('Decoy! Everyone looks the other way');
    graceTo = Math.max(graceTo, clock + 4);
  }
  function ping() {
    const g = G();
    if (!(state.ping > 0)) return;
    state.ping--; save(); syncBag();
    pingTo = clock + PING;
    const left = stashes.filter((s) => !isTaken(s) && !s.heist).length;
    g.toast(left > 1 ? `${left} stashes still hidden` : left ? '1 stash still hidden' : 'Nothing left to find on this street today');
  }

  // A cracker in the air: its own picture (or a plain red cracker with a gold band, for one drawn in code), tumbling
  // slowly, sized for how far off it is, on a soft glow so it reads against the night, its fuse spitting sparks; one
  // thrown late is already firing, a spray behind it. A rocket flies nose first along its arc instead, drawn whole
  // (body, band, cone, stick) so it reads at a glance.
  const LONG = new Set(['rocket', 'rocketcombo']);
  function drawFlying(g, f, at, d, w) {
    const size = Math.max(42, Math.min(96, w.ppm(Math.max(1, d)))); // never smaller than a fingertip, so it reads far off
    const dx = f.last ? at[0] - f.last[0] : 0, dy = f.last ? at[1] - f.last[1] : -1;
    f.last = at;
    const glow = g.createRadialGradient(at[0], at[1], 0, at[0], at[1], size * 0.75);
    glow.addColorStop(0, 'rgba(255, 220, 150, 0.45)'); glow.addColorStop(1, 'rgba(255, 220, 150, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(at[0], at[1], size * 0.75, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(at[0], at[1]);
    let tail = [0, size * 0.4];
    if (LONG.has(f.type)) {
      const a = Math.hypot(dx, dy) > 0.5 ? Math.atan2(dy, dx) + Math.PI / 2 : 0; // nose along the way it's going
      g.rotate(a);
      const L = size, bw = L * 0.16;
      g.strokeStyle = '#c9a36b'; g.lineWidth = Math.max(1.5, L * 0.04);
      g.beginPath(); g.moveTo(0, L * 0.12); g.lineTo(0, L * 0.6); g.stroke(); // the stick
      g.fillStyle = '#e33a4f'; g.fillRect(-bw / 2, -L * 0.3, bw, L * 0.42); // the body
      g.fillStyle = '#ffcf6b'; g.fillRect(-bw / 2, -L * 0.12, bw, L * 0.06); // its band
      g.beginPath(); g.moveTo(-bw / 2, -L * 0.3); g.lineTo(bw / 2, -L * 0.3); g.lineTo(0, -L * 0.46); g.closePath(); g.fill(); // the cone
      g.strokeStyle = 'rgba(20, 10, 4, 0.7)'; g.lineWidth = 1.2; g.strokeRect(-bw / 2, -L * 0.3, bw, L * 0.42);
      const c = Math.cos(a), sn = Math.sin(a);
      tail = [-sn * -L * 0.12 * -1, c * L * 0.12]; // the sparks come from the bottom of its body
    } else {
      g.rotate(f.spin * 0.4);
      const img = G().art(f.type);
      if (img) { const k = size / Math.max(img.naturalWidth, img.naturalHeight); g.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k); }
      else {
        g.fillStyle = '#c0392b'; g.fillRect(-size * 0.16, -size * 0.45, size * 0.32, size * 0.9);
        g.fillStyle = '#ffd34d'; g.fillRect(-size * 0.16, -size * 0.08, size * 0.32, size * 0.16);
      }
      tail = [0, -size * 0.4];
    }
    g.restore();
    const n = f.hot ? 16 : 5, spread = f.hot ? 30 : 10;
    for (let s = 0; s < n; s++) {
      g.beginPath(); g.arc(at[0] + tail[0] + (Math.random() - 0.5) * spread, at[1] + tail[1] + (Math.random() - 0.5) * spread, f.hot ? 2.4 : 1.8, 0, Math.PI * 2);
      g.fillStyle = Math.random() < 0.5 ? '#ffe08a' : '#ffb347'; g.fill();
    }
  }

  // ---------- Each frame ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0); lastT = now; clock += dt;
    const g = G(), w = g && g.w3d;
    if (!hud) return;
    hud.classList.toggle('loading', !w);
    if (!w) return;
    if (w.view !== shownView || !hud.querySelector('[data-view]')) syncViews();
    raceStep();
    if (aim && aim.dragged) { aim.t += dt; if (aim.t >= (aim.tv ? FUSE * 2.5 : FUSE)) sooty(aim); } // (a remote takes longer to aim)
    if (!walkDriven) walkStep(dt, w); // (the game walks you in its own frame, just before it draws: see walk)
    refill(w); deliveries(w); milestones();
    rideStep(w);
    watch(dt, w);
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt;
      // Its arc, then (off a wall or a roof, or over the houses) the drop to the street, then a little bounce.
      const drops = f.to.kind === 'high' || f.to.kind === 'over';
      if (f.t >= FLIGHT) f.fall += dt;
      if (f.t >= FLIGHT && (!drops || f.fall >= FALL) && f.fall >= (drops ? FALL : 0) + BOUNCE) { flying.splice(i, 1); land(f); }
    }
    drawArc();
  }
  // The markers follow the view: placed again only when it has moved (or the delivery has, riding the donkey), or the
  // marker list changed. The game calls this right after the 3D view's camera moves for the frame it draws (game.js), so
  // the labels and the pictures under them move together, never a frame apart.
  function placeMarks() {
    const g = G(), w = g && g.w3d;
    if (!hud || !w) return;
    const key = `${w.version}|${delivery ? `${Math.round(delivery.x * 8)},${Math.round(delivery.z * 8)}` : ''}|${clock < pingTo}|${hud.querySelector('.chor-marks').childElementCount}`;
    if (key === marksKey) return;
    marksKey = key;
    const cam = w.camera(), out = [];
    // Each advert's "go" label, under its picture, while it faces you and is near enough to read.
    const top = ads.length ? hud.querySelector('.chor-views').getBoundingClientRect().bottom : 0; // (once, before any writes: never under the top buttons)
    hud.querySelectorAll('[data-ad]').forEach((b) => {
      const a = ads[+b.dataset.ad], p = a && w.project(a.x, a.y - a.h / 2 - 0.12, a.z);
      const facing = a && (a.x < 0 ? cam.x > a.x : cam.x < a.x);
      if (!p || !facing || Math.hypot(a.x - cam.x, a.z - cam.z) > 9 || p[1] < top + 8) { b.style.display = 'none'; return; }
      b.style.display = ''; b.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px) translate(-50%, 0)`;
    });
    // On a phone the markers are only drawn in the world (syncLabels) and a tap finds them from where they are on screen
    // (hits, tapAt): moving a button per marker each frame cost a weak phone most of its frames. A TV keeps the buttons,
    // which its remote moves between.
    const tv = document.documentElement.classList.contains('tv');
    hits = [];
    const draws = [];
    hud.querySelectorAll('[data-stash]').forEach((b) => {
      const s = stashes[+b.dataset.stash];
      if (!s) { b.style.display = 'none'; return; } // (a marker left over from a list that just changed: the next sync drops it)
      // A marker sits just above the street at its stash (on the ground or by the side of the street, never up high);
      // a delivery rides over the donkey's basket; a shop tag under its picture.
      const p = w.project(s.x, s.ware ? (s.y || 0) - 0.32 : s.delivery ? (s.y || 0) + 0.6 : 0.55, s.z, out);
      const li = labelOf[+b.dataset.stash];
      if (!p) { b.style.display = 'none'; if (li != null) w.showLabel(li, false); return; }
      if (!tv) {
        const d = Math.hypot(s.x - cam.x, s.z - cam.z);
        if (s.ware && d > (s.stage ? 11 : 3.4)) return;
        const img = markImgs[+b.dataset.stash];
        if (img) draws.push(s.ware ? { img, x: p[0], y: p[1], top: true, h: w.ppm(p[2]) * (s.stage ? 0.2 : 0.14), a: 1, dist: d }
          : { img, x: p[0], y: p[1], h: innerHeight * (s.heist ? 0.095 : s.diya ? 0.065 : 0.08) * depth(d, w), a: d <= reach(w) || clock < pingTo ? 1 : Math.max(0.45, 1 - (d - reach(w)) / 40), dist: d, near: d <= reach(w) }); // (bigger near, smaller and fainter far; in reach: Tap to pick)
        if (s.ware) { // its tag and the picture above it
          const top = w.project(s.x, s.y + (s.stage ? 0.66 : 0.22), s.z), ph = top ? Math.max(24, p[1] - top[1]) : 24;
          hits.push({ i: +b.dataset.stash, x0: p[0] - Math.max(40, ph * 0.45), x1: p[0] + Math.max(40, ph * 0.45), y0: p[1] - ph, y1: p[1] + 26, d });
        } else {
          const r = Math.max(38, innerHeight * (s.heist ? 0.095 : s.diya ? 0.065 : 0.08) * depth(d, w) * 0.75 + (d <= reach(w) ? 14 : 0)); // (the tap area bigger than its picture; in reach, bigger still, with its label)
          hits.push({ i: +b.dataset.stash, x0: p[0] - r, x1: p[0] + r, y0: p[1] - r, y1: p[1] + r, d, daily: typeof s.key === 'number', kind: s.heist ? 'heist' : s.delivery ? 'delivery' : s.rare ? 'rare' : s.orb ? 'orb' : s.diya ? 'diya' : 'gift' });
          // Its button, invisible over the picture, only while it's near enough to take: a real button takes the touch
          // (no turning the view), and only the few near ones move each frame, so walking stays smooth.
          const live = d <= TAP_REACH;
          if (live !== b.classList.contains('live')) b.classList.toggle('live', live);
          if (live) {
            const size = Math.round(2 * r), at = `translate(${Math.round(p[0] - r)}px, ${Math.round(p[1] - r)}px)`;
            if (b._size !== size) { b._size = size; b.style.width = b.style.height = `${size}px`; } // (a size change re-lays the page: only when it changes)
            if (b._at !== at) { b._at = at; b.style.transform = at; }
          }
        }
        return;
      }
      b.style.display = '';
      // A shop tag stays one size, on whole pixels, just under its picture: it rides along as you walk instead of
      // swelling and sliding about.
      if (s.ware) { // the picture above the tag is tappable too: its height on screen, from its top (about 0.5 m up)
        const top = w.project(s.x, s.y + (s.stage ? 0.66 : 0.22), s.z);
        const ph = top ? Math.max(0, Math.round(p[1] - top[1])) : 0;
        b.style.setProperty('--pic', `${ph}px`);
      }
      b.style.transform = s.ware ? `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px) translate(-50%, 0)` : `translate(${p[0]}px, ${p[1]}px) translate(-50%, -50%) scale(${Math.max(0.5, Math.min(1.4, 18 / p[2]))})`;
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      // In the shop a step's tags show only within reach (the crackers' pictures stand on the steps), so they
      // never pile up; the Premium showcase's show from across the room.
      if (s.ware && d > (s.stage ? 11 : 3.4)) { b.style.display = 'none'; if (li != null) w.showLabel(li, false); return; }
      if (li != null) w.showLabel(li, true, !s.ware && d > reach(w) && clock >= pingTo ? 0.8 : 1, s.x, (s.y || 0) + (s.ware ? -0.3 : 0.6), s.z); // (a delivery moves)
      b.classList.toggle('far', d > reach(w));
      b.classList.toggle('ping', clock < pingTo);
    });
    if (!document.documentElement.classList.contains('tv')) drawMarks(draws);
  }
  // Where each marker is on screen this frame (for tests), and how near a marker must be to take it with a tap.
  let hits = [];
  const TAP_REACH = 12; // metres: within this a marker's button is live and a tap takes it; further, walk closer
  // A stash is empty once everything in it is taken (state.taken: the keys of the empty ones; state.left: what is left
  // in a box opened but not emptied, your bag having filled).
  const isTaken = (s) => state.taken.includes(s.key);
  const leftIn = (s) => (state.left && state.left[s.key] != null ? state.left[s.key] : s.heist ? s.loot.length : s.count || 1);
  function empty(s) { if (!isTaken(s)) state.taken.push(s.key); if (state.left) delete state.left[s.key]; }
  function take(i, anywhere = false) {
    const s = stashes[i], g = G(), w = g.w3d;
    if (!s || !w || isTaken(s)) return;
    const cam = w.camera();
    if (!anywhere && Math.hypot(s.x - cam.x, s.z - cam.z) > reach(w)) { g.toast(w.walking ? 'Walk right up to it first' : 'Too far. Move closer first'); return; }
    if (s.vault) { grabTreasure(s, w); return; }
    if (s.gate) return;
    if (s.diya) { luckyDiya(s); return; }
    const room = s.heist ? freeSlots() * STACK + kinds().reduce((a, t) => a + Math.max(0, STACK - countOf(t)), 0) : roomFor(s.type);
    if (room <= 0 && (!race || s.heist)) { g.toast('Your bag is full. Use a cracker first'); return; } // (in a race a find always counts: what fits goes in the bag)
    if (s.heist) { heist(s, room, w); return; }
    // In a race a rare stash counts as found for free (its Premium cracker stays a Premium or gems thing)
    if (s.rare && race && !g.premium() && !s.paid) { empty(s); save(); g.buzz(20); g.tick(); g.toast('Rare stash found! It counts for the race'); syncMarks(); syncBag(); syncLoot(); return; }
    if (s.rare && !g.premium() && !s.paid) { rareCard(i); return; }
    if (s.ware) { if (roomFor(s.type) <= 0) { g.toast('Your bag is full. Use a cracker first'); return; } state.bag.push(s.type); collect(s.type); s.paid = false; save(); g.buzz(20); g.tick(); g.toast(`${g.label(s.type)} in your bag`); syncBag(); return; }
    const n = Math.max(0, Math.min(room, leftIn(s)));
    for (let k = 0; k < n; k++) state.bag.push(s.type);
    collect(s.type);
    if (s.delivery) { alert = Math.min(100, alert + 25); state.score += 40; pop({ x: s.x, y: 2.6, z: s.z }, `Off the ${animal(G().w3d)}! +40`, false); }
    state.left = state.left || {};
    if (race || leftIn(s) - n <= 0) empty(s); else state.left[s.key] = leftIn(s) - n;
    save(); g.buzz(20); g.tick();
    // (one sentence each way, so each can be translated whole)
    const what = n > 1 ? `${n} × ${g.label(s.type)}` : g.label(s.type);
    if (!n) g.toast('Stash found! Your bag is full'); else g.toast(s.rare ? `Rare find! ${what} in your bag` : isTaken(s) ? `${what} in your bag` : `${what} in your bag. More left in the box`);
    syncMarks(); syncBag(); syncLoot();
  }
  // A lucky diya: a gem, up to DIYA_CAP a day (after that it's just a bright little lamp to pick up).
  function luckyDiya(s) {
    const g = G();
    empty(s);
    const paid = (state.diyaGems || 0) < DIYA_CAP;
    if (paid) { state.diyaGems = (state.diyaGems || 0) + 1; g.addGems(1); }
    save(); g.tick(); g.buzz(15);
    pop({ x: s.x, y: 1.4, z: s.z }, paid ? 'Lucky diya! +1 💎' : 'Lucky diya!', false);
    syncMarks();
  }
  // The collection book: every kind you've ever found. Something new says so; a set complete pays its gems, once.
  function collect(type) {
    const g = G();
    state.book = state.book || {};
    if (state.book[type]) return;
    state.book[type] = 1;
    pop((G().w3d && G().w3d.camera()) ? { x: G().w3d.camera().x, y: 2.2, z: G().w3d.camera().z - 3 } : { x: 0, y: 2, z: 0 }, `New for your collection: ${g.label(type)}`, false);
    state.sets = state.sets || {};
    for (const set of SETS) {
      const [have, need] = setProgress(set, state.book);
      if (have >= need && !state.sets[set.id]) {
        state.sets[set.id] = 1; g.addGems(set.gems);
        setTimeout(() => G().toast(`${set.name} complete! +${set.gems} 💎`), 900);
      }
    }
    save();
  }
  function openBook() {
    const g = G(), book = state.book || {}, got = Object.keys(book);
    const rows = SETS.map((set) => { const [have, need] = setProgress(set, book), done = state.sets && state.sets[set.id];
      return `<div class="chor-kit"><b>${done ? '<i>✓</i> ' : ''}<span>${set.name}</span></b><small>${set.line}</small><span>${done ? 'Done' : `${have}/${need} · ${set.gems} 💎`}</span></div>`; }).join('');
    const sky = got.filter((t) => t.startsWith('sky:')).length;
    sheet(`<b>📖 Collection</b><p>${got.length - sky} ground crackers and ${sky} sky shells found so far.</p>${rows}`
      + `<p class="chor-book">${got.map((t) => T(g.label(t))).join(' · ') || 'Find your first cracker on the street!'}</p>`, () => true);
  }
  // A rare stash holds a Premium cracker: a card says so first, and what it takes to open (gems, or Premium), before
  // anything is spent or the shop opens.
  function rareCard(i) {
    const s = stashes[i], g = G(), have = g.gems(), enough = have >= RARE_GEMS;
    sheet(`<b>💎 Rare stash</b><p>A Premium cracker is hidden here:</p><p><b>${g.label(s.type)}</b></p><p>Open it for ${RARE_GEMS} gems (you have ${have}), or with Premium every rare stash is free.</p>`
      + (enough ? `<button type="button" class="btn primary" data-kit="open">Open it · ${RARE_GEMS} 💎</button>` : `<button type="button" class="btn primary" data-kit="gems">Get gems</button>`)
      + '<button type="button" class="btn ghost" data-kit="premium">Unlock with Premium</button><button type="button" class="btn ghost" data-kit="no">Not now</button>', (act) => {
      if (act === 'open') { if (!g.spend(RARE_GEMS, 'Rare stash')) return false; s.paid = true; closeSheet(); take(i); return true; }
      closeSheet();
      if (act === 'gems') g.spend(RARE_GEMS, 'Rare stash'); // short of gems, this opens the gem shop
      else if (act === 'premium') g.openPremium();
      return true;
    });
  }
  // Seth-ji's shop: only while he is away from it (or after a decoy turned him), and not under anyone's eyes.
  function heist(s, room, w) {
    const g = G(), k = w.watchers.find((o) => o.name === 'keeper'), cam = w.camera();
    const near = k && Math.hypot(k.x - s.x, k.z - s.z) < GUARD && k.act !== 'look';
    const seen = k && sees(k, { x: cam.x, z: cam.z, eye: 1.7 });
    if (near || seen) {
      alert = Math.min(100, alert + 30); g.buzz(40);
      g.toast("Seth-ji is guarding his shop! Wait till he walks off, or throw a decoy");
      return;
    }
    const left = state.left && state.left.heist != null ? state.left.heist : s.loot.length, from = s.loot.length - left;
    const got = [];
    for (const t of s.loot.slice(from)) { if (roomFor(t) <= 0) break; state.bag.push(t); got.push(t); } // (each into its slot while it fits)
    const n = got.length;
    got.forEach(collect);
    state.left = state.left || {};
    if (left - n <= 0) empty(s); else state.left.heist = left - n;
    if (!state.heisted) { state.heisted = true; state.score += 100; pop({ x: s.x, y: 2.5, z: s.z }, 'Shop heist! +100', true); }
    alert = Math.min(100, alert + 15); // the shop bell jangles
    save(); g.buzz(30); g.tick();
    const list = got.map((t) => T(g.label(t))).join(', '); // (each name translated, the list then fits the sentence)
    g.toast(isTaken(s) ? `From Seth-ji's shop: ${list}` : `From Seth-ji's shop: ${list}. ${left - n} more in the shop`);
    syncMarks(); syncBag(); syncLoot();
  }
  // New stashes turn up through the night, wherever nothing is hidden now, while fewer than MIN_LOOT are out.
  let refillAt = 0, refills = 0;
  function refill(w) {
    if (clock < refillAt) return;
    refillAt = clock + REFILL;
    const g = G(), out = stashes.filter((o) => !isTaken(o) && !o.heist);
    if (out.length >= MIN_LOOT) return;
    const used = new Set(out.map((o) => `${o.x},${o.z}`)), free = w.stashes.filter((p) => !used.has(`${p.x},${p.z}`));
    if (!free.length) return;
    const p = free[Math.floor(Math.random() * free.length)], rare = Math.random() < RARE_REFILL && g.types().some(g.premiumItem);
    const type = rare ? randOf(g.types().filter(g.premiumItem)) : randOf(pickTypes(w));
    stashes.push({ key: `r${++refills}:${Math.round(clock)}`, x: p.x, z: p.z, type, rare, count: rare ? 1 : 1 + Math.floor(Math.random() * 3) });
    syncMarks(); syncLoot();
    pop({ x: p.x, y: 1.5, z: p.z }, 'New stash!', false);
  }
  // What a new box may hold: the street's own crackers more often than not.
  function pickTypes(w) {
    const g = G(), free = g.types().filter((t) => !g.premiumItem(t)), local = (w.mix || []).filter((t) => free.includes(t)), gems = free.filter(g.gemItem);
    const r = Math.random();
    return gems.length && r < 0.5 ? gems : local.length && r < 0.8 ? local : free; // gem crackers first, as the stashes
  }
  const randOf = (list) => list[Math.floor(Math.random() * list.length)];
  // A box of n crackers set down in front of you (a reward): a stash like any other, close enough to take.
  function dropBox(n, label) {
    const g = G(), w = g.w3d;
    if (!w) return;
    const cam = w.camera(), h = w.heading, z = w.zone;
    const x = Math.max(z.x0 - 2, Math.min(z.x1 + 2, cam.x - Math.sin(h) * 3)), zz = Math.max(z.z0, Math.min(z.z1, cam.z - Math.cos(h) * 3));
    stashes.push({ key: `b${++refills}:${Math.round(clock)}`, x, z: zz, type: randOf(pickTypes(w)), rare: false, count: n });
    syncMarks(); syncLoot();
    pop({ x, y: 1.5, z: zz }, label, true);
    g.tick(); g.buzz(25);
  }
  // Chaos milestones each night drop a reward box at your feet: 3 crackers, 4 from 2000 up.
  const MILESTONES = [500, 1000, 2000, 4000];
  function milestones() {
    const reached = state.milestone || 0, next = MILESTONES.find((m) => m > reached && state.score >= m);
    if (!next) return;
    state.milestone = next; save();
    dropBox(next >= 2000 ? 4 : 3, `${next} chaos! Reward box`);
  }
  // The delivery: every few minutes the donkey brings Seth-ji a box of 3 for his shop. Take it off its back on the way
  // (it's out in the open: everyone sees); a minute later it's delivered and the crackers go into the shop's stock.
  let delivery = null, deliveryAt = 0;
  function deliveries(w) {
    const d = w.donkey, back = d && w.donkeyBack();
    if (!back) return;
    if (!delivery) {
      if (clock < deliveryAt || ride) return;
      deliveryAt = clock + DELIVERY;
      delivery = { key: `d${++refills}`, delivery: true, x: back.x, y: back.y, z: back.z, type: randOf(pickTypes(w)), count: 3, rare: false, since: clock };
      stashes.push(delivery);
      syncMarks();
      G().toast(`A delivery for Seth-ji! The ${animal(w)} is carrying a box of crackers`);
      return;
    }
    delivery.x = back.x; delivery.y = back.y; delivery.z = back.z;
    // Its box rides in the basket: laid out again about 10 times a second (each time re-uploads every box and draws a
    // frame), which is smooth enough at the donkey's pace.
    if (clock - (delivery.laid || 0) > 0.1) { delivery.laid = clock; syncLoot(); }
    if (isTaken(delivery)) { delivery = null; return; }
    if (clock - delivery.since > 60) { // delivered: into the shop's stock
      const shop = stashes.find((o) => o.heist), n = leftIn(delivery);
      if (shop) { for (let k = 0; k < n; k++) shop.loot.push(delivery.type); state.left = state.left || {}; if (isTaken(shop)) { state.taken = state.taken.filter((k) => k !== 'heist'); state.left.heist = n; } else state.left.heist = leftIn(shop) + n; }
      empty(delivery); delivery = null; save(); syncMarks(); syncLoot();
      G().toast("The delivery reached Seth-ji's shop");
    }
  }

  // The stashes as real cracker boxes on the street (the gifts over them are what you tap).
  function syncLoot() {
    const w = G().w3d;
    if (!w || !w.setLoot) return;
    w.setLoot(stashes.filter((o) => !isTaken(o) && !o.orb && !o.diya && !o.ware).map((o) => ({ x: o.x, y: o.y, z: o.z, n: o.heist ? 8 : leftIn(o), rare: o.rare })));
  }
  // A tap on a cracker in the bag: into the donkey's basket when the donkey is close by (and free), else down on the
  // street in front of you, the way you're looking: far enough out to show above the bag, a little to one side for each
  // cracker already waiting.
  function putDown(i) {
    const g = G(), w = g.w3d, t = state.bag[i];
    if (!w || !t) return;
    const cam = w.camera(), dk = w.donkey, back = dk && w.donkeyBack();
    const dd = dk ? Math.hypot(dk.x - cam.x, dk.z - cam.z) : Infinity; // right beside you, or close by and in view
    if (back && !ride && (dd <= 3 || (dd <= DONKEY_TAP && w.project(back.x, back.y, back.z)))) { loadDonkey({ i, type: t }); return; }
    const h = w.heading, n = g.waiting(), z = w.zone, top = hud.querySelector('.chor-bag').getBoundingClientRect().top - 24;
    const fx = -Math.sin(h), fz = -Math.cos(h), side = ((n % 2) ? 1 : -1) * Math.ceil(n / 2) * 1.6;
    const spot = (d) => [Math.min(z.x1, Math.max(z.x0, cam.x + fx * d + fz * -side)), Math.min(z.z1, Math.max(z.z0, cam.z + fz * d + fx * side))];
    let d = (w.walking ? 3 : 7) + (n % 3) * 1.5, [x, zz] = spot(d);
    for (let k = 0; k < 20; k++) { const p = w.project(x, 0, zz); if (p && p[1] < top) break; d += 1; [x, zz] = spot(d); }
    if (!g.place(t, x, zz)) { g.toast('Wait for the crackers to finish'); return; }
    state.bag.splice(i, 1); save(); syncBag();
  }
  // The night's result: the chaos score, your best, a share card, and the score to the board.
  function endNight() {
    const g = G(), box = hud.querySelector('.chor-result');
    const daily = stashes.filter((o) => typeof o.key === 'number'); // the day's gifts, as the HUD counts them
    const best = Math.max(state.best || 0, state.score), isBest = state.score > (state.best || 0) && state.score > 0;
    state.best = best; save();
    g.score(state.score);
    box.innerHTML = `<div class="chor-card"><small>Fireworks Street · tonight</small><b>${state.score}</b><span>${isBest ? 'chaos points · a new best!' : 'chaos points'}</span>`
      + `<p>${daily.filter(isTaken).length} of ${daily.length} stashes found · best ${best}</p>`
      + '<div class="chor-card-btns"><button type="button" class="btn ghost" data-act="share">Share</button><button type="button" class="btn primary" data-act="on">Keep playing</button></div></div>';
    box.hidden = false;
    box.onclick = (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'on') { box.hidden = true; return; }
      const L = window.LUTSGame;
      // (drawn onto the share card's canvas, so translated here)
      if (L && L.shareResult) L.shareResult({ kicker: 'Fireworks Street', title: T((STREETS.find((t) => t.id === G().street) || STREETS[0]).name), big: String(state.score), line: T('chaos points') + ' · ' + T(`${daily.filter(isTaken).length} stashes found`), art: `assets/chor/thumb/${G().street}.webp`, name: 'pataka-chor.png', text: T(`🧨 I caused ${state.score} points of Diwali chaos in Fireworks Street!`) });
    };
  }
  // ---------- The street picker and the how-to-play ----------
  // Full screen over home (or over the street, from the HUD's Street button): every street as a painted card, the one
  // you last played first. Picking one walks you into it; the first time, the how-to-play follows.
  let picker = null, tut = null, tutDone = false; // tutDone: skipped or finished in this session
  function openPicker(fromStreet) {
    const g = G();
    if (!g) return;
    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'chor-pick'; picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-modal', 'true');
      document.body.appendChild(picker);
      picker.addEventListener('click', (e) => {
        if (e.target.closest('[data-pick-close]')) { closePicker(); return; }
        if (e.target.closest('[data-pick-how]')) { openTutorial(); return; }
        const hz = e.target.closest('[data-pick-heist]');
        if (hz) { closePicker(); raceFromHome(hz.dataset.pickHeist); return; }
        const c = e.target.closest('[data-pick]');
        if (!c) return;
        c.classList.add('chosen');
        setTimeout(() => { const id = c.dataset.pick, on = g.on; closePicker(); if (on) { if (id !== g.street) goStreet(id); } else start(id); }, 180);
      });
    }
    const last = STREETS.find((t) => t.id === state.street) || STREETS[0], seen = state.visited || {};
    const card = (t, big) => {
      const [street, mark] = T(t.name).split(' · '), [city, rider] = PLACE[t.id] || ['', 'donkey'], [icon, beast] = RIDER[rider];
      const here = g.on && t.id === g.street, fresh = Object.keys(seen).length > 0 && !seen[t.id] && t.id !== last.id;
      return `<button type="button" class="chor-pcard${big ? ' big' : ''}${here ? ' here' : ''}" data-pick="${t.id}">
        <img src="assets/chor/thumb/${t.id}.webp" alt="" loading="${big ? 'eager' : 'lazy'}" decoding="async" onerror="this.src='assets/chor/thumb/chor-street.webp'">
        <span class="chor-pshade"></span>
        ${here ? `<em class="chor-ptag now">${T('You are here')}</em>` : big ? `<em class="chor-ptag">${T('Continue')}</em>` : fresh ? `<em class="chor-ptag new">${T('New')}</em>` : ''}
        <span class="chor-ptext"><b>${street}</b>${mark ? `<small>${mark}</small>` : ''}
          <span class="chor-pchips"><i>📍 ${T(city)}</i><i>${icon} ${T(beast)}</i>${big ? `<i>✦ ${T('Free')}</i>` : ''}</span></span>
        ${big ? `<span class="chor-pgo">${T(here ? 'Back to the street' : 'Play')} ›</span>` : ''}
      </button>`;
    };
    picker.innerHTML = `<div class="chor-ptop">
        <button type="button" class="chor-pback" data-pick-close aria-label="${T(fromStreet ? 'Close' : 'Back')}">${fromStreet ? '✕' : '‹'}</button>
        <div class="chor-ptitle"><small>Fireworks Street</small><b>${T('Pick a street')}</b></div>
        <button type="button" class="chor-phow" data-pick-how>？ <span>${T('How to play')}</span></button>
      </div>
      <div class="chor-pscroll">
        <p class="chor-plede">${T('Sneak in, find the hidden crackers, light them up, and don\'t get caught by Seth-ji.')}</p>
        ${(() => { const tr = treasureOfWeek(), got = (state.trophies || {})[tr[0]] || 0; return `<button type="button" class="chor-pheist" data-pick-heist="${last.id}"><i aria-hidden="true">${tPic(tr)}</i><span><small>🏆 ${T("This week's heist")}${got ? ` · ${T(`stolen ×${got}`)}` : ''}</small><b>${T(`Steal the ${tr[1]}`)}</b><em>${T('Find the 9 key pieces, open the vault, run!')} ›</em></span></button>`; })()}
        ${card(last, true)}
        ${!SHOP_OFF && last.id !== 'chor-shop' ? `<button type="button" class="chor-pshop" data-pick="chor-shop"><img src="assets/chor/thumb/chor-shop.webp" alt="" loading="lazy"><span><small>${T('New')} · ${T('Every cracker on display')}</small><b>${T("Light Up the Skies · Seth-ji's cracker shop")}</b><i>${T('Walk in and pick any cracker')} ›</i></span></button>` : ''}
        <h3 class="chor-phead">${T('All streets')} <span>${STREETS.length}</span></h3>
        <div class="chor-pgrid">${STREETS.filter((t) => t.id !== last.id && t.id !== 'chor-shop').map((t) => card(t)).join('')}</div>
        <p class="chor-psafe">${T('Only in the game! In real life, light crackers outdoors with an adult.')}</p>
      </div>`;
    picker.classList.toggle('over', !!fromStreet);
    picker.hidden = false;
    requestAnimationFrame(() => picker.classList.add('in'));
    picker.querySelector('[data-pick]').focus({ preventScroll: true });
  }
  function closePicker() { if (!picker || picker.hidden) return false; picker.classList.remove('in'); picker.hidden = true; return true; }

  // The how-to-play: five short cards with a moving picture each; Skip, Next, and Let's go on the last.
  const STEPS = [
    ['find', 'Find the crackers', 'Glowing gifts and gems are hidden by the stalls. Tap one in reach to put it in your bag.'],
    ['throw', 'Set it down or throw it', 'Tap a cracker in your bag to put it on the street. Drag it up to throw it anywhere: a stall, a tree, the cart.'],
    ['fire', 'Light it up', 'Press Fire, or throw it: it lights as it flies. Bigger chaos, more points.'],
    ['ride', 'Load the donkey', 'Drag a cracker onto the animal\'s basket and press Fire: it walks off with it going off on its back.'],
    ['hide', 'Don\'t get caught', 'Seth-ji, the old man and the dog are watching. Slip behind the cart or the crates when the eye fills up.'],
  ];
  const ART = { find: ['🎁', '✨', '💎'], throw: ['🧨', '', '💥'], fire: ['🎆', '🔥', '✨'], ride: ['🫏', '🧺', '🎇'], hide: ['👁️', '📦', '🙈'] };
  function openTutorial(then) {
    if (!tut) {
      tut = document.createElement('div');
      tut.className = 'chor-tut'; tut.setAttribute('role', 'dialog'); tut.setAttribute('aria-modal', 'true');
      document.body.appendChild(tut);
    }
    let i = 0;
    const done = () => { tut.hidden = true; tut.onclick = null; state.tut = true; tutDone = true; save(); if (then) then(); }; // (skipped or finished: not again)
    const draw = () => {
      const [art, title, line] = STEPS[i], last = i === STEPS.length - 1;
      tut.innerHTML = `<div class="chor-tcard">
          <button type="button" class="chor-tskip" data-t="skip">${T('Skip')}</button>
          <div class="chor-tart ${art}" aria-hidden="true">${ART[art].map((e, k) => `<span class="a${k + 1}">${e}</span>`).join('')}</div>
          <small class="chor-tstep">${T('Step {0} of {1}').replace('{0}', i + 1).replace('{1}', STEPS.length)}</small>
          <b>${T(title)}</b><p>${T(line)}</p>
          <div class="chor-tdots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <div class="chor-tbtns">${i ? `<button type="button" class="chor-tprev" data-t="prev">‹</button>` : ''}<button type="button" class="chor-tnext" data-t="${last ? 'done' : 'next'}">${T(last ? 'Let\'s go!' : 'Next')}</button></div>
        </div>`;
      tut.querySelector('.chor-tnext').focus({ preventScroll: true });
    };
    tut.onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      const t = b.dataset.t;
      if (t === 'next') { i++; draw(); } else if (t === 'prev') { i--; draw(); } else done();
    };
    // Swipe between cards.
    let x0 = null;
    tut.onpointerdown = (e) => { x0 = e.clientX; };
    tut.onpointerup = (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) < 50) return; if (dx < 0 && i < STEPS.length - 1) { i++; draw(); } else if (dx > 0 && i) { i--; draw(); } };
    draw(); tut.hidden = false;
  }
  function closeTutorial() { if (!tut || tut.hidden) return false; tut.hidden = true; state.tut = true; tutDone = true; save(); return true; }

  function start(pick) {
    const g = G();
    if (!g) return;
    if (state.raceSaved) { state.taken = state.raceSaved.taken || []; state.left = state.raceSaved.left || {}; delete state.raceSaved; save(); } // (a race left mid-way)
    fresh(g.dayKey());
    g.start();
    if (!hud) buildHud();
    hud.hidden = false; hud.querySelector('.chor-result').hidden = true;
    hud.classList.remove('tip-gone'); setTimeout(() => hud && hud.classList.add('tip-gone'), 9000); // the how-to fades once read
    stashes = []; memo = newMemo(); flying = []; aim = null; aimAt = null; ride = null; alert = 0; chase = null; noticed = {}; graceTo = clock + GRACE; atStart = true;
    syncBag();
    if (!state.seen) { state.seen = true; save(); setTimeout(() => g.toast('Only in the game! In real life, light crackers outdoors with an adult.'), 600); }
    // Back on the street you last played, while it is yours (a Premium one needs Premium still).
    const last = STREETS.find((t) => t.id === (pick || state.street) && !(SHOP_OFF && t.id === 'chor-shop'));
    const id = last && (!last.premium || g.premium()) ? last.id : STREETS[0].id;
    g.setStreet(id); state.street = id; state.visited = { ...(state.visited || {}), [id]: 1 }; save();
    if (!state.tut && !tutDone) setTimeout(() => { if (g.on && !tutDone) openTutorial(); }, 1200); // (once seen or skipped, it stays away: the ? in the street list opens it again)
    whenReady();
    cancelAnimationFrame(raf); lastT = 0; raf = requestAnimationFrame(frame);
  }
  // The street's stashes are known once its scene has loaded. The bazaar's are seeded by the date alone (as they always
  // were); each other street's by the date and its name.
  function whenReady() {
    const g = G();
    if (!g.on) return;
    const w = g.w3d;
    if (!w) { setTimeout(whenReady, 150); return; }
    const day = race ? race.day : state.day; // (a race plays its own day's stashes: the challenger's)
    const seed = g.street === STREETS[0].id ? day : `${day}:${g.street}`;
    stashes = dayStashes(seed, w.stashes, g.types(), g.premiumItem, w.mix, g.gemItem);
    // In Seth-ji's shop every cracker the game has (the ones a bag can carry) is out on display, one of each, and never runs out.
    if (w.wares) {
      // Laid out like a store: the free ones on the steps by the door, then the gem ones by what they're worth, and the
      // Premium ones on the showcase stage at the far end.
      const all = g.types(), prem = all.filter(g.premiumItem), rest = all.filter((t) => !g.premiumItem(t)).sort((a, b) => g.gemCost(a) - g.gemCost(b));
      const tables = w.wares.filter((p) => !p.stage), stage = w.wares.filter((p) => p.stage);
      const place = (slots, types) => types.slice(0, slots.length).map((t, i) => ({ ...slots[i], type: t }));
      stashes = [...place(tables, rest), ...place(stage, prem)].map((p, i) => ({ key: `ware${i}`, ware: true, x: p.x, y: p.y, z: p.z, stage: !!p.stage, type: p.type, rare: g.premiumItem(p.type), count: 1 }));
      if (w.setWares) w.setWares(stashes.map((o) => ({ ...o, src: g.pic(o.type) }))); // the same picture as in the Sky and Ground lists
      // The streets advertised on the walls, each with its picture; a tap on one takes you there.
      const streets = STREETS.filter((t) => t.id !== 'chor-shop');
      ads = (w.ads || []).slice(0, streets.length).map((a, i) => ({ ...a, id: streets[i].id, name: streets[i].name, src: `assets/chor/thumb/${streets[i].id}.webp` }));
      if (w.setPanels) w.setPanels(ads);
      hud.querySelector('.chor-ads').innerHTML = ads.map((a, i) => `<button type="button" class="chor-ad" data-ad="${i}">${T(a.name).split(' · ')[0]} ›</button>`).join('');
    }
    delivery = null; deliveryAt = clock + DELIVERY / 2;
    stashes.push(...dayExtras(seed, w.zone, g.skyTypes(), g.premiumSky()));
    if (!w.wares) { ads = []; hud.querySelector('.chor-ads').innerHTML = ''; }
    if (w.heist) stashes.push({ key: 'heist', heist: true, x: w.heist.x, z: w.heist.z, loot: heistLoot(seed, g.types(), g.premiumItem), count: HEIST });
    refillAt = clock + REFILL; syncLoot();
    if (canWalk(w)) w.setWalk(true); // always on foot (a TV, with no joystick, keeps the spots)
    hud.style.setProperty('--chor-acc', ACCENT[g.street] || '#ff5fa2'); document.body.style.setProperty('--chor-acc', ACCENT[g.street] || '#ff5fa2');
    shownView = -1; chosenView = -1; hud.querySelector('.chor-views').innerHTML = ''; hud.querySelector('.chor-views').dataset.key = ''; // (another street's viewpoints)
    syncMarks(); syncBag(); syncViews();
  }
  // ---------- The street race ----------
  // Find every one of a street's stashes as fast as you can: the clock starts with your first step and stops with the
  // last stash. A race plays its own copy of the street (what you'd already found today comes back afterwards), on the
  // challenger's day when it comes from a friend's link, so both of you race the very same stashes. Times go to the
  // street's weekly board, and a link dares a friend to beat yours.
  let race = null; // { day, street, target: { n, p, f, t } | null, t0, saved }
  const fmtT = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${Math.floor((sec % 1) * 10)}`;
  const raceScore = (sec) => Math.max(1, 20000 - Math.round(sec * 4)); // (a board keeps the highest: a faster time scores more)
  function startRace(target, day, mela) {
    const g = G(), w = g && g.w3d;
    if (!w || race) return;
    closeSheet();
    race = { day: day || state.day, street: g.street, target, t0: null, mela: mela || null, found: -1, phase: 'keys', treasure: treasureOfWeek() }; tImg(race.treasure[0]); // (its picture ready for the vault) // (mela: a Mela Night room's live race, rooms.js)
    state.raceSaved = { taken: state.taken, left: state.left || {}, street: g.street }; // (back afterwards, even if the app is closed mid-race)
    state.taken = []; state.left = {}; save();
    flying = []; aim = null; chase = null; alert = 0; graceTo = clock + GRACE; atStart = true;
    w.goView(0); chosenView = -1;
    whenReady(); syncViews();
    hud.querySelector('.chor-race').hidden = false;
    g.toast(target ? T(`Beat ${target.n || 'your friend'}: ${fmtT(target.t)}. Go!`) : T(`🗝 Find the 9 key pieces, then steal the ${race.treasure[1]}! The clock starts with your first step`), 3600);
  }
  function raceStep() {
    if (!race) return;
    if (race.t0 === null && !atStart) race.t0 = clock;
    const sec = race.t0 === null ? 0 : clock - race.t0, daily = stashes.filter((o) => typeof o.key === 'number');
    const left = daily.filter((o) => !isTaken(o)).length;
    const pill = hud.querySelector('.chor-race');
    const stage = race.phase === 'escape' ? T('🚨 Run to the gate!') : race.phase === 'vault' ? `🔓 ${T('Open the vault')}` : `🗝 ${daily.length - left}/${daily.length}`;
    const txt = `⏱ ${fmtT(sec)}${race.target ? ` · ${T('to beat')} ${fmtT(race.target.t)}` : ''} · ${stage}`;
    pill.classList.toggle('escape', race.phase === 'escape');
    if (pill.textContent !== txt) pill.textContent = txt;
    if (race.mela && race.found !== daily.length - left) { race.found = daily.length - left; race.mela.progress(race.found, daily.length, sec); }
    if (race.t0 !== null && daily.length && !left && race.phase === 'keys') openVault();
    if (race.phase === 'escape') {
      const w = G().w3d, c = w && w.camera(), gate = stashes.find((o) => o.gate);
      if (c && gate && Math.hypot(c.x - gate.x, c.z - gate.z) < GATE_R) endRace(true, sec);
    }
  }
  // The trophy room: every treasure there is to steal (one a week), how many times you've got away with each, this
  // week's, and the way to the Master Thief frame.
  function openTrophies() {
    const now = treasureOfWeek(), got = state.trophies || {}, n = state.heists || 0;
    const cards = TREASURES.map(([id, name]) => `<div class="chor-trophy${got[id] ? ' got' : ''}${id === now[0] ? ' now' : ''}"><i>${tPic([id])}</i><b>${T(name)}</b><small>${got[id] ? `×${got[id]}` : id === now[0] ? T('This week') : T('Not yet')}</small></div>`).join('');
    sheet(`<b>🏆 ${T('Trophy room')}</b><p class="chor-cat-note">${T(`This week's treasure: ${now[1]}. Race any street: find the 9 key pieces, open the vault, get it to the gate.`)}</p>`
      + `<div class="chor-trophies">${cards}</div>`
      + `<p class="chor-thief">${n >= THIEF_HEISTS ? T('🎭 Master Thief frame unlocked') : T(`🎭 Master Thief frame: ${n}/${THIEF_HEISTS} heists`)}</p>`
      + `<div class="chor-card-btns"><button type="button" class="btn primary" data-kit="race-go">⏱ ${T('Start a heist')}</button></div>`, (act) => {
      if (act === 'race-go') { closeSheet(); startRace(null); return true; }
      return true;
    });
    hud.querySelector('.chor-sheet').classList.add('catalog');
  }
  // The key is whole: the vault (Seth-ji's shop counter, or the far end of the street) shows the week's treasure.
  function openVault() {
    const g = G(), w = g.w3d;
    if (!w || !race) return;
    const b = w.bounds || { x0: -6, x1: 6, z0: -60, z1: 10 }, at = w.heist || { x: (b.x0 + b.x1) / 2, z: b.z0 + 6 };
    race.phase = 'vault';
    stashes.push({ key: 'vault', vault: true, x: at.x, z: at.z });
    syncMarks();
    g.tick(); g.buzz(30);
    g.toast(T(`🗝 Key complete! Steal the ${race.treasure[1]} from Seth-ji's vault`), 4200);
  }
  // Grabbed: Seth-ji comes running, and the gate where the street begins is the way out.
  function grabTreasure(s, w) {
    const g = G();
    if (!race || race.phase !== 'vault') return;
    empty(s); save();
    race.phase = 'escape';
    if (!stashes.some((o) => o.gate)) { const v = (w.views && w.views[0]) || { x: 0, z: 8 }; stashes.push({ key: 'gate', gate: true, x: v.x, z: v.z }); }
    syncMarks();
    chase = { t: 0, lost: 0 }; alert = 100; graceTo = 0;
    w.notice('keeper', s.x, s.z);
    hud.classList.add('escaping');
    g.buzz(60); g.tick();
    g.toast(T(`🚨 You have the ${race.treasure[1]}! RUN to the gate 🏁`), 4200);
  }
  // Caught with it: he snatches it back and it drops where you stand; grab it again.
  function dropTreasure(w, me) {
    const g = G(), s = stashes.find((o) => o.vault);
    w.nab('keeper');
    chase = null; alert = 0; graceTo = clock + 4;
    if (!s || !race) return;
    state.taken = state.taken.filter((k) => k !== 'vault');
    s.x = me.x; s.z = me.z;
    race.phase = 'vault';
    hud.classList.remove('escaping');
    syncMarks(); g.buzz(80);
    g.toast(T('Seth-ji grabbed it! It fell at your feet. Snatch it back'), 3600);
  }
  // A heist done: the treasure goes in the trophy room; five heists earn the Master Thief frame.
  function awardTreasure(r) {
    const g = G(), t = r.treasure || treasureOfWeek();
    state.trophies = state.trophies || {};
    state.trophies[t[0]] = (state.trophies[t[0]] || 0) + 1;
    state.heists = (state.heists || 0) + 1;
    save();
    if (state.heists === THIEF_HEISTS && window.LUTSBoards && LUTSBoards.earnFrame) LUTSBoards.earnFrame('thief');
    if (r.mela) setTimeout(() => g.toast(T(`🏆 The ${t[1]} is yours! It's in your trophy room`), 3800), 400); // (alone, the result card says it)
  }
  function endRace(finished, sec) {
    const r = race; race = null;
    if (!r) return;
    if (finished && window.LUTSGoals) LUTSGoals.tick('race');
    if (finished) awardTreasure(r);
    hud.classList.remove('escaping');
    const g = G();
    // What you'd found today comes back.
    if (state.raceSaved) { state.taken = state.raceSaved.taken || []; state.left = state.raceSaved.left || {}; delete state.raceSaved; }
    save();
    hud.querySelector('.chor-race').hidden = true;
    syncViews(); whenReady();
    if (r.mela) { r.mela.done(finished, sec); return; } // the room shows its own result
    if (!finished) return;
    heistFinale(r, () => raceResult(r, sec));
  }
  // The heist's ending, like a film's: letterbox bars, the treasure lifted into the light with its name, and a fireworks
  // volley up the street filmed low and looking up, the way fireworks are filmed. About ten seconds; a tap skips it.
  const FINALE_SHELLS = ['sky:kingwillow', 'sky:peony', 'sky:kamuro', 'sky:brocade', 'sky:crossette', 'sky:heart', 'sky:senrin', 'sky:dahlia', 'sky:palm', 'sky:kingwillow', 'sky:brocade', 'sky:kamuro'];
  function heistFinale(r, then) {
    const g = G(), w = g && g.w3d, tr = r.treasure || treasureOfWeek();
    if (!w || !hud) { then(); return; }
    const box = document.createElement('div');
    box.className = 'chor-finale';
    box.innerHTML = `<div class="chor-finale-bar"></div><div class="chor-finale-reveal"><i>${tPic(tr)}</i><b></b><small></small></div><div class="chor-finale-bar"></div>`;
    box.querySelector('b').textContent = T(`The ${tr[1]} is yours!`);
    box.querySelector('small').textContent = T('Seth-ji never saw it coming 🎆');
    document.body.append(box);
    hud.classList.add('cinema'); document.body.classList.add('chor-cinema');
    const timers = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      box.classList.add('gone'); setTimeout(() => box.remove(), 500);
      hud.classList.remove('cinema'); document.body.classList.remove('chor-cinema');
      if (w.goView) w.goView(0);
      then();
    };
    box.addEventListener('click', finish);
    const b = w.bounds || { x0: -8, x1: 8, z0: -60, z1: 10 }, len = b.z1 - b.z0;
    g.buzz && g.buzz(120); g.tick && g.tick();
    // The camera stays low by the gate, looking up the street (the sky in frame), and drifts in for the last volley.
    if (w.showCam) { w.showCam(0, b.z1 - 14, 'burst'); timers.push(setTimeout(() => w.showCam(0, b.z1 - 24, 'burst'), 5200)); }
    // The treasure holds the centre, then steps down to the lower third so the sky is the show.
    timers.push(setTimeout(() => box.classList.add('low'), 2600));
    // The volley: pairs from both sides of the street, walking away up it, then everything at once.
    FINALE_SHELLS.forEach((type, i) => {
      const side = i % 2 ? b.x1 - 2 : b.x0 + 2, z = b.z1 - 18 - (i >> 1) * Math.min(6, len * 0.08);
      timers.push(setTimeout(() => remoteBang(type, side, z), 700 + i * 430));
    });
    timers.push(setTimeout(() => { for (let i = 0; i < 6; i++) remoteBang(FINALE_SHELLS[(i * 5) % FINALE_SHELLS.length], b.x0 + 2 + (i / 5) * (b.x1 - b.x0 - 4), b.z1 - 30); }, 6600));
    timers.push(setTimeout(finish, 10200));
  }
  function raceResult(r, sec) {
    const g = G();
    state.raceBest = state.raceBest || {};
    const prev = state.raceBest[r.street], best = !prev || sec < prev;
    if (best) { state.raceBest[r.street] = sec; save(); }
    const B = window.LUTSBoards, key = `${r.street}-race`;
    if (B) B.post(key, raceScore(sec), fmtT(sec));
    const won = r.target && sec < r.target.t;
    const street = T((STREETS.find((t) => t.id === r.street) || STREETS[0]).name);
    const line = r.target ? (won ? T(`You beat ${r.target.n || 'your friend'} by ${fmtT(r.target.t - sec)}!`) : T(`${r.target.n || 'Your friend'} was ${fmtT(sec - r.target.t)} faster`)) : best ? T('A new best on this street!') : `${T('Your best')} ${fmtT(prev)}`;
    const tr = r.treasure || treasureOfWeek();
    sheet(`<b>🏆 ${T('Heist complete!')}</b><p class="chor-cat-note">${street}</p><p class="chor-heist-prize"><i>${tPic(tr)}</i>${T(`You stole the ${tr[1]}!`)}</p><div class="chor-race-big">${fmtT(sec)}</div><p class="chor-race-line${won || (!r.target && best) ? ' won' : ''}">${line}</p>`
      + `<div class="chor-race-board"><small>${T('This week on this street')}</small><ol><li>${T('Loading…')}</li></ol></div>`
      + `<div class="chor-card-btns"><button type="button" class="btn ghost" data-kit="trophies">🏆 ${T('Trophy room')}</button><button type="button" class="btn ghost" data-kit="race-again">${T('Race again')}</button><button type="button" class="btn primary" data-kit="race-share">${T('Challenge a friend')}</button></div>`, async (act) => {
      if (act === 'race-again') { startRace(r.target, r.day); return true; }
      if (act === 'race-share') { shareRace(r, sec); return true; }
      if (act === 'trophies') { openTrophies(); return true; }
      return true;
    });
    hud.querySelector('.chor-sheet').classList.add('catalog');
    if (won || best) g.tick();
    if (B && B.on) B.top(key).then((rows) => {
      const ol = hud.querySelector('.chor-race-board ol');
      if (!ol) return;
      ol.innerHTML = rows.length ? '' : `<li>${T('No races yet this week. Be the first!')}</li>`;
      rows.slice(0, 5).forEach((v, i) => {
        const li = document.createElement('li'); if (v.me) li.className = 'me';
        const k = document.createElement('i'); k.textContent = i === 0 ? '👑' : String(i + 1);
        const nm = document.createElement('span'); nm.textContent = v.me ? `${v.n} (${T('you')})` : v.n;
        const t = document.createElement('b'); t.textContent = v.t;
        li.append(k, B.avatar(v.p, v.n, v.f), nm, t); ol.append(li);
      });
    });
  }
  function shareRace(r, sec) {
    const D = window.LUTSDuel;
    if (!D) return;
    const name = D.savedName(), street = T((STREETS.find((t) => t.id === r.street) || STREETS[0]).name);
    const link = D.link(`heist=${D.encode({ n: name, st: r.street, d: r.day, t: Math.round(sec * 10) / 10 })}`);
    const tr = r.treasure || treasureOfWeek();
    const text = T(`🏆 I stole the ${tr[1]} from Seth-ji on ${street} in ${fmtT(sec)} in Fireworks Street! Can you pull off the heist faster? Same street, same stashes:`);
    const blob = D.card({ art: `assets/chor/thumb/${r.street}.webp`, kicker: name ? T(`${name} challenges you`) : T('Street heist'), title: `${tr[2]} ${T(tr[1])}`, big: fmtT(sec), line: `${street} · ${T('Fireworks Street heist')}` });
    D.share({ title: T('Street race'), text, url: link, blob, name: 'street-race.png', src: 'race' });
  }
  // A friend's race link (#heist=…): their street, their day, their time to beat. Played in the app only.
  function readRace() {
    const m = location.hash.match(/heist=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))));
      const st = STREETS.find((x) => x.id === v.st && x.id !== 'chor-shop'), t = +v.t;
      if (!st || !/^\d{4}-\d{2}-\d{2}$/.test(String(v.d)) || !(t > 0 && t < 3600)) return null;
      return { st: st.id, d: String(v.d), target: { n: String(v.n || '').slice(0, 20), t } };
    } catch (e) { return null; }
  }
  function openRaceLink() {
    const v = readRace(), D = window.LUTSDuel;
    if (!v || !D) return;
    if (!D.native()) { D.toApp('race'); return; } // (on the web: the app)
    history.replaceState(null, '', location.pathname + location.search);
    start(v.st);
    const go = () => { const g = G(); if (g && g.on && g.w3d && stashes.length) startRace(v.target, v.d); else setTimeout(go, 300); };
    setTimeout(go, 600);
  }
  function stop() {
    if (race) endRace(false);
    cancelAnimationFrame(raf); raf = 0; shownView = -1; aim = null; flying = []; keys.clear(); stick.on = false;
    if (hud) { hud.hidden = true; hud.classList.remove('aiming', 'soot'); closeSheet(); }
    if (G()) G().stop();
  }
  // The game calls this in its frame, right before the 3D view eases and draws, so each step lands on a drawn frame
  // (from this file's own loop the steps came out of step with the drawing: a jerky walk).
  let walkDriven = false;
  function walk(dt) { const g = G(), w = g && g.w3d; if (!hud || !w) return; walkDriven = true; walkStep(Math.min(0.1, dt), w); }
  // From the home screen's Challenges row: the street opens and the race starts as soon as its stashes are laid out
  function raceFromHome(street = 'chor-street', day = null, mela = null) {
    start(street);
    let tries = 0;
    const go = () => { const g = G(); if (g && g.on && g.w3d && stashes && stashes.length) startRace(null, day, mela); else if (++tries < 150) setTimeout(go, 200); };
    setTimeout(go, 300);
  }
  // Someone else's cracker on this street (a Mela Night room): it goes off here at their spot. quiet: not sent back out.
  function remoteBang(type, x, z) {
    const g = G();
    if (!g || !g.on || !g.w3d) return;
    window.PatakaChor.quiet = true;
    try { const h = g.ride(type, x, 0, z); if (h) h.fire(); else g.bang(x, 0.3, z, 1); } finally { window.PatakaChor.quiet = false; }
  }
  window.PatakaChor = { treasure: () => treasureOfWeek(), /* nav: where you stand and face, and the day's stashes still out (for tests that play by touch) */ get nav() { const w = G() && G().w3d; if (!w) return null; const c = w.camera(); return { x: c.x, z: c.z, h: w.heading, aerial: w.aerial, walking: w.walking, goal: (() => { const o = race && (race.phase === 'vault' ? stashes.find((x) => x.vault) : race.phase === 'escape' ? stashes.find((x) => x.gate) : null); return o ? { x: o.x, z: o.z, kind: race.phase } : null; })(), left: stashes.filter((o) => typeof o.key === 'number' && !isTaken(o)).map((o) => ({ x: o.x, z: o.z, rare: !!o.rare, heist: !!o.heist, delivery: !!o.delivery, ware: !!o.ware })) }; }, onBang: null, quiet: false, remoteBang, start, stop, raceFromHome, quitRace: () => endRace(false), back, openPicker, openTutorial, place: placeMarks, walk, startRace, get race() { return race; }, finishRace: (sec) => endRace(true, sec), /* (finishRace: for tests) */ get hits() { return hits.map((h) => ({ ...h })); }, /* (hits: for tests) */ get on() { return !!(G() && G().on); } };
  document.addEventListener('DOMContentLoaded', () => {
    wrapRemote();
    const btn = document.getElementById('btnChor');
    if (btn) btn.addEventListener('click', () => openPicker(false));
    // The week's treasure, said where people choose what to play: it's the reason to race
    const tr = treasureOfWeek(), tile = document.getElementById('tileChor'), ch = document.querySelector('#btnChRace small');
    if (tile) tile.textContent = `${tr[2]} ${T(`This week: steal the ${tr[1]}`)}`;
    if (ch) ch.textContent = T(`Steal the ${tr[1]}`);
    const chIcon = document.querySelector('#btnChRace > i'); if (chIcon) chIcon.innerHTML = tPic(tr); // the home Challenges card shows the week's treasure
    const badge = btn && btn.querySelector('.tile-badge'); if (badge) badge.textContent = T('Heist');
    // On the home screen: this week's best heist on the Bazaar (a real player's time from the street board) to beat
    const rival = document.getElementById('homeRival');
    const showRival = () => {
      const B = window.LUTSBoards;
      if (!rival || !B || !B.on) return;
      B.top('chor-street-race').then((rows) => {
        const top = rows.find((v) => v.t), mine = rows.find((v) => v.me);
        if (!top) { rival.hidden = true; return; }
        rival.textContent = top.me ? `👑 ${T(`You hold the week's best heist: ${top.t}. Defend it!`)}`
          : `👑 ${T(`${top.n} stole the ${tr[1]} in ${top.t}`)}${mine ? ` · ${T(`yours: ${mine.t}`)}` : ''} · ${T('beat them?')}`;
        rival.hidden = false;
      }).catch(() => {});
    };
    if (rival) rival.addEventListener('click', () => raceFromHome('chor-street'));
    setTimeout(showRival, 2500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) showRival(); });
    const home = document.getElementById('btnHome');
    if (home) home.addEventListener('click', () => { if (window.PatakaChor.on) stop(); }, true);
    // A friend's race link, once the game is up.
    if (/heist=/.test(location.hash)) { const wait = () => (window.LUTSGame && window.LUTSDuel ? openRaceLink() : setTimeout(wait, 300)); setTimeout(wait, 800); }
    window.addEventListener('hashchange', () => { if (/heist=/.test(location.hash)) openRaceLink(); });
  });
})();
