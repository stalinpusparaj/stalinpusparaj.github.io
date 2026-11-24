// Home shortcuts forward to the original controls, keeping navigation and unlock rules in one place.
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const home = document.querySelector('#intro');
    const inner = home?.querySelector('.intro-inner');
    if (!inner || document.documentElement.classList.contains('tv') || document.body.classList.contains('web-viewer')) return;
    home.classList.add('home-focused');
    const t = (text) => window.LUTSLang?.t(text) || text;
    const key = 'luts:home-last-activity';
    const activities = ['btnStart', 'btnIntroCard', 'btnChor', 'btnHeist', 'btnDiya', 'btnRocket', 'btnGears', 'btnDailySky', 'btnLiveSky', 'btnSparkName'];
    const label = (source) => source.querySelector('.tile-text b')?.textContent || (source.id === 'btnStart' ? t('Start the show') : source.id === 'btnIntroCard' ? t('Create a love card') : source.textContent.trim());
    const available = (source) => source && !source.hidden && !source.closest('[hidden]') && !source.disabled;

    const watch = document.createElement('button');
    watch.type = 'button'; watch.id = 'homeWatch'; watch.className = 'btn ghost';
    const watchIcon = document.createElement('span'); watchIcon.setAttribute('aria-hidden', 'true'); watchIcon.textContent = '▶';
    const watchText = document.createElement('span'); watchText.textContent = t('Watch a show');
    watch.append(watchIcon, watchText);
    watch.addEventListener('click', () => document.querySelector('#btnLiveSky')?.click());
    inner.querySelector('.intro-actions').append(watch);

    const returnRow = document.createElement('div');
    returnRow.className = 'home-return';
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'home-return-card'; again.hidden = true;
    const daily = document.createElement('button');
    daily.type = 'button'; daily.className = 'home-return-card home-daily-shortcut';
    const render = () => {
      let last = null;
      try { const id = localStorage.getItem(key); if (activities.includes(id)) last = document.getElementById(id); } catch (_) { /* optional local preference */ }
      again.hidden = !available(last);
      again.replaceChildren();
      if (!again.hidden) {
        const title = document.createElement('small'); title.textContent = t('Play again');
        const name = document.createElement('b'); name.textContent = label(last);
        again.append(title, name); again.onclick = () => last.click();
      }
      const source = document.querySelector('#btnDailySky');
      daily.hidden = !available(source);
      daily.replaceChildren();
      const title = document.createElement('small'); title.textContent = t('Today’s challenge');
      const detail = document.createElement('b'); detail.textContent = document.querySelector('#tileDaily')?.textContent || t('Daily Sky');
      daily.append(title, detail);
    };
    daily.addEventListener('click', () => document.querySelector('#btnDailySky')?.click());
    returnRow.append(again, daily);
    inner.querySelector('.intro-actions').after(returnRow);

    // Labels can wrap naturally here, including Tamil; offers no longer sit over the title.
    const utilities = document.createElement('div'); utilities.className = 'home-utilities';
    home.querySelectorAll('.home-side').forEach((nav) => utilities.append(nav));
    inner.append(utilities);
    activities.forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => {
        try { localStorage.setItem(key, id); } catch (_) { /* storage unavailable */ }
        render();
      }, { capture: true });
    });
    new MutationObserver(() => { if (!home.hidden) render(); }).observe(home, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    render();
  });
})();
