// Languages: the page is written in English and translated where it shows. Each language is a dictionary of the English
// text to its translation (i18n/<code>.js); text the game writes later is translated as it appears, so game.js needs no
// changes. "{0}", "{1}"… in a key stand for numbers or names the game fills in. Choosing a language reloads the page.
(() => {
  const LANGS = [
    ['auto', 'Phone language'], ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['mr', 'मराठी'], ['te', 'తెలుగు'],
    ['ta', 'தமிழ்'], ['gu', 'ગુજરાતી'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['pa', 'ਪੰਜਾਬੀ'],
  ];
  const KEY = 'luts:lang';
  const codes = LANGS.slice(1).map(([c]) => c);
  let saved = 'auto';
  try { saved = localStorage.getItem(KEY) || 'auto'; } catch (e) { /* storage blocked: follow the phone */ }
  const phone = (navigator.languages || [navigator.language || 'en']).map((l) => String(l).toLowerCase().split('-')[0]).find((l) => codes.includes(l)) || 'en';
  const lang = codes.includes(saved) ? saved : phone;
  window.LUTSLang = { langs: LANGS, chosen: codes.includes(saved) ? saved : 'auto', lang,
    choose(code) { try { localStorage.setItem(KEY, code); } catch (e) { /* not saved */ } location.reload(); },
    t: (s) => s };
  document.documentElement.lang = lang;
  if (lang === 'en') return;
  // Synchronous, so the dictionary is there before game.js runs and the page is first drawn.
  document.write(`<script src="i18n/${lang}.js"><\/script><script>LUTSLang._start()<\/script>`);

  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'data-cap'];
  const cache = new Map();
  let dict = null, holes = [];
  const compile = () => {
    dict = window.LUTS_I18N || {};
    // Keys with holes become patterns, longest first so the most specific wins.
    holes = Object.keys(dict).filter((k) => /\{\d+\}/.test(k)).sort((a, b) => b.length - a.length).map((k) => {
      const order = [];
      const src = k.split(/(\{\d+\})/).map((p) => {
        const m = /^\{(\d+)\}$/.exec(p);
        if (m) { order.push(+m[1]); return '(.+?)'; }
        return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { re: new RegExp(`^${src}$`, 's'), order, to: dict[k] };
    });
  };
  const lookup = (s, depth = 0) => {
    if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
    if (depth > 2) return null;
    for (const h of holes) {
      const m = h.re.exec(s);
      if (!m) continue;
      const vals = [];
      h.order.forEach((n, i) => { vals[n] = m[i + 1]; });
      return h.to.replace(/\{(\d+)\}/g, (_, n) => { const v = vals[n] ?? ''; return lookup(v, depth + 1) ?? v; });
    }
    return null;
  };
  const translate = (text) => {
    if (cache.has(text)) return cache.get(text);
    const core = text.replace(/\s+/g, ' ').trim();
    let out = null;
    if (core && /[A-Za-z]/.test(core)) {
      const t = lookup(core);
      if (t != null && t !== core) out = text.slice(0, text.length - text.trimStart().length) + t + text.slice(text.trimEnd().length);
    }
    if (cache.size > 4000) cache.clear();
    cache.set(text, out);
    return out;
  };
  const skip = (el) => el && el.closest && el.closest('script,style,textarea,[contenteditable],[data-no-i18n]');
  const doText = (node) => {
    if (skip(node.parentElement)) return;
    const t = translate(node.nodeValue);
    if (t != null) node.nodeValue = t;
  };
  const doEl = (el) => {
    if (skip(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) { const t = translate(v); if (t != null) el.setAttribute(a, t); }
    }
  };
  const walk = (root) => {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doEl(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) (n.nodeType === 3 ? doText : doEl)(n);
  };
  const start = () => {
    compile();
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  window.LUTSLang._start = start;
  window.LUTSLang.t = (s) => { if (!dict) compile(); return translate(s) ?? s; };
})();
