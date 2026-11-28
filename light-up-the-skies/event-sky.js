/* Event Sky core data layer: window.ES (build spec: research/event-sky-spec.md §2 and §3.2).
 *
 * QR check-in, live photo wall, gallery, RSVP and guestbook for weddings, birthdays, parties and office events, on the
 * free Firebase Spark plan with no SDK and no streaming:
 *  - Firestore (REST) holds everything that takes storage, inside slots the rules enforce (firebase/firestore.rules,
 *    the "Event Sky v2" block). RTDB (REST) holds only small live signals: doorbells, live state, statuses, counters
 *    and the public settings mirror (firebase/database.rules.json, made by firebase/es-rtdb-rules.cjs).
 *  - Guests never sign in. A guest owns one numbered seat through random tokens kept on their phone; the last token is
 *    the seat secret, which never goes into a URL or a document id. Guest pages make 0 Firestore reads on load and never
 *    call identitytoolkit: they read the RTDB mirror (es/{code}/pub).
 *  - Staff (host, co-host c, moderator m, photographer p, wall w) sign in anonymously with the shared 'luts:fb' account,
 *    as duel.js does.
 * Loaded after event-config.js (window.LUTS_EVENT) and i18n.js. Optional: event-media.js (window.EM) for gallery
 * pages and password links.
 *
 * Conventions (§2): timestamps are ms numbers in JS and Firestore timestamps on the wire (fields named at, mt, rv, xp,
 * opensAt, closesAt, fu, expiresAt, createdAt, updatedAt, ex, outside lists; or wrap with ES.fs.ts(ms)); bytes are
 * Uint8Array. Every failure is an ESError {code, status, message} with the codes of §3.0.
 * Never logs: event codes must not appear in logs or analytics.
 *
 * Extra API beyond §3.2 (documented for the UI packages): ES.ESError, ES.caps(plan, vf), ES.cfg.cached(),
 * ES.events.hostKey(code), ES.events.mirror(code), ES.events.normCode(s), ES.passes.{record, get},
 * ES.guest.saveKey(code, k), ES.guest.drop(code, key), ES.roles.revoke(code, role), ES.pro.uploadMany(code, items),
 * ES.rsvp.remove(code, r), ES.gallery.key.rotate(code), ES.gov.refresh(), ES.gov.take(), ES.db.bump(path),
 * ES.fmtKey(rk), ES.b64u, ES.sha256hex. ES.pair.show({onPin}) returns {pin, ready, wait(), cancel()}: pin is a first
 * choice shown at once, ready resolves with the PIN actually held (it changes if that PIN was taken).
 * ES.bell.watch() also returns setOpensAt(ms), level() and state(); onChange gets (changed, bell, {first}).
 *
 * STRINGS:
 * You have made 3 events today. Try again tomorrow, or use an activation code.
 * Anniversary
 * Couple's names
 * An anniversary wish (optional)
 * Your favourite photo of the two of them
 * A memory you share with them
 * Happy Anniversary, {0}
 * Proposal
 * Who is the question for?
 * A word of love (optional)
 * A photo that tells your story
 * Your best memory together
 * Will you marry me, {0}?
 * Graduation
 * Graduate
 * A message for the graduate (optional)
 * Graduation day photo
 * Your proudest moment with them
 * Congratulations, {0}
 * Get well soon
 * Who is it for?
 * A get-well wish (optional)
 * A photo that will make them smile
 * Something to look forward to
 * Get well soon, {0}
 * Thank you
 * Who are you thanking?
 * Say thank you (optional)
 * A photo of a time they helped
 * A big smile for them
 * Thank you, {0}
 * Sorry
 * Say sorry (optional)
 * A photo of happier days
 * A promise for tomorrow
 * Sorry, {0}
 * Miss you
 * Who do you miss?
 * Tell them you miss them (optional)
 * Where you are right now
 * A photo of the two of you
 * We miss you, {0}
 * Just because
 * Something nice to say (optional)
 * A photo that reminds you of them
 * Your favourite thing about them
 * We love you, {0}
 * Christmas
 * A Christmas wish (optional)
 * Your Christmas tree
 * A festive selfie
 * Merry Christmas, {0}
 * New Year
 * A New Year wish (optional)
 * Your New Year's Eve selfie
 * A wish for next year
 * Happy New Year, {0}
 * Valentine's Day
 * Your Valentine
 * A love note (optional)
 * Where it all began
 * Happy Valentine's Day, {0}
 * Mother's Day
 * Mum's name
 * A wish for Mum (optional)
 * A photo with Mum
 * Something Mum taught you
 * Happy Mother's Day, {0}
 * Father's Day
 * Dad's name
 * A wish for Dad (optional)
 * A photo with Dad
 * Something Dad taught you
 * Happy Father's Day, {0}
 * Diwali
 * A Diwali wish (optional)
 * Your rangoli
 * A festive family photo
 * Happy Diwali, {0}
 * Wedding
 * Birthday
 * Party
 * Office event
 * Couple's names
 * Birthday star
 * Hosts
 * Company or team
 * A wish for the couple (optional)
 * A birthday wish (optional)
 * Say something nice (optional)
 * A message for the team (optional)
 * Mehendi
 * Haldi
 * Sangeet
 * Reception
 * Day 1
 * Day 2
 * Awards night
 * Selfie with the bride's family
 * Selfie with the groom's family
 * Your best dance move
 * The most beautiful decoration
 * A photo with the oldest guest
 * Find someone from the other side and click a photo
 * Cake moment
 * Silliest face
 * Photo with the birthday star
 * Best group photo
 * On the dance floor
 * Sparkle selfie
 * Team photo
 * Selfie with someone from another team
 * Your booth or desk
 * Behind the scenes
 * Happy Birthday {0}
 * Before you share a photo
 * Your name and photos appear on the event screen right away.
 * Your name and photos appear on the event screen after the hosts check them.
 * People with the event code or the gallery link can see the photos.
 * Guests can find photos of themselves with selfie search, on their own phone.
 * Please don't share photos of other people's children without asking.
 * Photos are kept until {0}, then deleted.
 * Full-size copies are kept until {0}.
 * To remove a photo, tap “Delete my photos” on this page, or ask {0}.
 * To remove a photo, tap “Delete my photos” on this page, or ask the hosts.
 * Light Up the Skies keeps these photos only for this event and never uses them for anything else.
 * I agree my name and photos appear on the event screen and in the event gallery.
 * I'm 18 or older, or I'm a parent or guardian sharing for my child.
 * Let selfie search include my face.
 * (ESError messages a page may show as they are; the pages normally show their own copy for each code)
 * That code has been used.
 * That code has expired.
 * That isn't a valid code.
 * This pass has been used.
 * Check-in has closed.
 * Check-in has not opened yet
 * Check-in is busy. Trying again…
 * The event is full.
 * Both ticks are needed
 * Your name
 * Check in first
 * That photo did not open. Try again.
 * That photo is too big
 * That video is too big
 * No photos left. Thank you for sharing!
 * Video slots for this event are full.
 * Uploads have closed for this event.
 * Uploads open when the event opens
 * No photographer photos left for this event
 * Photographer uploads switch on when the pass is confirmed
 * Could not reserve a photo slot. Try again.
 * Could not delete everything. Ask the hosts.
 * Could not change this
 * Messages can be changed until a day after the event
 * Voice messages are not on for this event
 * That voice message is too long
 * RSVP is not on for this event
 * RSVP has closed
 * Check the phone number
 * Could not change your RSVP
 * Could not send your RSVP. Try again.
 * Pick a reason
 * Enter the 4 numbers shown on the TV
 * That PIN is not on any TV right now
 * Only the host can pair a TV
 * No free PIN. Try again.
 * Enter the password
 * Wrong password
 * A password needs at least 10 characters
 * This gallery link is missing its key.
 * This gallery has ended.
 * That invite link is not complete
 * This invite link no longer works. Ask the hosts for a new one.
 * Only the hosts can make invite links
 * Only the host can upgrade
 * Only the host can delete the event
 * That is not an upgrade for this event
 * An upgrade needs a code or a pass
 * A host key has 16 letters and numbers
 * That host key does not match this event
 * A contact for photo removal is required on paid plans
 * The opening time is fixed once the event has opened
 * Logo too large
 * Write the announcement first
 * Name the challenge first
 * Event Sky is paused for a moment
 * Event Sky is full right now
 * Could not reserve an event code. Try again.
 * Fully booked for new free events today
 * Fully booked for new passes today
 * No connection
 * Sign-in needs a connection
 */
