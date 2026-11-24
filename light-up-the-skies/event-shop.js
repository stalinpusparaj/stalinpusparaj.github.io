/* Event Sky print and original sales: window.ESShop (event-shop.js). Build spec: research/event-sky-spec.md §3.9
 * (WP-H "Shop"), §4.22, §2.1 (pub/shop, orders/{o}), §2.5 rules for both.
 *
 * Off by default: nothing shows unless RTDB es_cfg.shop is on AND the event's pub/shop.on is set by the host or the
 * photographer. Guests' pages make no Firestore read for the shop while es_cfg.shop is off.
 *
 * Where it sells (§3.9, §4.22, Play policy):
 *  - Prints are physical goods. In the app they are paid by UPI straight to the photographer (or by card through the
 *    Worker). On the website the shop needs R2 (es_cfg.r2), like originals.
 *  - Sizes above 4×6 need R2. "Buy original" needs R2, card payments through the Worker, and the website: never the app.
 *  - UPI mode builds upi://pay?pa=<upi>&pn=<nm>&am=<rupees>&tn=Event%20Sky%20<code>%20<order>&cu=INR; the buyer pays in
 *    their UPI app, then types the UPI reference; the photographer marks the order paid, then sent. "Sent" lowers the
 *    order's expiry to 30 days, after which sweeps delete it with its address.
 *  - Card mode (pub/shop.mode 'rzp') asks the Worker (es_cfg.worker) for a Razorpay order and opens the Worker's own
 *    checkout page, so event pages load no payment script.
 *
 * API (async unless marked sync; failures are ESError {code, status, message}):
 *  ESShop.enabled(code, {fresh?}) → {mode, upi, nm, pr, sizes:[…], app, r2} | null   (null = hide every shop button)
 *  ESShop.settings(code, {on, mode:'upi'|'rzp', upi, nm, pr:{'4x6': paise, '5x7', '8x12', 'orig'}})      staff (host, c, p)
 *  ESShop.get(code) → pub/shop | null                                                                     staff form fill
 *  ESShop.order(code, {ids, size, qty, name, phone, address}) → {o, id, tk, amt, upiUrl?, pay?}         buyer
 *  ESShop.setRef(code, o, ref) → void                       buyer: the UPI reference, with the owner proof (pv/pr)
 *  ESShop.orders(code) → [{id, o, it, sz, q, nm, ph, ad, ref, amt, st, at, xp}]                         staff (c, p, host)
 *  ESShop.markPaid(code, o) / ESShop.markSent(code, o) / ESShop.void(code, o)                            staff
 *  ESShop.mine(code) (sync) → this device's orders [{o, amt, sz, q, n, st, at}]
 *  ESShop.upiUrl({upi, nm, amt, code, o}) (sync) → string;  ESShop.amount(pr, size, qty, n) (sync) → paise
 *  ESShop.rupees(paise) (sync) → "₹1,250" / "₹12.50";  ESShop.SIZES, ESShop.LABELS (sync)
 *  ESShop.ui.orderButton(code, ids) → <button>|null  ("Order a print" for a gallery lightbox; null when off)
 *  ESShop.ui.openOrder(code, ids) → void;  ESShop.ui.settings(el, code) / ESShop.ui.orders(el, code) → void (staff panels)
 *  ESShop.ui.close() (sync) → true when a shop sheet was open (call it from LUTSBack)
 *  ESShop.cloud: the Worker client (off unless es_cfg.worker): url(), call(path, body, {auth, method}), verifyPass({tx,
 *    rcUser}), upload(code, {id, kind:'o'|'d', blob, type, crc}), remove(code, id), zipLink(code, {kind}), mediaUrl(code, id)
 *
 * Needs event-sky.js (window.ES). Pages using it must keep their CSP connect-src open to the Worker when it is set.
 */
