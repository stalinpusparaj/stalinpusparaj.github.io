// Android TV remote support (html.tv, set by the app shell; see TvRemote.kt). The shell turns the remote's keys into
// calls on window.LUTSTv: arrows move DOM focus between the buttons on screen, OK presses the focused one, and where the
// game is aimed freely (the sky in play, the Diya Path and Rocket Rush boards) the shell draws its own pointer and sends
// real touches. Nothing here runs on phones or the web.
(function () {
  'use strict';
  const root = document.documentElement;
  const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="tab"], [role="button"]';
  const AIM = ['#diyaCanvas', '#rrCanvas', '#stage'];
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  const isTv = () => root.classList.contains('tv');

  // Shown and not covered by anything on top (a sheet, the paywall, the intro): the point we would press must land on it.
  function reachable(el) {
    if (el.disabled || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
    const vw = innerWidth, vh = innerHeight;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    if (el === hit || el.contains(hit) || hit.contains(el) && hit.tagName === 'LABEL') return true;
    // Partly or wholly scrolled out of a list (or off screen): fine when the list itself is the thing on top.
    const box = scroller(el);
    if (!box) return false;
    const b = box.getBoundingClientRect();
    const clipped = r.top < Math.max(b.top, 0) || r.bottom > Math.min(b.bottom, vh) || r.left < Math.max(b.left, 0) || r.right > Math.min(b.right, vw);
    if (!clipped) return false;
    const inList = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 1), vw - 1), Math.min(Math.max(b.top + b.height / 2, 1), vh - 1));
    return !!inList && (box === inList || box.contains(inList));
  }

  function scroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return p;
    }
    return null;
  }

  // Open layers, topmost wins: focus stays inside it (the home screen, a sheet, the paywall, settings…), so buttons of
  // the screen underneath that happen to peek out are never picked.
  const LAYERS = '.modal:not([hidden]), #premiumPanel:not([hidden]), #worldPanel:not([hidden]), #settings.open, .overlay:not([hidden])';
  function layer() {
    let top = null, z = -Infinity;
    for (const el of document.querySelectorAll(LAYERS)) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const zi = parseInt(cs.zIndex, 10) || 0;
      if (zi >= z) { z = zi; top = el; }
    }
    return top;
  }

  const candidates = () => [...(layer() || document).querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('.tv-skip') && reachable(el));

  function current() {
    const a = document.activeElement;
    return a && a !== document.body && a.matches(FOCUSABLE) && reachable(a) ? a : null;
  }

  let last = null; // where focus was, so a list that re-renders under the ring carries on from the same spot
  function focus(el) {
    last = el.getBoundingClientRect();
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: scroller(el) ? 'center' : 'nearest', inline: 'nearest' }); // clear of a list's sticky header
    document.querySelectorAll('.tv-focus').forEach((o) => o !== el && o.classList.remove('tv-focus'));
    el.classList.add('tv-focus');
  }

  // Nearest candidate in direction d from rectangle r: distance along d, with sideways offset weighing more.
  function best(r, d, list, skip) {
    const [dx, dy] = DIRS[d];
    let pick = null, score = Infinity;
    for (const el of list) {
      if (el === skip) continue;
      const c = el.getBoundingClientRect();
      const along = dx ? (dx > 0 ? c.left - r.right : r.left - c.right) : (dy > 0 ? c.top - r.bottom : r.top - c.bottom);
      const centre = dx ? (dx > 0 ? c.left + c.width / 2 > r.left + r.width / 2 + 1 : c.left + c.width / 2 < r.left + r.width / 2 - 1)
        : (dy > 0 ? c.top + c.height / 2 > r.top + r.height / 2 + 1 : c.top + c.height / 2 < r.top + r.height / 2 - 1);
      if (along < -Math.min(c.width, c.height, r.width, r.height) / 2 || !centre) continue;
      const gap = dx ? Math.max(0, Math.max(c.top, r.top) - Math.min(c.bottom, r.bottom)) : Math.max(0, Math.max(c.left, r.left) - Math.min(c.right, r.right));
      const s = Math.max(along, 0) + gap * 3 + (gap > 0 ? 40 : 0);
      if (s < score) { score = s; pick = el; }
    }
    return pick;
  }

  // The free-aim surface on top right now, or null: the topmost thing at its middle must be the surface itself.
  function aimElement() {
    for (const sel of AIM) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40 || el.closest('[hidden]')) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && (hit === el || el.contains(hit))) return el;
      if (sel === '#stage') continue;
      return null; // a covered board means a panel is open over the puzzle
    }
    return null;
  }

  function aim() {
    const el = aimElement();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (el.id !== 'stage') return { x: r.left, y: r.top, w: r.width, h: r.height, board: true };
    // The sky: the open space between the top bar and the controls below, so the pointer never stands in for focus on
    // a button; pushing it past that edge hands back to the buttons (TvRemote).
    let top = r.top, bottom = r.bottom;
    const box = (sel) => { const e = document.querySelector(sel); if (!e || e.closest('[hidden]')) return null; const b = e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).visibility !== 'hidden' ? b : null; };
    const hud = box('.hud');
    if (hud && hud.bottom < r.top + r.height / 2) top = Math.max(top, hud.bottom);
    for (const sel of ['#modeTabs', '#dock', '#btnFire']) { const b = box(sel); if (b && b.top > r.top + r.height / 2) bottom = Math.min(bottom, b.top); }
    return { x: r.left, y: top, w: r.width, h: Math.max(40, bottom - top), board: false };
  }

  /** Arrow key: 'moved' (focus moved or a slider stepped), 'aim' (hand over to the pointer) or 'edge' (nothing there). */
  function nav(d) {
    const a = current();
    if (a && a.matches('input[type="range"]') && (d === 'left' || d === 'right')) {
      a.value = +a.value + (d === 'right' ? 1 : -1) * (+a.step || 1);
      a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true }));
      return 'moved';
    }
    const list = candidates();
    if (!a && aimElement()) return 'aim'; // the sky in play or a puzzle board: straight to the pointer
    if (!a && last) {
      // The focused button was replaced (a list re-rendered): the nearest button to where it was, or onward from there.
      const near = leaveAim(last.left + last.width / 2, last.top + last.height / 2, true);
      if (near) return 'moved';
    }
    if (!a) {
      // Nothing focused yet: on an aim surface start aiming; otherwise start on the first button of the screen.
      if (aimElement() && !list.length) return 'aim';
      // The screen's main action (Start the show, Continue, Play…) first, else the top-left button.
      const first = list.find((el) => el.matches('.primary')) || list.sort((p, q) => { const x = p.getBoundingClientRect(), y = q.getBoundingClientRect(); return (x.top - y.top) || (x.left - y.left); })[0];
      if (!first) return aimElement() ? 'aim' : 'edge';
      focus(first); return 'moved';
    }
    const next = best(a.getBoundingClientRect(), d, list, a);
    if (next) { focus(next); return 'moved'; }
    // Off the edge of the buttons: a scrolling list scrolls on, otherwise the pointer takes over where there is sky to aim at.
    const box = scroller(a);
    if (box && (d === 'up' || d === 'down')) {
      const before = box.scrollTop; box.scrollTop += (d === 'down' ? 1 : -1) * box.clientHeight * 0.6;
      if (box.scrollTop !== before) return 'moved';
    }
    return aimElement() ? 'aim' : 'edge';
  }

  /** OK key on the focused element. Text fields keep focus so Android shows its keyboard. */
  function ok() {
    const a = current();
    if (!a) return aimElement() ? 'aim' : 'none';
    if (a.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="file"]), textarea')) { a.focus(); return 'typing'; }
    a.click();
    return 'pressed';
  }

  /** After the pointer hands back (Back key, or it left the sky): focus the button nearest to where it was. */
  function leaveAim(x, y, quiet) {
    const list = candidates();
    if (!list.length) return quiet ? null : 'edge';
    let pick = list[0], dist = Infinity;
    for (const el of list) {
      const c = el.getBoundingClientRect();
      const dx = Math.max(c.left - x, 0, x - c.right), dy = Math.max(c.top - y, 0, y - c.bottom);
      if (dx * dx + dy * dy < dist) { dist = dx * dx + dy * dy; pick = el; }
    }
    focus(pick);
    return quiet ? pick : 'moved';
  }

  // Keep the focus ring on something real: when a sheet closes or a screen changes, the focused button may vanish.
  function refocus() {
    if (!isTv() || current()) return;
    document.querySelectorAll('.tv-focus').forEach((o) => o.classList.remove('tv-focus'));
  }

  /** Back with nothing left to close: from a show go to the game's home screen (true); on the home screen, false. */
  function home() {
    const btn = document.getElementById('btnHome');
    if (document.body.classList.contains('home') || !btn) return false;
    btn.click();
    return true;
  }

  window.LUTSTv = { nav, ok, aim, leaveAim, refocus, candidates, home };
  document.addEventListener('focusin', (e) => {
    if (!isTv()) return;
    document.querySelectorAll('.tv-focus').forEach((o) => o !== e.target && o.classList.remove('tv-focus'));
    if (e.target.matches && e.target.matches(FOCUSABLE)) e.target.classList.add('tv-focus');
  });
})();
