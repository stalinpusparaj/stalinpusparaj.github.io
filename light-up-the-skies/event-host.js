/* Event Sky organiser console: window.EventHost (event-host.html). Build spec: research/event-sky-spec.md §3.7 (WP-F),
 * with the screens of §4.11–§4.18 and §4.21–§4.25.
 *
 *  event-host.html            My events (cards, host key, "Manage on a laptop", host-key recovery)
 *  event-host.html?e=CODE     the event's dashboard: Photos (moderation deck with swipe, J/K/P/R/Z/F and undo), Live
 *                             (announcements, challenge, disposable camera, finale), Team (invites), Screens (wall link,
 *                             TV pairing, wall settings), Share & print, Gallery (link, days, password, new link, selfie
 *                             search), Downloads (ZIP, best-of MP4, photo book, CSVs, reminder), Guests, RSVP, Guestbook,
 *                             Stats, Shop (only with es_cfg.shop) and Settings (edit, check-in, plan, host key, delete)
 *  ?j=role.secret             joins first (co-host or moderator; photographer and screen links go to their own pages)
 *  ?new=1                     the create wizard (in the app only; on the web it points to the app)
 *  ?tv=1                      TV layout
 *
 * Load order: event-config.js, event-host.js (this file: it sets the i18n globals and starts on DOMContentLoaded),
 * i18n.js, event-sky.js, event-media.js, event-zip.js, event-pdf.js, event-mp4.js, drone-show.js, event-fx.js,
 * event-print.js, event-export.js, event-stats.js, tv.js. Lazy: event-packer.js (gallery pages when no wall runs it),
 * event-shop.js (es_cfg.shop), face/face-search.js (selfie search, bundled; its model data from cfg.faceBase).
 *
 * Test hooks: window.EventHost.state(), refresh(), flush(), visible(), selectTab(), openEvent(), showMine(), tune().
 */
