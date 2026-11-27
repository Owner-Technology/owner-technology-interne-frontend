// Toute sortie ou suspension posée par la direction passe par la pop-up finance : perte et dernier mois facturé
// se décident au moment où l'état est posé (dev 2026-11-18).
export const EXIT_DECISION_STATES = ['Rétractation', 'Résiliation', 'Self-Résiliation', 'Liquidation', 'Pause'];
export const requiresExitDecision = (role, state) =>
  ['admin', 'ceo', 'finance_director'].includes(role) && EXIT_DECISION_STATES.includes(state);

export function exitAmounts(values, limits) {
  const amounts = {};
  for (const key of ['past', 'current', 'future']) {
    const raw = String(values[key] ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount > Number(limits[key])) return null;
    amounts[`amount_${key}`] = amount;
  }
  return amounts;
}

// Pause datée du board (réunion du 27/11/2026) : rien n'est supprimé. Les mois qui commencent pendant la pause ne sont
// pas exigibles ; à la reprise, ils sont dus avec le mois en cours. Le paiement en une ou plusieurs fois reste manuel.
// `start` et `end` : les dates de la pause déjà écrites en français.
export const datedPauseSentence = (start, end) =>
  `Rien d’exigible du ${start} au ${end}. À la reprise, les mois de la pause sont dus avec le mois en cours.`;
