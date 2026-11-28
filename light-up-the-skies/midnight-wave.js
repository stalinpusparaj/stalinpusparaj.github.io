/* Light Up the Skies — the Midnight Wave: New Year's midnight as it moves around the world (window.LUTSWave).
 *
 * Pure time arithmetic, no server: every phone works out from its own clock when each time zone reaches 1 January, so
 * the whole world sees the same wave (Live Sky's "Midnight Wave" show and the Home tile in game.js use it).
 * Offsets are the ones in force on 31 December (southern summer time: Sydney +11, Auckland +13, Santiago -3).
 * Loaded as a plain script in the game, and with require() in the tests.
 */
(() => {
  'use strict';
  // o: hours ahead of UTC at New Year. c: cities shown for that midnight, the best-known first. f: a flag for the line.
  const ZONES = [
    { o: 14, c: ['Kiritimati'], f: '🇰🇮' },
    { o: 13, c: ['Auckland', 'Samoa', 'Tonga'], f: '🇳🇿' },
    { o: 12, c: ['Fiji'], f: '🇫🇯' },
    { o: 11, c: ['Sydney', 'Melbourne'], f: '🇦🇺' },
    { o: 10.5, c: ['Adelaide'], f: '🇦🇺' },
    { o: 10, c: ['Brisbane', 'Guam'], f: '🇦🇺' },
    { o: 9, c: ['Tokyo', 'Seoul'], f: '🇯🇵' },
    { o: 8, c: ['Manila', 'Singapore', 'Hong Kong', 'Beijing', 'Perth'], f: '🇵🇭' },
    { o: 7, c: ['Jakarta', 'Bangkok', 'Ho Chi Minh City'], f: '🇮🇩' },
    { o: 6, c: ['Dhaka'], f: '🇧🇩' },
    { o: 5.75, c: ['Kathmandu'], f: '🇳🇵' },
    { o: 5.5, c: ['Mumbai', 'Delhi', 'Colombo'], f: '🇮🇳' },
    { o: 5, c: ['Karachi', 'Tashkent'], f: '🇵🇰' },
    { o: 4, c: ['Dubai'], f: '🇦🇪' },
    { o: 3.5, c: ['Tehran'], f: '🇮🇷' },
    { o: 3, c: ['Moscow', 'Istanbul', 'Riyadh', 'Nairobi'], f: '🇷🇺' },
    { o: 2, c: ['Cairo', 'Athens', 'Kyiv', 'Johannesburg'], f: '🇪🇬' },
    { o: 1, c: ['Paris', 'Berlin', 'Amsterdam', 'Madrid', 'Rome', 'Lagos'], f: '🇪🇺' },
    { o: 0, c: ['London', 'Dublin', 'Lisbon', 'Accra'], f: '🇬🇧' },
    { o: -1, c: ['Azores', 'Cape Verde'], f: '🇨🇻' },
    { o: -3, c: ['Rio de Janeiro', 'São Paulo', 'Buenos Aires', 'Santiago'], f: '🇧🇷' },
    { o: -4, c: ['Caracas', 'La Paz', 'Puerto Rico'], f: '🇻🇪' },
    { o: -5, c: ['New York', 'Toronto', 'Bogotá', 'Lima'], f: '🇺🇸' },
    { o: -6, c: ['Mexico City', 'Chicago'], f: '🇲🇽' },
    { o: -7, c: ['Denver', 'Phoenix'], f: '🇺🇸' },
    { o: -8, c: ['Los Angeles', 'Vancouver'], f: '🇺🇸' },
    { o: -9, c: ['Anchorage'], f: '🇺🇸' },
    { o: -10, c: ['Honolulu', 'Tahiti'], f: '🇺🇸' },
    { o: -11, c: ['American Samoa', 'Niue'], f: '🇦🇸' },
  ];
  const H = 3600e3;
  // The New Year a moment belongs to: from 26 December on, the coming one.
  const yearOf = (now) => { const d = new Date(now); return d.getUTCMonth() === 11 && d.getUTCDate() >= 20 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(); };
  // Every midnight of that New Year, first to last: { at (ms, UTC), o, c, f }.
  const zones = (year) => ZONES.map((z) => ({ ...z, at: Date.UTC(year, 0, 1) - z.o * H }));
  // The wave runs from an hour before the first midnight to an hour after the last.
  function windowOf(year) { const z = zones(year); return { from: z[0].at - H, to: z[z.length - 1].at + H, year }; }
  const active = (now = Date.now()) => { const w = windowOf(yearOf(now)); return now >= w.from && now < w.to; };
  // The next midnight still to come (null once the last has passed), and the ones already reached.
  const next = (now = Date.now()) => zones(yearOf(now)).find((z) => z.at > now) || null;
  const passed = (now = Date.now()) => zones(yearOf(now)).filter((z) => z.at <= now);
  // This phone's own midnight among them (its UTC offset now; the nearest zone when it isn't listed).
  function mine(now = Date.now()) {
    const o = -new Date(now).getTimezoneOffset() / 60, all = zones(yearOf(now));
    return all.reduce((best, z) => (Math.abs(z.o - o) < Math.abs(best.o - o) ? z : best), all[0]);
  }
  // "1:02:09" or "12:05" until a moment.
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
  }
  const api = { ZONES, zones, windowOf, active, next, passed, mine, yearOf, clock };
  if (typeof window !== 'undefined') window.LUTSWave = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