/* STRINGS:
Order a print
Buy original
Size
How many
Copies of each photo
Name
Phone
Delivery address
Pay {0} by UPI
Pay {0} by card
Enter your UPI reference
Send
Order placed ✓ — the photographer will confirm.
Your order number is {0}.
{0} photos
1 photo
Total: {0}
4×6
5×7
8×12
Original file
Check the phone number
Write your name
Add the delivery address
That UPI reference doesn't look right
Orders are closed for this event
Too many orders right now. Try again.
Something went wrong. Try again.
If your UPI app did not open, pay {0} to {1}, then enter the reference.
Card payments open in a new page.
Sell prints
Your UPI ID
Name on the payment
Prices
Card payments (Razorpay)
Commission: {0}% (invoiced monthly)
Save
Saved ✓
Check the UPI ID (like name@bank)
Set at least one price
Orders
No orders yet
Mark paid
Mark sent
Cancel
Cancel this order?
Fewer
More
No connection
New
Paid
Sent
Cancelled
UPI reference: {0}
Waiting for the UPI reference
The address is deleted 30 days after the order is sent.
Close
*/
(function () {
  'use strict';
  if (window.ESShop) return;
  const DAY = 864e5, HOUR = 36e5;
  const SIZES = Object.freeze(['4x6', '5x7', '8x12', 'orig']);
  const LABELS = Object.freeze({ '4x6': '4×6', '5x7': '5×7', '8x12': '8×12', orig: 'Original file' });
  const ST_LABEL = { new: 'New', paid: 'Paid', sent: 'Sent', void: 'Cancelled' };
  const UPI_RE = /^[A-Za-z0-9._-]{2,60}@[A-Za-z]{2,30}$/;
  const ID_RE = /^((0|[1-9][0-9]{0,2})-[0-5]|x-(0|[1-9][0-9]{0,3}))-[A-Za-z0-9]{12}$/;
  const ORD_KEY = (code) => `luts:es-ord:${code}`;
  const ES = () => { if (!window.ES) throw new Error('event-sky.js is not loaded'); return window.ES; };
  const E = (code, msg, status) => ES().err(code, status || 0, msg);
  const inApp = () => !!window.LUTSNative;
  const t = (s) => (window.LUTSLang && LUTSLang.t ? LUTSLang.t(s) : s);
  const fill = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined ? m : String(a[+i])));

  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
  function randStr(n) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', lim = 256 - (256 % 62);
    let out = '';
    while (out.length < n) for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < lim && out.length < n) out += A[b % 62];
    return out;
  }
  const clean = (s, max) => (ES().clean ? ES().clean(s, max) : String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max));

  // ------------------------------------------------------------------------------------------------- pure helpers ---
  function rupees(paise) {
    const p = Math.max(0, Math.round(+paise || 0));
    const whole = p % 100 === 0;
    return `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  function price(pr, size) { const v = pr && pr[size]; return Number.isInteger(v) && v > 0 ? v : 0; }
  function amount(pr, size, qty, n) {
    const unit = price(pr, size);
    if (!unit || !(qty >= 1) || !(n >= 1)) return 0;
    return unit * qty * n;
  }
  // NPCI's UPI deep link. pa is a UPI id the rules already limit to [A-Za-z0-9._-]@[A-Za-z], so it goes in as it is.
  function upiUrl({ upi, nm, amt, code, o }) {
    if (!UPI_RE.test(String(upi || ''))) throw E('DENIED', 'Check the UPI ID (like name@bank)');
    const am = (Math.round(+amt || 0) / 100).toFixed(2);
    return `upi://pay?pa=${upi}&pn=${encodeURIComponent(String(nm || '').slice(0, 40) || upi)}&am=${am}&tn=${encodeURIComponent(`Event Sky ${code} ${o}`)}&cu=INR`;
  }

  // -------------------------------------------------------------------------------------------------- the shop doc ---
  const shopCache = new Map(); // code → {at, d}
  async function shopDoc(code, o = {}) {
    const c = shopCache.get(code);
    if (c && !o.fresh && Date.now() - c.at < 60e3) return c.d;
    let d = null;
    try { d = await ES().fs.get(`events/${code}/pub/shop`, { auth: o.auth === undefined ? 'opt' : o.auth }); } catch (e) {
      if (e.code !== 'DENIED' && e.code !== 'NOT_FOUND') throw e; // missing or past xp: no shop
      d = null;
    }
    shopCache.set(code, { at: Date.now(), d });
    return d;
  }
  function offer(d, cfg) {
    if (!d || d.on !== true) return null;
    const app = inApp(), r2 = !!cfg.r2;
    if (!app && !r2) return null; // prints in the app only; the website needs R2 (§3.9)
    const card = d.mode === 'rzp';
    if (card && !cfg.worker) return null;
    const sizes = SIZES.filter((s) => price(d.pr, s) > 0 && (s === '4x6' || r2) && (s !== 'orig' || (!app && card)));
    if (!sizes.length) return null;
    if (!card && !UPI_RE.test(String(d.upi || ''))) return null;
    return { mode: card ? 'rzp' : 'upi', upi: String(d.upi || ''), nm: String(d.nm || ''), pr: Object.assign({}, d.pr), sizes, app, r2 };
  }
  async function enabled(code, o = {}) {
    if (!ES().CODE_RE.test(String(code || ''))) return null;
    const cfg = await ES().cfg().catch(() => null);
    if (!cfg || !cfg.shop || cfg.pause) return null;
    const d = await shopDoc(code, o).catch(() => null);
    return offer(d, cfg);
  }

  // ----------------------------------------------------------------------------------------------- staff: settings ---
  async function settings(code, s = {}) {
    const es = ES();
    const mode = s.mode === 'rzp' ? 'rzp' : 'upi';
    const upi = String(s.upi || '').trim();
    if (upi && !UPI_RE.test(upi)) throw E('DENIED', 'Check the UPI ID (like name@bank)');
    if (s.on && mode === 'upi' && !upi) throw E('DENIED', 'Check the UPI ID (like name@bank)');
    const pr = {};
    for (const k of SIZES) { const v = Math.round(+((s.pr || {})[k]) || 0); if (v > 0) pr[k] = Math.min(v, 10000000); }
    if (s.on && !Object.keys(pr).length) throw E('DENIED', 'Set at least one price');
    const ev = await es.events.get(code);
    await es.fs.commit([es.fs.w.update(`events/${code}/pub/shop`, {
      on: !!s.on, mode, upi, nm: clean(s.nm, 40), pr, xp: es.fs.ts(ev.expiresAt),
    }, { serverTime: ['at'], exists: null })], { auth: true });
    shopCache.delete(code);
  }
  const get = (code) => shopDoc(code, { fresh: true, auth: true });

  // ------------------------------------------------------------------------------------------------ buyer: orders ---
  function mine(code) { const l = lsGet(ORD_KEY(code), []); return Array.isArray(l) ? l.map((x) => ({ o: x.o, amt: x.amt, sz: x.sz, q: x.q, n: x.n, st: x.st || 'new', at: x.at, ref: x.ref || '' })) : []; }
  function remember(code, rec) {
    const l = (lsGet(ORD_KEY(code), []) || []).filter((x) => x && x.o !== rec.o);
    l.unshift(rec);
    lsSet(ORD_KEY(code), l.slice(0, 40));
  }
  function normPhone(p) { return String(p || '').replace(/[^0-9+ ]/g, '').replace(/\s+/g, ' ').trim(); }
  async function order(code, o = {}) {
    const es = ES();
    const shop = await enabled(code, { fresh: true });
    if (!shop) throw E('CLOSED', 'Orders are closed for this event');
    const ids = Array.from(new Set((Array.isArray(o.ids) ? o.ids : [o.ids]).map(String))).filter((id) => ID_RE.test(id));
    if (!ids.length || ids.length > 20) throw E('DENIED', 'Something went wrong. Try again.');
    const size = String(o.size || '');
    if (!shop.sizes.includes(size)) throw E('DENIED', 'Orders are closed for this event');
    const qty = Math.round(+o.qty || 1);
    if (!(qty >= 1 && qty <= 50)) throw E('DENIED', 'Something went wrong. Try again.');
    const name = clean(o.name, 40);
    if (!name) throw E('DENIED', 'Write your name');
    const phone = normPhone(o.phone);
    if (!/^[0-9+ ]{6,16}$/.test(phone) || (phone.match(/[0-9]/g) || []).length < 6) throw E('DENIED', 'Check the phone number');
    const address = clean(o.address, 300);
    if (size !== 'orig' && address.length < 8) throw E('DENIED', 'Add the delivery address');
    const amt = amount(shop.pr, size, qty, ids.length);
    if (!(amt > 0) || amt > 10000000) throw E('DENIED', 'Something went wrong. Try again.');
    const tk = randStr(16);
    // The rules want xp 60 days after the request (the address is kept no longer than that unless the photographer is
    // slower); now + 60 d less 12 h keeps it inside that bound with some room for a phone's clock.
    const xp = es.clock.now() + 60 * DAY - 12 * HOUR;
    const fields = { it: ids, sz: size, q: qty, nm: name, ph: phone, ad: size === 'orig' ? '' : address, ref: '', amt, st: 'new', tk, xp: es.fs.ts(xp) };
    let n = -1, last = null;
    const tried = new Set();
    for (let attempt = 0; attempt < 12 && n < 0; attempt++) {
      let c; do { c = crypto.getRandomValues(new Uint32Array(1))[0] % 2000; } while (tried.has(c)); tried.add(c);
      try {
        await es.fs.commit([es.fs.w.create(`events/${code}/orders/${c}`, fields, { serverTime: ['at'] })], { auth: 'opt' });
        n = c;
      } catch (e) {
        last = e;
        if (e.code === 'TAKEN' || e.code === 'BUSY') continue;
        if (e.code === 'DENIED') { shopCache.delete(code); throw E('DENIED', 'Orders are closed for this event', e.status); }
        throw e;
      }
    }
    if (n < 0) throw E('BUSY', 'Too many orders right now. Try again.', last && last.status);
    remember(code, { o: n, tk, amt, sz: size, q: qty, n: ids.length, at: Date.now(), pv: 0, st: 'new' });
    const out = { o: n, id: n, tk, amt };
    if (shop.mode === 'upi') out.upiUrl = upiUrl({ upi: shop.upi, nm: shop.nm, amt, code, o: n });
    else {
      // The Worker re-checks the order with a service account and returns its own checkout page. The page's address
      // goes without its #fragment (a gallery key lives there).
      const back = String(location.href).split('#')[0];
      const r = await cloud.call('/rzp/order', { code, o: n, tk, back });
      out.pay = r.pay;
    }
    return out;
  }
  async function setRef(code, o, ref) {
    const es = ES();
    const r = String(ref || '').replace(/\s+/g, '').slice(0, 40);
    if (!/^[A-Za-z0-9-]{6,40}$/.test(r)) throw E('DENIED', "That UPI reference doesn't look right");
    const list = lsGet(ORD_KEY(code), []) || [];
    const rec = list.find((x) => x && x.o === +o);
    if (!rec || !rec.tk) throw E('DENIED', 'Something went wrong. Try again.');
    let last = null;
    for (let i = 0; i < 3; i++) {
      const pv = (+rec.pv || 0) + 1 + i;
      const pr = await es.sha256hex(`${rec.tk}:${pv}`);
      try {
        await es.fs.commit([es.fs.w.update(`events/${code}/orders/${o}`, { ref: r, pv, pr }, { mask: ['ref', 'pv', 'pr'] })], { auth: 'opt' });
        rec.pv = pv; rec.ref = r;
        lsSet(ORD_KEY(code), list);
        return;
      } catch (e) { last = e; if (e.code !== 'DENIED') throw e; } // pv already used (another tab): try the next one
    }
    throw E('DENIED', 'Something went wrong. Try again.', last && last.status);
  }

  // ----------------------------------------------------------------------------------------------- staff: orders ---
  const SEL = ['it', 'sz', 'q', 'nm', 'ph', 'ad', 'ref', 'amt', 'st', 'at', 'xp'];
  async function orders(code) {
    const docs = await ES().fs.query(`events/${code}`, { from: 'orders', orderBy: [['at', 'desc']], limit: 300, select: SEL, auth: true });
    return docs.map((d) => Object.assign(d, { id: +d._id, o: +d._id }));
  }
  async function setStatus(code, o, st) {
    const es = ES();
    const n = Math.round(+o);
    if (!(n >= 0 && n < 2000)) throw E('DENIED', 'Something went wrong. Try again.');
    const patch = { st }, mask = ['st'];
    if (st === 'sent' || st === 'void') {
      // Delivered or cancelled: the address goes 30 days later (rules: xp ≤ request time + 30 d). An hour of room for
      // a fast clock.
      patch.xp = es.fs.ts(es.clock.now() + 30 * DAY - HOUR); mask.push('xp');
    }
    await es.fs.commit([es.fs.w.update(`events/${code}/orders/${n}`, patch, { mask })], { auth: true });
  }

  // ----------------------------------------------------------------------------------------- the Worker (cloud) ---
  const cloud = {
    url() { const c = ES().cfg.cached(); return String((c && c.worker) || '').replace(/\/+$/, ''); },
    async call(path, body, o = {}) {
      const base = cloud.url();
      if (!base) throw E('DENIED', 'Something went wrong. Try again.');
      const headers = { 'Content-Type': 'application/json' };
      if (o.auth) headers.Authorization = `Bearer ${await ES().staff.token()}`;
      let r;
      try { r = await fetch(base + path, { method: o.method || 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); } catch (e) { throw E('OFFLINE', 'No connection'); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map = { 401: 'DENIED', 403: 'DENIED', 404: 'NOT_FOUND', 409: 'BUSY', 413: 'DENIED', 415: 'DENIED', 429: 'QUOTA', 503: 'PAUSED' };
        throw E(map[r.status] || 'OFFLINE', (j && j.message) || 'Something went wrong. Try again.', r.status);
      }
      return j;
    },
    verifyPass: ({ tx, rcUser }) => cloud.call('/pass/verify', { tx, rcUser }, { auth: true }),
    // R2 copy of a photo already in Firestore: kind 'o' (the original file, ≤ 12 MB) or 'd' (the display copy).
    async upload(code, { id, kind, blob, type, crc }) {
      const b = blob instanceof Blob ? blob : new Blob([blob]);
      const up = await cloud.call('/up', { code, id, kind, type, size: b.size, crc }, { auth: true });
      let r;
      try { r = await fetch(up.url, { method: 'PUT', body: b, headers: { 'Content-Type': type } }); } catch (e) { throw E('OFFLINE', 'No connection'); }
      if (!r.ok) throw E(r.status === 429 ? 'QUOTA' : 'DENIED', 'Something went wrong. Try again.', r.status);
      return up.key;
    },
    remove: (code, id) => cloud.call(`/m/${code}/${id}`, undefined, { auth: true, method: 'DELETE' }),
    zipLink: (code, o = {}) => cloud.call(`/zip/${code}`, { kind: o.kind === 'd' ? 'd' : 'o' }, { auth: true }),
    mediaUrl: (code, id) => `${cloud.url()}/m/${code}/${id}`,
  };

  // ======================================================================================================= UI ===
  let styled = false;
  function style() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = `
.esshop-sheet .esshop-sum{margin:10px 0 0;font-weight:700;color:var(--gold2,#ffe7a3);font-variant-numeric:tabular-nums}
.esshop-sizes{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.esshop-sizes button{min-height:44px;min-width:64px;padding:6px 14px;border-radius:22px;border:1px solid var(--gold,#f5c451);background:transparent;color:var(--gold,#f5c451);font:inherit;font-weight:700;cursor:pointer}
.esshop-sizes button[aria-pressed=true]{background:var(--gold,#f5c451);color:#1b1300}
.esshop-sizes small{display:block;font-weight:600;font-size:.8rem;opacity:.85}
.esshop-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}
.esshop-step{display:inline-flex;align-items:center;gap:6px}
.esshop-step button{width:44px;height:44px;border-radius:50%;border:1px solid var(--gold,#f5c451);background:transparent;color:var(--gold,#f5c451);font:inherit;font-size:1.3rem;font-weight:700;cursor:pointer}
.esshop-step output{min-width:2em;text-align:center;font-weight:700;font-variant-numeric:tabular-nums}
.esshop-list{list-style:none;margin:8px 0 0;padding:0}
.esshop-list li{padding:12px 0;border-top:1px solid var(--line2,#3b437a)}
.esshop-list li:first-child{border-top:0}
.esshop-list .meta{font-size:.9rem;color:var(--muted,#a9acc4);white-space:pre-line}
.esshop-list .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.esshop-list .acts button{min-height:44px;padding:6px 14px;border-radius:22px;border:1px solid var(--gold,#f5c451);background:transparent;color:var(--gold,#f5c451);font:inherit;font-weight:600;cursor:pointer}
.esshop-list .acts button.danger{border-color:rgba(255,154,144,.6);color:var(--bad,#ff9a90)}
.esshop-prices{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.esshop-prices label{margin:0;font-weight:600}
.esshop-msg{min-height:1.4em;margin:10px 0 0;color:var(--muted,#a9acc4)}
.esshop-msg.err{color:var(--bad,#ff9a90)}
.esshop-qr{display:block;width:min(240px,70vw);height:auto;margin:12px auto 0;image-rendering:pixelated;background:#fff;border-radius:8px}
`;
    document.head.appendChild(s);
  }
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else if (k in n && typeof v !== 'string') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  const errText = (e) => {
    const m = e && e.message;
    if (e && e.code === 'OFFLINE') return 'No connection';
    if (m && /^[A-Z]/.test(m) && m.length < 90 && !/HTTP|denied|permission|Firestore|fetch/i.test(m)) return m;
    return 'Something went wrong. Try again.';
  };

  // ---------- the buyer's sheet ----------
  let openSheet = null;
  function closeSheet() {
    if (!openSheet) return false;
    const s = openSheet; openSheet = null;
    s.remove();
    document.body.classList.remove('es-locked');
    document.removeEventListener('keydown', onKey);
    return true;
  }
  function onKey(e) { if (e.key === 'Escape') closeSheet(); }
  function sheet(titleText) {
    style();
    closeSheet();
    const id = `esshop-t${Date.now().toString(36)}`;
    const panel = el('div', { class: 'sheet-panel' },
      el('button', { class: 'sheet-x', type: 'button', 'aria-label': 'Close', text: '×', on: { click: closeSheet } }),
      el('h2', { id, text: titleText }));
    const s = el('div', { class: 'sheet esshop-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id }, panel);
    s.addEventListener('click', (e) => { if (e.target === s) closeSheet(); });
    document.body.appendChild(s);
    document.body.classList.add('es-locked');
    document.addEventListener('keydown', onKey);
    openSheet = s;
    return panel;
  }
  async function orderButton(code, ids) {
    const shop = await enabled(code).catch(() => null);
    if (!shop) return null;
    const onlyOrig = shop.sizes.length === 1 && shop.sizes[0] === 'orig';
    return el('button', { class: 'es-btn small ghost esshop-open', type: 'button', text: onlyOrig ? 'Buy original' : 'Order a print', on: { click: () => openOrder(code, ids) } });
  }
  async function openOrder(code, idsIn) {
    const ids = Array.from(new Set((Array.isArray(idsIn) ? idsIn : [idsIn]).map(String))).filter((x) => ID_RE.test(x)).slice(0, 20);
    const shop = await enabled(code, { fresh: true }).catch(() => null);
    const p = sheet(shop && shop.sizes.length === 1 && shop.sizes[0] === 'orig' ? 'Buy original' : 'Order a print');
    if (!shop || !ids.length) { p.append(el('p', { class: 'esshop-msg err', text: 'Orders are closed for this event' })); return; }
    let size = shop.sizes[0], qty = 1;
    const sizeRow = el('div', { class: 'esshop-sizes', role: 'group', 'aria-label': 'Size' });
    const qtyOut = el('output', { 'aria-live': 'polite', text: '1' });
    const sum = el('p', { class: 'esshop-sum', 'aria-live': 'polite' });
    const nameIn = el('input', { type: 'text', id: 'esshopName', maxlength: '40', autocomplete: 'name', 'data-no-i18n': '' });
    const phoneIn = el('input', { type: 'tel', id: 'esshopPhone', maxlength: '16', autocomplete: 'tel', inputmode: 'tel', 'data-no-i18n': '' });
    const addrIn = el('textarea', { id: 'esshopAddr', maxlength: '300', autocomplete: 'street-address', rows: '3', 'data-no-i18n': '' });
    const addrField = el('div', { class: 'field' }, el('label', { for: 'esshopAddr', text: 'Delivery address' }), addrIn,
      el('p', { class: 'small', text: 'The address is deleted 30 days after the order is sent.' }));
    const msg = el('p', { class: 'esshop-msg', role: 'status' });
    const payBtn = el('button', { class: 'es-btn', type: 'button' });
    const render = () => {
      sizeRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
      qtyOut.textContent = String(qty);
      addrField.hidden = size === 'orig';
      const amt = amount(shop.pr, size, qty, ids.length);
      sum.textContent = `${fill(t(ids.length === 1 ? '1 photo' : '{0} photos'), ids.length)} · ${fill(t('Total: {0}'), rupees(amt))}`;
      payBtn.textContent = fill(t(shop.mode === 'upi' ? 'Pay {0} by UPI' : 'Pay {0} by card'), rupees(amt));
    };
    for (const s of shop.sizes) {
      sizeRow.append(el('button', { type: 'button', 'data-size': s, 'aria-pressed': 'false', on: { click: () => { size = s; render(); } } },
        el('span', { text: LABELS[s] }), el('small', { 'data-no-i18n': '', text: rupees(price(shop.pr, s)) })));
    }
    const step = (d) => { qty = Math.max(1, Math.min(50, qty + d)); render(); };
    p.append(
      el('div', { class: 'field' }, el('span', { class: 'label', text: 'Size' }), sizeRow),
      el('div', { class: 'esshop-row' }, el('span', { class: 'label', text: 'How many' }),
        el('span', { class: 'esshop-step' }, el('button', { type: 'button', 'aria-label': 'Fewer', text: '−', on: { click: () => step(-1) } }), qtyOut,
          el('button', { type: 'button', 'aria-label': 'More', text: '+', on: { click: () => step(1) } }))),
      el('p', { class: 'small', text: 'Copies of each photo' }),
      el('div', { class: 'field' }, el('label', { for: 'esshopName', text: 'Name' }), nameIn),
      el('div', { class: 'field' }, el('label', { for: 'esshopPhone', text: 'Phone' }), phoneIn),
      addrField, sum, payBtn, msg);
    render();
    payBtn.addEventListener('click', async () => {
      if (payBtn.disabled) return;
      payBtn.disabled = true; msg.className = 'esshop-msg'; msg.textContent = '';
      try {
        const r = await order(code, { ids, size, qty, name: nameIn.value, phone: phoneIn.value, address: addrIn.value });
        if (r.pay) { msg.textContent = t('Card payments open in a new page.'); window.open(r.pay, '_blank', 'noopener'); afterCard(p, r); return; }
        afterUpi(code, p, r, shop);
      } catch (e) { msg.className = 'esshop-msg err'; msg.textContent = t(errText(e)); payBtn.disabled = false; }
    });
  }
  function afterCard(p, r) {
    p.querySelectorAll('.field, .esshop-row, .esshop-sum, .es-btn, .small').forEach((n) => n.remove());
    p.append(el('p', { text: 'Order placed ✓ — the photographer will confirm.' }), el('p', { class: 'small', text: fill(t('Your order number is {0}.'), r.o) }));
  }
  function afterUpi(code, p, r, shop) {
    p.querySelectorAll('.field, .esshop-row, .esshop-sum, .es-btn, p.small').forEach((n) => n.remove());
    const refIn = el('input', { type: 'text', id: 'esshopRef', maxlength: '40', inputmode: 'numeric', autocomplete: 'off', 'data-no-i18n': '' });
    const msg = p.querySelector('.esshop-msg') || el('p', { class: 'esshop-msg', role: 'status' });
    const send = el('button', { class: 'es-btn', type: 'button', text: 'Send' });
    const openUpi = el('a', { class: 'es-btn ghost', href: r.upiUrl, rel: 'noopener', text: fill(t('Pay {0} by UPI'), rupees(r.amt)) });
    p.append(openUpi);
    if (!/Android|iPhone|iPad/i.test(navigator.userAgent) && window.ES && ES().QR) {
      // A laptop has no UPI app: show the same payment as a QR for the phone's camera.
      const cv = el('canvas', { class: 'esshop-qr', 'aria-label': fill(t('Pay {0} by UPI'), rupees(r.amt)), role: 'img' });
      try { ES().QR.draw(cv, r.upiUrl, 4); p.append(cv); } catch (e) { /* too long for a QR: the link stays */ }
    }
    p.append(el('p', { class: 'small', text: fill(t('If your UPI app did not open, pay {0} to {1}, then enter the reference.'), rupees(r.amt), shop.upi) }),
      el('div', { class: 'field' }, el('label', { for: 'esshopRef', text: 'Enter your UPI reference' }), refIn), send, msg);
    msg.className = 'esshop-msg'; msg.textContent = fill(t('Your order number is {0}.'), r.o);
    send.addEventListener('click', async () => {
      if (send.disabled) return;
      send.disabled = true;
      try {
        await setRef(code, r.o, refIn.value);
        p.querySelectorAll('.field, .es-btn, canvas, p.small').forEach((n) => n.remove());
        msg.className = 'esshop-msg'; msg.textContent = t('Order placed ✓ — the photographer will confirm.');
      } catch (e) { msg.className = 'esshop-msg err'; msg.textContent = t(errText(e)); send.disabled = false; }
    });
    // On a phone (and in the app, where the link reaches Android's UPI chooser) open the UPI app straight away. A laptop
    // has no UPI app: it shows the QR above instead of trying a link nothing can open.
    if (inApp() || /Android|iPhone|iPad/i.test(navigator.userAgent)) location.href = r.upiUrl;
  }

  // ---------- staff panels ----------
  async function settingsUi(root, code) {
    style();
    root.textContent = '';
    const cfg = await ES().cfg().catch(() => ({}));
    const d = (await get(code).catch(() => null)) || {};
    const pr = d.pr || {};
    const sizes = SIZES.filter((s) => s === '4x6' || (cfg.r2 && (s !== 'orig' || cfg.worker)));
    const onIn = el('input', { type: 'checkbox', id: 'esshopOn', checked: !!d.on });
    const upiIn = el('input', { type: 'text', id: 'esshopUpi', maxlength: '93', autocomplete: 'off', spellcheck: 'false', value: d.upi || '', 'data-no-i18n': '' });
    const nmIn = el('input', { type: 'text', id: 'esshopNm', maxlength: '40', value: d.nm || '', 'data-no-i18n': '' });
    const cardIn = el('input', { type: 'checkbox', id: 'esshopCard', checked: d.mode === 'rzp' });
    const priceIns = {};
    const grid = el('div', { class: 'esshop-prices' });
    for (const s of sizes) {
      priceIns[s] = el('input', { type: 'number', id: `esshopP${s}`, min: '0', step: '1', inputmode: 'numeric', value: pr[s] ? String(Math.round(pr[s] / 100)) : '', placeholder: '₹' });
      grid.append(el('label', { for: `esshopP${s}` }, el('span', { text: LABELS[s] }), priceIns[s]));
    }
    const msg = el('p', { class: 'esshop-msg', role: 'status' });
    const save = el('button', { class: 'es-btn', type: 'button', text: 'Save' });
    root.append(
      el('label', { class: 'es-check', for: 'esshopOn' }, onIn, el('span', { text: 'Sell prints' })),
      el('div', { class: 'field' }, el('label', { for: 'esshopUpi', text: 'Your UPI ID' }), upiIn),
      el('div', { class: 'field' }, el('label', { for: 'esshopNm', text: 'Name on the payment' }), nmIn),
      el('div', { class: 'field' }, el('span', { class: 'label', text: 'Prices' }), grid));
    if (cfg.worker) root.append(el('label', { class: 'es-check', for: 'esshopCard' }, cardIn, el('span', { text: 'Card payments (Razorpay)' })));
    const cm = await ES().db.get('es_cfg/cm').catch(() => null);
    if (typeof cm === 'number' && cm >= 0 && cm <= 100) root.append(el('p', { class: 'small', text: fill(t('Commission: {0}% (invoiced monthly)'), cm) }));
    root.append(save, msg);
    save.addEventListener('click', async () => {
      if (save.disabled) return;
      save.disabled = true; msg.className = 'esshop-msg'; msg.textContent = '';
      try {
        const p2 = {};
        for (const s of sizes) p2[s] = Math.round((+priceIns[s].value || 0) * 100);
        await settings(code, { on: onIn.checked, mode: cardIn.checked ? 'rzp' : 'upi', upi: upiIn.value.trim(), nm: nmIn.value, pr: p2 });
        msg.textContent = t('Saved ✓');
      } catch (e) { msg.className = 'esshop-msg err'; msg.textContent = t(errText(e)); }
      save.disabled = false;
    });
  }
  async function ordersUi(root, code) {
    style();
    root.textContent = '';
    const msg = el('p', { class: 'esshop-msg', role: 'status' });
    let list = [];
    try { list = await orders(code); } catch (e) { root.append(el('p', { class: 'esshop-msg err', text: errText(e) })); return; }
    if (!list.length) { root.append(el('p', { class: 'small', text: 'No orders yet' })); return; }
    const ul = el('ul', { class: 'esshop-list' });
    for (const o of list) {
      const act = (label, st, danger) => el('button', { type: 'button', class: danger ? 'danger' : '', text: label, on: { click: async (ev) => {
        const b = ev.currentTarget;
        // Cancelling asks once more on the same button (no browser dialog: the app's WebView may not show one).
        if (st === 'void' && !b.dataset.sure) {
          b.dataset.sure = '1'; b.textContent = t('Cancel this order?');
          setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = t(label); } }, 5000);
          return;
        }
        b.disabled = true;
        try { await setStatus(code, o.o, st); await ordersUi(root, code); } catch (e) { b.disabled = false; msg.className = 'esshop-msg err'; msg.textContent = t(errText(e)); }
      } } });
      const acts = el('div', { class: 'acts' });
      if (o.st === 'new') acts.append(act('Mark paid', 'paid'));
      if (o.st === 'new' || o.st === 'paid') acts.append(act('Mark sent', 'sent'));
      if (o.st === 'new' || o.st === 'paid') acts.append(act('Cancel', 'void', true));
      ul.append(el('li', { 'data-order': String(o.o) },
        el('div', null, el('b', { 'data-no-i18n': '', text: `#${o.o} · ${o.nm || ''}` }), ' · ', el('span', { text: ST_LABEL[o.st] || o.st })),
        el('div', { class: 'meta', 'data-no-i18n': '', text: [`${LABELS[o.sz] || o.sz} × ${o.q} · ${(o.it || []).length} · ${rupees(o.amt)}`, o.ph, o.ad].filter(Boolean).join('\n') }),
        el('div', { class: 'meta', text: o.ref ? fill(t('UPI reference: {0}'), o.ref) : (o.st === 'new' ? 'Waiting for the UPI reference' : '') }),
        acts));
    }
    root.append(el('h3', { text: 'Orders' }), ul, msg);
  }

  window.ESShop = Object.freeze({
    version: 1, SIZES, LABELS,
    enabled, settings, get, order, setRef, orders, mine,
    markPaid: (code, o) => setStatus(code, o, 'paid'),
    markSent: (code, o) => setStatus(code, o, 'sent'),
    void: (code, o) => setStatus(code, o, 'void'),
    upiUrl, amount, rupees,
    ui: Object.freeze({ orderButton, openOrder, settings: settingsUi, orders: ordersUi, close: closeSheet }),
    cloud: Object.freeze(cloud),
  });
})();
