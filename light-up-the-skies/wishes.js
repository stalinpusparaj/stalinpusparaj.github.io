// Public Wishes (phase 1): a love card's two first names and its occasion, published for everyone's Live Sky. Only the
// names are typed; the wish itself is the occasion's own (translated in every language), never the card's message, so
// nothing written freely is ever public. One wish a day per phone: Firestore wishes/<uid>_<yyyymmdd> (see
// firebase/firestore.rules). The names are checked here first: first names only, letters only, nothing rude in any of
// the app's languages. The phone keeps its own wishes (luts:mywishes) for "your wish is in tonight's sky" later.
(function (root) {
  'use strict';
  const MINE_KEY = 'luts:mywishes', MAX = 18;
  // Letters (any script) and their marks, with one space, dot, apostrophe or hyphen between parts: "Amma", "Sri Devi",
  // "D'Souza", "ராதா". No digits, links, emoji or symbols.
  const NAME = /^[\p{L}\p{M}]+(?:[ .'’-][\p{L}\p{M}]+){0,2}$/u;
  // Rude words, matched in a name with its spaces, dots and hyphens taken out (so "f.u.c.k" is caught); the short
  // ones only as a whole part of the name, since inside a longer name they are innocent ("Bassi", "Shital", "Rapeti").
  const BAD = ['fuck', 'fuk', 'shit', 'bitch', 'bastard', 'cunt', 'pussy', 'dick', 'cock', 'whore', 'slut', 'porn', 'nude', 'naked', 'sexy',
    'rape', 'nigg', 'fag', 'retard', 'kill', 'suicide', 'terror', 'hitler', 'isis',
    'chutiya', 'chutia', 'chootiya', 'madarchod', 'maderchod', 'bhenchod', 'behenchod', 'benchod', 'bhosdi', 'bhosad', 'gandu', 'gaandu',
    'randi', 'raand', 'harami', 'haraami', 'kamina', 'kameena', 'lavda', 'lauda', 'lawda', 'lund', 'chodu', 'chod',
    'thevidiya', 'thevdiya', 'punda', 'pundai', 'otha', 'oombu', 'poolu', 'dengu', 'lanja', 'boothulu', 'soole', 'sule', 'bolimaga',
    'myre', 'poori mon', 'kunna', 'pottan',
    'चूत', 'चुत', 'चोद', 'भोसड', 'रंडी', 'रण्डी', 'गांडू', 'गाँडू', 'लंड', 'लौड़', 'हरामी', 'कमीना', 'मादरच', 'बहनच', 'भेनच',
    'চোদ', 'মাগি', 'খানকি', 'বাল', 'ચોદ', 'રંડી', 'ગાંડુ', 'ਚੋਦ', 'ਰੰਡੀ', 'ਗਾਂਡ', 'ਲੰਡ',
    'தேவிடியா', 'தேவடியா', 'புண்டை', 'ஓத்த', 'ஓம்பு', 'சுன்னி', 'దెంగు', 'లంజ', 'పూకు', 'ಸೂಳೆ', 'ತುಣ್ಣೆ', 'ബോളി', 'കുണ്ണ', 'പൂറ്', 'മൈര്',
    'झवाड', 'भडव', 'रांड'];
  const SHORT = new Set(['shit', 'rape', 'fuk', 'fag', 'dick', 'cock', 'kill', 'isis', 'chod', 'lund', 'otha', 'sule', 'myre', 'raand', 'punda', 'chodu', 'poolu', 'kunna', 'বাল']);
  const flat = (s) => s.toLocaleLowerCase().normalize('NFC').replace(/[\s.'’-]+/g, '');
  // '' when the name may be published; else why not ('empty' | 'letters' | 'rude').
  function nameProblem(raw) {
    const n = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!n) return 'empty';
    if ([...n].length > MAX || !NAME.test(n) || /[\p{L}\p{M}]{2,}\./u.test(n)) return 'letters'; // (a dot only after an initial: "S. Ravi", never "www.x")
    const f = flat(n), parts = n.toLocaleLowerCase().split(/[ .'’-]+/);
    for (const w of BAD) {
      if (SHORT.has(w) ? parts.includes(w) || f === w : f.includes(flat(w))) return 'rude';
    }
    return '';
  }
  const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  // A drawn signature: 8 to 64 points, each "x.y" with x and y from 0 to 999. Coordinates only, so a wish never carries typed text.
  const SIGN_RE = /^[0-9]{1,3}\.[0-9]{1,3}(?:,[0-9]{1,3}\.[0-9]{1,3}){7,63}$/;
  function signOk(g) { return typeof g === 'string' && SIGN_RE.test(g); }
  // pts: [{x, y}] in any box. One stroke, resampled, centred, packed for the rules.
  function packSign(pts) {
    if (!Array.isArray(pts) || pts.length < 8) return '';
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (len < 12) return '';
    const n = Math.min(64, Math.max(8, Math.round(len / 8)));
    const step = len / (n - 1), out = [pts[0]];
    let acc = 0, at = 0;
    for (let k = 1; k < n - 1; k++) {
      const target = k * step;
      while (at + 1 < pts.length) {
        const d = Math.hypot(pts[at + 1].x - pts[at].x, pts[at + 1].y - pts[at].y);
        if (acc + d >= target - 1e-6) {
          const t = d ? (target - acc) / d : 0;
          out.push({ x: pts[at].x + (pts[at + 1].x - pts[at].x) * t, y: pts[at].y + (pts[at + 1].y - pts[at].y) * t });
          break;
        }
        acc += d; at++;
      }
    }
    out.push(pts[pts.length - 1]);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of out) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const s = Math.max(maxX - minX, maxY - minY) || 1, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const packed = out.map((p) => `${Math.max(0, Math.min(999, Math.round(500 + (p.x - cx) / s * 860)))}.${Math.max(0, Math.min(999, Math.round(500 + (p.y - cy) / s * 860)))}`).join(',');
    return signOk(packed) ? packed : '';
  }
  // Back to a centred stroke, about -0.5..0.5, ready to scale onto the sky.
  function unpackSign(g) {
    if (!signOk(g)) return null;
    return g.split(',').map((pair) => { const [x, y] = pair.split('.'); return [(+x - 500) / 860, (+y - 500) / 860]; });
  }
  const day = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const mine = () => { try { const v = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  // Two wishes a day free, ten with Premium (the rules allow numbers 1 to 10: wishes/<uid>_<yyyymmdd>_<n>).
  const FREE_A_DAY = 2, PREMIUM_A_DAY = 10;
  const todays = () => mine().filter((w) => w.d === day());
  const limit = (premium) => (premium ? PREMIUM_A_DAY : FREE_A_DAY);
  const left = (premium) => Math.max(0, limit(premium) - todays().length);
  const publishedToday = (premium) => left(premium) === 0;
  // publish({ f, t, o, p, s, premium }) -> 'ok' | 'today' (none left today) | 'empty' | 'letters' | 'rude' (a name or a place) | 'offline'
  // p is a place (Madurai, India, USA): letters only, same check as a name, left out when blank. s is which of the
  // occasion's own lines was chosen. Neither is free text.
  async function publish(w) {
    const f = tidy(w.f), t = tidy(w.t), p = tidy(w.p);
    const bad = nameProblem(f) || nameProblem(t) || (p ? nameProblem(p) : '');
    if (bad) return bad;
    const s = Number.isInteger(w.s) && w.s >= 0 && w.s <= 7 ? w.s : 0;
    if (publishedToday(w.premium)) return 'today';
    const fb = root.LUTSFirebase;
    if (!fb || !fb.on) return 'offline';
    try {
      const id = await fb.token(), uid = fb.uid(), d = day(), n = Math.max(0, ...todays().map((x) => x.n || 1)) + 1;
      const str = (v) => ({ stringValue: String(v) }), int = (v) => ({ integerValue: String(v) });
      const fields = { f: str(f), t: str(t), o: str(w.o || 'custom'), l: str((document.documentElement.lang || 'en').slice(0, 2)), d: int(d),
        n: int(n), r: { doubleValue: Math.min(0.999999, Math.random()) }, by: str(uid), rp: int(0), at: int(Date.now()), s: int(s) };
      if (p) fields.p = str(p);
      if (w.k) fields.k = int(1); // ticked: Wishes of India writes this name with a sparkler
      const g = signOk(w.g) ? w.g : '';
      if (g) fields.g = str(g); // the drawn signature: coordinates only, never words
      const send = (body) => fetch(`${fb.docs}/wishes?documentId=${encodeURIComponent(`${uid}_${d}_${n}`)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${id}` }, body: JSON.stringify({ fields: body }) });
      let res = await send(fields);
      // Rules that predate place, line, the sparkler tick or the signature still accept the names. This phone keeps them either way.
      if (res.status === 403 && (fields.p || fields.s || fields.k || fields.g)) { const slim = { ...fields }; delete slim.p; delete slim.s; delete slim.k; delete slim.g; res = await send(slim); }
      if (res.status === 409) { keep({ f, t, o: w.o, p, s, k: w.k ? 1 : 0, g, d, n }); return 'offline'; } // (that number is taken: kept, so the next try uses the next)
      if (!res.ok) return 'offline';
      keep({ f, t, o: w.o, p, s, k: w.k ? 1 : 0, g, d, n });
      return 'ok';
    } catch (e) { return 'offline'; }
  }
  function keep(w) {
    const list = mine();
    const i = list.findIndex((x) => x.d === w.d && (x.n || 1) === (w.n || 1));
    const row = { ...(i >= 0 ? list[i] : {}), ...w, at: Date.now() };
    if (i >= 0) list[i] = row; else list.unshift(row);
    try { localStorage.setItem(MINE_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) { /* not kept */ }
  }
  // Change a wish already published today (same number, so it does not use another of the day's wishes).
  // Old rules refuse the write; this phone still keeps the edit, and the show here reads that copy.
  async function update(w) {
    const f = tidy(w.f), t = tidy(w.t), p = tidy(w.p);
    const bad = nameProblem(f) || nameProblem(t) || (p ? nameProblem(p) : '');
    if (bad) return bad;
    const s = Number.isInteger(w.s) && w.s >= 0 && w.s <= 7 ? w.s : 0;
    const n = w.n || 1, d = day();
    const existing = todays().find((x) => (x.n || 1) === n);
    if (!existing) return 'offline';
    const g = signOk(w.g) ? w.g : '';
    const saved = { f, t, o: w.o || existing.o, p, s, k: w.k ? 1 : 0, g, d, n: existing.n || n };
    const fb = root.LUTSFirebase;
    if (!fb || !fb.on) return 'offline';
    try {
      const tok = await fb.token(), uid = fb.uid();
      const doc = n === 1 && !existing.n ? `${d}` : `${d}_${existing.n || n}`;
      const str = (v) => ({ stringValue: String(v) }), int = (v) => ({ integerValue: String(v) });
      const fields = { f: str(f), t: str(t), o: str(saved.o), s: int(s) };
      if (p) fields.p = str(p);
      if (w.k) fields.k = int(1);
      if (g) fields.g = str(g);
      const mask = ['f', 't', 'o', 's', 'p', 'k', 'g'].map((key) => `updateMask.fieldPaths=${key}`).join('&');
      const res = await fetch(`${fb.docs}/wishes/${uid}_${doc}?${mask}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ fields }) });
      if (res.ok || res.status === 403) { keep(saved); return 'ok'; }
      return 'offline';
    } catch (e) { return 'offline'; }
  }
  // ----- Wishes of India (the Live Sky show): today's wishes -----
  // The 40 newest wishes, read once a day on this phone (40 reads; the free plan's 50,000 a day serve over a thousand
  // phones), of the last 14 days, unreported (fewer than 3 reports), whose names pass this phone's check too; 20 of them
  // in an order fixed by the date, so everyone sees the same sky that day. This phone's own wish of today is always in
  // it, first. Offline: the last day's list, else none (the show never makes wishes up).
  const DAY_KEY = 'luts:wishesday', PICK = 20, READ = 40;
  let todayList = null, loading = null;
  const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  function withOwn(list) { // this phone's wishes of today first (all of them), then everyone else's
    const own = todays().map((w) => ({ f: w.f, t: w.t, o: w.o, p: w.p || '', s: w.s, k: w.k ? 1 : 0, g: signOk(w.g) ? w.g : '', mine: true })), key = (w) => `${w.f}|${w.t}`.toLowerCase(), ours = new Set(own.map(key));
    return [...own, ...list.filter((w) => !ours.has(key(w)))].slice(0, PICK);
  }
  async function fetchToday() {
    try { const c = JSON.parse(localStorage.getItem(DAY_KEY) || 'null'); if (c && c.d === day() && Array.isArray(c.list)) return (todayList = c.list); } catch (e) { /* read again */ }
    const fb = root.LUTSFirebase;
    if (!fb || !fb.on) return (todayList = todayList || []);
    try {
      const res = await fetch(`${fb.docs}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'wishes' }], orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }], limit: READ } }) });
      if (!res.ok) throw new Error('read ' + res.status);
      const rows = await res.json(), since = Date.now() - 14 * 864e5, seen = new Set(), all = [];
      for (const row of rows) {
        const x = row.document && row.document.fields; if (!x) continue;
        const w = { f: x.f && x.f.stringValue, t: x.t && x.t.stringValue, o: (x.o && x.o.stringValue) || 'custom', p: (x.p && x.p.stringValue) || '', s: x.s && x.s.integerValue != null ? +x.s.integerValue : undefined, k: x.k && x.k.integerValue != null ? +x.k.integerValue : 0, g: (x.g && x.g.stringValue) || '', rp: +((x.rp && x.rp.integerValue) || 0), at: +((x.at && x.at.integerValue) || 0) };
        const k = `${w.f}|${w.t}`.toLowerCase();
        if (!w.f || !w.t || w.rp >= 3 || w.at < since || seen.has(k) || nameProblem(w.f) || nameProblem(w.t)) continue;
        if (w.p && nameProblem(w.p)) w.p = '';
        const id = String(row.document.name || '').split('/').pop();
        if (id && reported().includes(id)) continue; // (reported from this phone)
        seen.add(k); all.push({ id, f: w.f, t: w.t, o: w.o, p: w.p, s: w.s, k: w.k ? 1 : 0, g: signOk(w.g) ? w.g : '' });
      }
      const rnd = seeded(day());
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      todayList = all.slice(0, PICK);
      try { localStorage.setItem(DAY_KEY, JSON.stringify({ d: day(), list: todayList })); } catch (e) { /* not kept */ }
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem(DAY_KEY) || 'null'); todayList = (c && c.list) || []; } catch (er) { todayList = []; }
    }
    return todayList;
  }
  // ----- Reports and taking a wish back -----
  // A report: this account's report doc under the wish and the wish's count up by one, in one commit (the rules let
  // each account report a wish once, never its own). It goes from this phone's sky at once, from everyone's at 3.
  const REP_KEY = 'luts:wishreported';
  const reported = () => { try { const v = JSON.parse(localStorage.getItem(REP_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  async function report(id) {
    if (!id) return false;
    try { localStorage.setItem(REP_KEY, JSON.stringify([id, ...reported().filter((x) => x !== id)].slice(0, 200))); } catch (e) { /* not kept */ }
    if (todayList) todayList = todayList.filter((w) => w.id !== id);
    try { localStorage.setItem(DAY_KEY, JSON.stringify({ d: day(), list: todayList || [] })); } catch (e) { /* not kept */ }
    const fb = root.LUTSFirebase;
    if (!fb || !fb.on) return false;
    try {
      const tok = await fb.token(), uid = fb.uid(), base = fb.docs.replace(/^https:\/\/firestore\.googleapis\.com\/v1\//, '');
      const res = await fetch(`${fb.docs}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ writes: [
        { update: { name: `${base}/wishes/${id}/reports/${uid}`, fields: { at: { integerValue: String(Date.now()) } } }, currentDocument: { exists: false } },
        { transform: { document: `${base}/wishes/${id}`, fieldTransforms: [{ fieldPath: 'rp', increment: { integerValue: '1' } }] } }] }) });
      return res.ok;
    } catch (e) { return false; }
  }
  // Take back one wish published today (the one being edited, or else the latest): gone from Firestore and from this phone.
  async function takeBack(which) {
    const fb = root.LUTSFirebase, d = day(), today = todays().slice().sort((a, b) => (b.n || 1) - (a.n || 1));
    const last = which == null ? today[0] : today.find((w) => (w.n || 1) === which);
    if (!last) return false;
    const n = last.n || 1, id = n === 1 && !last.n ? `${d}` : `${d}_${n}`; // (a wish from before numbers: <uid>_<day>)
    try {
      if (fb && fb.on) { const tok = await fb.token(); const res = await fetch(`${fb.docs}/wishes/${fb.uid()}_${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }); if (!res.ok) return false; }
    } catch (e) { return false; }
    try { localStorage.setItem(MINE_KEY, JSON.stringify(mine().filter((w) => !(w.d === d && (w.n || 1) === n)))); } catch (e) { /* not kept */ }
    return true;
  }
  // load(): start reading (the Live Sky list calls it as it opens); list(): what is here now, this phone's own first.
  const load = () => (loading = loading || fetchToday().finally(() => { loading = null; }));
  const list = () => withOwn(todayList || []);
  root.LUTSWishes = { publish, update, nameProblem, publishedToday, left, limit, todays, mine, day, load, list, report, takeBack, packSign, unpackSign, signOk, FREE_A_DAY, PREMIUM_A_DAY };
})(typeof window !== 'undefined' ? window : globalThis);
