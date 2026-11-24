// Festivals and special days for the Birthdays calendar, 2026 and 2027, built in (no network). Each one: id, name, the
// wish's heading (and its message where the borrowed occasion's would not fit), the card occasion whose theme and show it borrows (occ, an OCCASIONS id in game.js), its mark on the
// calendar (diya or rangoli) and its days as YYYY-MM-DD. The moving festivals follow the Indian calendar as most
// panchangs list them (lunar days and moon sightings can put a region a day either way); the fixed days are fixed.
(() => {
  const FESTIVALS = [
    { id: 'newyear', name: 'New Year', head: 'Happy New Year', occ: 'newyear', mark: 'rangoli', dates: ['2026-01-01', '2027-01-01'] },
    { id: 'lohri', name: 'Lohri', head: 'Happy Lohri', occ: 'pongal', mark: 'diya', dates: ['2026-01-13', '2027-01-13'] },
    { id: 'sankranti', name: 'Makar Sankranti', head: 'Happy Makar Sankranti', occ: 'pongal', mark: 'rangoli', dates: ['2026-01-14', '2027-01-15'] },
    { id: 'pongal', name: 'Pongal', head: 'Happy Pongal', occ: 'pongal', mark: 'rangoli', dates: ['2026-01-14', '2027-01-15'] },
    { id: 'republic', name: 'Republic Day', head: 'Happy Republic Day', occ: 'independence', mark: 'rangoli', dates: ['2026-01-26', '2027-01-26'] },
    { id: 'valentine', name: 'Valentine’s Day', head: 'Happy Valentine’s Day', occ: 'valentine', mark: 'rangoli', dates: ['2026-02-14', '2027-02-14'] },
    { id: 'holi', name: 'Holi', head: 'Happy Holi', occ: 'holi', mark: 'rangoli', dates: ['2026-03-04', '2027-03-22'] },
    { id: 'ugadi', name: 'Ugadi / Gudi Padwa', head: 'Happy Ugadi', occ: 'newyear', mark: 'rangoli', dates: ['2026-03-19', '2027-04-07'] },
    { id: 'eid', name: 'Eid al-Fitr', head: 'Eid Mubarak', occ: 'eid', mark: 'diya', dates: ['2026-03-20', '2027-03-10'] },
    { id: 'puthandu', name: 'Tamil New Year', head: 'Happy Tamil New Year', occ: 'newyear', mark: 'rangoli', dates: ['2026-04-14', '2027-04-14'] },
    { id: 'vishu', name: 'Vishu', head: 'Happy Vishu', occ: 'onam', msg: 'May this Vishu fill your year with light, plenty and golden konna flowers.', mark: 'diya', dates: ['2026-04-14', '2027-04-15'] },
    { id: 'mothersday', name: 'Mother’s Day', head: 'Happy Mother’s Day', occ: 'mothersday', mark: 'rangoli', dates: ['2026-05-10', '2027-05-09'] },
    { id: 'fathersday', name: 'Father’s Day', head: 'Happy Father’s Day', occ: 'fathersday', mark: 'rangoli', dates: ['2026-06-21', '2027-06-20'] },
    { id: 'independence', name: 'Independence Day', head: 'Happy Independence Day', occ: 'independence', mark: 'rangoli', dates: ['2026-08-15', '2027-08-15'] },
    { id: 'onam', name: 'Onam', head: 'Happy Onam', occ: 'onam', mark: 'rangoli', dates: ['2026-08-26', '2027-09-12'] },
    { id: 'rakhi', name: 'Raksha Bandhan', head: 'Happy Raksha Bandhan', occ: 'rakhi', mark: 'rangoli', dates: ['2026-08-28', '2027-08-17'] },
    { id: 'teachersday', name: 'Teachers’ Day', head: 'Happy Teachers’ Day', occ: 'teachersday', mark: 'rangoli', dates: ['2026-09-05', '2027-09-05'] },
    { id: 'ganesh', name: 'Ganesh Chaturthi', head: 'Ganpati Bappa Morya', occ: 'ganesh', mark: 'diya', dates: ['2026-09-14', '2027-09-04'] },
    { id: 'navratri', name: 'Navratri', head: 'Happy Navratri', occ: 'navratri', mark: 'diya', dates: ['2026-10-11', '2027-09-30'] },
    { id: 'durgapuja', name: 'Durga Puja', head: 'Happy Durga Puja', occ: 'durgapuja', mark: 'diya', dates: ['2026-10-18', '2027-10-07'] },
    { id: 'dussehra', name: 'Dussehra', head: 'Happy Dussehra', occ: 'durgapuja', msg: 'May good always win over evil in your life. Happy Dussehra!', mark: 'diya', dates: ['2026-10-20', '2027-10-09'] },
    { id: 'diwali', name: 'Diwali', head: 'Happy Diwali', occ: 'diwali', mark: 'diya', dates: ['2026-11-08', '2027-10-29'] },
    { id: 'childrensday', name: 'Children’s Day', head: 'Happy Children’s Day', occ: 'justbecause', msg: 'Stay curious, keep laughing and never stop shining. Happy Children’s Day!', mark: 'rangoli', dates: ['2026-11-14', '2027-11-14'] },
    { id: 'karthigai', name: 'Karthigai Deepam', head: 'Happy Karthigai Deepam', occ: 'diwali', mark: 'diya', dates: ['2026-11-24', '2027-12-12'] },
    { id: 'christmas', name: 'Christmas', head: 'Merry Christmas', occ: 'christmas', mark: 'rangoli', dates: ['2026-12-25', '2027-12-25'] },
  ];
  // Every festival on a day: { 'YYYY-MM-DD': [festival, …] }.
  const byDay = {};
  for (const f of FESTIVALS) for (const d of f.dates) (byDay[d] = byDay[d] || []).push(f);
  const api = { list: FESTIVALS, on: (key) => byDay[key] || [] };
  if (typeof window !== 'undefined') window.LUTSFestivals = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
