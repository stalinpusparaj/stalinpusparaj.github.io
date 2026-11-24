/* Keep secondary tools discoverable without covering the play area. Existing controls
   are moved, not cloned: billing, capture and AR keep their original handlers. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (document.documentElement.classList.contains('tv')) return;
    const actions = document.querySelector('.hud .actions');
    if (!actions) return;
    const more = document.createElement('details');
    more.className = 'play-tools';
    const summary = document.createElement('summary');
    summary.setAttribute('aria-label', 'More');
    summary.textContent = '•••';
    const caption = document.createElement('span'); caption.className = 'play-tools-caption'; caption.textContent = 'More'; summary.append(caption);
    const panel = document.createElement('div');
    panel.className = 'play-tools-panel';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'More');
    for (const id of ['btnAR', 'btnFlip', 'btnPhoto', 'btnRec', 'btnPause', 'btnFull']) {
      const button = document.getElementById(id);
      if (button) panel.append(button);
    }
    for (const [sourceId, label] of [['btnIntroCard', 'Love card'], ['btnDailySky', 'Daily Sky']]) {
      const source = document.getElementById(sourceId);
      if (!source) continue;
      const shortcut = document.createElement('button');
      shortcut.type = 'button'; shortcut.className = 'play-discovery'; shortcut.textContent = label;
      shortcut.addEventListener('click', () => {
        if (!document.body.classList.contains('launch-active')) source.click();
      });
      panel.append(shortcut);
    }
    more.append(summary, panel); actions.append(more);
    panel.addEventListener('click', event => { if (event.target.closest('button')) more.open = false; });
    document.addEventListener('pointerdown', event => { if (!more.contains(event.target)) more.open = false; });
    more.addEventListener('keydown', event => { if (event.key === 'Escape') { more.open = false; summary.focus(); event.stopPropagation(); } });
    more.addEventListener('toggle', () => { if (more.open && document.body.classList.contains('launch-active')) more.open = false; });
    new MutationObserver(() => {
      if (document.body.classList.contains('launch-active') || document.body.classList.contains('home') || document.body.classList.contains('ui-hidden')) more.open = false;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // Native buttons remain in the tab sequence; arrow keys also navigate this tablist.
    const tabs = [...document.querySelectorAll('#modeTabs [role="tab"]')];
    tabs.forEach((tab, i) => tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined || tabs[next].disabled) return;
      event.preventDefault(); tabs[next].focus(); tabs[next].click();
    }));
  });
})();
