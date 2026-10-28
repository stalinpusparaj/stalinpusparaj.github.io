/* Light Up the Skies — Sky Duel: a 30-second fireworks show over a landmark, scored by the crowd, sent to a friend.
   The friend first watches your show replay (the same taps, the same shells), then fires back with your crackers.
   The best show seen on this phone for each landmark is its street's Champion: their name and photo hang over it. */
(() => {
  'use strict';
  const D = window.LUTSDuel;
  if (!D) return;
  const $ = (s) => document.querySelector(s);
  const SECS = 30, FINALE = 25, SLOTS = 6, USES = 3, BUDGET = 12, RETRY_GEMS = 5;
  const KEY = 'luts:duel', PHOTO_KEY = 'luts:photo';
  const tr = (t) => (window.LUTSLang ? LUTSLang.t(t) : t); // for confirm dialogs (on-screen text is translated as it shows)
  const fmt = (n) => Math.round(n).toLocaleString('en-IN');

  // ----- Loadout: six crackers, three shots each, within a power budget (free 1, gem 2, Premium 3) -----
  const SHELLS = D.shells(), BY_ID = Object.fromEntries(SHELLS.map((s) => [s.id, s]));
  const power = (id) => (!BY_ID[id] ? 1 : BY_ID[id].premium ? 3 : BY_ID[id].gems ? 2 : 1);
  const DEFAULT = ['peony', 'chrysanthemum', 'ring', 'strobe', 'willow', 'crackle'].filter((id) => BY_ID[id]);
  const PICTURES = new Set(['tiger', 'flagindia', 'india', 'bangladesh', 'usa', 'uk', 'china', 'brazil']);
  const PAIRS = { 'crackle>willow': 'Golden rain', 'willow>crackle': 'Glitter fall', 'heart>heart': 'Love!', 'peony>chrysanthemum': 'Bouquet',
    'strobe>palm': 'Starlit palm', 'flagindia>tiger': 'Jai Hind!', 'ring>doublering': 'Halo', 'kamuro>strobe': 'Twinkling crown', 'crossette>crackle': 'Thunder' };

  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full: the duel still plays */ } };
  const photo = () => { try { return localStorage.getItem(PHOTO_KEY) || ''; } catch (e) { return ''; } };
  const myLoadout = () => { const l = load().loadout; return Array.isArray(l) && l.length === SLOTS && l.every((id) => BY_ID[id]) ? l : DEFAULT.slice(); };
  const usable = (id) => BY_ID[id] && (!BY_ID[id].premium || D.premium());
  const spent = (l) => l.reduce((n, id) => n + power(id), 0);

  // ----- The crowd's score: worked out from the taps alone, so a replay on any phone gets the same number -----
  // A tap is [tenths of a second, slot, x %, y %].
  function score(taps, loadout) {
    let total = 0;
    const events = [];
    taps.forEach((tp, i) => {
      const id = loadout[tp[1]], t = tp[0] / 10, prev = taps[i - 1], prev2 = taps[i - 2];
      const pid = prev && loadout[prev[1]], gap = prev ? t - prev[0] / 10 : 1;
      let pts = 60 + 20 * power(id), tag = '';
      if (gap < 0.3) { pts = 15; tag = 'Too crowded'; }
      else {
        if (gap >= 0.5 && gap <= 1.6) { pts += 40; tag = 'Rhythm'; }
        if (prev && id !== pid && !(prev2 && id === loadout[prev2[1]])) { pts += 40; tag = tag || 'Fresh!'; }
        else if (prev && id === pid) pts = Math.round(pts * 0.6);
        const zone = (x) => (x < 34 ? 0 : x < 67 ? 1 : 2);
        if (prev && zone(tp[2]) !== zone(prev[2])) pts += 20;
        const pair = PAIRS[`${pid}>${id}`];
        if (pair) { pts += 150; tag = pair; }
        if (PICTURES.has(id)) { pts += 200; tag = 'Wow!'; }
      }
      if (t >= FINALE) { pts *= 2; tag = tag ? `${tag} ×2` : 'Finale ×2'; }
      total += pts;
      events.push({ pts, tag });
    });
    return { total, events };
  }
  const stars = (s) => (s >= 3500 ? 3 : s >= 2200 ? 2 : s >= 900 ? 1 : 0);
  const starText = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

  // ----- Your photo: a small square, kept on this phone and sent inside your challenge links -----
  function pickPhoto() {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return res('');
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => {
          const c = document.createElement('canvas'), S = 96, k = Math.min(img.naturalWidth, img.naturalHeight);
          c.width = c.height = S;
          c.getContext('2d').drawImage(img, (img.naturalWidth - k) / 2, (img.naturalHeight - k) / 2, k, k, 0, 0, S, S);
          URL.revokeObjectURL(url);
          let q = 0.72, data = c.toDataURL('image/jpeg', q);
          while (data.length > 5200 && q > 0.3) { q -= 0.12; data = c.toDataURL('image/jpeg', q); }
          try { localStorage.setItem(PHOTO_KEY, data); } catch (e) { /* ignore */ }
          res(data);
        };
        img.onerror = () => { URL.revokeObjectURL(url); res(''); };
        img.src = url;
      };
      inp.click();
    });
  }
  const safePhoto = (p) => (typeof p === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p) && p.length < 9000 ? p : '');
  // Champion frames round your photo, bought once with gems (all free with Premium): on the banner, boards and cards.
  const FRAMES = [['', 'Plain', 0], ['gold', 'Gold', 20], ['diya', 'Diya', 30], ['rangoli', 'Rangoli', 30], ['peacock', 'Peacock', 40], ['nova', 'Skyburst', null], ['thief', 'Master Thief', -1]]; // Skyburst: Street Pass+ only; Master Thief: five street heists (chor.js)
  const FRAME_IDS = FRAMES.map((f) => f[0]);
  const myFrame = () => { const f = load().frame || ''; return FRAME_IDS.includes(f) ? f : ''; };
  const owns = (f) => !f || (load().frames || []).includes(f) || (D.premium() && f !== 'nova' && f !== 'thief');
  const safeFrame = (f) => (FRAME_IDS.includes(f) ? f : '');
  function avatar(p, name, cls = 'duel-ava', frame = '') {
    const a = document.createElement('span');
    a.className = frame ? `${cls} frame-${frame}` : cls;
    if (p) { const i = document.createElement('img'); i.src = p; i.alt = ''; a.append(i); }
    else a.textContent = (name || '?').trim().charAt(0).toUpperCase() || '🎆';
    return a;
  }

  // ----- The street's Champion: the best show this phone has seen for each landmark -----
  function champOf(w) {
    let c = (load().champ || {})[w];
    c = c && Number.isFinite(c.s) ? c : null;
    const top = boardTop(w); // this week's best online, when it beats what this phone has seen
    return top && (!c || top.s > c.s) ? top : c;
  }
  const boardTop = (w) => { const b = typeof boards !== 'undefined' && boards.get(w); return b && b.list[0] ? b.list[0] : null; };
  function crown(w, entry) {
    const st = load(), old = (st.champ || {})[w];
    if (old && old.s >= entry.s) return false;
    st.champ = st.champ || {};
    st.champ[w] = entry;
    save(st);
    return true;
  }


  // ----- Street boards online (Firebase, free Spark plan): each landmark's best shows this week, for everyone -----
  // Plain REST, no SDK: an anonymous sign-in gives each phone an id, and boards/<street>_<week>/players/<id> holds that
  // phone's best show there this week (name, photo, crackers, taps). The rules (firebase/firestore.rules) only let a
  // phone raise its own score. Scores read back are worked out again from the taps. (Project: light-up-the-skies.)
  const FIREBASE = window.LUTS_FIREBASE || { apiKey: 'AIzaSyAOkWLftdOi4qAxm-gmbTkdyctewSaMiIs', projectId: 'light-up-the-skies' }; // (tests set LUTS_FIREBASE to a mocked project)
  const ON = !!(FIREBASE.apiKey && FIREBASE.projectId);
  const AUTH_KEY = 'luts:fb';
  const week = () => Math.floor((Date.now() / 864e5 + 3) / 7); // weeks start on Monday (UTC)
  const boardId = (w) => `${w}_${week()}`;
  const DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;
  let auth = null;
  try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { auth = null; }
  async function token() {
    if (auth && auth.exp > Date.now() + 60e3) return auth.id;
    const signUp = () => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' }).then((x) => x.json());
    let r = auth && auth.refresh
      ? await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refresh)}` }).then((x) => x.json())
      : await signUp();
    if (!(r.idToken || r.id_token)) r = await signUp(); // a refresh that failed (account cleaned up): start afresh
    const id = r.idToken || r.id_token, refresh = r.refreshToken || r.refresh_token, uid = r.localId || r.user_id;
    if (!id) throw new Error('sign-in failed');
    auth = { id, refresh, uid, exp: Date.now() + (+(r.expiresIn || r.expires_in) || 3600) * 1000 };
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) { /* ignore */ }
    return id;
  }
  const str = (v) => ({ stringValue: String(v) });
  async function postBoard(r) {
    if (!ON || !r.score) return;
    try {
      const id = await token();
      const fields = { n: str(D.savedName() || 'Player'), p: str(photo()), s: { integerValue: String(r.score) }, l: { arrayValue: { values: r.loadout.map(str) } }, t: str(JSON.stringify(r.taps)), f: str(myFrame()), at: { integerValue: String(Date.now()) } };
      const url = `${DOCS}/boards/${boardId(r.world)}/players/${auth.uid}`;
      // Only a better show replaces your entry (the rules refuse a lower one, so a failed write is fine).
      await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${id}` }, body: JSON.stringify({ fields }) });
      boards.delete(r.world);
      const st = load(); st.posted = [...new Set([...(st.posted || []), boardId(r.world)])].slice(-60); save(st); // for Remove my shows
    } catch (e) { /* offline: the duel still counts on this phone */ }
  }
  const boards = new Map(); // street -> { at, list }
  async function board(w) {
    if (!ON) return [];
    const b = boards.get(w);
    if (b && Date.now() - b.at < 120e3) return b.list;
    try {
      const res = await fetch(`${DOCS}/boards/${boardId(w)}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'players' }], orderBy: [{ field: { fieldPath: 's' }, direction: 'DESCENDING' }], limit: 20 } }) }).then((x) => x.json());
      const list = (Array.isArray(res) ? res : []).filter((x) => x.document).map((x) => {
        const f = x.document.fields || {}, l = ((f.l && f.l.arrayValue.values) || []).map((v) => v.stringValue).filter((id) => BY_ID[id]).slice(0, SLOTS);
        let t = [];
        try { t = JSON.parse((f.t && f.t.stringValue) || '[]'); } catch (e) { t = []; }
        const v = readShow({ n: f.n && f.n.stringValue, p: f.p && f.p.stringValue, f: f.f && f.f.stringValue, w, l, t });
        if (v) { v.id = x.document.name.split('/').pop(); v.me = !!auth && v.id === auth.uid; }
        return v;
      }).filter((v) => v && !(load().hidden || []).includes(v.id)).sort((a, b) => b.s - a.s); // reported ones stay hidden here
      boards.set(w, { at: Date.now(), list });
      return list;
    } catch (e) { return b ? b.list : []; }
  }

  // Other games' weekly boards on the same Firebase (Fireworks Street's street races, the puzzles' sprints): post a score (higher
  // is better; a time is turned into one by the caller) with your name, photo and frame, and read the week's top ten.
  window.LUTSBoards = {
    on: ON,
    async post(key, score, extra = '') {
      if (!ON || !(score > 0)) return false;
      try {
        const id = await token();
        const fields = { n: str(D.savedName() || 'Player'), p: str(photo()), s: { integerValue: String(Math.min(20000, Math.round(score))) }, l: { arrayValue: { values: [] } }, t: str(String(extra).slice(0, 1000)), f: str(myFrame()), at: { integerValue: String(Date.now()) } };
        await fetch(`${DOCS}/boards/${boardId(key)}/players/${auth.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${id}` }, body: JSON.stringify({ fields }) });
        const st = load(); st.posted = [...new Set([...(st.posted || []), boardId(key)])].slice(-60); save(st);
        return true;
      } catch (e) { return false; }
    },
    async top(key) {
      if (!ON) return [];
      try {
        const res = await fetch(`${DOCS}/boards/${boardId(key)}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'players' }], orderBy: [{ field: { fieldPath: 's' }, direction: 'DESCENDING' }], limit: 10 } }) }).then((x) => x.json());
        return (Array.isArray(res) ? res : []).filter((x) => x.document).map((x) => {
          const f = x.document.fields || {}, uid = x.document.name.split('/').pop();
          return { n: D.clean(f.n && f.n.stringValue, 20) || 'Player', p: safePhoto(f.p && f.p.stringValue), f: safeFrame(f.f && f.f.stringValue), s: +((f.s && f.s.integerValue) || 0), t: (f.t && f.t.stringValue) || '', me: !!auth && uid === auth.uid };
        }).filter((v) => !(load().hidden || []).includes(v.id));
      } catch (e) { return []; }
    },
    fb: { on: ON, docs: DOCS, token, str, uid: () => (auth && auth.uid) || '' }, // (events.js: the Love Sky Wall)
    earnFrame(id) { if (!FRAME_IDS.includes(id)) return; const st = load(); st.frames = [...new Set([...(st.frames || []), id])]; st.frame = id; save(st); D.toast(`🎭 ${FRAMES.find((f) => f[0] === id)[1]} frame unlocked!`, 3600); }, // (chor.js: five heists)
    avatar: (p, n, f) => avatar(p, n, 'duel-ava', f), name: () => D.savedName(), photo: () => photo(), frame: () => myFrame(),
  };

  // A player reports a name or photo: it is hidden on this phone at once, and a report goes to the developer.
  async function report(v, w) {
    const st = load(); st.hidden = [...new Set([...(st.hidden || []), v.id])].slice(-200); save(st);
    boards.delete(w);
    try {
      const id = await token();
      await fetch(`${DOCS}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${id}` },
        body: JSON.stringify({ fields: { board: str(boardId(w)), uid: str(v.id), by: str(auth.uid), at: { integerValue: String(Date.now()) } } }) });
    } catch (e) { /* offline: still hidden here */ }
  }
  // ----- Cheers and gifts: a 👏 (free, once a day per player) or a 🎁 (5 gems, they get 5) to someone on a board -----
  // They land in inbox/<their id>/items, which only they can read; the app picks them up when it opens.
  const GIFT = 5, GIFT_CAP = 30; // gems a gift costs and gives; most gift gems a phone takes in a day
  const today = () => new Date().toISOString().slice(0, 10);
  async function send(v, w, kind) {
    if (!ON || !v.id) return false;
    const st = load();
    st.cheered = st.cheered && st.cheered.day === today() ? st.cheered : { day: today(), ids: [] };
    if (kind === 'cheer' && st.cheered.ids.includes(v.id)) { D.toast(`You cheered ${v.n || 'them'} today already`); return false; }
    if (kind === 'gift' && !D.spend(GIFT)) { D.openGems(GIFT, 'a gift'); return false; }
    try {
      const id = await token();
      const res = await fetch(`${DOCS}/inbox/${v.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${id}` },
        body: JSON.stringify({ fields: { k: str(kind), n: str(D.savedName() || 'A player'), w: str(w), by: str(auth.uid), at: { integerValue: String(Date.now()) } } }) });
      if (!res.ok) throw new Error(String(res.status));
    } catch (e) {
      if (kind === 'gift') D.addGems(GIFT); // not sent: the gems come back
      D.toast('Couldn’t send. Try again when online.');
      return false;
    }
    if (kind === 'cheer') { st.cheered.ids.push(v.id); save(st); }
    D.toast(kind === 'gift' ? `🎁 Sent ${v.n || 'them'} ${GIFT} gems` : `👏 You cheered ${v.n || 'their'} show`);
    return true;
  }
  // Your inbox: who cheered you and who sent gifts, shown once, then cleared.
  async function checkInbox() {
    if (!ON || !auth) return [];
    try {
      const id = await token();
      const res = await fetch(`${DOCS}/inbox/${auth.uid}/items?pageSize=50`, { headers: { Authorization: `Bearer ${id}` } }).then((x) => x.json());
      const docs = (res.documents || []).map((d) => ({ name: d.name, k: d.fields.k && d.fields.k.stringValue, n: D.clean(d.fields.n && d.fields.n.stringValue, 20), w: d.fields.w && d.fields.w.stringValue }));
      if (!docs.length) return [];
      const st = load();
      st.gifted = st.gifted && st.gifted.day === today() ? st.gifted : { day: today(), n: 0 };
      const cheers = docs.filter((d) => d.k === 'cheer'), gifts = docs.filter((d) => d.k === 'gift');
      const gems = Math.min(gifts.length * GIFT, Math.max(0, GIFT_CAP - st.gifted.n));
      st.gifted.n += gems;
      st.cheers = (st.cheers || 0) + cheers.length;
      save(st);
      for (const d of docs) fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${id}` } }).catch(() => {});
      const who = (list) => { const names = [...new Set(list.map((d) => d.n))]; return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '); };
      if (gems) D.addGems(gems, `gifts from ${who(gifts)}`);
      if (cheers.length) setTimeout(() => D.toast(`👏 ${who(cheers)} cheered your show${cheers.length > 1 ? 's' : ''}!`, 3600), gems ? 3200 : 0);
      return docs;
    } catch (e) { return []; }
  }

  // Remove my shows: deletes every board entry this phone has posted.
  async function removeMine() {
    const st = load(), list = st.posted || [];
    if (!ON || !auth) return 0;
    let n = 0;
    try {
      const id = await token();
      for (const b of list) {
        const res = await fetch(`${DOCS}/boards/${b}/players/${auth.uid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${id}` } });
        if (res.ok) n++;
      }
    } catch (e) { return -1; }
    st.posted = []; save(st);
    boards.clear();
    return n;
  }

  // ----- Street Pass: a month-long season. Duels earn XP; every 100 XP is a tier with a free reward, and Street Pass+
  // (150 gems, included with Premium) adds a second, richer track with the Skyburst frame at the top. -----
  const TIERS = 20, PER_TIER = 100, PASS_PLUS = 150;
  const season = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const seasonName = () => new Date().toLocaleString('en-IN', { month: 'long' });
  const daysLeft = () => { const d = new Date(), end = new Date(d.getFullYear(), d.getMonth() + 1, 1); return Math.ceil((end - d) / 864e5); };
  // [free reward, Street Pass+ reward] per tier: gems as a number, or a frame id.
  const REWARDS = Array.from({ length: TIERS }, (_, i) => {
    const t = i + 1;
    const free = t === 10 ? 'gold' : t % 5 === 0 ? 15 : t % 2 === 0 ? 5 : 0;
    const plus = t === TIERS ? 'nova' : t === 15 ? 'peacock' : t % 5 === 0 ? 30 : 10;
    return [free, plus];
  });
  function pass() {
    const st = load();
    if (!st.pass || st.pass.season !== season()) st.pass = { season: season(), xp: 0, got: [], plus: false };
    return st.pass;
  }
  const passPlus = (p = pass()) => p.plus || D.premium();
  const tierOf = (xp) => Math.min(TIERS, Math.floor(xp / PER_TIER));
  function addXp(n) {
    const st = load(), p = pass();
    const before = tierOf(p.xp);
    p.xp += n;
    st.pass = p; save(st);
    const after = tierOf(p.xp);
    if (after > before) setTimeout(() => D.toast(`🎟️ Street Pass tier ${after}! Rewards are waiting`, 3200), 1800);
    return after - before;
  }
  // A reward a tier gives: gems, or a frame added to yours.
  function grant(r) {
    if (!r) return;
    if (typeof r === 'number') { D.addGems(r, 'from the Street Pass'); return; }
    const st = load(); st.frames = [...new Set([...(st.frames || []), r])]; save(st);
    D.toast(`✨ ${FRAMES.find((f) => f[0] === r)[1]} frame unlocked`, 3000);
  }
  function claim(tier, track) {
    const st = load(), p = pass(), key = `${tier}${track}`;
    if (tierOf(p.xp) < tier || p.got.includes(key) || (track === 'p' && !passPlus(p))) return false;
    p.got.push(key); st.pass = p; save(st);
    grant(REWARDS[tier - 1][track === 'p' ? 1 : 0]);
    return true;
  }
  const rewardText = (r) => (!r ? '—' : typeof r === 'number' ? `💎${r}` : `${FRAMES.find((f) => f[0] === r)[1]} frame`);
  function passView() {
    const p = pass(), tier = tierOf(p.xp), plus = passPlus(p);
    const head = document.createElement('div');
    head.className = 'pass-head';
    const bar = document.createElement('div'); bar.className = 'pass-bar';
    const fill = document.createElement('i'); fill.style.width = `${tier >= TIERS ? 100 : (p.xp % PER_TIER)}%`; bar.append(fill);
    const meta = document.createElement('small');
    meta.textContent = tier >= TIERS ? 'Every tier reached!' : `Tier ${tier}/${TIERS} · ${p.xp % PER_TIER}/${PER_TIER} XP to tier ${tier + 1} · ${daysLeft()} days left`;
    head.append(bar, meta);
    body().append(head);
    if (!plus) {
      const buy = document.createElement('button');
      buy.type = 'button'; buy.className = 'btn primary small pass-buy';
      buy.textContent = `Unlock Street Pass+ 💎${PASS_PLUS}`;
      buy.addEventListener('click', () => {
        if (!D.spend(PASS_PLUS)) { D.openGems(PASS_PLUS, 'Street Pass+'); return; }
        const st = load(), q = pass(); q.plus = true; st.pass = q; save(st);
        D.toast('🎟️ Street Pass+ unlocked for this season'); D.celebrate();
        showSheet('pass');
      });
      body().append(buy);
    }
    const list = document.createElement('ol');
    list.className = 'pass-list';
    REWARDS.forEach(([free, prem], i) => {
      const t = i + 1, li = document.createElement('li');
      li.className = t <= tier ? 'reached' : '';
      const n = document.createElement('b'); n.textContent = t;
      li.append(n);
      for (const [r, track] of [[free, 'f'], [prem, 'p']]) {
        const c = document.createElement('button');
        c.type = 'button';
        const got = p.got.includes(`${t}${track}`), locked = track === 'p' && !plus;
        c.className = `pass-cell ${track === 'p' ? 'plus' : ''}${got ? ' got' : ''}${!got && r && t <= tier && !locked ? ' ready' : ''}`;
        const mark = document.createElement('i'); mark.textContent = got ? '✓ ' : locked && r ? '🔒 ' : '';
        const what = document.createElement('span'); what.textContent = rewardText(r);
        c.append(mark, what); // the reward in its own node, so it translates
        c.disabled = !r || got || t > tier || locked;
        c.addEventListener('click', () => { if (claim(t, track)) showSheet('pass'); });
        li.append(c);
      }
      list.append(li);
    });
    body().append(list);
  }
  function passChip() { // the pass at a glance on the Sky Duel screen
    const p = pass(), tier = tierOf(p.xp);
    const ready = REWARDS.some(([f, q], i) => i < tier && ((f && !p.got.includes(`${i + 1}f`)) || (q && passPlus(p) && !p.got.includes(`${i + 1}p`))));
    const b = document.createElement('button');
    b.type = 'button'; b.className = `pass-chip${ready ? ' ready' : ''}`;
    b.textContent = `🎟️ ${seasonName()} Street Pass · tier ${tier}/${TIERS}${ready ? ' · rewards ready!' : ''}`;
    b.addEventListener('click', () => showSheet('pass'));
    body().append(b);
  }

  // ----- The round -----
  const run = { on: false, replay: false, t: 0, t0: 0, taps: [], loadout: [], uses: [], slot: 0, world: '', vs: null, score: 0, free: false, raf: 0, next: 0 };
  let hud = null;
  function buildHud() {
    hud = document.createElement('div');
    hud.className = 'duel-hud';
    hud.innerHTML = '<div class="duel-crest">Sky Duel</div>'
      + '<div class="duel-top"><span class="duel-who"></span><span class="duel-time"><b>30</b>s</span><span class="duel-score"><b>0</b> pts</span><span class="duel-goal" hidden></span></div>'
      + '<div class="duel-crowd"><i></i></div><div class="duel-pop" aria-live="polite"></div><div class="duel-slots"></div>';
    document.body.append(hud);
  }
  function renderSlots() {
    const box = hud.querySelector('.duel-slots');
    box.innerHTML = '';
    box.hidden = run.replay;
    run.loadout.forEach((id, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `duel-slot${i === run.slot ? ' on' : ''}${run.uses[i] ? '' : ' empty'}`;
      const s = BY_ID[id];
      if (s.art) { const im = document.createElement('img'); im.src = `assets/crackers/${s.art}.webp`; im.alt = ''; im.onerror = () => { im.replaceWith(s.icon); }; b.append(im); }
      else b.append(s.icon);
      const u = document.createElement('small'); u.textContent = `${run.uses[i]}`; b.append(u);
      b.title = s.label;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (run.uses[i]) { run.slot = i; renderSlots(); } });
      box.append(b);
    });
  }
  function setWho(name, p, label) {
    const who = hud.querySelector('.duel-who');
    who.innerHTML = '';
    const nm = document.createElement('span'); nm.className = 'duel-name'; nm.textContent = label;
    who.append(avatar(p, name), nm);
  }
  function pop(ev) {
    const el = hud.querySelector('.duel-pop');
    el.textContent = `+${ev.pts} `; // the tag in a node of its own, so it translates ("Golden rain ×2": tag, then ×2)
    if (ev.tag) { const t = document.createElement('span'); t.textContent = ev.tag.replace(/ ×2$/, ''); el.append(t, / ×2$/.test(ev.tag) ? ' ×2' : ''); }
    el.classList.toggle('bad', ev.tag === 'Too crowded');
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }
  function renderHud() {
    const left = Math.max(0, Math.ceil(SECS - Math.max(0, run.t)));
    hud.querySelector('.duel-time b').textContent = run.t < 0 ? Math.ceil(-run.t) : left;
    hud.querySelector('.duel-time').style.setProperty('--p', run.t < 0 ? 1 : left / SECS); // the ring around the timer
    hud.querySelector('.duel-score b').textContent = fmt(run.score);
    hud.querySelector('.duel-crowd i').style.width = `${Math.min(100, (run.score / 5000) * 100)}%`;
    hud.classList.toggle('finale', run.t >= FINALE);
  }

  const affordable = (id) => run.free || D.premium() || !BY_ID[id].gems || BY_ID[id].gems <= D.gems();
  function begin({ world, loadout, vs = null, replay = null, free = false }) {
    if (!hud) buildHud();
    Object.assign(run, { on: true, replay: !!replay, t: -3, taps: [], loadout: loadout.slice(), uses: loadout.map(() => USES), slot: 0, world, vs, score: 0, free, next: 0, show: replay });
    D.start(world);
    hud.hidden = false;
    const goal = hud.querySelector('.duel-goal');
    goal.hidden = !vs || !!replay;
    if (vs) goal.textContent = `to beat ${fmt(vs.s)}`;
    if (replay) setWho(replay.n, replay.p, `${replay.n || 'Your friend'}’s show`);
    else setWho(D.savedName(), photo(), D.savedName() || 'You');
    run.slot = Math.max(0, run.loadout.findIndex(affordable)); // start on a cracker you can fire
    renderSlots(); renderHud();
    D.hooks.tap = replay ? null : tap;
    run.t0 = performance.now() + 3000;
    cancelAnimationFrame(run.raf);
    run.raf = requestAnimationFrame(tick);
  }
  function tap(fx, fy) {
    if (!run.on || run.replay || run.t < 0 || run.t >= SECS) return;
    let i = run.slot;
    if (!run.uses[i]) { i = run.uses.findIndex((u) => u > 0); if (i < 0) { D.toast('All your crackers are fired. Wait for the finale!'); return; } run.slot = i; }
    const id = run.loadout[i];
    // Your own show spends gems for gem crackers, as Fire does; a friend's challenge lends you their crackers free.
    const cost = run.free || D.premium() ? 0 : BY_ID[id].gems;
    if (cost && !D.spend(cost)) {
      // Never a sheet mid-show (it would cover the sky while the clock runs): say so and switch to one you can fire.
      const ok = run.uses.findIndex((u, k) => u > 0 && affordable(run.loadout[k]));
      D.toast('Not enough gems'); // (already translated in every language)
      if (ok >= 0) { run.slot = ok; renderSlots(); }
      return;
    }
    run.uses[i]--;
    if (!run.uses[i]) { const n = run.uses.findIndex((u) => u > 0); if (n >= 0) run.slot = n; }
    run.taps.push([Math.round(run.t * 10), i, Math.round(fx * 100), Math.round(fy * 100)]);
    D.fire(id, fx, fy);
    const sc = score(run.taps, run.loadout);
    run.score = sc.total;
    pop(sc.events[sc.events.length - 1]);
    renderSlots(); renderHud();
  }
  function tick(now) {
    if (!run.on) return;
    if (!D.on) { stop(true); return; } // the game ended the round (Home, another mode)
    run.t = (now - run.t0) / 1000;
    if (run.replay) {
      const taps = run.show.t;
      while (run.next < taps.length && taps[run.next][0] / 10 <= run.t) {
        const tp = taps[run.next++];
        D.fire(run.loadout[tp[1]] || 'peony', tp[2] / 100, tp[3] / 100);
        const sc = score(taps.slice(0, run.next), run.loadout);
        run.score = sc.total;
        pop(sc.events[sc.events.length - 1]);
      }
    }
    renderHud();
    if (run.t >= SECS + 1.5) { finish(); return; } // a moment for the last shells to bloom
    run.raf = requestAnimationFrame(tick);
  }
  function stop(quit) {
    run.on = false;
    D.hooks.tap = null;
    cancelAnimationFrame(run.raf);
    if (hud) hud.hidden = true;
    if (!quit) D.end();
  }
  D.hooks.quit = () => { if (run.on) stop(true); };

  function finish() {
    const replay = run.replay, r = { world: run.world, loadout: run.loadout, taps: run.taps, score: run.score, vs: run.vs };
    stop(false);
    if (replay) { showSheet('turn'); return; }
    const st = load();
    st.best = Math.max(st.best || 0, r.score);
    st.rounds = (st.rounds || 0) + 1;
    save(st);
    postBoard(r);
    r.champ = r.score > 0 && crown(r.world, { n: D.savedName(), p: photo(), f: myFrame(), s: r.score, me: true, l: r.loadout, t: r.taps });
    const won = r.vs && r.score > r.vs.s;
    // Win streak against friends and Champions: every third win in a row pays 10 gems; a loss can be saved for 10.
    if (r.vs) {
      const s2 = load();
      if (won) {
        s2.streak = (s2.streak || 0) + 1; s2.lost = 0;
        if (s2.streak % 3 === 0) D.addGems(10, `for ${s2.streak} duel wins in a row`);
      } else if (s2.streak) { s2.lost = s2.streak; s2.streak = 0; }
      save(s2);
      r.streak = s2.streak; r.lost = s2.lost || 0;
    }
    // Street Pass XP: the show's score, a win, and taking a street.
    r.xp = Math.min(150, Math.floor(r.score / 20)) + (won ? 50 : 0) + (r.champ ? 20 : 0);
    if (r.xp) addXp(r.xp);
    if (won) D.achieve('rival');
    if (won || r.champ) D.celebrate();
    last = r;
    showSheet('result');
    syncBanner();
  }

  // ----- The Sky Duel sheet: set up, a friend's invite, your turn, the result -----
  let last = null, invite = null, retries = 0;
  const sheet = $('#duelModal');
  const body = () => $('#duelCard');
  function line(cls, txt) { const e = document.createElement('div'); e.className = cls; e.textContent = txt; body().append(e); return e; }
  function loadoutPicker(l, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'duel-pick';
    const meter = document.createElement('div');
    meter.className = 'duel-budget';
    const grid = document.createElement('div');
    grid.className = 'duel-grid';
    const warn = document.createElement('div');
    warn.className = 'duel-warn';
    // Your crackers first, then the ones you can use, then Premium's (sorted once, so chips don't jump as you tap).
    const order = SHELLS.slice().sort((a, b) => (l.includes(b.id) - l.includes(a.id)) || (usable(b.id) - usable(a.id)));
    const draw = () => {
      meter.textContent = `Power ${spent(l)}/${BUDGET} · pick ${SLOTS} crackers`;
      // Gem crackers cost per shot in your own show: say so when three shots of each would cost more than you have.
      const cost = D.premium() ? 0 : l.reduce((n, id) => n + (BY_ID[id].gems || 0) * USES, 0);
      warn.hidden = !(cost > D.gems());
      if (!warn.hidden) warn.textContent = `Your gem crackers can cost up to 💎${cost} this show · you have 💎${D.gems()}`;
      grid.innerHTML = '';
      for (const s of order) {
        const b = document.createElement('button');
        b.type = 'button';
        const on = l.includes(s.id), ok = usable(s.id);
        b.className = `duel-chip${on ? ' on' : ''}${ok ? '' : ' locked'}`;
        b.textContent = `${s.icon} ${s.label}`;
        const tagEl = document.createElement('small');
        tagEl.textContent = s.premium ? '👑' : s.gems ? `💎${s.gems}` : 'free';
        b.append(tagEl);
        b.addEventListener('click', () => {
          if (!ok) { D.openPremium(); return; }
          if (on) { if (l.length > 1) l.splice(l.indexOf(s.id), 1); }
          else if (l.length >= SLOTS) D.toast(`Six crackers at most. Tap one to take it out`);
          else if (spent(l) + power(s.id) > BUDGET) D.toast(`Over the power limit (${BUDGET}). Swap a big one out`);
          else l.push(s.id);
          onChange(l); draw();
        });
        grid.append(b);
      }
    };
    draw();
    wrap.append(meter, warn, grid);
    return wrap;
  }
  function people(a, b) { // two players side by side, with their scores
    const row = document.createElement('div');
    row.className = 'duel-vs';
    for (const [p, n, s, win, fr] of [a, b]) {
      const c = document.createElement('div');
      c.className = `duel-side${win ? ' win' : ''}`;
      c.append(avatar(p, n, 'duel-ava big', fr));
      const nm = document.createElement('b'); nm.textContent = n || 'You'; c.append(nm);
      const sc = document.createElement('span'); sc.textContent = fmt(s); c.append(sc);
      row.append(c);
    }
    const v = document.createElement('i'); v.textContent = 'VS'; row.children[0].after(v);
    body().append(row);
  }
  function identity() { // your name and photo, as they will show on your street and to your friends
    const box = document.createElement('div');
    box.className = 'duel-me';
    const draw = () => {
      box.innerHTML = '';
      const a = avatar(photo(), D.savedName(), 'duel-ava big', myFrame());
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn ghost small';
      btn.textContent = photo() ? 'Change photo' : '📷 Add your photo';
      btn.addEventListener('click', async () => { await pickPhoto(); draw(); });
      const inp = document.createElement('input');
      inp.maxLength = 20; inp.placeholder = 'Your name'; inp.value = D.savedName(); inp.autocomplete = 'given-name';
      inp.addEventListener('change', () => { try { localStorage.setItem('luts:from', D.clean(inp.value, 20)); } catch (e) { /* ignore */ } });
      const col = document.createElement('div'); col.append(inp, btn);
      box.append(a, col);
    };
    draw();
    const note = document.createElement('small');
    note.className = 'duel-note';
    const shop = document.createElement('div');
    shop.className = 'duel-frames';
    const drawShop = () => {
      shop.innerHTML = '';
      for (const [id, label, cost] of FRAMES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `duel-frame${myFrame() === id ? ' on' : ''}`;
        b.append(avatar(photo(), D.savedName(), 'duel-ava', id));
        const t = document.createElement('small');
        t.textContent = owns(id) ? label : cost === null ? `${label} 🎟️` : cost === -1 ? `${label} 🏆` : `${label} 💎${cost}`;
        b.append(t);
        b.addEventListener('click', () => {
          if (!owns(id) && cost === null) { showSheet('pass'); return; } // won on the Street Pass+ track
          if (!owns(id) && cost === -1) { D.toast('Pull off 5 street heists in Fireworks Street to earn this frame', 3200); return; }
          if (!owns(id)) {
            if (!D.spend(cost)) { D.openGems(cost, `the ${label} frame`); return; }
            const st0 = load(); st0.frames = [...new Set([...(st0.frames || []), id])]; save(st0);
            D.toast(`✨ ${label} frame is yours`);
          }
          const st = load(); st.frame = id; save(st);
          drawShop(); draw();
        });
        shop.append(b);
      }
    };
    drawShop();
    body().append(shop);
    note.textContent = ON ? 'Shown on the street’s weekly board to everyone who plays it, and to the friends you challenge.' : 'Shown on your street when you’re its Champion, and to the friends you challenge.';
    body().append(box, note);
  }

  // This week's best shows on the street: tap one to watch it and take it on.
  function streetBoard(w) {
    const box = document.createElement('div');
    box.className = 'duel-board';
    const h = document.createElement('b'); h.textContent = `🏆 This week on ${D.placeName(w)}`;
    const list = document.createElement('ol'); list.textContent = 'Loading…';
    box.append(h, list);
    body().append(box);
    board(w).then((rows) => {
      list.innerHTML = '';
      if (!rows.length) { list.textContent = 'No shows yet this week. Be the first Champion!'; return; }
      rows.slice(0, 10).forEach((v, i) => {
        const li = document.createElement('li');
        if (v.me) li.className = 'me';
        const rank = document.createElement('i'); rank.textContent = i === 0 ? '👑' : `${i + 1}`;
        const nm = document.createElement('span'); nm.textContent = v.me ? `${v.n || 'You'} (you)${load().cheers ? ` · 👏 ${load().cheers}` : ''}` : v.n || 'Player';
        const sc = document.createElement('b'); sc.textContent = fmt(v.s);
        li.append(rank, avatar(v.p, v.n, 'duel-ava', v.f), nm, sc);
        if (!v.me) {
          li.addEventListener('click', () => { invite = v; retries = 0; showSheet('invite'); });
          const cheer = document.createElement('button');
          cheer.type = 'button'; cheer.className = 'duel-act'; cheer.textContent = '👏'; cheer.title = `Cheer ${v.n || 'their'} show`;
          cheer.addEventListener('click', async (e) => { e.stopPropagation(); if (await send(v, w, 'cheer')) cheer.classList.add('done'); });
          const gift = document.createElement('button');
          gift.type = 'button'; gift.className = 'duel-act'; gift.textContent = '🎁'; gift.title = `Send ${v.n || 'them'} ${GIFT} gems`;
          gift.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(tr(`Send ${v.n || 'this player'} a gift of ${GIFT} gems? It costs you ${GIFT} gems.`))) return;
            if (await send(v, w, 'gift')) gift.classList.add('done');
          });
          li.append(cheer, gift);
          const flag = document.createElement('button');
          flag.type = 'button'; flag.className = 'duel-flag'; flag.textContent = '⚑'; flag.title = 'Report this name or photo';
          flag.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(tr(`Report ${v.n || 'this player'}’s name or photo as offensive? They’ll be hidden for you.`))) return;
            report(v, w); li.remove(); D.toast('Reported. Thank you for keeping the streets friendly.');
          });
          li.append(flag);
        }
        list.append(li);
      });
      if (rows.some((v) => v.me) || (load().posted || []).length) {
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'duel-remove'; rm.textContent = 'Remove my shows';
        rm.addEventListener('click', async () => {
          if (!confirm(tr('Remove your name, photo and shows from every street board?'))) return;
          const n = await removeMine();
          D.toast(n < 0 ? 'Couldn’t reach the boards. Try again when online.' : 'Your shows are removed from the boards.');
          if (n >= 0) showSheet('setup', w);
        });
        box.append(rm);
      }
      const mine = rows.findIndex((v) => v.me);
      if (mine >= 10) { const e = document.createElement('small'); e.className = 'duel-note'; e.textContent = `You’re #${mine + 1} this week`; box.append(e); }
      syncBanner();
    });
  }

  let go = null; // what the main button does
  function showSheet(state, w) {
    body().innerHTML = '';
    let title = 'Sky Duel', sub = '', goText = 'Start the show', chal = false, steal = null;
    const world = w || D.world(), champ = champOf(world);
    if (state === 'setup' || state === 'champ') {
      const l = myLoadout();
      sub = `30 seconds over ${D.placeName(world)}. The crowd scores rhythm, variety, combos and your finale.`;
      if (champ && !champ.me) {
        const c = line('duel-champline', '');
        c.append(avatar(champ.p, champ.n), document.createTextNode(` 👑 ${champ.n || 'A friend'} rules this street with ${fmt(champ.s)}`));
      } else if (champ) line('duel-champline', `👑 You’re the Champion here · ${fmt(champ.s)}`);
      passChip();
      identity();
      if (ON) streetBoard(world);
      body().append(loadoutPicker(l, (v) => { const st = load(); st.loadout = v.slice(); save(st); }));
      const vs = champ && !champ.me ? { n: champ.n, p: champ.p, s: champ.s } : null;
      go = () => { const ld = myLoadout(); if (ld.length < 2) { D.toast('Pick at least two crackers'); return; } D.closeSheet(sheet); begin({ world, loadout: ld, vs }); };
      if (vs) goText = `Beat ${fmt(vs.s)}`;
    } else if (state === 'pass') {
      title = `🎟️ ${seasonName()} Street Pass`;
      sub = 'Every Sky Duel earns XP: your show’s score, +50 for a win, +20 for taking a street.';
      passView();
      goText = 'Play a duel';
      go = () => showSheet('setup');
    } else if (state === 'invite') {
      const v = invite;
      title = `${v.n || 'A friend'} challenges you!`;
      sub = `Watch ${v.n ? `${v.n}’s` : 'their'} show over ${D.placeName(v.w)}, then beat it with the same crackers. Free to play.`;
      people([v.p, v.n || 'Friend', v.s, true, v.f], [photo(), D.savedName() || 'You', 0, false, myFrame()]);
      line('duel-meta', v.l.map((id) => BY_ID[id].icon).join(' '));
      goText = '▶ Watch their show';
      if (!D.native()) { goText = 'Get the app to play'; sub = `Install Light Up the Skies to watch ${v.n ? `${v.n}’s` : 'their'} show over ${D.placeName(v.w)} and beat it.`; go = toApp; } else go = () => { D.closeSheet(sheet); begin({ world: v.w, loadout: v.l, replay: v, vs: v }); };
    } else if (state === 'turn') {
      const v = invite;
      title = 'Your turn!';
      sub = `Beat ${fmt(v.s)} with ${v.n ? `${v.n}’s` : 'their'} crackers. They’re yours free for this duel.`;
      identity();
      goText = `Beat ${fmt(v.s)}`;
      go = () => { D.closeSheet(sheet); retries = 0; begin({ world: v.w, loadout: v.l, vs: v, free: true }); };
    } else {
      const r = last, won = r.vs && r.score > r.vs.s;
      if (r.vs) {
        title = won ? 'You won! 🥇' : r.score === r.vs.s ? 'A perfect tie!' : 'So close!';
        people([photo(), D.savedName() || 'You', r.score, won, myFrame()], [r.vs.p, r.vs.n || 'Friend', r.vs.s, !won, r.vs.f]);
        if (!won) steal = r.vs;
      } else {
        title = r.champ ? `👑 Champion of ${D.placeName(r.world)}!` : 'What a show!';
        line('rush-big', fmt(r.score));
      }
      line('rush-stars', starText(stars(r.score)));
      if (r.vs && r.streak > 1) line('duel-meta duel-pill fire', `🔥 ${r.streak} wins in a row${r.streak % 3 ? ` · ${3 - (r.streak % 3)} more for 💎10` : ''}`);
      if (r.vs && r.lost >= 2 && load().lost === r.lost) {
        const keep = document.createElement('button');
        keep.type = 'button'; keep.className = 'btn ghost small';
        keep.textContent = D.premium() ? `Keep your ${r.lost}-win streak (Premium)` : `Keep your ${r.lost}-win streak 💎10`;
        keep.addEventListener('click', () => {
          if (!D.premium() && !D.spend(10)) { D.openGems(10, 'your streak'); return; }
          const s3 = load(); s3.streak = s3.lost; s3.lost = 0; save(s3);
          keep.remove(); D.toast(`🔥 ${s3.streak}-win streak kept`);
        });
        body().append(keep);
      }
      const ev = score(r.taps, r.loadout).events.filter((e) => e.tag && e.tag !== 'Too crowded' && e.tag !== 'Rhythm');
      line('duel-meta', `${r.taps.length} shells${ev.length ? ` · best moment: ${ev.sort((a, b) => b.pts - a.pts)[0].tag}` : ''}`);
      if (r.xp) line('duel-meta duel-pill xp', `🎟️ +${r.xp} Street Pass XP`);
      if (r.champ) line('duel-meta', ON ? 'Your name and photo now hang over this street, for everyone who plays here this week.' : 'Your name and photo now hang over this street.');
      sub = r.vs ? `Over ${D.placeName(r.world)}` : 'Dare a friend to beat it, with the very same crackers.';
      chal = true;
      // A rematch of a friend's challenge: the first is free, then 💎5 each (free with Premium).
      const paid = r.vs && retries >= 1 && !D.premium();
      goText = r.vs ? (paid ? `Rematch 💎${RETRY_GEMS}` : 'Rematch') : 'Play again';
      go = () => {
        if (paid && !D.spend(RETRY_GEMS)) { D.openGems(RETRY_GEMS, 'a rematch'); return; }
        if (r.vs) retries++;
        D.closeSheet(sheet);
        begin({ world: r.world, loadout: r.loadout, vs: r.vs, free: !!(r.vs && invite) });
      };
    }
    $('#duelTitle').textContent = title;
    $('#duelSub').textContent = sub;
    $('#btnDuelGo').lastChild.textContent = goText;
    $('#btnDuelChallenge').hidden = !chal;
    $('#btnDuelSteal').hidden = !steal;
    $('#btnDuelSteal').onclick = steal ? () => { const st = load(); st.loadout = steal.l.slice(); save(st); D.toast(`Saved ${steal.n ? `${steal.n}’s` : 'their'} crackers as yours: ${steal.l.map((id) => BY_ID[id].icon).join(' ')}`, 3200); } : null;
    D.openSheet(sheet);
  }
  $('#btnDuelGo').addEventListener('click', () => { if (go) go(); });
  $('#btnDuelHome').addEventListener('click', () => { D.closeSheet(sheet); D.home(); });
  sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) D.closeSheet(sheet); });
  // Duels are played in the app only: on the web, the tile and a friend's link send you to Google Play.
  const toApp = () => { D.toApp('duel'); };
  $('#btnDuel').addEventListener('click', () => (D.native() ? showSheet('setup') : toApp()));

  // ----- Challenge links: #duel=<b64 JSON> with your name, photo, crackers, taps and score -----
  $('#btnDuelChallenge').addEventListener('click', async () => {
    const r = last;
    if (!r) return;
    const name = D.savedName(), p = photo();
    const link = D.link(`duel=${D.encode({ n: name, p, f: myFrame(), w: r.world, l: r.loadout, t: r.taps, s: r.score })}`);
    const who = name || 'I';
    const won = r.vs && r.score > r.vs.s;
    const text = won ? `🥇 ${who} beat ${r.vs.n || 'your'}${r.vs.n ? '’s' : ''} ${fmt(r.vs.s)} with a ${fmt(r.score)} fireworks show! Your turn:`
      : `🎆 ${who} lit up ${D.placeName(r.world)} for ${fmt(r.score)} points. Watch my show and beat it, same crackers:`;
    const blob = D.card({ art: p || D.worldArt(r.world), kicker: won ? `${who} won the Sky Duel` : `${name || 'A friend'} challenges you`, title: 'Sky Duel', big: fmt(r.score), stars: stars(r.score), line: `${r.loadout.map((id) => BY_ID[id].icon).join(' ')} · ${D.placeName(r.world)}` });
    D.share({ title: 'Sky Duel', text, url: link, blob, name: 'sky-duel.png', src: 'duel' });
  });
  function readHash() {
    const m = location.hash.match(/duel=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return readShow(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0)))));
    } catch (e) { return null; }
  }
  // A show from a link or a street board, checked: known crackers, at most 18 taps in 30 seconds, and the score worked
  // out again from the taps, so an edited link or entry can't claim more than its show.
  function readShow(raw) {
    try {
      const worlds = D.worlds().map((w) => w.id);
      const l = (Array.isArray(raw.l) ? raw.l : []).filter((id) => BY_ID[id]).slice(0, SLOTS);
      if (l.length < 2) return null;
      const n = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v) || 0));
      const t = (Array.isArray(raw.t) ? raw.t : []).slice(0, SLOTS * USES).filter((x) => Array.isArray(x) && x.length === 4)
        .map((x) => [n(x[0], 0, SECS * 10), n(x[1], 0, l.length - 1), n(x[2], 0, 100), n(x[3], 8, 72)]).sort((a, b) => a[0] - b[0])
        .filter((x, i, all) => all.slice(0, i + 1).filter((y) => y[1] === x[1]).length <= USES); // three shots a cracker
      return { n: D.clean(raw.n, 20), p: safePhoto(raw.p), f: safeFrame(raw.f), w: worlds.includes(raw.w) ? raw.w : worlds[0], l, t, s: score(t, l).total };
    } catch (e) { return null; }
  }
  function openFromHash() {
    const v = readHash();
    if (!v) return false;
    invite = v; retries = 0;
    crown(v.w, { n: v.n, p: v.p, f: v.f, s: v.s, me: false, l: v.l, t: v.t });
    syncBanner();
    showSheet('invite');
    return true;
  }
  window.addEventListener('hashchange', () => { if (!run.on) openFromHash(); });

  // ----- The Champion banner over the street: their photo, name and score, tap to take them on -----
  const banner = document.createElement('button');
  banner.type = 'button';
  banner.className = 'duel-champ';
  banner.hidden = true;
  document.body.append(banner);
  banner.addEventListener('click', () => showSheet('champ'));
  let shownFor = '';
  function syncBanner() {
    const home = document.body.classList.contains('home'), busy = document.body.classList.contains('rushing') || document.body.classList.contains('chor');
    const w = D.world();
    if (ON && !home && !busy) board(w).then(() => { if (D.world() === w) setTimeout(syncBanner, 0); }); // cached two minutes
    const c = !home && !busy ? champOf(w) : null;
    banner.hidden = !c;
    if (!c) { shownFor = ''; return; }
    const key = `${w}|${c.n}|${c.s}|${c.p.length}`;
    if (key === shownFor) return;
    shownFor = key;
    banner.innerHTML = '';
    const txt = document.createElement('span');
    const b = document.createElement('b'); b.textContent = `👑 ${c.me ? (c.n || 'You') : c.n || 'A friend'}`;
    const s = document.createElement('small'); s.textContent = `Champion of ${D.placeName(w)} · ${fmt(c.s)}`;
    txt.append(b, s);
    banner.append(avatar(c.p, c.n, 'duel-ava', c.f), txt);
  }
  setInterval(syncBanner, 800);

  // For the browser tests.
  window.LUTSDuelTest = { pass, addXp, claim, REWARDS, send, checkInbox, FRAMES, myFrame, online: ON, report, removeMine, board, boardId, score, readHash, begin, tap, run, champOf, power, BUDGET, myLoadout, last: () => last, finish };
  setTimeout(() => { if (/duel=/.test(location.hash)) openFromHash(); syncBanner(); }, 0);
  if (ON && auth) setTimeout(checkInbox, 4000); // after the opening moment; only a phone that has posted has an inbox
})();
