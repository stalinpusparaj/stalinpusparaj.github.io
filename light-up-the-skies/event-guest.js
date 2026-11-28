/* Event Sky guest page: window.EventGuest (event-guest.js), the script of event.html.
 * Build spec: research/event-sky-spec.md §3.5 (WP-D), with the flows and copy of §4.3–§4.10, §4.24 (flash safety) and
 * §4.25 (consent and deletion).
 *
 * What a guest can do here, without ever signing in:
 *  - join from the QR (event.html?e=CODE&l=xx) or by typing the code; before the event opens, see a countdown, fill in
 *    the form and be checked in automatically at the opening time (while the page stays open);
 *  - read the notice and give the two required ticks (plus the optional selfie-search tick), then check in with a name,
 *    a selfie, the function and a wish;
 *  - watch their status ("waiting", "about N s", "on the big screen") and their photos' chips;
 *  - send extra photos and one 15 s silent video within the plan's slots, with a caption and a mission or challenge tag;
 *    the disposable camera holds photos until the reveal; offline, everything waits on the phone and sends later;
 *  - see announcements and the timed challenge, open the challenge winner and report it;
 *  - leave a guestbook message (text, and a 60 s voice note on Shaadi), RSVP per function, open and save the gallery link;
 *  - delete everything they sent ("Delete my photos and check-in"), and pick the page language (luts:es-lang, never the
 *    game's luts:lang).
 *
 * Loading (no inline scripts under the CSP): event.html loads event-config.js, then this file, then i18n.js,
 * event-sky.js, event-media.js and event-mp4.js. When this file first runs it only sets the language hooks that i18n.js
 * reads (§5.2: LUTS_I18N_KEY, LUTS_I18N_DIR, LUTS_I18N_LANG from ?l=, and 'auto' as the default choice); the page
 * itself starts on DOMContentLoaded, when ES and EM exist.
 *
 * Network: the page load makes 0 Firestore requests and never signs in. It reads the RTDB settings mirror (pub), the
 * doorbell (b, through ES.bell.watch in 'guest' mode), live state and this seat's status (st/{n}). Firestore is used only
 * for writes (check-in, uploads, guestbook, RSVP, report, erase) and for the challenge winner, read by id when tapped.
 * Nothing here logs event codes.
 *
 * Test hooks: window.EventGuest = { state() → {screen, code, seat, queued, refused, status, pending, sheet},
 *   poke() (poll the doorbell now), refresh() (reload settings, live state and status) }.
 *
 * Device storage of its own (besides ES's luts:es-seat:<code>, IndexedDB queue/mine and luts:es-rsvp:<code>):
 *   localStorage 'luts:es-guest:<code>' = {me: selfie preview (data URL), fn, book: {tx, v, at}, join: a check-in
 *   waiting for the opening time or a connection}. It is cleared by "Delete my photos and check-in" and when the event
 *   has ended.
 *
 * STRINGS:
 * Language
 * Phone language
 * Loading…
 * No connection. Trying again…
 * This page did not load properly. Reload to try again.
 * Enter the event code
 * It's the 6 letters and numbers under the QR code.
 * Join
 * We couldn't find this event. Check the code on the card.
 * Check-in opens in {0}
 * Check-in opens on {0}
 * Fill in your name now and we'll check you in when it opens. Keep this page open.
 * We'll check you in when it opens. Keep this page open.
 * Check-in has closed.
 * Ask the hosts for the gallery link.
 * This event has ended. Photos were kept until {0}.
 * Your name
 * Your selfie
 * Tap to take a selfie
 * Preparing photo…
 * Tap to retake
 * That photo did not open. Try again.
 * Which function are you at?
 * Say something nice (optional)
 * Before you share a photo
 * Light up the sky
 * Sending…
 * The event is full.
 * Check-in is busy. Trying again…
 * Could not check you in. Try again.
 * Please write your name.
 * Add a selfie first.
 * Tick both boxes to continue.
 * You're in!
 * Waiting for the hosts to check your photo
 * You'll light up the sky in about {0} s
 * You're on the big screen! Look up.
 * The hosts didn't show this photo.
 * Saved on this phone. It sends as soon as you're back online — keep this page open.
 * Photos are kept until {0}.
 * My photos
 * Waiting
 * On screen
 * Not shown
 * Developing
 * Not sent
 * Remove
 * Remove it and try again.
 * Video
 * Add photos
 * Take a photo
 * {0} photos left
 * 1 photo left
 * No photos left. Thank you for sharing!
 * Add a caption (optional)
 * For a mission?
 * No mission
 * Send
 * Cancel
 * Close
 * Add a 15-second video
 * Pick up to 15 seconds
 * Preparing video… {0}%
 * Videos play without sound.
 * This video flashes a lot, so it will play dimmed on the screen.
 * Video slots for this event are full.
 * That video did not open. Try again.
 * That video is too big
 * Videos can't be prepared on this phone.
 * Uploads have closed for this event.
 * Uploads open when the event opens
 * Disposable camera
 * {0} shots left
 * 1 shot left
 * Developing… your photos appear at {0}
 * Revealed! See all the photos
 * Photo missions
 * Take this one
 * Done ✓
 * Photo challenge: {0}
 * {0} left
 * Join the challenge
 * The challenge is over — look at the screen!
 * Winner!
 * This photo is no longer available.
 * Report this photo
 * It's me and I want it removed
 * It's rude or unkind
 * It shows a child who shouldn't be shown
 * Something else
 * Thanks — the hosts will check it.
 * Could not send. Try again.
 * Photos from the evening
 * Save the gallery link
 * Gallery link
 * Link copied
 * Leave a message for {0}
 * Write a message (up to 500 letters)
 * Record a voice message (up to 60 s)
 * Record
 * Stop
 * Play
 * Redo
 * Only the hosts can read and hear this.
 * Send message
 * Message sent ✓
 * Edit your message
 * Allow the microphone to record a voice message.
 * Voice messages don't work on this phone.
 * Nothing was recorded. Try again.
 * Messages can be changed until a day after the event
 * Voice messages are not on for this event
 * That voice message is too long
 * RSVP
 * Will you come?
 * How many people for each function?
 * Fewer people
 * More people
 * Phone (optional, for the hosts only)
 * Food preference (optional)
 * Note for the hosts (optional)
 * Send RSVP
 * Thank you! You can change this until {0}.
 * RSVP has closed
 * Check the phone number
 * Could not change your RSVP
 * Could not send your RSVP. Try again.
 * Delete my photos and check-in
 * This removes your selfie, name, wish and every photo and video you sent, from the screen and the gallery. It can't be undone.
 * Delete
 * Deleted. Thank you for coming!
 * Could not delete everything. Ask the hosts.
 * No connection. Try again.
 * Something went wrong. Try again.
 * Get it on Google Play
 */