(function () {
  'use strict';

  // ======================================================================================================== basics ===
  const CFG = () => window.LUTS_EVENT || {};
  const FB = () => CFG().firebase || {};
  const DOCS = () => `projects/${FB().projectId}/databases/(default)/documents`;
  const FS_URL = () => `https://firestore.googleapis.com/v1/${DOCS()}`;
  const RTDB = () => String(CFG().rtdb || '').replace(/\/+$/, '');
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;

  class ESError extends Error {
    constructor(code, status, message) {
      super(message || code);
      this.name = 'ESError'; this.code = code; this.status = status || 0;
    }
  }
  const err = (code, status, message) => new ESError(code, status, message);

  const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* old WebView */ } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
  const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
  const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function randStr(n, alphabet = ALNUM) {
    const out = [], lim = 256 - (256 % alphabet.length);
    while (out.length < n) {
      const b = new Uint8Array(n * 2); crypto.getRandomValues(b);
      for (let i = 0; i < b.length && out.length < n; i++) if (b[i] < lim) out.push(alphabet[b[i] % alphabet.length]);
    }
    return out.join('');
  }
  function randInt(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  function shuffled(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // Trim text to a UTF-16 length without splitting a surrogate pair, after removing control characters and angle brackets.
  function clean(s, max) {
    let t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length > max) { t = t.slice(0, max); if (/[\ud800-\udbff]$/.test(t)) t = t.slice(0, -1); t = t.trim(); }
    return t;
  }

  function b64enc(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64dec(s) {
    const bin = atob(String(s || '')); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  const b64u = {
    enc: (u8) => b64enc(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => { const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); return b64dec(t + '==='.slice((t.length + 3) % 4)); },
  };
  async function toBytes(x) {
    if (x == null) return null;
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (typeof Blob !== 'undefined' && x instanceof Blob) return new Uint8Array(await x.arrayBuffer());
    throw err('DENIED', 0, 'Expected bytes or a Blob');
  }
  async function sha256hex(str) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function deepEq(a, b) {
    if (a === b) return true;
    if (a instanceof Uint8Array && b instanceof Uint8Array) return a.length === b.length && a.every((x, i) => x === b[i]);
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEq(a[k], b[k]));
  }

  // ===================================================================================================== constants ===
  // The plan table: must equal caps() in firebase/firestore.rules (tests/es-rules-lint.test.cjs checks it).
  const C = (lim, pg, vg, vt, pc, gd, fd, wd, fm, mk, sx, vo, rs, lg) => Object.freeze({ lim, pg, vg, vt, pc, gd, fd, wd, fm, mk, sx, vo, rs, lg });
  const PLANS = Object.freeze({
    free: Object.freeze({ true: C(30, 2, 0, 0, 20, 3, 3, 1, 1, true, false, false, false, false) }),
    event: Object.freeze({ true: C(300, 4, 0, 0, 300, 30, 14, 2, 1, false, false, false, false, false),
      false: C(300, 1, 0, 0, 0, 30, 3, 2, 1, false, false, false, false, false) }),
    shaadi: Object.freeze({ true: C(500, 4, 1, 60, 600, 90, 14, 7, 8, false, true, true, true, true),
      false: C(500, 1, 0, 0, 0, 90, 3, 7, 8, false, false, false, true, true) }),
    corp: Object.freeze({ true: C(1000, 2, 1, 30, 500, 30, 14, 3, 4, false, true, false, true, true) }),
  });
  const caps = (plan, vf) => (PLANS[plan] && PLANS[plan][!!vf]) || null;
  const rank = (p) => (p === 'free' ? 0 : p === 'event' ? 1 : 2);
  // Governor reservations per event (§1.4e): reads a day, egress MB, stored MB; scaled by max(0.3, guests / lim).
  const EXPECT = Object.freeze({ free: { rd: 500, eg: 30, st: 8 }, event: { rd: 3500, eg: 350, st: 70 },
    shaadi: { rd: 12000, eg: 1200, st: 250 }, corp: { rd: 15000, eg: 900, st: 200 } });
  const WORLDS = Object.freeze(['golden-manor', 'mysore-palace', 'gateway-of-india', 'india-gate', 'taj-mahal', 'hawa-mahal',
    'charminar', 'konark-sun-temple', 'golden-temple', 'victoria-memorial', 'red-fort', 'meenakshi-amman-temple',
    'brihadeeswarar-temple', 'vivekananda-rock-memorial', 'velankanni-basilica', 'cross-by-the-sea', 'harbour-city']);
  const LANGS = Object.freeze(['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa']);
  const ms = (pre, list) => list.map((t, i) => ({ id: `${pre}${i + 1}`, t }));
  // §4.2. Every preset was checked against the no-alcohol list (§4.26).
  const TEMPLATES = Object.freeze({
    wedding: { label: 'Wedding', approve: true, world: 'golden-manor', namesLabel: "Couple's names", wishLabel: 'A wish for the couple (optional)',
      fns: ['Mehendi', 'Haldi', 'Sangeet', 'Wedding', 'Reception'],
      missions: ms('w', ["Selfie with the bride's family", "Selfie with the groom's family", 'Your best dance move',
        'The most beautiful decoration', 'A photo with the oldest guest', 'Find someone from the other side and click a photo']),
      finale: { words: ['{names}', 'Shubh Vivah'], i18n: false }, dp: 'optional' },
    birthday: { label: 'Birthday', approve: false, world: 'mysore-palace', namesLabel: 'Birthday star', wishLabel: 'A birthday wish (optional)',
      fns: [], missions: ms('b', ['Cake moment', 'Silliest face', 'Photo with the birthday star', 'Best group photo']),
      finale: { words: ['Happy Birthday {0}'], i18n: true }, dp: 'on' },
    party: { label: 'Party', approve: false, world: 'gateway-of-india', namesLabel: 'Hosts', wishLabel: 'Say something nice (optional)',
      fns: [], missions: ms('p', ['Best group photo', 'On the dance floor', 'Sparkle selfie']),
      finale: { words: ['{title}'], i18n: false }, dp: 'optional' },
    corporate: { label: 'Office event', approve: true, world: 'india-gate', namesLabel: 'Company or team', wishLabel: 'A message for the team (optional)',
      fns: ['Day 1', 'Day 2', 'Awards night'],
      missions: ms('c', ['Team photo', 'Selfie with someone from another team', 'Your booth or desk', 'Behind the scenes']),
      finale: { words: ['{title}'], i18n: false }, dp: 'off' },
    // Occasions (everyday and holidays): a guest's selfie and wish for one person or couple; no functions, no approval.
    anniversary: { label: 'Anniversary', ico: '💞', group: 'day', approve: false, world: 'taj-mahal', namesLabel: "Couple's names", wishLabel: 'An anniversary wish (optional)',
      fns: [], missions: ms('oa', ['Your favourite photo of the two of them', 'A memory you share with them']), finale: { words: ['Happy Anniversary, {0}'], i18n: true }, dp: 'optional' },
    proposal: { label: 'Proposal', ico: '💌', group: 'day', approve: false, world: 'taj-mahal', namesLabel: 'Who is the question for?', wishLabel: 'A word of love (optional)',
      fns: [], missions: ms('ob', ['A photo that tells your story', 'Your best memory together']), finale: { words: ['Will you marry me, {0}?'], i18n: true }, dp: 'optional' },
    graduation: { label: 'Graduation', ico: '🎓', group: 'day', approve: false, world: 'victoria-memorial', namesLabel: 'Graduate', wishLabel: 'A message for the graduate (optional)',
      fns: [], missions: ms('oc', ['Graduation day photo', 'Your proudest moment with them']), finale: { words: ['Congratulations, {0}'], i18n: true }, dp: 'optional' },
    getwell: { label: 'Get well soon', ico: '💐', group: 'day', approve: false, world: 'cross-by-the-sea', namesLabel: 'Who is it for?', wishLabel: 'A get-well wish (optional)',
      fns: [], missions: ms('od', ['A photo that will make them smile', 'Something to look forward to']), finale: { words: ['Get well soon, {0}'], i18n: true }, dp: 'optional' },
    thanks: { label: 'Thank you', ico: '🙏', group: 'day', approve: false, world: 'golden-temple', namesLabel: 'Who are you thanking?', wishLabel: 'Say thank you (optional)',
      fns: [], missions: ms('oe', ['A photo of a time they helped', 'A big smile for them']), finale: { words: ['Thank you, {0}'], i18n: true }, dp: 'optional' },
    sorry: { label: 'Sorry', ico: '🫶', group: 'day', approve: false, world: 'vivekananda-rock-memorial', namesLabel: 'Who is it for?', wishLabel: 'Say sorry (optional)',
      fns: [], missions: ms('of', ['A photo of happier days', 'A promise for tomorrow']), finale: { words: ['Sorry, {0}'], i18n: true }, dp: 'optional' },
    missyou: { label: 'Miss you', ico: '✈️', group: 'day', approve: false, world: 'harbour-city', namesLabel: 'Who do you miss?', wishLabel: 'Tell them you miss them (optional)',
      fns: [], missions: ms('og', ['Where you are right now', 'A photo of the two of you']), finale: { words: ['We miss you, {0}'], i18n: true }, dp: 'optional' },
    justbecause: { label: 'Just because', ico: '💛', group: 'day', approve: false, world: 'hawa-mahal', namesLabel: 'Who is it for?', wishLabel: 'Something nice to say (optional)',
      fns: [], missions: ms('oh', ['A photo that reminds you of them', 'Your favourite thing about them']), finale: { words: ['We love you, {0}'], i18n: true }, dp: 'optional' },
    christmas: { label: 'Christmas', ico: '🎄', group: 'hol', approve: false, world: 'velankanni-basilica', namesLabel: 'Who is it for?', wishLabel: 'A Christmas wish (optional)',
      fns: [], missions: ms('oi', ['Your Christmas tree', 'A festive selfie']), finale: { words: ['Merry Christmas, {0}'], i18n: true }, dp: 'optional' },
    newyear: { label: 'New Year', ico: '✨', group: 'hol', approve: false, world: 'harbour-city', namesLabel: 'Who is it for?', wishLabel: 'A New Year wish (optional)',
      fns: [], missions: ms('oj', ["Your New Year's Eve selfie", 'A wish for next year']), finale: { words: ['Happy New Year, {0}'], i18n: true }, dp: 'optional' },
    valentine: { label: "Valentine's Day", ico: '💘', group: 'hol', approve: false, world: 'taj-mahal', namesLabel: 'Your Valentine', wishLabel: 'A love note (optional)',
      fns: [], missions: ms('ok', ['A photo of the two of you', 'Where it all began']), finale: { words: ["Happy Valentine's Day, {0}"], i18n: true }, dp: 'optional' },
    mothersday: { label: "Mother's Day", ico: '🌷', group: 'hol', approve: false, world: 'mysore-palace', namesLabel: "Mum's name", wishLabel: 'A wish for Mum (optional)',
      fns: [], missions: ms('ol', ['A photo with Mum', 'Something Mum taught you']), finale: { words: ["Happy Mother's Day, {0}"], i18n: true }, dp: 'optional' },
    fathersday: { label: "Father's Day", ico: '👔', group: 'hol', approve: false, world: 'red-fort', namesLabel: "Dad's name", wishLabel: 'A wish for Dad (optional)',
      fns: [], missions: ms('om', ['A photo with Dad', 'Something Dad taught you']), finale: { words: ["Happy Father's Day, {0}"], i18n: true }, dp: 'optional' },
    diwali: { label: 'Diwali', ico: '🪔', group: 'hol', approve: false, world: 'golden-manor', namesLabel: 'Who is it for?', wishLabel: 'A Diwali wish (optional)',
      fns: [], missions: ms('on', ['Your rangoli', 'A festive family photo']), finale: { words: ['Happy Diwali, {0}'], i18n: true }, dp: 'optional' },
  });
  // The wizard's groups, in order: what most people celebrate first (§4.2).
  const TEMPLATE_GROUPS = Object.freeze([['day', ['birthday', 'anniversary', 'wedding', 'proposal', 'graduation', 'getwell', 'thanks', 'sorry', 'missyou', 'justbecause', 'party', 'corporate']],
    ['hol', ['christmas', 'newyear', 'valentine', 'mothersday', 'fathersday', 'diwali']]]);
  const BELL_KEYS = 'qoaerslpgw';
  const GUEST_BELLS = 'qoaer';
  const STAT_KEYS = { a: 'a', u: 'u', o: 'o', r: 'r', s: 's', d: 'd', v: 'v', arrival: 'a', upload: 'u', open: 'o', react: 'r',
    reaction: 'r', search: 's', download: 'd', video: 'v', play: 'v' };

  // ============================================================================================== local counters ===
  const meter = { r: 0, w: 0, x: 0, ef: 0, er: 0 }; // this device's Firestore reads/writes/deletes, egress KB (FS, RTDB)
  const gov = { level: 0, reads: 0, egressMB: 0, quotaAt: 0, pause: false, at: 0 };
  function setGovLevel() {
    const b = (cfgLast && cfgLast.b) || CFG().budgets || {};
    let lvl = 0;
    const rdPct = b.rd ? gov.reads / b.rd : 0, egPct = b.eg ? gov.egressMB / b.eg : 0;
    if (rdPct > 0.7 || egPct > 0.7) lvl = 1;
    if (rdPct > 0.85 || egPct > 0.85) lvl = 2;
    if (gov.pause || Date.now() - gov.quotaAt < 60e3) lvl = 3;
    if (lvl !== gov.level) { gov.level = lvl; emit('es:gov', { level: lvl }); }
    return lvl;
  }
  function noteQuota() { gov.quotaAt = Date.now(); setGovLevel(); }

  // ========================================================================================================= clock ===
  let clockOffset = 0, clockSource = 'device';
  const clock = {
    now: () => Date.now() + clockOffset,
    offset: () => clockOffset,
    async sync(code) {
      const uid = staffUid();
      if (uid && code) {
        const probes = [];
        for (let i = 0; i < 5; i++) {
          const t0 = Date.now();
          try {
            const v = await dbReq('PUT', `es/${code}/sync/${uid}`, { '.sv': 'timestamp' }, { auth: true });
            const t1 = Date.now();
            if (typeof v === 'number') probes.push(v - (t0 + t1) / 2);
          } catch (e) { if (e.code === 'DENIED') break; if (e.code !== 'OFFLINE') throw e; }
        }
        if (probes.length) {
          probes.sort((a, b) => a - b);
          clockOffset = Math.round(probes[Math.floor(probes.length / 2)]); clockSource = 'probe';
          return clockOffset;
        }
      }
      // Guests: the Date header of a tiny public read (1 s precision) when the server exposes it.
      try {
        const t0 = Date.now();
        const r = await fetch(`${RTDB()}/es_cfg/pause.json`, { cache: 'no-store' });
        const t1 = Date.now(), d = Date.parse(r.headers.get('date') || '');
        if (d) noteServerTime(d + 500, t0, t1, 'date');
      } catch (e) { /* offline: keep the device clock */ }
      return clockOffset;
    },
  };
  // A server time seen in a response (Date header, commitTime, a resolved RTDB timestamp). Probes win over these.
  function noteServerTime(serverMs, t0, t1, src) {
    if (!serverMs || clockSource === 'probe') return;
    const off = serverMs - (t0 + t1) / 2;
    if (clockSource === 'device' || Math.abs(off - clockOffset) > 1500) { clockOffset = Math.round(off); clockSource = src; }
  }

  // ========================================================================================== staff auth (luts:fb) ===
  const AUTH_KEY = 'luts:fb';
  let auth = lsGet(AUTH_KEY);
  let tokenP = null;
  function staffUid() { return (auth && auth.uid) || null; }
  async function token(force) {
    // (a token lasts an hour: one that seems valid for longer was saved while the phone's clock was ahead, and has expired)
    if (!force && auth && auth.exp > Date.now() + 60e3 && auth.exp < Date.now() + 3660e3) return auth.id;
    if (tokenP) return tokenP;
    tokenP = (async () => {
      const key = encodeURIComponent(FB().apiKey || '');
      const post = async (url, body, type) => {
        let r;
        try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body }); } catch (e) { throw err('OFFLINE', 0, 'Sign-in needs a connection'); }
        if (r.status === 429) { noteQuota(); throw err('QUOTA', 429, 'Too many sign-ins'); }
        return r.json().catch(() => ({}));
      };
      const signUp = () => post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, '{"returnSecureToken":true}', 'application/json');
      let r = (auth && auth.refresh)
        ? await post(`https://securetoken.googleapis.com/v1/token?key=${key}`, `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refresh)}`, 'application/x-www-form-urlencoded').catch((e) => { if (e.code === 'OFFLINE') throw e; return {}; })
        : await signUp();
      if (!(r.idToken || r.id_token)) r = await signUp(); // a refresh that failed (account cleaned up): start afresh
      const id = r.idToken || r.id_token, refresh = r.refreshToken || r.refresh_token, uid = r.localId || r.user_id;
      if (!id || !uid) throw err('DENIED', 0, 'Sign-in failed');
      auth = { id, refresh, uid, exp: Date.now() + (+(r.expiresIn || r.expires_in) || 3600) * 1000 };
      lsSet(AUTH_KEY, auth);
      return id;
    })();
    try { return await tokenP; } finally { tokenP = null; }
  }
  async function ensureStaff() { await token(); return auth.uid; }
  // Other tabs (or duel.js) may refresh the shared account.
  window.addEventListener('storage', (e) => { if (e.key === AUTH_KEY) auth = lsGet(AUTH_KEY); });

  // ============================================================================================ Firestore (REST) ===
  const TS_KEYS = new Set(['at', 'mt', 'rv', 'xp', 'opensAt', 'closesAt', 'fu', 'expiresAt', 'createdAt', 'updatedAt', 'ex']);
  class FsTs { constructor(ms) { this.ms = +ms; } }
  class FsRef { constructor(path) { this.path = path; } }
  const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && !(v instanceof FsTs) && !(v instanceof FsRef) && !(v instanceof Date);
  function encVal(v, key, inList) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v instanceof FsTs) return { timestampValue: new Date(v.ms).toISOString() };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (v instanceof FsRef) return { referenceValue: `${DOCS()}/${v.path}` };
    if (v instanceof Uint8Array) return { bytesValue: b64enc(v) };
    if (Array.isArray(v)) return { arrayValue: { values: v.map((x) => encVal(x, '', true)) } };
    switch (typeof v) {
      case 'boolean': return { booleanValue: v };
      case 'number':
        if (!inList && TS_KEYS.has(key)) return { timestampValue: new Date(v).toISOString() };
        return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
      case 'string': return { stringValue: v };
      case 'object': return { mapValue: { fields: enc(v, inList) } };
      default: return { nullValue: null };
    }
  }
  function enc(obj, inList) {
    const f = {};
    for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) f[k] = encVal(v, k, inList);
    return f;
  }
  function decVal(v) {
    if (!v || typeof v !== 'object') return undefined;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return !!v.booleanValue;
    if ('timestampValue' in v) return Date.parse(v.timestampValue);
    if ('bytesValue' in v) return b64dec(v.bytesValue);
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decVal);
    if ('mapValue' in v) return dec((v.mapValue && v.mapValue.fields) || {});
    if ('referenceValue' in v) return String(v.referenceValue).split('/documents/')[1] || v.referenceValue;
    if ('geoPointValue' in v) return v.geoPointValue;
    return undefined;
  }
  function dec(fields) { const o = {}; for (const [k, v] of Object.entries(fields || {})) o[k] = decVal(v); return o; }
  const relPath = (name) => String(name).split('/documents/')[1] || '';
  function docOut(d) {
    if (!d || !d.name) return null;
    const o = dec(d.fields), rel = relPath(d.name), id = rel.split('/').pop();
    o._id = id; o._path = rel; if (!('id' in o)) o.id = id;
    if (d.updateTime) o._ut = Date.parse(d.updateTime);
    return o;
  }
  // `roles.<uid>` / `fn.<id>`: quote every segment that is not a plain identifier.
  const fp = (...segs) => segs.map((s) => (/^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : '`' + String(s).replace(/[`\\]/g, (c) => '\\' + c) + '`')).join('.');

  function mapStatus(status, body, fallback) {
    const st = (body && body.error && (body.error.status || body.error.message)) || '';
    // Server messages can name documents (and so event codes): never pass a path on (codes stay out of logs).
    const msg = String((body && body.error && body.error.message) || fallback || `HTTP ${status}`).replace(/projects\/\S+/g, '…').replace(/\b(events|es)\/[A-Z2-9]{6}\S*/g, '…');
    if (status === 429 || /RESOURCE_EXHAUSTED/.test(st)) { noteQuota(); return err('QUOTA', status, msg); }
    if (status === 403 || /PERMISSION_DENIED/.test(st)) return err('DENIED', status, msg);
    if (status === 404 || /NOT_FOUND/.test(st)) return err('NOT_FOUND', status, msg);
    if (status === 409 && /ABORTED/.test(st)) return err('BUSY', status, msg);
    if (status === 409 || /ALREADY_EXISTS/.test(st)) return err('TAKEN', status, msg);
    if (status === 412) return err('BUSY', status, msg);
    if (status >= 500 || status === 0) return err('OFFLINE', status, msg);
    return err('DENIED', status, msg);
  }

  // auth: true (staff, signs in if needed), 'opt' (attach when already signed in), false (never; guest pages).
  async function fsFetch(method, url, body, opts = {}) {
    const mode = opts.auth === undefined ? false : opts.auth;
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (mode === true || (mode === 'opt' && staffUid())) {
        try { headers.Authorization = `Bearer ${await token(attempt > 0)}`; } catch (e) { if (mode === true) throw e; }
      }
      let r, text;
      const t0 = Date.now();
      try {
        r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
        text = await r.text();
      } catch (e) { throw err('OFFLINE', 0, 'No connection'); }
      meter.ef += text.length / 1024;
      let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      if (r.status === 401 && headers.Authorization && attempt === 0) continue;
      if (!r.ok) throw mapStatus(r.status, json);
      opts.t0 = t0; opts.t1 = Date.now();
      return json;
    }
    throw err('DENIED', 401, 'Sign-in expired');
  }

  const fs = {
    ts: (ms) => new FsTs(ms),
    ref: (path) => new FsRef(path),
    enc: (obj) => enc(obj),
    dec: (fields) => dec(fields),
    fp,
    async get(path, opts = {}) {
      const q = (opts.mask || []).map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      try {
        const d = await fsFetch('GET', `${FS_URL()}/${path}${q ? '?' + q : ''}`, undefined, opts);
        meter.r += 1;
        return docOut(d);
      } catch (e) { if (e.code === 'NOT_FOUND') { meter.r += 1; return null; } throw e; }
    },
    async batchGet(paths, opts = {}) {
      const out = [];
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100), names = chunk.map((p) => `${DOCS()}/${p}`);
        const body = { documents: names };
        if (opts.mask) body.mask = { fieldPaths: opts.mask };
        const res = await fsFetch('POST', `${FS_URL()}:batchGet`, body, opts);
        const by = new Map();
        (Array.isArray(res) ? res : []).forEach((x) => { if (x.found) by.set(x.found.name, docOut(x.found)); });
        meter.r += chunk.length;
        names.forEach((n) => out.push(by.get(n) || null));
      }
      return out;
    },
    buildQuery(o) {
      const OPS = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN',
        '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'not-in': 'NOT_IN', 'array-contains': 'ARRAY_CONTAINS' };
      const last = (f) => String(f).split('.').pop().replace(/`/g, '');
      const sq = { from: [{ collectionId: o.from }] };
      const filters = (o.where || []).map(([f, op, v]) => {
        if (!OPS[op]) throw err('DENIED', 0, `Unknown operator ${op}`);
        return { fieldFilter: { field: { fieldPath: f }, op: OPS[op], value: encVal(v, last(f), false) } };
      });
      if (filters.length === 1) sq.where = filters[0];
      else if (filters.length) sq.where = { compositeFilter: { op: 'AND', filters } };
      if (o.orderBy && o.orderBy.length) sq.orderBy = o.orderBy.map(([f, d]) => ({ field: { fieldPath: f }, direction: d === 'desc' ? 'DESCENDING' : 'ASCENDING' }));
      if (o.select) sq.select = { fields: o.select.map((f) => ({ fieldPath: f })) };
      if (o.startAfter) sq.startAt = { values: o.startAfter.map((v) => encVal(v, '', true)), before: false };
      if (o.limit) sq.limit = o.limit;
      return sq;
    },
    async query(parent, o = {}) {
      const url = parent ? `${FS_URL()}/${parent}:runQuery` : `${FS_URL()}:runQuery`;
      const res = await fsFetch('POST', url, { structuredQuery: fs.buildQuery(o) }, o);
      const docs = (Array.isArray(res) ? res : []).filter((x) => x.document).map((x) => docOut(x.document));
      meter.r += Math.max(1, docs.length);
      return docs;
    },
    async aggregate(parent, o = {}) {
      const url = parent ? `${FS_URL()}/${parent}:runAggregationQuery` : `${FS_URL()}:runAggregationQuery`;
      const aggregations = Object.entries(o.aggs || {}).map(([alias, a]) => (a[0] === 'count' ? { alias, count: {} } : { alias, sum: { field: { fieldPath: a[1] } } }));
      const sq = fs.buildQuery({ from: o.from, where: o.where });
      const res = await fsFetch('POST', url, { structuredAggregationQuery: { structuredQuery: sq, aggregations } }, o);
      meter.r += 1;
      const r0 = (Array.isArray(res) ? res : []).find((x) => x.result) || { result: { aggregateFields: {} } };
      const out = {};
      for (const alias of Object.keys(o.aggs || {})) { const v = decVal((r0.result.aggregateFields || {})[alias]); out[alias] = typeof v === 'number' ? v : 0; }
      return out;
    },
    async commit(writes, opts = {}) {
      if (!writes.length) return { commitTime: clock.now(), writeResults: [] };
      const o = Object.assign({}, opts);
      const res = await fsFetch('POST', `${FS_URL()}:commit`, { writes }, o);
      writes.forEach((w) => { if (w.delete) meter.x += 1; else meter.w += 1; });
      const ct = res && res.commitTime ? Date.parse(res.commitTime) : 0;
      if (ct) noteServerTime(ct, o.t0, o.t1, 'commit');
      return { commitTime: ct || clock.now(), writeResults: (res && res.writeResults) || [] };
    },
    w: {
      // A create: {exists:false} precondition; opts.serverTime lists fields set to REQUEST_TIME.
      create(path, obj, opts = {}) {
        const w = { update: { name: `${DOCS()}/${path}`, fields: enc(obj) }, currentDocument: { exists: false } };
        const tr = transforms(opts); if (tr.length) w.updateTransforms = tr;
        return w;
      },
      // An update. opts.mask: field paths to write (absent from obj = delete); without a mask the doc is replaced.
      // opts.exists: true (default when a mask is given) / false / null (no precondition). opts.append {field:[values]},
      // opts.inc {field:n}, opts.serverTime [fields].
      update(path, obj, opts = {}) {
        const st = new Set(opts.serverTime || []);
        const fields = {};
        for (const [k, v] of Object.entries(enc(obj))) if (!st.has(k)) fields[k] = v;
        const w = { update: { name: `${DOCS()}/${path}`, fields } };
        if (opts.mask) w.updateMask = { fieldPaths: opts.mask.filter((f) => !st.has(f)) };
        const ex = opts.exists === undefined ? (opts.mask ? true : null) : opts.exists;
        if (ex !== null) w.currentDocument = { exists: !!ex };
        const tr = transforms(opts); if (tr.length) w.updateTransforms = tr;
        return w;
      },
      del(path, opts = {}) {
        const w = { delete: `${DOCS()}/${path}` };
        if (opts.exists !== undefined) w.currentDocument = { exists: !!opts.exists };
        return w;
      },
    },
  };
  function transforms(opts) {
    const tr = [];
    (opts.serverTime || []).forEach((f) => tr.push({ fieldPath: f, setToServerValue: 'REQUEST_TIME' }));
    Object.entries(opts.append || {}).forEach(([f, vals]) => tr.push({ fieldPath: f, appendMissingElements: { values: vals.map((v) => encVal(v, '', true)) } }));
    Object.entries(opts.inc || {}).forEach(([f, n]) => tr.push({ fieldPath: f, increment: { integerValue: String(n) } }));
    return tr;
  }

  // ================================================================================================= RTDB (REST) ===
  async function dbReq(method, path, body, opts = {}) {
    const mode = opts.auth === undefined ? false : opts.auth;
    for (let attempt = 0; attempt < 2; attempt++) {
      const q = [];
      if (mode === true || (mode === 'opt' && staffUid())) {
        try { q.push(`auth=${encodeURIComponent(await token(attempt > 0))}`); } catch (e) { if (mode === true) throw e; }
      }
      for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined && v !== null) q.push(`${k}=${encodeURIComponent(v)}`);
      const clean = String(path || '').replace(/^\/+|\/+$/g, '');
      const url = (clean ? `${RTDB()}/${clean}.json` : `${RTDB()}/.json`) + (q.length ? '?' + q.join('&') : '');
      const headers = Object.assign({}, opts.headers || {});
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      let r, text;
      const t0 = Date.now();
      try {
        r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
        text = await r.text();
      } catch (e) { throw err('OFFLINE', 0, 'No connection'); }
      meter.er += text.length / 1024;
      let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      if (r.status === 401 && q.length && attempt === 0 && /expired|token/i.test(String(json && json.error))) continue;
      if (!r.ok) {
        const msg = String((json && json.error) || `HTTP ${r.status}`);
        if (r.status === 401 || r.status === 403) throw err('DENIED', r.status, msg);
        if (r.status === 412) { const e = err('BUSY', 412, msg); e.etag = r.headers.get('etag'); throw e; }
        if (r.status === 429 || /too many/i.test(msg)) { noteQuota(); throw err('QUOTA', r.status, msg); }
        if (r.status === 404) throw err('NOT_FOUND', 404, msg);
        if (r.status >= 500) throw err('OFFLINE', r.status, msg);
        throw err('DENIED', r.status, msg);
      }
      if (opts.etagOut) opts.etagOut.etag = r.headers.get('etag');
      opts.t0 = t0; opts.t1 = Date.now();
      return json;
    }
    throw err('DENIED', 401, 'Sign-in expired');
  }
  let incWorks = null; // does the server accept {".sv":{"increment":1}} where the rules want exactly +1?
  const db = {
    get(path, o = {}) {
      const query = {};
      if (o.shallow) query.shallow = 'true';
      if (o.orderBy) query.orderBy = JSON.stringify(o.orderBy);
      if (o.startAt !== undefined) query.startAt = JSON.stringify(o.startAt);
      if (o.endAt !== undefined) query.endAt = JSON.stringify(o.endAt);
      if (o.limitToFirst) query.limitToFirst = o.limitToFirst;
      if (o.limitToLast) query.limitToLast = o.limitToLast;
      return dbReq('GET', path, undefined, { auth: o.auth, query });
    },
    put: (path, v, o = {}) => dbReq('PUT', path, v, { auth: o.auth, headers: o.headers }),
    patch: (path, obj, o = {}) => dbReq('PATCH', path, obj, { auth: o.auth }),
    del: (path, o = {}) => dbReq('DELETE', path, undefined, { auth: o.auth, headers: o.headers }),
    inc: (n = 1) => ({ '.sv': { increment: n } }),
    ts: () => ({ '.sv': 'timestamp' }),
    // +1 on a counter. Server-value increment first; if the rules evaluate the unresolved value (unverified, §2.6),
    // fall back to GET with an ETag and a conditional PUT of v+1, up to 3 times.
    async bump(path, o = {}) {
      if (incWorks !== false) {
        try { await dbReq('PUT', path, { '.sv': { increment: 1 } }, { auth: o.auth }); incWorks = true; return; } catch (e) { if (e.code !== 'DENIED' || incWorks === true) throw e; }
      }
      for (let i = 0; i < 3; i++) {
        const tag = {};
        const v = await dbReq('GET', path, undefined, { auth: o.auth, headers: { 'X-Firebase-ETag': 'true' }, etagOut: tag });
        if (!tag.etag) throw err('DENIED', 0, 'Counter refused');
        try {
          await dbReq('PUT', path, (typeof v === 'number' ? v : 0) + 1, { auth: o.auth, headers: { 'if-match': tag.etag } });
          incWorks = false; return;
        } catch (e) { if (e.status !== 412) throw e; }
      }
      throw err('BUSY', 412, 'Counter busy');
    },
  };

  // ========================================================================================================= cfg ===
  const CFG_KEY = 'luts:es-cfg';
  let cfgLast = null, cfgLastAt = -1;
  // `at` is when the values were fetched: an older copy (a cache read racing a fresh fetch) never wins.
  function mergeCfg(v, at = Date.now()) {
    if (cfgLast && at < cfgLastAt) return cfgLast;
    const base = CFG(); v = v || {};
    const out = Object.assign({}, base, {
      pause: !!v.pause, play: !!v.play, face: !!v.face, shop: !!(v.shop || base.shop), worker: String(v.worker || base.worker || ''),
      r2: !!(v.r2 || base.r2), msg: String(v.msg || ''), reel: v.reel !== false && base.reel !== false, b: Object.assign({}, base.budgets || {}, v.b || {}),
    });
    cfgLast = out; cfgLastAt = at; gov.pause = out.pause; setGovLevel();
    return out;
  }
  async function cfg(o = {}) {
    const maxAge = o.fresh ? 0 : (o.maxAge === undefined ? 10 * MIN : o.maxAge);
    const c = lsGet(CFG_KEY);
    if (c && c.v && Date.now() - c.at < maxAge) return mergeCfg(c.v, c.at);
    try {
      const at = Date.now();
      const v = await db.get('es_cfg');
      lsSet(CFG_KEY, { at, v: v || {} });
      return mergeCfg(v, at);
    } catch (e) {
      if (c && c.v) return mergeCfg(c.v, c.at);
      const out = mergeCfg({}); out.stale = true; return out;
    }
  }
  cfg.cached = () => cfgLast || mergeCfg((lsGet(CFG_KEY) || {}).v, (lsGet(CFG_KEY) || {}).at || 0);

  // ===================================================================================================== IndexedDB ===
  const IDB_NAME = 'luts-es', STORES = ['queue', 'blobs', 'pages', 'mine', 'exp', 'cursors'];
  // The open is retried after a failure, a 4 s timeout or the browser closing the database (a failed open is never
  // cached for good). While IndexedDB is unusable the stores live in memory; the next good open moves them over.
  let idbP = null;
  const memStores = new Map(STORES.map((s) => [s, new Map()]));
  const IDB_OPEN_MS = 4000;
  async function idbMigrate(d) {
    for (const [store, m] of memStores) {
      if (!m.size) continue;
      const rows = [...m.entries()]; m.clear();
      try {
        await new Promise((resolve, reject) => {
          const t = d.transaction(store, 'readwrite');
          t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('aborted'));
          const os = t.objectStore(store);
          rows.forEach(([k, v]) => os.put(v, k));
        });
      } catch (e) { rows.forEach(([k, v]) => { if (!m.has(k)) m.set(k, v); }); }
    }
  }
  const idb = {
    open() {
      if (idbP) return idbP;
      const p = new Promise((resolve) => {
        let done = false;
        const finish = (d) => {
          if (done) { if (d) { try { d.close(); } catch (e) { /* late */ } } return; }
          done = true; clearTimeout(timer);
          if (!d && window.indexedDB && idbP === p) idbP = null; // try again next time
          if (d) {
            d.onclose = () => { if (idbP === p) idbP = null; };
            d.onversionchange = () => { try { d.close(); } catch (e) { /* closing */ } if (idbP === p) idbP = null; };
            idbMigrate(d).then(() => resolve(d), () => resolve(d));
          } else resolve(null);
        };
        const timer = setTimeout(() => finish(null), IDB_OPEN_MS);
        try {
          if (!window.indexedDB) return finish(null);
          const r = indexedDB.open(IDB_NAME, 1);
          r.onupgradeneeded = () => { STORES.forEach((s) => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }); };
          r.onsuccess = () => finish(r.result);
          r.onerror = () => finish(null);
          r.onblocked = () => finish(null);
        } catch (e) { finish(null); }
      });
      idbP = p;
      return p;
    },
    // Run fn(d) on an open database; a database closed under us (InvalidStateError) is reopened once.
    async with(fn) {
      for (let i = 0; i < 2; i++) {
        const d = await idb.open();
        if (!d) return fn(null);
        try { return await fn(d); } catch (e) {
          if (i === 0 && e && (e.name === 'InvalidStateError' || e.name === 'TransactionInactiveError')) { if (idbP) idbP = null; continue; }
          throw e;
        }
      }
      return fn(null);
    },
    tx(store, mode, fn) {
      return idb.with((d) => {
        if (!d) return fn(null);
        return new Promise((resolve, reject) => {
          let out;
          const t = d.transaction(store, mode);
          t.oncomplete = () => resolve(out);
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error || new Error('aborted'));
          out = fn(t.objectStore(store));
        });
      });
    },
    put(store, key, val) {
      return idb.with(async (d) => {
        if (!d) { memStores.get(store).set(key, val); return; }
        await new Promise((resolve, reject) => {
          const t = d.transaction(store, 'readwrite');
          t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('aborted'));
          t.objectStore(store).put(val, key);
        });
        memStores.get(store).delete(key);
      });
    },
    get(store, key) {
      return idb.with((d) => {
        if (!d || memStores.get(store).has(key)) return memStores.get(store).get(key);
        return new Promise((resolve, reject) => {
          const r = d.transaction(store, 'readonly').objectStore(store).get(key);
          r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
        });
      });
    },
    del(store, key) {
      return idb.with(async (d) => {
        memStores.get(store).delete(key);
        if (!d) return;
        await new Promise((resolve, reject) => {
          const t = d.transaction(store, 'readwrite');
          t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('aborted'));
          t.objectStore(store).delete(key);
        });
      });
    },
    list(store, prefix = '') {
      const mem = () => [...memStores.get(store).entries()].filter(([k]) => String(k).startsWith(prefix)).map(([key, value]) => ({ key, value }));
      return idb.with((d) => {
        if (!d) return mem();
        return new Promise((resolve, reject) => {
          const out = mem(), seen = new Set(out.map((x) => x.key));
          const range = prefix ? IDBKeyRange.bound(prefix, prefix + '￿') : undefined;
          const r = d.transaction(store, 'readonly').objectStore(store).openCursor(range);
          r.onsuccess = () => { const c = r.result; if (c) { if (!seen.has(c.key)) out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out); };
          r.onerror = () => reject(r.error);
        });
      });
    },
  };

  // ====================================================================================================== pub mirror ===
  const pubCache = new Map(); // code -> {at, pub}
  const JSON_PUB = ['cap', 'ft', 'fns', 'ms', 'an', 'dp'];
  function decodePub(p) {
    if (!p || typeof p !== 'object') return null;
    const o = Object.assign({}, p);
    for (const k of JSON_PUB) { try { o[k] = typeof p[k] === 'string' ? JSON.parse(p[k]) : (p[k] || null); } catch (e) { o[k] = null; } }
    o.cap = o.cap || {}; o.ft = o.ft || {}; o.fns = o.fns || []; o.ms = o.ms || []; o.an = o.an || []; o.dp = o.dp || { on: false, at: 0, sh: 0 };
    o.fi = o.fns.map((f) => f.id);
    return o;
  }
  function pubFromEvent(e, gk) {
    const p = {
      v: 2, t: e.title, n: e.names || '', w: e.world, l: e.lang, tz: e.tz, tp: e.tpl, pl: e.plan, vf: !!e.vf, mk: !!(e.cap && e.cap.mk),
      ap: !!e.approve, o: e.opensAt, c: e.closesAt, fu: e.fu, x: e.expiresAt,
      cap: JSON.stringify(e.cap), ft: JSON.stringify(e.ft || {}), fns: JSON.stringify(e.fns || []), ms: JSON.stringify(e.ms || []),
      an: JSON.stringify(e.an || []), dp: JSON.stringify(e.dp || { on: false, at: 0, sh: 0 }), nt: e.nt || '', ct: e.ct || '',
    };
    if (e.logo && e.logo.length) p.logo = `data:${sniffImage(e.logo)};base64,${b64enc(e.logo)}`;
    if (gk) p.gk = gk;
    const LIM = { cap: 400, ft: 200, fns: 1200, ms: 1600, an: 3200, dp: 120 };
    for (const [k, n] of Object.entries(LIM)) if (p[k].length > n) throw err('DENIED', 0, `Too much text in ${k} for the guest page (${p[k].length} > ${n})`);
    if (p.logo && p.logo.length > 56000) throw err('DENIED', 0, 'Logo too large');
    return p;
  }
  function sniffImage(u8) {
    if (u8[0] === 0x89 && u8[1] === 0x50) return 'image/png';
    if (u8[0] === 0xff && u8[1] === 0xd8) return 'image/jpeg';
    if (u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57) return 'image/webp';
    return 'image/png';
  }
  const pub = {
    async get(code, o = {}) {
      if (!CODE_RE.test(code)) return null;
      const c = pubCache.get(code);
      if (c && o.maxAge && Date.now() - c.at < o.maxAge) return c.pub;
      const p = decodePub(await db.get(`es/${code}/pub`));
      if (p) pubCache.set(code, { at: Date.now(), pub: p }); else pubCache.delete(code);
      return p;
    },
    cached: (code) => (pubCache.get(code) || {}).pub || null,
  };

  // ====================================================================================================== bell watch ===
  // §4.20 cadence: [busy, idle (10 min with no change), before opensAt, tab hidden (0 = paused)]; guest has a 'normal'.
  const CADENCE = {
    wall: { busy: 2e3, idle: 5e3, pre: 30e3, hidden: 30e3 },
    mod: { busy: 3e3, idle: 6e3, pre: 60e3, hidden: 0 },
    host: { busy: 5e3, idle: 15e3, pre: 60e3, hidden: 0 },
    guest: { busy: 5e3, normal: 20e3, idle: 30e3, pre: 60e3, hidden: 0 },
    gallery: { busy: 60e3, idle: 120e3, pre: 120e3, hidden: 0 },
  };
  const bell = {
    CADENCE,
    ring(code, key) {
      if (!BELL_KEYS.includes(key) || key.length !== 1) return Promise.reject(err('DENIED', 0, `Unknown bell ${key}`));
      return db.bump(`es/${code}/b/${key}`, { auth: !GUEST_BELLS.includes(key) });
    },
    watch(code, opts = {}) {
      const mode = CADENCE[opts.mode] ? opts.mode : 'guest';
      const cad = CADENCE[mode];
      let last = null, first = true, lastChange = Date.now(), lastAction = mode === 'guest' ? 0 : Date.now();
      let errors = 0, timer = null, stopped = false, inflight = null, opensAt = +opts.opensAt || 0, polls = 0, lastLevel = gov.level;
      let lastGov = 0;
      const hidden = () => typeof document !== 'undefined' && document.hidden;
      function interval() {
        if (hidden()) return cad.hidden;
        const now = Date.now();
        let base;
        if (opensAt && clock.now() < opensAt) base = cad.pre;
        else if (mode === 'guest') base = now - lastAction < 120e3 ? cad.busy : (now - lastChange > 600e3 ? cad.idle : cad.normal);
        else base = now - lastChange > 600e3 ? cad.idle : cad.busy;
        if (gov.level >= 2) base *= 2;
        if (gov.level >= 3) base = Math.max(base, 60e3);
        if (errors) base = Math.min(60e3, Math.max(base, cad.busy * Math.pow(2, errors)));
        return Math.round(base * (0.8 + Math.random() * 0.4));
      }
      function schedule() {
        clearTimeout(timer); timer = null;
        if (stopped) return;
        const ms = interval();
        if (!ms) return; // paused while hidden; visibilitychange resumes
        timer = setTimeout(tick, ms);
      }
      async function maybeGov() {
        if (Date.now() - lastGov < 5 * MIN) return;
        lastGov = Date.now();
        try { await (mode === 'guest' || mode === 'gallery' || !staffUid() ? cfg({ maxAge: 5 * MIN }) : govRefresh()); } catch (e) { /* keep the last level */ }
      }
      async function poll() {
        if (inflight) return inflight;
        inflight = (async () => {
          try {
            const b = (await db.get(`es/${code}/b`)) || {};
            polls++; errors = 0;
            const changed = Object.keys(Object.assign({}, b, last || {})).filter((k) => (last || {})[k] !== b[k]);
            const isFirst = first; first = false;
            if (changed.length) lastChange = Date.now();
            last = b;
            if ((changed.length || isFirst) && opts.onChange) { try { opts.onChange(changed, b, { first: isFirst }); } catch (e) { /* the page's handler */ } }
          } catch (e) {
            errors = Math.min(errors + 1, 6);
            if (opts.onError) { try { opts.onError(e); } catch (x) { /* ignore */ } }
          }
          maybeGov();
          if (gov.level !== lastLevel) { lastLevel = gov.level; if (opts.onGov) { try { opts.onGov(gov.level); } catch (e) { /* ignore */ } } }
        })().finally(() => { inflight = null; });
        return inflight;
      }
      async function tick() { await poll(); schedule(); }
      const onVis = () => { if (stopped) return; if (!hidden()) { clearTimeout(timer); tick(); } else schedule(); };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
      const onGovEv = () => { if (gov.level !== lastLevel) { lastLevel = gov.level; if (opts.onGov) { try { opts.onGov(gov.level); } catch (e) { /* ignore */ } } schedule(); } };
      window.addEventListener('es:gov', onGovEv);
      if (!hidden() || cad.hidden) tick(); else schedule();
      return {
        stop() { stopped = true; clearTimeout(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); window.removeEventListener('es:gov', onGovEv); },
        poke() { lastAction = Date.now(); clearTimeout(timer); return tick(); },
        busy() { lastAction = Date.now(); schedule(); return interval(); },
        setOpensAt(ms) { opensAt = +ms || 0; schedule(); },
        level: () => gov.level,
        state: () => ({ mode, polls, errors, interval: interval(), last, hidden: hidden(), inflight: !!inflight }),
      };
    },
  };

  // =================================================================================================== governor ===
  const qday = (ms) => Math.floor((ms - 8 * HOUR) / DAY); // the Spark quota day (midnight Pacific)
  const utcDay = (ms) => Math.floor(ms / DAY);
  function reservation(plan, guests) {
    const ex = EXPECT[plan] || EXPECT.free, cp = caps(plan, true) || caps('free', true);
    const sc = clamp((+guests || cp.lim) / cp.lim, 0.3, 1);
    return { rd: Math.round(ex.rd * sc), eg: Math.round(ex.eg * sc), st: Math.round(ex.st * sc) };
  }
  const monthOf = (ms) => { const d = new Date(ms); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  async function dateCheck(o = {}) {
    const c = await cfg({ maxAge: MIN });
    if (c.pause) return { ok: false, reason: 'PAUSED' };
    const plan = PLANS[o.plan] ? o.plan : 'free';
    const now = clock.now();
    if (plan === 'free' && lsGet('luts:es-free-full') === utcDay(now)) return { ok: false, reason: 'FREE_FULL' };
    // this account's 3 free events a day (es_day_u): said at the date check, not only when the event is made
    if (plan === 'free') { const mine = lsGet(DAYU_KEY, null); if (mine && mine.u === staffUid() && mine.d === utcDay(now) && mine.n >= DAYU_MAX) return { ok: false, reason: 'DAY_MAX' }; }
    const need = reservation(plan, o.guests);
    const opensAt = +o.opensAt || now, closesAt = +o.closesAt || opensAt + HOUR;
    let all;
    try { all = (await db.get('es_gov', { auth: true })) || {}; } catch (e) { if (e.code === 'OFFLINE' || e.code === 'QUOTA') throw e; return { ok: false, reason: 'BOOKED_DAY' }; } // fail closed
    const b = c.b || {};
    // Only entries the rules bound to a slot (c) count; before refusing, the entries that would cause the refusal are
    // checked against their event's public mirror and dropped when that event is gone (a leftover or a planted entry).
    const entries = Object.entries(all).filter(([k, g]) => g && typeof g === 'object' && CODE_RE.test(String(g.c || '')) && String(k) !== String(o.except));
    const dead = new Set(), checked = new Set();
    const verdict = () => {
      const live = entries.filter(([k]) => !dead.has(k));
      const list = live.filter(([, g]) => +g.x > now);
      for (let d = qday(opensAt); d <= qday(closesAt); d++) {
        const hit = list.filter(([, g]) => g.d0 <= d && d <= g.d1);
        const sum = need.rd + hit.reduce((a, [, g]) => a + (+g.rd || 0), 0);
        if (b.rd && sum > 0.9 * b.rd) return { reason: 'BOOKED_DAY', hit };
      }
      const st = list.filter(([, g]) => +g.fu > opensAt);
      if (b.st && need.st + st.reduce((a, [, g]) => a + (+g.st || 0), 0) > 0.9 * b.st) return { reason: 'BOOKED_DAY', hit: st };
      const mo = monthOf(opensAt);
      const eg = live.filter(([, g]) => monthOf((+g.d0 || 0) * DAY + 8 * HOUR) === mo);
      if (b.eg && need.eg + eg.reduce((a, [, g]) => a + (+g.eg || 0), 0) > 0.9 * b.eg) return { reason: 'BOOKED_MONTH', hit: eg };
      return null;
    };
    for (let round = 0; round < 3; round++) {
      const v = verdict();
      if (!v) return { ok: true, need };
      const todo = v.hit.filter(([k]) => !checked.has(k)).sort((x, y) => (+y[1].rd || 0) - (+x[1].rd || 0)).slice(0, 40);
      if (!todo.length) return { ok: false, reason: v.reason, need };
      await Promise.all(todo.map(async ([k, g]) => {
        checked.add(k);
        try { const x = await db.get(`es/${g.c}/pub/x`); if (!(typeof x === 'number' && x > now)) dead.add(k); } catch (e) { /* unknown: keep counting it */ }
      }));
    }
    const v = verdict();
    return v ? { ok: false, reason: v.reason, need } : { ok: true, need };
  }
  async function govRefresh() {
    const c = await cfg({ maxAge: 5 * MIN });
    if (staffUid()) {
      try {
        const now = clock.now(), today = utcDay(now), d = new Date(now);
        const first = utcDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        const m = (await db.get('es_meter', { auth: true, orderBy: '$key', startAt: String(first) })) || {};
        const t = m[String(today)] || {};
        gov.reads = +t.r || 0;
        gov.egressMB = Object.entries(m).filter(([k]) => +k >= first).reduce((a, [, v]) => a + (+v.ef || 0) + (+v.er || 0), 0) / 1024;
      } catch (e) { /* keep the last numbers */ }
    }
    gov.at = Date.now(); gov.pause = !!(cfgLast || c).pause;
    setGovLevel();
    return gov.level;
  }
  const METER_MAX = 20000;
  const govApi = {
    state: () => ({ level: gov.level, reads: gov.reads, egressMB: Math.round(gov.egressMB * 10) / 10 }),
    refresh: govRefresh,
    // Add measured usage to es_meter/{day} (the lease-holding wall calls this every 5 minutes with ES.gov.take()).
    // The rules take one update per account every 4 minutes (es_mt/{uid} = now) and at most 20,000 per counter.
    async meter(m = {}) {
      const uid = await ensureStaff();
      const day = utcDay(clock.now()), upd = {};
      for (const k of ['r', 'w', 'x', 'ef', 'er']) { const n = Math.round(+m[k] || 0); if (n > 0) upd[`es_meter/${day}/${k}`] = db.inc(Math.min(n, METER_MAX)); }
      if (!Object.keys(upd).length) return;
      upd[`es_mt/${uid}`] = db.ts();
      await db.patch('', upd, { auth: true });
    },
    take() { const out = { r: meter.r, w: meter.w, x: meter.x, ef: Math.round(meter.ef), er: Math.round(meter.er) }; meter.r = meter.w = meter.x = meter.ef = meter.er = 0; return out; },
    reservation,
  };

  // ====================================================================================================== events ===
  const HOST_KEY = 'luts:es-host';
  const mineList = () => { const l = lsGet(HOST_KEY, []); return Array.isArray(l) ? l : []; };
  function remember(entry) {
    const l = mineList().filter((x) => x.code !== entry.code);
    l.unshift(Object.assign({ at: Date.now() }, entry));
    lsSet(HOST_KEY, l.slice(0, 50));
  }
  function forget(code) { lsSet(HOST_KEY, mineList().filter((x) => x.code !== code)); }
  const evCache = new Map();
  async function getEvent(code, o = {}) {
    if (!CODE_RE.test(code)) throw err('NOT_FOUND', 0, 'Not an event code');
    const c = evCache.get(code);
    if (c && o.maxAge && Date.now() - c.at < o.maxAge) return c.e;
    const e = await fs.get(`events/${code}`, { auth: true });
    if (!e) { evCache.delete(code); throw err('NOT_FOUND', 404, 'No such event'); }
    e.code = code;
    evCache.set(code, { at: Date.now(), e });
    return e;
  }
  const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fmtKey = (rk) => String(rk || '').replace(/(.{4})(?=.)/g, '$1-');

  function normFns(list, fm) {
    const out = [], seen = new Set();
    for (const f of (Array.isArray(list) ? list : [])) {
      const n = clean(typeof f === 'string' ? f : f && f.n, 30);
      if (!n) continue;
      let id = String((f && f.id) || n.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      if (!id || seen.has(id)) id = randStr(6, 'abcdefghijkmnpqrstuvwxyz23456789');
      seen.add(id);
      const o = { id, n }; const at = +(f && f.at); if (at) o.at = Math.round(at);
      out.push(o);
      if (out.length >= fm) break;
    }
    return out;
  }
  function normMissions(list) {
    const out = [], seen = new Set();
    for (const m of (Array.isArray(list) ? list : [])) {
      const t = clean(typeof m === 'string' ? m : m && m.t, 80);
      if (!t) continue;
      let id = String((m && m.id) || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
      if (!id || seen.has(id)) id = randStr(6);
      seen.add(id); out.push({ id, t });
      if (out.length >= 12) break;
    }
    return out;
  }
  function normAnn(list) {
    return (Array.isArray(list) ? list : []).slice(0, 20).map((a) => ({
      id: String(a.id || randStr(8)).replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || randStr(8), t: clean(a.t != null ? a.t : a.text, 120),
      at: Math.round(+a.at || 0), st: (a.st || a.style) === 'f' ? 'f' : 'b', cd: clamp(Math.round(+a.cd || 0), 0, 900),
    })).filter((a) => a.t);
  }
  function normFt(ft, cap) {
    const f = Object.assign({ sx: false, vo: !!cap.vo, rs: !!cap.rs, gb: true, dl: true, vp: true, rx: true }, ft || {});
    const o = {};
    for (const k of ['sx', 'vo', 'rs', 'gb', 'dl', 'vp', 'rx']) o[k] = !!f[k];
    if (!cap.sx) o.sx = false; if (!cap.vo) o.vo = false; if (!cap.rs) o.rs = false;
    return o;
  }
  // The same checks as evShape() in the rules, so a mistake is reported here and not as a bare 403.
  function evShapeProblem(d) {
    const cp = d.cap || {};
    const str = (v, max) => typeof v === 'string' && v.length <= max;
    if (!str(d.title, 60) || !d.title) return 'title';
    if (!str(d.names, 40)) return 'names';
    if (typeof d.world !== 'string' || !/^[a-z-]{2,40}$/.test(d.world)) return 'world';
    if (!LANGS.includes(d.lang)) return 'lang';
    if (!str(d.tz, 40)) return 'tz';
    if (typeof d.approve !== 'boolean') return 'approve';
    if (![d.opensAt, d.closesAt, d.fu, d.expiresAt].every((x) => Number.isFinite(x))) return 'times';
    if (!TEMPLATES[d.tpl]) return 'tpl';
    if (!(d.closesAt > d.opensAt)) return 'closesAt';
    if (d.closesAt > d.opensAt + cp.wd * DAY) return 'window';
    if (d.createdAt && d.opensAt > d.createdAt + 200 * DAY) return 'opensAt';
    if (!(d.fu >= d.closesAt && d.fu <= d.closesAt + cp.fd * DAY)) return 'fu';
    if (!(d.expiresAt >= d.fu && d.expiresAt <= d.closesAt + cp.gd * DAY)) return 'expiresAt';
    if ((d.fns || []).length > cp.fm) return 'fns';
    if ((d.ms || []).length > 12 || (d.an || []).length > 20) return 'ms';
    if (!d.dp || d.dp.sh > cp.pg || d.dp.sh < 0) return 'dp';
    if (!str(d.nt, 300) || !str(d.ct, 80)) return 'nt';
    if (d.logo && (!cp.lg || d.logo.length > 40960)) return 'logo';
    if (Object.keys(d.roles || {}).length > 20) return 'roles';
    return '';
  }
  async function logoBytes(x, cp) {
    if (x == null) return null;
    if (!cp.lg) throw err('DENIED', 0, 'This plan has no logo');
    let u8 = await toBytes(x);
    if (u8.length <= 40960) return u8;
    // Too big: redraw at 256 px as PNG, then JPEG.
    const bmp = await createImageBitmap(new Blob([u8]));
    const s = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const [type, q] of [['image/png'], ['image/jpeg', 0.85], ['image/jpeg', 0.6]]) {
      const b = await new Promise((r) => cv.toBlob(r, type, q));
      if (b && b.size <= 40960) return new Uint8Array(await b.arrayBuffer());
    }
    throw err('DENIED', 0, 'Logo too large');
  }
  // The proof for a paid plan: the code's plan, or the pass's plan.
  async function checkCode(activationCode) {
    const ac = normCode(activationCode);
    if (ac.length < 6 || ac.length > 40) return null;
    const h = await sha256hex(ac);
    let d;
    try { d = await fs.get(`es_codes/${h}`); } catch (e) { if (e.code === 'DENIED' || e.code === 'NOT_FOUND') return null; throw e; }
    if (!d || !PLANS[d.pl]) return null;
    const used = Array.isArray(d.used) ? d.used : [];
    return { plan: d.pl, left: Math.max(0, (+d.n || 0) - used.length), ex: +d.ex || 0, n: +d.n || 0, used, ac, h };
  }
  async function codeOrThrow(activationCode) {
    const c = await checkCode(activationCode);
    if (!c) throw err('CODE_BAD', 0, "That isn't a valid code.");
    if (c.ex <= clock.now()) throw err('CODE_EXPIRED', 0, 'That code has expired.');
    if (c.left <= 0) throw err('CODE_USED', 0, 'That code has been used.');
    return c;
  }
  const SKU_PLAN = { es_event_pass: ['event', 1], es_shaadi_pass: ['shaadi', 1], es_planner_10: ['event', 10] };
  const TX_RE = /^(GPA\.[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{5}(\.\.[0-9]{1,3})?|pt_[0-9a-f]{40})$/;
  const passes = {
    // passes/{tx}: the Play order ledger. Created once per order (credits fixed by sku); vf only by a verifier.
    async record(tx, sku) {
      const uid = await ensureStaff();
      if (!TX_RE.test(String(tx))) throw err('DENIED', 0, 'Not a Play order id');
      const sp = SKU_PLAN[String(sku).split(':')[0]];
      if (!sp) throw err('DENIED', 0, 'Unknown product');
      try {
        await fs.commit([fs.w.create(`passes/${tx}`, { u: uid, sku: String(sku).split(':')[0], pl: sp[0], n: sp[1], used: [], vf: false }, { serverTime: ['at'] })], { auth: true });
      } catch (e) { if (e.code !== 'TAKEN' && e.code !== 'DENIED') throw e; }
      return passes.get(tx);
    },
    async get(tx) {
      try { return await fs.get(`passes/${tx}`, { auth: true }); } catch (e) { if (e.code === 'DENIED' || e.code === 'NOT_FOUND') return null; throw e; }
    },
  };
  // Until the verifier confirms an order (vf) it gives one provisional event, whatever the pack size (rules: passes).
  async function passOrThrow(proof) {
    let p = await passes.get(proof.tx);
    if (!p && proof.sku) p = await passes.record(proof.tx, proof.sku);
    if (!p) throw err('CODE_BAD', 0, 'No such pass on this account');
    if ((p.used || []).length >= p.n) throw err('CODE_USED', 0, 'This pass has been used.');
    if (!p.vf && (p.used || []).length >= 1) throw err('PENDING', 0, 'Your purchase is still being confirmed. The other events of this pack open up once it is (usually within a few hours).');
    return p;
  }
  // private/* and members/* carry an xp past any expiry the event can reach (rules farXp: 299 to 300 days ahead).
  const farXp = () => fs.ts(clock.now() + 300 * DAY - 12 * HOUR);

  // Claim an RTDB slot (es_slot/{n}) and es/{CODE}/own in one multi-path update; pick a new code if it is taken.
  async function claimSlot(uid, rk) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = Array.from({ length: 6 }, () => CODE_CHARS[randInt(CODE_CHARS.length)]).join('');
      let n = null, old = null;
      for (let p = 0; p < 16 && n === null; p++) {
        const cand = randInt(400);
        try { old = await db.get(`es_slot/${cand}`, { auth: true }); n = cand; } catch (e) { if (e.code !== 'DENIED') throw e; }
      }
      if (n === null) throw err('FULL', 0, 'Event Sky is full right now');
      const upd = { [`es/${code}/own`]: { h: uid, rk, sl: String(n), at: db.ts() }, [`es_slot/${n}`]: { c: code, u: uid, x: clock.now() + HOUR } };
      const tries = (old && old.c && old.c !== code) ? [Object.assign({ [`es/${old.c}`]: null }, upd), upd] : [upd];
      for (const u of tries) {
        const o = { auth: true };
        try {
          const t0 = Date.now();
          const res = await dbReq('PATCH', '', u, o);
          const at = res && res[`es/${code}/own`] && res[`es/${code}/own`].at;
          if (typeof at === 'number') noteServerTime(at, t0, Date.now(), 'rtdb');
          return { code, sl: n };
        } catch (e) { if (e.code !== 'DENIED') throw e; }
      }
    }
    throw err('BUSY', 0, 'Could not reserve an event code. Try again.');
  }
  async function rollbackSlot(code, sl) {
    try { await db.patch('', { [`es/${code}`]: null, [`es_slot/${sl}`]: null }, { auth: true }); } catch (e) { /* leftovers expire in an hour */ }
  }
  async function withRetry(fn, n = 3) {
    let last;
    for (let i = 0; i < n; i++) { try { return await fn(); } catch (e) { last = e; if (e.code === 'DENIED') throw e; await sleep(800 * (i + 1)); } }
    throw last;
  }
  // es_gov/{slot}: bound by the rules to the slot's code and expiry (c, x).
  function govEntry(e, need, code) {
    return { c: code || e.code, d0: qday(e.opensAt), d1: qday(e.closesAt), rd: clamp(need.rd, 0, 30000), eg: clamp(need.eg, 0, 4000), st: clamp(need.st, 0, 600), fu: e.fu, x: e.expiresAt };
  }
  // After a date change or an upgrade: move the slot's expiry and the governor entry (the whole entry, so it always
  // carries c), and take the slot over when this account recovered the event (rules: the tree's host may).
  async function moveSlot(code, e, need) {
    let own = null;
    try { own = await db.get(`es/${code}/own`, { auth: true }); } catch (x) { return; }
    if (!own || own.sl === undefined || own.sl === null) return;
    const uid = staffUid();
    let g = null;
    if (!need) { try { g = await db.get(`es_gov/${own.sl}`, { auth: true }); } catch (x) { g = null; } }
    const base = need || (g ? { rd: +g.rd || 0, eg: +g.eg || 0, st: +g.st || 0 } : reservation(e.plan, (e.cap || {}).lim));
    const upd = { [`es_slot/${own.sl}/x`]: e.expiresAt, [`es_slot/${own.sl}/u`]: uid, [`es_gov/${own.sl}`]: govEntry(e, base, code) };
    await withRetry(() => db.patch('', upd, { auth: true }));
  }

  // Build every write for a proof (es_day slot, private/plan, es_codes or passes spend) around the event write.
  function proofWrites(code, plan, info, kind) {
    const w = [];
    if (kind === 'code') {
      w.push(fs.w.update(`events/${code}/private/plan`, { ac: info.ac, xp: farXp() }, { serverTime: ['at'], exists: null }));
      w.push(fs.w.update(`es_codes/${info.h}`, {}, { mask: [], append: { used: [code] } }));
    } else if (kind === 'play') {
      w.push(fs.w.update(`events/${code}/private/plan`, { tx: info.tx, xp: farXp() }, { serverTime: ['at'], exists: null }));
      w.push(fs.w.update(`passes/${info.tx}`, {}, { mask: [], append: { used: [code] } }));
    }
    return w;
  }
  // Try the commit once per daily slot (free: 15, provisional Play: 10) in a random order. Each slot also counts on
  // this account's es_day_u/{uid}_{day} (3 a day; the increment makes a create or an update, l names the slot).
  const DAYU_KEY = 'luts:es-dayu', DAYU_MAX = 3;
  function dayCapCheck(uid) {
    const mine = lsGet(DAYU_KEY, null);
    if (mine && mine.u === uid && mine.d === utcDay(clock.now()) && mine.n >= DAYU_MAX) throw err('FULL', 0, 'You have made 3 events today. Try again tomorrow, or use an activation code.');
  }
  async function commitWithDaySlot(kind, max, uid, code, build) {
    const day = utcDay(clock.now());
    dayCapCheck(uid);
    let lastErr = null;
    for (const n of shuffled(range(max))) {
      const sl = `${kind}_${day}_${n}`;
      const writes = [fs.w.create(`es_day/${sl}`, { c: code, u: uid }, { serverTime: ['at'] }),
        fs.w.update(`es_day_u/${uid}_${day}`, { l: sl }, { mask: ['l'], exists: null, inc: { n: 1 }, serverTime: ['at'] })].concat(build(sl));
      try {
        await fs.commit(writes, { auth: true });
        const m2 = lsGet(DAYU_KEY, null);
        lsSet(DAYU_KEY, { u: uid, d: day, n: (m2 && m2.u === uid && m2.d === day ? m2.n : 0) + 1 });
        return sl;
      } catch (e) {
        if (e.code !== 'TAKEN' && e.code !== 'DENIED') throw e;
        lastErr = e;
      }
    }
    if (kind === 'f') lsSet('luts:es-free-full', day);
    throw err('FULL', lastErr ? lastErr.status : 0, kind === 'f' ? 'Fully booked for new free events today' : 'Fully booked for new passes today');
  }

  const events = {
    normCode, fmtKey,
    async create(o = {}) {
      const c = await cfg({ maxAge: MIN });
      if (c.pause) throw err('PAUSED', 0, 'Event Sky is paused for a moment');
      const uid = await ensureStaff();
      const proof = o.proof || { kind: 'none' };
      let plan = 'free', vf = true, pv = 'none', info = null;
      if (proof.kind === 'code') { info = await codeOrThrow(proof.code); plan = info.plan; pv = 'code'; }
      else if (proof.kind === 'play') {
        if (!c.play) throw err('DENIED', 0, 'Passes are not on sale yet');
        const p = await passOrThrow(proof); info = { tx: proof.tx }; plan = p.pl; vf = !!p.vf; pv = 'play';
      }
      const cap = caps(plan, vf);
      const now = clock.now();
      const tpl = TEMPLATES[o.tpl] ? o.tpl : 'party', T = TEMPLATES[tpl];
      const opensAt = Math.round(+o.opensAt || now), closesAt = Math.round(+o.closesAt || opensAt + 6 * HOUR);
      const gd = clamp(Math.round(+o.gd || cap.gd), 1, cap.gd);
      const expiresAt = closesAt + gd * DAY, fu = Math.min(closesAt + cap.fd * DAY, expiresAt);
      const fns = normFns(o.fns, cap.fm);
      const dpIn = o.dp || {};
      const dp = { on: !!dpIn.on, at: dpIn.on ? Math.round(+dpIn.at || closesAt) : 0, sh: clamp(Math.round(+dpIn.sh || (dpIn.on ? cap.pg : 0)), 0, cap.pg) };
      const rk = randStr(16, CODE_CHARS);
      const gk = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
      const doc = {
        v: 2, host: uid, plan, pv, vf, cap: Object.assign({}, cap), sl: '', tpl, title: clean(o.title, 60), names: clean(o.names, 40),
        world: (typeof o.world === 'string' && /^[a-z-]{2,40}$/.test(o.world)) ? o.world : T.world, lang: LANGS.includes(o.lang) ? o.lang : 'en',
        tz: clean(o.tz || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'), 40),
        approve: o.approve === undefined ? T.approve : !!o.approve, opensAt, closesAt, fu, expiresAt, xp: expiresAt,
        fns, fi: fns.map((f) => f.id), ms: normMissions(o.ms === undefined ? T.missions.slice(0, plan === 'free' ? 3 : 12) : o.ms),
        an: normAnn(o.an), dp, nt: clean(o.nt, 300), ct: clean(o.ct, 80), ft: normFt(o.ft, cap), roles: {},
        rkh: await sha256hex(rk), r2: !!(c.r2 && o.r2 !== false),
      };
      const logo = await logoBytes(o.logo, cap);
      if (logo) doc.logo = logo;
      const bad = evShapeProblem(Object.assign({ createdAt: now }, doc));
      if (bad) throw err('DENIED', 0, `Event settings out of range: ${bad}`);
      if (plan !== 'free' && !doc.ct) throw err('DENIED', 0, 'A contact for photo removal is required on paid plans');
      const check = await dateCheck({ plan, guests: o.guestsExpected || cap.lim, opensAt, closesAt });
      if (check.reason === 'DAY_MAX') throw err('FULL', 0, 'You have made 3 events today. Try again tomorrow, or use an activation code.');
      if (!check.ok) throw err(check.reason === 'PAUSED' ? 'PAUSED' : check.reason === 'FREE_FULL' ? 'FULL' : 'BOOKED', 0, check.reason);
      const pubDoc = pubFromEvent(doc, gk); // size checks before anything is written
      if (pv === 'none' || (pv === 'play' && !vf)) dayCapCheck(uid);

      const { code, sl } = await claimSlot(uid, rk);
      const build = (daySl) => {
        const d = Object.assign({}, doc, { sl: daySl || '' });
        return [
          fs.w.create(`events/${code}`, d, { serverTime: ['createdAt', 'updatedAt'] }),
          fs.w.create(`es_used/${code}`, { u: uid }, { serverTime: ['at'] }), // the code is never handed out again
          fs.w.create(`events/${code}/private/inv`, { c: '', m: '', p: '', w: '', xp: farXp() }, { serverTime: ['at'] }),
          fs.w.create(`events/${code}/private/key`, { k: gk, xp: farXp() }, { serverTime: ['at'] }),
        ].concat(proofWrites(code, plan, info, pv));
      };
      try {
        if (pv === 'none') doc.sl = await commitWithDaySlot('f', 15, uid, code, build);
        else if (pv === 'play' && !vf) doc.sl = await commitWithDaySlot('p', 10, uid, code, build);
        else {
          try { await fs.commit(build(''), { auth: true }); } catch (e) {
            if (e.code === 'DENIED') { const again = await checkCode(proof.code); if (!again || again.left <= 0) throw err('CODE_USED', e.status, 'That code has been used.'); }
            throw e;
          }
        }
      } catch (e) { await rollbackSlot(code, sl); throw e; }
      // Mirror for guests (pub), invite slots, slot expiry, governor reservation.
      await withRetry(() => db.patch('', {
        [`es/${code}/pub`]: pubDoc, [`es/${code}/inv/c`]: '', [`es/${code}/inv/m`]: '', [`es/${code}/inv/p`]: '', [`es/${code}/inv/w`]: '',
        [`es_slot/${sl}/x`]: expiresAt, [`es_gov/${sl}`]: govEntry(doc, check.need, code),
      }, { auth: true })).catch((e) => { remember({ code, title: doc.title, role: 'h', at: opensAt, fix: 1 }); throw e; });
      remember({ code, title: doc.title, role: 'h', at: opensAt });
      return { code, recoveryKey: fmtKey(rk) };
    },
    get: (code) => getEvent(code),
    async update(code, patch = {}) {
      const e = await getEvent(code);
      const uid = await ensureStaff();
      const cp = e.cap;
      const next = Object.assign({}, e);
      const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
      if (has('tpl') && TEMPLATES[patch.tpl]) next.tpl = patch.tpl;
      if (has('title')) next.title = clean(patch.title, 60);
      if (has('names')) next.names = clean(patch.names, 40);
      if (has('world') && typeof patch.world === 'string') next.world = patch.world;
      if (has('lang')) next.lang = patch.lang;
      if (has('tz')) next.tz = clean(patch.tz, 40);
      if (has('approve')) next.approve = !!patch.approve;
      for (const k of ['opensAt', 'closesAt', 'fu', 'expiresAt']) if (has(k)) next[k] = Math.round(+patch[k]);
      // Moving the event keeps the gallery length and the full-size length unless they are given.
      if (has('gd')) next.expiresAt = next.closesAt + clamp(Math.round(+patch.gd), 1, cp.gd) * DAY;
      else if (has('closesAt') && !has('expiresAt')) next.expiresAt = next.closesAt + (e.expiresAt - e.closesAt);
      if (!has('fu')) next.fu = Math.min(next.closesAt + Math.max(0, e.fu - e.closesAt), next.closesAt + cp.fd * DAY, next.expiresAt);
      next.expiresAt = Math.min(next.expiresAt, next.closesAt + cp.gd * DAY);
      if (!has('fu')) next.fu = Math.max(next.closesAt, Math.min(next.fu, next.expiresAt));
      next.xp = next.expiresAt;
      if (has('fns')) { next.fns = normFns(patch.fns, cp.fm); next.fi = next.fns.map((f) => f.id); }
      if (has('ms')) next.ms = normMissions(patch.ms);
      if (has('an')) next.an = normAnn(patch.an);
      if (has('dp')) { const d = patch.dp || {}; next.dp = { on: !!d.on, at: d.on ? Math.round(+d.at || next.closesAt) : 0, sh: clamp(Math.round(+d.sh || 0), 0, cp.pg) }; }
      if (has('nt')) next.nt = clean(patch.nt, 300);
      if (has('ct')) next.ct = clean(patch.ct, 80);
      if (has('ft')) next.ft = normFt(Object.assign({}, e.ft, patch.ft), cp);
      if (has('logo')) { if (patch.logo == null) delete next.logo; else next.logo = await logoBytes(patch.logo, cp); }
      const now = clock.now();
      if (now >= e.opensAt && next.opensAt !== e.opensAt) throw err('DENIED', 0, 'The opening time is fixed once the event has opened');
      const bad = evShapeProblem(next);
      if (bad) throw err('DENIED', 0, `Event settings out of range: ${bad}`);
      const keys = ['tpl', 'title', 'names', 'world', 'lang', 'tz', 'approve', 'opensAt', 'closesAt', 'fu', 'expiresAt', 'xp', 'fns', 'fi', 'ms', 'an', 'dp', 'nt', 'ct', 'logo', 'ft'];
      const changed = keys.filter((k) => !deepEq(next[k], e[k]));
      if (!changed.length) return;
      const body = {}; changed.forEach((k) => { if (next[k] !== undefined) body[k] = next[k]; });
      await fs.commit([fs.w.update(`events/${code}`, body, { mask: changed.concat(['updatedAt']), serverTime: ['updatedAt'] })], { auth: true });
      evCache.set(code, { at: Date.now(), e: next });
      // Mirror only what changed in pub.
      const p = pubFromEvent(next);
      const MAP = { title: 't', names: 'n', world: 'w', lang: 'l', tz: 'tz', tpl: 'tp', approve: 'ap', opensAt: 'o', closesAt: 'c', fu: 'fu', expiresAt: 'x', ft: 'ft', fns: 'fns', ms: 'ms', an: 'an', dp: 'dp', nt: 'nt', ct: 'ct', logo: 'logo' };
      const upd = {};
      changed.forEach((k) => { if (MAP[k]) upd[`es/${code}/pub/${MAP[k]}`] = p[MAP[k]] === undefined ? null : p[MAP[k]]; });
      await withRetry(() => db.patch('', upd, { auth: true }));
      // The slot and the governor entry follow the dates (a recovered host takes the slot over here).
      if (e.host === uid && ['opensAt', 'closesAt', 'fu', 'expiresAt'].some((k) => changed.includes(k))) await moveSlot(code, next, null).catch(() => {});
      pubCache.delete(code);
      const liveOnly = changed.every((k) => k === 'an');
      await bell.ring(code, liveOnly ? 'l' : 's').catch(() => {});
    },
    // Rewrite the whole pub mirror from the event (repairs a creation whose mirror failed).
    async mirror(code) {
      const e = await getEvent(code);
      let gk;
      if (clock.now() < e.closesAt + DAY) { try { gk = await gallery.key.get(code); } catch (x) { gk = undefined; } }
      await db.put(`es/${code}/pub`, pubFromEvent(e, gk), { auth: true });
      pubCache.delete(code);
      const l = mineList().map((x) => (x.code === code ? Object.assign({}, x, { fix: 0 }) : x)); lsSet(HOST_KEY, l);
      await bell.ring(code, 's').catch(() => {});
    },
    async upgrade(code, proof = {}, plan) {
      const uid = await ensureStaff();
      const e = await getEvent(code);
      if (e.host !== uid) throw err('DENIED', 403, 'Only the host can upgrade');
      let newPlan = plan, vf = true, pv = proof.kind, info = null;
      if (proof.kind === 'code') { info = await codeOrThrow(proof.code); newPlan = info.plan; }
      else if (proof.kind === 'play') {
        if (!(await cfg({ maxAge: MIN })).play) throw err('DENIED', 0, 'Passes are not on sale yet');
        const p = await passOrThrow(proof); info = { tx: proof.tx }; newPlan = p.pl; vf = !!p.vf;
      }
      else throw err('DENIED', 0, 'An upgrade needs a code or a pass');
      if (!(rank(newPlan) > rank(e.plan))) throw err('DENIED', 0, 'That is not an upgrade for this event');
      const cap = caps(newPlan, vf);
      const expiresAt = e.closesAt + cap.gd * DAY, fu = Math.min(e.closesAt + cap.fd * DAY, expiresAt);
      const next = Object.assign({}, e, { plan: newPlan, pv, vf, cap: Object.assign({}, cap), fu, expiresAt, xp: expiresAt });
      next.dp = Object.assign({}, e.dp, { sh: Math.min(e.dp.sh, cap.pg) });
      if (next.dp.sh !== e.dp.sh) throw err('DENIED', 0, 'Disposable shots exceed the new plan');
      const bad = evShapeProblem(next);
      if (bad) throw err('DENIED', 0, `Event settings out of range: ${bad}`);
      const mask = ['plan', 'pv', 'vf', 'cap', 'sl', 'fu', 'expiresAt', 'xp', 'updatedAt'];
      const build = (daySl) => [fs.w.update(`events/${code}`, { plan: newPlan, pv, vf, cap: next.cap, sl: daySl || '', fu, expiresAt, xp: expiresAt }, { mask, serverTime: ['updatedAt'] })]
        .concat(proofWrites(code, newPlan, info, pv));
      if (pv === 'play' && !vf) next.sl = await commitWithDaySlot('p', 10, uid, code, build);
      else { next.sl = ''; await fs.commit(build(''), { auth: true }); }
      evCache.set(code, { at: Date.now(), e: next });
      const p = pubFromEvent(next);
      const upd = { [`es/${code}/pub/pl`]: p.pl, [`es/${code}/pub/vf`]: p.vf, [`es/${code}/pub/mk`]: p.mk, [`es/${code}/pub/cap`]: p.cap, [`es/${code}/pub/fu`]: p.fu, [`es/${code}/pub/x`]: p.x, [`es/${code}/pub/ft`]: p.ft };
      await withRetry(() => db.patch('', upd, { auth: true }));
      await moveSlot(code, next, reservation(newPlan, cap.lim)).catch(() => {});
      pubCache.delete(code);
      if (clock.now() >= e.opensAt) await media.extend(code).catch(() => {});
      await bell.ring(code, 's').catch(() => {});
    },
    async verifyPlay(code) {
      const uid = await ensureStaff();
      const e = await getEvent(code);
      if (e.pv !== 'play' || e.vf) return !!e.vf;
      if (e.host !== uid) return false;
      const pd = await fs.get(`events/${code}/private/plan`, { auth: true });
      if (!pd || !pd.tx) return false;
      const ps = await passes.get(pd.tx);
      if (!ps || !ps.vf) return false;
      const cap = caps(e.plan, true);
      const fu = Math.min(e.closesAt + cap.fd * DAY, e.expiresAt);
      await fs.commit([fs.w.update(`events/${code}`, { vf: true, cap: Object.assign({}, cap), fu }, { mask: ['vf', 'cap', 'fu', 'updatedAt'], serverTime: ['updatedAt'] })], { auth: true });
      const next = Object.assign({}, e, { vf: true, cap: Object.assign({}, cap), fu });
      evCache.set(code, { at: Date.now(), e: next });
      const p = pubFromEvent(next);
      await withRetry(() => db.patch(`es/${code}/pub`, { vf: true, cap: p.cap, fu: p.fu, ft: p.ft }, { auth: true }));
      pubCache.delete(code);
      if (clock.now() >= e.opensAt) await media.extend(code).catch(() => {});
      await bell.ring(code, 's').catch(() => {});
      return true;
    },
    async recover(code, recoveryKey) {
      const uid = await ensureStaff();
      const rk = normCode(recoveryKey);
      if (rk.length !== 16) throw err('DENIED', 0, 'A host key has 16 letters and numbers');
      try {
        await fs.commit([
          fs.w.update(`events/${code}/members/${uid}`, { r: 'h', s: rk, xp: farXp() }, { serverTime: ['at'], exists: null }),
          fs.w.update(`events/${code}`, { host: uid }, { mask: ['host', 'updatedAt'], serverTime: ['updatedAt'] }),
        ], { auth: true });
      } catch (e) { if (e.code === 'DENIED' || e.code === 'NOT_FOUND') throw err('DENIED', e.status, 'That host key does not match this event'); throw e; }
      await withRetry(() => db.patch(`es/${code}/own`, { h: uid, rc: rk }, { auth: true }));
      // The RTDB slot and governor entry move to this account too, so dates and upgrades keep working.
      try {
        const own = await db.get(`es/${code}/own`, { auth: true });
        if (own && own.sl !== undefined && own.sl !== null) await withRetry(() => db.patch('', { [`es_slot/${own.sl}/u`]: uid }, { auth: true }));
      } catch (x) { /* moveSlot() tries again on the next date change */ }
      evCache.delete(code);
      let title = '';
      try { title = (await getEvent(code)).title; } catch (x) { /* fine */ }
      remember({ code, title, role: 'h' });
    },
    async hostKey(code) {
      const own = await db.get(`es/${code}/own`, { auth: true });
      return own && own.rk ? fmtKey(own.rk) : null;
    },
    remove: (code, o = {}) => sweep(code, Object.assign({}, o, { all: true })),
    mine: () => mineList().map(({ code, title, at, role, fix }) => ({ code, title, at, role, fix: !!fix })),
    forget,
    checkCode: async (ac) => { const c = await checkCode(ac); return c ? { plan: c.plan, left: c.left, ex: c.ex } : null; },
    dateCheck,
  };

  // ======================================================================================================== live ===
  const live = {
    get: (code) => db.get(`es/${code}/live`).then((v) => v || {}),
    async set(code, patch = {}) {
      const upd = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!['ann', 'ch', 'rev', 'fin', 'wall'].includes(k)) throw err('DENIED', 0, `Unknown live key ${k}`);
        if (k === 'wall' && v && typeof v === 'object') for (const [wk, wv] of Object.entries(v)) upd[`wall/${wk}`] = wv;
        else upd[k] = v;
      }
      await db.patch(`es/${code}/live`, upd, { auth: true });
      const wallOnly = Object.keys(patch).every((k) => k === 'wall');
      await bell.ring(code, wallOnly ? 'w' : 'l').catch(() => {});
    },
    announce(code, { text, style = 'b', cd = 0 } = {}) {
      const t = clean(text, 120);
      if (!t) return Promise.reject(err('DENIED', 0, 'Write the announcement first'));
      return live.set(code, { ann: { id: randStr(8), t, st: style === 'f' ? 'f' : 'b', at: clock.now(), cd: clamp(Math.round(+cd || 0), 0, 900) } });
    },
    challenge(code, { title, minutes = 5, mission } = {}) {
      const t = clean(title, 80), now = clock.now();
      if (!t) return Promise.reject(err('DENIED', 0, 'Name the challenge first'));
      const ch = { id: randStr(8), t, at: now, end: now + clamp(Math.round(+minutes || 5), 1, 30) * MIN };
      if (mission) ch.m = String(mission).slice(0, 8);
      return live.set(code, { ch });
    },
    async pickWinner(code, id) {
      await db.patch(`es/${code}/live/ch`, { win: String(id).slice(0, 40) }, { auth: true });
      await bell.ring(code, 'l').catch(() => {});
    },
    // Reveal the disposable camera now: live.rev, the event's reveal time, and rv = now on every held photo.
    async reveal(code) {
      const now = clock.now();
      const e = await getEvent(code);
      if (e.dp && e.dp.on && e.dp.at > now) {
        try { await events.update(code, { dp: { on: true, at: now, sh: e.dp.sh } }); } catch (x) { /* walls still reveal from live.rev */ }
      }
      for (let guard = 0; guard < 50; guard++) {
        const held = await fs.query(`events/${code}`, { from: 'media', where: [['rv', '>', now]], limit: 400, select: ['__name__'], auth: true });
        if (!held.length) break;
        await fs.commit(held.map((d) => fs.w.update(d._path, {}, { mask: ['rv', 'mt'], serverTime: ['rv', 'mt'] })), { auth: true });
        if (held.length < 400) break;
      }
      await db.patch(`es/${code}/live`, { rev: { at: now } }, { auth: true });
      await bell.ring(code, 'l').catch(() => {});
      await bell.ring(code, 'g').catch(() => {});
    },
    async finale(code) {
      let n = '';
      try { n = clean((await pub.get(code, { maxAge: MIN })).n || '', 60); } catch (e) { n = ''; }
      return live.set(code, { fin: { at: clock.now() + 5000, n } });
    },
  };

  // ======================================================================================================= roles ===
  const ROLE_PAGE = { c: 'event-host.html', m: 'event-host.html', p: 'event-pro.html', w: 'event-wall.html' };
  const roles = {
    async invite(code, role) {
      if (!ROLE_PAGE[role]) throw err('DENIED', 0, 'Unknown role');
      await ensureStaff();
      const secret = randStr(22);
      await setInvite(code, role, secret);
      return { url: `${CFG().base}${ROLE_PAGE[role]}?e=${code}&j=${role}.${secret}`, secret };
    },
    revoke: (code, role) => setInvite(code, role, ''),
    async join(code, role, secret) {
      if (!ROLE_PAGE[role] || !/^[A-Za-z0-9]{22}$/.test(String(secret))) throw err('DENIED', 0, 'That invite link is not complete');
      const uid = await ensureStaff();
      try {
        await fs.commit([
          fs.w.update(`events/${code}/members/${uid}`, { r: role, s: secret, xp: farXp() }, { serverTime: ['at'], exists: null }),
          fs.w.update(`events/${code}`, { roles: { [uid]: role } }, { mask: [fp('roles', uid)] }),
        ], { auth: true });
      } catch (e) {
        if (e.code !== 'DENIED') throw e;
        let ok = false; // already a member with this role (a second tap on the link)?
        try { const ev = await getEvent(code); ok = ev.host === uid || (ev.roles || {})[uid] === role; } catch (x) { ok = false; }
        if (!ok) throw err('DENIED', e.status, 'This invite link no longer works. Ask the hosts for a new one.');
      }
      await withRetry(() => db.patch(`es/${code}`, { [`j/${uid}`]: { r: role, s: secret }, [`r/${uid}`]: role }, { auth: true }));
      evCache.delete(code);
      let title = '';
      try { title = (await getEvent(code)).title; } catch (x) { /* fine */ }
      remember({ code, title, role });
    },
    async leave(code) {
      const uid = await ensureStaff();
      await fs.commit([fs.w.update(`events/${code}`, {}, { mask: [fp('roles', uid)] })], { auth: true });
      await fs.commit([fs.w.del(`events/${code}/members/${uid}`)], { auth: true }).catch(() => {});
      await db.patch(`es/${code}`, { [`r/${uid}`]: null }, { auth: true }).catch(() => {});
      evCache.delete(code);
      forget(code);
    },
    async remove(code, uid) {
      await ensureStaff();
      await fs.commit([
        fs.w.update(`events/${code}`, {}, { mask: [fp('roles', uid), 'updatedAt'], serverTime: ['updatedAt'] }),
        fs.w.del(`events/${code}/members/${uid}`),
      ], { auth: true });
      // r and the old join record go together: a stale j/{uid} can never grant the role again.
      await db.patch(`es/${code}`, { [`r/${uid}`]: null, [`j/${uid}`]: null }, { auth: true }).catch(() => {});
      evCache.delete(code);
    },
    async list(code) {
      const e = await getEvent(code);
      return [{ uid: e.host, role: 'h' }].concat(Object.entries(e.roles || {}).map(([uid, role]) => ({ uid, role })));
    },
  };
  async function setInvite(code, role, secret) {
    let cur = null;
    try { cur = await fs.get(`events/${code}/private/inv`, { auth: true }); } catch (e) { if (e.code !== 'DENIED' && e.code !== 'NOT_FOUND') throw e; if (e.code === 'DENIED') throw err('DENIED', e.status, 'Only the hosts can make invite links'); }
    const inv = { c: '', m: '', p: '', w: '' };
    if (cur) for (const k of Object.keys(inv)) inv[k] = cur[k] || '';
    inv[role] = secret;
    await fs.commit([fs.w.update(`events/${code}/private/inv`, Object.assign(inv, { xp: farXp() }), { serverTime: ['at'], exists: null })], { auth: true });
    await withRetry(() => db.put(`es/${code}/inv/${role}`, secret, { auth: true }));
  }

  // ======================================================================================================== pair ===
  // A TV holds es_pair/{nonce}: 10 characters from the code alphabet, shown as a QR (urls.pair) and as text
  // ("ABCDE-FGHJK") to type. Only the TV can read it. The host or a co-host writes the event code and the live wall
  // invite into it (claim); the TV then shows the event's title and joins as a wall itself only when someone confirms
  // on the TV (o.confirm({code, title}) → true/false; window.confirm when no handler is given).
  const PAIR_LEN = 10;
  const pairFmt = (p) => String(p || '').replace(/^(.{5})(.+)$/, '$1-$2');
  const pairNorm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pair = {
    format: pairFmt,
    // TV side. pin is a first choice (shown at once) and changes if that nonce is taken; ready resolves with the nonce
    // actually held, wait() with the event code once the host paired and the TV confirmed. Renewed every 9 minutes.
    show(o = {}) {
      let stopped = false, timer = null, since = 0, resolveW, rejectW, asking = false;
      const waitP = new Promise((res, rej) => { resolveW = res; rejectW = rej; });
      waitP.catch(() => {});
      const fresh = () => randStr(PAIR_LEN, CODE_CHARS);
      const api = { pin: fresh(), ready: null, wait: () => waitP, cancel: null, text: '', url: '' };
      const setPin = (p) => { api.pin = p; api.text = pairFmt(p); api.url = urls.pair(p); if (o.onPin) { try { o.onPin(p, api.text, api.url); } catch (e) { /* the page's handler */ } } };
      setPin(api.pin);
      const claim = async (first) => {
        const uid = await ensureStaff();
        for (let i = 0; i < 6; i++) {
          const p = i === 0 && first ? first : fresh();
          try { await db.put(`es_pair/${p}`, { u: uid, at: db.ts() }, { auth: true }); if (p !== api.pin) setPin(p); since = Date.now(); return p; } catch (e) { if (e.code !== 'DENIED') throw e; }
        }
        throw err('BUSY', 0, 'Could not show a pairing code. Try again.');
      };
      const confirmOffer = async (code, title) => {
        if (typeof o.confirm === 'function') return !!(await o.confirm({ code, title }));
        if (typeof window.confirm === 'function') return !!window.confirm(`Show "${title || code}" on this TV?`);
        return false;
      };
      const loop = async () => {
        if (stopped || asking) return;
        try {
          const v = await db.get(`es_pair/${api.pin}`, { auth: true });
          if (v && v.e && CODE_RE.test(v.e) && /^[A-Za-z0-9]{22}$/.test(String(v.s || ''))) {
            asking = true;
            let title = '';
            try { const pb = await db.get(`es/${v.e}/pub`); title = clean((pb && pb.t) || '', 60); } catch (e) { title = ''; }
            const yes = await confirmOffer(v.e, title).catch(() => false);
            asking = false;
            if (stopped) return;
            if (yes) {
              await roles.join(v.e, 'w', v.s);
              stopped = true; db.del(`es_pair/${api.pin}`, { auth: true }).catch(() => {}); resolveW(v.e); return;
            }
            await db.del(`es_pair/${api.pin}`, { auth: true }).catch(() => {}); // refused: a new code
            await claim();
          } else if (!v || v.u !== staffUid()) await claim(); // expired and gone: hold a new one
          else if (Date.now() - since > 9 * MIN) { await db.put(`es_pair/${api.pin}`, { u: staffUid(), at: db.ts() }, { auth: true }); since = Date.now(); }
        } catch (e) {
          asking = false;
          if (e.code === 'DENIED') { try { await claim(); } catch (x) { stopped = true; rejectW(x); return; } }
        }
        if (!stopped) timer = setTimeout(loop, 3000);
      };
      api.ready = claim(api.pin).then((p) => { if (!stopped) timer = setTimeout(loop, 3000); return p; });
      api.ready.catch((e) => { stopped = true; rejectW(e); });
      api.cancel = () => { stopped = true; clearTimeout(timer); db.del(`es_pair/${api.pin}`, { auth: true }).catch(() => {}); rejectW(err('CLOSED', 0, 'Pairing cancelled')); };
      return api;
    },
    // Host or co-host side: hand the TV the event and the live wall invite (made now if there is none). The host
    // cannot read the TV's record; a code no TV holds is refused by the rules.
    async claim(code, pinIn) {
      const uid = await ensureStaff();
      const p = pairNorm(pinIn);
      if (p.length !== PAIR_LEN || ![...p].every((ch) => CODE_CHARS.includes(ch))) throw err('DENIED', 0, 'Enter the 10 letters and numbers shown on the TV');
      const e = await getEvent(code);
      if (e.host !== uid && (e.roles || {})[uid] !== 'c') throw err('DENIED', 403, 'Only the hosts can pair a TV');
      let inv = null;
      try { inv = await fs.get(`events/${code}/private/inv`, { auth: true }); } catch (x) { if (x.code !== 'NOT_FOUND') throw x; }
      let secret = inv && /^[A-Za-z0-9]{22}$/.test(String(inv.w || '')) ? inv.w : '';
      if (!secret) secret = (await roles.invite(code, 'w')).secret;
      else await withRetry(() => db.put(`es/${code}/inv/w`, secret, { auth: true })).catch(() => {});
      try { await db.patch(`es_pair/${p}`, { e: code, s: secret }, { auth: true }); } catch (x) {
        if (x.code === 'DENIED') throw err('NOT_FOUND', 0, 'That code is not on any TV right now');
        throw x;
      }
      evCache.delete(code);
    },
  };

  // ======================================================================================================= guest ===
  const SEAT_KEY = (code) => `luts:es-seat:${code}`;
  const seatsTried = new Map(); // code -> seats this page found taken
  function sessionRaw(code) { const s = lsGet(SEAT_KEY(code)); return s && Array.isArray(s.t) && Number.isInteger(s.n) ? s : null; }
  function saveSession(code, s) { lsSet(SEAT_KEY(code), s); }
  // The time on the server's clock when this phone's clock says the event is not open (a phone set to the wrong
  // time would otherwise turn guests away): one tiny public read with a Date header.
  async function nowChecked(p) {
    let now = clock.now();
    if ((now < p.o || now >= p.c) && clockSource !== 'probe') { await clock.sync().catch(() => {}); now = clock.now(); }
    return now;
  }
  let queueCount = 0;
  async function refreshQueueCount() {
    try { queueCount = (await idb.list('queue', '')).filter((x) => !x.value.refused).length; } catch (e) { queueCount = 0; }
    return queueCount;
  }
  function itemId(s, k) { return `${s.n}-${k}-${s.t[k]}`; }
  function usedSlots(s) { return new Set((s.u || []).map(Number)); }
  async function pubFor(code, maxAge = MIN) {
    const p = await pub.get(code, { maxAge });
    if (!p) throw err('NOT_FOUND', 404, 'No such event');
    return p;
  }
  function mediaFields(p, s, item) {
    const m = item.meta || {};
    const o = {
      s: s.n, k: item.k, kd: item.kind, d: item.blob, t: item.thumb, w: Math.round(+m.w || 1), h: Math.round(+m.h || 1),
      fn: (m.fn && p.fi.includes(m.fn)) ? m.fn : '', m: String(m.m || '').slice(0, 8), cp: clean(m.cp, 80), st: p.ap ? 0 : 1,
      rv: fs.ts(p.dp && p.dp.on ? p.dp.at : 0), hl: false, xp: fs.ts(p.fu), wm: false,
    };
    if (item.kind === 'v') { o.du = clamp(Math.round(+m.du || 1), 1, 15500); o.vm = item.vm; }
    return o;
  }
  async function sendBatch(code, p, s, items) {
    const writes = [];
    for (const it of items) {
      const id = itemId(s, it.k);
      writes.push(fs.w.create(`events/${code}/media/${id}`, mediaFields(p, s, it), { serverTime: ['mt', 'at'] }));
      if (it.kind === 'v') writes.push(fs.w.create(`events/${code}/vs/${it.vm}`, { id, xp: fs.ts(p.x) }, { serverTime: ['at'] }));
    }
    return fs.commit(writes, { auth: false });
  }
  async function markSent(code, p, s, items) {
    for (const it of items) {
      if (!sessionRaw(code)) { await idb.del('queue', it.key).catch(() => {}); continue; } // erased meanwhile
      const id = itemId(s, it.k);
      await idb.put('mine', `${code}/${id}`, { code, id, kind: it.kind, k: it.k, thumb: it.thumb, w: it.meta.w, h: it.meta.h, at: clock.now(), rv: p.dp && p.dp.on ? p.dp.at : 0, m: it.meta.m || '' });
      await idb.del('queue', it.key);
    }
  }
  let flushing = null, flushAgain = false;
  const erasing = new Set(); // codes whose guest is erasing: the flusher leaves them alone
  async function doFlush() {
    let sent = 0;
    const all = (await idb.list('queue', '')).map((x) => x.value);
    const byCode = new Map();
    for (const it of all) { if (!it || it.refused || erasing.has(it.code)) continue; if (!byCode.has(it.code)) byCode.set(it.code, []); byCode.get(it.code).push(it); }
    for (const [code, items] of byCode) {
      if (erasing.has(code)) continue;
      const s = sessionRaw(code);
      const refuse = async (list, why) => { for (const it of list) { it.refused = why; await idb.put('queue', it.key, it); } };
      if (!s) { await refuse(items, 'DENIED'); continue; }
      let p;
      try { p = await pubFor(code, MIN); } catch (e) {
        if (e.code === 'NOT_FOUND') { await refuse(items, 'NOT_FOUND'); }
        continue;
      }
      const ready = items.filter((it) => !(it.next > Date.now()));
      if (!ready.length) continue;
      const now = await nowChecked(p);
      if (now >= p.c) { await refuse(ready, 'CLOSED'); continue; }
      if (now < p.o) continue;
      const photos = ready.filter((it) => it.kind === 'p').sort((a, b) => a.at - b.at), videos = ready.filter((it) => it.kind === 'v');
      const batches = [];
      for (let i = 0; i < photos.length; i += 4) batches.push(photos.slice(i, i + 4));
      videos.forEach((v) => batches.push([v]));
      let offline = false;
      for (const batch of batches) {
        if (offline || erasing.has(code)) break;
        const r = await trySend(code, p, s, batch);
        if (r === 'offline') offline = true;
        else sent += r;
      }
    }
    await refreshQueueCount();
    for (const code of byCode.keys()) emit('es:queue', { code, left: (await guest.queue(code)).filter((x) => !x.refused).length });
    return { sent, left: queueCount };
  }
  // Returns the number sent, or 'offline'. A video claims an event-wide slot vs/{m} (m < vt) in the same commit; the
  // guest cannot see which are taken, so it starts at a seat-derived slot and walks on through all vt of them.
  async function trySend(code, p, s, batch) {
    const vt = () => Math.max(1, (p.cap && p.cap.vt) || 1);
    for (const it of batch) { if (it.kind === 'v' && !(it.vm >= 0)) it.vm = (s.n * 7919 + 13) % vt(); }
    const ok = async (pp, list) => {
      await markSent(code, pp, s, list);
      bell.ring(code, pp.ap ? 'q' : 'o').catch(() => {});
      list.forEach(() => stat(code, 'u'));
      return list.length;
    };
    const backoff = async (list, e) => {
      for (const it of list) {
        it.tries = (it.tries || 0) + 1;
        if (e.code === 'OFFLINE' && navigator.onLine !== false) it.maybeSent = true;
        it.next = Date.now() + (e.code === 'QUOTA' ? 60e3 : Math.min(60e3, 5e3 * Math.pow(2, it.tries - 1)));
        await idb.put('queue', it.key, it);
      }
      return 'offline';
    };
    const soft = (e) => e.code === 'OFFLINE' || e.code === 'QUOTA' || e.code === 'BUSY';
    try { await sendBatch(code, p, s, batch); return await ok(p, batch); } catch (e) {
      if (soft(e)) return backoff(batch, e);
      if (batch.length > 1) { // find the one that fails
        let n = 0;
        for (const it of batch) { const r = await trySend(code, p, s, [it]); if (r === 'offline') return n || 'offline'; n += r; }
        return n;
      }
      const it = batch[0];
      if (e.code === 'TAKEN' && it.kind === 'p') return ok(p, [it]); // only this phone knows the token: it is there already
      // Fresh settings (approval, reveal time, close) and, for a video, the other event-wide video slots.
      let fresh = p;
      try { fresh = await pubFor(code, 0); } catch (x) { /* keep */ }
      const now = clock.now();
      if (now < fresh.c && now >= fresh.o) {
        const n = it.kind === 'v' ? Math.max(1, (fresh.cap && fresh.cap.vt) || 1) : 1;
        const start = it.kind === 'v' ? (it.vm + 1) % n : 0;
        for (let a = 0; a < n; a++) {
          if (it.kind === 'v') { if (a === n - 1 && n > 1) break; it.vm = (start + a) % n; }
          try { await sendBatch(code, fresh, s, [it]); return await ok(fresh, [it]); } catch (e2) {
            if (soft(e2)) return backoff([it], e2);
          }
        }
      }
      // An earlier try may have reached the server: ask the server (a touch with the seat secret) instead of assuming.
      if (it.maybeSent) {
        const there = await confirmSent(code, s, it);
        if (there === true) return ok(fresh, [it]);
        if (there === 'offline') return backoff([it], err('OFFLINE', 0, 'No connection'));
        it.maybeSent = false;
      }
      it.refused = now >= fresh.c ? 'CLOSED' : now < fresh.o ? 'NOT_OPEN' : (it.kind === 'v' ? 'FULL' : 'DENIED');
      await idb.put('queue', it.key, it);
      return 0;
    }
  }
  // Is media/{id} of this queue item on the server? A no-op update carrying the owner proof (rules: the guest "touch")
  // succeeds only if the document exists and is this seat's; NOT_FOUND means the earlier try never landed.
  // true, false or 'offline'.
  async function confirmSent(code, s, it) {
    const id = itemId(s, it.k), secret = s.t[s.t.length - 1];
    s.pv = s.pv || { g: 0, b: 0, m: {} }; s.pv.m = s.pv.m || {};
    for (let extra = 1; extra <= 3; extra++) {
      const pv = (s.pv.m[id] || 0) + extra;
      try {
        await fs.commit([fs.w.update(`events/${code}/media/${id}`, await ownerProof(secret, pv), { mask: ['pv', 'pr'] })], { auth: false });
        const s2 = sessionRaw(code) || s; s2.pv = s2.pv || { g: 0, b: 0, m: {} }; s2.pv.m = s2.pv.m || {}; s2.pv.m[id] = pv; s.pv.m[id] = pv;
        if (sessionRaw(code)) saveSession(code, s2);
        return true;
      } catch (e) {
        if (e.code === 'OFFLINE' || e.code === 'QUOTA') return 'offline';
        if (e.code === 'NOT_FOUND') return false;
      }
    }
    return false;
  }
  // One flush at a time; items queued while one runs get another pass straight after it.
  function flush() {
    if (flushing) { flushAgain = true; return flushing; }
    flushing = (async () => {
      let r;
      do { flushAgain = false; r = await doFlush().catch(() => ({ sent: 0, left: queueCount })); } while (flushAgain);
      return r;
    })().finally(() => { flushing = null; });
    return flushing;
  }
  window.addEventListener('online', async () => {
    if (!queueCount) return;
    try { for (const x of await idb.list('queue', '')) if (x.value && x.value.next && !x.value.refused) { x.value.next = 0; await idb.put('queue', x.key, x.value); } } catch (e) { /* flush anyway */ }
    flush();
  });
  setInterval(() => { if (queueCount && navigator.onLine !== false) flush(); }, 10e3);
  setTimeout(() => { refreshQueueCount().then((n) => { if (n && navigator.onLine !== false) flush(); }); }, 0);

  function parseStatus(v, pg) {
    const s = (v && typeof v.s === 'string') ? v.s : '';
    const at = (i) => { const ch = s[i]; return ch === undefined || ch === '-' ? -1 : +ch; };
    return { selfie: at(0), slots: range(6).map((i) => at(i + 1)), shownAt: (v && +v.t) || 0, pg };
  }
  const thumbUrls = new Map();
  function thumbUrl(key, bytes) {
    if (!bytes || !bytes.length) return '';
    if (thumbUrls.has(key)) return thumbUrls.get(key);
    const u = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    thumbUrls.set(key, u);
    return u;
  }
  async function ownerProof(secret, pv) { return { pv, pr: await sha256hex(`${secret}:${pv}`) }; }

  async function eraseSeat(code, s) {
    const secret = s.t[s.t.length - 1];
    s.pv = s.pv || { g: 0, b: 0, m: {} }; s.pv.m = s.pv.m || {};
    let sent = [];
    try { sent = (await idb.list('mine', `${code}/`)).map((x) => x.value); } catch (e) { sent = []; }
    for (const q of await idb.list('queue', `${code}/`).catch(() => [])) await idb.del('queue', q.key).catch(() => {});
    await refreshQueueCount();
    const ids = new Set(sent.map((m) => m.id));
    for (const k of (s.u || [])) if (Number.isInteger(+k) && s.t[+k] && +k < s.t.length - 1) ids.add(itemId(s, +k));
    const items = [];
    items.push({ path: `events/${code}/guests/${s.n}`, key: 'g', mk: async (pv) => fs.w.update(`events/${code}/guests/${s.n}`,
      Object.assign({ st: 3, nm: '', wi: '', im: new Uint8Array(0) }, await ownerProof(secret, pv)), { mask: ['st', 'nm', 'wi', 'im', 'mt', 'pv', 'pr'], serverTime: ['mt'] }) });
    for (const id of ids) {
      items.push({ path: `events/${code}/media/${id}`, key: id, mk: async (pv) => fs.w.update(`events/${code}/media/${id}`,
        Object.assign({ st: 3, d: new Uint8Array(0), t: new Uint8Array(0), cp: '' }, await ownerProof(secret, pv)), { mask: ['st', 'd', 't', 'cp', 'mt', 'pv', 'pr'], serverTime: ['mt'] }) });
    }
    if (s.book) {
      items.push({ path: `events/${code}/book/${s.n}`, key: 'b', optional: true, mk: async (pv) => fs.w.update(`events/${code}/book/${s.n}`,
        Object.assign({ nm: '', tx: '', v: new Uint8Array(0) }, await ownerProof(secret, pv)), { mask: ['nm', 'tx', 'v', 'pv', 'pr'] }) });
    }
    const pvOf = (it) => (it.key === 'g' ? s.pv.g : it.key === 'b' ? s.pv.b : (s.pv.m[it.key] || 0));
    const setPv = (it, v) => { if (it.key === 'g') s.pv.g = v; else if (it.key === 'b') s.pv.b = v; else s.pv.m[it.key] = v; };
    // Items already erased on an earlier try (a second tap after a partial failure) are skipped.
    s.gone = Array.isArray(s.gone) ? s.gone : [];
    const done = (it) => { if (!s.gone.includes(it.key)) s.gone.push(it.key); };
    let erased = 0;
    const required = [];
    const todo = items.filter((it) => !s.gone.includes(it.key));
    for (let i = 0; i < todo.length; i += 20) {
      const chunk = todo.slice(i, i + 20);
      try {
        await fs.commit(await Promise.all(chunk.map((it) => it.mk(pvOf(it) + 1))), { auth: false });
        chunk.forEach((it) => { setPv(it, pvOf(it) + 1); done(it); }); erased += chunk.length;
      } catch (e) {
        if (e.code === 'OFFLINE' || e.code === 'QUOTA') { saveSession(code, s); throw e; }
        for (const it of chunk) { // one by one, allowing for an earlier edit whose answer was lost
          let ok = false;
          for (let extra = 1; extra <= 3 && !ok; extra++) {
            try { await fs.commit([await it.mk(pvOf(it) + extra)], { auth: false }); setPv(it, pvOf(it) + extra); ok = true; erased++; } catch (e2) {
              if (e2.code === 'OFFLINE' || e2.code === 'QUOTA') { saveSession(code, s); throw e2; }
              if (e2.code === 'NOT_FOUND') { ok = true; break; } // already removed by the hosts or by expiry
            }
          }
          if (ok) done(it); else if (!it.optional) required.push(it.path);
        }
      }
    }
    saveSession(code, s);
    // Keep the seat (and its secret) until everything is gone, so a second tap can finish the job.
    if (required.length) throw err('DENIED', 403, 'Could not delete everything. Ask the hosts.');
    await bell.ring(code, 'e').catch(() => {});
    for (const m of sent) await idb.del('mine', `${code}/${m.id}`);
    for (const q of await idb.list('queue', `${code}/`)) await idb.del('queue', q.key);
    await refreshQueueCount();
    saveSession(code, null);
    emit('es:queue', { code, left: 0 });
    return { erased };
  }
  const guest = {
    session(code) {
      const s = sessionRaw(code);
      return s ? { n: s.n, t: s.t.slice(), secret: s.t[s.t.length - 1], name: s.name || '', at: s.at || 0, pg: s.pg, vg: s.vg, k: s.k || '' } : null;
    },
    saveKey(code, k) { const s = sessionRaw(code); if (s && /^[A-Za-z0-9_-]{43}$/.test(k)) { s.k = k; saveSession(code, s); } },
    async checkIn(code, o = {}) {
      const have = sessionRaw(code);
      if (have) return { seat: have.n };
      if (o.adult !== true) throw err('DENIED', 0, 'Both ticks are needed');
      const name = clean(o.name, 24);
      if (!name) throw err('DENIED', 0, 'Your name');
      const im = await toBytes(o.selfie);
      if (!im || im.length < 600 || im.length > 61440) throw err('DENIED', 0, 'That photo did not open. Try again.');
      const p = await pubFor(code, 30e3);
      const now = await nowChecked(p);
      if (now < p.o) throw err('NOT_OPEN', 0, 'Check-in has not opened yet');
      if (now >= p.c) throw err('CLOSED', 0, 'Check-in has closed.');
      const cp = p.cap, nTok = cp.pg + cp.vg + 1;
      const [b, st] = await Promise.all([db.get(`es/${code}/b`).catch(() => null), db.get(`es/${code}/st`, { shallow: true }).catch(() => null)]);
      const taken = new Set(Object.keys(st || {}).map(Number).concat([...(seatsTried.get(code) || [])]));
      let free = shuffled(range(cp.lim).filter((n) => !taken.has(n)));
      const arrived = Math.max(b ? +b.a || 0 : 0, taken.size);
      const fullish = arrived >= cp.lim;
      // Expected tries to land on a free seat is lim / free: allow about three times that (8 to 30) as the room fills.
      const tries = Math.min(free.length, fullish ? 3 : clamp(Math.ceil(4 * cp.lim / Math.max(1, cp.lim - arrived)), 8, 30));
      const fn = (o.fn && p.fi.includes(o.fn)) ? o.fn : '';
      let lastErr = null;
      for (let i = 0; i < tries; i++) {
        const n = free[i];
        const t = range(nTok).map(() => randStr(12));
        const fresh = i > 0 && lastErr && lastErr.code === 'DENIED' ? await pubFor(code, 0).catch(() => p) : p;
        const writes = [
          fs.w.create(`events/${code}/seats/${n}`, { t, xp: fs.ts(fresh.x) }, { serverTime: ['at'] }),
          fs.w.create(`events/${code}/guests/${n}`, { nm: name, wi: clean(o.wish, 80), im, fn, lg: (typeof o.lang === 'string' && /^[a-z]{2}$/.test(o.lang)) ? o.lang : 'en',
            cv: Math.round(+o.cv || 0), ad: true, fo: !!o.faceOk, st: fresh.ap ? 0 : 1, xp: fs.ts(fresh.fu) }, { serverTime: ['mt', 'at'] }),
        ];
        try {
          await fs.commit(writes, { auth: false });
          saveSession(code, { n, t, name, at: clock.now(), pg: cp.pg, vg: cp.vg, u: [], pv: { g: 0, b: 0, m: {} }, book: false });
          bell.ring(code, 'a').catch(() => {});
          bell.ring(code, fresh.ap ? 'q' : 'o').catch(() => {});
          stat(code, 'a');
          return { seat: n };
        } catch (e) {
          if (!['TAKEN', 'DENIED', 'BUSY'].includes(e.code)) throw e;
          if (!seatsTried.has(code)) seatsTried.set(code, new Set());
          seatsTried.get(code).add(n); // taken: the next try on this phone skips it
          if (e.code === 'DENIED' && !lastErr) await clock.sync().catch(() => {}); // a wrong phone clock looks like a refusal
          lastErr = e;
          const t2 = clock.now();
          if (t2 >= p.c) throw err('CLOSED', e.status, 'Check-in has closed.');
          if (t2 < p.o) throw err('NOT_OPEN', e.status, 'Check-in has not opened yet');
        }
      }
      if (fullish || free.length <= tries) throw err('FULL', lastErr ? lastErr.status : 0, 'The event is full.');
      throw err('BUSY', lastErr ? lastErr.status : 0, 'Check-in is busy. Trying again…');
    },
    async queueUpload(code, o = {}) {
      const s = sessionRaw(code);
      if (!s) throw err('DENIED', 0, 'Check in first');
      const kind = o.kind === 'v' ? 'v' : 'p';
      const blob = await toBytes(o.blob), thumb = await toBytes(o.thumb);
      const maxD = kind === 'v' ? 1000000 : 122880;
      if (!blob || blob.length < 1000 || blob.length > maxD) throw err('DENIED', 0, kind === 'v' ? 'That video is too big' : 'That photo is too big');
      if (!thumb || thumb.length < 200 || thumb.length > 16384) throw err('DENIED', 0, 'Thumbnail out of range');
      const used = usedSlots(s);
      const lo = kind === 'p' ? 0 : s.pg, hi = kind === 'p' ? s.pg : s.pg + s.vg;
      const k = range(hi).slice(lo).find((x) => !used.has(x));
      if (k === undefined) throw err('FULL', 0, kind === 'v' ? 'Video slots for this event are full.' : 'No photos left. Thank you for sharing!');
      if (kind === 'v' && !(+o.du > 0)) throw err('DENIED', 0, 'Video length missing');
      // The slot is taken in the session first (two quick taps must not get the same one) and given back if the
      // queue row cannot be stored.
      s.u = (s.u || []).concat([k]); saveSession(code, s);
      const key = `${code}/${k}`;
      const item = { key, code, kind, k, blob, thumb, meta: { w: o.w, h: o.h, du: o.du, fn: o.fn || '', m: o.m || '', cp: o.cp || '' }, tries: 0, next: 0, at: Date.now() };
      try { await idb.put('queue', key, item); } catch (e) {
        const s2 = sessionRaw(code);
        if (s2) { s2.u = (s2.u || []).filter((x) => x !== k); saveSession(code, s2); }
        throw err('DENIED', 0, 'This phone could not keep the photo. Free some space and try again.');
      }
      queueCount++;
      emit('es:queue', { code, left: (await guest.queue(code)).filter((x) => !x.refused).length });
      if (navigator.onLine !== false) flush();
      return { key };
    },
    async queue(code) {
      return (await idb.list('queue', `${code}/`)).map((x) => x.value).map((it) => ({ key: it.key, code: it.code, kind: it.kind, k: it.k,
        tries: it.tries || 0, next: it.next || 0, refused: it.refused || '', meta: it.meta, thumb: it.thumb, at: it.at }));
    },
    // Remove a queued (or refused) item and give its slot back unless it may already have reached the server.
    async drop(code, key) {
      const it = await idb.get('queue', key);
      if (!it) return;
      await idb.del('queue', key);
      const s = sessionRaw(code);
      if (s && !it.maybeSent) { s.u = (s.u || []).filter((k) => k !== it.k); saveSession(code, s); }
      await refreshQueueCount();
      emit('es:queue', { code, left: (await guest.queue(code)).filter((x) => !x.refused).length });
    },
    flush,
    slotsLeft(code) {
      const s = sessionRaw(code);
      if (!s) return { photos: 0, videos: 0 };
      const used = usedSlots(s);
      return { photos: range(s.pg).filter((k) => !used.has(k)).length, videos: range(s.pg + s.vg).slice(s.pg).filter((k) => !used.has(k)).length };
    },
    async status(code) {
      const s = sessionRaw(code);
      if (!s) return null;
      return parseStatus(await db.get(`es/${code}/st/${s.n}`), s.pg);
    },
    async mine(code) {
      const s = sessionRaw(code);
      if (!s) return [];
      let st = null;
      try { st = await guest.status(code); } catch (e) { st = null; }
      const now = clock.now();
      const sent = (await idb.list('mine', `${code}/`)).map((x) => x.value).map((m) => ({ id: m.id, kind: m.kind, k: m.k,
        st: st ? st.slots[m.k] : -1, dev: m.rv > now, rv: m.rv, m: m.m, thumbUrl: thumbUrl(`m:${code}/${m.id}`, m.thumb) }));
      const q = (await guest.queue(code)).map((it) => ({ id: '', key: it.key, kind: it.kind, k: it.k, st: -1, queued: true, refused: it.refused,
        thumbUrl: thumbUrl(`q:${it.key}:${it.at}`, it.thumb) }));
      return sent.concat(q).sort((a, b) => a.k - b.k);
    },
    // Erase everything this seat sent. The flusher is held off for this code (and an in-flight flush awaited), the queue
    // rows go first, and every slot the session ever used is erased on the server (NOT_FOUND = never arrived), so
    // nothing is missed when IndexedDB lost the "mine" list or an upload was still on its way.
    async erase(code) {
      if (!sessionRaw(code)) return { erased: 0 };
      erasing.add(code);
      try {
        if (flushing) await flushing.catch(() => {});
        const s = sessionRaw(code);
        if (!s) return { erased: 0 };
        return await eraseSeat(code, s);
      } finally { erasing.delete(code); }
    },
    async setFace(code, ok) {
      const s = sessionRaw(code);
      if (!s) throw err('DENIED', 0, 'Check in first');
      s.pv = s.pv || { g: 0, b: 0, m: {} };
      const secret = s.t[s.t.length - 1];
      for (let extra = 1; extra <= 3; extra++) {
        try {
          await fs.commit([fs.w.update(`events/${code}/guests/${s.n}`, Object.assign({ fo: !!ok }, await ownerProof(secret, s.pv.g + extra)), { mask: ['fo', 'pv', 'pr'] })], { auth: false });
          s.pv.g += extra; saveSession(code, s); return;
        } catch (e) { if (e.code !== 'DENIED') throw e; }
      }
      throw err('DENIED', 403, 'Could not change this');
    },
    async book(code, o = {}) {
      const s = sessionRaw(code);
      if (!s) throw err('DENIED', 0, 'Check in first');
      const p = await pubFor(code, MIN);
      const secret = s.t[s.t.length - 1];
      const body = { nm: clean(o.name || s.name, 24), tx: clean(o.text, 500) };
      if (!body.nm) throw err('DENIED', 0, 'Your name');
      const voice = o.voice ? await toBytes(o.voice) : null;
      if (voice && voice.length) {
        if (!(p.cap.vo && p.ft.vo)) throw err('DENIED', 0, 'Voice messages are not on for this event');
        if (voice.length > 204800) throw err('DENIED', 0, 'That voice message is too long');
        body.v = voice; body.vm = String(o.mime || 'audio/webm').slice(0, 40); body.du = clamp(Math.round(+o.du || 1), 1, 61000);
      }
      if (!s.book) {
        try {
          // p is the hash of the seat secret: co-hosts read the book and must not learn the secret.
          await fs.commit([fs.w.create(`events/${code}/book/${s.n}`, Object.assign({}, body, { p: await sha256hex(secret), xp: fs.ts(p.x) }), { serverTime: ['at'] })], { auth: false });
          s.book = true; saveSession(code, s); return;
        } catch (e) {
          if (e.code === 'OFFLINE') { s.bookMaybe = true; saveSession(code, s); throw e; }
          if (e.code !== 'TAKEN' && e.code !== 'DENIED') throw e;
          if (e.code === 'DENIED' && !s.bookMaybe) throw e;
        }
      }
      s.pv = s.pv || { g: 0, b: 0, m: {} };
      // An edit: voice undefined keeps the recording; null (or empty) removes it; bytes replace it.
      let mask = ['nm', 'tx', 'pv', 'pr'];
      if (voice && voice.length) mask = mask.concat(['v', 'vm', 'du']);
      else if (o.voice !== undefined) { body.v = new Uint8Array(0); mask = mask.concat(['v']); }
      for (let extra = 1; extra <= 3; extra++) {
        try {
          await fs.commit([fs.w.update(`events/${code}/book/${s.n}`, Object.assign({}, body, await ownerProof(secret, s.pv.b + extra)), { mask })], { auth: false });
          s.pv.b += extra; s.book = true; saveSession(code, s); return;
        } catch (e) { if (e.code !== 'DENIED') throw e; }
      }
      throw err('DENIED', 403, 'Messages can be changed until a day after the event');
    },
  };

  // ======================================================================================================== RSVP ===
  const RSVP_KEY = (code) => `luts:es-rsvp:${code}`;
  const rsvp = {
    mine(code) { const r = lsGet(RSVP_KEY(code)); return r && r.v ? Object.assign({ r: r.r }, r.v) : null; },
    async save(code, o = {}) {
      const p = await pubFor(code, MIN);
      if (!(p.cap.rs && p.ft.rs)) throw err('DENIED', 0, 'RSVP is not on for this event');
      if (clock.now() >= p.c) throw err('CLOSED', 0, 'RSVP has closed');
      const fn = {};
      for (const id of p.fi) { const n = Math.round(+((o.fns || {})[id]) || 0); fn[id] = clamp(n, 0, 20); }
      const v = { nm: clean(o.name, 40), ph: String(o.phone || '').replace(/[^0-9+ ]/g, '').trim().slice(0, 16), fn, dt: clean(o.diet, 40), no: clean(o.note, 140) };
      if (!v.nm) throw err('DENIED', 0, 'Your name');
      if (v.ph && (v.ph.length < 6)) throw err('DENIED', 0, 'Check the phone number');
      const mine = lsGet(RSVP_KEY(code));
      const keep = { name: v.nm, phone: v.ph, fns: fn, diet: v.dt, note: v.no };
      if (mine && Number.isInteger(mine.r) && mine.tk) {
        for (let extra = 1; extra <= 3; extra++) {
          try {
            await fs.commit([fs.w.update(`events/${code}/rsvp/${mine.r}`, Object.assign({}, v, await ownerProof(mine.tk, (mine.pv || 0) + extra)),
              { mask: ['nm', 'ph', 'fn', 'dt', 'no', 'at', 'pv', 'pr'], serverTime: ['at'] })], { auth: false });
            lsSet(RSVP_KEY(code), { r: mine.r, tk: mine.tk, pv: (mine.pv || 0) + extra, v: keep, at: Date.now() });
            return { r: mine.r };
          } catch (e) { if (e.code !== 'DENIED') throw e; }
        }
        throw err('DENIED', 403, 'Could not change your RSVP');
      }
      const tk = randStr(16);
      let lastErr = null;
      for (const r of shuffled(range(p.cap.lim)).slice(0, 8)) {
        try {
          await fs.commit([fs.w.create(`events/${code}/rsvp/${r}`, Object.assign({}, v, { tk, xp: fs.ts(p.x) }), { serverTime: ['at'] })], { auth: false });
          lsSet(RSVP_KEY(code), { r, tk, pv: 0, v: keep, at: Date.now() });
          return { r };
        } catch (e) { if (e.code !== 'TAKEN' && e.code !== 'DENIED') throw e; lastErr = e; }
      }
      throw err(lastErr && lastErr.code === 'DENIED' ? 'DENIED' : 'BUSY', lastErr ? lastErr.status : 0, 'Could not send your RSVP. Try again.');
    },
    async summary(code) {
      const p = await pubFor(code, MIN); // the function list comes from the RTDB mirror: no document read
      const ids = p.fi;
      const byFn = {};
      // One aggregation for the households and up to four sums; more functions take a second one.
      const first = { households: ['count'] };
      ids.slice(0, 4).forEach((id, i) => { first[`p${i}`] = ['sum', fp('fn', id)]; });
      const r1 = await fs.aggregate(`events/${code}`, { from: 'rsvp', aggs: first, auth: true });
      const people = {};
      ids.slice(0, 4).forEach((id, i) => { people[id] = r1[`p${i}`] || 0; });
      if (ids.length > 4) {
        const more = {}; ids.slice(4).forEach((id, i) => { more[`p${i}`] = ['sum', fp('fn', id)]; });
        const r2 = await fs.aggregate(`events/${code}`, { from: 'rsvp', aggs: more, auth: true });
        ids.slice(4).forEach((id, i) => { people[id] = r2[`p${i}`] || 0; });
      }
      // Households coming to each function: a count with a filter (one aggregation read each).
      for (const id of ids) {
        const yes = await fs.aggregate(`events/${code}`, { from: 'rsvp', where: [[fp('fn', id), '>', 0]], aggs: { n: ['count'] }, auth: true });
        byFn[id] = { yes: yes.n || 0, people: people[id] || 0 };
      }
      return { households: r1.households || 0, byFn };
    },
    // Host tool (§4.25 "RSVP delete"): co-hosts and the host remove a household's answer.
    async remove(code, r) {
      await fs.commit([fs.w.del(`events/${code}/rsvp/${Math.round(+r)}`)], { auth: true });
    },
    async list(code) {
      const out = [];
      let after = null;
      for (let guard = 0; guard < 20; guard++) {
        const q = { from: 'rsvp', orderBy: [['__name__', 'asc']], limit: 300, select: ['nm', 'ph', 'fn', 'dt', 'no', 'at'], auth: true };
        if (after) q.startAfter = [fs.ref(after)];
        const docs = await fs.query(`events/${code}`, q);
        docs.forEach((d) => out.push({ id: d._id, name: d.nm || '', phone: d.ph || '', fns: d.fn || {}, diet: d.dt || '', note: d.no || '', at: d.at || 0 }));
        if (docs.length < 300) break;
        after = docs[docs.length - 1]._path;
      }
      return out;
    },
  };

  // ===================================================================================================== reports ===
  const REASONS = ['me', 'rude', 'child', 'other'];
  async function report(code, mediaId, why) {
    if (!REASONS.includes(why)) throw err('DENIED', 0, 'Pick a reason');
    if (!/^[A-Za-z0-9-]{3,40}$/.test(String(mediaId))) throw err('DENIED', 0, 'Unknown photo');
    const k = `luts:es-rep:${code}`, done = lsGet(k, {}) || {};
    if (done[mediaId]) return;
    const p = await pubFor(code, 5 * MIN);
    const path = `events/${code}/reports/${mediaId}`;
    try {
      await fs.commit([fs.w.create(path, { n: 1, why, xp: fs.ts(p.x) }, { serverTime: ['at'] })], { auth: false });
    } catch (e) {
      if (e.code !== 'TAKEN' && e.code !== 'DENIED') throw e;
      // Already reported: one more (the rules allow 20 per item, 30 s apart; a refusal here is not the guest's problem).
      try { await fs.commit([fs.w.update(path, { why }, { mask: ['why'], inc: { n: 1 }, serverTime: ['at'] })], { auth: false }); } catch (e2) {
        if (e2.code !== 'DENIED' && e2.code !== 'NOT_FOUND') throw e2;
      }
    }
    done[mediaId] = 1; lsSet(k, done);
    await bell.ring(code, 'r').catch(() => {});
  }

  // ================================================================================================ staff media ===
  const SEL = {
    media: ['s', 'k', 'kd', 't', 'w', 'h', 'fn', 'm', 'cp', 'st', 'mt', 'at', 'du', 'rv', 'hl', 'by', 'vm', 'xp', 'wm'],
    guests: ['nm', 'wi', 'im', 'fn', 'lg', 'cv', 'fo', 'st', 'mt', 'at', 'xp'],
  };
  async function changes(coll, code, o = {}) {
    const st = Array.isArray(o.st) && o.st.length ? o.st : [1];
    const q = { from: coll, where: [st.length === 1 ? ['st', '==', st[0]] : ['st', 'in', st]], orderBy: [['mt', 'asc'], ['__name__', 'asc']],
      limit: clamp(o.limit || 100, 1, 300), select: o.select || SEL[coll], auth: true };
    let c = o.cursor;
    if (typeof c === 'number') q.where.push(['mt', '>', c]);
    else if (c && c.mt && c.id) q.startAfter = [fs.ts(c.mt), fs.ref(`events/${code}/${coll}/${c.id}`)];
    // A time-only cursor (nothing seen yet): Firestore rejects a reference with an empty id ("…/guests/").
    else if (c && c.mt) q.where.push(['mt', '>', c.mt]);
    else c = null;
    const items = await fs.query(`events/${code}`, q);
    const last = items[items.length - 1];
    return { items, cursor: last ? { mt: last.mt, id: last._id } : (typeof o.cursor === 'object' ? o.cursor : (o.cursor ? { mt: o.cursor, id: '' } : null)) };
  }
  // Seat statuses on RTDB st/{n}: s[0] selfie, s[1..6] slots ('-' none, 0 waiting, 1 shown, 2 hidden, 3 erased).
  async function patchStatuses(code, changesList) {
    const bySeat = new Map();
    for (const c of changesList) {
      let n, pos;
      if (c.coll === 'guests') { n = +c.id; pos = 0; } else {
        const p = String(c.id).split('-'); if (p[0] === 'x' || p.length !== 3) continue; n = +p[0]; pos = 1 + (+p[1]);
      }
      if (!Number.isInteger(n) || pos > 6) continue;
      if (!bySeat.has(n)) bySeat.set(n, []);
      bySeat.get(n).push([pos, c.st]);
    }
    if (!bySeat.size) return;
    // t is when the seat's newest item shows on the big screen (§2.2). Here that is an estimate: a wall shows an approved
    // item about 8 s plus half a 4.5 s slot after the decision (§3.6); the packer later writes the exact slot time.
    const upd = {}, now = clock.now(), SHOW_LEAD = 10e3;
    await Promise.all([...bySeat.entries()].map(async ([n, list]) => {
      let cur = null;
      try { cur = await db.get(`es/${code}/st/${n}`); } catch (e) { cur = null; }
      const s = ((cur && typeof cur.s === 'string') ? cur.s : '').padEnd(7, '-').slice(0, 7).split('');
      let shown = false;
      list.forEach(([pos, st]) => { s[pos] = String(st); if (st === 1) shown = true; });
      upd[n] = { s: s.join(''), t: shown ? now + SHOW_LEAD : ((cur && +cur.t) || 0) };
    }));
    await db.patch(`es/${code}/st`, upd, { auth: true });
  }
  const RM_KEY = (code) => `luts:es-rm:${code}`, RM_DELAY = 10 * MIN;
  const media = {
    changes: (code, o) => changes('media', code, o),
    async get(code, ids, o = {}) {
      const paths = ids.map((id) => `events/${code}/media/${id}`);
      const mode = o.auth === undefined ? 'opt' : o.auth;
      try { return await fs.batchGet(paths, { mask: o.select, auth: mode }); } catch (e) {
        if (e.code !== 'DENIED' || ids.length < 2) { if (e.code === 'DENIED') return [null]; throw e; }
        const out = [];
        for (let i = 0; i < paths.length; i += 6) {
          const part = await Promise.all(paths.slice(i, i + 6).map((pth) => fs.get(pth, { mask: o.select, auth: mode }).catch((x) => { if (x.code === 'DENIED' || x.code === 'NOT_FOUND') return null; throw x; })));
          out.push(...part);
        }
        return out;
      }
    },
    async decide(code, list = []) {
      const ok = list.filter((x) => (x.coll === 'media' || x.coll === 'guests') && [0, 1, 2].includes(x.st) && x.id !== undefined);
      for (let i = 0; i < ok.length; i += 100) {
        const chunk = ok.slice(i, i + 100);
        await fs.commit(chunk.map((x) => fs.w.update(`events/${code}/${x.coll}/${x.id}`, { st: x.st }, { mask: ['st', 'mt'], serverTime: ['mt'] })), { auth: true });
      }
      if (!ok.length) return;
      await bell.ring(code, 'g').catch(() => {});
      await patchStatuses(code, ok).catch(() => {});
    },
    async highlight(code, id, on) {
      const e = await getEvent(code, { maxAge: MIN });
      await fs.commit([fs.w.update(`events/${code}/media/${id}`, { hl: !!on, xp: fs.ts(on ? e.expiresAt : e.fu) }, { mask: ['hl', 'xp', 'mt'], serverTime: ['mt'] })], { auth: true });
      await bell.ring(code, 'g').catch(() => {});
    },
    // After an upgrade or a confirmed pass the full-size window (fu) grows: photos already sent get the new expiry
    // too (staff may raise xp up to fu). Selfies keep theirs: the rules let staff change only st/mt on guests.
    async extend(code) {
      const e = await getEvent(code, { maxAge: MIN });
      let n = 0;
      for (let guard = 0; guard < 50; guard++) {
        const docs = (await fs.query(`events/${code}`, { from: 'media', where: [['xp', '<', e.fu]], select: ['st', 'hl', 'xp'], limit: 400, auth: true })).filter((d) => d.st !== 3);
        if (!docs.length) break;
        await fs.commit(docs.map((d) => fs.w.update(d._path, { xp: fs.ts(e.fu) }, { mask: ['xp'] })), { auth: true });
        n += docs.length;
        if (docs.length < 400) break;
      }
      return { extended: n };
    },
    async purge(code, ids = []) {
      for (let i = 0; i < ids.length; i += 100) {
        await fs.commit(ids.slice(i, i + 100).map((id) => fs.w.update(`events/${code}/media/${id}`, { d: new Uint8Array(0), t: new Uint8Array(0) }, { mask: ['d', 't'] })), { auth: true });
      }
    },
    // Remove a guest in two steps. Now: hide the check-in and every upload (st 2 with a fresh mt, so walls, packers and
    // moderators hear it through their delta queries and the 'g' bell), drop the photo bytes and bring the uploads'
    // expiry forward. Later (finishRemovals, run by the next removal or sweep from this device, at least RM_DELAY
    // on): delete the seat, check-in, guestbook, uploads and video slots. Uploads left behind expire for any sweeper.
    async removeGuest(code, seat) {
      const n = Math.round(+seat);
      if (!(n >= 0 && n < 10000)) throw err('DENIED', 0, 'Unknown seat');
      const e = await getEvent(code, { maxAge: MIN });
      const docs = await fs.query(`events/${code}`, { from: 'media', where: [['s', '==', n]], select: ['st', 'xp'], limit: 20, auth: true });
      const soon = fs.ts(Math.min(e.fu, clock.now() + RM_DELAY + 5 * MIN));
      const writes = [fs.w.update(`events/${code}/guests/${n}`, { st: 2 }, { mask: ['st', 'mt'], serverTime: ['mt'] })]
        .concat(docs.filter((d) => d.st !== 3).map((d) => fs.w.update(d._path, { st: 2, hl: false, d: new Uint8Array(0), t: new Uint8Array(0), xp: soon },
          { mask: ['st', 'hl', 'd', 't', 'xp', 'mt'], serverTime: ['mt'] })));
      try { await fs.commit(writes, { auth: true }); } catch (x) {
        if (x.code !== 'NOT_FOUND') throw x;
        if (docs.length) await fs.commit(writes.slice(1), { auth: true }); // the check-in itself is already gone
      }
      const list = (lsGet(RM_KEY(code), []) || []).filter((r) => r.n !== n).concat([{ n, at: clock.now() }]);
      lsSet(RM_KEY(code), list);
      await bell.ring(code, 'g').catch(() => {});
      await patchStatuses(code, [{ coll: 'guests', id: n, st: 2 }].concat(docs.map((d) => ({ coll: 'media', id: d._id, st: 2 })))).catch(() => {});
      await media.finishRemovals(code).catch(() => {});
    },
    // The second step of removeGuest for removals at least RM_DELAY old (o.all: every pending one, e.g. on delete).
    async finishRemovals(code, o = {}) {
      const list = lsGet(RM_KEY(code), []) || [];
      if (!list.length) return { removed: 0 };
      const due = list.filter((r) => o.all || clock.now() - r.at >= RM_DELAY);
      let removed = 0;
      for (const r of due) {
        const n = r.n;
        const docs = await fs.query(`events/${code}`, { from: 'media', where: [['s', '==', n]], select: ['vm'], limit: 20, auth: true });
        const writes = [fs.w.del(`events/${code}/seats/${n}`), fs.w.del(`events/${code}/guests/${n}`), fs.w.del(`events/${code}/book/${n}`)]
          .concat(docs.map((d) => fs.w.del(d._path)));
        for (const v of docs.filter((d) => typeof d.vm === 'number')) {
          const vs = await fs.get(`events/${code}/vs/${v.vm}`, { auth: true }).catch(() => null);
          if (vs && vs.id === v._id) writes.push(fs.w.del(`events/${code}/vs/${v.vm}`));
        }
        await fs.commit(writes, { auth: true });
        await db.del(`es/${code}/st/${n}`, { auth: true }).catch(() => {});
        removed++;
        lsSet(RM_KEY(code), (lsGet(RM_KEY(code), []) || []).filter((x) => x.n !== n));
      }
      return { removed };
    },
    async reports(code) {
      const docs = await fs.query(`events/${code}`, { from: 'reports', select: ['n', 'why', 'at'], limit: 300, auth: true });
      return docs.map((d) => ({ id: d._id, n: d.n || 0, why: d.why || 'other', at: d.at || 0 }));
    },
  };
  const guestsApi = { changes: (code, o) => changes('guests', code, o) };

  // ================================================================================================ photographer ===
  const XS_KEY = (code) => `luts:es-xs:${code}`;
  const pro = {
    upload: async (code, item) => (await pro.uploadMany(code, [item]))[0],
    // Up to 4 photos a commit; each claims an xs/{j} slot (j < pc) with a fresh token.
    async uploadMany(code, items = []) {
      const uid = await ensureStaff();
      const e = await getEvent(code, { maxAge: MIN });
      const now = clock.now();
      if (now < e.opensAt) throw err('NOT_OPEN', 0, 'Uploads open when the event opens');
      if (now >= e.fu) throw err('CLOSED', 0, 'Uploads have closed for this event.');
      if (!(e.cap.pc > 0)) throw err('FULL', 0, 'Photographer uploads switch on when the pass is confirmed');
      const used = new Set(lsGet(XS_KEY(code), []) || []);
      const prepared = [];
      for (const it of items) {
        const d = await toBytes(it.blob), t = await toBytes(it.thumb);
        if (!d || d.length < 1000 || d.length > 122880) throw err('DENIED', 0, 'That photo is too big');
        if (!t || t.length < 200 || t.length > 16384) throw err('DENIED', 0, 'Thumbnail out of range');
        prepared.push({ d, t, w: Math.round(+it.w || 1), h: Math.round(+it.h || 1), fn: (it.fn && e.fi.includes(it.fn)) ? it.fn : '', cp: clean(it.cp, 80) });
      }
      const pick = () => { const free = range(e.cap.pc).filter((j) => !used.has(j)); if (!free.length) return -1; return free[randInt(free.length)]; };
      const writesFor = (it, j, tk) => {
        const id = `x-${j}-${tk}`;
        return { id, writes: [
          fs.w.create(`events/${code}/xs/${j}`, { tk, by: uid, xp: fs.ts(e.expiresAt) }, { serverTime: ['at'] }),
          fs.w.create(`events/${code}/media/${id}`, { s: -1, k: j, kd: 'p', d: it.d, t: it.t, w: it.w, h: it.h, fn: it.fn, m: '', cp: it.cp, st: 1,
            rv: fs.ts(e.dp && e.dp.on ? e.dp.at : 0), hl: false, xp: fs.ts(e.fu), wm: !!e.cap.mk, by: uid }, { serverTime: ['mt', 'at'] }),
        ] };
      };
      const out = [];
      const one = async (it) => {
        for (let attempt = 0; attempt < 10; attempt++) {
          const j = pick();
          if (j < 0) throw err('FULL', 0, 'No photographer photos left for this event');
          const tk = randStr(12), w = writesFor(it, j, tk);
          try { await fs.commit(w.writes, { auth: true }); used.add(j); lsSet(XS_KEY(code), [...used]); return { id: w.id }; } catch (x) {
            if (x.code !== 'TAKEN' && x.code !== 'DENIED') throw x;
            used.add(j); lsSet(XS_KEY(code), [...used]);
            if (attempt === 3) { // many slots may be taken by other photographers: learn them in one listing
              try { (await fs.query(`events/${code}`, { from: 'xs', select: ['__name__'], limit: 600, auth: true })).forEach((d) => used.add(+d._id)); } catch (y) { /* keep guessing */ }
            }
          }
        }
        throw err('BUSY', 0, 'Could not reserve a photo slot. Try again.');
      };
      for (let i = 0; i < prepared.length; i += 4) {
        const chunk = prepared.slice(i, i + 4), plan = [];
        for (const it of chunk) { const j = pick(); if (j < 0) throw err('FULL', 0, 'No photographer photos left for this event'); used.add(j); plan.push(writesFor(it, j, randStr(12))); }
        try {
          await fs.commit([].concat(...plan.map((p) => p.writes)), { auth: true });
          lsSet(XS_KEY(code), [...used]);
          plan.forEach((p) => out.push({ id: p.id }));
        } catch (x) {
          if (x.code !== 'TAKEN' && x.code !== 'DENIED') { plan.forEach((p) => used.delete(+p.id.split('-')[1])); throw x; }
          for (const it of chunk) out.push(await one(it)); // retry one by one with fresh slots
        }
      }
      await bell.ring(code, e.approve ? 'q' : 'o').catch(() => {});
      return out;
    },
    async mine(code) {
      const uid = await ensureStaff();
      return fs.query(`events/${code}`, { from: 'media', where: [['by', '==', uid]], orderBy: [['at', 'asc']], limit: 600, select: SEL.media, auth: true });
    },
  };

  // ===================================================================================================== gallery ===
  const manifestCache = new Map();
  const needEM = (what) => { if (!window.EM || !window.EM[what]) throw err('DENIED', 0, 'event-media.js is not loaded'); return window.EM[what]; };
  // The rules store the wrapped key as pub/g.wr {s salt, i iv (string), c ciphertext, n iterations (int >= 100000)}.
  // EM.crypto.wrap may name iv and iterations the other way round; convert at this boundary, both ways.
  let emWrStyle = null;
  async function emStyle() {
    if (!emWrStyle) { const w = await needEM('crypto').wrap(new Uint8Array(32), 'probe password', 'probe', 10000); emWrStyle = typeof w.n === 'number' ? 'rules' : 'em'; }
    return emWrStyle;
  }
  const toRulesWr = (w) => (typeof w.n === 'number' ? { s: String(w.s), i: String(w.i), c: String(w.c), n: Math.round(w.n) } : { s: String(w.s), i: String(w.n), c: String(w.c), n: Math.round(+w.i) });
  const toEmWr = async (w) => ((await emStyle()) === 'rules' ? w : { s: w.s, i: w.n, c: w.c, n: w.i });
  const gallery = {
    key: {
      new: () => b64u.enc(crypto.getRandomValues(new Uint8Array(32))),
      async get(code) { const d = await fs.get(`events/${code}/private/key`, { auth: true }); if (!d || !d.k) throw err('NOT_FOUND', 404, 'No gallery key'); return d.k; },
      // Rotate: new key in private/key (pages must then be rewritten by the packer) and in pub.gk while it is live.
      async rotate(code) {
        const k = gallery.key.new();
        await fs.commit([fs.w.update(`events/${code}/private/key`, { k, xp: farXp() }, { serverTime: ['at'], exists: null })], { auth: true });
        const e = await getEvent(code, { maxAge: MIN });
        if (clock.now() < e.closesAt + DAY) await db.put(`es/${code}/pub/gk`, k, { auth: true }).catch(() => {});
        else await db.del(`es/${code}/pub/gk`, { auth: true }).catch(() => {});
        await bell.ring(code, 's').catch(() => {});
        return k;
      },
    },
    async manifest(code, o = {}) {
      const c = manifestCache.get(code);
      if (c && o.maxAge && Date.now() - c.at < o.maxAge) return c.m;
      let d;
      try { d = await fs.get(`events/${code}/pub/g`, { auth: false }); } catch (e) { if (e.code === 'DENIED' || e.code === 'NOT_FOUND') d = null; else throw e; }
      const m = d ? { pc: d.pc || 0, fc: d.fc || 0, vr: d.vr || 0, gi: d.gi || 0, xp: d.xp || 0 } : null;
      if (m && Array.isArray(d.pv)) m.pv = d.pv.map((x) => (Number.isInteger(x) && x >= 0 ? x : 0));
      if (m && d.wr) m.wr = d.wr;
      manifestCache.set(code, { at: Date.now(), m });
      return m;
    },
    // The version of page n: pv[n] (the packer bumps only the pages it rewrote); vr for a manifest without pv.
    pageVersion(m, n) {
      if (!m) return 0;
      if (Array.isArray(m.pv)) { const v = m.pv[n]; return Number.isInteger(v) && v >= 0 ? v : 0; }
      return Number.isInteger(m.vr) ? m.vr : 0;
    },
    // Decoded items of page n, cached on the device by code/n/version: o.pv (the manifest's pv array, or this page's
    // version as a number), else o.vr (old callers), else the manifest's own pv[n].
    async page(code, n, keyBytes, o = {}) {
      let v;
      if (Array.isArray(o.pv)) v = gallery.pageVersion({ pv: o.pv }, n);
      else if (Number.isInteger(o.pv)) v = o.pv;
      else if (o.vr !== undefined) v = o.vr;
      else v = gallery.pageVersion(await gallery.manifest(code, { maxAge: 30e3 }), n);
      const ck = `${code}/${n}/${v}`;
      const hit = await idb.get('pages', ck).catch(() => null);
      if (hit && hit.items) return hit.items;
      let d;
      try { d = await fs.get(`events/${code}/pages/${n}`, { auth: false }); } catch (e) {
        if (e.code !== 'DENIED') throw e;
        // A missing page also reads as "permission denied" (its rule reads resource.data): empty while the gallery
        // is live and this page is not written yet; ended otherwise.
        const m = await gallery.manifest(code, { maxAge: 30e3 }).catch(() => null);
        if (m && n >= m.pc && clock.now() < (+m.xp || 0)) return [];
        throw err('CLOSED', e.status, 'This gallery has ended.');
      }
      if (!d || !d.pk) return [];
      const items = await needEM('page').decode(d.pk, keyBytes);
      for (const old of await idb.list('pages', `${code}/${n}/`).catch(() => [])) await idb.del('pages', old.key).catch(() => {});
      await idb.put('pages', ck, { items, at: Date.now() }).catch(() => {});
      return items;
    },
    async link(code, o = {}) {
      const k = await gallery.key.get(code);
      if (!o.password) return urls.gallery(code, { k });
      const pw = String(o.password);
      if (pw.length < 10) throw err('DENIED', 0, 'A password needs at least 10 characters');
      const token = randStr(16);
      const wr = toRulesWr(await needEM('crypto').wrap(b64u.dec(k), pw, token));
      const cur = await gallery.manifest(code);
      await gallery.writeManifest(code, Object.assign({ pc: 0, fc: 0, vr: 0, gi: 0 }, cur || {}, { wr }), { noBell: true });
      return urls.gallery(code, { t: token });
    },
    async unlock(code, o = {}) {
      const p = new URLSearchParams(String(o.fragment || '').replace(/^#/, ''));
      const k = p.get('k'), t = p.get('t');
      if (k) { const b = b64u.dec(k); if (b.length !== 32) throw err('NOT_FOUND', 0, 'This gallery link is missing its key.'); return b; }
      if (t) {
        if (!o.password) throw err('DENIED', 0, 'Enter the password');
        const m = await gallery.manifest(code);
        if (!m || !m.wr) throw err('NOT_FOUND', 0, 'This gallery link is missing its key.');
        const wr = await toEmWr(m.wr);
        try { return await needEM('crypto').unwrap(wr, String(o.password), t); } catch (e) { throw err('DENIED', 0, 'Wrong password'); }
      }
      throw err('NOT_FOUND', 0, 'This gallery link is missing its key.');
    },
    async writePage(code, n, bytes, o = {}) {
      const e = await getEvent(code, { maxAge: MIN });
      await fs.commit([fs.w.update(`events/${code}/pages/${n}`, { pk: await toBytes(bytes), c: clamp(Math.round(+o.count || 0), 0, 100), se: !!o.sealed,
        vr: Math.round(+o.vr || 0), xp: fs.ts(e.expiresAt) }, { serverTime: ['at'] })], { auth: true });
    },
    async writeManifest(code, m = {}, o = {}) {
      const e = await getEvent(code, { maxAge: MIN });
      const body = { pc: clamp(Math.round(+m.pc || 0), 0, 100), fc: clamp(Math.round(+m.fc || 0), 0, 24), vr: Math.round(+m.vr || 0), gi: Math.round(+m.gi || 0), xp: fs.ts(e.expiresAt) };
      const mask = ['pc', 'fc', 'vr', 'gi', 'xp', 'at'];
      // pv: per-page versions (array of whole numbers, at most 100); absent keeps what is stored.
      if (Array.isArray(m.pv)) { body.pv = m.pv.slice(0, 100).map((x) => Math.max(0, Math.round(+x || 0))); mask.push('pv'); }
      if ('wr' in m) { mask.push('wr'); if (m.wr) body.wr = { s: String(m.wr.s), i: String(m.wr.i), c: String(m.wr.c), n: Math.round(+m.wr.n) }; }
      await fs.commit([fs.w.update(`events/${code}/pub/g`, body, { mask, serverTime: ['at'], exists: null })], { auth: true });
      manifestCache.delete(code);
      if (!o.noBell) await bell.ring(code, 'p').catch(() => {});
    },
  };
  const RX_KEY = (code) => `luts:es-rx:${code}`;
  async function react(code, gi, e) {
    if (!'hfwc'.includes(e) || e.length !== 1) throw err('DENIED', 0, 'Unknown reaction');
    const g = Math.round(+gi);
    if (!(g >= 0 && g < 4000)) throw err('DENIED', 0, 'Unknown photo');
    const given = lsGet(RX_KEY(code), {}) || {};
    if (String(given[g] || '').includes(e)) return false;
    await db.bump(`es/${code}/rx/${g}/${e}`);
    given[g] = String(given[g] || '') + e; lsSet(RX_KEY(code), given);
    stat(code, 'r');
    return true;
  }
  async function reactions(code) { return (await db.get(`es/${code}/rx`)) || {}; }
  function stat(code, kind) {
    const k = STAT_KEYS[kind];
    if (!k) return;
    (async () => {
      const p = pub.cached(code) || await pub.get(code, { maxAge: 5 * MIN });
      if (!p) return;
      const h = clamp(Math.floor((clock.now() - p.o) / HOUR), 0, 499);
      await db.bump(`es/${code}/stt/${h}/${k}`);
    })().catch(() => {});
  }
  async function stats(code) {
    const v = (await db.get(`es/${code}/stt`, { auth: true })) || {};
    const max = Object.keys(v).reduce((a, k) => Math.max(a, +k), -1);
    const hours = range(max + 1).map((h) => { const x = v[h] || {}; return { a: x.a || 0, u: x.u || 0, o: x.o || 0, r: x.r || 0, s: x.s || 0, d: x.d || 0, v: x.v || 0 }; });
    return { hours };
  }

  // ======================================================================================================= sweep ===
  // §2.8: expired documents (or everything, for "Delete this event"), the event doc last, then the RTDB tree and slot.
  async function sweep(code, o = {}) {
    const uid = await ensureStaff();
    const all = !!o.all;
    const lastKey = `luts:es-sweep:${code}`;
    if (!all) await media.finishRemovals(code).catch(() => {}); // guests removed here 10 minutes ago or more
    if (!all && Date.now() - (+lsGet(lastKey, 0) || 0) < 6 * HOUR) return { deleted: 0, skipped: true };
    const e = await getEvent(code);
    const role = e.host === uid ? 'h' : (e.roles || {})[uid];
    if (!role) throw err('DENIED', 403, 'Only the event team can tidy up');
    if (all && role !== 'h') throw err('DENIED', 403, 'Only the host can delete the event');
    if (clockSource !== 'probe') await clock.sync(code).catch(() => {}); // expiry is judged on the server's clock
    if (all) lsSet(RM_KEY(code), []);
    const now = clock.now();
    if (!all) {
      try {
        const lk = await db.get(`es/${code}/lk/sweep`, { auth: true });
        if (lk && lk.u !== uid && lk.un > now) return { deleted: 0, skipped: true };
        await db.put(`es/${code}/lk/sweep`, { u: uid, un: now + 110e3 }, { auth: true });
      } catch (x) { if (x.code === 'DENIED') return { deleted: 0, skipped: true }; throw x; }
    }
    let deleted = 0;
    const progress = (stage) => { if (o.onProgress) { try { o.onProgress({ stage, deleted }); } catch (x) { /* ignore */ } } };
    const colls = ['media', 'guests', 'seats', 'vs', 'xs', 'reports'].concat(role === 'h' || role === 'c' ? ['book', 'rsvp', 'orders'] : []);
    for (const coll of colls) {
      for (let guard = 0; guard < 100; guard++) {
        const q = { from: coll, select: ['__name__'], limit: 300, auth: true };
        if (!all) q.where = [['xp', '<', now]];
        let docs;
        try { docs = await fs.query(`events/${code}`, q); } catch (x) { if (x.code === 'DENIED') break; throw x; }
        if (!docs.length) break;
        for (let i = 0; i < docs.length; i += 400) { await fs.commit(docs.slice(i, i + 400).map((d) => fs.w.del(d._path)), { auth: true }); deleted += Math.min(400, docs.length - i); }
        progress(coll);
        if (docs.length < 300) break;
      }
    }
    const over = all || now > e.expiresAt;
    if (over) {
      // The manifest stops being readable at xp, so fall back to the most pages the plan allows (§2.7 bound).
      const m = await gallery.manifest(code).catch(() => null);
      const cp = e.cap || {};
      const maxPages = Math.min(100, Math.ceil((cp.lim * (cp.pg + cp.vg + 1) + cp.pc + 200) / 100));
      const pcN = m ? m.pc : maxPages, fcN = m ? m.fc : (cp.sx ? 24 : 0);
      const dels = range(pcN).map((n) => fs.w.del(`events/${code}/pages/${n}`)).concat(range(fcN).map((n) => fs.w.del(`events/${code}/faces/${n}`)));
      for (let i = 0; i < dels.length; i += 400) {
        const part = dels.slice(i, i + 400);
        try { await fs.commit(part, { auth: true }); deleted += part.length; } catch (x) {
          if (x.code !== 'DENIED' && x.code !== 'NOT_FOUND') throw x;
          for (const w of part) { try { await fs.commit([w], { auth: true }); deleted++; } catch (y) { if (y.code !== 'DENIED' && y.code !== 'NOT_FOUND') throw y; } } // a wall may delete only pages that exist
        }
      }
      for (const d of ['g', 'shop']) { try { await fs.commit([fs.w.del(`events/${code}/pub/${d}`)], { auth: true }); deleted++; } catch (x) { if (x.code !== 'DENIED' && x.code !== 'NOT_FOUND') throw x; } }
      progress('pages');
      if (role === 'h') {
        let members = [];
        try { members = await fs.query(`events/${code}`, { from: 'members', select: ['__name__'], limit: 100, auth: true }); } catch (x) { members = []; }
        await fs.commit(['plan', 'inv', 'key'].map((d) => fs.w.del(`events/${code}/private/${d}`)).concat(members.map((d) => fs.w.del(d._path))), { auth: true });
        await fs.commit([fs.w.del(`events/${code}`)], { auth: true });
        deleted += 4 + members.length; progress('event');
        let own = null;
        try { own = await db.get(`es/${code}/own`, { auth: true }); } catch (x) { own = null; }
        const upd = { [`es/${code}`]: null };
        if (own && own.sl !== undefined) { upd[`es_slot/${own.sl}`] = null; upd[`es_gov/${own.sl}`] = null; }
        try { await db.patch('', upd, { auth: true }); } catch (x) { await db.del(`es/${code}`, { auth: true }).catch(() => {}); }
        evCache.delete(code); pubCache.delete(code);
        forget(code);
        progress('done');
      }
    }
    lsSet(lastKey, Date.now());
    return { deleted };
  }

  // ======================================================================================================== misc ===
  // Dates for India: "31 December 2026" in English, the same order in the Indian languages.
  function fmtDate(ms, lang, tz) {
    lang = /^[a-z]{2}$/.test(lang || '') ? `${lang}-IN` : (lang || 'en-IN');
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    try { return new Intl.DateTimeFormat(lang || 'en', Object.assign({ timeZone: tz || undefined }, opts)).format(new Date(ms)); } catch (e) {
      try { return new Intl.DateTimeFormat(lang || 'en', opts).format(new Date(ms)); } catch (x) { return new Date(ms).toDateString(); }
    }
  }
  function noticeLines(p, lang) {
    const ft = p.ft || {};
    const L = ['Before you share a photo',
      p.ap ? 'Your name and photos appear on the event screen after the hosts check them.' : 'Your name and photos appear on the event screen right away.',
      'People with the event code or the gallery link can see the photos.'];
    if (ft.sx) L.push('Guests can find photos of themselves with selfie search, on their own phone.');
    if (p.tp === 'birthday') L.push("Please don't share photos of other people's children without asking.");
    L.push(`Photos are kept until ${fmtDate(p.x, lang, p.tz)}, then deleted.`);
    if (p.fu < p.x) L.push(`Full-size copies are kept until ${fmtDate(p.fu, lang, p.tz)}.`);
    L.push(p.ct ? `To remove a photo, tap “Delete my photos” on this page, or ask ${p.ct}.` : 'To remove a photo, tap “Delete my photos” on this page, or ask the hosts.');
    L.push('Light Up the Skies keeps these photos only for this event and never uses them for anything else.');
    return L;
  }
  function notice(pIn, o = {}) {
    const p = pIn && typeof pIn.cap === 'string' ? decodePub(pIn) : (pIn || {});
    const lines = noticeLines(p, o.lang || 'en');
    const en = noticeLines(p, 'en');
    const ticks = [
      { id: 'show', text: 'I agree my name and photos appear on the event screen and in the event gallery.', required: true },
      { id: 'adult', text: "I'm 18 or older, or I'm a parent or guardian sharing for my child.", required: true },
    ];
    if ((p.ft || {}).sx) ticks.push({ id: 'face', text: 'Let selfie search include my face.', required: false });
    const noI18n = [];
    if (p.nt) { lines.push(p.nt); en.push(p.nt); noI18n.push(lines.length - 1); }
    const settings = JSON.stringify({ ap: !!p.ap, sx: !!(p.ft || {}).sx, x: p.x, fu: p.fu, ct: p.ct || '', nt: p.nt || '', tp: p.tp || '' });
    const version = fnv1a(en.join('\n') + '\n' + settings + '\n' + ticks.map((t) => t.text).join('\n'));
    return { lines, version, ticks, noI18n };
  }
  const urls = {
    pair: (p) => `${urls.base()}event-host.html?pair=${encodeURIComponent(String(p || ''))}`,
    base: () => String(CFG().base || '').replace(/\/?$/, '/'),
    guest: (code, o = {}) => `${urls.base()}event.html?e=${code}${o.lang && LANGS.includes(o.lang) ? `&l=${o.lang}` : ''}`,
    wall(code, o = {}) {
      const q = [`e=${code}`];
      if (o.screen && ['main', 'slides', 'mirror'].includes(o.screen)) q.push(`screen=${o.screen}`);
      if (o.tv) q.push('tv=1');
      if (o.join) q.push(`j=${String(o.join).startsWith('w.') ? o.join : 'w.' + o.join}`);
      return `${urls.base()}event-wall.html?${q.join('&')}`;
    },
    host: (code) => `${urls.base()}event-host.html${code ? `?e=${code}` : ''}`,
    gallery: (code, o = {}) => `${urls.base()}event-gallery.html?e=${code}${o.k ? `#k=${o.k}` : o.t ? `#t=${o.t}` : ''}`,
    pro: (code) => `${urls.base()}event-pro.html?e=${code}`,
    play(src, medium) {
      const s = String(src || 'event_sky').replace(/[^a-z0-9_]/gi, '').slice(0, 40) || 'event_sky';
      const m = medium === 'web' ? 'web' : 'share';
      return `https://play.google.com/store/apps/details?id=${CFG().playId || 'com.stalinpusparaj.lightuptheskies'}&referrer=${encodeURIComponent(`utm_source=${s}&utm_medium=${m}&utm_campaign=event_sky`)}`;
    },
  };
  function caption(kind, ctx = {}) {
    const title = String(ctx.title || ctx.names || 'our celebration').trim();
    const first = { invite: `${title} — scan or tap to check in and light up the sky ✨`, gallery: `Photos from ${title} 📸`, video: `Best of ${title} ✨`,
      book: `${title} — our photo book`, print: `${title} — table card` }[kind] || title;
    const lines = [first];
    if (ctx.url) lines.push(String(ctx.url));
    lines.push(`${CFG().keywords || 'Light Up the Skies'}: ${urls.play('event_' + (kind || 'share'))}`);
    lines.push('#LightUpTheSkies · tag us and we’ll feature the best');
    return lines.join('\n');
  }

  // ---------- QR code (byte mode, ECC level M, versions 1-15). Written for this project after the public QR spec
  // (ISO/IEC 18004) and the structure of Project Nayuki's MIT-licensed encoder. ----------
  const QR = (function () {
    const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24]; // codewords per block, level M, v1..15
    const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
    const MAXV = 15;
    const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
    const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC[v - 1] * BLOCKS[v - 1];
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
    function divisor(deg) {
      const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
      for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); }
      return r;
    }
    function remainder(data, div) {
      const r = new Array(div.length).fill(0);
      for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
      return r;
    }
    function alignPos(v, size) {
      if (v === 1) return [];
      const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      const r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
      return r;
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const ccBits = (v) => (v <= 9 ? 8 : 16);
    function encode(text) {
      const bytes = Array.from(new TextEncoder().encode(String(text)));
      let v = 1; while (v <= MAXV && 4 + ccBits(v) + bytes.length * 8 > dataCodewords(v) * 8) v++;
      if (v > MAXV) throw err('DENIED', 0, 'QR text too long');
      const cap = dataCodewords(v) * 8, bits = [];
      const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, ccBits(v)); bytes.forEach((b) => put(b, 8));
      put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
      for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
      const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
      const nb = BLOCKS[v - 1], ecl = ECC[v - 1], raw = Math.floor(rawModules(v) / 8), short = nb - raw % nb, shortLen = Math.floor(raw / nb);
      const div = divisor(ecl), blocks = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const d = data.slice(k, k + shortLen - ecl + (i < short ? 0 : 1)); k += d.length;
        const e = remainder(d, div); if (i < short) d.push(0); blocks.push(d.concat(e));
      }
      const words = [];
      for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= short) words.push(b[i]); });
      const size = v * 4 + 17, m = [], fn = [];
      for (let y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
      const setF = (x, y, on) => { m[y][x] = !!on; fn[y][x] = true; };
      for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
      };
      finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
      const ap = alignPos(v, size);
      ap.forEach((ax, i) => ap.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
      const drawFormat = (mask) => {
        const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, bit = (i) => (b >>> i) & 1;
        for (let i = 0; i <= 5; i++) setF(8, i, bit(i)); setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
        setF(8, size - 8, 1);
      };
      drawFormat(0);
      if (v >= 7) {
        let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) { const on = (b >>> i) & 1, a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, on); setF(c, a, on); }
      }
      let i = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!fn[y][x] && i < words.length * 8) { m[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
        }
      }
      const applyMask = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        for (let a = 0; a < size; a++) {
          let rr = 1, rc = 1;
          for (let b = 1; b < size; b++) {
            if (m[a][b] === m[a][b - 1]) { rr++; if (rr === 5) p += 3; else if (rr > 5) p++; } else rr = 1;
            if (m[b][a] === m[b - 1][a]) { rc++; if (rc === 5) p += 3; else if (rc > 5) p++; } else rc = 1;
          }
        }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
        m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
        return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      };
      let best = 0, bestP = Infinity;
      for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } applyMask(k); }
      applyMask(best); drawFormat(best);
      return { size, version: v, mask: best, modules: m };
    }
    function draw(canvas, text, scale = 4) {
      const q = encode(text), quiet = 4, n = q.size + quiet * 2;
      canvas.width = canvas.height = n * scale;
      const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n * scale, n * scale); g.fillStyle = '#000';
      q.modules.forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale); }));
      return q;
    }
    return { encode, draw };
  })();

  // ====================================================================================================== export ===
  window.ES = {
    version: 2,
    ESError, err,
    cfg,
    PLANS, EXPECT, TEMPLATES, TEMPLATE_GROUPS, WORLDS, LANGS, CODE_RE, CODE_CHARS, caps, rank,
    staff: { token: () => token(), uid: staffUid },
    fs, db, clock, bell, events, pub, live, roles, pair, passes,
    guest, rsvp, report, media, guests: guestsApi, pro, gallery,
    react, reactions, stat, stats,
    notice, caption, urls, QR,
    gov: govApi, sweep, idb,
    b64u, sha256hex, fmtKey, clean,
    _meter: meter,
  };
})();
