// boardRegularized.js — « régularisé le … » sur la frise des créances du board
// (facturation, 27/11/2026). Le serveur sert, avec l'état « regularized », le
// dernier règlement du mois : { period: 'YYYY-MM', paid_on: 'YYYY-MM-DD' | null }.
// Sans jour connu, le mois du règlement ; sans rien (confirmation manuelle),
// « régularisé » seul.

export function regularizedNote(p, { day, monthLabel }) {
  if (p?.state !== 'regularized') return '';
  const reg = p.regularized;
  if (reg?.paid_on) return `, régularisé le ${day(reg.paid_on)}`;
  if (reg?.period) return `, régularisé en ${monthLabel(reg.period, true)}`;
  return ', régularisé';
}
