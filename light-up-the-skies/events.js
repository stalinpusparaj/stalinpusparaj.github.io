// Events and the Store: the home screen's bottom bar (index.html #homeBar; its Cards button opens the card maker).
//  - Events: four goals a day (two of them gratitude: light someone up, a love card, a card sent back), each paying
//    gems, and a bonus chest once all four are done. The game calls LUTSGoals.tick(kind) as things happen.
//  - Store: the Lucky Draw (one free spin a day, two more for a video; gems only, never bought, the chances shown),
//    free gems for a video, No ads (Premium) and the gem shop.
(() => {
  const D = () => window.LUTSDuel, G = () => window.LUTSGame;
  const $ = (s, r = document) => r.querySelector(s);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  // ---------- Daily goals ----------
  // [id, kind counted, how many, gems, text]; each day two gratitude goals and two play goals, picked by the date.
  const GRATITUDE = [
    ['joy', 'joy', 1, 15, 'Light up someone you’re grateful for'],
    ['back', 'back', 1, 20, 'Send a card back to someone who lit yours'],
    ['card', 'card', 1, 20, 'Play a love card show for someone'],
  ];
  const PLAY = [
    ['launch', 'launch', 20, 10, 'Light 20 crackers'],
    ['puzzle', 'puzzle', 2, 15, 'Win 2 puzzle levels'],
    ['race', 'race', 1, 20, 'Finish a street race in Fireworks Street'],
    ['rush', 'rush', 1, 15, 'Finish a Lantern Rush'],
    ['share', 'share', 1, 15, 'Share a show, a card or a level'],
    ['mela', 'mela', 1, 20, 'Play a Mela Night show'],
  ];
  const BONUS = 25, GKEY = 'luts:goals';
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  function pickFor(day) {
    const h = hash(day), g = [...GRATITUDE], p = [...PLAY], out = [];
    for (let i = 0; i < 2; i++) out.push(g.splice((h >>> (i * 3)) % g.length, 1)[0]);
    for (let i = 0; i < 2; i++) out.push(p.splice((h >>> (8 + i * 3)) % p.length, 1)[0]);
    return out;
  }
  function goals() {
    let st = load(GKEY, null);
    if (!st || st.day !== today()) st = { day: today(), prog: {}, claimed: {}, bonus: false };
    return st;
  }
  const list = () => pickFor(today());
  function tick(kind, n = 1) {
    const st = goals();
    let done = false;
    for (const [id, k, need] of list()) {
      if (k !== kind) continue;
      const before = st.prog[id] || 0;
      st.prog[id] = Math.min(need, before + n);
      if (before < need && st.prog[id] >= need) done = true;
    }
    store(GKEY, st);
    if (done && D()) D().toast('🎯 Goal done! Claim your gems in Events', 3200);
    renderBadge();
  }
  const claimable = () => { const st = goals(); return list().filter(([id, , need]) => (st.prog[id] || 0) >= need && !st.claimed[id]).length + (allDone(st) && !st.bonus ? 1 : 0); };
  const allDone = (st) => list().every(([id]) => st.claimed[id]);
  // The home screen's "today" pill: your daily streak and how many of today's goals are done (tap: Events)
  function renderToday() {
    const el = $('#homeToday');
    if (!el) return;
    const st = goals(), done = list().filter(([id, , need]) => (st.prog[id] || 0) >= need).length;
    let streak = 0; try { streak = G() && G().dailyStreak ? +G().dailyStreak() || 0 : 0; } catch (e) { streak = 0; }
    streakPrize(streak);
    let played = true; try { played = !G().playedToday || G().playedToday(); } catch (e) { played = true; }
    // a streak not yet kept today: warn, and the tap opens today's Daily Sky instead of Events
    // the next streak prize, when it's one or two days away (a reason to come back tomorrow)
    const next = STREAK_PRIZES.find(([d]) => d > streak), near = streak > 0 && next && next[0] - streak <= 2 ? next : null;
    el.classList.toggle('risk', streak > 0 && !played);
    el.textContent = streak > 0 && !played ? `🔥 ${streak}-day streak at risk · play today to keep it`
      : near ? `🔥 ${streak}-day streak · ${near[0] - streak} more for 💎${near[1]}`
      : streak > 0 ? `🔥 ${streak}-day streak · 🎯 Goals ${done}/4` : `🎯 Today's goals ${done}/4`;
    el.hidden = false;
  }
  // Streak milestones pay gems once each (3, 7, 14 and 30 days)
  const STREAK_PRIZES = [[3, 10], [7, 25], [14, 50], [30, 100]];
  function streakPrize(streak) {
    const got = load('luts:streakPrizes', {});
    for (const [days, gems] of STREAK_PRIZES) {
      if (streak < days || got[days] || !D() || !D().addGems) continue;
      got[days] = 1; store('luts:streakPrizes', got);
      D().addGems(gems, `${days}-day streak`);
      D().toast(`🔥 ${days}-day streak! +💎${gems}`, 3600);
      D().celebrate && D().celebrate();
    }
  }
  function renderBadge() {
    const b = $('#homeBarEventsN');
    if (!b) return;
    const n = claimable();
    b.textContent = n; b.hidden = !n;
    renderToday();
  }
  function renderGoals() {
    const st = goals(), box = $('#goalList');
    box.innerHTML = '';
    for (const [id, , need, gems, text] of list()) {
      const have = st.prog[id] || 0, ok = have >= need, got = !!st.claimed[id];
      const li = document.createElement('li');
      li.className = `goal${ok ? ' ok' : ''}${got ? ' got' : ''}${GRATITUDE.some((g) => g[0] === id) ? ' grateful' : ''}`;
      li.innerHTML = `<span class="goal-text"><b>${esc(text)}</b><span class="goal-bar"><i style="width:${Math.round(have / need * 100)}%"></i></span><small>${have} / ${need}</small></span>`;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = `btn ${ok && !got ? 'primary' : 'ghost'} goal-claim`;
      btn.disabled = !ok || got;
      btn.textContent = got ? '✓' : `💎 ${gems}`;
      btn.addEventListener('click', () => {
        const s = goals();
        if (s.claimed[id] || (s.prog[id] || 0) < need) return;
        s.claimed[id] = 1; store(GKEY, s);
        D().addGems(gems, 'goal done');
        renderGoals(); renderBadge();
      });
      li.append(btn);
      box.append(li);
    }
    const bonus = $('#goalBonus');
    bonus.disabled = !allDone(st) || st.bonus;
    bonus.textContent = st.bonus ? '✓ Chest opened' : `🎁 All four done: 💎 ${BONUS}`;
  }
  $('#goalBonus') || null;

  // ---------- Store: Lucky Draw ----------
  // [gems, weight]: the chances are shown under the wheel.
  const PRIZES = [[5, 30], [10, 26], [15, 16], [20, 12], [30, 8], [50, 5], [75, 2], [100, 1]];
  const DKEY = 'luts:draw', VIDEO_SPINS = 2;
  const draw = () => { const s = load(DKEY, {}); return s.day === today() ? s : { day: today(), free: 1, video: 0 }; };
  let spinning = false, angle = 0;
  function renderDraw() {
    const s = draw();
    $('#drawSpin').disabled = spinning || (!s.free && s.video >= VIDEO_SPINS);
    const prem = D() && D().premium();
    $('#drawSpin').textContent = s.free ? 'Spin free' : s.video < VIDEO_SPINS ? (prem ? `👑 Spin again (${VIDEO_SPINS - s.video} left)` : `🎬 Watch a video to spin (${VIDEO_SPINS - s.video} left)`) : 'Come back tomorrow';
    const total = PRIZES.reduce((a, [, w]) => a + w, 0);
    $('#drawOdds').textContent = `Chances: ${PRIZES.map(([g, w]) => `💎${g} ${Math.round(w / total * 100) || '<1'}%`).join(' · ')}`;
  }
  async function spin() {
    if (spinning) return;
    const s = draw();
    if (!s.free) {
      if (s.video >= VIDEO_SPINS) return;
      const g = G();
      if (!g || !g.watchVideo || !(await g.watchVideo())) return;
      s.video += 1;
    } else s.free = 0;
    store(DKEY, s);
    const total = PRIZES.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total, i = 0;
    while (r >= PRIZES[i][1]) { r -= PRIZES[i][1]; i++; }
    const seg = 360 / PRIZES.length;
    angle += 360 * 5 + (360 - (angle % 360)) - (i * seg + seg / 2);
    spinning = true; renderDraw();
    const wheel = $('#drawWheel');
    wheel.style.transform = `rotate(${angle}deg)`;
    setTimeout(() => {
      spinning = false;
      D().addGems(PRIZES[i][0], 'from the Lucky Draw');
      $('#drawWon').textContent = `You won 💎 ${PRIZES[i][0]}!`;
      renderDraw();
    }, 4200);
  }
  function buildWheel() {
    const seg = 360 / PRIZES.length, cols = ['#ff5fa2', '#ffb046', '#50a0ff', '#a06eff', '#2fd9a0', '#ff7a3c', '#ffd27a', '#ff5a4e'];
    $('#drawWheel').style.background = `conic-gradient(${PRIZES.map((_, i) => `${cols[i]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})`;
    $('#drawWheel').innerHTML = PRIZES.map(([g], i) => `<span style="transform: rotate(${i * seg + seg / 2}deg)"><b>💎${g}</b></span>`).join('');
  }
  async function freeGems() {
    const g = G();
    if (!g || !g.watchVideo) return;
    const st = load(DKEY, {}), day = today();
    const used = st.gday === day ? st.gvid || 0 : 0;
    if (used >= 4) { D().toast('Four free-gem videos a day. More tomorrow!'); return; }
    if (!(await g.watchVideo())) return;
    const s = load(DKEY, {}); s.gday = day; s.gvid = used + 1; store(DKEY, s);
    D().addGems(10, 'for the video');
    renderStore();
  }
  function renderStore() {
    const st = load(DKEY, {}), used = st.gday === today() ? st.gvid || 0 : 0;
    $('#storeFreeLeft').textContent = `${4 - used} of 4 left today`;
    const g = D();
    $('#storeNoAds').hidden = !!(g && g.premium());
  }

  // ---------- Sheets and the bottom bar ----------
  const open = (id) => { const g = D(); if (!g) return; g.openSheet($(`#${id}`)); };
  document.addEventListener('DOMContentLoaded', () => {
    if (!$('#homeBar')) return;
    $('#homeBarCards').addEventListener('click', () => $('#btnCard').click());
    for (const b of document.querySelectorAll('#homeBar [data-open]')) b.addEventListener('click', () => {
      const id = b.dataset.open;
      if (id === 'eventsModal') renderGoals();
      if (id === 'storeModal') { renderDraw(); renderStore(); $('#drawWon').textContent = ''; }
      open(id);
    });
    $('#goalBonus').addEventListener('click', () => {
      const st = goals();
      if (!allDone(st) || st.bonus) return;
      st.bonus = true; store(GKEY, st);
      D().addGems(BONUS, 'bonus chest'); D().celebrate && D().celebrate();
      renderGoals(); renderBadge();
    });
    $('#goalCard').addEventListener('click', () => { D().closeSheet($('#eventsModal')); $('#btnCard').click(); });
    $('#goalJoy').addEventListener('click', () => { D().closeSheet($('#eventsModal')); const b = $('#btnJoy'); if (b) b.click(); });
    $('#drawSpin').addEventListener('click', spin);
    $('#storeFree').addEventListener('click', freeGems);
    $('#storeNoAds').addEventListener('click', () => D().openPremium());
    $('#storeGems').addEventListener('click', () => { D().closeSheet($('#storeModal')); $('#btnGems').click(); });
    buildWheel();
    renderBadge();
    $('#homeToday').addEventListener('click', (e) => (e.currentTarget.classList.contains('risk') ? $('#btnDailySky') : $('#homeBar [data-open=eventsModal]')).click());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderBadge(); });
  });

  window.LUTSGoals = { tick, list, claimable };
})();
