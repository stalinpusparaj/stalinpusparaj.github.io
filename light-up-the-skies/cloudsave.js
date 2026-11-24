// Cloud save: the game's progress kept in the player's Google Play Games account (Saved Games), so a new phone or a
// reinstall gets it back. Only in the Android app, once Play Games has signed the player in.
//  - What's saved: the progress keys below (puzzles, trophies, gems, streaks, cards, birthdays, gratitude, goals,
//    settings). Not saved: device things (ads, recording, contacts, photos) and Premium (Google Play restores it).
//  - When: a few seconds after start (to restore), then whenever the app goes to the background, at most every 2 minutes.
//  - Restore: a phone with no progress of its own takes the cloud copy at once. A phone that has its own progress is
//    asked, only when the cloud copy is further along (more stars, trophies or gems); otherwise its own copy wins and
//    is saved over the cloud.
(() => {
  const KEYS = ['luts:diya', 'luts:rocket', 'luts:chor', 'luts:gems', 'luts:joy', 'luts:cards', 'luts:birthdays', 'luts:goals', 'luts:ach',
    'luts:game', 'luts:rush', 'luts:streakPrizes', 'luts:puzzles-done', 'luts:fest', 'luts:duel', 'luts:mela', 'luts:draw', 'luts:settings',
    'luts:me', 'luts:from', 'luts:lights', 'luts:finales', 'luts:tried', 'luts:tries', 'luts:world', 'luts:welcomed', 'luts:lang', 'luts:rate', 'luts:prompts', 'luts:pass', 'luts:rack'];
  const META = 'luts:cloud', GAP = 120e3;
  const native = () => (window.LUTSNative && typeof window.LUTSNative.service === 'function' ? window.LUTSNative : null);
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const meta = () => read(META) || {};
  const setMeta = (m) => { try { localStorage.setItem(META, JSON.stringify({ ...meta(), ...m })); } catch (e) { /* storage unavailable */ } };

  function gather() {
    const data = {};
    for (const k of KEYS) { const v = localStorage.getItem(k); if (v !== null) data[k] = v; }
    return { v: 1, at: Date.now(), data };
  }
  // How far along a copy is: stars in both puzzles, heist trophies (timed and calm), and gems.
  function score(data) {
    const j = (k) => { try { return JSON.parse(data[k] || 'null'); } catch (e) { return null; } };
    const stars = (p) => (p && p.stars ? Object.values(p.stars).reduce((a, b) => a + (+b || 0), 0) : 0);
    const chor = j('luts:chor') || {}, gems = j('luts:gems') || {};
    const count = (o) => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
    return stars(j('luts:diya')) + stars(j('luts:rocket')) + 5 * (count(chor.trophies) + count(chor.calm)) + Math.floor((+gems.b || 0) / 20);
  }
  const local = () => gather().data;

  let saving = false;
  async function save(force) {
    const n = native();
    if (!n || saving || (!force && Date.now() - (meta().saved || 0) < GAP)) return;
    saving = true;
    try { if (await n.service('games-save', JSON.stringify(gather())) === true) setMeta({ saved: Date.now() }); } catch (e) { /* offline: next time */ }
    saving = false;
  }
  function restore(copy) {
    for (const k of KEYS) { if (k in copy.data) localStorage.setItem(k, copy.data[k]); else localStorage.removeItem(k); }
    setMeta({ restored: copy.at, saved: Date.now() });
    location.reload();
  }
  function ask(copy, theirs, mine) {
    const box = document.createElement('div');
    box.className = 'cloud-ask';
    box.innerHTML = `<div class="cloud-box" role="dialog" aria-modal="true"><b></b><p></p><div><button type="button" class="btn ghost" data-keep></button><button type="button" class="btn primary" data-use></button></div></div>`;
    box.querySelector('b').textContent = '☁️ Progress found in your Play account';
    box.querySelector('p').textContent = `Saved ${new Date(copy.at).toLocaleDateString(document.documentElement.lang || 'en')} on another phone, further along than this one. Use it here? This phone's progress will be replaced.`;
    box.querySelector('[data-keep]').textContent = 'Keep this phone’s';
    box.querySelector('[data-use]').textContent = 'Use saved progress';
    box.querySelector('[data-keep]').addEventListener('click', () => { box.remove(); setMeta({ declined: copy.at }); save(true); });
    box.querySelector('[data-use]').addEventListener('click', () => restore(copy));
    document.body.append(box);
  }
  async function check() {
    const n = native();
    if (!n) return;
    let copy = null;
    try { const t = await n.service('games-load'); copy = t ? JSON.parse(t) : null; } catch (e) { return; } // signed out or Saved Games off
    if (!copy || !copy.data) { save(true); return; } // nothing in the cloud yet: put this phone's there
    const m = meta(), theirs = score(copy.data), mine = score(local());
    if (copy.at <= (m.saved || 0) || copy.at === m.declined || copy.at === m.restored) { save(false); return; } // ours, or already answered
    if (mine === 0 && theirs > 0) { restore(copy); return; } // a fresh phone: straight back
    if (theirs > mine) ask(copy, theirs, mine); else save(true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!native()) return;
    // Play Games signs in on its own at launch; give it a few seconds, then try once more a little later.
    setTimeout(check, 6000);
    setTimeout(() => { if (!meta().saved) check(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(false); });
  });
  window.LUTSCloud = { save, check, gather, score }; // (for tests)
})();
