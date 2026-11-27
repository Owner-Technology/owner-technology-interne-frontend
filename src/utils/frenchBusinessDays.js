// Jours ouvrés français (lundi-vendredi, hors jours fériés de métropole) : la même règle que le back
// (`app/services/optilex_schedule.py`, `french_holidays` / `is_business_day`), recopiée ici pour un filtre
// d'affichage. Les jours sont des clés « AAAA-MM-JJ » (jour calendaire, sans heure ni fuseau).

const pad = (n) => String(n).padStart(2, '0');
const keyOfUtc = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utcOfKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (key, n) => {
  const d = utcOfKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOfUtc(d);
};

// Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien), comme le back.
export function easterSundayKey(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidayCache = new Map();
export function frenchHolidayKeys(year) {
  if (!holidayCache.has(year)) {
    const easter = easterSundayKey(year);
    holidayCache.set(year, new Set([
      `${year}-01-01`,          // Jour de l'An
      addDays(easter, 1),       // Lundi de Pâques
      `${year}-05-01`,          // Fête du Travail
      `${year}-05-08`,          // Victoire 1945
      addDays(easter, 39),      // Ascension
      addDays(easter, 50),      // Lundi de Pentecôte
      `${year}-07-14`,          // Fête nationale
      `${year}-08-15`,          // Assomption
      `${year}-11-01`,          // Toussaint
      `${year}-11-11`,          // Armistice
      `${year}-12-25`,          // Noël
    ]));
  }
  return holidayCache.get(year);
}

export function isBusinessDayKey(key) {
  const day = utcOfKey(key).getUTCDay();
  return day !== 0 && day !== 6 && !frenchHolidayKeys(Number(key.slice(0, 4))).has(key);
}

// Jours ouvrés écoulés après `fromKey`, jusqu'à `toKey` compris : 0 le jour même, 1 le jour ouvré suivant.
// `toKey` antérieur à `fromKey` : 0.
export function businessDaysAfter(fromKey, toKey) {
  let n = 0;
  for (let key = addDays(fromKey, 1); key <= toKey; key = addDays(key, 1)) {
    if (isBusinessDayKey(key)) n += 1;
  }
  return n;
}