(function () {
  'use strict';

  // ============================================================ phase 1: before i18n.js (the §5.2 language hooks) ===
  const LANG_KEY = 'luts:es-lang';
  const LANG_CODES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa'];
  const params = new URLSearchParams(location.search);
  window.LUTS_I18N_KEY = LANG_KEY;
  window.LUTS_I18N_DIR = 'i18n/event/';
  const urlLang = String(params.get('l') || '').toLowerCase();
  if (LANG_CODES.includes(urlLang)) window.LUTS_I18N_LANG = urlLang;
  // Nothing chosen yet: "Phone language" (the QR's ?l= language wins over the phone's), never the game's English default.
  try { if (!localStorage.getItem(LANG_KEY)) localStorage.setItem(LANG_KEY, 'auto'); } catch (e) { /* storage blocked */ }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else setTimeout(start, 0);

  function start() {
    try { main(); } catch (e) { fatal(); }
  }
  function fatal() {
    const box = document.getElementById('scrLoading'), msg = document.getElementById('loadMsg');
    if (box && msg) { box.hidden = false; msg.textContent = 'This page did not load properly. Reload to try again.'; }
  }

  // ===================================================================================== phase 2: the page itself ===
  function main() {
    const ES = window.ES, EM = window.EM;
    if (!ES || !ES.guest) { fatal(); return; }
    const DAY = 864e5, MIN = 6e4;
    const LEAD = 10e3; // auto-approve, before any st/{n}: a wall shows an arrival about 8 s plus half a 4.5 s slot after it lands (§3.6)
    const OVER_SHOW = 10 * MIN; // how long "The challenge is over" stays up
    const $ = (id) => document.getElementById(id);
    const LANG = (window.LUTSLang && LUTSLang.lang) || 'en';
    const T = (s) => { try { return window.LUTSLang && LUTSLang.t ? LUTSLang.t(s) : s; } catch (e) { return s; } };
    // Host-typed text (missions, function names): translated only when it is one of our presets, word for word, and kept
    // away from the dictionary's patterns ("Sorry, {0}", "Wish {0} of {1}"), which would turn half of a sentence.
    const exact = (s) => { try { const d = window.LUTS_I18N; return d && Object.prototype.hasOwnProperty.call(d, s) && d[s] ? d[s] : s; } catch (e) { return s; } };
    const hostOpt = (txt, val) => { const o = new Option(exact(txt), val); o.setAttribute('data-no-i18n', ''); return o; };
    const fill = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined ? m : String(a[+i])));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // English text into the DOM (i18n.js translates it as it lands); unchanged text is not rewritten.
    const text = (el, s) => { if (!el) return; s = s == null ? '' : String(s); if (el._en === s) return; el._en = s; el.textContent = s; };
    const hide = (el, h) => { if (el && el.hidden !== !!h) el.hidden = !!h; };
    const now = () => ES.clock.now();
    const session = () => (S.code ? ES.guest.session(S.code) : null);

    const S = {
      code: '', pub: null, live: {}, status: null, mine: [], queue: [], screen: 'loading', watch: null,
      selfie: null, selfieUrl: '', selfieGen: 0, noticeVersion: -1, pending: null, joinBusy: false, joinTries: 0, joinTimer: 0,
      sheet: null, opener: null, compose: null, composeGen: 0, rec: null, recTimer: 0, voice: null, bookEditing: false,
      annClosed: new Set(), winnerId: '', winnerUrl: '', loadTries: 0, loadTimer: 0, mineSeq: 0, mineTimer: 0, ended: false,
      sig: { mine: '', missions: '', fns: '' },
    };

    // ------------------------------------------------------------------------------------------- helpers ---
    function fmt(ms, opts) {
      const loc = `${LANG}-IN`, tz = S.pub && S.pub.tz;
      for (const o of [Object.assign({ timeZone: tz || undefined }, opts), opts]) {
        try { return new Intl.DateTimeFormat(loc, o).format(new Date(ms)); } catch (e) { /* bad zone or locale */ }
      }
      return new Date(ms).toLocaleString();
    }
    const fmtDate = (ms) => fmt(ms, { day: 'numeric', month: 'long', year: 'numeric' });
    const fmtTime = (ms) => fmt(ms, { hour: 'numeric', minute: '2-digit' });
    const fmtWhen = (ms) => fmt(ms, { weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
    const fmtSoon = (ms) => (Math.abs(ms - now()) < 20 * 36e5 ? fmtTime(ms) : fmtWhen(ms));
    function dur(ms) {
      const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      const p = (n) => String(n).padStart(2, '0');
      return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
    }
    function b64(u8) {
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function unb64(s) {
      const bin = atob(String(s || '')), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
    const jpegUrl = (u8) => URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' }));
    // Fire-and-forget handlers never throw into the page: the guest sees a short message instead.
    function oops() { toast('Something went wrong. Try again.'); }
    const safe = (fn) => function (...a) {
      try { const r = fn.apply(this, a); if (r && typeof r.catch === 'function') r.catch(oops); return r; } catch (e) { oops(); return undefined; }
    };

    // Page-local data for this event (cleared on erase and at the end).
    const LOCAL = () => `luts:es-guest:${S.code}`;
    function local() { try { const v = JSON.parse(localStorage.getItem(LOCAL()) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
    function setLocal(patch) {
      const v = Object.assign(local(), patch);
      Object.keys(v).forEach((k) => { if (v[k] == null) delete v[k]; });
      try { if (Object.keys(v).length) localStorage.setItem(LOCAL(), JSON.stringify(v)); else localStorage.removeItem(LOCAL()); } catch (e) {
        if (v.me) { delete v.me; try { localStorage.setItem(LOCAL(), JSON.stringify(v)); } catch (x) { /* full: keep going without */ } }
      }
    }
    function clearLocal() { try { localStorage.removeItem(LOCAL()); } catch (e) { /* blocked */ } }

    // ---------------------------------------------------------------------------------------------- toast ---
    let toastTimer = 0;
    function toast(s, ms = 3500) {
      const el = $('toast');
      text(el, s); el.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    }

    // -------------------------------------------------------------------------------------------- screens ---
    const SCREENS = { loading: ['scrLoading'], code: ['scrCode'], pre: ['scrPre', 'scrJoin'], join: ['scrJoin'], status: ['scrStatus'],
      closed: ['scrClosed'], ended: ['scrEnded'] };
    function show(name) {
      S.screen = name;
      const on = new Set(SCREENS[name] || []);
      ['scrLoading', 'scrCode', 'scrPre', 'scrJoin', 'scrStatus', 'scrClosed', 'scrEnded'].forEach((id) => hide($(id), !on.has(id)));
      $('main').dataset.screen = name;
    }
    function wantScreen() {
      const p = S.pub;
      if (!p) return S.screen;
      const t = now();
      if (t >= p.x) return 'ended';
      if (session()) return 'status';
      if (t >= p.c) return 'closed';
      if (t < p.o) return 'pre';
      return 'join';
    }
    function route() {
      const want = wantScreen();
      if (want !== S.screen) {
        const was = S.screen;
        show(want);
        if (was === 'pre' && want === 'join') opened();
        if (want === 'closed') cancelPending();
        if (want === 'ended') onEnded();
      }
      renderAll();
    }

    // ===================================================================================== loading an event ===
    async function openEvent(code, o = {}) {
      S.code = code;
      show('loading'); text($('loadMsg'), 'Loading…');
      let p = null;
      try { p = await ES.pub.get(code); } catch (e) {
        if (e && (e.code === 'OFFLINE' || e.code === 'QUOTA' || !e.code)) {
          text($('loadMsg'), 'No connection. Trying again…');
          clearTimeout(S.loadTimer);
          S.loadTimer = setTimeout(() => openEvent(code, o), Math.min(30e3, 3e3 * Math.pow(2, Math.min(4, S.loadTries++))));
          return;
        }
        p = null;
      }
      S.loadTries = 0;
      if (!p) { S.code = ''; show('code'); $('codeIn').value = code; codeError(); return; }
      if (!o.fromUrl) {
        const q = new URLSearchParams(location.search); q.set('e', code);
        try { history.replaceState(null, '', `${location.pathname}?${q.toString()}`); } catch (e) { /* file: URLs */ }
      }
      // No event code: the server-time probe (es/{code}/sync/{uid}) is for the event team only (§2.6). A phone that
      // already has an account in luts:fb (Sky Duel shares it) would have its probe refused with a 401, so guests
      // always take the Date header.
      await Promise.race([ES.clock.sync().catch(() => 0), sleep(2500)]);
      S.pub = p;
      applyPub();
      restoreJoin();
      route();
      startWatch();
      refreshMine();
      if (S.pending && S.screen === 'join' && navigator.onLine !== false) doCheckIn(S.pending); // saved before a reload
      if (params.get('rsvp') === '1' && rsvpOn()) openRsvp();
    }
    function codeError() {
      text($('codeErr'), "We couldn't find this event. Check the code on the card.");
      $('codeIn').setAttribute('aria-invalid', 'true');
      try { $('codeIn').focus(); } catch (e) { /* not focusable yet */ }
    }

    // The settings mirror changed (or arrived): everything that depends on it.
    function applyPub() {
      const p = S.pub;
      const h1 = $('title');
      h1.setAttribute('data-no-i18n', '');
      text(h1, p.t || '');
      if (p.t) document.title = `${p.t} · Light Up the Skies`;
      text($('names'), p.n || ''); hide($('names'), !p.n);
      const bg = $('worldBg');
      const world = ES.WORLDS.includes(p.w) ? p.w : '';
      const img = world ? `url("assets/worlds/scenes/${world}.jpg")` : '';
      if (bg._w !== img) { bg._w = img; bg.style.backgroundImage = img; }
      const logo = $('logo');
      if (typeof p.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.logo)) { if (logo.src !== p.logo) logo.src = p.logo; hide(logo, false); } else hide(logo, true);
      const T0 = ES.TEMPLATES[p.tp] || ES.TEMPLATES.party;
      text($('wishLabel'), T0.wishLabel);
      renderFns();
      renderNotice();
      if (S.watch) S.watch.setOpensAt(p.o);
      const play = $('playLink');
      play.href = ES.urls.play('event_guest', 'web');
    }
    async function refreshPub() {
      let p;
      try { p = await ES.pub.get(S.code); } catch (e) { return; }
      if (!p) { gone(); return; }
      S.pub = p; applyPub(); route();
    }
    // The event was deleted while the page was open.
    function gone() {
      if (S.watch) { S.watch.stop(); S.watch = null; }
      closeSheet();
      const code = S.code;
      S.pub = null; S.code = '';
      show('code'); $('codeIn').value = code; codeError();
    }
    async function refreshLive() {
      let l;
      try { l = await ES.live.get(S.code); } catch (e) { return; }
      const wasRev = revealed(now());
      S.live = l && typeof l === 'object' ? l : {};
      if (!wasRev && revealed(now())) refreshMine();
      renderAll();
    }
    async function refreshStatus() {
      if (!session()) return;
      try { S.status = await ES.guest.status(S.code); } catch (e) { /* keep the last one */ }
      renderAll();
      refreshMine();
    }
    // My photos: sent ones (IndexedDB 'mine' + this seat's st/{n}) and the queue. Calls in flight are coalesced.
    function refreshMineSoon() { clearTimeout(S.mineTimer); S.mineTimer = setTimeout(refreshMine, 250); }
    async function refreshMine() {
      const seq = ++S.mineSeq, code = S.code;
      if (!code) return;
      let mine = [], queue = [];
      try { [mine, queue] = await Promise.all([ES.guest.mine(code), ES.guest.queue(code)]); } catch (e) { return; }
      if (seq !== S.mineSeq || code !== S.code) return;
      S.mine = mine; S.queue = queue;
      renderAll();
    }
    function startWatch() {
      if (S.watch) S.watch.stop();
      S.watch = null;
      if (S.screen === 'ended') return; // nothing changes any more: no polling
      S.watch = ES.bell.watch(S.code, {
        mode: 'guest', opensAt: S.pub.o,
        onChange: (changed, b, info) => {
          if (info && info.first) { refreshLive(); refreshStatus(); return; }
          if (changed.includes('s')) refreshPub();
          if (changed.includes('l')) refreshLive();
          if (session() && changed.some((k) => 'gpwe'.includes(k))) refreshStatus();
        },
        onError: () => { renderAll(); },
      });
    }

    // ====================================================================================== header, notice ===
    function currentFn() {
      const fns = (S.pub && S.pub.fns) || [];
      if (!fns.length) return '';
      const t = now(), timed = fns.filter((f) => +f.at > 0).sort((a, b) => a.at - b.at);
      let cur = null;
      for (const f of timed) if (f.at <= t + 30 * MIN) cur = f;
      if (cur) return cur.id;
      const mine = local().fn;
      return fns.some((f) => f.id === mine) ? mine : fns[0].id;
    }
    function renderFns() {
      const fns = S.pub.fns || [], sel = $('fnIn');
      const sig = JSON.stringify(fns);
      if (S.sig.fns !== sig) {
        S.sig.fns = sig;
        const keep = sel.value;
        sel.textContent = '';
        fns.forEach((f) => sel.add(hostOpt(f.n, f.id)));
        sel.value = fns.some((f) => f.id === keep) ? keep : currentFn();
      }
      hide($('fnRow'), fns.length < 2);
    }
    function renderNotice() {
      if (session()) return;
      let n;
      try { n = ES.notice(S.pub, { lang: LANG }); } catch (e) { return; }
      if (n.version === S.noticeVersion) return;
      const was = S.noticeVersion;
      S.noticeVersion = n.version;
      const list = $('noticeList');
      list.textContent = '';
      text($('noticeHead'), n.lines[0]);
      n.lines.forEach((line, i) => {
        if (i === 0) return;
        const li = document.createElement('li');
        if ((n.noI18n || []).includes(i)) { li.setAttribute('data-no-i18n', ''); li.className = 'note'; }
        li.textContent = line;
        list.appendChild(li);
      });
      // The ticks are consent to this exact notice: a changed notice needs them again.
      const box = $('ticks');
      box.textContent = '';
      (n.ticks || []).forEach((t) => {
        const lab = document.createElement('label');
        lab.className = 'es-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.id = `tick-${t.id}`; cb.dataset.tick = t.id;
        if (t.required) { cb.required = true; cb.dataset.required = '1'; }
        const sp = document.createElement('span');
        sp.textContent = t.text;
        lab.append(cb, sp);
        box.appendChild(lab);
      });
      if (was !== -1 && S.pending) { S.pending = null; setLocal({ join: null }); text($('joinMsg'), ''); }
      updateJoin();
    }

    // ============================================================================================ check-in ===
    function formData() {
      const ticks = {};
      document.querySelectorAll('#ticks input[type=checkbox]').forEach((cb) => { ticks[cb.dataset.tick] = cb.checked; });
      return {
        name: ES.clean($('nameIn').value, 24), wish: ES.clean($('wishIn').value, 80), selfie: S.selfie,
        fn: (S.pub.fns || []).length > 1 ? $('fnIn').value : currentFn(), faceOk: !!ticks.face, cv: S.noticeVersion,
        ticksOk: [...document.querySelectorAll('#ticks input[data-required]')].every((cb) => cb.checked),
      };
    }
    const formComplete = (d) => !!(d.name && d.selfie && d.selfie.length >= 600 && d.ticksOk);
    function updateJoin() {
      if (!S.pub) return;
      const d = formData();
      const btn = $('joinBtn');
      btn.disabled = !formComplete(d) || S.joinBusy || (S.screen === 'pre' && !!S.pending);
      text(btn, S.joinBusy ? 'Sending…' : 'Light up the sky');
    }
    function setSelfie(bytes) {
      if (S.selfieUrl) URL.revokeObjectURL(S.selfieUrl);
      S.selfie = bytes || null;
      S.selfieUrl = bytes ? jpegUrl(bytes) : '';
      const img = $('selfieImg');
      if (S.selfieUrl) { img.src = S.selfieUrl; hide(img, false); } else { img.removeAttribute('src'); hide(img, true); }
    }
    async function onSelfie(file) {
      if (!file) return;
      const gen = ++S.selfieGen;
      cancelPending();
      setSelfie(null);
      text($('selfieText'), 'Preparing photo…');
      updateJoin();
      try {
        if (!EM || !EM.image) throw new Error('no EM');
        const r = await EM.image.prepare(file, { kind: 'selfie' });
        if (gen !== S.selfieGen) return;
        if (!r || !r.display || r.display.length < 600 || r.display.length > 61440) throw new Error('size');
        setSelfie(r.display);
        text($('selfieText'), 'Tap to retake');
      } catch (e) {
        if (gen !== S.selfieGen) return;
        setSelfie(null);
        text($('selfieText'), 'That photo did not open. Try again.');
      }
      updateJoin();
    }
    // A check-in waiting for the opening time (or for a connection) survives a reload of the page.
    function setPending(d) {
      S.pending = d;
      setLocal({ join: { name: d.name, wish: d.wish, fn: d.fn, faceOk: d.faceOk, cv: d.cv, selfie: b64(d.selfie), at: Date.now() } });
    }
    function cancelPending() {
      if (!S.pending) return;
      S.pending = null; setLocal({ join: null });
      clearTimeout(S.joinTimer);
      text($('joinMsg'), '');
    }
    function restoreJoin() {
      const j = local().join;
      if (!j || session()) return;
      try {
        $('nameIn').value = j.name || ''; $('wishIn').value = j.wish || '';
        if (j.fn && [...$('fnIn').options].some((o) => o.value === j.fn)) $('fnIn').value = j.fn;
        const bytes = unb64(j.selfie);
        if (bytes.length >= 600) { setSelfie(bytes); text($('selfieText'), 'Tap to retake'); }
        if (j.cv === S.noticeVersion && bytes.length >= 600) {
          document.querySelectorAll('#ticks input[data-required]').forEach((cb) => { cb.checked = true; });
          const face = $('tick-face'); if (face) face.checked = !!j.faceOk;
          S.pending = Object.assign(formData(), { faceOk: !!j.faceOk });
          text($('joinMsg'), "We'll check you in when it opens. Keep this page open.");
        } else setLocal({ join: null });
      } catch (e) { setLocal({ join: null }); }
      updateJoin();
    }
    // Opening time reached with the page open: check in whoever is ready.
    function opened() {
      const d = S.pending || formData();
      if (formComplete(d)) doCheckIn(d);
    }
    async function submitJoin() {
      const d = formData();
      if (!d.name) { text($('joinMsg'), 'Please write your name.'); $('nameIn').focus(); return; }
      if (!d.selfie) { text($('joinMsg'), 'Add a selfie first.'); return; }
      if (!d.ticksOk) { text($('joinMsg'), 'Tick both boxes to continue.'); return; }
      if (now() < S.pub.o) {
        setPending(d);
        text($('joinMsg'), "We'll check you in when it opens. Keep this page open.");
        updateJoin();
        return;
      }
      await doCheckIn(d);
    }
    async function doCheckIn(d) {
      if (S.joinBusy || session()) return;
      S.joinBusy = true; clearTimeout(S.joinTimer); S.joinTimer = 0;
      text($('joinMsg'), 'Sending…');
      updateJoin();
      let again = 0;
      try {
        await ES.guest.checkIn(S.code, { name: d.name, wish: d.wish, selfie: d.selfie, fn: d.fn, lang: LANG, cv: d.cv, adult: true, faceOk: !!d.faceOk });
        S.pending = null; S.joinTries = 0;
        setLocal({ join: null, me: `data:image/jpeg;base64,${b64(d.selfie)}`, fn: d.fn || null });
        if (S.pub.gk) ES.guest.saveKey(S.code, S.pub.gk);
        text($('joinMsg'), '');
        S.status = null;
        if (S.watch) S.watch.busy();
        route();
        refreshStatus();
      } catch (e) {
        const code = e && e.code;
        if (code === 'NOT_OPEN') {
          setPending(d);
          text($('joinMsg'), "We'll check you in when it opens. Keep this page open.");
          if (now() >= S.pub.o && S.joinTries++ < 10) again = 3000; // this phone's clock is ahead of the server's
          else if (now() >= S.pub.o) { S.joinTries = 0; S.pending = null; setLocal({ join: null }); text($('joinMsg'), 'Could not check you in. Try again.'); }
          route();
        } else if (code === 'CLOSED') {
          S.pending = null; setLocal({ join: null }); text($('joinMsg'), '');
          route();
        } else if (code === 'FULL') {
          S.pending = null; setLocal({ join: null }); S.joinTries = 0;
          text($('joinMsg'), 'The event is full.');
        } else if (code === 'BUSY') {
          text($('joinMsg'), 'Check-in is busy. Trying again…');
          if (S.joinTries++ < 8) again = Math.min(30e3, 2e3 * Math.pow(2, S.joinTries - 1)) * (0.8 + Math.random() * 0.4);
          else { S.joinTries = 0; S.pending = null; setLocal({ join: null }); text($('joinMsg'), 'Could not check you in. Try again.'); }
        } else if (code === 'OFFLINE' || code === 'QUOTA') {
          setPending(d);
          text($('joinMsg'), 'Saved on this phone. It sends as soon as you\'re back online — keep this page open.');
          again = code === 'QUOTA' ? 60e3 : 15e3;
        } else if (code === 'NOT_FOUND') {
          gone();
        } else {
          // A refusal the guest can only fix by hand: no automatic retry.
          S.pending = null; setLocal({ join: null }); S.joinTries = 0;
          const known = ['That photo did not open. Try again.'];
          text($('joinMsg'), known.includes(e && e.message) ? e.message : 'Could not check you in. Try again.');
        }
      } finally {
        S.joinBusy = false;
        updateJoin();
      }
      if (again) S.joinTimer = setTimeout(() => { S.joinTimer = 0; if (S.pending) doCheckIn(S.pending); }, again);
    }

    // ====================================================================================== status, photos ===
    function revealAt() {
      const p = S.pub, dp = (p && p.dp) || {};
      if (!dp.on || !(dp.at > 0)) return 0;
      const rev = S.live && S.live.rev && +S.live.rev.at;
      return rev > 0 ? Math.min(dp.at, rev) : dp.at;
    }
    const revealed = (t) => { const r = revealAt(); return !r || t >= r; };
    const dispActive = (t) => !!(S.pub && S.pub.dp && S.pub.dp.on && revealAt() && !revealed(t));
    const isOpen = (t) => !!S.pub && t >= S.pub.o && t < S.pub.c;
    function shots(left) {
      const s = session(), p = S.pub;
      const pg = (s && s.pg) || p.cap.pg || 0, sh = p.dp.sh > 0 ? p.dp.sh : pg;
      return Math.min(left.photos, Math.max(0, sh - (pg - left.photos)));
    }
    function canSendPhoto(t) {
      if (!session() || !isOpen(t)) return false;
      const left = ES.guest.slotsLeft(S.code);
      return (dispActive(t) ? shots(left) : left.photos) > 0;
    }
    function galleryKey() { const s = session(); return (s && s.k) || (S.pub && S.pub.gk) || ''; }
    const galleryHref = (k) => `event-gallery.html?e=${encodeURIComponent(S.code)}#k=${k}`;

    function renderStatus(t) {
      const s = session(), p = S.pub;
      if (!s) return;
      const loc = local();
      const me = $('meImg');
      if (loc.me && /^data:image\/jpeg;base64,/.test(loc.me)) { if (me.src !== loc.me) me.src = loc.me; hide(me, false); } else hide(me, true);
      const st = S.status, sel = st ? st.selfie : -1;
      let line, kind;
      if (sel === 2) { line = "The hosts didn't show this photo."; kind = 'hidden'; }
      else if (sel === 3) { line = ''; kind = 'erased'; }
      else if (sel === 1 || (sel === -1 && !p.ap)) {
        // st/{n}.t is when the newest item shows on the big screen (ES.media.decide's estimate, then the wall packer's slot).
        const due = sel === 1 && st.shownAt ? st.shownAt : (s.at || t) + LEAD;
        const eta = Math.ceil((due - t) / 1000);
        if (eta > 0) { line = fill("You'll light up the sky in about {0} s", eta); kind = 'soon'; } else { line = "You're on the big screen! Look up."; kind = 'shown'; }
      } else { line = 'Waiting for the hosts to check your photo'; kind = 'waiting'; }
      text($('meState'), line);
      if (S.stateKind !== kind) { S.stateKind = kind; text($('srLive'), line); }
      text($('keepLine'), fill('Photos are kept until {0}.', fmtDate(p.x)));
      const unsent = S.queue.filter((q) => !q.refused);
      const offline = unsent.length > 0 && (navigator.onLine === false || unsent.some((q) => q.tries > 0));
      hide($('offlineLine'), !offline);
    }
    const WHY = { CLOSED: 'Uploads have closed for this event.', FULL: 'Video slots for this event are full.', NOT_OPEN: 'Uploads open when the event opens',
      NOT_FOUND: "We couldn't find this event. Check the code on the card." };
    function chipFor(it, t) {
      if (it.queued) return it.refused ? ['Not sent', 'bad'] : ['Sending…', 'wait'];
      if (it.dev && !revealed(t)) return ['Developing', 'dev'];
      if (it.st === 1) return ['On screen', 'ok'];
      if (it.st === 2) return ['Not shown', 'off'];
      return ['Waiting', 'wait'];
    }
    function renderMine(t) {
      const items = (S.mine || []).filter((x) => x.st !== 3);
      hide($('mineBox'), !items.length);
      const sig = JSON.stringify(items.map((x) => [x.id || x.key, x.thumbUrl, chipFor(x, t), x.refused || '']));
      if (sig === S.sig.mine) return;
      S.sig.mine = sig;
      const list = $('mineList');
      list.textContent = '';
      for (const it of items) {
        const [label, cls] = chipFor(it, t);
        const li = document.createElement('li');
        if (cls === 'dev') li.className = 'dev';
        const th = document.createElement('div');
        th.className = 'thumb';
        if (it.thumbUrl) { const img = document.createElement('img'); img.alt = ''; img.src = it.thumbUrl; img.decoding = 'async'; th.appendChild(img); }
        if (it.kind === 'v') { const b = document.createElement('span'); b.className = 'play'; b.setAttribute('aria-label', 'Video'); b.textContent = '▶'; th.appendChild(b); }
        const chip = document.createElement('span');
        chip.className = `chip ${cls}`; chip.textContent = label;
        li.append(th, chip);
        if (it.queued && it.refused) {
          const why = document.createElement('span');
          why.className = 'why';
          why.textContent = WHY[it.refused] || 'Remove it and try again.';
          const rm = document.createElement('button');
          rm.type = 'button'; rm.className = 'es-btn link'; rm.textContent = 'Remove'; rm.dataset.key = it.key;
          li.append(why, rm);
        }
        list.appendChild(li);
      }
    }
    function renderSend(t) {
      const s = session(), p = S.pub;
      if (!s) return;
      const open = isOpen(t), left = ES.guest.slotsLeft(S.code), disp = dispActive(t);
      hide($('closedLine'), open);
      hide($('dispBox'), !(open && disp));
      let photosLine = '';
      if (open && disp) {
        const n = shots(left);
        text($('shotsLeft'), n === 1 ? '1 shot left' : fill('{0} shots left', n));
        text($('devLine'), fill('Developing… your photos appear at {0}', fmtSoon(revealAt())));
        if (!n) photosLine = 'No photos left. Thank you for sharing!';
        hide($('takeShot'), !(n > 0)); hide($('addPhotos'), true);
      } else {
        hide($('takeShot'), true);
        if (open) photosLine = left.photos === 0 ? 'No photos left. Thank you for sharing!' : left.photos === 1 ? '1 photo left' : fill('{0} photos left', left.photos);
        hide($('addPhotos'), !(open && left.photos > 0));
      }
      text($('photosLeft'), photosLine); hide($('photosLeft'), !photosLine);
      hide($('addVideo'), !(open && !disp && p.cap.vg > 0 && left.videos > 0 && EM && EM.video));
      const k = galleryKey();
      const showReveal = !!(p.dp && p.dp.on && revealAt() && revealed(t) && k);
      hide($('revealLine'), !showReveal);
      if (showReveal) $('revealLink').href = galleryHref(k);
    }
    function renderMissions(t) {
      const ms = (S.pub.ms || []).filter((m) => m && m.id && m.t);
      const s = session();
      hide($('missionBox'), !(s && ms.length));
      if (!s || !ms.length) return;
      const done = new Set(S.mine.map((m) => m.m).concat(S.queue.map((q) => q.meta && q.meta.m)).filter(Boolean));
      const can = canSendPhoto(t);
      const sig = JSON.stringify([ms, [...done].sort(), can]);
      if (sig === S.sig.missions) return;
      S.sig.missions = sig;
      const list = $('missionList');
      list.textContent = '';
      for (const m of ms) {
        const li = document.createElement('li');
        const sp = document.createElement('span');
        sp.className = 't'; sp.textContent = exact(m.t); sp.setAttribute('data-no-i18n', '');
        li.appendChild(sp);
        if (done.has(m.id)) {
          const d = document.createElement('span'); d.className = 'done'; d.textContent = 'Done ✓'; li.appendChild(d);
        } else if (can) {
          const lab = document.createElement('label');
          lab.className = 'es-btn small ghost';
          const inp = document.createElement('input');
          inp.type = 'file'; inp.className = 'es-file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.dataset.m = m.id;
          lab.append(inp, document.createTextNode('Take this one'));
          li.appendChild(lab);
        }
        list.appendChild(li);
      }
    }
    function renderGallery() {
      const s = session(), k = galleryKey();
      hide($('galleryBox'), !(s && k));
      if (s && k) {
        $('galleryLink').href = galleryHref(k);
        if (!s.k && S.pub.gk) ES.guest.saveKey(S.code, S.pub.gk);
      }
    }

    // ============================================================================================= banners ===
    function renderBanners(t) {
      const p = S.pub, live = S.live || {};
      const anns = [];
      if (live.ann && live.ann.t) anns.push(live.ann);
      (p.an || []).forEach((a) => { if (a && a.t) anns.push(a); });
      const key = (a) => `${a.id || ''}:${a.at}`;
      const vis = anns.filter((a) => +a.at <= t && t <= +a.at + (+a.cd || 0) * 1000 + 60e3 && !S.annClosed.has(key(a))).sort((a, b) => b.at - a.at);
      const a = vis[0];
      hide($('annBanner'), !a);
      if (a) {
        text($('annText'), a.t);
        const end = +a.at + (+a.cd || 0) * 1000;
        text($('annLeft'), a.cd > 0 && t < end ? fill('{0} left', dur(end - t)) : '');
        $('annBanner').dataset.key = key(a);
      }
      const ch = live.ch;
      const running = !!(ch && ch.t && +ch.end > t);
      hide($('chBanner'), !running);
      if (running) {
        text($('chText'), fill('Photo challenge: {0}', ch.t));
        text($('chLeft'), fill('{0} left', dur(+ch.end - t)));
        hide($('chJoin'), !canSendPhoto(t));
      }
      const over = !!(ch && ch.t && +ch.end <= t && t < +ch.end + OVER_SHOW);
      hide($('chOver'), !over);
      hide($('chWinner'), !(over && ch.win && /^[A-Za-z0-9-]{3,40}$/.test(String(ch.win))));
    }

    // ============================================================================================= guestbook ===
    function renderBook(t) {
      const s = session(), p = S.pub;
      const on = !!(s && p.ft && p.ft.gb && t >= p.o && t < p.c + DAY);
      hide($('bookBox'), !on);
      if (!on) return;
      text($('bookHead'), fill('Leave a message for {0}', p.n || p.t || ''));
      const voiceOn = !!(p.cap.vo && p.ft.vo && EM && EM.voice && EM.voice.supported());
      hide($('voiceBox'), !voiceOn);
      const b = local().book;
      const sent = !!(b && b.at) && !S.bookEditing; // what this phone sent (the seat session does not expose it)
      hide($('bookSent'), !sent); hide($('bookForm'), sent);
      if (sent) text($('bookSentText'), b.tx || '');
      updateBookSend();
    }
    function updateBookSend() {
      const has = !!ES.clean($('bookText').value, 500) || !!(S.voice && S.voice.bytes) || !!(S.bookEditing && local().book);
      $('bookSend').disabled = !has || !!S.rec || !!S.bookBusy;
    }
    async function sendBook() {
      const s = session();
      if (!s || S.bookBusy) return;
      const o = { name: s.name, text: $('bookText').value };
      const v = S.voice;
      if (v && v.bytes) { o.voice = v.bytes; o.mime = v.mime; o.du = v.du; }
      S.bookBusy = true; updateBookSend();
      text($('bookMsg'), 'Sending…');
      try {
        await ES.guest.book(S.code, o);
        const prev = local().book || {};
        setLocal({ book: { tx: ES.clean(o.text, 500), v: !!(v && v.bytes) || !!prev.v, at: Date.now() } });
        S.bookEditing = false;
        resetVoice();
        text($('bookMsg'), '');
        text($('bookSentMsg'), 'Message sent ✓');
      } catch (e) {
        const c = e && e.code, msgs = ['Messages can be changed until a day after the event', 'Voice messages are not on for this event', 'That voice message is too long'];
        text($('bookMsg'), c === 'OFFLINE' || c === 'QUOTA' ? 'No connection. Try again.' : msgs.includes(e && e.message) ? e.message : 'Could not send. Try again.');
      } finally { S.bookBusy = false; renderAll(); }
    }
    function resetVoice() {
      if (S.rec) { try { S.rec.cancel(); } catch (e) { /* ended */ } S.rec = null; }
      clearInterval(S.recTimer);
      if (S.voice && S.voice.url) URL.revokeObjectURL(S.voice.url);
      S.voice = null;
      const a = $('voicePlay'); try { a.pause(); } catch (e) { /* not playing */ } a.removeAttribute('src');
      hide($('recBtn'), false); $('recBtn').disabled = false;
      hide($('stopBtn'), true); hide($('playBtn'), true); hide($('redoBtn'), true); hide($('recMeter'), true);
      text($('recTime'), ''); text($('voiceErr'), '');
    }
    async function startRec() {
      if (S.rec || !EM || !EM.voice) return;
      text($('voiceErr'), '');
      $('recBtn').disabled = true;
      let rec;
      try {
        rec = await EM.voice.record({ maxMs: 60000, onLevel: (l) => { const bar = $('recMeter').firstElementChild; if (bar) bar.style.width = `${Math.round(Math.min(1, l) * 100)}%`; } });
      } catch (e) {
        $('recBtn').disabled = false;
        text($('voiceErr'), e && e.code === 'NO_MIC' ? 'Allow the microphone to record a voice message.' : "Voice messages don't work on this phone.");
        return;
      }
      S.rec = rec;
      hide($('recBtn'), true); hide($('stopBtn'), false); hide($('recMeter'), false); hide($('playBtn'), true); hide($('redoBtn'), true);
      const tickRec = () => text($('recTime'), `${dur(rec.elapsed())} / 1:00`);
      tickRec(); S.recTimer = setInterval(tickRec, 250);
      updateBookSend();
      rec.done.then((r) => {
        if (S.rec !== rec) return;
        S.rec = null; clearInterval(S.recTimer);
        S.voice = { bytes: r.bytes, mime: r.mime, du: r.du, url: URL.createObjectURL(new Blob([r.bytes], { type: r.mime })) };
        hide($('stopBtn'), true); hide($('recMeter'), true); hide($('playBtn'), false); hide($('redoBtn'), false);
        text($('recTime'), dur(r.du));
        updateBookSend();
      }, (e) => {
        if (S.rec !== rec) return;
        S.rec = null; clearInterval(S.recTimer);
        hide($('stopBtn'), true); hide($('recMeter'), true); hide($('recBtn'), false); $('recBtn').disabled = false;
        text($('recTime'), '');
        if (!(e && e.code === 'CANCELLED')) text($('voiceErr'), 'Nothing was recorded. Try again.');
        updateBookSend();
      });
    }

    // ================================================================================================= RSVP ===
    const rsvpOn = () => !!(S.pub && S.pub.cap.rs && S.pub.ft.rs && now() < S.pub.c);
    function renderRsvp() {
      const on = rsvpOn() && ['pre', 'join', 'status'].includes(S.screen);
      hide($('rsvpBox'), !on);
      if (!on) return;
      const mine = ES.rsvp.mine(S.code);
      hide($('rsvpDone'), !mine);
      if (mine) text($('rsvpDone'), fill('Thank you! You can change this until {0}.', fmtDate(S.pub.c)));
    }
    function openRsvp() {
      if (!rsvpOn()) return;
      const p = S.pub, mine = ES.rsvp.mine(S.code) || {}, s = session();
      const list = $('rsvpFns');
      list.textContent = '';
      (p.fns || []).forEach((f) => {
        const li = document.createElement('li');
        const t = document.createElement('span');
        t.className = 't'; t.id = `rf-${f.id}`; t.textContent = f.n;
        if (+f.at > 0) { const w = document.createElement('span'); w.className = 'when'; w.textContent = fmtWhen(f.at); t.appendChild(w); }
        const st = document.createElement('span');
        st.className = 'es-stepper';
        const minus = document.createElement('button'), plus = document.createElement('button'), out = document.createElement('output');
        minus.type = plus.type = 'button';
        minus.textContent = '−'; plus.textContent = '+';
        minus.setAttribute('aria-label', 'Fewer people'); plus.setAttribute('aria-label', 'More people');
        minus.setAttribute('aria-describedby', t.id); plus.setAttribute('aria-describedby', t.id);
        minus.dataset.step = '-1'; plus.dataset.step = '1';
        out.dataset.fn = f.id; out.setAttribute('aria-live', 'polite'); out.setAttribute('aria-labelledby', t.id);
        const v = Math.max(0, Math.min(20, Math.round(+((mine.fns || {})[f.id]) || 0)));
        out.value = String(v); out.textContent = String(v);
        minus.disabled = v <= 0; plus.disabled = v >= 20;
        st.append(minus, out, plus);
        li.append(t, st);
        list.appendChild(li);
      });
      hide($('rsvpFnBox'), !(p.fns || []).length);
      $('rsvpName').value = mine.name || (s && s.name) || ES.clean($('nameIn').value, 40) || '';
      $('rsvpPhone').value = mine.phone || '';
      $('rsvpDiet').value = mine.diet || '';
      $('rsvpNote').value = mine.note || '';
      $('rsvpMsg').className = 'msg'; text($('rsvpMsg'), '');
      openSheet('sheetRsvp');
    }
    async function sendRsvp() {
      const name = ES.clean($('rsvpName').value, 40);
      const msg = $('rsvpMsg');
      msg.className = 'msg';
      if (!name) { text(msg, 'Please write your name.'); $('rsvpName').focus(); return; }
      const fns = {};
      document.querySelectorAll('#rsvpFns output[data-fn]').forEach((o) => { fns[o.dataset.fn] = Math.max(0, Math.min(20, +o.value || 0)); });
      const btn = $('rsvpSend');
      btn.disabled = true; text(msg, 'Sending…');
      try {
        await ES.rsvp.save(S.code, { name, phone: $('rsvpPhone').value, fns, diet: $('rsvpDiet').value, note: $('rsvpNote').value });
        msg.className = 'msg ok';
        text(msg, fill('Thank you! You can change this until {0}.', fmtDate(S.pub.c)));
        renderRsvp();
      } catch (e) {
        msg.className = 'msg err';
        const c = e && e.code, known = ['Check the phone number', 'Could not change your RSVP', 'Could not send your RSVP. Try again.'];
        text(msg, c === 'CLOSED' ? 'RSVP has closed' : c === 'OFFLINE' || c === 'QUOTA' ? 'No connection. Try again.'
          : known.includes(e && e.message) ? e.message : 'Could not send your RSVP. Try again.');
      } finally { btn.disabled = false; }
    }

    // ========================================================================================= compose sheet ===
    function fillMissions(sel, m) {
      const p = S.pub, ch = S.live && S.live.ch, t = now();
      sel.textContent = '';
      sel.add(new Option('No mission', ''));
      (p.ms || []).forEach((x) => { if (x && x.id && x.t) sel.add(hostOpt(x.t, x.id)); });
      if (ch && ch.id && ch.t && +ch.end > t) sel.add(new Option(fill('Photo challenge: {0}', ch.t), ch.id));
      sel.value = [...sel.options].some((o) => o.value === m) ? m : '';
      hide($('missionPick'), sel.options.length < 2);
    }
    function endCompose() {
      const c = S.compose;
      if (!c) return;
      S.compose = null;
      if (c.ac) { try { c.ac.abort(); } catch (e) { /* done */ } }
      (c.items || []).forEach((it) => { if (it.url) URL.revokeObjectURL(it.url); });
      if (c.url) URL.revokeObjectURL(c.url);
      const v = $('videoPrev'); try { v.pause(); } catch (e) { /* idle */ } v.removeAttribute('src'); try { v.load(); } catch (e) { /* idle */ }
      $('composeItems').textContent = '';
    }
    function openPhotos(files, m) {
      const t = now();
      if (!canSendPhoto(t)) { toast(isOpen(t) ? 'No photos left. Thank you for sharing!' : 'Uploads have closed for this event.'); return; }
      const left = ES.guest.slotsLeft(S.code), disp = dispActive(t);
      const max = disp ? shots(left) : left.photos;
      const list = [...files].slice(0, max);
      if (!list.length) return;
      closeSheet();
      const c = S.compose = { kind: 'p', gen: ++S.composeGen, items: list.map((file) => ({ file, st: 'prep' })) };
      text($('composeHead'), disp ? 'Take a photo' : 'Add photos');
      const n = disp ? max : left.photos;
      text($('composeLeft'), n === 1 ? (disp ? '1 shot left' : '1 photo left') : fill(disp ? '{0} shots left' : '{0} photos left', n));
      hide($('composeLeft'), false);
      hide($('videoBox'), true);
      const box = $('composeItems');
      box.textContent = '';
      c.items.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'es-item';
        const img = document.createElement('img');
        img.className = 'pv'; img.alt = '';
        const right = document.createElement('div');
        const st = document.createElement('p');
        st.className = 'st'; st.textContent = 'Preparing photo…';
        const lab = document.createElement('label');
        lab.className = 'sr'; lab.htmlFor = `cap-${i}`; lab.textContent = 'Add a caption (optional)';
        const cap = document.createElement('input');
        cap.type = 'text'; cap.id = `cap-${i}`; cap.maxLength = 80; cap.placeholder = 'Add a caption (optional)';
        right.append(st, lab, cap);
        row.append(img, right);
        box.appendChild(row);
        Object.assign(it, { row, img, stEl: st, capEl: cap });
      });
      fillMissions($('composeM'), m);
      text($('composeMsg'), '');
      $('composeSend').disabled = true;
      openSheet('sheetCompose');
      prepPhotos(c);
    }
    async function prepPhotos(c) {
      for (const it of c.items) {
        if (S.compose !== c) return;
        try {
          if (!EM || !EM.image) throw new Error('no EM');
          const r = await EM.image.prepare(it.file, { kind: 'photo' });
          if (S.compose !== c) return;
          if (!r || !r.display || r.display.length < 1000 || r.display.length > 122880 || !r.thumb || r.thumb.length < 200) throw new Error('size');
          it.prep = r; it.st = 'ok';
          it.url = jpegUrl(r.display); it.img.src = it.url;
          it.stEl.textContent = '';
        } catch (e) {
          if (S.compose !== c) return;
          it.st = 'err';
          it.stEl.className = 'st err'; it.stEl.textContent = 'That photo did not open. Try again.';
        }
        $('composeSend').disabled = !c.items.some((x) => x.st === 'ok') || c.items.some((x) => x.st === 'prep');
      }
    }
    async function openVideo(file, m) {
      const t = now();
      if (!session() || !isOpen(t) || !ES.guest.slotsLeft(S.code).videos) { toast(isOpen(t) ? 'Video slots for this event are full.' : 'Uploads have closed for this event.'); return; }
      closeSheet();
      const c = S.compose = { kind: 'v', gen: ++S.composeGen, file, url: URL.createObjectURL(file), dur: 0, prep: null, prepP: null, prepStart: -1, ac: null };
      text($('composeHead'), 'Add a 15-second video');
      hide($('composeLeft'), true);
      $('composeItems').textContent = '';
      hide($('videoBox'), false); hide($('trimBox'), true); hide($('videoProg'), true);
      $('videoCap').value = '';
      const v = $('videoPrev');
      v.muted = true; v.controls = true; v.src = c.url;
      fillMissions($('composeM'), m);
      text($('composeMsg'), '');
      $('composeSend').disabled = true;
      openSheet('sheetCompose');
      try {
        if (!EM || !EM.video) throw Object.assign(new Error('no EM'), { code: 'UNSUPPORTED' });
        const info = await EM.video.probe(file);
        if (S.compose !== c) return;
        c.dur = Math.round(info.duration * 1000);
      } catch (e) {
        if (S.compose !== c) return;
        text($('composeMsg'), e && e.code === 'UNSUPPORTED' ? "Videos can't be prepared on this phone." : 'That video did not open. Try again.');
        return;
      }
      if (c.dur > 15200) {
        const r = $('trimIn');
        r.min = '0'; r.max = String(Math.max(0, (c.dur - 15000) / 1000).toFixed(1)); r.value = '0';
        trimLabel();
        hide($('trimBox'), false);
      } else prepVideo(0).catch(() => { /* shown in the sheet */ });
      $('composeSend').disabled = false;
    }
    function trimLabel() {
      const c = S.compose; if (!c) return;
      const a = +$('trimIn').value * 1000, b = Math.min(c.dur, a + 15000);
      text($('trimOut'), `${dur(a)} – ${dur(b)}`);
    }
    function progress(pc) {
      hide($('videoProg'), false);
      text($('videoProgText'), fill('Preparing video… {0}%', Math.max(0, Math.min(100, Math.round(pc)))));
      $('videoProgBar').style.width = `${Math.max(0, Math.min(100, pc))}%`;
    }
    function prepVideo(startMs) {
      const c = S.compose;
      if (!c || c.kind !== 'v') return Promise.reject(new Error('no video'));
      if (c.prepP && c.prepStart === startMs) return c.prepP;
      if (c.ac) { try { c.ac.abort(); } catch (e) { /* done */ } }
      const ac = c.ac = new AbortController();
      c.prepStart = startMs; c.prep = null;
      progress(0);
      text($('composeMsg'), '');
      c.prepP = EM.video.prepare(c.file, { startMs, maxMs: 15000, signal: ac.signal, onProgress: (pc) => { if (S.compose === c && c.ac === ac) progress(pc); } })
        .then((r) => {
          if (S.compose !== c || c.ac !== ac) return null;
          c.prep = r; progress(100);
          if (r.flashy) text($('composeMsg'), 'This video flashes a lot, so it will play dimmed on the screen.');
          return r;
        }, (e) => {
          if (c.ac === ac) c.prepP = null; // a later tap tries again
          if (S.compose === c && c.ac === ac && !(e && e.code === 'CANCELLED')) {
            hide($('videoProg'), true);
            const code = e && e.code;
            text($('composeMsg'), code === 'TOO_BIG' ? 'That video is too big' : code === 'UNSUPPORTED' ? "Videos can't be prepared on this phone." : 'That video did not open. Try again.');
          }
          throw e;
        });
      c.prepP.catch(() => { /* awaited by sendCompose, or abandoned */ });
      return c.prepP;
    }
    async function sendCompose() {
      const c = S.compose;
      if (!c) return;
      const btn = $('composeSend');
      btn.disabled = true;
      const m = $('composeM').value, fn = currentFn();
      if (c.kind === 'p') {
        let sent = 0;
        for (const it of c.items.filter((x) => x.st === 'ok')) {
          try {
            await ES.guest.queueUpload(S.code, { kind: 'p', blob: it.prep.display, thumb: it.prep.thumb, w: it.prep.w, h: it.prep.h, fn, m, cp: it.capEl.value });
            sent++;
          } catch (e) {
            text($('composeMsg'), e && e.code === 'FULL' ? 'No photos left. Thank you for sharing!' : 'Could not send. Try again.');
            break;
          }
        }
        if (sent) { closeSheet(); afterSend(); } else btn.disabled = false;
        return;
      }
      const start = c.dur > 15200 ? Math.round(+$('trimIn').value * 1000) : 0;
      let r;
      try { r = await prepVideo(start); } catch (e) { if (S.compose === c) btn.disabled = false; return; }
      if (!r || S.compose !== c) return;
      try {
        await ES.guest.queueUpload(S.code, { kind: 'v', blob: r.bytes, thumb: r.poster, w: r.w, h: r.h, du: r.du, fn, m, cp: $('videoCap').value });
      } catch (e) {
        text($('composeMsg'), e && e.code === 'FULL' ? 'Video slots for this event are full.' : e && /too big/.test(e.message || '') ? 'That video is too big' : 'Could not send. Try again.');
        btn.disabled = false;
        return;
      }
      closeSheet();
      toast(r.flashy ? 'This video flashes a lot, so it will play dimmed on the screen.' : 'Videos play without sound.', 5000);
      afterSend();
    }
    function afterSend() {
      if (S.watch) S.watch.busy();
      refreshMine();
    }

    // ================================================================================== winner and report ===
    async function openWinner() {
      const ch = S.live && S.live.ch;
      if (!ch || !ch.win) return;
      const id = String(ch.win);
      S.winnerId = id;
      const box = $('winMedia');
      box.textContent = '';
      if (S.winnerUrl) { URL.revokeObjectURL(S.winnerUrl); S.winnerUrl = ''; }
      hide($('reportBtn'), true); hide($('reasons'), true);
      text($('reportMsg'), ''); text($('winMsg'), 'Loading…');
      openSheet('sheetWinner');
      let d = null, failed = '';
      try { [d] = await ES.media.get(S.code, [id], { select: ['d', 'kd', 'st', 'w', 'h'], auth: false }); } catch (e) { failed = e && e.code; }
      if (S.winnerId !== id || !S.sheet || S.sheet.id !== 'sheetWinner') return;
      if (!d || !d.d || !d.d.length) { text($('winMsg'), failed === 'OFFLINE' ? 'No connection. Try again.' : 'This photo is no longer available.'); return; }
      text($('winMsg'), '');
      const video = d.kd === 'v';
      const type = video ? ((EM && EM.sniff && EM.sniff.bytes && EM.sniff.bytes(d.d.subarray(0, 64))) || 'video/mp4') : 'image/jpeg';
      S.winnerUrl = URL.createObjectURL(new Blob([d.d], { type }));
      let el;
      if (video) { el = document.createElement('video'); el.muted = true; el.playsInline = true; el.controls = true; el.loop = true; el.setAttribute('playsinline', ''); }
      else { el = document.createElement('img'); el.alt = 'Winner!'; }
      el.className = 'es-winner'; el.src = S.winnerUrl;
      box.appendChild(el);
      let done = {};
      try { done = JSON.parse(localStorage.getItem(`luts:es-rep:${S.code}`) || '{}') || {}; } catch (e) { done = {}; }
      if (done[id]) text($('reportMsg'), 'Thanks — the hosts will check it.');
      else hide($('reportBtn'), false);
    }
    async function sendReport(why) {
      const id = S.winnerId;
      if (!id) return;
      document.querySelectorAll('#reasons button').forEach((b) => { b.disabled = true; });
      try {
        await ES.report(S.code, id, why);
        hide($('reasons'), true); hide($('reportBtn'), true);
        text($('reportMsg'), 'Thanks — the hosts will check it.');
      } catch (e) {
        text($('reportMsg'), e && (e.code === 'OFFLINE' || e.code === 'QUOTA') ? 'No connection. Try again.' : 'Could not send. Try again.');
      } finally { document.querySelectorAll('#reasons button').forEach((b) => { b.disabled = false; }); }
    }

    // ================================================================================================ erase ===
    async function doErase() {
      const go = $('delGo');
      go.disabled = true; text($('delMsg'), '');
      try { await ES.guest.erase(S.code); } catch (e) {
        text($('delMsg'), e && (e.code === 'OFFLINE' || e.code === 'QUOTA') ? 'No connection. Try again.' : 'Could not delete everything. Ask the hosts.');
        go.disabled = false;
        return;
      }
      go.disabled = false;
      clearLocal();
      resetForm();
      resetVoice();
      S.status = null; S.mine = []; S.queue = []; S.bookEditing = false; S.stateKind = '';
      S.sig.mine = S.sig.missions = '';
      closeSheet();
      route();
      refreshMine();
      toast('Deleted. Thank you for coming!', 6000);
      text($('joinMsg'), 'Deleted. Thank you for coming!');
    }
    function resetForm() {
      cancelPending();
      $('nameIn').value = ''; $('wishIn').value = '';
      setSelfie(null);
      text($('selfieText'), 'Tap to take a selfie');
      document.querySelectorAll('#ticks input').forEach((cb) => { cb.checked = false; });
      S.noticeVersion = -1;
      renderNotice();
      updateJoin();
    }
    function onEnded() {
      if (S.ended) return;
      S.ended = true;
      clearLocal();
      cancelPending();
      if (S.watch) { S.watch.stop(); S.watch = null; }
    }

    // ================================================================================================ render ===
    function renderPre(t) {
      if (S.screen !== 'pre') return;
      const left = S.pub.o - t;
      if (left > DAY) { text($('preIn'), fill('Check-in opens on {0}', fmtWhen(S.pub.o))); hide($('preWhen'), true); }
      else { text($('preIn'), fill('Check-in opens in {0}', dur(left))); text($('preWhen'), fmtWhen(S.pub.o)); hide($('preWhen'), false); }
    }
    function renderAll() {
      if (!S.pub) return;
      const t = now();
      try {
        renderPre(t);
        if (S.screen === 'pre' || S.screen === 'join') updateJoin();
        if (S.screen === 'status') { renderStatus(t); renderMine(t); renderSend(t); }
        renderMissions(t);
        renderGallery();
        renderBook(t);
        renderRsvp();
        hide($('delBox'), !(session() && S.screen === 'status'));
        if (S.screen === 'ended') text($('endedText'), fill('This event has ended. Photos were kept until {0}.', fmtDate(S.pub.x)));
        renderBanners(t);
        hide($('foot'), !(S.pub.mk && !window.LUTSNative));
      } catch (e) { /* a render problem must not stop the page */ }
    }
    function tick() {
      if (!S.pub) return;
      if (wantScreen() !== S.screen) { route(); return; }
      const t = now();
      renderPre(t);
      if (S.screen === 'status') { renderStatus(t); renderSend(t); renderMine(t); }
      renderBanners(t);
    }

    // ================================================================================================ sheets ===
    function openSheet(id) {
      if (S.sheet && S.sheet.id !== id) closeSheet(true);
      const el = $(id);
      if (!S.sheet) S.opener = document.activeElement;
      el.hidden = false; S.sheet = el;
      document.body.classList.add('es-locked');
      const h = el.querySelector('h2');
      if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* old WebView */ } }
    }
    function closeSheet(keepFocus) {
      const el = S.sheet;
      if (!el) return false;
      el.hidden = true; S.sheet = null;
      document.body.classList.remove('es-locked');
      if (el.id === 'sheetCompose') endCompose();
      if (el.id === 'sheetWinner') {
        const v = el.querySelector('video'); if (v) { try { v.pause(); } catch (e) { /* idle */ } }
        $('winMedia').textContent = '';
        if (S.winnerUrl) { URL.revokeObjectURL(S.winnerUrl); S.winnerUrl = ''; }
        S.winnerId = '';
      }
      const op = S.opener; S.opener = null;
      if (!keepFocus && op && document.contains(op) && op.focus) { try { op.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
      return true;
    }
    function trapFocus(e) {
      if (!S.sheet || e.key !== 'Tab') return;
      const f = [...S.sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((x) => !x.disabled && !x.closest('[hidden]') && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !S.sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    // ============================================================================================ language ===
    function initLang() {
      const sel = $('langPick');
      const langs = (window.LUTSLang && Array.isArray(LUTSLang.langs) && LUTSLang.langs.length) ? LUTSLang.langs
        : [['auto', 'Phone language'], ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['mr', 'मराठी'], ['te', 'తెలుగు'], ['ta', 'தமிழ்'],
          ['gu', 'ગુજરાતી'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['pa', 'ਪੰਜਾਬੀ']];
      langs.forEach(([c, n]) => sel.add(new Option(c === 'auto' ? T(n) : n, c)));
      let cur = 'auto';
      try { cur = localStorage.getItem(LANG_KEY) || 'auto'; } catch (e) { /* blocked */ }
      sel.value = LANG_CODES.includes(cur) ? cur : 'auto';
      sel.setAttribute('aria-label', T('Language'));
      // An explicit choice is this page's own (luts:es-lang); the game's language (luts:lang) is never touched.
      sel.addEventListener('change', () => {
        try { localStorage.setItem(LANG_KEY, sel.value); } catch (e) { /* blocked: this visit only */ }
        location.reload();
      });
    }

    // ============================================================================== sparkles (§4.24: gentle) ===
    // Slow gold twinkles only: each dot's alpha drifts between 0.22 and 0.52 over 10–40 s, so nothing ever flashes.
    function initSparkles() {
      const cv = $('sparkle');
      const g = cv && cv.getContext && cv.getContext('2d');
      if (!g) return;
      const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      const dots = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4, p: Math.random() * 6.283, s: 0.15 + Math.random() * 0.45 }));
      let w = 0, h = 0, dpr = 1, last = 0;
      function draw(tm) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        for (const d of dots) {
          const a = reduce ? 0.35 : 0.22 + 0.3 * (1 + Math.sin(d.p + (tm / 1000) * d.s)) / 2;
          g.fillStyle = `rgba(255,214,120,${a.toFixed(3)})`;
          g.beginPath(); g.arc(d.x * w, d.y * h, d.r, 0, 6.283); g.fill();
        }
      }
      function fit() {
        dpr = Math.min(2, window.devicePixelRatio || 1); w = window.innerWidth; h = window.innerHeight;
        cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
        draw(performance.now());
      }
      function loop(tm) { if (!document.hidden && tm - last > 66) { last = tm; draw(tm); } requestAnimationFrame(loop); }
      window.addEventListener('resize', fit);
      fit();
      if (!reduce) requestAnimationFrame(loop);
    }

    // ================================================================================================ events ===
    function bind() {
      $('scrCode').addEventListener('submit', safe((e) => {
        e.preventDefault();
        const c = ES.events.normCode($('codeIn').value);
        if (!ES.CODE_RE.test(c)) { codeError(); return; }
        $('codeIn').removeAttribute('aria-invalid'); text($('codeErr'), '');
        openEvent(c);
      }));
      $('codeIn').addEventListener('input', () => { $('codeIn').removeAttribute('aria-invalid'); text($('codeErr'), ''); });

      $('scrJoin').addEventListener('submit', safe((e) => { e.preventDefault(); return submitJoin(); }));
      ['nameIn', 'wishIn', 'fnIn'].forEach((id) => $(id).addEventListener('input', () => { cancelPending(); updateJoin(); }));
      $('fnIn').addEventListener('change', () => { cancelPending(); updateJoin(); });
      $('ticks').addEventListener('change', () => { cancelPending(); if ($('joinMsg')._en === 'Tick both boxes to continue.') text($('joinMsg'), ''); updateJoin(); });
      $('selfieIn').addEventListener('change', safe(() => { const f = $('selfieIn').files[0]; $('selfieIn').value = ''; return onSelfie(f); }));

      const pick = (inp, fn) => inp.addEventListener('change', safe(() => { const files = [...(inp.files || [])]; inp.value = ''; if (files.length) return fn(files); return undefined; }));
      pick($('photoIn'), (f) => openPhotos(f, ''));
      pick($('shotIn'), (f) => openPhotos(f, ''));
      pick($('chFile'), (f) => openPhotos(f, (S.live && S.live.ch && S.live.ch.id) || ''));
      pick($('videoIn'), (f) => openVideo(f[0], ''));
      $('missionList').addEventListener('change', safe((e) => {
        const inp = e.target;
        if (!inp || inp.type !== 'file') return undefined;
        const files = [...(inp.files || [])]; const m = inp.dataset.m || ''; inp.value = '';
        return files.length ? openPhotos(files, m) : undefined;
      }));
      $('mineList').addEventListener('click', safe(async (e) => {
        const b = e.target.closest('button[data-key]');
        if (!b) return;
        b.disabled = true;
        await ES.guest.drop(S.code, b.dataset.key);
        refreshMine();
      }));
      $('composeSend').addEventListener('click', safe(sendCompose));
      $('trimIn').addEventListener('input', () => {
        trimLabel();
        const c = S.compose;
        if (c && c.ac && c.prepStart !== Math.round(+$('trimIn').value * 1000)) { try { c.ac.abort(); } catch (x) { /* done */ } c.prepP = null; hide($('videoProg'), true); }
        const v = $('videoPrev');
        try { v.currentTime = +$('trimIn').value; } catch (x) { /* not seekable yet */ }
      });

      $('saveGallery').addEventListener('click', safe(async () => {
        const k = galleryKey();
        if (!k) return;
        const url = ES.urls.gallery(S.code, { k });
        const r = EM && EM.share ? await EM.share({ title: S.pub.t, text: ES.caption('gallery', { title: S.pub.t, url }) }) : 'unsupported';
        if (r === 'copied') toast('Link copied');
        else if (r === 'unsupported') { const inp = $('galleryUrl'); inp.value = url; hide(inp, false); inp.focus(); inp.select(); }
      }));

      $('bookForm').addEventListener('submit', safe((e) => { e.preventDefault(); return sendBook(); }));
      $('bookText').addEventListener('input', updateBookSend);
      $('bookEdit').addEventListener('click', () => {
        S.bookEditing = true;
        const b = local().book;
        $('bookText').value = (b && b.tx) || '';
        text($('bookMsg'), '');
        renderAll();
        $('bookText').focus();
      });
      $('recBtn').addEventListener('click', safe(startRec));
      $('stopBtn').addEventListener('click', () => { if (S.rec) S.rec.stop().catch(() => { /* handled in done */ }); });
      $('playBtn').addEventListener('click', safe(() => {
        const a = $('voicePlay');
        if (!S.voice) return undefined;
        if (a.getAttribute('src') !== S.voice.url) a.src = S.voice.url;
        a.currentTime = 0;
        return a.play().catch(() => { /* autoplay refused */ });
      }));
      $('redoBtn').addEventListener('click', () => { resetVoice(); updateBookSend(); });

      $('rsvpBtn').addEventListener('click', safe(openRsvp));
      $('rsvpForm').addEventListener('submit', safe((e) => { e.preventDefault(); return sendRsvp(); }));
      $('rsvpFns').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-step]');
        if (!b) return;
        const out = b.parentElement.querySelector('output');
        const v = Math.max(0, Math.min(20, (+out.value || 0) + (+b.dataset.step)));
        out.value = String(v); out.textContent = String(v);
        const [minus, , plus] = b.parentElement.children;
        minus.disabled = v <= 0; plus.disabled = v >= 20;
      });

      $('delBtn').addEventListener('click', () => { text($('delMsg'), ''); openSheet('sheetDelete'); });
      $('delGo').addEventListener('click', safe(doErase));

      $('chWinner').addEventListener('click', safe(openWinner));
      $('reportBtn').addEventListener('click', () => { hide($('reportBtn'), true); hide($('reasons'), false); const f = $('reasons').querySelector('button'); if (f) f.focus(); });
      $('reasons').addEventListener('click', safe((e) => { const b = e.target.closest('button[data-why]'); return b ? sendReport(b.dataset.why) : undefined; }));
      $('annClose').addEventListener('click', () => { const k = $('annBanner').dataset.key; if (k) S.annClosed.add(k); renderAll(); });

      document.querySelectorAll('.sheet').forEach((sh) => {
        sh.addEventListener('click', (e) => { if (e.target === sh || e.target.closest('[data-close]')) closeSheet(); });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && S.sheet) { e.preventDefault(); closeSheet(); return; }
        trapFocus(e);
      });
      window.addEventListener('online', () => {
        renderAll();
        if (S.pending && S.pub && isOpen(now()) && !S.joinBusy) { clearTimeout(S.joinTimer); S.joinTimer = 0; doCheckIn(S.pending); }
        if (S.watch) S.watch.poke();
      });
      window.addEventListener('offline', () => renderAll());
      window.addEventListener('es:queue', (e) => { if (e.detail && e.detail.code === S.code) refreshMineSoon(); });
    }

    // ========================================================================================= back, hooks ===
    // §3.0: close the open sheet; otherwise back to the app's home screen, or the previous page on the web.
    window.LUTSBack = () => {
      if (closeSheet()) return true;
      if (window.LUTSNative) { location.replace('index.html'); return true; }
      history.back();
      return true;
    };
    window.EventGuest = Object.freeze({
      state() {
        const s = session();
        return {
          screen: S.screen, code: S.code, seat: s ? s.n : null,
          queued: S.queue.filter((q) => !q.refused).length, refused: S.queue.filter((q) => q.refused).map((q) => q.refused),
          status: S.status ? { selfie: S.status.selfie, slots: S.status.slots.slice(), shownAt: S.status.shownAt } : null,
          pending: !!S.pending, sheet: S.sheet ? S.sheet.id : '',
        };
      },
      poke() { return S.watch ? S.watch.poke() : null; },
      refresh() { return S.code ? Promise.all([refreshPub(), refreshLive(), refreshStatus()]).then(() => true) : Promise.resolve(false); },
    });

    // ================================================================================================= start ===
    initLang();
    initSparkles();
    bind();
    setInterval(tick, 1000);
    const code = ES.events.normCode(params.get('e') || '');
    if (ES.CODE_RE.test(code)) openEvent(code, { fromUrl: true });
    else {
      show('code');
      if (params.get('e')) { $('codeIn').value = code; codeError(); }
    }
  }
})();
