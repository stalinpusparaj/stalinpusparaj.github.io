/* Event Sky on the home screen: window.ESBoot (event-sky-boot.js), loaded by index.html only, after game.js and
 * home-menu.js. Build spec: research/event-sky-spec.md §5.1–§5.3 (WP-I).
 *
 * The "For your people" tile #btnEventSky (and its home-menu row, which taps the tile) opens the organiser console,
 * event-host.html, bundled with the app. Rules:
 *  - The tile shows only inside the app (window.LUTSNative). On the website (github.io, or ?viewer, the card viewer)
 *    and in a plain browser it stays hidden, so creating events and buying passes happen only in the app.
 *  - It stays hidden in the iOS app too (LUTSNative.platform 'ios'): passes and activation codes are Google Play only
 *    (App Store rule 3.1.1), so iOS has no organiser entry; guest pages opened from an event link still work there.
 *  - On Android TV (html.tv) it reads "Show an event on this TV" and opens the big screen's PIN pairing screen,
 *    event-wall.html?pair=1&tv=1, where the host pairs the TV from their phone.
 *  - It sets no #hash, so the first-run Live Sky start is unaffected, and game.js is not changed.
 *  - Back (window.LUTSBack, game.js) is wrapped: while an event page is still opening after a tap, Back stops the
 *    opening and stays on home; otherwise it falls through to the game's own Back.
 *
 * The tile's words live on index.html, so they are translated by the game's dictionaries (i18n/<lang>.js), not by the
 * event dictionaries (i18n/event/). They are listed here for those dictionaries.
 *
 * Test hooks: window.ESBoot = { state() → {shown, mode:'phone'|'tv'|'', target, pending}, refresh(), open(), back() }.
 */
/* STRINGS:
Event Sky
Guest check-in and a live photo wall for your event
Show an event on this TV
Pair it with a PIN from the host’s phone
*/
(function () {
  'use strict';
  if (window.ESBoot) return;

  const HOST_PAGE = 'event-host.html';
  const TV_PAGE = 'event-wall.html?pair=1&tv=1';
  const WORDS = {
    phone: ['Event Sky', 'Guest check-in and a live photo wall for your event'],
    tv: ['Show an event on this TV', 'Pair it with a PIN from the host’s phone'],
  };
  // An event page opens in well under a second from the app's own files; a Back press within this time after a tap
  // means "stay here", not "leave the app".
  const PENDING_MS = 6000;
  let pendingAt = 0, wired = null;

  // The website is a card viewer (game.js uses the same test): no tile there, even if a shell object is faked.
  const viewer = () => /(^|\.)github\.io$/i.test(location.hostname) || /[?&]viewer\b/.test(location.search);
  const inApp = () => !!window.LUTSNative && !viewer() && window.LUTSNative.platform !== 'ios';
  const isTv = () => document.documentElement.classList.contains('tv');
  const tile = () => document.getElementById('btnEventSky');
  const target = () => (isTv() ? TV_PAGE : HOST_PAGE);
  const pending = () => pendingAt > 0 && Date.now() - pendingAt < PENDING_MS;

  // Words are written only when the mode changes: i18n.js translates them as they appear, and writing English again
  // on every refresh would undo that.
  function label(el, mode) {
    if (el.dataset.esMode === mode) return;
    const [name, sub] = WORDS[mode];
    const b = el.querySelector('.tile-text b'), s = el.querySelector('.tile-text small');
    if (b) b.textContent = name;
    if (s) s.textContent = sub;
    el.dataset.esMode = mode;
  }

  function refresh() {
    const el = tile();
    if (!el) return false;
    if (!inApp()) { el.hidden = true; return false; }
    label(el, isTv() ? 'tv' : 'phone');
    if (wired !== el) { el.addEventListener('click', onTap); wired = el; }
    el.hidden = false;
    return true;
  }

  function onTap(e) {
    if (e) e.preventDefault();
    open();
  }

  function open() {
    if (!inApp()) return false; // never from the website, whatever called it
    const url = target();
    pendingAt = Date.now();
    try { location.href = url; } catch (err) { pendingAt = 0; return false; }
    return true;
  }

  // Back while the event page is still opening: stop it and stay on home.
  function back() {
    if (!pending()) { pendingAt = 0; return false; }
    pendingAt = 0;
    try { window.stop(); } catch (e) { /* nothing to stop */ }
    return true;
  }

  function wrapBack() {
    const inner = window.LUTSBack;
    if (inner && inner.__esBoot) return;
    const wrapped = function () {
      if (back()) return true;
      return typeof inner === 'function' ? inner.apply(this, arguments) : false;
    };
    wrapped.__esBoot = true;
    window.LUTSBack = wrapped;
  }

  window.ESBoot = Object.freeze({
    state: () => { const el = tile(); const shown = !!el && !el.hidden; return { shown, mode: shown ? (el.dataset.esMode || '') : '', target: shown ? target() : '', pending: pending() }; },
    refresh, open, back,
  });

  refresh();
  wrapBack();
  // Again once the page is complete (the app shell's html.tv and LUTSNative are set before any script, but a late
  // shell, a game.js that set LUTSBack later, or a page restored from the back/forward cache are covered too).
  const again = () => { refresh(); wrapBack(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', again, { once: true });
  window.addEventListener('load', again, { once: true });
  window.addEventListener('pageshow', () => { pendingAt = 0; again(); });
})();
