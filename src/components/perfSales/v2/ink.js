// Encre lisible sur un aplat de couleur (audit de lisibilité du 23/11/2026). Les teintes des canaux sont des pastels : un
// chiffre blanc n'y dépasse pas 2,3:1. Quand la teinte d'une case est connue en JS, son fond réel se calcule ici (même
// mélange que `color-mix(in srgb, …)`), et l'encre retenue est celle des deux encres Owner qui contraste le plus (WCAG).

// Jetons de owner.css dont le fond d'une case a besoin, en clair et en sombre (ink.test.js vérifie qu'ils restent égaux).
export const OWNER = {
  light: { card: '#ffffff', navy: '#2b2927' },
  dark: { card: '#1f1f1f', navy: '#ededed' },
};
export const owner = (dark) => OWNER[dark ? 'dark' : 'light'];

// Les deux encres Owner : l'encre presque noire de la page claire, le blanc des aplats foncés.
export const INKS = ['#1c1b19', '#ffffff'];
export const AA = 4.5;

// Valeur d'un jeton Owner dans le mode donné, pour un calcul ou une animation (framer-motion fige un var() à sa première
// lecture et ne suivrait pas le passage en sombre) ; une couleur écrite en clair passe telle quelle.
export const tokenHex = (color, dark) => ({ 'var(--navy)': owner(dark).navy, 'var(--card)': owner(dark).card }[color] || color);

// « #rgb », « #rrggbb » ou « rgb(r, g, b) » → [r, g, b] (0-255) ; null sinon (jeton CSS, couleur absente).
export function parseColor(color) {
  const s = String(color || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(s);
  return rgb ? rgb.slice(1, 4).map(Number) : null;
}

const channel = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

// Luminance relative WCAG 2.x.
export function luminance(color) {
  const [r, g, b] = parseColor(color).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// `color-mix(in srgb, color alpha, base)` : alpha (0-1) de la couleur, le reste du fond, canal par canal.
export function mixHex(colorHex, alpha, baseHex) {
  const c = parseColor(colorHex), b = parseColor(baseHex);
  if (!c || !b) return colorHex;   // jeton CSS ou couleur inconnue : rien à calculer
  const a = Math.max(0, Math.min(1, alpha));
  return toHex(c.map((v, i) => v * a + b[i] * (1 - a)));
}

const best = (bg, inks) => inks.reduce((top, ink) => (contrast(ink, bg) > contrast(top, bg) ? ink : top));

// L'encre la plus lisible sur `bg` parmi `inks`. Sur un fond de luminance moyenne (vers 4,1:1 pour l'une comme pour
// l'autre), aucune encre Owner n'atteint 4,5:1 : le noir ou le blanc pur prend le relais, qui en garantit au moins 4,58.
export function inkFor(bg, inks = INKS) {
  // Fond qu'on ne sait pas lire (jeton CSS, couleur absente) : pas d'encre imposée, la feuille de style décide.
  if (!parseColor(bg)) return undefined;
  const ink = best(bg, inks);
  return contrast(ink, bg) >= AA ? ink : best(bg, ['#000000', '#ffffff']);
}