/* STRINGS:
My events
Use a Wish Reel you bought earlier
{0} wishes didn't fit in 3 minutes. Untick some under Choose the wishes.
1 wish didn't fit in 3 minutes. Untick some under Choose the wishes.
This phone can't add sound to videos, so this one is silent.
{0} of {1} wishes chosen
Get the Wish Reel for {0}
Wish Reel unlocked for this event ✓
Included with Premium ✓
Included with your pass ✓
The Wish Reel isn't available right now.
Payment processing: your Wish Reel unlocks automatically.
{0} wishes didn't fit in the free 30-second video.
1 wish didn't fit in the free 30-second video.
That song did not open. Try another one.
Create an event
Create your event in the Light Up the Skies app
Get it on Google Play
No events on this device yet.
Join an event as a guest
Show an event on this TV
Use a host key
Open
Host
co-host
moderator
photographer
screen
Host key
Manage on a laptop
Remove from this list
Scan this with your laptop's camera, or open the link there. It joins as a co-host.
Show the laptop link
Event code
Your host key
Use this key
Anyone with this key can take over your event. Show it?
Show the host key
What are you celebrating?
Wedding
Birthday
Party
Office event
Details
Title
Sky
Language for guests
About how many guests?
Functions
Up to 8 functions with the Shaadi Pass
Add a function
Function name
Remove
Time
Check-in opens
Check-in closes
Keep the gallery for
{0} days
Times are in {0}.
Plan
Privacy
Check photos before they show
Contact for photo removal
A phone number or email guests can use
Note for guests (optional)
Disposable camera
Reveal time
Your event is ready
Save your host key
If you change phones, this key makes the new phone the host. Keep it somewhere safe.
Copy
I've saved it
Back
Next
Create the event
Creating…
Add a title
Check-in must close after it opens
Check-in opens within 200 days
This plan allows events up to {0} days long. Change the times or pick another plan.
This plan allows events up to 24 hours long. Change the times or pick another plan.
Checking your date…
Your date is available ✓
Fully booked for new free events today. Try again after 5:30 AM.
Our free cloud is fully booked on {0}. Pick another date or a smaller plan.
Event Sky is paused for a moment. Please try again later.
Free
Up to 30 guests · selfie + 2 photos each · 3-day gallery · photos carry the Light Up the Skies mark
Event Pass
Up to 300 guests · 4 photos each · photographer uploads · 30-day gallery · no mark · ZIP, photo book and best-of video
Shaadi Pass
Up to 500 guests across up to 8 functions · RSVP with headcounts · 4 photos and a 15-second video each · voice guestbook · your logo · selfie search · 90-day gallery
Planner 10-pack
10 Event Passes to use any time
Corporate
Full-size photos are kept for 14 days; after that your 300 highlights stay full size and the rest stay as small previews.
Have an activation code?
Use code
This code gives {0} ({1} uses left).
That code has been used.
That code has expired.
That isn't a valid code.
Use an Event Pass credit ({0} left)
Use a Shaadi Pass credit ({0} left)
Planner credits: {0} left
Pay {0} with Google Play
Passes aren't available right now.
Payment processing: your pass arrives automatically.
Purchase cancelled
Purchased ✓
For companies and planners: ask us for a code.
For companies: ask us for a code
Bought a pass on an earlier install? Write to us with the order number and we'll move it.
Only the first {0} functions are kept on this plan.
The gallery is kept for {0} days on this plan.
Photos
Live
Team
Screens
Share & print
Gallery
Downloads
Guests
RSVP
Guestbook
Stats
Shop
Settings
Waiting {0} · Shown {1} · Hidden {2}
All
Arrivals
Videos
Reported ({0})
Moderators online: {0}
Photo to check
All caught up ✨
Swipe right to show, left to hide.
Show
Hide
Highlight
Previous
Undo
Keys
Shown · Undo
Hidden · Undo
Undone
Highlighted
Highlight removed
Recently shown
Keep showing
Reported {0} times: {1}
It's me and I want it removed
It's rude or unkind
It shows a child who shouldn't be shown
Something else
Arrival
Video
Photographer
Mission: {0}
Play
Keyboard keys
next
previous
show
hide
undo
highlight
this help
Announcements
Text
Banner
Full screen with countdown
Countdown (minutes)
Announce now
Schedule an announcement
Varmala in 10 minutes
Free events show announcements as a banner.
Scheduled
{0} of 20 announcements
No room for more scheduled announcements. Remove one first.
Pick a time for the announcement
Announced ✓
Scheduled ✓
Start a photo challenge
Minutes
Mission (optional)
None
Start the challenge
Photo challenge: {0}
{0} left
The challenge is over — look at the screen!
Pick the winner
Winner picked ✓
No photos for this challenge yet.
Timed challenges, the disposable camera and full-screen announcements come with a pass.
Shots per guest
Save
Saved ✓
Reveal the photos now
Reveal at the finale
Revealed ✓
Grand finale
The names light up the sky in fireworks and drones on every screen.
Start the finale
The finale starts in a few seconds on every screen.
Invite a co-host
Invite a moderator
Invite a photographer
Add a screen
Anyone with this link can join as {0}. Make a new link to stop the old one.
Share
Make a new link
Turn this link off
This link is off.
Copied
(this device)
Remove {0} from the team?
Removed
Open the wall on this device
Open on another screen
Main
Slideshow
Mirror
Show the screen link
Pair a TV
Enter the code shown on the TV (10 letters and numbers), or scan its QR code
Pair
Paired ✓ The TV opens the wall in a few seconds.
Big screen
Mode
Mix
Fireworks
Mosaic
Slideshow length (seconds)
QR size
Small
Medium
Large
QR corner
Bottom right
Bottom left
Top right
Top left
Videos that flash a lot
Play dimmed
Skip them
Arrival sound
Hide QR
Show QR
Guest link
Print
Table cards (4 per A4 sheet)
A4 poster
A5 poster
Language on the cards
Download PDF
Download PNG
Preparing…
Preview of the printable
Gallery link
Add a password
Password
Suggest one
A password needs at least 10 characters
Share the password separately.
Make a new link (old links stop working)
Old links stop working. Guests need the new link.
The new link is ready ✓
The big screen updates the gallery pages in a minute.
Photos are kept until {0}.
Full-size copies are kept until {0}.
Selfie search
This looks at the event photos on this device to find faces. It can take a few minutes.
Prepare selfie search
Update selfie search
Selfie search is switched off for now.
Selfie search is prepared on a laptop. Open this event there with “Manage on a laptop”.
Preparing… {0}%
Selfie search is ready ✓
All photos and videos (ZIP)
Highlights
Download
Best-of video (about 60 s)
Free events get a 30-second video with the Light Up the Skies mark.
Vertical (WhatsApp status)
Wide (TV)
Calmer fireworks
Photo book (PDF, up to 300 photos)
All photos
1 photo per page
4 photos per page
Lists
Guest list (CSV)
RSVP (CSV)
Stats (CSV)
Consent log (CSV)
Analytics (CSV)
Remind me to download
Download your photos before {0}
This is a big download (about {0} MB). Use Wi-Fi?
Saved to Downloads
Saved. Share it?
Part {0} of {1}
Cancel
Cancelled
A photo book holds up to 300 photos. Pick highlights first.
Guests checked in: {0}
Waiting
On screen
Not shown
Show more
Remove guest
This removes {0}'s check-in, photos, videos and message. It can't be undone.
RSVP is on the Shaadi Pass and for companies.
{0} households
{0} households · {1} people
Share the RSVP link
Download RSVP (CSV)
Name
Phone
Food
Note
Updated
Delete this RSVP?
Only the hosts can read and hear these. They never show on the big screen.
No messages yet.
Your pass is being confirmed with Google Play. Full photo limits switch on automatically, usually within a few hours.
Event
Language
Photo missions
Add a mission
On the guest page and gallery
Voice messages in the guestbook
Guests can download photos
Videos play in the gallery
Reactions
Your logo
Remove the logo
Check-in
Opens {0}
Open until {0}
Check-in has closed.
Close check-in now
Reopen until {0}
Close check-in now? Guests can't check in or send photos after this.
Plan: {0}
Delete this event
This deletes every photo, video, message and RSVP now. It can't be undone.
Type the event code to confirm
Delete everything
Deleting… {0}
Deleted.
Leave this event
Leave this event? You'll need a new invite to come back.
Busy night: the gallery shows small previews for now.
Very busy: the big screen shows new photos every 30 seconds.
Paused for a moment — we'll be right back
Joining…
We couldn't open this event.
You're not on this event's team.
No connection. Try again when you're back online.
Something went wrong. Try again.
That isn't allowed for your role.
QR code
The event is full.
Check-in has not opened yet
This event has ended.
That event code is already in use. Try again.
Busy. Try again in a moment.
Close
Done
*/
(function () {
  'use strict';
  // ---- i18n globals: this file is loaded before i18n.js (§5.2): event dictionaries, their own saved language, and
  // the game's language as the default for the console. ----
  try {
    window.LUTS_I18N_KEY = 'luts:es-lang';
    window.LUTS_I18N_DIR = 'i18n/event/';
    const game = localStorage.getItem('luts:lang');
    if (game && /^[a-z]{2}$/.test(game)) window.LUTS_I18N_LANG = game;
    if (!localStorage.getItem('luts:es-lang')) localStorage.setItem('luts:es-lang', 'auto');
  } catch (e) { /* storage blocked: English */ }
  if (window.EventHost) return;

  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
  const $ = (id) => document.getElementById(id);
  const T = (s) => { try { return (window.LUTSLang && typeof LUTSLang.t === 'function' && LUTSLang.t(s)) || s; } catch (e) { return s; } };
  // English with {0}… filled: DOM text is translated by i18n.js as it appears (patterns with holes).
  const F = (s, ...a) => String(s).replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  const TF = (s, ...a) => F(T(s), ...a); // for attributes and canvas (translated, then filled)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full */ } };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'raw') el.dataset.noI18n = '';
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  // User content (names, titles, captions, codes) is never translated.
  const raw = (tag, text, attrs) => h(tag, Object.assign({ 'data-no-i18n': '' }, attrs || {}), text == null ? '' : String(text));
  const btn = (label, on, attrs) => h('button', Object.assign({ type: 'button', class: 'eh-btn', onclick: on }, attrs || {}), label);

  // ================================================================================================= state ===
  const S = {
    view: '', code: '', ev: null, pub: null, live: {}, role: '', uid: '', cfg: null, tab: '', watch: null, level: 0,
    app: false, tv: false, timers: [], packer: null, keyB64: '', galleryUrl: '',
  };
  const ROLE_NAME = { h: 'Host', c: 'co-host', m: 'moderator', p: 'photographer', w: 'screen' };
  const PLAN_NAME = { free: 'Free', event: 'Event Pass', shaadi: 'Shaadi Pass', corp: 'Corporate' };
  const LANG_NAMES = { en: 'English', hi: 'हिन्दी', bn: 'বাংলা', mr: 'मराठी', te: 'తెలుగు', ta: 'தமிழ்', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ' };
  const TABS = ['photos', 'live', 'team', 'screens', 'share', 'gallery', 'downloads', 'guests', 'rsvp', 'book', 'stats', 'shop', 'settings'];
  const TAB_OF_ROLE = {
    h: TABS, c: TABS,
    m: ['photos', 'screens', 'guests', 'stats', 'settings'],
  };
  const isHost = () => S.role === 'h';
  const isCohost = () => S.role === 'h' || S.role === 'c';
  const capOf = () => (S.ev && S.ev.cap) || {};
  const now = () => (window.ES ? ES.clock.now() : Date.now());
  function every(fn, ms) { const id = setInterval(() => { try { const r = fn(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* next time */ } }, ms); S.timers.push(id); return id; }

  // ================================================================================================= format ===
  const locale = () => { const l = (window.LUTSLang && LUTSLang.lang) || 'en'; return /^[a-z]{2}$/.test(l) ? `${l}-IN` : 'en-IN'; };
  function fmt(ms, o) {
    if (!Number.isFinite(+ms) || !ms) return '';
    const tz = (S.ev && S.ev.tz) || undefined;
    try { return new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: tz }, o)).format(new Date(+ms)); } catch (e) {
      try { return new Intl.DateTimeFormat(locale(), o).format(new Date(+ms)); } catch (x) { return new Date(+ms).toLocaleString(); }
    }
  }
  const fmtDate = (ms) => fmt(ms, { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDT = (ms) => fmt(ms, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const fmtTime = (ms) => fmt(ms, { hour: 'numeric', minute: '2-digit' });
  const pad2 = (n) => String(n).padStart(2, '0');
  function toLocal(ms) { if (!ms) return ''; const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function fromLocal(s) { if (!s) return NaN; const t = new Date(s).getTime(); return Number.isFinite(t) ? t : NaN; }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; }
  const worldName = (id) => String(id || '').split('-').map((w) => (w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

  // ================================================================================================ errors ===
  // ES messages a page may show as they are (they are in event-sky.js's STRINGS); anything else gets our own copy.
  const ES_COPY = new Set(['That code has been used.', 'That code has expired.', "That isn't a valid code.", 'This pass has been used.', 'Check-in has closed.',
    'Check-in has not opened yet', 'The event is full.', 'Enter the 10 letters and numbers shown on the TV', 'That PIN is not on any TV right now', 'That code is not on any TV right now', 'Only the host can pair a TV', 'Only the hosts can pair a TV',
    'A password needs at least 10 characters', 'That invite link is not complete', 'This invite link no longer works. Ask the hosts for a new one.',
    'Only the hosts can make invite links', 'Only the host can upgrade', 'Only the host can delete the event', 'That is not an upgrade for this event',
    'An upgrade needs a code or a pass', 'A host key has 16 letters and numbers', 'That host key does not match this event',
    'A contact for photo removal is required on paid plans', 'The opening time is fixed once the event has opened', 'Logo too large',
    'Write the announcement first', 'Name the challenge first', 'Event Sky is paused for a moment', 'Event Sky is full right now',
    'Could not reserve an event code. Try again.', 'Fully booked for new free events today', 'Fully booked for new passes today', 'No connection',
    'Sign-in needs a connection', 'You have made 3 events today. Try again tomorrow, or use an activation code.']);
  function errText(e) {
    const c = e && e.code, m = String((e && e.message) || '');
    if (ES_COPY.has(m)) return m;
    switch (c) {
      case 'OFFLINE': return 'No connection. Try again when you\'re back online.';
      case 'QUOTA': return 'Paused for a moment — we\'ll be right back';
      case 'PAUSED': return 'Event Sky is paused for a moment. Please try again later.';
      case 'CODE_USED': return 'That code has been used.';
      case 'CODE_EXPIRED': return 'That code has expired.';
      case 'CODE_BAD': return "That isn't a valid code.";
      case 'FULL': return m && /booked/i.test(m) ? 'Fully booked for new free events today. Try again after 5:30 AM.' : 'The event is full.';
      case 'CLOSED': return 'Check-in has closed.';
      case 'NOT_OPEN': return 'Check-in has not opened yet';
      case 'NOT_FOUND': return 'We couldn\'t open this event.';
      case 'TAKEN': return 'That event code is already in use. Try again.';
      case 'BUSY': return 'Busy. Try again in a moment.';
      case 'BOOKED': return 'Event Sky is full right now';
      case 'DENIED': return 'That isn\'t allowed for your role.';
      default: return 'Something went wrong. Try again.';
    }
  }

  // ================================================================================================ UI bits ===
  let toastTimer = null;
  function toast(text, o = {}) {
    const t = $('toast'), a = $('toastAct');
    $('toastText').textContent = text; $('toastText').hidden = !text;
    if (o.action) { a.hidden = false; a.textContent = o.action; a.onclick = () => { hideToast(); o.onAction(); }; } else { a.hidden = true; a.onclick = null; }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, o.ms || 4000);
  }
  function hideToast() { $('toast').hidden = true; clearTimeout(toastTimer); }
  const toastErr = (e) => toast(errText(e), { ms: 5000 });

  let sheetClose = null, sheetReturn = null;
  function openSheet(title, body, onClose) {
    sheetReturn = document.activeElement;
    $('sheetTitle').textContent = title;
    const b = $('sheetBody'); b.textContent = '';
    b.append(body);
    $('sheet').hidden = false;
    sheetClose = onClose || null;
    setTimeout(() => { const f = b.querySelector('input,button,select,textarea,a[href]') || $('sheetX'); try { f.focus(); } catch (e) { /* fine */ } }, 30);
  }
  function closeSheet() {
    if ($('sheet').hidden) return false;
    $('sheet').hidden = true; $('sheetBody').textContent = '';
    const f = sheetClose; sheetClose = null;
    if (f) { try { f(); } catch (e) { /* fine */ } }
    if (sheetReturn && sheetReturn.focus) { try { sheetReturn.focus(); } catch (e) { /* gone */ } }
    return true;
  }
  // A yes/no question in the sheet. Resolves true or false.
  function ask(title, text, yes, o = {}) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; resolve(v); closeSheet(); };
      const body = h('div', null, text ? h('p', null, text) : null,
        h('div', { class: 'eh-row wrap' },
          h('button', { type: 'button', class: 'es-btn ghost', onclick: () => fin(false) }, o.no || 'Cancel'),
          h('button', { type: 'button', class: `es-btn${o.danger ? ' danger' : ''}`, onclick: () => fin(true) }, yes)));
      openSheet(title, body, () => { if (!done) { done = true; resolve(false); } });
    });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied'); return; } catch (e) { /* fall back */ }
    const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0' }); ta.value = text;
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Something went wrong. Try again.'); }
    ta.remove();
  }
  async function shareText(text, url) {
    try {
      const r = await EM.share({ text, url });
      if (r === 'copied') toast('Copied');
      else if (r === 'unsupported') copy([text, url].filter(Boolean).join('\n'));
    } catch (e) { copy([text, url].filter(Boolean).join('\n')); }
  }
  function drawQr(canvas, url) {
    try { ES.QR.draw(canvas, url, 4); canvas.setAttribute('aria-label', `${T('QR code')}: ${url}`); } catch (e) { /* too long */ }
  }
  function busy(el, on) { if (el) { el.disabled = !!on; el.setAttribute('aria-busy', on ? 'true' : 'false'); } }
  async function act(el, fn) { // run a button's action once at a time, with the error shown
    if (el && el.disabled) return undefined;
    busy(el, true);
    try { return await fn(); } catch (e) { if (e && e.code !== 'CANCELLED') toastErr(e); return undefined; } finally { busy(el, false); }
  }
  function setBanner(text, cls) { const b = $('banner'); if (!text) { b.hidden = true; return; } b.textContent = text; b.className = `eh-banner${cls ? ' ' + cls : ''}`; b.hidden = false; }
  function setLevel(level) {
    S.level = level | 0;
    if (S.level >= 3) setBanner('Paused for a moment — we\'ll be right back');
    else if (S.level === 2) setBanner('Very busy: the big screen shows new photos every 30 seconds.', 'l1');
    else if (S.level === 1) setBanner('Busy night: the gallery shows small previews for now.', 'l1');
    else setBanner('');
  }
  function setHeader(title, sub, raw) {
    const t = $('hdTitle'); t.textContent = title;
    if (raw) t.dataset.noI18n = ''; else delete t.dataset.noI18n;
    $('hdSub').textContent = sub || '';
    const r = $('hdRole');
    if (S.view === 'event' && S.role) { r.textContent = ROLE_NAME[S.role]; r.hidden = false; } else r.hidden = true;
    document.title = `${S.view === 'event' ? title : T(title)} – Event Sky`;
  }
  function setView(v) {
    S.view = v;
    for (const id of ['vMine', 'vNew', 'vEvent']) $(id).hidden = id !== { mine: 'vMine', new: 'vNew', event: 'vEvent' }[v];
    window.scrollTo(0, 0);
  }
  function langOptions(sel, value, withAuto) {
    sel.textContent = '';
    for (const l of (window.ES && ES.LANGS) || Object.keys(LANG_NAMES)) sel.append(raw('option', LANG_NAMES[l] || l, { value: l }));
    if (withAuto) sel.prepend(h('option', { value: '' }, 'All'));
    sel.value = value || 'en';
  }
  function worldPicker(box, value, onPick) {
    box.textContent = '';
    for (const w of ES.WORLDS) {
      const b = h('button', { type: 'button', class: 'eh-world', role: 'radio', 'aria-checked': String(w === value), 'aria-label': worldName(w), 'data-w': w, 'data-no-i18n': '' },
        h('img', { src: `assets/worlds/thumb/${w}.webp`, alt: '', loading: 'lazy', decoding: 'async' }), raw('span', worldName(w)));
      b.addEventListener('click', () => { box.querySelectorAll('.eh-world').forEach((x) => x.setAttribute('aria-checked', String(x === b))); onPick(w); });
      box.append(b);
    }
  }

  // ============================================================================================== My events ===
  function showMine() {
    stopEvent();
    setView('mine');
    S.code = ''; S.role = '';
    setHeader('My events', '');
    try { history.replaceState(null, '', `event-host.html${S.tv ? '?tv=1' : ''}`); } catch (e) { /* file: */ }
    $('lnkTv').hidden = !S.tv;
    $('mineWeb').hidden = true;
    const list = window.ES ? ES.events.mine() : [];
    const ul = $('mineList'); ul.textContent = '';
    $('mineEmpty').hidden = list.length > 0;
    for (const m of list) {
      const li = h('li', { class: 'eh-ev' },
        raw('h3', m.title || m.code),
        h('p', { class: 'eh-muted' }, raw('span', m.at ? fmtDate(m.at) : ''), ' · ', raw('span', m.code, { class: 'eh-mono' }), ' · ', h('span', null, ROLE_NAME[m.role] || ROLE_NAME.c)));
      const row = h('div', { class: 'eh-row wrap' });
      row.append(h('button', { type: 'button', class: 'es-btn eh-ev-open', onclick: () => openEvent(m.code) }, 'Open'));
      if (m.role === 'h') {
        row.append(btn('Host key', () => showHostKey(m.code)));
        row.append(btn('Manage on a laptop', () => laptopLink(m.code)));
      }
      row.append(btn('Remove from this list', async () => {
        if (await ask('Remove from this list', null, 'Remove')) { ES.events.forget(m.code); showMine(); }
      }));
      li.append(row);
      ul.append(li);
    }
  }
  async function showHostKey(code) {
    if (!await ask('Host key', 'Anyone with this key can take over your event. Show it?', 'Show the host key')) return;
    try {
      const k = await ES.events.hostKey(code);
      openSheet('Your host key', h('div', null, raw('p', k || '', { class: 'eh-key' }), h('p', null, 'If you change phones, this key makes the new phone the host. Keep it somewhere safe.'),
        h('div', { class: 'eh-row' }, h('button', { type: 'button', class: 'es-btn ghost', onclick: () => copy(k) }, 'Copy'))));
    } catch (e) { toastErr(e); }
  }
  // The secret of a live invite link (host and co-hosts can read private/inv), or a new one.
  async function inviteUrl(code, role, fresh) {
    const page = { c: 'event-host.html', m: 'event-host.html', p: 'event-pro.html', w: 'event-wall.html' }[role];
    if (!fresh) {
      try {
        const inv = await ES.fs.get(`events/${code}/private/inv`, { auth: true });
        if (inv && /^[A-Za-z0-9]{22}$/.test(inv[role] || '')) return { url: `${ES.urls.base()}${page}?e=${code}&j=${role}.${inv[role]}`, secret: inv[role] };
      } catch (e) { if (e.code !== 'NOT_FOUND') throw e; }
    }
    return ES.roles.invite(code, role);
  }
  async function laptopLink(code) {
    try {
      const { url } = await inviteUrl(code, 'c');
      const cv = h('canvas', { class: 'eh-qr', role: 'img' });
      drawQr(cv, url);
      openSheet('Manage on a laptop', h('div', null, h('p', null, 'Scan this with your laptop\'s camera, or open the link there. It joins as a co-host.'),
        h('div', { class: 'eh-qrrow' }, cv, h('div', null, raw('p', url, { class: 'eh-link' }), h('div', { class: 'eh-row wrap' }, btn('Copy', () => copy(url)), btn('Share', () => shareText(T('Manage on a laptop'), url)))))));
    } catch (e) { toastErr(e); }
  }
  function recoverSheet() {
    const code = h('input', { type: 'text', maxlength: '8', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Event code' });
    const key = h('input', { type: 'text', maxlength: '24', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Your host key' });
    const msg = h('p', { class: 'eh-err', role: 'alert' });
    const go = h('button', { type: 'button', class: 'es-btn' }, 'Use this key');
    go.addEventListener('click', () => act(go, async () => {
      msg.textContent = '';
      const c = ES.events.normCode(code.value);
      if (!ES.CODE_RE.test(c)) { msg.textContent = 'We couldn\'t open this event.'; return; }
      try { await ES.events.recover(c, key.value); closeSheet(); openEvent(c); } catch (e) { msg.textContent = errText(e); }
    }));
    openSheet('Use a host key', h('div', null, h('label', { class: 'eh-field' }, h('span', null, 'Event code'), code),
      h('label', { class: 'eh-field' }, h('span', null, 'Your host key'), key), msg, go));
  }

  // ================================================================================================== passes ===
  // Play passes arrive on their own native channel (luts:eventsky); activation codes work everywhere.
  const P = { products: [], credits: [], status: '', info: new Map(), buying: '', msg: '', listeners: new Set(), loaded: false };
  const playOn = () => !!(window.LUTSNative && S.cfg && S.cfg.play);
  function passState(detail) {
    if (!detail || typeof detail !== 'object') return;
    P.status = String(detail.status || '');
    P.unsupported = detail.message === 'store-unsupported'; // (Galaxy, Indus, iOS: no Play billing, so no Wish Reel to sell)
    if (Array.isArray(detail.products)) P.products = detail.products.filter((p) => p && p.id && p.price);
    if (Array.isArray(detail.credits)) P.credits = detail.credits.filter((c) => c && c.tx);
    reelCredits(detail);
    if (R.buying) { reelEvent(detail); return; } // a Wish Reel purchase: its own messages, in Downloads (never a pass)
    if (detail.event === 'cancelled') P.msg = 'Purchase cancelled';
    else if (detail.event === 'pending') P.msg = 'Payment processing: your pass arrives automatically.';
    else if (detail.event === 'purchased') P.msg = 'Purchased ✓';
    else if (detail.message === 'store-unsupported') P.msg = ''; // iOS and other stores: codes only, nothing to apologise for
    else if ((P.status === 'unavailable' || P.status === 'error') && !P.products.length) P.msg = 'Passes aren\'t available right now.';
    renderReel();
    syncCredits(detail.event === 'purchased').then(() => P.listeners.forEach((f) => f(detail))).catch(() => P.listeners.forEach((f) => f(detail)));
  }
  async function syncCredits(fresh) {
    if (!P.credits.length) return;
    await ES.staff.token();
    for (const c of P.credits) {
      if (isReel(c.product)) continue; // a Wish Reel is no pass: it never goes in the passes ledger (see the Wish Reel below)
      if (!fresh && P.info.has(c.tx) && P.info.get(c.tx).left <= 0) continue;
      let d = null;
      try { d = await ES.passes.get(c.tx); if (!d) d = await ES.passes.record(c.tx, c.product); } catch (e) { d = null; }
      if (d) P.info.set(c.tx, { plan: d.pl, n: d.n, left: Math.max(0, (+d.n || 0) - (d.used || []).length), sku: d.sku || c.product });
    }
  }
  function loadPasses() {
    if (!playOn()) return;
    try {
      if (window.LUTSNative.lastEventSky) passState(window.LUTSNative.lastEventSky);
      if (!P.loaded) { P.loaded = true; window.LUTSNative.premium('es-products'); }
      else window.LUTSNative.premium('es-state');
    } catch (e) { P.msg = 'Passes aren\'t available right now.'; }
  }
  const PLAN_COPY = {
    free: ['Free', 'Up to 30 guests · selfie + 2 photos each · 3-day gallery · photos carry the Light Up the Skies mark'],
    event: ['Event Pass', 'Up to 300 guests · 4 photos each · photographer uploads · 30-day gallery · no mark · ZIP, photo book and best-of video'],
    shaadi: ['Shaadi Pass', 'Up to 500 guests across up to 8 functions · RSVP with headcounts · 4 photos and a 15-second video each · voice guestbook · your logo · selfie search · 90-day gallery'],
    es_planner_10: ['Planner 10-pack', '10 Event Passes to use any time'],
  };
  // The plan picker, shared by the wizard (mode 'create') and Settings (mode 'upgrade').
  // sel: {plan, proof:{kind:'none'|'code'|'play', code?, tx?, sku?}}.
  function planPicker(box, o) {
    const st = { sel: o.sel || { plan: 'free', proof: { kind: 'none' } }, code: null };
    const pick = (sel) => { st.sel = sel; render(); if (o.onChange) o.onChange(sel); };
    const cur = o.current || '';
    const eligible = (plan) => (o.mode === 'upgrade' ? ES.rank(plan) > ES.rank(cur) : true);
    const isSel = (k, v) => st.sel.proof.kind === k && (k === 'none' || st.sel.proof[k === 'code' ? 'code' : 'tx'] === v);
    function card(title, desc, selected, onclick, price, extra) {
      return h('button', { type: 'button', class: 'eh-plan', role: 'radio', 'aria-checked': String(!!selected), onclick },
        price ? h('span', { class: 'eh-price' }, price) : null, h('b', null, title), desc ? h('small', null, desc) : null, extra || null);
    }
    function render() {
      box.textContent = '';
      const list = h('div', { class: 'eh-plans', role: 'radiogroup', 'aria-label': 'Plan' });
      if (o.mode === 'create') list.append(card(PLAN_COPY.free[0], PLAN_COPY.free[1], isSel('none'), () => pick({ plan: 'free', proof: { kind: 'none' } })));
      // credits already bought (planner packs and unused passes)
      let plannerLeft = 0;
      for (const c of P.credits) {
        const inf = P.info.get(c.tx);
        if (!inf || inf.left <= 0 || !eligible(inf.plan)) continue;
        if (String(c.product).startsWith('es_planner_10')) plannerLeft += inf.left;
        const label = inf.plan === 'shaadi' ? F('Use a Shaadi Pass credit ({0} left)', inf.left) : F('Use an Event Pass credit ({0} left)', inf.left);
        list.append(card(label, PLAN_COPY[inf.plan] ? PLAN_COPY[inf.plan][1] : '', isSel('play', c.tx), () => pick({ plan: inf.plan, proof: { kind: 'play', tx: c.tx, sku: inf.sku } })));
      }
      if (plannerLeft) list.prepend(h('p', { class: 'eh-muted' }, F('Planner credits: {0} left', plannerLeft)));
      // Play products (in the app, when switched on)
      if (playOn() && P.products.some((p) => !isReel(p.id))) {
        for (const p of P.products) {
          if (isReel(p.id)) continue;
          const plan = p.plan || (p.id === 'es_shaadi_pass' ? 'shaadi' : 'event');
          if (!eligible(plan)) continue;
          const copyKey = p.id.startsWith('es_planner_10') ? 'es_planner_10' : plan;
          const c = PLAN_COPY[copyKey] || [PLAN_NAME[plan], ''];
          const pay = h('button', { type: 'button', class: 'es-btn', onclick: () => buy(p.id) }, F('Pay {0} with Google Play', p.price));
          list.append(h('div', { class: 'eh-plan', role: 'group' }, h('span', { class: 'eh-price', 'data-no-i18n': '' }, p.price), h('b', null, c[0]), h('small', null, c[1]), pay));
        }
      }
      // activation code: works everywhere
      const inp = h('input', { type: 'text', maxlength: '40', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Have an activation code?' });
      if (st.sel.proof.kind === 'code') inp.value = st.sel.proof.code;
      const msg = h('p', { class: 'eh-live', role: 'status' });
      if (st.code) msg.textContent = st.code;
      const use = h('button', { type: 'button', class: 'eh-btn' }, 'Use code');
      use.addEventListener('click', () => act(use, async () => {
        msg.textContent = '';
        await ES.staff.token();
        const r = await ES.events.checkCode(inp.value);
        if (!r) { st.code = "That isn't a valid code."; msg.textContent = st.code; return; }
        if (r.ex && r.ex <= now()) { st.code = 'That code has expired.'; msg.textContent = st.code; return; }
        if (r.left <= 0) { st.code = 'That code has been used.'; msg.textContent = st.code; return; }
        if (!eligible(r.plan)) { st.code = 'That is not an upgrade for this event'; msg.textContent = st.code; return; }
        st.code = F('This code gives {0} ({1} uses left).', PLAN_NAME[r.plan] || r.plan, r.left);
        pick({ plan: r.plan, proof: { kind: 'code', code: inp.value } });
      }));
      list.append(h('div', { class: 'eh-plan', role: 'group', 'aria-checked': String(st.sel.proof.kind === 'code') },
        h('b', null, 'Have an activation code?'), h('div', { class: 'eh-row' }, inp, use), msg));
      box.append(list);
      if (P.msg) box.append(h('p', { class: 'eh-live', role: 'status' }, P.msg));
      if (!playOn() || !P.products.some((p) => !isReel(p.id))) box.append(h('p', { class: 'eh-muted' }, 'For companies and planners: ask us for a code.'));
      else box.append(h('p', { class: 'eh-muted' }, 'For companies: ask us for a code'));
      if (playOn()) box.append(h('p', { class: 'eh-muted eh-small' }, 'Bought a pass on an earlier install? Write to us with the order number and we\'ll move it.'));
      // Only plans whose full-size period is shorter than the gallery (the passes); on Free both are 3 days.
      const selCap = ES.caps(st.sel && st.sel.plan, true);
      if (selCap && selCap.fd < selCap.gd) box.append(h('p', { class: 'eh-muted eh-small' }, 'Full-size photos are kept for 14 days; after that your 300 highlights stay full size and the rest stay as small previews.'));
      if (o.after) o.after(box, st.sel);
    }
    function buy(id) {
      P.buying = id; P.msg = '';
      try { window.LUTSNative.premium('es-buy', id); } catch (e) { P.msg = 'Passes aren\'t available right now.'; render(); }
    }
    const onPasses = (d) => {
      if (d && d.event === 'purchased' && P.buying) { // pick the pass just bought
        const fresh = P.credits.filter((c) => (c.product === P.buying || String(c.product).startsWith(P.buying + ':')) && (P.info.get(c.tx) || {}).left > 0).sort((a, b) => b.at - a.at)[0];
        P.buying = '';
        if (fresh) { const inf = P.info.get(fresh.tx); st.sel = { plan: inf.plan, proof: { kind: 'play', tx: fresh.tx, sku: inf.sku } }; if (o.onChange) o.onChange(st.sel); }
      }
      if (box.isConnected) render();
    };
    P.listeners.clear(); P.listeners.add(onPasses);
    loadPasses();
    render();
    return { get sel() { return st.sel; }, render };
  }

  // ================================================================================================= wizard ===
  const W = { step: 1, tpl: '', world: '', fns: [], sel: { plan: 'free', proof: { kind: 'none' } }, picker: null, made: null, checkSeq: 0, dateOk: false };
  const STEP_IDS = ['wTpl', 'wDetails', 'wTime', 'wPlan', 'wPrivacy', 'wDone'];
  function openWizard() {
    stopEvent();
    setView('new');
    setHeader('Create an event', '');
    try { history.replaceState(null, '', `event-host.html?new=1${S.tv ? '&tv=1' : ''}`); } catch (e) { /* file: */ }
    if (!S.app) { // the website stays a card viewer: creating happens in the app (§0.14)
      setView('mine'); showMine(); $('mineWeb').hidden = false; $('lnkPlay').href = ES.urls.play('event_host', 'web');
      $('mineWeb').scrollIntoView({ block: 'center' });
      return;
    }
    Object.assign(W, { step: 1, tpl: '', world: '', fns: [], sel: { plan: 'free', proof: { kind: 'none' } }, made: null, dateOk: false });
    P.msg = ''; P.buying = '';
    $('tplList').querySelectorAll('.eh-tpl').forEach((b) => b.setAttribute('aria-checked', 'false'));
    $('wTitle').value = ''; $('wNames').value = ''; $('wGuests').value = ''; $('wContact').value = ''; $('wNote').value = ''; $('wErr').textContent = '';
    langOptions($('wLang'), (window.LUTSLang && LUTSLang.lang) || 'en');
    const start = Math.ceil((Date.now() + 30 * MIN) / HOUR) * HOUR;
    $('wOpens').value = toLocal(start); $('wCloses').value = toLocal(start + 5 * HOUR);
    const days = $('wDays'); days.textContent = '';
    for (const d of [3, 7, 30, 90]) days.append(h('option', { value: String(d) }, F('{0} days', d)));
    days.value = '30';
    let tz = 'Asia/Kolkata'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* default */ }
    $('wTz').textContent = F('Times are in {0}.', tz); W.tz = tz;
    wizGo(1);
  }
  function wizGo(step) {
    W.step = step;
    STEP_IDS.forEach((id, i) => { $(id).hidden = i + 1 !== step; });
    const ol = $('wizSteps'); ol.textContent = '';
    for (let i = 1; i <= 5; i++) ol.append(h('li', { class: i <= step ? 'on' : '' }));
    $('wizNav').hidden = step === 6;
    $('wPrev').hidden = step === 1;
    $('wNext').textContent = step === 5 ? 'Create the event' : 'Next';
    $('wNext').hidden = step === 1 && !W.tpl;
    if (step === 2) renderFnEditor($('wFns'), W.fns, 8, true);
    if (step === 4) enterPlan();
    if (step === 5) enterPrivacy();
    window.scrollTo(0, 0);
    const first = $(STEP_IDS[step - 1]).querySelector('input,button,select');
    if (first) setTimeout(() => { try { first.focus(); } catch (e) { /* fine */ } }, 20);
  }
  function pickTpl(tpl) {
    W.tpl = tpl;
    const T0 = ES.TEMPLATES[tpl];
    $('tplList').querySelectorAll('.eh-tpl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tpl === tpl)));
    $('wNamesLabel').textContent = T0.namesLabel;
    W.world = T0.world;
    worldPicker($('wWorlds'), W.world, (w) => { W.world = w; });
    W.fns = (T0.fns || []).map((n) => ({ n, at: 0 }));
    $('wFnBox').hidden = !(T0.fns && T0.fns.length);
    $('wApprove').checked = !!T0.approve;
    $('wDp').checked = T0.dp === 'on';
    wizGo(2);
  }
  // Functions editor: rows of {n, at}; dates optional.
  function renderFnEditor(ul, list, max, withTime) {
    ul.textContent = '';
    list.forEach((f, i) => {
      const name = h('input', { type: 'text', maxlength: '30', 'aria-label': 'Function name' }); name.value = f.n || '';
      name.addEventListener('input', () => { f.n = name.value; });
      const li = h('li', { class: withTime ? 'fn' : '' }, name);
      if (withTime) {
        const at = h('input', { type: 'datetime-local', 'aria-label': 'Time' }); at.value = toLocal(f.at);
        at.addEventListener('change', () => { f.at = fromLocal(at.value) || 0; });
        li.append(at);
      }
      li.append(btn('Remove', () => { list.splice(i, 1); renderFnEditor(ul, list, max, withTime); }));
      ul.append(li);
    });
    const add = ul.parentElement && ul.parentElement.querySelector('#wFnAdd, #sFnAdd');
    if (add) add.disabled = list.length >= max;
  }
  function wizTimes() {
    return { opensAt: fromLocal($('wOpens').value), closesAt: fromLocal($('wCloses').value), gd: +$('wDays').value || 30 };
  }
  function wizValidate(step) {
    if (step === 2 && !ES.clean($('wTitle').value, 60)) { toast('Add a title'); $('wTitle').focus(); return false; }
    if (step === 3) {
      const t = wizTimes();
      if (!(t.closesAt > t.opensAt)) { toast('Check-in must close after it opens'); return false; }
      if (t.opensAt > Date.now() + 199 * DAY) { toast('Check-in opens within 200 days'); return false; }
    }
    if (step === 4) {
      if (!W.dateOk) { toast($('wDate').textContent || 'Checking your date…'); return false; }
      const cp = ES.caps(W.sel.plan, W.sel.proof.kind !== 'play') || ES.caps('free', true);
      const t = wizTimes();
      if (t.closesAt > t.opensAt + cp.wd * DAY) { toast(windowText(cp.wd)); return false; }
    }
    return true;
  }
  async function enterPlan() {
    const box = $('planBox');
    W.picker = planPicker(box, { mode: 'create', sel: W.sel, onChange: (sel) => { W.sel = sel; runDateCheck(); }, after: planNotes });
    runDateCheck();
  }
  function planNotes(box, sel) {
    const cp = ES.caps(sel.plan, sel.proof.kind !== 'play') || ES.caps('free', true);
    const fns = W.fns.filter((f) => ES.clean(f.n, 30));
    if (fns.length > cp.fm) box.append(h('p', { class: 'eh-muted' }, F('Only the first {0} functions are kept on this plan.', cp.fm)));
    const gd = Math.min(wizTimes().gd, cp.gd);
    box.append(h('p', { class: 'eh-muted' }, F('The gallery is kept for {0} days on this plan.', gd)));
  }
  async function runDateCheck() {
    const seq = ++W.checkSeq, out = $('wDate');
    W.dateOk = false; out.className = 'eh-check'; out.textContent = 'Checking your date…';
    const t = wizTimes();
    try {
      await ES.staff.token();
      const r = await ES.events.dateCheck({ plan: W.sel.plan, guests: +$('wGuests').value || 0, opensAt: t.opensAt, closesAt: t.closesAt });
      if (seq !== W.checkSeq) return;
      W.dateOk = !!r.ok;
      out.className = `eh-check ${r.ok ? 'ok' : 'no'}`;
      out.textContent = r.ok ? 'Your date is available ✓' : dateRefusal(r.reason, t.opensAt);
    } catch (e) { if (seq === W.checkSeq) { out.className = 'eh-check no'; out.textContent = errText(e); } }
  }
  const windowText = (wd) => (+wd === 1 ? 'This plan allows events up to 24 hours long. Change the times or pick another plan.' : F('This plan allows events up to {0} days long. Change the times or pick another plan.', wd));
  function dateRefusal(reason, at) {
    if (reason === 'FREE_FULL') return 'Fully booked for new free events today. Try again after 5:30 AM.';
    if (reason === 'PAUSED') return 'Event Sky is paused for a moment. Please try again later.';
    if (reason === 'DAY_MAX') return 'You have made 3 events today. Try again tomorrow, or use an activation code.';
    return F('Our free cloud is fully booked on {0}. Pick another date or a smaller plan.', fmtDate(at));
  }
  function enterPrivacy() {
    const paid = W.sel.plan !== 'free';
    $('wDpBox').hidden = !paid || W.tpl === 'corporate';
    const t = wizTimes();
    if (!$('wDpAt').value) $('wDpAt').value = toLocal(Math.max(t.opensAt, t.closesAt - 30 * MIN));
    $('wContact').required = paid;
  }
  async function wizCreate() {
    const err = $('wErr'); err.textContent = '';
    const paid = W.sel.plan !== 'free';
    const ct = ES.clean($('wContact').value, 80);
    if (paid && !ct) { err.textContent = 'A contact for photo removal is required on paid plans'; $('wContact').focus(); return; }
    const t = wizTimes();
    const o = {
      tpl: W.tpl, title: $('wTitle').value, names: $('wNames').value, world: W.world, lang: $('wLang').value, tz: W.tz,
      approve: $('wApprove').checked, opensAt: t.opensAt, closesAt: t.closesAt, gd: t.gd,
      fns: W.fns.filter((f) => ES.clean(f.n, 30)).map((f) => (f.at ? { n: f.n, at: f.at } : { n: f.n })),
      nt: $('wNote').value, ct, plan: W.sel.plan, proof: W.sel.proof, guestsExpected: +$('wGuests').value || undefined,
    };
    if (paid && !$('wDpBox').hidden && $('wDp').checked) {
      const at = fromLocal($('wDpAt').value);
      o.dp = { on: true, at: Number.isFinite(at) ? at : t.closesAt, sh: (ES.caps(W.sel.plan, W.sel.proof.kind !== 'play') || {}).pg || 1 };
    }
    const b = $('wNext');
    if (b.disabled) return;
    busy(b, true); b.textContent = 'Creating…';
    try { W.made = await ES.events.create(o); } catch (e) {
      W.made = null;
      err.textContent = e.code === 'BOOKED' ? dateRefusal(e.message, t.opensAt) : errText(e);
      if (['CODE_USED', 'CODE_EXPIRED', 'CODE_BAD', 'BOOKED'].includes(e.code)) { W.dateOk = false; }
    } finally { busy(b, false); b.textContent = 'Create the event'; }
    if (!W.made) return;
    $('wKey').textContent = W.made.recoveryKey;
    wizGo(6);
  }

  // ============================================================================================== the event ===
  async function openEvent(code) {
    const wantTab = new URLSearchParams(location.search).get('tab') || (S.pairCode ? 'screens' : '');
    stopEvent();
    S.code = code;
    setView('event');
    setHeader('Joining…', code);
    try { history.replaceState(null, '', `event-host.html?e=${code}${S.tv ? '&tv=1' : ''}${wantTab ? `&tab=${wantTab}` : ''}`); } catch (e) { /* file: */ }
    try {
      await ES.staff.token();
      S.uid = ES.staff.uid();
      S.ev = await ES.events.get(code);
    } catch (e) {
      showMine();
      toast(e.code === 'DENIED' ? 'You\'re not on this event\'s team.' : e.code === 'NOT_FOUND' ? 'We couldn\'t open this event.' : errText(e), { ms: 6000 });
      return;
    }
    if (S.code !== code) return;
    S.role = S.ev.host === S.uid ? 'h' : (S.ev.roles || {})[S.uid] || '';
    if (S.role === 'p') { location.replace(`event-pro.html?e=${code}`); return; }
    if (S.role === 'w') { location.replace(`event-wall.html?e=${code}${S.tv ? '&tv=1' : ''}`); return; }
    if (!S.role) { showMine(); toast('You\'re not on this event\'s team.'); return; }
    const mineEntry = ES.events.mine().find((x) => x.code === code);
    if (mineEntry && mineEntry.fix && isCohost()) ES.events.mirror(code).catch(() => {});
    ES.clock.sync(code).catch(() => {});
    S.pub = await ES.pub.get(code).catch(() => null);
    S.live = await ES.live.get(code).catch(() => ({}));
    if (S.ev.pv === 'play' && !S.ev.vf && isHost()) {
      ES.events.verifyPlay(code).then((ok) => { if (ok && S.code === code) reloadEvent(); }).catch(() => {});
    }
    fillHeader();
    applyRole();
    startWatch();
    if (isCohost()) {
      ES.sweep(code).catch(() => {}); // expired documents; at most once every 6 h (event-sky.js keeps the time)
      startPacker();
    }
    every(purgeDue, MIN);
    selectTab(TAB_OF_ROLE[S.role === 'h' || S.role === 'c' ? 'h' : 'm'].includes(wantTab) ? wantTab : 'photos');
  }
  function stopEvent() {
    if (S.watch) { S.watch.stop(); S.watch = null; }
    S.timers.forEach((t) => clearInterval(t)); S.timers = [];
    clearInterval(D.ping); D.ping = null;
    clearInterval(L.tick); L.tick = null;
    if (D.pend.length && S.code) flush(true).catch(() => {});
    if (S.packer) { try { S.packer.stop(); } catch (e) { /* stopped */ } S.packer = null; }
    resetDeck();
    S.ev = null; S.pub = null; S.live = {}; S.keyB64 = ''; S.galleryUrl = '';
  }
  function fillHeader() {
    const e = S.ev;
    setHeader(e.title, `${e.names ? e.names + ' · ' : ''}${S.code} · ${fmtDate(e.opensAt)}`, true);
    $('setPass').hidden = !(e.pv === 'play' && !e.vf);
  }
  function applyRole() {
    const allowed = new Set(TAB_OF_ROLE[S.role === 'm' ? 'm' : 'h']);
    if (!(S.cfg && S.cfg.shop)) allowed.delete('shop');
    for (const t of TABS) $(`t-${t}`).hidden = !allowed.has(t);
    $('invC').hidden = !isHost();
    document.querySelector('[data-inv="p"]').hidden = !isHost();
    $('pairBox').hidden = !isHost();
    $('scrLink').hidden = !isCohost(); $('scrBox').hidden = true;
    $('setKey').hidden = !isHost(); $('setPlan').hidden = !isHost(); $('setDelete').hidden = !isHost();
    $('setLeave').hidden = isHost();
    $('setForm').hidden = !isCohost(); $('setOpen').hidden = !isCohost();
    $('laptopBox').hidden = !isHost();
    $('wallBox').hidden = false;
  }
  async function reloadEvent() {
    try {
      const e = await ES.events.get(S.code);
      if (!e || S.code !== e.code) return;
      S.ev = e;
      const r = e.host === S.uid ? 'h' : (e.roles || {})[S.uid] || '';
      if (!r) { showMine(); toast('You\'re not on this event\'s team.'); return; }
      if (r !== S.role) { S.role = r; applyRole(); }
      S.pub = await ES.pub.get(S.code).catch(() => S.pub);
      fillHeader();
      renderTab(S.tab, { soft: true });
    } catch (e) { /* keep the last copy */ }
  }
  async function reloadLive() {
    try { S.live = await ES.live.get(S.code); } catch (e) { return; }
    if (S.tab === 'live') renderLive();
    if (S.tab === 'screens') renderScreens({ soft: true });
  }
  function startWatch() {
    if (S.watch) S.watch.stop();
    if (!S.code || !S.ev) return;
    S.watch = ES.bell.watch(S.code, {
      mode: S.tab === 'photos' ? 'mod' : 'host', opensAt: S.ev.opensAt,
      onChange: onBell, onGov: setLevel,
      onError: (e) => { if (e && e.code === 'QUOTA') setLevel(3); },
    });
    setLevel(S.watch.level());
  }
  function onBell(changed, bell, info) {
    const first = !!(info && info.first);
    const has = (k) => !first && changed.includes(k);
    if (has('s')) reloadEvent();
    if (has('l') || has('w')) reloadLive();
    if (S.tab === 'photos') deckRefresh({ pending: first || has('q') || has('o') || has('a'), done: first || has('g') || has('e'), reports: first || has('r') });
    if (S.tab === 'guests' && (has('a') || has('g') || has('e'))) renderGuests({ bell: true }).catch(() => {});
    if (S.tab === 'stats' && (has('a') || has('o') || has('q'))) throttle('stats', 60e3, () => renderStats());
  }
  const throttles = new Map();
  function throttle(key, ms, fn) { const t = throttles.get(key) || 0; if (Date.now() - t < ms) return; throttles.set(key, Date.now()); fn(); }
  function selectTab(tab) {
    if (!TABS.includes(tab) || $(`t-${tab}`).hidden) tab = 'photos';
    const prev = S.tab; S.tab = tab;
    for (const t of TABS) {
      const b = $(`t-${t}`), p = $(b.getAttribute('aria-controls'));
      const on = t === tab;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      p.hidden = !on;
    }
    if ((prev === 'photos') !== (tab === 'photos') || !S.watch) startWatch();
    if (tab !== 'photos') { clearInterval(D.ping); D.ping = null; if (D.pend.length) flush(true).catch(() => {}); }
    if (tab !== 'live') { clearInterval(L.tick); L.tick = null; }
    try { const u = new URL(location.href); u.searchParams.set('tab', tab); history.replaceState(null, '', u.pathname.split('/').pop() + u.search); } catch (e) { /* file: */ }
    renderTab(tab);
  }
  function renderTab(tab, o = {}) {
    const f = { photos: renderPhotos, live: renderLive, team: renderTeam, screens: renderScreens, share: renderShare, gallery: renderGallery,
      downloads: renderDownloads, guests: renderGuests, rsvp: renderRsvp, book: renderBook, stats: renderStats, shop: renderShop, settings: renderSettings }[tab];
    if (f) Promise.resolve().then(() => f(o)).catch((e) => toastErr(e));
  }

  // ====================================================================================== Photos (moderation) ===
  const SEL_MOD = {
    media: ['s', 'k', 'kd', 't', 'w', 'h', 'fn', 'm', 'cp', 'st', 'mt', 'at', 'du', 'hl', 'rv', 'by'],
    guests: ['nm', 'wi', 'im', 'fn', 'st', 'mt', 'at'],
  };
  const D = { items: [], idx: 0, filter: 'all', curs: { media: null, guests: null }, doneCurs: { media: 0, guests: 0 }, pend: [], timer: null, flushed: [],
    reports: new Map(), repItems: [], mods: [], myIdx: 0, names: new Map(), counts: null, countsAt: 0, busy: null, again: null, ping: null, urls: new Map(),
    recent: [], recentCurs: { media: null, guests: null }, loaded: false };
  function resetDeck() {
    clearTimeout(D.timer);
    D.urls.forEach((u) => URL.revokeObjectURL(u)); D.urls.clear();
    Object.assign(D, { items: [], idx: 0, curs: { media: null, guests: null }, doneCurs: { media: 0, guests: 0 }, pend: [], timer: null, flushed: [], reports: new Map(),
      repItems: [], mods: [], myIdx: 0, names: new Map(), counts: null, countsAt: 0, busy: null, again: null, recent: [], recentCurs: { media: null, guests: null }, loaded: false });
  }
  const FLUSH_MS = 4000;
  function itemOf(coll, d) {
    if (coll === 'guests') return { coll, id: String(d._id), seat: +d._id, kd: 'a', bytes: d.im, name: d.nm || '', wish: d.wi || '', fn: d.fn || '', m: '', cp: '', st: d.st, mt: d.mt, hl: false };
    return { coll, id: String(d._id), seat: typeof d.s === 'number' ? d.s : -1, kd: d.kd || 'p', bytes: d.t, name: '', fn: d.fn || '', m: d.m || '', cp: d.cp || '', st: d.st, mt: d.mt,
      hl: !!d.hl, du: d.du || 0, rv: d.rv || 0, by: d.by || '' };
  }
  function urlOf(it) {
    const k = `${it.coll}/${it.id}`;
    if (D.urls.has(k)) return D.urls.get(k);
    if (!it.bytes || !it.bytes.length) return '';
    const u = URL.createObjectURL(new Blob([it.bytes], { type: 'image/jpeg' }));
    D.urls.set(k, u);
    return u;
  }
  async function readMods() {
    let mo = {};
    try { mo = (await ES.db.get(`es/${S.code}/mo`, { auth: true })) || {}; } catch (e) { mo = {}; }
    const t = now();
    const act0 = Object.entries(mo).filter(([, v]) => +v > t - 60e3).map(([u]) => u);
    if (!act0.includes(S.uid)) act0.push(S.uid);
    act0.sort();
    D.mods = act0; D.myIdx = act0.indexOf(S.uid);
    $('modOnline').textContent = F('Moderators online: {0}', act0.length);
  }
  const mineToCheck = (it) => {
    const n = D.mods.length;
    if (n <= 1) return true;
    if (it.seat < 0) return D.myIdx === 0; // photographer items go to the first moderator
    return ((it.seat % n) + n) % n === D.myIdx;
  };
  function matches(it) {
    if (D.filter === 'reported') return true;
    if (D.filter === 'arrivals') return it.coll === 'guests';
    if (D.filter === 'photos') return it.coll === 'media' && it.kd === 'p';
    if (D.filter === 'videos') return it.coll === 'media' && it.kd === 'v';
    return true;
  }
  function visible() {
    if (D.filter === 'reported') return D.repItems.filter((it) => !D.pend.some((p) => p.id === it.id && p.coll === it.coll));
    return D.items.filter((it) => matches(it) && mineToCheck(it));
  }
  function addItem(it) {
    if (D.pend.some((p) => p.coll === it.coll && p.id === it.id)) return;
    const i = D.items.findIndex((x) => x.coll === it.coll && x.id === it.id);
    if (i >= 0) D.items[i] = it; else D.items.push(it);
  }
  function dropItem(coll, id) {
    const i = D.items.findIndex((x) => x.coll === coll && x.id === id);
    if (i >= 0) D.items.splice(i, 1);
    const k = `${coll}/${id}`;
    if (D.urls.has(k)) { URL.revokeObjectURL(D.urls.get(k)); D.urls.delete(k); }
  }
  async function fillNames(list) {
    const need = [...new Set(list.filter((it) => it.coll === 'media' && it.seat >= 0 && !D.names.has(it.seat)).map((it) => it.seat))];
    if (!need.length) return;
    try {
      const docs = await ES.fs.batchGet(need.map((n) => `events/${S.code}/guests/${n}`), { mask: ['nm'], auth: true });
      need.forEach((n, i) => D.names.set(n, (docs[i] && docs[i].nm) || ''));
    } catch (e) { /* names stay blank */ }
  }
  async function deckRefresh(o = {}) {
    if (!S.code || S.tab !== 'photos') return;
    if (D.busy) { D.again = Object.assign(D.again || {}, o); return D.busy; }
    const code = S.code;
    D.busy = (async () => {
      await readMods();
      if (o.pending) {
        for (const coll of ['guests', 'media']) {
          for (let page = 0; page < 10; page++) {
            const api = coll === 'media' ? ES.media : ES.guests;
            const r = await api.changes(code, { cursor: D.curs[coll], st: [0], limit: 100, select: SEL_MOD[coll] });
            if (S.code !== code) return;
            r.items.forEach((d) => {
              const it = itemOf(coll, d), known = D.items.some((x) => x.coll === coll && x.id === it.id) || D.pend.some((x) => x.coll === coll && x.id === it.id);
              addItem(it);
              if (!known && D.counts && it.st === 0) D.counts.w += 1; // a new arrival: counted here, not by another aggregation
            });
            if (r.cursor) D.curs[coll] = r.cursor;
            if (r.items.length < 100) break;
          }
        }
        if (!D.loaded) { D.loaded = true; D.doneCurs = { media: now() - 5000, guests: now() - 5000 }; }
      }
      if (o.done && D.loaded) {
        for (const coll of ['guests', 'media']) {
          const api = coll === 'media' ? ES.media : ES.guests;
          for (let page = 0; page < 5; page++) {
            const r = await api.changes(code, { cursor: D.doneCurs[coll], st: [1, 2, 3], limit: 300, select: ['st', 'mt'] });
            if (S.code !== code) return;
            r.items.forEach((d) => {
              const was = D.items.some((x) => x.coll === coll && x.id === String(d._id));
              dropItem(coll, String(d._id));
              if (was && D.counts) { D.counts.w = Math.max(0, D.counts.w - 1); if (d.st === 1) D.counts.s += 1; else if (d.st === 2) D.counts.h += 1; } // another moderator's decision
              if (coll === 'media' && d.st !== 1) D.repItems = D.repItems.filter((x) => x.id !== String(d._id));
            });
            if (r.cursor) D.doneCurs[coll] = r.cursor;
            if (r.items.length < 300) break;
          }
        }
        if (S.ev && !S.ev.approve) await loadRecent();
      }
      if (o.reports) await loadReports();
      await fillNames(D.items.concat(D.repItems, D.recent));
      // The counts are kept from what this deck sees (arrivals, decisions); the 6 aggregations run every 5 minutes, or on a tap.
      if (Date.now() - D.countsAt > COUNTS_MS || o.counts) await loadCounts(); else showCounts();
      drawDeck();
    })().catch((e) => { if (e && e.code !== 'OFFLINE') toastErr(e); }).finally(() => {
      D.busy = null;
      if (D.again) { const a = D.again; D.again = null; deckRefresh(a); }
    });
    return D.busy;
  }
  const COUNTS_MS = 5 * 60e3;
  function showCounts() { if (D.counts) $('modCounts').textContent = F('Waiting {0} · Shown {1} · Hidden {2}', D.counts.w, D.counts.s, D.counts.h); }
  async function loadCounts() {
    D.countsAt = Date.now();
    const c = { w: 0, s: 0, h: 0 };
    try {
      const jobs = [];
      for (const coll of ['media', 'guests']) for (const [k, st] of [['w', 0], ['s', 1], ['h', 2]]) {
        jobs.push(ES.fs.aggregate(`events/${S.code}`, { from: coll, where: [['st', '==', st]], aggs: { n: ['count'] }, auth: true }).then((r) => { c[k] += r.n || 0; }));
      }
      await Promise.all(jobs);
      D.counts = c;
    } catch (e) { /* keep the last numbers */ }
    showCounts();
  }
  const WHY = { me: 'It\'s me and I want it removed', rude: 'It\'s rude or unkind', child: 'It shows a child who shouldn\'t be shown', other: 'Something else' };
  async function loadReports() {
    let reps = [];
    try { reps = await ES.media.reports(S.code); } catch (e) { return; }
    D.reports = new Map(reps.map((r) => [r.id, r]));
    const ids = reps.map((r) => r.id);
    D.repItems = [];
    if (ids.length) {
      const docs = await ES.media.get(S.code, ids, { select: SEL_MOD.media, auth: true }).catch(() => []);
      docs.forEach((d, i) => { if (d && d.st !== 3) { const it = itemOf('media', d); it.id = ids[i]; it.rep = D.reports.get(ids[i]); D.repItems.push(it); } });
      D.repItems.sort((a, b) => (b.rep.n - a.rep.n) || (a.mt - b.mt));
    }
    $('fReported').textContent = F('Reported ({0})', D.repItems.length);
  }
  async function loadRecent() {
    const code = S.code;
    for (const coll of ['media', 'guests']) {
      const api = coll === 'media' ? ES.media : ES.guests;
      const cur = D.recentCurs[coll] || now() - 3 * HOUR;
      const r = await api.changes(code, { cursor: cur, st: [1], limit: 100, select: SEL_MOD[coll] });
      if (S.code !== code) return;
      r.items.forEach((d) => { const it = itemOf(coll, d); D.recent = D.recent.filter((x) => !(x.coll === coll && x.id === it.id)); D.recent.push(it); });
      if (r.cursor) D.recentCurs[coll] = r.cursor;
    }
    D.recent.sort((a, b) => b.mt - a.mt);
    D.recent = D.recent.slice(0, 40);
  }
  function captionOf(it) {
    const bits = [];
    if (it.coll === 'guests') bits.push(T('Arrival'));
    else if (it.kd === 'v') bits.push(T('Video'));
    else if (it.seat < 0) bits.push(T('Photographer'));
    const fn = (S.ev.fns || []).find((f) => f.id === it.fn);
    if (fn) bits.push(fn.n);
    const ms = (S.ev.ms || []).find((x) => x.id === it.m) || (S.live.ch && S.live.ch.id === it.m ? { t: S.live.ch.t } : null);
    if (ms) bits.push(TF('Mission: {0}', ms.t));
    return bits.join(' · ');
  }
  function drawDeck() {
    const list = visible();
    D.idx = clamp(D.idx, 0, Math.max(0, list.length - 1));
    const it = list[D.idx];
    const card = $('deckCard');
    card.hidden = !it; $('deckEmpty').hidden = !!it;
    for (const b of ['bShow', 'bHide', 'bHl', 'bPrev', 'bNextItem']) $(b).disabled = !it;
    $('bHl').disabled = !it || it.coll !== 'media';
    $('bShow').textContent = D.filter === 'reported' ? 'Keep showing' : 'Show';
    if (it) {
      card.className = `eh-deck-card${it.hl ? ' hl' : ''}`;
      card.style.transform = '';
      card.querySelectorAll('.eh-stamp').forEach((s) => { s.style.opacity = '0'; });
      const media = $('deckMedia'); media.textContent = '';
      const url = urlOf(it);
      if (url) media.append(h('img', { src: url, alt: it.coll === 'guests' ? T('Arrival') : T('Photo to check'), draggable: 'false' }));
      if (it.kd === 'v') media.append(h('button', { type: 'button', class: 'es-btn eh-play', onclick: () => playVideo(it, media) }, 'Play'));
      $('deckName').textContent = it.coll === 'guests' ? it.name : (it.seat >= 0 ? D.names.get(it.seat) || '' : T('Photographer'));
      const meta = [captionOf(it)];
      if (it.rep) meta.push(F('Reported {0} times: {1}', it.rep.n, T(WHY[it.rep.why] || WHY.other)));
      $('deckMeta').textContent = meta.filter(Boolean).join(' · ');
      $('deckCaption').textContent = it.coll === 'guests' ? it.wish : it.cp;
      $('bHl').setAttribute('aria-pressed', String(!!it.hl));
    }
    const next = $('deckNext'); next.textContent = '';
    list.slice(D.idx + 1, D.idx + 4).forEach((x) => { const u = urlOf(x); if (u) next.append(h('img', { src: u, alt: '' })); });
    // auto-approve events: the "Recently shown" stream with Hide
    const rb = $('recentBox');
    rb.hidden = !(S.ev && !S.ev.approve);
    if (!rb.hidden) {
      const ul = $('recentList'); ul.textContent = '';
      for (const r of D.recent.filter((x) => !D.pend.some((p) => p.coll === x.coll && p.id === x.id))) {
        const u = urlOf(r);
        ul.append(h('li', null, u ? h('img', { src: u, alt: '' }) : null,
          raw('span', r.coll === 'guests' ? r.name : (r.seat >= 0 ? D.names.get(r.seat) || '' : T('Photographer')), { class: 'eh-cap' }),
          btn('Hide', () => decideItem(r, 2, 1))));
      }
    }
  }
  async function playVideo(it, box) {
    try {
      const [d] = await ES.media.get(S.code, [it.id], { select: ['d'], auth: true });
      if (!d || !d.d || !d.d.length) return;
      const u = URL.createObjectURL(new Blob([d.d], { type: (EM.sniff && EM.sniff.bytes && EM.sniff.bytes(d.d.subarray(0, 64))) || 'video/mp4' }));
      box.textContent = '';
      const v = h('video', { src: u, muted: true, controls: true, playsinline: true, autoplay: true });
      v.muted = true;
      v.addEventListener('ended', () => URL.revokeObjectURL(u));
      box.append(v);
    } catch (e) { toastErr(e); }
  }
  const current = () => visible()[D.idx];
  // st: 1 show, 2 hide. prev: the state Undo writes back after the flush.
  function decideItem(it, st, prev) {
    if (!it) return;
    const p = { coll: it.coll, id: it.id, st, prev: prev == null ? (it.st == null ? 0 : it.st) : prev, item: it, at: Date.now(), rep: !!it.rep };
    D.pend.push(p);
    if (it.rep) D.repItems = D.repItems.filter((x) => x.id !== it.id);
    dropItemKeepUrl(it);
    D.recent = D.recent.filter((x) => !(x.coll === it.coll && x.id === it.id));
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* not allowed */ }
    toast('', { action: st === 1 ? 'Shown · Undo' : 'Hidden · Undo', onAction: () => undo() });
    armFlush();
    drawDeck();
  }
  function dropItemKeepUrl(it) { const i = D.items.findIndex((x) => x.coll === it.coll && x.id === it.id); if (i >= 0) D.items.splice(i, 1); }
  function armFlush() {
    clearTimeout(D.timer);
    if (!D.pend.length) return;
    const due = Math.max(50, D.pend[0].at + FLUSH_MS - Date.now());
    D.timer = setTimeout(() => flush(false).catch(() => {}), due);
  }
  async function flush(all) {
    clearTimeout(D.timer);
    const cut = Date.now() - FLUSH_MS + 30;
    const due = all ? D.pend.splice(0) : D.pend.filter((p) => p.at <= cut);
    if (!all) D.pend = D.pend.filter((p) => p.at > cut);
    if (!due.length) { armFlush(); return; }
    const code = S.code;
    try {
      await ES.media.decide(code, due.map((p) => ({ coll: p.coll, id: p.id, st: p.st })));
      // A cleared report: co-hosts delete its counter (moderators cannot; the decision's time is newer than the report).
      const reps = due.filter((p) => p.rep && p.coll === 'media');
      if (reps.length && isCohost()) await ES.fs.commit(reps.map((p) => ES.fs.w.del(`events/${code}/reports/${p.id}`)), { auth: true }).catch(() => {});
      due.forEach((p) => { if (p.st === 2 && p.coll === 'media') purgeLater(code, p.id); });
      D.flushed.push(...due); D.flushed = D.flushed.slice(-30);
      if (D.counts) { due.forEach((p) => countMove(p.prev, p.st)); showCounts(); }
    } catch (e) {
      if (e.code === 'OFFLINE' || e.code === 'QUOTA' || e.code === 'BUSY') { // keep them; try again shortly
        D.pend = due.map((p) => Object.assign(p, { at: Date.now() - FLUSH_MS + 5000 })).concat(D.pend);
      } else {
        toastErr(e);
        due.forEach((p) => addItem(p.item)); drawDeck();
      }
    }
    armFlush();
  }
  function countMove(from, to) {
    const k = { 0: 'w', 1: 's', 2: 'h' };
    if (!D.counts) return;
    if (k[from]) D.counts[k[from]] = Math.max(0, D.counts[k[from]] - 1);
    if (k[to]) D.counts[k[to]] += 1;
  }
  async function undo() {
    if (D.pend.length) {
      const p = D.pend.pop();
      if (p.rep) D.repItems.unshift(p.item); else if (S.ev && !S.ev.approve && p.prev === 1) D.recent.unshift(p.item); else D.items.splice(D.idx, 0, p.item);
      armFlush(); drawDeck(); toast('Undone');
      return;
    }
    const p = D.flushed.pop();
    if (!p) return;
    try {
      await ES.media.decide(S.code, [{ coll: p.coll, id: p.id, st: p.prev }]);
      countMove(p.st, p.prev); showCounts();
      unpurge(S.code, p.id);
      if (p.prev === 0) addItem(Object.assign(p.item, { st: 0 }));
      else if (p.prev === 1 && S.ev && !S.ev.approve) D.recent.unshift(p.item);
      drawDeck(); toast('Undone');
    } catch (e) { D.flushed.push(p); toastErr(e); }
  }
  async function highlight() {
    const it = current();
    if (!it || it.coll !== 'media') return;
    const on = !it.hl;
    try {
      await ES.media.highlight(S.code, it.id, on);
      it.hl = on; drawDeck(); toast(on ? 'Highlighted' : 'Highlight removed');
    } catch (e) { toastErr(e); }
  }
  function step(n) { const l = visible().length; if (!l) return; D.idx = clamp(D.idx + n, 0, l - 1); drawDeck(); }
  function keysHelp() {
    const rows = [['J', 'next'], ['K', 'previous'], ['P', 'show'], ['R', 'hide'], ['Z', 'undo'], ['F', 'highlight'], ['?', 'this help']];
    openSheet('Keyboard keys', h('table', { class: 'eh-keys' }, h('tbody', null, rows.map(([k, t]) => h('tr', null, h('td', null, raw('kbd', k)), h('td', null, t))))));
  }
  function renderPhotos() {
    $('deckHelpLine').hidden = !!S.tv;
    if (!D.ping) {
      const ping = () => ES.db.put(`es/${S.code}/mo/${S.uid}`, ES.db.ts(), { auth: true }).catch(() => {});
      ping(); D.ping = setInterval(ping, 20e3);
    }
    drawDeck();
    deckRefresh({ pending: true, done: true, reports: true, counts: true });
  }
  // Swipe: right past 30% of the width shows, left hides.
  function wireSwipe() {
    const card = $('deckCard');
    let x0 = null, y0 = 0, dx = 0, pid = null;
    card.addEventListener('dragstart', (e) => e.preventDefault()); // a dragged picture would cancel the swipe
    card.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('button,video')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; pid = e.pointerId;
      try { card.setPointerCapture(pid); } catch (x) { /* fine */ }
      card.classList.add('drag');
    });
    card.addEventListener('pointermove', (e) => {
      if (x0 == null || e.pointerId !== pid) return;
      dx = e.clientX - x0;
      if (Math.abs(e.clientY - y0) > Math.abs(dx) * 1.5 && Math.abs(dx) < 12) return;
      const w = card.offsetWidth || 1, k = clamp(Math.abs(dx) / (0.3 * w), 0, 1);
      card.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
      card.querySelector('.eh-stamp.show').style.opacity = dx > 0 ? String(k) : '0';
      card.querySelector('.eh-stamp.hide').style.opacity = dx < 0 ? String(k) : '0';
    });
    const end = (e) => {
      if (x0 == null || (e && e.pointerId !== pid)) return;
      const w = card.offsetWidth || 1, d = dx;
      x0 = null; card.classList.remove('drag');
      if (d > 0.3 * w) decideItem(current(), 1);
      else if (d < -0.3 * w) decideItem(current(), 2);
      else { card.style.transform = ''; card.querySelectorAll('.eh-stamp').forEach((s) => { s.style.opacity = '0'; }); }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }
  // Hidden photos keep their bytes for 15 minutes (so Undo works), then this device purges d and t.
  const PURGE_KEY = (c) => `luts:es-purge:${c}`;
  function purgeLater(code, id) { const l = lsGet(PURGE_KEY(code), []) || []; if (!l.some((x) => x.id === id)) l.push({ id, at: Date.now() }); lsSet(PURGE_KEY(code), l.slice(-500)); }
  function unpurge(code, id) { lsSet(PURGE_KEY(code), (lsGet(PURGE_KEY(code), []) || []).filter((x) => x.id !== id)); }
  async function purgeDue() {
    if (!S.code) return;
    const code = S.code, l = lsGet(PURGE_KEY(code), []) || [];
    const due = l.filter((x) => x.at < Date.now() - 15 * MIN).slice(0, 100);
    if (!due.length) return;
    const ids = due.map((x) => x.id);
    const docs = await ES.media.get(code, ids, { select: ['st'], auth: true });
    const still = ids.filter((id, i) => docs[i] && docs[i].st === 2);
    if (still.length) await ES.media.purge(code, still);
    lsSet(PURGE_KEY(code), (lsGet(PURGE_KEY(code), []) || []).filter((x) => !ids.includes(x.id)));
  }

  // ============================================================================================ Live controls ===
  const L = { tick: null };
  function renderLive() {
    const e = S.ev, cp = e.cap, free = !!cp.mk;
    $('annFullBox').hidden = free; $('annCdBox').hidden = free; $('annFreeNote').hidden = !free;
    if (free) document.querySelector('input[name="annStyle"][value="b"]').checked = true;
    if (!$('annAt').value) $('annAt').value = toLocal(Math.max(Date.now(), e.opensAt) + 10 * MIN);
    const ul = $('annList'); ul.textContent = '';
    (e.an || []).slice().sort((a, b) => a.at - b.at).forEach((a) => {
      ul.append(h('li', null, h('span', { class: 'eh-grow' }, raw('b', fmtDT(a.at)), ' · ', raw('span', a.t), ' · ', h('span', { class: 'eh-muted' }, a.st === 'f' ? 'Full screen with countdown' : 'Banner')),
        btn('Remove', () => act(null, async () => { await ES.events.update(S.code, { an: (S.ev.an || []).filter((x) => x.id !== a.id) }); await reloadEvent(); }))));
    });
    $('annRoom').textContent = F('{0} of 20 announcements', (e.an || []).length);
    // challenge (passes only), disposable camera (passes only)
    $('chBox').hidden = free; $('dpBox').hidden = free || e.tpl === 'corporate';
    if (free && !$('pLive').querySelector('.eh-freenote')) $('chBox').after(h('p', { class: 'eh-muted eh-freenote' }, 'Timed challenges, the disposable camera and full-screen announcements come with a pass.'));
    const ms = $('chMission'); const keep = ms.value; ms.textContent = '';
    ms.append(h('option', { value: '' }, 'None'));
    (e.ms || []).forEach((m) => ms.append(raw('option', m.t, { value: m.id })));
    ms.value = keep;
    $('dpOn').checked = !!(e.dp && e.dp.on);
    $('dpAt').value = toLocal(e.dp && e.dp.on ? e.dp.at : Math.max(e.opensAt, e.closesAt - 30 * MIN));
    $('dpSh').max = String(cp.pg); $('dpSh').value = String((e.dp && e.dp.sh) || cp.pg);
    $('dpFin').checked = !!lsGet(`luts:es-revfin:${S.code}`, false);
    const fin = S.live.fin;
    $('finState').textContent = fin && fin.at && fin.at > now() - 60e3 ? 'The finale starts in a few seconds on every screen.' : '';
    liveTick();
    clearInterval(L.tick); L.tick = setInterval(liveTick, 1000);
  }
  function liveTick() {
    const ch = S.live && S.live.ch, box = $('chNow');
    if (!ch || !ch.id || !ch.end || now() > ch.end + 10 * MIN) { box.hidden = true; return; }
    box.hidden = false;
    const left = ch.end - now();
    if (left > 0) { $('chState').textContent = `${F('Photo challenge: {0}', ch.t)} · ${F('{0} left', mmss(left))}`; $('chPickBtn').hidden = true; }
    else {
      $('chState').textContent = ch.win ? 'Winner picked ✓' : 'The challenge is over — look at the screen!';
      $('chPickBtn').hidden = !!ch.win || now() > ch.end + 2 * MIN;
    }
  }
  async function challengePhotos() {
    const ch = S.live.ch;
    const ul = $('chPhotos'); ul.textContent = '';
    const docs = await ES.fs.query(`events/${S.code}`, { from: 'media', where: [['m', '==', ch.id]], select: ['t', 's', 'st', 'cp'], limit: 60, auth: true });
    const shown = docs.filter((d) => d.st === 1);
    if (!shown.length) { ul.append(h('li', { class: 'eh-muted' }, 'No photos for this challenge yet.')); return; }
    for (const d of shown) {
      const u = d.t && d.t.length ? URL.createObjectURL(new Blob([d.t], { type: 'image/jpeg' })) : '';
      ul.append(h('li', null, u ? h('img', { src: u, alt: '' }) : null, btn('Pick the winner', () => act(null, async () => {
        await ES.live.pickWinner(S.code, d._id); S.live = await ES.live.get(S.code); ul.textContent = ''; liveTick(); toast('Winner picked ✓');
      }))));
    }
  }

  // ===================================================================================================== Team ===
  let invRole = '';
  async function showInvite(role, fresh) {
    invRole = role;
    $('invBox').hidden = false;
    $('invTitle').textContent = { c: 'Invite a co-host', m: 'Invite a moderator', p: 'Invite a photographer', w: 'Add a screen' }[role];
    $('invNote').textContent = F('Anyone with this link can join as {0}. Make a new link to stop the old one.', T(ROLE_NAME[role]));
    $('invUrl').textContent = '…';
    const { url } = await inviteUrl(S.code, role, fresh);
    $('invUrl').textContent = url;
    drawQr($('invQr'), url);
    $('invBox').scrollIntoView({ block: 'nearest' });
  }
  async function renderTeam() {
    const ul = $('teamList'); ul.textContent = '';
    const list = await ES.roles.list(S.code);
    let mo = {};
    try { mo = (await ES.db.get(`es/${S.code}/mo`, { auth: true })) || {}; } catch (e) { mo = {}; }
    const online = Object.values(mo).filter((v) => +v > now() - 60e3).length;
    $('teamOnline').textContent = F('Moderators online: {0}', Math.max(online, 0));
    for (const m of list) {
      const me = m.uid === S.uid;
      const li = h('li', null, h('span', { class: 'eh-grow' }, h('b', null, ROLE_NAME[m.role] || m.role), ' ', raw('span', `· ${m.uid.slice(0, 6)}`, { class: 'eh-muted' }), me ? h('span', { class: 'eh-muted' }, ' (this device)') : null));
      if (isHost() && m.role !== 'h') {
        li.append(btn('Remove', async () => {
          if (!await ask('Remove', F('Remove {0} from the team?', T(ROLE_NAME[m.role])), 'Remove', { danger: true })) return;
          await act(null, async () => { await ES.roles.remove(S.code, m.uid); toast('Removed'); renderTeam(); });
        }));
      }
      ul.append(li);
    }
  }

  // ================================================================================================== Screens ===
  let scrRole = 'main';
  function renderScreens() {
    if (S.pairCode && !$('pairPin').value) $('pairPin').value = ES.pair.format ? ES.pair.format(S.pairCode) : S.pairCode;
    $('scrHere').href = `event-wall.html?e=${S.code}${S.tv ? '&tv=1' : ''}`;
    const w = (S.live && S.live.wall) || {};
    $('wMode').value = w.md || 'mix';
    $('wSl').value = String(Math.round((w.sl || 6000) / 1000));
    $('wQs').value = w.qs || 'm';
    $('wQp').value = w.qp || 'br';
    $('wFl').value = w.fl || 'dim';
    $('wSnd').checked = !!w.snd;
    $('wQh').textContent = w.qh ? 'Show QR' : 'Hide QR';
  }
  async function screenLink() {
    const { secret } = await inviteUrl(S.code, 'w');
    const url = ES.urls.wall(S.code, { screen: scrRole, join: `w.${secret}` });
    $('scrBox').hidden = false;
    $('scrUrl').textContent = url;
    drawQr($('scrQr'), url);
  }

  // ============================================================================================ Share & print ===
  function guestUrl() { return ES.urls.guest(S.code, { lang: S.ev.lang && S.ev.lang !== 'en' ? S.ev.lang : undefined }); }
  function renderShare() {
    const url = guestUrl();
    $('gUrl').textContent = url; $('gCode').textContent = S.code; $('gCode').dataset.noI18n = '';
    drawQr($('gQr'), url);
    const sel = $('prLang');
    if (!sel.options.length) langOptions(sel, S.ev.lang || 'en');
  }
  async function printable(format) {
    const kind = (document.querySelector('input[name="prKind"]:checked') || {}).value || 'a6x4';
    const lang = $('prLang').value || 'en';
    $('prMsg').textContent = 'Preparing…';
    const blob = await ESPrint.make(S.code, { kind, lang, format });
    $('prMsg').textContent = '';
    if (format === 'png') { const p = $('prPreview'); if (p.src) URL.revokeObjectURL(p.src); p.src = URL.createObjectURL(blob); p.hidden = false; }
    const r = await EM.save(blob, `event-sky-${S.code}-${kind}.${format}`);
    if (r !== 'cancelled') toast('Saved to Downloads');
  }

  // ================================================================================================== Gallery ===
  async function renderGallery() {
    const e = S.ev, cp = e.cap;
    try { S.galleryUrl = S.galleryUrl || await ES.gallery.link(S.code); } catch (x) { S.galleryUrl = ''; }
    $('galUrl').textContent = S.galleryUrl;
    $('galOpen').href = S.galleryUrl ? `event-gallery.html?e=${S.code}${S.galleryUrl.slice(S.galleryUrl.indexOf('#'))}` : '#';
    const days = $('galDays'); days.textContent = '';
    const cur = Math.round((e.expiresAt - e.closesAt) / DAY);
    const opts = [3, 7, 30, 90].filter((d) => d <= cp.gd);
    if (!opts.includes(cur)) opts.push(cur);
    opts.sort((a, b) => a - b).forEach((d) => days.append(h('option', { value: String(d) }, F('{0} days', d))));
    days.value = String(cur);
    days.disabled = !isCohost();
    $('galKeep').textContent = F('Photos are kept until {0}.', fmtDate(e.expiresAt));
    $('galFull').textContent = e.fu < e.expiresAt ? 'Full-size photos are kept for 14 days; after that your 300 highlights stay full size and the rest stay as small previews.' : '';
    $('sxBox').hidden = !cp.sx;
    if (cp.sx) {
      $('sxOn').checked = !!(e.ft && e.ft.sx);
      $('sxPrep').disabled = !(e.ft && e.ft.sx);
      $('sxMsg').textContent = S.cfg && S.cfg.face ? '' : 'Selfie search is switched off for now.';
    }
  }
  function passphrase() {
    const words = ['diya', 'mango', 'river', 'lotus', 'peacock', 'saffron', 'jasmine', 'monsoon', 'sparkle', 'garland', 'rangoli', 'lantern', 'comet', 'tabla',
      'sitar', 'marigold', 'harbour', 'meadow', 'velvet', 'orchid', 'sunrise', 'starlight', 'banyan', 'coconut', 'cardamom', 'kite', 'parrot', 'pearl'];
    const pick = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; };
    const w = [0, 1, 2].map(() => words[pick() % words.length]);
    return `${w.join('-')}-${String(pick() % 90 + 10)}`;
  }
  // The gallery's lk/pack lease: walls normally hold it (their packer writes the pages); a free or expired lease is ours.
  async function takeLease() {
    const t = now();
    let lk = null;
    try { lk = await ES.db.get(`es/${S.code}/lk/pack`, { auth: true }); } catch (e) { return false; }
    if (lk && lk.u !== S.uid && lk.un > t) return false;
    try { await ES.db.put(`es/${S.code}/lk/pack`, { u: S.uid, un: t + 110e3 }, { auth: true }); return true; } catch (e) { return false; }
  }
  async function dropLease() { try { await ES.db.del(`es/${S.code}/lk/pack`, { auth: true }); } catch (e) { /* expires by itself */ } }
  // Rewrite every gallery page: with a new key (New link) or for a new expiry (gallery days). Pages already in the new
  // key are kept as they are (a wall's packer may have rewritten them first).
  async function rewritePages(oldK, newK, onProgress) {
    const code = S.code;
    if (!await takeLease()) return { busy: true };
    const wasPacker = S.packer; if (wasPacker) { try { wasPacker.stop(); } catch (e) { /* stopped */ } S.packer = null; }
    try {
      const m = await ES.gallery.manifest(code);
      if (!m || !m.pc) return { pages: 0 };
      const vr = (m.vr || 0) + 1;
      const pv = Array.from({ length: m.pc }, (_, n) => Math.max(0, Math.round(+(Array.isArray(m.pv) ? m.pv[n] : 0)) || 0));
      const nk = ES.b64u.dec(newK), ok = ES.b64u.dec(oldK);
      for (let n = 0; n < m.pc; n++) {
        const d = await ES.fs.get(`events/${code}/pages/${n}`, { auth: 'opt' }).catch(() => null);
        if (!d || !d.pk || !d.pk.length) continue;
        let items;
        try { items = await EM.page.decode(d.pk, ok); } catch (e) { items = await EM.page.decode(d.pk, nk).catch(() => null); }
        if (!items) continue;
        const bytes = await EM.page.encode(items, nk, { sealed: !!d.se });
        await ES.gallery.writePage(code, n, bytes, { count: items.length, sealed: !!d.se, vr });
        pv[n] += 1; // a rewritten page gets a new version: galleries fetch it again
        if (onProgress) onProgress((n + 1) / m.pc);
        await ES.db.put(`es/${code}/lk/pack`, { u: S.uid, un: now() + 110e3 }, { auth: true }).catch(() => {});
      }
      const next = { pc: m.pc, fc: oldK === newK ? m.fc : 0, vr, gi: m.gi, pv };
      if (oldK !== newK) next.wr = null; // a password link wraps the old key: make a new one
      else if (m.wr) next.wr = m.wr;
      await ES.gallery.writeManifest(code, next);
      return { pages: m.pc };
    } finally {
      await dropLease();
      if (wasPacker) startPacker();
    }
  }
  async function rotateLink() {
    if (!await ask('Make a new link (old links stop working)', 'Old links stop working. Guests need the new link.', 'Make a new link')) return;
    const msg = $('galRotMsg'); msg.textContent = 'Preparing…';
    const oldK = await ES.gallery.key.get(S.code);
    const newK = await ES.gallery.key.rotate(S.code);
    const r = await rewritePages(oldK, newK, (f) => { msg.textContent = F('Preparing… {0}%', Math.round(f * 100)); });
    S.galleryUrl = ''; S.keyB64 = newK;
    await renderGallery();
    msg.textContent = r.busy ? 'The big screen updates the gallery pages in a minute.' : 'The new link is ready ✓';
  }
  async function setGalleryDays(days) {
    await ES.events.update(S.code, { gd: days });
    S.ev = await ES.events.get(S.code);
    const k = await ES.gallery.key.get(S.code);
    const r = await rewritePages(k, k);
    await renderGallery();
    toast(r.busy ? 'The big screen updates the gallery pages in a minute.' : 'Saved ✓');
  }
  // Selfie search: ESFace is bundled (face/face-search.js, script-src 'self'); only the model's data comes from
  // cfg.faceBase, SHA-256 checked. This page's connect-src is 'self', so it prepares only where faceBase is on its own
  // origin (the website); in the app the host prepares it on a laptop.
  async function prepareFaces() {
    const msg = $('sxMsg');
    if (!(S.cfg && S.cfg.face)) { msg.textContent = 'Selfie search is switched off for now.'; return; }
    let same = false;
    try { same = new URL(String(S.cfg.faceBase || ''), location.href).origin === location.origin; } catch (e) { same = false; }
    if (!same) { msg.textContent = 'Selfie search is prepared on a laptop. Open this event there with “Manage on a laptop”.'; return; }
    if (!window.ESFace) await loadScript('face/face-search.js');
    if (!window.ESFace || !ESFace.available()) { msg.textContent = 'Selfie search is switched off for now.'; return; }
    await ESFace.load({ onProgress: (f) => { msg.textContent = F('Preparing… {0}%', Math.round((f || 0) * 30)); } });
    const keyB = await ES.gallery.key.get(S.code);
    const key = ES.b64u.dec(keyB);
    const m = await ES.gallery.manifest(S.code);
    const items = [];
    for (let n = 0; m && n < m.pc; n++) {
      const page = await ES.gallery.page(S.code, n, key).catch(() => []);
      const ids = page.filter((it) => it.kd !== 'v').map((it) => it.id);
      for (let i = 0; i < ids.length; i += 20) {
        const docs = await ES.media.get(S.code, ids.slice(i, i + 20), { select: ['d'], auth: true });
        docs.forEach((d, j) => { const it = page.find((x) => x.id === ids[i + j]); if (d && d.d && d.d.length && it) items.push({ gi: it.gi, bytes: d.d }); });
      }
      msg.textContent = F('Preparing… {0}%', 30 + Math.round(((n + 1) / m.pc) * 30));
    }
    const out = await ES.fs.query(`events/${S.code}`, { from: 'guests', where: [['fo', '==', false]], select: ['im'], limit: 1000, auth: true }).catch(() => []);
    const excludeSelfies = out.map((g) => g.im).filter((b) => b && b.length);
    await ESFace.prepare(S.code, { items, key, excludeSelfies, onProgress: (f) => { msg.textContent = F('Preparing… {0}%', 60 + Math.round((f || 0) * 40)); } });
    msg.textContent = 'Selfie search is ready ✓';
    $('sxPrep').textContent = 'Update selfie search';
  }
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => resolve(true); s.onerror = () => { s.remove(); resolve(false); };
      document.head.append(s);
    });
  }
  // The gallery pages: a wall's packer normally writes them; with no wall running, this console does (§3.6).
  async function startPacker() {
    if (S.packer || !isCohost()) return;
    if (!window.ESPacker) await loadScript('event-packer.js');
    if (!window.ESPacker || typeof ESPacker.start !== 'function' || !S.code) return;
    try {
      const key = await ES.gallery.key.get(S.code);
      S.packer = ESPacker.start(S.code, { key, prio: 'host' }); // walls go first; the console takes over after their grace time
    } catch (e) { S.packer = null; }
  }

  // ================================================================================================ Downloads ===
  let dlAbort = null;
  function renderDownloads() {
    const e = S.ev, cp = e.cap;
    const only = $('dlOnly'); only.textContent = '';
    only.append(h('option', { value: 'all' }, 'All photos'), h('option', { value: 'highlights' }, 'Highlights'));
    (e.fns || []).forEach((f) => only.append(raw('option', f.n, { value: f.id })));
    $('dlVidFree').hidden = !cp.mk;
    $('dlBookBox').hidden = !!cp.mk;
    $('dlCsvRsvp').hidden = !cp.rs;
    $('dlCsvAn').hidden = !!cp.mk;
    $('dlFull').textContent = e.fu < e.expiresAt ? F('Full-size copies are kept until {0}.', fmtDate(e.fu)) : F('Photos are kept until {0}.', fmtDate(e.expiresAt));
    $('dlRemind').hidden = !isCohost();
    if (!R.musicFor || R.musicFor !== S.code) { R.musicFor = S.code; R.song = null; R.msg = ''; R.left = 0; $('dlVidNote').hidden = true; $('dlSongName').hidden = true; $('dlMusic').value = e.tpl === 'birthday' ? 'birthday' : 'tune'; }
    reelLoad();
    renderReel();
    loadPick();
  }
  // The wishes in the video: every shown guest, ticked; the host unticks the ones to leave out (ESExport.bestOf {pick}).
  async function loadPick() {
    const code = S.code, box = $('dlPick');
    let list = [];
    try { list = (await ES.guests.changes(code, { st: [1], limit: 300, select: ['nm', 'wi', 'at'] })).items || []; } catch (e) { list = []; }
    if (code !== S.code) return;
    list.sort((a, b) => (Number(!!b.wi) - Number(!!a.wi)) || (a.at - b.at));
    const keep = R.pickFor === code && R.pickOff ? R.pickOff : new Set();
    R.pickFor = code; R.pickOff = keep;
    box.textContent = '';
    const sum = () => {
      const on = list.filter((g) => !keep.has(String(g._id)));
      R.pick = keep.size ? on.map((g) => String(g._id)) : null;
      $('dlPickSum').textContent = keep.size ? F('{0} of {1} wishes chosen', on.length, list.length) : T('Choose the wishes');
    };
    for (const g of list) {
      const cb = h('input', { type: 'checkbox' }); cb.checked = !keep.has(String(g._id));
      cb.addEventListener('change', () => { if (cb.checked) keep.delete(String(g._id)); else keep.add(String(g._id)); sum(); });
      box.append(h('label', null, cb, h('span', { 'data-no-i18n': '' }, h('b', null, g.nm || ''), g.wi ? h('small', null, g.wi) : null)));
    }
    $('dlPickBox').hidden = !list.length;
    sum();
  }
  // ============================================================================================== Wish Reel ===
  // The best-of video with every wish, no mark, Full HD and up to 3 minutes (ESExport.bestOf {full}): a Google Play
  // one-time product, es_wish_reel (about ₹99), bought per event through the passes' channel (premium('es-buy')). It is
  // no pass: nothing is written to Firestore (everything it unlocks happens on this phone), so the purchase is kept as
  // luts:es-reels {code: tx} and the store's list of purchases. A purchase still processing (UPI) is remembered as
  // luts:es-reel-want = code and given to that event when it comes through. Premium (subscription, reviewer flag or a
  // festival pass, as game.js reads them) and a paid plan include it. RTDB es_cfg.reel === false hides the offer.
  const REEL_ID = 'es_wish_reel';
  const isReel = (id) => String(id || '') === REEL_ID || String(id || '').startsWith(REEL_ID + ':');
  const R = { buying: '', added: false, msg: '', left: 0, song: null, musicFor: '', asked: false };
  const lsJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  function premiumOn() {
    try {
      if (localStorage.getItem('luts:premium') === '1' || localStorage.getItem('luts:reviewer') === '1') return true;
      const v = localStorage.getItem('luts:pass'), until = { diwali_pass: new Date(2026, 10, 16).getTime(), newyear_pass: new Date(2027, 0, 8).getTime() }[v === '1' ? 'diwali_pass' : v];
      return !!until && Date.now() < until;
    } catch (e) { return false; }
  }
  const reelBought = (code) => { const tx = lsJson('luts:es-reels', {})[code]; return !!tx; };
  const reelOn = () => !!S.ev && (premiumOn() || !S.ev.cap.mk || reelBought(S.code));
  const reelStore = () => !!(window.LUTSNative && window.LUTSNative.platform !== 'ios' && typeof window.LUTSNative.premium === 'function' && !(S.cfg && S.cfg.reel === false));
  const reelProduct = () => P.products.find((p) => isReel(p.id)) || null;
  function reelLoad() {
    if (!reelStore() || R.asked) return;
    R.asked = true;
    try {
      if (window.LUTSNative.lastEventSky) passState(window.LUTSNative.lastEventSky);
      if (!P.loaded) { P.loaded = true; window.LUTSNative.premium('es-products'); } else window.LUTSNative.premium('es-state');
    } catch (e) { /* no store: the card says so */ }
  }
  // The events waiting for a Wish Reel (luts:es-reel-want): [{code, old:[the reel purchases already known when its
  // buy began]}]. Several may wait (a UPI payment still processing, then another event); none is dropped while its
  // payment is pending. A purchase that comes through goes to the oldest event waiting, never one known before the buy
  // (so a reel bought on an earlier install is not taken for the new one: that one is offered by "Use a Wish Reel you
  // bought earlier"). A string (the first version) is read as one event.
  const reelTxs = () => P.credits.filter((c) => c && c.tx && isReel(c.product)).map((c) => c.tx);
  function wants() {
    const v = lsJson('luts:es-reel-want', null);
    if (typeof v === 'string') return [{ code: v, old: [] }];
    return Array.isArray(v) ? v.filter((w) => w && typeof w.code === 'string') : [];
  }
  const putWants = (l) => lsPut('luts:es-reel-want', l.length ? l : null);
  function spareReels() { const used = new Set(Object.values(lsJson('luts:es-reels', {}))); return P.credits.filter((c) => c && c.tx && isReel(c.product) && !used.has(c.tx)).sort((a, b) => a.at - b.at); }
  function reelCredits(detail) {
    let list = wants();
    if (!list.length || !Array.isArray(detail && detail.credits)) return;
    const map = lsJson('luts:es-reels', {}), used = new Set(Object.values(map));
    const fresh = detail.credits.filter((c) => c && c.tx && isReel(c.product) && !used.has(c.tx)).sort((a, b) => a.at - b.at);
    if (!fresh.length) return;
    // the event just paid for first (the newest purchase), then the others in the order they asked
    if (detail.event === 'purchased' && R.buying) list = list.filter((w) => w.code === R.buying).concat(list.filter((w) => w.code !== R.buying));
    const left = [];
    for (const w of list) {
      const old = new Set(w.old || []);
      const pool = fresh.filter((c) => !used.has(c.tx) && !old.has(c.tx));
      const c = detail.event === 'purchased' && w.code === R.buying ? pool[pool.length - 1] : pool[0];
      if (!c) { left.push(w); continue; }
      map[w.code] = c.tx; used.add(c.tx);
      if (w.code === S.code) { R.msg = ''; R.left = 0; }
    }
    lsPut('luts:es-reels', map); putWants(left);
  }
  function reelEvent(detail) {
    const drop = () => { if (R.added) putWants(wants().filter((w) => w.code !== R.buying)); R.added = false; };
    if (detail.event === 'cancelled') { drop(); R.buying = ''; R.msg = 'Purchase cancelled'; }
    else if (detail.event === 'pending') { R.added = false; R.buying = ''; R.msg = 'Payment processing: your Wish Reel unlocks automatically.'; }
    else if (detail.event === 'purchased') { R.added = false; R.buying = ''; R.msg = ''; }
    else if (detail.status === 'error' || detail.status === 'unavailable') { drop(); R.buying = ''; R.msg = "The Wish Reel isn't available right now."; }
    renderReel();
  }
  function buyReel() {
    const p = reelProduct();
    if (!p || !S.code) { R.msg = "The Wish Reel isn't available right now."; renderReel(); return; }
    const list = wants(), had = list.some((w) => w.code === S.code);
    if (!had) { list.push({ code: S.code, old: reelTxs() }); putWants(list); }
    R.added = !had; R.buying = S.code; R.msg = '';
    try { window.LUTSNative.premium('es-buy', p.id); } catch (e) { reelEvent({ status: 'error' }); return; }
    renderReel();
  }
  // A reel bought earlier (on another install, or before this phone forgot which event it was for), given to this event.
  function useSpareReel() {
    const c = spareReels()[0];
    if (!c || !S.code) return;
    const map = lsJson('luts:es-reels', {}); map[S.code] = c.tx; lsPut('luts:es-reels', map);
    putWants(wants().filter((w) => w.code !== S.code));
    R.msg = ''; R.left = 0; renderReel();
  }
  function renderReel() {
    const box = $('dlReel');
    if (!box || !S.ev) return;
    const on = reelOn(), p = reelProduct(), btn = $('dlReelBuy'), use = $('dlReelUse'), msg = $('dlReelMsg');
    const waiting = wants().some((w) => w.code === S.code), spare = !on && !waiting && spareReels().length > 0;
    box.hidden = !on && (!reelStore() || P.unsupported);
    $('dlVidFree').hidden = on || !S.ev.cap.mk;
    let line = R.msg;
    if (on) {
      line = premiumOn() ? 'Included with Premium ✓' : !S.ev.cap.mk ? 'Included with your pass ✓' : 'Wish Reel unlocked for this event ✓';
      if (R.left) line = T(line) + ' ' + (R.left === 1 ? T("1 wish didn't fit in 3 minutes. Untick some under Choose the wishes.") : F(T("{0} wishes didn't fit in 3 minutes. Untick some under Choose the wishes."), R.left));
    } else if (!line && waiting) line = 'Payment processing: your Wish Reel unlocks automatically.';
    else if (!line && R.left) line = R.left === 1 ? '1 wish didn\'t fit in the free 30-second video.' : F("{0} wishes didn't fit in the free 30-second video.", R.left);
    else if (!line && P.status && P.status !== 'loading' && !p && !spare) line = "The Wish Reel isn't available right now.";
    msg.textContent = line || '';
    use.hidden = !spare;
    btn.hidden = on || !p || spare;
    if (p) { btn.textContent = F('Get the Wish Reel for {0}', p.price); btn.disabled = !!R.buying; }
  }
  function progress(on, text) {
    $('dlProg').hidden = !on;
    if (text != null) $('dlMsg').textContent = text;
    if (!on) $('dlBar').value = 0;
  }
  async function runExport(kind, fn) {
    if (dlAbort) return;
    dlAbort = new AbortController();
    const signal = dlAbort.signal;
    progress(true, F('Preparing… {0}%', 0));
    const onProgress = (f) => { const p = Math.round(clamp(+f || 0, 0, 1) * 100); $('dlBar').value = p; $('dlMsg').textContent = F('Preparing… {0}%', p); };
    try { await fn({ signal, onProgress }); } catch (e) {
      if (e && (e.code === 'CANCELLED' || e.name === 'AbortError')) toast('Cancelled');
      else if (e && e.code === 'FULL' && kind === 'book') toast('A photo book holds up to 300 photos. Pick highlights first.', { ms: 6000 });
      else toastErr(e);
    } finally { dlAbort = null; progress(false); }
  }
  async function saveFile(blob, name, shareable, caption) {
    const r = await EM.save(blob, name);
    if (r === 'cancelled') return;
    if (shareable) toast('Saved. Share it?', { action: 'Share', ms: 8000, onAction: () => EM.share({ files: [new File([blob], name, { type: blob.type })], text: caption }).catch(() => {}) });
    else toast('Saved to Downloads');
  }
  async function bigDownloadOk() {
    let n = 0;
    try { n = (await ES.fs.aggregate(`events/${S.code}`, { from: 'media', where: [['st', 'in', [0, 1]]], aggs: { n: ['count'] }, auth: true })).n || 0; } catch (e) { return true; }
    const mb = Math.round(n * 0.12);
    const wifi = navigator.connection && /wifi|ethernet/.test(navigator.connection.type || '');
    if (mb < 50 || wifi) return true;
    return ask('All photos and videos (ZIP)', F('This is a big download (about {0} MB). Use Wi-Fi?', mb), 'Download');
  }
  const ZIP_PART = 190e6; // bytes: the Android bridge takes files up to 200 MB
  const ZIPS = { saved: 0 }; // parts saved by the last full download (test hook: state().zipSaved)
  async function exportZip() {
    if (!await bigDownloadOk()) return;
    await runExport('zip', async ({ signal, onProgress }) => {
      const only = $('dlOnly').value || 'all';
      const ul = $('dlParts'); ul.textContent = '';
      const base = `event-sky-${S.code}${only === 'all' ? '' : '-' + only}`;
      // Each part is saved as soon as it closes (under 190 MB: the app's file bridge refuses anything over 200 MB), so a
      // big event never holds every part at once. The first part waits for the second, to learn whether there are parts.
      let held = null, saved = 0;
      const savePart = async (blob, i) => { saved++; await saveFile(blob, `${base}-part-${i + 1}.zip`); };
      const onPart = async (blob, i) => {
        if (i === 0) { held = blob; return; }
        if (held) { const first = held; held = null; await savePart(first, 0); }
        await savePart(blob, i);
      };
      const parts = await ESExport.zip(S.code, { only, onProgress, signal, onPart, maxPart: ZIP_PART });
      if (held && parts.length === 1) { held = null; ZIPS.saved = 1; await saveFile(parts[0], `${base}.zip`); return; }
      if (held) { const first = held; held = null; await savePart(first, 0); }
      parts.forEach((p, i) => {
        const name = `${base}-part-${i + 1}.zip`;
        ul.append(h('li', null, h('span', { class: 'eh-grow' }, F('Part {0} of {1}', i + 1, parts.length)), btn('Download', () => saveFile(p, name))));
      });
      ZIPS.saved = saved;
    });
  }
  async function exportVideo(aspect) {
    const kind = $('dlMusic').value;
    if (kind === 'file' && !R.song) { $('dlSong').click(); return; }
    await runExport('video', async ({ signal, onProgress }) => {
      const full = reelOn();
      const blob = await ESExport.bestOf(S.code, { aspect, seconds: S.ev.cap.mk ? 30 : 60, reduced: $('dlCalm').checked, onProgress, signal, full,
        music: { kind, file: kind === 'file' ? R.song : null }, style: $('dlStyle').value, pick: R.pick });
      const last = ESExport.last || {};
      if (kind === 'file' && !last.music) toast('That song did not open. Try another one.', { ms: 5000 });
      // music or the trailer's sound was asked for, but this phone could not put a sound track in the file
      const note = $('dlVidNote'); note.hidden = !((kind !== 'none' || last.cine) && !last.audio);
      if (!note.hidden) note.textContent = T("This phone can't add sound to videos, so this one is silent.");
      R.left = +last.wishesLeft || 0;
      renderReel();
      const ext = /webm/.test(blob.type) ? 'webm' : 'mp4';
      await saveFile(blob, `event-sky-${S.code}-best-of-${aspect === '9:16' ? 'vertical' : 'wide'}.${ext}`, true, ES.caption('video', { title: S.ev.title, names: S.ev.names, url: S.galleryUrl }));
    });
  }
  async function exportBook(perPage) {
    await runExport('book', async ({ signal, onProgress }) => {
      const blob = await ESExport.book(S.code, { perPage, only: $('dlBookOnly').value, onProgress, signal });
      await saveFile(blob, `event-sky-${S.code}-photo-book.pdf`, true, ES.caption('book', { title: S.ev.title, names: S.ev.names }));
    });
  }
  async function exportCsv(kind) {
    await runExport('csv', async () => {
      const blob = await ESExport.csv(S.code, kind);
      await saveFile(blob, `event-sky-${S.code}-${kind}.csv`);
    });
  }
  async function remindMe() {
    const e = S.ev, at = Math.max(Date.now() + HOUR, e.fu - DAY);
    const title = F(T('Download your photos before {0}'), fmtDate(e.fu));
    const blob = EM.ics({ title, at, url: ES.urls.host(S.code), description: e.title });
    await saveFile(blob, `event-sky-${S.code}-reminder.ics`);
  }

  // =================================================================================================== Guests ===
  // One list per event, kept between doorbells: the first visit reads a page of 100 (no selfie bytes), every later ring
  // continues the same mt cursor, so only guests that changed since are read again (at most once every 30 s) and merged
  // in by id. Selfie thumbnails are read only for rows on screen (IntersectionObserver), 20 to a batchGet, and kept.
  const GUEST_SEL = ['nm', 'wi', 'fn', 'st', 'mt', 'at', 'fo'];
  const G = { code: '', cursor: null, byId: new Map(), gone: new Set(), more: false, count: null, at: 0, busy: null, again: false, thumbs: new Map(), want: new Set(), timer: null, io: null };
  function resetGuests() {
    clearTimeout(G.timer);
    if (G.io) G.io.disconnect();
    G.thumbs.forEach((u) => { if (u) URL.revokeObjectURL(u); });
    Object.assign(G, { code: S.code, cursor: null, byId: new Map(), gone: new Set(), more: false, count: null, at: 0, busy: null, again: false, thumbs: new Map(), want: new Set(), timer: null, io: null });
  }
  const TUNE = { guestGap: 30e3 }; // EventHost.tune() (tests)
  // o.more: the "Show more" button; o.bell: a doorbell (throttled); otherwise opening the tab (a delta when already loaded).
  async function renderGuests(o = {}) {
    if (G.code !== S.code) resetGuests();
    const first = !G.at;
    if (!first && !o.more && !o.force) {
      const wait = G.at + TUNE.guestGap - Date.now();
      if (wait > 0) { // too soon: draw what we have, and catch up once the gap has passed
        if (!o.bell) drawGuests();
        clearTimeout(G.timer);
        G.timer = setTimeout(() => { if (S.tab === 'guests' && G.code === S.code) renderGuests({ bell: true }).catch(() => {}); }, wait + 20);
        return;
      }
    }
    if (G.busy) { G.again = true; return G.busy; }
    const code = S.code;
    G.busy = (async () => {
      G.at = Date.now();
      const r = await ES.guests.changes(code, { cursor: G.cursor, st: [0, 1, 2, 3], limit: 100, select: GUEST_SEL });
      if (G.code !== code) return;
      for (const g of r.items) if (!G.gone.has(String(g._id))) G.byId.set(String(g._id), Object.assign(G.byId.get(String(g._id)) || {}, g));
      if (r.cursor) G.cursor = r.cursor;
      if (first || o.more) G.more = r.items.length >= 100;
      if (first || r.items.length) {
        try { G.count = (await ES.fs.aggregate(`events/${code}`, { from: 'guests', where: [['st', 'in', [0, 1, 2]]], aggs: { n: ['count'] }, auth: true })).n; } catch (e) { G.count = null; }
      }
      drawGuests();
    })().finally(() => {
      G.busy = null;
      if (G.again) { G.again = false; renderGuests({ bell: true }).catch(() => {}); }
    });
    return G.busy;
  }
  function guestThumbs() {
    clearTimeout(guestThumbs.t);
    guestThumbs.t = setTimeout(async () => {
      const code = G.code, ids = [...G.want].filter((id) => !G.thumbs.has(id)).slice(0, 20);
      G.want.clear();
      if (!ids.length || code !== S.code) return;
      ids.forEach((id) => G.thumbs.set(id, '')); // asked once
      let docs = [];
      try { docs = await ES.fs.batchGet(ids.map((id) => `events/${code}/guests/${id}`), { mask: ['im'], auth: true }); } catch (e) { ids.forEach((id) => G.thumbs.delete(id)); return; }
      if (G.code !== code) return;
      ids.forEach((id, i) => {
        const im = docs[i] && docs[i].im;
        const u = im && im.length ? URL.createObjectURL(new Blob([im], { type: 'image/jpeg' })) : '';
        G.thumbs.set(id, u);
        const img = u && document.querySelector(`#guestList img[data-g="${CSS.escape(id)}"]`);
        if (img) img.src = u;
      });
    }, 60);
  }
  function drawGuests() {
    if (G.code !== S.code) return;
    $('guestMore').hidden = !G.more;
    const ul = $('guestList'); ul.textContent = '';
    if (G.io) G.io.disconnect();
    G.io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((ents) => {
      for (const en of ents) if (en.isIntersecting) { G.want.add(en.target.dataset.g); G.io.unobserve(en.target); }
      if (G.want.size) guestThumbs();
    }, { rootMargin: '200px' }) : null;
    const sorted = [...G.byId.values()].filter((g) => [0, 1, 2].includes(g.st)).sort((a, b) => (b.at || 0) - (a.at || 0));
    $('guestCount').textContent = F('Guests checked in: {0}', G.count == null ? sorted.length : Math.max(G.count, sorted.length));
    for (const g of sorted) {
      const id = String(g._id), u = G.thumbs.get(id) || '';
      const img = h('img', { alt: '', 'data-g': id, src: u || null });
      const fn = (S.ev.fns || []).find((f) => f.id === g.fn);
      const li = h('li', { class: g.st === 2 ? 'off' : '' }, img,
        h('span', { class: 'eh-grow' }, raw('b', g.nm), g.wi ? h('br') : null, g.wi ? raw('span', g.wi, { class: 'eh-muted' }) : null, h('br'),
          h('span', { class: 'eh-muted' }, [g.st === 0 ? T('Waiting') : g.st === 1 ? T('On screen') : T('Not shown'), fn ? fn.n : '', fmtTime(g.at)].filter(Boolean).join(' · '))));
      li.append(btn(g.st === 1 ? 'Hide' : 'Show', () => act(null, async () => { await ES.media.decide(S.code, [{ coll: 'guests', id: g._id, st: g.st === 1 ? 2 : 1 }]); g.st = g.st === 1 ? 2 : 1; drawGuests(); })));
      if (isCohost()) {
        li.append(btn('Remove guest', async () => {
          if (!await ask('Remove guest', F('This removes {0}\'s check-in, photos, videos and message. It can\'t be undone.', g.nm), 'Remove guest', { danger: true })) return;
          await act(null, async () => {
            await ES.media.removeGuest(S.code, g._id); toast('Removed');
            G.byId.delete(id); G.gone.add(id); if (G.count != null) G.count = Math.max(0, G.count - 1);
            const t = G.thumbs.get(id); if (t) URL.revokeObjectURL(t); G.thumbs.delete(id);
            drawGuests();
          });
        }));
      }
      ul.append(li);
      if (!G.thumbs.has(id)) { if (G.io) G.io.observe(img); else { G.want.add(id); guestThumbs(); } }
    }
  }

  // ===================================================================================================== RSVP ===
  async function renderRsvp() {
    const e = S.ev, on = !!(e.cap.rs && e.ft && e.ft.rs);
    $('rsvpOff').hidden = !!e.cap.rs; $('rsvpBox').hidden = !e.cap.rs; $('rsvpTable').hidden = !e.cap.rs;
    if (!e.cap.rs || !isCohost()) return;
    const sum = await ES.rsvp.summary(S.code);
    $('rsvpTotal').textContent = F('{0} households', sum.households);
    const ul = $('rsvpSum'); ul.textContent = '';
    for (const f of e.fns || []) {
      const s = sum.byFn[f.id] || { yes: 0, people: 0 };
      ul.append(h('li', null, raw('b', f.n, { class: 'eh-grow' }), h('span', null, F('{0} households · {1} people', s.yes, s.people))));
    }
    const list = await ES.rsvp.list(S.code);
    const thead = $('rsvpTable').tHead, tbody = $('rsvpTable').tBodies[0];
    thead.textContent = ''; tbody.textContent = '';
    thead.append(h('tr', null, h('th', null, 'Name'), h('th', null, 'Phone'), (e.fns || []).map((f) => raw('th', f.n)), h('th', null, 'Food'), h('th', null, 'Note'), h('th', null, 'Updated'), h('th', null, '')));
    for (const r of list.sort((a, b) => b.at - a.at)) {
      tbody.append(h('tr', null, raw('td', r.name), raw('td', r.phone), (e.fns || []).map((f) => raw('td', String((r.fns || {})[f.id] || 0))), raw('td', r.diet), raw('td', r.note), raw('td', fmtDT(r.at)),
        h('td', null, btn('Remove', async () => {
          if (!await ask('Remove', 'Delete this RSVP?', 'Remove', { danger: true })) return;
          await act(null, async () => { await ES.rsvp.remove(S.code, r.id); renderRsvp(); });
        }))));
    }
    $('rsvpLink').hidden = !on;
  }

  // ================================================================================================ Guestbook ===
  async function renderBook() {
    const ul = $('bookList'); ul.textContent = '';
    if (!isCohost()) return;
    const docs = await ES.fs.query(`events/${S.code}`, { from: 'book', select: ['nm', 'tx', 'vm', 'du', 'at'], orderBy: [['at', 'desc']], limit: 300, auth: true });
    const list = docs.filter((d) => d.nm || d.tx);
    $('bookEmpty').hidden = list.length > 0;
    for (const d of list) {
      const li = h('li', null, h('div', { class: 'eh-grow' }, raw('b', d.nm), ' ', h('span', { class: 'eh-muted' }, fmtDT(d.at)), d.tx ? raw('p', d.tx) : null));
      if (d.du) {
        const play = btn(`${T('Play')} · ${mmss(d.du)}`, () => act(play, async () => {
          const v = await ES.fs.get(`events/${S.code}/book/${d._id}`, { mask: ['v', 'vm'], auth: true });
          if (!v || !v.v || !v.v.length) return;
          const u = URL.createObjectURL(new Blob([v.v], { type: String(v.vm || 'audio/webm') }));
          const au = h('audio', { src: u, controls: true, autoplay: true, preload: 'auto' });
          play.replaceWith(au);
        }), { 'data-no-i18n': '' });
        li.querySelector('.eh-grow').append(play);
      }
      ul.append(li);
    }
  }

  // ==================================================================================================== Stats ===
  async function renderStats() { if (window.ESStats) await ESStats.render($('statsBox'), S.code); }

  // ===================================================================================================== Shop ===
  async function renderShop() {
    if (!(S.cfg && S.cfg.shop)) return;
    if (!window.ESShop) await loadScript('event-shop.js');
    if (!window.ESShop || !ESShop.ui) { $('shopMsg').textContent = 'Something went wrong. Try again.'; return; }
    $('shopMsg').textContent = '';
    await ESShop.ui.settings($('shopSettings'), S.code);
    await ESShop.ui.orders($('shopOrders'), S.code);
  }

  // ================================================================================================= Settings ===
  const SF = { fns: [], ms: [] };
  function renderSettings(o = {}) {
    const e = S.ev, cp = e.cap;
    if (o.soft && document.activeElement && $('setForm').contains(document.activeElement)) return; // do not overwrite typing
    const T0 = ES.TEMPLATES[e.tpl] || ES.TEMPLATES.party;
    $('sNamesLabel').textContent = T0.namesLabel;
    $('sTitle').value = e.title; $('sNames').value = e.names || '';
    S.world = e.world;
    worldPicker($('sWorlds'), e.world, (w) => { S.world = w; });
    langOptions($('sLang'), e.lang);
    const open = now() >= e.opensAt;
    $('sOpens').value = toLocal(e.opensAt); $('sOpens').disabled = open;
    $('sCloses').value = toLocal(e.closesAt);
    SF.fns = (e.fns || []).map((f) => ({ id: f.id, n: f.n, at: f.at || 0 }));
    $('sFnBox').hidden = cp.fm <= 1 && SF.fns.length === 0;
    renderFnEditor($('sFns'), SF.fns, cp.fm, true);
    SF.ms = (e.ms || []).map((m) => ({ id: m.id, n: m.t }));
    renderFnEditor($('sMs'), SF.ms, cp.mk ? 3 : 12, false);
    $('sMsAdd').disabled = SF.ms.length >= (cp.mk ? 3 : 12);
    $('sApprove').checked = !!e.approve;
    $('sContact').value = e.ct || ''; $('sNote').value = e.nt || '';
    const ft = e.ft || {};
    $('sGb').checked = ft.gb !== false; $('sDl').checked = ft.dl !== false; $('sVp').checked = ft.vp !== false; $('sRx').checked = ft.rx !== false;
    $('sVoBox').hidden = !cp.vo; $('sVo').checked = !!ft.vo;
    $('sRsBox').hidden = !cp.rs; $('sRs').checked = !!ft.rs;
    $('sLogoBox').hidden = !cp.lg;
    const img = $('sLogoImg');
    if (e.logo && e.logo.length) { if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(new Blob([e.logo])); img.hidden = false; $('sLogoDel').hidden = false; } else { img.hidden = true; $('sLogoDel').hidden = true; }
    $('sMsg').textContent = '';
    // check-in window
    const t = now();
    $('setWindow').textContent = t < e.opensAt ? F('Opens {0}', fmtDT(e.opensAt)) : t < e.closesAt ? F('Open until {0}', fmtDT(e.closesAt)) : T('Check-in has closed.');
    $('sCloseNow').hidden = !(t >= e.opensAt && t < e.closesAt);
    const reopenTo = Math.min(e.opensAt + cp.wd * DAY - MIN, t + 6 * HOUR);
    $('sReopen').hidden = !(t >= e.closesAt && reopenTo > t + 10 * MIN && t < e.expiresAt);
    $('sReopen').textContent = F('Reopen until {0}', fmtDT(reopenTo));
    $('sReopen').dataset.to = String(reopenTo);
    // plan
    $('setPlanName').textContent = F('Plan: {0}', T(PLAN_NAME[e.plan] || e.plan));
    const ub = $('upgradeBox'); ub.textContent = '';
    if (isHost() && ES.rank(e.plan) < 2) {
      let pk = null;
      const go = h('button', { type: 'button', class: 'es-btn', disabled: true }, 'Save');
      const sub = h('div');
      pk = planPicker(sub, { mode: 'upgrade', current: e.plan, sel: { plan: e.plan, proof: { kind: 'none' } }, onChange: () => { go.disabled = false; } });
      go.addEventListener('click', () => act(go, async () => {
        const sel = pk.sel;
        if (sel.proof.kind === 'none') return;
        await ES.events.upgrade(S.code, sel.proof, sel.plan);
        await reloadEvent(); renderSettings();
        toast('Saved ✓');
      }));
      ub.append(sub, go);
    }
    $('sDelCode').value = ''; $('sDelGo').disabled = true; $('sDelMsg').textContent = '';
    $('sKey').hidden = true; $('sKey').textContent = '';
  }
  async function saveSettings() {
    const e = S.ev, patch = {};
    const set = (k, v) => { patch[k] = v; };
    set('title', $('sTitle').value); set('names', $('sNames').value); set('world', S.world || e.world); set('lang', $('sLang').value);
    if (!$('sOpens').disabled) { const o = fromLocal($('sOpens').value); if (Number.isFinite(o)) set('opensAt', o); }
    const c = fromLocal($('sCloses').value); if (Number.isFinite(c)) set('closesAt', c);
    set('fns', SF.fns.filter((f) => ES.clean(f.n, 30)).map((f) => (f.at ? { id: f.id, n: f.n, at: f.at } : { id: f.id, n: f.n })));
    set('ms', SF.ms.filter((m) => ES.clean(m.n, 80)).map((m) => ({ id: m.id, t: m.n })));
    set('approve', $('sApprove').checked); set('ct', $('sContact').value); set('nt', $('sNote').value);
    set('ft', { gb: $('sGb').checked, dl: $('sDl').checked, vp: $('sVp').checked, rx: $('sRx').checked, vo: $('sVo').checked, rs: $('sRs').checked });
    if (!ES.clean(patch.title, 60)) { $('sMsg').textContent = 'Add a title'; return; }
    if (e.plan !== 'free' && !ES.clean(patch.ct, 80)) { $('sMsg').textContent = 'A contact for photo removal is required on paid plans'; return; }
    if (!(patch.closesAt > (patch.opensAt || e.opensAt))) { $('sMsg').textContent = 'Check-in must close after it opens'; return; }
    try {
      await ES.events.update(S.code, patch);
      const f = $('sLogo').files && $('sLogo').files[0];
      if (f) { await ES.events.update(S.code, { logo: f }); $('sLogo').value = ''; }
      await reloadEvent();
      renderSettings();
      $('sMsg').textContent = 'Saved ✓';
    } catch (x) {
      $('sMsg').textContent = /window/.test(x.message || '') ? windowText(e.cap.wd) : errText(x);
    }
  }
  async function deleteEvent() {
    if (ES.events.normCode($('sDelCode').value) !== S.code) return;
    const code = S.code, msg = $('sDelMsg');
    busy($('sDelGo'), true);
    try {
      if (S.packer) { try { S.packer.stop(); } catch (e) { /* stopped */ } S.packer = null; }
      if (S.watch) { S.watch.stop(); S.watch = null; }
      await ES.events.remove(code, { onProgress: (p) => { msg.textContent = F('Deleting… {0}', p && p.deleted != null ? p.deleted : ''); } });
      lsSet(PURGE_KEY(code), null); lsSet(`luts:es-revfin:${code}`, null);
      showMine();
      toast('Deleted.');
    } catch (e) { msg.textContent = errText(e); busy($('sDelGo'), false); startWatch(); }
  }

  // ================================================================================================= wiring ===
  function wire() {
    $('btnBack').addEventListener('click', () => back());
    $('btnCreate').addEventListener('click', () => openWizard());
    $('btnRecover').addEventListener('click', recoverSheet);
    $('sheetX').addEventListener('click', closeSheet);
    $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
    // wizard
    $('tplList').querySelectorAll('.eh-tpl').forEach((b) => b.addEventListener('click', () => pickTpl(b.dataset.tpl)));
    $('wPrev').addEventListener('click', () => { if (W.step > 1) wizGo(W.step - 1); });
    $('wNext').addEventListener('click', () => {
      if (W.step === 1) { if (W.tpl) wizGo(2); return; }
      if (!wizValidate(W.step)) return;
      if (W.step === 5) { wizCreate(); return; }
      wizGo(W.step + 1);
    });
    $('wFnAdd').addEventListener('click', () => { if (W.fns.length < 8) { W.fns.push({ n: '', at: 0 }); renderFnEditor($('wFns'), W.fns, 8, true); const l = $('wFns').querySelectorAll('input[type=text]'); if (l.length) l[l.length - 1].focus(); } });
    $('wKeyCopy').addEventListener('click', () => copy($('wKey').textContent));
    $('wKeySaved').addEventListener('click', () => { if (W.made) openEvent(W.made.code); });
    $('wDp').addEventListener('change', () => { $('wDpAtBox').hidden = !$('wDp').checked; });
    // tabs (arrow keys move between them)
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) selectTab(b.dataset.tab); });
    $('tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = [...$('tabs').querySelectorAll('[role=tab]')].filter((b) => !b.hidden);
      const i = tabs.findIndex((b) => b.dataset.tab === S.tab);
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      if (n) { selectTab(n.dataset.tab); n.focus(); e.preventDefault(); }
    });
    // moderation
    // The counts refresh on a tap (or every 5 minutes); in between they follow this deck's own decisions.
    $('modCounts').tabIndex = 0;
    $('modCounts').addEventListener('click', () => deckRefresh({ counts: true }));
    $('modCounts').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deckRefresh({ counts: true }); } });
    $('modFilters').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      D.filter = b.dataset.f; D.idx = 0;
      $('modFilters').querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      drawDeck();
    });
    $('bShow').addEventListener('click', () => decideItem(current(), 1));
    $('bHide').addEventListener('click', () => decideItem(current(), 2));
    $('bHl').addEventListener('click', highlight);
    $('bPrev').addEventListener('click', () => step(-1));
    $('bNextItem').addEventListener('click', () => step(1));
    $('bUndo').addEventListener('click', () => undo());
    $('bKeys').addEventListener('click', keysHelp);
    wireSwipe();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('sheet').hidden) { closeSheet(); return; }
      if (S.view !== 'event' || S.tab !== 'photos' || !$('sheet').hidden) return;
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && e.target.closest && e.target.closest('input,textarea,select'))) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const map = { j: () => step(1), k: () => step(-1), p: () => decideItem(current(), 1), r: () => decideItem(current(), 2), z: () => undo(), f: () => highlight(), '?': keysHelp };
      if (map[k]) { e.preventDefault(); map[k](); }
    });
    // live
    $('annNow').addEventListener('click', () => act($('annNow'), async () => {
      const style = (document.querySelector('input[name="annStyle"]:checked') || {}).value || 'b', text = $('annText').value;
      await ES.live.announce(S.code, { text, style: S.ev.cap.mk ? 'b' : style, cd: clamp(Math.round(+$('annCd').value || 0), 0, 15) * 60 });
      if ($('annText').value === text) $('annText').value = ''; // unless the next one is already being typed
      toast('Announced ✓');
    }));
    $('annSchedule').addEventListener('click', () => act($('annSchedule'), async () => {
      const text = ES.clean($('annText').value, 120);
      if (!text) { toast('Write the announcement first'); return; }
      const at = fromLocal($('annAt').value);
      if (!Number.isFinite(at)) { toast('Pick a time for the announcement'); return; }
      const style = S.ev.cap.mk ? 'b' : ((document.querySelector('input[name="annStyle"]:checked') || {}).value || 'b');
      const list = (S.ev.an || []).concat([{ t: text, at, st: style, cd: clamp(Math.round(+$('annCd').value || 0), 0, 15) * 60 }]);
      if (list.length > 20 || JSON.stringify(list.map((a) => ({ id: a.id || 'xxxxxxxx', t: a.t, at: a.at, st: a.st, cd: a.cd }))).length > 3100) { toast('No room for more scheduled announcements. Remove one first.'); return; }
      await ES.events.update(S.code, { an: list });
      if (ES.clean($('annText').value, 120) === text) $('annText').value = '';
      await reloadEvent(); renderLive(); toast('Scheduled ✓');
    }));
    $('chStart').addEventListener('click', () => act($('chStart'), async () => {
      await ES.live.challenge(S.code, { title: $('chTitle').value, minutes: clamp(Math.round(+$('chMin').value || 5), 1, 30), mission: $('chMission').value || undefined });
      S.live = await ES.live.get(S.code); $('chTitle').value = ''; $('chPhotos').textContent = ''; liveTick();
    }));
    $('chPickBtn').addEventListener('click', () => act($('chPickBtn'), challengePhotos));
    $('dpSave').addEventListener('click', () => act($('dpSave'), async () => {
      const at = fromLocal($('dpAt').value);
      await ES.events.update(S.code, { dp: { on: $('dpOn').checked, at: Number.isFinite(at) ? at : S.ev.closesAt, sh: clamp(Math.round(+$('dpSh').value || 1), 1, S.ev.cap.pg) } });
      await reloadEvent(); toast('Saved ✓');
    }));
    $('dpReveal').addEventListener('click', () => act($('dpReveal'), async () => { await ES.live.reveal(S.code); await reloadEvent(); toast('Revealed ✓'); }));
    $('dpFin').addEventListener('change', () => lsSet(`luts:es-revfin:${S.code}`, $('dpFin').checked || null));
    $('finBtn').addEventListener('click', () => act($('finBtn'), async () => {
      await ES.live.finale(S.code);
      if ($('dpFin').checked && S.ev.dp && S.ev.dp.on && S.ev.dp.at > now()) await ES.live.reveal(S.code).catch(() => {});
      S.live = await ES.live.get(S.code).catch(() => S.live);
      $('finState').textContent = 'The finale starts in a few seconds on every screen.';
    }));
    // team
    $('invBtns').addEventListener('click', (e) => { const b = e.target.closest('[data-inv]'); if (b) act(b, () => showInvite(b.dataset.inv)); });
    $('invCopy').addEventListener('click', () => copy($('invUrl').textContent));
    $('invShare').addEventListener('click', () => shareText(F(T('Anyone with this link can join as {0}. Make a new link to stop the old one.'), T(ROLE_NAME[invRole])), $('invUrl').textContent));
    $('invNew').addEventListener('click', () => act($('invNew'), () => showInvite(invRole, true)));
    $('invOff').addEventListener('click', () => act($('invOff'), async () => { await ES.roles.revoke(S.code, invRole); $('invUrl').textContent = T('This link is off.'); const g = $('invQr').getContext('2d'); g.clearRect(0, 0, $('invQr').width, $('invQr').height); }));
    $('laptopBtn').addEventListener('click', () => laptopLink(S.code));
    // screens
    $('scrRoles').addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      scrRole = b.dataset.s;
      $('scrRoles').querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      if (!$('scrBox').hidden) act(null, screenLink);
    });
    $('scrLink').addEventListener('click', () => act($('scrLink'), screenLink));
    $('scrCopy').addEventListener('click', () => copy($('scrUrl').textContent));
    $('scrShare').addEventListener('click', () => shareText(S.ev ? S.ev.title : '', $('scrUrl').textContent));
    $('pairGo').addEventListener('click', () => act($('pairGo'), async () => {
      $('pairMsg').textContent = '';
      try { await ES.pair.claim(S.code, $('pairPin').value); $('pairMsg').textContent = 'Paired ✓ The TV opens the wall in a few seconds.'; $('pairPin').value = ''; S.pairCode = ''; } catch (e) { $('pairMsg').textContent = errText(e); }
    }));
    $('wSave').addEventListener('click', () => act($('wSave'), async () => {
      await ES.live.set(S.code, { wall: { md: $('wMode').value, sl: clamp(Math.round(+$('wSl').value || 6), 3, 15) * 1000, qs: $('wQs').value, qp: $('wQp').value, fl: $('wFl').value, snd: $('wSnd').checked } });
      S.live = await ES.live.get(S.code).catch(() => S.live); toast('Saved ✓');
    }));
    $('wQh').addEventListener('click', () => act($('wQh'), async () => {
      const qh = !((S.live && S.live.wall) || {}).qh;
      await ES.live.set(S.code, { wall: { qh } });
      S.live = await ES.live.get(S.code).catch(() => S.live); renderScreens();
    }));
    // share & print
    $('gCopy').addEventListener('click', () => copy(guestUrl()));
    $('gShare').addEventListener('click', () => shareText(ES.caption('invite', { title: S.ev.title, names: S.ev.names, url: guestUrl() })));
    $('prPdf').addEventListener('click', () => act($('prPdf'), () => printable('pdf')));
    $('prPng').addEventListener('click', () => act($('prPng'), () => printable('png')));
    // gallery
    $('galCopy').addEventListener('click', () => copy($('galUrl').textContent));
    $('galShare').addEventListener('click', () => shareText(ES.caption('gallery', { title: S.ev.title, names: S.ev.names, url: $('galUrl').textContent })));
    $('galDays').addEventListener('change', () => act($('galDays'), () => setGalleryDays(+$('galDays').value)));
    $('galPwGen').addEventListener('click', () => { $('galPw').value = passphrase(); });
    $('galPwGo').addEventListener('click', () => act($('galPwGo'), async () => {
      const pw = $('galPw').value.trim();
      if (pw.length < 10) { $('galPwMsg').textContent = 'A password needs at least 10 characters'; return; }
      const url = await ES.gallery.link(S.code, { password: pw });
      S.galleryUrl = url; $('galUrl').textContent = url;
      $('galPwMsg').textContent = 'Share the password separately.';
    }));
    $('galRotate').addEventListener('click', () => act($('galRotate'), rotateLink));
    $('sxOn').addEventListener('change', () => act($('sxOn'), async () => { await ES.events.update(S.code, { ft: { sx: $('sxOn').checked } }); await reloadEvent(); renderGallery(); }));
    $('sxPrep').addEventListener('click', () => act($('sxPrep'), prepareFaces));
    // downloads
    $('dlZip').addEventListener('click', () => exportZip());
    $('dlVid916').addEventListener('click', () => exportVideo('9:16'));
    $('dlReelBuy').addEventListener('click', buyReel);
    $('dlReelUse').addEventListener('click', useSpareReel);
    $('dlMusic').addEventListener('change', () => { if ($('dlMusic').value === 'file') $('dlSong').click(); });
    $('dlSong').addEventListener('change', () => {
      const f = $('dlSong').files && $('dlSong').files[0];
      if (f) { R.song = f; $('dlSongName').textContent = `♪ ${f.name}`; $('dlSongName').hidden = false; $('dlMusic').value = 'file'; }
      else if (!R.song) $('dlMusic').value = S.ev && S.ev.tpl === 'birthday' ? 'birthday' : 'tune';
      $('dlSong').value = '';
    });
    $('dlVid169').addEventListener('click', () => exportVideo('16:9'));
    $('dlBook1').addEventListener('click', () => exportBook(1));
    $('dlBook4').addEventListener('click', () => exportBook(4));
    document.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => exportCsv(b.dataset.csv)));
    $('dlRemind').addEventListener('click', () => act($('dlRemind'), remindMe));
    $('dlCancel').addEventListener('click', () => { if (dlAbort) dlAbort.abort(); });
    // guests, rsvp
    $('guestMore').addEventListener('click', () => act($('guestMore'), () => renderGuests({ more: true })));
    $('rsvpCsv').addEventListener('click', () => exportCsv('rsvp'));
    $('rsvpLink').addEventListener('click', () => shareText(ES.caption('invite', { title: S.ev.title, names: S.ev.names, url: guestUrl() })));
    // settings
    $('setForm').addEventListener('submit', (e) => { e.preventDefault(); act($('sSave'), saveSettings); });
    $('sFnAdd').addEventListener('click', () => { if (SF.fns.length < capOf().fm) { SF.fns.push({ id: '', n: '', at: 0 }); renderFnEditor($('sFns'), SF.fns, capOf().fm, true); } });
    $('sMsAdd').addEventListener('click', () => { const max = capOf().mk ? 3 : 12; if (SF.ms.length < max) { SF.ms.push({ id: '', n: '' }); renderFnEditor($('sMs'), SF.ms, max, false); $('sMsAdd').disabled = SF.ms.length >= max; } });
    $('sLogoDel').addEventListener('click', () => act($('sLogoDel'), async () => { await ES.events.update(S.code, { logo: null }); await reloadEvent(); renderSettings(); }));
    $('sCloseNow').addEventListener('click', async () => {
      if (!await ask('Close check-in now', 'Close check-in now? Guests can\'t check in or send photos after this.', 'Close check-in now')) return;
      await act($('sCloseNow'), async () => { await ES.events.update(S.code, { closesAt: now() }); await reloadEvent(); renderSettings(); });
    });
    $('sReopen').addEventListener('click', () => act($('sReopen'), async () => { await ES.events.update(S.code, { closesAt: +$('sReopen').dataset.to }); await reloadEvent(); renderSettings(); }));
    $('sKeyShow').addEventListener('click', async () => {
      if (!await ask('Host key', 'Anyone with this key can take over your event. Show it?', 'Show the host key')) return;
      await act($('sKeyShow'), async () => { $('sKey').textContent = await ES.events.hostKey(S.code) || ''; $('sKey').hidden = false; });
    });
    $('sDelCode').addEventListener('input', () => { $('sDelGo').disabled = ES.events.normCode($('sDelCode').value) !== S.code; });
    $('sDelGo').addEventListener('click', deleteEvent);
    $('sLeave').addEventListener('click', async () => {
      if (!await ask('Leave this event', 'Leave this event? You\'ll need a new invite to come back.', 'Leave this event', { danger: true })) return;
      await act($('sLeave'), async () => { await ES.roles.leave(S.code); showMine(); });
    });
    window.addEventListener('es:gov', (e) => setLevel(e.detail && e.detail.level));
    window.addEventListener('luts:eventsky', (e) => passState(e.detail));
    window.addEventListener('pagehide', () => { if (D.pend.length && S.code) flush(true).catch(() => {}); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && D.pend.length && S.code) flush(true).catch(() => {}); });
  }
  // §3.0: close the open sheet, else step back inside the console, else leave it.
  function back() {
    if (closeSheet()) return true;
    try { if (window.ESShop && ESShop.ui && typeof ESShop.ui.close === 'function' && ESShop.ui.close()) return true; } catch (e) { /* no shop sheet */ }
    if (!$('toast').hidden) hideToast();
    if (S.view === 'new' && W.step > 1 && W.step < 6) { wizGo(W.step - 1); return true; }
    if (S.view === 'new' || S.view === 'event') { showMine(); return true; }
    if (window.LUTSNative) location.replace('index.html');
    else if (history.length > 1) history.back();
    else location.replace('index.html');
    return true;
  }

  async function join(code, j) {
    const m = /^([cmpw])\.([A-Za-z0-9]{22})$/.exec(j);
    if (!m) { showMine(); toast('That invite link is not complete'); return; }
    const [, role, secret] = m;
    if (role === 'p') { location.replace(`event-pro.html?e=${code}&j=${j}`); return; }
    if (role === 'w') { location.replace(`event-wall.html?e=${code}&j=${j}${S.tv ? '&tv=1' : ''}`); return; }
    setView('event'); setHeader('Joining…', code);
    try { await ES.roles.join(code, role, secret); openEvent(code); } catch (e) { showMine(); toast(errText(e), { ms: 6000 }); }
  }

  async function boot() {
    if (!window.ES || !window.EM) { $('main').textContent = T('Something went wrong. Try again.'); return; }
    const q = new URLSearchParams(location.search);
    S.app = !!window.LUTSNative;
    S.tv = q.get('tv') === '1' || document.documentElement.classList.contains('tv');
    if (q.get('tv') === '1') document.documentElement.classList.add('tv', 'es-tv');
    wire();
    window.LUTSBack = back;
    try { S.cfg = await ES.cfg(); } catch (e) { S.cfg = ES.cfg.cached(); }
    if (S.cfg && S.cfg.msg) { $('cfgMsg').textContent = S.cfg.msg; $('cfgMsg').hidden = false; }
    if (S.cfg && S.cfg.pause) setLevel(3);
    $('lnkPlay').href = ES.urls.play('event_host', 'web');
    // ?pair=: the QR on a TV waiting to be paired. Kept until the host opens an event; its Screens tab is filled in.
    const pc = String(q.get('pair') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z0-9]{10}$/.test(pc)) S.pairCode = pc;
    const code = ES.events.normCode(q.get('e') || '');
    const j = q.get('j') || '';
    if (ES.CODE_RE.test(code) && j) { join(code, j); return; }
    if (q.get('new') === '1') { openWizard(); return; }
    if (ES.CODE_RE.test(code)) { openEvent(code); return; }
    showMine();
  }

  window.EventHost = {
    state: () => ({
      view: S.view, tab: S.tab, code: S.code, role: S.role, level: S.level, step: W.step,
      deck: { visible: visible().map((x) => `${x.coll}/${x.id}`), current: current() ? `${current().coll}/${current().id}` : '', idx: D.idx, filter: D.filter,
        pending: D.pend.map((p) => `${p.coll}/${p.id}:${p.st}`), flushed: D.flushed.length, mods: D.mods.length, myIdx: D.myIdx, counts: D.counts, countsAt: D.countsAt,
        recent: D.recent.map((x) => `${x.coll}/${x.id}`), reported: D.repItems.map((x) => x.id), loaded: D.loaded, busy: !!D.busy },
      guests: { listed: G.byId.size, thumbs: [...G.thumbs.values()].filter(Boolean).length, at: G.at }, zipSaved: ZIPS.saved,
    }),
    tune: (o = {}) => { if (o.guestGap >= 0) TUNE.guestGap = +o.guestGap; return Object.assign({}, TUNE); },
    refresh: () => deckRefresh({ pending: true, done: true, reports: true, counts: true }),
    flush: () => flush(true),
    visible: () => visible().map((x) => `${x.coll}/${x.id}`),
    selectTab: (t) => selectTab(t), openEvent: (c) => openEvent(c), showMine: () => showMine(), back: () => back(),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
