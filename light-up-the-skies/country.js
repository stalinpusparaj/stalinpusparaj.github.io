/* Light Up the Skies — where the player is celebrating: window.LUTSCountry (country.js, loaded before game.js).
 *
 * One country per device, picked in Settings or the welcome sheet and guessed until then from the phone's time zone,
 * then its language's region. It sets:
 *  - how numbers are written (1,00,000 in India, 100,000 or 100.000 elsewhere): locale();
 *  - the local New Year and Christmas greeting added to countdown shares and video captions: greet('newyear'|'christmas');
 *  - which messenger comes first among the share buttons: messengers() (keys of game.js SHARE_APPS);
 *  - the countdown's free skyline outside India: sky();
 *  - whether India-only occasions (Independence Day with "Jai Hind") are offered: india().
 * Nothing about the country leaves the device except the analytics user property the game sets from code().
 */
(() => {
  'use strict';
  const KEY = 'luts:country';

  // c: ISO code. n: name. f: flag. l: number locale. ny / xm: the local "Happy New Year" / "Merry Christmas" (empty: the
  // English one is enough). m: messengers, most used first (Infobip 2026 penetration; the rest keep the game's order).
  // tz: time zones that mean this country.
  const WA = ['whatsapp', 'facebook', 'instagram'];
  const LIST = [
    { c: 'IN', n: 'India', f: '🇮🇳', l: 'en-IN', ny: 'नया साल मुबारक', xm: 'मेरी क्रिसमस', m: WA, tz: ['Asia/Kolkata', 'Asia/Calcutta'] },
    { c: 'PH', n: 'Philippines', f: '🇵🇭', l: 'en-PH', ny: 'Manigong Bagong Taon', xm: 'Maligayang Pasko', m: ['messenger', 'viber', 'facebook', 'instagram'], tz: ['Asia/Manila'] },
    { c: 'ID', n: 'Indonesia', f: '🇮🇩', l: 'id-ID', ny: 'Selamat Tahun Baru', xm: 'Selamat Natal', m: WA, tz: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak'] },
    { c: 'MY', n: 'Malaysia', f: '🇲🇾', l: 'en-MY', ny: 'Selamat Tahun Baru', xm: 'Selamat Hari Krismas', m: WA, tz: ['Asia/Kuala_Lumpur', 'Asia/Kuching'] },
    { c: 'SG', n: 'Singapore', f: '🇸🇬', l: 'en-SG', ny: '', xm: '', m: WA, tz: ['Asia/Singapore'] },
    { c: 'VN', n: 'Vietnam', f: '🇻🇳', l: 'vi-VN', ny: 'Chúc mừng năm mới', xm: 'Giáng sinh vui vẻ', m: ['zalo', 'messenger', 'facebook'], tz: ['Asia/Ho_Chi_Minh', 'Asia/Saigon'] },
    { c: 'TH', n: 'Thailand', f: '🇹🇭', l: 'th-TH', ny: 'สวัสดีปีใหม่', xm: 'สุขสันต์วันคริสต์มาส', m: ['line', 'messenger', 'facebook'], tz: ['Asia/Bangkok'] },
    { c: 'JP', n: 'Japan', f: '🇯🇵', l: 'ja-JP', ny: 'あけましておめでとう', xm: 'メリークリスマス', m: ['line', 'instagram', 'x'], tz: ['Asia/Tokyo'] },
    { c: 'KR', n: 'South Korea', f: '🇰🇷', l: 'ko-KR', ny: '새해 복 많이 받으세요', xm: '메리 크리스마스', m: ['kakao', 'instagram'], tz: ['Asia/Seoul'] },
    { c: 'TW', n: 'Taiwan', f: '🇹🇼', l: 'zh-TW', ny: '新年快樂', xm: '聖誕快樂', m: ['line', 'messenger', 'instagram'], tz: ['Asia/Taipei'] },
    { c: 'HK', n: 'Hong Kong', f: '🇭🇰', l: 'zh-HK', ny: '新年快樂', xm: '聖誕快樂', m: WA, tz: ['Asia/Hong_Kong'] },
    { c: 'AU', n: 'Australia', f: '🇦🇺', l: 'en-AU', ny: '', xm: '', m: ['messenger', 'whatsapp', 'instagram'], tz: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Hobart', 'Australia/Darwin'] },
    { c: 'NZ', n: 'New Zealand', f: '🇳🇿', l: 'en-NZ', ny: '', xm: '', m: ['messenger', 'whatsapp', 'instagram'], tz: ['Pacific/Auckland'] },
    { c: 'AE', n: 'United Arab Emirates', f: '🇦🇪', l: 'en-AE', ny: 'سنة جديدة سعيدة', xm: '', m: WA, tz: ['Asia/Dubai'] },
    { c: 'SA', n: 'Saudi Arabia', f: '🇸🇦', l: 'ar-SA', ny: 'سنة جديدة سعيدة', xm: '', m: WA, tz: ['Asia/Riyadh'] },
    { c: 'PK', n: 'Pakistan', f: '🇵🇰', l: 'en-PK', ny: 'نیا سال مبارک', xm: '', m: WA, tz: ['Asia/Karachi'] },
    { c: 'BD', n: 'Bangladesh', f: '🇧🇩', l: 'bn-BD', ny: 'শুভ নববর্ষ', xm: 'শুভ বড়দিন', m: ['messenger', 'whatsapp', 'facebook'], tz: ['Asia/Dhaka'] },
    { c: 'LK', n: 'Sri Lanka', f: '🇱🇰', l: 'en-LK', ny: '', xm: '', m: WA, tz: ['Asia/Colombo'] },
    { c: 'NP', n: 'Nepal', f: '🇳🇵', l: 'en-NP', ny: 'नयाँ वर्षको शुभकामना', xm: '', m: ['messenger', 'viber', 'whatsapp'], tz: ['Asia/Kathmandu', 'Asia/Katmandu'] },
    { c: 'GB', n: 'United Kingdom', f: '🇬🇧', l: 'en-GB', ny: '', xm: '', m: WA, tz: ['Europe/London'] },
    { c: 'IE', n: 'Ireland', f: '🇮🇪', l: 'en-IE', ny: '', xm: '', m: WA, tz: ['Europe/Dublin'] },
    { c: 'DE', n: 'Germany', f: '🇩🇪', l: 'de-DE', ny: 'Frohes neues Jahr', xm: 'Frohe Weihnachten', m: WA, tz: ['Europe/Berlin'] },
    { c: 'NL', n: 'Netherlands', f: '🇳🇱', l: 'nl-NL', ny: 'Gelukkig nieuwjaar', xm: 'Vrolijk kerstfeest', m: WA, tz: ['Europe/Amsterdam'] },
    { c: 'FR', n: 'France', f: '🇫🇷', l: 'fr-FR', ny: 'Bonne année', xm: 'Joyeux Noël', m: WA, tz: ['Europe/Paris'] },
    { c: 'ES', n: 'Spain', f: '🇪🇸', l: 'es-ES', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['Europe/Madrid'] },
    { c: 'IT', n: 'Italy', f: '🇮🇹', l: 'it-IT', ny: 'Buon anno', xm: 'Buon Natale', m: WA, tz: ['Europe/Rome'] },
    { c: 'PT', n: 'Portugal', f: '🇵🇹', l: 'pt-PT', ny: 'Feliz Ano Novo', xm: 'Feliz Natal', m: WA, tz: ['Europe/Lisbon'] },
    { c: 'PL', n: 'Poland', f: '🇵🇱', l: 'pl-PL', ny: 'Szczęśliwego Nowego Roku', xm: 'Wesołych Świąt', m: ['messenger', 'whatsapp'], tz: ['Europe/Warsaw'] },
    { c: 'TR', n: 'Türkiye', f: '🇹🇷', l: 'tr-TR', ny: 'Mutlu yıllar', xm: '', m: WA, tz: ['Europe/Istanbul', 'Asia/Istanbul'] },
    { c: 'RU', n: 'Russia', f: '🇷🇺', l: 'ru-RU', ny: 'С Новым годом', xm: 'С Рождеством', m: ['telegram', 'whatsapp'], tz: ['Europe/Moscow'] },
    { c: 'UA', n: 'Ukraine', f: '🇺🇦', l: 'uk-UA', ny: 'З Новим роком', xm: 'З Різдвом', m: ['telegram', 'viber'], tz: ['Europe/Kyiv', 'Europe/Kiev'] },
    { c: 'US', n: 'United States', f: '🇺🇸', l: 'en-US', ny: '', xm: '', m: ['messenger', 'instagram', 'whatsapp'], tz: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Detroit'] },
    { c: 'CA', n: 'Canada', f: '🇨🇦', l: 'en-CA', ny: '', xm: '', m: ['messenger', 'whatsapp', 'instagram'], tz: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns', 'America/Regina'] },
    { c: 'MX', n: 'Mexico', f: '🇲🇽', l: 'es-MX', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Tijuana', 'America/Merida'] },
    { c: 'BR', n: 'Brazil', f: '🇧🇷', l: 'pt-BR', ny: 'Feliz Ano Novo', xm: 'Feliz Natal', m: WA, tz: ['America/Sao_Paulo', 'America/Fortaleza', 'America/Recife', 'America/Manaus', 'America/Bahia', 'America/Belem'] },
    { c: 'AR', n: 'Argentina', f: '🇦🇷', l: 'es-AR', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'] },
    { c: 'CO', n: 'Colombia', f: '🇨🇴', l: 'es-CO', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['America/Bogota'] },
    { c: 'CL', n: 'Chile', f: '🇨🇱', l: 'es-CL', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['America/Santiago'] },
    { c: 'PE', n: 'Peru', f: '🇵🇪', l: 'es-PE', ny: 'Feliz Año Nuevo', xm: 'Feliz Navidad', m: WA, tz: ['America/Lima'] },
    { c: 'NG', n: 'Nigeria', f: '🇳🇬', l: 'en-NG', ny: '', xm: '', m: WA, tz: ['Africa/Lagos'] },
    { c: 'KE', n: 'Kenya', f: '🇰🇪', l: 'en-KE', ny: 'Heri ya Mwaka Mpya', xm: 'Krismasi Njema', m: WA, tz: ['Africa/Nairobi'] },
    { c: 'ZA', n: 'South Africa', f: '🇿🇦', l: 'en-ZA', ny: '', xm: '', m: WA, tz: ['Africa/Johannesburg'] },
    { c: 'EG', n: 'Egypt', f: '🇪🇬', l: 'ar-EG', ny: 'سنة جديدة سعيدة', xm: '', m: WA, tz: ['Africa/Cairo'] },
  ];
  // Somewhere else: English words, the browser's own number style, the global skyline.
  const ELSEWHERE = { c: 'XX', n: 'Somewhere else', f: '🌍', l: '', ny: '', xm: '', m: [], tz: [] };
  const BY = Object.fromEntries(LIST.map((x) => [x.c, x]));
  const BY_TZ = {};
  for (const x of LIST) for (const z of x.tz) BY_TZ[z] = x.c;

  function guess() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    if (BY_TZ[tz]) return BY_TZ[tz];
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (const l of langs) {
      const m = /^[a-z]{2,3}[-_]([A-Z]{2})\b/i.exec(l || '');
      if (m && BY[m[1].toUpperCase()]) return m[1].toUpperCase();
    }
    return 'XX';
  }
  let saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch (e) { /* storage unavailable */ }
  let code = BY[saved] || saved === 'XX' ? saved : guess();
  const cur = () => BY[code] || ELSEWHERE;

  function locale() {
    const l = cur().l;
    if (l) return l;
    try { return (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US'; } catch (e) { return 'en-US'; }
  }
  // Numbers in the player's style; a bad locale tag falls back to plain English grouping.
  function num(n) {
    try { return Number(n).toLocaleString(locale()); } catch (e) { return Number(n).toLocaleString('en-US'); }
  }
  // The local greeting for 'newyear' or 'christmas' ('' when English is the country's own).
  const greet = (kind) => (kind === 'christmas' ? cur().xm : cur().ny) || '';

  window.LUTSCountry = {
    list: () => [...LIST.slice().sort((a, b) => a.n.localeCompare(b.n, 'en')), ELSEWHERE].map(({ c, n, f }) => ({ c, n, f })),
    code: () => code,
    name: () => cur().n,
    flag: () => cur().f,
    chosen: () => !!saved,
    guess,
    set(c) {
      if (!(BY[c] || c === 'XX')) return false;
      code = c; saved = c;
      try { localStorage.setItem(KEY, c); } catch (e) { /* storage unavailable */ }
      try { window.dispatchEvent(new CustomEvent('luts:country', { detail: c })); } catch (e) { /* old browser */ }
      return true;
    },
    locale,
    num,
    greet,
    messengers: () => cur().m.slice(),
    india: () => code === 'IN',
    // The countdown's free skyline: India keeps its landmarks; everywhere else gets the harbour city.
    sky: () => (code === 'IN' ? 'gateway-of-india' : 'harbour-city'),
  };
})();
