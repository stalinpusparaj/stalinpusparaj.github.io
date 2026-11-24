/* Event Sky configuration (window.LUTS_EVENT). Loaded first on every event page, before i18n.js and event-sky.js.
 * Everything that differs between the live project and a test lives here; ES.cfg() merges the RTDB switches (es_cfg)
 * on top and caches the result for 10 minutes in localStorage 'luts:es-cfg'.
 * Tests (and a staging copy) may set window.LUTS_EVENT before this file runs: those values win, nested objects merge.
 * Build spec: research/event-sky-spec.md §3.2. */
(function () {
  'use strict';
  const base = 'https://stalinpusparaj.github.io/light-up-the-skies/';
  const defaults = {
    base,
    rtdb: 'https://light-up-the-skies-default-rtdb.asia-southeast1.firebasedatabase.app',
    // A Firebase web API key is a public identifier, not a secret: the rules are what protect the data.
    firebase: { apiKey: 'AIzaSyAOkWLftdOi4qAxm-gmbTkdyctewSaMiIs', projectId: 'light-up-the-skies' },
    playId: 'com.stalinpusparaj.lightuptheskies',
    faceBase: base + 'web-only/face/',
    worker: '',
    r2: false,
    shop: false,
    products: { event: 'es_event_pass', shaadi: 'es_shaadi_pass', planner: 'es_planner_10' },
    // Event Sky's share of the Spark quotas (§1.4): reads/writes/deletes a day, stored MB, egress MB a month,
    // RTDB stored MB, RTDB download MB a month. RTDB es_cfg.b overrides these.
    budgets: { rd: 25000, wr: 10000, dl: 10000, st: 400, eg: 4096, rst: 150, rdl: 2048 },
    keywords: 'Light Up the Skies – Diwali fireworks game, QR photo wall & guest check-in for weddings, birthdays and parties',
  };
  const given = (window.LUTS_EVENT && typeof window.LUTS_EVENT === 'object') ? window.LUTS_EVENT : {};
  const out = Object.assign({}, defaults, given);
  ['firebase', 'products', 'budgets'].forEach((k) => { out[k] = Object.assign({}, defaults[k], given[k] || {}); });
  if (!given.faceBase && given.base) out.faceBase = String(given.base) + 'web-only/face/';
  window.LUTS_EVENT = out;
})();
