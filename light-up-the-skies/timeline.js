// My sky: a private timeline of what the player lit up (cards, people, shows watched, stories, spirals, badges), newest
// first and grouped by day, kept on this phone only (luts:timeline). The game adds a moment where it happens
// (window.LUTSTimeline && LUTSTimeline.add(...)), so nothing breaks without this file. Each moment can be shared; the
// game's own share path (LUTSGame.shareMoment) adds the picture, the keywords and the Play link. Any moment can be
// removed, or the whole sky cleared (a loved one's name is the player's to take back).
(function (root) {
  'use strict';
  const KEY = 'luts:timeline', CAP = 400, THUMBS = 40, THUMB_MAX = 8000, THUMB_PX = 112, CHUNK = 50;
  const $ = (s) => document.querySelector(s);
  // A stored moment: { id, at (ms), k: kind, l: the line in English with {0} holes, a: [what fills them], i: icon,
  // th: a thumbnail (an app picture's path, or a small JPEG data URL on the newest THUMBS only), r: what the share needs,
  // b: the best result so far (with best), key: what makes two moments the same (with within: the same only that many
  // ms apart) }.
  let items = null;
  const dayKey = (dt = new Date()) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const shift = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  const ok = (e) => e && typeof e === 'object' && Number.isFinite(e.at) && typeof e.l === 'string' && typeof e.k === 'string';
  function load() {
    if (items) return items;
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); items = Array.isArray(v) ? v.filter(ok).slice(0, CAP) : []; } catch (e) { items = []; }
    return items;
  }
  const isData = (s) => typeof s === 'string' && s.startsWith('data:');
  // Only the newest THUMBS keep a picture of their own; past a full storage, older pictures go, then older spirals'
  // drawings, then the oldest half.
  function save() {
    items.forEach((e, i) => { if (i >= THUMBS && isData(e.th)) delete e.th; });
    for (let tries = 0; tries < 5; tries++) {
      try { localStorage.setItem(KEY, JSON.stringify(items)); return true; } catch (e) {
        if (tries === 0) items.forEach((x, i) => { if (i >= 8 && isData(x.th)) delete x.th; });
        else if (tries === 1) items.forEach((x) => { if (isData(x.th)) delete x.th; });
        else if (tries === 2) items.forEach((x, i) => { if (i >= THUMBS && x.r && typeof x.r === 'object' && x.r.g) delete x.r; });
        else items = items.slice(0, Math.max(20, items.length >> 1));
      }
    }
    return false;
  }
  const fill = (e) => e.l.replace(/\{(\d+)\}/g, (_, n) => (e.a && e.a[n] != null ? String(e.a[n]) : ''));

  // A picture (a canvas, an image, a data URL or an app picture) as a small JPEG on a dark sky, under THUMB_MAX.
  function shrink(src) {
    return new Promise((res) => {
      const draw = (img) => {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) return res(null);
          for (const px of [THUMB_PX, 80, 56]) {
            const c = document.createElement('canvas'); c.width = c.height = px;
            const g = c.getContext('2d'), k = Math.max(px / w, px / h);
            g.fillStyle = '#0b0a22'; g.fillRect(0, 0, px, px);
            g.drawImage(img, (px - w * k) / 2, (px - h * k) / 2, w * k, h * k);
            for (let q = 0.72; q > 0.25; q -= 0.12) { const d = c.toDataURL('image/jpeg', q); if (d.length <= THUMB_MAX) return res(d); }
          }
          res(null);
        } catch (e) { res(null); }
      };
      if (src && src.getContext) return draw(src);
      const img = new Image();
      img.onload = () => draw(img); img.onerror = () => res(null);
      img.src = src;
    });
  }
  const setThumb = (e, t) => {
    if (typeof t === 'string' && !isData(t) && t.length < 200) e.th = t; // an app picture: its path
    else if (isData(t) && t.length <= THUMB_MAX) e.th = t;
  };
  const later = (e, t, again) => { if (t && (again || !e.th)) shrink(t).then((d) => { if (d && items.includes(e) && items.indexOf(e) < THUMBS) { e.th = d; save(); refresh(e, 'thumb'); } }); };

  // add({ kind, line, args, icon, thumb, ref, key, within, best, update, at }): kept at once; a picture to shrink arrives a
  // moment later. With a key, the same moment again is not doubled:
  //   no within: kept once (an achievement); with update, its line, words, icon and ref follow the thing (a card edited);
  //   within ms: the old one is brought up to date and moves to the top (a show watched on, a level replayed); with
  //   best (a number), only a result at least as good replaces the one shown, so a worse replay keeps the better line.
  function add(o) {
    try {
      if (!o || !o.kind || !o.line) return null;
      load();
      const now = o.at || Date.now();
      const e = { id: now.toString(36) + Math.random().toString(36).slice(2, 5), at: now, k: String(o.kind), l: String(o.line),
        a: (o.args || []).map((v) => String(v).slice(0, 48)), i: o.icon || '✨' };
      if (o.ref != null) e.r = o.ref;
      if (Number.isFinite(o.best)) e.b = o.best;
      if (o.key) {
        e.key = String(o.key);
        const have = items.find((x) => x.key === e.key);
        if (have && !o.within) {
          if (!o.update) return have;
          have.l = e.l; have.a = e.a; have.i = e.i; if (o.ref != null) have.r = o.ref;
          if (o.thumb) { const was = have.th; delete have.th; setThumb(have, o.thumb); if (!have.th) { if (was) have.th = was; later(have, o.thumb, true); } } // (a new photo: the old picture until it is shrunk)
          save(); refresh(have, 'same');
          return have;
        }
        if (have && now - have.at < o.within) {
          if (Number.isFinite(o.best) && Number.isFinite(have.b) && o.best < have.b) return have; // a worse replay
          have.a = e.a; have.at = now; if (o.ref != null) have.r = o.ref; if (Number.isFinite(o.best)) have.b = o.best;
          items.sort((a, b) => b.at - a.at); save(); refresh(have, 'top'); return have;
        }
      }
      const t = o.thumb;
      setThumb(e, t);
      items.unshift(e);
      items.sort((a, b) => b.at - a.at);
      if (items.length > CAP) items.length = CAP;
      save();
      later(e, t);
      refresh(e, 'top');
      return e;
    } catch (err) { return null; }
  }
  const list = () => load().map((e) => ({ ...e, text: fill(e) }));
  // Take moments back: one (its × on the screen), every moment a pred picks (a deleted card, a removed birthday), or all.
  function removeWhere(pred) {
    load();
    const gone = items.filter((e) => { try { return pred(e); } catch (err) { return false; } });
    if (!gone.length) return 0;
    items = items.filter((e) => !gone.includes(e));
    save();
    for (const e of gone) refresh(e, 'gone');
    return gone.length;
  }
  const remove = (id) => removeWhere((e) => e.id === id) > 0;
  function clear() { load(); items = []; save(); if (isOpen()) render(); else refresh(); }

  // Days in a row with anything in them, up to today (a day not yet lit today keeps yesterday's run going).
  function streak() {
    const days = new Set(load().map((e) => dayKey(new Date(e.at))));
    let d = dayKey();
    if (!days.has(d)) d = shift(d, -1);
    let n = 0;
    while (days.has(d)) { n++; d = shift(d, -1); }
    return n;
  }
  // This week (from Monday): people lit up (each person once, by a card or Light someone up), cards made, Live Sky shows
  // watched (each show once a day, however many times it was opened), spirals drawn.
  function week() {
    const now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const w = { card: 0, joy: 0, live: 0, gears: 0 }, who = new Set(), shows = new Set();
    for (const e of load()) {
      if (e.at < from || !(e.k in w)) continue;
      if (e.k === 'live') shows.add(dayKey(new Date(e.at)) + '|' + nameOf(e));
      else w[e.k]++;
      if ((e.k === 'card' || e.k === 'joy') && nameOf(e)) who.add(nameOf(e).toLowerCase());
    }
    w.live = shows.size; w.people = who.size;
    return w;
  }

  // ----- The screen -----
  // Shown CHUNK moments at a time (more as the list's end scrolls into view); one click listener for the whole list;
  // a moment added while it is open is put in place on its own; closed, the list is emptied so its pictures are freed.
  const lang = () => document.documentElement.lang || 'en';
  const el = () => $('#timeModal');
  const isOpen = () => !!el() && !el().hidden;
  let fmts = null; // the date and time formats, made once (each toLocale…String call would build a new one)
  const fmt = () => {
    if (fmts && fmts.lang === lang()) return fmts;
    const mk = (o) => { try { return new Intl.DateTimeFormat(lang(), o); } catch (e) { return null; } };
    const y = new Date().getFullYear();
    return (fmts = { lang: lang(), y, time: mk({ hour: 'numeric', minute: '2-digit' }), day: mk({ weekday: 'long', day: 'numeric', month: 'long' }),
      dayY: mk({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });
  };
  function dayTitle(key) {
    const today = dayKey();
    if (key === today) return 'Today';
    if (key === shift(today, -1)) return 'Yesterday';
    const [y, m, d] = key.split('-').map(Number), dt = new Date(y, m - 1, d), f = fmt(), F = y !== f.y ? f.dayY : f.day;
    try { return F ? F.format(dt) : key; } catch (e) { return key; }
  }
  const timeOf = (at) => { const f = fmt().time; try { return f ? f.format(new Date(at)) : ''; } catch (e) { return ''; } };
  const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  function head() {
    const box = $('#tlTop'); if (!box) return;
    box.textContent = '';
    // Who are you grateful for? Until someone is lit up today, My sky asks first: the point of it is the people.
    const today = dayKey();
    if (!load().some((e) => (e.k === 'joy' || e.k === 'card') && dayKey(new Date(e.at)) === today)) {
      const ask = node('div', 'tl-ask'), go = node('div');
      for (const [sel, label, cls] of [['#btnJoy', 'Light someone up', 'btn primary'], ['#btnIntroCard', 'Create a love card', 'btn ghost']]) {
        const b = node('button', cls, label); b.type = 'button';
        b.addEventListener('click', () => { const to = $(sel); close(); if (to) to.click(); });
        go.appendChild(b);
      }
      ask.append(node('p', '', 'Who are you grateful for?'), go);
      box.appendChild(ask);
    }
    const n = streak();
    box.appendChild(node('p', 'tl-streak', n >= 2 ? `🔥 ${n} days lighting up the sky` : n === 1 ? '🔥 Day 1 of lighting up the sky' : 'Light up the sky today to start a streak'));
    const w = week(), row = node('div', 'tl-week');
    row.appendChild(node('b', 'tl-week-h', 'This week'));
    for (const [k, label] of [['people', 'People lit up'], ['card', 'Cards'], ['live', 'Shows watched']]) {
      const c = node('span', 'tl-stat'); c.dataset.stat = k;
      c.append(node('b', '', String(w[k])), node('small', '', label));
      row.appendChild(c);
    }
    box.appendChild(row);
    memories(box);
  }
  function icon(ico, e) {
    ico.textContent = '';
    if (e.th) {
      const img = node('img'); img.src = e.th; img.alt = ''; img.width = img.height = 44; img.decoding = 'async'; img.loading = 'lazy';
      img.onerror = () => { img.remove(); ico.textContent = e.i; };
      ico.appendChild(img);
    } else ico.textContent = e.i;
  }
  function entry(e) {
    const li = node('li', 'tl-item'); li.dataset.id = e.id; li.dataset.kind = e.k;
    const ico = node('span', 'tl-ico'); ico.setAttribute('aria-hidden', 'true');
    icon(ico, e);
    const tx = node('span', 'tl-text'), line = node('b', '', fill(e));
    line.id = `tl-${e.id}`; // the buttons say which moment they act on (TalkBack: "Share, Lit up Ravi")
    tx.append(line, node('small', '', timeOf(e.at)));
    const sh = node('button', 'tl-share'); sh.type = 'button';
    const glyph = node('span', 'btn-ico share-glyph'); glyph.setAttribute('aria-hidden', 'true');
    sh.setAttribute('aria-label', 'Share'); sh.setAttribute('aria-describedby', line.id); sh.append(glyph, node('span', '', 'Share'));
    const del = node('button', 'tl-del'); del.type = 'button';
    del.setAttribute('aria-label', 'Remove'); del.setAttribute('aria-describedby', line.id);
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    li.append(ico, tx, sh, del);
    return li;
  }
  const watchSecs = (e) => (e.r && Number.isFinite(e.r.s) ? e.r.s : (Number(e.a && e.a[1]) || 1) * 60);
  function sameRow(g) {
    g.li.dataset.ids = g.ids.join(' ');
    const b = g.li.querySelector('.tl-text b'), t = g.li.querySelector('.tl-text small');
    if (b) b.textContent = fill({ ...g.e, a: [g.e.a[0], Math.max(1, Math.round(g.secs / 60))] });
    if (t) t.textContent = `${timeOf(g.e.at)} · ×${g.n}`;
  }
  // The list as drawn: how many moments are in it, and the open day's section and list to add the next chunk to.
  let shown = 0, lastDay = '', lastUl = null, watcher = null;
  function section(k) {
    const sec = node('section', 'tl-day'); sec.dataset.day = k;
    sec.appendChild(node('h3', 'tl-day-h', dayTitle(k)));
    const ul = node('ul', 'tl-items'); sec.appendChild(ul);
    return sec;
  }
  function more() {
    const box = $('#tlList'); if (!box) return;
    const all = load(), end = Math.min(all.length, shown + CHUNK);
    const sentinel = $('#tlMore'); if (sentinel) sentinel.remove();
    for (; shown < end; shown++) {
      const e = all[shown], k = dayKey(new Date(e.at));
      if (k !== lastDay || !lastUl || !lastUl.isConnected) {
        lastDay = k;
        const sec = section(k); lastUl = sec.querySelector('ul'); box.appendChild(sec);
        lastUl._shows = new Map();
      }
      // The same Live Sky show opened again the same day is one row: its time added up, ×how many watches.
      const show = e.k === 'live' && e.a && e.a[0];
      const same = show && lastUl._shows && lastUl._shows.get(show);
      if (same) { same.ids.push(e.id); same.secs += watchSecs(e); same.n++; sameRow(same); continue; }
      const li = entry(e);
      if (show && lastUl._shows) lastUl._shows.set(show, { li, e, ids: [e.id], secs: watchSecs(e), n: 1 });
      lastUl.appendChild(li);
    }
    if (shown < all.length) {
      const s = node('div', 'tl-more'); s.id = 'tlMore'; s.setAttribute('aria-hidden', 'true');
      box.appendChild(s);
      if (watcher) watcher.observe(s);
      else more(); // (no IntersectionObserver: everything at once)
    }
  }
  // ----- Memories: what the player made and who for, above the day-by-day list -----
  // Coming up (a saved birthday in the next 30 days), On this day (a moment from a week, a month or a year ago),
  // Your people (everyone a card was made for or lit up, most often first), Your spirals (their pictures) and the
  // all-time count since the first moment. Built from the moments and the saved birthdays, nothing new is stored.
  const nameOf = (e) => (e.a && e.a[0] ? String(e.a[0]).trim() : '');
  function people() {
    const m = new Map();
    for (const e of load()) {
      if (e.k !== 'card' && e.k !== 'joy') continue; // (a saved birthday is a reminder, not a greeting)
      const n = nameOf(e); if (!n) continue;
      const k = n.toLowerCase(), p = m.get(k) || { n, c: 0, i: e.i };
      p.c++; m.set(k, p);
    }
    return [...m.values()].sort((a, b) => b.c - a.c);
  }
  function nextBday() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('luts:birthdays') || '[]'); } catch (e) { list = []; }
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let best = null;
    for (const f of Array.isArray(list) ? list : []) {
      if (!f || typeof f.name !== 'string' || !(f.m >= 1 && f.m <= 12 && f.d >= 1 && f.d <= 31)) continue;
      let d = new Date(today.getFullYear(), f.m - 1, f.d);
      if (d < today) d = new Date(today.getFullYear() + 1, f.m - 1, f.d);
      const days = Math.round((d - today) / 864e5);
      if (days <= 30 && (!best || days < best.days)) best = { name: f.name, days };
    }
    return best;
  }
  function onThisDay() {
    const today = dayKey(), [y, m, d] = today.split('-').map(Number);
    const clampDay = (yy, mm) => dayKey(new Date(yy, mm, Math.min(d, new Date(yy, mm + 1, 0).getDate()))); // (31 March: 28 February, not 3 March)
    const ago = [[clampDay(y - 1, m - 1), 'A year ago today'], [clampDay(y, m - 2), 'A month ago today'], [shift(today, -7), 'A week ago today']];
    for (const [key, label] of ago) {
      const e = load().find((x) => dayKey(new Date(x.at)) === key && (x.k === 'card' || x.k === 'joy' || x.k === 'gears' || x.k === 'bday' || x.k === 'ach'))
        || load().find((x) => dayKey(new Date(x.at)) === key);
      if (e) return { e, label };
    }
    return null;
  }
  function memories(box) {
    const all = load();
    if (!all.length) return;
    const b = nextBday();
    if (b) {
      const c = node('div', 'tl-card tl-soon');
      c.append(node('span', 'tl-card-ico', '🎂'), node('p', '', b.days === 0 ? `Today is ${b.name}’s birthday. Light up their sky!`
        : b.days === 1 ? `${b.name}’s birthday is tomorrow` : `${b.name}’s birthday is in ${b.days} days`));
      box.appendChild(c);
    }
    const t = onThisDay();
    if (t) {
      const c = node('div', 'tl-card tl-memory'), ico = node('span', 'tl-ico');
      icon(ico, t.e);
      const txt = node('div', 'tl-text');
      txt.append(node('small', '', t.label), node('b', '', fill(t.e)));
      c.append(ico, txt);
      box.appendChild(c);
    }
    const ppl = people();
    if (ppl.length) {
      const sec = node('div', 'tl-sec');
      sec.appendChild(node('b', 'tl-week-h', ppl.length === 1 ? 'Someone you lit up' : `${ppl.length} people you lit up`));
      const chips = node('div', 'tl-people');
      for (const p of ppl.slice(0, 12)) chips.appendChild(node('span', 'tl-person', p.c > 1 ? `${p.i} ${p.n} ×${p.c}` : `${p.i} ${p.n}`));
      sec.appendChild(chips);
      box.appendChild(sec);
    }
    const spirals = all.filter((e) => e.k === 'gears' && e.th).slice(0, 10);
    if (spirals.length) {
      const sec = node('div', 'tl-sec');
      sec.appendChild(node('b', 'tl-week-h', 'Your spirals'));
      const strip = node('div', 'tl-gallery');
      for (const e of spirals) { const f = node('span', 'tl-ico tl-shot'); icon(f, e); f.title = fill(e); strip.appendChild(f); }
      sec.appendChild(strip);
      box.appendChild(sec);
    }
    // Highlights: one warm line per thing the player has done, only for what they did.
    const of = (k) => all.filter((e) => e.k === k), num = (v) => Number(v) || 0;
    const starOf = (e) => (Number.isFinite(e.b) ? e.b : num(e.a && e.a[1]));
    // A level replayed later is a second moment: each level once, at its best.
    const levels = (k) => { const m = new Map(); for (const e of of(k)) { const id = e.key || fill(e); if (!m.has(id) || starOf(e) > starOf(m.get(id))) m.set(id, e); } return [...m.values()]; };
    const starsOf = (es) => es.reduce((t, e) => t + starOf(e), 0);
    const lines = [];
    const diya = levels('diya');
    if (diya.length) {
      const st = starsOf(diya), perfect = diya.filter((e) => starOf(e) >= 3).length;
      lines.push(['🪔', `You lit ${diya.length} Diya Path ${diya.length === 1 ? 'level' : 'levels'} and earned ${st}★` + (perfect ? `, ${perfect} of them perfect` : '')]);
    }
    const rr = levels('rocket');
    if (rr.length) lines.push(['🚀', `${rr.length} Rocket Rush ${rr.length === 1 ? 'round' : 'rounds'} flown, ${starsOf(rr)}★ won`]);
    const live = of('live');
    if (live.length) {
      const secs = (e) => (e.r && Number.isFinite(e.r.s) ? e.r.s : num(e.a && e.a[1]) * 60); // (a watch keeps its seconds: seven 40 s watches are 5 minutes, not 7)
      const mins = Math.max(1, Math.round(live.reduce((t, e) => t + secs(e), 0) / 60)), fav = new Map();
      for (const e of live) { const sh = e.a && e.a[0]; if (sh) fav.set(sh, (fav.get(sh) || 0) + secs(e)); } // the favourite: the most time watched
      const top = [...fav].sort((a, b) => b[1] - a[1])[0];
      lines.push(['📺', `${mins} ${mins === 1 ? 'minute' : 'minutes'} of Live Sky watched` + (top ? `, ${top[0]} your favourite` : '')]);
    }
    const gears = of('gears');
    if (gears.length) {
      const most = Math.max(...gears.map((e) => num(e.a && e.a[0])));
      lines.push(['🌀', `${gears.length} ${gears.length === 1 ? 'spiral' : 'spirals'} drawn` + (most ? `, the biggest with ${most} petals` : '')]);
    }
    const cards = of('card');
    const forWho = new Set(cards.map((e) => nameOf(e).toLowerCase()).filter(Boolean)).size;
    if (cards.length) lines.push(['💌', `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} made for ${forWho} ${forWho === 1 ? 'person' : 'people'}`]);
    const joy = of('joy');
    if (joy.length) lines.push(['✨', `${joy.length} ${joy.length === 1 ? 'time' : 'times'} you lit up someone’s sky`]);
    const spark = of('spark');
    if (spark.length) lines.push(['🎇', `${spark.length} ${spark.length === 1 ? 'message' : 'messages'} written in sparkler light`]);
    const ach = of('ach');
    if (ach.length) lines.push(['🏆', `${ach.length} ${ach.length === 1 ? 'badge' : 'badges'} earned`]);
    const rush = of('rush').concat(of('daily'));
    if (rush.length) lines.push(['🏮', `${rush.length} lantern ${rush.length === 1 ? 'round' : 'rounds'} played`]);
    if (lines.length) {
      const first = all[all.length - 1], fk = dayKey(new Date(first.at));
      const sec = node('div', 'tl-sec'), ul = node('ul', 'tl-highlights');
      sec.appendChild(node('b', 'tl-week-h', fk === dayKey() ? 'Your sky today' : fk === shift(dayKey(), -1) ? 'Your sky since yesterday' : `Your sky since ${dayTitle(fk)}`));
      for (const [i, t] of lines) { const li = node('li'); li.append(node('span', 'tl-hl-ico', i), node('span', '', t)); ul.appendChild(li); }
      sec.appendChild(ul);
      box.appendChild(sec);
    }
  }
  function render() {
    const box = $('#tlList'); if (!box) return;
    head();
    box.textContent = '';
    shown = 0; lastDay = ''; lastUl = null;
    if (!watcher && typeof IntersectionObserver === 'function') {
      watcher = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { watcher.disconnect(); more(); } }, { rootMargin: '0px 0px 600px 0px' });
    }
    if (watcher) watcher.disconnect();
    more();
    empty();
  }
  function empty() {
    const n = load().length;
    const e = $('#tlEmpty'); if (e) e.hidden = n > 0;
    const c = $('#tlClear'); if (c) { c.hidden = n === 0; unarm(c); }
  }
  // One moment changed while the screen is open: just its row (top: it is the newest now; same: in place; thumb: its
  // picture; gone: taken out).
  function place(e, how) {
    const box = $('#tlList'); if (!box) return;
    const li = box.querySelector(`.tl-item[data-id="${CSS.escape(e.id)}"]`);
    if (how === 'thumb') { if (li) icon(li.querySelector('.tl-ico'), e); return; }
    if (how === 'same') { if (li) li.replaceWith(entry(e)); return; }
    if (li) { const ul = li.parentNode; li.remove(); if (ul && !ul.children.length) { const sec = ul.closest('.tl-day'); if (sec) sec.remove(); } shown = Math.max(0, shown - 1); }
    if (how === 'gone') return;
    const k = dayKey(new Date(e.at));
    let sec = box.querySelector('.tl-day');
    if (!sec || sec.dataset.day !== k) { sec = section(k); box.prepend(sec); }
    sec.querySelector('ul').prepend(entry(e));
    shown++;
    // past the cap, the oldest drawn row goes too
    const ids = new Set(load().map((x) => x.id));
    box.querySelectorAll('.tl-item').forEach((x) => { if (!ids.has(x.dataset.id)) { const ul = x.parentNode; x.remove(); shown--; if (!ul.children.length) ul.closest('.tl-day').remove(); } });
  }
  // The home tile's streak badge (and the screen itself when it is open).
  function refresh(e, how) {
    const b = $('#badgeMySky');
    if (b) { const n = items ? streak() : 0; b.hidden = n < 1; b.textContent = n >= 1 ? `🔥 ${n}` : ''; }
    if (!isOpen()) return;
    if (e && how) { place(e, how); head(); empty(); } else render();
  }
  async function share(id) {
    const e = load().find((x) => x.id === id);
    if (!e) return false;
    const g = root.LUTSGame;
    if (g && typeof g.shareMoment === 'function') return g.shareMoment({ ...e, text: fill(e) });
    try { if (navigator.share) { await navigator.share({ title: 'My sky', text: `${e.i} ${fill(e)}` }); return true; } } catch (err) { /* cancelled */ }
    return false;
  }
  // A remove asks once: the first tap turns it into "Remove?" (Clear my sky: "Tap again to clear everything").
  const arm = (b, text) => { b.classList.add('confirm'); b.dataset.was = b.innerHTML; b.textContent = text; clearTimeout(b._t); b._t = setTimeout(() => unarm(b), 4000); };
  function unarm(b) { if (!b || !b.classList.contains('confirm')) return; clearTimeout(b._t); b.classList.remove('confirm'); b.innerHTML = b.dataset.was || ''; }
  function onList(ev) {
    const b = ev.target.closest('button'); if (!b) return;
    const li = b.closest('.tl-item'); if (!li) return;
    if (b.classList.contains('tl-share')) { share(li.dataset.id); return; }
    if (b.classList.contains('tl-del')) {
      if (!b.classList.contains('confirm')) { arm(b, 'Remove?'); return; }
      const next = li.nextElementSibling || li.previousElementSibling;
      if (li.dataset.ids) { const ids = li.dataset.ids.split(' '); removeWhere((e) => ids.includes(e.id)); } // a show's watches that day, together
      else remove(li.dataset.id);
      const f = next && next.querySelector('.tl-share'); if (f && document.documentElement.classList.contains('tv')) f.focus(); // (a remote keeps its place)
    }
  }
  function open() {
    const m = el(); if (!m) return;
    const g = root.LUTSGame; if (g && g.resume) try { g.resume(); } catch (e) { /* no sound */ }
    render();
    if (root.LUTSDuel && root.LUTSDuel.openSheet) root.LUTSDuel.openSheet(m); else m.hidden = false;
  }
  function close() {
    if (!isOpen()) return false;
    if (root.LUTSDuel && root.LUTSDuel.closeSheet) root.LUTSDuel.closeSheet(el()); else el().hidden = true;
    if (watcher) watcher.disconnect();
    const box = $('#tlList'); if (box) box.textContent = ''; // its rows and pictures are freed
    shown = 0; lastUl = null;
    refresh();
    return true;
  }
  root.LUTSTimeline = { add, list, open, close, back: close, streak, week, share, isOpen, remove, removeWhere, clear };
  document.addEventListener('DOMContentLoaded', () => {
    load(); refresh();
    const t = $('#btnMySky'); if (t) t.addEventListener('click', open);
    const box = $('#tlList'); if (box) box.addEventListener('click', onList);
    const c = $('#tlClear');
    if (c) c.addEventListener('click', () => { if (!c.classList.contains('confirm')) { arm(c, 'Tap again to clear everything'); return; } unarm(c); clear(); });
    // The empty screen's ways in: a love card, Light someone up.
    document.querySelectorAll('#tlEmpty [data-go]').forEach((b) => b.addEventListener('click', () => { const to = $(b.dataset.go); close(); if (to) to.click(); }));
  });
})(typeof window !== 'undefined' ? window : globalThis);
