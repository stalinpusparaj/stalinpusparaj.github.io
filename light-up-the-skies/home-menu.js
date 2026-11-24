// The home menu (☰, top left of home): every mode and screen in one list, grouped as home groups them. Each row taps
// the home screen's own button, so a row always does exactly what its tile does, and a tile that is hidden (the
// website, a phone without wallpapers, Diwali week over) has no row. Built each time it opens, so names and badges are
// today's.
(function (root) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  // [selector, label when the button has none of its own, icon (an emoji or a picture) when it has no picture of its own]
  const GROUPS = [
    { title: 'Play', items: [['#btnStart', 'Start the show', 'assets/menu/thumb-show.webp'], ['#btnIntroCard', 'Create a love card', 'assets/menu/thumb-card.webp'], ['#btnChor'], ['#btnHeist'],
      ['#btnDiya'], ['#btnRocket'], ['#btnGears'], ['#btnDailySky'], ['#btnLiveSky'], ['#btnWallpapers'], ['#btnSparkName'], ['#btnBoard']] },
    { title: 'For your people', items: [['#btnFest'], ['#btnJoy'], ['#btnBirthdays'], ['#btnWishes'], ['#btnEventSky'], ['#btnMySky']] },
    // (Street Heist and the Leaderboard are listed once, under Play: the Challenges row's buttons only forward to them)
    { title: 'Challenges', items: [['#btnMela'], ['#btnDuel'], ['#btnRush'], ['#btnChRocket'], ['#btnChDiya']] },
    { title: 'More', items: [['#homeBar [data-open="eventsModal"]'], ['#homeBarCards'], ['#homeBar [data-open="storeModal"]'], ['#sideSpin'], ['#sideGems'],
      ['#sidePremium'], ['#btnIntroSettings', 'Settings']] },
  ];
  // Pictures that take their colour from where they sit on home (the settings gear) keep it in the menu.
  const TINT = { '#btnIntroSettings': 'stroke' };
  let menu = null, btn = null, list = null;

  const shown = (el) => !!el && !el.hidden && !el.closest('[hidden]') && el.getClientRects().length > 0;
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  // the first selector that finds something (a selector list would take whichever comes first in the button)
  const first = (el, sels) => { for (const s of sels) { const f = el.querySelector(s); if (f) return f; } return null; };
  function iconFor(el, fallback) {
    const art = first(el, ['.tile-ico', ':scope > i > *', ':scope > svg']); // a tile's art, a card's thumb or treasure, a side button's picture
    const box = document.createElement('span');
    box.className = 'hm-ico';
    box.setAttribute('aria-hidden', 'true');
    if (art) {
      const c = art.cloneNode(true);
      c.removeAttribute('id'); c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); // (gradients still resolve to the tile's own)
      box.appendChild(c);
    } else if (/\.webp$/.test(fallback || '')) { const im = new Image(); im.src = fallback; im.alt = ''; im.decoding = 'async'; box.appendChild(im); } // home shows it as a CSS picture
    else box.textContent = fallback || '✨';
    return box;
  }
  function row(sel, src, label, fallback) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hm-item';
    const name = text(first(src, ['.tile-text b', ':scope > b', ':scope > span:not(.tile-badge):not(.btn-ico):not(.tile-ico)'])) || label || text(src) || src.getAttribute('aria-label') || '';
    const sub = text(src.querySelector('.tile-text small, :scope > small'));
    const badge = text(src.querySelector('.tile-badge, :scope > em:not([hidden])'));
    const ico = iconFor(src, fallback);
    if (TINT[sel]) ico.classList.add(TINT[sel]);
    b.appendChild(ico);
    const t = document.createElement('span'); t.className = 'hm-text';
    const n = document.createElement('b'); n.textContent = name; t.appendChild(n);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; t.appendChild(s); }
    b.appendChild(t);
    if (badge) { const e = document.createElement('em'); e.textContent = badge; b.appendChild(e); }
    b.addEventListener('click', () => { close(false); src.click(); });
    return b;
  }
  function render() {
    list.textContent = '';
    for (const g of GROUPS) {
      const rows = [];
      for (const [sel, label, icon] of g.items) { const src = $(sel); if (shown(src)) rows.push(row(sel, src, label, icon)); }
      if (!rows.length) continue;
      const h = document.createElement('h3'); h.textContent = g.title;
      list.appendChild(h);
      rows.forEach((r) => list.appendChild(r));
    }
  }
  function build() {
    menu = document.createElement('div');
    menu.className = 'home-menu'; menu.id = 'homeMenu'; menu.hidden = true;
    menu.innerHTML = `<div class="hm-scrim" data-hm-close></div>
      <aside class="hm-panel" role="dialog" aria-modal="true" aria-labelledby="homeMenuHead">
        <header class="hm-head"><h2 id="homeMenuHead">Menu</h2>
          <button class="icon-btn" type="button" data-hm-close aria-label="Close menu"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
        <nav class="hm-list" aria-label="Everything to play"></nav>
      </aside>`;
    document.body.appendChild(menu);
    list = menu.querySelector('.hm-list');
    menu.querySelectorAll('[data-hm-close]').forEach((b) => b.addEventListener('click', () => close(true)));
  }
  const isOpen = () => !!menu && !menu.hidden;
  const intro = () => $('#intro');
  function open() {
    if (!menu) build();
    render();
    menu.hidden = false;
    if (intro()) intro().inert = true; // focus (Tab, a TV remote, a screen reader) stays in the menu
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    const first = list.querySelector('.hm-item');
    if (first) first.focus({ preventScroll: true });
  }
  function close(refocus) {
    if (!isOpen()) return;
    menu.hidden = true; // hidden, not slid away: a closed panel holds no graphics memory
    if (intro()) intro().inert = false;
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (refocus) btn.focus({ preventScroll: true });
  }
  // Android Back and Escape close the menu first.
  const homeShown = () => !!intro() && !intro().hidden && !document.body.classList.contains('puzzling');
  // Back is used up only by a menu the player can see; one left open under another screen just closes.
  root.HomeMenu = { open, close: () => close(true), back: () => { if (!isOpen()) return false; const seen = homeShown(); close(seen); return seen; }, isOpen };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(true); } });
  document.addEventListener('DOMContentLoaded', () => {
    btn = $('#btnHomeMenu');
    if (btn) btn.addEventListener('click', () => (isOpen() ? close(true) : open()));
    // Something else took the screen (a link to a game, a challenge, a card arriving while the app is open): the menu goes.
    const watch = () => { if (isOpen() && !homeShown()) close(false); };
    new MutationObserver(watch).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (intro()) new MutationObserver(watch).observe(intro(), { attributes: true, attributeFilter: ['hidden'] });
  });
})(typeof window !== 'undefined' ? window : globalThis);
