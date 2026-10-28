// Mela Night: fireworks together, up to four people over a temple's sky (home screen, Challenges row).
//  - Play online: joins an open room at that temple (or opens one; if nobody comes in 30 seconds, two computer players
//    join, marked 🤖). Play with friends: a private room with a code and a WhatsApp invite (#room=CODE). Practice: you
//    and three computer players.
//  - The show is 60 seconds on the sky of Sky Duel (LUTSDuel.start): your taps fire your crackers, everyone's bursts
//    appear on every phone, and you tap a player's chip to send them a heart. Most hearts wins.
//  - Live on Firebase Realtime Database (rules: firebase/database.rules.json), signed in with the same anonymous id as the
//    street boards. Phones say they're online every minute, so the home screen shows how many are playing.
(() => {
  const DB = window.LUTS_RTDB || 'https://light-up-the-skies-default-rtdb.asia-southeast1.firebasedatabase.app';
  const D = () => window.LUTSDuel, fb = () => (window.LUTSBoards && window.LUTSBoards.fb) || null;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PLACES = [['meenakshi-amman-temple', 'Madurai'], ['gateway-of-india', 'Mumbai, Maharashtra'], ['golden-temple', 'Amritsar'], ['brihadeeswarar-temple', 'Thanjavur']];
  // Street race rooms: Fireworks Street's streets by those temples (same stashes for everyone in the room)
  const RACE_PLACES = [['chor-meenakshi', 'meenakshi-amman-temple', 'Pudhu Mandapam Street · Madurai'], ['chor-gateway', 'gateway-of-india', 'Colaba · Gateway of India'],
    ['chor-goldentemple', 'golden-temple', 'Heritage Street · Amritsar'], ['chor-street', '', 'Bazaar']];
  const RACE_CAP = 240, RACE_GRACE = 45; // a race ends at four minutes, or 45 seconds after the first one home
  const COLORS = ['#ff5fa2', '#50a0ff', '#2fd9a0', '#ffb046'];
  const SECS = 60, SEATS = ['s0', 's1', 's2', 's3'], BOT_NAMES = ['Bot Diya', 'Bot Ravi', 'Bot Meena'];
  const SHOWS_PAID = 5, KEY = 'luts:mela';
  const today = () => new Date().toISOString().slice(0, 10);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  // ---------- Realtime Database over REST (no SDK): writes with fetch, the room streamed with EventSource ----------
  let offset = 0; // server clock minus this phone's
  const now = () => Date.now() + offset;
  async function req(method, path, body, query = '') {
    const f = fb();
    if (!f || !f.on) throw new Error('offline');
    const tok = await f.token();
    const res = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(tok)}${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  const SV = { '.sv': 'timestamp' };
  async function syncClock() {
    const f = fb();
    if (!f || !f.on) return;
    await f.token();
    const t0 = Date.now(), r = await req('PUT', `online/${f.uid()}`, { w: place, at: SV }).catch(() => null);
    if (r && typeof r.at === 'number') offset = r.at - (t0 + Date.now()) / 2;
  }
  const me = () => (fb() ? fb().uid() : '');

  // ---------- Who's online: a heartbeat every minute, counted per place ----------
  let place = 'home', counts = { all: 0 }, countsAt = 0;
  async function beat() {
    if (document.hidden || !fb() || !fb().on) return;
    try { await req('PUT', `online/${me()}`, { w: place, at: SV }); } catch (e) { /* offline */ }
  }
  async function readCounts() {
    if (Date.now() - countsAt < 50e3) return counts;
    try {
      const v = await req('GET', 'online', undefined, `&orderBy=%22at%22&startAt=${Math.round(now() - 150e3)}`) || {};
      counts = { all: 0 };
      for (const k of Object.keys(v)) { counts.all++; const w = v[k] && v[k].w; if (w) counts[w] = (counts[w] || 0) + 1; }
      countsAt = Date.now();
    } catch (e) { /* keep the last */ }
    return counts;
  }
  // The home card: a count once enough are playing to mean something, else an invitation (never a made-up number).
  async function renderHomeCount() {
    const el = $('#melaCount');
    if (!el) return;
    const c = await readCounts();
    el.textContent = c.all >= 10 ? `🟢 ${c.all.toLocaleString('en-IN')} playing now` : 'Up to 4 at a temple';
  }

  // ---------- The room: a local copy kept in step with the stream ----------
  let room = null; // { code, data, src, host, pub, seat, ... }
  function setAt(obj, path, val) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return val;
    let o = obj || {};
    const root = o;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] && typeof o[parts[i]] === 'object' ? o[parts[i]] : {}; o = o[parts[i]]; }
    if (val === null) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = val;
    return root;
  }
  async function listen(code) {
    const tok = await fb().token();
    const src = new EventSource(`${DB}/rooms/${code}.json?auth=${encodeURIComponent(tok)}`);
    const on = (kind) => (e) => {
      if (!room || room.code !== code) return;
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (!m) return;
      if (kind === 'put') {
        if (m.path === '/') { room.data = m.data || {}; if (room.ready) room.ready(); }
        else room.data = setAt(room.data || {}, m.path, m.data);
        if (/^\/ev\/[^/]+$/.test(m.path) && m.data) remoteEv(m.path.slice(4), m.data);
      } else {
        for (const k of Object.keys(m.data || {})) {
          const p = `${m.path.replace(/\/$/, '')}/${k}`;
          room.data = setAt(room.data || {}, p, m.data[k]);
          if (/^\/ev\/[^/]+$/.test(p) && m.data[k]) remoteEv(k, m.data[k]);
        }
      }
      changed();
    };
    src.addEventListener('put', on('put'));
    src.addEventListener('patch', on('patch'));
    src.addEventListener('cancel', () => { if (room && room.code === code) gone(); });
    return src;
  }
  const players = () => SEATS.map((s) => (room && room.data && room.data.players && room.data.players[s]) ? { seat: s, ...room.data.players[s] } : null);
  const meta = () => (room && room.data && room.data.meta) || {};
  const isHost = () => !!room && meta().host === me();

  let mode = 'show';
  const isRace = () => meta().mode === 'race';
  const placeOf = (w) => { const rp = RACE_PLACES.find((x) => x[0] === w); return rp ? rp[2] : D().placeName(w); };
  async function create(w, pub) {
    await syncClock();
    for (let tries = 0; tries < 5; tries++) {
      const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
      const exists = await req('GET', `rooms/${code}/meta`).catch(() => null);
      if (exists) continue;
      await req('PUT', `rooms/${code}/meta`, { host: me(), w, pub: !!pub, mode, state: 'lobby', at: SV });
      await req('PUT', `rooms/${code}/players/s0`, { u: me(), n: myName(), c: 0 });
      if (pub) await req('PUT', `open/${w}/${code}`, { n: 1, at: SV, host: me() });
      return code;
    }
    throw new Error('no code');
  }
  const myName = (seat = 0) => ((D() && D().savedName()) || `Player ${seat + 1}`).slice(0, 20);
  async function join(code) {
    await syncClock();
    const data = await req('GET', `rooms/${code}`);
    if (!data || !data.meta) throw new Error('none');
    if (data.meta.state !== 'lobby') throw new Error('started');
    const ps = data.players || {};
    const mine = SEATS.find((s) => ps[s] && ps[s].u === me());
    if (mine) return { code, w: data.meta.w };
    for (const s of SEATS) {
      if (ps[s]) continue;
      try { await req('PUT', `rooms/${code}/players/${s}`, { u: me(), n: myName(SEATS.indexOf(s)), c: SEATS.indexOf(s) }); return { code, w: data.meta.w }; } catch (e) { /* taken a moment ago: the next seat */ }
    }
    throw new Error('full');
  }
  async function enter(code, w, watcher = false) {
    leave(true);
    room = { code, w, data: null, fired: new Set(), started: false, bots: [], hearted: {}, launches: {}, made: Date.now(), watcher };
    place = w; beat();
    const first = new Promise((res) => { room.ready = res; setTimeout(res, 8000); });
    room.src = await listen(code);
    await first;
    view('lobby');
  }
  function leave(quiet) {
    if (!room) return;
    const r = room;
    room = null;
    try { r.src && r.src.close(); } catch (e) { /* closed */ }
    clearInterval(r.botTimer); clearTimeout(r.autoTimer);
    if (show.on) stopShow(true);
    if (race.on) stopRace(true);
    place = 'home'; beat();
    // The host closes the room (and its open listing); a guest gives up the seat.
    const mySeat = SEATS.find((s) => r.data && r.data.players && r.data.players[s] && r.data.players[s].u === me());
    if (r.data && r.data.meta && r.data.meta.host === me()) { req('DELETE', `open/${r.w}/${r.code}`).catch(() => {}); req('DELETE', `live/${r.code}`).catch(() => {}).finally(() => req('DELETE', `rooms/${r.code}`).catch(() => {})); } // (live first: its rule asks the room)
    else if (mySeat && (!r.data.meta || r.data.meta.state === 'lobby')) req('DELETE', `rooms/${r.code}/players/${mySeat}`).catch(() => {});
    if (r.watcher) req('DELETE', `rooms/${r.code}/watch/${me()}`).catch(() => {});
    if (!quiet) view('pick');
  }
  function gone() {
    if (!room || show.on || room.ended) return;
    room = null; place = 'home';
    D().toast('The room was closed');
    view('pick');
  }

  // ---------- The ways in ----------
  const pick = { show: PLACES[0][0], race: RACE_PLACES[0][0] };
  let pickW = pick.show;
  async function playOnline() {
    busy(true);
    try {
      const w = pickW;
      await syncClock();
      const open = await req('GET', `open/${w}`, undefined, `&orderBy=%22at%22&startAt=${Math.round(now() - 90e3)}`).catch(() => null) || {};
      for (const code of Object.keys(open).filter((c) => open[c].n < 4 && open[c].host !== me())) {
        try { const r = await join(code); await enter(r.code, r.w); return; } catch (e) { /* full or started: the next */ }
      }
      const code = await create(w, true);
      await enter(code, w);
      // Nobody in 30 seconds: two computer players join and the show starts.
      room.autoTimer = setTimeout(() => { if (room && meta().state === 'lobby' && isHost()) fillBots(2).then(startShow); }, 30e3);
    } catch (e) { D().toast('Couldn’t reach the mela. Check the internet and try again.'); }
    finally { busy(false); }
  }
  async function withFriends() {
    busy(true);
    try { const code = await create(pickW, false); await enter(code, pickW); invite(); }
    catch (e) { D().toast('Couldn’t reach the mela. Check the internet and try again.'); }
    finally { busy(false); }
  }
  async function practice() {
    busy(true);
    try { const code = await create(pickW, false); await enter(code, pickW); await fillBots(3); await startShow(); }
    catch (e) { D().toast('Couldn’t reach the mela. Check the internet and try again.'); }
    finally { busy(false); }
  }
  // A visitor: no seat, just a place in the crowd (any number). They see the show live, send hearts, and in a street
  // race watch everyone from the drone.
  async function watch(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    busy(true);
    try {
      await syncClock();
      const data = await req('GET', `rooms/${code}`);
      if (!data || !data.meta || data.meta.state === 'done') throw new Error('none');
      await req('PUT', `rooms/${code}/watch/${me()}`, { n: myName(4), at: SV });
      await enter(code, data.meta.w, true);
      if (data.meta.state === 'show') changed(); // already on: straight in
    } catch (e) { D().toast('That show has ended'); view('pick'); }
    finally { busy(false); }
  }
  async function joinCode(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) { D().toast('Enter the 4-letter room code'); return; }
    busy(true);
    try { const r = await join(code); await enter(r.code, r.w); }
    catch (e) { if (e.message === 'full' || e.message === 'started') { D().toast(e.message === 'full' ? 'That room is full. You can watch' : 'That show has started. You can watch', 3000); busy(false); watch(code); return; } D().toast('No room with that code'); }
    finally { busy(false); }
  }
  function invite() {
    if (!room) return;
    const name = placeOf(room.w);
    D().share({ title: 'Mela Night', text: isRace() ? `⏱ Race me down ${name} in Fireworks Street! Room code ${room.code} 🧨\nTap to join:` : `🛕 Join my Diwali fireworks at ${name}! Room code ${room.code} 🎆\nTap to join:`, url: D().link(`room=${room.code}`), src: 'room' });
  }
  async function fillBots(n) {
    if (!room || !isHost()) return;
    const ps = players();
    let k = 0;
    for (let i = 0; i < SEATS.length && k < n; i++) {
      if (ps[i]) continue;
      const id = `bot${i}`;
      await req('PUT', `rooms/${room.code}/players/${SEATS[i]}`, { u: id, n: BOT_NAMES[k % 3], c: i, bot: true }).catch(() => {});
      k++;
    }
  }
  async function startShow() {
    if (!room || !isHost() || meta().state !== 'lobby') return;
    const r = room;
    clearTimeout(r.autoTimer);
    await req('PATCH', `rooms/${r.code}/meta`, { state: 'show', start: Math.round(now() + 4000) }).catch(() => {});
    req('DELETE', `open/${r.w}/${r.code}`).catch(() => {});
    if (meta().pub) req('PUT', `live/${r.code}`, { w: r.w, mode: meta().mode || 'show', n: players().filter(Boolean).length, at: SV }).catch(() => {});
  }

  // ---------- Something changed in the room ----------
  function changed() {
    if (!room || !room.data) return;
    const m = meta();
    if (m.state === 'show' && m.start && !room.started) { room.started = true; if (m.mode === 'race') beginRace(); else beginShow(); }
    if (show.on) renderChips();
    if (race.on) renderBoard();
    else if (curView === 'lobby') renderLobby();
    // The host keeps the open listing's head count right, and starts an online room once four are in.
    if (isHost() && m.state === 'lobby') {
      const n = players().filter(Boolean).length;
      if (m.pub) req('PATCH', `open/${room.w}/${room.code}`, { n }).catch(() => {});
      if (m.pub && n >= 4) startShow();
      else if (m.pub && n >= 2 && !room.soon) { room.soon = true; clearTimeout(room.autoTimer); room.autoTimer = setTimeout(startShow, 12e3); }
    }
  }

  // ---------- The show ----------
  const show = { on: false, raf: 0, slot: 0, last: 0, t: -4 };
  let hud = null;
  const shells = () => { const all = D().shells().filter((s) => !s.gems && !s.premium); return (all.length ? all : D().shells()).slice(0, 4); };
  function buildHud() {
    hud = document.createElement('div');
    hud.className = 'mela-hud';
    hud.innerHTML = `<div class="mela-top"><button type="button" class="mela-x" aria-label="Leave">✕</button><div class="mela-place"></div><div class="mela-time"><b>60</b></div></div>
      <div class="mela-chips"></div><p class="mela-tip">Tap the sky to fire · tap a friend to send ❤️</p><div class="mela-shells"></div><div class="mela-count"></div>`;
    document.body.append(hud);
    hud.querySelector('.mela-x').addEventListener('click', () => { leave(true); view('pick'); D().home(); });
  }
  function beginShow() {
    if (!hud) buildHud();
    D().closeSheet($('#melaModal'));
    show.on = true; show.slot = 0;
    document.body.classList.add('mela-on');
    D().start(room.w);
    D().hooks.tap = tap;
    hud.hidden = false;
    hud.querySelector('.mela-place').textContent = D().placeName(room.w);
    hud.classList.toggle('watching', !!room.watcher);
    hud.querySelector('.mela-tip').textContent = room.watcher ? '👀 You’re watching · tap a player to send ❤️' : 'Tap the sky to fire · tap a friend to send ❤️';
    const box = hud.querySelector('.mela-shells');
    box.innerHTML = '';
    shells().forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `mela-shell${i === 0 ? ' on' : ''}`; b.title = s.label;
      b.innerHTML = s.art ? `<img src="assets/crackers/${esc(s.art)}.webp" alt="">` : `<span>${esc(s.icon)}</span>`;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); show.slot = i; box.querySelectorAll('.mela-shell').forEach((x, k) => x.classList.toggle('on', k === i)); });
      box.append(b);
    });
    renderChips();
    if (isHost()) startBots();
    cancelAnimationFrame(show.raf);
    show.raf = requestAnimationFrame(frame);
  }
  function frame() {
    if (!show.on || !room) return;
    if (!D().on) { leave(true); view('pick'); return; } // the game ended the round (Home)
    if (!room.data || !room.data.meta) { const r = room; stopShow(false); room = null; try { r.src.close(); } catch (e) { /* closed */ } D().toast('The host left the mela'); return; }
    show.t = (now() - meta().start) / 1000;
    const tEl = hud.querySelector('.mela-time b');
    tEl.textContent = show.t < 0 ? Math.ceil(-show.t) : Math.max(0, Math.ceil(SECS - show.t));
    hud.classList.toggle('counting', show.t < 0);
    if (show.t >= SECS + 2) { endShow(); return; }
    show.raf = requestAnimationFrame(frame);
  }
  function tap(fx, fy) {
    if (!show.on || !room || room.watcher || show.t < 0 || show.t >= SECS) return;
    const t = performance.now();
    if (t - show.last < 260) return; // at most about four a second
    show.last = t;
    const s = shells()[show.slot] || shells()[0];
    D().fire(s.id, fx, fy);
    room.launches[me()] = (room.launches[me()] || 0) + 1;
    req('POST', `rooms/${room.code}/ev`, { u: me(), s: s.id, x: Math.round(fx * 1000), y: Math.round(fy * 1000) }).catch(() => {});
  }
  function remoteEv(id, ev) {
    if (!room || room.fired.has(id)) return;
    room.fired.add(id);
    if (race.on && ev.u !== me() && window.PatakaChor) { PatakaChor.remoteBang(String(ev.s), ev.x / 10, ev.y / 10); if (room.watcher) camTo(ev.x / 10, ev.y / 10); return; } // a racer's cracker on the street
    if (!show.on || ev.u === me() || show.t < -0.5 || show.t > SECS + 1) return;
    room.launches[ev.u] = (room.launches[ev.u] || 0) + 1;
    D().fire(String(ev.s), Math.min(1, Math.max(0, ev.x / 1000)), Math.min(0.75, Math.max(0.05, ev.y / 1000)));
  }
  const heartsOf = (uid) => { const h = room && room.data && room.data.hearts && room.data.hearts[uid]; return h ? Object.values(h).reduce((a, b) => a + (+b || 0), 0) : 0; };
  function renderChips() {
    const box = hud.querySelector('.mela-chips');
    box.innerHTML = '';
    for (const p of players()) {
      if (!p) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = `mela-chip${p.u === me() ? ' me' : ''}`;
      b.style.setProperty('--c', COLORS[p.c % 4]);
      b.innerHTML = `<i></i><span translate="no">${esc(p.n)}${p.bot ? ' 🤖' : ''}</span><b>❤️ ${heartsOf(p.u)}</b>`;
      if (p.u !== me()) b.addEventListener('pointerdown', (e) => { e.stopPropagation(); heart(p.u, b); });
      box.append(b);
    }
  }
  function heart(uid, b) {
    if (!room || !show.on || show.t < 0 || show.t > SECS) return;
    const t = performance.now();
    if (t - (room.hearted[uid + ':t'] || 0) < 1500) return;
    room.hearted[uid + ':t'] = t;
    const n = (room.hearted[uid] || 0) + 1;
    if (n > 60) return;
    room.hearted[uid] = n;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    req('PUT', `rooms/${room.code}/hearts/${uid}/${me()}`, n).catch(() => { room.hearted[uid] = n - 1; });
  }
  // The host plays the computer players: a cracker every second or so, and now and then a heart for someone.
  function startBots() {
    const r = room, bh = {};
    r.botTimer = setInterval(() => {
      if (room !== r || !show.on || show.t < 0 || show.t >= SECS) return;
      const ps = players().filter(Boolean), bots = ps.filter((p) => p.bot);
      for (const b of bots) {
        if (Math.random() < 0.55) {
          const s = shells()[Math.floor(Math.random() * shells().length)];
          req('POST', `rooms/${r.code}/ev`, { u: b.u, s: s.id, x: Math.round(150 + Math.random() * 700), y: Math.round(120 + Math.random() * 380) }).catch(() => {});
        }
        if (Math.random() < 0.09) {
          const others = ps.filter((p) => p.u !== b.u), to = others[Math.floor(Math.random() * others.length)];
          if (!to) continue;
          const k = `${to.u}/${b.u}`; bh[k] = (bh[k] || 0) + 1;
          if (bh[k] <= 60) req('PUT', `rooms/${r.code}/hearts/${k}`, bh[k]).catch(() => {});
        }
      }
    }, 700);
  }
  function stopShow(quit) {
    show.on = false;
    document.body.classList.remove('mela-on');
    cancelAnimationFrame(show.raf);
    if (room) clearInterval(room.botTimer);
    if (D().hooks.tap === tap) D().hooks.tap = null;
    if (hud) hud.hidden = true;
    if (!quit && D().on) D().end();
  }
  function endShow() {
    stopShow(false);
    room.ended = true;
    clearInterval(room.botTimer);
    if (isHost()) { req('PATCH', `rooms/${room.code}/meta`, { state: 'done' }).catch(() => {}); req('DELETE', `live/${room.code}`).catch(() => {}); }
    const ranked = players().filter(Boolean).map((p) => ({ ...p, h: heartsOf(p.u), l: room.launches[p.u] || 0 })).sort((a, b) => b.h - a.h || b.l - a.l);
    const humans = ranked.filter((p) => !p.bot).length;
    const won = ranked[0] && ranked[0].u === me();
    // Gems: the winner 20, everyone else 5, for five shows a day; a show with only computer players pays 5.
    const st = load(); if (st.day !== today()) { st.day = today(); st.paid = 0; }
    let gems = 0;
    if (st.paid < SHOWS_PAID && !room.watcher) { gems = humans >= 2 ? (won ? 20 : 5) : 5; st.paid++; save(st); }
    if (gems) D().addGems(gems, won ? 'you won the mela' : 'for the mela');
    if (window.LUTSGoals) LUTSGoals.tick('mela');
    if (won) D().celebrate && D().celebrate();
    room.result = { ranked, won, gems };
    D().openSheet($('#melaModal'));
    view('result');
  }

  // ---------- The street race: everyone on the same street with the same nine stashes; the board shows who found what ----------
  const race = { on: false, timer: 0, board: null, mine: 0, firstFin: 0, quitting: false };
  const fmtT = (sec) => { const m = Math.floor(sec / 60), s = sec - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
  const progOf = (uid) => (room && room.data && room.data.prog && room.data.prog[uid]) || { f: 0, t: 0 };
  function beginRace() {
    const r = room, C = window.PatakaChor;
    if (!C) return;
    D().closeSheet($('#melaModal'));
    Object.assign(race, { on: true, mine: 0, firstFin: 0, quitting: false, began: Date.now(), home: '' });
    if (!race.board) { race.board = document.createElement('div'); race.board.className = 'mela-raceboard'; document.body.append(race.board); }
    race.board.hidden = false;
    renderBoard();
    const go = () => {
      if (room !== r || !race.on) return;
      if (r.watcher) { // a visitor: the street from the drone, nobody's stashes to find (and no racer's controls)
        C.start(r.w);
        document.body.classList.add('mela-watch');
        const up = () => { const w = window.LUTSGame && LUTSGame.chor && LUTSGame.chor.w3d; if (w && w.drone) { if (!w.aerial) w.drone(); startCam(); } else if (room === r) setTimeout(up, 400); };
        setTimeout(up, 600);
        return;
      }
      C.onBang = (type, x, z) => { if (room === r && race.on) req('POST', `rooms/${r.code}/ev`, { u: me(), s: String(type).slice(0, 20), x: Math.round(x * 10), y: Math.round(z * 10) }).catch(() => {}); };
      C.raceFromHome(r.w, `mela-${r.code}`, {
        progress: (f) => { race.mine = f; req('PUT', `rooms/${r.code}/prog/${me()}`, { f, t: 0 }).catch(() => {}); },
        done: (fin, sec) => {
          if (fin) { req('PUT', `rooms/${r.code}/prog/${me()}`, { f: 9, t: Math.max(1, Math.round(sec * 10)) }).catch(() => {}); race.home = fmtT(sec); renderBoard(); }
          else if (!race.quitting && room === r) { leave(true); } // left the street mid-race
        },
      });
    };
    setTimeout(go, Math.max(0, meta().start - now()));
    if (isHost()) startRaceBots();
    clearInterval(race.timer);
    race.timer = setInterval(raceTick, 1000);
    clearInterval(race.posTimer);
    if (!r.watcher) race.posTimer = setInterval(() => sendPos(r), 500);
    startDots();
  }
  function raceTick() {
    if (!race.on || !room) return;
    if (!room.data || !room.data.meta) { const r = room; stopRace(false); room = null; try { r.src.close(); } catch (e) { /* closed */ } D().toast('The host left the mela'); return; }
    if (window.PatakaChor && !PatakaChor.on && Date.now() - race.began > 45e3) { leave(true); return; } // left Fireworks Street (a slow phone may take a while to open the street)
    const ps = players().filter(Boolean), fins = ps.filter((p) => progOf(p.u).t > 0);
    if (fins.length && !race.firstFin) race.firstFin = Date.now();
    const el = (Date.now() - race.began) / 1000;
    if ((ps.length && fins.length === ps.length) || (race.firstFin && Date.now() - race.firstFin > RACE_GRACE * 1000) || el > RACE_CAP) endRaceRoom();
  }
  function renderBoard() {
    if (!race.board || !room) return;
    const ps = players().filter(Boolean).map((p) => ({ ...p, ...progOf(p.u) })).sort((a, b) => (a.t && b.t ? a.t - b.t : (b.t ? 1 : 0) - (a.t ? 1 : 0)) || b.f - a.f);
    race.board.innerHTML = (race.home ? `<p class="mela-home">🏁 Home in ${race.home} · waiting for the others</p>` : '') + ps.map((p) => `<div class="mela-rb${p.u === me() ? ' me' : ''}" style="--c:${COLORS[p.c % 4]}"><i></i><span translate="no">${esc(p.n)}${p.bot ? ' 🤖' : ''}</span><b>${p.t ? `✓ ${fmtT(p.t / 10)}` : `${p.f}/9`}</b></div>`).join('');
  }
  // A visitor's show camera: each bang is framed low and looking up (held a few seconds, so bangs close together don't
  // jolt it about); in between, a slow glide down the street. The 🎥 pill turns it off (the drone is yours again).
  const cam = { on: true, at: 0, glideZ: null, timer: 0, pill: null };
  const w3 = () => window.LUTSGame && LUTSGame.chor && LUTSGame.chor.w3d;
  function camTo(x, z) {
    const w = w3();
    if (!cam.on || !w || !w.showCam || performance.now() - cam.at < 2600) return;
    cam.at = performance.now();
    w.showCam(x, z, 'burst');
  }
  function startCam() {
    if (!cam.pill) {
      cam.pill = document.createElement('button');
      cam.pill.type = 'button'; cam.pill.className = 'mela-cam';
      cam.pill.addEventListener('click', () => { cam.on = !cam.on; syncCamPill(); const w = w3(); if (!cam.on && w && w.drone) w.drone(); });
      document.body.append(cam.pill);
    }
    cam.on = true; cam.pill.hidden = false; syncCamPill();
    clearInterval(cam.timer);
    cam.timer = setInterval(() => {
      const w = w3();
      if (!cam.on || !w || !w.showCam || performance.now() - cam.at < 6000) return;
      const b = w.bounds || { z0: -60, z1: 10 };
      cam.glideZ = cam.glideZ == null || cam.glideZ < b.z0 + 10 ? b.z1 : cam.glideZ - 7;
      w.showCam(0, cam.glideZ, 'glide');
    }, 2500);
  }
  function stopCam() { clearInterval(cam.timer); if (cam.pill) cam.pill.hidden = true; }
  const syncCamPill = () => { cam.pill.textContent = cam.on ? '🎥 Show camera · on' : '🎥 Show camera · off'; cam.pill.setAttribute('aria-pressed', String(cam.on)); };

  // Where each racer is: two updates a second while on the street (not while up in the drone)
  let lastPos = '';
  function sendPos(r) {
    const w = window.LUTSGame && LUTSGame.chor && LUTSGame.chor.w3d;
    if (!w || room !== r || w.aerial) return;
    const c = w.camera(), v = `${Math.round(c.x * 10) / 10},${Math.round(c.z * 10) / 10}`;
    if (v === lastPos) return;
    lastPos = v;
    req('PUT', `rooms/${r.code}/pos/${me()}`, { x: Math.round(c.x * 10) / 10, z: Math.round(c.z * 10) / 10 }).catch(() => {});
  }
  const dots = { cv: null, raf: 0, at: {} };
  function startDots() {
    if (!dots.cv) { dots.cv = document.createElement('canvas'); dots.cv.className = 'mela-dots'; document.body.append(dots.cv); }
    dots.cv.hidden = false;
    cancelAnimationFrame(dots.raf);
    const draw = () => {
      if (!race.on || !room) return;
      dots.raf = requestAnimationFrame(draw);
      const cv = dots.cv, dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(innerWidth * dpr)) { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
      const w = window.LUTSGame && LUTSGame.chor && LUTSGame.chor.w3d, pos = (room.data && room.data.pos) || {};
      if (!w) return;
      for (const p of players().filter(Boolean)) {
        const at = pos[p.u];
        if (!at || p.u === me()) continue;
        const s = dots.at[p.u] = dots.at[p.u] || { x: at.x, z: at.z }; // glide between updates
        s.x += (at.x - s.x) * 0.15; s.z += (at.z - s.z) * 0.15;
        const q = w.project(s.x, 1.1, s.z);
        if (!q || q[2] <= 0 || q[0] < -40 || q[0] > innerWidth + 40) continue;
        const col = COLORS[p.c % 4], rad = w.aerial ? 9 : 12, t = performance.now() / 300;
        g.beginPath(); g.arc(q[0], q[1], rad + 6 + Math.sin(t) * 2, 0, Math.PI * 2); g.fillStyle = col + '44'; g.fill();
        g.beginPath(); g.arc(q[0], q[1], rad, 0, Math.PI * 2); g.fillStyle = col; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
        g.font = '700 12px Outfit, sans-serif'; g.textAlign = 'center';
        const label = `${p.n}${p.bot ? ' 🤖' : ''} · ${progOf(p.u).t ? '✓' : `${progOf(p.u).f}/9`}`;
        const tw = g.measureText(label).width + 12;
        g.fillStyle = 'rgba(17, 15, 38, .85)'; g.fillRect(q[0] - tw / 2, q[1] - rad - 26, tw, 18);
        g.fillStyle = '#fff'; g.fillText(label, q[0], q[1] - rad - 13);
      }
    };
    draw();
  }
  function stopDots() { cancelAnimationFrame(dots.raf); if (dots.cv) { dots.cv.hidden = true; dots.at = {}; } }
  function startRaceBots() {
    const r = room, t0 = Date.now(), found = {}, last = {}; // a computer player finds one every 7 s at most, about 2½ minutes for all nine
    clearInterval(r.botTimer);
    r.botTimer = setInterval(() => {
      if (room !== r || !race.on || Date.now() < meta().start) return;
      for (const b of players().filter((p) => p && p.bot)) {
        const f = found[b.u] || 0;
        if (f >= 9 || Date.now() - (last[b.u] || meta().start) < 9000 || Math.random() > 0.08) continue; // (slower: the heist's vault and escape come after the nine)
        found[b.u] = f + 1; last[b.u] = Date.now();
        const done = f + 1 >= 9;
        req('PUT', `rooms/${r.code}/prog/${b.u}`, { f: f + 1, t: done ? Math.round((Date.now() - Math.max(t0, meta().start)) / 100) : 0 }).catch(() => {});
      }
    }, 1000);
  }
  function stopRace(quit) {
    race.on = false;
    if (window.PatakaChor) PatakaChor.onBang = null;
    document.body.classList.remove('mela-watch');
    stopCam();
    clearInterval(race.timer); clearInterval(race.posTimer); stopDots();
    if (room) clearInterval(room.botTimer);
    if (race.board) race.board.hidden = true;
    if (window.PatakaChor && PatakaChor.race) { race.quitting = true; PatakaChor.quitRace(); }
  }
  function endRaceRoom() {
    stopRace(false);
    room.ended = true;
    if (isHost()) { req('PATCH', `rooms/${room.code}/meta`, { state: 'done' }).catch(() => {}); req('DELETE', `live/${room.code}`).catch(() => {}); }
    const ranked = players().filter(Boolean).map((p) => ({ ...p, ...progOf(p.u) })).sort((a, b) => (a.t && b.t ? a.t - b.t : (b.t ? 1 : 0) - (a.t ? 1 : 0)) || b.f - a.f);
    const humans = ranked.filter((p) => !p.bot).length, won = ranked[0] && ranked[0].u === me() && ranked[0].t > 0;
    const st = load(); if (st.day !== today()) { st.day = today(); st.paid = 0; }
    let gems = 0;
    if (st.paid < SHOWS_PAID && !room.watcher) { gems = humans >= 2 ? (won ? 20 : 5) : 5; st.paid++; save(st); }
    if (gems) D().addGems(gems, won ? 'you won the race' : 'for the mela');
    if (window.LUTSGoals) LUTSGoals.tick('mela');
    room.result = { ranked, won: won && !room.watcher, gems, race: true };
    D().openSheet($('#melaModal'));
    view('result');
  }

  // ---------- The sheet: pick a temple and a way in · the lobby · the result ----------
  let curView = 'pick';
  function busy(on) { for (const b of document.querySelectorAll('#melaModal .mela-go')) b.disabled = on; }
  function view(v) {
    curView = v;
    for (const s of document.querySelectorAll('#melaModal [data-view]')) s.hidden = s.dataset.view !== v;
    if (v === 'pick') renderPick();
    if (v === 'lobby') renderLobby();
    if (v === 'result') renderResult();
  }
  async function renderPick() {
    const box = $('#melaPlaces');
    const c = counts;
    box.innerHTML = '';
    for (const b of document.querySelectorAll('#melaModes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    $('#melaSub').textContent = mode === 'race' ? 'Race friends down a street. First to find all 9 stashes wins.' : 'Fireworks together, up to four at a temple. Most hearts wins.';
    pickW = pick[mode];
    const list = mode === 'race' ? RACE_PLACES.map(([id, art, name]) => [id, art, name, '']) : PLACES.map(([id, where]) => [id, id, D().placeName(id), where]);
    for (const [id, art, name, where] of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `mela-place-card${id === pickW ? ' on' : ''}`;
      const n = c[id] || 0;
      b.innerHTML = `<span class="mela-art" style="background-image:url('${esc(mode === 'race' ? `assets/chor/thumb/${id}.webp` : D().worldArt(art))}')"></span><b>${esc(name)}</b>${where ? `<small>${esc(where)}</small>` : ''}${n >= 3 ? `<em>🟢 ${n} here</em>` : ''}`;
      b.addEventListener('click', () => { pick[mode] = id; renderPick(); });
      box.append(b);
    }
    renderLive();
    const all = (await readCounts()).all;
    $('#melaOnline').textContent = all >= 10 ? `🟢 ${all.toLocaleString('en-IN')} playing now` : '';
    if (curView === 'pick' && JSON.stringify(c) !== JSON.stringify(counts)) renderPick();
  }
  async function renderLive() {
    const box = $('#melaLive');
    let live = {};
    try { live = await req('GET', 'live', undefined, `&orderBy=%22at%22&startAt=${Math.round(now() - 6 * 60e3)}`) || {}; } catch (e) { live = {}; }
    const list = Object.entries(live).slice(-5).reverse();
    box.hidden = !list.length;
    box.querySelector('ol').innerHTML = '';
    for (const [code, v] of list) {
      const li = document.createElement('li');
      li.innerHTML = `<span><b>${esc(v.mode === 'race' ? placeOf(v.w) : D().placeName(v.w))}</b><small>${v.mode === 'race' ? '⏱ Street race' : '🎆 Fireworks show'} · ${+v.n || 0} 👤</small></span>`;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ghost'; b.textContent = '👀 Watch';
      b.addEventListener('click', () => watch(code));
      li.append(b); box.querySelector('ol').append(li);
    }
    const hc = $('#melaCount');
    if (hc && list.length) hc.textContent = `🔴 ${list.length} live now · watch`;
  }
  function renderLobby() {
    if (!room) return;
    $('#melaLobbyPlace').textContent = placeOf(room.w);
    $('#melaCode').textContent = room.code;
    const list = $('#melaSeats');
    list.innerHTML = '';
    const ps = players();
    ps.forEach((p, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', COLORS[i]);
      li.className = p ? 'in' : '';
      li.innerHTML = p ? `<i></i><span translate="no">${esc(p.n)}${p.bot ? ' 🤖' : ''}</span>${p.u === meta().host ? '<small>Host</small>' : ''}` : '<i></i><span>Waiting for a friend…</span>';
      list.append(li);
    });
    const n = ps.filter(Boolean).length, pub = !!meta().pub, nw = Object.keys((room.data && room.data.watch) || {}).length;
    $('#melaWatchers').textContent = nw ? `👀 ${nw} watching` : '';
    $('#melaStart').hidden = !isHost() || pub;
    $('#melaStart').disabled = n < 2;
    $('#melaBots').hidden = !isHost() || pub || n >= 4;
    $('#melaInvite').hidden = pub;
    if (room.watcher) { $('#melaStart').hidden = $('#melaBots').hidden = $('#melaInvite').hidden = true; $('#melaLobbyNote').textContent = '👀 You’re watching. The show starts when the host is ready'; return; }
    $('#melaLobbyNote').textContent = pub ? (n >= 2 ? 'Starting soon…' : 'Finding players… computer players join in 30 seconds') : (isHost() ? 'Start when your friends are in' : 'Waiting for the host to start');
  }
  function renderResult() {
    const r = room && room.result;
    if (!r) return;
    const tr = r.race && window.PatakaChor && PatakaChor.treasure ? PatakaChor.treasure() : null;
    $('#melaResTitle').textContent = r.race ? (r.won ? `🏆 You stole the ${tr ? tr[1] : 'treasure'}!` : 'Race over!') : r.won ? 'You lit up the mela!' : 'What a show!';
    const ol = $('#melaRank');
    ol.innerHTML = '';
    r.ranked.forEach((p, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', COLORS[p.c % 4]);
      li.innerHTML = `<b>${['🥇', '🥈', '🥉', '4'][i]}</b><span translate="no">${esc(p.n)}${p.bot ? ' 🤖' : ''}</span><em>${r.race ? (p.t ? `✓ ${fmtT(p.t / 10)}` : `${p.f}/9`) : `❤️ ${p.h}`}</em>`;
      if (p.u === me()) li.className = 'me';
      ol.append(li);
    });
    $('#melaResGems').textContent = r.gems ? `💎 +${r.gems}` : '';
  }
  function shareResult() {
    const r = room && room.result;
    if (!r) return;
    const name = placeOf(room.w);
    if (r.race) { D().share({ title: 'Mela Night', text: r.won ? `🏆 I beat my friends to the ${window.PatakaChor && PatakaChor.treasure ? PatakaChor.treasure()[1] : 'treasure'} on ${name} in Fireworks Street! 🧨\nRace me:` : `⏱ A street race with friends down ${name} in Fireworks Street! 🧨\nRace me:`, url: D().playLink('mela'), src: 'mela' }); return; }
    D().share({ title: 'Mela Night', text: r.won ? `🏆 I won Mela Night at ${name} with ❤️ ${r.ranked[0].h} hearts! 🎆\nPlay with me:` : `🎆 Fireworks with friends at ${name} on Mela Night!\nPlay with me:`, url: D().playLink('mela'), src: 'mela' });
  }

  // ---------- Wiring ----------
  function open() {
    const g = D();
    if (!g) return;
    if (!g.native()) { g.toApp('mela'); return; } // the website sends people to the app
    g.openSheet($('#melaModal'));
    if (room && !room.ended) view('lobby'); else { if (room) leave(true); view('pick'); }
  }
  function openLink() {
    const m = location.hash.match(/room=([A-Za-z0-9]{4})/);
    if (!m) return;
    const g = D();
    if (!g || !g.native()) { if (g) g.toApp('mela'); return; }
    history.replaceState(null, '', location.pathname + location.search);
    g.openSheet($('#melaModal'));
    view('pick');
    joinCode(m[1]);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!$('#melaModal')) return;
    $('#btnMela').addEventListener('click', open);
    for (const b of document.querySelectorAll('#melaModes button')) b.addEventListener('click', () => { mode = b.dataset.mode; renderPick(); });
    $('#melaOnlineBtn').addEventListener('click', playOnline);
    $('#melaFriends').addEventListener('click', withFriends);
    $('#melaPractice').addEventListener('click', practice);
    $('#melaJoin').addEventListener('click', () => joinCode($('#melaCodeIn').value));
    $('#melaInvite').addEventListener('click', invite);
    $('#melaStart').addEventListener('click', startShow);
    $('#melaBots').addEventListener('click', () => fillBots(1));
    $('#melaLeave').addEventListener('click', () => leave(false));
    $('#melaAgain').addEventListener('click', () => { const pub = room && meta().pub; leave(true); view('pick'); if (pub) playOnline(); else withFriends(); });
    $('#melaShare').addEventListener('click', shareResult);
    $('#melaDone').addEventListener('click', () => { leave(true); view('pick'); D().closeSheet($('#melaModal')); });
    if (fb() && fb().on) { syncClock().then(() => { beat(); renderHomeCount(); }); setInterval(() => { beat(); renderHomeCount(); }, 60e3); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { beat(); renderHomeCount(); } });
    setTimeout(openLink, 900);
    setTimeout(() => { if (fb() && fb().on) renderLive().catch(() => {}); }, 3000);
    window.addEventListener('hashchange', openLink);
  });
  window.LUTSMela = { watch, get room() { return room; }, get show() { return show; }, get race() { return race; }, setMode: (m) => { mode = m; }, players, readCounts, joinCode, create, enter, startShow, fillBots, leave }; // (for tests)
})();
