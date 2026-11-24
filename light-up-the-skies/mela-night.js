// Mela Night's shared evening (rooms.js, the home card, the 7:30 reminder).
// One India clock so every phone agrees: 8:00–9:00 is the hour, 7:45 is the heads-up.
// The sky is the India date, so every room that night meets at the same temple.
(() => {
  const NIGHTS = [
    ['meenakshi-amman-temple', 'Temple Festival'],
    ['gateway-of-india', 'Ocean Lights'],
    ['golden-temple', 'Golden Night'],
    ['brihadeeswarar-temple', 'Drone Show'],
  ];
  const APOSTROPHE = '\u2019';
  const DOT = '\u00b7';
  function indiaClock(at = Date.now()) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const o = {};
    fmt.formatToParts(new Date(at)).forEach((p) => { if (p.type !== 'literal') o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute };
  }
  function sky(at = Date.now()) {
    const p = indiaClock(at);
    const index = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 864e5) % NIGHTS.length;
    const [world, name] = NIGHTS[index];
    return {
      world, name, index,
      on: p.h === 20,
      soon: p.h === 19 && p.min >= 45,
      key: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`,
    };
  }
  const say = {
    sky: (name) => `Tonight${APOSTROPHE}s sky: ${name}`,
    on: (name) => `On now ${DOT} ${name}`,
    soon: (name) => `Starts at 8 ${DOT} ${name}`,
    wait: 'The show starts in a moment. Computer players take the empty seats.',
    hearts: (name, n) => `${name} sent you ${n} hearts`,
    played: (name) => `${name} played with you`,
    here: (name) => `${name} is here tonight`,
    streak: (n, name) => `${n} nights with ${name}`,
    again: (name) => `Come back at 8. Tonight${APOSTROPHE}s sky: ${name}`,
    tomorrow: (name) => `Come back at 8. Tomorrow${APOSTROPHE}s sky: ${name}`,
  };
  // The next 8 o'clock. Before 8 that is tonight. Once 8 has arrived, it is tomorrow.
  function nextEvening(at = Date.now()) {
    const p = indiaClock(at);
    if (p.h < 20) return Object.assign(sky(at), { later: false });
    return Object.assign(sky(Date.UTC(p.y, p.m - 1, p.d + 1, 12)), { later: true });
  }
  function personOf(crew, today, yday) {
    if (!crew || (crew.day !== today && crew.day !== yday) || !crew.people || !crew.people.length) return null;
    return crew.people[0];
  }
  function streakOn(streak, today, yday) {
    return !!(streak && streak.mutual && streak.count >= 2 && streak.name && (streak.day === today || streak.day === yday));
  }
  function hereNow(seen, person, today) {
    return !!(seen && seen.n && person && seen.day === today && seen.u === person.u);
  }
  // Both phones came back: the count grows only when this person was in last night's show and their phone is here today.
  function noteBack(prev, person, today, yday, crew) {
    const played = crew && (crew.day === today || crew.day === yday) && (crew.people || []).some((p) => p.u === person.u);
    if (!played || !person || !person.u) return null;
    if (prev && prev.mutual && prev.day === today && prev.u === person.u) return prev;
    const base = prev && prev.mutual && prev.u === person.u && (prev.day === yday || prev.day === today) ? prev : null;
    return Object.assign(nextStreak(base, { u: person.u, n: person.n }, today, yday), { mutual: true });
  }
  // Home card: tonight's sky, plus one line about last night's people. Never a player count.
  function cardLines({ sky: s, crew, streak, today, yday, seen }) {
    const head = s.on ? say.on(s.name) : (s.soon ? say.soon(s.name) : say.sky(s.name));
    const person = personOf(crew, today, yday);
    let second = '';
    if (hereNow(seen, person, today)) second = say.here(person.n);
    else if (person && person.got > 0) second = say.hearts(person.n, person.got);
    else if (person) second = say.played(person.n);
    else if (streakOn(streak, today, yday)) second = say.streak(streak.count, streak.name);
    return second ? [head, second] : [head];
  }
  // The sheet can say both the hearts and the streak.
  function sheetLines(o) {
    const lines = [];
    if (o.sky && o.sky.on) lines.push(say.on(o.sky.name));
    else if (o.sky && o.sky.soon) lines.push(say.soon(o.sky.name));
    const person = personOf(o.crew, o.today, o.yday);
    if (hereNow(o.seen, person, o.today)) lines.push(say.here(person.n));
    const people = o.crew && (o.crew.day === o.today || o.crew.day === o.yday) ? (o.crew.people || []) : [];
    people.forEach((p) => lines.push(p.got > 0 ? say.hearts(p.n, p.got) : say.played(p.n)));
    if (streakOn(o.streak, o.today, o.yday)) lines.push(say.streak(o.streak.count, o.streak.name));
    return lines;
  }
  // The streak grows when this phone plays with the same person on the next India night.
  function nextStreak(prev, fav, today, yday) {
    let count = 1;
    if (prev && prev.u === fav.u && (prev.day === yday || prev.day === today)) count = prev.day === today ? (prev.count || 1) : (prev.count || 1) + 1;
    return { u: fav.u, name: fav.n, day: today, count };
  }
  const api = { NIGHTS, sky, indiaClock, say, cardLines, sheetLines, nextStreak, nextEvening, noteBack, personOf };
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  g.LUTSMelaNight = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
